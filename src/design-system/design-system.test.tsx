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
  ColorChoiceField,
  CurrencyPicker,
  DefinitionList,
  DeleteAndReassign,
  ExpenseRow,
  FileField,
  formatMoney,
  MerchantPicker,
  MoneySummary,
  MoneyText,
  NativeDateField,
  NativeTimeField,
  PageHeader,
  PeriodPicker,
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
  callback: () => T,
): T {
  const previous = {
    HTMLButtonElement: globalThis.HTMLButtonElement,
    FocusEvent: globalThis.FocusEvent,
    HTMLInputElement: globalThis.HTMLInputElement,
    MutationObserver: globalThis.MutationObserver,
    NodeFilter: globalThis.NodeFilter,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    HTMLSelectElement: globalThis.HTMLSelectElement,
    SVGElement: globalThis.SVGElement,
    HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
  };
  const previousCSS = globalThis.CSS;
  Object.assign(globalThis, {
    HTMLButtonElement: testWindow.HTMLButtonElement,
    FocusEvent: testWindow.FocusEvent,
    HTMLInputElement: testWindow.HTMLInputElement,
    MutationObserver: testWindow.MutationObserver,
    NodeFilter: testWindow.NodeFilter,
    requestAnimationFrame: testWindow.requestAnimationFrame,
    cancelAnimationFrame: testWindow.cancelAnimationFrame,
    HTMLSelectElement: testWindow.HTMLSelectElement,
    SVGElement: testWindow.SVGElement,
    HTMLTextAreaElement: testWindow.HTMLTextAreaElement,
    CSS: previousCSS ?? {
      escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&"),
    },
  });
  try {
    return callback();
  } finally {
    Object.assign(globalThis, previous);
    Object.assign(globalThis, { CSS: previousCSS });
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

Deno.test("design-system native fields and definition lists expose valid semantics", async () => {
  await withComponentHarness(({ window, render }) =>
    withAriaDomGlobals(window, () => {
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(NativeDateField, { label: "Expense date" }),
          createElement(NativeTimeField, { label: "Expense time" }),
          createElement(FileField, { label: "Receipt image" }),
          createElement(DefinitionList, {
            items: [{ term: "Project", description: "Sweden" }],
          }),
          createElement(ColorChoiceField, {
            label: "Category color",
            choices: ["#78DCCA", "#8FC8F8"],
            value: "#78DCCA",
          }),
        ),
      );
      const view = within(document.body);
      assert(
        view.getByLabelText("Expense date").getAttribute("type") === "date",
      );
      assert(
        view.getByLabelText("Expense time").getAttribute("type") === "time",
      );
      assert(
        view.getByLabelText("Receipt image").getAttribute("type") === "file",
      );
      const nativeControls = [
        view.getByLabelText("Expense date"),
        view.getByLabelText("Expense time"),
        view.getByLabelText("Receipt image"),
      ];
      assertEqual(document.querySelectorAll("label label").length, 0);
      assertEqual(document.querySelectorAll(".ds-field > label").length, 3);
      assertEqual(
        document.querySelectorAll(".ds-field > span.ds-field__label").length,
        1,
      );
      for (const control of nativeControls) {
        const fieldLabel = Array.from(document.querySelectorAll("label"))
          .find((candidate) => candidate.htmlFor === control.id);
        assert(fieldLabel, `Missing explicit label for ${control.id}`);
        assertEqual(fieldLabel.parentElement?.tagName, "DIV");
        assertEqual(fieldLabel.htmlFor, control.id);
      }
      const definitionList = document.querySelector("dl");
      assert(definitionList);
      assertEqual(definitionList.querySelectorAll(":scope > div").length, 1);
      assertEqual(definitionList.querySelectorAll(":scope > span").length, 0);
      assert(view.getByRole("group", { name: "Category color" }));
      mounted.unmount();
    })
  );
});

