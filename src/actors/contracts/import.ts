import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import type {
  ContractFailure,
  ImportCommitInput,
  ImportCommitOutput,
  ImportPreview,
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
      context.mode === "replace" && context.driveConfigured,
    canPreSync: ({ context }) => context.online,
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
            error: () => ({
              code: "invalid-import",
              message: "The backup could not be validated.",
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
          "committing",
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
            error: () => ({
              code: "pre-sync-failed",
              message: "Replacement requires a successful online sync.",
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
            error: () => ({
              code: "import-failed",
              message: "Import was not committed.",
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
