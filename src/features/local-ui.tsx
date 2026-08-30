import { useActor } from "@xstate/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, SlidersHorizontal, X } from "lucide-react";
import {
  createProjectCategoryService,
  type ProjectCategoryService,
  type ProjectCategoryState,
} from "../domain/organization.ts";
import {
  compareExpenseTimelineEntries,
  type ExpensePeriod,
  type ExpenseQueryResult,
  queryExpenses,
} from "../domain/queries/index.ts";
import {
  CalendarDateSchema,
  type Category,
  createReceiptManagementService,
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
  createProjectDeletionDependencies,
  createProjectDeletionMachine,
} from "../actors/project-deletion.ts";
import {
  ActionCard,
  ActiveFilterChips,
  AdaptiveDialog,
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
  DefinitionList,
  DeleteAndReassign,
  Disclosure,
  DraftStatus,
  EmptyState,
  ErrorSummary,
  ExpenseForm,
  ExpenseRow,
  FilterBar,
  FilterSheet,
  FormActions,
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
  ResponsiveGrid,
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
import { SyncStatusIndicator, useSyncStatus } from "./sync-ui/index.ts";
import { ReceiptDetailScreen } from "./receipt-detail-ui.tsx";
import {
  AboutScreen,
  PreferencesScreen,
  PwaRuntime,
  UnsupportedBrowserScreen,
} from "./settings-pwa.tsx";
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
import type { LocalPort } from "../adapters/ports/local.ts";
import { hashForRoute, routeFromHash } from "../app/routing.ts";
import { isSupportedBrowser } from "../app/pwa.ts";

export type LocalUiPath =
  | "/first-use"
  | "/expenses"
  | "/add"
  | "/expense/new"
  | `/expense/edit/${string}`
  | "/organize"
  | "/projects"
  | "/categories"
  | "/settings"
  | "/settings/gemini"
  | "/settings/sync"
  | "/settings/devices"
  | "/settings/conflicts"
  | "/settings/import-export"
  | "/settings/privacy"
  | "/settings/preferences"
  | "/settings/about"
  | "/receipt/scan"
  | "/receipt/review"
  | `/receipt/detail/${string}`;

export type LocalUiNavigation =
  | "expenses"
  | "manual"
  | "scan"
  | "organize"
  | "settings";

export function selectedNavigationForPath(
  activePath: string,
): LocalUiNavigation {
  if (
    activePath === "/expense/new" || activePath.startsWith("/expense/edit/")
  ) {
    return "manual";
  }
  if (activePath === "/receipt/scan" || activePath === "/receipt/review") {
    return "scan";
  }
  if (
    activePath.startsWith("/organize") || activePath === "/projects" ||
    activePath === "/categories"
  ) {
    return "organize";
  }
  if (activePath.startsWith("/settings")) return "settings";
  return "expenses";
}

function shellRouteForPath(path: string): ShellRoute {
  if (path === "/first-use") return "first-use";
  if (path === "/add") return "add";
  if (path.startsWith("/expense/")) return "expense-form";
  if (path === "/receipt/scan") return "receipt-scan";
  if (path === "/receipt/review") return "receipt-review";
  if (path.startsWith("/receipt/detail/")) return "receipt-detail";
  if (path === "/organize") return "organize";
  if (path === "/projects") return "projects";
  if (path === "/categories") return "categories";
  if (path.startsWith("/settings")) return "settings";
  return "expenses";
}

export function firstUseRedirectPath(
  path: string,
  projectCount: number,
): LocalUiPath | undefined {
  return path === "/first-use" && projectCount > 0 ? "/expenses" : undefined;
}

function receiptDetailForPath(path: string): {
  receiptId: string;
  focusedLineId?: string;
} | undefined {
  if (!path.startsWith("/receipt/detail/")) return undefined;
  const [receiptId, query] = path.slice("/receipt/detail/".length).split("?");
  if (!receiptId) return undefined;
  const focusedLineId = new URLSearchParams(query ?? "").get("line") ??
    undefined;
  return focusedLineId ? { receiptId, focusedLineId } : { receiptId };
}

function pathFromHash(): string {
  return globalThis.location.hash === ""
    ? ""
    : routeFromHash(globalThis.location.hash);
}

const LOCAL_UI_HISTORY_STATE = "__afterMidnightLocalUiHistory";

type LocalUiHistoryEntry = {
  readonly path: string;
  readonly hash: string;
  readonly index: number;
};

type LocalUiHistoryState = {
  readonly index: number;
  readonly path: string;
};

type LocalUiPendingNavigation =
  | { readonly kind: "route"; readonly path: LocalUiPath }
  | {
    readonly kind: "history";
    readonly source: LocalUiHistoryEntry;
    readonly target: LocalUiHistoryEntry;
  };

type LocalUiHistoryTransition =
  | {
    readonly phase: "restoring";
    readonly source: LocalUiHistoryEntry;
    readonly target: LocalUiHistoryEntry;
  }
  | {
    readonly phase: "waiting";
    readonly source: LocalUiHistoryEntry;
    readonly target: LocalUiHistoryEntry;
  }
  | { readonly phase: "committing"; readonly target: LocalUiHistoryEntry };

function readLocalUiHistoryState(value: unknown): LocalUiHistoryState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as Record<string, unknown>)[LOCAL_UI_HISTORY_STATE];
  if (!candidate || typeof candidate !== "object") return null;
  const state = candidate as Record<string, unknown>;
  return typeof state.index === "number" && Number.isInteger(state.index) &&
      typeof state.path === "string"
    ? { index: state.index, path: state.path }
    : null;
}

function historyStateFor(entry: LocalUiHistoryEntry): Record<string, unknown> {
  const current = globalThis.history.state;
  const base = current && typeof current === "object" &&
      !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
  return {
    ...base,
    [LOCAL_UI_HISTORY_STATE]: {
      index: entry.index,
      path: entry.path,
    },
  };
}

