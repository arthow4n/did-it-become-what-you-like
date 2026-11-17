import { afterAll, beforeAll, expect, test, vi } from "vitest";
import {
  decryptToken,
  encryptToken,
  hashSessionToken,
  oauthChallenge,
  randomToken,
} from "./crypto.ts";
import { handleRequest } from "./server.ts";
import type { SessionStore } from "./store.ts";
import { createTestDatabase } from "./test-database.ts";

const env = {
  FRONTEND_URL: "https://example.github.io/app/",
  SERVER_ORIGIN: "https://sync.example.workers.dev",
  GOOGLE_CLIENT_ID: "fixture-client",
  GOOGLE_CLIENT_SECRET: "fixture-secret",
  ALLOWED_GOOGLE_EMAILS: " Owner@example.test ",
  ENCRYPTION_SECRET: "fixture-encryption-key".repeat(3),
};
const origin = new URL(env.FRONTEND_URL).origin;
const tokenPath = "/api/google-drive-token";
const sessionPath = "/auth/google-drive/session";
const logoutPath = "/auth/google-drive/logout";
let dispose: () => Promise<void>;
let db: D1Database;
let store: SessionStore;

beforeAll(async () => {
  ({ db, store, dispose } = await createTestDatabase());
});

afterAll(async () => await dispose?.());

function request(path: string, init?: RequestInit, google?: typeof fetch) {
  return handleRequest(
    new Request(env.SERVER_ORIGIN + path, init),
    env,
    store,
    google,
  );
}

function firstCookie(response: Response): string {
  return response.headers.get("Set-Cookie")?.split(";")[0] ?? "";
}

async function start(
  verifier: string,
  returnTo = env.FRONTEND_URL + "#/settings",
) {
  return request(
    "/auth/google-drive/login?" + new URLSearchParams({
      return_to: returnTo,
      handoff_challenge: await oauthChallenge(verifier),
    }),
  );
}

function callback(state: string, browserCookie: string, google: typeof fetch) {
  return request(
    `/auth/google-drive/callback?state=${state}&code=fixture-code`,
    {
      headers: { Cookie: browserCookie },
    },
    google,
  );
}

function redeem(ticket: string, verifier: string, requestOrigin = origin) {
  const body = JSON.stringify({ ticket, verifier });
  return request(sessionPath, {
    method: "POST",
    headers: {
      Origin: requestOrigin,
      "Content-Type": "application/json",
      "Content-Length": String(body.length),
    },
    body,
  });
}

test("Google callback uses PKCE and browser state; the Drive session can be redeemed once, refreshed and logged out", async () => {
  const verifier = randomToken();
  const login = await start(verifier);
  expect(login.status).toBe(302);
  expect(login.headers.get("Set-Cookie")).toContain("SameSite=Lax");
  const googleAuth = new URL(login.headers.get("Location")!);
  expect(googleAuth.origin).toBe("https://accounts.google.com");
  expect(googleAuth.searchParams.get("code_challenge_method")).toBe("S256");
  const state = googleAuth.searchParams.get("state")!;
  const google = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com")) {
      const body = new URLSearchParams(String(init?.body));
      if (body.get("grant_type") === "authorization_code") {
        expect(await oauthChallenge(body.get("code_verifier")!)).toBe(
          googleAuth.searchParams.get("code_challenge"),
        );
        return Response.json({
          access_token: "fixture-access",
          refresh_token: "fixture-refresh",
        });
      }
      expect(body.get("refresh_token")).toBe("fixture-refresh");
      return Response.json({
        access_token: "fixture-refreshed",
        expires_in: 42,
      });
    }
    expect(url).toBe("https://www.googleapis.com/oauth2/v2/userinfo");
    return Response.json({ email: "owner@example.test", verified_email: true });
  });

  expect(
    (await callback(state, "__Host-drive_oauth=" + randomToken(), google))
      .status,
  ).toBe(400);
  expect(google).not.toHaveBeenCalled();
  const callbacks = await Promise.all([
    callback(state, firstCookie(login), google),
    callback(state, firstCookie(login), google),
  ]);
  expect(callbacks.map((response) => response.status).sort()).toEqual([
    302,
    400,
  ]);
  const accepted = callbacks.find((response) => response.status === 302)!;
  const target = new URL(accepted.headers.get("Location")!);
  expect(target.searchParams.get("sync_connected")).toBe("persisted");
  expect(target.searchParams.has("email")).toBe(false);
  expect(target.hash).toMatch(/^#\/settings\|sync_handoff=/);
  const ticket = target.hash.split("=").at(-1)!;

  expect((await redeem(ticket, verifier, "https://other.example")).status).toBe(
    403,
  );
  expect((await redeem(ticket, randomToken())).status).toBe(401);
  const redemptions = await Promise.all([
    redeem(ticket, verifier),
    redeem(ticket, verifier),
  ]);
  expect(redemptions.map((response) => response.status).sort()).toEqual([
    204,
    401,
  ]);
  const established = redemptions.find((response) => response.status === 204)!;
  expect(established.headers.get("Set-Cookie")).toMatch(
    /HttpOnly; Secure; .*SameSite=None; Partitioned/,
  );
  const Cookie = firstCookie(established);
  const sessionHash = await hashSessionToken(Cookie.split("=")[1]);
  const row = await store.getSession(sessionHash, Date.now());
  expect(row?.ciphertext).not.toContain("fixture-refresh");
  expect(await decryptToken(row!, env.ENCRYPTION_SECRET)).toBe(
    "fixture-refresh",
  );

  const response = await request(tokenPath, {
    headers: { Origin: origin, Cookie },
  }, google);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  expect(await response.json()).toEqual({
    accessToken: "fixture-refreshed",
    expiresIn: 42,
    email: "owner@example.test",
  });

  expect(
    (await request(logoutPath, { headers: { Origin: origin, Cookie } })).status,
  ).toBe(405);
  expect(
    (await request(logoutPath, { method: "POST", headers: { Cookie } })).status,
  ).toBe(403);
  const logout = await request(logoutPath, {
    method: "POST",
    headers: { Origin: origin, Cookie },
  });
  expect(logout.headers.get("Set-Cookie")).toMatch(
    /Max-Age=0; SameSite=None; Partitioned/,
  );
  expect(
    (await request(tokenPath, { headers: { Origin: origin, Cookie } })).status,
  ).toBe(401);
});

