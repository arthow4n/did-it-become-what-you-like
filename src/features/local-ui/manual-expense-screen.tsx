import { useActor } from "@xstate/react";
import type { SnapshotFrom } from "xstate";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ReceiptText, X } from "lucide-react";
import {
  createManualExpenseMachine,
  isDraftModified,
  type ManualExpenseDraft,
  type ManualExpenseEvent,
  type ManualExpenseOpenRequest,
  type ManualExpenseValidationErrors,
} from "../../actors/manual-expense.ts";
import type { LocalPort } from "../../adapters/ports/local.ts";
import { CurrencyCodeSchema, type Expense } from "../../domain/index.ts";
import type {
  ProjectCategoryService,
  ProjectCategoryState,
} from "../../domain/organization.ts";
import {
  Button,
  CategoryPicker,
  Checkbox,
  ContentContainer,
  CurrencyPicker,
  DraftStatus,
  ErrorSummary,
  ExpenseForm,
  FormActions,
  IconButton,
  Inline,
  InlineNotice,
  MerchantPicker,
  MoneyField,
  NativeDateField,
  NativeTimeField,
  PageHeader,
  ProjectPicker,
  Stack,
  TextField,
} from "../../design-system/index.ts";
import { useSyncStatus } from "../sync-ui/index.ts";
import { CURRENCY_OPTIONS } from "./types.ts";
import { LoadingScreen } from "./navigation.tsx";
export function ManualExpenseRecoveryScreen({
  message,
  onRetry,
  onClose,
  title = "New expense",
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
  title?: string;
}) {
  return (
    <ContentContainer size="readable">
      <Stack gap={4}>
        <PageHeader headingLevel={1} title={title} />
        <InlineNotice
          tone="danger"
          title="The expense form could not be opened"
          action={
            <Inline>
              <Button variant="secondary" onPress={onRetry}>
                Retry opening expense
              </Button>
              <Button variant="quiet" onPress={onClose}>
                Back to expenses
              </Button>
            </Inline>
          }
        >
          {message}
        </InlineNotice>
      </Stack>
    </ContentContainer>
  );
}
export function SavedExpenseCompletionScreen({
  expense,
  isUndoing,
  error,
  onUndo,
  onRetry,
  onContinue,
}: {
  expense: Expense;
  isUndoing: boolean;
  error?: string;
  onUndo: () => void;
  onRetry: () => void;
  onContinue: () => void;
}) {
  return (
    <ContentContainer size="readable">
      <Stack gap={4}>
        <PageHeader headingLevel={1} title="Expense saved" />
        <InlineNotice
          tone="positive"
          title="Saved on this device"
          action={
            <Inline justify="end">
              <Button
                variant="secondary"
                isDisabled={isUndoing}
                onPress={onUndo}
              >
                Undo saved expense
              </Button>
              <Button
                variant="quiet"
                isDisabled={isUndoing}
                onPress={onContinue}
              >
                Continue to expenses
              </Button>
            </Inline>
          }
        >
          {expense.merchant ?? "The expense"}{" "}
          is saved locally. You can undo it before returning to the expense
          list.
        </InlineNotice>
        {error
          ? (
            <InlineNotice
              tone="danger"
              title="Undo failed"
              action={
                <Button variant="secondary" onPress={onRetry}>
                  Retry undo
                </Button>
              }
            >
              {error}
            </InlineNotice>
          )
          : null}
      </Stack>
    </ContentContainer>
  );
}
export function ManualExpenseScreen({
  repository,
  service,
  state,
  request,
  onSaved,
  onManualReceipt,
  onUsefulAction,
  onDirtyChange,
  discardRequest,
  onClosed,
  expenseDayBoundary,
}: {
  repository: LocalPort;
  service: ProjectCategoryService;
  state: ProjectCategoryState;
  request: ManualExpenseOpenRequest;
  expenseDayBoundary?: string;
  onSaved: (expense: Expense) => void;
  onManualReceipt?: () => void;
  onUsefulAction?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  discardRequest?: number;
  onClosed: (status?: "deleted" | "saved") => void;
}) {
  const [machineKey, setMachineKey] = useState(0);
  const persistenceKey = request.expense
    ? `workflow:manual-expense:edit:${request.expense.id}`
    : undefined;
  const machine = useMemo(
    () =>
      createManualExpenseMachine({
        local: repository,
        organization: service,
        expenseDayBoundary,
      }),
    [repository, service, expenseDayBoundary, machineKey],
  );
  const [snapshot, send] = useActor(machine, {
    input: { persistenceKey, request },
  });
  const completionHandled = useRef(false);
  const usefulActionHandled = useRef(false);
  const notifiedResultId = useRef<string | null>(null);
  const savedResultId = useRef<string | null>(null);
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const syncStatus = useSyncStatus();
  const recentCategoryIds = useMemo(() => {
    const seen = new Set<string>();
    const recents: string[] = [];
    for (let i = state.expenses.length - 1; i >= 0; i--) {
      const catId = state.expenses[i]?.categoryId;
      if (catId && !seen.has(catId)) {
        seen.add(catId);
        recents.push(catId);
        if (recents.length >= 5) break;
      }
    }
    return recents;
  }, [state.expenses]);
  const recentMerchants = useMemo(() => {
    const seen = new Set<string>();
    const recents: string[] = [];
    for (let i = state.expenses.length - 1; i >= 0; i--) {
      const merchant = state.expenses[i]?.merchant?.trim();
      if (merchant && !seen.has(merchant.toLowerCase())) {
        seen.add(merchant.toLowerCase());
        recents.push(merchant);
        if (recents.length >= 5) break;
      }
    }
    return recents;
  }, [state.expenses]);
  useEffect(() => {
    if (snapshot.matches("idle") && !snapshot.context.draft) {
      send({ type: "expense.open", request });
    }
  }, [machineKey, request, send, snapshot]);
  useEffect(() => {
    const savedExpense = snapshot.context.result?.expense;
    const completedSave = savedExpense !== undefined &&
      snapshot.matches("saved");
    if (completedSave && notifiedResultId.current !== savedExpense.id) {
      notifiedResultId.current = savedExpense.id;
      syncStatus?.notifyLocalMutation();
    }
    if (completedSave && savedResultId.current !== savedExpense.id) {
      savedResultId.current = savedExpense.id;
      onSaved(savedExpense);
      send({ type: "expense.finish-save" });
    }
    if (completionHandled.current) return;
    if (snapshot.matches("deleted")) {
      send({ type: "expense.finish-delete" });
      return;
    }
    if (
      snapshot.matches("discarded") || snapshot.matches("cancelled") ||
      snapshot.matches("deletedOutput") || snapshot.matches("savedOutput") ||
      snapshot.matches("savedUndone")
    ) {
      completionHandled.current = true;
      onClosed(
        snapshot.matches("deletedOutput")
          ? "deleted"
          : snapshot.matches("savedOutput")
          ? "saved"
          : undefined,
      );
    }
  }, [onClosed, onSaved, send, snapshot, syncStatus]);
  const isModified = isDraftModified(
    snapshot.context.draft,
    snapshot.context.originalExpense,
  );
  const dirty = snapshot.hasTag("dirty") && isModified;
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  const lastDirtyRef = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (snapshot.matches("idle")) return;
    if (lastDirtyRef.current !== dirty) {
      lastDirtyRef.current = dirty;
      onDirtyChangeRef.current?.(dirty);
    }
  }, [dirty, snapshot]);
  useEffect(() => {
    if (
      discardRequest === undefined ||
      discardRequest === handledDiscardRequest.current
    ) return;
    handledDiscardRequest.current = discardRequest;
    send({ type: "expense.discard" });
    send({ type: "expense.confirm-discard" });
  }, [discardRequest, send]);
  useEffect(() => {
    if (
      usefulActionHandled.current || !snapshot.context.result?.expense ||
      !snapshot.matches("saved")
    ) return;
    usefulActionHandled.current = true;
    onUsefulAction?.();
  }, [onUsefulAction, snapshot]);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    return () => globalThis.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
  const draft = snapshot.context.draft;
  const savedExpense = snapshot.context.result?.expense;
  if (
    (snapshot.matches("saved") || snapshot.matches("undoingSaved") ||
      snapshot.matches("savedUndoFailed")) &&
    savedExpense
  ) {
    return (
      <SavedExpenseCompletionScreen
        expense={savedExpense}
        isUndoing={snapshot.matches("undoingSaved")}
        error={snapshot.context.error?.message}
        onUndo={() => send({ type: "expense.undo-saved" })}
        onRetry={() => send({ type: "expense.retry-undo" })}
        onContinue={() => send({ type: "expense.finish-save" })}
      />
    );
  }
  const retryOpening = () => {
    setMachineKey((value) => value + 1);
  };
  if (snapshot.matches("openingAnotherFailed")) {
    return (
      <ManualExpenseRecoveryScreen
        message={snapshot.context.error?.message ??
          "The next expense form could not be opened."}
        title="Expense saved"
        onRetry={() => send({ type: "expense.retry" })}
        onClose={() => send({ type: "expense.finish-save" })}
      />
    );
  }
  if (
    (snapshot.matches("hydrateFailed") || snapshot.matches("openFailed") ||
      snapshot.matches("draftSaveFailed")) &&
    draft === null
  ) {
    return (
      <ManualExpenseRecoveryScreen
        message={snapshot.context.error?.message ??
          "Local draft data could not be restored."}
        title={request.expense ? "Edit expense" : "New expense"}
        onRetry={retryOpening}
        onClose={onClosed}
      />
    );
  }
  if (draft === null) {
    return (
      <LoadingScreen title={request.expense ? "Edit expense" : "New expense"} />
    );
  }
  return (
    <ManualExpenseFormContent
      snapshot={snapshot}
      send={send}
      state={state}
      draft={draft}
      recentCategoryIds={recentCategoryIds}
      recentMerchants={recentMerchants}
      onManualReceipt={onManualReceipt}
    />
  );
}
type ManualExpenseSnapshot = SnapshotFrom<
  ReturnType<typeof createManualExpenseMachine>
