"use strict";

/**
 * render-pack.js — one renderer for every tonality pack.
 *
 * It reads palette roles, faces, ramp sizes, density tokens, the treatment geometry the resolver
 * worked out and the slide's layout family; nothing here branches on which pack it is. A family
 * is a plan: it splits the treatment's body zone into regions on the 12-column grid and places the
 * slide's content in them. A plan runs again under the pack's fill policies (larger type, wider
 * gaps, the visual taking the room) until the body is used, and the treatment is chosen among the
 * ones the role and family allow by how well the content fills it. Geometry is in points until
 * the moment a shape is added.
 */

const path = require("path");
const G = require("./grid-resolver");
const { runtimeRequire } = require("./runtime-require");
const { looksLikeKpi } = require("./layout-resolver");

// Helpers shared with the legacy renderer (hex, cleanMd, tables, charts, images, placements).
let A = null;
function shared() {
  if (!A) A = require("./render-adapter-pptx").shared;
  return A;
}

const IN = (pt) => pt / 72;
const plainText = (s) => shared().cleanMd(String(s || "").replace(/\*\*/g, ""));

// ── Style ───────────────────────────────────────────────────────────────────

function packStyle(pack) {
  const P = pack.palette;
  const voice = pack["type-voice"] || {};
  return {
    pack, P, sizes: pack.tok.sizes, tok: pack.tok, grid: pack.grid, faces: pack.faces,
    deco: new Set(pack.decoration || []),
    // Heavier faces set wider: the advance estimate grows with the weight so frames hold their lines.
    wide(role = "body") { return G.faceWidth(pack.faces[role]); },
    ems(text, role) { return G.textEms(text) * this.wide(role); },
    lines(text, w, size, role) { return G.lineCount(text, w / this.wide(role), size); },
    colour: (role) => shared().hex(P[role] || P.ink),
    // Tracking is a percentage of the size; Hangul body text is never tracked.
    tracking(face, size) {
      const pct = face === "display" || face === "numeral" ? voice["display-tracking"] : face === "title" ? voice["title-tracking"] : 0;
      return pct ? +((size * pct) / 100).toFixed(2) : 0;
    },
  };
}

/** `a` moved toward `b` by `t` (0-1), as #RRGGBB. */
function mix(a, b, t) {
  const c = (h, i) => parseInt(String(h).replace("#", "").slice(i, i + 2), 16);
  const out = [0, 2, 4].map((i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * t).toString(16).padStart(2, "0"));
  return `#${out.join("").toUpperCase()}`;
}

// ── Drawing primitives ──────────────────────────────────────────────────────

/** Title runs: **marked** words in the accent, the rest in the title colour. */
function titleRuns(text, S, base) {
  return String(text || "").split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => {
    const marked = part.startsWith("**") && part.endsWith("**");
    return { text: marked ? part.slice(2, -2) : part, options: { ...base, ...(marked ? { color: S.colour("accent") } : {}) } };
  });
}

/**
 * Display text broken at word boundaries into lines of near-equal width, at the line count the
 * frame was measured for, or one more when long words keep every split at that count too wide and
 * the frame holds that line (the renderer would wrap to it anyway); text with marked words is left
 * to the renderer's own wrapping.
 */
function balanced(S, text, w, size, role, room = Infinity) {
  const s = String(text || "");
  if (/\*\*/u.test(s)) return s;
  const lines = S.lines(s, w, size, role);
  if (lines < 2) return s;
  const per = w / S.wide(role) / size;
  const set = G.balanceLines(s, lines, per);
  // A set ending on one word gets a line more when the frame holds it and that ends on two.
  const widow = (t) => t.includes("\n") && !/ /u.test(t.slice(t.lastIndexOf("\n") + 1));
  if (set !== s && !widow(set)) return set;
  const more = lines + 1 <= room ? G.balanceLines(s, lines + 1, per) : s;
  return more !== s && (set === s || !widow(more)) ? more : set;
}

/** A run split around the linked words it holds, each linked piece carrying its address. */
function linkRuns(run, links) {
  for (const [label, url] of links) {
    const at = run.text.indexOf(label);
    if (at < 0) continue;
    const { breakLine, ...rest } = run.options;
    const parts = [
      at > 0 ? { text: run.text.slice(0, at), options: rest } : null,
      { text: label, options: { ...rest, hyperlink: { url } } },
      ...linkRuns({ text: run.text.slice(at + label.length), options: run.options }, links),
    ].filter((p) => p && p.text !== "");
    if (breakLine && parts.length) parts[parts.length - 1] = { ...parts[parts.length - 1], options: { ...parts[parts.length - 1].options, breakLine: true } };
    return parts;
  }
  return [run];
}

/** A flush text frame (zero insets) on the grid. */
function packText(slide, S, text, box, o = {}) {
  const faceRole = o.face || "body";
  const face = S.faces[faceRole];
  const size = o.size || S.sizes.body;
  // A Markdown link is set as its words, linked; the brackets and the address never reach the page.
  const links = [];
  text = String(text == null ? "" : text).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gu, (_, label, url) => { links.push([label, url]); return label; });
  if (o.balance) text = balanced(S, text, box.w, size, faceRole, Math.floor(box.h / (size * (o.lineSpacing || 1.15)) + 0.01));
  else if (!o.title && faceRole !== "numeral") {
    text = G.keepLines(text, box.w / S.wide(faceRole) / size, Math.floor(box.h / (size * (o.lineSpacing || G.leading(plainText(text)))) + 0.01));
  }
  const tracking = o.tracking != null ? o.tracking : S.tracking(faceRole, size);
  const base = { fontFace: face.font, fontSize: size, color: o.colour || S.colour("ink"), bold: Boolean(face.bold || o.bold),
    ...(tracking ? { charSpacing: tracking } : {}) };
  const runs = (o.title ? titleRuns(text, S, base)
    : shared().mdRuns(text, base).map((r) => ({ ...r, options: { ...r.options, bold: base.bold || r.options.bold } })))
    // A break inside a run ends the line there and nowhere else (the run's last piece flows on).
    .flatMap((r) => r.text.split("\n").map((t, i, all) => ({ text: t, options: { ...r.options, ...(i < all.length - 1 ? { breakLine: true } : {}) } })))
    .flatMap((r) => linkRuns(r, links));
  // A numeral frame also holds the comma and the descenders that hang below a 1.15 line.
  const h = faceRole === "numeral" ? Math.max(box.h, size * 1.32) : box.h;
  slide.addText(runs, {
    x: IN(box.x), y: IN(box.y), w: IN(box.w), h: IN(Math.max(h, 1)),
    ...base,
    align: o.align || "left", valign: o.valign || "top",
    margin: [0, 0, 0, 0],
    // Exact leading in points, so a frame is as tall as the measure says on every renderer.
    lineSpacing: +(size * (o.lineSpacing || G.leading(plainText(text)))).toFixed(1),
    ...(o.name ? { objectName: o.name } : {}),
  });
}

function packRect(slide, S, box, o = {}) {
  const radius = o.radius || 0;
  slide.addShape(radius ? "roundRect" : "rect", {
    x: IN(box.x), y: IN(box.y), w: IN(box.w), h: IN(box.h),
    ...(radius ? { rectRadius: IN(radius) } : {}),
    fill: o.fill ? { color: S.colour(o.fill), transparency: o.alpha || 0 } : { type: "none" },
    line: o.line ? { color: S.colour(o.line), width: o.lineWidth || 0.75 } : { type: "none" },
    ...(o.name ? { objectName: o.name } : {}),
  });
}

/** A surface (card, box, panel) in the pack's edge treatment and radius. */
function surfaceRect(slide, S, box, fill = "surface") {
  const edge = S.pack.edge;
  packRect(slide, S, box, {
    fill: edge === "border" ? null : fill,
    line: edge === "fill" ? null : "line",
    radius: S.pack.radius,
  });
}

// ── Content atoms ───────────────────────────────────────────────────────────

/** Body paragraphs of a list, in reading order. */
function packParas(items) {
  const paras = [];
  let counter = 0;
  const children = (list) => {
    counter = 0;
    for (const c of list || []) paras.push({ kind: "child", text: `(${++counter}) ${c.text || ""}` });
  };
  for (const it of items || []) {
    if (it.type === "section") { paras.push({ kind: "section", text: it.heading || "" }); children(it.children); }
    else if (it.type === "bullet") { paras.push({ kind: "bullet", text: it.text || "" }); children(it.children); }
    else if (it.type === "numbered") paras.push({ kind: "child", text: `(${++counter}) ${it.text || ""}` });
    else if (it.type === "text" && it.text) paras.push({ kind: "text", text: it.text });
  }
  return paras;
}

/** Paragraphs of one text item (body, summary group or callout). */
function itemParas(item) {
  const c = item.content || {};
  if (item.type === "main-box") return [{ kind: "text", text: String(c) }];
  if (item.type === "summary-group") return [...(c.heading ? [{ kind: "section", text: c.heading }] : []), ...packParas(c.items)];
  return packParas(c.items);
}

/** Top-level entries of a list with their sub-points: a bold head, the rest of the line, children. */
function entries(paras) {
  const out = [];
  for (const p of paras) {
    if (p.kind === "child" && out.length) { out[out.length - 1].children.push(p.text); continue; }
    const m = String(p.text).match(/^\*\*(.+?)\*\*\s*(.*)$/u);
    out.push({ kind: p.kind, head: m ? m[1].trim() : p.kind === "section" ? p.text : "", rest: m ? m[2].trim() : p.kind === "section" ? "" : p.text, children: [] });
  }
  return out;
}

/** A leading ordinal in a step head ("1. 수거" → 1, "수거"). */
function ordinal(head, index) {
  const m = String(head || "").match(/^(\d{1,2})[.)]\s*(.*)$/u);
  return m ? { n: m[1], head: m[2] } : { n: String(index + 1), head };
}

const isText = (i) => ["body", "summary-group", "main-box"].includes(i.type);
const isVisual = (i) => ["kpi-table", "image", "image-grid"].includes(i.type);

function sortItems(items) {
  return {
    texts: items.filter(isText),
    visuals: items.filter(isVisual),
    columns: items.find((i) => i.type === "columns") || null,
    captions: items.filter((i) => i.type === "caption"),
  };
}

// ── Measure ─────────────────────────────────────────────────────────────────

/** A ramp size under the fill state: one step up when stepped, a lead set at body size when compact. */
function bodySize(S, state, role = "body") {
  if (state.compact && role === "lead") return S.sizes.body;
  return state.stepped ? S.sizes[G.stepRole(role)] : S.sizes[role];
}

/**
 * A point that opens with a bold run-in label reads "label: rest": the label keeps its own separator when it
 * ends in one, else it takes a colon (spec-v2 Amendments 8). A bold line with nothing after it is a heading.
 */
function runIn(text) {
  const m = /^\*\*(.+?)\*\*\s+(\S[\s\S]*)$/u.exec(String(text == null ? "" : text));
  if (!m || /[:：.)\]?!–—-]$/u.test(m[1].trim())) return text;
  return `**${m[1].trim()}:** ${m[2]}`;
}

/** A text block of paragraphs at width w. */
function measureText(paras, w, S, state, o = {}) {
  const size = o.size || bodySize(S, state);
  const indent = Math.round(size * 1.1);
  const lines = paras.map((p, i) => {
    const inset = p.kind === "bullet" || p.kind === "child" ? indent : 0;
    const h = G.textHeight(plainText(runIn(p.text)), w - inset, size);
    const gap = i === 0 ? 0 : p.kind === "section" ? state.groupGap : state.itemGap;
    return { ...p, inset, h, gap };
  });
  return { kind: "text", paras: lines, w, size, h: lines.reduce((sum, l) => sum + l.gap + l.h, 0), muted: o.muted };
}

function captionText(caption) {
  // A source caption that already carries its own number ("표 1.") is renumbered, not doubled.
  const text = plainText(caption.caption).replace(/^(?:표|도|Figure|Table)\s*\d+\.\s*/u, "");
  return text ? `${caption.prefix} ${caption.number}. ${text}` : `${caption.prefix} ${caption.number}.`;
}

function captionHeight(caption, w, S) {
  if (!caption) return 0;
  return 6 + G.textHeight(captionText(caption), w, S.sizes.label, 1.3);
}

function measureTable(item, w, S, state) {
  const c = item.content;
  const headers = c.headers || [];
  const rows = c.rows || [];
  const header = S.sizes.label;
  const data = state.stepped ? S.sizes.body : S.sizes.label;
  const widths = headers.length ? shared().proportionalWidths(headers, rows, IN(w)).map((v) => v * 72) : [w];
  const cell = 6;
  const minRow = S.tok.rowMin * (state.anchor ? 1.25 : 1);
  // Rows are measured at the face's natural line (about 1.45 of the size with its gap), which is
  // what office renderers lay a cell out at; a smaller estimate lets rows grow past the frame.
  const rowH = (cells, size) => Math.max(minRow, ...cells.map((t, i) => G.textHeight(plainText(t), (widths[i] || w) - cell * 2, size, 1.45) + cell * 2));
  const heights = [rowH(headers, header), ...rows.map((r) => rowH(r, data))];
  const tableH = heights.reduce((a, b) => a + b, 0);
  return { kind: "table", heights, widths, header, data, tableH, h: tableH + captionHeight(item.caption, w, S) };
}

function measureKpi(item, w, S, state) {
  const cards = shared().kpiCards(item.content).slice(0, 6);
  const n = cards.length;
  const cardW = (w - (n - 1) * S.grid.gutter) / n;
  // The value stays on one line: the step-up size when it fits, else the largest that does.
  const longest = Math.max(...cards.map((k) => S.ems(plainText(k.value), "numeral")));
  const pad = S.tok.pad;
  const fitting = (size) => longest * size * 1.04 <= cardW - pad * 2;
  // A figure sits at most two steps above the body (title size), never at display or hero scale.
  const value = [S.sizes.title, S.sizes.lead, S.sizes.body].find((v) => fitting(v)) || S.sizes.body;
  const labelH = Math.max(...cards.map((k) => G.textHeight(plainText(k.label), cardW - pad * 2, S.sizes.label, 1.3)));
  const noteSize = S.sizes.label;
  const noteH = Math.max(0, ...cards.map((k) => (k.note ? G.textHeight(plainText(k.note), cardW - pad * 2, noteSize, 1.3) : 0)));
  const h = pad * 2 + value * 1.15 + 6 + labelH + (noteH ? 6 + noteH : 0);
  return { kind: "kpi", cards, n, cardW, value, pad, labelH, noteSize, noteH, h: h + captionHeight(item.caption, w, S), cardH: h };
}

/**
 * Measure one item at width w. Charts and images are flexible: they take the height the plan
 * gives them (the rest of their region when they anchor it).
 */
function measureItem(item, w, S, state) {
  const c = item.content || {};
  if (isText(item)) {
    if (item.type === "main-box") {
      const pad = S.tok.pad;
      const m = measureText([{ kind: "text", text: String(c) }], w - pad * 2, S, state);
      return { kind: "callout", pad, size: m.size, h: pad * 2 + m.h };
    }
    return measureText(itemParas(item), w, S, state);
  }
  if (item.type === "kpi-table" && c.chart) return { kind: "chart", flex: true, cap: captionHeight(item.caption, w, S), min: 150 };
  if (item.type === "kpi-table" && !item.values && looksLikeKpi(c, { basis: true })) {
    const cards = shared().kpiCards(c).length;
    if (cards && (w - (cards - 1) * S.grid.gutter) / cards >= S.grid.span(1, 2).w) return measureKpi(item, w, S, state);
  }
  if (item.type === "kpi-table") return measureTable(item, w, S, state);
  if (item.type === "image" || item.type === "image-grid") return { kind: "image", flex: true, cap: captionHeight(item.caption, w, S), min: 150 };
  if (item.type === "caption") return { kind: "caption", h: G.textHeight(captionText(c), w, S.sizes.label, 1.3) };
  return { kind: "none", h: 0 };
}

// ── Regions ─────────────────────────────────────────────────────────────────

/** Columns a…b of the deck grid as a region from y to bottom. */
function region(S, a, b, y, bottom) {
  const s = S.grid.span(a, b);
  return { a, b, x: s.x, w: s.w, y, bottom };
}

/** Split a region's columns: the first `share` of them, and the rest. */
function splitRegion(S, R, share) {
  const n = R.b - R.a + 1;
  const k = Math.max(1, Math.min(n - 1, Math.round(n * share)));
  return [region(S, R.a, R.a + k - 1, R.y, R.bottom), region(S, R.a + k, R.b, R.y, R.bottom)];
}

/** Equal parts of a region's columns (for 5 parts on 12 columns, equal slots off the column lines). */
function equalParts(S, R, n) {
  const cols = R.b - R.a + 1;
  if (cols % n === 0) {
    const k = cols / n;
    return Array.from({ length: n }, (_, i) => region(S, R.a + i * k, R.a + (i + 1) * k - 1, R.y, R.bottom));
  }
  const gap = n >= 5 ? S.grid.gutter * 1.5 : S.grid.gutter;
  const w = (R.w - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ a: R.a, b: R.b, x: R.x + i * (w + gap), w, y: R.y, bottom: R.bottom }));
}

/**
 * Stack items down a region. Flexible visuals take an even share of the room the fixed items
 * leave, so a chart or image anchors the region's bottom. Returns placements with the region
 * bottom they must stay above.
 */
function stack(items, R, S, state) {
  const placed = [];
  let y = R.y;
  items.forEach((item, i) => {
    if (item.type === "columns") {
      const weights = item.tracks.map((t) => parseFloat(String(t)) || 1);
      const total = weights.reduce((a, b) => a + b, 0);
      let at = R.a;
      const parts = weights.map((v, ci) => {
        const n = ci === weights.length - 1 ? R.b - at + 1 : Math.max(1, Math.round(((R.b - R.a + 1) * v) / total));
        const part = region(S, at, at + n - 1, y, R.bottom);
        at += n;
        return part;
      });
      const cols = parts.map((part, ci) => stack(item.columns[ci] || [], part, S, state));
      const bottom = Math.max(y, ...cols.map((c) => c.bottom));
      placed.push({ kind: "group", parts: cols.flatMap((c) => c.placed), y, h: bottom - y, x: R.x, w: R.w, limit: R.bottom });
      y = bottom + state.blockGap;
      return;
    }
    const m = measureItem(item, R.w, S, state);
    if (m.kind === "none") return;
    placed.push({ item, ...m, x: R.x, y, w: R.w, limit: R.bottom });
    y += (m.h || 0) + state.blockGap;
  });
  const flex = placed.filter((p) => p.flex);
  if (flex.length) {
    const fixed = placed.filter((p) => !p.flex).reduce((sum, p) => sum + p.h, 0);
    const gaps = state.blockGap * Math.max(0, placed.length - 1);
    const share = Math.max(...flex.map((p) => p.min), (R.bottom - R.y - fixed - gaps) / flex.length);
    let cursor = R.y;
    for (const p of placed) {
      if (p.flex) p.h = share;
      if (p.kind === "group") shiftGroup(p, cursor - p.y);
      p.y = cursor;
      cursor += p.h + state.blockGap;
    }
    y = cursor;
  }
  const bottom = placed.length ? Math.max(...placed.map((p) => p.y + p.h)) : R.y;
  return { placed, bottom };
}

function shiftGroup(p, dy) {
  if (!dy) return;
  for (const q of p.parts) {
    q.y += dy;
    if (q.kind === "group") shiftGroup(q, dy);
  }
}

/**
 * Pitch for n rows that share a region: the last row ends on the region floor, never closer than
 * the tallest row plus a gap and never wider than `max`.
 */
function rowPitch(n, rowH, R, gap, max) {
  if (n <= 1) return rowH;
  return Math.max(rowH + gap, Math.min(max, (R.bottom - R.y - rowH) / (n - 1)));
}

/** A text block placed in a region. */
function textAt(paras, R, S, state, o = {}) {
  const m = measureText(paras, R.w, S, state, o);
  return { ...m, x: R.x, y: R.y, limit: R.bottom };
}

// ── Layout families ─────────────────────────────────────────────────────────
//
// Each plan gets ctx = { spec, S, state, Z, cls, items } where Z is the treatment's body zone and
// cls the treatment class (top, side, bottom). It returns placements; decoration placements carry
// `decor: true`.

/** A visual with its takeaway: beside it (share of the columns), or under it on a narrow body. */
function visualWithText(ctx, visuals, texts, share, o = {}) {
  const { S, state, Z } = ctx;
  const out = [];
  // A visual alone (its takeaways in the rail, or none): a table opens its rows; on the compact step a
  // chart carries its values under it.
  if (!texts.length) return ((S.tok.tight && !ctx.railValues && valuesUnder(visuals, Z, S, state)) || openRows(stack(visuals, Z, S, state).placed, Z, S));
  if (!visuals.length) return stack(texts, Z, S, state).placed;
  // Takeaways too short for their column give the visual columns: a narrower column wraps them onto more
  // lines and a wider chart or picture grows, down to a three-column takeaway (spec-v2 Amendments 8).
  if (!o.fixed && Z.b - Z.a + 1 >= 6 && visuals.some((v) => v.type === "image" || (v.content || {}).chart)) {
    const n = Z.b - Z.a + 1;
    const base = visualWithText(ctx, visuals, texts, share, { ...o, fixed: true });
    let pick = base;
    // A picture drawn short of its column (a wide one in a narrow column) takes columns while either side
    // leaves more than a fifth of the body empty; a chart only while its takeaways leave over RAIL_EMPTY.
    const target = visuals.some((v) => v.type === "image") ? 0.2 : RAIL_EMPTY;
    for (let step = 1; shortColumn(pick, Z.bottom, S).share > target; step++) {
      const k = o.textFirst ? share - step / n : share + step / n;
      const textCols = o.textFirst ? Math.round(n * k) : n - Math.round(n * k);
      if (textCols < 3) break;
      const next = visualWithText(ctx, visuals, texts, k, { ...o, fixed: true });
      // A narrower column never costs the takeaways their size (a lead-size column dropping to body size read as shrunk).
      const size = (plan) => Math.max(0, ...plan.filter((q) => q.kind === "text" && !q.strip && !q.muted).map((q) => q.size || 0));
      if (!overflows(next) && size(next) >= size(base) && shortColumn(next, Z.bottom, S).share < shortColumn(pick, Z.bottom, S).share) pick = next;
    }
    // Takeaways too few for even a three-column column beside a chart run under it instead, side by side, and
    // the chart (with its values) takes the body's width above them.
    if (shortColumn(pick, Z.bottom, S).share > RAIL_EMPTY && visuals.some((v) => (v.content || {}).chart)) {
      const paras = texts.flatMap(itemParas);
      const half = Math.ceil(paras.length / 2);
      const parts = paras.length >= 2 ? splitRegion(S, Z, 0.5) : [Z];
      const measured = parts.map((R, i) => measureText(parts.length > 1 ? (i ? paras.slice(half) : paras.slice(0, half)) : paras, R.w, S, state));
      const notesH = Math.max(...measured.map((m) => m.h));
      const above = { ...Z, bottom: Z.bottom - notesH - state.blockGap };
      const top = (S.tok.tight && valuesUnder(visuals, above, S, state, true)) || stack(visuals, above, S, state);
      const chart = top.placed.find((q) => q.kind === "chart");
      if (chart && chart.h - chart.cap >= 150) {
        return [...top.placed, ...measured.map((m, i) => ({ ...m, x: parts[i].x, y: above.bottom + state.blockGap, limit: Z.bottom }))];
      }
    }
    return pick;
  }
  if (Z.b - Z.a + 1 >= 6) {
    let [left, right] = splitRegion(S, Z, share);
    // On the compact step takeaways too long for their column take half the body from the visual.
    if (S.tok.tight && share > 0.5 && stack(texts, o.textFirst ? left : right, S, state).bottom > Z.bottom) [left, right] = splitRegion(S, Z, 0.5);
    const [vR, full] = o.textFirst ? [right, left] : [left, right];
    let v = stack(visuals, vR, S, state);
    const col = takeawayColumn(ctx, texts, visuals, full, v.bottom);
    const t = col.t;
    // When the chart's values found no room beside it, they stand under the chart, which gives up the
    // height the table takes: as columns, else turned across (the categories as columns, one row a
    // series), which costs a row per series only.
    if (S.tok.tight && !col.values) {
      const under = valuesUnder(visuals, vR, S, state, true);
      if (under) v = under;
    }
    // The strip closes the column once the visual's own height is settled.
    if (col.strip && col.end <= col.R.bottom + 0.5 && v.bottom > col.end) t.placed.push(...col.strip.placed.map((q) => ({ ...q, strip: true })));
    // A table keeps its own height, so beside it a short takeaway leaves the body half empty. When
    // that band is over the density cap and the takeaway fits under the table, it goes there, its
    // points side by side in two columns so they read as notes on the table above them.
    if (v.placed.every((p) => !p.flex) && (Z.bottom - Math.max(v.bottom, t.bottom)) / (Z.bottom - Z.y) > S.tok.cap) {
      const top = stack(visuals, Z, S, state);
      const below = { ...Z, y: top.bottom + state.blockGap };
      const paras = texts.flatMap(itemParas);
      const half = Math.ceil(paras.length / 2);
      const notes = paras.length >= 2
        ? splitRegion(S, below, 0.5).map((R, i) => textAt(i ? paras.slice(half) : paras.slice(0, half), R, S, state))
        : stack(texts, below, S, state).placed;
      const end = Math.max(...notes.map((q) => q.y + q.h));
      if (end <= Z.bottom) {
        // Still short of the density band: the table's rows open up first (half the room, at most
        // one more minimum row height each), then the notes stand midway in what is left under the table.
        let room = Z.bottom - end;
        let grow = 0;
        const table = top.placed.find((q) => q.kind === "table");
        if (table && room / (Z.bottom - Z.y) > S.tok.cap) {
          const rows = table.heights.length - 1;
          grow = Math.floor(Math.min(room / 2, rows * S.tok.rowMin) / rows) * rows;
          table.heights = table.heights.map((h, i) => (i ? h + grow / rows : h));
          table.tableH += grow;
          table.h += grow;
          for (const q of top.placed) if (q !== table && q.y > table.y) q.y += grow;
          room -= grow;
        }
        const dy = grow + (room / (Z.bottom - Z.y) > S.tok.cap ? Math.round(room / 2) : 0);
        return [...top.placed, ...notes.map((q) => ({ ...q, y: q.y + dy }))];
      }
    }
    // A picture drawn shorter than its box (a wide one in a tall column) stands on the box floor when
    // the takeaways beside it run past the picture's top, so the two columns leave no band empty across both.
    for (const q of v.placed) if (q.kind === "image") q.beside = t.bottom;
    out.push(...v.placed, ...t.placed);
    if (S.deco.has("column-hairlines")) out.push(columnHairline(S, o.textFirst ? right : right, Z));
    return out;
  }
  return stack([...visuals, ...texts], Z, S, state).placed;
}

/**
 * A chart over its values as a compact table in region R: as columns, else turned across (the categories
 * as columns, one row a series), when the chart keeps at least 150 pt and every row holds one line.
 * Returns the placements (or the stack result when `asStack`), or null.
 */
function valuesUnder(visuals, R, S, state, asStack = false) {
  // Across the body the values run across (two or three rows under a wide chart); in a column, as columns.
  const order = R.w >= S.grid.span(1, 8).w ? [chartTable(visuals, true), chartTable(visuals)] : [chartTable(visuals), chartTable(visuals, true)];
  for (const table of order) {
    if (!table) continue;
    const under = stack([...visuals, table], R, S, state);
    const chart = under.placed.find((q) => q.kind === "chart");
    if (chart && chart.h - chart.cap >= 150 && under.bottom <= R.bottom + 0.5 && under.placed.every((q) => q.kind !== "table" || q.heights.slice(1).every((h) => h <= S.tok.rowMin * 1.6))) {
      return asStack ? under : under.placed;
    }
  }
  return null;
}

