// Brief -> render plan. A brief is a small JSON the skill writes from the user's request
// (schema litgravity.motion-brief/v1). It either lists shots explicitly or gives plain `lines`, which
// are composed into a default film: a title slam, the middle lines as reveals, and an end card.
// Every display string goes through smart() (MO-A-34); the timeline comes from core/timeline.mjs.
import { readFileSync } from "node:fs";
import path from "node:path";
import { PRESETS, pickPreset, resolvePalette } from "../core/presets.mjs";
import { buildTimeline } from "../core/timeline.mjs";
import { smart, plain, eojeol } from "../core/text.mjs";
import { TIMELINE } from "../core/constants.mjs";
import { TreatmentError } from "./treatment.mjs";

export const BRIEF_SCHEMA = "litgravity.motion-brief/v1";
const SCENE_IDS = ["title-slam", "karaoke-line", "kinetic-list", "number-counter", "signature", "end-card"];

export class BriefError extends Error {}

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

// A running shot index ("01 / 05") is on screen only when the treatment asks for one (RC8b).
const SHOT_INDEX = /^\s*\d{1,3}\s*[/／|·]\s*\d{1,3}\s*$/u;

function composeFromLines(lines, title) {
  const clean = lines.map((l) => str(l).trim()).filter(Boolean);
  if (clean.length === 0) throw new BriefError("brief has no text: give `lines` or `shots`");
  const shots = [];
  const first = title ? { text: title } : { text: clean.shift() };
  shots.push({ scene: "title-slam", ...first });
  // The last line is the end card; a single line (with no title) closes on itself.
  const last = clean.length > 0 ? clean.pop() : null;
  for (const line of clean) {
    if (eojeol(line).length >= 2) shots.push({ scene: "karaoke-line", text: line });
    else shots.push({ scene: "title-slam", text: line });
  }
  shots.push({ scene: "end-card", text: last ?? first.text });
  return shots;
}

function normalizeShot(raw, i) {
  const scene = str(raw.scene);
  if (!SCENE_IDS.includes(scene)) throw new BriefError(`shot ${i}: unknown scene "${scene}" (use ${SCENE_IDS.join(", ")})`);
  const shot = { scene };
  if (raw.text !== undefined) shot.text = smart(str(raw.text).trim());
  if (raw.sub !== undefined) shot.sub = plain(str(raw.sub).trim());
  if (raw.heading !== undefined) shot.heading = smart(str(raw.heading).trim());
  if (Array.isArray(raw.items)) shot.items = raw.items.map((x) => smart(str(x).trim())).filter(Boolean);
  if (raw.label !== undefined) shot.label = smart(str(raw.label).trim());
  if (raw.hold !== undefined) shot.hold = Number(raw.hold);
  if (raw.font !== undefined) shot.font = str(raw.font);
  if (raw.post && typeof raw.post === "object") shot.post = raw.post;
  if (scene === "number-counter") {
    shot.from = Number(raw.from ?? 0);
    shot.to = Number(raw.to ?? 0);
    shot.prefix = str(raw.prefix ?? "");
    shot.suffix = str(raw.suffix ?? "");
    shot.display = `${shot.prefix}${Math.round(shot.to).toLocaleString("en-US")}${shot.suffix}`;
  }
  const needsText = ["title-slam", "karaoke-line", "signature", "end-card"].includes(scene);
  if (needsText && !shot.text) throw new BriefError(`shot ${i} (${scene}) needs "text"`);
  if (scene === "kinetic-list" && !(shot.items?.length)) throw new BriefError(`shot ${i} (kinetic-list) needs "items"`);
  if (scene === "signature" && /[가-힣ᄀ-ᇿ㄰-㆏]/u.test(shot.text)) {
    throw new BriefError(`shot ${i} (signature): the single-stroke fonts are Latin-only; use title-slam for Hangul`);
  }
  return shot;
}

export function loadBrief(file) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new BriefError(`cannot read brief ${file}: ${error.message}`);
  }
  return { ...raw, _dir: path.dirname(path.resolve(file)) };
}

/** All text the brief shows, for the preset auto-pick and the glyph-coverage pre-flight. */
export function briefText(shots, extra = []) {
  return [...extra, ...shots.flatMap((s) => [s.text, s.sub, s.heading, s.label, s.display, ...(s.items ?? [])])].filter(Boolean).join("\n");
}

/**
 * Normalize a brief into { presetId, reason, palette, shots, timeline, ... }. `beatGrid` (Tier 2) is
 * passed in by the caller after audio analysis.
 */
