import { assign, setup } from "xstate";
import { unwiredPort } from "./ports.ts";
import {
  type ReceiptAggregate,
  type ReceiptLineChanges,
  type ReceiptMetadataChanges,
  type ReceiptMutationResult,
} from "../../domain/receipt.ts";
import type { StableId } from "../../domain/index.ts";
import { type ContractFailure, contractFailureFromError } from "./types.ts";

export type SavedReceiptEditor = "metadata" | "line";

export type SavedReceiptLineDraft = {
  readonly lineId: StableId;
  readonly changes: ReceiptLineChanges;
};

export type SavedReceiptMutation =
  | {
    readonly kind: "metadata";
    readonly receiptId: StableId;
    readonly changes: ReceiptMetadataChanges;
  }
  | {
    readonly kind: "line";
    readonly receiptId: StableId;
    readonly lineId: StableId;
    readonly changes: ReceiptLineChanges;
  }
  | {
    readonly kind: "delete-line";
    readonly receiptId: StableId;
    readonly lineId: StableId;
  }
  | {
    readonly kind: "delete-receipt";
    readonly receiptId: StableId;
  };

export type SavedReceiptMutationOutput =
  | { readonly kind: "metadata"; readonly aggregate: ReceiptAggregate }
  | { readonly kind: "line"; readonly aggregate: ReceiptAggregate }
  | {
    readonly kind: "delete-line";
    readonly result: ReceiptMutationResult;
  }
  | {
    readonly kind: "delete-receipt";
    readonly result: ReceiptMutationResult;
  };

export type SavedReceiptActorInput = {
  readonly receiptId?: StableId;
};

export type SavedReceiptActorEvent =
  | { readonly type: "receipt.detail.open"; readonly receiptId: StableId }
  | { readonly type: "receipt.detail.reload" }
  | { readonly type: "receipt.detail.refresh" }
  | { readonly type: "receipt.detail.edit-metadata" }
  | {
    readonly type: "receipt.detail.change-metadata";
    readonly changes: ReceiptMetadataChanges;
  }
  | { readonly type: "receipt.detail.save-metadata" }
  | { readonly type: "receipt.detail.edit-line"; readonly lineId: StableId }
  | {
    readonly type: "receipt.detail.change-line";
    readonly changes: ReceiptLineChanges;
  }
  | { readonly type: "receipt.detail.save-line" }
  | { readonly type: "receipt.detail.cancel-edit" }
  | {
    readonly type: "receipt.detail.request-line-delete";
    readonly lineId: StableId;
  }
  | { readonly type: "receipt.detail.confirm-line-delete" }
  | { readonly type: "receipt.detail.request-receipt-delete" }
  | { readonly type: "receipt.detail.confirm-receipt-delete" }
  | { readonly type: "receipt.detail.cancel-delete" }
  | {
    readonly type: "receipt.detail.back";
    readonly destination?: string;
  }
  | {
    readonly type: "receipt.detail.close";
    readonly destination?: string;
  }
  | {
    readonly type: "receipt.detail.navigate";
    readonly destination?: string;
  }
  | { readonly type: "receipt.detail.keep-editing" }
  | { readonly type: "receipt.detail.discard-changes" }
  | { readonly type: "receipt.detail.cancel-discard" }
  | { readonly type: "receipt.detail.retry" }
  | { readonly type: "receipt.detail.cancel" };

type SavedReceiptMachineEvent =
  | SavedReceiptActorEvent
  | {
    readonly type: "xstate.done.actor.loadReceipt";
    readonly output: ReceiptAggregate | undefined;
  }
  | {
    readonly type: "xstate.done.actor.mutateReceipt";
    readonly output: SavedReceiptMutationOutput;
  }
  | {
    readonly type: "xstate.error.actor.loadReceipt";
    readonly error: unknown;
  }
  | {
    readonly type: "xstate.error.actor.mutateReceipt";
    readonly error: unknown;
  };

function mutationOutput(
  event: SavedReceiptMachineEvent,
): SavedReceiptMutationOutput | undefined {
  if (
    !("output" in event) || event.output === undefined ||
    !("kind" in event.output)
  ) return undefined;
  return event.output as SavedReceiptMutationOutput;
}

