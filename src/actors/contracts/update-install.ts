import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import {
  type ContractFailure,
  contractFailureFromError,
  type UpdateCheckOutput,
} from "./types.ts";

export type UpdateInstallEvent =
  | { readonly type: "install.available" }
  | { readonly type: "install.request" }
  | { readonly type: "install.dismiss" }
  | { readonly type: "update.check" }
  | { readonly type: "update.reload" }
  | { readonly type: "update.blocked-by-dirty" }
  | { readonly type: "network.offline" }
  | { readonly type: "network.online" }
  | { readonly type: "update.retry" };

type UpdateInstallContext = {
  readonly version: string | null;
  readonly error: ContractFailure | null;
};

export type UpdateInstallOutput =
  | { readonly status: "installed" }
  | { readonly status: "reloaded" };

const updateInstallSetup = setup({
  types: {
    context: {} as UpdateInstallContext,
    events: {} as UpdateInstallEvent,
    output: {} as UpdateInstallOutput,
  },
  actors: {
    installApp: unwiredPort<void, void>("PWA installation prompt"),
    checkForUpdate: unwiredPort<void, UpdateCheckOutput>("PWA update check"),
  },
});

export const updateInstallMachine = updateInstallSetup.createMachine({
  id: "update-install",
  initial: "idle",
  context: { version: null, error: null },
  states: {
    idle: {
      tags: ["idle"],
      on: {
        "install.available": "installAvailable",
        "update.check": "checking",
        "network.offline": "offline",
      },
    },
    installAvailable: {
      tags: ["install-available"],
      on: {
        "install.request": "installing",
        "install.dismiss": "dismissed",
        "update.check": "checking",
        "network.offline": "offline",
      },
    },
    installing: {
      tags: ["installing"],
      invoke: {
        src: "installApp",
        input: () => undefined,
        onDone: "installed",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unavailable",
                message: "Installation is unavailable.",
                retryable: false,
              }),
          }),
        },
      },
    },
    installed: { type: "final", output: () => ({ status: "installed" }) },
    dismissed: {
      tags: ["dismissed"],
      on: {
        "install.available": "installAvailable",
        "update.check": "checking",
        "network.offline": "offline",
      },
    },
    checking: {
      tags: ["checking"],
      invoke: {
        src: "checkForUpdate",
        input: () => undefined,
        onDone: [
          {
            target: "updateReady",
            guard: ({ event }) => event.output.status === "update-ready",
            actions: assign({
              version: ({ event }) =>
                event.output.status === "update-ready"
                  ? event.output.version
                  : null,
            }),
          },
          {
            target: "upToDate",
            actions: assign({ version: () => null, error: () => null }),
          },
        ],
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Update status could not be checked.",
                retryable: true,
              }),
          }),
        },
      },
      on: { "network.offline": "offline" },
    },
    upToDate: {
      tags: ["up-to-date"],
      on: { "update.check": "checking", "network.offline": "offline" },
    },
    updateReady: {
      tags: ["update-ready"],
      on: {
        "update.reload": "reloading",
        "update.blocked-by-dirty": "blocked",
        "update.check": "checking",
        "network.offline": "offline",
      },
    },
    blocked: {
      tags: ["blocked"],
      on: { "update.reload": "reloading", "update.check": "checking" },
    },
    reloading: { type: "final", output: () => ({ status: "reloaded" }) },
    offline: {
      tags: ["offline"],
      on: { "network.online": "idle", "update.retry": "checking" },
    },
    failed: {
      tags: ["error"],
      on: { "update.retry": "checking", "network.offline": "offline" },
    },
  },
});
