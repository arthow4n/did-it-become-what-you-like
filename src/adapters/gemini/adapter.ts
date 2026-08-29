import {
  type AdapterError,
  adapterError,
  isAdapterError,
  type OperationOptions,
  type SecretStoragePort,
  SecretValue,
  throwIfAborted,
} from "../ports/index.ts";
import type {
  GeminiCapability,
  GeminiConfigurationResult,
  GeminiModel,
  GeminiModelAndExtractionPort,
  GeminiModelQuery,
  ReceiptExtractionDraft,
  ReceiptExtractionRequest,
} from "../ports/gemini.ts";
import type { PreparedImage } from "../ports/image.ts";
import {
  type GeminiJsonSchema,
  mapReceiptOutputToDraft,
  parseReceiptOutput,
  RECEIPT_INSTRUCTION_VERSION,
  RECEIPT_JSON_SCHEMA,
  RECEIPT_SCHEMA_VERSION,
  RECEIPT_SCHEMA_VERSION_NUMBER,
  validateReceiptOutput,
} from "./schema.ts";
import { withEphemeralImage } from "./image.ts";

export const REQUIRED_GEMINI_CAPABILITIES: readonly GeminiCapability[] = [
  "image-input",
  "content-generation",
  "structured-output",
];

export type GeminiModelCapabilityLabel =
  | "Compatible"
  | "Incompatible"
  | "Needs test";

export type GeminiRawModel = {
  readonly name?: unknown;
  readonly baseModelId?: unknown;
  readonly displayName?: unknown;
  readonly lifecycle?: unknown;
  readonly supportedGenerationMethods?: unknown;
  readonly inputModalities?: unknown;
  readonly outputModalities?: unknown;
  readonly supportedResponseFormats?: unknown;
  readonly capabilities?: unknown;
};

export type GeminiListRequest = {
  readonly pageSize?: number;
  readonly pageToken?: string;
};

export type GeminiListPage = {
  readonly models: readonly GeminiRawModel[];
  readonly nextPageToken?: string;
};

export type GeminiListResult =
  | GeminiListPage
  | AsyncIterable<GeminiRawModel>;

export type GeminiContent =
  | { readonly text: string }
  | {
    readonly inlineData: { readonly data: string; readonly mimeType: string };
  };

export type GeminiGenerateRequest = {
  readonly model: string;
  readonly contents: readonly GeminiContent[];
  readonly config: {
    readonly responseMimeType: "application/json";
    readonly responseSchema: GeminiJsonSchema;
    readonly systemInstruction: string;
  };
};

export type GeminiGenerateResponse = {
  readonly text?: unknown;
};

export interface GeminiBrowserClient {
  readonly models: {
    list(
      request?: GeminiListRequest,
    ): GeminiListResult | Promise<GeminiListResult>;
    generateContent(
      request: GeminiGenerateRequest,
      options?: OperationOptions,
    ): GeminiGenerateResponse | Promise<GeminiGenerateResponse>;
  };
}

export type GeminiClientFactory = (apiKey: string) => GeminiBrowserClient;

export type GeminiAdapterOptions = {
  readonly secretStorage: SecretStoragePort;
  readonly createClient: GeminiClientFactory;
  readonly isOnline?: () => boolean;
};

const SAFE_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const SAFE_LOCALE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }
  return value;
}

function capabilityEvidence(
  raw: GeminiRawModel,
  capability: GeminiCapability,
): boolean | undefined {
  if (isRecord(raw.capabilities)) {
    const value = raw.capabilities[capability];
    if (typeof value === "boolean") return value;
  }

  if (capability === "content-generation") {
    const methods = stringArray(raw.supportedGenerationMethods);
    return methods === undefined
      ? undefined
      : methods.includes("generateContent");
  }
  if (capability === "image-input") {
    const modalities = stringArray(raw.inputModalities);
    return modalities === undefined
      ? undefined
      : modalities.some((value) => value.toLowerCase() === "image");
  }
  const formats = stringArray(raw.supportedResponseFormats);
  if (formats !== undefined) {
    return formats.some((value) =>
      value === "application/json" || value.toLowerCase() === "json-schema"
    );
  }
  const outputModalities = stringArray(raw.outputModalities);
  return outputModalities === undefined
    ? undefined
    : outputModalities.some((value) => value.toLowerCase() === "json");
}

