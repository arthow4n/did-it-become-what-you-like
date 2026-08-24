import type { OperationOptions } from "./common.ts";

export type FileDescriptor = {
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
};

export type FilePayload = {
  readonly name: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
};

export interface FileSelectionPort {
  pickImage(options?: OperationOptions): Promise<FilePayload | undefined>;
}

export type SharePayload = {
  readonly title: string;
  readonly text?: string;
  readonly file?: FilePayload;
};

export interface FileSharePort {
  save(payload: FilePayload, options?: OperationOptions): Promise<void>;
  share(
    payload: SharePayload,
    options?: OperationOptions,
  ): Promise<"shared" | "saved">;
}
