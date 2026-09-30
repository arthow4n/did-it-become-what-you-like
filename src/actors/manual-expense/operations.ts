import {
  adapterError,
  type ClockPort,
  type IdPort,
  type JsonValue,
  type LocalPort,
} from "../../adapters/ports/index.ts";
import {
  type Expense,
  ExpenseSchema,
  PortableSettingsSchema,
  StableIdSchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "../../domain/index.ts";
import {
  expenseDateForLocalNow,
  expenseTimeForLocalNow,
} from "../../domain/queries/calendar.ts";
import type { ProjectCategoryState } from "../../domain/organization.ts";
import type { ExpenseCommitOutput } from "../contracts/index.ts";
import type {
  ClearDraftInput,
  CommitManualExpenseInput,
  DeleteManualExpenseInput,
  HydratedManualExpense,
  HydrateDraftInput,
  ManualExpenseDependencies,
  ManualExpenseDraft,
  ManualExpenseOpenRequest,
  PersistDraftInput,
  PersistedManualExpense,
  RestoreManualExpenseInput,
} from "./types.ts";
import { DEFAULT_EXPENSE_DAY_BOUNDARY } from "./types.ts";
import {
  draftForEditing,
  draftFromExpense,
  signedAmount,
  storageDraft,
  validateManualExpenseDraft,
} from "./draft.ts";

export function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

export function defaultClock(): Pick<ClockPort, "now"> {
  return { now: () => new Date().toISOString() };
}

export function defaultIds(): Pick<IdPort, "next"> {
  let sequence = 0;
  return {
    next: (kind) => {
      sequence += 1;
      const random = globalThis.crypto?.randomUUID?.() ?? String(sequence);
      return StableIdSchema.parse(`${kind}-${random}`);
    },
  };
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function expenseFromValue(value: unknown): Expense | null {
  const parsed = ExpenseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function expenseDayBoundary(local: LocalPort): Promise<string> {
  const value = await local.transaction(
    "readonly",
    (transaction) => transaction.get<JsonValue>("records", "settings-portable"),
  );
  if (value === undefined) return DEFAULT_EXPENSE_DAY_BOUNDARY;
  const parsed = PortableSettingsSchema.safeParse(value);
  if (!parsed.success) {
    throw adapterError("corrupt-data", "manual-expense.settings");
  }
  return parsed.data.expenseDayBoundary;
}

export function currentProject(
  state: ProjectCategoryState,
  requested?: string,
) {
  const projectId = requested ?? state.selectedProjectId ??
    state.firstProjectId;
  const project = state.projects.find((candidate) =>
    candidate.id === projectId
  );
  if (!project || project.archived) {
    throw adapterError("invalid-request", "manual-expense.open");
  }
  return project;
}

export async function openExpense(
  dependencies: ManualExpenseDependencies,
  request: ManualExpenseOpenRequest,
): Promise<{
  readonly draft: ManualExpenseDraft;
  readonly originalExpense: Expense | null;
}> {
  const state = await dependencies.organization.getState();
  if (request.expense !== undefined) {
    const expense = ExpenseSchema.parse(request.expense);
    return {
      draft: draftFromExpense(expense),
      originalExpense: expense,
    };
  }
  const project = currentProject(state, request.projectId);
  const boundary = dependencies.expenseDayBoundary ??
    await expenseDayBoundary(dependencies.local);
  const clock = dependencies.clock ?? defaultClock();
  const now = new Date(clock.now());
  const date = expenseDateForLocalNow(
    now,
    boundary,
  );
  const time = expenseTimeForLocalNow(now);
  return {
    draft: {
      projectId: project.id,
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      date,
      time,
      amount: "",
      currency: project.defaultCurrency,
      description: "",
      direction: "spent",
    },
    originalExpense: null,
  };
}

export async function hydrateExpense(
  dependencies: ManualExpenseDependencies,
  input: HydrateDraftInput,
): Promise<HydratedManualExpense | null> {
  const stored = await dependencies.local.transaction(
    "readonly",
    async (tx) => {
      const snapshot = await tx.get<JsonValue>("workflow-snapshots", input.key);
      if (snapshot === undefined) return null;
      if (!isObject(snapshot) || snapshot.kind !== "manual-expense-draft") {
        throw adapterError("corrupt-data", "manual-expense.hydrate");
      }
      const draft = snapshot.draft;
      if (!isObject(draft)) {
        throw adapterError(
          "corrupt-data",
          "manual-expense.hydrate",
        );
      }
      const candidate = draft as unknown as ManualExpenseDraft;
      const validation = validateManualExpenseDraft(candidate);
      if (
        !isObject(snapshot) || snapshot.version !== 1 ||
        typeof snapshot.revision !== "number" ||
        !Number.isInteger(snapshot.revision) ||
        !validation.draft.projectId || !validation.draft.categoryId
      ) {
        throw adapterError("corrupt-data", "manual-expense.hydrate");
      }
      const originalExpenseId = typeof snapshot.originalExpenseId === "string"
        ? snapshot.originalExpenseId
        : undefined;
      const originalValue = originalExpenseId === undefined
        ? undefined
        : await tx.get<JsonValue>("records", originalExpenseId);
      const originalExpense = originalValue === undefined
        ? null
        : expenseFromValue(originalValue);
      if (originalExpenseId !== undefined && originalExpense === null) {
        throw adapterError("corrupt-data", "manual-expense.hydrate");
      }
      return {
        revision: snapshot.revision,
        // Keep text fields exactly as entered while the form is editable. The
        // other draft values retain their existing normalization behavior.
        draft: draftForEditing(candidate),
        originalExpense,
      } satisfies HydratedManualExpense;
    },
  );
  return stored;
}

export async function persistDraft(
  local: LocalPort,
  input: PersistDraftInput,
): Promise<void> {
  const value: PersistedManualExpense = {
    version: 1,
    kind: "manual-expense-draft",
    revision: input.revision,
    draft: storageDraft(input.draft),
    ...(input.originalExpenseId === undefined
      ? {}
      : { originalExpenseId: input.originalExpenseId }),
  };
  await local.transaction(
    "readwrite",
    (tx) => tx.put("workflow-snapshots", input.key, asJsonValue(value)),
  );
}

export async function commitExpense(
  dependencies: ManualExpenseDependencies,
  input: CommitManualExpenseInput,
): Promise<ExpenseCommitOutput> {
  const state = await dependencies.organization.getState();
  const validation = validateManualExpenseDraft(input.draft, state);
  if (!validation.valid) {
    throw adapterError("invalid-request", "manual-expense.commit");
  }
  const draft = validation.draft;
  const ids = dependencies.ids ?? defaultIds();
  let committed: Expense | null = null;
  await dependencies.local.transaction("readwrite", async (tx) => {
    const existingValue = input.originalExpenseId === undefined
      ? undefined
      : await tx.get<JsonValue>("records", input.originalExpenseId);
    const existing = existingValue === undefined
      ? null
      : expenseFromValue(existingValue);
    if (input.originalExpenseId !== undefined && existing === null) {
      throw adapterError("not-found", "manual-expense.commit");
    }
    const id = existing?.id ?? ids.next("expense");
    const expense = ExpenseSchema.parse({
      schemaVersion: 1,
      type: "expense",
      id,
      projectId: draft.projectId,
      categoryId: draft.categoryId,
      date: draft.date,
      ...(draft.time === undefined ? {} : { time: draft.time }),
      amount: signedAmount(draft),
      currency: draft.currency,
      ...(draft.merchant === undefined ? {} : { merchant: draft.merchant }),
      description: draft.description,
      source: "manual",
    });
    await tx.put("records", expense.id, asJsonValue(expense));
    await tx.delete("workflow-snapshots", input.key);
    committed = expense;
  });
  if (committed === null) {
    throw adapterError("unknown", "manual-expense.commit");
  }
  return {
    expense: committed,
    operation: input.originalExpenseId === undefined ? "created" : "updated",
  };
}

export async function clearDraft(
  local: LocalPort,
  input: ClearDraftInput,
): Promise<void> {
  await local.transaction(
    "readwrite",
    (tx) => tx.delete("workflow-snapshots", input.key),
  );
}

export async function deleteExpense(
  local: LocalPort,
  input: DeleteManualExpenseInput,
): Promise<void> {
  await local.transaction("readwrite", async (tx) => {
    const existing = await tx.get<JsonValue>("records", input.expense.id);
    if (expenseFromValue(existing) === null) {
      throw adapterError("not-found", "manual-expense.delete");
    }
    await tx.delete("records", input.expense.id);
    await tx.delete("workflow-snapshots", input.key);
  });
}

export async function restoreExpense(
  local: LocalPort,
  input: RestoreManualExpenseInput,
): Promise<void> {
  await local.transaction("readwrite", async (tx) => {
    await tx.put("records", input.expense.id, asJsonValue(input.expense));
    await tx.delete("workflow-snapshots", input.key);
  });
}
