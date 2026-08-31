import {
  type AdapterError,
  adapterError,
  isAdapterError,
  mapAdapterError,
  type OperationOptions,
  type SecretStoragePort,
  SecretValue,
  throwIfAborted,
} from "../ports/index.ts";
import type {
  ReceiptAiModel,
  ReceiptAiModelQuery,
  ReceiptAiPort,
  ReceiptExtractionDraft,
  ReceiptExtractionRequest,
} from "../ports/receipt-ai.ts";
import {
  buildReceiptPrompt,
  mapReceiptOutputToDraft,
  parseReceiptOutput,
  RECEIPT_INSTRUCTION_VERSION,
  RECEIPT_JSON_SCHEMA,
  RECEIPT_SCHEMA_VERSION_NUMBER,
  ReceiptOutputError,
} from "../receipt-ai/schema.ts";
import { withEphemeralImage } from "../gemini/image.ts";
import {
  createOpenRouterClient,
  type OpenRouterBrowserClient,
  type OpenRouterChatRequest,
  type OpenRouterEndpoint,
  type OpenRouterModel,
} from "./client.ts";

export { REQUIRED_RECEIPT_AI_CAPABILITIES } from "../receipt-ai/capabilities.ts";

export type OpenRouterRoutingOptions = {
  readonly preferredProviderTag?: string;
  readonly requireZdr?: boolean;
  readonly denyProviderDataCollection?: boolean;
};

export type OpenRouterAdapterOptions = {
  readonly secretStorage: SecretStoragePort;
  readonly createClient: (apiKey: string) => OpenRouterBrowserClient;
  readonly getRoutingOptions?: () => OpenRouterRoutingOptions;
  readonly isOnline?: () => boolean;
};

export type OpenRouterClientFactory = (
  apiKey: string,
) => OpenRouterBrowserClient;

const SAFE_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const OPENROUTER_AUTO_ROUTER_MODEL_ID = "openrouter/auto";
const SAFE_LOCALE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const SAFE_IMAGE_MIME_TYPE = /^image\/[A-Za-z0-9.+-]+$/;
const REQUIRED_PARAMETERS = [
  "structured_outputs",
  "response_format",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasParameter(
  parameters: readonly string[],
  required: string,
): boolean {
  return parameters.includes(required);
}

function hasModality(
  modalities: readonly string[],
  required: string,
): boolean {
  return modalities.some((modality) => modality.toLowerCase() === required);
}

function qualifiesModel(model: OpenRouterModel): boolean {
  return hasModality(model.architecture.inputModalities, "image") &&
    hasModality(model.architecture.outputModalities, "text") &&
    REQUIRED_PARAMETERS.every((parameter) =>
      hasParameter(model.supportedParameters, parameter)
    );
}

function isDynamicAutoRouterModelId(modelId: string): boolean {
  return modelId === OPENROUTER_AUTO_ROUTER_MODEL_ID;
}

function toModel(model: OpenRouterModel): ReceiptAiModel | undefined {
  if (
    !SAFE_MODEL_ID.test(model.id) || isDynamicAutoRouterModelId(model.id) ||
    !qualifiesModel(model)
  ) return undefined;
  const displayName = model.name.trim();
  return {
    id: model.id,
    displayName: displayName.length > 0 ? displayName : model.id,
    lifecycle: "active",
    capabilities: Object.freeze({
      "image-input": true,
      "content-generation": true,
      "structured-output": true,
    }),
  };
}

function endpointSupportsReceiptSchema(endpoint: OpenRouterEndpoint): boolean {
  return REQUIRED_PARAMETERS.every((parameter) =>
    hasParameter(endpoint.supportedParameters, parameter)
  );
}

function endpointIdentity(endpoint: OpenRouterEndpoint): string {
  return `${endpoint.modelId}\u0000${endpoint.tag}`;
}

function routingOptions(
  getRoutingOptions: (() => OpenRouterRoutingOptions) | undefined,
):
  & Required<
    Pick<OpenRouterRoutingOptions, "requireZdr" | "denyProviderDataCollection">
  >
  & Pick<OpenRouterRoutingOptions, "preferredProviderTag"> {
  const configured = getRoutingOptions?.() ?? {};
  const preferredProviderTag =
    typeof configured.preferredProviderTag === "string" &&
      configured.preferredProviderTag.length > 0
      ? configured.preferredProviderTag
      : undefined;
  return {
    preferredProviderTag,
    requireZdr: configured.requireZdr === true,
    denyProviderDataCollection: configured.denyProviderDataCollection === true,
  };
}

function numericStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const direct = error.statusCode ?? error.status;
  if (typeof direct === "number") return direct;
  if (isRecord(error.response) && typeof error.response.status === "number") {
    return error.response.status;
  }
  if (
    isRecord(error.rawResponse) && typeof error.rawResponse.status === "number"
  ) {
    return error.rawResponse.status;
  }
  return undefined;
}

