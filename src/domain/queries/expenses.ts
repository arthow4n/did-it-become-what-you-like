import {
  type CanonicalDecimal,
  parseCanonicalDecimal,
} from "../schema/index.ts";
import { moneyAdd, moneyCompare } from "../money/index.ts";
import type {
  Expense,
  ReceiptAdjustment,
  ReceiptLine,
  ReceiptParent,
  ReceiptPurchaseLine,
} from "../schema/index.ts";
import { boundsForPeriod, calendarDateInBounds } from "./calendar.ts";
import type {
  CategoryBreakdownEntry,
  CurrencyTotals,
  ExpenseListItem,
  ExpenseQueryFilter,
  ExpenseQueryResult,
  ExpenseQuerySource,
  ReceiptGroup,
} from "./types.ts";

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function receiptMap(source: ExpenseQuerySource): Map<string, ReceiptParent> {
  return new Map(source.receipts.map((receipt) => [receipt.id, receipt]));
}

function lineMap(source: ExpenseQuerySource): Map<string, ReceiptLine> {
  return new Map<string, ReceiptLine>([
    ...source.receiptPurchaseLines.map((line) => [line.id, line] as const),
    ...source.receiptAdjustments.map((line) => [line.id, line] as const),
  ]);
}

function itemFromExpense(
  expense: Expense,
  receipts: ReadonlyMap<string, ReceiptParent>,
  lines: ReadonlyMap<string, ReceiptLine>,
): ExpenseListItem {
  const receipt = expense.receiptId
    ? receipts.get(expense.receiptId)
    : undefined;
  const receiptLine = expense.receiptLineId
    ? lines.get(expense.receiptLineId)
    : undefined;
  return {
    id: expense.id,
    projectId: expense.projectId,
    categoryId: expense.categoryId,
    date: expense.date,
    // A parent is the only source of receipt time. It wins if a legacy
    // derived expense also contains a copied time field.
    time: receipt?.time ?? expense.time,
    amount: expense.amount,
    currency: expense.currency,
    merchant: expense.merchant ?? receipt?.merchant,
    description: expense.description,
    source: expense.source,
    receiptId: expense.receiptId,
    receiptLineId: expense.receiptLineId,
    receipt,
    receiptLine,
    record: expense,
  };
}

function itemFromReceiptLine(
  line: ReceiptPurchaseLine | ReceiptAdjustment,
  receipt: ReceiptParent,
): ExpenseListItem {
  const isPurchase = line.type === "receipt-purchase-line";
  const amount = "lineTotal" in line ? line.lineTotal : line.amount;
  return {
    id: line.id,
    projectId: line.projectId,
    categoryId: line.categoryId,
    date: receipt.date,
    time: receipt.time,
    amount,
    currency: receipt.currency,
    merchant: receipt.merchant,
    description: line.description,
    source: isPurchase ? "receipt-line" : "adjustment",
    receiptId: receipt.id,
    receiptLineId: line.id,
    receipt,
    receiptLine: line,
    record: line,
  };
}

/**
 * Expands receipt lines and suppresses any redundant derived expense entry
 * which points at that same line. Manual expenses remain ordinary entries.
 */
export function expandExpenseRecords(
  source: ExpenseQuerySource,
): readonly ExpenseListItem[] {
  const receipts = receiptMap(source);
  const lines = lineMap(source);
  const expanded: ExpenseListItem[] = [];
  const purchaseLinesByReceipt = new Map<string, ReceiptPurchaseLine[]>();
  const adjustmentLinesByReceipt = new Map<string, ReceiptAdjustment[]>();
  for (const line of source.receiptPurchaseLines) {
    const linesForReceipt = purchaseLinesByReceipt.get(line.receiptId) ?? [];
    linesForReceipt.push(line);
    purchaseLinesByReceipt.set(line.receiptId, linesForReceipt);
  }
  for (const line of source.receiptAdjustments) {
    const linesForReceipt = adjustmentLinesByReceipt.get(line.receiptId) ?? [];
    linesForReceipt.push(line);
    adjustmentLinesByReceipt.set(line.receiptId, linesForReceipt);
  }

  for (const expense of source.expenses) {
    if (expense.receiptLineId && lines.has(expense.receiptLineId)) {
      continue;
    }
    expanded.push(itemFromExpense(expense, receipts, lines));
  }

  for (const receipt of source.receipts) {
    for (const line of purchaseLinesByReceipt.get(receipt.id) ?? []) {
      expanded.push(itemFromReceiptLine(line, receipt));
    }
    for (const line of adjustmentLinesByReceipt.get(receipt.id) ?? []) {
      expanded.push(itemFromReceiptLine(line, receipt));
    }
  }
  return expanded;
}

