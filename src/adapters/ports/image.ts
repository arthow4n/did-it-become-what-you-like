import type { OperationOptions } from "./common.ts";

export type ImageInput = {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
};

export type ImagePreparationOptions = OperationOptions & {
  readonly enabled: boolean;
};

export type PreparedImage = {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly metadataSanitized: true;
  readonly preparationApplied: boolean;
};

export interface ImagePreparationPort {
  prepare(
    input: ImageInput,
    options: ImagePreparationOptions,
  ): Promise<PreparedImage>;
}
