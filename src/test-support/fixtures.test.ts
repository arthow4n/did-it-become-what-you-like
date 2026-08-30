declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import { createTestClock, redactLogLine, redactValue } from "./index.ts";

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

Deno.test("deterministic clock is reproducible", async () => {
  const clock = createTestClock("2026-08-24T10:00:00.000Z");

  assertEquals(clock.nowIso(), "2026-08-24T10:00:00.000Z");
  await clock.sleep(1_000);
  assertEquals(clock.nowIso(), "2026-08-24T10:00:01.000Z");
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
