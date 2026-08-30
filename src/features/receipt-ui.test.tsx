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
  ReceiptScanScreen,
  type ReceiptUiDependencies,
} from "./receipt-ui.tsx";
import {
  GeminiQuickSetup,
  ModelPicker,
  ReceiptLineCard,
  ReceiptSourcePicker,
} from "../design-system/index.ts";
import {
  DeviceLocalSettingsSchema,
  type ProjectCategoryState,
} from "../domain/index.ts";
import type { ReceiptReviewDraft } from "../domain/receipt.ts";
import type {
  ReceiptAiPort,
  ReceiptExtractionDraft,
} from "../adapters/ports/index.ts";
import { SecretValue } from "../adapters/ports/index.ts";
import type {
  ContractFailure,
  ReceiptImageRef,
} from "../actors/contracts/index.ts";
import {
  withAriaGlobals,
  withComponentHarness,
} from "../test-support/component-harness.tsx";
import {
  createFakeImagePreparationPort,
  createFakeLocalPort,
} from "../test-support/fakes/ports.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
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

const emptyState: ProjectCategoryState = {
  projects: [],
  categories: [],
  expenses: [],
  receipts: [],
  receiptPurchaseLines: [],
  receiptAdjustments: [],
  tombstones: [],
  projectOrder: [],
};

const defaultTestProject = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-receipt-ui",
  name: "Receipt UI project",
  defaultCurrency: "SEK" as const,
  archived: false,
};

const defaultTestCategory = {
  schemaVersion: 1 as const,
  type: "category" as const,
  id: "category-uncategorized" as const,
  name: "Uncategorized",
  sortOrder: 0,
  archived: false,
  system: true,
};

const defaultTestState: ProjectCategoryState = {
  ...emptyState,
  projects: [defaultTestProject],
  categories: [defaultTestCategory],
  projectOrder: [defaultTestProject.id],
  selectedProjectId: defaultTestProject.id,
  firstProjectId: defaultTestProject.id,
  defaultProjectId: defaultTestProject.id,
};

Deno.test("receipt-ui empty review state keeps a level-one heading", async () => {
  await withComponentHarness(async ({ render, waitFor }) => {
    const local = createFakeLocalPort();
    render(
      createElement(ReceiptReviewScreen, {
        local,
        state: emptyState,
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

Deno.test(
  "receipt-ui exposes recovery controls when review hydration fails",
  async () => {
    await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
      const local = createFakeLocalPort();
      local.failNext("quota");
      let closed = 0;
      render(
        createElement(ReceiptReviewScreen, {
          local,
          state: emptyState,
          onClose: () => closed++,
        }),
      );
      const view = within(document.body);
      await waitFor(() => {
        assert(view.getByText("Receipt review needs recovery"));
        assert(view.getByRole("button", { name: "Retry" }));
        assert(view.getByRole("button", { name: "Discard review" }));
      });
      fireEvent.click(view.getByRole("button", { name: "Discard review" }));
      await waitFor(() => assert(closed === 1));
    });
  },
);

Deno.test(
  "receipt-ui disables review save while the durable commit is failed",
  async () => {
    await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
      const local = createFakeLocalPort();
      render(
        createElement(ReceiptReviewScreen, {
          local,
          state: emptyState,
          initialReview: {
            parent: {
              projectId: "project-review-failure",
              date: "2026-08-30",
              currency: "SEK",
              printedTotal: "-1",
            },
            lines: [{
              type: "purchase",
              id: "line-review-failure",
              description: "Coffee",
              categoryId: "category-uncategorized",
              lineTotal: "-1",
              selected: true,
              uncertain: false,
            }],
            uncertainty: [],
            printedTotalMismatch: false,
          },
          onClose: () => undefined,
        }),
      );
      const view = within(document.body);
      const saveName = "Save 1 selected entry";
      await waitFor(() => assert(view.getByRole("button", { name: saveName })));
      local.failNext("quota");
      fireEvent.click(view.getByRole("button", { name: saveName }));
      await waitFor(() => {
        assert(view.getByText("Receipt was not saved"));
        assert(
          view.getByRole("button", { name: saveName }).hasAttribute("disabled"),
        );
      });
    });
  },
);

Deno.test("receipt-ui review reports its actor-owned dirty state", async () => {
  await withComponentHarness(async ({ render, waitFor }) => {
    const local = createFakeLocalPort();
    const dirtyStates: boolean[] = [];
    render(
      createElement(ReceiptReviewScreen, {
        local,
        state: emptyState,
        initialReview: {
          parent: {
            projectId: "project-receipt-dirty",
            date: "2026-08-30",
            currency: "SEK",
            printedTotal: "-1",
          },
          lines: [],
          uncertainty: [],
          printedTotalMismatch: false,
        },
        onDirtyChange: (dirty) => dirtyStates.push(dirty),
        onClose: () => undefined,
      }),
    );
    await waitFor(() => assert(dirtyStates.includes(true)));
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
            amount: "-5",
            selected: false,
            uncertain: true,
            quantity: "2",
            unitPrice: "2.5",
            selectionReason: "The receipt text was partly hidden.",
            classificationReason:
              "The product row is visible under the grocery section.",
          },
          currency: "SEK",
          onSelectedChange: (value) => selected = value,
          onEdit: () => edited = true,
          onRemove: () => removed = true,
        }),
      );
      const view = within(document.body);
      assert(view.getByText("2 × 2.5"));
      assert(view.getByText("The receipt text was partly hidden."));
      assert(
        view.getByText(
          "AI classification: The product row is visible under the grocery section.",
        ),
      );
      fireEvent.click(view.getByRole("checkbox"));
      fireEvent.click(view.getByRole("button", { name: "Edit" }));
      fireEvent.click(view.getByRole("button", { name: "Remove" }));
      assert(selected === true && edited && removed);
    });
  });
});

