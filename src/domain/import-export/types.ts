import type { PortableDataset, StableId } from "../schema/index.ts";

export const CANONICAL_EXPORT_SCHEMA_VERSION = 1 as const;
export const CANONICAL_EXPORT_FORMAT =
  "did-it-become-what-you-like/portable-export" as const;

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

  constructor(code: ImportErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
