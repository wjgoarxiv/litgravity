// The cover gate: G0 determinism, G1 budget and loop, G2 motion energy, G3 anti-slide, G4 seam,
// G5 title contrast and G6 title glyph height, measured on the DECODED cover (animated WebP, or the
// GIF fallback), never only on the frames that went into the encoder. Every metric runs on a fixed
// time grid, because an encoder merges identical frames into one long frame and frame-count
// statistics would make a slide film look busy. Two tiers: FLOOR fails the cover, TARGET is the
// cover-mode goal and `--strict` fails on it too, the 2 MiB size target included. Thresholds live
// in core/constants.mjs (COVER).
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { COVER } from "../core/constants.mjs";
import { lumaGrid } from "./cover-image.mjs";
import { findFfmpeg } from "./encode.mjs";
import { decodePng } from "./png.mjs";
import { decodeWebp } from "./webp.mjs";
import { describeSpawn } from "../../../../lib/host-exec.mjs";

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};
const meanAbs = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length / 255;
};

const toRgba = ({ width, height, channels, pixels }) => {
  if (channels === 4) return pixels;
  const out = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < width * height; i++) for (let c = 0; c < 3; c++) out[i * 4 + c] = pixels[i * channels + (channels === 1 ? 0 : c)];
  return out;
};
export const readPngRgba = (file) => {
  const png = decodePng(readFileSync(file));
  return { width: png.width, height: png.height, rgba: toRgba(png) };
};
export const pngFrames = (dir, prefix = "f") => (existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".png")).sort().map((f) => path.join(dir, f)) : []);

