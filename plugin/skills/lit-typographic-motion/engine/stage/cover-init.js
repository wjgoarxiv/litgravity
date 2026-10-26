// Cover init script: evaluated by the cover renderer before any page script. A cover page is a pure
// function of loop time t, and the renderer seeks frames in any order, so every clock and every
// unseeded entropy source the page could read throws instead of answering (Math.random answers from a
// fixed seed only while the page builds, before window.ready). Each call is recorded by
// name, so the renderer can name it (exit 18) even when the page swallowed the error. CSS
// animations and transitions would run on the real clock, so they are frozen off.
(() => {
  "use strict";
  const misuse = [];
  const forbid = (name, fix) => function forbidden() {
    if (!misuse.includes(name)) misuse.push(name);
    throw new Error(`${name} is forbidden in a cover page; ${fix}`);
  };
  // Building a scene before window.ready may draw ids from Math.random (three.js names every object it
  // makes): that phase gets a fixed-seed sequence, the same in every browser. Once the page is ready,
  // frames are drawn in any order, so a call then is misuse.
  const forbiddenRandom = forbid("Math.random", "use LitLoop.rng(seed) for layout and t for motion");
  let seed = 0x9e3779b9;
  Math.random = function random() {
    if (window.ready === true) return forbiddenRandom();
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const RealDate = Date;
  const dateFix = "draw every frame from t";
  function CoverDate(...args) {
    if (!new.target || !args.length) return forbid("Date", dateFix)();
    return new RealDate(...args);
  }
  CoverDate.prototype = RealDate.prototype;
  CoverDate.now = forbid("Date.now", dateFix);
  CoverDate.parse = RealDate.parse;
  CoverDate.UTC = RealDate.UTC;
  Object.defineProperty(window, "Date", { value: CoverDate, configurable: true, writable: true });
  Object.defineProperty(Performance.prototype, "now", { value: forbid("performance.now", dateFix), configurable: true, writable: true });
  window.requestAnimationFrame = forbid("requestAnimationFrame", "the renderer calls renderFrame(t); never run your own loop");
  window.setInterval = forbid("setInterval", "the renderer calls renderFrame(t); never run your own loop");
  if (window.crypto) Object.defineProperty(window.crypto, "getRandomValues", { value: forbid("crypto.getRandomValues", "use LitLoop.rng(seed)"), configurable: true });
  const freeze = () => {
    const style = document.createElement("style");
    style.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; }";
    (document.head || document.documentElement).appendChild(style);
  };
  if (document.documentElement) freeze();
  else document.addEventListener("readystatechange", freeze, { once: true });
  window.__litCoverMisuse = () => misuse.slice();
})();
