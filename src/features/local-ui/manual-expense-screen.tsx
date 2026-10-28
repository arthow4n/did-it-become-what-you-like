import { useActorRef, useSelector } from "@xstate/react";
import type { ActorRefFrom, SnapshotFrom } from "xstate";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReceiptText, X } from "lucide-react";
import {
  createManualExpenseMachine,
  currentProject,
  DEFAULT_EXPENSE_DAY_BOUNDARY,
  isDraftModified,
  type ManualExpenseOpenRequest,
  type ManualExpenseValidationErrors,
} from "../../actors/manual-expense.ts";
import type { LocalPort } from "../../adapters/ports/local.ts";
import { type Expense, UNCATEGORIZED_CATEGORY_ID } from "../../domain/index.ts";
import {
  expenseDateForLocalNow,
  expenseTimeForLocalNow,
} from "../../domain/queries/calendar.ts";
import type {
  ProjectCategoryService,
  ProjectCategoryState,
} from "../../domain/organization.ts";
import {
  Button,
  ContentContainer,
  DraftStatus,
  ErrorSummary,
  ExpenseForm,
  FormActions,
  IconButton,
  Inline,
  InlineNotice,
  PageHeader,
  Stack,
} from "../../design-system/index.ts";
import { useSyncStatus } from "../sync-ui/index.ts";
import { ManualExpenseFields } from "./manual-expense-fields.tsx";
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
export const ManualExpenseScreen = memo(function ManualExpenseScreen({
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
  const synchronousInitialDraft = useMemo(() => {
    if (request.expense || request.initialDraft) return null;
    try {
      const project = currentProject(state, request.projectId);
      const boundary = expenseDayBoundary ?? DEFAULT_EXPENSE_DAY_BOUNDARY;
      const now = new Date();
      return {
        projectId: project.id,
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        date: expenseDateForLocalNow(now, boundary),
        time: expenseTimeForLocalNow(now),
        amount: "",
        currency: project.defaultCurrency,
        description: "",
        direction: "spent" as const,
      };
    } catch {
      return null;
    }
  }, [request, state, expenseDayBoundary]);
  const effectiveRequest = useMemo(() => {
    if (synchronousInitialDraft) {
      return { ...request, initialDraft: synchronousInitialDraft };
    }
    return request;
  }, [request, synchronousInitialDraft]);
  const machine = useMemo(
    () =>
      createManualExpenseMachine({
        local: repository,
        organization: service,
        expenseDayBoundary,
      }),
    [repository, service, expenseDayBoundary, machineKey],
  );
  const actor = useActorRef(machine, {
    input: { persistenceKey, request: effectiveRequest },
  });
  // Field values subscribe below. A keystroke must not rebuild the form host,
  // status panels, or shell; they only need workflow and feedback changes.
  const snapshot = useSelector(actor, (value) => value, sameFormStatus);
  const send = actor.send;
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
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const onManualReceiptRef = useRef(onManualReceipt);
  onManualReceiptRef.current = onManualReceipt;
  const onUsefulActionRef = useRef(onUsefulAction);
  onUsefulActionRef.current = onUsefulAction;
  const handleManualReceipt = useCallback(() => {
    onManualReceiptRef.current?.();
  }, []);
  useEffect(() => {
    if (snapshot.matches("idle") && !snapshot.context.draft) {
      send({ type: "expense.open", request: effectiveRequest });
    }
  }, [machineKey, effectiveRequest, send, snapshot]);
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
      onSavedRef.current(savedExpense);
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
      onClosedRef.current(
        snapshot.matches("deletedOutput")
          ? "deleted"
          : snapshot.matches("savedOutput")
          ? "saved"
          : undefined,
      );
    }
  }, [send, snapshot, syncStatus]);
  const dirty = useSelector(actor, (value) =>
    value.hasTag("dirty") &&
    isDraftModified(value.context.draft, value.context.originalExpense));
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
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
    send({ type: "expense.discard" });
    send({ type: "expense.confirm-discard" });
  }, [discardRequest, send]);
  useEffect(() => {
    if (
      usefulActionHandled.current || !snapshot.context.result?.expense ||
      !snapshot.matches("saved")
    ) return;
    usefulActionHandled.current = true;
    onUsefulActionRef.current?.();
  }, [snapshot]);
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
        onClose={() => onClosedRef.current()}
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
      actor={actor}
      recentCategoryIds={recentCategoryIds}
      recentMerchants={recentMerchants}
      onManualReceipt={onManualReceipt ? handleManualReceipt : undefined}
    />
  );
}, (prev, next) =>
  prev.repository === next.repository &&
  prev.service === next.service &&
  prev.state === next.state &&
  prev.request === next.request &&
  prev.expenseDayBoundary === next.expenseDayBoundary &&
  prev.discardRequest === next.discardRequest &&
  Boolean(prev.onManualReceipt) === Boolean(next.onManualReceipt));
