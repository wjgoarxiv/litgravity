// Stage init script: evaluated by the renderer before any page script (Page.addScriptToEvaluateOnNewDocument).
// It replaces every clock the page can read with one virtual clock the renderer steps frame by frame,
// seeds Math.random from the treatment, stubs the APIs a stage page may not use (recording each use),
// and exposes the per-frame step as window.__litStep. The renderer substitutes __LIT_SEED__.
(() => {
  "use strict";
  const SEED = __LIT_SEED__;
  const EPOCH_MS = 1767225600000; // 2026-01-01T00:00:00Z: a fixed wall clock for Date
  const V = { ms: 0 };
  const violations = [];
  const errors = [];
  const record = (kind, name) => {
    if (!violations.some((v) => v.kind === kind && v.name === name)) violations.push({ kind, name, atMs: V.ms });
  };

  // ---- the native frame source, kept before the page can replace it ----
  const nativeRaf = window.requestAnimationFrame.bind(window);

  // ---- Date and performance.now ----
  const RealDate = Date;
  function VDate(...args) {
    if (!new.target) return new RealDate(EPOCH_MS + V.ms).toString();
    return args.length ? new RealDate(...args) : new RealDate(EPOCH_MS + V.ms);
  }
  VDate.prototype = RealDate.prototype;
  VDate.now = () => EPOCH_MS + V.ms;
  VDate.parse = RealDate.parse;
  VDate.UTC = RealDate.UTC;
  Object.defineProperty(window, "Date", { value: VDate, configurable: true, writable: true });
  Object.defineProperty(Performance.prototype, "now", { value: function now() { return V.ms; }, configurable: true, writable: true });
  try {
    Object.defineProperty(AnimationTimeline.prototype, "currentTime", { get() { return V.ms; }, configurable: true });
  } catch (error) {
    errors.push(`timeline: ${error.message}`);
  }

  // ---- Math.random, seeded (mulberry32) ----
  let state = SEED >>> 0;
  Math.random = function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---- timers, rAF and idle callbacks on the virtual clock ----
  let nextId = 1;
  const timers = new Map();
  const rafs = new Map();
  const idles = new Map();
  const toFn = (fn) => (typeof fn === "function" ? fn : () => (0, eval)(String(fn)));
  window.setTimeout = (fn, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { due: V.ms + Math.max(0, Number(ms) || 0), fn: toFn(fn), args, every: null, seq: id });
    return id;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(ms) || 0);
    timers.set(id, { due: V.ms + every, fn: toFn(fn), args, every, seq: id });
    return id;
  };
  window.clearTimeout = (id) => { timers.delete(id); };
  window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (cb) => {
    const id = nextId++;
    rafs.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => { rafs.delete(id); };
  window.requestIdleCallback = (cb) => {
    const id = nextId++;
    idles.set(id, cb);
    return id;
  };
  window.cancelIdleCallback = (id) => { idles.delete(id); };

  const guard = (fn, ...args) => {
    try {
      fn(...args);
    } catch (error) {
      errors.push(String(error && error.stack ? error.stack : error).slice(0, 400));
    }
  };
  function runTimers() {
    for (let guardCount = 0; guardCount < 100000; guardCount++) {
      let next = null;
      for (const [id, t] of timers) if (t.due <= V.ms && (!next || t.due < next[1].due || (t.due === next[1].due && t.seq < next[1].seq))) next = [id, t];
      if (!next) return;
      const [id, t] = next;
      if (t.every) t.due += t.every;
      else timers.delete(id);
      guard(t.fn, ...t.args);
    }
  }
  function runRafs() {
    const due = [...rafs.values()];
    rafs.clear();
    for (const cb of due) guard(cb, V.ms);
    const idle = [...idles.values()];
    idles.clear();
    for (const cb of idle) guard(cb, { didTimeout: false, timeRemaining: () => 0 });
  }

  // ---- forbidden APIs: stubbed, and every use recorded ----
  const forbid = (name, kind) => {
    const stub = function () {
      record(kind, name);
      throw new Error(`lit stage: ${name} is not allowed on a stage page`);
    };
    try {
      Object.defineProperty(window, name, { value: stub, configurable: true, writable: true });
    } catch (error) {
      errors.push(`stub ${name}: ${error.message}`);
    }
  };
  for (const name of ["Audio", "AudioContext", "webkitAudioContext", "OfflineAudioContext", "Worker", "SharedWorker"]) forbid(name, "api");
  for (const name of ["WebSocket", "WebTransport", "RTCPeerConnection", "webkitRTCPeerConnection"]) forbid(name, "network");
  try {
    if (navigator.serviceWorker) {
      Object.defineProperty(navigator.serviceWorker, "register", { value: () => { record("api", "serviceWorker"); return Promise.reject(new Error("lit stage: service workers are not allowed")); }, configurable: true });
    }
  } catch (error) {
    errors.push(`stub serviceWorker: ${error.message}`);
  }
  const FORBIDDEN_TAGS = new Set(["video", "audio", "iframe", "object", "embed", "frame"]);
  const createElement = Document.prototype.createElement;
  Document.prototype.createElement = function (tag, ...rest) {
    if (FORBIDDEN_TAGS.has(String(tag).toLowerCase())) record("element", `<${String(tag).toLowerCase()}>`);
    return createElement.call(this, tag, ...rest);
  };
  const createElementNS = Document.prototype.createElementNS;
  Document.prototype.createElementNS = function (ns, tag, ...rest) {
    const local = String(tag).split(":").pop().toLowerCase();
    if (FORBIDDEN_TAGS.has(local)) record("element", `<${local}>`);
    return createElementNS.call(this, ns, tag, ...rest);
  };
  const scanNode = (node) => {
    if (node.nodeType !== 1) return;
    const tag = node.localName;
    if (FORBIDDEN_TAGS.has(tag)) record("element", `<${tag}>`);
    for (const el of node.querySelectorAll?.("video,audio,iframe,object,embed,frame") ?? []) record("element", `<${el.localName}>`);
  };
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) scanNode(n);
  }).observe(document, { childList: true, subtree: true });

  // ---- WebGL use (exit 11 only when the page asks for it and gets nothing) and canvas text ----
  let usesWebGL = false;
  let webglMissing = false;
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = getContext.call(this, type, ...rest);
    if (/^(?:webgl2?|experimental-webgl)$/u.test(String(type))) {
      usesWebGL = true;
      if (!ctx) webglMissing = true;
    }
    return ctx;
  };
  let canvasTextCalls = 0;
  for (const method of ["fillText", "strokeText"]) {
    const original = CanvasRenderingContext2D.prototype[method];
    CanvasRenderingContext2D.prototype[method] = function (...args) {
      canvasTextCalls += 1;
      return original.apply(this, args);
    };
  }
  window.addEventListener("error", (e) => errors.push(String(e.message).slice(0, 400)));
  window.addEventListener("unhandledrejection", (e) => errors.push(`unhandled rejection: ${String(e.reason).slice(0, 400)}`));

  // ---- animations: every one tracked with the virtual time it was first seen ----
  const born = new Map();
  const finished = new Set();
  const svgBorn = new Map();
  const drainMicrotasks = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const flushStyle = () => {
    getComputedStyle(document.documentElement).getPropertyValue("opacity");
    return document.documentElement.getBoundingClientRect();
  };
  const pendingDecodes = new Set();
  const decoded = new WeakSet();
  const decodeImages = () => {
    for (const img of document.images) {
      if (decoded.has(img)) continue;
      decoded.add(img);
      img.loading = "eager";
      const p = img.decode().catch(() => {}).finally(() => pendingDecodes.delete(p));
      pendingDecodes.add(p);
    }
  };

  /**
   * One frame at t = f / fps (computed from f, never accumulated). `paint` false skips the two native
   * frames: the page's state still advances, but nothing is captured from this step.
   */
  async function step(f, fps, { paint: paintFrame = true } = {}) {
    V.ms = (f / fps) * 1000;
    const t = V.ms / 1000;
    window.__litStageTexts = [];
    canvasTextCalls = 0;
    for (const [a, birth] of born) {
      if (a.playState === "idle") {
        born.delete(a);
        continue;
      }
      if (finished.has(a)) continue;
      const local = (t - birth) * 1000;
      const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      if (Number.isFinite(end) && local >= end) {
        finished.add(a);
        try {
          a.finish();
        } catch (error) {
          errors.push(`finish: ${error.message}`);
        }
        await drainMicrotasks();
      } else a.currentTime = local;
    }
    for (const svg of document.querySelectorAll("svg")) {
      if (svg.ownerSVGElement) continue;
      if (!svgBorn.has(svg)) {
        svgBorn.set(svg, t);
        svg.pauseAnimations();
      }
      svg.setCurrentTime(t - svgBorn.get(svg));
    }
    runTimers();
    runRafs();
    const spec = window.litStage;
    if (spec && typeof spec.render === "function") guard(spec.render, t);
    await drainMicrotasks();
    flushStyle();
    for (const a of document.getAnimations()) {
      if (born.has(a)) continue;
      a.pause();
      born.set(a, t);
      a.currentTime = 0;
    }
    decodeImages();
    document.body?.offsetHeight;
    await document.fonts.ready;
    if (pendingDecodes.size) await Promise.all([...pendingDecodes]);
    if (paintFrame) await new Promise((resolve) => nativeRaf(() => nativeRaf(resolve)));
    return { t, violations: violations.length, errors: errors.length, canvasTextCalls, texts: window.__litStageTexts.length };
  }

  /** Before frame 0: load every served face, decode every stage raster, make every img eager. */
  async function prepare({ faces = [], images = [] } = {}) {
    const failedFaces = [];
    for (const face of faces) {
      try {
        const loaded = await document.fonts.load(face.descriptor, face.sample || "Aa가");
        if (!loaded.length) failedFaces.push(face.descriptor);
      } catch {
        failedFaces.push(face.descriptor);
      }
    }
    const failedImages = [];
    for (const src of images) {
      const img = new Image();
      img.src = src;
      try {
        await img.decode();
      } catch {
        failedImages.push(src);
      }
    }
    for (const img of document.images) img.loading = "eager";
    decodeImages();
    if (pendingDecodes.size) await Promise.all([...pendingDecodes]);
    await document.fonts.ready;
    return { failedFaces, failedImages };
  }

  const paint = () => new Promise((resolve) => nativeRaf(() => nativeRaf(() => resolve(true))));

  Object.defineProperty(window, "__litPaint", { value: paint, configurable: false, writable: false });
  Object.defineProperty(window, "__litPrepare", { value: prepare, configurable: false, writable: false });
  Object.defineProperty(window, "__litStep", { value: step, configurable: false, writable: false });
  Object.defineProperty(window, "__litStageState", {
    value: () => ({ violations: violations.slice(), errors: errors.slice(0, 20), usesWebGL, webglMissing, spec: window.litStage ? { width: window.litStage.width, height: window.litStage.height, fps: window.litStage.fps, duration: window.litStage.duration, render: typeof window.litStage.render } : null }),
    configurable: false,
    writable: false,
  });
})();
