/// <reference path="../deno.d.ts" />

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export async function extractZipArchive(
  archive: Uint8Array,
  destination: string,
): Promise<void> {
  const end = findEndOfCentralDirectory(archive);
  const view = new DataView(
    archive.buffer,
    archive.byteOffset,
    archive.byteLength,
  );
  const entryCount = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (centralOffset + centralSize > archive.byteLength) {
    throw new Error("Chrome archive has an invalid central directory.");
  }

  let cursor = centralOffset;
  const decoder = new TextDecoder();
  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(view, cursor) !== CENTRAL_SIGNATURE) {
      throw new Error(
        `Chrome archive has an invalid entry at offset ${cursor}.`,
      );
    }
    const compression = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(
      archive.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    cursor += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    const safeName = safeArchivePath(name);
    if (uncompressedSize > 512 * 1024 * 1024) {
      throw new Error(`Refusing oversized Chrome archive entry: ${name}`);
    }
    if (readUint32(view, localOffset) !== LOCAL_SIGNATURE) {
      throw new Error(`Chrome archive has an invalid local entry for ${name}.`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > archive.byteLength) {
      throw new Error(`Chrome archive truncates ${name}.`);
    }
    const compressed = archive.subarray(dataStart, dataEnd);
    const content = compression === 0
      ? compressed
      : compression === 8
      ? new Uint8Array(
        await new Response(
          new Response(toArrayBuffer(compressed)).body!.pipeThrough(
            new DecompressionStream("deflate-raw"),
          ),
        ).arrayBuffer(),
      )
      : (() => {
        throw new Error(
          `Unsupported Chrome archive compression method ${compression}.`,
        );
      })();
    if (content.byteLength !== uncompressedSize) {
      throw new Error(`Chrome archive size mismatch for ${name}.`);
    }
    const outputPath = `${destination}/${safeName}`;
    await Deno.mkdir(parentDirectory(outputPath), { recursive: true });
    await Deno.writeFile(outputPath, content);
  }
}

function findEndOfCentralDirectory(archive: Uint8Array): number {
  const view = new DataView(
    archive.buffer,
    archive.byteOffset,
    archive.byteLength,
  );
  const start = Math.max(0, archive.byteLength - 65_557);
  for (let offset = archive.byteLength - 22; offset >= start; offset -= 1) {
    if (readUint32(view, offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("Chrome archive has no end-of-central-directory record.");
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function safeArchivePath(name: string): string {
  const normalized = name.replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Refusing unsafe Chrome archive path: ${name}`);
  }
  return normalized;
}

function parentDirectory(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "." : path.slice(0, separator);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
