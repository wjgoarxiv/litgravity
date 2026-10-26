// House styles: the data a film is built from, so two films in one style share palette, faces, type
// scale, layout zones, motion tokens, transitions and sound. A style lives in `styles/<id>.json`; the
// treatment names one, the validator checks it is the style the rules choose (named in the request,
// the project's house style, or the fixed keyword auto-pick), the renderer serves it to the stage page
// as /lit/style.css and /lit/style.js, and the text QA judges copy against it. Layout zones are one
// grid for every style, named per shot and mapped per format, so a story re-lays itself per format
// instead of being cropped. The three styles with a `typePreset` mean the same on the type path.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { matchesKeyword } from "../core/presets.mjs";
import { contrastRatio, relativeLuminance } from "../core/util.mjs";

export const STYLE_SCHEMA = "litgravity.motion-style/v1";
export const STYLE_IDS = Object.freeze(["swiss-signal", "tidal", "terminalcore", "paper"]);
export const DEFAULT_STYLE = "swiss-signal";
export const TYPE_ROLES = Object.freeze(["display", "headline", "body", "label"]);
export const TRANSITIONS = Object.freeze(["cut", "match", "wipe", "push", "iris", "dissolve", "morph"]);
/** Copy may sit this far (a share of the frame side) outside its zone, and this far off a scale step. */
export const ZONE_TOLERANCE = 0.012;
export const SIZE_TOLERANCE = 0.04;

// [x, y, w, h] as fractions of the frame. `type` is where copy may sit; `subject` is where the drawing
// leads (a `title` or `full` subject spans the frame as a backdrop). Every type zone lies inside the
// central 90 % title-safe area.
export const LAYOUTS = Object.freeze({
  "16:9": Object.freeze({
    title: { type: [0.08, 0.2, 0.84, 0.6], subject: [0, 0, 1, 1] },
    split: { type: [0.08, 0.16, 0.36, 0.68], subject: [0.48, 0.08, 0.46, 0.84] },
    "split-alt": { type: [0.56, 0.16, 0.36, 0.68], subject: [0.06, 0.08, 0.46, 0.84] },
    stage: { type: [0.08, 0.75, 0.84, 0.18], subject: [0.06, 0.07, 0.88, 0.64] },
    hero: { type: [0.08, 0.76, 0.84, 0.17], subject: [0.03, 0.03, 0.94, 0.94] },
    full: { type: null, subject: [0, 0, 1, 1] },
  }),
  "9:16": Object.freeze({
    title: { type: [0.09, 0.26, 0.82, 0.48], subject: [0, 0, 1, 1] },
    split: { type: [0.09, 0.08, 0.82, 0.26], subject: [0.06, 0.36, 0.88, 0.56] },
    "split-alt": { type: [0.09, 0.66, 0.82, 0.26], subject: [0.06, 0.06, 0.88, 0.56] },
    stage: { type: [0.09, 0.79, 0.82, 0.13], subject: [0.06, 0.06, 0.88, 0.68] },
    hero: { type: [0.09, 0.8, 0.82, 0.12], subject: [0.03, 0.03, 0.94, 0.94] },
    full: { type: null, subject: [0, 0, 1, 1] },
  }),
});
export const LAYOUT_IDS = Object.freeze(Object.keys(LAYOUTS["16:9"]));
const FRAME = Object.freeze({ "16:9": [1920, 1080], "9:16": [1080, 1920] });

// With no name, house file or keyword, the genre picks the style where one reads better than the
// default: an explainer on the warm, legible paper ground (stage only), a brand mood on the tidal flow.
export const GENRE_STYLE = Object.freeze({ explainer: "paper", "brand-mood": "tidal" });

