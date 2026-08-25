import { useActor } from "@xstate/react";
import { fromPromise } from "xstate";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Card,
  ContentContainer,
  DefinitionList,
  FormActions,
  Heading,
  InlineNotice,
  LinkButton,
  List,
  ListRow,
  NativeTimeField,
  PageHeader,
  Stack,
  StatusMessage,
  Text,
} from "../design-system/index.ts";
import { createPreferencesMachine } from "../actors/preferences.ts";
import type { LocalPort } from "../adapters/ports/local.ts";
import {
  type BrowserUpdateInstallPort,
  createBrowserUpdateInstallPort,
} from "../app/pwa.ts";
import {
  APP_COMMIT,
  APP_NAME,
  APP_VERSION,
  LICENSE_NAME,
  LICENSE_URL,
  NOTICES_URL,
  SOURCE_URL,
} from "../app/build-info.ts";
import { updateInstallMachine } from "../actors/contracts/update-install.ts";

export type PwaStatus =
  | "checking"
  | "current"
  | "update-ready"
  | "installing"
  | "offline"
  | "unsupported"
  | "error";

type PwaInstallKind = "app" | "update" | null;

const AUTOMATIC_UPDATE_CHECK_INTERVAL_MS = 5 * 60_000;

export type PwaController = {
  readonly status: PwaStatus;
  readonly installKind: PwaInstallKind;
  readonly version: string | null;
  readonly error: string | null;
  readonly canInstall: boolean;
  readonly installOfferVisible: boolean;
  readonly install: () => void;
  readonly dismissInstall: () => void;
  readonly laterInstall: () => void;
  readonly checkForUpdates: () => void;
  readonly reloadToUpdate: () => void;
};

const defaultPwaController: PwaController = {
  status: "unsupported",
  installKind: null,
  version: null,
  error: null,
  canInstall: false,
  installOfferVisible: false,
  install: () => undefined,
  dismissInstall: () => undefined,
  laterInstall: () => undefined,
  checkForUpdates: () => undefined,
  reloadToUpdate: () => undefined,
};

const PwaContext = createContext<PwaController>(defaultPwaController);

export function usePwaController(): PwaController {
  return useContext(PwaContext);
}

function statusFromSnapshot(
  snapshot: {
    matches: (
      value:
        | "blocked"
        | "checking"
        | "dismissed"
        | "failed"
        | "idle"
        | "installAvailable"
        | "installed"
        | "installing"
        | "offline"
        | "reloaded"
        | "reloading"
        | "upToDate"
        | "updateReady",
    ) => boolean;
    context: {
      error: { readonly code: string } | null;
    };
  },
  portState: string,
): PwaStatus {
  if (snapshot.matches("checking")) return "checking";
  if (snapshot.matches("updateReady") || snapshot.matches("blocked")) {
    return "update-ready";
  }
  if (snapshot.matches("installing") || snapshot.matches("reloading")) {
    return "installing";
  }
  if (snapshot.matches("offline")) return "offline";
  if (snapshot.matches("failed")) {
    return snapshot.context.error?.code === "unsupported"
      ? "unsupported"
      : "error";
  }
  if (portState === "installing") return "installing";
  if (portState === "unsupported") return "unsupported";
  return "current";
}

function installKindFromSnapshot(
  snapshot: {
    matches: (
      value: "installing" | "reloading",
    ) => boolean;
  },
  portState: string,
): PwaInstallKind {
  if (snapshot.matches("installing")) return "app";
  if (snapshot.matches("reloading") || portState === "installing") {
    return "update";
  }
  return null;
}

