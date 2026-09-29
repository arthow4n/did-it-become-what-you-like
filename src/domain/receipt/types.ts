import { z } from "zod";
import {
  type CalendarDate,
  CalendarDateSchema,
  type CanonicalDecimal,
  CanonicalDecimalSchema,
  type CurrencyCode,
  CurrencyCodeSchema,
  type Expense,
  OptionalTextSchema,
  type ReceiptAdjustment,
  type ReceiptParent,
  type ReceiptPurchaseLine,
  type StableId,
  StableIdSchema,
  TimeOfDaySchema,
} from "../schema/index.ts";

export type ReceiptDraftLine =
  | {
    readonly type: "purchase";
    readonly id: StableId;
    readonly description: string;
    readonly categoryId: StableId;
    readonly quantity?: CanonicalDecimal;
    readonly unitPrice?: CanonicalDecimal;
    readonly lineTotal: CanonicalDecimal;
    readonly selected: boolean;
    readonly uncertain: boolean;
    readonly selectionReason?: string;
    readonly classificationReason?: string;
  }
  | {
    readonly type: "adjustment";
    readonly id: StableId;
    readonly description: string;
    readonly categoryId: StableId;
    readonly amount: CanonicalDecimal;
    readonly lineId?: StableId;
    readonly selected: boolean;
    readonly uncertain: boolean;
    readonly selectionReason?: string;
    readonly classificationReason?: string;
  };

export type ReceiptDraftLineCandidate =
  | Omit<Extract<ReceiptDraftLine, { readonly type: "purchase" }>, "id">
  | Omit<Extract<ReceiptDraftLine, { readonly type: "adjustment" }>, "id">;

export type ReceiptReviewDraft = {
  readonly parent: Omit<ReceiptParent, "id" | "schemaVersion" | "type">;
  readonly lines: readonly ReceiptDraftLine[];
  readonly uncertainty: readonly string[];
  readonly printedTotalMismatch: boolean;
  readonly mismatchDifference?: CanonicalDecimal;
  readonly mismatchExplanation?: string;
};

export type ReceiptExtractionDraftLike = {
  readonly merchant?: unknown;
  readonly currency?: unknown;
  readonly date?: unknown;
  readonly time?: unknown;
  readonly printedTotal?: unknown;
  readonly lines?: unknown;
  readonly uncertainty?: unknown;
  readonly mismatches?: unknown;
};

export type ReceiptReviewInput = {
  readonly projectId: StableId;
  readonly currency: CurrencyCode;
  readonly categoryCatalogue: readonly {
    readonly id: StableId;
    readonly name: string;
    readonly description?: string;
  }[];
  readonly nextId: () => StableId;
  readonly scanMode?: "receipt" | "menu";
  readonly today?: CalendarDate;
};

export type ReceiptCommitResult = {
  readonly receipt: ReceiptParent;
  readonly purchaseLines: readonly ReceiptPurchaseLine[];
  readonly adjustments: readonly ReceiptAdjustment[];
};

export type ReceiptCommitRequest = {
  readonly review: ReceiptReviewDraft;
  readonly confirmMismatch: boolean;
};

export type ReceiptIdGenerator = (kind: "receipt" | "line") => StableId;

export type ReceiptServiceOptions = {
  readonly nextId?: ReceiptIdGenerator;
  readonly now?: () => string;
  readonly deviceId?: StableId;
};

export type ReceiptErrorCode =
  | "invalid"
  | "mismatch"
  | "not-found"
  | "conflict"
  | "corrupt-data";

export type ReceiptAggregate = {
  readonly receipt: ReceiptParent;
  readonly purchaseLines: readonly ReceiptPurchaseLine[];
  readonly adjustments: readonly ReceiptAdjustment[];
  readonly derivedExpenses: readonly Expense[];
};

export type ReceiptMetadataChanges = {
  readonly merchant?: string | null;
  readonly date?: CalendarDate;
  readonly time?: string | null;
  readonly printedTotal?: string;
};