/**
 * The takeaway column beside a visual that ends at `visualBottom`. The source strip offered by the slide
 * closes the column (it is placed by the caller once the visual is settled), so the column reaches the
 * floor with the visual instead of stopping halfway; on the compact step a chart's values stand as a
 * compact table under the takeaways when they fit, so the exact figures are beside the shape they make.
 * Takeaways that still leave more than 40 % of the column empty beside a longer visual are set one step
 * up (lead) when they fit: scaled within the ramp, never shrunk (spec-v2 Amendments 7).
 */
function takeawayColumn(ctx, texts, visuals, full, visualBottom) {
  const { S, state } = ctx;
  const strip = ctx.strip ? stripPlacements(ctx.strip, full, S) : null;
  const R = strip ? { ...full, bottom: full.bottom - strip.h - S.tok.block } : full;
  const at = (st) => {
    const t = stack(texts, R, S, st);
    const values = S.tok.tight ? chartValues(visuals, R, S, state, t.bottom) : null;
    if (values) t.placed.push(values);
    const end = Math.max(t.bottom, values ? values.y + values.h : 0);
    return { t, values, end, empty: (Math.min(visualBottom, R.bottom) - end) / Math.max(1, R.bottom - R.y) };
  };
  let pick = at(state);
  if (pick.empty > 0.4 && !state.stepped && R.w / S.sizes.lead >= 12) {
    const lead = at({ ...state, stepped: true });
    if (lead.end <= R.bottom + 0.5 && lead.empty < pick.empty) pick = lead;
  }
  return { ...pick, strip, R };
}

/**
 * A table standing alone in its region (its takeaways in a side title's rail) opens its rows, at most one
 * minimum row height each, while the region leaves more than the density band empty under it.
 */
function openRows(placed, Z, S) {
  const tables = placed.filter((q) => q.kind === "table");
  if (tables.length !== 1 || placed.some((q) => q.flex)) return placed;
  const table = tables[0];
  const room = Z.bottom - Math.max(...placed.map((q) => q.y + q.h));
  if (room / (Z.bottom - Z.y) <= S.tok.cap) return placed;
  const rows = table.heights.length - 1;
  const grow = Math.floor(Math.min(room, rows * S.tok.rowMin) / rows) * rows;
  table.heights = table.heights.map((h, i) => (i ? h + grow / rows : h));
  table.tableH += grow;
  table.h += grow;
  for (const q of placed) if (q !== table && q.y > table.y) q.y += grow;
  return placed;
}

/**
 * The first chart's data as a plain table item (at most 8 rows and 4 columns), or null. `across`
 * turns it: the categories head the columns and each series is one row.
 */
function chartTable(visuals, across = false) {
  const chart = visuals.find((v) => v.type === "kpi-table" && (v.content || {}).chart);
  const c = chart && chart.content;
  if (!c || !(c.headers || []).length || (c.rows || []).length > 8 || c.headers.length > 4) return null;
  if (!across) return { type: "kpi-table", values: true, content: { headers: c.headers, rows: c.rows } };
  const headers = [c.headers[0], ...c.rows.map((r) => r[0])];
  const rows = c.headers.slice(1).map((h, j) => [h, ...c.rows.map((r) => r[j + 1])]);
  return { type: "kpi-table", values: true, content: { headers, rows } };
}

/** The first chart's data as a table at label size under `top` in region R, or null when it does not fit. */
function chartValues(visuals, R, S, state, top) {
  const item = chartTable(visuals);
  if (!item) return null;
  const m = measureTable(item, R.w, S, { ...state, stepped: false });
  const y = top + state.blockGap;
  if (y + m.h > R.bottom || m.heights.slice(1).some((h) => h > S.tok.rowMin * 1.6)) return null;
  return { item, ...m, x: R.x, y, w: R.w, limit: R.bottom };
}

/** A 0.5 pt guide in the gutter before region R (the visible grid of an editorial pack). */
function columnHairline(S, R, Z) {
  return { decor: true, kind: "rect", x: R.x - S.grid.gutter / 2, y: Z.y, w: 0.5, h: Z.bottom - Z.y, fill: "line" };
}

