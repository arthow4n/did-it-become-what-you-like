import { useActor } from "@xstate/react";
import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import type { Category, StableId } from "../domain/index.ts";
import {
  moneySubtract,
  moneySum,
  type ReceiptAggregate,
  receiptLineAmount,
  type ReceiptLineChanges,
  type ReceiptManagementService,
} from "../domain/index.ts";
import { createSavedReceiptMachine } from "../actors/saved-receipt.ts";
import type {
  SavedReceiptActorOutput,
  SavedReceiptLineDraft,
} from "../actors/contracts/saved-receipt.ts";
import {
  AdaptiveDialog,
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
  MoneyField,
  NativeDateField,
  NativeTimeField,
  PageHeader,
  ReceiptLineCard,
  ReceiptLineEditor,
  type ReceiptLineEditorValue,
  ReceiptMetadata,
  ReceiptReconciliation,
  Stack,
  StatusPanel,
  Text,
  TextField,
} from "../design-system/index.ts";

export type ReceiptDetailScreenProps = {
  service: ReceiptManagementService;
  receiptId: StableId;
  categories: readonly Category[];
  focusedLineId?: StableId;
  discardRequest?: number;
  onDirtyChange?: (dirty: boolean) => void;
  onDirtyDiscarded?: () => void;
  onBack?: () => void;
  onComplete?: (output: SavedReceiptActorOutput) => void;
};

function categoryOptions(
  categories: readonly Category[],
  currentCategoryId?: string,
) {
  return categories.filter((category) =>
    !category.archived || category.id === currentCategoryId
  ).map((category) => ({
    id: category.id,
    label: category.archived ? `${category.name} (archived)` : category.name,
    ...(category.archived ? { disabled: true } : {}),
  }));
}

function editorValue(draft: SavedReceiptLineDraft): ReceiptLineEditorValue {
  const changes = draft.changes;
  return changes.type === "purchase"
    ? {
      type: "purchase",
      description: changes.description,
      categoryId: changes.categoryId,
      amount: changes.lineTotal,
      quantity: changes.quantity ?? undefined,
      unitPrice: changes.unitPrice ?? undefined,
    }
    : {
      type: "adjustment",
      description: changes.description,
      categoryId: changes.categoryId,
      amount: changes.amount,
      lineId: changes.lineId ?? undefined,
    };
}

function changesFromEditor(value: ReceiptLineEditorValue): ReceiptLineChanges {
  if (value.type === "purchase") {
    return {
      type: "purchase",
      description: value.description,
      categoryId: value.categoryId,
      quantity: value.quantity?.trim() ? value.quantity : null,
      unitPrice: value.unitPrice?.trim() ? value.unitPrice : null,
      lineTotal: value.amount,
    };
  }
  return {
    type: "adjustment",
    description: value.description,
    categoryId: value.categoryId,
    amount: value.amount,
    lineId: value.lineId?.trim() ? value.lineId : null,
  };
}

function lineDescription(
  aggregate: ReceiptAggregate,
  lineId: StableId,
): string {
  const line = [...aggregate.purchaseLines, ...aggregate.adjustments].find(
    (candidate) => candidate.id === lineId,
  );
  return line?.description ?? "this line";
}

