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

Deno.test("receipt-actor domain: receipt totals follow selected line direction", () => {
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
      direction: "outflow",
      selected: true,
      rationale: "Coffee is a purchased product line.",
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

  const adjustmentOnly = validateReceiptReviewDraft(review({
    parent: { ...review().parent, printedTotal: "5" },
    lines: [{
      type: "adjustment",
      id: "line-refund-only",
      description: "Refund",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      amount: "5",
      selected: true,
      uncertain: false,
    }],
  }));
  assertEquals(adjustmentOnly.parent.printedTotal, "5");
  assertEquals(receiptSelectedTotal(adjustmentOnly), "5");
  assertEquals(receiptMismatchDifference(adjustmentOnly), "0");

  const rawPositivePurchase = review({
    parent: { ...review().parent, printedTotal: "8" },
    lines: [{
      type: "purchase",
      id: "line-raw-positive",
      description: "Coffee",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      lineTotal: "8",
      selected: true,
      uncertain: false,
    }],
  });
  assertEquals(receiptSelectedTotal(rawPositivePurchase), "-8");
  assertEquals(receiptMismatchDifference(rawPositivePurchase), "0");
});

Deno.test("receipt-actor domain: raw printed signs normalize by direction", () => {
  let sequence = 0;
  const normalized = normalizeReceiptExtractionDraft({
    merchant: "Coop",
    currency: "SEK",
    date: "2026-08-29",
    printedTotal: "325.78",
    uncertainty: [],
    mismatches: [],
    lines: [{
      description: "Receipt purchases",
      amount: "341.54",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "purchase",
      direction: "outflow",
      selected: true,
      rationale: "Product rows make up the printed pre-discount amount.",
    }, {
      description: "Discount",
      amount: "-15.76",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "adjustment",
      direction: "inflow",
      selected: true,
      rationale:
        "The discount section shows a credit reducing the amount owed.",
    }],
  }, {
    projectId: "project-receipt-domain",
    currency: "SEK",
    categoryCatalogue: [{
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
    }],
    nextId: () => `line-raw-sign-${++sequence}`,
  });
  assertEquals(normalized.parent.printedTotal, "-325.78");
  assertEquals(normalized.lines[0]?.type, "purchase");
  assertEquals(
    normalized.lines[0]?.type === "purchase"
      ? normalized.lines[0].lineTotal
      : undefined,
    "-341.54",
  );
  assertEquals(normalized.lines[1]?.type, "adjustment");
  assertEquals(
    normalized.lines[1]?.type === "adjustment"
      ? normalized.lines[1].amount
      : undefined,
    "15.76",
  );
  assertEquals(
    normalized.lines[1]?.classificationReason,
    "The discount section shows a credit reducing the amount owed.",
  );
  assertEquals(receiptSelectedTotal(normalized), "-325.78");
  assertEquals(receiptMismatchDifference(normalized), "0");
});

Deno.test(
  "receipt-actor domain: positive bottle-deposit charges are outflows while returns remain inflows",
  () => {
    let sequence = 0;
    const normalized = normalizeReceiptExtractionDraft({
      merchant: "Coop",
      currency: "SEK",
      date: "2026-08-29",
      printedTotal: "2",
      uncertainty: [],
      mismatches: [],
      lines: [{
        description: "PANT BURK",
        amount: "2",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        kind: "adjustment",
        direction: "inflow",
        selected: true,
        rationale: "The model incorrectly called this deposit a return.",
      }, {
        description: "PANT BURK RETUR",
        amount: "2",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        kind: "adjustment",
        direction: "inflow",
        selected: true,
        rationale: "The receipt explicitly marks this deposit as a return.",
      }, {
        description: "PANT BURK",
        amount: "-2",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        kind: "adjustment",
        direction: "inflow",
        selected: true,
        rationale: "The printed negative amount is a deposit credit.",
      }],
    }, {
      projectId: "project-receipt-domain",
      currency: "SEK",
      categoryCatalogue: [{
        id: UNCATEGORIZED_CATEGORY_ID,
        name: "Uncategorized",
      }],
      nextId: () => `line-bottle-deposit-${++sequence}`,
    });
    assertEquals(normalized.lines[0]?.type, "adjustment");
    assertEquals(
      normalized.lines[0]?.type === "adjustment"
        ? normalized.lines[0].amount
        : undefined,
      "-2",
    );
    assertEquals(
      normalized.lines[0]?.classificationReason,
      "The PANT BURK line is a bottle-deposit charge listed with the purchased goods, so it increases the amount owed.",
    );
    assertEquals(
      normalized.lines[1]?.type === "adjustment"
        ? normalized.lines[1].amount
        : undefined,
      "2",
    );
    assertEquals(
      normalized.lines[1]?.classificationReason,
      "The receipt explicitly marks this deposit as a return.",
    );
    assertEquals(
      normalized.lines[2]?.type === "adjustment"
        ? normalized.lines[2].amount
        : undefined,
      "2",
    );
    assertEquals(receiptSelectedTotal(normalized), "2");
    assertEquals(receiptMismatchDifference(normalized), "0");
  },
);