export function PwaRuntime({
  children,
  usefulActionVersion,
  dirty,
  port: providedPort,
}: {
  readonly children: ReactNode;
  readonly usefulActionVersion: number;
  readonly dirty: boolean;
  readonly port?: BrowserUpdateInstallPort;
}) {
  const port = useMemo(
    () => providedPort ?? createBrowserUpdateInstallPort(),
    [providedPort],
  );
  const machine = useMemo(
    () =>
      updateInstallMachine.provide({
        actors: {
          installApp: fromPromise(async () => await port.install()),
          checkForUpdate: fromPromise(async () => await port.check()),
          reloadApp: fromPromise(async () => await port.reload()),
        },
      }),
    [port],
  );
  const [snapshot, send] = useActor(machine);
  const [canInstall, setCanInstall] = useState(port.canInstall());
  const [installRequested, setInstallRequested] = useState(false);
  const latestUsefulAction = useRef(0);
  const latestSnapshot = useRef(snapshot);
  latestSnapshot.current = snapshot;

  useEffect(() => {
    const eventTarget = typeof window === "undefined" ? globalThis : window;
    if (globalThis.navigator?.onLine === false) {
      send({ type: "network.offline" });
    }
    const onOffline = () => send({ type: "network.offline" });
    const onOnline = () => send({ type: "network.online" });
    eventTarget.addEventListener("offline", onOffline);
    eventTarget.addEventListener("online", onOnline);
    return () => {
      eventTarget.removeEventListener("offline", onOffline);
      eventTarget.removeEventListener("online", onOnline);
    };
  }, [send]);

  useEffect(() => {
    const isVisible = () =>
      typeof document === "undefined" || document.visibilityState !== "hidden";
    const checkAutomatically = () => {
      if (globalThis.navigator?.onLine === false || !isVisible()) return;
      if (
        port.state() === "unsupported" ||
        port.state() === "installing" ||
        (port.canInstall() &&
          (latestSnapshot.current.matches("idle") ||
            latestSnapshot.current.matches("installAvailable"))) ||
        latestSnapshot.current.matches("installAvailable") ||
        latestSnapshot.current.matches("installing") ||
        latestSnapshot.current.matches("reloading")
      ) return;
      send({ type: "update.check" });
    };
    const eventTarget = typeof window === "undefined" ? globalThis : window;
    const onFocus = () => checkAutomatically();
    const onOnline = () => checkAutomatically();
    const onVisibilityChange = () => {
      if (isVisible()) checkAutomatically();
    };

    checkAutomatically();
    eventTarget.addEventListener("focus", onFocus);
    eventTarget.addEventListener("online", onOnline);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    const interval = import.meta.env?.PROD
      ? globalThis.setInterval(
        checkAutomatically,
        AUTOMATIC_UPDATE_CHECK_INTERVAL_MS,
      )
      : undefined;
    return () => {
      eventTarget.removeEventListener("focus", onFocus);
      eventTarget.removeEventListener("online", onOnline);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      if (interval !== undefined) globalThis.clearInterval(interval);
    };
  }, [port, send]);

  useEffect(() => {
    const unsubscribe = port.subscribeInstall((available) => {
      setCanInstall(available);
      if (
        available &&
        latestUsefulAction.current > 0 &&
        (snapshot.matches("idle") || snapshot.matches("dismissed"))
      ) {
        send({ type: "install.available" });
      }
    });
    return unsubscribe;
  }, [port, send, snapshot]);

  useEffect(() => {
    if (usefulActionVersion <= latestUsefulAction.current) return;
    latestUsefulAction.current = usefulActionVersion;
    if (port.canInstall()) send({ type: "install.available" });
  }, [port, send, usefulActionVersion]);

  useEffect(() => {
    if (!installRequested || !snapshot.matches("installAvailable")) return;
    setInstallRequested(false);
    send({ type: "install.request" });
  }, [installRequested, send, snapshot]);

  useEffect(() => {
    const unsubscribe = port.subscribe((state) => {
      if (
        state === "update-available" &&
        !snapshot.matches("checking") &&
        !snapshot.matches("updateReady") &&
        !snapshot.matches("blocked")
      ) {
        send({ type: "update.check" });
      }
    });
    return unsubscribe;
  }, [port, send, snapshot]);

  const status = statusFromSnapshot(snapshot, port.state());
  const installKind = installKindFromSnapshot(snapshot, port.state());
  const requestInstall = () => {
    if (!port.canInstall()) return;
    if (snapshot.matches("installAvailable")) {
      send({ type: "install.request" });
      return;
    }
    setInstallRequested(true);
    if (snapshot.matches("idle") || snapshot.matches("dismissed")) {
      send({ type: "install.available" });
    }
  };
  const checkForUpdates = () => {
    if (snapshot.matches("offline")) {
      send({ type: "update.retry" });
    } else if (
      !snapshot.matches("checking") &&
      !snapshot.matches("reloading")
    ) {
      send({ type: "update.check" });
    }
  };
  const reloadToUpdate = () => {
    if (!snapshot.matches("updateReady") && !snapshot.matches("blocked")) {
      return;
    }
    send({
      type: dirty ? "update.blocked-by-dirty" : "update.reload",
    });
  };
  const controller: PwaController = {
    status,
    installKind,
    version: snapshot.context.version,
    error: snapshot.context.error?.message ?? null,
    canInstall,
    installOfferVisible: snapshot.matches("installAvailable") &&
      latestUsefulAction.current > 0,
    install: requestInstall,
    dismissInstall: () => send({ type: "install.dismiss" }),
    laterInstall: () => send({ type: "install.later" }),
    checkForUpdates,
    reloadToUpdate,
  };

  return (
    <PwaContext.Provider value={controller}>
      {controller.installOfferVisible
        ? (
          <InlineNotice
            className="settings-pwa-install-offer"
            tone="info"
            title="Install app"
          >
            Keep After Midnight available from your home screen. Installation is
            optional and does not change local data.
            <FormActions>
              <Button onPress={controller.install}>Install app</Button>
              <Button variant="quiet" onPress={controller.laterInstall}>
                Later
              </Button>
              <Button variant="quiet" onPress={controller.dismissInstall}>
                Dismiss
              </Button>
            </FormActions>
          </InlineNotice>
        )
        : null}
      {status === "update-ready"
        ? (
          <InlineNotice
            className="settings-pwa-update-offer"
            tone="info"
            title="Update ready"
          >
            A new version is ready. Reload only after saving or discarding
            unfinished input.
            <FormActions>
              <Button
                onPress={controller.reloadToUpdate}
              >
                Reload to update
              </Button>
              {dirty
                ? (
                  <Text tone="secondary">
                    Save or discard unsaved changes before reloading.
                  </Text>
                )
                : null}
            </FormActions>
          </InlineNotice>
        )
        : null}
      {children}
    </PwaContext.Provider>
  );
}

