import {
  stripJpegMetadata,
  stripPngMetadata,
  stripWebpMetadata,
} from "./image.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("JPEG metadata stripping preserves a large scan as binary data", () => {
  const scan = new Uint8Array(8_000_000).fill(0x71);
  const header = new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    0x00,
    0x04,
    0x12,
    0x34,
    0xff,
    0xdb,
    0x00,
    0x04,
    0x56,
    0x78,
    0xff,
    0xda,
    0x00,
    0x02,
  ]);
  const input = new Uint8Array(header.length + scan.length + 2);
  input.set(header);
  input.set(scan, header.length);
  input.set([0xff, 0xd9], input.length - 2);
  const clean = stripJpegMetadata(input);
  if (clean.length !== input.length - 6) {
    throw new Error("Metadata not removed");
  }
  const expected = new Uint8Array(input.length - 6);
  expected.set(input.subarray(0, 2));
  expected.set(input.subarray(8), 2);
  if (!clean.every((byte, index) => byte === expected[index])) {
    throw new Error("JPEG scan or retained headers changed");
  }
  if (input[3] !== 0xe1) throw new Error("Source was modified");
});

Deno.test("PNG and WebP preserve multi-megabyte chunks without argument spreading", () => {
  const payloadLength = 2_000_000;
  const png = new Uint8Array(8 + 12 + payloadLength + 12);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(png.buffer).setUint32(8, payloadLength);
  png.set(new TextEncoder().encode("IDAT"), 12);
  png.fill(0x71, 16, 16 + payloadLength);
  png.set(new TextEncoder().encode("IEND"), 24 + payloadLength);
  const cleanPng = stripPngMetadata(png);
  if (
    !cleanPng.every((byte, index) => byte === png[index]) ||
    cleanPng.length !== png.length
  ) {
    throw new Error("PNG payload changed");
  }
  const webp = new Uint8Array(12 + 8 + payloadLength);
  webp.set(new TextEncoder().encode("RIFF"));
  new DataView(webp.buffer).setUint32(4, webp.length - 8, true);
  webp.set(new TextEncoder().encode("WEBPVP8 "), 8);
  new DataView(webp.buffer).setUint32(16, payloadLength, true);
  webp.fill(0x71, 20);
  const cleanWebp = stripWebpMetadata(webp);
  if (
    !cleanWebp.every((byte, index) => byte === webp[index]) ||
    cleanWebp.length !== webp.length
  ) {
    throw new Error("WebP payload changed");
  }
});
