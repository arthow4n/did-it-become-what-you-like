import {
  assertValidRetryPolicy,
  type OperationOptions,
  type RetryPolicy,
  throwIfAborted,
} from "../ports/common.ts";
import type { ClockPort } from "../ports/time.ts";
import {
  AdapterError,
  adapterError,
  type AdapterErrorCode,
  isAdapterError,
} from "../ports/errors.ts";
import type {
  DriveAuthorizationPort,
  DriveAuthSession,
  DriveAuthState,
  DriveFile,
  DriveTransportPort,
  DriveWriteRequest,
} from "../ports/drive.ts";
import type { DriveFetch, DriveIdentityProvider } from "./browser.ts";
import {
  defaultDriveFetch,
  DRIVE_API_ROOT,
  DRIVE_APP_DATA_SCOPE,
  DRIVE_UPLOAD_ROOT,
  DRIVE_USER_FIELDS,
} from "./browser.ts";

export const DRIVE_RETIREMENT_MARKER_NAME =
  "__did-it-become-what-you-like.retirement.json";
export const DRIVE_RETIREMENT_SCHEMA_VERSION = 1 as const;
export const DRIVE_PAGE_SIZE = 1000;
export const DRIVE_MAX_PAGES = 1000;

export const DEFAULT_DRIVE_RETRY: RetryPolicy = {
  maxAttempts: 3,
  directive: "backoff",
  baseDelayMs: 250,
  maxDelayMs: 2_000,
};

export type DriveRetirementMarker = {
  readonly schemaVersion: typeof DRIVE_RETIREMENT_SCHEMA_VERSION;
  readonly type: "retirement-marker";
  readonly generation: string;
};

export type DriveAdapterOptions = {
  readonly clientId: string;
  readonly identity: DriveIdentityProvider;
  readonly fetch?: DriveFetch;
  readonly clock?: ClockPort;
  readonly isOnline?: () => boolean;
  readonly expectedAccountId?: string;
  readonly retirementMarker?:
    | DriveRetirementMarker
    | (() => DriveRetirementMarker);
  readonly pageSize?: number;
  readonly maxPages?: number;
};

export type DriveAdapter = DriveAuthorizationPort & DriveTransportPort & {
  readonly readRetirementMarker: (
    options?: OperationOptions,
  ) => Promise<DriveRetirementMarker | undefined>;
  readonly publishRetirementMarker: (
    marker: DriveRetirementMarker,
    options?: OperationOptions,
  ) => Promise<DriveFile>;
};

type AccessToken = {
  readonly value: string;
  readonly expiresAt: number;
};

type DriveMetadata = {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly mimeType?: unknown;
  readonly modifiedTime?: unknown;
  readonly parents?: unknown;
};

type AppDataMetadata = {
  readonly id: string;
  readonly name: string;
  readonly etag: string;
  readonly modifiedTime: string;
  readonly mimeType: "application/json";
};

type DriveAboutResponse = {
  readonly user?: {
    readonly emailAddress?: unknown;
    readonly permissionId?: unknown;
  };
};

type DriveHttpFailure = {
  readonly status: number;
  readonly retryAfterMs?: number;
};

const SAFE_FILE_NAME = /^(?!\.\.?$)[^/\\\0\r\n]{1,200}$/u;
const SAFE_GENERATION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SAFE_ACCOUNT_ID = /^[^\s\0]{1,320}$/u;
const SAFE_TOKEN_TYPE = "Bearer";
const DRIVE_METADATA_FIELDS =
  "nextPageToken,files(id,name,mimeType,modifiedTime,parents)";
const DRIVE_FILE_METADATA_FIELDS = "id,name,mimeType,modifiedTime,parents";
const DRIVE_MUTATION_FIELDS = "id,name,mimeType,modifiedTime,parents";

