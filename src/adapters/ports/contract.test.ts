import {
  ADAPTER_ERROR_CODES,
  AdapterError,
  type CausalSyncPort,
  type DriveAuthorizationPort,
  type DriveTransportPort,
  type FileSelectionPort,
  type FileSharePort,
  type GeminiModelAndExtractionPort,
  type ImagePreparationPort,
  isAdapterErrorCode,
  type LocalPort,
  mapAdapterError,
  type OnlineStatusPort,
  RETRY_BY_ERROR_CODE,
  type SecretStoragePort,
  type UpdateInstallPort,
} from "./index.ts";

import {
  createFakeCausalSyncPort,
  createFakeDrivePorts,
  createFakeFileSharePort,
  createFakeGeminiPort,
  createFakeImagePreparationPort,
  createFakeLocalPort,
  createFakeOnlineStatusPort,
  createFakeSecretStoragePort,
  createFakeUpdateInstallPort,
} from "../../test-support/fakes/index.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

function assert(
  condition: unknown,
  message = "Expected condition",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

Deno.test("adapter-contract ports expose browser-neutral typed boundaries", () => {
  const fixtures: {
    local: LocalPort;
    causal: CausalSyncPort;
    driveAuth: DriveAuthorizationPort;
    driveTransport: DriveTransportPort;
    gemini: GeminiModelAndExtractionPort;
    image: ImagePreparationPort;
    online: OnlineStatusPort;
    fileSelection: FileSelectionPort;
    fileShare: FileSharePort;
    update: UpdateInstallPort;
    secrets: SecretStoragePort;
  } = {
    local: createFakeLocalPort(),
    causal: createFakeCausalSyncPort(),
    driveAuth: createFakeDrivePorts(),
    driveTransport: createFakeDrivePorts(),
    gemini: createFakeGeminiPort(),
    image: createFakeImagePreparationPort(),
    online: createFakeOnlineStatusPort(),
    fileSelection: createFakeFileSharePort(),
    fileShare: createFakeFileSharePort(),
    update: createFakeUpdateInstallPort(),
    secrets: createFakeSecretStoragePort(),
  };
  assertEquals(Object.keys(fixtures).length, 11);
});

Deno.test("adapter-contract error mapping is exhaustive and retry-explicit", () => {
  for (const code of ADAPTER_ERROR_CODES) {
    assert(isAdapterErrorCode(code));
    assert(typeof RETRY_BY_ERROR_CODE[code] === "string");
    const error = new AdapterError(code, { operation: "contract-test" });
    assertEquals(error.code, code);
    assertEquals(error.operation, "contract-test");
  }
  assertEquals(
    mapAdapterError({ status: 409 }, "drive.write").code,
    "conflict",
  );
  assertEquals(
    mapAdapterError({ name: "AbortError" }, "gemini.extract").code,
    "aborted",
  );
  assertEquals(
    mapAdapterError(
      new Error("credential must never cross this boundary"),
      "unknown",
    ).code,
    "unknown",
  );
});

Deno.test("adapter-contract errors do not copy foreign error messages", () => {
  const mapped = mapAdapterError(
    new Error("AIzaSECRET-should-not-leak"),
    "test",
  );
  assert(!mapped.message.includes("AIzaSECRET"));
  assertEquals(
    JSON.stringify(mapped),
    JSON.stringify({
      name: "AdapterError",
      code: "unknown",
      operation: "test",
      retry: "never",
      details: {},
    }),
  );
});
