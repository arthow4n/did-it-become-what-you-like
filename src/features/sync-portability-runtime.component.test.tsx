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
  deleteEverywhereProgressForDevices,
  SyncPortabilityRuntime,
} from "./sync-portability-runtime.tsx";
import {
  withAriaGlobals,
  withComponentHarness,
} from "../test-support/component-harness.tsx";
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
  "sync runtime renders hydrated devices for Delete Everywhere gate progress",
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

    const drive: DriveAdapter = createFakeDrivePorts();
    await drive.authorize();
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
  },
);
