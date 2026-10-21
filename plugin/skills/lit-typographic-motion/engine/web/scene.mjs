// Scene contract (MO-A-05, MO-A-06). A scene is built once per shot and renders any time `f.t`
// inside its window as a pure function of `f` (and the run seed). A scene that carries state sets
// `stateful = true` and `prerollMax`, keeps a finite memory no longer than `prerollMax`, and updates
// it only in `advance(f)`; after a seek the engine resets it and replays `advance` over the
// preroll, so a seeked render matches the sequential one byte for byte. Adapted from
// mexicat/pdoom-video app/src/engine/scene.ts (MIT, see ../NOTICE).
//
// `render(f, stage)` draws glyphs through stage.type onto stage.glyphs, non-glyph marks through
// stage.lines / stage.mark, and returns post-chain overrides for this frame (MO-A-58).
import { W, H } from "./scale.mjs";

/**
 * Entrance opacity: type is already partly visible on the frame it lands on, so a hard cut never
 * shows an empty frame, then settles to full over `dur` seconds.
 */
export const landing = (since, dur = 0.12) => (since < 0 ? 0 : Math.min(1, 0.4 + 0.6 * (since / dur)));

export class Scene {
  constructor(ctx) {
    this.ctx = ctx;
    this.stateful = false;
    this.prerollMax = 0;
  }
  init() {}
  reset() {}
  advance() {}
  render() {
    return {};
  }

  /** The box text may occupy: the title-safe area, or the terminal content box. */
  box() {
    if (this.ctx.terminal) return this.ctx.terminal.content();
    return { x: 120, y: 96, w: W - 240, h: H - 192 };
  }

  /** Largest size <= max at which `text` fits `width` in `voice` (layout is linear in size). */
  fit(stage, text, voice, width, max, opts = {}) {
    const probe = stage.type.layout(text, { voice, size: 100, ...opts });
    const size = Math.min(max, (100 * width) / Math.max(1, probe.width));
    return this.snapSize(size, voice);
  }

  /** Galmuri renders only at whole multiples of its 9 px grid, at least 4x (MO-FT-07). */
  snapSize(size, voice) {
    const v = this.ctx.voices[voice];
    if (v?.hangul === "galmuri9") return Math.max(36, Math.floor(size / 9) * 9);
    return Math.floor(size);
  }

  /** Wrap text into lines that fit `width` at `size`, breaking only between eojeol. */
  wrap(stage, text, voice, size, width, opts = {}) {
    const words = text.trim().split(/\s+/u);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || stage.type.layout(candidate, { voice, size, ...opts }).width <= width) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /**
   * Fit `text` into `width` x `maxLines`: shrink from `max` until the eojeol-wrapped block fits.
   * Returns { size, lines } with lines laid out.
   */
  fitBlock(stage, text, voice, width, max, maxLines = 3, opts = {}) {
    let size = this.snapSize(max, voice);
    for (;;) {
      const lines = this.wrap(stage, text, voice, size, width, opts);
      if ((lines.length <= maxLines && lines.every((l) => stage.type.layout(l, { voice, size, ...opts }).width <= width)) || size <= 24) {
        return { size, lines: lines.map((l) => stage.type.layout(l, { voice, size, ...opts })) };
      }
      size = this.snapSize(size * 0.92, voice);
    }
  }
}
