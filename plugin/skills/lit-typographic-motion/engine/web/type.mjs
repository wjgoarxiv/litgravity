// Type kit: font registry (Canvas2D FontFace for raster, opentype.js outlines for geometry),
// script-run layout, kerned per-glyph positioning and the type-geometry record the gate reads
// (MO-A-32..35, MO-FT-04/05, §A8 textBoxes). Adapted from mexicat/pdoom-video
// app/src/engine/type.ts (MIT, see ../NOTICE).
//
// Every glyph a scene shows goes through `drawLine`/`drawBlock`, which draw on the glyph layer
// (its alpha becomes the glyph-coverage mask) and append a textBoxes entry with the ink bbox from
// the real glyph outlines, transformed by the current canvas transform.
import { scriptRuns } from "../core/text.mjs";
import { runFontKey } from "../core/voices.mjs";
import { SCALE } from "./scale.mjs";

export class TypeKit {
  constructor({ opentype, voices }) {
    this.opentype = opentype;
    this.voices = voices;
    this.fonts = new Map();
    this.boxes = [];
    this.recording = false;
    this.measureCtx = document.createElement("canvas").getContext("2d");
    this.glyphBounds = new Map();
  }

  /** Register one font from its bytes under `key` (also its CSS family name). */
  async register(key, bytes, meta) {
    if (meta.format === "svg") return;
    const face = new FontFace(key, bytes);
    await face.load();
    document.fonts.add(face);
    const ot = this.opentype.parse(bytes);
    const os2 = ot.tables.os2;
    const capUnits = os2?.sCapHeight || ot.charToGlyph("H").getBoundingBox().y2;
    this.fonts.set(key, { key, ot, upm: ot.unitsPerEm, capUnits, weight: meta.weight ?? 400, file: meta.file, scripts: meta.scripts ?? ["latin"] });
  }

  font(key) {
    const f = this.fonts.get(key);
    if (!f) throw new Error(`font not registered: ${key}`);
    return f;
  }

  runFont(voice, script, opts) {
    return runFontKey(this.voices, voice, script, opts);
  }

  measure(text, key, size, trackingPx = 0) {
    const c = this.measureCtx;
    c.font = `${size}px "${key}"`;
    return c.measureText(text).width + Math.max(0, Array.from(text).length - 1) * trackingPx;
  }

  /** x of glyph `index` inside a kerned run (MO-A-32): never measure(text.slice(0, i)). */
  glyphX(text, index, key, size, trackingPx = 0) {
    const chars = Array.from(text);
    if (index <= 0) return 0;
    if (index >= chars.length) return this.measure(text, key, size, trackingPx);
    const c = this.measureCtx;
    c.font = `${size}px "${key}"`;
    return c.measureText(chars.slice(0, index + 1).join("")).width - c.measureText(chars[index]).width + index * trackingPx;
  }

  /**
   * Lay out one line of mixed-script text. Tracking and width steps apply to Latin runs only; a
   * Hangul run is forced to tracking 0 and width 100 (MO-FT-04).
   */
  layout(text, { voice = "display", size, trackingEm = 0, widthPct = 100, weight } = {}) {
    const runs = [];
    let x = 0;
    let capHeight = 0;
    for (const run of scriptRuns(text)) {
      const hangul = run.script === "hangul";
      const key = this.runFont(voice, run.script, { widthPct: hangul ? 100 : widthPct, weight });
      const f = this.font(key);
      const tEm = hangul ? 0 : trackingEm;
      const trackingPx = tEm * size;
      const width = this.measure(run.text, key, size, trackingPx);
      runs.push({ script: run.script, text: run.text, key, x, width, trackingEm: tEm, trackingPx, widthPct: hangul ? 100 : this.widthOf(key) });
      x += width + (runs.length > 0 && trackingPx ? trackingPx : 0);
      capHeight = Math.max(capHeight, (f.capUnits / f.upm) * size);
    }
    return { text, voice, size, runs, width: x, capHeight };
  }

  widthOf(key) {
    const m = /^archivo-(\d+)-/u.exec(key);
    return m ? Number(m[1]) : 100;
  }

