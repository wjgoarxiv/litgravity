// WCAG 2.3.1 flash audit, excursion method (MO-C-03, MO-SH-04). Pure: it takes per-cell linear
// colour averages on the 320x180 grid (6x6 logical px at 1080p) frame by frame, and never decodes
// a video itself. The renderer feeds it the exact bytes it hands to ffmpeg (master) and to the
// preview encoder (preview), and logs each frame's transitions; the gate counts flashes from that
// log.
//
// A cell registers a transition when its luminance moves at least 0.1 from the extreme it reached
// since its last transition while the darker of the two is below 0.8; the extremes then reset. A
// frame-level transition in a direction exists when the cells that moved that way in frames
// [f-2, f] cover more than 25% of some 640x360 logical-px window (107x60 cells). Red uses the same
// method on (R-G-B)x320 over saturated-red cells. A flash is a pair of opposing frame-level
// transitions inside one second.
import { GATE } from "./constants.mjs";

/**
 * The audit grid for a frame: 6x6 px cells and the 640x360 window, transposed for a portrait
 * frame (180x320 cells, a 60x107 window) so the 10-degree field keeps its size in either format.
 */
export function gridFor(width = 1920, height = 1080) {
  const [gw, gh] = GATE.flashGrid;
  const [ww, wh] = GATE.flashWindowCells;
  return width >= height ? { gw, gh, ww, wh } : { gw: gh, gh: gw, ww: wh, wh: ww };
}

/** Streaming detector. Each frame is { R, G, B }: linear 0..1 cell averages on the grid. */
export class FlashDetector {
  constructor(grid = gridFor()) {
    const { gw, gh, ww, wh } = grid;
    this.grid = grid;
    this.cells = gw * gh;
    this.windowLimit = GATE.flashWindowArea * ww * wh;
    const CELLS = this.cells;
    this.frames = 0;
    this.hi = new Float32Array(CELLS);
    this.lo = new Float32Array(CELLS);
    this.rhi = new Float32Array(CELLS);
    this.rlo = new Float32Array(CELLS);
    this.prevL = new Float32Array(CELLS);
    this.history = []; // last GATE.flashEdgeFrames maps of { up, down, redUp, redDown } (Uint8Array)
    this.sat = new Int32Array((gw + 1) * (gh + 1));
  }

  /** Feed one frame; returns { up, down, redUp, redDown, stepArea } for the log. */
  push({ R, G, B }) {
    const CELLS = this.cells;
    const L = new Float32Array(CELLS);
    const V = new Float32Array(CELLS);
    for (let i = 0; i < CELLS; i++) {
      L[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i];
      const sum = R[i] + G[i] + B[i];
      V[i] = sum > 0 && R[i] / sum >= GATE.redRatio ? Math.max(0, R[i] - G[i] - B[i]) * GATE.redScale : 0;
    }
    const maps = { up: new Uint8Array(CELLS), down: new Uint8Array(CELLS), redUp: new Uint8Array(CELLS), redDown: new Uint8Array(CELLS) };
    let stepCells = 0;
    if (this.frames === 0) {
      this.hi.set(L); this.lo.set(L); this.rhi.set(V); this.rlo.set(V);
    } else {
      for (let i = 0; i < CELLS; i++) {
        const l = L[i];
        if (Math.abs(l - this.prevL[i]) >= GATE.flashDelta) stepCells += 1;
        if (l - this.lo[i] >= GATE.flashDelta && Math.min(l, this.lo[i]) < GATE.flashDarkCeiling) {
          maps.up[i] = 1; this.hi[i] = l; this.lo[i] = l;
        } else if (this.hi[i] - l >= GATE.flashDelta && Math.min(l, this.hi[i]) < GATE.flashDarkCeiling) {
          maps.down[i] = 1; this.hi[i] = l; this.lo[i] = l;
        } else {
          if (l > this.hi[i]) this.hi[i] = l;
          if (l < this.lo[i]) this.lo[i] = l;
        }
        const v = V[i];
        if (v - this.rlo[i] > GATE.redDelta) {
          maps.redUp[i] = 1; this.rhi[i] = v; this.rlo[i] = v;
        } else if (this.rhi[i] - v > GATE.redDelta) {
          maps.redDown[i] = 1; this.rhi[i] = v; this.rlo[i] = v;
        } else {
          if (v > this.rhi[i]) this.rhi[i] = v;
          if (v < this.rlo[i]) this.rlo[i] = v;
        }
      }
    }
    this.prevL = L;
    this.frames += 1;
    this.history.push(maps);
    if (this.history.length > GATE.flashEdgeFrames) this.history.shift();
    const result = { stepArea: +(stepCells / CELLS).toFixed(4) };
    for (const dir of ["up", "down", "redUp", "redDown"]) result[dir] = this.windowHit(dir);
    return result;
  }

