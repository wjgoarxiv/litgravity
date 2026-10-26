// Journal figure pages: an exact column width in millimetres, panels with (a), (b) labels at
// their top left, a key of stream colours, and the same mm user space as every other kit
// drawing so the QA gate reads sizes at print scale.

import { createCanvas } from "./sheet.mjs";
import { el, esc, n, pathOf, ptToMm, svgDocument } from "./svg.mjs";
import { JOURNAL, STREAM, fontFor } from "./theme.mjs";

export const WIDTHS = JOURNAL.width;

export function createFigure({ width = "double", height, title, desc = "", lang = "en", mode = "journal", labelStyle = "paren", textPt = JOURNAL.textPt } = {}) {
  const w = typeof width === "number" ? width : WIDTHS[width];
  if (!w) throw new Error(`createFigure: width must be a number of mm or one of ${Object.keys(WIDTHS).join(", ")}`);
  if (!height) throw new Error("createFigure: height in mm is required");
  if (height > JOURNAL.maxHeight) throw new Error(`createFigure: ${height} mm is taller than a journal page allows (${JOURNAL.maxHeight} mm)`);
  const panels = [];
  const layers = [];
  const text = ptToMm(textPt);
  const panelText = ptToMm(JOURNAL.panelPt);

  function panel(label, [x, y, pw, ph]) {
    const box = [x, y, x + pw, y + ph];
    const inner = label === null ? box : [x, y + panelText + 1.6, x + pw, y + ph];
    const entry = { label, box, inner, body: [] };
    panels.push(entry);
    return {
      box,
      inner,
      label,
      canvas: (options = {}) => {
        const c = createCanvas({ box: options.box ?? inner, style: "journal", ...options });
        entry.body.push(() => c.render());
        entry.canvas = c;
        return c;
      },
      iso: (view, { box: target = inner, labelColumn = null, calloutSize = text } = {}) => {
        const fitted = view.fit(target, { labelColumn, size: calloutSize });
        entry.view = view;
        entry.body.push(() => view.render() + view.renderCallouts({ box: target, size: calloutSize }));
        return fitted;
      },
      text: (tx, ty, content, { size = text, anchor = "start", bold = false, color = "#000000", kind = "note" } = {}) => {
        entry.body.push(() => el("text", { x: tx, y: ty, "font-family": fontFor(content), "font-size": size, "text-anchor": anchor, "font-weight": bold ? "bold" : undefined, fill: color, "data-label": kind }, esc(content)));
      },
      raw: (svg) => entry.body.push(() => svg),
    };
  }

  // A key of stream roles: a short line swatch and its name, one row each.
  function key(roles, [x, y], { columns = 1, colWidth = 34, rowHeight = text + 1.6 } = {}) {
    const rows = roles.map((role, i) => {
      const spec = STREAM[role];
      if (!spec) throw new Error(`key: unknown stream role ${role}`);
      const cx = x + (i % columns) * colWidth;
      const cy = y + Math.floor(i / columns) * rowHeight;
      return el("g", { "data-legend-item": `role:${role}` },
        el("path", { d: pathOf([[cx, cy - text * 0.3], [cx + 7, cy - text * 0.3]]), stroke: spec.color, "stroke-width": ptToMm(JOURNAL.linePt * 1.4), "stroke-dasharray": spec.dash ?? undefined, fill: "none", "data-legend-line": role }),
        el("text", { x: cx + 9, y: cy, "font-family": fontFor(spec.label), "font-size": text, fill: "#000000", "data-label": "legend" }, esc(spec.label)));
    });
    layers.push(el("g", { "data-key": "streams" }, rows));
  }

  function render() {
    const body = [el("rect", { x: 0, y: 0, width: w, height, fill: "#ffffff" })];
    panels.forEach((p) => {
      if (p.label === null) {
        body.push(el("g", { "data-figure-body": "1" }, p.body.map((f) => f())));
        return;
      }
      const [x0, y0] = p.box;
      const shown = labelStyle === "paren" ? `(${p.label})` : labelStyle === "bold" ? p.label : p.label.toUpperCase();
      body.push(el("g", { "data-panel": p.label, "data-panel-box": p.box.map(n).join(" ") },
        el("text", { x: x0 + 0.2, y: y0 + panelText * 0.8, "font-family": fontFor(shown), "font-size": panelText, "font-weight": "bold", fill: "#000000", "data-label": "panel-label" }, esc(shown)),
        p.body.map((f) => f())));
    });
    body.push(...layers);
    return svgDocument({ width: w, height, title, desc, mode, lang, body: body.join(""), extra: { "data-min-text-pt": JOURNAL.minTextPt } });
  }

  return { width: w, height, text, panel, key, render, warnings: () => panels.flatMap((p) => [...(p.canvas?.warnings ?? []), ...(p.view?.warnings ?? [])]) };
}
