import {
  addReceiptLine,
  editReceiptLine,
  normalizeReceiptExtractionDraft,
  receiptMismatchDifference,
  type ReceiptReviewDraft,
  receiptSelectedTotal,
  removeReceiptLine,
  setReceiptLineSelected,
  validateReceiptReviewDraft,
} from "../receipt.ts";
import { UNCATEGORIZED_CATEGORY_ID } from "../schema/index.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

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

function rejects(operation: () => unknown): void {
  let rejected = false;
  try {
    operation();
  } catch {
    rejected = true;
  }
  assert(rejected, "Expected operation to reject");
}

function review(
  overrides: Partial<ReceiptReviewDraft> = {},
): ReceiptReviewDraft {
  return {
    parent: {
      projectId: "project-receipt-domain",
      date: "2026-08-24",
      merchant: "Shop",
      currency: "SEK",
      printedTotal: "-8",
    },
    lines: [{
      type: "purchase",
      id: "line-purchase",
      description: "Coffee",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      lineTotal: "-10",
      selected: true,
      uncertain: false,
    }, {
      type: "adjustment",
      id: "line-discount",
      description: "Discount",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      amount: "2",
      lineId: "line-purchase",
      selected: true,
      uncertain: false,
    }],
    uncertainty: [],
    printedTotalMismatch: false,
    ...overrides,
  };
}

Deno.test("receipt-actor domain: signs, totals, selection, editing, adding, and removing are deterministic", () => {
  const normalized = validateReceiptReviewDraft(review({
    lines: [{
      type: "purchase",
      id: "line-purchase",
      description: "Coffee",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      lineTotal: "10",
      selected: true,
      uncertain: false,
    }],
  }));
  assertEquals(normalized.lines[0]?.type, "purchase");
  if (normalized.lines[0]?.type !== "purchase") {
    throw new Error("Expected purchase");
  }
  assertEquals(normalized.lines[0].lineTotal, "-10");
  assertEquals(receiptSelectedTotal(normalized), "-10");
  assertEquals(receiptMismatchDifference(normalized), "-2");

  const unselected = setReceiptLineSelected(normalized, "line-purchase", false);
  assertEquals(receiptSelectedTotal(unselected), "0");
  const added = addReceiptLine(unselected, {
    type: "adjustment",
    id: "line-refund",
    description: "Refund",
    categoryId: UNCATEGORIZED_CATEGORY_ID,
    amount: "3",
    selected: true,
    uncertain: false,
  });
  const edited = editReceiptLine(added, {
    ...added.lines[1]!,
    description: "Refunded bottle",
  });
  assertEquals(edited.lines[1]?.description, "Refunded bottle");
  assertEquals(removeReceiptLine(edited, "line-refund").lines.length, 1);
});

Deno.test("receipt-actor domain: receipt totals use the outflow sign", () => {
  const normalized = normalizeReceiptExtractionDraft({
    merchant: "Shop",
    currency: "SEK",
    date: "2026-08-24",
    printedTotal: "8",
    uncertainty: [],
    mismatches: [],
    lines: [{
      description: "Coffee",
      amount: "8",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "purchase",
      selected: true,
    }],
  }, {
    projectId: "project-receipt-domain",
    currency: "SEK",
    categoryCatalogue: [{
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
    }],
    nextId: () => "line-positive-total",
  });
  assertEquals(normalized.parent.printedTotal, "-8");
  assertEquals(receiptSelectedTotal(normalized), "-8");
  assertEquals(receiptMismatchDifference(normalized), "0");

  const edited = validateReceiptReviewDraft(review({
    parent: { ...review().parent, printedTotal: "8" },
  }));
  assertEquals(edited.parent.printedTotal, "-8");
  assertEquals(receiptMismatchDifference(edited), "0");
});

Deno.test("receipt-actor domain: hostile extraction remains reviewable but invalid lines start unselected", () => {
  let sequence = 0;
  const normalized = normalizeReceiptExtractionDraft({
    merchant: "Shop",
    currency: "SEK",
    date: "2026-08-24",
    printedTotal: "-3",
    uncertainty: [],
    mismatches: [],
    lines: [{
      description: "",
      amount: "not-a-decimal",
      categoryId: "hostile-category",
      kind: "purchase",
      selected: true,
    }],
  }, {
    projectId: "project-receipt-domain",
    currency: "SEK",
    categoryCatalogue: [{
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
    }],
    nextId: () => `line-hostile-${++sequence}`,
  });
  assertEquals(normalized.lines[0]?.selected, false);
  assertEquals(normalized.lines[0]?.uncertain, true);
  assert(normalized.lines[0]?.selectionReason !== undefined);
  assertEquals(normalized.lines[0]?.categoryId, UNCATEGORIZED_CATEGORY_ID);
  rejects(() =>
    validateReceiptReviewDraft(review({
      lines: [{
        type: "adjustment",
        id: "line-adjustment",
        description: "Discount",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        amount: "1",
        lineId: "missing-purchase",
        selected: true,
        uncertain: false,
      }],
    }))
  );
  rejects(() =>
    validateReceiptReviewDraft(review({
      lines: [{
        type: "purchase",
        id: "line-empty",
        description: "",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        lineTotal: "-1",
        selected: true,
        uncertain: false,
      }],
    }))
  );
});
