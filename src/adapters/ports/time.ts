import type { StableId } from "../../domain/index.ts";
import type { OperationOptions } from "./common.ts";

export interface ClockPort {
  now(): string;
  delay(milliseconds: number, options?: OperationOptions): Promise<void>;
}

export type IdKind =
  | "project"
  | "category"
  | "expense"
  | "receipt"
  | "device"
  | "revision"
  | "change"
  | "workflow";

export interface IdPort {
  next(kind: IdKind): StableId;
}
