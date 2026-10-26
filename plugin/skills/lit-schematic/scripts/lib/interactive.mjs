// One self-contained HTML page for an isometric cutaway: preset views, an exploded view, layer
// toggles and callouts that light their part on hover or keyboard focus. Nothing is fetched:
// the drawings, styles and script are inline, so the file works offline and from email.
//
// Input is the static art the kit already drew, one SVG per preset view, each carrying the
// markers the kit writes: data-group on assemblies, data-part/data-hull on parts, data-leader,
// data-leader-dot, data-for-leader and data-target on callouts. Explode vectors are screen
// offsets per view (view.screenVector of the world move), so the page needs no geometry.
//
// State can be set from the URL hash for checks and screenshots:
//   #view=<id>&explode=1&hide=<group>,<group>&select=<callout id>

import { esc } from "./svg.mjs";

const CSS = `
:root{--paper:#ffffff;--ink:#1d1d20;--muted:#5d5d64;--line:#d9d9de;--accent:#0072b2;--accent-soft:rgba(0,114,178,.14);--focus:#0072b2;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.45 Arial,Helvetica,"Apple SD Gothic Neo","Noto Sans KR",Pretendard,sans-serif}
main{max-width:1180px;margin:0 auto;padding:20px 16px 28px}
h1{font-size:22px;margin:0 0 4px}
.lede{margin:0 0 14px;color:var(--muted);max-width:72ch}
.bar{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin:0 0 10px;padding:10px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.group{display:flex;flex-wrap:wrap;gap:6px;align-items:center;border:0;margin:0;padding:0}
.group>span,.group legend{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-right:4px;padding:0;float:left}
button{font:inherit;font-size:14px;padding:6px 12px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink);cursor:pointer}
button[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:#fff}
label.toggle{display:inline-flex;gap:6px;align-items:center;font-size:14px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;cursor:pointer}
button:focus-visible,label.toggle:focus-within,[data-for-leader]:focus-visible{outline:2px solid var(--focus);outline-offset:3px}
.stage{position:relative}
.stage svg{display:block;width:100%;height:auto;max-height:max(360px, calc(100vh - 200px))}
.stage .view[hidden]{display:none}
[data-for-leader]{cursor:pointer}
[data-for-leader].on{font-weight:bold;fill:var(--accent)}
path[data-leader].on{stroke:var(--accent);stroke-width:.32}
circle[data-leader-dot].on{fill:var(--accent)}
.hl{fill:var(--accent-soft);stroke:var(--accent);stroke-width:.45;pointer-events:none}
.stage.exploded [data-leader],.stage.exploded [data-leader-dot]{opacity:.55}
.hint{margin:10px 0 0;font-size:13px;color:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:640px){h1{font-size:19px}button{padding:6px 9px}}
`;

