// terminal-ui (MO-SH-11): a Canvas2D kit for window chrome, status meters and a caret, drawn crisp
// on one layer and composited before crt/dither. Its labels and readouts are glyphs, so they go
// through the type kit like any other text. The seed only drives cosmetic jitter (a readout's last
// digit); content and pacing come from the brief and the timeline.
import { mulberry32 } from "../../core/util.mjs";
import { Layer2D } from "../gl.mjs";

export class TerminalUi {
  constructor(glw, { params, palette, compositor }) {
    this.id = "terminal-ui";
    this.category = "background";
    this.params = { ...params };
    this.palette = palette;
    this.layer = new Layer2D(glw);
    this.compositor = compositor;
    this.window = { x: 120, y: 110, w: 1680, h: 860, bar: 44 };
  }
  /** The content box scenes lay text into (logical px). */
  content() {
    const w = this.window;
    return { x: w.x + 48, y: w.y + w.bar + 36, w: w.w - 96, h: w.h - w.bar - 120 };
  }
  shotState(seed) {
    return { seed, jitter: mulberry32(seed) };
  }
  draw(target, f, state, stage) {
    const p = this.params;
    const w = this.window;
    const c = this.layer.ctx;
    // Meters: fill follows shot progress, so they move with the timeline, not with noise.
    const meterY = w.y + w.h - 52;
    const strip = { x: w.x + 44, y: meterY - 4, w: 300 * (p.meterCount - 1) + 230, h: 22 };
    const drawMeters = () => {
      for (let i = 0; i < p.meterCount; i++) {
        const mx = w.x + 48 + i * 300;
        const level = 0.25 + 0.7 * ((f.p * (1 + i * 0.35)) % 1);
        c.strokeStyle = this.palette.dim;
        c.lineWidth = p.windowChromeWidthPx;
        c.strokeRect(mx, meterY, 220, 14);
        c.fillStyle = this.palette.signal;
        c.fillRect(mx + 2, meterY + 2, 216 * level, 10);
      }
    };
    let texture;
    if (!this.chromeDrawn) {
      // The window chrome is the same on every frame of the film: drawn and uploaded once.
      this.layer.clear();
      c.fillStyle = this.palette.panel;
      c.fillRect(w.x, w.y, w.w, w.h);
      c.strokeStyle = this.palette.dim;
      c.lineWidth = p.windowChromeWidthPx;
      c.strokeRect(w.x + 0.75, w.y + 0.75, w.w - 1.5, w.h - 1.5);
      c.beginPath();
      c.moveTo(w.x, w.y + w.bar);
      c.lineTo(w.x + w.w, w.y + w.bar);
      c.stroke();
      for (let i = 0; i < 3; i++) c.strokeRect(w.x + 18 + i * 22, w.y + 15, 12, 12);
      drawMeters();
      texture = this.layer.upload();
      this.chromeDrawn = true;
    } else {
      // Only the meter strip changes: repaint it on the panel and re-upload that rectangle.
      c.fillStyle = this.palette.panel;
      c.fillRect(strip.x, strip.y, strip.w, strip.h);
      drawMeters();
      texture = this.layer.uploadRegion(strip.x, strip.y, strip.w, strip.h);
    }
    this.compositor.draw(texture, target, { mode: "normal", logAs: this.id });
    if (stage.record) {
      stage.record.elements.push({ elementId: "terminal-ui/window", kind: "window", bbox: [w.x, w.y, w.x + w.w, w.y + w.h] });
      stage.record.fills.push({ elementId: "terminal-ui/panel", color: this.palette.panel, bbox: [w.x, w.y, w.x + w.w, w.y + w.h] });
    }
    // Chrome text sits in the corners, where the crt vignette and scanlines darken it below 4.5:1 in
    // status grey, so it is set in the signal hue (15:1 on navy); grey stays on strokes.
    if (stage.labelText) {
      const label = stage.type.layout(stage.labelText, { voice: "chrome", size: 20 });
      stage.type.drawLine(stage.glyphs, label, w.x + 96, w.y + 30, { fill: this.palette.type, elementId: "terminal-ui/title" });
    }
    // A readout whose last digit jitters with the seed: cosmetic only, never content or timing.
    const frameDigit = Math.floor(mulberry32((state.seed ^ Math.floor(f.t * 12)) >>> 0)() * 10);
    const readout = stage.type.layout(`T+${f.t.toFixed(1).padStart(5, "0")}${frameDigit}`, { voice: "machine", size: 22 });
    stage.type.drawLine(stage.glyphs, readout, w.x + w.w - 48, meterY + 12, { fill: this.palette.type, align: "right", elementId: "terminal-ui/readout" });
  }
  manifestParams() {
    const p = this.params;
    return { compositedThrough: ["crt", "dither"], meterCount: p.meterCount, logLineRateCharsPerSec: p.logLineRateCharsPerSec, wordTimingSource: "reading-time", layers: 1 };
  }
}
