import { adapterError, throwIfAborted } from "../ports/index.ts";
import type {
  ImageInput,
  ImagePreparationOptions,
  ImagePreparationPort,
  PreparedImage,
} from "../ports/image.ts";

export const DEFAULT_BROWSER_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const IMAGE_LIMITS = {
  inlineRequestBytes: 20_000_000,
  localPreparedJpegQuality: 0.85,
  localPreparedMaxDimension: 4_096,
} as const;

export type MetadataStripResult = {
  readonly bytes: Uint8Array;
  readonly metadataRemoved: boolean;
};

export type ImagePreparationOperations = {
  stripMetadata(input: ImageInput): MetadataStripResult;
  resize(
    input: ImageInput,
    maxDimension: number,
    signal?: AbortSignal,
  ): ImageInput | Promise<ImageInput>;
  compress(
    input: ImageInput,
    quality: number,
    signal?: AbortSignal,
  ): ImageInput | Promise<ImageInput>;
};

function isMetadataJpegMarker(marker: number): boolean {
  return (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
}

function readJpegSegmentLength(bytes: Uint8Array, position: number): number {
  if (position + 1 >= bytes.length) {
    throw new Error("JPEG metadata segment is truncated");
  }
  const length = (bytes[position] << 8) | bytes[position + 1];
  if (length < 2 || position + length > bytes.length) {
    throw new Error("JPEG metadata segment is invalid");
  }
  return length;
}

/** Remove APP0-APP15 and COM segments without interpreting JPEG scan bytes. */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("image bytes are not a JPEG");
  }

  const kept: number[] = [0xff, 0xd8];
  let position = 2;
  while (position < bytes.length) {
    if (bytes[position] !== 0xff) throw new Error("JPEG marker is invalid");
    while (position < bytes.length && bytes[position] === 0xff) position += 1;
    if (position >= bytes.length) throw new Error("JPEG marker is truncated");
    const marker = bytes[position++];

    if (marker === 0xd9) {
      kept.push(0xff, marker);
      break;
    }
    if (marker === 0xda) {
      const length = readJpegSegmentLength(bytes, position);
      for (let index = position - 2; index < position + length; index += 1) {
        kept.push(bytes[index]);
      }
      for (let index = position + length; index < bytes.length; index += 1) {
        kept.push(bytes[index]);
      }
      break;
    }

    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(0xff, marker);
      continue;
    }

    const length = readJpegSegmentLength(bytes, position);
    if (!isMetadataJpegMarker(marker)) {
      kept.push(0xff, marker);
      for (let index = position; index < position + length; index += 1) {
        kept.push(bytes[index]);
      }
    }
    position += length;
  }

  return Uint8Array.from(kept);
}

const PNG_SIGNATURE = Uint8Array.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
]);

