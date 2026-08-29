import {
  createGeminiAdapter,
  type GeminiBrowserClient,
  type GeminiGenerateRequest,
  type GeminiGenerateResponse,
  geminiModelCapabilityLabel,
  type GeminiRawModel,
  REQUIRED_RECEIPT_AI_CAPABILITIES,
} from "./adapter.ts";
import {
  createEphemeralObjectUrl,
  createImagePreparationPort,
  IMAGE_LIMITS,
  type ImagePreparationOperations,
  prepareImage,
  stripImageMetadata,
  stripJpegMetadata,
  withEphemeralImage,
} from "./image.ts";
import {
  parseReceiptOutput,
  RECEIPT_INSTRUCTION_VERSION,
  RECEIPT_JSON_SCHEMA,
  RECEIPT_SCHEMA_VERSION,
  RECEIPT_SCHEMA_VERSION_NUMBER,
} from "./schema.ts";
import {
  createLocalStorageSecretStorage,
  GEMINI_API_KEY_STORAGE_KEY,
} from "./secrets.ts";
import {
  isAdapterError,
  type ReceiptExtractionRequest,
  SecretValue,
} from "../ports/index.ts";
import { moneyAdd } from "../../domain/money/index.ts";

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

const JPEG_WITH_EXIF = Uint8Array.from([
  0xff,
  0xd8,
  0xff,
  0xe1,
  0x00,
  0x0a,
  0x45,
  0x78,
  0x69,
  0x66,
  0x00,
  0x00,
  0x73,
  0x79,
  0xff,
  0xda,
  0x00,
  0x02,
  0x33,
  0xff,
  0xd9,
]);

const PNG_WITH_TEXT_METADATA = Uint8Array.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0,
  0,
  0,
  0,
  0x49,
  0x48,
  0x44,
  0x52,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0x74,
  0x45,
  0x58,
  0x74,
  0,
  0,
  0,
  3,
  0x67,
  0x70,
  0x73,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0x49,
  0x45,
  0x4e,
  0x44,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
]);

const VALID_PNG_WITH_TEXT_METADATA = Uint8Array.from([
  ...PNG_WITH_TEXT_METADATA.slice(0, 8),
  0,
  0,
  0,
  0,
  0x49,
  0x48,
  0x44,
  0x52,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  3,
  0x74,
  0x45,
  0x58,
  0x74,
  0x67,
  0x70,
  0x73,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0x49,
  0x45,
  0x4e,
  0x44,
  0,
  0,
  0,
  0,
]);

const WEBP_WITH_EXIF = Uint8Array.from([
  0x52,
  0x49,
  0x46,
  0x46,
  0,
  0,
  0,
  0,
  0x57,
  0x45,
  0x42,
  0x50,
  0x56,
  0x50,
  0x38,
  0x20,
  4,
  0,
  0,
  0,
  1,
  2,
  3,
  4,
  0x45,
  0x58,
  0x49,
  0x46,
  3,
  0,
  0,
  0,
  0x67,
  0x70,
  0x73,
  0,
]);

const RECEIPT_OUTPUT = JSON.stringify({
  currency: "SEK",
  date: "2026-08-24",
  lines: [{
    amount: "10",
    categoryId: "category-groceries",
    description: "Synthetic item",
    direction: "outflow",
    kind: "purchase",
    rationale: "Synthetic product row; classified as a purchase outflow.",
    selected: true,
  }],
  merchant: "Synthetic shop",
  mismatch: null,
  printedTotal: "10",
  schemaVersion: RECEIPT_SCHEMA_VERSION,
  uncertainty: [],
});

const RECEIPT_DISCOUNT_OUTPUT = JSON.stringify({
  currency: "SEK",
  date: "2026-08-29",
  lines: [{
    amount: "341.54",
    categoryId: "category-groceries",
    description: "Receipt purchases",
    direction: "outflow",
    kind: "purchase",
    rationale: "Product rows sum to the printed pre-discount amount.",
    selected: true,
  }, {
    amount: "-15.76",
    categoryId: "category-groceries",
    description: "Discount",
    direction: "inflow",
    kind: "adjustment",
    rationale:
      "The RABATTER section shows a discount reducing the amount owed.",
    selected: true,
  }],
  merchant: "Coop",
  mismatch: null,
  printedTotal: "325.78",
  schemaVersion: RECEIPT_SCHEMA_VERSION,
  uncertainty: [],
});

