// Render modes and the one end-to-end craft round (MO-A-45, MO-C-15/16, Build 7 of the family
// brief): timeline -> pre-flight gate -> stills -> contact sheet -> [--stills-only stops] -> master,
// preview, poster, reduced-motion still into .run/stage -> determinism re-render and perf in a second
// Chrome process -> full gate -> promote, or withhold on a flash-audit FAIL.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, createWriteStream } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { EXIT, SAMPLING, PREVIEW, GATE, CREDIT_LINE, ENGINE_CREDIT, MAX_ROUNDS } from "../core/constants.mjs";
import { FlashDetector, cellsFromRgba, detectSequence } from "../core/flash.mjs";
import { evaluateGate, evaluatePreflight, isSoftware } from "../core/gate-rules.mjs";
import { measureContrast, screenBox } from "../core/contrast.mjs";
import { passSeed } from "../core/util.mjs";
import { PRESETS } from "../core/presets.mjs";
import { BlockedError } from "./chrome.mjs";
import { loadBrief, planFromBrief, BriefError } from "./brief.mjs";
import { openSession } from "./session.mjs";
import { analyzeFrame, areaDownscale } from "./analysis.mjs";
import { encodePng, rgbaToRgb, decodePng } from "./png.mjs";
import { findFfmpeg, findFfprobe, findImg2webp, previewRungs, startMaster, encodePreview, probeVideo } from "./encode.mjs";
import { checkCoverage, planFontKeys } from "./coverage.mjs";
import { nodeStatus, checkFont, loadFontManifest, audioStatus, AUDIO_WARNING, wordTimingStatus, INSTALL_COMMAND, ENGINE_ROOT } from "./runtime.mjs";
import { formatReport, formatPreflightReport } from "./report.mjs";
import { loadTreatment, TreatmentError } from "./treatment.mjs";
import { viewedCount } from "./look.mjs";
import { stillsPlan, writeStills } from "./stills.mjs";
import { addToStills, writeBoard } from "./board.mjs";
import { recordHouse } from "./house.mjs";
import { treatmentSha } from "./done.mjs";
import { auditMuxed } from "./sound.mjs";
import { soundTrackFor } from "./sound-cli.mjs";

export const DELIVERABLES = ["film.mp4", "preview.webp", "preview.gif", "poster.png", "reduced-motion.png"];

const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

class JsonLines {
  constructor(file) {
    mkdirSync(path.dirname(file), { recursive: true });
    this.stream = createWriteStream(file);
  }
  write(value) {
    this.stream.write(`${JSON.stringify(value)}\n`);
  }
  close() {
    return new Promise((resolve) => this.stream.end(resolve));
  }
}

/** Load the brief, choose the audio tier, build the plan, and check the runtime (14/15). */
export async function prepare({ briefPath, out, env = process.env, wordTiming = false, log = () => {} }) {
  // The treatment comes first on the type path too: validated before the brief, the runtime or Chrome.
  const treatment = asBlocked(() => loadTreatment(out, { pathName: "type" }));
  let brief;
  try {
    brief = loadBrief(briefPath);
  } catch (error) {
    if (error instanceof BriefError) throw new BlockedError(EXIT.USAGE, error.message);
    throw error;
  }
  const warnings = [];
  if (wordTiming || brief.wordTiming) {
    const status = wordTimingStatus();
    if (status.state !== "ready") throw new BlockedError(EXIT.BLOCKED_DEPS_NOT_PREWARMED, `BLOCKED_DEPS_NOT_PREWARMED: word timing (--word-timing) needs its pinned models and aligner runtime (${status.reason}); run ${INSTALL_COMMAND} --word-timing`);
  }
  const node = nodeStatus(env);
  if (!node.ready) throw new BlockedError(EXIT.BLOCKED_DEPS_NOT_PREWARMED, `BLOCKED_DEPS_NOT_PREWARMED: the pinned engine dependencies are not in the LitGravity cache (${node.problem}); run ${INSTALL_COMMAND} outside this session`);
  const runDir = path.join(out, ".run");
  mkdirSync(runDir, { recursive: true });
  let beatGrid = null;
  let audioTier = "text-reading-time";
  let audioFile = null;
  const analysed = brief.audio ? path.resolve(brief._dir, String(brief.audio))
    : treatment.sound.mode === "supplied" ? path.resolve(out, treatment.sound.file) : null;
  if (analysed) {
    audioFile = analysed;
    const audio = audioStatus(env);
    if (audio.state !== "ready") warnings.push(AUDIO_WARNING);
    else if (!existsSync(audioFile)) warnings.push(`audio file not found (${audioFile}); Tier 1 text reading-time is used`);
    else {
      const gridFile = path.join(runDir, "beat-grid.json");
      const result = spawnSync(audio.python, [path.join(ENGINE_ROOT, "audio", "beat_grid.py"), audioFile, gridFile], { encoding: "utf8" });
      if (result.status === 0 && existsSync(gridFile)) {
        const grid = JSON.parse(readFileSync(gridFile, "utf8"));
        if (grid.beats?.length >= 2) {
          beatGrid = grid.beats;
          audioTier = "librosa-beat-grid";
          log(`beat grid: ${grid.beats.length} beats at ${grid.tempo} BPM`);
        } else warnings.push("audio analysis found fewer than two beats; Tier 1 text reading-time is used");
      } else warnings.push(`audio analysis failed (${(result.stderr || "").trim().split("\n").pop()}); Tier 1 text reading-time is used`);
    }
  }
  const plan = asBlocked(() => planFromBrief(brief, { beatGrid, targetSec: treatment.durationSec, treatment }));
  warnings.push(...plan.warnings);
  for (const warning of warnings) log(`warning: ${warning}`);
  plan.audioTier = audioTier;
  // The beat grid only times the cuts; the track itself is muxed by the treatment's sound plan.
  const fontKeys = planFontKeys(plan);
  const manifest = loadFontManifest();
  for (const key of fontKeys) {
    const check = checkFont(key, manifest.fonts[key], env);
    if (!check.ok) throw new BlockedError(EXIT.BLOCKED_FONT_FETCH, `BLOCKED_FONT_FETCH: font ${key} is ${check.problem} in the cache (${check.path}); run ${INSTALL_COMMAND} outside this session`);
  }
  writeJson(path.join(runDir, "brief.json"), brief);
  return { brief, plan, fontKeys, warnings, runDir, treatment };
}

