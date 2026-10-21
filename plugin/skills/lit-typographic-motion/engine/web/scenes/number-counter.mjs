// number-counter: a figure that counts to its value over the first 70% of the shot and then holds,
// set in the machine voice (monospaced digits, never negative tracking) with a label under it.
import { clamp, ease } from "../../core/util.mjs";
import { Scene, landing } from "../scene.mjs";

export default class NumberCounter extends Scene {
  render(f, stage) {
    const { palette, shot } = this.ctx;
    const box = this.box();
    const from = Number(shot.from ?? 0);
    const to = Number(shot.to ?? 0);
    const hold = shot.end - shot.start;
    const k = ease.outCubic(clamp(f.lt / (0.7 * hold)));
    const value = Math.round(from + (to - from) * k);
    const digits = `${shot.prefix ?? ""}${value.toLocaleString("en-US")}${shot.suffix ?? ""}`;
    const size = this.fit(stage, shot.display, "machine", box.w, 260);
    const figure = stage.type.layout(digits, { voice: "machine", size });
    const y = 520 + size * 0.2;
    stage.type.drawLine(stage.glyphs, figure, box.x, y, { fill: palette.type, elementId: "counter/figure" });
    // Below the figure's descenders (a comma drops under the baseline): bar, then label.
    const barY = y + size * 0.3;
    stage.mark({ x: box.x, y: barY, w: Math.max(6, (box.w * 0.4) * k), h: 6 }, palette.mark, "counter/bar", "bar");
    if (shot.label) {
      const ls = this.fit(stage, shot.label, "body", box.w, 56);
      stage.type.drawLine(stage.glyphs, stage.type.layout(shot.label, { voice: "body", size: ls }), box.x, barY + 28 + ls, { fill: palette.type, alpha: landing(f.lt - 0.2, 0.3), elementId: "counter/label" });
    }
    return {};
  }
}
