import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import type {
  ContractFailure,
  DeleteEverywhereOutput,
  DeleteEverywhereProgress,
  ProjectDeletionOutput,
  ProjectDeletionTarget,
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
    nameMatches: ({ context }) =>
      context.target !== null &&
      context.typedName === context.target.projectName,
    needsSafetyExport: ({ context }) =>
      context.safetyExportRequired && !context.safetyExported,
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
        "project-delete.type-name": {
          target: "confirming",
          actions: assign({ typedName: ({ event }) => event.value }),
        },
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
          target: "failed",
          actions: assign({
            error: () => ({
              code: "export-failed",
              message: "Safety export was not created.",
            }),
          }),
        },
      },
      on: { "project-delete.cancel": "cancelled" },
    },
    confirming: {
      tags: ["destructive", "confirming"],
      on: {
        "project-delete.type-name": {
          actions: assign({ typedName: ({ event }) => event.value }),
        },
        "project-delete.confirm": [
          { target: "deleting", guard: "nameMatches" },
          {
            actions: assign({
              error: () => ({
                code: "confirmation-mismatch",
                message: "Type the project name exactly.",
              }),
            }),
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
            error: () => ({
              code: "delete-failed",
              message: "Project deletion was not committed.",
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

type DeleteEverywhereContext = {
  readonly generation: number;
  readonly progress: DeleteEverywhereProgress;
  readonly safetyExported: boolean;
  readonly safetyDeclined: boolean;
  readonly declineConfirmed: boolean;
  readonly result: DeleteEverywhereOutput | null;
  readonly error: ContractFailure | null;
};

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
            error: () => ({
              code: "export-failed",
              message: "Safety export was not created.",
            }),
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
          target: "publishingRetirement",
          guard: "safetyAccepted",
        },
        "delete-everywhere.cancel": "cancelled",
      },
    },
    publishingRetirement: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "publishRetirement",
        input: ({ context }) => context.generation,
        onDone: "deletingDrive",
        onError: {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "retirement-failed",
              message: "Retirement could not be published.",
            }),
          }),
        },
      },
    },
    deletingDrive: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "deleteDriveGeneration",
        input: ({ context }) => context.generation,
        onDone: "erasingLocal",
        onError: {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "drive-delete-failed",
              message: "Drive data could not be deleted.",
            }),
          }),
        },
      },
    },
    erasingLocal: {
      tags: ["destructive", "saving"],
      invoke: {
        src: "eraseLocalDataset",
        input: ({ context }) => context.generation,
        onDone: "awaitingDevices",
        onError: {
          target: "failed",
          actions: assign({
            error: () => ({
              code: "local-erase-failed",
              message: "Local data could not be erased.",
            }),
          }),
        },
      },
    },
    awaitingDevices: {
      tags: ["destructive", "waiting"],
      on: {
        "delete-everywhere.device-ack": {
          actions: assign({
            progress: ({ context, event }) => ({
              ...context.progress,
              acknowledgedDeviceCount: event.count,
            }),
          }),
        },
        "delete-everywhere.force-finalize": "forcedFinalization",
        "delete-everywhere.cancel": "cancelled",
      },
      always: { target: "completed", guard: "allDevicesAcknowledged" },
    },
    forcedFinalization: {
      tags: ["destructive", "waiting", "forced"],
      on: {
        "delete-everywhere.device-ack": {
          actions: assign({
            progress: ({ context, event }) => ({
              ...context.progress,
              acknowledgedDeviceCount: event.count,
            }),
          }),
        },
        "delete-everywhere.confirm": "completed",
      },
    },
    failed: {
      tags: ["destructive", "error"],
      on: {
        "delete-everywhere.retry": "publishingRetirement",
        "delete-everywhere.cancel": "cancelled",
      },
    },
    completed: {
      type: "final",
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
});
