import { within } from "@testing-library/dom";
import { createElement } from "react";
import { AboutScreen, PreferencesScreen, PwaRuntime } from "./settings-pwa.tsx";
import {
  createFakeLocalPort,
  createFakeUpdateInstallPort,
} from "../test-support/fakes/ports.ts";
import { withComponentHarness } from "../test-support/component-harness.tsx";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

async function withAriaDomGlobals<T>(
  testWindow: {
    HTMLButtonElement: unknown;
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

Deno.test("settings-final preference screen shows a live day-boundary example", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const local = createFakeLocalPort();
      let savedBoundary = "";
      render(
        createElement(PreferencesScreen, {
          local,
          onClose: () => undefined,
          onSaved: (boundary) => savedBoundary = boundary,
        }),
      );
      const view = within(document.body);
      await waitFor(() => {
        const input = view.getByLabelText("Expense-day boundary");
        if ((input as HTMLInputElement).value !== "03:00") {
          throw new Error("default boundary has not loaded");
        }
      });
      assert(view.getByRole("heading", { name: "Preferences" }));
      assert(view.getByText(/Suggested date:/));
      const input = view.getByLabelText("Expense-day boundary");
      fireEvent.change(input, { target: { value: "04:30" } });
      fireEvent.click(view.getByRole("button", { name: "Save preferences" }));
      await waitFor(() => {
        if (savedBoundary !== "04:30") throw new Error("boundary not saved");
      });
      assert(local.operations.includes("put:records:settings-portable"));
    });
  });
});

Deno.test("settings-final preferences discard restores the saved boundary", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const local = createFakeLocalPort();
      let discardCount = 0;
      let dirty = false;
      const renderPreferences = (discardRequest: number) =>
        createElement(PreferencesScreen, {
          local,
          onClose: () => undefined,
          onDirtyChange: (value) => dirty = value,
          discardRequest,
          onDiscarded: () => discardCount++,
        });
      const mounted = render(renderPreferences(0));
      const view = within(document.body);
      await waitFor(() => {
        if (
          (view.getByLabelText("Expense-day boundary") as HTMLInputElement)
            .value !== "03:00"
        ) {
          throw new Error("default boundary has not loaded");
        }
      });
      const input = view.getByLabelText("Expense-day boundary");
      fireEvent.change(input, { target: { value: "04:30" } });
      await waitFor(() =>
        assert(dirty, "changing the boundary should be dirty")
      );

      mounted.rerender(renderPreferences(1));
      await waitFor(() => {
        assert(discardCount === 1, "discard should notify the host once");
        assert(!dirty, "discard should clear the shared dirty state");
        assert(
          (view.getByLabelText("Expense-day boundary") as HTMLInputElement)
            .value === "03:00",
          "discard should restore the saved boundary",
        );
      });
      assert(
        !local.operations.some((operation) => operation.startsWith("put:")),
        "discard should not persist the unsaved boundary",
      );
      mounted.unmount();
    });
  });
});

Deno.test("settings-final About exposes exact disclosure and build metadata", async () => {
  await withComponentHarness(({ render }) => {
    render(
      createElement(AboutScreen, {
        onClose: () => undefined,
        onPrivacy: () => undefined,
      }),
    );
    const view = within(document.body);
    assert(view.getByText("0.1.0"));
    assert(view.getByText("development"));
    assert(
      view.getByText(
        "This application is 100% vibe-coded using ChatGPT Codex and Google Antigravity.",
      ),
    );
    assert(view.getByRole("link", { name: "View source on GitHub" }));
    const license = view.getByRole("link", {
      name: "Application license (MIT)",
    });
    assert(
      license.getAttribute("href") ===
        "https://github.com/arthow4n/did-it-become-what-you-like/blob/master/LICENSE",
      "About must link directly to the repository license",
    );
    const notices = view.getByRole("link", {
      name: "Third-party licenses and notices",
    });
    assert(
      notices.getAttribute("href") ===
        "https://github.com/arthow4n/did-it-become-what-you-like/blob/master/THIRD_PARTY_NOTICES.md",
      "About must retain the third-party notices link",
    );
  });
});

