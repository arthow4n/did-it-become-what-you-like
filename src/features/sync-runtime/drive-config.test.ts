import { expect, test, vi } from "vitest";
import {
  browserConfiguredSyncServerUrl,
  LEGACY_SYNC_SERVER_URL,
  syncServerForPreference,
  WORKER_SYNC_SERVER_URL,
} from "./drive-config.ts";

test("cutover moves saved legacy defaults while preserving independently configured servers", () => {
  expect(
    syncServerForPreference(
      LEGACY_SYNC_SERVER_URL,
      LEGACY_SYNC_SERVER_URL,
    ),
  )
    .toBe(LEGACY_SYNC_SERVER_URL);
  expect(
    syncServerForPreference(
      ` ${LEGACY_SYNC_SERVER_URL}/ `,
      WORKER_SYNC_SERVER_URL,
    ),
  )
    .toBe(WORKER_SYNC_SERVER_URL);
  expect(syncServerForPreference(null, WORKER_SYNC_SERVER_URL))
    .toBe(WORKER_SYNC_SERVER_URL);
  expect(
    syncServerForPreference(
      "https://custom.example",
      WORKER_SYNC_SERVER_URL,
    ),
  )
    .toBe("https://custom.example");
});

test("the old Pages build override follows the new default while a custom override still wins", () => {
  try {
    vi.stubEnv("VITE_SYNC_SERVER_URL", ` ${LEGACY_SYNC_SERVER_URL}/ `);
    expect(browserConfiguredSyncServerUrl()).toBe(WORKER_SYNC_SERVER_URL);
    vi.stubEnv("VITE_SYNC_SERVER_URL", " https://custom.example ");
    expect(browserConfiguredSyncServerUrl()).toBe("https://custom.example");
  } finally {
    vi.unstubAllEnvs();
  }
});
