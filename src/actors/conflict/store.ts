import {
  adapterError,
  type IdPort,
  type JsonValue,
  type LocalPort,
} from "../../adapters/ports/index.ts";
import {
  chooseCanonicalResolution,
  groupConflictObservations,
  mergeConflictStates,
  resolveConflict,
} from "../../domain/conflict/merge.ts";
import {
  type ConflictJsonObject,
  type ConflictObservation,
  type ConflictResolutionRecord,
  type ConflictResolutionRequest,
  type ConflictResolutionResult,
  type ConflictState,
  emptyConflictState,
} from "../../domain/conflict/types.ts";

export const CONFLICT_STATE_KEY = "s403:conflict-state";
export const CONFLICT_WORKFLOW_KEY = "s403:conflict-workflow";
export const CONFLICT_REVISION_KEY_PREFIX = "s403:resolution:";
export const CONFLICT_TOMBSTONE_KEY_PREFIX = "s403:tombstone:";

export type ConflictWorkflowSnapshot = {
  readonly type: "s403-conflict-workflow";
  readonly version: 1;
  readonly state: ConflictState;
  readonly activeGroupId: string | null;
  readonly selection:
    | (ConflictResolutionRequest & { readonly groupId: string })
    | null;
  readonly failureCode?: string;
};

export type ConflictHydration = {
  readonly state: ConflictState;
  readonly activeGroupId: string | null;
  readonly selection: ConflictWorkflowSnapshot["selection"];
  readonly failureCode?: string;
};

export type ConflictStoreOptions = {
  readonly local: LocalPort;
  readonly deviceId: string;
  readonly now: () => string;
  readonly ids: Pick<IdPort, "next">;
};

export type ConflictStoreCommitInput = {
  readonly groupId: string;
  readonly request: ConflictResolutionRequest;
};

function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseState(value: unknown): ConflictState {
  if (
    !isObject(value) || value.type !== "s403-conflict-state" ||
    value.version !== 1 || !Array.isArray(value.groups) ||
    !Array.isArray(value.resolutions) || !isObject(value.progress)
  ) {
    throw adapterError("corrupt-data", "conflict.state.read");
  }
  return clone(value as unknown as ConflictState);
}

function parseWorkflow(value: unknown): ConflictWorkflowSnapshot {
  if (
    !isObject(value) || value.type !== "s403-conflict-workflow" ||
    value.version !== 1 || !isObject(value.state) ||
    typeof value.activeGroupId !== "string" && value.activeGroupId !== null
  ) {
    throw adapterError("corrupt-data", "conflict.workflow.read");
  }
  return clone(value as unknown as ConflictWorkflowSnapshot);
}

function updatedState(
  state: ConflictState,
  now: string,
  phase: ConflictState["progress"]["phase"],
  failureCode?: string,
): ConflictState {
  return {
    ...state,
    progress: {
      phase,
      unresolvedCount: state.groups.length,
      completedCount: state.progress.completedCount,
      updatedAt: now,
      ...(failureCode === undefined ? {} : { failureCode }),
    },
  };
}

function workflowValue(
  state: ConflictState,
  activeGroupId: string | null,
  selection: ConflictWorkflowSnapshot["selection"],
  failureCode?: string,
): ConflictWorkflowSnapshot {
  return {
    type: "s403-conflict-workflow",
    version: 1,
    state: clone(state),
    activeGroupId,
    selection: selection === null ? null : clone(selection),
    ...(failureCode === undefined ? {} : { failureCode }),
  };
}

function revisionKey(id: string): string {
  return `${CONFLICT_REVISION_KEY_PREFIX}${id}`;
}

function tombstoneKey(recordId: string): string {
  return `${CONFLICT_TOMBSTONE_KEY_PREFIX}${recordId}`;
}

function resultFromResolution(
  resolution: ConflictResolutionRecord,
  alreadyResolved: boolean,
): ConflictResolutionResult {
  return {
    groupId: resolution.groupId,
    resolutionRevision: clone(resolution.resolutionRevision),
    ...(resolution.tombstone === undefined
      ? {}
      : { tombstone: clone(resolution.tombstone) }),
    ...(resolution.resolutionRevision.record === undefined
      ? {}
      : { record: clone(resolution.resolutionRevision.record) }),
    alreadyResolved,
  };
}

