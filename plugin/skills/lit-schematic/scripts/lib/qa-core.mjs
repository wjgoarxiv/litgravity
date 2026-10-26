// Static QA for lit-schematic SVG files. It parses the file itself (no browser), applies every
// transform, and reads the markers the kit writes (data-sym, data-box, data-ports, data-line,
// data-part, data-hull, data-leader, data-panel, data-legend-item, data-within). A drawing made
// by hand passes only if it carries the same markers, so a checker cannot be silenced by
// leaving geometry unmarked: unmarked strokes still count for STROKE.MIN, unmarked text for
// every text check.

import { boxesOverlap, collinearOverlap, contains, dist, insideLength, overlapArea, pointIn, pointSegmentDistance, segmentIntersection, segmentsOf } from "./geom.mjs";
import { parseEquipmentTag, parseInstrumentTag, parseLineNumber } from "./isa.mjs";
import { mmToPt, textBox } from "./svg.mjs";

// Two leaders closer than this at print size merge into one stroke for the eye.
const LEADER_GAP_MM = 1.2;
function leaderGap(p, q) {
  let best = Infinity;
  for (const [a, b] of segmentsOf(p)) {
    for (const [c, d] of segmentsOf(q)) {
      best = Math.min(best, pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
    }
  }
  return best;
}

export const CODES = Object.freeze({
  "XML.WELLFORMED": "The file is not well-formed XML.",
  "XML.EXTERNAL": "The file loads something from outside itself (href, url() or @import other than #fragment or data:).",
  "SVG.ACTIVE": "The file carries script or event-handler attributes.",
  "SVG.SIZE": "The root needs a viewBox and a physical width and height (mm, cm, in or pt).",
  "TEXT.MIN_SIZE": "Text is smaller than the minimum at final print size.",
  "TEXT.OVERLAP": "Two labels overlap.",
  "TEXT.ON_SYMBOL": "A label sits on a symbol it does not belong to.",
  "TEXT.ON_ART": "A label sits on the drawn object instead of beside it.",
  "TEXT.ON_LINE": "A line runs through a label.",
  "TEXT.CLIPPED": "A label runs past the edge of the drawing.",
  "TEXT.OUT_OF_CELL": "A label runs out of the cell or block it belongs to.",
  "LINE.THROUGH_SYMBOL": "A line passes through a symbol instead of ending at its port.",
  "LINE.DANGLING": "A line ends in the air: not on a port, another line, or a terminal.",
  "LINE.BEND_ON_LINE": "A line turns on top of another line, which reads as a joint.",
  "LINE.OVERLAP": "Two lines run along each other.",
  "LINE.CROSSING": "Two process lines cross without a hop (advisory).",
  "LINE.ARROW_IN_SYMBOL": "A flow arrow is drawn inside a symbol, where it reads as part of the valve or instrument.",
  "LEADER.LOOSE": "A leader does not end on the part it names or does not start at its label.",
  "LEADER.CROSSING": "Two leaders cross.",
  "LEADER.SPACING": "A leader runs closer than 1.2 mm (print size) to another leader or to its dot, so the two read as one.",
  "LINE.NUMBER": "A P&ID line number does not follow size-fluid-sequence-class[-insulation].",
  "STROKE.MIN": "A stroke is thinner than the printable minimum.",
  "SYMBOL.NO_BOX": "A symbol group has no data-box, so nothing can check it.",
  "TAG.GRAMMAR": "A tag does not follow the instrument (ISA-5.1) or equipment tag grammar.",
  "TAG.DUPLICATE": "Two items carry the same tag.",
  "LEGEND.COVERAGE": "A symbol or line kind used in the drawing is missing from the legend.",
  "TITLEBLOCK.FIELDS": "The title block is missing a required field.",
  "PALETTE.CVD": "Two category colours become hard to tell apart for normal or colour-deficient vision.",
  "PANEL.LABELS": "Panel labels are missing, out of order, inconsistent, or not at the panel's top left.",
  "FONT.FAMILIES": "More than two font families are used (advisory).",
});

const ADVISORY = new Set(["LINE.CROSSING", "FONT.FAMILIES"]);

// ------------------------------------------------------------------ XML

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (m, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return ENTITIES[e] ?? m;
});

