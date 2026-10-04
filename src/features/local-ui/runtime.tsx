import { useActor } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProjectCategoryService,
  type ProjectCategoryState,
} from "../../domain/organization.ts";
import {
  createReceiptManagementService,
  DEFAULT_DEVICE_LOCAL_SETTINGS,
  type DeviceLocalSettings,
  PortableSettingsSchema,
} from "../../domain/index.ts";
import type { ReceiptReviewDraft } from "../../domain/receipt.ts";
import {
  createLocalShellMachine,
  type LocalShellEvent,
} from "../../actors/local-shell.ts";
import type { ManualExpenseOpenRequest } from "../../actors/manual-expense.ts";
import type {} from "../../actors/contracts/index.ts";
import {
  type LocalRepository,
  openLocalRepository,
  readDeviceLocalSettings,
  writeDeviceLocalSettings,
} from "../../adapters/local/index.ts";
import type {} from "../../adapters/ports/local.ts";
import { hashForRoute } from "../../app/routing.ts";
import { isSupportedBrowser } from "../../app/pwa.ts";
import {
  AppFrame,
  ContentContainer,
  DefaultNavigation,
  EmptyState,
  Heading,
  InlineNotice,
  Stack,
  Toast,
} from "../../design-system/index.ts";
import {
  createDefaultReceiptUiDependencies,
  ReceiptImageStore,
  type ReceiptReviewMode,
  ReceiptReviewScreen,
  ReceiptScanScreen,
  ReceiptSettingsScreen,
  type ReceiptUiDependencies,
} from "../receipt-ui.tsx";
import {
  SyncPortabilityRuntime,
  type SyncPortabilityScreen,
} from "../sync-portability-runtime.tsx";
import {} from "../sync-ui/index.ts";
import { ReceiptDetailScreen } from "../receipt-detail-ui.tsx";
import {
  AboutScreen,
  PreferencesScreen,
  PwaRuntime,
  UnsupportedBrowserScreen,
} from "../settings-pwa.tsx";
import {
  firstUseRedirectPath,
  historyEntryForLocation,
  historyStateFor,
  type LocalUiHistoryEntry,
  type LocalUiHistoryTransition,
  type LocalUiNavigation,
  type LocalUiPath,
  type LocalUiPendingNavigation,
  manualReceiptReviewForState,
  pathFromHash,
  readLocalUiHistoryState,
  receiptDetailForPath,
  sameHistoryEntry,
  scrollToTopOnNavigationChange,
  selectedNavigationForPath,
  shellRouteForPath,
} from "./types.ts";
import {
  DirtyExitGuard,
  FirstUseScreen,
  LoadingScreen,
} from "./navigation.tsx";
import { ExpensesScreen } from "./expenses-screen.tsx";
import { ProjectManager } from "./project-manager.tsx";
import { OrganizeScreen } from "./organize-screen.tsx";
import { SettingsScreen } from "./settings-screen.tsx";
import { CategoryManager } from "./category-manager.tsx";
import { ManualExpenseScreen } from "./manual-expense-screen.tsx";
function FoundationExpensesPlaceholder() {
  return (
    <ContentContainer size="readable">
      <Stack gap={5}>
        <Heading level={1} size="lg">s</Heading>
        <EmptyState title="Your local expenses will appear here">
          Create an expense or add a project to begin tracking.
        </EmptyState>
      </Stack>
    </ContentContainer>
  );
}
export function LocalUiRuntime(
  { repository, receiptDependencies }: {
    repository: LocalRepository;
    receiptDependencies?: ReceiptUiDependencies;
  },
) {
  const organization = useMemo(
    () => createProjectCategoryService(repository),
    [repository],
  );
  const receiptManagement = useMemo(
    () => createReceiptManagementService(repository),
    [repository],
  );
  const shellMachine = useMemo(
    () =>
      createLocalShellMachine({
        organization,
        initialNetwork: globalThis.navigator?.onLine === false
          ? "offline"
          : "online",
      }),
    [organization],
  );
  const [shellSnapshot, sendShell] = useActor(shellMachine);
  const [state, setState] = useState<ProjectCategoryState | null>(null);
  const [expenseDayBoundary, setExpenseDayBoundary] = useState("03:00");
  const initialPath = pathFromHash();
  const [path, setPath] = useState(initialPath);
  const [projectEditorOpen, setProjectEditorOpen] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [usefulActionVersion, setUsefulActionVersion] = useState(0);
  const [workflowDirty, setWorkflowDirty] = useState(false);
  const [dirtyNavigationWorkflow, setDirtyNavigationWorkflow] = useState(false);
  const handleWorkflowDirtyChange = useCallback((dirty: boolean) => {
    setWorkflowDirty(dirty);
    setDirtyNavigationWorkflow(dirty);
  }, []);
  const [dirtyExitOpen, setDirtyExitOpen] = useState(false);
  const [discardRequest, setDiscardRequest] = useState(0);
  const [dirtyDiscardDisabled, setDirtyDiscardDisabled] = useState(false);
  const pendingNavigationRef = useRef<LocalUiPendingNavigation | null>(null);
  const previousNavigationRef = useRef<LocalUiNavigation | null>(
    selectedNavigationForPath(initialPath),
  );
  const currentHistoryRef = useRef<LocalUiHistoryEntry | null>(null);
  const historyTransitionRef = useRef<LocalUiHistoryTransition | null>(null);
  const receiptReturnFocusRef = useRef<
    | { readonly kind: "receipt"; readonly receiptId: string }
    | { readonly kind: "expenses" }
    | { readonly kind: "expenses-add" }
    | null
  >(null);
  const dirtyNavigationRef = useRef(false);
  dirtyNavigationRef.current = dirtyNavigationWorkflow;
  if (currentHistoryRef.current === null) {
    currentHistoryRef.current = historyEntryForLocation();
  }
  const [deviceSettings, setDeviceSettings] = useState<DeviceLocalSettings>(
    DEFAULT_DEVICE_LOCAL_SETTINGS,
  );
  const [syncSummary, setSyncSummary] = useState("Not connected");
  const [receiptSummary, setReceiptSummary] = useState("Not configured");
  const [receiptReview, setReceiptReview] = useState<ReceiptReviewDraft>();
  const [receiptReviewMode, setReceiptReviewMode] = useState<ReceiptReviewMode>(
    "scanned",
  );
  const imageStore = useMemo(() => new ReceiptImageStore(), []);
  const deviceSettingsRef = useRef(DEFAULT_DEVICE_LOCAL_SETTINGS);
  deviceSettingsRef.current = deviceSettings;
  const defaultReceipt = useMemo(
    () =>
      createDefaultReceiptUiDependencies(
        imageStore,
        () => ({
          preferredProviderTag: deviceSettingsRef.current.preferredProviderTag,
          requireZdr: deviceSettingsRef.current.requireZdr,
          denyProviderDataCollection:
            deviceSettingsRef.current.denyProviderDataCollection,
        }),
        () => deviceSettingsRef.current.geminiThinkingLevel,
      ),
    [imageStore],
  );
  const receipt = receiptDependencies ?? defaultReceipt.dependencies;
  const secretStorage = defaultReceipt.secretStorage;
  const shellReady = shellSnapshot.matches("ready");
  useEffect(() => {
    void repository.transaction(
      "readonly",
      (transaction) => transaction.get("records", "settings-portable"),
    ).then((value) => {
      const parsed = PortableSettingsSchema.safeParse(value);
      if (parsed.success) setExpenseDayBoundary(parsed.data.expenseDayBoundary);
    });
  }, [repository]);
  useEffect(() => {
    let active = true;
    void readDeviceLocalSettings(repository).then((settings) => {
      if (active) setDeviceSettings(settings);
    }).catch(() => {
      if (active) {
        setAppNotice(
          "Device-local receipt scanning settings could not be opened.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [repository]);
  useEffect(() => {
    let active = true;
    const provider = deviceSettings.activeProvider === "gemini"
      ? receipt.gemini
      : receipt.openrouter;
    void provider.getApiKey().then((key) => {
      if (!active) return;
      const selectedModel = deviceSettings.activeProvider === "gemini"
        ? deviceSettings.selectedGeminiModel
        : deviceSettings.selectedOpenRouterModel;
      setReceiptSummary(
        key === undefined
          ? "Not configured"
          : selectedModel
          ? "Key and model configured"
          : "Key configured; choose a model",
      );
    }).catch(() => {
      if (active) setReceiptSummary("Configuration status unavailable");
    });
    return () => {
      active = false;
    };
  }, [
    deviceSettings.activeProvider,
    deviceSettings.selectedGeminiModel,
    deviceSettings.selectedOpenRouterModel,
    receipt,
  ]);
  useEffect(() => {
    const onOffline = () => sendShell({ type: "shell.network.offline" });
    const onOnline = () => sendShell({ type: "shell.network.online" });
    globalThis.addEventListener("offline", onOffline);
    globalThis.addEventListener("online", onOnline);
    return () => {
      globalThis.removeEventListener("offline", onOffline);
      globalThis.removeEventListener("online", onOnline);
    };
  }, [sendShell]);
  useEffect(() => {
    setDirtyDiscardDisabled(false);
  }, [path]);
  useEffect(() => {
    previousNavigationRef.current = scrollToTopOnNavigationChange(
      previousNavigationRef.current,
      path,
    );
  }, [path]);
  useEffect(() => {
    const nextState = shellSnapshot.context.projectState;
    if (nextState) setState(nextState);
  }, [shellSnapshot.context.projectState]);
  useEffect(() => {
    if (!shellReady || state === null || path !== "") {
      return;
    }
    setPath(state.projects.length === 0 ? "/first-use" : "/expenses");
  }, [path, shellReady, state]);
  useEffect(() => {
    if (!shellReady || path === "") return;
    sendShell(
      {
        type: "shell.navigate",
        route: shellRouteForPath(path),
      } satisfies LocalShellEvent,
    );
  }, [path, sendShell, shellReady]);
  useEffect(() => {
    if (path !== "/expenses") return;
    const request = receiptReturnFocusRef.current;
    if (!request) return;
    const receiptGroup = request.kind === "receipt"
      ? Array.from(
        document.querySelectorAll<HTMLElement>("[data-receipt-group-id]"),
      ).find((element) => element.dataset.receiptGroupId === request.receiptId)
      : undefined;
    const target = request.kind === "expenses-add"
      ? document.querySelector<HTMLElement>("[data-expenses-add]") ??
        document.querySelector<HTMLElement>("[data-expenses-list-heading]")
      : request.kind === "expenses"
      ? document.querySelector<HTMLElement>("[data-expenses-list-heading]") ??
        document.querySelector<HTMLElement>("[data-expenses-add]")
      : receiptGroup?.querySelector<HTMLElement>("button") ??
        document.querySelector<HTMLElement>("[data-expenses-list-heading]") ??
        document.querySelector<HTMLElement>("[data-expenses-add]");
    if (!target) return;
    receiptReturnFocusRef.current = null;
    queueMicrotask(() => {
      if (target.isConnected) target.focus();
    });
  }, [path, state]);
  const navigate = (nextPath: LocalUiPath) => {
    const current = currentHistoryRef.current;
    if (!current) return;
    const hash = hashForRoute(nextPath);
    if (globalThis.location.hash !== hash) {
      const nextEntry: LocalUiHistoryEntry = {
        path: nextPath,
        hash,
        index: current.index + 1,
      };
      globalThis.history.pushState(historyStateFor(nextEntry), "", hash);
      currentHistoryRef.current = nextEntry;
    } else {
      const nextEntry = { ...current, path: nextPath };
      globalThis.history.replaceState(
        historyStateFor(nextEntry),
        "",
        hash,
      );
      currentHistoryRef.current = nextEntry;
      setPath(nextPath);
    }
    setPath(nextPath);
  };
  useEffect(() => {
    if (!shellReady || state === null) return;
    const redirect = firstUseRedirectPath(path, state.projects.length);
    if (redirect !== undefined) navigate(redirect);
  }, [navigate, path, shellReady, state]);
  const requestNavigation = (nextPath: LocalUiPath) => {
    if (dirtyNavigationWorkflow) {
      pendingNavigationRef.current = { kind: "route", path: nextPath };
      setDirtyExitOpen(true);
      return;
    }
    navigate(nextPath);
  };
  const commitHistoryNavigation = (target: LocalUiHistoryEntry) => {
    const current = currentHistoryRef.current;
    if (!current) return;
    const delta = target.index - current.index;
    if (delta === 0) {
      globalThis.history.replaceState(historyStateFor(target), "", target.hash);
      currentHistoryRef.current = target;
      historyTransitionRef.current = null;
      setPath(target.path);
      return;
    }
    historyTransitionRef.current = { phase: "committing", target };
    globalThis.history.go(delta);
  };
  const finishDirtyNavigation = (fallback: LocalUiPath) => {
    const pending = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setDirtyExitOpen(false);
    setDirtyNavigationWorkflow(false);
    setWorkflowDirty(false);
    if (pending?.kind === "history") {
      commitHistoryNavigation(pending.target);
      return;
    }
    navigate(pending?.path ?? fallback);
  };
  useEffect(() => {
    const current = currentHistoryRef.current;
    if (!current) return;
    const state = readLocalUiHistoryState(globalThis.history.state);
    if (
      !state || state.index !== current.index || state.path !== current.path
    ) {
      globalThis.history.replaceState(
        historyStateFor(current),
        "",
        current.hash,
      );
    }
  }, []);
  useEffect(() => {
    const onHistoryChange = () => {
      const current = currentHistoryRef.current;
      if (!current) return;
      const targetPath = pathFromHash();
      const state = readLocalUiHistoryState(globalThis.history.state);
      const target: LocalUiHistoryEntry = state?.path === targetPath
        ? {
          path: targetPath,
          hash: globalThis.location.hash,
          index: state.index,
        }
        : {
          path: targetPath,
          hash: globalThis.location.hash,
          index: current.index + 1,
        };
      if (!state || state.path !== targetPath) {
        globalThis.history.replaceState(
          historyStateFor(target),
          "",
          target.hash,
        );
      }
      const transition = historyTransitionRef.current;
      if (transition?.phase === "committing") {
        if (sameHistoryEntry(target, transition.target)) {
          historyTransitionRef.current = null;
          currentHistoryRef.current = target;
          setPath(target.path);
        }
        return;
      }
      if (transition?.phase === "restoring") {
        if (!sameHistoryEntry(target, transition.source)) return;
        if (!dirtyNavigationRef.current) {
          commitHistoryNavigation(transition.target);
          return;
        }
        historyTransitionRef.current = {
          phase: "waiting",
          source: transition.source,
          target: transition.target,
        };
        pendingNavigationRef.current = {
          kind: "history",
          source: transition.source,
          target: transition.target,
        };
        setDirtyExitOpen(true);
        return;
      }
      if (transition?.phase === "waiting") {
        if (sameHistoryEntry(target, transition.source)) return;
        const delta = transition.source.index - target.index;
        if (delta !== 0) globalThis.history.go(delta);
        return;
      }
      if (sameHistoryEntry(target, current)) return;
      if (dirtyNavigationRef.current) {
        const delta = target.index - current.index;
        if (delta === 0) return;
        historyTransitionRef.current = {
          phase: "restoring",
          source: current,
          target,
        };
        pendingNavigationRef.current = {
          kind: "history",
          source: current,
          target,
        };
        globalThis.history.go(-delta);
        return;
      }
      currentHistoryRef.current = target;
      setPath(target.path);
    };
    globalThis.addEventListener("hashchange", onHistoryChange);
    globalThis.addEventListener("popstate", onHistoryChange);
    return () => {
      globalThis.removeEventListener("hashchange", onHistoryChange);
      globalThis.removeEventListener("popstate", onHistoryChange);
    };
  }, []);
  const updateDeviceSettings = async (next: DeviceLocalSettings) => {
    // Keep adapter routing reads synchronous with the UI event. React state is
    // batched, while an immediate model/endpoint refresh must already observe
    // the newly selected ZDR and data-collection policy.
    deviceSettingsRef.current = next;
    setDeviceSettings(next);
    try {
      await writeDeviceLocalSettings(repository, next);
    } catch {
      setAppNotice(
        "Device-local receipt scanning settings could not be saved.",
      );
    }
  };
  const selectedExpenseId = path.startsWith("/expense/edit/")
    ? path.slice("/expense/edit/".length)
    : undefined;
  const selectedExpense = selectedExpenseId && state
    ? state.expenses.find((expense) => expense.id === selectedExpenseId)
    : undefined;
  const manualRequest = useMemo<ManualExpenseOpenRequest>(
    () =>
      selectedExpense
        ? { expense: selectedExpense }
        : { projectId: state?.selectedProjectId },
    [selectedExpense, state?.selectedProjectId],
  );
  const manualReceiptReview = useMemo(
    () =>
      state === null
        ? undefined
        : manualReceiptReviewForState(state, expenseDayBoundary),
    [expenseDayBoundary, state],
  );
  if (shellSnapshot.matches("booting") || state === null) {
    return <LoadingScreen />;
  }
  if (shellSnapshot.matches("error")) {
    return (
      <ContentContainer size="readable">
        <InlineNotice tone="danger" title="Local data could not be opened">
          {shellSnapshot.context.error?.message ??
            "Try again to reopen local data."}
        </InlineNotice>
      </ContentContainer>
    );
  }
  const activePath = path === "/add"
    ? "/expense/new"
    : (path || (state.projects.length ? "/expenses" : "/first-use"));
  const receiptDetail = receiptDetailForPath(activePath);
  const contentPath = activePath;
  const selectedNavigation = selectedNavigationForPath(activePath);
  const portabilityScreen: SyncPortabilityScreen =
    activePath === "/settings/sync"
      ? "sync"
      : activePath === "/settings/devices"
      ? "devices"
      : activePath === "/settings/conflicts"
      ? "conflicts"
      : activePath === "/settings/import-export"
      ? "import-export"
      : activePath === "/settings/privacy"
      ? "privacy"
      : null;
  const selectNavigation = (id: string) => {
    if (id === "manual") return requestNavigation("/expense/new");
    if (id === "scan") return requestNavigation("/receipt/scan");
    if (id === "organize" || id === "settings" || id === "expenses") {
      requestNavigation(`/${id}` as LocalUiPath);
    }
  };
  const completeReceiptDetail = (output: {
    status: string;
    destination?: string;
    deletedLineId?: string;
  }) => {
    setWorkflowDirty(false);
    setDirtyNavigationWorkflow(false);
    if (output.status === "deleted") {
      receiptReturnFocusRef.current = { kind: "expenses-add" };
      void organization.getState().then(setState);
      setAppNotice(
        output.deletedLineId === undefined
          ? "Receipt deleted."
          : "Final receipt line deleted; receipt removed.",
      );
      navigate("/expenses");
      return;
    }
    if (output.status === "navigated" || output.status === "discarded") {
      if (output.destination === "/expenses" && receiptDetail !== undefined) {
        receiptReturnFocusRef.current = {
          kind: "receipt",
          receiptId: receiptDetail.receiptId,
        };
      }
      void organization.getState().then(setState);
      navigate((output.destination ?? "/expenses") as LocalUiPath);
    }
  };
  return (
    <AppFrame
      navigation={
        <DefaultNavigation
          selected={selectedNavigation}
          onSelect={selectNavigation}
        />
      }
    >
      <PwaRuntime
        usefulActionVersion={usefulActionVersion}
        dirty={workflowDirty}
        suppressed={contentPath === "/receipt/scan"}
      >
        <SyncPortabilityRuntime
          repository={repository}
          screen={portabilityScreen}
          onNavigate={(nextPath) => navigate(nextPath as LocalUiPath)}
          onNotice={setAppNotice}
          secretStorage={secretStorage}
          onSyncSummary={setSyncSummary}
          onSyncCompleted={() =>
            sendShell({ type: "shell.repository.refresh" })}
          onLocalErased={(scope) => {
            void scope;
            if (typeof globalThis.location?.reload === "function") {
              globalThis.location.reload();
            }
          }}
        >
          {contentPath === "/first-use"
            ? (
              <FirstUseScreen
                onCreateProject={() => {
                  setProjectEditorOpen(true);
                  navigate("/projects");
                }}
                onRestoreBackup={() => navigate("/settings/import-export")}
                onConnectDrive={() => navigate("/settings/sync")}
              />
            )
            : contentPath === "/expenses"
            ? (
              <ExpensesScreen
                state={state}
                expenseDayBoundary={expenseDayBoundary}
                offline={shellSnapshot.hasTag("offline")}
                onAdd={() => navigate("/expense/new")}
                onEdit={(expense) => navigate(`/expense/edit/${expense.id}`)}
                onViewReceipt={(receiptId, focusedLineId) => {
                  receiptReturnFocusRef.current = {
                    kind: "receipt",
                    receiptId,
                  };
                  navigate(
                    `/receipt/detail/${receiptId}${
                      focusedLineId ? `?line=${focusedLineId}` : ""
                    }` as LocalUiPath,
                  );
                }}
                onProjectChange={(projectId) =>
                  sendShell({ type: "shell.project.select", projectId })}
              />
            )
            : receiptDetail
            ? (
              <ReceiptDetailScreen
                key={receiptDetail.receiptId}
                service={receiptManagement}
                receiptId={receiptDetail.receiptId}
                focusedLineId={receiptDetail.focusedLineId}
                categories={state.categories}
                discardRequest={discardRequest}
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                onDirtyDiscarded={() => finishDirtyNavigation("/expenses")}
                onBack={() => {
                  receiptReturnFocusRef.current = {
                    kind: "receipt",
                    receiptId: receiptDetail.receiptId,
                  };
                  setWorkflowDirty(false);
                  setDirtyNavigationWorkflow(false);
                  navigate("/expenses");
                }}
                onComplete={completeReceiptDetail}
              />
            )
            : contentPath === "/receipt/scan"
            ? (
              <ReceiptScanScreen
                dependencies={receipt}
                imageStore={imageStore}
                state={state}
                settings={deviceSettings}
                offline={shellSnapshot.hasTag("offline")}
                onSettingsChange={updateDeviceSettings}
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                onDiscardDisabledChange={setDirtyDiscardDisabled}
                discardRequest={discardRequest}
                onDirtyDiscarded={() => finishDirtyNavigation("/expenses")}
                onReview={(review, mode) => {
                  setReceiptReview(review);
                  setReceiptReviewMode(mode ?? "scanned");
                  navigate("/receipt/review");
                }}
                onClose={() => {
                  imageStore.clear();
                  setWorkflowDirty(false);
                  setDirtyNavigationWorkflow(false);
                  navigate("/expenses");
                }}
                onOpenSettings={() => navigate("/settings/gemini")}
              />
            )
            : contentPath === "/receipt/manual"
            ? (
              <ReceiptReviewScreen
                local={repository}
                state={state}
                mode="manual"
                persistenceKey="workflow:manual-receipt"
                initialReview={manualReceiptReview}
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                onDiscardDisabledChange={setDirtyDiscardDisabled}
                discardRequest={discardRequest}
                onClose={() => {
                  sendShell({ type: "shell.repository.refresh" });
                  void organization.getState().then(setState);
                  setWorkflowDirty(false);
                  finishDirtyNavigation("/expenses");
                }}
              />
            )
            : contentPath === "/receipt/review"
            ? (
              <ReceiptReviewScreen
                local={repository}
                state={state}
                mode={receiptReviewMode}
                initialReview={receiptReview}
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                onDiscardDisabledChange={setDirtyDiscardDisabled}
                discardRequest={discardRequest}
                onClose={() => {
                  sendShell({ type: "shell.repository.refresh" });
                  void organization.getState().then(setState);
                  setReceiptReview(undefined);
                  setReceiptReviewMode("scanned");
                  setWorkflowDirty(false);
                  finishDirtyNavigation("/expenses");
                }}
              />
            )
            : contentPath === "/expense/new" ||
                contentPath.startsWith("/expense/edit/")
            ? (
              <ManualExpenseScreen
                key={contentPath}
                repository={repository}
                service={organization}
                state={state}
                request={manualRequest}
                expenseDayBoundary={expenseDayBoundary}
                onSaved={(expense) => {
                  setWorkflowDirty(false);
                  setDirtyNavigationWorkflow(false);
                  setState((current) => {
                    if (current === null) return current;
                    const existingIndex = current.expenses.findIndex((entry) =>
                      entry.id === expense.id
                    );
                    const expenses = existingIndex === -1
                      ? [...current.expenses, expense]
                      : current.expenses.map((entry, index) =>
                        index === existingIndex ? expense : entry
                      );
                    return { ...current, expenses };
                  });
                  sendShell({ type: "shell.repository.refresh" });
                  void organization.getState().then(setState);
                  setAppNotice(`${expense.merchant ?? "Expense"} saved.`);
                }}
                onManualReceipt={() => requestNavigation("/receipt/manual")}
                onUsefulAction={() =>
                  setUsefulActionVersion((value) => value + 1)}
                onDirtyChange={handleWorkflowDirtyChange}
                discardRequest={discardRequest}
                onClosed={(status) => {
                  void organization.getState().then(setState);
                  if (status === "deleted") setAppNotice("deleted.");
                  setWorkflowDirty(false);
                  finishDirtyNavigation("/expenses");
                }}
              />
            )
            : contentPath === "/organize"
            ? (
              <OrganizeScreen
                state={state}
                onProjects={() => navigate("/projects")}
                onCategories={() => navigate("/categories")}
                onNewProject={() => {
                  setProjectEditorOpen(true);
                  navigate("/projects");
                }}
                onNewCategory={() => {
                  setCategoryEditorOpen(true);
                  navigate("/categories");
                }}
              />
            )
            : contentPath === "/projects"
            ? (
              <ProjectManager
                repository={repository}
                service={organization}
                state={state}
                initialCreate={projectEditorOpen}
                onStateChange={setState}
                onNavigate={requestNavigation}
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                discardRequest={discardRequest}
                onDirtyDiscarded={() => finishDirtyNavigation("/projects")}
                onComplete={() => {
                  if (projectEditorOpen) {
                    setProjectEditorOpen(false);
                    setWorkflowDirty(false);
                    setDirtyNavigationWorkflow(false);
                    navigate("/expenses");
                  }
                }}
              />
            )
            : contentPath === "/categories"
            ? (
              <CategoryManager
                service={organization}
                state={state}
                initialCreate={categoryEditorOpen}
                onStateChange={setState}
                onNavigate={requestNavigation}
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                discardRequest={discardRequest}
                onDirtyDiscarded={() => finishDirtyNavigation("/categories")}
                onComplete={() => {
                  setCategoryEditorOpen(false);
                  setWorkflowDirty(false);
                  setDirtyNavigationWorkflow(false);
                }}
              />
            )
            : contentPath === "/settings/gemini"
            ? (
              <ReceiptSettingsScreen
                gemini={receipt.gemini}
                openrouter={receipt.openrouter}
                settings={deviceSettings}
                onSettingsChange={updateDeviceSettings}
                onClose={() => navigate("/settings")}
              />
            )
            : contentPath === "/settings/preferences"
            ? (
              <PreferencesScreen
                local={repository}
                onClose={() => requestNavigation("/settings")}
                onSaved={setExpenseDayBoundary}
                onDirtyChange={(dirty) => {
                  setWorkflowDirty(dirty);
                  setDirtyNavigationWorkflow(dirty);
                }}
                discardRequest={discardRequest}
                onDiscarded={() => finishDirtyNavigation("/settings")}
              />
            )
            : contentPath === "/settings/about"
            ? (
              <AboutScreen
                onClose={() => navigate("/settings")}
                onPrivacy={() => navigate("/settings/privacy")}
              />
            )
            : contentPath === "/settings"
            ? (
              <SettingsScreen
                expenseDayBoundary={expenseDayBoundary}
                syncSummary={syncSummary}
                receiptSummary={receiptSummary}
                onReceipt={() => navigate("/settings/gemini")}
                onSync={() => navigate("/settings/sync")}
                onImport={() => navigate("/settings/import-export")}
                onPrivacy={() => navigate("/settings/privacy")}
                onPreferences={() => navigate("/settings/preferences")}
                onAbout={() => navigate("/settings/about")}
              />
            )
            : <FoundationExpensesPlaceholder />}
        </SyncPortabilityRuntime>
        {appNotice
          ? <Toast onDismiss={() => setAppNotice(null)}>{appNotice}</Toast>
          : null}
        <DirtyExitGuard
          isOpen={dirtyExitOpen}
          discardDisabled={dirtyDiscardDisabled}
          onKeepEditing={() => {
            pendingNavigationRef.current = null;
            historyTransitionRef.current = null;
            setDirtyExitOpen(false);
          }}
          onDiscard={() => {
            if (pendingNavigationRef.current === null) return;
            // A receipt image is memory-only. Leaving the scan immediately is
            // both safe and more reliable than waiting for an effect in the
            // soon-to-be-unmounted scan screen to observe a discard counter.
            // Its teardown cancels an active request before releasing bytes.
            if (contentPath === "/receipt/scan") {
              imageStore.clear();
              finishDirtyNavigation("/expenses");
              return;
            }
            setDiscardRequest((request) => request + 1);
          }}
        />
      </PwaRuntime>
    </AppFrame>
  );
}
export function LocalApp() {
  const [repository, setRepository] = useState<LocalRepository | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = isSupportedBrowser();
  useEffect(() => {
    if (!supported) return;
    let active = true;
    void openLocalRepository().then((opened) => {
      if (active) setRepository(opened);
      else opened.close();
    }).catch(() => {
      if (active) setError("Local storage is unavailable in this browser.");
    });
    return () => {
      active = false;
    };
  }, [supported]);
  if (!supported) return <UnsupportedBrowserScreen />;
  if (error) {
    return (
      <ContentContainer size="readable">
        <InlineNotice tone="danger" title="Unable to start locally">
          {error}
        </InlineNotice>
      </ContentContainer>
    );
  }
  if (!repository) return <LoadingScreen />;
  return <LocalUiRuntime repository={repository} />;
}
