// The stage path: a model-authored page captured frame by frame on a virtual clock (director brief
// section 6). One round: treatment check -> static scan -> fonts -> master Chrome steps every frame
// from 0 and captures it -> decode and analyse in a worker pool -> ffmpeg (with the sound bed) ->
// stills set -> in parallel, a fresh Chrome replays the clock from 0 for the determinism samples and
// another replays it for the DOM text QA -> preview by decimating master frames -> gate -> deliver,
// or withhold on a flash-audit FAIL. `--stills-only` stops after the stills set, with no encode.
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EXIT, GATE, PREVIEW } from "../core/constants.mjs";
import { FlashDetector, cellsFromRgba, detectSequence, gridFor } from "../core/flash.mjs";
import { areaDownscale } from "./analysis.mjs";
import { assetUsed } from "./assets.mjs";
import { BLENDER } from "./blender.mjs";
import { addToStills, writeBoard } from "./board.mjs";
import { BlockedError } from "./chrome.mjs";
import { findFfmpeg, findFfprobe, findImg2webp, previewRungs, startMaster, encodePreview, probeVideo } from "./encode.mjs";
import { resolveViewed, asBlocked } from "./pipeline.mjs";
import { encodePng, rgbaToRgb } from "./png.mjs";
import { auditMuxed } from "./sound.mjs";
import { soundTrackFor } from "./sound-cli.mjs";
import { StageBrowser, FramePool, analyzeChecked } from "./stage-capture.mjs";
import { evaluateStageGate, formatStageReport } from "./stage-gate.mjs";
import { textQaReplay } from "./stage-qa.mjs";
import { treatmentSha } from "./done.mjs";
import { recordHouse } from "./house.mjs";
import { styleCss, styleScript, readStyle } from "./styles.mjs";
import { scanStage, stageFonts } from "./stage-serve.mjs";
import { beatCuts, stillsPlan, writeStills } from "./stills.mjs";
import { FORMATS, loadTreatment } from "./treatment.mjs";

export const DELIVERABLES = ["film.mp4", "preview.webp", "preview.gif", "poster.png", "reduced-motion.png"];
export const DETERMINISM_SAMPLES = Object.freeze({ min: 8, max: 16 });

const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
/** The house style the page is served (/lit/style.css, /lit/style.js) for this treatment and format. */
export const styleAssets = (treatment) => {
  const style = readStyle(treatment.style);
  return { style, css: styleCss(style, treatment.format), js: styleScript(style, treatment.format, treatment) };
};
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(1) : null;
};

/** The beat stills of a stills set, as absolute paths, in beat order. */
export const beatStillFiles = (out, stills) => stills.index.files.filter((f) => f.kind === "beat").sort((a, b) => a.beat - b.beat).map((f) => path.join(out, f.file));

/** Determinism samples: frame 0, the last frame, each beat's first frame, beat midpoints to 8, at most 16. */
export function determinismFrames({ beats, fps, frameCount }) {
  const clamp = (f) => Math.max(0, Math.min(frameCount - 1, f));
  const base = [0, frameCount - 1, ...beats.map((b) => clamp(Math.round(b.t0 * fps)))];
  let set = [...new Set(base)].sort((a, b) => a - b);
  for (const b of beats) {
    if (set.length >= DETERMINISM_SAMPLES.min) break;
    set = [...new Set([...set, clamp(Math.round(((b.t0 + b.t1) / 2) * fps))])].sort((a, b) => a - b);
  }
  for (let k = 1; set.length < DETERMINISM_SAMPLES.min && k < 64; k++) set = [...new Set([...set, clamp(Math.round((k * (frameCount - 1)) / 8))])].sort((a, b) => a - b);
  if (set.length > DETERMINISM_SAMPLES.max) {
    const keep = new Set([set[0], set[set.length - 1]]);
    for (let i = 0; keep.size < DETERMINISM_SAMPLES.max; i++) keep.add(set[Math.round((i * (set.length - 1)) / (DETERMINISM_SAMPLES.max - 1))]);
    set = [...keep].sort((a, b) => a - b);
  }
  return set;
}

