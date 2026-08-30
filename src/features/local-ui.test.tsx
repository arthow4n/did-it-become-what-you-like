import { within } from "@testing-library/dom";
import { createElement, useState } from "react";
import {
  CategoryManager,
  DirtyExitGuard,
  ExpensesScreen,
  firstUseRedirectPath,
  FirstUseScreen,
  LoadingScreen,
  type LocalUiPath,
  ManualExpenseRecoveryScreen,
  ManualExpenseScreen,
  manualExpenseSubmitEvent,
  type ManualSaveMode,
  OrganizeScreen,
  ProjectManager,
  SavedExpenseCompletionScreen,
  selectedNavigationForPath,
  SettingsScreen,
} from "./local-ui.tsx";
import type {
  CategoryOrganizationCommand,
  ProjectCategoryService,
  ProjectCategoryState,
} from "../domain/organization.ts";
import { OrganizationError } from "../domain/organization.ts";
import type { Expense } from "../domain/index.ts";
import { createFakeLocalPort } from "../test-support/fakes/ports.ts";
import {
  ImportExportScreen,
  type ImportViewModel,
} from "./conflict-import-ui/index.ts";
import {
  withAriaGlobals as withAriaDomGlobals,
  withComponentHarness,
} from "../test-support/component-harness.tsx";
import {
  type SyncStatusContextValue,
  SyncStatusProvider,
} from "./sync-ui/index.ts";
import { DefaultNavigation } from "../design-system/index.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function createTestService(
  initialState: ProjectCategoryState,
  getState: () => Promise<ProjectCategoryState> = () =>
    Promise.resolve(initialState),
): {
  service: ProjectCategoryService;
  commits: () => number;
  categoryCommands: CategoryOrganizationCommand[];
} {
  let commitCount = 0;
  const categoryCommands: CategoryOrganizationCommand[] = [];
  const output = () => ({
    projects: initialState.projects,
    categories: initialState.categories,
    selectedProjectId: initialState.selectedProjectId,
    state: initialState,
  });
  return {
    service: {
      getState,
      commitProject: () => {
        commitCount += 1;
        return Promise.resolve(output());
      },
      setProjectDefaultCurrency: () => {
        commitCount += 1;
        return Promise.resolve(output());
      },
      commitCategory: (command) => {
        commitCount += 1;
        categoryCommands.push(command);
        return Promise.resolve(output());
      },
      resolveCategoryReference: (categoryId) => Promise.resolve(categoryId),
    },
    commits: () => commitCount,
    categoryCommands,
  };
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

Deno.test("local UI first-use route redirects once a project exists", () => {
  assertEquals(firstUseRedirectPath("/first-use", 0), undefined);
  assertEquals(firstUseRedirectPath("/first-use", 1), "/expenses");
  assertEquals(firstUseRedirectPath("/expenses", 1), undefined);
});

for (const workflow of ["manual", "receipt"] as const) {
  Deno.test(
    `local UI ${workflow} dirty navigation offers keep or discard`,
    async () => {
      await withComponentHarness(
        async ({ window, render, fireEvent, waitFor }) => {
          await withAriaDomGlobals(window, async () => {
            const mounted = render(
              createElement(DirtyNavigationHarness, { workflow }),
            );
            const view = within(document.body);
            fireEvent.click(
              view.getByRole("button", {
                name: `Leave ${workflow} workflow`,
              }),
            );
            assert(view.getByRole("dialog", { name: "Unsaved changes" }));
            fireEvent.click(view.getByRole("button", { name: "Keep editing" }));
            assert(view.getByText(`${workflow} workflow`));
            fireEvent.click(
              view.getByRole("button", {
                name: `Leave ${workflow} workflow`,
              }),
            );
            fireEvent.click(
              view.getByRole("button", { name: "Discard changes" }),
            );
            await waitFor(() => assert(view.getByText("settings")));
            assert(!view.queryByText(`${workflow} workflow`));
            mounted.unmount();
          });
        },
      );
    },
  );
}

Deno.test("local UI manual deletion reports a deleted completion status", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const expense: Expense = {
        schemaVersion: 1,
        type: "expense",
        id: "expense-delete-feedback",
        projectId: project.id,
        categoryId: category.id,
        date: "2026-08-30",
        amount: "-8",
        currency: "SEK",
        description: "Expense to remove",
        source: "manual",
      };
      const local = createFakeLocalPort();
      await local.transaction(
        "readwrite",
        (transaction) => transaction.put("records", expense.id, expense),
      );
      const deletionState = { ...state, expenses: [expense] };
      const { service } = createTestService(deletionState);
      let completion: string | undefined;
      render(
        createElement(ManualExpenseScreen, {
          repository: local,
          service,
          state: deletionState,
          request: { expense },
          onSaved: () => undefined,
          onDirtyChange: () => undefined,
          onClosed: (status) => completion = status,
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getByRole("button", { name: "Delete this expense" }))
      );
      fireEvent.click(
        view.getByRole("button", { name: "Delete this expense" }),
      );
      await waitFor(() =>
        assert(view.getByRole("button", { name: "Delete expense" }))
      );
      local.failNext("quota");
      fireEvent.click(view.getByRole("button", { name: "Delete expense" }));
      await waitFor(() => assert(view.getByText("Expense deletion failed")));
      assert(view.getByRole("button", { name: "Retry deletion" }));
      assert(view.getByRole("button", { name: "Keep expense" }));
      local.clearFailures();
      fireEvent.click(view.getByRole("button", { name: "Retry deletion" }));
      await waitFor(() =>
        assert(completion === "deleted", "Deletion should report its status")
      );
    });
  });
});