function defaultClock(): ClockPort {
  return {
    now: () => new Date().toISOString(),
    delay: (milliseconds, options) =>
      new Promise<void>((resolve, reject) => {
        throwIfAborted(options?.signal);
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          options?.signal?.removeEventListener("abort", onAbort);
          resolve();
        }, milliseconds);
        const onAbort = (): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          options?.signal?.removeEventListener("abort", onAbort);
          reject(adapterError("aborted", "drive.retry-delay"));
        };
        options?.signal?.addEventListener("abort", onAbort, { once: true });
      }),
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function safeOperationError(
  error: unknown,
  operation: string,
  isOnline: () => boolean,
): AdapterError {
  if (isAdapterError(error)) {
    return new AdapterError(error.code, {
      operation,
      retryAfterMs: error.retryAfterMs,
      details: error.details,
    });
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return adapterError("aborted", operation);
  }
  if (record(error)?.name === "AbortError") {
    return adapterError("aborted", operation);
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const failure = error as DriveHttpFailure;
    return mapHttpStatus(failure.status, operation, failure.retryAfterMs);
  }
  return adapterError(
    isOnline() ? "partial-transport" : "offline",
    operation,
  );
}

function mapHttpStatus(
  status: number,
  operation: string,
  retryAfterMs?: number,
): AdapterError {
  let code: AdapterErrorCode;
  if (status === 401) code = "unauthorized";
  else if (status === 403) code = "forbidden";
  else if (status === 404) code = "not-found";
  else if (status === 408 || status === 429) code = "rate-limited";
  else if (status === 409 || status === 412) code = "conflict";
  else if (status === 413) code = "quota";
  else if (status >= 500 && status <= 599) code = "unavailable";
  else if (status >= 400 && status <= 499) code = "invalid-request";
  else code = "unknown";
  return new AdapterError(code, {
    operation,
    retryAfterMs,
    details: { httpStatus: status },
  });
}

function retryAfterMilliseconds(headers: Headers): number | undefined {
  const value = headers.get("retry-after");
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isInteger(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, date - Date.now());
}

function retryDelay(
  error: AdapterError,
  attempt: number,
  policy: RetryPolicy,
): number {
  const base = policy.baseDelayMs ?? 0;
  const maximum = policy.maxDelayMs ?? Number.MAX_SAFE_INTEGER;
  const exponential = Math.min(maximum, base * 2 ** Math.max(0, attempt - 1));
  return Math.min(maximum, Math.max(exponential, error.retryAfterMs ?? 0));
}

function retryAllowed(error: AdapterError, policy: RetryPolicy): boolean {
  if (policy.directive === "never" || error.retry === "never") return false;
  if (policy.directive === "when-online") return error.retry === "when-online";
  if (policy.directive === "backoff") return error.retry === "backoff";
  return true;
}

function validFileName(name: string, operation: string): void {
  if (!SAFE_FILE_NAME.test(name) || name.trim() !== name) {
    throw adapterError("invalid-request", operation);
  }
}

function validateGeneration(generation: string, operation: string): void {
  if (!SAFE_GENERATION.test(generation)) {
    throw adapterError("invalid-request", operation);
  }
}

function markerValue(
  marker: unknown,
  operation: string,
): DriveRetirementMarker {
  const value = record(marker);
  if (
    value === undefined ||
    value.schemaVersion !== DRIVE_RETIREMENT_SCHEMA_VERSION ||
    value.type !== "retirement-marker" ||
    typeof value.generation !== "string"
  ) {
    throw adapterError("corrupt-data", operation);
  }
  validateGeneration(value.generation, operation);
  const keys = Object.keys(value).sort();
  if (
    JSON.stringify(keys) !== JSON.stringify([
      "generation",
      "schemaVersion",
      "type",
    ])
  ) {
    throw adapterError("corrupt-data", operation);
  }
  return {
    schemaVersion: DRIVE_RETIREMENT_SCHEMA_VERSION,
    type: "retirement-marker",
    generation: value.generation,
  };
}

function metadataValue(
  value: unknown,
  operation: string,
): DriveMetadata {
  const metadata = record(value);
  if (metadata === undefined) throw adapterError("corrupt-data", operation);
  return metadata;
}

