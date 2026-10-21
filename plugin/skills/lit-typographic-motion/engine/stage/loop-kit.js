// LitLoop kit: helpers for a cover-mode page (the seamless README cover loop of
// lit-typographic-motion). A classic script served by the cover renderer at /lit/loop-kit.js. A cover
// page draws every frame from one loop time t in [0, 1) through window.renderFrame(t); the renderer
// seeks t = i / N in any order. So every helper here is periodic in t or pure: frame N wraps to
// frame 0 with no seam, and a frame never depends on the frame drawn before it. The renderer makes
// Math.random, Date.now, performance.now and requestAnimationFrame throw, so layout randomness comes
// from rng(seed) and per-frame variation comes only from t.
(function (root) {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const fract = (x) => x - Math.floor(x);
  const mix = (a, b, k) => a + (b - a) * k;

  // Seeded generator (mulberry32) for layout: positions, sizes, which copy gets the accent.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 3D value noise on a seeded lattice. loopNoise walks it on a circle, so the value at t = 1 equals
  // the value at t = 0; `offset` separates elements and `radius` sets how much one loop varies.
  function makeNoise(seed) {
    const r = rng(seed);
    const perm = new Uint8Array(512);
    const values = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      perm[i] = i;
      values[i] = r() * 2 - 1;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const s = (x) => x * x * (3 - 2 * x);
    const at = (x, y, z) => values[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
    return (x, y, z) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const zi = Math.floor(z);
      const u = s(x - xi);
      const v = s(y - yi);
      const w = s(z - zi);
      const lx = (a, b) => mix(a, b, u);
      const c00 = lx(at(xi, yi, zi), at(xi + 1, yi, zi));
      const c10 = lx(at(xi, yi + 1, zi), at(xi + 1, yi + 1, zi));
      const c01 = lx(at(xi, yi, zi + 1), at(xi + 1, yi, zi + 1));
      const c11 = lx(at(xi, yi + 1, zi + 1), at(xi + 1, yi + 1, zi + 1));
      return mix(mix(c00, c10, v), mix(c01, c11, v), w);
    };
  }
  const loopNoise = (noise, t, offset = 0, radius = 1.3) => noise(offset + radius * Math.cos(TAU * t), radius * Math.sin(TAU * t), offset * 0.37);

  // Shapes. Linear is only for motion that never stops (drift, laps); events get one of these.
  const ease = Object.freeze({
    smooth: (p) => p * p * (3 - 2 * p),
    outCubic: (p) => 1 - (1 - p) ** 3,
    inCubic: (p) => p ** 3,
    outExpo: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
    outBack: (p, s = 1.6) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2,
    gain: (p, k) => (p < 0.5 ? 0.5 * (2 * p) ** k : 1 - 0.5 * (2 * (1 - p)) ** k),
  });
  // A symmetric bump of half-width w around c (0 outside). Prefer it to expImpulse for micro events:
  // an exponential tail is a slow fade, and a lossy animation encoder drops slow fades.
  const cubicPulse = (c, w, x) => {
    let d = Math.abs(x - c);
    if (d > w) return 0;
    d /= w;
    return 1 - d * d * (3 - 2 * d);
  };
  const expImpulse = (x, k) => {
    const h = k * x;
    return h * Math.exp(1 - h);
  };

  // Loop position of one copy: the same rule at a different offset is the whole trick.
  const phase = (t, offset = 0, cycles = 1) => fract(t * cycles - offset);
  // Distance of p from c around the loop (0..0.5), for an event that straddles t = 0.
  const cdist = (p, c) => {
    const d = Math.abs(fract(p - c));
    return Math.min(d, 1 - d);
  };
  // A one-shot event inside the loop: -1 outside [start, start + dur) (wrapping), else 0..1.
  const window_ = (p, start, dur) => {
    const q = fract(p - start);
    return q < dur ? q / dur : -1;
  };
  // Hold and move: dwell at `stops` poses per cycle and travel the last `travel` of each slot.
  const steps = (p, stops, travel = 0.35, e = ease.smooth) => {
    const x = p * stops;
    const i = Math.floor(x);
    const k = clamp((x - i - (1 - travel)) / travel);
    return (i + e(k)) / stops;
  };
  // A cosine swell 0..1..0 that dwells at both ends.
  const swell = (p) => 0.5 - 0.5 * Math.cos(TAU * p);

  root.LitLoop = Object.freeze({ TAU, clamp, fract, mix, rng, makeNoise, loopNoise, ease, cubicPulse, expImpulse, phase, cdist, window: window_, steps, swell });
})(typeof window !== "undefined" ? window : globalThis);