/** The first 64x64 block where two RGBA frames differ, as "x,y wxh". */
export function firstDifference(a, b, width, height) {
  const block = 64;
  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      for (let y = by; y < Math.min(height, by + block); y++) {
        const o = (y * width + bx) * 4;
        const n = Math.min(width - bx, block) * 4;
        if (Buffer.compare(a.subarray(o, o + n), b.subarray(o, o + n)) !== 0) return `${bx},${by} ${Math.min(block, width - bx)}x${Math.min(block, height - by)}`;
      }
    }
  }
  return null;
}

function violationExit(state, router) {
  if (router.refused.length) {
    const first = router.refused[0];
    return new BlockedError(EXIT.STAGE_NETWORK_REQUEST, `STAGE_NETWORK_REQUEST: the page requested ${first.url.slice(0, 160)} (${first.reason}); everything on the stage is local`);
  }
  const net = state.violations.find((v) => v.kind === "network");
  if (net) return new BlockedError(EXIT.STAGE_NETWORK_REQUEST, `STAGE_NETWORK_REQUEST: the page used ${net.name}`);
  const v = state.violations[0];
  if (v) return new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: the page used ${v.name}, which a stage page may not use`);
  return null;
}

/**
 * Open a stage browser on the round's rung and check the page's LitStage contract. A 3D film asks for
 * the GPU rung; when that rung cannot launch or gives the page no WebGL, the round falls back to the
 * software rung for every browser (master and replays must share one rung) and records a notice.
 */
async function openChecked({ label, ctx }) {
  if (ctx.rung === "gpu") {
    try {
      const browser = await openOnRung({ label, ctx });
      if (!browser.state.webglMissing) return browser;
      await browser.close();
      ctx.notices.push("the 3D route asked for the GPU rung and the page got no WebGL there; rendered on the software rung (SwiftShader), slower, same frames");
    } catch (error) {
      if (error instanceof BlockedError) throw error;
      ctx.notices.push(`the 3D route asked for the GPU rung and it did not start (${String(error.message).slice(0, 120)}); rendered on the software rung (SwiftShader), slower, same frames`);
    }
    ctx.rung = "software";
  }
  return openOnRung({ label, ctx });
}

async function openOnRung({ label, ctx }) {
  const { stageDir, faces, scan, width, height, treatment, runDir, env, log } = ctx;
  const browser = await StageBrowser.open({ stageDir, faces, style: ctx.style, rasters: scan.rasters, width, height, seed: treatment.seed, profileDir: path.join(runDir, `c${process.pid % 100000}${label}`), rung: ctx.rung, env, log });
  const state = browser.state;
  const fail = (message) => new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${message}`);
  const early = violationExit(state, browser.router);
  let error = early;
  const spec = state.spec;
  if (!error && !spec) error = fail(`the page never called LitStage.define (or set window.litStage)${state.errors.length ? `; first page error: ${state.errors[0]}` : ""}`);
  else if (!error && (spec.width !== width || spec.height !== height)) error = fail(`the page defines ${spec.width}x${spec.height}, the ${treatment.format} format is ${width}x${height}`);
  else if (!error && spec.render !== "function") error = fail("LitStage.define needs render(t)");
  else if (!error && spec.fps !== (treatment.fps ?? 60)) error = fail(`the page runs at ${spec.fps} fps; the treatment asks for ${treatment.fps ?? 60} (30 only when the treatment says fps: 30)`);
  else if (!error && !(spec.duration > 0)) error = fail("the page's duration must be a positive number of seconds");
  if (!error && state.webglMissing) error = new BlockedError(EXIT.BLOCKED_NO_WEBGL2, `BLOCKED_NO_WEBGL2: the page asked for a WebGL context and the ${ctx.rung} rung gave none`);
  if (!error && browser.prepared?.failedFaces?.length) log(`warning: faces that did not load: ${browser.prepared.failedFaces.join(", ")}`);
  if (error && !(ctx.rung === "gpu" && error.code === EXIT.BLOCKED_NO_WEBGL2)) {
    await browser.close();
    throw error;
  }
  return browser;
}

async function stepChecked(browser, f, fps, opts) {
  const s = await browser.step(f, fps, opts);
  if (s.violations > 0 || browser.router.refused.length) {
    const error = violationExit(await browser.pageState(), browser.router);
    if (error) throw error;
  }
  return s;
}

