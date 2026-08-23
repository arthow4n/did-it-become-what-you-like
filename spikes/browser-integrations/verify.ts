/// <reference lib="deno.ns" />

import { BrowserFixture } from "./browser-fixture.ts";
import {
  DRIVE_APP_DATA_SCOPE,
  DRIVE_USER_FIELDS,
  FakeDriveApi,
  FakeGoogleGenAI,
  FakeGoogleIdentity,
} from "./fake-sdk.ts";
import {
  DEFAULT_BROWSER_IMAGE_MIME_TYPES,
  GEMINI_IMAGE_MIME_TYPES,
  IMAGE_LIMITS,
  parseAndValidateReceiptOutput,
  prepareImage,
  RECEIPT_JSON_SCHEMA,
  scaleDimensions,
  stripJpegMetadata,
} from "./image.ts";
import { EXIF_JPEG_FIXTURE } from "./fixtures/exif-jpeg.ts";
import {
  assertRestrictiveCsp,
  assetPath,
  contentSecurityPolicy,
  hashRouteUrl,
  isWithinServiceWorkerScope,
  parseHashRoute,
  REPOSITORY_BASE_PATH,
  serviceWorkerRegistration,
  serviceWorkerShouldHandle,
} from "./pwa.ts";

type Test = () => void | Promise<void>;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function assertThrows(action: () => unknown, message: string): void {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(message);
}

function assertByteEqual(
  actual: Uint8Array,
  expected: Uint8Array,
  message: string,
): void {
  assertEquals([...actual], [...expected], message);
}

