import {
  adapterError,
  type CausalSyncPort,
} from "../../adapters/ports/index.ts";
import {
  CAUSAL_STATE_KEY,
  createInMemoryCausalSyncPort,
  initialCausalSnapshot,
} from "../../adapters/sync/index.ts";
import {
  createFakeCausalSyncPort,
  createFakeIdPort,
  createFakeLocalPort,
} from "../../test-support/fakes/ports.ts";
import {
  createDefaultSyncDependencies,
  createSyncActor,
  hydrateSyncDependencies,
} from "./index.ts";

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

async function waitFor(
  predicate: () => boolean,
  message: string,
): Promise<void> {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error(message);
}

function failingPort(
  code: "offline" | "unauthorized" | "quota" | "retired",
): CausalSyncPort {
  const fail = (): Promise<never> =>
    Promise.reject(adapterError(code, `sync.test-${code}`));
  return {
    read: fail,
    exportPacket: fail,
    applyPacket: fail,
  };
}

function dependencies(
  causal: CausalSyncPort = createInMemoryCausalSyncPort({
    initialSnapshot: initialCausalSnapshot(),
  }),
  deviceId = "device-actor",
  local = createFakeLocalPort(),
) {
  return createDefaultSyncDependencies({
    local,
    causal,
    deviceId,
    ids: createFakeIdPort(deviceId),
    clock: {
      now: () => "2026-08-24T10:00:00.000Z",
    },
  });
}

async function configuredActor(
  causal?: CausalSyncPort,
  deviceId = "device-actor",
  local = createFakeLocalPort(),
) {
  const actor = createSyncActor(dependencies(causal, deviceId, local)).start();
  await waitFor(
    () => actor.getSnapshot().value === "unconfigured",
    "sync actor did not hydrate",
  );
  actor.send({
    type: "sync.configure",
    accountEmail: "owner@example.test",
    online: true,
  });
  await waitFor(
    () => actor.getSnapshot().value === "idle",
    "sync actor did not configure",
  );
  return actor;
}

Deno.test("sync-actor: explicit configure/connect/request/reconnect/disconnect modes are local-first", async () => {
  const actor = await configuredActor();
  actor.send({ type: "sync.network.offline" });
  assertEquals(actor.getSnapshot().value, "offline");
  actor.send({ type: "sync.request", request: { reason: "local-change" } });
  assertEquals(actor.getSnapshot().value, "offline");
  actor.send({ type: "sync.connect" });
  assertEquals(actor.getSnapshot().value, "idle");
  actor.send({ type: "sync.reconnect" });
  await waitFor(
    () => actor.getSnapshot().value === "idle",
    "sync reconnect did not complete",
  );
  actor.send({ type: "sync.disconnect" });
  assertEquals(actor.getSnapshot().value, "unconfigured");
  actor.stop();
});

Deno.test("sync-actor: account switch is confirmed and restart hydration restores durable snapshot", async () => {
  const actor = await configuredActor();
  actor.send({
    type: "sync.configure",
    accountEmail: "other@example.test",
    online: true,
  });
  await waitFor(
    () => actor.getSnapshot().value === "accountSwitchConfirmation",
    "account switch did not require confirmation",
  );
  actor.send({ type: "sync.account.confirm" });
  await waitFor(
    () =>
      actor.getSnapshot().value === "idle" &&
      actor.getSnapshot().context.accountEmail === "other@example.test",
    "confirmed account switch did not complete",
  );

  const persisted = actor.getPersistedSnapshot();
  const replacement = dependencies();
  await hydrateSyncDependencies(replacement);
  const restarted = createSyncActor(replacement, persisted).start();
  assertEquals(restarted.getSnapshot().value, "idle");
  assertEquals(
    restarted.getSnapshot().context.accountEmail,
    "other@example.test",
  );
  actor.stop();
  restarted.stop();
});

Deno.test("sync-actor: offline, token expiry, quota, and retirement failures stay honest", async () => {
  const offline = await configuredActor(failingPort("offline"));
  offline.send({ type: "sync.request", request: { reason: "manual" } });
  await waitFor(
    () => offline.getSnapshot().value === "retryableError",
    "offline failure was not retryable",
  );
  assert(offline.getSnapshot().hasTag("retryable"));
  offline.stop();

  const unauthorized = await configuredActor(failingPort("unauthorized"));
  unauthorized.send({ type: "sync.request", request: { reason: "manual" } });
  await waitFor(
    () => unauthorized.getSnapshot().value === "error",
    "token expiry did not become an authorization error",
  );
  assert(!unauthorized.getSnapshot().can({ type: "sync.retry" }));
  unauthorized.stop();

  const quota = await configuredActor(failingPort("quota"));
  quota.send({ type: "sync.request", request: { reason: "manual" } });
  await waitFor(
    () => quota.getSnapshot().value === "retryableError",
    "quota failure was not retryable",
  );
  quota.stop();

  const retired = await configuredActor(failingPort("retired"));
  retired.send({ type: "sync.request", request: { reason: "manual" } });
  await waitFor(
    () =>
      retired.getSnapshot().value === "retired" &&
      retired.getSnapshot().status === "done",
    "retirement did not become terminal",
  );
  assertEquals(retired.getSnapshot().output, { status: "retired" });
  retired.send({ type: "sync.reconnect" });
  assertEquals(retired.getSnapshot().value, "retired");
  retired.stop();
});

