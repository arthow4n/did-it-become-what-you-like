import { isAdapterError } from "../../adapters/ports/errors.ts";
import {
  createProjectCategoryService,
  type ProjectCategoryService,
  type ProjectCategoryState,
  redirectDeletedCategoryReference,
  selectCategoryActions,
  selectCurrentProject,
  selectDefaultProject,
  selectFirstProject,
  selectLastSelectedProject,
  selectProjectActions,
} from "../organization.ts";
import {
  createFakeLocalPort,
  type FakeLocalPort,
} from "../../test-support/fakes/ports.ts";
import { CategorySchema, UNCATEGORIZED_CATEGORY_ID } from "../index.ts";

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

async function rejectsWithCode(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    assert(isAdapterError(error));
    assertEquals(error.code, code);
    return;
  }
  throw new Error(`Expected adapter error ${code}`);
}

const projectOne = {
  schemaVersion: 1 as const,
  type: "project" as const,
  id: "project-one",
  name: "One",
  defaultCurrency: "SEK" as const,
  archived: false,
};

const projectTwo = {
  ...projectOne,
  id: "project-two",
  name: "Two",
};

const food = {
  schemaVersion: 1 as const,
  type: "category" as const,
  id: "category-food",
  name: "Food",
  sortOrder: 1,
  archived: false,
  system: false,
};

const travel = {
  ...food,
  id: "category-travel",
  name: "Travel",
  sortOrder: 2,
};

function expense(id: string, categoryId = food.id) {
  return {
    schemaVersion: 1 as const,
    type: "expense" as const,
    id,
    projectId: projectOne.id,
    categoryId,
    date: "2026-08-24",
    amount: "-10",
    currency: "SEK" as const,
    description: "Coffee",
    source: "manual" as const,
  };
}

function createService(
  local: FakeLocalPort = createFakeLocalPort(),
): { readonly local: FakeLocalPort; readonly service: ProjectCategoryService } {
  return {
    local,
    service: createProjectCategoryService(local, {
      deviceId: "device-test",
      now: () => "2026-08-24T03:20:00.000Z",
    }),
  };
}

async function seed(
  local: FakeLocalPort,
  records: readonly Record<string, unknown>[],
): Promise<void> {
  await local.transaction("readwrite", async (transaction) => {
    for (const record of records) {
      await transaction.put(
        "records",
        String(record.id),
        record as never,
      );
    }
  });
}

function projectIds(state: ProjectCategoryState): readonly string[] {
  return state.projects.map((project) => project.id);
}

Deno.test("organization: first/default/last-selected project and stable reorder", async () => {
  const { service } = createService();
  let state = await service.getState();
  assertEquals(state.categories.map((category) => category.id), [
    UNCATEGORIZED_CATEGORY_ID,
  ]);
  assertEquals(state.selectedProjectId, undefined);

  let rejected = false;
  try {
    await service.commitProject({
      type: "create",
      project: { ...projectOne, id: "project-archived-first", archived: true },
    });
  } catch (error) {
    rejected = true;
    assertEquals((error as { code: string }).code, "last-active-project");
  }
  assert(rejected, "an active project must exist before an archived project");

  await service.commitProject({ type: "create", project: projectOne });
  await service.commitProject({ type: "create", project: projectTwo });
  state = await service.getState();
  assertEquals(projectIds(state), [projectOne.id, projectTwo.id]);
  assertEquals(selectFirstProject(state.projects)?.id, projectOne.id);
  assertEquals(selectDefaultProject(state.projects)?.id, projectOne.id);
  assertEquals(
    selectLastSelectedProject(state.projects, state.lastSelectedProjectId)?.id,
    projectOne.id,
  );
  assertEquals(
    selectCurrentProject(state.projects, state.lastSelectedProjectId)?.id,
    projectOne.id,
  );

  await service.commitProject({ type: "select", projectId: projectTwo.id });
  await service.commitProject({
    type: "reorder",
    orderedIds: [projectTwo.id, projectOne.id],
  });
  state = await service.getState();
  assertEquals(projectIds(state), [projectTwo.id, projectOne.id]);
  assertEquals(state.selectedProjectId, projectTwo.id);
  assertEquals(state.projects.map((project) => project.id), [
    projectTwo.id,
    projectOne.id,
  ]);
  assertEquals(state.projects[0]?.id, projectTwo.id);
});