function historyEntryForLocation(index = 0): LocalUiHistoryEntry {
  const path = pathFromHash();
  const state = readLocalUiHistoryState(globalThis.history.state);
  return {
    path,
    hash: globalThis.location.hash,
    index: state?.path === path ? state.index : index,
  };
}

function sameHistoryEntry(
  left: LocalUiHistoryEntry,
  right: LocalUiHistoryEntry,
): boolean {
  return left.index === right.index && left.path === right.path &&
    left.hash === right.hash;
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

export function DirtyExitGuard({
  isOpen,
  onKeepEditing,
  onDiscard,
}: {
  isOpen: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  const discardIntentRef = useRef(false);
  return (
    <AdaptiveDialog
      trigger={
        <Button
          className="local-ui-dirty-exit-trigger"
          aria-hidden="true"
          isDisabled
          variant="quiet"
        >
          Open unsaved changes guard
        </Button>
      }
      title="Unsaved changes"
      isOpen={isOpen}
      isDismissable={false}
      onOpenChange={(open) => {
        if (open) return;
        if (discardIntentRef.current) {
          discardIntentRef.current = false;
          return;
        }
        onKeepEditing();
      }}
    >
      {(close) => (
        <Stack gap={5}>
          <Text>
            Your changes are saved on this device. Keep editing or discard them
            before leaving this workflow.
          </Text>
          <FormActions>
            <Button
              variant="quiet"
              onPress={() => {
                onKeepEditing();
                close();
              }}
            >
              Keep editing
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                discardIntentRef.current = true;
                onDiscard();
                close();
              }}
            >
              Discard changes
            </Button>
          </FormActions>
        </Stack>
      )}
    </AdaptiveDialog>
  );
}

export type LoadingScreenProps = { readonly title?: string };

