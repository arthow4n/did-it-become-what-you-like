import type {
  CalendarDate,
  CanonicalDecimal,
  Category,
  CurrencyCode,
  Expense,
  PortableDataset,
  Project,
  ReceiptAdjustment,
  ReceiptParent,
  ReceiptPurchaseLine,
  StableId,
} from "../../domain/index.ts";
import type { PortErrorCode } from "./ports.ts";

export type ShellRoute =
  | "first-use"
  | "expenses"
  | "add"
  | "expense-form"
  | "receipt-scan"
  | "receipt-review"
  | "organize"
  | "projects"
  | "categories"
  | "settings"
  | "sync"
  | "conflicts"
  | "import-export"
  | "privacy"
  | "about";

export type WorkflowKind =
  | "expense-form"
  | "receipt-scan"
  | "receipt-review"
  | "project-category"
  | "sync"
  | "conflict"
  | "import"
  | "project-deletion"
  | "delete-everywhere"
  | "update-install";

export type ContractFailure = {
  readonly code: PortErrorCode;
  readonly message: string;
  readonly retryable: boolean;
};

const PORT_ERROR_MESSAGES: Readonly<Record<PortErrorCode, string>> = {
  aborted: "The operation was cancelled.",
  offline: "This operation is unavailable offline.",
  unauthorized: "Authorization is required for this operation.",
  forbidden: "The authorized account cannot perform this operation.",
  "not-found": "The requested resource was not found.",
  conflict: "The resource changed concurrently.",
  quota: "Storage or service quota was exceeded.",
  "corrupt-data": "Stored data is invalid or corrupt.",
  "partial-transport": "The transport completed only part of the operation.",
  "rate-limited": "The service requested that the operation be retried later.",
  "invalid-request": "The request was invalid.",
  invalid: "The supplied data is invalid.",
  unsupported: "The requested operation is unsupported.",
  unavailable: "The service is temporarily unavailable.",
  retired: "This dataset has been retired.",
  unknown: "The operation failed for an unknown reason.",
};

const RETRYABLE_PORT_ERRORS = new Set<PortErrorCode>([
  "offline",
  "quota",
  "partial-transport",
  "rate-limited",
  "unavailable",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPortErrorCode(value: unknown): value is PortErrorCode {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PORT_ERROR_MESSAGES, value);
}

/**
 * Preserve the typed failure code and retryability without copying arbitrary
 * SDK or service text into durable actor context. Messages are always selected
 * from the local allowlist; untyped errors use the operation-specific fallback
 * supplied by the owning actor.
 */
export function contractFailureFromError(
  error: unknown,
  fallback: ContractFailure,
): ContractFailure {
  if (!isRecord(error) || !isPortErrorCode(error.code)) return fallback;

  const message = PORT_ERROR_MESSAGES[error.code];
  const retryable = typeof error.retryable === "boolean"
    ? error.retryable
    : error.retry === "backoff" || error.retry === "when-online" ||
      error.retry === "immediate" || RETRYABLE_PORT_ERRORS.has(error.code);

  return { code: error.code, message, retryable };
}

export type ExpenseDraft = {
  readonly projectId: StableId;
  readonly categoryId: StableId;
  readonly date: CalendarDate;
  readonly time?: string;
  readonly amount: string;
  readonly currency: CurrencyCode;
  readonly merchant?: string;
  readonly description: string;
};

export type ExpenseCommitInput = {
  readonly originalExpenseId?: StableId;
  readonly draft: ExpenseDraft;
};

export type ExpenseCommitOutput = {
  readonly expense: Expense;
  readonly operation: "created" | "updated";
};

export type ReceiptImageRef = {
  /** An opaque in-memory handle. It must never enter a persisted snapshot. */
  readonly ephemeralId: string;
  readonly mediaType: string;
  readonly byteLength: number;
};

export type ReceiptScanInput = {
  readonly image: ReceiptImageRef;
  readonly projectId: StableId;
  readonly currency: CurrencyCode;
  readonly locale: string;
  readonly categoryCatalogue: readonly Pick<Category, "id" | "name">[];
  readonly model: string;
  readonly prepareImage: boolean;
};

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
  };

