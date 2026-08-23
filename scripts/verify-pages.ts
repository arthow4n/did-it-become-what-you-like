/// <reference path="./deno.d.ts" />

import { hashRouteUrl } from "../src/app/routing.ts";
import { assertRestrictiveCsp } from "../spikes/browser-integrations/pwa.ts";
import {
  isWithinRepositoryServiceWorkerScope,
  serviceWorkerRegistrationTarget,
} from "../src/app/pwa.ts";

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

await runBuild();

const index = await read(`${DIST}/index.html`);
const sourceIndex = await read("index.html");
const manifest = JSON.parse(await read(`${DIST}/manifest.webmanifest`)) as {
  start_url?: string;
  scope?: string;
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
