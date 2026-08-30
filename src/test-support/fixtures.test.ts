declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  createIdFactory,
  createNetworkFixture,
  createTestClock,
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