const MODEL_NEEDS_TEST: GeminiRawModel = {
  baseModelId: "gemini-needs-test",
  displayName: "Needs test model",
  name: "models/gemini-needs-test",
  supportedActions: ["generateContent"],
};

const MODEL_TEXT_ONLY: GeminiRawModel = {
  baseModelId: "gemini-text-only",
  displayName: "Text only model",
  name: "models/gemini-text-only",
  supportedActions: ["countTokens"],
};

function createStorageAndAdapter(
  clientFactory: (requests: GeminiGenerateRequest[]) => GeminiBrowserClient,
  options: { readonly online?: boolean } = {},
): {
  adapter: ReturnType<typeof createGeminiAdapter>;
  requests: GeminiGenerateRequest[];
  storage: MemoryStorage;
} {
  const storage = memoryStorage();
  const requests: GeminiGenerateRequest[] = [];
  const secretStorage = createLocalStorageSecretStorage(storage.storage);
  const adapter = createGeminiAdapter({
    createClient: () => clientFactory(requests),
    isOnline: () => options.online ?? true,
    secretStorage,
  });
  return { adapter, requests, storage };
}

function clientWithModels(
  models: readonly GeminiRawModel[],
  response: GeminiGenerateResponse = { text: RECEIPT_OUTPUT },
  onGenerate?: (request: GeminiGenerateRequest) => void,
): GeminiBrowserClient {
  return {
    models: {
      list: (request) => {
        const pageToken = request?.pageToken;
        return pageToken === undefined
          ? {
            models: models.slice(0, 1),
            nextPageToken: models.length > 1 ? "next" : undefined,
          }
          : { models: models.slice(1) };
      },
      generateContent: (request) => {
        onGenerate?.(request);
        return response;
      },
    },
  };
}

function extractionRequest(
  bytes = JPEG_WITH_EXIF.slice(),
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
    modelId: "gemini-needs-test",
    schemaVersion: RECEIPT_SCHEMA_VERSION_NUMBER,
  };
}

async function errorCode(operation: Promise<unknown>): Promise<string> {
  const error = await assertRejects(() => operation);
  assert(isAdapterError(error));
  return error.code;
}

Deno.test("A-301 key storage is namespaced, removable, and opaque", async () => {
  const memory = memoryStorage();
  const storage = createLocalStorageSecretStorage(memory.storage);
  const secret = "AIza.synthetic-do-not-log";
  await storage.set("gemini-api-key", SecretValue.from(secret));
  assertEquals(memory.values.get(GEMINI_API_KEY_STORAGE_KEY), secret);
  const loaded = await storage.get("gemini-api-key");
  assert(loaded !== undefined);
  assertEquals(String(loaded), "[REDACTED]");
  assert(
    !JSON.stringify({ loaded, memory: [...memory.values.keys()] }).includes(
      secret,
    ),
  );
  await storage.remove("gemini-api-key");
  assertEquals(memory.values.has(GEMINI_API_KEY_STORAGE_KEY), false);
});

Deno.test("A-301 models retain Needs test entries and synthetic validation promotes only tested models", async () => {
  const { adapter, requests } = createStorageAndAdapter((requests) =>
    clientWithModels(
      [MODEL_NEEDS_TEST],
      { text: RECEIPT_OUTPUT },
      (request) => {
        requests.push(request);
        const media = request.contents.find((part) => "inlineData" in part);
        if (media === undefined || !("inlineData" in media)) {
          throw { status: 400 };
        }
        const validOnePixelPng =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        if (
          media.inlineData.mimeType !== "image/png" ||
          media.inlineData.data !== validOnePixelPng
        ) {
          throw { status: 400 };
        }
      },
    )
  );
  await adapter.setApiKey("AIza.synthetic-model-test");
  const models = await adapter.listModels({
    requiredCapabilities: REQUIRED_RECEIPT_AI_CAPABILITIES,
  });
  assertEquals(models.length, 1);
  assertEquals(
    geminiModelCapabilityLabel(models[0], {
      requiredCapabilities: REQUIRED_RECEIPT_AI_CAPABILITIES,
    }),
    "Needs test",
  );
  const result = await adapter.testConfiguration("gemini-needs-test", {
    requiredCapabilities: REQUIRED_RECEIPT_AI_CAPABILITIES,
  });
  assertEquals(result.status, "compatible");
  assertEquals(requests.length, 1);
  if (result.status === "compatible") {
    assertEquals(
      geminiModelCapabilityLabel(result.model, {
        requiredCapabilities: REQUIRED_RECEIPT_AI_CAPABILITIES,
      }),
      "Compatible",
    );
  }
});

