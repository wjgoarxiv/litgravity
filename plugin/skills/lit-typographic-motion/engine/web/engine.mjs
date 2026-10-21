// The page engine: owns the WebGL2 context, builds one scene per shot, and renders any output
// frame n deterministically. Sub-frame samples sit at fixed offsets inside the shutter
// (MO-A-28), are composited in linear HDR, averaged, and only then run through the post chain once,
// with the middle sample's overrides and grain keyed to the frame's own time. Stateful shots are
// reset on entry and, after a seek, replayed over their preroll (MO-A-05, MO-A-25). Adapted from
// mexicat/pdoom-video app/src/engine/engine.ts (MIT, see ../NOTICE).
import { SOFTWARE_RENDERERS, FLASH_EVENT_THRESHOLD } from "../core/constants.mjs";
import { PRESETS, resolvePalette } from "../core/presets.mjs";
import { ShotEvents } from "../core/events.mjs";
import { passSeed, hexToLinear } from "../core/util.mjs";
import { GL, Pass, Compositor, Layer2D } from "./gl.mjs";
import { LineBatch } from "./lines.mjs";
import { Post, normalizePost } from "./post.mjs";
import { TypeKit } from "./type.mjs";
import { parseStrokeFont, STROKE_FONTS } from "./stroke.mjs";
import { SCENES } from "./scenes/index.mjs";
import { SwissGrid } from "./passes/swiss-grid.mjs";
import { Dither } from "./passes/dither.mjs";
import { TidalGradient } from "./passes/tidal-gradient.mjs";
import { Crt } from "./passes/crt.mjs";
import { Glitch } from "./passes/glitch.mjs";
import { TerminalUi } from "./passes/terminal-ui.mjs";

const ACCUMULATE = "uniform sampler2D src; uniform float weight; void main() { fragColor = texture(src, vUv) * weight; }";

export const isSoftwareRenderer = (renderer) => SOFTWARE_RENDERERS.some((s) => renderer.toLowerCase().includes(s));

export class Engine {
  constructor(canvas, plan, { opentype }) {
    this.plan = plan;
    this.fps = plan.fps;
    this.frameCount = plan.frameCount;
    this.glw = new GL(canvas);
    this.renderer = this.glw.renderer();
    this.software = isSoftwareRenderer(this.renderer);
    this.preset = PRESETS[plan.presetId];
    this.palette = resolvePalette(this.preset, { signalHue: plan.signalHue });
    this.voices = this.preset.voices;
    this.type = new TypeKit({ opentype, voices: this.voices });
    this.strokeFonts = new Map();
    this.last = null;
    this.currentShot = null;
  }

  async init(fontPayloads) {
    for (const { key, bytes, meta } of fontPayloads) {
      if (meta.format === "svg") {
        const def = STROKE_FONTS[key];
        if (def) this.strokeFonts.set(key, parseStrokeFont(new TextDecoder().decode(bytes), def));
      } else await this.type.register(key, bytes, meta);
    }
    await document.fonts.ready;
    const glw = this.glw;
    this.compositor = new Compositor(glw);
    this.accumulate = new Pass(glw, ACCUMULATE);
    this.post = new Post(glw);
    this.rtA = glw.target();
    this.rtB = glw.target();
    this.acc = glw.target();
    this.final = glw.target(undefined, undefined, "rgba8");
    this.glyphs = new Layer2D(glw);
    this.lines = new LineBatch(glw, 512);
    this.buildPasses();
    this.buildShots();
  }

  buildPasses() {
    const { preset, plan, glw, palette } = this;
    const params = (id) => ({ ...preset.passParams[id], ...(plan.passParams?.[id] ?? {}) });
    this.passes = [];
    for (const id of preset.passes) {
      const opts = { params: params(id), palette, software: this.software, fps: this.fps, compositor: this.compositor };
      if (id === "swiss-grid") this.passes.push((this.grid = new SwissGrid(glw, opts)));
      else if (id === "dither") this.passes.push(new Dither(glw, opts));
      else if (id === "tidal-gradient") this.passes.push(new TidalGradient(glw, opts));
      else if (id === "crt") this.passes.push((this.crt = new Crt(glw, opts)));
      else if (id === "glitch") this.passes.push(new Glitch(glw, opts));
      else if (id === "terminal-ui") this.passes.push((this.terminal = new TerminalUi(glw, opts)));
      else throw new Error(`unknown pass ${id}`);
    }
  }

