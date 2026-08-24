declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  canonicalDecimal,
  canonicalizeDataset,
  CategorySchema,
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
  exportDataset,
  importDataset,
  moneyAdd,
  moneyCompare,
  moneyMultiply,
  PortableDatasetSchema,
  ProjectSchema,
  ReceiptAdjustmentSchema,
  ReceiptParentSchema,
  ReceiptPurchaseLineSchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "../index.ts";
import { migrateDown } from "../migrations/index.ts";

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

const category = {
  schemaVersion: 1 as const,
  type: "category" as const,
  id: UNCATEGORIZED_CATEGORY_ID,
  name: "Uncategorized",
  sortOrder: 0,
  archived: false,
  system: true,
};
const project = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-sweden",
  name: "Sweden",
  defaultCurrency: "SEK",
  archived: false,
};

function datasetWith(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    format: DATASET_FORMAT,
    projects: [project],
    categories: [category],
    expenses: [],
    receipts: [],
    receiptPurchaseLines: [],
    receiptAdjustments: [],
    devices: [],
    tombstones: [],
    retirementMarkers: [],
    revisions: [],
    settings: {
      schemaVersion: 1 as const,
      type: "portable-settings" as const,
      id: "settings-portable",
      expenseDayBoundary: "03:00",
    },
    ...overrides,
  };
}

Deno.test("domain: canonical decimals normalize and reject unsafe representations", () => {
  assertEquals(canonicalDecimal("00010.9000"), "10.9");
  assertEquals(canonicalDecimal("-0.000"), "0");
  assertEquals(moneyAdd("0.1", "0.2"), "0.3");
  assertEquals(moneyMultiply("1.25", "8"), "10");
  assertEquals(moneyCompare("-1", "0"), -1);
  for (const invalid of ["1e3", "+1", " 1", "1 ", "NaN", ""]) {
    let rejected = false;
    try {
      canonicalDecimal(invalid);
    } catch {
      rejected = true;
    }
    assert(rejected, `${invalid} must be rejected`);
  }
});

Deno.test("domain: record schemas preserve stable relationships and receipt semantics", () => {
  const renamed = ProjectSchema.parse({ ...project, name: "Former Sweden" });
  assertEquals(renamed.id, project.id);
  assertEquals(CategorySchema.parse(category).id, UNCATEGORIZED_CATEGORY_ID);
  const parent = ReceiptParentSchema.parse({
    schemaVersion: 1,
    type: "receipt",
    id: "receipt-1",
    projectId: project.id,
    date: "2026-08-24",
    currency: "SEK",
    printedTotal: "-10.90",
  });
  assertEquals(parent.printedTotal, "-10.9");
  const line = ReceiptPurchaseLineSchema.parse({
    schemaVersion: 1,
    type: "receipt-purchase-line",
    id: "line-1",
    receiptId: parent.id,
    projectId: parent.projectId,
    categoryId: category.id,
    description: "Coffee",
    quantity: "01.00",
    unitPrice: "-10.90",
    lineTotal: "-10.90",
  });
  assertEquals(line.quantity, "1");
  assertEquals(line.lineTotal, "-10.9");
  const adjustment = ReceiptAdjustmentSchema.parse({
    schemaVersion: 1,
    type: "receipt-adjustment",
    id: "adjustment-1",
    receiptId: parent.id,
    projectId: parent.projectId,
    categoryId: category.id,
    description: "Refund",
    amount: "1.00",
    lineId: line.id,
  });
  assertEquals(adjustment.amount, "1");
});

Deno.test("domain: dataset rejects invalid references and category invariants", () => {
  let result = PortableDatasetSchema.safeParse(datasetWith({
    expenses: [{
      schemaVersion: 1,
      type: "expense",
      id: "expense-1",
      projectId: "missing-project",
      categoryId: category.id,
      date: "2026-08-24",
      amount: "-1",
      currency: "SEK",
      description: "",
      source: "manual",
    }],
  }));
  assert(!result.success, "unknown project must be rejected");
  if (!result.success) {
    assert(
      result.error.issues.some((issue) =>
        issue.path.join(".") === "expenses.0.projectId"
      ),
    );
  }

  result = PortableDatasetSchema.safeParse(datasetWith({
    categories: [
      category,
      {
        ...category,
        id: "category-food",
        name: " food ",
        system: false,
        sortOrder: 1,
      },
      {
        ...category,
        id: "category-food-2",
        name: "FOOD",
        system: false,
        sortOrder: 2,
      },
    ],
  }));
  assert(
    !result.success,
    "active category names must be case-insensitively unique",
  );
});

