// The stage-path gate (director brief 6h): the Wave 1 rules that apply to a captured page, on the
// frame's own geometry, plus determinism, sound and the DOM text QA. MO-C-01, MO-C-02 (unless the
// page uses WebGL), the MO-C-14 glyph-mask method and MO-D-02 do not apply; MO-C-04/06/07/08 are
// replaced by the text QA. No other exemption exists.
import { GATE } from "../core/constants.mjs";
import { auditRecords } from "../core/flash.mjs";

const r = (id, status, detail, extra = {}) => ({ id, status, detail, ...extra });

export const STAGE_GATE = Object.freeze({ durationTolerance: 0.1, nearBlackHoldSec: 2.4, nearBlackEdgeSec: 1, flatSpread: 0.02, flatHoldSec: 1, flatEdgeSec: 1, deadBusy: 0.025, deadHoldSec: 0.5, deadOpenSec: 0.4, deadCloseSec: 0.6 });

function flash({ masterFlash, previewFlash, fps }) {
  const master = auditRecords(masterFlash, fps, { loop: false });
  const preview = previewFlash ? auditRecords(previewFlash.records, previewFlash.fps, { loop: true }) : null;
  const detail = `master worst window ${master.general.flashes} general / ${master.red.flashes} red (at ${master.general.startSec}s)`
    + (preview ? `; preview (looping) ${preview.general.flashes} / ${preview.red.flashes}` : "; preview not audited") + " (limit 3 / 3)";
  return r("MO-C-03", master.pass && (!preview || preview.pass) ? "PASS" : "FAIL", detail);
}

function floors({ probe, width, height, treatment }) {
  if (!probe) return [r("MO-C-10/11/12", "FAIL", "no MP4 master to probe (ffprobe missing or file absent)")];
  const problems = [];
  if (probe.width !== width || probe.height !== height) problems.push(`size ${probe.width}x${probe.height}, the ${treatment.format} format is ${width}x${height}`);
  if (probe.fps < GATE.minFps) problems.push(`fps ${probe.fps}`);
  for (const [k, v] of [["pixFmt", "yuv420p"], ["colorSpace", "bt709"], ["colorRange", "tv"], ["colorTransfer", "bt709"], ["colorPrimaries", "bt709"]]) if (probe[k] !== v) problems.push(`${k} ${probe[k]}`);
  const target = treatment.durationSec;
  const off = Math.abs(probe.duration - target) / target;
  const length = off > STAGE_GATE.durationTolerance
    ? r("MO-C-12", "FAIL", `${probe.duration.toFixed(2)} s against the treatment's ${target} s (${(off * 100).toFixed(1)} % off, limit ±10 %)`)
    : r("MO-C-12", "PASS", `${probe.duration.toFixed(2)} s against the treatment's ${target} s`);
  const detail = `${probe.width}x${probe.height} @ ${probe.fps} fps (ffprobe yuv420p/bt709/tv ${problems.length ? "N" : "Y"})`;
  return [r("MO-C-10/11", problems.length ? "FAIL" : "PASS", problems.length ? `${detail}: ${problems.join(", ")}` : detail), length];
}

function sizes({ exports, probe }) {
  const problems = [];
  if (!exports.preview) problems.push("no preview");
  else if (exports.preview.bytes > GATE.previewCapBytes) problems.push(`preview ${exports.preview.bytes} B > 3 MB`);
  if (!exports.poster) problems.push("no poster");
  else if (exports.poster.bytes > GATE.posterCapBytes) problems.push(`poster ${exports.poster.bytes} B > 1 MB`);
  const warn = probe && probe.duration > 0 && probe.bytes > (GATE.mp4WarnBytesPer10s * probe.duration) / 10;
  const detail = `mp4 ${probe?.bytes ?? "?"}, ${exports.preview?.kind ?? "preview"} ${exports.preview?.bytes ?? "?"} (cap 3 MB), poster ${exports.poster?.bytes ?? "?"} (cap 1 MB)`;
  if (problems.length) return r("MO-C-13", "FAIL", `${detail}: ${problems.join(", ")}`);
  return r("MO-C-13", warn ? "WARN" : "PASS", warn ? `${detail}; mp4 above 100 MB per 10 s` : detail);
}

