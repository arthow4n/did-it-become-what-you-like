import {
  createOpenRouterAdapter,
  mapOpenRouterError,
  type OpenRouterRoutingOptions,
} from "./adapter.ts";
import type {
  OpenRouterBrowserClient,
  OpenRouterChatRequest,
  OpenRouterEndpointPage,
  OpenRouterModelPage,
} from "./client.ts";
import {
  buildReceiptPrompt,
  RECEIPT_INSTRUCTION_VERSION,
  RECEIPT_JSON_SCHEMA,
  RECEIPT_SCHEMA_VERSION,
  RECEIPT_SCHEMA_VERSION_NUMBER,
} from "../receipt-ai/schema.ts";
import {
  createLocalStorageSecretStorage,
  OPENROUTER_API_KEY_STORAGE_KEY,
} from "../gemini/secrets.ts";
import {
  isAdapterError,
  type ReceiptExtractionRequest,
} from "../ports/index.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function assertRejects(
  operation: () => Promise<unknown>,
): Promise<unknown> {
  try {
    await operation();
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to reject");
}

type MemoryStorage = {
  readonly values: Map<string, string>;
  readonly storage: Storage;
};

function memoryStorage(): MemoryStorage {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    },
  } as MemoryStorage;
}

const MODEL_ID = "google/gemini-2.5-flash";
const QUALIFIED_MODEL = {
  id: MODEL_ID,
  canonicalSlug: MODEL_ID,
  name: "Gemini 2.5 Flash",
  architecture: {
    inputModalities: ["text", "image"],
    outputModalities: ["text"],
  },
  supportedParameters: ["structured_outputs", "response_format"],
};
const SECOND_QUALIFIED_MODEL = {
  ...QUALIFIED_MODEL,
  id: "qwen/qwen2.5-vl-7b-instruct",
  canonicalSlug: "qwen/qwen2.5-vl-7b-instruct",
  name: "Qwen VL",
};
const AUTO_ROUTER_MODEL = {
  ...QUALIFIED_MODEL,
  id: "openrouter/auto",
  canonicalSlug: "openrouter/auto",
  name: "Auto Router",
};

const INVALID_MODELS = {
  noImage: {
    ...QUALIFIED_MODEL,
    id: "openai/text-only",
    canonicalSlug: "openai/text-only",
    architecture: {
      inputModalities: ["text"],
      outputModalities: ["text"],
    },
  },
  noTextOutput: {
    ...QUALIFIED_MODEL,
    id: "openai/image-output",
    canonicalSlug: "openai/image-output",
    architecture: {
      inputModalities: ["image"],
      outputModalities: ["image"],
    },
  },
  missingSchema: {
    ...QUALIFIED_MODEL,
    id: "openai/missing-schema",
    canonicalSlug: "openai/missing-schema",
    supportedParameters: ["response_format"],
  },
};

const OUTPUT = JSON.stringify({
  currency: "SEK",
  date: "2026-08-31",
  lines: [{
    amount: "10",
    categoryId: "category-groceries",
    description: "Synthetic item",
    direction: "outflow",
    kind: "purchase",
    rationale: "The product row is a purchase outflow.",
    selected: true,
  }],
  merchant: "Synthetic shop",
  mismatch: null,
  printedTotal: "10",
  schemaVersion: RECEIPT_SCHEMA_VERSION,
  uncertainty: [],
});

function extractionRequest(
  bytes = Uint8Array.from([1, 2, 3]),
): ReceiptExtractionRequest {
  return {
    categories: [{ id: "category-groceries", name: "Groceries" }],
    currency: "SEK",
    image: {
      bytes,
      height: 1,
      metadataSanitized: true,
      mimeType: "image/jpeg",
      preparationApplied: false,
      width: 1,
    },
    instructionVersion: RECEIPT_INSTRUCTION_VERSION,
    locale: "sv-SE",
    modelId: MODEL_ID,
    schemaVersion: RECEIPT_SCHEMA_VERSION_NUMBER,
  };
}

function modelPages(
  pages: readonly (readonly typeof QUALIFIED_MODEL[])[],
): AsyncIterable<OpenRouterModelPage> {
  return (async function* () {
    for (const models of pages) yield { models };
  })();
}

