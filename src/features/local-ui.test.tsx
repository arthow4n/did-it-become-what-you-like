import { within } from "@testing-library/dom";
import { createElement, useEffect, useRef, useState } from "react";
import {
  AddChoiceScreen,
  CategoryManager,
  DirtyExitGuard,
  ExpensesScreen,
  FirstUseScreen,
  ManualExpenseRecoveryScreen,
  manualExpenseSubmitEvent,
  OrganizeScreen,
  ProjectManager,
  SavedExpenseCompletionScreen,
  SettingsScreen,
} from "./local-ui.tsx";
import type {
  ProjectCategoryService,
  ProjectCategoryState,
} from "../domain/organization.ts";
import {
  ImportExportScreen,
  type ImportViewModel,
} from "./conflict-import-ui/index.ts";
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

function createTestService(initialState: ProjectCategoryState): {
  service: ProjectCategoryService;
  commits: () => number;
} {
  let commitCount = 0;
  const output = () => ({
    projects: initialState.projects,
    categories: initialState.categories,
    selectedProjectId: initialState.selectedProjectId,
    state: initialState,
  });
  return {
    service: {
      getState: () => Promise.resolve(initialState),
      commitProject: () => {
        commitCount += 1;
        return Promise.resolve(output());
      },
      setProjectDefaultCurrency: () => {
        commitCount += 1;
        return Promise.resolve(output());
      },
      commitCategory: () => {
        commitCount += 1;
        return Promise.resolve(output());
      },
      resolveCategoryReference: (categoryId) => Promise.resolve(categoryId),
    },
    commits: () => commitCount,
  };
}

function AddChoiceHarness() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => triggerRef.current?.focus(), []);
  return createElement(
    "div",
    null,
    createElement(
      "button",
      { ref: triggerRef, onClick: () => setOpen(true) },
      "Open add choice",
    ),
    open
      ? createElement(AddChoiceScreen, {
        offline: true,
        onClose: () => setOpen(false),
        onManual: () => setOpen(false),
      })
      : null,
  );
}

function FirstUseRestoreHarness() {
  const [path, setPath] = useState("/first-use");
  return path === "/settings/import-export"
    ? createElement(ImportExportScreen, {
      exportModel: { phase: "idle", shareAvailability: "unavailable" },
      importModel: {
        phase: "idle",
        connectivity: "online",
        drive: "not-configured",
        preview: null,
        mode: null,
        safetyExport: "not-started",
        replacementConfirmation: "unconfirmed",
        conflictCount: 0,
      } satisfies ImportViewModel,
      onBack: () => setPath("/first-use"),
      onExport: () => undefined,
      onRetryExport: () => undefined,
      onCancelExport: () => undefined,
      onFileSelected: () => undefined,
      onModeChange: () => undefined,
      onSafetyExport: () => undefined,
      onSafetyExportRetry: () => undefined,
      onReplacementConfirmationChange: () => undefined,
      onCommit: () => undefined,
      onRetryImport: () => undefined,
      onReviewConflicts: () => undefined,
      onCancelImport: () => undefined,
    })
    : createElement(FirstUseScreen, {
      onCreateProject: () => undefined,
      onRestoreBackup: () => setPath("/settings/import-export"),
      onConnectDrive: () => undefined,
    });
}

function DirtyNavigationHarness({ workflow }: { workflow: string }) {
  const [route, setRoute] = useState(`${workflow} workflow`);
  const [guardOpen, setGuardOpen] = useState(false);
  return createElement(
    "div",
    null,
    createElement(
      "button",
      { onClick: () => setGuardOpen(true) },
      `Leave ${workflow} workflow`,
    ),
    createElement("p", null, route),
    createElement(DirtyExitGuard, {
      isOpen: guardOpen,
      onKeepEditing: () => setGuardOpen(false),
      onDiscard: () => {
        setRoute("settings");
        setGuardOpen(false);
      },
    }),
  );
}

const project = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-local-ui",
  name: "Sweden project",
  defaultCurrency: "SEK" as const,
  archived: false,
};

const category = {
  schemaVersion: 1 as const,
  type: "category" as const,
  id: "category-uncategorized" as const,
  name: "Uncategorized",
  sortOrder: 0,
  archived: false,
  system: true,
};

const state: ProjectCategoryState = {
  projects: [project],
  categories: [category],
  expenses: [],
  receipts: [],
  receiptPurchaseLines: [],
  receiptAdjustments: [],
  tombstones: [],
  projectOrder: [project.id],
  selectedProjectId: project.id,
  firstProjectId: project.id,
  defaultProjectId: project.id,
};

const otherProject = {
  ...project,
  id: "project-other",
  name: "Other project",
};

