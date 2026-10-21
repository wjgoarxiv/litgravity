import { inflateSync } from "node:zlib";

import { VisualQaError } from "./errors.mjs";
import { readPngChunks } from "./png-chunks.mjs";

const MAX_AXIS = 16_384;
const MAX_PIXELS = 64 * 1024 * 1024;
const MAX_DECODED_BYTES = 256 * 1024 * 1024;

function channelsFor(colorType) {
  const channels = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]).get(colorType);
  if (!channels) throw new VisualQaError("PNG_UNSUPPORTED", `unsupported PNG color type ${colorType}`);
  return channels;
}

function parseHeader(data) {
  if (data.length !== 13) throw new VisualQaError("PNG_HEADER_INVALID", "IHDR must contain 13 bytes");
  const width = data.readUInt32BE(0);
  const height = data.readUInt32BE(4);
  const bitDepth = data[8];
  const colorType = data[9];
  if (width < 1 || height < 1 || width > MAX_AXIS || height > MAX_AXIS) {
    throw new VisualQaError("PNG_RESOURCE_LIMIT", "PNG_RESOURCE_LIMIT: dimensions exceed 16,384");
  }
  const pixels = width * height;
  if (pixels > MAX_PIXELS || pixels * 4 > MAX_DECODED_BYTES) {
    throw new VisualQaError("PNG_RESOURCE_LIMIT", "PNG_RESOURCE_LIMIT: decoded storage exceeds 64 MP / 256 MiB");
  }
  if (bitDepth !== 8 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
    throw new VisualQaError("PNG_UNSUPPORTED", "only non-interlaced 8-bit deflate PNG is supported");
  }
  return { width, height, colorType, channels: channelsFor(colorType) };
}

function assertPeakBudget(inputBytes, idatBytes, header) {
  const rowBytes = header.width * header.channels;
  const inflatedBytes = header.height * (rowBytes + 1);
  const pixelBytes = header.width * header.height * header.channels;
  const rgbaBytes = header.width * header.height * 4;
  const peakBytes = inputBytes + idatBytes + inflatedBytes
    + (2 * rowBytes) + pixelBytes + rgbaBytes;
  if (!Number.isSafeInteger(peakBytes) || peakBytes > MAX_DECODED_BYTES) {
    throw new VisualQaError(
      "PNG_RESOURCE_LIMIT",
      "PNG_RESOURCE_LIMIT: peak decode allocation exceeds 256 MiB",
    );
  }
  return { rowBytes, inflatedBytes, pixelBytes };
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperDistance) return left;
  return aboveDistance <= upperDistance ? above : upperLeft;
}

function unfilterRow(filter, input, previous, bytesPerPixel) {
  const output = Buffer.allocUnsafe(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index] ?? 0;
    const left = index >= bytesPerPixel ? output[index - bytesPerPixel] ?? 0 : 0;
    const above = previous?.[index] ?? 0;
    const upperLeft = index >= bytesPerPixel ? previous?.[index - bytesPerPixel] ?? 0 : 0;
    if (filter === 0) output[index] = raw;
    else if (filter === 1) output[index] = (raw + left) & 0xff;
    else if (filter === 2) output[index] = (raw + above) & 0xff;
    else if (filter === 3) output[index] = (raw + Math.floor((left + above) / 2)) & 0xff;
    else if (filter === 4) output[index] = (raw + paeth(left, above, upperLeft)) & 0xff;
    else throw new VisualQaError("PNG_FILTER_INVALID", `unsupported PNG filter ${filter}`);
  }
  return output;
}

function decodeScanlines(idat, header, allocation) {
  const { rowBytes, inflatedBytes: expectedBytes, pixelBytes } = allocation;
  let inflated;
  try {
    inflated = inflateSync(idat, { maxOutputLength: expectedBytes + 1 });
  } catch (error) {
    throw new VisualQaError("PNG_DECOMPRESSION_INVALID", `bounded PNG inflate failed: ${error.message}`);
  }
  if (inflated.length !== expectedBytes) {
    throw new VisualQaError("PNG_TRUNCATED", "PNG_TRUNCATED: decoded scanline length mismatch");
  }
  const pixels = Buffer.allocUnsafe(pixelBytes);
  let previous;
  for (let row = 0; row < header.height; row += 1) {
    const start = row * (rowBytes + 1);
    const decoded = unfilterRow(
      inflated[start] ?? 0,
      inflated.subarray(start + 1, start + 1 + rowBytes),
      previous,
      header.channels,
    );
    decoded.copy(pixels, row * rowBytes);
    previous = decoded;
  }
  return pixels;
}

function rgbaPixels(pixels, header) {
  const rgba = new Uint8Array(header.width * header.height * 4);
  let transparent = false;
  for (let pixel = 0; pixel < header.width * header.height; pixel += 1) {
    const source = pixel * header.channels;
    const target = pixel * 4;
    const gray = pixels[source] ?? 0;
    rgba[target] = header.channels < 3 ? gray : pixels[source] ?? 0;
    rgba[target + 1] = header.channels < 3 ? gray : pixels[source + 1] ?? 0;
    rgba[target + 2] = header.channels < 3 ? gray : pixels[source + 2] ?? 0;
    const alpha = header.channels === 2
      ? pixels[source + 1] ?? 255
      : header.channels === 4 ? pixels[source + 3] ?? 255 : 255;
    rgba[target + 3] = alpha;
    if (alpha < 255) transparent = true;
  }
  return { rgba, transparent };
}

export function decodePng(buffer) {
  const chunks = readPngChunks(buffer);
  const header = parseHeader(chunks[0].data);
  const idat = chunks.filter(({ type }) => type === "IDAT");
  if (idat.length === 0) throw new VisualQaError("PNG_TRUNCATED", "PNG_TRUNCATED: missing IDAT");
  const idatBytes = idat.reduce((total, { data }) => total + data.length, 0);
  const allocation = assertPeakBudget(buffer.length, idatBytes, header);
  const pixels = decodeScanlines(
    Buffer.concat(idat.map(({ data }) => data), idatBytes),
    header,
    allocation,
  );
  const normalized = rgbaPixels(pixels, header);
  return {
    width: header.width,
    height: header.height,
    rgba: normalized.rgba,
    hasAlphaChannel: header.colorType === 4 || header.colorType === 6,
    hasTransparentPixels: normalized.transparent,
  };
}
