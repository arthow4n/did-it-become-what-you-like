import type { OperationOptions } from "./common.ts";

export type SecretName = "gemini-api-key" | "openrouter-api-key";

const REDACTED = "[REDACTED]";

/** A secret is intentionally opaque in logs, JSON, and string interpolation. */
export class SecretValue {
  readonly #value: string;

  private constructor(value: string) {
    if (value.length === 0) throw new Error("Secret values cannot be empty.");
    this.#value = value;
  }

  static from(value: string): SecretValue {
    return new SecretValue(value);
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }
}

export interface SecretStoragePort {
  get(
    name: SecretName,
    options?: OperationOptions,
  ): Promise<SecretValue | undefined>;
  set(
    name: SecretName,
    value: SecretValue,
    options?: OperationOptions,
  ): Promise<void>;
  remove(name: SecretName, options?: OperationOptions): Promise<void>;
}
