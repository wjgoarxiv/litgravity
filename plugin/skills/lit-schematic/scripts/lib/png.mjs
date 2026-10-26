// Minimal PNG chunk handling: read size and resolution, write the pHYs chunk so a 600 dpi
// export says so to Word, InDesign and journal upload checkers, and confirm a file is whole.

import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const INCH = 0.0254;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function chunks(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG file");
  const out = [];
  let at = 8;
  while (at + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString("latin1", at + 4, at + 8);
    if (at + 12 + length > buffer.length) throw new Error(`PNG chunk ${type} runs past the end of the file`);
    out.push({ type, at, length, data: buffer.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
    if (type === "IEND") break;
  }
  return out;
}

const chunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "latin1"), data])), 0);
  return Buffer.concat([head, data, crc]);
};

export function withDpi(buffer, dpi) {
  const list = chunks(buffer);
  const ppm = Math.round(dpi / INCH);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(ppm, 0);
  data.writeUInt32BE(ppm, 4);
  data.writeUInt8(1, 8);
  const parts = [SIGNATURE];
  for (const c of list) {
    if (c.type === "pHYs") continue;
    parts.push(buffer.subarray(c.at, c.at + 12 + c.length));
    if (c.type === "IHDR") parts.push(chunk("pHYs", data));
  }
  return Buffer.concat(parts);
}

export function pngInfo(buffer) {
  const list = chunks(buffer);
  const ihdr = list.find((c) => c.type === "IHDR");
  const phys = list.find((c) => c.type === "pHYs");
  const dpi = phys && phys.data.readUInt8(8) === 1 ? Math.round(phys.data.readUInt32BE(0) * INCH * 10) / 10 : null;
  const closed = list.at(-1)?.type === "IEND" && list.every((c) => crc32(Buffer.concat([Buffer.from(c.type, "latin1"), c.data])) === buffer.readUInt32BE(c.at + 8 + c.length));
  return { width: ihdr.data.readUInt32BE(0), height: ihdr.data.readUInt32BE(4), dpi, closed };
}

// Decodes an 8-bit, non-interlaced PNG (grey, grey+alpha, RGB, RGBA) one row at a time and
// returns the share of inked pixels (darker than near-white) in each cell of a cols x rows grid.
// A render that the browser cut short leaves whole cells white, which this makes visible.
export function inkGrid(buffer, cols = 6, rows = 6) {
  const list = chunks(buffer);
  const ihdr = list.find((c) => c.type === "IHDR").data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr.readUInt8(8);
  const type = ihdr.readUInt8(9);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (depth !== 8 || !channels || ihdr.readUInt8(12) !== 0) throw new Error("inkGrid reads 8-bit non-interlaced grey or RGB PNGs only");
  const raw = inflateSync(Buffer.concat(list.filter((c) => c.type === "IDAT").map((c) => c.data)));
  const stride = width * channels;
  let prev = new Uint8Array(stride);
  let row = new Uint8Array(stride);
  const ink = new Float64Array(cols * rows);
  const total = new Float64Array(cols * rows);
  for (let y = 0; y < height; y++) {
    const at = y * (stride + 1);
    const filter = raw[at];
    for (let i = 0; i < stride; i++) {
      const x = raw[at + 1 + i];
      const a = i >= channels ? row[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      row[i] = v & 0xff;
    }
    const cy = Math.min(rows - 1, Math.floor((y * rows) / height));
    for (let px = 0; px < width; px += 2) {
      const i = px * channels;
      const dark = channels >= 3 ? Math.min(row[i], row[i + 1], row[i + 2]) : row[i];
      const alpha = channels === 4 ? row[i + 3] : channels === 2 ? row[i + 1] : 255;
      const cell = cy * cols + Math.min(cols - 1, Math.floor((px * cols) / width));
      total[cell] += 1;
      if (alpha > 128 && dark < 200) ink[cell] += 1;
    }
    [prev, row] = [row, prev];
  }
  return Array.from(ink, (v, k) => (total[k] ? v / total[k] : 0));
}

// Cells inked in the reference render that are (nearly) blank in the final one.
export function missingInk(reference, final, { floor = 0.003, keep = 0.25 } = {}) {
  return reference.flatMap((r, k) => (r > floor && final[k] < r * keep ? [k] : []));
}