function resolutionRecord(
  result: ConflictResolutionResult,
): ConflictResolutionRecord {
  return {
    groupId: result.groupId,
    resolutionRevision: clone(result.resolutionRevision),
    ...(result.tombstone === undefined
      ? {}
      : { tombstone: clone(result.tombstone) }),
  };
}

function allGroups(
  state: ConflictState,
  observations: readonly ConflictObservation[],
): ConflictState {
  const incoming = groupConflictObservations(observations);
  const observed: ConflictState = {
    ...state,
    groups: [...state.groups, ...incoming],
  };
  return mergeConflictStates(state, observed);
}

export class ConflictStore {
  private readonly options: ConflictStoreOptions;

  constructor(options: ConflictStoreOptions) {
    this.options = options;
  }

  async load(): Promise<ConflictHydration> {
    const value = await this.options.local.transaction(
      "readonly",
      async (transaction) => {
        const state = await transaction.get<JsonValue>(
          "sync-metadata",
          CONFLICT_STATE_KEY,
        );
        const workflow = await transaction.get<JsonValue>(
          "workflow-snapshots",
          CONFLICT_WORKFLOW_KEY,
        );
        return { state, workflow };
      },
    );
    const state = value.state === undefined
      ? emptyConflictState(this.options.now())
      : parseState(value.state);
    if (value.workflow === undefined) {
      return { state, activeGroupId: null, selection: null };
    }
    const workflow = parseWorkflow(value.workflow);
    return {
      state: mergeConflictStates(state, workflow.state),
      activeGroupId: workflow.activeGroupId,
      selection: workflow.selection,
      ...(workflow.failureCode === undefined
        ? {}
        : { failureCode: workflow.failureCode }),
    };
  }

  async ingest(
    observations: readonly ConflictObservation[],
  ): Promise<ConflictState> {
    if (observations.length === 0) return (await this.load()).state;
    return await this.options.local.transaction(
      "readwrite",
      async (transaction) => {
        const existing = await transaction.get<JsonValue>(
          "sync-metadata",
          CONFLICT_STATE_KEY,
        );
        const current = existing === undefined
          ? emptyConflictState(this.options.now())
          : parseState(existing);
        const merged = allGroups(current, observations);
        const next = updatedState(
          merged,
          this.options.now(),
          merged.groups.length === 0 ? "resolved" : "reviewing",
        );
        await this.writeState(transaction, next, null, null);
        return next;
      },
    );
  }

  async saveWorkflow(input: {
    readonly state: ConflictState;
    readonly activeGroupId: string | null;
    readonly selection: ConflictWorkflowSnapshot["selection"];
    readonly failureCode?: string;
  }): Promise<ConflictState> {
    return await this.options.local.transaction(
      "readwrite",
      async (transaction) => {
        const state = updatedState(
          input.state,
          this.options.now(),
          input.failureCode === undefined
            ? input.state.groups.length === 0 ? "idle" : "reviewing"
            : "failed",
          input.failureCode,
        );
        await this.writeState(
          transaction,
          state,
          input.activeGroupId,
          input.selection,
          input.failureCode,
        );
        return state;
      },
    );
  }

