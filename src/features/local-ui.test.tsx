import { within } from "@testing-library/dom";
import { createElement } from "react";
import {
  AddChoiceScreen,
  CategoryManager,
  ExpensesScreen,
  FirstUseScreen,
  OrganizeScreen,
  ProjectManager,
  SettingsScreen,
} from "./local-ui.tsx";
import type {
  ProjectCategoryService,
  ProjectCategoryState,
} from "../domain/organization.ts";
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
  await withComponentHarness(({ render }) => {
    render(
      createElement(FirstUseScreen, {
        onCreateProject: () => undefined,
        onRestoreBackup: () => undefined,
        onConnectDrive: () => undefined,
      }),
    );
    const view = within(document.body);
    assert(view.getByRole("heading", { name: "Start tracking expenses" }));
    assert(view.getByRole("button", { name: /Create first project/ }));
    assert(view.getByRole("button", { name: /Restore JSON backup/ }));
    assert(view.getByRole("button", { name: /Connect Google Drive/ }));
    assert(view.getByRole("status"));
  });
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
  await withComponentHarness(({ render, fireEvent }) => {
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
      assert(view.getByRole("heading", { name: "Manage projects" }));
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
