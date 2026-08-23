declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  createFakeDrivePort,
  createFakeGeminiPort,
  createIdFactory,
  createNetworkFixture,
  createTestClock,
  FAKE_DRIVE_FILE,
  FAKE_GEMINI_REQUEST,
  redactLogLine,
  redactValue,
} from "./index.ts";

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

Deno.test("deterministic clock and IDs are reproducible", async () => {
  const clock = createTestClock("2026-08-24T10:00:00.000Z");
  const ids = createIdFactory("fixture");

  assertEquals(clock.nowIso(), "2026-08-24T10:00:00.000Z");
  assertEquals(ids.next("expense"), "fixture-expense-0001");
  await clock.sleep(1_000);
  assertEquals(clock.nowIso(), "2026-08-24T10:00:01.000Z");
  assertEquals(ids.peek("expense"), "fixture-expense-0002");
  assertEquals(ids.count(), 1);
});

Deno.test("network fixture records requests and exposes offline state", async () => {
  const network = createNetworkFixture();
  network.route(
    "https://fake.test/health",
    () => ({ status: 200, body: { ok: true } }),
  );

  assertEquals(
    await network.fetch("https://fake.test/health"),
    { status: 200, body: { ok: true } },
  );
  assertEquals(network.requests[0]?.id, "request-0001");
  network.setOnline(false);
  let failed = false;
  try {
    await network.fetch("https://fake.test/health");
  } catch {
    failed = true;
  }
  assert(failed, "offline requests must fail deterministically");
});

Deno.test("fake Drive port provides deterministic conditional writes", async () => {
  const clock = createTestClock("2026-08-24T10:00:00.000Z");
  const drive = createFakeDrivePort(clock, createIdFactory("drive"));

  const first = await drive.writeAppData(
    FAKE_DRIVE_FILE.name,
    FAKE_DRIVE_FILE.body,
  );
  assert(first.ok);
  if (!first.ok) return;
  assertEquals(first.file.etag, "drive-etag-0002");
  const rejected = await drive.writeAppData(
    FAKE_DRIVE_FILE.name,
    "stale",
    "wrong-etag",
  );
  assertEquals(rejected, { ok: false, reason: "precondition-failed" });
  const second = await drive.writeAppData(
    FAKE_DRIVE_FILE.name,
    '{"version":2}',
    first.file.etag,
  );
  assert(second.ok);
  assertEquals(drive.writes.length, 2);
});

Deno.test("fake Gemini port never records image bytes and rejects incompatible models", async () => {
  const gemini = createFakeGeminiPort();
  const result = await gemini.generateReceiptDraft(FAKE_GEMINI_REQUEST);

  assertEquals(result.lines[0]?.amount, "-10");
  assertEquals(gemini.requestCount, 1);
  assert(!("image" in (gemini.requestSummaries[0] ?? {})));
  assertEquals(
    await gemini.testConfiguration("gemini-test-needs-review"),
    { ok: false, reason: "model-capability-mismatch" },
  );
});

Deno.test("redaction removes credentials from traces and structured logs", () => {
  const secret = "test-secret-value";
  const redacted = redactValue(
    { apiKey: secret, message: `Bearer ${secret}` },
    [secret],
  );
  assertEquals(redacted, {
    apiKey: "[REDACTED]",
    message: "Bearer [REDACTED]",
  });
  const line = redactLogLine("request", { authorization: `Bearer ${secret}` }, [
    secret,
  ]);
  assert(
    !line.includes(secret),
    "redacted logs must not contain the supplied secret",
  );
  assert(line.includes("[REDACTED]"));
});
