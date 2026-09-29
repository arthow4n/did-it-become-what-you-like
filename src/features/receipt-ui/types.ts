import type { OpenRouterEndpoint } from "../../adapters/openrouter/index.ts";
import type {
  ReceiptAiModel,
  ReceiptAiModelQuery,
  ReceiptAiPort,
} from "../../adapters/ports/index.ts";
import { REQUIRED_RECEIPT_AI_CAPABILITIES } from "../../adapters/gemini/index.ts";
import type { ReceiptScanMachineDependencies } from "../../actors/receipt.ts";
import {
  type Category,
  type DeviceLocalSettings,
  StableIdSchema,
} from "../../domain/index.ts";
import type { ReceiptDraftLine } from "../../domain/receipt.ts";

export const DEFAULT_MODEL_QUERY: ReceiptAiModelQuery = {
  requiredCapabilities: REQUIRED_RECEIPT_AI_CAPABILITIES,
};

export type ReceiptProviderPort = ReceiptAiPort & {
  getApiKey(options?: { signal?: AbortSignal }): Promise<
    | {
      reveal(): string;
    }
    | undefined
  >;
  setApiKey(value: string, options?: { signal?: AbortSignal }): Promise<void>;
  removeApiKey(options?: { signal?: AbortSignal }): Promise<void>;
};

export type ReceiptOpenRouterPort = ReceiptProviderPort & {
  listEndpoints(
    modelId: string,
    options?: { signal?: AbortSignal },
  ): Promise<readonly OpenRouterEndpoint[]>;
};

export type ReceiptProvider = "gemini" | "openrouter";

export type ReceiptReviewMode = "scanned" | "manual" | "menu";

export const RECEIPT_PROVIDER_NAMES: Record<ReceiptProvider, string> = {
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

export function receiptDisclosureName(provider: ReceiptProvider): string {
  return provider === "gemini" ? "Google Gemini" : "OpenRouter";
}

export function receiptDisclosureDetails(provider: ReceiptProvider): string {
  return provider === "openrouter"
    ? "For OpenRouter, this allowlisted receipt payload passes through OpenRouter to a routed provider endpoint serving the exact selected model. The receipt image is not publicly uploaded."
    : "Google Gemini receives this allowlisted receipt payload for this explicit scan. The receipt image is not publicly uploaded.";
}

export type ReceiptUiDependencies = ReceiptScanMachineDependencies & {
  readonly ai: ReceiptAiPort;
  readonly gemini: ReceiptProviderPort;
  readonly openrouter: ReceiptOpenRouterPort;
};

export function providerPort(
  dependencies: ReceiptUiDependencies,
  provider: ReceiptProvider,
): ReceiptProviderPort {
  return provider === "gemini" ? dependencies.gemini : dependencies.openrouter;
}

export function selectedModelFor(
  settings: DeviceLocalSettings,
  provider: ReceiptProvider,
): string | undefined {
  return provider === "gemini"
    ? settings.selectedGeminiModel
    : settings.selectedOpenRouterModel;
}

export function settingsWithSelectedModel(
  settings: DeviceLocalSettings,
  provider: ReceiptProvider,
  model: string | undefined,
): DeviceLocalSettings {
  return provider === "gemini"
    ? { ...settings, selectedGeminiModel: model }
    : { ...settings, selectedOpenRouterModel: model };
}

export function modelOptions(
  models: readonly ReceiptAiModel[],
): Array<{
  id: string;
  label: string;
  disabled?: boolean;
  reason?: string;
}> {
  return models.map((model) => {
    return {
      id: model.id,
      label: model.displayName,
      disabled: model.lifecycle !== "active",
      ...(model.lifecycle !== "active"
        ? {
          reason: model.lifecycle,
        }
        : {}),
    };
  });
}

export function preferredDefaultModel(
  models: readonly ReceiptAiModel[],
  provider: ReceiptProvider,
): string | undefined {
  const activeModels = models.filter((model) => model.lifecycle === "active");
  if (activeModels.length === 0) return undefined;
  if (provider === "gemini") {
    const flashLite = activeModels.find((m) =>
      m.id.toLowerCase().includes("flash-lite")
    );
    if (flashLite) return flashLite.id;
    const flash = activeModels.find((m) =>
      m.id.toLowerCase().includes("flash")
    );
    if (flash) return flash.id;
  }
  return activeModels[0]?.id;
}

export function categoryOptions(categories: readonly Category[]) {
  return categories.filter((category) => !category.archived).map((
    category,
  ) => ({
    id: category.id,
    label: category.name,
  }));
}

export function makeLineId(): string {
  return StableIdSchema.parse(
    `receipt-line-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
  );
}

export function lineViewModel(
  line: ReceiptDraftLine,
  categories: readonly Category[],
) {
  const category = categories.find((candidate) =>
    candidate.id === line.categoryId
  );
  return {
    id: line.id,
    type: line.type,
    description: line.description,
    category: category?.name ?? "Uncategorized",
    amount: line.type === "purchase" ? line.lineTotal : line.amount,
    selected: line.selected,
    uncertain: line.uncertain,
    selectionReason: line.selectionReason,
    classificationReason: line.classificationReason,
    ...(line.type === "purchase"
      ? { quantity: line.quantity, unitPrice: line.unitPrice }
      : {}),
  };
}