// Checked in order; the first row with a whole-word hit wins. A style the request names outright wins
// over every row. `paper` has no type-engine preset, so the type path skips its row.
export const STYLE_PICK = Object.freeze([
  { style: "terminalcore", korean: ["터미널", "CRT", "해커"], latin: ["terminal", "hacker", "crt"] },
  { style: "tidal", korean: ["물결", "파도", "잔잔한", "흐름"], latin: ["gradient", "wave", "tide", "calm"] },
  { style: "paper", korean: ["따뜻한", "밝은", "종이", "손그림", "포근한", "아기자기"], latin: ["warm", "cozy", "bright", "paper", "handmade", "hand-drawn"] },
]);
const NAMED = Object.freeze({
  "swiss-signal": ["swiss-signal", "swiss signal", "스위스 시그널"],
  tidal: ["tidal", "타이달"],
  terminalcore: ["terminalcore", "터미널코어"],
  paper: ["paper style", "paper look", "페이퍼 스타일", "페이퍼"],
});

export class StyleError extends Error {}

const HEX = /^#[0-9a-f]{6}$/iu;
const isText = (v) => typeof v === "string" && v.trim().length > 0;

/** Validate a style document; returns it or throws StyleError naming the first bad field. */
export function validateStyle(style) {
  const fail = (field, message) => {
    throw new StyleError(`style ${style?.id ?? "?"}: ${field}: ${message}`);
  };
  if (!style || typeof style !== "object") fail("style", "must be an object");
  if (style.schema !== STYLE_SCHEMA) fail("schema", `must be ${STYLE_SCHEMA}`);
  if (!STYLE_IDS.includes(style.id)) fail("id", `must be one of ${STYLE_IDS.join(", ")}`);
  for (const k of ["name", "summary"]) if (!isText(style[k])) fail(k, "must be a non-empty string");
  const p = style.palette ?? {};
  for (const role of ["ground", "surface", "ink", "muted", "signal", "line"]) if (!HEX.test(p[role] ?? "")) fail(`palette.${role}`, "must be #rrggbb");
  if (!Array.isArray(style.textRoles) || style.textRoles.some((r) => !HEX.test(p[r] ?? ""))) fail("textRoles", "every text role names a palette colour");
  const ground = relativeLuminance(p.ground);
  if (contrastRatio(relativeLuminance(p.ink), ground) < 7) fail("palette.ink", "ink on ground needs 7:1");
  if (contrastRatio(relativeLuminance(p.muted), ground) < 4.5) fail("palette.muted", "muted on ground needs 4.5:1");
  for (const role of ["signal", "accent"]) if (p[role] && contrastRatio(relativeLuminance(p[role]), ground) < 3) fail(`palette.${role}`, `${role} on ground needs 3:1 (large type)`);
  if (!Array.isArray(style.accents) || style.accents.length < 3) fail("accents", "names at least three role accents a rich film may add");
  style.accents.forEach((a, i) => {
    if (!isText(a?.role)) fail(`accents[${i}].role`, "says what the colour marks");
    if (!HEX.test(a?.color ?? "")) fail(`accents[${i}].color`, "must be #rrggbb");
    if (contrastRatio(relativeLuminance(a.color), ground) < 3) fail(`accents[${i}].color`, "an accent on ground needs 3:1 (large type)");
  });
  for (const role of TYPE_ROLES) if (!isText(style.faces?.[role]?.family)) fail(`faces.${role}`, "needs a family");
  for (const format of Object.keys(FRAME)) {
    const s = style.scale?.[format];
    if (!s || TYPE_ROLES.some((r) => !(s[r] > 0))) fail(`scale.${format}`, "needs a size per type role");
    if (!(s.display > s.headline && s.headline > s.body && s.body > s.label)) fail(`scale.${format}`, "steps must descend display > headline > body > label");
  }
  const m = style.motion ?? {};
  for (const k of ["enter", "move", "exit"]) if (!Array.isArray(m.ease?.[k]) || m.ease[k].length !== 4) fail(`motion.ease.${k}`, "is a cubic-bezier [x1, y1, x2, y2]");
  for (const k of ["micro", "move", "hero", "exit"]) if (!(m.dur?.[k] > 0)) fail(`motion.dur.${k}`, "seconds > 0");
  if (!(m.dur.exit <= m.dur.hero)) fail("motion.dur.exit", "an exit is never longer than the hero move");
  if (!Array.isArray(style.transitions) || !style.transitions.length || style.transitions.some((x) => !TRANSITIONS.includes(x))) fail("transitions", `a subset of ${TRANSITIONS.join(", ")}`);
  if (!isText(style.score?.genre)) fail("score.genre", "names the genre a film's score takes by default");
  if (!style.sound || !isText(style.sound.timbre)) fail("sound", "needs the generated bed's palette");
  if (!Array.isArray(style.beds) || style.beds.length < 2 || style.beds.some((b) => !isText(b?.timbre) || !isText(b?.key) || !(b?.tempo > 0))) fail("beds", "lists at least two beds a film may pick, each { timbre, key, mode, tempo }");
  const same = (a, b) => ["timbre", "key", "mode", "tempo"].every((k) => String(a[k]).toLowerCase() === String(b[k]).toLowerCase());
  if (!style.beds.some((b) => same(b, style.sound))) fail("beds", "must include the default bed (sound)");
  if (!Array.isArray(style.bans) || style.bans.length < 3) fail("bans", "names at least three defaults this style never uses");
  return style;
}

