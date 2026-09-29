import type { JsonValue } from "../ports/common.ts";
import type { LocalPort } from "../ports/local.ts";
import {
  DEFAULT_DEVICE_LOCAL_SETTINGS,
  type DeviceLocalSettings,
  parseDeviceLocalSettings,
} from "../../domain/index.ts";

export const DEVICE_SETTINGS_KEY = "settings-device-local";

function readJsonRecord(value: JsonValue | undefined): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function readDeviceLocalSettings(
  local: LocalPort,
): Promise<DeviceLocalSettings> {
  const value = await local.transaction(
    "readonly",
    (transaction) =>
      transaction.get<JsonValue>("settings", DEVICE_SETTINGS_KEY),
  );
  try {
    return parseDeviceLocalSettings(readJsonRecord(value));
  } catch {
    return DEFAULT_DEVICE_LOCAL_SETTINGS;
  }
}

export async function writeDeviceLocalSettings(
  local: LocalPort,
  settings: DeviceLocalSettings,
): Promise<void> {
  const safe = parseDeviceLocalSettings(settings);
  await local.transaction(
    "readwrite",
    (transaction) =>
      transaction.put(
        "settings",
        DEVICE_SETTINGS_KEY,
        safe as unknown as JsonValue,
      ),
  );
}
