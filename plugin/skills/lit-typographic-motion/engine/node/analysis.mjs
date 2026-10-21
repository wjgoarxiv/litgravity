// Per-frame analysis of the exact bytes that leave the renderer. The page writes the glyph-coverage
// mask into the alpha channel; this reads it (ink pixel count, optional 8-bit mask), then forces
// alpha to 255 so the bytes hashed (rgbaSha256, MO-C-09), audited (MO-C-03) and encoded are one
// and the same buffer. It also computes the 99.5th-percentile luminance for the empty-frame rule
// (MO-D-03) and the flash-audit cell grid.
import { createHash } from "node:crypto";
import { GATE } from "../core/constants.mjs";
import { LINEAR_LUT, gridFor } from "../core/flash.mjs";

const HIST = 2048;

/** Analyse and normalise one RGBA frame in place. Returns ink count, mask (optional), cells, p99.5 L. */
export function analyzeFrame(bytes, width, height, { keepMask = false } = {}) {
  const { gw: GW, gh: GH } = gridFor(width, height);
  const cells = GW * GH;
  const R = new Float32Array(cells);
  const G = new Float32Array(cells);
  const B = new Float32Array(cells);
  const count = new Float32Array(cells);
  const hist = new Uint32Array(HIST);
  const mask = keepMask ? Buffer.alloc(width * height) : null;
  let inkPx = 0;
  for (let y = 0; y < height; y++) {
    const cy = Math.min(GH - 1, Math.floor((y * GH) / height)) * GW;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const a = bytes[o + 3];
      if (a >= 128) inkPx += 1;
      if (mask) mask[y * width + x] = a;
      bytes[o + 3] = 255;
      const r = LINEAR_LUT[bytes[o]];
      const g = LINEAR_LUT[bytes[o + 1]];
      const b = LINEAR_LUT[bytes[o + 2]];
      const c = cy + Math.min(GW - 1, Math.floor((x * GW) / width));
      R[c] += r;
      G[c] += g;
      B[c] += b;
      count[c] += 1;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      hist[Math.min(HIST - 1, Math.floor(l * HIST))] += 1;
    }
  }
  for (let i = 0; i < cells; i++) {
    const n = count[i] || 1;
    R[i] /= n;
    G[i] /= n;
    B[i] /= n;
  }
  const target = GATE.nearBlackPercentile * width * height;
  let seen = 0;
  let p995 = 1;
  for (let i = 0; i < HIST; i++) {
    seen += hist[i];
    if (seen >= target) {
      p995 = (i + 1) / HIST;
      break;
    }
  }
  const rgbaSha256 = createHash("sha256").update(bytes).digest("hex");
  return { inkPx, mask, cells: { R, G, B }, luminanceP995: +p995.toFixed(5), rgbaSha256 };
}

/** Area-average downscale of RGBA8 (display-referred, like ffmpeg's area filter). */
export function areaDownscale(src, sw, sh, dw, dh) {
  const tmp = new Float32Array(dw * sh * 4);
  const sx = sw / dw;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < dw; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      const acc = [0, 0, 0, 0];
      for (let xi = Math.floor(x0); xi < Math.ceil(x1); xi++) {
        const w = Math.min(x1, xi + 1) - Math.max(x0, xi);
        const o = (y * sw + xi) * 4;
        acc[0] += src[o] * w; acc[1] += src[o + 1] * w; acc[2] += src[o + 2] * w; acc[3] += src[o + 3] * w;
      }
      const t = (y * dw + x) * 4;
      tmp[t] = acc[0] / sx; tmp[t + 1] = acc[1] / sx; tmp[t + 2] = acc[2] / sx; tmp[t + 3] = acc[3] / sx;
    }
  }
  const out = Buffer.alloc(dw * dh * 4);
  const sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    for (let x = 0; x < dw; x++) {
      const acc = [0, 0, 0, 0];
      for (let yi = Math.floor(y0); yi < Math.ceil(y1); yi++) {
        const w = Math.min(y1, yi + 1) - Math.max(y0, yi);
        const o = (yi * dw + x) * 4;
        acc[0] += tmp[o] * w; acc[1] += tmp[o + 1] * w; acc[2] += tmp[o + 2] * w; acc[3] += tmp[o + 3] * w;
      }
      const t = (y * dw + x) * 4;
      out[t] = Math.round(acc[0] / sy); out[t + 1] = Math.round(acc[1] / sy); out[t + 2] = Math.round(acc[2] / sy); out[t + 3] = 255;
    }
  }
  return out;
}

/** Nearest-neighbour resample of an 8-bit mask. */
export function resizeMask(mask, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh);
  for (let y = 0; y < dh; y++) {
    const yy = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / dh));
    for (let x = 0; x < dw; x++) out[y * dw + x] = mask[yy * sw + Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / dw))];
  }
  return out;
}
