import {
  clearDeleteEverywhereProgress,
  clearLocalEraseProgress,
  type DestructionStorage,
  LOCAL_ERASE_PROGRESS_KEY,
  readDeleteEverywhereProgress,
  readLocalEraseGeminiKeyChoice,
  readLocalEraseProgress,
  writeDeleteEverywhereProgress,
  writeLocalEraseGeminiKeyChoice,
  writeLocalEraseProgress,
} from "../destruction.ts";
import { isAdapterError } from "../../adapters/ports/index.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function memoryStorage(): DestructionStorage & {
  readonly values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

Deno.test(
  "delete-everywhere progress persists only generation/count/phase data and reloads",
  () => {
    const storage = memoryStorage();
    writeDeleteEverywhereProgress({
      generation: 7,
      phase: "awaiting-devices",
      safetyExported: false,
      safetyDeclined: true,
      declineConfirmed: true,
      knownDeviceCount: 3,
      acknowledgedDeviceCount: 2,
      forcedDeviceCount: 0,
      updatedAt: "2026-08-24T18:00:00.000Z",
    }, storage);
    const raw = [...storage.values.values()][0] ?? "";
    assert(raw.includes('"generation":7'));
    assert(!raw.includes("expense-sensitive"));
    assert(!raw.includes("AIza"));
    assert(
      JSON.stringify(readDeleteEverywhereProgress(storage)) ===
        JSON.stringify({
          version: 1,
          generation: 7,
          phase: "awaiting-devices",
          safetyExported: false,
          safetyDeclined: true,
          declineConfirmed: true,
          knownDeviceCount: 3,
          acknowledgedDeviceCount: 2,
          forcedDeviceCount: 0,
          updatedAt: "2026-08-24T18:00:00.000Z",
        }),
    );
    clearDeleteEverywhereProgress(storage);
    assert(readDeleteEverywhereProgress(storage) === undefined);
  },
);

Deno.test("delete-everywhere rejects corrupt or inconsistent durable progress", () => {
  const storage = memoryStorage();
  storage.setItem(
    "did-it-become-what-you-like:delete-everywhere-progress",
    JSON.stringify({
      version: 1,
      generation: 2,
      phase: "awaiting-devices",
      safetyExported: false,
      safetyDeclined: true,
      declineConfirmed: true,
      knownDeviceCount: 1,
      acknowledgedDeviceCount: 2,
      forcedDeviceCount: 0,
      updatedAt: "2026-08-24T18:00:00.000Z",
    }),
  );
  let rejected = false;
  try {
    readDeleteEverywhereProgress(storage);
  } catch (error) {
    rejected = isAdapterError(error) && error.code === "corrupt-data";
  }
  assert(rejected, "invalid progress must fail closed");
});

Deno.test("delete-everywhere persists a retryable failed operation for reload", () => {
  const storage = memoryStorage();
  writeDeleteEverywhereProgress({
    generation: 3,
    phase: "failed",
    failureOperation: "deletingDrive",
    safetyExported: false,
    safetyDeclined: true,
    declineConfirmed: true,
    knownDeviceCount: 1,
    acknowledgedDeviceCount: 1,
    forcedDeviceCount: 0,
    updatedAt: "2026-08-24T18:05:00.000Z",
  }, storage);
  const progress = readDeleteEverywhereProgress(storage);
  assert(progress?.phase === "failed");
  assert(progress.failureOperation === "deletingDrive");
  assert(
    JSON.stringify(progress).includes("deletingDrive"),
    "the durable record must retain only the bounded retry operation",
  );
});

Deno.test("delete-everywhere local erase choice defaults checked and persists unchecked", () => {
  const storage = memoryStorage();
  assert(readLocalEraseGeminiKeyChoice(storage));
  writeLocalEraseGeminiKeyChoice(false, storage);
  assert(!readLocalEraseGeminiKeyChoice(storage));
  writeLocalEraseGeminiKeyChoice(true, storage);
  assert(readLocalEraseGeminiKeyChoice(storage));
});

Deno.test(
  "local erase progress persists only redacted phase and choice metadata",
  () => {
    const storage = memoryStorage();
    writeLocalEraseProgress({
      phase: "removing-key",
      removeGeminiApiKey: true,
      failureOperation: "remove-key",
      updatedAt: "2026-08-24T18:30:00.000Z",
    }, storage);
    const raw = storage.values.get(LOCAL_ERASE_PROGRESS_KEY) ?? "";
    assert(raw.includes('"phase":"removing-key"'));
    assert(raw.includes('"removeGeminiApiKey":true'));
    assert(!raw.includes("AIza"));
    assert(!raw.includes("expense-sensitive"));
    assert(
      JSON.stringify(readLocalEraseProgress(storage)) ===
        JSON.stringify({
          version: 1,
          phase: "removing-key",
          removeGeminiApiKey: true,
          failureOperation: "remove-key",
          updatedAt: "2026-08-24T18:30:00.000Z",
        }),
    );
    clearLocalEraseProgress(storage);
    assert(readLocalEraseProgress(storage) === undefined);
  },
);

Deno.test("local erase progress rejects a phase with the wrong retry operation", () => {
  const storage = memoryStorage();
  storage.setItem(
    LOCAL_ERASE_PROGRESS_KEY,
    JSON.stringify({
      version: 1,
      phase: "removing-key",
      removeGeminiApiKey: true,
      failureOperation: "erase-local",
      updatedAt: "2026-08-24T18:30:00.000Z",
    }),
  );
  let rejected = false;
  try {
    readLocalEraseProgress(storage);
  } catch (error) {
    rejected = isAdapterError(error) && error.code === "corrupt-data";
  }
  assert(rejected, "inconsistent local erase progress must fail closed");
});
