import { shallowEqual, useActorRef, useSelector } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { lineDescription, type ReceiptDetailScreenProps } from "./types.ts";
import type {
  ReceiptAdjustment,
  ReceiptPurchaseLine,
} from "../../domain/schema/records.ts";
import { ReceiptDetailEditors } from "./editors.tsx";
import { selectReceiptDetailView } from "./selectors.ts";
import { QuickCategoryDialog } from "../receipt-ui/review-screen.tsx";

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
  const actor = useActorRef(machine, { input: { receiptId } });
  const view = useSelector(actor, selectReceiptDetailView, shallowEqual);
  const send = actor.send;
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const completedOutput = useRef<SavedReceiptActorOutput | null>(null);
  const focusedLineRef = useRef<string | undefined>(undefined);
  const pendingAddedLineIds = useRef<Set<string> | null>(null);
  const quickCategoryIdRef = useRef<string | null>(null);

  const {
    mutationFailure,
    deleteFailure: destructiveFailure,
    dirty,
  } = view;

  useEffect(() => {
    if (view.ready) {
      quickCategoryIdRef.current = null;
    }
  }, [view.ready]);

  const handleQuickCategorySelect = useCallback(
    (line: ReceiptPurchaseLine | ReceiptAdjustment, categoryId: string) => {
      if (categoryId === line.categoryId) return;
      quickCategoryIdRef.current = line.id;
      send({ type: "receipt.detail.edit-line", lineId: line.id });
      send({
        type: "receipt.detail.change-line",
        changes: "lineTotal" in line
          ? {
            type: "purchase",
            description: line.description,
            categoryId,
            quantity: line.quantity ?? null,
            unitPrice: line.unitPrice ?? null,
            lineTotal: line.lineTotal,
          }
          : {
            type: "adjustment",
            description: line.description,
            categoryId,
            amount: line.amount,
            lineId: line.lineId ?? null,
          },
      });
      send({ type: "receipt.detail.save-line" });
    },
    [send],
  );

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
      !focusedLineId || !view.aggregate ||
      focusedLineRef.current === focusedLineId
    ) return;
    const target = Array.from(
      document.querySelectorAll<HTMLElement>("[data-receipt-line-id]"),
    ).find((element) => element.dataset.receiptLineId === focusedLineId);
    if (!target) return;
    focusedLineRef.current = focusedLineId;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "nearest" });
  }, [focusedLineId, view.aggregate]);

  useEffect(() => {
    const aggregate = view.aggregate;
    const knownIds = pendingAddedLineIds.current;
    if (!aggregate || !knownIds || view.hasAddLineDraft) {
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
  }, [view.hasAddLineDraft, view.aggregate]);

  useEffect(() => {
    if (view.status !== "done" || !view.output) return;
    if (completedOutput.current === view.output) return;
    completedOutput.current = view.output;
    if (view.output.status !== "not-found") onComplete?.(view.output);
  }, [onComplete, view.output, view.status]);

  if (view.loading) {
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

  if (view.notFound) {
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
    (view.loadFailure || destructiveFailure ||
      view.failure) &&
    (!mutationFailure || view.aggregate === null)
  ) {
    const failure = view.error;
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
                {view.canRetry
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
                  : view.canReload
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
                    view.canCancelDelete
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

  const aggregate = view.aggregate;
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
  const defaultCategoryId = categories.find((category) => !category.archived)
    ?.id ?? categories[0]?.id ?? "category-uncategorized";
  const pendingLine = view.pendingLineId === null
    ? undefined
    : [...purchaseLines, ...adjustments].find((line) =>
      line.id === view.pendingLineId
    );
  const isMutating = view.mutating;
  const finalPurchaseLine = pendingLine?.type === "receipt-purchase-line" &&
    purchaseLines.length === 1;

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
                  categoryControl={
                    <QuickCategoryDialog
                      line={line}
                      categories={categories}
                      isDisabled={isMutating}
                      onSelect={(categoryId) =>
                        handleQuickCategorySelect(line, categoryId)}
                    />
                  }
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
                  categoryControl={
                    <QuickCategoryDialog
                      line={line}
                      categories={categories}
                      isDisabled={isMutating}
                      onSelect={(categoryId) =>
                        handleQuickCategorySelect(line, categoryId)}
                    />
                  }
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
            isOpen={view.confirmingReceiptDelete}
            onOpenChange={(open) => {
              if (!open && view.confirmingReceiptDelete) {
                send({ type: "receipt.detail.cancel-delete" });
              }
            }}
            onConfirm={() =>
              send({ type: "receipt.detail.confirm-receipt-delete" })}
            onCancel={closeDeleteDialog}
          />
        </FormActions>
      </Stack>

      <ReceiptDetailEditors
        actor={actor}
        categories={categories}
        linkOptions={links}
        currency={receipt.currency}
        quickUpdating={quickCategoryIdRef.current !== null}
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
        isOpen={view.confirmingLineDelete}
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
        isOpen={view.confirmingDiscard}
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
