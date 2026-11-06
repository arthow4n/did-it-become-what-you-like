import { shallowEqual, useSelector } from "@xstate/react";
import type { Category } from "../../domain/index.ts";
import type { SelectOption } from "../../design-system/index.ts";
import { ReceiptMetadataEditorDialog } from "./metadata-dialog.tsx";
import { ReceiptLineEditorDialog } from "./line-editor-dialog.tsx";
import { type SavedReceiptActor, selectReceiptEditor } from "./selectors.ts";
import {
  categoryOptions,
  changesFromEditor,
  editorValue,
  editorValueFromChanges,
  mutationIsLine,
} from "./types.ts";

export function ReceiptDetailEditors(
  { actor, categories, linkOptions, currency, quickUpdating }: {
    actor: SavedReceiptActor;
    categories: readonly Category[];
    linkOptions: SelectOption[];
    currency: string;
    quickUpdating: boolean;
  },
) {
  const view = useSelector(actor, selectReceiptEditor, shallowEqual);
  const send = actor.send;
  const {
    lineDraft,
    addLineDraft,
    editingMetadata,
    editingAddLine,
    mutationFailure,
    pendingMutationKind,
  } = view;
  const editingLine = view.editingLine && !(quickUpdating && !mutationFailure);
  const activeLineEditorValue = lineDraft
    ? editorValue(lineDraft)
    : addLineDraft
    ? editorValueFromChanges(addLineDraft)
    : null;
  const activeLineCategoryId = lineDraft?.changes.categoryId ??
    addLineDraft?.categoryId;
  const canSubmitAddLine = addLineDraft !== null &&
    addLineDraft.description.trim().length > 0 &&
    (addLineDraft.type === "purchase"
      ? addLineDraft.lineTotal.trim().length > 0
      : addLineDraft.amount.trim().length > 0) &&
    view.canAddLine;
  const closeMetadataEditor = () => {
    send({
      type: mutationFailure && pendingMutationKind === "metadata"
        ? "receipt.detail.reload"
        : "receipt.detail.cancel-edit",
    });
  };
  const closeLineEditor = () => {
    send({
      type: mutationFailure && mutationIsLine(pendingMutationKind)
        ? "receipt.detail.reload"
        : "receipt.detail.cancel-edit",
    });
  };
  return (
    <>
      <ReceiptMetadataEditorDialog
        isOpen={editingMetadata}
        isDismissable={!mutationFailure}
        metadataDraft={view.metadataDraft}
        currency={currency}
        mutationFailure={mutationFailure}
        errorMessage={view.errorMessage}
        canRetry={view.canRetry}
        canSave={view.canSaveMetadata}
        onChange={(changes) =>
          send({ type: "receipt.detail.change-metadata", changes })}
        onSave={() => send({ type: "receipt.detail.save-metadata" })}
        onRetry={() => send({ type: "receipt.detail.retry" })}
        onReload={() => send({ type: "receipt.detail.reload" })}
        onClose={closeMetadataEditor}
      />
      <ReceiptLineEditorDialog
        isOpen={editingLine || editingAddLine}
        isDismissable={!mutationFailure}
        isAdding={editingAddLine}
        value={activeLineEditorValue}
        categories={categoryOptions(categories, activeLineCategoryId)}
        linkOptions={linkOptions}
        mutationFailure={mutationFailure}
        errorMessage={view.errorMessage}
        canRetry={view.canRetry}
        canSubmit={editingAddLine ? canSubmitAddLine : view.canSaveLine}
        onChange={(value) => {
          const changes = changesFromEditor(value);
          send(
            editingAddLine
              ? { type: "receipt.detail.change-add-line", changes }
              : { type: "receipt.detail.change-line", changes },
          );
        }}
        onSubmit={() =>
          send(
            editingAddLine
              ? { type: "receipt.detail.add-line" }
              : { type: "receipt.detail.save-line" },
          )}
        onRetry={() => send({ type: "receipt.detail.retry" })}
        onReload={() => send({ type: "receipt.detail.reload" })}
        onClose={closeLineEditor}
      />
    </>
  );
}