export function LoadingScreen(props?: LoadingScreenProps) {
  const title = props?.title ?? "Loading local data";
  return (
    <ContentContainer size="readable">
      <Stack gap={4}>
        <PageHeader headingLevel={1} title={title} />
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

type ExpenseFeedEntry =
  | {
    readonly kind: "expense";
    readonly item: ExpenseQueryResult["expenses"][number];
  }
  | {
    readonly kind: "receipt";
    readonly group: ExpenseQueryResult["receiptGroups"][number];
  };

function compareExpenseFeedEntries(
  left: ExpenseFeedEntry,
  right: ExpenseFeedEntry,
  order: "newest" | "oldest",
): number {
  return compareExpenseTimelineEntries(
    left.kind === "receipt"
      ? {
        date: left.group.receipt.date,
        time: left.group.receipt.time,
        id: left.group.id,
      }
      : left.item,
    right.kind === "receipt"
      ? {
        date: right.group.receipt.date,
        time: right.group.receipt.time,
        id: right.group.id,
      }
      : right.item,
    order,
  );
}

export function ExpensesScreen({
  state,
  expenseDayBoundary,
  offline,
  onAdd,
  onEdit,
  onViewReceipt,
  onProjectChange,
}: {
  state: ProjectCategoryState;
  expenseDayBoundary: string;
  offline: boolean;
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onViewReceipt: (receiptId: string, focusedLineId?: string) => void;
  onProjectChange: (projectId: string) => void;
}) {
  const syncStatus = useSyncStatus();
  const currentProject =
    state.projects.find((project) => project.id === state.selectedProjectId) ??
      state.projects.find((project) => !project.archived);
  const [period, setPeriod] = useState("today");
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
  const categories = result.categoryBreakdown.map((category) => ({
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
  const expenseFeed: readonly ExpenseFeedEntry[] = [
    ...result.expenses.filter((item) => item.receiptId === undefined).map((
      item,
    ) => ({
      kind: "expense" as const,
      item,
    })),
    ...result.receiptGroups.map((group) => ({
      kind: "receipt" as const,
      group,
    })),
  ].sort((left, right) => compareExpenseFeedEntries(left, right, sort));

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
          status={syncStatus
            ? (
              <SyncStatusIndicator
                view={syncStatus.view}
                onOpenSync={syncStatus.onOpenSync}
                onReconnect={syncStatus.onReconnect}
              />
            )
            : undefined}
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
          className="local-ui-expenses-project-picker"
          value={currentProject?.id}
          options={projectOptions}
          onValueChange={onProjectChange}
        />
        <ResponsiveGrid
          columns={2}
          gap={5}
          className="local-ui-expenses-layout"
        >
          <Stack gap={4} className="local-ui-expenses-context">
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
              <div className="local-ui-expenses-filter-bar__search-row">
                <SearchField
                  label="Find"
                  placeholder="Merchant or description"
                  value={search}
                  onValueChange={setSearch}
                />
                <FilterSheet
                  trigger={
                    <Button
                      variant="secondary"
                      className="local-ui-expenses-filter-bar__trigger"
                    >
                      <Icon>
                        <SlidersHorizontal />
                      </Icon>{" "}
                      Filters
                    </Button>
                  }
                  onReset={() => {
                    setCurrency("");
                    setMinimum("");
                    setMaximum("");
                    setSort("newest");
                  }}
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
                      fullWidth
                      label="Sort order"
                      value={sort}
                      onChange={(value) =>
                        setSort(value as "newest" | "oldest")}
                      options={[{ id: "newest", label: "Newest first" }, {
                        id: "oldest",
                        label: "Oldest first",
                      }]}
                    />
                  </Stack>
                </FilterSheet>
              </div>
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
                  ? [{
                    id: "currency",
                    label: currency,
                    onRemove: removeCurrency,
                  }]
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
          </Stack>
          <Stack gap={4} className="local-ui-expenses-feed">
            {expenseFeed.length === 0
              ? (
                <EmptyState
                  title={search || categoryId
                    ? "No expenses match these filters"
                    : "No expenses in this period"}
                  action={
                    <Button data-expenses-add="true" onPress={onAdd}>
                      Add an expense
                    </Button>
                  }
                >
                  {search || categoryId
                    ? "Try removing a filter or choose another period."
                    : "Your local expense list will appear here after the first save."}
                </EmptyState>
              )
              : (
                <>
                  <div data-expenses-list-heading tabIndex={-1}>
                    <Heading size="sm">Expense list</Heading>
                  </div>
                  <div data-expenses-feed="true">
                    <List label="Expenses">
                      {expenseFeed.map((entry) =>
                        entry.kind === "expense"
                          ? (
                            <ExpenseRow
                              key={entry.item.id}
                              expense={{
                                ...expenseViewModel(entry.item),
                                category:
                                  categoryById.get(entry.item.categoryId) ??
                                    entry.item.categoryId,
                              }}
                              onSelect={(id) => {
                                const expense = state.expenses.find((
                                  candidate,
                                ) => candidate.id === id);
                                if (expense) onEdit(expense);
                              }}
                            />
                          )
                          : (
                            <li
                              key={entry.group.id}
                              data-receipt-group-id={entry.group.id}
                            >
                              <Card as="section">
                                <ReceiptGroup
                                  merchant={entry.group.receipt.merchant ??
                                    "Receipt"}
                                  date={entry.group.receipt.date}
                                  lines={entry.group.lines.map((item) => ({
                                    ...expenseViewModel(item),
                                    category:
                                      categoryById.get(item.categoryId) ??
                                        item.categoryId,
                                  }))}
                                  total={{
                                    amount: entry.group.total,
                                    currency: entry.group.receipt.currency,
                                  }}
                                  defaultExpanded
                                  onViewReceipt={() =>
                                    onViewReceipt(entry.group.id)}
                                  onSelectLine={(id) => {
                                    onViewReceipt(entry.group.id, id);
                                  }}
                                />
                              </Card>
                            </li>
                          )
                      )}
                    </List>
                  </div>
                </>
              )}
          </Stack>
        </ResponsiveGrid>
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

async function saveProjectSafetyExport(json: string): Promise<void> {
  if (
    globalThis.document === undefined ||
    globalThis.URL?.createObjectURL === undefined
  ) {
    throw { code: "unavailable" };
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "did-it-become-what-you-like-project-safety.json";
  anchor.click();
  URL.revokeObjectURL(url);
  await Promise.resolve();
}

function ProjectDeletionReview({
  repository,
  state,
  project,
  onDeleted,
}: {
  repository: LocalRepository;
  state: ProjectCategoryState;
  project: Project;
  onDeleted: () => void;
}) {
  const dependencies = useMemo(
    () =>
      createProjectDeletionDependencies(repository, {
        deviceId: repository.deviceId,
        saveSafetyExport: saveProjectSafetyExport,
      }),
    [repository],
  );
  const [generation, setGeneration] = useState(0);
  const machine = useMemo(
    () => createProjectDeletionMachine(dependencies),
    [dependencies, generation],
  );
  const [snapshot, send] = useActor(machine);
  const [isOpen, setIsOpen] = useState(false);
  const [openRequested, setOpenRequested] = useState(false);
  const handledResult = useRef(false);
  const expenses = state.expenses.filter((expense) =>
    expense.projectId === project.id
  );
  const receipts = state.receipts.filter((receipt) =>
    receipt.projectId === project.id
  );
  const purchaseLines = state.receiptPurchaseLines.filter((line) =>
    line.projectId === project.id
  );
  const adjustments = state.receiptAdjustments.filter((adjustment) =>
    adjustment.projectId === project.id
  );
  const dates = [
    ...expenses.map((expense) => expense.date),
    ...receipts.map((receipt) => receipt.date),
  ].sort();
  const currencies = [
    ...new Set([
      ...expenses.map((expense) => expense.currency),
      ...receipts.map((receipt) => receipt.currency),
    ]),
  ].sort();
  const target = {
    projectId: project.id,
    projectName: project.name,
    expenseCount: expenses.length,
    receiptCount: receipts.length,
  };

  useEffect(() => {
    if (!openRequested || !snapshot.matches("idle")) return;
    setOpenRequested(false);
    send({
      type: "project-delete.open",
      target,
      safetyExportRequired: true,
    });
  }, [openRequested, send, snapshot, target]);

  useEffect(() => {
    if (
      !snapshot.matches("completed") || snapshot.context.result === null ||
      handledResult.current
    ) return;
    handledResult.current = true;
    setIsOpen(false);
    onDeleted();
  }, [onDeleted, snapshot]);

  const cancel = (close: () => void) => {
    send({ type: "project-delete.cancel" });
    setOpenRequested(false);
    setIsOpen(false);
    close();
  };

  const terminal = snapshot.matches("completed") ||
    snapshot.matches("cancelled");
  const saving = snapshot.hasTag("saving");
  const failure = snapshot.context.error?.message;

  return (
    <AdaptiveDialog
      trigger={<Button variant="danger">Delete project</Button>}
      title={`Delete ${project.name}?`}
      isOpen={isOpen}
      onOpenChange={(next) => {
        if (next) {
          handledResult.current = false;
          if (terminal) setGeneration((value) => value + 1);
          setIsOpen(true);
          setOpenRequested(true);
        } else {
          send({ type: "project-delete.cancel" });
          setOpenRequested(false);
          setIsOpen(false);
        }
      }}
      isDismissable={!saving}
      className="local-ui-project-delete-dialog"
    >
      {(close) => (
        <Stack gap={5}>
          <InlineNotice tone="danger" title="Destructive action">
            This removes the project and all of its related records from this
            device using synchronized tombstones. It does not erase Automerge
            history; recovery is through the safety JSON export.
          </InlineNotice>
          <DefinitionList
            items={[
              { term: "Project", description: project.name },
              { term: "Expenses", description: expenses.length },
              { term: "Receipt parents", description: receipts.length },
              { term: "Purchase lines", description: purchaseLines.length },
              { term: "Adjustments", description: adjustments.length },
              {
                term: "Currencies",
                description: currencies.length ? currencies.join(", ") : "None",
              },
              {
                term: "Date range",
                description: dates.length
                  ? `${dates[0]} – ${dates[dates.length - 1]}`
                  : "None",
              },
            ]}
          />
          {snapshot.matches("reviewing")
            ? (
              <Stack gap={3}>
                <Text>
                  Create a complete canonical JSON safety export before the
                  destructive confirmation.
                </Text>
                <FormActions>
                  <Button variant="quiet" onPress={() => cancel(close)}>
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() =>
                      send({ type: "project-delete.export-safety" })}
                  >
                    Export safety copy
                  </Button>
                </FormActions>
              </Stack>
            )
            : null}
          {snapshot.matches("exporting")
            ? (
              <InlineNotice tone="info" title="Creating safety export">
                Keep this window open while the complete JSON file is created.
              </InlineNotice>
            )
            : null}
          {snapshot.matches("exportFailed")
            ? (
              <InlineNotice tone="danger" title="Safety export failed">
                {failure ?? "The safety export was not created."}
                <FormActions>
                  <Button variant="quiet" onPress={() => cancel(close)}>
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => send({ type: "project-delete.retry" })}
                  >
                    Retry export
                  </Button>
                </FormActions>
              </InlineNotice>
            )
            : null}
          {snapshot.matches("confirming")
            ? (
              <Stack gap={4}>
                <TextField
                  label={`Type ${project.name} to confirm`}
                  value={snapshot.context.typedName}
                  onChange={(value) =>
                    send({ type: "project-delete.type-name", value })}
                  description="The name must match exactly."
                  error={failure}
                  autoFocus
                />
                <FormActions>
                  <Button variant="quiet" onPress={() => cancel(close)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    isDisabled={snapshot.context.typedName !== project.name}
                    onPress={() => send({ type: "project-delete.confirm" })}
                  >
                    Delete project
                  </Button>
                </FormActions>
              </Stack>
            )
            : null}
          {snapshot.matches("deleting")
            ? (
              <InlineNotice tone="info" title="Deleting project">
                Creating the complete synchronized tombstone set atomically.
              </InlineNotice>
            )
            : null}
          {snapshot.matches("failed")
            ? (
              <InlineNotice tone="danger" title="Project deletion failed">
                {failure ?? "The deletion was not committed."}
                <FormActions>
                  <Button variant="quiet" onPress={() => cancel(close)}>
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => send({ type: "project-delete.retry" })}
                  >
                    Retry deletion
                  </Button>
                </FormActions>
              </InlineNotice>
            )
            : null}
        </Stack>
      )}
    </AdaptiveDialog>
  );
}

export function ProjectManager({
  repository,
  service,
  state,
  initialCreate = false,
  onStateChange,
  onNavigate,
  onComplete,
}: {
  repository?: LocalRepository;
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
  const isSubmittingRef = useRef(false);

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
      editor?.kind === "create" &&
      isSubmittingRef.current &&
      snapshot.context.result &&
      snapshot.matches("ready")
    ) {
      isSubmittingRef.current = false;
      setEditor(null);
      onComplete?.();
    }
  }, [editor, onComplete, snapshot]);

  const openEditor = (nextEditor: EditorState<Project>) =>
    setEditor(nextEditor);
  const submitEditor = () => {
    if (!name.trim() || !snapshot.matches("ready")) return;
    if (editor?.kind === "create") {
      isSubmittingRef.current = true;
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
            headingLevel={1}
            leading={
              <IconButton
                icon={<ArrowLeft />}
                aria-label="Back"
                variant="quiet"
                onPress={() => setEditor(null)}
              />
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
              <CurrencyPicker
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
                <Button
                  variant="secondary"
                  onPress={() => {
                    send({ type: "project.cancel" });
                    setEditor(null);
                    onComplete?.();
                  }}
                >
                  Cancel
                </Button>
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
            <IconButton
              icon={<ArrowLeft />}
              aria-label="Back to organize"
              variant="quiet"
              onPress={() => onNavigate("/organize")}
            />
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
                  </Inline>
                  <div className="local-ui-card-actions--primary-stack">
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
                    <div className="local-ui-card-actions--grid">
                      <Button
                        variant="quiet"
                        onPress={() =>
                          openEditor({ kind: "edit", record: project })}
                      >
                        Edit
                      </Button>
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
                        : repository
                        ? (
                          <ProjectDeletionReview
                            repository={repository}
                            state={state}
                            project={project}
                            onDeleted={() => {
                              void service.getState().then(onStateChange);
                            }}
                          />
                        )
                        : (
                          <Text size="caption" tone="muted">
                            Deletion unavailable.
                          </Text>
                        )}
                    </div>
                  </div>
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
  const projects = state.projects.filter((project) => !project.archived);
  const categories = state.categories.filter((category) => !category.archived);
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
  {
    expenseDayBoundary,
    syncSummary,
    geminiSummary,
    onGemini,
    onSync,
    onImport,
    onPrivacy,
    onPreferences,
    onAbout,
  }: {
    expenseDayBoundary: string;
    syncSummary?: string;
    geminiSummary?: string;
    onGemini?: () => void;
    onSync?: () => void;
    onImport?: () => void;
    onPrivacy?: () => void;
    onPreferences?: () => void;
    onAbout?: () => void;
  },
) {
  const rows = [
    {
      label: "Google Drive and sync",
      summary: syncSummary ?? "Open to view current sync status",
      available: Boolean(onSync),
    },
    {
      label: "Gemini receipt scanning",
      summary: geminiSummary ?? "Open to view key and model status",
      available: Boolean(onGemini),
    },
    {
      label: "Preferences",
      summary: `Expense day ${expenseDayBoundary}`,
      available: Boolean(onPreferences),
    },
    {
      label: "Import and export",
      summary: "JSON backup workflows",
      available: Boolean(onImport),
    },
    {
      label: "Data and privacy",
      summary: "Local data controls",
      available: Boolean(onPrivacy),
    },
    {
      label: "About and disclosure",
      summary: "After Midnight",
      available: Boolean(onAbout),
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
                  aria-label={"Open " + row.label}
                  onPress={row.label === "Gemini receipt scanning"
                    ? onGemini
                    : row.label === "Google Drive and sync"
                    ? onSync
                    : row.label === "Import and export"
                    ? onImport
                    : row.label === "Data and privacy"
                    ? onPrivacy
                    : row.label === "Preferences"
                    ? onPreferences
                    : row.label === "About and disclosure"
                    ? onAbout
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
  const isSubmittingRef = useRef(false);

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
    isSubmittingRef.current = true;
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
          color,
        },
      });
    }
  };

  useEffect(() => {
    if (
      editor &&
      isSubmittingRef.current &&
      snapshot.context.result &&
      snapshot.matches("ready")
    ) {
      isSubmittingRef.current = false;
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
            headingLevel={1}
            leading={
              <IconButton
                icon={<ArrowLeft />}
                aria-label="Back"
                variant="quiet"
                onPress={() => setEditor(null)}
              />
            }
          />
          <Card as="section">
            <Stack gap={5}>
              <TextField
                label="Category name"
                isRequired
                value={name}
                onChange={setName}
                error={snapshot.context.error?.code === "conflict"
                  ? snapshot.context.error.message
                  : undefined}
              />
              <ColorChoiceField
                label="Category color (optional)"
                value={color}
                onValueChange={setColor}
                description="Color supplements the category name and is never its only identifier."
              />
              {color
                ? (
                  <Button variant="quiet" onPress={() => setColor(undefined)}>
                    Clear color
                  </Button>
                )
                : null}
              {snapshot.context.error
                ? (
                  <InlineNotice tone="danger" title="Category was not saved">
                    {snapshot.context.error.message}
                  </InlineNotice>
                )
                : null}
              <FormActions>
                <Button
                  variant="secondary"
                  onPress={() => {
                    send({ type: "category.cancel" });
                    setEditor(null);
                    onComplete?.();
                  }}
                >
                  Cancel
                </Button>
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
  const replacementCategories = state.categories
    .filter((candidate) =>
      !candidate.archived && candidate.id !== uncategorized?.id
    )
    .concat(uncategorized ? [uncategorized] : []);

  return (
    <ContentContainer>
      <Stack gap={5}>
        <PageHeader
          headingLevel={1}
          title="Manage categories"
          leading={
            <IconButton
              icon={<ArrowLeft />}
              aria-label="Back to organize"
              variant="quiet"
              onPress={() => onNavigate("/organize")}
            />
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
                <div className="local-ui-card-actions--grid">
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
                  <DeleteAndReassign
                    trigger={
                      <Button variant="danger">Delete and reassign</Button>
                    }
                    title={`Delete ${category.name}?`}
                    description="Choose the category which should receive every reference to this category."
                    replacementOptions={replacementCategories.map(
                      (replacement) => ({
                        id: replacement.id,
                        label: replacement.name,
                      }),
                    )}
                    defaultReplacementId={uncategorized?.id ?? ""}
                    affectedCount={state.expenses.filter((expense) =>
                      expense.categoryId === category.id
                    ).length}
                    onConfirm={(replacementCategoryId) =>
                      send({
                        type: "category.command",
                        command: {
                          type: "delete-and-reassign",
                          categoryId: category.id,
                          replacementCategoryId,
                        },
                      })}
                  />
                </div>
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
  onUsefulAction,
  onDirtyChange,
  discardRequest,
  onClosed,
}: {
  repository: LocalPort;
  service: ProjectCategoryService;
  state: ProjectCategoryState;
  request: ManualExpenseOpenRequest;
  onSaved: (expense: Expense, mode: ManualSaveMode) => void;
  onUsefulAction?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  discardRequest?: number;
  onClosed: (status?: "deleted") => void;
}) {
  const [machineKey, setMachineKey] = useState(0);
  const persistenceKey = request.expense
    ? `workflow:manual-expense:edit:${request.expense.id}`
    : undefined;
  const machine = useMemo(
    () =>
      createManualExpenseMachine({ local: repository, organization: service }),
    [repository, service, machineKey],
  );
  const [snapshot, send] = useActor(machine, { input: { persistenceKey } });
  const completionHandled = useRef(false);
  const usefulActionHandled = useRef(false);
  const syncMutationHandled = useRef(false);
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const syncStatus = useSyncStatus();

  useEffect(() => {
    if (request.expense) {
      send({ type: "expense.open", request });
    } else {
      send({ type: "expense.hydrate" });
      send({ type: "expense.open", request });
    }
  }, [machineKey, request, send]);

  const saveMode = useRef<ManualSaveMode>("expenses");
  useEffect(() => {
    if (
      !syncMutationHandled.current && snapshot.matches("saved") &&
      snapshot.context.result?.expense
    ) {
      syncMutationHandled.current = true;
      syncStatus?.notifyLocalMutation();
    }
    if (completionHandled.current) return;
    if (snapshot.matches("deleted")) {
      send({ type: "expense.finish-delete" });
      return;
    }
    if (
      snapshot.matches("saved") && snapshot.context.result?.expense &&
      saveMode.current === "another"
    ) {
      completionHandled.current = true;
      onSaved(snapshot.context.result.expense, saveMode.current);
    } else if (
      snapshot.matches("discarded") || snapshot.matches("cancelled") ||
      snapshot.matches("deletedOutput") || snapshot.matches("savedOutput") ||
      snapshot.matches("savedUndone")
    ) {
      completionHandled.current = true;
      onClosed(snapshot.matches("deletedOutput") ? "deleted" : undefined);
    }
  }, [onClosed, onSaved, send, snapshot, syncStatus]);

  const dirty = snapshot.hasTag("dirty");
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

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
      usefulActionHandled.current || !snapshot.matches("saved") ||
      !snapshot.context.result?.expense
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
  if (
    snapshot.matches("hydrating") || snapshot.matches("opening") ||
    draft === null
  ) {
    return (
      <LoadingScreen title={request.expense ? "Edit expense" : "New expense"} />
    );
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
  const failed = snapshot.matches("saveFailed") ||
    snapshot.matches("saveAnotherFailed");
  const deleteFailed = snapshot.matches("deleteFailed");
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
            <IconButton
              icon={<X />}
              aria-label="Close"
              variant="quiet"
              onPress={() => send({ type: "expense.back" })}
            />
          }
        />
        <ExpenseForm
          status={failed || deleteFailed || busy ||
              snapshot.hasTag("draft-saving") ||
              (snapshot.hasTag("dirty") &&
                Boolean(
                  draft.amount.trim() || draft.merchant?.trim() ||
                    draft.description?.trim() ||
                    snapshot.context.originalExpense,
                ))
            ? (
              <DraftStatus
                state={failed || deleteFailed
                  ? "failed"
                  : busy
                  ? "saving"
                  : snapshot.hasTag("draft-saving")
                  ? "saving"
                  : "dirty"}
                detail={failed || deleteFailed
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
                  : snapshot.hasTag("dirty") && !busy
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
            fullWidth
            label="Direction"
            value={draft.direction}
            onChange={(value) =>
              update({ direction: value as ManualExpenseDraft["direction"] })}
            options={[{ id: "spent", label: "Spent" }, {
              id: "money-back",
              label: "Money back",
            }]}
          />
          <div className="local-ui-form-row local-ui-form-row--amount-currency">
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
          </div>
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
          <div className="local-ui-form-row local-ui-form-row--date-time">
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
          </div>
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
                fullWidth
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
  const receiptManagement = useMemo(
    () => createReceiptManagementService(repository),
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
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [usefulActionVersion, setUsefulActionVersion] = useState(0);
  const [workflowDirty, setWorkflowDirty] = useState(false);
  const [dirtyNavigationWorkflow, setDirtyNavigationWorkflow] = useState(
    false,
  );
  const [dirtyExitOpen, setDirtyExitOpen] = useState(false);
  const [discardRequest, setDiscardRequest] = useState(0);
  const pendingNavigationRef = useRef<LocalUiPendingNavigation | null>(null);
  const currentHistoryRef = useRef<LocalUiHistoryEntry | null>(null);
  const historyTransitionRef = useRef<LocalUiHistoryTransition | null>(null);
  const receiptReturnFocusRef = useRef<
    | { readonly kind: "receipt"; readonly receiptId: string }
    | { readonly kind: "expenses" }
    | { readonly kind: "expenses-add" }
    | null
  >(null);
  const dirtyNavigationRef = useRef(false);
  dirtyNavigationRef.current = dirtyNavigationWorkflow;
  if (currentHistoryRef.current === null) {
    currentHistoryRef.current = historyEntryForLocation();
  }
  const [deviceSettings, setDeviceSettings] = useState<DeviceLocalSettings>({
    imagePreparationEnabled: true,
  });
  const [syncSummary, setSyncSummary] = useState("Not connected");
  const [geminiSummary, setGeminiSummary] = useState("Not configured");
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
    let active = true;
    void secretStorage.get("gemini-api-key").then((key) => {
      if (!active) return;
      setGeminiSummary(
        key === undefined
          ? "Not configured"
          : deviceSettings.selectedGeminiModel
          ? "Key and model configured"
          : "Key configured; choose a model",
      );
    }).catch(() => {
      if (active) setGeminiSummary("Configuration status unavailable");
    });
    return () => {
      active = false;
    };
  }, [deviceSettings.selectedGeminiModel, secretStorage]);

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

  useEffect(() => {
    if (path !== "/expenses") return;
    const request = receiptReturnFocusRef.current;
    if (!request) return;
    const receiptGroup = request.kind === "receipt"
      ? Array.from(
        document.querySelectorAll<HTMLElement>("[data-receipt-group-id]"),
      ).find((element) => element.dataset.receiptGroupId === request.receiptId)
      : undefined;
    const target = request.kind === "expenses-add"
      ? document.querySelector<HTMLElement>("[data-expenses-add]") ??
        document.querySelector<HTMLElement>("[data-expenses-list-heading]")
      : request.kind === "expenses"
      ? document.querySelector<HTMLElement>("[data-expenses-list-heading]") ??
        document.querySelector<HTMLElement>("[data-expenses-add]")
      : receiptGroup?.querySelector<HTMLElement>("button") ??
        document.querySelector<HTMLElement>("[data-expenses-list-heading]") ??
        document.querySelector<HTMLElement>("[data-expenses-add]");
    if (!target) return;
    receiptReturnFocusRef.current = null;
    queueMicrotask(() => {
      if (target.isConnected) target.focus();
    });
  }, [path, state]);

  const navigate = (nextPath: LocalUiPath) => {
    const current = currentHistoryRef.current;
    if (!current) return;
    const hash = hashForRoute(nextPath);
    if (globalThis.location.hash !== hash) {
      const nextEntry: LocalUiHistoryEntry = {
        path: nextPath,
        hash,
        index: current.index + 1,
      };
      globalThis.history.pushState(historyStateFor(nextEntry), "", hash);
      currentHistoryRef.current = nextEntry;
    } else {
      const nextEntry = { ...current, path: nextPath };
      globalThis.history.replaceState(
        historyStateFor(nextEntry),
        "",
        hash,
      );
      currentHistoryRef.current = nextEntry;
      setPath(nextPath);
    }
    setPath(nextPath);
  };

  useEffect(() => {
    if (!shellReady || state === null) return;
    const redirect = firstUseRedirectPath(path, state.projects.length);
    if (redirect !== undefined) navigate(redirect);
  }, [navigate, path, shellReady, state]);

  const requestNavigation = (nextPath: LocalUiPath) => {
    if (dirtyNavigationWorkflow) {
      pendingNavigationRef.current = { kind: "route", path: nextPath };
      setDirtyExitOpen(true);
      return;
    }
    navigate(nextPath);
  };

  const commitHistoryNavigation = (target: LocalUiHistoryEntry) => {
    const current = currentHistoryRef.current;
    if (!current) return;
    const delta = target.index - current.index;
    if (delta === 0) {
      globalThis.history.replaceState(historyStateFor(target), "", target.hash);
      currentHistoryRef.current = target;
      historyTransitionRef.current = null;
      setPath(target.path);
      return;
    }
    historyTransitionRef.current = { phase: "committing", target };
    globalThis.history.go(delta);
  };

  const finishDirtyNavigation = (fallback: LocalUiPath) => {
    const pending = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setDirtyExitOpen(false);
    setDirtyNavigationWorkflow(false);
    setWorkflowDirty(false);
    if (pending?.kind === "history") {
      commitHistoryNavigation(pending.target);
      return;
    }
    navigate(pending?.path ?? fallback);
  };

  useEffect(() => {
    const current = currentHistoryRef.current;
    if (!current) return;
    const state = readLocalUiHistoryState(globalThis.history.state);
    if (
      !state || state.index !== current.index || state.path !== current.path
    ) {
      globalThis.history.replaceState(
        historyStateFor(current),
        "",
        current.hash,
      );
    }
  }, []);

  useEffect(() => {
    const onHistoryChange = () => {
      const current = currentHistoryRef.current;
      if (!current) return;

      const targetPath = pathFromHash();
      const state = readLocalUiHistoryState(globalThis.history.state);
      const target: LocalUiHistoryEntry = state?.path === targetPath
        ? {
          path: targetPath,
          hash: globalThis.location.hash,
          index: state.index,
        }
        : {
          path: targetPath,
          hash: globalThis.location.hash,
          index: current.index + 1,
        };

      if (!state || state.path !== targetPath) {
        globalThis.history.replaceState(
          historyStateFor(target),
          "",
          target.hash,
        );
      }

      const transition = historyTransitionRef.current;
      if (transition?.phase === "committing") {
        if (sameHistoryEntry(target, transition.target)) {
          historyTransitionRef.current = null;
          currentHistoryRef.current = target;
          setPath(target.path);
        }
        return;
      }

      if (transition?.phase === "restoring") {
        if (!sameHistoryEntry(target, transition.source)) return;
        if (!dirtyNavigationRef.current) {
          commitHistoryNavigation(transition.target);
          return;
        }
        historyTransitionRef.current = {
          phase: "waiting",
          source: transition.source,
          target: transition.target,
        };
        pendingNavigationRef.current = {
          kind: "history",
          source: transition.source,
          target: transition.target,
        };
        setDirtyExitOpen(true);
        return;
      }

      if (transition?.phase === "waiting") {
        if (sameHistoryEntry(target, transition.source)) return;
        const delta = transition.source.index - target.index;
        if (delta !== 0) globalThis.history.go(delta);
        return;
      }
      if (sameHistoryEntry(target, current)) return;

      if (dirtyNavigationRef.current) {
        const delta = target.index - current.index;
        if (delta === 0) return;
        historyTransitionRef.current = {
          phase: "restoring",
          source: current,
          target,
        };
        pendingNavigationRef.current = {
          kind: "history",
          source: current,
          target,
        };
        globalThis.history.go(-delta);
        return;
      }

      currentHistoryRef.current = target;
      setPath(target.path);
    };

    globalThis.addEventListener("hashchange", onHistoryChange);
    globalThis.addEventListener("popstate", onHistoryChange);
    return () => {
      globalThis.removeEventListener("hashchange", onHistoryChange);
      globalThis.removeEventListener("popstate", onHistoryChange);
    };
  }, []);

  const updateDeviceSettings = async (next: DeviceLocalSettings) => {
    setDeviceSettings(next);
    if (next.geminiKeyRevision === undefined) {
      setGeminiSummary("Not configured");
    } else if (next.selectedGeminiModel) {
      setGeminiSummary("Key and model configured");
    } else {
      setGeminiSummary("Key configured; choose a model");
    }
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

  const activePath = path === "/add"
    ? "/expense/new"
    : (path || (state.projects.length ? "/expenses" : "/first-use"));
  const receiptDetail = receiptDetailForPath(activePath);
  const contentPath = activePath;
  const selectedNavigation = selectedNavigationForPath(activePath);
  const portabilityScreen: SyncPortabilityScreen =
    activePath === "/settings/sync"
      ? "sync"
      : activePath === "/settings/devices"
      ? "devices"
      : activePath === "/settings/conflicts"
      ? "conflicts"
      : activePath === "/settings/import-export"
      ? "import-export"
      : activePath === "/settings/privacy"
      ? "privacy"
      : null;

  const selectNavigation = (id: string) => {
    if (id === "manual") return requestNavigation("/expense/new");
    if (id === "scan") return requestNavigation("/receipt/scan");
    if (id === "organize" || id === "settings" || id === "expenses") {
      requestNavigation(`/${id}` as LocalUiPath);
    }
  };

  const completeReceiptDetail = (output: {
    status: string;
    destination?: string;
    deletedLineId?: string;
  }) => {
    setWorkflowDirty(false);
    setDirtyNavigationWorkflow(false);
    if (output.status === "deleted") {
      receiptReturnFocusRef.current = { kind: "expenses-add" };
      void organization.getState().then(setState);
      setAppNotice(
        output.deletedLineId === undefined
          ? "Receipt deleted."
          : "Final receipt line deleted; receipt removed.",
      );
      navigate("/expenses");
      return;
    }
    if (output.status === "navigated" || output.status === "discarded") {
      if (output.destination === "/expenses" && receiptDetail !== undefined) {
        receiptReturnFocusRef.current = {
          kind: "receipt",
          receiptId: receiptDetail.receiptId,
        };
      }
      void organization.getState().then(setState);
      navigate((output.destination ?? "/expenses") as LocalUiPath);
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
      <PwaRuntime
        usefulActionVersion={usefulActionVersion}
        dirty={workflowDirty}
      >
        <SyncPortabilityRuntime
          repository={repository}
          screen={portabilityScreen}
          onNavigate={(nextPath) => navigate(nextPath as LocalUiPath)}
          onNotice={setAppNotice}
          secretStorage={secretStorage}
          onSyncSummary={setSyncSummary}
          onSyncCompleted={() =>
            sendShell({ type: "shell.repository.refresh" })}
          onLocalErased={(scope) => {
            void scope;
            if (typeof globalThis.location?.reload === "function") {
              globalThis.location.reload();
            }
          }}
        >
          {contentPath === "/first-use"
            ? (
              <FirstUseScreen
                onCreateProject={() => {
                  setProjectEditorOpen(true);
                  navigate("/projects");
                }}
                onRestoreBackup={() => navigate("/settings/import-export")}
                onConnectDrive={() => navigate("/settings/sync")}
              />
            )
            : contentPath === "/expenses"
            ? (
              <ExpensesScreen
                state={state}
                expenseDayBoundary={expenseDayBoundary}
                offline={shellSnapshot.hasTag("offline")}
                onAdd={() => navigate("/expense/new")}
                onEdit={(expense) => navigate(`/expense/edit/${expense.id}`)}
                onViewReceipt={(receiptId, focusedLineId) => {
                  receiptReturnFocusRef.current = {
                    kind: "receipt",
                    receiptId,
                  };
                  navigate(
                    `/receipt/detail/${receiptId}${
                      focusedLineId ? `?line=${focusedLineId}` : ""
                    }` as LocalUiPath,
                  );
                }}
                onProjectChange={(projectId) =>
                  sendShell({ type: "shell.project.select", projectId })}
              />
            )
            : receiptDetail
            ? (
              <ReceiptDetailScreen
                key={receiptDetail.receiptId}
                service={receiptManagement}
                receiptId={receiptDetail.receiptId}
                focusedLineId={receiptDetail.focusedLineId}
                categories={state.categories}
                discardRequest={discardRequest}
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                onDirtyDiscarded={() => finishDirtyNavigation("/expenses")}
                onBack={() => {
                  receiptReturnFocusRef.current = {
                    kind: "receipt",
                    receiptId: receiptDetail.receiptId,
                  };
                  setWorkflowDirty(false);
                  setDirtyNavigationWorkflow(false);
                  navigate("/expenses");
                }}
                onComplete={completeReceiptDetail}
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
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                discardRequest={discardRequest}
                onDirtyDiscarded={() => finishDirtyNavigation("/expenses")}
                onReview={(review) => {
                  setReceiptReview(review);
                  navigate("/receipt/review");
                }}
                onClose={() => {
                  imageStore.clear();
                  setWorkflowDirty(false);
                  setDirtyNavigationWorkflow(false);
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
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                discardRequest={discardRequest}
                onClose={() => {
                  void organization.getState().then(setState);
                  setReceiptReview(undefined);
                  setWorkflowDirty(false);
                  finishDirtyNavigation("/expenses");
                }}
              />
            )
            : contentPath === "/expense/new" ||
                contentPath.startsWith("/expense/edit/")
            ? (
              <ManualExpenseScreen
                key={contentPath}
                repository={repository}
                service={organization}
                state={state}
                request={manualRequest}
                onSaved={() => {
                  void organization.getState().then(setState);
                }}
                onUsefulAction={() =>
                  setUsefulActionVersion((value) => value + 1)}
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                discardRequest={discardRequest}
                onClosed={(status) => {
                  void organization.getState().then(setState);
                  if (status === "deleted") setAppNotice("Expense deleted.");
                  setWorkflowDirty(false);
                  finishDirtyNavigation("/expenses");
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
                repository={repository}
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
            : contentPath === "/settings/preferences"
            ? (
              <PreferencesScreen
                local={repository}
                onClose={() => requestNavigation("/settings")}
                onSaved={setExpenseDayBoundary}
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                discardRequest={discardRequest}
                onDiscarded={() => finishDirtyNavigation("/settings")}
              />
            )
            : contentPath === "/settings/about"
            ? (
              <AboutScreen
                onClose={() => navigate("/settings")}
                onPrivacy={() => navigate("/settings/privacy")}
              />
            )
            : contentPath === "/settings"
            ? (
              <SettingsScreen
                expenseDayBoundary={expenseDayBoundary}
                syncSummary={syncSummary}
                geminiSummary={geminiSummary}
                onGemini={() => navigate("/settings/gemini")}
                onSync={() => navigate("/settings/sync")}
                onImport={() => navigate("/settings/import-export")}
                onPrivacy={() => navigate("/settings/privacy")}
                onPreferences={() => navigate("/settings/preferences")}
                onAbout={() => navigate("/settings/about")}
              />
            )
            : <FoundationExpensesPlaceholder />}
        </SyncPortabilityRuntime>
        {appNotice
          ? <Toast onDismiss={() => setAppNotice(null)}>{appNotice}</Toast>
          : null}
        <DirtyExitGuard
          isOpen={dirtyExitOpen}
          onKeepEditing={() => {
            pendingNavigationRef.current = null;
            historyTransitionRef.current = null;
            setDirtyExitOpen(false);
          }}
          onDiscard={() => {
            if (pendingNavigationRef.current === null) return;
            // A receipt image is memory-only. Leaving the scan immediately is
            // both safe and more reliable than waiting for an effect in the
            // soon-to-be-unmounted scan screen to observe a discard counter.
            // Its teardown cancels an active request before releasing bytes.
            if (contentPath === "/receipt/scan") {
              imageStore.clear();
              finishDirtyNavigation("/expenses");
              return;
            }
            setDiscardRequest((request) => request + 1);
          }}
        />
      </PwaRuntime>
    </AppFrame>
  );
}

export function LocalApp() {
  const [repository, setRepository] = useState<LocalRepository | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = isSupportedBrowser();

  useEffect(() => {
    if (!supported) return;
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
  }, [supported]);

  if (!supported) return <UnsupportedBrowserScreen />;

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
