import { assign, createActor, fromPromise, setup, type Snapshot } from "xstate";
import type {
  CausalSyncPort,
  ClockPort,
  IdPort,
  LocalPort,
  OnlineState,
  SyncConflict,
} from "../../adapters/ports/index.ts";
import type { StableId } from "../../domain/index.ts";
import {
  type ContractFailure,
  contractFailureFromError,
  type SyncRequest,
} from "../contracts/index.ts";
import {
  createDeviceRegistry,
  type DeviceRegistry,
  type KnownDeviceProjection,
} from "../../adapters/sync/device-registry.ts";
import {
  type CausalExchangeResult,
  runCausalExchange,
} from "../../adapters/sync/coordinator.ts";

export type SyncActorDependencies = {
  readonly local: LocalPort;
  readonly causal: CausalSyncPort;
  readonly registry: DeviceRegistry;
  readonly deviceId: StableId;
  readonly ids: Pick<IdPort, "next">;
  readonly clock: Pick<ClockPort, "now">;
  readonly initialNetwork?: OnlineState;
};

export type SyncActorEvent =
  | {
    readonly type: "sync.configure";
    readonly accountEmail: string;
    readonly online: boolean;
  }
  | { readonly type: "sync.connect" }
  | { readonly type: "sync.request"; readonly request: SyncRequest }
  | { readonly type: "sync.reconnect" }
  | { readonly type: "sync.retry" }
  | { readonly type: "sync.network.offline" }
  | { readonly type: "sync.network.online" }
  | { readonly type: "sync.disconnect" }
  | { readonly type: "sync.account.confirm" }
  | { readonly type: "sync.account.cancel" }
  | { readonly type: "sync.retire" }
  | { readonly type: "sync.resolve-conflicts" };

export type SyncActorContext = {
  readonly accountEmail: string | null;
  readonly online: boolean;
  readonly pendingRequest: SyncRequest | null;
  readonly queued: boolean;
  readonly pendingChangeCount: number;
  readonly unresolvedConflictCount: number;
  readonly conflicts: readonly SyncConflict[];
  readonly lastSyncedAt: string | null;
  readonly error: ContractFailure | null;
  readonly pendingAccountEmail: string | null;
  readonly pendingAccountOnline: boolean;
  readonly confirmAccountSwitch: boolean;
  readonly knownDevices: readonly KnownDeviceProjection[];
};

export type SyncActorOutput = { readonly status: "retired" };

type HydrateOutput = {
  readonly accountEmail: string | null;
  readonly knownDevices: readonly KnownDeviceProjection[];
};

type ConfigureOutput = "configured" | "confirmation-required";

function errorCode(error: unknown): unknown {
  return error !== null && typeof error === "object" && "code" in error
    ? (error as { readonly code?: unknown }).code
    : undefined;
}

function syncFailure(error: unknown): ContractFailure {
  return contractFailureFromError(error, {
    code: "unknown",
    message: "Synchronization failed.",
    retryable: true,
  });
}

function makeInitialContext(
  dependencies: SyncActorDependencies,
): SyncActorContext {
  return {
    accountEmail: null,
    online: dependencies.initialNetwork !== "offline",
    pendingRequest: null,
    queued: false,
    pendingChangeCount: 0,
    unresolvedConflictCount: 0,
    conflicts: [],
    lastSyncedAt: null,
    error: null,
    pendingAccountEmail: null,
    pendingAccountOnline: false,
    confirmAccountSwitch: false,
    knownDevices: dependencies.registry.ordinaryProjection(),
  };
}

