import { useActor } from "@xstate/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalPort } from "../../adapters/ports/local.ts";
import {
  CalendarDateSchema,
  CanonicalDecimalSchema,
  type Category,
  CurrencyCodeSchema,
  moneyCompare,
  StableIdSchema,
  TimeOfDaySchema,
} from "../../domain/index.ts";
import {
  type ReceiptDraftLine,
  receiptMismatchDifference,
  type ReceiptReviewDraft,
  receiptSelectedTotal,
} from "../../domain/receipt.ts";
import type { ProjectCategoryState } from "../../domain/organization.ts";
import {
  createReceiptReviewMachine,
  type ReceiptReviewActorEvent,
} from "../../actors/receipt.ts";
import { ChevronDown, X } from "lucide-react";
import {
  AdaptiveDialog,
  Button,
  CategoryPicker,
  ContentContainer,
  ErrorState,
  FormActions,
  Heading,
  IconButton,
  Inline,
  InlineNotice,
  List,
  ListRow,
  NativeDateField,
  NativeTimeField,
  PageHeader,
  ReceiptLineCard,
  ReceiptLineEditor,
  ReceiptMetadata,
  ReceiptReconciliation,
  Stack,
  StatusPanel,
  StickyActionBar,
  Text,
  TextField,
} from "../../design-system/index.ts";
import { useSyncStatus } from "../sync-ui/index.ts";
import {
  categoryOptions,
  lineViewModel,
  makeLineId,
  type ReceiptReviewMode,
  useDirtyBeforeUnload,
} from "./types.ts";

function unsignedDecimal(value: string): string {
  return value.startsWith("-") ? value.slice(1) : value;
}

function outflowDecimal(value: string): string {
  const unsigned = unsignedDecimal(value);
  return unsigned === "0" ? "0" : `-${unsigned}`;
}

function editorValue(line: ReceiptDraftLine, manual = false): {
  type: "purchase" | "adjustment";
  description: string;
  categoryId: string;
  amount: string;
  quantity?: string;
  unitPrice?: string;
  lineId?: string;
} {
  return line.type === "purchase"
    ? {
      type: line.type,
      description: line.description,
      categoryId: line.categoryId,
      amount: manual ? unsignedDecimal(line.lineTotal) : line.lineTotal,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }
    : {
      type: line.type,
      description: line.description,
      categoryId: line.categoryId,
      amount: line.amount,
      lineId: line.lineId,
    };
}

function updatedLine(
  line: ReceiptDraftLine,
  value: ReturnType<typeof editorValue>,
  manual = false,
): ReceiptDraftLine | undefined {
  const amount = CanonicalDecimalSchema.safeParse(value.amount);
  if (!amount.success) return undefined;
  if (line.type === "purchase" && value.type === "purchase") {
    const quantity = value.quantity?.trim();
    const unitPrice = value.unitPrice?.trim();
    if (quantity && !CanonicalDecimalSchema.safeParse(quantity).success) {
      return undefined;
    }
    if (unitPrice && !CanonicalDecimalSchema.safeParse(unitPrice).success) {
      return undefined;
    }
    return {
      ...line,
      description: value.description,
      categoryId: StableIdSchema.parse(value.categoryId),
      lineTotal: manual ? outflowDecimal(amount.data) : amount.data,
      ...(quantity ? { quantity } : { quantity: undefined }),
      ...(unitPrice ? { unitPrice } : { unitPrice: undefined }),
    };
  }
  if (line.type === "adjustment" && value.type === "adjustment") {
    return {
      ...line,
      description: value.description,
      categoryId: StableIdSchema.parse(value.categoryId),
      amount: amount.data,
      ...(value.lineId
        ? { lineId: StableIdSchema.parse(value.lineId) }
        : { lineId: undefined }),
    };
  }
  return undefined;
}

