import type { OperationOptions } from "./common.ts";

export const DRIVE_SCOPES = ["appDataFolder"] as const;
export type DriveScope = typeof DRIVE_SCOPES[number];

export type DriveAuthState = "signed-out" | "authorizing" | "authorized";

export type DriveAuthSession = {
  readonly accountId: string;
  readonly scopes: readonly DriveScope[];
};

export interface DriveAuthorizationPort {
  status(): DriveAuthState;
  authorize(options?: OperationOptions): Promise<DriveAuthSession>;
  disconnect(options?: OperationOptions): Promise<void>;
  deleteEverywhere(options?: OperationOptions): Promise<void>;
}

export type DriveFile = {
  readonly id: string;
  readonly name: string;
  readonly body: string;
  readonly etag: string;
  readonly updatedAt: string;
};

export type DriveWriteRequest = {
  readonly name: string;
  readonly body: string;
  readonly expectedEtag?: string;
};

export interface DriveTransportPort {
  listAppData(options?: OperationOptions): Promise<readonly DriveFile[]>;
  readAppData(
    name: string,
    options?: OperationOptions,
  ): Promise<DriveFile | undefined>;
  writeAppData(
    request: DriveWriteRequest,
    options?: OperationOptions,
  ): Promise<DriveFile>;
  deleteAppData(
    name: string,
    expectedEtag?: string,
    options?: OperationOptions,
  ): Promise<void>;
}