function matchesPrefix(bytes: Uint8Array, prefix: Uint8Array): boolean {
  return bytes.length >= prefix.length &&
    prefix.every((value, index) => bytes[index] === value);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function writeUint32LittleEndian(value: number): Uint8Array {
  return Uint8Array.from([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

const PNG_METADATA_CHUNKS = new Set([
  "eXIf",
  "iCCP",
  "iTXt",
  "pHYs",
  "sPLT",
  "tEXt",
  "zTXt",
]);

/** Remove PNG chunks that may contain EXIF, location, device, or text data. */
export function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  if (!matchesPrefix(bytes, PNG_SIGNATURE)) {
    throw new Error("image bytes are not a PNG");
  }
  const kept: number[] = [...PNG_SIGNATURE];
  let position = PNG_SIGNATURE.length;
  let foundEnd = false;
  while (position + 12 <= bytes.length) {
    const length = readUint32(bytes, position);
    const end = position + 12 + length;
    if (end > bytes.length) throw new Error("PNG chunk is invalid");
    const type = ascii(bytes, position + 4, 4);
    if (!PNG_METADATA_CHUNKS.has(type)) {
      kept.push(...bytes.slice(position, end));
    }
    position = end;
    if (type === "IEND") {
      foundEnd = true;
      break;
    }
  }
  if (!foundEnd) throw new Error("PNG end chunk is missing");
  return Uint8Array.from(kept);
}

const WEBP_METADATA_CHUNKS = new Set(["EXIF", "XMP ", "ICCP"]);

/** Remove WebP metadata chunks and repair the RIFF byte count. */
export function stripWebpMetadata(bytes: Uint8Array): Uint8Array {
  if (
    bytes.length < 12 || ascii(bytes, 0, 4) !== "RIFF" ||
    ascii(bytes, 8, 4) !== "WEBP"
  ) {
    throw new Error("image bytes are not a WebP");
  }
  const kept: number[] = [
    0x52,
    0x49,
    0x46,
    0x46,
    0,
    0,
    0,
    0,
    0x57,
    0x45,
    0x42,
    0x50,
  ];
  let position = 12;
  while (position + 8 <= bytes.length) {
    const length = readUint32LittleEndian(bytes, position + 4);
    const paddedLength = length + (length % 2);
    const end = position + 8 + paddedLength;
    if (end > bytes.length) throw new Error("WebP chunk is invalid");
    const type = ascii(bytes, position, 4);
    if (!WEBP_METADATA_CHUNKS.has(type)) {
      kept.push(...bytes.slice(position, end));
    }
    position = end;
  }
  if (position !== bytes.length) {
    throw new Error("WebP chunk boundary is invalid");
  }
  const size = writeUint32LittleEndian(kept.length - 8);
  kept.splice(4, 4, ...size);
  return Uint8Array.from(kept);
}

export function stripImageMetadata(input: ImageInput): MetadataStripResult {
  const bytes = input.bytes.slice();
  switch (input.mimeType) {
    case "image/jpeg":
      return { bytes: stripJpegMetadata(bytes), metadataRemoved: true };
    case "image/png":
      return { bytes: stripPngMetadata(bytes), metadataRemoved: true };
    case "image/webp":
      return { bytes: stripWebpMetadata(bytes), metadataRemoved: true };
    default:
      throw new Error("image format is not supported by the browser sanitizer");
  }
}

export function scaleDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { readonly width: number; readonly height: number } {
  if (
    !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 ||
    height <= 0
  ) {
    throw new Error("image dimensions must be positive");
  }
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    throw new Error("image maximum dimension must be positive");
  }
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

function defaultOperations(): ImagePreparationOperations {
  return {
    stripMetadata: stripImageMetadata,
    resize: browserRender("resize"),
    compress: browserRender("compress"),
  };
}

function browserRender(
  mode: "compress" | "resize",
): ImagePreparationOperations["resize"] {
  return async (input, maxDimensionOrQuality, signal) => {
    throwIfAborted(signal);
    if (typeof createImageBitmap !== "function") {
      throw adapterError("unsupported", "image.prepare");
    }
    const blob = new Blob([input.bytes.slice().buffer as ArrayBuffer], {
      type: input.mimeType,
    });
    const bitmap = await createImageBitmap(blob);
    try {
      throwIfAborted(signal);
      const dimensions = mode === "resize"
        ? scaleDimensions(input.width, input.height, maxDimensionOrQuality)
        : { width: input.width, height: input.height };
      const canvas = typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(dimensions.width, dimensions.height)
        : document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) throw adapterError("unsupported", "image.prepare");
      context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
      const outputBlob = "convertToBlob" in canvas
        ? await canvas.convertToBlob({
          type: "image/jpeg",
          quality: mode === "compress" ? maxDimensionOrQuality : 0.85,
        })
        : await canvasToBlob(canvas, 0.85);
      throwIfAborted(signal);
      return {
        bytes: new Uint8Array(await outputBlob.arrayBuffer()),
        height: dimensions.height,
        mimeType: "image/jpeg",
        width: dimensions.width,
      };
    } finally {
      bitmap.close();
    }
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) reject(adapterError("unsupported", "image.prepare"));
        else resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function prepareImage(
  input: ImageInput,
  options: ImagePreparationOptions,
  operations: ImagePreparationOperations = defaultOperations(),
): Promise<PreparedImage> {
  throwIfAborted(options.signal);
  if (
    !DEFAULT_BROWSER_IMAGE_MIME_TYPES.includes(
      input.mimeType as typeof DEFAULT_BROWSER_IMAGE_MIME_TYPES[number],
    )
  ) {
    throw adapterError("unsupported", "image.prepare");
  }
  if (input.bytes.byteLength > IMAGE_LIMITS.inlineRequestBytes) {
    throw adapterError("quota", "image.prepare");
  }
  const stripped = operations.stripMetadata(input);
  const sanitized: ImageInput = { ...input, bytes: stripped.bytes };
  if (!options.enabled) {
    return {
      ...sanitized,
      metadataSanitized: true,
      preparationApplied: false,
    };
  }

  const resized = await operations.resize(
    sanitized,
    IMAGE_LIMITS.localPreparedMaxDimension,
    options.signal,
  );
  throwIfAborted(options.signal);
  const compressed = await operations.compress(
    resized,
    IMAGE_LIMITS.localPreparedJpegQuality,
    options.signal,
  );
  throwIfAborted(options.signal);
  if (compressed.bytes.byteLength > IMAGE_LIMITS.inlineRequestBytes) {
    throw adapterError("quota", "image.prepare");
  }
  return {
    ...compressed,
    metadataSanitized: true,
    preparationApplied: true,
  };
}

export function createImagePreparationPort(
  operations: ImagePreparationOperations = defaultOperations(),
): ImagePreparationPort {
  return {
    prepare: async (input, options) => {
      try {
        return await prepareImage(input, options, operations);
      } catch (error) {
        if (error instanceof Error && error.name === "AdapterError") {
          throw error;
        }
        if (options.signal?.aborted) {
          throw adapterError("aborted", "image.prepare");
        }
        throw adapterError("invalid-request", "image.prepare");
      }
    },
  };
}

export type ObjectUrlRuntime = {
  createObjectURL(object: Blob): string;
  revokeObjectURL(url: string): void;
};

export type EphemeralObjectUrl = {
  readonly url: string;
  release(): void;
};

export function createEphemeralObjectUrl(
  blob: Blob,
  runtime: ObjectUrlRuntime = URL,
): EphemeralObjectUrl {
  const url = runtime.createObjectURL(blob);
  let released = false;
  return {
    url,
    release: () => {
      if (!released) {
        released = true;
        runtime.revokeObjectURL(url);
      }
    },
  };
}

/** Ensure temporary image bytes and preview resources are released on every path. */
export async function withEphemeralImage<T>(
  bytes: Uint8Array,
  operation: () => Promise<T>,
  release?: () => void,
): Promise<T> {
  try {
    return await operation();
  } finally {
    bytes.fill(0);
    release?.();
  }
}
