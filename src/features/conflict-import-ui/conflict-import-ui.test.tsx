import { within } from "@testing-library/dom";
import {
  ConflictCandidateCard,
  type ConflictGroupViewModel,
  ConflictReviewScreen,
  type ConflictReviewViewModel,
  ExportPanel,
  type ExportViewModel,
  ImportPanel,
  ImportPreview,
  type ImportPreviewViewModel,
  type ImportViewModel,
  SafetyExportStep,
} from "./conflict-import-ui.tsx";
import { withComponentHarness } from "../../test-support/component-harness.tsx";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
  readTextFile(path: string | URL): Promise<string>;
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
  for (const name of names) {
    previous.set(name, globalThis[name as keyof typeof globalThis]);
    Object.assign(globalThis, { [name]: testWindow[name] });
  }
  const previousCss = globalThis.CSS;
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

const candidateA = {
  id: "candidate-opaque-a",
  revisionId: "revision-opaque-a",
  value: "Groceries",
  deleted: false,
  deviceLabel: "Stockholm phone",
  recordedAt: "2026-08-22T10:42:00Z",
  recordedAtLabel: "22 Aug · 10:42",
};

const candidateB = {
  id: "candidate-opaque-b",
  revisionId: "revision-opaque-b",
  value: "Household",
  deleted: false,
  deviceLabel: "Laptop",
  recordedAt: "2026-08-22T10:45:00Z",
  recordedAtLabel: "22 Aug · 10:45",
};

const conflictGroup: ConflictGroupViewModel = {
  id: "group-opaque",
  recordLabel: "ICA Maxi Solna",
  recordTypeLabel: "Expense",
  fieldLabel: "Category",
  kind: "same-field",
  candidates: [candidateA, candidateB],
  customValue: "",
  technicalDetails: {
    recordId: "record-opaque",
    groupId: "group-opaque",
    parentRevisionIds: ["parent-opaque-a", "parent-opaque-b"],
    candidateRevisionIds: ["revision-opaque-a", "revision-opaque-b"],
  },
};

const deleteEditGroup: ConflictGroupViewModel = {
  ...conflictGroup,
  id: "delete-edit-group",
  kind: "delete-versus-edit",
  candidates: [
    {
      ...candidateA,
      id: "edited-candidate",
      revisionId: "edited-revision",
      value: "Edited record",
    },
    {
      ...candidateB,
      id: "deleted-candidate",
      revisionId: "deleted-revision",
      value: undefined,
      deleted: true,
    },
  ],
  discardedEditedValues: ["Household", "42.00"],
};

function reviewModel(
  overrides: Partial<ConflictReviewViewModel> = {},
): ConflictReviewViewModel {
  return {
    phase: "reviewing",
    connectivity: "online",
    groups: [conflictGroup],
    activeGroupId: conflictGroup.id,
    pane: "detail",
    completedCount: 0,
    ...overrides,
  };
}

const preview: ImportPreviewViewModel = {
  schemaVersion: 2,
  migration: "not-required",
  projectCount: 3,
  categoryCount: 18,
  expenseCount: 1240,
  receiptCount: 42,
  changeCount: 1380,
  warnings: ["One archived category is retained."],
  errors: [],
};

function importModel(
  overrides: Partial<ImportViewModel> = {},
): ImportViewModel {
  return {
    phase: "preview",
    connectivity: "online",
    drive: "not-configured",
    fileName: "backup.json",
    preview,
    mode: "merge",
    safetyExport: "not-started",
    replacementConfirmation: "unconfirmed",
    conflictCount: 0,
    ...overrides,
  };
}

const exportModel: ExportViewModel = {
  phase: "idle",
  shareAvailability: "available",
};

Deno.test("conflict review exposes list-to-detail progress and candidate neutrality", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      const chosen: string[] = [];
      let submitted = false;
      render(
        <ConflictReviewScreen
          viewModel={reviewModel({
            groups: [{
              ...conflictGroup,
              selectedChoice: {
                kind: "candidate",
                candidateId: "candidate-opaque-a",
              },
            }],
          })}
          onBack={() => undefined}
          onOpenGroup={(id) => chosen.push(id)}
          onShowList={() => undefined}
          onChooseCandidate={(id) => chosen.push(id)}
          onCustomValueChange={() => undefined}
          onChooseCustom={() => undefined}
          onKeepEdited={() => undefined}
          onDeleteRecord={() => undefined}
          onSubmit={() => submitted = true}
          onRetry={() => undefined}
        />,
      );
      assert(within(document.body).getByRole("heading", { name: "Conflicts" }));
      assert(within(document.body).getByText("Conflict 1 of 1"));
      assert(
        within(document.body).getByRole("list", {
          name: "Unresolved conflicts",
        }),
      );
      const options = within(document.body).getAllByRole("button", {
        name: "Choose this value",
      });
      assert(options.length === 2);
      assert(
        within(document.body).getByText("Stockholm phone · 22 Aug · 10:42"),
      );
      assert(within(document.body).getByText("Laptop · 22 Aug · 10:45"));
      assert(!document.body.textContent?.includes("record-opaque"));
      assert(!document.body.textContent?.includes("revision-opaque-a"));
      fireEvent.click(options[0]);
      assert(chosen.includes("candidate-opaque-a"));
      fireEvent.click(
        within(document.body).getByRole("button", {
          name: "Back to conflict list",
        }),
      );
      fireEvent.click(
        within(document.body).getByRole("button", { name: /ICA Maxi Solna/ }),
      );
      fireEvent.click(
        within(document.body).getAllByRole("button", {
          name: "Choose this value",
        })[0],
      );
      fireEvent.click(
        within(document.body).getByRole("button", {
          name: "Save and review next",
        }),
      );
      assert(submitted);
    });
  });
});

