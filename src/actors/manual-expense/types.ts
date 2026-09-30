import type {
  ClockPort,
  IdPort,
  LocalPort,
} from "../../adapters/ports/index.ts";
import type { Expense } from "../../domain/index.ts";
import type {
  OrganizationCommitOutput,
  ProjectCategoryService,
} from "../../domain/organization.ts";
import type {
  ContractFailure,
  ExpenseCommitOutput,
  ShellRoute,
} from "../contracts/index.ts";

export type ExpenseDirection = "spent" | "money-back";

export type ManualExpenseDraft = {
  readonly projectId: string;
  readonly categoryId: string;
  readonly date: string;
  readonly time?: string;
  /** The form always contains a positive magnitude; direction owns the sign. */
  readonly amount: string;
  readonly currency: string;
  readonly merchant?: string;
  readonly description: string;
  readonly direction: ExpenseDirection;
};

export type ManualExpenseField =
  | "amount"
  | "currency"
  | "categoryId"
  | "date"
  | "projectId"
  | "time"
  | "merchant"
  | "description";

export type ManualExpenseValidationErrors = Partial<
  Record<ManualExpenseField, string>
>;

export type ManualExpenseValidation = {
  readonly valid: boolean;
  readonly draft: ManualExpenseDraft;
  readonly errors: ManualExpenseValidationErrors;
};

export type ManualExpenseOpenRequest = {
  readonly expense?: Expense;
  readonly projectId?: string;
};

export type ManualExpenseEvent =
  | { readonly type: "expense.hydrate" }
  | {
    readonly type: "expense.open";
    readonly request?: ManualExpenseOpenRequest;
  }
  | { readonly type: "expense.change"; readonly draft: ManualExpenseDraft }
  | { readonly type: "expense.submit" }
  | { readonly type: "expense.submit-and-add-another" }
  | { readonly type: "expense.finish-save" }
  | { readonly type: "expense.retry" }
  | { readonly type: "expense.retry-draft" }
  | { readonly type: "expense.back" }
  | { readonly type: "expense.cancel" }
  | { readonly type: "expense.discard" }
  | { readonly type: "expense.keep-editing" }
  | { readonly type: "expense.confirm-discard" }
  | { readonly type: "expense.retry-discard" }
  | { readonly type: "expense.delete" }
  | { readonly type: "expense.confirm-delete" }
  | { readonly type: "expense.cancel-delete" }
  | { readonly type: "expense.retry-delete" }
  | { readonly type: "expense.undo" }
  | { readonly type: "expense.retry-undo" }
  | { readonly type: "expense.undo-saved" }
  | { readonly type: "expense.finish-delete" };

export type ManualExpenseOutput =
  | { readonly status: "saved"; readonly result: ExpenseCommitOutput }
  | { readonly status: "discarded" }
  | { readonly status: "cancelled" }
  | { readonly status: "deleted"; readonly expense: Expense }
  | { readonly status: "undone"; readonly expense: Expense }
  | { readonly status: "saved-undone"; readonly expense: Expense };

export type ManualExpenseContext = {
  readonly persistenceKey: string;
  readonly draft: ManualExpenseDraft | null;
  readonly originalExpense: Expense | null;
  readonly openRequest: ManualExpenseOpenRequest | null;
  readonly validation: ManualExpenseValidationErrors;
  readonly persistenceRevision: number;
  readonly result: ExpenseCommitOutput | null;
  readonly deletedExpense: Expense | null;
  readonly error: ContractFailure | null;
};

export type ManualExpenseMachineInput = {
  readonly persistenceKey?: string;
  readonly request?: ManualExpenseOpenRequest;
};

export type ManualExpenseDependencies = {
  readonly local: LocalPort;
  readonly organization: ProjectCategoryService;
  readonly clock?: Pick<ClockPort, "now">;
  readonly ids?: Pick<IdPort, "next">;
  readonly expenseDayBoundary?: string;
};

export type PersistedManualExpense = {
  readonly version: 1;
  readonly kind: "manual-expense-draft";
  readonly revision: number;
  readonly draft: ManualExpenseDraft;
  readonly originalExpenseId?: string;
};

export type HydratedManualExpense = {
  readonly revision: number;
  readonly draft: ManualExpenseDraft;
  readonly originalExpense: Expense | null;
};

export type PersistDraftInput = {
  readonly key: string;
  readonly revision: number;
  readonly draft: ManualExpenseDraft;
  readonly originalExpenseId?: string;
};

export type HydrateDraftInput = { readonly key: string };
export type ClearDraftInput = { readonly key: string };
export type CommitManualExpenseInput = {
  readonly key: string;
  readonly draft: ManualExpenseDraft;
  readonly originalExpenseId?: string;
};
export type DeleteManualExpenseInput = {
  readonly key: string;
  readonly expense: Expense;
};
export type RestoreManualExpenseInput = {
  readonly key: string;
  readonly expense: Expense;
};

export const DEFAULT_EXPENSE_DAY_BOUNDARY = "03:00";
export const DEFAULT_PERSISTENCE_KEY = "workflow:manual-expense";

export type ManualExpenseCommitForShell = OrganizationCommitOutput;
export type ManualExpenseRoute = ShellRoute;