  buildShots() {
    const { plan } = this;
    const accent = this.accentWindow();
    this.shots = plan.shots.map((shot) => {
      const events = new ShotEvents(shot.start, shot.end);
      for (const t of shot.flashEvents ?? []) events.add(t, "flash");
      const states = new Map();
      for (const pass of this.passes) {
        const seed = pass.id === "swiss-grid" ? null : passSeed(plan.seed, shot.scene, shot.shotIndex, pass.id);
        states.set(pass.id, pass.shotState(seed, events, shot));
      }
      const Scene = SCENES[shot.scene];
      if (!Scene) throw new Error(`unknown scene ${shot.scene}`);
      const scene = new Scene({
        shot, presetId: this.preset.id, palette: this.palette, voices: this.voices, tokens: this.preset.tokens, grid: this.grid ?? null,
        terminal: this.terminal ?? null, fps: this.fps, totalFrames: this.frameCount, seed: plan.seed, strokeFonts: this.strokeFonts,
        accentWindow: accent && accent.shotId === shot.id ? accent : null,
      });
      scene.init();
      const stateful = scene.stateful || Boolean(this.crt?.persistence);
      return {
        ...shot, sceneId: shot.scene, scene, states, events, stateful,
        prerollMax: Math.max(scene.prerollMax, this.crt?.persistence ? 1 / this.fps : 0),
        startFrame: Math.round(shot.start * this.fps), endFrame: Math.round(shot.end * this.fps) - 1,
      };
    });
  }

  /** The one accent window: inside the first end-card shot, at most 8% of the film's frames. */
  accentWindow() {
    if (!this.preset.accentRole) return null;
    const shot = this.plan.shots.find((s) => s.scene === "end-card");
    if (!shot) return null;
    const maxSec = (Math.floor(0.08 * this.frameCount) - 1) / this.fps;
    const start = shot.start + 0.4 * (shot.end - shot.start);
    const end = Math.min(shot.end, start + Math.min(maxSec, 0.35 * (shot.end - shot.start)));
    return end > start ? { shotId: shot.id, start, end } : null;
  }

  shotAt(t) {
    for (const s of this.shots) if (t >= s.start && t < s.end) return s;
    return t < 0 ? this.shots[0] : this.shots[this.shots.length - 1];
  }

  enter(shot) {
    if (this.currentShot === shot) return;
    this.currentShot = shot;
    shot.scene.reset();
    this.crt?.resetHistory();
  }

  frameFor(shot, t) {
    const lt = t - shot.start;
    return { t, lt, p: Math.min(1, Math.max(0, lt / (shot.end - shot.start))), start: shot.start, end: shot.end, shot };
  }

  /** Render one sub-sample at time t into a linear-HDR texture. Returns the scene's overrides. */
  composite(t, { record, stillOverrides }) {
    const glw = this.glw;
    const shot = this.shotAt(t);
    this.enter(shot);
    const f = this.frameFor(shot, t);
    const A = this.rtA;
    const B = this.rtB;
    glw.clear(A, hexToLinear(this.palette.bg), 0);
    this.glyphs.clear();
    this.lines.clear();
    const stage = {
      type: this.type, glyphs: this.glyphs, lines: this.lines, record, palette: this.palette, labelText: this.plan.label,
      mark: (rect, hex, elementId, kind) => {
        const rgb = hexToLinear(hex);
        const cy = rect.y + rect.h / 2;
        const inset = Math.min(rect.h / 2, rect.w / 2);
        this.lines.segment(rect.x + inset, cy, rect.x + rect.w - inset, cy, rect.h, rgb, 1);
        if (record) {
          const bbox = [rect.x, rect.y, rect.x + rect.w, rect.y + rect.h].map((v) => +v.toFixed(2));
          record.elements.push({ elementId, kind, bbox });
          record.fills.push({ elementId, color: hex, bbox });
        }
      },
    };
    if (record) {
      record.fills.push({ elementId: "background", color: this.palette.bg, bbox: [0, 0, 1920, 1080] });
      record.shot = { id: shot.id, sceneId: shot.sceneId, shotIndex: shot.shotIndex };
    }
    const opts = { stillOverrides };
    for (const pass of this.passes) {
      const state = shot.states.get(pass.id);
      if (pass.id === "tidal-gradient") {
        pass.draw(A, f, state, opts);
        if (record) for (const hex of pass.stopsHex) record.fills.push({ elementId: `tidal-gradient/${hex}`, color: hex, bbox: [0, 0, 1920, 1080] });
      } else if (pass.id === "swiss-grid") pass.draw(A, f, record);
      else if (pass.id === "terminal-ui") pass.draw(A, f, state, stage);
    }
    if (shot.scene.stateful) shot.scene.advance(f);
    const overrides = shot.scene.render(f, stage) ?? {};
    this.lines.draw(A);
    this.compositor.draw(this.glyphs.upload(), A, { mode: "glyph" });
    let src = A;
    let dst = B;
    for (const pass of this.passes) {
      if (pass.category !== "filter") continue;
      pass.apply(src.tex, dst, f, shot.states.get(pass.id), opts);
      [src, dst] = [dst, src];
    }
    return { tex: src.tex, overrides, shot };
  }