test("expiry takes effect before scheduled pruning and live rows survive cleanup", async () => {
  const now = Date.now();
  const state = {
    pkce_verifier: randomToken(),
    handoff_challenge: randomToken(),
    return_to: env.FRONTEND_URL,
  };
  const session = {
    ...await encryptToken("refresh", env.ENCRYPTION_SECRET),
    email: "owner@example.test",
  };
  const expired = randomToken();
  const live = randomToken();
  await store.saveState(expired, "browser", state, now);
  await store.saveState(live, "browser", state, now + 10_000);
  await store.saveHandoff(expired, "challenge", session, now);
  await store.saveHandoff(live, "challenge", session, now + 10_000);
  expect(await store.consumeState(expired, "browser", now)).toBeNull();
  expect(
    await store.establishSession(
      expired,
      "challenge",
      "unused",
      now,
      now + 100,
    ),
  ).toBe(false);

  const staleSession = randomToken();
  const staleTicket = randomToken();
  await store.saveHandoff(staleTicket, "challenge", session, now + 1);
  expect(
    await store.establishSession(
      staleTicket,
      "challenge",
      staleSession,
      now,
      now + 1,
    ),
  ).toBe(true);
  expect(await store.getSession(staleSession, now + 1)).toBeNull();

  await store.removeExpired(now + 1);
  for (
    const [table, key, value] of [
      ["oauth_states", "state_hash", expired],
      ["session_handoffs", "ticket_hash", expired],
      ["sessions", "session_hash", staleSession],
    ]
  ) {
    const found = await db.prepare(`SELECT 1 FROM ${table} WHERE ${key} = ?`)
      .bind(value).first();
    expect(found).toBeNull();
  }
  expect(await store.consumeState(live, "browser", now)).toEqual(state);
  expect(
    await store.establishSession(
      live,
      "challenge",
      randomToken(),
      now,
      now + 100,
    ),
  ).toBe(true);
});

test("redirects, CORS and upstream failures keep credentials off untrusted origins and out of responses", async () => {
  for (
    const target of [
      "https://untrusted.example/app/",
      "https://example.github.io/other/",
      "https://example.github.io/app/../../other/",
    ]
  ) {
    expect((await start(randomToken(), target)).status).toBe(400);
  }
  const blocked = await request(tokenPath, { headers: { Origin: "null" } });
  expect(blocked.status).toBe(403);
  expect(blocked.headers.has("Access-Control-Allow-Origin")).toBe(false);
  const preflight = await request(sessionPath, {
    method: "OPTIONS",
    headers: { Origin: origin },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("Access-Control-Allow-Methods")).toBe("POST");
  expect(
    (await request(tokenPath, {
      headers: { Origin: origin, Cookie: "__Host-drive_session=%ZZ" },
    })).status,
  ).toBe(401);

  for (
    const [google, expectedError] of [
      [
        vi.fn<typeof fetch>(async () =>
          new Response("private upstream body", { status: 400 })
        ),
        "token_exchange_failed",
      ],
      [
        vi.fn<typeof fetch>(async (url) =>
          String(url).includes("userinfo")
            ? Response.json({
              email: "UNLISTED@example.test",
              verified_email: true,
            })
            : Response.json({
              access_token: "access",
              refresh_token: "refresh",
            })
        ),
        "unauthorized_account",
      ],
      [
        vi.fn<typeof fetch>(async (url) =>
          String(url).includes("userinfo")
            ? Response.json({
              email: "owner@example.test",
              verified_email: false,
            })
            : Response.json({
              access_token: "access",
              refresh_token: "refresh",
            })
        ),
        "profile_fetch_failed",
      ],
    ] as const
  ) {
    const login = await start(randomToken());
    const state = new URL(login.headers.get("Location")!).searchParams.get(
      "state",
    )!;
    const response = await callback(state, firstCookie(login), google);
    expect(response.headers.get("Location")).toBe(
      env.FRONTEND_URL + `?sync_error=${expectedError}#/settings`,
    );
    expect(await response.text()).toBe("");
  }
});