export function LineEditorDialog({
  line,
  categories,
  linkOptions,
  onSave,
  onClose,
  triggerLabel,
  triggerVariant = "quiet",
  fullWidth,
  dialogTitle,
  manual = false,
}: {
  line: ReceiptDraftLine;
  categories: readonly Category[];
  linkOptions: Array<{ id: string; label: string }>;
  onSave: (line: ReceiptDraftLine) => void;
  onClose?: () => void;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary" | "quiet" | "danger";
  fullWidth?: boolean;
  dialogTitle?: string;
  manual?: boolean;
}) {
  const [value, setValue] = useState(editorValue(line, manual));
  const [error, setError] = useState<string>();

  useEffect(() => {
    setValue(editorValue(line, manual));
    setError(undefined);
  }, [line, manual]);
  return (
    <AdaptiveDialog
      trigger={
        <Button variant={triggerVariant} fullWidth={fullWidth}>
          {triggerLabel}
        </Button>
      }
      title={dialogTitle ??
        (line.type === "purchase" ? "Edit receipt line" : "Edit adjustment")}
    >
      {(close) => (
        <Stack gap={4}>
          <ReceiptLineEditor
            value={value}
            categories={categoryOptions(categories)}
            linkOptions={linkOptions}
            manual={manual}
            onChange={(next) => {
              setValue(next);
              setError(undefined);
            }}
          />
          {error
            ? (
              <InlineNotice tone="danger" title="Check this line">
                {error}
              </InlineNotice>
            )
            : null}
          <FormActions>
            <Button variant="secondary" onPress={close}>
              Cancel
            </Button>
            <Button
              isDisabled={value.description.trim().length === 0}
              onPress={() => {
                const next = updatedLine(line, value, manual);
                if (!next) {
                  setError(
                    "Enter valid decimal values before saving this line.",
                  );
                  return;
                }
                onSave(next);
                close();
                onClose?.();
              }}
            >
              Save line
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}

export function QuickCategoryDialog({
  line,
  categories,
  onSelect,
  isDisabled,
}: {
  line: { readonly categoryId: string; readonly description?: string };
  categories: readonly Category[];
  onSelect: (categoryId: string) => void;
  isDisabled?: boolean;
}) {
  const currentCategory =
    categories.find((c) => c.id === line.categoryId)?.name ??
      line.categoryId;
  const options = categoryOptions(categories);

  return (
    <AdaptiveDialog
      trigger={
        <Button
          variant="quiet"
          isDisabled={isDisabled}
          className="ds-receipt-line-category-trigger"
          aria-label={`Category: ${currentCategory}. Tap to change category.`}
        >
          <Inline gap={1}>
            <span>{currentCategory}</span>
            <ChevronDown size={14} />
          </Inline>
        </Button>
      }
      title="Change category"
    >
      {(close) => (
        <Stack gap={4}>
          <Text size="body" tone="secondary">
            {line.description || "Unclear item"}
          </Text>
          <CategoryPicker
            label="Category"
            categories={options}
            value={line.categoryId}
            onValueChange={(categoryId) => {
              onSelect(categoryId);
              close();
            }}
          />
        </Stack>
      )}
    </AdaptiveDialog>
  );
}

export function ReceiptReviewScreen({
  local,
  state,
  initialReview,
  mode = "scanned",
  persistenceKey,
  onDirtyChange,
  onDiscardDisabledChange,
  discardRequest,
  onClose,
}: {
  local: LocalPort;
  state: ProjectCategoryState;
  initialReview?: ReceiptReviewDraft;
  mode?: ReceiptReviewMode;
  persistenceKey?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onDiscardDisabledChange?: (disabled: boolean) => void;
  discardRequest?: number;
  onClose: () => void;
}) {
  const isManual = mode === "manual";
  const isMenu = mode === "menu";
  const pageTitle = isManual
    ? "Enter receipt manually"
    : isMenu
    ? "Review menu items"
    : "Review receipt";
  const machine = useMemo(
    () => createReceiptReviewMachine({ local, organization: local }),
    [local],
  );
  const [snapshot, send] = useActor(machine, {
    input: {
      ...(initialReview ? { initialReview } : {}),
      ...(persistenceKey ? { persistenceKey } : {}),
      ...(isManual ? { restoreExisting: true } : {}),
    },
  });
  const [openSent, setOpenSent] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [metadataError, setMetadataError] = useState<string>();
  const doneRef = useRef(false);
  const syncMutationHandled = useRef(false);
  const metadataReturnFocusRef = useRef<HTMLElement | null>(null);
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const syncStatus = useSyncStatus();

  const openMetadata = () => {
    const activeElement = document.activeElement;
    metadataReturnFocusRef.current = activeElement instanceof HTMLElement
      ? activeElement
      : null;
    setMetadataOpen(true);
  };
  const closeMetadata = () => {
    setMetadataOpen(false);
    const returnFocus = metadataReturnFocusRef.current;
    queueMicrotask(() => {
      if (returnFocus?.isConnected) returnFocus.focus();
    });
  };

  useEffect(() => {
    if (openSent) return;
    setOpenSent(true);
    if (!initialReview) {
      send({ type: "receipt.review.hydrate" });
    }
  }, [initialReview, openSent, send]);

  const reviewChanged = (review: ReceiptReviewDraft | null): boolean => {
    if (!review) return false;
    if (!initialReview) return true;
    return JSON.stringify({
      parent: review.parent,
      lines: review.lines,
    }) !== JSON.stringify({
      parent: initialReview.parent,
      lines: initialReview.lines,
    });
  };
  const dirty = snapshot.hasTag("dirty") &&
    (!isManual || reviewChanged(snapshot.context.review));
  useDirtyBeforeUnload(dirty);

  useEffect(() => {
    onDirtyChange?.(dirty);
    onDiscardDisabledChange?.(snapshot.hasTag("saving"));
  }, [onDiscardDisabledChange, onDirtyChange, snapshot]);

  useEffect(() => {
    if (
      discardRequest === undefined ||
      discardRequest === handledDiscardRequest.current
    ) return;
    handledDiscardRequest.current = discardRequest;
    if (snapshot.hasTag("saving")) return;
    send({ type: "receipt.review.discard" });
  }, [discardRequest, send, snapshot]);

  useEffect(() => {
    if (doneRef.current) return;
    if (
      snapshot.matches("saved") || snapshot.matches("discarded") ||
      snapshot.matches("cancelled")
    ) {
      doneRef.current = true;
      if (snapshot.matches("saved") && !syncMutationHandled.current) {
        syncMutationHandled.current = true;
        syncStatus?.notifyLocalMutation();
      }
      onClose();
    }
  }, [onClose, snapshot, syncStatus]);

  if (snapshot.matches("hydrating") && !snapshot.context.review) {
    return (
      <ContentContainer size="review">
        <PageHeader title={pageTitle} headingLevel={1} />
        <StatusPanel
          title="Loading receipt review"
          detail="Opening the receipt review draft."
        />
      </ContentContainer>
    );
  }
  if (snapshot.matches("closed")) {
    return (
      <ContentContainer size="review">
        <Stack gap={4}>
          <PageHeader title={pageTitle} headingLevel={1} />
          <Text>There is no receipt review to restore.</Text>
        </Stack>
      </ContentContainer>
    );
  }
  if (snapshot.matches("failed") && snapshot.context.review === null) {
    return (
      <ContentContainer size="review">
        <Stack gap={4}>
          <PageHeader title={pageTitle} headingLevel={1} />
          <ErrorState
            title="Receipt review needs recovery"
            action={
              <Inline>
                <Button
                  variant="secondary"
                  onPress={() => send({ type: "receipt.review.retry" })}
                >
                  Retry
                </Button>
                <Button
                  variant="quiet"
                  onPress={() => send({ type: "receipt.review.discard" })}
                >
                  Discard review
                </Button>
              </Inline>
            }
          >
            {snapshot.context.error?.message ??
              "The receipt review could not be recovered."}
          </ErrorState>
        </Stack>
      </ContentContainer>
    );
  }
  const review = snapshot.context.review;
  if (!review) {
    return (
      <ContentContainer size="review">
        <Stack gap={4}>
          <PageHeader title={pageTitle} headingLevel={1} />
          <ErrorState title="Receipt review unavailable">
            The validated receipt draft could not be opened.
          </ErrorState>
        </Stack>
      </ContentContainer>
    );
  }
  const selectedTotal = receiptSelectedTotal(review);
  const difference = receiptMismatchDifference(review);
  const selectedCount = review.lines.filter((line) => line.selected).length;
  const categories = state.categories;
  const links = review.lines.filter((line) =>
    line.type === "purchase" && line.selected
  ).map((line) => ({
    id: line.id,
    label: line.description || "Unclear purchase",
  }));
  const sendReview = (event: ReceiptReviewActorEvent) => {
    send(event);
  };
  const updateParent = (parent: ReceiptReviewDraft["parent"]) => {
    if (
      !CalendarDateSchema.safeParse(parent.date).success ||
      (parent.time && !TimeOfDaySchema.safeParse(parent.time).success) ||
      !CurrencyCodeSchema.safeParse(parent.currency).success ||
      !CanonicalDecimalSchema.safeParse(parent.printedTotal).success
    ) {
      setMetadataError(
        "Enter a valid date, time, currency, and printed total.",
      );
      return;
    }
    setMetadataError(undefined);
    sendReview({ type: "receipt.review.change-parent", parent });
    setMetadataOpen(false);
  };
  const newLine = {
    type: "purchase" as const,
    id: makeLineId(),
    description: "",
    categoryId: categories.find((category) => !category.archived)?.id ??
      "category-uncategorized",
    lineTotal: "0" as const,
    selected: false,
    uncertain: false,
  } satisfies ReceiptDraftLine;
  const closeReview = () => {
    if (snapshot.hasTag("saving")) return;
    if (isManual && !dirty) {
      send({ type: "receipt.review.discard" });
      return;
    }
    onClose();
  };

  return (
    <ContentContainer size="review">
      <Stack gap={5}>
        <PageHeader
          title={pageTitle}
          description={isManual
            ? "Add the items from a restaurant or café purchase, then check the total paid."
            : isMenu
            ? "Select the items and quantities you ordered from the menu."
            : undefined}
          headingLevel={1}
          leading={dirty
            ? (
              <AdaptiveDialog
                trigger={
                  <IconButton
                    icon={<X />}
                    aria-label="Close"
                    variant="quiet"
                  />
                }
                title="Discard receipt review?"
              >
                {(close) => (
                  <Stack gap={4}>
                    <Text>Your saved review draft will be removed.</Text>
                    <Inline>
                      <Button variant="quiet" onPress={close}>
                        Keep reviewing
                      </Button>
                      <Button
                        variant="danger"
                        onPress={() => {
                          send({ type: "receipt.review.discard" });
                          close();
                        }}
                      >
                        Discard review
                      </Button>
                    </Inline>
                  </Stack>
                )}
              </AdaptiveDialog>
            )
            : (
              <IconButton
                icon={<X />}
                aria-label="Close"
                variant="quiet"
                isDisabled={snapshot.hasTag("saving")}
                onPress={closeReview}
              />
            )}
        />
        <ReceiptMetadata
          metadata={review.parent}
          totalLabel={isManual
            ? "Total paid"
            : isMenu
            ? "Bill total"
            : undefined}
          onEdit={openMetadata}
        />
        <ReceiptReconciliation
          printed={isMenu &&
              moneyCompare(review.parent.printedTotal, "0") === 0
            ? selectedTotal
            : review.parent.printedTotal}
          selected={selectedTotal}
          difference={isMenu &&
              moneyCompare(review.parent.printedTotal, "0") === 0
            ? "0"
            : difference}
          currency={review.parent.currency}
          printedLabel={isManual
            ? "Total paid"
            : isMenu
            ? (moneyCompare(review.parent.printedTotal, "0") === 0
              ? "Bill total (optional)"
              : "Bill total")
            : undefined}
          selectedLabel={isManual
            ? "Items total"
            : isMenu
            ? "Selected items"
            : undefined}
          mismatchMessage={isManual
            ? "The item total does not yet match the total paid."
            : isMenu
            ? "The selected items do not match the bill total."
            : undefined}
        />
        {review.uncertainty.length && !isManual
          ? (
            <InlineNotice tone="warning" title="AI review notes">
              <List label="AI review notes">
                {review.uncertainty.map((item) => (
                  <ListRow key={item}>{item}</ListRow>
                ))}
              </List>
            </InlineNotice>
          )
          : null}
        {snapshot.matches("mismatch")
          ? (
            <InlineNotice
              tone="warning"
              title={isManual
                ? "Confirm the total mismatch"
                : isMenu
                ? "Confirm the bill-total mismatch"
                : "Confirm the printed-total mismatch"}
            >
              {isManual
                ? "The item total differs from the total paid. You can go back and edit the items or total, or explicitly confirm this mismatch."
                : isMenu
                ? "The selected items differ from the bill total. You can go back and edit them, or explicitly confirm this mismatch."
                : "The selected entries differ from the printed total. You can go back and edit them, or explicitly confirm this mismatch."}
              <Button
                onPress={() =>
                  send({ type: "receipt.review.confirm-mismatch" })}
              >
                Confirm mismatch and save
              </Button>
            </InlineNotice>
          )
          : null}
        {snapshot.matches("failed")
          ? (
            <InlineNotice tone="danger" title="Receipt was not saved">
              {snapshot.context.error?.message ?? "Try again."}
              <Text size="caption" tone="secondary">
                Error code: {snapshot.context.error?.code ?? "unknown"}
                {snapshot.context.error?.operation
                  ? ` · Operation: ${snapshot.context.error.operation}`
                  : ""}
              </Text>
              <Inline>
                <Button
                  variant="secondary"
                  onPress={() => send({ type: "receipt.review.retry" })}
                >
                  Retry
                </Button>
                <Button
                  variant="quiet"
                  onPress={() => send({ type: "receipt.review.discard" })}
                >
                  Discard review
                </Button>
              </Inline>
            </InlineNotice>
          )
          : null}
        <Stack
          gap={3}
          as="section"
          aria-label={isManual ? "Items" : undefined}
        >
          {isManual
            ? (
              <Inline justify="space-between">
                <Heading level={2} size="md">Items</Heading>
                <LineEditorDialog
                  line={newLine}
                  categories={categories}
                  linkOptions={links}
                  triggerLabel="Add item"
                  triggerVariant="secondary"
                  dialogTitle="Add receipt item"
                  manual
                  onSave={(line) =>
                    sendReview({
                      type: "receipt.review.add-line",
                      line: { ...line, selected: true },
                    })}
                />
              </Inline>
            )
            : null}
          {review.lines.map((line) => (
            <ReceiptLineCard
              key={line.id}
              line={lineViewModel(line, categories)}
              currency={review.parent.currency}
              mode={isManual ? "manual" : isMenu ? "menu" : "review"}
              onSelectedChange={isManual ? undefined : (selected) =>
                sendReview({
                  type: "receipt.review.select-line",
                  lineId: line.id,
                  selected,
                })}
              onQuantityChange={line.type === "purchase"
                ? (quantity) =>
                  sendReview({
                    type: "receipt.review.set-line-quantity",
                    lineId: line.id,
                    quantity,
                  })
                : undefined}
              categoryControl={
                <QuickCategoryDialog
                  line={line}
                  categories={categories}
                  isDisabled={snapshot.hasTag("saving")}
                  onSelect={(categoryId) =>
                    sendReview({
                      type: "receipt.review.edit-line",
                      line: { ...line, categoryId },
                    })}
                />
              }
              editControl={
                <LineEditorDialog
                  line={line}
                  categories={categories}
                  linkOptions={links}
                  triggerLabel="Edit"
                  onSave={(next) =>
                    sendReview({
                      type: "receipt.review.edit-line",
                      line: next,
                    })}
                  manual={isManual}
                />
              }
              onRemove={() =>
                sendReview({
                  type: "receipt.review.remove-line",
                  lineId: line.id,
                })}
            />
          ))}
        </Stack>
        {!isManual
          ? (
            <LineEditorDialog
              line={newLine}
              categories={categories}
              linkOptions={links}
              triggerLabel="Add missing line"
              triggerVariant="secondary"
              fullWidth
              onSave={(line) =>
                sendReview({ type: "receipt.review.add-line", line })}
            />
          )
          : null}
        <StickyActionBar>
          <Button
            pending={snapshot.matches("saving")}
            isDisabled={snapshot.hasTag("saving") ||
              snapshot.matches("failed") || selectedCount === 0}
            onPress={() => send({
              type: "receipt.review.submit",
              confirmMismatch: isMenu || snapshot.matches("mismatch"),
            })}
          >
            {isManual
              ? "Save receipt with " + selectedCount + " " +
                (selectedCount === 1 ? "item" : "items")
              : isMenu
              ? "Save " + selectedCount + " selected " +
                (selectedCount === 1 ? "item" : "items")
              : "Save " + selectedCount + " selected " +
                (selectedCount === 1 ? "entry" : "entries")}
          </Button>
        </StickyActionBar>
      </Stack>
      {metadataOpen
        ? (
          <ReceiptMetadataEditor
            parent={review.parent}
            onSave={updateParent}
            error={metadataError}
            onClose={closeMetadata}
            manual={isManual}
            menu={isMenu}
          />
        )
        : null}
    </ContentContainer>
  );
}

export function ReceiptMetadataEditor({
  parent,
  onSave,
  onClose,
  error,
  manual = false,
  menu = false,
}: {
  parent: ReceiptReviewDraft["parent"];
  onSave: (parent: ReceiptReviewDraft["parent"]) => void;
  onClose: () => void;
  error?: string;
  manual?: boolean;
  menu?: boolean;
}) {
  const [merchant, setMerchant] = useState(parent.merchant ?? "");
  const [date, setDate] = useState(parent.date);
  const [time, setTime] = useState(parent.time ?? "");
  const [currency, setCurrency] = useState(parent.currency);
  const [printedTotal, setPrintedTotal] = useState(
    menu
      ? (moneyCompare(parent.printedTotal, "0") === 0
        ? ""
        : unsignedDecimal(parent.printedTotal))
      : manual
      ? unsignedDecimal(parent.printedTotal)
      : parent.printedTotal,
  );
  return (
    <AdaptiveDialog
      trigger={
        <Button
          className="receipt-ui-dialog-trigger"
          aria-hidden="true"
          isDisabled
          variant="quiet"
        >
          Open metadata dialog
        </Button>
      }
      isOpen
      title={manual
        ? "Edit receipt details"
        : menu
        ? "Edit restaurant details"
        : "Edit receipt details"}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Stack gap={4}>
        <TextField
          autoFocus
          label="Merchant"
          placeholder="No merchant entered"
          description="Store, restaurant, or vendor name (optional)"
          value={merchant}
          onChange={setMerchant}
        />
        <div className="local-ui-form-row local-ui-form-row--date-time">
          <NativeDateField
            label="Date"
            value={date}
            onChange={(event) => setDate(event.currentTarget.value)}
          />
          <NativeTimeField
            label="Time (optional)"
            value={time}
            onChange={(event) => setTime(event.currentTarget.value)}
          />
        </div>
        <TextField label="Currency" value={currency} onChange={setCurrency} />
        <TextField
          label={manual
            ? "Total paid"
            : menu
            ? "Bill total (optional)"
            : "Printed receipt total"}
          value={printedTotal}
          onChange={setPrintedTotal}
          description={menu
            ? "Optional. Leave blank to automatically use the sum of your selected items."
            : undefined}
        />
        {error
          ? (
            <InlineNotice tone="danger" title="Check receipt details">
              {error}
            </InlineNotice>
          )
          : null}
        <FormActions>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            onPress={() =>
              onSave({
                ...parent,
                merchant: merchant.trim() || undefined,
                date,
                time: time.trim() || undefined,
                currency,
                printedTotal: manual
                  ? outflowDecimal(printedTotal)
                  : menu
                  ? (!printedTotal.trim() ? "0" : outflowDecimal(printedTotal))
                  : printedTotal,
              })}
          >
            Save details
          </Button>
        </FormActions>
      </Stack>
    </AdaptiveDialog>
  );
}
