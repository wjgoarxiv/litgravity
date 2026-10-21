// The stage-path gate (director brief 6h): the Wave 1 rules that apply to a captured page, on the
// frame's own geometry, plus determinism, sound and the DOM text QA. MO-C-01, MO-C-02 (unless the
// page uses WebGL), the MO-C-14 glyph-mask method and MO-D-02 do not apply; MO-C-04/06/07/08 are
// replaced by the text QA. No other exemption exists.
import { GATE } from "../core/constants.mjs";
import { auditRecords } from "../core/flash.mjs";

const r = (id, status, detail, extra = {}) => ({ id, status, detail, ...extra });

export const STAGE_GATE = Object.freeze({ durationTolerance: 0.1, nearBlackHoldSec: 2.4, nearBlackEdgeSec: 1 });

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

function webgl({ usesWebGL, renderer }) {
  if (!usesWebGL) return r("MO-C-02", "N/A", "the page draws no WebGL");
  return r("MO-C-02", "PASS", `WebGL on the software rung: ${renderer ?? "renderer unknown"} (labelled software)`);
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
    flash(data), ...floors(data), sizes(data), reducedMotion(data), nearBlack(data), webgl(data), determinism(data), presence(data),
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
    `renderer: ${manifest.renderer} (software rung, stage flags: ${manifest.chromeFlags.join(" ")})`,
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
