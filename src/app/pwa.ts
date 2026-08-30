/// <reference path="./env.d.ts" />

import type {
  UpdateCheckOutput,
  UpdateInstallPort,
  UpdateState,
} from "../adapters/ports/update-install.ts";
import { APP_COMMIT } from "./build-info.ts";

export const REPOSITORY_BASE_PATH = "/did-it-become-what-you-like/";

export type ServiceWorkerRegistrationTarget = {
  scriptUrl: string;
  scope: string;
};

type BeforeInstallPromptEvent = Event & {
  readonly prompt: () => Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
};

type PwaBoundary = {
  readonly updateInstallPort?: UpdateInstallPort;
  readonly installAvailable?: boolean;
};

const PWA_BOUNDARY_KEY = "__DID_IT_BECAME_WHAT_YOU_LIKE_PWA_BOUNDARY__";
let deferredInstallPrompt: BeforeInstallPromptEvent | undefined;
const installListeners = new Set<(available: boolean) => void>();
let registrationPromise: Promise<ServiceWorkerRegistration> | undefined;

function pwaBoundary(): PwaBoundary | undefined {
  const value = (globalThis as unknown as Record<string, unknown>)[
    PWA_BOUNDARY_KEY
  ];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as PwaBoundary;
}

function notifyInstallListeners(): void {
  const available = hasInstallPrompt();
  for (const listener of installListeners) listener(available);
}

function captureInstallPrompt(event: Event): void {
  const prompt = event as BeforeInstallPromptEvent;
  if (
    typeof prompt.prompt !== "function" ||
    prompt.userChoice === undefined
  ) return;
  event.preventDefault();
  deferredInstallPrompt = prompt;
  notifyInstallListeners();
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("beforeinstallprompt", captureInstallPrompt);
}

export function repositoryAssetPath(
  asset: string,
  basePath = REPOSITORY_BASE_PATH,
): string {
  if (!basePath.startsWith("/") || !basePath.endsWith("/")) {
    throw new Error("The repository base path must begin and end with '/'.");
  }
  if (asset.startsWith("/") || asset.includes("..")) {
    throw new Error("Assets must be repository-relative paths.");
  }
  return basePath + asset;
}

export function serviceWorkerRegistrationTarget(
  basePath = REPOSITORY_BASE_PATH,
): ServiceWorkerRegistrationTarget {
  return {
    scriptUrl: repositoryAssetPath("sw.js", basePath),
    scope: basePath,
  };
}

export function isWithinRepositoryServiceWorkerScope(
  requestPath: string,
  scope = REPOSITORY_BASE_PATH,
): boolean {
  return requestPath.startsWith(scope) &&
    (requestPath.length === scope.length ||
      requestPath.slice(scope.length - 1).startsWith("/"));
}

function setRegistrationState(
  state: UpdateState,
  listeners: Set<(state: UpdateState) => void>,
  value: { current: UpdateState },
): void {
  value.current = state;
  for (const listener of listeners) listener(state);
}

function observeRegistration(
  registration: ServiceWorkerRegistration,
  listeners: Set<(state: UpdateState) => void>,
  value: { current: UpdateState },
): void {
  const setWaiting = () => {
    setRegistrationState("update-available", listeners, value);
  };
  const observeInstalling = (worker: ServiceWorker): void => {
    setRegistrationState("installing", listeners, value);
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") {
        setWaiting();
      } else if (worker.state === "activated") {
        setRegistrationState("current", listeners, value);
      }
    });
  };
  registration.addEventListener("updatefound", () => {
    if (registration.installing) observeInstalling(registration.installing);
  });
  if (registration.waiting) setWaiting();
}

export function registerRepositoryServiceWorker(): void {
  if (
    import.meta.env?.PROD !== true ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) return;

  const base = new URL(import.meta.env.BASE_URL, globalThis.location.href);
  const target = serviceWorkerRegistrationTarget(base.pathname);
  registrationPromise = globalThis.navigator.serviceWorker.register(
    target.scriptUrl,
    { scope: target.scope },
  );
}

function hasInstallPrompt(): boolean {
  const boundary = pwaBoundary();
  return boundary?.installAvailable ?? deferredInstallPrompt !== undefined;
}

export type BrowserUpdateInstallPort = UpdateInstallPort & {
  readonly canInstall: () => boolean;
  readonly subscribeInstall: (
    listener: (available: boolean) => void,
  ) => () => void;
};

export function createBrowserUpdateInstallPort(): BrowserUpdateInstallPort {
  const boundary = pwaBoundary();
  const boundaryPort = boundary?.updateInstallPort;
  if (boundaryPort) {
    return {
      ...boundaryPort,
      canInstall: () => boundary?.installAvailable ?? false,
      subscribeInstall: (listener) => {
        void listener;
        return () => undefined;
      },
    };
  }

  const listeners = new Set<(state: UpdateState) => void>();
  const value = {
    current: typeof navigator !== "undefined" &&
        "serviceWorker" in navigator
      ? "current" as UpdateState
      : "unsupported" as UpdateState,
  };
  const ensureRegistration = async (): Promise<ServiceWorkerRegistration> => {
    if (import.meta.env?.PROD !== true || !("serviceWorker" in navigator)) {
      setRegistrationState("unsupported", listeners, value);
      throw { code: "unsupported" };
    }
    const registration = registrationPromise
      ? await registrationPromise
      : await navigator.serviceWorker.ready;
    observeRegistration(registration, listeners, value);
    return registration;
  };

  const port: BrowserUpdateInstallPort = {
    state: () => value.current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    check: async (options): Promise<UpdateCheckOutput> => {
      if (options?.signal?.aborted) throw { code: "aborted" };
      if (import.meta.env?.PROD !== true || !("serviceWorker" in navigator)) {
        setRegistrationState("unsupported", listeners, value);
        return { status: "up-to-date" };
      }
      const registration = await ensureRegistration();
      await registration.update();
      if (registration.waiting) {
        setRegistrationState("update-available", listeners, value);
        return { status: "update-ready", version: APP_COMMIT };
      }
      setRegistrationState("current", listeners, value);
      return { status: "up-to-date" };
    },
    install: async (options) => {
      if (options?.signal?.aborted) throw { code: "aborted" };
      if (!deferredInstallPrompt) throw { code: "unsupported" };
      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = undefined;
      notifyInstallListeners();
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome !== "accepted") throw { code: "unavailable" };
    },
    reload: async (options) => {
      if (options?.signal?.aborted) throw { code: "aborted" };
      const registration = await ensureRegistration();
      const waiting = registration.waiting;
      if (!waiting) throw { code: "not-found" };
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            finish,
          );
          resolve();
        };
        navigator.serviceWorker.addEventListener("controllerchange", finish);
        waiting.postMessage({ type: "SKIP_WAITING" });
        globalThis.setTimeout(finish, 1500);
      });
      globalThis.location.reload();
    },
    canInstall: hasInstallPrompt,
    subscribeInstall: (listener) => {
      installListeners.add(listener);
      return () => installListeners.delete(listener);
    },
  };
  return port;
}

export function isSupportedBrowser(): boolean {
  return typeof indexedDB !== "undefined" &&
    typeof globalThis.crypto !== "undefined";
}
