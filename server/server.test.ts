/// <reference lib="deno.unstable" />
/// <reference lib="deno.ns" />

import { decryptToken, encryptToken, hashSessionToken } from "./crypto.ts";
import {
  handleRequest,
  isEmailAllowed,
  parseCookies,
  type ServerEnv,
} from "./server.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertNotEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    throw new Error(
      `Expected values to differ, but both were ${JSON.stringify(actual)}`,
    );
  }
}

async function assertRejects(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error("Expected function to reject, but it resolved");
}

Deno.test("crypto: encrypt and decrypt round trip", async () => {
  const secret = "test-secret-key-12345678901234567890";
  const plaintext = "refresh-token-value-xyz";

  const encrypted = await encryptToken(plaintext, secret);
  assertEquals(typeof encrypted.ciphertext, "string");
  assertEquals(typeof encrypted.iv, "string");

  const decrypted = await decryptToken(encrypted, secret);
  assertEquals(decrypted, plaintext);
});

Deno.test("crypto: encryption generates unique IVs", async () => {
  const secret = "test-secret-key-12345678901234567890";
  const plaintext = "same-token";

  const enc1 = await encryptToken(plaintext, secret);
  const enc2 = await encryptToken(plaintext, secret);

  assertNotEquals(enc1.iv, enc2.iv);
  assertNotEquals(enc1.ciphertext, enc2.ciphertext);
});

Deno.test("crypto: decrypt with wrong secret fails", async () => {
  const secret = "correct-secret-1234567890";
  const wrongSecret = "wrong-secret-0987654321";
  const plaintext = "secret-token";

  const encrypted = await encryptToken(plaintext, secret);
  await assertRejects(async () => {
    await decryptToken(encrypted, wrongSecret);
  });
});

Deno.test("crypto: hashSessionToken produces consistent SHA-256 hex string", async () => {
  const token = "session-id-12345";
  const hash1 = await hashSessionToken(token);
  const hash2 = await hashSessionToken(token);

  assertEquals(hash1, hash2);
  assertEquals(hash1.length, 64);
});

Deno.test("server: parseCookies", () => {
  assertEquals(parseCookies(null), {});
  assertEquals(parseCookies(""), {});
  assertEquals(parseCookies("session_id=abc; other=xyz"), {
    session_id: "abc",
    other: "xyz",
  });
});

Deno.test("server: isEmailAllowed", () => {
  // Empty allow-list allows all
  assertEquals(isEmailAllowed("user@example.com", []), true);

  // Non-empty allow-list enforces case-insensitive match
  const allowed = ["Owner@Example.com", "friend@test.org"];
  assertEquals(isEmailAllowed("owner@example.com", allowed), true);
  assertEquals(isEmailAllowed("OWNER@EXAMPLE.COM", allowed), true);
  assertEquals(isEmailAllowed("friend@test.org", allowed), true);
  assertEquals(isEmailAllowed("stranger@example.com", allowed), false);
});

Deno.test("server: health check returns ok", async () => {
  const kv = await Deno.openKv(":memory:");
  const env: ServerEnv = {
    googleClientId: "test-client-id",
    googleClientSecret: "test-client-secret",
    allowedEmails: [],
    encryptionSecret: "test-encryption-secret-32-chars",
    frontendOrigin: "https://example.com",
  };

  const req = new Request("https://sync.example.com/health");
  const res = await handleRequest(req, kv, env);

  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.status, "ok");
  assertEquals(
    res.headers.get("Access-Control-Allow-Origin"),
    "https://example.com",
  );
  assertEquals(res.headers.get("Access-Control-Allow-Credentials"), "true");
  await kv.close();
});

Deno.test("server: options preflight returns 204", async () => {
  const kv = await Deno.openKv(":memory:");
  const env: ServerEnv = {
    googleClientId: "test-client-id",
    googleClientSecret: "test-client-secret",
    allowedEmails: [],
    encryptionSecret: "test-encryption-secret",
    frontendOrigin: "https://example.com",
  };

  const req = new Request("https://sync.example.com/api/google-drive-token", {
    method: "OPTIONS",
  });
  const res = await handleRequest(req, kv, env);

  assertEquals(res.status, 204);
  assertEquals(
    res.headers.get("Access-Control-Allow-Origin"),
    "https://example.com",
  );
  await kv.close();
});

Deno.test("server: login redirects to google auth url and saves state", async () => {
  const kv = await Deno.openKv(":memory:");
  const env: ServerEnv = {
    googleClientId: "google-cid-123",
    googleClientSecret: "google-secret-456",
    allowedEmails: ["owner@example.com"],
    encryptionSecret: "test-encryption-secret",
    frontendOrigin: "https://example.com",
    serverOrigin: "https://sync.example.com",
  };

  const req = new Request(
    "https://sync.example.com/auth/google-drive/login?return_to=https://example.com/app",
  );
  const res = await handleRequest(req, kv, env);

  assertEquals(res.status, 302);
  const location = res.headers.get("Location");
  assertEquals(typeof location, "string");

  const targetUrl = new URL(location!);
  assertEquals(targetUrl.hostname, "accounts.google.com");
  assertEquals(targetUrl.searchParams.get("client_id"), "google-cid-123");
  assertEquals(
    targetUrl.searchParams.get("redirect_uri"),
    "https://sync.example.com/auth/google-drive/callback",
  );
  assertEquals(targetUrl.searchParams.get("access_type"), "offline");
  assertEquals(targetUrl.searchParams.get("prompt"), "consent");

  const state = targetUrl.searchParams.get("state");
  assertEquals(typeof state, "string");

  // Verify state is stored in kv
  const stored = await kv.get(["oauth_state", state!]);
  assertEquals(
    (stored.value as { returnTo: string }).returnTo,
    "https://example.com/app",
  );
  await kv.close();
});

