// title-slam: the opening hit. Display type lands on the shot's downbeat with the `slam` token
// (180 ms, entrance scale floored at 0.95), then holds. swiss-signal steps the Latin width from 125
// to 100 on landing; terminalcore types it in at the terminal's rate; tidal drifts it into place.
import { clamp, ease } from "../../core/util.mjs";
import { Scene, landing } from "../scene.mjs";

export default class TitleSlam extends Scene {
  render(f, stage) {
    const { palette, presetId } = this.ctx;
    const { text, sub } = this.ctx.shot;
    const box = this.box();
    const c = stage.glyphs.ctx;
    const lt = f.lt;
    if (presetId === "terminalcore") {
      const { size, lines } = this.fitBlock(stage, text, "display", box.w, 108, 3);
      const rate = this.ctx.tokens.typeInCharsPerSec ?? 22;
      let budget = Math.floor(lt * rate) + 1;
      const step = size * 1.6;
      lines.forEach((line, i) => {
        const chars = Array.from(line.text);
        const shown = chars.slice(0, Math.max(0, Math.min(chars.length, budget))).join("");
        budget -= chars.length;
        if (!shown) return;
        stage.type.drawLine(stage.glyphs, stage.type.layout(shown, { voice: "display", size }), box.x, box.y + size + i * step, { fill: palette.type, elementId: `title/l${i}`, extra: { blockId: "title", lineCount: lines.length, lineHeight: 1.6, cjk: /[가-힣]/u.test(text) } });
      });
      if (sub && budget > 4) {
        const s = stage.type.layout(sub, { voice: "machine", size: 32 });
        stage.type.drawLine(stage.glyphs, s, box.x, box.y + size + lines.length * step + 24, { fill: palette.dim, elementId: "title/sub" });
      }
      return {};
    }
    if (presetId === "tidal") {
      const settle = ease.drift(clamp(lt / 2.4));
      const { size, lines } = this.fitBlock(stage, text, "display", box.w * 0.9, 150, 3);
      const alpha = landing(lt, 0.6);
      const y0 = 540 - ((lines.length - 1) * size * 1.6) / 2 + size * 0.35 + (1 - settle) * 28;
      stage.type.drawBlock(stage.glyphs, lines, 960, y0, { lineHeight: 1.6, fill: palette.type, alpha, align: "center", elementId: "title" });
      if (sub) {
        const s = stage.type.layout(sub, { voice: "machine", size: 30 });
        stage.type.drawLine(stage.glyphs, s, 960, y0 + (lines.length - 1) * size * 1.6 + size * 0.9, { fill: palette.type, alpha: landing(lt - 0.5, 0.6), align: "center", elementId: "title/sub" });
      }
      return {};
    }
    // swiss-signal: the block sits on the grid's left edge with its last line in the lower third;
    // the size shrinks until block, signal bar and annotation fit inside the title-safe box.
    const landed = lt >= 0.18;
    const slam = ease.slam(clamp(lt / 0.18));
    const scale = 0.95 + 0.05 * slam;
    const subSize = 28;
    let fitted = this.fitBlock(stage, text, "display", box.w, 200, 3, { widthPct: 125, trackingEm: -0.02 });
    const lineHeight = fitted.lines.some((l) => l.runs.some((r) => r.script === "hangul")) ? 1.6 : 1.5;
    const height = (fb) => (fb.lines.length - 1) * fb.size * lineHeight + fb.size * 0.8 + (sub ? 72 + subSize : 40);
    while (height(fitted) > box.h - 40 && fitted.size > 48) fitted = this.fitBlock(stage, text, "display", box.w, fitted.size * 0.9, 3, { widthPct: 125, trackingEm: -0.02 });
    const { size, lines } = fitted;
    const laid = landed ? lines.map((l) => stage.type.layout(l.text, { voice: "display", size, widthPct: 100, trackingEm: -0.02 })) : lines;
    const step = size * lineHeight;
    const blockH = (laid.length - 1) * step;
    const bottom = box.y + box.h - (sub ? 72 + subSize : 40);
    const baseY = Math.min(box.y + size * 0.8 + (box.h - height(fitted)) * 0.55, bottom - blockH);
    c.save();
    c.translate(box.x, baseY);
    c.scale(scale, scale);
    c.translate(-box.x, -baseY);
    stage.type.drawBlock(stage.glyphs, laid, box.x, baseY, { lineHeight, fill: palette.type, alpha: 1, elementId: "title" });
    c.restore();
    stage.mark({ x: box.x, y: baseY + blockH + size * 0.22, w: Math.max(6, 96 * slam), h: 6 }, palette.mark, "title/signal-bar", "bar");
    if (sub) {
      const s = stage.type.layout(sub, { voice: "machine", size: subSize });
      stage.type.drawLine(stage.glyphs, s, box.x, baseY + blockH + size * 0.22 + 24 + subSize, { fill: palette.type, alpha: landing(lt - 0.3, 0.2), elementId: "title/sub" });
    }
    return {};
  }
}
