import { createServerIdentityProvider } from "./server-identity.ts";
import { DRIVE_APP_DATA_SCOPE } from "./browser.ts";

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

Deno.test("server-identity: successful token request invokes callback", async () => {
  const mockFetch: typeof fetch = (input, init) => {
    assertEquals(
      input.toString(),
      "https://sync.example.com/api/google-drive-token",
    );
    assertEquals(init?.credentials, "include");
    return Promise.resolve(
      new Response(
        JSON.stringify({
          accessToken: "sample-access-token",
          expiresIn: 3600,
          email: "test@example.com",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  };

  const provider = createServerIdentityProvider({
    serverUrl: "https://sync.example.com/",
    fetch: mockFetch,
  });

  let successResult: unknown = null;
  const client = provider.initTokenClient({
    client_id: "test-client",
    scope: DRIVE_APP_DATA_SCOPE,
    callback: (res) => {
      successResult = res;
    },
  });

  client.requestAccessToken();

  // Wait for async fetch
  await new Promise((resolve) => setTimeout(resolve, 10));

  assertEquals(successResult, {
    access_token: "sample-access-token",
    expires_in: 3600,
    scope: DRIVE_APP_DATA_SCOPE,
    token_type: "Bearer",
  });
});

Deno.test("server-identity: unauthorized response invokes error_callback", async () => {
  const mockFetch: typeof fetch = () => {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          error: "unauthorized",
          message: "No active session cookie",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
  };

  const provider = createServerIdentityProvider({
    serverUrl: "https://sync.example.com",
    fetch: mockFetch,
  });

  let errorResult: unknown = null;
  const client = provider.initTokenClient({
    client_id: "test-client",
    scope: DRIVE_APP_DATA_SCOPE,
    callback: () => {},
    error_callback: (err) => {
      errorResult = err;
    },
  });

  client.requestAccessToken();

  await new Promise((resolve) => setTimeout(resolve, 10));

  assertEquals(errorResult, {
    error: "unauthorized",
    type: "No active session cookie",
  });
});

Deno.test("server-identity: revoke calls logout endpoint", async () => {
  let logoutCalled = false;
  const mockFetch: typeof fetch = (input, init) => {
    assertEquals(
      input.toString(),
      "https://sync.example.com/auth/google-drive/logout",
    );
    assertEquals(init?.method, "POST");
    assertEquals(init?.credentials, "include");
    logoutCalled = true;
    return Promise.resolve(
      new Response(JSON.stringify({ status: "logged_out" })),
    );
  };

  const provider = createServerIdentityProvider({
    serverUrl: "https://sync.example.com",
    fetch: mockFetch,
  });

  await provider.revoke("any-token");
  assertEquals(logoutCalled, true);
});

Deno.test("server-identity: forwards sessionToken as Bearer Authorization header", async () => {
  let authHeaderValue: string | undefined;
  const mockFetch: typeof fetch = (_input, init) => {
    const headers = init?.headers as Record<string, string> | undefined;
    authHeaderValue = headers?.["Authorization"];
    return Promise.resolve(
      new Response(
        JSON.stringify({
          accessToken: "sample-token",
          expiresIn: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  };

  const provider = createServerIdentityProvider({
    serverUrl: "https://sync.example.com",
    sessionToken: "my-session-uuid",
    fetch: mockFetch,
  });

  const client = provider.initTokenClient({
    client_id: "test-client",
    scope: DRIVE_APP_DATA_SCOPE,
    callback: () => {},
  });

  client.requestAccessToken();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assertEquals(authHeaderValue, "Bearer my-session-uuid");
});
