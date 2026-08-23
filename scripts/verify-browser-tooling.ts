/// <reference path="./deno.d.ts" />

import axe from "axe-core";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AGENT_BROWSER_VERSION,
  CHROME_FOR_TESTING_VERSION,
  platformDescription,
} from "./browser/metadata.ts";
import { installAgentBrowser } from "./browser/installer.ts";
import { redactText } from "../src/test-support/redaction.ts";

const session = "f005-visual-smoke";
const artifactRoot = join(Deno.cwd(), ".agent-browser");
const profile = join(artifactRoot, "profiles", session);
const screenshot = join(artifactRoot, "artifacts", "f005-smoke.png");
const tracePath = join(artifactRoot, "artifacts", "f005-smoke.json");

type CommandResult = { code: number; output: string };

const html = [
  "<!doctype html>",
  '<html lang="en">',
  '  <head><meta name="viewport" content="width=device-width"><title>F-005 visual smoke</title></head>',
  "  <body>",
  "    <main>",
  "      <h1>F-005 visual smoke</h1>",
  "      <p>Deterministic visual-tooling fixture.</p>",
  '      <button type="button">Fixture action</button>',
  "    </main>",
  "    <script>" + axe.source + "</script>",
  "  </body>",
  "</html>",
].join("\n");

async function runAgent(
  installed: { agentBrowserPath: string; chromeExecutablePath: string },
  args: string[],
): Promise<CommandResult> {
  const result = await new Deno.Command(installed.agentBrowserPath, {
    args: [
      "--native",
      "--session",
      session,
      "--profile",
      profile,
      "--executable-path",
      installed.chromeExecutablePath,
      "--json",
      ...args,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const decoder = new TextDecoder();
  const output = redactText(
    decoder.decode(result.stdout) + decoder.decode(result.stderr),
  );
  if (result.code !== 0) {
    throw new Error(
      "agent-browser " + args[0] + " exited " + result.code + ".\n" + output,
    );
  }
  return { code: result.code, output };
}

function parseJsonResult(output: string): unknown {
  const line = output.trim().split("\n").at(-1);
  if (!line) throw new Error("agent-browser returned no JSON result.");
  try {
    const result = JSON.parse(line) as { data?: unknown };
    const data = result.data;
    if (typeof data === "string") return JSON.parse(data);
    if (data && typeof data === "object" && "result" in data) {
      const value = (data as { result: unknown }).result;
      return typeof value === "string" ? JSON.parse(value) : value;
    }
    return data ?? result;
  } catch (error) {
    throw new Error(
      "Could not parse agent-browser JSON output: " + String(error) + "\n" +
        output,
    );
  }
}

async function serveFixture(): Promise<{ url: string; close(): void }> {
  const controller = new AbortController();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, signal: controller.signal },
    () => new Response(html, { headers: { "content-type": "text/html" } }),
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  const address = server.addr;
  if (typeof address === "string") {
    throw new Error("Visual fixture did not bind a TCP address.");
  }
  return {
    url: "http://127.0.0.1:" + address.port + "/",
    close: () => controller.abort(),
  };
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const installed = await installAgentBrowser();
  await mkdir(join(artifactRoot, "artifacts"), { recursive: true });
  const fixture = await serveFixture();
  let opened = false;
  try {
    await runAgent(installed, ["open", fixture.url]);
    opened = true;
    await runAgent(installed, ["screenshot", screenshot]);
    if (!(await isFile(screenshot))) {
      throw new Error("agent-browser did not create a screenshot artifact.");
    }
    const snapshot = await runAgent(installed, ["snapshot"]);
    if (!snapshot.output.toLowerCase().includes("f-005 visual smoke")) {
      throw new Error(
        "agent-browser accessibility snapshot omitted the fixture heading.",
      );
    }
    await runAgent(installed, [
      "eval",
      "axe.run(document).then(r => { window.__f005Axe = JSON.stringify(r) })",
    ]);
    await runAgent(installed, ["wait", "100"]);
    const axeResult = parseJsonResult(
      (await runAgent(installed, ["eval", "window.__f005Axe"])).output,
    ) as { violations?: unknown[] };
    if (!Array.isArray(axeResult.violations)) {
      throw new Error("axe result was not returned.");
    }
    if (axeResult.violations.length !== 0) {
      throw new Error(
        "axe reported " + axeResult.violations.length + " violation(s).",
      );
    }
    await writeFile(
      tracePath,
      JSON.stringify(
        {
          platform: platformDescription(),
          agentBrowser: AGENT_BROWSER_VERSION,
          chromeForTesting: CHROME_FOR_TESTING_VERSION,
          screenshot,
          accessibilityTree: "heading and main present",
          axeViolations: 0,
          command: "agent-browser screenshot + snapshot + axe eval",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "agent-browser visual, accessibility-tree, and axe smoke passed.",
    );
  } finally {
    if (opened) {
      try {
        await runAgent(installed, ["close"]);
      } catch (error) {
        console.error(
          redactText("agent-browser close warning: " + String(error)),
        );
      }
    }
    fixture.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(redactText(String(error)));
  console.error(
    "UNAVAILABLE/FAILED: platform " + platformDescription() +
      " could not complete the native browser smoke; no success is reported.",
  );
  Deno.exit(1);
}
