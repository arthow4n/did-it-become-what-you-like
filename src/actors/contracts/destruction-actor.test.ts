import { createActor } from "xstate";
import { adapterError } from "../../adapters/ports/index.ts";
import {
  createDeleteEverywhereMachine,
  createLocalEraseMachine,
  finalizeDeleteEverywhere,
  persistDeleteEverywhereSnapshot,
  persistLocalEraseSnapshot,
  recoverDeleteEverywhereSnapshot,
  recoverLocalEraseSnapshot,
} from "../destruction.ts";
import {
  type DestructionStorage,
  readLocalEraseProgress,
} from "../../domain/destruction.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function memoryStorage(): DestructionStorage & {
  readonly values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

async function settle(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

function deleteDependencies(options: {
  readonly calls: string[];
  readonly failDelete?: () => boolean;
}) {
  return {
    createSafetyExport: () => {
      options.calls.push("export");
      return Promise.resolve('{"safe":true}');
    },
    publishRetirement: () => {
      options.calls.push("publish-retirement");
      return Promise.resolve();
    },
    deleteDriveGeneration: () => {
      options.calls.push("delete-drive");
      if (options.failDelete?.()) {
        return Promise.reject(adapterError("unavailable", "test.delete"));
      }
      return Promise.resolve();
    },
    eraseLocalDataset: () => {
      options.calls.push("erase-local");
      return Promise.resolve();
    },
  };
}

Deno.test("delete-everywhere actor accepts safety export before retirement", async () => {
  const calls: string[] = [];
  const machine = createDeleteEverywhereMachine(deleteDependencies({ calls }));
  const actor = createActor(machine).start();
  actor.send({
    type: "delete-everywhere.open",
    generation: 4,
    progress: {
      knownDeviceCount: 1,
      acknowledgedDeviceCount: 1,
      forcedDeviceCount: 0,
    },
  });
  actor.send({ type: "delete-everywhere.export-safety" });
  await settle();
  assert(actor.getSnapshot().matches("confirming"));
  actor.send({ type: "delete-everywhere.confirm" });
  await settle();
  assert(actor.getSnapshot().matches("completed"));
  assert(
    JSON.stringify(calls) === JSON.stringify([
      "export",
      "publish-retirement",
      "delete-drive",
      "erase-local",
    ]),
  );
  actor.stop();
});

Deno.test("delete-everywhere actor requires a distinct second confirmation after export decline", async () => {
  const calls: string[] = [];
  const actor = createActor(
    createDeleteEverywhereMachine(deleteDependencies({ calls })),
  ).start();
  actor.send({
    type: "delete-everywhere.open",
    generation: 5,
    progress: {
      knownDeviceCount: 1,
      acknowledgedDeviceCount: 1,
      forcedDeviceCount: 0,
    },
  });
  actor.send({ type: "delete-everywhere.decline-safety-export" });
  actor.send({ type: "delete-everywhere.confirm" });
  assert(actor.getSnapshot().matches("confirmingDecline"));
  assert(calls.length === 0);
  actor.send({ type: "delete-everywhere.confirm-decline" });
  actor.send({ type: "delete-everywhere.confirm" });
  await settle();
  assert(actor.getSnapshot().matches("completed"));
  assert(!calls.includes("export"));
  actor.stop();
});

Deno.test("delete-everywhere reports a failed safety export before any retirement", async () => {
  const calls: string[] = [];
  const actor = createActor(
    createDeleteEverywhereMachine({
      ...deleteDependencies({ calls }),
      createSafetyExport: () =>
        Promise.reject(adapterError("unavailable", "test.safety-export")),
    }),
  ).start();
  actor.send({
    type: "delete-everywhere.open",
    generation: 51,
    progress: {
      knownDeviceCount: 1,
      acknowledgedDeviceCount: 1,
      forcedDeviceCount: 0,
    },
  });
  actor.send({ type: "delete-everywhere.export-safety" });
  await settle();
  assert(actor.getSnapshot().matches("failed"));
  assert(calls.length === 0, "failed export must precede retirement");
  actor.stop();
});

Deno.test("delete-everywhere actor keeps failed Drive deletion retryable without erasing local data", async () => {
  const calls: string[] = [];
  let fail = true;
  const actor = createActor(
    createDeleteEverywhereMachine(
      deleteDependencies({ calls, failDelete: () => fail }),
    ),
  ).start();
  actor.send({
    type: "delete-everywhere.open",
    generation: 6,
    progress: {
      knownDeviceCount: 1,
      acknowledgedDeviceCount: 1,
      forcedDeviceCount: 0,
    },
  });
  actor.send({ type: "delete-everywhere.decline-safety-export" });
  actor.send({ type: "delete-everywhere.confirm-decline" });
  actor.send({ type: "delete-everywhere.confirm" });
  await settle();
  assert(actor.getSnapshot().matches("failed"));
  assert(!calls.includes("erase-local"));
  fail = false;
  actor.send({ type: "delete-everywhere.retry" });
  await settle();
  assert(actor.getSnapshot().matches("completed"));
  actor.stop();
});

Deno.test("delete-everywhere actor tracks multiple acknowledgements and forced finalization honestly", async () => {
  const calls: string[] = [];
  const storage = memoryStorage();
  const actor = createActor(
    createDeleteEverywhereMachine(deleteDependencies({ calls })),
  ).start();
  actor.send({
    type: "delete-everywhere.open",
    generation: 8,
    progress: {
      knownDeviceCount: 3,
      acknowledgedDeviceCount: 1,
      forcedDeviceCount: 0,
    },
  });
  actor.send({ type: "delete-everywhere.decline-safety-export" });
  actor.send({ type: "delete-everywhere.confirm-decline" });
  actor.send({ type: "delete-everywhere.confirm" });
  await settle();
  assert(actor.getSnapshot().matches("awaitingDevices"));
  persistDeleteEverywhereSnapshot(
    actor.getSnapshot(),
    () => "2026-08-24T18:10:00.000Z",
    storage,
  );
  const saved = [...storage.values.values()][0] ?? "";
  assert(saved.includes('"phase":"awaiting-devices"'));
  assert(!saved.includes("expense"));
  actor.send({ type: "delete-everywhere.device-ack", count: 2 });
  actor.send({ type: "delete-everywhere.force-finalize" });
  assert(actor.getSnapshot().matches("forcedFinalization"));
  actor.send({ type: "delete-everywhere.confirm" });
  await settle();
  const output = actor.getSnapshot().output;
  assert(output?.status === "completed");
  assert(output.result.forcedDeviceCount === 1);
  actor.stop();
});

Deno.test("delete-everywhere actor has no financial payload or API key in persisted snapshot", () => {
  const actor = createActor(
    createDeleteEverywhereMachine(deleteDependencies({ calls: [] })),
  ).start();
  actor.send({
    type: "delete-everywhere.open",
    generation: 9,
    progress: {
      knownDeviceCount: 1,
      acknowledgedDeviceCount: 0,
      forcedDeviceCount: 0,
    },
  });
  const persisted = JSON.stringify(actor.getPersistedSnapshot());
  assert(!persisted.includes("AIza"));
  assert(!persisted.includes("expense-sensitive"));
  actor.stop();
});

Deno.test("delete-everywhere rehydrates redacted progress at the saved state", async () => {
  const calls: string[] = [];
  const machine = createDeleteEverywhereMachine(deleteDependencies({ calls }));
  const recovered = recoverDeleteEverywhereSnapshot(machine, {
    version: 1,
    generation: 10,
    phase: "awaiting-devices",
    safetyExported: false,
    safetyDeclined: true,
    declineConfirmed: true,
    knownDeviceCount: 3,
    acknowledgedDeviceCount: 1,
    forcedDeviceCount: 0,
    updatedAt: "2026-08-24T18:20:00.000Z",
  });
  const actor = createActor(machine, { snapshot: recovered }).start();
  await settle();
  assert(actor.getSnapshot().matches("awaitingDevices"));
  assert(actor.getSnapshot().context.generation === 10);
  assert(calls.length === 0);
  actor.stop();
});

Deno.test("delete-everywhere marks an interrupted invocation for safe reinitialize", async () => {
  const calls: string[] = [];
  const machine = createDeleteEverywhereMachine(deleteDependencies({ calls }));
  const recovered = recoverDeleteEverywhereSnapshot(machine, {
    version: 1,
    generation: 11,
    phase: "deleting-drive",
    safetyExported: true,
    safetyDeclined: false,
    declineConfirmed: false,
    knownDeviceCount: 1,
    acknowledgedDeviceCount: 1,
    forcedDeviceCount: 0,
    updatedAt: "2026-08-24T18:21:00.000Z",
  });
  const actor = createActor(machine, { snapshot: recovered }).start();
  await settle();
  assert(actor.getSnapshot().matches("idle"));
  assert(
    calls.length === 0,
    "custom progress must not invent invocation children",
  );
  actor.stop();
});

Deno.test("local erase actor persists choice before erasure and removes the key only when checked", async () => {
  const checkedCalls: string[] = [];
  const checked = createActor(createLocalEraseMachine({
    persistChoice: (value) => {
      checkedCalls.push(`choice:${value}`);
    },
    eraseLocalDataset: () => {
      checkedCalls.push("erase");
      return Promise.resolve();
    },
    removeGeminiApiKey: () => {
      checkedCalls.push("key");
      return Promise.resolve();
    },
  })).start();
  checked.send({ type: "local-erase.open", removeGeminiApiKey: true });
  checked.send({ type: "local-erase.confirm" });
  await settle();
  assert(
    JSON.stringify(checkedCalls) === JSON.stringify([
      "choice:true",
      "erase",
      "key",
    ]),
  );
  checked.stop();

  const uncheckedCalls: string[] = [];
  const unchecked = createActor(createLocalEraseMachine({
    persistChoice: (value) => {
      uncheckedCalls.push(`choice:${value}`);
    },
    eraseLocalDataset: () => {
      uncheckedCalls.push("erase");
      return Promise.resolve();
    },
    removeGeminiApiKey: () => {
      uncheckedCalls.push("key");
      return Promise.resolve();
    },
  })).start();
  unchecked.send({ type: "local-erase.open", removeGeminiApiKey: false });
  unchecked.send({ type: "local-erase.confirm" });
  await settle();
  assert(
    JSON.stringify(uncheckedCalls) === JSON.stringify([
      "choice:false",
      "erase",
    ]),
  );
  unchecked.stop();
});

Deno.test("local erase actor retries a local failure and supports reload-safe choice", async () => {
  const storage = memoryStorage();
  let fail = true;
  const actor = createActor(createLocalEraseMachine({
    storage,
    eraseLocalDataset: () => {
      if (fail) {
        return Promise.reject(adapterError("unavailable", "test.local-erase"));
      }
      return Promise.resolve();
    },
    removeGeminiApiKey: () => Promise.resolve(),
  })).start();
  actor.send({ type: "local-erase.open", removeGeminiApiKey: false });
  actor.send({ type: "local-erase.confirm" });
  await settle();
  assert(actor.getSnapshot().matches("failed"));
  assert(JSON.stringify([...storage.values.values()]).includes("false"));
  fail = false;
  actor.send({ type: "local-erase.retry" });
  await settle();
  assert(actor.getSnapshot().matches("completed"));
  actor.stop();
});

Deno.test(
  "local erase persists the key-removal phase before a crash and resumes it",
  async () => {
    const storage = memoryStorage();
    const calls: string[] = [];
    let releaseKey: (() => void) | undefined;
    const pendingKey = new Promise<void>((resolve) => {
      releaseKey = resolve;
    });
    const firstMachine = createLocalEraseMachine({
      storage,
      now: () => "2026-08-24T18:40:00.000Z",
      eraseLocalDataset: () => {
        calls.push("erase");
        return Promise.resolve();
      },
      removeGeminiApiKey: () => {
        calls.push("key");
        return pendingKey;
      },
    });
    const first = createActor(firstMachine).start();
    first.send({ type: "local-erase.open", removeGeminiApiKey: true });
    first.send({ type: "local-erase.confirm" });
    await settle();
    const saved = readLocalEraseProgress(storage);
    assert(saved?.phase === "removing-key");
    assert(saved.removeGeminiApiKey);
    assert(JSON.stringify(calls) === JSON.stringify(["erase", "key"]));

    // A stopped actor represents a browser crash while the idempotent key
    // removal is still in flight. The durable record is the recovery input.
    first.stop();
    releaseKey?.();

    const restartCalls: string[] = [];
    const restartedMachine = createLocalEraseMachine({
      storage,
      now: () => "2026-08-24T18:41:00.000Z",
      eraseLocalDataset: () => {
        restartCalls.push("erase");
        return Promise.resolve();
      },
      removeGeminiApiKey: () => {
        restartCalls.push("key");
        return Promise.resolve();
      },
    });
    const recovered = recoverLocalEraseSnapshot(
      restartedMachine,
      saved,
    );
    const restarted = createActor(restartedMachine, { snapshot: recovered })
      .start();
    await settle();
    assert(restarted.getSnapshot().matches("failed"));
    assert(restartCalls.length === 0);
    restarted.send({ type: "local-erase.retry" });
    await settle();
    assert(restarted.getSnapshot().matches("completed"));
    assert(
      JSON.stringify(restartCalls) === JSON.stringify(["key"]),
      "recovery from removing-key must not repeat database erasure",
    );
    persistLocalEraseSnapshot(
      restarted.getSnapshot(),
      () => "2026-08-24T18:42:00.000Z",
      storage,
    );
    assert(readLocalEraseProgress(storage) === undefined);
    restarted.stop();
  },
);

Deno.test("local erase retries only the failed key removal after reload-safe failure", async () => {
  const storage = memoryStorage();
  let fail = true;
  const calls: string[] = [];
  const actor = createActor(createLocalEraseMachine({
    storage,
    now: () => "2026-08-24T18:45:00.000Z",
    eraseLocalDataset: () => {
      calls.push("erase");
      return Promise.resolve();
    },
    removeGeminiApiKey: () => {
      calls.push("key");
      return fail
        ? Promise.reject(adapterError("unavailable", "test.key-remove"))
        : Promise.resolve();
    },
  })).start();
  actor.send({ type: "local-erase.open", removeGeminiApiKey: true });
  actor.send({ type: "local-erase.confirm" });
  await settle();
  assert(actor.getSnapshot().matches("failed"));
  assert(readLocalEraseProgress(storage)?.failureOperation === "remove-key");
  fail = false;
  actor.send({ type: "local-erase.retry" });
  await settle();
  assert(actor.getSnapshot().matches("completed"));
  assert(JSON.stringify(calls) === JSON.stringify(["erase", "key", "key"]));
  persistLocalEraseSnapshot(
    actor.getSnapshot(),
    () => "2026-08-24T18:46:00.000Z",
    storage,
  );
  assert(readLocalEraseProgress(storage) === undefined);
  actor.stop();
});

Deno.test("delete-everywhere revokes authorization only after acknowledgements or forced finalization", async () => {
  const storage = memoryStorage();
  const order: string[] = [];
  await finalizeDeleteEverywhere({
    disconnect: () => {
      order.push("revoke");
      return Promise.resolve();
    },
  }, {
    knownDeviceCount: 2,
    acknowledgedDeviceCount: 1,
    forcedDeviceCount: 1,
  }, storage);
  assert(order[0] === "revoke");
  assert(
    !storage.values.has(
      "did-it-become-what-you-like:delete-everywhere-progress",
    ),
  );
});