type ManualExpenseSnapshot = SnapshotFrom<
  ReturnType<typeof createManualExpenseMachine>
>;
export type ManualExpenseActor = ActorRefFrom<
  ReturnType<typeof createManualExpenseMachine>
>;

function sameFormStatus(a: ManualExpenseSnapshot, b: ManualExpenseSnapshot) {
  return a.value === b.value &&
    a.context.originalExpense === b.context.originalExpense &&
    a.context.result === b.context.result &&
    a.context.error === b.context.error &&
    (a.context.draft === null) === (b.context.draft === null) &&
    a.context.validation === b.context.validation;
}

function ManualExpenseFormContent({
  snapshot,
  send,
  state,
  actor,
  recentCategoryIds,
  recentMerchants,
  onManualReceipt,
}: {
  snapshot: ManualExpenseSnapshot;
  send: ManualExpenseActor["send"];
  state: ProjectCategoryState;
  actor: ManualExpenseActor;
  recentCategoryIds: string[];
  recentMerchants: string[];
  onManualReceipt?: () => void;
}) {
  const handleSubmit = useCallback(() => {
    send({ type: "expense.submit" });
  }, [send]);

  const handleBack = useCallback(() => {
    send({ type: "expense.back" });
  }, [send]);

  const handleConfirmDiscard = useCallback(() => {
    send({ type: "expense.confirm-discard" });
  }, [send]);

  const handleKeepEditing = useCallback(() => {
    send({ type: "expense.keep-editing" });
  }, [send]);

  const handleRetrySave = useCallback(() => {
    send({ type: "expense.retry" });
  }, [send]);

  const handleDelete = useCallback(() => {
    send({ type: "expense.delete" });
  }, [send]);

  const handleConfirmDelete = useCallback(() => {
    send({ type: "expense.confirm-delete" });
  }, [send]);

  const validation = snapshot.context
    .validation as ManualExpenseValidationErrors;
  const busy = snapshot.hasTag("saving");
  const draftSaveFailed = snapshot.matches("draftSaveFailed");
  const saveFailed = snapshot.matches("saveFailed") ||
    snapshot.matches("saveAnotherFailed");
  const failed = draftSaveFailed || saveFailed;
  const deleteFailed = snapshot.matches("deleteFailed");
  const discardConfirming = snapshot.matches("discardConfirming");
  const formLocked = busy || deleteFailed ||
    snapshot.hasTag("confirming-delete") ||
    snapshot.hasTag("confirming-discard") || snapshot.matches("discardFailed");
  const errors = useMemo(
    () =>
      Object.entries(validation).map(([id, message]) => ({
        id,
        message,
      })),
    [validation],
  );
  const errorMessage = snapshot.context.error?.message;
  const statusNode = useMemo(() => {
    if (discardConfirming) {
      return (
        <InlineNotice tone="warning" title="Discard unsaved changes?">
          <FormActions className="local-ui-delete-actions">
            <Button
              variant="danger"
              onPress={handleConfirmDiscard}
            >
              Discard changes
            </Button>
            <Button
              variant="quiet"
              onPress={handleKeepEditing}
            >
              Keep editing
            </Button>
          </FormActions>
        </InlineNotice>
      );
    }
    if (failed) {
      return (
        <DraftStatus
          state="failed"
          detail={errorMessage}
          action={saveFailed
            ? (
              <Button
                variant="secondary"
                onPress={handleRetrySave}
              >
                Retry save
              </Button>
            )
            : undefined}
        />
      );
    }
    return undefined;
  }, [
    discardConfirming,
    errorMessage,
    failed,
    handleConfirmDiscard,
    handleKeepEditing,
    handleRetrySave,
    saveFailed,
  ]);
  const actionsNode = useMemo(
    () => (
      <Button
        pending={busy}
        isDisabled={formLocked}
        onPress={handleSubmit}
      >
        Save expense
      </Button>
    ),
    [busy, formLocked, handleSubmit],
  );
  const isEditingExisting = snapshot.context.originalExpense !== null;
  const headerNode = useMemo(
    () =>
      isEditingExisting
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
                onPress={handleBack}
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
        ),
    [formLocked, handleBack, isEditingExisting, onManualReceipt],
  );
  return (
    <ContentContainer size="form">
      <Stack gap={3} className="local-ui-manual-expense">
        {headerNode}
        <div className="local-ui-manual-expense__form">
          <ExpenseForm
            stickyActions
            status={statusNode}
            actions={actionsNode}
          >
            {errors.length ? <ErrorSummary errors={errors} /> : null}
            <ManualExpenseFields
              actor={actor}
              state={state}
              validation={validation}
              isDisabled={formLocked}
              recentCategoryIds={recentCategoryIds}
              recentMerchants={recentMerchants}
            />
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
                onPress={handleDelete}
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
                  onPress={handleConfirmDelete}
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
