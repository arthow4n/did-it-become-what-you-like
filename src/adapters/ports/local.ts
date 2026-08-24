import type { JsonValue, OperationOptions } from "./common.ts";

export const LOCAL_COLLECTIONS = [
  "records",
  "settings",
  "sync-metadata",
  "workflow-snapshots",
] as const;

export type LocalCollection = typeof LOCAL_COLLECTIONS[number];
export type LocalKey = string;
export type LocalTransactionMode = "readonly" | "readwrite";

export type LocalQuery = {
  readonly index?: string;
  readonly equals?: string | number | boolean | null;
  readonly limit?: number;
};

export interface LocalTransactionPort {
  transaction<T>(
    mode: LocalTransactionMode,
    work: (transaction: LocalTransaction) => Promise<T>,
    options?: OperationOptions,
  ): Promise<T>;
}

export interface LocalQueryPort {
  query<T extends JsonValue = JsonValue>(
    collection: LocalCollection,
    query?: LocalQuery,
    options?: OperationOptions,
  ): Promise<readonly LocalEntry<T>[]>;
}

export interface LocalPort extends LocalTransactionPort, LocalQueryPort {}

export interface LocalTransaction {
  get<T extends JsonValue = JsonValue>(
    collection: LocalCollection,
    key: LocalKey,
    options?: OperationOptions,
  ): Promise<T | undefined>;
  put<T extends JsonValue>(
    collection: LocalCollection,
    key: LocalKey,
    value: T,
    options?: OperationOptions,
  ): Promise<void>;
  delete(
    collection: LocalCollection,
    key: LocalKey,
    options?: OperationOptions,
  ): Promise<void>;
  query<T extends JsonValue = JsonValue>(
    collection: LocalCollection,
    query?: LocalQuery,
    options?: OperationOptions,
  ): Promise<readonly LocalEntry<T>[]>;
}

export type LocalEntry<T extends JsonValue = JsonValue> = {
  readonly key: LocalKey;
  readonly value: T;
};
