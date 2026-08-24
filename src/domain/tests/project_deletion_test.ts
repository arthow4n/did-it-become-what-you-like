import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import {
  deleteLocalRepositoryDatabase,
  openLocalRepository,
} from "../../adapters/local/index.ts";
import { createProjectDeletionService } from "../project-deletion.ts";
import { DATASET_FORMAT, UNCATEGORIZED_CATEGORY_ID } from "../index.ts";

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

let databaseNumber = 0;

function databaseName(): string {
  databaseNumber += 1;
  return `did-it-become-what-you-like-x501-domain-${databaseNumber}`;
}

function datasetFixture() {
  return {
    schemaVersion: 1 as const,
    format: DATASET_FORMAT,
    projects: [
      {
        schemaVersion: 1 as const,
        type: "project" as const,
        id: "project-current",
        name: "Current project",
        defaultCurrency: "SEK" as const,
        archived: false,
      },
      {
        schemaVersion: 1 as const,
        type: "project" as const,
        id: "project-delete",
        name: "Trip project",
        defaultCurrency: "EUR" as const,
        archived: false,
      },
      {
        schemaVersion: 1 as const,
        type: "project" as const,
        id: "project-keep",
        name: "Keep project",
        defaultCurrency: "USD" as const,
        archived: false,
      },
    ],
    categories: [{
      schemaVersion: 1 as const,
      type: "category" as const,
      id: UNCATEGORIZED_CATEGORY_ID,
      name: "Uncategorized",
      sortOrder: 0,
      archived: false,
      system: true,
    }],
    expenses: [
      {
        schemaVersion: 1 as const,
        type: "expense" as const,
        id: "expense-delete",
        projectId: "project-delete",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        date: "2026-08-01",
        amount: "-12.50",
        currency: "EUR" as const,
        description: "Trip lunch",
        source: "manual" as const,
      },
      {
        schemaVersion: 1 as const,
        type: "expense" as const,
        id: "expense-keep",
        projectId: "project-keep",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        date: "2026-08-04",
        amount: "-4.00",
        currency: "USD" as const,
        description: "Keep this",
        source: "manual" as const,
      },
    ],
    receipts: [
      {
        schemaVersion: 1 as const,
        type: "receipt" as const,
        id: "receipt-delete",
        projectId: "project-delete",
        date: "2026-08-03",
        merchant: "Trip shop",
        currency: "EUR" as const,
        printedTotal: "20",
      },
    ],
    receiptPurchaseLines: [
      {
        schemaVersion: 1 as const,
        type: "receipt-purchase-line" as const,
        id: "line-delete-1",
        receiptId: "receipt-delete",
        projectId: "project-delete",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        description: "Ticket",
        lineTotal: "10",
      },
      {
        schemaVersion: 1 as const,
        type: "receipt-purchase-line" as const,
        id: "line-delete-2",
        receiptId: "receipt-delete",
        projectId: "project-delete",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        description: "Snack",
        lineTotal: "10",
      },
    ],
    receiptAdjustments: [{
      schemaVersion: 1 as const,
      type: "receipt-adjustment" as const,
      id: "adjustment-delete",
      receiptId: "receipt-delete",
      projectId: "project-delete",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      description: "Discount",
      amount: "-1",
    }],
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
  };
}

async function withRepository<T>(
  callback: (
    repository: Awaited<ReturnType<typeof openLocalRepository>>,
  ) => Promise<T>,
): Promise<T> {
  const name = databaseName();
  await deleteLocalRepositoryDatabase(name, indexedDB).catch(() => undefined);
  const repository = await openLocalRepository({
    databaseName: name,
    deviceId: "0123456789abcdef0123456789abcdef",
    indexedDB,
    keyRange: IDBKeyRange,
    now: () => "2026-08-24T18:00:00.000Z",
  });
  try {
    await repository.importDataset(JSON.stringify(datasetFixture()), "replace");
    await repository.transaction("readwrite", async (transaction) => {
      await transaction.put("settings", "project-category-organization", {
        orderedProjectIds: [
          "project-current",
          "project-delete",
          "project-keep",
        ],
        lastSelectedProjectId: "project-current",
      });
    });
    return await callback(repository);
  } finally {
    repository.close();
    await deleteLocalRepositoryDatabase(name, indexedDB);
  }
}

Deno.test(
  "project-deletion domain preview includes every related count and affected range",
  async () => {
    await withRepository(async (repository) => {
      const service = createProjectDeletionService(repository, {
        deviceId: repository.deviceId,
        now: () => "2026-08-24T18:00:00.000Z",
      });
      const preview = await service.preview("project-delete");
      assertEquals(preview.expenseCount, 1);
      assertEquals(preview.receiptCount, 1);
      assertEquals(preview.purchaseLineCount, 2);
      assertEquals(preview.adjustmentCount, 1);
      assertEquals(preview.currencies, ["EUR"]);
      assertEquals(preview.dateRange, {
        from: "2026-08-01",
        to: "2026-08-03",
      });
      assertEquals(preview.target.projectName, "Trip project");
      assert(!preview.current);
    });
  },
);

Deno.test(
  "project-deletion domain safety export is canonical and contains unrelated invariants",
  async () => {
    await withRepository(async (repository) => {
      const service = createProjectDeletionService(repository, {
        now: () => "2026-08-24T18:00:00.000Z",
      });
      const json = await service.exportSafety({
        projectId: "project-delete",
        projectName: "Trip project",
        expenseCount: 1,
        receiptCount: 1,
      });
      const document = JSON.parse(json) as {
        format: string;
        dataset: {
          projects: Array<{ id: string }>;
          categories: Array<{ id: string }>;
          expenses: Array<{ id: string }>;
        };
      };
      assertEquals(
        document.format,
        "did-it-become-what-you-like/portable-export",
      );
      assert(
        document.dataset.projects.some((project) =>
          project.id === "project-delete"
        ),
        "safety export must contain the project",
      );
      assert(
        document.dataset.categories.some((category) =>
          category.id === UNCATEGORIZED_CATEGORY_ID
        ),
        "global categories must be preserved",
      );
      assert(
        document.dataset.expenses.some((expense) =>
          expense.id === "expense-keep"
        ),
        "unrelated projects and records must be preserved",
      );
      assert(
        !json.toLowerCase().includes("physical history erased"),
        "the export must not claim physical history erasure",
      );
    });
  },
);

Deno.test("project-deletion domain rejects the current project", async () => {
  await withRepository(async (repository) => {
    const service = createProjectDeletionService(repository);
    try {
      await service.preview("project-current");
    } catch (error) {
      assert(error instanceof Error);
      assertEquals(
        (error as { readonly code?: string }).code,
        "current-project",
      );
      return;
    }
    throw new Error("Expected current-project rejection");
  });
});
