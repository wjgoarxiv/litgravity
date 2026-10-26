"use strict";

/**
 * grid-resolver.js — where things go on a slide, read from a tonality pack and two dials.
 *
 * A pack never reaches this file as a name: it arrives as values (palette roles, a ramp, the
 * treatments it allows, its density and variance). The density dial picks one of three grids and
 * the spacing tokens; a title treatment fixes where the title sits, what is drawn with it and where
 * the body starts; a layout family decides which treatments a slide may take. Geometry is worked
 * out in points on the 960 x 540 (16:9) or 720 x 540 (4:3) canvas; the renderer converts to inches.
 */

const SG = require("./slide-grid");

const { CANVAS } = SG;

const RAMPS = {
  presented: { source: 12, label: 14, body: 18, lead: 24, title: 32, display: 44, cover: 56, hero: 72 },
  reading: { source: 10, label: 12, body: 14, lead: 18, title: 26, display: 36, cover: 44, hero: 60 },
  // The reading ramp with its three small steps one point down: the readable floor of a page read
  // closely on screen (body 13, table cells and captions 11, sources 9).
  compact: { source: 9, label: 11, body: 13, lead: 18, title: 26, display: 36, cover: 44, hero: 60 },
};
const RAMP_ORDER = ["source", "label", "body", "lead", "title", "display", "cover", "hero"];
const SCALE = [6, 12, 18, 24, 36, 48, 72];

// The content zones of the shared slide grid (slide-grid.js), the same on both canvases.
const ZONE = (() => {
  const z = SG.ZONES.content;
  return { top: z.title.y, body: z.body.y, floor: z.body.y + z.body.h, footer: z.footer.y, footerH: z.footer.h };
})();

// What the density dial sets: ramp, gaps, padding, table rows and the empty band a content slide may
// leave under its last line; never where the zones are. From density 5 a deck reads on the reading ramp
// (body 14 pt); density 10 is the compact step: body 13 pt and the tightest gaps.
const DENSITY_BANDS = [
  { upTo: 2, ramp: "presented", item: 18, group: 36, block: 48, pad: 24, rowMin: 36, maxLines: 6, cap: 0.28, stepUp: true },
  { upTo: 4, ramp: "presented", item: 12, group: 24, block: 36, pad: 24, rowMin: 32, maxLines: 8, cap: 0.24, stepUp: true },
  { upTo: 6, ramp: "reading", item: 6, group: 18, block: 24, pad: 18, rowMin: 24, maxLines: 12, cap: 0.18, stepUp: true },
  { upTo: 8, ramp: "reading", item: 6, group: 12, block: 24, pad: 12, rowMin: 22, maxLines: 16, cap: 0.14, stepUp: true },
  { upTo: 9, ramp: "reading", item: 6, group: 12, block: 24, pad: 12, rowMin: 20, maxLines: 18, cap: 0.12, stepUp: false },
  { upTo: 10, ramp: "compact", item: 6, group: 12, block: 18, pad: 12, rowMin: 18, maxLines: 22, cap: 0.12, stepUp: false, tight: true },
];

const TREATMENTS = ["top-rule", "top-plain-large", "side-rail", "band", "statement", "overlay", "kicker-numeral", "bottom-anchor"];

