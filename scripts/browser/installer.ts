/// <reference path="../deno.d.ts" />

import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  AGENT_BROWSER_VERSION,
  type BrowserPlatform,
  CHROME_FOR_TESTING_VERSION,
  detectBrowserPlatform,
  PLATFORM_ARTIFACTS,
  platformDescription,
} from "./metadata.ts";
import { extractZipArchive } from "./zip.ts";

export const AGENT_BROWSER_ROOT = ".agent-browser";
export const CHROME_ROOT = ".chrome-for-testing";

export type InstalledBrowser = {
  platform: BrowserPlatform;
  agentBrowserPath: string;
  chromeExecutablePath: string;
};

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export async function assertChecksum(
  bytes: Uint8Array,
  expectedSha256: string,
  artifactName: string,
): Promise<void> {
  const actual = await sha256Hex(bytes);
  if (actual !== expectedSha256.toLowerCase()) {
    throw new Error(
      `Checksum failure for ${artifactName}: expected ${expectedSha256}, got ${actual}. Installation aborted.`,
    );
  }
}

export async function downloadVerified(
  url: string,
  expectedSha256: string,
  destination: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Download failed for ${url}: HTTP ${response.status}.`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await assertChecksum(bytes, expectedSha256, url);
  const partial = `${destination}.partial`;
  await mkdir(dirname(destination), { recursive: true });
  try {
    await writeFile(partial, bytes);
    await rename(partial, destination);
  } finally {
    await removeIfExists(partial);
  }
}

async function removeIfExists(path: string): Promise<void> {
  try {
    await Deno.remove(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

export async function installAgentBrowser(
  os = Deno.build.os,
  arch = Deno.build.arch,
): Promise<InstalledBrowser> {
  const platform = detectBrowserPlatform(os, arch);
  if (!platform) {
    throw new Error(
      `UNAVAILABLE: no pinned agent-browser/Chrome for Testing pair for ${
        platformDescription(os, arch)
      }. Supported platforms: ${Object.keys(PLATFORM_ARTIFACTS).join(", ")}.`,
    );
  }
  const artifacts = PLATFORM_ARTIFACTS[platform];
  const agentDirectory = join(
    AGENT_BROWSER_ROOT,
    AGENT_BROWSER_VERSION,
    platform,
  );
  const chromeDirectory = join(
    CHROME_ROOT,
    CHROME_FOR_TESTING_VERSION,
    platform,
  );
  const agentBrowserPath = join(
    agentDirectory,
    artifacts.agentBrowser.fileName,
  );
  const chromeArchivePath = join(chromeDirectory, artifacts.chrome.fileName);
  const chromeExecutablePath = join(
    chromeDirectory,
    artifacts.chrome.executable,
  );

  if (await isFile(agentBrowserPath)) {
    await assertChecksum(
      new Uint8Array(await readFile(agentBrowserPath)),
      artifacts.agentBrowser.sha256,
      artifacts.agentBrowser.fileName,
    );
  } else {
    await downloadVerified(
      artifacts.agentBrowser.url,
      artifacts.agentBrowser.sha256,
      agentBrowserPath,
    );
    if (os !== "windows") await chmod(agentBrowserPath, 0o755);
  }
  if (await isFile(chromeArchivePath)) {
    await assertChecksum(
      new Uint8Array(await readFile(chromeArchivePath)),
      artifacts.chrome.sha256,
      artifacts.chrome.fileName,
    );
  } else {
    await downloadVerified(
      artifacts.chrome.url,
      artifacts.chrome.sha256,
      chromeArchivePath,
    );
  }
  if (!(await isFile(chromeExecutablePath))) {
    await extractZipArchive(
      new Uint8Array(await readFile(chromeArchivePath)),
      chromeDirectory,
    );
    if (os !== "windows") await chmod(chromeExecutablePath, 0o755);
  }

  if (
    !(await isFile(agentBrowserPath)) || !(await isFile(chromeExecutablePath))
  ) {
    throw new Error(
      "Pinned browser installation completed without both executables.",
    );
  }
  return { platform, agentBrowserPath, chromeExecutablePath };
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const installed = await installAgentBrowser();
  console.log(
    `Installed agent-browser ${AGENT_BROWSER_VERSION} and Chrome for Testing ${CHROME_FOR_TESTING_VERSION} for ${installed.platform}.`,
  );
  console.log(`agent-browser: ${installed.agentBrowserPath}`);
  console.log(`Chrome: ${installed.chromeExecutablePath}`);
}
