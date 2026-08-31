import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { deleteLocalRepositoryDatabase, openLocalRepository } from "./index.ts";
import { createDatasetChange, mergeCausalSnapshots } from "../sync/causal.ts";
import type { CausalSnapshot } from "../ports/sync.ts";
import { createProjectDeletionService } from "../../domain/project-deletion.ts";
import { SecretValue } from "../ports/index.ts";
import {
  DATASET_FORMAT,
  parseCurrentDataset,
  type PortableDataset,
  UNCATEGORIZED_CATEGORY_ID,
} from "../../domain/index.ts";
import { createFakeSecretStoragePort } from "../../test-support/fakes/ports.ts";

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
  return `did-it-become-what-you-like-x501-sync-${databaseNumber}`;
}

function datasetFixture(): PortableDataset {
  return parseCurrentDataset({
    schemaVersion: 1,
    format: DATASET_FORMAT,
    projects: [
      {
        schemaVersion: 1,
        type: "project",
        id: "project-current",
        name: "Current",
        defaultCurrency: "SEK",
        archived: false,
      },
      {
        schemaVersion: 1,
        type: "project",
        id: "project-delete",
        name: "Delete me",
        defaultCurrency: "EUR",
        archived: false,
      },
      {
        schemaVersion: 1,
        type: "project",
        id: "project-keep",
        name: "Keep me",
        defaultCurrency: "USD",
        archived: false,
      },
    ],
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
      id: "expense-delete",
      projectId: "project-delete",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      date: "2026-08-01",
      amount: "-12",
      currency: "EUR",
      description: "Delete me",
      source: "manual",
    }, {
      schemaVersion: 1,
      type: "expense",
      id: "expense-keep",
      projectId: "project-keep",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      date: "2026-08-02",
      amount: "-3",
      currency: "USD",
      description: "Keep me",
      source: "manual",
    }],
    receipts: [{
      schemaVersion: 1,
      type: "receipt",
      id: "receipt-delete",
      projectId: "project-delete",
      date: "2026-08-03",
      merchant: "Delete shop",
      currency: "EUR",
      printedTotal: "20",
    }],
    receiptPurchaseLines: [{
      schemaVersion: 1,
      type: "receipt-purchase-line",
      id: "line-delete",
      receiptId: "receipt-delete",
      projectId: "project-delete",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      description: "Line",
      lineTotal: "20",
    }],
    receiptAdjustments: [{
      schemaVersion: 1,
      type: "receipt-adjustment",
      id: "adjustment-delete",
      receiptId: "receipt-delete",
      projectId: "project-delete",
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      description: "Adjustment",
      amount: "-1",
    }],
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
  });
}

async function withRepository<T>(
  callback: (
    repository: Awaited<ReturnType<typeof openLocalRepository>>,
    name: string,
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
    return await callback(repository, name);
  } finally {
    repository.close();
    await deleteLocalRepositoryDatabase(name, indexedDB);
  }
}

