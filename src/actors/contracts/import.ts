import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import {
  type ContractFailure,
  contractFailureFromError,
  type ImportCommitInput,
  type ImportCommitOutput,
  type ImportPreview,
} from "./types.ts";

export type ImportEvent =
  | {
    readonly type: "import.open";
    readonly driveConfigured: boolean;
    readonly online: boolean;
  }
  | { readonly type: "import.file-selected"; readonly contents: string }
  | { readonly type: "import.choose-merge" }
  | { readonly type: "import.choose-replace" }
  | { readonly type: "import.commit" }
  | { readonly type: "import.retry" }
  | { readonly type: "import.resolve-conflicts" }
  | { readonly type: "import.cancel" };

type ImportContext = {
  readonly source: string | null;
  readonly preview: ImportPreview | null;
  readonly mode: "merge" | "replace" | null;
  readonly driveConfigured: boolean;
  readonly online: boolean;
  readonly result: ImportCommitOutput | null;
  readonly error: ContractFailure | null;
};

export type ImportOutput =
  | { readonly status: "completed"; readonly result: ImportCommitOutput }
  | { readonly status: "cancelled" };

const importSetup = setup({
  types: {
    context: {} as ImportContext,
    events: {} as ImportEvent,
    output: {} as ImportOutput,
  },
  actors: {
    validateImport: unwiredPort<string, ImportPreview>(
      "import validation and migration",
    ),
    synchronizeBeforeReplace: unwiredPort<void, void>(
      "pre-replacement synchronization",
    ),
    commitImport: unwiredPort<ImportCommitInput, ImportCommitOutput>(
      "atomic import commit",
    ),
  },
  guards: {
    hasReplacePreSync: ({ context }) =>
      context.mode === "replace" && context.driveConfigured && context.online,
    replacePreSyncOffline: ({ context }) =>
      context.mode === "replace" && context.driveConfigured && !context.online,
    hasMode: ({ context }) => context.mode !== null,
    hasConflicts: ({ context }) => (context.result?.conflictCount ?? 0) > 0,
  },
});

export const importMachine = importSetup.createMachine({
  id: "import",
  initial: "idle",
  context: {
    source: null,
    preview: null,
    mode: null,
    driveConfigured: false,
    online: false,
    result: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        "import.open": {
          target: "choosing",
          actions: assign({
            driveConfigured: ({ event }) => event.driveConfigured,
            online: ({ event }) => event.online,
            error: () => null,
          }),
        },
      },
    },
    choosing: {
      tags: ["choosing"],
      on: {
        "import.file-selected": {
          target: "validating",
          actions: assign({
            source: ({ event }) => event.contents,
            error: () => null,
          }),
        },
        "import.cancel": "cancelled",
      },
    },
    validating: {
      tags: ["validating"],
      invoke: {
        src: "validateImport",
        input: ({ context }) => context.source!,
        onDone: {
          target: "previewing",
          actions: assign({
            preview: ({ event }) => event.output,
            error: () => null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "invalid",
                message: "The backup could not be validated.",
                retryable: false,
              }),
          }),
        },
      },
      on: { "import.cancel": "cancelled" },
    },
    previewing: {
      tags: ["preview"],
      on: {
        "import.choose-merge": { actions: assign({ mode: () => "merge" }) },
        "import.choose-replace": { actions: assign({ mode: () => "replace" }) },
        "import.commit": [
          { target: "preSyncing", guard: "hasReplacePreSync" },
          {
            target: "failed",
            guard: "replacePreSyncOffline",
            actions: assign({
              error: () => ({
                code: "offline",
                message: "Replacement requires an online pre-sync.",
                retryable: true,
              }),
            }),
          },
          { target: "committing", guard: "hasMode" },
        ],
        "import.cancel": "cancelled",
      },
    },
    preSyncing: {
      tags: ["synchronizing"],
      invoke: {
        src: "synchronizeBeforeReplace",
        input: () => undefined,
        onDone: "committing",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Replacement pre-sync failed.",
                retryable: true,
              }),
          }),
        },
      },
      on: { "import.cancel": "cancelled" },
    },
    committing: {
      tags: ["saving"],
      invoke: {
        src: "commitImport",
        input: ({ context }) => ({
          preview: context.preview!,
          mode: context.mode!,
        }),
        onDone: {
          target: "committed",
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
                message: "Import was not committed.",
                retryable: true,
              }),
          }),
        },
      },
      on: { "import.cancel": "cancelled" },
    },
    committed: {
      always: [
        { target: "conflict", guard: "hasConflicts" },
        "completed",
      ],
    },
    conflict: {
      tags: ["conflict"],
      on: {
        "import.resolve-conflicts": "completed",
        "import.cancel": "cancelled",
      },
    },
    failed: {
      tags: ["error"],
      on: {
        "import.retry": "validating",
        "import.cancel": "cancelled",
      },
    },
    completed: {
      type: "final",
      output: ({ context }) => ({
        status: "completed",
        result: context.result!,
      }),
    },
    cancelled: { type: "final", output: () => ({ status: "cancelled" }) },
  },
});
