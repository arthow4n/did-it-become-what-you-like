declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
  readTextFile(path: string | URL): Promise<string>;
};

import { within } from "@testing-library/dom";
import { createElement } from "react";
import { withComponentHarness } from "../test-support/component-harness.tsx";
import {
  AdaptiveDialog,
  Button,
  Checkbox,
  formatMoney,
  MoneyText,
  Progress,
  SegmentedControl,
  TextField,
} from "./components.tsx";

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(
  actual: T,
  expected: T,
  message = "Values differ",
): void {
  if (actual !== expected) {
    throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`);
  }
}

function withAriaDomGlobals<T>(
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
  callback: () => T,
): T {
  const previous = {
    HTMLButtonElement: globalThis.HTMLButtonElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    MutationObserver: globalThis.MutationObserver,
    NodeFilter: globalThis.NodeFilter,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    HTMLSelectElement: globalThis.HTMLSelectElement,
    SVGElement: globalThis.SVGElement,
    HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
  };
  Object.assign(globalThis, {
    HTMLButtonElement: testWindow.HTMLButtonElement,
    HTMLInputElement: testWindow.HTMLInputElement,
    MutationObserver: testWindow.MutationObserver,
    NodeFilter: testWindow.NodeFilter,
    requestAnimationFrame: testWindow.requestAnimationFrame,
    cancelAnimationFrame: testWindow.cancelAnimationFrame,
    HTMLSelectElement: testWindow.HTMLSelectElement,
    SVGElement: testWindow.SVGElement,
    HTMLTextAreaElement: testWindow.HTMLTextAreaElement,
  });
  try {
    return callback();
  } finally {
    Object.assign(globalThis, previous);
  }
}

Deno.test("design-system formats signed large values without numeric coercion", () => {
  assertEqual(
    formatMoney("-999999999999999999999.99", "SEK"),
    "SEK -999,999,999,999,999,999,999.99",
  );
  assertEqual(formatMoney("+24.00", "SEK"), "SEK +24.00");
});

Deno.test("design-system button exposes accessible pending and disabled states", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, () => {
      const mounted = render(
        createElement(
          Button,
          { pending: true, isDisabled: true },
          "Save expense",
        ),
      );
      const view = within(document.body);
      const button = view.getByRole("button", { name: "Save expense" });
      assert(button.hasAttribute("data-pending"));
      assert((button as HTMLButtonElement).disabled);
      fireEvent.keyDown(button, { key: "Enter" });
      assert(
        document.activeElement === button ||
          document.activeElement === document.body,
      );
      mounted.unmount();
    })
  );
});

Deno.test("design-system fields expose names, descriptions, and invalid semantics", async () => {
  await withComponentHarness(({ window, render }) =>
    withAriaDomGlobals(window, () => {
      const mounted = render(
        createElement(TextField, {
          label: "Merchant",
          description: "Previously used names stay local.",
          error: "Enter a merchant or description.",
        }),
      );
      const view = within(document.body);
      const field = view.getByRole("textbox", { name: "Merchant" });
      assertEqual(field.getAttribute("aria-invalid"), "true");
      assert(field.getAttribute("aria-describedby"));
      assert(view.getByRole("alert"));
      mounted.unmount();
    })
  );
});

Deno.test("design-system selection and progress remain keyboard-addressable", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, () => {
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(SegmentedControl, {
            label: "Direction",
            options: [{ id: "spent", label: "Spent" }, {
              id: "back",
              label: "Money back",
            }],
            defaultValue: "spent",
          }),
          createElement(Checkbox, { children: "Include archived" }),
          createElement(Progress, {
            label: "Preparing receipt",
            indeterminate: true,
          }),
        ),
      );
      const view = within(document.body);
      const spent = view.getByRole("radio", { name: "Spent" });
      assert(spent);
      fireEvent.keyDown(spent, { key: "ArrowRight" });
      assert(view.getByRole("radio", { name: "Money back" }));
      assert(view.getByRole("checkbox", { name: "Include archived" }));
      assert(view.getByRole("progressbar", { name: "Preparing receipt" }));
      mounted.unmount();
    })
  );
});

Deno.test("design-system dialog uses a named overlay and returns a useful trigger", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, () => {
      const mounted = render(
        createElement(
          AdaptiveDialog,
          {
            trigger: createElement(Button, null, "Open details"),
            title: "Details",
            children: createElement("p", null, "Dialog content"),
          },
        ),
      );
      const view = within(document.body);
      const trigger = view.getByRole("button", { name: "Open details" });
      fireEvent.click(trigger);
      assert(view.getByRole("dialog", { name: "Details" }));
      assert(view.getByText("Dialog content"));
      mounted.unmount();
    })
  );
});

Deno.test("design-system CSS locks semantic tokens, immediate motion, targets, and forced colors", async () => {
  const css = await Deno.readTextFile(new URL("./tokens.css", import.meta.url));
  assert(css.includes("--color-canvas: #101315"));
  assert(css.includes("--color-accent: #78dcca"));
  assert(css.includes("--motion-immediate: 0ms"));
  assert(css.includes("transition: none"));
  assert(css.includes("--target-min: 44px"));
  assert(css.includes("@media (prefers-reduced-motion: reduce)"));
  assert(css.includes("@media (forced-colors: active)"));
  assert(css.includes("@keyframes ds-progress"));
});

Deno.test("design-system money component keeps sign and currency in accessible text", async () => {
  await withComponentHarness(({ render }) => {
    const mounted = render(
      createElement(MoneyText, { amount: "+24.00", currency: "SEK" }),
    );
    assert(within(document.body).getByText("SEK +24.00"));
    mounted.unmount();
  });
});
