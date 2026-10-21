// Cover mode: a seamless README cover loop. One round: cover treatment check -> static scan of the
// page -> the asset list (exit 22 for a missing asset, before any capture) -> fonts -> master Chrome
// seeks t = i / N for every frame at 2x and the pool downsamples (Lanczos) to the cover size -> the
// title-mask pass in the same browser -> a fresh Chrome repeats every frame for G0 -> another fresh
// Chrome renders a seeded shuffle of frames, which must match the master (a page that keeps state
// between frames fails here) -> flash audit on the frames (looped) -> img2webp (frame 0 and the
// frames before the seam at a higher quality), or gifski when img2webp is missing -> the cover gate
// on the DECODED file, with the title's glyph height and frame 0's base art -> stills (decoded sheet
// frames, poster, seam pair) and the contact sheet with the frame-difference plot -> manifest and
// report. A flash-audit FAIL withholds the cover. `--window t0,t1` renders and sheets only the frames
// around a logged defect, before the next full render; it never counts as done.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COVER, EXIT } from "../core/constants.mjs";
import { auditRecords, cellsFromRgba, detectSequence, gridFor } from "../core/flash.mjs";
import { BlockedError } from "./chrome.mjs";
import { artCheck, checkAssets } from "./cover-assets.mjs";
import { capturePass, CoverBrowser, CoverPool } from "./cover-capture.mjs";
import { coverGate, formatCoverReport, pngFrames, readPngRgba } from "./cover-gate.mjs";
import { lumaGrid } from "./cover-image.mjs";
import { renderSheet } from "./cover-sheet.mjs";
import { loadCoverTreatment } from "./cover-treatment.mjs";
import { findFfmpeg, findImg2webp, which } from "./encode.mjs";
import { asBlocked } from "./pipeline.mjs";
import { encodePng, rgbaToRgb } from "./png.mjs";
import { rasterInfo, scanStage, stageFonts } from "./stage-serve.mjs";
import { STILLS_DIR, INDEX_FILE } from "./stills.mjs";
import { findDwebp } from "./webp.mjs";
import { describeSpawn } from "../../../../lib/host-exec.mjs";

export const COVER_STAGE = "cover";
export const COVER_OUTPUTS = Object.freeze(["cover.webp", "cover.gif", "poster.png"]);
export const SHEET_TILES = 12;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

/** Per-frame display time in ms: whole milliseconds, as img2webp writes them. */
export const frameMs = (fps) => Math.round(1000 / fps);

/** img2webp arguments: lossy, loop forever, frame 0 and the last `edgeFrames` at `edgeQ`. */
export function img2webpArgs({ files, fps, encode, out }) {
  const ms = frameMs(fps);
  const args = ["-loop", "0", "-lossy", "-q", String(encode.q), "-m", String(encode.method)];
  files.forEach((file, i) => {
    const q = i === 0 || i >= files.length - encode.edgeFrames ? encode.edgeQ : encode.q;
    args.push("-d", String(ms), "-q", String(q), file);
  });
  args.push("-o", out);
  return args;
}

