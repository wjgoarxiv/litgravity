// crt (MO-SH-07): barrel curvature, scanlines, a subtle aperture triad, a local glow, vignette and a
// capped brightness flicker. Scanlines, curvature and vignette are pure functions of position, so
// they carry no flash risk; the flicker multiplier is computed on the CPU, logged every frame and
// capped at 0.06 peak-to-peak, below the flash audit's 0.1 trigger by construction. The boot
// flicker is the same capped multiplier over the shot's first 250 ms and counts as one event.
//
// Phosphor persistence is finite-memory: it blends in the previous sub-sample's crt input, never
// its own output, so a seek that replays the preroll reproduces it exactly. It is only allowed on
// a stateful shot; the gate fails a manifest that enables it anywhere else.
import { SHADER } from "../../core/constants.mjs";
import { Pass } from "../gl.mjs";

const FRAG = /* glsl */ `
uniform sampler2D src; uniform sampler2D u_prev; uniform uint u_seed;
uniform float u_scanlineFreqPerFrame, u_scanlineDepth, u_phosphorPersistence, u_bloomAmount, u_curvature, u_vignette, u_triadMaskAmount, u_flicker;
vec2 barrel(vec2 uv) {
  vec2 d = uv - 0.5;
  return uv + d * dot(d, d) * u_curvature * 2.0;
}
void main() {
  vec2 uv = barrel(vUv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { fragColor = vec4(0.0); return; }
  vec4 c = texture(src, uv);
  vec3 col = c.rgb;
  if (u_phosphorPersistence > 0.0) col += texture(u_prev, uv).rgb * u_phosphorPersistence;
  if (u_bloomAmount > 0.0) {
    vec2 px = 1.5 / LOGICAL;
    vec3 glow = texture(src, uv + vec2(px.x, 0.0)).rgb + texture(src, uv - vec2(px.x, 0.0)).rgb
      + texture(src, uv + vec2(0.0, px.y)).rgb + texture(src, uv - vec2(0.0, px.y)).rgb;
    col += max(glow * 0.25 - 0.35, 0.0) * u_bloomAmount;
  }
  float y = uv.y * LOGICAL.y;
  float scan = 0.5 + 0.5 * cos(y * TAU * u_scanlineFreqPerFrame / LOGICAL.y);
  col *= 1.0 - u_scanlineDepth * (1.0 - scan);
  int column = int(floor(FRAG_PX.x)) % 3;
  vec3 triad = column == 0 ? vec3(1.0, 0.82, 0.82) : column == 1 ? vec3(0.82, 1.0, 0.82) : vec3(0.82, 0.82, 1.0);
  float grainStatic = (unit(uhash3(uvec3(uvec2(FRAG_PX), u_seed))) - 0.5) * 0.04;
  col *= mix(vec3(1.0), triad * (1.0 + grainStatic), u_triadMaskAmount);
  vec2 d = uv - 0.5;
  col *= mix(1.0, smoothstep(0.75, 0.2, length(d * vec2(1.0, 0.9))), u_vignette);
  col *= u_flicker;
  fragColor = vec4(col, c.a);
}`;

export class Crt {
  constructor(glw, { params, software }) {
    this.id = "crt";
    this.category = "filter";
    this.glw = glw;
    this.params = { ...params, flickerAmp: Math.min(SHADER.crtFlickerCap, params.flickerAmp) };
    this.downgraded = Boolean(software);
    if (software) this.params.phosphorPersistence = 0;
    this.pass = new Pass(glw, FRAG, { pass: this.id });
    this.history = null;
  }
  get persistence() {
    return this.params.phosphorPersistence > 0;
  }
  shotState(seed, events, shot) {
    const boot = events.add(shot.start, "boot-flicker") ? shot.start : null;
    return { seed, boot };
  }
  resetHistory() {
    if (this.history) this.glw.clear(this.history, [0, 0, 0], 0);
  }
  /** Flicker multiplier at t: base amplitude, or the cap during the boot window. */
  flicker(t, state) {
    const p = this.params;
    const booting = state.boot !== null && t >= state.boot && t < state.boot + 0.25;
    const amp = booting ? SHADER.crtFlickerCap : p.flickerAmp;
    return 1 + 0.5 * amp * Math.sin(Math.PI * 2 * p.flickerFreqHz * t);
  }
  apply(src, dst, f, state) {
    const p = this.params;
    if (this.persistence && !this.history) {
      this.history = this.glw.target();
      this.resetHistory();
    }
    this.pass.draw(dst, {
      src, u_prev: this.history ? this.history.tex : src, u_seed: state.seed, u_scanlineFreqPerFrame: p.scanlineFreqPerFrame,
      u_scanlineDepth: p.scanlineDepth, u_phosphorPersistence: p.phosphorPersistence, u_bloomAmount: p.bloomAmount,
      u_curvature: p.curvature, u_vignette: p.vignette, u_triadMaskAmount: p.triadMaskAmount, u_flicker: this.flicker(f.t, state),
    });
    if (this.persistence) this.copyHistory(src);
  }
  copyHistory(src) {
    if (!this.copy) this.copy = new Pass(this.glw, "uniform sampler2D src; void main() { fragColor = texture(src, vUv); }");
    this.copy.draw(this.history, { src });
  }
  manifestParams(state) {
    const p = this.params;
    return {
      scanlineFreq: p.scanlineFreqPerFrame, scanlineDepth: p.scanlineDepth, curvature: p.curvature, vignette: p.vignette,
      flickerAmp: p.flickerAmp, flickerFreqHz: p.flickerFreqHz, persistenceEnabled: this.persistence,
      bootFlickerTimes: state.boot === null ? [] : [+state.boot.toFixed(4)],
    };
  }
}
