import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import {
  type ConflictCandidate,
  type ConflictCommitOutput,
  type ConflictGroup,
  type ConflictResolution,
  type ContractFailure,
  contractFailureFromError,
} from "./types.ts";

export type ConflictEvent =
  | { readonly type: "conflict.open"; readonly group: ConflictGroup }
  | {
    readonly type: "conflict.choose-candidate";
    readonly candidate: ConflictCandidate;
  }
  | { readonly type: "conflict.choose-custom"; readonly value: string | null }
  | { readonly type: "conflict.keep-edited" }
  | { readonly type: "conflict.delete-record" }
  | { readonly type: "conflict.submit" }
  | { readonly type: "conflict.retry" }
  | { readonly type: "conflict.cancel" };

type ConflictContext = {
  readonly group: ConflictGroup | null;
  readonly resolution: ConflictResolution | null;
  readonly result: ConflictCommitOutput | null;
  readonly error: ContractFailure | null;
};

export type ConflictOutput =
  | { readonly status: "resolved"; readonly result: ConflictCommitOutput }
  | { readonly status: "cancelled" };

const conflictSetup = setup({
  types: {
    context: {} as ConflictContext,
    events: {} as ConflictEvent,
    output: {} as ConflictOutput,
  },
  actors: {
    commitResolution: unwiredPort<ConflictResolution, ConflictCommitOutput>(
      "conflict resolution commit",
    ),
  },
  guards: {
    hasResolution: ({ context }) => context.resolution !== null,
  },
});

export const conflictMachine = conflictSetup.createMachine({
  id: "conflict-review",
  initial: "idle",
  context: { group: null, resolution: null, result: null, error: null },
  states: {
    idle: {
      on: {
        "conflict.open": {
          target: "reviewing",
          actions: assign({
            group: ({ event }) => event.group,
            resolution: () => null,
            error: () => null,
          }),
        },
      },
    },
    reviewing: {
      tags: ["reviewing"],
      on: {
        "conflict.choose-candidate": {
          actions: assign({
            resolution: ({ context, event }) => ({
              conflictId: context.group!.id,
              choice: "candidate",
              revisionId: event.candidate.revisionId,
              value: event.candidate.value,
            }),
          }),
        },
        "conflict.choose-custom": {
          actions: assign({
            resolution: ({ context, event }) => ({
              conflictId: context.group!.id,
              choice: "custom",
              value: event.value,
            }),
          }),
        },
        "conflict.keep-edited": {
          actions: assign({
            resolution: ({ context }) => ({
              conflictId: context.group!.id,
              choice: "keep-edited",
            }),
          }),
        },
        "conflict.delete-record": {
          actions: assign({
            resolution: ({ context }) => ({
              conflictId: context.group!.id,
              choice: "delete",
            }),
          }),
        },
        "conflict.submit": [
          { target: "committing", guard: "hasResolution" },
          {
            actions: assign({
              error: () => ({
                code: "invalid",
                message: "Choose a conflict resolution first.",
                retryable: false,
              }),
            }),
          },
        ],
        "conflict.cancel": "cancelled",
      },
    },
    committing: {
      tags: ["saving"],
      invoke: {
        src: "commitResolution",
        input: ({ context }) => context.resolution!,
        onDone: {
          target: "resolved",
          actions: assign({
            result: ({ event }) => event.output,
            error: () => null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Resolution was not committed.",
                retryable: true,
              }),
          }),
        },
      },
      on: { "conflict.cancel": "cancelled" },
    },
    failed: {
      tags: ["error"],
      on: {
        "conflict.retry": "committing",
        "conflict.cancel": "cancelled",
      },
    },
    resolved: {
      type: "final",
      output: ({ context }) => ({
        status: "resolved",
        result: context.result!,
      }),
    },
    cancelled: { type: "final", output: () => ({ status: "cancelled" }) },
  },
});
