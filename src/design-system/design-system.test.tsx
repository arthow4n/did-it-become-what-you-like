declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
  readTextFile(path: string | URL): Promise<string>;
};

import { within } from "@testing-library/dom";
import { createElement } from "react";
import { withComponentHarness } from "../test-support/component-harness.tsx";
import {
  ActiveFilterChips,
  AdaptiveDialog,
  AppFrame,
  Badge,
  Banner,
  Button,
  Card,
  CategoryBreakdown,
  Checkbox,
  Chip,
  ColorChoiceField,
  ConfirmDialog,
  ContentContainer,
  CurrencyPicker,
  DangerDialog,
  DefaultNavigation,
  DefinitionList,
  DeleteAndReassign,
  Disclosure,
  Divider,
  DraftStatus,
  EmptyState,
  ErrorState,
  ErrorSummary,
  ExpenseRow,
  FileField,
  FilterBar,
  FormActions,
  formatMoney,
  FormLayout,
  Heading,
  Inline,
  InlineNotice,
  List,
  ListRow,
  Menu,
  MerchantPicker,
  MoneySummary,
  MoneyText,
  NativeDateField,
  NativeTimeField,
  PageHeader,
  PeriodPicker,
  Popover,
  Progress,
  RadioGroup,
  ResponsiveGrid,
  SearchField,
  SecretField,
  Section,
  SegmentedControl,
  SelectField,
  Skeleton,
  Stack,
  StatusDot,
  StatusMessage,
  StatusPanel,
  StickyActionBar,
  Switch,
  Text,
  TextField,
  Toast,
  Tooltip,
  WorkflowProgress,
} from "./components.tsx";
import { DesignSystemProvider } from "./provider.tsx";

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

