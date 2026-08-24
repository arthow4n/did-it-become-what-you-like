import { assign, sendTo, setup } from "xstate";
import { unwiredPort } from "./ports.ts";

export type DurableDraft = {
  readonly workflowId: string;
  readonly revision: number;
  readonly payload: Record<string, unknown>;
};

export type DurableWorkflowContext = {
  readonly persistenceKey: string;
  readonly draft: DurableDraft | null;
  readonly lastError: string | null;
  readonly outcome: DurableWorkflowOutput | null;
};

export type DurableWorkflowInput = {
  readonly persistenceKey: string;
  readonly initialDraft?: DurableDraft;
};

export type DurableWorkflowEvent =
  | { readonly type: "workflow.start"; readonly draft: DurableDraft }
  | { readonly type: "workflow.change"; readonly draft: DurableDraft }
  | { readonly type: "workflow.hydrate" }
  | { readonly type: "workflow.complete" }
  | { readonly type: "workflow.cancel" }
  | { readonly type: "workflow.discard" }
  | { readonly type: "workflow.retry" };

export type DurableWorkflowOutput =
  | { readonly status: "completed"; readonly revision: number }
  | { readonly status: "cancelled"; readonly revision: number }
  | { readonly status: "discarded"; readonly revision: number };

type PersistInput = {
  readonly key: string;
  readonly draft: DurableDraft;
};

type PersistOutput = { readonly revision: number };
type HydrateInput = { readonly key: string };

const workflowSetup = setup({
  types: {
    context: {} as DurableWorkflowContext,
    events: {} as DurableWorkflowEvent,
    output: {} as DurableWorkflowOutput,
    input: {} as DurableWorkflowInput | undefined,
  },
  actors: {
    persistSnapshot: unwiredPort<PersistInput, PersistOutput>(
      "workflow snapshot persistence",
    ),
    hydrateSnapshot: unwiredPort<HydrateInput, DurableDraft | null>(
      "workflow snapshot hydration",
    ),
  },
  guards: {
    hasDraft: ({ event }) =>
      event.type === "workflow.start" || event.type === "workflow.change",
    hasInitialDraft: ({ context }) => context.draft !== null,
  },
});