Deno.test("receipt-ui deselecting a purchase unlinks its adjustment", async () => {
  await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
    await withAriaGlobals(async () => {
      const local = createFakeLocalPort();
      const review: ReceiptReviewDraft = {
        parent: {
          projectId: "project-receipt-ui-review",
          date: "2026-08-30",
          merchant: "Market",
          currency: "SEK",
          printedTotal: "-4",
        },
        lines: [{
          type: "purchase",
          id: "receipt-purchase-ui-review",
          description: "Milk",
          categoryId: "category-uncategorized",
          lineTotal: "-5",
          selected: true,
          uncertain: false,
        }, {
          type: "adjustment",
          id: "receipt-adjustment-ui-review",
          description: "Discount",
          categoryId: "category-uncategorized",
          amount: "1",
          lineId: "receipt-purchase-ui-review",
          selected: true,
          uncertain: false,
        }],
        uncertainty: [],
        printedTotalMismatch: false,
      };
      const state: ProjectCategoryState = {
        projects: [{
          schemaVersion: 1,
          type: "project",
          id: "project-receipt-ui-review",
          name: "Review project",
          defaultCurrency: "SEK",
          archived: false,
        }],
        categories: [{
          schemaVersion: 1,
          type: "category",
          id: "category-uncategorized",
          name: "Uncategorized",
          sortOrder: 0,
          archived: false,
          system: true,
        }],
        selectedProjectId: "project-receipt-ui-review",
        firstProjectId: "project-receipt-ui-review",
        defaultProjectId: "project-receipt-ui-review",
        expenses: [],
        receipts: [],
        receiptPurchaseLines: [],
        receiptAdjustments: [],
        tombstones: [],
        projectOrder: ["project-receipt-ui-review"],
      };
      render(
        createElement(ReceiptReviewScreen, {
          local,
          state,
          initialReview: review,
          onClose: () => undefined,
        }),
      );
      const view = within(document.body);
      await waitFor(() => assert(view.getAllByRole("checkbox").length === 2));
      fireEvent.click(view.getAllByRole("checkbox")[0]!);
      await waitFor(async () => {
        const snapshots = await local.query("workflow-snapshots");
        const snapshot = snapshots[0]?.value as {
          review?: { lines?: Array<{ id?: string; lineId?: string }> };
        } | undefined;
        const adjustment = snapshot?.review?.lines?.find((line) =>
          line.id === "receipt-adjustment-ui-review"
        );
        assert(adjustment && adjustment.lineId === undefined);
      });
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

Deno.test(
  "receipt-ui cancels an active scan before close cleanup removes its image",
  async () => {
    await withComponentHarness(async ({ render, fireEvent, waitFor }) => {
      await withAriaGlobals(async () => {
        const imageStore = new ReceiptImageStore();
        const model = {
          id: "fake-gemini-compatible",
          displayName: "Fake Gemini Compatible",
          lifecycle: "active" as const,
          capabilities: {
            "image-input": true,
            "content-generation": true,
            "structured-output": true,
          },
        };
        const draft: ReceiptExtractionDraft = {
          merchant: "Fake Merchant",
          currency: "SEK",
          date: "2026-08-29",
          printedTotal: "-1",
          lines: [{
            description: "Receipt item",
            amount: "1",
            categoryId: "category-uncategorized",
            kind: "purchase",
            direction: "outflow",
            selected: true,
            rationale: "The receipt lists this purchased product line.",
          }],
          uncertainty: [],
          mismatches: [],
        };
        let abortCount = 0;
        let resolveExtraction: (() => void) | undefined;
        let lastImageRef: ReceiptImageRef | undefined;
        const ai: ReceiptAiPort = {
          listModels: () => Promise.resolve([model]),
          testConfiguration: () =>
            Promise.resolve({
              status: "compatible",
              model,
            }),
          extractReceipt: (_request, options) =>
            new Promise((resolve, reject) => {
              const signal = options?.signal;
              const onAbort = () => {
                abortCount += 1;
                signal?.removeEventListener("abort", onAbort);
                reject(new Error("scan aborted"));
              };
              signal?.addEventListener("abort", onAbort, { once: true });
              resolveExtraction = () => {
                signal?.removeEventListener("abort", onAbort);
                resolve(draft);
              };
            }),
        };
        const gemini = {
          ...ai,
          getApiKey: () => Promise.resolve(SecretValue.from("AIza.test")),
          setApiKey: () => Promise.resolve(),
          removeApiKey: () => Promise.resolve(),
        };
        const dependencies: ReceiptUiDependencies = {
          ai,
          gemini,
          imagePreparation: createFakeImagePreparationPort(),
          resolveImage: (ref) => {
            lastImageRef = ref;
            return imageStore.resolve(ref);
          },
          releaseImage: (ref) => imageStore.releaseForRetry(ref),
        };
        const state = defaultTestState;
        const settings = DeviceLocalSettingsSchema.parse({
          imagePreparationEnabled: true,
          selectedGeminiModel: model.id,
          geminiKeyRevision: "legacy-key",
          geminiCompatibilityEvidence: [{
            modelId: model.id,
            modelFingerprint: `${model.id}|active|1|1|1`,
            keyRevision: "legacy-key",
            evidenceVersion: "receipt-compatibility.v1",
            status: "compatible",
          }],
        });
        const secretStorage = {
          get: () => Promise.resolve(SecretValue.from("AIza.test")),
          set: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        };
        let closed = 0;
        let reviewed = false;
        const rendered = render(
          createElement(ReceiptScanScreen, {
            dependencies,
            secretStorage,
            imageStore,
            state,
            settings,
            offline: false,
            onSettingsChange: () => undefined,
            onDirtyChange: () => undefined,
            onReview: () => reviewed = true,
            onClose: () => closed += 1,
            onOpenSettings: () => undefined,
          }),
        );
        const view = within(document.body);
        await waitFor(() =>
          assert(view.getByRole("button", { name: "Continue to scan" }))
        );
        fireEvent.click(view.getByRole("button", { name: "Continue to scan" }));
        // Use the runtime Blob so the Deno URL implementation accepts it
        // while the component harness swaps the DOM File constructor.
        const file = new Blob([new Uint8Array([1, 2, 3])], {
          type: "image/png",
        }) as unknown as File;
        fireEvent.change(view.getByLabelText("Receipt image file"), {
          target: { files: [file] },
        });
        await waitFor(() => {
          const button = view.getByRole("button", { name: "Scan with AI" });
          assert(!button.hasAttribute("disabled"));
        });
        fireEvent.click(view.getByRole("button", { name: "Scan with AI" }));
        await waitFor(() =>
          assert(view.getByRole("button", { name: "Cancel scan" }))
        );
        fireEvent.click(view.getByRole("button", { name: "Close" }));
        await waitFor(() => assert(closed === 1));
        resolveExtraction?.();
        await waitFor(() => assert(abortCount === 1));
        assert(!reviewed);
        assert(!view.queryByRole("alert")?.textContent?.includes("not-found"));
        rendered.unmount();

        // A route change or hot update can tear down the screen without the
        // visible Close action. The unmount cleanup must abort the invocation
        // and release the source just as the explicit cancellation path does.
        const remounted = render(
          createElement(ReceiptScanScreen, {
            dependencies,
            secretStorage,
            imageStore,
            state,
            settings,
            offline: false,
            onSettingsChange: () => undefined,
            onDirtyChange: () => undefined,
            onReview: () => reviewed = true,
            onClose: () => closed += 1,
            onOpenSettings: () => undefined,
          }),
        );
        const remountedView = within(document.body);
        await waitFor(() =>
          assert(
            remountedView.getByRole("button", { name: "Continue to scan" }),
          )
        );
        fireEvent.click(
          remountedView.getByRole("button", { name: "Continue to scan" }),
        );
        const remountedFile = new Blob([new Uint8Array([4, 5, 6])], {
          type: "image/png",
        }) as unknown as File;
        fireEvent.change(remountedView.getByLabelText("Receipt image file"), {
          target: { files: [remountedFile] },
        });
        await waitFor(() => {
          const button = remountedView.getByRole("button", {
            name: "Scan with AI",
          });
          assert(!button.hasAttribute("disabled"));
        });
        fireEvent.click(
          remountedView.getByRole("button", { name: "Scan with AI" }),
        );
        await waitFor(() =>
          assert(remountedView.getByRole("button", { name: "Cancel scan" }))
        );
        remounted.unmount();
        await waitFor(() => assert(abortCount === 2));
        assert(lastImageRef !== undefined);
        let imageReleased = false;
        try {
          await imageStore.resolve(lastImageRef);
        } catch {
          imageReleased = true;
        }
        assert(imageReleased, "Unmount cleanup should release the image");
      });
    });
  },
);

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