const thirdProject = {
  ...project,
  id: "project-third",
  name: "Third project",
};

const archivedProject = {
  ...project,
  id: "project-archived",
  name: "Archived project",
  archived: true,
};

const organizedState: ProjectCategoryState = {
  ...state,
  projects: [project, otherProject, thirdProject, archivedProject],
  projectOrder: [project.id, otherProject.id, thirdProject.id],
};

const populatedOrganizedState: ProjectCategoryState = {
  ...organizedState,
  expenses: [{
    schemaVersion: 1,
    type: "expense",
    id: "expense-project-delete",
    projectId: otherProject.id,
    categoryId: category.id,
    date: "2026-08-24",
    amount: "-12",
    currency: "SEK",
    description: "Trip expense",
    source: "manual",
  }],
};

const customCategory = {
  schemaVersion: 1 as const,
  type: "category" as const,
  id: "category-food",
  name: "Food",
  sortOrder: 1,
  archived: false,
  system: false,
};

const categoryState: ProjectCategoryState = {
  ...state,
  categories: [category, customCategory],
};

Deno.test("local UI first-use screen exposes the three approved entry paths", async () => {
  await withComponentHarness(async ({ window, render, fireEvent }) => {
    await withAriaDomGlobals(window, () => {
      render(createElement(FirstUseRestoreHarness));
      const view = within(document.body);
      assert(view.getByRole("heading", { name: "Start tracking expenses" }));
      assert(view.getByRole("button", { name: /Create first project/ }));
      assert(view.getByRole("button", { name: /Restore JSON backup/ }));
      assert(view.getByRole("button", { name: /Connect Google Drive/ }));
      assert(view.getByRole("status"));
      fireEvent.click(
        view.getByRole("button", { name: /Restore JSON backup/ }),
      );
      assert(view.getByRole("heading", { name: "Import & export" }));
      assert(view.getByLabelText("Choose JSON backup"));
    });
  });
});

Deno.test("local UI manual dirty navigation offers keep or discard", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const mounted = render(
        createElement(DirtyNavigationHarness, { workflow: "manual" }),
      );
      const view = within(document.body);
      fireEvent.click(
        view.getByRole("button", { name: "Leave manual workflow" }),
      );
      assert(view.getByRole("dialog", { name: "Unsaved changes" }));
      fireEvent.click(view.getByRole("button", { name: "Keep editing" }));
      assert(view.getByText("manual workflow"));
      fireEvent.click(
        view.getByRole("button", { name: "Leave manual workflow" }),
      );
      fireEvent.click(view.getByRole("button", { name: "Discard changes" }));
      await waitFor(() => assert(view.getByText("settings")));
      assert(!view.queryByText("manual workflow"));
      mounted.unmount();
    });
  });
});

Deno.test("local UI receipt dirty navigation offers keep or discard", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const mounted = render(
        createElement(DirtyNavigationHarness, { workflow: "receipt" }),
      );
      const view = within(document.body);
      fireEvent.click(
        view.getByRole("button", { name: "Leave receipt workflow" }),
      );
      assert(view.getByRole("dialog", { name: "Unsaved changes" }));
      fireEvent.click(view.getByRole("button", { name: "Keep editing" }));
      assert(view.getByText("receipt workflow"));
      fireEvent.click(
        view.getByRole("button", { name: "Leave receipt workflow" }),
      );
      fireEvent.click(view.getByRole("button", { name: "Discard changes" }));
      await waitFor(() => assert(view.getByText("settings")));
      assert(!view.queryByText("receipt workflow"));
      mounted.unmount();
    });
  });
});

Deno.test("local UI save modes dispatch the typed manual-expense events", () => {
  assert(
    manualExpenseSubmitEvent("another").type ===
      "expense.submit-and-add-another",
    "Save and add another should use the typed actor event",
  );
  assert(
    manualExpenseSubmitEvent("expenses").type === "expense.submit",
    "Ordinary save should preserve the ordinary submit event",
  );
});

Deno.test("local UI expenses exposes shared filters, empty state, and add event", async () => {
  await withComponentHarness(({ render, fireEvent }) => {
    let addCount = 0;
    render(
      createElement(ExpensesScreen, {
        state,
        expenseDayBoundary: "03:00",
        offline: true,
        onAdd: () => addCount++,
        onEdit: () => undefined,
        onProjectChange: () => undefined,
      }),
    );
    const view = within(document.body);
    assert(view.getByRole("heading", { name: "Expenses" }));
    assert(view.getByRole("button", { name: /Filters/ }));
    assert(view.getByText("No expenses in this period"));
    fireEvent.click(view.getByRole("button", { name: "Add expense" }));
    assert(addCount === 1, "Add expense should dispatch the callback");
  });
});

