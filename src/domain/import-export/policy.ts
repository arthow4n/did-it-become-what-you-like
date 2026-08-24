import type { PortableDataset } from "../schema/index.ts";
import {
  type CanonicalExportChange,
  type HistoryDeduplication,
  ImportExportDomainError,
  type ReplacementGeneration,
} from "./types.ts";

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

/** Merge causal history by stable change ID; re-importing a file is idempotent. */
export function deduplicateImportedHistory(
  current: readonly CanonicalExportChange[],
  incoming: readonly CanonicalExportChange[],
): HistoryDeduplication {
  const byId = new Map<string, CanonicalExportChange>();
  for (const change of current) byId.set(change.id, structuredClone(change));
  let duplicateChangeCount = 0;
  for (const change of incoming) {
    const existing = byId.get(change.id);
    if (existing !== undefined) {
      if (!equalJson(existing, change)) {
        throw new ImportExportDomainError(
          "history-collision",
          `Causal history ID ${change.id} has different contents.`,
        );
      }
      duplicateChangeCount += 1;
      continue;
    }
    byId.set(change.id, structuredClone(change));
  }
  return {
    changes: [...byId.values()].sort((left, right) =>
      compareCodeUnits(left.id, right.id)
    ),
    duplicateChangeCount,
  };
}

/** A replacement always advances generation, even when importing an older file. */
export function replacementGeneration(
  currentGeneration: number,
  importedGeneration: number,
): ReplacementGeneration {
  if (
    !Number.isInteger(currentGeneration) || currentGeneration < 1 ||
    !Number.isInteger(importedGeneration) || importedGeneration < 1
  ) {
    throw new ImportExportDomainError(
      "invalid-document",
      "Dataset generations must be positive integers.",
    );
  }
  return {
    currentGeneration,
    importedGeneration,
    nextGeneration: Math.max(currentGeneration, importedGeneration) + 1,
  };
}

export function acceptsGeneration(
  currentGeneration: number,
  incomingGeneration: number,
): boolean {
  return incomingGeneration >= currentGeneration;
}

export function emptyDeviceLocalProjection(): Record<string, never> {
  return {};
}

/**
 * The portable projection is deliberately explicit. This helper is used by
 * adapters before serialization so a future local settings collection cannot
 * accidentally become exportable by spreading a database document.
 */
export function portableProjection(dataset: PortableDataset): PortableDataset {
  return structuredClone(dataset);
}