Deno.test("settings-final install offer supports later after a useful action", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const port = createFakeUpdateInstallPort();
      port.setInstallAvailable(true);
      render(
        createElement(
          PwaRuntime,
          {
            usefulActionVersion: 1,
            dirty: false,
            port,
            children: createElement("div", null, "content"),
          },
        ),
      );
      const view = within(document.body);
      await waitFor(() => assert(view.getByRole("button", { name: "Later" })));
      fireEvent.click(view.getByRole("button", { name: "Later" }));
      await waitFor(() => {
        if (view.queryByRole("button", { name: "Later" })) {
          throw new Error("later should hide the install offer");
        }
      });
    });
  });
});

Deno.test("settings-final labels service-worker installation as an update", async () => {
  await withComponentHarness(async ({ window, render, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      render(
        createElement(
          PwaRuntime,
          {
            usefulActionVersion: 0,
            dirty: false,
            port: createFakeUpdateInstallPort("installing"),
            children: createElement(AboutScreen, {
              onClose: () => undefined,
              onPrivacy: () => undefined,
            }),
          },
        ),
      );
      await waitFor(() => assert(viewText().includes("Installing update…")));
    });
  });
});

Deno.test("settings-final labels native app installation separately", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const port = createFakeUpdateInstallPort();
      port.setInstallAvailable(true);
      let finishInstall: (() => void) | undefined;
      const pendingPort = {
        ...port,
        install: () =>
          new Promise<void>((resolve) => {
            finishInstall = resolve;
          }),
      };
      render(
        createElement(
          PwaRuntime,
          {
            usefulActionVersion: 1,
            dirty: false,
            port: pendingPort,
            children: createElement(AboutScreen, {
              onClose: () => undefined,
              onPrivacy: () => undefined,
            }),
          },
        ),
      );
      const view = within(document.body);
      await waitFor(() => assert(view.getByRole("button", { name: "Later" })));
      fireEvent.click(view.getAllByRole("button", { name: "Install app" })[0]);
      await waitFor(() => assert(viewText().includes("Installing app…")));
      assert(!viewText().includes("Installing update…"));
      finishInstall?.();
      await waitFor(() => assert(!viewText().includes("Installing app…")));
    });
  });
});

Deno.test("settings-final update protects dirty input and exposes offline status", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const port = createFakeUpdateInstallPort();
      port.setUpdate();
      render(
        createElement(
          PwaRuntime,
          {
            usefulActionVersion: 0,
            dirty: true,
            port,
            children: createElement(AboutScreen, {
              onClose: () => undefined,
              onPrivacy: () => undefined,
            }),
          },
        ),
      );
      const view = within(document.body);
      fireEvent.click(view.getByRole("button", { name: "Check for updates" }));
      await waitFor(() =>
        assert(view.getAllByRole("button", { name: "Reload to update" }).length)
      );
      assert(
        view.getByText("Save or discard unsaved changes before reloading."),
      );
      fireEvent.click(
        view.getAllByRole("button", { name: "Reload to update" })[0],
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      assert(port.reloadCount === 0, "dirty input must not start a reload");
    });
  });
});

Deno.test("settings-final offline update status explains reconnecting", async () => {
  await withComponentHarness(async ({ window, render, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      render(
        createElement(
          PwaRuntime,
          {
            usefulActionVersion: 0,
            dirty: false,
            port: createFakeUpdateInstallPort(),
            children: createElement(AboutScreen, {
              onClose: () => undefined,
              onPrivacy: () => undefined,
            }),
          },
        ),
      );
      window.dispatchEvent(new window.Event("offline"));
      await waitFor(() =>
        assert(viewText().includes("Update check unavailable offline"))
      );
    });
  });
});

Deno.test("settings-final unsupported browser explains the update limitation", async () => {
  await withComponentHarness(async ({ window, render, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      render(
        createElement(
          PwaRuntime,
          {
            usefulActionVersion: 0,
            dirty: false,
            port: createFakeUpdateInstallPort("unsupported"),
            children: createElement(AboutScreen, {
              onClose: () => undefined,
              onPrivacy: () => undefined,
            }),
          },
        ),
      );
      await waitFor(() =>
        assert(
          viewText().includes("does not provide the service-worker"),
        )
      );
    });
  });
});

function viewText(): string {
  return document.body.textContent ?? "";
}

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}
