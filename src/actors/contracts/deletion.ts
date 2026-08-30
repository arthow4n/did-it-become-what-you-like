import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import type { DeleteEverywhereFailureOperation } from "../../domain/destruction.ts";
import {
  type ContractFailure,
  contractFailureFromError,
  type DeleteEverywhereOutput,
  type DeleteEverywhereProgress,
  type ProjectDeletionOutput,
  type ProjectDeletionTarget,
} from "./types.ts";

export type ProjectDeletionEvent =
  | {
    readonly type: "project-delete.open";
    readonly target: ProjectDeletionTarget;
    readonly safetyExportRequired: boolean;
  }
  | { readonly type: "project-delete.export-safety" }
  | { readonly type: "project-delete.safety-exported" }
  | { readonly type: "project-delete.type-name"; readonly value: string }
  | { readonly type: "project-delete.confirm" }
  | { readonly type: "project-delete.retry" }
  | { readonly type: "project-delete.cancel" };

type ProjectDeletionContext = {
  readonly target: ProjectDeletionTarget | null;
  readonly safetyExportRequired: boolean;
  readonly safetyExported: boolean;
  readonly typedName: string;
  readonly result: ProjectDeletionOutput | null;
  readonly error: ContractFailure | null;
};

export type ProjectDeletionOutputEvent =
  | { readonly status: "deleted"; readonly result: ProjectDeletionOutput }
  | { readonly status: "cancelled" };

const projectDeletionSetup = setup({
  types: {
    context: {} as ProjectDeletionContext,
    events: {} as ProjectDeletionEvent,
    output: {} as ProjectDeletionOutputEvent,
  },
  actors: {
    exportSafety: unwiredPort<ProjectDeletionTarget, string>(
      "project deletion safety export",
    ),
    commitProjectDeletion: unwiredPort<
      ProjectDeletionTarget,
      ProjectDeletionOutput
    >("project tombstone commit"),
  },
  guards: {
    safetyExportReady: ({ context }) =>
      !context.safetyExportRequired || context.safetyExported,
    canCommit: ({ context }) =>
      context.target !== null &&
      context.typedName === context.target.projectName &&
      (!context.safetyExportRequired || context.safetyExported),
  },
});

export const projectDeletionMachine = projectDeletionSetup.createMachine({
  id: "project-deletion",
  initial: "idle",
  context: {
    target: null,
    safetyExportRequired: true,
    safetyExported: false,
    typedName: "",
    result: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        "project-delete.open": {
          target: "reviewing",
          actions: assign({
            target: ({ event }) => event.target,
            safetyExportRequired: ({ event }) => event.safetyExportRequired,
            safetyExported: () => false,
            typedName: () => "",
            result: () => null,
            error: () => null,
          }),
        },
      },
    },
    reviewing: {
      tags: ["destructive", "reviewing"],
      on: {
        "project-delete.export-safety": "exporting",
        "project-delete.type-name": [
          {
            target: "confirming",
            guard: "safetyExportReady",
            actions: assign({ typedName: ({ event }) => event.value }),
          },
          {
            actions: assign({ typedName: ({ event }) => event.value }),
          },
        ],
        "project-delete.cancel": "cancelled",
      },
    },
    exporting: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "exportSafety",
        input: ({ context }) => context.target!,
        onDone: {
          target: "confirming",
          actions: assign({ safetyExported: () => true, error: () => null }),
        },
        onError: {
          target: "exportFailed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Safety export was not created.",
                retryable: true,
              }),
          }),
        },
      },
      on: { "project-delete.cancel": "cancelled" },
    },
    exportFailed: {
      tags: ["destructive", "error"],
      on: {
        "project-delete.retry": "exporting",
        "project-delete.cancel": "cancelled",
      },
    },
    confirming: {
      tags: ["destructive", "confirming"],
      on: {
        "project-delete.type-name": {
          actions: assign({ typedName: ({ event }) => event.value }),
        },
        "project-delete.confirm": [
          { target: "deleting", guard: "canCommit" },
          {
            actions: assign(({ context }) => ({
              error: {
                code: "invalid",
                message: context.safetyExportRequired &&
                    !context.safetyExported
                  ? "Complete the safety export before confirming deletion."
                  : "Type the project name exactly.",
                retryable: false,
              },
            })),
          },
        ],
        "project-delete.cancel": "cancelled",
      },
    },
    deleting: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "commitProjectDeletion",
        input: ({ context }) => context.target!,
        onDone: {
          target: "completed",
          actions: assign({
            result: ({ event }) => event.output,
            error: () => null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Project deletion was not committed.",
                retryable: true,
              }),
          }),
        },
      },
      on: { "project-delete.cancel": "cancelled" },
    },
    failed: {
      tags: ["destructive", "error"],
      on: {
        "project-delete.retry": "deleting",
        "project-delete.cancel": "cancelled",
      },
    },
    completed: {
      type: "final",
      output: ({ context }) => ({ status: "deleted", result: context.result! }),
    },
    cancelled: { type: "final", output: () => ({ status: "cancelled" }) },
  },
});

