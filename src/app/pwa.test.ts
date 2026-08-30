import {
  createBrowserUpdateInstallPort,
  isWithinRepositoryServiceWorkerScope,
  repositoryAssetPath,
  serviceWorkerRegistrationTarget,
} from "./pwa.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("offline PWA paths remain inside the repository service-worker scope", () => {
  const target = serviceWorkerRegistrationTarget();
  if (target.scriptUrl !== "/did-it-become-what-you-like/sw.js") {
    throw new Error("service worker script must use the repository base path");
  }
  if (target.scope !== "/did-it-become-what-you-like/") {
    throw new Error("service worker scope must use the repository base path");
  }
  if (
    repositoryAssetPath("assets/app.js") !==
      "/did-it-become-what-you-like/assets/app.js"
  ) {
    throw new Error("repository asset paths must remain scoped");
  }
  if (
    !isWithinRepositoryServiceWorkerScope(
      "/did-it-become-what-you-like/#/settings/about",
    )
  ) {
    throw new Error("hash routes should be service-worker scoped");
  }
  if (isWithinRepositoryServiceWorkerScope("/sibling-repository/app.js")) {
    throw new Error("service worker scope must not escape to a sibling path");
  }
});

Deno.test("unsafe asset paths are rejected", () => {
  let threw = 0;
  try {
    repositoryAssetPath("/root.js");
  } catch {
    threw += 1;
  }
  try {
    repositoryAssetPath("../root.js");
  } catch {
    threw += 1;
  }
  if (threw !== 2) {
    throw new Error("unsafe asset paths must be rejected");
  }
});

Deno.test("non-production browser update checks settle as unsupported and current", async () => {
  const port = createBrowserUpdateInstallPort();
  const result = await port.check();
  if (result.status !== "up-to-date") {
    throw new Error("unsupported development checks should be up-to-date");
  }
  if (port.state() !== "unsupported") {
    throw new Error(
      "unsupported development checks should expose capability state",
    );
  }
});
