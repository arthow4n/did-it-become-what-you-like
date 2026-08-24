import type { OperationOptions } from "./common.ts";

export type UpdateCheckOutput =
  | { readonly status: "up-to-date" }
  | { readonly status: "update-ready"; readonly version: string };

export type UpdateState =
  | "unsupported"
  | "current"
  | "update-available"
  | "installing";

export interface UpdateInstallPort {
  state(): UpdateState;
  subscribe(listener: (state: UpdateState) => void): () => void;
  check(options?: OperationOptions): Promise<UpdateCheckOutput>;
  install(options?: OperationOptions): Promise<void>;
  reload(options?: OperationOptions): Promise<void>;
}