export type ReceiptReviewDraft = {
  readonly parent: Omit<ReceiptParent, "id" | "schemaVersion" | "type">;
  readonly lines: readonly ReceiptDraftLine[];
  readonly uncertainty: readonly string[];
  readonly printedTotalMismatch: boolean;
};

export type ReceiptScanOutput = {
  readonly review: ReceiptReviewDraft;
};

export type ReceiptCommitInput = {
  readonly review: ReceiptReviewDraft;
  readonly confirmMismatch: boolean;
};

export type ReceiptCommitOutput = {
  readonly receipt: ReceiptParent;
  readonly purchaseLines: readonly ReceiptPurchaseLine[];
  readonly adjustments: readonly ReceiptAdjustment[];
};

export type ProjectCommand =
  | { readonly type: "create"; readonly project: Project }
  | {
    readonly type: "rename";
    readonly projectId: StableId;
    readonly name: string;
  }
  | { readonly type: "select"; readonly projectId: StableId }
  | { readonly type: "archive"; readonly projectId: StableId }
  | { readonly type: "restore"; readonly projectId: StableId }
  | { readonly type: "delete-empty"; readonly projectId: StableId };

export type CategoryCommand =
  | { readonly type: "create"; readonly category: Category }
  | {
    readonly type: "rename";
    readonly categoryId: StableId;
    readonly name: string;
  }
  | { readonly type: "archive"; readonly categoryId: StableId }
  | { readonly type: "restore"; readonly categoryId: StableId }
  | { readonly type: "reorder"; readonly orderedIds: readonly StableId[] }
  | {
    readonly type: "delete-and-reassign";
    readonly categoryId: StableId;
    readonly replacementCategoryId: StableId;
  };

export type ProjectCategoryCommitOutput = {
  readonly projects: readonly Project[];
  readonly categories: readonly Category[];
  readonly selectedProjectId?: StableId;
};

export type SyncRequest = {
  readonly reason: "launch" | "local-change" | "reconnect" | "manual";
};

export type SyncPortOutput = {
  readonly lastSyncedAt: string;
  readonly unresolvedConflictCount: number;
  readonly pendingChangeCount: number;
};

export type ConflictCandidate = {
  readonly revisionId: StableId;
  readonly deviceLabel: string;
  readonly recordedAt: string;
  readonly value: string | null;
};

export type ConflictGroup = {
  readonly id: StableId;
  readonly recordType:
    | "expense"
    | "receipt"
    | "receipt-line"
    | "category"
    | "project";
  readonly recordId: StableId;
  readonly field: string;
  readonly candidates: readonly ConflictCandidate[];
  readonly deleteVersusEdit: boolean;
};

export type ConflictResolution = {
  readonly conflictId: StableId;
  readonly choice: "candidate" | "custom" | "keep-edited" | "delete";
  readonly revisionId?: StableId;
  readonly value?: string | null;
};

export type ConflictCommitOutput = {
  readonly conflictId: StableId;
  readonly resolutionRevisionId: StableId;
};

export type ImportPreview = {
  readonly dataset: PortableDataset;
  readonly schemaVersion: number;
  readonly projectCount: number;
  readonly categoryCount: number;
  readonly expenseCount: number;
  readonly receiptCount: number;
  readonly migrationRequired: boolean;
};

export type ImportCommitInput = {
  readonly preview: ImportPreview;
  readonly mode: "merge" | "replace";
};

export type ImportCommitOutput = {
  readonly mode: "merge" | "replace";
  readonly generation?: number;
  readonly conflictCount: number;
};

export type ProjectDeletionTarget = {
  readonly projectId: StableId;
  readonly projectName: string;
  readonly expenseCount: number;
  readonly receiptCount: number;
};

export type ProjectDeletionOutput = {
  readonly projectId: StableId;
  readonly tombstoneCount: number;
};

export type DeleteEverywhereProgress = {
  readonly knownDeviceCount: number;
  readonly acknowledgedDeviceCount: number;
  readonly forcedDeviceCount: number;
};

export type DeleteEverywhereOutput = {
  readonly generation: number;
  readonly forcedDeviceCount: number;
};

export type UpdateCheckOutput =
  | { readonly status: "up-to-date" }
  | { readonly status: "update-ready"; readonly version: string };
