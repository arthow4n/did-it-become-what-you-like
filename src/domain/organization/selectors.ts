import {
  type Category,
  type Project,
  type StableId,
  UNCATEGORIZED_CATEGORY_ID,
} from "../schema/index.ts";
import type { ProjectCategoryState } from "./types.ts";

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

export function stableSort<T extends { readonly id: string }>(
  values: readonly T[],
  order: readonly string[] = [],
): readonly T[] {
  const positions = new Map(order.map((id, index) => [id, index] as const));
  return [...values].sort((left, right) => {
    const leftPosition = positions.get(left.id);
    const rightPosition = positions.get(right.id);
    if (leftPosition !== undefined || rightPosition !== undefined) {
      if (leftPosition === undefined) return 1;
      if (rightPosition === undefined) return -1;
      if (leftPosition !== rightPosition) return leftPosition - rightPosition;
    }
    return compareCodeUnits(left.id, right.id);
  });
}

export function sortProjects(
  projects: readonly Project[],
  order: readonly StableId[] = [],
): readonly Project[] {
  return stableSort(projects, order);
}

export function sortCategories(
  categories: readonly Category[],
): readonly Category[] {
  return [...categories].sort((left, right) =>
    left.sortOrder - right.sortOrder || compareCodeUnits(left.id, right.id)
  );
}

export function selectFirstProject(
  projects: readonly Project[],
): Project | undefined {
  return projects.find((project) => !project.archived);
}

export const selectDefaultProject = selectFirstProject;

export function selectLastSelectedProject(
  projects: readonly Project[],
  lastSelectedProjectId: StableId | undefined,
): Project | undefined {
  if (!lastSelectedProjectId) return undefined;
  return projects.find((project) =>
    project.id === lastSelectedProjectId && !project.archived
  );
}

export function selectCurrentProject(
  projects: readonly Project[],
  lastSelectedProjectId: StableId | undefined,
): Project | undefined {
  return selectLastSelectedProject(projects, lastSelectedProjectId) ??
    selectDefaultProject(projects);
}

export type ProjectAction =
  | { readonly type: "create" }
  | { readonly type: "rename"; readonly projectId: StableId }
  | { readonly type: "select"; readonly projectId: StableId }
  | { readonly type: "archive"; readonly projectId: StableId }
  | { readonly type: "restore"; readonly projectId: StableId }
  | { readonly type: "reorder"; readonly orderedIds: readonly StableId[] }
  | { readonly type: "set-default-currency"; readonly projectId: StableId }
  | { readonly type: "delete-empty"; readonly projectId: StableId };

export function projectIsEmpty(
  state: ProjectCategoryState,
  projectId: StableId,
): boolean {
  return !state.expenses.some((expense) => expense.projectId === projectId) &&
    !state.receipts.some((receipt) => receipt.projectId === projectId) &&
    !state.receiptPurchaseLines.some((line) => line.projectId === projectId) &&
    !state.receiptAdjustments.some((line) => line.projectId === projectId);
}

export function selectProjectActions(
  state: ProjectCategoryState,
): readonly ProjectAction[] {
  const activeProjects = state.projects.filter((project) => !project.archived);
  const actions: ProjectAction[] = [{ type: "create" }];
  for (const project of state.projects) {
    actions.push({ type: "rename", projectId: project.id });
    if (project.archived) {
      actions.push({ type: "restore", projectId: project.id });
    } else {
      actions.push({ type: "select", projectId: project.id });
      if (
        project.id !== state.selectedProjectId && activeProjects.length > 1
      ) {
        actions.push({ type: "archive", projectId: project.id });
      }
    }
    if (
      projectIsEmpty(state, project.id) &&
      (project.id !== state.selectedProjectId || activeProjects.length > 1)
    ) {
      actions.push({ type: "delete-empty", projectId: project.id });
    }
    actions.push({ type: "set-default-currency", projectId: project.id });
  }
  if (activeProjects.length > 1) {
    actions.push({
      type: "reorder",
      orderedIds: activeProjects.map((project) => project.id),
    });
  }
  return actions;
}

export type CategoryAction =
  | { readonly type: "create" }
  | { readonly type: "rename"; readonly categoryId: StableId }
  | { readonly type: "archive"; readonly categoryId: StableId }
  | { readonly type: "restore"; readonly categoryId: StableId }
  | { readonly type: "reorder"; readonly orderedIds: readonly StableId[] }
  | {
    readonly type: "delete-and-reassign";
    readonly categoryId: StableId;
    readonly replacementCategoryId: StableId;
  };

export function selectCategoryActions(
  state: ProjectCategoryState,
): readonly CategoryAction[] {
  const actions: CategoryAction[] = [{ type: "create" }];
  const activeCustom = state.categories.filter((category) =>
    !category.archived && !category.system
  );
  for (const category of state.categories) {
    if (category.system) continue;
    actions.push({ type: "rename", categoryId: category.id });
    actions.push(
      category.archived
        ? { type: "restore", categoryId: category.id }
        : { type: "archive", categoryId: category.id },
    );
    actions.push({
      type: "delete-and-reassign",
      categoryId: category.id,
      replacementCategoryId: UNCATEGORIZED_CATEGORY_ID,
    });
  }
  if (activeCustom.length > 0) {
    actions.push({
      type: "reorder",
      orderedIds: activeCustom.map((category) => category.id),
    });
  }
  return actions;
}