Deno.test(
  "sync-actor: generic sync failure retries online without dropping the pending request",
  async () => {
    const causal = createFakeCausalSyncPort(initialCausalSnapshot());
    causal.failNext("invalid-request");
    const actor = await configuredActor(causal);
    const request = { reason: "local-change" as const };

    actor.send({ type: "sync.request", request });
    await waitFor(
      () => actor.getSnapshot().value === "error",
      "generic sync failure did not enter the error state",
    );

    assertEquals(actor.getSnapshot().context.error, {
      code: "invalid-request",
      message: "The request was invalid.",
      retryable: false,
    });
    assert(!actor.getSnapshot().hasTag("retryable"));
    assert(actor.getSnapshot().can({ type: "sync.retry" }));
    assertEquals(actor.getSnapshot().context.pendingRequest, request);

    actor.send({ type: "sync.retry" });
    assertEquals(actor.getSnapshot().value, "synchronizing");
    assertEquals(actor.getSnapshot().context.pendingRequest, request);
    await waitFor(
      () => actor.getSnapshot().value === "idle",
      "generic sync failure retry did not complete online",
    );
    assertEquals(actor.getSnapshot().context.pendingRequest, null);
    assertEquals(actor.getSnapshot().context.error, null);
    actor.stop();
  },
);

Deno.test(
  "sync-actor: explicit corrupt-data recovery resets the remote file before syncing",
  async () => {
    const causal = createFakeCausalSyncPort(initialCausalSnapshot());
    const local = createFakeLocalPort();
    await local.transaction(
      "readwrite",
      (transaction) =>
        transaction.put("sync-metadata", CAUSAL_STATE_KEY, {
          type: "s402-causal-state",
          version: 1,
          snapshot: "not-a-snapshot",
        }),
    );
    const actor = await configuredActor(causal, "device-actor", local);

    actor.send({ type: "sync.request", request: { reason: "manual" } });
    await waitFor(
      () => actor.getSnapshot().value === "error",
      "corrupt data did not enter the error state",
    );
    assertEquals(actor.getSnapshot().context.error?.code, "corrupt-data");
    assert(actor.getSnapshot().can({ type: "sync.recover-corrupt-data" }));

    actor.send({ type: "sync.recover-corrupt-data" });
    await waitFor(
      () => actor.getSnapshot().value === "idle",
      "explicit recovery did not reset and resynchronize",
    );
    assertEquals(causal.resetCount, 1);
    assertEquals(actor.getSnapshot().context.error, null);
    actor.stop();
  },
);

Deno.test(
  "sync-actor: ordinary failures never invoke corrupt-data recovery",
  async () => {
    const causal = createFakeCausalSyncPort(initialCausalSnapshot());
    causal.failNext("quota");
    const actor = await configuredActor(causal);

    actor.send({ type: "sync.request", request: { reason: "manual" } });
    await waitFor(
      () => actor.getSnapshot().value === "retryableError",
      "quota failure did not enter retryable state",
    );
    actor.send({ type: "sync.recover-corrupt-data" });
    assertEquals(actor.getSnapshot().value, "retryableError");
    assertEquals(causal.resetCount, 0);
    actor.stop();
  },
);

Deno.test(
  "sync-actor: generic error retry stays offline when the actor is offline",
  async () => {
    const actor = createSyncActor({
      ...dependencies(),
      initialNetwork: "offline",
    }).start();
    await waitFor(
      () => actor.getSnapshot().value === "unconfigured",
      "offline sync actor did not hydrate",
    );

    actor.send({
      type: "sync.configure",
      accountEmail: "",
      online: false,
    });
    await waitFor(
      () => actor.getSnapshot().value === "error",
      "offline configuration failure did not enter the error state",
    );
    assertEquals(actor.getSnapshot().context.online, false);
    assertEquals(actor.getSnapshot().context.error?.retryable, false);

    actor.send({ type: "sync.retry" });
    assertEquals(actor.getSnapshot().value, "offline");
    assertEquals(actor.getSnapshot().context.online, false);
    assertEquals(actor.getSnapshot().context.error?.code, "invalid-request");
    actor.stop();
  },
);

Deno.test("sync-actor: concurrent triggers coalesce into a second causal exchange", async () => {
  let readCount = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => release = resolve);
  const causal = createInMemoryCausalSyncPort({
    initialSnapshot: initialCausalSnapshot(),
    beforeOperation: async (operation) => {
      if (operation === "read") {
        readCount += 1;
        if (readCount === 1) await gate;
      }
    },
  });
  const actor = await configuredActor(causal);
  actor.send({ type: "sync.request", request: { reason: "manual" } });
  await waitFor(
    () => actor.getSnapshot().value === "synchronizing",
    "sync request did not start",
  );
  actor.send({ type: "sync.request", request: { reason: "local-change" } });
  release();
  await waitFor(
    () => actor.getSnapshot().value === "idle",
    "coalesced sync did not settle",
  );
  assertEquals(readCount, 2);
  actor.stop();
});

Deno.test("sync-actor: known devices travel through causal data without entering ordinary projections", async () => {
  const causal = createInMemoryCausalSyncPort({
    initialSnapshot: initialCausalSnapshot(),
  });
  const first = await configuredActor(causal);
  first.send({ type: "sync.request", request: { reason: "manual" } });
  await waitFor(
    () =>
      first.getSnapshot().value === "idle" &&
      first.getSnapshot().context.lastSyncedAt !== null,
    "first device did not sync",
  );

  const second = await configuredActor(causal, "device-second");
  second.send({ type: "sync.request", request: { reason: "manual" } });
  await waitFor(
    () =>
      second.getSnapshot().value === "idle" &&
      second.getSnapshot().context.knownDevices.length === 2,
    "second device did not hydrate the known-device registry",
  );
  assert(
    second.getSnapshot().context.knownDevices.every((device) =>
      !("id" in device)
    ),
  );
  assert(
    !JSON.stringify(second.getSnapshot().context.knownDevices).includes(
      "device-actor",
    ),
  );
  first.stop();
  second.stop();
});
