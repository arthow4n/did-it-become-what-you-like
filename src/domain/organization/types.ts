import {
  type Category,
  type Expense,
  type Project,
  type ReceiptAdjustment,
  type ReceiptParent,
  type ReceiptPurchaseLine,
  type StableId,
  type Tombstone,
  UNCATEGORIZED_CATEGORY_ID,
} from "../schema/index.ts";

/**
 * The local transaction surface needed by organization operations.  It is
 * deliberately narrower than an adapter so the domain does not depend on a
 * browser or IndexedDB implementation.  LocalPort is structurally compatible
 * with this port.
 */
export type OrganizationJsonPrimitive = string | number | boolean | null;
export type OrganizationJsonValue =
  | OrganizationJsonPrimitive
  | { readonly [key: string]: OrganizationJsonValue }
  | OrganizationJsonValue[];

export type OrganizationCollection = "records" | "settings";
export type OrganizationTransactionMode = "readonly" | "readwrite";

export type OrganizationEntry = {
  readonly key: string;
  readonly value: OrganizationJsonValue;
};

export interface OrganizationTransaction {
  get(
    collection: OrganizationCollection,
    key: string,
  ): Promise<OrganizationJsonValue | undefined>;
  put(
    collection: OrganizationCollection,
    key: string,
    value: OrganizationJsonValue,
  ): Promise<void>;
  delete(collection: OrganizationCollection, key: string): Promise<void>;
  query(
    collection: OrganizationCollection,
  ): Promise<readonly OrganizationEntry[]>;
}

export interface OrganizationStore {
  transaction<T>(
    mode: OrganizationTransactionMode,
    work: (transaction: OrganizationTransaction) => Promise<T>,
  ): Promise<T>;
}

export const PROJECT_ORGANIZATION_SETTINGS_KEY =
  "project-category-organization" as const;

export type ProjectOrganizationSettings = {
  readonly orderedProjectIds: readonly StableId[];
  readonly lastSelectedProjectId?: StableId;
};

export const DEFAULT_UNCATEGORIZED: Category = {
  schemaVersion: 1,
  type: "category",
  id: UNCATEGORIZED_CATEGORY_ID,
  name: "Uncategorized",
  sortOrder: 0,
  archived: false,
  system: true,
};

export type ProjectOrganizationCommand =
  | { readonly type: "create"; readonly project: Project }
  | {
    readonly type: "rename";
    readonly projectId: StableId;
    readonly name: string;
  }
  | { readonly type: "select"; readonly projectId: StableId }
  | { readonly type: "archive"; readonly projectId: StableId }
  | { readonly type: "restore"; readonly projectId: StableId }
  | { readonly type: "reorder"; readonly orderedIds: readonly StableId[] }
  | { readonly type: "delete-empty"; readonly projectId: StableId };

export type ProjectCurrencyCommand = {
  readonly type: "set-default-currency";
  readonly projectId: StableId;
  readonly currency: Project["defaultCurrency"];
};

export type CategoryOrganizationCommand =
  | { readonly type: "create"; readonly category: Category }
  | {
    readonly type: "rename";
    readonly categoryId: StableId;
    readonly name: string;
    /** Omit to preserve the current color; pass undefined to clear it. */
    readonly color?: string;
    /** Omit to preserve the current description; pass undefined to clear it. */
    readonly description?: string;
  }
  | { readonly type: "archive"; readonly categoryId: StableId }
  | { readonly type: "restore"; readonly categoryId: StableId }
  | { readonly type: "reorder"; readonly orderedIds: readonly StableId[] }
  | {
    readonly type: "delete-and-reassign";
    readonly categoryId: StableId;
    readonly replacementCategoryId: StableId;
  };

export type ProjectCategoryState = {
  readonly projects: readonly Project[];
  readonly categories: readonly Category[];
  readonly expenses: readonly Expense[];
  readonly receipts: readonly ReceiptParent[];
  readonly receiptPurchaseLines: readonly ReceiptPurchaseLine[];
  readonly receiptAdjustments: readonly ReceiptAdjustment[];
  readonly tombstones: readonly Tombstone[];
  readonly projectOrder: readonly StableId[];
  readonly lastSelectedProjectId?: StableId;
  readonly selectedProjectId?: StableId;
  readonly firstProjectId?: StableId;
  readonly defaultProjectId?: StableId;
};

export type OrganizationCommitOutput = {
  readonly projects: readonly Project[];
  readonly categories: readonly Category[];
  readonly selectedProjectId?: StableId;
  readonly state: ProjectCategoryState;
};

export type OrganizationErrorCode =
  | "invalid"
  | "not-found"
  | "conflict"
  | "protected"
  | "current-project"
  | "last-active-project"
  | "not-empty"
  | "requires-confirmation"
  | "invalid-order"
  | "corrupt-data";

const ORGANIZATION_ERROR_MESSAGES: Readonly<
  Record<OrganizationErrorCode, string>
> = {
  invalid: "The organization change is invalid.",
  "not-found": "The requested project or category was not found.",
  conflict: "The project or category identity is already in use.",
  protected: "Uncategorized is protected and cannot be changed that way.",
  "current-project":
    "Switch to another project before archiving the current project.",
  "last-active-project": "At least one active project must remain.",
  "not-empty": "The project still contains records and cannot be deleted here.",
  "requires-confirmation":
    "Confirm the empty-project deletion before continuing.",
  "invalid-order":
    "The custom order must contain every active item exactly once.",
  "corrupt-data": "Stored organization data is invalid or corrupt.",
};

export class OrganizationError extends Error {
  override readonly name = "OrganizationError";
  readonly code: OrganizationErrorCode;
  readonly retryable = false;

  constructor(code: OrganizationErrorCode, message?: string) {
    super(message ?? ORGANIZATION_ERROR_MESSAGES[code]);
    this.code = code;
  }
}

export function isOrganizationError(
  error: unknown,
): error is OrganizationError {
  return error instanceof OrganizationError;
}

export function asOrganizationJsonValue(value: unknown): OrganizationJsonValue {
  return value as OrganizationJsonValue;
}