Deno.test("A-301 compatibility probe accepts the same fenced structured output as extraction", async () => {
  const { adapter } = createStorageAndAdapter(() =>
    clientWithModels([MODEL_NEEDS_TEST], {
      text: `\`\`\`json\n${RECEIPT_OUTPUT}\n\`\`\``,
    })
  );
  await adapter.setApiKey("AIza.synthetic-fenced-probe");
  const result = await adapter.testConfiguration("gemini-needs-test", {
    requiredCapabilities: REQUIRED_RECEIPT_AI_CAPABILITIES,
  });
  assertEquals(result.status, "compatible");
});

Deno.test("A-301 explicit text-only and retired models are incompatible", async () => {
  const retired: GeminiRawModel = {
    ...MODEL_NEEDS_TEST,
    baseModelId: "gemini-retired",
    lifecycle: "deprecated",
  };
  const { adapter } = createStorageAndAdapter(() =>
    clientWithModels([MODEL_TEXT_ONLY, retired])
  );
  await adapter.setApiKey("AIza.synthetic-lifecycle-test");
  const textOnly = await adapter.testConfiguration("gemini-text-only", {
    requiredCapabilities: REQUIRED_RECEIPT_AI_CAPABILITIES,
  });
  assertEquals(textOnly.status, "incompatible");
  const deprecated = await adapter.testConfiguration("gemini-retired", {
    requiredCapabilities: REQUIRED_RECEIPT_AI_CAPABILITIES,
  });
  assertEquals(deprecated.status, "incompatible");
});

Deno.test("A-301 extraction sends only permitted context, maps validated output, and clears bytes", async () => {
  const { adapter, requests } = createStorageAndAdapter((captured) =>
    clientWithModels(
      [MODEL_NEEDS_TEST],
      { text: RECEIPT_OUTPUT },
      (request) => captured.push(request),
    )
  );
  await adapter.setApiKey("AIza.synthetic-request-test");
  const bytes = JPEG_WITH_EXIF.slice();
  const draft = await adapter.extractReceipt(extractionRequest(bytes));
  assertEquals(draft.date, "2026-08-24");
  assertEquals(draft.lines[0].categoryId, "category-groceries");
  assertEquals(draft.lines[0].amount, "10");
  assertEquals(draft.lines[0].kind, "purchase");
  assertEquals(draft.lines[0].direction, "outflow");
  assertEquals(
    draft.lines[0].rationale,
    "Synthetic product row; classified as a purchase outflow.",
  );
  assertEquals(draft.lines[0].selected, true);
  assertEquals(draft.uncertainty, []);
  assertEquals(bytes.every((byte) => byte === 0), true);
  assertEquals(requests.length, 1);
  const requestText = JSON.stringify(requests[0]);
  assert(requestText.includes("category-groceries"));
  assert(requestText.includes("sv-SE"));
  assert(requestText.includes("SEK"));
  assert(!requestText.includes("expense history"));
  assert(!requestText.includes("Drive"));
  assert(!requestText.includes("AIza.synthetic-request-test"));
  assert(
    requests[0].config.systemInstruction.includes(
      "copy each numeric amount exactly as printed",
    ),
  );
  assert(
    requests[0].config.systemInstruction.includes(
      "Discounts, refunds, cashback, bottle-deposit returns",
    ),
  );
  assert(
    requests[0].config.systemInstruction.includes(
      "provide a concise rationale",
    ),
  );
  assertEquals(requests[0].config.responseMimeType, "application/json");
  assertEquals(requests[0].config.responseJsonSchema, RECEIPT_JSON_SCHEMA);
});