/** Encode the frames: img2webp first; gifski is the fallback; nothing else is a cover. */
export function encodeCover({ files, fps, encode, out, env = process.env }) {
  const img2webp = findImg2webp(env);
  const dwebp = findDwebp(env);
  if (img2webp && dwebp) {
    const file = path.join(out, "cover.webp");
    const r = spawnSync(img2webp, img2webpArgs({ files, fps, encode, out: file }), { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`img2webp failed (${describeSpawn(r)})`);
    return { file, encoder: "img2webp" };
  }
  const gifski = which("gifski", env);
  if (gifski) {
    const file = path.join(out, "cover.gif");
    const r = spawnSync(gifski, ["--fps", String(fps), "--quality", "90", "--repeat", "0", "-o", file, ...files], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`gifski failed (${describeSpawn(r)})`);
    return { file, encoder: "gifski" };
  }
  throw new BlockedError(EXIT.BLOCKED_NO_COVER_ENCODER, "BLOCKED_NO_COVER_ENCODER: install libwebp (img2webp and dwebp) or gifski; a cover is never an MP4");
}

/** Loop times on the master grid: frame i shows t = i / N. */
export const loopTimes = (frames) => Array.from({ length: frames }, (_, i) => [i, i / frames]);

/** The decoded frame shown at `ms` given per-frame durations. */
export function frameAt(durations, ms) {
  let acc = 0;
  for (let i = 0; i < durations.length; i++) {
    acc += durations[i];
    if (ms < acc) return i;
  }
  return durations.length - 1;
}

/** Flash audit (WCAG 2.3.1, the film gate's own detector) on the cover frames, looped. */
function flashAudit(files, fps) {
  const first = readPngRgba(files[0]);
  const grid = gridFor(first.width, first.height);
  const cells = files.map((f) => {
    const img = readPngRgba(f);
    return cellsFromRgba(img.rgba, img.width, img.height, undefined, grid);
  });
  return auditRecords(detectSequence(cells, { loop: true, grid }), fps, { loop: true });
}

/** Write the cover stills set (decoded frames) and its index; the sheet is rendered after. */
function writeCoverStills({ out, round, gate, durations, kept, width, height }) {
  const dir = path.join(out, STILLS_DIR);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const total = durations.reduce((a, b) => a + b, 0);
  const entries = [];
  const put = (name, bytes, extra) => {
    writeFileSync(path.join(dir, name), bytes);
    entries.push({ file: `${STILLS_DIR}/${name}`, sha256: sha256(bytes), ...extra });
  };
  const png = (rgba) => encodePng(rgbaToRgb(rgba, width, height), width, height, 3, { level: 6 });
  const tiles = [];
  for (let k = 0; k < SHEET_TILES; k++) {
    const t = k / SHEET_TILES;
    const idx = frameAt(durations, t * total);
    const name = `frame-${String(k).padStart(2, "0")}.png`;
    put(name, png(kept.get(idx)), { kind: "frame", t: +t.toFixed(4), decodedFrame: idx });
    tiles.push({ file: path.join(dir, name), caption: `t=${t.toFixed(3)}  frame ${idx}` });
  }
  const last = durations.length - 1;
  put("poster.png", png(kept.get(0)), { kind: "poster", decodedFrame: 0 });
  const seam = Buffer.alloc(width * 2 * height * 4);
  for (let y = 0; y < height; y++) {
    kept.get(last).copy(seam, y * width * 2 * 4, y * width * 4, (y + 1) * width * 4);
    kept.get(0).copy(seam, (y * width * 2 + width) * 4, y * width * 4, (y + 1) * width * 4);
  }
  put("seam.png", encodePng(rgbaToRgb(seam, width * 2, height), width * 2, height, 3, { level: 6 }), { kind: "seam", decodedFrames: [last, 0] });
  return { dir, entries, tiles, finish(sheetFile) {
    const bytes = readFileSync(sheetFile);
    entries.push({ file: `${STILLS_DIR}/sheet.png`, sha256: sha256(bytes), kind: "sheet" });
    const index = { schema: "litgravity.motion-stills/v1", path: "cover", mode: "cover", round, stillsOnly: false, width, height, durationSec: gate.sourceDurationSec, files: entries, gate: { pass: gate.pass, target: gate.target } };
    const indexBytes = Buffer.from(`${JSON.stringify(index, null, 2)}\n`);
    writeFileSync(path.join(dir, INDEX_FILE), indexBytes);
    return { index, sha256: sha256(indexBytes) };
  } };
}

/** Seeded shuffle (mulberry32, the loop kit's generator) of `count` distinct frame indices. */
export function seekOrder(frames, seed, count = COVER.seekSamples) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const all = Array.from({ length: frames }, (_, i) => i);
  for (let i = frames - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, Math.min(count, frames));
}

