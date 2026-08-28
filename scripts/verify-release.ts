/// <reference path="./deno.d.ts" />

const BASE_PATH = "/did-it-become-what-you-like/";
const DIST = "dist";
const SOURCE_URL = "https://github.com/arthow4n/did-it-become-what-you-like";
const LICENSE_URL = `${SOURCE_URL}/blob/master/LICENSE`;
const NOTICES_URL = `${SOURCE_URL}/blob/master/THIRD_PARTY_NOTICES.md`;
const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/,
  /gh[pousr]_[0-9A-Za-z]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:client_secret|GEMINI_API_KEY|GOOGLE_APPLICATION_CREDENTIALS)\s*[:=]\s*["'][^"']+/i,
];

export const CSP_DIRECTIVES = {
  "base-uri": ["'none'"],
  "connect-src": [
    "'self'",
    "https://accounts.google.com",
    "https://www.googleapis.com",
    "https://generativelanguage.googleapis.com",
  ],
  "default-src": ["'self'"],
  "font-src": ["'self'"],
  "frame-src": ["https://accounts.google.com/gsi/"],
  "img-src": ["'self'", "blob:", "data:"],
  "manifest-src": ["'self'"],
  "object-src": ["'none'"],
  "script-src": [
    "'self'",
    "'wasm-unsafe-eval'",
    "https://accounts.google.com/gsi/client",
  ],
  // MantineProvider emits nonce-less runtime variable/class style blocks in
  // this static Pages deployment. Keep the allowance scoped to styles; the
  // script policy remains free of unsafe execution sources.
  "style-src": ["'self'", "'unsafe-inline'"],
  "worker-src": ["'self'"],
} as const;

export function contentSecurityPolicy(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}

export function assertRestrictiveCsp(csp: string): void {
  const expected = contentSecurityPolicy();
  if (csp !== expected) {
    throw new Error("CSP changed from the locked allowlist");
  }
  if (csp.includes("https:") && !csp.includes("https://accounts.google.com")) {
    throw new Error("CSP has an unreviewed broad HTTPS source");
  }
  const scriptDirective =
    csp.split(";").find((directive) =>
      directive.trimStart().startsWith("script-src")
    ) ?? "";
  if (
    scriptDirective.includes("'unsafe-inline'") ||
    scriptDirective.includes("'unsafe-eval'")
  ) {
    throw new Error("CSP permits unsafe script execution");
  }
}

