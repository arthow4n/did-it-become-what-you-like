import type { RetryDirective } from "./common.ts";

export const ADAPTER_ERROR_CODES = [
  "aborted",
  "offline",
  "unauthorized",
  "forbidden",
  "not-found",
  "conflict",
  "quota",
  "corrupt-data",
  "partial-transport",
  "rate-limited",
  "invalid-request",
  "unsupported",
  "unavailable",
  "retired",
  "unknown",
] as const;

export type AdapterErrorCode = typeof ADAPTER_ERROR_CODES[number];

export const RETRY_BY_ERROR_CODE: Readonly<
  Record<AdapterErrorCode, RetryDirective>
> = {
  "aborted": "never",
  "offline": "when-online",
  "unauthorized": "never",
  "forbidden": "never",
  "not-found": "never",
  "conflict": "never",
  "quota": "backoff",
  "corrupt-data": "never",
  "partial-transport": "backoff",
  "rate-limited": "backoff",
  "invalid-request": "never",
  "unsupported": "never",
  "unavailable": "backoff",
  "retired": "never",
  "unknown": "never",
};

export type AdapterErrorInit = {
  readonly operation: string;
  /**
   * Retained for source compatibility only. It is never trusted or retained;
   * adapter errors always expose the code's safe default message.
   */
  readonly message?: string;
  readonly retryAfterMs?: number;
  /** Untrusted input is accepted here so the runtime boundary can redact it. */
  readonly details?: Readonly<Record<string, unknown>>;
};

export type AdapterErrorJson = {
  readonly name: "AdapterError";
  readonly code: AdapterErrorCode;
  readonly operation: string;
  readonly retry: RetryDirective;
  readonly retryAfterMs?: number;
  readonly details: Readonly<Record<string, string>>;
};

/** Foreign retirement names are normalized to the actor-facing `retired` code. */
export const RETIRED_DATASET_ERROR_ALIASES = [
  "retired-dataset",
  "retirement",
] as const;

export type RetiredDatasetErrorAlias =
  typeof RETIRED_DATASET_ERROR_ALIASES[number];

const SAFE_OPERATION = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const SAFE_HTTP_STATUS = 100;
const MAX_HTTP_STATUS = 599;
const MAX_RETRY_AFTER_MS = 86_400_000;
const SAFE_DETAIL_KEYS = ["httpStatus", "providerCode"] as const;

const DEFAULT_MESSAGES: Readonly<Record<AdapterErrorCode, string>> = {
  "aborted": "The adapter operation was aborted.",
  "offline": "The requested operation is unavailable offline.",
  "unauthorized": "Authorization is required for this operation.",
  "forbidden": "The authorized account cannot perform this operation.",
  "not-found": "The requested adapter resource was not found.",
  "conflict": "The adapter resource changed concurrently.",
  "quota": "The adapter storage or service quota was exceeded.",
  "corrupt-data": "The adapter found invalid or corrupt data.",
  "partial-transport": "The transport completed only part of the operation.",
  "rate-limited": "The service requested that the operation be retried later.",
  "invalid-request": "The adapter request was invalid.",
  "unsupported": "The requested adapter operation is unsupported.",
  "unavailable": "The adapter service is temporarily unavailable.",
  "retired": "The adapter dataset has been retired.",
  "unknown": "The adapter operation failed for an unknown reason.",
};

function safeOperation(operation: unknown): string {
  return typeof operation === "string" && SAFE_OPERATION.test(operation)
    ? operation
    : "adapter.operation";
}

function safeRetryAfterMs(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) &&
      value >= 0 && value <= MAX_RETRY_AFTER_MS
    ? value
    : undefined;
}

function safeHttpStatus(value: unknown): string | undefined {
  const status = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d{3}$/.test(value)
    ? Number(value)
    : undefined;
  return status !== undefined && Number.isInteger(status) &&
      status >= SAFE_HTTP_STATUS && status <= MAX_HTTP_STATUS
    ? String(status)
    : undefined;
}

function safeDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, string>> {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return Object.freeze({});
  }

  const retained: Record<string, string> = {};
  const httpStatus = safeHttpStatus(details[SAFE_DETAIL_KEYS[0]]);
  if (httpStatus !== undefined) retained.httpStatus = httpStatus;

  const providerCode = details[SAFE_DETAIL_KEYS[1]];
  if (isAdapterErrorCode(providerCode)) {
    retained.providerCode = providerCode;
  }

  return Object.freeze(retained);
}

/**
 * Errors crossing an adapter boundary are deliberately structured and do not
 * retain an arbitrary SDK error or its potentially sensitive message.
 */
export class AdapterError extends Error {
  override readonly name = "AdapterError";
  readonly code: AdapterErrorCode;
  readonly operation: string;
  readonly retry: RetryDirective;
  readonly retryAfterMs: number | undefined;
  readonly details: Readonly<Record<string, string>>;

  constructor(code: AdapterErrorCode, init: AdapterErrorInit) {
    // Foreign SDK text must never become application error text, even when a
    // caller constructs AdapterError directly instead of using mapAdapterError.
    super(DEFAULT_MESSAGES[code]);
    this.code = code;
    this.operation = safeOperation(init.operation);
    this.retry = RETRY_BY_ERROR_CODE[code];
    this.retryAfterMs = safeRetryAfterMs(init.retryAfterMs);
    this.details = safeDetails(init.details);
    Object.freeze(this);
  }

  /** Return the allowlisted shape safe for JSON serialization and logging. */
  toJSON(): AdapterErrorJson {
    const json: AdapterErrorJson = {
      name: this.name,
      code: this.code,
      operation: this.operation,
      retry: this.retry,
      details: this.details,
    };
    return this.retryAfterMs === undefined
      ? json
      : { ...json, retryAfterMs: this.retryAfterMs };
  }
}

type ErrorLike = {
  readonly code?: unknown;
  readonly name?: unknown;
  readonly status?: unknown;
};

function errorLike(value: unknown): ErrorLike {
  if (!value || typeof value !== "object") return {};
  return {
    code: "code" in value ? value.code : undefined,
    name: "name" in value ? value.name : undefined,
    status: "status" in value ? value.status : undefined,
  };
}

function isRetiredDatasetErrorAlias(
  value: unknown,
): value is RetiredDatasetErrorAlias {
  return typeof value === "string" &&
    (RETIRED_DATASET_ERROR_ALIASES as readonly string[]).includes(value);
}

export function adapterError(
  code: AdapterErrorCode,
  operation: string,
  details: Readonly<Record<string, unknown>> = {},
): AdapterError {
  return new AdapterError(code, { operation, details });
}

/** Map foreign errors without copying their messages into application state. */
export function mapAdapterError(
  error: unknown,
  operation: string,
): AdapterError {
  if (error instanceof AdapterError) return error;

  const candidate = errorLike(error);
  const code = candidate.code;
  if (isAdapterErrorCode(code)) {
    return adapterError(code, operation);
  }
  if (
    isRetiredDatasetErrorAlias(code) || candidate.name === "RetirementError"
  ) {
    return adapterError("retired", operation);
  }
  if (candidate.name === "AbortError") {
    return adapterError("aborted", operation);
  }

  switch (candidate.status) {
    case 401:
      return adapterError("unauthorized", operation);
    case 403:
      return adapterError("forbidden", operation);
    case 404:
      return adapterError("not-found", operation);
    case 408:
    case 429:
      return adapterError("rate-limited", operation);
    case 409:
      return adapterError("conflict", operation);
    case 410:
      return adapterError("retired", operation);
    case 413:
      return adapterError("quota", operation);
    case 503:
      return adapterError("unavailable", operation);
    default:
      return adapterError("unknown", operation);
  }
}

export function isAdapterErrorCode(value: unknown): value is AdapterErrorCode {
  return typeof value === "string" &&
    new Set<string>(ADAPTER_ERROR_CODES).has(value);
}

export function isAdapterError(error: unknown): error is AdapterError {
  return error instanceof AdapterError;
}