/** GIF container facts the decoder pipe does not give back: per-frame delays (ms) and the loop count. */
export function gifTiming(bytes) {
  if (bytes.toString("latin1", 0, 3) !== "GIF") throw new Error("not a GIF file");
  const delays = [];
  let loop = null;
  let pending = 100;
  let o = 13;
  if (bytes[10] & 0x80) o += 3 * (1 << ((bytes[10] & 0x07) + 1));
  const skipBlocks = (p) => {
    while (p < bytes.length && bytes[p] !== 0) p += bytes[p] + 1;
    return p + 1;
  };
  while (o < bytes.length) {
    const sep = bytes[o];
    if (sep === 0x3b) break;
    if (sep === 0x21) {
      const label = bytes[o + 1];
      if (label === 0xf9) pending = 10 * bytes.readUInt16LE(o + 4);
      if (label === 0xff && bytes.toString("latin1", o + 3, o + 14) === "NETSCAPE2.0") loop = bytes.readUInt16LE(o + 16);
      o = skipBlocks(o + 2);
    } else if (sep === 0x2c) {
      let p = o + 10;
      if (bytes[o + 9] & 0x80) p += 3 * (1 << ((bytes[o + 9] & 0x07) + 1));
      o = skipBlocks(p + 1);
      delays.push(pending > 0 ? pending : 100);
      pending = 100;
    } else break;
  }
  return { delays, loop, width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
}

/**
 * Load a cover for the gate: { lumas, delays, width, height, loop, bytes, format, kept }. `keep(i,
 * durationMs)` is called once per decoded frame, in order, and says which frames to keep whole (RGBA)
 * for the sheet, the poster and the frame-0 checks.
 */
export function loadCover(input, { fps = 16, keep = () => false, env = process.env } = {}) {
  const kept = new Map();
  const lumas = [];
  if (statSync(input).isDirectory()) {
    const files = pngFrames(input);
    let width = 0;
    let height = 0;
    files.forEach((f, i) => {
      const img = readPngRgba(f);
      ({ width, height } = img);
      lumas.push(lumaGrid(img.rgba, width, height).luma);
      if (keep(i, 1000 / fps)) kept.set(i, img.rgba);
    });
    return { lumas, delays: files.map(() => 1000 / fps), width, height, loop: 0, bytes: null, format: "png", kept };
  }
  if (input.toLowerCase().endsWith(".gif")) {
    const bytes = readFileSync(input);
    const timing = gifTiming(bytes);
    const ffmpeg = findFfmpeg(env);
    if (!ffmpeg) throw new Error("ffmpeg is needed to decode a GIF cover");
    const raw = spawnSync(ffmpeg, ["-v", "error", "-i", input, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { maxBuffer: 2 ** 31 });
    if (raw.status !== 0) throw new Error(`ffmpeg could not decode ${input} (${describeSpawn(raw)})`);
    const size = timing.width * timing.height * 4;
    for (let i = 0; i * size < raw.stdout.length; i++) {
      const rgba = raw.stdout.subarray(i * size, (i + 1) * size);
      lumas.push(lumaGrid(rgba, timing.width, timing.height).luma);
      if (keep(i, timing.delays[i] ?? 100)) kept.set(i, Buffer.from(rgba));
    }
    return { lumas, delays: timing.delays.slice(0, lumas.length), width: timing.width, height: timing.height, loop: timing.loop, bytes: bytes.length, format: "gif", kept };
  }
  const info = decodeWebp(input, {
    env,
    onFrame: (i, rgba, ms, width, height) => {
      lumas.push(lumaGrid(rgba, width, height).luma);
      if (keep(i, ms > 0 ? ms : 100)) kept.set(i, Buffer.from(rgba));
    },
  });
  return { ...info, lumas, delays: info.durations.map((d) => (d > 0 ? d : 100)), format: "webp", kept };
}

/** Resample a frame list to one sample per `step` ms (the shown frame at each grid time). */
export function resample(frames, delays, step) {
  const total = delays.reduce((a, b) => a + b, 0);
  const out = [];
  let i = 0;
  let end = delays[0];
  for (let ms = 0; ms < total - 1e-6; ms += step) {
    while (ms >= end && i < frames.length - 1) end += delays[++i];
    out.push(frames[i]);
  }
  return out;
}

/** Motion metrics on the grid; the loop is a ring, so the seam is one more step. */
export function motionMetrics({ lumas, delays }) {
  const step = Math.max(COVER.stepMs, Math.min(...delays));
  const frames = resample(lumas, delays, step);
  const n = frames.length;
  const d = [];
  for (let i = 1; i < n; i++) d.push(meanAbs(frames[i], frames[i - 1]));
  const seam = meanAbs(frames[0], frames[n - 1]);
  const all = [...d, seam];
  const med = median(all);
  const still = all.map((x) => x < COVER.stillEps);
  let longest = 0;
  if (still.every(Boolean)) longest = (n * step) / 1000;
  else {
    const start = still.findIndex((s) => !s);
    let run = 0;
    for (let j = 1; j <= n; j++) {
      const k = (start + j) % n;
      run = still[(k - 1 + n) % n] ? run + step : step;
      longest = Math.max(longest, run);
    }
    longest /= 1000;
  }
  const around = n >= 4 ? (all[n - 3] + all[n - 2] + all[0] + all[1]) / 4 : med;
  return {
    gridFrames: n, stepMs: step, durationSec: (n * step) / 1000, sourceDurationSec: delays.reduce((a, b) => a + b, 0) / 1000,
    medianD: med, p10D: pct(all, 0.1), p90D: pct(all, 0.9), maxD: Math.max(...all),
    movingFrac: all.filter((x) => x >= COVER.stillEps).length / all.length,
    longestStillSec: longest, spike: Math.max(...all) / Math.max(med, COVER.stillEps), seam,
    seamLocal: seam / Math.max(COVER.stillEps, around), diffs: all,
  };
}

const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const relL = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const boxPx = (box, W, H) => box.map((v, k) => Math.round(v * (k % 2 ? H : W)));

/**
 * G5: per frame, the median title pixel against the 90th-percentile background in the title box
 * (background = box pixels at least 3 px from any title pixel). Needs the per-frame title masks the
 * mask pass wrote (white = title); without them G5 fails and names what is missing.
 */
export function titleContrast({ framesDir, masksDir, box }) {
  const frames = pngFrames(framesDir, "f");
  const masks = pngFrames(masksDir, "m");
  if (!frames.length || masks.length !== frames.length) return { measured: false, reason: `need one mask per frame (${frames.length} frames, ${masks.length} masks)` };
  const per = [];
  for (let i = 0; i < frames.length; i++) {
    const { width: W, height: H, rgba } = readPngRgba(frames[i]);
    const m = readPngRgba(masks[i]);
    if (m.width !== W || m.height !== H) return { measured: false, reason: `mask ${i} is ${m.width}x${m.height}, the frame ${W}x${H}` };
    const [bx, by, bw, bh] = boxPx(box, W, H);
    const kind = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) if (m.rgba[p * 4] > 127) kind[p] = 2;
    const R = 3;
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        if (kind[y * W + x] !== 2) continue;
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < H && xx >= 0 && xx < W && kind[yy * W + xx] === 0) kind[yy * W + xx] = 1;
          }
        }
      }
    }
    const text = [];
    const bg = [];
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        const p = (y * W + x) * 4;
        const L = relL(rgba[p], rgba[p + 1], rgba[p + 2]);
        if (kind[y * W + x] === 2) text.push(L);
        else if (kind[y * W + x] === 0) bg.push(L);
      }
    }
    if (!text.length || !bg.length) return { measured: false, reason: `frame ${i}: the title box holds ${text.length} title and ${bg.length} background pixels` };
    const tl = median(text);
    const worst = tl > median(bg) ? pct(bg, 0.9) : pct(bg, 0.1);
    per.push((Math.max(tl, worst) + 0.05) / (Math.min(tl, worst) + 0.05));
  }
  return { measured: true, min: Math.min(...per), median: median(per), frames: per.length };
}

