declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  canonicalDecimal,
  type Category,
  type Expense,
  moneyAdd,
  type ReceiptAdjustment,
  type ReceiptParent,
  type ReceiptPurchaseLine,
} from "../index.ts";
import {
  expenseDateForLocalNow,
  type ExpenseQuerySource,
  formatDecimal,
  formatMoney,
  formatStoredCalendarDate,
  queryExpenses,
  selectExpenses,
  summarizeExpenses,
} from "../queries/index.ts";

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const projectSweden = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-sweden",
  name: "Sweden",
  defaultCurrency: "SEK" as const,
  archived: false,
};
const projectOther = {
  ...projectSweden,
  id: "project-other",
  name: "Other",
  defaultCurrency: "USD" as const,
};
const categoryFood: Category = {
  schemaVersion: 1,
  type: "category",
  id: "category-food",
  name: "Food",
  sortOrder: 1,
  archived: false,
  system: false,
};
const categoryTravel: Category = {
  ...categoryFood,
  id: "category-travel",
  name: "Travel",
  sortOrder: 2,
};
const categoryUncategorized: Category = {
  ...categoryFood,
  id: "category-uncategorized",
  name: "Uncategorized",
  sortOrder: 0,
  system: true,
};

function expense(
  id: string,
  overrides: Partial<Expense> = {},
): Expense {
  return {
    schemaVersion: 1,
    type: "expense",
    id,
    projectId: projectSweden.id,
    categoryId: categoryFood.id,
    date: "2026-08-24",
    amount: "-10",
    currency: "SEK",
    description: "",
    source: "manual",
    ...overrides,
  };
}

function receipt(
  id: string,
  overrides: Partial<ReceiptParent> = {},
): ReceiptParent {
  return {
    schemaVersion: 1,
    type: "receipt",
    id,
    projectId: projectSweden.id,
    date: "2026-08-24",
    currency: "SEK",
    printedTotal: "-10",
    ...overrides,
  };
}

function purchaseLine(
  id: string,
  receiptId: string,
  overrides: Partial<ReceiptPurchaseLine> = {},
): ReceiptPurchaseLine {
  return {
    schemaVersion: 1,
    type: "receipt-purchase-line",
    id,
    receiptId,
    projectId: projectSweden.id,
    categoryId: categoryFood.id,
    description: "Coffee",
    lineTotal: "-10",
    ...overrides,
  };
}

function adjustment(
  id: string,
  receiptId: string,
  overrides: Partial<ReceiptAdjustment> = {},
): ReceiptAdjustment {
  return {
    schemaVersion: 1,
    type: "receipt-adjustment",
    id,
    receiptId,
    projectId: projectSweden.id,
    categoryId: categoryFood.id,
    description: "Bottle return",
    amount: "2",
    ...overrides,
  };
}

function source(
  overrides: Partial<ExpenseQuerySource> = {},
): ExpenseQuerySource {
  return {
    expenses: [],
    receipts: [],
    receiptPurchaseLines: [],
    receiptAdjustments: [],
    categories: [categoryUncategorized, categoryFood, categoryTravel],
    settings: { expenseDayBoundary: "03:00" },
    ...overrides,
  };
}

function filter(
  overrides: Partial<Parameters<typeof queryExpenses>[1]> = {},
) {
  return {
    selectedProjectId: projectSweden.id,
    ...overrides,
  };
}

Deno.test("query: local expense-day boundary resolves before and at 03:00", () => {
  const before = expenseDateForLocalNow(
    new Date(2026, 7, 24, 2, 59, 59),
    "03:00",
  );
  const atBoundary = expenseDateForLocalNow(
    new Date(2026, 7, 24, 3, 0, 0),
    "03:00",
  );
  assertEquals(before, "2026-08-23");
  assertEquals(atBoundary, "2026-08-24");

  const result = queryExpenses(
    source({ expenses: [expense("month", { date: "2026-07-31" })] }),
    filter({
      period: {
        kind: "current",
        unit: "month",
        now: new Date(2026, 7, 1, 2, 59),
      },
    }),
  );
  assertEquals(result.expenses.map(({ id }) => id), ["month"]);
});

