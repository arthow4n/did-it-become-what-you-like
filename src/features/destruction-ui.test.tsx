import { within } from "@testing-library/dom";
import { createElement, useState } from "react";
import {
  DataPrivacyScreen,
  type DataPrivacyScreenProps,
} from "./destruction-ui.tsx";
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
  testWindow: {
    HTMLButtonElement: unknown;
    FocusEvent: unknown;
    HTMLInputElement: unknown;
    MutationObserver: unknown;
    NodeFilter: unknown;
    requestAnimationFrame: unknown;
    cancelAnimationFrame: unknown;
    HTMLSelectElement: unknown;
    SVGElement: unknown;
    HTMLTextAreaElement: unknown;
  },
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
  const previousCss = globalThis.CSS;
  const cssEscape = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  for (const name of names) {
    previous.set(name, globalThis[name as keyof typeof globalThis]);
    Object.assign(globalThis, { [name]: testWindow[name] });
  }
  Object.assign(globalThis, {
    CSS: previousCss ?? { escape: cssEscape },
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

function callbacks() {
  const events: string[] = [];
  return {
    events,
    onBack: () => events.push("back"),
    onDisconnect: () => events.push("disconnect"),
    onOpenLocalErase: () => events.push("open-local"),
    onLocalEraseChoice: (remove: boolean) => events.push(`choice:${remove}`),
    onConfirmLocalErase: () => events.push("confirm-local"),
    onRetryLocalErase: () => events.push("retry-local"),
    onCancelLocalErase: () => events.push("cancel-local"),
    onOpenDeleteEverywhere: () => events.push("open-everywhere"),
    onSafetyExport: () => events.push("export"),
    onDeclineSafetyExport: () => events.push("decline"),
    onConfirmDecline: () => events.push("confirm-decline"),
    onConfirmDeleteEverywhere: () => events.push("confirm-everywhere"),
    onForceFinalize: () => events.push("force"),
    onRetryDeleteEverywhere: () => events.push("retry-everywhere"),
    onRetryFinalization: () => events.push("retry-finalization"),
    onCancelDeleteEverywhere: () => events.push("cancel-everywhere"),
  };
}

function props(
  overrides: Partial<DataPrivacyScreenProps> = {},
): DataPrivacyScreenProps {
  const actions = callbacks();
  return {
    connected: true,
    localErase: {
      phase: "idle",
      removeGeminiApiKey: true,
    },
    deleteEverywhere: {
      phase: "idle",
      safetyExported: false,
      safetyDeclined: false,
      declineConfirmed: false,
      generation: 4,
      knownDeviceCount: 2,
      acknowledgedDeviceCount: 1,
      forcedDeviceCount: 0,
      revoking: false,
    },
    devices: [],
    ...actions,
    ...overrides,
  };
}

function LocalEraseFocusHarness() {
  const [open, setOpen] = useState(false);
  return createElement(
    DataPrivacyScreen,
    props({
      localErase: {
        phase: open ? "reviewing" : "idle",
        removeGeminiApiKey: false,
      },
      onOpenLocalErase: () => setOpen(true),
    }),
  );
}

Deno.test(
  "destructive-flow component separates keep-local, local-only, and everywhere scopes",
  async () => {
    await withComponentHarness(
      async ({ window, render, fireEvent, waitFor }) => {
        await withAriaGlobals(window, async () => {
          const result = callbacks();
          const mounted = render(
            createElement(
              DataPrivacyScreen,
              props({
                onLocalEraseChoice: result.onLocalEraseChoice,
              }),
            ),
          );
          const view = within(document.body);
          assert(view.getByRole("heading", { name: "Data and privacy" }));
          assert(view.getByRole("button", { name: "Disconnect this device" }));
          assert(
            view.getByRole("button", { name: "Delete this device's data" }),
          );
          assert(view.getByRole("button", { name: "Review deletion" }));
          assert(view.getByText(/Disconnect keeps both copies/));
          assert(view.getByText(/cannot be erased/));
          mounted.rerender(
            createElement(
              DataPrivacyScreen,
              props({
                localErase: {
                  phase: "reviewing",
                  removeGeminiApiKey: true,
                },
                onLocalEraseChoice: result.onLocalEraseChoice,
              }),
            ),
          );
          const checkbox = view.getByRole("checkbox", {
            name: "Remove Gemini API key from this device",
          });
          assert(
            (checkbox as HTMLInputElement).checked,
            "local erase must default to removing the Gemini key",
          );
          fireEvent.click(checkbox);
          assert(
            result.events.includes("choice:false"),
            "the persisted key choice must be wired to the checkbox",
          );
          await waitFor(() =>
            assert(view.getByRole("dialog", {
              name: "Delete this device's data?",
            }))
          );
        });
      },
    );
  },
);

Deno.test("destructive-flow component keeps focus in the local erase dialog", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaGlobals(window, async () => {
      render(createElement(LocalEraseFocusHarness));
      const view = within(document.body);
      fireEvent.click(
        view.getByRole("button", { name: "Delete this device's data" }),
      );
      const close = await waitFor(() =>
        view.getByRole("button", { name: "Close" })
      );
      await waitFor(() =>
        assert(
          document.activeElement === close,
          "dialog should focus its close action",
        )
      );
      const dialog = view.getByRole("dialog", {
        name: "Delete this device's data?",
      });
      const checkbox = view.getByRole("checkbox", {
        name: "Remove Gemini API key from this device",
      });
      assert(
        dialog.contains(close) && dialog.contains(checkbox) &&
          close.tabIndex === 0 && checkbox.tabIndex === 0,
        "destructive dialog focus targets must remain keyboard reachable inside the dialog",
      );
    });
  });
});

