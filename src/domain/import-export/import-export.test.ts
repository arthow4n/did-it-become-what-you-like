import {
  CANONICAL_EXPORT_FORMAT,
  createCanonicalExport,
  deduplicateImportedHistory,
  ImportExportDomainError,
  parseCanonicalExport,
  replacementGeneration,
  serializeCanonicalExport,
} from "./index.ts";
import type { PortableDataset } from "../schema/index.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
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
  "import-export domain: legacy schema migrates and future schema is refused",
  () => {
    const legacy = { ...dataset(), schemaVersion: 0, format: undefined };
    const migrated = parseCanonicalExport(JSON.stringify(legacy));
    assert(migrated.migrationRequired);
    assertEquals(migrated.document.dataset.schemaVersion, 1);

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