const PLANS = {
  "text-column"(ctx) {
    const { S, state, Z } = ctx;
    const items = ctx.items;
    // Running text keeps its measure: cols 1-9 on the presented ramp, 1-7 on the reading ramp.
    const limit = S.tok.ramp === "presented" ? 9 : 7;
    const R = ctx.cls === "side" ? Z : region(S, Z.a, Math.min(Z.b, Z.a + limit - 1), Z.y, Z.bottom);
    const { visuals, texts } = sortItems(items);
    if (visuals.length && texts.length) return visualWithText(ctx, visuals, texts, 7 / 12);
    const placed = stack(items, R, S, state).placed;
    // Two to five points that each open with a bold head, and that leave the body more than the
    // density band empty, read as rows: the head in its own column, the point beside it.
    const ents = !visuals.length && ctx.cls !== "side" ? entries(texts.flatMap(itemParas)) : [];
    // Groups of sub-points under bold heads, held to one reading measure narrower than the body,
    // run in two columns instead: the measure stays and the body is used across.
    const groups = ents.length >= 2 && ents.every((e) => e.head && !e.rest && e.children.length);
    if (groups && R.w < Z.w - S.grid.pitch) {
      const two = PLANS["text-two-column"](ctx);
      if (!two.some((q) => q.y + q.h > Z.bottom)) {
        // Each column's groups share the height left under it. A gap past a sixth of the body is one
        // more empty band than the page needs, so then the room is shared with the foot as well.
        for (const q of two.filter((x) => x.kind === "text")) {
          const breaks = q.paras.filter((para, i) => i > 0 && para.kind !== "child");
          if (!breaks.length) continue;
          const room = Z.bottom - (q.y + q.h);
          const per = Math.min(room / breaks.length > (Z.bottom - Z.y) / 6 ? room / (breaks.length + 1) : room / breaks.length, 0.25 * (Z.bottom - Z.y));
          for (const para of breaks) para.gap += per;
          q.h += per * breaks.length;
        }
        return two;
      }
    }
    const headed = ents.length >= 2 && ents.length <= 5 && ents.every((e) => e.head && e.rest && !e.children.length && e.kind === "bullet");
    if (headed && (Z.bottom - contentBottom(placed, Z.y)) / (Z.bottom - Z.y) > S.tok.cap) return headedRows(ctx, ents);
    return placed;
  },

  "text-two-column"(ctx) {
    const { S, state, Z } = ctx;
    const { columns, texts, visuals } = sortItems(ctx.items);
    if (columns) return stack([columns, ...visuals], Z, S, state).placed;
    const paras = texts.flatMap(itemParas);
    const [l, r] = splitRegion(S, Z, 0.5);
    // Break at a section boundary nearest to half the height.
    const heights = paras.map((p) => G.textHeight(plainText(p.text), l.w, bodySize(S, state)) + state.itemGap);
    const total = heights.reduce((a, b) => a + b, 0);
    let acc = 0;
    let cut = paras.length;
    for (let i = 0; i < paras.length; i++) {
      if (i > 0 && paras[i].kind !== "child" && acc >= total / 2 - heights[i] / 2) { cut = i; break; }
      acc += heights[i];
    }
    let out = [textAt(paras.slice(0, cut), l, S, state), textAt(paras.slice(cut), r, S, state)];
    // Two sections of unequal length leave one column half empty: the break moves to the point (never between a
    // point and its sub-points) that brings the columns nearest even (spec-v2 Amendments 8).
    if (shortColumn(out, Z.bottom, S).share > 0.35) {
      const evenest = (ok) => {
        let best = null;
        for (let i = 1; i < paras.length; i++) {
          if (!ok(i)) continue;
          const pair = [textAt(paras.slice(0, i), l, S, state), textAt(paras.slice(i), r, S, state)];
          const diff = Math.abs(pair[0].h - pair[1].h);
          if (!best || diff < best.diff) best = { pair, diff };
        }
        return best;
      };
      let best = evenest((i) => paras[i].kind !== "child");
      // Groups too unequal to balance whole may continue in the next column, a head never parted from its first point.
      if (!best || shortColumn(best.pair, Z.bottom, S).share > RAIL_EMPTY) {
        const inside = evenest((i) => paras[i - 1].kind !== "section");
        if (inside && (!best || shortColumn(inside.pair, Z.bottom, S).share < shortColumn(best.pair, Z.bottom, S).share)) best = inside;
      }
      if (best && shortColumn(best.pair, Z.bottom, S).share < shortColumn(out, Z.bottom, S).share) out = best.pair;
    }
    if (S.deco.has("hairline-rule") || S.deco.has("column-hairlines")) out.push(columnHairline(S, r, Z));
    return out;
  },

  "summary-box-list"(ctx) {
    const { S, state, Z, spec } = ctx;
    const paras = sortItems(ctx.items).texts.flatMap(itemParas);
    let box = spec.lead ? [{ kind: "text", text: spec.lead }] : null;
    let rest = paras;
    if (!box) {
      const first = paras.findIndex((p) => p.kind === "text" || p.kind === "bullet");
      box = first >= 0 ? [paras[first]] : paras.slice(0, 1);
      rest = paras.filter((_, i) => i !== (first >= 0 ? first : 0));
    }
    const pad = 18;
    const boxText = measureText(box.map((p) => ({ ...p, kind: "text" })), Z.w - pad * 2, S, state, { size: S.sizes.lead });
    const boxH = boxText.h + pad * 2;
    const out = [
      { kind: "box", x: Z.x, y: Z.y, w: Z.w, h: boxH, outline: S.deco.has("box-outline"), limit: Z.bottom },
      { ...boxText, x: Z.x + pad, y: Z.y + pad, bold: true, limit: Z.bottom },
    ];
    const below = { ...Z, y: Z.y + boxH + 18 };
    const [l, r] = splitRegion(S, below, 0.5);
    const ents = entries(rest);
    const half = Math.ceil(ents.length / 2);
    const flat = (list) => list.flatMap((e) => [{ kind: e.kind === "section" ? "section" : "bullet", text: e.head ? `**${e.head}** ${e.rest}`.trim() : e.rest },
      ...e.children.map((c) => ({ kind: "child", text: c }))]);
    const split = (k) => [textAt(flat(ents.slice(0, k)), l, S, state), textAt(flat(ents.slice(k)), r, S, state)];
    let cols = split(half);
    // Groups of unequal length split by count leave one column short (OF-115 reads it whatever the longer column's
    // length): the split moves to the group boundary that brings the columns nearest even.
    const uneven = (p) => Math.abs(p[0].h - p[1].h);
    if (ents.length > 2 && uneven(cols) > 0.35 * (below.bottom - below.y)) {
      const even = ents.slice(1).map((_, i) => split(i + 1)).reduce((m, p) => (uneven(p) < uneven(m) ? p : m));
      if (uneven(even) < uneven(cols)) cols = even;
    }
    out.push(...cols);
    return out;
  },

  "sidebar-note"(ctx) {
    const { S, state, Z } = ctx;
    // The note stands in a side title's rail: the main points take the body.
    if (ctx.railNote) return PLANS["text-column"](ctx);
    const { texts, visuals } = sortItems(ctx.items);
    // The note is the fenced main-box, else a last text block after the main one; a lone text block is the main.
    const note = texts.find((t) => t.type === "main-box") || (texts.length > 1 ? texts[texts.length - 1] : null);
    const main = [...visuals, ...texts.filter((t) => t !== note)];
    const [mR, nR] = splitRegion(S, Z, 8 / 12);
    const out = stack(main, mR, S, state).placed;
    if (note) {
      const pad = S.tok.pad;
      const m = measureText(itemParas(note), nR.w - pad * 2, S, state);
      out.push({ kind: "box", x: nR.x, y: nR.y, w: nR.w, h: m.h + pad * 2, surface: true, limit: Z.bottom },
        { ...m, x: nR.x + pad, y: nR.y + pad, limit: Z.bottom });
      // A short note beside a long main column leaves its column mostly empty: the note then stands across
      // the top at lead size and the main points run in two columns under it (spec-v2 Amendments 8).
      if (main.length && shortColumn(out, Z.bottom, S).share > RAIL_EMPTY && Z.b - Z.a + 1 >= 12) {
        // First a narrower note column at the body size (the note never set larger than the main points), the main
        // column wider beside it.
        const [mR3, nR3] = splitRegion(S, Z, 9 / 12);
        const m3 = measureText(itemParas(note), nR3.w - pad * 2, S, state);
        const narrow = [...stack(main, mR3, S, state).placed, { kind: "box", x: nR3.x, y: nR3.y, w: nR3.w, h: m3.h + pad * 2, surface: true, limit: Z.bottom },
          { ...m3, x: nR3.x + pad, y: nR3.y + pad, limit: Z.bottom }];
        if (!overflows(narrow) && shortColumn(narrow, Z.bottom, S).share <= RAIL_EMPTY && (Z.bottom - contentBottom(narrow, Z.y)) / (Z.bottom - Z.y) <= S.tok.cap) return narrow;
      }
      if (main.length && !visuals.length && shortColumn(out, Z.bottom, S).share > RAIL_EMPTY) {
        // The note keeps a reading measure inside the box (S4.4): about 32 Hangul or 70 Latin characters.
        const korean = G.isKorean(itemParas(note).map((p) => p.text).join(""));
        const inner = Math.min(Z.w - pad * 2, (korean ? 30 : 35) * S.sizes.lead);
        const lead = measureText(itemParas(note).map((p) => ({ ...p, kind: "text" })), inner, S, state, { size: S.sizes.lead });
        const boxH = lead.h + pad * 2;
        const below = { ...Z, y: Z.y + boxH + state.blockGap };
        const fits = (plan) => !plan.some((q) => !q.decor && q.y + q.h > Z.bottom + 0.5);
        // One column at the reading measure when it holds the points and reaches the density band (the note at lead
        // size, else at the points' own size); else grouped points pick their own two columns in the text-column plan
        // and plain points run in two columns.
        for (const z of [S.sizes.lead, bodySize(S, state)]) {
          const m = measureText(itemParas(note).map((p) => ({ ...p, kind: "text" })), Math.min(Z.w - pad * 2, (korean ? 30 : 35) * z), S, state, { size: z });
          const top = Z.y + m.h + pad * 2 + state.blockGap;
          const single = stack(main, region(S, Z.a, Math.min(Z.b, Z.a + 8), top, Z.bottom), S, state).placed;
          if (!fits(single)) continue;
          // Room left under the single column is shared between its groups (at most a sixth of the body a gap).
          if (single.length === 1 && single[0].kind === "text") {
            const q = single[0];
            const breaks = q.paras.filter((para, i) => i > 0 && para.kind === "section");
            const room = Z.bottom - (q.y + q.h);
            if (breaks.length && room / (Z.bottom - top) > S.tok.cap) {
              const per = Math.min(room / (breaks.length + 1), (Z.bottom - Z.y) / 6);
              for (const para of breaks) para.gap += per;
              q.h += per * breaks.length;
            }
          }
          if ((Z.bottom - contentBottom(single, top)) / (Z.bottom - top) <= S.tok.cap) {
            return [{ kind: "box", x: Z.x, y: Z.y, w: Z.w, h: m.h + pad * 2, surface: true, limit: Z.bottom },
              { ...m, x: Z.x + pad, y: Z.y + pad, limit: Z.bottom }, ...single];
          }
        }
        let two = PLANS["text-column"]({ ...ctx, Z: below, items: main });
        const across = PLANS["text-two-column"]({ ...ctx, Z: below, items: main });
        if (!fits(two) || (fits(across) && shortColumn(two, Z.bottom, S).share + (Z.bottom - contentBottom(two, below.y)) / (Z.bottom - below.y) > (Z.bottom - contentBottom(across, below.y)) / (Z.bottom - below.y) + 0.1)) two = across;
        if (fits(two)) {
          return [{ kind: "box", x: Z.x, y: Z.y, w: Z.w, h: boxH, surface: true, limit: Z.bottom },
            { ...lead, x: Z.x + pad, y: Z.y + pad, limit: Z.bottom }, ...two];
        }
      }
    }
    return out;
  },

  agenda(ctx) {
    const { S, state, Z } = ctx;
    const ents = entries(sortItems(ctx.items).texts.flatMap(itemParas));
    if (!ents.length) return [];
    const n = ents.length;
    const numW = S.grid.span(1, 1).w;
    const textX = Z.x + numW + S.grid.gutter;
    const textW = Z.x + Z.w - textX;
    const head = bodySize(S, state, "lead");
    const rest = bodySize(S, state);
    const rows = ents.map((e, i) => {
      const headText = e.head || e.rest;
      const restText = e.head ? [e.rest, ...e.children].filter(Boolean).join(" · ") : e.children.join(" · ");
      const h = G.textHeight(headText, textW, head) + (restText ? 6 + G.textHeight(restText, textW, rest) : 0);
      return { num: String(i + 1).padStart(2, "0"), head: headText, rest: restText, h };
    });
    // Rows share the body down to its floor, at most 108 pt apart.
    const tallest = Math.max(...rows.map((r) => r.h));
    const pitch = rowPitch(n, tallest, Z, state.groupGap, 108);
    rows.forEach((r, i) => { r.y = Z.y + i * pitch; });
    return [{ kind: "rows", rows, x: Z.x, numW, textX, textW, head, rest, pitch, rule: S.deco.has("hairline-rule"), y: Z.y, h: (n - 1) * pitch + rows[n - 1].h, limit: Z.bottom }];
  },

  "references-appendix"(ctx) {
    const { S, state, Z } = ctx;
    const paras = sortItems(ctx.items).texts.flatMap(itemParas).map((p) => ({ ...p, kind: "text" }));
    let size = S.tok.ramp === "presented" ? (state.stepped ? S.sizes.body : S.sizes.label) : bodySize(S, state);
    // Entries are scanned for a name or a year: one per row, rows spread down the page with rules.
    // A list longer than the body steps down to label size, then runs in two columns.
    // Rows share one pitch, so the tallest entry sets the room every row takes.
    const fits = (z, w, n) => n * Math.max(...paras.slice(0, n).map((p) => G.textHeight(plainText(p.text), w, z, 1.3))) + 12 * (n - 1) <= Z.bottom - Z.y;
    let cols = [Z];
    if (!fits(size, Z.w, paras.length)) {
      if (fits(S.sizes.label, Z.w, paras.length)) size = S.sizes.label;
      else if (paras.length >= 4) { size = S.sizes.label; cols = splitRegion(S, Z, 0.5); }
    }
    const per = Math.ceil(paras.length / cols.length);
    return cols.flatMap((R, ci) => {
      const part = paras.slice(ci * per, (ci + 1) * per);
      if (!part.length) return [];
      const heights = part.map((p) => G.textHeight(plainText(p.text), R.w, size, 1.3));
      const pitch = rowPitch(part.length, Math.max(...heights, 1), R, 12, Math.max(...heights, 1) + 72);
      return part.flatMap((p, i) => {
        const y = R.y + i * pitch;
        const row = { kind: "text", paras: [{ ...p, inset: 0, gap: 0, h: heights[i] }], size, x: R.x, y, w: R.w, h: heights[i], limit: Z.bottom };
        return i > 0 && S.deco.has("hairline-rule") ? [{ decor: true, kind: "rect", x: R.x, y: y - (pitch - heights[i - 1]) / 2, w: R.w, h: 0.5, fill: "line" }, row] : [row];
      });
    });
  },

  "kpi-row"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const kpi = visuals.find((v) => v.type === "kpi-table" && looksLikeKpi(v.content || {}, { basis: true }));
    if (!kpi) return PLANS["table-insight"](ctx);
    const others = visuals.filter((v) => v !== kpi);
    if (ctx.cls === "side" || Z.b - Z.a + 1 < 10 || (state.anchor && ctx.cls === "top")) {
      // Under a side title, or when the values take the room, they run down the body as rows:
      // the value, then what it measures.
      const cards = shared().kpiCards(kpi.content).slice(0, 6);
      const out = [];
      const restTexts = texts;
      const restH = restTexts.length ? stack(restTexts, Z, S, state).bottom - Z.y + state.blockGap : 0;
      const rowsZone = { ...Z, bottom: Z.bottom - restH };
      out.push(figureRows(cards, rowsZone, S, state));
      if (restTexts.length) out.push(...stack(restTexts, { ...Z, y: rowsZone.bottom + state.blockGap }, S, state).placed);
      return out;
    }
    const top = ctx.cls === "bottom" ? Z.y + 72 : Z.y;
    const cardsPlan = stack([kpi, ...others, ...texts], { ...Z, y: top }, S, state);
    // On the compact step a row of cards with its takeaways under it stops high on the page. The
    // figures then run as rows down the first seven columns (value, label, basis), the caption at
    // their foot, and the takeaways stand beside them.
    if (S.tok.tight && texts.length && !others.length && (ctx.cls === "bottom" || (Z.bottom - cardsPlan.bottom) / (Z.bottom - Z.y) > S.tok.cap)) {
      const cards = shared().kpiCards(kpi.content).slice(0, 6);
      const [fR, tR] = splitRegion(S, Z, 7 / 12);
      const capH = kpi.caption ? captionHeight(kpi.caption, fR.w, S) + 6 : 0;
      const rows = figureRows(cards, { ...fR, bottom: fR.bottom - capH }, S, state, 48);
      const col = takeawayColumn(ctx, texts, [], tR, fR.bottom);
      const notes = col.t;
      if (col.strip && col.end <= col.R.bottom + 0.5) notes.placed.push(...col.strip.placed.map((q) => ({ ...q, strip: true })));
      if (rows.y + rows.h <= fR.bottom - capH + 0.5 && notes.bottom <= Z.bottom + 0.5) {
        const out = [rows, ...notes.placed];
        if (kpi.caption) out.push({ kind: "caption", item: { content: kpi.caption }, x: fR.x, y: fR.bottom - capH + 6, w: fR.w, h: capH - 6, limit: Z.bottom });
        if (shortColumn(out, Z.bottom, S).share <= 0.35) return out;
        // Takeaways too few to fill the column beside the rows: the rows run across the body and the takeaways
        // stand under them side by side, the caption between (spec-v2 Amendments 8).
        const paras = texts.flatMap(itemParas);
        const half = Math.ceil(paras.length / 2);
        // Up to three points read down one column at the reading measure; four or more stand side by side.
        const parts = paras.length >= 4 ? splitRegion(S, Z, 0.5) : [region(S, Z.a, Math.min(Z.b, Z.a + 8), Z.y, Z.bottom)];
        // The takeaways keep the size they had beside the rows (lead when the column stepped up).
        const keep = (notes.placed.find((q) => q.kind === "text" && !q.strip) || {}).size;
        const measured = parts.map((R, i) => measureText(parts.length > 1 ? (i ? paras.slice(half) : paras.slice(0, half)) : paras, R.w, S, state, keep ? { size: keep } : {}));
        const notesH = Math.max(...measured.map((m) => m.h));
        const rowsBottom = Z.bottom - notesH - state.blockGap - capH;
        // Four figures or more stand in two columns of rows, so the rows use the body's width.
        const halves = cards.length >= 4 ? splitRegion(S, { ...Z, bottom: rowsBottom }, 0.5) : [{ ...Z, bottom: rowsBottom }];
        const split = Math.ceil(cards.length / halves.length);
        const across = halves.map((R, i) => figureRows(cards.slice(i * split, (i + 1) * split), R, S, state, 72));
        // The second column's rows stand level with the first's (an odd count leaves its last row open).
        if (across.length === 2) {
          const [a, b] = across;
          b.rows.forEach((r, k) => { r.y = a.rows[k].y; });
          Object.assign(b, { pitch: a.pitch, value: a.value, labelSize: a.labelSize, noteSize: a.noteSize, h: b.rows.length ? b.rows[b.rows.length - 1].y - b.y + (a.h - (a.rows[a.rows.length - 1].y - a.y)) : 0 });
        }
        // A band left open between the rows and the takeaways under them is worse than a column whose points share
        // the room beside the rows, when that sharing fills the column (spec-v2 Amendments 9).
        const band = (Z.bottom - notesH - state.blockGap - capH - Math.max(...across.map((q) => q.y + q.h))) / (Z.bottom - Z.y);
        if (band > S.tok.cap) {
          const filled = structuredClone(out);
          fillColumn(shortColumn(filled, Z.bottom, S), Z.bottom, S, state);
          if (shortColumn(filled, Z.bottom, S).share <= 0.35) return filled;
        }
        if (across.every((q) => q.y + q.h <= rowsBottom + 0.5)) {
          const res = [...across, ...measured.map((m, i) => ({ ...m, x: parts[i].x, y: Z.bottom - notesH, limit: Z.bottom }))];
          if (kpi.caption) res.push({ kind: "caption", item: { content: kpi.caption }, x: Z.x, y: rowsBottom + 6, w: Z.w, h: capH - 6, limit: Z.bottom });
          return res;
        }
        return out;
      }
    }
    return cardsPlan.placed;
  },

  "big-number"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const table = visuals.find((v) => v.type === "kpi-table");
    if (!table) return PLANS["text-column"](ctx);
    if ((S.pack.display || {}).number) return numberPanel(ctx, table, texts);
    const c = table.content || {};
    const value = plainText(((c.rows || [])[0] || [])[0] || (c.headers || [])[1] || "");
    const label = plainText((c.headers || [])[0] || "");
    const wide = Z.b - Z.a + 1 >= 10;
    const [nR, tR] = wide ? splitRegion(S, Z, 6 / 12) : [Z, null];
    const size = [S.sizes.title, S.sizes.lead].find((v) => S.ems(value, "numeral") * v * 1.04 <= nR.w) || S.sizes.body;
    const labelSize = bodySize(S, state, "lead");
    const labelH = G.textHeight(label, nR.w, labelSize);
    const capH = table.caption ? captionHeight(table.caption, nR.w, S) + 6 : 0;
    const blockH = size * 1.15 + 12 + labelH + capH;
    const out = [];
    // The number opens the body, its evidence beside it or under it. Under a bottom title the
    // number sits on the visual zone's floor, next to the title that explains it.
    const y = ctx.cls === "bottom" ? Z.bottom - blockH : Z.y;
    if (texts.length) {
      const R = tR ? region(S, tR.a + 1, tR.b, Z.y, Z.bottom)
        : ctx.cls === "bottom" ? { ...Z, bottom: y - state.blockGap } : { ...Z, y: Z.y + blockH + state.blockGap };
      const evidence = stack(texts, R, S, { ...state, stepped: true });
      // Beside a number on the floor the evidence ends level with the number block, so it reads
      // with the number instead of hanging above it at the top of the page.
      const lift = tR && ctx.cls === "bottom" ? Math.max(0, Math.min(y + blockH, Z.bottom) - evidence.bottom) : 0;
      out.push(...evidence.placed.map((q) => ({ ...q, y: q.y + lift })));
    }
    out.push({ kind: "number", value, label, size, labelSize, x: nR.x, y, w: nR.w, h: size * 1.15 + 12 + labelH, limit: Z.bottom });
    if (table.caption) out.push({ kind: "caption", item: { content: table.caption }, x: nR.x, y: y + size * 1.15 + 12 + labelH + 6, w: nR.w, h: capH - 6, limit: Z.bottom });
    return out;
  },

  "chart-insight"(ctx) {
    const { visuals, texts } = sortItems(ctx.items);
    return visualWithText(ctx, visuals, texts, 8 / 12);
  },

  "full-chart"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    // The note runs under the chart.
    return stack([...visuals, ...texts], Z, S, state).placed;
  },

  "kpi-over-chart"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const kpi = visuals.find((v) => v.type === "kpi-table" && looksLikeKpi(v.content || {}, { basis: true }) && !(v.content || {}).chart);
    const charts = visuals.filter((v) => v !== kpi);
    if (!kpi || !charts.length) return PLANS["chart-insight"](ctx);
    return stack([kpi, ...charts, ...texts], Z, S, state).placed;
  },

  "dashboard-grid"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    if (visuals.length < 2) return PLANS["chart-insight"](ctx);
    const panels = visuals.slice(0, 4);
    const out = [];
    const cols = panels.length === 3 ? 3 : 2;
    const rows = Math.ceil(panels.length / cols);
    const textH = texts.length ? stack(texts, Z, S, state).bottom - Z.y + state.blockGap : 0;
    const gridZ = { ...Z, bottom: Z.bottom - textH };
    const rowH = (gridZ.bottom - gridZ.y - (rows - 1) * S.grid.gutter) / rows;
    const parts = equalParts(S, Z, cols);
    panels.forEach((p, i) => {
      const part = parts[i % cols];
      const y = gridZ.y + Math.floor(i / cols) * (rowH + S.grid.gutter);
      out.push(...stack([p], { ...part, y, bottom: y + rowH }, S, state).placed);
    });
    if (texts.length) out.push(...stack(texts, { ...Z, y: gridZ.bottom + state.blockGap }, S, state).placed);
    return out;
  },

  "table-insight"(ctx) {
    const { visuals, texts } = sortItems(ctx.items);
    return visualWithText(ctx, visuals, texts, 8 / 12);
  },

  "ledger-table"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    return stack([...visuals, ...texts], Z, S, state).placed;
  },

  comparison(ctx) {
    const { S, state, Z } = ctx;
    const { columns, texts, visuals } = sortItems(ctx.items);
    if (visuals.length && !columns) return visualWithText(ctx, visuals, texts, 7 / 12);
    let halves;
    if (columns) halves = columns.columns.map((col) => (col || []).filter(isText).flatMap(itemParas));
    else {
      const ents = entries(texts.flatMap(itemParas));
      const half = Math.ceil(ents.length / 2);
      const flat = (list) => list.flatMap((e) => [{ kind: "section", text: e.head || e.rest }, ...(e.head && e.rest ? [{ kind: "text", text: e.rest }] : []), ...e.children.map((c) => ({ kind: "child", text: c }))]);
      halves = [flat(ents.slice(0, half)), flat(ents.slice(half))];
    }
    const sides = halves.slice(0, 2).map((paras) => {
      const headIdx = paras.findIndex((p) => p.kind === "section");
      return { head: headIdx >= 0 ? paras[headIdx].text : null,
        items: paras.filter((_, j) => j !== headIdx).map((p) => String(p.text).replace(/^\(\d+\)\s*/u, "")) };
    });
    // Points that open with the same label on both sides ("비용: …") read as criteria rows on the
    // compact step: the label stands once in a column of its own, each side keeps the rest. A label
    // is a short name (three words at most); one row whose two labels differ names both ("Limit /
    // Question"), so a single odd row does not cost the whole slide its criteria.
    const LABEL = /^([^:：]{1,24})[:：]\s*(.+)$/u;
    const isLabel = (t) => { const m = LABEL.exec(plainText(t)); return Boolean(m) && m[1].trim().split(/\s+/u).length <= 3; };
    let criteria = null;
    // Under a side title the criteria go to the rail at any density (spec-v2 Amendments 7).
    if ((S.tok.tight || ctx.rail) && sides.length === 2 && sides.every((sd) => sd.items.length && sd.items.every(isLabel))) {
      const n = Math.max(...sides.map((sd) => sd.items.length));
      const sets = Array.from({ length: n }, (_, r) => [...new Set(sides.map((sd) => sd.items[r] && LABEL.exec(plainText(sd.items[r]))[1].trim()).filter(Boolean))]);
      const labels = sets.map((set) => set.join(" / "));
      const odd = sets.filter((set) => set.length > 1).length;
      if (odd <= 1 && odd < n / 2) {
        criteria = labels;
        for (const sd of sides) sd.items = sd.items.map((t) => LABEL.exec(plainText(t))[2]);
      }
    }
    // Under a side title the criteria stand in the rail, level with their rows, and the two sides take
    // the body beside it; the rows then start under the title's last line and end above the rail's strip.
    const inRail = Boolean(criteria && ctx.rail);
    const floor = inRail ? Math.min(Z.bottom, ctx.rail.bottom) : Z.bottom;
    const critR = inRail ? { ...ctx.rail, bottom: floor } : criteria ? region(S, Z.a, Z.a + 1, Z.y, Z.bottom) : null;
    const parts = criteria && !inRail ? splitRegion(S, region(S, Z.a + 2, Z.b, Z.y, Z.bottom), 0.5) : splitRegion(S, Z, 0.5);
    const headSize = bodySize(S, state, "lead");
    // Up to three rows of short points are set a step or two larger when that still keeps a dozen
    // glyphs a line and fits the body; a two-row comparison otherwise holds a third of the page.
    const rowsN = Math.max(...sides.map((sd) => sd.items.length));
    const fitsAt = (z) => {
      if (parts[0].w / z < 12) return false;
      const hs = Array.from({ length: rowsN }, (_, r) => Math.max(...sides.map((sd, i) => (sd.items[r] ? G.textHeight(plainText(sd.items[r]), parts[i].w, z) : 0))));
      const headRoom = Math.max(0, ...sides.map((sd, i) => (sd.head ? G.textHeight(plainText(sd.head), parts[i].w, headSize) + 30 : 0)));
      return Z.y + headRoom + hs.reduce((a, b) => a + b, 0) + (rowsN - 1) * state.groupGap * 2 <= floor;
    };
    // The compact step never inflates type to fill: its rows keep the body size.
    const itemSize = (rowsN <= 3 && !S.tok.tight ? [S.sizes.title, S.sizes.lead].filter((z) => z > bodySize(S, state)) : []).find(fitsAt) || bodySize(S, state);
    const out = [];
    const headH = Math.max(0, ...sides.map((sd, i) => (sd.head ? G.textHeight(plainText(sd.head), parts[i].w, headSize) : 0)));
    let top = Z.y;
    if (headH) {
      sides.forEach((sd, i) => {
        if (!sd.head) return;
        out.push({ kind: "text", paras: [{ kind: "section", text: sd.head, inset: 0, h: headH, gap: 0 }], size: headSize, x: parts[i].x, y: Z.y, w: parts[i].w, h: headH, limit: Z.bottom, bold: true });
        const accent = S.deco.has("accent-rule");
        out.push({ decor: true, kind: "rect", x: parts[i].x, y: Z.y + headH + 12, w: accent ? S.grid.col : parts[i].w, h: accent ? 3 : 0.75, fill: accent ? "accent" : "line" });
      });
      top = Z.y + headH + 30;
    }
    if (inRail) top = Math.max(top, ctx.rail.y);
    // Parallel points share a row, so they are read across; the rows run down to the floor.
    const n = Math.max(...sides.map((sd) => sd.items.length));
    const labelH = (r) => (criteria ? G.textHeight(criteria[r], critR.w / S.wide("title"), itemSize) : 0);
    // Measured on the lines the text frame will set (word by word), so a narrow side keeps its lines.
    const sideH = (t, i) => {
      const w = parts[i].w / S.wide("body");
      return G.textHeight(G.keepLines(plainText(t), w / itemSize, 99), w, itemSize);
    };
    const rowH = Array.from({ length: n }, (_, r) => Math.max(labelH(r), ...sides.map((sd, i) => (sd.items[r] ? sideH(sd.items[r], i) : 0))));
    const pitch = rowPitch(n, Math.max(...rowH), { y: top, bottom: floor }, state.groupGap, Math.max(112, Math.max(...rowH) + 72));
    // On the compact step each row starts one even gap under the one before (rows of two and three
    // lines alike). The gap opens up to a seventh of the body so four short rows reach the floor, and
    // never ends the rows higher than a pitch of the tallest row plus 48 pt would.
    const sum = rowH.reduce((a, b) => a + b, 0);
    const reach = n > 1 ? ((n - 1) * (Math.max(...rowH) + 48) + rowH[n - 1] - sum) / (n - 1) : 0;
    const gap = n > 1 ? Math.max(state.groupGap, Math.min(Math.max(48, (floor - Z.y) / 7, reach), (floor - top - sum) / (n - 1))) : 0;
    const ys = rowH.map((_, r) => (S.tok.tight ? top + rowH.slice(0, r).reduce((a, b) => a + b, 0) + r * gap : top + r * pitch));
    for (let r = 0; r < n; r++) {
      const y = ys[r];
      if (r > 0 && (S.deco.has("hairline-rule") || S.deco.has("column-hairlines"))) {
        out.push({ decor: true, kind: "rect", x: Z.x, y: y - Math.min(18, (y - ys[r - 1] - rowH[r - 1]) / 2), w: Z.w, h: 0.5, fill: "line" });
      }
      if (criteria) out.push({ kind: "text", paras: [{ kind: "text", text: criteria[r], inset: 0, h: labelH(r), gap: 0 }], size: itemSize, x: critR.x, y, w: critR.w, h: labelH(r), limit: floor, bold: true, rail: inRail });
      sides.forEach((sd, i) => {
        if (!sd.items[r]) return;
        const h = sideH(sd.items[r], i);
        out.push({ kind: "text", paras: [{ kind: "text", text: sd.items[r], inset: 0, h, gap: 0 }], size: itemSize, x: parts[i].x, y, w: parts[i].w, h, limit: Z.bottom });
      });
    }
    if (S.deco.has("column-hairlines")) out.push(columnHairline(S, parts[1], Z));
    return out;
  },

  process(ctx) {
    const { S, state } = ctx;
    const all = entries(sortItems(ctx.items).texts.flatMap(itemParas));
    // Points without a bold head after the steps are the slide's takeaways: they run under the
    // steps instead of being read as more steps (or dropped past the fifth).
    const headed = all.filter((e) => e.head);
    const loose = headed.length >= 2 && headed.length < all.length ? all.filter((e) => !e.head) : [];
    const ents = loose.length ? headed : all;
    if (ents.length < 2) return PLANS["text-column"](ctx);
    const notes = loose.length ? measureText(loose.flatMap((e) => [{ kind: "bullet", text: e.rest }, ...e.children.map((c) => ({ kind: "child", text: c }))]), ctx.Z.w, S, state) : null;
    const Z = notes ? { ...ctx.Z, bottom: ctx.Z.bottom - notes.h - state.blockGap } : ctx.Z;
    const withNotes = (placed) => (notes ? [...placed, { ...notes, x: Z.x, y: Z.bottom + state.blockGap, limit: ctx.Z.bottom }] : placed);
    const steps = ents.slice(0, 5).map((e, i) => {
      const o = ordinal(e.head || "", i);
      // Sub-points read as details of the step, joined with the step's text, without their "(1)".
      return { n: o.n, head: o.head || e.rest, rest: [o.head ? e.rest : "", ...e.children.map((c) => String(c).replace(/^\(\d+\)\s*/u, ""))].filter(Boolean).join(" · ") };
    });
    const numSize = S.sizes.display;
    const headSize = bodySize(S, state, "lead");
    const restSize = bodySize(S, state);
    const asRows = () => {
      if (S.tok.tight && Z.b - Z.a + 1 >= 10) {
        // On the compact step a row reads across: the numeral, the step's name, then what happens.
        const numW = S.grid.span(1, 1).w;
        const headR = region(S, Z.a + 1, Z.a + 3, Z.y, Z.bottom);
        const restX = headR.x + headR.w + S.grid.gutter;
        const korean = G.isKorean(steps.map((st) => st.head + st.rest).join(""));
        // The same readable measure as the stacked rows (S4.4; the gate counts spaces as characters). That
        // measure at body size leaves the body's right columns empty, so what happens is set a step up (lead)
        // when the rows still fit: the measure grows with the size and reaches across (spec-v2 Amendments 7).
        const at = (size) => {
          const restW = Math.min(Z.x + Z.w - restX, (korean ? 26 : 35) * size);
          const rows = steps.map((st) => {
            const hh = G.textHeight(st.head, headR.w, headSize);
            const rh = st.rest ? G.textHeight(st.rest, restW, size) : 0;
            return { num: st.n, head: st.head, rest: st.rest, hh, rh, h: Math.max(numSize * 1.15, hh, rh) };
          });
          const tallest = Math.max(...rows.map((r) => r.h));
          const pitch = rowPitch(rows.length, tallest, Z, state.groupGap, tallest + 48);
          rows.forEach((r, i) => { r.y = Z.y + i * pitch; });
          return { kind: "rows", rows, x: Z.x, numW, textX: headR.x, textW: headR.w, restX, restW, head: headSize, rest: size, numSize, pitch, rule: true,
            y: Z.y, h: (rows.length - 1) * pitch + rows[rows.length - 1].h, limit: Z.bottom };
        };
        const body = at(restSize);
        if ((Z.x + Z.w - (restX + body.restW)) / Z.w > 0.25) {
          const lead = at(S.sizes.lead);
          if (lead.y + lead.h <= Z.bottom + 0.5) return [lead];
        }
        return [body];
      }
      const numW = S.grid.span(1, 2).w;
      const textX = Z.x + numW + S.grid.gutter;
      // Across the full body a step's text keeps a readable measure (S4.4; the gate counts spaces and separators as characters).
      const korean = G.isKorean(steps.map((s) => s.head + s.rest).join(""));
      const textW = Math.min(Z.x + Z.w - textX, korean ? 26 * restSize : 35 * restSize);
      const rows = steps.map((s) => ({ num: s.n, head: s.head, rest: s.rest,
        h: Math.max(numSize * 1.15, G.textHeight(s.head, textW, headSize) + (s.rest ? 6 + G.textHeight(s.rest, textW, restSize) : 0)) }));
      const pitch = rowPitch(rows.length, Math.max(...rows.map((r) => r.h)), Z, state.groupGap, 160);
      rows.forEach((r, i) => { r.y = Z.y + i * pitch; });
      return [{ kind: "rows", rows, x: Z.x, numW, textX, textW, head: headSize, rest: restSize, numSize, pitch, rule: true, y: Z.y, h: (rows.length - 1) * pitch + rows[rows.length - 1].h, limit: Z.bottom }];
    };
    if (ctx.cls === "side") return withNotes(asRows());
    const slots = equalParts(S, Z, steps.length);
    const placedSteps = steps.map((s, i) => {
      const R = slots[i];
      const headH = G.textHeight(s.head, R.w, headSize);
      const restH = s.rest ? G.textHeight(s.rest, R.w, restSize) : 0;
      return { ...s, x: R.x, w: R.w, headH, restH };
    });
    const h = numSize * 1.1 + 18 + Math.max(...placedSteps.map((s) => s.headH + (s.restH ? 12 + s.restH : 0)));
    // Up to four steps whose columns stop high on the body run as rows down it instead.
    if (steps.length <= 4 && (Z.bottom - Z.y - h) / (Z.bottom - Z.y) > S.tok.cap) {
      const rows = asRows();
      if (rows[0].y + rows[0].h <= Z.bottom + 0.5) return withNotes(rows);
    }
    return withNotes([{ kind: "steps", steps: placedSteps, numSize, headSize, restSize, y: Z.y, h, limit: Z.bottom }]);
  },

  timeline(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const table = visuals.find((v) => v.type === "kpi-table");
    let events;
    if (table) events = (table.content.rows || []).map((r) => ({ date: plainText(r[0]), label: plainText(r[1] || ""), status: plainText(r.slice(2).join(" · ")) }));
    else events = entries(texts.flatMap(itemParas)).map((e) => ({ date: e.head, label: e.rest, status: e.children.join(" · ") }));
    events = events.slice(0, 6);
    if (!events.length) return PLANS["text-column"](ctx);
    const slots = equalParts(S, Z, events.length);
    const dateSize = bodySize(S, state, "lead");
    const labelSize = bodySize(S, state);
    // The axis runs under the tallest date at the top of the body; the room left under the whole
    // plan is shared out below (see the end of this plan).
    const dateH = Math.max(...events.map((e, i) => G.textHeight(e.date, slots[i].w, dateSize, 1.25)));
    const axisY = Math.round(Z.y + dateH + 18);
    const items = events.map((e, i) => {
      const R = slots[i];
      const labelH = G.textHeight(e.label, R.w, labelSize);
      const statusH = e.status ? 6 + G.textHeight(e.status, R.w, S.sizes.label, 1.3) : 0;
      return { ...e, x: R.x, w: R.w, labelH, statusH };
    });
    const below = Math.max(...items.map((e) => e.labelH + e.statusH));
    const cap = table && table.caption ? { kind: "caption", item: { content: table.caption }, x: Z.x, w: Z.w, h: captionHeight(table.caption, Z.w, S) } : null;
    const out = [{ kind: "timeline", events: items, axisY, dateSize, labelSize, x: Z.x, w: Z.w, y: axisY - dateH - 18, h: dateH + 18 + 18 + below, limit: Z.bottom }];
    if (cap) out.push({ ...cap, y: out[0].y + out[0].h + 18, limit: Z.bottom });
    // When a table carries the events, the bullets are the takeaway and run under the axis.
    if (table && texts.length) {
      const top = Math.max(...out.map((q) => q.y + q.h)) + state.blockGap;
      out.push(...stack(texts, { ...Z, y: top }, S, state).placed);
    }
    // Room past the density band is shared evenly: over the axis, between the axis and its takeaways,
    // and under them, so no one band holds it (an axis halfway down left the top third empty).
    const room = Z.bottom - contentBottom(out, Z.y);
    if (room / (Z.bottom - Z.y) > S.tok.cap) {
      // A single takeaway line stays with the axis it reads (a band over one line set it adrift), so the
      // pair moves together, the room shared over and under it (spec-v2 Amendments 8).
      const single = texts.flatMap(itemParas).length === 1;
      const blocks = out.length > (cap ? 2 : 1) && !single ? 3 : 2;
      const step = Math.floor(room / blocks);
      out.forEach((q, i) => {
        const dy = step * (i < (cap ? 2 : 1) || single ? 1 : 2);
        q.y += dy;
        if (q.kind === "timeline") q.axisY += dy;
        if (q.kind === "group") shiftGroup(q, dy);
      });
    }
    return out;
  },

  "matrix-2x2"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const table = visuals.find((v) => v.type === "kpi-table");
    const c = (table && table.content) || {};
    if (!table || (c.headers || []).length !== 3 || (c.rows || []).length !== 2) return PLANS["table-insight"](ctx);
    const [yName, xName] = String(plainText(c.headers[0])).split(/\s*[\\/]\s*/u);
    // The takeaways stand beside the quadrants in the last four columns (under the matrix on a
    // narrow body), so the matrix never drops them.
    const wide = texts.length && Z.b - Z.a + 1 >= 10;
    const M = wide ? region(S, Z.a, Z.b - 4, Z.y, Z.bottom) : Z;
    const notesH = texts.length && !wide ? stack(texts, Z, S, state).bottom - Z.y + state.blockGap : 0;
    const mBottom = M.bottom - notesH;
    const labelCols = ctx.cls === "side" || wide ? 1 : 2;
    const labels = region(S, M.a, M.a + labelCols - 1, M.y, mBottom);
    const grid = region(S, M.a + labelCols, M.b, M.y, mBottom);
    const capH = table.caption ? captionHeight(table.caption, grid.w, S) + 6 : 0;
    const headH = S.sizes.label * 1.4 + 12;
    const gap = S.grid.gutter;
    const top = grid.y + headH;
    const qh = (grid.bottom - capH - top - gap) / 2;
    const qw = (grid.w - gap) / 2;
    const pad = 18;
    // A cell is its item over its details: "포장재 단가 재협상 · 연 6억 원 · 즉시" sets the item as the
    // cell's head and each detail on a line under it.
    const head = bodySize(S, state, "lead");
    const detail = bodySize(S, state);
    const cells = [0, 1].flatMap((ri) => [0, 1].map((ci) => {
      const [first, ...rest] = plainText(c.rows[ri][ci + 1]).split(/\s+·\s+/u);
      const headH = G.textHeight(first, qw - pad * 2, head, 1.3);
      const details = rest.map((t) => ({ text: t, h: G.textHeight(t, qw - pad * 2, detail) }));
      return { head: first, headH, details, x: grid.x + ci * (qw + gap), y: top + ri * (qh + gap), w: qw, h: qh };
    }));
    const out = [{ kind: "matrix", cells, xHeads: [plainText(c.headers[1]), plainText(c.headers[2])], yHeads: [plainText(c.rows[0][0]), plainText(c.rows[1][0])],
      xName: xName || "", yName: yName || "", labels, grid, top, qw, qh, gap, pad, head, detail,
      caption: table.caption, x: M.x, y: M.y, w: M.w, h: grid.bottom - M.y, limit: Z.bottom }];
    if (texts.length) {
      const R = wide ? region(S, Z.b - 3, Z.b, Z.y, Z.bottom) : { ...Z, y: mBottom + state.blockGap };
      out.push(...stack(texts, R, S, state).placed);
    }
    return out;
  },

  quote(ctx) {
    const { S, state, Z } = ctx;
    const paras = sortItems(ctx.items).texts.flatMap(itemParas);
    const by = paras.find((p) => /^[—–-]\s*/u.test(plainText(p.text)));
    const said = paras.filter((p) => p !== by).map((p) => p.text).join(" ");
    const markW = S.grid.span(1, 1).w;
    const R = region(S, Math.min(Z.b, Z.a + 1), Math.max(Z.a + 1, Z.b - (ctx.cls === "side" ? 0 : 2)), Z.y + 24, Z.bottom);
    const size = S.sizes.title;
    const h = G.textHeight(plainText(said), R.w, size, 1.3);
    const blockH = h + (by ? 18 + S.sizes.label * 1.4 : 0);
    // Beside a side title the quote is the slide's display element: it sits in the middle of the
    // body, as a statement does, instead of at the top of an empty page.
    const y = ctx.cls === "side" ? Math.max(R.y, Math.round(Z.y + (Z.bottom - Z.y - blockH) / 2)) : R.y;
    return [{ kind: "quote", text: said, by: by ? plainText(by.text) : "", size, x: R.x, w: R.w, y, h: blockH, textH: h, markX: Z.x, markW, limit: Z.bottom }];
  },

  "image-split"(ctx) {
    const { visuals, texts } = sortItems(ctx.items);
    return visualWithText(ctx, visuals, texts, 7 / 12);
  },

  "figure-academic"(ctx) {
    const { visuals, texts } = sortItems(ctx.items);
    return visualWithText(ctx, visuals, texts, 8 / 12);
  },

  method(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const paras = texts.flatMap(itemParas);
    const formula = paras.filter((p) => p.kind === "text");
    const defs = paras.filter((p) => p.kind !== "text");
    if (!visuals.length && !formula.length) return PLANS["text-column"](ctx);
    const defsItem = defs.length ? [{ type: "body", content: { items: [] }, paras: defs }] : [];
    const out = [];
    const place = (R) => {
      if (visuals.length) out.push(...stack(visuals, R, S, state).placed);
      else {
        const size = S.sizes.title;
        const h = G.textHeight(plainText(formula.map((p) => p.text).join("\n")), R.w, size, 1.4);
        out.push({ kind: "text", paras: formula.map((p) => ({ ...p, inset: 0, gap: 0, h: G.textHeight(plainText(p.text), R.w, size, 1.4) })), size, x: R.x, w: R.w, y: R.y, h, limit: R.bottom, accent: true });
      }
    };
    if (!defsItem.length) { place(Z); return out; }
    const defsAt = (R) => textAt(defs, R, S, { ...state, itemGap: Math.max(state.itemGap, 12) });
    if (!visuals.length && Z.b - Z.a + 1 >= 8) {
      // The formula runs across the top and its terms in columns under it, instead of one line over an empty
      // column beside the terms (on every density step since spec-v2 Amendments 8; the compact step before).
      place(Z);
      const below = { ...Z, y: Math.max(...out.map((q) => q.y + q.h)) + state.blockGap };
      // Two columns of terms, else three (a formula beside its terms left its own column four-fifths empty).
      for (const n of [2, 3]) {
        const cols = defsInColumns(defs, below, n);
        if (cols.every((q) => q.y + q.h <= Z.bottom)) return [...out, ...cols];
      }
      out.length = 0;
    }
    // A wide figure (twice as wide as tall or more) set in half the body is drawn at a third of its column's
    // height: it runs across the top instead and its terms stand in two columns under it (Amendments 8).
    const size = visuals.length === 1 && visuals[0].type === "image" && visuals[0].imageSize;
    if (S.tok.tight && size && size.width / size.height >= 2 && Z.b - Z.a + 1 >= 8) {
      const cap = captionHeight(visuals[0].caption, Z.w, S);
      for (const [share, n] of [[0.5, 2], [0.5, 3], [0.42, 3], [0.36, 3]]) {
        const figH = Math.min(Math.round(Z.w * size.height / size.width) + cap, Math.round((Z.bottom - Z.y) * share));
        place({ ...Z, bottom: Z.y + figH });
        const cols = defsInColumns(defs, { ...Z, y: Z.y + figH + state.blockGap }, n);
        // The source strip closes the shortest column when it fits there.
        const last = cols.reduce((m, q) => (q.y + q.h < m.y + m.h ? q : m));
        const strip = ctx.strip ? stripPlacements(ctx.strip, { ...Z, x: last.x, w: last.w }, S) : null;
        const closes = strip && last.y + last.h * 1.1 + S.tok.block + strip.h <= Z.bottom;
        // A figure across the body is wider at 130 pt than it stands beside its terms at full column height.
        if (figH - cap >= 130 && cols.every((q) => q.y + q.h * 1.1 <= Z.bottom) && (!strip || closes)) {
          return [...out, ...cols.map((q) => ({ ...q, limit: Z.bottom - q.h * 0.1 })), ...(strip ? strip.placed.map((q) => ({ ...q, strip: true })) : [])];
        }
        out.length = 0;
      }
    }
    const [vR, full] = splitRegion(S, Z, 7 / 12);
    place(vR);
    // Beside a figure the terms' column closes with the source strip when it ends above the figure, and
    // terms that still leave 40 % of it empty are set a step up (spec-v2 Amendments 7).
    const strip = ctx.strip && visuals.length ? stripPlacements(ctx.strip, full, S) : null;
    const dR = strip ? { ...full, bottom: full.bottom - strip.h - S.tok.block } : full;
    let beside = defsAt(dR);
    if (visuals.length && (dR.bottom - (beside.y + beside.h)) / (dR.bottom - dR.y) > 0.4 && dR.w / S.sizes.lead >= 12) {
      const lead = textAt(defs, dR, S, { ...state, stepped: true, itemGap: Math.max(state.itemGap, 12) });
      if (lead.y + lead.h <= dR.bottom + 0.5) beside = lead;
    }
    if (strip && beside.y + beside.h <= dR.bottom + 0.5) out.push(...strip.placed.map((q) => ({ ...q, strip: true })));
    if (S.tok.tight && visuals.length && beside.y + beside.h > Z.bottom) {
      // Terms too long for five columns beside the figure: first half and half, the terms in one column
      // (the figure keeps six columns, so its own labels stay readable); then the figure takes five
      // columns and the terms run in two columns over the other seven.
      const [hR, tR6] = splitRegion(S, Z, 6 / 12);
      const strip6 = ctx.strip ? stripPlacements(ctx.strip, tR6, S) : null;
      const one = textAt(defs, strip6 ? { ...tR6, bottom: tR6.bottom - strip6.h - S.tok.block } : tR6, S, { ...state, itemGap: Math.max(state.itemGap, 12) });
      if (one.y + one.h * 1.1 <= (strip6 ? tR6.bottom - strip6.h - S.tok.block : Z.bottom)) {
        out.length = 0;
        place(hR);
        return [...out, { ...one, limit: Z.bottom - one.h * 0.1 }, ...(strip6 ? strip6.placed.map((q) => ({ ...q, strip: true })) : [])];
      }
      // The text estimate runs short of what a renderer sets for Latin, so the columns keep a tenth
      // of their height spare; the figure gives up a further column when five leave too little.
      for (const share of [5 / 12, 4 / 12]) {
        out.length = 0;
        const [fR, tR] = splitRegion(S, Z, share);
        const cols = defsInColumns(defs, tR);
        if (share < 5 / 12 || cols.every((q) => q.y + q.h * 1.1 <= Z.bottom)) {
          place(fR);
          // The spare tenth is part of each column's limit, so a slide that cannot keep it reads as
          // overflowing and takes a title that leaves the terms more room.
          return [...out, ...cols.map((q) => ({ ...q, limit: Z.bottom - q.h * 0.1 }))];
        }
      }
    }
    out.push(beside);
    return out;

    // The terms split between two columns at the entry that brings the first nearest half the height (three
    // columns: the cuts that keep the tallest column lowest).
    function defsInColumns(list, R, n = 2) {
      const ents = entries(list);
      const flat = (part) => part.flatMap((e) => [{ kind: e.kind === "section" ? "section" : "bullet", text: e.head ? `**${e.head}** ${e.rest}`.trim() : e.rest },
        ...e.children.map((c) => ({ kind: "child", text: c }))]);
      const cols = equalParts(S, R, n);
      const fits = (st) => cols.every((C) => C.y + measureText(flat(ents), C.w, S, st).h / n <= C.bottom);
      // Terms keep a 12 pt step between them when the columns hold it, else the item gap.
      const gapped = fits({ ...state, itemGap: Math.max(state.itemGap, 12) }) ? { ...state, itemGap: Math.max(state.itemGap, 12) } : state;
      const tall = (part) => (part.length ? measureText(flat(part), cols[0].w, S, gapped).h : 0);
      if (n === 3 && ents.length >= 3) {
        let best = null;
        for (let a = 1; a < ents.length - 1; a++) for (let b = a + 1; b < ents.length; b++) {
          const top = Math.max(tall(ents.slice(0, a)), tall(ents.slice(a, b)), tall(ents.slice(b)));
          if (!best || top < best.top) best = { a, b, top };
        }
        const parts = [ents.slice(0, best.a), ents.slice(best.a, best.b), ents.slice(best.b)];
        return cols.map((C, i) => textAt(flat(parts[i]), C, S, gapped));
      }
      let cut = 1;
      for (let k = 1; k < ents.length; k++) if (Math.abs(tall(ents.slice(0, k)) - tall(ents.slice(k))) < Math.abs(tall(ents.slice(0, cut)) - tall(ents.slice(cut)))) cut = k;
      const res = cols.map((C, i) => textAt(flat(i ? ents.slice(cut) : ents.slice(0, cut)), C, S, gapped));
      return res;
    }
  },

  "photo-grid"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const images = visuals.flatMap((v) => (v.type === "image-grid" ? (v.content.images || []).map((im) => ({ type: "image", content: im })) : v.type === "image" ? [v] : []));
    if (images.length < 2) return PLANS["image-split"](ctx);
    const textH = texts.length ? stack(texts, Z, S, state).bottom - Z.y + state.blockGap : 0;
    const parts = equalParts(S, { ...Z, bottom: Z.bottom - textH }, Math.min(3, images.length));
    const out = images.slice(0, 3).flatMap((im, i) => stack([im], parts[i], S, state).placed);
    if (texts.length) out.push(...stack(texts, { ...Z, y: Z.bottom - textH + state.blockGap }, S, state).placed);
    return out;
  },

  "figure-pair"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    if (visuals.length < 2) return PLANS["figure-academic"](ctx);
    const textH = texts.length ? stack(texts, Z, S, state).bottom - Z.y + state.blockGap : 0;
    const [l, r] = splitRegion(S, { ...Z, bottom: Z.bottom - textH }, 0.5);
    const out = [...stack([visuals[0]], l, S, state).placed, ...stack([visuals[1]], r, S, state).placed];
    if (texts.length) out.push(...stack(texts, { ...Z, y: Z.bottom - textH + state.blockGap }, S, state).placed);
    return out;
  },

  "asymmetric-feature"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const table = visuals.find((v) => v.type === "kpi-table" && (v.content.rows || []).length <= 1);
    if (table && !visuals.some((v) => v.type !== "kpi-table")) return PLANS["big-number"](ctx);
    return visualWithText(ctx, visuals, texts, 5 / 12);
  },

  // ── Closings (content slides whose title states the ask) ──
  "closing-ask"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const acts = visuals.length === 1 && visuals[0].type === "kpi-table" && !visuals[0].content.chart ? actionRows(visuals[0].content) : null;
    if (!acts) return visualWithText(ctx, visuals, texts, 8 / 12);
    const step = texts.length ? nextStep(ctx, texts, Z, (S.pack.display || {}).closing || "box") : null;
    // The rows share the room down to the step's own top, so the gap above the step is one of theirs.
    const R = { ...Z, bottom: step ? step.top + state.blockGap : Z.bottom };
    const rows = placeActions(ctx, acts, R, { last: Boolean(step) });
    // Rows that do not fit above the step keep the table.
    if (!rows) return visualWithText(ctx, visuals, texts, 8 / 12);
    return [...rows, ...(step ? step.placed : [])];
  },

  "closing-decision-box"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const out = [];
    let y = Z.y;
    const acts = visuals.length === 1 && visuals[0].type === "kpi-table" && !visuals[0].content.chart ? actionRows(visuals[0].content) : null;
    if (texts.length) {
      const pad = 18;
      const paras = texts.flatMap(itemParas).map((p) => ({ ...p, kind: "text" }));
      const m = measureText(paras, Z.w - pad * 2, S, state, { size: S.sizes.lead });
      out.push({ kind: "box", x: Z.x, y, w: Z.w, h: m.h + pad * 2, outline: S.deco.has("box-outline"), tint: !S.deco.has("box-outline"), limit: Z.bottom },
        { ...m, x: Z.x + pad, y: y + pad, bold: true, tinted: !S.deco.has("box-outline"), limit: Z.bottom });
      y += m.h + pad * 2 + state.blockGap;
    }
    // The items to decide on run as action rows under the box, down to the floor, when they fit.
    const rows = acts ? placeActions(ctx, acts, { ...Z, y }, {}) : null;
    if (rows) return [...out, ...rows];
    if (visuals.length) out.push(...stack(visuals, { ...Z, y }, S, state).placed);
    return out;
  },

  "closing-summary-list"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const [lR, bR] = splitRegion(S, Z, 8 / 12);
    const out = [];
    const paras = texts.flatMap(itemParas);
    if (visuals.length) {
      out.push(...stack(visuals, lR, S, state).placed);
      if (paras.length) {
        const pad = S.tok.pad;
        const m = measureText(paras, bR.w - pad * 2, S, state);
        out.push({ kind: "box", x: bR.x, y: bR.y, w: bR.w, h: m.h + pad * 2, surface: true, limit: Z.bottom }, { ...m, x: bR.x + pad, y: bR.y + pad, limit: Z.bottom });
      }
      return out;
    }
    // Numbered takeaways across the body, one row each, spread down to the floor.
    const size = bodySize(S, state, "lead");
    const heights = paras.map((p) => G.textHeight(plainText(p.text), Z.w - 48, size));
    const pitch = rowPitch(paras.length, Math.max(...heights, 1), Z, state.groupGap, Math.max(...heights, 1) + 48);
    paras.forEach((p, i) => {
      const y = Z.y + i * pitch;
      out.push({ kind: "text", paras: [{ kind: "text", text: String(i + 1), inset: 0, gap: 0, h: size * 1.3 }], size, x: Z.x, y, w: 36, h: size * 1.3, accent: true, limit: Z.bottom },
        { kind: "text", paras: [{ kind: "text", text: p.text, inset: 0, gap: 0, h: heights[i] }], size, x: Z.x + 48, y, w: Z.w - 48, h: heights[i], limit: Z.bottom });
    });
    return out;
  },

  "closing-contact-split"(ctx) {
    const { S, state, Z } = ctx;
    const { visuals, texts } = sortItems(ctx.items);
    const acts = visuals.length === 1 && visuals[0].type === "kpi-table" && !visuals[0].content.chart ? actionRows(visuals[0].content) : null;
    // The field starts where the rows' text ends (at most seven of twelve columns, at least five), so each
    // key stands near the row it belongs to instead of across an empty stretch (spec-v2 Amendments 8), as long
    // as the rows and the next step keep the sizes and line counts they have in seven columns.
    const n = Z.b - Z.a + 1;
    if (acts && !ctx.splitCols) {
      const at = (k) => PLANS["closing-contact-split"]({ ...ctx, splitCols: k });
      const sig = (plan) => JSON.stringify(plan.filter((q) => q.kind === "actions" || q.kind === "text").map((q) => (q.kind === "actions" ? [q.head, q.meta, q.keySize] : [q.size, Math.round(q.h)])));
      const ref = at(7);
      const need = Math.max(...acts.rows.map((r) => Math.max(G.textEms(r.head) * S.sizes.lead, G.textEms(r.meta) * S.sizes.label) * 1.06));
      for (const k of [5, 6]) {
        if (S.grid.span(Z.a, Z.a + Math.round(n * k / 12) - 1).w < need) continue;
        const plan = at(k);
        if (sig(plan) === sig(ref)) return plan;
      }
      return ref;
    }
    const cols = ctx.splitCols || 7;
    const [lR, fR] = splitRegion(S, Z, cols / 12);
    // The field bleeds off the right and bottom edges; what it holds sits inset from its edges.
    const fieldX = fR.x - S.grid.gutter / 2;
    const inset = 30;
    const F = { ...fR, x: fieldX + inset, w: fR.x + fR.w - fieldX - inset, y: Z.y + inset, bottom: Z.bottom };
    const field = { decor: true, kind: "rect", x: fieldX, y: Z.y, w: S.grid.W - fieldX, h: S.grid.H - Z.y, fill: "field", bleed: true };
    if (acts) {
      // The field is the ask: each row's key (the amount or the date) in line with its row, the rows
      // down the left columns. The next step or contact is a band of the field's colour on the body
      // floor across the left columns, meeting the field, so the two read as one L whose foot holds
      // the step and the field has no empty stretch under its last key.
      // A step at lead size that leaves the rows too little height drops to body size.
      // Amounts add up to the ask: their total closes the field. Beside the step's band it sits on
      // the band's floor, so the field below the keys ends in the sum, not in an empty stretch.
      // Dates do not add up: the field's foot then states how many items run over which span.
      const total = actionTotal(acts) || actionSpan(acts);
      // The band stops at the field's edge. Its text runs on across the field to the field's inset
      // only while the field's foot is empty; with a total there it keeps to the band's own columns.
      const stepW = total ? fieldX - lR.x : F.x + F.w - lR.x;
      for (const small of [false, true]) {
        const step = texts.length ? nextStep(ctx, texts, { ...lR, w: stepW }, "band", { small, panelW: fieldX - lR.x }) : null;
        const foot = step ? step.top + state.blockGap : null;
        const bottom = step ? foot - state.groupGap : Z.bottom;
        const totalH = total ? G.textHeight(total, F.w - inset, S.sizes.lead, 1.3) : 0;
        const totalY = total ? (step ? Z.bottom - totalH - 6 : bottom - totalH) : null;
        const rowsBottom = total && !step ? bottom - totalH - 24 : bottom;
        const rows = placeActions(ctx, acts, { ...lR, y: F.y, bottom: rowsBottom }, { keys: { ...F, bottom: rowsBottom } });
        if (rows) {
          const sum = total ? [{ decor: true, kind: "rect", x: F.x, y: totalY - 12, w: F.w, h: 0.75, fill: "on-field" },
            { kind: "text", paras: [{ kind: "text", text: total, gap: 0, h: totalH }], size: S.sizes.lead, bold: true, onField: true,
              x: F.x, y: totalY, w: F.w - inset, h: totalH, limit: Z.bottom }] : [];
          return [field, ...rows, ...sum, ...(step ? step.placed : [])];
        }
      }
    }
    const out = [field, ...stack(visuals.length ? visuals : texts, lR, S, state).placed];
    if (visuals.length && texts.length) {
      const m = measureText(texts.flatMap(itemParas), F.w, S, state);
      out.push({ ...m, x: F.x, y: F.y, onField: true, limit: Z.bottom });
    }
    return out;
  },
};

