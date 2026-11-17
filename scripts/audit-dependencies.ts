import { readFile } from "node:fs/promises";
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

type PackageLock = {
  packages: Record<string, { version?: string; name?: string }>;
};

export function dependencyVersions(lock: PackageLock) {
  const versions: Record<string, string[]> = Object.create(null);
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path) continue;
    const name = entry.name ??
      path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    if (!entry.version) {
      throw new Error(`Missing version in npm lock entry: ${path}`);
    }
    const known = versions[name] ??= [];
    if (!known.includes(entry.version)) known.push(entry.version);
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
      // Unpatched build-tool dependencies of vite-plugin-pwa -> workbox-build.
      // None of these packages enter the browser runtime bundle, and none process
      // attacker-controlled input at build time. Remove exceptions when upstream ships
      // patched releases.
      const isAcceptedDeepmerge = name === "deepmerge" &&
        versions[name]?.length === 1 && versions[name][0] === "4.3.1" &&
        advisory.severity === "low" &&
        advisory.url ===
          "https://github.com/advisories/GHSA-gcqx-w48m-w2h4";
      const isAcceptedGlob = name === "glob" &&
        versions[name]?.length === 1 && versions[name][0] === "11.1.0" &&
        advisory.severity === "moderate" &&
        advisory.url ===
          "https://github.com/advisories/GHSA-3g3m-2fjr-6pw4";
      const isAcceptedMinimatch = name === "minimatch" &&
        versions[name]?.length === 2 &&
        versions[name]?.includes("10.2.6") &&
        versions[name]?.includes("5.1.9") &&
        advisory.severity === "moderate" &&
        advisory.url ===
          "https://github.com/advisories/GHSA-g3hv-75wg-m249";
      // All callers use project-owned glob patterns during build and testing.
      const isAcceptedPicomatch = name === "picomatch" &&
        versions[name]?.length === 1 && versions[name][0] === "4.0.7" &&
        advisory.severity === "high" &&
        advisory.url === "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
      const acceptedBuildToolFinding = isAcceptedDeepmerge ||
        isAcceptedGlob ||
        isAcceptedMinimatch ||
        isAcceptedPicomatch;
      (acceptedBuildToolFinding ? accepted : blocked).push(message);
    }
  }
  return { blocked, accepted };
}

export async function auditDependencies(
  lock: PackageLock,
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
  const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
  const { blocked, accepted } = await auditDependencies(lock);
  for (const finding of accepted) {
    console.log(`Accepted build-tool exception: ${finding}`);
  }
  for (const finding of blocked) console.error(finding);
  if (blocked.length) {
    console.error(`Dependency audit failed: ${blocked.length} advisories.`);
    process.exit(1);
  }
  console.log("Dependency audit passed; no unaccepted advisories.");
}
