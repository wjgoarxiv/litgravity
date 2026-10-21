// tidal-gradient (MO-SH-06): a slow domain-warped flow field that mixes the preset's 2-3 palette
// stops into the background. The noise origin is drawn once per shot from the pass seed; surges are
// smooth attack/decay envelopes placed through the shot event budget, never an instant step.
import { SHADER } from "../../core/constants.mjs";
import { hexToLinear, mulberry32 } from "../../core/util.mjs";
import { Pass } from "../gl.mjs";

const FRAG = /* glsl */ `
uniform float u_time; uniform uint u_seed; uniform vec3 u_stop0; uniform vec3 u_stop1; uniform vec3 u_stop2;
uniform float u_flowSpeed, u_warpAmount, u_curlStrength, u_surge, u_ditherAmount; uniform int u_octaves, u_bandingSteps;
uniform vec2 u_origin;
void main() {
  vec2 p = (FRAG_PX / LOGICAL.y) * 1.35 + u_origin;
  float z = u_time * u_flowSpeed * 2.0;
  vec2 flow = curl(p * 0.7, z, u_seed) * u_curlStrength * 0.08;
  float warp = fbm(vec3(p * 0.9 + flow, z), u_octaves, u_seed ^ 0xa511e9b3u);
  vec2 q = p + vec2(warp, -warp) * (u_warpAmount * (1.0 + 0.6 * u_surge)) + flow + vec2(u_time * u_flowSpeed, 0.0);
  float v = fbm(vec3(q, z * 0.5), u_octaves, u_seed) * 0.5 + 0.5;
  v = smoothstep(0.15, 0.95, v);
  if (u_bandingSteps > 0) v = floor(v * float(u_bandingSteps)) / float(u_bandingSteps);
  vec3 col = v < 0.5 ? mix(u_stop0, u_stop1, v * 2.0) : mix(u_stop1, u_stop2, (v - 0.5) * 2.0);
  col *= 1.0 + 0.35 * u_surge;
  if (u_ditherAmount > 0.0) {
    vec3 s = toSRGB(col);
    s += (unit(uhash3(uvec3(uvec2(FRAG_PX), uint(u_time * 600.0)))) - 0.5) * u_ditherAmount * 0.25;
    col = toLinear(sat(s));
  }
  fragColor = vec4(col, 0.0);
}`;

/** Surge envelope: rises over `attack`, decays over `decay` (both floored at 0.1 s). */
export function surgeEnvelope(t, times, attack, decay) {
  let env = 0;
  for (const t0 of times) {
    if (t < t0) continue;
    const dt = t - t0;
    const e = dt < attack ? dt / attack : Math.max(0, 1 - (dt - attack) / decay);
    env = Math.max(env, e * e * (3 - 2 * e));
  }
  return env;
}

export class TidalGradient {
  constructor(glw, { params, palette, software }) {
    this.id = "tidal-gradient";
    this.category = "background";
    const octaves = software ? SHADER.softwareOctaves(params.octaves) : params.octaves;
    this.params = {
      ...params,
      octaves,
      surgeAttackSec: Math.max(SHADER.surgeAttackFloor, params.surgeAttackSec),
      surgeDecaySec: Math.max(SHADER.surgeDecayFloor, params.surgeDecaySec),
      surgeCapPerSec: Math.min(SHADER.surgeRateCap, params.surgeCapPerSec),
    };
    this.downgraded = Boolean(software);
    this.stopsHex = [palette.bg, palette.stopA, palette.stopB];
    this.stops = this.stopsHex.map(hexToLinear);
    this.pass = new Pass(glw, FRAG, { pass: this.id });
  }
  shotState(seed, events, shot) {
    const rnd = mulberry32(seed);
    const origin = [rnd() * 40, rnd() * 40];
    // One surge on the shot's opening beat and one past its middle, each only if the event budget
    // allows it; surges punctuate, they never pulse on every beat.
    const surges = [];
    for (const t of [shot.start + 0.05, shot.start + (shot.end - shot.start) * 0.55]) if (events.add(t, "surge")) surges.push(t);
    return { seed, origin, surges };
  }
  draw(target, f, state, { stillOverrides } = {}) {
    const p = this.params;
    this.pass.draw(target, {
      u_time: f.t, u_seed: state.seed, u_stop0: this.stops[0], u_stop1: this.stops[1], u_stop2: this.stops[2],
      u_flowSpeed: p.flowSpeed, u_warpAmount: p.warpAmount, u_curlStrength: p.curlStrength, u_octaves: p.octaves,
      u_surge: p.surgeOnHit * surgeEnvelope(f.t, state.surges, p.surgeAttackSec, p.surgeDecaySec),
      u_ditherAmount: stillOverrides?.noise === 0 ? 0 : p.ditherAmount, u_bandingSteps: p.bandingSteps, u_origin: state.origin,
    });
  }
  manifestParams(state) {
    const p = this.params;
    return {
      paletteStopsHex: this.stopsHex, octaves: p.octaves, flowSpeed: p.flowSpeed, surgeCountRealized: state.surges.length,
      surgeTimes: state.surges.map((t) => +t.toFixed(4)), surgeAttackSec: p.surgeAttackSec, surgeDecaySec: p.surgeDecaySec,
      surgeCapPerSec: p.surgeCapPerSec,
    };
  }
}
