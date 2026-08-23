import { join } from "node:path";
import { writeRedactedTrace } from "./redacted-trace.ts";

export const INTENTIONAL_FAILURE_TRACE = join(
  ".e2e-artifacts",
  "intentional-failure",
  "trace.json",
);

export async function runIntentionalFailureProof(
  outputPath = INTENTIONAL_FAILURE_TRACE,
): Promise<never> {
  await writeRedactedTrace(outputPath, {
    kind: "intentional-e2e-failure",
    title: "Expected failure proof",
    url: "http://fake.test/did-it-become-what-you-like/#/fixture",
    request: {
      authorization: "fixture-auth-value",
      apiKey: "synthetic-api-key",
    },
    assertion: {
      expected: "fixture status ready",
      actual: "fixture status unavailable",
    },
    recovery: "Inspect the redacted trace and rerun the focused fixture.",
  });
  console.error(`Intentional E2E failure proof wrote ${outputPath}`);
  throw new Error("Intentional E2E failure proof (expected non-zero exit)");
}

if (import.meta.main) await runIntentionalFailureProof();