Deno.test("organization: current-project archive guard, restore, active invariant, and currency", async () => {
  const { service } = createService();
  await service.commitProject({ type: "create", project: projectOne });
  await service.commitProject({ type: "create", project: projectTwo });

  let rejected = false;
  try {
    await service.commitProject({ type: "archive", projectId: projectOne.id });
  } catch (error) {
    rejected = true;
    assertEquals((error as { code: string }).code, "current-project");
  }
  assert(rejected, "archiving the current project must be rejected");

  await service.commitProject({ type: "select", projectId: projectTwo.id });
  await service.commitProject({ type: "archive", projectId: projectOne.id });
  let state = await service.getState();
  assertEquals(
    state.projects.find((project) => project.id === projectOne.id)?.archived,
    true,
  );
  await service.commitProject({ type: "restore", projectId: projectOne.id });
  await service.setProjectDefaultCurrency(projectOne.id, "USD");
  state = await service.getState();
  assertEquals(
    state.projects.find((project) => project.id === projectOne.id)
      ?.defaultCurrency,
    "USD",
  );

  await service.commitProject({ type: "select", projectId: projectOne.id });
  await service.commitProject({ type: "archive", projectId: projectTwo.id });
  rejected = false;
  try {
    await service.commitProject({ type: "archive", projectId: projectOne.id });
  } catch (error) {
    rejected = true;
    assertEquals((error as { code: string }).code, "current-project");
  }
  assert(rejected, "the selected project cannot be archived");
});

Deno.test("organization: confirmed empty deletion preserves at least one project", async () => {
  const { service } = createService();
  await service.commitProject({ type: "create", project: projectOne });
  await service.commitProject({ type: "create", project: projectTwo });

  let rejected = false;
  try {
    await service.commitProject({
      type: "delete-empty",
      projectId: projectTwo.id,
    });
  } catch (error) {
    rejected = true;
    assertEquals((error as { code: string }).code, "requires-confirmation");
  }
  assert(rejected, "empty deletion must require confirmation");

  const result = await service.commitProject(
    { type: "delete-empty", projectId: projectTwo.id },
    { confirmed: true },
  );
  assertEquals(result.projects.map((project) => project.id), [projectOne.id]);
  const state = await service.getState();
  assertEquals(state.projects.map((project) => project.id), [projectOne.id]);
  assertEquals(
    state.tombstones.find((tombstone) => tombstone.targetId === projectTwo.id)
      ?.targetType,
    "project",
  );

  rejected = false;
  try {
    await service.commitProject({ type: "archive", projectId: projectOne.id });
  } catch (error) {
    rejected = true;
    assertEquals((error as { code: string }).code, "current-project");
  }
  assert(rejected, "the current project must be switched before archiving");

  rejected = false;
  try {
    await service.commitProject(
      { type: "delete-empty", projectId: projectOne.id },
      { confirmed: true },
    );
  } catch (error) {
    rejected = true;
    assertEquals((error as { code: string }).code, "last-active-project");
  }
  assert(rejected, "the last active project cannot be deleted");
});

Deno.test("organization: category uniqueness, order, archive, and Uncategorized protection", async () => {
  const { service } = createService();
  await service.commitCategory({ type: "create", category: food });
  await service.commitCategory({ type: "create", category: travel });

  let rejected = false;
  try {
    await service.commitCategory({
      type: "rename",
      categoryId: travel.id,
      name: " food ",
    });
  } catch (error) {
    rejected = true;
    assertEquals((error as { code: string }).code, "conflict");
  }
  assert(rejected, "active category names are case-insensitively unique");

  await service.commitCategory({
    type: "reorder",
    orderedIds: [travel.id, food.id],
  });
  await service.commitCategory({ type: "archive", categoryId: food.id });
  await service.commitCategory({ type: "restore", categoryId: food.id });
  let state = await service.getState();
  assertEquals(state.categories.map((category) => category.id), [
    UNCATEGORIZED_CATEGORY_ID,
    travel.id,
    food.id,
  ]);

  for (
    const command of [
      { type: "rename", categoryId: UNCATEGORIZED_CATEGORY_ID, name: "Other" },
      { type: "archive", categoryId: UNCATEGORIZED_CATEGORY_ID },
      {
        type: "reorder",
        orderedIds: [UNCATEGORIZED_CATEGORY_ID, travel.id, food.id],
      },
      {
        type: "delete-and-reassign",
        categoryId: UNCATEGORIZED_CATEGORY_ID,
        replacementCategoryId: food.id,
      },
    ] as const
  ) {
    rejected = false;
    try {
      await service.commitCategory(command);
    } catch (error) {
      rejected = true;
      assertEquals((error as { code: string }).code, "protected");
    }
    assert(rejected, "Uncategorized must remain protected");
  }
  state = await service.getState();
  assertEquals(
    state.categories.find((category) => category.system)?.name,
    "Uncategorized",
  );
});

Deno.test("organization: category rename updates, preserves, and clears color", async () => {
  const { service } = createService();
  await service.commitCategory({
    type: "create",
    category: { ...food, color: "#78DCCA" },
  });

  await service.commitCategory({
    type: "rename",
    categoryId: food.id,
    name: "Groceries",
  });
  let state = await service.getState();
  assertEquals(
    state.categories.find((candidate) => candidate.id === food.id)?.color,
    "#78DCCA",
  );

  await service.commitCategory({
    type: "rename",
    categoryId: food.id,
    name: "Groceries",
    color: "#8FC8F8",
  });
  state = await service.getState();
  assertEquals(
    state.categories.find((candidate) => candidate.id === food.id)?.color,
    "#8FC8F8",
  );

  await service.commitCategory({
    type: "rename",
    categoryId: food.id,
    name: "Groceries",
    color: undefined,
  });
  state = await service.getState();
  assert(
    !Object.prototype.hasOwnProperty.call(
      state.categories.find((candidate) => candidate.id === food.id),
      "color",
    ),
    "explicitly clearing a color removes the optional stored property",
  );
});

