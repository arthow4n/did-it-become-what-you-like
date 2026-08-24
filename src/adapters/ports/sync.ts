import type { PortableDataset, StableId } from "../../domain/index.ts";
import type { JsonValue, OperationOptions } from "./common.ts";

export type CausalChange = {
  readonly id: StableId;
  readonly actorId: StableId;
  readonly sequence: number;
  readonly parents: readonly StableId[];
  readonly payload: JsonValue;
};

export type CausalSnapshot = {
  readonly generation: number;
  readonly heads: readonly StableId[];
  readonly changes: readonly CausalChange[];
  readonly dataset: PortableDataset;
};

export type CausalSyncPacket = {
  readonly generation: number;
  readonly heads: readonly StableId[];
  readonly changes: readonly CausalChange[];
};

export type SyncConflict = {
  readonly id: StableId;
  readonly recordType: string;
  readonly recordId: StableId;
  readonly local: JsonValue;
  readonly remote: JsonValue;
  readonly relatedChangeIds: readonly StableId[];
};

export type CausalApplyResult = {
  readonly snapshot: CausalSnapshot;
  readonly appliedChangeIds: readonly StableId[];
  readonly conflicts: readonly SyncConflict[];
};

export interface CausalSyncPort {
  read(options?: OperationOptions): Promise<CausalSnapshot>;
  exportPacket(options?: OperationOptions): Promise<CausalSyncPacket>;
  applyPacket(
    packet: CausalSyncPacket,
    options?: OperationOptions,
  ): Promise<CausalApplyResult>;
}
