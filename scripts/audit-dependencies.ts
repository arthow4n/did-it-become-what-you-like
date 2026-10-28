/// <reference path="./deno.d.ts" />
import { z } from "zod";

const responseSchema = z.record(
  z.string(),
  z.array(z.object({
    url: z.url(),
    title: z.string(),
    severity: z.enum(["info", "low", "moderate", "high", "critical"]),
  })),
);

type AdvisoryResponse = z.infer<typeof responseSchema>;

export function dependencyVersions(lock: { npm: Record<string, unknown> }) {
  const versions: Record<string, string[]> = {};
  for (const key of Object.keys(lock.npm)) {
    const split = key.indexOf("@", 1);
    if (split <= 0) throw new Error(`Invalid npm lock entry: ${key}`);
    const name = key.slice(0, split);
    const version = key.slice(split + 1).split("_")[0];
    (versions[name] ??= []).push(version);
  }
  for (const name of Object.keys(versions)) {
    versions[name] = [...new Set(versions[name])];
  }
  return versions;
}

export function classifyAdvisories(
  versions: Record<string, string[]>,
  response: unknown,
) {
  const advisories: AdvisoryResponse = responseSchema.parse(response);
  const blocked: string[] = [];
  const accepted: string[] = [];
  for (const [name, findings] of Object.entries(advisories)) {
    for (const advisory of findings) {
      const message =
        `${name}: ${advisory.title} (${advisory.severity}) ${advisory.url}`;
      // No patched release exists. The sole consumer, @rollup/plugin-node-resolve,
      // calls deepMerge({}, defaults) with its own fixed literal at build time.
      // Remove this exception when upstream ships a patched release.
      const acceptedBuildToolFinding = name === "deepmerge" &&
        versions[name]?.length === 1 && versions[name][0] === "4.3.1" &&
        advisory.severity === "low" &&
        advisory.url ===
          "https://github.com/advisories/GHSA-gcqx-w48m-w2h4";
      (acceptedBuildToolFinding ? accepted : blocked).push(message);
    }
  }
  return { blocked, accepted };
}

export async function auditDependencies(
  lock: { npm: Record<string, unknown> },
  request: typeof fetch = fetch,
) {
  const versions = dependencyVersions(lock);
  const response = await request(
    "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(versions),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Dependency audit registry failed: HTTP ${response.status}`,
    );
  }
  return classifyAdvisories(versions, await response.json());
}

if (import.meta.main) {
  const lock = JSON.parse(await Deno.readTextFile("deno.lock"));
  const { blocked, accepted } = await auditDependencies(lock);
  for (const finding of accepted) {
    console.log(`Accepted build-tool exception: ${finding}`);
  }
  for (const finding of blocked) console.error(finding);
  if (blocked.length) {
    console.error(`Dependency audit failed: ${blocked.length} advisories.`);
    Deno.exit(1);
  }
  console.log("Dependency audit passed; no unaccepted advisories.");
}
