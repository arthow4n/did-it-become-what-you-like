import {
  createGeminiAdapter,
  createGoogleGenAiClient,
  createImagePreparationPort,
} from "../../adapters/gemini/index.ts";
import { createLocalStorageSecretStorage } from "../../adapters/gemini/secrets.ts";
import {
  createOpenRouterAdapter,
  type OpenRouterRoutingOptions,
} from "../../adapters/openrouter/index.ts";
import type {
  ImageInput,
  PreparedImage,
  SecretStoragePort,
} from "../../adapters/ports/index.ts";
import type { GeminiThinkingLevel } from "../../domain/index.ts";
import type { ReceiptImageResolver } from "../../actors/receipt.ts";
import { createCachedImagePreparationPort } from "./image.ts";
import { ReceiptImageStore } from "./store.ts";
import type { ReceiptUiDependencies } from "./types.ts";

export function createDefaultReceiptUiDependencies(
  imageStore: ReceiptImageStore,
  getRoutingOptions: () => OpenRouterRoutingOptions = () => ({}),
  getThinkingLevel: () => GeminiThinkingLevel | undefined = () => undefined,
): { dependencies: ReceiptUiDependencies; secretStorage: SecretStoragePort } {
  const secretStorage = createLocalStorageSecretStorage();
  const gemini = createGeminiAdapter({
    secretStorage,
    createClient: createGoogleGenAiClient,
    getThinkingLevel,
  });
  const openrouter = createOpenRouterAdapter({
    secretStorage,
    getRoutingOptions,
  });
  const preparationCache = new WeakMap<ImageInput, PreparedImage>();
  imageStore.setPreparationCache(preparationCache);
  const imagePreparation = createCachedImagePreparationPort(
    createImagePreparationPort(),
    preparationCache,
  );
  const resolveImage: ReceiptImageResolver = (image, signal) =>
    imageStore.resolve(image, signal);
  return {
    secretStorage,
    dependencies: {
      ai: gemini,
      gemini,
      openrouter,
      imagePreparation,
      resolveImage,
      releaseImage: (image) => imageStore.releaseForRetry(image),
    },
  };
}