function createFixture(options: {
  readonly models?: readonly typeof QUALIFIED_MODEL[];
  readonly modelPages?: readonly (readonly typeof QUALIFIED_MODEL[])[];
  readonly routing?: OpenRouterRoutingOptions;
  readonly onModelsList?: (request: unknown) => void;
  readonly modelsFailure?: unknown;
  readonly onEndpointsList?: (request: unknown) => void;
  readonly onZdrList?: () => void;
  readonly onChat?: (request: OpenRouterChatRequest) => void;
  readonly responseText?: unknown;
  readonly chatFailure?: unknown;
  readonly endpoints?: OpenRouterEndpointPage;
  readonly zdrEndpoints?: OpenRouterEndpointPage["endpoints"];
  readonly online?: boolean;
} = {}): {
  readonly adapter: ReturnType<typeof createOpenRouterAdapter>;
  readonly storage: MemoryStorage;
} {
  const storage = memoryStorage();
  const secretStorage = createLocalStorageSecretStorage(storage.storage);
  const client: OpenRouterBrowserClient = {
    models: {
      list: (request) => {
        options.onModelsList?.(request);
        if (options.modelsFailure !== undefined) {
          return Promise.reject(options.modelsFailure);
        }
        return Promise.resolve(
          modelPages(
            options.modelPages ?? [options.models ?? [QUALIFIED_MODEL]],
          ),
        );
      },
    },
    endpoints: {
      list: (request) => {
        options.onEndpointsList?.(request);
        return Promise.resolve(
          options.endpoints ?? {
            modelId: MODEL_ID,
            endpoints: [],
          },
        );
      },
      listZdrEndpoints: () => {
        options.onZdrList?.();
        return Promise.resolve(options.zdrEndpoints ?? []);
      },
    },
    chat: {
      send: (request) => {
        options.onChat?.(request);
        if (options.chatFailure !== undefined) {
          return Promise.reject(options.chatFailure);
        }
        return Promise.resolve({ text: options.responseText ?? OUTPUT });
      },
    },
  };
  const adapter = createOpenRouterAdapter({
    secretStorage,
    createClient: () => client,
    getRoutingOptions: () => options.routing ?? {},
    isOnline: () => options.online ?? true,
  });
  return { adapter, storage };
}

function endpoint(
  tag: string,
  providerName = "Synthetic Provider",
  modelId = MODEL_ID,
  supportedParameters = ["structured_outputs", "response_format"],
) {
  return { modelId, providerName, tag, supportedParameters };
}

Deno.test("OpenRouter secrets use the existing namespaced SecretStoragePort", async () => {
  const memory = memoryStorage();
  const storage = createLocalStorageSecretStorage(memory.storage);
  const adapter = createOpenRouterAdapter({
    secretStorage: storage,
    createClient: () => {
      throw new Error("client must not be constructed by key storage tests");
    },
  });
  await adapter.setApiKey("sk-or-v1.synthetic");
  assertEquals(
    memory.values.get(OPENROUTER_API_KEY_STORAGE_KEY),
    "sk-or-v1.synthetic",
  );
  const key = await adapter.getApiKey();
  assert(key !== undefined);
  assertEquals(String(key), "[REDACTED]");
  assert(!JSON.stringify({ key }).includes("sk-or-v1.synthetic"));
  await adapter.removeApiKey();
  assertEquals(memory.values.has(OPENROUTER_API_KEY_STORAGE_KEY), false);
});

Deno.test("model refresh uses exact metadata filters, consumes pagination, and never extracts", async () => {
  const requests: unknown[] = [];
  let chatCalls = 0;
  const fixture = createFixture({
    models: [
      QUALIFIED_MODEL,
      AUTO_ROUTER_MODEL,
      INVALID_MODELS.noImage,
      INVALID_MODELS.noTextOutput,
      INVALID_MODELS.missingSchema,
    ],
    onModelsList: (request) => requests.push(request),
    onChat: () => chatCalls++,
  });
  await fixture.adapter.setApiKey("sk-or-v1.synthetic-models");
  const models = await fixture.adapter.listModels({
    requiredCapabilities: [
      "image-input",
      "content-generation",
      "structured-output",
    ],
  });
  assertEquals(models.map((model) => model.id), [MODEL_ID]);
  assertEquals(models[0]?.capabilities, {
    "image-input": true,
    "content-generation": true,
    "structured-output": true,
  });
  assertEquals(requests, [{
    supportedParameters: "structured_outputs,response_format",
    inputModalities: "image,text",
    outputModalities: "text",
  }]);
  assertEquals(chatCalls, 0);
});

Deno.test("model refresh consumes every SDK page", async () => {
  const fixture = createFixture({
    modelPages: [[QUALIFIED_MODEL], [SECOND_QUALIFIED_MODEL]],
  });
  await fixture.adapter.setApiKey("sk-or-v1.synthetic-pagination");
  const models = await fixture.adapter.listModels({ requiredCapabilities: [] });
  assertEquals(
    models.map((model) => model.id),
    [MODEL_ID, SECOND_QUALIFIED_MODEL.id],
  );
});