// The page script: plain DOM, one animation loop that stops when nothing moves.
const SCRIPT = `
(() => {
  const data = JSON.parse(document.getElementById("lit-data").textContent);
  const stage = document.querySelector(".stage");
  const live = document.getElementById("live");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const state = { view: data.views[0].id, explode: 0, hidden: new Set(), select: null };
  const progress = Object.fromEntries(data.order.map((g) => [g, 0]));
  const target = Object.fromEntries(data.order.map((g) => [g, 0]));
  const starts = {};
  let frame = 0;

  const svgOf = (id) => stage.querySelector('.view[data-view="' + id + '"] svg');
  const active = () => svgOf(state.view);
  const viewData = (id) => data.views.find((v) => v.id === id);
  const say = (text) => { live.textContent = text; };

  // Original leader ends, so an exploded part keeps its dot.
  for (const view of data.views) {
    const svg = svgOf(view.id);
    for (const path of svg.querySelectorAll("path[data-leader]")) path.dataset.d0 = path.getAttribute("d");
    for (const dot of svg.querySelectorAll("circle[data-leader-dot]")) { dot.dataset.cx0 = dot.getAttribute("cx"); dot.dataset.cy0 = dot.getAttribute("cy"); }
    for (const label of svg.querySelectorAll("[data-for-leader]")) {
      label.setAttribute("tabindex", "0");
      label.setAttribute("role", "button");
      label.setAttribute("aria-pressed", "false");
    }
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const offsetOf = (node, view) => {
    let dx = 0, dy = 0;
    for (let n = node; n && n.tagName !== "svg"; n = n.parentNode) {
      const g = n.getAttribute && n.getAttribute("data-group");
      const v = g && viewData(view).explode[g];
      if (v) { dx += v[0] * progress[g]; dy += v[1] * progress[g]; }
    }
    return [dx, dy];
  };

  function place(view) {
    const svg = svgOf(view);
    const vd = viewData(view);
    for (const node of svg.querySelectorAll("[data-group]")) {
      const g = node.getAttribute("data-group");
      const v = vd.explode[g];
      const p = progress[g] || 0;
      if (v && p > 0) node.setAttribute("transform", "translate(" + (v[0] * p).toFixed(3) + " " + (v[1] * p).toFixed(3) + ")");
      else node.removeAttribute("transform");
      // visibility, not display: an assembly nested in a hidden one (a bundle inside its shell) stays.
      node.style.visibility = state.hidden.has(g) ? "hidden" : "visible";
    }
    for (const path of svg.querySelectorAll("path[data-leader]")) {
      const id = path.getAttribute("data-leader");
      const part = svg.querySelector('[data-part="' + CSS.escape(path.getAttribute("data-target") || "") + '"]');
      const [dx, dy] = part ? offsetOf(part, view) : [0, 0];
      const pts = path.dataset.d0.match(/-?[\\d.]+/g).map(Number);
      pts[pts.length - 2] += dx; pts[pts.length - 1] += dy;
      path.setAttribute("d", "M" + pts[0] + " " + pts[1] + pts.slice(2).reduce((s, v, i) => s + (i % 2 ? " " + v : "L" + v), ""));
      const dot = svg.querySelector('circle[data-leader-dot="' + id + '"]');
      dot.setAttribute("cx", (Number(dot.dataset.cx0) + dx).toFixed(3));
      dot.setAttribute("cy", (Number(dot.dataset.cy0) + dy).toFixed(3));
      const hiddenPart = part && part.closest("[data-group]") && [...state.hidden].some((g) => part.closest('[data-group="' + g + '"]'));
      for (const el of [path, dot, svg.querySelector('[data-for-leader="' + id + '"]')]) el.style.display = hiddenPart ? "none" : "";
    }
    highlight(view);
  }

  function highlight(view) {
    const svg = svgOf(view);
    svg.querySelectorAll(".hl").forEach((n) => n.remove());
    svg.querySelectorAll(".on").forEach((n) => n.classList.remove("on"));
    svg.querySelectorAll("[data-for-leader]").forEach((n) => n.setAttribute("aria-pressed", "false"));
    if (!state.select) return;
    const label = svg.querySelector('[data-for-leader="' + state.select + '"]');
    if (!label) return;
    const path = svg.querySelector('path[data-leader="' + state.select + '"]');
    const part = svg.querySelector('[data-part="' + CSS.escape(path.getAttribute("data-target") || "") + '"]');
    [label, path, svg.querySelector('circle[data-leader-dot="' + state.select + '"]')].forEach((n) => n.classList.add("on"));
    label.setAttribute("aria-pressed", "true");
    if (part && part.dataset.hull) {
      const [dx, dy] = offsetOf(part, view);
      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      poly.setAttribute("class", "hl");
      poly.setAttribute("points", part.dataset.hull.split(" ").map((p) => p.split(",").map(Number)).map(([x, y]) => (x + dx).toFixed(2) + "," + (y + dy).toFixed(2)).join(" "));
      svg.querySelector("[data-callouts]").before(poly);
    }
  }

  function tick(now) {
    let moving = false;
    for (const g of data.order) {
      const s = starts[g];
      if (!s) continue;
      const t = Math.min(1, Math.max(0, (now - s.at) / data.duration));
      progress[g] = s.from + (target[g] - s.from) * ease(t);
      if (t < 1) moving = true; else delete starts[g];
    }
    place(state.view);
    frame = moving ? requestAnimationFrame(tick) : 0;
  }

  function setExplode(on, announce = true) {
    state.explode = on ? 1 : 0;
    stage.classList.toggle("exploded", !!on);
    document.getElementById("explode").setAttribute("aria-pressed", String(!!on));
    // Outside parts leave first and come home last.
    const order = on ? data.order : [...data.order].reverse();
    const now = performance.now();
    order.forEach((g, i) => {
      target[g] = on ? 1 : 0;
      if (still.matches) { progress[g] = target[g]; delete starts[g]; }
      else starts[g] = { from: progress[g], at: now + i * data.stagger };
    });
    if (still.matches) place(state.view);
    else if (!frame) frame = requestAnimationFrame(tick);
    if (announce) say(on ? data.text.exploded : data.text.assembled);
  }

  function setView(id, announce = true) {
    state.view = id;
    for (const node of stage.querySelectorAll(".view")) node.hidden = node.dataset.view !== id;
    for (const b of document.querySelectorAll("[data-view-button]")) b.setAttribute("aria-pressed", String(b.dataset.viewButton === id));
    place(id);
    if (announce) say(viewData(id).label);
  }

  function select(id, announce = true) {
    state.select = state.select === id ? null : id;
    highlight(state.view);
    if (announce && state.select) say(active().querySelector('[data-for-leader="' + state.select + '"]').textContent);
  }

  document.querySelectorAll("[data-view-button]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.viewButton)));
  document.getElementById("explode").addEventListener("click", () => setExplode(!state.explode));
  document.querySelectorAll("[data-layer]").forEach((box) => box.addEventListener("change", () => {
    if (box.checked) state.hidden.delete(box.dataset.layer); else state.hidden.add(box.dataset.layer);
    place(state.view);
    say((box.checked ? data.text.shown : data.text.hidden) + " " + box.dataset.label);
  }));
  stage.addEventListener("click", (e) => {
    const label = e.target.closest("[data-for-leader]");
    if (label) { select(label.getAttribute("data-for-leader")); return; }
    const part = e.target.closest("[data-part]");
    const id = part && partCallout(part);
    if (id) select(id);
  });
  stage.addEventListener("keydown", (e) => {
    const label = e.target.closest && e.target.closest("[data-for-leader]");
    if (label && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(label.getAttribute("data-for-leader")); }
  });
  stage.addEventListener("focusin", (e) => {
    const label = e.target.closest && e.target.closest("[data-for-leader]");
    if (label && state.select !== label.getAttribute("data-for-leader")) select(label.getAttribute("data-for-leader"));
  });
  // Hover previews a part's callout without changing the selection the keyboard made.
  let hoverFrom = null;
  stage.addEventListener("pointermove", (e) => {
    const label = e.target.closest("[data-for-leader]");
    const part = !label && e.target.closest("[data-part]");
    const id = label ? label.getAttribute("data-for-leader") : part ? partCallout(part) : null;
    if (id && id !== state.select) { if (hoverFrom === null) hoverFrom = state.select; state.select = id; highlight(state.view); }
    if (!id && hoverFrom !== null) { state.select = hoverFrom; hoverFrom = null; highlight(state.view); }
  });
  stage.addEventListener("pointerleave", () => { if (hoverFrom !== null) { state.select = hoverFrom; hoverFrom = null; highlight(state.view); } });
  document.addEventListener("keydown", (e) => {
    // A held key repeats; a toggle should flip once per press.
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest("input,button")) { if (e.key !== "Escape") return; }
    if (e.key === "Escape") { state.select = null; highlight(state.view); }
    if (e.key === "e" || e.key === "E") setExplode(!state.explode);
    const n = Number(e.key);
    if (n >= 1 && n <= data.views.length) setView(data.views[n - 1].id);
  });
  function partCallout(part) {
    for (let n = part; n && n.tagName !== "svg"; n = n.parentNode) {
      const name = n.getAttribute && n.getAttribute("data-part");
      if (!name) continue;
      const path = active().querySelector('path[data-leader][data-target="' + CSS.escape(name) + '"]');
      if (path) return path.getAttribute("data-leader");
    }
    return null;
  }

  // Initial state, optionally from the hash.
  const hash = new URLSearchParams(location.hash.slice(1));
  for (const g of (hash.get("hide") || "").split(",").filter(Boolean)) {
    state.hidden.add(g);
    const box = document.querySelector('[data-layer="' + g + '"]');
    if (box) box.checked = false;
  }
  setView(viewData(hash.get("view")) ? hash.get("view") : state.view, false);
  if (hash.get("explode") === "1") { for (const g of data.order) { progress[g] = 1; target[g] = 1; } state.explode = 1; stage.classList.add("exploded"); document.getElementById("explode").setAttribute("aria-pressed", "true"); }
  if (hash.get("select")) state.select = hash.get("select");
  place(state.view);
  document.documentElement.dataset.ready = "1";
})();
`;