function appDataMetadata(
  value: unknown,
  operation: string,
  etag: string | undefined,
): AppDataMetadata {
  const metadata = metadataValue(value, operation);
  if (
    typeof metadata.id !== "string" || metadata.id.length === 0 ||
    typeof metadata.name !== "string" ||
    typeof etag !== "string" || etag.length === 0 ||
    typeof metadata.modifiedTime !== "string" ||
    !Number.isFinite(Date.parse(metadata.modifiedTime)) ||
    metadata.mimeType !== "application/json" ||
    !Array.isArray(metadata.parents) || metadata.parents.length !== 1 ||
    metadata.parents[0] !== "appDataFolder"
  ) {
    throw adapterError("corrupt-data", operation);
  }
  validFileName(metadata.name, operation);
  return {
    id: metadata.id,
    name: metadata.name,
    etag,
    modifiedTime: metadata.modifiedTime,
    mimeType: "application/json",
  };
}

function metadataToFile(
  metadata: AppDataMetadata,
  body: string,
  etag = metadata.etag,
): DriveFile {
  return {
    id: metadata.id,
    name: metadata.name,
    body,
    etag,
    updatedAt: metadata.modifiedTime,
  };
}

function asTokenResponse(
  response: unknown,
  operation: string,
): { readonly value: string; readonly expiresIn: number } {
  const value = record(response);
  if (
    value === undefined || typeof value.access_token !== "string" ||
    value.access_token.length === 0 || typeof value.expires_in !== "number" ||
    !Number.isInteger(value.expires_in) || value.expires_in <= 0 ||
    value.expires_in > 31_536_000 || typeof value.scope !== "string" ||
    value.token_type !== SAFE_TOKEN_TYPE
  ) {
    throw adapterError("corrupt-data", operation);
  }
  const scopes = value.scope.split(/\s+/u).filter(Boolean);
  if (scopes.length !== 1 || scopes[0] !== DRIVE_APP_DATA_SCOPE) {
    throw adapterError("forbidden", operation);
  }
  return {
    value: value.access_token,
    expiresIn: value.expires_in,
  };
}

function tokenFailureCode(response: unknown): string {
  const value = record(response);
  const candidate = value?.error ?? value?.type;
  return typeof candidate === "string" ? candidate.toLowerCase() : "";
}

function isAuthorizationCancel(response: unknown): boolean {
  const code = tokenFailureCode(response);
  return code.includes("cancel") || code.includes("den") ||
    code.includes("closed") || code.includes("abort");
}

function accountIdFromAbout(
  response: unknown,
  operation: string,
): string {
  const about = record(response) as DriveAboutResponse | undefined;
  const user = about?.user;
  const permissionId = user?.permissionId;
  const email = user?.emailAddress;
  const accountId = typeof permissionId === "string" && permissionId.length > 0
    ? permissionId
    : typeof email === "string" && email.length > 0
    ? email
    : undefined;
  if (accountId === undefined || !SAFE_ACCOUNT_ID.test(accountId)) {
    throw adapterError("corrupt-data", operation);
  }
  return accountId;
}

function jsonKeys(value: unknown): Record<string, unknown> | undefined {
  return record(value);
}