  glyphBox(key, ch) {
    const id = `${key}\u0000${ch}`;
    let b = this.glyphBounds.get(id);
    if (!b) {
      const f = this.font(key);
      const g = f.ot.charToGlyph(ch);
      const bb = g.getBoundingBox();
      b = { x1: bb.x1 / f.upm, y1: bb.y1 / f.upm, x2: bb.x2 / f.upm, y2: bb.y2 / f.upm, empty: !(bb.x2 > bb.x1) };
      this.glyphBounds.set(id, b);
    }
    return b;
  }

  /** Ink bbox (logical px, y down) of a laid-out run at (x, baseline) under the context transform. */
  runBBox(ctx, run, size, x, baseline) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const chars = Array.from(run.text);
    for (let i = 0; i < chars.length; i++) {
      const b = this.glyphBox(run.key, chars[i]);
      if (b.empty) continue;
      const gx = x + run.x + this.glyphX(run.text, i, run.key, size, run.trackingPx);
      x0 = Math.min(x0, gx + b.x1 * size);
      x1 = Math.max(x1, gx + b.x2 * size);
      y0 = Math.min(y0, baseline - b.y2 * size);
      y1 = Math.max(y1, baseline - b.y1 * size);
    }
    if (x0 === Infinity) return null;
    const m = ctx.getTransform();
    const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([px, py]) => [
      (m.a * px + m.c * py + m.e) / SCALE,
      (m.b * px + m.d * py + m.f) / SCALE,
    ]);
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  /**
   * Draw a laid-out line on the glyph layer with its left edge at `x` (after `align`) and baseline
   * at `y`. `fill` is '#rrggbb'. Returns the drawn left x.
   */
  drawLine(layer, line, x, y, { fill, alpha = 1, align = "left", elementId, extra = {} }) {
    const ctx = layer.ctx;
    const left = align === "center" ? x - line.width / 2 : align === "right" ? x - line.width : x;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.textBaseline = "alphabetic";
    for (const run of line.runs) {
      ctx.font = `${line.size}px "${run.key}"`;
      if (run.trackingPx === 0) ctx.fillText(run.text, left + run.x, y);
      else {
        const chars = Array.from(run.text);
        for (let i = 0; i < chars.length; i++) ctx.fillText(chars[i], left + run.x + this.glyphX(run.text, i, run.key, line.size, run.trackingPx), y);
      }
      if (this.recording && alpha > 0.02) {
        const bbox = this.runBBox(ctx, run, line.size, left, y);
        const f = this.font(run.key);
        if (bbox) {
          this.boxes.push({
            elementId, text: run.text, voice: line.voice, fontFile: f.file, fontSizePx: line.size,
            capHeightPx: +line.capHeight.toFixed(2), weight: f.weight, fill, bbox: bbox.map((v) => +v.toFixed(2)),
            script: run.script, trackingEm: run.trackingEm, widthPct: run.widthPct, alpha: +alpha.toFixed(3), ...extra,
          });
        }
      }
    }
    ctx.restore();
    return left;
  }

  /**
   * Draw several lines as one block. `lineHeight` is the ratio of baseline step to font size; the
   * block's line count and ratio go into every box it records (MO-C-26), and `paragraph` marks a
   * running-text card whose measure the gate checks (MO-C-27).
   */
  drawBlock(layer, lines, x, y, { lineHeight, fill, alpha = 1, align = "left", elementId, paragraph = false, alphas }) {
    const step = lines[0].size * lineHeight;
    const cjk = lines.some((l) => l.runs.some((r) => r.script === "hangul"));
    const measureCh = Math.max(...lines.map((l) => Array.from(l.text).length));
    lines.forEach((line, i) => {
      this.drawLine(layer, line, x, y + i * step, {
        fill, alpha: alphas ? alphas[i] : alpha, align, elementId: `${elementId}/l${i}`,
        extra: { blockId: elementId, lineCount: lines.length, lineHeight: +lineHeight.toFixed(3), cjk, paragraph, measureCh },
      });
    });
    return step;
  }
}