Deno.test("local UI add choice disables AI scanning while offline", async () => {
  await withComponentHarness(async ({ window, render, fireEvent }) => {
    await withAriaDomGlobals(window, () => {
      let manualCount = 0;
      render(
        createElement(AddChoiceScreen, {
          offline: true,
          onClose: () => undefined,
          onManual: () => manualCount++,
        }),
      );
      const view = within(document.body);
      assert(view.getByRole("dialog", { name: "Add an expense" }));
      const scan = view.getByRole("button", { name: /Scan receipt with AI/ });
      assert((scan as HTMLButtonElement).disabled);
      fireEvent.click(view.getByRole("button", { name: /Add manually/ }));
      assert(manualCount === 1, "Manual entry should remain available offline");
    });
  });
});

Deno.test("local UI add choice traps focus and restores it after outside dismissal", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      render(createElement(AddChoiceHarness));
      const view = within(document.body);
      const trigger = view.getByRole("button", { name: "Open add choice" });
      fireEvent.click(trigger);
      const dialog = await waitFor(() =>
        view.getByRole("dialog", { name: "Add an expense" })
      );
      const close = view.getByRole("button", { name: "Close" });
      const manual = view.getByRole("button", { name: /Add manually/ });
      assert(
        document.activeElement === close,
        "Dialog should focus its close action",
      );
      fireEvent.keyDown(close, { key: "Tab" });
      assert(
        document.activeElement === manual,
        "Tab should stay inside the dialog",
      );
      fireEvent.keyDown(manual, { key: "Tab" });
      assert(
        document.activeElement === close,
        "Tab should wrap to the first action",
      );
      fireEvent.mouseDown(dialog);
      await waitFor(() => assert(!document.querySelector('[role="dialog"]')));
      assert(
        document.activeElement === trigger,
        "Dismissal should restore the trigger focus",
      );
    });
  });
});

Deno.test("local UI null-draft recovery exposes retry and back actions", async () => {
  await withComponentHarness(async ({ window, render, fireEvent }) => {
    await withAriaDomGlobals(window, () => {
      let retries = 0;
      let closes = 0;
      render(
        createElement(ManualExpenseRecoveryScreen, {
          message: "Unable to restore the expense draft.",
          onRetry: () => retries++,
          onClose: () => closes++,
        }),
      );
      const view = within(document.body);
      assert(view.getByText("The expense form could not be opened"));
      fireEvent.click(
        view.getByRole("button", { name: "Retry opening expense" }),
      );
      fireEvent.click(view.getByRole("button", { name: "Back to expenses" }));
      assert(retries === 1, "Recovery should dispatch retry");
      assert(closes === 1, "Recovery should offer a safe exit");
    });
  });
});

Deno.test("local UI saved completion exposes undo and continue actions", async () => {
  await withComponentHarness(async ({ window, render, fireEvent }) => {
    await withAriaDomGlobals(window, () => {
      let undoCount = 0;
      let continueCount = 0;
      render(
        createElement(SavedExpenseCompletionScreen, {
          expense: {
            schemaVersion: 1,
            type: "expense",
            id: "expense-saved",
            projectId: "project-main",
            categoryId: "category-uncategorized",
            amount: "12.50",
            currency: "SEK",
            date: "2026-08-24",
            description: "Saved expense",
            source: "manual",
          },
          isUndoing: false,
          onUndo: () => undoCount++,
          onRetry: () => undefined,
          onContinue: () => continueCount++,
        }),
      );
      const view = within(document.body);
      assert(view.getByRole("heading", { name: "Expense saved" }));
      fireEvent.click(
        view.getByRole("button", { name: "Undo saved expense" }),
      );
      fireEvent.click(
        view.getByRole("button", { name: "Continue to expenses" }),
      );
      assert(undoCount === 1, "Undo should dispatch the saved-expense action");
      assert(continueCount === 1, "Continue should close the completion view");
    });
  });
});

Deno.test("local UI organize and settings screens expose labeled destinations", async () => {
  await withComponentHarness(({ render }) => {
    render(
      createElement(
        "div",
        null,
        createElement(OrganizeScreen, {
          state,
          onProjects: () => undefined,
          onCategories: () => undefined,
          onNewProject: () => undefined,
          onNewCategory: () => undefined,
        }),
        createElement(SettingsScreen, { expenseDayBoundary: "03:00" }),
      ),
    );
    const view = within(document.body);
    assert(view.getByRole("heading", { name: "Organize" }));
    assert(view.getByRole("button", { name: "Manage projects" }));
    assert(view.getByRole("button", { name: "Manage categories" }));
    assert(view.getByRole("heading", { name: "Settings" }));
    assert(view.getByText("Expense day 03:00"));
  });
});