export type DeleteEverywhereEvent =
  | {
    readonly type: "delete-everywhere.open";
    readonly generation: number;
    readonly progress: DeleteEverywhereProgress;
  }
  | { readonly type: "delete-everywhere.export-safety" }
  | { readonly type: "delete-everywhere.safety-exported" }
  | { readonly type: "delete-everywhere.decline-safety-export" }
  | { readonly type: "delete-everywhere.confirm-decline" }
  | { readonly type: "delete-everywhere.confirm" }
  | { readonly type: "delete-everywhere.device-ack"; readonly count: number }
  | { readonly type: "delete-everywhere.force-finalize" }
  | { readonly type: "delete-everywhere.retry" }
  | { readonly type: "delete-everywhere.cancel" };

export type DeleteEverywherePersistencePhase =
  | "publishing-retirement"
  | "deleting-drive"
  | "erasing-local"
  | "awaiting-devices"
  | "forced-finalization"
  | "completed";

export type DeleteEverywherePersistenceInput = {
  readonly phase: DeleteEverywherePersistencePhase;
  readonly generation: number;
  readonly progress: DeleteEverywhereProgress;
  readonly safetyExported: boolean;
  readonly safetyDeclined: boolean;
  readonly declineConfirmed: boolean;
};

type DeleteEverywhereContext = {
  readonly generation: number;
  readonly progress: DeleteEverywhereProgress;
  readonly safetyExported: boolean;
  readonly safetyDeclined: boolean;
  readonly declineConfirmed: boolean;
  readonly result: DeleteEverywhereOutput | null;
  readonly error: ContractFailure | null;
  readonly failureState: DeleteEverywhereFailureState | null;
};

type DeleteEverywhereFailureState = DeleteEverywhereFailureOperation;

export type DeleteEverywhereOutputEvent =
  | { readonly status: "completed"; readonly result: DeleteEverywhereOutput }
  | { readonly status: "cancelled" };

const deleteEverywhereSetup = setup({
  types: {
    context: {} as DeleteEverywhereContext,
    events: {} as DeleteEverywhereEvent,
    output: {} as DeleteEverywhereOutputEvent,
  },
  actors: {
    exportSafety: unwiredPort<number, string>(
      "Delete Everywhere safety export",
    ),
    persistProgress: unwiredPort<DeleteEverywherePersistenceInput, void>(
      "Delete Everywhere progress persistence",
    ),
    publishRetirement: unwiredPort<number, void>(
      "retirement marker publication",
    ),
    deleteDriveGeneration: unwiredPort<number, void>(
      "Drive generation deletion",
    ),
    eraseLocalDataset: unwiredPort<number, void>("local dataset erasure"),
  },
  guards: {
    safetyAccepted: ({ context }) =>
      context.safetyExported || context.declineConfirmed,
    allDevicesAcknowledged: ({ context }) =>
      context.progress.acknowledgedDeviceCount >=
        context.progress.knownDeviceCount,
    failedExporting: ({ context }) => context.failureState === "exporting",
    failedPersistingRetirement: ({ context }) =>
      context.failureState === "persistingRetirement",
    failedPublishingRetirement: ({ context }) =>
      context.failureState === "publishingRetirement",
    failedPersistingDriveDeletion: ({ context }) =>
      context.failureState === "persistingDriveDeletion",
    failedDeletingDrive: ({ context }) =>
      context.failureState === "deletingDrive",
    failedPersistingLocalErasure: ({ context }) =>
      context.failureState === "persistingLocalErasure",
    failedErasingLocal: ({ context }) =>
      context.failureState === "erasingLocal",
    failedPersistingAwaitingDevices: ({ context }) =>
      context.failureState === "persistingAwaitingDevices",
    failedPersistingForcedFinalization: ({ context }) =>
      context.failureState === "persistingForcedFinalization",
    failedPersistingCompletion: ({ context }) =>
      context.failureState === "persistingCompletion",
    failedBeforeIrreversibleWork: ({ context }) =>
      context.failureState === "exporting" ||
      context.failureState === "persistingRetirement",
  },
});

