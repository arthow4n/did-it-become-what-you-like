import {
  createImagePreparationPort,
  IMAGE_LIMITS,
  scaleDimensions,
  stripImageMetadata,
  stripJpegMetadata,
} from "../../adapters/gemini/index.ts";
import {
  type ImageInput,
  type ImagePreparationOptions,
  type ImagePreparationPort,
  type PreparedImage,
  throwIfAborted,
} from "../../adapters/ports/index.ts";

export { createImagePreparationPort };

export function fileMediaType(file: File): string {
  if (file.type) return file.type;
  if (file.name.toLowerCase().endsWith(".pdf")) return "application/pdf";
  return "";
}

async function canvasExportBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  if (
    "convertToBlob" in canvas &&
    typeof (canvas as OffscreenCanvas).convertToBlob === "function"
  ) {
    return await (canvas as OffscreenCanvas).convertToBlob(
      quality !== undefined ? { type: mimeType, quality } : { type: mimeType },
    );
  }
  if (
    "toBlob" in canvas &&
    typeof (canvas as HTMLCanvasElement).toBlob === "function"
  ) {
    return await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => {
          if (!blob) reject(new Error("Failed to export canvas blob"));
          else resolve(blob);
        },
        mimeType,
        quality,
      );
    });
  }
  throw new Error("Canvas blob export is unsupported in this environment.");
}

function toBlobFile(
  blob: Blob,
  name: string,
  type: string,
  lastModified = Date.now(),
): File {
  try {
    const file = new File([blob], name, { type, lastModified });
    if (file instanceof Blob) return file;
  } catch {
    // Fall back to runtime Blob augmentation
  }
  const fileBlob = blob.slice(0, blob.size, type) as unknown as File;
  Object.defineProperties(fileBlob, {
    name: { value: name, configurable: true },
    lastModified: { value: lastModified, configurable: true },
    webkitRelativePath: { value: "", configurable: true },
  });
  return fileBlob;
}

export async function rotateImageFile(
  file: File,
  degrees: number,
): Promise<File> {
  const mediaType = fileMediaType(file);
  const fileName = file.name || "receipt-image";
  const normalizedDegrees = ((degrees % 360) + 360) % 360;
  if (mediaType === "application/pdf" || normalizedDegrees === 0) return file;
  if (typeof createImageBitmap !== "function") {
    return toBlobFile(
      new Blob([await file.arrayBuffer()], {
        type: file.type || "image/jpeg",
      }),
      fileName,
      file.type || "image/jpeg",
    );
  }

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const isSideways = normalizedDegrees === 90 || normalizedDegrees === 270;
      const targetWidth = isSideways ? bitmap.height : bitmap.width;
      const targetHeight = isSideways ? bitmap.width : bitmap.height;
      const canvas = typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(targetWidth, targetHeight)
        : document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d") as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      if (!context || !("drawImage" in context)) {
        return toBlobFile(
          new Blob([await file.arrayBuffer()], {
            type: file.type || "image/jpeg",
          }),
          fileName,
          file.type || "image/jpeg",
        );
      }
      if (normalizedDegrees === 90) {
        context.translate(targetWidth, 0);
        context.rotate(Math.PI / 2);
      } else if (normalizedDegrees === 180) {
        context.translate(targetWidth, targetHeight);
        context.rotate(Math.PI);
      } else if (normalizedDegrees === 270) {
        context.translate(0, targetHeight);
        context.rotate(-Math.PI / 2);
      }
      context.drawImage(bitmap, 0, 0);

      const mimeType = file.type === "image/png"
        ? "image/png"
        : file.type === "image/webp"
        ? "image/webp"
        : "image/jpeg";
      const quality = mimeType === "image/png" ? undefined : 0.95;

      const blob = await canvasExportBlob(canvas, mimeType, quality);
      return toBlobFile(blob, fileName, mimeType);
    } finally {
      bitmap.close();
    }
  } catch {
    return toBlobFile(
      new Blob([await file.arrayBuffer()], {
        type: file.type || "image/jpeg",
      }),
      fileName,
      file.type || "image/jpeg",
    );
  }
}

function safeStripJpeg(bytes: Uint8Array): Uint8Array {
  try {
    return stripJpegMetadata(bytes);
  } catch {
    return bytes;
  }
}

function safeStripPdf(bytes: Uint8Array): Uint8Array {
  try {
    return stripImageMetadata({
      bytes,
      mimeType: "application/pdf",
      width: 1,
      height: 1,
    }).bytes;
  } catch {
    return bytes;
  }
}

