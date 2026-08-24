import { fromPromise } from "xstate";

/** A named boundary that is implemented by a later adapter or application host. */
export type ActorPortBoundary<Input, Output> = {
  readonly input: Input;
  readonly output: Output;
  readonly cancellation: "abortable";
};

export type PortErrorCode =
  | "aborted"
  | "offline"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "quota"
  | "corrupt-data"
  | "partial-transport"
  | "rate-limited"
  | "invalid-request"
  | "invalid"
  | "unsupported"
  | "unavailable"
  | "retired"
  | "unknown";

export type PortError = {
  readonly code: PortErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly retry?: "never" | "when-online" | "backoff" | "immediate";
};

/**
 * Contract shells are runnable without concrete adapters. Their default port
 * rejects loudly; production composition replaces the logic with an adapter
 * actor and tests replace it with deterministic actors.
 */
export function unwiredPort<Input, Output>(name: string) {
  return fromPromise(({ input }: { input: Input }): Promise<Output> => {
    void input;
    throw new Error(`${name} actor port is not wired`);
  });
}
