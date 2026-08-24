import type {
  CalendarDate,
  CanonicalDecimal,
  Category,
  CurrencyCode,
  Expense,
  ReceiptAdjustment,
  ReceiptLine,
  ReceiptParent,
  ReceiptPurchaseLine,
  StableId,
  TimeOfDay,
} from "../schema/index.ts";

/** The portable records needed to derive the expense view. */
export type ExpenseQuerySource = {
  readonly expenses: readonly Expense[];
  readonly receipts: readonly ReceiptParent[];
  readonly receiptPurchaseLines: readonly ReceiptPurchaseLine[];
  readonly receiptAdjustments: readonly ReceiptAdjustment[];
  readonly categories: readonly Category[];
  readonly settings: { readonly expenseDayBoundary: string };
};

export type CalendarPeriodUnit = "day" | "month" | "year";

/**
 * A custom period uses the stored calendar date directly. A current period
 * derives its calendar date from the device-local wall clock and the
 * portable expense-day boundary.
 */
export type ExpensePeriod =
  | {
    readonly kind: "current";
    readonly unit: CalendarPeriodUnit;
    readonly now: Date;
  }
  | { readonly kind: "day"; readonly date: CalendarDate }
  | { readonly kind: "month"; readonly year: number; readonly month: number }
  | { readonly kind: "year"; readonly year: number };

export type ExpenseSortOrder = "newest" | "oldest";

export type SignedAmountRange = {
  readonly min?: CanonicalDecimal;
  readonly max?: CanonicalDecimal;
};

/** One filter object is shared by list, receipt groups, and summaries. */
export type ExpenseQueryFilter = {
  readonly selectedProjectId: StableId;
  readonly period?: ExpensePeriod;
  readonly categoryId?: StableId;
  readonly currency?: CurrencyCode;
  /** Case-insensitive substring search over merchant and description. */
  readonly search?: string;
  /** Inclusive range over the signed persisted amount. */
  readonly amountRange?: SignedAmountRange;
  readonly sort?: ExpenseSortOrder;
};

/** A normalized list item, including receipt lines not duplicated as expenses. */
export type ExpenseListItem = {
  readonly id: StableId;
  readonly projectId: StableId;
  readonly categoryId: StableId;
  readonly date: CalendarDate;
  readonly time?: TimeOfDay;
  readonly amount: CanonicalDecimal;
  readonly currency: CurrencyCode;
  readonly merchant?: string;
  readonly description: string;
  readonly source: "manual" | "receipt-line" | "adjustment";
  readonly receiptId?: StableId;
  readonly receiptLineId?: StableId;
  readonly receipt?: ReceiptParent;
  readonly receiptLine?: ReceiptLine;
  /** The original persisted record or expanded receipt line. */
  readonly record: Expense | ReceiptLine;
};

export type CurrencyTotals = {
  readonly currency: CurrencyCode;
  /** Negative signed sum of outflows. */
  readonly outflow: CanonicalDecimal;
  /** Positive signed sum of money returned to the owner. */
  readonly moneyBack: CanonicalDecimal;
  /** `outflow + moneyBack`, never a cross-currency conversion. */
  readonly net: CanonicalDecimal;
};

export type CategoryBreakdownEntry = CurrencyTotals & {
  readonly categoryId: StableId;
  readonly categoryName: string;
  /** Alias for `net`, convenient for the category-list presentation. */
  readonly amount: CanonicalDecimal;
};

export type ReceiptGroup = {
  readonly id: StableId;
  readonly projectId: StableId;
  readonly receipt: ReceiptParent;
  readonly lines: readonly ExpenseListItem[];
  /** Sum of the currently visible lines, not necessarily printedTotal. */
  readonly total: CanonicalDecimal;
};

export type ExpenseQueryResult = {
  readonly expenses: readonly ExpenseListItem[];
  readonly receiptGroups: readonly ReceiptGroup[];
  readonly totals: readonly CurrencyTotals[];
  readonly categoryBreakdown: readonly CategoryBreakdownEntry[];
};
