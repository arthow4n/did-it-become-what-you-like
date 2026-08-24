import { adapterError } from "../adapters/ports/index.ts";

export const DELETE_EVERYWHERE_PROGRESS_KEY =
  "did-it-become-what-you-like:delete-everywhere-progress";
export const LOCAL_ERASE_PROGRESS_KEY =
  "did-it-become-what-you-like:local-erase-progress";
export const LOCAL_ERASE_GEMINI_KEY_CHOICE =
  "did-it-become-what-you-like:local-erase-remove-gemini-key";

export type DestructionStorage = Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
>;

export type DeleteEverywhereProgressPhase =
  | "reviewing"
  | "exporting"
  | "confirming-decline"
  | "confirming"
  | "publishing-retirement"
  | "deleting-drive"
  | "erasing-local"
  | "awaiting-devices"
  | "forced-finalization"
  | "failed"
  | "completed";

export type DeleteEverywhereProgressRecord = {
  readonly version: 1;
  readonly generation: number;
  readonly phase: DeleteEverywhereProgressPhase;
  readonly safetyExported: boolean;
  readonly safetyDeclined: boolean;
  readonly declineConfirmed: boolean;
  readonly knownDeviceCount: number;
  readonly acknowledgedDeviceCount: number;
  readonly forcedDeviceCount: number;
  readonly updatedAt: string;
};

export type LocalEraseFailureOperation =
  | "persist-choice"
  | "erase-local"
  | "remove-key";

export type LocalEraseProgressPhase =
  | "reviewing"
  | "persisting-choice"
  | "erasing-local"
  | "removing-key"
  | "failed";

export type LocalEraseProgressRecord = {
  readonly version: 1;
  readonly phase: LocalEraseProgressPhase;
  readonly removeGeminiApiKey: boolean;
  readonly failureOperation: LocalEraseFailureOperation | null;
  readonly updatedAt: string;
};

function browserStorage(): DestructionStorage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function storageOrThrow(storage?: DestructionStorage): DestructionStorage {
  const selected = storage ?? browserStorage();
  if (selected === undefined) {
    throw adapterError("unavailable", "destruction.storage");
  }
  return selected;
}

function isPhase(value: unknown): value is DeleteEverywhereProgressPhase {
  return typeof value === "string" && [
    "reviewing",
    "exporting",
    "confirming-decline",
    "confirming",
    "publishing-retirement",
    "deleting-drive",
    "erasing-local",
    "awaiting-devices",
    "forced-finalization",
    "failed",
    "completed",
  ].includes(value);
}

function isLocalErasePhase(value: unknown): value is LocalEraseProgressPhase {
  return typeof value === "string" && [
    "reviewing",
    "persisting-choice",
    "erasing-local",
    "removing-key",
    "failed",
  ].includes(value);
}

function isLocalEraseFailureOperation(
  value: unknown,
): value is LocalEraseFailureOperation {
  return value === "persist-choice" || value === "erase-local" ||
    value === "remove-key";
}

function isSafeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function parseProgress(value: unknown): DeleteEverywhereProgressRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw adapterError("corrupt-data", "destruction.progress.read");
  }
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 || !isSafeCount(record.generation) ||
    !isPhase(record.phase) || !isBoolean(record.safetyExported) ||
    !isBoolean(record.safetyDeclined) || !isBoolean(record.declineConfirmed) ||
    !isSafeCount(record.knownDeviceCount) ||
    !isSafeCount(record.acknowledgedDeviceCount) ||
    !isSafeCount(record.forcedDeviceCount) ||
    typeof record.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(record.updatedAt)) ||
    record.acknowledgedDeviceCount > record.knownDeviceCount ||
    record.forcedDeviceCount > record.knownDeviceCount
  ) {
    throw adapterError("corrupt-data", "destruction.progress.read");
  }
  return {
    version: 1,
    generation: record.generation,
    phase: record.phase,
    safetyExported: record.safetyExported,
    safetyDeclined: record.safetyDeclined,
    declineConfirmed: record.declineConfirmed,
    knownDeviceCount: record.knownDeviceCount,
    acknowledgedDeviceCount: record.acknowledgedDeviceCount,
    forcedDeviceCount: record.forcedDeviceCount,
    updatedAt: record.updatedAt,
  };
}

