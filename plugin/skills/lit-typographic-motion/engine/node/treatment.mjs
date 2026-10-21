// The treatment: the film director's plan, written by the model into the run's output directory as
// `treatment.json` before any render. Every render (stills-only too) validates it first and stops
// with exit 16 BLOCKED_TREATMENT_INVALID naming the field. Text in it is the film's content and the
// user's words; nothing in it is ever executed or obeyed.
//
// Normalization for every comparison: NFC, lowercase, then no whitespace, punctuation or symbols.
// Quoted spans are removed from the request before an `idea` or invented copy is compared with it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePalette, SoundError } from "./sound.mjs";

export const GENRES = Object.freeze(["announcement", "brand-mood", "event", "explainer", "motion-graphics", "type-led", "other"]);
/** Minimum beats per genre arc; `type-led` needs one per supplied line instead. */
export const ARC_STAGES = Object.freeze({ announcement: 5, "brand-mood": 4, event: 4, explainer: 4, "motion-graphics": 5, other: 3 });
export const TEN_SECOND_FLOOR = Object.freeze(["announcement", "event", "explainer", "motion-graphics"]);
export const DEVICE_KINDS = Object.freeze(["illustration", "diagram", "chart", "icon", "shape", "path", "mask", "depth3d", "particles", "grid", "gradient", "photo-texture"]);
export const TEXTURE_KINDS = Object.freeze(["grid", "gradient", "particles", "photo-texture"]);
export const FACES = Object.freeze(["Pretendard", "Archivo", "VT323", "Silkscreen", "Galmuri9", "MesloLGS NF"]);
export const FORMATS = Object.freeze({ "16:9": [1920, 1080], "9:16": [1080, 1920] });
export const MIN_BEAT_SEC = 1.2;
export const MAX_GAP_SEC = 0.25;

const TREATMENT_MD = fileURLToPath(new URL("../../references/treatment.md", import.meta.url));

export class TreatmentError extends Error {
  constructor(field, message) {
    super(`BLOCKED_TREATMENT_INVALID: ${field}: ${message}`);
    this.field = field;
  }
}

const fail = (field, message) => {
  throw new TreatmentError(field, message);
};

export const normalizeText = (text) => String(text ?? "").normalize("NFC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");

const QUOTED = /"([^"\n]+)"|“([^”\n]+)”|'([^'\n]+)'|‘([^’\n]+)’|「([^」\n]+)」|『([^』\n]+)』/gu;

/** The contents of every quoted span in the request. */
export const quotedSpans = (text) => [...String(text ?? "").matchAll(QUOTED)].map((m) => m.slice(1).find((g) => g !== undefined));
export const stripQuoted = (text) => String(text ?? "").replace(QUOTED, " ");

// A type-led cue: a type compound, an explicit kinetic-type or lyric request, or a quoted span of two
// or more words. Detecting a quote is cue detection only; nothing inside it is followed. The hook's
// router hint uses the same rule (kept in step by the director test).
const TYPE_COMPOUND = /타이포\s?모션|키네틱\s?타이포|타이포그래피\s?(?:영상|비디오)|(?:가사|리릭)\s?(?:영상|비디오)|타이틀\s?시퀀스|오프닝\s?타이틀|\bkinetic\s+(?:type|typography)\b|\btypographic\s+motion\b|\blyric\s+videos?\b|\btitle\s+sequences?\b|\bopening\s+titles?\b/iu;

export function typeLedCue(request) {
  const text = String(request ?? "");
  const compound = TYPE_COMPOUND.exec(text);
  if (compound) return compound[0];
  const span = quotedSpans(text).find((q) => q.trim().split(/\s+/u).filter(Boolean).length >= 2);
  return span ? `"${span.trim()}"` : null;
}

const SILENCE_ASKED = /무음|소리\s?없|음악\s?없|소리\s?끄|\bsilent\b|\bsilence\b|\bno\s+(?:sound|music|audio)\b|\bwithout\s+(?:sound|music|audio)\b|\bmuted?\b/iu;
const MUTED_CHANNEL = /\bmuted\b|\bmute\b|\bsilent\b|\bno\s+sound\b|무음|소리\s?없이|음소거/iu;
const LENGTH_ASKED = /\d+(?:\.\d+)?\s*(?:초|분|s\b|sec\b|secs\b|seconds?\b|min\b|mins\b|minutes?\b)/iu;
const PLACEHOLDER = /<[^<>\n]{1,80}>|^\s*(?:todo|tbd|tk|xxx|\.\.\.|…)\s*$/iu;