Deno.test("local UI hydrated manual drafts expose an in-form discard action", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const local = createFakeLocalPort();
      await local.transaction(
        "readwrite",
        (transaction) =>
          transaction.put("workflow-snapshots", "workflow:manual-expense", {
            version: 1,
            kind: "manual-expense-draft",
            revision: 1,
            draft: {
              projectId: project.id,
              categoryId: category.id,
              date: "2026-08-30",
              amount: "4",
              currency: "SEK",
              description: "Restored draft",
              direction: "spent",
            },
          } as never),
      );
      const { service } = createTestService(state);
      let closed = false;
      render(
        createElement(ManualExpenseScreen, {
          repository: local,
          service,
          state,
          request: {},
          onSaved: () => undefined,
          onClosed: () => closed = true,
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getByRole("button", { name: "Discard draft" }))
      );
      fireEvent.click(view.getByRole("button", { name: "Discard draft" }));
      await waitFor(() => assert(view.getByText("Discard unsaved changes?")));
      fireEvent.click(view.getByRole("button", { name: "Discard changes" }));
      await waitFor(() => assert(closed));
      assertEquals(await local.query("workflow-snapshots"), []);
    });
  });
});

Deno.test("local UI opens a blank manual form after empty draft hydration", async () => {
  await withComponentHarness(async ({ window, render, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const local = createFakeLocalPort();
      const { service } = createTestService(state);
      render(
        createElement(ManualExpenseScreen, {
          repository: local,
          service,
          state,
          request: { projectId: project.id },
          onSaved: () => undefined,
          onClosed: () => undefined,
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getByRole("textbox", { name: "Amount" }))
      );
    });
  });
});

Deno.test("local UI isolates edit drafts from the new-expense draft key", async () => {
  await withComponentHarness(async ({ window, render, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const local = createFakeLocalPort();
      await local.transaction(
        "readwrite",
        (transaction) =>
          transaction.put("workflow-snapshots", "workflow:manual-expense", {
            version: 1,
            kind: "manual-expense-draft",
            revision: 1,
            draft: {
              projectId: project.id,
              categoryId: category.id,
              date: "2026-08-30",
              amount: "4",
              currency: "SEK",
              description: "New expense draft only",
              direction: "spent",
            },
          } as never),
      );
      const expense: Expense = {
        schemaVersion: 1,
        type: "expense",
        id: "expense-isolated-edit-draft",
        projectId: project.id,
        categoryId: category.id,
        date: "2026-08-30",
        amount: "-8",
        currency: "SEK",
        description: "Existing expense description",
        source: "manual",
      };
      const { service } = createTestService({ ...state, expenses: [expense] });
      render(
        createElement(ManualExpenseScreen, {
          repository: local,
          service,
          state: { ...state, expenses: [expense] },
          request: { expense },
          onSaved: () => undefined,
          onClosed: () => undefined,
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getByRole("textbox", { name: "Description (optional)" }))
      );
      const description = view.getByRole("textbox", {
        name: "Description (optional)",
      }) as HTMLTextAreaElement;
      assertEquals(description.value, "Existing expense description");
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
        onViewReceipt: () => undefined,
        onProjectChange: () => undefined,
      }),
    );
    const view = within(document.body);
    assert(view.getByRole("heading", { name: "Expenses" }));
    assert(view.getByRole("button", { name: /Filters/ }));
    const searchRow = document.querySelector(
      ".local-ui-expenses-filter-bar__search-row",
    );
    assert(searchRow, "Find and Filters should be grouped in search-row");
    assert(
      searchRow.querySelector(".local-ui-expenses-filter-bar__trigger"),
      "Filters button should be inside search-row",
    );
    assert(view.getByText("No expenses in this period"));
    assert(
      view.queryByRole("button", { name: "Add expense" }) === null,
      "Expenses header should not contain an Add expense action button",
    );
    fireEvent.click(view.getByRole("button", { name: "Add an expense" }));
    assert(
      addCount === 1,
      "Add an expense in empty state should dispatch the callback",
    );
  });
});

