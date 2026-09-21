import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { createElement } from "react";
import { within } from "@testing-library/dom";
import type { DriveAdapter } from "../adapters/drive/index.ts";
import {
  deleteLocalRepositoryDatabase,
  openLocalRepository,
} from "../adapters/local/index.ts";
import { createInMemoryCausalSyncPort } from "../adapters/sync/causal.ts";
import { createDeviceRegistry } from "../adapters/sync/device-registry.ts";
import {
  AUTOMATIC_SYNC_STATE_KEY,
  deleteEverywhereProgressForDevices,
  SyncPortabilityRuntime,
} from "./sync-portability-runtime.tsx";
import {
  withAriaGlobals,
  withComponentHarness,
} from "../test-support/component-harness.tsx";
import { settle } from "../test-support/async.ts";
import {
  createFakeDrivePorts,
  createFakeSecretStoragePort,
} from "../test-support/fakes/ports.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test(
  "sync runtime renders devices and holds local changes during cooldown",
  async () => {
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
      now: () => new Date().toISOString(),
    });
    const seededRegistry = createDeviceRegistry({
      local: repository,
      deviceId: repository.deviceId,
      clock: { now: () => new Date().toISOString() },
    });
    await seededRegistry.hydrate();
    await seededRegistry.register("device-runtime-remote", "Travel phone");
    await seededRegistry.configureAccount("owner@example.test", true);

    const drive: DriveAdapter = createFakeDrivePorts();
    await drive.authorize();
    const causal = createInMemoryCausalSyncPort();
    let syncCompletions = 0;

    const boundaryKey = "__DID_IT_BECAME_WHAT_YOU_LIKE_SYNC_BOUNDARY__";
    const globalRecord = globalThis as unknown as Record<string, unknown>;
    const previousBoundary = globalRecord[boundaryKey];
    const previousAutomaticSyncState = globalThis.localStorage.getItem(
      AUTOMATIC_SYNC_STATE_KEY,
    );
    globalThis.localStorage.removeItem(AUTOMATIC_SYNC_STATE_KEY);
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
                  onSyncCompleted: () => {
                    syncCompletions += 1;
                  },
                  secretStorage: createFakeSecretStoragePort(),
                  children: createElement("span", null, "fallback"),
                }),
              );
              const view = within(document.body);
              await waitFor(() => {
                assert(view.getByRole("heading", { name: "Device 1" }));
                assert(view.getByRole("heading", { name: "Travel phone" }));
              });
              const deviceRows = within(
                view.getByRole("list", { name: "Known devices" }),
              ).getAllByRole("listitem");
              assert(deviceRows.length === 2);
              const progress = deleteEverywhereProgressForDevices(
                deviceRows.map((row) => ({
                  acknowledged: row.textContent?.includes(
                    "Retirement acknowledged",
                  ) === true,
                })),
              );
              assert(progress.knownDeviceCount === 2);
              assert(progress.acknowledgedDeviceCount === 1);
              await waitFor(() => assert(syncCompletions === 1));
              const beforeSync = syncCompletions;
              await repository.transaction(
                "readwrite",
                (transaction) =>
                  transaction.put("records", "project-auto-sync", {
                    schemaVersion: 1,
                    type: "project",
                    id: "project-auto-sync",
                    name: "Automatic sync",
                    defaultCurrency: "SEK",
                    archived: false,
                  }),
              );
              await settle();
              assert(syncCompletions === beforeSync);
              assert(
                !(await causal.read()).dataset.projects.some((project) =>
                  project.id === "project-auto-sync"
                ),
              );
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
      if (previousAutomaticSyncState === null) {
        globalThis.localStorage.removeItem(AUTOMATIC_SYNC_STATE_KEY);
      } else {
        globalThis.localStorage.setItem(
          AUTOMATIC_SYNC_STATE_KEY,
          previousAutomaticSyncState,
        );
      }
    }
  },
);