/**
 * Stills-only, or the frames a caller needs, stepping the clock from 0. Stills skip the paint between
 * wanted frames. The determinism replay passes `asMaster`: it paints and captures every frame exactly
 * as the master does and keeps only the wanted ones, because an element whose opacity and transform
 * change together can raster one level apart depending on which earlier frames were painted and
 * captured (the replay would then flag the renderer, not the page).
 */
async function captureFrames({ browser, pool, fps, frames, width, height, asMaster = false }) {
  const wanted = [...frames].sort((a, b) => a - b);
  const last = wanted[wanted.length - 1];
  const out = new Map();
  const pending = [];
  const want = new Set(wanted);
  for (let f = 0; f <= last; f++) {
    await stepChecked(browser, f, fps, { paint: asMaster || want.has(f) });
    if (!want.has(f)) {
      if (asMaster) await browser.capture();
      continue;
    }
    const png = await browser.capture();
    pending.push(analyzeChecked(pool, png, width, height).then((a) => out.set(f, a)));
  }
  await Promise.all(pending);
  return out;
}

/**
 * The browser rung: a three.js world asks for the GPU; a Blender film shows its path-traced plate
 * under HTML type, so its page needs only the software rung, and it needs the plate, all of it.
 */
export function stageRung(treatment, scan, out) {
  if (treatment.render3d !== "blender") return treatment.depth === "3d" ? "gpu" : "software";
  const want = Math.round(treatment.durationSec * BLENDER.plateFps);
  if (!scan.plate) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: render3d is blender but stage/plate/plate.json is missing or does not match its frames; render the plate first: blender --out ${out} --final (no Blender: set render3d to three and use the GPU rung)`);
  if (scan.plate.frames.length !== want) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: the plate has ${scan.plate.frames.length} frames; a ${treatment.durationSec} s film needs ${want} at ${BLENDER.plateFps} fps (render it again: blender --out ${out} --final)`);
  return "software";
}

function renderId(treatment, scan) {
  const h = createHash("sha256").update(JSON.stringify(treatment));
  for (const f of scan.files) h.update(f.rel).update(readFileSync(f.real));
  return h.digest("hex").slice(0, 16);
}