Deno.test("local UI expenses places sync status in the page header", async () => {
  await withComponentHarness(({ render, fireEvent }) => {
    let reconnected = 0;
    const syncStatus: SyncStatusContextValue = {
      view: {
        mode: "configured",
        accountEmail: "owner@example.com",
        network: "online",
        sync: "authorization-error",
        lastSyncedAt: null,
        pendingChangeCount: 1,
        unresolvedConflictCount: 0,
      },
      onOpenSync: () => undefined,
      onReconnect: () => reconnected++,
      notifyLocalMutation: () => undefined,
    };
    render(
      createElement(
        SyncStatusProvider,
        { value: syncStatus },
        createElement(ExpensesScreen, {
          state,
          expenseDayBoundary: "03:00",
          offline: false,
          onAdd: () => undefined,
          onEdit: () => undefined,
          onViewReceipt: () => undefined,
          onProjectChange: () => undefined,
        }),
      ),
    );
    const view = within(document.body);
    assert(view.getByRole("heading", { name: "Expenses" }));
    assert(view.getByText("Local only · Tap to reconnect"));
    assert(document.querySelector(".sync-ui-shell-status") === null);
    fireEvent.click(
      view.getByRole("button", { name: "Reconnect Google Drive" }),
    );
    assert(reconnected === 1);
  });
});

Deno.test("local UI manual saves notify when Drive authorization has expired", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const local = createFakeLocalPort();
      const { service } = createTestService(state);
      let notices = 0;
      let closed = 0;
      const syncStatus: SyncStatusContextValue = {
        view: {
          mode: "configured",
          accountEmail: "owner@example.com",
          network: "online",
          sync: "authorization-error",
          lastSyncedAt: null,
          pendingChangeCount: 0,
          unresolvedConflictCount: 0,
        },
        onOpenSync: () => undefined,
        onReconnect: () => undefined,
        notifyLocalMutation: () => notices++,
      };
      render(
        createElement(
          SyncStatusProvider,
          { value: syncStatus },
          createElement(ManualExpenseScreen, {
            repository: local,
            service,
            state,
            request: { projectId: project.id },
            onSaved: () => undefined,
            onClosed: () => closed++,
          }),
        ),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getByRole("textbox", { name: "Amount" }))
      );
      fireEvent.input(view.getByRole("textbox", { name: "Amount" }), {
        target: { value: "4" },
      });
      fireEvent.click(view.getByRole("button", { name: "Save expense" }));
      await waitFor(() =>
        assert(view.getByRole("heading", { name: "Expense saved" }))
      );
      assert(notices === 1, "A successful local save should notify once");
      assert(closed === 0, "The completion state should remain visible");
    });
  });
});

Deno.test("local UI locks manual controls while a save is in flight", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const local = createFakeLocalPort();
      let deferCommit = false;
      let releaseCommit!: (state: ProjectCategoryState) => void;
      const pendingCommit = new Promise<ProjectCategoryState>((resolve) => {
        releaseCommit = resolve;
      });
      const { service } = createTestService(
        state,
        () => deferCommit ? pendingCommit : Promise.resolve(state),
      );
      render(
        createElement(ManualExpenseScreen, {
          repository: local,
          service,
          state,
          request: { projectId: project.id },
          onSaved: () => undefined,
          onClosed: () => undefined,
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getByRole("textbox", { name: "Amount" }))
      );
      fireEvent.input(view.getByRole("textbox", { name: "Amount" }), {
        target: { value: "4" },
      });
      deferCommit = true;
      fireEvent.click(view.getByRole("button", { name: "Save expense" }));
      await waitFor(() =>
        assert(
          (view.getByRole("button", {
            name: "Save expense",
          }) as HTMLButtonElement).disabled,
        )
      );
      assert(
        (view.getByRole("textbox", { name: "Amount" }) as HTMLInputElement)
          .disabled,
      );
      assert(
        (view.getByRole("button", { name: "Close" }) as HTMLButtonElement)
          .disabled,
      );
      releaseCommit(state);
      await waitFor(() =>
        assert(view.getByRole("heading", { name: "Expense saved" }))
      );
    });
  });
});