export function PreferencesScreen({
  local,
  onClose,
  onSaved,
  onDirtyChange,
  discardRequest,
  onDiscarded,
}: {
  readonly local: LocalPort;
  readonly onClose: () => void;
  readonly onSaved?: (expenseDayBoundary: string) => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly discardRequest?: number;
  readonly onDiscarded?: () => void;
}) {
  const machine = useMemo(() => createPreferencesMachine({ local }), [local]);
  const [snapshot, send] = useActor(machine);
  const loaded = useRef(false);
  const lastSaved = useRef<string | undefined>(undefined);
  const handledDiscardRequest = useRef(discardRequest ?? 0);
  const pendingDiscardRef = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      send({ type: "preferences.load" });
    }
  }, [send]);

  const dirty = snapshot.hasTag("dirty");
  useEffect(() => {
    if (
      discardRequest === undefined ||
      discardRequest === handledDiscardRequest.current
    ) return;
    handledDiscardRequest.current = discardRequest;
    pendingDiscardRef.current = true;
    send({ type: "preferences.discard" });
  }, [discardRequest, send]);

  useEffect(() => {
    if (!pendingDiscardRef.current || !snapshot.matches("ready")) return;
    pendingDiscardRef.current = false;
    onDiscarded?.();
  }, [onDiscarded, snapshot]);

  useEffect(() => {
    onDirtyChange?.(dirty);
    if (
      snapshot.matches("saved") &&
      lastSaved.current !== snapshot.context.expenseDayBoundary
    ) {
      lastSaved.current = snapshot.context.expenseDayBoundary;
      onSaved?.(snapshot.context.expenseDayBoundary);
    }
  }, [
    dirty,
    onDirtyChange,
    onSaved,
    snapshot,
  ]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    return () => globalThis.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(new Date()), 60_000);
    return () => globalThis.clearInterval(timer);
  }, []);

  if (snapshot.matches("loading") || snapshot.matches("idle")) {
    return (
      <ContentContainer size="readable">
        <Text>Loading preferences…</Text>
      </ContentContainer>
    );
  }

  const boundary = snapshot.context.expenseDayBoundary;
  const boundaryDate = new Date(now);
  const currentTime = now.toTimeString().slice(0, 5);
  if (currentTime < boundary) boundaryDate.setDate(boundaryDate.getDate() - 1);
  const enteredDate = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const suggestedDate = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(boundaryDate);

  return (
    <ContentContainer size="readable">
      <Stack gap={5}>
        <PageHeader
          title="Preferences"
          headingLevel={1}
          leading={<Button variant="quiet" onPress={onClose}>Settings</Button>}
        />
        <Card as="section">
          <Stack gap={4}>
            <NativeTimeField
              label="Expense-day boundary"
              required
              value={boundary}
              onChange={(event) =>
                send({
                  type: "preferences.change",
                  expenseDayBoundary: event.currentTarget.value,
                })}
              description="Before this local time, a new manual expense defaults to the previous calendar date."
            />
            <InlineNotice tone="info" title="Example">
              Entered at {currentTime} on {enteredDate}. Suggested date:{" "}
              {suggestedDate}.
            </InlineNotice>
            {snapshot.matches("failed")
              ? (
                <InlineNotice tone="danger" title="Preferences need attention">
                  {snapshot.context.error?.message ??
                    "The preference could not be saved."}
                  <Button
                    variant="secondary"
                    onPress={() => send({ type: "preferences.retry" })}
                  >
                    Retry
                  </Button>
                </InlineNotice>
              )
              : null}
            {snapshot.hasTag("saving")
              ? <StatusMessage>Saving preference locally…</StatusMessage>
              : snapshot.matches("saved")
              ? <StatusMessage tone="positive">Preference saved.</StatusMessage>
              : null}
            <FormActions>
              <Button
                onPress={() => send({ type: "preferences.save" })}
                isDisabled={!dirty || snapshot.hasTag("saving")}
              >
                Save preferences
              </Button>
              <Button
                variant="quiet"
                onPress={onClose}
                isDisabled={snapshot.hasTag("saving")}
              >
                Close
              </Button>
            </FormActions>
          </Stack>
        </Card>
      </Stack>
    </ContentContainer>
  );
}

