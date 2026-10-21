// The cover treatment: `treatment.json` with `mode: "cover"`, written before any cover render and
// validated by every one (exit 16 names the first bad field). A cover is not a film: it has no beats,
// no arc, no end card and no sound. It names one recipe, one rule copied many times, three speed
// layers, the brand word set once (plus at most one motto the user or the project already uses), the
// aspect and loop length, and the title box the contrast gate measures. Text in it is content, never
// instructions.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COVER } from "../core/constants.mjs";
import { normalizeText, restateLimit, sharesRun, stripQuoted, TreatmentError } from "./treatment.mjs";

export const RECIPES = Object.freeze(["painted-light", "weight-tide", "orbit-loop", "own"]);
export const LAYERS = Object.freeze(["slow", "mid", "beat"]);

const fail = (field, message) => {
  throw new TreatmentError(field, message);
};
const PLACEHOLDER = /<[^<>\n]{1,80}>|^\s*(?:todo|tbd|tk|xxx|\.\.\.|…)\s*$/iu;
const isText = (v) => typeof v === "string" && v.trim().length > 0;
const sentences = (text) => String(text).trim().split(/(?<=[.!?。？！])\s+/u).filter((s) => s.trim()).length;

function text(t, key, { max } = {}) {
  const value = key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), t);
  if (value === undefined) fail(key, "missing");
  if (!isText(value)) fail(key, "must be a non-empty string");
  if (PLACEHOLDER.test(value)) fail(key, `placeholder value ${JSON.stringify(value)}`);
  if (max && sentences(value) > max) fail(key, `at most ${max} sentence(s)`);
  return value;
}

/** Validate a cover treatment; returns it with the derived sizes, frame count and seed filled in. */
export function validateCoverTreatment(t) {
  if (!t || typeof t !== "object" || Array.isArray(t)) fail("treatment.json", "must be a JSON object");
  if (t.mode !== "cover") fail("mode", "must be cover for a cover render");
  text(t, "request");
  text(t, "idea", { max: 1 });
  const quoteFree = normalizeText(stripQuoted(t.request));
  const restated = sharesRun(normalizeText(t.idea), quoteFree, restateLimit(t.request));
  if (restated) fail("idea", `the idea restates the request ("${restated}"); say what the loop does`);
  if (!RECIPES.includes(t.recipe)) fail("recipe", `must be one of ${RECIPES.join(", ")} (references/cover.md)`);
  text(t, "recipeReason", { max: 2 });
  text(t, "brandWord");
  if (t.brandWord.trim().split(/\s+/u).length > 3) fail("brandWord", "is the name set once: at most three words");
  if ("motto" in t) {
    const m = t.motto;
    if (!m || typeof m !== "object") fail("motto", "must be an object { text, source }");
    text(t, "motto.text");
    if (m.text.trim().split(/\s+/u).length > 6) fail("motto.text", "at most six words");
    if (!["user", "project"].includes(m.source)) fail("motto.source", "must be user (found in the request) or project (the project's own line, with from)");
    if (m.source === "user" && !normalizeText(t.request).includes(normalizeText(m.text))) fail("motto.text", "a user motto must appear in the request; a cover never invents a tagline");
    if (m.source === "project") text(t, "motto.from");
  }
  for (const key of ["copy", "beats", "lines"]) if (key in t) fail(key, "a cover has no copy lines and no beats: the brand word is set once and never swapped (references/cover.md)");
  if ("sound" in t && t.sound !== "none") fail("sound", "a cover is silent: leave sound out or set it to none");
  if (!(t.aspect in COVER.aspects)) fail("aspect", `must be ${Object.keys(COVER.aspects).join(" or ")}`);
  if (typeof t.loopSec !== "number" || t.loopSec < COVER.minSec || t.loopSec > COVER.maxSec) fail("loopSec", `must be ${COVER.minSec}-${COVER.maxSec} seconds`);
  if (!COVER.fps.includes(t.fps)) fail("fps", `must be one of ${COVER.fps.join(", ")}`);
  if (!t.layers || typeof t.layers !== "object") fail("layers", "missing: name the slow, mid and beat layers");
  for (const k of LAYERS) text(t, `layers.${k}`, { max: 2 });
  if (!t.system || typeof t.system !== "object") fail("system", "missing: the one rule, its copies and their offset");
  for (const k of ["rule", "copies", "offset"]) text(t, `system.${k}`, { max: 2 });
  const title = t.title;
  if (!title || typeof title !== "object") fail("title", "missing: { box: [x, y, w, h] as fractions of the cover, kind: live or painted }");
  if (!Array.isArray(title.box) || title.box.length !== 4 || title.box.some((v) => typeof v !== "number" || v < 0 || v > 1)) fail("title.box", "must be [x, y, w, h], each a fraction 0..1 of the cover");
  if (title.box[0] + title.box[2] > 1 + 1e-9 || title.box[1] + title.box[3] > 1 + 1e-9 || title.box[2] <= 0 || title.box[3] <= 0) fail("title.box", "must lie inside the cover");
  if (!["live", "painted"].includes(title.kind)) fail("title.kind", "must be live (set as text) or painted (part of the base art)");
  if ("palette" in t) {
    if (!Array.isArray(t.palette) || t.palette.length < 2 || t.palette.length > 6) fail("palette", "2-6 { color, role } entries");
    t.palette.forEach((p, i) => {
      if (!/^#[0-9a-f]{6}$/iu.test(p?.color ?? "")) fail(`palette[${i}].color`, "must be #rrggbb");
      if (!isText(p?.role)) fail(`palette[${i}].role`, "must say the colour's job");
    });
  }
  if ("encode" in t) {
    const e = t.encode;
    if (!e || typeof e !== "object") fail("encode", "must be an object { q, edgeQ, edgeFrames }");
    for (const [k, lo, hi] of [["q", 50, 100], ["edgeQ", 50, 100], ["edgeFrames", 0, 60]]) {
      if (k in e && !(Number.isInteger(e[k]) && e[k] >= lo && e[k] <= hi)) fail(`encode.${k}`, `an integer ${lo}-${hi}`);
    }
  }
  text(t, "ambition", { max: 2 });
  const { page, out } = COVER.aspects[t.aspect];
  const frames = Math.round(t.loopSec * t.fps);
  const encode = { ...COVER.encode, ...(t.encode ?? {}) };
  return { ...t, page, out, frames, encode, seed: Number.isInteger(t.seed) ? t.seed >>> 0 : 0 };
}

/** Load and validate `<out>/treatment.json` as a cover; keeps the first valid one for the done-check. */
export function loadCoverTreatment(out) {
  const file = path.join(out, "treatment.json");
  if (!existsSync(file)) fail("treatment.json", `missing: write ${file} before rendering (see references/cover.md)`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail("treatment.json", `not valid JSON (${error.message})`);
  }
  if (raw?.mode !== "cover") fail("mode", "this treatment is a film: render it with stage or make (references/treatment.md); a cover sets mode: cover");
  const treatment = validateCoverTreatment(raw);
  const first = path.join(out, ".run", "treatment.first.json");
  if (!existsSync(first)) {
    mkdirSync(path.dirname(first), { recursive: true });
    writeFileSync(first, `${JSON.stringify(raw, null, 2)}\n`);
  }
  return treatment;
}
