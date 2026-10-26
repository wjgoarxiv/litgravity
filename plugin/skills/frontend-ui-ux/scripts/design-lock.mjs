#!/usr/bin/env node
// Design lock: the one place a build picks its look. It writes the chosen house style into the
// project as design.lock.json plus ui/tokens.css, ui/components.css, ui/ui.js and the fonts, and
// the interface probe then checks the rendered page against that lock (DS-* rules).
//
//   node design-lock.mjs list
//   node design-lock.mjs init --family <landing|workspace|settings> --dir <project> [--style <id>]
//                             [--brief "<request text>"] [--density rich|calm] [--moment <kind> --moment-note "<what it is>"
//                             [--moment-place "<where it sits>"]] [--scaffold] [--from <style.json>] [--force]
//   node design-lock.mjs moment --dir <project> --kind <kind> --note "<what it is>" [--place "<where>"]
// Without --style a style the brief names by keyword applies (styleForBrief), else the family
// default (DEFAULT_STYLE_BY_FAMILY).
//   node design-lock.mjs match "<request text>"
//   node design-lock.mjs show --dir <project>
//
// `--from` takes a brand's own style file in the same schema as kit/styles/*.json; its id must not
// reuse a kit style id. Nothing here fetches from the network or installs anything.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KIT = join(SKILL_ROOT, "kit");
export const LOCK_FILE = "design.lock.json";
export const LOCK_SCHEMA = "litfamily.design-lock/v1";
export const STYLE_SCHEMA = "litfamily.frontend-style/v1";
export const FAMILIES = Object.freeze({
  landing: "read-once pages: landing, product, launch, portfolio, docs home",
  workspace: "screens people work in: dashboards, consoles, admin, tools, tables",
  settings: "guided forms: settings, account, onboarding, checkout steps",
});
// The user-decided defaults (2026-10-25) when a brief gives no visual direction: read-once pages
// keep the authored field-notes profile; work surfaces use graphite. meadow is never a default.
export const DEFAULT_STYLE_BY_FAMILY = Object.freeze({ landing: "field-notes", workspace: "graphite", settings: "graphite" });
// Round 2 (user decision A, 2026-10-25): the lock fixes the look, and every page names the one place
// it is allowed to be bold. Read-once pages take a bold moment above the fold; work surfaces stay
// calm and take a small one. The probe checks the declared kind against [data-ui-moment] (DS-008).
export const MOMENT_SCALE_BY_FAMILY = Object.freeze({ landing: "bold", workspace: "small", settings: "small" });
export const MOMENT_KINDS = Object.freeze({
  bold: Object.freeze(["hero-composition", "type-set-piece", "data-moment", "diagram", "motion-detail", "interactive-object"]),
  small: Object.freeze(["chart", "empty-state", "header-detail"]),
});
export const MOMENT_SELECTOR = "[data-ui-moment]";
export const COLOR_ROLES = Object.freeze(["canvas", "surface", "sunken", "ink", "ink-2", "ink-3", "line", "line-strong", "control", "accent", "accent-hover", "on-accent", "accent-wash", "accent-ink", "accent-2", "accent-2-ink", "accent-2-wash", "on-accent-2", "support", "support-ink", "focus", "positive", "positive-wash", "warning", "warning-wash", "negative", "negative-wash", "info", "info-wash", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]);
const SCALE_KEYS = ["xs", "sm", "md", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
const RADIUS_KEYS = ["xs", "sm", "md", "lg", "pill"];
const HEX = /^#[0-9a-f]{6}$/u;
// The shape block carries what makes a register more than a palette: border weights, which role
// draws outlines, the elevation grammar the probe enforces (DS-007), how a button presses, and the
// case and family of meta text. Every value is closed so components.css can stay token-only.
export const SHAPE_CHOICES = Object.freeze({
  surface_line: ["line", "line-strong", "ink"],
  control_edge: ["control", "ink"],
  elevation: ["soft", "offset", "flat"],
  press: ["scale", "shift", "none"],
  meta_font: ["text", "mono"],
  meta_case: ["none", "uppercase"],
  display_case: ["none", "uppercase"],
  canvas_pattern: ["none", "dots", "grid", "plot"],
  heading_font: ["display", "mono"],
  panel_head: ["plain", "inverse", "accent"],
  section_marks: ["none", "coord"],
});

export function kitStyles() {
  return readdirSync(join(KIT, "styles")).filter((name) => name.endsWith(".json")).sort()
    .map((name) => JSON.parse(readFileSync(join(KIT, "styles", name), "utf8")));
}

// Returns a list of problems; an empty list means the style can be locked.
export function validateStyle(style) {
  const issues = [];
  if (!style || typeof style !== "object") return ["style is not an object"];
  if (style.schema_id !== STYLE_SCHEMA) issues.push(`schema_id must be ${STYLE_SCHEMA}`);
  if (!/^[a-z][a-z0-9-]{1,31}$/u.test(style.id ?? "")) issues.push("id must be a short kebab-case name");
  for (const role of ["text", "display", "mono"]) if (typeof style.fonts?.[role] !== "string" || !style.fonts[role].trim()) issues.push(`fonts.${role} is required`);
  for (const key of SCALE_KEYS) if (!Number.isFinite(style.type?.scale_px?.[key])) issues.push(`type.scale_px.${key} is required`);
  if (!(style.type?.display_px?.min > 0 && style.type.display_px.max >= style.type.display_px.min)) issues.push("type.display_px needs min ≤ max");
  if (!(style.type?.moment_px?.max > style.type?.display_px?.max)) issues.push("type.moment_px.max must sit above type.display_px.max");
  for (const key of ["text", "medium", "strong", "display"]) if (!Number.isFinite(style.type?.weights?.[key])) issues.push(`type.weights.${key} is required`);
  for (const key of RADIUS_KEYS) if (!Number.isFinite(style.radius_px?.[key])) issues.push(`radius_px.${key} is required`);
  if (!Array.isArray(style.space_px) || style.space_px.some((v) => !Number.isInteger(v) || v % 4 !== 0)) issues.push("space_px must be multiples of 4");
  for (const theme of ["light", "dark"]) {
    for (const role of COLOR_ROLES) if (!HEX.test(style.color?.[theme]?.[role] ?? "")) issues.push(`color.${theme}.${role} must be #rrggbb`);
  }
  const shape = style.shape;
  for (const key of ["rule", "surface", "control"]) if (!(Number.isInteger(shape?.border_px?.[key]) && shape.border_px[key] >= 1 && shape.border_px[key] <= 4)) issues.push(`shape.border_px.${key} must be 1 to 4`);
  for (const [key, allowed] of Object.entries(SHAPE_CHOICES)) if (!allowed.includes(shape?.[key])) issues.push(`shape.${key} must be one of ${allowed.join(", ")}`);
  for (const key of ["surface", "control"]) if (!(Number.isInteger(shape?.offset_px?.[key]) && shape.offset_px[key] >= 0)) issues.push(`shape.offset_px.${key} is required`);
  if (shape?.elevation === "offset" && !(shape.offset_px?.surface > 0 && shape.offset_px?.control > 0)) issues.push("an offset elevation needs offset_px above 0");
  if (shape?.elevation !== "offset" && (shape?.offset_px?.surface || shape?.offset_px?.control || shape?.press === "shift")) issues.push("offset_px and press shift belong to an offset elevation");
  for (const key of ["keywords", "signature", "forbid"]) if (!Array.isArray(style[key]) || !style[key].length || style[key].some((item) => typeof item !== "string" || !item.trim())) issues.push(`${key} needs at least one entry`);
  return issues;
}

// The kit style a brief names, or null. A brief that names a register by one of a style's keywords
// picks it; when two styles match ("neo-brutalism" also contains "brutalism") the longer keyword
// wins. Latin keywords must start at a word boundary so "crt" does not match inside a word.
export function styleForBrief(text, styles = kitStyles()) {
  const haystack = String(text ?? "").toLowerCase();
  let best = null;
  for (const style of styles) {
    for (const keyword of style.keywords ?? []) {
      const word = keyword.toLowerCase();
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const pattern = /^[a-z]/u.test(word) ? new RegExp(`(?<![a-z0-9])${escaped}`, "u") : new RegExp(escaped, "u");
      if (pattern.test(haystack) && (!best || word.length > best.keyword.length)) best = { id: style.id, keyword: word };
    }
  }
  return best;
}

// Density (user rule, 2026-10-25): rich is the default register; calm only when the request asks
// for a minimal, quiet or restrained page, or --density calm. Calm keeps the broad, flat page the
// kit shipped before; rich tightens the section rhythm and turns on texture and a glow token.
export const DENSITIES = Object.freeze(["rich", "calm"]);
const CALM_WORDS = [/(?<![a-z])minimal(?:ist|ism)?(?![a-z])/u, /(?<![a-z])(?:calm|quiet|restrained|understated|pared[- ]back|sparse)(?![a-z])/u, /미니멀/u, /차분/u, /절제/u, /담백/u, /간결/u];
export function densityForBrief(text) {
  const haystack = String(text ?? "").toLowerCase();
  return CALM_WORDS.some((pattern) => pattern.test(haystack)) ? "calm" : "rich";
}
const checkDensity = (density) => {
  if (!DENSITIES.includes(density)) throw new Error(`--density must be rich or calm, not "${density}"`);
  return density;
};

const fontStack = (family, kind) => {
  const tail = kind === "mono"
    ? `ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`
    : `"Pretendard Variable", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", sans-serif`;
  return `"${family}", ${tail}`;
};

export function tokensCss(style, fontFiles, density = "rich") {
  const calm = checkDensity(density) === "calm";
  const t = style.type;
  const { min, max } = t.display_px;
  const slope = (max - min) / (1440 - 390);
  const intercept = min - slope * 390;
  const colors = (theme, indent = "  ") => COLOR_ROLES.map((role) => `${indent}--c-${role}: ${style.color[theme][role]};`).join("\n");
  const shape = style.shape;
  const control = shape.offset_px.control;
  const press = { scale: "scale(0.96)", shift: `translate(${control}px, ${control}px)`, none: "none" }[shape.press];
  const grid = "linear-gradient(color-mix(in srgb, var(--c-line) 70%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--c-line) 70%, transparent) 1px, transparent 1px)";
  // The plot grid: minor lines lighter than the grid style, a stronger line every five cells.
  // Both stay on --c-line so body text keeps its contrast over every stop (CF-204) in light and dark.
  const minor = grid.replaceAll("70%", "50%");
  const major = grid.replaceAll("70%", "85%");
  // Notebook dots are texture, so the calm register drops them; grid and plot are a register's structure and stay.
  const dots = "radial-gradient(circle, color-mix(in srgb, var(--c-line-strong) 55%, transparent) 1px, transparent 1.5px)";
  const pattern = { none: ["none", "auto"], dots: calm ? ["none", "auto"] : [dots, "24px 24px"], grid: [grid, "32px 32px"], plot: [`${minor}, ${major}`, "32px 32px, 32px 32px, 160px 160px, 160px 160px"] }[shape.canvas_pattern];
  // A soft accent glow for one atmosphere surface; flat and offset registers keep their own elevation grammar (DS-007).
  const glow = calm || shape.elevation !== "soft" ? "none" : "0 0 48px color-mix(in srgb, var(--c-accent) 30%, transparent), 0 0 96px color-mix(in srgb, var(--c-accent-2) 18%, transparent)";
  const pad = calm ? { section: [64, 96, 128], hero: [48, 64, 80] } : { section: [48, 72, 96], hero: [40, 56, 64] };
  const head = { plain: ["transparent", "inherit", "initial", 0], inverse: ["var(--c-ink)", "var(--c-canvas)", "var(--c-canvas)", 1], accent: ["var(--c-accent)", "var(--c-on-accent)", "var(--c-on-accent)", 1] }[shape.panel_head];
  const moment = t.moment_px.max;
  const momentSlope = (moment - min) / (1440 - 390);
  const faces = fontFiles.map((font) => `@font-face {\n  font-family: "${font.family}";\n  src: url("fonts/${font.file}") format("woff2");\n  font-weight: ${font.weight};\n  font-style: normal;\n  font-display: swap;\n}`).join("\n");
  return `/* Generated by frontend-ui-ux scripts/design-lock.mjs for the "${style.id}" style. Do not edit by hand:
   re-run design-lock.mjs, or change the style file and lock again. */
${faces}
:root {
  --ui-lock: "${style.id}";
  --density: "${calm ? "calm" : "rich"}";
  --font-text: ${fontStack(style.fonts.text, "text")};
  --font-display: ${fontStack(style.fonts.display, "text")};
  --font-mono: ${fontStack(style.fonts.mono, "mono")};
  --font-text-ko: ${style.fonts.text === style.fonts.mono ? fontStack(style.fonts.display, "text") : "var(--font-text)"};
${SCALE_KEYS.map((key) => `  --fs-${key}: ${t.scale_px[key]}px;`).join("\n")}
  --fs-display: clamp(${min}px, ${intercept.toFixed(2)}px + ${(slope * 100).toFixed(3)}vw, ${max}px);
  --fs-moment: clamp(${min}px, ${(min - momentSlope * 390).toFixed(2)}px + ${(momentSlope * 100).toFixed(3)}vw, ${moment}px);
  --fw-text: ${t.weights.text};
  --fw-medium: ${t.weights.medium};
  --fw-strong: ${t.weights.strong};
  --fw-display: ${t.weights.display};
  --track-display: ${t.tracking_em.display}em;
  --track-label: ${t.tracking_em.label}em;
  --lh-body: ${t.leading.body};
  --lh-tight: ${t.leading.tight};
  --lh-display: ${t.leading.display_latin};
  --lh-display-ko: ${t.leading.display_korean};
${style.space_px.map((value) => `  --sp-${value}: ${value}px;`).join("\n")}
${RADIUS_KEYS.map((key) => `  --radius-${key}: ${style.radius_px[key]}px;`).join("\n")}
  --shadow-raised: ${style.shadow.raised};
  --shadow-overlay: ${style.shadow.overlay};
  --shadow-control: ${shape.elevation === "offset" ? `${control}px ${control}px 0 0 var(--c-ink)` : "none"};
  --shadow-control-pressed: ${shape.elevation === "offset" ? "0 0 0 0 var(--c-ink)" : "none"};
  --press: ${press};
  --bw-rule: ${shape.border_px.rule}px;
  --bw-surface: ${shape.border_px.surface}px;
  --bw-control: ${shape.border_px.control}px;
  --c-frame: var(--c-${shape.surface_line});
  --control-edge: ${shape.control_edge === "ink" ? "var(--c-ink)" : "initial"};
  --font-meta: ${shape.meta_font === "mono" ? "var(--font-mono)" : "var(--font-text)"};
  --font-heading: ${shape.heading_font === "mono" ? "var(--font-mono)" : "var(--font-display)"};
  --font-heading-ko: ${shape.heading_font === "mono" ? "var(--font-display)" : "var(--font-heading)"};
  --panel-head-bg: ${head[0]};
  --panel-head-ink: ${head[1]};
  --panel-head-status: ${head[2]};
  --panel-head-bleed: ${head[3]};
  --section-marks: ${shape.section_marks === "coord" ? "block" : "none"};
  --meta-case: ${shape.meta_case};
  --display-case: ${shape.display_case};
  --canvas-pattern: ${pattern[0]};
  --canvas-pattern-size: ${pattern[1]};
  --glow: ${glow};
  --dur-fast: ${style.motion.fast_ms}ms;
  --dur-ui: ${style.motion.ui_ms}ms;
  --dur-enter: ${style.motion.enter_ms}ms;
  --dur-exit: ${style.motion.exit_ms}ms;
  --ease: ${style.motion.ease};
  --gutter: 16px;
  --work-gutter: 16px;
  --section-pad: ${pad.section[0]}px;
  --hero-pad: ${pad.hero[0]}px;
${colors("light")}
}
@media (min-width: 640px) { :root { --gutter: 24px; --work-gutter: 24px; --section-pad: ${pad.section[1]}px; --hero-pad: ${pad.hero[1]}px; } }
@media (min-width: 1024px) { :root { --gutter: 40px; --work-gutter: 32px; --section-pad: ${pad.section[2]}px; --hero-pad: ${pad.hero[2]}px; } }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${colors("dark", "    ")}
  }
}
:root[data-theme="dark"] {
${colors("dark")}
}
`;
}

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

function kitFonts() {
  const manifest = JSON.parse(readFileSync(join(KIT, "fonts.json"), "utf8"));
  return manifest.fonts.map((font) => {
    const source = resolve(KIT, font.source);
    const licence = resolve(KIT, font.licence.source);
    if (!existsSync(source) || sha256(source) !== font.sha256) throw new Error(`font ${font.file} is missing or does not match kit/fonts.json`);
    if (!existsSync(licence) || sha256(licence) !== font.licence.sha256) throw new Error(`licence for ${font.family} is missing or does not match kit/fonts.json`);
    return { ...font, sourcePath: source, licencePath: licence };
  });
}

// What a moment is and where it sits. A lock without a kind is valid to write (the page is not
// built yet) but DS-008 fails every render until the moment is declared and present.
function momentRecord(family, { kind = null, note = null, place = null } = {}) {
  const scale = MOMENT_SCALE_BY_FAMILY[family];
  if (kind !== null) {
    const all = [...MOMENT_KINDS.bold, ...MOMENT_KINDS.small];
    if (!all.includes(kind)) throw new Error(`unknown moment "${kind}"; one of ${all.join(", ")}`);
    if (!MOMENT_KINDS[scale].includes(kind)) throw new Error(`a ${scale === "small" ? "work surface takes a small" : "read-once page takes a bold"} moment: ${MOMENT_KINDS[scale].join(", ")}`);
    if (!String(note ?? "").trim()) throw new Error("a moment needs --moment-note: what it shows, in a few words");
  }
  return { scale, kind, note: kind === null ? null : String(note).trim(), place: kind === null || !String(place ?? "").trim() ? null : String(place).trim(), selector: MOMENT_SELECTOR, above_fold: scale === "bold" };
}

export function lockRecord(style, family, moment = {}, density = "rich") {
  return {
    schema_id: LOCK_SCHEMA,
    style: style.id,
    family,
    density: checkDensity(density),
    fonts: [...new Set([style.fonts.text, style.fonts.display, style.fonts.mono])],
    type: { scale_px: Object.values(style.type.scale_px), display_px: style.type.display_px, moment_px: style.type.moment_px },
    radius_px: [...new Set([0, ...RADIUS_KEYS.map((key) => style.radius_px[key])])],
    space_px: style.space_px,
    colors: { light: style.color.light, dark: style.color.dark },
    elevation: style.shape.elevation,
    files: { tokens: "ui/tokens.css", components: "ui/components.css", script: "ui/ui.js" },
    accent_art: style.accent_art ?? "none",
    moment: momentRecord(family, moment),
  };
}

export function setMoment({ dir, kind, note, place = null }) {
  const lockPath = join(resolve(dir), LOCK_FILE);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.moment = momentRecord(lock.family, { kind, note, place });
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  return lock.moment;
}

export function initLock({ styleId = null, family, dir, scaffold = false, from = null, force = false, brief = null, moment = null, momentNote = null, momentPlace = null, density = null }) {
  if (!FAMILIES[family]) throw new Error(`--family must be one of ${Object.keys(FAMILIES).join(", ")}`);
  const register = checkDensity(density ?? densityForBrief(brief));
  const declared = momentRecord(family, { kind: moment, note: momentNote, place: momentPlace });
  const styles = kitStyles();
  let style;
  if (from) {
    style = JSON.parse(readFileSync(resolve(from), "utf8"));
    if (styles.some((kit) => kit.id === style.id)) throw new Error(`--from style id "${style.id}" reuses a kit style id; give the brand style its own id`);
  } else {
    style = styles.find((kit) => kit.id === (styleId ?? styleForBrief(brief, styles)?.id ?? DEFAULT_STYLE_BY_FAMILY[family]));
    if (!style) throw new Error(`unknown style "${styleId}"; run \`design-lock.mjs list\``);
  }
  const issues = validateStyle(style);
  if (issues.length) throw new Error(`style ${style.id} cannot be locked:\n- ${issues.join("\n- ")}`);
  const project = resolve(dir);
  mkdirSync(join(project, "ui", "fonts"), { recursive: true });
  const lockPath = join(project, LOCK_FILE);
  if (existsSync(lockPath) && !force) {
    const current = JSON.parse(readFileSync(lockPath, "utf8"));
    if (current.style !== style.id) throw new Error(`${LOCK_FILE} already locks "${current.style}"; pass --force only if the user changed the direction`);
  }
  const fonts = kitFonts();
  for (const font of fonts) {
    copyFileSync(font.sourcePath, join(project, "ui", "fonts", font.file));
    copyFileSync(font.licencePath, join(project, "ui", "fonts", font.licence.file));
  }
  writeFileSync(join(project, "ui", "tokens.css"), tokensCss(style, fonts, register));
  copyFileSync(join(KIT, "components.css"), join(project, "ui", "components.css"));
  copyFileSync(join(KIT, "ui.js"), join(project, "ui", "ui.js"));
  writeFileSync(lockPath, `${JSON.stringify({ ...lockRecord(style, family, {}, register), moment: declared }, null, 2)}\n`);
  let scaffolded = null;
  if (scaffold) {
    const page = join(project, "index.html");
    if (existsSync(page) && !force) scaffolded = "kept existing index.html";
    else {
      copyFileSync(join(KIT, "layouts", `${family}.html`), page);
      scaffolded = "index.html";
    }
  }
  return { style, family, project, scaffolded, density: register };
}

function parse(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--scaffold" || arg === "--force") options[arg.slice(2)] = true;
    else if (["--style", "--family", "--dir", "--from", "--brief", "--moment", "--moment-note", "--moment-place", "--density", "--kind", "--note", "--place"].includes(arg)) options[arg.slice(2)] = rest[++i];
    else if (command === "match" && options.text === undefined) options.text = arg;
    else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function main(argv) {
  const options = parse(argv);
  if (options.command === "list") {
    for (const style of kitStyles()) {
      console.log(`${style.id} — ${style.name}\n  ${style.summary}\n  use when: ${style.use_when.join("; ")}\n  avoid when: ${style.avoid_when.join("; ")}\n  picked by: ${style.keywords.join(", ")}\n  signature: ${style.signature.join("; ")}\n  never: ${style.forbid.join("; ")}\n`);
    }
    console.log("Families (layout starters in kit/layouts/):");
    for (const [id, text] of Object.entries(FAMILIES)) console.log(`  ${id} — ${text} (default style: ${DEFAULT_STYLE_BY_FAMILY[id]})\n    moments (${id}): ${MOMENT_KINDS[MOMENT_SCALE_BY_FAMILY[id]].join(", ")}`);
    return 0;
  }
  if (options.command === "init") {
    if (!options.dir || !options.family) throw new Error("init needs --family and --dir (--style or --from only to override the family default)");
    const result = initLock({ styleId: options.style, family: options.family, dir: options.dir, scaffold: options.scaffold, from: options.from, force: options.force, brief: options.brief, density: options.density ?? null, moment: options.moment ?? null, momentNote: options["moment-note"] ?? null, momentPlace: options["moment-place"] ?? null });
    console.log(`Locked "${result.style.id}" (${result.family}, ${result.density}) in ${result.project}`);
    console.log(`Wrote ${LOCK_FILE}, ui/tokens.css, ui/components.css, ui/ui.js and ui/fonts/.${result.scaffolded ? ` Scaffold: ${result.scaffolded}.` : ""}`);
    console.log("Link ui/tokens.css then ui/components.css (and ui/ui.js with defer when you use charts, sortable tables or tabs).");
    console.log("Build with the kit's ui-* classes and var(--c-*), var(--fs-*), var(--sp-*), var(--radius-*) only; the interface probe checks the page against this lock.");
    const declared = JSON.parse(readFileSync(join(result.project, LOCK_FILE), "utf8")).moment;
    console.log(declared.kind
      ? `Signature moment: ${declared.kind} (${declared.note}). Mark that one element with data-ui-moment="${declared.kind}"${declared.above_fold ? " in the first screen" : ""}.`
      : `No signature moment yet: decide the ${declared.scale} moment (${MOMENT_KINDS[declared.scale].join(", ")}) and record it with \`design-lock.mjs moment\`; the probe fails the page until it is declared and present (DS-008).`);
    return 0;
  }
  if (options.command === "moment") {
    if (!options.dir || !options.kind) throw new Error("moment needs --dir, --kind and --note");
    const moment = setMoment({ dir: options.dir, kind: options.kind, note: options.note, place: options.place ?? null });
    console.log(`Recorded ${moment.scale} moment ${moment.kind}: mark it with data-ui-moment="${moment.kind}"${moment.above_fold ? " in the first screen" : ""}.`);
    return 0;
  }
  if (options.command === "match") {
    const hit = styleForBrief(options.text);
    console.log(hit ? `${hit.id} (keyword "${hit.keyword}")` : "no style named; the family default applies");
    const density = densityForBrief(options.text);
    console.log(`density: ${density}${density === "calm" ? " (the request asks for a calm page)" : " (the default; calm only when the request asks)"}`);
    return 0;
  }
  if (options.command === "show") {
    const lock = JSON.parse(readFileSync(join(resolve(options.dir ?? "."), LOCK_FILE), "utf8"));
    console.log(JSON.stringify({ style: lock.style, family: lock.family, density: lock.density ?? null, fonts: lock.fonts, type: lock.type, radius_px: lock.radius_px, moment: lock.moment ?? null }, null, 2));
    return 0;
  }
  throw new Error("usage: design-lock.mjs list | init [--style <id>] [--brief <text>] [--density rich|calm] --family <landing|workspace|settings> --dir <project> [--moment <kind> --moment-note <text> [--moment-place <text>]] [--scaffold] [--from <style.json>] [--force] | moment --dir <project> --kind <kind> --note <text> [--place <text>] | match <text> | show --dir <project>");
}

const startedDirectly = () => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (startedDirectly()) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`design-lock: ${error.message}`);
    process.exitCode = 1;
  }
}
