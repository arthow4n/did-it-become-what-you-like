import type { PortableDataset, StableId } from "../schema/index.ts";

export const CANONICAL_EXPORT_SCHEMA_VERSION = 1 as const;
export const CANONICAL_EXPORT_FORMAT =
  "did-it-become-what-you-like/portable-export" as const;

export const IMPORT_DIAGNOSTIC_OPERATIONS = {
  jsonSyntax: "import.json_syntax",
  schemaVersion: "import.schema_version",
  recordValidation: "import.record_validation",
  migrationFailure: "import.migration_failure",
} as const;

export type ImportDiagnosticOperation = typeof IMPORT_DIAGNOSTIC_OPERATIONS[
  keyof typeof IMPORT_DIAGNOSTIC_OPERATIONS
];

export type CanonicalExportChange = {
  readonly id: StableId;
  readonly actorId: StableId;
  readonly sequence: number;
  readonly parents: readonly StableId[];
  readonly payload: Record<string, unknown>;
};

/**
 * The public JSON envelope contains only synchronized data and causal
 * correctness metadata. Device-local settings, workflow drafts, and images
 * have no representable field here by design.
 */
export type CanonicalExport = {
  readonly schemaVersion: typeof CANONICAL_EXPORT_SCHEMA_VERSION;
  readonly format: typeof CANONICAL_EXPORT_FORMAT;
  readonly exportedAt?: string;
  readonly generation: number;
  readonly heads: readonly StableId[];
  readonly changes: readonly CanonicalExportChange[];
  readonly dataset: PortableDataset;
};

export type CanonicalImportPreview = {
  readonly document: CanonicalExport;
  readonly sourceSchemaVersion: number;
  readonly migrationRequired: boolean;
  /** Ordered schema migrations which will run before the import commits. */
  readonly migrations: readonly string[];
  /** Non-blocking validation or compatibility notes for the owner. */
  readonly warnings: readonly string[];
  /** Blocking validation messages; a returned preview has none. */
  readonly errors: readonly string[];
  readonly projectCount: number;
  readonly categoryCount: number;
  readonly expenseCount: number;
  readonly receiptCount: number;
  readonly changeCount: number;
};

export type ImportMode = "merge" | "replace";

export type HistoryDeduplication = {
  readonly changes: readonly CanonicalExportChange[];
  readonly duplicateChangeCount: number;
};

export type ReplacementGeneration = {
  readonly currentGeneration: number;
  readonly importedGeneration: number;
  readonly nextGeneration: number;
};

export type ImportErrorCode =
  | "invalid-json"
  | "invalid-document"
  | "future-version"
  | "history-collision"
  | "stale-generation";

export class ImportExportDomainError extends Error {
  override readonly name = "ImportExportDomainError";
  readonly code: ImportErrorCode;
  readonly operation: ImportDiagnosticOperation;

  constructor(
    code: ImportErrorCode,
    message: string,
    operation: ImportDiagnosticOperation = code === "invalid-json"
      ? IMPORT_DIAGNOSTIC_OPERATIONS.jsonSyntax
      : code === "future-version"
      ? IMPORT_DIAGNOSTIC_OPERATIONS.schemaVersion
      : IMPORT_DIAGNOSTIC_OPERATIONS.recordValidation,
  ) {
    super(message);
    this.code = code;
    this.operation = operation;
  }
}
