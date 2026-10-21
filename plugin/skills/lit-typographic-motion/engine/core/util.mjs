// Pure math, easing and seeded-randomness helpers shared by the page engine and the Node side.
// Adapted from mexicat/pdoom-video app/src/engine/util.ts (MIT, see ../NOTICE). Every function is a
// deterministic function of its arguments: nothing here may read a clock or an unseeded RNG
// (MO-A-23), because the determinism gate hashes frames rendered by two separate processes.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (a === b ? 0 : (x - a) / (b - a));
export const remap = (x, a, b, c, d, clamped = true) => {
  const t = invLerp(a, b, x);
  return lerp(c, d, clamped ? clamp(t) : t);
};
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const fract = (x) => x - Math.floor(x);
export const mod = (x, m) => ((x % m) + m) % m;
export const TAU = Math.PI * 2;

// Cubic bezier easing, solved by a fixed 40-step bisection so the value never depends on a
// convergence tolerance.
function bezier(x1, y1, x2, y2) {
  const coord = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (coord(mid, x1, x2) < x) lo = mid;
      else hi = mid;
    }
    return coord((lo + hi) / 2, y1, y2);
  };
}

// The named easing set (MO-A-08). Scenes pick from these names; ad hoc curves are not allowed.
export const ease = Object.freeze({
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  // Film tokens from the preset bibles (MO-B-01..03).
  slam: bezier(0.16, 1, 0.3, 1),
  drift: bezier(0.37, 0, 0.63, 1),
  surgePunch: bezier(0.16, 1, 0.3, 1),
});

/** Eased progress of x through [a, b], clamped. */
export const prog = (x, a, b, fn = ease.linear) => fn(clamp((x - a) / (b - a)));

/**
 * Piecewise interpolation through keyframes `[[time, value, easeName], ...]`; the ease on key i
 * shapes the segment that ends at key i. Only names from `ease` are accepted.
 */
export function keys(t, ks) {
  if (ks.length === 0) return 0;
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    const [time, value, name = "inOutCubic"] = ks[i];
    if (t <= time) {
      const [pt, pv] = ks[i - 1];
      const fn = ease[name];
      if (!fn) throw new Error(`unknown ease: ${name}`);
      return lerp(pv, value, fn((t - pt) / (time - pt)));
    }
  }
  return ks[ks.length - 1][1];
}

/** Damped spring response to a step at time 0 (the rare deliberate overshoot, MO-A-08). */
export const springStep = (t, freq = 4, damping = 0.35) => {
  if (t <= 0) return 0;
  const w = TAU * freq;
  return 1 - Math.exp(-damping * w * t) * Math.cos(w * Math.sqrt(1 - damping * damping) * t);
};

/** Exponential decay after an event at t0 (1 at t0, half-life hl). */
export const pulse = (t, t0, hl = 0.12) => (t < t0 ? 0 : 0.5 ** ((t - t0) / hl));

// ---- seeded randomness (MO-SH-01, MO-A-23) ----

/** FNV-1a 32-bit over the UTF-8 bytes of `text`; offset basis 0x811c9dc5, prime 0x01000193. */
export function fnv1a32(text) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** MO-SH-01: the one seed formula for every pass in every product. */
export const passSeed = (runSeed, sceneId, shotIndex, pass) => fnv1a32(`${runSeed}:${sceneId}:${shotIndex}:${pass}`);

/** mulberry32 PRNG in unsigned 32-bit arithmetic. Returns a function yielding [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash of numbers to [0, 1). */
export function hash(...xs) {
  let h = 2166136261 >>> 0;
  for (const x of xs) {
    h ^= Math.floor(x * 1000003) | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

const quintic = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, quintic(x - i));
}

// ---- colour ----

export const srgbToLinear = (s) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (l) => (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);

export function hexToRgb(hex) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const hexToLinear = (hex) => hexToRgb(hex).map((v) => srgbToLinear(v / 255));

/** WCAG relative luminance of an sRGB hex colour. */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrastRatio = (la, lb) => (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);

/** HSL hue (degrees) and saturation (0..1) of 0..255 sRGB values. */
export function hsl(r, g, b) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: mod(h * 60, 360), s, l };
}
export const hueDistance = (a, b) => {
  const d = Math.abs(mod(a, 360) - mod(b, 360));
  return Math.min(d, 360 - d);
};