export function renderInteractive({
  title, description = "", lang = "en", views, layers = [], order = null,
  duration = 700, stagger = 90, hint = null,
  text = {},
} = {}) {
  if (!title) throw new Error("renderInteractive: title is required");
  if (!views?.length) throw new Error("renderInteractive: give at least one view { id, label, svg, explode }");
  const groups = order ?? [...new Set(views.flatMap((v) => Object.keys(v.explode ?? {})))];
  const words = {
    views: "View", layers: "Layers", explode: "Exploded view", exploded: "Exploded view", assembled: "Assembled",
    shown: "Showing", hidden: "Hiding",
    hint: "Hover or Tab to a label to light its part. E explodes, 1 to " + views.length + " switch views, Esc clears.",
    ...text,
  };
  const data = {
    views: views.map((v) => ({ id: v.id, label: v.label, explode: v.explode ?? {} })),
    order: groups, duration, stagger,
    text: { exploded: words.exploded, assembled: words.assembled, shown: words.shown, hidden: words.hidden },
  };
  const stripProlog = (svg) => svg.replace(/^\s*<\?xml[^>]*>\s*/u, "");
  const viewButtons = views.map((v, i) => `<button type="button" data-view-button="${esc(v.id)}" aria-pressed="${i === 0}" aria-keyshortcuts="${i + 1}">${esc(v.label)}</button>`).join("");
  const layerBoxes = layers.map((l) => `<label class="toggle"><input type="checkbox" checked data-layer="${esc(l.group)}" data-label="${esc(l.label)}">${esc(l.label)}</label>`).join("");
  const stages = views.map((v, i) => `<div class="view" data-view="${esc(v.id)}"${i ? " hidden" : ""}>${stripProlog(v.svg)}</div>`).join("");
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
${description ? `<p class="lede">${esc(description)}</p>` : ""}
<div class="bar">
<div class="group" role="group" aria-label="${esc(words.views)}"><span aria-hidden="true">${esc(words.views)}</span>${viewButtons}</div>
<button type="button" id="explode" aria-pressed="false" aria-keyshortcuts="E">${esc(words.explode)}</button>
${layers.length ? `<fieldset class="group"><legend>${esc(words.layers)}</legend>${layerBoxes}</fieldset>` : ""}
</div>
<div class="stage">${stages}</div>
<p class="hint">${esc(hint ?? words.hint)}</p>
<p id="live" class="sr" aria-live="polite"></p>
</main>
<script type="application/json" id="lit-data">${JSON.stringify(data).replace(/</gu, "\\u003c")}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
