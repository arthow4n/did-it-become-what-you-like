import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  compareExpenseTimelineEntries,
  type ExpensePeriod,
  type ExpenseQueryResult,
  queryExpenses,
} from "../../domain/queries/index.ts";
import { CalendarDateSchema, type Expense } from "../../domain/index.ts";
import type { ProjectCategoryState } from "../../domain/organization.ts";
import {
  ActiveFilterChips,
  Banner,
  Button,
  Card,
  CategoryBreakdown,
  ContentContainer,
  CurrencyPicker,
  EmptyState,
  ExpenseRow,
  FilterBar,
  FilterSheet,
  Heading,
  Icon,
  List,
  MoneySummary,
  PeriodPicker,
  ProjectPicker,
  ReceiptGroup,
  ResponsiveGrid,
  SearchField,
  SegmentedControl,
  SelectField,
  Stack,
  TextField,
} from "../../design-system/index.ts";
import { SyncStatusIndicator, useSyncStatus } from "../sync-ui/index.ts";
import { CURRENCY_OPTIONS } from "./types.ts";
type CustomPeriodKind = "day" | "month" | "year";
function localCalendarDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function periodUnitForValue(
  value: string,
  customKind: CustomPeriodKind,
): CustomPeriodKind {
  if (value === "today") return "day";
  if (value === "month" || value === "year") return value;
  return customKind;
}
function shiftCalendarPeriod(
  date: string,
  unit: CustomPeriodKind,
  amount: -1 | 1,
): string {
  const parsed = CalendarDateSchema.safeParse(date);
  const safeDate = parsed.success ? parsed.data : localCalendarDate();
  const [year, month, day] = safeDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day));
  if (unit === "day") shifted.setUTCDate(shifted.getUTCDate() + amount);
  if (unit === "month") {
    shifted.setUTCDate(1);
    shifted.setUTCMonth(shifted.getUTCMonth() + amount);
    shifted.setUTCDate(
      Math.min(
        day,
        new Date(Date.UTC(
          shifted.getUTCFullYear(),
          shifted.getUTCMonth() + 1,
          0,
        )).getUTCDate(),
      ),
    );
  }
  if (unit === "year") {
    shifted.setUTCDate(1);
    shifted.setUTCFullYear(shifted.getUTCFullYear() + amount);
    shifted.setUTCMonth(month - 1);
    shifted.setUTCDate(
      Math.min(day, new Date(Date.UTC(year + amount, month, 0)).getUTCDate()),
    );
  }
  const shiftedYear = shifted.getUTCFullYear().toString().padStart(4, "0");
  const shiftedMonth = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const shiftedDay = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}