Deno.test("local UI exposes draft persistence retry without discarding input", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const local = createFakeLocalPort();
      const { service } = createTestService(state);
      render(
        createElement(ManualExpenseScreen, {
          repository: local,
          service,
          state,
          request: { projectId: project.id },
          onSaved: () => undefined,
          onClosed: () => undefined,
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getByRole("textbox", { name: "Amount" }))
      );
      local.failNext("quota");
      fireEvent.input(view.getByRole("textbox", { name: "Amount" }), {
        target: { value: "4" },
      });
      await waitFor(() =>
        assert(view.getByRole("button", { name: "Retry draft save" }))
      );
      fireEvent.click(view.getByRole("button", { name: "Retry draft save" }));
      await waitFor(() =>
        assert(view.getByRole("button", { name: "Discard draft" }))
      );
      assertEquals(
        (view.getByRole("textbox", { name: "Amount" }) as HTMLInputElement)
          .value,
        "4",
      );
    });
  });
});

Deno.test("local UI add-another notifies sync and retains its actor lifecycle", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    await withAriaDomGlobals(window, async () => {
      const local = createFakeLocalPort();
      const { service } = createTestService(state);
      let notices = 0;
      const saveModes: ManualSaveMode[] = [];
      const syncStatus: SyncStatusContextValue = {
        view: {
          mode: "configured",
          accountEmail: "owner@example.com",
          network: "online",
          sync: "authorization-error",
          lastSyncedAt: null,
          pendingChangeCount: 0,
          unresolvedConflictCount: 0,
        },
        onOpenSync: () => undefined,
        onReconnect: () => undefined,
        notifyLocalMutation: () => notices++,
      };
      render(
        createElement(
          SyncStatusProvider,
          { value: syncStatus },
          createElement(ManualExpenseScreen, {
            repository: local,
            service,
            state,
            request: { projectId: project.id },
            onSaved: (_, mode) => saveModes.push(mode),
            onClosed: () => undefined,
          }),
        ),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getByRole("textbox", { name: "Amount" }))
      );
      fireEvent.input(view.getByRole("textbox", { name: "Amount" }), {
        target: { value: "4" },
      });
      fireEvent.click(
        view.getByRole("button", { name: "Save and add another" }),
      );
      await waitFor(() =>
        assert(
          (view.getByRole("textbox", {
            name: "Amount",
          }) as HTMLInputElement).value === "",
        )
      );
      assertEquals(notices, 1);
      assertEquals(saveModes, ["another"]);
    });
  });
});

