import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import {
  type CategoryCommand,
  type ContractFailure,
  contractFailureFromError,
  type ProjectCategoryCommitOutput,
  type ProjectCommand,
} from "./types.ts";
import type { Category, Project } from "../../domain/index.ts";

export type ProjectActorEvent =
  | {
    readonly type: "project.open";
    readonly projects: readonly Project[];
    readonly selectedProjectId?: string;
  }
  | { readonly type: "project.command"; readonly command: ProjectCommand }
  | { readonly type: "project.retry" }
  | { readonly type: "project.cancel" };

export type CategoryActorEvent =
  | { readonly type: "category.open"; readonly categories: readonly Category[] }
  | { readonly type: "category.command"; readonly command: CategoryCommand }
  | { readonly type: "category.retry" }
  | { readonly type: "category.cancel" };

type ProjectContext = {
  readonly projects: readonly Project[];
  readonly selectedProjectId?: string;
  readonly pendingCommand: ProjectCommand | null;
  readonly result: ProjectCategoryCommitOutput | null;
  readonly error: ContractFailure | null;
};

type CategoryContext = {
  readonly categories: readonly Category[];
  readonly pendingCommand: CategoryCommand | null;
  readonly result: ProjectCategoryCommitOutput | null;
  readonly error: ContractFailure | null;
};

const projectSetup = setup({
  types: {
    context: {} as ProjectContext,
    events: {} as ProjectActorEvent,
    output: {} as ProjectCategoryCommitOutput,
  },
  actors: {
    commitProject: unwiredPort<ProjectCommand, ProjectCategoryCommitOutput>(
      "project repository command",
    ),
  },
});

export const projectMachine = projectSetup.createMachine({
  id: "project-organization",
  initial: "closed",
  context: {
    projects: [],
    selectedProjectId: undefined,
    pendingCommand: null,
    result: null,
    error: null,
  },
  states: {
    closed: {
      on: {
        "project.open": {
          target: "ready",
          actions: assign({
            projects: ({ event }) => event.projects,
            selectedProjectId: ({ event }) => event.selectedProjectId,
            error: () => null,
          }),
        },
      },
    },
    ready: {
      tags: ["ready"],
      on: {
        "project.command": {
          target: "mutating",
          actions: assign({
            pendingCommand: ({ event }) => event.command,
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
        input: ({ context }) => context.pendingCommand!,
        onDone: {
          target: "ready",
          actions: assign({
            projects: ({ event }) => event.output.projects,
            selectedProjectId: ({ event }) => event.output.selectedProjectId,
            result: ({ event }) => event.output,
            pendingCommand: () => null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
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
        "project.retry": "mutating",
        "project.command": {
          target: "mutating",
          actions: assign({
            pendingCommand: ({ event }) => event.command,
            error: () => null,
          }),
        },
        "project.cancel": "cancelled",
      },
    },
    cancelled: { type: "final", output: ({ context }) => context.result! },
  },
});

const categorySetup = setup({
  types: {
    context: {} as CategoryContext,
    events: {} as CategoryActorEvent,
    output: {} as ProjectCategoryCommitOutput,
  },
  actors: {
    commitCategory: unwiredPort<CategoryCommand, ProjectCategoryCommitOutput>(
      "category repository command",
    ),
  },
});

export const categoryMachine = categorySetup.createMachine({
  id: "category-organization",
  initial: "closed",
  context: {
    categories: [],
    pendingCommand: null,
    result: null,
    error: null,
  },
  states: {
    closed: {
      on: {
        "category.open": {
          target: "ready",
          actions: assign({
            categories: ({ event }) => event.categories,
            error: () => null,
          }),
        },
      },
    },
    ready: {
      tags: ["ready"],
      on: {
        "category.command": {
          target: "mutating",
          actions: assign({
            pendingCommand: ({ event }) => event.command,
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
        input: ({ context }) => context.pendingCommand!,
        onDone: {
          target: "ready",
          actions: assign({
            categories: ({ event }) => event.output.categories,
            result: ({ event }) => event.output,
            pendingCommand: () => null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
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
        "category.retry": "mutating",
        "category.command": {
          target: "mutating",
          actions: assign({
            pendingCommand: ({ event }) => event.command,
            error: () => null,
          }),
        },
        "category.cancel": "cancelled",
      },
    },
    cancelled: { type: "final", output: ({ context }) => context.result! },
  },
});
