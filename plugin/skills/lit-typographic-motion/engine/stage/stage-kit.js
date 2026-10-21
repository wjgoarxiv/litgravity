// LitStage kit: motion primitives for a model-authored stage page (the stage path of
// lit-typographic-motion). A classic script served by the renderer at /lit/stage-kit.js. It holds
// primitives only, never a scene, an object, a layout or copy. Everything here is a pure function
// of its inputs: the renderer owns the clock (it calls render(t) frame by frame and virtualizes the
// page's timers), so the kit never reads a clock or unseeded entropy. Randomness is `rand(seed)`.
(function (root) {
  "use strict";

  // ---- small math ----
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, x) => (a === b ? 0 : (x - a) / (b - a));
  const remap = (x, a, b, c, d, clamped = true) => {
    const t = invLerp(a, b, x);
    return lerp(c, d, clamped ? clamp(t) : t);
  };
  const smoothstep = (a, b, x) => {
    const t = clamp(invLerp(a, b, x));
    return t * t * (3 - 2 * t);
  };

  // ---- easing ----
  // cubic-bezier as CSS defines it: solve x(u) = x for u (Newton, then bisection), return y(u).
  function cubicBezier(x1, y1, x2, y2) {
    if (![x1, y1, x2, y2].every(Number.isFinite) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
      throw new Error("cubicBezier: x1 and x2 must lie in [0, 1]");
    }
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sx = (u) => ((ax * u + bx) * u + cx) * u;
    const sy = (u) => ((ay * u + by) * u + cy) * u;
    const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
    const solve = (x) => {
      let u = x;
      for (let i = 0; i < 8; i++) {
        const err = sx(u) - x;
        if (Math.abs(err) < 1e-7) return u;
        const d = dx(u);
        if (Math.abs(d) < 1e-6) break;
        u -= err / d;
      }
      let lo = 0;
      let hi = 1;
      u = x;
      for (let i = 0; i < 60; i++) {
        const v = sx(u);
        if (Math.abs(v - x) < 1e-7) return u;
        if (v < x) lo = u;
        else hi = u;
        u = (lo + hi) / 2;
      }
      return u;
    };
    // Exact endpoints: a film that ends on ease(1) must land exactly, not 0.9999999.
    return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
  }

  const BACK = 1.70158;
  const inOut = (f) => (t) => (t < 0.5 ? f(2 * t) / 2 : 1 - f(2 - 2 * t) / 2);
  const out = (f) => (t) => 1 - f(1 - t);
  const pow = (n) => (t) => t ** n;
  const sine = (t) => 1 - Math.cos((t * Math.PI) / 2);
  const expo = (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10));
  const circ = (t) => 1 - Math.sqrt(1 - t * t);
  const back = (t) => (BACK + 1) * t * t * t - BACK * t * t;
  const guard = (f) => (t) => (t <= 0 ? 0 : t >= 1 ? 1 : f(t));

  const ease = Object.freeze({
    linear: (t) => clamp(t),
    inQuad: guard(pow(2)), outQuad: guard(out(pow(2))), inOutQuad: guard(inOut(pow(2))),
    inCubic: guard(pow(3)), outCubic: guard(out(pow(3))), inOutCubic: guard(inOut(pow(3))),
    inQuart: guard(pow(4)), outQuart: guard(out(pow(4))), inOutQuart: guard(inOut(pow(4))),
    inQuint: guard(pow(5)), outQuint: guard(out(pow(5))), inOutQuint: guard(inOut(pow(5))),
    inSine: guard(sine), outSine: guard(out(sine)), inOutSine: guard(inOut(sine)),
    inExpo: guard(expo), outExpo: guard(out(expo)), inOutExpo: guard(inOut(expo)),
    inCirc: guard(circ), outCirc: guard(out(circ)), inOutCirc: guard(inOut(circ)),
    inBack: guard(back), outBack: guard(out(back)), inOutBack: guard(inOut(back)),
    // Motion-design curves: settle-heavy decelerations for arrivals, a quick start for exits.
    standard: cubicBezier(0.2, 0, 0, 1),
    emphasized: cubicBezier(0.05, 0.7, 0.1, 1),
    decelerate: cubicBezier(0, 0, 0, 1),
    accelerate: cubicBezier(0.3, 0, 1, 1),
    css: cubicBezier(0.25, 0.1, 0.25, 1),
  });

  const easeOf = (e) => {
    if (typeof e === "function") return e;
    if (e === undefined || e === null) return ease.linear;
    if (typeof e === "string" && ease[e]) return ease[e];
    if (Array.isArray(e) && e.length === 4) return cubicBezier(...e);
    throw new Error(`unknown ease: ${String(e)}`);
  };

  // ---- analytic spring ----
  // Position of a damped spring released at 0 with target 1 (x = displacement from the target).
  function springFn({ stiffness = 170, damping = 26, mass = 1, velocity = 0 } = {}) {
    if (!(stiffness > 0 && damping >= 0 && mass > 0)) throw new Error("spring: stiffness and mass must be > 0, damping >= 0");
    const w0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    const x0 = -1;
    const v0 = velocity;
    let x;
    if (Math.abs(zeta - 1) < 1e-6) {
      x = (t) => Math.exp(-w0 * t) * (x0 + (v0 + w0 * x0) * t);
    } else if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      const b = (v0 + zeta * w0 * x0) / wd;
      x = (t) => Math.exp(-zeta * w0 * t) * (x0 * Math.cos(wd * t) + b * Math.sin(wd * t));
    } else {
      const s = Math.sqrt(zeta * zeta - 1);
      const r1 = -w0 * (zeta - s);
      const r2 = -w0 * (zeta + s);
      const a = (v0 - r2 * x0) / (r1 - r2);
      const b = x0 - a;
      x = (t) => a * Math.exp(r1 * t) + b * Math.exp(r2 * t);
    }
    return (t) => (t <= 0 ? 0 : 1 + x(t));
  }
  const spring = (opts) => springFn(opts);
  // Settle time: the last moment the spring is more than 0.1 % away from its target.
  spring.settle = (opts, { tolerance = 0.001, limit = 60 } = {}) => {
    const p = springFn(opts);
    const step = 1 / 600;
    let last = 0;
    for (let t = 0; t <= limit; t += step) if (Math.abs(p(t) - 1) > tolerance) last = t;
    return +(last + step).toFixed(4);
  };

  // ---- colour ----
  const NAMED = { black: "#000000", white: "#ffffff", transparent: "#00000000" };
  function parseColor(input) {
    const c = String(input).trim().toLowerCase();
    const s = NAMED[c] ?? c;
    let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/u.exec(s);
    if (m) {
      let h = m[1];
      if (h.length <= 4) h = [...h].map((ch) => ch + ch).join("");
      const n = (i) => parseInt(h.slice(i, i + 2), 16);
      return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
    }
    m = /^rgba?\(([^)]*)\)$/u.exec(s);
    if (m) {
      const parts = m[1].split(/[\s,/]+/u).filter(Boolean);
      const ch = (v) => (v.endsWith("%") ? (parseFloat(v) * 255) / 100 : parseFloat(v));
      const a = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
      const out3 = [ch(parts[0]), ch(parts[1]), ch(parts[2]), a];
      if (out3.every(Number.isFinite)) return out3;
    }
    throw new Error(`unsupported colour: ${String(input)}`);
  }
  const toLinear = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const toSrgb = (l) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * Math.max(0, l) ** (1 / 2.4) - 0.055);
  function toOklab([r, g, b]) {
    const R = toLinear(r);
    const G = toLinear(g);
    const B = toLinear(b);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  }
  function fromOklab([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ];
  }
  const fmt = (rgb, a) => {
    const [r, g, b] = rgb.map((v) => Math.round(clamp(v, 0, 255)));
    return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+clamp(a).toFixed(4)})`;
  };
  function mix(a, b, t, { space = "oklab" } = {}) {
    const A = parseColor(a);
    const B = parseColor(b);
    const k = clamp(t);
    const alpha = lerp(A[3], B[3], k);
    if (space === "srgb") return fmt([0, 1, 2].map((i) => lerp(A[i], B[i], k)), alpha);
    if (space !== "oklab") throw new Error(`mix: unknown space ${space}`);
    const la = toOklab(A);
    const lb = toOklab(B);
    return fmt(fromOklab([0, 1, 2].map((i) => lerp(la[i], lb[i], k))), alpha);
  }
  const rgba = (color, alpha) => {
    const c = parseColor(color);
    return fmt(c.slice(0, 3), clamp(alpha) * c[3]);
  };

  // ---- keyframes ----
  // keys: [{ t, v, ease? }], sorted by t. `ease` on key k shapes the segment from key k to key k+1.
  function kf(t, keys) {
    if (!Array.isArray(keys) || keys.length === 0) throw new Error("kf: keys must be a non-empty array");
    // Colours always come back as rgb() strings, clamped ends included.
    const norm = (v) => (typeof v === "string" ? mix(v, v, 0) : v);
    if (t <= keys[0].t) return norm(keys[0].v);
    const last = keys[keys.length - 1];
    if (t >= last.t) return norm(last.v);
    let i = 0;
    while (i < keys.length - 2 && t >= keys[i + 1].t) i += 1;
    const a = keys[i];
    const b = keys[i + 1];
    const e = easeOf(a.ease)(invLerp(a.t, b.t, t));
    if (typeof a.v === "number") return lerp(a.v, b.v, e);
    if (Array.isArray(a.v)) return a.v.map((x, j) => lerp(x, b.v[j], e));
    if (typeof a.v === "string") return mix(a.v, b.v, e);
    throw new Error("kf: values must be numbers, number arrays or colour strings");
  }

  // ---- timing ----
  // stagger(i, each, { from, count }): the delay of item i. `from` is an index, "center" or "end".
  function stagger(i, each, { from = 0, count } = {}) {
    if (from === "center" || from === "end") {
      if (!Number.isInteger(count) || count < 1) throw new Error(`stagger: from "${from}" needs count`);
      return (from === "end" ? count - 1 - i : Math.abs(i - (count - 1) / 2)) * each;
    }
    return Math.abs(i - from) * each;
  }

  // Local progress of a window [start, start + dur), eased, clamped to 0..1.
  const at = (t, start, dur, e) => easeOf(e)(dur > 0 ? clamp((t - start) / dur) : t >= start ? 1 : 0);

  // seq(["name", dur, offset?], ...): segments laid end to end; a negative offset overlaps the
  // previous one. tl.p(name, t, ease?) -> 0..1, tl.local(name, t) -> seconds since its start,
  // tl.active(name, t) -> boolean, tl.seg[name] -> { start, dur, end }, tl.duration.
  function seq(...steps) {
    const seg = {};
    let cursor = 0;
    let duration = 0;
    for (const step of steps) {
      const [name, dur, offset = 0] = step;
      if (typeof name !== "string" || !(dur >= 0)) throw new Error("seq: each step is [name, seconds, offset?]");
      if (seg[name]) throw new Error(`seq: duplicate step ${name}`);
      const start = Math.max(0, cursor + offset);
      seg[name] = Object.freeze({ start, dur, end: start + dur });
      cursor = start + dur;
      duration = Math.max(duration, cursor);
    }
    const get = (name) => {
      if (!seg[name]) throw new Error(`seq: no step ${name}`);
      return seg[name];
    };
    return Object.freeze({
      seg: Object.freeze(seg),
      duration,
      p: (name, t, e) => at(t, get(name).start, get(name).dur, e),
      local: (name, t) => t - get(name).start,
      active: (name, t) => t >= get(name).start && t < get(name).end,
    });
  }

  // ---- seeded randomness (mulberry32) ----
  function rand(seed = 1) {
    let a = (Number(seed) >>> 0) || 0x9e3779b9;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  rand.int = (seed) => {
    const r = rand(seed);
    return (a, b) => a + Math.floor(r() * (b - a + 1));
  };
  rand.range = (seed) => {
    const r = rand(seed);
    return (a, b) => a + r() * (b - a);
  };

  // ---- text ----
  const segmenter = (granularity) => (typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity }) : null);

  // Segments of a string as { text, part } where `part` marks a unit and whitespace stays between.
  function segments(str, by) {
    if (by === "line") return str.split(/(\n)/u).filter((s) => s.length).map((s) => ({ text: s, part: s !== "\n" }));
    if (by === "eojeol") return str.split(/(\s+)/u).filter((s) => s.length).map((s) => ({ text: s, part: !/^\s+$/u.test(s) }));
    if (by === "grapheme" || by === "word") {
      const seg = segmenter(by);
      // Without Intl.Segmenter, code points are the fallback; a precomposed syllable is one code point.
      const pieces = seg ? [...seg.segment(str)].map((s) => s.segment) : Array.from(str);
      return pieces.map((s) => ({ text: s, part: !/^\s+$/u.test(s) }));
    }
    throw new Error(`splitText: by must be grapheme, word, eojeol or line (got ${by})`);
  }

  // splitText(string, opts) -> unit strings; splitText(element, opts) -> the new span elements. The
  // element keeps its own attributes (its data-lit-text mark included); only its children change.
  function splitText(target, { by = "grapheme" } = {}) {
    if (typeof target === "string") return segments(target, by).filter((s) => s.part).map((s) => s.text);
    if (!target || typeof target.textContent !== "string" || !target.ownerDocument) throw new Error("splitText: pass a string or an element");
    const doc = target.ownerDocument;
    const spans = [];
    const pieces = segments(target.textContent, by);
    while (target.firstChild) target.removeChild(target.firstChild);
    for (const s of pieces) {
      if (!s.part) {
        if (s.text !== "\n") target.appendChild(doc.createTextNode(s.text));
        continue;
      }
      const span = doc.createElement("span");
      span.setAttribute("data-lit-part", String(spans.length));
      // Transforms do not apply to inline boxes; units must be inline-block (lines are blocks).
      span.style.display = by === "line" ? "block" : "inline-block";
      span.textContent = s.text;
      target.appendChild(span);
      spans.push(span);
    }
    return spans;
  }

  // text(el, { decor }) marks one DOM/SVG text run; text({ content, x, y, w, h }) registers canvas or
  // WebGL text for the current frame (the renderer empties the list before every frame).
  function text(target, opts = {}) {
    if (target && typeof target === "object" && typeof target.nodeType === "number") {
      target.setAttribute("data-lit-text", "1");
      if (opts.decor) target.setAttribute("data-lit-decor", "1");
      else target.removeAttribute("data-lit-decor");
      return target;
    }
    const { content, x, y, w, h, decor = false } = target ?? {};
    if (typeof content !== "string" || ![x, y, w, h].every(Number.isFinite) || !(w > 0 && h > 0)) {
      throw new Error("LitStage.text: pass an element, or { content, x, y, w, h } for canvas text");
    }
    if (!Array.isArray(root.__litStageTexts)) root.__litStageTexts = [];
    const entry = { content, x, y, w, h, decor: Boolean(decor) };
    root.__litStageTexts.push(entry);
    return entry;
  }

  // ---- SVG stroke draw ----
  function drawPath(el, progress) {
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len} ${len}`;
    el.style.strokeDashoffset = String(len * (1 - clamp(progress)));
    return len;
  }

  // ---- path parsing (single subpath) to cubic segments [x0, y0, c1x, c1y, c2x, c2y, x, y] ----
  function parsePath(d) {
    const src = String(d);
    let i = 0;
    const skip = () => {
      while (i < src.length && /[\s,]/u.test(src[i])) i += 1;
    };
    const number = () => {
      skip();
      const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/u.exec(src.slice(i));
      if (!m) throw new Error(`morph: bad number at ${i} in path`);
      i += m[0].length;
      return parseFloat(m[0]);
    };
    const flag = () => {
      skip();
      const ch = src[i];
      if (ch !== "0" && ch !== "1") throw new Error(`morph: bad arc flag at ${i}`);
      i += 1;
      return ch === "1";
    };
    const hasNumber = () => {
      skip();
      return i < src.length && /[-+.\d]/u.test(src[i]);
    };
    const segs = [];
    let x = 0;
    let y = 0;
    let sx = 0;
    let sy = 0;
    let started = false;
    let closed = false;
    let prevCmd = "";
    let lastC = null; // reflected control for S
    let lastQ = null; // reflected control for T
    const line = (nx, ny) => {
      segs.push([x, y, x + (nx - x) / 3, y + (ny - y) / 3, x + (2 * (nx - x)) / 3, y + (2 * (ny - y)) / 3, nx, ny]);
      x = nx;
      y = ny;
    };
    const cubic = (c1x, c1y, c2x, c2y, nx, ny) => {
      segs.push([x, y, c1x, c1y, c2x, c2y, nx, ny]);
      x = nx;
      y = ny;
    };
    const quad = (qx, qy, nx, ny) => cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), nx + (2 / 3) * (qx - nx), ny + (2 / 3) * (qy - ny), nx, ny);
    for (;;) {
      skip();
      if (i >= src.length) break;
      let cmd = src[i];
      if (/[a-z]/iu.test(cmd)) i += 1;
      else if (prevCmd) cmd = prevCmd === "M" ? "L" : prevCmd === "m" ? "l" : prevCmd;
      else throw new Error("morph: path must start with M");
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      const ox = rel ? x : 0;
      const oy = rel ? y : 0;
      if (C === "M") {
        if (started) throw new Error("morph: multi-subpath paths are unsupported");
        x = ox + number();
        y = oy + number();
        sx = x;
        sy = y;
        started = true;
      } else if (!started) {
        throw new Error("morph: path must start with M");
      } else if (closed && C !== "Z") {
        throw new Error("morph: multi-subpath paths are unsupported");
      } else if (C === "Z") {
        if (Math.hypot(x - sx, y - sy) > 1e-9) line(sx, sy);
        closed = true;
      } else if (C === "L") line(ox + number(), oy + number());
      else if (C === "H") line(ox + number(), y);
      else if (C === "V") line(x, oy + number());
      else if (C === "C") {
        const c1x = ox + number();
        const c1y = oy + number();
        const c2x = ox + number();
        const c2y = oy + number();
        cubic(c1x, c1y, c2x, c2y, ox + number(), oy + number());
      } else if (C === "S") {
        const r = /[CS]/u.test(prevCmd.toUpperCase()) && lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y];
        const c2x = ox + number();
        const c2y = oy + number();
        cubic(r[0], r[1], c2x, c2y, ox + number(), oy + number());
      } else if (C === "Q") {
        const qx = ox + number();
        const qy = oy + number();
        quad(qx, qy, ox + number(), oy + number());
        lastQ = [qx, qy];
      } else if (C === "T") {
        const q = /[QT]/u.test(prevCmd.toUpperCase()) && lastQ ? [2 * x - lastQ[0], 2 * y - lastQ[1]] : [x, y];
        quad(q[0], q[1], ox + number(), oy + number());
        lastQ = q;
      } else if (C === "A") {
        const rx = number();
        const ry = number();
        const rot = number();
        const large = flag();
        const sweep = flag();
        arc(x, y, rx, ry, rot, large, sweep, ox + number(), oy + number(), cubic);
      } else throw new Error(`morph: unknown command ${cmd}`);
      if (C === "C" || C === "S") {
        const s = segs[segs.length - 1];
        lastC = [s[4], s[5]];
      }
      prevCmd = cmd;
      // A command letter may repeat its arguments; loop back without a new letter.
      if (C !== "Z" && hasNumber()) continue;
    }
    if (!segs.length) throw new Error("morph: path has no drawable segment");
    return { segs: segs.filter((s) => segLength(s) > 1e-9), closed };
  }

  // SVG arc (endpoint form) to cubic pieces of at most 90 degrees (SVG 1.1 F.6.5).
  function arc(x1, y1, rx, ry, rotDeg, large, sweep, x2, y2, cubic) {
    if (Math.hypot(x2 - x1, y2 - y1) < 1e-12) return;
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (rx < 1e-12 || ry < 1e-12) {
      cubic(x1 + (x2 - x1) / 3, y1 + (y2 - y1) / 3, x1 + (2 * (x2 - x1)) / 3, y1 + (2 * (y2 - y1)) / 3, x2, y2);
      return;
    }
    const phi = (rotDeg * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const xp = cos * dx + sin * dy;
    const yp = -sin * dx + cos * dy;
    const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (lambda > 1) {
      rx *= Math.sqrt(lambda);
      ry *= Math.sqrt(lambda);
    }
    const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
    const den = rx * rx * yp * yp + ry * ry * xp * xp;
    let co = Math.sqrt(Math.max(0, num / den));
    if (large === sweep) co = -co;
    const cxp = (co * rx * yp) / ry;
    const cyp = (-co * ry * xp) / rx;
    const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
    const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
    const angle = (ux, uy, vx, vy) => {
      const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      return a;
    };
    const t1 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    let dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI;
    else if (sweep && dt < 0) dt += 2 * Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
    const step = dt / n;
    const k = (4 / 3) * Math.tan(step / 4);
    const pt = (a) => [cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin, cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos];
    const der = (a) => [-rx * Math.sin(a) * cos - ry * Math.cos(a) * sin, -rx * Math.sin(a) * sin + ry * Math.cos(a) * cos];
    let a0 = t1;
    for (let j = 0; j < n; j++) {
      const a1 = a0 + step;
      const p0 = pt(a0);
      const p1 = j === n - 1 ? [x2, y2] : pt(a1);
      const d0 = der(a0);
      const d1 = der(a1);
      cubic(p0[0] + k * d0[0], p0[1] + k * d0[1], p1[0] - k * d1[0], p1[1] - k * d1[1], p1[0], p1[1]);
      a0 = a1;
    }
  }

  const bez = (s, u) => {
    const v = 1 - u;
    const a = v * v * v;
    const b = 3 * v * v * u;
    const c = 3 * v * u * u;
    const d = u * u * u;
    return [a * s[0] + b * s[2] + c * s[4] + d * s[6], a * s[1] + b * s[3] + c * s[5] + d * s[7]];
  };
  const LUT_STEPS = 32;
  function segLut(s) {
    const lut = [0];
    let prev = [s[0], s[1]];
    for (let k = 1; k <= LUT_STEPS; k++) {
      const p = bez(s, k / LUT_STEPS);
      lut.push(lut[k - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
      prev = p;
    }
    return lut;
  }
  const segLength = (s) => segLut(s)[LUT_STEPS];
  // Parameter u at arc length `len` along the segment (linear inside the lookup table).
  function paramAt(lut, len) {
    const total = lut[LUT_STEPS];
    if (len <= 0) return 0;
    if (len >= total) return 1;
    let k = 1;
    while (lut[k] < len) k += 1;
    return (k - 1 + invLerp(lut[k - 1], lut[k], len)) / LUT_STEPS;
  }
  // de Casteljau split at u: [left, right].
  function split(s, u) {
    const L = (a, b) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    const p0 = [s[0], s[1]];
    const p1 = [s[2], s[3]];
    const p2 = [s[4], s[5]];
    const p3 = [s[6], s[7]];
    const a = L(p0, p1);
    const b = L(p1, p2);
    const c = L(p2, p3);
    const d = L(a, b);
    const e = L(b, c);
    const m = L(d, e);
    return [[...p0, ...a, ...d, ...m], [...m, ...e, ...c, ...p3]];
  }
  function subSegment(s, u0, u1) {
    if (u1 >= 1 - 1e-12 && u0 <= 1e-12) return s.slice();
    const right = u0 > 1e-12 ? split(s, u0)[1] : s;
    const local = (u1 - u0) / (1 - u0);
    return local >= 1 - 1e-12 ? right : split(right, local)[0];
  }

  // Split each segment into pieces of equal arc length; piece counts follow segment lengths
  // (largest remainder, at least one each) so every output cubic stays inside one input segment.
  function resample(segs, n) {
    const luts = segs.map(segLut);
    const lens = luts.map((l) => l[LUT_STEPS]);
    const total = lens.reduce((a, b) => a + b, 0);
    const raw = lens.map((l) => (l / total) * n);
    const counts = raw.map((r) => Math.max(1, Math.floor(r)));
    let sum = counts.reduce((a, b) => a + b, 0);
    const order = raw.map((r, k) => [r - Math.floor(r), k]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let j = 0; sum < n; j = (j + 1) % order.length) {
      counts[order[j][1]] += 1;
      sum += 1;
    }
    while (sum > n) {
      let big = 0;
      for (let k = 1; k < counts.length; k++) if (counts[k] > counts[big]) big = k;
      counts[big] -= 1;
      sum -= 1;
    }
    const outSegs = [];
    segs.forEach((s, k) => {
      for (let j = 0; j < counts[k]; j++) {
        const u0 = paramAt(luts[k], (lens[k] * j) / counts[k]);
        const u1 = j === counts[k] - 1 ? 1 : paramAt(luts[k], (lens[k] * (j + 1)) / counts[k]);
        outSegs.push(subSegment(s, u0, u1));
      }
    });
    return outSegs;
  }

  const reverseSegs = (segs) => segs.slice().reverse().map((s) => [s[6], s[7], s[4], s[5], s[2], s[3], s[0], s[1]]);
  const signedArea = (segs) => segs.reduce((a, s) => a + (s[0] * s[7] - s[6] * s[1]), 0);
  const cost = (a, b) => a.reduce((sum, s, k) => sum + (s[0] - b[k][0]) ** 2 + (s[1] - b[k][1]) ** 2 + (s[6] - b[k][6]) ** 2 + (s[7] - b[k][7]) ** 2, 0);
  const num = (v) => {
    const r = Math.round(v * 1000) / 1000;
    return String(Object.is(r, -0) ? 0 : r);
  };
  const pathD = (segs, closed) => `M${num(segs[0][0])} ${num(segs[0][1])}${segs.map((s) => `C${s.slice(2).map(num).join(" ")}`).join("")}${closed ? "Z" : ""}`;

  // morph(fromD, toD, { samples }) -> fn(p) returning a `d` string. Single subpath only.
  function morph(fromD, toD, { samples = 64 } = {}) {
    const A = parsePath(fromD);
    const B = parsePath(toD);
    const closed = A.closed && B.closed;
    const n = Math.max(samples, A.segs.length, B.segs.length);
    const a = resample(A.segs, n);
    let b = resample(B.segs, n);
    if (closed) {
      if (Math.sign(signedArea(a)) !== Math.sign(signedArea(b))) b = reverseSegs(b);
      // Best rotation: the start index of the target ring that minimizes the summed squared distance.
      let best = { k: 0, c: Infinity };
      for (let k = 0; k < n; k++) {
        const rot = b.slice(k).concat(b.slice(0, k));
        const c = cost(a, rot);
        if (c < best.c) best = { k, c };
      }
      b = b.slice(best.k).concat(b.slice(0, best.k));
    } else {
      const rev = reverseSegs(b);
      if (cost(a, rev) < cost(a, b)) b = rev;
    }
    const fn = (p) => {
      const t = clamp(p);
      return pathD(a.map((s, k) => s.map((v, j) => lerp(v, b[k][j], t))), closed);
    };
    fn.from = a;
    fn.to = b;
    fn.closed = closed;
    return fn;
  }

  // ---- masks and clips (styles only) ----
  const pct = (v) => `${+(v * 100).toFixed(4)}%`;
  function setStyle(el, prop, value) {
    el.style[prop] = value;
    const webkit = `webkit${prop[0].toUpperCase()}${prop.slice(1)}`;
    if (webkit in el.style) el.style[webkit] = value;
  }
  // clipRect(el, p, { from }): p = 0 hidden, p = 1 fully shown, revealed from that edge.
  function clipRect(el, p, { from = "left" } = {}) {
    const h = 1 - clamp(p);
    const inset = {
      left: `inset(0 ${pct(h)} 0 0)`,
      right: `inset(0 0 0 ${pct(h)})`,
      top: `inset(0 0 ${pct(h)} 0)`,
      bottom: `inset(${pct(h)} 0 0 0)`,
      center: `inset(${pct(h / 2)} ${pct(h / 2)})`,
    }[from];
    if (!inset) throw new Error(`clipRect: from must be left, right, top, bottom or center (got ${from})`);
    setStyle(el, "clipPath", inset);
    return inset;
  }
  // clipCircle(el, p, { x, y }): an iris from (x%, y%); p = 1 covers the box from any corner.
  function clipCircle(el, p, { x = 50, y = 50 } = {}) {
    const value = `circle(${+(clamp(p) * 142).toFixed(4)}% at ${x}% ${y}%)`;
    setStyle(el, "clipPath", value);
    return value;
  }
  // maskLinear(el, p, { angle, feather }): a soft-edged reveal along `angle` degrees.
  function maskLinear(el, p, { angle = 90, feather = 0.1 } = {}) {
    const edge = clamp(p) * (1 + feather);
    const value = `linear-gradient(${angle}deg, #000 ${pct(edge - feather)}, transparent ${pct(edge)})`;
    setStyle(el, "maskImage", value);
    return value;
  }
  const wipe = (el, p, opts) => clipRect(el, p, opts);

  // ---- the page contract ----
  const FORMATS = [[1920, 1080], [1080, 1920]];
  function define(spec) {
    const { width, height, fps = 60, duration, render } = spec ?? {};
    if (!FORMATS.some(([w, h]) => w === width && h === height)) throw new Error(`LitStage.define: size must be 1920x1080 or 1080x1920 (got ${width}x${height})`);
    if (fps !== 60 && fps !== 30) throw new Error(`LitStage.define: fps must be 60 or 30 (got ${fps})`);
    if (!(Number.isFinite(duration) && duration > 0)) throw new Error("LitStage.define: duration must be a positive number of seconds");
    if (typeof render !== "function") throw new Error("LitStage.define: render(t) must be a function");
    const frozen = Object.freeze({ width, height, fps, duration, render });
    root.litStage = frozen;
    return frozen;
  }

  root.LitStage = Object.freeze({
    define, text,
    ease, cubicBezier, spring, kf, stagger, seq, at, rand,
    splitText, drawPath, morph,
    clipRect, clipCircle, maskLinear, wipe,
    mix, rgba,
    clamp, lerp, invLerp, remap, smoothstep,
  });
})(typeof window !== "undefined" ? window : globalThis);
