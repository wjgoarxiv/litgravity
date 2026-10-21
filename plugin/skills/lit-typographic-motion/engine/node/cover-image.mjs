// Pixel helpers for cover mode, all on RGBA8 buffers: a separable Lanczos-3 resize (the 2x seek
// capture is downsampled with it, as the pilot did), the gate's luma grid (Rec. 709 on gamma values,
// box-averaged to about 300 px wide so every gate number is measured at thumbnail scale), a crop, and
// an SSIM on luma (mean over 8x8 tiles) that compares the base art in decoded frame 0 with its source.

const lanczos = (x, a = 3) => {
  if (x === 0) return 1;
  if (Math.abs(x) >= a) return 0;
  const px = Math.PI * x;
  return (a * Math.sin(px) * Math.sin(px / a)) / (px * px);
};

/** Per output index: the first source index and its normalized weights (support widens when shrinking). */
function kernel(src, dst) {
  const scale = src / dst;
  const support = 3 * Math.max(1, scale);
  const rows = [];
  for (let i = 0; i < dst; i++) {
    const center = (i + 0.5) * scale - 0.5;
    const first = Math.max(0, Math.ceil(center - support));
    const last = Math.min(src - 1, Math.floor(center + support));
    const weights = [];
    let sum = 0;
    for (let j = first; j <= last; j++) {
      const w = lanczos((j - center) / Math.max(1, scale));
      weights.push(w);
      sum += w;
    }
    rows.push({ first, weights: weights.map((w) => w / sum) });
  }
  return rows;
}

/** Lanczos-3 resize of RGBA8; alpha is kept at 255 (captures are opaque). */
export function lanczosResize(src, sw, sh, dw, dh) {
  if (sw === dw && sh === dh) return Buffer.from(src);
  const kx = kernel(sw, dw);
  const ky = kernel(sh, dh);
  const tmp = new Float32Array(dw * sh * 3);
  for (let y = 0; y < sh; y++) {
    const row = y * sw * 4;
    for (let x = 0; x < dw; x++) {
      const { first, weights } = kx[x];
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < weights.length; k++) {
        const o = row + (first + k) * 4;
        const w = weights[k];
        r += src[o] * w; g += src[o + 1] * w; b += src[o + 2] * w;
      }
      const t = (y * dw + x) * 3;
      tmp[t] = r; tmp[t + 1] = g; tmp[t + 2] = b;
    }
  }
  const out = Buffer.alloc(dw * dh * 4);
  const clamp8 = (v) => (v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v));
  for (let y = 0; y < dh; y++) {
    const { first, weights } = ky[y];
    for (let x = 0; x < dw; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < weights.length; k++) {
        const o = ((first + k) * dw + x) * 3;
        const w = weights[k];
        r += tmp[o] * w; g += tmp[o + 1] * w; b += tmp[o + 2] * w;
      }
      const t = (y * dw + x) * 4;
      out[t] = clamp8(r); out[t + 1] = clamp8(g); out[t + 2] = clamp8(b); out[t + 3] = 255;
    }
  }
  return out;
}

export const LUMA_WIDTH = 300;

/** Box-downsampled luma (0..255) at about LUMA_WIDTH wide: { luma, w, h }. */
export function lumaGrid(rgba, width, height, channels = 4) {
  const f = Math.max(1, Math.round(width / LUMA_WIDTH));
  const w = Math.floor(width / f);
  const h = Math.floor(height / f);
  const luma = new Float32Array(w * h);
  for (let y = 0; y < h * f; y++) {
    const row = y * width * channels;
    const oy = Math.floor(y / f) * w;
    for (let x = 0; x < w * f; x++) {
      const p = row + x * channels;
      luma[oy + Math.floor(x / f)] += 0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2];
    }
  }
  const n = f * f;
  for (let i = 0; i < luma.length; i++) luma[i] /= n;
  return { luma, w, h };
}

/** Copy the rectangle [x, y, w, h] out of an RGBA8 frame. */
export function crop(rgba, width, [x, y, w, h]) {
  const out = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) rgba.copy(out, row * w * 4, ((y + row) * width + x) * 4, ((y + row) * width + x + w) * 4);
  return out;
}

/** SSIM of two same-size RGBA8 images on luma: the mean of the SSIM term over 8x8 tiles. */
export function ssim(a, b, width, height) {
  const n = width * height;
  const la = new Float64Array(n);
  const lb = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    la[i] = 0.2126 * a[i * 4] + 0.7152 * a[i * 4 + 1] + 0.0722 * a[i * 4 + 2];
    lb[i] = 0.2126 * b[i * 4] + 0.7152 * b[i * 4 + 1] + 0.0722 * b[i * 4 + 2];
  }
  const T = 8;
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let total = 0;
  let tiles = 0;
  for (let ty = 0; ty + T <= height; ty += T) {
    for (let tx = 0; tx + T <= width; tx += T) {
      let ma = 0;
      let mb = 0;
      for (let y = ty; y < ty + T; y++) for (let x = tx; x < tx + T; x++) { ma += la[y * width + x]; mb += lb[y * width + x]; }
      ma /= T * T;
      mb /= T * T;
      let va = 0;
      let vb = 0;
      let cov = 0;
      for (let y = ty; y < ty + T; y++) {
        for (let x = tx; x < tx + T; x++) {
          const da = la[y * width + x] - ma;
          const db = lb[y * width + x] - mb;
          va += da * da; vb += db * db; cov += da * db;
        }
      }
      const m = T * T - 1;
      total += ((2 * ma * mb + C1) * (2 * (cov / m) + C2)) / ((ma * ma + mb * mb + C1) * (va / m + vb / m + C2));
      tiles += 1;
    }
  }
  return tiles ? total / tiles : 0;
}