Deno.test(
  "project-delete-sync atomically tombstones the complete populated project scope and preserves unrelated data",
  async () => {
    await withRepository(async (repository, name) => {
      const service = createProjectDeletionService(repository, {
        deviceId: repository.deviceId,
        now: () => "2026-08-24T18:01:00.000Z",
      });
      const safety = await service.exportSafety({
        projectId: "project-delete",
        projectName: "Delete me",
        expenseCount: 1,
        receiptCount: 1,
      });
      assert(safety.includes("portable-export"));
      const result = await service.commit({
        projectId: "project-delete",
        projectName: "Delete me",
        expenseCount: 1,
        receiptCount: 1,
      });
      assertEquals(result.tombstoneCount, 5);
      const records = await repository.query("records");
      const values = records.map((entry) =>
        entry.value as { type?: string; id?: string }
      );
      assert(!values.some((value) => value.id === "project-delete"));
      assert(!values.some((value) => value.id === "expense-delete"));
      assert(!values.some((value) => value.id === "receipt-delete"));
      assert(!values.some((value) => value.id === "line-delete"));
      assert(!values.some((value) => value.id === "adjustment-delete"));
      assertEquals(
        values.filter((value) => value.type === "tombstone").length,
        5,
      );
      assert(values.some((value) => value.id === "project-keep"));
      assert(values.some((value) => value.id === "expense-keep"));
      const organization = await repository.transaction(
        "readonly",
        (transaction) =>
          transaction.get<{ orderedProjectIds: string[] }>(
            "settings",
            "project-category-organization",
          ),
      );
      assertEquals(organization?.orderedProjectIds, [
        "project-current",
        "project-keep",
      ]);

      repository.close();
      const restarted = await openLocalRepository({
        databaseName: name,
        deviceId: "0123456789abcdef0123456789abcdef",
        indexedDB,
        keyRange: IDBKeyRange,
      });
      try {
        const restartedValues = (await restarted.query("records")).map((
          entry,
        ) => entry.value as { id?: string });
        assert(
          !restartedValues.some((value) => value.id === "project-delete"),
          "restart must retain logical deletion",
        );
        assert(
          restartedValues.some((value) => value.id === "project-keep"),
          "restart must retain unrelated records",
        );
      } finally {
        restarted.close();
      }
    });
  },
);

Deno.test(
  "project-delete-sync offline deletion converges and late-device replay cannot resurrect the project",
  async () => {
    await withRepository(async (repository) => {
      const service = createProjectDeletionService(repository, {
        deviceId: repository.deviceId,
        now: () => "2026-08-24T18:01:00.000Z",
      });
      const before = parseCurrentDataset(
        JSON.parse(await repository.exportDataset()),
      );
      await service.commit({
        projectId: "project-delete",
        projectName: "Delete me",
        expenseCount: 1,
        receiptCount: 1,
      });
      const after = parseCurrentDataset(
        JSON.parse(await repository.exportDataset()),
      );
      const base = createDatasetChange({
        id: "change-base",
        actorId: "device-a",
        sequence: 1,
        parents: [],
        dataset: before,
      });
      const deleted = createDatasetChange({
        id: "change-delete",
        actorId: "device-a",
        sequence: 2,
        parents: [base.id],
        dataset: after,
      });
      const late = createDatasetChange({
        id: "change-late",
        actorId: "device-b",
        sequence: 1,
        parents: [base.id],
        dataset: before,
      });
      const current: CausalSnapshot = {
        generation: 1,
        heads: [deleted.id],
        changes: [base, deleted],
        dataset: after,
      };
      const incoming: CausalSnapshot = {
        generation: 1,
        heads: [late.id],
        changes: [base, late],
        dataset: before,
      };
      const result = mergeCausalSnapshots(current, incoming);
      assert(
        !result.snapshot.dataset.projects.some((project) =>
          project.id === "project-delete"
        ),
        "causal replay must not resurrect the deleted project",
      );
      assert(
        result.snapshot.dataset.tombstones.some((tombstone) =>
          tombstone.targetId === "project-delete"
        ),
        "the project tombstone must converge with the deletion",
      );
      assert(
        result.snapshot.dataset.projects.some((project) =>
          project.id === "project-keep"
        ),
        "unrelated projects must converge",
      );
    });
  },
);

Deno.test(
  "project deletion leaves both receipt-AI keys intact",
  async () => {
    await withRepository(async (repository) => {
      const secrets = createFakeSecretStoragePort();
      await secrets.set("gemini-api-key", SecretValue.from("AIza.project"));
      await secrets.set(
        "openrouter-api-key",
        SecretValue.from("sk-or-v1.project"),
      );
      const service = createProjectDeletionService(repository, {
        deviceId: repository.deviceId,
        now: () => "2026-08-24T18:02:00.000Z",
      });
      const target = (await service.preview("project-delete")).target;
      await service.commit(target);

      assert((await secrets.get("gemini-api-key")) !== undefined);
      assert((await secrets.get("openrouter-api-key")) !== undefined);
    });
  },
);