Deno.test("ZDR model discovery adds the exact pinned SDK filter", async () => {
  const requests: unknown[] = [];
  const fixture = createFixture({
    routing: { requireZdr: true },
    onModelsList: (request) => requests.push(request),
  });
  await fixture.adapter.setApiKey("sk-or-v1.synthetic-zdr-models");
  await fixture.adapter.listModels({ requiredCapabilities: ["image-input"] });
  assertEquals(requests, [{
    supportedParameters: "structured_outputs,response_format",
    inputModalities: "image,text",
    outputModalities: "text",
    zdr: "true",
  }]);
});

Deno.test("endpoint discovery filters schema support and intersects ZDR by modelId plus tag", async () => {
  const modelEndpoints = [
    endpoint("provider-a", "Provider A"),
    endpoint("provider-b", "Provider B"),
    endpoint("provider-no-schema", "Provider No Schema", MODEL_ID, [
      "response_format",
    ]),
  ];
  const requests: unknown[] = [];
  let zdrCalls = 0;
  const fixture = createFixture({
    routing: { requireZdr: true },
    onEndpointsList: (request) => requests.push(request),
    onZdrList: () => zdrCalls++,
    endpoints: { modelId: MODEL_ID, endpoints: modelEndpoints },
    zdrEndpoints: [
      endpoint("provider-b", "Different display name"),
      endpoint("provider-a", "Provider A", "other/model"),
    ],
  });
  await fixture.adapter.setApiKey("sk-or-v1.synthetic-endpoints");
  const endpoints = await fixture.adapter.listEndpoints(MODEL_ID);
  assertEquals(endpoints, [modelEndpoints[1]]);
  assertEquals(requests, [{ author: "google", slug: "gemini-2.5-flash" }]);
  assertEquals(zdrCalls, 1);
});

Deno.test("extraction sends shared prompt first, one base64 image second, strict schema, and privacy routing", async () => {
  let captured: OpenRouterChatRequest | undefined;
  const bytes = Uint8Array.from([1, 2, 3]);
  const fixture = createFixture({
    routing: {
      preferredProviderTag: "provider-a",
      requireZdr: true,
      denyProviderDataCollection: true,
    },
    onChat: (request) => captured = request,
  });
  await fixture.adapter.setApiKey("sk-or-v1.synthetic-extract");
  const draft = await fixture.adapter.extractReceipt(extractionRequest(bytes));
  assertEquals(draft.lines[0]?.description, "Synthetic item");
  assert(captured !== undefined);
  assertEquals(captured.model, MODEL_ID);
  assertEquals(Object.prototype.hasOwnProperty.call(captured, "models"), false);
  assertEquals(captured.messages.length, 1);
  assertEquals(captured.messages[0]?.content.length, 2);
  assertEquals(captured.messages[0]?.content[0], {
    type: "text",
    text: buildReceiptPrompt(extractionRequest()),
  });
  assertEquals(captured.messages[0]?.content[1], {
    type: "image_url",
    imageUrl: { url: "data:image/jpeg;base64,AQID" },
  });
  assertEquals(captured.responseFormat, {
    type: "json_schema",
    jsonSchema: {
      name: "receipt-extraction",
      strict: true,
      schema: RECEIPT_JSON_SCHEMA,
    },
  });
  assertEquals(captured.provider, {
    requireParameters: true,
    order: ["provider-a"],
    zdr: true,
    dataCollection: "deny",
  });
  assertEquals(bytes.every((byte) => byte === 0), true);
});

Deno.test("extraction omits optional privacy fields and keeps same-model fallback enabled by default", async () => {
  let captured: OpenRouterChatRequest | undefined;
  const fixture = createFixture({ onChat: (request) => captured = request });
  await fixture.adapter.setApiKey("sk-or-v1.synthetic-defaults");
  await fixture.adapter.extractReceipt(extractionRequest());
  assert(captured !== undefined);
  assertEquals(captured.provider, { requireParameters: true });
  assertEquals(
    Object.prototype.hasOwnProperty.call(captured.provider, "allowFallbacks"),
    false,
  );
  assertEquals(
    Object.prototype.hasOwnProperty.call(captured.provider, "dataCollection"),
    false,
  );
});

