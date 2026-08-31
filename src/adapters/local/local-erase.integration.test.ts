import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { createActor } from "xstate";
import {
  createLocalEraseMachine,
  persistLocalEraseSnapshot,
  recoverLocalEraseSnapshot,
} from "../../actors/destruction.ts";
import { deleteLocalRepositoryDatabase, openLocalRepository } from "./index.ts";
import {
  type DestructionStorage,
  readLocalEraseProgress,
} from "../../domain/destruction.ts";
import { settle } from "../../test-support/index.ts";

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

let sequence = 0;

function databaseName(): string {
  sequence += 1;
  return `did-it-become-what-you-like-r600-local-erase-${sequence}`;
}

Deno.test(
  "local-erase integration: reload between database erasure and key removal resumes safely",
  async () => {
    const name = databaseName();
    const storage = memoryStorage();
    const firstCalls: string[] = [];
    let keyPresent = true;
    let releaseKey: (() => void) | undefined;
    const pendingKey = new Promise<void>((resolve) => {
      releaseKey = resolve;
    });
    await deleteLocalRepositoryDatabase(name, indexedDB).catch(() => undefined);
    const firstRepository = await openLocalRepository({
      databaseName: name,
      deviceId: "0123456789abcdef0123456789abcdef",
      indexedDB,
      keyRange: IDBKeyRange,
    });
    await firstRepository.transaction("readwrite", async (transaction) => {
      await transaction.put("records", "expense-1", {
        type: "expense",
        id: "expense-1",
        amount: "-10",
      });
    });

    const firstMachine = createLocalEraseMachine({
      storage,
      now: () => "2026-08-24T19:00:00.000Z",
      eraseLocalDataset: async () => {
        firstCalls.push("erase");
        firstRepository.close();
        await deleteLocalRepositoryDatabase(name, indexedDB);
      },
      removeReceiptAiKeys: () => {
        firstCalls.push("key");
        return pendingKey;
      },
    });
    const first = createActor(firstMachine).start();
    first.send({ type: "local-erase.open", removeReceiptAiKeys: true });
    first.send({ type: "local-erase.confirm" });
    await settle();

    const saved = readLocalEraseProgress(storage);
    assert(saved?.phase === "removing-key");
    assert(keyPresent, "the key must remain until its removal phase runs");
    assert(firstCalls.join(",") === "erase,key");

    const emptyRepository = await openLocalRepository({
      databaseName: name,
      deviceId: "0123456789abcdef0123456789abcdef",
      indexedDB,
      keyRange: IDBKeyRange,
    });
    try {
      assert(
        (await emptyRepository.query("records")).length === 0,
        "the database must already be erased in the crash window",
      );
    } finally {
      emptyRepository.close();
    }

    // Stop before resolving the in-flight key operation to model a reload.
    first.stop();
    releaseKey?.();

    const restartedRepository = await openLocalRepository({
      databaseName: name,
      deviceId: "0123456789abcdef0123456789abcdef",
      indexedDB,
      keyRange: IDBKeyRange,
    });
    const restartCalls: string[] = [];
    const restartedMachine = createLocalEraseMachine({
      storage,
      now: () => "2026-08-24T19:01:00.000Z",
      eraseLocalDataset: async () => {
        restartCalls.push("erase");
        restartedRepository.close();
        await deleteLocalRepositoryDatabase(name, indexedDB);
      },
      removeReceiptAiKeys: () => {
        restartCalls.push("key");
        keyPresent = false;
        return Promise.resolve();
      },
    });
    const restarted = createActor(
      restartedMachine,
      { snapshot: recoverLocalEraseSnapshot(restartedMachine, saved) },
    ).start();
    await settle();
    assert(restarted.getSnapshot().matches("failed"));
    assert(restartCalls.length === 0);
    restarted.send({ type: "local-erase.retry" });
    await settle();
    assert(restarted.getSnapshot().matches("completed"));
    assert(!keyPresent, "restart must finish the pending key removal");
    assert(
      restartCalls.join(",") === "key",
      "removing-key recovery must not repeat database erasure",
    );

    persistLocalEraseSnapshot(
      restarted.getSnapshot(),
      () => "2026-08-24T19:02:00.000Z",
      storage,
    );
    assert(readLocalEraseProgress(storage) === undefined);
    restarted.stop();
  },
);