function hexToken(css: string, token: string): string {
  const match = css.match(new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`, "i"));
  assert(match, `Expected ${token} to have a hex value`);
  return match[1].toLowerCase();
}

function relativeLuminance(hex: string): number {
  const channels = [0, 1, 2].map((channel) => {
    const value = Number.parseInt(
      hex.slice(1 + channel * 2, 3 + channel * 2),
      16,
    ) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

async function withAriaDomGlobals<T>(
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
    const result = await callback();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return result;
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
          isRequired: true,
          validationBehavior: "native",
        }),
      );
      const view = within(document.body);
      const field = view.getByRole("textbox", { name: "Merchant" });
      assertEqual(field.getAttribute("aria-invalid"), "true");
      assert(field.hasAttribute("required"));
      assert(!field.hasAttribute("aria-required"));
      assert(field.getAttribute("aria-describedby"));
      assert(view.getByText("Enter a merchant or description."));
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
          createElement(NativeDateField, {
            label: "Expense date",
            defaultValue: "2026-08-24",
          }),
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
      const dateControl = view.getByLabelText("Expense date");
      const timeControl = view.getByLabelText("Expense time");
      const fileControl = view.getByLabelText("Receipt image");
      assert(dateControl);
      assertEqual((dateControl as HTMLInputElement).value, "2026-08-24");
      assert(timeControl);
      assertEqual(fileControl.getAttribute("type"), "file");
      const nativeControls = [
        dateControl,
        timeControl,
        fileControl,
      ];
      assertEqual(document.querySelectorAll("label label").length, 0);
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

Deno.test("design-system field facades translate Mantine value and file events", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withAriaDomGlobals(window, async () => {
      let merchant = "";
      let date = "";
      let time = "";
      let selectedFile = "";
      let fileInput: HTMLInputElement | undefined;
      let publicFileInput: HTMLInputElement | undefined;
      let openFilePicker: (() => void | undefined) | undefined;
      render(
        createElement(
          "div",
          null,
          createElement(TextField, {
            label: "Merchant",
            onChange: (value) => merchant = value,
          }),
          createElement(NativeDateField, {
            label: "Expense date",
            onChange: (event) => date = event.currentTarget.value,
          }),
          createElement(NativeTimeField, {
            label: "Expense time",
            onChange: (event) => time = event.currentTarget.value,
          }),
          createElement(FileField, {
            label: "Receipt image",
            accept: "image/png",
            ref: (input) => {
              publicFileInput = input ?? undefined;
            },
            inputRef: (input) => {
              fileInput = input ?? undefined;
            },
            openRef: (open) => {
              openFilePicker = open ?? undefined;
            },
            onChange: (event) => {
              selectedFile = event.currentTarget.files?.[0]?.name ?? "";
            },
          }),
        ),
      );
      const view = within(document.body);
      fireEvent.change(view.getByRole("textbox", { name: "Merchant" }), {
        target: { value: "ICA Maxi" },
      });
      fireEvent.change(view.getByLabelText("Expense date"), {
        target: { value: "2026-08-27" },
      });
      fireEvent.change(view.getByLabelText("Expense time"), {
        target: { value: "14:30" },
      });
      const file = new File(["receipt"], "receipt.png", { type: "image/png" });
      fireEvent.change(view.getByLabelText("Receipt image"), {
        target: { files: [file] },
      });
      await waitFor(() => {
        assertEqual(merchant, "ICA Maxi");
        assertEqual(date, "2026-08-27");
        assertEqual(time, "14:30");
        assertEqual(selectedFile, "receipt.png");
        assert(fileInput, "FileField must expose its native input ref");
        assert(openFilePicker, "FileField must expose its Dropzone open ref");
        assertEqual(
          publicFileInput,
          fileInput,
          "FileField must preserve its public input ref",
        );
      });
    })
  );
});

Deno.test("design-system search facade owns uncontrolled clear state", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withAriaDomGlobals(window, async () => {
      const changes: string[] = [];
      const mounted = render(
        createElement(SearchField, {
          label: "Find",
          defaultValue: "Coffee",
          onValueChange: (value) => changes.push(value),
        }),
      );
      const view = within(document.body);
      const search = view.getByRole("searchbox", {
        name: "Find",
      }) as HTMLInputElement;
      assertEqual(search.value, "Coffee");
      fireEvent.click(view.getByRole("button", { name: "Clear search" }));
      await waitFor(() => {
        assertEqual(search.value, "");
        assertEqual(changes[changes.length - 1], "");
        assertEqual(search.getAttribute("data-empty"), "true");
      });
      mounted.unmount();
    })
  );
});

Deno.test("design-system file facade reports rejected files", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withAriaDomGlobals(window, async () => {
      let rejected: File[] = [];
      const mounted = render(
        createElement(FileField, {
          label: "Receipt image",
          accept: "image/png",
          onReject: (files) => rejected = files,
        }),
      );
      const view = within(document.body);
      const file = new File(["not an image"], "receipt.txt", {
        type: "text/plain",
      });
      fireEvent.change(view.getByLabelText("Receipt image"), {
        target: { files: [file] },
      });
      await waitFor(() => {
        assertEqual(rejected.length, 1);
        assert(view.getByRole("alert"));
        assert(view.getByText("That file type is not accepted."));
      });
      mounted.unmount();
    })
  );
});

Deno.test("design-system secret facade keeps reveal control keyboard reachable", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withAriaDomGlobals(window, async () => {
      const mounted = render(
        createElement(SecretField, { label: "API key" }),
      );
      const toggle = within(document.body).getByRole("button", {
        name: "Show value",
      });
      assertEqual(toggle.getAttribute("tabindex"), "0");
      assert(toggle.classList.contains("ds-secret-field__toggle"));
      fireEvent.keyDown(toggle, { key: "Enter", code: "Enter" });
      await waitFor(() => {
        assertEqual(
          (within(document.body).getByRole("textbox", {
            name: "API key",
          }) as HTMLInputElement).type,
          "text",
        );
      });
      mounted.unmount();
    })
  );
});

Deno.test("design-system color and delete-reassign composites expose controlled choices", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, async () => {
      let color = "#78DCCA";
      let replacement = "";
      let cancelled = false;
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
            onCancel: () => cancelled = true,
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
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      assert(cancelled);
      fireEvent.click(view.getByRole("button", { name: "Delete category" }));
      const reopenedDialog = view.getByRole("dialog", { name: "Delete Food?" });
      const picker = within(reopenedDialog).getByRole("combobox", {
        name: /Replacement category/,
      });
      fireEvent.click(picker);
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
      fireEvent.click(view.getByRole("option", { name: "Travel" }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      fireEvent.click(
        within(reopenedDialog).getByRole("button", {
          name: "Delete and reassign",
        }),
      );
      assertEqual(replacement, "travel");
      mounted.unmount();
    })
  );
});

Deno.test("design-system confirmation facade exposes an explicit cancel action", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, () => {
      let confirmed = false;
      let cancelled = false;
      const mounted = render(
        createElement(ConfirmDialog, {
          trigger: createElement(Button, null, "Archive category"),
          title: "Archive Food?",
          description: "Existing expenses keep this category.",
          confirmLabel: "Archive category",
          onConfirm: () => confirmed = true,
          onCancel: () => cancelled = true,
        }),
      );
      const view = within(document.body);
      fireEvent.click(view.getByRole("button", { name: "Archive category" }));
      const dialog = view.getByRole("dialog", { name: "Archive Food?" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      assert(cancelled);
      assert(!confirmed);
      mounted.unmount();
    })
  );
});

Deno.test("design-system danger confirmation resets its phrase after cancel and reopen", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withAriaDomGlobals(window, async () => {
      const mounted = render(
        createElement(DangerDialog, {
          trigger: createElement(Button, null, "Delete project"),
          title: "Delete project?",
          description: "This cannot be undone.",
          phrase: "DELETE",
          confirmLabel: "Delete project",
          onConfirm: () => undefined,
        }),
      );
      const view = within(document.body);
      fireEvent.click(view.getByRole("button", { name: "Delete project" }));
      let dialog = view.getByRole("dialog", { name: "Delete project?" });
      const input = within(dialog).getByRole("textbox", {
        name: "Type DELETE to confirm",
      });
      fireEvent.input(input, { target: { value: "DELETE" } });
      const confirm = within(dialog).getByRole("button", {
        name: "Delete project",
      });
      assert(!(confirm as HTMLButtonElement).disabled);
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(() =>
        assert(view.queryByRole("dialog", { name: "Delete project?" }) === null)
      );
      fireEvent.click(view.getByRole("button", { name: "Delete project" }));
      dialog = view.getByRole("dialog", { name: "Delete project?" });
      assert(
        (within(dialog).getByRole("button", {
          name: "Delete project",
        }) as HTMLButtonElement).disabled,
        "reopened danger dialogs must require the phrase again",
      );
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
      let direction = "spent";
      let archived = false;
      let category = "food";
      let autoSync = false;
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
            onChange: (value) => direction = value,
          }),
          createElement(Checkbox, {
            children: "Include archived",
            onChange: (value) => archived = value,
          }),
          createElement(RadioGroup, {
            label: "Category",
            options: [
              { id: "food", label: "Food" },
              { id: "travel", label: "Travel" },
            ],
            defaultValue: "food",
            onChange: (value) => category = value,
          }),
          createElement(Switch, {
            children: "Automatic sync",
            isRequired: true,
            isInvalid: true,
            validationBehavior: "aria",
            onChange: (value) => autoSync = value,
          }),
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
      fireEvent.click(view.getByRole("radio", { name: "Money back" }));
      fireEvent.click(view.getByRole("checkbox", { name: "Include archived" }));
      fireEvent.click(view.getByRole("radio", { name: "Travel" }));
      const syncSwitch = view.getByRole("switch", { name: "Automatic sync" });
      assertEqual(syncSwitch.getAttribute("aria-invalid"), "true");
      assertEqual(syncSwitch.getAttribute("aria-required"), "true");
      assert(!syncSwitch.hasAttribute("required"));
      fireEvent.click(syncSwitch);
      assertEqual(direction, "back");
      assert(archived);
      assertEqual(category, "travel");
      assert(autoSync);
      assert(view.getByRole("progressbar", { name: "Preparing receipt" }));
      mounted.unmount();
    })
  );
});

Deno.test("design-system select preserves controlled open state and callbacks", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, () => {
      let nextOpen: boolean | undefined;
      const mounted = render(
        createElement(SelectField, {
          label: "Currency",
          options: [{ id: "SEK", label: "SEK" }],
          isOpen: true,
          onOpenChange: (open) => nextOpen = open,
        }),
      );
      const view = within(document.body);
      assert(view.getByRole("option", { name: "SEK" }));
      fireEvent.keyDown(view.getByRole("combobox", { name: "Currency" }), {
        key: "Escape",
      });
      assertEqual(nextOpen, false);
      mounted.unmount();
    })
  );
});

Deno.test("M8 provider maps semantic tokens and locks the dark scheme", async () => {
  await withComponentHarness(({ window, renderBare }) =>
    withAriaDomGlobals(window, () => {
      const mounted = renderBare(
        createElement(
          DesignSystemProvider,
          null,
          createElement("span", null, "Provider content"),
        ),
      );
      assertEqual(
        document.documentElement.getAttribute("data-mantine-color-scheme"),
        "dark",
      );
      const generatedStyles = Array.from(
        document.querySelectorAll("style"),
      ).map((style) => style.textContent ?? "").join("\n");
      assert(generatedStyles.includes("--mantine-spacing-ds-4"));
      assert(generatedStyles.includes("var(--space-4)"));
      assert(generatedStyles.includes("--mantine-radius-sm"));
      assert(generatedStyles.includes("var(--radius-control)"));
      assert(generatedStyles.includes("--mantine-color-accent-0"));
      assert(generatedStyles.includes("var(--color-accent)"));
      assert(generatedStyles.includes("--mantine-control-height"));
      assert(generatedStyles.includes("var(--layer-overlay)"));
      assert(generatedStyles.includes("--mantine-motion-immediate"));
      mounted.unmount();
    })
  );
});

Deno.test("M8 structural facade wrappers retain semantic roots over Mantine", async () => {
  await withComponentHarness(({ window, render }) =>
    withAriaDomGlobals(window, () => {
      let inlineRef: HTMLDivElement | null = null;
      let gridRef: HTMLDivElement | null = null;
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(Stack, {
            as: "section",
            gap: 4,
            children: "Stack content",
          }),
          createElement(Inline, {
            children: "Inline content",
            role: "group",
            "aria-label": "Inline content",
            "data-pane": "inline",
            ref: (node) => {
              inlineRef = node;
            },
          }),
          createElement(
            ResponsiveGrid,
            {
              columns: 3,
              children: createElement("span", null, "Grid content"),
              role: "region",
              "aria-label": "Grid content",
              "data-pane": "grid",
              ref: (node) => {
                gridRef = node;
              },
            },
          ),
          createElement(
            ContentContainer,
            {
              size: "form",
              children: createElement("span", null, "Container content"),
            },
          ),
          createElement(Text, {
            as: "time",
            size: "caption",
            children: "2026-08-24",
          }),
          createElement(Heading, {
            level: 3,
            size: "sm",
            children: "Heading content",
          }),
          createElement(Card, null, "Card content"),
          createElement(Section, null, "Section content"),
          createElement(Divider, null),
          createElement(Badge, {
            tone: "positive",
            children: "Badge content",
          }),
          createElement(Chip, { children: "Chip content" }),
          createElement(StatusDot, {
            tone: "warning",
            children: "Status content",
          }),
        ),
      );
      const hasMantineRoot = (selector: string, className: string) => {
        const element = document.querySelector(selector);
        assert(element, `Missing ${selector}`);
        assert(
          element.classList.contains(className),
          `${selector} is not Mantine-backed`,
        );
        return element;
      };
      const view = within(document.body);
      hasMantineRoot("section.ds-stack", "mantine-Stack-root");
      hasMantineRoot(".ds-inline", "mantine-Group-root");
      const grid = hasMantineRoot(
        ".ds-responsive-grid",
        "mantine-SimpleGrid-root",
      );
      assertEqual(grid.getAttribute("data-columns"), "3");
      assertEqual(inlineRef, document.querySelector(".ds-inline"));
      assertEqual(gridRef, grid);
      assertEqual(
        view.getByRole("group", { name: "Inline content" }).getAttribute(
          "data-pane",
        ),
        "inline",
      );
      assertEqual(
        view.getByRole("region", { name: "Grid content" }).getAttribute(
          "data-pane",
        ),
        "grid",
      );
      hasMantineRoot(
        ".ds-content-container[data-size='form']",
        "mantine-Container-root",
      );
      const text = hasMantineRoot("time.ds-text", "mantine-Text-root");
      assertEqual(text.getAttribute("data-size"), "caption");
      hasMantineRoot("h3.ds-heading", "mantine-Title-root");
      hasMantineRoot("article.ds-card", "mantine-Card-root");
      hasMantineRoot("section.ds-section", "mantine-Paper-root");
      hasMantineRoot("hr.ds-divider", "mantine-Divider-root");
      hasMantineRoot("span.ds-badge", "mantine-Badge-root");
      hasMantineRoot("span.ds-chip", "mantine-Pill-root");
      hasMantineRoot("span.ds-status-dot", "mantine-Badge-root");
      mounted.unmount();
    })
  );
});

Deno.test("design-system dialog uses a named overlay and returns a useful trigger", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withAriaDomGlobals(window, async () => {
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
      const dialogRoot = document.querySelector(
        '[data-dialog-layout="adaptive"]',
      );
      assertEqual(dialogRoot?.getAttribute("aria-hidden"), "true");
      const trigger = view.getByRole("button", { name: "Open details" });
      fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
      fireEvent.keyUp(trigger, { key: "Enter", code: "Enter" });
      await waitFor(() =>
        assert(view.getByRole("dialog", { name: "Details" }))
      );
      assertEqual(dialogRoot?.getAttribute("aria-hidden"), "false");
      assert(document.querySelector('[data-dialog-layout="adaptive"]'));
      assert(view.getByText("Dialog content"));
      mounted.unmount();
    })
  );
});

Deno.test("M8 overlay facades preserve disclosure and menu contracts", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withAriaDomGlobals(window, async () => {
      let expanded = false;
      let action = "";
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(
            Disclosure,
            {
              title: "Archived records",
              onExpandedChange: (value) => expanded = value,
              children: createElement("p", null, "Older records"),
            },
          ),
          createElement(Menu, {
            trigger: createElement(Button, null, "Open actions"),
            items: [{ id: "edit", label: "Edit record" }],
            onAction: (id) => action = id,
          }),
          createElement(Popover, {
            trigger: createElement(Button, null, "Open help"),
            label: "Help",
            children: createElement("p", null, "Helpful details"),
          }),
          createElement(
            Tooltip,
            {
              trigger: createElement(Button, null, "Explain"),
              label: "Explanation",
              children: "More context",
            },
          ),
        ),
      );
      const view = within(document.body);
      const disclosure = view.getByRole("button", {
        name: "Archived records",
      });
      assertEqual(disclosure.getAttribute("aria-expanded"), "false");
      fireEvent.click(disclosure);
      assertEqual(disclosure.getAttribute("aria-expanded"), "true");
      assert(expanded);
      fireEvent.click(view.getByRole("button", { name: "Open actions" }));
      const menu = view.getByRole("menu", { name: "Open actions" });
      assert(
        !menu.querySelector('[role="presentation"]'),
        "menus must not contain Mantine's presentation focus placeholder",
      );
      const item = await waitFor(() =>
        view.getByRole("menuitem", { name: "Edit record" })
      );
      fireEvent.click(item);
      assertEqual(action, "edit");
      fireEvent.click(view.getByRole("button", { name: "Open help" }));
      await waitFor(() => view.getByText("Helpful details"));
      mounted.unmount();
    })
  );
});

Deno.test("M8 feedback facades preserve live regions and notification dismissal", async () => {
  await withComponentHarness(({ window, render, fireEvent, waitFor }) =>
    withAriaDomGlobals(window, async () => {
      let dismissed = 0;
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(Banner, {
            title: "Offline",
            children: "Working locally",
          }),
          createElement(InlineNotice, {
            tone: "danger",
            title: "Cannot save",
            children: "Try again later",
          }),
          createElement(StatusMessage, {
            tone: "positive",
            children: "Saved locally",
          }),
          createElement(Toast, {
            children: "Expense saved",
            onDismiss: () => dismissed++,
          }),
        ),
      );
      const view = within(document.body);
      assert(
        document.querySelector(
          '.ds-notifications[data-position="bottom-right"]',
        ),
      );
      assertEqual(
        view.getByText("Working locally").closest("[role]")?.getAttribute(
          "role",
        ),
        "status",
      );
      assertEqual(
        view.getByText("Try again later").closest("[role]")?.getAttribute(
          "role",
        ),
        "alert",
      );
      assertEqual(
        view.getByText("Saved locally").closest("[role]")?.getAttribute(
          "data-tone",
        ),
        "positive",
      );
      await waitFor(() => view.getByText("Expense saved"));
      const dismiss = view.getByRole("button", {
        name: "Dismiss notification",
      });
      fireEvent.click(dismiss);
      await waitFor(() => {
        assertEqual(dismissed, 1);
        assert(!view.queryByText("Expense saved"));
      });
      mounted.unmount();
    })
  );
});

Deno.test("M8 remaining feedback facades preserve progress and state contracts", async () => {
  await withComponentHarness(({ window, render }) =>
    withAriaDomGlobals(window, () => {
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(Progress, {
            label: "Uploading receipt",
            value: 25,
            minValue: 0,
            maxValue: 50,
          }),
          createElement(Progress, {
            label: "Preparing receipt",
            indeterminate: true,
          }),
          createElement(Skeleton, {
            style: { width: "14rem", height: "2rem" },
          }),
          createElement(EmptyState, {
            title: "No receipts",
            children: "Add a receipt to get started.",
          }),
          createElement(ErrorState, {
            title: "Receipt unavailable",
            children: "The receipt could not be loaded.",
          }),
        ),
      );
      const view = within(document.body);
      const determinate = view.getByRole("progressbar", {
        name: "Uploading receipt",
      });
      assertEqual(determinate.getAttribute("aria-valuenow"), "25");
      assertEqual(determinate.getAttribute("aria-valuemax"), "50");
      assertEqual(determinate.getAttribute("aria-valuetext"), "50%");
      const indeterminate = view.getByRole("progressbar", {
        name: "Preparing receipt",
      });
      assert(!indeterminate.hasAttribute("aria-valuenow"));
      assert(view.getByText("In progress"));
      assert(document.querySelector('.ds-skeleton[aria-hidden="true"]'));
      assert(document.querySelector("section.ds-empty-state"));
      assert(view.getByRole("heading", { name: "No receipts" }));
      assert(view.getByRole("alert"));
      assert(view.getByRole("heading", { name: "Receipt unavailable" }));
      mounted.unmount();
    })
  );
});

Deno.test("M8 shell facades preserve landmarks and navigation state", async () => {
  await withComponentHarness(({ render, fireEvent }) => {
    let selected = "";
    const mounted = render(
      createElement(
        AppFrame,
        {
          navigation: createElement(DefaultNavigation, {
            selected: "settings",
            onSelect: (id) => selected = id,
          }),
          children: createElement(PageHeader, {
            title: "Settings",
            headingLevel: 1,
          }),
        },
      ),
    );
    const view = within(document.body);
    assert(view.getByRole("main"));
    assert(view.getByRole("complementary"));
    assert(view.getByRole("navigation", { name: "Application" }));
    assert(view.getByRole("heading", { name: "Settings", level: 1 }));
    const settings = view.getByRole("button", { name: "Settings" });
    assertEqual(settings.getAttribute("aria-current"), "page");
    fireEvent.click(view.getByRole("button", { name: "Expenses" }));
    assertEqual(selected, "expenses");
    mounted.unmount();
  });
});

Deno.test("M8 list and form facades preserve native structures", async () => {
  await withComponentHarness(({ window, render }) =>
    withAriaDomGlobals(window, () => {
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(
            List,
            {
              label: "Saved receipts",
              children: createElement(
                ListRow,
                {
                  leading: createElement("span", null, "Receipt"),
                  trailing: createElement(Badge, null, "Saved"),
                  children: "Grocery store",
                },
              ),
            },
          ),
          createElement(DefinitionList, {
            items: [{ term: "Currency", description: "SEK" }],
          }),
          createElement(
            FormLayout,
            null,
            createElement(TextField, { label: "Merchant" }),
            createElement(
              FormActions,
              null,
              createElement(Button, null, "Save"),
            ),
          ),
          createElement(ErrorSummary, {
            errors: [{ id: "merchant", message: "Merchant is required" }],
          }),
          createElement(
            StickyActionBar,
            null,
            createElement(Button, { variant: "secondary" }, "Continue"),
          ),
        ),
      );
      const view = within(document.body);
      assert(view.getByRole("list", { name: "Saved receipts" }));
      assert(
        document.querySelector(".ds-list-row")?.textContent?.includes(
          "Grocery store",
        ),
      );
      assertEqual(document.querySelector("dt")?.textContent, "Currency");
      assertEqual(document.querySelector("dd")?.textContent, "SEK");
      assert(view.getByRole("textbox", { name: "Merchant" }));
      assert(view.getByRole("button", { name: "Save" }));
      assert(view.getByRole("alert"));
      assert(view.getByText("Merchant is required"));
      assert(view.getByRole("button", { name: "Continue" }));
      mounted.unmount();
    })
  );
});

Deno.test("M8 filter and status facades preserve grouping and workflow state", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, () => {
      let removed = 0;
      const mounted = render(
        createElement(
          "div",
          null,
          createElement(
            FilterBar,
            null,
            createElement(ActiveFilterChips, {
              filters: [{
                id: "project",
                label: "Project: Sweden",
                onRemove: () => removed++,
              }],
            }),
          ),
          createElement(DraftStatus, {
            state: "saving",
            detail: "Saving locally",
          }),
          createElement(StatusPanel, {
            title: "Sync status",
            detail: "Waiting for a connection",
            tone: "warning",
          }),
          createElement(WorkflowProgress, {
            steps: ["Choose scope", "Confirm deletion"],
            current: 1,
            status: "Deletion progress",
          }),
        ),
      );
      const view = within(document.body);
      assert(view.getByRole("group", { name: "Filters" }));
      const remove = view.getByRole("button", {
        name: "Remove Project: Sweden",
      });
      fireEvent.click(remove);
      assertEqual(removed, 1);
      assert(!view.queryByText("No unsaved changes"));
      assert(view.getAllByText("Saving locally").length >= 2);
      assert(view.getByText("Waiting for a connection"));
      assert(view.getByRole("progressbar", { name: "Deletion progress" }));
      assert(view.getByRole("list", { name: "Workflow steps" }));
      assertEqual(view.getAllByRole("listitem").length, 2);
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
  assert(css.includes("--layer-overlay: 40"));
  assert(css.includes("z-index: var(--layer-toast)"));
  assert(css.includes("transition: none"));
  assert(css.includes("--target-min: 44px"));
  assert(css.includes("@media (max-width: 359px)"));
  assert(css.includes("max(var(--space-2), env(safe-area-inset-bottom, 0px))"));
  assert(
    css.includes(
      "padding-bottom: max(var(--space-6), env(safe-area-inset-bottom));",
    ),
  );
  assert(css.includes(".ds-sticky-action-bar"));
  for (
    const selector of [
      ".ds-search-field__clear",
      ".ds-secret-field__toggle",
      ".ds-toast__dismiss",
    ]
  ) {
    const ruleStart = css.indexOf(selector);
    const ruleEnd = css.indexOf("}", ruleStart);
    assert(
      ruleStart >= 0 &&
        css.slice(ruleStart, ruleEnd).includes("width: 44px;") &&
        css.slice(ruleStart, ruleEnd).includes("height: 44px;"),
      `${selector} must retain a 44px hit area`,
    );
  }
  assert(css.includes("flex-direction: column;"));
  assert(css.includes("@media (prefers-reduced-motion: reduce)"));
  assert(css.includes("@media (forced-colors: active)"));
  assert(css.includes("@keyframes ds-progress"));
  assert(css.includes("overflow-wrap: anywhere;"));

  const surface = hexToken(css, "color-surface-1");
  for (
    const token of [
      "color-text-primary",
      "color-text-secondary",
      "color-text-muted",
      "color-accent",
      "color-positive",
      "color-negative",
      "color-danger",
      "color-warning",
      "color-info",
    ]
  ) {
    assert(
      contrastRatio(hexToken(css, token), surface) >= 4.5,
      `${token} must retain 4.5:1 contrast on color-surface-1`,
    );
  }
  assert(
    contrastRatio(
      hexToken(css, "color-on-danger"),
      hexToken(css, "color-danger"),
    ) >=
      4.5,
    "color-on-danger must retain 4.5:1 contrast on color-danger",
  );
  assert(css.includes("color: var(--color-on-danger);"));
  assert(!css.includes("color: #241113;"));
  assert(css.includes("gap: var(--space-1);"));
  assert(!css.includes("gap: 2px;"));
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

Deno.test("design-system category totals preserve long identity and signed money", async () => {
  await withComponentHarness(({ window, render, fireEvent }) =>
    withAriaDomGlobals(window, () => {
      let selected = "";
      const categoryName = "Very long category name that must remain readable";
      const mounted = render(
        createElement(CategoryBreakdown, {
          categories: [{
            id: "category-travel",
            name: categoryName,
            amount: "-999999999999999999999.99",
            currency: "SEK",
          }],
          onSelect: (id) => selected = id,
        }),
      );
      const view = within(document.body);
      const list = view.getByRole("list", { name: "Category totals" });
      const categoryButton = within(list).getByRole("button", {
        name: categoryName,
      });
      assert(view.getByText("SEK -999,999,999,999,999,999,999.99"));
      fireEvent.click(categoryButton);
      assertEqual(selected, "category-travel");
      mounted.unmount();
    })
  );
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
      fireEvent.click(currencyInput);
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
    withAriaDomGlobals(window, async () => {
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
      const kindPicker = view.getByRole("combobox", {
        name: "Custom period type",
      });
      const datePicker = view.getByLabelText("Custom calendar date");
      assertEqual((datePicker as HTMLInputElement).value, "2026-08-24");
      fireEvent.click(kindPicker);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      fireEvent.click(view.getByRole("option", { name: "Month" }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      fireEvent.change(datePicker, { target: { value: "2026-09-03" } });
      assertEqual(kind, "month");
      assertEqual(date, "2026-09-03");
      mounted.unmount();
    })
  );
});
