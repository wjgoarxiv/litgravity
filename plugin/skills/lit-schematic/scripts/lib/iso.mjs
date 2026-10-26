// Isometric (axonometric) equipment illustration: solids, not wireframes.
//
// World units are the real object's millimetres, x and y on the floor, z up. The camera is a
// parallel projection with a free azimuth and elevation; every part is filled so what is in
// front hides what is behind, shaded by how its faces turn to one fixed light, outlined by its
// silhouette, and painted far to near. Turned parts (shells, heads, nozzles, flanges, shafts)
// shade continuously around their axis, so curved bodies never step in tone. A vessel can be
// opened by a window cutaway: its inner wall, internals and liquid show through the window,
// the cut wall shows its thickness, and everything outside the window stays closed.
//
// Labels never sit on the object: callouts stand in columns beside it, and each leader runs
// from its label to a dot on the part it names, sorted so no two leaders cross.

import { el, esc, n, pathOf, textBox } from "./svg.mjs";
import { FONT_LATIN, ISO, MATERIAL, fontFor } from "./theme.mjs";

const RAD = Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const vec = { dot, add, sub, mul, cross, len, unit };

// Callout leaders keep at least this far apart on the page (the QA gate fails under 1.2 mm).
const LEADER_GAP = 1.4;
const segDist = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
};
function crosses([a, b], [c, d]) {
  const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
  if (Math.abs(den) < 1e-9) return false;
  const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
  const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], "-x": [-1, 0, 0], "-y": [0, -1, 0], "-z": [0, 0, -1] };
const axisOf = (a) => unit(typeof a === "string" ? AXES[a] : a);

export function frameAlong(origin, axis) {
  const a = axisOf(axis);
  const helper = Math.abs(a[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = unit(cross(helper, a));
  const v = cross(a, u);
  return { o: origin, a, u, v };
}
const ringPoint = (F, s, r, t) => add(add(F.o, mul(F.a, s)), add(mul(F.u, r * Math.cos(t)), mul(F.v, r * Math.sin(t))));
const radial = (F, t) => add(mul(F.u, Math.cos(t)), mul(F.v, Math.sin(t)));

function hexToRgb(h) { const v = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)); }
const rgbToHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, t) => { const p = hexToRgb(a); const q = hexToRgb(b); return rgbToHex(p.map((v, i) => v + (q[i] - v) * t)); };

// A tone is a ramp from the face turned away from the light to the face turned toward it.
// Material tones (steel, copper, ...) are the same in both palettes; the generic roles (lo, mid,
// hi, accent, cavity, section, liquid) are concrete, painted steel, stainless and signal red in
// the default material palette, and greys with one blue accent in the opt-in grey palette.
const rampFrom = (base) => [mix(base, "#000000", 0.3), mix(base, "#000000", 0.12), base, mix(base, "#ffffff", 0.28), mix(base, "#ffffff", 0.52)];
const MATERIAL_RAMPS = Object.fromEntries(["steel", "stainless", "frame", "copper", "brass", "cast", "insulation", "rubber", "glass", "concrete"].map((name) => [name, rampFrom(MATERIAL[name])]));
const SHARED_RAMPS = {
  warm: [mix("#e8c9b0", "#000000", 0.08), "#ecd3be", "#f3e3d6", "#faf2ec"],
  cool: [mix("#c9dbe6", "#000000", 0.08), "#d3e2ec", "#e1ecf3", "#f0f6f9"],
  ...MATERIAL_RAMPS,
};
const PALETTES = Object.freeze({
  material: {
    lo: MATERIAL_RAMPS.concrete,
    mid: MATERIAL_RAMPS.steel,
    hi: MATERIAL_RAMPS.stainless,
    cavity: [mix(MATERIAL.stainless, "#000000", 0.28), mix(MATERIAL.stainless, "#000000", 0.2), mix(MATERIAL.stainless, "#000000", 0.12), mix(MATERIAL.stainless, "#000000", 0.05)],
    section: [mix(MATERIAL.stainless, "#ffffff", 0.2), mix(MATERIAL.stainless, "#ffffff", 0.2)],
    accent: rampFrom(MATERIAL.accent),
    liquid: [mix(MATERIAL.liquid, "#1f5f86", 0.35), MATERIAL.liquid, mix(MATERIAL.liquid, "#ffffff", 0.45)],
    ...SHARED_RAMPS,
  },
  grey: {
    lo: [mix(ISO.shade[0], "#000000", 0.12), ISO.shade[0], ISO.shade[1], ISO.shade[2]],
    mid: [ISO.shade[0], ISO.shade[1], ISO.shade[2], ISO.shade[3], ISO.top],
    hi: [ISO.shade[1], ISO.shade[2], ISO.shade[3], ISO.top, "#ffffff"],
    cavity: [...ISO.cavity],
    section: [ISO.section, ISO.section],
    accent: [mix(ISO.accent, "#ffffff", 0.45), mix(ISO.accent, "#ffffff", 0.62), mix(ISO.accent, "#ffffff", 0.78), mix(ISO.accent, "#ffffff", 0.9)],
    liquid: [mix(ISO.liquid, "#5b8aa6", 0.35), ISO.liquid, mix(ISO.liquid, "#ffffff", 0.5)],
    ...SHARED_RAMPS,
  },
});
export const PALETTE_NAMES = Object.freeze(Object.keys(PALETTES));
export const TONES = Object.freeze(Object.keys(PALETTES.material));
function rampColor(ramps, tone, t) {
  const ramp = ramps[tone] ?? ramps.mid;
  const x = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  return mix(ramp[i], ramp[i + 1], x - i);
}

