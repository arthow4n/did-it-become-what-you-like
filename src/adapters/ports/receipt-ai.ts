import type {
  CalendarDate,
  CurrencyCode,
  StableId,
} from "../../domain/index.ts";
import type { OperationOptions } from "./common.ts";
import type { PreparedImage } from "./image.ts";

export type ReceiptAiCapability =
  | "image-input"
  | "content-generation"
  | "structured-output";

export type ReceiptAiModelLifecycle = "active" | "deprecated" | "unavailable";

export type ReceiptAiModel = {
  readonly id: string;
  readonly displayName: string;
  readonly lifecycle: ReceiptAiModelLifecycle;
  readonly capabilities: Readonly<Record<ReceiptAiCapability, boolean>>;
};

export type ReceiptAiConfigurationResult =
  | { readonly status: "compatible"; readonly model: ReceiptAiModel }
  | {
    readonly status: "needs-test" | "incompatible";
    readonly model?: ReceiptAiModel;
    readonly missingCapabilities: readonly ReceiptAiCapability[];
  };

export type ReceiptAiModelQuery = {
  readonly requiredCapabilities: readonly ReceiptAiCapability[];
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
  /** Canonical decimal transcription with the sign shown on the receipt. */
  readonly printedTotal?: string;
  readonly lines: readonly {
    readonly description: string;
    /** Canonical decimal transcription with the sign shown on the receipt. */
    readonly amount: string;
    readonly categoryId: StableId;
    readonly kind: "purchase" | "adjustment";
    /** Economic direction used by the domain to apply the ledger sign. */
    readonly direction: "outflow" | "inflow";
    readonly selected: boolean;
    /** Brief evidence for the category and direction classification. */
    readonly rationale: string;
    readonly uncertainty?: string;
  }[];
  readonly uncertainty: readonly string[];
  readonly mismatches: readonly string[];
};

/** Provider-neutral receipt inference boundary implemented at the app edge. */
export interface ReceiptAiPort {
  listModels(
    query: ReceiptAiModelQuery,
    options?: OperationOptions,
  ): Promise<readonly ReceiptAiModel[]>;
  testConfiguration(
    modelId: string,
    query: ReceiptAiModelQuery,
    options?: OperationOptions,
  ): Promise<ReceiptAiConfigurationResult>;
  extractReceipt(
    request: ReceiptExtractionRequest,
    options?: OperationOptions,
  ): Promise<ReceiptExtractionDraft>;
}
