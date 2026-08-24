import type { OperationOptions } from "./common.ts";

export type UpdateState =
  | "unsupported"
  | "current"
  | "update-available"
  | "installing";

export interface UpdateInstallPort {
  state(): UpdateState;
  subscribe(listener: (state: UpdateState) => void): () => void;
  install(options?: OperationOptions): Promise<void>;
  reload(options?: OperationOptions): Promise<void>;
}
