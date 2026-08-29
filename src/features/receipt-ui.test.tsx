import { within } from "@testing-library/dom";
import { createElement } from "react";
import {
  GeminiSettingsScreen,
  LineEditorDialog,
  modelOptions,
  ReceiptDisclosure,
  ReceiptImageStore,
  ReceiptMetadataEditor,
  ReceiptReviewScreen,
  ReceiptScanFailureNotice,
} from "./receipt-ui.tsx";
import {
  GeminiQuickSetup,
  ModelPicker,
  ReceiptLineCard,
  ReceiptSourcePicker,
} from "../design-system/index.ts";
import { DeviceLocalSettingsSchema } from "../domain/index.ts";
import type { ContractFailure } from "../actors/contracts/index.ts";
import { withComponentHarness } from "../test-support/component-harness.tsx";
import { createFakeLocalPort } from "../test-support/fakes/ports.ts";

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
    const continueButton = view.getByRole("button", {
      name: "Continue to scan",
    });
    assert(continueButton.closest(".ds-sticky-action-bar"));
    fireEvent.click(continueButton);
    fireEvent.click(view.getByRole("button", { name: "Cancel" }));
    assert(accepted && declined);
  });
});

Deno.test("receipt-ui scan failure notice exposes a safe reportable code", async () => {
  await withComponentHarness(({ render, fireEvent }) => {
    const failure: ContractFailure = {
      code: "invalid-request",
      message: "The request was invalid.",
      retryable: false,
      operation: "gemini.extract",
    };
    let retried = false;
    let choseAnother = false;
    let usedManualEntry = false;
    render(
      createElement(ReceiptScanFailureNotice, {
        failure,
        canRetry: true,
        onRetry: () => retried = true,
        onChooseAnotherImage: () => choseAnother = true,
        onUseManualEntry: () => usedManualEntry = true,
      }),
    );
    const view = within(document.body);
    const alert = view.getByRole("alert");
    assert(alert.textContent?.includes("The request was invalid."));
    assert(alert.textContent?.includes("Error code: invalid-request"));
    assert(alert.textContent?.includes("Operation: gemini.extract"));
    assert(!alert.textContent?.includes("provider secret"));
    fireEvent.click(view.getByRole("button", { name: "Retry" }));
    fireEvent.click(
      view.getByRole("button", { name: "Choose another image" }),
    );
    fireEvent.click(view.getByRole("button", { name: "Use manual entry" }));
    assert(retried && choseAnother && usedManualEntry);
  });
});

Deno.test("receipt-ui empty review state keeps a level-one heading", async () => {
  await withComponentHarness(async ({ render, waitFor }) => {
    const local = createFakeLocalPort();
    render(
      createElement(ReceiptReviewScreen, {
        local,
        state: {
          projects: [],
          categories: [],
          expenses: [],
          receipts: [],
          receiptPurchaseLines: [],
          receiptAdjustments: [],
          tombstones: [],
          projectOrder: [],
        },
        onClose: () => undefined,
      }),
    );
    const view = within(document.body);
    await waitFor(() => {
      assert(view.getByText("There is no receipt review to restore."));
    });
    assert(view.getByRole("heading", { name: "Review receipt" }));
  });
});

Deno.test("receipt-ui source picker exposes native capture actions and ephemeral removal", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let tookPhoto = false;
      let choseImage = false;
      let removed = false;
      render(
        createElement(ReceiptSourcePicker, {
          preview: createElement("img", { alt: "Receipt preview" }),
          onTakePhoto: () => tookPhoto = true,
          onChooseImage: () => choseImage = true,
          onRemove: () => removed = true,
        }),
      );
      const view = within(document.body);
      fireEvent.click(view.getByRole("button", { name: "Take photo" }));
      fireEvent.click(view.getByRole("button", { name: "Choose image" }));
      assert(view.getByRole("button", { name: "Remove" }));
      fireEvent.click(view.getByRole("button", { name: "Remove" }));
      assert(tookPhoto && choseImage && removed);
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

Deno.test("receipt-ui line editor cancel leaves the review line unchanged", async () => {
  await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
    await withAriaGlobals(async () => {
      let saves = 0;
      render(
        createElement(LineEditorDialog, {
          line: {
            type: "purchase",
            id: "receipt-line-cancel",
            description: "Milk",
            categoryId: "category-uncategorized",
            lineTotal: "-4",
            selected: true,
            uncertain: false,
          },
          categories: [],
          linkOptions: [],
          onSave: () => saves++,
          triggerLabel: "Edit",
        }),
      );
      const view = within(document.body);
      fireEvent.click(view.getByRole("button", { name: "Edit" }));
      await waitFor(() => assert(view.getByRole("dialog")));
      fireEvent.input(view.getAllByRole("textbox")[0], {
        target: { value: "Changed" },
      });
      fireEvent.click(view.getByRole("button", { name: "Cancel" }));
      await waitFor(() => assert(view.queryByRole("dialog") === null));
      assert(saves === 0);
    });
  });
});

