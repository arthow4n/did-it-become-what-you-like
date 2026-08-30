import {
  adapterError,
  type OperationOptions,
  type SecretName,
  type SecretStoragePort,
  SecretValue,
  throwIfAborted,
} from "../ports/index.ts";

export const GEMINI_SECRET_STORAGE_NAMESPACE = "did-it-become-what-you-like:v1";
export const GEMINI_API_KEY_STORAGE_KEY =
  `${GEMINI_SECRET_STORAGE_NAMESPACE}:gemini-api-key`;
export const OPENROUTER_API_KEY_STORAGE_KEY =
  `${GEMINI_SECRET_STORAGE_NAMESPACE}:openrouter-api-key`;

export type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function browserStorage(): StorageLike {
  try {
    if (typeof localStorage === "undefined") {
      throw new Error("localStorage is unavailable");
    }
    return localStorage;
  } catch {
    throw adapterError("unsupported", "secrets.storage");
  }
}

/**
 * The durable receipt-AI credential boundary. It stores opaque keys in
 * repository-namespaced localStorage slots and exposes them only as
 * SecretValue. It has no IndexedDB, sync, export, or logging integration by
 * construction.
 */
export function createLocalStorageSecretStorage(
  storage: StorageLike = browserStorage(),
): SecretStoragePort {
  const read = (name: SecretName): string => {
    return name === "gemini-api-key"
      ? GEMINI_API_KEY_STORAGE_KEY
      : name === "openrouter-api-key"
      ? OPENROUTER_API_KEY_STORAGE_KEY
      : (() => {
        throw adapterError("invalid-request", "secrets.get");
      })();
  };
  return {
    get: async (name, options?: OperationOptions) => {
      throwIfAborted(options?.signal);
      await Promise.resolve();
      try {
        const value = storage.getItem(read(name));
        return value === null || value.length === 0
          ? undefined
          : SecretValue.from(value);
      } catch (error) {
        if (error instanceof Error && error.name === "AdapterError") {
          throw error;
        }
        throw adapterError("unknown", "secrets.get");
      }
    },
    set: async (name, value, options?: OperationOptions) => {
      throwIfAborted(options?.signal);
      await Promise.resolve();
      try {
        storage.setItem(read(name), value.reveal());
      } catch (error) {
        if (error instanceof Error && error.name === "AdapterError") {
          throw error;
        }
        throw adapterError("quota", "secrets.set");
      }
    },
    remove: async (name, options?: OperationOptions) => {
      throwIfAborted(options?.signal);
      await Promise.resolve();
      try {
        storage.removeItem(read(name));
      } catch (error) {
        if (error instanceof Error && error.name === "AdapterError") {
          throw error;
        }
        throw adapterError("unknown", "secrets.remove");
      }
    },
  };
}
