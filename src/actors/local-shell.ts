import { assign, fromPromise, setup } from "xstate";
import type { OnlineState } from "../adapters/ports/index.ts";
import type {
  OrganizationCommitOutput,
  ProjectCategoryService,
  ProjectCategoryState,
} from "../domain/organization.ts";
import {
  type ContractFailure,
  contractFailureFromError,
  type ShellRoute,
  type WorkflowKind,
} from "./contracts/index.ts";
import { unwiredPort } from "./contracts/ports.ts";

export type LocalShellEvent =
  | { readonly type: "shell.navigate"; readonly route: ShellRoute }
  | { readonly type: "shell.workflow.open"; readonly workflow: WorkflowKind }
  | { readonly type: "shell.workflow.close" }
  | { readonly type: "shell.network.offline" }
  | { readonly type: "shell.network.online" }
  | { readonly type: "shell.network.reconnecting" }
  | { readonly type: "shell.project.select"; readonly projectId: string }
  | { readonly type: "shell.project.retry" }
  | { readonly type: "shell.dataset.retired" }
  | { readonly type: "shell.retry" };

export type LocalShellContext = {
  readonly route: ShellRoute;
  readonly activeWorkflow: WorkflowKind | null;
  readonly projectState: ProjectCategoryState | null;
  readonly pendingProjectId: string | null;
  readonly error: ContractFailure | null;
};

export type LocalShellOutput = {
  readonly status: "retired";
  readonly route: ShellRoute;
};

type RestoreShellOutput = {
  readonly route: Extract<ShellRoute, "expenses" | "first-use">;
  readonly state: ProjectCategoryState;
};

type LocalShellDependencies = {
  readonly organization: ProjectCategoryService;
  readonly initialNetwork?: OnlineState;
};

const shellSetup = setup({
  types: {
    context: {} as LocalShellContext,
    events: {} as LocalShellEvent,
    output: {} as LocalShellOutput,
  },
  actors: {
    restoreShell: unwiredPort<void, RestoreShellOutput>(
      "local shell restoration",
    ),
    switchProject: unwiredPort<string, OrganizationCommitOutput>(
      "local project selection",
    ),
  },
});

function shellFailure(
  error: unknown,
  fallback: ContractFailure,
): ContractFailure {
  return contractFailureFromError(error, fallback);
}

function makeLocalShellMachine(initialNetwork: OnlineState) {
  return shellSetup.createMachine({
    id: "local-shell",
    initial: "booting",
    context: {
      route: "first-use",
      activeWorkflow: null,
      projectState: null,
      pendingProjectId: null,
      error: null,
    },
    states: {
      booting: {
        tags: ["loading"],
        invoke: {
          src: "restoreShell",
          input: () => undefined,
          onDone: {
            target: "ready",
            actions: assign({
              route: ({ event }) => event.output.route,
              projectState: ({ event }) => event.output.state,
              error: () => null,
            }),
          },
          onError: {
            target: "error",
            actions: assign({
              error: ({ event }) =>
                shellFailure(event.error, {
                  code: "unknown",
                  message: "Local shell restoration failed.",
                  retryable: true,
                }),
            }),
          },
        },
      },
      ready: {
        type: "parallel",
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
          "shell.dataset.retired": "retired",
        },
        states: {
          network: {
            initial: initialNetwork,
            states: {
              online: {
                tags: ["online"],
                on: {
                  "shell.network.offline": "offline",
                  "shell.network.reconnecting": "reconnecting",
                },
              },
              offline: {
                tags: ["offline"],
                on: {
                  "shell.network.online": "online",
                  "shell.network.reconnecting": "reconnecting",
                },
              },
              reconnecting: {
                tags: ["reconnecting"],
                on: {
                  "shell.network.online": "online",
                  "shell.network.offline": "offline",
                },
              },
            },
          },
          project: {
            initial: "ready",
            states: {
              ready: {
                tags: ["project-ready"],
                on: {
                  "shell.project.select": {
                    target: "switching",
                    actions: assign({
                      pendingProjectId: ({ event }) => event.projectId,
                      error: () => null,
                    }),
                  },
                },
              },
              switching: {
                tags: ["switching", "saving"],
                invoke: {
                  src: "switchProject",
                  input: ({ context }) => context.pendingProjectId!,
                  onDone: {
                    target: "ready",
                    actions: assign({
                      projectState: ({ event }) => event.output.state,
                      pendingProjectId: () => null,
                      error: () => null,
                    }),
                  },
                  onError: {
                    target: "failed",
                    actions: assign({
                      error: ({ event }) =>
                        shellFailure(event.error, {
                          code: "unknown",
                          message: "The project could not be selected.",
                          retryable: true,
                        }),
                    }),
                  },
                },
              },
              failed: {
                tags: ["error"],
                on: {
                  "shell.project.retry": "switching",
                  "shell.project.select": {
                    target: "switching",
                    actions: assign({
                      pendingProjectId: ({ event }) => event.projectId,
                      error: () => null,
                    }),
                  },
                },
              },
            },
          },
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
}

export const localShellMachine = makeLocalShellMachine("online");

export function createLocalShellMachine(
  dependencies: LocalShellDependencies,
) {
  const machine = makeLocalShellMachine(
    dependencies.initialNetwork ?? "online",
  );
  return machine.provide({
    actors: {
      restoreShell: fromPromise(async () => {
        const state = await dependencies.organization.getState();
        const route: RestoreShellOutput["route"] = state.projects.length === 0
          ? "first-use"
          : "expenses";
        return {
          route,
          state,
        } satisfies RestoreShellOutput;
      }),
      switchProject: fromPromise(
        async ({ input }: { input: string }) =>
          await dependencies.organization.commitProject({
            type: "select",
            projectId: input,
          }),
      ),
    },
  });
}
