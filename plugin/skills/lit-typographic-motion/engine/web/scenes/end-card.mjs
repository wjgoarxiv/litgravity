// end-card: the closing statement and its credit line, settled. Its last frame is the film's final
// text state, which the reduced-motion still reproduces. The preset's one accent (if it has one)
// appears here only, as a small mark, inside the window the engine grants (<= 10% of frames).
import { clamp, ease } from "../../core/util.mjs";
import { Scene, landing } from "../scene.mjs";

export default class EndCard extends Scene {
  render(f, stage) {
    const { palette, presetId, shot, accentWindow } = this.ctx;
    const box = this.box();
    const settle = presetId === "tidal" ? ease.drift(clamp(f.lt / 1.2)) : ease.slam(clamp(f.lt / 0.18));
    const { size, lines } = this.fitBlock(stage, shot.text, "display", box.w * 0.85, presetId === "terminalcore" ? 90 : 140, 3);
    const lineHeight = 1.6;
    const blockH = (lines.length - 1) * size * lineHeight;
    const centered = presetId === "tidal";
    const x = centered ? 960 : box.x;
    const y0 = (presetId === "terminalcore" ? box.y + box.h / 2 : 520) - blockH / 2 + size * 0.3 + (1 - settle) * 16;
    stage.type.drawBlock(stage.glyphs, lines, x, y0, { lineHeight, fill: palette.type, alpha: landing(f.lt, 0.15), align: centered ? "center" : "left", elementId: "end" });
    const subY = y0 + blockH + Math.max(72, size * 0.8);
    if (shot.sub) {
      const s = stage.type.layout(shot.sub, { voice: "machine", size: 30 });
      stage.type.drawLine(stage.glyphs, s, x, subY, { fill: palette.type, alpha: landing(f.lt - 0.2, 0.3), align: centered ? "center" : "left", elementId: "end/sub" });
    }
    if (accentWindow && f.t >= accentWindow.start && f.t < accentWindow.end) {
      const mx = centered ? 960 - 16 : box.x;
      stage.mark({ x: mx, y: subY + 28, w: 32, h: 32 }, palette.accent, "end/accent", "accent");
    }
    return {};
  }
}
