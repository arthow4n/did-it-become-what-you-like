import {
  createOpenRouterClient,
  type OpenRouterChatRequest,
  type OpenRouterSdk,
} from "./client.ts";

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

const model = {
  id: "google/gemini-2.5-flash",
  canonicalSlug: "google/gemini-2.5-flash",
  name: "Gemini 2.5 Flash",
  architecture: {
    inputModalities: ["text", "image"],
    outputModalities: ["text"],
    instructType: null,
    modality: "text+image->text",
    tokenizer: null,
  },
  supportedParameters: ["response_format", "structured_outputs"],
};

const endpoint = {
  contextLength: 100,
  latencyLast30m: null,
  maxCompletionTokens: 100,
  maxPromptTokens: 100,
  modelId: model.id,
  modelName: model.name,
  name: "Synthetic endpoint",
  pricing: { completion: "0", prompt: "0" },
  providerName: "Synthetic Provider",
  quantization: null,
  supportedParameters: ["response_format", "structured_outputs"],
  supportsImplicitCaching: false,
  supportsToolChoice: {},
  supportsVoiceCloning: false,
  tag: "synthetic-provider",
  throughputLast30m: null,
  uptimeLast1d: 100,
  uptimeLast30m: 100,
  uptimeLast5m: 100,
};

const output = JSON.stringify({
  currency: "SEK",
  date: "2026-08-31",
  lines: [],
  merchant: "Synthetic shop",
  mismatch: null,
  printedTotal: "0",
  schemaVersion: "receipt.v2",
  uncertainty: [],
});

function chatRequest(): OpenRouterChatRequest {
  return {
    model: model.id,
    messages: [{
      role: "user",
      content: [{ type: "text", text: "shared prompt" }, {
        type: "image_url",
        imageUrl: { url: "data:image/jpeg;base64,AQID" },
      }],
    }],
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "receipt-extraction",
        strict: true,
        schema: { type: "object", additionalProperties: false },
      },
    },
    provider: {
      requireParameters: true,
      order: ["synthetic-provider"],
      zdr: true,
      dataCollection: "deny",
    },
  };
}

Deno.test("OpenRouter client constructs the pinned SDK with only the API key", () => {
  let constructedKey = "";
  const sdk = {} as OpenRouterSdk;
  const client = createOpenRouterClient("sk-or-v1.synthetic", (key) => {
    constructedKey = key;
    return sdk;
  });
  assert(client.models !== undefined);
  assertEquals(constructedKey, "sk-or-v1.synthetic");
});

Deno.test("OpenRouter client translates model, endpoint, ZDR, and chat wire types", async () => {
  let modelRequest: unknown;
  let endpointRequest: unknown;
  let zdrRequest: unknown;
  let chatWireRequest: unknown;
  let chatOptions: unknown;
  const sdk = {
    models: {
      list: (request: unknown) => {
        modelRequest = request;
        return Promise.resolve((async function* () {
          yield {
            result: {
              data: [model],
              links: { next: null },
              totalCount: 1,
            },
          };
        })());
      },
    },
    endpoints: {
      list: (request: unknown) => {
        endpointRequest = request;
        return Promise.resolve({ data: { ...model, endpoints: [endpoint] } });
      },
      listZdrEndpoints: (request: unknown) => {
        zdrRequest = request;
        return Promise.resolve({ data: [endpoint] });
      },
    },
    chat: {
      send: (request: unknown, options: unknown) => {
        chatWireRequest = request;
        chatOptions = options;
        return Promise.resolve({
          choices: [{ message: { content: output, role: "assistant" } }],
        });
      },
    },
  } as unknown as OpenRouterSdk;

  const client = createOpenRouterClient("sk-or-v1.synthetic", () => sdk);
  const pages = await client.models.list({
    supportedParameters: "structured_outputs,response_format",
    inputModalities: "image,text",
    outputModalities: "text",
    zdr: "true",
  });
  const listedModels = [];
  for await (const page of pages) listedModels.push(...page.models);
  assertEquals(listedModels[0]?.id, model.id);
  assertEquals(modelRequest, {
    supportedParameters: "structured_outputs,response_format",
    inputModalities: "image,text",
    outputModalities: "text",
    zdr: "true",
  });

  assertEquals(
    await client.endpoints.list({ author: "google", slug: "gemini-2.5-flash" }),
    {
      modelId: model.id,
      endpoints: [{
        modelId: endpoint.modelId,
        providerName: endpoint.providerName,
        tag: endpoint.tag,
        supportedParameters: endpoint.supportedParameters,
      }],
    },
  );
  assertEquals(endpointRequest, {
    author: "google",
    slug: "gemini-2.5-flash",
  });
  assertEquals(await client.endpoints.listZdrEndpoints(), [{
    modelId: endpoint.modelId,
    providerName: endpoint.providerName,
    tag: endpoint.tag,
    supportedParameters: endpoint.supportedParameters,
  }]);
  assertEquals(zdrRequest, undefined);

  const controller = new AbortController();
  await client.chat.send(chatRequest(), { signal: controller.signal });
  assert(chatWireRequest !== null && typeof chatWireRequest === "object");
  const wire = chatWireRequest as {
    readonly chatRequest: {
      readonly model: string;
      readonly models?: readonly string[];
      readonly stream: boolean;
      readonly messages: readonly { readonly content: readonly unknown[] }[];
      readonly responseFormat: unknown;
      readonly provider: unknown;
    };
  };
  assertEquals(wire.chatRequest.model, model.id);
  assertEquals(wire.chatRequest.models, undefined);
  assertEquals(wire.chatRequest.stream, false);
  assertEquals(wire.chatRequest.messages[0]?.content, [{
    type: "text",
    text: "shared prompt",
  }, {
    type: "image_url",
    imageUrl: { url: "data:image/jpeg;base64,AQID" },
  }]);
  assertEquals(wire.chatRequest.responseFormat, {
    type: "json_schema",
    jsonSchema: {
      name: "receipt-extraction",
      strict: true,
      schema: { type: "object", additionalProperties: false },
    },
  });
  assertEquals(wire.chatRequest.provider, {
    requireParameters: true,
    order: ["synthetic-provider"],
    zdr: true,
    dataCollection: "deny",
  });
  assert(chatOptions !== null && typeof chatOptions === "object");
  const options = chatOptions as {
    readonly signal: AbortSignal;
    readonly retries: { readonly strategy: string };
  };
  assertEquals(options.signal, controller.signal);
  assertEquals(options.retries, { strategy: "none" });
});
