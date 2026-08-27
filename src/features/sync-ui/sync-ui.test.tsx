import { within } from "@testing-library/dom";
import { createElement } from "react";
import {
  GlobalStatus,
  GoogleDriveSyncScreen,
  isGlobalStatusActionable,
  KnownDeviceList,
  KnownDevicesScreen,
  type KnownDeviceViewModel,
  SyncAccountPanel,
  type SyncConnectionViewModel,
} from "./index.ts";
import { withComponentHarness } from "../../test-support/component-harness.tsx";

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
  callback: () => T | Promise<T>,
): Promise<T> {
  const testWindow =
    (globalThis as unknown as { window?: { [key: string]: unknown } }).window;
  if (!testWindow) return await callback();
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
  const previousCss = globalThis.CSS;
  for (const name of names) {
    previous.set(name, globalThis[name as keyof typeof globalThis]);
    Object.assign(globalThis, { [name]: testWindow[name] });
  }
  Object.assign(globalThis, {
    CSS: previousCss ?? {
      escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&"),
    },
  });
  try {
    return await callback();
  } finally {
    for (const [name, value] of previous) {
      Object.assign(globalThis, { [name]: value });
    }
    Object.assign(globalThis, { CSS: previousCss });
  }
}

const callbacks = () => {
  const events: string[] = [];
  return {
    events,
    onConnect: () => events.push("connect"),
    onReconnect: () => events.push("reconnect"),
    onRetry: () => events.push("retry"),
    onRecoverCorruptData: () => events.push("recover-corrupt-data"),
    onSyncNow: () => events.push("sync-now"),
    onOpenConflicts: () => events.push("conflicts"),
    onManageDevices: () => events.push("devices"),
    onSwitchAccount: () => events.push("switch"),
    onDisconnect: () => events.push("disconnect"),
    onConfirmAccountSwitch: () => events.push("confirm-switch"),
    onCancelAccountSwitch: () => events.push("cancel-switch"),
  };
};

const syncedView: SyncConnectionViewModel = {
  mode: "configured",
  accountEmail: "owner@example.com",
  network: "online",
  sync: "synced",
  lastSyncedAt: "2 minutes ago",
  pendingChangeCount: 0,
  unresolvedConflictCount: 0,
};

const device = (overrides: Partial<KnownDeviceViewModel> = {}) => ({
  stableKey: "device-key-current",
  label: "Stockholm phone",
  lastSeenAt: "now",
  current: true,
  retirementAcknowledgement: "not-requested" as const,
  ...overrides,
});

Deno.test("sync screen exposes disconnected connect and accessible back events", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      const result = callbacks();
      render(
        createElement(GoogleDriveSyncScreen, {
          view: { mode: "disconnected" },
          knownDeviceCount: 0,
          onConnect: result.onConnect,
          onBack: () => result.events.push("back"),
        }),
      );
      const view = within(document.body);
      assert(view.getByRole("heading", {
        name: "Google Drive and synchronization",
      }));
      assert(view.getByRole("button", { name: "Connect Google Drive" }));
      fireEvent.click(
        view.getByRole("button", { name: "Connect Google Drive" }),
      );
      fireEvent.click(view.getByRole("button", { name: "Back to settings" }));
      assert(result.events.join(",") === "connect,back");
      assert(view.getByText(/hidden application-data folder/));
    });
  });
});

Deno.test("sync screen exposes the connecting mode with labeled progress", async () => {
  await withComponentHarness(async ({ render }) => {
    await withAriaGlobals(() => {
      render(
        createElement(SyncAccountPanel, {
          view: { mode: "connecting" },
          knownDeviceCount: 0,
          onConnect: () => undefined,
        }),
      );
      const view = within(document.body);
      assert(view.getAllByText("Connecting to Google Drive").length === 2);
      assert(
        view.getByRole("progressbar", { name: "Connecting to Google Drive" }),
      );
    });
  });
});

Deno.test("sync screen exposes connected identity, sync summary, and navigation events", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      const result = callbacks();
      render(
        createElement(SyncAccountPanel, {
          view: syncedView,
          knownDeviceCount: 2,
          ...result,
        }),
      );
      const view = within(document.body);
      assert(view.getByText("owner@example.com"));
      assert(view.getByText("2 minutes ago"));
      assert(view.getByText("Pending local changes"));
      fireEvent.click(view.getByRole("button", { name: "Sync now" }));
      fireEvent.click(view.getByRole("button", { name: /Manage devices/ }));
      fireEvent.click(
        view.getByRole("button", { name: "Switch Google account" }),
      );
      fireEvent.click(
        view.getByRole("button", { name: "Disconnect this device" }),
      );
      assert(
        result.events.join(",") ===
          "sync-now,devices,switch,disconnect",
        "Connected actions should dispatch their callbacks",
      );
    });
  });
});