Deno.test("local UI expenses interleaves receipt groups and shows every category", async () => {
  await withComponentHarness(({ render }) => {
    const categories = [
      category,
      {
        ...customCategory,
        id: "category-travel",
        name: "Travel",
        sortOrder: 2,
      },
      { ...customCategory, id: "category-home", name: "Home", sortOrder: 3 },
      { ...customCategory, id: "category-work", name: "Work", sortOrder: 4 },
    ];
    const receiptId = "receipt-feed";
    const timelineState: ProjectCategoryState = {
      ...state,
      categories,
      expenses: [
        {
          schemaVersion: 1,
          type: "expense",
          id: "expense-feed-before",
          projectId: project.id,
          categoryId: "category-travel",
          date: "2026-08-30",
          time: "19:00",
          amount: "-2",
          currency: "SEK",
          description: "Manual before receipt",
          source: "manual",
        },
        ...[
          ["category-home", "Home expense"],
          ["category-work", "Work expense"],
        ].map(([categoryId, description], index) => ({
          schemaVersion: 1 as const,
          type: "expense" as const,
          id: `expense-feed-${index}`,
          projectId: project.id,
          categoryId,
          date: "2026-08-30",
          time: "18:00",
          amount: "-1",
          currency: "SEK" as const,
          description,
          source: "manual" as const,
        })),
      ],
      receipts: [{
        schemaVersion: 1,
        type: "receipt" as const,
        id: receiptId,
        projectId: project.id,
        date: "2026-08-30",
        time: "20:00",
        merchant: "Receipt after manual",
        currency: "SEK" as const,
        printedTotal: "-3",
      }],
      receiptPurchaseLines: [{
        schemaVersion: 1,
        type: "receipt-purchase-line" as const,
        id: "line-feed",
        receiptId,
        projectId: project.id,
        categoryId: category.id,
        description: "Receipt item",
        lineTotal: "-3",
      }],
      receiptAdjustments: [],
    };
    render(
      createElement(ExpensesScreen, {
        state: timelineState,
        expenseDayBoundary: "03:00",
        offline: false,
        onAdd: () => undefined,
        onEdit: () => undefined,
        onViewReceipt: () => undefined,
        onProjectChange: () => undefined,
      }),
    );
    const view = within(document.body);
    const feed = document.querySelector<HTMLElement>(
      '[data-expenses-feed="true"]',
    );
    assert(feed);
    const feedText = feed.textContent ?? "";
    assert(
      (view.getByRole("radio", { name: "Today" }) as HTMLInputElement)
        .checked,
      "the expenses screen should initially filter to the current day",
    );
    assert(
      view.getByRole("button", { name: /Receipt after manual/ }).getAttribute(
        "aria-expanded",
      ) === "true",
      "receipt groups in the expenses list should be expanded initially",
    );
    assert(
      view.getByText("Receipt item"),
      "expanded receipt groups should show their expense lines immediately",
    );
    assert(
      feedText.indexOf("Receipt after manual") <
        feedText.indexOf("Manual before receipt"),
      "receipt groups and standalone expenses should share chronological order",
    );
    const categoryTotals = view.getByRole("list", { name: "Category totals" });
    assert(
      within(categoryTotals).getAllByRole("button").length === 4,
      "category breakdown should show every category with spending",
    );
  });
});

Deno.test("local UI shell navigation routes directly to manual and scan scenes", async () => {
  await withComponentHarness(async ({ window, render, fireEvent }) => {
    await withAriaDomGlobals(window, () => {
      let selectedTab: string = "";
      render(
        createElement(DefaultNavigation, {
          selected: "expenses",
          onSelect: (id: string) => {
            selectedTab = id;
          },
        }),
      );
      const view = within(document.body);
      assert(view.getByRole("button", { name: "Expenses" }));
      assert(view.getByRole("button", { name: "Manual" }));
      assert(view.getByRole("button", { name: "Scan" }));
      assert(view.getByRole("button", { name: "Organize" }));
      assert(view.getByRole("button", { name: "Settings" }));
      fireEvent.click(view.getByRole("button", { name: "Manual" }));
      assertEquals(selectedTab, "manual");
      fireEvent.click(view.getByRole("button", { name: "Scan" }));
      assertEquals(selectedTab, "scan");
    });
  });
});

Deno.test("local UI associates receipt detail with expenses navigation", () => {
  const editPath: LocalUiPath = "/expense/edit/expense-typed";
  assertEquals(selectedNavigationForPath(editPath), "manual");
  assertEquals(
    selectedNavigationForPath("/receipt/detail/receipt-123?line=line-456"),
    "expenses",
  );
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

Deno.test("local UI expense loading state exposes a level-one heading", async () => {
  await withComponentHarness(({ render }) => {
    render(createElement(LoadingScreen));
    const view = within(document.body);
    assert(view.getByRole("heading", { name: "Loading local data" }));
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
        createElement(SettingsScreen, {
          expenseDayBoundary: "03:00",
          syncSummary: "Synced · 2 minutes ago",
          receiptSummary: "Key and model configured",
          onSync: () => undefined,
          onReceipt: () => undefined,
          onPreferences: () => undefined,
          onImport: () => undefined,
          onPrivacy: () => undefined,
          onAbout: () => undefined,
        }),
      ),
    );
    const view = within(document.body);
    assert(view.getByRole("heading", { name: "Organize" }));
    assert(view.getByRole("button", { name: "Manage projects" }));
    assert(view.getByRole("button", { name: "Manage categories" }));
    assert(view.getByRole("heading", { name: "Settings" }));
    assert(view.getByText("Expense day 03:00"));
    assert(view.getByText("Synced · 2 minutes ago"));
    assert(view.getByText("Key and model configured"));
    assert(view.getByRole("button", { name: "Open Receipt scanning" }));
    assert(
      view.getByRole("button", { name: "Open Google Drive and sync" }),
    );
    assert(view.queryByText("Conflict review") === null);
  });
});

