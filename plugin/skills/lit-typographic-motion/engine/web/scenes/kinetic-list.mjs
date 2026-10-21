// kinetic-list: a heading and a list whose items arrive one per reveal step, sliding in on the
// shortest path and staying put. The list is a multi-line block, so it carries the line-height
// floors (MO-C-26): 1.6 for Hangul, 1.5 for Latin.
import { clamp, ease } from "../../core/util.mjs";
import { Scene, landing } from "../scene.mjs";

export default class KineticList extends Scene {
  render(f, stage) {
    const { palette, presetId, shot } = this.ctx;
    const box = this.box();
    const items = shot.items ?? [];
    const cjk = items.some((i) => /[가-힣]/u.test(i));
    const lineHeight = cjk ? 1.6 : 1.5;
    const itemSize = this.snapSize(Math.min(presetId === "terminalcore" ? 54 : 72, Math.floor((box.h - 180) / Math.max(1, items.length) / lineHeight)), "body");
    let y = box.y + 20;
    if (shot.heading) {
      const hs = this.fit(stage, shot.heading, "display", box.w, presetId === "terminalcore" ? 72 : 96);
      const h = stage.type.layout(shot.heading, { voice: "display", size: hs });
      y += hs;
      stage.type.drawLine(stage.glyphs, h, box.x, y, { fill: presetId === "swiss-signal" ? palette.signal : palette.type, alpha: landing(f.lt, 0.15), elementId: "list/heading" });
      y += hs * 0.9;
    }
    const laid = items.map((item) => stage.type.layout(item, { voice: "body", size: itemSize }));
    const alphas = [];
    const offsets = [];
    shot.reveals.forEach((r) => {
      const since = f.t - r.start;
      alphas.push(landing(since, 0.15));
      offsets.push(since < 0 ? 0 : (1 - ease.outCubic(clamp(since / 0.3))) * -32);
    });
    const c = stage.glyphs.ctx;
    laid.forEach((line, i) => {
      if (alphas[i] <= 0) return;
      c.save();
      c.translate(offsets[i], 0);
      stage.type.drawLine(stage.glyphs, line, box.x + 64, y + itemSize + i * itemSize * lineHeight, {
        fill: palette.type, alpha: alphas[i], elementId: `list/l${i}`,
        extra: { blockId: "list", lineCount: items.length, lineHeight, cjk },
      });
      c.restore();
      stage.mark({ x: box.x + 16 + offsets[i], y: y + itemSize * 0.55 + i * itemSize * lineHeight, w: 18, h: 4 }, palette.dim ?? palette.type, `list/tick${i}`, "tick");
    });
    return {};
  }
}
