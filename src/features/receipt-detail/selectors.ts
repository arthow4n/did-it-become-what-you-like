import type { ActorRefFrom, SnapshotFrom } from "xstate";
import type { createSavedReceiptMachine } from "../../actors/saved-receipt.ts";
import { mutationIsLine } from "./types.ts";

export type SavedReceiptActor = ActorRefFrom<
  ReturnType<typeof createSavedReceiptMachine>
>;
type SavedReceiptSnapshot = SnapshotFrom<
  ReturnType<typeof createSavedReceiptMachine>
>;

// Draft values belong to the editor subscription, not the saved receipt list.
export function selectReceiptDetailView(snapshot: SavedReceiptSnapshot) {
  return {
    aggregate: snapshot.context.aggregate,
    error: snapshot.context.error,
    pendingLineId: snapshot.context.pendingLineId,
    hasAddLineDraft: snapshot.context.addLineDraft !== null,
    status: snapshot.status,
    output: snapshot.output,
    dirty: snapshot.hasTag("dirty"),
    mutating: snapshot.hasTag("mutating"),
    ready: snapshot.matches("ready"),
    loading: snapshot.matches("loading"),
    notFound: snapshot.matches("notFound"),
    failure: snapshot.matches("failure"),
    loadFailure: snapshot.matches("loadFailure"),
    deleteFailure: snapshot.matches("deleteFailure"),
    mutationFailure: snapshot.matches("failure") &&
      snapshot.context.failureOperation === "mutation",
    confirmingReceiptDelete: snapshot.matches("confirmingReceiptDelete"),
    confirmingLineDelete: snapshot.matches("confirmingLineDelete"),
    confirmingDiscard: snapshot.matches("confirmingDiscard"),
    canRetry: snapshot.can({ type: "receipt.detail.retry" }),
    canReload: snapshot.can({ type: "receipt.detail.reload" }),
    canCancelDelete: snapshot.can({ type: "receipt.detail.cancel-delete" }),
  };
}

export function selectReceiptEditor(snapshot: SavedReceiptSnapshot) {
  const pendingMutationKind = snapshot.context.pendingMutation?.kind;
  const mutationFailure = snapshot.matches("failure") &&
    snapshot.context.failureOperation === "mutation";
  return {
    metadataDraft: snapshot.context.metadataDraft,
    lineDraft: snapshot.context.lineDraft,
    addLineDraft: snapshot.context.addLineDraft,
    pendingMutationKind,
    mutationFailure,
    errorMessage: snapshot.context.error?.message,
    editingMetadata: snapshot.context.metadataDraft !== null &&
      (snapshot.matches("metadataPristine") ||
        snapshot.matches("metadataDirty") ||
        (mutationFailure && pendingMutationKind === "metadata")),
    editingLine: snapshot.context.lineDraft !== null &&
      (snapshot.matches("linePristine") || snapshot.matches("lineDirty") ||
        (mutationFailure && mutationIsLine(pendingMutationKind))),
    editingAddLine: snapshot.context.addLineDraft !== null &&
      (snapshot.matches("lineAddingPristine") ||
        snapshot.matches("lineAddingDirty") ||
        (mutationFailure && pendingMutationKind === "add-line")),
    canRetry: snapshot.can({ type: "receipt.detail.retry" }),
    canSaveMetadata: snapshot.can({ type: "receipt.detail.save-metadata" }),
    canSaveLine: snapshot.can({ type: "receipt.detail.save-line" }),
    canAddLine: snapshot.can({ type: "receipt.detail.add-line" }),
  };
}
