// glitch (MO-SH-05): horizontal slice offsets, block corruption and an RGB split confined to one
// band per hit. A hit is one displace held for `holdFrames` frames, then one restore; its schedule
// is precomputed per shot from the seed and the shot event budget. The band never exceeds the area
// cap, so a hit can never become a full-frame step (MO-SH-04a), and nothing is inverted.
import { SHADER } from "../../core/constants.mjs";
import { glitchCandidates } from "../../core/events.mjs";
import { mulberry32 } from "../../core/util.mjs";
import { Pass } from "../gl.mjs";

const FRAG = /* glsl */ `
uniform sampler2D src; uniform float u_time; uniform uint u_seed; uniform uint u_hitSeed;
uniform float u_hit, u_intensity, u_maxOffsetPx, u_rgbSplitPx, u_hitRatePerSec, u_areaCapPct;
uniform int u_sliceCount, u_holdFrames; uniform vec2 u_blockCorruptSize; uniform vec2 u_band;
void main() {
  vec2 px = FRAG_PX;
  float y = LOGICAL.y - px.y;
  vec4 c = texture(src, vUv);
  if (u_hit < 0.5 || y < u_band.x || y >= u_band.y) { fragColor = c; return; }
  float t = (y - u_band.x) / max(u_band.y - u_band.x, 1.0);
  int slice = int(floor(t * float(u_sliceCount)));
  float r = unit(uhash3(uvec3(uint(slice), u_hitSeed, u_seed))) * 2.0 - 1.0;
  float dx = r * u_maxOffsetPx * u_intensity;
  vec2 cell = floor(px / u_blockCorruptSize);
  uint blockHash = uhash3(uvec3(uvec2(cell), u_hitSeed));
  if ((blockHash & 7u) == 0u) dx += (unit(uhash(blockHash)) - 0.5) * u_blockCorruptSize.x * 2.0;
  vec2 uv = vUv + vec2(dx / LOGICAL.x, 0.0);
  vec2 split = vec2(u_rgbSplitPx / LOGICAL.x, 0.0);
  vec4 g = texture(src, uv);
  fragColor = vec4(texture(src, uv - split).r, g.g, texture(src, uv + split).b, g.a);
}`;

export class Glitch {
  constructor(glw, { params, fps }) {
    this.id = "glitch";
    this.category = "filter";
    this.fps = fps;
    this.params = {
      ...params,
      hitRatePerSec: Math.min(SHADER.glitchHitRateCap, params.hitRatePerSec),
      areaCapPct: Math.min(SHADER.glitchAreaCapPct, params.areaCapPct),
    };
    this.pass = new Pass(glw, FRAG, { pass: this.id });
  }
  shotState(seed, events, shot) {
    const p = this.params;
    const rnd = mulberry32(seed ^ 0x9e3779b9);
    const hits = [];
    for (const t of glitchCandidates({ start: shot.start, end: shot.end, rate: p.hitRatePerSec, seed })) {
      if (!events.add(t, "glitch")) continue;
      const bandH = (p.areaCapPct / 100) * 1080 * (0.6 + 0.4 * rnd());
      const y0 = 140 + rnd() * (1080 - 280 - bandH);
      hits.push({ t, hitSeed: (Math.floor(rnd() * 4294967295) >>> 0), band: [y0, y0 + bandH] });
    }
    return { seed, hits, duration: shot.end - shot.start };
  }
  activeHit(t, state) {
    const hold = this.params.holdFrames / this.fps;
    return state.hits.find((h) => t >= h.t && t < h.t + hold) ?? null;
  }
  apply(src, dst, f, state) {
    const p = this.params;
    const hit = this.activeHit(f.t, state);
    this.pass.draw(dst, {
      src, u_time: f.t, u_seed: state.seed, u_hitSeed: hit ? hit.hitSeed : 0, u_hit: hit ? 1 : 0, u_intensity: p.intensity,
      u_maxOffsetPx: p.maxOffsetPx, u_rgbSplitPx: p.rgbSplitPx, u_hitRatePerSec: p.hitRatePerSec, u_areaCapPct: p.areaCapPct,
      u_sliceCount: p.sliceCount, u_holdFrames: p.holdFrames, u_blockCorruptSize: p.blockCorruptSize, u_band: hit ? hit.band : [0, 0],
    });
  }
  manifestParams(state) {
    const p = this.params;
    const maxBand = state.hits.reduce((m, h) => Math.max(m, h.band[1] - h.band[0]), 0);
    return {
      intensity: p.intensity, hitRatePerSecRealized: +(state.hits.length / Math.max(state.duration, 1e-6)).toFixed(4), areaCapPct: p.areaCapPct,
      maxHitAreaPct: +((maxBand / 1080) * 100).toFixed(3), holdFrames: p.holdFrames, hitTimes: state.hits.map((h) => +h.t.toFixed(4)),
    };
  }
}
