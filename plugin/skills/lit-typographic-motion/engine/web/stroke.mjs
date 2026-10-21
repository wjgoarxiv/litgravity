// Single-stroke plotter fonts (the five OFL EMS SVG fonts, MO-FT-08) laid out as polylines so a
// line of Latin text can be written progressively by a moving pen. Adapted from mexicat/pdoom-video
// app/src/engine/stroke.ts (MIT, see ../NOTICE). The Hershey fonts are excluded and never loaded.
//
// The files carry no kerning, so pairs that leave a hole (an overhang or a diagonal) are pulled in
// optically: the closest horizontal approach of the two glyphs' ink is brought toward the font's
// own n-n spacing. Connected scripts (EMS Allure) are never kerned, since that would break joins.
import { SCALE } from "./scale.mjs";

export const STROKE_FONTS = Object.freeze({
  "ems-allure": { file: "EMSAllure.svg", connected: true },
  "ems-felix": { file: "EMSFelix.svg", connected: false },
  "ems-osmotron": { file: "EMSOsmotron.svg", connected: false },
  "ems-readability": { file: "EMSReadability.svg", connected: false },
  "ems-tech": { file: "EMSTech.svg", connected: false },
});

const BANDS = 48;

function parsePath(d) {
  const out = [];
  const tokens = d.match(/[MLml]|-?\d*\.?\d+(?:e-?\d+)?/gu) ?? [];
  let current = null;
  let cmd = "M";
  for (let i = 0; i < tokens.length;) {
    const t = tokens[i];
    if (/[MLml]/u.test(t)) {
      cmd = t.toUpperCase();
      i += 1;
      continue;
    }
    const x = Number.parseFloat(tokens[i]);
    const y = Number.parseFloat(tokens[i + 1]);
    i += 2;
    if (cmd === "M") {
      current = [{ x, y }];
      out.push(current);
      cmd = "L";
    } else current?.push({ x, y });
  }
  return out;
}

function inkBox(strokes) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const s of strokes) for (const p of s) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  return { x0, x1, y0, y1 };
}

export function parseStrokeFont(svgText, { connected }) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const face = doc.querySelector("font-face");
  const fontEl = doc.querySelector("font");
  const defaultAdvance = Number.parseFloat(fontEl?.getAttribute("horiz-adv-x") ?? "500");
  const glyphs = new Map();
  for (const g of doc.querySelectorAll("glyph")) {
    const u = g.getAttribute("unicode");
    if (u == null) continue;
    glyphs.set(u, { adv: Number.parseFloat(g.getAttribute("horiz-adv-x") ?? String(defaultAdvance)), strokes: parsePath(g.getAttribute("d") ?? "") });
  }
  let yLo = Infinity;
  let yHi = -Infinity;
  for (const g of glyphs.values()) for (const s of g.strokes) for (const p of s) { yLo = Math.min(yLo, p.y); yHi = Math.max(yHi, p.y); }
  const cap = glyphs.get("H") ? inkBox(glyphs.get("H").strokes).y1 : 700;
  return { upm: Number.parseFloat(face?.getAttribute("units-per-em") ?? "1000"), glyphs, defaultAdvance, connected, cap, yLo, dy: (yHi - yLo + 1) / BANDS, profiles: new Map(), kerns: new Map(), target: null };
}

// Leftmost and rightmost ink per horizontal band (NaN where a band has no ink).
function profile(font, ch) {
  if (font.profiles.has(ch)) return font.profiles.get(ch);
  const g = font.glyphs.get(ch);
  let p = null;
  if (g && g.strokes.length) {
    const left = new Float32Array(BANDS).fill(Number.NaN);
    const right = new Float32Array(BANDS).fill(Number.NaN);
    const put = (x, y) => {
      const i = Math.floor((y - font.yLo) / font.dy);
      if (i < 0 || i >= BANDS) return;
      if (!(left[i] <= x)) left[i] = x;
      if (!(right[i] >= x)) right[i] = x;
    };
    for (const s of g.strokes) {
      if (s.length === 1) put(s[0].x, s[0].y);
      for (let k = 1; k < s.length; k++) {
        const a = s[k - 1];
        const b = s[k];
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (font.dy * 0.5)));
        for (let j = 0; j <= n; j++) put(a.x + ((b.x - a.x) * j) / n, a.y + ((b.y - a.y) * j) / n);
      }
    }
    p = { left, right };
  }
  font.profiles.set(ch, p);
  return p;
}

function approach(font, a, b) {
  const pa = profile(font, a);
  const pb = profile(font, b);
  if (!pa || !pb) return null;
  const adv = font.glyphs.get(a).adv;
  let m = Infinity;
  for (let i = 0; i < BANDS; i++) if (!Number.isNaN(pa.right[i]) && !Number.isNaN(pb.left[i])) m = Math.min(m, adv + pb.left[i] - pa.right[i]);
  return m === Infinity ? null : m;
}

