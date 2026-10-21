// MO-C-06 contrast measurement on a rendered frame (CF-204's method for type over a rendered
// background). Foreground: the median linear luminance under the glyph mask eroded by 1 px (the
// 5th and 95th percentiles for a gradient fill). Background: the 5th and 95th percentiles inside
// the bbox grown by 0.25 x cap height, outside the mask dilated by 2 px. The ratio is the worst
// pairing. Coordinates are logical px; `scale` maps them onto the frame's physical pixels (the type
// path's 1920-wide logical frame by default; the stage path passes 1, its boxes are already pixels).
import { LINEAR_LUT } from "./flash.mjs";

const lum = (rgba, i) => 0.2126 * LINEAR_LUT[rgba[i]] + 0.7152 * LINEAR_LUT[rgba[i + 1]] + 0.0722 * LINEAR_LUT[rgba[i + 2]];
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function percentile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

/**
 * Where a logical box lands on screen after the crt pass. The pass shows, at screen uv s, the content
 * at barrel(s) = s + d|d|^2 * 2k (d = s - 0.5), so a box is carried by the inverse of that map: each
 * point of its outline is solved by fixed-point iteration and the result is their bounding box.
 * Without this the frame line of a curved window lands inside a corner label's background ring.
 */
export function screenBox(bbox, curvature, width = 1920, height = 1080) {
  if (!curvature) return bbox;
  const toScreen = (x, y) => {
    const c = [x / width, y / height];
    let s = [...c];
    for (let i = 0; i < 12; i++) {
      const dx = s[0] - 0.5;
      const dy = s[1] - 0.5;
      const r2 = dx * dx + dy * dy;
      s = [c[0] - dx * r2 * curvature * 2, c[1] - dy * r2 * curvature * 2];
    }
    return [s[0] * width, s[1] * height];
  };
  const [x0, y0, x1, y1] = bbox;
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    pts.push(toScreen(x0 + (x1 - x0) * u, y0), toScreen(x0 + (x1 - x0) * u, y1), toScreen(x0, y0 + (y1 - y0) * u), toScreen(x1, y0 + (y1 - y0) * u));
  }
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
}

/** Returns { ratio, fg, bg: [p5, p95], fgPixels, bgPixels } or null when nothing is measurable. */
export function measureContrast({ rgba, mask, width, height, bbox, capHeightPx, gradient = false, scale = width / 1920 }) {
  const grow = 0.25 * capHeightPx;
  const x0 = Math.max(0, Math.floor((bbox[0] - grow) * scale));
  const y0 = Math.max(0, Math.floor((bbox[1] - grow) * scale));
  const x1 = Math.min(width - 1, Math.ceil((bbox[2] + grow) * scale));
  const y1 = Math.min(height - 1, Math.ceil((bbox[3] + grow) * scale));
  const bx0 = Math.max(0, Math.floor(bbox[0] * scale));
  const by0 = Math.max(0, Math.floor(bbox[1] * scale));
  const bx1 = Math.min(width - 1, Math.ceil(bbox[2] * scale));
  const by1 = Math.min(height - 1, Math.ceil(bbox[3] * scale));
  const erode = Math.max(1, Math.round(scale));
  const dilate = Math.max(2, Math.round(2 * scale));
  const on = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] >= 128;
  const allOn = (x, y, d) => {
    for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (!on(x + dx, y + dy)) return false;
    return true;
  };
  const anyOn = (x, y, d) => {
    for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (on(x + dx, y + dy)) return true;
    return false;
  };
  let fg = [];
  const fgLoose = [];
  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      if (!on(x, y)) continue;
      const l = lum(rgba, (y * width + x) * 4);
      fgLoose.push(l);
      if (allOn(x, y, erode)) fg.push(l);
    }
  }
  // Thin strokes (pixel fonts, small machine text) can vanish under erosion; fall back to the mask.
  if (fg.length < 12) fg = fgLoose;
  const bg = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!anyOn(x, y, dilate)) bg.push(lum(rgba, (y * width + x) * 4));
  if (!fg.length || !bg.length) return null;
  fg.sort((a, b) => a - b);
  bg.sort((a, b) => a - b);
  const bgLo = percentile(bg, 0.05);
  const bgHi = percentile(bg, 0.95);
  const fgValues = gradient ? [percentile(fg, 0.05), percentile(fg, 0.95)] : [percentile(fg, 0.5)];
  let worst = Infinity;
  for (const f of fgValues) for (const b of [bgLo, bgHi]) worst = Math.min(worst, ratio(f, b));
  return { ratio: worst, fg: fgValues, bg: [bgLo, bgHi], fgPixels: fg.length, bgPixels: bg.length };
}