function parseLocalEraseProgress(value: unknown): LocalEraseProgressRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw adapterError("corrupt-data", "destruction.local-erase.read");
  }
  const record = value as Record<string, unknown>;
  const phase = record.phase;
  const failureOperation = record.failureOperation;
  const expectedFailureOperation = phase === "persisting-choice"
    ? "persist-choice"
    : phase === "erasing-local"
    ? "erase-local"
    : phase === "removing-key"
    ? "remove-key"
    : undefined;
  const validFailureOperation = failureOperation === null ||
    isLocalEraseFailureOperation(failureOperation);
  if (
    record.version !== 1 || !isLocalErasePhase(phase) ||
    !isBoolean(record.removeGeminiApiKey) || !validFailureOperation ||
    (phase === "reviewing" && failureOperation !== null) ||
    (expectedFailureOperation !== undefined &&
      failureOperation !== expectedFailureOperation) ||
    (phase === "failed" && !isLocalEraseFailureOperation(failureOperation)) ||
    typeof record.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(record.updatedAt))
  ) {
    throw adapterError("corrupt-data", "destruction.local-erase.read");
  }
  return {
    version: 1,
    phase,
    removeGeminiApiKey: record.removeGeminiApiKey,
    failureOperation,
    updatedAt: record.updatedAt,
  };
}

export function readDeleteEverywhereProgress(
  storage?: DestructionStorage,
): DeleteEverywhereProgressRecord | undefined {
  const value = storageOrThrow(storage).getItem(DELETE_EVERYWHERE_PROGRESS_KEY);
  if (value === null) return undefined;
  try {
    return parseProgress(JSON.parse(value) as unknown);
  } catch (error) {
    if (error instanceof Error && error.name === "AdapterError") throw error;
    throw adapterError("corrupt-data", "destruction.progress.read");
  }
}

export function writeDeleteEverywhereProgress(
  progress: Omit<DeleteEverywhereProgressRecord, "version">,
  storage?: DestructionStorage,
): void {
  const safe = parseProgress({ version: 1, ...progress });
  storageOrThrow(storage).setItem(
    DELETE_EVERYWHERE_PROGRESS_KEY,
    JSON.stringify(safe),
  );
}

export function clearDeleteEverywhereProgress(
  storage?: DestructionStorage,
): void {
  storageOrThrow(storage).removeItem(DELETE_EVERYWHERE_PROGRESS_KEY);
}

export function readLocalEraseProgress(
  storage?: DestructionStorage,
): LocalEraseProgressRecord | undefined {
  const value = storageOrThrow(storage).getItem(LOCAL_ERASE_PROGRESS_KEY);
  if (value === null) return undefined;
  try {
    return parseLocalEraseProgress(JSON.parse(value) as unknown);
  } catch (error) {
    if (error instanceof Error && error.name === "AdapterError") throw error;
    throw adapterError("corrupt-data", "destruction.local-erase.read");
  }
}

export function writeLocalEraseProgress(
  progress: Omit<LocalEraseProgressRecord, "version">,
  storage?: DestructionStorage,
): void {
  const safe = parseLocalEraseProgress({ version: 1, ...progress });
  storageOrThrow(storage).setItem(
    LOCAL_ERASE_PROGRESS_KEY,
    JSON.stringify(safe),
  );
}

export function clearLocalEraseProgress(
  storage?: DestructionStorage,
): void {
  storageOrThrow(storage).removeItem(LOCAL_ERASE_PROGRESS_KEY);
}

export function readLocalEraseGeminiKeyChoice(
  storage?: DestructionStorage,
): boolean {
  const value = storageOrThrow(storage).getItem(LOCAL_ERASE_GEMINI_KEY_CHOICE);
  return value === null ? true : value === "true";
}

export function writeLocalEraseGeminiKeyChoice(
  remove: boolean,
  storage?: DestructionStorage,
): void {
  storageOrThrow(storage).setItem(
    LOCAL_ERASE_GEMINI_KEY_CHOICE,
    remove ? "true" : "false",
  );
}

export function isDestructionStorage(
  value: unknown,
): value is DestructionStorage {
  return value !== null && typeof value === "object" &&
    typeof (value as DestructionStorage).getItem === "function" &&
    typeof (value as DestructionStorage).setItem === "function" &&
    typeof (value as DestructionStorage).removeItem === "function";
}
