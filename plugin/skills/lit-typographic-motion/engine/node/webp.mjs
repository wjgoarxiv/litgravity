// Decode an animated WebP the way a browser shows it, with no npm dependency: parse the RIFF
// container in JS (canvas, loop count, every ANMF rectangle, duration, blend and dispose flag), hand
// each frame's own bitstream to the host's `dwebp` (it ships with `img2webp` in libwebp) as a
// standalone still, and composite the stills on a transparent canvas as libwebp's animation decoder
// does. The cover gate reads the encoded file through this, never the PNG frames it came from: a
// lossy animation encoder skips small changes, and only the decoded file shows what it skipped.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { which } from "./encode.mjs";
import { describeSpawn } from "../../../../lib/host-exec.mjs";

export const findDwebp = (env = process.env) => which("dwebp", env);

const u24 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

/** Parse the container: { width, height, loop, background, frames: [{ x, y, w, h, durationMs, blend, dispose, data }] }. */
export function parseWebp(bytes) {
  if (bytes.length < 16 || bytes.toString("latin1", 0, 4) !== "RIFF" || bytes.toString("latin1", 8, 12) !== "WEBP") throw new Error("not a WebP file");
  const out = { width: 0, height: 0, loop: null, background: null, animated: false, frames: [] };
  const end = Math.min(bytes.length, 8 + bytes.readUInt32LE(4));
  for (let o = 12; o + 8 <= end;) {
    const type = bytes.toString("latin1", o, o + 4);
    const size = bytes.readUInt32LE(o + 4);
    const body = bytes.subarray(o + 8, o + 8 + size);
    if (type === "VP8X") {
      out.animated = Boolean(body[0] & 0x02);
      out.width = 1 + u24(body, 4);
      out.height = 1 + u24(body, 7);
    } else if (type === "ANIM") {
      out.background = body.readUInt32LE(0);
      out.loop = body.readUInt16LE(4);
    } else if (type === "ANMF") {
      out.frames.push({
        x: 2 * u24(body, 0), y: 2 * u24(body, 3), w: 1 + u24(body, 6), h: 1 + u24(body, 9),
        durationMs: u24(body, 12), blend: !(body[15] & 0x02), dispose: Boolean(body[15] & 0x01), data: body.subarray(16),
      });
    } else if ((type === "VP8 " || type === "VP8L") && !out.frames.length) {
      // A still: one frame covering the canvas.
      out.frames.push({ x: 0, y: 0, w: 0, h: 0, durationMs: 0, blend: false, dispose: false, data: bytes.subarray(o, o + 8 + size + (size & 1)), still: true });
    }
    o += 8 + size + (size & 1);
  }
  if (!out.animated && out.frames.length === 1 && out.loop === null) out.loop = 0;
  return out;
}

/** Wrap one ANMF payload (optional ALPH, then VP8/VP8L) as a standalone still WebP. */
function stillFile(frame) {
  const hasAlpha = frame.data.toString("latin1", 0, 4) === "ALPH";
  const vp8x = Buffer.alloc(18);
  vp8x.write("VP8X", 0, "latin1");
  vp8x.writeUInt32LE(10, 4);
  vp8x[8] = hasAlpha ? 0x10 : 0;
  vp8x.writeUIntLE(frame.w - 1, 12, 3);
  vp8x.writeUIntLE(frame.h - 1, 15, 3);
  const chunks = hasAlpha ? [vp8x, frame.data] : [frame.data];
  const size = 4 + chunks.reduce((s, c) => s + c.length, 0);
  const head = Buffer.alloc(12);
  head.write("RIFF", 0, "latin1");
  head.writeUInt32LE(size, 4);
  head.write("WEBP", 8, "latin1");
  return Buffer.concat([head, ...chunks]);
}

/** Read a PAM (P7, RGB_ALPHA) written by dwebp: { width, height, rgba }. */
export function readPam(buf) {
  const marker = buf.indexOf("ENDHDR\n");
  if (buf.toString("latin1", 0, 2) !== "P7" || marker < 0) throw new Error("not a PAM file");
  const head = buf.toString("latin1", 0, marker);
  const field = (name) => Number(new RegExp(`${name} (\\d+)`, "u").exec(head)?.[1]);
  const width = field("WIDTH");
  const height = field("HEIGHT");
  const depth = field("DEPTH");
  const data = buf.subarray(marker + 7);
  if (depth === 4) return { width, height, rgba: data };
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < width * height; i++) for (let c = 0; c < 3; c++) rgba[i * 4 + c] = data[i * depth + c];
  return { width, height, rgba };
}

/** Draw one decoded frame onto the canvas: alpha-blend (non-premultiplied, as libwebp) or replace. */
function paint(canvas, W, frame, rgba) {
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      const s = (y * frame.w + x) * 4;
      const d = ((frame.y + y) * W + frame.x + x) * 4;
      const sa = rgba[s + 3];
      if (!frame.blend || sa === 255) {
        canvas[d] = rgba[s]; canvas[d + 1] = rgba[s + 1]; canvas[d + 2] = rgba[s + 2]; canvas[d + 3] = sa;
      } else if (sa > 0) {
        const da = canvas[d + 3];
        const keep = (da * (255 - sa)) / 255;
        const a = sa + keep;
        for (let c = 0; c < 3; c++) canvas[d + c] = Math.round((rgba[s + c] * sa + canvas[d + c] * keep) / a);
        canvas[d + 3] = Math.round(a);
      }
    }
  }
}

function clearRect(canvas, W, f) {
  for (let y = f.y; y < f.y + f.h; y++) canvas.fill(0, (y * W + f.x) * 4, (y * W + f.x + f.w) * 4);
}

/**
 * Decode every frame. `onFrame(index, rgba, durationMs, width, height)` sees the composited canvas (reused between
 * calls: copy what you keep). Returns { width, height, loop, durations, bytes, frames }.
 */
export function decodeWebp(file, { env = process.env, onFrame = () => {} } = {}) {
  const dwebp = findDwebp(env);
  if (!dwebp) throw new Error("dwebp not found (it ships with img2webp in libwebp); install libwebp");
  const bytes = readFileSync(file);
  const info = parseWebp(bytes);
  if (!info.frames.length) throw new Error(`${file} has no frames`);
  const work = mkdtempSync(path.join(tmpdir(), "lit-webp-"));
  try {
    let W = info.width;
    let H = info.height;
    let canvas = null;
    const durations = [];
    let previous = null;
    info.frames.forEach((frame, i) => {
      const src = path.join(work, "f.webp");
      const pam = path.join(work, "f.pam");
      writeFileSync(src, frame.still ? Buffer.concat([bytes.subarray(0, 12), frame.data]) : stillFile(frame));
      const run = spawnSync(dwebp, [src, "-pam", "-quiet", "-o", pam], { encoding: "utf8" });
      if (run.status !== 0) throw new Error(`dwebp failed on frame ${i} (${describeSpawn(run)})`);
      const still = readPam(readFileSync(pam));
      if (frame.still) {
        W = still.width; H = still.height;
        Object.assign(frame, { w: W, h: H });
      }
      if (!canvas) canvas = Buffer.alloc(W * H * 4);
      if (previous?.dispose) clearRect(canvas, W, previous);
      paint(canvas, W, frame, still.rgba);
      durations.push(frame.durationMs);
      onFrame(i, canvas, frame.durationMs, W, H);
      previous = frame;
    });
    return { width: W, height: H, loop: info.loop, durations, bytes: statSync(file).size, frames: info.frames.length };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
