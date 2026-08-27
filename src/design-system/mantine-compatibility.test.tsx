declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
  readTextFile(path: string | URL): Promise<string>;
};

import { within } from "@testing-library/dom";
import {
  Button,
  FileInput,
  MantineProvider,
  Modal,
  Select,
  TextInput,
} from "@mantine/core";
import { DateInput, TimeInput } from "@mantine/dates";
import { useReducedMotion } from "@mantine/hooks";
import { Dropzone } from "@mantine/dropzone";
import { Notifications, notifications } from "@mantine/notifications";
import { useState } from "react";
import { withComponentHarness } from "../test-support/component-harness.tsx";
import { mantineCompatibilityTheme } from "./mantine-compatibility-proof.tsx";

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message = "Values differ") {
  if (actual !== expected) {
    throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`);
  }
}

async function withMantineDomGlobals<T>(
  testWindow: {
    Document: unknown;
    Element: unknown;
    File: unknown;
    HTMLButtonElement: unknown;
    HTMLInputElement: unknown;
    MutationObserver: unknown;
    NodeFilter: unknown;
    ResizeObserver: unknown;
    ShadowRoot: unknown;
    SVGElement: unknown;
    requestAnimationFrame: unknown;
    cancelAnimationFrame: unknown;
  },
  callback: () => T | Promise<T>,
): Promise<T> {
  const previous = new Map<PropertyKey, unknown>();
  const globals: Record<string, unknown> = {
    Document: testWindow.Document,
    Element: testWindow.Element,
    File: testWindow.File,
    HTMLButtonElement: testWindow.HTMLButtonElement,
    HTMLInputElement: testWindow.HTMLInputElement,
    MutationObserver: testWindow.MutationObserver,
    NodeFilter: testWindow.NodeFilter,
    ResizeObserver: testWindow.ResizeObserver,
    ShadowRoot: testWindow.ShadowRoot,
    SVGElement: testWindow.SVGElement,
    requestAnimationFrame: testWindow.requestAnimationFrame,
    cancelAnimationFrame: testWindow.cancelAnimationFrame,
  };
  const previousCSS = globalThis.CSS;
  if (!previousCSS) {
    globals.CSS = {
      escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&"),
    };
  }

  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, globalThis[key as keyof typeof globalThis]);
    Object.assign(globalThis, { [key]: value });
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previous) {
      Object.assign(globalThis, { [key]: value });
    }
    if (!previousCSS) Object.assign(globalThis, { CSS: previousCSS });
  }
}

function Provider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      defaultColorScheme="dark"
      theme={mantineCompatibilityTheme}
    >
      {children}
    </MantineProvider>
  );
}

function MotionProbe() {
  const reduced = useReducedMotion();
  return <output aria-label="Reduced motion">{String(reduced)}</output>;
}

Deno.test("Mantine provider applies the dark scheme and controlled input works", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withMantineDomGlobals(window, () => {
      function ControlledInput() {
        const [value, setValue] = useState("");
        return (
          <TextInput
            aria-label="Controlled compatibility input"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        );
      }

      const mounted = render(
        <Provider>
          <ControlledInput />
        </Provider>,
      );
      const input = within(document.body).getByRole("textbox", {
        name: "Controlled compatibility input",
      });
      assertEqual(
        document.documentElement.getAttribute("data-mantine-color-scheme"),
        "dark",
      );
      fireEvent.change(input, { target: { value: "updated" } });
      assertEqual((input as HTMLInputElement).value, "updated");
      mounted.unmount();
    })
  );
});

Deno.test("Mantine modal uses a portal and restores focus", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withMantineDomGlobals(window, async () => {
      function ModalHarness() {
        const [opened, setOpened] = useState(false);
        return (
          <>
            <Button onClick={() => setOpened(true)}>Open test modal</Button>
            <Modal
              opened={opened}
              onClose={() => setOpened(false)}
              title="Test modal"
              transitionProps={{ duration: 0 }}
            >
              <Button data-autofocus>Modal action</Button>
            </Modal>
          </>
        );
      }

      const mounted = render(
        <Provider>
          <ModalHarness />
        </Provider>,
      );
      const view = within(document.body);
      const trigger = view.getByRole("button", { name: "Open test modal" });
      trigger.focus();
      fireEvent.click(trigger);
      const dialog = view.getByRole("dialog", { name: "Test modal" });
      assert(document.body.contains(dialog));
      assert(dialog.closest("[data-portal]") || dialog.parentElement);
      fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => {
        if (document.body.contains(dialog)) {
          throw new Error("Modal is still open");
        }
      });
      assertEqual(document.activeElement, trigger);
      mounted.unmount();
    })
  );
});

Deno.test("Mantine select commits a value through keyboard interaction", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withMantineDomGlobals(window, async () => {
      function SelectHarness() {
        const [value, setValue] = useState<string | null>(null);
        return (
          <Select
            aria-label="Compatibility currency"
            data={[
              { value: "sek", label: "Swedish krona" },
              { value: "eur", label: "Euro" },
            ]}
            value={value}
            onChange={setValue}
          />
        );
      }

      const mounted = render(
        <Provider>
          <SelectHarness />
        </Provider>,
      );
      const view = within(document.body);
      const select = view.getByRole("combobox", {
        name: "Compatibility currency",
      });
      fireEvent.click(select);
      fireEvent.keyDown(select, { key: "ArrowDown", code: "ArrowDown" });
      fireEvent.keyDown(select, { key: "Enter", code: "Enter" });
      await waitFor(() =>
        assertEqual((select as HTMLInputElement).value, "Swedish krona")
      );
      mounted.unmount();
    })
  );
});

Deno.test("Mantine date, time, and file inputs preserve facade values", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withMantineDomGlobals(window, () => {
      let dateValue: string | null = "2026-08-27";
      let timeValue = "14:30";
      let fileName: string | undefined;
      const mounted = render(
        <Provider>
          <DateInput
            aria-label="Date candidate"
            valueFormat="YYYY-MM-DD"
            value={dateValue}
            onChange={(value) => dateValue = value}
          />
          <TimeInput
            aria-label="Time candidate"
            value={timeValue}
            onChange={(event) => timeValue = event.currentTarget.value}
          />
          <FileInput
            aria-label="File candidate"
            accept="image/png"
            capture="environment"
            onChange={(value) => fileName = value?.name}
          />
        </Provider>,
      );
      const view = within(document.body);
      const date = view.getByRole("textbox", { name: "Date candidate" });
      const time = view.getByLabelText("Time candidate");
      const fileInput = document.querySelector<HTMLInputElement>(
        'input[type="file"]',
      );
      assert(fileInput, "FileInput did not render its native file input");
      assertEqual(fileInput.getAttribute("capture"), "environment");
      fireEvent.change(date, { target: { value: "2026-09-03" } });
      fireEvent.change(time, { target: { value: "09:15" } });
      const file = new window.File(["receipt"], "receipt.png", {
        type: "image/png",
      });
      fireEvent.change(fileInput, { target: { files: [file] } });
      assertEqual(dateValue, "2026-09-03");
      assertEqual(timeValue, "09:15");
      assertEqual(fileName, "receipt.png");
      mounted.unmount();
    })
  );
});

Deno.test("Mantine Dropzone preserves keyboard, camera, and drop outcomes", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withMantineDomGlobals(window, async () => {
      let acceptedName: string | undefined;
      let rejected = 0;
      const mounted = render(
        <Provider>
          <Dropzone
            accept={["image/png"]}
            multiple={false}
            onDrop={(files) => acceptedName = files[0]?.name}
            onReject={(files) => rejected = files.length}
            inputProps={{
              accept: "image/png",
              capture: "environment",
              "aria-label": "Dropzone file",
            }}
          >
            <span>Drop target</span>
          </Dropzone>
        </Provider>,
      );
      const view = within(document.body);
      const input = view.getByLabelText("Dropzone file") as HTMLInputElement;
      const root = input.closest<HTMLElement>('[tabindex="0"]');
      assert(root, "Dropzone did not expose a keyboard-focusable root");
      assertEqual(input.getAttribute("capture"), "environment");
      let fileDialogOpenCount = 0;
      input.click = () => fileDialogOpenCount += 1;
      fireEvent.keyDown(root, { key: "Enter", code: "Enter" });
      assertEqual(fileDialogOpenCount, 1);

      const acceptedFile = new window.File(["receipt"], "receipt.png", {
        type: "image/png",
      });
      const rejectedFile = new window.File(["notes"], "notes.txt", {
        type: "text/plain",
      });
      const dataTransfer = (file: { name: string; type: string }) => ({
        files: [file],
        items: [{ kind: "file", type: file.type, getAsFile: () => file }],
        types: ["Files"],
      });
      fireEvent.drop(root, { dataTransfer: dataTransfer(acceptedFile) });
      await waitFor(() => assertEqual(acceptedName, "receipt.png"));
      fireEvent.drop(root, { dataTransfer: dataTransfer(rejectedFile) });
      await waitFor(() => assertEqual(rejected, 1));
      mounted.unmount();
    })
  );
});

Deno.test("Mantine notifications render through the public store API", async () => {
  await withComponentHarness(({ window, render, waitFor }) =>
    withMantineDomGlobals(window, () => {
      const mounted = render(
        <Provider>
          <Notifications transitionDuration={0} autoClose={false} />
        </Provider>,
      );
      notifications.show({
        id: "mantine-test-notification",
        title: "Test notification",
        message: "Rendered through the public store API.",
        autoClose: false,
      });
      return waitFor(() => {
        const notification = within(document.body).getByRole("alert");
        assert(notification.textContent?.includes("Test notification"));
        assert(
          notification.textContent?.includes(
            "Rendered through the public store API.",
          ),
        );
        notifications.clean();
        mounted.unmount();
      });
    })
  );
});

Deno.test("Mantine reduced-motion hook respects the user preference", async () => {
  await withComponentHarness(async ({ window, render, waitFor }) => {
    const originalMatchMedia = window.matchMedia;
    Object.assign(window, {
      matchMedia: (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    try {
      const mounted = render(
        <Provider>
          <MotionProbe />
        </Provider>,
      );
      await waitFor(() => {
        assertEqual(
          within(document.body).getByLabelText("Reduced motion").textContent,
          "true",
        );
        assertEqual(mantineCompatibilityTheme.respectReducedMotion, true);
        mounted.unmount();
      });
    } finally {
      Object.assign(window, { matchMedia: originalMatchMedia });
    }
  });
});

Deno.test("Mantine proof imports layered CSS in dependency order", async () => {
  const source = await Deno.readTextFile(
    new URL("./mantine-compatibility-entry.tsx", import.meta.url),
  );
  const coreStyles = source.indexOf('"@mantine/core/styles.layer.css"');
  const dateStyles = source.indexOf('"@mantine/dates/styles.layer.css"');
  const dropzoneStyles = source.indexOf(
    '"@mantine/dropzone/styles.layer.css"',
  );
  const notificationStyles = source.indexOf(
    '"@mantine/notifications/styles.layer.css"',
  );
  const appStyles = source.indexOf('"./tokens.css"');
  assert(coreStyles >= 0, "Core layered CSS import is missing");
  assert(
    dateStyles > coreStyles,
    "Date CSS must follow core CSS",
  );
  assert(
    dropzoneStyles > dateStyles,
    "Dropzone CSS must follow date CSS",
  );
  assert(
    notificationStyles > dropzoneStyles,
    "Notification CSS must follow other package CSS",
  );
  assert(appStyles > notificationStyles, "App CSS must follow package CSS");
  assert(!source.includes("@mantine/core/styles.css"));
  assert(!source.includes("@mantine/notifications/styles.css"));
});
