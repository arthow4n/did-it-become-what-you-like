export type ConflictJsonPrimitive = string | number | boolean | null;
export type ConflictJsonValue =
  | ConflictJsonPrimitive
  | ConflictJsonObject
  | ConflictJsonValue[];
export type ConflictJsonObject = {
  readonly [key: string]: ConflictJsonValue;
};

export type ConflictRecordType =
  | "project"
  | "category"
  | "expense"
  | "receipt"
  | "receipt-line";

export type ConflictRevisionContext = {
  readonly id: string;
  readonly deviceId: string;
  readonly deviceLabel: string;
  readonly recordedAt: string;
  readonly record?: ConflictJsonObject;
};

/**
 * This is the adapter-neutral shape accepted from S-402. `local` and `remote`
 * are field values for ordinary conflicts and complete records for
 * delete-versus-edit conflicts. The optional record snapshots let the domain
 * validate a custom choice without requiring a schema or adapter change.
 */
export type ConflictObservation = {
  readonly conflictId: string;
  readonly recordType: string;
  readonly recordId: string;
  readonly field?: string;
  readonly local?: ConflictJsonValue;
  readonly remote?: ConflictJsonValue;
  readonly localDeleted?: boolean;
  readonly remoteDeleted?: boolean;
  readonly localRecord?: ConflictJsonObject;
  readonly remoteRecord?: ConflictJsonObject;
  readonly baseRecord?: ConflictJsonObject;
  readonly localRevision?: ConflictRevisionContext;
  readonly remoteRevision?: ConflictRevisionContext;
  readonly relatedChangeIds?: readonly string[];
  readonly recordedAt?: string;
};

export type ConflictCandidate = {
  readonly id: string;
  readonly revisionId: string;
  readonly value?: ConflictJsonValue;
  readonly deleted: boolean;
  readonly deviceId: string;
  readonly deviceLabel: string;
  readonly recordedAt: string;
  readonly record?: ConflictJsonObject;
};

export type ConflictGroup = {
  readonly id: string;
  readonly recordType: ConflictRecordType;
  readonly recordId: string;
  readonly field: string;
  readonly kind: "same-field" | "delete-versus-edit";
  readonly candidates: readonly ConflictCandidate[];
  readonly parentRevisionIds: readonly string[];
  readonly sourceConflictIds: readonly string[];
  /** The local side used as the starting point for a custom resolution. */
  readonly currentRecord?: ConflictJsonObject;
  readonly baseRecord?: ConflictJsonObject;
};

export type ConflictResolutionRequest =
  | { readonly choice: "candidate"; readonly candidateId: string }
  | { readonly choice: "custom"; readonly value: ConflictJsonValue }
  | { readonly choice: "keep-edited" }
  | { readonly choice: "delete" };

export type ConflictResolutionDraft = ConflictResolutionRequest & {
  readonly groupId: string;
};

export type ConflictTombstone = {
  readonly type: "s403-conflict-tombstone";
  readonly recordType: ConflictRecordType;
  readonly recordId: string;
  readonly deletedAt: string;
  readonly deletedBy: string;
  readonly resolutionRevisionId: string;
  readonly parentRevisionIds: readonly string[];
};

export type ConflictResolutionRevision = {
  readonly type: "s403-conflict-resolution-revision";
  readonly id: string;
  readonly recordType: ConflictRecordType;
  readonly recordId: string;
  readonly field: string;
  readonly parents: readonly string[];
  readonly deviceId: string;
  readonly recordedAt: string;
  readonly choice: ConflictResolutionRequest["choice"];
  readonly value?: ConflictJsonValue;
  readonly deleted: boolean;
  readonly record?: ConflictJsonObject;
};

export type ConflictResolutionRecord = {
  readonly groupId: string;
  readonly resolutionRevision: ConflictResolutionRevision;
  readonly tombstone?: ConflictTombstone;
};

export type ConflictProgress = {
  readonly phase: "idle" | "reviewing" | "committing" | "resolved" | "failed";
  readonly unresolvedCount: number;
  readonly completedCount: number;
  readonly updatedAt: string;
  readonly failureCode?: string;
};

export type ConflictState = {
  readonly type: "s403-conflict-state";
  readonly version: 1;
  readonly groups: readonly ConflictGroup[];
  readonly resolutions: readonly ConflictResolutionRecord[];
  readonly progress: ConflictProgress;
};

export type ConflictResolutionResult = {
  readonly groupId: string;
  readonly resolutionRevision: ConflictResolutionRevision;
  readonly tombstone?: ConflictTombstone;
  readonly record?: ConflictJsonObject;
  readonly alreadyResolved: boolean;
};

export type ConflictMergeResult = {
  readonly mergedRecord?: ConflictJsonObject;
  readonly conflicts: readonly ConflictGroup[];
};

export type ConcurrentRecordInput = {
  readonly recordType: string;
  readonly recordId: string;
  readonly baseRecord?: ConflictJsonObject;
  readonly localRecord?: ConflictJsonObject;
  readonly remoteRecord?: ConflictJsonObject;
  readonly localRevision?: ConflictRevisionContext;
  readonly remoteRevision?: ConflictRevisionContext;
  readonly relatedChangeIds?: readonly string[];
  readonly conflictId?: string;
  readonly recordedAt?: string;
};

export type ConflictCandidateProjection = {
  readonly ordinal: number;
  readonly value?: ConflictJsonValue;
  readonly deleted: boolean;
  readonly deviceLabel: string;
  readonly recordedAt: string;
};

export type ConflictGroupProjection = {
  readonly ordinal: number;
  readonly recordType: ConflictRecordType;
  readonly field: string;
  readonly kind: ConflictGroup["kind"];
  readonly candidates: readonly ConflictCandidateProjection[];
  readonly discardedEditedValues: readonly ConflictJsonValue[];
};

export type ConflictStateProjection = {
  readonly groups: readonly ConflictGroupProjection[];
  readonly unresolvedCount: number;
  readonly completedCount: number;
  readonly phase: ConflictProgress["phase"];
};

export function emptyConflictState(
  now = "1970-01-01T00:00:00.000Z",
): ConflictState {
  return {
    type: "s403-conflict-state",
    version: 1,
    groups: [],
    resolutions: [],
    progress: {
      phase: "idle",
      unresolvedCount: 0,
      completedCount: 0,
      updatedAt: now,
    },
  };
}