function loadedAggregate(
  event: SavedReceiptMachineEvent,
): ReceiptAggregate | undefined {
  if (
    !("output" in event) || event.output === undefined ||
    !("receipt" in event.output)
  ) return undefined;
  return event.output as ReceiptAggregate;
}

export type SavedReceiptActorOutput =
  | { readonly status: "navigated"; readonly destination: string }
  | { readonly status: "discarded"; readonly destination: string }
  | {
    readonly status: "deleted";
    readonly receiptId: StableId;
    readonly deletedLineId?: StableId;
  }
  | { readonly status: "cancelled" }
  | { readonly status: "not-found"; readonly receiptId: StableId };

export type SavedReceiptFailureOperation = "load" | "mutation";

export type SavedReceiptActorContext = {
  readonly receiptId: StableId | null;
  readonly aggregate: ReceiptAggregate | null;
  readonly metadataDraft: ReceiptMetadataChanges | null;
  readonly lineDraft: SavedReceiptLineDraft | null;
  readonly pendingLineId: StableId | null;
  readonly pendingMutation: SavedReceiptMutation | null;
  readonly discardEditor: SavedReceiptEditor | null;
  readonly pendingDestination: string | null;
  readonly error: ContractFailure | null;
  readonly failureOperation: SavedReceiptFailureOperation | null;
  readonly outcome: SavedReceiptActorOutput | null;
};

export type SavedReceiptActorDependencies = {
  readonly loadReceipt: (
    receiptId: StableId,
  ) => Promise<ReceiptAggregate | undefined>;
  readonly mutateReceipt: (
    mutation: SavedReceiptMutation,
  ) => Promise<SavedReceiptMutationOutput>;
};