Deno.test("invalid output is rejected through the shared parser and redacted", async () => {
  const hostile = "credential=sk-or-v1.hostile";
  const fixture = createFixture({
    responseText: JSON.stringify({ hostile }),
  });
  await fixture.adapter.setApiKey("sk-or-v1.synthetic-invalid-output");
  const error = await assertRejects(() =>
    fixture.adapter.extractReceipt(extractionRequest())
  );
  assert(isAdapterError(error));
  assertEquals(error.code, "invalid-output");
  assertEquals(error.operation, "openrouter.extract.output.schema");
  assert(!error.message.includes(hostile));
  assert(!JSON.stringify(error).includes(hostile));
});

Deno.test("provider failures, offline state, abort, and cleanup use safe adapter errors", async () => {
  const providerSecret = "sk-or-v1.provider-secret";
  const fixture = createFixture({
    chatFailure: {
      statusCode: 401,
      body: providerSecret,
      message: providerSecret,
    },
  });
  await fixture.adapter.setApiKey(providerSecret);
  const bytes = Uint8Array.from([9, 8, 7]);
  const error = await assertRejects(() =>
    fixture.adapter.extractReceipt(extractionRequest(bytes))
  );
  assert(isAdapterError(error));
  assertEquals(error.code, "unauthorized");
  assert(!error.message.includes(providerSecret));
  assert(!JSON.stringify(error).includes(providerSecret));
  assertEquals(bytes.every((byte) => byte === 0), true);

  const offlineFixture = createFixture({ online: false });
  await offlineFixture.adapter.setApiKey("sk-or-v1.synthetic-offline");
  const offlineBytes = Uint8Array.from([1, 2]);
  assertEquals(
    await errorCode(
      offlineFixture.adapter.extractReceipt(extractionRequest(offlineBytes)),
    ),
    "offline",
  );
  assertEquals(offlineBytes.every((byte) => byte === 0), true);

  const controller = new AbortController();
  const abortFixture = createFixture({
    onChat: (_request) => {
      // The fake rejects through the adapter's signal check before any provider
      // payload is retained; the real SDK receives the same signal.
    },
  });
  await abortFixture.adapter.setApiKey("sk-or-v1.synthetic-abort");
  controller.abort();
  assertEquals(
    await errorCode(
      abortFixture.adapter.extractReceipt(extractionRequest(), {
        signal: controller.signal,
      }),
    ),
    "aborted",
  );
});

Deno.test("invalid requests never call the provider", async () => {
  let calls = 0;
  const fixture = createFixture({ onChat: () => calls++ });
  await fixture.adapter.setApiKey("sk-or-v1.synthetic-invalid-request");
  const request = extractionRequest();
  const error = await assertRejects(() =>
    fixture.adapter.extractReceipt({
      ...request,
      instructionVersion: "wrong-version",
    })
  );
  assert(isAdapterError(error));
  assertEquals(error.code, "invalid-request");
  assertEquals(calls, 0);

  const autoRouterError = await assertRejects(() =>
    fixture.adapter.extractReceipt({
      ...request,
      modelId: "openrouter/auto",
    })
  );
  assert(isAdapterError(autoRouterError));
  assertEquals(autoRouterError.code, "invalid-request");
  assertEquals(autoRouterError.operation, "openrouter.extract");
  assertEquals(calls, 0);
});

Deno.test("OpenRouter error mapping preserves only safe status taxonomy", () => {
  const secret = "sk-or-v1.raw-provider-payload";
  const error = mapOpenRouterError({
    statusCode: 429,
    body: secret,
    message: secret,
  }, "openrouter.extract");
  assertEquals(error.code, "rate-limited");
  assertEquals(error.details, { httpStatus: "429" });
  assert(!error.message.includes(secret));
  assert(!JSON.stringify(error).includes(secret));
  assertEquals(
    mapOpenRouterError({ name: "ConnectionError" }, "openrouter.listModels")
      .code,
    "unavailable",
  );
});

Deno.test("model discovery maps provider failures without retaining raw payloads", async () => {
  const secret = "sk-or-v1.list-models-provider-payload";
  const fixture = createFixture({
    modelsFailure: { statusCode: 503, body: secret, message: secret },
  });
  await fixture.adapter.setApiKey(secret);
  const error = await assertRejects(() =>
    fixture.adapter.listModels({ requiredCapabilities: [] })
  );
  assert(isAdapterError(error));
  assertEquals(error.code, "unavailable");
  assert(!error.message.includes(secret));
  assert(!JSON.stringify(error).includes(secret));
});

async function errorCode(operation: Promise<unknown>): Promise<string> {
  const error = await assertRejects(() => operation);
  assert(isAdapterError(error));
  return error.code;
}