Deno.test("local UI organize screen displays all active categories and projects without truncation", async () => {
  await withComponentHarness(({ render }) => {
    const p1 = {
      ...project,
      id: "p1",
      name: "Project 1",
      defaultCurrency: "SEK",
    };
    const p2 = {
      ...project,
      id: "p2",
      name: "Project 2",
      defaultCurrency: "USD",
    };
    const p3 = {
      ...project,
      id: "p3",
      name: "Project 3",
      defaultCurrency: "EUR",
    };
    const p4 = {
      ...project,
      id: "p4",
      name: "Project 4",
      defaultCurrency: "GBP",
    };
    const c1 = { ...category, id: "c1", name: "Groceries", system: false };
    const c2 = { ...category, id: "c2", name: "Utilities", system: false };
    const c3 = { ...category, id: "c3", name: "Transport", system: false };
    const c4 = { ...category, id: "c4", name: "Entertainment", system: false };
    const multiCategoryState: ProjectCategoryState = {
      ...state,
      projects: [p1, p2, p3, p4],
      categories: [category, c1, c2, c3, c4],
    };
    render(
      createElement(OrganizeScreen, {
        state: multiCategoryState,
        onProjects: () => undefined,
        onCategories: () => undefined,
        onNewProject: () => undefined,
        onNewCategory: () => undefined,
      }),
    );
    const view = within(document.body);
    assert(view.getByText("Project 1"));
    assert(view.getByText("Project 2"));
    assert(view.getByText("Project 3"));
    assert(view.getByText("Project 4"));
    assert(view.getByText("Uncategorized"));
    assert(view.getByText("Groceries"));
    assert(view.getByText("Utilities"));
    assert(view.getByText("Transport"));
    assert(view.getByText("Entertainment"));
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

Deno.test("local UI archived empty projects can be deleted directly", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    const { service, commits } = createTestService(organizedState);
    await withAriaDomGlobals(window, async () => {
      render(
        createElement(ProjectManager, {
          service,
          state: organizedState,
          onStateChange: () => undefined,
          onNavigate: () => undefined,
        }),
      );
      const view = within(document.body);
      fireEvent.click(
        view.getByRole("button", { name: "Archived projects (1)" }),
      );
      const archivedRow = view.getByText("Archived project").closest("li");
      assert(archivedRow);
      fireEvent.click(
        within(archivedRow).getByRole("button", { name: "Delete empty" }),
      );
      const dialog = await waitFor(() =>
        view.getByRole("dialog", { name: "Delete Archived project?" })
      );
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete project" }),
      );
      await waitFor(() => assert(commits() === 1));
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
      assert(
        view.getByLabelText("Choose custom Category color (optional)"),
        "category color should expose a custom value control",
      );
    });
  });
});

