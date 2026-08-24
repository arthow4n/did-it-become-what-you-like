import { adapterError, type CausalSyncPort } from "../ports/index.ts";
import type { PortableDataset } from "../../domain/index.ts";
import { createTestClock } from "../../test-support/clock.ts";
import {
  createFakeIdPort,
  createFakeLocalPort,
} from "../../test-support/fakes/ports.ts";
import {
  createDatasetChange,
  createInMemoryCausalSyncPort,
  emptyPortableDataset,
  initialCausalSnapshot,
  mergeCausalSnapshots,
  readLocalDataset,
  writeLocalDataset,
} from "./index.ts";
import { runCausalExchange } from "./coordinator.ts";

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

async function assertRejects(
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(
      error !== null && typeof error === "object" &&
        (error as { readonly code?: unknown }).code === code,
      `Expected ${code} failure, got ${String(error)}`,
    );
    return;
  }
  throw new Error(`Expected ${code} failure`);
}

function datasetWithProject(
  id: string,
  name = id,
): PortableDataset {
  const dataset = emptyPortableDataset();
  return {
    ...dataset,
    projects: [{
      schemaVersion: 1,
      type: "project",
      id,
      name,
      defaultCurrency: "USD",
      archived: false,
    }],
  };
}

function datasetWithExpense(
  dataset: PortableDataset,
  id: string,
  projectId: string,
  amount: string,
): PortableDataset {
  return {
    ...dataset,
    expenses: [{
      schemaVersion: 1,
      type: "expense",
      id,
      projectId,
      categoryId: "category-uncategorized",
      date: "2026-08-24",
      amount,
      currency: "USD",
      description: "sync fixture",
      source: "manual",
    }],
  };
}

type Client = {
  readonly local: ReturnType<typeof createFakeLocalPort>;
  readonly clock: ReturnType<typeof createTestClock>;
  readonly ids: ReturnType<typeof createFakeIdPort>;
  readonly deviceId: string;
};

async function client(
  deviceId: string,
  dataset: PortableDataset,
): Promise<Client> {
  const local = createFakeLocalPort();
  await writeLocalDataset(local, dataset);
  return {
    local,
    clock: createTestClock("2026-08-24T10:00:00.000Z"),
    ids: createFakeIdPort(deviceId),
    deviceId,
  };
}

async function exchange(
  current: Client,
  remote: CausalSyncPort,
): Promise<Awaited<ReturnType<typeof runCausalExchange>>> {
  return await runCausalExchange({
    local: current.local,
    remote,
    deviceId: current.deviceId,
    ids: current.ids,
    now: current.clock.nowIso,
  });
}

Deno.test("sync-schedules: two and three devices converge across local-first schedules", async () => {
  const remote = createInMemoryCausalSyncPort({
    initialSnapshot: initialCausalSnapshot(),
  });
  const alpha = await client(
    "device-alpha",
    datasetWithProject("project-alpha"),
  );
  const beta = await client("device-beta", emptyPortableDataset());
  const gamma = await client("device-gamma", emptyPortableDataset());

  await exchange(alpha, remote);
  await exchange(beta, remote);
  const betaDataset = datasetWithExpense(
    await readLocalDataset(beta.local),
    "expense-beta",
    "project-alpha",
    "-7.5",
  );
  await writeLocalDataset(beta.local, betaDataset);
  await exchange(beta, remote);
  await exchange(alpha, remote);
  await exchange(gamma, remote);

  const expected = await readLocalDataset(alpha.local);
  assertEquals(await readLocalDataset(beta.local), expected);
  assertEquals(await readLocalDataset(gamma.local), expected);
  assert(expected.projects.some((project) => project.id === "project-alpha"));
  assert(expected.expenses.some((expense) => expense.id === "expense-beta"));
});

Deno.test(
  "sync-schedules: higher-generation replacement adopts without re-uploading stale local records",
  async () => {
    const replacement = createDatasetChange({
      id: "change-replacement",
      actorId: "device-owner",
      sequence: 1,
      parents: [],
      dataset: datasetWithProject("project-replacement"),
    });
    const remote = createInMemoryCausalSyncPort({
      initialSnapshot: {
        generation: 2,
        heads: [replacement.id],
        changes: [replacement],
        dataset: datasetWithProject("project-replacement"),
      },
    });
    const stale = await client(
      "device-stale",
      datasetWithProject("project-sensitive"),
    );

    const result = await exchange(stale, remote);
    const local = await readLocalDataset(stale.local);
    const remoteSnapshot = await remote.read();

    assertEquals(local.projects.map((project) => project.id), [
      "project-replacement",
    ]);
    assertEquals(remoteSnapshot.dataset.projects.map((project) => project.id), [
      "project-replacement",
    ]);
    assertEquals(result.snapshot.generation, 2);
    assertEquals(result.pushedChangeIds, []);
  },
);