/** Run a treatment or brief step, turning a TreatmentError into exit 16 with the field name. */
export function asBlocked(fn) {
  try {
    return fn();
  } catch (error) {
    if (error instanceof TreatmentError) throw new BlockedError(EXIT.BLOCKED_TREATMENT_INVALID, error.message);
    throw error;
  }
}

/** Frames viewed: the latest look round wins, then the count given on the command line, then the last report's. */
export function resolveViewed(out, cli = 0) {
  const looked = viewedCount(out);
  if (looked > 0) return looked;
  if (cli > 0) return cli;
  const report = path.join(out, "gate-report.txt");
  const m = existsSync(report) ? /frames actually viewed this run: (\d+)/u.exec(readFileSync(report, "utf8")) : null;
  return m ? Number(m[1]) : 0;
}

function manifestFor(plan, extra) {
  return {
    schemaVersion: 1,
    engineCredit: ENGINE_CREDIT,
    presetId: plan.presetId,
    seed: plan.seed,
    fps: plan.fps,
    resolution: [1920, 1080],
    scale: 1,
    samples: extra.samples,
    shutter: extra.shutter,
    renderer: extra.renderer,
    softwareRenderer: isSoftware(extra.renderer),
    chromeFlags: extra.chromeFlags,
    previewEncoder: extra.previewEncoder ?? null,
    audioTier: plan.audioTier ?? "text-reading-time",
    ...(plan.beatGrid ? { beatGrid: plan.beatGrid } : { bpm: plan.bpm }),
    durationSec: +plan.durationSec.toFixed(6),
    generatedAt: new Date().toISOString(),
    passRanges: extra.passRanges,
    timeline: plan.timeline,
    warnings: extra.warnings ?? [],
    frameCount: plan.frameCount,
    round: extra.round,
    sound: extra.sound ?? null,
    treatmentSha256: extra.treatmentSha256 ?? null,
    stillOverrides: { grain: 0, noise: 0 },
  };
}

/** Pre-flight gate: timeline rules + glyph coverage. Writes the report and returns the verdict. */
export async function preflight({ plan, out, env }) {
  const coverage = await checkCoverage(plan, env);
  const manifestLike = { fps: plan.fps, bpm: plan.bpm, beatGrid: plan.beatGrid, timeline: plan.timeline };
  const result = evaluatePreflight({ manifest: manifestLike, coverage });
  writeJson(path.join(out, ".run", "preflight.json"), { ...result, coverage });
  if (!result.pass) writeFileSync(path.join(out, "gate-report.txt"), formatPreflightReport({ preflight: result, reason: plan.reason, presetId: plan.presetId }));
  return { ...result, coverage };
}

const stillFrame = (plan, shot) => Math.min(plan.frameCount - 1, Math.round((shot.start + 0.7 * (shot.end - shot.start)) * plan.fps));

/** Frames around every cut (two before, the cut, one after) plus the first and last frames. */
export function cutFrames(plan) {
  const rows = [[0, 6, Math.round(plan.frameCount * 0.02), Math.round(plan.frameCount * 0.04)].map((f) => Math.min(plan.frameCount - 1, f)).sort((a, b) => a - b)];
  for (const shot of plan.shots.slice(1)) {
    const c = Math.round(shot.start * plan.fps);
    rows.push([c - 6, c - 1, c, c + 6].map((f) => Math.max(0, Math.min(plan.frameCount - 1, f))));
  }
  rows.push([plan.frameCount - 7, plan.frameCount - 3, plan.frameCount - 2, plan.frameCount - 1].map((f) => Math.max(0, f)));
  return rows;
}