Deno.test("local UI category conflict is anchored to the category name field", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    const { service } = createTestService(categoryState);
    const conflictService: ProjectCategoryService = {
      ...service,
      commitCategory: async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        throw new OrganizationError(
          "conflict",
          "Active category names must be unique.",
        );
      },
    };
    await withAriaDomGlobals(window, async () => {
      render(
        createElement(CategoryManager, {
          service: conflictService,
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
      const input = view.getByRole("textbox", { name: "Category name" });
      fireEvent.change(input, { target: { value: "Food" } });
      fireEvent.click(view.getByRole("button", { name: "Save category" }));
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      const currentInput = view.getByRole("textbox", {
        name: "Category name",
      });
      assert(
        currentInput.getAttribute("aria-invalid") === "true",
        "conflict should mark the category name field invalid",
      );
      assert(
        view.getAllByText("Active category names must be unique.").length === 2,
        "the conflict should be exposed by both the field and summary",
      );
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

Deno.test("local UI project editor uses level-one heading and ISO currency picker", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    const { service } = createTestService(organizedState);
    await withAriaDomGlobals(window, async () => {
      render(
        createElement(ProjectManager, {
          service,
          state: organizedState,
          initialCreate: true,
          onStateChange: () => undefined,
          onNavigate: () => undefined,
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(
          view.getByRole("heading", {
            name: "Create project",
            level: 1,
          }),
        )
      );
      assert(view.getByRole("combobox", { name: "Default currency" }));
      fireEvent.click(view.getByRole("button", { name: "Cancel" }));
      await waitFor(() =>
        assert(
          view.getByRole("heading", {
            name: "Manage projects",
            level: 1,
          }),
        )
      );
    });
  });
});

Deno.test("local UI project editor reports unsaved changes", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    const { service } = createTestService(organizedState);
    const dirtyStates: boolean[] = [];
    await withAriaDomGlobals(window, async () => {
      render(
        createElement(ProjectManager, {
          service,
          state: organizedState,
          initialCreate: true,
          onStateChange: () => undefined,
          onNavigate: () => undefined,
          onDirtyChange: (dirty) => dirtyStates.push(dirty),
        }),
      );
      const view = within(document.body);
      await waitFor(() =>
        assert(view.getByRole("heading", { name: "Create project" }))
      );
      fireEvent.change(view.getByRole("textbox", { name: "Project name" }), {
        target: { value: "Holiday" },
      });
      await waitFor(() => assert(dirtyStates[dirtyStates.length - 1] === true));
      fireEvent.click(view.getByRole("button", { name: "Cancel" }));
      await waitFor(() =>
        assert(dirtyStates[dirtyStates.length - 1] === false)
      );
    });
  });
});

for (
  const {
    entityName,
    initialState,
    fieldName,
    editButtonName,
    headingName,
    draftValue,
    makeManager,
    makeRefreshState,
    makeSecondRefreshState,
    expectedRefreshedValue,
  } of [
    {
      entityName: "project",
      initialState: organizedState,
      fieldName: "Project name",
      editButtonName: "Edit",
      headingName: "Edit project",
      draftValue: "My draft",
      makeManager: (s: ProjectCategoryState, service: ProjectCategoryService) =>
        createElement(ProjectManager, {
          service,
          state: s,
          onStateChange: () => undefined,
          onNavigate: () => undefined,
        }),
      makeRefreshState: (s: ProjectCategoryState) => ({
        ...s,
        projects: [
          { ...project, name: "Fresh project name" },
          otherProject,
          thirdProject,
          archivedProject,
        ],
      }),
      makeSecondRefreshState: (s: ProjectCategoryState) => ({
        ...s,
        projects: [
          { ...project, name: "Another remote name" },
          otherProject,
          thirdProject,
          archivedProject,
        ],
      }),
      expectedRefreshedValue: "Fresh project name",
    },
    {
      entityName: "category",
      initialState: categoryState,
      fieldName: "Category name",
      editButtonName: "Edit",
      headingName: "Edit category",
      draftValue: "My category draft",
      makeManager: (s: ProjectCategoryState, service: ProjectCategoryService) =>
        createElement(CategoryManager, {
          service,
          state: s,
          onStateChange: () => undefined,
          onNavigate: () => undefined,
        }),
      makeRefreshState: (s: ProjectCategoryState) => ({
        ...s,
        categories: [category, { ...customCategory, name: "Fresh category" }],
      }),
      makeSecondRefreshState: (s: ProjectCategoryState) => ({
        ...s,
        categories: [
          category,
          { ...customCategory, name: "Another remote category" },
        ],
      }),
      expectedRefreshedValue: "Fresh category",
    },
  ]
) {
  Deno.test(
    `local UI ${entityName} editor reconciles an external refresh without losing drafts`,
    async () => {
      await withComponentHarness(
        async ({ window, render, fireEvent, waitFor }) => {
          const { service } = createTestService(initialState);
          const mounted = await withAriaDomGlobals(
            window,
            () => render(makeManager(initialState, service)),
          );
          const view = within(document.body);
          await waitFor(() =>
            assert(view.getAllByRole("button", { name: editButtonName }))
          );
          fireEvent.click(
            view.getAllByRole("button", { name: editButtonName })[0],
          );
          await waitFor(() =>
            assert(view.getByRole("heading", { name: headingName }))
          );
          const refreshedState = makeRefreshState(initialState);
          mounted.rerender(makeManager(refreshedState, service));
          await waitFor(() =>
            assert(
              (view.getByRole("textbox", {
                name: fieldName,
              }) as HTMLInputElement).value === expectedRefreshedValue,
            )
          );
          fireEvent.change(view.getByRole("textbox", { name: fieldName }), {
            target: { value: draftValue },
          });
          const secondRefresh = makeSecondRefreshState(refreshedState);
          mounted.rerender(makeManager(secondRefresh, service));
          await waitFor(() =>
            assert(
              (view.getByRole("textbox", {
                name: fieldName,
              }) as HTMLInputElement).value === draftValue,
              `an external refresh must not overwrite a dirty ${entityName} draft`,
            )
          );
          mounted.unmount();
        },
      );
    },
  );
}

Deno.test("local UI category editor cancel button exits back to category list", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
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
      fireEvent.click(view.getByRole("button", { name: "Cancel" }));
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

Deno.test("local UI category editor submits the selected replacement color", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    const editableCategory = { ...customCategory, color: "#78DCCA" };
    const editableState = {
      ...categoryState,
      categories: [category, editableCategory],
    };
    const { service, categoryCommands } = createTestService(editableState);
    await withAriaDomGlobals(window, async () => {
      render(
        createElement(CategoryManager, {
          service,
          state: editableState,
          onStateChange: () => undefined,
          onNavigate: () => undefined,
        }),
      );
      const view = within(document.body);
      await waitFor(() => assert(view.getByRole("button", { name: "Edit" })));
      fireEvent.click(view.getByRole("button", { name: "Edit" }));
      await waitFor(() =>
        assert(view.getByRole("heading", { name: "Edit category" }))
      );
      fireEvent.click(view.getByRole("button", { name: "Choose #8FC8F8" }));
      fireEvent.click(view.getByRole("button", { name: "Save category" }));
      await waitFor(() => assert(categoryCommands.length === 1));
      assertEquals(categoryCommands[0], {
        type: "rename",
        categoryId: editableCategory.id,
        name: editableCategory.name,
        color: "#8FC8F8",
      });
    });
  });
});

