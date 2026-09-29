import type {
  CausalSyncRecoveryPort,
  DriveAuthState,
} from "../../adapters/ports/index.ts";
import {
  createDriveAdapter,
  createGoogleIdentityProvider,
  createServerIdentityProvider,
  type DriveAdapter,
  type DriveAuthorizationOptions,
  type DriveIdentityProvider,
} from "../../adapters/drive/index.ts";
import type { CausalSyncPort } from "../../adapters/ports/index.ts";
import type { SyncConnectionViewModel } from "../sync-ui/index.ts";

export type SyncRuntimeBoundary = {
  readonly drive?: DriveAdapter;
  readonly causal?: CausalSyncPort;
  readonly recovery?: CausalSyncRecoveryPort;
  readonly clientId?: string;
  readonly identity?: DriveIdentityProvider;
};

export const SYNC_RUNTIME_BOUNDARY_KEY =
  "__DID_IT_BECAME_WHAT_YOU_LIKE_SYNC_BOUNDARY__";

export function configuredRuntimeBoundary(): SyncRuntimeBoundary {
  const value = (globalThis as unknown as Record<string, unknown>)[
    SYNC_RUNTIME_BOUNDARY_KEY
  ];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const candidate = value as Record<string, unknown>;
  return {
    ...(candidate.drive === undefined
      ? {}
      : { drive: candidate.drive as DriveAdapter }),
    ...(candidate.causal === undefined
      ? {}
      : { causal: candidate.causal as CausalSyncPort }),
    ...(candidate.recovery === undefined
      ? {}
      : { recovery: candidate.recovery as CausalSyncRecoveryPort }),
    ...(typeof candidate.clientId === "string"
      ? { clientId: candidate.clientId }
      : {}),
    ...(candidate.identity === undefined
      ? {}
      : { identity: candidate.identity as DriveIdentityProvider }),
  };
}

export function browserConfiguredClientId(): string | undefined {
  const env = (import.meta as unknown as {
    readonly env?: { readonly VITE_GOOGLE_CLIENT_ID?: unknown };
  }).env;
  return typeof env?.VITE_GOOGLE_CLIENT_ID === "string"
    ? env.VITE_GOOGLE_CLIENT_ID
    : undefined;
}

export const DEFAULT_SYNC_SERVER_URL =
  "https://did-it-become-what-you-like.arthow4n.deno.net";

export function browserConfiguredSyncServerUrl(): string {
  const env = (import.meta as unknown as {
    readonly env?: { readonly VITE_SYNC_SERVER_URL?: unknown };
  }).env;
  return typeof env?.VITE_SYNC_SERVER_URL === "string" &&
      env.VITE_SYNC_SERVER_URL.trim().length > 0
    ? env.VITE_SYNC_SERVER_URL.trim()
    : DEFAULT_SYNC_SERVER_URL;
}

export function createConfiguredDriveAdapter(
  boundary: SyncRuntimeBoundary = configuredRuntimeBoundary(),
  connectionMode: "persisted" | "direct" = "direct",
  syncServerUrl?: string,
): DriveAdapter | null {
  if (boundary.drive !== undefined) return boundary.drive;
  const clientId = boundary.clientId ?? browserConfiguredClientId();

  if (connectionMode === "persisted") {
    const rawUrl = (syncServerUrl ?? browserConfiguredSyncServerUrl()).trim();
    if (rawUrl.length === 0) return null;
    const serverUrl =
      !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")
        ? `https://${rawUrl}`
        : rawUrl;
    try {
      const identity = boundary.identity ??
        createServerIdentityProvider({ serverUrl });
      return createDriveAdapter({
        clientId: clientId ?? "server-managed",
        identity,
        isOnline: () => globalThis.navigator?.onLine !== false,
      });
    } catch {
      return null;
    }
  }

  if (clientId === undefined || clientId.trim().length === 0) return null;
  try {
    const identity = boundary.identity ?? createGoogleIdentityProvider();
    return createDriveAdapter({
      clientId,
      identity,
      isOnline: () => globalThis.navigator?.onLine !== false,
    });
  } catch {
    return null;
  }
}

export function requiresDriveAuthorization(
  accountEmail: string | null,
  driveStatus: DriveAuthState | null,
): boolean {
  return accountEmail !== null && driveStatus !== "authorized";
}

export function reconnectAuthorizationOptions(
  view: SyncConnectionViewModel,
): DriveAuthorizationOptions {
  return {
    prompt: "",
    ...(view.mode === "configured" ? { loginHint: view.accountEmail } : {}),
  };
}