export const deleteEverywhereMachine = deleteEverywhereSetup.createMachine({
  id: "delete-everywhere",
  initial: "idle",
  context: {
    generation: 0,
    progress: {
      knownDeviceCount: 0,
      acknowledgedDeviceCount: 0,
      forcedDeviceCount: 0,
    },
    safetyExported: false,
    safetyDeclined: false,
    declineConfirmed: false,
    result: null,
    error: null,
    failureState: null,
  },
  states: {
    idle: {
      on: {
        "delete-everywhere.open": {
          target: "reviewing",
          actions: assign({
            generation: ({ event }) => event.generation,
            progress: ({ event }) => event.progress,
            safetyExported: () => false,
            safetyDeclined: () => false,
            declineConfirmed: () => false,
            result: () => null,
            error: () => null,
            failureState: () => null,
          }),
        },
      },
    },
    reviewing: {
      tags: ["destructive", "reviewing"],
      on: {
        "delete-everywhere.export-safety": "exporting",
        "delete-everywhere.decline-safety-export": "confirmingDecline",
        "delete-everywhere.cancel": "cancelled",
      },
    },
    exporting: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "exportSafety",
        input: ({ context }) => context.generation,
        onDone: {
          target: "confirming",
          actions: assign({ safetyExported: () => true, error: () => null }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Safety export was not created.",
                retryable: true,
              }),
            failureState: () => "exporting" as const,
          }),
        },
      },
      on: { "delete-everywhere.cancel": "cancelled" },
    },
    confirmingDecline: {
      tags: ["destructive", "confirming"],
      on: {
        "delete-everywhere.confirm-decline": {
          target: "confirming",
          actions: assign({
            declineConfirmed: () => true,
            safetyDeclined: () => true,
          }),
        },
        "delete-everywhere.cancel": "cancelled",
      },
    },
    confirming: {
      tags: ["destructive", "confirming"],
      on: {
        "delete-everywhere.confirm": {
          target: "persistingRetirement",
          guard: "safetyAccepted",
        },
        "delete-everywhere.cancel": "cancelled",
      },
    },
    persistingRetirement: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "persistProgress",
        input: ({ context }) => ({
          phase: "publishing-retirement",
          generation: context.generation,
          progress: context.progress,
          safetyExported: context.safetyExported,
          safetyDeclined: context.safetyDeclined,
          declineConfirmed: context.declineConfirmed,
        }),
        onDone: "publishingRetirement",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unavailable",
                message:
                  "Delete Everywhere progress could not be saved before deletion.",
                retryable: true,
              }),
            failureState: () => "persistingRetirement" as const,
          }),
        },
      },
      on: { "delete-everywhere.cancel": "cancelled" },
    },
    publishingRetirement: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "publishRetirement",
        input: ({ context }) => context.generation,
        onDone: "persistingDriveDeletion",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Retirement could not be published.",
                retryable: true,
              }),
            failureState: () => "publishingRetirement" as const,
          }),
        },
      },
      on: {
        "delete-everywhere.cancel": {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "unknown",
              message:
                "Delete Everywhere was paused after retirement began. Retry to continue safely.",
              retryable: true,
            }),
            failureState: () => "publishingRetirement" as const,
          }),
        },
      },
    },
    persistingDriveDeletion: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "persistProgress",
        input: ({ context }) => ({
          phase: "deleting-drive",
          generation: context.generation,
          progress: context.progress,
          safetyExported: context.safetyExported,
          safetyDeclined: context.safetyDeclined,
          declineConfirmed: context.declineConfirmed,
        }),
        onDone: "deletingDrive",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unavailable",
                message:
                  "Delete Everywhere progress could not be saved before Drive deletion.",
                retryable: true,
              }),
            failureState: () => "persistingDriveDeletion" as const,
          }),
        },
      },
      on: {
        "delete-everywhere.cancel": {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "unknown",
              message:
                "Delete Everywhere was paused after retirement began. Retry to continue safely.",
              retryable: true,
            }),
            failureState: () => "persistingDriveDeletion" as const,
          }),
        },
      },
    },
    deletingDrive: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "deleteDriveGeneration",
        input: ({ context }) => context.generation,
        onDone: "persistingLocalErasure",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Drive data could not be deleted.",
                retryable: true,
              }),
            failureState: () => "deletingDrive" as const,
          }),
        },
      },
      on: {
        "delete-everywhere.cancel": {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "unknown",
              message:
                "Delete Everywhere was paused while Drive deletion was in progress. Retry to continue safely.",
              retryable: true,
            }),
            failureState: () => "deletingDrive" as const,
          }),
        },
      },
    },
    persistingLocalErasure: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "persistProgress",
        input: ({ context }) => ({
          phase: "erasing-local",
          generation: context.generation,
          progress: context.progress,
          safetyExported: context.safetyExported,
          safetyDeclined: context.safetyDeclined,
          declineConfirmed: context.declineConfirmed,
        }),
        onDone: "erasingLocal",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unavailable",
                message:
                  "Delete Everywhere progress could not be saved before local erasure.",
                retryable: true,
              }),
            failureState: () => "persistingLocalErasure" as const,
          }),
        },
      },
      on: {
        "delete-everywhere.cancel": {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "unknown",
              message:
                "Delete Everywhere was paused after Drive deletion began. Retry to continue safely.",
              retryable: true,
            }),
            failureState: () => "persistingLocalErasure" as const,
          }),
        },
      },
    },
    erasingLocal: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "eraseLocalDataset",
        input: ({ context }) => context.generation,
        onDone: "persistingAwaitingDevices",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unknown",
                message: "Local data could not be erased.",
                retryable: true,
              }),
            failureState: () => "erasingLocal" as const,
          }),
        },
      },
      on: {
        "delete-everywhere.cancel": {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "unknown",
              message:
                "Delete Everywhere was paused while local erasure was in progress. Retry to continue safely.",
              retryable: true,
            }),
            failureState: () => "erasingLocal" as const,
          }),
        },
      },
    },
    persistingAwaitingDevices: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "persistProgress",
        input: ({ context }) => ({
          phase: "awaiting-devices",
          generation: context.generation,
          progress: context.progress,
          safetyExported: context.safetyExported,
          safetyDeclined: context.safetyDeclined,
          declineConfirmed: context.declineConfirmed,
        }),
        onDone: "awaitingDevices",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unavailable",
                message:
                  "Delete Everywhere progress could not be saved before waiting for devices.",
                retryable: true,
              }),
            failureState: () => "persistingAwaitingDevices" as const,
          }),
        },
      },
      on: {
        "delete-everywhere.cancel": {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "unknown",
              message:
                "Delete Everywhere was paused after local erasure began. Retry to continue safely.",
              retryable: true,
            }),
            failureState: () => "persistingAwaitingDevices" as const,
          }),
        },
      },
    },
    awaitingDevices: {
      tags: ["destructive", "waiting"],
      on: {
        "delete-everywhere.device-ack": {
          target: "persistingAwaitingDevices",
          actions: assign({
            progress: ({ context, event }) => ({
              ...context.progress,
              acknowledgedDeviceCount: event.count,
            }),
          }),
        },
        "delete-everywhere.force-finalize": {
          target: "persistingForcedFinalization",
          actions: assign({
            progress: ({ context }) => ({
              ...context.progress,
              forcedDeviceCount: Math.max(
                context.progress.forcedDeviceCount,
                context.progress.knownDeviceCount -
                  context.progress.acknowledgedDeviceCount,
              ),
            }),
          }),
        },
        "delete-everywhere.cancel": {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "unknown",
              message:
                "Delete Everywhere was paused after local erasure. Retry to continue safely.",
              retryable: true,
            }),
            failureState: () => "persistingAwaitingDevices" as const,
          }),
        },
      },
      always: {
        target: "persistingCompletion",
        guard: "allDevicesAcknowledged",
      },
    },
    persistingForcedFinalization: {
      tags: ["destructive", "saving", "waiting", "forced"],
      invoke: {
        src: "persistProgress",
        input: ({ context }) => ({
          phase: "forced-finalization",
          generation: context.generation,
          progress: context.progress,
          safetyExported: context.safetyExported,
          safetyDeclined: context.safetyDeclined,
          declineConfirmed: context.declineConfirmed,
        }),
        onDone: "forcedFinalization",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unavailable",
                message:
                  "Delete Everywhere progress could not be saved before forced finalization.",
                retryable: true,
              }),
            failureState: () => "persistingForcedFinalization" as const,
          }),
        },
      },
      on: {
        "delete-everywhere.cancel": {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "unknown",
              message:
                "Delete Everywhere was paused while forced finalization was being saved. Retry to continue safely.",
              retryable: true,
            }),
            failureState: () => "persistingForcedFinalization" as const,
          }),
        },
      },
    },
    forcedFinalization: {
      tags: ["destructive", "waiting", "forced"],
      on: {
        "delete-everywhere.device-ack": {
          target: "persistingForcedFinalization",
          actions: assign({
            progress: ({ context, event }) => ({
              ...context.progress,
              acknowledgedDeviceCount: event.count,
            }),
          }),
        },
        "delete-everywhere.confirm": "persistingCompletion",
        "delete-everywhere.cancel": {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "unknown",
              message:
                "Delete Everywhere was paused after forced finalization began. Retry to continue safely.",
              retryable: true,
            }),
            failureState: () => "persistingForcedFinalization" as const,
          }),
        },
      },
    },
    persistingCompletion: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "persistProgress",
        input: ({ context }) => ({
          phase: "completed",
          generation: context.generation,
          progress: context.progress,
          safetyExported: context.safetyExported,
          safetyDeclined: context.safetyDeclined,
          declineConfirmed: context.declineConfirmed,
        }),
        onDone: "completed",
        onError: {
          target: "failed",
          actions: assign({
            error: ({ event }) =>
              contractFailureFromError(event.error, {
                code: "unavailable",
                message:
                  "Delete Everywhere progress could not be saved before final authorization cleanup.",
                retryable: true,
              }),
            failureState: () => "persistingCompletion" as const,
          }),
        },
      },
      on: {
        "delete-everywhere.cancel": {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "unknown",
              message:
                "Delete Everywhere was paused before final authorization cleanup. Retry to continue safely.",
              retryable: true,
            }),
            failureState: () => "persistingCompletion" as const,
          }),
        },
      },
    },
    failed: {
      tags: ["destructive", "error"],
      on: {
        "delete-everywhere.retry": [
          { target: "exporting", guard: "failedExporting" },
          {
            target: "persistingRetirement",
            guard: "failedPersistingRetirement",
          },
          {
            target: "publishingRetirement",
            guard: "failedPublishingRetirement",
          },
          {
            target: "persistingDriveDeletion",
            guard: "failedPersistingDriveDeletion",
          },
          { target: "deletingDrive", guard: "failedDeletingDrive" },
          {
            target: "persistingLocalErasure",
            guard: "failedPersistingLocalErasure",
          },
          { target: "erasingLocal", guard: "failedErasingLocal" },
          {
            target: "persistingAwaitingDevices",
            guard: "failedPersistingAwaitingDevices",
          },
          {
            target: "persistingForcedFinalization",
            guard: "failedPersistingForcedFinalization",
          },
          {
            target: "persistingCompletion",
            guard: "failedPersistingCompletion",
          },
        ],
        "delete-everywhere.cancel": {
          target: "cancelled",
          guard: "failedBeforeIrreversibleWork",
        },
      },
    },
    completed: {
      type: "final",
      entry: assign({
        result: ({ context }) => ({
          generation: context.generation,
          forcedDeviceCount: context.progress.forcedDeviceCount,
        }),
      }),
      output: ({ context }) => ({
        status: "completed",
        result: {
          generation: context.generation,
          forcedDeviceCount: context.progress.forcedDeviceCount,
        },
      }),
    },
    cancelled: { type: "final", output: () => ({ status: "cancelled" }) },
  },
  output: ({ context }) =>
    context.result === null
      ? { status: "cancelled" }
      : { status: "completed", result: context.result },
});