// Families that share another's plan.
PLANS["step-diagram"] = PLANS.process;
PLANS.statement = PLANS["text-column"];

/**
 * Headed points as rows: the head bold in the first three columns, the point beside it at lead
 * size when a dozen glyphs a line fit there, rows spread down to the floor with hairlines between.
 */
function headedRows(ctx, ents) {
  const { S, state, Z } = ctx;
  const headR = region(S, Z.a, Z.a + 2, Z.y, Z.bottom);
  const textR = region(S, Z.a + 3, Z.b, Z.y, Z.bottom);
  const lead = bodySize(S, state, "lead");
  const body = bodySize(S, state);
  const rowsAt = (z) => ents.map((e) => ({ head: e.head, text: e.rest, headH: G.textHeight(e.head, headR.w, z),
    textH: G.textHeight(plainText(e.rest), textR.w, z) })).map((r) => ({ ...r, h: Math.max(r.headH, r.textH) }));
  let size = S.tok.tight ? body : lead;
  let rows = rowsAt(size);
  if (rows.reduce((a, r) => a + r.h, 0) + (rows.length - 1) * state.groupGap > Z.bottom - Z.y) { size = body; rows = rowsAt(body); }
  const pitch = rowPitch(rows.length, Math.max(...rows.map((r) => r.h)), Z, state.groupGap, Math.max(...rows.map((r) => r.h)) + 96);
  rows.forEach((r, i) => { r.y = Z.y + i * pitch; });
  const last = rows[rows.length - 1];
  return [{ kind: "headed", rows, size, headX: headR.x, headW: headR.w, textX: textR.x, textW: textR.w, pitch,
    x: Z.x, w: Z.w, y: Z.y, h: last.y + last.h - Z.y, limit: Z.bottom }];
}

/** Value rows: each KPI as one row across the body, value first. */
function figureRows(cards, Z, S, state, spread = null) {
  const n = cards.length;
  const longest = Math.max(...cards.map((c) => S.ems(plainText(c.value), "numeral")));
  const room = (Z.bottom - Z.y - (n - 1) * 24) / n;
  // At most title size (two steps above the body); the value column is as wide as the widest value.
  const value = [S.sizes.title, S.sizes.lead, S.sizes.body].find((v) => longest * v * 1.15 <= Z.w * 0.5 && v * 1.15 <= room) || S.sizes.body;
  const valueW = Math.min(Math.round(Z.w * 0.5), Math.max(Math.round(Z.w * 0.3), Math.ceil(longest * value * 1.15)));
  const labelX = Z.x + valueW + S.grid.gutter;
  const labelW = Z.x + Z.w - labelX;
  // On the compact step the label is set bold at body size, its basis under it at label size.
  const labelSize = S.tok.tight ? S.sizes.body : bodySize(S, state, "lead");
  const noteSize = S.tok.tight ? S.sizes.label : bodySize(S, { ...state, stepped: false });
  const heights = cards.map((c) => Math.max(value * 1.15, G.textHeight(plainText(c.label), labelW, labelSize)
    + (c.note ? 4 + G.textHeight(plainText(c.note), labelW, noteSize) : 0)));
  // Values run down to the floor, the rows evenly apart (at most `spread` apart beyond the tallest row).
  const pitch = rowPitch(n, Math.max(...heights), Z, S.tok.tight ? state.groupGap : 24, spread == null ? 200 : Math.max(...heights) + spread);
  const rows = cards.map((c, i) => ({ value: plainText(c.value), label: plainText(c.label), note: c.note ? plainText(c.note) : "", y: Z.y + i * pitch }));
  return { kind: "figrows", rows, x: Z.x, w: Z.w, valueW, labelX, labelW, value, labelSize, noteSize, pitch, y: Z.y, h: (n - 1) * pitch + heights[n - 1], limit: Z.bottom };
}

/**
 * A big-number slide as a data panel: the panel takes seven of twelve columns beside a top or bottom
 * title (five of eight beside a rail) down to the zone's floor. With two to four figures (a KPI table
 * whose second body row gives each figure's basis) the panel holds one row per figure: the value at
 * title size, its label and its basis beside it. One figure is set at title size with its label on a
 * panel as tall as they are. The
 * evidence stands beside the panel as notes. The pack's display device sets the panel: the field, the
 * accent tint, or the surface inside an ink outline. The panel stays under half the page, so it reads
 * as the figures' ground and not as the page's. A number is never set above title size (S4.7).
 */
function numberPanel(ctx, table, texts) {
  const { S, state, Z } = ctx;
  const c = table.content || {};
  const cards = shared().kpiCards(c).slice(0, 6).filter((k) => plainText(k.value));
  const device = S.pack.display.number;
  const [pR, eR] = texts.length ? splitRegion(S, Z, ctx.cls === "side" ? 5 / 8 : 7 / 12) : [Z, null];
  const pad = Math.max(18, S.tok.pad);
  const inner = pR.w - pad * 2;
  const panelH = pR.bottom - pR.y;
  const role = device === "field" ? { fill: "field", number: "on-field", label: "on-field", note: "on-field" }
    : device === "tint" ? { fill: "accent-tint", number: "accent", label: "ink", note: "ink" }
      : { fill: "surface", line: "ink", number: "accent", label: "ink", note: "ink-muted" };
  const out = [{ kind: "panel", x: pR.x, y: pR.y, w: pR.w, h: panelH, fill: role.fill, line: role.line, limit: Z.bottom }];
  const capH = table.caption ? captionHeight(table.caption, inner, S) + 6 : 0;
  if (cards.length >= 2 || (cards[0] && cards[0].note)) {
    // One row per figure, rows spread over the panel, the caption at the panel's foot.
    const R = { x: pR.x + pad, w: inner, y: pR.y + pad, bottom: pR.bottom - pad - capH, a: pR.a, b: pR.b };
    const rows = figureRows(cards, R, S, state);
    out.push({ ...rows, colour: role.number, labelColour: role.label, noteColour: role.note });
    if (table.caption) out.push({ kind: "caption", item: { content: table.caption }, x: R.x, y: pR.bottom - pad - capH + 6, w: inner, h: capH - 6, role: role.label, limit: Z.bottom });
  } else {
    const value = plainText((cards[0] || {}).value || ((c.rows || [])[0] || [])[0] || "");
    const label = plainText((cards[0] || {}).label || (c.headers || [])[0] || "");
    const labelSize = bodySize(S, { ...state, stepped: false }, "lead");
    const size = [S.sizes.title, S.sizes.lead].find((v) => S.ems(value, "numeral") * v * 1.04 <= inner) || S.sizes.body;
    const labelH = label ? G.textHeight(label, inner, labelSize) : 0;
    const blockH = size * 1.15 + (label ? 12 + labelH : 0) + capH;
    // One figure at title size: the panel hugs it instead of standing as an empty field.
    out[0].h = Math.min(panelH, Math.round(blockH + pad * 2));
    const y = Math.round(pR.y + pad);
    out.push({ kind: "number", value, label, size, labelSize, x: pR.x + pad, y, w: inner, h: blockH - capH, colour: role.number, labelColour: role.label, limit: Z.bottom });
    if (table.caption) out.push({ kind: "caption", item: { content: table.caption }, x: pR.x + pad, y: y + blockH - capH + 6, w: inner, h: capH - 6, role: role.label, limit: Z.bottom });
  }
  if (eR) {
    const R = region(S, eR.a, eR.b, pR.y, pR.bottom);
    // The evidence reads as notes on the figures: plain lines, no list markers.
    const paras = texts.flatMap(itemParas).map((q) => ({ ...q, kind: q.kind === "section" ? "section" : "text" }));
    const labelSize = bodySize(S, { ...state, stepped: false }, "lead");
    const evidence = R.w >= 12 * labelSize * 1.1 ? labelSize : bodySize(S, { ...state, stepped: false });
    let m = measureText(paras, R.w, S, { ...state, itemGap: Math.max(state.itemGap, 12) }, { size: evidence });
    if (m.h > panelH) m = measureText(paras, R.w, S, state);
    out.push({ ...m, x: R.x, y: Math.round(pR.y + Math.max(0, (panelH - m.h) / 2)), limit: Z.bottom });
  }
  return out;
}

// A cell that is an amount: digits, an optional Korean unit word, an optional currency or percent.
const AMOUNT = /^(\d[\d,.]*)\s*([조억만천]*)\s*(원|달러|USD|EUR|KRW|%)?$/u;
const WHEN = /기한|시점|일정|날짜|마감|언제|when|date|due|deadline/iu;

/**
 * A closing's table read as action rows. The key is the column of amounts in one unit (they add up
 * to the ask), else the column headed as a date or deadline, else the last column; the row's first
 * cell is what is asked or done, the other cells (owner, timing) its detail.
 */
function actionRows(content) {
  const headers = (content.headers || []).map((h) => plainText(h));
  // A totals row is not an action: the ask line (or the field's total) carries the sum.
  const rows = (content.rows || []).map((r) => r.map((cell) => plainText(cell).trim()))
    .filter((r, i, all) => !(all.length > 1 && i === all.length - 1 && TOTALS.test(r[0] || "")));
  if (rows.length < 1 || rows.length > 5 || headers.length < 2) return null;
  // A bare number under a head that names its unit ("Budget (k USD)") carries that unit, as a key
  // and in a row's detail, so no amount stands on the page without it.
  const units = headers.map((h) => (/\(([^()]{1,12})\)\s*$/u.exec(h) || [])[1] || null);
  const withUnit = (cell, j) => (units[j] && /^\d[\d,.]*$/u.test(cell) ? joinUnit(cell, units[j]) : cell);
  let key = -1;
  let kind = "date";
  for (let j = 1; j < headers.length && key < 0; j++) {
    const m = rows.map((r) => AMOUNT.exec(r[j] || ""));
    if (m.every((x) => x && (x[2] || x[3])) && new Set(m.map((x) => `${x[2]}${x[3] || ""}`)).size === 1) {
      key = j;
      kind = "amount";
    } else if (units[j] && !/%/u.test(units[j]) && rows.every((r) => /^\d[\d,.]*$/u.test(r[j] || ""))) {
      key = j;
      kind = "amount";
    }
  }
  if (key < 0) key = headers.findIndex((h, j) => j > 0 && WHEN.test(h));
  const korean = G.isKorean(headers.join(" ") + rows.map((r) => r[0]).join(" "));
  if (key < 0) key = headers.length - 1;
  return {
    kind,
    rows: rows.map((r) => ({
      key: withUnit(r[key] || "", key),
      num: kind === "amount" ? /^\d[\d,.]*/u.exec(r[key])[0] : null,
      head: r[0] || "",
      // An empty or dash-only cell ("—") says nothing about the row and is left out of its detail.
      meta: r.map(withUnit).filter((cell, j) => j !== 0 && j !== key && cell && !/^[—–-]+$/u.test(cell)).join("  ·  "),
      value: kind === "amount" ? parseFloat(/^\d[\d,.]*/u.exec(r[key])[0].replace(/,/gu, "")) : null,
    })),
    korean,
  };
}

/** "30k USD", "14억 원", "12 L": a figure with its unit, joined the way the unit is written. */
function joinUnit(n, unit) {
  return /^(%|\p{Script=Hangul}|[kKMB](\s|$))/u.test(unit) ? `${n}${unit}` : `${n} ${unit}`;
}

/** "합계 30억 원": the rows' amounts summed and written in the unit the keys use, or null. */
function actionTotal(acts) {
  if (!acts || acts.kind !== "amount" || acts.rows.length < 2) return null;
  const sum = acts.rows.reduce((a, r) => a + r.value, 0);
  const digits = Math.max(...acts.rows.map((r) => ((/\.(\d+)/u.exec(r.num) || [, ""])[1]).length));
  const commas = acts.rows.some((r) => r.key.includes(","));
  const n = commas ? sum.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : sum.toFixed(digits);
  return `${acts.korean ? "합계" : "Total"} ${acts.rows[0].key.replace(/^\d[\d,.]*/u, n)}`;
}

/** "안건 4건 · 10월 셋째 주 – 11월 첫째 주": the count of date-keyed rows and their first and last date, or null. */
function actionSpan(acts) {
  if (!acts || acts.kind !== "date" || acts.rows.length < 2) return null;
  const first = acts.rows[0].key;
  const last = acts.rows[acts.rows.length - 1].key;
  const n = acts.rows.length;
  const count = acts.korean ? `안건 ${n}건` : `${n} items`;
  return first && last && first !== last ? `${count} · ${first} – ${last}` : count;
}

/**
 * Action rows down a region: the key large on the left (or in `o.keys`, a field beside the rows),
 * what is asked bold at lead size with its detail under it, and for amounts a bar as long as the
 * row's share of the total. The free height is shared out as equal gaps between the rows (and
 * before the next step when one follows), so the rows and the step fill the body together.
 */
function placeActions(ctx, acts, R, o = {}) {
  const { S, state } = ctx;
  const n = acts.rows.length;
  const keyR = o.keys || region(S, R.a, R.a + 2, R.y, R.bottom);
  const textR = o.keys ? R : region(S, R.a + 3, R.b, R.y, R.bottom);
  const longest = Math.max(...acts.rows.map((r) => S.ems(r.key, "numeral")));
  const sizes = [S.sizes.title, S.sizes.lead, S.sizes.body];
  const total = acts.kind === "amount" ? acts.rows.reduce((a, r) => a + r.value, 0) : 0;
  const gaps = o.last ? n : Math.max(1, n - 1);
  // At lead size first; rows that do not fit step down (lead to body, body to label), then the
  // key steps down the ramp until the rows fit.
  const fit = (step) => {
    const fitting = sizes.filter((v) => v && longest * v * 1.04 <= keyR.w);
    const keySize = fitting[Math.min(step, fitting.length - 1)] || S.sizes.body;
    const head = step ? S.sizes.body : S.sizes.lead;
    const meta = step ? S.sizes.label : S.sizes.body;
    const rows = acts.rows.map((r) => {
      const headH = G.textHeight(r.head, textR.w, head);
      const metaH = r.meta ? G.textHeight(r.meta, textR.w, meta) : 0;
      const bar = total > 0 ? (o.keys ? 14 : 18) : 0;
      // On the field the share bar runs under the key; beside the rows it runs under the text.
      const h = o.keys ? Math.max(keySize * 1.15 + bar, headH + (metaH ? 6 + metaH : 0))
        : Math.max(keySize * 1.15, headH + (metaH ? 6 + metaH : 0) + bar);
      return { ...r, headH, metaH, bar, h };
    });
    const sum = rows.reduce((a, r) => a + r.h, 0);
    return { keySize, head, meta, rows, room: R.bottom - R.y - sum - gaps * state.itemGap };
  };
  let chosen = fit(0);
  for (let step = 1; chosen.room < 0 && step <= 3; step++) chosen = fit(step);
  if (chosen.room < 0) return null;
  const { keySize, head, meta, rows } = chosen;
  const sum = rows.reduce((a, r) => a + r.h, 0);
  // Rows sit at most 96 pt apart (wider gaps read as separate blocks, and at reading sizes left one
  // empty band between two short rows); what is left over is shared above and below the rows.
  const gap = Math.max(state.itemGap, Math.min(96, (R.bottom - R.y - sum) / gaps));
  const spare = Math.max(0, R.bottom - R.y - sum - gap * gaps);
  let y = R.y + Math.round(spare / 2);
  for (const r of rows) { r.y = y; y += r.h + gap; }
  const h = rows[n - 1].y + rows[n - 1].h - R.y;
  return [{ kind: "actions", rows, keyX: keyR.x, keyW: keyR.w, keySize, onField: Boolean(o.keys), textX: textR.x, textW: textR.w,
    head, meta, total, gap, x: R.x, y: R.y, w: (o.keys ? keyR.x + keyR.w : R.x + R.w) - R.x, h, limit: R.bottom }];
}

/**
 * The next step of a closing, set at lead size on the body floor in the pack's closing device: a
 * band of the field across the region (or `o.panelW` of it, where a field drawn beside continues
 * it; text in the field's colour), a tinted or outlined box, a
 * rule above the line, or (field) a rule above the line inside a field already drawn. A label
 * before a colon is set bold. Returns the placements and its top.
 */
