/// <reference path="../deno.d.ts" />

export const AGENT_BROWSER_VERSION = "0.16.2";
export const CHROME_FOR_TESTING_VERSION = "152.0.7977.54";

export type BrowserPlatform =
  | "linux-x64"
  | "linux-arm64"
  | "darwin-arm64"
  | "darwin-x64"
  | "win32-x64";

type BrowserArtifact = {
  fileName: string;
  url: string;
  sha256: string;
};

type ChromeArtifact = BrowserArtifact & {
  executable: string;
};

export const PLATFORM_ARTIFACTS: Record<BrowserPlatform, {
  agentBrowser: BrowserArtifact;
  chrome: ChromeArtifact;
}> = {
  "linux-x64": {
    agentBrowser: {
      fileName: "agent-browser-linux-x64",
      url:
        `https://github.com/vercel-labs/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/agent-browser-linux-x64`,
      sha256:
        "a9481c197c8eaa04f3f5cc947923309a4960bff1cc20843fb4cf68763b7b3012",
    },
    chrome: {
      fileName: "chrome-linux64.zip",
      url:
        `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_FOR_TESTING_VERSION}/linux64/chrome-linux64.zip`,
      sha256:
        "88af83664e1e5f79dc1c1378d0699b98dddd69690a748addf4ccbe322bfacedf",
      executable: "chrome-linux64/chrome",
    },
  },
  "linux-arm64": {
    agentBrowser: {
      fileName: "agent-browser-linux-arm64",
      url:
        `https://github.com/vercel-labs/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/agent-browser-linux-arm64`,
      sha256:
        "29cc76d96e9f02a699cec4d835855aa0bcb4739841cf8ad7dcdd013b6760481f",
    },
    chrome: {
      fileName: "chrome-linux64.zip",
      url:
        `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_FOR_TESTING_VERSION}/linux64/chrome-linux64.zip`,
      sha256:
        "88af83664e1e5f79dc1c1378d0699b98dddd69690a748addf4ccbe322bfacedf",
      executable: "chrome-linux64/chrome",
    },
  },
  "darwin-arm64": {
    agentBrowser: {
      fileName: "agent-browser-darwin-arm64",
      url:
        `https://github.com/vercel-labs/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/agent-browser-darwin-arm64`,
      sha256:
        "05b451d53672c5edda2b417b1bf97d2709c3e3df36533cbbddcd3f72f6b3f0ea",
    },
    chrome: {
      fileName: "chrome-mac-arm64.zip",
      url:
        `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_FOR_TESTING_VERSION}/mac-arm64/chrome-mac-arm64.zip`,
      sha256:
        "0c8741d580076b3a8add518ddbb674183992d005cdee37a4875948c9f2748d2a",
      executable:
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    },
  },
  "darwin-x64": {
    agentBrowser: {
      fileName: "agent-browser-darwin-x64",
      url:
        `https://github.com/vercel-labs/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/agent-browser-darwin-x64`,
      sha256:
        "5dc6daf2e457cadd6c7b42b922aa71dc3cc06378a04c808676793941c3841914",
    },
    chrome: {
      fileName: "chrome-mac-x64.zip",
      url:
        `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_FOR_TESTING_VERSION}/mac-x64/chrome-mac-x64.zip`,
      sha256:
        "4a025d87c48da55bae94a907c0da052512a7fdaeda6bb6bbd78085836a7dafbd",
      executable:
        "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    },
  },
  "win32-x64": {
    agentBrowser: {
      fileName: "agent-browser-win32-x64.exe",
      url:
        `https://github.com/vercel-labs/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/agent-browser-win32-x64.exe`,
      sha256:
        "895b30e86c12abb2ac4d620dc8a5464400a6f4c34c1fbb440c5e81b2f3c8223e",
    },
    chrome: {
      fileName: "chrome-win64.zip",
      url:
        `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_FOR_TESTING_VERSION}/win64/chrome-win64.zip`,
      sha256:
        "91850065e6b80bba0c752e17a150fe1b9e39bba51ed705640c1273f565950dda",
      executable: "chrome-win64/chrome.exe",
    },
  },
};

export function detectBrowserPlatform(
  os: string = Deno.build.os,
  arch: string = Deno.build.arch,
): BrowserPlatform | undefined {
  if (os === "linux" && arch === "x86_64") return "linux-x64";
  if (os === "linux" && arch === "aarch64") return "linux-arm64";
  if (os === "darwin" && arch === "aarch64") return "darwin-arm64";
  if (os === "darwin" && arch === "x86_64") return "darwin-x64";
  if (os === "windows" && arch === "x86_64") return "win32-x64";
  return undefined;
}

export function platformDescription(
  os = Deno.build.os,
  arch = Deno.build.arch,
): string {
  return `${os}/${arch}`;
}