// Content layout families: the slide role that picks a treatment from the pack, and the
// treatments the family's geometry allows.
const FAMILIES = {
  "text-column": { role: "content", allow: ["top-rule", "band", "kicker-numeral", "side-rail", "top-plain-large"] },
  "text-two-column": { role: "content", allow: ["top-rule", "band", "kicker-numeral", "top-plain-large"] },
  "summary-box-list": { role: "content", allow: ["band", "top-rule", "kicker-numeral"] },
  "sidebar-note": { role: "content", allow: ["top-rule", "kicker-numeral", "band", "side-rail"] },
  agenda: { role: "content", allow: ["top-rule", "kicker-numeral", "band", "top-plain-large", "side-rail"] },
  statement: { role: "statement", allow: ["statement"] },
  quote: { role: "statement", allow: ["statement", "top-rule"] },
  "kpi-row": { role: "data", allow: ["top-rule", "band", "top-plain-large", "side-rail", "bottom-anchor"] },
  "table-insight": { role: "data", allow: ["top-rule", "band", "side-rail", "bottom-anchor"] },
  "ledger-table": { role: "data", allow: ["top-rule", "band", "kicker-numeral"] },
  "dashboard-grid": { role: "data", allow: ["top-rule", "band", "side-rail"] },
  "kpi-over-chart": { role: "data", allow: ["top-rule", "band", "top-plain-large"] },
  "matrix-2x2": { role: "data", allow: ["top-rule", "band", "side-rail"] },
  comparison: { role: "data", allow: ["top-rule", "band", "top-plain-large", "side-rail", "bottom-anchor"] },
  "chart-insight": { role: "data-takeaway", allow: ["top-rule", "band", "side-rail", "bottom-anchor", "top-plain-large"] },
  "full-chart": { role: "data-takeaway", allow: ["bottom-anchor", "top-plain-large", "top-rule"] },
  "big-number": { role: "data-takeaway", allow: ["top-rule", "side-rail", "bottom-anchor", "top-plain-large"] },
  process: { role: "sequence", allow: ["top-rule", "band", "top-plain-large", "side-rail"] },
  timeline: { role: "sequence", allow: ["top-rule", "band", "top-plain-large", "bottom-anchor"] },
  "step-diagram": { role: "sequence", allow: ["top-rule", "top-plain-large", "band"] },
  "image-full": { role: "image", allow: ["overlay"] },
  "image-split": { role: "image", allow: ["top-plain-large", "side-rail", "bottom-anchor", "top-rule"] },
  "photo-grid": { role: "image", allow: ["top-plain-large", "bottom-anchor", "top-rule"] },
  "figure-pair": { role: "image", allow: ["top-rule", "bottom-anchor", "side-rail"] },
  "figure-academic": { role: "image", allow: ["top-rule", "bottom-anchor", "side-rail"] },
  "asymmetric-feature": { role: "image", allow: ["top-plain-large", "bottom-anchor", "top-rule"] },
  method: { role: "definition", allow: ["top-rule", "side-rail", "band"] },
  "references-appendix": { role: "reference", allow: ["top-rule", "band"] },
};

// Cover, section and closing variants. A closing other than the statement is a content slide whose
// title states the ask, so it takes the content role.
const VARIANTS = {
  cover: ["cover-typographic", "cover-split-field", "cover-split-image", "cover-full-image", "cover-band", "cover-numeral", "cover-index", "cover-figures", "cover-rail"],
  section: ["section-field", "section-numeral", "section-rail", "section-image", "section-rule", "section-band"],
  closing: ["closing-ask", "closing-decision-box", "closing-statement", "closing-summary-list", "closing-contact-split"],
};
// The six layouts every existing deck uses, read as families; v1 archetype names that were renamed.
const LEGACY_LAYOUTS = { content: "text-column", main: "text-column", summary: "comparison", cover: "cover", section: "section", closing: "closing-statement", free: "free" };
const RENAMED = { "cover-split": "cover-split-field" };

function clampDial(value, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : fallback;
}

/**
 * The density band's tokens. A bold pack (`ramp: presented`, allowed only with `register: bold`)
 * sets its type on the presented ramp at any density, so its titles and figures fill the same zones
 * at presentation size; every other pack takes the band's ramp.
 */
function densityTokens(density, packRamp) {
  const d = clampDial(density, 5);
  const band = DENSITY_BANDS.find((b) => d <= b.upTo);
  const ramp = packRamp === "presented" ? "presented" : band.ramp;
  return { density: d, ...band, ramp, sizes: RAMPS[ramp] };
}

/** Most distinct title treatments a deck may mix at this variance, never more than the pack allows. */
function varianceMax(variance, treatmentCount) {
  const v = clampDial(variance, 5);
  const max = v <= 3 ? 2 : v === 4 ? 3 : v <= 6 ? 4 : 5;
  return Math.min(max, treatmentCount);
}