  async commit(
    input: ConflictStoreCommitInput,
  ): Promise<ConflictResolutionResult> {
    return await this.options.local.transaction(
      "readwrite",
      async (transaction) => {
        const existingValue = await transaction.get<JsonValue>(
          "sync-metadata",
          CONFLICT_STATE_KEY,
        );
        const current = existingValue === undefined
          ? emptyConflictState(this.options.now())
          : parseState(existingValue);
        const group = current.groups.find((entry) =>
          entry.id === input.groupId
        );
        const prior = current.resolutions.find((entry) =>
          entry.groupId === input.groupId
        );
        if (group === undefined && prior !== undefined) {
          return resultFromResolution(prior, true);
        }
        if (group === undefined) {
          throw adapterError("not-found", "conflict.group.commit");
        }
        const currentValue = await transaction.get<JsonValue>(
          "records",
          group.recordId,
        );
        const currentRecord = isObject(currentValue)
          ? currentValue as unknown as ConflictJsonObject
          : undefined;
        const resolutionId = `s403-${this.options.ids.next("revision")}`;
        const result = resolveConflict({
          group,
          request: input.request,
          revisionId: resolutionId,
          deviceId: this.options.deviceId,
          recordedAt: this.options.now(),
          ...(currentRecord === undefined ? {} : { currentRecord }),
        });
        if (result.record === undefined) {
          await transaction.delete("records", group.recordId);
          if (result.tombstone !== undefined) {
            await transaction.put(
              "sync-metadata",
              tombstoneKey(group.recordId),
              asJsonValue(result.tombstone),
            );
          }
        } else {
          await transaction.put(
            "records",
            group.recordId,
            asJsonValue(result.record),
          );
          await transaction.delete(
            "sync-metadata",
            tombstoneKey(group.recordId),
          );
        }
        await transaction.put(
          "sync-metadata",
          revisionKey(result.resolutionRevision.id),
          asJsonValue(result.resolutionRevision),
        );
        const committed: ConflictState = updatedState(
          {
            ...current,
            groups: current.groups.filter((entry) => entry.id !== group.id),
            resolutions: [
              ...current.resolutions,
              resolutionRecord(result),
            ].sort((left, right) =>
              compareCodeUnits(left.groupId, right.groupId)
            ),
            progress: {
              ...current.progress,
              completedCount: current.progress.completedCount + 1,
            },
          },
          this.options.now(),
          current.groups.length === 1 ? "resolved" : "reviewing",
        );
        await this.writeState(transaction, committed, null, null);
        return result;
      },
    );
  }

  async reconcile(remote: ConflictState): Promise<ConflictState> {
    return await this.options.local.transaction(
      "readwrite",
      async (transaction) => {
        const currentValue = await transaction.get<JsonValue>(
          "sync-metadata",
          CONFLICT_STATE_KEY,
        );
        const current = currentValue === undefined
          ? emptyConflictState(this.options.now())
          : parseState(currentValue);
        const merged = mergeConflictStates(current, remote);
        const resolutions = new Map<string, ConflictResolutionRecord>();
        for (const resolution of merged.resolutions) {
          const existing = resolutions.get(resolution.groupId);
          resolutions.set(
            resolution.groupId,
            existing === undefined
              ? resolution
              : chooseCanonicalResolution(existing, resolution),
          );
        }
        for (const resolution of resolutions.values()) {
          const record = resolution.resolutionRevision.record;
          if (resolution.resolutionRevision.deleted) {
            await transaction.delete(
              "records",
              resolution.resolutionRevision.recordId,
            );
            if (resolution.tombstone !== undefined) {
              await transaction.put(
                "sync-metadata",
                tombstoneKey(resolution.resolutionRevision.recordId),
                asJsonValue(resolution.tombstone),
              );
            }
          } else if (record !== undefined) {
            await transaction.put(
              "records",
              resolution.resolutionRevision.recordId,
              asJsonValue(record),
            );
            await transaction.delete(
              "sync-metadata",
              tombstoneKey(resolution.resolutionRevision.recordId),
            );
          }
          await transaction.put(
            "sync-metadata",
            revisionKey(resolution.resolutionRevision.id),
            asJsonValue(resolution.resolutionRevision),
          );
        }
        const next = updatedState(
          merged,
          this.options.now(),
          merged.groups.length === 0 ? "resolved" : "reviewing",
        );
        await this.writeState(transaction, next, null, null);
        return next;
      },
    );
  }

  private async writeState(
    transaction: Parameters<Parameters<LocalPort["transaction"]>[1]>[0],
    state: ConflictState,
    activeGroupId: string | null,
    selection: ConflictWorkflowSnapshot["selection"],
    failureCode?: string,
  ): Promise<void> {
    await transaction.put(
      "sync-metadata",
      CONFLICT_STATE_KEY,
      asJsonValue(state),
    );
    await transaction.put(
      "workflow-snapshots",
      CONFLICT_WORKFLOW_KEY,
      asJsonValue(workflowValue(state, activeGroupId, selection, failureCode)),
    );
  }
}
