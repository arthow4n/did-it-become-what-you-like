import {
  CalendarDateSchema,
  canonicalDecimal,
  CurrencyCodeSchema,
  type Expense,
  StableIdSchema,
  TimeOfDaySchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "../../domain/index.ts";
import { expenseTimeForLocalNow } from "../../domain/queries/calendar.ts";
import { moneyCompare, moneySubtract } from "../../domain/money/index.ts";
import type { ProjectCategoryState } from "../../domain/organization.ts";
import type {
  ManualExpenseDraft,
  ManualExpenseOpenRequest,
  ManualExpenseValidation,
  ManualExpenseValidationErrors,
} from "./types.ts";

export function normalizeManualExpenseDraft(
  draft: ManualExpenseDraft,
): ManualExpenseDraft {
  const amount = draft.amount.trim();
  const merchant = draft.merchant?.trim() || undefined;
  const time = draft.time?.trim() || undefined;
  return {
    ...draft,
    projectId: draft.projectId.trim(),
    categoryId: draft.categoryId.trim(),
    date: draft.date.trim(),
    amount,
    currency: draft.currency.trim().toUpperCase(),
    merchant,
    description: draft.description.trim(),
    time,
  };
}

export function draftForEditing(draft: ManualExpenseDraft): ManualExpenseDraft {
  const normalized = normalizeManualExpenseDraft(draft);
  return {
    ...normalized,
    // Keep editable fields lossless while they are controlled by the form.
    // Their normalized values are still used for validation and commit.
    amount: draft.amount.trim(),
    merchant: draft.merchant,
    description: draft.description,
  };
}

export function canonicalManualExpenseDraft(
  draft: ManualExpenseDraft,
): ManualExpenseDraft {
  const normalized = normalizeManualExpenseDraft(draft);
  try {
    return { ...normalized, amount: canonicalDecimal(normalized.amount) };
  } catch {
    // Keep invalid input visible so the field can explain and correct it.
    return normalized;
  }
}

export function basicValidation(
  draft: ManualExpenseDraft,
): ManualExpenseValidationErrors {
  const normalized = normalizeManualExpenseDraft(draft);
  const errors: ManualExpenseValidationErrors = {};
  if (!normalized.amount) errors.amount = "Amount is required.";
  else {
    try {
      const amount = canonicalDecimal(normalized.amount);
      if (amount.startsWith("-")) {
        errors.amount = "Enter a positive magnitude; choose the direction.";
      } else if (moneyCompare(amount, "0") <= 0) {
        errors.amount = "Amount must be greater than zero.";
      }
    } catch {
      errors.amount = "Enter a decimal amount such as 10.90.";
    }
  }
  if (!CurrencyCodeSchema.safeParse(normalized.currency).success) {
    errors.currency = "Choose a three-letter currency code.";
  }
  if (!StableIdSchema.safeParse(normalized.projectId).success) {
    errors.projectId = "Choose a project.";
  }
  if (!StableIdSchema.safeParse(normalized.categoryId).success) {
    errors.categoryId = "Choose a category.";
  }
  if (!CalendarDateSchema.safeParse(normalized.date).success) {
    errors.date = "Enter a valid calendar date.";
  }
  if (
    normalized.time !== undefined &&
    !TimeOfDaySchema.safeParse(normalized.time).success
  ) {
    errors.time = "Enter a valid local time.";
  }
  if ((normalized.merchant?.length ?? 0) > 500) {
    errors.merchant = "Merchant is too long.";
  }
  if (normalized.description.length > 500) {
    errors.description = "Description is too long.";
  }
  if (
    normalized.direction !== "spent" && normalized.direction !== "money-back"
  ) {
    errors.amount = "Choose Spent or Money back.";
  }
  return errors;
}

export function stateValidation(
  draft: ManualExpenseDraft,
  state: ProjectCategoryState,
): ManualExpenseValidationErrors {
  const errors = basicValidation(draft);
  const project = state.projects.find((candidate) =>
    candidate.id === draft.projectId
  );
  if (!project || project.archived) {
    errors.projectId = "Choose an active project.";
  }
  const category = state.categories.find((candidate) =>
    candidate.id === draft.categoryId
  );
  if (!category) errors.categoryId = "Choose an existing category.";
  return errors;
}

export function validateManualExpenseDraft(
  draft: ManualExpenseDraft,
  state?: ProjectCategoryState,
): ManualExpenseValidation {
  const normalized = normalizeManualExpenseDraft(draft);
  const errors = state === undefined
    ? basicValidation(normalized)
    : stateValidation(normalized, state);
  return {
    valid: Object.keys(errors).length === 0,
    draft: canonicalManualExpenseDraft(normalized),
    errors,
  };
}

export function draftFromExpense(expense: Expense): ManualExpenseDraft {
  const spent = expense.amount.startsWith("-");
  const magnitude = spent ? moneySubtract("0", expense.amount) : expense.amount;
  return {
    projectId: expense.projectId,
    categoryId: expense.categoryId,
    date: expense.date,
    ...(expense.time === undefined ? {} : { time: expense.time }),
    amount: magnitude,
    currency: expense.currency,
    ...(expense.merchant === undefined ? {} : { merchant: expense.merchant }),
    description: expense.description,
    direction: spent ? "spent" : "money-back",
  };
}

export function isDraftModified(
  draft: ManualExpenseDraft | null,
  original: Expense | null,
): boolean {
  if (draft === null) return false;
  if (original === null) {
    return Boolean(
      draft.amount.trim() ||
        draft.merchant?.trim() ||
        draft.description?.trim(),
    );
  }
  const originalDraft = draftFromExpense(original);
  return (
    draft.amount !== originalDraft.amount ||
    draft.merchant !== originalDraft.merchant ||
    draft.description !== originalDraft.description ||
    draft.categoryId !== originalDraft.categoryId ||
    draft.projectId !== originalDraft.projectId ||
    draft.date !== originalDraft.date ||
    draft.time !== originalDraft.time ||
    draft.direction !== originalDraft.direction ||
    draft.currency !== originalDraft.currency
  );
}

export function initialDraftFromRequest(
  request?: ManualExpenseOpenRequest,
): ManualExpenseDraft | null {
  if (!request) return null;
  if (request.expense) {
    return draftFromExpense(request.expense);
  }
  const now = new Date();
  return {
    projectId: request.projectId ?? "",
    categoryId: UNCATEGORIZED_CATEGORY_ID,
    date: now.toISOString().slice(0, 10),
    time: expenseTimeForLocalNow(now),
    amount: "",
    currency: "EUR",
    description: "",
    direction: "spent",
  };
}

export function storageDraft(draft: ManualExpenseDraft): ManualExpenseDraft {
  return {
    projectId: draft.projectId,
    categoryId: draft.categoryId,
    date: draft.date,
    ...(draft.time === undefined ? {} : { time: draft.time }),
    amount: draft.amount,
    currency: draft.currency,
    ...(draft.merchant === undefined ? {} : { merchant: draft.merchant }),
    description: draft.description,
    direction: draft.direction,
  };
}

export function signedAmount(draft: ManualExpenseDraft): string {
  const magnitude = canonicalDecimal(draft.amount);
  return draft.direction === "spent"
    ? moneySubtract("0", magnitude)
    : magnitude;
}
