import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import {
  type ContractFailure,
  contractFailureFromError,
  type ExpenseCommitInput,
  type ExpenseCommitOutput,
  type ExpenseDraft,
} from "./types.ts";

export type ExpenseFormEvent =
  | {
    readonly type: "expense.open";
    readonly draft: ExpenseDraft;
    readonly originalExpenseId?: string;
  }
  | { readonly type: "expense.change"; readonly draft: ExpenseDraft }
  | { readonly type: "expense.submit" }
  | { readonly type: "expense.retry" }
  | { readonly type: "expense.discard" }
  | { readonly type: "expense.cancel" }
  | { readonly type: "expense.confirm-discard" };

export type ExpenseFormOutput =
  | { readonly status: "saved"; readonly result: ExpenseCommitOutput }
  | { readonly status: "discarded" }
  | { readonly status: "cancelled" };

type ExpenseFormContext = {
  readonly draft: ExpenseDraft | null;
  readonly originalExpenseId?: string;
  readonly result: ExpenseCommitOutput | null;
  readonly error: ContractFailure | null;
};

const expenseFormSetup = setup({
  types: {
    context: {} as ExpenseFormContext,
    events: {} as ExpenseFormEvent,
    output: {} as ExpenseFormOutput,
  },
  actors: {
    commitExpense: unwiredPort<ExpenseCommitInput, ExpenseCommitOutput>(
      "local expense commit",
    ),
  },
  guards: {
    draftIsValid: ({ context }) => {
      const draft = context.draft;
      return Boolean(
        draft && draft.amount.trim() !== "" && draft.projectId.trim() !== "" &&
          draft.categoryId.trim() !== "" && draft.date.trim() !== "" &&
          draft.currency.trim() !== "",
      );
    },
  },
});

export const expenseFormMachine = expenseFormSetup.createMachine({
  id: "expense-form",
  initial: "closed",
  context: {
    draft: null,
    originalExpenseId: undefined,
    result: null,
    error: null,
  },
  states: {
    closed: {
      on: {
        "expense.open": {
          target: "editing",
          actions: assign({
            draft: ({ event }) => event.draft,
            originalExpenseId: ({ event }) => event.originalExpenseId,
            result: () => null,
            error: () => null,
          }),
        },
      },
    },
    editing: {
      tags: ["dirty"],
      on: {
        "expense.change": {
          actions: assign({
            draft: ({ event }) => event.draft,
            error: () => null,
          }),
        },
        "expense.submit": [
          { target: "saving", guard: "draftIsValid" },
          {
            actions: assign({
              error: () => ({
                code: "invalid",
                message: "Complete the required fields.",
                retryable: false,
              }),
            }),
          },
        ],
        "expense.discard": {
          target: "discarded",
          actions: assign({
            draft: () => null,
            originalExpenseId: () => undefined,
          }),
        },
        "expense.cancel": "cancelled",
      },
    },
    saving: {
      tags: ["saving"],
      invoke: {
        src: "commitExpense",
        input: ({ context }) => ({
          originalExpenseId: context.originalExpenseId,
          draft: context.draft!,
        }),
        onDone: {
          target: "saved",
          actions: assign({
            result: ({ event }) => event.output,
            error: () => null,
            draft: () => null,
            originalExpenseId: () => undefined,
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
      on: {
        "expense.cancel": "cancelled",
      },
    },
    saveFailed: {
      tags: ["error"],
      on: {
        "expense.retry": "saving",
        "expense.change": {
          target: "editing",
          actions: assign({
            draft: ({ event }) => event.draft,
            error: () => null,
          }),
        },
        "expense.discard": {
          target: "discarded",
          actions: assign({
            draft: () => null,
            originalExpenseId: () => undefined,
          }),
        },
        "expense.cancel": "cancelled",
      },
    },
    saved: {
      type: "final",
      output: ({ context }) => ({ status: "saved", result: context.result! }),
    },
    discarded: {
      type: "final",
      output: () => ({ status: "discarded" }),
    },
    cancelled: {
      type: "final",
      output: () => ({ status: "cancelled" }),
    },
  },
});
