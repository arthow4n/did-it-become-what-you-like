import { hashForRoute, hashRouteUrl, routeFromHash } from "./routing.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

Deno.test("hash routing survives a nested Pages refresh URL", () => {
  const url = hashRouteUrl(
    "https://owner.github.io",
    "/settings/nested",
  );

  assertEquals(
    new URL(url).pathname,
    "/did-it-become-what-you-like/",
  );
  assertEquals(new URL(url).hash, "#/settings/nested");
  assertEquals(routeFromHash(new URL(url).hash), "/settings/nested");
  assertEquals(hashForRoute("settings/nested"), "#/settings/nested");
});
