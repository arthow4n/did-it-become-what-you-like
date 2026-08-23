/// <reference path="./env.d.ts" />

export const REPOSITORY_BASE_PATH = "/did-it-become-what-you-like/";

export type ServiceWorkerRegistrationTarget = {
  scriptUrl: string;
  scope: string;
};

export function repositoryAssetPath(
  asset: string,
  basePath = REPOSITORY_BASE_PATH,
): string {
  if (!basePath.startsWith("/") || !basePath.endsWith("/")) {
    throw new Error("The repository base path must begin and end with '/'.");
  }
  if (asset.startsWith("/") || asset.includes("..")) {
    throw new Error("Assets must be repository-relative paths.");
  }
  return `${basePath}${asset}`;
}

export function serviceWorkerRegistrationTarget(
  basePath = REPOSITORY_BASE_PATH,
): ServiceWorkerRegistrationTarget {
  return {
    scriptUrl: repositoryAssetPath("sw.js", basePath),
    scope: basePath,
  };
}

export function isWithinRepositoryServiceWorkerScope(
  requestPath: string,
  scope = REPOSITORY_BASE_PATH,
): boolean {
  return requestPath.startsWith(scope) &&
    (requestPath.length === scope.length ||
      requestPath.slice(scope.length - 1).startsWith("/"));
}

export function registerRepositoryServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in globalThis)) return;

  const base = new URL(import.meta.env.BASE_URL, globalThis.location.href);
  const target = serviceWorkerRegistrationTarget(base.pathname);
  void globalThis.navigator.serviceWorker.register(target.scriptUrl, {
    scope: target.scope,
  });
}