export type ReceiptPurchaseLineChanges = {
  readonly type: "purchase";
  readonly description: string;
  readonly categoryId: StableId;
  readonly quantity?: string | null;
  readonly unitPrice?: string | null;
  readonly lineTotal: string;
};

export type ReceiptAdjustmentChanges = {
  readonly type: "adjustment";
  readonly description: string;
  readonly categoryId: StableId;
  readonly amount: string;
  readonly lineId?: StableId | null;
};

export type ReceiptLineChanges =
  | ReceiptPurchaseLineChanges
  | ReceiptAdjustmentChanges;

export type ReceiptMutationResult = {
  readonly aggregate?: ReceiptAggregate;
  readonly deletedReceipt: boolean;
  readonly deletedLineId?: StableId;
};

const RECEIPT_ERROR_MESSAGES: Readonly<Record<ReceiptErrorCode, string>> = {
  invalid: "The receipt review is invalid.",
  mismatch: "Confirm the printed-total mismatch before saving.",
  "not-found": "The receipt project or category is no longer available.",
  conflict: "A receipt record with the same identity already exists.",
  "corrupt-data": "Stored receipt data is invalid or corrupt.",
};

export class ReceiptDomainError extends Error {
  override readonly name = "ReceiptDomainError";
  readonly retryable = false;

  constructor(
    readonly code: ReceiptErrorCode,
    message?: string,
  ) {
    super(message ?? RECEIPT_ERROR_MESSAGES[code]);
  }
}

export function isReceiptDomainError(
  error: unknown,
): error is ReceiptDomainError {
  return error instanceof ReceiptDomainError;
}

const DraftParentSchema = z.strictObject({
  projectId: StableIdSchema,
  date: CalendarDateSchema,
  time: TimeOfDaySchema.optional(),
  merchant: OptionalTextSchema,
  currency: CurrencyCodeSchema,
  printedTotal: CanonicalDecimalSchema,
});

const DraftPurchaseLineSchema = z.strictObject({
  type: z.literal("purchase"),
  id: StableIdSchema,
  description: z.string().max(500),
  categoryId: StableIdSchema,
  quantity: CanonicalDecimalSchema.optional(),
  unitPrice: CanonicalDecimalSchema.optional(),
  lineTotal: CanonicalDecimalSchema,
  selected: z.boolean(),
  uncertain: z.boolean(),
  selectionReason: z.string().trim().min(1).max(1_000).optional(),
  classificationReason: z.string().trim().min(1).max(500).optional(),
});

const DraftAdjustmentLineSchema = z.strictObject({
  type: z.literal("adjustment"),
  id: StableIdSchema,
  description: z.string().max(500),
  categoryId: StableIdSchema,
  amount: CanonicalDecimalSchema,
  lineId: StableIdSchema.optional(),
  selected: z.boolean(),
  uncertain: z.boolean(),
  selectionReason: z.string().trim().min(1).max(1_000).optional(),
  classificationReason: z.string().trim().min(1).max(500).optional(),
});

export const ReceiptReviewDraftSchema = z.strictObject({
  parent: DraftParentSchema,
  lines: z.array(z.discriminatedUnion("type", [
    DraftPurchaseLineSchema,
    DraftAdjustmentLineSchema,
  ])),
  uncertainty: z.array(z.string().trim().min(1).max(1_000)),
  printedTotalMismatch: z.boolean(),
  mismatchDifference: CanonicalDecimalSchema.optional(),
  mismatchExplanation: z.string().trim().min(1).max(1_000).optional(),
});

export type DurableReceiptReviewSnapshot = {
  readonly version: 1;
  readonly kind: "receipt-review";
  readonly revision: number;
  readonly review: ReceiptReviewDraft;
};

export const DurableReceiptReviewSnapshotSchema = z.strictObject({
  version: z.literal(1),
  kind: z.literal("receipt-review"),
  revision: z.number().int().nonnegative(),
  review: ReceiptReviewDraftSchema,
});