Deno.test("A-301 signed receipt fixture reconciles a discount adjustment", async () => {
  const { adapter } = createStorageAndAdapter(() =>
    clientWithModels([MODEL_NEEDS_TEST], { text: RECEIPT_DISCOUNT_OUTPUT })
  );
  await adapter.setApiKey("AIza.synthetic-discount-test");
  const draft = await adapter.extractReceipt(extractionRequest());
  assertEquals(draft.printedTotal, "325.78");
  assertEquals(draft.lines[0]?.amount, "341.54");
  assertEquals(draft.lines[0]?.kind, "purchase");
  assertEquals(draft.lines[0]?.direction, "outflow");
  assertEquals(draft.lines[1]?.amount, "-15.76");
  assertEquals(draft.lines[1]?.kind, "adjustment");
  assertEquals(draft.lines[1]?.direction, "inflow");
  assertEquals(
    draft.lines[1]?.rationale,
    "The RABATTER section shows a discount reducing the amount owed.",
  );
  assertEquals(
    draft.lines.reduce((total, line) => moneyAdd(total, line.amount), "0"),
    "325.78",
  );
});

Deno.test("A-301 localized receipt decimals are canonicalized before validation", async () => {
  const localized = JSON.stringify({
    currency: "SEK",
    date: "2026-08-29",
    lines: [{
      amount: "341,54",
      categoryId: "category-groceries",
      description: "Receipt purchases",
      direction: "outflow",
      kind: "purchase",
      rationale: "Product rows are listed in the receipt body.",
      selected: true,
    }, {
      amount: "-15,76",
      categoryId: "category-groceries",
      description: "Discount",
      direction: "inflow",
      kind: "adjustment",
      rationale: "The discount is shown in the receipt discount section.",
      selected: true,
    }],
    merchant: "Coop",
    mismatch: null,
    printedTotal: "325,78",
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    uncertainty: [],
  });
  const { adapter } = createStorageAndAdapter(() =>
    clientWithModels([MODEL_NEEDS_TEST], { text: localized })
  );
  await adapter.setApiKey("AIza.synthetic-localized-decimals");
  const draft = await adapter.extractReceipt(extractionRequest());
  assertEquals(draft.printedTotal, "325.78");
  assertEquals(draft.lines[0]?.amount, "341.54");
  assertEquals(draft.lines[1]?.amount, "-15.76");
});

Deno.test("A-301 unavailable model categories remain reviewable", async () => {
  const unknownCategory = RECEIPT_OUTPUT.replace(
    "category-groceries",
    "category-not-in-catalogue",
  );
  const { adapter } = createStorageAndAdapter(() =>
    clientWithModels([MODEL_NEEDS_TEST], { text: unknownCategory })
  );
  await adapter.setApiKey("AIza.synthetic-unknown-category");
  const draft = await adapter.extractReceipt(extractionRequest());
  assertEquals(draft.lines[0]?.categoryId, "category-not-in-catalogue");
  assert(
    draft.lines[0]?.uncertainty?.includes(
      "The suggested category is unavailable",
    ),
  );
});

Deno.test("A-301 fenced JSON output is accepted only after strict parsing", async () => {
  const { adapter } = createStorageAndAdapter(() =>
    clientWithModels([MODEL_NEEDS_TEST], {
      text: `Here is the receipt:\n\`\`\`json\n${RECEIPT_OUTPUT}\n\`\`\``,
    })
  );
  await adapter.setApiKey("AIza.synthetic-fenced-output");
  const draft = await adapter.extractReceipt(extractionRequest());
  assertEquals(draft.lines[0]?.amount, "10");
});

Deno.test("A-301 malformed decimal grouping remains rejected", async () => {
  const { adapter } = createStorageAndAdapter(() =>
    clientWithModels([MODEL_NEEDS_TEST], {
      text: RECEIPT_OUTPUT.replace('"10"', '"1 2"'),
    })
  );
  await adapter.setApiKey("AIza.synthetic-invalid-grouping");
  assertEquals(
    await errorCode(adapter.extractReceipt(extractionRequest())),
    "invalid-output",
  );
});

