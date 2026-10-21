// Cover init script: evaluated by the cover renderer before any page script. A cover page is a pure
// function of loop time t, and the renderer seeks frames in any order, so every clock and every
// unseeded entropy source the page could read throws instead of answering. Each call is recorded by
// name, so the renderer can name it (exit 18) even when the page swallowed the error. CSS
// animations and transitions would run on the real clock, so they are frozen off.
(() => {
  "use strict";
  const misuse = [];
  const forbid = (name, fix) => function forbidden() {
    if (!misuse.includes(name)) misuse.push(name);
    throw new Error(`${name} is forbidden in a cover page; ${fix}`);
  };
  Math.random = forbid("Math.random", "use LitLoop.rng(seed) for layout and t for motion");
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
