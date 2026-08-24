import { assign, fromPromise, setup } from "xstate";
import {
  DRIVE_RETIREMENT_MARKER_NAME,
  type DriveAdapter,
  type DriveRetirementMarker,
} from "../adapters/drive/index.ts";
import type {
  ContractFailure,
  DeleteEverywhereProgress,
} from "./contracts/index.ts";
import {
  contractFailureFromError,
  deleteEverywhereMachine,
} from "./contracts/index.ts";
import {
  clearDeleteEverywhereProgress,
  clearLocalEraseProgress,
  type DeleteEverywhereProgressPhase,
  type DeleteEverywhereProgressRecord,
  type DestructionStorage,
  type LocalEraseFailureOperation,
  type LocalEraseProgressPhase,
  type LocalEraseProgressRecord,
  writeDeleteEverywhereProgress,
  writeLocalEraseGeminiKeyChoice,
  writeLocalEraseProgress,
} from "../domain/destruction.ts";

export type LocalEraseEvent =
  | { readonly type: "local-erase.open"; readonly removeGeminiApiKey: boolean }
  | {
    readonly type: "local-erase.choice";
    readonly removeGeminiApiKey: boolean;
  }
  | { readonly type: "local-erase.confirm" }
  | { readonly type: "local-erase.retry" }
  | { readonly type: "local-erase.reset" }
  | { readonly type: "local-erase.cancel" };

export type LocalEraseContext = {
  readonly removeGeminiApiKey: boolean;
  readonly error: ContractFailure | null;
  readonly failureOperation: LocalEraseFailureOperation | null;
};

export type LocalEraseOutput = {
  readonly status: "completed";
  readonly removeGeminiApiKey: boolean;
};

export type LocalEraseDependencies = {
  readonly storage?: DestructionStorage;
  readonly now?: () => string;
  readonly persistProgress?: (
    progress: Omit<LocalEraseProgressRecord, "version">,
  ) => void | Promise<void>;
  readonly persistChoice?: (
    removeGeminiApiKey: boolean,
  ) => void | Promise<void>;
  readonly eraseLocalDataset: () => Promise<void>;
  readonly removeGeminiApiKey: () => Promise<void>;
};

function failure(
  error: unknown,
  fallback: ContractFailure,
): ContractFailure {
  return contractFailureFromError(error, fallback);
}

function defaultPersistChoice(
  removeGeminiApiKey: boolean,
  storage?: DestructionStorage,
): void {
  writeLocalEraseGeminiKeyChoice(removeGeminiApiKey, storage);
}

function defaultPersistProgress(
  progress: Omit<LocalEraseProgressRecord, "version">,
  storage?: DestructionStorage,
): void {
  writeLocalEraseProgress(progress, storage);
}

async function persistLocalErasePhase(
  dependencies: LocalEraseDependencies,
  phase: LocalEraseProgressPhase,
  removeGeminiApiKey: boolean,
  failureOperation: LocalEraseFailureOperation,
): Promise<void> {
  await (dependencies.persistProgress ??
    ((progress) => defaultPersistProgress(progress, dependencies.storage)))({
      phase,
      removeGeminiApiKey,
      failureOperation,
      updatedAt: dependencies.now?.() ?? new Date().toISOString(),
    });
}

