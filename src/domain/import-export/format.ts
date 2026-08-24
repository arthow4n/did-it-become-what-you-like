import { z } from "zod";
import {
  canonicalizeDataset,
  formatValidationError,
  type PortableDataset,
} from "../schema/dataset.ts";
import { migrateToCurrent } from "../migrations/index.ts";
import {
  CURRENT_SCHEMA_VERSION,
  DATASET_FORMAT,
  InstantSchema,
  StableIdSchema,
} from "../schema/primitives.ts";
import {
  CANONICAL_EXPORT_FORMAT,
  CANONICAL_EXPORT_SCHEMA_VERSION,
  type CanonicalExport,
  type CanonicalExportChange,
  type CanonicalImportPreview,
  ImportExportDomainError,
} from "./types.ts";

const CanonicalChangeSchema = z.object({
  id: StableIdSchema,
  actorId: StableIdSchema,
  sequence: z.number().int().positive(),
  parents: z.array(StableIdSchema),
  payload: z.record(z.string(), z.unknown()),
}).strict();

const CanonicalEnvelopeSchema = z.object({
  schemaVersion: z.number().int(),
  format: z.literal(CANONICAL_EXPORT_FORMAT),
  exportedAt: InstantSchema.optional(),
  generation: z.number().int().positive(),
  heads: z.array(StableIdSchema),
  changes: z.array(CanonicalChangeSchema),
  dataset: z.unknown(),
}).strict();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function schemaVersionOf(value: unknown): number {
  if (!isRecord(value) || typeof value.schemaVersion !== "number") {
    throw new ImportExportDomainError(
      "invalid-document",
      "The import must contain an integer schemaVersion.",
    );
  }
  if (!Number.isInteger(value.schemaVersion)) {
    throw new ImportExportDomainError(
      "invalid-document",
      "The import schemaVersion must be an integer.",
    );
  }
  return value.schemaVersion;
}

function parseDataset(value: unknown): PortableDataset {
  try {
    return migrateToCurrent(value);
  } catch (error) {
    if (error instanceof Error) {
      throw new ImportExportDomainError("invalid-document", error.message);
    }
    throw new ImportExportDomainError(
      "invalid-document",
      "The import dataset is invalid.",
    );
  }
}

function parseHistoryChanges(
  changes: readonly CanonicalExportChange[],
): readonly CanonicalExportChange[] {
  return changes.map((change) => {
    const payload = change.payload;
    if (
      payload.type !== "causal-dataset" ||
      payload.schemaVersion !== 1 ||
      typeof payload.fingerprint !== "string" ||
      payload.dataset === undefined
    ) {
      throw new ImportExportDomainError(
        "invalid-document",
        `Causal history change ${change.id} has an invalid payload.`,
      );
    }
    return {
      ...change,
      payload: {
        ...payload,
        dataset: canonicalizeDataset(parseDataset(payload.dataset)),
      },
    };
  });
}

function parseLegacyOrCurrent(value: unknown): {
  readonly dataset: PortableDataset;
  readonly sourceSchemaVersion: number;
} {
  const sourceSchemaVersion = schemaVersionOf(value);
  if (sourceSchemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new ImportExportDomainError(
      "future-version",
      `Dataset schema version ${sourceSchemaVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}.`,
    );
  }
  return {
    dataset: parseDataset(value),
    sourceSchemaVersion,
  };
}

function parseEnvelope(value: Record<string, unknown>): {
  readonly document: CanonicalExport;
  readonly sourceSchemaVersion: number;
} {
  const envelopeVersion = schemaVersionOf(value);
  if (envelopeVersion > CANONICAL_EXPORT_SCHEMA_VERSION) {
    throw new ImportExportDomainError(
      "future-version",
      `Export schema version ${envelopeVersion} is newer than supported version ${CANONICAL_EXPORT_SCHEMA_VERSION}.`,
    );
  }
  let parsed: z.infer<typeof CanonicalEnvelopeSchema>;
  try {
    parsed = CanonicalEnvelopeSchema.parse(value);
  } catch (error) {
    const message = error instanceof z.ZodError
      ? formatValidationError(error)
      : "The export envelope is invalid.";
    throw new ImportExportDomainError("invalid-document", message);
  }
  const migrated = parseLegacyOrCurrent(parsed.dataset);
  return {
    sourceSchemaVersion: migrated.sourceSchemaVersion,
    document: {
      schemaVersion: CANONICAL_EXPORT_SCHEMA_VERSION,
      format: CANONICAL_EXPORT_FORMAT,
      ...(parsed.exportedAt === undefined
        ? {}
        : { exportedAt: parsed.exportedAt }),
      generation: parsed.generation,
      heads: [...parsed.heads],
      changes: parseHistoryChanges(parsed.changes).map((change) => ({
        ...change,
        parents: [...change.parents],
      })),
      dataset: canonicalizeDataset(migrated.dataset),
    },
  };
}

function sortCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => sortCodeUnits(left, right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}

function canonicalChange(change: CanonicalExportChange): CanonicalExportChange {
  const payload = change.payload;
  if (
    payload.type !== "causal-dataset" ||
    payload.schemaVersion !== 1 ||
    typeof payload.fingerprint !== "string" ||
    payload.dataset === undefined
  ) {
    throw new ImportExportDomainError(
      "invalid-document",
      `Causal history change ${change.id} has an invalid payload.`,
    );
  }
  return {
    ...change,
    payload: {
      ...payload,
      dataset: canonicalizeDataset(parseDataset(payload.dataset)),
    },
  };
}

function canonicalDocument(document: CanonicalExport): CanonicalExport {
  return {
    schemaVersion: CANONICAL_EXPORT_SCHEMA_VERSION,
    format: CANONICAL_EXPORT_FORMAT,
    ...(document.exportedAt === undefined
      ? {}
      : { exportedAt: document.exportedAt }),
    generation: document.generation,
    heads: [...document.heads].sort(sortCodeUnits),
    changes: [...document.changes]
      .sort((left, right) => sortCodeUnits(left.id, right.id))
      .map((change) => ({
        ...canonicalChange(change),
        parents: [...change.parents].sort(sortCodeUnits),
      })),
    dataset: canonicalizeDataset(document.dataset),
  };
}

export function createCanonicalExport(input: {
  readonly dataset: PortableDataset;
  readonly generation?: number;
  readonly heads?: readonly string[];
  readonly changes?: readonly CanonicalExportChange[];
  readonly exportedAt?: string;
}): CanonicalExport {
  const document: CanonicalExport = {
    schemaVersion: CANONICAL_EXPORT_SCHEMA_VERSION,
    format: CANONICAL_EXPORT_FORMAT,
    ...(input.exportedAt === undefined
      ? {}
      : { exportedAt: InstantSchema.parse(input.exportedAt) }),
    generation: input.generation ?? 1,
    heads: (input.heads ?? []).map((head) => StableIdSchema.parse(head)),
    changes: (input.changes ?? []).map((change) =>
      CanonicalChangeSchema.parse(change)
    ),
    dataset: canonicalizeDataset(migrateToCurrent(input.dataset)),
  };
  if (!Number.isInteger(document.generation) || document.generation < 1) {
    throw new ImportExportDomainError(
      "invalid-document",
      "Export generation must be a positive integer.",
    );
  }
  return canonicalDocument(document);
}

export function serializeCanonicalExport(document: CanonicalExport): string {
  try {
    const canonical = canonicalDocument(createCanonicalExport(document));
    return `${JSON.stringify(sortJson(canonical))}\n`;
  } catch (error) {
    if (error instanceof ImportExportDomainError) throw error;
    throw new ImportExportDomainError(
      "invalid-document",
      error instanceof Error ? error.message : "The export is invalid.",
    );
  }
}

export function parseCanonicalExport(json: string): {
  readonly document: CanonicalExport;
  readonly sourceSchemaVersion: number;
  readonly migrationRequired: boolean;
} {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new ImportExportDomainError(
      "invalid-json",
      "The import is not valid JSON.",
    );
  }
  if (!isRecord(value)) {
    throw new ImportExportDomainError(
      "invalid-document",
      "The import must be a JSON object.",
    );
  }
  const parsed = value.format === CANONICAL_EXPORT_FORMAT
    ? parseEnvelope(value)
    : parseLegacyOrCurrent(value);
  const document = "document" in parsed
    ? parsed.document
    : createCanonicalExport({ dataset: parsed.dataset });
  return {
    document,
    sourceSchemaVersion: parsed.sourceSchemaVersion,
    migrationRequired: parsed.sourceSchemaVersion !==
        CANONICAL_EXPORT_SCHEMA_VERSION ||
      value.format !== CANONICAL_EXPORT_FORMAT,
  };
}

export function previewCanonicalImport(json: string): CanonicalImportPreview {
  const parsed = parseCanonicalExport(json);
  const { dataset } = parsed.document;
  return {
    document: parsed.document,
    sourceSchemaVersion: parsed.sourceSchemaVersion,
    migrationRequired: parsed.migrationRequired,
    projectCount: dataset.projects.length,
    categoryCount: dataset.categories.length,
    expenseCount: dataset.expenses.length,
    receiptCount: dataset.receipts.length,
    changeCount: parsed.document.changes.length,
  };
}

export { DATASET_FORMAT };