export function planFromBrief(brief, { fps = TIMELINE.defaultFps, beatGrid = null, targetSec = null, treatment = null } = {}) {
  if (brief.schema && brief.schema !== BRIEF_SCHEMA) throw new BriefError(`brief schema must be ${BRIEF_SCHEMA}`);
  const rawShots = Array.isArray(brief.shots) && brief.shots.length ? brief.shots : composeFromLines(brief.lines ?? [], brief.title);
  const shots = rawShots.map(normalizeShot);
  const text = briefText(shots, [str(brief.title), str(brief.request)]);
  // The treatment's house style decides the preset on the type path, so a style means one thing on
  // both paths; a brief style that disagrees with it is refused rather than silently winning.
  const style = brief.style && brief.style !== "auto" ? brief.style : treatment?.style ?? brief.style;
  if (treatment?.style && brief.style && brief.style !== "auto" && brief.style !== treatment.style) {
    throw new TreatmentError("style", `the brief asks for ${brief.style} but the treatment's style is ${treatment.style}; drop style from the brief (the treatment's style decides the preset)`);
  }
  const { presetId, reason } = pickPreset({ style, text, request: treatment?.request ?? brief.request ?? "" });
  const preset = PRESETS[presetId];
  // The terminal look is a typed-input voice: it keeps typewriter punctuation (MO-A-34 plain()).
  if (presetId === "terminalcore") {
    for (const shot of shots) {
      for (const field of ["text", "heading", "label"]) if (shot[field]) shot[field] = plain(shot[field]);
      if (shot.items) shot.items = shot.items.map(plain);
    }
  }
  for (const [i, shot] of shots.entries()) {
    const placeholder = briefText([shot]).split("\n").find((v) => /<[^<>\n]{1,80}>/u.test(v));
    if (placeholder) throw new TreatmentError("brief", `shot ${i} still shows a placeholder "${placeholder}"; write the film's own copy`);
  }
  if (!treatment?.typePlan?.index) {
    for (const [i, shot] of shots.entries()) {
      const hit = [shot.text, shot.sub, shot.heading, shot.label, ...(shot.items ?? [])].find((v) => v && SHOT_INDEX.test(v));
      if (hit) throw new TreatmentError("typePlan.index", `shot ${i} shows a running index "${hit}"; set typePlan.index: true only when the film should show one`);
    }
  }
  const bpm = Number(brief.bpm) > 0 ? Number(brief.bpm) : TIMELINE.defaultBpm;
  const warnings = [];
  const { timeline, shots: placed, durationSec } = fitToTarget({ shots, fps, bpm, beatGrid, targetSec, warnings });
  const palette = resolvePalette(preset, { signalHue: brief.signalHue });
  return {
    presetId, reason, preset, palette, bpm, beatGrid, fps, seed: Number.isInteger(brief.seed) ? brief.seed >>> 0 : TIMELINE.defaultSeed,
    signalHue: brief.signalHue ?? null, timeline, shots: placed, durationSec, frameCount: Math.round(durationSec * fps),
    // Only the film's own name, set on purpose as `label`, is ever drawn as a window label (RC8b).
    label: str(brief.label).slice(0, 40), text, warnings,
    passParams: brief.passParams ?? {}, post: brief.post ?? {},
  };
}

/**
 * Honour the treatment's length (section 3 of the director brief): holds scale up until the film
 * reaches the target, never below any reading floor. When the floors alone make the film longer
 * than the target, keep the floors and say so.
 */
function fitToTarget({ shots, fps, bpm, beatGrid, targetSec, warnings }) {
  const natural = buildTimeline({ shots, fps, bpm, beatGrid });
  if (!(targetSec > 0)) return natural;
  if (natural.durationSec > targetSec * 1.1) {
    warnings.push(`the reading floors make the film ${natural.durationSec.toFixed(1)} s, longer than the treatment's ${targetSec} s`);
    return natural;
  }
  if (natural.durationSec >= targetSec - 1 / fps) return natural;
  const at = (scale) => buildTimeline({
    shots: shots.map((s, i) => ({ ...s, hold: Math.max(s.hold ?? 0, (natural.shots[i].end - natural.shots[i].start) * scale) })),
    fps, bpm, beatGrid,
  });
  // The length is monotone in the scale; bisect for the smallest scale that reaches the target, so a
  // beat snap overshoots by at most one beat.
  let lo = 1;
  let hi = targetSec / natural.durationSec;
  let best = at(hi);
  while (best.durationSec < targetSec - 1 / fps) {
    hi *= 1.1;
    best = at(hi);
  }
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    const built = at(mid);
    if (built.durationSec >= targetSec - 1 / fps) {
      hi = mid;
      best = built;
    } else lo = mid;
  }
  return best;
}