Deno.test("domain: expense receipt-line references validate both line variants", () => {
  const receipt = {
    schemaVersion: 1 as const,
    type: "receipt" as const,
    id: "receipt-1",
    projectId: project.id,
    date: "2026-08-24",
    currency: "SEK",
    printedTotal: "-9",
  };
  const purchaseLine = {
    schemaVersion: 1 as const,
    type: "receipt-purchase-line" as const,
    id: "line-purchase",
    receiptId: receipt.id,
    projectId: project.id,
    categoryId: category.id,
    description: "Item",
    lineTotal: "-5",
  };
  const adjustmentLine = {
    schemaVersion: 1 as const,
    type: "receipt-adjustment" as const,
    id: "line-adjustment",
    receiptId: receipt.id,
    projectId: project.id,
    categoryId: category.id,
    description: "Refund",
    amount: "1",
  };
  const result = PortableDatasetSchema.safeParse(datasetWith({
    receipts: [receipt],
    receiptPurchaseLines: [purchaseLine],
    receiptAdjustments: [adjustmentLine],
    expenses: [
      {
        schemaVersion: 1,
        type: "expense",
        id: "expense-purchase",
        projectId: project.id,
        categoryId: category.id,
        date: receipt.date,
        amount: purchaseLine.lineTotal,
        currency: receipt.currency,
        description: "Item",
        source: "receipt-line",
        receiptId: receipt.id,
        receiptLineId: purchaseLine.id,
      },
      {
        schemaVersion: 1,
        type: "expense",
        id: "expense-adjustment",
        projectId: project.id,
        categoryId: category.id,
        date: receipt.date,
        amount: adjustmentLine.amount,
        currency: receipt.currency,
        description: "Refund",
        source: "adjustment",
        receiptId: receipt.id,
        receiptLineId: adjustmentLine.id,
      },
    ],
  }));
  assert(result.success, "purchase and adjustment line references are valid");
});

Deno.test("domain: expense receipt-line references reject precise relationship errors", () => {
  const receipt = {
    schemaVersion: 1 as const,
    type: "receipt" as const,
    id: "receipt-1",
    projectId: project.id,
    date: "2026-08-24",
    currency: "SEK",
    printedTotal: "-9",
  };
  const secondReceipt = { ...receipt, id: "receipt-2" };
  const line = {
    schemaVersion: 1 as const,
    type: "receipt-purchase-line" as const,
    id: "line-1",
    receiptId: receipt.id,
    projectId: project.id,
    categoryId: category.id,
    description: "Item",
    lineTotal: "-5",
  };
  const expense = (overrides: Record<string, unknown>) => ({
    schemaVersion: 1,
    type: "expense",
    id: "expense-1",
    projectId: project.id,
    categoryId: category.id,
    date: receipt.date,
    amount: "-5",
    currency: receipt.currency,
    description: "Item",
    source: "receipt-line",
    receiptId: receipt.id,
    receiptLineId: line.id,
    ...overrides,
  });

  let result = PortableDatasetSchema.safeParse(datasetWith({
    receipts: [receipt],
    receiptPurchaseLines: [line],
    expenses: [expense({ receiptLineId: "missing-line" })],
  }));
  assert(!result.success, "unknown receipt lines must be rejected");
  if (!result.success) {
    assert(
      result.error.issues.some((issue) =>
        issue.path.join(".") === "expenses.0.receiptLineId" &&
        issue.message === "references an unknown receipt line"
      ),
    );
  }

  result = PortableDatasetSchema.safeParse(datasetWith({
    receipts: [receipt, secondReceipt],
    receiptPurchaseLines: [line],
    expenses: [expense({ receiptId: secondReceipt.id })],
  }));
  assert(!result.success, "receipt IDs must match their referenced lines");
  if (!result.success) {
    assert(
      result.error.issues.some((issue) =>
        issue.path.join(".") === "expenses.0.receiptId" &&
        issue.message === "must match the receipt line receipt"
      ),
    );
  }

  const otherProject = {
    ...project,
    id: "project-other",
    name: "Other",
  };
  result = PortableDatasetSchema.safeParse(datasetWith({
    projects: [project, otherProject],
    receipts: [receipt],
    receiptPurchaseLines: [line],
    expenses: [expense({ projectId: otherProject.id })],
  }));
  assert(!result.success, "cross-project receipt references must be rejected");
  if (!result.success) {
    assert(
      result.error.issues.some((issue) =>
        issue.path.join(".") === "expenses.0.projectId" &&
        issue.message === "must match the receipt project"
      ),
    );
    assert(
      result.error.issues.some((issue) =>
        issue.path.join(".") === "expenses.0.projectId" &&
        issue.message === "must match the receipt line project"
      ),
    );
  }
});