function errorName(error: unknown): string {
  if (!isRecord(error)) return "";
  const name = error.name;
  return typeof name === "string" ? name.toUpperCase() : "";
}

/** Map SDK failures into the existing redacted application taxonomy. */
export function mapOpenRouterError(
  error: unknown,
  operation: string,
): AdapterError {
  if (isAdapterError(error)) {
    return adapterError(error.code, error.operation, error.details);
  }

  const name = errorName(error);
  const status = numericStatus(error);
  const details = status === undefined ? {} : { httpStatus: status };

  if (
    name === "ABORTERROR" || name === "REQUESTABORTEDERROR" ||
    name === "REQUESTTIMEOUTERROR"
  ) {
    return adapterError("aborted", operation);
  }
  if (name === "CONNECTIONERROR") {
    return adapterError("unavailable", operation);
  }
  if (name === "INVALIDREQUESTERROR" || name === "SDKVALIDATIONERROR") {
    return adapterError("invalid-request", operation, details);
  }

  switch (status) {
    case 400:
    case 422:
      return adapterError("invalid-request", operation, details);
    case 401:
      return adapterError("unauthorized", operation, details);
    case 402:
      return adapterError("quota", operation, details);
    case 403:
      return adapterError("forbidden", operation, details);
    case 404:
      return adapterError("not-found", operation, details);
    case 408:
    case 429:
      return adapterError("rate-limited", operation, details);
    case 413:
      return adapterError("quota", operation, details);
    case 500:
    case 502:
    case 503:
    case 504:
    case 524:
    case 529:
      return adapterError("unavailable", operation, details);
    default:
      return mapAdapterError(error, operation);
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
    throw adapterError("invalid-request", "openrouter.extract");
  }
  if (request.instructionVersion !== RECEIPT_INSTRUCTION_VERSION) {
    throw adapterError("invalid-request", "openrouter.extract");
  }
  if (
    !SAFE_MODEL_ID.test(request.modelId) ||
    isDynamicAutoRouterModelId(request.modelId)
  ) {
    throw adapterError("invalid-request", "openrouter.extract");
  }
  if (!SAFE_LOCALE.test(request.locale)) {
    throw adapterError("invalid-request", "openrouter.extract");
  }
  if (!SAFE_IMAGE_MIME_TYPE.test(request.image.mimeType)) {
    throw adapterError("invalid-request", "openrouter.extract");
  }
  if (!request.image.metadataSanitized) {
    throw adapterError("invalid-request", "openrouter.extract");
  }
  if (request.image.bytes.byteLength === 0) {
    throw adapterError("invalid-request", "openrouter.extract");
  }
  if (request.image.bytes.byteLength > 20_000_000) {
    throw adapterError("quota", "openrouter.extract");
  }
  const ids = new Set<string>();
  for (const category of request.categories) {
    if (category.name.trim().length === 0 || !SAFE_MODEL_ID.test(category.id)) {
      throw adapterError("invalid-request", "openrouter.extract");
    }
    if (ids.has(category.id)) {
      throw adapterError("invalid-request", "openrouter.extract");
    }
    ids.add(category.id);
  }
}

function modelPath(
  modelId: string,
): { author: string; slug: string } | undefined {
  const slash = modelId.indexOf("/");
  if (slash <= 0 || slash === modelId.length - 1) return undefined;
  return {
    author: modelId.slice(0, slash),
    slug: modelId.slice(slash + 1),
  };
}

function requestForExtraction(
  request: ReceiptExtractionRequest,
  routing: ReturnType<typeof routingOptions>,
): OpenRouterChatRequest {
  const prompt = buildReceiptPrompt(request);
  const imageUrl = `data:${request.image.mimeType};base64,${
    bytesToBase64(request.image.bytes)
  }`;
  return {
    model: request.modelId,
    messages: [{
      role: "user",
      content: [{ type: "text", text: prompt }, {
        type: "image_url",
        imageUrl: { url: imageUrl },
      }],
    }],
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "receipt-extraction",
        strict: true,
        schema: RECEIPT_JSON_SCHEMA,
      },
    },
    provider: {
      requireParameters: true,
      ...(routing.preferredProviderTag === undefined
        ? {}
        : { order: [routing.preferredProviderTag] }),
      ...(routing.requireZdr ? { zdr: true } : {}),
      ...(routing.denyProviderDataCollection ? { dataCollection: "deny" } : {}),
    },
  };
}

export class OpenRouterAdapter implements ReceiptAiPort {
  readonly #secretStorage: SecretStoragePort;
  readonly #createClient: OpenRouterClientFactory;
  readonly #getRoutingOptions: (() => OpenRouterRoutingOptions) | undefined;
  readonly #isOnline: () => boolean;

  constructor(options: OpenRouterAdapterOptions) {
    this.#secretStorage = options.secretStorage;
    this.#createClient = options.createClient;
    this.#getRoutingOptions = options.getRoutingOptions;
    this.#isOnline = options.isOnline ??
      (() => typeof navigator === "undefined" || navigator.onLine !== false);
  }