Deno.test("destructive-flow component requires the separate decline confirmation", async () => {
  await withComponentHarness(async ({ window, render, fireEvent }) => {
    await withAriaGlobals(window, () => {
      const result = callbacks();
      render(
        createElement(
          DataPrivacyScreen,
          props({
            deleteEverywhere: {
              phase: "confirming-decline",
              safetyExported: false,
              safetyDeclined: true,
              declineConfirmed: false,
              generation: 4,
              knownDeviceCount: 2,
              acknowledgedDeviceCount: 1,
              forcedDeviceCount: 0,
              revoking: false,
            },
            onConfirmDecline: result.onConfirmDecline,
          }),
        ),
      );
      const view = within(document.body);
      assert(view.getByText(/No recovery copy will be created/));
      assert(view.getByRole("button", {
        name: "Confirm intentional permanent deletion",
      }));
      assert(
        !view.queryByRole("button", { name: "Export complete safety copy" }),
      );
      fireEvent.click(view.getByRole("button", {
        name: "Confirm intentional permanent deletion",
      }));
      assert(result.events.join(",") === "confirm-decline");
    });
  });
});

Deno.test("destructive-flow component explains inaccessible devices and exposes per-device acknowledgement state", async () => {
  await withComponentHarness(async ({ window, render, fireEvent }) => {
    await withAriaGlobals(window, () => {
      const result = callbacks();
      render(
        createElement(
          DataPrivacyScreen,
          props({
            deleteEverywhere: {
              phase: "awaiting-devices",
              safetyExported: true,
              safetyDeclined: false,
              declineConfirmed: false,
              generation: 4,
              knownDeviceCount: 2,
              acknowledgedDeviceCount: 1,
              forcedDeviceCount: 0,
              revoking: false,
            },
            devices: [
              {
                stableKey: "current",
                label: "Current browser",
                lastSeenAt: "This device",
                current: true,
                acknowledged: true,
              },
              {
                stableKey: "lost",
                label: "Lost laptop",
                lastSeenAt: "Last seen yesterday",
                current: false,
                acknowledged: false,
              },
            ],
            onForceFinalize: result.onForceFinalize,
          }),
        ),
      );
      const view = within(document.body);
      assert(view.getByText(/cannot erase a device which never runs/));
      assert(view.getByText("Current browser"));
      assert(view.getByText("Lost laptop"));
      const acknowledgements = view.getByRole("list", {
        name: "Delete Everywhere device acknowledgements",
      });
      assert(within(acknowledgements).getByText("Acknowledged"));
      assert(within(acknowledgements).getByText("Waiting"));
      fireEvent.click(view.getByRole("button", {
        name: "Force finalization for devices that cannot reconnect",
      }));
      assert(result.events.join(",") === "force");
    });
  });
});

Deno.test("destructive-flow forced finalization exposes an explicit cancel action", async () => {
  await withComponentHarness(async ({ window, render, fireEvent }) => {
    await withAriaGlobals(window, () => {
      const result = callbacks();
      render(
        createElement(
          DataPrivacyScreen,
          props({
            deleteEverywhere: {
              phase: "forced-finalization",
              safetyExported: true,
              safetyDeclined: false,
              declineConfirmed: false,
              generation: 4,
              knownDeviceCount: 2,
              acknowledgedDeviceCount: 1,
              forcedDeviceCount: 1,
              revoking: false,
            },
            onConfirmDeleteEverywhere: result.onConfirmDeleteEverywhere,
            onCancelDeleteEverywhere: result.onCancelDeleteEverywhere,
          }),
        ),
      );
      const view = within(document.body);
      fireEvent.click(view.getByRole("button", {
        name: "Confirm forced finalization",
      }));
      fireEvent.click(view.getByRole("button", { name: "Cancel" }));
      assert(
        result.events.join(",") === "confirm-everywhere,cancel-everywhere",
        "forced finalization must expose both confirm and cancel callbacks",
      );
    });
  });
});

Deno.test("destructive-flow component exposes finalization failure and retry", async () => {
  await withComponentHarness(async ({ window, render, fireEvent }) => {
    await withAriaGlobals(window, () => {
      const result = callbacks();
      render(
        createElement(
          DataPrivacyScreen,
          props({
            deleteEverywhere: {
              phase: "completed",
              safetyExported: true,
              safetyDeclined: false,
              declineConfirmed: false,
              generation: 4,
              knownDeviceCount: 2,
              acknowledgedDeviceCount: 2,
              forcedDeviceCount: 0,
              error: "Do not reconnect this account until it is revoked.",
              revoking: false,
            },
            onRetryFinalization: result.onRetryFinalization,
          }),
        ),
      );
      const view = within(document.body);
      assert(view.getByText(/Do not reconnect this account/));
      fireEvent.click(view.getByRole("button", {
        name: "Retry authorization cleanup",
      }));
      assert(result.events.join(",") === "retry-finalization");
      assert(
        !view.queryByText("Dataset retirement completed"),
        "a revocation failure must not render a positive completion notice",
      );
    });
  });
});
