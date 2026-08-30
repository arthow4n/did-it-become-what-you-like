import {
  CANONICAL_EXPORT_FORMAT,
  createCanonicalExport,
  deduplicateImportedHistory,
  ImportExportDomainError,
  parseCanonicalExport,
  previewCanonicalImport,
  replacementGeneration,
  serializeCanonicalExport,
} from "./index.ts";
import type { PortableDataset } from "../schema/index.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
  parseCurrentDataset,
  UNCATEGORIZED_CATEGORY_ID,
} from "../schema/index.ts";

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

function dataset(): PortableDataset {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    format: DATASET_FORMAT,
    projects: [{
      schemaVersion: 1,
      type: "project",
      id: "project-main",
      name: "Main",
      defaultCurrency: "SEK",
      archived: false,
    }],
    categories: [{
      schemaVersion: 1,
      type: "category",
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
      sortOrder: 0,
      archived: false,
      system: true,
    }],
    expenses: [{
      schemaVersion: 1,
      type: "expense",
      id: "expense-main",
      projectId: "project-main",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      date: "2026-08-24",
      amount: "-10.90",
      currency: "SEK",
      description: "Coffee",
      source: "manual",
    }],
    receipts: [],
    receiptPurchaseLines: [],
    receiptAdjustments: [],
    devices: [],
    tombstones: [],
    retirementMarkers: [],
    revisions: [],
    settings: {
      schemaVersion: 1,
      type: "portable-settings",
      id: "settings-portable",
      expenseDayBoundary: "03:00",
    },
  };
}

function change(id: string, amount = "-10"): {
  readonly id: string;
  readonly actorId: string;
  readonly sequence: number;
  readonly parents: readonly string[];
  readonly payload: Record<string, unknown>;
} {
  return {
    id,
    actorId: "device-main",
    sequence: 1,
    parents: [],
    payload: {
      type: "causal-dataset",
      schemaVersion: 1,
      fingerprint: amount,
      dataset: dataset(),
    },
  };
}

function receiptDataset(): PortableDataset {
  const base = dataset();
  return {
    ...base,
    expenses: [...base.expenses, {
      schemaVersion: 1,
      type: "expense",
      id: "expense-receipt",
      projectId: "project-main",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      date: "2026-08-24",
      amount: "-10",
      currency: "SEK",
      merchant: "Receipt shop",
      description: "Receipt coffee",
      source: "receipt-line",
      receiptId: "receipt-main",
      receiptLineId: "line-coffee",
    }],
    receipts: [{
      schemaVersion: 1,
      type: "receipt",
      id: "receipt-main",
      projectId: "project-main",
      date: "2026-08-24",
      merchant: "Receipt shop",
      currency: "SEK",
      printedTotal: "-8",
    }],
    receiptPurchaseLines: [{
      schemaVersion: 1,
      type: "receipt-purchase-line",
      id: "line-coffee",
      receiptId: "receipt-main",
      projectId: "project-main",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      description: "Coffee",
      lineTotal: "-10",
    }],
    receiptAdjustments: [{
      schemaVersion: 1,
      type: "receipt-adjustment",
      id: "line-discount",
      receiptId: "receipt-main",
      projectId: "project-main",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      description: "Discount",
      amount: "2",
      lineId: "line-coffee",
    }],
    tombstones: [{
      schemaVersion: 1,
      type: "tombstone",
      id: "tombstone-receipt-removed",
      targetType: "receipt",
      targetId: "receipt-removed",
      deletedAt: "2026-08-23T12:00:00.000Z",
      deletedBy: "device-main",
    }],
  };
}

Deno.test(
  "import-export domain: canonical export restores exact dataset and history",
  () => {
    const first = createCanonicalExport({
      dataset: dataset(),
      generation: 4,
      heads: ["change-main"],
      changes: [change("change-main")],
      exportedAt: "2026-08-24T14:00:00.000Z",
    });
    const json = serializeCanonicalExport(first);
    const second = parseCanonicalExport(json).document;
    assertEquals(serializeCanonicalExport(second), json);
    assertEquals(second.dataset.expenses[0]?.amount, "-10.9");
    assertEquals(second.generation, 4);
    assertEquals(second.changes[0]?.id, "change-main");
  },
);

Deno.test(
  "import-export domain: receipt aggregates and deletion history round-trip without dangling references",
  () => {
    const document = createCanonicalExport({ dataset: receiptDataset() });
    const restored = parseCanonicalExport(serializeCanonicalExport(document))
      .document.dataset;
    const validated = parseCurrentDataset(restored);
    assertEquals(validated.receipts.map((receipt) => receipt.id), [
      "receipt-main",
    ]);
    assertEquals(validated.receiptPurchaseLines.map((line) => line.id), [
      "line-coffee",
    ]);
    assertEquals(validated.receiptAdjustments.map((line) => line.id), [
      "line-discount",
    ]);
    assertEquals(validated.expenses.at(-1)?.receiptLineId, "line-coffee");
    assertEquals(validated.tombstones[0]?.targetId, "receipt-removed");
  },
);