export function parseXml(text) {
  const root = { name: "#document", attrs: {}, children: [], parent: null };
  let node = root;
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/\s*([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)|(<)/gu;
  let m;
  while ((m = re.exec(text))) {
    if (m[7]) throw new Error(`unexpected "<" at offset ${m.index}`);
    if (m[2]) {
      if (node.name !== m[2]) throw new Error(`closing </${m[2]}> does not match <${node.name}> at offset ${m.index}`);
      node = node.parent;
    } else if (m[3]) {
      const attrs = {};
      for (const a of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) attrs[a[1]] = decode(a[2] ?? a[3] ?? "");
      const child = { name: m[3], attrs, children: [], parent: node, text: "" };
      node.children.push(child);
      if (!m[5]) node = child;
    } else if (m[1] !== undefined) {
      node.text = (node.text ?? "") + m[1];
    } else if (m[6]) {
      if (node !== root) node.text = (node.text ?? "") + decode(m[6]);
      else if (m[6].trim()) throw new Error("text outside the root element");
    }
  }
  if (node !== root) throw new Error(`<${node.name}> is never closed`);
  const elements = root.children.filter((c) => c.name);
  if (elements.length !== 1 || elements[0].name !== "svg") throw new Error("the document root must be a single <svg> element");
  return elements[0];
}

// ------------------------------------------------------------------ transforms

const I = [1, 0, 0, 1, 0, 0];
const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

export function parseTransform(text) {
  let m = I;
  for (const [, op, raw] of String(text ?? "").matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gu)) {
    const v = raw.trim().split(/[\s,]+/u).filter(Boolean).map(Number);
    let t = I;
    if (op === "matrix") t = v;
    else if (op === "translate") t = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    else if (op === "scale") t = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (op === "rotate") {
      const a = ((v[0] ?? 0) * Math.PI) / 180;
      const r = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
      t = v.length >= 3 ? mul(mul([1, 0, 0, 1, v[1], v[2]], r), [1, 0, 0, 1, -v[1], -v[2]]) : r;
    } else if (op === "skewX") t = [1, 0, Math.tan((v[0] * Math.PI) / 180), 1, 0, 0];
    else if (op === "skewY") t = [1, Math.tan((v[0] * Math.PI) / 180), 0, 1, 0, 0];
    m = mul(m, t);
  }
  return m;
}

// ------------------------------------------------------------------ path geometry

function arcPoints(x1, y1, rx, ry, phi, large, sweep, x2, y2) {
  if (rx === 0 || ry === 0) return [[x2, y2]];
  const p = (phi * Math.PI) / 180;
  const cos = Math.cos(p);
  const sin = Math.sin(p);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const steps = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 12)));
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = t1 + (dt * i) / steps;
    const xr = rx * Math.cos(t);
    const yr = ry * Math.sin(t);
    out.push([cos * xr - sin * yr + cx, sin * xr + cos * yr + cy]);
  }
  out[out.length - 1] = [x2, y2];
  return out;
}

export function pathPolylines(d) {
  const tokens = String(d ?? "").match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gu) ?? [];
  const out = [];
  let current = null;
  let x = 0, y = 0, sx = 0, sy = 0, cmd = null, lastCtrl = null;
  let i = 0;
  const num = () => Number(tokens[i++]);
  const start = (px, py) => { current = { points: [[px, py]], closed: false }; out.push(current); x = sx = px; y = sy = py; };
  const to = (px, py) => { if (!current) start(x, y); current.points.push([px, py]); x = px; y = py; };
  const bezier = (pts) => {
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      const mt = 1 - t;
      if (pts.length === 4) to(mt ** 3 * pts[0][0] + 3 * mt * mt * t * pts[1][0] + 3 * mt * t * t * pts[2][0] + t ** 3 * pts[3][0], mt ** 3 * pts[0][1] + 3 * mt * mt * t * pts[1][1] + 3 * mt * t * t * pts[2][1] + t ** 3 * pts[3][1]);
      else to(mt * mt * pts[0][0] + 2 * mt * t * pts[1][0] + t * t * pts[2][0], mt * mt * pts[0][1] + 2 * mt * t * pts[1][1] + t * t * pts[2][1]);
    }
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/u.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new Error("path data starts without a command");
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M": start(ox + num(), oy + num()); cmd = rel ? "l" : "L"; lastCtrl = null; break;
      case "L": to(ox + num(), oy + num()); lastCtrl = null; break;
      case "H": to(ox + num(), y); lastCtrl = null; break;
      case "V": to(x, oy + num()); lastCtrl = null; break;
      case "Z": if (current) { current.closed = true; to(sx, sy); } current = null; x = sx; y = sy; lastCtrl = null; break;
      case "C": { const p1 = [ox + num(), oy + num()]; const p2 = [ox + num(), oy + num()]; const p = [ox + num(), oy + num()]; bezier([[x, y], p1, p2, p]); lastCtrl = p2; break; }
      case "S": { const p1 = lastCtrl ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y]; const p2 = [ox + num(), oy + num()]; const p = [ox + num(), oy + num()]; bezier([[x, y], p1, p2, p]); lastCtrl = p2; break; }
      case "Q": { const p1 = [ox + num(), oy + num()]; const p = [ox + num(), oy + num()]; bezier([[x, y], p1, p]); lastCtrl = p1; break; }
      case "T": { const p1 = lastCtrl ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y]; const p = [ox + num(), oy + num()]; bezier([[x, y], p1, p]); lastCtrl = p1; break; }
      case "A": {
        const rx = num(), ry = num(), phi = num(), large = num(), sweep = num();
        const px = ox + num(), py = oy + num();
        if (!current) start(x, y);
        for (const pt of arcPoints(x, y, rx, ry, phi, large, sweep, px, py)) {
          to(pt[0], pt[1]);
          // A small arc on a line is a hop: its points touch the line it jumps, by design.
          if (Math.max(rx, ry) <= 2) (current.hops ??= new Set()).add(current.points.length - 1);
        }
        lastCtrl = null;
        break;
      }
      default: throw new Error(`unsupported path command ${cmd}`);
    }
  }
  return out;
}