function nextStep(ctx, texts, R, device, o = {}) {
  const { S, state } = ctx;
  const lead = bodySize(S, { ...state, stepped: false }, "lead");
  const ruled = device === "rules" || device === "field";
  const pad = ruled ? 0 : Math.max(18, S.tok.pad);
  // Each point keeps its own line; a source line is a note at label size. Lines keep a readable
  // measure (S4.4) inside the band.
  const paras = texts.flatMap(itemParas).map((p) => plainText(p.text));
  const notes = paras.filter((t) => /^(출처|자료|sources?)\b/iu.test(t));
  const points = paras.filter((t) => !notes.includes(t)).map((t) => t.replace(/^([^:：]{1,16})([:：])\s*/u, "**$1$2** "));
  const size = points.length > 2 || o.small ? S.sizes.body : lead;
  const box = R.w - pad * 2;
  const inner = Math.min(box, (G.isKorean(paras.join("")) ? 34 : 70) * size * (G.isKorean(paras.join("")) ? 1 : 0.5));
  // A line that fits the box on one line takes the box's width; a longer one keeps the reading measure, set
  // as narrow as keeps its line count so its lines come out even and none ends on a lone word (Amendments 8).
  const widthOf = (t, z) => {
    if (G.lineCount(plainText(t), box, z) <= 1) return box;
    const n = G.lineCount(plainText(t), inner, z);
    let lo = inner / 2;
    let hi = inner;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (G.lineCount(plainText(t), mid, z) <= n) hi = mid; else lo = mid; }
    return Math.min(inner, Math.ceil(hi + 2 * z));
  };
  const items = [...points.map((t) => ({ text: t, size })), ...notes.map((t) => ({ text: t, size: S.sizes.label }))]
    .map((q) => { const w = widthOf(q.text, q.size); return { ...q, w, h: G.textHeight(plainText(q.text), w, q.size) }; });
  const th = items.reduce((a, q, i) => a + q.h + (i ? 6 : 0), 0);
  const top = ruled ? R.bottom - th - 18 : R.bottom - th - pad * 2;
  const placed = [];
  const outline = device === "box" && S.deco.has("box-outline");
  if (device === "band") placed.push({ kind: "panel", x: R.x, y: top, w: o.panelW || R.w, h: R.bottom - top, fill: "field", limit: R.bottom });
  else if (device === "box") placed.push({ kind: "panel", x: R.x, y: top, w: R.w, h: R.bottom - top, fill: outline ? null : "accent-tint", line: outline ? "ink" : null, limit: R.bottom });
  else placed.push({ decor: true, kind: "rect", x: R.x, y: top, w: R.w, h: 0.75, fill: "line" });
  let y = ruled ? top + 18 : top + pad;
  for (const q of items) {
    placed.push({ kind: "text", paras: [{ kind: "text", text: q.text, inset: 0, gap: 0, h: q.h }], size: q.size, x: R.x + pad, y, w: q.w, h: q.h,
      onField: device === "band" || device === "field", tinted: device === "box" && !outline, muted: q.size === S.sizes.label, limit: R.bottom });
    y += q.h + 6;
  }
  return { placed, top: top - state.blockGap };
}

// ── Draw ────────────────────────────────────────────────────────────────────

function drawPlaced(slide, S, p, ctx) {
  const A = shared();
  const c = (p.item && p.item.content) || {};
  if (p.kind === "group") { for (const q of p.parts) drawPlaced(slide, S, q, ctx); return; }
  if (p.kind === "rect") { packRect(slide, S, p, { fill: p.fill }); return; }
  if (p.kind === "panel") { packRect(slide, S, p, { fill: p.fill, line: p.line, lineWidth: 1, radius: S.pack.radius }); return; }
  if (p.kind === "actions") {
    const ink = S.colour(p.onField ? "on-field" : "accent");
    p.rows.forEach((r, i) => {
      if (i > 0) packRect(slide, S, { x: p.textX, y: r.y - p.gap / 2, w: p.textW, h: 0.75 }, { fill: "line" });
      packText(slide, S, r.key, { x: p.keyX, y: r.y, w: p.keyW, h: p.keySize * 1.15 }, { face: "numeral", size: p.keySize, colour: ink, lineSpacing: 1.15 });
      packText(slide, S, r.head, { x: p.textX, y: r.y, w: p.textW, h: r.headH }, { size: p.head, bold: true });
      if (r.meta) packText(slide, S, r.meta, { x: p.textX, y: r.y + r.headH + 6, w: p.textW, h: r.metaH }, { size: p.meta, colour: S.colour("ink-muted") });
      if (r.bar) {
        // The row's share of the ask: a bar on a full-width track, under the key on the field.
        const [bx, bw] = p.onField ? [p.keyX, p.keyW] : [p.textX, p.textW];
        const by = p.onField ? r.y + p.keySize * 1.15 + 8 : r.y + r.headH + (r.metaH ? 6 + r.metaH : 0) + 12;
        packRect(slide, S, { x: bx, y: by, w: bw, h: 6 }, { fill: p.onField ? "ink-muted" : "accent-tint" });
        packRect(slide, S, { x: bx, y: by, w: Math.max(4, (bw * r.value) / p.total), h: 6 }, { fill: p.onField ? "on-field" : "accent" });
      }
    });
    return;
  }
  if (p.kind === "box") {
    if (p.outline) packRect(slide, S, p, { line: "ink", lineWidth: 1 });
    else if (p.tint) packRect(slide, S, p, { fill: "accent-tint", radius: S.pack.radius });
    else surfaceRect(slide, S, p);
    return;
  }
  if (p.kind === "text") {
    let y = p.y;
    const ink = p.onField ? S.colour("on-field") : p.tinted ? S.colour("accent-deep") : S.colour("ink");
    const soft = p.onField ? S.colour("on-field") : S.colour("ink-muted");
    for (const para of p.paras) {
      y += para.gap;
      // The marker is a small dot centred on the first line: a shape, so no renderer swaps in a
      // symbol font for it and no checker reads it as a column of text.
      if (para.kind === "bullet") {
        const d = Math.max(4, Math.round(p.size * 0.28));
        const lineH = p.size * G.leading(para.text);
        packRect(slide, S, { x: p.x, y: y + (lineH - d) / 2, w: d, h: d }, { fill: p.onField ? "on-field" : "accent" });
      }
      packText(slide, S, para.kind === "section" ? para.text : runIn(para.text), { x: p.x + (para.inset || 0), y, w: p.w - (para.inset || 0), h: para.h }, {
        size: p.size, bold: p.bold || para.kind === "section",
        colour: p.accent ? S.colour("accent-deep") : para.kind === "child" || p.muted ? soft : ink,
      });
      y += para.h;
    }
    return;
  }
  if (p.kind === "callout") {
    packRect(slide, S, p, { fill: "accent-tint", radius: S.pack.radius });
    packText(slide, S, plainText(c), { x: p.x + p.pad, y: p.y + p.pad, w: p.w - p.pad * 2, h: p.h - p.pad * 2 },
      { size: p.size, bold: true, colour: S.colour("accent-deep") });
    return;
  }
  if (p.kind === "kpi") {
    p.cards.forEach((card, i) => {
      const x = p.x + i * (p.cardW + S.grid.gutter);
      surfaceRect(slide, S, { x, y: p.y, w: p.cardW, h: p.cardH });
      const inner = p.cardW - p.pad * 2;
      const valueH = p.value * 1.15;
      packText(slide, S, plainText(card.value), { x: x + p.pad, y: p.y + p.pad, w: inner, h: valueH },
        { face: "numeral", size: p.value, lineSpacing: 1.15, colour: S.colour(i === 0 ? "accent" : "ink") });
      packText(slide, S, plainText(card.label), { x: x + p.pad, y: p.y + p.pad + valueH + 6, w: inner, h: p.labelH },
        { size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.3 });
      if (card.note) packText(slide, S, plainText(card.note), { x: x + p.pad, y: p.y + p.pad + valueH + 6 + p.labelH + 6, w: inner, h: p.noteH },
        { size: p.noteSize, colour: S.colour("ink"), lineSpacing: 1.3 });
    });
    drawCaption(slide, S, p.item.caption, p.x, p.y + p.cardH + 6, p.w);
    return;
  }
  if (p.kind === "figrows") {
    p.rows.forEach((r, i) => {
      if (i > 0) packRect(slide, S, { x: p.x, y: r.y - 12, w: p.w, h: 0.75 }, { fill: p.colour === "on-field" ? "on-field" : "line" });
      packText(slide, S, r.value, { x: p.x, y: r.y, w: p.valueW, h: p.value * 1.15 },
        { face: "numeral", size: p.value, lineSpacing: 1.15, colour: S.colour(p.colour || (i === 0 ? "accent" : "ink")) });
      const lh = G.textHeight(r.label, p.labelW, p.labelSize);
      const nh = r.note ? G.textHeight(r.note, p.labelW, p.noteSize) : 0;
      // The label reads beside the value; the basis under the label.
      packText(slide, S, r.label, { x: p.labelX, y: r.y, w: p.labelW, h: lh }, { size: p.labelSize, colour: S.colour(p.labelColour || "ink"), bold: true });
      if (r.note) packText(slide, S, r.note, { x: p.labelX, y: r.y + lh + 4, w: p.labelW, h: nh }, { size: p.noteSize, colour: S.colour(p.noteColour || "ink-muted") });
    });
    return;
  }
  if (p.kind === "rows") {
    p.rows.forEach((r, i) => {
      const right = p.restX != null ? p.restX + p.restW : p.textX + p.textW;
      if (p.rule && i > 0) packRect(slide, S, { x: p.x, y: r.y - Math.min(12, (p.pitch - r.h) / 2), w: right - p.x, h: 0.75 }, { fill: "line" });
      const numSize = p.numSize || p.head;
      packText(slide, S, r.num, { x: p.x, y: r.y, w: p.numW, h: numSize * 1.15 }, { face: "numeral", size: numSize, colour: S.colour("accent"), lineSpacing: 1.15 });
      const hh = G.textHeight(r.head, p.textW, p.head);
      packText(slide, S, r.head, { x: p.textX, y: r.y, w: p.textW, h: hh }, { size: p.head, bold: true });
      // Beside the name (restX) or under it.
      if (r.rest && p.restX != null) packText(slide, S, r.rest, { x: p.restX, y: r.y, w: p.restW, h: G.textHeight(r.rest, p.restW, p.rest) }, { size: p.rest });
      else if (r.rest) packText(slide, S, r.rest, { x: p.textX, y: r.y + hh + 6, w: p.textW, h: G.textHeight(r.rest, p.textW, p.rest) }, { size: p.rest, colour: S.colour("ink-muted") });
    });
    return;
  }
  if (p.kind === "headed") {
    p.rows.forEach((r, i) => {
      if (i > 0) packRect(slide, S, { x: p.x, y: r.y - Math.min(12, (p.pitch - p.rows[i - 1].h) / 2), w: p.w, h: 0.75 }, { fill: "line" });
      packText(slide, S, r.head, { x: p.headX, y: r.y, w: p.headW, h: r.headH }, { size: p.size, bold: true, colour: S.colour("accent-deep") });
      packText(slide, S, r.text, { x: p.textX, y: r.y, w: p.textW, h: r.textH }, { size: p.size });
    });
    return;
  }
  if (p.kind === "steps") {
    p.steps.forEach((s) => {
      packText(slide, S, s.n, { x: s.x, y: p.y, w: s.w, h: p.numSize * 1.1 }, { face: "numeral", size: p.numSize, colour: S.colour("accent"), lineSpacing: 1.15 });
      const ruleY = p.y + p.numSize * 1.1 + 6;
      packRect(slide, S, { x: s.x, y: ruleY, w: s.w, h: 0.75 }, { fill: "line" });
      packText(slide, S, s.head, { x: s.x, y: ruleY + 12, w: s.w, h: s.headH }, { size: p.headSize, bold: true });
      if (s.rest) packText(slide, S, s.rest, { x: s.x, y: ruleY + 12 + s.headH + 12, w: s.w, h: s.restH }, { size: p.restSize, colour: S.colour("ink-muted") });
    });
    return;
  }
  if (p.kind === "timeline") {
    packRect(slide, S, { x: p.x, y: p.axisY, w: p.w, h: 1.5 }, { fill: "line" });
    p.events.forEach((e, i) => {
      packRect(slide, S, { x: e.x, y: p.axisY - 4, w: 9, h: 9 }, { fill: i === p.events.length - 1 ? "accent" : "ink-muted" });
      const dh = G.textHeight(e.date, e.w, p.dateSize, 1.25);
      packText(slide, S, e.date, { x: e.x, y: p.axisY - 18 - dh, w: e.w, h: dh }, { size: p.dateSize, bold: true, colour: S.colour("ink"), lineSpacing: 1.25 });
      packText(slide, S, e.label, { x: e.x, y: p.axisY + 18, w: e.w, h: e.labelH }, { size: p.labelSize });
      if (e.status) packText(slide, S, e.status, { x: e.x, y: p.axisY + 18 + e.labelH + 6, w: e.w, h: e.statusH - 6 }, { size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.3 });
    });
    return;
  }
  if (p.kind === "matrix") {
    const label = S.sizes.label;
    p.xHeads.forEach((t, i) => packText(slide, S, t, { x: p.grid.x + i * (p.qw + p.gap), y: p.grid.y, w: p.qw, h: label * 1.4 }, { size: label, bold: true, colour: S.colour("ink-muted"), lineSpacing: 1.3 }));
    p.yHeads.forEach((t, i) => packText(slide, S, t, { x: p.labels.x, y: p.top + i * (p.qh + p.gap), w: p.labels.w, h: label * 1.4 }, { size: label, bold: true, colour: S.colour("ink-muted"), lineSpacing: 1.3 }));
    const axis = [p.yName && `↑ ${p.yName}`, p.xName && `→ ${p.xName}`].filter(Boolean).join("   ");
    if (axis) {
      // The axis names sit at the foot of the label column, as tall as they wrap in it.
      const h = G.textHeight(axis, p.labels.w, label, 1.3);
      packText(slide, S, axis, { x: p.labels.x, y: p.top + 2 * p.qh + p.gap - h, w: p.labels.w, h }, { size: label, colour: S.colour("ink-muted"), lineSpacing: 1.3 });
    }
    p.cells.forEach((cell) => {
      packRect(slide, S, cell, { line: "line", lineWidth: 0.75 });
      const w = cell.w - p.pad * 2;
      // The item and its details stand in the middle of the quadrant, so a short cell reads as placed.
      const blockH = cell.headH + cell.details.reduce((a, d) => a + 4 + d.h, 0);
      let y = cell.y + Math.max(p.pad, Math.round((cell.h - blockH) / 2));
      packText(slide, S, cell.head, { x: cell.x + p.pad, y, w, h: cell.headH }, { size: p.head, bold: true, lineSpacing: 1.3 });
      y += cell.headH;
      for (const d of cell.details) {
        y += 4;
        packText(slide, S, d.text, { x: cell.x + p.pad, y, w, h: d.h }, { size: p.detail, colour: S.colour("ink-muted") });
        y += d.h;
      }
    });
    if (p.caption) drawCaption(slide, S, p.caption, p.grid.x, p.top + 2 * p.qh + p.gap + 6, p.grid.w);
    return;
  }
  if (p.kind === "quote") {
    packText(slide, S, "“", { x: p.markX, y: p.y - 6, w: p.markW, h: S.sizes.display * 1.1 }, { face: "display", size: S.sizes.display, colour: S.colour("accent"), lineSpacing: 1.15 });
    packText(slide, S, plainText(p.text).replace(/^[“"]|[”"]$/gu, ""), { x: p.x, y: p.y, w: p.w, h: p.textH }, { face: "title", size: p.size, lineSpacing: 1.3 });
    if (p.by) packText(slide, S, p.by, { x: p.x, y: p.y + p.textH + 18, w: p.w, h: S.sizes.label * 1.4 }, { size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.3 });
    return;
  }
  if (p.kind === "number") {
    packText(slide, S, p.value, { x: p.x, y: p.y, w: p.w, h: p.size * 1.1 }, { face: "numeral", size: p.size, colour: S.colour(p.colour || "accent"), lineSpacing: 1.15 });
    if (p.label) packText(slide, S, p.label, { x: p.x, y: p.y + p.size * 1.1 + 12, w: p.w, h: G.textHeight(p.label, p.w, p.labelSize) }, { size: p.labelSize, colour: S.colour(p.labelColour || "ink-muted") });
    return;
  }
  if (p.kind === "table") {
    drawPackTable(slide, S, c, p, ctx.title);
    drawCaption(slide, S, p.item.caption, p.x, p.y + p.tableH + 6, p.w);
    return;
  }
  if (p.kind === "chart") {
    drawChart(slide, S, c, p);
    drawCaption(slide, S, p.item.caption, p.x, p.y + p.h - p.cap + 6, p.w);
    return;
  }
  if (p.kind === "image") {
    const images = p.item.type === "image-grid" ? c.images || [] : [c];
    const h = p.h - p.cap;
    const cellW = (p.w - (images.length - 1) * S.grid.gutter) / Math.max(1, images.length);
    let bottom = p.y;
    images.forEach((image, i) => {
      const file = forGround(A.resolveImagePath(image.src, ctx.sourceDir), S);
      let fit = A.containBox(IN(p.x + i * (cellW + S.grid.gutter)), IN(p.y), IN(cellW), IN(h), A.readImageSize(file));
      const low = IN(p.y + h) - fit.h;
      if (p.beside != null && images.length === 1 && low * 72 <= p.beside) fit = { ...fit, y: low };
      slide.addImage({ path: file, ...fit, altText: image.caption || path.basename(image.src || file) });
      if (S.pack.image && S.pack.image.frame === "hairline") packRect(slide, S, { x: fit.x * 72, y: fit.y * 72, w: fit.w * 72, h: fit.h * 72 }, { line: "line", lineWidth: 0.5 });
      bottom = Math.max(bottom, (fit.y + fit.h) * 72);
    });
    // The caption binds to the picture as drawn: a letterboxed figure keeps its caption under it.
    drawCaption(slide, S, p.item.caption, p.x, bottom + 6, p.w);
    return;
  }
  if (p.kind === "caption") drawCaption(slide, S, p.item.content, p.x, p.y, p.w, p.role === "on-field" ? "on-field" : "ink-muted");
}

/**
 * A figure on a dark ground is drawn from its dark variant when the source folder has one beside it
 * (`flow.png` → `flow.dark.png`): a chart or diagram exported on white would stand as a white card.
 */
function forGround(file, S) {
  const c = (i) => parseInt(String(S.P.ground).replace("#", "").slice(i, i + 2), 16) / 255;
  if (0.2126 * c(0) + 0.7152 * c(2) + 0.0722 * c(4) >= 0.25) return file;
  const ext = path.extname(file);
  const dark = `${file.slice(0, file.length - ext.length)}.dark${ext}`;
  return require("fs").existsSync(dark) ? dark : file;
}

function drawCaption(slide, S, caption, x, y, w, role = "ink-muted") {
  if (!caption) return;
  const text = captionText(caption);
  packText(slide, S, text, { x, y, w, h: G.textHeight(text, w, S.sizes.label, 1.3) },
    { size: S.sizes.label, colour: S.colour(role), lineSpacing: 1.3 });
}

// Series names that are a reference for the measured one: a plan, target, budget, baseline, prior period.
const REFERENCE = /계획|목표|예산|전년|전기|기준|이전|기존|평균|plan|target|budget|baseline|benchmark|forecast|prior|previous|last year|average/iu;

/** A series name's period as one comparable number (year, then half, quarter or month), or null. */
function periodOf(name) {
  const t = plainText(name);
  const year = /(?:^|\D)((?:19|20)\d{2})(?!\d)/u.exec(t) || /(?:^|[^\d.])(\d{2})년/u.exec(t);
  const quarter = /\bQ([1-4])\b|\b([1-4])Q\b|([1-4])\s*분기/iu.exec(t);
  const half = /\bH([12])\b|([상하])반기/iu.exec(t);
  const month = /(?:^|\D)(1[0-2]|[1-9])월|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/iu.exec(t);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const within = quarter ? 3 * Number(quarter[1] || quarter[2] || quarter[3])
    : half ? 6 * (half[1] ? Number(half[1]) : half[2] === "상" ? 1 : 2)
      : month ? (month[1] ? Number(month[1]) : months.indexOf(month[2].slice(0, 3).toLowerCase()) + 1) : null;
  if (!year && within == null) return null;
  const y = year ? Number(year[1].length === 2 ? `20${year[1]}` : year[1]) : 0;
  return y * 100 + (within || 0);
}

/**
 * The series a chart highlights: the latest period when every series names one, else the one measured
 * series beside its plans, targets or prior periods, else the last series (where a comparison puts the
 * proposed or current one).
 */
function primarySeries(names) {
  const periods = names.map(periodOf);
  if (periods.every((v) => v != null) && new Set(periods).size === periods.length) return periods.indexOf(Math.max(...periods));
  const measured = names.map((n, i) => (REFERENCE.test(plainText(n)) ? -1 : i)).filter((i) => i >= 0);
  if (measured.length && measured.length < names.length) return measured[measured.length - 1];
  return names.length - 1;
}

/** A series name without its unit or case, so "Single feed (%)" and "single feed" are one series. */
function seriesKey(name) {
  return plainText(name).replace(/\s*[(（][^)）]*[)）]\s*$/u, "").trim().toLowerCase();
}

/**
 * A native chart in the pack's chart style: one hue per series, the accent on the deck's one highlighted
 * series (primarySeries), the others receding (accent-on-muted) or in the pack's other series hues.
 */
function drawChart(slide, S, c, p) {
  const P = S.P;
  const chart = S.pack.chart || {};
  const series = (c.headers || []).length - 1;
  const muted = mix(P["ink-muted"], P.ground, 0.45);
  let colours;
  if (series <= 1) {
    // One series is one hue (a per-point highlight would make the chart read as categories): the accent,
    // unless the deck shows the same series receding beside another, where it keeps that colour.
    const other = S.seriesRole && S.seriesRole.get(seriesKey((c.headers || [])[1])) === "other";
    const receding = chart.highlight === "accent-on-muted" ? muted : P.series.find((h) => String(h).toUpperCase() !== String(P.accent).toUpperCase()) || muted;
    colours = [other ? receding : P.accent];
  } else {
    const primary = primarySeries(c.headers.slice(1));
    const others = chart.highlight === "accent-on-muted" ? (series === 2 ? [muted] : P.series.slice(1, series).reverse())
      : P.series.filter((h) => String(h).toUpperCase() !== String(P.accent).toUpperCase());
    let k = 0;
    colours = Array.from({ length: series }, (_, i) => (i === primary ? P.accent : others[k++ % others.length]));
  }
  // Without a value axis, the top data label needs headroom inside the plot.
  const values = (c.rows || []).flatMap((r) => r.slice(1).map((v) => Number(plainText(v).replace(/[^\d.\-]/gu, "")))).filter(Number.isFinite);
  const top = values.length ? Math.max(...values) : 0;
  const style = {
    series: colours, ink: P.ink, ink_muted: P["ink-muted"], line: P.line,
    titleFont: S.faces.title.font, bodyFont: S.faces.body.font, labelSize: S.sizes.label,
    grid: chart.gridlines !== "none", valAxisHidden: chart.gridlines === "none" && chart.labels === "direct",
    ...(top > 0 && !(c.chart && ["pie", "doughnut"].includes(c.chart.type)) ? { valMax: niceCeil(top * 1.15) } : {}),
  };
  const bottom = p.y + p.h - p.cap;
  shared().renderChart(slide, c, { x: IN(p.x), y: IN(p.y), w: IN(p.w), h: IN(bottom - p.y) }, style, IN(bottom));
}

/** A round axis maximum at or above v (1, 2 or 5 times a power of ten). */
function niceCeil(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((x) => x >= v);
}

// A totals row's first cell; a word boundary after Hangul needs the lookahead (\b reads ASCII only).
const TOTALS = /^(합계|총계|소계|계|total|sum)(?![\p{L}\p{N}])/iu;

/** A table in the pack's table style: header fill, rules and banding from the pack, numbers right-aligned. */
function drawPackTable(slide, S, c, p, title) {
  const A = shared();
  const headers = c.headers || [];
  // Every row carries one cell per column, so a short source row cannot leave a ragged table.
  const rows = (c.rows || []).map((r) => headers.map((_, i) => (r[i] != null ? r[i] : "")));
  if (!headers.length) return;
  const t = S.pack.table || {};
  const numeric = A.numericColumns(headers, rows);
  const hair = { type: "solid", pt: 0.75, color: S.colour("line") };
  const heavy = (pt) => ({ type: "solid", pt, color: S.colour("ink") });
  const none = { type: "none" };
  const headerFill = t.header && t.header !== "none" ? S.colour(t.header) : null;
  const headerInk = S.colour(t["header-ink"] || (t.header === "field" ? "on-field" : "ink"));
  const lastIsTotal = rows.length > 1 && TOTALS.test(plainText(rows[rows.length - 1][0]));
  const titleText = plainText(title);
  const protagonist = t.protagonist && t.protagonist !== "none"
    ? rows.findIndex((r) => { const k = plainText(r[0]); return k.length >= 2 && titleText.includes(k); })
    : -1;
  // [top, right, bottom, left] for the header (ri = -1) and each data row.
  const border = (ri) => {
    const last = ri === rows.length - 1;
    switch (t.rules) {
      case "grid": return [hair, hair, hair, hair];
      case "booktabs": return [ri === -1 ? heavy(1) : none, none, ri === -1 ? heavy(0.5) : last ? heavy(1) : none, none];
      case "top-bottom": return [ri === -1 ? hair : none, none, last ? hair : ri === -1 ? hair : none, none];
      case "header-rule": return [none, none, ri === -1 ? heavy(2) : none, none];
      case "rows": return [none, none, hair, none];
      default: // header-and-totals
        return [last && lastIsTotal ? hair : none, none, ri === -1 ? hair : none, none];
    }
  };
  const cellMargin = [IN(6), IN(6), IN(6), IN(6)];
  // Cell text that wraps is broken at spaces here, as in body text (see G.keepLines).
  const keep = (text, ci, ri, size, role) => G.keepLines(text, ((p.widths[ci] || p.w) - 12) / S.wide(role) / size,
    Math.floor(((p.heights[ri + 1] || 0) - 12) / (size * 1.45) + 0.01));
  const tableRows = [headers.map((h, ci) => ({
    text: keep(plainText(h), ci, -1, p.header, "label"),
    options: { bold: true, color: headerInk, fontFace: S.faces.label.font, fontSize: p.header, align: numeric[ci] ? "right" : "left", valign: "middle",
      margin: cellMargin, border: border(-1), ...(headerFill ? { fill: { color: headerFill } } : {}) },
  }))];
  rows.forEach((r, ri) => {
    const total = lastIsTotal && ri === rows.length - 1 && t.totals === "bold";
    const band = t.banding && t.banding !== "none";
    tableRows.push(r.map((cell, ci) => A.linkedTableCell(typeof cell === "string" && !/\]\(/u.test(cell) ? keep(cell, ci, ri, p.data, "body") : cell, {
      color: S.colour("ink"), fontFace: S.faces.body.font, fontSize: p.data, bold: total,
      align: numeric[ci] ? "right" : "left", valign: "middle", margin: cellMargin, border: border(ri),
      ...(ri === protagonist ? { fill: { color: S.colour(t.protagonist) } } : band && ci === 0 ? { fill: { color: S.colour(t.banding) } } : {}),
    })));
  });
  slide.addTable(tableRows, {
    // The frame is as tall as its rows; without h the frame is declared 1in whatever the rows need.
    x: IN(p.x), y: IN(p.y), w: IN(p.w), h: IN(p.tableH), colW: p.widths.map(IN), rowH: p.heights.map(IN), autoPage: false,
  });
}

// ── Fill and treatment choice ───────────────────────────────────────────────

/** Bottom of the content, decoration excluded. */
function contentBottom(placed, top) {
  const counted = placed.filter((p) => !p.decor);
  return counted.length ? Math.max(...counted.map((p) => p.y + p.h)) : top;
}

function overflows(placed) {
  return placed.some((p) => !p.decor && p.limit != null && p.y + p.h > p.limit + 0.5);
}

/**
 * The zones of one treatment frame: body Z, the class and where the empty band is measured from.
 * Nothing is set beside a bottom title: a text block there stops the page reading as that treatment.
 * The rail under a side title is another matter: it carries the slide's supporting content (see railOf).
 */