Deno.test("design-system color and delete-reassign composites expose controlled choices", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, () => {
      let color = "#78DCCA";
      let replacement = "";
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(ColorChoiceField, {
            label: "Category color",
            value: color,
            onValueChange: (value) => color = value,
          }),
          createElement(DeleteAndReassign, {
            trigger: createElement(Button, null, "Delete category"),
            title: "Delete Food?",
            description: "Choose a replacement.",
            replacementOptions: [
              { id: "uncategorized", label: "Uncategorized" },
              { id: "travel", label: "Travel" },
            ],
            defaultReplacementId: "uncategorized",
            affectedCount: 3,
            onConfirm: (value) => replacement = value,
          }),
        ),
      );
      const view = within(document.body);
      fireEvent.change(
        view.getByLabelText("Choose custom Category color"),
        { target: { value: "#112233" } },
      );
      assertEqual(color, "#112233");
      fireEvent.click(view.getByRole("button", { name: "Delete category" }));
      const dialog = view.getByRole("dialog", { name: "Delete Food?" });
      assert(dialog.textContent?.includes("3 expenses"));
      const picker = within(dialog).getByRole("button", {
        name: /Replacement category/,
      });
      fireEvent.click(picker);
      fireEvent.click(view.getByRole("option", { name: "Travel" }));
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete and reassign" }),
      );
      assertEqual(replacement, "travel");
      mounted.unmount();
    })
  );
});

Deno.test("design-system gallery keeps the required fixture coverage", async () => {
  const source = await Deno.readTextFile(
    new URL("./gallery.tsx", import.meta.url),
  );
  const renderSource = source.slice(
    source.indexOf("export function DesignSystemGallery"),
  );
  for (
    const component of [
      "ColorChoiceField",
      "FileField",
      "Chip",
      "DefinitionList",
      "ConfirmDialog",
      "DangerDialog",
      "Popover",
      "Menu",
      "Tooltip",
      "ErrorSummary",
      "FilterBar",
      "FilterSheet",
      "ActiveFilterChips",
      "ProjectPicker",
      "CurrencyPicker",
      "MerchantPicker",
    ]
  ) {
    assert(
      renderSource.includes(`<${component}`),
      `Gallery does not render ${component}`,
    );
  }
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
      assert(document.querySelector('[data-dialog-layout="adaptive"]'));
      assert(view.getByText("Dialog content"));
      mounted.unmount();
    })
  );
});

Deno.test("design-system adaptive dialog keeps sheet and desktop modal positioning", async () => {
  const css = await Deno.readTextFile(new URL("./tokens.css", import.meta.url));
  assert(css.includes("place-items: end center;"));
  assert(
    css.includes(
      "border-radius: var(--radius-overlay) var(--radius-overlay) 0 0;",
    ),
  );
  const wideLayout = css.slice(css.indexOf("@media (min-width: 1024px)"));
  assert(wideLayout.includes("place-items: center;"));
  assert(wideLayout.includes("border-radius: var(--radius-overlay);"));
  assert(css.includes("overflow-y: auto;"));
});

Deno.test("design-system CSS locks semantic tokens, immediate motion, targets, and forced colors", async () => {
  const css = await Deno.readTextFile(new URL("./tokens.css", import.meta.url));
  assert(css.includes("--color-canvas: #101315"));
  assert(css.includes("--color-accent: #78dcca"));
  assert(css.includes("--motion-immediate: 0ms"));
  assert(css.includes("transition: none"));
  assert(css.includes("--target-min: 44px"));
  assert(css.includes("@media (max-width: 359px)"));
  assert(css.includes("flex-direction: column;"));
  assert(css.includes("@media (prefers-reduced-motion: reduce)"));
  assert(css.includes("@media (forced-colors: active)"));
  assert(css.includes("@keyframes ds-progress"));
  assert(css.includes("overflow-wrap: anywhere;"));
});