>;
function ManualExpenseFormContent({
  snapshot,
  send,
  state,
  draft,
  recentCategoryIds,
  recentMerchants,
  onManualReceipt,
}: {
  snapshot: ManualExpenseSnapshot;
  send: (event: ManualExpenseEvent) => void;
  state: ProjectCategoryState;
  draft: ManualExpenseDraft;
  recentCategoryIds: string[];
  recentMerchants: string[];
  onManualReceipt?: () => void;
}) {
  const categories = useMemo(() => {
    return state.categories.filter((category) =>
      !category.archived || category.id === draft.categoryId
    ).map((category) => ({ id: category.id, label: category.name }));
  }, [state.categories, draft.categoryId]);
  const projects = useMemo(() => {
    return state.projects.filter((project) =>
      !project.archived || project.id === draft.projectId
    ).map((project) => ({ id: project.id, label: project.name }));
  }, [state.projects, draft.projectId]);
  const currencyOptions = useMemo(
    () => CURRENCY_OPTIONS.map((code) => ({ id: code, label: code })),
    [],
  );
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const update = useCallback((changes: Partial<ManualExpenseDraft>) => {
    if (draftRef.current) {
      const nextDraft = { ...draftRef.current, ...changes };
      draftRef.current = nextDraft;
      send({
        type: "expense.change",
        draft: nextDraft,
      });
    }
  }, [send]);
  const handleAmountChange = useCallback((value: string) => {
    update({ amount: value });
  }, [update]);
  const handleCurrencyChange = useCallback((value: string) => {
    update({ currency: CurrencyCodeSchema.parse(value) });
  }, [update]);
  const handleMerchantChange = useCallback((value: string) => {
    update({ merchant: value });
  }, [update]);
  const handleDescriptionChange = useCallback((value: string) => {
    update({ description: value });
  }, [update]);
  const handleCategoryChange = useCallback((value: string) => {
    update({ categoryId: value });
  }, [update]);
  const handleDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      update({ date: event.currentTarget.value });
    },
    [update],
  );
  const handleTimeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      update({ time: event.currentTarget.value || undefined });
    },
    [update],
  );
  const handleProjectChange = useCallback((value: string) => {
    update({ projectId: value });
  }, [update]);
  const handleDirectionChange = useCallback((selected: boolean) => {
    update({ direction: selected ? "money-back" : "spent" });
  }, [update]);
  const isModified = isDraftModified(
    draft,
    snapshot.context.originalExpense,
  );
  const validation = snapshot.context
    .validation as ManualExpenseValidationErrors;
  const busy = snapshot.hasTag("saving");
  const draftSaveFailed = snapshot.matches("draftSaveFailed");
  const saveFailed = snapshot.matches("saveFailed") ||
    snapshot.matches("saveAnotherFailed");
  const failed = draftSaveFailed || saveFailed;
  const deleteFailed = snapshot.matches("deleteFailed");
  const formLocked = busy || deleteFailed ||
    snapshot.hasTag("confirming-delete") ||
    snapshot.hasTag("confirming-discard") || snapshot.matches("discardFailed");
  const errors = Object.entries(validation).map(([id, message]) => ({
    id,
    message,
  }));
  return (
    <ContentContainer size="form">
      <Stack gap={3} className="local-ui-manual-expense">
        {snapshot.context.originalExpense
          ? (
            <PageHeader
              headingLevel={1}
              title="Edit expense"
              leading={
                <IconButton
                  icon={<X />}
                  aria-label="Close"
                  variant="quiet"
                  isDisabled={formLocked}
                  onPress={() => send({ type: "expense.back" })}
                />
              }
            />
          )
          : (
            <div className="local-ui-manual-expense__header">
              <PageHeader
                headingLevel={1}
                title="New expense"
                actions={onManualReceipt
                  ? (
                    <IconButton
                      icon={<ReceiptText size={18} />}
                      aria-label="Enter receipt manually"
                      title="Enter receipt manually"
                      variant="quiet"
                      onPress={onManualReceipt}
                    />
                  )
                  : undefined}
              />
            </div>
          )}
        <div className="local-ui-manual-expense__form">
          <ExpenseForm
            stickyActions
            status={snapshot.matches("discardConfirming")
              ? (
                <InlineNotice tone="warning" title="Discard unsaved changes?">
                  <FormActions className="local-ui-delete-actions">
                    <Button
                      variant="danger"
                      onPress={() => send({ type: "expense.confirm-discard" })}
                    >
                      Discard changes
                    </Button>
                    <Button
                      variant="quiet"
                      onPress={() => send({ type: "expense.keep-editing" })}
                    >
                      Keep editing
                    </Button>
                  </FormActions>
                </InlineNotice>
              )
              : failed || deleteFailed || busy || isModified
              ? (
                <DraftStatus
                  state={failed || deleteFailed
                    ? "failed"
                    : busy
                    ? "saving"
                    : "dirty"}
                  detail={failed || deleteFailed
                    ? snapshot.context.error?.message
                    : busy
                    ? "Saving expense…"
                    : undefined}
                  action={saveFailed
                    ? (
                      <Button
                        variant="secondary"
                        onPress={() => send({ type: "expense.retry" })}
                      >
                        Retry save
                      </Button>
                    )
                    : isModified && !formLocked
                    ? (
                      <Button
                        variant="quiet"
                        onPress={() => send({ type: "expense.discard" })}
                      >
                        Discard draft
                      </Button>
                    )
                    : undefined}
                />
              )
              : undefined}
            actions={
              <Button
                pending={busy}
                isDisabled={formLocked}
                onPress={() => send({ type: "expense.submit" })}
              >
                Save expense
              </Button>
            }
          >
            {errors.length ? <ErrorSummary errors={errors} /> : null}
            <div className="local-ui-form-row local-ui-form-row--amount-currency">
              <MoneyField
                autoFocus
                label="Amount"
                isRequired
                value={draft.amount}
                isDisabled={formLocked}
                onChange={handleAmountChange}
                currency={draft.currency}
                error={validation.amount}
              />
              <CurrencyPicker
                value={draft.currency}
                options={currencyOptions}
                onValueChange={handleCurrencyChange}
                isDisabled={formLocked}
              />
            </div>
            <MerchantPicker
              value={draft.merchant ?? ""}
              onValueChange={handleMerchantChange}
              isDisabled={formLocked}
              recentMerchants={recentMerchants}
            />
            <TextField
              label="Description (optional)"
              value={draft.description}
              onChange={handleDescriptionChange}
              error={validation.description}
              isDisabled={formLocked}
            />
            <CategoryPicker
              label=""
              categories={categories}
              value={draft.categoryId}
              recentCategoryIds={recentCategoryIds}
              onValueChange={handleCategoryChange}
              error={validation.categoryId}
              isDisabled={formLocked}
            />
            <div className="local-ui-form-row local-ui-form-row--date-time">
              <NativeDateField
                label="Date"
                required
                value={draft.date}
                onChange={handleDateChange}
                error={validation.date}
                disabled={formLocked}
              />
              <NativeTimeField
                label="Time (optional)"
                value={draft.time ?? ""}
                onChange={handleTimeChange}
                error={validation.time}
                disabled={formLocked}
              />
            </div>
            <ProjectPicker
              options={projects}
              value={draft.projectId}
              onValueChange={handleProjectChange}
              isDisabled={formLocked}
            />
            <Checkbox
              isSelected={draft.direction === "money-back"}
              isDisabled={formLocked}
              onChange={handleDirectionChange}
            >
              Money back
            </Checkbox>
          </ExpenseForm>
        </div>
        {snapshot.matches("discardFailed")
          ? (
            <InlineNotice tone="danger" title="Changes were not discarded">
              <Button
                variant="secondary"
                onPress={() => send({ type: "expense.retry-discard" })}
              >
                Retry discard
              </Button>
            </InlineNotice>
          )
          : null}
        {snapshot.context.originalExpense &&
            !snapshot.matches("deleteConfirming") &&
            !deleteFailed
          ? (
            <FormActions className="local-ui-delete-actions">
              <Button
                variant="quiet"
                isDisabled={formLocked}
                onPress={() => send({ type: "expense.delete" })}
              >
                Delete this expense
              </Button>
            </FormActions>
          )
          : null}
        {snapshot.matches("deleteConfirming")
          ? (
            <InlineNotice tone="danger" title="Delete this expense?">
              <FormActions className="local-ui-delete-actions">
                <Button
                  variant="danger"
                  onPress={() => send({ type: "expense.confirm-delete" })}
                >
                  Delete expense
                </Button>
                <Button
                  variant="quiet"
                  onPress={() => send({ type: "expense.cancel-delete" })}
                >
                  Keep expense
                </Button>
              </FormActions>
            </InlineNotice>
          )
          : null}
        {deleteFailed
          ? (
            <InlineNotice tone="danger" title="Expense deletion failed">
              {snapshot.context.error?.message ??
                "The expense could not be deleted."}
              <FormActions className="local-ui-delete-actions">
                <Button
                  variant="secondary"
                  onPress={() => send({ type: "expense.retry-delete" })}
                >
                  Retry deletion
                </Button>
                <Button
                  variant="quiet"
                  onPress={() => send({ type: "expense.cancel-delete" })}
                >
                  Keep expense
                </Button>
              </FormActions>
            </InlineNotice>
          )
          : null}
      </Stack>
    </ContentContainer>
  );
}