/** The shared slide grid's columns on a canvas (the same for every pack and density). */
function makeGrid(canvas) {
  const { W, H } = CANVAS[canvas];
  const g = SG.COLUMNS[canvas];
  const pitch = g.col + g.gutter;
  return {
    canvas, name: "compact", W, H, ...g, pitch,
    /** Columns a…b (1-based, inclusive) as x and width in points. */
    span(a, b) { return { x: g.margin + pitch * (a - 1), w: pitch * (b - a + 1) - g.gutter }; },
    colX(a) { return g.margin + pitch * (a - 1); },
  };
}

/** Next step of the spacing scale, never past `max`. */
function stepGap(value, max) {
  const next = SCALE.find((s) => s > value);
  return next != null && next <= max ? next : value;
}

/** Next ramp role above `role` (body → lead), or the same role at the top of the ramp. */
function stepRole(role) {
  const i = RAMP_ORDER.indexOf(role);
  return i >= 0 && i < RAMP_ORDER.length - 1 ? RAMP_ORDER[i + 1] : role;
}

// ── Text measure ─────────────────────────────────────────────────────────────

/** Advance of a string in ems: Hangul about one em, Latin about half, spaces less. */
function textEms(text) {
  let ems = 0;
  for (const ch of String(text || "")) {
    if (/\s/u.test(ch)) ems += 0.28;
    else if (/[ᄀ-ᇿ㄰-㆏가-힣一-鿿]/u.test(ch)) ems += 0.94;
    else if (/[A-Z0-9%]/u.test(ch)) ems += 0.62;
    else ems += 0.52;
  }
  return ems;
}

/** Lines a paragraph wraps to in a frame `widthPt` wide; a little slack covers word breaks. */
function lineCount(text, widthPt, sizePt) {
  const perLine = Math.max(1, widthPt / sizePt);
  return String(text || "").split("\n").reduce((sum, part) => sum + Math.max(1, Math.ceil((textEms(part) * 1.06) / perLine)), 0);
}

/**
 * Display text broken into `lines` lines of near-equal width at word boundaries, so a two-line
 * statement never ends on one orphaned word. Returns the text unchanged when it has no spaces,
 * already holds a break, or no split keeps every line inside `perLineEms`.
 */
function balanceLines(text, lines, perLineEms) {
  const s = String(text || "");
  if (lines < 2 || s.includes("\n")) return s;
  const words = breakUnits(s);
  if (words.length < lines) return s;
  const width = (i, j) => textEms(words.slice(i, j).join(" ")) * 1.06;
  // best[k][j]: the smallest widest line setting words 0..j-1 on k lines; the last line holds at
  // least `tail` words.
  const solve = (tail) => {
    const best = Array.from({ length: lines + 1 }, () => new Array(words.length + 1).fill(Infinity));
    const cut = Array.from({ length: lines + 1 }, () => new Array(words.length + 1).fill(-1));
    best[0][0] = 0;
    for (let k = 1; k <= lines; k++) {
      for (let j = k; j <= words.length; j++) {
        const last = k === lines ? Math.min(j - tail, j - 1) : j - 1;
        for (let i = k - 1; i <= last; i++) {
          const v = Math.max(best[k - 1][i], width(i, j));
          if (v < best[k][j]) { best[k][j] = v; cut[k][j] = i; }
        }
      }
    }
    if (best[lines][words.length] > perLineEms) return null;
    const out = [];
    for (let k = lines, j = words.length; k > 0; k--) {
      const i = cut[k][j];
      out.unshift(words.slice(i, j).join(" "));
      j = i;
    }
    return out;
  };
  // Widow control: a last line of one word only when no split keeps two there.
  const set = (words.length >= lines + 1 && solve(2)) || solve(1);
  return set ? set.join("\n") : s;
}

// Native Korean number words that take a counter after them ("다섯 분기", "한 곳"), and prefixes
// that belong to the figure after them ("연 6억 원", "약 40%").
const NUMBER_WORD = /(?:^|\s)(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|열한|열두|스무|몇|첫|연|월|주|약|총|최대|최소)$/u;
// A separator stays at the end of the line before it, never at the start of the next.
const SEPARATOR = /^[·・|/–—]$/u;

/** A short parenthetical ("(▲ +3.9%)", up to 16 characters) reads as one unit and never breaks inside. */
const SHORT_PAREN = 16;

