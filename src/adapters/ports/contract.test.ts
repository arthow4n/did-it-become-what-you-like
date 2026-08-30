import {
  ADAPTER_DIAGNOSTIC_OPERATIONS,
  ADAPTER_ERROR_CODES,
  AdapterError,
  isAdapterDiagnosticOperation,
  isAdapterErrorCode,
  mapAdapterError,
  RETIRED_DATASET_ERROR_ALIASES,
  RETRY_BY_ERROR_CODE,
} from "./index.ts";

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
  assertEquals(RETRY_BY_ERROR_CODE.retired, "never");
  for (const alias of RETIRED_DATASET_ERROR_ALIASES) {
    assertEquals(
      mapAdapterError({ code: alias }, "sync.upload").code,
      "retired",
    );
  }
  assertEquals(mapAdapterError({ status: 410 }, "sync.upload").code, "retired");
  assertEquals(
    mapAdapterError({ name: "RetirementError" }, "sync.upload").retry,
    "never",
  );
  assertEquals(
    mapAdapterError(
      new Error("credential must never cross this boundary"),
      "unknown",
    ).code,
    "unknown",
  );
});

Deno.test("adapter-contract diagnostics use the bounded operation vocabulary", () => {
  assertEquals(Object.values(ADAPTER_DIAGNOSTIC_OPERATIONS), [
    "import.json_syntax",
    "import.schema_version",
    "import.record_validation",
    "import.migration_failure",
    "drive.auth.popup_closed",
    "drive.auth.access_denied",
    "drive.transport.upload_failed",
    "drive.transport.quota_exceeded",
    "local.quota_exceeded",
    "local.db_blocked",
    "local.tx_abort",
  ]);
});

Deno.test("adapter-contract rejects foreign diagnostic operation text", () => {
  assert(isAdapterDiagnosticOperation("drive.transport.upload_failed"));
  assert(!isAdapterDiagnosticOperation("AIza-direct-credential-response-text"));
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

Deno.test("adapter-contract direct errors retain only safe allowlisted data", () => {
  const credential = "AIza-direct-credential-response-text";
  const direct = new AdapterError("unknown", {
    operation: "drive.read",
    message: `SDK response included ${credential}`,
    retryAfterMs: Number.POSITIVE_INFINITY,
    details: {
      response: `Authorization: Bearer ${credential}`,
      providerCode: "retired",
      httpStatus: "503",
      token: credential,
    },
  });

  assertEquals(
    direct.message,
    "The adapter operation failed for an unknown reason.",
  );
  assertEquals(direct.retryAfterMs, undefined);
  assertEquals(direct.details, { httpStatus: "503", providerCode: "retired" });
  assert(!String(direct).includes(credential));
  assert(!JSON.stringify(direct).includes(credential));
  assertEquals(direct.toJSON(), {
    name: "AdapterError",
    code: "unknown",
    operation: "drive.read",
    retry: "never",
    details: { httpStatus: "503", providerCode: "retired" },
  });
});

Deno.test("adapter-contract mapped errors discard foreign messages and details", () => {
  const credential = "AIza-mapped-credential-response-text";
  const mapped = mapAdapterError(
    {
      code: "retirement",
      message: `SDK response included ${credential}`,
      details: { response: credential, token: credential },
    },
    "sync.upload",
  );

  assertEquals(mapped.code, "retired");
  assertEquals(mapped.retry, "never");
  assertEquals(mapped.message, "The adapter dataset has been retired.");
  assertEquals(mapped.details, {});
  assert(!String(mapped).includes(credential));
  assert(!JSON.stringify(mapped).includes(credential));
});