Deno.test("query: custom periods use stored calendar dates without timezone reinterpretation", () => {
  const result = queryExpenses(
    source({
      expenses: [
        expense("day", { date: "2026-08-23" }),
        expense("month", { date: "2026-08-31" }),
        expense("other-month", { date: "2026-09-01" }),
      ],
    }),
    filter({ period: { kind: "month", year: 2026, month: 8 } }),
  );
  assertEquals(result.expenses.map(({ id }) => id), ["month", "day"]);
});

Deno.test("query: selected project, category, currency, search, and signed range combine", () => {
  const result = queryExpenses(
    source({
      expenses: [
        expense("match", {
          categoryId: categoryTravel.id,
          amount: "-12.50",
          currency: "EUR",
          merchant: "ICA Maxi Solna",
          description: "Coffee beans",
        }),
        expense("wrong-category", {
          amount: "-12.50",
          currency: "EUR",
          merchant: "ICA Maxi Solna",
        }),
        expense("wrong-currency", {
          categoryId: categoryTravel.id,
          amount: "-12.50",
          currency: "SEK",
          merchant: "ICA Maxi Solna",
        }),
        expense("wrong-project", {
          projectId: projectOther.id,
          categoryId: categoryTravel.id,
          amount: "-12.50",
          currency: "EUR",
          merchant: "ICA Maxi Solna",
        }),
        expense("outside-range", {
          categoryId: categoryTravel.id,
          amount: "-20",
          currency: "EUR",
          merchant: "ICA Maxi Solna",
        }),
      ],
    }),
    filter({
      categoryId: categoryTravel.id,
      currency: "EUR",
      search: "  COFFEE  ",
      amountRange: { min: "-15", max: "-10" },
    }),
  );
  assertEquals(result.expenses.map(({ id }) => id), ["match"]);
  assertEquals(result.totals, [{
    currency: "EUR",
    outflow: "-12.5",
    moneyBack: "0",
    net: "-12.5",
  }]);
});

Deno.test("query: ordering uses inherited receipt time and stable IDs", () => {
  const result = queryExpenses(
    source({
      expenses: [
        expense("b", { time: "10:00" }),
        expense("a", { time: "10:00" }),
        expense("older", { time: "09:00" }),
      ],
      receipts: [receipt("receipt-time", { time: "11:30" })],
      receiptPurchaseLines: [
        purchaseLine("line-time", "receipt-time", { lineTotal: "-1" }),
      ],
    }),
    filter(),
  );
  assertEquals(result.expenses.map(({ id }) => id), [
    "line-time",
    "a",
    "b",
    "older",
  ]);
  const oldest = selectExpenses(
    source({
      expenses: [
        expense("b", { time: "10:00" }),
        expense("a", { time: "10:00" }),
      ],
    }),
    filter({ sort: "oldest" }),
  );
  assertEquals(oldest.map(({ id }) => id), ["a", "b"]);
});

Deno.test("query: receipt lines expand once, inherit parent fields, and group filtered lines", () => {
  const parent = receipt("receipt-1", {
    merchant: "ICA Maxi Solna",
    time: "21:05",
    printedTotal: "-8",
  });
  const purchase = purchaseLine("line-purchase", parent.id, {
    lineTotal: "-10",
    description: "Milk",
  });
  const refund = adjustment("line-refund", parent.id, {
    amount: "2",
    description: "Bottle return",
  });
  const mirrored = expense("derived-index", {
    source: "receipt-line",
    receiptId: parent.id,
    receiptLineId: purchase.id,
    amount: "-10",
    description: "Milk",
  });
  const result = queryExpenses(
    source({
      expenses: [mirrored],
      receipts: [parent],
      receiptPurchaseLines: [purchase],
      receiptAdjustments: [refund],
    }),
    filter({ search: "ica maxi" }),
  );
  assertEquals(result.expenses.map(({ id }) => id), [
    "line-purchase",
    "line-refund",
  ]);
  assertEquals(result.expenses[0]?.merchant, "ICA Maxi Solna");
  assertEquals(result.expenses[0]?.time, "21:05");
  assertEquals(result.receiptGroups.length, 1);
  assertEquals(result.receiptGroups[0]?.total, "-8");
  assertEquals(result.receiptGroups[0]?.lines.length, 2);
});