function closesShort(open, w) {
  const at = open.lastIndexOf("(");
  return at >= 0 && !open.slice(at).includes(")") && `${open.slice(at)} ${w}`.length <= SHORT_PAREN;
}

/**
 * Words a line may break between; a number stays with the word after it ("30억 원을", "4 분기", "다섯 분기"),
 * and a short parenthetical stays whole.
 */
function breakUnits(s) {
  const words = String(s).split(/ +/u).filter(Boolean);
  const joined = [];
  for (let i = 0; i < words.length; i++) {
    let unit = words[i];
    // Join up to the word that closes the parenthesis, only when it closes within the short length.
    let j = i;
    let probe = unit;
    while (j + 1 < words.length && closesShort(probe, words[j + 1])) {
      probe += ` ${words[++j]}`;
      if (probe.slice(probe.lastIndexOf("(")).includes(")")) { unit = probe; i = j; break; }
    }
    joined.push(unit);
  }
  return joined.reduce((out, w) => {
    if (out.length && SEPARATOR.test(w)) out[out.length - 1] += ` ${w}`;
    else if (out.length && (/[\d억만조천]$/u.test(out[out.length - 1]) || NUMBER_WORD.test(out[out.length - 1]))) out[out.length - 1] += ` ${w}`;
    else out.push(w);
    return out;
  }, []);
}

/**
 * Body text broken at spaces only, filling each line in turn, for a frame that holds `maxLines`.
 * A renderer's own line breaking may split a number from the Hangul after it ("51 / 점이라는",
 * "(10 / 월"), so text that wraps gets its breaks here, where a number keeps its unit and a word
 * stays whole; a one-word last line takes a word from the line above when it fits. The text is
 * returned unchanged when it fits one line, already holds a break, has a word wider than a line,
 * or needs more lines than the frame holds.
 */
function keepLines(text, perLineEms, maxLines, slack = 1.06) {
  const s = String(text || "");
  const width = (t) => textEms(t.replace(/\*\*/gu, "")) * slack;
  if (s.includes("\n") || width(s) <= perLineEms) return s;
  const words = breakUnits(s);
  if (words.some((w) => width(w) > perLineEms)) return s;
  // Lines are lists of break units, so the widow pull below never splits a number from its word.
  const lines = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last != null && width([...last, w].join(" ")) <= perLineEms) last.push(w);
    else lines.push([w]);
  }
  const n = lines.length;
  if (n >= 2 && lines[n - 1].length === 1 && !/ /u.test(lines[n - 1][0])) {
    const prev = lines[n - 2];
    const moved = [prev[prev.length - 1], ...lines[n - 1]];
    if (prev.length >= 2 && width(moved.join(" ")) <= perLineEms) { lines[n - 2] = prev.slice(0, -1); lines[n - 1] = moved; }
  }
  // The estimate runs wide of the faces, so a set that needs a line more than the frame holds is
  // tried once more at the bare estimate before the renderer is left to break the text.
  if (n > maxLines) return slack > 1 ? keepLines(s, perLineEms, maxLines, 1) : s;
  return lines.map((l) => l.join(" ")).join("\n");
}

function isKorean(text) {
  return /[가-힣]/u.test(String(text || ""));
}

/** Leading for body text: Hangul needs more line space than Latin at the same size. */
function leading(text) {
  return isKorean(text) ? 1.4 : 1.25;
}

/**
 * How much wider than the estimate a face sets: heavier weights of the bundled faces run wider,
 * so a frame measured at the regular width would lose its last line.
 */
function faceWidth(face, text) {
  // A monospaced Latin face sets every Latin character and space at 0.6 em, and its Hangul in the
  // East Asian face; the factor is that advance over the estimate, or the Latin worst case unread.
  if (face && face.ea) {
    const est = textEms(text);
    if (text == null || !est) return 1.26;
    let mono = 0;
    for (const ch of String(text)) mono += /[ᄀ-ᇿ㄰-㆏가-힣一-鿿]/u.test(ch) ? 0.94 * (face.bold ? 1.08 : 1.0) : 0.6;
    return Math.max(1, mono / est);
  }
  const font = (face && face.font) || "";
  return /9 Black/u.test(font) ? 1.14 : /7 Bold/u.test(font) ? 1.08 : /5 Medium/u.test(font) ? 1.05 : face && face.bold ? 1.04 : 1.0;
}

