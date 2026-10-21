// Per-shot event budget (MO-SH-03): glitch hits, tidal surges, flash pulses, invert changes and
// boot-flicker bursts together stay at or under 2 events in any 1 s window of a shot. Sources ask
// for candidate times in priority order; a candidate is accepted only if the window rule still
// holds. The schedule is built once per shot from the seed, never rolled per frame.
import { SHADER } from "./constants.mjs";
import { mulberry32 } from "./util.mjs";

export class ShotEvents {
  constructor(start, end, limit = SHADER.eventsPerSecondPerShot) {
    this.start = start;
    this.end = end;
    this.limit = limit;
    this.events = [];
  }
  fits(t) {
    const times = [...this.events.map((e) => e.t), t].sort((a, b) => a - b);
    for (let i = 0; i < times.length; i++) {
      let n = 0;
      for (let j = i; j < times.length && times[j] < times[i] + 1; j++) n += 1;
      if (n > this.limit) return false;
    }
    return true;
  }
  add(t, source) {
    if (t < this.start || t >= this.end || !this.fits(t)) return false;
    this.events.push({ t, source });
    this.events.sort((a, b) => a.t - b.t);
    return true;
  }
  of(source) {
    return this.events.filter((e) => e.source === source).map((e) => e.t);
  }
}

/**
 * Candidate glitch hit times for a shot at `rate` per second, jittered by the pass seed. Hits keep
 * clear of the first `guard` seconds so a cut and a hit never share a frame.
 */
export function glitchCandidates({ start, end, rate, seed, guard = 0.3 }) {
  if (rate <= 0) return [];
  const rnd = mulberry32(seed);
  const spacing = 1 / Math.min(rate, SHADER.glitchHitRateCap);
  const out = [];
  for (let t = start + guard + spacing * (0.3 + 0.4 * rnd()); t < end - guard; t += spacing * (0.8 + 0.4 * rnd())) out.push(t);
  return out;
}
