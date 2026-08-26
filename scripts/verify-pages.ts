/// <reference path="./deno.d.ts" />

import { hashRouteUrl } from "../src/app/routing.ts";
import {
  isWithinRepositoryServiceWorkerScope,
  serviceWorkerRegistrationTarget,
} from "../src/app/pwa.ts";

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
  "style-src": ["'self'"],
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
  if (csp.includes("'unsafe-inline'") || csp.includes("'unsafe-eval'")) {
    throw new Error("CSP permits unsafe script execution");
  }
}

const BASE_PATH = "/did-it-become-what-you-like/";
const DIST = "dist";

function assert(
  condition: unknown,
  message = "Expected condition to be true",
): asserts condition {
  if (!condition) throw new Error(message);
}

async function read(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}

async function runBuild(): Promise<void> {
  const result = await new Deno.Command(Deno.execPath(), {
    args: ["task", "build"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (result.code !== 0) {
    const decoder = new TextDecoder();
    throw new Error(
      `Production build failed with exit ${result.code}.\n${
        decoder.decode(result.stdout)
      }${decoder.decode(result.stderr)}`,
    );
  }
}

async function assertFile(path: string): Promise<void> {
  try {
    await Deno.stat(path);
  } catch {
    throw new Error(`Expected production artifact: ${path}`);
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

if (!Deno.args.includes("--existing-artifact")) {
  await runBuild();
}

const index = await read(`${DIST}/index.html`);
const sourceIndex = await read("index.html");
const manifest = JSON.parse(await read(`${DIST}/manifest.webmanifest`)) as {
  start_url?: string;
  scope?: string;
  background_color?: string;
  theme_color?: string;
  icons?: Array<{ src?: string; sizes?: string; type?: string }>;
};
const serviceWorker = await read(`${DIST}/sw.js`);

await assertFile(`${DIST}/index.html`);
await assertFile(`${DIST}/manifest.webmanifest`);
await assertFile(`${DIST}/sw.js`);
await assertFile(`${DIST}/icons/icon-192.svg`);
await assertFile(`${DIST}/icons/icon-512.svg`);

assert(
  index.includes(`${BASE_PATH}assets/`),
  "index.html must resolve bundled assets under the repository base path",
);
assert(
  index.includes(`${BASE_PATH}manifest.webmanifest`),
  "index.html must resolve the manifest under the repository base path",
);
assert(
  !index.includes('src="/assets/'),
  "index.html must not contain an origin-root asset URL",
);
assertRestrictiveCsp(extractCsp(sourceIndex, "source index.html"));
assertRestrictiveCsp(extractCsp(index, "built dist/index.html"));
assert(
  manifest.start_url === BASE_PATH,
  "manifest start_url must be the repository base path",
);
assert(
  manifest.scope === BASE_PATH,
  "manifest scope must be the repository base path",
);
assert(
  manifest.background_color === "#101315",
  "manifest background_color must match the approved dark canvas",
);
assert(
  manifest.theme_color === "#101315",
  "manifest theme_color must match the approved dark canvas",
);
assert(
  manifest.icons?.length === 2,
  "manifest must contain both placeholder icons",
);
for (const icon of manifest.icons ?? []) {
  assert(
    icon.src?.startsWith(BASE_PATH),
    "manifest icon source must be repository-relative",
  );
  assert(icon.type === "image/svg+xml", "manifest icon type must be SVG");
}
assert(
  serviceWorker.includes("precacheAndRoute"),
  "production build must contain a generated service-worker skeleton",
);
assert(
  serviceWorker.includes(`${BASE_PATH}index.html`),
  "service-worker navigation fallback must remain inside the repository base path",
);

const target = serviceWorkerRegistrationTarget();
assert(
  target.scriptUrl === `${BASE_PATH}sw.js`,
  "service-worker script must use the repository base path",
);
assert(
  target.scope === BASE_PATH,
  "service-worker registration scope must be the repository base path",
);
assert(isWithinRepositoryServiceWorkerScope(
  `${BASE_PATH}assets/app.js`,
));
assert(!isWithinRepositoryServiceWorkerScope("/sibling-repository/app.js"));
assert(
  !isWithinRepositoryServiceWorkerScope(
    "/did-it-become-what-you-like-other/app.js",
  ),
);

const nestedUrl = hashRouteUrl(
  "https://owner.github.io",
  "/foundation/nested",
);
assert(
  new URL(nestedUrl).pathname === BASE_PATH,
  "nested hash route must refresh the repository index path",
);
assert(
  new URL(nestedUrl).hash === "#/foundation/nested",
  "nested hash route must remain in the URL fragment",
);

console.log("Pages foundation verification passed.");