function pairKern(font, a, b) {
  if (font.connected || a === " " || b === " ") return 0;
  const key = a + b;
  if (font.kerns.has(key)) return font.kerns.get(key);
  if (font.target === null) {
    const refs = ["nn", "oo", "HH"].map((p) => approach(font, p[0], p[1])).filter((v) => v !== null);
    font.target = refs.length ? refs.reduce((s, v) => s + v, 0) / refs.length : 0;
  }
  const m = approach(font, a, b);
  const k = m === null ? 0 : Math.max(-0.12 * font.upm, Math.min(0, 0.6 * (font.target - m)));
  font.kerns.set(key, k);
  return k;
}

/** Lay out `text` at `size` px: strokes in px with the origin at the left baseline, y down. */
export function strokeText(font, text, size) {
  const s = size / font.upm;
  const strokes = [];
  const charOf = [];
  const chars = Array.from(text);
  let x = 0;
  chars.forEach((ch, ci) => {
    const g = font.glyphs.get(ch);
    for (const st of g?.strokes ?? []) {
      strokes.push(st.map((p) => ({ x: x + p.x * s, y: -p.y * s })));
      charOf.push(ci);
    }
    x += (g?.adv ?? font.defaultAdvance) * s;
    if (ci + 1 < chars.length) x += pairKern(font, ch, chars[ci + 1]) * s;
  });
  const lens = strokes.map((pts) => {
    const L = new Float32Array(pts.length);
    for (let i = 1; i < pts.length; i++) L[i] = L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return L;
  });
  const startLen = [];
  let total = 0;
  for (const L of lens) {
    startLen.push(total);
    total += L[L.length - 1] ?? 0;
  }
  const charRange = chars.map(() => [Infinity, -Infinity]);
  strokes.forEach((_, i) => {
    const r = charRange[charOf[i]];
    r[0] = Math.min(r[0], startLen[i]);
    r[1] = Math.max(r[1], startLen[i] + (lens[i][lens[i].length - 1] ?? 0));
  });
  let last = 0;
  for (const r of charRange) {
    if (r[0] === Infinity) { r[0] = last; r[1] = last; }
    last = r[1];
  }
  return { text, strokes, startLen, lens, total, width: x, charRange, size, capHeight: font.cap * s };
}

/** Pen length (px) written by time t when char i is written during charTimes[i]. */
export function writtenLength(st, charTimes, t) {
  let len = 0;
  for (let i = 0; i < st.charRange.length; i++) {
    const [a, b] = st.charRange[i];
    const [t0, t1] = charTimes[i] ?? [Infinity, Infinity];
    if (t >= t1) len = b;
    else if (t > t0) {
      len = a + (b - a) * ((t - t0) / Math.max(1e-3, t1 - t0));
      break;
    } else break;
  }
  return len;
}

/**
 * Stroke the first `length` px of a laid-out stroke text at (x, baseline) on the glyph layer.
 * Returns the ink bbox in logical px (null when nothing is drawn) and the pen head.
 */
export function drawStrokeText(layer, st, length, x, baseline, { color, lineWidth }) {
  const c = layer.ctx;
  c.save();
  c.translate(x, baseline);
  c.strokeStyle = color;
  c.lineWidth = lineWidth;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  let head = null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const grow = (p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); };
  for (let i = 0; i < st.strokes.length; i++) {
    const s0 = st.startLen[i];
    if (s0 >= length) break;
    const pts = st.strokes[i];
    const L = st.lens[i];
    const remain = length - s0;
    const shown = [pts[0]];
    let j = 1;
    for (; j < pts.length && L[j] <= remain; j++) shown.push(pts[j]);
    if (j < pts.length) {
      const a = pts[j - 1];
      const b = pts[j];
      const u = (remain - L[j - 1]) / Math.max(1e-6, L[j] - L[j - 1]);
      head = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      shown.push(head);
    } else head = pts[pts.length - 1];
    for (const p of shown) grow(p);
    // The EMS glyphs are polylines; at display sizes their facets show. Curving through segment
    // midpoints keeps the pen on the same path (within half a segment) without the corners.
    c.moveTo(shown[0].x, shown[0].y);
    for (let k = 1; k < shown.length - 1; k++) {
      c.quadraticCurveTo(shown[k].x, shown[k].y, (shown[k].x + shown[k + 1].x) / 2, (shown[k].y + shown[k + 1].y) / 2);
    }
    if (shown.length > 1) c.lineTo(shown[shown.length - 1].x, shown[shown.length - 1].y);
  }
  c.stroke();
  const m = c.getTransform();
  c.restore();
  if (x0 === Infinity) return { bbox: null, head: null };
  const pad = lineWidth / 2;
  const corners = [[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x0 - pad, y1 + pad], [x1 + pad, y1 + pad]]
    .map(([px, py]) => [(m.a * px + m.c * py + m.e) / SCALE, (m.b * px + m.d * py + m.f) / SCALE]);
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  return { bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], head };
}
