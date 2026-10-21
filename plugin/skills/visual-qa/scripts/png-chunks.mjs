import { VisualQaError } from "./errors.mjs";

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const PNG_MAX_BYTES = 25 * 1024 * 1024;

function crcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function readPngChunks(buffer) {
  if (buffer.length > PNG_MAX_BYTES) {
    throw new VisualQaError("PNG_FILE_TOO_LARGE", "PNG_FILE_TOO_LARGE: maximum 25 MiB");
  }
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new VisualQaError("PNG_SIGNATURE_INVALID", "PNG signature is invalid");
  }
  const chunks = [];
  const criticalCounts = new Map();
  let idatClosed = false;
  let seenIdat = false;
  let offset = 8;
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) {
      throw new VisualQaError("PNG_TRUNCATED", "PNG_TRUNCATED: incomplete chunk header or CRC");
    }
    const length = buffer.readUInt32BE(offset);
    const typeBytes = buffer.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/u.test(type)) {
      throw new VisualQaError("PNG_CHUNK_TYPE_INVALID", "PNG chunk type must be four ASCII letters");
    }
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const nextOffset = dataEnd + 4;
    if (dataEnd < dataStart || nextOffset > buffer.length) {
      throw new VisualQaError("PNG_TRUNCATED", `PNG_TRUNCATED: incomplete ${type} chunk`);
    }
    const data = buffer.subarray(dataStart, dataEnd);
    const expectedCrc = buffer.readUInt32BE(dataEnd);
    const actualCrc = crc32(Buffer.concat([typeBytes, data]));
    if (actualCrc !== expectedCrc) {
      throw new VisualQaError("PNG_CRC_MISMATCH", `PNG_CRC_MISMATCH: ${type}`);
    }
    const critical = (typeBytes[0] & 0x20) === 0;
    if (critical && !["IHDR", "PLTE", "IDAT", "IEND"].includes(type)) {
      throw new VisualQaError("PNG_UNKNOWN_CRITICAL_CHUNK", `unknown critical chunk: ${type}`);
    }
    if (critical && type !== "IDAT") {
      const count = (criticalCounts.get(type) ?? 0) + 1;
      criticalCounts.set(type, count);
      if (count > 1) {
        throw new VisualQaError("PNG_DUPLICATE_CRITICAL_CHUNK", `duplicate critical chunk: ${type}`);
      }
    }
    if (chunks.length === 0 && type !== "IHDR") {
      throw new VisualQaError("PNG_CHUNK_ORDER_INVALID", "IHDR must be first");
    }
    if (type === "IHDR" && chunks.length !== 0) {
      throw new VisualQaError("PNG_DUPLICATE_CRITICAL_CHUNK", "duplicate or misplaced IHDR");
    }
    if (type === "PLTE" && seenIdat) {
      throw new VisualQaError("PNG_CHUNK_ORDER_INVALID", "PLTE must precede IDAT");
    }
    if (type === "IDAT") {
      if (idatClosed) throw new VisualQaError("PNG_CHUNK_ORDER_INVALID", "IDAT chunks must be contiguous");
      seenIdat = true;
    } else if (seenIdat && type !== "IEND") {
      idatClosed = true;
    }
    if (type === "IEND" && (!seenIdat || data.length !== 0)) {
      throw new VisualQaError("PNG_CHUNK_ORDER_INVALID", "IEND requires preceding IDAT and zero length");
    }
    chunks.push(Object.freeze({ type, data }));
    offset = nextOffset;
    if (type === "IEND") {
      if (offset !== buffer.length) {
        throw new VisualQaError("PNG_TRAILING_DATA", "unexpected bytes after IEND");
      }
      break;
    }
  }
  if (chunks[0]?.type !== "IHDR" || chunks.at(-1)?.type !== "IEND") {
    throw new VisualQaError("PNG_TRUNCATED", "PNG_TRUNCATED: IHDR/IEND boundary is incomplete");
  }
  if (chunks[0].data.length !== 13) {
    throw new VisualQaError("PNG_HEADER_INVALID", "IHDR must contain 13 bytes");
  }
  return chunks;
}