Deno.test("A-301 malformed or hostile model output is rejected and redacted", async () => {
  const hostile = "<script>credential=AIza.hostile-output</script>";
  const { adapter } = createStorageAndAdapter(() =>
    clientWithModels([MODEL_NEEDS_TEST], {
      text: JSON.stringify({
        currency: "SEK",
        date: "2026-08-24",
        lines: [],
        merchant: "Shop",
        mismatch: null,
        printedTotal: "0",
        schemaVersion: RECEIPT_SCHEMA_VERSION,
        uncertainty: [],
        hostile,
      }),
    })
  );
  await adapter.setApiKey("AIza.synthetic-output-test");
  const error = await assertRejects(() =>
    adapter.extractReceipt(extractionRequest())
  );
  assert(isAdapterError(error));
  assertEquals(error.code, "invalid-output");
  assertEquals(error.operation, "gemini.extract.output.schema");
  assert(!error.message.includes(hostile));
  assert(!JSON.stringify(error).includes(hostile));
});

Deno.test("A-301 malformed provider JSON reports the response parsing phase", async () => {
  const { adapter } = createStorageAndAdapter(() =>
    clientWithModels([MODEL_NEEDS_TEST], { text: "not-json" })
  );
  await adapter.setApiKey("AIza.synthetic-malformed-json");
  const error = await assertRejects(() =>
    adapter.extractReceipt(extractionRequest())
  );
  assert(isAdapterError(error));
  assertEquals(error.code, "invalid-output");
  assertEquals(error.operation, "gemini.extract.output.json");
});

Deno.test("A-301 maps invalid, quota, offline, and abort failures to typed redacted errors", async () => {
  const scenarios: Array<[string, unknown, string]> = [
    ["invalid", { status: 400, message: "AIza.invalid" }, "invalid-request"],
    ["quota", { status: 429, message: "secret quota detail" }, "quota"],
  ];
  for (const [name, failure, expected] of scenarios) {
    const { adapter } = createStorageAndAdapter(() => ({
      models: {
        list: () => ({ models: [MODEL_NEEDS_TEST] }),
        generateContent: () => Promise.reject(failure),
      },
    }));
    await adapter.setApiKey(`AIza.synthetic-${name}`);
    assertEquals(
      await errorCode(adapter.extractReceipt(extractionRequest())),
      expected,
    );
  }

  const offline =
    createStorageAndAdapter(() => clientWithModels([MODEL_NEEDS_TEST]), {
      online: false,
    }).adapter;
  await offline.setApiKey("AIza.synthetic-offline");
  assertEquals(
    await errorCode(offline.extractReceipt(extractionRequest())),
    "offline",
  );

  const bytes = JPEG_WITH_EXIF.slice();
  const controller = new AbortController();
  const abortingClient: GeminiBrowserClient = {
    models: {
      list: () => ({ models: [MODEL_NEEDS_TEST] }),
      generateContent: (_request, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject({ name: "AbortError" }),
            { once: true },
          );
        }),
    },
  };
  const aborted = createStorageAndAdapter(() => abortingClient).adapter;
  await aborted.setApiKey("AIza.synthetic-abort");
  const pending = aborted.extractReceipt(extractionRequest(bytes), {
    signal: controller.signal,
  });
  controller.abort();
  assertEquals(await errorCode(pending), "aborted");
  assertEquals(bytes.every((byte) => byte === 0), true);
});

Deno.test("A-301 schema source rejects hostile extra fields and preserves schema equivalence", () => {
  const output = parseReceiptOutput(RECEIPT_OUTPUT);
  assertEquals(output.schemaVersion, RECEIPT_SCHEMA_VERSION);
  const schema = RECEIPT_JSON_SCHEMA as {
    readonly required?: readonly string[];
    readonly additionalProperties?: boolean;
    readonly properties?: Readonly<Record<string, Record<string, unknown>>>;
  };
  assertEquals(schema.additionalProperties, false);
  assert(schema.required?.includes("lines"));
  const properties = schema.properties;
  assert(properties !== undefined);
  assertEquals(properties.schemaVersion.enum, [RECEIPT_SCHEMA_VERSION]);
  assertEquals(properties.mismatch.type, ["object", "null"]);
  const lineItems = properties.lines.items as {
    readonly required?: readonly string[];
  };
  assert(lineItems.required?.includes("direction"));
  assert(lineItems.required?.includes("rationale"));

  const supportedKeywords = new Set([
    "type",
    "properties",
    "required",
    "additionalProperties",
    "enum",
    "format",
    "items",
    "prefixItems",
    "minItems",
    "maxItems",
    "minimum",
    "maximum",
    "title",
    "description",
  ]);
  const assertSupportedSchema = (value: unknown): void => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      assert(supportedKeywords.has(key), `Unsupported schema keyword: ${key}`);
      if (key === "properties") {
        for (const child of Object.values(entry as Record<string, unknown>)) {
          assertSupportedSchema(child);
        }
      } else if (key === "items" || key === "additionalProperties") {
        assertSupportedSchema(entry);
      } else if (key === "prefixItems" && Array.isArray(entry)) {
        entry.forEach(assertSupportedSchema);
      }
    }
  };
  assertSupportedSchema(schema);
  assertRejects(() =>
    Promise.resolve(
      parseReceiptOutput(`${RECEIPT_OUTPUT.slice(0, -1)},"hostile":"x"}`),
    )
  );
});

