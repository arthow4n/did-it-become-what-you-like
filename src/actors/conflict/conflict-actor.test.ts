import { ConflictStore, createConflictActor } from "./index.ts";
import type {
  ConflictJsonObject,
  ConflictObservation,
} from "../../domain/conflict/index.ts";
import {
  createFakeIdPort,
  createFakeLocalPort,
} from "../../test-support/fakes/ports.ts";
import { createTestClock } from "../../test-support/clock.ts";

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

const expense: ConflictJsonObject = {
  schemaVersion: 1,
  type: "expense",
  id: "expense-1",
  projectId: "project-1",
  categoryId: "category-uncategorized",
  date: "2026-08-24",
  amount: "-10",
  currency: "SEK",
  description: "Lunch",
  source: "manual",
};

function observation(): ConflictObservation {
  return {
    conflictId: "change-a",
    recordType: "expense",
    recordId: "expense-1",
    field: "amount",
    local: "-10",
    remote: "-20",
    localRecord: expense,
    remoteRecord: { ...expense, amount: "-20" },
    baseRecord: expense,
    localRevision: {
      id: "revision-local",
      deviceId: "device-local",
      deviceLabel: "This phone",
      recordedAt: "2026-08-24T09:00:00.000Z",
      record: expense,
    },
    remoteRevision: {
      id: "revision-remote",
      deviceId: "device-remote",
      deviceLabel: "Other laptop",
      recordedAt: "2026-08-24T10:00:00.000Z",
      record: { ...expense, amount: "-20" },
    },
    relatedChangeIds: ["change-local", "change-remote"],
  };
}

function dependencies() {
  return {
    local: createFakeLocalPort(),
    deviceId: "device-owner",
    now: createTestClock("2026-08-24T12:00:00.000Z").nowIso,
    ids: createFakeIdPort("owner"),
  };
}

async function seed(
  local: ReturnType<typeof createFakeLocalPort>,
): Promise<void> {
  await local.transaction("readwrite", async (transaction) => {
    await transaction.put("records", "expense-1", expense);
  });
}

async function settle(
  actor: ReturnType<typeof createConflictActor>,
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  assert(actor.getSnapshot().status !== "error");
}

async function assertRejects(
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error !== null && typeof error === "object");
    assertEquals((error as { readonly code?: unknown }).code, code);
    return;
  }
  throw new Error(`Expected ${code} failure`);
}

Deno.test("conflict: local commit is authoritative and preserves every parent reference", async () => {
  const deps = dependencies();
  await seed(deps.local);
  const store = new ConflictStore(deps);
  await store.ingest([observation()]);
  const group = (await store.load()).state.groups[0];
  const result = await store.commit({
    groupId: group.id,
    request: { choice: "custom", value: "-30" },
  });
  assertEquals(result.alreadyResolved, false);
  assertEquals(result.record?.amount, "-30");
  assertEquals(result.resolutionRevision.parents, group.parentRevisionIds);
  const saved = await deps.local.query<ConflictJsonObject>("records", {});
  assertEquals(saved[0].value.amount, "-30");
  const metadata = await deps.local.query<ConflictJsonObject>(
    "sync-metadata",
    {},
  );
  assert(
    metadata.some((entry) => entry.key.includes(result.resolutionRevision.id)),
  );
  assertEquals((await store.load()).state.progress.unresolvedCount, 0);
});

Deno.test("conflict: failed local commit leaves the group and durable count untouched", async () => {
  const deps = dependencies();
  await seed(deps.local);
  const store = new ConflictStore(deps);
  await store.ingest([observation()]);
  const group = (await store.load()).state.groups[0];
  deps.local.failNext("quota");
  await assertRejects(
    () =>
      store.commit({
        groupId: group.id,
        request: { choice: "delete" },
      }),
    "quota",
  );
  const state = await store.load();
  assertEquals(state.state.groups.length, 1);
  assertEquals(state.state.progress.unresolvedCount, 1);
});

Deno.test("conflict: workflow selection and candidates survive reload while offline", async () => {
  const deps = dependencies();
  await seed(deps.local);
  const actor = createConflictActor(deps, { observations: [observation()] });
  actor.start();
  await settle(actor);
  assert(actor.getSnapshot().matches("reviewing"));
  const group = actor.getSnapshot().context.state.groups[0];
  actor.send({ type: "conflict.open", groupId: group.id });
  actor.send({
    type: "conflict.choose-candidate",
    candidateId: group.candidates[0].id,
  });
  await settle(actor);
  actor.stop();

  const reloaded = createConflictActor(deps);
  reloaded.start();
  await settle(reloaded);
  assert(reloaded.getSnapshot().matches("reviewing"));
  assertEquals(reloaded.getSnapshot().context.selection?.choice, "candidate");
  assertEquals(
    reloaded.getSnapshot().context.state.progress.unresolvedCount,
    1,
  );
  reloaded.stop();
});

Deno.test("conflict: actor failure enters retryable state without clearing unresolved work", async () => {
  const deps = dependencies();
  await seed(deps.local);
  const actor = createConflictActor(deps, { observations: [observation()] });
  actor.start();
  await settle(actor);
  const group = actor.getSnapshot().context.state.groups[0];
  actor.send({ type: "conflict.open", groupId: group.id });
  actor.send({ type: "conflict.choose-custom", value: "-40" });
  await settle(actor);
  deps.local.failNext("quota");
  actor.send({ type: "conflict.submit" });
  await settle(actor);
  assert(actor.getSnapshot().matches("failed"));
  actor.stop();
  const state = await new ConflictStore(deps).load();
  assertEquals(state.state.groups.length, 1);
  assertEquals(state.state.progress.unresolvedCount, 1);
});

Deno.test("conflict: resolved groups stay hidden after refresh and causal resync", async () => {
  const deps = dependencies();
  await seed(deps.local);
  const store = new ConflictStore(deps);
  await store.ingest([observation()]);
  const group = (await store.load()).state.groups[0];
  await store.commit({
    groupId: group.id,
    request: { choice: "candidate", candidateId: "change-a-remote" },
  });
  const resolved = (await store.load()).state;
  const afterRefresh = await store.ingest([observation()]);
  assertEquals(afterRefresh.groups.length, 0);
  assertEquals(afterRefresh.progress.phase, "resolved");
  const afterResync = await store.reconcile(resolved);
  assertEquals(afterResync.groups.length, 0);
  assertEquals(
    (await deps.local.query<ConflictJsonObject>("records", {}))[0].value.amount,
    "-20",
  );
});