Deno.test("design-system page headers can provide the application heading", async () => {
  await withComponentHarness(({ window, render }) =>
    withAriaDomGlobals(window, () => {
      const mounted = render(
        createElement(PageHeader, {
          title: "Expenses",
          headingLevel: 1,
        }),
      );
      assert(
        within(document.body).getByRole("heading", {
          level: 1,
          name: "Expenses",
        }),
      );
      mounted.unmount();
    })
  );
});

Deno.test("design-system money summary exposes a valid labeled group", async () => {
  await withComponentHarness(({ render }) => {
    const mounted = render(
      createElement(MoneySummary, {
        items: [{ label: "Net spent", amount: "12.50", currency: "SEK" }],
      }),
    );
    const summary = within(document.body).getByRole("group", {
      name: "Money summary",
    });
    assertEqual(summary.getAttribute("aria-label"), "Money summary");
    mounted.unmount();
  });
});

Deno.test("application root leaves the main landmark to AppFrame", async () => {
  const html = await Deno.readTextFile(
    new URL("../../index.html", import.meta.url),
  );
  assert(html.includes('<div id="root"></div>'));
  assert(!html.includes('<main id="root">'));
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

Deno.test("design-system positive money rows always expose an explicit plus", async () => {
  await withComponentHarness(({ window, render }) =>
    withAriaDomGlobals(window, () => {
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(MoneyText, { amount: "24.00", currency: "SEK" }),
          createElement(ExpenseRow, {
            expense: {
              id: "money-back",
              merchant: "Bottle return",
              category: "Other",
              amount: "24.00",
              currency: "SEK",
              date: "2026-08-24",
            },
          }),
        ),
      );
      assertEqual(
        within(document.body).getAllByText("SEK +24.00").length,
        2,
      );
      mounted.unmount();
    })
  );
});

Deno.test("design-system currency search and merchant clearing remain functional", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, () => {
      let selectedCurrency = "SEK";
      let merchant = "ICA Maxi";
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(CurrencyPicker, {
            options: [
              { id: "all", label: "All currencies" },
              { id: "SEK", label: "SEK — Swedish krona" },
            ],
            value: selectedCurrency,
            onValueChange: (value) => selectedCurrency = value,
          }),
          createElement(MerchantPicker, {
            value: merchant,
            onValueChange: (value) => merchant = value,
            suggestions: ["ICA Maxi"],
          }),
        ),
      );
      const view = within(document.body);
      const currencyInput = view.getByRole("combobox", { name: "Currency" });
      fireEvent.click(
        view.getByRole("button", { name: /Show currency options/ }),
      );
      fireEvent.change(currencyInput, { target: { value: "CHF" } });
      const swissOption = view.getByRole("option", { name: "CHF" });
      fireEvent.click(swissOption);
      assertEqual(selectedCurrency, "CHF");
      fireEvent.keyDown(currencyInput, { key: "Escape" });
      fireEvent.click(view.getByRole("button", { name: "Clear search" }));
      assertEqual(merchant, "");
      mounted.unmount();
    })
  );
});

Deno.test("design-system period picker exposes a controlled custom calendar period", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, () => {
      let kind = "day";
      let date = "2026-08-24";
      const mounted = render(
        createElement(PeriodPicker, {
          value: "custom",
          customKind: kind as "day" | "month" | "year",
          customDate: date,
          onCustomKindChange: (value) => kind = value,
          onCustomDateChange: (value) => date = value,
        }),
      );
      const view = within(document.body);
      const kindPicker = view.getByRole("button", {
        name: /Day Custom period type/,
      });
      const datePicker = view.getByLabelText("Custom calendar date");
      assertEqual((datePicker as HTMLInputElement).value, "2026-08-24");
      fireEvent.click(kindPicker);
      fireEvent.click(view.getByRole("option", { name: "Month" }));
      fireEvent.change(datePicker, { target: { value: "2026-09-03" } });
      assertEqual(kind, "month");
      assertEqual(date, "2026-09-03");
      mounted.unmount();
    })
  );
});