Deno.test("local UI category deletion exposes replacement selection and affected count", async () => {
  await withComponentHarness(async ({ window, render, fireEvent, waitFor }) => {
    const { service, commits } = createTestService(categoryState);
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
        assert(view.getByRole("button", { name: "Delete and reassign" }))
      );
      fireEvent.click(
        view.getByRole("button", { name: "Delete and reassign" }),
      );
      const dialog = await waitFor(() =>
        view.getByRole("dialog", { name: "Delete Food?" })
      );
      assert(dialog.textContent?.includes("0 expenses"));
      assert(
        within(dialog).getByRole("combobox", { name: /Replacement category/ }),
      );
      assert(commits() === 0);
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    });
  });
});

for (
  const { name, setupState, openDelete } of [
    {
      name: "populated-project-delete",
      setupState: populatedOrganizedState,
      openDelete: (
        view: ReturnType<typeof within>,
        fireEvent: { click: (el: Element) => void },
      ) =>
        fireEvent.click(
          view.getByRole("button", { name: "Delete project" }),
        ),
    },
    {
      name: "archived populated-project-delete",
      setupState: {
        ...populatedOrganizedState,
        projects: [
          project,
          thirdProject,
          { ...otherProject, archived: true },
        ],
        projectOrder: [project.id, thirdProject.id],
      },
      openDelete: (
        view: ReturnType<typeof within>,
        fireEvent: { click: (el: Element) => void },
      ) => {
        fireEvent.click(
          view.getByRole("button", { name: "Archived projects (1)" }),
        );
        const row = view.getByText("Other project").closest("li");
        assert(row);
        fireEvent.click(
          within(row).getByRole("button", { name: "Delete project" }),
        );
      },
    },
  ]
) {
  Deno.test(
    `local UI ${name} opens the actor-driven Screen 7A review`,
    async () => {
      await withComponentHarness(
        async ({ window, render, fireEvent, waitFor }) => {
          const { service } = createTestService(setupState);
          const repository = {
            deviceId: "0123456789abcdef0123456789abcdef",
          } as never;
          await withAriaDomGlobals(window, async () => {
            render(
              createElement(ProjectManager, {
                repository,
                service,
                state: setupState,
                onStateChange: () => undefined,
                onNavigate: () => undefined,
              }),
            );
            const view = within(document.body);
            openDelete(view, fireEvent);
            const dialog = await waitFor(() =>
              view.getByRole("dialog", { name: "Delete Other project?" })
            );
            assert(dialog.textContent?.includes("Expenses"));
            assert(dialog.textContent?.includes("Receipt parents"));
            assert(dialog.textContent?.includes("Automerge history"));
            assert(
              within(dialog).getByRole("button", {
                name: "Export safety copy",
              }),
              "the safety export must precede typed confirmation",
            );
          });
        },
      );
    },
  );
}