const isText = (v) => typeof v === "string" && v.trim().length > 0;
const sentenceCount = (text) => String(text).trim().split(/(?<=[.!?。？！])\s+/u).filter((s) => s.trim()).length;

/** The free-text leaves compared by the copiedExample rule, as [field, value] pairs. */
export function freeTextLeaves(t) {
  const leaves = [["idea", t.idea], ["audience", t.audience], ["channel", t.channel], ["ambition", t.ambition]];
  (Array.isArray(t.beats) ? t.beats : []).forEach((b, i) => {
    for (const k of ["purpose", "onScreen", "motion", "sound"]) leaves.push([`beats[${i}].${k}`, b?.[k]]);
  });
  (Array.isArray(t.copy?.lines) ? t.copy.lines : []).forEach((line, i) => leaves.push([`copy.lines[${i}]`, line]));
  (Array.isArray(t.palette) ? t.palette : []).forEach((p, i) => leaves.push([`palette[${i}].role`, p?.role]));
  return leaves.filter(([, v]) => typeof v === "string");
}

/** Every JSON example shipped in references/treatment.md. */
export function shippedExamples(file = TREATMENT_MD) {
  if (!existsSync(file)) return [];
  const blocks = [...readFileSync(file, "utf8").matchAll(/```json\n([\s\S]*?)\n```/gu)];
  const examples = [];
  for (const block of blocks) {
    try {
      const value = JSON.parse(block[1]);
      if (value && typeof value === "object" && "idea" in value) examples.push(value);
    } catch {
      // A partial snippet in the reference is prose, not an example treatment.
    }
  }
  return examples;
}

/** Longest common substring length of two normalized strings (small inputs only). */
export function sharesRun(a, b, length) {
  if (length <= 0 || a.length < length || b.length < length) return null;
  for (let i = 0; i + length <= a.length; i++) {
    const piece = a.slice(i, i + length);
    if (b.includes(piece)) return piece;
  }
  return null;
}

/** The restatement limit: min(10, half the normalized quote-free request), never below 3. */
export function restateLimit(request) {
  const n = normalizeText(stripQuoted(request)).length;
  return Math.max(3, Math.min(10, Math.floor(n / 2)));
}

function checkText(t, key, { sentences } = {}) {
  if (!(key in t)) fail(key, "missing");
  if (!isText(t[key])) fail(key, "must be a non-empty string");
  if (PLACEHOLDER.test(t[key])) fail(key, `placeholder value ${JSON.stringify(t[key])}`);
  if (sentences && sentenceCount(t[key]) > sentences) fail(key, `at most ${sentences} sentence(s)`);
}

function checkLeafPlaceholders(t) {
  for (const [field, value] of freeTextLeaves(t)) if (PLACEHOLDER.test(value)) fail(field, `placeholder value ${JSON.stringify(value)}`);
}

function checkCopiedExample(t, examples) {
  const leaves = freeTextLeaves(t).map(([, v]) => normalizeText(v)).filter(Boolean);
  if (!leaves.length) return;
  for (const example of examples) {
    const known = new Set(freeTextLeaves(example).map(([, v]) => normalizeText(v)).filter(Boolean));
    const same = leaves.filter((v) => known.has(v)).length;
    if (same * 2 >= leaves.length) fail("copiedExample", `${same} of ${leaves.length} free-text values equal a shipped example's; write this film's own treatment`);
  }
}

/**
 * Validate a treatment. Returns it with `seed` filled in. Throws TreatmentError(field) on the first
 * problem, in field order, so the model fixes one named thing at a time.
 */