Deno.test("conflict review supports custom validation and keyboard-addressable actions", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let customValue = "";
      render(
        <ConflictReviewScreen
          viewModel={reviewModel({
            groups: [{ ...conflictGroup, customValue }],
          })}
          onBack={() => undefined}
          onOpenGroup={() => undefined}
          onShowList={() => undefined}
          onChooseCandidate={() => undefined}
          onCustomValueChange={(value) => customValue = value}
          onChooseCustom={() => undefined}
          onKeepEdited={() => undefined}
          onDeleteRecord={() => undefined}
          onSubmit={() => undefined}
          onRetry={() => undefined}
        />,
      );
      const custom = within(document.body).getByRole("textbox", {
        name: "Custom Category",
      });
      assert(custom);
      const customButton = within(document.body).getByRole("button", {
        name: "Use this different value",
      });
      assert(customButton.hasAttribute("disabled"));
      fireEvent.input(custom, { target: { value: "Travel" } });
      assert(customValue === "Travel");
      const back = within(document.body).getByRole("button", { name: "Back" });
      back.focus();
      assert(document.activeElement === back);
      fireEvent.keyDown(back, { key: "Enter" });
      assert(
        within(document.body).getAllByRole("button").every((button) =>
          button.tabIndex >= 0
        ),
      );
    });
  });
});

Deno.test("conflict delete-versus-edit has explicit outcomes and discarded-edit summary", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let kept = false;
      let deleted = false;
      render(
        <ConflictReviewScreen
          viewModel={reviewModel({
            groups: [deleteEditGroup],
            activeGroupId: deleteEditGroup.id,
          })}
          onBack={() => undefined}
          onOpenGroup={() => undefined}
          onShowList={() => undefined}
          onChooseCandidate={() => undefined}
          onCustomValueChange={() => undefined}
          onChooseCustom={() => undefined}
          onKeepEdited={() => kept = true}
          onDeleteRecord={() => deleted = true}
          onSubmit={() => undefined}
          onRetry={() => undefined}
        />,
      );
      assert(within(document.body).getByText("Delete versus edit"));
      assert(
        within(document.body).getByText(
          "Deleting the record discards the edited values listed below.",
        ),
      );
      assert(within(document.body).getByText("Household"));
      assert(within(document.body).getByText("42.00"));
      fireEvent.click(
        within(document.body).getByRole("button", {
          name: "Keep edited record",
        }),
      );
      fireEvent.click(
        within(document.body).getByRole("button", { name: "Delete record" }),
      );
      assert(kept && deleted);
      assert(
        within(document.body).getByRole("button", {
          name: "Choose deleted value",
        }),
      );
    });
  });
});

Deno.test("conflict saving, offline, error retry, and technical details remain explicit", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let retried = false;
      const { rerender } = render(
        <ConflictReviewScreen
          viewModel={reviewModel({
            phase: "saving",
            connectivity: "offline",
          })}
          onBack={() => undefined}
          onOpenGroup={() => undefined}
          onShowList={() => undefined}
          onChooseCandidate={() => undefined}
          onCustomValueChange={() => undefined}
          onChooseCustom={() => undefined}
          onKeepEdited={() => undefined}
          onDeleteRecord={() => undefined}
          onSubmit={() => undefined}
          onRetry={() => retried = true}
        />,
      );
      assert(within(document.body).getByText("Offline"));
      assert(
        within(document.body).getByRole("button", {
          name: "Save and review next",
        })
          .hasAttribute("disabled"),
      );
      rerender(
        <ConflictReviewScreen
          viewModel={reviewModel({
            phase: "error",
            error: {
              message: "Resolution was not committed locally.",
              retryable: true,
            },
          })}
          onBack={() => undefined}
          onOpenGroup={() => undefined}
          onShowList={() => undefined}
          onChooseCandidate={() => undefined}
          onCustomValueChange={() => undefined}
          onChooseCustom={() => undefined}
          onKeepEdited={() => undefined}
          onDeleteRecord={() => undefined}
          onSubmit={() => undefined}
          onRetry={() => retried = true}
        />,
      );
      fireEvent.click(
        within(document.body).getByRole("button", { name: "Retry" }),
      );
      assert(retried);
      assert(!document.body.textContent?.includes("record-opaque"));
      fireEvent.click(
        within(document.body).getByRole("button", {
          name: "Technical details (diagnostics)",
        }),
      );
      const region = within(document.body).getByRole("region", {
        name: "Technical details (diagnostics)",
      });
      assert(within(region).getByText("record-opaque"));
      assert(within(region).getByText("parent-opaque-a, parent-opaque-b"));
    });
  });
});

