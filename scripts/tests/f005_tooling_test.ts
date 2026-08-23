/// <reference path="../deno.d.ts" />

import { join } from "node:path";
import {
  assertChecksum,
  downloadVerified,
  installAgentBrowser,
} from "../browser/installer.ts";
import {
  detectBrowserPlatform,
  PLATFORM_ARTIFACTS,
} from "../browser/metadata.ts";
import {
  INTENTIONAL_FAILURE_TRACE,
} from "../../e2e/support/intentional-failure.ts";

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejects(
  action: () => Promise<unknown>,
  message?: string,
): Promise<void> {
  let error: unknown;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }
  assert(error !== undefined, "Expected promise to reject");
  if (message) {
    assert(
      String(error).includes(message),
      `Expected rejection to include ${message}, got ${String(error)}`,
    );
  }
}

Deno.test("checksum failure aborts before an artifact is installed", async () => {
  const directory = await Deno.makeTempDir({ prefix: "f005-checksum-" });
  const destination = join(directory, "artifact");
  const bytes = new TextEncoder().encode("known fixture bytes");
  await assertRejects(() => assertChecksum(bytes, "0".repeat(64), "fixture"));
  await assertRejects(() =>
    downloadVerified(
      "https://fixture.invalid/artifact",
      "0".repeat(64),
      destination,
      () => Promise.resolve(new Response(bytes, { status: 200 })),
    )
  );
  try {
    await Deno.stat(destination);
    throw new Error("checksum failure must not leave an installed destination");
  } catch (error) {
    assert(error instanceof Deno.errors.NotFound);
  }
  await Deno.remove(directory, { recursive: true });
});

Deno.test("browser metadata maps only reviewed native platform pairs", () => {
  assertEquals(detectBrowserPlatform("linux", "x86_64"), "linux-x64");
  assertEquals(detectBrowserPlatform("linux", "aarch64"), undefined);
  assertEquals(detectBrowserPlatform("darwin", "aarch64"), "darwin-arm64");
  assertEquals(detectBrowserPlatform("windows", "aarch64"), undefined);
  assertEquals(Object.keys(PLATFORM_ARTIFACTS).length, 4);
  for (const artifact of Object.values(PLATFORM_ARTIFACTS)) {
    assert(/^[a-f0-9]{64}$/.test(artifact.agentBrowser.sha256));
    assert(/^[a-f0-9]{64}$/.test(artifact.chrome.sha256));
  }
  return assertRejects(
    () => installAgentBrowser("linux", "aarch64"),
    "UNAVAILABLE: no pinned agent-browser/Chrome for Testing pair for linux/aarch64",
  );
});

Deno.test("intentional E2E failure leaves a useful redacted trace and exits nonzero", async () => {
  try {
    await Deno.remove(INTENTIONAL_FAILURE_TRACE);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  const result = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "e2e/support/intentional-failure.ts"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.code !== 0, "intentional failure proof must exit nonzero");
  const trace = await Deno.readTextFile(INTENTIONAL_FAILURE_TRACE);
  assert(trace.includes("intentional-e2e-failure"));
  assert(trace.includes("[REDACTED]"));
  assert(!trace.includes("fixture-auth-value"));
  assert(!trace.includes("synthetic-api-key"));
  await Deno.remove(INTENTIONAL_FAILURE_TRACE);
});

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}