export function validateTreatment(t, { examples = shippedExamples() } = {}) {
  if (!t || typeof t !== "object" || Array.isArray(t)) fail("treatment.json", "must be a JSON object");
  if (t.mode === "cover") fail("mode", "this is a cover treatment: render it with motion.mjs cover --out <dir> (references/cover.md)");
  checkText(t, "request");
  if (!("genre" in t)) fail("genre", "missing");
  if (!GENRES.includes(t.genre)) fail("genre", `must be one of ${GENRES.join(", ")}`);
  if (!("path" in t)) fail("path", "missing");
  if (!["type", "stage"].includes(t.path)) fail("path", "must be type or stage");
  checkText(t, "pathReason");
  checkText(t, "idea", { sentences: 1 });
  checkText(t, "audience");
  checkText(t, "channel");
  if (!("format" in t)) fail("format", "missing");
  if (!FORMATS[t.format]) fail("format", "must be 16:9 or 9:16");
  checkText(t, "formatReason");
  if (!("durationSec" in t)) fail("durationSec", "missing");
  if (typeof t.durationSec !== "number" || !Number.isFinite(t.durationSec)) fail("durationSec", "must be a number of seconds");
  if (t.durationSec < 4 || t.durationSec > 90) fail("durationSec", "must be 4-90");
  if (TEN_SECOND_FLOOR.includes(t.genre) && t.durationSec < 10 && !LENGTH_ASKED.test(t.request)) {
    fail("durationSec", `a ${t.genre} film runs at least 10 s unless the user asked for a length; length comes from the arc`);
  }
  if ("fps" in t && t.fps !== 60 && t.fps !== 30) fail("fps", "60 (the default) or 30");
  checkBeats(t);
  if ("posterBeat" in t && !(Number.isInteger(t.posterBeat) && t.posterBeat >= 0 && t.posterBeat < t.beats.length)) fail("posterBeat", "must be a beat index");
  checkSubject(t);
  checkDevices(t);
  checkTypePlan(t);
  checkPalette(t);
  checkSound(t);
  checkCopy(t);
  checkInventions(t);
  checkText(t, "ambition", { sentences: 2 });
  checkLeafPlaceholders(t);
  checkCopiedExample(t, examples);
  checkPath(t);
  return { ...t, seed: Number.isInteger(t.seed) ? t.seed >>> 0 : seedOf(t.request) };
}

function seedOf(text) {
  let h = 0x811c9dc5;
  for (const b of Buffer.from(String(text), "utf8")) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h;
}

function checkBeats(t) {
  if (!("beats" in t)) fail("beats", "missing");
  if (!Array.isArray(t.beats) || t.beats.length === 0) fail("beats", "must be a non-empty array");
  t.beats.forEach((b, i) => {
    const f = `beats[${i}]`;
    if (!b || typeof b !== "object") fail(f, "must be an object");
    for (const k of ["t0", "t1"]) if (typeof b[k] !== "number" || !Number.isFinite(b[k])) fail(`${f}.${k}`, "must be a number");
    for (const k of ["purpose", "onScreen", "motion", "sound"]) {
      if (!isText(b[k])) fail(`${f}.${k}`, "must be a non-empty string");
      if (PLACEHOLDER.test(b[k])) fail(`${f}.${k}`, `placeholder value ${JSON.stringify(b[k])}`);
    }
    if (b.t1 - b.t0 < MIN_BEAT_SEC - 1e-9) fail(f, `a beat lasts at least ${MIN_BEAT_SEC} s (${(b.t1 - b.t0).toFixed(2)} s)`);
    const prevEnd = i === 0 ? 0 : t.beats[i - 1].t1;
    if (b.t0 - prevEnd > MAX_GAP_SEC + 1e-9) fail(f, `gap of ${(b.t0 - prevEnd).toFixed(2)} s before this beat (max ${MAX_GAP_SEC} s)`);
    if (b.t0 < prevEnd - 1e-6) fail(f, "overlaps the previous beat");
  });
  const last = t.beats[t.beats.length - 1];
  if (Math.abs(last.t1 - t.durationSec) > MAX_GAP_SEC + 1e-9) fail(`beats[${t.beats.length - 1}]`, `the beats must end at durationSec (${t.durationSec} s), not ${last.t1} s`);
  const lines = Array.isArray(t.copy?.lines) ? t.copy.lines.length : 0;
  const need = t.genre === "type-led" ? Math.max(1, lines) : ARC_STAGES[t.genre];
  if (t.beats.length < need) fail("beats", `a ${t.genre} arc needs at least ${need} beats (${t.beats.length} given); length comes from the arc`);
}

