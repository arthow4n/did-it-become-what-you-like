import { isAdapterError, SecretValue } from "../../adapters/ports/index.ts";
import {
  createFakeCausalSyncPort,
  createFakeClockPort,
  createFakeDrivePorts,
  createFakeGeminiPort,
  createFakeIdPort,
  createFakeImagePreparationPort,
  createFakeLocalPort,
  createFakeOnlineStatusPort,
  createFakeSecretStoragePort,
} from "./index.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function rejectsWithCode(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    assert(isAdapterError(error));
    assertEquals(error.code, code);
    return;
  }
  throw new Error(`Expected ${code} rejection`);
}

Deno.test("adapter-contract fakes are deterministic for clock, IDs, and local transactions", async () => {
  const run = async (): Promise<unknown> => {
    const clock = createFakeClockPort();
    const ids = createFakeIdPort("fixture");
    const local = createFakeLocalPort();
    await local.transaction("readwrite", async (transaction) => {
      await transaction.put("records", ids.next("expense"), { amount: "-10" });
    });
    clock.advance(1_000);
    return { now: clock.now(), entries: await local.query("records") };
  };
  assertEquals(await run(), await run());
});

Deno.test("adapter-contract fakes model offline, quota, corruption, partial transport, and conflicts", async () => {
  const local = createFakeLocalPort();
  local.setScenario({ offline: true });
  await rejectsWithCode(local.query("records"), "offline");
  local.setScenario({ offline: false, quota: true });
  await rejectsWithCode(local.query("records"), "quota");
  local.setScenario({ quota: false, corrupt: true });
  await rejectsWithCode(local.query("records"), "corrupt-data");

  const drive = createFakeDrivePorts();
  await drive.authorize();
  drive.setScenario({ partialTransport: true });
  await rejectsWithCode(drive.listAppData(), "partial-transport");
  drive.setScenario({ partialTransport: false, conflict: true });
  await rejectsWithCode(
    drive.writeAppData({ name: "dataset.json", body: "{}" }),
    "conflict",
  );

  const sync = createFakeCausalSyncPort();
  sync.setScenario({ conflict: true });
  const packet = await sync.exportPacket();
  const result = await sync.applyPacket(packet);
  assertEquals(result.conflicts.length, 1);
});

Deno.test("adapter-contract fakes honor AbortSignal during an in-flight Gemini request", async () => {
  const gemini = createFakeGeminiPort();
  gemini.pauseNext();
  const controller = new AbortController();
  const request = gemini.extractReceipt({
    modelId: "fake-gemini-compatible",
    image: {
      bytes: new Uint8Array([1, 2]),
      mimeType: "image/jpeg",
      width: 1,
      height: 1,
      metadataSanitized: true,
      preparationApplied: false,
    },
    schemaVersion: 1,
    instructionVersion: "receipt-v1",
    categories: [],
    locale: "sv-SE",
    currency: "SEK",
  }, { signal: controller.signal });
  controller.abort();
  await rejectsWithCode(request, "aborted");
  gemini.releasePaused();
});

Deno.test("adapter-contract fakes keep secret values and request traces redacted", async () => {
  const secret = SecretValue.from("AIza-test-secret-value");
  const storage = createFakeSecretStoragePort();
  await storage.set("gemini-api-key", secret);
  const loaded = await storage.get("gemini-api-key");
  assert(loaded);
  assertEquals(String(loaded), "[REDACTED]");
  assert(!JSON.stringify(storage.audit).includes(secret.reveal()));
  assert(!JSON.stringify({ secret }).includes(secret.reveal()));

  const drive = createFakeDrivePorts();
  await drive.authorize();
  await drive.writeAppData({ name: "dataset.json", body: secret.reveal() });
  assert(!JSON.stringify(drive.requests).includes(secret.reveal()));
});

Deno.test("adapter-contract image fake sanitizes metadata while preserving disabled preparation", async () => {
  const image = createFakeImagePreparationPort();
  const prepared = await image.prepare({
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/jpeg",
    width: 100,
    height: 80,
  }, { enabled: false });
  assertEquals(prepared.preparationApplied, false);
  assertEquals(prepared.metadataSanitized, true);
  assertEquals(image.calls, [{ enabled: false, byteLength: 3 }]);
});

Deno.test("adapter-contract online fake emits deterministic state transitions", () => {
  const online = createFakeOnlineStatusPort("offline");
  const states: string[] = [];
  const unsubscribe = online.subscribe((state) => states.push(state));
  online.set("online");
  unsubscribe();
  online.set("offline");
  assertEquals(states, ["online"]);
});
