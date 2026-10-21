// The stills set both renderers write, the thing the look rounds are about: one full-size still per
// beat midpoint, one transition strip per cut (the frames 6 before, at and 6 after the cut, side by
// side at half size), a 12-frame contact sheet, and `stills/index.json` listing every file with its
// frames and SHA-256. The index's own SHA-256 is the "stills manifest" a look round is stamped with.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { areaDownscale } from "./analysis.mjs";
import { encodePng, rgbaToRgb } from "./png.mjs";

export const STILLS_DIR = "stills";
export const INDEX_FILE = "index.json";
export const STRIP_OFFSETS = Object.freeze([-6, 0, 6]);
export const SHEET_FRAMES = 12;
const GAP = 12;
const GROUND = 30;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clampFrame = (f, count) => Math.max(0, Math.min(count - 1, f));

/**
 * Which frames the stills set needs. `beats` are { t0, t1 } in seconds; `cuts` are cut frames.
 * Returns { beats: [frame], strips: [[f-6, f, f+6]], sheet: [12 frames], poster, reduced, all: Set }.
 */
export function stillsPlan({ beats, fps, frameCount, cuts, posterBeat = null }) {
  const mids = beats.map((b) => clampFrame(Math.round(((b.t0 + b.t1) / 2) * fps), frameCount));
  const strips = cuts.map((c) => STRIP_OFFSETS.map((o) => clampFrame(c + o, frameCount)));
  const sheet = Array.from({ length: SHEET_FRAMES }, (_, k) => Math.round((k * (frameCount - 1)) / (SHEET_FRAMES - 1)));
  const pick = Number.isInteger(posterBeat) && posterBeat >= 0 && posterBeat < mids.length ? posterBeat : Math.floor(mids.length / 2);
  const all = new Set([...mids, ...strips.flat(), ...sheet]);
  return { beats: mids, strips, sheet, poster: mids[pick], reduced: mids[mids.length - 1], all };
}

/** Cut frames of a stage film: every beat boundary after the first, inside the film. */
export const beatCuts = (beats, fps, frameCount) => beats.slice(1).map((b) => Math.round(b.t0 * fps)).filter((c) => c > 0 && c < frameCount);

function tile(target, W, rgba, w, h, ox, oy) {
  for (let y = 0; y < h; y++) {
    const src = y * w * 4;
    const dst = ((oy + y) * W + ox) * 3;
    for (let x = 0; x < w; x++) {
      target[dst + x * 3] = rgba[src + x * 4];
      target[dst + x * 3 + 1] = rgba[src + x * 4 + 1];
      target[dst + x * 3 + 2] = rgba[src + x * 4 + 2];
    }
  }
}

/** Compose frames into one RGB PNG: `cols` per row, each scaled to tw x th. */
export function composeGrid(frames, width, height, { cols, tw, th }) {
  const rows = Math.ceil(frames.length / cols);
  const W = cols * tw + (cols + 1) * GAP;
  const H = rows * th + (rows + 1) * GAP;
  const out = Buffer.alloc(W * H * 3, GROUND);
  frames.forEach((rgba, i) => {
    const small = areaDownscale(rgba, width, height, tw, th);
    tile(out, W, small, tw, th, GAP + (i % cols) * (tw + GAP), GAP + Math.floor(i / cols) * (th + GAP));
  });
  return encodePng(out, W, H, 3, { level: 6 });
}

export const stripPng = (frames, width, height) => composeGrid(frames, width, height, { cols: 3, tw: Math.round(width / 2), th: Math.round(height / 2) });
export function sheetPng(frames, width, height) {
  const landscape = width >= height;
  return composeGrid(frames, width, height, landscape ? { cols: 4, tw: 480, th: 270 } : { cols: 6, tw: 270, th: 480 });
}
export const stillPng = (rgba, width, height) => encodePng(rgbaToRgb(rgba, width, height), width, height, 3, { level: 6 });

/**
 * Write the stills set from a map frame -> RGBA. Returns { index, sha256, files }. The index lists
 * paths relative to the output directory; `poster` (full renders) is the delivered poster.png.
 */
export function writeStills({ out, plan, frames, width, height, fps, frameCount, round, stillsOnly, path: renderPath, posterFile = null }) {
  const dir = path.join(out, STILLS_DIR);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const entries = [];
  const put = (name, bytes, extra) => {
    writeFileSync(path.join(dir, name), bytes);
    entries.push({ file: `${STILLS_DIR}/${name}`, sha256: sha256(bytes), ...extra });
  };
  plan.beats.forEach((f, i) => put(`beat-${String(i + 1).padStart(2, "0")}.png`, stillPng(frames.get(f), width, height), { kind: "beat", beat: i, frames: [f] }));
  plan.strips.forEach((fs, i) => put(`strip-${String(i + 1).padStart(2, "0")}.png`, stripPng(fs.map((f) => frames.get(f)), width, height), { kind: "strip", cut: i, frames: fs }));
  put("sheet.png", sheetPng(plan.sheet.map((f) => frames.get(f)), width, height), { kind: "sheet", frames: plan.sheet });
  if (posterFile) entries.push({ file: path.relative(out, posterFile), sha256: sha256(readFileSync(posterFile)), kind: "poster", frames: [plan.poster] });
  const index = { schema: "litgravity.motion-stills/v1", path: renderPath, round, stillsOnly, width, height, fps, frameCount, files: entries };
  const bytes = Buffer.from(`${JSON.stringify(index, null, 2)}\n`);
  writeFileSync(path.join(dir, INDEX_FILE), bytes);
  return { index, sha256: sha256(bytes), files: entries.map((e) => e.file) };
}

/** Read the latest stills index and its SHA-256 (null when absent). */
export function readStills(out) {
  try {
    const bytes = readFileSync(path.join(out, STILLS_DIR, INDEX_FILE));
    return { index: JSON.parse(bytes.toString("utf8")), sha256: sha256(bytes) };
  } catch {
    return null;
  }
}