export function createLocalEraseMachine(dependencies: LocalEraseDependencies) {
  const machineSetup = setup({
    types: {
      context: {} as LocalEraseContext,
      events: {} as LocalEraseEvent,
      output: {} as LocalEraseOutput,
    },
    actors: {
      persistChoice: fromPromise(
        async ({ input }: { input: boolean }) => {
          await persistLocalErasePhase(
            dependencies,
            "persisting-choice",
            input,
            "persist-choice",
          );
          await (dependencies.persistChoice ??
            ((choice) => defaultPersistChoice(choice, dependencies.storage)))(
              input,
            );
        },
      ),
      eraseLocalDataset: fromPromise(
        async ({ input }: { input: boolean }) => {
          await persistLocalErasePhase(
            dependencies,
            "erasing-local",
            input,
            "erase-local",
          );
          await dependencies.eraseLocalDataset();
        },
      ),
      removeGeminiApiKey: fromPromise(
        async ({ input }: { input: boolean }) => {
          await persistLocalErasePhase(
            dependencies,
            "removing-key",
            input,
            "remove-key",
          );
          await dependencies.removeGeminiApiKey();
        },
      ),
    },
    guards: {
      shouldRemoveGeminiApiKey: ({ context }) => context.removeGeminiApiKey,
      failedPersistChoice: ({ context }) =>
        context.failureOperation === "persist-choice",
      failedEraseLocal: ({ context }) =>
        context.failureOperation === "erase-local",
      failedRemoveKey: ({ context }) =>
        context.failureOperation === "remove-key",
    },
  });

  return machineSetup.createMachine({
    id: "local-erase",
    initial: "idle",
    context: {
      removeGeminiApiKey: true,
      error: null,
      failureOperation: null,
    },
    states: {
      idle: {
        on: {
          "local-erase.open": {
            target: "reviewing",
            actions: assign({
              removeGeminiApiKey: ({ event }) => event.removeGeminiApiKey,
              error: () => null,
              failureOperation: () => null,
            }),
          },
        },
      },
      reviewing: {
        tags: ["destructive", "reviewing"],
        on: {
          "local-erase.choice": {
            actions: assign({
              removeGeminiApiKey: ({ event }) => event.removeGeminiApiKey,
            }),
          },
          "local-erase.confirm": {
            target: "persistingChoice",
            actions: assign({ error: () => null }),
          },
          "local-erase.cancel": "cancelled",
        },
      },
      persistingChoice: {
        tags: ["destructive", "saving"],
        invoke: {
          src: "persistChoice",
          input: ({ context }) => context.removeGeminiApiKey,
          onDone: "erasingLocal",
          onError: {
            target: "failed",
            actions: assign({
              failureOperation: () => "persist-choice" as const,
              error: ({ event }) =>
                failure(event.error, {
                  code: "unknown",
                  message: "The local erase choice could not be saved.",
                  retryable: true,
                }),
            }),
          },
        },
        on: { "local-erase.cancel": "cancelled" },
      },
      erasingLocal: {
        tags: ["destructive", "saving"],
        invoke: {
          src: "eraseLocalDataset",
          input: ({ context }) => context.removeGeminiApiKey,
          onDone: [
            { target: "removingKey", guard: "shouldRemoveGeminiApiKey" },
            "completed",
          ],
          onError: {
            target: "failed",
            actions: assign({
              failureOperation: () => "erase-local" as const,
              error: ({ event }) =>
                failure(event.error, {
                  code: "unknown",
                  message: "Local data could not be erased.",
                  retryable: true,
                }),
            }),
          },
        },
        on: { "local-erase.cancel": "cancelled" },
      },
      removingKey: {
        tags: ["destructive", "saving"],
        invoke: {
          src: "removeGeminiApiKey",
          input: ({ context }) => context.removeGeminiApiKey,
          onDone: "completed",
          onError: {
            target: "failed",
            actions: assign({
              failureOperation: () => "remove-key" as const,
              error: ({ event }) =>
                failure(event.error, {
                  code: "unknown",
                  message: "The Gemini API key could not be removed.",
                  retryable: true,
                }),
            }),
          },
        },
        on: { "local-erase.cancel": "cancelled" },
      },
      failed: {
        tags: ["destructive", "error"],
        on: {
          "local-erase.retry": [
            { target: "persistingChoice", guard: "failedPersistChoice" },
            { target: "erasingLocal", guard: "failedEraseLocal" },
            { target: "removingKey", guard: "failedRemoveKey" },
          ],
          "local-erase.cancel": "cancelled",
        },
      },
      completed: {
        output: ({ context }) => ({
          status: "completed",
          removeGeminiApiKey: context.removeGeminiApiKey,
        }),
        on: { "local-erase.reset": "idle" },
      },
      cancelled: {
        on: { "local-erase.reset": "idle" },
      },
    },
  });
}

function localErasePhase(value: unknown): LocalEraseProgressPhase | undefined {
  switch (value) {
    case "reviewing":
      return "reviewing";
    case "persistingChoice":
      return "persisting-choice";
    case "erasingLocal":
      return "erasing-local";
    case "removingKey":
      return "removing-key";
    case "failed":
      return "failed";
    default:
      return undefined;
  }
}

function localEraseFailureOperation(
  value: unknown,
  context: Pick<LocalEraseContext, "failureOperation">,
): LocalEraseFailureOperation | null {
  switch (value) {
    case "persistingChoice":
      return "persist-choice";
    case "erasingLocal":
      return "erase-local";
    case "removingKey":
      return "remove-key";
    case "failed":
      return context.failureOperation;
    default:
      return null;
  }
}

