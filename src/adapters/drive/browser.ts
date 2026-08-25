import type { OperationOptions } from "../ports/common.ts";

export const DRIVE_APP_DATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata";
export const DRIVE_API_ROOT = "https://www.googleapis.com/drive/v3";
export const DRIVE_UPLOAD_ROOT = "https://www.googleapis.com/upload/drive/v3";
export const DRIVE_USER_FIELDS = "user(displayName,emailAddress,permissionId)";

export type DriveTokenSuccess = {
  readonly access_token?: unknown;
  readonly expires_in?: unknown;
  readonly scope?: unknown;
  readonly token_type?: unknown;
};

export type DriveTokenFailure = {
  readonly error?: unknown;
  readonly type?: unknown;
};

export type DriveTokenClientConfig = {
  readonly client_id: string;
  readonly scope: string;
  /** A verified email hint may avoid account selection after reconnect. */
  readonly login_hint?: string;
  /** Empty prompt reuses an existing grant without forcing consent UI. */
  readonly prompt?: "";
  readonly callback: (response: DriveTokenSuccess) => void;
  readonly error_callback?: (response: DriveTokenFailure) => void;
};

export type DriveAuthorizationOptions = OperationOptions & {
  /** Only an email from the persisted configured identity may be supplied. */
  readonly loginHint?: string;
  /** Reconnect uses GIS's empty prompt; other prompt modes are not needed. */
  readonly prompt?: "";
};

const DRIVE_LOGIN_HINT = /^[^\s@]+@[^\s@]+$/u;

export function isValidDriveLoginHint(value: unknown): value is string {
  return typeof value === "string" && value.length <= 320 &&
    DRIVE_LOGIN_HINT.test(value);
}

export interface DriveTokenClient {
  requestAccessToken(): void;
}

/** The only browser OAuth surface needed by the Drive adapter. */
export interface DriveIdentityProvider {
  initTokenClient(config: DriveTokenClientConfig): DriveTokenClient;
  revoke(
    accessToken: string,
    options?: OperationOptions,
  ): Promise<void>;
}

/** A fetch-compatible boundary; tokens stay inside the adapter's headers. */
export type DriveFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

type GoogleOauthNamespace = {
  readonly initTokenClient: (
    config: DriveTokenClientConfig,
  ) => DriveTokenClient;
  readonly revoke: (
    accessToken: string,
    callback: (response?: DriveTokenFailure) => void,
  ) => void;
};

type GoogleIdentityGlobal = {
  readonly google?: {
    readonly accounts?: {
      readonly oauth2?: GoogleOauthNamespace;
    };
  };
};

/**
 * Adapt the browser-loaded Google Identity Services object without allowing
 * its SDK types to cross the application adapter boundary.
 */
export function createGoogleIdentityProvider(
  source: GoogleIdentityGlobal = globalThis as unknown as GoogleIdentityGlobal,
): DriveIdentityProvider {
  const oauth = source.google?.accounts?.oauth2;
  if (oauth === undefined) {
    throw new Error("Google Identity Services is unavailable.");
  }

  return {
    initTokenClient: (config) => oauth.initTokenClient(config),
    revoke: (accessToken, options) => {
      if (options?.signal?.aborted) {
        return Promise.reject(new DOMException("Aborted", "AbortError"));
      }
      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const onAbort = (): void => {
          if (settled) return;
          settled = true;
          reject(new DOMException("Aborted", "AbortError"));
        };
        options?.signal?.addEventListener("abort", onAbort, { once: true });
        const finish = (error?: DriveTokenFailure): void => {
          if (settled) return;
          settled = true;
          options?.signal?.removeEventListener("abort", onAbort);
          if (error?.error !== undefined || error?.type !== undefined) {
            reject({ code: error.error ?? error.type });
          } else {
            resolve();
          }
        };
        try {
          oauth.revoke(accessToken, finish);
        } catch (error) {
          finish({ type: error instanceof Error ? error.name : "revoke" });
        }
      });
    },
  };
}

export function defaultDriveFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  return globalThis.fetch(input, init);
}