Deno.test("receipt-ui metadata editor cancel preserves the parent draft", async () => {
  await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
    await withAriaGlobals(async () => {
      let saves = 0;
      let closes = 0;
      render(
        createElement(ReceiptMetadataEditor, {
          parent: {
            projectId: "project-receipt-cancel",
            date: "2026-08-24",
            merchant: "Market branch",
            currency: "SEK",
            printedTotal: "-4",
          },
          onSave: () => saves++,
          onClose: () => closes++,
        }),
      );
      const view = within(document.body);
      await waitFor(() => assert(view.getByRole("dialog")));
      fireEvent.input(view.getByLabelText("Merchant"), {
        target: { value: "Changed" },
      });
      fireEvent.click(view.getByRole("button", { name: "Cancel" }));
      await waitFor(() => assert(closes === 1));
      assert(saves === 0);
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
      fireEvent.mouseDown(view.getByRole("button", { name: "Show value" }));
      assert(input.getAttribute("type") === "text");
      fireEvent.click(view.getByRole("button", { name: "Save and continue" }));
      assert(saved);
    });
  });
});

Deno.test("receipt-ui releases file, byte, and object URL state on terminal cleanup", async () => {
  const store = new ReceiptImageStore();
  const file = new File([new Uint8Array([1, 2, 3])], "receipt.png", {
    type: "image/png",
  });
  const image = store.add(file);
  await store.resolve(image);
  store.release(image);
  let rejected = false;
  try {
    await store.resolve(image);
  } catch {
    rejected = true;
  }
  assert(rejected, "Released image bytes must not remain resolvable");
});

Deno.test("receipt-ui retains an ephemeral source for an in-session retry", async () => {
  const store = new ReceiptImageStore();
  const file = new File([new Uint8Array([1, 2, 3])], "receipt.png", {
    type: "image/png",
  });
  const image = store.add(file);
  await store.resolve(image);
  store.releaseForRetry(image);
  const retried = await store.resolve(image);
  assert(retried.bytes.length === file.size);
  store.release(image);
});

Deno.test("receipt-ui keeps Needs test models selectable and evidence device-local", async () => {
  await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
    await withAriaGlobals(() => {
      let selected: string | undefined;
      render(
        createElement(ModelPicker, {
          options: [{
            id: "synthetic-needs-test",
            label: "Synthetic model · Needs test",
            status: "Needs test",
          }],
          value: undefined,
          onValueChange: (value) => selected = value,
        }),
      );
      const view = within(document.body);
      const modelInput = view.getByRole("combobox", { name: "Model" });
      fireEvent.click(modelInput);
      fireEvent.change(modelInput, { target: { value: "Synthetic" } });
      const option = view.getByRole("option", {
        name: /Synthetic model · Needs test/,
      });
      assert(option.getAttribute("aria-disabled") !== "true");
      fireEvent.click(option);
      return waitFor(() => assert(selected === "synthetic-needs-test"));
    });
  });
  const settings = DeviceLocalSettingsSchema.parse({
    imagePreparationEnabled: true,
    geminiKeyRevision: "key-revision-test",
    geminiCompatibilityEvidence: [{
      modelId: "synthetic-needs-test",
      modelFingerprint: "synthetic-needs-test|active|0|0|0",
      keyRevision: "key-revision-test",
      evidenceVersion: "receipt-compatibility.v1",
      status: "compatible",
    }],
  });
  assert(settings.geminiCompatibilityEvidence?.[0].status === "compatible");
  const model = {
    id: "synthetic-needs-test",
    displayName: "Synthetic model",
    lifecycle: "active" as const,
    capabilities: {
      "image-input": false,
      "content-generation": false,
      "structured-output": false,
    },
  };
  const compatible = modelOptions([model], settings)[0];
  assert(compatible.status === "Compatible");
  assert(compatible.disabled !== true);
  const stale = modelOptions([model], {
    ...settings,
    geminiCompatibilityEvidence: [{
      ...settings.geminiCompatibilityEvidence![0],
      modelFingerprint: "synthetic-needs-test|active|1|0|0",
    }],
  })[0];
  assert(stale.status === "Needs test");
});

Deno.test("receipt-ui retains a remembered key when refreshing models fails", async () => {
  await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
    await withAriaGlobals(() => {
      let stored = false;
      let removed = 0;
      const changes: unknown[] = [];
      const gemini = {
        getApiKey: () =>
          Promise.resolve(
            stored ? { reveal: () => "AIza.synthetic" } : undefined,
          ),
        setApiKey: () => {
          stored = true;
          return Promise.resolve();
        },
        removeApiKey: () => {
          removed++;
          stored = false;
          return Promise.resolve();
        },
        listModels: () => Promise.reject(new Error("model refresh failed")),
        testConfiguration: () =>
          Promise.resolve({
            status: "incompatible" as const,
            missingCapabilities: [],
          }),
        extractReceipt: () => Promise.reject(new Error("not used")),
      };
      render(
        createElement(GeminiSettingsScreen, {
          gemini,
          settings: { imagePreparationEnabled: true },
          onSettingsChange: (next) => changes.push(next),
          onClose: () => undefined,
        }),
      );
      const view = within(document.body);
      const input = view.getByLabelText("API key");
      fireEvent.input(input, { target: { value: "AIza.synthetic" } });
      const save = view.getByRole("button", { name: "Save and continue" });
      return waitFor(() => {
        assert(!save.hasAttribute("disabled"));
      }).then(() => {
        fireEvent.click(save);
        return waitFor(() => {
          assert(view.getByText("model refresh failed"));
          assert(
            removed === 0,
            "Transient refresh failure must not remove key",
          );
          assert(stored, "The remembered key must remain stored");
          assert(
            changes.length === 1,
            "Only device-local settings should change",
          );
        });
      });
    });
  });
});
