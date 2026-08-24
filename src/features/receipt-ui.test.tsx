import { within } from "@testing-library/dom";
import { createElement } from "react";
import { ReceiptDisclosure } from "./receipt-ui.tsx";
import {
  GeminiQuickSetup,
  ReceiptLineCard,
  ReceiptSourcePicker,
} from "../design-system/index.ts";
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
  callback: () => T | Promise<T>,
): Promise<T> {
  const testWindow =
    (globalThis as unknown as { window?: { [key: string]: unknown } }).window;
  if (!testWindow) return await callback();
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

Deno.test("receipt-ui disclosure states the exact permitted and excluded data", async () => {
  await withComponentHarness(({ render, fireEvent }) => {
    let accepted = false;
    let declined = false;
    render(
      createElement(ReceiptDisclosure, {
        onAccept: () => accepted = true,
        onDecline: () => declined = true,
      }),
    );
    const view = within(document.body);
    assert(view.getByRole("heading", { name: "Before sending this receipt" }));
    assert(view.getByText(/active category IDs and names/));
    assert(view.getByText(/Expense history, project names, Drive data/));
    fireEvent.click(view.getByRole("button", { name: "Continue to scan" }));
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    assert(accepted && declined);
  });
});

Deno.test("receipt-ui source picker exposes native capture actions and ephemeral removal", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let removed = false;
      render(
        createElement(ReceiptSourcePicker, {
          preview: createElement("img", { alt: "Receipt preview" }),
          onTakePhoto: () => undefined,
          onChooseImage: () => undefined,
          onRemove: () => removed = true,
        }),
      );
      const view = within(document.body);
      assert(view.getByRole("button", { name: "Take photo" }));
      assert(view.getByRole("button", { name: "Choose image" }));
      assert(view.getByRole("button", { name: "Remove" }));
      fireEvent.click(view.getByRole("button", { name: "Remove" }));
      assert(removed);
    });
  });
});

Deno.test("receipt-ui line card exposes uncertainty, selection, edit, and remove actions", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let selected: boolean | undefined;
      let edited = false;
      let removed = false;
      render(
        createElement(ReceiptLineCard, {
          line: {
            id: "receipt-line-ui",
            type: "purchase",
            description: "Unclear item",
            category: "Uncategorized",
            amount: "-4",
            selected: false,
            uncertain: true,
            selectionReason: "The receipt text was partly hidden.",
          },
          currency: "SEK",
          onSelectedChange: (value) => selected = value,
          onEdit: () => edited = true,
          onRemove: () => removed = true,
        }),
      );
      const view = within(document.body);
      assert(view.getByText("The receipt text was partly hidden."));
      fireEvent.click(view.getByRole("checkbox"));
      fireEvent.click(view.getByRole("button", { name: "Edit" }));
      fireEvent.click(view.getByRole("button", { name: "Remove" }));
      assert(selected === true && edited && removed);
    });
  });
});

Deno.test("receipt-ui Gemini quick setup masks the key and keeps validation visible", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let saved = false;
      render(
        createElement(GeminiQuickSetup, {
          value: "AIza.test-key",
          onChange: () => undefined,
          onSave: () => saved = true,
          error: "The key could not be validated.",
        }),
      );
      const view = within(document.body);
      const input = view.getByLabelText("API key");
      assert(input.getAttribute("type") === "password");
      assert(view.getByText("The key could not be validated."));
      fireEvent.click(view.getByRole("button", { name: "Show value" }));
      assert(input.getAttribute("type") === "text");
      fireEvent.click(view.getByRole("button", { name: "Save and continue" }));
      assert(saved);
    });
  });
});