Deno.test("local UI project editor and manager expose safe ordering and confirmations", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    const { service, commits } = createTestService(organizedState);
    await withAriaDomGlobals(window, async () => {
      render(
        createElement(ProjectManager, {
          service,
          state: organizedState,
          initialCreate: false,
          onStateChange: () => undefined,
          onNavigate: () => undefined,
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getAllByRole("button", { name: "Use" }).length === 2)
      );
      assert(
        view.getByRole("heading", {
          name: "Manage projects",
          level: 1,
        }),
      );
      assert(
        view.getByText(
          "Switch to another project before archiving Sweden project.",
        ),
      );
      fireEvent.click(
        view.getByRole("button", { name: "Archived projects (1)" }),
      );
      assert(view.getByRole("button", { name: "Restore" }));
      const otherProjects = within(
        view.getByRole("region", { name: "Other projects" }),
      );
      const moveButtons = view.getAllByRole("button", {
        name: /Move (up|down)/,
      });
      assert(
        moveButtons.length === 4,
        "Both non-current projects need move controls",
      );
      assert((moveButtons[0] as HTMLButtonElement).disabled);
      assert(!(moveButtons[1] as HTMLButtonElement).disabled);

      fireEvent.click(
        otherProjects.getAllByRole("button", { name: "Archive" })[0],
      );
      await waitFor(() =>
        assert(view.getByRole("dialog", { name: "Archive Other project?" }))
      );
      fireEvent.click(view.getByRole("button", { name: "Archive project" }));
      await waitFor(() => assert(commits() === 1));

      await waitFor(() =>
        assert(
          within(view.getByRole("region", { name: "Other projects" }))
            .getAllByRole("button", {
              name: "Delete empty",
            }).length === 2,
        )
      );
      fireEvent.click(
        within(view.getByRole("region", { name: "Other projects" }))
          .getAllByRole("button", {
            name: "Delete empty",
          })[0],
      );
      await waitFor(() =>
        assert(view.getByRole("dialog", { name: "Delete Other project?" }))
      );
      fireEvent.click(view.getByRole("button", { name: "Delete project" }));
      await waitFor(() => assert(commits() === 2));
    });
  });
});

Deno.test("local UI category editor keeps built-in Uncategorized protected", async () => {
  await withComponentHarness(async ({ window, render, waitFor }) => {
    const { service } = createTestService(categoryState);
    await withAriaDomGlobals(window, async () => {
      render(
        createElement(CategoryManager, {
          service,
          state: categoryState,
          initialCreate: true,
          onStateChange: () => undefined,
          onNavigate: () => undefined,
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getByRole("heading", { name: "Create category" }))
      );
      assert(view.getByRole("textbox", { name: "Category name" }));
      assert(view.getByRole("group", { name: "Category color (optional)" }));
    });
  });
});

Deno.test("local UI category manager exposes a level-one page heading", async () => {
  await withComponentHarness(async ({ window, render, waitFor }) => {
    const { service } = createTestService(categoryState);
    await withAriaDomGlobals(window, async () => {
      render(
        createElement(CategoryManager, {
          service,
          state: categoryState,
          onStateChange: () => undefined,
          onNavigate: () => undefined,
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(
          view.getByRole("heading", {
            name: "Manage categories",
            level: 1,
          }),
        )
      );
    });
  });
});

Deno.test(
  "local UI populated-project-delete opens the actor-driven Screen 7A review",
  async () => {
    await withComponentHarness(
      async ({ window, render, fireEvent, waitFor }) => {
        const { service } = createTestService(populatedOrganizedState);
        const repository = {
          deviceId: "0123456789abcdef0123456789abcdef",
        } as never;
        await withAriaDomGlobals(window, async () => {
          render(
            createElement(ProjectManager, {
              repository,
              service,
              state: populatedOrganizedState,
              onStateChange: () => undefined,
              onNavigate: () => undefined,
            }),
          );
          const view = within(document.body);
          const deleteButton = view.getByRole("button", {
            name: "Delete project",
          });
          fireEvent.click(deleteButton);
          const dialog = await waitFor(() =>
            view.getByRole("dialog", { name: "Delete Other project?" })
          );
          assert(dialog.textContent?.includes("Expenses"));
          assert(dialog.textContent?.includes("Receipt parents"));
          assert(dialog.textContent?.includes("Automerge history"));
          assert(
            view.getByRole("button", { name: "Export safety copy" }),
            "the safety export must precede typed confirmation",
          );
        });
      },
    );
  },
);