/** The preview ladder from the decimated master frames written during the master pass. */
function buildPreview({ out, ffmpeg, env, width, height, frameCount, fps }) {
  const runDir = path.join(out, ".run");
  const sourceDir = path.join(runDir, "preview-src");
  const encoders = previewRungs(ffmpeg, env);
  const img2webp = findImg2webp(env);
  const attempts = [];
  const landscape = width >= height;
  const sources = readdirSync(sourceDir).filter((f) => /^\d{5}\.rgba$/u.test(f)).sort();
  const srcFps = PREVIEW.rungs[0].fps;
  const [sw, sh] = previewSize(width, height, PREVIEW.rungs[0].width);
  for (const rung of PREVIEW.rungs) {
    const [pw, ph] = previewSize(width, height, rung.width);
    const dir = path.join(runDir, "preview", `${rung.width}x${rung.fps}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const count = Math.max(1, Math.round((frameCount / fps) * rung.fps));
    const cells = [];
    const grid = gridFor(pw, ph);
    for (let i = 0; i < count; i++) {
      const src = Math.min(sources.length - 1, Math.round((i * srcFps) / rung.fps));
      let rgba = readFileSync(path.join(sourceDir, sources[src]));
      if (pw !== sw) rgba = areaDownscale(rgba, sw, sh, pw, ph);
      cells.push(cellsFromRgba(rgba, pw, ph, undefined, grid));
      writeFileSync(path.join(dir, `${String(i).padStart(5, "0")}.png`), encodePng(rgbaToRgb(rgba, pw, ph), pw, ph, 3, { level: 1 }));
    }
    const records = detectSequence(cells, { loop: true, grid });
    for (const encoder of encoders) {
      const file = path.join(runDir, "stage", encoder === "gif" ? "preview.gif" : "preview.webp");
      const result = encodePreview({ encoder, ffmpeg, img2webp, dir, fps: rung.fps, out: file });
      if (result.code !== 0 || !existsSync(file)) {
        attempts.push({ ...rung, encoder, error: result.stderr.slice(-200) });
        continue;
      }
      const bytes = statSync(file).size;
      attempts.push({ ...rung, encoder, bytes });
      if (bytes <= GATE.previewCapBytes) {
        rmSync(dir, { recursive: true, force: true });
        return { file, encoder, rung, bytes, records, attempts, landscape };
      }
      rmSync(file, { force: true });
    }
    rmSync(dir, { recursive: true, force: true });
  }
  return { file: null, encoder: null, rung: null, bytes: null, records: null, attempts, landscape };
}

/** The frame's own gate geometry: title-safe and action-safe insets, flash grid and window. */
export function geometryFor(width, height) {
  const g = gridFor(width, height);
  const inset = (k) => [Math.round(width * k), Math.round(height * k), Math.round(width * (1 - k)), Math.round(height * (1 - k))];
  return { titleSafe: inset(0.05), actionSafe: inset(0.025), flashGrid: [g.gw, g.gh], flashWindow: [g.ww, g.wh], contrastScale: Math.min(width, height) / 1080, previewLongEdge: PREVIEW.rungs[0].width };
}

/**
 * Capture chosen frames of a stage page in a fresh Chrome that steps the clock from 0 (for tests and
 * diagnostics). Returns Map(frame -> RGBA).
 */
export async function captureStageFrames({ out, frames, env = process.env, log = () => {} }) {
  const treatment = asBlocked(() => loadTreatment(out, { pathName: "stage" }));
  const stageDir = path.join(out, "stage");
  const [width, height] = FORMATS[treatment.format];
  const scan = scanStage(stageDir);
  const faces = stageFonts(env);
  const runDir = path.join(out, ".run");
  mkdirSync(runDir, { recursive: true });
  const ctx = { stageDir, faces, scan, width, height, treatment, runDir, env, log, style: styleAssets(treatment), rung: stageRung(treatment, scan, out), notices: [] };
  const browser = await openChecked({ label: "x", ctx });
  const pool = new FramePool(2);
  try {
    const got = await captureFrames({ browser, pool, fps: browser.state.spec.fps, frames: new Set(frames), width, height });
    return new Map([...got].map(([f, a]) => [f, a.rgba]));
  } finally {
    await pool.close();
    await browser.close();
  }
}

/** Preview rungs are keyed on the long edge (960, 720, 540). */
export function previewSize(width, height, longEdge) {
  return width >= height ? [longEdge, Math.round((longEdge * height) / width)] : [Math.round((longEdge * width) / height), longEdge];
}

/** A poster PNG within the 1 MB cap: RGB first, then a 256-colour palette PNG through ffmpeg. */
function writePoster({ rgba, width, height, file, ffmpeg }) {
  writeFileSync(file, encodePng(rgbaToRgb(rgba, width, height), width, height, 3, { level: 9 }));
  if (statSync(file).size <= GATE.posterCapBytes || !ffmpeg) return "rgb";
  const tmp = `${file}.rgb.png`;
  renameSync(file, tmp);
  const r = spawnSyncSafe(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", tmp, "-vf", "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a", "-frames:v", "1", file]);
  if (r !== 0 || !existsSync(file)) {
    renameSync(tmp, file);
    return "rgb";
  }
  rmSync(tmp, { force: true });
  return "palette";
}

const spawnSyncSafe = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8" }).status;

function promote(out, flashFail) {
  const stage = path.join(out, ".run", "stage");
  const names = existsSync(stage) ? readdirSync(stage).filter((f) => DELIVERABLES.includes(f)) : [];
  const dest = flashFail ? path.join(out, "withheld") : out;
  mkdirSync(dest, { recursive: true });
  for (const name of names) renameSync(path.join(stage, name), path.join(dest, name));
  return { withheld: flashFail, dir: dest };
}

function clearOutputs(out) {
  for (const name of [...DELIVERABLES, "manifest.json", "render.jsonl", "gate-report.txt"]) rmSync(path.join(out, name), { force: true });
  for (const dir of ["withheld", path.join(".run", "stage"), path.join(".run", "preview"), path.join(".run", "preview-src")]) rmSync(path.join(out, dir), { recursive: true, force: true });
}

function progress(out, value) {
  try {
    writeJson(path.join(out, ".run", "progress.json"), { ...value, pid: process.pid, updatedAt: new Date().toISOString() });
  } catch {
    // Progress is advisory; a render never fails on it.
  }
}

/**
 * Render one stage round. Returns { code, message, ... }; throws BlockedError for 10/11/14-19.
 * `qa` (optional) is the DOM text-QA replay, run in its own Chrome in parallel with the master.
 */
export async function renderStage({ out, round = 1, stillsOnly = false, env = process.env, log = () => {}, qa = null }) {
  if (!(round >= 1 && round <= 3)) throw new BlockedError(EXIT.USAGE, "--round must be 1..3");
  const t0 = Date.now();
  const treatment = asBlocked(() => loadTreatment(out, { pathName: "stage" }));
  const stageDir = path.join(out, "stage");
  const [width, height] = FORMATS[treatment.format];
  const scan = scanStage(stageDir);
  for (const w of scan.warnings) log(`warning: ${w}`);
  const faces = stageFonts(env);
  const runDir = path.join(out, ".run");
  mkdirSync(runDir, { recursive: true });
  const ffmpeg = findFfmpeg(env);
  const ctx = { stageDir, faces, scan, width, height, treatment, runDir, env, log, style: styleAssets(treatment), rung: stageRung(treatment, scan, out), notices: [] };
  progress(out, { phase: "open", round, stillsOnly });
  const master = await openChecked({ label: "m", ctx });
  const spec = master.state.spec;
  const fps = spec.fps;
  const frameCount = Math.round(spec.duration * fps);
  const beats = treatment.beats;
  const cuts = beatCuts(beats, fps, frameCount);
  const plan = stillsPlan({ beats, fps, frameCount, cuts, posterBeat: treatment.posterBeat });
  const pool = new FramePool();
  const id = renderId(treatment, scan);
  try {
    if (stillsOnly) {
      const frames = await captureFrames({ browser: master, pool, fps, frames: plan.all, width, height });
      const stills = writeStills({ out, plan, frames: new Map([...frames].map(([f, a]) => [f, a.rgba])), width, height, fps, frameCount, round, stillsOnly: true, path: "stage" });
      // The board round: the text and style rules run on the board frames before any film is encoded,
      // and the storyboard is drawn with the verdict on it.
      progress(out, { phase: "board-check", round, stillsOnly });
      const replayQa = qa ?? textQaReplay({ pool, stageFiles: scan.files.map((f) => path.basename(f.rel)) });
      const check = await replayQa({ ctx, fps, frameCount, plan, openBrowser: (label) => openChecked({ label, ctx }), stepChecked });
      const assetRule = assetUsed(treatment, scan.files);
      if (assetRule) check.rules.push(assetRule);
      writeJson(path.join(out, "stills", "check.json"), { rules: check.rules });
      const boardFile = await writeBoard({ out, treatment, beatFiles: beatStillFiles(out, stills), check, env, log });
      stills.sha256 = addToStills(out, { file: "stills/board.png", kind: "board", frames: plan.beats }, { sha256 });
      progress(out, { phase: "done", round, stillsOnly });
      const failed = check.rules.filter((x) => x.status === "FAIL");
      if (check.exit) return { code: check.exit, message: `${check.message} (board check; the storyboard is ${boardFile})`, stills, renderId: id, check };
      if (failed.length) {
        return {
          code: EXIT.GATE_FAIL_QA,
          message: `BOARD_CHECK_FAIL: ${failed.map((x) => `${x.id} ${x.detail}`).join("; ")}. Fix the page, render --stills-only again, then look at the board ${boardFile} and every file in ${path.join(out, "stills")}`,
          stills, renderId: id, check,
        };
      }
      return {
        code: EXIT.OK,
        message: `STILLS_ONLY: board check PASS; open the storyboard ${boardFile} and every file in ${path.join(out, "stills")} (index.json lists them), record the round with look --round ${round}, make the change, then render the film with --round ${round + 1} (no --stills-only)`,
        stills, renderId: id, check,
      };
    }
    if (!ffmpeg) {
      const frames = await captureFrames({ browser: master, pool, fps, frames: plan.all, width, height });
      writeStills({ out, plan, frames: new Map([...frames].map(([f, a]) => [f, a.rgba])), width, height, fps, frameCount, round, stillsOnly: true, path: "stage" });
      return { code: EXIT.BLOCKED_NO_FFMPEG_FOR_VIDEO, message: `BLOCKED_NO_FFMPEG_FOR_VIDEO: ffmpeg is not on PATH; the stills and contact sheet are in ${path.join(out, "stills")}; install ffmpeg for the film` };
    }
    clearOutputs(out);
    const stageOut = path.join(runDir, "stage");
    mkdirSync(stageOut, { recursive: true });
    const sound = soundTrackFor({ treatment, out, stageDir, frameCount, fps, cutTimes: cuts.map((c) => c / fps), ffmpeg });
    const filmPath = path.join(stageOut, "film.mp4");
    const encoder = startMaster({ ffmpeg, width, height, fps, out: filmPath, audio: sound.file });

    // The replays start with the master: each is its own Chrome stepping its own clock from 0.
    const detFrames = determinismFrames({ beats, fps, frameCount });
    const detPromise = (async () => {
      const browser = await openChecked({ label: "d", ctx });
      try {
        return await captureFrames({ browser, pool, fps, frames: new Set(detFrames), width, height, asMaster: true });
      } finally {
        await browser.close();
      }
    })();
    detPromise.catch(() => {});
    const replayQa = qa ?? textQaReplay({ pool, stageFiles: scan.files.map((f) => path.basename(f.rel)) });
    const qaPromise = replayQa({ ctx, fps, frameCount, plan, openBrowser: (label) => openChecked({ label, ctx }), stepChecked });
    qaPromise.catch(() => {});

    const [pw, ph] = previewSize(width, height, PREVIEW.rungs[0].width);
    const previewDir = path.join(runDir, "preview-src");
    mkdirSync(previewDir, { recursive: true });
    const previewEvery = fps / PREVIEW.rungs[0].fps;
    const detector = new FlashDetector(gridFor(width, height));
    const lines = [];
    const kept = new Map();
    const detMaster = new Map();
    const frameMs = [];
    const inflight = [];
    const maxInflight = pool.workers.length + 1;
    let poster = null;
    const consume = async (entry) => {
      const a = await entry.analysis;
      await encoder.write(a.rgba);
      const flash = detector.push(a.cells);
      lines.push({ frame: entry.f, artifact: "master", rgbaSha256: a.rgbaSha256, luminanceP995: a.luminanceP995, luminanceP005: a.luminanceP005, busy: a.busy, flash });
      if (plan.all.has(entry.f)) kept.set(entry.f, a.rgba);
      if (detFrames.includes(entry.f)) detMaster.set(entry.f, a);
      if (entry.f % previewEvery === 0) {
        const small = areaDownscale(a.rgba, width, height, pw, ph);
        writeFileSync(path.join(previewDir, `${String(entry.f / previewEvery).padStart(5, "0")}.rgba`), small);
      }
      if (entry.f === plan.poster) poster = writePoster({ rgba: a.rgba, width, height, file: path.join(stageOut, "poster.png"), ffmpeg });
      if (entry.f === plan.reduced) writeFileSync(path.join(stageOut, "reduced-motion.png"), encodePng(rgbaToRgb(a.rgba, width, height), width, height, 3, { level: 9 }));
    };
    const tMaster = Date.now();
    for (let f = 0; f < frameCount; f++) {
      const ts = performance.now();
      await stepChecked(master, f, fps, { paint: true });
      const png = await master.capture();
      frameMs.push(performance.now() - ts);
      inflight.push({ f, analysis: analyzeChecked(pool, png, width, height) });
      if (inflight.length >= maxInflight) await consume(inflight.shift());
      if (f % 30 === 0) progress(out, { phase: "master", frame: f, frameCount, round });
    }
    while (inflight.length) await consume(inflight.shift());
    const encoded = await encoder.finish();
    if (encoded.code !== 0) throw new Error(`ffmpeg master encode failed (${encoded.code}): ${encoded.stderr.slice(-400)}`);
    const masterSec = (Date.now() - tMaster) / 1000;
    const finalState = await master.pageState();
    writeFileSync(path.join(out, "render.jsonl"), `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);

    progress(out, { phase: "determinism", round });
    const replay = await detPromise;
    const detRows = detFrames.map((f) => ({ frame: f, master: detMaster.get(f)?.rgbaSha256, replay: replay.get(f)?.rgbaSha256 }));
    const mismatch = detRows.find((r) => r.master !== r.replay);
    const determinism = mismatch
      ? { status: "FAIL", frames: detRows, firstMismatch: { frame: mismatch.frame, region: firstDifference(detMaster.get(mismatch.frame).rgba, replay.get(mismatch.frame).rgba, width, height) } }
      : { status: "PASS", frames: detRows };
    writeJson(path.join(runDir, "determinism.json"), determinism);

    progress(out, { phase: "qa", round });
    const qaResult = await qaPromise;

    progress(out, { phase: "preview", round });
    const preview = buildPreview({ out, ffmpeg, env, width, height, frameCount, fps });
    const probe = probeVideo(filmPath, env);
    const soundAudit = auditMuxed({ ffmpeg, ffprobe: findFfprobe(env), film: filmPath, videoDurationSec: frameCount / fps, mode: sound.mode });
    const exports = {
      film: existsSync(filmPath) ? { bytes: statSync(filmPath).size } : null,
      preview: preview.file ? { bytes: preview.bytes, kind: path.extname(preview.file).slice(1) } : null,
      poster: existsSync(path.join(stageOut, "poster.png")) ? { bytes: statSync(path.join(stageOut, "poster.png")).size } : null,
      reducedMotion: existsSync(path.join(stageOut, "reduced-motion.png")) ? { bytes: statSync(path.join(stageOut, "reduced-motion.png")).size } : null,
    };
    const gate = evaluateStageGate({
      masterFlash: lines.map((l) => l.flash), previewFlash: preview.records ? { records: preview.records, fps: preview.rung.fps } : null, fps,
      probe, width, height, treatment, exports, reducedFrame: plan.reduced, frames: lines, usesWebGL: finalState.usesWebGL, renderer: finalState.webglRenderer, rung: ctx.rung,
      determinism, extraRules: [...soundAudit.rules, ...(qaResult?.rules ?? []), assetUsed(treatment, scan.files)].filter(Boolean),
    });
    const promoted = promote(out, gate.flashFail);
    const loc = (name) => path.join(promoted.dir, name);
    const stills = writeStills({ out, plan, frames: kept, width, height, fps, frameCount, round, stillsOnly: false, path: "stage", posterFile: existsSync(loc("poster.png")) ? loc("poster.png") : null });
    await writeBoard({ out, treatment, beatFiles: beatStillFiles(out, stills), check: qaResult, env, log });
    stills.sha256 = addToStills(out, { file: "stills/board.png", kind: "board", frames: plan.beats }, { sha256 });
    if (gate.pass && !promoted.withheld) recordHouse(out, { style: treatment.style, path: "stage", format: treatment.format, durationSec: treatment.durationSec });
    const totalSec = (Date.now() - t0) / 1000;
    const manifest = {
      schemaVersion: 1, path: "stage", renderId: id, round, treatmentSha256: treatmentSha(out), format: treatment.format, width, height, fps, durationSec: spec.duration, treatmentDurationSec: treatment.durationSec,
      frameCount, seed: treatment.seed, renderer: finalState.webglRenderer ?? "no WebGL", rung: ctx.rung, chromeFlags: master.flags, usesWebGL: finalState.usesWebGL,
      cuts, stills: { sha256: stills.sha256, poster: plan.poster, reduced: plan.reduced }, posterEncoding: poster,
      geometry: geometryFor(width, height),
      plate: scan.plate ? { blender: scan.plate.blender, engine: scan.plate.engine, device: scan.plate.device, samples: scan.plate.samples, fps: scan.plate.fps, frames: scan.plate.frames.length } : null,
      sound: { mode: sound.mode, label: sound.label, file: sound.file ? path.relative(out, sound.file) : null, sha256: sound.file ? sha256(readFileSync(sound.file)) : null, lufs: sound.bed?.lufs ?? null },
      preview: { encoder: preview.encoder, rung: preview.rung, attempts: preview.attempts },
      pageErrors: finalState.errors, missingAssets: master.router.missing,
      timing: { frameP50Ms: percentile(frameMs, 0.5), frameP95Ms: percentile(frameMs, 0.95), masterSec: +masterSec.toFixed(1), totalSec: +totalSec.toFixed(1) },
      warnings: [...ctx.notices, ...scan.warnings, ...master.router.missing.map((m) => `the page asked for a missing file ${m.url} (${m.reason})`)],
      generatedAt: new Date().toISOString(),
    };
    writeJson(path.join(out, "manifest.json"), manifest);
    const report = formatStageReport({
      gate, manifest, round, framesViewed: resolveViewed(out, 0), withheld: promoted.withheld,
      outputs: { film: loc("film.mp4"), preview: preview.file ? loc(path.basename(preview.file)) : "(no preview under 3 MB)", poster: loc("poster.png"), still: loc("reduced-motion.png") },
    });
    writeFileSync(path.join(out, "gate-report.txt"), report);
    rmSync(previewDir, { recursive: true, force: true });
    progress(out, { phase: "done", round });
    const code = determinism.status !== "PASS" ? EXIT.STAGE_NONDETERMINISTIC
      : qaResult?.exit ? qaResult.exit
        : soundAudit.exitCode ? soundAudit.exitCode
          : gate.pass ? EXIT.OK : EXIT.GATE_FAIL_QA;
    const message = code === EXIT.STAGE_NONDETERMINISTIC
      ? `STAGE_NONDETERMINISTIC: frame ${determinism.firstMismatch.frame} differs between the master and a fresh replay (first differing region ${determinism.firstMismatch.region}); the page read something the clock does not drive`
      : code === qaResult?.exit ? qaResult.message
        : code === EXIT.SOUND_INVALID ? `SOUND_INVALID: ${soundAudit.rules.filter((x) => x.status === "FAIL").map((x) => `${x.id} ${x.detail}`).join("; ")}`
          : gate.pass ? `OK: gate PASS; film ${loc("film.mp4")}; look at ${path.join(out, "stills")} and record look --round ${round}`
            : `GATE_FAIL_QA: ${gate.failed.join(", ")}${promoted.withheld ? " (flash audit failed: exports withheld)" : ""}; see ${path.join(out, "gate-report.txt")}`;
    return { code, message, gate, manifest, stills };
  } finally {
    await pool.close();
    await master.close();
  }
}

