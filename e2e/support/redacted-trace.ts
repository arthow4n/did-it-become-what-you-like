import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { redactValue } from "../../src/test-support/redaction.ts";

export async function writeRedactedTrace(
  path: string,
  trace: Record<string, unknown>,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const output = JSON.stringify(redactValue(trace), null, 2) + "\n";
  await writeFile(path, output, "utf8");
}