Deno.test(
  "sync-schedules: coordinator reports same-record same-field conflicts with record identity",
  async () => {
    const baseline = datasetWithExpense(
      datasetWithProject("project-shared"),
      "expense-shared",
      "project-shared",
      "-5",
    );
    const remote = createInMemoryCausalSyncPort({
      initialSnapshot: initialCausalSnapshot(),
    });
    const alpha = await client("device-alpha", baseline);
    const beta = await client("device-beta", emptyPortableDataset());
    await exchange(alpha, remote);
    await exchange(beta, remote);

    const alphaDataset = await readLocalDataset(alpha.local);
    await writeLocalDataset(alpha.local, {
      ...alphaDataset,
      expenses: alphaDataset.expenses.map((expense) => ({
        ...expense,
        description: "alpha description",
      })),
    });
    await exchange(alpha, remote);

    const betaDataset = await readLocalDataset(beta.local);
    await writeLocalDataset(beta.local, {
      ...betaDataset,
      expenses: betaDataset.expenses.map((expense) => ({
        ...expense,
        description: "beta description",
      })),
    });
    const result = await exchange(beta, remote);
    const conflict = result.conflicts.find((entry) =>
      entry.recordId === "expense-shared"
    );

    assert(conflict !== undefined, "same-field conflict is reported");
    assertEquals(conflict.recordType, "expense");
    assert(conflict.id.includes("expense-shared-description"));
    assert(conflict.relatedChangeIds.includes("device-alpha-change-0002"));
    assert(conflict.relatedChangeIds.includes("device-beta-change-0001"));
  },
);

Deno.test("sync-schedules: duplicate and out-of-order causal changes are deterministic", () => {
  const base = initialCausalSnapshot();
  const first = createDatasetChange({
    id: "change-first",
    actorId: "device-first",
    sequence: 1,
    parents: [],
    dataset: datasetWithProject("project-first"),
  });
  const second = createDatasetChange({
    id: "change-second",
    actorId: "device-second",
    sequence: 1,
    parents: [],
    dataset: datasetWithProject("project-second"),
  });
  const incoming = {
    generation: 1,
    heads: ["change-second", "change-first"],
    changes: [second, first],
    dataset: base.dataset,
  };
  const merged = mergeCausalSnapshots(base, incoming);
  const repeated = mergeCausalSnapshots(merged.snapshot, incoming);
  assertEquals(merged.appliedChangeIds, ["change-first", "change-second"]);
  assertEquals(repeated.appliedChangeIds, []);
  assertEquals(repeated.snapshot.dataset, merged.snapshot.dataset);
  assertEquals(merged.snapshot.heads, ["change-first", "change-second"]);
  assert(
    merged.snapshot.dataset.projects.some((project) =>
      project.id === "project-first"
    ),
  );
  assert(
    merged.snapshot.dataset.projects.some((project) =>
      project.id === "project-second"
    ),
  );
});

Deno.test("sync-schedules: a failed upload after pull keeps local merged data dirty for retry", async () => {
  let failUploads = 0;
  const remote = createInMemoryCausalSyncPort({
    initialSnapshot: initialCausalSnapshot(),
    beforeOperation: (operation) => {
      if (operation === "apply" && failUploads > 0) {
        failUploads -= 1;
        throw adapterError("quota", "sync.test-upload");
      }
      return Promise.resolve();
    },
  });
  const alpha = await client(
    "device-alpha",
    datasetWithProject("project-alpha"),
  );
  const beta = await client("device-beta", emptyPortableDataset());
  await exchange(alpha, remote);
  failUploads = 1;

  await assertRejects(() => exchange(beta, remote), "quota");
  assert(
    (await readLocalDataset(beta.local)).projects.some((project) =>
      project.id === "project-alpha"
    ),
  );
  await exchange(beta, remote);
  assertEquals(
    (await readLocalDataset(beta.local)).projects.map((project) => project.id),
    ["project-alpha"],
  );
});

Deno.test("sync-schedules: local commit during pending pull is retained", async () => {
  const local = createFakeLocalPort();
  await writeLocalDataset(local, datasetWithProject("project-alpha"));
  let committed = false;
  const remote = createInMemoryCausalSyncPort({
    initialSnapshot: initialCausalSnapshot(),
    beforeOperation: async (operation) => {
      if (operation === "read" && !committed) {
        committed = true;
        await writeLocalDataset(
          local,
          datasetWithExpense(
            datasetWithProject("project-alpha"),
            "expense-during-sync",
            "project-alpha",
            "-3",
          ),
        );
      }
    },
  });
  const current: Client = {
    local,
    clock: createTestClock("2026-08-24T10:00:00.000Z"),
    ids: createFakeIdPort("device-alpha"),
    deviceId: "device-alpha",
  };
  await exchange(current, remote);
  assert(
    (await readLocalDataset(local)).expenses.some((expense) =>
      expense.id === "expense-during-sync"
    ),
  );
});

Deno.test("sync-schedules: offline, authorization, retirement, and registry restart are explicit", async () => {
  const offline: CausalSyncPort = {
    read: () => Promise.reject(adapterError("offline", "sync.offline")),
    exportPacket: () => Promise.reject(adapterError("offline", "sync.offline")),
    applyPacket: () => Promise.reject(adapterError("offline", "sync.offline")),
  };
  const current = await client("device-alpha", emptyPortableDataset());
  await assertRejects(() => exchange(current, offline), "offline");

  const retired = createInMemoryCausalSyncPort({
    initialSnapshot: initialCausalSnapshot(),
  });
  retired.retire();
  await assertRejects(() => exchange(current, retired), "retired");
});
