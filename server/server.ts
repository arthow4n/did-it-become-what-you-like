/// <reference lib="deno.unstable" />
/// <reference lib="deno.ns" />
import {
  decryptToken,
  type EncryptedData,
  encryptToken,
  hashSessionToken,
} from "./crypto.ts";

export type ServerEnv = {
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly allowedEmails: readonly string[];
  readonly encryptionSecret: string;
  readonly frontendOrigin: string;
  readonly serverOrigin?: string;
  readonly fetch?: typeof fetch;
};

export type SessionRecord = {
  readonly encryptedRefreshToken: EncryptedData;
  readonly email: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type OAuthStateRecord = {
  readonly returnTo: string;
  readonly createdAt: number;
};

const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export function parseCookies(
  cookieHeader: string | null,
): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name) {
      cookies[name] = decodeURIComponent(valueParts.join("="));
    }
  }
  return cookies;
}

export function isEmailAllowed(
  email: string,
  allowedEmails: readonly string[],
): boolean {
  if (allowedEmails.length === 0) return true;
  const normalized = email.trim().toLowerCase();
  return allowedEmails.some((allowed) =>
    allowed.trim().toLowerCase() === normalized
  );
}

export function parseAllowedOrigins(frontendOrigin: string): string[] {
  return frontendOrigin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => {
      if (o === "*") return "*";
      try {
        return new URL(o).origin;
      } catch {
        return o.replace(/\/+$/, "");
      }
    });
}

function corsHeaders(env: ServerEnv, req: Request): Headers {
  const headers = new Headers();
  const origin = req.headers.get("origin");
  const allowedOrigins = parseAllowedOrigins(env.frontendOrigin);

  let allowOrigin = "";
  if (allowedOrigins.includes("*")) {
    allowOrigin = origin ?? "*";
  } else if (origin) {
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed === origin) return true;
      try {
        return new URL(allowed).origin === new URL(origin).origin;
      } catch {
        return false;
      }
    });
    if (isAllowed) {
      allowOrigin = origin;
    }
  } else if (allowedOrigins.length > 0 && allowedOrigins[0] !== "*") {
    allowOrigin = allowedOrigins[0];
  }

  if (allowOrigin) {
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    if (allowOrigin !== "*") {
      headers.set("Access-Control-Allow-Credentials", "true");
    }
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie",
  );
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return headers;
}

