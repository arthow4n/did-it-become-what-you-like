import { useActor } from "@xstate/react";
import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  moneySubtract,
  moneySum,
  receiptLineAmount,
} from "../../domain/index.ts";
import { createSavedReceiptMachine } from "../../actors/saved-receipt.ts";
import type { SavedReceiptActorOutput } from "../../actors/contracts/saved-receipt.ts";
import {
  Button,
  ConfirmDialog,
  ContentContainer,
  DangerDialog,
  ErrorState,
  FormActions,
  Heading,
  Icon,
  IconButton,
  Inline,
  InlineNotice,
  PageHeader,
  ReceiptLineCard,
  ReceiptMetadata,
  ReceiptReconciliation,
  Stack,
  StatusPanel,
  Text,
} from "../../design-system/index.ts";
import {
  categoryOptions,
  changesFromEditor,
  editorValue,
  editorValueFromChanges,
  lineDescription,
  mutationIsLine,
  type ReceiptDetailScreenProps,
} from "./types.ts";
import { ReceiptMetadataEditorDialog } from "./metadata-dialog.tsx";
import { ReceiptLineEditorDialog } from "./line-editor-dialog.tsx";

export function ReceiptDetailScreen({
  service,
  receiptId,
  categories,
  focusedLineId,
  discardRequest,
  onDirtyChange,
  onDirtyDiscarded,
  onBack,
  onComplete,
}: ReceiptDetailScreenProps) {
  const machine = useMemo(
    () => createSavedReceiptMachine({ service }),
    [service],
  );
  const [snapshot, send] = useActor(machine, { input: { receiptId } });
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const completedOutput = useRef<SavedReceiptActorOutput | null>(null);
  const focusedLineRef = useRef<string | undefined>(undefined);
  const pendingAddedLineIds = useRef<Set<string> | null>(null);

  const pendingMutationKind = snapshot.context.pendingMutation?.kind;
  const mutationFailure = snapshot.matches("failure") &&
    snapshot.context.failureOperation === "mutation";
  const destructiveFailure = snapshot.matches("deleteFailure");
  const editingMetadata = snapshot.context.metadataDraft !== null &&
    (snapshot.matches("metadataPristine") ||
      snapshot.matches("metadataDirty") ||
      (mutationFailure && pendingMutationKind === "metadata"));
  const editingLine = snapshot.context.lineDraft !== null &&
    (snapshot.matches("linePristine") || snapshot.matches("lineDirty") ||
      (mutationFailure && mutationIsLine(pendingMutationKind)));
  const editingAddLine = snapshot.context.addLineDraft !== null &&
    (snapshot.matches("lineAddingPristine") ||
      snapshot.matches("lineAddingDirty") ||
      (mutationFailure && pendingMutationKind === "add-line"));
  const dirty = snapshot.hasTag("dirty");
  const canRetry = snapshot.can({ type: "receipt.detail.retry" });

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    return () => globalThis.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (
      discardRequest === undefined ||
      discardRequest === handledDiscardRequest.current
    ) return;
    handledDiscardRequest.current = discardRequest;
    send({ type: "receipt.detail.discard-changes" });
    onDirtyDiscarded?.();
  }, [discardRequest, onDirtyDiscarded, send]);

  useEffect(() => {
    if (
      !focusedLineId || !snapshot.context.aggregate ||
      focusedLineRef.current === focusedLineId
    ) return;
    const target = Array.from(
      document.querySelectorAll<HTMLElement>("[data-receipt-line-id]"),
    ).find((element) => element.dataset.receiptLineId === focusedLineId);
    if (!target) return;
    focusedLineRef.current = focusedLineId;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "nearest" });
  }, [focusedLineId, snapshot.context.aggregate]);

  useEffect(() => {
    const aggregate = snapshot.context.aggregate;
    const knownIds = pendingAddedLineIds.current;
    if (!aggregate || !knownIds || snapshot.context.addLineDraft !== null) {
      return;
    }
    const addedLine = [...aggregate.purchaseLines, ...aggregate.adjustments]
      .find((line) => !knownIds.has(line.id));
    if (!addedLine) return;
    const target = Array.from(
      document.querySelectorAll<HTMLElement>("[data-receipt-line-id]"),
    ).find((element) => element.dataset.receiptLineId === addedLine.id);
    if (!target) return;
    pendingAddedLineIds.current = null;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "nearest" });
  }, [snapshot.context.addLineDraft, snapshot.context.aggregate]);

  useEffect(() => {
    if (snapshot.status !== "done" || !snapshot.output) return;
    if (completedOutput.current === snapshot.output) return;
    completedOutput.current = snapshot.output;
    if (snapshot.output.status !== "not-found") onComplete?.(snapshot.output);
  }, [onComplete, snapshot.output, snapshot.status]);

  if (snapshot.matches("loading")) {
    return (
      <ContentContainer size="review">
        <Stack gap={5}>
          <PageHeader
            title="Receipt details"
            headingLevel={1}
            leading={
              <IconButton
                icon={<ArrowLeft />}
                aria-label="Back"
                variant="quiet"
                onPress={onBack}
              />
            }
          />
          <StatusPanel
            title="Loading receipt"
            detail="Opening the saved receipt from this device."
          />
        </Stack>
      </ContentContainer>
    );
  }

  if (snapshot.matches("notFound")) {
    return (
      <ContentContainer size="readable">
        <Stack gap={5}>
          <PageHeader
            title="Receipt details"
            headingLevel={1}
            leading={
              <IconButton
                icon={<ArrowLeft />}
                aria-label="Back"
                variant="quiet"
                onPress={onBack}
              />
            }
          />
          <ErrorState
            title="Receipt not found"
            action={
              <Inline>
                <Button
                  onPress={() => send({ type: "receipt.detail.reload" })}
                >
                  Reload receipt
                </Button>
                <Button variant="secondary" onPress={onBack}>
                  Back to expenses
                </Button>
              </Inline>
            }
          >
            This saved receipt may have been deleted or is no longer available
            in the selected project.
          </ErrorState>
        </Stack>
      </ContentContainer>
    );
  }

  if (
    (snapshot.matches("loadFailure") || destructiveFailure ||
      snapshot.matches("failure")) &&
    (!mutationFailure || snapshot.context.aggregate === null)
  ) {
    const failure = snapshot.context.error;
    return (
      <ContentContainer size="review">
        <Stack gap={5}>
          <PageHeader
            title="Receipt details"
            headingLevel={1}
            leading={
              <IconButton
                icon={<ArrowLeft />}
                aria-label="Back"
                variant="quiet"
                onPress={onBack}
              />
            }
          />
          <ErrorState
            title={destructiveFailure
              ? "Receipt deletion failed"
              : mutationFailure
              ? "Receipt change failed"
              : "Receipt unavailable"}
            action={
              <Inline>
                {snapshot.can({ type: "receipt.detail.retry" })
                  ? (
                    <Button
                      onPress={() => send({ type: "receipt.detail.retry" })}
                    >
                      <Icon>
                        <RotateCcw />
                      </Icon>{" "}
                      Retry
                    </Button>
                  )
                  : snapshot.can({ type: "receipt.detail.reload" })
                  ? (
                    <Button
                      variant="secondary"
                      onPress={() => send({ type: "receipt.detail.reload" })}
                    >
                      Reload receipt
                    </Button>
                  )
                  : null}
                {destructiveFailure &&
                    snapshot.can({ type: "receipt.detail.cancel-delete" })
                  ? (
                    <Button
                      variant="quiet"
                      onPress={() =>
                        send({ type: "receipt.detail.cancel-delete" })}
                    >
                      Keep receipt
                    </Button>
                  )
                  : null}
                <Button variant="secondary" onPress={onBack}>
                  Back to expenses
                </Button>
              </Inline>
            }
          >
            {failure?.message ?? "The saved receipt could not be opened."}
          </ErrorState>
          {mutationFailure
            ? (
              <InlineNotice tone="info" title="Your entered values are kept">
                Retry to apply the saved change, or reload the receipt to
                discard the staged values.
              </InlineNotice>
            )
            : null}
        </Stack>
      </ContentContainer>
    );
  }

  const aggregate = snapshot.context.aggregate;
  if (!aggregate) {
    return (
      <ContentContainer size="readable">
        <ErrorState title="Receipt details unavailable">
          The saved receipt did not contain a readable aggregate.
        </ErrorState>
      </ContentContainer>
    );
  }

  const { receipt, purchaseLines, adjustments } = aggregate;
  const selectedTotal = moneySum([
    ...purchaseLines.map(receiptLineAmount),
    ...adjustments.map(receiptLineAmount),
  ]);
  const difference = moneySubtract(selectedTotal, receipt.printedTotal);
  const links = purchaseLines.map((line) => ({
    id: line.id,
    label: line.description,
  }));
  const lineDraft = snapshot.context.lineDraft;
  const addLineDraft = snapshot.context.addLineDraft;
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
    snapshot.can({ type: "receipt.detail.add-line" });
  const defaultCategoryId = categories.find((category) => !category.archived)
    ?.id ?? categories[0]?.id ?? "category-uncategorized";
  const pendingLine = snapshot.context.pendingLineId === null
    ? undefined
    : [...purchaseLines, ...adjustments].find((line) =>
      line.id === snapshot.context.pendingLineId
    );
  const isMutating = snapshot.hasTag("mutating");
  const finalPurchaseLine = pendingLine?.type === "receipt-purchase-line" &&
    purchaseLines.length === 1;

  const closeMetadataEditor = () => {
    if (mutationFailure && pendingMutationKind === "metadata") {
      send({ type: "receipt.detail.reload" });
    } else {
      send({ type: "receipt.detail.cancel-edit" });
    }
  };

  const closeLineEditor = () => {
    if (mutationFailure && mutationIsLine(pendingMutationKind)) {
      send({ type: "receipt.detail.reload" });
    } else {
      send({ type: "receipt.detail.cancel-edit" });
    }
  };

  const closeDeleteDialog = () => {
    send({ type: "receipt.detail.cancel-delete" });
  };

  return (
    <ContentContainer size="review" className="local-ui-receipt-detail">
      <Stack gap={5}>
        <PageHeader
          title={receipt.merchant || "Receipt"}
          eyebrow="Saved receipt"
          headingLevel={1}
          leading={
            <IconButton
              icon={<ArrowLeft />}
              aria-label="Back to expenses"
              variant="quiet"
              onPress={() => send({ type: "receipt.detail.back" })}
            />
          }
        />

        <ReceiptMetadata
          metadata={{
            merchant: receipt.merchant,
            date: receipt.date,
            time: receipt.time,
            currency: receipt.currency,
            printedTotal: receipt.printedTotal,
          }}
          onEdit={() => send({ type: "receipt.detail.edit-metadata" })}
        />
        <ReceiptReconciliation
          printed={receipt.printedTotal}
          selected={selectedTotal}
          difference={difference}
          currency={receipt.currency}
        />

        <Stack gap={3} as="section" aria-label="Purchase lines">
          <Inline justify="space-between">
            <Heading level={2} size="md">Purchase lines</Heading>
            <Button
              variant="secondary"
              isDisabled={isMutating}
              onPress={() => {
                pendingAddedLineIds.current = new Set([
                  ...purchaseLines.map((line) => line.id),
                  ...adjustments.map((line) => line.id),
                ]);
                send({
                  type: "receipt.detail.start-add-line",
                  changes: {
                    type: "purchase",
                    description: "",
                    categoryId: defaultCategoryId,
                    lineTotal: "",
                  },
                });
              }}
            >
              <Icon>
                <Plus />
              </Icon>{" "}
              Add purchase line
            </Button>
          </Inline>
          {purchaseLines.length === 0
            ? <Text tone="secondary">No purchase lines remain.</Text>
            : purchaseLines.map((line) => (
              <div
                key={line.id}
                tabIndex={-1}
                data-receipt-line-id={line.id}
                className="local-ui-receipt-detail__line"
              >
                <ReceiptLineCard
                  mode="management"
                  isDisabled={isMutating}
                  line={{
                    id: line.id,
                    type: "purchase",
                    description: line.description,
                    category:
                      categories.find((category) =>
                        category.id === line.categoryId
                      )?.name ?? line.categoryId,
                    amount: line.lineTotal,
                    selected: true,
                    uncertain: false,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                  }}
                  currency={receipt.currency}
                  onEdit={() =>
                    send({
                      type: "receipt.detail.edit-line",
                      lineId: line.id,
                    })}
                  onRemove={() =>
                    send({
                      type: "receipt.detail.request-line-delete",
                      lineId: line.id,
                    })}
                />
              </div>
            ))}
        </Stack>

        <Stack gap={3} as="section" aria-label="Adjustments">
          <Inline justify="space-between">
            <Heading level={2} size="md">Adjustments</Heading>
            <Button
              variant="secondary"
              isDisabled={isMutating}
              onPress={() => {
                pendingAddedLineIds.current = new Set([
                  ...purchaseLines.map((line) => line.id),
                  ...adjustments.map((line) => line.id),
                ]);
                send({
                  type: "receipt.detail.start-add-line",
                  changes: {
                    type: "adjustment",
                    description: "",
                    categoryId: defaultCategoryId,
                    amount: "",
                    lineId: null,
                  },
                });
              }}
            >
              <Icon>
                <Plus />
              </Icon>{" "}
              Add adjustment
            </Button>
          </Inline>
          {adjustments.length === 0
            ? <Text tone="secondary">No adjustments on this receipt.</Text>
            : adjustments.map((line) => (
              <div
                key={line.id}
                tabIndex={-1}
                data-receipt-line-id={line.id}
                className="local-ui-receipt-detail__line"
              >
                <ReceiptLineCard
                  mode="management"
                  isDisabled={isMutating}
                  line={{
                    id: line.id,
                    type: "adjustment",
                    description: line.description,
                    category:
                      categories.find((category) =>
                        category.id === line.categoryId
                      )?.name ?? line.categoryId,
                    amount: line.amount,
                    selected: true,
                    uncertain: false,
                    linkedLineDescription: line.lineId
                      ? lineDescription(aggregate, line.lineId)
                      : undefined,
                  }}
                  currency={receipt.currency}
                  onEdit={() =>
                    send({
                      type: "receipt.detail.edit-line",
                      lineId: line.id,
                    })}
                  onRemove={() =>
                    send({
                      type: "receipt.detail.request-line-delete",
                      lineId: line.id,
                    })}
                />
              </div>
            ))}
        </Stack>

        <FormActions className="local-ui-receipt-detail__danger-actions">
          <DangerDialog
            trigger={
              <Button
                variant="quiet"
                isDisabled={isMutating}
                onPress={() =>
                  send({ type: "receipt.detail.request-receipt-delete" })}
              >
                <Icon>
                  <Trash2 />
                </Icon>{" "}
                Delete receipt
              </Button>
            }
            title="Delete this receipt?"
            description="This will permanently delete this receipt and all its items."
            confirmLabel="Delete receipt"
            isOpen={snapshot.matches("confirmingReceiptDelete")}
            onOpenChange={(open) => {
              if (!open && snapshot.matches("confirmingReceiptDelete")) {
                send({ type: "receipt.detail.cancel-delete" });
              }
            }}
            onConfirm={() =>
              send({ type: "receipt.detail.confirm-receipt-delete" })}
            onCancel={closeDeleteDialog}
          />
        </FormActions>
      </Stack>

      <ReceiptMetadataEditorDialog
        isOpen={editingMetadata}
        isDismissable={!mutationFailure}
        metadataDraft={snapshot.context.metadataDraft}
        currency={receipt.currency}
        mutationFailure={mutationFailure}
        errorMessage={snapshot.context.error?.message}
        canRetry={canRetry}
        canSave={snapshot.can({ type: "receipt.detail.save-metadata" })}
        onChange={(changes) =>
          send({
            type: "receipt.detail.change-metadata",
            changes,
          })}
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
        linkOptions={links}
        mutationFailure={mutationFailure}
        errorMessage={snapshot.context.error?.message}
        canRetry={canRetry}
        canSubmit={editingAddLine ? canSubmitAddLine : snapshot.can({
          type: "receipt.detail.save-line",
        })}
        onChange={(value) => {
          const changes = changesFromEditor(value);
          send(
            editingAddLine
              ? {
                type: "receipt.detail.change-add-line",
                changes,
              }
              : {
                type: "receipt.detail.change-line",
                changes,
              },
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

      <ConfirmDialog
        trigger={null}
        title="Delete this line?"
        description={pendingLine?.type === "receipt-purchase-line"
          ? finalPurchaseLine
            ? `Delete “${pendingLine.description}”? This is the final purchase line, so the receipt, its adjustments, and linked expense records will also be deleted.`
            : `Delete “${pendingLine.description}”? This removes only this purchase line. Any linked adjustment will become receipt-wide.`
          : `Delete “${
            pendingLine?.description ?? "this adjustment"
          }”? This removes this adjustment from the receipt.`}
        confirmLabel="Delete line"
        confirmVariant="danger"
        isOpen={snapshot.matches("confirmingLineDelete")}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
        onConfirm={() => send({ type: "receipt.detail.confirm-line-delete" })}
        onCancel={closeDeleteDialog}
      />

      <ConfirmDialog
        trigger={null}
        title="Discard receipt changes?"
        description="Discard unsaved receipt changes?"
        confirmLabel="Discard changes"
        confirmVariant="danger"
        isOpen={snapshot.matches("confirmingDiscard")}
        isDismissable={false}
        onOpenChange={(open) => {
          if (!open) send({ type: "receipt.detail.cancel-discard" });
        }}
        onConfirm={() => send({ type: "receipt.detail.discard-changes" })}
        onCancel={() => send({ type: "receipt.detail.cancel-discard" })}
      />

      {isMutating
        ? (
          <StatusPanel
            title="Saving receipt change"
            detail="The receipt and its derived expense records are updated atomically."
          />
        )
        : null}
    </ContentContainer>
  );
}