const tests: Array<[string, Test]> = [
  ["GIS token and Drive app-data contract", () => {
    const identity = new FakeGoogleIdentity();
    let token = "";
    const client = identity.initTokenClient({
      callback: (response) => {
        token = response.access_token;
        assertEquals(response.scope, DRIVE_APP_DATA_SCOPE, "GIS scope");
      },
      client_id: "synthetic-web-client.apps.googleusercontent.com",
      scope: DRIVE_APP_DATA_SCOPE,
    });
    assertThrows(
      () => client.requestAccessToken(),
      "GIS must not authorize from a background call",
    );
    identity.runUserGesture(() => client.requestAccessToken());
    assertEquals(
      identity.tokenResponses.length,
      1,
      "one user-driven token request",
    );
    assertEquals(identity.tokenResponses[0].token_type, "Bearer", "token type");

    const drive = new FakeDriveApi(token);
    const about = drive.aboutGet(DRIVE_USER_FIELDS);
    assertEquals(
      about.user.emailAddress,
      "synthetic-owner@example.test",
      "Drive identity",
    );
    const created = drive.filesCreate({
      media: {
        body: '{"schemaVersion":"sync.v1"}',
        mimeType: "application/json",
      },
      requestBody: {
        mimeType: "application/json",
        name: "sync-state.json",
        parents: ["appDataFolder"],
      },
    });
    const listed = drive.filesList({
      fields: "nextPageToken,files(id,name,mimeType,modifiedTime,parents,etag)",
      pageSize: 10,
      spaces: "appDataFolder",
    });
    assertEquals(listed.files[0].id, created.id, "app-data list round trip");
    const updated = drive.filesUpdate({
      fileId: created.id,
      ifMatch: created.etag,
      media: {
        body: '{"schemaVersion":"sync.v1","revision":2}',
        mimeType: "application/json",
      },
    });
    assert(updated.etag !== created.etag, "conditional update changes ETag");
    assert(
      drive.calls.every((call) =>
        call.method === "about.get" ||
        call.method === "files.create" || call.method === "files.list" ||
        call.method === "files.update"
      ),
      "only approved Drive methods were called",
    );
  }],
  ["Drive contract rejects an ordinary Drive parent", () => {
    const drive = new FakeDriveApi("synthetic-drive-token");
    assertThrows(
      () =>
        drive.filesCreate({
          media: { body: "{}", mimeType: "application/json" },
          requestBody: {
            mimeType: "application/json",
            name: "forbidden.json",
            parents: ["drive-root"] as unknown as ["appDataFolder"],
          },
        }),
      "ordinary Drive parent must be rejected",
    );
  }],
  ["Gemini model listing and synthetic capability test", () => {
    const ai = new FakeGoogleGenAI();
    const first = ai.models.list({ pageSize: 1 });
    assertEquals(first.models.length, 1, "first model page");
    assert(first.nextPageToken !== undefined, "model list has a page token");
    const second = ai.models.list({
      pageSize: 1,
      pageToken: first.nextPageToken,
    });
    assertEquals(
      second.models[0].name,
      "models/text-only",
      "second model page",
    );
    assertEquals(
      first.models[0].supportedGenerationMethods,
      ["generateContent"],
      "metadata only establishes generation capability",
    );
    const response = ai.models.generateContent({
      config: {
        responseMimeType: "application/json",
        responseSchema: RECEIPT_JSON_SCHEMA,
        systemInstruction:
          "Synthetic capability probe; never use a real receipt.",
      },
      contents: [
        { text: "Return a valid receipt.v1 object for the synthetic fixture." },
        {
          inlineData: { data: "c3ludGhldGljLWltYWdl", mimeType: "image/jpeg" },
        },
      ],
      model: first.models[0].baseModelId,
    });
    const output = parseAndValidateReceiptOutput(response.text);
    assertEquals(
      output.schemaVersion,
      "receipt.v1",
      "synthetic structured output",
    );
    assertEquals(
      ai.generateRequests[0].config.responseMimeType,
      "application/json",
      "JSON mode",
    );
    assertEquals(ai.generateRequests[0].contents[0], {
      text: "Return a valid receipt.v1 object for the synthetic fixture.",
    }, "prompt precedes image");
    const requestText = JSON.stringify(ai.generateRequests[0]);
    assert(
      !requestText.includes("expense history"),
      "request does not contain expense history",
    );
    assert(
      !requestText.includes("project names"),
      "request does not contain project names",
    );
  }],
  ["Structured output rejects malformed model text", () => {
    assertThrows(
      () => parseAndValidateReceiptOutput('{"schemaVersion":"receipt.v1"}'),
      "partial model output must not reach review",
    );
    assertThrows(
      () =>
        parseAndValidateReceiptOutput(JSON.stringify({
          currency: "SEK",
          date: "2026-08-23",
          lines: [],
          merchant: "Synthetic shop",
          mismatch: null,
          printedTotal: "-1.00",
          schemaVersion: "receipt.v1",
          uncertainty: [],
          hostile: "<script>not executable</script>",
        })),
      "hostile or unexpected model fields must be rejected",
    );
  }],
  ["EXIF/XMP/COM metadata removal fixture", () => {
    const sanitized = stripJpegMetadata(EXIF_JPEG_FIXTURE);
    assert(
      !new TextDecoder().decode(sanitized).includes("synthetic-location"),
      "EXIF removed",
    );
    assert(
      !new TextDecoder().decode(sanitized).includes("synthetic-xmp"),
      "XMP removed",
    );
    assert(
      !new TextDecoder().decode(sanitized).includes("camera-model"),
      "COM removed",
    );
    assert(
      sanitized.includes(0xff) && sanitized.includes(0xda) &&
        sanitized.includes(0x33),
      "JPEG scan structure and payload remain",
    );
    assertByteEqual(
      stripJpegMetadata(sanitized),
      sanitized,
      "metadata stripping is idempotent",
    );
  }],
  ["Image preparation on/off and dimensions", () => {
    const calls: string[] = [];
    const operations = {
      compress: (bytes: Uint8Array, quality: number): Uint8Array => {
        calls.push(`compress:${quality}`);
        return bytes;
      },
      resize: (
        input: Parameters<typeof prepareImage>[0],
        maxDimension: number,
      ) => {
        calls.push(`resize:${maxDimension}`);
        const dimensions = scaleDimensions(
          input.width,
          input.height,
          maxDimension,
        );
        return { ...input, ...dimensions };
      },
      stripMetadata: (input: Parameters<typeof prepareImage>[0]) => ({
        bytes: stripJpegMetadata(input.bytes),
        metadataRemoved: true,
      }),
    };
    const input = {
      bytes: EXIF_JPEG_FIXTURE,
      height: 3500,
      mimeType: "image/jpeg",
      width: 5200,
    };
    const off = prepareImage(input, false, operations);
    assertEquals(off.preparation, "off", "preparation off state");
    assertEquals(off.width, 5200, "off preserves width");
    assertEquals(off.height, 3500, "off preserves height");
    assert(off.metadataRemoved, "off still removes metadata");
    assertEquals(calls, [], "off performs no optional resize/compression");

    const on = prepareImage(input, true, operations);
    assertEquals(on.preparation, "resize-compress", "preparation on state");
    assertEquals(on.width, 4096, "on caps the long edge");
    assertEquals(on.height, 2757, "on preserves aspect ratio");
    assert(on.metadataRemoved, "on removes metadata");
    assertEquals(
      calls,
      ["resize:4096", "compress:0.85"],
      "on performs optional preparation",
    );
  }],
  ["Camera/file input and ephemeral cleanup", () => {
    const fixture = new BrowserFixture();
    const operations = {
      compress: (bytes: Uint8Array): Uint8Array => bytes,
      resize: (input: Parameters<typeof prepareImage>[0]) => input,
      stripMetadata: (input: Parameters<typeof prepareImage>[0]) => ({
        bytes: stripJpegMetadata(input.bytes),
        metadataRemoved: true,
      }),
    };
    fixture.takePhoto({
      bytes: EXIF_JPEG_FIXTURE,
      name: "synthetic.jpg",
      type: "image/jpeg",
    });
    assert(
      fixture.hasEphemeralImage,
      "camera selection is ephemeral while selected",
    );
    fixture.scan(false, operations, "succeeded");
    assert(!fixture.hasEphemeralImage, "successful scan releases image state");
    fixture.chooseImage({
      bytes: EXIF_JPEG_FIXTURE,
      name: "synthetic.jpg",
      type: "image/jpeg",
    });
    fixture.scan(false, operations, "failed");
    assert(!fixture.hasEphemeralImage, "failed scan releases image state");
    fixture.takePhoto({
      bytes: EXIF_JPEG_FIXTURE,
      name: "synthetic.jpg",
      type: "image/jpeg",
    });
    fixture.scan(false, operations, "cancelled");
    assert(!fixture.hasEphemeralImage, "cancelled scan releases image state");
  }],
  ["Image formats and evidence-based transport limits", () => {
    assertEquals(GEMINI_IMAGE_MIME_TYPES, [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/heic",
      "image/heif",
    ], "official Gemini image MIME set");
    assertEquals(DEFAULT_BROWSER_IMAGE_MIME_TYPES, [
      "image/png",
      "image/jpeg",
      "image/webp",
    ], "browser-safe default MIME set");
    assertEquals(
      IMAGE_LIMITS.inlineRequestBytes,
      20_000_000,
      "inline request byte limit",
    );
    assertEquals(
      IMAGE_LIMITS.maxImageFilesPerRequest,
      3600,
      "image file count limit",
    );
    assertEquals(
      scaleDimensions(384, 384, 4096),
      { height: 384, width: 384 },
      "small image not enlarged",
    );
    assertEquals(scaleDimensions(5200, 3500, 4096), {
      height: 2757,
      width: 4096,
    }, "synthetic legibility fixture scales without crop");
  }],
  ["CSP allowlist", () => {
    const csp = contentSecurityPolicy();
    assertRestrictiveCsp(csp);
    assert(
      csp.includes("https://generativelanguage.googleapis.com"),
      "Gemini API is allowed",
    );
    assert(csp.includes("https://www.googleapis.com"), "Drive API is allowed");
    assert(!csp.includes("https://cdn."), "unrelated CDNs are not allowed");
  }],
  ["Hash routes survive base-path refresh", () => {
    const url = hashRouteUrl(
      "https://owner.github.io",
      REPOSITORY_BASE_PATH,
      "/expenses/details",
    );
    assertEquals(
      parseHashRoute(url, REPOSITORY_BASE_PATH),
      "/expenses/details",
      "hash route",
    );
    const fixture = new BrowserFixture("/settings/gemini");
    assertEquals(fixture.refresh(), {
      requestPath: REPOSITORY_BASE_PATH,
      restoredRoute: "/settings/gemini",
    }, "browser refresh requests only shell path");
    assertEquals(
      assetPath(REPOSITORY_BASE_PATH, "assets/app.js"),
      "/did-it-become-what-you-like/assets/app.js",
      "base asset path",
    );
    assertThrows(
      () => assetPath(REPOSITORY_BASE_PATH, "../outside.js"),
      "asset path traversal must be rejected",
    );
  }],
  ["Service worker is repository-scoped", () => {
    const registration = serviceWorkerRegistration(REPOSITORY_BASE_PATH);
    assertEquals(registration, {
      scriptUrl: "/did-it-become-what-you-like/sw.js",
      scope: REPOSITORY_BASE_PATH,
    }, "service worker registration");
    assert(
      isWithinServiceWorkerScope(
        "https://owner.github.io/did-it-become-what-you-like/assets/app.js",
        "https://owner.github.io/did-it-become-what-you-like/",
      ),
      "app asset is in scope",
    );
    assert(
      !isWithinServiceWorkerScope(
        "https://owner.github.io/another-repository/assets/app.js",
        "https://owner.github.io/did-it-become-what-you-like/",
      ),
      "sibling repository is out of scope",
    );
    assert(
      !isWithinServiceWorkerScope(
        "https://owner.github.io/did-it-become-what-you-like-evil/app.js",
        "https://owner.github.io/did-it-become-what-you-like/",
      ),
      "prefix collision is out of scope",
    );
    assert(
      serviceWorkerShouldHandle(
        "https://owner.github.io/did-it-become-what-you-like/index.html",
        REPOSITORY_BASE_PATH,
      ),
      "same-repository shell is handled",
    );
    assert(
      !serviceWorkerShouldHandle(
        "https://generativelanguage.googleapis.com/v1beta/models",
        REPOSITORY_BASE_PATH,
      ),
      "Gemini API is never intercepted by app worker",
    );
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try {
    await test();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(
      `not ok - ${name}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

console.log(
  `\nF-003 browser integration proofs: ${
    tests.length - failures
  }/${tests.length} passed`,
);
if (failures > 0) Deno.exit(1);
