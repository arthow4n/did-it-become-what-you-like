import {
  type Category,
  CategorySchema,
  type Expense,
  ExpenseSchema,
  type Project,
  ProjectSchema,
  type ReceiptAdjustment,
  ReceiptAdjustmentSchema,
  type ReceiptParent,
  ReceiptParentSchema,
  type ReceiptPurchaseLine,
  ReceiptPurchaseLineSchema,
  type StableId,
  StableIdSchema,
  type Tombstone,
  TombstoneSchema,
  UNCATEGORIZED_CATEGORY_ID,
} from "../schema/index.ts";
import {
  asOrganizationJsonValue,
  type CategoryOrganizationCommand,
  DEFAULT_UNCATEGORIZED,
  type OrganizationCommitOutput,
  OrganizationError,
  type OrganizationJsonValue,
  type OrganizationStore,
  type OrganizationTransaction,
  PROJECT_ORGANIZATION_SETTINGS_KEY,
  type ProjectCategoryState,
  type ProjectOrganizationCommand,
  type ProjectOrganizationSettings,
} from "./types.ts";
import {
  projectIsEmpty,
  selectCurrentProject,
  selectFirstProject,
  selectLastSelectedProject,
  sortCategories,
  sortProjects,
  stableSort,
} from "./selectors.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSettings(
  value: OrganizationJsonValue | undefined,
): ProjectOrganizationSettings {
  if (!isObject(value)) {
    return { orderedProjectIds: [] };
  }
  const order = Array.isArray(value.orderedProjectIds)
    ? value.orderedProjectIds.filter((id): id is string =>
      typeof id === "string"
    )
    : [];
  const lastSelectedProjectId = typeof value.lastSelectedProjectId === "string"
    ? value.lastSelectedProjectId
    : undefined;
  return { orderedProjectIds: order, lastSelectedProjectId };
}

function settingsValue(
  settings: ProjectOrganizationSettings,
): OrganizationJsonValue {
  return asOrganizationJsonValue({
    orderedProjectIds: [...settings.orderedProjectIds],
    ...(settings.lastSelectedProjectId === undefined
      ? {}
      : { lastSelectedProjectId: settings.lastSelectedProjectId }),
  });
}

function tombstoneId(type: "project" | "category", id: StableId): StableId {
  return StableIdSchema.parse(`tombstone-${type}-${id}`);
}

function parseRecord<T>(
  parser: { parse(value: unknown): T },
  value: unknown,
): T {
  try {
    return parser.parse(value);
  } catch {
    throw new OrganizationError("corrupt-data");
  }
}

type ParsedRecords = {
  projects: Project[];
  categories: Category[];
  expenses: Expense[];
  receipts: ReceiptParent[];
  receiptPurchaseLines: ReceiptPurchaseLine[];
  receiptAdjustments: ReceiptAdjustment[];
  tombstones: Tombstone[];
};

async function readRecords(
  transaction: OrganizationTransaction,
): Promise<ParsedRecords> {
  const records: ParsedRecords = {
    projects: [],
    categories: [],
    expenses: [],
    receipts: [],
    receiptPurchaseLines: [],
    receiptAdjustments: [],
    tombstones: [],
  };
  const entries = await transaction.query("records");
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!isObject(entry.value) || typeof entry.value.type !== "string") {
      continue;
    }
    const id = typeof entry.value.id === "string" ? entry.value.id : entry.key;
    if (ids.has(id)) throw new OrganizationError("corrupt-data");
    ids.add(id);
    switch (entry.value.type) {
      case "project":
        records.projects.push(parseRecord(ProjectSchema, entry.value));
        break;
      case "category":
        records.categories.push(parseRecord(CategorySchema, entry.value));
        break;
      case "expense":
        records.expenses.push(parseRecord(ExpenseSchema, entry.value));
        break;
      case "receipt":
        records.receipts.push(parseRecord(ReceiptParentSchema, entry.value));
        break;
      case "receipt-purchase-line":
        records.receiptPurchaseLines.push(
          parseRecord(ReceiptPurchaseLineSchema, entry.value),
        );
        break;
      case "receipt-adjustment":
        records.receiptAdjustments.push(
          parseRecord(ReceiptAdjustmentSchema, entry.value),
        );
        break;
      case "tombstone":
        records.tombstones.push(parseRecord(TombstoneSchema, entry.value));
        break;
      default:
        break;
    }
  }
  return records;
}