function textHeight(text, widthPt, sizePt, lineSpacing) {
  return lineCount(text, widthPt, sizePt) * sizePt * (lineSpacing || leading(text));
}

// ── Families and treatments ─────────────────────────────────────────────────

function familyIds() {
  return [...Object.keys(FAMILIES), ...VARIANTS.cover, ...VARIANTS.section, ...VARIANTS.closing];
}

/**
 * The family a slide's `layout:` names, its kind and the role that picks its title treatment.
 * Legacy layout names keep working; an unknown name is an error that lists what exists.
 */
function resolveFamily(layout, slideNumber) {
  const name = RENAMED[layout] || layout;
  const legacy = LEGACY_LAYOUTS[name];
  if (legacy === "cover") return { family: null, kind: "cover", legacyLayout: name };
  if (legacy === "section") return { family: null, kind: "section", legacyLayout: name };
  if (legacy === "free") return { family: "free", kind: "free", legacyLayout: name };
  const family = legacy || name;
  if (FAMILIES[family]) return { family, kind: "content", role: FAMILIES[family].role, ...(legacy ? { legacyLayout: name } : {}) };
  if (VARIANTS.cover.includes(family)) return { family, kind: "cover" };
  if (VARIANTS.section.includes(family)) return { family, kind: "section" };
  if (family === "closing-statement") return { family, kind: "content", role: "statement", ...(legacy ? { legacyLayout: name } : {}) };
  if (VARIANTS.closing.includes(family)) return { family, kind: "content", role: "content" };
  throw new Error(
    `Slide ${slideNumber}: layout "${layout}" is neither a layout family nor a legacy layout. ` +
    `Families: ${familyIds().join(", ")}. Legacy layouts: ${Object.keys(LEGACY_LAYOUTS).join(", ")}`
  );
}

/**
 * Treatments a family may take. A closing that is a content slide states the ask as a top title
 * (S8.1 #20), so it takes only the top treatments.
 */
function familyAllows(family) {
  if (FAMILIES[family]) return FAMILIES[family].allow;
  if (family === "closing-statement") return ["statement"];
  if (VARIANTS.closing.includes(family)) return ["top-rule", "band", "top-plain-large"];
  return FAMILIES["text-column"].allow;
}

/**
 * Choose the slide's title treatment: the per-slide `title:` key when given (it must be a known
 * treatment, one of the pack's, allowed by the family and drawable on this slide), else the pack's
 * default for the slide role, else the next pack treatment the family allows. The variance dial
 * stops a deck from adding treatments past its maximum.
 */
function pickTreatment({ pack, family, role, override, slideNumber, used, max, applicable, onNote }) {
  const allow = familyAllows(family);
  if (override) {
    if (!TREATMENTS.includes(override)) {
      throw new Error(`Slide ${slideNumber}: unknown title treatment "${override}". Treatments: ${TREATMENTS.join(", ")}`);
    }
    if (!pack.treatments.includes(override)) {
      throw new Error(`Slide ${slideNumber}: title "${override}" is not one of the ${pack.id} treatments (${pack.treatments.join(", ")})`);
    }
    if (!allow.includes(override)) {
      throw new Error(`Slide ${slideNumber}: the ${family} family does not take "${override}"; it allows ${allow.join(", ")}`);
    }
    const why = applicable(override);
    if (why !== true) throw new Error(`Slide ${slideNumber}: title "${override}" cannot be drawn here: ${why}`);
    return override;
  }
  const preferred = (pack.structure || {})[family] || pack["role-defaults"][role];
  const order = [preferred, ...pack.treatments.filter((t) => t !== preferred)].filter(Boolean);
  let candidates = order.filter((t) => pack.treatments.includes(t) && allow.includes(t) && applicable(t) === true);
  if (!candidates.length) {
    // A title longer than every budget still gets the first treatment it would otherwise take.
    candidates = order.filter((t) => pack.treatments.includes(t) && allow.includes(t) && applicable(t) === BUDGET);
    if (candidates.length && onNote) onNote(`slide ${slideNumber}: the title is longer than the ${candidates[0]} budget; shorten it`);
  }
  if (used.size >= max) {
    const reuse = candidates.filter((t) => used.has(t));
    if (reuse.length) candidates = reuse;
  }
  if (!candidates.length) {
    throw new Error(
      `Slide ${slideNumber}: no ${pack.id} treatment (${pack.treatments.join(", ")}) fits the ${family} family ` +
      `(${allow.join(", ")}) on this slide; choose another layout family or tonality`
    );
  }
  return candidates[0];
}