function matchesSearch(item: ExpenseListItem, search: string): boolean {
  const normalized = search.trim().toLocaleLowerCase("en-US");
  if (!normalized) return true;
  return [item.merchant, item.description]
    .filter((value): value is string => value !== undefined)
    .some((value) => value.toLocaleLowerCase("en-US").includes(normalized));
}

function matchesFilter(
  item: ExpenseListItem,
  filter: ExpenseQueryFilter,
  periodBounds: ReturnType<typeof boundsForPeriod> | undefined,
): boolean {
  if (item.projectId !== filter.selectedProjectId) return false;
  if (
    filter.categoryId !== undefined && item.categoryId !== filter.categoryId
  ) {
    return false;
  }
  if (filter.currency !== undefined && item.currency !== filter.currency) {
    return false;
  }
  if (filter.search !== undefined && !matchesSearch(item, filter.search)) {
    return false;
  }
  if (periodBounds && !calendarDateInBounds(item.date, periodBounds)) {
    return false;
  }

  const range = filter.amountRange;
  if (range?.min !== undefined && moneyCompare(item.amount, range.min) < 0) {
    return false;
  }
  if (range?.max !== undefined && moneyCompare(item.amount, range.max) > 0) {
    return false;
  }
  return true;
}

export type ExpenseTimelineEntry = {
  readonly date: string;
  readonly time?: string;
  readonly id: string;
};

/** Compare standalone records and receipt groups by one shared timeline rule. */
export function compareExpenseTimelineEntries(
  left: ExpenseTimelineEntry,
  right: ExpenseTimelineEntry,
  order: "newest" | "oldest",
): number {
  let difference = compareCodeUnits(left.date, right.date);
  if (difference === 0) {
    difference = compareCodeUnits(left.time ?? "", right.time ?? "");
  }
  if (difference !== 0 && order === "newest") difference = -difference;
  if (difference !== 0) return difference;
  // Keep equal temporal values deterministic in both directions. The stable
  // ID is not reversed when the owner switches newest/oldest.
  return compareCodeUnits(left.id, right.id);
}

function compareItems(
  left: ExpenseListItem,
  right: ExpenseListItem,
  order: "newest" | "oldest",
): number {
  return compareExpenseTimelineEntries(left, right, order);
}

function validateRange(filter: ExpenseQueryFilter): void {
  const range = filter.amountRange;
  if (!range) return;
  if (range.min !== undefined) parseCanonicalDecimal(range.min);
  if (range.max !== undefined) parseCanonicalDecimal(range.max);
  if (
    range.min !== undefined && range.max !== undefined &&
    moneyCompare(range.min, range.max) > 0
  ) {
    throw new Error("amount range minimum cannot exceed maximum");
  }
}

function categoryName(
  source: ExpenseQuerySource,
  categoryId: string,
): string {
  return source.categories.find((category) => category.id === categoryId)
    ?.name ?? categoryId;
}

function aggregateAmounts(
  items: readonly ExpenseListItem[],
): Map<string, { outflow: CanonicalDecimal; moneyBack: CanonicalDecimal }> {
  const values = new Map<
    string,
    { outflow: CanonicalDecimal; moneyBack: CanonicalDecimal }
  >();
  for (const item of items) {
    const previous = values.get(item.currency) ?? {
      outflow: "0" as CanonicalDecimal,
      moneyBack: "0" as CanonicalDecimal,
    };
    const comparison = moneyCompare(item.amount, "0");
    values.set(
      item.currency,
      comparison < 0
        ? { ...previous, outflow: moneyAdd(previous.outflow, item.amount) }
        : comparison > 0
        ? { ...previous, moneyBack: moneyAdd(previous.moneyBack, item.amount) }
        : previous,
    );
  }
  return values;
}