Deno.test("sync screen covers offline, reconnecting, and pending synchronization modes", async () => {
  await withComponentHarness(async ({ render }) => {
    await withAriaGlobals(() => {
      const offline: SyncConnectionViewModel = {
        ...syncedView,
        network: "offline",
        pendingChangeCount: 3,
      };
      render(
        createElement(SyncAccountPanel, {
          view: offline,
          knownDeviceCount: 1,
          onConnect: () => undefined,
          onSyncNow: () => undefined,
        }),
      );
      const view = within(document.body);
      assert(view.getAllByText("Offline").length === 2);
      assert(view.getByText("3"));
      const syncNow = view.getByRole("button", { name: "Sync now" });
      assert(syncNow.hasAttribute("disabled"));
      assert(view.getByText(/available when you are online/));
    });
  });

  await withComponentHarness(async ({ render }) => {
    await withAriaGlobals(() => {
      render(
        createElement(SyncAccountPanel, {
          view: { ...syncedView, network: "reconnecting" },
          knownDeviceCount: 1,
          onConnect: () => undefined,
          onSyncNow: () => undefined,
        }),
      );
      const view = within(document.body);
      assert(view.getAllByText("Reconnecting").length === 2);
      assert(
        view.getByRole("button", { name: "Sync now" }).hasAttribute("disabled"),
      );
    });
  });

  await withComponentHarness(async ({ render }) => {
    await withAriaGlobals(() => {
      render(
        createElement(SyncAccountPanel, {
          view: { ...syncedView, sync: "syncing", pendingChangeCount: 1 },
          knownDeviceCount: 1,
          onConnect: () => undefined,
          onSyncNow: () => undefined,
        }),
      );
      const view = within(document.body);
      const syncNow = view.getByRole("button", { name: "Sync now" });
      assert(syncNow.getAttribute("data-pending") === "true");
      assert(syncNow.hasAttribute("disabled"));
      assert(
        view.getByRole("progressbar", { name: "Synchronization in progress" }),
      );
    });
  });
});

Deno.test("sync screen covers authorization, retryable, generic error, retired, and conflict states", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      const result = callbacks();
      render(
        createElement(SyncAccountPanel, {
          view: {
            ...syncedView,
            sync: "authorization-error",
            message: "Authorization was revoked.",
          },
          knownDeviceCount: 1,
          ...result,
        }),
      );
      const view = within(document.body);
      fireEvent.click(
        view.getByRole("button", { name: "Reconnect Google Drive" }),
      );
      assert(view.getByRole("alert"));
      assert(result.events.includes("reconnect"));
    });
  });

  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      const result = callbacks();
      render(
        createElement(SyncAccountPanel, {
          view: { ...syncedView, sync: "retryable-error" },
          knownDeviceCount: 1,
          ...result,
        }),
      );
      const view = within(document.body);
      fireEvent.click(
        view.getByRole("button", { name: "Retry synchronization" }),
      );
      assert(result.events.includes("retry"));
    });
  });

  await withComponentHarness(async ({ render }) => {
    await withAriaGlobals(() => {
      render(
        createElement(SyncAccountPanel, {
          view: {
            ...syncedView,
            sync: "error",
            message: "Drive is unavailable.",
            diagnosticOperation: "drive.metadata",
          },
          knownDeviceCount: 1,
          onConnect: () => undefined,
        }),
      );
      const view = within(document.body);
      const alert = view.getByRole("alert");
      assert(alert.textContent?.includes("Drive is unavailable."));
      assert(alert.textContent?.includes("Diagnostic code: drive.metadata"));
    });
  });

  await withComponentHarness(async ({ render }) => {
    await withAriaGlobals(() => {
      render(
        createElement(SyncAccountPanel, {
          view: { ...syncedView, sync: "retired" },
          knownDeviceCount: 1,
          onConnect: () => undefined,
        }),
      );
      assert(
        within(document.body).getByRole("heading", {
          name: "This dataset is retired",
        }),
      );
      assert(
        within(document.body).getByRole("button", { name: "Sync now" })
          .hasAttribute("disabled"),
      );
    });
  });

  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      const result = callbacks();
      render(
        createElement(SyncAccountPanel, {
          view: {
            ...syncedView,
            sync: "conflict",
            unresolvedConflictCount: 2,
          },
          knownDeviceCount: 1,
          ...result,
        }),
      );
      const view = within(document.body);
      fireEvent.click(view.getByRole("button", { name: "Review conflicts" }));
      assert(result.events.includes("conflicts"));
      assert(view.getAllByText(/2 unresolved conflicts remain/).length === 2);
    });
  });
});

