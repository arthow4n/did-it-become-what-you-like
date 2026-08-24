import { adapterError } from "./errors.ts";

/** JSON values are the only values allowed across persistence/service ports. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export type RetryDirective = "never" | "when-online" | "backoff" | "immediate";

export type RetryPolicy = {
  readonly maxAttempts: number;
  readonly directive: RetryDirective;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
};

export type OperationOptions = {
  readonly signal?: AbortSignal;
  readonly retry?: RetryPolicy;
};

export const NO_RETRY: RetryPolicy = {
  maxAttempts: 1,
  directive: "never",
};

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw adapterError("aborted", "adapter.operation");
  }
}

export function cloneJson<T extends JsonValue>(value: T): T {
  return structuredClone(value);
}

export function assertValidRetryPolicy(policy: RetryPolicy): void {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) {
    throw new Error("Retry maxAttempts must be a positive integer.");
  }
  if (policy.baseDelayMs !== undefined && policy.baseDelayMs < 0) {
    throw new Error("Retry baseDelayMs must be non-negative.");
  }
  if (policy.maxDelayMs !== undefined && policy.maxDelayMs < 0) {
    throw new Error("Retry maxDelayMs must be non-negative.");
  }
}
