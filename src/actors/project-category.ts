import { assign, fromPromise, setup } from "xstate";
import { categoryMachine, projectMachine } from "./contracts/index.ts";
import {
  type CategoryCommand,
  type ContractFailure,
  contractFailureFromError,
  type ProjectCategoryCommitOutput,
  type ProjectCommand,
} from "./contracts/types.ts";
import {
  type CategoryAction,
  type CategoryOrganizationCommand,
  createProjectCategoryService,
  isOrganizationError,
  type OrganizationCommitOutput,
  type OrganizationErrorCode,
  type ProjectAction,
  type ProjectCategoryService,
  type ProjectCategoryState,
  type ProjectCurrencyCommand,
  type ProjectOrganizationCommand,
  selectCategoryActions,
  selectProjectActions,
} from "../domain/organization.ts";
import type { CurrencyCode, StableId } from "../domain/index.ts";

export type ProjectCategoryActorFailure =
  | ContractFailure
  | {
    readonly code: OrganizationErrorCode;
    readonly message: string;
    readonly retryable: false;
  };

function actorFailure(
  error: unknown,
  fallback: ContractFailure,
): ProjectCategoryActorFailure {
  if (isOrganizationError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: false,
    };
  }
  return contractFailureFromError(error, fallback);
}

function lockedCommitOutput(
  output: OrganizationCommitOutput,
): ProjectCategoryCommitOutput {
  return {
    projects: output.projects,
    categories: output.categories,
    selectedProjectId: output.selectedProjectId,
  };
}

/** Injects the transactional L-202 service into the locked D-102 project port. */
export function createProjectActorMachine(
  service: ProjectCategoryService,
) {
  return projectMachine.provide({
    actors: {
      commitProject: fromPromise(
        async ({ input }: { input: ProjectCommand }) =>
          lockedCommitOutput(
            await service.commitProject(input, { confirmed: true }),
          ),
      ),
    },
  });
}

/** Injects the transactional L-202 service into the locked D-102 category port. */
export function createCategoryActorMachine(
  service: ProjectCategoryService,
) {
  return categoryMachine.provide({
    actors: {
      commitCategory: fromPromise(
        async ({ input }: { input: CategoryCommand }) =>
          lockedCommitOutput(await service.commitCategory(input)),
      ),
    },
  });
}

export type ProjectOrganizationMutation =
  | ProjectOrganizationCommand
  | ProjectCurrencyCommand;

export type ProjectOrganizationEvent =
  | { readonly type: "project.open"; readonly state: ProjectCategoryState }
  | {
    readonly type: "project.command";
    readonly command: ProjectOrganizationCommand;
  }
  | {
    readonly type: "project.set-default-currency";
    readonly projectId: StableId;
    readonly currency: CurrencyCode;
  }
  | { readonly type: "project.retry" }
  | { readonly type: "project.cancel" };

export type ProjectOrganizationContext = {
  readonly state: ProjectCategoryState | null;
  readonly pending: ProjectOrganizationMutation | null;
  readonly result: OrganizationCommitOutput | null;
  readonly error: ProjectCategoryActorFailure | null;
};

export type ProjectOrganizationOutput =
  | { readonly status: "cancelled" }
  | { readonly status: "completed"; readonly result: OrganizationCommitOutput };

export type OrganizationControlAction =
  | ProjectAction
  | { readonly type: "retry" }
  | { readonly type: "cancel" };

export function selectProjectOrganizationActions(
  snapshot: {
    readonly value: unknown;
    readonly context: ProjectOrganizationContext;
  },
): readonly OrganizationControlAction[] {
  const mode = typeof snapshot.value === "string" ? snapshot.value : "";
  if (mode === "mutating") return [{ type: "cancel" }];
  if (mode === "ready" || mode === "failed") {
    const actions = snapshot.context.state === null
      ? []
      : selectProjectActions(snapshot.context.state);
    return [
      ...actions,
      ...(mode === "failed" ? [{ type: "retry" } as const] : []),
      { type: "cancel" },
    ];
  }
  return [];
}