const fakeOperations: ImagePreparationOperations = {
  stripMetadata: stripImageMetadata,
  resize: (input, maxDimension) => ({
    ...input,
    height: Math.min(input.height, maxDimension),
    width: Math.min(input.width, maxDimension),
  }),
  compress: (input) => ({ ...input, bytes: input.bytes.slice(0, 3) }),
};

Deno.test("A-301 always strips metadata while preparation off preserves dimensions", async () => {
  const input = {
    bytes: JPEG_WITH_EXIF,
    height: 3_500,
    mimeType: "image/jpeg",
    width: 5_200,
  } as const;
  const off = await prepareImage(input, { enabled: false }, fakeOperations);
  assertEquals(off.width, 5_200);
  assertEquals(off.height, 3_500);
  assertEquals(off.preparationApplied, false);
  assertEquals(new TextDecoder().decode(off.bytes).includes("Exif"), false);
  const on = await prepareImage(input, { enabled: true }, fakeOperations);
  assertEquals(on.preparationApplied, true);
  assertEquals(on.bytes.length, 3);
  assertEquals(stripJpegMetadata(JPEG_WITH_EXIF), stripJpegMetadata(off.bytes));
  assertEquals(
    new TextDecoder().decode(
      stripImageMetadata({
        bytes: VALID_PNG_WITH_TEXT_METADATA,
        height: 1,
        mimeType: "image/png",
        width: 1,
      }).bytes,
    ).includes("gps"),
    false,
  );
  assertEquals(
    new TextDecoder().decode(
      stripImageMetadata({
        bytes: WEBP_WITH_EXIF,
        height: 1,
        mimeType: "image/webp",
        width: 1,
      }).bytes,
    ).includes("gps"),
    false,
  );
  assertEquals(IMAGE_LIMITS.localPreparedMaxDimension, 4_096);
});

Deno.test("A-301 image port maps invalid preparation and cancellation to typed errors", async () => {
  const port = createImagePreparationPort({
    ...fakeOperations,
    stripMetadata: () => {
      throw new Error("hostile image data");
    },
  });
  assertEquals(
    await errorCode(port.prepare({
      bytes: JPEG_WITH_EXIF,
      height: 1,
      mimeType: "image/jpeg",
      width: 1,
    }, { enabled: false })),
    "invalid-request",
  );
  const controller = new AbortController();
  controller.abort();
  assertEquals(
    await errorCode(port.prepare({
      bytes: JPEG_WITH_EXIF,
      height: 1,
      mimeType: "image/jpeg",
      width: 1,
    }, { enabled: false, signal: controller.signal })),
    "aborted",
  );
});

Deno.test("A-301 object URL and byte cleanup run once after success, failure, and cancel", async () => {
  const revoked: string[] = [];
  const resource = createEphemeralObjectUrl(new Blob(["synthetic"]), {
    createObjectURL: () => "blob:synthetic",
    revokeObjectURL: (url) => revoked.push(url),
  });
  resource.release();
  resource.release();
  assertEquals(revoked, ["blob:synthetic"]);

  for (const result of ["success", "failure", "cancel"]) {
    const bytes = Uint8Array.from([1, 2, 3]);
    await withEphemeralImage(bytes, () =>
      Promise.resolve().then(() => {
        if (result === "failure") throw new Error("synthetic failure");
        if (result === "cancel") throw { name: "AbortError" };
        return result;
      })).catch(() => undefined);
    assertEquals([...bytes], [0, 0, 0]);
  }
});