  /**
   * Render output frame n into the final RGBA8 target (rows top-to-bottom, alpha = glyph mask).
   * Returns the frame record the log needs.
   */
  renderFrame(n, { samples = 1, shutter = 0.5, stillOverrides = null, fps = this.fps } = {}) {
    const { glw } = this;
    const tn = n / fps;
    const shotN = this.shotAt(tn);
    const sequential = this.last !== null && this.last.fps === fps && this.last.n === n - 1;
    if (!sequential) {
      this.currentShot = null;
      if (shotN.stateful) {
        const K = Math.ceil(shotN.prerollMax * fps);
        this.type.recording = false;
        for (let m = Math.max(Math.ceil(shotN.start * fps - 1e-9), n - K); m < n; m++) {
          for (let i = 0; i < samples; i++) this.composite(this.sampleTime(m, i, samples, shutter, fps), { record: null, stillOverrides });
        }
      }
    }
    glw.tracker.reset();
    glw.clear(this.acc, [0, 0, 0], 0);
    const mid = Math.floor(samples / 2);
    let record = null;
    let overrides = {};
    for (let i = 0; i < samples; i++) {
      const isMid = i === mid;
      glw.tracker.recordUniforms = isMid;
      this.type.recording = isMid;
      if (isMid) this.type.boxes = [];
      const rec = isMid ? { elements: [], fills: [] } : null;
      const res = this.composite(this.sampleTime(n, i, samples, shutter, fps), { record: rec, stillOverrides });
      this.accumulate.draw(this.acc, { src: res.tex, weight: 1 / samples }, { blend: "add" });
      if (isMid) {
        record = rec;
        overrides = res.overrides;
      }
    }
    this.type.recording = false;
    const shot = shotN;
    const post = normalizePost({ ...this.preset.post, ...(this.plan.post ?? {}), ...(shot.post ?? {}), ...overrides, ...(stillOverrides?.grain === 0 ? { grain: 0 } : {}) });
    const applied = this.post.render(this.acc.tex, this.final, post, { frameTime: tn, flashColor: hexToLinear(this.palette.type) });
    this.last = { n, fps };
    // Geometry the gate reads is measured after the post chain's shake and zoom (§A8).
    const place = (b) => {
      if (applied.zoom === 1 && applied.shake[0] === 0 && applied.shake[1] === 0) return b;
      const [sx, sy] = applied.shake;
      const map = (x, y) => [(x - 960) * applied.zoom + 960 + sx, (y - 540) * applied.zoom + 540 + sy];
      const [x0, y0] = map(b[0], b[1]);
      const [x1, y1] = map(b[2], b[3]);
      return [x0, y0, x1, y1].map((v) => +v.toFixed(2));
    };
    const textBoxes = this.type.boxes.map((b) => ({ ...b, bbox: place(b.bbox) }));
    const elements = record.elements.map((e) => ({ ...e, bbox: place(e.bbox) }));
    const fills = record.fills.map((e) => ({ ...e, bbox: place(e.bbox) }));
    return {
      frame: n, t: +tn.toFixed(6), shot: record.shot, textBoxes, elements, fills,
      post: { ...applied, flashEvent: applied.flash > FLASH_EVENT_THRESHOLD }, passes: glw.tracker.lines(),
    };
  }

  sampleTime(n, i, samples, shutter, fps = this.fps) {
    const tn = n / fps;
    if (samples <= 1) return tn;
    return Math.max(0, tn + (shutter / fps) * ((i + 0.5) / samples - 0.5));
  }

  /** passRanges[] for the manifest: one entry per pass per shot (MO-SH-00, §A10). */
  passRanges() {
    const out = [];
    for (const shot of this.shots) {
      for (const pass of this.passes) {
        const state = shot.states.get(pass.id);
        out.push({
          pass: pass.id, frameStart: shot.startFrame, frameEnd: shot.endFrame, sceneId: shot.sceneId, shotIndex: shot.shotIndex,
          seed: pass.id === "swiss-grid" ? null : state.seed, downgraded: Boolean(pass.downgraded),
          params: { ...pass.manifestParams(state), ...(pass.id === "crt" ? { shotStateful: shot.stateful } : {}) },
        });
      }
    }
    return out;
  }

  /** Every scheduled event per shot (MO-SH-03), for the log. */
  shotEvents() {
    return this.shots.map((s) => ({ shotId: s.id, sceneId: s.sceneId, shotIndex: s.shotIndex, events: s.events.events.map((e) => ({ t: +e.t.toFixed(4), source: e.source })) }));
  }

  readFinal(out) {
    return this.glw.readPixelsAsync(this.final, out);
  }
}
