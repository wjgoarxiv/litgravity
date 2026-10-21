// Stage text-QA collector: evaluated only in the QA replay Chrome, never in the master. It reads the
// page's text runs (DOM text grouped by the nearest text()-marked ancestor, else the nearest block
// ancestor; ::before/::after content; registered canvas text) with their on-screen rects, opacity
// chain and size, and switches the one "ink" rule that hides text colour for the A/B ink capture.
(() => {
  "use strict";
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TITLE", "HEAD"]);
  const INLINE = /^(?:inline|inline-block|inline-flex|inline-grid|contents|ruby|ruby-text)$/u;
  const W = () => document.documentElement.clientWidth || window.innerWidth;
  const H = () => document.documentElement.clientHeight || window.innerHeight;
  let nextRun = 1;
  const runIds = new WeakMap();

  const containerOf = (node) => {
    const marked = node.parentElement?.closest("[data-lit-text]");
    if (marked) return marked;
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (el instanceof SVGElement) {
        if (el.localName === "text") return el;
        continue;
      }
      if (!INLINE.test(getComputedStyle(el).display)) return el;
    }
    return document.body;
  };

  const opacityChain = (el) => {
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || cs.visibility === "collapse" || cs.display === "none") return 0;
      o *= Number.parseFloat(cs.opacity);
    }
    return o;
  };

  const clipFor = (el) => {
    let box = [0, 0, W(), H()];
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (/(hidden|clip|auto|scroll)/u.test(cs.overflow + cs.overflowX + cs.overflowY) || (cs.clipPath && cs.clipPath !== "none")) {
        const r = e.getBoundingClientRect();
        box = [Math.max(box[0], r.left), Math.max(box[1], r.top), Math.min(box[2], r.right), Math.min(box[3], r.bottom)];
      }
    }
    return box;
  };
  const intersect = (r, c) => {
    const x = [Math.max(r[0], c[0]), Math.max(r[1], c[1]), Math.min(r[2], c[2]), Math.min(r[3], c[3])];
    return x[2] > x[0] && x[3] > x[1] ? x : null;
  };

  const scaleOf = (el) => {
    if (el instanceof SVGGraphicsElement) {
      const m = el.getScreenCTM();
      return m ? Math.hypot(m.a, m.b) : 1;
    }
    const rect = el.getBoundingClientRect();
    return el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1;
  };

  function runs() {
    const groups = new Map();
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.data.trim()) continue;
      if (node.parentElement && SKIP.has(node.parentElement.tagName)) continue;
      const c = containerOf(node);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(node);
    }
    const out = [];
    const add = (el, text, kind, rawRects, nodes = []) => {
      if (!runIds.has(el)) runIds.set(el, nextRun++);
      const id = runIds.get(el);
      el.setAttribute("data-lit-run", String(id));
      const clip = clipFor(el);
      const rects = rawRects.map((r) => intersect(r, clip)).filter(Boolean);
      const cs = getComputedStyle(el);
      const fontSizePx = Number.parseFloat(cs.fontSize) || 0;
      const scale = scaleOf(el);
      out.push({
        id, kind, text: text.replace(/\s+/gu, " ").trim(), decor: Boolean(el.closest("[data-lit-decor]")),
        // A run is as visible as its most visible text: per-word opacity lives on the children.
        rects, opacity: +(nodes.length ? Math.max(...nodes.map((n) => opacityChain(n.parentElement))) : opacityChain(el)).toFixed(3), fontSizePx: +(fontSizePx * scale).toFixed(2), capHeightPx: +(fontSizePx * scale).toFixed(2),
        gradient: /text/u.test(cs.backgroundClip + (cs.webkitBackgroundClip ?? "")),
      });
    };
    for (const [el, nodes] of groups) {
      const rects = [];
      for (const n of nodes) {
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rects.push([r.left, r.top, r.right, r.bottom]);
      }
      add(el, nodes.map((n) => n.data).join(el.hasAttribute("data-lit-text") ? "" : " "), "dom", rects, nodes);
    }
    for (const el of document.querySelectorAll("body *")) {
      for (const pseudo of ["::before", "::after"]) {
        const content = getComputedStyle(el, pseudo).content;
        if (!content || content === "none" || content === "normal") continue;
        const text = content.replace(/^["']|["']$/gu, "").trim();
        if (!text || /^(?:counter|attr|url)\(/u.test(content)) continue;
        const r = el.getBoundingClientRect();
        add(el, text, "pseudo", r.width > 0 && r.height > 0 ? [[r.left, r.top, r.right, r.bottom]] : []);
      }
    }
    for (const t of window.__litStageTexts ?? []) {
      const rect = [t.x, t.y, t.x + t.w, t.y + t.h];
      const on = intersect(rect, [0, 0, W(), H()]);
      out.push({ id: `canvas:${String(t.content).slice(0, 40)}`, kind: "canvas", text: String(t.content).replace(/\s+/gu, " ").trim(), decor: Boolean(t.decor), rects: on ? [on] : [], opacity: 1, fontSizePx: t.h, capHeightPx: t.h, gradient: false });
    }
    return out;
  }

  // ---- the ink rule (A/B capture) ----
  const RULE = [
    "[data-lit-ink]{color:transparent!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke-color:transparent!important;text-decoration-color:transparent!important;text-emphasis-color:transparent!important}",
    "[data-lit-ink]::before,[data-lit-ink]::after{color:transparent!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke-color:transparent!important}",
    "text[data-lit-ink],tspan[data-lit-ink],textPath[data-lit-ink]{fill:transparent!important;stroke:transparent!important}",
    "[data-lit-bgclip]{background-image:none!important}",
  ].join("\n");
  let style = null;
  let before = new Set();
  function ink(on) {
    if (on) {
      before = new Set(document.getAnimations());
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.data.trim() && node.parentElement && !SKIP.has(node.parentElement.tagName)) node.parentElement.setAttribute("data-lit-ink", "");
      }
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (/text/u.test(cs.backgroundClip + (cs.webkitBackgroundClip ?? ""))) el.setAttribute("data-lit-bgclip", "");
        for (const pseudo of ["::before", "::after"]) {
          const content = getComputedStyle(el, pseudo).content;
          if (content && content !== "none" && content !== "normal") el.setAttribute("data-lit-ink", "");
        }
      }
      style = document.createElement("style");
      style.textContent = RULE;
      document.head.appendChild(style);
    } else {
      style?.remove();
      style = null;
      for (const el of document.querySelectorAll("[data-lit-ink],[data-lit-bgclip]")) {
        el.removeAttribute("data-lit-ink");
        el.removeAttribute("data-lit-bgclip");
      }
    }
    getComputedStyle(document.documentElement).opacity;
    for (const a of document.getAnimations()) if (!before.has(a)) a.cancel();
    return window.__litPaint();
  }

  Object.defineProperty(window, "__litQa", { value: { runs, ink }, configurable: false });
})();
