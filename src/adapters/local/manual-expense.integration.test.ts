import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { createActor } from "xstate";
import { createManualExpenseMachine } from "../../actors/manual-expense.ts";
import { UNCATEGORIZED_CATEGORY_ID } from "../../domain/index.ts";
import {
  createProjectCategoryService,
  type ProjectCategoryService,
} from "../../domain/organization.ts";
import { deleteLocalRepositoryDatabase, openLocalRepository } from "./index.ts";

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

async function settle(): Promise<void> {
  for (let turn = 0; turn < 12; turn += 1) {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

type SnapshotLike = {
  readonly value: unknown;
  readonly status: unknown;
  readonly context: { readonly error: unknown };
};

type ActorLike = { getSnapshot(): SnapshotLike };

async function waitForValue(
  actor: ActorLike,
  expected: string,
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await settle();
    if (actor.getSnapshot().value === expected) return;
  }
  const snapshot = actor.getSnapshot();
  throw new Error(
    `Expected ${expected}; got ${
      JSON.stringify({
        value: snapshot.value,
        status: snapshot.status,
        error: snapshot.context.error,
      })
    }`,
  );
}

let sequence = 0;

function databaseName(): string {
  sequence += 1;
  return `did-it-become-what-you-like-l204-manual-${sequence}`;
}

const project = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-integration-manual",
  name: "Integration manual",
  defaultCurrency: "SEK" as const,
  archived: false,
};

async function withRepository<T>(
  run: (
    repository: Awaited<ReturnType<typeof openLocalRepository>>,
    service: ProjectCategoryService,
  ) => Promise<T>,
  beforeRequest?: (operation: string) => void,
): Promise<T> {
  const name = databaseName();
  await deleteLocalRepositoryDatabase(name, indexedDB).catch(() => undefined);
  const repository = await openLocalRepository({
    databaseName: name,
    deviceId: "0123456789abcdef0123456789abcdef",
    indexedDB,
    keyRange: IDBKeyRange,
    now: () => "2026-08-24T12:00:00.000Z",
    ...(beforeRequest === undefined ? {} : { beforeRequest }),
  });
  const service = createProjectCategoryService(repository, {
    deviceId: "device-manual-integration",
    now: () => "2026-08-24T12:00:00.000Z",
  });
  try {
    return await run(repository, service);
  } finally {
    repository.close();
    await deleteLocalRepositoryDatabase(name, indexedDB);
  }
}

function createActorFor(
  repository: Awaited<ReturnType<typeof openLocalRepository>>,
  service: ProjectCategoryService,
  key: string,
) {
  return createActor(
    createManualExpenseMachine({
      local: repository,
      organization: service,
      clock: { now: () => "2026-08-24T12:00:00.000Z" },
      ids: { next: () => "expense-integration" },
    }),
    { input: { persistenceKey: key } },
  ).start();
}

Deno.test("manual-save integration: local commit is atomic and clears durable draft", async () => {
  await withRepository(async (repository, service) => {
    await service.commitProject({ type: "create", project });
    const actor = createActorFor(
      repository,
      service,
      "workflow:integration-save",
    );
    actor.send({ type: "expense.open" });
    await waitForValue(actor, "editing");
    const draft = actor.getSnapshot().context.draft;
    assert(draft !== null);
    actor.send({
      type: "expense.change",
      draft: {
        ...draft,
        amount: "0008.40",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        merchant: "Integration shop",
      },
    });
    await waitForValue(actor, "editing");
    actor.send({ type: "expense.submit" });
    await waitForValue(actor, "saved");
    assertEquals(actor.getSnapshot().value, "saved");
    const result = actor.getSnapshot().context.result;
    assert(result !== null);
    assertEquals(result.expense.amount, "-8.4");
    assertEquals(result.expense.merchant, "Integration shop");
    const state = await service.getState();
    assertEquals(state.expenses.length, 1);
    assertEquals(state.expenses[0]?.id, "expense-integration");
    assertEquals(
      await repository.query("workflow-snapshots"),
      [],
    );
    actor.stop();
  });
});

Deno.test("manual-save integration: repository failure retains draft and retry commits", async () => {
  let failWrites = false;
  await withRepository(async (repository, service) => {
    await service.commitProject({ type: "create", project });
    const actor = createActorFor(
      repository,
      service,
      "workflow:integration-retry",
    );
    actor.send({ type: "expense.open" });
    await waitForValue(actor, "editing");
    const draft = actor.getSnapshot().context.draft;
    assert(draft !== null);
    actor.send({ type: "expense.change", draft: { ...draft, amount: "2.00" } });
    await waitForValue(actor, "editing");
    failWrites = true;
    actor.send({ type: "expense.submit" });
    await waitForValue(actor, "saveFailed");
    assertEquals(actor.getSnapshot().value, "saveFailed");
    assert(actor.getSnapshot().context.draft !== null);
    failWrites = false;
    actor.send({ type: "expense.retry" });
    await waitForValue(actor, "saved");
    assertEquals(actor.getSnapshot().value, "saved");
    assertEquals((await service.getState()).expenses[0]?.amount, "-2");
    actor.stop();
  }, (operation) => {
    if (failWrites && operation === "local.value.put") {
      throw new Error("injected manual save failure");
    }
  });
});