function extractCsp(html: string, source: string): string {
  const metaTag = html.match(/<meta\b[^>]*>/gi)?.find((tag) =>
    /\bhttp-equiv=["']Content-Security-Policy["']/i.test(tag)
  );
  const csp = metaTag?.match(/\bcontent=(["'])(.*?)\1/i)?.[2];
  assert(csp, `${source} must contain a Content-Security-Policy meta tag`);
  return csp;
}

type ArtifactFile = {
  readonly path: string;
  readonly bytes: Uint8Array;
};

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

async function readText(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}

async function readBytes(path: string): Promise<Uint8Array> {
  return await Deno.readFile(path);
}

async function assertFile(path: string): Promise<void> {
  try {
    await Deno.stat(path);
  } catch {
    throw new Error(`Expected production artifact: ${path}`);
  }
}

async function gitCommit(): Promise<string> {
  const result = await new Deno.Command("git", {
    args: ["rev-parse", "--short", "HEAD"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.code === 0, "Unable to determine the reviewed Git commit.");
  const commit = new TextDecoder().decode(result.stdout).trim();
  assert(
    /^[0-9a-f]+$/.test(commit),
    "The reviewed Git commit must be a hexadecimal short hash.",
  );
  return commit;
}

function sourceConstant(source: string, name: string): string {
  const match = source.match(
    new RegExp(`\\b${name}\\s*=\\s*[\\"']([^\\"']+)[\\"']`),
  );
  assert(match?.[1], `src/app/build-info.ts must define ${name}.`);
  return match[1];
}

async function collectArtifacts(
  directory: string,
  prefix = "",
): Promise<ArtifactFile[]> {
  const files: ArtifactFile[] = [];
  for await (const entry of Deno.readDir(directory)) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory) {
      files.push(...await collectArtifacts(path, relative));
    } else if (entry.isFile) {
      files.push({ path: relative, bytes: await readBytes(path) });
    }
  }
  return files.sort((left, right) => left.path < right.path ? -1 : 1);
}

function text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  );
  return [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

const buildInfo = await readText("src/app/build-info.ts");
const version = sourceConstant(buildInfo, "APP_VERSION");
const commit = await gitCommit();
const sourceIndex = await readText("index.html");
const index = await readText(`${DIST}/index.html`);
const manifest = JSON.parse(await readText(`${DIST}/manifest.webmanifest`)) as {
  readonly start_url?: string;
  readonly scope?: string;
  readonly background_color?: string;
  readonly theme_color?: string;
  readonly icons?: readonly {
    readonly src?: string;
    readonly type?: string;
    readonly sizes?: string;
  }[];
};
const serviceWorker = await readText(`${DIST}/sw.js`);
const artifacts = await collectArtifacts(DIST);
const bundles = artifacts.filter((file) =>
  file.path.startsWith("assets/") && file.path.endsWith(".js")
);
const bundleText = bundles.map((file) => text(file.bytes)).join("\n");
const allText = artifacts.filter((file) => !file.path.endsWith(".wasm")).map((
  file,
) => text(file.bytes)).join("\n");

for (
  const path of [
    `${DIST}/index.html`,
    `${DIST}/manifest.webmanifest`,
    `${DIST}/sw.js`,
    `${DIST}/icons/icon-192.svg`,
    `${DIST}/icons/icon-512.svg`,
  ]
) {
  await assertFile(path);
}

assert(bundles.length > 0, "The production artifact must contain a JS bundle.");
assert(
  index.includes(`${BASE_PATH}assets/`),
  "The deployed index must resolve assets under the repository base path.",
);
assert(
  index.includes(`${BASE_PATH}manifest.webmanifest`),
  "The deployed index must resolve its manifest under the repository base path.",
);
assert(
  index.includes(
    '<script src="https://accounts.google.com/gsi/client" defer></script>',
  ),
  "The deployed index must load Google Identity Services before the app.",
);
assert(
  !index.includes('src="/assets/') && !index.includes('href="/assets/'),
  "The deployed index must not contain origin-root asset URLs.",
);

assertRestrictiveCsp(extractCsp(sourceIndex, "source index.html"));
assertRestrictiveCsp(extractCsp(index, "built dist/index.html"));

assert(
  manifest.start_url === BASE_PATH && manifest.scope === BASE_PATH,
  "The manifest start_url and scope must be the repository base path.",
);
assert(
  manifest.background_color === "#101315" && manifest.theme_color === "#101315",
  "The manifest colors must match the approved dark canvas.",
);
assert(
  manifest.icons?.length === 2 &&
    manifest.icons.every((icon) => icon.src?.startsWith(BASE_PATH)),
  "Manifest icons must be present and repository-relative.",
);
for (const icon of manifest.icons ?? []) {
  assert(icon.type === "image/svg+xml", "manifest icon type must be SVG");
}
assert(
  serviceWorker.includes("precacheAndRoute") &&
    serviceWorker.includes(`${BASE_PATH}index.html`) &&
    !serviceWorker.includes("/did-it-become-what-you-like-other/"),
  "The service worker must precache and navigate only within the repository path.",
);

for (
  const expected of [
    version,
    commit,
    SOURCE_URL,
    LICENSE_URL,
    NOTICES_URL,
    "MIT License",
    "This application is 100% vibe-coded using ChatGPT Codex and Google Antigravity.",
  ]
) {
  assert(
    bundleText.includes(expected),
    `The deployed bundle is missing release metadata or notice: ${expected}`,
  );
}

for (const pattern of SECRET_PATTERNS) {
  assert(
    !pattern.test(allText),
    "The production artifact contains a secret-like value.",
  );
}

await assertFile("LICENSE");
await assertFile("THIRD_PARTY_NOTICES.md");
assert(
  (await readText("README.md")).includes(
    "This application is 100% vibe-coded using ChatGPT Codex and Google Antigravity.",
  ),
  "README.md must retain the exact generative-AI disclosure.",
);
assert(
  (await readText("LICENSE")).includes("MIT License"),
  "LICENSE must be MIT.",
);
assert(
  (await readText("THIRD_PARTY_NOTICES.md")).includes("# Third-party notices"),
  "THIRD_PARTY_NOTICES.md must contain the third-party notice heading.",
);

const digestLines: string[] = [];
for (const file of artifacts) {
  digestLines.push(
    `${file.path}\t${file.bytes.byteLength} bytes\t${await sha256(file.bytes)}`,
  );
}

console.log(`Release artifact verified for ${SOURCE_URL}`);
console.log(`version=${version} commit=${commit} base_path=${BASE_PATH}`);
console.log("artifact_sha256:");
console.log(digestLines.join("\n"));
