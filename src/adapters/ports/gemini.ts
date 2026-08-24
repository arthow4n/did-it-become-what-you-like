import type {
  CalendarDate,
  CurrencyCode,
  StableId,
} from "../../domain/index.ts";
import type { OperationOptions } from "./common.ts";
import type { PreparedImage } from "./image.ts";

export type GeminiCapability =
  | "image-input"
  | "content-generation"
  | "structured-output";

export type GeminiModelLifecycle = "active" | "deprecated" | "unavailable";

export type GeminiModel = {
  readonly id: string;
  readonly displayName: string;
  readonly lifecycle: GeminiModelLifecycle;
  readonly capabilities: Readonly<Record<GeminiCapability, boolean>>;
};

export type GeminiConfigurationResult =
  | { readonly status: "compatible"; readonly model: GeminiModel }
  | {
    readonly status: "needs-test" | "incompatible";
    readonly model?: GeminiModel;
    readonly missingCapabilities: readonly GeminiCapability[];
  };

export type GeminiModelQuery = {
  readonly requiredCapabilities: readonly GeminiCapability[];
};

export type ReceiptExtractionRequest = {
  readonly modelId: string;
  readonly image: PreparedImage;
  readonly schemaVersion: number;
  readonly instructionVersion: string;
  readonly categories: readonly { id: StableId; name: string }[];
  readonly locale: string;
  readonly currency: CurrencyCode;
};

export type ReceiptExtractionDraft = {
  readonly merchant?: string;
  readonly currency: CurrencyCode;
  readonly date: CalendarDate;
  readonly printedTotal?: string;
  readonly lines: readonly {
    readonly description: string;
    readonly amount: string;
    readonly categoryId: StableId;
    readonly kind: "purchase" | "adjustment";
    readonly selected: boolean;
    readonly uncertainty?: string;
  }[];
  readonly uncertainty: readonly string[];
  readonly mismatches: readonly string[];
};

export interface GeminiModelAndExtractionPort {
  listModels(
    query: GeminiModelQuery,
    options?: OperationOptions,
  ): Promise<readonly GeminiModel[]>;
  testConfiguration(
    modelId: string,
    query: GeminiModelQuery,
    options?: OperationOptions,
  ): Promise<GeminiConfigurationResult>;
  extractReceipt(
    request: ReceiptExtractionRequest,
    options?: OperationOptions,
  ): Promise<ReceiptExtractionDraft>;
}