function modelIdOf(raw: GeminiRawModel): string | undefined {
  const candidate = typeof raw.baseModelId === "string"
    ? raw.baseModelId
    : typeof raw.name === "string"
    ? raw.name.replace(/^models\//, "")
    : undefined;
  return candidate !== undefined && SAFE_MODEL_ID.test(candidate)
    ? candidate
    : undefined;
}

function modelLifecycle(raw: GeminiRawModel): GeminiModel["lifecycle"] {
  return raw.lifecycle === "deprecated" || raw.lifecycle === "unavailable"
    ? raw.lifecycle
    : "active";
}

function toModel(raw: GeminiRawModel): GeminiModel | undefined {
  const id = modelIdOf(raw);
  if (id === undefined) return undefined;
  return {
    id,
    displayName:
      typeof raw.displayName === "string" && raw.displayName.trim().length > 0
        ? raw.displayName.trim()
        : id,
    lifecycle: modelLifecycle(raw),
    capabilities: Object.freeze({
      "image-input": capabilityEvidence(raw, "image-input") === true,
      "content-generation":
        capabilityEvidence(raw, "content-generation") === true,
      "structured-output":
        capabilityEvidence(raw, "structured-output") === true,
    }),
  };
}

function hasExplicitUnsupportedCapability(
  raw: GeminiRawModel,
  capabilities: readonly GeminiCapability[],
): boolean {
  return capabilities.some((capability) =>
    capabilityEvidence(raw, capability) === false
  );
}

function requiredCapabilities(
  query: GeminiModelQuery,
): readonly GeminiCapability[] {
  const requested = query.requiredCapabilities.length === 0
    ? REQUIRED_GEMINI_CAPABILITIES
    : query.requiredCapabilities;
  return [...new Set(requested)];
}

function missingCapabilities(
  model: GeminiModel,
  required: readonly GeminiCapability[],
): readonly GeminiCapability[] {
  return required.filter((capability) => !model.capabilities[capability]);
}

export function geminiModelCapabilityLabel(
  model: GeminiModel,
  query: GeminiModelQuery,
): GeminiModelCapabilityLabel {
  if (model.lifecycle !== "active") return "Incompatible";
  return missingCapabilities(model, requiredCapabilities(query)).length === 0
    ? "Compatible"
    : "Needs test";
}

function numericStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const status = error.status ??
    (isRecord(error.response) ? error.response.status : undefined);
  return typeof status === "number" ? status : undefined;
}

function foreignCode(error: unknown): string {
  if (!isRecord(error)) return "";
  const code = error.code ?? error.statusText ?? error.name;
  return typeof code === "string" ? code.toUpperCase() : "";
}

/** Map provider failures to the existing redacted adapter taxonomy. */
export function mapGeminiError(
  error: unknown,
  operation: string,
): AdapterError {
  if (isAdapterError(error)) {
    return adapterError(error.code, operation, error.details);
  }
  if (isRecord(error) && error.name === "AbortError") {
    return adapterError("aborted", operation);
  }

  const code = foreignCode(error);
  const status = numericStatus(error);
  if (code.includes("API_KEY") || code.includes("UNAUTHENTICATED")) {
    return adapterError("unauthorized", operation);
  }
  if (code.includes("RESOURCE_EXHAUSTED") || code.includes("QUOTA")) {
    return adapterError("quota", operation);
  }
  if (code.includes("PERMISSION_DENIED")) {
    return adapterError("unauthorized", operation);
  }
  if (code.includes("INVALID_ARGUMENT")) {
    return adapterError("invalid-request", operation);
  }
  if (code.includes("UNAVAILABLE")) {
    return adapterError("unavailable", operation);
  }
  switch (status) {
    case 400:
      return adapterError("invalid-request", operation);
    case 401:
      return adapterError("unauthorized", operation);
    case 403:
      return adapterError("unauthorized", operation);
    case 404:
      return adapterError("not-found", operation);
    case 408:
    case 429:
      return adapterError("quota", operation);
    case 500:
    case 502:
    case 503:
    case 504:
      return adapterError("unavailable", operation);
    default:
      return adapterError("unknown", operation);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8_000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

function validateRequest(request: ReceiptExtractionRequest): void {
  if (request.schemaVersion !== RECEIPT_SCHEMA_VERSION_NUMBER) {
    throw adapterError("invalid-request", "gemini.extract");
  }
  if (request.instructionVersion !== RECEIPT_INSTRUCTION_VERSION) {
    throw adapterError("invalid-request", "gemini.extract");
  }
  if (!SAFE_MODEL_ID.test(request.modelId)) {
    throw adapterError("invalid-request", "gemini.extract");
  }
  if (!SAFE_LOCALE.test(request.locale)) {
    throw adapterError("invalid-request", "gemini.extract");
  }
  if (!request.image.metadataSanitized) {
    throw adapterError("invalid-request", "gemini.extract");
  }
  if (request.image.bytes.byteLength === 0) {
    throw adapterError("invalid-request", "gemini.extract");
  }
  if (request.image.bytes.byteLength > 20_000_000) {
    throw adapterError("quota", "gemini.extract");
  }
  const ids = new Set<string>();
  for (const category of request.categories) {
    if (!SAFE_MODEL_ID.test(category.id) || category.name.trim().length === 0) {
      throw adapterError("invalid-request", "gemini.extract");
    }
    if (ids.has(category.id)) {
      throw adapterError("invalid-request", "gemini.extract");
    }
    ids.add(category.id);
  }
}

function promptFor(request: ReceiptExtractionRequest): string {
  const categories = request.categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));
  return [
    `Extract the selected receipt image into exactly schema ${RECEIPT_SCHEMA_VERSION}.`,
    `Instruction version: ${RECEIPT_INSTRUCTION_VERSION}.`,
    `Device locale: ${request.locale}.`,
    `Project default currency: ${request.currency}.`,
    `Active category catalogue (use an existing id only; never create a category): ${
      JSON.stringify(categories)
    }.`,
    "Return JSON only. Preserve uncertainty and printed-total mismatches.",
  ].join("\n");
}