function activeProjectIds(projects: readonly Project[]): readonly StableId[] {
  return projects.filter((project) => !project.archived).map((project) =>
    project.id
  );
}

function activeCategoryIds(
  categories: readonly Category[],
): readonly StableId[] {
  return categories.filter((category) => !category.archived && !category.system)
    .map((category) => category.id);
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((id) => right.includes(id));
}

function assertActiveNameUnique(
  categories: readonly Category[],
  name: string,
  excludedId?: StableId,
): void {
  const normalized = name.trim().toLocaleLowerCase("en-US");
  if (
    categories.some((category) =>
      !category.archived && category.id !== excludedId &&
      category.name.trim().toLocaleLowerCase("en-US") === normalized
    )
  ) {
    throw new OrganizationError(
      "conflict",
      "Active category names must be unique.",
    );
  }
}

function findProject(
  state: ParsedRecords,
  projectId: StableId,
): Project {
  const project = state.projects.find((candidate) =>
    candidate.id === projectId
  );
  if (!project) throw new OrganizationError("not-found");
  return project;
}

function findCategory(
  state: ParsedRecords,
  categoryId: StableId,
): Category {
  const category = state.categories.find((candidate) =>
    candidate.id === categoryId
  );
  if (!category) throw new OrganizationError("not-found");
  return category;
}

function hasTombstone(
  state: ParsedRecords,
  targetType: "project" | "category",
  targetId: StableId,
): boolean {
  return state.tombstones.some((tombstone) =>
    tombstone.targetType === targetType && tombstone.targetId === targetId
  );
}

function createProjectTombstone(
  id: StableId,
  deletedAt: string,
  deletedBy: StableId,
): Tombstone {
  return {
    schemaVersion: 1,
    type: "tombstone",
    id: tombstoneId("project", id),
    targetType: "project",
    targetId: id,
    deletedAt,
    deletedBy,
  };
}

function createCategoryTombstone(
  id: StableId,
  replacementCategoryId: StableId,
  deletedAt: string,
  deletedBy: StableId,
): Tombstone {
  return {
    schemaVersion: 1,
    type: "tombstone",
    id: tombstoneId("category", id),
    targetType: "category",
    targetId: id,
    deletedAt,
    deletedBy,
    replacementCategoryId,
  };
}

function buildState(
  records: ParsedRecords,
  settings: ProjectOrganizationSettings,
): ProjectCategoryState {
  const projectOrder = stableSort(
    records.projects,
    settings.orderedProjectIds,
  ).map((project) => project.id);
  const projects = sortProjects(records.projects, projectOrder);
  const categories = sortCategories(records.categories);
  const selected = selectCurrentProject(
    projects,
    settings.lastSelectedProjectId,
  );
  const lastSelected = selectLastSelectedProject(
    projects,
    settings.lastSelectedProjectId,
  );
  const first = selectFirstProject(projects);
  return {
    projects,
    categories,
    expenses: records.expenses,
    receipts: records.receipts,
    receiptPurchaseLines: records.receiptPurchaseLines,
    receiptAdjustments: records.receiptAdjustments,
    tombstones: records.tombstones,
    projectOrder,
    lastSelectedProjectId: lastSelected?.id,
    selectedProjectId: selected?.id,
    firstProjectId: first?.id,
    defaultProjectId: first?.id,
  };
}

export function redirectDeletedCategoryReference(
  categoryId: StableId,
  categories: readonly Category[],
  tombstones: readonly Tombstone[],
): StableId {
  const categoryIds = new Set(categories.map((category) => category.id));
  const tombstonesById = new Map(
    tombstones
      .filter((tombstone) => tombstone.targetType === "category")
      .map((tombstone) => [tombstone.targetId, tombstone] as const),
  );
  const seen = new Set<StableId>();
  let current = categoryId;
  while (!categoryIds.has(current)) {
    if (seen.has(current)) throw new OrganizationError("corrupt-data");
    seen.add(current);
    const tombstone = tombstonesById.get(current);
    if (!tombstone?.replacementCategoryId) {
      throw new OrganizationError(
        "not-found",
        "The category reference is no longer available.",
      );
    }
    current = tombstone.replacementCategoryId;
  }
  return current;
}

