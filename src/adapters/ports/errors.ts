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
  "unknown": "never",
};

export type AdapterErrorInit = {
  readonly operation: string;
  readonly message?: string;
  readonly retryAfterMs?: number;
  readonly details?: Readonly<Record<string, string>>;
};

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
  "unknown": "The adapter operation failed for an unknown reason.",
};

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
    super(init.message ?? DEFAULT_MESSAGES[code]);
    this.code = code;
    this.operation = init.operation;
    this.retry = RETRY_BY_ERROR_CODE[code];
    this.retryAfterMs = init.retryAfterMs;
    this.details = init.details ?? {};
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

export function adapterError(
  code: AdapterErrorCode,
  operation: string,
  details: Readonly<Record<string, string>> = {},
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
