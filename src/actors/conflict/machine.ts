import { assign, createActor, fromPromise, setup } from "xstate";
import {
  type ContractFailure,
  contractFailureFromError,
} from "../contracts/types.ts";
import type {
  ConflictObservation,
  ConflictResolutionRequest,
  ConflictState,
} from "../../domain/conflict/types.ts";
import { emptyConflictState } from "../../domain/conflict/types.ts";
import type { ConflictResolutionResult } from "../../domain/conflict/types.ts";
import {
  type ConflictHydration,
  ConflictStore,
  type ConflictStoreOptions,
  type ConflictWorkflowSnapshot,
} from "./store.ts";

export type ConflictActorInput = {
  readonly observations?: readonly ConflictObservation[];
};

export type ConflictActorDependencies = ConflictStoreOptions;

export type ConflictActorEvent =
  | { readonly type: "conflict.open"; readonly groupId: string }
  | {
    readonly type: "conflict.choose-candidate";
    readonly candidateId: string;
  }
  | {
    readonly type: "conflict.choose-custom";
    readonly value: Extract<
      ConflictResolutionRequest,
      { choice: "custom" }
    >["value"];
  }
  | { readonly type: "conflict.keep-edited" }
  | { readonly type: "conflict.delete-record" }
  | { readonly type: "conflict.submit" }
  | { readonly type: "conflict.retry" }
  | { readonly type: "conflict.cancel" }
  | {
    readonly type: "conflict.refresh";
    readonly observations?: readonly ConflictObservation[];
  }
  | { readonly type: "conflict.resync"; readonly state: ConflictState };

type ConflictActorContext = {
  readonly state: ConflictState;
  readonly activeGroupId: string | null;
  readonly selection: ConflictWorkflowSnapshot["selection"];
  readonly pendingObservations: readonly ConflictObservation[];
  readonly pendingRemote: ConflictState | null;
  readonly result: ConflictResolutionResult | null;
  readonly error: ContractFailure | null;
};

type HydrateOutput = ConflictHydration;
type CommitOutput = {
  readonly result: ConflictResolutionResult;
  readonly hydration: ConflictHydration;
};

function failureFromError(error: unknown, message: string): ContractFailure {
  return contractFailureFromError(error, {
    code: "unknown",
    message,
    retryable: true,
  });
}

