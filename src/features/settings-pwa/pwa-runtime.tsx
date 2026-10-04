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
import { X } from "lucide-react";
import {
  Button,
  FormActions,
  IconButton,
  Inline,
  Stack,
  StatusMessage,
  Text,
} from "../../design-system/index.ts";
import {
  type BrowserUpdateInstallPort,
  createBrowserUpdateInstallPort,
} from "../../app/pwa.ts";
import { updateInstallMachine } from "../../actors/contracts/update-install.ts";

export type PwaStatus =
  | "checking"
  | "current"
  | "update-ready"
  | "installing"
  | "offline"
  | "unsupported"
  | "error";

export type PwaInstallKind = "app" | "update" | null;

const AUTOMATIC_UPDATE_CHECK_INTERVAL_MS = 5 * 60_000;

export function PwaNotice({
  title,
  children,
  onDismiss,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly onDismiss: () => void;
}) {
  return (
    <StatusMessage className="settings-pwa-toast" tone="info">
      <Stack gap={2}>
        <Inline justify="space-between" gap={2}>
          <strong>{title}</strong>
          <IconButton
            icon={<X />}
            aria-label="Dismiss notification"
            variant="quiet"
            onPress={onDismiss}
          />
        </Inline>
        {children}
      </Stack>
    </StatusMessage>
  );
}

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

export function statusFromSnapshot(
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

export function installKindFromSnapshot(
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
  suppressed = false,
}: {
  readonly children: ReactNode;
  readonly usefulActionVersion: number;
  readonly dirty: boolean;
  readonly port?: BrowserUpdateInstallPort;
  readonly suppressed?: boolean;
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
  const [updateNoticeDismissed, setUpdateNoticeDismissed] = useState(false);
  const latestUsefulAction = useRef(0);
  const latestSnapshot = useRef(snapshot);
  latestSnapshot.current = snapshot;

  useEffect(() => {
    if (!snapshot.matches("updateReady") && !snapshot.matches("blocked")) {
      setUpdateNoticeDismissed(false);
    }
  }, [snapshot]);

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
      {controller.installOfferVisible && !suppressed
        ? (
          <PwaNotice
            title="Install app"
            onDismiss={controller.dismissInstall}
          >
            <Text>
              Keep Dibwyl available from your home screen. Installation is
              optional and does not change local data.
            </Text>
            <FormActions>
              <Button variant="quiet" onPress={controller.dismissInstall}>
                Dismiss
              </Button>
              <Button variant="quiet" onPress={controller.laterInstall}>
                Later
              </Button>
              <Button onPress={controller.install}>Install app</Button>
            </FormActions>
          </PwaNotice>
        )
        : null}
      {status === "update-ready" && !updateNoticeDismissed && !suppressed
        ? (
          <StatusMessage className="settings-pwa-toast" tone="info">
            <span className="local-ui-screen-reader-heading">Update ready</span>
            <Inline justify="space-between" gap={2}>
              <Button
                isDisabled={dirty}
                onPress={controller.reloadToUpdate}
                className="settings-pwa-toast__action"
              >
                Reload to update
              </Button>
              <IconButton
                icon={<X size={18} />}
                aria-label="Dismiss notification"
                variant="quiet"
                className="settings-pwa-toast__close"
                onPress={() => setUpdateNoticeDismissed(true)}
              />
            </Inline>
            {dirty
              ? (
                <Text size="caption" tone="secondary">
                  Save or discard unsaved changes before reloading.
                </Text>
              )
              : null}
          </StatusMessage>
        )
        : null}
      {children}
    </PwaContext.Provider>
  );
}
