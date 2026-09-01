import { assign, fromPromise, setup } from "xstate";
import {
  adapterError,
  type ClockPort,
  type IdPort,
  type JsonValue,
  type LocalPort,
} from "../adapters/ports/index.ts";
import {
  CalendarDateSchema,
  canonicalDecimal,
  CurrencyCodeSchema,
  type Expense,
  ExpenseSchema,
  PortableSettingsSchema,
  StableIdSchema,
  TimeOfDaySchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "../domain/index.ts";
import { expenseDateForLocalNow } from "../domain/queries/calendar.ts";
import { moneyCompare, moneySubtract } from "../domain/money/index.ts";
import type {
  OrganizationCommitOutput,
  ProjectCategoryService,
  ProjectCategoryState,
} from "../domain/organization.ts";
import { unwiredPort } from "./contracts/ports.ts";
import {
  type ContractFailure,
  contractFailureFromError,
  type ExpenseCommitOutput,
  type ShellRoute,
} from "./contracts/index.ts";

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
  | { readonly type: "expense.merchant.choose"; readonly merchant: string }
  | { readonly type: "expense.merchant.clear" }
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
  readonly suggestions: readonly string[];
  readonly validation: ManualExpenseValidationErrors;
  readonly persistenceRevision: number;
  readonly result: ExpenseCommitOutput | null;
  readonly deletedExpense: Expense | null;
  readonly error: ContractFailure | null;
};

export type ManualExpenseMachineInput = {
  readonly persistenceKey?: string;
};

export type ManualExpenseDependencies = {
  readonly local: LocalPort;
  readonly organization: ProjectCategoryService;
  readonly clock?: Pick<ClockPort, "now">;
  readonly ids?: Pick<IdPort, "next">;
};

type PersistedManualExpense = {
  readonly version: 1;
  readonly kind: "manual-expense-draft";
  readonly revision: number;
  readonly draft: ManualExpenseDraft;
  readonly originalExpenseId?: string;
};

type HydratedManualExpense = {
  readonly revision: number;
  readonly draft: ManualExpenseDraft;
  readonly originalExpense: Expense | null;
  readonly suggestions: readonly string[];
};

type PersistDraftInput = {
  readonly key: string;
  readonly revision: number;
  readonly draft: ManualExpenseDraft;
  readonly originalExpenseId?: string;
};

type HydrateDraftInput = { readonly key: string };
type ClearDraftInput = { readonly key: string };
type CommitManualExpenseInput = {
  readonly key: string;
  readonly draft: ManualExpenseDraft;
  readonly originalExpenseId?: string;
};
type DeleteManualExpenseInput = {
  readonly key: string;
  readonly expense: Expense;
};
type RestoreManualExpenseInput = {
  readonly key: string;
  readonly expense: Expense;
};

const DEFAULT_EXPENSE_DAY_BOUNDARY = "03:00";
const DEFAULT_PERSISTENCE_KEY = "workflow:manual-expense";

function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

function defaultClock(): Pick<ClockPort, "now"> {
  return { now: () => new Date().toISOString() };
}

function defaultIds(): Pick<IdPort, "next"> {
  let sequence = 0;
  return {
    next: (kind) => {
      sequence += 1;
      const random = globalThis.crypto?.randomUUID?.() ?? String(sequence);
      return StableIdSchema.parse(`${kind}-${random}`);
    },
  };
}