function formatPeriodLabel(date: string, unit: CustomPeriodKind): string {
  const safeDate = CalendarDateSchema.safeParse(date);
  const [year, month, day] =
    (safeDate.success ? safeDate.data : localCalendarDate()).split("-").map(
      Number,
    );
  const options: Intl.DateTimeFormatOptions = unit === "day"
    ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
    : unit === "month"
    ? { month: "long", year: "numeric", timeZone: "UTC" }
    : { year: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat(undefined, options).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}
function isSamePeriod(
  left: string,
  right: string,
  unit: CustomPeriodKind,
): boolean {
  if (unit === "year") return left.slice(0, 4) === right.slice(0, 4);
  if (unit === "month") return left.slice(0, 7) === right.slice(0, 7);
  return left === right;
}
function isPeriodAtOrAfter(
  left: string,
  right: string,
  unit: CustomPeriodKind,
): boolean {
  const length = unit === "year" ? 4 : unit === "month" ? 7 : 10;
  return left.slice(0, length) >= right.slice(0, length);
}
function periodForValue(
  value: string,
  customKind: CustomPeriodKind,
  customDate: string,
): ExpensePeriod {
  const parsedDate = CalendarDateSchema.safeParse(customDate);
  const date = parsedDate.success ? parsedDate.data : localCalendarDate();
  const unit = periodUnitForValue(value, customKind);
  if (unit === "day") return { kind: "day", date };
  const [year, month] = date.split("-").map(Number);
  return unit === "month"
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
        merchant: left.group.receipt.merchant,
        description: left.group.lines[0]?.description,
      }
      : left.item,
    right.kind === "receipt"
      ? {
        date: right.group.receipt.date,
        time: right.group.receipt.time,
        id: right.group.id,
        merchant: right.group.receipt.merchant,
        description: right.group.lines[0]?.description,
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
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    if (search === "") {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 150);
    return () => clearTimeout(timer);
  }, [search]);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const queryPeriod = useMemo(
    () => periodForValue(period, customPeriodKind, customPeriodDate),
    [period, customPeriodKind, customPeriodDate],
  );
  const amountRange = useMemo(() => {
    if (!minimum && !maximum) return undefined;
    return {
      ...(minimum ? { min: minimum } : {}),
      ...(maximum ? { max: maximum } : {}),
    };
  }, [minimum, maximum]);
  const queryState = useMemo(() => ({
    expenses: state.expenses,
    receipts: state.receipts,
    receiptPurchaseLines: state.receiptPurchaseLines,
    receiptAdjustments: state.receiptAdjustments,
    categories: state.categories,
    settings: { expenseDayBoundary },
  }), [
    state.expenses,
    state.receipts,
    state.receiptPurchaseLines,
    state.receiptAdjustments,
    state.categories,
    expenseDayBoundary,
  ]);
  const result = useMemo(() => {
    if (!currentProject) {
      return {
        expenses: [],
        receiptGroups: [],
        totals: [],
        categoryBreakdown: [],
      };
    }
    return queryExpenses(
      queryState,
      {
        selectedProjectId: currentProject.id,
        period: queryPeriod,
        ...(categoryId ? { categoryId } : {}),
        ...(currency ? { currency } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        sort,
        ...(amountRange ? { amountRange } : {}),
      },
    );
  }, [
    currentProject,
    queryState,
    queryPeriod,
    categoryId,
    currency,
    debouncedSearch,
    sort,
    amountRange,
  ]);
  const categoryById = useMemo(
    () =>
      new Map(state.categories.map((category) => [category.id, category.name])),
    [state.categories],
  );
  const projectOptions = useMemo(
    () =>
      state.projects.filter((project) => !project.archived).map((project) => ({
        id: project.id,
        label: project.name,
      })),
    [state.projects],
  );
  const activeCategories = useMemo(
    () =>
      state.categories.filter((category) =>
        !category.archived || category.id === categoryId
      ),
    [state.categories, categoryId],
  );
  const categories = useMemo(
    () =>
      result.categoryBreakdown.map((category) => ({
        id: category.categoryId,
        name: category.categoryName,
        amount: category.amount,
        currency: category.currency,
      })),
    [result.categoryBreakdown],
  );
  const totals = useMemo(
    () =>
      result.totals.length
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
        }],
    [result.totals, currentProject?.defaultCurrency],
  );
  const expenseFeed: readonly ExpenseFeedEntry[] = useMemo(
    () =>
      [
        ...result.expenses.filter((item) => item.receiptId === undefined).map(
          (item) => ({
            kind: "expense" as const,
            item,
          }),
        ),
        ...result.receiptGroups.map((group) => ({
          kind: "receipt" as const,
          group,
        })),
      ].sort((left, right) => compareExpenseFeedEntries(left, right, sort)),
    [result.expenses, result.receiptGroups, sort],
  );
  const removeCategory = () => setCategoryId("");
  const removeCurrency = () => setCurrency("");
  const removeSearch = () => setSearch("");
  const currentCalendarDate = localCalendarDate();
  const activePeriodUnit = periodUnitForValue(period, customPeriodKind);
  const isCurrentPeriod = isSamePeriod(
    customPeriodDate,
    currentCalendarDate,
    activePeriodUnit,
  );
  const navigatePeriod = (amount: -1 | 1) => {
    setCustomPeriodDate((date) =>
      shiftCalendarPeriod(date, activePeriodUnit, amount)
    );
  };
  const returnToCurrentPeriod = () => {
    setCustomPeriodDate(currentCalendarDate);
    setPeriod(activePeriodUnit === "day" ? "today" : activePeriodUnit);
  };
  return (
    <ContentContainer>
      <Stack gap={4}>
        <Heading
          level={1}
          className="local-ui-screen-reader-heading"
        >
          Expenses
        </Heading>
        {offline
          ? (
            <Banner tone="warning" title="Offline">
              Local browsing and manual entry are available. AI scanning and
              Drive sync will resume when you reconnect.
            </Banner>
          )
          : null}
        <div className="local-ui-expenses-toolbar">
          <ProjectPicker
            className="local-ui-expenses-project-picker"
            value={currentProject?.id}
            options={projectOptions}
            onValueChange={onProjectChange}
          />
          {syncStatus
            ? (
              <SyncStatusIndicator
                view={syncStatus.view}
                onOpenSync={syncStatus.onOpenSync}
                onReconnect={syncStatus.onReconnect}
              />
            )
            : null}
        </div>
        <ResponsiveGrid
          columns={2}
          gap={5}
          className="local-ui-expenses-layout"
        >
          <Stack gap={4} className="local-ui-expenses-context">
            <FilterBar className="local-ui-expenses-filter-bar">
              <PeriodPicker
                value={period}
                onValueChange={(value) => {
                  setPeriod(value);
                  if (value === "custom") {
                    setCustomPeriodKind(activePeriodUnit);
                  }
                }}
                customKind={customPeriodKind}
                customDate={customPeriodDate}
                onCustomKindChange={setCustomPeriodKind}
                onCustomDateChange={setCustomPeriodDate}
                periodLabel={formatPeriodLabel(
                  customPeriodDate,
                  activePeriodUnit,
                )}
                previousLabel={`Previous ${activePeriodUnit}`}
                nextLabel={`Next ${activePeriodUnit}`}
                onPrevious={() => navigatePeriod(-1)}
                onNext={() => navigatePeriod(1)}
                isNextDisabled={isPeriodAtOrAfter(
                  customPeriodDate,
                  currentCalendarDate,
                  activePeriodUnit,
                )}
                onReturnToCurrent={isCurrentPeriod
                  ? undefined
                  : returnToCurrentPeriod}
                returnToCurrentLabel={activePeriodUnit === "day"
                  ? "Today"
                  : `Current ${activePeriodUnit}`}
              />
              <SelectField
                label=""
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
                    : undefined}
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
