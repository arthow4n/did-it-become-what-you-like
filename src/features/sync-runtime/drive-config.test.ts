import { expect, test } from "vitest";
import {
  LEGACY_SYNC_SERVER_URL,
  syncServerForStoredPreference,
  WORKER_SYNC_SERVER_URL,
} from "./drive-config.ts";

test("cutover moves saved legacy defaults while preserving independently configured servers", () => {
  expect(
    syncServerForStoredPreference(
      LEGACY_SYNC_SERVER_URL,
      LEGACY_SYNC_SERVER_URL,
    ),
  )
    .toBe(LEGACY_SYNC_SERVER_URL);
  expect(
    syncServerForStoredPreference(
      ` ${LEGACY_SYNC_SERVER_URL}/ `,
      WORKER_SYNC_SERVER_URL,
    ),
  )
    .toBe(WORKER_SYNC_SERVER_URL);
  expect(syncServerForStoredPreference(null, WORKER_SYNC_SERVER_URL))
    .toBe(WORKER_SYNC_SERVER_URL);
  expect(
    syncServerForStoredPreference(
      "https://custom.example",
      WORKER_SYNC_SERVER_URL,
    ),
  )
    .toBe("https://custom.example");
});