function checkSubject(t) {
  if (!("subject" in t)) fail("subject", "missing");
  const s = t.subject;
  if (!s || typeof s !== "object") fail("subject", "must be an object");
  if (!isText(s.name)) fail("subject.name", "must be a non-empty string");
  if (PLACEHOLDER.test(s.name)) fail("subject.name", "placeholder value");
  if (!["user", "invented"].includes(s.source)) fail("subject.source", "must be user or invented");
  const specifics = Array.isArray(s.specifics) ? s.specifics.filter(isText) : [];
  const need = s.source === "invented" ? 2 : 1;
  if (specifics.length < need) fail("subject.specifics", `needs at least ${need} concrete specific(s): what it is or does, for whom, one distinctive detail`);
  if (specifics.some((x) => PLACEHOLDER.test(x))) fail("subject.specifics", "placeholder value");
}

function beatSpan(t, indices) {
  let covered = 0;
  for (const i of new Set(indices)) covered += t.beats[i].t1 - t.beats[i].t0;
  return covered;
}

function checkDevices(t) {
  if (!("visualDevices" in t)) fail("visualDevices", "missing");
  if (!Array.isArray(t.visualDevices)) fail("visualDevices", "must be an array");
  t.visualDevices.forEach((d, i) => {
    const f = `visualDevices[${i}]`;
    if (!DEVICE_KINDS.includes(d?.kind)) fail(`${f}.kind`, `must be one of ${DEVICE_KINDS.join(", ")}`);
    if (!["subject", "support", "texture"].includes(d.role)) fail(`${f}.role`, "must be subject, support or texture");
    if (TEXTURE_KINDS.includes(d.kind) && d.role !== "texture") fail(`${f}.role`, `${d.kind} is always texture`);
    if (!Array.isArray(d.beats) || !d.beats.length || d.beats.some((b) => !Number.isInteger(b) || b < 0 || b >= t.beats.length)) fail(`${f}.beats`, "must list beat indices");
  });
  if (t.path !== "stage") return;
  const subjects = t.visualDevices.filter((d) => d.role === "subject");
  if (!subjects.length) fail("visualDevices", "the stage path needs a role: subject device, a drawn depiction of what the film is about");
  const covered = beatSpan(t, subjects.flatMap((d) => d.beats));
  if (covered < 0.5 * t.durationSec - 1e-9) fail("visualDevices", `the subject is on screen for ${covered.toFixed(1)} s, under half the film`);
  const kinds = new Set(t.visualDevices.filter((d) => !TEXTURE_KINDS.includes(d.kind)).map((d) => d.kind));
  if (kinds.size < 2) fail("visualDevices", "needs at least 2 distinct non-texture kinds (grid, gradient, particles and photo-texture never count)");
}

function checkTypePlan(t) {
  if (!("typePlan" in t)) fail("typePlan", "missing");
  const p = t.typePlan;
  if (!p || typeof p !== "object") fail("typePlan", "must be an object");
  if (!Array.isArray(p.faces) || !p.faces.length || p.faces.some((f) => !FACES.includes(f))) fail("typePlan.faces", `faces come from the verified set: ${FACES.join(", ")}`);
  if (!isText(p.hierarchy)) fail("typePlan.hierarchy", "must be a non-empty string");
  if (!Number.isInteger(p.maxWordsOnScreen) || p.maxWordsOnScreen < 1) fail("typePlan.maxWordsOnScreen", "must be a positive integer");
  if ("index" in p && typeof p.index !== "boolean") fail("typePlan.index", "must be true or false");
}

function checkPalette(t) {
  if (!("palette" in t)) fail("palette", "missing");
  if (!Array.isArray(t.palette) || t.palette.length < 3 || t.palette.length > 6) fail("palette", "needs 3-6 colours, each with a role");
  t.palette.forEach((p, i) => {
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu.test(p?.color ?? "")) fail(`palette[${i}].color`, "must be #rgb or #rrggbb");
    if (!isText(p.role)) fail(`palette[${i}].role`, "must be a non-empty string");
  });
}