export function createConflictMachine(
  dependencies: ConflictActorDependencies,
) {
  const store = new ConflictStore(dependencies);
  const conflictSetup = setup({
    types: {
      context: {} as ConflictActorContext,
      events: {} as ConflictActorEvent,
      input: {} as ConflictActorInput | undefined,
    },
    actors: {
      hydrate: fromPromise(
        async ({ input }: { input: ConflictActorInput | undefined }) => {
          const hydration = await store.load();
          const observations = input?.observations ?? [];
          if (observations.length === 0) return hydration;
          const state = await store.ingest(observations);
          return {
            ...hydration,
            state,
            activeGroupId: null,
            selection: null,
          } satisfies HydrateOutput;
        },
      ),
      persistWorkflow: fromPromise(
        async ({ input }: {
          input: {
            readonly state: ConflictState;
            readonly activeGroupId: string | null;
            readonly selection: ConflictWorkflowSnapshot["selection"];
          };
        }) => await store.saveWorkflow(input),
      ),
      commit: fromPromise(
        async ({ input }: {
          input: {
            readonly groupId: string;
            readonly request: ConflictResolutionRequest;
          };
        }): Promise<CommitOutput> => {
          const result = await store.commit(input);
          return { result, hydration: await store.load() };
        },
      ),
      reconcile: fromPromise(
        async ({ input }: { input: ConflictState }) =>
          await store.reconcile(input),
      ),
      persistFailure: fromPromise(
        async ({ input }: {
          input: {
            readonly state: ConflictState;
            readonly activeGroupId: string | null;
            readonly selection: ConflictWorkflowSnapshot["selection"];
            readonly failureCode: string;
          };
        }) => await store.saveWorkflow(input),
      ),
    },
    guards: {
      hasGroups: ({ context }) => context.state.groups.length > 0,
      hasSelection: ({ context }) => context.selection !== null,
      hasActiveGroup: ({ context }) => context.activeGroupId !== null,
    },
  });

  return conflictSetup.createMachine({
    id: "s403-conflict",
    initial: "loading",
    context: ({ input }) => ({
      state: emptyConflictState(dependencies.now()),
      activeGroupId: null,
      selection: null,
      pendingObservations: input?.observations ?? [],
      pendingRemote: null,
      result: null,
      error: null,
    }),
    states: {
      loading: {
        tags: ["loading"],
        invoke: {
          src: "hydrate",
          input: ({ context }) => ({
            observations: context.pendingObservations,
          }),
          onDone: [
            {
              target: "reviewing",
              guard: ({ event }) => event.output.state.groups.length > 0,
              actions: assign({
                state: ({ event }) => event.output.state,
                activeGroupId: ({ event }) => event.output.activeGroupId,
                selection: ({ event }) => event.output.selection,
                pendingObservations: () => [],
                error: () => null,
              }),
            },
            {
              target: "idle",
              actions: assign({
                state: ({ event }) => event.output.state,
                activeGroupId: ({ event }) => event.output.activeGroupId,
                selection: ({ event }) => event.output.selection,
                pendingObservations: () => [],
                error: () => null,
              }),
            },
          ],
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                failureFromError(
                  event.error,
                  "Conflict state could not be loaded.",
                ),
            }),
          },
        },
      },
      idle: {
        on: {
          "conflict.refresh": {
            target: "loading",
            actions: assign({
              pendingObservations: ({ event }) => event.observations ?? [],
              error: () => null,
            }),
          },
          "conflict.resync": {
            target: "reconciling",
            actions: assign({
              pendingRemote: ({ event }) => event.state,
              error: () => null,
            }),
          },
          "conflict.cancel": "idle",
        },
      },
      reviewing: {
        tags: ["reviewing"],
        on: {
          "conflict.open": {
            actions: assign({
              activeGroupId: ({ event }) => event.groupId,
              selection: () => null,
              error: () => null,
            }),
          },
          "conflict.choose-candidate": [
            {
              guard: "hasActiveGroup",
              target: "persisting",
              actions: assign({
                selection: ({ context, event }) => ({
                  groupId: context.activeGroupId!,
                  choice: "candidate",
                  candidateId: event.candidateId,
                }),
                error: () => null,
              }),
            },
          ],
          "conflict.choose-custom": {
            target: "persisting",
            guard: "hasActiveGroup",
            actions: assign({
              selection: ({ context, event }) => ({
                groupId: context.activeGroupId!,
                choice: "custom",
                value: event.value,
              }),
              error: () => null,
            }),
          },
          "conflict.keep-edited": {
            target: "persisting",
            guard: "hasActiveGroup",
            actions: assign({
              selection: ({ context }) => ({
                groupId: context.activeGroupId!,
                choice: "keep-edited",
              }),
              error: () => null,
            }),
          },
          "conflict.delete-record": {
            target: "persisting",
            guard: "hasActiveGroup",
            actions: assign({
              selection: ({ context }) => ({
                groupId: context.activeGroupId!,
                choice: "delete",
              }),
              error: () => null,
            }),
          },
          "conflict.submit": {
            target: "committing",
            guard: "hasSelection",
          },
          "conflict.refresh": {
            target: "loading",
            actions: assign({
              pendingObservations: ({ event }) => event.observations ?? [],
              error: () => null,
            }),
          },
          "conflict.resync": {
            target: "reconciling",
            actions: assign({
              pendingRemote: ({ event }) => event.state,
              error: () => null,
            }),
          },
          "conflict.cancel": {
            target: "idle",
            actions: assign({
              activeGroupId: () => null,
              selection: () => null,
            }),
          },
        },
      },
      persisting: {
        tags: ["saving"],
        invoke: {
          src: "persistWorkflow",
          input: ({ context }) => ({
            state: context.state,
            activeGroupId: context.activeGroupId,
            selection: context.selection,
          }),
          onDone: {
            target: "reviewing",
            actions: assign({
              state: ({ event }) => event.output,
              error: () => null,
            }),
          },
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                failureFromError(
                  event.error,
                  "Conflict selection could not be saved.",
                ),
            }),
          },
        },
      },
      committing: {
        tags: ["saving"],
        invoke: {
          src: "commit",
          input: ({ context }) => ({
            groupId: context.activeGroupId!,
            request: context.selection!,
          }),
          onDone: [
            {
              target: "resolved",
              guard: ({ event }) =>
                event.output.hydration.state.groups.length === 0,
              actions: assign({
                state: ({ event }) => event.output.hydration.state,
                result: ({ event }) => event.output.result,
                activeGroupId: () => null,
                selection: () => null,
                error: () => null,
              }),
            },
            {
              target: "reviewing",
              actions: assign({
                state: ({ event }) => event.output.hydration.state,
                result: ({ event }) => event.output.result,
                activeGroupId: () => null,
                selection: () => null,
                error: () => null,
              }),
            },
          ],
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                failureFromError(
                  event.error,
                  "Resolution was not committed locally.",
                ),
            }),
          },
        },
      },
      reconciling: {
        tags: ["loading"],
        invoke: {
          src: "reconcile",
          input: ({ context }) => context.pendingRemote!,
          onDone: [
            {
              target: "reviewing",
              guard: ({ event }) => event.output.groups.length > 0,
              actions: assign({
                state: ({ event }) => event.output,
                pendingRemote: () => null,
                error: () => null,
              }),
            },
            {
              target: "idle",
              actions: assign({
                state: ({ event }) => event.output,
                pendingRemote: () => null,
                error: () => null,
              }),
            },
          ],
          onError: {
            target: "failed",
            actions: assign({
              error: ({ event }) =>
                failureFromError(
                  event.error,
                  "Conflict resync could not be applied.",
                ),
            }),
          },
        },
      },
      failed: {
        tags: ["error"],
        invoke: {
          src: "persistFailure",
          input: ({ context }) => ({
            state: context.state,
            activeGroupId: context.activeGroupId,
            selection: context.selection,
            failureCode: context.error?.code ?? "unknown",
          }),
          onDone: {
            actions: assign({ state: ({ event }) => event.output }),
          },
        },
        on: {
          "conflict.retry": {
            target: "committing",
            guard: "hasSelection",
            actions: assign({ error: () => null }),
          },
          "conflict.refresh": {
            target: "loading",
            actions: assign({
              pendingObservations: ({ event }) => event.observations ?? [],
              error: () => null,
            }),
          },
          "conflict.resync": {
            target: "reconciling",
            actions: assign({
              pendingRemote: ({ event }) => event.state,
              error: () => null,
            }),
          },
          "conflict.cancel": {
            target: "idle",
            actions: assign({
              activeGroupId: () => null,
              selection: () => null,
            }),
          },
        },
      },
      resolved: {
        tags: ["resolved"],
        on: {
          "conflict.refresh": {
            target: "loading",
            actions: assign({
              pendingObservations: ({ event }) => event.observations ?? [],
              error: () => null,
            }),
          },
          "conflict.resync": {
            target: "reconciling",
            actions: assign({
              pendingRemote: ({ event }) => event.state,
              error: () => null,
            }),
          },
          "conflict.cancel": "idle",
        },
      },
    },
  });
}

export function createConflictActor(
  dependencies: ConflictActorDependencies,
  input?: ConflictActorInput,
) {
  return createActor(createConflictMachine(dependencies), { input });
}