Deno.test("conflict review handles narrow and long strings without exposing identifiers", async () => {
  await withComponentHarness(async ({ render }) => {
    await withAriaGlobals(() => {
      const longLabel =
        "A very long merchant label that must remain readable on a narrow screen without revealing technical identifiers";
      render(
        <ConflictCandidateCard
          candidate={{
            ...candidateA,
            value: longLabel,
            deviceLabel: "A device with a deliberately long recognizable label",
          }}
          ordinal={1}
          selected={false}
          interactive
          onChoose={() => undefined}
        />,
      );
      assert(within(document.body).getByText(longLabel));
      assert(!document.body.textContent?.includes("candidate-opaque-a"));
      assert(!document.body.textContent?.includes("revision-opaque-a"));
    });
  });
});

Deno.test("import preview exposes schema, migration, counts, warnings, and blocking errors", async () => {
  await withComponentHarness(async ({ render }) => {
    await withAriaGlobals(() => {
      render(
        <ImportPreview
          preview={{
            ...preview,
            migration: "required",
            errors: ["This backup contains an unsupported future field."],
          }}
        />,
      );
      assert(
        within(document.body).getByRole("heading", {
          name: "Validated JSON backup",
        }),
      );
      assert(within(document.body).getByText("Schema 2 · migration required"));
      assert(within(document.body).getByText("1240"));
      assert(
        within(document.body).getByText("One archived category is retained."),
      );
      assert(
        within(document.body).getByRole("heading", {
          name: "This backup cannot be imported",
        }),
      );
      assert(
        within(document.body).getByText(
          "This backup contains an unsupported future field.",
        ),
      );
    });
  });
});

Deno.test("import merge selection and JSON file selection dispatch controlled callbacks", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let selectedFile: File | undefined;
      let selectedMode: string | undefined;
      let committed = false;
      const { rerender } = render(
        <ImportPanel
          viewModel={importModel({
            phase: "choosing",
            preview: null,
            mode: null,
            fileName: undefined,
          })}
          onFileSelected={(file) => selectedFile = file}
          onModeChange={(mode) => selectedMode = mode}
          onSafetyExport={() => undefined}
          onSafetyExportRetry={() => undefined}
          onReplacementConfirmationChange={() => undefined}
          onCommit={() => committed = true}
          onRetry={() => undefined}
          onReviewConflicts={() => undefined}
          onCancel={() => undefined}
        />,
      );
      const file = new File(['{"schemaVersion":2}'], "long-backup-name.json", {
        type: "application/json",
      });
      fireEvent.change(
        within(document.body).getByLabelText("Choose JSON backup"),
        {
          target: { files: [file] },
        },
      );
      assert(selectedFile?.name === "long-backup-name.json");
      rerender(
        <ImportPanel
          viewModel={importModel({ mode: "replace" })}
          onFileSelected={() => undefined}
          onModeChange={(mode) => selectedMode = mode}
          onSafetyExport={() => undefined}
          onSafetyExportRetry={() => undefined}
          onReplacementConfirmationChange={() => undefined}
          onCommit={() => committed = true}
          onRetry={() => undefined}
          onReviewConflicts={() => undefined}
          onCancel={() => undefined}
        />,
      );
      fireEvent.click(
        within(document.body).getByRole("radio", {
          name: "Merge into current data",
        }),
      );
      assert(selectedMode === "merge");
      rerender(
        <ImportPanel
          viewModel={importModel()}
          onFileSelected={() => undefined}
          onModeChange={() => undefined}
          onSafetyExport={() => undefined}
          onSafetyExportRetry={() => undefined}
          onReplacementConfirmationChange={() => undefined}
          onCommit={() => committed = true}
          onRetry={() => undefined}
          onReviewConflicts={() => undefined}
          onCancel={() => undefined}
        />,
      );
      fireEvent.click(
        within(document.body).getByRole("button", {
          name: "Merge into current data",
        }),
      );
      assert(committed);
    });
  });
});

