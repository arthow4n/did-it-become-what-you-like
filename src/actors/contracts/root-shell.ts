import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import {
  type ContractFailure,
  contractFailureFromError,
  type ShellRoute,
  type WorkflowKind,
} from "./types.ts";

export type RootShellEvent =
  | { readonly type: "shell.boot" }
  | { readonly type: "shell.navigate"; readonly route: ShellRoute }
  | { readonly type: "shell.workflow.open"; readonly workflow: WorkflowKind }
  | { readonly type: "shell.workflow.close" }
  | { readonly type: "shell.network.offline" }
  | { readonly type: "shell.network.online" }
  | { readonly type: "shell.network.reconnecting" }
  | { readonly type: "shell.dataset.retired" }
  | { readonly type: "shell.retry" };

export type RootShellOutput = {
  readonly status: "retired";
  readonly route: ShellRoute;
};

type RootShellContext = {
  readonly route: ShellRoute;
  readonly activeWorkflow: WorkflowKind | null;
  readonly error: ContractFailure | null;
};

type RestoreShellOutput = { readonly route: ShellRoute };

const shellSetup = setup({
  types: {
    context: {} as RootShellContext,
    events: {} as RootShellEvent,
    output: {} as RootShellOutput,
  },
  actors: {
    restoreShell: unwiredPort<void, RestoreShellOutput>("shell restoration"),
  },
});

export const rootShellMachine = shellSetup.createMachine({
  id: "root-shell",
  initial: "booting",
  context: {
    route: "first-use",
    activeWorkflow: null,
    error: null,
  },
  states: {
    booting: {
      tags: ["loading"],
      invoke: {
        src: "restoreShell",
        onDone: {
          target: "online",
          actions: assign({
            route: ({ event }) => event.output.route,
            error: () => null,
          }),
        },
        onError: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Shell restoration failed.",
                retryable: true,
              }),
          }),
        },
      },
    },
    online: {
      tags: ["online"],
      on: {
        "shell.navigate": {
          actions: assign({ route: ({ event }) => event.route }),
        },
        "shell.workflow.open": {
          actions: assign({ activeWorkflow: ({ event }) => event.workflow }),
        },
        "shell.workflow.close": {
          actions: assign({ activeWorkflow: () => null }),
        },
        "shell.network.offline": "offline",
        "shell.network.reconnecting": "reconnecting",
        "shell.dataset.retired": "retired",
      },
    },
    offline: {
      tags: ["offline"],
      on: {
        "shell.navigate": {
          actions: assign({ route: ({ event }) => event.route }),
        },
        "shell.workflow.open": {
          actions: assign({ activeWorkflow: ({ event }) => event.workflow }),
        },
        "shell.network.online": "online",
        "shell.network.reconnecting": "reconnecting",
        "shell.dataset.retired": "retired",
      },
    },
    reconnecting: {
      tags: ["reconnecting"],
      on: {
        "shell.navigate": {
          actions: assign({ route: ({ event }) => event.route }),
        },
        "shell.network.online": "online",
        "shell.network.offline": "offline",
        "shell.dataset.retired": "retired",
      },
    },
    error: {
      tags: ["error"],
      on: { "shell.retry": "booting" },
    },
    retired: {
      type: "final",
      tags: ["retired"],
      output: ({ context }) => ({ status: "retired", route: context.route }),
    },
  },
});