export function persistLocalEraseSnapshot(
  snapshot: {
    readonly value: unknown;
    readonly context: Pick<
      LocalEraseContext,
      "removeGeminiApiKey" | "failureOperation"
    >;
  },
  now: () => string,
  storage?: DestructionStorage,
): void {
  const phase = localErasePhase(snapshot.value);
  if (phase === undefined) {
    if (snapshot.value === "completed" || snapshot.value === "cancelled") {
      clearLocalEraseProgress(storage);
    }
    return;
  }
  const failureOperation = localEraseFailureOperation(
    snapshot.value,
    snapshot.context,
  );
  if (phase === "failed" && failureOperation === null) return;
  writeLocalEraseProgress({
    phase,
    removeGeminiApiKey: snapshot.context.removeGeminiApiKey,
    failureOperation,
    updatedAt: now(),
  }, storage);
}

type LocalEraseMachine = ReturnType<typeof createLocalEraseMachine>;
type LocalEraseStateValue = Parameters<
  LocalEraseMachine["resolveState"]
>[0]["value"];

function stateValueForLocalEraseProgress(
  phase: LocalEraseProgressPhase,
): LocalEraseStateValue {
  switch (phase) {
    case "reviewing":
      return "reviewing";
    case "persisting-choice":
    case "erasing-local":
    case "removing-key":
    case "failed":
      return "failed";
  }
}

function recoveryFailure(
  operation: LocalEraseFailureOperation,
): ContractFailure {
  switch (operation) {
    case "persist-choice":
      return {
        code: "unknown",
        message:
          "The local erase choice was not confirmed durable. Retry to continue.",
        retryable: true,
      };
    case "erase-local":
      return {
        code: "unknown",
        message:
          "Local data erasure may have been interrupted. Retry to continue safely.",
        retryable: true,
      };
    case "remove-key":
      return {
        code: "unknown",
        message:
          "Local data was erased, but the Gemini API key still needs removal. Retry to finish.",
        retryable: true,
      };
  }
}

/**
 * Rehydrates only the redacted local-erase phase and key-choice metadata.
 * Active phases become an explicit retryable state because XState persisted
 * snapshots do not contain private invoked children. Retrying then resumes
 * only the recorded idempotent operation; no local financial data is restored.
 */
export function recoverLocalEraseSnapshot(
  machine: LocalEraseMachine,
  progress: LocalEraseProgressRecord,
) {
  const failureOperation = progress.failureOperation;
  const resolved = machine.resolveState({
    value: stateValueForLocalEraseProgress(progress.phase),
    context: {
      removeGeminiApiKey: progress.removeGeminiApiKey,
      error: progress.phase === "reviewing" || failureOperation === null
        ? null
        : recoveryFailure(failureOperation),
      failureOperation,
    },
  });
  return machine.getPersistedSnapshot(resolved);
}

export type DeleteEverywhereActorDependencies = {
  readonly createSafetyExport: (generation: number) => Promise<string>;
  readonly saveSafetyExport?: (json: string) => Promise<void>;
  readonly publishRetirement: (generation: number) => Promise<void>;
  readonly deleteDriveGeneration: (generation: number) => Promise<void>;
  readonly eraseLocalDataset: (generation: number) => Promise<void>;
};

/**
 * Supplies concrete application ports to the locked D-102 Delete Everywhere
 * protocol. Export contents are returned only to the download boundary and
 * never enter the machine context or its persisted snapshot.
 */
export function createDeleteEverywhereMachine(
  dependencies: DeleteEverywhereActorDependencies,
) {
  return deleteEverywhereMachine.provide({
    actors: {
      exportSafety: fromPromise(
        async ({ input }: { input: number }): Promise<string> => {
          const json = await dependencies.createSafetyExport(input);
          await dependencies.saveSafetyExport?.(json);
          return "did-it-become-what-you-like-delete-everywhere-safety.json";
        },
      ),
      publishRetirement: fromPromise(
        async ({ input }: { input: number }) =>
          await dependencies.publishRetirement(input),
      ),
      deleteDriveGeneration: fromPromise(
        async ({ input }: { input: number }) =>
          await dependencies.deleteDriveGeneration(input),
      ),
      eraseLocalDataset: fromPromise(
        async ({ input }: { input: number }) =>
          await dependencies.eraseLocalDataset(input),
      ),
    },
  });
}

function deleteEverywherePhase(value: unknown):
  | DeleteEverywhereProgressPhase
  | undefined {
  switch (value) {
    case "reviewing":
      return "reviewing";
    case "exporting":
      return "exporting";
    case "confirmingDecline":
      return "confirming-decline";
    case "confirming":
      return "confirming";
    case "publishingRetirement":
      return "publishing-retirement";
    case "deletingDrive":
      return "deleting-drive";
    case "erasingLocal":
      return "erasing-local";
    case "awaitingDevices":
      return "awaiting-devices";
    case "forcedFinalization":
      return "forced-finalization";
    case "failed":
      return "failed";
    case "completed":
      return "completed";
    default:
      return undefined;
  }
}