function zonesOf(frame, S) {
  const t = frame.title;
  const cls = frame.id === "side-rail" ? "side" : frame.id === "bottom-anchor" ? "bottom" : "top";
  if (!frame.body) return { cls: "none" };
  const Z = region(S, frame.body.a, frame.body.b, frame.body.y, frame.body.bottom);
  return { cls, Z, bandTop: cls === "bottom" ? Z.y : Math.min(t.y + t.h, Z.y) };
}

/**
 * Lay a content slide out under one frame and, when the body leaves more than the density band
 * empty, try the pack's fill policies in order: larger type one ramp step, the next spacing step,
 * the visual taking the room. Content is never invented and decoration never fills space.
 */
// A line that names the slide's source or a note on its basis ("출처:", "주:", "Source:", "Note:").
const STRIP = /^(?:출처|자료|주|Sources?|Notes?)\s*[:：]/iu;

/**
 * The source and note lines of a content slide's text, taken out of its takeaways: they are set as a
 * strip at the foot of the body zone, at source size under a hairline, so the slide states where its
 * figures come from without a takeaway column spending its lines on it. Closings keep theirs in the
 * next step.
 */
function takeStrip(spec, items) {
  // A closing with a next step keeps its source there; a closing summary has no such line, so it takes the strip.
  if (G.VARIANTS.closing.includes(spec.family) && spec.family !== "closing-summary-list") return { items, lines: [] };
  const lines = [];
  const keep = (list) => (list || []).filter((it) => {
    if ((it.type === "bullet" || it.type === "text") && STRIP.test(plainText(it.text || "")) && !(it.children || []).length) { lines.push(it.text); return false; }
    return true;
  });
  const out = items.map((item) => {
    if (item.type === "body" && item.content && Array.isArray(item.content.items)) return { ...item, content: { ...item.content, items: keep(item.content.items) } };
    return item;
  }).filter((item) => !(item.type === "body" && item.content && Array.isArray(item.content.items) && !item.content.items.length));
  return { items: out, lines };
}

function stripPlacements(lines, Z, S) {
  const size = S.sizes.source;
  const paras = lines.map((t) => ({ kind: "text", text: t, inset: 0, gap: 2, h: G.textHeight(plainText(t), Z.w, size, 1.3) }));
  paras[0].gap = 0;
  const h = paras.reduce((a, q) => a + q.gap + q.h, 0);
  const y = Z.bottom - h;
  // A hairline sets the strip off where the pack draws hairlines; elsewhere the size and the muted
  // ink do (a rule in a pack without them adds a colour to the slide).
  return { h: h + 10, placed: [
    ...(S.deco.has("hairline-rule") ? [{ decor: true, kind: "rect", x: Z.x, y: y - 6, w: Z.w, h: 0.5, fill: "line" }] : []),
    { kind: "text", paras, size, x: Z.x, y, w: Z.w, h, muted: true, limit: Z.bottom },
  ] };
}

// Families that pair a visual with its takeaways: under a side title the takeaways may stand in the rail
// and the visual takes the body (a table opens its rows; how full the body ends up still decides the title).
const RAIL_TAKEAWAYS = new Set(["chart-insight", "full-chart", "table-insight", "figure-academic", "image-split",
  "kpi-row", "big-number", "kpi-over-chart", "dashboard-grid", "photo-grid", "figure-pair", "asymmetric-feature"]);
// A rail more empty than this, from the title down, costs the slide the side rail (spec-v2 Amendments 7).
const RAIL_EMPTY = 0.4;

/**
 * The rail under a side title: columns 1-4 from just under the title frame (which keeps a spare line for
 * a title that wraps once more than estimated) to the floor. It holds the slide's supporting content: the
 * source strip at its foot, the takeaways of a visual when they fit, a comparison's criteria labels level
 * with their rows.
 */
function railOf(frame, S) {
  const t = frame.title;
  const s = S.grid.span(1, 4);
  // `top` is where the rail's empty share is measured from: the title frame's foot, as the gate reads it.
  return { a: 1, b: 4, x: s.x, w: s.w, y: Math.ceil(t.y + t.h + S.tok.group), top: t.y + t.h, bottom: G.ZONE.floor };
}

/** The largest empty stretch of the rail under the title frame as a share of its height (rail placements only). */
function railBand(rail, placed) {
  let gap = 0;
  let cursor = rail.top;
  for (const q of placed.filter((p) => p.rail && !p.decor).sort((a, b) => a.y - b.y)) {
    gap = Math.max(gap, q.y - cursor);
    cursor = Math.max(cursor, q.y + q.h);
  }
  return Math.max(gap, rail.bottom - cursor) / Math.max(1, rail.bottom - rail.top);
}

function planSlide(spec, frame, S, items) {
  const z = zonesOf(frame, S);
  if (spec.lead && spec.family !== "summary-box-list") items = [{ type: "main-box", content: spec.lead }, ...items];
  if (z.cls === "none") return { placed: [], band: 0, applied: [], before: 0, z };
  const full = z.Z;
  const rail = z.cls === "side" ? railOf(frame, S) : null;
  const railPlaced = [];
  const taken = takeStrip(spec, items);
  // The source strip: at the rail's foot under a side title; else offered to a takeaway column beside a
  // visual, and across the body's foot when no column takes it.
  let lines = taken.lines;
  items = taken.items;
  if (lines.length && rail) {
    const strip = stripPlacements(lines, rail, S);
    railPlaced.push(...strip.placed.map((q) => ({ ...q, rail: true })));
    rail.bottom -= strip.h + S.tok.block;
    lines = [];
  }
  // A visual's takeaways stand in the rail when they fit there, a chart's values table under them; the
  // visual then takes the body. Takeaways that leave the rail more than RAIL_EMPTY empty at body size are
  // set a step up (lead) when they fit: the rail is a display column, the one place the compact step
  // sets text above body size.
  if (rail && RAIL_TAKEAWAYS.has(spec.family) && !spec.stacked) {
    const { texts, visuals } = sortItems(items);
    const paras = texts.filter((t) => t.type !== "main-box").flatMap(itemParas);
    // A table keeps its own height: its takeaways leave the body only when the table, its rows opened,
    // still fills the body to the density band.
    const fills = () => {
      // Figure rows and number panels spread to the floor; so do charts and pictures.
      if (["kpi-row", "big-number"].includes(spec.family) || visuals.some((v) => v.type !== "kpi-table" || (v.content || {}).chart)) return true;
      const alone = openRows(stack(visuals, full, S, { stepped: false, itemGap: S.tok.item, groupGap: S.tok.group, blockGap: S.tok.block }).placed, full, S);
      return (full.bottom - contentBottom(alone, full.y)) / (full.bottom - full.y) <= S.tok.cap;
    };
    if (visuals.length && paras.length && fills()) {
      const state = { stepped: false, itemGap: S.tok.item, groupGap: S.tok.group, blockGap: S.tok.block };
      const sets = [S.sizes.body, S.sizes.lead].map((size) => {
        const m = { ...measureText(paras, rail.w, S, state, { size }), x: rail.x, y: rail.y, limit: rail.bottom, rail: true };
        const values = S.tok.tight ? chartValues(visuals, rail, S, state, rail.y + m.h) : null;
        const set = [m, ...(values ? [{ ...values, rail: true }] : [])];
        return { set, fits: set.every((q) => q.y + q.h <= rail.bottom + 0.5), band: railBand({ ...rail, bottom: G.ZONE.floor }, [...set, ...railPlaced]) };
      }).filter((x) => x.fits);
      // Body size when it fills the rail; else whichever size leaves the rail least empty.
      const pick = sets.find((x) => x.band <= RAIL_EMPTY) || sets.reduce((a, b) => (b.band < a.band ? b : a), sets[0]);
      if (pick) {
        // Takeaways that still leave a quarter of the rail empty share that room between them, at most a
        // sixth of the rail a gap (spec-v2 Amendments 8): the rail reads as one column down to its source.
        const [m] = pick.set;
        const breaks = m.paras.filter((para, i) => i > 0 && para.kind !== "child");
        const room = rail.bottom - S.tok.block - (pick.set[pick.set.length - 1].y + pick.set[pick.set.length - 1].h);
        if (pick.band > 0.25 && pick.set.length === 1 && breaks.length && room > 0) {
          const per = Math.min(room / (breaks.length + 1), (G.ZONE.floor - rail.top) / 6);
          for (const para of breaks) para.gap += per;
          m.h += per * breaks.length;
        }
        railPlaced.push(...pick.set);
        items = items.filter((i) => !(isText(i) && i.type !== "main-box"));
      }
    }
  }
  // A sidebar note is the slide's supporting content: under a side title it stands in the rail, at lead size
  // when it fits there (spec-v2 Amendments 8).
  if (rail && spec.family === "sidebar-note") {
    const texts = sortItems(items).texts;
    const note = texts.find((t) => t.type === "main-box") || (texts.length > 1 ? texts[texts.length - 1] : null);
    if (note) {
      const state = { stepped: false, itemGap: S.tok.item, groupGap: S.tok.group, blockGap: S.tok.block };
      const paras = itemParas(note).map((p) => ({ ...p, kind: p.kind === "child" ? "child" : "text" }));
      const m = [S.sizes.lead, S.sizes.body].map((size) => ({ ...measureText(paras, rail.w, S, state, { size }), x: rail.x, y: rail.y, limit: rail.bottom, rail: true, note: true }))
        .find((q) => q.y + q.h <= rail.bottom + 0.5);
      if (m) {
        railPlaced.push(m);
        items = items.filter((i) => i !== note);
      }
    }
  }
  const across = lines.length ? stripPlacements(lines, full, S) : null;
  const tok = S.tok;
  const plan = (spec.stacked && PLANS[STACKS[spec.family]]) || PLANS[spec.family] || PLANS["text-column"];
  const state = { stepped: false, anchor: false, itemGap: tok.item, groupGap: tok.group, blockGap: tok.block };
  // Offer the strip to a column first; once a run leaves it, it runs across the foot and the body ends above it.
  let offer = Boolean(across);
  const zone = () => (across && !offer ? { ...full, bottom: full.bottom - across.h - S.tok.block } : full);
  // A later run (another fill state) that leaves the offered strip is refused like an overflow.
  const run = (settle = false) => {
    const ctx = { spec, S, state, Z: zone(), cls: z.cls, family: spec.family, items, rail, strip: offer ? lines : null,
      railValues: railPlaced.some((q) => q.item && q.item.values), railNote: railPlaced.some((q) => q.note) };
    const placed = plan(ctx);
    const lost = offer && !placed.some((q) => q.strip);
    if (lost && settle) {
      offer = false;
      return run();
    }
    return { placed, lost, bottom: contentBottom(placed.filter((q) => !q.rail), zone().y) };
  };
  const band = (o) => Math.max(0, Math.min(1, (zone().bottom - o.bottom) / Math.max(1, zone().bottom - z.bandTop)));
  let out = run(true);
  if (overflows(out.placed)) {
    // Too much for the body at the family's sizes: leads drop to body size and gaps to the item gap.
    Object.assign(state, { compact: true, groupGap: tok.item, blockGap: tok.group });
    out = run(true);
  }
  const before = band(out);
  const applied = [];
  if (before > tok.cap && items.length) {
    for (const policy of S.pack["fill-order"] || []) {
      if (band(out) <= tok.cap) break;
      const saved = { ...state };
      if (policy === "step-up") {
        if (!tok.stepUp) continue;
        state.stepped = true;
      } else if (policy === "distribute") {
        state.itemGap = G.stepGap(state.itemGap, 24);
        state.groupGap = G.stepGap(state.groupGap, 48);
        state.blockGap = G.stepGap(state.blockGap, 48);
      } else if (policy === "anchor-visual") {
        state.anchor = true;
      } else {
        continue;
      }
      if (JSON.stringify(saved) === JSON.stringify(state)) continue;
      const next = run();
      if (next.lost || overflows(next.placed)) Object.assign(state, saved);
      else {
        if (next.bottom > out.bottom + 0.5) applied.push(policy);
        out = next;
      }
    }
  }
  z.Z = zone();
  // A text column that stops short of the column beside it is filled by layout; one that still leaves more
  // than RAIL_EMPTY of the body empty makes this title unfit for the slide when another fits.
  const floor = full.bottom;
  let short = shortColumn([...out.placed, ...(across && !offer ? across.placed : [])], floor, S);
  // The fill starts a little under the line (0.35), so a column the gate reads a point or two emptier than the
  // estimate still holds.
  if (short.share > 0.35) {
    fillColumn(short, floor, S, state);
    short = shortColumn([...out.placed, ...(across && !offer ? across.placed : [])], floor, S);
  }
  // On a rail drawn in the field colour, what stands in it is set in the field's ink.
  const field = (frame.decor || []).some((d) => d.kind === "rail" && d.role === "field");
  const placed = [...out.placed, ...railPlaced, ...(across && !offer ? across.placed : [])].map((q) => (q.rail && field ? { ...q, onField: true } : q));
  const overflow = overflows(placed);
  const railEmpty = rail ? railBand({ ...rail, bottom: G.ZONE.floor }, placed) : 0;
  // A quote or statement beside a rail is a display slide: its rail holds the title alone by design.
  const display = ["quote", "statement"].includes(spec.family);
  return { ...out, placed, band: band(out), before, applied, z, overflow, rail: railEmpty, short: short.share,
    unfit: overflow || (railEmpty > RAIL_EMPTY && !display) || short.share > RAIL_EMPTY };
}

/** The frame of a treatment for this slide (a quote under a statement title says the quote). */
function frameFor(spec, treatment) {
  const ctx = treatment === "statement" && spec.statementText ? { ...spec.ctx, title: spec.statementText } : spec.ctx;
  return G.treatmentGeometry(treatment, ctx);
}

/**
 * Choose among the treatments the slide may take. The role default stays when its body fills to
 * the density band; otherwise every allowed treatment is laid out and scored by the empty band it
 * leaves, with a small cost for repeating the previous slide's title or one the deck already leans
 * on and a large one past about a third of the deck, so filling never collapses a deck into one look. The variance dial keeps the number of
 * distinct treatments under its maximum.
 */
// A bottom title is for a chart, a picture, a big number, a row of figures or a timeline axis that takes
// the zone above it (S2.5), not for a table.
const drawn = (spec) => ["big-number", "kpi-row", "timeline"].includes(spec.family) || (spec.items || []).some((i) => (i.type === "kpi-table" && (i.content || {}).chart) || i.type === "image" || i.type === "image-grid");

function chooseTreatment(spec, S, deck) {
  const options = spec.candidates && spec.candidates.length ? spec.candidates : [spec.treatment];
  const allowed = deck.used.size >= deck.max && options.some((t) => deck.used.has(t)) ? options.filter((t) => deck.used.has(t)) : options;
  const tries = allowed.map((t) => ({ t, plan: planSlide(spec, frameFor(spec, t), S, spec.items || []) }));
  // Titles that fit come first; a table goes under a bottom title only when nothing else fits it.
  const fit = tries.filter((x) => !x.plan.unfit);
  const proper = fit.filter((x) => x.t !== "bottom-anchor" || drawn(spec));
  // When every title leaves the slide unfit, the one that overflows least and leaves its rail or a column least
  // empty stands (an overflowing or empty-rail plan came first by order before).
  const badness = (x) => (x.plan.overflow ? 10 : 0) + Math.max(0, x.plan.rail - RAIL_EMPTY) + Math.max(0, (x.plan.short || 0) - RAIL_EMPTY);
  const pool = proper.length ? proper : fit.length ? fit : [...tries].sort((m, n) => badness(m) - badness(n));
  const first = pool[0];
  if (first.t === options[0] && first.plan.band <= S.tok.cap && first.t !== deck.prev && (deck.count[first.t] || 0) < deck.limit) return first;
  const cost = (x) => x.plan.band + (x.plan.band > S.tok.cap ? 0.15 : 0) + 0.07 * (deck.count[x.t] || 0) +
    (x.t === deck.prev ? 0.08 : 0) - (x.t === options[0] ? 0.03 : 0) + ((deck.count[x.t] || 0) >= deck.limit ? 1 : 0);
  const best = pool.reduce((b, x) => (cost(x) < cost(b) - 1e-9 ? x : b));
  // The role's own title is the pack's structure (spec-v2 Amendments 7): it stays unless another title
  // leaves at least 0.10 less of the body empty (0.15 when neither fills to the density band).
  // A bottom title the slide may not take (a table) hands the pack's structure to its next treatment in order.
  const ownT = options[0] === "bottom-anchor" && !drawn(spec) ? options.find((t) => t !== "bottom-anchor") : options[0];
  const own = pool.find((x) => x.t === ownT);
  const margin = best.plan.band > S.tok.cap ? 0.15 : 0.1;
  // A family the pack draws with its own title (`structure`) keeps it past the deck's share of that title.
  const pinned = (S.pack.structure || {})[spec.family] === ownT;
  if (own && own !== best && own.plan.band - best.plan.band < margin && (pinned || (deck.count[own.t] || 0) < deck.limit)) return own;
  return best;
}

/**
 * Fill alone can settle a deck on two titles. Variance 4 and up asks for three (S13.2) once a deck
 * has eight slides, so while it carries fewer, the slide that loses the least fill moves to a
 * treatment the deck has not used: one of its own candidates, never one that overflows or leaves
 * more than the density band (or what the slide already leaves) empty, and never the last slide of
 * a treatment.
 */
function spreadTreatments(choices, S, pack, slideCount) {
  const need = slideCount < 8 ? 0 : Math.min(pack.dials.variance <= 3 ? 1 : 3, pack.treatments.length, pack.dials.varianceMax);
  const lines = [];
  const used = () => new Set([...choices.values()].map((c) => c.t));
  while (used().size < need) {
    const have = used();
    const count = (t) => [...choices.values()].filter((c) => c.t === t).length;
    let best = null;
    for (const [spec, current] of choices) {
      if (count(current.t) < 2) continue;
      for (const t of spec.candidates || []) {
        if (have.has(t)) continue;
        const plan = planSlide(spec, frameFor(spec, t), S, spec.items || []);
        if (plan.unfit || plan.band > Math.max(S.tok.cap, current.plan.band) + 0.05) continue;
        const loss = plan.band - current.plan.band;
        if (!best || loss < best.loss) best = { spec, t, plan, loss };
      }
    }
    if (!best) break;
    choices.set(best.spec, { t: best.t, plan: best.plan });
    lines.push(`variety: slide ${best.spec.index + 1} drawn under ${best.t} so the deck carries ${used().size} title treatments`);
  }
  // No title zone on more than 40 % of the content slides (S15): a data slide (a table, chart or
  // figures under their takeaway) that fills no worse under another zone's treatment moves there,
  // the one that gains the most first. Agendas, sequences and definitions keep their own titles.
  const content = [...choices.keys()].filter((spec) => spec.kind === "content");
  const movable = (spec) => spec.role === "data" || spec.role === "data-takeaway";
  const cap = 0.4 * content.length;
  const zonesNow = () => {
    const zones = {};
    for (const spec of content) zones[ZONE_OF[choices.get(spec).t]] = (zones[ZONE_OF[choices.get(spec).t]] || 0) + 1;
    return zones;
  };
  // The data slide in zone `from` that fills best under a title of another zone with room.
  const moveOut = (from, zones, blocked) => {
    let best = null;
    for (const spec of content) {
      const current = choices.get(spec);
      if (ZONE_OF[current.t] !== from || !movable(spec)) continue;
      for (const t of spec.candidates || []) {
        const zone = ZONE_OF[t];
        if (zone === from || blocked.has(zone) || (zones[zone] || 0) + 1 > cap) continue;
        if (t === "bottom-anchor" && !drawn(spec)) continue;
        const inUse = new Set([...choices.values()].map((c) => c.t));
        if (!inUse.has(t) && inUse.size >= pack.dials.varianceMax) continue;
        const plan = planSlide(spec, frameFor(spec, t), S, spec.items || []);
        if (plan.unfit || plan.band > Math.max(S.tok.cap, current.plan.band)) continue;
        const gain = current.plan.band - plan.band;
        if (!best || gain > best.gain) best = { spec, t, plan, gain };
      }
    }
    return best;
  };
  const say = (m) => lines.push(`variety: slide ${m.spec.index + 1} drawn under ${m.t} so no title zone covers more than 40 % of the content slides`);
  for (let guard = 0; guard < content.length; guard++) {
    const zones = zonesNow();
    const [crowded, n] = Object.entries(zones).sort((a, b) => b[1] - a[1])[0] || [];
    if (!crowded || n <= cap) break;
    let best = moveOut(crowded, zones, new Set());
    if (!best) {
      // Every zone a crowded slide could take is full: move one of that zone's own data slides on
      // to a third zone first, when that makes room.
      for (const [full, m] of Object.entries(zones)) {
        if (full === crowded || m + 1 <= cap) continue;
        const first = moveOut(full, zones, new Set([crowded]));
        if (!first) continue;
        const saved = choices.get(first.spec);
        choices.set(first.spec, { t: first.t, plan: first.plan });
        best = moveOut(crowded, zonesNow(), new Set());
        if (best) { say(first); break; }
        choices.set(first.spec, saved);
      }
    }
    if (!best) break;
    choices.set(best.spec, { t: best.t, plan: best.plan });
    say(best);
  }
  // Composition variety (S15) counts title zone x column partition over the content slides,
  // closings excluded. While the deck has fewer distinct layouts than the check needs, a data slide
  // whose layout another slide shares moves to a title that gives a layout the deck lacks, when that
  // neither overflows nor leaves more than the density band (or what the slide already leaves).
  const counted = content.filter((spec) => !G.VARIANTS.closing.includes(spec.family));
  const layoutsNeeded = Math.min(5, Math.ceil(0.6 * counted.length));
  const layoutOf = (t, plan) => `${ZONE_OF[t]}/${partitionOf(plan, S)}`;
  // The check also fails a deck where one layout covers more than 40 % of those slides, so while
  // one does, a slide of that layout moves to a title that gives a layout still under the share.
  const shareCap = 0.4 * counted.length;
  for (let guard = 0; guard < counted.length; guard++) {
    const keys = {};
    for (const spec of counted) { const c = choices.get(spec); const k = layoutOf(c.t, c.plan); keys[k] = (keys[k] || 0) + 1; }
    const [topKey, topN] = Object.entries(keys).sort((a, b) => b[1] - a[1])[0] || [];
    const short = Object.keys(keys).length < layoutsNeeded;
    const crowded = topN > shareCap;
    if (!short && !crowded) break;
    let best = null;
    for (const spec of counted) {
      const current = choices.get(spec);
      const from = layoutOf(current.t, current.plan);
      if (!movable(spec) || keys[from] < 2 || (!short && from !== topKey)) continue;
      for (const t of spec.candidates || []) {
        if (t === current.t || (t === "bottom-anchor" && !drawn(spec))) continue;
        const inUse = new Set([...choices.values()].map((c) => c.t));
        if (!inUse.has(t) && inUse.size >= pack.dials.varianceMax) continue;
        const plan = planSlide(spec, frameFor(spec, t), S, spec.items || []);
        const to = layoutOf(t, plan);
        if (plan.unfit || plan.band > Math.max(S.tok.cap, current.plan.band) || to === from) continue;
        // A move that adds a layout comes first; else one that relieves the crowded layout.
        if (short ? keys[to] : (keys[to] || 0) + 1 > shareCap) continue;
        const loss = plan.band - current.plan.band + (from === topKey && crowded ? -1 : 0);
        if (!best || loss < best.loss) best = { spec, t, plan, loss, added: !keys[to] };
      }
    }
    if (!best) {
      // No title gives a new layout: a table or chart slide may stack its takeaways under the visual
      // across the body (the composition of the ledger-table and full-chart families) instead.
      for (const spec of counted) {
        const current = choices.get(spec);
        const from = layoutOf(current.t, current.plan);
        if (!STACKS[spec.family] || spec.stacked || keys[from] < 2 || (!short && from !== topKey)) continue;
        const stacked = { ...spec, stacked: true };
        for (const t of [current.t, ...(spec.candidates || []).filter((c) => c !== current.t)]) {
          if (t === "bottom-anchor" && !drawn(spec)) continue;
          const plan = planSlide(stacked, frameFor(spec, t), S, spec.items || []);
          const to = layoutOf(t, plan);
          if (plan.unfit || plan.band > Math.max(S.tok.cap, current.plan.band) || to === from) continue;
          if (short ? keys[to] : (keys[to] || 0) + 1 > shareCap) continue;
          const loss = plan.band - current.plan.band;
          if (!best || loss < best.loss) best = { spec, t, plan, loss, added: !keys[to], stacked: true };
        }
      }
    }
    if (!best) break;
    if (best.stacked) best.spec.stacked = true;
    choices.set(best.spec, { t: best.t, plan: best.plan });
    lines.push(best.added ? `variety: slide ${best.spec.index + 1} drawn under ${best.t} so the deck carries ${Object.keys(keys).length + 1} layouts`
      : `variety: slide ${best.spec.index + 1} drawn under ${best.t} so no layout covers more than 40 % of the content slides`);
  }
  return lines;
}

/**
 * The boxes a placement draws as the composition check reads them from the page: text frames,
 * tables, charts and pictures, and filled surfaces that hold text (cards). Rules, dots and outlines
 * are decoration there and are left out.
 */
function drawnBoxes(p, S) {
  const B = (x, y, w, h, card = false) => ({ x, y, w, h, card });
  const filled = S.pack.edge !== "border";
  switch (p.kind) {
    case "group": return p.parts.flatMap((q) => drawnBoxes(q, S));
    case "text": {
      let y = p.y;
      return p.paras.map((para) => { y += para.gap || 0; const box = B(p.x + (para.inset || 0), y, p.w - (para.inset || 0), para.h); y += para.h; return box; });
    }
    case "callout": return [B(p.x, p.y, p.w, p.h, true)];
    case "box": return p.outline || (!p.tint && !filled) ? [] : [B(p.x, p.y, p.w, p.h, true)];
    case "panel": return p.fill && p.h >= 40 ? [B(p.x, p.y, p.w, p.h, true)] : [];
    case "kpi": return p.cards.flatMap((card, i) => {
      const x = p.x + i * (p.cardW + S.grid.gutter);
      if (filled) return [B(x, p.y, p.cardW, p.cardH, true)];
      const y = p.y + p.pad + p.value * 1.15 + 6;
      return [B(x + p.pad, p.y + p.pad, p.cardW - p.pad * 2, p.value * 1.15), B(x + p.pad, y, p.cardW - p.pad * 2, p.labelH)];
    });
    case "figrows": return p.rows.flatMap((r) => [B(p.x, r.y, p.valueW, p.value * 1.15), B(p.labelX, r.y, p.labelW, p.labelSize * 1.4)]);
    case "rows": return p.rows.flatMap((r) => [B(p.x, r.y, p.numW, (p.numSize || p.head) * 1.15), B(p.textX, r.y, p.textW, p.restX != null ? r.hh : r.h),
      ...(p.restX != null && r.rest ? [B(p.restX, r.y, p.restW, r.rh)] : [])]);
    case "headed": return p.rows.flatMap((r) => [B(p.headX, r.y, p.headW, r.headH), B(p.textX, r.y, p.textW, r.textH)]);
    case "steps": return p.steps.flatMap((st) => [B(st.x, p.y, st.w, p.numSize * 1.1), B(st.x, p.y + p.numSize * 1.1 + 18, st.w, st.headH)]);
    case "timeline": return p.events.flatMap((e) => [B(e.x, p.axisY - 18 - p.dateSize * 1.25, e.w, p.dateSize * 1.25), B(e.x, p.axisY + 18, e.w, e.labelH)]);
    case "actions": return p.rows.flatMap((r) => [B(p.keyX, r.y, p.keyW, p.keySize * 1.15), B(p.textX, r.y, p.textW, r.headH)]);
    case "matrix": return [...p.cells.map((c) => B(c.x + p.pad, c.y + p.pad, c.w - p.pad * 2, c.headH)),
      ...p.xHeads.map((_, i) => B(p.grid.x + i * (p.qw + p.gap), p.grid.y, p.qw, 16)),
      ...p.yHeads.map((_, i) => B(p.labels.x, p.top + i * (p.qh + p.gap), p.labels.w, 16))];
    case "quote": return [B(p.x, p.y, p.w, p.h)];
    case "number": return [B(p.x, p.y, p.w, p.h)];
    // A chart's caption is its own frame under the plot, as the check reads it.
    case "chart": return p.cap ? [B(p.x, p.y, p.w, p.h - p.cap), B(p.x, p.y + p.h - p.cap + 6, p.w, p.cap - 6)] : [B(p.x, p.y, p.w, p.h)];
    case "image": {
      // A single picture is drawn contained in its box (on the box floor beside a taller takeaway column),
      // its caption under it: the check reads those two frames.
      const size = p.item && p.item.type === "image" && p.item.imageSize;
      if (!size) return [B(p.x, p.y, p.w, p.h)];
      const fit = shared().containBox(p.x, p.y, p.w, p.h - p.cap, size);
      const low = p.y + p.h - p.cap - fit.h;
      if (p.beside != null && low <= p.beside) fit.y = low;
      return [B(fit.x, fit.y, fit.w, fit.h), ...(p.cap ? [B(p.x, fit.y + fit.h + 6, p.w, p.cap - 6)] : [])];
    }
    case "table": case "caption": return [B(p.x, p.y, p.w, p.h)];
    default: return p.x != null && p.w ? [B(p.x, p.y, p.w, p.h || 0)] : [];
  }
}

