// The treatment: the film director's plan, written by the model into the run's output directory as
// `treatment.json` before any render. Every render (stills-only too) validates it first and stops
// with exit 16 BLOCKED_TREATMENT_INVALID naming the field. Text in it is the film's content and the
// user's words; nothing in it is ever executed or obeyed.
//
// Normalization for every comparison: NFC, lowercase, then no whitespace, punctuation or symbols.
// Quoted spans are removed from the request before an `idea` or invented copy is compared with it.
//
// The forks that used to be the model's to flip on every run are rules here: the house style (named,
// auto-pick), the format (9:16 only for a vertical request), the length (the genre's band unless the
// user names one) and the genre (a genre word in the request fixes it). Concept fields stay free.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT } from "../core/constants.mjs";
import { BlockedError } from "./chrome.mjs";
import { readHouse } from "./house.mjs";
import { LAYOUT_IDS, STYLE_IDS, styleBeds, styleColors, styleFamilies, pickStyle, readStyle } from "./styles.mjs";
import { SCORE_GENRES } from "./score.mjs";
import { EVENT_SOUNDS, normalizePalette, SoundError } from "./sound.mjs";

export const GENRES = Object.freeze(["announcement", "brand-mood", "event", "explainer", "motion-graphics", "type-led", "other"]);
/** Minimum beats per genre arc; `type-led` needs one per supplied line instead. */
export const ARC_STAGES = Object.freeze({ announcement: 5, "brand-mood": 4, event: 4, explainer: 4, "motion-graphics": 5, other: 3 });
export const TEN_SECOND_FLOOR = Object.freeze(["announcement", "event", "explainer", "motion-graphics"]);
/** Length bands in seconds when the user names no length; `type-led` scales with its lines. */
export const GENRE_BANDS = Object.freeze({ announcement: [12, 18], "brand-mood": [10, 15], event: [10, 15], explainer: [16, 24], "motion-graphics": [12, 18], other: [10, 15] });
export const typeLedBand = (lines) => [Math.max(4, 2 * lines), Math.max(8, 6 * lines)];
export const DEVICE_KINDS = Object.freeze(["illustration", "diagram", "chart", "icon", "shape", "path", "mask", "depth3d", "screen", "particles", "grid", "gradient", "photo-texture"]);
export const TEXTURE_KINDS = Object.freeze(["grid", "gradient", "particles", "photo-texture"]);
export const FACES = Object.freeze(["Pretendard", "Archivo", "VT323", "Silkscreen", "Galmuri9", "MesloLGS NF"]);
export const FORMATS = Object.freeze({ "16:9": [1920, 1080], "9:16": [1080, 1920] });
export const MIN_BEAT_SEC = 1.2;
export const MAX_GAP_SEC = 0.25;
export const PROTAGONIST_KINDS = Object.freeze(["character", "object"]);
/** What a product asset is; `screen` devices need one of the last three. */
export const ASSET_ROLES = Object.freeze(["logo", "wordmark", "icon", "photo", "screenshot", "ui", "readme-image"]);
const SCREEN_ROLES = new Set(["screenshot", "ui", "readme-image"]);
/** An event hit counts as off the cut when it is at least this far from every cut. */
export const EVENT_OFF_CUT_SEC = 0.1;
/** How dense a film is. Rich is the default; minimal only when the request asks for calm or minimal. */
export const REGISTERS = Object.freeze(["rich", "minimal"]);
/** What a rich stage film's world plans at least: depth layers, labelled parts, a share of moving shots. */
export const RICH_WORLD = Object.freeze({ layers: 3, labels: 6, labelWords: 4, cameraShare: 0.5 });
const LOCKED_CAMERA = /^\s*(?:none|locked|static|still|hold|fixed|no move)\s*\.?\s*$/iu;

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
const LENGTH_VALUE = /(\d+(?:\.\d+)?)\s*(초|분|s\b|sec\b|secs\b|seconds?\b|min\b|mins\b|minutes?\b)/iu;
const VERTICAL = /세로|숏폼|쇼츠|릴스|틱톡|인스타(?:그램)?\s?스토리|\bvertical\b|\bportrait\s+(?:format|mode|video|orientation)\b|9\s?:\s?16|\bshorts\b|\breels?\b|\btiktok\b|\binsta(?:gram)?\s+stor(?:y|ies)\b/iu;
const MINIMAL_ASKED = /미니멀|잔잔|차분|조용|심플|절제|단순하게|고요|\bminimal(?:ist|ism)?\b|\bcalm\b|\bquiet\b|\bsimple\b|\bunderstated\b|\brestrained\b|\bsparse\b|\bserene\b/iu;
const PREVIEW_ASKED = /미리\s?보기|스토리보드|콘티|\bpreview\b|\bstoryboard\b/iu;
const FPS30_ASKED = /30\s?(?:fps|프레임|frames?\s+(?:a|per)\s+second)|\b30\s?p\b/iu;
// A link in the request names a real product, repository or site: the film uses its real assets.
const URL_IN_REQUEST = /\bhttps?:\/\/[^\s"'<>)\]]+/giu;
// A genre word in the request fixes the genre; checked in order, first hit wins.
const GENRE_CUES = Object.freeze([
  ["explainer", /설명|원리|\bexplain(?:er|s|ing)?\b/iu],
  ["announcement", /출시|런칭|론칭|티저|신제품|\blaunch(?:es|ing)?\b|\bteaser\b|\bannounce(?:ment|s)?\b|\bintroducing\b/iu],
  ["event", /행사|공연|축제|모집|세미나|콘서트|음악회|전시회|\bevent\b|\bfestival\b|\bconcert\b|\bmeetup\b|\bconference\b|\bexhibition\b/iu],
  ["explainer", /어떻게|과정|\bhow\s+(?:it|they|a|an|the|to|\w+\s+works?)\b/iu],
]);

/** The length the request asks for, in seconds, or null. */
export function askedSeconds(request) {
  const m = LENGTH_VALUE.exec(String(request ?? ""));
  if (!m) return null;
  const value = Number(m[1]);
  return /^(?:분|min|mins|minutes?)$/iu.test(m[2]) ? value * 60 : value;
}

/** The genre a request's own words fix, or null when it names none. */
export function cuedGenre(request) {
  const text = String(request ?? "");
  const compound = TYPE_COMPOUND.exec(text);
  if (compound) return { genre: "type-led", word: compound[0] };
  for (const [genre, re] of GENRE_CUES) {
    const m = re.exec(text);
    if (m) return { genre, word: m[0] };
  }
  return null;
}
export const asksVertical = (request) => VERTICAL.test(String(request ?? ""));
/** The request asks for a calm, quiet or minimal film: the one case the minimal register is for. */
export const asksMinimal = (request) => MINIMAL_ASKED.test(String(request ?? ""));
export const asksPreview = (request) => PREVIEW_ASKED.test(String(request ?? ""));
// High-quality, cinematic or photoreal 3D: the words that send a 3D film to the Blender rung when
// Blender is installed (scaffold.mjs says so; references/depth.md).
const PATH_TRACED_ASKED = /고퀄|고품질|하이엔드|시네마틱|실사|포토리얼|레이\s?트레이싱|블렌더|\b(?:high[- ]?(?:quality|end)|cinematic|photo-?real(?:istic)?|path[- ]?trac\w*|ray[- ]?trac\w*|blender|cycles)\b/iu;
/** The request asks for path-traced quality in its 3D. */
export const asksPathTraced = (request) => PATH_TRACED_ASKED.test(String(request ?? ""));
export const asks30fps = (request) => FPS30_ASKED.test(String(request ?? ""));
export const normUrl = (u) => String(u ?? "").trim().replace(/[.,;:!?]+$/u, "").replace(/\/+$/u, "").replace(/\.git$/u, "").toLowerCase();
/** Every link in the request, normalized (no trailing slash, punctuation or .git). */
export const requestUrls = (request) => [...String(request ?? "").matchAll(URL_IN_REQUEST)].map((m) => normUrl(m[0]));
const PLACEHOLDER = /<[^<>\n]{1,80}>|^\s*(?:todo|tbd|tk|xxx|\.\.\.|…)\s*$/iu;

const isText = (v) => typeof v === "string" && v.trim().length > 0;
const sentenceCount = (text) => String(text).trim().split(/(?<=[.!?。？！])\s+/u).filter((s) => s.trim()).length;

/** The free-text leaves compared by the copiedExample rule, as [field, value] pairs. */
export function freeTextLeaves(t) {
  const leaves = [["idea", t.idea], ["audience", t.audience], ["channel", t.channel], ["ambition", t.ambition]];
  (Array.isArray(t.beats) ? t.beats : []).forEach((b, i) => {
    for (const k of ["purpose", "onScreen", "motion", "sound", "hero"]) leaves.push([`beats[${i}].${k}`, b?.[k]]);
  });
  for (const k of ["expect", "turn", "payoff"]) leaves.push([`story.${k}`, t.story?.[k]]);
  leaves.push(["protagonist.look", t.protagonist?.look]);
  (Array.isArray(t.protagonist?.acts) ? t.protagonist.acts : []).forEach((a, i) => leaves.push([`protagonist.acts[${i}].action`, a?.action]));
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
export function validateTreatment(t, { examples = shippedExamples(), house = null } = {}) {
  if (!t || typeof t !== "object" || Array.isArray(t)) fail("treatment.json", "must be a JSON object");
  if (t.mode === "cover") fail("mode", "this is a cover treatment: render it with motion.mjs cover --out <dir> (references/cover.md)");
  checkText(t, "request");
  if (!("genre" in t)) fail("genre", "missing");
  if (!GENRES.includes(t.genre)) fail("genre", `must be one of ${GENRES.join(", ")}`);
  const cue = cuedGenre(t.request);
  if (cue && cue.genre !== t.genre) fail("genre", `the request says "${cue.word}", which makes this a ${cue.genre} film`);
  if (!("path" in t)) fail("path", "missing");
  if (!["type", "stage"].includes(t.path)) fail("path", "must be type or stage");
  checkText(t, "pathReason");
  checkStyle(t, house);
  t = { ...t, register: checkRegister(t) };
  checkText(t, "idea", { sentences: 1 });
  checkText(t, "audience");
  checkText(t, "channel");
  if (!("format" in t)) fail("format", "missing");
  if (!FORMATS[t.format]) fail("format", "must be 16:9 or 9:16");
  if (asksVertical(t.request) && t.format !== "9:16") fail("format", "the request asks for a vertical film: 9:16");
  if (!asksVertical(t.request) && t.format === "9:16") fail("format", "9:16 only when the request asks for a vertical film (vertical, 세로, shorts, reels); otherwise 16:9");
  checkText(t, "formatReason");
  if (!("durationSec" in t)) fail("durationSec", "missing");
  if (typeof t.durationSec !== "number" || !Number.isFinite(t.durationSec)) fail("durationSec", "must be a number of seconds");
  if (t.durationSec < 4 || t.durationSec > 90) fail("durationSec", "must be 4-90");
  checkLength(t);
  if ("fps" in t && t.fps !== 60 && t.fps !== 30) fail("fps", "60 (the default) or 30");
  if (t.fps === 30 && !asks30fps(t.request)) fail("fps", "60; 30 only when the request asks for 30 fps");
  if ("preview" in t && typeof t.preview !== "boolean") fail("preview", "true or false");
  if (t.preview === true && !asksPreview(t.request)) fail("preview", "true only when the request asks for a preview or storyboard first");
  checkBeats(t);
  if ("posterBeat" in t && !(Number.isInteger(t.posterBeat) && t.posterBeat >= 0 && t.posterBeat < t.beats.length)) fail("posterBeat", "must be a beat index");
  checkStory(t);
  checkProtagonist(t);
  checkSubject(t);
  checkProduct(t);
  checkDevices(t);
  checkDepth(t);
  checkWorld(t);
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

function checkStyle(t, house) {
  if (!("style" in t)) fail("style", `missing: one of ${STYLE_IDS.join(", ")} (references/studio.md)`);
  if (!STYLE_IDS.includes(t.style)) fail("style", `must be one of ${STYLE_IDS.join(", ")}`);
  const pick = pickStyle({ request: t.request, copy: Array.isArray(t.copy?.lines) ? t.copy.lines : [], path: t.path, house, genre: t.genre });
  if (t.style !== pick.id) fail("style", `${pick.reason}; this film takes the ${pick.id} style`);
}

// Maximal is the default: a film is rich unless the request asks for calm or minimal, and then it is
// minimal. The register is the request's, like the format, never a choice the model makes alone.
function checkRegister(t) {
  const register = t.register ?? "rich";
  if (!REGISTERS.includes(register)) fail("register", "rich (the default) or minimal");
  const calm = asksMinimal(t.request);
  if (register === "minimal" && !calm) fail("register", "minimal only when the request asks for a calm, quiet or minimal film; the default is rich (studio.md, Register)");
  if (register === "rich" && calm) fail("register", "the request asks for a calm or minimal film: register minimal");
  return register;
}

function checkLength(t) {
  const asked = askedSeconds(t.request);
  if (asked !== null && LENGTH_ASKED.test(t.request)) {
    if (Math.abs(t.durationSec - asked) > Math.max(1, asked * 0.1)) fail("durationSec", `the request asks for ${asked} s; keep the film within 10 % of it`);
    return;
  }
  const lines = Array.isArray(t.copy?.lines) ? t.copy.lines.length : 1;
  const [lo, hi] = t.genre === "type-led" ? typeLedBand(lines) : GENRE_BANDS[t.genre];
  if (t.durationSec < lo - 1e-9 || t.durationSec > hi + 1e-9) fail("durationSec", `a ${t.genre} film runs ${lo}-${hi} s unless the user names a length (${t.durationSec} s)`);
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
    if (t.path === "stage") checkShot(t, b, i, f);
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
  if (t.path === "stage") checkVariety(t);
}

// Composition changes with the story: two adjacent shots never share a layout, and a film of four or
// more shots uses at least three, so the eye is not parked on one split for the whole film.
function checkVariety(t) {
  for (let i = 1; i < t.beats.length; i++) {
    if (t.beats[i].layout === t.beats[i - 1].layout) fail(`beats[${i}].layout`, `shots ${i} and ${i + 1} both use ${t.beats[i].layout}; adjacent shots change layout (studio.md, Shots and layouts)`);
  }
  const used = new Set(t.beats.map((b) => b.layout));
  if (t.beats.length >= 4 && used.size < 3) fail("beats", `${t.beats.length} shots use only ${[...used].join(" and ")}; a film of four or more shots uses at least three layouts`);
}

// The story: what the viewer expects, the turn they do not, the shot where it lands, and the payoff.
// A genre arc alone is an information order, not a story.
function checkStory(t) {
  if (!("story" in t)) fail("story", "missing: { expect, turn, beat, payoff }: what the viewer expects, what happens instead, the shot where it lands, what the ending gives (treatment.md, Story)");
  const s = t.story;
  if (!s || typeof s !== "object") fail("story", "must be an object { expect, turn, beat, payoff }");
  for (const k of ["expect", "turn", "payoff"]) {
    if (!isText(s[k])) fail(`story.${k}`, "must be a non-empty string");
    if (PLACEHOLDER.test(s[k])) fail(`story.${k}`, `placeholder value ${JSON.stringify(s[k])}`);
    if (sentenceCount(s[k]) > 2) fail(`story.${k}`, "at most 2 sentences");
  }
  if (normalizeText(s.turn) === normalizeText(s.expect)) fail("story.turn", "the turn is what the viewer does not expect; it cannot equal story.expect");
  if (!Number.isInteger(s.beat) || s.beat < 1 || s.beat >= t.beats.length) fail("story.beat", `the index of the shot where the turn lands: after the opening, before the end (1-${t.beats.length - 1})`);
}

// The protagonist: one drawn character or hero object that acts across the film (stage path).
function checkProtagonist(t) {
  if (t.path !== "stage") return;
  if (!("protagonist" in t)) fail("protagonist", "missing: { name, kind, look, acts[] }: the character or hero object that acts across the film (treatment.md, Protagonist)");
  const p = t.protagonist;
  if (!p || typeof p !== "object") fail("protagonist", "must be an object { name, kind, look, acts }");
  if (!isText(p.name) || PLACEHOLDER.test(p.name)) fail("protagonist.name", "must name it");
  if (!PROTAGONIST_KINDS.includes(p.kind)) fail("protagonist.kind", `must be ${PROTAGONIST_KINDS.join(" or ")}`);
  if (!isText(p.look) || PLACEHOLDER.test(p.look)) fail("protagonist.look", "say what it looks like on screen: shape, material, colour role, scale in the frame");
  if (!Array.isArray(p.acts) || !p.acts.length) fail("protagonist.acts", "list what it does, shot by shot: [{ beat, action }]");
  const seen = new Set();
  p.acts.forEach((a, i) => {
    if (!Number.isInteger(a?.beat) || a.beat < 0 || a.beat >= t.beats.length) fail(`protagonist.acts[${i}].beat`, "must be a beat index");
    if (seen.has(a.beat)) fail(`protagonist.acts[${i}].beat`, "one act per shot");
    seen.add(a.beat);
    if (!isText(a.action) || PLACEHOLDER.test(a.action)) fail(`protagonist.acts[${i}].action`, "say what it does in this shot, as a viewer would see it");
  });
  const covered = beatSpan(t, [...seen]);
  if (covered < 0.5 * t.durationSec - 1e-9) fail("protagonist.acts", `it acts for ${covered.toFixed(1)} s, under half the film; it carries the film, not one shot`);
  if (!seen.has(t.story.beat)) fail("protagonist.acts", `the turn lands at shot ${t.story.beat + 1}, and the protagonist has no act there`);
}

// A named product, repository or site: its real logo, images, UI and words, never invented ones. The
// request's link makes it required; `motion.mjs assets` fetches what it can reach.
function checkProduct(t) {
  const urls = requestUrls(t.request);
  if (!("product" in t)) {
    if (urls.length) fail("product", `missing: the request links ${urls[0]}; fetch its real assets with motion.mjs assets --out <dir> --url <link> and list them (treatment.md, Named products)`);
    return;
  }
  const p = t.product;
  if (!p || typeof p !== "object") fail("product", "must be an object { name, url, assets }");
  if (!isText(p.name) || PLACEHOLDER.test(p.name)) fail("product.name", "must name the product");
  if (urls.length && !urls.includes(normUrl(p.url))) fail("product.url", `must be the link the request gives (${urls.join(", ")})`);
  if ("unreachable" in p) {
    if (!isText(p.unreachable)) fail("product.unreachable", "say what could not be reached and why");
    return;
  }
  if (!Array.isArray(p.assets) || !p.assets.length) fail("product.assets", "list the real assets the film uses: [{ path, role, source, sha256 }]; when none can be reached set unreachable and ask the user");
  p.assets.forEach((a, i) => {
    const f = `product.assets[${i}]`;
    if (typeof a?.path !== "string" || !a.path.startsWith("stage/assets/") || a.path.split("/").includes("..")) fail(`${f}.path`, "must be a file under stage/assets/, relative to the output directory");
    if (!ASSET_ROLES.includes(a.role)) fail(`${f}.role`, `must be one of ${ASSET_ROLES.join(", ")}`);
    if (!["fetched", "user"].includes(a.source)) fail(`${f}.source`, "must be fetched (by motion.mjs assets) or user (supplied)");
    if (!/^[0-9a-f]{64}$/u.test(a.sha256 ?? "")) fail(`${f}.sha256`, "must be the file's SHA-256");
  });
  if (t.subject?.source === "invented") fail("subject.source", "the product is real: the subject is the product (source user), its specifics from its own words");
}

// The 3D route: a depth3d subject is drawn with the pinned three.js on the GPU rung (references/depth.md).
function checkDepth(t) {
  if ("depth" in t && !["2d", "3d"].includes(t.depth)) fail("depth", "2d (the default) or 3d");
  const solid = Array.isArray(t.visualDevices) && t.visualDevices.some((d) => d.kind === "depth3d" && d.role === "subject");
  if (t.path !== "stage") {
    if (t.depth === "3d") fail("depth", "3d is a stage-path route");
    return;
  }
  if (solid && t.depth !== "3d") fail("depth", "the subject is a depth3d device: set depth to 3d, so the film takes the 3D route (references/depth.md)");
  if (t.depth === "3d" && !solid) fail("depth", "3d needs the subject drawn as a depth3d device (role subject)");
  if ("render3d" in t && !["three", "blender"].includes(t.render3d)) fail("render3d", "three (the GPU rung, the default) or blender (the offline Cycles rung)");
  if (t.render3d === "blender" && t.depth !== "3d") fail("render3d", "the Blender rung renders a 3D world: set depth to 3d with a depth3d subject");
}

// A rich stage film plans its density before any page exists: the depth layers of its world, the
// labelled parts the viewer reads in it and the shots where the camera moves (references/studio.md).
function checkWorld(t) {
  if (t.path !== "stage" || t.register !== "rich") return;
  const w = t.world;
  if (!w || typeof w !== "object") fail("world", "missing: { layers, labels, camera }: a rich film plans its layered world, its labelled parts and its camera moves (studio.md, Register)");
  if (!Array.isArray(w.layers) || w.layers.filter(isText).length < RICH_WORLD.layers) fail("world.layers", `at least ${RICH_WORLD.layers} depth layers, back to front, each saying what lives there`);
  if (!Array.isArray(w.labels) || w.labels.length < RICH_WORLD.labels) fail("world.labels", `at least ${RICH_WORLD.labels} labelled parts the viewer reads on screen (real names from the product when there is one)`);
  w.labels.forEach((l, i) => {
    if (!isText(l) || PLACEHOLDER.test(l)) fail(`world.labels[${i}]`, "the label as it appears on screen");
    if (l.trim().split(/\s+/u).length > RICH_WORLD.labelWords) fail(`world.labels[${i}]`, `a label is at most ${RICH_WORLD.labelWords} words; longer text is copy`);
  });
  if (!Array.isArray(w.camera)) fail("world.camera", "list the camera moves: [{ beat, move }]");
  const moving = new Set();
  w.camera.forEach((c, i) => {
    if (!Number.isInteger(c?.beat) || c.beat < 0 || c.beat >= t.beats.length) fail(`world.camera[${i}].beat`, "must be a beat index");
    if (!isText(c.move) || PLACEHOLDER.test(c.move) || LOCKED_CAMERA.test(c.move)) fail(`world.camera[${i}].move`, "name the move (push-in, truck, crane, orbit, rack focus); a locked shot is not listed");
    moving.add(c.beat);
  });
  if (moving.size < RICH_WORLD.cameraShare * t.beats.length - 1e-9) fail("world.camera", `the camera moves in ${moving.size} of ${t.beats.length} shots; a rich film moves it in at least half (keep the flash audit with slow light changes, not a locked camera)`);
}

// A stage shot: which layout its type and subject take, the one move the eye follows, and how it hands
// off to the next shot (a word from the style's transitions; the last shot ends).
function checkShot(t, b, i, f) {
  const style = readStyle(t.style);
  if (!LAYOUT_IDS.includes(b.layout)) fail(`${f}.layout`, `must be one of ${LAYOUT_IDS.join(", ")}`);
  if (!isText(b.hero) || PLACEHOLDER.test(b.hero)) fail(`${f}.hero`, "name the one move the eye follows in this shot");
  const last = i === t.beats.length - 1;
  if (last && b.transition !== "end") fail(`${f}.transition`, "the last shot's transition is end");
  if (!last && !style.transitions.includes(b.transition)) fail(`${f}.transition`, `the ${style.id} style hands off with ${style.transitions.join(", ")}`);
  if ("lines" in b) {
    const n = Array.isArray(t.copy?.lines) ? t.copy.lines.length : 0;
    if (!Array.isArray(b.lines) || b.lines.some((k) => !Number.isInteger(k) || k < 0 || k >= n)) fail(`${f}.lines`, "the indices of the copy lines this shot shows");
    if (b.layout === "full" && b.lines.length) fail(`${f}.lines`, "a full shot has no type zone, so it shows no copy");
  }
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
    if (d.kind === "screen") {
      const assets = Array.isArray(t.product?.assets) ? t.product.assets : [];
      const real = assets.find((a) => a.path === d.asset);
      if (!real || !SCREEN_ROLES.has(real.role)) fail(`${f}.asset`, "a product screen shows the product's real screenshot, UI or README image: name one listed in product.assets; never draw an invented one");
    }
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
  if (t.path === "stage") {
    const families = styleFamilies(readStyle(t.style));
    const off = p.faces.find((f) => !families.has(f));
    if (off) fail("typePlan.faces", `${off} is not a face of the ${t.style} style (${[...families].join(", ")})`);
  }
  if (!isText(p.hierarchy)) fail("typePlan.hierarchy", "must be a non-empty string");
  if (!Number.isInteger(p.maxWordsOnScreen) || p.maxWordsOnScreen < 1) fail("typePlan.maxWordsOnScreen", "must be a positive integer");
  if ("index" in p && typeof p.index !== "boolean") fail("typePlan.index", "must be true or false");
}

function checkPalette(t) {
  if (t.path === "stage") {
    if (!("palette" in t)) return;
    const rich = t.register === "rich";
    const allowed = new Set(styleColors(readStyle(t.style), { rich }));
    if (!Array.isArray(t.palette) || t.palette.length > (rich ? 14 : 9)) fail("palette", "a list of the style's colours with their roles");
    t.palette.forEach((p, i) => {
      if (!allowed.has(String(p?.color ?? "").toLowerCase())) fail(`palette[${i}].color`, `${p?.color} is not a colour of the ${t.style} style${rich ? " or one of its role accents" : " (a minimal film keeps to the core palette)"}; the stage palette comes from the style`);
      if (!isText(p.role)) fail(`palette[${i}].role`, "must be a non-empty string");
    });
    return;
  }
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
  if (!["score", "generated", "supplied", "authored", "none"].includes(s.mode)) fail("sound.mode", "must be score, generated, supplied, authored or none");
  if (!isText(s.plan)) fail("sound.plan", "must be a non-empty string");
  if (s.mode === "none" && !SILENCE_ASKED.test(t.request) && !MUTED_CHANNEL.test(t.channel)) {
    fail("sound.mode", "none only when the user asked for silence or the channel plays muted by design; the default is a score");
  }
  if (s.mode === "generated" && t.register === "rich") fail("sound.mode", "a rich film scores its own music (mode score); the style's preset beds are for minimal films (sound.md)");
  if ("genre" in s && !SCORE_GENRES.includes(s.genre)) fail("sound.genre", `must be one of ${SCORE_GENRES.join(", ")}`);
  if (s.mode === "generated") {
    try {
      normalizePalette(s.palette);
    } catch (error) {
      if (error instanceof SoundError) fail(error.field.startsWith("sound.") ? error.field : `sound.palette.${error.field}`, error.message);
      throw error;
    }
    const beds = styleBeds(readStyle(t.style));
    const same = (b) => ["timbre", "key", "mode", "tempo"].every((k) => String(s.palette[k]).toLowerCase() === String(b[k]).toLowerCase());
    if (!beds.some(same)) fail("sound.palette", `pick one of the ${t.style} style's beds: ${beds.map((b) => `${b.timbre} ${b.key} ${b.mode} ${b.tempo} BPM`).join("; ")}`);
  }
  if ((s.mode === "generated" || s.mode === "score") && t.path === "stage" && !("events" in s)) fail("sound.events", "list the on-screen events that make a sound: [{ t, on, kind }], at least 2, half of them away from the cuts (sound.md, Events)");
  if ("events" in s) checkEvents(t, s.events);
  if ((s.mode === "supplied" || s.mode === "authored") && !isText(s.file)) fail("sound.file", `a ${s.mode} track needs its file path`);
}

function checkEvents(t, events) {
  if (!Array.isArray(events) || events.length < 2) fail("sound.events", "at least 2 on-screen events that make a sound: [{ t, on, kind }]");
  const cuts = t.beats.slice(1).map((b) => b.t0);
  let offCut = 0;
  events.forEach((e, i) => {
    const f = `sound.events[${i}]`;
    if (typeof e?.t !== "number" || !(e.t > 0 && e.t < t.durationSec)) fail(`${f}.t`, `the second the event happens on screen, inside the film (0-${t.durationSec})`);
    if (!isText(e.on) || PLACEHOLDER.test(e.on)) fail(`${f}.on`, "what happens on screen at that moment, as a viewer would see it");
    if (!EVENT_SOUNDS.includes(e.kind)) fail(`${f}.kind`, `must be one of ${EVENT_SOUNDS.join(", ")}`);
    if (cuts.every((c) => Math.abs(c - e.t) >= EVENT_OFF_CUT_SEC - 1e-9)) offCut += 1;
  });
  if (offCut * 2 < events.length) fail("sound.events", `${events.length - offCut} of ${events.length} events sit on a cut; at least half sync to something moving inside a shot`);
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
 * The product's files on disk: each listed asset exists and still has its hash. An unreachable product
 * is exit 22: the film stops and the reply asks the user for the logo, screens and words.
 */
export function checkProductFiles(out, t) {
  const p = t.product;
  if (!p) return;
  if (p.unreachable) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: ${p.name}'s real assets could not be reached (${p.unreachable}); ask the user for its logo, a screenshot or the README images, put them in ${path.join(out, "stage", "assets")} and list them; never draw invented product screens`);
  for (const a of p.assets) {
    const file = path.join(out, a.path);
    if (!existsSync(file)) throw new BlockedError(EXIT.BLOCKED_ASSET_MISSING, `BLOCKED_ASSET_MISSING: ${a.path} is listed in product.assets and missing; fetch or supply it, never draw a stand-in`);
    if (createHash("sha256").update(readFileSync(file)).digest("hex") !== a.sha256) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${a.path} does not match its sha256 in product.assets; list it again after changing it`);
  }
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
  const treatment = validateTreatment(raw, { house: readHouse(out) });
  checkProductFiles(out, treatment);
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