export function persistDeleteEverywhereSnapshot(
  snapshot: {
    readonly value: unknown;
    readonly context: {
      readonly generation: number;
      readonly progress: DeleteEverywhereProgress;
      readonly safetyExported: boolean;
      readonly safetyDeclined: boolean;
      readonly declineConfirmed: boolean;
    };
  },
  now: () => string,
  storage?: DestructionStorage,
): void {
  const phase = deleteEverywherePhase(snapshot.value);
  if (phase === undefined) return;
  writeDeleteEverywhereProgress({
    generation: snapshot.context.generation,
    phase,
    safetyExported: snapshot.context.safetyExported,
    safetyDeclined: snapshot.context.safetyDeclined,
    declineConfirmed: snapshot.context.declineConfirmed,
    knownDeviceCount: snapshot.context.progress.knownDeviceCount,
    acknowledgedDeviceCount: snapshot.context.progress.acknowledgedDeviceCount,
    forcedDeviceCount: snapshot.context.progress.forcedDeviceCount,
    updatedAt: now(),
  }, storage);
}

type DeleteEverywhereMachine = ReturnType<typeof createDeleteEverywhereMachine>;
type DeleteEverywhereStateValue = Parameters<
  DeleteEverywhereMachine["resolveState"]
>[0]["value"];

function stateValueForProgress(
  phase: DeleteEverywhereProgressPhase,
): DeleteEverywhereStateValue {
  switch (phase) {
    case "reviewing":
      return "reviewing";
    case "exporting":
      return "idle";
    case "confirming-decline":
      return "confirmingDecline";
    case "confirming":
      return "confirming";
    case "publishing-retirement":
      return "idle";
    case "deleting-drive":
      return "idle";
    case "erasing-local":
      return "idle";
    case "awaiting-devices":
      return "awaitingDevices";
    case "forced-finalization":
      return "forcedFinalization";
    case "failed":
      return "failed";
    case "completed":
      return "completed";
  }
}

/**
 * Rehydrates only the non-sensitive state needed to resume the concrete
 * destructive workflow. Stable states restore directly. An interrupted
 * invocation is returned to idle so the runtime can reinitialize it through
 * the locked confirmation path; this avoids claiming that a custom redacted
 * progress record contains XState's private invocation children.
 */
export function recoverDeleteEverywhereSnapshot(
  machine: DeleteEverywhereMachine,
  progress: DeleteEverywhereProgressRecord,
) {
  const resolved = machine.resolveState({
    value: stateValueForProgress(progress.phase),
    context: {
      generation: progress.generation,
      progress: {
        knownDeviceCount: progress.knownDeviceCount,
        acknowledgedDeviceCount: progress.acknowledgedDeviceCount,
        forcedDeviceCount: progress.forcedDeviceCount,
      },
      safetyExported: progress.safetyExported,
      safetyDeclined: progress.safetyDeclined,
      declineConfirmed: progress.declineConfirmed,
      result: null,
      error: null,
    },
  });
  return machine.getPersistedSnapshot(resolved);
}

export function retirementMarkerForGeneration(
  generation: number,
): DriveRetirementMarker {
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error("A positive generation is required.");
  }
  return {
    schemaVersion: 1,
    type: "retirement-marker",
    generation: String(generation),
  };
}

export async function publishDriveRetirement(
  drive: Pick<DriveAdapter, "publishRetirementMarker">,
  generation: number,
): Promise<void> {
  await drive.publishRetirementMarker(
    retirementMarkerForGeneration(generation),
  );
}

export async function deleteDriveGeneration(
  drive: Pick<DriveAdapter, "listAppData" | "deleteAppData">,
  _generation: number,
): Promise<void> {
  const files = await drive.listAppData();
  for (const file of files) {
    if (file.name === DRIVE_RETIREMENT_MARKER_NAME) continue;
    await drive.deleteAppData(file.name, file.etag);
  }
}

export async function finalizeDeleteEverywhere(
  drive: Pick<DriveAdapter, "disconnect">,
  progress: DeleteEverywhereProgress,
  storage?: DestructionStorage,
): Promise<void> {
  if (
    progress.acknowledgedDeviceCount + progress.forcedDeviceCount <
      progress.knownDeviceCount
  ) {
    throw new Error(
      "All known devices must acknowledge or be forced before revocation.",
    );
  }
  // OAuth revocation is deliberately the final external step. Known devices
  // have already had a chance to read the marker, and the caller has erased
  // this device before entering this finalization boundary.
  await drive.disconnect();
  clearDeleteEverywhereProgress(storage);
}
