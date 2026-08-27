/// <reference path="./deno.d.ts" />

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AGENT_BROWSER_VERSION,
  CHROME_FOR_TESTING_VERSION,
  platformDescription,
} from "./browser/metadata.ts";
import { installAgentBrowser } from "./browser/installer.ts";
import { redactText } from "../src/test-support/redaction.ts";

const BASE_PATH = "/did-it-become-what-you-like/";
const DIST = join(Deno.cwd(), "dist");
const SESSION = "production-mantine-smoke";
const PROFILE = join(Deno.cwd(), ".agent-browser", "profiles", SESSION);

type InstalledBrowser = {
  readonly agentBrowserPath: string;
  readonly chromeExecutablePath: string;
};

async function runAgent(
  installed: InstalledBrowser,
  args: string[],
): Promise<string> {
  const result = await new Deno.Command(installed.agentBrowserPath, {
    args: [
      "--native",
      "--session",
      SESSION,
      "--profile",
      PROFILE,
      "--executable-path",
      installed.chromeExecutablePath,
      "--json",
      ...args,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const output = redactText(
    new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  );
  if (result.code !== 0) {
    throw new Error(
      `agent-browser ${args[0]} exited ${result.code}.\n${output}`,
    );
  }
  return output;
}

async function serveProduction(): Promise<{ url: string; close(): void }> {
  const controller = new AbortController();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, signal: controller.signal },
    async (request) => {
      const pathname = new URL(request.url).pathname;
      const relative = pathname.startsWith(BASE_PATH)
        ? pathname.slice(BASE_PATH.length)
        : "";
      const path = relative || "index.html";
      if (
        path.includes("..") ||
        !(path === "index.html" || path.startsWith("assets/") ||
          path.startsWith("icons/") || path === "manifest.webmanifest" ||
          path === "sw.js" || path.startsWith("workbox-"))
      ) {
        return new Response("Not found", { status: 404 });
      }
      try {
        const bytes = await readFile(join(DIST, path));
        const contentType = path.endsWith(".html")
          ? "text/html"
          : path.endsWith(".css")
          ? "text/css"
          : path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith(".svg")
          ? "image/svg+xml"
          : path.endsWith(".json") || path.endsWith(".webmanifest")
          ? "application/json"
          : "application/octet-stream";
        return new Response(new Uint8Array(bytes), {
          headers: { "content-type": contentType },
        });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  const address = server.addr;
  if (typeof address === "string") {
    throw new Error("Production server did not bind a TCP address.");
  }
  return {
    url: `http://127.0.0.1:${address.port}${BASE_PATH}`,
    close: () => controller.abort(),
  };
}

function parseJsonResult(output: string): unknown {
  const line = output.trim().split("\n").at(-1);
  if (!line) throw new Error("agent-browser returned no JSON result.");
  const result = JSON.parse(line) as { data?: unknown };
  const data = result.data;
  if (typeof data === "string") return JSON.parse(data);
  if (data && typeof data === "object" && "result" in data) {
    const value = (data as { result: unknown }).result;
    return typeof value === "string" ? JSON.parse(value) : value;
  }
  return data ?? result;
}

const installed = await installAgentBrowser();
const server = await serveProduction();
let opened = false;
try {
  await runAgent(installed, ["open", server.url]);
  opened = true;
  await runAgent(installed, ["wait", "750"]);
  const probe = parseJsonResult(
    await runAgent(installed, [
      "eval",
      "(() => { const root = document.documentElement; const button = document.querySelector('button.ds-button'); const styles = document.querySelectorAll('style[data-mantine-styles]').length; return { csp: document.querySelector('meta[http-equiv=Content-Security-Policy]')?.getAttribute('content') ?? '', styles, controlHeight: getComputedStyle(root).getPropertyValue('--mantine-control-height').trim(), buttonMinHeight: button ? getComputedStyle(button).minHeight : '' }; })()",
    ]),
  ) as {
    csp?: string;
    styles?: number;
    controlHeight?: string;
    buttonMinHeight?: string;
  };
  if (!probe.csp?.includes("style-src 'self' 'unsafe-inline'")) {
    throw new Error("Production CSP does not allow Mantine runtime styles.");
  }
  if ((probe.styles ?? 0) < 2 || !probe.controlHeight) {
    throw new Error(
      "Mantine runtime style blocks or semantic variables were not applied in production.",
    );
  }
  if (!probe.buttonMinHeight || probe.buttonMinHeight === "0px") {
    throw new Error("Production Mantine control styles were not applied.");
  }
  console.log(
    `Production Mantine browser smoke passed on agent-browser ${AGENT_BROWSER_VERSION} + Chrome ${CHROME_FOR_TESTING_VERSION} (${platformDescription()}).`,
  );
} finally {
  if (opened) {
    try {
      await runAgent(installed, ["close"]);
    } catch (error) {
      console.error(
        redactText(`production browser close warning: ${String(error)}`),
      );
    }
  }
  server.close();
}
