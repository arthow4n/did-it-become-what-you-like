import { OpenRouter } from "@openrouter/sdk";
import type {
  ChatMessages,
  ChatRequest,
  ChatResult,
  PublicEndpoint,
} from "@openrouter/sdk/models";
import type {
  GetModelsRequest,
  GetModelsResponse,
  ListEndpointsRequest,
  ListEndpointsResponse,
  ListEndpointsZdrResponse,
  SendChatCompletionRequestRequest,
} from "@openrouter/sdk/models/operations";
import type { RequestOptions } from "@openrouter/sdk/lib/sdks.js";

import type { OperationOptions } from "../ports/common.ts";

/** The exact metadata needed by the receipt model prefilter. */
export type OpenRouterModel = {
  readonly id: string;
  readonly canonicalSlug: string;
  readonly name: string;
  readonly architecture: {
    readonly inputModalities: readonly string[];
    readonly outputModalities: readonly string[];
  };
  readonly supportedParameters: readonly string[];
};

export type OpenRouterModelPage = {
  readonly models: readonly OpenRouterModel[];
};

/** Endpoint metadata exposed to the provider-neutral settings composition. */
export type OpenRouterEndpoint = {
  readonly modelId: string;
  readonly providerName: string;
  readonly tag: string;
  readonly supportedParameters: readonly string[];
};

export type OpenRouterEndpointPage = {
  readonly modelId: string;
  readonly endpoints: readonly OpenRouterEndpoint[];
};

export type OpenRouterModelListRequest = {
  readonly supportedParameters: "structured_outputs,response_format";
  readonly inputModalities: "image,text";
  readonly outputModalities: "text";
  readonly zdr?: "true";
};

export type OpenRouterMessage = {
  readonly role: "user";
  readonly content: readonly [
    OpenRouterTextContent,
    OpenRouterImageContent,
  ];
};

export type OpenRouterTextContent = {
  readonly type: "text";
  readonly text: string;
};

export type OpenRouterImageContent = {
  readonly type: "image_url";
  readonly imageUrl: {
    readonly url: string;
  };
};

export type OpenRouterJsonSchemaResponseFormat = {
  readonly type: "json_schema";
  readonly jsonSchema: {
    readonly name: string;
    readonly strict: true;
    readonly schema: Readonly<Record<string, unknown>>;
  };
};

export type OpenRouterProviderPreferences = {
  readonly requireParameters: true;
  readonly order?: readonly string[];
  readonly zdr?: true;
  readonly dataCollection?: "deny";
};

export type OpenRouterChatRequest = {
  readonly model: string;
  readonly messages: readonly [OpenRouterMessage];
  readonly responseFormat: OpenRouterJsonSchemaResponseFormat;
  readonly provider: OpenRouterProviderPreferences;
};

export type OpenRouterChatResponse = {
  /** Kept unknown until the adapter's shared parser validates provider output. */
  readonly text: unknown;
};

export interface OpenRouterBrowserClient {
  readonly models: {
    list(
      request: OpenRouterModelListRequest,
      options?: OperationOptions,
    ): Promise<AsyncIterable<OpenRouterModelPage>>;
  };
  readonly endpoints: {
    list(
      request: { readonly author: string; readonly slug: string },
      options?: OperationOptions,
    ): Promise<OpenRouterEndpointPage>;
    listZdrEndpoints(
      options?: OperationOptions,
    ): Promise<readonly OpenRouterEndpoint[]>;
  };
  readonly chat: {
    send(
      request: OpenRouterChatRequest,
      options?: OperationOptions,
    ): Promise<OpenRouterChatResponse>;
  };
}

/** The SDK surface required by the client translation, suitable for fakes. */
export type OpenRouterSdk = {
  readonly models: {
    list(
      request: GetModelsRequest,
      options?: RequestOptions,
    ): Promise<AsyncIterable<GetModelsResponse>>;
  };
  readonly endpoints: {
    list(
      request: ListEndpointsRequest,
      options?: RequestOptions,
    ): Promise<ListEndpointsResponse>;
    listZdrEndpoints(
      request?: undefined,
      options?: RequestOptions,
    ): Promise<ListEndpointsZdrResponse>;
  };
  readonly chat: {
    send(
      request: SendChatCompletionRequestRequest & {
        readonly chatRequest: ChatRequest & { readonly stream?: false };
      },
      options?: RequestOptions,
    ): Promise<ChatResult>;
  };
};