function checkSound(t) {
  if (!("sound" in t)) fail("sound", "missing");
  const s = t.sound;
  if (!s || typeof s !== "object") fail("sound", "must be an object");
  if (!["generated", "supplied", "authored", "none"].includes(s.mode)) fail("sound.mode", "must be generated, supplied, authored or none");
  if (!isText(s.plan)) fail("sound.plan", "must be a non-empty string");
  if (s.mode === "none" && !SILENCE_ASKED.test(t.request) && !MUTED_CHANNEL.test(t.channel)) {
    fail("sound.mode", "none only when the user asked for silence or the channel plays muted by design; the default is a generated bed");
  }
  if (s.mode === "generated") {
    try {
      normalizePalette(s.palette);
    } catch (error) {
      if (error instanceof SoundError) fail(error.field.startsWith("sound.") ? error.field : `sound.palette.${error.field}`, error.message);
      throw error;
    }
  }
  if ((s.mode === "supplied" || s.mode === "authored") && !isText(s.file)) fail("sound.file", `a ${s.mode} track needs its file path`);
}

function checkCopy(t) {
  if (!("copy" in t)) fail("copy", "missing");
  const c = t.copy;
  if (!c || typeof c !== "object") fail("copy", "must be an object");
  if (!["user", "invented"].includes(c.source)) fail("copy.source", "must be user or invented");
  if (!Array.isArray(c.lines) || !c.lines.length) fail("copy.lines", "needs at least one line");
  const request = normalizeText(t.request);
  const quoteFree = normalizeText(stripQuoted(t.request));
  const limit = restateLimit(t.request);
  c.lines.forEach((line, i) => {
    const f = `copy.lines[${i}]`;
    if (!isText(line)) fail(f, "must be a non-empty string");
    if (PLACEHOLDER.test(line)) fail(f, `placeholder value ${JSON.stringify(line)}`);
    if (c.source === "user" && !request.includes(normalizeText(line))) fail(f, "a user copy line must be the user's own words, found in the request");
    if (c.source === "invented") {
      const shared = sharesRun(normalizeText(line), quoteFree, limit);
      if (shared) fail(f, `invented copy restates the request ("${shared}"); write the copy from subject.specifics`);
    }
  });
  const idea = sharesRun(normalizeText(t.idea), quoteFree, limit);
  if (idea) fail("idea", `the idea restates the request ("${idea}"); say what the film does, not what was asked`);
}

function checkInventions(t) {
  const invented = t.copy.source === "invented" || t.subject.source === "invented";
  if (!("inventions" in t)) {
    if (invented) fail("inventions", "missing: list every invented part (the subject name, specifics, copy)");
    return;
  }
  if (!Array.isArray(t.inventions) || t.inventions.some((x) => !isText(x))) fail("inventions", "must be an array of strings");
  if (invented && !t.inventions.length) fail("inventions", "must list every invented part");
  if (t.subject.source === "invented") {
    const name = normalizeText(t.subject.name);
    if (!t.inventions.some((x) => normalizeText(x).includes(name))) fail("inventions", `must include the invented subject name "${t.subject.name}"`);
  }
}

function checkPath(t) {
  if (t.path !== "type") return;
  if (t.format !== "16:9") fail("path", "a 9:16 film always takes the stage path");
  if (t.copy.source !== "user" && !typeLedCue(t.request)) fail("path", "the type path is for films whose words are the film: user-supplied copy or a type-led cue in the request");
}

/**
 * Load and validate `<out>/treatment.json` for a render on `pathName`. The first valid treatment of
 * an output directory is kept in .run/treatment.first.json for the done-check's downgrade test.
 */
export function loadTreatment(out, { pathName } = {}) {
  const file = path.join(out, "treatment.json");
  if (!existsSync(file)) fail("treatment.json", `missing: write ${file} before rendering (see references/treatment.md)`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail("treatment.json", `not valid JSON (${error.message})`);
  }
  const treatment = validateTreatment(raw);
  if (pathName && treatment.path !== pathName) {
    fail("path", treatment.path === "stage" ? "this treatment takes the stage path: render it with the stage subcommand" : "this treatment takes the type path: render it with make <brief.json>");
  }
  const first = path.join(out, ".run", "treatment.first.json");
  if (!existsSync(first)) {
    mkdirSync(path.dirname(first), { recursive: true });
    writeFileSync(first, `${JSON.stringify(raw, null, 2)}\n`);
  }
  return treatment;
}