export const savedReceiptMachine = setup({
  types: {
    context: {} as SavedReceiptActorContext,
    events: {} as SavedReceiptMachineEvent,
    input: {} as SavedReceiptActorInput | undefined,
    output: {} as SavedReceiptActorOutput,
  },
  actors: {
    loadReceipt: unwiredPort<StableId, ReceiptAggregate | undefined>(
      "saved receipt loading",
    ),
    mutateReceipt: unwiredPort<
      SavedReceiptMutation,
      SavedReceiptMutationOutput
    >("saved receipt mutation"),
  },
  guards: {
    hasReceiptId: ({ context }) => context.receiptId !== null,
    hasAggregate: ({ context }) => context.aggregate !== null,
    hasLine: ({ context, event }) => {
      if (
        event.type !== "receipt.detail.edit-line" &&
        event.type !== "receipt.detail.request-line-delete"
      ) return false;
      return context.aggregate !== null &&
        [...context.aggregate.purchaseLines, ...context.aggregate.adjustments]
          .some((line) => line.id === event.lineId);
    },
    hasPendingLine: ({ context }) => context.pendingLineId !== null,
    hasPendingMutation: ({ context }) => context.pendingMutation !== null,
    hasPendingEditable: ({ context }) =>
      context.pendingMutation?.kind === "metadata" ||
      context.pendingMutation?.kind === "line",
    mutationDeletedReceipt: ({ event }) => {
      const output = mutationOutput(event);
      return output !== undefined &&
        (output.kind === "delete-receipt" ||
          (output.kind === "delete-line" && output.result.deletedReceipt));
    },
    mutationHasAggregate: ({ event }) => {
      const output = mutationOutput(event);
      return output !== undefined &&
        (output.kind === "metadata" || output.kind === "line" ||
          (output.kind === "delete-line" &&
            output.result.aggregate !== undefined));
    },
    retryLoad: ({ context }) => context.failureOperation === "load",
    discardMetadata: ({ context }) => context.discardEditor === "metadata",
    discardLine: ({ context }) => context.discardEditor === "line",
  },
  actions: {
    clearTransient: assign({
      metadataDraft: () => null,
      lineDraft: () => null,
      pendingLineId: () => null,
      pendingMutation: () => null,
      discardEditor: () => null,
      pendingDestination: () => null,
      error: () => null,
      failureOperation: () => null,
    }),
    clearError: assign({
      error: () => null,
      failureOperation: () => null,
    }),
    setReceiptId: assign({
      receiptId: ({ event }) =>
        event.type === "receipt.detail.open" ? event.receiptId : null,
    }),
    setAggregate: assign({
      aggregate: ({ event }) => {
        return loadedAggregate(event) ?? null;
      },
    }),
    setMetadataDraft: assign({
      metadataDraft: ({ context }) => {
        const receipt = context.aggregate?.receipt;
        return receipt === undefined ? null : {
          merchant: receipt.merchant ?? null,
          date: receipt.date,
          time: receipt.time ?? null,
          printedTotal: receipt.printedTotal,
        };
      },
    }),
    setLineDraft: assign({
      lineDraft: ({ context, event }) => {
        if (event.type !== "receipt.detail.edit-line") return null;
        const line = context.aggregate === null ? undefined : [
          ...context.aggregate.purchaseLines,
          ...context.aggregate.adjustments,
        ].find((candidate) => candidate.id === event.lineId);
        if (line === undefined) return null;
        return "lineTotal" in line
          ? {
            lineId: line.id,
            changes: {
              type: "purchase",
              description: line.description,
              categoryId: line.categoryId,
              quantity: line.quantity ?? null,
              unitPrice: line.unitPrice ?? null,
              lineTotal: line.lineTotal,
            },
          }
          : {
            lineId: line.id,
            changes: {
              type: "adjustment",
              description: line.description,
              categoryId: line.categoryId,
              amount: line.amount,
              lineId: line.lineId ?? null,
            },
          };
      },
    }),
    setPendingLine: assign({
      pendingLineId: ({ event }) =>
        event.type === "receipt.detail.request-line-delete"
          ? event.lineId
          : null,
    }),
    setMetadataMutation: assign({
      pendingMutation: ({ context }) => ({
        kind: "metadata",
        receiptId: context.receiptId!,
        changes: context.metadataDraft!,
      }),
    }),
    setLineMutation: assign({
      pendingMutation: ({ context }) => ({
        kind: "line",
        receiptId: context.receiptId!,
        lineId: context.lineDraft!.lineId,
        changes: context.lineDraft!.changes,
      }),
    }),
    setDeleteLineMutation: assign({
      pendingMutation: ({ context }) => ({
        kind: "delete-line",
        receiptId: context.receiptId!,
        lineId: context.pendingLineId!,
      }),
    }),
    setDeleteReceiptMutation: assign({
      pendingMutation: ({ context }) => ({
        kind: "delete-receipt",
        receiptId: context.receiptId!,
      }),
    }),
    setDiscardEditorFromPending: assign({
      discardEditor: ({ context }) =>
        context.pendingMutation?.kind === "metadata"
          ? "metadata"
          : context.pendingMutation?.kind === "line"
          ? "line"
          : null,
    }),
    setMutationAggregate: assign({
      aggregate: ({ event }) => {
        const output = mutationOutput(event);
        if (output === undefined) return null;
        return output.kind === "metadata" || output.kind === "line"
          ? output.aggregate
          : output.result.aggregate ?? null;
      },
    }),
    setDeletedOutcome: assign({
      outcome: ({ context, event }) => {
        const output = mutationOutput(event);
        if (output === undefined) return null;
        const result = output.kind === "delete-line"
          ? output.result
          : undefined;
        return {
          status: "deleted",
          receiptId: context.receiptId!,
          ...(result?.deletedLineId === undefined
            ? {}
            : { deletedLineId: result.deletedLineId }),
        };
      },
    }),
    setNavigationDestination: assign({
      pendingDestination: ({ event }) =>
        "destination" in event && typeof event.destination === "string"
          ? event.destination
          : "/expenses",
    }),
    setNavigatedOutcome: assign({
      outcome: ({ context }) => ({
        status: "navigated",
        destination: context.pendingDestination ?? "/expenses",
      }),
    }),
    setDiscardedOutcome: assign({
      outcome: ({ context }) => ({
        status: "discarded",
        destination: context.pendingDestination ?? "/expenses",
      }),
    }),
    setCancelledOutcome: assign({
      outcome: () => ({ status: "cancelled" }),
    }),
    setLoadFailure: assign({
      error: ({ event }) =>
        contractFailureFromError("error" in event ? event.error : undefined, {
          code: "unknown",
          message: "The saved receipt could not be loaded. Retry to try again.",
          retryable: true,
        }),
      failureOperation: () => "load" as const,
    }),
    setMutationFailure: assign({
      error: ({ event }) =>
        contractFailureFromError("error" in event ? event.error : undefined, {
          code: "unknown",
          message: "The receipt change was not saved. Retry to try again.",
          retryable: true,
        }),
      failureOperation: () => "mutation" as const,
    }),
  },
});

