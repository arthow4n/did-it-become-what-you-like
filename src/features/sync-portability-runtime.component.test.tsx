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
import { withAriaGlobals } from "../test-support/component-harness.tsx";
import { createFakeSecretStoragePort } from "../test-support/fakes/ports.ts";

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
    const { Window } = await import("happy-dom");
    const bootstrapWindow = new Window({
      url: "http://component-bootstrap.test/",
    });
    const bootstrapGlobals: Record<string, unknown> = {
      window: bootstrapWindow,
      document: bootstrapWindow.document,
      navigator: bootstrapWindow.navigator,
      Document: bootstrapWindow.Document,
      Element: bootstrapWindow.Element,
      HTMLElement: bootstrapWindow.HTMLElement,
      Event: bootstrapWindow.Event,
      MouseEvent: bootstrapWindow.MouseEvent,
      KeyboardEvent: bootstrapWindow.KeyboardEvent,
      MutationObserver: bootstrapWindow.MutationObserver,
      Node: bootstrapWindow.Node,
      NodeFilter: bootstrapWindow.NodeFilter,
      ResizeObserver: bootstrapWindow.ResizeObserver,
      ShadowRoot: bootstrapWindow.ShadowRoot,
      SVGElement: bootstrapWindow.SVGElement,
      requestAnimationFrame: bootstrapWindow.requestAnimationFrame,
      cancelAnimationFrame: bootstrapWindow.cancelAnimationFrame,
      getComputedStyle: bootstrapWindow.getComputedStyle.bind(bootstrapWindow),
    };
    const previousBootstrapGlobals = new Map<PropertyKey, unknown>();
    const bootstrapGlobalRecord = globalThis as unknown as Record<
      string,
      unknown
    >;
    for (const [key, value] of Object.entries(bootstrapGlobals)) {
      previousBootstrapGlobals.set(key, bootstrapGlobalRecord[key]);
      Object.assign(globalThis, { [key]: value });
    }
    const { withComponentHarness } = await import(
      "../test-support/component-harness.tsx"
    );
    const { SyncPortabilityRuntime, deleteEverywhereProgressForDevices } =
      await import("./sync-portability-runtime.tsx");
    for (const [key, value] of previousBootstrapGlobals) {
      Object.assign(globalThis, { [key]: value });
    }
    bootstrapWindow.close();
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