// ------------------------------------------------------------------ colour

const hex = (c) => {
  const s = String(c ?? "").trim().toLowerCase();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/u.exec(s);
  if (!m) return null;
  const v = m[1].length === 3 ? [...m[1]].map((h) => h + h).join("") : m[1];
  return [0, 2, 4].map((k) => parseInt(v.slice(k, k + 2), 16) / 255);
};
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lab = ([r, g, b]) => {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
// Machado, Oliveira and Fernandes (2009), severity 1.0, applied to linear RGB.
const CVD = {
  normal: null,
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
export function deltaE(c1, c2, vision = "normal") {
  const a = hex(c1);
  const b = hex(c2);
  if (!a || !b) return Infinity;
  const sim = (rgb) => {
    const l = rgb.map(lin);
    const m = CVD[vision];
    const v = m ? m.map((row) => Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))) : l;
    return lab(v);
  };
  const p = sim(a);
  const q = sim(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// ------------------------------------------------------------------ collection

const inherited = (node, name) => {
  for (let n = node; n; n = n.parent) {
    if (n.attrs?.[name] !== undefined) return n.attrs[name];
    const style = n.attrs?.style;
    if (style) {
      const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "u").exec(style);
      if (m) return m[1].trim();
    }
  }
  return undefined;
};
const ancestor = (node, attr) => { for (let n = node; n; n = n.parent) if (n.attrs?.[attr] !== undefined) return n; return null; };
const numbers = (s) => String(s ?? "").trim().split(/[\s,]+/u).filter(Boolean).map(Number);
const toMm = (value) => {
  const m = /^(-?[\d.]+)\s*(mm|cm|in|pt|px)?$/u.exec(String(value ?? "").trim());
  if (!m) return null;
  const v = Number(m[1]);
  return { mm: v, cm: v * 10, in: v * 25.4, pt: (v * 25.4) / 72, px: (v * 25.4) / 96, undefined: (v * 25.4) / 96 }[m[2]];
};
// Font sizes and stroke widths: unitless and px values are user units (mm in kit drawings),
// physical units are converted on the assumption that one user unit is one millimetre.
const toUser = (value) => {
  const m = /^(-?[\d.]+)\s*(mm|cm|in|pt|px)?$/u.exec(String(value ?? "").trim());
  if (!m) return null;
  const v = Number(m[1]);
  return { mm: v, cm: v * 10, in: v * 25.4, pt: (v * 25.4) / 72, px: v, undefined: v }[m[2]];
};
const boxFromPoints = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
const transformBox = (m, b) => boxFromPoints([[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map((p) => apply(m, p)));

function polygonHitsBox(poly, box) {
  if (poly.length < 3) return false;
  if (poly.some((p) => pointIn(p, box))) return true;
  const [x0, y0, x1, y1] = box;
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const inside = (p) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if ((poly[i][1] > p[1]) !== (poly[j][1] > p[1]) && p[0] < ((poly[j][0] - poly[i][0]) * (p[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c;
    }
    return c;
  };
  if (corners.some(inside)) return true;
  const edges = [[corners[0], corners[1]], [corners[1], corners[2]], [corners[2], corners[3]], [corners[3], corners[0]]];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (edges.some(([c, d]) => segmentIntersection(a, b, c, d, true))) return true;
  }
  return false;
}

export function collect(svgText) {
  const root = parseXml(svgText);
  const out = { root, texts: [], symbols: [], lines: [], strokes: [], parts: [], leaders: [], dots: [], panels: [], arrows: [], legend: new Set(), titleblock: new Map(), external: [], active: [], families: new Set(), roleColors: new Map(), legendGlyphs: 0 };
  const walk = (node, ctm) => {
    const m = node.attrs.transform ? mul(ctm, parseTransform(node.attrs.transform)) : ctm;
    const a = node.attrs;
    for (const [k, v] of Object.entries(a)) {
      if (/^on/iu.test(k)) out.active.push(k);
      if ((k === "href" || k === "xlink:href") && !/^(?:#|data:)/u.test(v)) out.external.push(v);
      if (/url\(\s*['"]?(?!#|data:)/iu.test(v)) out.external.push(v);
    }
    if (node.name === "script" || node.name === "foreignObject") out.active.push(node.name);
    if (node.name === "style") {
      const css = node.text ?? "";
      if (/@import|url\(\s*['"]?(?!#|data:)/iu.test(css)) out.external.push("style: @import or url()");
    }
    if (a["data-legend-item"]) out.legend.add(a["data-legend-item"]);
    if (a["data-legend-glyph"]) out.legendGlyphs++;
    if (a["data-titleblock-value"]) out.titleblock.set(a["data-titleblock-value"], (out.titleblock.get(a["data-titleblock-value"]) ?? "") + (node.text ?? "").trim());
    if (a["data-sym"]) {
      if (!a["data-box"]) out.symbols.push({ node, kind: a["data-sym"], boxes: [], ports: [], noBox: true });
      else {
        const boxes = a["data-box"].split("|").map((b) => transformBox(m, numbers(b)));
        const ports = (a["data-ports"] ?? "").split(";").filter(Boolean).map((p) => {
          const [name, rest] = p.split(":");
          const v = numbers(rest);
          return { name, point: apply(m, [v[0], v[1]]) };
        });
        out.symbols.push({ node, id: a["data-sym-id"], kind: a["data-sym"], tag: a["data-tag"], boxes, ports });
      }
    }
    if (a["data-part"] && a["data-hull"]) {
      const hull = a["data-hull"].trim().split(/\s+/u).map((p) => apply(m, numbers(p)));
      out.parts.push({ node, name: a["data-part"], hull });
    }
    if (a["data-panel"] && a["data-panel-box"]) out.panels.push({ node, label: a["data-panel"], box: transformBox(m, numbers(a["data-panel-box"])) });
    if (node.name === "circle" && a["data-leader-dot"] !== undefined) out.dots.push({ node, point: apply(m, [Number(a.cx), Number(a.cy)]), r: Number(a.r) * scaleOf(m) });
    if (node.name === "text") {
      const content = [node.text ?? "", ...node.children.filter((c) => c.name === "tspan").map((c) => c.text ?? "")].join("").replace(/\s+/gu, " ").trim();
      if (content) {
        const size = toUser(inherited(node, "font-size") ?? "16") ?? 16;
        const family = inherited(node, "font-family");
        if (family) out.families.add(family.split(",")[0].trim().replace(/['"]/gu, ""));
        const local = textBox(Number(a.x ?? 0), Number(a.y ?? 0), content, size, inherited(node, "text-anchor") ?? "start");
        out.texts.push({
          node, content, size: size * scaleOf(m), box: transformBox(m, local),
          symbol: ancestor(node, "data-sym"), part: ancestor(node, "data-part"),
          label: a["data-label"] ?? "", within: a["data-within"] ? numbers(a["data-within"]) : null, withinM: m,
          legendGlyph: Boolean(ancestor(node, "data-legend-glyph")), panelLabel: a["data-label"] === "panel-label",
          forLeader: a["data-for-leader"] ?? null,
        });
      }
    }
    if (["path", "line", "polyline", "polygon", "rect", "circle", "ellipse"].includes(node.name)) {
      const stroke = inherited(node, "stroke");
      if (stroke && stroke !== "none") {
        const w = toUser(inherited(node, "stroke-width") ?? "1") ?? 1;
        out.strokes.push({ node, width: w * scaleOf(m), legend: Boolean(ancestor(node, "data-legend-glyph") || ancestor(node, "data-legend-item")) });
      }
    }
    if (node.name === "path" && a["data-arrow"]) {
      const pts = pathPolylines(a.d).flatMap((p) => p.points.map((pt) => apply(m, pt)));
      if (pts.length) out.arrows.push({ id: a["data-arrow"], point: [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length] });
    }
    if (node.name === "path" && (a["data-line"] || a["data-leader"])) {
      let polys;
      try {
        polys = pathPolylines(a.d).map((p) => ({ ...p, points: p.points.map((pt) => apply(m, pt)) }));
      } catch (error) {
        polys = [];
        out.active.push(`path parse: ${error.message}`);
      }
      const stroke = inherited(node, "stroke");
      if (a["data-line"]) {
        for (const p of polys) out.lines.push({ node, kind: a["data-line"], id: a["data-line-id"] ?? "", points: p.points, closed: p.closed, hops: p.hops, color: stroke });
        if (a["data-role"] && stroke) out.roleColors.set(a["data-role"], stroke);
      } else {
        for (const p of polys) out.leaders.push({ node, id: a["data-leader"], target: a["data-target"] ?? null, points: p.points });
      }
    }
    for (const child of node.children) walk(child, m);
  };
  walk(root, I);
  return out;
}

// ------------------------------------------------------------------ checks

const isProcess = (kind) => /^(?:process|utility|stream)/u.test(kind);
const at = (p) => `@ ${p[0].toFixed(1)},${p[1].toFixed(1)}`;

export function check(svgText, options = {}) {
  const findings = [];
  const add = (code, message, where = null) => findings.push({ code, level: ADVISORY.has(code) ? "WARN" : "FAIL", message, where });
  let c;
  try {
    c = collect(svgText);
  } catch (error) {
    add("XML.WELLFORMED", error.message);
    return summarize(findings, {});
  }
  const root = c.root;
  const mode = options.mode ?? root.attrs["data-schematic-mode"] ?? "figure";
  const view = numbers(root.attrs.viewBox);
  const width = toMm(root.attrs.width);
  const height = toMm(root.attrs.height);
  if (view.length !== 4 || !width || !height || !/(?:mm|cm|in|pt)$/u.test(root.attrs.width ?? "")) add("SVG.SIZE", `width="${root.attrs.width ?? ""}" height="${root.attrs.height ?? ""}" viewBox="${root.attrs.viewBox ?? ""}"`);
  const unit = view.length === 4 && width ? width / view[2] : 1;
  const canvas = view.length === 4 ? [view[0], view[1], view[0] + view[2], view[1] + view[3]] : [0, 0, Infinity, Infinity];
  for (const e of new Set(c.external)) add("XML.EXTERNAL", e.slice(0, 120));
  for (const e of new Set(c.active)) add("SVG.ACTIVE", e);

  const minPt = options.minTextPt ?? Number(root.attrs["data-min-text-pt"] ?? (mode === "pid" || mode === "pfd" ? 5.6 : 6));
  const minStrokeMm = options.minStrokeMm ?? 0.088;
  const texts = c.texts;
  for (const t of texts) {
    const pt = mmToPt(t.size * unit);
    if (pt < minPt - 0.05) add("TEXT.MIN_SIZE", `"${t.content}" is ${pt.toFixed(1)} pt; the minimum is ${minPt} pt`, [t.box[0], t.box[3]]);
    if (!contains(canvas, t.box, 0.05)) add("TEXT.CLIPPED", `"${t.content}" runs past the drawing edge`, [t.box[0], t.box[3]]);
    if (t.within && !contains(transformBox(t.withinM, t.within), t.box, 0.15)) add("TEXT.OUT_OF_CELL", `"${t.content}" runs out of its block`, [t.box[0], t.box[3]]);
  }
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      const ov = overlapArea(a.box, b.box);
      if (ov > 0.04 * Math.min((a.box[2] - a.box[0]) * (a.box[3] - a.box[1]), (b.box[2] - b.box[0]) * (b.box[3] - b.box[1])) && ov > 0.05) {
        add("TEXT.OVERLAP", `"${a.content}" overlaps "${b.content}"`, [a.box[0], a.box[3]]);
      }
    }
  }
  const symbols = c.symbols.filter((s) => !s.noBox);
  for (const s of c.symbols.filter((s) => s.noBox)) add("SYMBOL.NO_BOX", `${s.kind} has no data-box`);
  for (const t of texts) {
    if (t.legendGlyph) continue;
    for (const s of symbols) {
      if (t.symbol === s.node) continue;
      if (s.boxes.some((b) => boxesOverlap(t.box, b, 0.25))) { add("TEXT.ON_SYMBOL", `"${t.content}" sits on ${s.kind}${s.tag ? ` ${s.tag}` : ""}`, [t.box[0], t.box[3]]); break; }
    }
    if (t.label !== "engraved") {
      for (const p of c.parts) {
        if (t.part === p.node) continue;
        if (polygonHitsBox(p.hull, [t.box[0] + 0.2, t.box[1] + 0.2, t.box[2] - 0.2, t.box[3] - 0.2])) { add("TEXT.ON_ART", `"${t.content}" sits on ${p.name}`, [t.box[0], t.box[3]]); break; }
      }
    }
  }
  const segs = c.lines.flatMap((l) => segmentsOf(l.points).map(([a, b]) => ({ line: l, a, b })));
  for (const t of texts) {
    const inner = [t.box[0] + 0.2, t.box[1] + 0.2, t.box[2] - 0.2, t.box[3] - 0.2];
    if (inner[2] <= inner[0] || inner[3] <= inner[1]) continue;
    const hit = segs.find(({ a, b }) => insideLength(a, b, inner) > 0.05);
    // A stream number sits in its diamond on the line by convention.
    if (hit && !t.symbol && t.label !== "stream-number") add("TEXT.ON_LINE", `${hit.line.kind} ${hit.line.id} runs through "${t.content}"`, [t.box[0], t.box[3]]);
  }

  // Flow arrows sit on open line, never inside a body.
  for (const arrow of c.arrows) {
    const inSym = symbols.find((s) => s.boxes.some((bx) => arrow.point[0] > bx[0] + 0.2 && arrow.point[0] < bx[2] - 0.2 && arrow.point[1] > bx[1] + 0.2 && arrow.point[1] < bx[3] - 0.2));
    if (inSym) add("LINE.ARROW_IN_SYMBOL", `flow arrow on ${arrow.id} sits inside ${inSym.kind}${inSym.tag ? ` ${inSym.tag}` : ""}`, arrow.point);
  }

  // Lines against symbols.
  const portsOf = (s) => s.ports.map((p) => p.point);
  const allPorts = symbols.flatMap((s) => s.ports.map((p) => ({ s, point: p.point })));
  for (const l of c.lines) {
    for (const [a, b] of segmentsOf(l.points)) {
      for (const s of symbols) {
        const shrunk = s.boxes.map((bx) => [bx[0] + 0.25, bx[1] + 0.25, bx[2] - 0.25, bx[3] - 0.25]);
        const inside = shrunk.reduce((sum, bx) => sum + insideLength(a, b, bx), 0);
        if (inside <= 0.3) continue;
        const atPort = portsOf(s).find((p) => dist(p, a) < 0.4 || dist(p, b) < 0.4);
        if (atPort) {
          // Allowed only while running out from the port: once outside, the segment may not re-enter.
          const from = dist(atPort, a) < 0.4 ? a : b;
          const toPt = from === a ? b : a;
          const len = dist(from, toPt);
          let left = false;
          let reenter = false;
          for (let k = 0.25; k < len; k += 0.25) {
            const p = [from[0] + ((toPt[0] - from[0]) * k) / len, from[1] + ((toPt[1] - from[1]) * k) / len];
            const isIn = shrunk.some((bx) => pointIn(p, bx));
            if (!isIn) left = true;
            else if (left) { reenter = true; break; }
          }
          if (!reenter) continue;
        }
        add("LINE.THROUGH_SYMBOL", `${l.kind} ${l.id} passes through ${s.kind}${s.tag ? ` ${s.tag}` : ""}`, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      }
    }
  }
  // Open line ends must land on something.
  const landed = (p, self) => {
    if (allPorts.some(({ point }) => dist(point, p) < 0.45)) return true;
    for (const l of c.lines) {
      if (l === self) continue;
      for (const [a, b] of segmentsOf(l.points)) if (pointSegmentDistance(p, a, b) < 0.35) return true;
    }
    return false;
  };
  for (const l of c.lines) {
    if (l.closed || l.points.length < 2) continue;
    for (const end of [l.points[0], l.points.at(-1)]) {
      if (!landed(end, l)) add("LINE.DANGLING", `${l.kind} ${l.id} ends in the air`, end);
    }
  }
  // Turns on other lines, runs along other lines, and unmarked process crossings.
  for (const l of c.lines) {
    for (let k = 1; k < l.points.length - 1; k++) {
      const v = l.points[k];
      const turn = Math.abs((v[0] - l.points[k - 1][0]) * (l.points[k + 1][1] - v[1]) - (v[1] - l.points[k - 1][1]) * (l.points[k + 1][0] - v[0]));
      if (turn < 1e-3 || l.hops?.has(k)) continue;
      for (const o of c.lines) {
        if (o === l || (o.id && o.id === l.id)) continue;
        const onO = segmentsOf(o.points).some(([a, b]) => pointSegmentDistance(v, a, b) < 0.2) && !(dist(v, o.points[0]) < 0.4 || dist(v, o.points.at(-1)) < 0.4);
        if (onO) { add("LINE.BEND_ON_LINE", `${l.kind} ${l.id} turns on ${o.kind} ${o.id}`, v); break; }
      }
    }
  }
  for (let i = 0; i < c.lines.length; i++) {
    for (let j = i + 1; j < c.lines.length; j++) {
      const p = c.lines[i];
      const q = c.lines[j];
      if (p.id && p.id === q.id) continue;
      for (const [a, b] of segmentsOf(p.points)) {
        for (const [d, e] of segmentsOf(q.points)) {
          if (collinearOverlap(a, b, d, e) > 0.5) add("LINE.OVERLAP", `${p.kind} ${p.id} runs along ${q.kind} ${q.id}`, a);
          else if (isProcess(p.kind) && isProcess(q.kind)) {
            const hit = segmentIntersection(a, b, d, e);
            if (hit) add("LINE.CROSSING", `${p.id} crosses ${q.id} without a hop`, hit.point);
          }
        }
      }
    }
  }
  // Leaders: one end at the label, the other on a dot on the part or symbol it names.
  for (const l of c.leaders) {
    const ends = [l.points[0], l.points.at(-1)];
    const label = texts.find((t) => t.forLeader === l.id);
    const nearLabel = (p) => label && pointSegmentDistance(p, [label.box[0] - 1.5, (label.box[1] + label.box[3]) / 2], [label.box[2] + 1.5, (label.box[1] + label.box[3]) / 2]) < 1.6 + (label.box[3] - label.box[1]) / 2;
    const onTarget = (p) => c.dots.some((d) => dist(d.point, p) <= d.r + 0.3) && (c.parts.some((pt) => polygonHitsBox(pt.hull, [p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3])) || symbols.some((s) => s.boxes.some((b) => pointIn(p, b, -0.3))));
    const named = l.target ? c.parts.filter((pt) => pt.name === l.target) : null;
    if (named && named.length && !ends.some((p) => named.some((pt) => polygonHitsBox(pt.hull, [p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3])))) {
      add("LEADER.LOOSE", `leader ${l.id} names ${l.target} but its dot is not on that part`, ends.at(-1));
    }
    if (!label) add("LEADER.LOOSE", `leader ${l.id} has no label (data-for-leader)`, ends[0]);
    else if (!((nearLabel(ends[0]) && onTarget(ends[1])) || (nearLabel(ends[1]) && onTarget(ends[0])))) add("LEADER.LOOSE", `leader ${l.id} for "${label.content}" does not run from its label to a dot on its part`, ends[1]);
  }
  for (let i = 0; i < c.leaders.length; i++) {
    for (let j = i + 1; j < c.leaders.length; j++) {
      const hit = segmentsOf(c.leaders[i].points).some(([a, b]) => segmentsOf(c.leaders[j].points).some(([d, e]) => segmentIntersection(a, b, d, e)));
      if (hit) add("LEADER.CROSSING", `leaders ${c.leaders[i].id} and ${c.leaders[j].id} cross`, c.leaders[i].points[0]);
      else {
        const gap = leaderGap(c.leaders[i].points, c.leaders[j].points) * unit;
        if (gap < LEADER_GAP_MM) add("LEADER.SPACING", `leaders ${c.leaders[i].id} and ${c.leaders[j].id} come within ${gap.toFixed(2)} mm; keep ${LEADER_GAP_MM} mm (move a dot or the label order)`, c.leaders[i].points.at(-1));
      }
    }
  }
  if (mode === "pid") {
    for (const l of c.lines) {
      const number = l.node.attrs["data-number"];
      if (!number || !isProcess(l.kind)) continue;
      const parsed = parseLineNumber(number);
      if (!parsed.ok) add("LINE.NUMBER", `${l.id} "${number}": ${parsed.error}`, l.points[0]);
    }
  }
  for (const s of c.strokes) {
    const mm = s.width * unit;
    if (mm < minStrokeMm - 1e-4) add("STROKE.MIN", `${s.node.name} stroke ${mm.toFixed(3)} mm (${mmToPt(mm).toFixed(2)} pt) is under ${mmToPt(minStrokeMm).toFixed(2)} pt`);
  }
  // Tags.
  const seen = new Map();
  for (const s of symbols) {
    if (!s.tag) continue;
    const instrument = s.kind.startsWith("instrument.") || s.kind.startsWith("valve.") || s.kind.startsWith("relief.") || s.kind.startsWith("flow.");
    const equipment = /^(?:vessel|pump|compressor|exchanger|package|gas)\./u.test(s.kind);
    const parsed = instrument ? parseInstrumentTag(s.tag) : equipment ? parseEquipmentTag(s.tag) : { ok: true };
    if (!parsed.ok) add("TAG.GRAMMAR", `${s.tag}: ${parsed.error}`);
    if (seen.has(s.tag)) add("TAG.DUPLICATE", `${s.tag} appears on ${seen.get(s.tag)} and ${s.kind}`);
    seen.set(s.tag, s.kind);
  }
  // Legend and title block (sheets).
  if (mode === "pid" || mode === "pfd") {
    const used = new Set([...symbols.map((s) => s.kind), ...c.lines.map((l) => `line:${l.kind}`)]);
    for (const kind of used) if (!c.legend.has(kind)) add("LEGEND.COVERAGE", `${kind} is drawn but not in the legend`);
  } else if (c.legend.size) {
    // Figures label equipment directly; a key must cover every stream colour it uses.
    const roles = new Set(c.lines.map((l) => l.node.attrs["data-role"]).filter(Boolean));
    for (const role of roles) if (!c.legend.has(`role:${role}`)) add("LEGEND.COVERAGE", `stream role ${role} is drawn but not in the key`);
  }
  if (mode === "pid" || mode === "pfd") {
    for (const field of ["title", "number", "rev", "date", "scale"]) {
      const v = c.titleblock.get(field);
      if (!v || v === "-") add("TITLEBLOCK.FIELDS", `title block field "${field}" is empty`);
    }
  }
  // Category colours.
  const roles = [...c.roleColors.entries()].filter(([, color]) => hex(color));
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      if (roles[i][1].toLowerCase() === roles[j][1].toLowerCase()) continue;
      for (const vision of ["normal", "deuteranopia", "protanopia", "tritanopia"]) {
        const d = deltaE(roles[i][1], roles[j][1], vision);
        if (d < (vision === "normal" ? 12 : 9)) { add("PALETTE.CVD", `${roles[i][0]} ${roles[i][1]} and ${roles[j][0]} ${roles[j][1]} differ by dE ${d.toFixed(1)} under ${vision} vision`); break; }
      }
    }
  }
  // Panels.
  if (c.panels.length) {
    const labels = texts.filter((t) => t.panelLabel);
    const expected = c.panels.map((_, i) => String.fromCharCode(97 + i));
    const got = c.panels.map((p) => p.label);
    if (got.join() !== expected.join()) add("PANEL.LABELS", `panels are labelled ${got.join(", ")}; expected ${expected.join(", ")}`);
    const sizes = new Set(labels.map((t) => t.size.toFixed(2)));
    if (labels.length !== c.panels.length) add("PANEL.LABELS", `${c.panels.length} panels but ${labels.length} panel labels`);
    if (sizes.size > 1) add("PANEL.LABELS", "panel labels use different sizes");
    for (const p of c.panels) {
      const t = labels.find((x) => x.content.replace(/[()]/gu, "").toLowerCase() === p.label);
      if (!t) { add("PANEL.LABELS", `panel ${p.label} has no label`); continue; }
      const [x0, y0, x1, y1] = p.box;
      if (!(t.box[0] <= x0 + (x1 - x0) * 0.2 && t.box[1] <= y0 + (y1 - y0) * 0.2 && contains(grow4(p.box, 0.5), t.box))) add("PANEL.LABELS", `label ${t.content} is not at the top left of its panel`, [t.box[0], t.box[3]]);
    }
  }
  if (c.families.size > 2) add("FONT.FAMILIES", `families: ${[...c.families].join(", ")}`);
  return summarize(findings, { mode, texts: texts.length, symbols: symbols.length, lines: c.lines.length, leaders: c.leaders.length, parts: c.parts.length, widthMm: width, heightMm: height });
}

const grow4 = (b, by) => [b[0] - by, b[1] - by, b[2] + by, b[3] + by];

function summarize(findings, stats) {
  const unique = [];
  const keys = new Set();
  for (const f of findings) {
    const key = `${f.code}|${f.message}`;
    if (keys.has(key)) continue;
    keys.add(key);
    unique.push(f);
  }
  const fails = unique.filter((f) => f.level === "FAIL");
  return { verdict: fails.length ? "FAIL" : "PASS", fails: fails.length, warnings: unique.length - fails.length, findings: unique, stats };
}

export function formatReport(result, file = "") {
  const lines = result.findings.map((f) => `${f.level} ${f.code} ${f.message}${f.where ? ` ${at(f.where)}` : ""}`);
  const s = result.stats;
  lines.push(`QA ${result.verdict}${file ? ` ${file}` : ""} · ${result.fails} fail · ${result.warnings} warn${s.mode ? ` · mode ${s.mode} · ${s.symbols} symbols · ${s.lines} lines · ${s.texts} labels` : ""}`);
  return lines.join("\n");
}