export const savedReceiptDetailMachine = savedReceiptMachine.createMachine({
  id: "saved-receipt-detail",
  initial: "closed",
  output: ({ context }) =>
    context.outcome ?? {
      status: "not-found",
      receiptId: context.receiptId!,
    },
  context: ({ input }) => ({
    receiptId: input?.receiptId ?? null,
    aggregate: null,
    metadataDraft: null,
    lineDraft: null,
    pendingLineId: null,
    pendingMutation: null,
    discardEditor: null,
    pendingDestination: null,
    error: null,
    failureOperation: null,
    outcome: null,
  }),
  states: {
    closed: {
      always: { target: "loading", guard: "hasReceiptId" },
      on: {
        "receipt.detail.open": {
          target: "loading",
          actions: [
            "setReceiptId",
            "clearTransient",
          ],
        },
      },
    },
    loading: {
      tags: ["loading"],
      invoke: {
        src: "loadReceipt",
        input: ({ context }) => context.receiptId!,
        onDone: [
          {
            target: "ready",
            guard: ({ event }) => event.output !== undefined,
            actions: ["setAggregate", "clearTransient"],
          },
          {
            target: "notFound",
            actions: "clearTransient",
          },
        ],
        onError: {
          target: "failure",
          actions: "setLoadFailure",
        },
      },
      on: {
        "receipt.detail.cancel": {
          target: "cancelled",
          actions: "setCancelledOutcome",
        },
      },
    },
    ready: {
      tags: ["ready"],
      on: {
        "receipt.detail.refresh": "loading",
        "receipt.detail.reload": {
          target: "loading",
          actions: "clearTransient",
        },
        "receipt.detail.edit-metadata": {
          target: "metadataPristine",
          guard: "hasAggregate",
          actions: "setMetadataDraft",
        },
        "receipt.detail.edit-line": [
          {
            target: "linePristine",
            guard: "hasLine",
            actions: "setLineDraft",
          },
          "notFound",
        ],
        "receipt.detail.request-line-delete": [
          {
            target: "confirmingLineDelete",
            guard: "hasLine",
            actions: "setPendingLine",
          },
          "notFound",
        ],
        "receipt.detail.request-receipt-delete": "confirmingReceiptDelete",
        "receipt.detail.back": {
          target: "completed",
          actions: ["setNavigationDestination", "setNavigatedOutcome"],
        },
        "receipt.detail.close": {
          target: "completed",
          actions: ["setNavigationDestination", "setNavigatedOutcome"],
        },
        "receipt.detail.navigate": {
          target: "completed",
          actions: ["setNavigationDestination", "setNavigatedOutcome"],
        },
        "receipt.detail.cancel": {
          target: "cancelled",
          actions: "setCancelledOutcome",
        },
      },
    },
    metadataPristine: {
      tags: ["editing"],
      on: {
        "receipt.detail.change-metadata": {
          target: "metadataDirty",
          actions: [
            "clearError",
            assign({ metadataDraft: ({ event }) => event.changes }),
          ],
        },
        "receipt.detail.cancel-edit": {
          target: "ready",
          actions: "clearTransient",
        },
        "receipt.detail.reload": {
          target: "loading",
          actions: "clearTransient",
        },
        "receipt.detail.back": {
          target: "completed",
          actions: ["setNavigationDestination", "setNavigatedOutcome"],
        },
        "receipt.detail.close": {
          target: "completed",
          actions: ["setNavigationDestination", "setNavigatedOutcome"],
        },
        "receipt.detail.navigate": {
          target: "completed",
          actions: ["setNavigationDestination", "setNavigatedOutcome"],
        },
      },
    },
    metadataDirty: {
      tags: ["editing", "dirty"],
      on: {
        "receipt.detail.change-metadata": {
          actions: [
            "clearError",
            assign({ metadataDraft: ({ event }) => event.changes }),
          ],
        },
        "receipt.detail.save-metadata": {
          target: "mutating",
          actions: ["setMetadataMutation", "clearError"],
        },
        "receipt.detail.cancel-edit": {
          target: "confirmingDiscard",
          actions: assign({ discardEditor: () => "metadata" as const }),
        },
        "receipt.detail.reload": {
          target: "loading",
          actions: "clearTransient",
        },
        "receipt.detail.back": {
          target: "confirmingDiscard",
          actions: [
            assign({ discardEditor: () => "metadata" as const }),
            "setNavigationDestination",
          ],
        },
        "receipt.detail.close": {
          target: "confirmingDiscard",
          actions: [
            assign({ discardEditor: () => "metadata" as const }),
            "setNavigationDestination",
          ],
        },
        "receipt.detail.navigate": {
          target: "confirmingDiscard",
          actions: [
            assign({ discardEditor: () => "metadata" as const }),
            "setNavigationDestination",
          ],
        },
        "receipt.detail.discard-changes": {
          target: "ready",
          actions: "clearTransient",
        },
      },
    },
    linePristine: {
      tags: ["editing"],
      on: {
        "receipt.detail.change-line": {
          target: "lineDirty",
          actions: [
            "clearError",
            assign({
              lineDraft: ({ context, event }) =>
                context.lineDraft === null
                  ? null
                  : { ...context.lineDraft, changes: event.changes },
            }),
          ],
        },
        "receipt.detail.cancel-edit": {
          target: "ready",
          actions: "clearTransient",
        },
        "receipt.detail.reload": {
          target: "loading",
          actions: "clearTransient",
        },
        "receipt.detail.back": {
          target: "completed",
          actions: ["setNavigationDestination", "setNavigatedOutcome"],
        },
        "receipt.detail.close": {
          target: "completed",
          actions: ["setNavigationDestination", "setNavigatedOutcome"],
        },
        "receipt.detail.navigate": {
          target: "completed",
          actions: ["setNavigationDestination", "setNavigatedOutcome"],
        },
      },
    },
    lineDirty: {
      tags: ["editing", "dirty"],
      on: {
        "receipt.detail.change-line": {
          actions: [
            "clearError",
            assign({
              lineDraft: ({ context, event }) =>
                context.lineDraft === null
                  ? null
                  : { ...context.lineDraft, changes: event.changes },
            }),
          ],
        },
        "receipt.detail.save-line": {
          target: "mutating",
          actions: ["setLineMutation", "clearError"],
        },
        "receipt.detail.cancel-edit": {
          target: "confirmingDiscard",
          actions: assign({ discardEditor: () => "line" as const }),
        },
        "receipt.detail.reload": {
          target: "loading",
          actions: "clearTransient",
        },
        "receipt.detail.back": {
          target: "confirmingDiscard",
          actions: [
            assign({ discardEditor: () => "line" as const }),
            "setNavigationDestination",
          ],
        },
        "receipt.detail.close": {
          target: "confirmingDiscard",
          actions: [
            assign({ discardEditor: () => "line" as const }),
            "setNavigationDestination",
          ],
        },
        "receipt.detail.navigate": {
          target: "confirmingDiscard",
          actions: [
            assign({ discardEditor: () => "line" as const }),
            "setNavigationDestination",
          ],
        },
        "receipt.detail.discard-changes": {
          target: "ready",
          actions: "clearTransient",
        },
      },
    },
    confirmingDiscard: {
      tags: ["confirming-discard"],
      on: {
        "receipt.detail.keep-editing": [
          { target: "metadataDirty", guard: "discardMetadata" },
          { target: "lineDirty", guard: "discardLine" },
        ],
        "receipt.detail.cancel-discard": [
          { target: "metadataDirty", guard: "discardMetadata" },
          { target: "lineDirty", guard: "discardLine" },
        ],
        "receipt.detail.discard-changes": [
          {
            target: "completed",
            guard: ({ context }) => context.pendingDestination !== null,
            actions: ["setDiscardedOutcome", "clearTransient"],
          },
          { target: "ready", actions: "clearTransient" },
        ],
      },
    },
    confirmingLineDelete: {
      tags: ["confirming-delete"],
      on: {
        "receipt.detail.cancel-delete": {
          target: "ready",
          actions: "clearTransient",
        },
        "receipt.detail.confirm-line-delete": {
          target: "mutating",
          guard: "hasPendingLine",
          actions: "setDeleteLineMutation",
        },
      },
    },
    confirmingReceiptDelete: {
      tags: ["confirming-delete"],
      on: {
        "receipt.detail.cancel-delete": {
          target: "ready",
          actions: "clearTransient",
        },
        "receipt.detail.confirm-receipt-delete": {
          target: "mutating",
          actions: "setDeleteReceiptMutation",
        },
      },
    },
    mutating: {
      tags: ["mutating"],
      invoke: {
        src: "mutateReceipt",
        input: ({ context }) => context.pendingMutation!,
        onDone: [
          {
            target: "completed",
            guard: "mutationDeletedReceipt",
            actions: ["setDeletedOutcome", "clearTransient"],
          },
          {
            target: "ready",
            guard: "mutationHasAggregate",
            actions: ["setMutationAggregate", "clearTransient"],
          },
          {
            target: "ready",
            actions: "clearTransient",
          },
        ],
        onError: {
          target: "failure",
          actions: "setMutationFailure",
        },
      },
      on: {
        "receipt.detail.cancel": {
          target: "cancelled",
          actions: "setCancelledOutcome",
        },
        "receipt.detail.reload": {
          target: "loading",
          actions: "clearTransient",
        },
      },
    },
    failure: {
      tags: ["error"],
      on: {
        "receipt.detail.back": [
          {
            target: "confirmingDiscard",
            guard: "hasPendingEditable",
            actions: [
              "setDiscardEditorFromPending",
              "setNavigationDestination",
            ],
          },
          {
            target: "completed",
            actions: ["setNavigationDestination", "setNavigatedOutcome"],
          },
        ],
        "receipt.detail.close": [
          {
            target: "confirmingDiscard",
            guard: "hasPendingEditable",
            actions: [
              "setDiscardEditorFromPending",
              "setNavigationDestination",
            ],
          },
          {
            target: "completed",
            actions: ["setNavigationDestination", "setNavigatedOutcome"],
          },
        ],
        "receipt.detail.navigate": [
          {
            target: "confirmingDiscard",
            guard: "hasPendingEditable",
            actions: [
              "setDiscardEditorFromPending",
              "setNavigationDestination",
            ],
          },
          {
            target: "completed",
            actions: ["setNavigationDestination", "setNavigatedOutcome"],
          },
        ],
        "receipt.detail.discard-changes": {
          target: "ready",
          actions: "clearTransient",
        },
        "receipt.detail.retry": [
          { target: "loading", guard: "retryLoad", actions: "clearError" },
          {
            target: "mutating",
            guard: "hasPendingMutation",
            actions: "clearError",
          },
        ],
        "receipt.detail.reload": {
          target: "loading",
          actions: "clearTransient",
        },
        "receipt.detail.cancel": {
          target: "cancelled",
          actions: "setCancelledOutcome",
        },
      },
    },
    completed: {
      type: "final",
      output: ({ context }) => context.outcome!,
    },
    cancelled: {
      type: "final",
      output: ({ context }) => context.outcome!,
    },
    notFound: {
      type: "final",
      output: ({ context }) => ({
        status: "not-found",
        receiptId: context.receiptId!,
      }),
    },
  },
});

export function savedReceiptFailure(
  error: unknown,
  fallback: ContractFailure,
): ContractFailure {
  return contractFailureFromError(error, fallback);
}
