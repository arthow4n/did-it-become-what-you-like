import {
  clearDeleteEverywhereProgress,
  type DestructionStorage,
  readDeleteEverywhereProgress,
  readLocalEraseGeminiKeyChoice,
  writeDeleteEverywhereProgress,
  writeLocalEraseGeminiKeyChoice,
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

Deno.test("delete-everywhere local erase choice defaults checked and persists unchecked", () => {
  const storage = memoryStorage();
  assert(readLocalEraseGeminiKeyChoice(storage));
  writeLocalEraseGeminiKeyChoice(false, storage);
  assert(!readLocalEraseGeminiKeyChoice(storage));
  writeLocalEraseGeminiKeyChoice(true, storage);
  assert(readLocalEraseGeminiKeyChoice(storage));
});
