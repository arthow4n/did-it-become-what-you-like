/// <reference path="../deno.d.ts" />

import {
  hashForRoute,
  hashRouteUrl,
  routeFromHash,
} from "../../src/app/routing.ts";
import {
  isWithinRepositoryServiceWorkerScope,
  repositoryAssetPath,
  serviceWorkerRegistrationTarget,
} from "../../src/app/pwa.ts";

function assert(
  condition: unknown,
  message = "Expected condition to be true",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertThrows(action: () => unknown): void {
  let threw = false;
  try {
    action();
  } catch {
    threw = true;
  }
  assert(threw, "Expected action to throw");
}

Deno.test("hash routing survives a nested Pages refresh URL", () => {
  const url = hashRouteUrl(
    "https://owner.github.io",
    "/foundation/nested",
  );

  assertEquals(
    new URL(url).pathname,
    "/did-it-become-what-you-like/",
  );
  assertEquals(new URL(url).hash, "#/foundation/nested");
  assertEquals(routeFromHash(new URL(url).hash), "/foundation/nested");
  assertEquals(hashForRoute("foundation/nested"), "#/foundation/nested");
});

Deno.test("asset and service-worker paths stay inside the repository", () => {
  const target = serviceWorkerRegistrationTarget();

  assertEquals(target.scriptUrl, "/did-it-become-what-you-like/sw.js");
  assertEquals(target.scope, "/did-it-become-what-you-like/");
  assertEquals(
    repositoryAssetPath("icons/icon-192.svg"),
    "/did-it-become-what-you-like/icons/icon-192.svg",
  );
  assert(isWithinRepositoryServiceWorkerScope(
    "/did-it-become-what-you-like/assets/app.js",
  ));
  assert(!isWithinRepositoryServiceWorkerScope("/another-repository/app.js"));
  assert(
    !isWithinRepositoryServiceWorkerScope(
      "/did-it-become-what-you-like-other/app.js",
    ),
  );
});

Deno.test("unsafe asset paths are rejected", () => {
  assertThrows(() => repositoryAssetPath("/root.js"));
  assertThrows(() => repositoryAssetPath("../root.js"));
});
