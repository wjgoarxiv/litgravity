// karaoke-line: one line revealed eojeol by eojeol at the timeline's reveal steps. Every word keeps
// the position it has in the finished line, so nothing reflows while it reveals; the word being
// read is set in the signal colour when the size makes that colour legible (MO-B-01).
import { clamp, ease } from "../../core/util.mjs";
import { GATE } from "../../core/constants.mjs";
import { Scene, landing } from "../scene.mjs";

export default class KaraokeLine extends Scene {
  init() {
    this.words = this.ctx.shot.text.trim().split(/\s+/u);
  }
  render(f, stage) {
    const { palette, presetId, shot } = this.ctx;
    const box = this.box();
    const maxSize = presetId === "terminalcore" ? 81 : 120;
    const { size, lines } = this.fitBlock(stage, shot.text, "display", box.w, maxSize, 3);
    const step = size * 1.6;
    const blockH = (lines.length - 1) * step;
    const centerY = presetId === "terminalcore" ? box.y + box.h / 2 : 540;
    const y0 = centerY - blockH / 2 + size * 0.35;
    const revealed = shot.reveals.filter((r) => f.t >= r.start).length;
    const current = revealed - 1;
    const large = size >= GATE.largeFontPx;
    let wordIndex = 0;
    lines.forEach((line, li) => {
      const words = line.text.split(" ");
      const lineLeft = presetId === "swiss-signal" || presetId === "terminalcore" ? box.x : 960 - line.width / 2;
      let offset = 0;
      for (const word of words) {
        const k = wordIndex;
        wordIndex += 1;
        const prefix = offset === 0 ? 0 : stage.type.layout(line.text.slice(0, offset), { voice: "display", size }).width;
        offset += word.length + 1;
        if (k >= revealed) continue;
        const since = f.t - shot.reveals[k].start;
        const rise = presetId === "tidal" ? (1 - ease.drift(clamp(since / 0.5))) * 10 : (1 - ease.slam(clamp(since / 0.18))) * 14;
        const fill = k === current && large && palette.signal && presetId === "swiss-signal" ? palette.signal : palette.type;
        const laid = stage.type.layout(word, { voice: "display", size });
        stage.type.drawLine(stage.glyphs, laid, lineLeft + prefix, y0 + li * step + rise, {
          fill, alpha: landing(since), elementId: `line/w${k}`,
          extra: { blockId: "line", lineCount: lines.length, lineHeight: 1.6, cjk: /[가-힣]/u.test(shot.text) },
        });
      }
    });
    return {};
  }
}