// ---- detached full renders: the render keeps going if the calling tool times out ----

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Run a full stage render in a detached child with a progress file, and wait for it. A second call
 * while one is running attaches to it instead of starting another.
 */
export async function renderStageDetached({ out, round, cli, mode = "stage", env = process.env, log = () => {}, pollMs = 1000 }) {
  const runDir = path.join(out, ".run");
  mkdirSync(runDir, { recursive: true });
  const lock = path.join(runDir, "render.pid");
  const resultFile = path.join(runDir, "result.json");
  let pid = existsSync(lock) ? Number(readFileSync(lock, "utf8")) : null;
  if (!(pid && alive(pid))) {
    rmSync(resultFile, { force: true });
    const logFd = openSync(path.join(runDir, "render.log"), "w");
    const child = spawn(process.execPath, [cli, mode, "--out", out, "--round", String(round), "--worker"], { detached: true, stdio: ["ignore", logFd, logFd], env });
    closeSync(logFd);
    child.unref();
    pid = child.pid;
    writeFileSync(lock, String(pid));
    log(`full render running detached (pid ${pid}); progress in ${path.join(runDir, "progress.json")}`);
  } else log(`attaching to the render already running (pid ${pid})`);
  let lastPhase = null;
  for (;;) {
    if (existsSync(resultFile)) {
      const result = JSON.parse(readFileSync(resultFile, "utf8"));
      rmSync(lock, { force: true });
      return result;
    }
    if (!alive(pid)) {
      await new Promise((r) => setTimeout(r, 200));
      if (existsSync(resultFile)) continue;
      rmSync(lock, { force: true });
      const tail = existsSync(path.join(runDir, "render.log")) ? readFileSync(path.join(runDir, "render.log"), "utf8").trim().split("\n").slice(-5).join(" | ") : "";
      throw new Error(`the detached render (pid ${pid}) ended without a result: ${tail}`);
    }
    try {
      const p = JSON.parse(readFileSync(path.join(runDir, "progress.json"), "utf8"));
      const phase = `${p.phase}${p.frame !== undefined && (p.phase === "master" || p.phase === "plate") ? ` ${Math.floor((p.frame / p.frameCount) * 10) * 10}%` : ""}`;
      if (phase !== lastPhase) log(`render: ${phase}`);
      lastPhase = phase;
    } catch {
      // Not written yet.
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