  async getApiKey(
    options?: OperationOptions,
  ): Promise<SecretValue | undefined> {
    return await this.#secretStorage.get("openrouter-api-key", options);
  }

  async setApiKey(value: string, options?: OperationOptions): Promise<void> {
    if (value.trim().length === 0) {
      throw adapterError("invalid-request", "openrouter.key.set");
    }
    await this.#secretStorage.set(
      "openrouter-api-key",
      SecretValue.from(value),
      options,
    );
  }

  async removeApiKey(options?: OperationOptions): Promise<void> {
    await this.#secretStorage.remove("openrouter-api-key", options);
  }

  async listModels(
    query: ReceiptAiModelQuery,
    options?: OperationOptions,
  ): Promise<readonly ReceiptAiModel[]> {
    const routing = routingOptions(this.#getRoutingOptions);
    try {
      const client = await this.#client(options, "openrouter.listModels");
      const pages = await client.models.list({
        supportedParameters: "structured_outputs,response_format",
        inputModalities: "image,text",
        outputModalities: "text",
        ...(routing.requireZdr ? { zdr: "true" } : {}),
      }, options);
      const models: ReceiptAiModel[] = [];
      for await (const page of pages) {
        for (const raw of page.models) {
          const model = toModel(raw);
          if (model === undefined) continue;
          if (
            query.requiredCapabilities.some((capability) =>
              model.capabilities[capability] !== true
            )
          ) continue;
          models.push(model);
        }
      }
      return models;
    } catch (error) {
      throw mapOpenRouterError(error, "openrouter.listModels");
    }
  }

  /** List structured-output endpoint choices for one exact selected model. */
  async listEndpoints(
    modelId: string,
    options?: OperationOptions,
  ): Promise<readonly OpenRouterEndpoint[]> {
    if (
      !SAFE_MODEL_ID.test(modelId) || isDynamicAutoRouterModelId(modelId)
    ) {
      throw adapterError("invalid-request", "openrouter.listEndpoints");
    }
    const path = modelPath(modelId);
    if (path === undefined) {
      throw adapterError("invalid-request", "openrouter.listEndpoints");
    }
    const routing = routingOptions(this.#getRoutingOptions);
    const client = await this.#client(options, "openrouter.listEndpoints");
    try {
      const response = await client.endpoints.list(path, options);
      const endpoints = response.endpoints.filter(
        endpointSupportsReceiptSchema,
      );
      if (!routing.requireZdr) return endpoints;

      const zdrEndpoints = await client.endpoints.listZdrEndpoints(options);
      const zdrIdentities = new Set(zdrEndpoints.map(endpointIdentity));
      return endpoints.filter((endpoint) =>
        zdrIdentities.has(endpointIdentity(endpoint))
      );
    } catch (error) {
      throw mapOpenRouterError(error, "openrouter.listEndpoints");
    }
  }

  async extractReceipt(
    request: ReceiptExtractionRequest,
    options?: OperationOptions,
  ): Promise<ReceiptExtractionDraft> {
    validateRequest(request);
    try {
      return await withEphemeralImage(request.image.bytes, async () => {
        if (!this.#isOnline()) {
          throw adapterError("offline", "openrouter.extract");
        }
        throwIfAborted(options?.signal);
        const client = await this.#client(options, "openrouter.extract");
        throwIfAborted(options?.signal);
        const routing = routingOptions(this.#getRoutingOptions);
        const response = await client.chat.send(
          requestForExtraction(request, routing),
          options,
        );
        if (typeof response.text !== "string") {
          throw adapterError("invalid-output", "openrouter.extract.response");
        }
        let output;
        try {
          output = parseReceiptOutput(response.text);
        } catch (error) {
          const phase = error instanceof ReceiptOutputError
            ? error.phase
            : "schema";
          throw adapterError(
            "invalid-output",
            `openrouter.extract.output.${phase}`,
          );
        }
        try {
          return mapReceiptOutputToDraft(output, request);
        } catch {
          throw adapterError("invalid-output", "openrouter.extract.mapping");
        }
      });
    } catch (error) {
      throw mapOpenRouterError(error, "openrouter.extract");
    }
  }

  async #client(
    options: OperationOptions | undefined,
    operation: string,
  ): Promise<OpenRouterBrowserClient> {
    if (!this.#isOnline()) throw adapterError("offline", operation);
    throwIfAborted(options?.signal);
    try {
      const stored = await this.#secretStorage.get(
        "openrouter-api-key",
        options,
      );
      if (stored === undefined) throw adapterError("unauthorized", operation);
      return this.#createClient(stored.reveal());
    } catch (error) {
      throw mapOpenRouterError(error, operation);
    }
  }
}

export function createOpenRouterAdapter(
  options: Omit<OpenRouterAdapterOptions, "createClient"> & {
    readonly createClient?: OpenRouterClientFactory;
  },
): OpenRouterAdapter {
  return new OpenRouterAdapter({
    ...options,
    createClient: options.createClient ?? createOpenRouterClient,
  });
}