export function createProjectOrganizationMachine(
  service: ProjectCategoryService,
) {
  const machineSetup = setup({
    types: {
      context: {} as ProjectOrganizationContext,
      events: {} as ProjectOrganizationEvent,
      output: {} as ProjectOrganizationOutput,
    },
    actors: {
      commitProject: fromPromise(
        async ({ input }: { input: ProjectOrganizationMutation }) => {
          if (input.type === "set-default-currency") {
            return await service.setProjectDefaultCurrency(
              input.projectId,
              input.currency,
            );
          }
          return await service.commitProject(input, { confirmed: true });
        },
      ),
    },
  });

  return machineSetup.createMachine({
    id: "project-organization",
    initial: "closed",
    context: {
      state: null,
      pending: null,
      result: null,
      error: null,
    },
    states: {
      closed: {
        on: {
          "project.open": {
            target: "ready",
            actions: assign({
              state: ({ event }) => event.state,
              pending: () => null,
              result: () => null,
              error: () => null,
            }),
          },
        },
      },
      ready: {
        tags: ["ready"],
        on: {
          "project.open": {
            target: "ready",
            actions: assign({
              state: ({ event }) => event.state,
              pending: () => null,
              result: () => null,
              error: () => null,
            }),
          },
          "project.command": {
            target: "mutating",
            actions: assign({
              pending: ({ event }) => event.command,
              error: () => null,
            }),
          },
          "project.set-default-currency": {
            target: "mutating",
            actions: assign({
              pending: ({ event }) => ({
                type: "set-default-currency",
                projectId: event.projectId,
                currency: event.currency,
              }),
              error: () => null,
            }),
          },
          "project.cancel": "cancelled",
        },
      },
      mutating: {
        tags: ["saving"],
        invoke: {
          src: "commitProject",
          input: ({ context }) => context.pending!,
          onDone: {
            target: "ready",
            actions: assign({
              state: ({ event }) => event.output.state,
              result: ({ event }) => event.output,
              pending: () => null,
              error: () => null,
            }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                actorFailure(event.error, {
                  code: "unknown",
                  message: "Project change failed.",
                  retryable: true,
                }),
            }),
          },
        },
        on: { "project.cancel": "cancelled" },
      },
      failed: {
        tags: ["error"],
        on: {
          "project.open": {
            target: "ready",
            actions: assign({
              state: ({ event }) => event.state,
              pending: () => null,
              result: () => null,
              error: () => null,
            }),
          },
          "project.retry": "mutating",
          "project.command": {
            target: "mutating",
            actions: assign({
              pending: ({ event }) => event.command,
              error: () => null,
            }),
          },
          "project.cancel": "cancelled",
        },
      },
      cancelled: {
        type: "final",
        output: () => ({ status: "cancelled" }),
      },
    },
  });
}

export type CategoryOrganizationEvent =
  | { readonly type: "category.open"; readonly state: ProjectCategoryState }
  | {
    readonly type: "category.command";
    readonly command: CategoryOrganizationCommand;
  }
  | { readonly type: "category.retry" }
  | { readonly type: "category.cancel" };

export type CategoryOrganizationContext = {
  readonly state: ProjectCategoryState | null;
  readonly pending: CategoryOrganizationCommand | null;
  readonly result: OrganizationCommitOutput | null;
  readonly error: ProjectCategoryActorFailure | null;
};

export type CategoryOrganizationOutput =
  | { readonly status: "cancelled" }
  | { readonly status: "completed"; readonly result: OrganizationCommitOutput };

export function selectCategoryOrganizationActions(
  snapshot: {
    readonly value: unknown;
    readonly context: CategoryOrganizationContext;
  },
): readonly (CategoryAction | { readonly type: "retry" } | {
  readonly type: "cancel";
})[] {
  const mode = typeof snapshot.value === "string" ? snapshot.value : "";
  if (mode === "mutating") return [{ type: "cancel" }];
  if (mode === "ready" || mode === "failed") {
    const actions = snapshot.context.state === null
      ? []
      : selectCategoryActions(snapshot.context.state);
    return [
      ...actions,
      ...(mode === "failed" ? [{ type: "retry" } as const] : []),
      { type: "cancel" },
    ];
  }
  return [];
}

export function createCategoryOrganizationMachine(
  service: ProjectCategoryService,
) {
  const machineSetup = setup({
    types: {
      context: {} as CategoryOrganizationContext,
      events: {} as CategoryOrganizationEvent,
      output: {} as CategoryOrganizationOutput,
    },
    actors: {
      commitCategory: fromPromise(
        async ({ input }: { input: CategoryOrganizationCommand }) =>
          await service.commitCategory(input),
      ),
    },
  });

  return machineSetup.createMachine({
    id: "category-organization",
    initial: "closed",
    context: { state: null, pending: null, result: null, error: null },
    states: {
      closed: {
        on: {
          "category.open": {
            target: "ready",
            actions: assign({
              state: ({ event }) => event.state,
              pending: () => null,
              result: () => null,
              error: () => null,
            }),
          },
        },
      },
      ready: {
        tags: ["ready"],
        on: {
          "category.open": {
            target: "ready",
            actions: assign({
              state: ({ event }) => event.state,
              pending: () => null,
              result: () => null,
              error: () => null,
            }),
          },
          "category.command": {
            target: "mutating",
            actions: assign({
              pending: ({ event }) => event.command,
              error: () => null,
            }),
          },
          "category.cancel": "cancelled",
        },
      },
      mutating: {
        tags: ["saving"],
        invoke: {
          src: "commitCategory",
          input: ({ context }) => context.pending!,
          onDone: {
            target: "ready",
            actions: assign({
              state: ({ event }) => event.output.state,
              result: ({ event }) => event.output,
              pending: () => null,
              error: () => null,
            }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                actorFailure(event.error, {
                  code: "unknown",
                  message: "Category change failed.",
                  retryable: true,
                }),
            }),
          },
        },
        on: { "category.cancel": "cancelled" },
      },
      failed: {
        tags: ["error"],
        on: {
          "category.open": {
            target: "ready",
            actions: assign({
              state: ({ event }) => event.state,
              pending: () => null,
              result: () => null,
              error: () => null,
            }),
          },
          "category.retry": "mutating",
          "category.command": {
            target: "mutating",
            actions: assign({
              pending: ({ event }) => event.command,
              error: () => null,
            }),
          },
          "category.cancel": "cancelled",
        },
      },
      cancelled: {
        type: "final",
        output: () => ({ status: "cancelled" }),
      },
    },
  });
}

export { createProjectCategoryService };