export type ProjectCategoryService = {
  getState(): Promise<ProjectCategoryState>;
  commitProject(
    command: ProjectOrganizationCommand,
    options?: { readonly confirmed?: boolean },
  ): Promise<OrganizationCommitOutput>;
  setProjectDefaultCurrency(
    projectId: StableId,
    currency: Project["defaultCurrency"],
  ): Promise<OrganizationCommitOutput>;
  commitCategory(
    command: CategoryOrganizationCommand,
  ): Promise<OrganizationCommitOutput>;
  resolveCategoryReference(categoryId: StableId): Promise<StableId>;
};

export type ProjectCategoryServiceOptions = {
  readonly now?: () => string;
  readonly deviceId?: StableId;
};

export function createProjectCategoryService(
  store: OrganizationStore,
  options: ProjectCategoryServiceOptions = {},
): ProjectCategoryService {
  const now = options.now ?? (() => new Date().toISOString());
  const deviceId = StableIdSchema.parse(options.deviceId ?? "device-local");

  const writeSettings = async (
    transaction: OrganizationTransaction,
    settings: ProjectOrganizationSettings,
  ): Promise<void> => {
    await transaction.put(
      "settings",
      PROJECT_ORGANIZATION_SETTINGS_KEY,
      settingsValue(settings),
    );
  };

  const readStateInTransaction = async (
    transaction: OrganizationTransaction,
    ensureSystemCategory: boolean,
  ): Promise<ProjectCategoryState> => {
    const records = await readRecords(transaction);
    let categories = records.categories;
    if (
      !categories.some((category) => category.id === UNCATEGORIZED_CATEGORY_ID)
    ) {
      if (ensureSystemCategory) {
        await transaction.put(
          "records",
          UNCATEGORIZED_CATEGORY_ID,
          asOrganizationJsonValue(DEFAULT_UNCATEGORIZED),
        );
        categories = [...categories, DEFAULT_UNCATEGORIZED];
        records.categories = categories;
      } else {
        categories = [...categories, DEFAULT_UNCATEGORIZED];
        records.categories = categories;
      }
    }
    const settings = parseSettings(
      await transaction.get(
        "settings",
        PROJECT_ORGANIZATION_SETTINGS_KEY,
      ),
    );
    const existingIds = new Set(records.projects.map((project) => project.id));
    const projectOrder = settings.orderedProjectIds.filter((id) =>
      existingIds.has(id)
    );
    const lastSelected = selectLastSelectedProject(
      records.projects,
      settings.lastSelectedProjectId,
    )?.id;
    const first = selectFirstProject(
      sortProjects(records.projects, projectOrder),
    );
    const normalizedLastSelected = lastSelected ?? first?.id;
    if (
      projectOrder.length !== settings.orderedProjectIds.length ||
      projectOrder.length !== records.projects.length ||
      (normalizedLastSelected ?? undefined) !== settings.lastSelectedProjectId
    ) {
      const normalizedOrder = [
        ...projectOrder,
        ...records.projects
          .map((project) => project.id)
          .filter((id) => !projectOrder.includes(id)),
      ];
      await writeSettings(transaction, {
        orderedProjectIds: normalizedOrder,
        ...(normalizedLastSelected === undefined
          ? {}
          : { lastSelectedProjectId: normalizedLastSelected }),
      });
    }
    return buildState(records, {
      orderedProjectIds: [
        ...projectOrder,
        ...records.projects
          .map((project) => project.id)
          .filter((id) => !projectOrder.includes(id)),
      ],
      ...(normalizedLastSelected === undefined
        ? {}
        : { lastSelectedProjectId: normalizedLastSelected }),
    });
  };

  const mutate = async (
    operation: (
      transaction: OrganizationTransaction,
      state: ProjectCategoryState,
    ) => Promise<void>,
  ): Promise<OrganizationCommitOutput> => {
    return await store.transaction("readwrite", async (transaction) => {
      const before = await readStateInTransaction(transaction, true);
      await operation(transaction, before);
      const state = await readStateInTransaction(transaction, true);
      return {
        projects: state.projects,
        categories: state.categories,
        selectedProjectId: state.selectedProjectId,
        state,
      };
    });
  };

  const setLastSelected = async (
    transaction: OrganizationTransaction,
    state: ProjectCategoryState,
    selectedProjectId: StableId | undefined,
    projectOrder: readonly StableId[] = state.projectOrder,
  ): Promise<void> => {
    await writeSettings(transaction, {
      orderedProjectIds: projectOrder,
      ...(selectedProjectId === undefined
        ? {}
        : { lastSelectedProjectId: selectedProjectId }),
    });
  };

  const commitProject = (
    command: ProjectOrganizationCommand,
    commandOptions: { readonly confirmed?: boolean } = {},
  ): Promise<OrganizationCommitOutput> => {
    return mutate(async (transaction, state) => {
      switch (command.type) {
        case "create": {
          const project = ProjectSchema.parse(command.project);
          if (
            state.projects.some((candidate) => candidate.id === project.id) ||
            hasTombstone(
              {
                projects: [...state.projects],
                categories: [...state.categories],
                expenses: [...state.expenses],
                receipts: [...state.receipts],
                receiptPurchaseLines: [...state.receiptPurchaseLines],
                receiptAdjustments: [...state.receiptAdjustments],
                tombstones: [...state.tombstones],
              },
              "project",
              project.id,
            )
          ) {
            throw new OrganizationError("conflict");
          }
          if (
            project.archived &&
            state.projects.every((candidate) => candidate.archived)
          ) {
            throw new OrganizationError("last-active-project");
          }
          await transaction.put(
            "records",
            project.id,
            asOrganizationJsonValue(project),
          );
          const order = [...state.projectOrder, project.id];
          const selected = state.selectedProjectId ??
            (!project.archived ? project.id : undefined);
          await setLastSelected(
            transaction,
            { ...state, projectOrder: order },
            selected,
          );
          return;
        }
        case "rename": {
          const current = state.projects.find((project) =>
            project.id === command.projectId
          );
          if (!current) throw new OrganizationError("not-found");
          const renamed = ProjectSchema.parse({
            ...current,
            name: command.name,
          });
          await transaction.put(
            "records",
            renamed.id,
            asOrganizationJsonValue(renamed),
          );
          return;
        }
        case "select": {
          const project = state.projects.find((candidate) =>
            candidate.id === command.projectId
          );
          if (!project) throw new OrganizationError("not-found");
          if (project.archived) {
            throw new OrganizationError(
              "invalid",
              "Archived projects are not selectable.",
            );
          }
          await setLastSelected(transaction, state, project.id);
          return;
        }
        case "archive": {
          const project = findProject(
            {
              projects: [...state.projects],
              categories: [...state.categories],
              expenses: [...state.expenses],
              receipts: [...state.receipts],
              receiptPurchaseLines: [...state.receiptPurchaseLines],
              receiptAdjustments: [...state.receiptAdjustments],
              tombstones: [...state.tombstones],
            },
            command.projectId,
          );
          if (project.archived) return;
          if (project.id === state.selectedProjectId) {
            throw new OrganizationError("current-project");
          }
          if (
            state.projects.filter((candidate) => !candidate.archived).length <=
              1
          ) {
            throw new OrganizationError("last-active-project");
          }
          const archived = ProjectSchema.parse({ ...project, archived: true });
          await transaction.put(
            "records",
            archived.id,
            asOrganizationJsonValue(archived),
          );
          return;
        }
        case "restore": {
          const project = state.projects.find((candidate) =>
            candidate.id === command.projectId
          );
          if (!project) throw new OrganizationError("not-found");
          if (project.archived) {
            const restored = ProjectSchema.parse({
              ...project,
              archived: false,
            });
            await transaction.put(
              "records",
              restored.id,
              asOrganizationJsonValue(restored),
            );
          }
          return;
        }
        case "reorder": {
          const activeIds = activeProjectIds(state.projects);
          if (!sameIdSet(command.orderedIds, activeIds)) {
            throw new OrganizationError("invalid-order");
          }
          const archivedIds = state.projectOrder.filter((id) =>
            state.projects.some((project) =>
              project.id === id && project.archived
            )
          );
          await setLastSelected(
            transaction,
            state,
            state.selectedProjectId,
            [...command.orderedIds, ...archivedIds],
          );
          return;
        }
        case "delete-empty": {
          if (commandOptions.confirmed !== true) {
            throw new OrganizationError("requires-confirmation");
          }
          const project = state.projects.find((candidate) =>
            candidate.id === command.projectId
          );
          if (!project) throw new OrganizationError("not-found");
          if (!projectIsEmpty(state, project.id)) {
            throw new OrganizationError("not-empty");
          }
          if (
            !project.archived &&
            state.projects.filter((candidate) => !candidate.archived).length <=
              1
          ) {
            throw new OrganizationError("last-active-project");
          }
          await transaction.delete("records", project.id);
          await transaction.put(
            "records",
            tombstoneId("project", project.id),
            asOrganizationJsonValue(
              createProjectTombstone(project.id, now(), deviceId),
            ),
          );
          const nextOrder = state.projectOrder.filter((id) =>
            id !== project.id
          );
          const nextProjects = state.projects.filter((candidate) =>
            candidate.id !== project.id
          );
          const nextSelected = selectCurrentProject(nextProjects, undefined)
            ?.id;
          await setLastSelected(transaction, {
            ...state,
            projectOrder: nextOrder,
          }, nextSelected);
          return;
        }
      }
    });
  };

  const setProjectDefaultCurrency = (
    projectId: StableId,
    currency: Project["defaultCurrency"],
  ): Promise<OrganizationCommitOutput> => {
    return mutate(async (transaction, state) => {
      const project = state.projects.find((candidate) =>
        candidate.id === projectId
      );
      if (!project) throw new OrganizationError("not-found");
      const updated = ProjectSchema.parse({
        ...project,
        defaultCurrency: currency,
      });
      await transaction.put(
        "records",
        updated.id,
        asOrganizationJsonValue(updated),
      );
    });
  };

  const commitCategory = (
    command: CategoryOrganizationCommand,
  ): Promise<OrganizationCommitOutput> => {
    return mutate(async (transaction, state) => {
      const records: ParsedRecords = {
        projects: [...state.projects],
        categories: [...state.categories],
        expenses: [...state.expenses],
        receipts: [...state.receipts],
        receiptPurchaseLines: [...state.receiptPurchaseLines],
        receiptAdjustments: [...state.receiptAdjustments],
        tombstones: [...state.tombstones],
      };
      switch (command.type) {
        case "create": {
          const category = CategorySchema.parse(command.category);
          if (
            state.categories.some((candidate) =>
              candidate.id === category.id
            ) ||
            hasTombstone(records, "category", category.id)
          ) {
            throw new OrganizationError("conflict");
          }
          if (category.system || category.id === UNCATEGORIZED_CATEGORY_ID) {
            throw new OrganizationError("protected");
          }
          if (!category.archived) {
            assertActiveNameUnique(state.categories, category.name);
          }
          const maxSortOrder = state.categories.reduce(
            (maximum, candidate) => Math.max(maximum, candidate.sortOrder),
            0,
          );
          const {
            description: _rawDescription,
            ...categoryWithoutDescription
          } = category;
          const trimmedDescription = category.description?.trim();
          const created = CategorySchema.parse({
            ...categoryWithoutDescription,
            ...(trimmedDescription ? { description: trimmedDescription } : {}),
            sortOrder: category.archived
              ? category.sortOrder
              : maxSortOrder + 1,
          });
          await transaction.put(
            "records",
            created.id,
            asOrganizationJsonValue(created),
          );
          return;
        }
        case "rename": {
          const category = state.categories.find((candidate) =>
            candidate.id === command.categoryId
          );
          if (!category) throw new OrganizationError("not-found");
          if (category.system) throw new OrganizationError("protected");
          if (!category.archived) {
            assertActiveNameUnique(state.categories, command.name, category.id);
          }
          const {
            color: _currentColor,
            description: _currentDescription,
            ...categoryBase
          } = category;
          const trimmedCommandDescription = command.description?.trim();
          const renamed = CategorySchema.parse({
            ...categoryBase,
            name: command.name,
            ...("color" in command
              ? (command.color === undefined ? {} : { color: command.color })
              : category.color === undefined
              ? {}
              : { color: category.color }),
            ...("description" in command
              ? (trimmedCommandDescription
                ? { description: trimmedCommandDescription }
                : {})
              : category.description === undefined
              ? {}
              : { description: category.description }),
          });
          await transaction.put(
            "records",
            renamed.id,
            asOrganizationJsonValue(renamed),
          );
          return;
        }
        case "archive": {
          const category = findCategory(records, command.categoryId);
          if (category.system) throw new OrganizationError("protected");
          if (!category.archived) {
            const archived = CategorySchema.parse({
              ...category,
              archived: true,
            });
            await transaction.put(
              "records",
              archived.id,
              asOrganizationJsonValue(archived),
            );
          }
          return;
        }
        case "restore": {
          const category = findCategory(records, command.categoryId);
          if (category.system) throw new OrganizationError("protected");
          if (category.archived) {
            assertActiveNameUnique(
              state.categories,
              category.name,
              category.id,
            );
            const maxSortOrder = state.categories.reduce(
              (maximum, candidate) => Math.max(maximum, candidate.sortOrder),
              0,
            );
            const restored = CategorySchema.parse({
              ...category,
              archived: false,
              sortOrder: maxSortOrder + 1,
            });
            await transaction.put(
              "records",
              restored.id,
              asOrganizationJsonValue(restored),
            );
          }
          return;
        }
        case "reorder": {
          const activeIds = activeCategoryIds(state.categories);
          if (command.orderedIds.includes(UNCATEGORIZED_CATEGORY_ID)) {
            throw new OrganizationError("protected");
          }
          if (!sameIdSet(command.orderedIds, activeIds)) {
            throw new OrganizationError("invalid-order");
          }
          for (const [index, id] of command.orderedIds.entries()) {
            const category = state.categories.find((candidate) =>
              candidate.id === id
            );
            if (!category) throw new OrganizationError("not-found");
            const reordered = CategorySchema.parse({
              ...category,
              sortOrder: index + 1,
            });
            await transaction.put(
              "records",
              reordered.id,
              asOrganizationJsonValue(reordered),
            );
          }
          return;
        }
        case "delete-and-reassign": {
          const category = findCategory(records, command.categoryId);
          if (category.system) throw new OrganizationError("protected");
          const replacement = findCategory(
            records,
            command.replacementCategoryId,
          );
          if (replacement.id === category.id) {
            throw new OrganizationError(
              "invalid",
              "A category cannot replace itself.",
            );
          }
          for (const expense of state.expenses) {
            if (expense.categoryId === category.id) {
              await transaction.put(
                "records",
                expense.id,
                asOrganizationJsonValue({
                  ...expense,
                  categoryId: replacement.id,
                }),
              );
            }
          }
          for (const line of state.receiptPurchaseLines) {
            if (line.categoryId === category.id) {
              await transaction.put(
                "records",
                line.id,
                asOrganizationJsonValue({
                  ...line,
                  categoryId: replacement.id,
                }),
              );
            }
          }
          for (const line of state.receiptAdjustments) {
            if (line.categoryId === category.id) {
              await transaction.put(
                "records",
                line.id,
                asOrganizationJsonValue({
                  ...line,
                  categoryId: replacement.id,
                }),
              );
            }
          }
          await transaction.delete("records", category.id);
          await transaction.put(
            "records",
            tombstoneId("category", category.id),
            asOrganizationJsonValue(
              createCategoryTombstone(
                category.id,
                replacement.id,
                now(),
                deviceId,
              ),
            ),
          );
          return;
        }
      }
    });
  };

  return {
    getState: () =>
      store.transaction(
        "readwrite",
        (transaction) => readStateInTransaction(transaction, true),
      ),
    commitProject,
    setProjectDefaultCurrency,
    commitCategory,
    resolveCategoryReference: async (categoryId) => {
      const state = await store.transaction("readonly", async (transaction) => {
        const records = await readRecords(transaction);
        const settings = parseSettings(
          await transaction.get(
            "settings",
            PROJECT_ORGANIZATION_SETTINGS_KEY,
          ),
        );
        return buildState(records, settings);
      });
      return redirectDeletedCategoryReference(
        categoryId,
        state.categories,
        state.tombstones,
      );
    },
  };
}