export const durableWorkflowMachine = workflowSetup.createMachine({
  id: "durable-workflow",
  initial: "idle",
  context: ({ input }) => ({
    persistenceKey: input?.persistenceKey ?? "",
    draft: input?.initialDraft ?? null,
    lastError: null,
    outcome: null,
  }),
  states: {
    idle: {
      always: { target: "editing", guard: "hasInitialDraft" },
      on: {
        "workflow.start": {
          target: "editing",
          actions: assign({
            draft: ({ event }) => event.draft,
            lastError: () => null,
          }),
        },
        "workflow.hydrate": "hydrating",
      },
    },
    hydrating: {
      tags: ["loading"],
      invoke: {
        src: "hydrateSnapshot",
        input: ({ context }) => ({ key: context.persistenceKey }),
        onDone: {
          target: "hydrated",
          actions: assign({
            draft: ({ event }) => event.output,
            lastError: () => null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            lastError: () => "Unable to restore workflow draft.",
          }),
        },
      },
    },
    hydrated: {
      tags: ["persisted"],
      on: {
        "workflow.change": {
          target: "persisting",
          actions: assign({
            draft: ({ event }) => event.draft,
            lastError: () => null,
          }),
        },
        "workflow.complete": {
          target: "completed",
          actions: assign({
            outcome: ({ context }) => ({
              status: "completed",
              revision: context.draft?.revision ?? 0,
            }),
          }),
        },
        "workflow.cancel": {
          target: "cancelled",
          actions: assign({
            outcome: ({ context }) => ({
              status: "cancelled",
              revision: context.draft?.revision ?? 0,
            }),
          }),
        },
        "workflow.discard": {
          target: "discarded",
          actions: assign({
            outcome: ({ context }) => ({
              status: "discarded",
              revision: context.draft?.revision ?? 0,
            }),
          }),
        },
      },
    },
    editing: {
      tags: ["dirty"],
      on: {
        "workflow.change": {
          target: "persisting",
          actions: assign({
            draft: ({ event }) => event.draft,
            lastError: () => null,
          }),
        },
        "workflow.complete": {
          target: "completed",
          actions: assign({
            outcome: ({ context }) => ({
              status: "completed",
              revision: context.draft?.revision ?? 0,
            }),
          }),
        },
        "workflow.cancel": {
          target: "cancelled",
          actions: assign({
            outcome: ({ context }) => ({
              status: "cancelled",
              revision: context.draft?.revision ?? 0,
            }),
          }),
        },
        "workflow.discard": {
          target: "discarded",
          actions: assign({
            outcome: ({ context }) => ({
              status: "discarded",
              revision: context.draft?.revision ?? 0,
            }),
          }),
        },
      },
    },
    persisting: {
      tags: ["saving"],
      invoke: {
        src: "persistSnapshot",
        input: ({ context }) => ({
          key: context.persistenceKey,
          draft: context.draft!,
        }),
        onDone: {
          target: "hydrated",
          actions: assign({
            lastError: () => null,
            draft: ({ context, event }) => ({
              ...context.draft!,
              revision: event.output.revision,
            }),
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            lastError: () => "Unable to persist workflow draft.",
          }),
        },
      },
      on: {
        "workflow.cancel": {
          target: "cancelled",
          actions: assign({
            outcome: ({ context }) => ({
              status: "cancelled",
              revision: context.draft?.revision ?? 0,
            }),
          }),
        },
      },
    },
    failed: {
      tags: ["error"],
      on: {
        "workflow.retry": "persisting",
        "workflow.change": {
          target: "persisting",
          actions: assign({
            draft: ({ event }) => event.draft,
            lastError: () => null,
          }),
        },
        "workflow.cancel": {
          target: "cancelled",
          actions: assign({
            outcome: ({ context }) => ({
              status: "cancelled",
              revision: context.draft?.revision ?? 0,
            }),
          }),
        },
        "workflow.discard": {
          target: "discarded",
          actions: assign({
            outcome: ({ context }) => ({
              status: "discarded",
              revision: context.draft?.revision ?? 0,
            }),
          }),
        },
      },
    },
    completed: { type: "final" },
    cancelled: { type: "final" },
    discarded: { type: "final" },
  },
  output: ({ context }) => context.outcome!,
});

export type WorkflowHostEvent =
  | { readonly type: "host.open"; readonly draft: DurableDraft }
  | { readonly type: "host.complete" }
  | { readonly type: "host.cancel" };

type WorkflowHostContext = {
  readonly result: DurableWorkflowOutput | null;
  readonly outcome: WorkflowHostOutput | null;
};

export type WorkflowHostOutput =
  | { readonly status: "completed"; readonly result: DurableWorkflowOutput }
  | { readonly status: "cancelled" };

const workflowHostSetup = setup({
  types: {
    context: {} as WorkflowHostContext,
    events: {} as WorkflowHostEvent,
    output: {} as WorkflowHostOutput,
  },
  actors: { durableChild: durableWorkflowMachine },
});

/** A small parent shell proving that child completion and cancellation are owned by the parent. */
export const workflowHostMachine = workflowHostSetup.createMachine({
  id: "workflow-host",
  initial: "closed",
  context: { result: null, outcome: null },
  states: {
    closed: {
      on: {
        "host.open": {
          target: "active",
          actions: assign({ result: () => null, outcome: () => null }),
        },
      },
    },
    active: {
      invoke: {
        id: "durable-child",
        src: "durableChild",
        input: ({ event }) =>
          event.type === "host.open"
            ? { persistenceKey: "workflow-host", initialDraft: event.draft }
            : { persistenceKey: "workflow-host" },
        onDone: {
          target: "completed",
          actions: assign({
            result: ({ event }) => event.output,
            outcome: ({ event }) => ({
              status: "completed",
              result: event.output,
            }),
          }),
        },
      },
      on: {
        "host.complete": {
          actions: sendTo("durable-child", { type: "workflow.complete" }),
        },
        "host.cancel": {
          target: "cancelled",
          actions: assign({ outcome: () => ({ status: "cancelled" }) }),
        },
      },
    },
    completed: { type: "final" },
    cancelled: { type: "final" },
  },
  output: ({ context }) => context.outcome!,
});