/** The seek-order check's tolerance: the one-level rounding of the software rasterizer. */
export const SEEK_LEVELS = 1;

/** The largest per-channel difference between two same-size PNG frames. */
export function maxLevelDiff(a, b) {
  const x = readPngRgba(a);
  const y = readPngRgba(b);
  if (x.width !== y.width || x.height !== y.height) return 255;
  let max = 0;
  for (let i = 0; i < x.rgba.length; i++) {
    const d = Math.abs(x.rgba[i] - y.rgba[i]);
    if (d > max) max = d;
  }
  return max;
}

/** Read a raster's pixels: PNG in JS, anything else through ffmpeg. */
function readRaster(file, env) {
  try {
    return readPngRgba(file);
  } catch {
    const info = rasterInfo(file);
    const ffmpeg = findFfmpeg(env);
    if (!info || !ffmpeg) return null;
    const raw = spawnSync(ffmpeg, ["-v", "error", "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { maxBuffer: 2 ** 30 });
    return raw.status === 0 ? { width: info.width, height: info.height, rgba: raw.stdout } : null;
  }
}

/** Everything a cover round checks before the first capture: treatment, page, scan, assets, fonts. */
function prepare({ out, env, log }) {
  const treatment = asBlocked(() => loadCoverTreatment(out));
  const stageDir = path.join(out, COVER_STAGE);
  if (!existsSync(path.join(stageDir, "index.html"))) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${path.join(stageDir, "index.html")} is missing; write the cover page first (references/cover.md)`);
  const scan = scanStage(stageDir);
  for (const w of scan.warnings) log(`warning: ${w}`);
  const { assets } = checkAssets({ out, treatment, rasters: scan.rasters, coverDir: COVER_STAGE });
  return { treatment, stageDir, assets, faces: stageFonts(env) };
}

/**
 * Render one cover round. Returns { code, message, gate }. Exit 13 when the decoded cover misses a
 * FLOOR or TARGET gate (the cover mode goal is TARGET) or the flash audit fails.
 */
export async function renderCover({ out, round = 1, env = process.env, log = () => {} }) {
  const { treatment, stageDir, assets, faces } = prepare({ out, env, log });
  if (!(findImg2webp(env) && findDwebp(env)) && !which("gifski", env)) encodeCover({ files: [], fps: treatment.fps, encode: treatment.encode, out, env });
  const [pw, ph] = treatment.page;
  const [w, h] = treatment.out;
  const runDir = path.join(out, ".run", "cover");
  rmSync(runDir, { recursive: true, force: true });
  const dirs = { frames: path.join(runDir, "frames"), masks: path.join(runDir, "masks"), frames2: path.join(runDir, "frames2"), seek: path.join(runDir, "seek") };
  for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });
  const times = loopTimes(treatment.frames);
  const pool = new CoverPool();
  const started = Date.now();
  let master;
  let replay;
  let sought;
  const order = seekOrder(times.length, treatment.seed || 20261020);
  try {
    const open = (label) => CoverBrowser.open({ stageDir, faces, width: pw, height: ph, scale: COVER.captureScale, profileDir: path.join(runDir, `chrome-${label}`), env, log });
    const a = await open("master");
    try {
      master = await capturePass({ browser: a, pool, times, dir: dirs.frames, prefix: "f", width: w, height: h });
      await capturePass({ browser: a, pool, times, dir: dirs.masks, prefix: "m", mask: true, width: w, height: h });
    } finally {
      await a.close();
    }
    const b = await open("replay");
    try {
      replay = await capturePass({ browser: b, pool, times, dir: dirs.frames2, prefix: "f", width: w, height: h });
    } finally {
      await b.close();
    }
    const c = await open("seek");
    try {
      sought = await capturePass({ browser: c, pool, times: order.map((i) => times[i]), dir: dirs.seek, prefix: "s", width: w, height: h });
    } finally {
      await c.close();
    }
  } finally {
    await pool.close();
  }
  const captureSec = (Date.now() - started) / 1000;
  const differing = times.filter(([i]) => master.get(i) !== replay.get(i)).map(([i, t]) => `frame ${i} (t = ${t.toFixed(4)})`);
  if (differing.length) throw new BlockedError(EXIT.STAGE_NONDETERMINISTIC, `STAGE_NONDETERMINISTIC: a fresh capture differs at ${differing.slice(0, 4).join(", ")}${differing.length > 4 ? ` (+${differing.length - 4})` : ""}; draw every pixel from t and LitLoop.rng(seed)`);
  const ms = frameMs(treatment.fps);
  // A frame that differs by at most one level per channel is the renderer's known rounding when
  // opacity and transform change together (it depends on which frames were painted before);
  // state kept between frames differs by far more.
  let oneLevel = 0;
  for (let off = 0; off < order.length; off++) {
    const i = order[off];
    if (sought.get(i) === master.get(i)) continue;
    const step = maxLevelDiff(path.join(dirs.frames, `f${String(i).padStart(4, "0")}.png`), path.join(dirs.seek, `s${String(i).padStart(4, "0")}.png`));
    if (step <= SEEK_LEVELS) {
      oneLevel += 1;
      continue;
    }
    throw new BlockedError(EXIT.STAGE_NONDETERMINISTIC, `STAGE_NONDETERMINISTIC: frame ${i} (t = ${((i * ms) / 1000).toFixed(3)} s) differs when sought out of order by up to ${step} levels (a fresh page drew it ${off ? `after frame ${order[off - 1]}` : "first"}); the page keeps state between frames: clear every canvas and draw each frame from t alone`);
  }

  const files = pngFrames(dirs.frames, "f");
  const flash = flashAudit(files, treatment.fps);
  const encoded = encodeCover({ files, fps: treatment.fps, encode: treatment.encode, out, env });
  for (const stale of COVER_OUTPUTS.filter((f) => path.join(out, f) !== encoded.file)) rmSync(path.join(out, stale), { force: true });
  const planned = times.length * ms;
  const wanted = new Set([0, ...Array.from({ length: SHEET_TILES }, (_, k) => (k / SHEET_TILES) * planned)]);
  let elapsed = 0;
  const keep = (i, dur) => {
    const start = elapsed;
    elapsed += dur;
    return i === 0 || start + dur >= planned || [...wanted].some((x) => x >= start && x < start + dur);
  };
  const paintedIn = treatment.title.kind === "painted" ? assets.find((a) => a.role === "base-art" && a.title) : null;
  const glyph = { displayWidth: COVER.displayWidth, exempt: paintedIn ? `painted into the base art ${paintedIn.path}` : null };
  const gate = coverGate(encoded.file, { frames: dirs.frames, frames2: dirs.frames2, masks: dirs.masks, title: treatment.title.box, glyph, fps: treatment.fps, keep, env });
  gate.gates.SEEK = { pass: true, sampled: order.length, identical: order.length - oneLevel, oneLevel };
  for (const a of assets.filter((x) => x.role === "base-art")) {
    const art = readRaster(path.join(out, a.path), env);
    const check = art ? artCheck({ frame0: gate.kept.get(0), width: gate.width, height: gate.height, art, box: a.box, checkBox: a.checkBox }) : null;
    gate.gates.ART = check ? { pass: check.pass, ssim: check.ssim, checked: check.checked.join(",") } : { pass: false, reason: `${a.path} could not be decoded to compare with frame 0` };
  }
  gate.gates.FLASH = { pass: flash.pass, generalFlashes: flash.general.flashes, redFlashes: flash.red.flashes, worstAtSec: flash.general.startSec };
  gate.pass = Object.values(gate.gates).every((v) => v.pass !== false);
  gate.target = gate.target && gate.pass;
  const stills = writeCoverStills({ out, round, gate, durations: gate.durations, kept: gate.kept, width: gate.width, height: gate.height });
  const status = Object.entries(gate.gates).map(([k, v]) => `${k}:${v.pass === false ? "FAIL" : v.target === false ? "floor" : "ok"}`).join("  ");
  const sheetFile = path.join(stills.dir, "sheet.png");
  await renderSheet({
    file: sheetFile, tiles: stills.tiles, diffs: gate.diffs, medianD: gate.medianD, durationSec: gate.durationSec, faces, env, log,
    label: `median d ${gate.medianD.toFixed(5)} | moving ${(100 * gate.movingFrac).toFixed(0)}% | longest still ${gate.longestStillSec.toFixed(2)}s | spike ${gate.spike.toFixed(1)} | seam ${gate.seamLocal.toFixed(2)}x local | ${(gate.bytes / 1048576).toFixed(2)} MiB`,
    status, workDir: path.join(runDir, "sheet"),
  });
  const indexed = stills.finish(sheetFile);
  writeFileSync(path.join(out, "poster.png"), readFileSync(path.join(stills.dir, "poster.png")));
  const report = formatCoverReport(gate, { strict: true });
  writeFileSync(path.join(out, "gate-report.txt"), report);
  const manifest = {
    schema: "litgravity.motion-cover/v1", mode: "cover", round, recipe: treatment.recipe,
    treatmentSha256: sha256(readFileSync(path.join(out, "treatment.json"))), stillsSha256: indexed.sha256,
    page: treatment.page, size: treatment.out, scale: COVER.captureScale, fps: treatment.fps, frames: times.length, frameMs: ms,
    encoder: encoded.encoder, encode: treatment.encode, file: path.basename(encoded.file), bytes: statSync(encoded.file).size, captureSec,
    gate: { pass: gate.pass, target: gate.target, medianD: gate.medianD, movingFrac: gate.movingFrac, longestStillSec: gate.longestStillSec, spike: gate.spike, seamLocal: gate.seamLocal, gates: gate.gates },
  };
  writeJson(path.join(out, "manifest.json"), manifest);
  if (!flash.pass) {
    const held = path.join(out, "withheld");
    mkdirSync(held, { recursive: true });
    renameSync(encoded.file, path.join(held, path.basename(encoded.file)));
    rmSync(path.join(out, "poster.png"), { force: true });
  }
  const verdict = gate.target ? "PASS+TARGET" : gate.pass ? "PASS(floor)" : "FAIL";
  const failed = Object.entries(gate.gates).filter(([, v]) => v.pass === false || v.target === false).map(([k]) => k);
  const message = `${report}cover: ${path.basename(encoded.file)} ${manifest.bytes} bytes, ${times.length} frames at ${treatment.fps} fps, ${w}x${h} (captured ${pw * COVER.captureScale}x${ph * COVER.captureScale}) in ${captureSec.toFixed(0)} s; stills and sheet in ${path.join(out, STILLS_DIR)}`;
  if (verdict === "PASS+TARGET") return { code: EXIT.OK, message, gate: manifest.gate };
  return { code: EXIT.GATE_FAIL_QA, message: `${message}\nGATE_FAIL_QA: ${failed.join(", ")} ${gate.pass ? "miss the cover TARGET" : "fail"}${flash.pass ? "" : " (flash audit failed: the cover is withheld)"}; see ${path.join(out, "gate-report.txt")}`, gate: manifest.gate };
}


/**
 * `--window t0,t1` (seconds into the loop): capture only the frames from t0 - 0.5 s to t1 + 0.5 s
 * (wrapping at the seam) in a fresh page and sheet them, with the span itself shaded on the plot.
 * It reads the same treatment, page and asset list as a full render and writes only under
 * `windows/round-N/`; the stills, the cover file, the report and the manifest stay untouched, so a
 * window render never counts as done.
 */
export async function renderCoverWindow({ out, round = 1, window: [t0, t1], env = process.env, log = () => {} }) {
  const { treatment, stageDir, faces } = prepare({ out, env, log });
  const ms = frameMs(treatment.fps);
  const total = (treatment.frames * ms) / 1000;
  if (!(Number.isFinite(t0) && Number.isFinite(t1) && t0 >= 0 && t1 >= t0 && t1 <= total)) throw new BlockedError(EXIT.USAGE, `--window takes t0,t1 in seconds with 0 <= t0 <= t1 <= ${total.toFixed(3)}`);
  const lo = t0 - COVER.windowPadSec;
  const hi = t1 + COVER.windowPadSec;
  const picks = [];
  for (let i = 0; i < treatment.frames; i++) {
    for (const k of [-1, 0, 1]) {
      const t = (i * ms) / 1000 + k * total;
      if (t >= lo - 1e-9 && t <= hi + 1e-9) picks.push({ index: i, t: +t.toFixed(3) });
    }
  }
  picks.sort((a, b) => a.t - b.t);
  const dir = path.join(out, "windows", `round-${round}`, `${t0.toFixed(3)}-${t1.toFixed(3)}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const [w, h] = treatment.out;
  const pool = new CoverPool();
  const browser = await CoverBrowser.open({ stageDir, faces, width: treatment.page[0], height: treatment.page[1], scale: COVER.captureScale, profileDir: path.join(out, ".run", "cover-window-chrome"), env, log });
  try {
    await capturePass({ browser, pool, times: [...new Set(picks.map((p) => p.index))].map((i) => [i, i / treatment.frames]), dir, prefix: "f", width: w, height: h });
  } finally {
    await browser.close();
    await pool.close();
  }
  const file = (i) => path.join(dir, `f${String(i).padStart(4, "0")}.png`);
  const lumas = picks.map((p) => {
    const img = readPngRgba(file(p.index));
    return lumaGrid(img.rgba, img.width, img.height).luma;
  });
  const diffs = lumas.slice(1).map((l, k) => {
    let sum = 0;
    for (let i = 0; i < l.length; i++) sum += Math.abs(l[i] - lumas[k][i]);
    return sum / l.length / 255;
  });
  const sorted = [...diffs].sort((a, b) => a - b);
  const medianD = sorted.length ? sorted[sorted.length >> 1] : 0;
  const tileCount = Math.min(SHEET_TILES, picks.length);
  const tiles = Array.from({ length: tileCount }, (_, k) => picks[Math.round((k * (picks.length - 1)) / Math.max(1, tileCount - 1))])
    .map((p) => ({ file: file(p.index), caption: `t=${p.t.toFixed(3)} s  frame ${p.index}` }));
  await renderSheet({
    file: path.join(dir, "sheet.png"), tiles, diffs, medianD, durationSec: hi - lo, marks: [{ t0: t0 - lo, t1: t1 - lo }], faces, env, log,
    label: `window ${t0.toFixed(3)}-${t1.toFixed(3)} s (shaded) with ${COVER.windowPadSec} s on each side | ${picks.length} frames before encoding`,
    status: "a window render never counts as done", workDir: path.join(out, ".run", "cover-window-sheet"),
  });
  writeJson(path.join(dir, "window.json"), { schema: "litgravity.motion-cover-window/v1", round, t0, t1, padSec: COVER.windowPadSec, frames: picks, note: "frames before encoding; a window render never counts as done" });
  return { code: EXIT.OK, message: `WINDOW round ${round}: ${picks.length} frames from ${lo.toFixed(3)} to ${hi.toFixed(3)} s; sheet in ${path.join(dir, "sheet.png")}\na window render never counts as done: fix the cause, then render the full cover` };
}
