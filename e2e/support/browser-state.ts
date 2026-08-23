import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export type IsolatedBrowserState = {
  artifactDirectory: string;
  storageState: { cookies: []; origins: [] };
};

export async function createIsolatedBrowserState(
  testName: string,
  artifactRoot = ".e2e-artifacts",
): Promise<IsolatedBrowserState> {
  const safeName = testName.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() ||
    "test";
  const artifactDirectory = join(artifactRoot, safeName);
  await mkdir(artifactDirectory, { recursive: true });
  return {
    artifactDirectory,
    storageState: { cookies: [], origins: [] },
  };
}