export async function preEncodeImage(
  file: File,
  degrees: number,
  signal?: AbortSignal,
): Promise<ImageInput> {
  throwIfAborted(signal);
  const mediaType = fileMediaType(file);
  const normalizedDegrees = ((degrees % 360) + 360) % 360;

  if (mediaType === "application/pdf") {
    const buffer = await file.arrayBuffer();
    throwIfAborted(signal);
    const cleanBytes = safeStripPdf(new Uint8Array(buffer));
    return {
      bytes: cleanBytes,
      mimeType: "application/pdf",
      width: 1,
      height: 1,
    };
  }

  if (typeof createImageBitmap !== "function") {
    const buffer = await file.arrayBuffer();
    throwIfAborted(signal);
    const rawBytes = new Uint8Array(buffer);
    const cleanBytes = mediaType === "image/jpeg"
      ? safeStripJpeg(rawBytes)
      : rawBytes;
    return {
      bytes: cleanBytes,
      mimeType: mediaType || "image/jpeg",
      width: 1,
      height: 1,
    };
  }

  try {
    const bitmap = await createImageBitmap(file);
    try {
      throwIfAborted(signal);
      const isSideways = normalizedDegrees === 90 || normalizedDegrees === 270;
      const unscaledWidth = isSideways ? bitmap.height : bitmap.width;
      const unscaledHeight = isSideways ? bitmap.width : bitmap.height;

      if (unscaledWidth <= 0 || unscaledHeight <= 0) {
        const buffer = await file.arrayBuffer();
        return {
          bytes: new Uint8Array(buffer),
          mimeType: mediaType || "image/jpeg",
          width: 1,
          height: 1,
        };
      }

      const { width: targetWidth, height: targetHeight } = scaleDimensions(
        unscaledWidth,
        unscaledHeight,
        IMAGE_LIMITS.localPreparedMaxDimension,
      );

      const canvas = typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(targetWidth, targetHeight)
        : document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d") as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;

      if (!context || !("drawImage" in context)) {
        const buffer = await file.arrayBuffer();
        throwIfAborted(signal);
        return {
          bytes: new Uint8Array(buffer),
          mimeType: mediaType || "image/jpeg",
          width: targetWidth,
          height: targetHeight,
        };
      }

      if (normalizedDegrees === 90) {
        context.translate(targetWidth, 0);
        context.rotate(Math.PI / 2);
        context.drawImage(bitmap, 0, 0, targetHeight, targetWidth);
      } else if (normalizedDegrees === 180) {
        context.translate(targetWidth, targetHeight);
        context.rotate(Math.PI);
        context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      } else if (normalizedDegrees === 270) {
        context.translate(0, targetHeight);
        context.rotate(-Math.PI / 2);
        context.drawImage(bitmap, 0, 0, targetHeight, targetWidth);
      } else {
        context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      }

      throwIfAborted(signal);
      const blob = await canvasExportBlob(
        canvas,
        "image/jpeg",
        IMAGE_LIMITS.localPreparedJpegQuality,
      );
      throwIfAborted(signal);
      const rawBytes = new Uint8Array(await blob.arrayBuffer());
      const cleanBytes = safeStripJpeg(rawBytes);

      return {
        bytes: cleanBytes,
        mimeType: "image/jpeg",
        width: targetWidth,
        height: targetHeight,
      };
    } finally {
      bitmap.close();
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    const buffer = await file.arrayBuffer();
    const rawBytes = new Uint8Array(buffer);
    const cleanBytes = mediaType === "image/jpeg"
      ? safeStripJpeg(rawBytes)
      : rawBytes;
    return {
      bytes: cleanBytes,
      mimeType: mediaType || "image/jpeg",
      width: 1,
      height: 1,
    };
  }
}

export type CachedImagePreparationPort = ImagePreparationPort & {
  readonly cache: WeakMap<ImageInput, PreparedImage>;
};

export function createCachedImagePreparationPort(
  base: ImagePreparationPort,
  cache = new WeakMap<ImageInput, PreparedImage>(),
): CachedImagePreparationPort {
  return {
    cache,
    prepare: async (
      input: ImageInput,
      options: ImagePreparationOptions,
    ): Promise<PreparedImage> => {
      const cached = cache.get(input);
      if (cached) {
        throwIfAborted(options.signal);
        return options.enabled
          ? cached
          : { ...cached, preparationApplied: false };
      }
      return await base.prepare(input, options);
    },
  };
}
