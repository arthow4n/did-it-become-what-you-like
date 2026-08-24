import { fromPromise } from "xstate";

/** A named boundary that is implemented by a later adapter or application host. */
export type ActorPortBoundary<Input, Output> = {
  readonly input: Input;
  readonly output: Output;
  readonly cancellation: "abortable";
};

export type PortErrorCode =
  | "offline"
  | "unauthorized"
  | "conflict"
  | "invalid"
  | "quota"
  | "retired"
  | "unknown";

export type PortError = {
  readonly code: PortErrorCode;
  readonly message: string;
  readonly retryable: boolean;
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