Deno.test("server: callback handles unauthorized email with 403 Access Denied", async () => {
  const kv = await Deno.openKv(":memory:");
  const state = "test-state-123";
  await kv.set(["oauth_state", state], {
    returnTo: "https://example.com/app",
    createdAt: Date.now(),
  });

  const mockFetch: typeof fetch = (input) => {
    const url = input.toString();
    if (url === "https://oauth2.googleapis.com/token") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (url === "https://www.googleapis.com/oauth2/v2/userinfo") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            email: "unauthorized@stranger.com",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  };

  const env: ServerEnv = {
    googleClientId: "google-cid-123",
    googleClientSecret: "google-secret-456",
    allowedEmails: ["allowed@owner.com"],
    encryptionSecret: "test-encryption-secret-32-bytes",
    frontendOrigin: "https://example.com",
    serverOrigin: "https://sync.example.com",
    fetch: mockFetch,
  };

  const req = new Request(
    `https://sync.example.com/auth/google-drive/callback?code=mock-code&state=${state}`,
  );
  const res = await handleRequest(req, kv, env);

  assertEquals(res.status, 403);
  const body = await res.text();
  assertEquals(body.includes("Access Denied"), true);
  assertEquals(body.includes("unauthorized@stranger.com"), true);

  await kv.close();
});

Deno.test("server: callback success sets cookie and redirects to frontend", async () => {
  const kv = await Deno.openKv(":memory:");
  const state = "test-state-valid";
  await kv.set(["oauth_state", state], {
    returnTo: "https://example.com/app",
    createdAt: Date.now(),
  });

  const mockFetch: typeof fetch = (input) => {
    const url = input.toString();
    if (url === "https://oauth2.googleapis.com/token") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (url === "https://www.googleapis.com/oauth2/v2/userinfo") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            email: "allowed@owner.com",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  };

  const env: ServerEnv = {
    googleClientId: "google-cid-123",
    googleClientSecret: "google-secret-456",
    allowedEmails: ["allowed@owner.com"],
    encryptionSecret: "test-encryption-secret-32-bytes",
    frontendOrigin: "https://example.com",
    serverOrigin: "https://sync.example.com",
    fetch: mockFetch,
  };

  const req = new Request(
    `https://sync.example.com/auth/google-drive/callback?code=mock-code&state=${state}`,
  );
  const res = await handleRequest(req, kv, env);

  assertEquals(res.status, 302);
  const location = res.headers.get("Location");
  assertEquals(typeof location, "string");
  const locUrl = new URL(location!);
  assertEquals(locUrl.searchParams.get("sync_connected"), "persisted");
  assertEquals(locUrl.searchParams.get("email"), "allowed@owner.com");

  const setCookie = res.headers.get("Set-Cookie");
  assertEquals(typeof setCookie, "string");
  assertEquals(setCookie!.includes("session_id="), true);
  assertEquals(setCookie!.includes("HttpOnly"), true);
  assertEquals(setCookie!.includes("SameSite=None"), true);
  assertEquals(setCookie!.includes("Partitioned"), true);

  await kv.close();
});

Deno.test("server: api google-drive-token dispenses access token with valid session", async () => {
  const kv = await Deno.openKv(":memory:");
  const encryptionSecret = "test-encryption-secret-32-bytes";
  const sessionId = "valid-session-123";
  const sessionHash = await hashSessionToken(sessionId);
  const encryptedRefreshToken = await encryptToken(
    "saved-refresh-token",
    encryptionSecret,
  );

  await kv.set(["sessions", sessionHash], {
    encryptedRefreshToken,
    email: "owner@example.com",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const mockFetch: typeof fetch = (input, init) => {
    const url = input.toString();
    if (url === "https://oauth2.googleapis.com/token") {
      const body = init?.body?.toString() ?? "";
      if (body.includes("refresh_token=saved-refresh-token")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: "new-access-token-999",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  };

  const env: ServerEnv = {
    googleClientId: "google-cid-123",
    googleClientSecret: "google-secret-456",
    allowedEmails: ["owner@example.com"],
    encryptionSecret,
    frontendOrigin: "https://example.com",
    serverOrigin: "https://sync.example.com",
    fetch: mockFetch,
  };

  // Test 1: No cookie -> 401
  const noCookieReq = new Request(
    "https://sync.example.com/api/google-drive-token",
  );
  const noCookieRes = await handleRequest(noCookieReq, kv, env);
  assertEquals(noCookieRes.status, 401);

  // Test 2: Valid cookie -> 200 with access token
  const validReq = new Request(
    "https://sync.example.com/api/google-drive-token",
    {
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
    },
  );
  const validRes = await handleRequest(validReq, kv, env);
  assertEquals(validRes.status, 200);
  const tokenData = await validRes.json();
  assertEquals(tokenData.accessToken, "new-access-token-999");
  assertEquals(tokenData.email, "owner@example.com");

  // Test 3: Logout
  const logoutReq = new Request(
    "https://sync.example.com/auth/google-drive/logout",
    {
      method: "POST",
      headers: {
        Cookie: `session_id=${sessionId}`,
      },
    },
  );
  const logoutRes = await handleRequest(logoutReq, kv, env);
  assertEquals(logoutRes.status, 200);
  const logoutCookie = logoutRes.headers.get("Set-Cookie");
  assertEquals(logoutCookie!.includes("Max-Age=0"), true);

  // After logout, token request is 401
  const afterLogoutRes = await handleRequest(validReq, kv, env);
  assertEquals(afterLogoutRes.status, 401);

  await kv.close();
});