const cache = new Map();
/** Load a shipped style by id (validated, frozen). */
export function readStyle(id) {
  if (!STYLE_IDS.includes(id)) throw new StyleError(`unknown style: ${id} (choose ${STYLE_IDS.join(", ")})`);
  if (!cache.has(id)) cache.set(id, Object.freeze(validateStyle(JSON.parse(readFileSync(fileURLToPath(new URL(`../../styles/${id}.json`, import.meta.url)), "utf8")))));
  return cache.get(id);
}

/** Every font family copy may use in this style (the role faces, the Hangul face, Pretendard). */
export const styleFamilies = (style) => new Set([...TYPE_ROLES.map((r) => style.faces[r].family), style.hangul?.family ?? "Pretendard", "Pretendard"]);
/** The hex colours copy may use. */
export const styleTextColors = (style) => style.textRoles.map((r) => style.palette[r].toLowerCase());
/** The beds a film in this style may pick from, the default first. */
export const styleBeds = (style) => style.beds;
/** The role accents a rich film may add to the core palette, each { role, color }. */
export const styleAccents = (style) => style.accents;
/** All palette colours of the style (what a stage treatment's palette may list); rich adds the accents. */
export const styleColors = (style, { rich = false } = {}) => [...Object.values(style.palette), ...(rich ? style.accents.map((a) => a.color) : [])].map((c) => c.toLowerCase());

/**
 * Which style a film takes. A style the request names wins; then the project's house style; then the
 * keyword auto-pick; then the genre's style; then the default. Returns { id, source, reason }.
 */
export function pickStyle({ request = "", copy = [], path = "stage", house = null, genre = null } = {}) {
  const text = String(request);
  for (const [id, names] of Object.entries(NAMED)) {
    if (path === "type" && !readStyle(id).typePreset) continue;
    const hit = names.find((n) => matchesKeyword(text, n, /[가-힣]/u.test(n)));
    if (hit) return { id, source: "request", reason: `the request names the ${id} style ("${hit}")` };
  }
  if (house?.style && STYLE_IDS.includes(house.style) && (path !== "type" || readStyle(house.style).typePreset)) {
    return { id: house.style, source: "house", reason: `the project's house style is ${house.style} (motion-house.json)` };
  }
  const haystack = [text, ...copy].join("\n");
  for (const row of STYLE_PICK) {
    if (path === "type" && !readStyle(row.style).typePreset) continue;
    for (const k of row.korean) if (matchesKeyword(haystack, k, true)) return { id: row.style, source: "auto", reason: `the request mentions "${k}"` };
    for (const k of row.latin) if (matchesKeyword(haystack, k, false)) return { id: row.style, source: "auto", reason: `the request mentions "${k}"` };
  }
  const byGenre = GENRE_STYLE[genre];
  if (byGenre && (path !== "type" || readStyle(byGenre).typePreset)) return { id: byGenre, source: "genre", reason: `no style is named and no keyword picks one, and a ${genre} film takes ${byGenre}` };
  return { id: DEFAULT_STYLE, source: "default", reason: `no style is named and no keyword picks one, so the default ${DEFAULT_STYLE}` };
}

