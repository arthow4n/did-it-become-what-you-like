import { useActor } from "@xstate/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import {
  createProjectCategoryService,
  type ProjectCategoryService,
  type ProjectCategoryState,
} from "../domain/organization.ts";
import {
  type ExpensePeriod,
  type ExpenseQueryResult,
  queryExpenses,
} from "../domain/queries/index.ts";
import {
  CalendarDateSchema,
  type Category,
  CurrencyCodeSchema,
  type DeviceLocalSettings,
  type Expense,
  PortableSettingsSchema,
  type Project,
} from "../domain/index.ts";
import {
  createManualExpenseMachine,
  type ManualExpenseDraft,
  type ManualExpenseEvent,
  type ManualExpenseOpenRequest,
} from "../actors/manual-expense.ts";
import {
  createCategoryOrganizationMachine,
  createProjectOrganizationMachine,
} from "../actors/project-category.ts";
import {
  ActionCard,
  ActiveFilterChips,
  AppFrame,
  Badge,
  Banner,
  Button,
  Card,
  CategoryBreakdown,
  ColorChoiceField,
  ConfirmDialog,
  ContentContainer,
  CurrencyPicker,
  DefaultNavigation,
  Disclosure,
  DraftStatus,
  EmptyState,
  ErrorSummary,
  ExpenseForm,
  ExpenseList,
  FilterBar,
  FilterSheet,
  FormActions,
  GlobalStatus,
  Heading,
  Icon,
  IconButton,
  Inline,
  InlineNotice,
  List,
  ListRow,
  MerchantPicker,
  MoneyField,
  MoneySummary,
  NativeDateField,
  NativeTimeField,
  PageHeader,
  PeriodPicker,
  ProjectPicker,
  ReceiptGroup,
  SearchField,
  SegmentedControl,
  SelectField,
  Skeleton,
  Stack,
  Text,
  TextArea,
  TextField,
  Toast,
} from "../design-system/index.ts";
import {
  createDefaultReceiptUiDependencies,
  GeminiSettingsScreen,
  readDeviceLocalSettings,
  ReceiptImageStore,
  ReceiptReviewScreen,
  ReceiptScanScreen,
  type ReceiptUiDependencies,
  writeDeviceLocalSettings,
} from "./receipt-ui.tsx";
import {
  SyncPortabilityRuntime,
  type SyncPortabilityScreen,
} from "./sync-portability-runtime.tsx";
import type { ReceiptReviewDraft } from "../domain/receipt.ts";
import {
  createLocalShellMachine,
  type LocalShellEvent,
} from "../actors/local-shell.ts";
import type { ShellRoute } from "../actors/contracts/index.ts";
import {
  type LocalRepository,
  openLocalRepository,
} from "../adapters/local/index.ts";
import { hashForRoute, routeFromHash } from "../app/routing.ts";

export type LocalUiPath =
  | "/first-use"
  | "/expenses"
  | "/add"
  | "/expense/new"
  | "/organize"
  | "/projects"
  | "/categories"
  | "/settings"
  | "/settings/gemini"
  | "/settings/sync"
  | "/settings/devices"
  | "/settings/conflicts"
  | "/settings/import-export"
  | "/receipt/scan"
  | "/receipt/review";

function shellRouteForPath(path: string): ShellRoute {
  if (path === "/first-use") return "first-use";
  if (path === "/add") return "add";
  if (path.startsWith("/expense/")) return "expense-form";
  if (path === "/organize") return "organize";
  if (path === "/projects") return "projects";
  if (path === "/categories") return "categories";
  if (path.startsWith("/settings")) return "settings";
  return "expenses";
}

function pathFromHash(): string {
  return globalThis.location.hash === ""
    ? ""
    : routeFromHash(globalThis.location.hash);
}

export function FirstUseScreen({
  onCreateProject,
  onRestoreBackup,
  onConnectDrive,
}: {
  onCreateProject?: () => void;
  onRestoreBackup?: () => void;
  onConnectDrive?: () => void;
}) {
  return (
    <ContentContainer size="readable">
      <Stack gap={8} className="local-ui-first-use">
        <Stack gap={3}>
          <Text size="label" tone="muted">After Midnight</Text>
          <Heading level={1} size="lg">Start tracking expenses</Heading>
          <Text tone="secondary">
            Keep your expense history on this device, with sync and scanning
            available when you choose them.
          </Text>
        </Stack>
        <Stack gap={3}>
          <ActionCard
            title="Create first project"
            description="Start with local data."
            onPress={onCreateProject}
          />
          <ActionCard
            title="Restore JSON backup"
            description="Validate and preview before import."
            onPress={onRestoreBackup}
          />
          <ActionCard
            title="Connect Google Drive"
            description="Continue with synchronized data."
            onPress={onConnectDrive}
          />
        </Stack>
        <InlineNotice tone="info" title="Local first">
          You can create and review expenses without an account or internet
          connection.
        </InlineNotice>
      </Stack>
    </ContentContainer>
  );
}

function LoadingScreen() {
  return (
    <ContentContainer size="readable">
      <Stack gap={4}>
        <Skeleton style={{ width: "12rem", height: "2rem" }} />
        <Skeleton style={{ width: "100%", height: "6rem" }} />
        <Text tone="secondary">Loading local data…</Text>
      </Stack>
    </ContentContainer>
  );
}

const CURRENCY_OPTIONS = ["SEK", "EUR", "USD", "GBP", "JPY", "TWD"];

type CustomPeriodKind = "day" | "month" | "year";

function localCalendarDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodForValue(
  value: string,
  customKind: CustomPeriodKind,
  customDate: string,
): ExpensePeriod {
  if (value === "today") {
    return { kind: "current", unit: "day", now: new Date() };
  }
  if (value === "year") {
    return { kind: "current", unit: "year", now: new Date() };
  }
  if (value === "month") {
    return { kind: "current", unit: "month", now: new Date() };
  }
  if (value !== "custom") {
    return { kind: "current", unit: "month", now: new Date() };
  }
  const parsedDate = CalendarDateSchema.safeParse(customDate);
  const date = parsedDate.success ? parsedDate.data : localCalendarDate();
  if (customKind === "day") return { kind: "day", date };
  const [year, month] = date.split("-").map(Number);
  return customKind === "month"
    ? { kind: "month", year, month }
    : { kind: "year", year };
}

function expenseViewModel(
  item: ExpenseQueryResult["expenses"][number],
) {
  return {
    id: item.id,
    merchant: item.merchant,
    description: item.description,
    category: item.categoryId,
    amount: item.amount,
    currency: item.currency,
    date: item.date,
    time: item.time,
  };
}

