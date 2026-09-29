import { routeFromHash } from "../../app/routing.ts";
import { expenseDateForLocalNow } from "../../domain/queries/index.ts";
import type { ProjectCategoryState } from "../../domain/organization.ts";
import type { ReceiptReviewDraft } from "../../domain/receipt.ts";
import type { ShellRoute } from "../../actors/contracts/index.ts";

export const CURRENCY_OPTIONS = ["SEK", "EUR", "USD", "GBP", "JPY", "TWD"];

export type EditorState<T> =
  | { readonly kind: "create" }
  | { readonly kind: "edit"; readonly record: T };

export function idFor(kind: "project" | "category" | "expense"): string {
  const suffix = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random()}`;
  return `${kind}-${suffix}`;
}

export type LocalUiPath =
  | "/first-use"
  | "/expenses"
  | "/add"
  | "/expense/new"
  | `/expense/edit/${string}`
  | "/organize"
  | "/projects"
  | "/categories"
  | "/settings"
  | "/settings/gemini"
  | "/settings/sync"
  | "/settings/devices"
  | "/settings/conflicts"
  | "/settings/import-export"
  | "/settings/privacy"
  | "/settings/preferences"
  | "/settings/about"
  | "/receipt/scan"
  | "/receipt/manual"
  | "/receipt/review"
  | `/receipt/detail/${string}`;

export type LocalUiNavigation =
  | "expenses"
  | "manual"
  | "scan"
  | "organize"
  | "settings";

export function selectedNavigationForPath(
  activePath: string,
): LocalUiNavigation {
  if (
    activePath === "/expense/new" || activePath.startsWith("/expense/edit/")
  ) {
    return "manual";
  }
  if (
    activePath === "/receipt/scan" || activePath === "/receipt/review"
  ) {
    return "scan";
  }
  if (activePath === "/receipt/manual") return "manual";
  if (
    activePath.startsWith("/organize") || activePath === "/projects" ||
    activePath === "/categories"
  ) {
    return "organize";
  }
  if (activePath.startsWith("/settings")) return "settings";
  return "expenses";
}

export type ScrollViewport = {
  readonly scrollTo?: (options: ScrollToOptions) => void;
};

export function scrollToTopOnNavigationChange(
  previous: LocalUiNavigation | null,
  activePath: string,
  viewport: ScrollViewport = globalThis,
): LocalUiNavigation {
  const next = selectedNavigationForPath(activePath);
  if (previous !== null && previous !== next) {
    viewport.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  }
  return next;
}

export function shellRouteForPath(path: string): ShellRoute {
  if (path === "/first-use") return "first-use";
  if (path === "/add") return "add";
  if (path.startsWith("/expense/")) return "expense-form";
  if (path === "/receipt/scan") return "receipt-scan";
  if (path === "/receipt/manual") return "receipt-review";
  if (path === "/receipt/review") return "receipt-review";
  if (path.startsWith("/receipt/detail/")) return "receipt-detail";
  if (path === "/organize") return "organize";
  if (path === "/projects") return "projects";
  if (path === "/categories") return "categories";
  if (path.startsWith("/settings")) return "settings";
  return "expenses";
}

export function firstUseRedirectPath(
  path: string,
  projectCount: number,
): LocalUiPath | undefined {
  return path === "/first-use" && projectCount > 0 ? "/expenses" : undefined;
}

export function receiptDetailForPath(path: string): {
  receiptId: string;
  focusedLineId?: string;
} | undefined {
  if (!path.startsWith("/receipt/detail/")) return undefined;
  const [receiptId, query] = path.slice("/receipt/detail/".length).split("?");
  if (!receiptId) return undefined;
  const focusedLineId = new URLSearchParams(query ?? "").get("line") ??
    undefined;
  return focusedLineId ? { receiptId, focusedLineId } : { receiptId };
}

export function pathFromHash(): string {
  return globalThis.location.hash === ""
    ? ""
    : routeFromHash(globalThis.location.hash);
}

const LOCAL_UI_HISTORY_STATE = "__afterMidnightLocalUiHistory";

export type LocalUiHistoryEntry = {
  readonly path: string;
  readonly hash: string;
  readonly index: number;
};

type LocalUiHistoryState = {
  readonly index: number;
  readonly path: string;
};

export type LocalUiPendingNavigation =
  | { readonly kind: "route"; readonly path: LocalUiPath }
  | {
    readonly kind: "history";
    readonly source: LocalUiHistoryEntry;
    readonly target: LocalUiHistoryEntry;
  };

export type LocalUiHistoryTransition =
  | {
    readonly phase: "restoring";
    readonly source: LocalUiHistoryEntry;
    readonly target: LocalUiHistoryEntry;
  }
  | {
    readonly phase: "waiting";
    readonly source: LocalUiHistoryEntry;
    readonly target: LocalUiHistoryEntry;
  }
  | { readonly phase: "committing"; readonly target: LocalUiHistoryEntry };

export function readLocalUiHistoryState(
  value: unknown,
): LocalUiHistoryState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as Record<string, unknown>)[LOCAL_UI_HISTORY_STATE];
  if (!candidate || typeof candidate !== "object") return null;
  const state = candidate as Record<string, unknown>;
  return typeof state.index === "number" && Number.isInteger(state.index) &&
      typeof state.path === "string"
    ? { index: state.index, path: state.path }
    : null;
}

export function historyStateFor(
  entry: LocalUiHistoryEntry,
): Record<string, unknown> {
  const current = globalThis.history.state;
  const base = current && typeof current === "object" &&
      !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
  return {
    ...base,
    [LOCAL_UI_HISTORY_STATE]: {
      index: entry.index,
      path: entry.path,
    },
  };
}

export function historyEntryForLocation(index = 0): LocalUiHistoryEntry {
  const path = pathFromHash();
  const state = readLocalUiHistoryState(globalThis.history.state);
  return {
    path,
    hash: globalThis.location.hash,
    index: state?.path === path ? state.index : index,
  };
}

export function sameHistoryEntry(
  left: LocalUiHistoryEntry,
  right: LocalUiHistoryEntry,
): boolean {
  return left.index === right.index && left.path === right.path &&
    left.hash === right.hash;
}

export function manualReceiptReviewForState(
  state: ProjectCategoryState,
  expenseDayBoundary: string,
): ReceiptReviewDraft | undefined {
  const project =
    state.projects.find((candidate) =>
      candidate.id === state.selectedProjectId && !candidate.archived
    ) ?? state.projects.find((candidate) => !candidate.archived);
  if (!project) return undefined;
  return {
    parent: {
      projectId: project.id,
      date: expenseDateForLocalNow(new Date(), expenseDayBoundary),
      currency: project.defaultCurrency,
      printedTotal: "0",
    },
    lines: [],
    uncertainty: [],
    printedTotalMismatch: false,
  };
}