/** A layout's zones in pixels for a format: { type: {x, y, w, h} | null, subject: {...} }. */
export function zonesPx(format) {
  const [W, H] = FRAME[format];
  const px = (r) => (r ? { x: Math.round(r[0] * W), y: Math.round(r[1] * H), w: Math.round(r[2] * W), h: Math.round(r[3] * H) } : null);
  return Object.fromEntries(Object.entries(LAYOUTS[format]).map(([id, z]) => [id, { type: px(z.type), subject: px(z.subject) }]));
}

/** The type step a rendered size sits on, or null when it is off the style's scale. */
export function scaleStep(style, format, sizePx) {
  for (const role of TYPE_ROLES) {
    const step = style.scale[format][role];
    if (Math.abs(sizePx - step) <= step * SIZE_TOLERANCE) return role;
  }
  return null;
}

const familyStack = (style, role) => {
  const f = style.faces[role];
  const hangul = style.hangul?.family ?? "Pretendard";
  return [f.family, hangul, "Pretendard"].filter((x, i, a) => a.indexOf(x) === i).map((x) => `"${x}"`).join(", ");
};

/** /lit/style.css for one style and format: custom properties, type-role classes, colour classes. */
export function styleCss(style, format) {
  const s = style.scale[format];
  const vars = [
    ...Object.entries(style.palette).map(([k, v]) => `  --lit-${k}: ${v};`),
    ...TYPE_ROLES.map((r) => `  --lit-size-${r}: ${s[r]}px;`),
  ];
  const roles = TYPE_ROLES.map((r) => {
    const f = style.faces[r];
    return `.lit-${r} { font-family: ${familyStack(style, r)}; font-size: ${s[r]}px; font-weight: ${f.weight}; ${f.stretch ? `font-stretch: ${f.stretch}; ` : ""}line-height: ${style.leading?.[r] ?? 1.3}; letter-spacing: 0; margin: 0; }`;
  });
  const colours = style.textRoles.map((r) => `.lit-${r === "ground" ? "knockout" : r} { color: var(--lit-${r}); }`);
  return [
    `/* lit-typographic-motion style: ${style.id} (${format}) */`,
    `:root {\n${vars.join("\n")}\n}`,
    // Korean breaks only between eojeol, never inside a word (type-craft.md, MO-A-13).
    `html, body { margin: 0; overflow: hidden; background: var(--lit-ground); color: var(--lit-ink); font-family: ${familyStack(style, "body")}; word-break: keep-all; overflow-wrap: break-word; }`,
    ...roles,
    ...colours,
    ".lit-zone { position: absolute; box-sizing: border-box; }",
    "",
  ].join("\n");
}

/** /lit/style.js: window.LitStyle (tokens and pixel zones) and window.LitTimeline (the treatment's shots). */
export function styleScript(style, format, treatment) {
  const timeline = {
    format, fps: treatment.fps ?? 60, duration: treatment.durationSec,
    beats: (treatment.beats ?? []).map((b, i) => ({ index: i, t0: b.t0, t1: b.t1, layout: b.layout ?? null, transition: b.transition ?? null })),
  };
  const data = {
    id: style.id, name: style.name, format, palette: style.palette, textRoles: style.textRoles,
    faces: style.faces, hangul: style.hangul ?? null, scale: style.scale[format], leading: style.leading ?? {},
    motion: style.motion, transitions: style.transitions, ground: style.ground, zones: zonesPx(format),
  };
  return `window.LitStyle = Object.freeze(${JSON.stringify(data)});\nwindow.LitTimeline = Object.freeze(${JSON.stringify(timeline)});\n`;
}