export function createDriveAdapter(options: DriveAdapterOptions): DriveAdapter {
  if (options.clientId.trim().length === 0) {
    throw adapterError("invalid-request", "drive.create");
  }
  if (
    options.expectedAccountId !== undefined &&
    !SAFE_ACCOUNT_ID.test(options.expectedAccountId)
  ) {
    throw adapterError("invalid-request", "drive.create");
  }
  const pageSize = options.pageSize ?? DRIVE_PAGE_SIZE;
  const maxPages = options.maxPages ?? DRIVE_MAX_PAGES;
  if (
    !Number.isInteger(pageSize) || pageSize < 1 || pageSize > DRIVE_PAGE_SIZE
  ) {
    throw adapterError("invalid-request", "drive.create");
  }
  if (
    !Number.isInteger(maxPages) || maxPages < 1 || maxPages > DRIVE_MAX_PAGES
  ) {
    throw adapterError("invalid-request", "drive.create");
  }

  const fetcher = options.fetch ?? defaultDriveFetch;
  const clock = options.clock ?? defaultClock();
  const isOnline = options.isOnline ?? (() => {
    return typeof navigator === "undefined" || navigator.onLine;
  });

  let authState: DriveAuthState = "signed-out";
  let accountId: string | undefined;
  let accessToken: AccessToken | undefined;
  let authorizationInFlight = false;

  const clearToken = (): void => {
    accessToken = undefined;
    authState = "signed-out";
  };

  const tokenIsUsable = (): boolean => {
    if (accessToken === undefined) return false;
    if (Date.parse(clock.now()) >= accessToken.expiresAt) {
      clearToken();
      return false;
    }
    return true;
  };

  const requireToken = (operation: string): AccessToken => {
    if (!tokenIsUsable() || authState !== "authorized") {
      throw adapterError("unauthorized", operation);
    }
    return accessToken!;
  };

  const mapped = (error: unknown, operation: string): AdapterError => {
    const result = safeOperationError(error, operation, isOnline);
    if (result.code === "unauthorized") clearToken();
    return result;
  };

  async function withRetry<T>(
    operation: string,
    optionsForOperation: OperationOptions | undefined,
    action: () => Promise<T>,
  ): Promise<T> {
    const policy = optionsForOperation?.retry ?? DEFAULT_DRIVE_RETRY;
    assertValidRetryPolicy(policy);
    let attempt = 1;
    while (true) {
      throwIfAborted(optionsForOperation?.signal);
      try {
        return await action();
      } catch (error) {
        const safe = mapped(error, operation);
        if (attempt >= policy.maxAttempts || !retryAllowed(safe, policy)) {
          throw safe;
        }
        await clock.delay(
          retryDelay(safe, attempt, policy),
          optionsForOperation,
        );
        attempt += 1;
      }
    }
  }

  function url(
    path: string,
    parameters: Readonly<Record<string, string>>,
    root = DRIVE_API_ROOT,
  ): string {
    const result = new URL(`${root}/${path}`);
    for (const [key, value] of Object.entries(parameters)) {
      result.searchParams.set(key, value);
    }
    return result.toString();
  }

  async function responseFor(
    token: AccessToken,
    request: {
      readonly path: string;
      readonly parameters?: Readonly<Record<string, string>>;
      readonly method?: string;
      readonly body?: string;
      readonly headers?: Readonly<Record<string, string>>;
      readonly root?: string;
    },
    operation: string,
    optionsForOperation: OperationOptions | undefined,
  ): Promise<Response> {
    try {
      if (!isOnline()) {
        throw adapterError("offline", operation);
      }
      const response = await fetcher(
        url(request.path, request.parameters ?? {}, request.root),
        {
          method: request.method ?? "GET",
          headers: {
            Authorization: `Bearer ${token.value}`,
            ...(request.body === undefined
              ? {}
              : { "Content-Type": "multipart/related" }),
            ...request.headers,
          },
          ...(request.body === undefined ? {} : { body: request.body }),
          ...(optionsForOperation?.signal === undefined
            ? {}
            : { signal: optionsForOperation.signal }),
        },
      );
      if (!response.ok) {
        throw {
          status: response.status,
          retryAfterMs: retryAfterMilliseconds(response.headers),
        } satisfies DriveHttpFailure;
      }
      return response;
    } catch (error) {
      throw mapped(error, operation);
    }
  }

  async function responseText(
    token: AccessToken,
    request: Parameters<typeof responseFor>[1],
    operation: string,
    optionsForOperation: OperationOptions | undefined,
  ): Promise<{ readonly body: string; readonly etag?: string }> {
    const response = await responseFor(
      token,
      request,
      operation,
      optionsForOperation,
    );
    try {
      const body = await response.text();
      const etag = response.headers.get("etag") ?? undefined;
      return { body, ...(etag === undefined ? {} : { etag }) };
    } catch {
      throw adapterError("partial-transport", operation);
    }
  }

  async function responseJson(
    token: AccessToken,
    request: Parameters<typeof responseFor>[1],
    operation: string,
    optionsForOperation: OperationOptions | undefined,
  ): Promise<{ readonly value: unknown; readonly etag?: string }> {
    const response = await responseText(
      token,
      request,
      operation,
      optionsForOperation,
    );
    try {
      return {
        value: JSON.parse(response.body) as unknown,
        ...(response.etag === undefined ? {} : { etag: response.etag }),
      };
    } catch {
      throw adapterError("corrupt-data", operation);
    }
  }

  async function metadataFor(
    listed: { readonly id: string; readonly name: string },
    optionsForOperation: OperationOptions | undefined,
  ): Promise<AppDataMetadata> {
    const token = requireToken("drive.metadata");
    const response = await withRetry(
      "drive.metadata",
      optionsForOperation,
      () =>
        responseJson(
          token,
          {
            path: `files/${encodeURIComponent(listed.id)}`,
            parameters: { fields: DRIVE_FILE_METADATA_FIELDS },
          },
          "drive.metadata",
          optionsForOperation,
        ),
    );
    const metadata = appDataMetadata(
      response.value,
      "drive.metadata",
      response.etag,
    );
    if (metadata.id !== listed.id || metadata.name !== listed.name) {
      throw adapterError("corrupt-data", "drive.metadata");
    }
    return metadata;
  }

  async function listMetadata(
    optionsForOperation: OperationOptions | undefined,
  ): Promise<readonly AppDataMetadata[]> {
    const token = requireToken("drive.list");
    const result: AppDataMetadata[] = [];
    const names = new Set<string>();
    let pageToken: string | undefined;
    for (let page = 0; page < maxPages; page += 1) {
      const pageResult = await withRetry(
        "drive.list",
        optionsForOperation,
        () =>
          responseJson(
            token,
            {
              path: "files",
              parameters: {
                spaces: "appDataFolder",
                pageSize: String(pageSize),
                fields: DRIVE_METADATA_FIELDS,
                ...(pageToken === undefined ? {} : { pageToken }),
              },
            },
            "drive.list",
            optionsForOperation,
          ),
      );
      const response = jsonKeys(pageResult.value);
      if (response === undefined || !Array.isArray(response.files)) {
        throw adapterError("corrupt-data", "drive.list");
      }
      for (const item of response.files) {
        const listed = metadataValue(item, "drive.list");
        const listedId = listed.id;
        const listedName = listed.name;
        if (
          typeof listedId !== "string" || listedId.length === 0 ||
          typeof listedName !== "string"
        ) {
          throw adapterError("corrupt-data", "drive.list");
        }
        validFileName(listedName, "drive.list");
        const metadata = await metadataFor(
          { id: listedId, name: listedName },
          optionsForOperation,
        );
        if (names.has(metadata.name)) {
          throw adapterError("corrupt-data", "drive.list");
        }
        names.add(metadata.name);
        result.push(metadata);
      }
      if (response.nextPageToken === undefined) return result;
      if (
        typeof response.nextPageToken !== "string" ||
        response.nextPageToken.length === 0 ||
        response.nextPageToken === pageToken
      ) {
        throw adapterError("corrupt-data", "drive.list");
      }
      pageToken = response.nextPageToken;
    }
    throw adapterError("partial-transport", "drive.list");
  }

  function bodyFor(
    metadata: AppDataMetadata,
    optionsForOperation: OperationOptions | undefined,
  ): Promise<{ readonly body: string; readonly etag: string }> {
    const token = requireToken("drive.read");
    return withRetry("drive.read", optionsForOperation, () =>
      responseText(
        token,
        {
          path: `files/${encodeURIComponent(metadata.id)}`,
          parameters: { alt: "media" },
        },
        "drive.read",
        optionsForOperation,
      ).then((response) => {
        if (response.etag === undefined || response.etag.length === 0) {
          throw adapterError("corrupt-data", "drive.read");
        }
        return { body: response.body, etag: response.etag };
      }));
  }

  async function readAppDataInternal(
    name: string,
    optionsForOperation: OperationOptions | undefined,
  ): Promise<DriveFile | undefined> {
    validFileName(name, "drive.read");
    const metadata = (await listMetadata(optionsForOperation)).find((item) =>
      item.name === name
    );
    if (metadata === undefined) return undefined;
    const response = await bodyFor(metadata, optionsForOperation);
    return metadataToFile(metadata, response.body, response.etag);
  }

  function writeRaw(
    request: DriveWriteRequest,
    optionsForOperation: OperationOptions | undefined,
  ): Promise<DriveFile> {
    validFileName(request.name, "drive.write");
    if (typeof request.body !== "string") {
      throw adapterError("invalid-request", "drive.write");
    }
    let attempted = false;
    return withRetry("drive.write", optionsForOperation, async () => {
      const metadata = (await listMetadata(optionsForOperation)).find((item) =>
        item.name === request.name
      );
      if (request.expectedEtag !== undefined) {
        if (metadata === undefined) {
          throw adapterError("not-found", "drive.write");
        }
        if (metadata.etag !== request.expectedEtag) {
          if (attempted) {
            const currentBody = await bodyFor(metadata, optionsForOperation);
            if (currentBody.body === request.body) {
              return metadataToFile(
                metadata,
                currentBody.body,
                currentBody.etag,
              );
            }
          }
          throw adapterError("conflict", "drive.write");
        }
      }
      const operation = metadata === undefined
        ? "drive.create"
        : "drive.update";
      const token = requireToken(operation);
      const multipart = multipartBody(
        metadata === undefined
          ? {
            mimeType: "application/json",
            name: request.name,
            parents: ["appDataFolder"],
          }
          : { mimeType: "application/json" },
        request.body,
      );
      attempted = true;
      const response = await responseJson(
        token,
        {
          path: metadata === undefined
            ? "files"
            : `files/${encodeURIComponent(metadata.id)}`,
          root: DRIVE_UPLOAD_ROOT,
          parameters: {
            uploadType: "multipart",
            fields: DRIVE_MUTATION_FIELDS,
          },
          method: metadata === undefined ? "POST" : "PATCH",
          body: multipart.body,
          headers: {
            "Content-Type": multipart.contentType,
            ...(metadata === undefined ? {} : { "If-Match": metadata.etag }),
          },
        },
        operation,
        optionsForOperation,
      );
      const next = appDataMetadata(response.value, operation, response.etag);
      return metadataToFile(next, request.body);
    });
  }

  async function deleteRaw(
    name: string,
    expectedEtag: string | undefined,
    optionsForOperation: OperationOptions | undefined,
    ignoreMissing: boolean,
  ): Promise<void> {
    validFileName(name, "drive.delete");
    let attempted = false;
    await withRetry("drive.delete", optionsForOperation, async () => {
      const metadata = (await listMetadata(optionsForOperation)).find((item) =>
        item.name === name
      );
      if (metadata === undefined) {
        if (ignoreMissing || attempted) return;
        throw adapterError("not-found", "drive.delete");
      }
      if (expectedEtag !== undefined && metadata.etag !== expectedEtag) {
        throw adapterError("conflict", "drive.delete");
      }
      const token = requireToken("drive.delete");
      attempted = true;
      try {
        await responseFor(
          token,
          {
            path: `files/${encodeURIComponent(metadata.id)}`,
            method: "DELETE",
            headers: { "If-Match": metadata.etag },
          },
          "drive.delete",
          optionsForOperation,
        );
      } catch (error) {
        const safe = mapped(error, "drive.delete");
        if (safe.code === "not-found") return;
        throw safe;
      }
    });
  }

  async function readRetirementMarker(
    optionsForOperation?: OperationOptions,
  ): Promise<DriveRetirementMarker | undefined> {
    const file = await readAppDataInternal(
      DRIVE_RETIREMENT_MARKER_NAME,
      optionsForOperation,
    );
    if (file === undefined) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.body) as unknown;
    } catch {
      throw adapterError("corrupt-data", "drive.retirement.read");
    }
    return markerValue(parsed, "drive.retirement.read");
  }

  function configuredMarker(): DriveRetirementMarker {
    const marker = typeof options.retirementMarker === "function"
      ? options.retirementMarker()
      : options.retirementMarker;
    if (marker === undefined) {
      throw adapterError("invalid-request", "drive.retirement.publish");
    }
    return markerValue(marker, "drive.retirement.publish");
  }

  async function publishRetirementMarker(
    marker: DriveRetirementMarker,
    optionsForOperation?: OperationOptions,
  ): Promise<DriveFile> {
    const normalized = markerValue(marker, "drive.retirement.publish");
    const existing = await readAppDataInternal(
      DRIVE_RETIREMENT_MARKER_NAME,
      optionsForOperation,
    );
    if (existing !== undefined) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(existing.body) as unknown;
      } catch {
        throw adapterError("corrupt-data", "drive.retirement.publish");
      }
      const prior = markerValue(parsed, "drive.retirement.publish");
      if (prior.generation !== normalized.generation) {
        throw adapterError("retired", "drive.retirement.publish");
      }
      return existing;
    }
    return writeRaw({
      name: DRIVE_RETIREMENT_MARKER_NAME,
      body: JSON.stringify(normalized),
    }, optionsForOperation);
  }

  function requestToken(
    optionsForOperation: OperationOptions | undefined,
  ): Promise<{ readonly value: string; readonly expiresIn: number }> {
    throwIfAborted(optionsForOperation?.signal);
    return new Promise((resolve, reject) => {
      let settled = false;
      const onAbort = (): void => {
        if (settled) return;
        settled = true;
        optionsForOperation?.signal?.removeEventListener("abort", onAbort);
        reject(adapterError("aborted", "drive.authorize"));
      };
      const finish = (
        action: () => void,
      ): void => {
        if (settled) return;
        settled = true;
        optionsForOperation?.signal?.removeEventListener("abort", onAbort);
        action();
      };
      const callback = (response: unknown): void => {
        try {
          const parsed = asTokenResponse(response, "drive.authorize");
          if (settled) {
            void options.identity.revoke(parsed.value).catch(() => undefined);
            return;
          }
          finish(() =>
            resolve({ value: parsed.value, expiresIn: parsed.expiresIn })
          );
        } catch (error) {
          finish(() => reject(error));
        }
      };
      const errorCallback = (response: unknown): void => {
        finish(() =>
          reject(
            adapterError(
              isAuthorizationCancel(response) ? "aborted" : "unavailable",
              "drive.authorize",
            ),
          )
        );
      };
      optionsForOperation?.signal?.addEventListener("abort", onAbort, {
        once: true,
      });
      try {
        const client = options.identity.initTokenClient({
          client_id: options.clientId,
          scope: DRIVE_APP_DATA_SCOPE,
          callback,
          error_callback: errorCallback,
        });
        client.requestAccessToken();
      } catch (error) {
        finish(() =>
          reject(safeOperationError(error, "drive.authorize", isOnline))
        );
      }
    });
  }

  async function revokeToken(
    token: string,
    optionsForOperation: OperationOptions | undefined,
  ): Promise<void> {
    try {
      await options.identity.revoke(token, optionsForOperation);
    } catch (error) {
      throw mapped(error, "drive.revoke");
    }
  }

  const api: DriveAdapter = {
    status: () => authState,

    authorize: async (optionsForOperation) => {
      throwIfAborted(optionsForOperation?.signal);
      if (
        authState === "authorized" && tokenIsUsable() && accountId !== undefined
      ) {
        return {
          accountId,
          scopes: ["appDataFolder"],
        } satisfies DriveAuthSession;
      }
      if (authorizationInFlight) {
        throw adapterError("conflict", "drive.authorize");
      }
      authorizationInFlight = true;
      authState = "authorizing";
      let acquired:
        | { readonly value: string; readonly expiresIn: number }
        | undefined;
      try {
        acquired = await requestToken(optionsForOperation);
        const tokenForIdentity: AccessToken = {
          value: acquired.value,
          expiresAt: Date.parse(clock.now()) + acquired.expiresIn * 1000,
        };
        const response = await withRetry(
          "drive.authorize.identity",
          optionsForOperation,
          () =>
            responseJson(
              tokenForIdentity,
              {
                path: "about",
                parameters: { fields: DRIVE_USER_FIELDS },
              },
              "drive.authorize.identity",
              optionsForOperation,
            ),
        );
        const nextAccountId = accountIdFromAbout(
          response.value,
          "drive.authorize.identity",
        );
        if (
          (options.expectedAccountId !== undefined &&
            nextAccountId !== options.expectedAccountId) ||
          (accountId !== undefined && nextAccountId !== accountId)
        ) {
          throw adapterError("conflict", "drive.authorize.account");
        }
        accessToken = tokenForIdentity;
        accountId = nextAccountId;
        authState = "authorized";
        return {
          accountId: nextAccountId,
          scopes: ["appDataFolder"],
        } satisfies DriveAuthSession;
      } catch (error) {
        if (acquired !== undefined && accessToken?.value !== acquired.value) {
          await revokeToken(acquired.value, undefined).catch(() => undefined);
        }
        clearToken();
        throw mapped(error, "drive.authorize");
      } finally {
        authorizationInFlight = false;
      }
    },

    disconnect: async (optionsForOperation) => {
      throwIfAborted(optionsForOperation?.signal);
      const token = accessToken?.value;
      clearToken();
      accountId = undefined;
      if (token !== undefined) await revokeToken(token, optionsForOperation);
    },

    deleteEverywhere: async (optionsForOperation) => {
      throwIfAborted(optionsForOperation?.signal);
      const marker = configuredMarker();
      const prior = await readRetirementMarker(optionsForOperation);
      if (prior !== undefined && prior.generation !== marker.generation) {
        throw adapterError("retired", "drive.delete-everywhere");
      }
      if (prior === undefined) {
        await publishRetirementMarker(marker, optionsForOperation);
      }
      const files = await listMetadata(optionsForOperation);
      for (const file of files) {
        if (file.name === DRIVE_RETIREMENT_MARKER_NAME) continue;
        await deleteRaw(file.name, file.etag, optionsForOperation, true);
      }
      await api.disconnect(optionsForOperation);
    },

    listAppData: async (optionsForOperation) => {
      const metadata = await listMetadata(optionsForOperation);
      const files: Array<Promise<DriveFile>> = [];
      for (const item of metadata) {
        files.push(
          bodyFor(item, optionsForOperation).then((response) =>
            metadataToFile(item, response.body, response.etag)
          ),
        );
      }
      return await Promise.all(files);
    },

    readAppData: (name, optionsForOperation) =>
      readAppDataInternal(name, optionsForOperation),

    writeAppData: async (request, optionsForOperation) => {
      validFileName(request.name, "drive.write");
      if (request.name === DRIVE_RETIREMENT_MARKER_NAME) {
        throw adapterError("forbidden", "drive.write");
      }
      const marker = await readRetirementMarker(optionsForOperation);
      if (marker !== undefined) throw adapterError("retired", "drive.write");
      return writeRaw(request, optionsForOperation);
    },

    deleteAppData: (name, expectedEtag, optionsForOperation) => {
      if (name === DRIVE_RETIREMENT_MARKER_NAME) {
        return Promise.reject(adapterError("forbidden", "drive.delete"));
      }
      return deleteRaw(name, expectedEtag, optionsForOperation, false);
    },

    readRetirementMarker,
    publishRetirementMarker,
  };

  return api;
}

function multipartBody(
  metadata: Readonly<Record<string, unknown>>,
  body: string,
): { readonly body: string; readonly contentType: string } {
  const random = globalThis.crypto?.randomUUID?.() ?? "synthetic-boundary";
  const boundary = `drive-adapter-${random}`;
  return {
    body: [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json",
      "",
      body,
      `--${boundary}--`,
      "",
    ].join("\r\n"),
    contentType: `multipart/related; boundary="${boundary}"`,
  };
}