export function AddChoiceScreen({
  offline,
  onClose,
  onManual,
  onScan,
}: {
  offline: boolean;
  onClose: () => void;
  onManual: () => void;
  onScan?: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const skipRestoreRef = useRef(false);

  useEffect(() => {
    const active = document.activeElement;
    if (active && typeof (active as HTMLElement).focus === "function") {
      previousFocusRef.current = active as HTMLElement;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    const firstFocusable = dialog.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (firstFocusable ?? dialog).focus();
    return () => {
      if (skipRestoreRef.current) return;
      const previous = previousFocusRef.current;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const leaveForManualEntry = () => {
    skipRestoreRef.current = true;
    onManual();
  };

  return (
    <div
      ref={dialogRef}
      className="local-ui-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add an expense"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
        if (event.key !== "Tab") return;
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getAttribute("aria-disabled") !== "true");
        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const activeIndex = focusable.indexOf(
          document.activeElement as HTMLElement,
        );
        const nextIndex = event.shiftKey
          ? activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1
          : activeIndex < 0 || activeIndex === focusable.length - 1
          ? 0
          : activeIndex + 1;
        event.preventDefault();
        focusable[nextIndex].focus();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card
        className="local-ui-add-choice"
        as="section"
      >
        <PageHeader
          headingLevel={2}
          title="Add an expense"
          actions={
            <IconButton aria-label="Close" icon={<X />} onPress={onClose} />
          }
        />
        <Stack gap={3}>
          <ActionCard
            title="Add manually"
            description="Enter the details locally."
            icon={<Plus />}
            onPress={leaveForManualEntry}
          />
          <ActionCard
            title="Scan receipt with AI"
            description={offline
              ? "Connect to the internet to scan with AI."
              : "Use a camera or image. The receipt is sent to Gemini."}
            icon={<Search />}
            isDisabled={offline}
            onPress={() => {
              skipRestoreRef.current = true;
              onScan?.();
            }}
          />
        </Stack>
      </Card>
    </div>
  );
}

export function ExpensesScreen({
  state,
  expenseDayBoundary,
  offline,
  onAdd,
  onEdit,
  onProjectChange,
}: {
  state: ProjectCategoryState;
  expenseDayBoundary: string;
  offline: boolean;
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onProjectChange: (projectId: string) => void;
}) {
  const currentProject =
    state.projects.find((project) => project.id === state.selectedProjectId) ??
      state.projects.find((project) => !project.archived);
  const [period, setPeriod] = useState("month");
  const [customPeriodKind, setCustomPeriodKind] = useState<CustomPeriodKind>(
    "day",
  );
  const [customPeriodDate, setCustomPeriodDate] = useState(localCalendarDate);
  const [categoryId, setCategoryId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");

  const result = currentProject
    ? queryExpenses(
      {
        expenses: state.expenses,
        receipts: state.receipts,
        receiptPurchaseLines: state.receiptPurchaseLines,
        receiptAdjustments: state.receiptAdjustments,
        categories: state.categories,
        settings: { expenseDayBoundary },
      },
      {
        selectedProjectId: currentProject.id,
        period: periodForValue(
          period,
          customPeriodKind,
          customPeriodDate,
        ),
        ...(categoryId ? { categoryId } : {}),
        ...(currency ? { currency } : {}),
        ...(search ? { search } : {}),
        sort,
        ...(minimum || maximum
          ? {
            amountRange: {
              ...(minimum ? { min: minimum } : {}),
              ...(maximum ? { max: maximum } : {}),
            },
          }
          : {}),
      },
    )
    : { expenses: [], receiptGroups: [], totals: [], categoryBreakdown: [] };

  const categoryById = new Map(
    state.categories.map((category) => [category.id, category.name]),
  );
  const projectOptions = state.projects.filter((project) => !project.archived)
    .map((project) => ({ id: project.id, label: project.name }));
  const activeCategories = state.categories.filter((category) =>
    !category.archived || category.id === categoryId
  );
  const categories = result.categoryBreakdown.slice(0, 3).map((category) => ({
    id: category.categoryId,
    name: category.categoryName,
    amount: category.amount,
    currency: category.currency,
  }));
  const totals = result.totals.length
    ? result.totals.flatMap((total) => [
      {
        label: `Net spent · ${total.currency}`,
        amount: total.net,
        currency: total.currency,
        tone: "negative" as const,
      },
      {
        label: `Outflows · ${total.currency}`,
        amount: total.outflow,
        currency: total.currency,
        tone: "negative" as const,
      },
      {
        label: `Money back · ${total.currency}`,
        amount: total.moneyBack,
        currency: total.currency,
        tone: "positive" as const,
      },
    ])
    : [{
      label: "Net spent",
      amount: "0",
      currency: currentProject?.defaultCurrency ?? "SEK",
      tone: "neutral" as const,
    }];
  const plainExpenses = result.expenses.filter((item) =>
    item.receiptId === undefined
  )
    .map((item) => ({
      ...expenseViewModel(item),
      category: categoryById.get(item.categoryId) ?? item.categoryId,
    }));

  const removeCategory = () => setCategoryId("");
  const removeCurrency = () => setCurrency("");
  const removeSearch = () => setSearch("");

  return (
    <ContentContainer>
      <Stack gap={5}>
        <PageHeader
          headingLevel={1}
          title="Expenses"
          eyebrow={currentProject?.name ?? "Local project"}
          description="Review the selected project and calendar period."
          status={
            <GlobalStatus
              status={offline ? "offline" : "synced"}
              detail={offline
                ? "Local browsing and saving remain available."
                : "Saved on this device."}
            />
          }
          actions={<Button onPress={onAdd}>Add expense</Button>}
        />
        {offline
          ? (
            <Banner tone="warning" title="Offline">
              Local browsing and manual entry are available. AI scanning and
              Drive sync will resume when you reconnect.
            </Banner>
          )
          : null}
        <ProjectPicker
          value={currentProject?.id}
          options={projectOptions}
          onValueChange={onProjectChange}
        />
        <FilterBar className="local-ui-expenses-filter-bar">
          <PeriodPicker
            value={period}
            onValueChange={setPeriod}
            customKind={customPeriodKind}
            customDate={customPeriodDate}
            onCustomKindChange={setCustomPeriodKind}
            onCustomDateChange={setCustomPeriodDate}
          />
          <SelectField
            label="Category"
            options={[
              { id: "all", label: "All categories" },
              ...activeCategories.map((category) => ({
                id: category.id,
                label: category.name,
              })),
            ]}
            value={categoryId || "all"}
            onValueChange={(value) =>
              setCategoryId(value === "all" ? "" : value)}
          />
          <SearchField
            label="Find"
            placeholder="Merchant or description"
            value={search}
            onValueChange={setSearch}
          />
          <FilterSheet
            trigger={
              <Button variant="secondary">
                <Icon>
                  <SlidersHorizontal />
                </Icon>{" "}
                Filters
              </Button>
            }
          >
            <Stack gap={4}>
              <CurrencyPicker
                value={currency || "all"}
                options={[
                  { id: "all", label: "All currencies" },
                  ...CURRENCY_OPTIONS.map((code) => ({
                    id: code,
                    label: code,
                  })),
                ]}
                onValueChange={(value) =>
                  setCurrency(value === "all" ? "" : value)}
              />
              <TextField
                label="Minimum signed amount"
                value={minimum}
                onChange={setMinimum}
              />
              <TextField
                label="Maximum signed amount"
                value={maximum}
                onChange={setMaximum}
              />
              <SegmentedControl
                label="Sort order"
                value={sort}
                onChange={(value) => setSort(value as "newest" | "oldest")}
                options={[{ id: "newest", label: "Newest first" }, {
                  id: "oldest",
                  label: "Oldest first",
                }]}
              />
            </Stack>
          </FilterSheet>
        </FilterBar>
        <ActiveFilterChips
          filters={[
            ...(categoryId
              ? [{
                id: "category",
                label: categoryById.get(categoryId) ?? categoryId,
                onRemove: removeCategory,
              }]
              : []),
            ...(currency
              ? [{ id: "currency", label: currency, onRemove: removeCurrency }]
              : []),
            ...(search
              ? [{
                id: "search",
                label: `Find: ${search}`,
                onRemove: removeSearch,
              }]
              : []),
          ]}
        />
        <MoneySummary items={totals} />
        <CategoryBreakdown
          categories={categories}
          onSelect={setCategoryId}
          onViewAll={() => setCategoryId("")}
        />
        {plainExpenses.length === 0 && result.receiptGroups.length === 0
          ? (
            <EmptyState
              title={search || categoryId
                ? "No expenses match these filters"
                : "No expenses in this period"}
              action={<Button onPress={onAdd}>Add an expense</Button>}
            >
              {search || categoryId
                ? "Try removing a filter or choose another period."
                : "Your local expense list will appear here after the first save."}
            </EmptyState>
          )
          : (
            <Stack gap={4}>
              <Heading size="sm">Expense list</Heading>
              <ExpenseList
                expenses={plainExpenses}
                onSelect={(id) => {
                  const expense = state.expenses.find((candidate) =>
                    candidate.id === id
                  );
                  if (expense) onEdit(expense);
                }}
              />
              {result.receiptGroups.map((group) => (
                <Card key={group.id} as="section">
                  <ReceiptGroup
                    merchant={group.receipt.merchant ?? "Receipt"}
                    date={group.receipt.date}
                    lines={group.lines.map((item) => ({
                      ...expenseViewModel(item),
                      category: categoryById.get(item.categoryId) ??
                        item.categoryId,
                    }))}
                    total={{
                      amount: group.total,
                      currency: group.receipt.currency,
                    }}
                    onSelectLine={(id) => {
                      const expense = state.expenses.find((candidate) =>
                        candidate.id === id
                      );
                      if (expense) {
                        onEdit(expense);
                      }
                    }}
                  />
                </Card>
              ))}
            </Stack>
          )}
      </Stack>
    </ContentContainer>
  );
}

type EditorState<T> =
  | { readonly kind: "create" }
  | { readonly kind: "edit"; readonly record: T };

function idFor(kind: "project" | "category" | "expense"): string {
  const suffix = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random()}`;
  return `${kind}-${suffix}`;
}

function isProjectEmpty(
  state: ProjectCategoryState,
  projectId: string,
): boolean {
  return !state.expenses.some((expense) => expense.projectId === projectId) &&
    !state.receipts.some((receipt) => receipt.projectId === projectId) &&
    !state.receiptPurchaseLines.some((line) => line.projectId === projectId) &&
    !state.receiptAdjustments.some((line) => line.projectId === projectId);
}

export function ProjectManager({
  service,
  state,
  initialCreate = false,
  onStateChange,
  onNavigate,
  onComplete,
}: {
  service: ProjectCategoryService;
  state: ProjectCategoryState;
  initialCreate?: boolean;
  onStateChange: (state: ProjectCategoryState) => void;
  onNavigate: (path: LocalUiPath) => void;
  onComplete?: () => void;
}) {
  const machine = useMemo(() => createProjectOrganizationMachine(service), [
    service,
  ]);
  const [snapshot, send] = useActor(machine);
  const [editor, setEditor] = useState<EditorState<Project> | null>(
    initialCreate ? { kind: "create" } : null,
  );
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("SEK");
  const [saveTarget, setSaveTarget] = useState<Project | null>(null);
  const handledInitialCreate = useRef(false);

  useEffect(() => {
    if (snapshot.matches("closed")) {
      send({ type: "project.open", state });
    }
  }, [send, snapshot, state]);

  useEffect(() => {
    if (snapshot.context.state) onStateChange(snapshot.context.state);
  }, [onStateChange, snapshot.context.state]);

  useEffect(() => {
    if (initialCreate && !handledInitialCreate.current) {
      handledInitialCreate.current = true;
      setEditor({ kind: "create" });
    }
  }, [initialCreate]);

  useEffect(() => {
    if (!editor) return;
    if (editor.kind === "create") {
      setName("");
      setCurrency("SEK");
    } else {
      setName(editor.record.name);
      setCurrency(editor.record.defaultCurrency);
    }
    setSaveTarget(null);
  }, [editor]);

  useEffect(() => {
    if (!saveTarget || !snapshot.context.state || !snapshot.matches("ready")) {
      return;
    }
    const project = snapshot.context.state.projects.find((candidate) =>
      candidate.id === saveTarget.id
    );
    if (!project) return;
    if (project.name !== name) {
      send({
        type: "project.command",
        command: { type: "rename", projectId: project.id, name },
      });
      return;
    }
    if (project.defaultCurrency !== currency) {
      send({
        type: "project.set-default-currency",
        projectId: project.id,
        currency: currency as Project["defaultCurrency"],
      });
      return;
    }
    setSaveTarget(null);
    setEditor(null);
    onComplete?.();
  }, [currency, name, onComplete, saveTarget, send, snapshot]);

  useEffect(() => {
    if (
      editor?.kind === "create" && snapshot.context.result &&
      snapshot.matches("ready")
    ) {
      setEditor(null);
      onComplete?.();
    }
  }, [editor, onComplete, snapshot]);

  const openEditor = (nextEditor: EditorState<Project>) =>
    setEditor(nextEditor);
  const submitEditor = () => {
    if (!name.trim() || !snapshot.matches("ready")) return;
    if (editor?.kind === "create") {
      send({
        type: "project.command",
        command: {
          type: "create",
          project: {
            schemaVersion: 1,
            type: "project",
            id: idFor("project"),
            name: name.trim(),
            defaultCurrency: currency as Project["defaultCurrency"],
            archived: false,
          },
        },
      });
      return;
    }
    if (!editor || editor.kind !== "edit") return;
    setSaveTarget(editor.record);
    if (editor.record.name !== name.trim()) {
      send({
        type: "project.command",
        command: {
          type: "rename",
          projectId: editor.record.id,
          name: name.trim(),
        },
      });
    } else if (editor.record.defaultCurrency !== currency) {
      send({
        type: "project.set-default-currency",
        projectId: editor.record.id,
        currency: currency as Project["defaultCurrency"],
      });
    } else {
      setSaveTarget(null);
      setEditor(null);
    }
  };

  if (editor) {
    const isSaving = snapshot.hasTag("saving");
    return (
      <ContentContainer size="form">
        <Stack gap={5}>
          <PageHeader
            title={editor.kind === "create" ? "Create project" : "Edit project"}
            leading={
              <Button variant="quiet" onPress={() => setEditor(null)}>
                Back
              </Button>
            }
          />
          <Card as="section">
            <Stack gap={5}>
              <TextField
                label="Project name"
                isRequired
                value={name}
                onChange={setName}
                error={snapshot.context.error?.code === "conflict"
                  ? snapshot.context.error.message
                  : undefined}
              />
              <SelectField
                label="Default currency"
                options={CURRENCY_OPTIONS.map((code) => ({
                  id: code,
                  label: code,
                }))}
                value={currency}
                onValueChange={setCurrency}
              />
              {snapshot.context.error
                ? (
                  <InlineNotice tone="danger" title="Project was not saved">
                    {snapshot.context.error.message}
                  </InlineNotice>
                )
                : null}
              <FormActions>
                {snapshot.matches("failed")
                  ? (
                    <Button
                      variant="secondary"
                      onPress={() => send({ type: "project.retry" })}
                    >
                      Retry
                    </Button>
                  )
                  : null}
                <Button
                  pending={isSaving}
                  isDisabled={isSaving || !name.trim()}
                  onPress={submitEditor}
                >
                  Save project
                </Button>
              </FormActions>
            </Stack>
          </Card>
        </Stack>
      </ContentContainer>
    );
  }

  const current =
    state.projects.find((project) => project.id === state.selectedProjectId) ??
      state.projects.find((project) => !project.archived);
  const activeOthers = state.projectOrder.map((id) =>
    state.projects.find((project) => project.id === id)
  ).filter((project): project is Project =>
    Boolean(project && !project.archived && project.id !== current?.id)
  );
  const archived = state.projects.filter((project) => project.archived);
  const moveOther = (projectId: string, direction: -1 | 1) => {
    const index = activeOthers.findIndex((project) => project.id === projectId);
    const nextIndex = index + direction;
    if (
      index < 0 || nextIndex < 0 || nextIndex >= activeOthers.length || !current
    ) return;
    const next = [...activeOthers];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(nextIndex, 0, moved);
    send({
      type: "project.command",
      command: {
        type: "reorder",
        orderedIds: [current.id, ...next.map((project) => project.id)],
      },
    });
  };

  return (
    <ContentContainer>
      <Stack gap={5}>
        <PageHeader
          headingLevel={1}
          title="Manage projects"
          leading={
            <Button
              variant="quiet"
              onPress={() => onNavigate("/organize")}
            >
              Organize
            </Button>
          }
          actions={
            <Button onPress={() => openEditor({ kind: "create" })}>
              Create project
            </Button>
          }
        />
        {snapshot.context.error
          ? (
            <InlineNotice tone="danger" title="Project change failed">
              {snapshot.context.error.message}
            </InlineNotice>
          )
          : null}
        <section
          className="local-ui-management-section"
          aria-label="Current project"
        >
          <Heading size="sm">Current project</Heading>
          {current
            ? (
              <List>
                <ListRow trailing={<Badge tone="positive">Current</Badge>}>
                  <Inline justify="space-between">
                    <Stack gap={1}>
                      <strong>{current.name}</strong>
                      <Text tone="secondary">{current.defaultCurrency}</Text>
                    </Stack>
                    <Button
                      variant="quiet"
                      onPress={() =>
                        openEditor({ kind: "edit", record: current })}
                    >
                      Edit
                    </Button>
                  </Inline>
                </ListRow>
              </List>
            )
            : (
              <EmptyState title="No active project">
                Create a project to start tracking expenses.
              </EmptyState>
            )}
        </section>
        <section
          className="local-ui-management-section"
          aria-label="Other projects"
        >
          <Heading size="sm">Other projects</Heading>
          <List>
            {activeOthers.map((project, index) => (
              <ListRow key={project.id}>
                <Stack gap={2}>
                  <Inline justify="space-between">
                    <Stack gap={1}>
                      <strong>{project.name}</strong>
                      <Text tone="secondary">{project.defaultCurrency}</Text>
                    </Stack>
                    <Inline>
                      <Button
                        variant="secondary"
                        onPress={() =>
                          send({
                            type: "project.command",
                            command: { type: "select", projectId: project.id },
                          })}
                      >
                        Use
                      </Button>
                      <Button
                        variant="quiet"
                        onPress={() =>
                          openEditor({ kind: "edit", record: project })}
                      >
                        Edit
                      </Button>
                    </Inline>
                  </Inline>
                  <Inline>
                    <Button
                      variant="quiet"
                      isDisabled={index === 0 || snapshot.hasTag("saving")}
                      onPress={() => moveOther(project.id, -1)}
                    >
                      Move up
                    </Button>
                    <Button
                      variant="quiet"
                      isDisabled={index === activeOthers.length - 1 ||
                        snapshot.hasTag("saving")}
                      onPress={() => moveOther(project.id, 1)}
                    >
                      Move down
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="quiet"
                          isDisabled={snapshot.hasTag("saving")}
                        >
                          Archive
                        </Button>
                      }
                      title={`Archive ${project.name}?`}
                      description="The project and its expenses stay on this device and can be restored later."
                      confirmLabel="Archive project"
                      onConfirm={() =>
                        send({
                          type: "project.command",
                          command: { type: "archive", projectId: project.id },
                        })}
                    />
                    {isProjectEmpty(state, project.id)
                      ? (
                        <ConfirmDialog
                          trigger={
                            <Button variant="danger">Delete empty</Button>
                          }
                          title={`Delete ${project.name}?`}
                          description="This empty project will be removed locally. This action cannot be undone from the project list."
                          confirmLabel="Delete project"
                          confirmVariant="danger"
                          onConfirm={() =>
                            send({
                              type: "project.command",
                              command: {
                                type: "delete-empty",
                                projectId: project.id,
                              },
                            })}
                        />
                      )
                      : (
                        <Text size="caption" tone="muted">
                          Populated project deletion is unavailable here.
                        </Text>
                      )}
                  </Inline>
                </Stack>
              </ListRow>
            ))}
          </List>
        </section>
        {current
          ? (
            <InlineNotice tone="info" title="Current project archive guard">
              Switch to another project before archiving {current.name}.
              <Button variant="quiet" isDisabled>
                Archive current project
              </Button>
            </InlineNotice>
          )
          : null}
        <Disclosure title={`Archived projects (${archived.length})`}>
          {archived.length
            ? (
              <List>
                {archived.map((project) => (
                  <ListRow key={project.id} trailing={<Badge>Archived</Badge>}>
                    <Inline justify="space-between">
                      <Stack gap={1}>
                        <strong>{project.name}</strong>
                        <Text tone="secondary">{project.defaultCurrency}</Text>
                      </Stack>
                      <Inline>
                        <Button
                          variant="secondary"
                          onPress={() =>
                            send({
                              type: "project.command",
                              command: {
                                type: "restore",
                                projectId: project.id,
                              },
                            })}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="quiet"
                          onPress={() =>
                            openEditor({ kind: "edit", record: project })}
                        >
                          Edit
                        </Button>
                      </Inline>
                    </Inline>
                  </ListRow>
                ))}
              </List>
            )
            : <Text tone="secondary">No archived projects.</Text>}
        </Disclosure>
      </Stack>
    </ContentContainer>
  );
}

export function OrganizeScreen({
  state,
  onProjects,
  onCategories,
  onNewProject,
  onNewCategory,
}: {
  state: ProjectCategoryState;
  onProjects: () => void;
  onCategories: () => void;
  onNewProject: () => void;
  onNewCategory: () => void;
}) {
  const projects = state.projects.filter((project) => !project.archived).slice(
    0,
    3,
  );
  const categories = state.categories.filter((category) => !category.archived)
    .slice(0, 3);
  return (
    <ContentContainer>
      <Stack gap={6}>
        <PageHeader title="Organize" headingLevel={1} />
        <section className="local-ui-management-section" aria-label="Projects">
          <Inline justify="space-between">
            <Heading size="sm">Projects</Heading>
            <Inline>
              <Button variant="quiet" onPress={onProjects}>
                Manage projects
              </Button>
              <Button variant="secondary" onPress={onNewProject}>New</Button>
            </Inline>
          </Inline>
          <List>
            {projects.map((project) => (
              <ListRow
                key={project.id}
                trailing={project.id === state.selectedProjectId
                  ? <Badge tone="positive">Current</Badge>
                  : null}
              >
                <Inline justify="space-between">
                  <strong>{project.name}</strong>
                  <Text tone="secondary">{project.defaultCurrency}</Text>
                </Inline>
              </ListRow>
            ))}
          </List>
          {!projects.length
            ? (
              <EmptyState title="No projects yet">
                Create a project to begin.
              </EmptyState>
            )
            : null}
        </section>
        <section
          className="local-ui-management-section"
          aria-label="Categories"
        >
          <Inline justify="space-between">
            <Heading size="sm">Categories</Heading>
            <Inline>
              <Button variant="quiet" onPress={onCategories}>
                Manage categories
              </Button>
              <Button variant="secondary" onPress={onNewCategory}>New</Button>
            </Inline>
          </Inline>
          <List>
            {categories.map((category) => (
              <ListRow
                key={category.id}
                trailing={category.system ? <Badge>Built-in</Badge> : null}
              >
                <strong>{category.name}</strong>
              </ListRow>
            ))}
          </List>
        </section>
      </Stack>
    </ContentContainer>
  );
}

export function SettingsScreen(
  { expenseDayBoundary, onGemini, onSync, onConflicts, onImport }: {
    expenseDayBoundary: string;
    onGemini?: () => void;
    onSync?: () => void;
    onConflicts?: () => void;
    onImport?: () => void;
  },
) {
  const rows = [
    {
      label: "Google Drive and sync",
      summary: "Not connected",
      available: Boolean(onSync),
    },
    {
      label: "Gemini receipt scanning",
      summary: "Device-local key and model",
      available: Boolean(onGemini),
    },
    {
      label: "Preferences",
      summary: `Expense day ${expenseDayBoundary}`,
      available: false,
    },
    {
      label: "Import and export",
      summary: "JSON backup workflows",
      available: Boolean(onImport),
    },
    {
      label: "Conflict review",
      summary: "Resolve synchronized changes",
      available: Boolean(onConflicts),
    },
    {
      label: "Data and privacy",
      summary: "Local data controls",
      available: false,
    },
    {
      label: "About and disclosure",
      summary: "After Midnight",
      available: false,
    },
  ];
  return (
    <ContentContainer size="readable">
      <Stack gap={5}>
        <PageHeader title="Settings" headingLevel={1} />
        <List label="Settings">
          {rows.map((row) => (
            <ListRow
              key={row.label}
              trailing={
                <Button
                  variant="quiet"
                  isDisabled={!row.available}
                  onPress={row.label === "Gemini receipt scanning"
                    ? onGemini
                    : row.label === "Google Drive and sync"
                    ? onSync
                    : row.label === "Import and export"
                    ? onImport
                    : row.label === "Conflict review"
                    ? onConflicts
                    : undefined}
                >
                  Open
                </Button>
              }
            >
              <Stack gap={1}>
                <strong>{row.label}</strong>
                <Text tone="secondary">{row.summary}</Text>
              </Stack>
            </ListRow>
          ))}
        </List>
        <InlineNotice tone="info" title="Local settings">
          Your project selection and unfinished manual expense draft stay on
          this device. Sync and portability workflows remain available without
          requiring an account.
        </InlineNotice>
      </Stack>
    </ContentContainer>
  );
}

export function CategoryManager({
  service,
  state,
  initialCreate = false,
  onStateChange,
  onNavigate,
  onComplete,
}: {
  service: ProjectCategoryService;
  state: ProjectCategoryState;
  initialCreate?: boolean;
  onStateChange: (state: ProjectCategoryState) => void;
  onNavigate: (path: LocalUiPath) => void;
  onComplete?: () => void;
}) {
  const machine = useMemo(() => createCategoryOrganizationMachine(service), [
    service,
  ]);
  const [snapshot, send] = useActor(machine);
  const [editor, setEditor] = useState<EditorState<Category> | null>(
    initialCreate ? { kind: "create" } : null,
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const handledInitialCreate = useRef(false);

  useEffect(() => {
    if (snapshot.matches("closed")) send({ type: "category.open", state });
  }, [send, snapshot, state]);

  useEffect(() => {
    if (snapshot.context.state) onStateChange(snapshot.context.state);
  }, [onStateChange, snapshot.context.state]);

  useEffect(() => {
    if (initialCreate && !handledInitialCreate.current) {
      handledInitialCreate.current = true;
      setEditor({ kind: "create" });
    }
  }, [initialCreate]);

  useEffect(() => {
    if (!editor) return;
    if (editor.kind === "create") {
      setName("");
      setColor(undefined);
    } else {
      setName(editor.record.name);
      setColor(editor.record.color);
    }
  }, [editor]);

  const submitEditor = () => {
    if (!name.trim() || !snapshot.matches("ready")) return;
    if (editor?.kind === "create") {
      send({
        type: "category.command",
        command: {
          type: "create",
          category: {
            schemaVersion: 1,
            type: "category",
            id: idFor("category"),
            name: name.trim(),
            ...(color ? { color } : {}),
            sortOrder: state.categories.length + 1,
            archived: false,
            system: false,
          },
        },
      });
    } else if (editor?.kind === "edit") {
      send({
        type: "category.command",
        command: {
          type: "rename",
          categoryId: editor.record.id,
          name: name.trim(),
        },
      });
    }
  };

  useEffect(() => {
    if (editor && snapshot.context.result && snapshot.matches("ready")) {
      setEditor(null);
      onComplete?.();
    }
  }, [editor, onComplete, snapshot]);

  if (editor) {
    return (
      <ContentContainer size="form">
        <Stack gap={5}>
          <PageHeader
            title={editor.kind === "create"
              ? "Create category"
              : "Edit category"}
            leading={
              <Button variant="quiet" onPress={() => setEditor(null)}>
                Back
              </Button>
            }
          />
          <Card as="section">
            <Stack gap={5}>
              <TextField
                label="Category name"
                isRequired
                value={name}
                onChange={setName}
              />
              <ColorChoiceField
                label="Category color (optional)"
                value={color}
                onValueChange={setColor}
                description="Color supplements the category name and is never its only identifier."
              />
              {snapshot.context.error
                ? (
                  <InlineNotice tone="danger" title="Category was not saved">
                    {snapshot.context.error.message}
                  </InlineNotice>
                )
                : null}
              <FormActions>
                {snapshot.matches("failed")
                  ? (
                    <Button
                      variant="secondary"
                      onPress={() => send({ type: "category.retry" })}
                    >
                      Retry
                    </Button>
                  )
                  : null}
                <Button
                  pending={snapshot.hasTag("saving")}
                  isDisabled={snapshot.hasTag("saving") || !name.trim()}
                  onPress={submitEditor}
                >
                  Save category
                </Button>
              </FormActions>
            </Stack>
          </Card>
        </Stack>
      </ContentContainer>
    );
  }

  const normalizedSearch = search.trim().toLocaleLowerCase("en-US");
  const matches = (category: Category) =>
    !normalizedSearch ||
    category.name.toLocaleLowerCase("en-US").includes(normalizedSearch);
  const active = state.categories.filter((category) =>
    !category.archived && matches(category)
  );
  const archived = state.categories.filter((category) =>
    category.archived && matches(category)
  );
  const customActive = active.filter((category) => !category.system);
  const moveCategory = (categoryId: string, direction: -1 | 1) => {
    const ordered = state.categories.filter((category) =>
      !category.archived && !category.system
    );
    const index = ordered.findIndex((category) => category.id === categoryId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const next = [...ordered];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(nextIndex, 0, moved);
    send({
      type: "category.command",
      command: {
        type: "reorder",
        orderedIds: next.map((category) => category.id),
      },
    });
  };
  const uncategorized = state.categories.find((category) => category.system);

  return (
    <ContentContainer>
      <Stack gap={5}>
        <PageHeader
          headingLevel={1}
          title="Manage categories"
          leading={
            <Button
              variant="quiet"
              onPress={() => onNavigate("/organize")}
            >
              Organize
            </Button>
          }
          actions={
            <Button onPress={() => setEditor({ kind: "create" })}>
              Create category
            </Button>
          }
        />
        <SearchField
          label="Search categories"
          placeholder="Find an active or archived category"
          value={search}
          onValueChange={setSearch}
        />
        {snapshot.context.error
          ? (
            <InlineNotice tone="danger" title="Category change failed">
              {snapshot.context.error.message}
            </InlineNotice>
          )
          : null}
        <List label="Active categories">
          {customActive.map((category, index) => (
            <ListRow
              key={category.id}
              leading={<span aria-hidden="true">≡</span>}
            >
              <Stack gap={2}>
                <Inline justify="space-between">
                  <strong>{category.name}</strong>
                  <Button
                    variant="quiet"
                    onPress={() =>
                      setEditor({ kind: "edit", record: category })}
                  >
                    Edit
                  </Button>
                </Inline>
                <Inline>
                  <Button
                    variant="quiet"
                    isDisabled={index === 0 || snapshot.hasTag("saving")}
                    onPress={() => moveCategory(category.id, -1)}
                  >
                    Move up
                  </Button>
                  <Button
                    variant="quiet"
                    isDisabled={index === customActive.length - 1 ||
                      snapshot.hasTag("saving")}
                    onPress={() => moveCategory(category.id, 1)}
                  >
                    Move down
                  </Button>
                  <ConfirmDialog
                    trigger={<Button variant="quiet">Archive</Button>}
                    title={`Archive ${category.name}?`}
                    description="Existing expenses keep this category, while new entries use active categories."
                    confirmLabel="Archive category"
                    onConfirm={() =>
                      send({
                        type: "category.command",
                        command: { type: "archive", categoryId: category.id },
                      })}
                  />
                  <ConfirmDialog
                    trigger={
                      <Button variant="danger">Delete and reassign</Button>
                    }
                    title={`Delete ${category.name}?`}
                    description={`References will be moved to Uncategorized across every project. This cannot be undone from the category list.`}
                    confirmLabel="Delete and reassign"
                    confirmVariant="danger"
                    onConfirm={() =>
                      send({
                        type: "category.command",
                        command: {
                          type: "delete-and-reassign",
                          categoryId: category.id,
                          replacementCategoryId: "category-uncategorized",
                        },
                      })}
                  />
                </Inline>
              </Stack>
            </ListRow>
          ))}
          {uncategorized && matches(uncategorized)
            ? (
              <ListRow trailing={<Badge>Built-in</Badge>}>
                <strong>{uncategorized.name}</strong>
              </ListRow>
            )
            : null}
        </List>
        {!active.length
          ? (
            <EmptyState title="No matching active categories">
              Create a category or clear the search.
            </EmptyState>
          )
          : null}
        <Disclosure title={`Archived categories (${archived.length})`}>
          {archived.length
            ? (
              <List label="Archived categories">
                {archived.map((category) => (
                  <ListRow key={category.id}>
                    <Inline justify="space-between">
                      <Stack gap={1}>
                        <strong>{category.name}</strong>
                        <Text tone="secondary">Archived</Text>
                      </Stack>
                      <Inline>
                        <Button
                          variant="secondary"
                          onPress={() =>
                            send({
                              type: "category.command",
                              command: {
                                type: "restore",
                                categoryId: category.id,
                              },
                            })}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="quiet"
                          onPress={() =>
                            setEditor({ kind: "edit", record: category })}
                        >
                          Edit
                        </Button>
                      </Inline>
                    </Inline>
                  </ListRow>
                ))}
              </List>
            )
            : <Text tone="secondary">No archived categories.</Text>}
        </Disclosure>
      </Stack>
    </ContentContainer>
  );
}

export type ManualSaveMode = "expenses" | "another";

export function manualExpenseSubmitEvent(
  mode: ManualSaveMode,
): ManualExpenseEvent {
  return mode === "another"
    ? { type: "expense.submit-and-add-another" }
    : { type: "expense.submit" };
}

export function ManualExpenseRecoveryScreen({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <ContentContainer size="readable">
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
  onClosed,
}: {
  repository: LocalRepository;
  service: ProjectCategoryService;
  state: ProjectCategoryState;
  request: ManualExpenseOpenRequest;
  onSaved: (expense: Expense, mode: ManualSaveMode) => void;
  onClosed: () => void;
}) {
  const [machineKey, setMachineKey] = useState(0);
  const machine = useMemo(
    () =>
      createManualExpenseMachine({ local: repository, organization: service }),
    [repository, service, machineKey],
  );
  const [snapshot, send] = useActor(machine, { input: {} });
  const [hydrationStarted, setHydrationStarted] = useState(false);
  const [openSent, setOpenSent] = useState(false);
  const completionHandled = useRef(false);

  useEffect(() => {
    if (request.expense) {
      send({ type: "expense.open", request });
      setOpenSent(true);
    } else {
      send({ type: "expense.hydrate" });
      setHydrationStarted(true);
    }
  }, [machineKey, request, send]);

  useEffect(() => {
    if (hydrationStarted && !openSent && snapshot.matches("idle")) {
      send({ type: "expense.open", request });
      setOpenSent(true);
    }
  }, [hydrationStarted, machineKey, openSent, request, send, snapshot]);

  const saveMode = useRef<ManualSaveMode>("expenses");
  useEffect(() => {
    if (completionHandled.current) return;
    if (
      snapshot.matches("saved") && snapshot.context.result?.expense &&
      saveMode.current === "another"
    ) {
      completionHandled.current = true;
      onSaved(snapshot.context.result.expense, saveMode.current);
    } else if (
      snapshot.matches("discarded") || snapshot.matches("cancelled") ||
      snapshot.matches("deletedOutput") || snapshot.matches("savedUndone")
    ) {
      completionHandled.current = true;
      onClosed();
    }
  }, [onClosed, onSaved, snapshot]);

  useEffect(() => {
    if (!snapshot.hasTag("dirty")) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    return () => globalThis.removeEventListener("beforeunload", onBeforeUnload);
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
        onContinue={onClosed}
      />
    );
  }
  const retryOpening = () => {
    setHydrationStarted(false);
    setOpenSent(false);
    setMachineKey((value) => value + 1);
  };
  if (
    (snapshot.matches("hydrateFailed") || snapshot.matches("openFailed") ||
      snapshot.matches("draftSaveFailed")) &&
    draft === null
  ) {
    return (
      <ManualExpenseRecoveryScreen
        message={snapshot.context.error?.message ??
          "Local draft data could not be restored."}
        onRetry={retryOpening}
        onClose={onClosed}
      />
    );
  }
  if (
    snapshot.matches("hydrating") || snapshot.matches("opening") ||
    draft === null
  ) {
    return <LoadingScreen />;
  }
  const categories = state.categories.filter((category) =>
    !category.archived || category.id === draft.categoryId
  ).map((category) => ({ id: category.id, label: category.name }));
  const projects = state.projects.filter((project) =>
    !project.archived || project.id === draft.projectId
  ).map((project) => ({ id: project.id, label: project.name }));
  const validation = snapshot.context.validation;
  const update = (changes: Partial<ManualExpenseDraft>) =>
    send({ type: "expense.change", draft: { ...draft, ...changes } });
  const busy = snapshot.hasTag("saving");
  const failed = snapshot.matches("saveFailed");
  const errors = Object.entries(validation).map(([id, message]) => ({
    id,
    message,
  }));
  const submit = (mode: ManualSaveMode) => {
    saveMode.current = mode;
    send(manualExpenseSubmitEvent(mode));
  };

  return (
    <ContentContainer size="form">
      <Stack gap={5}>
        <PageHeader
          headingLevel={1}
          title={snapshot.context.originalExpense
            ? "Edit expense"
            : "New expense"}
          leading={
            <Button
              variant="quiet"
              onPress={() => send({ type: "expense.back" })}
            >
              Close
            </Button>
          }
        />
        <ExpenseForm
          status={
            <DraftStatus
              state={failed
                ? "failed"
                : busy
                ? "saving"
                : snapshot.hasTag("draft-saving")
                ? "saving"
                : "dirty"}
              detail={failed
                ? snapshot.context.error?.message
                : "Your unfinished form is saved on this device."}
              action={failed
                ? (
                  <Button
                    variant="secondary"
                    onPress={() => send({ type: "expense.retry" })}
                  >
                    Retry save
                  </Button>
                )
                : undefined}
            />
          }
          actions={
            <>
              <Button
                variant="secondary"
                isDisabled={busy}
                onPress={() => submit("another")}
              >
                Save and add another
              </Button>
              <Button
                pending={busy}
                isDisabled={busy}
                onPress={() => submit("expenses")}
              >
                Save expense
              </Button>
            </>
          }
        >
          {errors.length ? <ErrorSummary errors={errors} /> : null}
          <SegmentedControl
            label="Direction"
            value={draft.direction}
            onChange={(value) =>
              update({ direction: value as ManualExpenseDraft["direction"] })}
            options={[{ id: "spent", label: "Spent" }, {
              id: "money-back",
              label: "Money back",
            }]}
          />
          <MoneyField
            label="Amount"
            isRequired
            value={draft.amount}
            onChange={(value) => update({ amount: value })}
            currency={draft.currency}
            error={validation.amount}
          />
          <CurrencyPicker
            value={draft.currency}
            options={CURRENCY_OPTIONS.map((code) => ({
              id: code,
              label: code,
            }))}
            onValueChange={(value) =>
              update({ currency: CurrencyCodeSchema.parse(value) })}
          />
          <MerchantPicker
            value={draft.merchant ?? ""}
            onValueChange={(value) => update({ merchant: value })}
            suggestions={[...snapshot.context.suggestions]}
          />
          <SelectField
            label="Category"
            options={categories}
            value={draft.categoryId}
            onValueChange={(value) => update({ categoryId: value })}
            error={validation.categoryId}
          />
          <NativeDateField
            label="Date"
            required
            value={draft.date}
            onChange={(event) => update({ date: event.currentTarget.value })}
            error={validation.date}
            description="The concrete calendar date is saved exactly as shown."
          />
          <NativeTimeField
            label="Time (optional)"
            value={draft.time ?? ""}
            onChange={(event) =>
              update({ time: event.currentTarget.value || undefined })}
            error={validation.time}
          />
          <ProjectPicker
            options={projects}
            value={draft.projectId}
            onValueChange={(value) => update({ projectId: value })}
          />
          <TextArea
            label="Description (optional)"
            value={draft.description}
            onChange={(value) => update({ description: value })}
            error={validation.description}
          />
        </ExpenseForm>
        {snapshot.matches("discardConfirming")
          ? (
            <InlineNotice tone="warning" title="Discard unsaved changes?">
              <Inline>
                <Button
                  variant="quiet"
                  onPress={() => send({ type: "expense.keep-editing" })}
                >
                  Keep editing
                </Button>
                <Button
                  variant="danger"
                  onPress={() => send({ type: "expense.confirm-discard" })}
                >
                  Discard changes
                </Button>
              </Inline>
            </InlineNotice>
          )
          : null}
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
        {snapshot.context.originalExpense
          ? (
            <InlineNotice tone="danger" title="Delete expense">
              <Button
                variant="danger"
                onPress={() => send({ type: "expense.delete" })}
              >
                Delete this expense
              </Button>
            </InlineNotice>
          )
          : null}
        {snapshot.matches("deleteConfirming")
          ? (
            <InlineNotice tone="danger" title="Delete this expense?">
              <Inline>
                <Button
                  variant="quiet"
                  onPress={() => send({ type: "expense.cancel-delete" })}
                >
                  Keep expense
                </Button>
                <Button
                  variant="danger"
                  onPress={() => send({ type: "expense.confirm-delete" })}
                >
                  Delete expense
                </Button>
              </Inline>
            </InlineNotice>
          )
          : null}
      </Stack>
    </ContentContainer>
  );
}

function FoundationExpensesPlaceholder() {
  return (
    <ContentContainer size="readable">
      <Stack gap={5}>
        <Heading level={1} size="lg">Expenses</Heading>
        <EmptyState title="Your local expenses will appear here">
          Create an expense or add a project to begin tracking.
        </EmptyState>
      </Stack>
    </ContentContainer>
  );
}

export function LocalUiRuntime(
  { repository, receiptDependencies }: {
    repository: LocalRepository;
    receiptDependencies?: ReceiptUiDependencies;
  },
) {
  const organization = useMemo(
    () => createProjectCategoryService(repository),
    [repository],
  );
  const shellMachine = useMemo(
    () =>
      createLocalShellMachine({
        organization,
        initialNetwork: globalThis.navigator?.onLine === false
          ? "offline"
          : "online",
      }),
    [organization],
  );
  const [shellSnapshot, sendShell] = useActor(shellMachine);
  const [state, setState] = useState<ProjectCategoryState | null>(null);
  const [expenseDayBoundary, setExpenseDayBoundary] = useState("03:00");
  const [path, setPath] = useState(pathFromHash);
  const [projectEditorOpen, setProjectEditorOpen] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [manualFormKey, setManualFormKey] = useState(0);
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [deviceSettings, setDeviceSettings] = useState<DeviceLocalSettings>({
    imagePreparationEnabled: true,
  });
  const [receiptReview, setReceiptReview] = useState<ReceiptReviewDraft>();
  const imageStore = useMemo(() => new ReceiptImageStore(), []);
  const defaultReceipt = useMemo(
    () => createDefaultReceiptUiDependencies(imageStore),
    [imageStore],
  );
  const receipt = receiptDependencies ?? defaultReceipt.dependencies;
  const secretStorage = defaultReceipt.secretStorage;
  const shellReady = shellSnapshot.matches("ready");

  useEffect(() => {
    void repository.transaction(
      "readonly",
      (transaction) => transaction.get("records", "settings-portable"),
    ).then((value) => {
      const parsed = PortableSettingsSchema.safeParse(value);
      if (parsed.success) setExpenseDayBoundary(parsed.data.expenseDayBoundary);
    });
  }, [repository]);

  useEffect(() => {
    let active = true;
    void readDeviceLocalSettings(repository).then((settings) => {
      if (active) setDeviceSettings(settings);
    }).catch(() => {
      if (active) {
        setAppNotice("Device-local Gemini settings could not be opened.");
      }
    });
    return () => {
      active = false;
    };
  }, [repository]);

  useEffect(() => {
    const onOffline = () => sendShell({ type: "shell.network.offline" });
    const onOnline = () => sendShell({ type: "shell.network.online" });
    globalThis.addEventListener("offline", onOffline);
    globalThis.addEventListener("online", onOnline);
    return () => {
      globalThis.removeEventListener("offline", onOffline);
      globalThis.removeEventListener("online", onOnline);
    };
  }, [sendShell]);

  useEffect(() => {
    const onHashChange = () => setPath(pathFromHash());
    globalThis.addEventListener("hashchange", onHashChange);
    return () => globalThis.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const nextState = shellSnapshot.context.projectState;
    if (nextState) setState(nextState);
  }, [shellSnapshot.context.projectState]);

  useEffect(() => {
    if (!shellReady || state === null || path !== "") {
      return;
    }
    setPath(state.projects.length === 0 ? "/first-use" : "/expenses");
  }, [path, shellReady, state]);

  useEffect(() => {
    if (!shellReady || path === "") return;
    sendShell(
      {
        type: "shell.navigate",
        route: shellRouteForPath(path),
      } satisfies LocalShellEvent,
    );
  }, [path, sendShell, shellReady]);

  const navigate = (nextPath: LocalUiPath) => {
    if (globalThis.location.hash !== hashForRoute(nextPath)) {
      globalThis.location.hash = hashForRoute(nextPath);
    } else {
      setPath(nextPath);
    }
  };

  const updateDeviceSettings = async (next: DeviceLocalSettings) => {
    setDeviceSettings(next);
    try {
      await writeDeviceLocalSettings(repository, next);
    } catch {
      setAppNotice("Device-local Gemini settings could not be saved.");
    }
  };

  const selectedExpenseId = path.startsWith("/expense/edit/")
    ? path.slice("/expense/edit/".length)
    : undefined;
  const selectedExpense = selectedExpenseId && state
    ? state.expenses.find((expense) => expense.id === selectedExpenseId)
    : undefined;
  const manualRequest = useMemo<ManualExpenseOpenRequest>(
    () =>
      selectedExpense
        ? { expense: selectedExpense }
        : { projectId: state?.selectedProjectId },
    [selectedExpense, state?.selectedProjectId],
  );

  if (shellSnapshot.matches("booting") || state === null) {
    return <LoadingScreen />;
  }
  if (shellSnapshot.matches("error")) {
    return (
      <ContentContainer size="readable">
        <InlineNotice tone="danger" title="Local data could not be opened">
          {shellSnapshot.context.error?.message ??
            "Try again to reopen local data."}
        </InlineNotice>
      </ContentContainer>
    );
  }

  const activePath = path ||
    (state.projects.length ? "/expenses" : "/first-use");
  const showAddChoice = activePath === "/add";
  const contentPath = showAddChoice ? "/expenses" : activePath;
  const selectedNavigation = activePath.startsWith("/organize") ||
      activePath === "/projects" || activePath === "/categories"
    ? "organize"
    : activePath.startsWith("/settings")
    ? "settings"
    : "expenses";
  const portabilityScreen: SyncPortabilityScreen =
    activePath === "/settings/sync"
      ? "sync"
      : activePath === "/settings/devices"
      ? "devices"
      : activePath === "/settings/conflicts"
      ? "conflicts"
      : activePath === "/settings/import-export"
      ? "import-export"
      : null;

  const selectNavigation = (id: string) => {
    if (id === "add") return navigate("/add");
    if (id === "organize" || id === "settings" || id === "expenses") {
      navigate(`/${id}` as LocalUiPath);
    }
  };

  return (
    <AppFrame
      navigation={
        <DefaultNavigation
          selected={selectedNavigation}
          onSelect={selectNavigation}
        />
      }
    >
      <SyncPortabilityRuntime
        repository={repository}
        screen={portabilityScreen}
        onNavigate={(nextPath) => navigate(nextPath as LocalUiPath)}
        onNotice={setAppNotice}
      >
        {contentPath === "/first-use"
          ? (
            <FirstUseScreen
              onCreateProject={() => {
                setProjectEditorOpen(true);
                navigate("/projects");
              }}
              onRestoreBackup={() =>
                setAppNotice(
                  "JSON restore will be available in the approved local portability workflow.",
                )}
              onConnectDrive={() =>
                setAppNotice(
                  "Google Drive is not part of this local-only slice.",
                )}
            />
          )
          : contentPath === "/expenses"
          ? (
            <ExpensesScreen
              state={state}
              expenseDayBoundary={expenseDayBoundary}
              offline={shellSnapshot.hasTag("offline")}
              onAdd={() => navigate("/add")}
              onEdit={(expense) =>
                navigate(`/expense/edit/${expense.id}` as LocalUiPath)}
              onProjectChange={(projectId) =>
                sendShell({ type: "shell.project.select", projectId })}
            />
          )
          : contentPath === "/receipt/scan"
          ? (
            <ReceiptScanScreen
              dependencies={receipt}
              secretStorage={secretStorage}
              imageStore={imageStore}
              state={state}
              settings={deviceSettings}
              offline={shellSnapshot.hasTag("offline")}
              onSettingsChange={updateDeviceSettings}
              onReview={(review) => {
                setReceiptReview(review);
                navigate("/receipt/review");
              }}
              onClose={() => {
                imageStore.clear();
                navigate("/expenses");
              }}
              onOpenSettings={() => navigate("/settings/gemini")}
            />
          )
          : contentPath === "/receipt/review"
          ? (
            <ReceiptReviewScreen
              local={repository}
              state={state}
              initialReview={receiptReview}
              onClose={() => {
                void organization.getState().then(setState);
                setReceiptReview(undefined);
                navigate("/expenses");
              }}
            />
          )
          : contentPath === "/expense/new" ||
              contentPath.startsWith("/expense/edit/")
          ? (
            <ManualExpenseScreen
              key={`${contentPath}-${manualFormKey}`}
              repository={repository}
              service={organization}
              state={state}
              request={manualRequest}
              onSaved={(_, mode) => {
                void organization.getState().then(setState);
                if (mode === "another") {
                  setManualFormKey((value) => value + 1);
                }
              }}
              onClosed={() => {
                void organization.getState().then(setState);
                navigate("/expenses");
              }}
            />
          )
          : contentPath === "/organize"
          ? (
            <OrganizeScreen
              state={state}
              onProjects={() => navigate("/projects")}
              onCategories={() => navigate("/categories")}
              onNewProject={() => {
                setProjectEditorOpen(true);
                navigate("/projects");
              }}
              onNewCategory={() => {
                setCategoryEditorOpen(true);
                navigate("/categories");
              }}
            />
          )
          : contentPath === "/projects"
          ? (
            <ProjectManager
              service={organization}
              state={state}
              initialCreate={projectEditorOpen}
              onStateChange={setState}
              onNavigate={navigate}
              onComplete={() => {
                if (projectEditorOpen) {
                  setProjectEditorOpen(false);
                  navigate("/expenses");
                }
              }}
            />
          )
          : contentPath === "/categories"
          ? (
            <CategoryManager
              service={organization}
              state={state}
              initialCreate={categoryEditorOpen}
              onStateChange={setState}
              onNavigate={navigate}
              onComplete={() => {
                if (categoryEditorOpen) {
                  setCategoryEditorOpen(false);
                  navigate("/organize");
                }
              }}
            />
          )
          : contentPath === "/settings/gemini"
          ? (
            <GeminiSettingsScreen
              gemini={receipt.gemini}
              settings={deviceSettings}
              onSettingsChange={updateDeviceSettings}
              onClose={() => navigate("/settings")}
            />
          )
          : contentPath === "/settings"
          ? (
            <SettingsScreen
              expenseDayBoundary={expenseDayBoundary}
              onGemini={() => navigate("/settings/gemini")}
              onSync={() => navigate("/settings/sync")}
              onConflicts={() => navigate("/settings/conflicts")}
              onImport={() => navigate("/settings/import-export")}
            />
          )
          : <FoundationExpensesPlaceholder />}
      </SyncPortabilityRuntime>
      {showAddChoice
        ? (
          <AddChoiceScreen
            offline={shellSnapshot.hasTag("offline")}
            onClose={() => navigate("/expenses")}
            onManual={() => navigate("/expense/new")}
            onScan={() => navigate("/receipt/scan")}
          />
        )
        : null}
      {appNotice
        ? (
          <div className="local-ui-toast-wrap">
            <Toast>{appNotice}</Toast>
            <Button variant="quiet" onPress={() => setAppNotice(null)}>
              Dismiss
            </Button>
          </div>
        )
        : null}
    </AppFrame>
  );
}

export function LocalApp() {
  const [repository, setRepository] = useState<LocalRepository | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void openLocalRepository().then((opened) => {
      if (active) setRepository(opened);
      else opened.close();
    }).catch(() => {
      if (active) setError("Local storage is unavailable in this browser.");
    });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <ContentContainer size="readable">
        <InlineNotice tone="danger" title="Unable to start locally">
          {error}
        </InlineNotice>
      </ContentContainer>
    );
  }
  if (!repository) return <LoadingScreen />;
  return <LocalUiRuntime repository={repository} />;
}