/**
 * G6: the title's cap height at the README display width. Per sampled mask frame, the white pixels in
 * the title box split into connected glyphs; glyphs smaller than 1 % of the largest or shorter than
 * 30 % of the tallest (dots, accents) are left out, and the median height of the rest is the cap
 * height. The smallest over the samples, scaled from the cover width to `displayWidth`, must reach
 * COVER.minGlyphPx. A title painted into declared base art is `exempt` (still measured, reported as
 * INFO). G6 sits beside G5: contrast alone never makes a title readable.
 */
export function glyphHeights({ masksDir, box, displayWidth = COVER.displayWidth, exempt = null, samples = 12 }) {
  const masks = pngFrames(masksDir, "m");
  if (!masks.length) return { pass: false, reason: "no mask frames to measure the title on" };
  const picks = [...new Set(Array.from({ length: Math.min(samples, masks.length) }, (_, k) => Math.floor((k * masks.length) / Math.min(samples, masks.length))))];
  let cap = Infinity;
  let glyphs = 0;
  let width = 0;
  for (const i of picks) {
    const m = readPngRgba(masks[i]);
    width = m.width;
    const [bx, by, bw, bh] = boxPx(box, m.width, m.height);
    const on = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) on[y * bw + x] = m.rgba[((by + y) * m.width + bx + x) * 4] > 127 ? 1 : 0;
    const comps = [];
    const stack = [];
    for (let start = 0; start < on.length; start++) {
      if (on[start] !== 1) continue;
      on[start] = 2;
      stack.push(start);
      let area = 0;
      let top = bh;
      let bottom = -1;
      while (stack.length) {
        const q = stack.pop();
        const y = Math.floor(q / bw);
        const x = q - y * bw;
        area += 1;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        for (const n of [x > 0 ? q - 1 : -1, x < bw - 1 ? q + 1 : -1, y > 0 ? q - bw : -1, y < bh - 1 ? q + bw : -1]) {
          if (n >= 0 && on[n] === 1) {
            on[n] = 2;
            stack.push(n);
          }
        }
      }
      comps.push({ area, height: bottom - top + 1 });
    }
    if (!comps.length) return { pass: false, reason: `mask ${i}: no title pixels in the title box` };
    const maxArea = Math.max(...comps.map((c) => c.area));
    const tallest = Math.max(...comps.map((c) => c.height));
    const letters = comps.filter((c) => c.area >= 0.01 * maxArea && c.height >= 0.3 * tallest);
    glyphs = Math.max(glyphs, letters.length);
    cap = Math.min(cap, median(letters.map((c) => c.height)));
  }
  const capPx = (cap * displayWidth) / width;
  const result = { capPx: +capPx.toFixed(1), coverPx: cap, displayWidth, glyphs, sampled: picks.length };
  if (exempt) return { pass: null, ...result, reason: exempt };
  return { pass: capPx >= COVER.minGlyphPx, ...result };
}

