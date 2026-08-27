/// <reference path="./deno.d.ts" />

import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  AGENT_BROWSER_VERSION,
  CHROME_FOR_TESTING_VERSION,
  platformDescription,
} from "./browser/metadata.ts";
import { installAgentBrowser } from "./browser/installer.ts";
import { redactText } from "../src/test-support/redaction.ts";

const ARTIFACT_ROOT = join(Deno.cwd(), ".agent-browser", "artifacts");
const PROFILE = join(Deno.cwd(), ".agent-browser", "profiles", "gallery");
const GALLERY_ROOT = join(Deno.cwd(), "dist-gallery");
const SESSION = "design-system-gallery";
const BASE_PATH = "/did-it-become-what-you-like/";
const VIEWPORTS = [
  [320, 568, "narrow"],
  [390, 844, "phone"],
  [1280, 800, "desktop"],
] as const;

type CommandResult = { code: number; output: string };

async function run(command: string, args: string[]): Promise<string> {
  const result = await new Deno.Command(command, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const output = redactText(
    new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  );
  if (result.code !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited ${result.code}: ${output}`,
    );
  }
  return output;
}

async function runAgent(
  installed: { agentBrowserPath: string; chromeExecutablePath: string },
  args: string[],
): Promise<CommandResult> {
  const output = await run(installed.agentBrowserPath, [
    "--native",
    "--session",
    SESSION,
    "--profile",
    PROFILE,
    "--executable-path",
    installed.chromeExecutablePath,
    "--json",
    ...args,
  ]);
  return { code: 0, output };
}

async function buildGallery(): Promise<void> {
  await run(Deno.execPath(), ["task", "gallery"]);
}

async function serveGallery(): Promise<{ url: string; close(): void }> {
  const controller = new AbortController();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, signal: controller.signal },
    async (request) => {
      const pathname = new URL(request.url).pathname;
      const path =
        (pathname.startsWith(BASE_PATH)
          ? pathname.slice(BASE_PATH.length)
          : pathname.replace(/^\/+/, "")) || "gallery.html";
      const safePath = path === "gallery.html" || path.startsWith("assets/")
        ? path
        : "gallery.html";
      try {
        const bytes = await readFile(join(GALLERY_ROOT, safePath));
        const contentType = safePath.endsWith(".html")
          ? "text/html"
          : safePath.endsWith(".css")
          ? "text/css"
          : safePath.endsWith(".js")
          ? "text/javascript"
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
    throw new Error("Gallery server did not bind TCP");
  }
  return {
    url: `http://127.0.0.1:${address.port}${BASE_PATH}gallery.html`,
    close: () => controller.abort(),
  };
}

function parseJsonResult(output: string): { violations?: unknown[] } {
  const line = output.trim().split("\n").at(-1);
  if (!line) throw new Error("agent-browser returned no JSON result");
  const result = JSON.parse(line) as { data?: unknown };
  const data = result.data;
  const nested = data && typeof data === "object" && "result" in data
    ? (data as { result: unknown }).result
    : data;
  const parsed = typeof nested === "string" ? JSON.parse(nested) : nested;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid axe result");
  }
  return parsed as { violations?: unknown[] };
}

async function main(): Promise<void> {
  await buildGallery();
  await mkdir(ARTIFACT_ROOT, { recursive: true });
  const installed = await installAgentBrowser();
  const server = await serveGallery();
  let opened = false;
  try {
    await runAgent(installed, ["open", server.url]);
    opened = true;
    for (const [width, height, name] of VIEWPORTS) {
      await runAgent(installed, [
        "set",
        "viewport",
        String(width),
        String(height),
      ]);
      const snapshot = await runAgent(installed, ["snapshot"]);
      if (
        !snapshot.output.toLowerCase().includes("shared design-system gallery")
      ) {
        throw new Error(`Gallery heading missing at ${name} viewport`);
      }
      const screenshot = join(ARTIFACT_ROOT, `design-system-${name}.png`);
      await runAgent(installed, ["screenshot", "--full", screenshot]);
      if (!(await isFile(screenshot))) {
        throw new Error(`Missing ${name} screenshot`);
      }
      await runAgent(installed, [
        "eval",
        "axe.run(document).then(r => { window.__galleryAxe = JSON.stringify(r) })",
      ]);
      await runAgent(installed, ["wait", "250"]);
      const axe = parseJsonResult(
        (await runAgent(installed, ["eval", "window.__galleryAxe"])).output,
      );
      if (!Array.isArray(axe.violations) || axe.violations.length !== 0) {
        throw new Error(
          `axe reported violations at ${name} viewport: ${
            JSON.stringify(axe.violations)
          }`,
        );
      }
      if (name === "phone") {
        await runAgent(installed, [
          "eval",
          "(() => { const trigger = Array.from(document.querySelectorAll('button')).find((node) => node.textContent?.trim() === 'Open menu'); if (!trigger) throw new Error('Gallery menu trigger is missing.'); trigger.scrollIntoView({ block: 'center', inline: 'nearest' }); const rect = trigger.getBoundingClientRect(); if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) throw new Error('Gallery menu trigger is not visible.'); trigger.click(); return true; })()",
        ]);
        await runAgent(installed, ["wait", "100"]);
        await runAgent(installed, [
          "eval",
          "(() => { const menu = document.querySelector('[role=\\\"menu\\\"]'); if (!menu) throw new Error('Gallery menu did not open.'); const rect = menu.getBoundingClientRect(); if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) throw new Error('Gallery menu is not visible.'); if (!menu.closest('main')) throw new Error('Gallery menu is outside the application landmark.'); return true; })()",
        ]);
        await runAgent(installed, [
          "eval",
          "axe.run(document).then(r => { window.__galleryMenuAxe = JSON.stringify(r) })",
        ]);
        await runAgent(installed, ["wait", "250"]);
        const menuAxe = parseJsonResult(
          (await runAgent(installed, ["eval", "window.__galleryMenuAxe"]))
            .output,
        );
        if (
          !Array.isArray(menuAxe.violations) || menuAxe.violations.length !== 0
        ) {
          throw new Error(
            `axe reported violations with the gallery menu open: ${
              JSON.stringify(menuAxe.violations)
            }`,
          );
        }
      }
    }
    console.log(
      `Design-system gallery passed native screenshot/tree/axe inspection for ${VIEWPORTS.length} viewports on agent-browser ${AGENT_BROWSER_VERSION} + Chrome ${CHROME_FOR_TESTING_VERSION} (${platformDescription()}).`,
    );
  } finally {
    if (opened) {
      try {
        await runAgent(installed, ["close"]);
      } catch (error) {
        console.error(redactText(`gallery close warning: ${String(error)}`));
      }
    }
    server.close();
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

try {
  await main();
} catch (error) {
  console.error(redactText(String(error)));
  console.error(
    `UNAVAILABLE/FAILED: gallery inspection could not complete on ${platformDescription()}; no success is reported.`,
  );
  Deno.exit(1);
}
