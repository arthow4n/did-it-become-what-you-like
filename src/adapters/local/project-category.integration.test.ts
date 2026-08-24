import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { deleteLocalRepositoryDatabase, openLocalRepository } from "./index.ts";
import {
  createProjectCategoryService,
  type ProjectCategoryService,
} from "../../domain/organization.ts";
import { UNCATEGORIZED_CATEGORY_ID } from "../../domain/index.ts";

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

let testNumber = 0;

function databaseName(): string {
  testNumber += 1;
  return `did-it-become-what-you-like-l202-${testNumber}`;
}

async function withRepository<T>(
  run: (
    repository: Awaited<ReturnType<typeof openLocalRepository>>,
    service: ProjectCategoryService,
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
    now: () => "2026-08-24T03:30:00.000Z",
  });
  const service = createProjectCategoryService(repository, {
    deviceId: "device-integration",
    now: () => "2026-08-24T03:30:00.000Z",
  });
  try {
    return await run(repository, service, name);
  } finally {
    repository.close();
    await deleteLocalRepositoryDatabase(name, indexedDB);
  }
}

const project = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-integration",
  name: "Integration",
  defaultCurrency: "SEK" as const,
  archived: false,
};

const oldCategory = {
  schemaVersion: 1 as const,
  type: "category" as const,
  id: "category-old",
  name: "Old",
  sortOrder: 1,
  archived: false,
  system: false,
};

const replacementCategory = {
  ...oldCategory,
  id: "category-new",
  name: "New",
  sortOrder: 2,
};

const expense = {
  schemaVersion: 1 as const,
  type: "expense" as const,
  id: "expense-integration",
  projectId: project.id,
  categoryId: oldCategory.id,
  date: "2026-08-24",
  amount: "-2",
  currency: "SEK" as const,
  description: "Item",
  source: "manual" as const,
};

Deno.test("organize integration: atomic category reassignment and tombstone survive restart", async () => {
  await withRepository(async (repository, service, name) => {
    await service.commitProject({ type: "create", project });
    await service.commitCategory({ type: "create", category: oldCategory });
    await service.commitCategory({
      type: "create",
      category: replacementCategory,
    });
    await repository.transaction("readwrite", async (transaction) => {
      await transaction.put("records", expense.id, expense);
    });
    await service.commitCategory({
      type: "delete-and-reassign",
      categoryId: oldCategory.id,
      replacementCategoryId: replacementCategory.id,
    });
    repository.close();

    const restarted = await openLocalRepository({
      databaseName: name,
      deviceId: "0123456789abcdef0123456789abcdef",
      indexedDB,
      keyRange: IDBKeyRange,
    });
    try {
      const restartedService = createProjectCategoryService(restarted, {
        deviceId: "device-integration",
        now: () => "2026-08-24T03:30:00.000Z",
      });
      const state = await restartedService.getState();
      assertEquals(state.expenses[0]?.categoryId, replacementCategory.id);
      assertEquals(
        await restartedService.resolveCategoryReference(oldCategory.id),
        replacementCategory.id,
      );
      assertEquals(
        state.tombstones.find((tombstone) =>
          tombstone.targetId === oldCategory.id
        )
          ?.replacementCategoryId,
        replacementCategory.id,
      );
    } finally {
      restarted.close();
    }
  });
});

Deno.test("organize integration: local transaction failure leaves organization unchanged for retry", async () => {
  let fail = false;
  const name = databaseName();
  await deleteLocalRepositoryDatabase(name, indexedDB).catch(() => undefined);
  const repository = await openLocalRepository({
    databaseName: name,
    deviceId: "0123456789abcdef0123456789abcdef",
    indexedDB,
    keyRange: IDBKeyRange,
    beforeRequest: (operation) => {
      if (fail && operation === "local.value.put") throw new Error("quota");
    },
  });
  try {
    const service = createProjectCategoryService(repository, {
      deviceId: "device-integration",
      now: () => "2026-08-24T03:30:00.000Z",
    });
    await service.commitProject({ type: "create", project });
    await service.commitCategory({ type: "create", category: oldCategory });
    fail = true;
    let failed = false;
    try {
      await service.commitCategory({
        type: "rename",
        categoryId: oldCategory.id,
        name: "Failed",
      });
    } catch {
      failed = true;
    }
    assert(failed, "the injected local failure must reject");
    fail = false;
    assertEquals(
      (await service.getState()).categories.find((category) =>
        category.id === oldCategory.id
      )
        ?.name,
      "Old",
    );
    await service.commitCategory({
      type: "rename",
      categoryId: oldCategory.id,
      name: "Retried",
    });
    assertEquals(
      (await service.getState()).categories.find((category) =>
        category.id === oldCategory.id
      )
        ?.name,
      "Retried",
    );
  } finally {
    repository.close();
    await deleteLocalRepositoryDatabase(name, indexedDB);
  }
});

Deno.test("organize integration: first project initializes protected Uncategorized", async () => {
  await withRepository(async (_repository, service) => {
    const state = await service.getState();
    assertEquals(state.projects.length, 0);
    assertEquals(state.categories.map((category) => category.id), [
      UNCATEGORIZED_CATEGORY_ID,
    ]);
  });
});