  // Union of the direction's maps over the last frames, then the largest window count via a
  // summed-area table.
  windowHit(dir) {
    const { gw: GW, gh: GH, ww: WW, wh: WH } = this.grid;
    const CELLS = this.cells;
    const WINDOW_LIMIT = this.windowLimit;
    const union = new Uint8Array(CELLS);
    let any = 0;
    for (const maps of this.history) {
      const m = maps[dir];
      for (let i = 0; i < CELLS; i++) if (m[i]) { union[i] = 1; any += 1; }
    }
    if (any <= WINDOW_LIMIT) return false;
    const sat = this.sat;
    const stride = GW + 1;
    for (let y = 0; y < GH; y++) {
      let row = 0;
      for (let x = 0; x < GW; x++) {
        row += union[y * GW + x];
        sat[(y + 1) * stride + x + 1] = sat[y * stride + x + 1] + row;
      }
    }
    for (let y = 0; y + WH <= GH; y++) {
      for (let x = 0; x + WW <= GW; x++) {
        const count = sat[(y + WH) * stride + x + WW] - sat[y * stride + x + WW] - sat[(y + WH) * stride + x] + sat[y * stride + x];
        if (count > WINDOW_LIMIT) return true;
      }
    }
    return false;
  }
}

/** Frame-level transitions (from logged per-frame records) as an ordered list for one channel. */
export function transitionsOf(records, general = true) {
  const out = [];
  records.forEach((r, frame) => {
    if (general ? r.up : r.redUp) out.push({ frame, dir: 1 });
    if (general ? r.down : r.redDown) out.push({ frame, dir: -1 });
  });
  return out;
}

// Flashes in an ordered run of transitions: consecutive same-direction transitions collapse into
// one edge, and every two opposing edges make one flash.
function flashesIn(ordered) {
  let edges = 0;
  let last = 0;
  for (const t of ordered) {
    if (t.dir !== last) {
      edges += 1;
      last = t.dir;
    }
  }
  return Math.floor(edges / 2);
}

/**
 * Worst 1 s window. `loop: false` (the master) never wraps: windows start in [0, count - fps] and
 * a clip shorter than a second is one window. `loop: true` (the preview) wraps across the seam.
 */
export function worstWindow(transitions, count, fps, { loop }) {
  const span = Math.round(fps);
  let worst = { startFrame: 0, flashes: 0, transitions: [] };
  const starts = loop ? count : Math.max(1, count - span + 1);
  for (let s = 0; s < starts; s++) {
    const inside = [];
    for (const t of transitions) {
      const k = loop ? (t.frame - s + count) % count : t.frame - s;
      if (k >= 0 && k < span && (loop || t.frame < count)) inside.push({ ...t, k });
    }
    inside.sort((a, b) => a.k - b.k || a.dir - b.dir);
    const flashes = flashesIn(inside);
    if (flashes > worst.flashes) worst = { startFrame: s, flashes, transitions: inside.map((t) => `${t.frame}:${t.dir > 0 ? "up" : "down"}`) };
  }
  return { ...worst, startSec: +(worst.startFrame / fps).toFixed(3) };
}

/** Audit a logged sequence: { general, red } worst windows and the pass/fail against 3/3. */
export function auditRecords(records, fps, { loop }) {
  const general = worstWindow(transitionsOf(records, true), records.length, fps, { loop });
  const red = worstWindow(transitionsOf(records, false), records.length, fps, { loop });
  return {
    general, red,
    pass: general.flashes <= GATE.maxFlashesPerSecond && red.flashes <= GATE.maxRedFlashesPerSecond,
  };
}

/** Run the detector over frames and return the per-frame records (looping runs two passes). */
export function detectSequence(cellFrames, { loop, grid = gridFor() }) {
  const detector = new FlashDetector(grid);
  if (loop) for (const frame of cellFrames) detector.push(frame);
  return cellFrames.map((frame) => detector.push(frame));
}

/** Area-average an RGBA8 frame of any size onto its audit grid in linear light. */
export function cellsFromRgba(bytes, width, height, lut = LINEAR_LUT, { gw: GW, gh: GH } = gridFor(width, height)) {
  const CELLS = GW * GH;
  const R = new Float32Array(CELLS);
  const G = new Float32Array(CELLS);
  const B = new Float32Array(CELLS);
  const count = new Float32Array(CELLS);
  for (let y = 0; y < height; y++) {
    const cy = Math.min(GH - 1, Math.floor((y * GH) / height)) * GW;
    for (let x = 0; x < width; x++) {
      const c = cy + Math.min(GW - 1, Math.floor((x * GW) / width));
      const o = (y * width + x) * 4;
      R[c] += lut[bytes[o]];
      G[c] += lut[bytes[o + 1]];
      B[c] += lut[bytes[o + 2]];
      count[c] += 1;
    }
  }
  for (let i = 0; i < CELLS; i++) {
    const n = count[i] || 1;
    R[i] /= n; G[i] /= n; B[i] /= n;
  }
  return { R, G, B };
}

export const LINEAR_LUT = Float32Array.from({ length: 256 }, (_, v) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
});
