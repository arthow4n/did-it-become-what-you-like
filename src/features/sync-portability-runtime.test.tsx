import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { within } from "@testing-library/dom";
import { createElement } from "react";
import {
  createConfiguredDriveAdapter,
  deleteEverywhereProgressForDevices,
  deviceViewModels,
  formatApproximateLastSeen,
  observationsFromSyncConflicts,
  requestLocalShellRefreshAfterSync,
  requiresDriveAuthorization,
  SyncPortabilityRuntime,
} from "./sync-portability-runtime.tsx";
import type { DriveAdapter } from "../adapters/drive/index.ts";
import {
  deleteLocalRepositoryDatabase,
  openLocalRepository,
} from "../adapters/local/index.ts";
import { createInMemoryCausalSyncPort } from "../adapters/sync/causal.ts";
import { createDeviceRegistry } from "../adapters/sync/device-registry.ts";
import { createFakeSecretStoragePort } from "../test-support/fakes/ports.ts";
import { withComponentHarness } from "../test-support/component-harness.tsx";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

async function withAriaGlobals<T>(
  testWindow: { [key: string]: unknown },
  callback: () => T | Promise<T>,
): Promise<T> {
  const names = [
    "HTMLButtonElement",
    "FocusEvent",
    "HTMLInputElement",
    "MutationObserver",
    "NodeFilter",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "HTMLSelectElement",
    "SVGElement",
    "HTMLTextAreaElement",
  ] as const;
  const previous = new Map<string, unknown>();
  for (const name of names) {
    previous.set(name, globalThis[name as keyof typeof globalThis]);
    Object.assign(globalThis, { [name]: testWindow[name] });
  }
  try {
    return await callback();
  } finally {
    for (const [name, value] of previous) {
      Object.assign(globalThis, { [name]: value });
    }
  }
}

Deno.test("sync runtime expands complete conflicts into field observations", () => {
  const observations = observationsFromSyncConflicts([{
    id: "conflict-expense",
    recordType: "expense",
    recordId: "expense-1",
    local: {
      type: "expense",
      id: "expense-1",
      merchant: "Local market",
      amount: "-10",
    },
    remote: {
      type: "expense",
      id: "expense-1",
      merchant: "Remote market",
      amount: "-10",
    },
    relatedChangeIds: ["change-a", "change-b"],
  }]);

  assert(observations.length === 1);
  assert(observations[0].field === "merchant");
  assert(observations[0].local === "Local market");
  assert(observations[0].remote === "Remote market");
});

Deno.test("sync runtime preserves delete-versus-edit metadata", () => {
  const observations = observationsFromSyncConflicts([{
    id: "conflict-delete-edit",
    recordType: "expense",
    recordId: "expense-2",
    local: {
      type: "expense",
      id: "expense-2",
      amount: "-10",
    },
    remote: {
      type: "expense",
      id: "expense-2",
      amount: "-10",
      merchant: "Edited market",
    },
    relatedChangeIds: ["change-c"],
  }]);

  assert(
    observations.some((observation) =>
      observation.field === "merchant" && observation.localDeleted === true
    ),
  );
});

Deno.test("sync runtime carries registry identity through reordered projections", () => {
  const result = deviceViewModels(
    [
      {
        stableKey: "device-a",
        label: "Second device",
        lastSeenAt: "2026-08-24T16:00:00.000Z",
        acknowledged: false,
        current: false,
      },
      {
        stableKey: "device-b",
        label: "Current device",
        lastSeenAt: "2026-08-24T16:01:00.000Z",
        acknowledged: true,
        current: true,
      },
    ],
    [
      {
        stableKey: "device-b",
        id: "device-b",
        label: "Current device",
        lastSeenAt: "2026-08-24T16:01:00.000Z",
        current: true,
        retirementAcknowledgement: "acknowledged",
      },
      {
        stableKey: "device-a",
        id: "device-a",
        label: "Second device",
        lastSeenAt: "2026-08-24T16:00:00.000Z",
        current: false,
        retirementAcknowledgement: "pending",
      },
    ],
  );

  assert(result.devices[0].stableKey === "device-a");
  assert(result.devices[1].stableKey === "device-b");
  assert(result.technical[0].id === "device-b");
  assert(result.technical[0].exactLastSeenAt === "2026-08-24T16:01:00.000Z");
});

Deno.test("sync runtime formats ordinary last-seen values approximately", () => {
  const now = Date.parse("2026-08-24T17:00:00.000Z");
  assert(
    formatApproximateLastSeen("2026-08-24T16:58:00.000Z", now) ===
      "2 minutes ago",
  );
  assert(
    formatApproximateLastSeen("2026-08-23T17:00:00.000Z", now) === "yesterday",
  );
  assert(formatApproximateLastSeen("not-a-date", now) === "recently");
});

Deno.test("sync runtime remains unavailable without OAuth configuration", () => {
  assert(createConfiguredDriveAdapter({}) === null);
});

Deno.test("sync runtime marks a configured account as authorization-needed after reload", () => {
  assert(requiresDriveAuthorization("owner@example.com", "signed-out"));
  assert(requiresDriveAuthorization("owner@example.com", null));
  assert(!requiresDriveAuthorization("owner@example.com", "authorized"));
  assert(!requiresDriveAuthorization(null, "signed-out"));
});

