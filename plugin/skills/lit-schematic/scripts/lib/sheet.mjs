// Canvas and drawing sheet for P&IDs, PFDs and 2D apparatus panels.
//
// A canvas owns symbols and lines in one millimetre space: it routes pipes between ports,
// places inline valves by splitting the pipe under them, hops later process lines over
// earlier ones, puts junction dots on branches, places line numbers and equipment tags
// where they collide with nothing, and records a warning for anything it could not place.
// A sheet is a canvas on an ISO A-series page with a zone frame, an equipment header band,
// a legend built from what was drawn, numbered notes and an ISO 7200 style title block.

import { boxesOverlap, contains, dist, grow, pathLength, pointAlong, segmentIntersection, segmentsOf } from "./geom.mjs";
import { parseInstrumentTag } from "./isa.mjs";
import * as pid from "./pid.mjs";
import { orthogonal, routeOrthogonal } from "./route.mjs";
import { el, esc, n, pathOf, svgDocument, textBox, textWidthEm } from "./svg.mjs";
import { FONT_LATIN, PID, STREAM, fontFor } from "./theme.mjs";

const W = PID.weight;

// Pipe classes differ by weight (PID.weight); instrument lines follow ANSI/ISA-5.1-2009
// Table 5.3.1 (instrument to process: thin solid) and Table 5.3.2 (instrument to instrument:
// each signal medium has its own mark).
export const LINE_KINDS = Object.freeze({
  "process-major": { width: W.major, label: "Main process line" },
  "process-minor": { width: W.minor, label: "Minor process line" },
  utility: { width: W.utility, label: "Utility line" },
  connection: { width: W.connection, label: "Instrument supply or process connection" },
  "signal-electric": { width: W.signal, dash: "1.6 0.9", label: "Electric or electronic signal" },
  "signal-pneumatic": { width: W.signal, marks: "slash", label: "Pneumatic signal" },
  "signal-hydraulic": { width: W.signal, marks: "ell", label: "Hydraulic signal" },
  "signal-capillary": { width: W.signal, marks: "cross", label: "Filled-system capillary tube" },
  "signal-guided": { width: W.signal, marks: "wave", label: "Guided electromagnetic or sonic signal" },
  "signal-unguided": { width: W.signal, marks: "wave-gap", label: "Unguided electromagnetic signal (radio)" },
  "signal-data": { width: W.signal, marks: "circle", label: "Data link within a control system" },
  "signal-mechanical": { width: W.signal, marks: "dot", label: "Mechanical link" },
  stream: { width: 0.35, label: "Process stream" },
});

// Round-1 names that builds may still pass.
const SIGNAL_ALIASES = Object.freeze({ software: "data" });

const isProcess = (kind) => kind === "process-major" || kind === "process-minor" || kind === "utility" || kind === "stream";
const isWave = (kind) => LINE_KINDS[kind]?.marks === "wave" || LINE_KINDS[kind]?.marks === "wave-gap";