/**
 * The column partition a plan draws, read the way the composition check reads the page (S15):
 * boxes inside a card count as the card; boxes narrower than 70 % of the body are grouped into
 * columns by overlapping x-extent (half the narrower box joins, and a box that joins two columns
 * merges them); two or more columns sharing two or more rows, or four columns, are a grid.
 */
function partitionOf(plan, S) {
  const Z = plan.z && plan.z.Z;
  // What stands in a side title's rail is part of the title zone, as the check reads it.
  const placed = (plan.placed || []).filter((q) => !q.decor && !q.rail);
  if (!Z || !placed.length) return "one";
  const all = placed.flatMap((q) => drawnBoxes(q, S)).filter((b) => b.w > 0 && b.h > 0);
  const cards = all.filter((b) => b.card);
  const inCard = (b) => cards.some((c) => c !== b && b.x + b.w / 2 >= c.x - 1 && b.x + b.w / 2 <= c.x + c.w + 1 && b.y + b.h / 2 >= c.y - 1 && b.y + b.h / 2 <= c.y + c.h + 1);
  const blocks = all.filter((b) => !inCard(b));
  if (!blocks.length) return "one";
  const bodyW = S.grid.W - 2 * S.grid.margin;
  let narrow = blocks.filter((b) => b.w < 0.7 * bodyW);
  if (!narrow.length) narrow = blocks;
  const columns = [];
  for (const b of [...narrow].sort((m, n) => m.x - n.x)) {
    const hits = columns.filter((c) => Math.min(c.r, b.x + b.w) - Math.max(c.l, b.x) >= 0.5 * Math.min(c.r - c.l, b.w));
    if (hits.length) {
      const keep = hits[0];
      for (const other of hits.slice(1)) { keep.l = Math.min(keep.l, other.l); keep.r = Math.max(keep.r, other.r); keep.items.push(...other.items); columns.splice(columns.indexOf(other), 1); }
      keep.l = Math.min(keep.l, b.x); keep.r = Math.max(keep.r, b.x + b.w); keep.items.push(b);
    } else columns.push({ l: b.x, r: b.x + b.w, items: [b] });
  }
  const columnOf = new Map(columns.flatMap((c, i) => c.items.map((b) => [b, i])));
  const rows = [];
  for (const b of [...narrow].sort((m, n) => m.y - n.y)) {
    const last = rows[rows.length - 1];
    if (last && b.y < last.bottom - 2) { last.bottom = Math.max(last.bottom, b.y + b.h); last.items.push(b); }
    else rows.push({ bottom: b.y + b.h, items: [b] });
  }
  const gridRows = rows.filter((r) => new Set(r.items.map((b) => columnOf.get(b))).size >= 2).length;
  const k = columns.length;
  if (k >= 4 || (k >= 2 && gridRows >= 2)) return "grid";
  if (k === 3) return "three";
  if (k === 2) {
    const [a, c] = columns.map((col) => col.r - col.l);
    return Math.min(a, c) / Math.max(a, c) >= 0.85 ? "two-even" : "two-asym";
  }
  return "one";
}

/**
 * The emptiest text column of a two-column body, read as the gate reads it (OF-115, spec-v2 Amendments 8):
 * for every vertical cut no block crosses, a side holding text only, beside a side that reaches at least
 * three quarters of the body, is measured by the largest band its blocks leave empty from the pair's top
 * down to where the other side ends (to the floor beside figure rows, Amendments 9), as a share of the body
 * from that top to the floor. A source strip closing the column counts as a block but does not hide the band
 * above it. Returns { share, owners }.
 */
const TEXT_KINDS = new Set(["text", "caption", "callout", "box", "panel"]);
// A picture drawn smaller than its box leaves its own column empty above it as a short text column does.
const SHORT_KINDS = new Set([...TEXT_KINDS, "image"]);
function shortColumn(placed, floor, S) {
  const flat = (list) => list.flatMap((q) => (q.kind === "group" ? flat(q.parts) : [q]));
  const owners = flat(placed.filter((q) => !q.decor && !q.rail));
  // A matrix's cells are drawn whole on the page, whatever its composition estimate reads of them.
  const boxesOf = (q) => (q.kind === "matrix" ? q.cells.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })) : drawnBoxes(q, S));
  // A chart's values table under its takeaways belongs to their column.
  const boxes = owners.flatMap((q) => boxesOf(q).map((b) => ({ ...b, q, text: SHORT_KINDS.has(q.kind) || Boolean(q.item && q.item.values) })))
    .concat(owners.filter((q) => q.kind === "box" || q.kind === "panel").map((q) => ({ x: q.x, y: q.y, w: q.w, h: q.h, q, text: true })))
    .filter((b) => b.w > 0 && b.h > 0 && b.y < floor);
  let worst = { share: 0, owners: [] };
  if (boxes.length < 2) return worst;
  const left = Math.min(...boxes.map((b) => b.x));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  for (const cut of [...new Set(boxes.map((b) => b.x + b.w))].sort((m, n) => m - n)) {
    const a = boxes.filter((b) => b.x + b.w <= cut + 2);
    const c = boxes.filter((b) => b.x >= cut - 2);
    // A block across most of the body (a note under both columns) belongs to neither; a narrower one across the cut
    // means there is no column line here.
    const across = boxes.filter((b) => !a.includes(b) && !c.includes(b));
    if (!a.length || !c.length || across.some((b) => b.w < 0.7 * (right - left))) continue;
    const top = Math.min(...[...a, ...c].map((b) => b.y));
    for (const [col, other] of [[a, c], [c, a]]) {
      if (!col.every((b) => b.text)) continue;
      // Beside figure rows (not on their own panel) the column runs to the floor: the rows stop where their
      // spacing ends, not where the slide's content does (spec-v2 Amendments 9).
      const figures = other.some((b) => ["figrows", "number"].includes(b.q.kind)) && !other.some((b) => b.q.kind === "panel");
      const reach = figures ? floor : Math.min(floor, Math.max(...other.map((b) => b.y + b.h)));
      if (reach - top < 0.75 * (floor - top)) continue;
      let gap = 0;
      let cursor = top;
      for (const b of [...col].sort((m, n) => m.y - n.y)) {
        gap = Math.max(gap, b.y - cursor);
        cursor = Math.max(cursor, b.y + b.h);
      }
      gap = Math.max(gap, reach - cursor);
      const share = gap / Math.max(1, floor - top);
      if (share > worst.share) worst = { share, owners: [...new Set(col.map((b) => b.q))], top, reach, besideText: other.every((b) => b.q.kind === "text") };
    }
  }
  return worst;
}

/**
 * Fill a short text column by layout (spec-v2 Amendments 8): its points step up to lead size when they fit
 * and keep twelve glyphs a line, then the room left is shared between its points, at most a sixth of the
 * body a gap. Type never shrinks and nothing is added. Changes the placements in place.
 */
function fillColumn(short, floor, S, state) {
  const texts = short.owners.filter((q) => q.kind === "text" && !q.muted && !q.strip && q.paras);
  if (!texts.length) return;
  // The chart's values under the takeaways move down with them; they bound nothing above them.
  const values = short.owners.filter((q) => q.item && q.item.values);
  const below = (q) => Math.min(floor, q.limit == null ? floor : q.limit, ...short.owners.filter((o) => o !== q && !values.includes(o) && o.y >= q.y + q.h - 0.5).map((o) => o.y - state.blockGap));
  const carried = (q, dy) => values.every((v) => v.y < q.y + q.h - 0.5 || v.y + v.h + dy <= below(v) + 0.5);
  const lead = S.sizes.lead;
  // Beside another text column the points keep its size: two columns of text at two sizes read as a mistake.
  for (const q of short.besideText ? [] : texts) {
    if (q.size >= lead || q.w / lead < 12) continue;
    const m = measureText(q.paras, q.w, S, { ...state, stepped: false }, { size: lead });
    if (q.y + m.h <= below(q) + 0.5 && carried(q, m.h - q.h)) {
      // Every later block in the column moves down by what the step adds.
      const dy = m.h - q.h;
      for (const o of short.owners) if (o !== q && o.y >= q.y + q.h - 0.5 && !o.strip && !o.muted) o.y += dy;
      Object.assign(q, { paras: m.paras, size: m.size, h: m.h });
    }
  }
  const breaks = texts.flatMap((q) => q.paras.filter((para, i) => i > 0 && para.kind !== "child").map((para) => ({ q, para })));
  const last = [...texts, ...values].reduce((m, q) => (q.y + q.h > m.y + m.h ? q : m));
  const room = below(last) - (last.y + last.h);
  // The gap over a values table is shared like a gap between points.
  const gaps = breaks.length + values.length;
  if (!gaps || room <= 0) return;
  const per = Math.min(room / (gaps + 1), (floor - short.top) / 6);
  for (const { q, para } of breaks) { para.gap += per; q.h += per; }
  // A block that grew pushes the text blocks and values under it (never the strip, which stays on the floor).
  let shift = 0;
  for (const q of [...texts, ...values].sort((m, n) => m.y - n.y)) {
    if (values.includes(q)) shift += per;
    q.y += shift;
    shift += breaks.filter((b) => b.q === q).length * per;
  }
}

/** Families whose visual may take its takeaways under it across the body, and the plan that does. */
const STACKS = { "table-insight": "ledger-table", "chart-insight": "full-chart" };

/** The composition title zone of each treatment (S15). */
const ZONE_OF = { "top-rule": "top", "top-plain-large": "top", "kicker-numeral": "top", "side-rail": "side", band: "band",
  "bottom-anchor": "bottom", overlay: "overlay", statement: "none" };

// ── Content, cover and section slides ───────────────────────────────────────

function drawDecor(slide, S, list) {
  for (const d of list || []) packRect(slide, S, d, { fill: d.role, alpha: d.alpha });
}

/**
 * A content slide: decoration, numeral, body, then the title frame of its treatment. The title is
 * drawn last so the first shape on the slide is an unnamed one that can carry the family name.
 */
function renderContent(slide, spec, S, ctx, chosen) {
  const f = frameFor(spec, chosen.t);
  const t = f.title;
  const items = spec.items || [];
  if (!f.image) drawDecor(slide, S, f.decor);
  if (f.numeral) {
    packText(slide, S, f.numeral.text, f.numeral, { face: "numeral", size: f.numeral.size, colour: S.colour("accent"), lineSpacing: 1.15 });
  }
  const dctx = { sourceDir: ctx.sourceDir, title: spec.title };
  let ink = t.colour;
  if (f.image) {
    const image = items.find((i) => i.type === "image" || i.type === "image-grid");
    const src = image && (image.content.type === "image-grid" ? image.content.images[0] : image.content);
    if (src) {
      const file = shared().resolveImagePath(src.src, ctx.sourceDir);
      slide.addImage({ path: file, ...croppedTo(file, { x: 0, y: 0, w: f.image.w, h: f.image.h }), altText: src.caption || path.basename(file) });
      drawDecor(slide, S, f.decor);
      if (image.caption) drawCaption(slide, S, image.caption, t.x, 432, t.w, "on-field");
    }
  } else if (f.support) {
    const text = spec.supportText || spec.lead || items.filter(isText).flatMap(itemParas).map((p) => plainText(p.text)).join(" ");
    const supportH = text ? G.textHeight(plainText(text), f.support.w, S.sizes.body) : 0;
    // A tall statement with a support line moves up so the line ends on the body floor.
    const over = f.support.y + supportH - G.ZONE.floor;
    if (over > 0) {
      const dy = Math.min(over, t.y - G.ZONE.top);
      t.y -= dy;
      f.support.y -= dy;
    }
    ink = statementDevice(slide, S, f, supportH);
    if (text) packText(slide, S, text, { ...f.support, h: supportH }, { colour: S.colour(ink === "on-field" ? "on-field" : "ink-muted") });
  } else if (f.body) {
    const plan = chosen.plan;
    if (plan.before > S.tok.cap || plan.band > S.tok.cap) {
      ctx.log.push(`fill: slide ${spec.index + 1} band ${plan.before.toFixed(2)} -> ${plan.band.toFixed(2)} (${plan.applied.length ? plan.applied.join(", ") : "none: nothing on the slide can grow; choose a fuller family"})`);
    }
    for (const p of plan.placed.filter((q) => q.decor)) drawPlaced(slide, S, p, dctx);
    for (const p of plan.placed.filter((q) => !q.decor)) drawPlaced(slide, S, p, dctx);
  }
  packText(slide, S, chosen.t === "statement" && spec.statementText ? spec.statementText : spec.title, t, {
    // Every title that wraps is set in balanced lines, never ending on one word.
    face: t.face, size: t.size, colour: S.colour(ink), lineSpacing: 1.15, title: true, name: `title@${chosen.t}`, balance: true,
  });
}

/**
 * What carries a statement, from the pack's display keys: nothing (open), the field over the whole
 * page (drench), the field under the sentence from just above it to the foot (plate), a hairline
 * above the sentence and one under its support line (rules), or a rail beside a sentence set off
 * the left edge (offset). Returns the colour role the sentence takes.
 */
function statementDevice(slide, S, f, supportH) {
  const g = S.grid;
  const t = f.title;
  const device = (S.pack.display || {}).statement || "open";
  if (device === "drench") {
    packRect(slide, S, { x: 0, y: 0, w: g.W, h: g.H }, { fill: "field" });
    return "on-field";
  }
  if (device === "plate") {
    // The sentence moves down onto a plate that bleeds off three edges and covers less than half
    // of the page, so the white above stays the page and the plate reads as the sentence's ground.
    // A sentence too tall to sit that low keeps the open page.
    const top = Math.round((376 - t.h / 2) / 6) * 6;
    if (top - 24 < 282 || top + t.h + 24 + supportH > G.ZONE.floor) return t.colour;
    f.support.y += top - t.y;
    t.y = top;
    packRect(slide, S, { x: 0, y: top - 24, w: g.W, h: g.H - top + 24 }, { fill: "field" });
    return "on-field";
  }
  if (device === "rules") {
    const full = g.span(1, 12);
    const below = supportH ? f.support.y + supportH + 24 : t.y + t.h + 30;
    packRect(slide, S, { x: full.x, y: t.y - 30, w: full.w, h: 0.75 }, { fill: "line" });
    packRect(slide, S, { x: full.x, y: below, w: full.w, h: 0.75 }, { fill: "line" });
    return t.colour;
  }
  if (device === "offset") {
    // The rail stops a column short of the sentence, so the gap between them is part of the grid,
    // and at the body floor, so the footer zone stays the page's.
    packRect(slide, S, { x: 0, y: 0, w: t.x - g.gutter / 2 - g.pitch, h: G.ZONE.floor }, { fill: S.pack.rail === "field" ? "field" : "surface" });
    return t.colour;
  }
  return t.colour;
}

function metaLine(meta) {
  return [meta.date, meta.department, meta.presenter].filter(Boolean).join("  ·  ");
}

/** Cover title at cover-max, stepping down to display when it would run past `maxLines`. */
function coverTitle(S, text, w, maxLines, start = S.sizes.cover) {
  let size = start;
  let lines = S.lines(plainText(text), w, size, "display");
  if (lines > maxLines) { size = S.sizes.display; lines = S.lines(plainText(text), w, size, "display"); }
  return { size, h: Math.ceil(lines * size * 1.1) };
}

function coverImage(slide, box, src, sourceDir) {
  const file = shared().resolveImagePath(src.src, sourceDir);
  slide.addImage({ path: file, ...croppedTo(file, box), altText: src.caption || path.basename(file) });
}

/**
 * A picture that fills a box by cropping, never by stretching: the cover sizing reads the picture's
 * own proportions from w and h and crops it to the box (without them it is stretched to the box).
 */
function croppedTo(file, box) {
  const size = shared().readImageSize(file);
  const ratio = size && size.width && size.height ? size.height / size.width : box.h / box.w;
  return { x: IN(box.x), y: IN(box.y), w: IN(box.w), h: IN(box.w * ratio), sizing: { type: "cover", w: IN(box.w), h: IN(box.h) } };
}

/**
 * A type-led cover drawn with the pack's display device: the field over the whole page with the
 * title anchored low (drench), a field plate under the title (plate), a journal title page between
 * rules (rules), or the plain page. The rail, band, figures and numeral devices draw the pack's
 * cover of that name when the deck holds what it needs.
 */
