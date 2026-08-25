import {
  adapterError,
  isAdapterError,
  type OperationOptions,
} from "../ports/index.ts";
import {
  createDriveAdapter,
  DRIVE_RETIREMENT_MARKER_NAME,
  type DriveAdapter,
  type DriveRetirementMarker,
} from "./adapter.ts";
import {
  DRIVE_APP_DATA_SCOPE,
  type DriveIdentityProvider,
  type DriveTokenClientConfig,
} from "./browser.ts";
import { createTestClock } from "../../test-support/clock.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(
  actual: T,
  expected: T,
  message = "Values differ",
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${
        JSON.stringify(actual)
      }`,
    );
  }
}

async function rejectsWithCode(
  operation: Promise<unknown>,
  code: string,
): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    assert(isAdapterError(error));
    assertEquals(error.code, code, "Adapter error code");
    return error;
  }
  throw new Error(`Expected adapter error ${code}`);
}

type SyntheticFile = {
  id: string;
  name: string;
  body: string;
  etag: string;
  modifiedTime: string;
};

type SyntheticCall = {
  readonly method: string;
  readonly path: string;
  readonly spaces?: string;
  readonly pageToken?: string;
  readonly fields?: string;
  readonly alt?: string;
  readonly ifMatch?: string;
  readonly hasBearerHeader: boolean;
  readonly parent?: string;
};

class SyntheticDriveEndpoint {
  readonly calls: SyntheticCall[] = [];
  private readonly files = new Map<string, SyntheticFile>();
  private aboutPermissionId: string | undefined;
  private nextId = 1;
  private revision = 1;
  private failures: Array<{ status: number; retryAfter?: string }> = [];
  private networkFailure = false;
  private malformedList = false;
  private partialResponse = false;
  private mutationFailure: number | undefined;

  failNext(status: number, retryAfter?: string): void {
    this.failures.push({
      status,
      ...(retryAfter === undefined ? {} : { retryAfter }),
    });
  }

  failNetwork(): void {
    this.networkFailure = true;
  }

  returnMalformedList(): void {
    this.malformedList = true;
  }

  returnPartialResponse(): void {
    this.partialResponse = true;
  }

  failAfterMutation(status = 503): void {
    this.mutationFailure = status;
  }

  setAboutPermissionId(permissionId: string): void {
    this.aboutPermissionId = permissionId;
  }

  seed(name: string, body: string): SyntheticFile {
    const file: SyntheticFile = {
      id: `file-${this.nextId++}`,
      name,
      body,
      etag: `"etag-${this.revision++}"`,
      modifiedTime: new Date(Date.UTC(2026, 7, 24, 12, 0, this.revision))
        .toISOString(),
    };
    this.files.set(file.id, file);
    return { ...file };
  }

  body(name: string): string | undefined {
    return [...this.files.values()].find((file) => file.name === name)?.body;
  }

  names(): string[] {
    return [...this.files.values()].map((file) => file.name).sort();
  }

  readonly fetch = async (
    input: string,
    init?: RequestInit,
  ): Promise<Response> => {
    await Promise.resolve();
    if (this.networkFailure) throw new TypeError("network unavailable");
    const requestUrl = new URL(input);
    const headers = new Headers(init?.headers);
    const path = requestUrl.pathname;
    const method = init?.method ?? "GET";
    const hasBearerHeader = (headers.get("authorization") ?? "")
      .startsWith("Bearer ");
    const pathParts = path.split("/").filter(Boolean);
    const fileId = pathParts.at(-1);
    const current = fileId === undefined ? undefined : this.files.get(fileId);
    const call: SyntheticCall = {
      method,
      path,
      hasBearerHeader,
      ...(requestUrl.searchParams.get("spaces") === null
        ? {}
        : { spaces: requestUrl.searchParams.get("spaces")! }),
      ...(requestUrl.searchParams.get("pageToken") === null
        ? {}
        : { pageToken: requestUrl.searchParams.get("pageToken")! }),
      ...(requestUrl.searchParams.get("fields") === null
        ? {}
        : { fields: requestUrl.searchParams.get("fields")! }),
      ...(requestUrl.searchParams.get("alt") === null
        ? {}
        : { alt: requestUrl.searchParams.get("alt")! }),
      ...(headers.get("if-match") === null
        ? {}
        : { ifMatch: headers.get("if-match")! }),
    };
    this.calls.push(call);

    if (
      (method === "POST" || method === "PATCH") &&
      requestUrl.searchParams.get("uploadType") === "multipart" &&
      !path.startsWith("/upload/drive/v3/")
    ) {
      return new Response("multipart upload endpoint required", {
        status: 400,
      });
    }

    const failure = this.failures.shift();
    if (failure !== undefined) {
      return new Response("provider response omitted", {
        status: failure.status,
        headers: failure.retryAfter === undefined
          ? undefined
          : { "retry-after": failure.retryAfter },
      });
    }
    if (path.endsWith("/about")) {
      return this.json({
        user: {
          emailAddress: "synthetic-owner@example.test",
          ...(this.aboutPermissionId === undefined
            ? {}
            : { permissionId: this.aboutPermissionId }),
        },
      });
    }
    if (path.endsWith("/files") && method === "GET") {
      if (this.malformedList) return new Response("not-json");
      const pageSize = Number(
        requestUrl.searchParams.get("pageSize") ?? "1000",
      );
      const offset = Number(requestUrl.searchParams.get("pageToken") ?? "0");
      const files = [...this.files.values()].slice(offset, offset + pageSize);
      const nextOffset = offset + files.length;
      return this.json({
        files: files.map((file) => this.metadata(file)),
        ...(nextOffset < this.files.size
          ? { nextPageToken: String(nextOffset) }
          : {}),
      }, `"list-${this.revision}"`);
    }
    if (path.endsWith("/files") && method === "POST") {
      const parsed = parseMultipart(init?.body, headers.get("content-type"));
      const parents = parsed.metadata.parents;
      if (
        !Array.isArray(parents) || parents.length !== 1 ||
        parents[0] !== "appDataFolder"
      ) {
        return new Response("ordinary parent rejected", { status: 403 });
      }
      const next: SyntheticFile = {
        id: `file-${this.nextId++}`,
        name: String(parsed.metadata.name),
        body: parsed.body,
        etag: `"etag-${this.revision++}"`,
        modifiedTime: new Date(
          Date.UTC(2026, 7, 24, 12, 0, this.revision),
        ).toISOString(),
      };
      this.files.set(next.id, next);
      const mutationFailure = this.mutationFailure;
      this.mutationFailure = undefined;
      if (mutationFailure !== undefined) {
        return new Response("response lost after mutation", {
          status: mutationFailure,
        });
      }
      return this.json(this.metadata(next));
    }
    if (current === undefined) {
      return new Response("missing", { status: 404 });
    }
    if (requestUrl.searchParams.get("alt") === "media" && method === "GET") {
      if (this.partialResponse) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          text: () => Promise.reject(new TypeError("partial response")),
        } as unknown as Response;
      }
      return new Response(current.body, {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }
    if (method === "GET") {
      return this.json(this.metadata(current));
    }
    if (method === "DELETE") {
      this.files.delete(current.id);
      const mutationFailure = this.mutationFailure;
      this.mutationFailure = undefined;
      if (mutationFailure !== undefined) {
        return new Response("response lost after mutation", {
          status: mutationFailure,
        });
      }
      return new Response(null, { status: 204 });
    }
    if (method === "PATCH") {
      const parsed = parseMultipart(init?.body, headers.get("content-type"));
      const next: SyntheticFile = {
        ...current,
        body: parsed.body,
        etag: `"etag-${this.revision++}"`,
        modifiedTime: new Date(Date.UTC(2026, 7, 24, 12, 0, this.revision))
          .toISOString(),
      };
      this.files.set(next.id, next);
      const mutationFailure = this.mutationFailure;
      this.mutationFailure = undefined;
      if (mutationFailure !== undefined) {
        return new Response("response lost after mutation", {
          status: mutationFailure,
        });
      }
      return this.json(this.metadata(next));
    }
    return new Response("unsupported", { status: 400 });
  };

  private metadata(file: SyntheticFile): Record<string, unknown> {
    return {
      id: file.id,
      name: file.name,
      mimeType: "application/json",
      modifiedTime: file.modifiedTime,
      version: file.etag,
    };
  }

  private json(value: unknown, etag?: string): Response {
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: {
        "content-type": "application/json",
        ...(etag === undefined ? {} : { ETag: etag }),
      },
    });
  }
}

function parseMultipart(
  rawBody: BodyInit | null | undefined,
  contentType: string | null,
): { metadata: Record<string, unknown>; body: string } {
  assert(typeof rawBody === "string", "Expected multipart body");
  const boundary = contentType?.match(/boundary="?([^";]+)"?/u)?.[1];
  assert(boundary !== undefined, "Expected multipart boundary");
  const firstHeaderEnd = rawBody.indexOf("\r\n\r\n");
  const firstPartEnd = rawBody.indexOf(`\r\n--${boundary}`, firstHeaderEnd + 4);
  const secondHeaderEnd = rawBody.indexOf("\r\n\r\n", firstPartEnd + 2);
  const bodyEnd = rawBody.lastIndexOf(`\r\n--${boundary}--`);
  assert(
    firstHeaderEnd > 0 && firstPartEnd > 0 && secondHeaderEnd > 0 &&
      bodyEnd > 0,
  );
  return {
    metadata: JSON.parse(
      rawBody.slice(firstHeaderEnd + 4, firstPartEnd),
    ) as Record<string, unknown>,
    body: rawBody.slice(secondHeaderEnd + 4, bodyEnd),
  };
}

class SyntheticIdentity implements DriveIdentityProvider {
  readonly configs: DriveTokenClientConfig[] = [];
  requestCount = 0;
  revokeCount = 0;
  cancel = false;
  readonly issuedToken = globalThis.crypto.randomUUID();

  initTokenClient(
    config: DriveTokenClientConfig,
  ): { requestAccessToken(): void } {
    this.configs.push(config);
    return {
      requestAccessToken: () => {
        this.requestCount += 1;
        if (this.cancel) {
          config.error_callback?.({ type: "user_cancel" });
          return;
        }
        config.callback({
          access_token: this.issuedToken,
          expires_in: 3600,
          scope: DRIVE_APP_DATA_SCOPE,
          token_type: "Bearer",
        });
      },
    };
  }

  revoke(_accessToken: string, _options?: OperationOptions): Promise<void> {
    this.revokeCount += 1;
    return Promise.resolve();
  }
}

function testClock() {
  const clock = createTestClock("2026-08-24T12:00:00.000Z");
  const delays: number[] = [];
  return {
    clock,
    delays,
    adapterClock: {
      now: clock.nowIso,
      delay: (milliseconds: number, options?: OperationOptions) => {
        if (options?.signal?.aborted) {
          return Promise.reject(adapterError("aborted", "test.delay"));
        }
        delays.push(milliseconds);
        return clock.sleep(milliseconds);
      },
    },
  };
}

function fixture(options: {
  readonly expectedAccountId?: string;
  readonly retirementMarker?: DriveRetirementMarker;
  readonly online?: boolean;
  readonly pageSize?: number;
} = {}): {
  readonly endpoint: SyntheticDriveEndpoint;
  readonly identity: SyntheticIdentity;
  readonly clock: ReturnType<typeof testClock>;
  readonly adapter: DriveAdapter;
  readonly setOnline: (value: boolean) => void;
} {
  const endpoint = new SyntheticDriveEndpoint();
  const identity = new SyntheticIdentity();
  const clock = testClock();
  let online = options.online ?? true;
  const adapter = createDriveAdapter({
    clientId: "synthetic-client",
    identity,
    fetch: endpoint.fetch,
    clock: clock.adapterClock,
    isOnline: () => online,
    pageSize: options.pageSize ?? 2,
    ...(options.expectedAccountId === undefined
      ? {}
      : { expectedAccountId: options.expectedAccountId }),
    ...(options.retirementMarker === undefined
      ? {}
      : { retirementMarker: options.retirementMarker }),
  });
  return {
    endpoint,
    identity,
    clock,
    adapter,
    setOnline: (value) => online = value,
  };
}

async function authorized(
  adapter: DriveAdapter,
): Promise<void> {
  const session = await adapter.authorize();
  assertEquals(session.scopes, ["appDataFolder"]);
}

Deno.test("drive-adapter: authorization is least-scope, one-account, and revocable", async () => {
  const { adapter, identity, endpoint } = fixture();
  const session = await adapter.authorize();
  assertEquals(session.accountId, "synthetic-owner@example.test");
  assertEquals(session.scopes, ["appDataFolder"]);
  assertEquals(identity.configs[0]?.scope, DRIVE_APP_DATA_SCOPE);
  assertEquals(identity.configs[0]?.client_id, "synthetic-client");
  assertEquals(identity.requestCount, 1);
  assertEquals(endpoint.calls[0]?.path.endsWith("/about"), true);
  assertEquals(endpoint.calls[0]?.hasBearerHeader, true);
  assert(!JSON.stringify(session).includes(identity.issuedToken));
  await adapter.authorize();
  assertEquals(identity.requestCount, 1, "authorized state is idempotent");
  await adapter.disconnect();
  assertEquals(identity.revokeCount, 1);
  assertEquals(adapter.status(), "signed-out");
});

Deno.test("drive-adapter: permission ID remains the account-binding identity", async () => {
  const { adapter, endpoint } = fixture();
  endpoint.setAboutPermissionId("stable-drive-permission-id");
  const session = await adapter.authorize();
  assertEquals(session.accountId, "stable-drive-permission-id");
});

Deno.test(
  "drive-adapter: reconnect uses an email hint and empty GIS prompt without persisting a token",
  async () => {
    const { adapter, identity } = fixture();
    await authorized(adapter);
    await adapter.disconnect();

    await adapter.authorize({
      loginHint: "synthetic-owner@example.test",
      prompt: "",
    });
    assertEquals(
      identity.configs[1]?.login_hint,
      "synthetic-owner@example.test",
    );
    assertEquals(identity.configs[1]?.prompt, "");
    assert(!JSON.stringify(identity.configs).includes(identity.issuedToken));

    await adapter.disconnect();
    await adapter.authorize({
      loginHint: "opaque-drive-permission-id",
      prompt: "",
    });
    assertEquals(identity.configs[2]?.login_hint, undefined);
    assertEquals(identity.configs[2]?.prompt, "");
  },
);

Deno.test("drive-adapter: cancellation and account mismatch never install a token", async () => {
  const cancelled = fixture();
  cancelled.identity.cancel = true;
  await rejectsWithCode(cancelled.adapter.authorize(), "aborted");
  assertEquals(cancelled.adapter.status(), "signed-out");

  const mismatch = fixture({ expectedAccountId: "different-account" });
  const error = await rejectsWithCode(mismatch.adapter.authorize(), "conflict");
  assert(!String(error).includes(mismatch.identity.issuedToken));
  assertEquals(mismatch.identity.revokeCount, 1);
  assertEquals(mismatch.adapter.status(), "signed-out");
});

Deno.test("drive-adapter: token expiry requires a new user authorization", async () => {
  const { adapter, clock, identity } = fixture();
  await authorized(adapter);
  clock.clock.advance(3_600_001);
  await rejectsWithCode(adapter.readAppData("missing.json"), "unauthorized");
  assertEquals(adapter.status(), "signed-out");
  assertEquals(identity.requestCount, 1);
});

Deno.test("drive-adapter: app-data pagination, body reads, and path isolation are enforced", async () => {
  const { adapter, endpoint } = fixture({ pageSize: 2 });
  endpoint.seed("one.json", '{"one":1}');
  endpoint.seed("two.json", '{"two":2}');
  endpoint.seed("three.json", '{"three":3}');
  await authorized(adapter);
  const files = await adapter.listAppData();
  assertEquals(files.map((file) => file.name), [
    "one.json",
    "two.json",
    "three.json",
  ]);
  assertEquals(
    endpoint.calls.filter((call) => call.path.endsWith("/files")).length,
    2,
  );
  assert(endpoint.calls.every((call) => call.hasBearerHeader));
  assert(
    endpoint.calls.filter((call) => call.path.endsWith("/files")).every((
      call,
    ) => call.spaces === "appDataFolder"),
  );
  await rejectsWithCode(
    adapter.readAppData("../outside.json"),
    "invalid-request",
  );
  await rejectsWithCode(
    adapter.writeAppData({ name: "folder/file.json", body: "{}" }),
    "invalid-request",
  );
});

Deno.test(
  "drive-adapter: v3 projections use version tokens without ETag headers",
  async () => {
    const { adapter, endpoint } = fixture({ pageSize: 2 });
    const seeded = endpoint.seed("sync.json", '{"v":0}');
    await authorized(adapter);

    const listed = await adapter.readAppData("sync.json");
    assertEquals(listed?.etag, seeded.etag);

    const created = await adapter.writeAppData({
      name: "conditional.json",
      body: '{"v":1}',
    });
    const updated = await adapter.writeAppData({
      name: "conditional.json",
      body: '{"v":2}',
      expectedEtag: created.etag,
    });
    await rejectsWithCode(
      adapter.writeAppData({
        name: "conditional.json",
        body: "stale",
        expectedEtag: created.etag,
      }),
      "conflict",
    );
    await adapter.deleteAppData("conditional.json", updated.etag);

    const fieldSelections = endpoint.calls
      .map((call) => call.fields)
      .filter((fields): fields is string => fields !== undefined);
    assert(fieldSelections.length > 0);
    assert(
      fieldSelections.every((fields) => !fields.includes("etag")),
      "Drive v3 field selections must not request the removed etag field",
    );
    assert(
      endpoint.calls.some((call) =>
        (call.method === "POST" || call.method === "PATCH") &&
        call.fields === "id,name,mimeType,modifiedTime,version"
      ),
      "mutation projections must remain v3-valid",
    );
    assert(
      endpoint.calls.some((call) =>
        call.method === "PATCH" &&
        call.path.startsWith("/upload/drive/v3/files/") &&
        call.ifMatch === undefined
      ),
      "updates must use the upload URI without an unreadable ETag header",
    );
    assert(
      endpoint.calls.some((call) =>
        call.method === "DELETE" &&
        call.ifMatch === undefined
      ),
      "deletes must not depend on an unreadable ETag header",
    );
  },
);

Deno.test(
  "drive-adapter: first local sync uploads through the v3 upload endpoint and retries transient failures",
  async () => {
    const { adapter, endpoint } = fixture();
    await authorized(adapter);
    assertEquals(await adapter.listAppData(), []);

    endpoint.failNext(503);
    const created = await adapter.writeAppData({
      name: "local-expense-sync.json",
      body: '{"expenses":[{"id":"expense-1"}]}',
    });

    assertEquals(
      (await adapter.readAppData("local-expense-sync.json"))?.body,
      created.body,
    );
    assert(
      endpoint.calls.some((call) =>
        call.method === "POST" &&
        call.path === "/upload/drive/v3/files" &&
        call.fields === "id,name,mimeType,modifiedTime,version"
      ),
      "multipart create must use the Drive v3 upload URI",
    );
    assert(
      endpoint.calls.every((call) =>
        call.method !== "POST" || call.path !== "/drive/v3/files"
      ),
      "multipart create must not use the metadata-only URI",
    );
  },
);

Deno.test("drive-adapter: writes and deletes reject stale version tokens", async () => {
  const { adapter } = fixture();
  await authorized(adapter);
  const first = await adapter.writeAppData({
    name: "sync.json",
    body: '{"v":1}',
  });
  const second = await adapter.writeAppData({
    name: "sync.json",
    body: '{"v":2}',
    expectedEtag: first.etag,
  });
  assertEquals((await adapter.readAppData("sync.json"))?.body, '{"v":2}');
  await rejectsWithCode(
    adapter.writeAppData({
      name: "sync.json",
      body: "stale",
      expectedEtag: first.etag,
    }),
    "conflict",
  );
  await rejectsWithCode(
    adapter.deleteAppData("sync.json", first.etag),
    "conflict",
  );
  await adapter.deleteAppData("sync.json", second.etag);
  assertEquals(await adapter.readAppData("sync.json"), undefined);
  await rejectsWithCode(adapter.deleteAppData("sync.json"), "not-found");
});

Deno.test(
  "drive-adapter: duplicate names remain individually conditionally deletable",
  async () => {
    const { adapter, endpoint } = fixture();
    endpoint.seed("duplicate-sync.json", "first malformed copy");
    endpoint.seed("duplicate-sync.json", "second malformed copy");
    endpoint.seed("unrelated.json", '{"keep":true}');
    await authorized(adapter);

    const listed = await adapter.listAppData();
    const duplicates = listed.filter((file) =>
      file.name === "duplicate-sync.json"
    );
    assertEquals(duplicates.length, 2);
    await rejectsWithCode(
      adapter.readAppData("duplicate-sync.json"),
      "corrupt-data",
    );

    for (const duplicate of duplicates) {
      await adapter.deleteAppData(duplicate.name, duplicate.etag);
    }

    assertEquals(endpoint.names(), ["unrelated.json"]);
    assertEquals(
      (await adapter.readAppData("unrelated.json"))?.body,
      '{"keep":true}',
    );
  },
);

Deno.test("drive-adapter: retries remain idempotent after a lost mutation response", async () => {
  const { adapter, endpoint } = fixture();
  await authorized(adapter);
  const first = await adapter.writeAppData({
    name: "idempotent.json",
    body: '{"v":1}',
  });
  endpoint.failAfterMutation();
  const updated = await adapter.writeAppData({
    name: "idempotent.json",
    body: '{"v":2}',
    expectedEtag: first.etag,
  });
  assertEquals((await adapter.readAppData("idempotent.json"))?.body, '{"v":2}');
  assertEquals(updated.body, '{"v":2}');
  endpoint.failAfterMutation();
  await adapter.deleteAppData("idempotent.json", updated.etag);
  assertEquals(await adapter.readAppData("idempotent.json"), undefined);
});

Deno.test("drive-adapter: bounded retry/backoff uses the injectable clock", async () => {
  const { adapter, endpoint, clock } = fixture();
  await authorized(adapter);
  endpoint.failNext(429, "1");
  endpoint.failNext(503);
  const files = await adapter.listAppData({
    retry: {
      maxAttempts: 3,
      directive: "backoff",
      baseDelayMs: 10,
      maxDelayMs: 50,
    },
  });
  assertEquals(files, []);
  assertEquals(clock.delays, [50, 20]);
  assertEquals(
    endpoint.calls.filter((call) => call.path.endsWith("/files")).length,
    3,
  );
});

Deno.test("drive-adapter: HTTP, offline, partial, and corrupt failures are typed and redacted", async () => {
  const statuses: Array<[number, string]> = [
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [429, "rate-limited"],
    [500, "unavailable"],
  ];
  for (const [status, code] of statuses) {
    const current = fixture();
    await authorized(current.adapter);
    current.endpoint.failNext(status);
    const error = await rejectsWithCode(
      current.adapter.listAppData({
        retry: { maxAttempts: 1, directive: "never" },
      }),
      code,
    );
    assert(!String(error).includes(current.identity.issuedToken));
    assert(!JSON.stringify(error).includes(current.identity.issuedToken));
  }

  const offline = fixture();
  await authorized(offline.adapter);
  offline.setOnline(false);
  offline.endpoint.failNetwork();
  await rejectsWithCode(
    offline.adapter.listAppData({
      retry: { maxAttempts: 1, directive: "never" },
    }),
    "offline",
  );

  const partial = fixture();
  partial.endpoint.seed("partial.json", "{}");
  await authorized(partial.adapter);
  partial.endpoint.returnPartialResponse();
  await rejectsWithCode(
    partial.adapter.readAppData("partial.json"),
    "partial-transport",
  );

  const corrupt = fixture();
  await authorized(corrupt.adapter);
  corrupt.endpoint.returnMalformedList();
  await rejectsWithCode(corrupt.adapter.listAppData(), "corrupt-data");
});

Deno.test("drive-adapter: retirement marker is minimal and blocks uploads before transport", async () => {
  const marker: DriveRetirementMarker = {
    schemaVersion: 1,
    type: "retirement-marker",
    generation: "generation-1",
  };
  const { adapter, endpoint } = fixture({ retirementMarker: marker });
  await authorized(adapter);
  const published = await adapter.publishRetirementMarker(marker);
  assertEquals(JSON.parse(published.body), marker);
  assertEquals(await adapter.readRetirementMarker(), marker);
  const createsBeforeBlockedWrite =
    endpoint.calls.filter((call) => call.method === "POST").length;
  await rejectsWithCode(
    adapter.writeAppData({ name: "payload.json", body: "{}" }),
    "retired",
  );
  assertEquals(
    endpoint.calls.filter((call) => call.method === "POST").length,
    createsBeforeBlockedWrite,
  );
  await rejectsWithCode(
    adapter.deleteAppData(DRIVE_RETIREMENT_MARKER_NAME),
    "forbidden",
  );
  await rejectsWithCode(
    adapter.publishRetirementMarker({ ...marker, generation: "generation-2" }),
    "retired",
  );
});

Deno.test("drive-adapter: delete everywhere publishes retirement before erasing and revoking", async () => {
  const marker: DriveRetirementMarker = {
    schemaVersion: 1,
    type: "retirement-marker",
    generation: "generation-delete",
  };
  const { adapter, endpoint, identity } = fixture({ retirementMarker: marker });
  await authorized(adapter);
  await adapter.writeAppData({
    name: "payload.json",
    body: '{"financial":true}',
  });
  await adapter.deleteEverywhere();
  assertEquals(endpoint.names(), [DRIVE_RETIREMENT_MARKER_NAME]);
  assertEquals(
    endpoint.body(DRIVE_RETIREMENT_MARKER_NAME),
    JSON.stringify(marker),
  );
  assertEquals(identity.revokeCount, 1);
  assertEquals(adapter.status(), "signed-out");
});

Deno.test("drive-adapter: abort signals stop operations and retry delays", async () => {
  const { adapter, endpoint } = fixture();
  await authorized(adapter);
  endpoint.failNext(503);
  const controller = new AbortController();
  controller.abort();
  await rejectsWithCode(
    adapter.listAppData({ signal: controller.signal }),
    "aborted",
  );
});
