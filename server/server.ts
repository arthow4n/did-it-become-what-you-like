import {
  decryptToken,
  encryptToken,
  hashSessionToken,
  oauthChallenge,
  randomToken,
} from "./crypto.ts";
import type { SessionStore } from "./store.ts";

type ServerEnv = {
  FRONTEND_URL: string;
  SERVER_ORIGIN: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ALLOWED_GOOGLE_EMAILS?: string;
  ENCRYPTION_SECRET?: string;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const STATE_COOKIE = "__Host-drive_oauth";
const SESSION_COOKIE = "__Host-drive_session";
const SESSION_SECONDS = 180 * 24 * 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CORS_PATHS = new Map([
  ["/api/google-drive-token", "GET"],
  ["/auth/google-drive/session", "POST"],
  ["/auth/google-drive/logout", "POST"],
]);

function cookie(req: Request, name: string): string | undefined {
  const entry = req.headers.get("Cookie")?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  const value = entry?.slice(name.length + 1);
  return value && TOKEN_PATTERN.test(value) ? value : undefined;
}

function cookieHeader(
  name: string,
  value: string,
  maxAge: number,
  attributes: string,
): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; Max-Age=${maxAge}; ${attributes}`;
}

function allowEmail(email: string, allowlist: string): boolean {
  return allowlist.split(",").some((entry) =>
    entry.trim().toLowerCase() === email.trim().toLowerCase()
  );
}

function resolveReturnTo(value: string | null, frontend: URL): URL | undefined {
  if (!value) return new URL(frontend);
  try {
    const candidate = new URL(value);
    if (
      candidate.origin === frontend.origin &&
      (candidate.pathname === frontend.pathname ||
        candidate.pathname === `${frontend.pathname}index.html`) &&
      !candidate.username && !candidate.password
    ) {
      return candidate;
    }
  } catch {
    // Invalid return destinations never leave the Worker.
  }
}

function redirect(url: URL, headers: Headers, setCookie?: string): Response {
  headers.set("Location", url.href);
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(null, { status: 302, headers });
}

function callbackError(url: URL, error: string, headers: Headers): Response {
  url.searchParams.set("sync_error", error);
  return redirect(url, headers);
}

export async function handleRequest(
  req: Request,
  env: ServerEnv,
  store: SessionStore | undefined,
  fetcher = fetch,
): Promise<Response> {
  const url = new URL(req.url);
  const { pathname: path } = url;
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  const fail = (status: number, error: string, message: string) =>
    Response.json({ error, message }, { status, headers });

  try {
    const frontend = new URL(env.FRONTEND_URL);
    const origin = req.headers.get("Origin");
    const method = CORS_PATHS.get(path);
    if (origin === frontend.origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
    }

    if ((path === "/" || path === "/health") && req.method === "GET") {
      if (store) await store.ready();
      const oauthConfigured = Boolean(
        env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim() &&
          env.ALLOWED_GOOGLE_EMAILS?.split(",").some((email) => email.trim()) &&
          env.ENCRYPTION_SECRET && env.ENCRYPTION_SECRET.length >= 32,
      );
      return Response.json(
        {
          status: store ? "ok" : "preview",
          oauthConfigured: Boolean(
            store && env.SERVER_ORIGIN && oauthConfigured,
          ),
        },
        { headers },
      );
    }

    if (method) {
      if (origin !== frontend.origin) {
        return fail(403, "forbidden", "Origin is not allowed");
      }
      if (req.method === "OPTIONS") {
        headers.set("Access-Control-Allow-Methods", method);
        headers.set("Access-Control-Allow-Headers", "Content-Type");
        headers.set("Access-Control-Max-Age", "600");
        return new Response(null, { status: 204, headers });
      }
      if (req.method !== method) {
        return fail(405, "method_not_allowed", "Method not allowed");
      }
    } else if (
      req.method !== "GET" ||
      (path !== "/auth/google-drive/login" &&
        path !== "/auth/google-drive/callback")
    ) {
      return fail(404, "not_found", "Not found");
    }

    const clientId = env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
    const allowlist = env.ALLOWED_GOOGLE_EMAILS;
    const encryptionSecret = env.ENCRYPTION_SECRET;
    if (
      !store || !env.SERVER_ORIGIN || !clientId || !clientSecret ||
      !allowlist?.split(",").some((email) => email.trim()) ||
      !encryptionSecret || encryptionSecret.length < 32
    ) {
      return fail(503, "unavailable", "Google Drive sign-in is not configured");
    }
    if (url.origin !== new URL(env.SERVER_ORIGIN).origin) {
      return fail(404, "not_found", "Not found");
    }
    const redirectUri =
      new URL("/auth/google-drive/callback", env.SERVER_ORIGIN).href;

    if (path === "/auth/google-drive/login") {
      const returnTo = resolveReturnTo(
        url.searchParams.get("return_to"),
        frontend,
      );
      const challenge = url.searchParams.get("handoff_challenge");
      if (!returnTo || !challenge || !TOKEN_PATTERN.test(challenge)) {
        return fail(
          400,
          "invalid_request",
          "Invalid return destination or missing browser challenge",
        );
      }
      const state = randomToken();
      const browser = randomToken();
      const verifier = randomToken();
      await store.saveState(
        await hashSessionToken(state),
        await hashSessionToken(browser),
        {
          return_to: returnTo.href,
          pkce_verifier: verifier,
          handoff_challenge: challenge,
        },
        Date.now() + 600_000,
      );

      const google = new URL(GOOGLE_AUTH_URL);
      google.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope:
          "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email",
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: await oauthChallenge(verifier),
        code_challenge_method: "S256",
      }).toString();
      return redirect(
        google,
        headers,
        cookieHeader(STATE_COOKIE, browser, 600, "SameSite=Lax"),
      );
    }

    const requestGoogleToken = (params: Record<string, string>) =>
      fetcher(GOOGLE_TOKEN_URL, {
        method: "POST",
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          ...params,
        }),
        signal: AbortSignal.timeout(15_000),
      });

    if (path === "/auth/google-drive/callback") {
      const state = url.searchParams.get("state");
      const browser = cookie(req, STATE_COOKIE);
      if (!state || !TOKEN_PATTERN.test(state) || !browser) {
        return fail(
          400,
          "invalid_state",
          "Invalid or expired sign-in. Start again from the app.",
        );
      }
      const saved = await store.consumeState(
        await hashSessionToken(state),
        await hashSessionToken(browser),
        Date.now(),
      );
      if (!saved) {
        return fail(
          400,
          "invalid_state",
          "Invalid or expired sign-in. Start again from the app.",
        );
      }

      const target = new URL(saved.return_to);
      headers.append(
        "Set-Cookie",
        cookieHeader(STATE_COOKIE, "", 0, "SameSite=Lax"),
      );
      const code = url.searchParams.get("code");
      if (!code || url.searchParams.has("error")) {
        return callbackError(target, "authorization_failed", headers);
      }

      const token = await requestGoogleToken({
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: saved.pkce_verifier,
      }).catch(() => undefined);
      if (!token?.ok) {
        return callbackError(target, "token_exchange_failed", headers);
      }
      const credentials = await token.json<{
        access_token?: string;
        refresh_token?: string;
      }>().catch(() => null);
      if (!credentials?.access_token) {
        return callbackError(target, "token_exchange_failed", headers);
      }
      if (!credentials.refresh_token) {
        return callbackError(target, "missing_refresh_token", headers);
      }

      const profile = await fetcher(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${credentials.access_token}` },
        signal: AbortSignal.timeout(15_000),
      }).catch(() => undefined);
      if (!profile?.ok) {
        return callbackError(target, "profile_fetch_failed", headers);
      }
      const user = await profile.json<
        { email?: string; verified_email?: boolean }
      >()
        .catch(() => null);
      if (typeof user?.email !== "string" || user.verified_email !== true) {
        return callbackError(target, "profile_fetch_failed", headers);
      }
      if (!allowEmail(user.email, allowlist)) {
        return callbackError(target, "unauthorized_account", headers);
      }

      const ticket = randomToken();
      await store.saveHandoff(
        await hashSessionToken(ticket),
        saved.handoff_challenge,
        {
          ...await encryptToken(credentials.refresh_token, encryptionSecret),
          email: user.email,
        },
        Date.now() + 120_000,
      );

      target.searchParams.set("sync_connected", "persisted");
      target.hash += `|sync_handoff=${ticket}`;
      return redirect(target, headers);
    }

    if (path === "/auth/google-drive/session") {
      // Keep the handoff proof out of URLs and bound its size before reading.
      const json = req.headers.get("Content-Type")?.split(";")[0]?.trim() ===
        "application/json";
      const bytes = Number(req.headers.get("Content-Length"));
      if (!json || !Number.isInteger(bytes) || bytes < 1 || bytes > 256) {
        return fail(400, "invalid_request", "Invalid session handoff");
      }
      const proof = await req.json<{ ticket?: unknown; verifier?: unknown }>()
        .catch(() => null);
      if (
        typeof proof?.ticket !== "string" ||
        !TOKEN_PATTERN.test(proof.ticket) ||
        typeof proof.verifier !== "string" ||
        !TOKEN_PATTERN.test(proof.verifier)
      ) {
        return fail(400, "invalid_request", "Invalid session handoff");
      }
      const session = randomToken();
      const now = Date.now();
      const established = await store.establishSession(
        await hashSessionToken(proof.ticket),
        await oauthChallenge(proof.verifier),
        await hashSessionToken(session),
        now,
        now + SESSION_SECONDS * 1000,
      );
      if (!established) {
        return fail(
          401,
          "unauthorized",
          "Sign-in expired or already used. Reconnect to Google Drive.",
        );
      }
      headers.append(
        "Set-Cookie",
        cookieHeader(
          SESSION_COOKIE,
          session,
          SESSION_SECONDS,
          "SameSite=None; Partitioned",
        ),
      );
      return new Response(null, { status: 204, headers });
    }

    const session = cookie(req, SESSION_COOKIE);
    const sessionHash = session ? await hashSessionToken(session) : undefined;
    if (path === "/auth/google-drive/logout") {
      if (sessionHash) await store.deleteSession(sessionHash);
      headers.append(
        "Set-Cookie",
        cookieHeader(SESSION_COOKIE, "", 0, "SameSite=None; Partitioned"),
      );
      return Response.json({ status: "logged_out" }, { headers });
    }

    if (!sessionHash) {
      return fail(401, "unauthorized", "No active session cookie");
    }
    const saved = await store.getSession(sessionHash, Date.now());
    if (!saved || !allowEmail(saved.email, allowlist)) {
      return fail(401, "unauthorized", "Session expired or invalid");
    }
    const refreshToken = await decryptToken(saved, encryptionSecret);
    const token = await requestGoogleToken({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).catch(() => undefined);
    const data = await token?.json<{
      access_token?: string;
      expires_in?: number;
      error?: string;
    }>().catch(() => null);
    if (data?.error === "invalid_grant") {
      await store.deleteSession(sessionHash);
      return fail(
        401,
        "unauthorized",
        "Google authorization expired. Reconnect to Google Drive.",
      );
    }
    if (
      !token?.ok || typeof data?.access_token !== "string" || !data.access_token
    ) {
      return fail(502, "upstream_error", "Google Drive token refresh failed");
    }
    return Response.json(
      {
        accessToken: data.access_token,
        expiresIn: data.expires_in ?? 3600,
        email: saved.email,
      },
      { headers },
    );
  } catch {
    // Requests may include OAuth codes and cookies. Keep diagnostics out of responses and logs.
    return fail(500, "server_error", "Google Drive sync server request failed");
  }
}
