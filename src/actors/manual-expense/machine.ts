import { assign, fromPromise, setup } from "xstate";
import type { Expense } from "../../domain/index.ts";
import { unwiredPort } from "../contracts/ports.ts";
import {
  contractFailureFromError,
  type ExpenseCommitOutput,
} from "../contracts/index.ts";
import type {
  ClearDraftInput,
  CommitManualExpenseInput,
  DeleteManualExpenseInput,
  HydratedManualExpense,
  HydrateDraftInput,
  ManualExpenseContext,
  ManualExpenseDependencies,
  ManualExpenseDraft,
  ManualExpenseEvent,
  ManualExpenseMachineInput,
  ManualExpenseOpenRequest,
  ManualExpenseOutput,
  PersistDraftInput,
  RestoreManualExpenseInput,
} from "./types.ts";
import { DEFAULT_PERSISTENCE_KEY } from "./types.ts";
import {
  draftForEditing,
  initialDraftFromRequest,
  isDraftModified,
  validateManualExpenseDraft,
} from "./draft.ts";
import {
  clearDraft,
  commitExpense,
  deleteExpense,
  hydrateExpense,
  openExpense,
  persistDraft,
  restoreExpense,
} from "./operations.ts";

export const manualExpenseSetup = setup({
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
        event.type === "expense.change"
          ? draftForEditing(event.draft)
          : context.draft,
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
    isFormModified: ({ context }) =>
      isDraftModified(context.draft, context.originalExpense),
  },
});

export const manualExpenseMachine = manualExpenseSetup.createMachine({
  id: "manual-expense",
  initial: "idle",
  context: ({ input }) => ({
    persistenceKey: input?.persistenceKey ?? DEFAULT_PERSISTENCE_KEY,
    draft: initialDraftFromRequest(input?.request),
    originalExpense: input?.request?.expense ?? null,
    openRequest: input?.request ?? null,
    validation: {},
    persistenceRevision: 0,
    result: null,
    deletedExpense: null,
    error: null,
  }),
  states: {
    idle: {
      always: [
        {
          target: "opening",
          guard: ({ context }) => context.openRequest !== null,
        },
      ],
      on: {
        "expense.hydrate": "hydrating",
        "expense.open": {
          target: "opening",
          actions: assign({
            openRequest: ({ event }) => event.request ?? {},
            draft: ({ context, event }) =>
              context.draft ?? initialDraftFromRequest(event.request),
            originalExpense: ({ context, event }) =>
              context.originalExpense ?? event.request?.expense ?? null,
            error: () => null,
          }),
        },
        "expense.cancel": "cancelled",
      },
    },
    hydrating: {
      tags: ["dirty", "loading"],
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
        "expense.discard": "discarding",
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
      tags: ["dirty", "loading"],
      invoke: {
        src: "openExpense",
        input: ({ context }) => context.openRequest ?? {},
        onDone: {
          target: "editing",
          actions: assign({
            draft: ({ context, event }) => {
              if (
                context.draft &&
                (context.draft.amount ||
                  context.draft.merchant ||
                  context.draft.description)
              ) {
                return {
                  ...event.output.draft,
                  amount: context.draft.amount,
                  merchant: context.draft.merchant,
                  description: context.draft.description,
                  direction: context.draft.direction,
                  date: context.draft.date || event.output.draft.date,
                  categoryId: context.draft.categoryId ||
                    event.output.draft.categoryId,
                  projectId: context.draft.projectId ||
                    event.output.draft.projectId,
                  currency: context.draft.currency ||
                    event.output.draft.currency,
                };
              }
              return event.output.draft;
            },
            originalExpense: ({ event }) => event.output.originalExpense,
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
      on: {
        "expense.cancel": "cancelled",
        "expense.discard": "discarding",
      },
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
          actions: "persistDraftChange",
        },
        "expense.submit": [
          { target: "saving", guard: "hasValidDraft" },
          {
            actions: assign({
              draft: ({ context }) =>
                context.draft === null ? null : draftForEditing(context.draft),
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
              draft: ({ context }) =>
                context.draft === null ? null : draftForEditing(context.draft),
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
        "expense.back": [
          { target: "discardConfirming", guard: "isFormModified" },
          { target: "cancelled" },
        ],
        "expense.cancel": [
          { target: "discardConfirming", guard: "isFormModified" },
          { target: "cancelled" },
        ],
        "expense.discard": [
          { target: "discardConfirming", guard: "isFormModified" },
          { target: "cancelled" },
        ],
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
      tags: ["dirty", "loading"],
      invoke: {
        src: "openExpense",
        input: ({ context }) => context.openRequest ?? {},
        onDone: {
          target: "editing",
          actions: assign({
            draft: ({ event }) => event.output.draft,
            originalExpense: () => null,
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
      on: {
        "expense.cancel": "savedOutput",
        "expense.discard": "savedOutput",
      },
    },
    openingAnotherFailed: {
      tags: ["error"],
      on: {
        "expense.retry": "openingAnother",
        "expense.retry-draft": "openingAnother",
        "expense.finish-save": "savedOutput",
        "expense.cancel": "savedOutput",
        "expense.discard": "savedOutput",
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
          target: "editing",
          actions: "persistDraftChange",
        },
        "expense.delete": {
          target: "deleteConfirming",
          guard: "canDelete",
        },
        "expense.back": [
          { target: "discardConfirming", guard: "isFormModified" },
          { target: "cancelled" },
        ],
        "expense.cancel": [
          { target: "discardConfirming", guard: "isFormModified" },
          { target: "cancelled" },
        ],
        "expense.discard": [
          { target: "discardConfirming", guard: "isFormModified" },
          { target: "cancelled" },
        ],
      },
    },
    discardConfirming: {
      tags: ["dirty", "confirming-discard"],
      on: {
        "expense.keep-editing": "editing",
        "expense.cancel": "editing",
        "expense.back": "editing",
        "expense.confirm-discard": "discarding",
      },
    },
    discarding: {
      tags: ["dirty", "saving"],
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