Deno.test("organization: delete-and-reassign atomically updates every category reference", async () => {
  const { local, service } = createService();
  await seed(local, [projectOne, food, travel, expense("expense-food")]);
  const receipt = {
    schemaVersion: 1 as const,
    type: "receipt" as const,
    id: "receipt-1",
    projectId: projectOne.id,
    date: "2026-08-24",
    currency: "SEK" as const,
    printedTotal: "-10",
  };
  const purchaseLine = {
    schemaVersion: 1 as const,
    type: "receipt-purchase-line" as const,
    id: "line-1",
    receiptId: receipt.id,
    projectId: projectOne.id,
    categoryId: food.id,
    description: "Food",
    lineTotal: "-8",
  };
  const adjustment = {
    schemaVersion: 1 as const,
    type: "receipt-adjustment" as const,
    id: "adjustment-1",
    receiptId: receipt.id,
    projectId: projectOne.id,
    categoryId: food.id,
    description: "Refund",
    amount: "1",
    lineId: purchaseLine.id,
  };
  await seed(local, [receipt, purchaseLine, adjustment]);

  await service.commitCategory({
    type: "delete-and-reassign",
    categoryId: food.id,
    replacementCategoryId: travel.id,
  });
  const state = await service.getState();
  assert(!state.categories.some((category) => category.id === food.id));
  assertEquals(state.expenses[0]?.categoryId, travel.id);
  assertEquals(state.receiptPurchaseLines[0]?.categoryId, travel.id);
  assertEquals(state.receiptAdjustments[0]?.categoryId, travel.id);
  assertEquals(await service.resolveCategoryReference(food.id), travel.id);
  assertEquals(
    redirectDeletedCategoryReference(
      food.id,
      state.categories,
      state.tombstones,
    ),
    travel.id,
  );
});

Deno.test("organization: late tombstone chains redirect deterministically", () => {
  const replacement = CategorySchema.parse({
    schemaVersion: 1,
    type: "category",
    id: "category-final",
    name: "Final",
    sortOrder: 1,
    archived: false,
    system: false,
  });
  const tombstone = (id: string, replacementCategoryId: string) => ({
    schemaVersion: 1 as const,
    type: "tombstone" as const,
    id: `tombstone-category-${id}`,
    targetType: "category" as const,
    targetId: id,
    deletedAt: "2026-08-24T03:20:00.000Z",
    deletedBy: "device-test",
    replacementCategoryId,
  });
  assertEquals(
    redirectDeletedCategoryReference(
      "category-old",
      [replacement],
      [
        tombstone("category-old", "category-middle"),
        tombstone("category-middle", replacement.id),
      ],
    ),
    replacement.id,
  );
});

Deno.test("organization: invalid order, offline failure, and retry preserve local state", async () => {
  const { local, service } = createService();
  await service.commitProject({ type: "create", project: projectOne });
  await service.commitProject({ type: "create", project: projectTwo });
  await service.commitCategory({ type: "create", category: food });

  let rejected = false;
  try {
    await service.commitProject({
      type: "reorder",
      orderedIds: [projectOne.id],
    });
  } catch (error) {
    rejected = true;
    assertEquals((error as { code: string }).code, "invalid-order");
  }
  assert(
    rejected,
    "project reorder must be a complete active-project permutation",
  );

  local.setScenario({ offline: true });
  await rejectsWithCode(service.getState(), "offline");
  local.setScenario({ offline: false });
  local.failNext("quota");
  await rejectsWithCode(
    service.commitCategory({
      type: "rename",
      categoryId: food.id,
      name: "Meals",
    }),
    "quota",
  );
  const afterFailure = await service.getState();
  assertEquals(
    afterFailure.categories.find((category) => category.id === food.id)?.name,
    "Food",
  );
  await service.commitCategory({
    type: "rename",
    categoryId: food.id,
    name: "Meals",
  });
  assertEquals(
    (await service.getState()).categories.find((category) =>
      category.id === food.id
    )?.name,
    "Meals",
  );
});

Deno.test("organization: selectors expose only domain-valid actions", async () => {
  const { service } = createService();
  await service.commitProject({ type: "create", project: projectOne });
  const state = await service.getState();
  const projectActions = selectProjectActions(state);
  assert(
    !projectActions.some((action) =>
      action.type === "archive" && action.projectId === projectOne.id
    ),
    "the last current project cannot expose archive",
  );
  assert(
    !projectActions.some((action) =>
      action.type === "delete-empty" && action.projectId === projectOne.id
    ),
    "the last active project cannot expose delete",
  );
  const categoryActions = selectCategoryActions(state);
  assert(
    !categoryActions.some((action) =>
      (action.type === "archive" || action.type === "rename") &&
      action.categoryId === UNCATEGORIZED_CATEGORY_ID
    ),
    "Uncategorized cannot expose protected actions",
  );
});
