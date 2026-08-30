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
