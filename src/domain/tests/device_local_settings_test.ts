import {
  DEFAULT_DEVICE_LOCAL_SETTINGS,
  DeviceLocalSettingsSchema,
  parseDeviceLocalSettings,
} from "../index.ts";

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

Deno.test("device-local settings provide provider-aware defaults", () => {
  assertEquals(
    DeviceLocalSettingsSchema.parse({}),
    DEFAULT_DEVICE_LOCAL_SETTINGS,
  );
  assertEquals(
    parseDeviceLocalSettings({ imagePreparationEnabled: false }),
    {
      ...DEFAULT_DEVICE_LOCAL_SETTINGS,
      imagePreparationEnabled: false,
    },
  );
});

Deno.test("device-local settings round-trip provider and OpenRouter preferences", () => {
  const settings = DeviceLocalSettingsSchema.parse({
    activeProvider: "openrouter",
    selectedGeminiModel: "gemini-2.5-flash",
    selectedOpenRouterModel: "google/gemini-2.5-flash",
    preferredProviderTag: "google-vertex",
    requireZdr: true,
    denyProviderDataCollection: true,
    imagePreparationEnabled: false,
  });
  assertEquals(parseDeviceLocalSettings(settings), settings);
});

Deno.test("device-local settings reject invalid providers and preferences", () => {
  assert(
    !DeviceLocalSettingsSchema.safeParse({ activeProvider: "google" }).success,
  );
  assert(
    !DeviceLocalSettingsSchema.safeParse({ preferredProviderTag: " " })
      .success,
  );
  assert(
    !DeviceLocalSettingsSchema.safeParse({ requireZdr: "true" }).success,
  );
  assert(
    !DeviceLocalSettingsSchema.safeParse({
      denyProviderDataCollection: 1,
    }).success,
  );
});

Deno.test("device-local settings migration drops old compatibility state and secrets", () => {
  const migrated = parseDeviceLocalSettings({
    imagePreparationEnabled: false,
    selectedGeminiModel: "gemini-2.0-flash",
    geminiApiKey: "AIza.must-not-persist",
    geminiKeyRevision: "legacy-key-revision",
    geminiCompatibilityEvidence: [{
      modelId: "gemini-2.0-flash",
      modelFingerprint: "legacy",
      keyRevision: "legacy-key-revision",
      evidenceVersion: "receipt-compatibility.v1",
      status: "compatible",
    }],
  });

  assertEquals(migrated, {
    activeProvider: "gemini",
    selectedGeminiModel: "gemini-2.0-flash",
    requireZdr: false,
    denyProviderDataCollection: false,
    imagePreparationEnabled: false,
  });
  assert(!("geminiApiKey" in migrated));
  assert(!("geminiKeyRevision" in migrated));
  assert(!("geminiCompatibilityEvidence" in migrated));
});
