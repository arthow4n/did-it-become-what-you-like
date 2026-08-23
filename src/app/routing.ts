export const REPOSITORY_BASE_PATH = "/did-it-become-what-you-like/";

export function routeFromHash(hash: string): string {
  if (hash === "" || hash === "#") return "/";

  const route = hash.startsWith("#") ? hash.slice(1) : hash;
  const normalized = route.startsWith("/") ? route : `/${route}`;
  return normalized.replace(/\/{2,}/g, "/");
}

export function hashForRoute(route: string): string {
  const normalized = route.startsWith("/") ? route : `/${route}`;
  return `#${normalized.replace(/\/{2,}/g, "/")}`;
}

export function hashRouteUrl(
  origin: string,
  route: string,
  basePath = REPOSITORY_BASE_PATH,
): string {
  if (!basePath.startsWith("/") || !basePath.endsWith("/")) {
    throw new Error("The repository base path must begin and end with '/'.");
  }

  const url = new URL(basePath, origin);
  url.hash = hashForRoute(route).slice(1);
  return url.toString();
}