// ── Treatment geometry ──────────────────────────────────────────────────────

/**
 * Title frame, companion decoration and body zone of one treatment, in points.
 *
 * Every treatment sets its title in the shared title zone (slide-grid.js) and leaves the body zone
 * as it is: a treatment chooses the title's face, size and colour and what is drawn with it, never
 * where the title or the body stands. A statement sets its sentence in the display title zone.
 *
 * ctx: { grid, sizes, title, hero, decoration (Set), numeral, rail ("surface" or "field") }
 * Returns { title, decor[], numeral?, body: {a, b, y, bottom}, support?, lines } where body
 * columns a…b are on the deck grid. `fits` is false when the title does not fit its zone.
 */
function treatmentGeometry(id, ctx) {
  const { grid, sizes } = ctx;
  // Lines of the title at a size, in the face that sets it (ctx.wide: face role → width factor).
  const fit = (t, w, size, face = "title") => {
    const k = ctx.wide && ctx.wide[face];
    return lineCount(t, w / ((typeof k === "function" ? k(t) : k) || 1), size);
  };
  const text = ctx.title || "";
  const decor = [];
  const full = grid.span(1, 12);
  const out = { id, decor, fits: true };
  const T = SG.zone(grid.canvas, "content", "title");
  const B = SG.zone(grid.canvas, "content", "body");
  const body = { a: B.a, b: B.b, y: B.y, bottom: B.y + B.h };
  // The title frame is the zone itself. Two lines at the title step take 1.15 leading, or 1.1 when
  // that is what keeps them inside the zone (the presented title step); display type sets solid (1.0)
  // when that is what keeps two lines of it in the zone.
  const frame = (size, face, colour) => {
    const lines = fit(text, T.w, size, face);
    const lineSpacing = [1.15, 1.1, ...(face === "display" ? [1.0] : [])].find((k) => lines * size * k <= T.h + 0.5) || 1.1;
    return { x: T.x, y: T.y, w: T.w, h: T.h, size, face, colour, lines, lineSpacing, fits: lines * size * lineSpacing <= T.h + 0.5 };
  };
  // Where the title's last line ends inside the frame (a rule under it follows the text, not the zone).
  const textBottom = (f) => T.y + Math.ceil(Math.max(1, f.lines) * f.size * f.lineSpacing) + 2;

  if (id === "top-rule" || id === "band" || id === "bottom-anchor" || id === "side-rail" || id === "kicker-numeral") {
    const f = frame(sizes.title, "title", id === "band" ? "on-field" : "ink");
    out.fits = f.fits && f.lines <= 2 && (id !== "kicker-numeral" || ctx.numeral != null);
    out.title = f;
    out.body = body;
    if (id === "top-rule") {
      const ruleY = textBottom(f) + 4;
      if (ctx.decoration.has("accent-rule")) decor.push({ x: T.x, y: ruleY, w: grid.col, h: 4, role: "accent", kind: "rule" });
      else decor.push({ x: full.x, y: ruleY, w: full.w, h: 0.75, role: "line", kind: "rule" });
    } else if (id === "band") {
      // The field runs from the page's top edge to the foot of the title zone.
      decor.push({ x: 0, y: 0, w: grid.W, h: T.y + T.h, role: "field", kind: "band" });
    } else if (id === "bottom-anchor") {
      // The title zone closes on a heavy rule in the ink across the page's columns.
      decor.push({ x: full.x, y: T.y + T.h + 2, w: full.w, h: 3, role: "ink", kind: "rule" });
    } else if (id === "side-rail") {
      // A bar in the left margin: the full page height in the rail colour where the pack fills its
      // rail, else as tall as the title zone in the accent.
      const filled = ctx.decoration.has("rail-fill");
      const w = Math.round(grid.margin / 2);
      decor.push(filled ? { x: 0, y: 0, w, h: grid.H, role: ctx.rail === "field" ? "field" : "accent", kind: "rail" }
        : { x: 0, y: T.y, w, h: T.h, role: "accent", kind: "rail" });
    } else {
      const A = SG.zone(grid.canvas, "content", "aside");
      out.numeral = { x: A.x, y: A.y, w: A.w, h: A.h, size: sizes.cover, text: String(ctx.numeral || ""), align: "right" };
    }
    return out;
  }

  if (id === "top-plain-large") {
    const f = frame(sizes.display, "display", "ink");
    out.fits = f.fits && f.lines <= 2;
    out.title = f;
    out.body = body;
    return out;
  }

  if (id === "statement") {
    // The sentence is centred in the display title zone, at the hero step in a hero pack while it
    // keeps to three lines there, else at the display step.
    const D = SG.zone(grid.canvas, "display", "title");
    const tall = (size, lines) => lines * size * 1.15 <= D.h + 0.5;
    const heroLines = fit(text, D.w, sizes.hero, "display");
    const useHero = ctx.hero && heroLines <= 3 && tall(sizes.hero, heroLines);
    const size = useHero ? sizes.hero : sizes.display;
    const lines = useHero ? heroLines : fit(text, D.w, sizes.display, "display");
    out.fits = lines <= 3 && tall(size, lines);
    out.title = { x: D.x, y: D.y, w: D.w, h: D.h, size, face: "display", colour: "ink", lines, lineSpacing: 1.15, valign: "middle",
      textH: Math.ceil(lines * size * 1.15) };
    const P = SG.zone(grid.canvas, "display", "support");
    out.support = { x: P.x, y: P.y, w: P.w, bottom: P.y + P.h };
    out.body = null;
    return out;
  }

  if (id === "overlay") {
    const s = grid.span(1, 7);
    const lines = fit(text, s.w, sizes.title);
    out.fits = lines <= 2;
    // The panel is as tall as the title and its caption line (ending 24 pt under the caption at 432), so its
    // lower part never stands empty; the sample tag in the footer zone sits on the picture, clear of its edge.
    decor.push({ x: 0, y: 324, w: s.x + s.w + 24, h: 146, role: "field", kind: "panel", alpha: 12 });
    out.title = { x: s.x, y: 348, w: s.w, h: 72, size: sizes.title, face: "title", colour: "on-field", lines };
    out.image = { x: 0, y: 0, w: grid.W, h: grid.H };
    out.body = null;
    return out;
  }
  throw new Error(`unknown title treatment "${id}"`);
}

const BUDGET = "the title does not fit its budget";

/** Can this treatment be drawn on a slide with these facts? true, or the reason it cannot. */
function treatmentApplies(id, facts, ctx) {
  if (id === "kicker-numeral" && ctx.numeral == null) return "no real number to set beside the title";
  const g = treatmentGeometry(id, ctx);
  if (!g.fits) return BUDGET;
  if (id === "overlay" && !facts.image) return "it needs a full-bleed image";
  if (id === "statement" && (facts.visual || facts.textBlocks > 1)) return "a statement carries one sentence and at most one support line";
  if (id === "bottom-anchor" && !facts.visual && facts.textBlocks > 1) return "the title closes a page whose upper part is a visual";
  return true;
}

module.exports = {
  CANVAS, RAMPS, SCALE, ZONE, TREATMENTS, FAMILIES, VARIANTS, LEGACY_LAYOUTS,
  densityTokens, varianceMax, makeGrid, stepGap, stepRole, clampDial,
  textEms, lineCount, leading, textHeight, isKorean, faceWidth, balanceLines, keepLines,
  familyIds, resolveFamily, familyAllows, pickTreatment, treatmentGeometry, treatmentApplies,
};