Deno.test("domain: dataset accepts every portable record variant", () => {
  const receipt = {
    schemaVersion: 1 as const,
    type: "receipt" as const,
    id: "receipt-1",
    projectId: project.id,
    date: "2026-08-24",
    currency: "SEK",
    printedTotal: "-9",
  };
  const line = {
    schemaVersion: 1 as const,
    type: "receipt-purchase-line" as const,
    id: "line-1",
    receiptId: receipt.id,
    projectId: project.id,
    categoryId: category.id,
    description: "Item",
    lineTotal: "-10",
  };
  const device = {
    schemaVersion: 1 as const,
    type: "device" as const,
    id: "device-phone",
    label: "Phone",
    createdAt: "2026-08-24T10:00:00.000Z",
    lastSeenAt: "2026-08-24T10:00:00.000Z",
  };
  const parsed = PortableDatasetSchema.parse(datasetWith({
    expenses: [{
      schemaVersion: 1,
      type: "expense",
      id: "expense-1",
      projectId: project.id,
      categoryId: category.id,
      date: "2026-08-24",
      amount: "-10",
      currency: "SEK",
      description: "",
      source: "manual",
    }],
    receipts: [receipt],
    receiptPurchaseLines: [line],
    receiptAdjustments: [{
      schemaVersion: 1,
      type: "receipt-adjustment",
      id: "adjustment-1",
      receiptId: receipt.id,
      projectId: project.id,
      categoryId: category.id,
      description: "Deposit",
      amount: "1",
      lineId: line.id,
    }],
    devices: [device],
    tombstones: [{
      schemaVersion: 1,
      type: "tombstone",
      id: "tombstone-1",
      targetType: "category",
      targetId: "category-deleted",
      deletedAt: "2026-08-24T10:00:00.000Z",
      deletedBy: device.id,
      replacementCategoryId: category.id,
    }],
    retirementMarkers: [{
      schemaVersion: 1,
      type: "retirement-marker",
      id: "retirement-1",
      generation: 1,
      retiredAt: "2026-08-24T10:00:00.000Z",
      retiredBy: device.id,
      reason: "test generation",
    }],
    revisions: [{
      schemaVersion: 1,
      type: "revision",
      id: "revision-1",
      targetType: "project",
      targetId: project.id,
      revision: 0,
      deviceId: device.id,
      lamport: 1,
      recordedAt: "2026-08-24T10:00:00.000Z",
    }],
  }));
  assertEquals(parsed.receipts.length, 1);
  assertEquals(parsed.receiptPurchaseLines[0]?.description, "Item");
  assertEquals(parsed.receiptAdjustments[0]?.lineId, line.id);
  assertEquals(parsed.devices[0]?.id, device.id);
  assertEquals(parsed.tombstones[0]?.replacementCategoryId, category.id);
  assertEquals(parsed.retirementMarkers[0]?.generation, 1);
  assertEquals(parsed.revisions[0]?.targetId, project.id);
});

Deno.test("domain: version dispatch, migration policy, and deterministic round trip", () => {
  const first = datasetWith({
    expenses: [{
      schemaVersion: 1,
      type: "expense",
      id: "expense-z",
      projectId: project.id,
      categoryId: category.id,
      date: "2026-08-24",
      amount: "-10.90",
      currency: "SEK",
      description: "",
      source: "manual",
    }],
  });
  const second = datasetWith({
    expenses: [...(first.expenses as unknown[]).reverse()],
  });
  assertEquals(exportDataset(first), exportDataset(second));
  const imported = importDataset(exportDataset(first));
  assertEquals(imported.schemaVersion, 1);
  const legacy = { ...first, schemaVersion: 0, format: undefined };
  const migrated = importDataset(JSON.stringify(legacy));
  assertEquals(migrated.schemaVersion, 1);
  let rejected = false;
  try {
    importDataset(JSON.stringify({ ...first, schemaVersion: 2 }));
  } catch {
    rejected = true;
  }
  assert(rejected, "future versions must be rejected");
  rejected = false;
  try {
    migrateDown();
  } catch {
    rejected = true;
  }
  assert(rejected, "down migrations must be explicit and unsupported");
});

Deno.test("domain: export ordering is locale-independent for mixed-case punctuation IDs", () => {
  const ids = ["a_id", "A-id", "a~id", "a.id", "a-id"];
  const projects = ids.map((id, index) => ({
    ...project,
    id,
    name: `Project ${index}`,
  }));
  const first = exportDataset(datasetWith({ projects }));
  const second = exportDataset(
    datasetWith({ projects: [...projects].reverse() }),
  );
  assertEquals(first, second);

  const exported = JSON.parse(first) as { projects: Array<{ id: string }> };
  assertEquals(
    exported.projects.map(({ id }) => id),
    ["A-id", "a-id", "a.id", "a_id", "a~id"],
  );
  assertEquals(
    canonicalizeDataset(datasetWith({ projects })).projects.map(({ id }) => id),
    ["A-id", "a-id", "a.id", "a_id", "a~id"],
  );
});
