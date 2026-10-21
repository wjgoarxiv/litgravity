// signature: a Latin line written by a pen in one of the EMS single-stroke fonts, synced to the
// reading time (writtenLength), with a short fading trail behind the pen head. The trail is this
// engine's stateful example: advance() keeps the last few head positions (finite memory, well
// inside prerollMax), so a seeked still replays it exactly.
import { clamp } from "../../core/util.mjs";
import { hexToLinear } from "../../core/util.mjs";
import { strokeText, writtenLength, drawStrokeText } from "../stroke.mjs";
import { Scene } from "../scene.mjs";

const TRAIL = 6;

export default class Signature extends Scene {
  init() {
    this.stateful = true;
    this.prerollMax = 0.2;
    const key = this.ctx.shot.font ?? "ems-readability";
    this.font = this.ctx.strokeFonts.get(key);
    if (!this.font) throw new Error(`stroke font not loaded: ${key}`);
    this.fontKey = key;
    this.reset();
  }
  reset() {
    this.trail = [];
  }
  layout() {
    if (!this.st) {
      const box = this.box();
      const probe = strokeText(this.font, this.ctx.shot.text, 100);
      this.size = Math.min(180, (100 * box.w) / Math.max(1, probe.width));
      this.st = strokeText(this.font, this.ctx.shot.text, this.size);
    }
    return this.st;
  }
  headAt(t) {
    const st = this.layout();
    const shot = this.ctx.shot;
    const span = 0.7 * (shot.end - shot.start);
    const n = st.charRange.length;
    const times = st.charRange.map((_, i) => [shot.start + (span * i) / n, shot.start + (span * (i + 1)) / n]);
    return writtenLength(st, times, t);
  }
  advance(f) {
    this.trail.push({ t: f.t, len: this.headAt(f.t) });
    if (this.trail.length > TRAIL) this.trail.shift();
  }
  render(f, stage) {
    const { palette } = this.ctx;
    const st = this.layout();
    const box = this.box();
    const x = box.x + (box.w - st.width) / 2;
    const baseline = 540 + st.capHeight / 2;
    const len = this.headAt(f.t);
    const lineWidth = Math.max(4, this.size * 0.035);
    const { bbox, head } = drawStrokeText(stage.glyphs, st, len, x, baseline, { color: palette.type, lineWidth });
    if (bbox && stage.record) {
      stage.type.boxes.push({
        elementId: "signature", text: this.ctx.shot.text, voice: "signature", fontFile: this.fontKey, fontSizePx: +this.size.toFixed(2),
        capHeightPx: +st.capHeight.toFixed(2), weight: 400, fill: palette.type, bbox: bbox.map((v) => +v.toFixed(2)), script: "latin", trackingEm: 0, widthPct: 100, alpha: 1,
      });
    }
    if (head && len < st.total) {
      const signal = hexToLinear(palette.mark);
      stage.lines.segment(x + head.x, baseline + head.y, x + head.x, baseline + head.y, 12, signal, 1);
      for (const p of this.trail) {
        const age = f.t - p.t;
        if (age <= 0 || age > 0.1) continue;
        stage.lines.segment(x + head.x - (len - p.len) * 0.2, baseline + head.y, x + head.x, baseline + head.y, 3, signal, clamp(1 - age / 0.1) * 0.5);
      }
      if (stage.record) stage.record.elements.push({ elementId: "signature/pen", kind: "pen", bbox: [x + head.x - 6, baseline + head.y - 6, x + head.x + 6, baseline + head.y + 6] });
    }
    return {};
  }
}
