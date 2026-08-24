export const REPOSITORY_BASE_PATH = "/did-it-become-what-you-like/";

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

function normalizeBasePath(basePath: string): string {
  if (!basePath.startsWith("/") || !basePath.endsWith("/")) {
    throw new Error("base path must begin and end with a slash");
  }
  return basePath;
}

export function assetPath(basePath: string, asset: string): string {
  const normalized = normalizeBasePath(basePath);
  if (asset.startsWith("/") || asset.includes("..")) {
    throw new Error("assets must be repository-relative paths");
  }
  return `${normalized}${asset}`;
}

export function hashRouteUrl(
  origin: string,
  basePath: string,
  route: string,
): string {
  const normalized = normalizeBasePath(basePath);
  if (
    !origin.startsWith("https://") && !origin.startsWith("http://localhost")
  ) {
    throw new Error("browser fixture origin is not an approved web origin");
  }
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  return `${origin}${normalized}#${normalizedRoute}`;
}

export function parseHashRoute(url: string, basePath: string): string {
  const parsed = new URL(url);
  const normalized = normalizeBasePath(basePath);
  if (parsed.pathname !== normalized) {
    throw new Error("hash route was loaded outside the repository base path");
  }
  return parsed.hash.length > 1 ? parsed.hash.slice(1) : "/";
}

export function serviceWorkerRegistration(basePath: string): {
  scriptUrl: string;
  scope: string;
} {
  const normalized = normalizeBasePath(basePath);
  return {
    scriptUrl: assetPath(normalized, "sw.js"),
    scope: normalized,
  };
}

export function isWithinServiceWorkerScope(
  url: string,
  scope: string,
): boolean {
  const resource = new URL(url);
  const scopeUrl = new URL(scope, resource.origin);
  if (resource.origin !== scopeUrl.origin) return false;
  return resource.pathname.startsWith(scopeUrl.pathname);
}

export function serviceWorkerShouldHandle(
  url: string,
  basePath: string,
): boolean {
  const parsed = new URL(url);
  if (parsed.origin !== "https://owner.github.io") return false;
  return isWithinServiceWorkerScope(url, `https://owner.github.io${basePath}`);
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
