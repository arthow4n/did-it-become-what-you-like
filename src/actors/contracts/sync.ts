import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import {
  type ContractFailure,
  contractFailureFromError,
  type SyncPortOutput,
  type SyncRequest,
} from "./types.ts";

export type SyncEvent =
  | {
    readonly type: "sync.configure";
    readonly accountEmail: string;
    readonly online: boolean;
  }
  | { readonly type: "sync.request"; readonly request: SyncRequest }
  | { readonly type: "sync.retry" }
  | { readonly type: "sync.network.offline" }
  | { readonly type: "sync.network.online" }
  | { readonly type: "sync.disconnect" }
  | { readonly type: "sync.retire" }
  | { readonly type: "sync.resolve-conflicts" };

type SyncContext = {
  readonly accountEmail: string | null;
  readonly pendingRequest: SyncRequest | null;
  readonly pendingChangeCount: number;
  readonly unresolvedConflictCount: number;
  readonly lastSyncedAt: string | null;
  readonly error: ContractFailure | null;
};

export type SyncOutput = { readonly status: "retired" };

const syncSetup = setup({
  types: {
    context: {} as SyncContext,
    events: {} as SyncEvent,
    output: {} as SyncOutput,
  },
  actors: {
    syncTransport: unwiredPort<SyncRequest, SyncPortOutput>(
      "causal sync transport",
    ),
  },
  guards: {
    hasConflicts: ({ context }) => context.unresolvedConflictCount > 0,
    isOnline: ({ event }) => event.type === "sync.configure" && event.online,
    isRetryableFailure: ({ context }) => context.error?.retryable === true,
  },
});

export const syncMachine = syncSetup.createMachine({
  id: "sync",
  initial: "unconfigured",
  context: {
    accountEmail: null,
    pendingRequest: null,
    pendingChangeCount: 0,
    unresolvedConflictCount: 0,
    lastSyncedAt: null,
    error: null,
  },
  states: {
    unconfigured: {
      tags: ["unconfigured"],
      on: {
        "sync.configure": [
          {
            target: "idle",
            guard: "isOnline",
            actions: assign({
              accountEmail: ({ event }) => event.accountEmail,
            }),
          },
          {
            target: "offline",
            actions: assign({
              accountEmail: ({ event }) => event.accountEmail,
            }),
          },
        ],
      },
    },
    idle: {
      tags: ["idle"],
      on: {
        "sync.request": {
          target: "synchronizing",
          actions: assign({
            pendingRequest: ({ event }) => event.request,
            error: () => null,
          }),
        },
        "sync.network.offline": "offline",
        "sync.disconnect": "unconfigured",
        "sync.retire": "retired",
      },
    },
    offline: {
      tags: ["offline"],
      on: {
        "sync.network.online": "idle",
        "sync.request": {
          actions: assign({ pendingRequest: ({ event }) => event.request }),
        },
        "sync.disconnect": "unconfigured",
        "sync.retire": "retired",
      },
    },
    synchronizing: {
      tags: ["syncing"],
      invoke: {
        src: "syncTransport",
        input: ({ context }) => context.pendingRequest!,
        onDone: {
          target: "syncCompleted",
          actions: assign({
            lastSyncedAt: ({ event }) => event.output.lastSyncedAt,
            unresolvedConflictCount: ({ event }) =>
              event.output.unresolvedConflictCount,
            pendingChangeCount: ({ event }) => event.output.pendingChangeCount,
            pendingRequest: () => null,
            error: () => null,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Synchronization failed.",
                retryable: true,
              }),
          }),
        },
      },
      on: {
        "sync.network.offline": "offline",
        "sync.retire": "retired",
      },
    },
    syncCompleted: {
      always: [
        { target: "conflict", guard: "hasConflicts" },
        "idle",
      ],
    },
    conflict: {
      tags: ["conflict"],
      on: {
        "sync.resolve-conflicts": "idle",
        "sync.request": {
          actions: assign({ pendingRequest: ({ event }) => event.request }),
        },
        "sync.network.offline": "offline",
        "sync.retire": "retired",
      },
    },
    error: {
      tags: ["error"],
      always: {
        target: "retryableError",
        guard: "isRetryableFailure",
      },
      on: {
        "sync.network.offline": "offline",
        "sync.disconnect": "unconfigured",
        "sync.retire": "retired",
      },
    },
    retryableError: {
      tags: ["error", "retryable"],
      on: {
        "sync.retry": {
          target: "synchronizing",
          actions: assign({ error: () => null }),
        },
        "sync.network.offline": "offline",
        "sync.disconnect": "unconfigured",
        "sync.retire": "retired",
      },
    },
    retired: {
      type: "final",
      tags: ["retired"],
      output: () => ({ status: "retired" }),
    },
  },
});