function reducedMotion({ exports, reducedFrame }) {
  return exports.reducedMotion
    ? r("MO-C-14", "PASS", `present: the final beat's midpoint (frame ${reducedFrame})`)
    : r("MO-C-14", "FAIL", "reduced-motion still missing");
}

function nearBlack({ frames, fps }) {
  const empty = frames.map((f) => (f.luminanceP995 ?? 1) < GATE.nearBlackLuminance);
  const limit = STAGE_GATE.nearBlackHoldSec * fps;
  const edge = STAGE_GATE.nearBlackEdgeSec * fps;
  let worst = null;
  let start = -1;
  for (let f = 0; f <= empty.length; f++) {
    if (f < empty.length && empty[f]) {
      if (start < 0) start = f;
      continue;
    }
    if (start >= 0) {
      const length = f - start;
      const allowance = start === 0 || f === empty.length ? edge : 0;
      if (length > limit + allowance && (!worst || length > worst.length)) worst = { length, from: start };
      start = -1;
    }
  }
  return worst
    ? r("MO-D-03", "FAIL", `${worst.length} empty near-black frames from frame ${worst.from} (limit ${Math.round(limit)})`)
    : r("MO-D-03", "PASS", "no empty near-black run longer than 2.4 s");
}

// An empty frame of any colour: almost every pixel within 0.02 of one luminance (0.5-99.5 %). A
// cream or white frame with nothing on it is as empty as a black one; MO-D-03 sees only black.
function flatFrames({ frames, fps }) {
  if (!frames.length || frames.some((f) => typeof f.luminanceP005 !== "number")) return r("FLAT-FRAME", "N/A", "per-frame spread not recorded");
  const flat = frames.map((f) => f.luminanceP995 - f.luminanceP005 < STAGE_GATE.flatSpread);
  const limit = STAGE_GATE.flatHoldSec * fps;
  const edge = STAGE_GATE.flatEdgeSec * fps;
  let worst = null;
  let start = -1;
  for (let f = 0; f <= flat.length; f++) {
    if (f < flat.length && flat[f]) {
      if (start < 0) start = f;
      continue;
    }
    if (start >= 0) {
      const length = f - start;
      const allowance = start === 0 || f === flat.length ? edge : 0;
      if (length > limit + allowance && (!worst || length > worst.length)) worst = { length, from: start };
      start = -1;
    }
  }
  return worst
    ? r("FLAT-FRAME", "FAIL", `${(worst.length / fps).toFixed(2)} s of empty frames from ${(worst.from / fps).toFixed(2)} s (nothing but one flat colour; limit ${STAGE_GATE.flatHoldSec} s)`)
    : r("FLAT-FRAME", "PASS", `no run of empty frames longer than ${STAGE_GATE.flatHoldSec} s`);
}

// A near-empty frame: fewer than 2.5 % of its 48 px cells carry anything (one dot or one small object
// on the ground). Measured on round-1 films, a known dead frame sat at 1.1 % and drawn shots at 5 % and
// up. A run longer than 0.5 s fails; the opening may build from nothing for 0.4 s more, the close
// may fade for 0.6 s more.
function deadAir({ frames, fps }) {
  if (!frames.length || frames.some((f) => typeof f.busy !== "number")) return r("DEAD-AIR", "N/A", "per-frame busy share not recorded");
  const dead = frames.map((f) => f.busy < STAGE_GATE.deadBusy);
  const limit = STAGE_GATE.deadHoldSec * fps;
  let worst = null;
  let start = -1;
  for (let f = 0; f <= dead.length; f++) {
    if (f < dead.length && dead[f]) {
      if (start < 0) start = f;
      continue;
    }
    if (start >= 0) {
      const length = f - start;
      const allowance = (start === 0 ? STAGE_GATE.deadOpenSec * fps : 0) + (f === dead.length ? STAGE_GATE.deadCloseSec * fps : 0);
      if (length > limit + allowance && (!worst || length > worst.length)) worst = { length, from: start };
      start = -1;
    }
  }
  return worst
    ? r("DEAD-AIR", "FAIL", `${(worst.length / fps).toFixed(2)} s of near-empty frames from ${(worst.from / fps).toFixed(2)} s (under ${STAGE_GATE.deadBusy * 100} % of the frame carries anything; limit ${STAGE_GATE.deadHoldSec} s)`)
    : r("DEAD-AIR", "PASS", `no near-empty run longer than ${STAGE_GATE.deadHoldSec} s`);
}