/**
 * The stills set on the type path (the same set the stage path writes): the treatment's beat
 * midpoints, a -6/0/+6 strip at each of the engine's cuts, and a 12-frame sheet. Returns the frames
 * so a full render can rewrite the index with the delivered poster.
 */
async function renderStillsSet({ session, plan, treatment, out, round, stillsOnly, env = process.env, log = () => {} }) {
  const beats = treatment.beats.map((b) => ({ t0: Math.min(b.t0, plan.durationSec), t1: Math.min(b.t1, plan.durationSec) }));
  const cuts = plan.shots.slice(1).map((sh) => Math.round(sh.start * plan.fps)).filter((c) => c > 0 && c < plan.frameCount);
  const layout = stillsPlan({ beats, fps: plan.fps, frameCount: plan.frameCount, cuts, posterBeat: treatment.posterBeat });
  const frames = new Map();
  for (const n of [...layout.all].sort((x, y) => x - y)) {
    await session.render({ from: n, to: n + 1, fps: plan.fps, samples: SAMPLING.stillSamples, shutter: SAMPLING.masterShutter, tag: "still" }, async (meta, bytes) => {
      analyzeFrame(bytes, meta.width, meta.height);
      frames.set(n, Buffer.from(bytes));
    });
  }
  // Every stills set carries the storyboard (references/studio.md), drawn from its beat stills.
  const write = async (posterFile = null) => {
    const stills = writeStills({ out, plan: layout, frames, width: 1920, height: 1080, fps: plan.fps, frameCount: plan.frameCount, round, stillsOnly, path: "type", posterFile });
    const beatFiles = stills.index.files.filter((f) => f.kind === "beat").sort((a, b) => a.beat - b.beat).map((f) => path.join(out, f.file));
    await writeBoard({ out, treatment, beatFiles, env, log });
    stills.sha256 = addToStills(out, { file: "stills/board.png", kind: "board", frames: layout.beats }, { sha256: (b) => createHash("sha256").update(b).digest("hex") });
    return stills;
  };
  return { layout, frames, stills: await write(), write };
}

function contrastFrames(plan) {
  const set = new Set();
  for (const shot of plan.shots) {
    set.add(stillFrame(plan, shot));
    set.add(Math.round(shot.end * plan.fps) - 1);
  }
  for (const row of cutFrames(plan)) for (const f of row) set.add(f);
  return set;
}

/** The master render: every frame analysed, logged, audited and piped to ffmpeg. */
async function renderMaster({ session, plan, out, ffmpeg, samples, shutter, audio = null }) {
  const runDir = path.join(out, ".run");
  const samplesDir = path.join(runDir, "samples");
  rmSync(samplesDir, { recursive: true, force: true });
  mkdirSync(samplesDir, { recursive: true });
  const stage = path.join(runDir, "stage");
  mkdirSync(stage, { recursive: true });
  const filmPath = path.join(stage, "film.mp4");
  const encoder = startMaster({ ffmpeg, width: 1920, height: 1080, fps: plan.fps, out: filmPath, audio });
  const log = new JsonLines(path.join(out, "render.jsonl"));
  const detector = new FlashDetector();
  const keep = contrastFrames(plan);
  const frames = [];
  const masterFlash = [];
  const t0 = Date.now();
  await session.render({ from: 0, to: plan.frameCount, fps: plan.fps, samples, shutter, tag: "master" }, async (meta, bytes) => {
    const n = meta.frame;
    const a = analyzeFrame(bytes, meta.width, meta.height, { keepMask: keep.has(n) });
    const flash = detector.push(a.cells);
    await encoder.write(bytes);
    for (const p of meta.passes) log.write({ frame: n, pass: p.pass, draws: p.draws, uniforms: p.uniforms });
    const line = {
      frame: n, pass: null, artifact: "master", rgbaSha256: a.rgbaSha256, inkPx: a.inkPx, luminanceP995: a.luminanceP995,
      textBoxes: meta.textBoxes, elements: meta.elements, fills: meta.fills, post: meta.post, shot: meta.shot, flash,
    };
    log.write(line);
    frames.push(line);
    masterFlash.push(flash);
    if (a.mask) {
      writeFileSync(path.join(samplesDir, `f${n}.png`), encodePng(rgbaToRgb(bytes, meta.width, meta.height), meta.width, meta.height, 3, { level: 1 }));
      writeFileSync(path.join(samplesDir, `f${n}.mask.png`), encodePng(a.mask, meta.width, meta.height, 1, { level: 1 }));
    }
  });
  const encoded = await encoder.finish();
  await log.close();
  if (encoded.code !== 0) throw new Error(`ffmpeg master encode failed (${encoded.code}): ${encoded.stderr.slice(-400)}`);
  return { frames, masterFlash, filmPath, seconds: (Date.now() - t0) / 1000, encodeArgs: encoder.args };
}

