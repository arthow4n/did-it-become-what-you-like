import {
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