export function createSyncMachine(dependencies: SyncActorDependencies) {
  const syncSetup = setup({
    types: {
      context: {} as SyncActorContext,
      events: {} as SyncActorEvent,
      input: {} as SyncActorDependencies | undefined,
      output: {} as SyncActorOutput,
    },
    actors: {
      hydrate: fromPromise(
        async (
          { input }: { input: SyncActorDependencies },
        ): Promise<HydrateOutput> => {
          const state = await input.registry.hydrate();
          return {
            accountEmail: state.accountEmail,
            knownDevices: input.registry.ordinaryProjection(),
          };
        },
      ),
      configureAccount: fromPromise(
        async ({ input }: {
          input: {
            readonly accountEmail: string;
            readonly confirmed: boolean;
          };
        }): Promise<ConfigureOutput> =>
          await dependencies.registry.configureAccount(
            input.accountEmail,
            input.confirmed,
          ),
      ),
      runSync: fromPromise(
        async ({ input, signal }: {
          input: SyncActorDependencies;
          signal: AbortSignal;
        }): Promise<CausalExchangeResult> => {
          const result = await runCausalExchange(
            {
              local: input.local,
              remote: input.causal,
              deviceId: input.deviceId,
              ids: input.ids,
              now: input.clock.now,
              deviceRecords: input.registry.portableDevices,
            },
            { signal },
          );
          await input.registry.merge(result.snapshot.dataset.devices);
          await input.registry.touch();
          return result;
        },
      ),
    },
    guards: {
      isConfigured: ({ context }) => context.accountEmail !== null,
      isOnline: ({ context }) => context.online,
      isQueued: ({ context }) => context.queued,
      requestedOnline: ({ context }) => context.pendingAccountOnline,
      hasPendingRequest: ({ context }) => context.pendingRequest !== null,
    },
  });

  return syncSetup.createMachine({
    id: "s402-sync",
    initial: "hydrating",
    context: ({ input }) => makeInitialContext(input ?? dependencies),
    output: () => ({ status: "retired" }),
    states: {
      hydrating: {
        tags: ["loading"],
        invoke: {
          src: "hydrate",
          input: () => dependencies,
          onDone: {
            target: "hydrated",
            actions: assign({
              accountEmail: ({ event }) => event.output.accountEmail,
              knownDevices: ({ event }) => event.output.knownDevices,
              error: () => null,
            }),
          },
          onError: {
            target: "error",
            actions: assign({ error: ({ event }) => syncFailure(event.error) }),
          },
        },
      },
      hydrated: {
        always: [
          {
            target: "idle",
            guard: ({ context }) =>
              context.accountEmail !== null && context.online,
          },
          { target: "offline", guard: "isConfigured" },
          { target: "unconfigured" },
        ],
      },
      unconfigured: {
        tags: ["unconfigured"],
        on: {
          "sync.configure": {
            target: "configuring",
            actions: assign({
              pendingAccountEmail: ({ event }) => event.accountEmail,
              pendingAccountOnline: ({ event }) => event.online,
              confirmAccountSwitch: () => false,
              error: () => null,
            }),
          },
          "sync.connect": "unconfigured",
          "sync.retire": "retired",
        },
      },
      configuring: {
        tags: ["loading"],
        invoke: {
          src: "configureAccount",
          input: ({ context }) => ({
            accountEmail: context.pendingAccountEmail ?? "",
            confirmed: context.confirmAccountSwitch,
          }),
          onDone: [
            {
              target: "accountSwitchConfirmation",
              guard: ({ event }) => event.output === "confirmation-required",
            },
            {
              target: "idle",
              guard: "requestedOnline",
              actions: assign({
                accountEmail: ({ context }) => context.pendingAccountEmail,
                online: () => true,
                pendingAccountEmail: () => null,
                confirmAccountSwitch: () => false,
                error: () => null,
              }),
            },
            {
              target: "offline",
              actions: assign({
                accountEmail: ({ context }) => context.pendingAccountEmail,
                online: () => false,
                pendingAccountEmail: () => null,
                confirmAccountSwitch: () => false,
                error: () => null,
              }),
            },
          ],
          onError: {
            target: "error",
            actions: assign({ error: ({ event }) => syncFailure(event.error) }),
          },
        },
      },
      accountSwitchConfirmation: {
        tags: ["confirmation-required"],
        on: {
          "sync.account.confirm": {
            target: "configuring",
            actions: assign({ confirmAccountSwitch: () => true }),
          },
          "sync.account.cancel": [
            { target: "idle", guard: "isOnline" },
            { target: "offline" },
          ],
          "sync.disconnect": "unconfigured",
          "sync.retire": "retired",
        },
      },
      idle: {
        tags: ["idle"],
        on: {
          "sync.configure": {
            target: "configuring",
            actions: assign({
              pendingAccountEmail: ({ event }) => event.accountEmail,
              pendingAccountOnline: ({ event }) => event.online,
              confirmAccountSwitch: () => false,
            }),
          },
          "sync.request": {
            target: "synchronizing",
            actions: assign({
              pendingRequest: ({ event }) => event.request,
              queued: () => false,
              error: () => null,
            }),
          },
          "sync.reconnect": {
            target: "synchronizing",
            actions: assign({
              pendingRequest: () => ({ reason: "reconnect" }),
              queued: () => false,
              error: () => null,
            }),
          },
          "sync.connect": { actions: assign({ online: () => true }) },
          "sync.network.offline": {
            target: "offline",
            actions: assign({ online: () => false }),
          },
          "sync.disconnect": {
            target: "unconfigured",
            actions: assign({ accountEmail: () => null }),
          },
          "sync.retire": "retired",
        },
      },
      offline: {
        tags: ["offline"],
        on: {
          "sync.configure": {
            target: "configuring",
            actions: assign({
              pendingAccountEmail: ({ event }) => event.accountEmail,
              pendingAccountOnline: ({ event }) => event.online,
              confirmAccountSwitch: () => false,
            }),
          },
          "sync.network.online": [
            {
              target: "synchronizing",
              guard: "hasPendingRequest",
              actions: assign({ online: () => true, queued: () => false }),
            },
            { target: "idle", actions: assign({ online: () => true }) },
          ],
          "sync.connect": {
            target: "idle",
            actions: assign({ online: () => true }),
          },
          "sync.reconnect": {
            target: "synchronizing",
            actions: assign({
              online: () => true,
              pendingRequest: () => ({ reason: "reconnect" }),
              queued: () => false,
            }),
          },
          "sync.request": {
            actions: assign({ pendingRequest: ({ event }) => event.request }),
          },
          "sync.disconnect": {
            target: "unconfigured",
            actions: assign({ accountEmail: () => null }),
          },
          "sync.retire": "retired",
        },
      },
      synchronizing: {
        tags: ["syncing"],
        invoke: {
          src: "runSync",
          input: () => dependencies,
          onDone: [
            {
              target: "synchronizing",
              reenter: true,
              guard: "isQueued",
              actions: assign({
                ...{
                  pendingChangeCount: ({ event }) =>
                    event.output.pendingChangeCount,
                  unresolvedConflictCount: ({ event }) =>
                    event.output.conflicts.length,
                  conflicts: ({ event }) => event.output.conflicts,
                  lastSyncedAt: ({ event }) => event.output.lastSyncedAt,
                  knownDevices: () =>
                    dependencies.registry.ordinaryProjection(),
                  pendingRequest: () => ({ reason: "local-change" }),
                  queued: () => false,
                  error: () => null,
                },
              }),
            },
            {
              target: "conflict",
              guard: ({ event }) => event.output.conflicts.length > 0,
              actions: assign({
                pendingChangeCount: ({ event }) =>
                  event.output.pendingChangeCount,
                unresolvedConflictCount: ({ event }) =>
                  event.output.conflicts.length,
                conflicts: ({ event }) => event.output.conflicts,
                lastSyncedAt: ({ event }) => event.output.lastSyncedAt,
                knownDevices: () => dependencies.registry.ordinaryProjection(),
                pendingRequest: () => null,
                error: () => null,
              }),
            },
            {
              target: "idle",
              actions: assign({
                pendingChangeCount: ({ event }) =>
                  event.output.pendingChangeCount,
                unresolvedConflictCount: ({ event }) =>
                  event.output.conflicts.length,
                conflicts: ({ event }) => event.output.conflicts,
                lastSyncedAt: ({ event }) => event.output.lastSyncedAt,
                knownDevices: () => dependencies.registry.ordinaryProjection(),
                pendingRequest: () => null,
                error: () => null,
              }),
            },
          ],
          onError: [
            {
              target: "retired",
              guard: ({ event }) => errorCode(event.error) === "retired",
              actions: assign({
                error: ({ event }) => syncFailure(event.error),
              }),
            },
            {
              target: "retryableError",
              guard: ({ event }) => syncFailure(event.error).retryable,
              actions: assign({
                error: ({ event }) => syncFailure(event.error),
              }),
            },
            {
              target: "error",
              actions: assign({
                error: ({ event }) => syncFailure(event.error),
              }),
            },
          ],
        },
        on: {
          "sync.request": {
            actions: assign({
              pendingRequest: ({ event }) => event.request,
              queued: () => true,
            }),
          },
          "sync.reconnect": {
            actions: assign({
              pendingRequest: () => ({ reason: "reconnect" }),
              queued: () => true,
            }),
          },
          "sync.network.offline": {
            target: "offline",
            actions: assign({ online: () => false }),
          },
          "sync.disconnect": {
            target: "unconfigured",
            actions: assign({ accountEmail: () => null, queued: () => false }),
          },
          "sync.retire": "retired",
        },
      },
      conflict: {
        tags: ["conflict"],
        on: {
          "sync.request": {
            target: "synchronizing",
            actions: assign({
              pendingRequest: ({ event }) => event.request,
              queued: () => false,
            }),
          },
          "sync.resolve-conflicts": {
            target: "idle",
            actions: assign({
              unresolvedConflictCount: () => 0,
              conflicts: () => [],
            }),
          },
          "sync.network.offline": {
            target: "offline",
            actions: assign({ online: () => false }),
          },
          "sync.disconnect": "unconfigured",
          "sync.retire": "retired",
        },
      },
      retryableError: {
        tags: ["error", "retryable"],
        on: {
          "sync.retry": [
            {
              target: "synchronizing",
              guard: "isOnline",
              actions: assign({ error: () => null }),
            },
            { target: "offline" },
          ],
          "sync.network.offline": {
            target: "offline",
            actions: assign({ online: () => false }),
          },
          "sync.connect": {
            target: "idle",
            actions: assign({ online: () => true }),
          },
          "sync.disconnect": "unconfigured",
          "sync.retire": "retired",
        },
      },
      error: {
        tags: ["error"],
        on: {
          "sync.connect": {
            target: "idle",
            actions: assign({ online: () => true, error: () => null }),
          },
          "sync.network.offline": {
            target: "offline",
            actions: assign({ online: () => false }),
          },
          "sync.configure": {
            target: "configuring",
            actions: assign({
              pendingAccountEmail: ({ event }) => event.accountEmail,
              pendingAccountOnline: ({ event }) => event.online,
              confirmAccountSwitch: () => false,
            }),
          },
          "sync.disconnect": "unconfigured",
          "sync.retire": "retired",
        },
      },
      retired: {
        type: "final",
        tags: ["retired"],
      },
    },
  });
}

export function createSyncActor(
  dependencies: SyncActorDependencies,
  snapshot?: Snapshot<unknown>,
) {
  const machine = createSyncMachine(dependencies);
  return createActor(machine, {
    input: dependencies,
    ...(snapshot === undefined ? {} : { snapshot }),
  });
}

export async function hydrateSyncDependencies(
  dependencies: SyncActorDependencies,
): Promise<SyncActorDependencies> {
  await dependencies.registry.hydrate();
  return dependencies;
}

export function createDefaultSyncDependencies(input: {
  readonly local: LocalPort;
  readonly causal: CausalSyncPort;
  readonly deviceId: StableId;
  readonly ids: Pick<IdPort, "next">;
  readonly clock: Pick<ClockPort, "now">;
  readonly initialNetwork?: OnlineState;
}): SyncActorDependencies {
  return {
    ...input,
    registry: createDeviceRegistry({
      local: input.local,
      deviceId: input.deviceId,
      clock: input.clock,
      ids: input.ids,
    }),
  };
}