function mutationIsLine(
  kind: string | undefined,
): kind is "line" | "delete-line" {
  return kind === "line" || kind === "delete-line";
}

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

  const pendingMutationKind = snapshot.context.pendingMutation?.kind;
  const mutationFailure = snapshot.matches("failure") &&
    snapshot.context.failureOperation === "mutation";
  const editingMetadata = snapshot.context.metadataDraft !== null &&
    (snapshot.matches("metadataPristine") ||
      snapshot.matches("metadataDirty") ||
      (mutationFailure && pendingMutationKind === "metadata"));
  const editingLine = snapshot.context.lineDraft !== null &&
    (snapshot.matches("linePristine") || snapshot.matches("lineDirty") ||
      (mutationFailure && mutationIsLine(pendingMutationKind)));
  const dirty = snapshot.hasTag("dirty") ||
    (mutationFailure && mutationIsLine(pendingMutationKind) ||
      mutationFailure && pendingMutationKind === "metadata");
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
            action={<Button onPress={onBack}>Back to expenses</Button>}
          >
            This saved receipt may have been deleted or is no longer available
            in the selected project.
          </ErrorState>
        </Stack>
      </ContentContainer>
    );
  }

  if (
    snapshot.matches("failure") &&
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
            title={mutationFailure
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
    if (!isMutating) send({ type: "receipt.detail.cancel-delete" });
  };

  return (
    <ContentContainer size="review" className="local-ui-receipt-detail">
      <Stack gap={5}>
        <PageHeader
          title={receipt.merchant || "Receipt"}
          eyebrow="Saved receipt"
          description="Review and manage the saved receipt lines."
          headingLevel={1}
          leading={
            <IconButton
              icon={<ArrowLeft />}
              aria-label="Back to expenses"
              variant="quiet"
              onPress={() => send({ type: "receipt.detail.back" })}
            />
          }
          actions={
            <DangerDialog
              trigger={
                <Button
                  variant="danger"
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
              description="This permanently removes the receipt, every purchase line and adjustment, and all receipt-linked expense records from this device. There is no undo after commit."
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
          }
        />
        {mutationFailure
          ? (
            <ErrorState
              title="Receipt change failed"
              action={
                <Inline>
                  {canRetry
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
                    : (
                      <Button
                        variant="secondary"
                        onPress={() => send({ type: "receipt.detail.reload" })}
                      >
                        Reload receipt
                      </Button>
                    )}
                  <Button
                    variant="secondary"
                    onPress={() =>
                      send({
                        type: "receipt.detail.back",
                        destination: "/expenses",
                      })}
                  >
                    Back to expenses
                  </Button>
                </Inline>
              }
            >
              {snapshot.context.error?.message ??
                "Retry to apply the saved change."}
            </ErrorState>
          )
          : null}

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
          <Heading level={2} size="md">Purchase lines</Heading>
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
          <Heading level={2} size="md">Adjustments</Heading>
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
      </Stack>

      <AdaptiveDialog
        trigger={null}
        title="Edit receipt details"
        isOpen={editingMetadata}
        isDismissable={!mutationFailure}
        onOpenChange={(open) => {
          if (!open) closeMetadataEditor();
        }}
      >
        {snapshot.context.metadataDraft
          ? (
            <Stack gap={4}>
              <TextField
                autoFocus
                label="Merchant"
                value={snapshot.context.metadataDraft.merchant ?? ""}
                onChange={(merchant) =>
                  send({
                    type: "receipt.detail.change-metadata",
                    changes: { ...snapshot.context.metadataDraft!, merchant },
                  })}
                isDisabled={mutationFailure}
              />
              <div className="local-ui-form-row local-ui-form-row--date-time">
                <NativeDateField
                  label="Date"
                  value={snapshot.context.metadataDraft.date}
                  onChange={(event) =>
                    send({
                      type: "receipt.detail.change-metadata",
                      changes: {
                        ...snapshot.context.metadataDraft!,
                        date: event.currentTarget.value,
                      },
                    })}
                  disabled={mutationFailure}
                />
                <NativeTimeField
                  label="Time (optional)"
                  value={snapshot.context.metadataDraft.time ?? ""}
                  onChange={(event) =>
                    send({
                      type: "receipt.detail.change-metadata",
                      changes: {
                        ...snapshot.context.metadataDraft!,
                        time: event.currentTarget.value || null,
                      },
                    })}
                  disabled={mutationFailure}
                />
              </div>
              <MoneyField
                label="Printed receipt total"
                currency={receipt.currency}
                value={snapshot.context.metadataDraft.printedTotal}
                onChange={(printedTotal) =>
                  send({
                    type: "receipt.detail.change-metadata",
                    changes: {
                      ...snapshot.context.metadataDraft!,
                      printedTotal,
                    },
                  })}
                isDisabled={mutationFailure}
              />
              {mutationFailure
                ? (
                  <InlineNotice tone="danger" title="Save failed">
                    {snapshot.context.error?.message ??
                      (canRetry
                        ? "Retry to save these receipt details."
                        : "Reload the receipt to discard this failed change.")}
                  </InlineNotice>
                )
                : null}
              <FormActions>
                <Button variant="secondary" onPress={closeMetadataEditor}>
                  Cancel
                </Button>
                {mutationFailure
                  ? canRetry
                    ? (
                      <Button
                        onPress={() => send({ type: "receipt.detail.retry" })}
                      >
                        Retry
                      </Button>
                    )
                    : (
                      <Button
                        variant="secondary"
                        onPress={() => send({ type: "receipt.detail.reload" })}
                      >
                        Reload receipt
                      </Button>
                    )
                  : (
                    <Button
                      isDisabled={!snapshot.can({
                        type: "receipt.detail.save-metadata",
                      })}
                      onPress={() =>
                        send({ type: "receipt.detail.save-metadata" })}
                    >
                      Save changes
                    </Button>
                  )}
              </FormActions>
            </Stack>
          )
          : null}
      </AdaptiveDialog>

      <AdaptiveDialog
        trigger={null}
        title="Edit receipt line"
        isOpen={editingLine}
        isDismissable={!mutationFailure}
        onOpenChange={(open) => {
          if (!open) closeLineEditor();
        }}
      >
        {lineDraft
          ? (
            <Stack gap={4}>
              <ReceiptLineEditor
                value={editorValue(lineDraft)}
                categories={categoryOptions(
                  categories,
                  lineDraft.changes.categoryId,
                )}
                linkOptions={links}
                onChange={(value) =>
                  send({
                    type: "receipt.detail.change-line",
                    changes: changesFromEditor(value),
                  })}
              />
              {mutationFailure
                ? (
                  <InlineNotice tone="danger" title="Save failed">
                    {snapshot.context.error?.message ??
                      (canRetry
                        ? "Retry to save this receipt line."
                        : "Reload the receipt to discard this failed change.")}
                  </InlineNotice>
                )
                : null}
              <FormActions>
                <Button variant="secondary" onPress={closeLineEditor}>
                  Cancel
                </Button>
                {mutationFailure
                  ? canRetry
                    ? (
                      <Button
                        onPress={() => send({ type: "receipt.detail.retry" })}
                      >
                        Retry
                      </Button>
                    )
                    : (
                      <Button
                        variant="secondary"
                        onPress={() => send({ type: "receipt.detail.reload" })}
                      >
                        Reload receipt
                      </Button>
                    )
                  : (
                    <Button
                      isDisabled={!snapshot.can({
                        type: "receipt.detail.save-line",
                      })}
                      onPress={() => send({ type: "receipt.detail.save-line" })}
                    >
                      Save changes
                    </Button>
                  )}
              </FormActions>
            </Stack>
          )
          : null}
      </AdaptiveDialog>

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
        description="Your staged receipt changes have not been saved. Keep editing or discard them before leaving this detail view."
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