function updateStatusLabel(controller: PwaController): string {
  switch (controller.status) {
    case "checking":
      return "Checking for updates…";
    case "current":
      return "Up to date";
    case "update-ready":
      return controller.version ? "Update ready" : "Update ready to install";
    case "installing":
      return controller.installKind === "app"
        ? "Installing app…"
        : "Installing update…";
    case "offline":
      return "Update check unavailable offline";
    case "unsupported":
      return "Updates are unavailable in this browser";
    case "error":
      return "Update check failed";
  }
}

export function AboutScreen({
  onClose,
  onPrivacy,
}: {
  readonly onClose: () => void;
  readonly onPrivacy: () => void;
}) {
  const pwa = usePwaController();
  return (
    <ContentContainer size="readable">
      <Stack gap={5}>
        <PageHeader
          title="About"
          headingLevel={1}
          leading={<Button variant="quiet" onPress={onClose}>Settings</Button>}
        />
        <Card as="section">
          <Stack gap={3}>
            <Heading level={2} size="sm">{APP_NAME}</Heading>
            <DefinitionList
              items={[
                { term: "Version", description: APP_VERSION },
                { term: "Build", description: APP_COMMIT },
                { term: "License", description: LICENSE_NAME },
              ]}
            />
            <InlineNotice tone="info" title="Update status">
              {updateStatusLabel(pwa)}
              {pwa.error ? " " + pwa.error : ""}
              {pwa.status === "offline"
                ? " Reconnect to check for a newer build."
                : null}
            </InlineNotice>
            <FormActions>
              <Button
                pending={pwa.status === "checking"}
                isDisabled={pwa.status === "checking" ||
                  pwa.status === "installing" ||
                  pwa.status === "offline"}
                onPress={pwa.checkForUpdates}
              >
                Check for updates
              </Button>
              {pwa.status === "update-ready"
                ? (
                  <Button onPress={pwa.reloadToUpdate}>
                    Reload to update
                  </Button>
                )
                : null}
            </FormActions>
            {pwa.status === "unsupported"
              ? (
                <Text tone="secondary">
                  This browser can still use supported local features, but it
                  does not provide the service-worker or install capability
                  needed for PWA updates.
                </Text>
              )
              : null}
            {pwa.canInstall
              ? (
                <Button variant="secondary" onPress={pwa.install}>
                  Install app
                </Button>
              )
              : (
                <Text tone="secondary">
                  App installation is not offered by this browser. You can
                  continue using the web app.
                </Text>
              )}
          </Stack>
        </Card>
        <Card as="section">
          <Stack gap={3}>
            <Heading level={2} size="sm">
              Generative AI usage disclosure
            </Heading>
            <Text>
              This application is 100% vibe-coded using ChatGPT Codex and Google
              Antigravity.
            </Text>
          </Stack>
        </Card>
        <Card as="section">
          <Stack gap={3}>
            <Heading level={2} size="sm">Privacy</Heading>
            <Text>
              Local-first · no analytics, advertising, or unrelated tracking.
            </Text>
            <Button variant="secondary" onPress={onPrivacy}>
              Data and privacy details
            </Button>
          </Stack>
        </Card>
        <List label="About and source">
          <ListRow>
            <LinkButton href={LICENSE_URL} target="_blank" rel="noreferrer">
              Application license (MIT)
            </LinkButton>
          </ListRow>
          <ListRow>
            <LinkButton href={NOTICES_URL} target="_blank" rel="noreferrer">
              Third-party licenses and notices
            </LinkButton>
          </ListRow>
          <ListRow>
            <LinkButton href={SOURCE_URL} target="_blank" rel="noreferrer">
              View source on GitHub
            </LinkButton>
          </ListRow>
        </List>
      </Stack>
    </ContentContainer>
  );
}

export function UnsupportedBrowserScreen() {
  return (
    <ContentContainer size="readable">
      <Stack gap={4}>
        <PageHeader title="Browser not supported" headingLevel={1} />
        <InlineNotice tone="danger" title="Local storage is unavailable">
          This browser does not provide the IndexedDB and cryptographic features
          needed for local-first expense data. Use a current browser with site
          storage enabled to continue.
        </InlineNotice>
      </Stack>
    </ContentContainer>
  );
}