Deno.test("sync screen explains that reload requires a fresh authorization gesture", async () => {
  await withComponentHarness(async ({ render }) => {
    await withAriaGlobals(() => {
      render(
        createElement(SyncAccountPanel, {
          view: { ...syncedView, sync: "authorization-error" },
          knownDeviceCount: 1,
          onConnect: () => undefined,
          onReconnect: () => undefined,
        }),
      );
      assert(
        within(document.body).getByText(
          /Authorize Google Drive again on this page/,
        ),
      );
    });
  });
});

Deno.test(
  "sync screen exposes explicit corrupt-data recovery confirmation only for corrupt data",
  async () => {
    await withComponentHarness(async ({ render, fireEvent }) => {
      await withAriaGlobals(() => {
        const result = callbacks();
        render(
          createElement(SyncAccountPanel, {
            view: {
              ...syncedView,
              sync: "error",
              errorCode: "corrupt-data",
              recoveryAvailable: true,
            },
            knownDeviceCount: 1,
            ...result,
          }),
        );
        const view = within(document.body);
        fireEvent.click(
          view.getByRole("button", { name: "Reset hidden Drive sync file" }),
        );
        assert(
          view.getByRole("dialog").textContent?.includes(
            "deletes the malformed hidden cloud sync file",
          ),
        );
        assert(
          view.getByText(/local IndexedDB data/),
        );
        assert(view.getByText(/other devices may be lost/));
        fireEvent.click(
          view.getByRole("button", { name: "Delete remote sync file" }),
        );
        assert(result.events.includes("recover-corrupt-data"));
      });
    });

    await withComponentHarness(async ({ render }) => {
      await withAriaGlobals(() => {
        render(
          createElement(SyncAccountPanel, {
            view: {
              ...syncedView,
              sync: "error",
              errorCode: "invalid-request",
              recoveryAvailable: true,
            },
            knownDeviceCount: 1,
            onConnect: () => undefined,
          }),
        );
        assert(
          !within(document.body).queryByRole("button", {
            name: "Reset hidden Drive sync file",
          }),
        );
      });
    });
  },
);

Deno.test("sync account switch confirmation requires explicit confirm or cancel callbacks", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      const result = callbacks();
      render(
        createElement(SyncAccountPanel, {
          view: {
            mode: "account-switch-confirmation",
            currentAccountEmail: "old@example.com",
            requestedAccountEmail: "new@example.com",
          },
          knownDeviceCount: 1,
          ...result,
        }),
      );
      const view = within(document.body);
      fireEvent.click(view.getByRole("button", { name: "Switch account" }));
      fireEvent.click(view.getByRole("button", { name: "Cancel" }));
      assert(result.events.join(",") === "confirm-switch,cancel-switch");
    });
  });
});

Deno.test("sync GlobalStatus exposes compact labels and shell navigation", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let opened = false;
      render(
        createElement(GlobalStatus, {
          view: { ...syncedView, network: "offline", pendingChangeCount: 2 },
          onOpenSync: () => opened = true,
        }),
      );
      const view = within(document.body);
      assert(view.getByRole("status"));
      assert(view.getByText("Offline"));
      fireEvent.click(view.getByRole("button", {
        name: "Open synchronization details",
      }));
      assert(opened);
    });
  });
});

Deno.test("isGlobalStatusActionable identifies quiet steady-states and actionable events", () => {
  assert(
    !isGlobalStatusActionable({ mode: "disconnected" }),
    "Disconnected local use should remain quiet",
  );
  assert(
    !isGlobalStatusActionable({
      ...syncedView,
      lastSyncedAt: new Date().toISOString(),
      pendingChangeCount: 0,
      unresolvedConflictCount: 0,
    }),
    "Fresh synced steady-state should stay quiet",
  );
  assert(
    isGlobalStatusActionable({
      ...syncedView,
      pendingChangeCount: 3,
    }),
    "Pending changes require global banner",
  );
  assert(
    isGlobalStatusActionable({
      ...syncedView,
      lastSyncedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    }),
    "Stale sync (>24h) requires global banner",
  );
  assert(
    isGlobalStatusActionable({
      ...syncedView,
      sync: "authorization-error",
    }),
    "Authorization error requires global banner",
  );
  assert(
    isGlobalStatusActionable({
      ...syncedView,
      sync: "conflict",
    }),
    "Conflicts require global banner",
  );
  assert(
    isGlobalStatusActionable({
      ...syncedView,
      network: "offline",
    }),
    "Offline configured sync requires global banner",
  );
});