function syntheticImage(): PreparedImage {
  // A real 1x1 opaque PNG. The compatibility probe must exercise multimodal
  // decoding without sending owner data; arbitrary text labelled as an image
  // is rejected by Gemini before model capabilities can be tested.
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  return {
    bytes: Uint8Array.from(atob(base64), (value) => value.charCodeAt(0)),
    mimeType: "image/png",
    width: 1,
    height: 1,
    metadataSanitized: true,
    preparationApplied: false,
  };
}

function responseText(response: GeminiGenerateResponse): string {
  if (!isRecord(response) || typeof response.text !== "string") {
    throw new Error("Gemini response text is missing");
  }
  return response.text;
}

async function resolveListResult(
  result: GeminiListResult,
): Promise<GeminiListPage> {
  if (!("models" in result)) {
    const models: GeminiRawModel[] = [];
    for await (const model of result as AsyncIterable<GeminiRawModel>) {
      models.push(model);
    }
    return { models };
  }
  return result;
}

export class GeminiAdapter implements GeminiModelAndExtractionPort {
  readonly #secretStorage: SecretStoragePort;
  readonly #createClient: GeminiClientFactory;
  readonly #isOnline: () => boolean;
  readonly #rawModels = new Map<string, GeminiRawModel>();
  #compatibilityVersion = 0;

  constructor(options: GeminiAdapterOptions) {
    this.#secretStorage = options.secretStorage;
    this.#createClient = options.createClient;
    this.#isOnline = options.isOnline ??
      (() => typeof navigator === "undefined" || navigator.onLine !== false);
  }

  get compatibilityVersion(): number {
    return this.#compatibilityVersion;
  }

  async getApiKey(
    options?: OperationOptions,
  ): Promise<SecretValue | undefined> {
    return await this.#secretStorage.get("gemini-api-key", options);
  }