export async function handleRequest(
  req: Request,
  kv: Deno.Kv,
  env: ServerEnv,
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const fetcher = env.fetch ?? globalThis.fetch;
  const serverOrigin = env.serverOrigin ?? url.origin;

  // Handle CORS Preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(env, req),
    });
  }

  // Health check
  if (path === "/" || path === "/health") {
    return new Response(
      JSON.stringify({ status: "ok", service: "google-drive-sync-auth" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...Object.fromEntries(corsHeaders(env, req)),
        },
      },
    );
  }

  // Step 1: Initiate OAuth Login
  if (path === "/auth/google-drive/login" && method === "GET") {
    const returnTo = url.searchParams.get("return_to") ?? env.frontendOrigin;
    const state = crypto.randomUUID();
    const stateRecord: OAuthStateRecord = {
      returnTo,
      createdAt: Date.now(),
    };
    await kv.set(["oauth_state", state], stateRecord, { expireIn: 600_000 }); // 10 mins

    const redirectUri = `${serverOrigin}/auth/google-drive/callback`;
    const googleAuthUrl = new URL(GOOGLE_AUTH_URL);
    googleAuthUrl.searchParams.set("client_id", env.googleClientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set(
      "scope",
      `${DRIVE_APPDATA_SCOPE} ${USERINFO_EMAIL_SCOPE}`,
    );
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "consent");
    googleAuthUrl.searchParams.set("state", state);

    return Response.redirect(googleAuthUrl.toString(), 302);
  }

  // Step 2: OAuth Callback
  if (path === "/auth/google-drive/callback" && method === "GET") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      return new Response(
        `Google authorization error: ${oauthError}`,
        { status: 400, headers: { "Content-Type": "text/plain" } },
      );
    }

    if (!code || !state) {
      return new Response("Missing code or state parameter", { status: 400 });
    }

    const stateEntry = await kv.get<OAuthStateRecord>(["oauth_state", state]);
    if (!stateEntry.value) {
      return new Response("Invalid or expired OAuth state parameter", {
        status: 400,
      });
    }
    await kv.delete(["oauth_state", state]);
    const returnTo = stateEntry.value.returnTo;

    // Exchange code for tokens
    const redirectUri = `${serverOrigin}/auth/google-drive/callback`;
    const tokenResponse = await fetcher(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return new Response(
        `Failed to exchange authorization code: ${errorText}`,
        { status: 502 },
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!refreshToken) {
      return new Response(
        "Google did not return a refresh token. Please revoke access in your Google Account and try again with prompt=consent.",
        { status: 400 },
      );
    }

    // Retrieve user email to verify against allow-list
    const userinfoResponse = await fetcher(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userinfoResponse.ok) {
      return new Response("Failed to fetch Google user profile", {
        status: 502,
      });
    }

    const userData = await userinfoResponse.json();
    const userEmail = userData.email;

    if (!userEmail) {
      return new Response("Unable to determine Google account email", {
        status: 400,
      });
    }

    // Verify Allow-List
    if (!isEmailAllowed(userEmail, env.allowedEmails)) {
      const errorUrl = new URL(returnTo);
      errorUrl.searchParams.set("sync_error", "unauthorized_account");
      errorUrl.searchParams.set("email", userEmail);
      return new Response(
        `<!DOCTYPE html>
<html>
<head><title>Access Denied</title><style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:500px;margin:auto;line-height:1.5;}</style></head>
<body>
  <h2>Access Denied</h2>
  <p>Google account <strong>${userEmail}</strong> is not authorized to use this sync server.</p>
  <p><a href="${returnTo}">Return to app</a></p>
</body>
</html>`,
        {
          status: 403,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    // Encrypt and save refresh token
    const encryptedRefreshToken = await encryptToken(
      refreshToken,
      env.encryptionSecret,
    );
    const sessionId = crypto.randomUUID();
    const sessionHash = await hashSessionToken(sessionId);
    const sessionRecord: SessionRecord = {
      encryptedRefreshToken,
      email: userEmail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Store session in Deno KV for 180 days
    await kv.set(["sessions", sessionHash], sessionRecord, {
      expireIn: 180 * 24 * 3600 * 1000,
    });

    const cookieValue =
      `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=15552000`;
    const redirectTarget = new URL(returnTo);
    redirectTarget.searchParams.set("sync_connected", "persisted");
    redirectTarget.searchParams.set("email", userEmail);

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTarget.toString(),
        "Set-Cookie": cookieValue,
      },
    });
  }

  // Step 3: Dispense fresh Google Drive Access Token
  if (path === "/api/google-drive-token" && method === "GET") {
    const cookies = parseCookies(req.headers.get("cookie"));
    const sessionId = cookies["session_id"];
    const headers = corsHeaders(env, req);
    headers.set("Content-Type", "application/json");

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          error: "unauthorized",
          message: "No active session cookie",
        }),
        { status: 401, headers },
      );
    }

    const sessionHash = await hashSessionToken(sessionId);
    const sessionEntry = await kv.get<SessionRecord>(["sessions", sessionHash]);
    if (!sessionEntry.value) {
      return new Response(
        JSON.stringify({
          error: "unauthorized",
          message: "Session expired or invalid",
        }),
        { status: 401, headers },
      );
    }

    let refreshToken: string;
    try {
      refreshToken = await decryptToken(
        sessionEntry.value.encryptedRefreshToken,
        env.encryptionSecret,
      );
    } catch {
      return new Response(
        JSON.stringify({
          error: "server_error",
          message: "Failed to decrypt token",
        }),
        { status: 500, headers },
      );
    }

    // Refresh the access token with Google
    const tokenResponse = await fetcher(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return new Response(
        JSON.stringify({ error: "upstream_error", message: errorText }),
        { status: 502, headers },
      );
    }

    const tokenData = await tokenResponse.json();
    return new Response(
      JSON.stringify({
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in ?? 3600,
        email: sessionEntry.value.email,
      }),
      { status: 200, headers },
    );
  }

  // Step 4: Logout / Revoke
  if (
    path === "/auth/google-drive/logout" &&
    (method === "POST" || method === "GET")
  ) {
    const cookies = parseCookies(req.headers.get("cookie"));
    const sessionId = cookies["session_id"];
    const headers = corsHeaders(env, req);
    headers.set("Content-Type", "application/json");

    if (sessionId) {
      const sessionHash = await hashSessionToken(sessionId);
      await kv.delete(["sessions", sessionHash]);
    }

    headers.append(
      "Set-Cookie",
      "session_id=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0",
    );

    return new Response(JSON.stringify({ status: "logged_out" }), {
      status: 200,
      headers,
    });
  }

  return new Response("Not Found", {
    status: 404,
    headers: corsHeaders(env, req),
  });
}