export function summarizeTotals(
  items: readonly ExpenseListItem[],
): readonly CurrencyTotals[] {
  return [...aggregateAmounts(items).entries()]
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .map(([currency, amounts]) => ({
      currency: currency as CurrencyTotals["currency"],
      ...amounts,
      net: moneyAdd(amounts.outflow, amounts.moneyBack),
    }));
}

export function summarizeCategoryBreakdown(
  source: ExpenseQuerySource,
  items: readonly ExpenseListItem[],
): readonly CategoryBreakdownEntry[] {
  const byCategory = new Map<string, ExpenseListItem[]>();
  for (const item of items) {
    const key = `${item.categoryId}\u0000${item.currency}`;
    const entries = byCategory.get(key) ?? [];
    entries.push(item);
    byCategory.set(key, entries);
  }
  const categoryOrder = new Map(
    source.categories.map((category) => [category.id, category.sortOrder]),
  );
  return [...byCategory.entries()]
    .map(([key, entries]) => {
      const separator = key.indexOf("\u0000");
      const categoryId = key.slice(0, separator);
      const currency = key.slice(separator + 1) as CurrencyTotals["currency"];
      const totals = summarizeTotals(entries)[0]!;
      return {
        categoryId,
        categoryName: categoryName(source, categoryId),
        currency,
        amount: totals.net,
        outflow: totals.outflow,
        moneyBack: totals.moneyBack,
        net: totals.net,
      };
    })
    .sort((left, right) =>
      (categoryOrder.get(left.categoryId) ?? Number.MAX_SAFE_INTEGER) -
        (categoryOrder.get(right.categoryId) ?? Number.MAX_SAFE_INTEGER) ||
      compareCodeUnits(left.categoryId, right.categoryId) ||
      compareCodeUnits(left.currency, right.currency)
    );
}

export function groupExpensesByReceipt(
  items: readonly ExpenseListItem[],
): readonly ReceiptGroup[] {
  const groups = new Map<string, {
    receipt: ReceiptParent;
    lines: ExpenseListItem[];
    total: CanonicalDecimal;
  }>();
  for (const item of items) {
    if (!item.receiptId || !item.receipt) continue;
    const previous = groups.get(item.receiptId) ?? {
      receipt: item.receipt,
      lines: [],
      total: "0" as CanonicalDecimal,
    };
    previous.lines.push(item);
    previous.total = moneyAdd(previous.total, item.amount);
    groups.set(item.receiptId, previous);
  }
  return [...groups.entries()].map(([id, group]) => ({
    id,
    projectId: group.receipt.projectId,
    receipt: group.receipt,
    lines: group.lines,
    total: group.total,
  }));
}

/** The one shared selection path used by both the list and all summaries. */
export function queryExpenses(
  source: ExpenseQuerySource,
  filter: ExpenseQueryFilter,
): ExpenseQueryResult {
  validateRange(filter);
  const periodBounds = filter.period
    ? boundsForPeriod(filter.period, source.settings.expenseDayBoundary)
    : undefined;
  const sort = filter.sort ?? "newest";
  const selected = expandExpenseRecords(source)
    .filter((item) => matchesFilter(item, filter, periodBounds))
    .sort((left, right) => compareItems(left, right, sort));
  return {
    expenses: selected,
    receiptGroups: groupExpensesByReceipt(selected),
    totals: summarizeTotals(selected),
    categoryBreakdown: summarizeCategoryBreakdown(source, selected),
  };
}

export function selectExpenses(
  source: ExpenseQuerySource,
  filter: ExpenseQueryFilter,
): readonly ExpenseListItem[] {
  return queryExpenses(source, filter).expenses;
}

export function summarizeExpenses(
  source: ExpenseQuerySource,
  filter: ExpenseQueryFilter,
): Pick<ExpenseQueryResult, "totals" | "categoryBreakdown"> {
  const result = queryExpenses(source, filter);
  return { totals: result.totals, categoryBreakdown: result.categoryBreakdown };
}