Deno.test("query: totals stay separate by currency and preserve signed semantics", () => {
  const result = queryExpenses(
    source({
      expenses: [
        expense("sek-out", { amount: "-100" }),
        expense("sek-back", { amount: "25" }),
        expense("eur-out", { amount: "-12.5", currency: "EUR" }),
        expense("eur-back", { amount: "2.5", currency: "EUR" }),
        expense("zero", { amount: "0" }),
      ],
    }),
    filter(),
  );
  assertEquals(result.totals, [
    { currency: "EUR", outflow: "-12.5", moneyBack: "2.5", net: "-10" },
    { currency: "SEK", outflow: "-100", moneyBack: "25", net: "-75" },
  ]);
  for (const totals of result.totals) {
    assertEquals(moneyAdd(totals.outflow, totals.moneyBack), totals.net);
    assert(totals.outflow.startsWith("-") || totals.outflow === "0");
    assert(!totals.moneyBack.startsWith("-"));
  }
});

Deno.test("query: property-style totals preserve outflow plus money-back invariant", () => {
  const amounts = [
    "-999999999999999999.125",
    "-999.99",
    "-1",
    "0",
    "0.01",
    "2.5",
    "999999999999999999.75",
  ];
  const result = queryExpenses(
    source({
      expenses: amounts.map((amount, index) =>
        expense(`property-${String(index).padStart(2, "0")}`, { amount })
      ),
    }),
    filter(),
  );
  const totals = result.totals[0];
  assert(totals !== undefined, "the generated SEK values must have a total");
  const expectedOutflow = amounts.filter((amount) => amount.startsWith("-"))
    .reduce((total, amount) => moneyAdd(total, amount), "0");
  const expectedMoneyBack = amounts.filter((amount) =>
    !amount.startsWith("-") && amount !== "0"
  ).reduce((total, amount) => moneyAdd(total, amount), "0");
  assertEquals(totals.outflow, expectedOutflow);
  assertEquals(totals.moneyBack, expectedMoneyBack);
  assertEquals(totals.net, moneyAdd(expectedOutflow, expectedMoneyBack));
});

Deno.test("query: category breakdown uses the same filtered items as totals", () => {
  const result = queryExpenses(
    source({
      expenses: [
        expense("food-out", { amount: "-4" }),
        expense("food-back", { amount: "1" }),
        expense("travel", { categoryId: categoryTravel.id, amount: "-10" }),
      ],
    }),
    filter({ categoryId: categoryFood.id }),
  );
  const summary = summarizeExpenses(
    source({
      expenses: [
        expense("food-out", { amount: "-4" }),
        expense("food-back", { amount: "1" }),
        expense("travel", { categoryId: categoryTravel.id, amount: "-10" }),
      ],
    }),
    filter({ categoryId: categoryFood.id }),
  );
  assertEquals(summary, {
    totals: result.totals,
    categoryBreakdown: result.categoryBreakdown,
  });
  assertEquals(result.categoryBreakdown, [{
    categoryId: categoryFood.id,
    categoryName: "Food",
    currency: "SEK",
    amount: "-3",
    outflow: "-4",
    moneyBack: "1",
    net: "-3",
  }]);
});

Deno.test("query: empty and large decimals remain exact, including formatting", () => {
  const empty = queryExpenses(source(), filter());
  assertEquals(empty.expenses, []);
  assertEquals(empty.totals, []);
  assertEquals(empty.categoryBreakdown, []);
  const large = canonicalDecimal("-999999999999999999999.123400");
  const result = queryExpenses(
    source({ expenses: [expense("large", { amount: large })] }),
    filter(),
  );
  assertEquals(result.totals[0]?.net, "-999999999999999999999.1234");
  assertEquals(
    formatDecimal(large),
    "-999,999,999,999,999,999,999.1234",
  );
  assertEquals(
    formatMoney(large, "SEK"),
    "SEK -999,999,999,999,999,999,999.1234",
  );
  assertEquals(formatStoredCalendarDate("2026-08-24"), "Aug 24, 2026");
});

Deno.test("query: signed range is inclusive and rejects an inverted range", () => {
  const result = queryExpenses(
    source({
      expenses: [
        expense("min", { amount: "-10" }),
        expense("middle", { amount: "-5" }),
        expense("max", { amount: "2" }),
      ],
    }),
    filter({ amountRange: { min: "-10", max: "2" } }),
  );
  assertEquals(result.expenses.map(({ id }) => id), ["max", "middle", "min"]);
  let failed = false;
  try {
    queryExpenses(source(), filter({ amountRange: { min: "2", max: "-2" } }));
  } catch {
    failed = true;
  }
  assert(failed, "inverted signed ranges must be rejected");
});