function normalizeManualExpenseDraft(
  draft: ManualExpenseDraft,
): ManualExpenseDraft {
  let amount = draft.amount.trim();
  try {
    amount = canonicalDecimal(amount);
  } catch {
    // Keep invalid input visible so the field can explain and correct it.
  }
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

function basicValidation(
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

function stateValidation(
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
  return { valid: Object.keys(errors).length === 0, draft: normalized, errors };
}

function draftFromExpense(expense: Expense): ManualExpenseDraft {
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

function storageDraft(draft: ManualExpenseDraft): ManualExpenseDraft {
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expenseFromValue(value: unknown): Expense | null {
  const parsed = ExpenseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function merchantSuggestionsFromValues(
  values: readonly { readonly value: JsonValue }[],
  projectId: string,
): readonly string[] {
  const expenses = values
    .map((entry) => expenseFromValue(entry.value))
    .filter((expense): expense is Expense =>
      expense !== null && expense.projectId === projectId &&
      expense.merchant !== undefined
    )
    .sort((left, right) =>
      `${right.date}T${right.time ?? ""}-${right.id}`.localeCompare(
        `${left.date}T${left.time ?? ""}-${left.id}`,
        "en",
      )
    );
  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const expense of expenses) {
    const merchant = expense.merchant!;
    const key = merchant.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(merchant);
    if (suggestions.length >= 8) break;
  }
  return suggestions;
}

async function expenseDayBoundary(local: LocalPort): Promise<string> {
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

function currentProject(state: ProjectCategoryState, requested?: string) {
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

async function suggestionsFor(
  local: LocalPort,
  projectId: string,
): Promise<readonly string[]> {
  const entries = await local.query<JsonValue>("records");
  return merchantSuggestionsFromValues(entries, projectId);
}

async function openExpense(
  dependencies: ManualExpenseDependencies,
  request: ManualExpenseOpenRequest,
): Promise<{
  readonly draft: ManualExpenseDraft;
  readonly originalExpense: Expense | null;
  readonly suggestions: readonly string[];
}> {
  const state = await dependencies.organization.getState();
  if (request.expense !== undefined) {
    const expense = ExpenseSchema.parse(request.expense);
    return {
      draft: draftFromExpense(expense),
      originalExpense: expense,
      suggestions: await suggestionsFor(dependencies.local, expense.projectId),
    };
  }
  const project = currentProject(state, request.projectId);
  const boundary = await expenseDayBoundary(dependencies.local);
  const clock = dependencies.clock ?? defaultClock();
  const date = expenseDateForLocalNow(
    new Date(clock.now()),
    boundary,
  );
  return {
    draft: {
      projectId: project.id,
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      date,
      amount: "",
      currency: project.defaultCurrency,
      description: "",
      direction: "spent",
    },
    originalExpense: null,
    suggestions: await suggestionsFor(dependencies.local, project.id),
  };
}

async function hydrateExpense(
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
      const values = await tx.query<JsonValue>("records");
      return {
        revision: snapshot.revision,
        // Keep the draft exactly as entered while the form is editable. The
        // normalized value is used for validation and commit, not for
        // re-rendering a controlled input after every keystroke.
        draft: storageDraft(candidate),
        originalExpense,
        suggestions: merchantSuggestionsFromValues(
          values,
          validation.draft.projectId,
        ),
      } satisfies HydratedManualExpense;
    },
  );
  return stored;
}

async function persistDraft(
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

function signedAmount(draft: ManualExpenseDraft): string {
  const magnitude = canonicalDecimal(draft.amount);
  return draft.direction === "spent"
    ? moneySubtract("0", magnitude)
    : magnitude;
}

async function commitExpense(
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

async function clearDraft(
  local: LocalPort,
  input: ClearDraftInput,
): Promise<void> {
  await local.transaction(
    "readwrite",
    (tx) => tx.delete("workflow-snapshots", input.key),
  );
}

async function deleteExpense(
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

async function restoreExpense(
  local: LocalPort,
  input: RestoreManualExpenseInput,
): Promise<void> {
  await local.transaction("readwrite", async (tx) => {
    await tx.put("records", input.expense.id, asJsonValue(input.expense));
    await tx.delete("workflow-snapshots", input.key);
  });
}

const manualExpenseSetup = setup({
  types: {
    context: {} as ManualExpenseContext,
    events: {} as ManualExpenseEvent,
    output: {} as ManualExpenseOutput,
    input: {} as ManualExpenseMachineInput | undefined,
  },
  actors: {
    hydrateDraft: unwiredPort<HydrateDraftInput, HydratedManualExpense | null>(
      "manual expense draft hydration",
    ),
    openExpense: unwiredPort<
      ManualExpenseOpenRequest,
      {
        readonly draft: ManualExpenseDraft;
        readonly originalExpense: Expense | null;
        readonly suggestions: readonly string[];
      }
    >("manual expense open"),
    persistDraft: unwiredPort<PersistDraftInput, void>(
      "manual expense draft persistence",
    ),
    commitExpense: unwiredPort<CommitManualExpenseInput, ExpenseCommitOutput>(
      "local manual expense commit",
    ),
    clearDraft: unwiredPort<ClearDraftInput, void>(
      "manual expense draft deletion",
    ),
    deleteExpense: unwiredPort<DeleteManualExpenseInput, void>(
      "local manual expense deletion",
    ),
    restoreExpense: unwiredPort<RestoreManualExpenseInput, void>(
      "local manual expense undo",
    ),
  },
  actions: {
    persistDraftChange: assign({
      draft: ({ context, event }) =>
        event.type === "expense.change" ? event.draft : context.draft,
      validation: () => ({}),
      error: () => null,
      persistenceRevision: ({ context }) => context.persistenceRevision + 1,
    }),
  },
  guards: {
    hasValidDraft: ({ context }) =>
      context.draft !== null && validateManualExpenseDraft(context.draft).valid,
    hasDraft: ({ context }) => context.draft !== null,
    canDelete: ({ context }) => context.originalExpense !== null,
    hasSavedResult: ({ context }) => context.result !== null,
    hasOpenRequest: ({ context }) => context.openRequest !== null,
    hasHydratedDraft: ({ event }) => "output" in event && event.output !== null,
  },
});

export const manualExpenseMachine = manualExpenseSetup.createMachine({
  id: "manual-expense",
  initial: "idle",
  context: ({ input }) => ({
    persistenceKey: input?.persistenceKey ?? DEFAULT_PERSISTENCE_KEY,
    draft: null,
    originalExpense: null,
    openRequest: null,
    suggestions: [],
    validation: {},
    persistenceRevision: 0,
    result: null,
    deletedExpense: null,
    error: null,
  }),
  states: {
    idle: {
      on: {
        "expense.hydrate": "hydrating",
        "expense.open": {
          target: "opening",
          actions: assign({
            openRequest: ({ event }) => event.request ?? {},
            error: () => null,
          }),
        },
        "expense.cancel": "cancelled",
      },
    },
    hydrating: {
      tags: ["loading"],
      invoke: {
        src: "hydrateDraft",
        input: ({ context }) => ({ key: context.persistenceKey }),
        onDone: [
          {
            target: "editing",
            guard: "hasHydratedDraft",
            actions: assign({
              draft: ({ event }) => event.output!.draft,
              originalExpense: ({ event }) => event.output!.originalExpense,
              suggestions: ({ event }) => event.output!.suggestions,
              persistenceRevision: ({ event }) => event.output!.revision,
              validation: () => ({}),
              error: () => null,
            }),
          },
          { target: "opening", guard: "hasOpenRequest" },
          { target: "idle", actions: assign({ error: () => null }) },
        ],
        onError: {
          target: "hydrateFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Unable to restore the expense draft.",
                retryable: true,
              }),
          }),
        },
      },
      on: {
        "expense.open": {
          actions: assign({
            openRequest: ({ event }) => event.request ?? {},
          }),
        },
      },
    },
    hydrateFailed: {
      tags: ["error"],
      on: {
        "expense.retry": "hydrating",
        "expense.retry-draft": "hydrating",
        "expense.cancel": "cancelled",
      },
    },
    opening: {
      tags: ["loading"],
      invoke: {
        src: "openExpense",
        input: ({ context }) => context.openRequest ?? {},
        onDone: {
          target: "persistingDraft",
          actions: assign({
            draft: ({ event }) => event.output.draft,
            originalExpense: ({ event }) => event.output.originalExpense,
            suggestions: ({ event }) => event.output.suggestions,
            persistenceRevision: () => 1,
            validation: () => ({}),
            error: () => null,
          }),
        },
        onError: {
          target: "openFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "invalid-request",
                message: "The expense form could not be opened.",
                retryable: false,
              }),
          }),
        },
      },
      on: { "expense.cancel": "cancelled" },
    },
    openFailed: {
      tags: ["error"],
      on: {
        "expense.retry": "opening",
        "expense.retry-draft": "opening",
        "expense.cancel": "cancelled",
      },
    },
    editing: {
      tags: ["dirty"],
      on: {
        "expense.change": {
          target: "persistingDraft",
          actions: "persistDraftChange",
        },
        "expense.merchant.choose": {
          target: "persistingDraft",
          actions: assign({
            draft: ({ context, event }) => ({
              ...context.draft!,
              merchant: event.merchant.trim() || undefined,
            }),
            validation: () => ({}),
            error: () => null,
            persistenceRevision: ({ context }) =>
              context.persistenceRevision + 1,
          }),
        },
        "expense.merchant.clear": {
          target: "persistingDraft",
          actions: assign({
            draft: ({ context }) => ({
              ...context.draft!,
              merchant: undefined,
            }),
            validation: () => ({}),
            error: () => null,
            persistenceRevision: ({ context }) =>
              context.persistenceRevision + 1,
          }),
        },
        "expense.submit": [
          { target: "saving", guard: "hasValidDraft" },
          {
            actions: assign({
              validation: ({ context }) =>
                context.draft === null
                  ? { amount: "Amount is required." }
                  : validateManualExpenseDraft(context.draft).errors,
            }),
          },
        ],
        "expense.submit-and-add-another": [
          { target: "savingForAnother", guard: "hasValidDraft" },
          {
            actions: assign({
              validation: ({ context }) =>
                context.draft === null
                  ? { amount: "Amount is required." }
                  : validateManualExpenseDraft(context.draft).errors,
            }),
          },
        ],
        "expense.delete": {
          target: "deleteConfirming",
          guard: "canDelete",
        },
        "expense.back": "discardConfirming",
        "expense.cancel": "discardConfirming",
        "expense.discard": "discardConfirming",
      },
    },
    persistingDraft: {
      tags: ["dirty", "draft-saving"],
      invoke: {
        src: "persistDraft",
        input: ({ context }) => ({
          key: context.persistenceKey,
          revision: context.persistenceRevision,
          draft: context.draft!,
          ...(context.originalExpense === null
            ? {}
            : { originalExpenseId: context.originalExpense.id }),
        }),
        onDone: { target: "editing", actions: assign({ error: () => null }) },
        onError: {
          target: "draftSaveFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "The expense draft could not be saved.",
                retryable: true,
              }),
          }),
        },
      },
      on: {
        "expense.change": {
          target: "persistingDraft",
          actions: "persistDraftChange",
          reenter: true,
        },
        "expense.merchant.choose": {
          target: "persistingDraft",
          reenter: true,
          actions: assign({
            draft: ({ context, event }) => ({
              ...context.draft!,
              merchant: event.merchant.trim() || undefined,
            }),
            persistenceRevision: ({ context }) =>
              context.persistenceRevision + 1,
          }),
        },
        "expense.merchant.clear": {
          target: "persistingDraft",
          reenter: true,
          actions: assign({
            draft: ({ context }) => ({
              ...context.draft!,
              merchant: undefined,
            }),
            persistenceRevision: ({ context }) =>
              context.persistenceRevision + 1,
          }),
        },
        "expense.submit": [
          { target: "saving", guard: "hasValidDraft" },
          {
            actions: assign({
              validation: ({ context }) =>
                context.draft === null
                  ? { amount: "Amount is required." }
                  : validateManualExpenseDraft(context.draft).errors,
            }),
          },
        ],
        "expense.submit-and-add-another": [
          { target: "savingForAnother", guard: "hasValidDraft" },
          {
            actions: assign({
              validation: ({ context }) =>
                context.draft === null
                  ? { amount: "Amount is required." }
                  : validateManualExpenseDraft(context.draft).errors,
            }),
          },
        ],
        "expense.delete": {
          target: "deleteConfirming",
          guard: "canDelete",
        },
        "expense.back": "discardConfirming",
        "expense.cancel": "discardConfirming",
        "expense.discard": "discardConfirming",
      },
    },
    draftSaveFailed: {
      tags: ["dirty", "error"],
      on: {
        "expense.retry-draft": [
          { target: "persistingDraft", guard: "hasDraft" },
          { target: "hydrating" },
        ],
        "expense.change": {
          target: "persistingDraft",
          actions: "persistDraftChange",
        },
        "expense.merchant.choose": {
          target: "persistingDraft",
          actions: assign({
            draft: ({ context, event }) => ({
              ...context.draft!,
              merchant: event.merchant.trim() || undefined,
            }),
            persistenceRevision: ({ context }) =>
              context.persistenceRevision + 1,
            error: () => null,
          }),
        },
        "expense.merchant.clear": {
          target: "persistingDraft",
          actions: assign({
            draft: ({ context }) => ({
              ...context.draft!,
              merchant: undefined,
            }),
            persistenceRevision: ({ context }) =>
              context.persistenceRevision + 1,
            error: () => null,
          }),
        },
        "expense.submit": [
          { target: "saving", guard: "hasValidDraft" },
          {
            actions: assign({
              validation: ({ context }) =>
                context.draft === null
                  ? { amount: "Amount is required." }
                  : validateManualExpenseDraft(context.draft).errors,
            }),
          },
        ],
        "expense.submit-and-add-another": [
          { target: "savingForAnother", guard: "hasValidDraft" },
          {
            actions: assign({
              validation: ({ context }) =>
                context.draft === null
                  ? { amount: "Amount is required." }
                  : validateManualExpenseDraft(context.draft).errors,
            }),
          },
        ],
        "expense.delete": {
          target: "deleteConfirming",
          guard: "canDelete",
        },
        "expense.back": "discardConfirming",
        "expense.cancel": "discardConfirming",
        "expense.discard": "discardConfirming",
      },
    },
    savingForAnother: {
      tags: ["saving"],
      invoke: {
        src: "commitExpense",
        input: ({ context }) => ({
          key: context.persistenceKey,
          draft: context.draft!,
          ...(context.originalExpense === null
            ? {}
            : { originalExpenseId: context.originalExpense.id }),
        }),
        onDone: {
          target: "openingAnother",
          actions: assign({
            result: ({ event }) => event.output,
            draft: () => null,
            originalExpense: () => null,
            openRequest: ({ event }) => ({
              projectId: event.output.expense.projectId,
            }),
            persistenceRevision: () => 0,
            deletedExpense: () => null,
            error: () => null,
          }),
        },
        onError: {
          target: "saveAnotherFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "The expense was not saved. Retry to try again.",
                retryable: true,
              }),
          }),
        },
      },
    },
    openingAnother: {
      tags: ["loading"],
      invoke: {
        src: "openExpense",
        input: ({ context }) => context.openRequest ?? {},
        onDone: {
          target: "persistingDraft",
          actions: assign({
            draft: ({ event }) => event.output.draft,
            originalExpense: () => null,
            suggestions: ({ event }) => event.output.suggestions,
            persistenceRevision: () => 1,
            validation: () => ({}),
            error: () => null,
          }),
        },
        onError: {
          target: "openingAnotherFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "The next expense form could not be opened.",
                retryable: true,
              }),
          }),
        },
      },
    },
    openingAnotherFailed: {
      tags: ["error"],
      on: {
        "expense.retry": "openingAnother",
        "expense.retry-draft": "openingAnother",
        "expense.finish-save": "savedOutput",
        "expense.cancel": "savedOutput",
        "expense.back": "savedOutput",
      },
    },
    saveAnotherFailed: {
      tags: ["dirty", "error"],
      on: {
        "expense.retry": [
          { target: "savingForAnother", guard: "hasDraft" },
          { target: "openingAnother", guard: "hasSavedResult" },
        ],
        "expense.retry-draft": [
          { target: "savingForAnother", guard: "hasDraft" },
          { target: "openingAnother", guard: "hasSavedResult" },
        ],
        "expense.change": {
          target: "persistingDraft",
          guard: "hasDraft",
          actions: "persistDraftChange",
        },
        "expense.merchant.choose": {
          target: "persistingDraft",
          guard: "hasDraft",
          actions: assign({
            draft: ({ context, event }) => ({
              ...context.draft!,
              merchant: event.merchant.trim() || undefined,
            }),
            validation: () => ({}),
            error: () => null,
            persistenceRevision: ({ context }) =>
              context.persistenceRevision + 1,
          }),
        },
        "expense.merchant.clear": {
          target: "persistingDraft",
          guard: "hasDraft",
          actions: assign({
            draft: ({ context }) => ({
              ...context.draft!,
              merchant: undefined,
            }),
            validation: () => ({}),
            error: () => null,
            persistenceRevision: ({ context }) =>
              context.persistenceRevision + 1,
          }),
        },
        "expense.delete": {
          target: "deleteConfirming",
          guard: "canDelete",
        },
        "expense.back": [
          { target: "discardConfirming", guard: "hasDraft" },
          { target: "savedOutput", guard: "hasSavedResult" },
        ],
        "expense.cancel": [
          { target: "discardConfirming", guard: "hasDraft" },
          { target: "savedOutput", guard: "hasSavedResult" },
        ],
        "expense.discard": [
          { target: "discardConfirming", guard: "hasDraft" },
          { target: "savedOutput", guard: "hasSavedResult" },
        ],
        "expense.finish-save": [
          { target: "discardConfirming", guard: "hasDraft" },
          { target: "savedOutput", guard: "hasSavedResult" },
        ],
      },
    },
    saving: {
      tags: ["saving"],
      invoke: {
        src: "commitExpense",
        input: ({ context }) => ({
          key: context.persistenceKey,
          draft: context.draft!,
          ...(context.originalExpense === null
            ? {}
            : { originalExpenseId: context.originalExpense.id }),
        }),
        onDone: {
          target: "saved",
          actions: assign({
            result: ({ event }) => event.output,
            draft: () => null,
            originalExpense: () => null,
            error: () => null,
          }),
        },
        onError: {
          target: "saveFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "The expense was not saved. Retry to try again.",
                retryable: true,
              }),
          }),
        },
      },
    },
    saveFailed: {
      tags: ["dirty", "error"],
      on: {
        "expense.retry": "saving",
        "expense.change": {
          target: "persistingDraft",
          actions: "persistDraftChange",
        },
        "expense.merchant.choose": {
          target: "persistingDraft",
          actions: assign({
            draft: ({ context, event }) => ({
              ...context.draft!,
              merchant: event.merchant.trim() || undefined,
            }),
            validation: () => ({}),
            error: () => null,
            persistenceRevision: ({ context }) =>
              context.persistenceRevision + 1,
          }),
        },
        "expense.merchant.clear": {
          target: "persistingDraft",
          actions: assign({
            draft: ({ context }) => ({
              ...context.draft!,
              merchant: undefined,
            }),
            validation: () => ({}),
            error: () => null,
            persistenceRevision: ({ context }) =>
              context.persistenceRevision + 1,
          }),
        },
        "expense.delete": {
          target: "deleteConfirming",
          guard: "canDelete",
        },
        "expense.back": "discardConfirming",
        "expense.cancel": "discardConfirming",
        "expense.discard": "discardConfirming",
      },
    },
    discardConfirming: {
      tags: ["confirming-discard"],
      on: {
        "expense.keep-editing": "editing",
        "expense.cancel": "editing",
        "expense.back": "editing",
        "expense.confirm-discard": "discarding",
      },
    },
    discarding: {
      tags: ["saving"],
      invoke: {
        src: "clearDraft",
        input: ({ context }) => ({ key: context.persistenceKey }),
        onDone: {
          target: "discarded",
          actions: assign({
            draft: () => null,
            originalExpense: () => null,
            error: () => null,
          }),
        },
        onError: {
          target: "discardFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "The expense draft could not be discarded.",
                retryable: true,
              }),
          }),
        },
      },
    },
    discardFailed: {
      tags: ["error", "dirty"],
      on: {
        "expense.retry-discard": "discarding",
        "expense.keep-editing": "editing",
      },
    },
    deleteConfirming: {
      tags: ["confirming-delete"],
      on: {
        "expense.confirm-delete": "deleting",
        "expense.cancel-delete": "editing",
        "expense.keep-editing": "editing",
      },
    },
    deleting: {
      tags: ["saving", "deleting"],
      invoke: {
        src: "deleteExpense",
        input: ({ context }) => ({
          key: context.persistenceKey,
          expense: context.originalExpense!,
        }),
        onDone: {
          target: "deleted",
          actions: assign({
            deletedExpense: ({ context }) => context.originalExpense,
            draft: () => null,
            originalExpense: () => null,
            error: () => null,
          }),
        },
        onError: {
          target: "deleteFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "The expense was not deleted.",
                retryable: true,
              }),
          }),
        },
      },
    },
    deleteFailed: {
      tags: ["error"],
      on: {
        "expense.retry-delete": "deleting",
        "expense.cancel-delete": "editing",
      },
    },
    deleted: {
      tags: ["deleted"],
      on: {
        "expense.undo": "undoing",
        "expense.finish-delete": "deletedOutput",
        "expense.cancel": "deletedOutput",
      },
    },
    undoing: {
      tags: ["saving"],
      invoke: {
        src: "restoreExpense",
        input: ({ context }) => ({
          key: context.persistenceKey,
          expense: context.deletedExpense!,
        }),
        onDone: "undone",
        onError: {
          target: "undoFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "The expense could not be restored.",
                retryable: true,
              }),
          }),
        },
      },
    },
    undoFailed: {
      tags: ["error"],
      on: {
        "expense.retry-undo": "undoing",
        "expense.cancel": "deletedOutput",
      },
    },
    saved: {
      tags: ["saved"],
      on: {
        "expense.undo": { target: "undoingSaved", guard: "hasSavedResult" },
        "expense.undo-saved": {
          target: "undoingSaved",
          guard: "hasSavedResult",
        },
        "expense.finish-save": "savedOutput",
        "expense.cancel": "savedOutput",
        "expense.back": "savedOutput",
      },
    },
    undoingSaved: {
      tags: ["saving", "undoing"],
      invoke: {
        src: "deleteExpense",
        input: ({ context }) => ({
          key: context.persistenceKey,
          expense: context.result!.expense,
        }),
        onDone: "savedUndone",
        onError: {
          target: "savedUndoFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "The saved expense could not be undone.",
                retryable: true,
              }),
          }),
        },
      },
    },
    savedUndoFailed: {
      tags: ["error"],
      on: {
        "expense.retry-undo": "undoingSaved",
        "expense.undo-saved": "undoingSaved",
        "expense.undo": "undoingSaved",
        "expense.finish-save": "savedOutput",
        "expense.cancel": "savedOutput",
        "expense.back": "savedOutput",
      },
    },
    savedOutput: {
      type: "final",
      output: ({ context }) => ({ status: "saved", result: context.result! }),
    },
    savedUndone: {
      type: "final",
      output: ({ context }) => ({
        status: "saved-undone",
        expense: context.result!.expense,
      }),
    },
    discarded: {
      type: "final",
      output: () => ({ status: "discarded" }),
    },
    cancelled: {
      type: "final",
      output: () => ({ status: "cancelled" }),
    },
    deletedOutput: {
      type: "final",
      output: ({ context }) => ({
        status: "deleted",
        expense: context.deletedExpense!,
      }),
    },
    undone: {
      type: "final",
      output: ({ context }) => ({
        status: "undone",
        expense: context.deletedExpense!,
      }),
    },
  },
});

export function createManualExpenseMachine(
  dependencies: ManualExpenseDependencies,
) {
  return manualExpenseMachine.provide({
    actors: {
      hydrateDraft: fromPromise(({ input }: { input: HydrateDraftInput }) =>
        hydrateExpense(dependencies, input)
      ),
      openExpense: fromPromise((
        { input }: { input: ManualExpenseOpenRequest },
      ) => openExpense(dependencies, input)),
      persistDraft: fromPromise(({ input }: { input: PersistDraftInput }) =>
        persistDraft(dependencies.local, input)
      ),
      commitExpense: fromPromise((
        { input }: { input: CommitManualExpenseInput },
      ) => commitExpense(dependencies, input)),
      clearDraft: fromPromise(({ input }: { input: ClearDraftInput }) =>
        clearDraft(dependencies.local, input)
      ),
      deleteExpense: fromPromise((
        { input }: { input: DeleteManualExpenseInput },
      ) => deleteExpense(dependencies.local, input)),
      restoreExpense: fromPromise((
        { input }: { input: RestoreManualExpenseInput },
      ) => restoreExpense(dependencies.local, input)),
    },
  });
}

export type ManualExpenseCommitForShell = OrganizationCommitOutput;
export type ManualExpenseRoute = ShellRoute;