function webgl({ usesWebGL, renderer, rung = "software" }) {
  if (!usesWebGL) return r("MO-C-02", "N/A", "the page draws no WebGL");
  return r("MO-C-02", "PASS", `WebGL on the ${rung} rung: ${renderer ?? "renderer unknown"}${rung === "software" ? " (labelled software)" : ""}`);
}

function determinism({ determinism: d }) {
  if (!d) return r("MO-C-09", "FAIL", "determinism re-check missing");
  return d.status === "PASS"
    ? r("MO-C-09", "PASS", `${d.frames.length} sample frames re-captured in a fresh Chrome replayed from 0: decoded RGBA SHA-256 identical`)
    : r("MO-C-09", "FAIL", `frame ${d.firstMismatch.frame} differs (first differing region ${d.firstMismatch.region}); a source the clock does not drive`);
}

function presence({ exports }) {
  const missing = ["film", "preview", "poster", "reducedMotion"].filter((k) => !exports[k]);
  return missing.length ? r("MO-A-37..41", "FAIL", `missing: ${missing.join(", ")}`) : r("MO-A-37..41", "PASS", "film, preview, poster and reduced-motion still present");
}

/** Evaluate the stage gate. `extra` carries the sound and text-QA rules computed elsewhere. */
export function evaluateStageGate(data) {
  const rules = [
    flash(data), ...floors(data), sizes(data), reducedMotion(data), nearBlack(data), flatFrames(data), deadAir(data), webgl(data), determinism(data), presence(data),
    ...(data.extraRules ?? []),
  ];
  const failed = rules.filter((x) => x.status === "FAIL").map((x) => x.id);
  return { pass: failed.length === 0, failed, rules, flashFail: rules.find((x) => x.id === "MO-C-03").status === "FAIL" };
}

export function formatStageReport({ gate, manifest, outputs, round, framesViewed, withheld }) {
  const pad = (label) => `  ${label}`.padEnd(30);
  const lines = [
    "lit-typographic-motion — stage render report",
    `outputs: ${outputs.film} · ${outputs.preview} · ${outputs.poster} · ${outputs.still}${withheld ? "  [WITHHELD: MO-C-03 flash audit failed; exports are diagnostics in withheld/, not deliverables]" : ""}`,
    `format / duration / fps: ${manifest.format} ${manifest.width}x${manifest.height}, ${manifest.durationSec} s (treatment ${manifest.treatmentDurationSec} s) @ ${manifest.fps} fps, ${manifest.frameCount} frames`,
    `renderer: ${manifest.renderer} (${manifest.rung ?? "software"} rung, stage flags: ${manifest.chromeFlags.join(" ")})`,
    ...(manifest.plate ? [`plate: Blender ${manifest.plate.blender}, ${manifest.plate.engine} ${manifest.plate.device}, ${manifest.plate.samples} spp, ${manifest.plate.frames} frames at ${manifest.plate.fps} fps`] : []),
    `sound: ${manifest.sound?.mode ?? "none"}${manifest.sound?.label ? ` (${manifest.sound.label})` : ""}`,
    "",
    `QA gate: ${gate.pass ? "PASS" : "FAIL"}`,
    ...gate.rules.map((x) => `${pad(`${x.id}:`)}${x.status} — ${x.detail}`),
    "",
    `craft rounds run: ${round} / 3 max`,
    `frames actually viewed this run: ${framesViewed ?? 0} (from look.json)`,
    `per-frame capture: p50 ${manifest.timing?.frameP50Ms ?? "?"} ms, p95 ${manifest.timing?.frameP95Ms ?? "?"} ms; total ${manifest.timing?.totalSec ?? "?"} s`,
  ];
  if (manifest.warnings?.length) lines.push(...manifest.warnings.map((w) => `warning: ${w}`));
  if (!gate.pass) lines.push(`failed rules: ${gate.failed.join(", ")}`);
  return `${lines.join("\n")}\n`;
}
