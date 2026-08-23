import { z } from "zod";
import {
  canonicalizeDataset,
  formatValidationError,
  parseCurrentDataset,
  type PortableDataset,
} from "../schema/dataset.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
} from "../schema/primitives.ts";

const LegacyDatasetV0Schema = z.object({
  schemaVersion: z.literal(0),
  projects: z.array(z.unknown()).default([]),
  categories: z.array(z.unknown()).default([]),
  expenses: z.array(z.unknown()).default([]),
  receipts: z.array(z.unknown()).default([]),
  receiptPurchaseLines: z.array(z.unknown()).default([]),
  receiptAdjustments: z.array(z.unknown()).default([]),
  devices: z.array(z.unknown()).default([]),
  tombstones: z.array(z.unknown()).default([]),
  retirementMarkers: z.array(z.unknown()).default([]),
  revisions: z.array(z.unknown()).default([]),
  settings: z.unknown().optional(),
  exportedAt: z.string().optional(),
}).passthrough();

export type Migration = {
  fromVersion: number;
  toVersion: number;
  up(input: unknown): unknown;
};

const migrateV0ToV1: Migration = {
  fromVersion: 0,
  toVersion: 1,
  up(input) {
    const legacy = LegacyDatasetV0Schema.parse(input);
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      format: DATASET_FORMAT,
      ...(legacy.exportedAt ? { exportedAt: legacy.exportedAt } : {}),
      projects: legacy.projects,
      categories: legacy.categories,
      expenses: legacy.expenses,
      receipts: legacy.receipts,
      receiptPurchaseLines: legacy.receiptPurchaseLines,
      receiptAdjustments: legacy.receiptAdjustments,
      devices: legacy.devices,
      tombstones: legacy.tombstones,
      retirementMarkers: legacy.retirementMarkers,
      revisions: legacy.revisions,
      settings: legacy.settings ?? {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        type: "portable-settings",
        id: "settings-portable",
        expenseDayBoundary: "03:00",
      },
    };
  },
};

export const MIGRATION_REGISTRY: Readonly<Record<number, Migration>> = {
  1: migrateV0ToV1,
};

export function migrateToCurrent(input: unknown): PortableDataset {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Dataset import must be a JSON object.");
  }
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error("Dataset import must include an integer schemaVersion.");
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Dataset schema version ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}.`,
    );
  }
  let current: unknown = input;
  let currentVersion = version;
  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const migration = MIGRATION_REGISTRY[currentVersion + 1];
    if (!migration || migration.fromVersion !== currentVersion) {
      throw new Error(
        `No migration is registered from schema version ${currentVersion}.`,
      );
    }
    current = migration.up(current);
    currentVersion = migration.toVersion;
  }
  try {
    return canonicalizeDataset(parseCurrentDataset(current));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid dataset: ${formatValidationError(error)}`);
    }
    throw error;
  }
}

export function importDataset(json: string): PortableDataset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error("Dataset import is not valid JSON.");
  }
  return migrateToCurrent(parsed);
}

export function migrateDown(): never {
  throw new Error(
    "Down migrations are intentionally unsupported: exports remain lossless at the current schema version.",
  );
}