const TYPE_COVERS = {
  drench(slide, spec, S, meta) {
    const g = S.grid;
    packRect(slide, S, { x: 0, y: 0, w: g.W, h: g.H }, { fill: "field" });
    const line = metaLine(meta);
    if (line) packText(slide, S, line, { ...g.span(1, 8), y: 36, h: 24 }, { size: S.sizes.label, colour: S.colour("on-field"), lineSpacing: 1.2 });
    const span = g.span(1, 11);
    const { size, h } = coverTitle(S, spec.title, span.w, 3, S.pack.hero ? S.sizes.hero : S.sizes.cover);
    const sub = g.span(1, 8);
    const subH = meta.subtitle ? G.textHeight(meta.subtitle, sub.w, S.sizes.lead) + 18 : 0;
    // The title block ends just above the footer zone, so the field holds the title from below.
    const y = Math.round((456 - subH - h) / 6) * 6;
    if (meta.subtitle) packText(slide, S, meta.subtitle, { ...sub, y: y + h + 18, h: subH - 18 }, { name: "subtitle@cover", size: S.sizes.lead, colour: S.colour("on-field") });
    packText(slide, S, spec.title, { ...span, y, h }, { face: "display", size, colour: S.colour("on-field"), lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
  },
  plate(slide, spec, S, meta) {
    // The plate covers a little under half the page, so the white above it stays the page's ground.
    const g = S.grid;
    const top = 288;
    packRect(slide, S, { x: 0, y: top, w: g.W, h: g.H - top }, { fill: "field" });
    const line = metaLine(meta);
    if (line) packText(slide, S, line, { ...g.span(1, 8), y: 36, h: 24 }, { size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.2 });
    const span = g.span(1, 10);
    const { size, h } = coverTitle(S, spec.title, span.w, 2);
    const y = top + 30;
    if (meta.subtitle && y + h + 18 + S.sizes.body * 1.4 <= 462) {
      const sub = g.span(1, 8);
      packText(slide, S, meta.subtitle, { ...sub, y: y + h + 18, h: G.textHeight(meta.subtitle, sub.w, S.sizes.body) }, { name: "subtitle@cover", colour: S.colour("on-field") });
    }
    packText(slide, S, spec.title, { ...span, y, h }, { face: "display", size, colour: S.colour("on-field"), lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
  },
  rules(slide, spec, S, meta) {
    const g = S.grid;
    const full = g.span(1, 12);
    const span = g.span(1, 10);
    const top = 96;
    packRect(slide, S, { x: full.x, y: top, w: full.w, h: 2 }, { fill: "ink" });
    const { size, h } = coverTitle(S, spec.title, span.w, 3);
    const y = top + 30;
    const ruleY = y + h + 24;
    packRect(slide, S, { x: full.x, y: ruleY, w: full.w, h: 0.75 }, { fill: "line" });
    // Under the rule, as on a journal's title page: who presents, then where and when, in one frame.
    const place = [meta.department, meta.date].filter(Boolean).join("  ·  ");
    const runs = [
      ...(meta.presenter ? [{ text: meta.presenter, options: { fontFace: S.faces.title.font, fontSize: S.sizes.lead, bold: true, color: S.colour("ink"), breakLine: Boolean(place) } }] : []),
      ...(place ? [{ text: place, options: { fontFace: S.faces.label.font, fontSize: S.sizes.label, color: S.colour("ink-muted") } }] : []),
    ];
    let at = ruleY + 18;
    if (runs.length) {
      // A frame as tall as an office renderer sets two lines of mixed sizes (about 1.5 of each).
      const hh = (meta.presenter ? S.sizes.lead * 1.5 : 0) + (place ? S.sizes.label * 1.5 : 0);
      slide.addText(runs, { x: IN(span.x), y: IN(at), w: IN(span.w), h: IN(hh), align: "left", valign: "top", margin: [0, 0, 0, 0], lineSpacingMultiple: 1.2 });
      at += hh;
    }
    if (meta.subtitle) packText(slide, S, meta.subtitle, { ...span, y: at + 18, h: G.textHeight(meta.subtitle, span.w, S.sizes.label, 1.3) }, { name: "subtitle@cover", size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.3 });
    packText(slide, S, spec.title, { ...span, y, h }, { face: "display", size, lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
  },
  plain(slide, spec, S, meta) {
    const g = S.grid;
    const span = g.span(1, 9);
    const { size, h } = coverTitle(S, spec.title, span.w, 3);
    if (meta.subtitle) {
      const sub = g.span(1, 8);
      packText(slide, S, meta.subtitle, { ...sub, y: 144 + h + 24, h: G.textHeight(meta.subtitle, sub.w, S.sizes.lead) }, { name: "subtitle@cover", size: S.sizes.lead, colour: S.colour("ink-muted") });
    }
    const line = metaLine(meta);
    if (line) packText(slide, S, line, { ...g.span(1, 6), y: 438, h: 24 }, { size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.2 });
    packText(slide, S, spec.title, { ...span, y: 144, h }, { face: "display", size, lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
  },
};

const COVERS = {
  "cover-typographic"(slide, spec, S, meta) {
    const device = (S.pack.display || {}).cover || "plain";
    const facts = spec.cover || {};
    if (device === "rail") return COVERS["cover-rail"](slide, spec, S, meta);
    if (device === "band") return COVERS["cover-band"](slide, spec, S, meta);
    if (device === "figures" && (facts.figures || []).length >= 2) return COVERS["cover-figures"](slide, spec, S, meta);
    if (device === "numeral" && facts.numeral) return COVERS["cover-numeral"](slide, spec, S, meta);
    return (TYPE_COVERS[device] || TYPE_COVERS.plain)(slide, spec, S, meta);
  },
  "cover-split-field"(slide, spec, S, meta) {
    const g = S.grid;
    const x = g.colX(8) - g.gutter / 2;
    packRect(slide, S, { x, y: 0, w: g.W - x, h: g.H }, { fill: "field" });
    if (spec.cover.numeral) {
      const s = g.span(9, 12);
      packText(slide, S, spec.cover.numeral, { ...s, y: 384, h: S.sizes.title * 1.15 }, { face: "numeral", size: S.sizes.title, colour: S.colour("on-field"), lineSpacing: 1.15 });
    }
    splitText(slide, spec, S, meta, 6);
  },
  "cover-split-image"(slide, spec, S, meta) {
    const g = S.grid;
    const x = g.colX(8) - g.gutter / 2;
    coverImage(slide, { x, y: 0, w: g.W - x, h: g.H }, spec.cover.image, spec.sourceDir);
    splitText(slide, spec, S, meta, 6);
  },
  "cover-full-image"(slide, spec, S, meta) {
    const g = S.grid;
    coverImage(slide, { x: 0, y: 0, w: g.W, h: g.H }, spec.cover.image, spec.sourceDir);
    const span = g.span(1, 8);
    // The panel is as tall as the title and its meta line and stands on the page foot (bleeding off it,
    // so the sample tag sits inside it, clear of its edge); the picture keeps the rest of the page.
    const { size, h } = coverTitle(S, spec.title, span.w, 2, S.sizes.display);
    const line = [meta.subtitle, metaLine(meta)].filter(Boolean).join("  ·  ");
    const lineH = line ? G.textHeight(line, span.w, S.sizes.label, 1.3) : 0;
    const y = Math.round(G.ZONE.floor - 24 - (line ? lineH + 18 : 0) - h);
    packRect(slide, S, { x: 0, y: y - 24, w: span.x + span.w + 24, h: g.H - y + 24 }, { fill: "field", alpha: 12 });
    packText(slide, S, spec.title, { ...span, y, h }, { face: "display", size, colour: S.colour("on-field"), lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
    if (line) packText(slide, S, line, { ...span, y: y + h + 18, h: lineH }, { size: S.sizes.label, colour: S.colour("on-field"), lineSpacing: 1.3 });
  },
  "cover-band"(slide, spec, S, meta) {
    const g = S.grid;
    packRect(slide, S, { x: 0, y: 0, w: g.W, h: 216 }, { fill: "field" });
    const span = g.span(1, 10);
    const { size, h } = coverTitle(S, spec.title, span.w, 2, S.sizes.display);
    packText(slide, S, spec.title, { ...span, y: Math.max(48, 180 - h), h }, { face: "display", size, colour: S.colour("on-field"), lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
    const subH = meta.subtitle ? G.textHeight(meta.subtitle, g.span(1, 8).w, S.sizes.lead) : 0;
    if (meta.subtitle) packText(slide, S, meta.subtitle, { ...g.span(1, 8), y: 252, h: subH }, { name: "subtitle@cover", size: S.sizes.lead, colour: S.colour("ink-muted") });
    // Under the band, the deck's parts (else its headline figures) run across the page as the
    // issue's contents, between a hairline and the meta line.
    const parts = (spec.cover.index || []).length >= 2 ? spec.cover.index.map((name, i) => [String(i + 1).padStart(2, "0"), name])
      : (spec.cover.figures || []).length >= 2 ? spec.cover.figures.map((f) => [f.value, f.label]) : [];
    if (parts.length) {
      const top = Math.max(300, 252 + subH + 36);
      const cols = equalParts(S, region(S, 1, 12, top, 420), Math.min(parts.length, 4));
      packRect(slide, S, { x: g.margin, y: top - 18, w: g.span(1, 12).w, h: 0.75 }, { fill: "line" });
      parts.slice(0, 4).forEach(([key, text], i) => {
        const R = cols[i];
        const k = [S.sizes.title, S.sizes.lead].find((z) => S.ems(key, "numeral") * z * 1.1 <= R.w) || S.sizes.lead;
        packText(slide, S, key, { x: R.x, y: top, w: R.w, h: k * 1.15 }, { face: "numeral", size: k, colour: S.colour("accent"), lineSpacing: 1.15 });
        packText(slide, S, text, { x: R.x, y: top + k * 1.15 + 8, w: R.w, h: G.textHeight(text, R.w, S.sizes.body) }, { size: S.sizes.body });
      });
    }
    const line = metaLine(meta);
    if (line) packText(slide, S, line, { ...g.span(1, 8), y: 438, h: 24 }, { size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.2 });
  },
  "cover-numeral"(slide, spec, S, meta) {
    const g = S.grid;
    const n = spec.cover.numeral;
    // A number is never the display element: title size at most (spec-v2 Amendments 5).
    const numeral = S.sizes.title;
    packText(slide, S, n, { ...g.span(1, 8), y: 96, h: numeral * 1.15 }, { face: "numeral", size: numeral, colour: S.colour("accent"), lineSpacing: 1.15 });
    const span = g.span(1, 9);
    const { size, h } = coverTitle(S, spec.title, span.w, 3, S.sizes.display);
    const y = 96 + numeral * 1.1 + 24;
    packText(slide, S, spec.title, { ...span, y, h }, { face: "display", size, lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
    const line = metaLine(meta);
    if (line) packText(slide, S, line, { ...g.span(1, 6), y: 438, h: 24 }, { size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.2 });
  },
  "cover-index"(slide, spec, S, meta) {
    const g = S.grid;
    const span = g.span(1, 6);
    const { size, h } = coverTitle(S, spec.title, span.w, 4, S.sizes.display);
    packText(slide, S, spec.title, { ...span, y: 144, h }, { face: "display", size, lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
    const list = g.span(8, 12);
    // The part names run from the title's top down to the meta line, at most 96 pt apart.
    const pitch = Math.min(96, (438 - 144) / Math.max(1, spec.cover.index.length - 1));
    packRect(slide, S, { x: list.x - 12, y: 144, w: 0.75, h: pitch * spec.cover.index.length }, { fill: "line" });
    spec.cover.index.forEach((name, i) => {
      packText(slide, S, `${String(i + 1).padStart(2, "0")}  ${name}`, { ...list, y: 144 + i * pitch, h: G.textHeight(name, list.w, S.sizes.lead, 1.3) }, { size: S.sizes.lead, colour: S.colour("ink"), lineSpacing: 1.3 });
    });
    const line = metaLine(meta);
    if (line) packText(slide, S, line, { ...span, y: 438, h: G.textHeight(line, span.w, S.sizes.label, 1.3) }, { size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.3 });
  },
  "cover-figures"(slide, spec, S, meta) {
    const g = S.grid;
    const span = g.span(1, 9);
    const { size, h } = coverTitle(S, spec.title, span.w, 2, S.sizes.display);
    // The figures sit between the title and the meta line, with a hairline above them; the title
    // is drawn last, so the slide's first shape is an unnamed one that carries the family.
    const figs = spec.cover.figures.slice(0, 4);
    // The row stands in the middle of the room between the title and the meta line.
    const rowH = S.sizes.title * 1.3 + 6 + S.sizes.body * 1.4;
    const top = Math.max(240, 96 + h + 36, Math.round((96 + h + 438 - rowH) / 2 / 6) * 6);
    const parts = equalParts(S, region(S, 1, 12, top, top + 120), figs.length);
    packRect(slide, S, { x: g.margin, y: top - 18, w: g.span(1, 12).w, h: 0.75 }, { fill: "line" });
    figs.forEach((f, i) => {
      const R = parts[i];
      const v = [S.sizes.title, S.sizes.lead, S.sizes.body].find((s) => S.ems(f.value, "numeral") * s * 1.1 <= R.w) || S.sizes.body;
      packText(slide, S, f.value, { x: R.x, y: top, w: R.w, h: v * 1.15 }, { face: "numeral", size: v, colour: S.colour(i === 0 ? "accent" : "ink"), lineSpacing: 1.15 });
      packText(slide, S, f.label, { x: R.x, y: top + v * 1.3 + 6, w: R.w, h: S.sizes.body * 1.4 }, { size: S.sizes.body, colour: S.colour("ink-muted"), lineSpacing: 1.3 });
    });
    const line = metaLine(meta);
    if (line) packText(slide, S, line, { ...g.span(1, 6), y: 438, h: 24 }, { size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.2 });
    packText(slide, S, spec.title, { ...span, y: 96, h }, { face: "display", size, lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
  },
  "cover-rail"(slide, spec, S, meta) {
    const g = S.grid;
    const rail = g.span(1, 4);
    packRect(slide, S, { x: 0, y: 0, w: rail.x + rail.w + g.gutter / 2, h: g.H }, { fill: "field" });
    const side = g.span(1, 3);
    const lines = [meta.department, meta.presenter, meta.date].filter(Boolean);
    lines.forEach((l, i) => packText(slide, S, l, { ...side, y: 402 + i * 24, h: 22 }, { size: S.sizes.label, colour: S.colour("on-field"), lineSpacing: 1.2 }));
    const span = g.span(5, 12);
    const { size, h } = coverTitle(S, spec.title, span.w, 3);
    packText(slide, S, spec.title, { ...span, y: 144, h }, { face: "display", size, lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
    if (meta.subtitle) packText(slide, S, meta.subtitle, { ...span, y: 144 + h + 24, h: G.textHeight(meta.subtitle, span.w, S.sizes.lead) }, { name: "subtitle@cover", size: S.sizes.lead, colour: S.colour("ink-muted") });
  },
};

/** Title and meta in columns 1-k beside a field or image (the split covers). */
function splitText(slide, spec, S, meta, k) {
  const g = S.grid;
  const span = g.span(1, k);
  const { size, h } = coverTitle(S, spec.title, span.w, 4, S.sizes.display);
  packText(slide, S, spec.title, { ...span, y: 144, h }, { face: "display", size, lineSpacing: 1.1, title: true, balance: true, name: "title@cover" });
  if (meta.subtitle) packText(slide, S, meta.subtitle, { ...span, y: 144 + h + 24, h: G.textHeight(meta.subtitle, span.w, S.sizes.body) }, { name: "subtitle@cover", colour: S.colour("ink-muted") });
  const line = metaLine(meta);
  if (line) packText(slide, S, line, { ...span, y: 438, h: G.textHeight(line, span.w, S.sizes.label, 1.3) }, { size: S.sizes.label, colour: S.colour("ink-muted"), lineSpacing: 1.3 });
}

/**
 * Section slides carry a part number and the part title. The title frame keeps the statement
 * frame (cols 1-10, centred in the body height) on every variant but the rail and the index, so a
 * section reads as one more statement-sized title and its frame repeats across the deck. A part
 * number shows only when the deck says how many parts there are; a section without one opens with
 * its first lines instead (see sectionOpener).
 */
const SECTIONS = {
  "section-field"(slide, spec, S) {
    const g = S.grid;
    packRect(slide, S, { x: 0, y: 0, w: g.W, h: g.H }, { fill: "field" });
    sectionTitle(slide, spec, S, { colour: "on-field", numeralColour: "on-field" });
  },
  "section-numeral"(slide, spec, S) {
    // With the agenda known, the numeral's page is the index page: the title is never alone on it.
    if (spec.parts && ((spec.cover || {}).index || []).length >= 2) { sectionIndex(slide, spec, S); return; }
    sectionTitle(slide, spec, S, { hero: true });
  },
  "section-rule"(slide, spec, S) {
    if (showsIndex(spec, S)) { sectionIndex(slide, spec, S); return; }
    if (!spec.parts) { sectionOpener(slide, spec, S, { rule: true }); return; }
    const full = S.grid.span(1, 12);
    sectionTitle(slide, spec, S, { numeral: false, under: (box) => {
      packRect(slide, S, { x: full.x, y: box.y + box.h + 18, w: full.w, h: 0.75 }, { fill: "line" });
    } });
  },
  "section-band"(slide, spec, S) {
    // The header band deepened to y 216; the title opens the ground under it. With the deck's part
    // index the band carries that index (this part marked) and the title stands without a numeral.
    const g = S.grid;
    packRect(slide, S, { x: 0, y: 0, w: g.W, h: 216 }, { fill: "field" });
    const index = showsIndex(spec, S);
    if (index) {
      const h = S.sizes.body * 1.4;
      partIndex(slide, S, spec, { ...g.span(1, 12), y: 216 - 36 - h }, true);
    }
    // Under a band that carries the index, the title is a statement over what the part opens with.
    if (index) sectionOpener(slide, spec, S, { top: 252, centre: 351 });
    else sectionTitle(slide, spec, S, { top: 240 });
  },
  "section-rail"(slide, spec, S) {
    const g = S.grid;
    const rail = g.span(1, 4);
    packRect(slide, S, { x: 0, y: 0, w: rail.x + rail.w + g.gutter / 2, h: g.H }, { fill: "field" });
    const numeral = S.sizes.title;
    if (spec.parts) partNumeral(slide, S, spec, { ...g.span(1, 3), y: 216, h: numeral * 1.15 }, numeral, "on-field");
    else if ((spec.contents || []).length) {
      // No part count: the rail names what the section opens with, one entry under the next at lead size
      // with a step between them, so the list reads as the part's contents and not as one wrapped block.
      const w = g.span(1, 3).w;
      let y = 216;
      for (const entry of spec.contents) {
        const h = G.textHeight(entry, w, S.sizes.lead, 1.3);
        packText(slide, S, entry, { ...g.span(1, 3), y, h }, { size: S.sizes.lead, colour: S.colour("on-field"), lineSpacing: 1.3 });
        y += h + S.tok.group;
      }
    }
    const span = g.span(5, 12);
    const display = S.sizes.display;
    const h = Math.ceil(S.lines(plainText(spec.title), span.w, display, "display") * display * 1.15);
    packText(slide, S, spec.title, { ...span, y: Math.round((303 - h / 2) / 6) * 6, h }, { face: "display", size: display, lineSpacing: 1.15, title: true, balance: true, name: "title@section" });
  },
  "section-image"(slide, spec, S) {
    // The panel stands on the page foot (bleeding off it) and is as tall as the part number and the title.
    const g = S.grid;
    coverImage(slide, { x: 0, y: 0, w: g.W, h: g.H }, spec.cover.image, spec.sourceDir);
    const s = g.span(1, 7);
    const display = S.sizes.display;
    const h = Math.ceil(S.lines(plainText(spec.title), s.w, display, "display") * display * 1.15);
    const y = Math.round(G.ZONE.floor - 18 - h);
    const numY = y - 24;
    packRect(slide, S, { x: 0, y: (spec.parts ? numY : y) - 18, w: s.x + s.w + 24, h: g.H - (spec.parts ? numY : y) + 18 }, { fill: "field", alpha: 12 });
    if (spec.parts) packText(slide, S, String(spec.part).padStart(2, "0"), { ...s, y: numY, h: S.sizes.label * 1.4 }, { size: S.sizes.label, colour: S.colour("on-field"), lineSpacing: 1.3 });
    packText(slide, S, spec.title, { ...s, y, h }, { face: "display", size: display, colour: S.colour("on-field"), lineSpacing: 1.15, title: true, balance: true, name: "title@section" });
  },
};

function sectionTitle(slide, spec, S, o = {}) {
  if (!spec.parts) return sectionOpener(slide, spec, S, o);
  const g = S.grid;
  const span = g.span(1, 10);
  const display = S.sizes.display;
  const h = Math.ceil(S.lines(plainText(spec.title), span.w, display, "display") * display * 1.15);
  // The part number is set at title size: a number never takes the display step.
  const size = S.sizes.title;
  const numeralH = o.numeral === false ? 0 : size * 1.15 + 12;
  // Centred in the body height like a statement, and never above `top` with its numeral.
  const y = Math.max(228, (o.top || 0) + numeralH, Math.round((303 - h / 2) / 6) * 6);
  if (o.numeral !== false) {
    partNumeral(slide, S, spec, { ...g.span(1, spec.parts ? 6 : 3), y: y - numeralH, h: size * 1.15 }, size, o.numeralColour || "accent");
  }
  const box = { ...span, y, h };
  // Anything drawn with the title (a rule under it) goes first, so the title stays the last shape.
  if (o.under) o.under(box);
  packText(slide, S, spec.title, box, { face: "display", size: display, colour: S.colour(o.colour || "ink"), lineSpacing: 1.15, title: true, balance: true, name: "title@section" });
  return box;
}

/**
 * A section the deck gives no part count (one section, no agenda): the title at the cover step (the
 * hero step in a hero tonality) as a statement centred in the body, and under it the titles of the
 * slides the section opens, so the page says what comes next instead of showing a bare count. With
 * `rule` the pack's hairline runs between them; `top` and `centre` place it under a band.
 */
function sectionOpener(slide, spec, S, o = {}) {
  const g = S.grid;
  const span = g.span(1, 10);
  const size = S.pack.hero ? S.sizes.hero : S.sizes.cover;
  const h = Math.ceil(S.lines(plainText(spec.title), span.w, size, "display") * size * 1.1);
  const onField = o.colour === "on-field";
  const digest = spec.digest || [];
  if (digest.some((d) => d.lines.length)) return sectionDigestPage(slide, spec, S, o, { span, size, h, digest, onField });
  const text = (spec.contents || []).join("\n");
  const lead = S.sizes.lead;
  const ch = text ? G.textHeight(text, span.w, lead, 1.4) : 0;
  const gap = text ? (o.rule ? 60 : 30) : 0;
  const y = Math.max(o.top || 0, Math.round(((o.centre || 303) - (h + gap + ch) / 2) / 6) * 6);
  if (text && o.rule) packRect(slide, S, { ...g.span(1, 12), y: y + h + 30, h: 0.75 }, { fill: "line" });
  if (text) packText(slide, S, text, { ...span, y: y + h + gap, h: ch }, { size: lead, colour: S.colour(onField ? "on-field" : "ink-muted"), lineSpacing: 1.4 });
  const box = { ...span, y, h };
  packText(slide, S, spec.title, box, { face: "display", size, colour: S.colour(o.colour || "ink"), lineSpacing: 1.1, title: true, balance: true, name: "title@section" });
  return box;
}

/**
 * A section with no part count whose slides carry body lines: the title on the upper body, and under
 * a hairline what the section opens with, one row per slide (its title, then its first lines) spread
 * down to the body floor, so the page previews the part instead of standing as a title alone.
 */
function sectionDigestPage(slide, spec, S, o, d) {
  const g = S.grid;
  const head = S.sizes.lead;
  const body = S.sizes.body;
  // The preview starts at the margin and is the widest column span within 70 % of the page and about 70
  // characters of body text (spec-v2 Amendments 7): Korean 8 columns, English 6 on the 16:9 compact grid.
  const korean = G.isKorean(d.digest.map((e) => e.title + e.lines.join("")).join(""));
  const cap = Math.min(0.7 * g.W, 70 * body * (korean ? 0.94 : 0.5));
  let k = 12;
  while (k > 1 && g.span(1, k).w > cap) k--;
  const right = g.span(1, k);
  const ink = S.colour(d.onField ? "on-field" : "ink");
  const soft = S.colour(d.onField ? "on-field" : "ink-muted");
  // Each opened slide shows up to two of its lines (a preview, not a copy); lines and then entries
  // drop until the preview fits between the title and the body floor.
  const gap = 24;
  const room = G.ZONE.floor - Math.max(o.top || 0, G.ZONE.body) - d.h - 54;
  const build = (entries, per) => entries.map((e) => {
    const text = e.lines.slice(0, per).join("\n");
    const headH = G.textHeight(e.title, right.w, head, 1.3);
    const textH = text ? G.textHeight(plainText(text), right.w, body) : 0;
    return { ...e, text, headH, textH, h: headH + (text ? 6 + textH : 0) };
  });
  const height = (rows) => rows.reduce((a, r) => a + r.h, 0) + gap * (rows.length - 1);
  let rows = null;
  for (let n = d.digest.length; n >= 1 && !rows; n--) {
    for (let per = 2; per >= 1; per--) {
      const tried = build(d.digest.slice(0, n), per);
      if (height(tried) <= room) { rows = tried; break; }
    }
  }
  if (!rows) rows = build(d.digest.slice(0, 1), 1);
  const sum = rows.reduce((a, r) => a + r.h, 0);
  // Title, hairline and preview form one block centred in the body (under `top` when a band sits
  // above), like a statement that says what the part holds.
  const total = d.h + 54 + sum + gap * (rows.length - 1);
  const y = Math.max(o.top || 0, G.ZONE.body, Math.round(((o.centre || 303) - total / 2) / 6) * 6);
  const listTop = y + d.h + 54;
  packRect(slide, S, { ...g.span(1, 12), y: listTop - 18, h: 0.75 }, { fill: d.onField ? "on-field" : "line" });
  let at = listTop;
  for (const r of rows) {
    packText(slide, S, r.title, { ...right, y: at, h: r.headH }, { size: head, bold: true, colour: ink, lineSpacing: 1.3 });
    if (r.text) packText(slide, S, r.text, { ...right, y: at + r.headH + 6, h: r.textH }, { size: body, colour: soft });
    at += r.h + gap;
  }
  const box = { ...d.span, y, h: d.h };
  packText(slide, S, spec.title, box, { face: "display", size: d.size, colour: S.colour(o.colour || "ink"), lineSpacing: 1.1, title: true, balance: true, name: "title@section" });
  return box;
}

/**
 * A section in a deck with an agenda, set as its index page: the part numeral at the hero step over
 * the part title on the left, and the agenda down the right columns, one part a line spread over the
 * body, a hairline above each and a heavier accent rule above this part, which is set in the accent.
 */
function sectionIndex(slide, spec, S) {
  const g = S.grid;
  const left = g.span(1, 6);
  const right = g.span(8, 12);
  const names = spec.cover.index;
  const lead = S.sizes.lead;
  const rowH = lead * 1.4;
  const label = (name, i) => `${String(i + 1).padStart(2, "0")}   ${name}`;
  const heights = names.map((name, i) => G.textHeight(label(name, i), right.w, lead, 1.4));
  const sum = heights.reduce((a, h) => a + h, 0);
  const after = Math.max(24, Math.min(96 - rowH, (G.ZONE.floor - G.ZONE.body - sum) / Math.max(1, names.length - 1)));
  const listH = sum + (names.length - 1) * after;
  const listY = Math.max(G.ZONE.body, Math.round(303 - listH / 2));
  const quiet = S.colour("ink-muted");
  const runs = [];
  let ruleY = listY - 12;
  names.forEach((name, i) => {
    const current = i + 1 === spec.part;
    const colour = current ? S.colour("accent") : quiet;
    packRect(slide, S, { x: right.x, y: ruleY - (current ? 1 : 0), w: right.w, h: current ? 2 : 0.75 }, { fill: current ? "accent" : "line" });
    ruleY += heights[i] + after;
    runs.push({ text: `${String(i + 1).padStart(2, "0")}   `, options: { fontFace: S.faces.body.font, fontSize: lead, color: colour, bold: current,
      ...(i ? { paraSpaceBefore: +after.toFixed(1) } : {}) } });
    runs.push({ text: name, options: { fontFace: (current ? S.faces.title : S.faces.body).font, fontSize: lead, color: colour,
      bold: current || Boolean(S.faces.body.bold), breakLine: i < names.length - 1 } });
  });
  // The gap goes before each part after the first, so the frame ends on the last line.
  slide.addText(runs, { x: IN(right.x), y: IN(listY), w: IN(right.w), h: IN(listH), align: "left", valign: "top", margin: [0, 0, 0, 0],
    lineSpacing: +rowH.toFixed(1) });
  const size = S.sizes.title;
  const display = S.sizes.display;
  const h = Math.ceil(S.lines(plainText(spec.title), left.w, display, "display") * display * 1.15);
  const blockH = size * 1.15 + 24 + h;
  const y = Math.round((303 - blockH / 2) / 6) * 6;
  partNumeral(slide, S, spec, { ...left, y, h: size * 1.15 }, size, "accent");
  packText(slide, S, spec.title, { ...left, y: y + size * 1.15 + 24, h }, { face: "display", size: display, lineSpacing: 1.15, title: true, balance: true, name: "title@section" });
}

/** The part number as the agenda writes it ("03"), followed by the part count when it is known. */
function partNumeral(slide, S, spec, box, size, colour) {
  const face = S.faces.numeral;
  const base = { fontFace: face.font, bold: Boolean(face.bold), color: S.colour(colour) };
  const pad = (n) => (spec.parts ? String(n).padStart(2, "0") : String(n));
  const tracking = S.tracking("numeral", size);
  const runs = [{ text: pad(spec.part), options: { ...base, fontSize: size, ...(tracking ? { charSpacing: tracking } : {}) } }];
  // The count is a step below the number, so the number stays the display element.
  if (spec.parts) runs.push({ text: ` / ${pad(spec.parts)}`, options: { ...base, fontSize: S.sizes.title, color: S.colour(colour === "on-field" ? "on-field" : "ink-muted") } });
  slide.addText(runs, { x: IN(box.x), y: IN(box.y), w: IN(box.w), h: IN(box.h), align: "left", valign: "bottom", margin: [0, 0, 0, 0],
    lineSpacing: +(size * 1.15).toFixed(1) });
}

function showsIndex(spec, S) {
  return Boolean((S.pack.display || {}).index && spec.parts && ((spec.cover || {}).index || []).length >= 2);
}

/** The deck's parts in one line, numbered as in the agenda; this section's part bold in the accent. */
function partIndex(slide, S, spec, box, onField = false) {
  const size = S.sizes.body;
  const quiet = onField ? mix(S.P["on-field"], S.P.field, 0.3) : S.P["ink-muted"];
  const runs = [];
  spec.cover.index.forEach((name, i) => {
    const current = i + 1 === spec.part;
    if (i) runs.push({ text: "      ", options: { fontFace: S.faces.body.font, fontSize: size } });
    runs.push({ text: `${String(i + 1).padStart(2, "0")} ${name}`, options: {
      fontFace: (current ? S.faces.title : S.faces.body).font, fontSize: size, bold: current || Boolean(S.faces.body.bold),
      color: current ? S.colour(onField ? "on-field" : "accent") : shared().hex(quiet),
    } });
  });
  const text = runs.map((r) => r.text).join("");
  const h = G.textHeight(text, box.w, size, 1.4);
  slide.addText(runs, { x: IN(box.x), y: IN(box.y), w: IN(box.w), h: IN(h), align: "left", valign: "top", margin: [0, 0, 0, 0],
    lineSpacing: +(size * 1.4).toFixed(1) });
}

/** The sample-data tag in the footer zone, on the grid's left edge, in the pack's colours. */
function packNotice(slide, S, text) {
  const label = plainText(text);
  const size = S.sizes.source;
  // A tenth of slack over the measured width keeps a Latin notice on one line in every renderer.
  const w = Math.min(S.grid.span(1, 8).w, G.textEms(label) * size * 1.1 + 24);
  const box = { x: S.grid.margin, y: G.ZONE.footer, w, h: G.ZONE.footerH };
  packRect(slide, S, box, { fill: "accent-tint", radius: S.pack.radius, name: "lit-notice tag" });
  slide.addText(label, {
    objectName: "lit-notice text",
    x: IN(box.x + 12), y: IN(box.y), w: IN(w - 24), h: IN(box.h),
    fontFace: S.faces.label.font, fontSize: size, bold: true, color: S.colour("accent-deep"),
    align: "left", valign: "middle", margin: [0, 0, 0, 0], fit: "shrink",
  });
}

async function renderPack(resolved, templateObj, outputPath) {
  const A = shared();
  const pack = templateObj.pack;
  const S = packStyle(pack);
  A.usePackFonts(S.faces.title.font, S.faces.body.font, pack.tokens);

  const PptxGenJS = runtimeRequire("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "LIT_PACK", width: IN(S.grid.W), height: IN(S.grid.H) });
  pptx.layout = "LIT_PACK";
  pptx.title = (resolved.deck && resolved.deck.title) || "Presentation";
  pptx.subject = `lit-pptx tonality=${pack.id} density=${pack.dials.density} grid=${S.grid.name} variance=${pack.dials.variance}`;
  const meta = (resolved.deck && resolved.deck.metadata) || {};
  const notice = typeof meta.notice === "string" && meta.notice.trim() ? meta.notice.trim() : null;
  const log = [...(resolved.notes || []).map((n) => `note: ${n}`)];
  const ctx = { sourceDir: resolved.sourceDir, log };
  const placementCtx = { rich: false, P: {}, fontRoles: {}, pageH: IN(S.grid.H), sourceDir: resolved.sourceDir, layout: "content" };
  // No title treatment chosen for fill may cover more than about a third of the content slides.
  const contentSlides = (resolved.slides || []).filter((s) => s.kind === "content").length;
  const deck = { used: new Set(), max: pack.dials.varianceMax, count: {}, prev: null, limit: Math.max(3, Math.floor(contentSlides * 0.34)) };
  const chosenBy = {};
  const choices = new Map();
  // One colour per series name across the deck (spec-v2 Amendments 8): a series that recedes beside the
  // highlighted one on a chart with several series keeps that colour when it stands alone on another chart.
  S.seriesRole = new Map();
  for (const spec of resolved.slides || []) {
    for (const item of spec.items || []) {
      const c = item.type === "kpi-table" && item.content;
      if (!c || !c.chart || (c.headers || []).length < 3) continue;
      const names = c.headers.slice(1);
      const primary = primarySeries(names);
      names.forEach((n, i) => { const key = seriesKey(n); if (!S.seriesRole.has(key) || i === primary) S.seriesRole.set(key, i === primary ? "primary" : "other"); });
    }
  }
  // A picture's own proportions, so the layout reads it as drawn (contained in its box).
  for (const spec of resolved.slides || []) {
    for (const item of spec.items || []) {
      if (item.type !== "image" || !item.content || !item.content.src) continue;
      try { item.imageSize = A.readImageSize(A.resolveImagePath(item.content.src, resolved.sourceDir)); } catch { /* drawn as its box */ }
    }
  }
  for (const spec of resolved.slides || []) {
    if (spec.kind === "cover" || spec.kind === "section") continue;
    const chosen = chooseTreatment(spec, S, deck);
    deck.used.add(chosen.t);
    deck.count[chosen.t] = (deck.count[chosen.t] || 0) + 1;
    deck.prev = chosen.t;
    choices.set(spec, chosen);
  }
  for (const line of spreadTreatments(choices, S, pack, (resolved.slides || []).length)) log.push(line);

  for (const spec of resolved.slides || []) {
    const slide = pptx.addSlide();
    slide.background = { color: S.colour("ground") };
    const stamped = A.stampFamily(slide, spec.family);
    A.renderPlacements(slide, spec.placements || [], "under", placementCtx);
    const withDir = { ...spec, sourceDir: resolved.sourceDir };
    if (spec.kind === "cover") COVERS[spec.variant](slide, withDir, S, meta);
    else if (spec.kind === "section") SECTIONS[spec.variant](slide, withDir, S);
    else {
      const chosen = choices.get(spec);
      chosenBy[spec.index] = chosen.t;
      renderContent(slide, spec, S, ctx, chosen);
    }
    A.renderPlacements(slide, spec.placements || [], "content", placementCtx);
    A.renderPlacements(slide, spec.placements || [], "over", placementCtx);
    if (!stamped()) {
      // Nothing unnamed was drawn (a statement alone): an empty marker carries the family.
      slide.addShape("rect", { x: IN(S.grid.margin), y: IN(G.ZONE.top), w: 0, h: 0, fill: { type: "none" }, line: { type: "none" }, objectName: `family@${spec.family}` });
    }
    if (notice) packNotice(slide, S, notice);
  }
  for (const line of log) console.log(line);
  console.log(`Treatments: ${Object.entries(chosenBy).map(([i, t]) => `${Number(i) + 1}:${t}`).join(" ")}`);
  await writeWithEastAsianFaces(pptx, S.faces.body.font, outputPath);
  return outputPath;
}

/**
 * Write the deck with the pack's body face also named for East Asian text in charts and the theme.
 * Chart text otherwise carries only a Latin face, and a renderer sets Hangul axis labels in
 * whatever system font it finds. Korean runs are tagged ko-KR on the way (see writeTagged).
 */
async function writeWithEastAsianFaces(pptx, face, outputPath) {
  await shared().writeTagged(pptx, outputPath, (name, xml) => (/^ppt\/(charts\/chart\d+|theme\/theme\d+)\.xml$/u.test(name)
    ? xml.replace(/<a:ea typeface=""\/>/gu, `<a:ea typeface="${face}"/>`).replace(/(<a:latin typeface="([^"]*)"\/>)(?!<a:ea)/gu, `$1<a:ea typeface="$2"/>`)
    : xml));
}

module.exports = { renderPack, PLANS, COVERS, SECTIONS };