export type OpenRouterSdkFactory = (apiKey: string) => OpenRouterSdk;

function requestOptions(options: OperationOptions | undefined): RequestOptions {
  return {
    retries: { strategy: "none" },
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
  };
}

function modelFromSdk(model: OpenRouterModel): OpenRouterModel {
  return {
    id: model.id,
    canonicalSlug: model.canonicalSlug,
    name: model.name,
    architecture: {
      inputModalities: [...model.architecture.inputModalities],
      outputModalities: [...model.architecture.outputModalities],
    },
    supportedParameters: [...model.supportedParameters],
  };
}

function endpointFromSdk(endpoint: PublicEndpoint): OpenRouterEndpoint {
  return {
    modelId: endpoint.modelId,
    providerName: endpoint.providerName,
    tag: endpoint.tag,
    supportedParameters: [...endpoint.supportedParameters],
  };
}

function sdkMessages(messages: readonly [OpenRouterMessage]): ChatMessages[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content.map((part) =>
      part.type === "text" ? { type: "text", text: part.text } : {
        type: "image_url",
        imageUrl: { url: part.imageUrl.url },
      }
    ),
  }));
}

function sdkChatRequest(
  request: OpenRouterChatRequest,
): SendChatCompletionRequestRequest & {
  readonly chatRequest: ChatRequest & { readonly stream?: false };
} {
  return {
    chatRequest: {
      model: request.model,
      messages: sdkMessages(request.messages),
      responseFormat: {
        type: request.responseFormat.type,
        jsonSchema: {
          name: request.responseFormat.jsonSchema.name,
          strict: request.responseFormat.jsonSchema.strict,
          schema: { ...request.responseFormat.jsonSchema.schema },
        },
      },
      provider: {
        requireParameters: request.provider.requireParameters,
        ...(request.provider.order === undefined
          ? {}
          : { order: [...request.provider.order] }),
        ...(request.provider.zdr === undefined
          ? {}
          : { zdr: request.provider.zdr }),
        ...(request.provider.dataCollection === undefined
          ? {}
          : { dataCollection: request.provider.dataCollection }),
      },
      stream: false,
    },
  };
}

function toChatResponse(response: ChatResult): OpenRouterChatResponse {
  return { text: response.choices[0]?.message.content };
}

/**
 * Keep OpenRouter construction, generated types, and wire translation behind a
 * provider-neutral browser client used by the adapter.
 */
export function createOpenRouterClient(
  apiKey: string,
  createSdk: OpenRouterSdkFactory = (key) =>
    new OpenRouter({ apiKey: key }) as OpenRouterSdk,
): OpenRouterBrowserClient {
  const sdk = createSdk(apiKey);
  return {
    models: {
      list: async (request, options) => {
        const pages = await sdk.models.list(
          { ...request },
          requestOptions(options),
        );
        return (async function* (): AsyncIterable<OpenRouterModelPage> {
          for await (const page of pages) {
            yield { models: page.result.data.map(modelFromSdk) };
          }
        })();
      },
    },
    endpoints: {
      list: async (request, options) => {
        const response = await sdk.endpoints.list(
          { author: request.author, slug: request.slug },
          requestOptions(options),
        );
        return {
          modelId: response.data.id,
          endpoints: response.data.endpoints.map(endpointFromSdk),
        };
      },
      listZdrEndpoints: async (options) => {
        const response = await sdk.endpoints.listZdrEndpoints(
          undefined,
          requestOptions(options),
        );
        return response.data.map(endpointFromSdk);
      },
    },
    chat: {
      send: async (request, options) =>
        toChatResponse(
          await sdk.chat.send(sdkChatRequest(request), requestOptions(options)),
        ),
    },
  };
}