/** The preview ladder: re-render at the rung's fps, downscale, audit (looping), encode, check size. */
async function renderPreview({ session, plan, out, ffmpeg, env, minGlyphPx }) {
  const runDir = path.join(out, ".run");
  const encoders = previewRungs(ffmpeg, env);
  const img2webp = findImg2webp(env);
  const attempts = [];
  for (const rung of PREVIEW.rungs) {
    const scale = rung.width / 1920;
    if (rung.width < PREVIEW.minWidth || minGlyphPx * scale < PREVIEW.minGlyphPx) {
      attempts.push({ ...rung, skipped: `smallest glyph ${(minGlyphPx * scale).toFixed(1)} px < 10 px` });
      continue;
    }
    const height = Math.round((rung.width * 9) / 16);
    const dir = path.join(runDir, "preview", `${rung.width}x${rung.fps}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const count = Math.round(plan.durationSec * rung.fps);
    const cells = [];
    let i = 0;
    await session.render({ from: 0, to: count, fps: rung.fps, samples: SAMPLING.previewSamples, shutter: SAMPLING.masterShutter, tag: "preview" }, async (meta, bytes) => {
      analyzeFrame(bytes, meta.width, meta.height);
      const small = areaDownscale(bytes, meta.width, meta.height, rung.width, height);
      cells.push(cellsFromRgba(small, rung.width, height));
      writeFileSync(path.join(dir, `${String(i).padStart(5, "0")}.png`), encodePng(rgbaToRgb(small, rung.width, height), rung.width, height, 3, { level: 1 }));
      i += 1;
    });
    const records = detectSequence(cells, { loop: true });
    for (const encoder of encoders) {
      const outFile = path.join(runDir, "stage", encoder === "gif" ? "preview.gif" : "preview.webp");
      const result = encodePreview({ encoder, ffmpeg, img2webp, dir, fps: rung.fps, out: outFile });
      if (result.code !== 0 || !existsSync(outFile)) {
        attempts.push({ ...rung, encoder, error: result.stderr.slice(-200) });
        continue;
      }
      const bytes = statSync(outFile).size;
      attempts.push({ ...rung, encoder, bytes });
      if (bytes <= GATE.previewCapBytes) {
        rmSync(dir, { recursive: true, force: true });
        return { file: outFile, encoder, rung, bytes, records, attempts };
      }
      rmSync(outFile, { force: true });
    }
    rmSync(dir, { recursive: true, force: true });
  }
  return { file: null, encoder: null, rung: null, bytes: null, records: null, attempts };
}

async function renderStillExport({ session, plan, frame, file, samples, shutter }) {
  let result = null;
  await session.render({ from: frame, to: frame + 1, fps: plan.fps, samples, shutter, stillOverrides: { grain: 0, noise: 0 }, tag: "still-export" }, async (meta, bytes) => {
    const a = analyzeFrame(bytes, meta.width, meta.height, { keepMask: true });
    writeFileSync(file, encodePng(rgbaToRgb(bytes, meta.width, meta.height), meta.width, meta.height, 3, { level: 9 }));
    result = { frame, inkPx: a.inkPx, rgbaSha256: a.rgbaSha256, bytes: statSync(file).size };
  });
  return result;
}

/** MO-C-09 / MO-A-25: re-render the cut frames seeked, in a fresh Chrome, and compare hashes. */
export async function determinismCheck({ plan, fontKeys, out, env, frames, samples, shutter, expected, renderer, log }) {
  const pick = [...new Set(cutFrames(plan).flat())].slice(0, 12);
  const renderSet = async (softwareOnly) => {
    const session = await openSession({ plan, fontKeys, runDir: path.join(out, ".run"), env, softwareOnly, log });
    const hashes = new Map();
    try {
      for (const n of [...pick].reverse()) {
        await session.render({ from: n, to: n + 1, fps: plan.fps, samples, shutter, tag: "determinism" }, async (meta, bytes) => {
          hashes.set(n, analyzeFrame(bytes, meta.width, meta.height).rgbaSha256);
        });
      }
    } finally {
      await session.close();
    }
    return { hashes, renderer: session.renderer };
  };
  const second = await renderSet(false);
  const rows = pick.map((n) => ({ frame: n, sequential: expected.get(n), seeked: second.hashes.get(n), match: expected.get(n) === second.hashes.get(n) }));
  if (rows.every((x) => x.match)) return { status: "PASS", samples, shutter, renderer, frames: rows };
  if (isSoftware(renderer)) return { status: "FAIL", samples, shutter, renderer, frames: rows };
  // Hardware pair differed: re-check the same frames under SwiftShader in two fresh processes.
  const a = await renderSet(true);
  const b = await renderSet(true);
  const sw = pick.map((n) => ({ frame: n, a: a.hashes.get(n), b: b.hashes.get(n), match: a.hashes.get(n) === b.hashes.get(n) }));
  return { status: sw.every((x) => x.match) ? "WARN" : "FAIL", samples, shutter, renderer, frames: rows, swiftshader: sw };
}

/** MO-D-02: >= 120 evenly spaced frames at samples 1, render call to readback complete. */
export async function perfCheck({ session, plan }) {
  const count = Math.max(GATE.perfMinFrames, 120);
  const frames = Array.from({ length: count }, (_, i) => Math.min(plan.frameCount - 1, Math.round((i * (plan.frameCount - 1)) / (count - 1))));
  const ms = await session.perf(frames, plan.fps);
  const sorted = [...ms].sort((a, b) => a - b);
  return { frames: ms.length, p50: sorted[Math.floor(sorted.length * 0.5)], p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted[sorted.length - 1] };
}

function readJsonLines(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

/** Collect the gate's data from an output directory and evaluate it. */
export function collectAndEvaluate({ out, previewRecords, previewFps, determinism, perf, coverage, still, exportDir = path.join(out, ".run", "stage"), extraRules = [] }) {
  const manifest = JSON.parse(readFileSync(path.join(out, "manifest.json"), "utf8"));
  const lines = readJsonLines(path.join(out, "render.jsonl"));
  const frames = lines.filter((l) => l.pass === null && l.artifact === "master").sort((a, b) => a.frame - b.frame);
  const passLines = lines.filter((l) => l.pass !== null && l.pass !== undefined);
  const shotEvents = lines.filter((l) => l.type === "shot-events").flatMap((l) => l.shots);
  const stage = exportDir;
  const stat = (f) => (existsSync(f) ? { bytes: statSync(f).size } : null);
  const previewFile = ["preview.webp", "preview.gif"].map((f) => path.join(stage, f)).find(existsSync);
  const exports = {
    film: stat(path.join(stage, "film.mp4")),
    preview: previewFile ? { ...stat(previewFile), kind: path.extname(previewFile).slice(1) } : null,
    poster: stat(path.join(stage, "poster.png")),
    reducedMotion: stat(path.join(stage, "reduced-motion.png")),
  };
  const probe = exports.film ? probeVideo(path.join(stage, "film.mp4")) : null;
  const contrastSamples = [];
  const samplesDir = path.join(out, ".run", "samples");
  for (const fr of frames) {
    const img = path.join(samplesDir, `f${fr.frame}.png`);
    const mask = path.join(samplesDir, `f${fr.frame}.mask.png`);
    if (!existsSync(img) || !existsSync(mask) || !(fr.textBoxes ?? []).length) continue;
    const rgb = decodePng(readFileSync(img));
    const m = decodePng(readFileSync(mask));
    const rgba = Buffer.alloc(rgb.width * rgb.height * 4);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      rgba[i] = rgb.pixels[j]; rgba[i + 1] = rgb.pixels[j + 1]; rgba[i + 2] = rgb.pixels[j + 2]; rgba[i + 3] = 255;
    }
    const crt = (manifest.passRanges ?? []).find((p) => p.pass === "crt" && fr.frame >= p.frameStart && fr.frame <= p.frameEnd);
    for (const box of fr.textBoxes) {
      if ((box.alpha ?? 1) < 0.99) continue;
      const bbox = screenBox(box.bbox, crt?.params?.curvature ?? 0);
      const c = measureContrast({ rgba, mask: m.pixels, width: rgb.width, height: rgb.height, bbox, capHeightPx: box.capHeightPx, gradient: box.fill === "gradient" });
      if (c) contrastSamples.push({ frame: fr.frame, text: box.text, fontSizePx: box.fontSizePx, weight: box.weight, ratio: c.ratio });
    }
  }
  const preset = PRESETS[manifest.presetId];
  const allowedHangulFonts = [...new Set(Object.values(preset.voices).flatMap((v) => [v.hangul, ...(v.weightSteps ?? [])]))]
    .map((k) => loadFontManifest().fonts[k]).filter(Boolean).map((f) => path.basename(f.path ?? f.file));
  const data = {
    manifest, frames, passLines, masterFlash: frames.map((f) => f.flash), previewFlash: previewRecords ? { records: previewRecords, fps: previewFps } : null,
    shotEvents, exports, probe, still, contrastSamples, determinism, perf, coverage, preset, seedOf: passSeed, allowedHangulFonts,
  };
  const gate = evaluateGate(data);
  if (extraRules.length) {
    gate.rules.push(...extraRules);
    gate.failed = gate.rules.filter((x) => x.status === "FAIL").map((x) => x.id);
    gate.pass = gate.failed.length === 0;
  }
  return { gate, manifest, exports, probe };
}

export function promote({ out, gate }) {
  const stage = path.join(out, ".run", "stage");
  const withheldDir = path.join(out, "withheld");
  const names = readdirSync(stage).filter((f) => DELIVERABLES.includes(f));
  if (gate.flashFail) {
    mkdirSync(withheldDir, { recursive: true });
    for (const name of names) renameSync(path.join(stage, name), path.join(withheldDir, name));
    return { withheld: true, delivered: [] };
  }
  for (const name of names) renameSync(path.join(stage, name), path.join(out, name));
  return { withheld: false, delivered: names };
}

/** Remove deliverables and withheld diagnostics from an earlier round before a new full render. */
function clearOutputs(out) {
  for (const name of [...DELIVERABLES, "manifest.json", "render.jsonl", "gate-report.txt"]) rmSync(path.join(out, name), { force: true });
  rmSync(path.join(out, "withheld"), { recursive: true, force: true });
  rmSync(path.join(out, ".run", "stage"), { recursive: true, force: true });
}

/**
 * The end-to-end command. Returns { code, message, ... }. `stillsOnly` stops after the contact
 * sheet with exit 0 so the agent can look before paying for the full render.
 */
export async function make({ briefPath, out, round = 1, stillsOnly = false, viewed = 0, env = process.env, wordTiming = false, gate: runGate = true, log = () => {} }) {
  if (!(round >= 1 && round <= MAX_ROUNDS)) throw new BlockedError(EXIT.USAGE, `--round must be 1..${MAX_ROUNDS}`);
  mkdirSync(out, { recursive: true });
  const prep = await prepare({ briefPath, out, env, wordTiming, log });
  const { plan, fontKeys, warnings } = prep;
  const pre = await preflight({ plan, out, env });
  if (!pre.pass) return { code: EXIT.GATE_FAIL_QA, message: `GATE_FAIL_QA (pre-flight): ${pre.failed.join(", ")}; see ${path.join(out, "gate-report.txt")}`, plan };
  const ffmpeg = findFfmpeg(env);
  if (!stillsOnly) clearOutputs(out);
  const session = await openSession({ plan, fontKeys, runDir: prep.runDir, env, log });
  const software = isSoftware(session.renderer);
  const samples = software ? 1 : SAMPLING.masterSamples;
  const shutter = SAMPLING.masterShutter;
  let master;
  let sound;
  let stillsSet;
  let preview;
  let poster;
  let still;
  try {
    stillsSet = await renderStillsSet({ session, plan, treatment: prep.treatment, out, round, stillsOnly: stillsOnly || !ffmpeg, env, log });
    log(`stills: ${stillsSet.stills.files.length} files in ${path.join(out, "stills")}`);
    if (stillsOnly) {
      return { code: EXIT.OK, message: `STILLS_ONLY: open the storyboard ${path.join(out, "stills", "board.png")} and every file in ${path.join(out, "stills")} (index.json lists them), record the round with look --round ${round}, make the change, then render the film with --round ${round + 1} (no --stills-only)`, plan, stills: stillsSet.stills, egress: session.egress, renderer: session.renderer };
    }
    if (!ffmpeg) {
      return { code: EXIT.BLOCKED_NO_FFMPEG_FOR_VIDEO, message: `BLOCKED_NO_FFMPEG_FOR_VIDEO: ffmpeg is not on PATH; the stills and contact sheet are in ${path.join(out, "stills")}; install ffmpeg for the MP4, preview and poster`, plan };
    }
    sound = soundTrackFor({ treatment: prep.treatment, out, frameCount: plan.frameCount, fps: plan.fps, cutTimes: plan.shots.slice(1).map((sh) => sh.start), ffmpeg });
    master = await renderMaster({ session, plan, out, ffmpeg, samples, shutter, audio: sound.file });
    log(`master: ${plan.frameCount} frames in ${master.seconds.toFixed(1)} s`);
    const minGlyph = Math.min(...master.frames.flatMap((f) => (f.textBoxes ?? []).map((b) => b.fontSizePx)).filter((v) => v > 0), 1000);
    preview = await renderPreview({ session, plan, out, ffmpeg, env, minGlyphPx: minGlyph });
    const posterShot = plan.shots.find((s) => (s.text || s.items)) ?? plan.shots[0];
    const posterFrame = Number.isInteger(prep.brief.posterFrame) ? prep.brief.posterFrame : Math.round(((posterShot.start + posterShot.end) / 2) * plan.fps);
    poster = await renderStillExport({ session, plan, frame: posterFrame, file: path.join(out, ".run", "stage", "poster.png"), samples, shutter });
    const lastText = [...plan.timeline].reverse().find((u) => (u.kind === "line" || u.kind === "scene") && u.text);
    const stillFrameN = Math.round(lastText.end * plan.fps) - 1;
    still = await renderStillExport({ session, plan, frame: stillFrameN, file: path.join(out, ".run", "stage", "reduced-motion.png"), samples, shutter });
    const info = session.info;
    const manifest = manifestFor(plan, {
      samples, shutter, renderer: session.renderer, chromeFlags: session.flags, previewEncoder: preview.encoder, passRanges: info.passRanges, warnings, round,
      sound: { mode: sound.mode, label: sound.label, file: sound.file ? path.relative(out, sound.file) : null },
      treatmentSha256: treatmentSha(out),
    });
    writeJson(path.join(out, "manifest.json"), manifest);
  } finally {
    await session.close();
  }
  // The frame log needs the shot-event schedule for MO-SH-03.
  appendShotEvents(out, session.info.shotEvents);
  writeJson(path.join(out, ".run", "exports.json"), { preview: preview.attempts, poster, still, egress: session.egress, encodeArgs: master.encodeArgs, previewRung: preview.rung, previewFlash: preview.records });
  if (!runGate) {
    const stage = path.join(out, ".run", "stage");
    for (const name of readdirSync(stage).filter((f) => DELIVERABLES.includes(f))) renameSync(path.join(stage, name), path.join(out, name));
    return { code: EXIT.OK, message: `VIDEO: exports written to ${out} without the QA gate; run the gate command before delivering`, plan };
  }
  const expected = new Map(master.frames.map((f) => [f.frame, f.rgbaSha256]));
  const determinism = await determinismCheck({ plan, fontKeys, out, env, samples, shutter, expected, renderer: session.renderer, log });
  writeJson(path.join(out, ".run", "determinism.json"), determinism);
  const perfSession = await openSession({ plan, fontKeys, runDir: prep.runDir, env, log });
  let perf;
  try {
    perf = await perfCheck({ session: perfSession, plan });
  } finally {
    await perfSession.close();
  }
  writeJson(path.join(out, ".run", "perf.json"), perf);
  const soundAudit = typeSoundAudit({ out, treatment: prep.treatment, plan, ffmpeg, env });
  const { gate, manifest } = collectAndEvaluate({ out, previewRecords: preview.records, previewFps: preview.rung?.fps, determinism, perf, coverage: pre.coverage, still, extraRules: soundAudit.rules });
  const promoted = promote({ out, gate });
  const loc = (name) => (promoted.withheld ? path.join(out, "withheld", name) : path.join(out, name));
  if (existsSync(loc("poster.png"))) await stillsSet.write(loc("poster.png"));
  if (gate.pass && !promoted.withheld) recordHouse(out, { style: prep.treatment.style, path: "type", format: prep.treatment.format, durationSec: prep.treatment.durationSec });
  const report = formatReport({
    manifest, reason: plan.reason, gate, round, framesViewed: resolveViewed(out, viewed), software: manifest.softwareRenderer, withheld: promoted.withheld,
    outputs: { film: loc("film.mp4"), preview: preview.file ? loc(path.basename(preview.file)) : "(no preview under 3 MB)", poster: loc("poster.png"), still: loc("reduced-motion.png") },
  });
  writeFileSync(path.join(out, "gate-report.txt"), `${report}\n${CREDIT_LINE}\nrender egress: ${session.egress}\n${warnings.map((w) => `warning: ${w}`).join("\n")}\n`);
  const code = soundAudit.exitCode ?? (gate.pass ? EXIT.OK : EXIT.GATE_FAIL_QA);
  const message = soundAudit.exitCode ? `SOUND_INVALID: ${soundAudit.rules.filter((x) => x.status === "FAIL").map((x) => `${x.id} ${x.detail}`).join("; ")}` : gate.pass
    ? `OK: gate PASS; film ${path.join(out, "film.mp4")}`
    : promoted.withheld
      ? `GATE_FAIL_QA: MO-C-03 flash audit failed; exports are WITHHELD in ${path.join(out, "withheld")} (diagnostics, not deliverables). Failed: ${gate.failed.join(", ")}`
      : `GATE_FAIL_QA: ${gate.failed.join(", ")}; artifacts kept for inspection; see ${path.join(out, "gate-report.txt")}`;
  return { code, message, gate, plan, withheld: promoted.withheld, round };
}

/**
 * `gate` mode: rerun the full gate on an existing output directory, including a fresh determinism
 * re-render and perf run, then deliver or withhold the exports exactly as the end-to-end command.
 */
export async function gateOnly({ out, round = null, viewed = 0, env = process.env, log = () => {} }) {
  const briefPath = path.join(out, ".run", "brief.json");
  if (!existsSync(path.join(out, "manifest.json")) || !existsSync(briefPath)) throw new BlockedError(EXIT.USAGE, `no finished render in ${out} (manifest.json and .run/brief.json are required)`);
  const prep = await prepare({ briefPath, out, env, log });
  const { plan, fontKeys } = prep;
  const coverage = await checkCoverage(plan, env);
  const before = JSON.parse(readFileSync(path.join(out, "manifest.json"), "utf8"));
  const exportsInfo = existsSync(path.join(out, ".run", "exports.json")) ? JSON.parse(readFileSync(path.join(out, ".run", "exports.json"), "utf8")) : {};
  const lines = readJsonLines(path.join(out, "render.jsonl"));
  const expected = new Map(lines.filter((l) => l.pass === null && l.artifact === "master").map((f) => [f.frame, f.rgbaSha256]));
  const determinism = await determinismCheck({ plan, fontKeys, out, env, samples: before.samples, shutter: before.shutter, expected, renderer: before.renderer, log });
  writeJson(path.join(out, ".run", "determinism.json"), determinism);
  const session = await openSession({ plan, fontKeys, runDir: prep.runDir, env, log });
  let perf;
  try {
    perf = await perfCheck({ session, plan });
  } finally {
    await session.close();
  }
  writeJson(path.join(out, ".run", "perf.json"), perf);
  // Exports may sit at their deliverable names (an earlier PASS), in withheld/, or still staged.
  const stage = path.join(out, ".run", "stage");
  mkdirSync(stage, { recursive: true });
  for (const dir of [out, path.join(out, "withheld")]) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((f) => DELIVERABLES.includes(f))) renameSync(path.join(dir, name), path.join(stage, name));
  }
  const soundAudit = typeSoundAudit({ out, treatment: prep.treatment, plan, ffmpeg: findFfmpeg(env), env });
  const { gate, manifest } = collectAndEvaluate({ out, previewRecords: exportsInfo.previewFlash ?? null, previewFps: exportsInfo.previewRung?.fps, determinism, perf, coverage, still: exportsInfo.still ?? null, extraRules: soundAudit.rules });
  const promoted = promote({ out, gate });
  const loc = (name) => (promoted.withheld ? path.join(out, "withheld", name) : path.join(out, name));
  const previewName = ["preview.webp", "preview.gif"].find((f) => existsSync(loc(f))) ?? "preview.webp";
  const framesViewed = resolveViewed(out, viewed);
  const report = formatReport({
    manifest, reason: plan.reason, gate, round: round ?? manifest.round ?? 1, framesViewed, software: manifest.softwareRenderer, withheld: promoted.withheld,
    outputs: { film: loc("film.mp4"), preview: loc(previewName), poster: loc("poster.png"), still: loc("reduced-motion.png") },
  });
  writeFileSync(path.join(out, "gate-report.txt"), `${report}\n${CREDIT_LINE}\n`);
  return {
    code: gate.pass ? EXIT.OK : EXIT.GATE_FAIL_QA,
    message: gate.pass ? "OK: gate PASS" : `GATE_FAIL_QA: ${gate.failed.join(", ")}${promoted.withheld ? " (flash audit failed: exports withheld)" : ""}`,
    gate,
  };
}

/** `stills`, `sheet` and `perf` as standalone modes. */
export async function partial({ mode, briefPath, out, env = process.env, log = () => {} }) {
  const prep = await prepare({ briefPath, out, env, log });
  const pre = await preflight({ plan: prep.plan, out, env });
  if (!pre.pass) return { code: EXIT.GATE_FAIL_QA, message: `GATE_FAIL_QA (pre-flight): ${pre.failed.join(", ")}` };
  const session = await openSession({ plan: prep.plan, fontKeys: prep.fontKeys, runDir: prep.runDir, env, log });
  try {
    if (mode === "stills" || mode === "sheet") {
      const set = await renderStillsSet({ session, plan: prep.plan, treatment: prep.treatment, out, round: 1, stillsOnly: true, env, log });
      return { code: EXIT.OK, message: `STILLS: ${set.stills.files.length} files in ${path.join(out, "stills")} (the sheet is stills/sheet.png)` };
    }
    const perf = await perfCheck({ session, plan: prep.plan });
    writeJson(path.join(out, ".run", "perf.json"), perf);
    return { code: EXIT.OK, message: `PERF: p50 ${perf.p50.toFixed(1)} ms, p95 ${perf.p95.toFixed(1)} ms over ${perf.frames} frames at --samples 1 (${session.renderer})` };
  } finally {
    await session.close();
  }
}

/** Audit the staged master's audio against the treatment's sound plan (exit 20 for a generated bed). */
function typeSoundAudit({ out, treatment, plan, ffmpeg, env }) {
  const film = path.join(out, ".run", "stage", "film.mp4");
  return auditMuxed({ ffmpeg, ffprobe: findFfprobe(env), film, videoDurationSec: plan.frameCount / plan.fps, mode: treatment.sound.mode });
}

function appendShotEvents(out, shotEvents) {
  writeFileSync(path.join(out, "render.jsonl"), `${JSON.stringify({ type: "shot-events", pass: undefined, shots: shotEvents })}\n`, { flag: "a" });
}

export { readJsonLines };