/** G0: SHA-256 per frame of two independent captures. */
export function determinism(a, b) {
  const fa = pngFrames(a, "f");
  const fb = pngFrames(b, "f");
  const h = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
  let same = 0;
  const differing = [];
  const n = Math.min(fa.length, fb.length);
  for (let i = 0; i < n; i++) {
    if (h(fa[i]) === h(fb[i])) same += 1;
    else differing.push(i);
  }
  return { compared: n, identical: same, countsMatch: fa.length === fb.length, firstDiffering: differing[0] ?? null };
}

/**
 * Gate one cover. Options: frames / frames2 (two captures, G0), masks + title (G5), fps (a PNG
 * directory input), keep (frames to keep whole). Returns the metrics, the per-gate verdicts and
 * `pass` (FLOOR) / `target` (TARGET, what --strict needs).
 */
export function coverGate(input, { frames = null, frames2 = null, masks = null, title = null, glyph = null, fps = 16, keep, env = process.env } = {}) {
  const src = loadCover(input, { fps, keep, env });
  const m = motionMetrics(src);
  const g = {};
  if (frames && frames2) {
    const det = determinism(frames, frames2);
    g.G0 = { pass: det.countsMatch && det.identical === det.compared && det.compared > 0, ...det };
  }
  if (src.format !== "png") {
    g.G1 = {
      pass: src.bytes <= COVER.maxBytes && m.sourceDurationSec >= COVER.minSec && m.sourceDurationSec <= COVER.maxSec && src.loop === 0,
      target: src.bytes <= COVER.targetBytes,
      bytes: src.bytes, durationSec: m.sourceDurationSec, loop: src.loop, size: `${src.width}x${src.height}`,
    };
  }
  const F = COVER.floor;
  const T = COVER.target;
  g.G2 = { pass: m.medianD >= F.medianD && m.movingFrac >= F.movingFrac, target: m.medianD >= T.medianD && m.movingFrac >= T.movingFrac, medianD: m.medianD, movingFrac: m.movingFrac };
  g.G3 = { pass: m.longestStillSec <= F.stillSec, target: m.longestStillSec <= T.stillSec && m.spike <= T.spike, longestStillSec: m.longestStillSec, spike: m.spike };
  g.G4 = { pass: m.seamLocal <= F.seamLocal, target: m.seamLocal <= T.seamLocal && m.seamLocal >= T.seamLo, seam: m.seam, seamLocal: m.seamLocal };
  if (title && frames) {
    const c = titleContrast({ framesDir: frames, masksDir: masks, box: title });
    g.G5 = c.measured ? { pass: c.min >= COVER.minContrast, min: c.min, median: c.median, frames: c.frames } : { pass: false, reason: c.reason };
  }
  if (title && masks && glyph) g.G6 = glyphHeights({ masksDir: masks, box: title, displayWidth: glyph.displayWidth ?? COVER.displayWidth, exempt: glyph.exempt ?? null });
  const pass = Object.values(g).every((x) => x.pass !== false);
  const target = pass && Object.values(g).every((x) => x.target !== false);
  return { input, format: src.format, width: src.width, height: src.height, bytes: src.bytes, loop: src.loop, sourceFrames: src.lumas.length, durations: src.delays, ...m, gates: g, pass, target, kept: src.kept };
}

const num = (x) => (typeof x === "number" && !Number.isInteger(x) ? +x.toPrecision(4) : x);

/** The report text: verdict line, size line, one line per gate. */
export function formatCoverReport(r, { strict = false } = {}) {
  const verdict = r.pass ? (r.target ? "PASS+TARGET" : "PASS(floor)") : "FAIL";
  const lines = [
    `COVER gate${strict ? " --strict" : ""}: ${verdict}`,
    `  ${r.width}x${r.height} ${r.format} frames=${r.sourceFrames} dur=${num(r.sourceDurationSec)}s bytes=${r.bytes ?? "-"} loop=${r.loop} grid=${r.stepMs}ms`,
  ];
  for (const [k, v] of Object.entries(r.gates)) {
    const { pass, target, ...detail } = v;
    const word = pass === null ? "INFO" : pass ? (target === false ? "pass(floor)" : "pass") : "FAIL";
    lines.push(`  ${k} ${word} ${Object.entries(detail).map(([a, b]) => `${a}=${num(b)}`).join(" ")}`);
  }
  return `${lines.join("\n")}\n`;
}