// A sine wave riding a polyline, for electromagnetic and sonic signals. With gaps, every other
// period is left out so the wave reads as broken (unguided).
function wavePath(points, { amplitude = 0.7, period = 2.4, gaps = false } = {}) {
  const total = pathLength(points);
  const step = period / 12;
  let d = "";
  let pen = false;
  for (let s = 0; s <= total + 1e-6; s += step) {
    const { point: [x, y], direction: [dx, dy] } = pointAlong(points, Math.min(s, total));
    const phase = (s / period) * Math.PI * 2;
    const visible = !gaps || Math.floor(s / period) % 2 === 0 || s < 0.5 || s > total - 0.5;
    const off = s < 0.6 || s > total - 0.6 ? 0 : Math.sin(phase) * amplitude;
    const px = x - dy * off;
    const py = y + dx * off;
    if (!visible) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${n(px)} ${n(py)}`;
    pen = true;
  }
  return d;
}

export const SHEETS = Object.freeze({ A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594] });

function wrap(text, width, size) {
  const words = String(text).split(/\s+/u).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && textWidthEm(next) * size > width) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

const textEl = (x, y, text, size, extra = {}) =>
  el("text", { x, y, "font-family": fontFor(text), "font-size": size, fill: PID.ink, ...extra }, esc(text));

function rotatedBox(x, y, text, size, anchor, rotate) {
  const box = textBox(x, y, text, size, anchor);
  if (!rotate) return box;
  // rotate(-90) about (x, y): local (dx, dy) -> (dy, -dx)
  const pts = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]].map(([px, py]) => {
    const dx = px - x;
    const dy = py - y;
    return rotate === -90 ? [x + dy, y - dx] : [x - dy, y + dx];
  });
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
}

// Arc length along a polyline of the point nearest to p.
function nearestArc(points, p) {
  let best = { d: Infinity, s: 0 };
  let s0 = 0;
  for (const [a, b] of segmentsOf(points)) {
    const len = dist(a, b);
    const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (len * len))) : 0;
    const d = dist([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], p);
    if (d < best.d) best = { d, s: s0 + len * t };
    s0 += len;
  }
  return best.s;
}

// The marks that name a line class: hash marks, crosses, ells, circles, dots or a wave.
export function lineMarks(points, kind, stroke, { first = 4, every = 6 } = {}) {
  const spec = LINE_KINDS[kind];
  if (!spec.marks) return "";
  if (isWave(kind)) {
    return el("path", { d: wavePath(points, spec.marks === "wave-gap" ? { gaps: true, period: 3.6, amplitude: 0.8 } : {}), stroke, "stroke-width": spec.width, fill: "none", "stroke-linejoin": "round", "data-line-mark": kind });
  }
  const total = pathLength(points);
  const out = [];
  for (let s = first; s <= total - Math.min(3, first); s += every) {
    const { point: [x, y], direction: [dx, dy] } = pointAlong(points, s);
    const nx = -dy;
    const ny = dx;
    if (spec.marks === "slash") {
      for (const o of [-0.5, 0.5]) {
        const cx = x + dx * o;
        const cy = y + dy * o;
        out.push(pathOf([[cx - nx * 1.1 - dx * 0.6, cy - ny * 1.1 - dy * 0.6], [cx + nx * 1.1 + dx * 0.6, cy + ny * 1.1 + dy * 0.6]]));
      }
    } else if (spec.marks === "cross") {
      out.push(pathOf([[x - nx - dx, y - ny - dy], [x + nx + dx, y + ny + dy]]), pathOf([[x - nx + dx, y - ny + dy], [x + nx - dx, y + ny - dy]]));
    } else if (spec.marks === "ell") {
      out.push(pathOf([[x + nx * 1.2, y + ny * 1.2], [x, y], [x + dx * 1.2, y + dy * 1.2]]));
    } else if (spec.marks === "circle" || spec.marks === "dot") {
      out.push(`M${n(x + 0.55)} ${n(y)}A0.55 0.55 0 1 0 ${n(x - 0.55)} ${n(y)}A0.55 0.55 0 1 0 ${n(x + 0.55)} ${n(y)}`);
    }
  }
  const fill = spec.marks === "circle" ? "#ffffff" : spec.marks === "dot" ? stroke : "none";
  return out.length ? el("path", { d: out.join(""), stroke, "stroke-width": spec.width, fill, "data-line-mark": kind }) : "";
}

export function createCanvas({ box, style = "pid", grid = style === "pid" ? 2.5 : 1, clearance = style === "pid" ? 2.2 : 1.2, stub = style === "pid" ? 6.2 : 3, labelSize = 2.47 } = {}) {
  if (!box) throw new Error("createCanvas: box [x0, y0, x1, y1] in millimetres is required");
  const symbols = [];
  const lines = [];
  const labels = [];
  const fixedLabels = [];
  const extras = [];
  const warnings = [];
  const junctions = [];
  let lineCounter = 0;

  const occupiedBoxes = () => symbols.flatMap((s) => s.boxes);
  const labelBoxes = () => labels.map((l) => l.box);
  const zoneSegments = [];
  const drawnSegments = () => [...lines.flatMap((l) => l.pieces.flatMap((p) => segmentsOf(p))), ...zoneSegments];

  function add(sym) {
    for (const other of symbols) {
      for (const a of sym.boxes) for (const b of other.boxes) {
        if (boxesOverlap(a, b, -0.01)) warnings.push(`symbols overlap: ${sym.kind}${sym.tag ? ` ${sym.tag}` : ""} and ${other.kind}${other.tag ? ` ${other.tag}` : ""}`);
      }
    }
    if (!sym.boxes.every((b) => contains(box, b, 0.01))) warnings.push(`symbol outside the canvas: ${sym.kind}${sym.tag ? ` ${sym.tag}` : ""}`);
    symbols.push(sym);
    return sym;
  }

  function buildLine({ from, to, via = [], points = null, kind, number = null, role = null, color = null, arrows = "auto", label = null }) {
    if (!LINE_KINDS[kind]) throw new Error(`line kind must be one of ${Object.keys(LINE_KINDS).join(", ")}`);
    let path;
    const existing = lines.map((l) => l.points);
    if (points) {
      path = orthogonal([[from.x, from.y], ...points, [to.x, to.y]], { from, to });
    } else {
      const stops = [from, ...via.map(([x, y]) => ({ x, y, dir: null })), to];
      path = [];
      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i];
        const b = stops[i + 1];
        const dirA = a.dir ?? (i > 0 ? null : [1, 0]);
        const dirB = b.dir ?? null;
        const leg = routeOrthogonal({
          from: { x: a.x, y: a.y, dir: dirA ?? guessDir(a, b) },
          to: { x: b.x, y: b.y, dir: dirB ?? guessDir(b, a) },
          obstacles: [...occupiedBoxes(), ...fixedLabels.map((l) => l.box)],
          exempt: symbols.filter((sym) => sym.id === a.owner || sym.id === b.owner).flatMap((sym) => sym.boxes),
          lines: [...existing, path],
          bounds: box,
          grid,
          clearance,
          stub: a.dir ? stub : 0.0001,
        });
        path = path.length ? [...path, ...leg.slice(1)] : leg;
      }
    }
    const id = `L${++lineCounter}`;
    const line = { id, kind, number, role, color, points: path, gaps: [], arrows, label, pieces: [path], from, to, taps: [] };
    line.tap = (at = 0.5) => {
      const total = pathLength(line.points);
      const s = Array.isArray(at) ? nearestArc(line.points, at) : at <= 1 ? at * total : at;
      const { point, direction } = pointAlong(line.points, s);
      if (Array.isArray(at) && dist(point, at) > 1) {
        throw new Error(`tap: (${at}) is ${n(dist(point, at))} mm from ${line.id}; the nearest point on it is (${n(point[0])}, ${n(point[1])})`);
      }
      const corners = line.points.slice(1, -1);
      if (corners.some((c) => dist(c, point) < 3)) {
        throw new Error(`tap: (${n(point[0])}, ${n(point[1])}) is within 3 mm of a bend in ${line.id}; a branch must leave a straight run`);
      }
      const side = [-direction[1], direction[0]];
      const tapPort = { x: point[0], y: point[1], dir: [Math.round(side[0]), Math.round(side[1])], owner: id, name: "tap" };
      tapPort.flip = () => ({ ...tapPort, dir: [-tapPort.dir[0], -tapPort.dir[1]] });
      junctions.push(point);
      line.taps.push(point);
      return tapPort;
    };
    line.at = (fraction) => pointAlong(line.points, fraction * pathLength(line.points));
    lines.push(line);
    return line;
  }

  const guessDir = (a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
  };

  // Places an inline symbol on a straight run of `line` and gaps the line under it.
  function inline(lineObj, factory, options = {}) {
    const total = pathLength(lineObj.points);
    let at = options.at ?? 0.5;
    if (Array.isArray(at)) at = nearestArc(lineObj.points, at) / total;
    const wanted = at * total;
    // Measure the symbol once at the origin to learn how far its ports reach along the line.
    const probe = factory({ ...options, x: 0, y: 0, orient: "right" });
    const reachA = Math.abs(probe.port("a").x);
    const reachB = Math.abs(probe.port("b").x);
    const margin = 1.5;
    let s = null;
    let corner = 0;
    for (const [a, b] of segmentsOf(lineObj.points)) {
      const len = dist(a, b);
      const lo = corner + reachA + margin;
      const hi = corner + len - reachB - margin;
      if (hi >= lo) {
        const candidate = Math.min(hi, Math.max(lo, wanted));
        if (s === null || Math.abs(candidate - wanted) < Math.abs(s - wanted)) s = candidate;
      }
      corner += len;
    }
    if (s === null) throw new Error(`inline: no straight run of ${lineObj.id} is long enough for ${probe.kind}; lengthen the line or use a smaller symbol`);
    const { point, direction } = pointAlong(lineObj.points, s);
    const orient = direction[0] > 0.5 ? "right" : direction[0] < -0.5 ? "left" : direction[1] > 0.5 ? "down" : "up";
    const sym = factory({ ...options, x: point[0], y: point[1], orient: options.orient ?? orient });
    const sa = s - reachA;
    const sb = s + reachB;
    lineObj.gaps.push([sa, sb]);
    symbols.push(sym);
    return sym;
  }

  function finalizePieces(lineObj) {
    const total = pathLength(lineObj.points);
    const gaps = [...lineObj.gaps].sort((a, b) => a[0] - b[0]);
    const spans = [];
    let cursor = 0;
    for (const [g0, g1] of gaps) {
      if (g0 > cursor + 1e-6) spans.push([cursor, g0]);
      cursor = Math.max(cursor, g1);
    }
    if (total > cursor + 1e-6) spans.push([cursor, total]);
    lineObj.pieces = spans.map(([a, b]) => cut(lineObj.points, a, b));
  }

  function cut(points, from, to) {
    const out = [pointAlong(points, from).point];
    let s = 0;
    for (const [a, b] of segmentsOf(points)) {
      const len = dist(a, b);
      if (s + len > from + 1e-6 && s + len < to - 1e-6) out.push(b);
      s += len;
    }
    out.push(pointAlong(points, to).point);
    return out;
  }

  // Draws a polyline with hops where it crosses earlier process lines.
  function hopped(points, earlier) {
    const r = 1.2;
    let d = `M${n(points[0][0])} ${n(points[0][1])}`;
    for (const [a, b] of segmentsOf(points)) {
      const len = dist(a, b);
      const ux = (b[0] - a[0]) / len;
      const uy = (b[1] - a[1]) / len;
      const hits = [];
      for (const [c, e] of earlier) {
        const hit = segmentIntersection(a, b, c, e);
        if (hit && hit.t * len > r + 0.2 && (1 - hit.t) * len > r + 0.2) hits.push(hit.t * len);
      }
      hits.sort((p, q) => p - q);
      for (const s of hits) {
        const p0 = [a[0] + ux * (s - r), a[1] + uy * (s - r)];
        const p1 = [a[0] + ux * (s + r), a[1] + uy * (s + r)];
        const sweep = Math.abs(uy) > 0.5 ? (uy > 0 ? 0 : 1) : ux > 0 ? 1 : 0;
        d += `L${n(p0[0])} ${n(p0[1])}A${n(r)} ${n(r)} 0 0 ${sweep} ${n(p1[0])} ${n(p1[1])}`;
      }
      d += `L${n(b[0])} ${n(b[1])}`;
    }
    return d;
  }

  function arrowsFor(lineObj, stroke) {
    if (lineObj.arrows === false || !isProcess(lineObj.kind)) return "";
    const out = [];
    const wanted = Array.isArray(lineObj.arrows) ? lineObj.arrows : null;
    const pieces = lineObj.pieces;
    const candidates = [];
    for (const piece of pieces) for (const [a, b] of segmentsOf(piece)) candidates.push([a, b, dist(a, b)]);
    // An arrow keeps clear of junction dots, symbols and the line's own taps.
    const crowded = (p) => junctions.some((j) => dist(j, p) < 3.5) || occupiedBoxes().some((b) => boxesOverlap(grow(b, 1.5), [p[0], p[1], p[0], p[1]]));
    const auto = () => {
      for (const [a, b, len] of candidates.filter((c) => c[2] >= 10).sort((p, q) => q[2] - p[2])) {
        for (const f of [0.5, 0.35, 0.65, 0.25, 0.75]) {
          const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
          if (!crowded(p)) return [[p, [(b[0] - a[0]) / len, (b[1] - a[1]) / len]]];
        }
      }
      return [];
    };
    // An asked-for arrow that lands on a valve or instrument slides along the line to open pipe.
    const inSymbol = (p) => occupiedBoxes().some((b) => boxesOverlap(grow(b, 1.5), [p[0], p[1], p[0], p[1]]));
    const total = pathLength(lineObj.points);
    const asked = (f) => {
      for (let k = 0; k <= 60; k++) {
        for (const sign of k ? [1, -1] : [1]) {
          const g = f + (sign * k * 0.5) / total;
          if (g < 0 || g > 1) continue;
          const { point, direction } = lineObj.at(g);
          if (!inSymbol(point)) return [point, direction];
        }
      }
      warnings.push(`flow arrow at ${f} on ${lineObj.id} has no open pipe within 30 mm; drop it or move it`);
      const { point, direction } = lineObj.at(f);
      return [point, direction];
    };
    const chosen = wanted ? wanted.map(asked) : auto();
    for (const [[x, y], [dx, dy]] of chosen) {
      const nx = -dy;
      const ny = dx;
      const tip = [x + dx * 1.3, y + dy * 1.3];
      out.push(el("path", { d: pathOf([tip, [x - dx * 1.3 + nx * 0.95, y - dy * 1.3 + ny * 0.95], [x - dx * 1.3 - nx * 0.95, y - dy * 1.3 - ny * 0.95]], true), fill: stroke, stroke: "none", "data-arrow": lineObj.id }));
    }
    return out.join("");
  }

  function placeLabel({ text, size, candidates, owner, extra = {}, bold = false }) {
    const syms = occupiedBoxes();
    const segs = drawnSegments();
    for (const c of candidates) {
      const b = rotatedBox(c.x, c.y, text, size, c.anchor, c.rotate);
      if (!contains(box, b, 0.01)) continue;
      if (syms.some((s) => boxesOverlap(grow(b, 0.4), s))) continue;
      if (labelBoxes().some((l) => boxesOverlap(grow(b, 0.5), l))) continue;
      if (segs.some(([a, e]) => segmentHitsBox(a, e, grow(b, 0.3)))) continue;
      labels.push({ box: b, owner });
      return textEl(c.x, c.y, text, size, {
        "text-anchor": c.anchor,
        transform: c.rotate ? `rotate(${c.rotate} ${n(c.x)} ${n(c.y)})` : undefined,
        "font-weight": bold ? "bold" : undefined,
        ...extra,
      });
    }
    warnings.push(`no clear place for label "${text}" (${owner}); move nearby symbols or shorten it`);
    const c = candidates[0];
    labels.push({ box: rotatedBox(c.x, c.y, text, size, c.anchor, c.rotate), owner });
    return textEl(c.x, c.y, text, size, { "text-anchor": c.anchor, transform: c.rotate ? `rotate(${c.rotate} ${n(c.x)} ${n(c.y)})` : undefined, "font-weight": bold ? "bold" : undefined, ...extra });
  }

  const segmentHitsBox = (a, b, [x0, y0, x1, y1]) => {
    const inside = (p) => p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1;
    if (inside(a) || inside(b)) return true;
    const edges = [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]];
    return edges.some(([c, d]) => segmentIntersection(a, b, c, d, true));
  };

  function lineNumberLabel(lineObj) {
    if (!lineObj.number) return "";
    const size = PID.text.line;
    const candidates = [];
    const segs = lineObj.pieces.flatMap((p) => segmentsOf(p)).map(([a, b]) => [a, b, dist(a, b)]).sort((p, q) => q[2] - p[2]);
    for (const [a, b, len] of segs) {
      if (len < textWidthEm(lineObj.number) * size + 4) continue;
      const horizontal = Math.abs(a[1] - b[1]) < 1e-6;
      for (const f of [0.5, 0.3, 0.7, 0.2, 0.8]) {
        const mx = a[0] + (b[0] - a[0]) * f;
        const my = a[1] + (b[1] - a[1]) * f;
        if (horizontal) {
          candidates.push({ x: mx, y: my - 1.3, anchor: "middle" }, { x: mx, y: my + size + 0.9, anchor: "middle" });
        } else {
          candidates.push({ x: mx - 1.3, y: my, anchor: "middle", rotate: -90 }, { x: mx + size + 0.9, y: my, anchor: "middle", rotate: -90 });
        }
      }
    }
    if (!candidates.length) {
      warnings.push(`line ${lineObj.id} (${lineObj.number}) has no straight run long enough for its number`);
      return "";
    }
    return placeLabel({ text: lineObj.number, size, candidates, owner: lineObj.id, extra: { "data-label": "line-number", "data-for-line": lineObj.id } });
  }

  function equipmentLabel(sym) {
    const text = style === "pid" ? sym.tag : sym.label ?? sym.tag;
    if (!text || /^(?:instrument|valve|relief|flow|line|terminal|logic)\./u.test(sym.kind)) return "";
    const size = style === "pid" ? PID.text.equipment : labelSize;
    const [x0, y0, x1, y1] = sym.box;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const candidates = [
      { x: cx, y: y1 + size + 1.2, anchor: "middle" },
      { x: cx, y: y0 - 1.4, anchor: "middle" },
      { x: x1 + 1.6, y: cy + size * 0.35, anchor: "start" },
      { x: x0 - 1.6, y: cy + size * 0.35, anchor: "end" },
      { x: x1 + 1.6, y: y1, anchor: "start" },
      { x: x0 - 1.6, y: y1, anchor: "end" },
      ...[0.3, 0.7, 0.15, 0.85].flatMap((f) => [
        { x: x1 + 1.6, y: y0 + (y1 - y0) * f + size * 0.35, anchor: "start" },
        { x: x0 - 1.6, y: y0 + (y1 - y0) * f + size * 0.35, anchor: "end" },
      ]),
    ];
    return placeLabel({ text, size, candidates, owner: sym.id, bold: style === "pid", extra: { "data-label": "equipment-tag", "data-for-sym": sym.id } });
  }

  function valveTagLabel(sym) {
    if (!sym.tag || !(sym.kind.startsWith("valve.") || sym.kind.startsWith("relief.") || sym.kind.startsWith("flow."))) return "";
    const size = PID.text.small;
    const [x0, y0, x1, y1] = sym.box;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const candidates = [
      { x: cx, y: y1 + size + 0.8, anchor: "middle" },
      { x: cx, y: y0 - 0.9, anchor: "middle" },
      { x: x1 + 1.2, y: cy + size * 0.35, anchor: "start" },
      { x: x0 - 1.2, y: cy + size * 0.35, anchor: "end" },
    ];
    return placeLabel({ text: sym.tag, size, candidates, owner: sym.id, extra: { "data-label": "valve-tag", "data-for-sym": sym.id } });
  }

  function lineStroke(lineObj) {
    if (style === "pid") return PID.ink;
    if (lineObj.color) return lineObj.color;
    if (lineObj.role && STREAM[lineObj.role]) return STREAM[lineObj.role].color;
    return PID.ink;
  }

  function renderLines() {
    const out = [];
    const drawnProcess = [];
    for (const lineObj of lines) finalizePieces(lineObj);
    for (const lineObj of lines) {
      const spec = LINE_KINDS[lineObj.kind];
      const stroke = lineStroke(lineObj);
      const dash = lineObj.role && STREAM[lineObj.role]?.dash && style !== "pid" ? STREAM[lineObj.role].dash : spec.dash;
      const width = lineObj.kind === "stream" && lineObj.width ? lineObj.width : spec.width;
      for (const piece of lineObj.pieces) {
        const d = isProcess(lineObj.kind) ? hopped(piece, drawnProcess) : pathOf(piece);
        // A wave signal keeps its route as an unstroked carrier; the wave itself is the mark.
        out.push(el("path", {
          d, fill: "none", stroke: isWave(lineObj.kind) ? "none" : stroke, "stroke-width": width, "stroke-dasharray": dash, "stroke-linejoin": "round", "stroke-linecap": "butt",
          "data-line": lineObj.kind, "data-line-id": lineObj.id, "data-role": lineObj.role ?? undefined, "data-number": lineObj.number ?? undefined,
        }));
        out.push(lineMarks(piece, lineObj.kind, stroke));
      }
      out.push(arrowsFor(lineObj, stroke));
      if (isProcess(lineObj.kind)) for (const piece of lineObj.pieces) drawnProcess.push(...segmentsOf(piece));
    }
    for (const [x, y] of junctions) out.push(el("circle", { cx: x, cy: y, r: 0.65, fill: PID.ink, stroke: "none", "data-junction": "1" }));
    return out.join("");
  }

  function render() {
    labels.length = 0;
    labels.push(...fixedLabels);
    const lineSvg = renderLines();
    const symbolSvg = symbols.map((s) => s.svg()).join("");
    const tagSvg = [
      ...symbols.map(equipmentLabel),
      ...symbols.map(valveTagLabel),
      ...lines.map(lineNumberLabel),
    ].join("");
    return `<g data-canvas="${esc(style)}" data-canvas-box="${box.map(n).join(" ")}">${lineSvg}${symbolSvg}${tagSvg}${extras.join("")}</g>`;
  }

  return {
    box,
    style,
    symbols,
    lines,
    warnings,
    add,
    inline,
    pipe: (opts) => buildLine({ kind: opts.kind ?? "process-major", ...opts }),
    signal: (opts) => buildLine({ kind: opts.type ? `signal-${SIGNAL_ALIASES[opts.type] ?? opts.type}` : "signal-electric", arrows: false, ...opts }),
    connect: (opts) => buildLine({ kind: "connection", arrows: false, ...opts }),
    stream: (opts) => buildLine({ kind: "stream", ...opts }),
    text: (x, y, text, { size = PID.text.label, anchor = "start", bold = false, color = PID.ink, kind = "note" } = {}) => {
      const b = textBox(x, y, text, size, anchor);
      fixedLabels.push({ box: b, owner: "text" });
      extras.push(textEl(x, y, text, size, { "text-anchor": anchor, "font-weight": bold ? "bold" : undefined, fill: color, "data-label": kind }));
    },
    raw: (svg) => extras.push(svg),
    streamNumbers: () => extras.some((x) => x.includes("data-stream-number")),
    // PFD stream number: a diamond on a straight run of the line with the number inside.
    streamNumber: (lineObj, number, { at = 0.5 } = {}) => {
      const total = pathLength(lineObj.points);
      let s = at * total;
      const segs = [];
      let s0 = 0;
      for (const [a, b] of segmentsOf(lineObj.points)) { const len = dist(a, b); segs.push([s0, s0 + len]); s0 += len; }
      const fits = segs.filter(([lo, hi]) => hi - lo > 12);
      if (!fits.length) throw new Error(`streamNumber: ${lineObj.id} has no straight run of 12 mm for the marker`);
      const best = fits.reduce((p, q) => (Math.abs((p[0] + p[1]) / 2 - s) < Math.abs((q[0] + q[1]) / 2 - s) ? p : q));
      s = Math.min(best[1] - 6, Math.max(best[0] + 6, s));
      const { point: [x, y] } = pointAlong(lineObj.points, s);
      const r = 3.2;
      const size = style === "pid" ? PID.text.small : labelSize;
      fixedLabels.push({ box: [x - r, y - r, x + r, y + r], owner: "stream" });
      extras.push(el("g", { "data-stream-number": String(number), "data-for-line": lineObj.id },
        el("path", { d: pathOf([[x, y - r], [x + r, y], [x, y + r], [x - r, y]], true), fill: "#ffffff", stroke: PID.ink, "stroke-width": W.symbol, "data-line-mark": "stream-number" }),
        textEl(x, y + size * 0.36, String(number), size, { "text-anchor": "middle", "data-label": "stream-number" })));
    },
    // A stream table: one column per stream number, one row per property, inside `box`.
    streamTable: ({ box: [x0, y0, x1], streams, rows, title = "STREAM TABLE" }) => {
      const size = style === "pid" ? PID.text.small : labelSize;
      const rowH = size + 2;
      const headW = Math.max(...rows.map((r) => textWidthEm(r.label) * size)) + 3;
      const colW = (x1 - x0 - headW) / streams.length;
      const out = [textEl(x0, y0 + size, title, size, { "font-weight": "bold", "data-label": "stream-table" })];
      const top = y0 + size + 1.5;
      const cell = (cx, cy, w, text, bold = false) => {
        const within = [cx, cy, cx + w, cy + rowH];
        out.push(el("path", { d: pathOf([[cx, cy], [cx + w, cy], [cx + w, cy + rowH], [cx, cy + rowH]], true), fill: "none", stroke: PID.ink, "stroke-width": W.detail }));
        out.push(textEl(cx + 1, cy + rowH - 1.1, text, size, { "data-label": "stream-table", "data-within": within.map(n).join(" "), "font-weight": bold ? "bold" : undefined }));
      };
      cell(x0, top, headW, "Stream", true);
      streams.forEach((st, i) => cell(x0 + headW + i * colW, top, colW, String(st), true));
      rows.forEach((row, j) => {
        cell(x0, top + (j + 1) * rowH, headW, row.label);
        row.values.forEach((v, i) => cell(x0 + headW + i * colW, top + (j + 1) * rowH, colW, String(v)));
      });
      const y1 = top + (rows.length + 1) * rowH;
      fixedLabels.push({ box: [x0, y0, x1, y1], owner: "table" });
      extras.push(el("g", { "data-stream-table": "1" }, out));
      return y1;
    },
    // A dashed boundary around equipment that shares an enclosure (oven, cold box, skid, fume
    // hood). It is not a symbol: lines may cross it, and its name sits inside its top-left corner.
    zone: ([x0, y0, x1, y1], name, { color = "#555555" } = {}) => {
      zoneSegments.push(...segmentsOf([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]));
      extras.push(el("path", { d: pathOf([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true), fill: "none", stroke: color, "stroke-width": 0.25, "stroke-dasharray": "1.6 0.9", "data-zone": name }));
      if (name) {
        const size = style === "pid" ? PID.text.small : labelSize;
        fixedLabels.push({ box: textBox(x0 + 1.2, y0 + size + 0.8, name, size, "start"), owner: "zone" });
        extras.push(textEl(x0 + 1.2, y0 + size + 0.8, name, size, { "data-label": "zone", fill: color }));
      }
    },
    render,
  };
}

// ------------------------------------------------------------------ sheet

// A legend sample of any kind the library draws, built at (x, y). Composed kinds (a valve body
// with its actuator, an instrument function at a location) are rebuilt from their names, so
// the legend always shows the symbol as drawn.
export function legendSample(kind, x, y) {
  const fixed = {
    "vessel.vertical": () => pid.vessel({ x, y, w: 5, h: 8 }),
    "vessel.reactor": () => pid.vessel({ x, y: y + 1, w: 5, h: 7, agitator: "turbine", jacket: true }),
    "vessel.jacketed": () => pid.vessel({ x, y, w: 5, h: 8, jacket: true }),
    "vessel.horizontal": () => pid.drum({ x, y, w: 9, h: 4.4, saddles: false }),
    "vessel.column": () => pid.vessel({ x, y, w: 4, h: 9, trays: 3, kind: "vessel.column" }),
    "vessel.tank": () => pid.tank({ x, y, w: 7, h: 7 }),
    "gas.cylinder": () => pid.gasCylinder({ x, y: y + 0.8, w: 3.4, h: 7 }),
    "pump.centrifugal": () => pid.pump({ x, y, r: 2.6 }),
    "pump.positive": () => pid.pump({ x, y, r: 2.6, type: "positive" }),
    "pump.metering": () => pid.pump({ x, y, r: 2.6, type: "metering" }),
    "compressor.centrifugal": () => pid.compressor({ x, y, r: 3.2 }),
    "compressor.reciprocating": () => pid.compressor({ x, y, r: 3.2, type: "reciprocating" }),
    "exchanger.general": () => pid.exchanger({ x, y, r: 3.2 }),
    "exchanger.shelltube": () => pid.shellTube({ x, y, w: 12, h: 4.4 }),
    "exchanger.floating": () => pid.shellTube({ x, y, w: 12, h: 4.4, type: "floating" }),
    "exchanger.utube": () => pid.shellTube({ x, y, w: 12, h: 4.4, type: "utube" }),
    "exchanger.plate": () => pid.plateExchanger({ x, y, w: 9, h: 5 }),
    "exchanger.aircooler": () => pid.airCooler({ x, y: y - 3, w: 12, h: 3.4 }),
    "package.unit": () => pid.unit({ x, y, w: 9, h: 6 }),
    "drive.motor": () => pid.motor({ x, y, r: 2.6 }),
    "valve.angle": () => pid.angleValve({ x: x - 1.5, y: y - 1.5, inlet: "down", outlet: "right" }),
    "valve.regulator": () => pid.regulator({ x, y: y + 2 }),
    "valve.backpressure": () => pid.regulator({ x, y: y + 2, backPressure: true }),
    "valve.safety": () => pid.safetyValve({ x, y: y + 1 }),
    "relief.rupture": () => pid.ruptureDisk({ x, y, orient: "right" }),
    "flow.orifice": () => pid.orifice({ x, y }),
    "flow.rotameter": () => pid.rotameter({ x, y, orient: "right" }),
    "flow.mfc": () => pid.mfc({ x, y }),
    "line.filter": () => pid.filter({ x, y }),
    "line.reducer": () => pid.reducer({ x, y }),
    "line.reducer-eccentric": () => pid.reducer({ x, y, eccentric: true }),
    "line.flange": () => pid.flange({ x, y }),
    "line.sightglass": () => pid.sightGlass({ x, y }),
    "line.blind": () => pid.blind({ x, y: y + 2.5 }),
    "line.blind-open": () => pid.blind({ x, y: y + 2.5, state: "open" }),
    "logic.interlock": () => pid.interlock({ x, y, r: 3 }),
    "terminal.vent": () => pid.vent({ x: x - 2, y: y + 2.6, text: "" }),
    "terminal.drain": () => pid.drain({ x, y: y - 2, text: "" }),
    "terminal.sample": () => pid.samplePoint({ x: x - 1, y: y - 2.4, text: "" }),
    "terminal.offpage": () => pid.offPage({ x: x - 6, y, text: "" }),
    "terminal.utility": () => pid.utility({ x: x - 5, y, text: "" }),
  }[kind];
  if (fixed) return fixed();
  const body = /^valve\.([a-z]+)(?:\.([a-z]+))?$/u.exec(kind);
  if (body) {
    const [, type, actuator = null] = body;
    if (type === "angle") return pid.angleValve({ x: x - 1.5, y: y + 1, inlet: "down", outlet: "right", actuator });
    return pid.valve({ x, y: y + (actuator ? 2.5 : type === "needle" ? 1 : type === "threeway" ? -1 : 0), type, actuator });
  }
  const flow = /^flow\.([a-z]+)$/u.exec(kind);
  if (flow) return pid.flowElement({ x, y, type: flow[1] });
  const bubble = /^instrument\.([a-z]+)-([a-z-]+)$/u.exec(kind);
  if (bubble) return pid.instrument({ x, y, tag: "TI-1", r: 3, fn: bubble[1], location: bubble[2] });
  return null;
}

// Lettering that belongs to one drawn item (tag, loop number, set pressure, fail position) is
// not part of the symbol, so a legend sample drops it and keeps letters that are (M, S, MAG).
const ITEM_TEXT = /<text\b[^>]*data-label="(?:tag-letters|tag-loop|fail|set)"[^>]*>[^<]*<\/text>/gu;

export function legendGlyph(kind, x, y, { maxW = 13, maxH = 10 } = {}) {
  const sym = legendSample(kind, x, y);
  if (!sym) return null;
  // A legend glyph is a picture of a symbol, not a symbol on the drawing: rename its markers,
  // drop item lettering and scale it into its cell.
  const [x0, y0, x1, y1] = sym.box;
  const k = Math.min(1, maxW / (x1 - x0), maxH / (y1 - y0));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const inner = sym.svg()
    .replace(/ data-sym="([^"]+)"/u, ' data-legend-glyph="$1"')
    .replace(/ data-sym-id="[^"]*"| data-tag="[^"]*"| data-box="[^"]*"| data-ports="[^"]*"/gu, "")
    .replace(ITEM_TEXT, "")
    // Letters that would print under the sheet minimum once scaled are left out.
    .replace(/<text\b[^>]*font-size="([\d.]+)"[^>]*>[^<]*<\/text>/gu, (text, size) => (Number(size) * k < PID.minTextMm ? "" : text))
    // Keep every glyph stroke printable after scaling.
    .replace(/ stroke-width="([\d.]+)"/gu, (_, w) => ` stroke-width="${n(Math.max(Number(w) * k, 0.12) / k)}"`);
  return { svg: el("g", { transform: `translate(${n(x - cx * k)} ${n(y - cy * k)}) scale(${n(k)})` }, inner), h: (y1 - y0) * k };
}

export function legendLine(kind, x0, x1, y) {
  const spec = LINE_KINDS[kind];
  const points = [[x0, y], [x1, y]];
  const carrier = el("path", { d: pathOf(points), fill: "none", stroke: isWave(kind) ? "none" : PID.ink, "stroke-width": spec.width, "stroke-dasharray": spec.dash, "data-legend-line": kind });
  return carrier + lineMarks(points, kind, PID.ink, { first: (x1 - x0) / 2, every: x1 - x0 }).replace(" data-line-mark=", " data-legend-mark=");
}

export function createSheet({
  mode = "pid", size = "A3", title, subtitle = "", number = "", rev = "0", date = "", scale = "NTS", sheet = "1 OF 1",
  project = "", owner = "", drawn = "", checked = "", approved = "", lang = "en", notes = [], legendTitle = "LEGEND",
  legendColumn = true, headerBand = true,
} = {}) {
  if (!title) throw new Error("createSheet: title is required");
  const [width, height] = SHEETS[size] ?? size;
  const frame = [20, 10, width - 10, height - 10];
  const legendWidth = legendColumn ? 74 : 0;
  const titleBlock = [frame[2] - 180, frame[3] - 38, frame[2], frame[3]];
  const legendBox = [frame[2] - legendWidth, frame[1], frame[2], titleBlock[1]];
  const headerBox = [frame[0], frame[1], legendBox[0], frame[1] + (headerBand ? 26 : 0)];
  const notesBox = [frame[0], titleBlock[1], titleBlock[0], frame[3]];
  const drawing = [frame[0] + 4, headerBox[3] + 3, legendBox[0] - 4, titleBlock[1] - 3];
  const canvas = createCanvas({ box: drawing, style: "pid" });
  const info = [];

  function equipmentInfo(sym, specLines = []) {
    info.push({ sym, lines: specLines });
    return sym;
  }

  function header() {
    if (!headerBand) return "";
    const out = [el("path", { d: pathOf([[headerBox[0], headerBox[3]], [headerBox[2], headerBox[3]]]), stroke: PID.ink, "stroke-width": W.symbol, fill: "none", "data-frame": "header" })];
    const blocks = info.map(({ sym, lines }) => {
      const rows = [
        { text: sym.tag ?? "", size: PID.text.equipment, bold: true },
        { text: sym.label ?? "", size: PID.text.label },
        ...lines.map((t) => ({ text: t, size: PID.text.small })),
      ].filter((r) => r.text);
      const w = Math.max(...rows.map((r) => textWidthEm(r.text) * r.size)) + 2;
      return { sym, rows, w, cx: (sym.box[0] + sym.box[2]) / 2 };
    }).sort((a, b) => a.cx - b.cx);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const left = i ? blocks[i - 1].cx + blocks[i - 1].w / 2 + 3 : headerBox[0] + 2;
      b.cx = Math.max(b.cx, left + b.w / 2);
    }
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      const right = i < blocks.length - 1 ? blocks[i + 1].cx - blocks[i + 1].w / 2 - 3 : headerBox[2] - 2;
      b.cx = Math.min(b.cx, right - b.w / 2);
    }
    for (const b of blocks) {
      let y = headerBox[1] + 5;
      const g = [];
      for (const r of b.rows) {
        g.push(textEl(b.cx, y, r.text, r.size, { "text-anchor": "middle", "font-weight": r.bold ? "bold" : undefined, "data-label": "equipment-info", "data-within": headerBox.map(n).join(" ") }));
        y += r.size + 1.1;
      }
      out.push(el("g", { "data-equipment-info": b.sym.tag ?? b.sym.id }, g));
    }
    return out.join("");
  }

  const instrumentLetters = () => [...new Set(canvas.symbols.filter((s) => s.kind.startsWith("instrument.")).map((s) => s.tag.split("-")[0]))].sort();
  const tagItem = (letters, x, y, gap, within) => {
    const parsed = parseInstrumentTag(`${letters}-1`);
    return el("g", { "data-legend-item": `tag:${letters}` },
      textEl(x, y, letters, PID.text.small, { "font-weight": "bold", "data-label": "legend", "data-within": within }),
      textEl(x + gap, y, parsed.ok ? parsed.meaning : "", PID.text.small, { "data-label": "legend", "data-within": within }));
  };

  // The legend column: line classes, then every symbol kind drawn, then (when it fits) the
  // instrument identification letters. Returns how far it runs past its column.
  function legend({ withTags = true } = {}) {
    if (!legendColumn) return { svg: "", over: 0 };
    const kinds = [...new Set(canvas.symbols.map((s) => s.kind))].sort();
    const lineKinds = [...new Set(canvas.lines.map((l) => l.kind))];
    const tags = withTags ? instrumentLetters() : [];
    const out = [];
    const [x0, y0, x1, y1] = legendBox;
    let y = y0 + 6;
    const within = legendBox.map(n).join(" ");
    out.push(textEl(x0 + 3, y, legendTitle, PID.text.label + 0.5, { "font-weight": "bold", "data-label": "legend-title", "data-within": within }));
    y += 3;
    // Each row is as tall as its sample needs; the text sits centred on the sample.
    const row = (key, draw, text, sampleHeight = 4) => {
      const lines = wrap(text, x1 - x0 - 20, PID.text.small);
      const step = Math.max(6.2, sampleHeight + 2, lines.length * 2.5 + 1.6);
      const cy = y + step / 2;
      out.push(el("g", { "data-legend-item": key }, draw(cy), lines.map((t, i) => textEl(x0 + 18, cy + 0.8 + (i - (lines.length - 1) / 2) * 2.5, t, PID.text.small, { "data-label": "legend", "data-within": within }))));
      y += step;
    };
    for (const kind of lineKinds) row(`line:${kind}`, (cy) => legendLine(kind, x0 + 3, x0 + 15, cy), LINE_KINDS[kind].label, 3);
    if (canvas.streamNumbers()) row("stream-number", (cy) => el("path", { d: pathOf([[x0 + 9, cy - 2.4], [x0 + 11.4, cy], [x0 + 9, cy + 2.4], [x0 + 6.6, cy]], true), fill: "#ffffff", stroke: PID.ink, "stroke-width": W.symbol, "data-legend-mark": "stream-number" }), "Stream number", 4.8);
    for (const kind of kinds) {
      const probe = legendGlyph(kind, 0, 0);
      row(kind, (cy) => legendGlyph(kind, x0 + 9, cy)?.svg ?? "", pid.describeKind(kind, { short: true }) ?? kind, probe?.h ?? 4);
    }
    if (tags.length) {
      y += 5;
      out.push(textEl(x0 + 3, y, "INSTRUMENT IDENTIFICATION", PID.text.small, { "font-weight": "bold", "data-label": "legend-title", "data-within": within }));
      for (const letters of tags) {
        y += 3.2;
        out.push(tagItem(letters, x0 + 3, y, 13, within));
      }
    }
    return { svg: out.join(""), over: y - (y1 - 2) };
  }

  // Numbered notes; when the legend column is full, the instrument identification letters
  // take the right half of this block in two columns.
  function noteBlock({ tags = [] } = {}) {
    if (!notes.length && !tags.length) return "";
    const [x0, y0, x1] = notesBox;
    const within = notesBox.map(n).join(" ");
    const split = tags.length ? x0 + (x1 - x0) * 0.48 : x1;
    const out = [];
    if (tags.length) {
      const tx = split + 3;
      const colW = (x1 - tx - 2) / 2;
      const rows = Math.ceil(tags.length / 2);
      out.push(textEl(tx, y0 + 5, "INSTRUMENT IDENTIFICATION", PID.text.label, { "font-weight": "bold", "data-label": "legend-title", "data-within": within }));
      tags.forEach((letters, i) => out.push(tagItem(letters, tx + Math.floor(i / rows) * colW, y0 + 9 + (i % rows) * 2.9, 9, within)));
      if (y0 + 9 + (rows - 1) * 2.9 > notesBox[3] - 1) canvas.warnings.push("the instrument identification table runs past the notes block");
    }
    if (!notes.length) return out.join("");
    out.push(textEl(x0 + 3, y0 + 5, "NOTES", PID.text.label, { "font-weight": "bold", "data-label": "notes", "data-within": within }));
    let y = y0 + 9;
    notes.forEach((note, i) => {
      const lines = wrap(`${i + 1}. ${note}`, split - x0 - 8, PID.text.small);
      for (const t of lines) {
        out.push(textEl(x0 + 3, y, t, PID.text.small, { "data-label": "notes", "data-within": within }));
        y += 2.7;
      }
    });
    if (y > notesBox[3] + 1) canvas.warnings.push("the notes run past their block; shorten them");
    return out.join("");
  }

  function legendAndNotes() {
    let column = legend();
    let tags = [];
    if (column.over > 0 && instrumentLetters().length) {
      const without = legend({ withTags: false });
      if (without.over < column.over) { column = without; tags = instrumentLetters(); }
    }
    if (column.over > 0) canvas.warnings.push(`the legend runs ${n(column.over)} mm past its column; use a larger sheet or fewer symbol kinds`);
    return [column.svg, noteBlock({ tags })];
  }

  function titleBlockSvg() {
    const [x0, y0, x1, y1] = titleBlock;
    const cells = [];
    const cell = (field, box, caption, value, valueSize) => {
      const within = box.map(n).join(" ");
      const lines = [];
      let sizeNow = valueSize;
      let wrapped = wrap(value, box[2] - box[0] - 3, sizeNow);
      while (wrapped.length > Math.max(1, Math.floor((box[3] - box[1] - 4) / (sizeNow + 0.8))) && sizeNow > PID.text.small) {
        sizeNow -= 0.25;
        wrapped = wrap(value, box[2] - box[0] - 3, sizeNow);
      }
      wrapped.forEach((t, i) => lines.push(textEl(box[0] + 1.5, box[1] + 3.6 + sizeNow + i * (sizeNow + 0.8), t, sizeNow, { "data-titleblock-value": field, "data-within": within, "font-weight": field === "title" ? "bold" : undefined })));
      cells.push(el("g", { "data-titleblock-field": field },
        el("path", { d: pathOf([[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]], true), fill: "none", stroke: PID.ink, "stroke-width": W.detail }),
        textEl(box[0] + 1.2, box[1] + 2.5, caption, 2.0, { "data-label": "titleblock-caption", "data-within": within, fill: "#444444" }),
        lines));
    };
    const titleText = subtitle ? `${title}` : title;
    cell("title", [x0, y0, x1 - 70, y0 + 18], "TITLE", titleText, 4);
    if (subtitle) cells.push(textEl(x0 + 1.5, y0 + 16.4, subtitle, PID.text.small, { "data-label": "titleblock-subtitle", "data-within": [x0, y0, x1 - 70, y0 + 18].map(n).join(" ") }));
    cell("number", [x1 - 70, y0, x1, y0 + 10], "DRAWING NO.", number || "-", 3.2);
    cell("rev", [x1 - 70, y0 + 10, x1 - 46, y0 + 18], "REV", rev, 3);
    cell("sheet", [x1 - 46, y0 + 10, x1, y0 + 18], "SHEET", sheet, 2.6);
    cell("project", [x0, y0 + 18, x0 + 90, y0 + 28], "PROJECT", project || "-", 2.5);
    cell("owner", [x0 + 90, y0 + 28 - 10, x1, y0 + 28], "OWNER", owner || "-", 2.5);
    const w5 = 180 / 5;
    [["drawn", "DRAWN", drawn], ["checked", "CHECKED", checked], ["approved", "APPROVED", approved], ["date", "DATE", date || "-"], ["scale", "SCALE", scale]].forEach(([field, caption, value], i) => {
      cell(field, [x0 + i * w5, y0 + 28, x0 + (i + 1) * w5, y1], caption, value || "-", 2.4);
    });
    return el("g", { "data-titleblock": "1" }, el("path", { d: pathOf([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true), fill: "none", stroke: PID.ink, "stroke-width": W.frame }), cells);
  }

  function frameSvg() {
    const [x0, y0, x1, y1] = frame;
    const out = [el("path", { d: pathOf([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true), fill: "none", stroke: PID.ink, "stroke-width": W.frame, "data-frame": "border" })];
    if (legendColumn) out.push(el("path", { d: pathOf([[legendBox[0], legendBox[1]], [legendBox[0], legendBox[3]]]), fill: "none", stroke: PID.ink, "stroke-width": W.symbol, "data-frame": "legend" }));
    out.push(el("path", { d: pathOf([[notesBox[0], notesBox[1]], [titleBlock[0], notesBox[1]]]), fill: "none", stroke: PID.ink, "stroke-width": W.symbol, "data-frame": "notes" }));
    const cols = Math.round((x1 - x0) / 50);
    const rows = Math.round((y1 - y0) / 50);
    const ticks = [];
    for (let i = 0; i <= cols; i++) {
      const x = x0 + ((x1 - x0) * i) / cols;
      ticks.push(pathOf([[x, y0], [x, y0 - 4]]), pathOf([[x, y1], [x, y1 + 4]]));
      if (i < cols) {
        const cx = x0 + ((x1 - x0) * (i + 0.5)) / cols;
        out.push(textEl(cx, y0 - 3.4, String(i + 1), 2.5, { "text-anchor": "middle", "data-label": "zone" }), textEl(cx, y1 + 6.6, String(i + 1), 2.5, { "text-anchor": "middle", "data-label": "zone" }));
      }
    }
    for (let j = 0; j <= rows; j++) {
      const y = y0 + ((y1 - y0) * j) / rows;
      ticks.push(pathOf([[x0, y], [x0 - 4, y]]), pathOf([[x1, y], [x1 + 4, y]]));
      if (j < rows) {
        const cy = y0 + ((y1 - y0) * (j + 0.5)) / rows + 0.9;
        const letter = String.fromCharCode(65 + j);
        out.push(textEl(x0 - 6, cy, letter, 2.5, { "text-anchor": "middle", "data-label": "zone" }), textEl(x1 + 5, cy, letter, 2.5, { "text-anchor": "middle", "data-label": "zone" }));
      }
    }
    out.push(el("path", { d: ticks.join(""), fill: "none", stroke: PID.ink, "stroke-width": W.detail, "data-frame": "zones" }));
    return out.join("");
  }

  return {
    ...canvas,
    width,
    height,
    frame,
    drawing,
    equipmentInfo,
    render({ desc = "" } = {}) {
      const body = [
        el("rect", { x: 0, y: 0, width, height, fill: PID.paper, "data-frame": "paper" }),
        frameSvg(),
        header(),
        canvas.render(),
        ...legendAndNotes(),
        titleBlockSvg(),
      ].join("");
      return svgDocument({ width, height, title: `${title}${number ? ` (${number})` : ""}`, desc, mode, lang, body });
    },
  };
}

export { FONT_LATIN };