Deno.test("import replacement is visually separate, safety-gated, and warns offline pre-sync", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let safetyExported = false;
      let confirmed: string | undefined;
      let committed = false;
      render(
        <ImportPanel
          viewModel={importModel({
            connectivity: "offline",
            drive: "configured",
            mode: "replace",
          })}
          onFileSelected={() => undefined}
          onModeChange={() => undefined}
          onSafetyExport={() => safetyExported = true}
          onSafetyExportRetry={() => undefined}
          onReplacementConfirmationChange={(value) => confirmed = value}
          onCommit={() => committed = true}
          onRetry={() => undefined}
          onReviewConflicts={() => undefined}
          onCancel={() => undefined}
        />,
      );
      assert(document.querySelector(".conflict-import-replace-warning"));
      assert(within(document.body).getByText("Online pre-sync required"));
      const replace = within(document.body).getByRole("button", {
        name: "Replace all current data",
      });
      assert(replace.hasAttribute("disabled"));
      fireEvent.click(
        within(document.body).getByRole("button", {
          name: "Create safety export",
        }),
      );
      assert(safetyExported);
      assert(!committed);
      assert(confirmed === undefined);
    });
  });
});

Deno.test("safety export has pending, failure/retry, and confirmation states", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      let retried = false;
      let confirmation: string | undefined;
      const { rerender } = render(
        <SafetyExportStep
          status="exporting"
          confirmation="unconfirmed"
          onExport={() => undefined}
          onRetry={() => retried = true}
          onConfirmationChange={(value) => confirmation = value}
        />,
      );
      assert(
        within(document.body).getByRole("button", {
          name: "Creating safety export",
        }).hasAttribute("disabled"),
      );
      rerender(
        <SafetyExportStep
          status="error"
          confirmation="unconfirmed"
          errorMessage="The download could not be written."
          onExport={() => undefined}
          onRetry={() => retried = true}
          onConfirmationChange={(value) => confirmation = value}
        />,
      );
      fireEvent.click(
        within(document.body).getByRole("button", {
          name: "Retry safety export",
        }),
      );
      assert(retried);
      rerender(
        <SafetyExportStep
          status="ready"
          confirmation="unconfirmed"
          onExport={() => undefined}
          onRetry={() => undefined}
          onConfirmationChange={(value) => confirmation = value}
        />,
      );
      fireEvent.click(
        within(document.body).getByRole("checkbox", {
          name: /I have a complete safety export/,
        }),
      );
      assert(confirmation === "confirmed");
    });
  });
});

Deno.test("export panel exposes canonical download/share actions and retryable status", async () => {
  await withComponentHarness(async ({ render, fireEvent }) => {
    await withAriaGlobals(() => {
      const deliveries: string[] = [];
      let retried = false;
      const { rerender } = render(
        <ExportPanel
          viewModel={exportModel}
          onExport={(delivery) => deliveries.push(delivery)}
          onRetry={() => retried = true}
          onCancel={() => undefined}
        />,
      );
      fireEvent.click(
        within(document.body).getByRole("button", {
          name: "Export complete backup",
        }),
      );
      fireEvent.click(
        within(document.body).getByRole("button", { name: "Share backup" }),
      );
      assert(deliveries.join(",") === "download,share");
      rerender(
        <ExportPanel
          viewModel={{
            phase: "preparing",
            shareAvailability: "unavailable",
          }}
          onExport={() => undefined}
          onRetry={() => undefined}
          onCancel={() => undefined}
        />,
      );
      assert(
        within(document.body).getByRole("button", {
          name: "Export complete backup",
        }).hasAttribute("disabled"),
      );
      assert(
        within(document.body).queryByRole("button", {
          name: "Share backup",
        }) === null,
      );
      rerender(
        <ExportPanel
          viewModel={{
            phase: "error",
            shareAvailability: "available",
            error: { message: "Export temporarily failed.", retryable: true },
          }}
          onExport={() => undefined}
          onRetry={() => retried = true}
          onCancel={() => undefined}
        />,
      );
      fireEvent.click(
        within(document.body).getByRole("button", { name: "Retry" }),
      );
      assert(retried);
      rerender(
        <ExportPanel
          viewModel={{
            phase: "completed",
            shareAvailability: "available",
            delivery: "downloaded",
          }}
          onExport={() => undefined}
          onRetry={() => undefined}
          onCancel={() => undefined}
        />,
      );
      assert(
        within(document.body).getByText("Backup downloaded successfully."),
      );
    });
  });
});

Deno.test("import and export CSS preserves review max-width, narrow layout, and immediate interaction", async () => {
  const css = await Deno.readTextFile(
    new URL("./conflict-import-ui.css", import.meta.url),
  );
  assert(css.includes("conflict-import-master-detail"));
  assert(css.includes("@media (max-width: 719px)"));
  assert(css.includes("transition: none"));
  assert(css.includes("overflow-wrap: anywhere"));
});
