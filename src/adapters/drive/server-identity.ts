import type { OperationOptions } from "../ports/common.ts";
import {
  DRIVE_APP_DATA_SCOPE,
  type DriveIdentityProvider,
  type DriveTokenClient,
  type DriveTokenClientConfig,
} from "./browser.ts";

export type ServerIdentityOptions = {
  readonly serverUrl: string;
  readonly fetch?: typeof fetch;
};

/**
 * Adapter that provides Google Drive access tokens dispensed by the
 * Deno Deploy backend server using an HttpOnly session cookie.
 */
export function createServerIdentityProvider(
  options: ServerIdentityOptions,
): DriveIdentityProvider {
  const fetcher = options.fetch ?? globalThis.fetch;
  let raw = options.serverUrl.trim().replace(/\/+$/, "");
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    raw = `https://${raw}`;
  }
  const baseUrl = raw;

  return {
    initTokenClient: (config: DriveTokenClientConfig): DriveTokenClient => {
      return {
        requestAccessToken: () => {
          void (async () => {
            try {
              const res = await fetcher(`${baseUrl}/api/google-drive-token`, {
                method: "GET",
                credentials: "include",
              });

              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error(
                  `[Sync Server] /api/google-drive-token failed (${res.status}):`,
                  errData,
                );
                config.error_callback?.({
                  error: errData.error ?? "unauthorized",
                  type: errData.message ?? `HTTP ${res.status}`,
                });
                return;
              }

              const data = await res.json();
              config.callback({
                access_token: data.accessToken,
                expires_in: data.expiresIn ?? 3600,
                scope: DRIVE_APP_DATA_SCOPE,
                token_type: "Bearer",
              });
            } catch (err) {
              console.error(
                "[Sync Server] Network or CORS error fetching token:",
                err,
              );
              config.error_callback?.({
                error: "network_error",
                type: err instanceof Error
                  ? `Network/CORS error: ${err.message}`
                  : "Network or CORS connection failed",
              });
            }
          })();
        },
      };
    },
    revoke: async (
      _accessToken: string,
      opOptions?: OperationOptions,
    ): Promise<void> => {
      if (opOptions?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        await fetcher(`${baseUrl}/auth/google-drive/logout`, {
          method: "POST",
          credentials: "include",
          signal: opOptions?.signal,
        });
      } catch (_err) {
        if (opOptions?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        // Revocation failure does not block local disconnect
      }
    },
  };
}