Deno.test("known devices render current, last-seen, retirement, rename, and acknowledge events", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      const renamed: string[] = [];
      const acknowledged: string[] = [];
      const current = device();
      const waiting = device({
        stableKey: "device-key-laptop",
        label: "Laptop",
        lastSeenAt: "2 days ago",
        current: false,
        retirementAcknowledgement: "pending",
      });
      render(
        createElement(KnownDeviceList, {
          devices: [current, waiting],
          onRename: (entry, label) => renamed.push(`${entry.label}:${label}`),
          onAcknowledgeRetirement: (entry) => acknowledged.push(entry.label),
        }),
      );
      const view = within(document.body);
      assert(view.getByRole("heading", { name: "Stockholm phone" }));
      assert(view.getByText("Current device"));
      assert(view.getByText("Seen 2 days ago"));
      fireEvent.click(
        view.getByRole("button", { name: "Acknowledge retirement" }),
      );
      fireEvent.click(
        view.getByRole("button", { name: "Rename Stockholm phone" }),
      );
      const input = view.getByRole("textbox", {
        name: "New label for Stockholm phone",
      });
      assert(input);
      fireEvent.change(input, { target: { value: "Travel phone" } });
      fireEvent.click(view.getByRole("button", { name: "Save name" }));
      assert(renamed.join(",") === "Stockholm phone:Travel phone");
      assert(acknowledged.join(",") === "Laptop");
    });
  });
});

Deno.test("known devices keep opaque IDs out of ordinary rendering and expose them only after disclosure", async () => {
  await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
    await withAriaGlobals(async () => {
      const opaqueId = "device-opaque-id-7f3a";
      const longLabel =
        "A very long device label that remains readable across narrow layouts without exposing its technical identifier";
      render(
        createElement(KnownDevicesScreen, {
          devices: [device({ label: longLabel })],
          technicalDetails: [{
            ...device({ label: longLabel }),
            id: opaqueId,
          }],
          onBack: () => undefined,
          onRename: () => undefined,
        }),
      );
      const view = within(document.body);
      assert(document.body.textContent?.includes(opaqueId) === false);
      assert(view.getByRole("button", { name: `Rename ${longLabel}` }));
      const detailsTrigger = view.getByRole("button", {
        name: "Show technical details",
      });
      fireEvent.click(detailsTrigger);
      await waitFor(() =>
        assert(view.getByText(`Technical device identifier: ${opaqueId}`))
      );
      assert(view.getByRole("button", {
        name: "Back to Google Drive synchronization",
      }));
    });
  });
});

Deno.test("known devices keep rename controls ordered after activation", async () => {
  await withComponentHarness(async ({ render }) => {
    await withAriaGlobals(() => {
      render(createElement(KnownDeviceList, { devices: [] }));
      const emptyView = within(document.body);
      assert(emptyView.getByRole("heading", { name: "No known devices" }));
    });
  });

  await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
    await withAriaGlobals(async () => {
      render(
        createElement(KnownDeviceList, {
          devices: [device()],
          onRename: () => undefined,
        }),
      );
      const view = within(document.body);
      const rename = view.getByRole("button", {
        name: "Rename Stockholm phone",
      });
      fireEvent.click(rename);
      await waitFor(() =>
        assert(
          view.getByRole("textbox", { name: "New label for Stockholm phone" }),
        )
      );
      const controls = Array.from(document.querySelectorAll("button, input"));
      const inputIndex = controls.indexOf(
        view.getByRole("textbox", { name: "New label for Stockholm phone" }),
      );
      assert(inputIndex >= 0, "Rename input must be keyboard reachable");
      assert(
        controls.slice(inputIndex).some((control) =>
          control.textContent?.includes("Save name")
        ),
        "Save name must follow the rename field in focus order",
      );
      fireEvent.click(view.getByRole("button", { name: "Cancel" }));
      assert(
        view.queryByRole("textbox", {
          name: "New label for Stockholm phone",
        }) === null,
      );
    });
  });
});