Deno.test(
  "receipt-actor domain: Coop bottle deposits reconcile the printed total",
  () => {
    let sequence = 0;
    const purchase = (description: string, amount: string) => ({
      description,
      amount,
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "purchase" as const,
      direction: "outflow" as const,
      selected: true,
      rationale: "The receipt lists this purchased product line.",
    });
    const deposit = () => ({
      description: "PANT BURK",
      amount: "2",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "adjustment" as const,
      direction: "inflow" as const,
      selected: true,
      rationale: "The model incorrectly called this deposit a return.",
    });
    const normalized = normalizeReceiptExtractionDraft({
      merchant: "Stora Coop Backaplan",
      currency: "SEK",
      date: "2026-08-29",
      printedTotal: "325.78",
      uncertainty: [],
      mismatches: [],
      lines: [
        purchase("BLÄCKFISKRING PAN", "33.08"),
        purchase("BROCCOLI", "33.98"),
        purchase("DOMINO ORIGINAL", "23.19"),
        purchase("DOMINO PINK KEX", "21.72"),
        purchase("PANERADE RÄKOR MSC", "141.86"),
        purchase("SARDINER PANERADE", "45.95"),
        purchase("STRANDEN", "18.88"),
        purchase("VINDEN", "18.88"),
        deposit(),
        deposit(),
        {
          description: "RABATTER LATITUDE 2 för 22kr",
          amount: "-15.76",
          categoryId: UNCATEGORIZED_CATEGORY_ID,
          kind: "adjustment" as const,
          direction: "inflow" as const,
          selected: true,
          rationale:
            "The discount section shows a credit reducing the amount owed.",
        },
      ],
    }, {
      projectId: "project-receipt-domain",
      currency: "SEK",
      categoryCatalogue: [{
        id: UNCATEGORIZED_CATEGORY_ID,
        name: "Uncategorized",
      }],
      nextId: () => `line-coop-receipt-${++sequence}`,
    });
    assertEquals(normalized.parent.printedTotal, "-325.78");
    assertEquals(
      normalized.lines[8]?.type === "adjustment"
        ? normalized.lines[8].amount
        : undefined,
      "-2",
    );
    assertEquals(
      normalized.lines[9]?.type === "adjustment"
        ? normalized.lines[9].amount
        : undefined,
      "-2",
    );
    assertEquals(receiptSelectedTotal(normalized), "-325.78");
    assertEquals(receiptMismatchDifference(normalized), "0");
  },
);

Deno.test("receipt-actor domain: contradictory purchase direction fails closed", () => {
  const normalized = normalizeReceiptExtractionDraft({
    merchant: "Shop",
    currency: "SEK",
    date: "2026-08-29",
    printedTotal: "4",
    uncertainty: [],
    mismatches: [],
    lines: [{
      description: "Coffee",
      amount: "4",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "purchase",
      direction: "inflow",
      selected: true,
      rationale: "The model classified this visible row as a purchase.",
    }],
  }, {
    projectId: "project-receipt-domain",
    currency: "SEK",
    categoryCatalogue: [{
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
    }],
    nextId: () => "line-contradictory-direction",
  });
  assertEquals(normalized.lines[0]?.selected, false);
  assertEquals(normalized.lines[0]?.uncertain, true);
  assertEquals(
    normalized.lines[0]?.type === "purchase"
      ? normalized.lines[0].lineTotal
      : undefined,
    "-4",
  );
});

Deno.test("receipt-actor domain: missing classification rationale fails closed", () => {
  const normalized = normalizeReceiptExtractionDraft({
    merchant: "Shop",
    currency: "SEK",
    date: "2026-08-29",
    printedTotal: "4",
    uncertainty: [],
    mismatches: [],
    lines: [{
      description: "Coffee",
      amount: "4",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "purchase",
      direction: "outflow",
      selected: true,
    }],
  }, {
    projectId: "project-receipt-domain",
    currency: "SEK",
    categoryCatalogue: [{
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
    }],
    nextId: () => "line-missing-rationale",
  });
  assertEquals(normalized.lines[0]?.selected, false);
  assertEquals(normalized.lines[0]?.uncertain, true);
  assertEquals(normalized.lines[0]?.classificationReason, undefined);
});

Deno.test("receipt-actor domain: printed charges become negative adjustments", () => {
  const normalized = normalizeReceiptExtractionDraft({
    merchant: "Shop",
    currency: "SEK",
    date: "2026-08-29",
    printedTotal: "2.5",
    uncertainty: [],
    mismatches: [],
    lines: [{
      description: "Service fee",
      amount: "2.5",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      kind: "adjustment",
      direction: "outflow",
      selected: true,
      rationale: "The fee line is an extra charge added to the receipt.",
    }],
  }, {
    projectId: "project-receipt-domain",
    currency: "SEK",
    categoryCatalogue: [{
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
    }],
    nextId: () => "line-printed-charge",
  });
  assertEquals(normalized.parent.printedTotal, "-2.5");
  assertEquals(
    normalized.lines[0]?.type === "adjustment"
      ? normalized.lines[0].amount
      : undefined,
    "-2.5",
  );
  assertEquals(receiptSelectedTotal(normalized), "-2.5");
  assertEquals(receiptMismatchDifference(normalized), "0");
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
      direction: "outflow",
      selected: true,
      rationale: "The product row is unreadable.",
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
