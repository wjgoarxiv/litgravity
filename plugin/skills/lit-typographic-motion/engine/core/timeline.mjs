// Timeline model (MO-A-06, MO-A-09..16, MO-A-41a). Builds the canonical timeline[] from a
// normalized brief: every shot's hold comes from the reading floor at the generator margin, cuts
// are snapped forward to the beat grid (never shortening a hold), and a shot always holds at least
// two beats. The same anchor-and-snap method works for the Tier-1 BPM grid and a Tier-2 beat grid.
import { TIMELINE, READING, GATE } from "./constants.mjs";
import { readingFloor, readingCounts, textScript, eojeol, smart } from "./text.mjs";

/** Beat times (seconds) for a constant BPM, long enough to cover `untilSec`. */
export function bpmGrid(bpm, untilSec) {
  const step = 60 / bpm;
  const beats = [];
  for (let i = 0; i * step <= untilSec + step * 4; i++) beats.push(i * step);
  return beats;
}

/** Extend a detected beat grid past its last beat with the median interval. */
export function extendGrid(grid, untilSec) {
  const beats = [...grid].sort((a, b) => a - b);
  if (beats.length < 2) return bpmGrid(TIMELINE.defaultBpm, untilSec);
  const gaps = beats.slice(1).map((b, i) => b - beats[i]).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  while (beats[beats.length - 1] < untilSec + median * 4) beats.push(beats[beats.length - 1] + median);
  if (beats[0] > 0) beats.unshift(0);
  return beats;
}

const frameTime = (seconds, fps) => Math.round(seconds * fps) / fps;

/** First beat at or after `t` (within half a frame). */
function beatAtOrAfter(grid, t, fps) {
  const eps = 0.5 / fps;
  return grid.find((b) => b >= t - eps) ?? grid[grid.length - 1];
}

function localBeat(grid, t) {
  for (let i = 1; i < grid.length; i++) if (grid[i] > t) return grid[i] - grid[i - 1];
  return grid.length > 1 ? grid[grid.length - 1] - grid[grid.length - 2] : 60 / TIMELINE.defaultBpm;
}

/** The text a viewer reads in a shot, and the reveal steps inside it (each an eojeol or item). */
export function shotReading(shot) {
  switch (shot.scene) {
    case "title-slam":
    case "end-card":
      return { kind: "line", text: [shot.text, shot.sub].filter(Boolean).join(" "), reveals: [] };
    case "karaoke-line":
      return { kind: "line", text: shot.text, reveals: eojeol(shot.text) };
    case "kinetic-list":
      return { kind: "scene", text: [shot.heading, ...(shot.items ?? [])].filter(Boolean).join(" "), reveals: [...(shot.items ?? [])] };
    case "number-counter":
      return { kind: "scene", text: [shot.label, shot.display].filter(Boolean).join(" "), reveals: [] };
    case "signature":
      return { kind: "line", text: shot.text, reveals: [] };
    default:
      return { kind: shot.text ? "line" : "scene", text: shot.text ?? "", reveals: shot.reveals ?? [] };
  }
}

// Reveals take this share of a shot, so the finished line keeps the rest of the hold.
const REVEAL_SHARE = 0.6;

/**
 * Build the timeline. `shots` are normalized brief shots (text already through smart()).
 * Returns { timeline, shots, durationSec, beats } where shots carry start/end and their reveals.
 */
export function buildTimeline({ shots, fps = TIMELINE.defaultFps, bpm = TIMELINE.defaultBpm, beatGrid = null }) {
  const margin = TIMELINE.generatorMargin;
  const estimate = shots.reduce((sum, shot) => sum + 8 + (shot.hold ?? 0), 0) + 10;
  const grid = beatGrid ? extendGrid(beatGrid, estimate) : bpmGrid(bpm, estimate);
  const counters = new Map();
  const timeline = [];
  const placed = [];
  let cursor = 0;
  for (const shot of shots) {
    const shotIndex = counters.get(shot.scene) ?? 0;
    counters.set(shot.scene, shotIndex + 1);
    const id = shotIndex === 0 ? shot.scene : `${shot.scene}-${shotIndex}`;
    const reading = shotReading(shot);
    const start = cursor;
    const beat = localBeat(grid, start);
    const floor = readingFloor(reading.text, reading.kind);
    const revealStep = margin * READING.revealFloor;
    const revealSpan = reading.reveals.length * revealStep;
    let hold = Math.max(
      margin * floor,
      TIMELINE.minSceneBeats * beat,
      reading.reveals.length ? revealSpan / REVEAL_SHARE : 0,
      shot.hold ?? 0,
    );
    // A cps cross-check failure is fixed by holding longer, never by cutting text.
    const { C } = readingCounts(reading.text ?? "");
    if (C / hold > READING.maxCharsPerSecond) hold = (C / READING.maxCharsPerSecond) * margin;
    const snappedEnd = beatAtOrAfter(grid, start + hold, fps);
    const end = frameTime(snappedEnd, fps);
    const beatSec = beatAtOrAfter(grid, start, fps);
    timeline.push({
      id, sceneId: shot.scene, shotIndex, start, end, holdSec: +(end - start).toFixed(6), kind: reading.kind,
      text: reading.text, script: textScript(reading.text || " "), beatSec: +beatSec.toFixed(6),
    });
    const reveals = [];
    if (reading.reveals.length) {
      const step = Math.max(revealStep, ((end - start) * REVEAL_SHARE) / reading.reveals.length);
      reading.reveals.forEach((text, k) => {
        const rStart = frameTime(start + k * step, fps);
        const rEnd = k === reading.reveals.length - 1 ? end : frameTime(start + (k + 1) * step, fps);
        const entry = {
          id: `${id}/r${k}`, sceneId: shot.scene, shotIndex, start: rStart, end: rEnd, holdSec: +(rEnd - rStart).toFixed(6),
          kind: "reveal", text, script: textScript(text), beatSec: +nearestBeat(grid, rStart).toFixed(6),
        };
        reveals.push(entry);
        timeline.push(entry);
      });
    }
    placed.push({ ...shot, id, shotIndex, start, end, reveals, reading });
    cursor = end;
  }
  let durationSec = cursor;
  if (durationSec < GATE.minDurationSec && placed.length) {
    const last = placed[placed.length - 1];
    const end = frameTime(beatAtOrAfter(grid, GATE.minDurationSec, fps), fps);
    last.end = end;
    const entry = timeline.find((e) => e.id === last.id);
    entry.end = end;
    entry.holdSec = +(end - entry.start).toFixed(6);
    if (last.reveals.length) {
      const lastReveal = timeline.find((e) => e.id === last.reveals[last.reveals.length - 1].id);
      lastReveal.end = end;
      lastReveal.holdSec = +(end - lastReveal.start).toFixed(6);
    }
    durationSec = end;
  }
  return { timeline, shots: placed, durationSec, beats: grid.filter((b) => b <= durationSec + 1e-9) };
}

function nearestBeat(grid, t) {
  let best = grid[0];
  for (const b of grid) if (Math.abs(b - t) < Math.abs(best - t)) best = b;
  return best;
}

/** Normalize a display string: typographic punctuation for display voices, plain for machine. */
export const displayText = (text, voice = "display") => (voice === "machine" ? text : smart(text));