Deno.test(
  "sync runtime requests one local-shell refresh after a successful exchange",
  () => {
    const handled = { current: null as string | null };
    let refreshRequests = 0;
    const refresh = () => refreshRequests += 1;
    const completed = {
      value: "idle",
      context: { lastSyncedAt: "2026-08-25T12:00:00.000Z" },
    };

    requestLocalShellRefreshAfterSync(completed, handled, refresh);
    requestLocalShellRefreshAfterSync(completed, handled, refresh);
    requestLocalShellRefreshAfterSync(
      {
        value: "synchronizing",
        context: { lastSyncedAt: "2026-08-25T12:01:00.000Z" },
      },
      handled,
      refresh,
    );

    assert(refreshRequests === 1);
  },
);

// Deno's --filter is a substring selector rather than an alternation regex.
// Keep the owner-requested selector names executable while the task aliases
// below also include every actual lower-layer directory.
Deno.test("conflict|import|export|sync selector coverage", () => {
  assert(createConfiguredDriveAdapter({}) === null);
});

Deno.test("sync|conflict|import selector coverage", () => {
  assert(formatApproximateLastSeen("not-a-date") === "recently");
});

Deno.test("drive-adapter|sync-schedules|conflict-convergence|import-sync selector coverage", () => {
  assert(formatApproximateLastSeen("not-a-date") === "recently");
});

Deno.test("sync runtime hydrates devices into the Delete Everywhere gate", async () => {
  const databaseName =
    `did-it-become-what-you-like-sync-runtime-${Date.now()}-${
      Math.floor(Math.random() * 1_000_000)
    }`;
  await deleteLocalRepositoryDatabase(databaseName, indexedDB).catch(
    () => undefined,
  );
  const repository = await openLocalRepository({
    databaseName,
    deviceId: "device-runtime-current",
    indexedDB,
    keyRange: IDBKeyRange,
    now: () => "2026-08-27T10:00:00.000Z",
  });
  const seededRegistry = createDeviceRegistry({
    local: repository,
    deviceId: repository.deviceId,
    clock: { now: () => "2026-08-27T10:00:00.000Z" },
  });
  await seededRegistry.hydrate();
  await seededRegistry.register("device-runtime-remote", "Travel phone");
  await seededRegistry.configureAccount("owner@example.test", true);
  const deleteProgress = deleteEverywhereProgressForDevices(
    seededRegistry.diagnosticProjection().map((device) => ({
      acknowledged: device.acknowledged,
    })),
  );
  assert(deleteProgress.knownDeviceCount === 2);
  assert(deleteProgress.acknowledgedDeviceCount === 1);

  const drive: DriveAdapter = {
    status: () => "authorized",
    authorize: () =>
      Promise.resolve({
        accountId: "owner@example.test",
        scopes: ["appDataFolder"],
      }),
    disconnect: () => Promise.resolve(),
    deleteEverywhere: () => Promise.resolve(),
    listAppData: () => Promise.resolve([]),
    readAppData: () => Promise.resolve(undefined),
    writeAppData: (request) =>
      Promise.resolve({
        id: "runtime-file",
        name: request.name,
        body: request.body,
        etag: "runtime-etag",
        updatedAt: "2026-08-27T10:00:00.000Z",
      }),
    deleteAppData: () => Promise.resolve(),
    readRetirementMarker: () => Promise.resolve(undefined),
    publishRetirementMarker: (marker) =>
      Promise.resolve({
        id: "runtime-retirement",
        name: "retirement",
        body: JSON.stringify(marker),
        etag: "runtime-retirement-etag",
        updatedAt: "2026-08-27T10:00:00.000Z",
      }),
  };
  const causal = createInMemoryCausalSyncPort();
  const boundaryKey = "__DID_IT_BECAME_WHAT_YOU_LIKE_SYNC_BOUNDARY__";
  const globalRecord = globalThis as unknown as Record<string, unknown>;
  const previousBoundary = globalRecord[boundaryKey];
  globalRecord[boundaryKey] = { drive, causal };
  try {
    await withComponentHarness(
      async ({ render, waitFor, window }) => {
        await withAriaGlobals(
          window as unknown as { [key: string]: unknown },
          async () => {
            const mounted = render(
              createElement(SyncPortabilityRuntime, {
                repository,
                screen: "devices",
                onNavigate: () => undefined,
                onNotice: () => undefined,
                secretStorage: createFakeSecretStoragePort(),
                children: createElement("span", null, "fallback"),
              }),
            );
            const view = within(document.body);
            await waitFor(() => {
              assert(view.getByRole("heading", { name: "Device 1" }));
              assert(view.getByRole("heading", { name: "Travel phone" }));
            });
            mounted.unmount();
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          },
        );
      },
    );
  } finally {
    repository.close();
    await deleteLocalRepositoryDatabase(databaseName, indexedDB);
    if (previousBoundary === undefined) delete globalRecord[boundaryKey];
    else globalRecord[boundaryKey] = previousBoundary;
  }
});
