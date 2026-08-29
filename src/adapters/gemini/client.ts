import { GoogleGenAI } from "@google/genai";

import type {
  GeminiBrowserClient,
  GeminiGenerateRequest,
  GeminiListRequest,
  GeminiRawModel,
} from "./adapter.ts";

export type GoogleGenAiSdk = {
  readonly models: {
    list(parameters: {
      readonly config: {
        readonly pageSize?: number;
        readonly abortSignal?: AbortSignal;
      };
    }): Promise<AsyncIterable<GeminiRawModel>>;
    generateContent(parameters: {
      readonly model: string;
      readonly contents: readonly unknown[];
      readonly config: {
        readonly responseMimeType: "application/json";
        readonly responseJsonSchema: unknown;
        readonly systemInstruction: string;
        readonly abortSignal?: AbortSignal;
      };
    }): Promise<{ readonly text?: string }>;
  };
};

export type GoogleGenAiSdkFactory = (apiKey: string) => GoogleGenAiSdk;

/** Keep all official Google SDK types and construction at the provider edge. */
export function createGoogleGenAiClient(
  apiKey: string,
  createSdk: GoogleGenAiSdkFactory = (key) =>
    new GoogleGenAI({ apiKey: key }) as GoogleGenAiSdk,
): GeminiBrowserClient {
  const google = createSdk(apiKey);
  return {
    models: {
      list: async (request?: GeminiListRequest) => {
        const pager = await google.models.list({
          config: {
            ...(request?.pageSize === undefined
              ? {}
              : { pageSize: request.pageSize }),
            ...(request?.signal === undefined
              ? {}
              : { abortSignal: request.signal }),
          },
        });
        return pager as AsyncIterable<GeminiRawModel>;
      },
      generateContent: async (
        request: GeminiGenerateRequest,
        options,
      ) => {
        const response = await google.models.generateContent({
          model: request.model,
          contents: [...request.contents],
          config: {
            responseMimeType: request.config.responseMimeType,
            responseJsonSchema: request.config.responseJsonSchema,
            systemInstruction: request.config.systemInstruction,
            ...(options?.signal === undefined
              ? {}
              : { abortSignal: options.signal }),
          },
        });
        return { text: response.text };
      },
    },
  };
}