Deno.test(
  "import-export domain: legacy schema migrates and future schema is refused",
  () => {
    const legacy = { ...dataset(), schemaVersion: 0, format: undefined };
    const migrated = parseCanonicalExport(JSON.stringify(legacy));
    assert(migrated.migrationRequired);
    assertEquals(migrated.document.dataset.schemaVersion, 1);
    const preview = previewCanonicalImport(JSON.stringify(legacy));
    assertEquals(preview.migrations, ["schema 0 -> 1"]);
    assertEquals(preview.warnings, [
      "This backup requires schema migration before import.",
    ]);
    assertEquals(preview.errors, []);

    let future: unknown;
    try {
      parseCanonicalExport(JSON.stringify({
        schemaVersion: 99,
        format: DATASET_FORMAT,
      }));
    } catch (error) {
      future = error;
    }
    assert(future instanceof ImportExportDomainError);
    assertEquals((future as ImportExportDomainError).code, "future-version");

    let malformed: unknown;
    try {
      parseCanonicalExport("not-json");
    } catch (error) {
      malformed = error;
    }
    assert(malformed instanceof ImportExportDomainError);
    assertEquals((malformed as ImportExportDomainError).code, "invalid-json");
    assertEquals(
      (malformed as ImportExportDomainError).operation,
      "import.json_syntax",
    );
  },
);

Deno.test(
  "import-export domain: diagnostics distinguish schema, record, and migration failures",
  () => {
    let missingSchema: unknown;
    try {
      parseCanonicalExport(JSON.stringify({ projects: [] }));
    } catch (error) {
      missingSchema = error;
    }
    assert(missingSchema instanceof ImportExportDomainError);
    assertEquals(
      (missingSchema as ImportExportDomainError).operation,
      "import.schema_version",
    );

    let invalidRecord: unknown;
    try {
      parseCanonicalExport(JSON.stringify({
        ...dataset(),
        expenses: [{}],
      }));
    } catch (error) {
      invalidRecord = error;
    }
    assert(invalidRecord instanceof ImportExportDomainError);
    assertEquals(
      (invalidRecord as ImportExportDomainError).operation,
      "import.record_validation",
    );

    let migrationFailure: unknown;
    try {
      parseCanonicalExport(JSON.stringify({
        schemaVersion: 0,
        projects: "not-an-array",
      }));
    } catch (error) {
      migrationFailure = error;
    }
    assert(migrationFailure instanceof ImportExportDomainError);
    assertEquals(
      (migrationFailure as ImportExportDomainError).operation,
      "import.migration_failure",
    );
  },
);

Deno.test(
  "import-export domain: unknown future envelope and local secrets are rejected",
  () => {
    let rejected: unknown;
    try {
      parseCanonicalExport(JSON.stringify({
        schemaVersion: 2,
        format: CANONICAL_EXPORT_FORMAT,
        generation: 2,
        heads: [],
        changes: [],
        dataset: dataset(),
      }));
    } catch (error) {
      rejected = error;
    }
    assert(rejected instanceof ImportExportDomainError);
    assertEquals((rejected as ImportExportDomainError).code, "future-version");

    const exported = JSON.parse(serializeCanonicalExport(
      createCanonicalExport({ dataset: dataset() }),
    )) as Record<string, unknown>;
    assert(!("geminiApiKey" in exported));
    assert(!("workflowDraft" in exported));
    assert(!("image" in exported));
    assert(!("bytes" in exported));
  },
);

Deno.test(
  "import-export domain: stable history duplicates are idempotent and collisions fail",
  () => {
    const first = change("change-a");
    const second = change("change-b");
    const deduplicated = deduplicateImportedHistory(
      [first],
      [first, second],
    );
    assertEquals(deduplicated.duplicateChangeCount, 1);
    assertEquals(
      deduplicated.changes.map((item) => item.id),
      ["change-a", "change-b"],
    );

    let collision: unknown;
    try {
      deduplicateImportedHistory([first], [{ ...first, sequence: 2 }]);
    } catch (error) {
      collision = error;
    }
    assert(collision instanceof ImportExportDomainError);
    assertEquals(
      (collision as ImportExportDomainError).code,
      "history-collision",
    );
  },
);

Deno.test(
  "import-export domain: replacement advances generation and protects old packets",
  () => {
    assertEquals(replacementGeneration(3, 1).nextGeneration, 4);
    assertEquals(replacementGeneration(3, 8).nextGeneration, 9);
  },
);