function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const crossZ = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) { while (lower.length >= 2 && crossZ(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && crossZ(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// ------------------------------------------------------------------ profiles

// A 2:1 ellipsoidal head closing a shell of radius R, as profile points from the tangent line
// (s = 0) to the crown (s = R / 2), marked smooth so no crease is drawn across it.
export function ellipsoidalHead(R, { steps = 10, depth = R / 2 } = {}) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    out.push([depth * Math.sin(t), R * Math.cos(t), i > 0 && i < steps ? 1 : 0]);
  }
  out[out.length - 1][1] = 0;
  return out;
}

// Shell with an ellipsoidal head at each end, profile from s = 0 (bottom crown) upward.
export function vesselProfile(R, straight, { bottom = "ellipse", top = "ellipse" } = {}) {
  const head = ellipsoidalHead(R);
  const headDepth = head.at(-1)[0];
  const out = [];
  if (bottom === "ellipse") for (const [s, r, sm] of [...head].reverse()) out.push([headDepth - s, r, sm]);
  else out.push([0, 0], [0, R]);
  const base = bottom === "ellipse" ? headDepth : 0;
  out.push([base + straight, R]);
  if (top === "ellipse") for (const [s, r, sm] of head.slice(1)) out.push([base + straight + s, r, sm]);
  else out.push([base + straight, 0]);
  return { profile: out, length: base + straight + (top === "ellipse" ? headDepth : 0), tangent: [base, base + straight] };
}

// ------------------------------------------------------------------ the view

export function createIsoView({ azimuth = 45, elevation = 30, light = null, palette = "material" } = {}) {
  const ramps = PALETTES[palette];
  if (!ramps) throw new Error(`createIsoView: unknown palette "${palette}"; use ${PALETTE_NAMES.join(" or ")}`);
  const paint = (tone, t) => rampColor(ramps, tone, t);
  const A = azimuth * RAD;
  const E = elevation * RAD;
  const R = [Math.sin(A), -Math.cos(A), 0];
  const D = [Math.cos(A) * Math.sin(E), Math.sin(A) * Math.sin(E), -Math.cos(E)];
  const V = [Math.cos(A) * Math.cos(E), Math.sin(A) * Math.cos(E), Math.sin(E)];
  const L = light ? unit(light) : unit(add(add(mul(R, -0.5), mul(D, -0.75)), mul(V, 0.45)));
  let k = 1;
  let origin = [0, 0];
  const items = [];
  const callouts = [];
  const warnings = [];
  const project = (p) => [origin[0] + dot(p, R) * k, origin[1] + dot(p, D) * k];
  const depth = (p) => dot(p, V);
  const shade = (normal, tone) => paint(tone, (dot(unit(normal), L) + 0.35) / 1.35);

  // Items keep world geometry and draw lazily, after fit() has fixed the projection.
  // `layer` orders groups before depth: the ground (-1) is painted before anything resting on
  // it, whatever the depth of its centre says; halos sit below that (-2).
  // `group` names the assembly an item belongs to (shell, internals, drive...): interactive pages
  // toggle and explode by it, motion moves it; static drawings only carry it as data-group.
  function item({ name, center, bias = 0, layer = 0, draw, points, container = null, group = null }) {
    const it = { name, center, layer, key: depth(center) + bias, draw, points, children: [], container, group };
    if (container) container.children.push(it);
    else items.push(it);
    return it;
  }

  function lathe({ name, origin: o = [0, 0, 0], axis = "z", profile, tone = "mid", steps = 96, bias = 0, layer = 0, seams = [], cut = null, wall = 3, outline = true, opacity = 1, into = null, group = null }) {
    const F = frameAlong(o, axis);
    const prof = profile.map(([s, r, smooth]) => [s, r, smooth ? 1 : 0]);
    const sMid = (prof[0][0] + prof.at(-1)[0]) / 2;
    const center = add(F.o, mul(F.a, sMid));
    const angles = Array.from({ length: steps + 1 }, (_, j) => (j / steps) * Math.PI * 2);
    const facing = Math.atan2(dot(V, F.v), dot(V, F.u));
    const inCut = (t, s) => {
      if (!cut) return false;
      const half = ((cut.span ?? 100) / 2) * RAD;
      const c = facing + (cut.turn ?? 0) * RAD;
      let d = Math.atan2(Math.sin(t - c), Math.cos(t - c));
      return Math.abs(d) < half && s >= cut.from - 1e-6 && s <= cut.to + 1e-6;
    };
    const worldPoints = [];
    for (const [s, r] of prof) for (const t of angles) worldPoints.push(ringPoint(F, s, r, t));
    const handle = {
      name, frame: F, profile: prof, center,
      point: (s, r, t = facing) => ringPoint(F, s, r, t),
      facingAngle: facing,
      surface: (s, side = 0) => {
        let r = 0;
        for (let i = 0; i < prof.length - 1; i++) {
          const [s0, r0] = prof[i];
          const [s1, r1] = prof[i + 1];
          if (s >= Math.min(s0, s1) && s <= Math.max(s0, s1) && s1 !== s0) { r = r0 + ((r1 - r0) * (s - s0)) / (s1 - s0); break; }
        }
        return ringPoint(F, s, r, facing + side * RAD);
      },
    };
    const quad = (i, j, rOffset, inward) => {
      const [s0, r0] = prof[i];
      const [s1, r1] = prof[i + 1];
      const ra = Math.max(0, r0 - rOffset);
      const rb = Math.max(0, r1 - rOffset);
      const t0 = angles[j];
      const t1 = angles[j + 1];
      const tm = (t0 + t1) / 2;
      let nrm = add(mul(radial(F, tm), s1 - s0), mul(F.a, -(r1 - r0)));
      if (len(nrm) < 1e-9) return null;
      if (inward) nrm = mul(nrm, -1);
      return { pts: [ringPoint(F, s0, ra, t0), ringPoint(F, s0, ra, t1), ringPoint(F, s1, rb, t1), ringPoint(F, s1, rb, t0)], nrm, s: (s0 + s1) / 2, t: tm };
    };
    const drawQuads = (list, tone0, extra = {}) => list.map((q) => {
      const color = shade(q.nrm, tone0);
      return el("path", { d: pathOf(q.pts.map(project), true), fill: color, stroke: color, "stroke-width": 0.09, "stroke-linejoin": "round", ...extra });
    }).join("");
    const sortQuads = (list) => list.sort((a, b) => depth(add(a.pts[0], a.pts[2])) - depth(add(b.pts[0], b.pts[2])));

    const outer = [];
    const inner = [];
    for (let i = 0; i < prof.length - 1; i++) {
      for (let j = 0; j < steps; j++) {
        const q = quad(i, j, 0, false);
        if (!q) continue;
        if (cut && inCut(q.t, q.s)) {
          const qi = quad(i, j, wall, true);
          if (qi) inner.push(qi);
          continue;
        }
        if (dot(q.nrm, V) > 0) outer.push(q);
        if (cut) {
          const qi = quad(i, j, wall, true);
          if (qi && dot(qi.nrm, V) > 0 && prof[i][0] >= cut.from - wall * 4 && prof[i + 1][0] <= cut.to + wall * 4) inner.push(qi);
        }
      }
    }
    const visibleInner = inner.filter((q) => dot(q.nrm, V) > 0);
    // Creases: rings at sharp profile vertices where both neighbouring faces are visible.
    const ringLine = (s, r, keep) => {
      const pts = [];
      const runs = [];
      for (const t of angles) {
        if (keep(t)) pts.push(project(ringPoint(F, s, r, t)));
        else if (pts.length) { runs.push([...pts]); pts.length = 0; }
      }
      if (pts.length) runs.push(pts);
      return runs.filter((p) => p.length > 1).map((p) => pathOf(p)).join("");
    };
    const faceVisible = (i, t) => {
      if (i < 0 || i >= prof.length - 1) return false;
      const [s0, r0] = prof[i];
      const [s1, r1] = prof[i + 1];
      const nrm = add(mul(radial(F, t), s1 - s0), mul(F.a, -(r1 - r0)));
      return len(nrm) > 1e-9 && dot(nrm, V) > 0 && !inCut(t, (s0 + s1) / 2);
    };
    const drawCreases = () => {
      const out = [];
      for (let i = 1; i < prof.length - 1; i++) {
        if (prof[i][2]) continue;
        const [s, r] = prof[i];
        if (r <= 0) continue;
        out.push(ringLine(s, r, (t) => faceVisible(i - 1, t) && faceVisible(i, t)));
      }
      for (const s of seams) {
        const seg = prof.findIndex(([s0], i) => i < prof.length - 1 && s > Math.min(s0, prof[i + 1][0]) && s < Math.max(s0, prof[i + 1][0]));
        if (seg < 0) continue;
        const [s0, r0] = prof[seg];
        const [s1, r1] = prof[seg + 1];
        out.push(ringLine(s, r0 + ((r1 - r0) * (s - s0)) / (s1 - s0), (t) => faceVisible(seg, t)));
      }
      return out.filter(Boolean).join("");
    };
    // Cut faces: the wall thickness along the two vertical edges and the window sill.
    const cutFaces = () => {
      if (!cut) return "";
      const half = ((cut.span ?? 100) / 2) * RAD;
      const c = facing + (cut.turn ?? 0) * RAD;
      const out = [];
      const radiusAt = (s) => {
        for (let i = 0; i < prof.length - 1; i++) {
          const [s0, r0] = prof[i];
          const [s1, r1] = prof[i + 1];
          if (s >= Math.min(s0, s1) - 1e-6 && s <= Math.max(s0, s1) + 1e-6 && s1 !== s0) return r0 + ((r1 - r0) * (s - s0)) / (s1 - s0);
        }
        return prof[0][1];
      };
      const samples = 16;
      for (const edge of [c - half, c + half]) {
        const pts = [];
        for (let m = 0; m <= samples; m++) { const s = cut.from + ((cut.to - cut.from) * m) / samples; pts.push(ringPoint(F, s, radiusAt(s), edge)); }
        for (let m = samples; m >= 0; m--) { const s = cut.from + ((cut.to - cut.from) * m) / samples; pts.push(ringPoint(F, s, Math.max(0, radiusAt(s) - wall), edge)); }
        out.push(el("path", { d: pathOf(pts.map(project), true), fill: ISO.section, stroke: ISO.hi, "stroke-width": 0.16, "stroke-linejoin": "round", "data-cut": "edge" }));
      }
      for (const s of [cut.from, cut.to]) {
        const r = radiusAt(s);
        const sill = [];
        const arc = Array.from({ length: 33 }, (_, m) => c - half + (2 * half * m) / 32);
        for (const t of arc) sill.push(ringPoint(F, s, r, t));
        for (const t of [...arc].reverse()) sill.push(ringPoint(F, s, Math.max(0, r - wall), t));
        const nrm = s === cut.from ? F.a : mul(F.a, -1);
        if (dot(nrm, V) > 0) out.push(el("path", { d: pathOf(sill.map(project), true), fill: ISO.section, stroke: ISO.hi, "stroke-width": 0.16, "stroke-linejoin": "round", "data-cut": "sill" }));
      }
      return out.join("");
    };
    const container = into?.it ?? null;
    const it = item({
      name, center, bias, layer, container, group, points: worldPoints,
      draw: (children) => {
        const screen = worldPoints.map(project);
        const outlinePath = pathOf(hull(screen), true);
        const parts = [];
        if (!cut) parts.push(el("path", { d: outlinePath, fill: ISO.paper, stroke: "none" }));
        if (cut) parts.push(drawQuads(sortQuads(visibleInner), "cavity", { "data-surface": "inner" }));
        parts.push(children);
        parts.push(drawQuads(sortQuads(outer), tone));
        parts.push(el("path", { d: drawCreases() || "M0 0", fill: "none", stroke: ISO.mid, "stroke-width": 0.12, "stroke-linecap": "round", "data-crease": "1" }));
        parts.push(cutFaces());
        if (outline) parts.push(el("path", { d: outlinePath, fill: "none", stroke: ISO.hi, "stroke-width": 0.2, "stroke-linejoin": "round", "data-outline": "1" }));
        const hullPts = hull(screen).map(([x, y]) => `${n(x)},${n(y)}`).join(" ");
        return el("g", { "data-part": name, "data-hull": hullPts, opacity: opacity < 1 ? opacity : undefined }, parts);
      },
    });
    handle.it = it;
    // A point on the surface facing the viewer, halfway along the body: where a leader lands.
    handle.anchor = (f = 0.5, side = 0) => {
      const sA = prof[0][0] + (prof.at(-1)[0] - prof[0][0]) * f;
      const rMax = Math.max(...prof.map((p) => p[1]));
      let best = null;
      for (let i = 0; i < prof.length - 1; i++) {
        const [s0, r0] = prof[i];
        const [s1, r1] = prof[i + 1];
        if (sA >= Math.min(s0, s1) && sA <= Math.max(s0, s1) && s1 !== s0) best = r0 + ((r1 - r0) * (sA - s0)) / (s1 - s0);
      }
      const r = best ?? rMax;
      return ringPoint(F, sA, r * 0.92, facing + side * RAD);
    };
    return handle;
  }

  // A prism: any floor outline (counter-clockwise points) extruded from z to z + h.
  function prism({ name, ring, z = 0, h, tone = "mid", bias = 0, layer = 0, outline = true, into = null, group = null }) {
    const top = ring.map(([x, y]) => [x, y, z + h]);
    const bottom = ring.map(([x, y]) => [x, y, z]);
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const center = [cx, cy, z + h / 2];
    const it = item({
      name, center, bias, layer, group, container: into?.it ?? null, points: [...top, ...bottom],
      draw: () => {
        const screen = [...top, ...bottom].map(project);
        const outlinePath = pathOf(hull(screen), true);
        const faces = [];
        const count = ring.length;
        const area = ring.reduce((s, p, i) => s + p[0] * ring[(i + 1) % count][1] - ring[(i + 1) % count][0] * p[1], 0);
        for (let i = 0; i < count; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % count];
          const edge = [b[0] - a[0], b[1] - a[1]];
          const nrm = area > 0 ? [edge[1], -edge[0], 0] : [-edge[1], edge[0], 0];
          if (dot(nrm, V) <= 1e-9) continue;
          const color = shade(nrm, tone);
          faces.push({ d: pathOf([bottom[i], bottom[(i + 1) % count], top[(i + 1) % count], top[i]].map(project), true), color, key: depth(add(add(bottom[i], top[(i + 1) % count]), [0, 0, 0])) });
        }
        faces.sort((p, q) => p.key - q.key);
        const topColor = shade([0, 0, 1], tone);
        return el("g", { "data-part": name, "data-hull": hull(screen).map(([x, y]) => `${n(x)},${n(y)}`).join(" ") },
          el("path", { d: outlinePath, fill: ISO.paper, stroke: "none" }),
          faces.map((f) => el("path", { d: f.d, fill: f.color, stroke: f.color, "stroke-width": 0.09 })),
          el("path", { d: pathOf(top.map(project), true), fill: topColor, stroke: ISO.mid, "stroke-width": 0.12, "stroke-linejoin": "round" }),
          outline ? el("path", { d: outlinePath, fill: "none", stroke: ISO.hi, "stroke-width": 0.2, "stroke-linejoin": "round", "data-outline": "1" }) : "");
      },
    });
    return { name, it, center, top: (x, y) => [x, y, z + h], anchor: () => [cx, cy, z + h] };
  }

  const roundedRing = ({ x, y, w, d, r = 0 }, steps = 6) => {
    const rr = Math.min(r, w / 2, d / 2);
    if (rr <= 0) return [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
    const out = [];
    const corners = [[x + w - rr, y + rr, -90], [x + w - rr, y + d - rr, 0], [x + rr, y + d - rr, 90], [x + rr, y + rr, 180]];
    for (const [cx, cy, a0] of corners) for (let i = 0; i <= steps; i++) { const a = (a0 + (90 * i) / steps) * RAD; out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    return out;
  };
  const box = ({ plan, z = 0, h, ...rest }) => prism({ ring: roundedRing(plan), z, h, ...rest });

  // A pipe or cable: a filleted 3D route drawn as depth-sorted chunks, each a ribbon with a
  // shine band toward the light and a shade band away from it.
  // `flow` draws a dashed stripe along the pipe whose dashes march with `flow.offset` (mm along
  // the screen route), continuous across chunks: coolant moving through a coil, gas in a line.
  function pipe({ name, points, r, tone = "mid", bend = null, bias = 0, caps = [true, true], into = null, group = null, flow = null }) {
    const route = fillet(points, bend ?? Math.max(r * 2.6, 3));
    const chunks = [];
    for (let i = 0; i < route.length - 1; i++) chunks.push([route[i], route[i + 1]]);
    const handles = [];
    chunks.forEach(([a, b], index) => {
      const mid = mul(add(a, b), 0.5);
      handles.push(item({
        name: `${name}#${index}`, center: mid, bias, group, container: into?.it ?? null, points: [a, b],
        draw: () => {
          const pa = project(a);
          const pb = project(b);
          const dx = pb[0] - pa[0];
          const dy = pb[1] - pa[1];
          const l2 = Math.hypot(dx, dy);
          const ax = unit(sub(b, a));
          const side = l2 > 1e-6 ? [-dy / l2, dx / l2] : [1, 0];
          const w = r * k;
          // Which screen side faces the light: the world normal on that side of the tube.
          const sideWorld = unit(cross(ax, V));
          const lit = dot(sideWorld, L) * (dot(sideWorld, R) * side[0] + dot(sideWorld, D) * side[1]) >= 0 ? 1 : -1;
          const ext = l2 > 1e-6 ? [dx / l2 * 0.06, dy / l2 * 0.06] : [0, 0];
          const band = (o0, o1) => [
            [pa[0] - ext[0] + side[0] * o0 * w, pa[1] - ext[1] + side[1] * o0 * w], [pb[0] + ext[0] + side[0] * o0 * w, pb[1] + ext[1] + side[1] * o0 * w],
            [pb[0] + ext[0] + side[0] * o1 * w, pb[1] + ext[1] + side[1] * o1 * w], [pa[0] - ext[0] + side[0] * o1 * w, pa[1] - ext[1] + side[1] * o1 * w],
          ];
          const bodyColor = paint(tone, 0.55);
          const out = [
            el("path", { d: pathOf(band(-1, 1), true), fill: bodyColor, stroke: bodyColor, "stroke-width": 0.09 }),
            el("path", { d: pathOf(band(0.2 * lit, 0.62 * lit), true), fill: paint(tone, 0.95), stroke: "none" }),
            el("path", { d: pathOf(band(-0.55 * lit, -0.98 * lit), true), fill: paint(tone, 0.12), stroke: "none" }),
            el("path", { d: pathOf([[pa[0] + side[0] * w, pa[1] + side[1] * w], [pb[0] + side[0] * w, pb[1] + side[1] * w]]) + pathOf([[pa[0] - side[0] * w, pa[1] - side[1] * w], [pb[0] - side[0] * w, pb[1] - side[1] * w]]), fill: "none", stroke: ISO.hi, "stroke-width": 0.16, "stroke-linecap": "butt" }),
          ];
          const capAt = (p, dir) => {
            const F = frameAlong(p, dir);
            const pts = Array.from({ length: 33 }, (_, m) => project(ringPoint(F, 0, r, (m / 32) * Math.PI * 2)));
            if (dot(dir, V) > 0) return el("path", { d: pathOf(pts, true), fill: paint(tone, 0.3), stroke: ISO.hi, "stroke-width": 0.16 });
            return el("path", { d: pathOf(pts, true), fill: bodyColor, stroke: "none" });
          };
          if (flow) {
            let start = 0;
            for (let m = 0; m < index; m++) { const p0 = project(chunks[m][0]); const p1 = project(chunks[m][1]); start += Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); }
            const [on, off] = flow.dash ?? [2.4, 2.4];
            out.push(el("path", { d: pathOf([pa, pb]), fill: "none", stroke: flow.color ?? ISO.accent, "stroke-width": n(flow.width ?? w * 0.7), "stroke-dasharray": `${n(on)} ${n(off)}`, "stroke-dashoffset": n(start - (flow.offset ?? 0)), "stroke-linecap": "butt", "data-flow": name }));
          }
          if (index === 0 && caps[0]) out.push(capAt(a, mul(ax, -1)));
          if (index === chunks.length - 1 && caps[1]) out.push(capAt(b, ax));
          const hullPts = hull([...band(-1, 1)]).map(([x, y]) => `${n(x)},${n(y)}`).join(" ");
          return el("g", { "data-part": name, "data-hull": hullPts }, out);
        },
      }));
    });
    return { name, route, at: (f) => pointOnRoute(route, f), anchor: (f = 0.5) => pointOnRoute(route, f), chunks: handles };
  }

  function sphere({ name, center, r, tone = "mid", bias = 0, into = null, group = null }) {
    const profile = [];
    for (let i = 0; i <= 16; i++) { const t = (i / 16) * Math.PI; profile.push([-r * Math.cos(t), r * Math.sin(t), i > 0 && i < 16 ? 1 : 0]); }
    return lathe({ name, origin: center, axis: "z", profile, tone, bias, into, group });
  }

  function dots({ name, points, r = 0.5, color = ISO.mid, bias = 0.5, into = null, group = null }) {
    const center = points.reduce((s, p) => add(s, mul(p, 1 / points.length)), [0, 0, 0]);
    return item({ name, center, bias, group, container: into?.it ?? null, points, draw: () => el("g", { "data-detail": name }, points.map((p) => { const [x, y] = project(p); return el("circle", { cx: x, cy: y, r: r, fill: color, stroke: "none" }); })) });
  }

  // `flow: { dash: [on, off], offset, start }` in world mm marches dashes along the line: give
  // collinear pieces of one run the same offset and their own start so the dashes line up.
  function polyline({ name, points, color = ISO.mid, width = 0.12, bias = 0.3, dash = null, into = null, group = null, flow = null }) {
    const center = points.reduce((s, p) => add(s, mul(p, 1 / points.length)), [0, 0, 0]);
    return item({ name, center, bias, group, container: into?.it ?? null, points, draw: () => {
      const screen = points.map(project);
      let flowAttrs = {};
      if (flow) {
        const world = points.slice(1).reduce((sum, p, i) => sum + len(sub(p, points[i])), 0);
        const drawn = screen.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - screen[i][0], p[1] - screen[i][1]), 0);
        const f = world > 0 ? drawn / world : 0;
        const [on, off] = flow.dash ?? [8, 8];
        flowAttrs = { "stroke-dasharray": `${n(on * f)} ${n(off * f)}`, "stroke-dashoffset": n(((flow.start ?? 0) - (flow.offset ?? 0)) * f), "stroke-linecap": "butt", "data-flow": name };
      }
      return el("path", { d: pathOf(screen), fill: "none", stroke: color, "stroke-width": width, "stroke-dasharray": dash, "stroke-linecap": "round", "stroke-linejoin": "round", "data-detail": name, ...flowAttrs });
    } });
  }

  // Points the fit keeps in frame although nothing is drawn there (where an exploded or moving
  // part goes), so every frame of an animation and every state of a page shares one scale.
  function extent(points) {
    return item({ name: "extent", center: points[0], points, layer: -3, draw: () => "" });
  }

  // A visible arc of bolt heads around a flange face.
  function boltCircle({ name, frame, s, radius, count = 8, r = 0.45, into = null, group = null }) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const p = ringPoint(frame, s, radius, t);
      pts.push(p);
    }
    const faceToward = dot(frame.a, V);
    const visible = Math.abs(faceToward) > 0.12 ? pts : pts.filter((p) => dot(sub(p, frame.o), V) > 0);
    return dots({ name, points: visible, r, color: ISO.mid, bias: 1, into, group });
  }

  function halo({ plan, z = 0 }) {
    const ring = roundedRing({ x: plan.x - plan.w * 0.04, y: plan.y - plan.d * 0.04, w: plan.w * 1.08, d: plan.d * 1.08, r: plan.r ?? 0 });
    return item({ name: "halo", center: [plan.x + plan.w / 2, plan.y + plan.d / 2, z], layer: -2, points: ring.map(([x, y]) => [x, y, z]), draw: () => el("path", { d: pathOf(ring.map(([x, y]) => project([x, y, z])), true), fill: ISO.halo, "fill-opacity": ISO.haloOpacity / 2.4, stroke: "none", "data-halo": "1" }) });
  }

  // A callout names a part: give the part handle (its anchor is used) or a world point on it.
  function callout({ part = null, at = null, text, side = "auto", number = null }) {
    const point = at ?? part?.anchor?.();
    if (!point) throw new Error(`callout "${text}": give a part handle or an "at" point on the part`);
    callouts.push({ at: point, text, side, number, part: part?.name ?? null });
  }

  // Fits the art and its callout columns into boxMm. Callout sides are settled first (by where
  // each anchor falls across the art, balanced when one side would take nearly all of them), then
  // only the sides in use get a column as wide as their longest label plus the leader's run.
  function fit(boxMm, { pad = 2, labelColumn = null, size = 2.47 } = {}) {
    const all = [];
    const walk = (list) => { for (const it of list) { all.push(...it.points); walk(it.children); } };
    walk(items);
    const flat = all.map((p) => [dot(p, R), dot(p, D)]);
    const xs = flat.map((p) => p[0]);
    const ys = flat.map((p) => p[1]);
    const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
    const anchorsX = callouts.map((c) => dot(c.at, R));
    const natural = callouts.map((c, i) => (c.side === "auto" ? (anchorsX[i] < midX ? "left" : "right") : c.side));
    const byX = callouts.map((_, i) => i).filter((i) => callouts[i].side === "auto").sort((a, b) => anchorsX[a] - anchorsX[b]);
    const balanced = [...natural];
    byX.forEach((i, rank) => { balanced[i] = rank < Math.floor(byX.length / 2) ? "left" : "right"; });
    const allTo = (side) => callouts.map((c) => (c.side === "auto" ? side : c.side));
    const [x0, y0, x1, y1] = boxMm;
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const widthOf = (sides, side) => {
      const list = callouts.filter((_, i) => sides[i] === side);
      if (!list.length) return 0;
      if (labelColumn !== null) return labelColumn;
      return Math.max(...list.map((c) => textBox(0, 0, c.number !== null ? `${c.number}  ${c.text}` : c.text, size)[2])) + 7;
    };
    // Whichever assignment leaves the art largest wins; rows per side must also fit the height.
    let best = null;
    for (const sides of [natural, balanced, allTo("right"), allTo("left")]) {
      const left = widthOf(sides, "left");
      const right = widthOf(sides, "right");
      const width = x1 - x0 - 2 * pad - left - right;
      const rows = Math.max(...["left", "right"].map((side) => sides.filter((v) => v === side).length));
      if (width <= 0 || rows * (size * 1.25 + 1.4) > y1 - y0) continue;
      const scale = Math.min(width / spanX, (y1 - y0 - 2 * pad) / spanY);
      if (!best || scale > best.scale + 1e-9) best = { sides, left, right, width, scale };
    }
    if (!best) throw new Error("iso fit: the callouts do not fit beside the art; widen the box or shorten the labels");
    callouts.forEach((c, i) => { c.resolved = best.sides[i]; });
    const { left, right, width } = best;
    const height = y1 - y0 - 2 * pad;
    k = best.scale;
    origin = [
      x0 + pad + left + width / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * k,
      y0 + pad + height / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * k,
    ];
    return { scale: k, artBox: [x0 + pad + left, y0 + pad, x1 - pad - right, y1 - pad] };
  }

  function renderCallouts({ box: frameBox, size = 2.4, gap = 2.5 }) {
    if (!callouts.length) return "";
    const all = [];
    const walk = (list) => { for (const it of list) { all.push(...it.points.map(project)); walk(it.children); } };
    walk(items);
    const artLeft = Math.min(...all.map((p) => p[0]));
    const artRight = Math.max(...all.map((p) => p[0]));
    const mid = (artLeft + artRight) / 2;
    const placed = callouts.map((c, index) => {
      const anchor = project(c.at);
      const side = c.resolved ?? (c.side === "auto" ? (anchor[0] < mid ? "left" : "right") : c.side);
      return { ...c, index, anchor, side };
    });
    const out = [];
    for (const side of ["left", "right"]) {
      const col = placed.filter((c) => c.side === side).sort((a, b) => a.anchor[1] - b.anchor[1]);
      const line = size * 1.25 + 1.4;
      let y = frameBox[1] + size;
      const ys = col.map((c) => { y = Math.max(y, c.anchor[1] + size * 0.35); const v = y; y += line; return v; });
      const overflow = ys.length ? ys.at(-1) - (frameBox[3] - 0.6) : 0;
      if (overflow > 0) for (let i = ys.length - 1; i >= 0; i--) { const limit = i === ys.length - 1 ? frameBox[3] - 0.6 : ys[i + 1] - line; ys[i] = Math.min(ys[i], limit); }
      // Order the labels so no two leaders cross or run within LEADER_GAP of each other (or of
      // another leader's dot): swap slots while that lowers the cost, then open a blank row
      // above a crowded leader to change its angle when the column has room.
      const order = col.map((_, i) => i);
      // Same elbow x as the drawn leader below.
      const elbowAt = side === "left" ? Math.min(artLeft - gap * 2 + 1.2, artLeft - gap) : Math.max(artRight + gap * 2 - 1.2, artRight + gap);
      const leaderOf = (ci, slot) => [[elbowAt, ys[slot] - size * 0.35], col[ci].anchor];
      const pairCost = (p, q) => {
        if (crosses(p, q)) return 1000;
        const d = Math.min(segDist(p[0], q[0], q[1]), segDist(p[1], q[0], q[1]), segDist(q[0], p[0], p[1]), segDist(q[1], p[0], p[1]));
        return d < LEADER_GAP ? (LEADER_GAP - d) * 100 : 0;
      };
      // Cost is [violations, leader length]: clearing a crossing or a crowding always wins, and
      // among equally clean orders the one with the shortest, shallowest leaders does.
      const cost = () => {
        let bad = 0;
        let length = 0;
        for (let i = 0; i < order.length; i++) {
          const li = leaderOf(order[i], i);
          length += Math.hypot(li[1][0] - li[0][0], li[1][1] - li[0][1]);
          for (let j = i + 1; j < order.length; j++) bad += pairCost(li, leaderOf(order[j], j));
        }
        return [bad, length];
      };
      const better = (a, b) => a[0] < b[0] - 1e-9 || (Math.abs(a[0] - b[0]) <= 1e-9 && a[1] < b[1] - 1e-6);
      let best = cost();
      for (let pass = 0; pass < col.length * col.length; pass++) {
        let improved = false;
        for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
          [order[i], order[j]] = [order[j], order[i]];
          const c = cost();
          if (better(c, best)) { best = c; improved = true; } else [order[i], order[j]] = [order[j], order[i]];
        }
        if (!improved) break;
      }
      // Still crowded: open one blank row, either pushing the rows below it down or the rows
      // above it up, wherever the column has room, and keep the move that clears the most.
      const top = frameBox[1] + size;
      const bottom = frameBox[3] - 0.6;
      for (let tries = 0; tries < col.length && best[0] > 0; tries++) {
        let chosen = null;
        for (let k = 0; k <= ys.length; k++) {
          for (const dir of [1, -1]) {
            const moved = ys.map((y, m) => (dir > 0 ? (m >= k ? y + line : y) : (m < k ? y - line : y)));
            if (moved.length && (moved.at(-1) > bottom || moved[0] < top)) continue;
            const saved = [...ys];
            ys.splice(0, ys.length, ...moved);
            const c = cost();
            ys.splice(0, ys.length, ...saved);
            if (better(c, best) && c[0] < best[0] && (!chosen || better(c, chosen.c))) chosen = { moved, c };
          }
        }
        if (!chosen) break;
        ys.splice(0, ys.length, ...chosen.moved);
        best = chosen.c;
      }
      if (best[0] > 0) warnings.push(`callouts on the ${side}: some leaders still cross or run closer than ${LEADER_GAP} mm; move a callout dot to a clearer spot on its part or send the label to the other side`);
      const slotted = order.map((ci) => col[ci]);
      slotted.forEach((c, i) => {
        const label = c.number !== null ? `${c.number}  ${c.text}` : c.text;
        const ty = ys[i];
        const tx = side === "left" ? artLeft - gap * 2 : artRight + gap * 2;
        const anchorText = side === "left" ? "end" : "start";
        const bx = textBox(tx, ty, label, size, anchorText);
        const elbowX = side === "left" ? Math.min(bx[2] + 1.2, artLeft - gap) : Math.max(bx[0] - 1.2, artRight + gap);
        const elbowY = ty - size * 0.35;
        const id = `C${c.index + 1}`;
        out.push(el("path", { d: pathOf([[side === "left" ? bx[2] + 0.6 : bx[0] - 0.6, elbowY], [elbowX, elbowY], c.anchor]), fill: "none", stroke: ISO.hi, "stroke-width": 0.14, "stroke-linecap": "round", "data-leader": id, "data-target": c.part ?? undefined }));
        out.push(el("circle", { cx: c.anchor[0], cy: c.anchor[1], r: 0.55, fill: ISO.hi, stroke: ISO.paper, "stroke-width": 0.12, "data-leader-dot": id }));
        out.push(el("text", { x: tx, y: ty, "font-family": fontFor(label), "font-size": size, "text-anchor": anchorText, fill: ISO.hi, "data-label": "callout", "data-for-leader": id }, esc(label)));
      });
    }
    return el("g", { "data-callouts": "1" }, out);
  }

  function render() {
    const draw = (list) => [...list].sort((a, b) => a.layer - b.layer || a.key - b.key).map((it) => {
      const svg = it.draw(draw(it.children));
      return it.group ? el("g", { "data-group": it.group }, svg) : svg;
    }).join("");
    return draw(items);
  }

  // The screen offset (mm) a world move vector makes at the fitted scale: what an exploded view
  // translates an assembly by.
  const screenVector = (v) => [dot(v, R) * k, dot(v, D) * k];

  return {
    project, depth, V, R, D, L, items, warnings, screenVector,
    lathe, prism, box, pipe, sphere, dots, polyline, extent, boltCircle, halo, callout, fit, render, renderCallouts,
    roundedRing,
    get scale() { return k; },
  };
}