  async setApiKey(value: string, options?: OperationOptions): Promise<void> {
    if (value.trim().length === 0) {
      throw adapterError("invalid-request", "gemini.key.set");
    }
    await this.#secretStorage.set(
      "gemini-api-key",
      SecretValue.from(value),
      options,
    );
    this.#invalidateCompatibility();
  }

  async removeApiKey(options?: OperationOptions): Promise<void> {
    await this.#secretStorage.remove("gemini-api-key", options);
    this.#invalidateCompatibility();
  }

  async listModels(
    query: GeminiModelQuery,
    options?: OperationOptions,
  ): Promise<readonly GeminiModel[]> {
    const client = await this.#client(options, "gemini.listModels");
    const rawModels = await this.#listRawModels(client, options);
    this.#rawModels.clear();
    const models: GeminiModel[] = [];
    for (const raw of rawModels) {
      const model = toModel(raw);
      if (model === undefined) continue;
      models.push(model);
      this.#rawModels.set(model.id, raw);
    }
    // `query` is intentionally used by the consumer's label calculation. A
    // model list must retain Needs test entries instead of filtering them out.
    void query;
    return models;
  }

  async testConfiguration(
    modelId: string,
    query: GeminiModelQuery,
    options?: OperationOptions,
  ): Promise<GeminiConfigurationResult> {
    const required = requiredCapabilities(query);
    const client = await this.#client(options, "gemini.testConfiguration");
    const rawModels = await this.#listRawModels(client, options);
    const raw = rawModels.find((candidate) => modelIdOf(candidate) === modelId);
    const model = raw === undefined ? undefined : toModel(raw);
    if (
      raw === undefined || model === undefined || model.lifecycle !== "active"
    ) {
      return {
        status: "incompatible",
        ...(model === undefined ? {} : { model }),
        missingCapabilities: required,
      };
    }
    this.#rawModels.set(model.id, raw);
    if (hasExplicitUnsupportedCapability(raw, required)) {
      return {
        status: "incompatible",
        model,
        missingCapabilities: missingCapabilities(model, required),
      };
    }
    if (missingCapabilities(model, required).length > 0) {
      // Metadata did not establish all required capabilities, so only the
      // synthetic call can promote the model to compatible.
      try {
        await this.#syntheticConfiguration(client, model.id, options);
      } catch (error) {
        const mapped = mapGeminiError(error, "gemini.testConfiguration");
        if (
          ["aborted", "offline", "unauthorized", "quota", "unavailable"]
            .includes(mapped.code)
        ) {
          throw mapped;
        }
        return { status: "incompatible", model, missingCapabilities: required };
      }
    } else {
      await this.#syntheticConfiguration(client, model.id, options);
    }
    const compatible: GeminiModel = {
      ...model,
      capabilities: Object.freeze({
        "image-input": true,
        "content-generation": true,
        "structured-output": true,
      }),
    };
    return { status: "compatible", model: compatible };
  }

  async extractReceipt(
    request: ReceiptExtractionRequest,
    options?: OperationOptions,
  ): Promise<ReceiptExtractionDraft> {
    validateRequest(request);
    if (!this.#isOnline()) throw adapterError("offline", "gemini.extract");
    throwIfAborted(options?.signal);
    const prompt = promptFor(request);
    try {
      return await withEphemeralImage(request.image.bytes, async () => {
        const client = await this.#client(options, "gemini.extract");
        throwIfAborted(options?.signal);
        const response = await client.models.generateContent({
          model: request.modelId,
          contents: [
            { text: prompt },
            {
              inlineData: {
                data: bytesToBase64(request.image.bytes),
                mimeType: request.image.mimeType,
              },
            },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: RECEIPT_JSON_SCHEMA,
            systemInstruction: prompt,
          },
        }, options);
        let output;
        try {
          output = parseReceiptOutput(responseText(response));
        } catch {
          throw adapterError("corrupt-data", "gemini.extract");
        }
        try {
          return mapReceiptOutputToDraft(output, request);
        } catch {
          throw adapterError("corrupt-data", "gemini.extract");
        }
      });
    } catch (error) {
      throw mapGeminiError(error, "gemini.extract");
    }
  }

  #invalidateCompatibility(): void {
    this.#rawModels.clear();
    this.#compatibilityVersion += 1;
  }

  async #client(
    options: OperationOptions | undefined,
    operation: string,
  ): Promise<GeminiBrowserClient> {
    if (!this.#isOnline()) throw adapterError("offline", operation);
    throwIfAborted(options?.signal);
    try {
      const stored = await this.#secretStorage.get("gemini-api-key", options);
      if (stored === undefined) throw adapterError("unauthorized", operation);
      return this.#createClient(stored.reveal());
    } catch (error) {
      throw mapGeminiError(error, operation);
    }
  }

  async #listRawModels(
    client: GeminiBrowserClient,
    options?: OperationOptions,
  ): Promise<readonly GeminiRawModel[]> {
    throwIfAborted(options?.signal);
    const models: GeminiRawModel[] = [];
    let pageToken: string | undefined;
    do {
      const page = await resolveListResult(
        await client.models.list({
          pageSize: 1_000,
          ...(pageToken === undefined ? {} : { pageToken }),
        }),
      );
      models.push(...page.models);
      // Async iterable clients already yield every page and therefore do not
      // expose a token. Page-based clients are followed until exhausted.
      pageToken = page.nextPageToken;
    } while (pageToken !== undefined);
    return models;
  }

  async #syntheticConfiguration(
    client: GeminiBrowserClient,
    modelIdValue: string,
    options?: OperationOptions,
  ): Promise<void> {
    const image = syntheticImage();
    const request: ReceiptExtractionRequest = {
      modelId: modelIdValue,
      image,
      schemaVersion: RECEIPT_SCHEMA_VERSION_NUMBER,
      instructionVersion: RECEIPT_INSTRUCTION_VERSION,
      categories: [{ id: "category-uncategorized", name: "Uncategorized" }],
      locale: "en-US",
      currency: "USD",
    };
    const prompt = promptFor(request);
    try {
      const response = await client.models.generateContent({
        model: modelIdValue,
        contents: [
          {
            text:
              "Return one valid synthetic receipt.v1 object; do not use a real receipt.",
          },
          {
            inlineData: {
              data: bytesToBase64(image.bytes),
              mimeType: image.mimeType,
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: RECEIPT_JSON_SCHEMA,
          systemInstruction: prompt,
        },
      }, options);
      validateReceiptOutput(JSON.parse(responseText(response)) as unknown);
    } finally {
      image.bytes.fill(0);
    }
  }
}

export function createGeminiAdapter(
  options: GeminiAdapterOptions,
): GeminiAdapter {
  return new GeminiAdapter(options);
}