// Rounds every corner of a 3D polyline with an arc of radius `radius`, clamped to the room
// the legs leave, so pipes bend instead of kinking.
export function fillet(points, radius, perArc = 6) {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const a = unit(sub(points[i - 1], p));
    const b = unit(sub(points[i + 1], p));
    const cosT = Math.max(-1, Math.min(1, dot(a, b)));
    const theta = Math.acos(cosT);
    if (theta > Math.PI - 1e-3) { out.push(p); continue; }
    const room = Math.min(len(sub(points[i - 1], p)), len(sub(points[i + 1], p))) * 0.48;
    const t = Math.min(radius / Math.tan(theta / 2), room);
    const r = t * Math.tan(theta / 2);
    const start = add(p, mul(a, t));
    const end = add(p, mul(b, t));
    const bis = unit(add(a, b));
    const centre = add(p, mul(bis, r / Math.sin(theta / 2)));
    const u = unit(sub(start, centre));
    const w = unit(sub(end, centre));
    const sweep = Math.acos(Math.max(-1, Math.min(1, dot(u, w))));
    const nrm = unit(cross(u, w));
    const vv = cross(nrm, u);
    for (let m = 0; m <= perArc; m++) {
      const ang = (sweep * m) / perArc;
      out.push(add(centre, mul(add(mul(u, Math.cos(ang)), mul(vv, Math.sin(ang))), r)));
    }
  }
  out.push(points.at(-1));
  return out;
}

export function pointOnRoute(route, f) {
  const lens = route.slice(1).map((p, i) => len(sub(p, route[i])));
  const total = lens.reduce((s, v) => s + v, 0);
  let left = f * total;
  for (let i = 0; i < lens.length; i++) {
    if (left <= lens[i]) return add(route[i], mul(sub(route[i + 1], route[i]), lens[i] ? left / lens[i] : 0));
    left -= lens[i];
  }
  return route.at(-1);
}

export { FONT_LATIN };
