// The global post chain, run once per output frame on the averaged linear-HDR composite, in the
// fixed order bloom + halation -> chromatic aberration -> tone shoulder -> grain -> vignette ->
// flash -> shake/zoom -> invert (MO-A-58, MO-A-29). The sRGB transfer is applied exactly once, in
// the final pass, which also flips rows so a readback yields top-to-bottom bytes. The alpha channel
// carries the glyph-coverage mask through every geometric step, so the mask the gate reads lines up
// with the colour it samples. Adapted from mexicat/pdoom-video app/src/engine/post.ts (MIT, see
// ../NOTICE); the bloom pyramid follows the same prefilter/downsample/upsample shape.
import { POST_FIELDS } from "../core/constants.mjs";
import { Pass, W, H } from "./gl.mjs";

const MIPS = 6;

const PREFILTER = /* glsl */ `
uniform sampler2D src; uniform vec2 texel; uniform float threshold, knee;
void main() {
  vec3 c = 0.25 * (texture(src, vUv + texel * vec2(-1.0, -1.0)).rgb + texture(src, vUv + texel * vec2(1.0, -1.0)).rgb
    + texture(src, vUv + texel * vec2(-1.0, 1.0)).rgb + texture(src, vUv + texel * vec2(1.0, 1.0)).rgb);
  c = min(c, vec3(32.0));
  float l = max(c.r, max(c.g, c.b));
  float k = max(knee, 1e-4);
  float soft = clamp(l - threshold + k, 0.0, 2.0 * k);
  soft = soft * soft / (4.0 * k);
  float w = max(soft, l - threshold) / max(l, 1e-5);
  fragColor = vec4(c * w, 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D src; uniform vec2 texel;
void main() {
  vec3 o = texture(src, vUv).rgb * 0.25;
  o += (texture(src, vUv + texel * vec2(-1.0, -1.0)).rgb + texture(src, vUv + texel * vec2(1.0, -1.0)).rgb
    + texture(src, vUv + texel * vec2(-1.0, 1.0)).rgb + texture(src, vUv + texel * vec2(1.0, 1.0)).rgb) * 0.125;
  o += (texture(src, vUv + texel * vec2(-2.0, 0.0)).rgb + texture(src, vUv + texel * vec2(2.0, 0.0)).rgb
    + texture(src, vUv + texel * vec2(0.0, -2.0)).rgb + texture(src, vUv + texel * vec2(0.0, 2.0)).rgb) * 0.0625;
  fragColor = vec4(o, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D src; uniform sampler2D prev; uniform vec2 texel; uniform float radius;
void main() {
  vec2 o = texel * radius;
  vec3 s = texture(src, vUv - o).rgb + 2.0 * texture(src, vUv + vec2(0.0, -o.y)).rgb + texture(src, vUv + vec2(o.x, -o.y)).rgb
    + 2.0 * texture(src, vUv + vec2(-o.x, 0.0)).rgb + 4.0 * texture(src, vUv).rgb + 2.0 * texture(src, vUv + vec2(o.x, 0.0)).rgb
    + texture(src, vUv + vec2(-o.x, o.y)).rgb + 2.0 * texture(src, vUv + vec2(0.0, o.y)).rgb + texture(src, vUv + o).rgb;
  fragColor = vec4(texture(prev, vUv).rgb + s / 16.0, 1.0);
}`;

// Linear stage: everything before the geometric steps. Output stays linear HDR.
const LINEAR_STAGE = /* glsl */ `
uniform sampler2D src; uniform sampler2D bloomTex; uniform sampler2D haloTex;
uniform float exposure, bloom, halation, ca, grain, vignette, fade, flash, frameTime;
uniform vec3 flashColor; uniform vec3 haloColor;
vec3 composite(vec2 uv) {
  return texture(src, uv).rgb * exposure + texture(bloomTex, uv).rgb * bloom + haloColor * luma(texture(haloTex, uv).rgb) * halation;
}
vec3 shoulder(vec3 x) {
  const float k = 0.72;
  vec3 y = mix(x, k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k))), step(k, x));
  float over = max(max(x.r, x.g), x.b);
  return mix(y, vec3(1.0), smoothstep(2.0, 12.0, over) * 0.85);
}
void main() {
  vec2 dc = vUv - 0.5;
  vec2 aspect = vec2(LOGICAL.x / LOGICAL.y, 1.0);
  float r2 = dot(dc * aspect, dc * aspect);
  vec2 off = dc * r2 * ca / LOGICAL.x * 4.0;
  vec3 col = vec3(composite(vUv + off).r, composite(vUv).g, composite(vUv - off).b);
  col = shoulder(col);
  if (grain > 0.0) {
    // Grain is sized in display (sRGB) units like film grain, so it is added through a transfer
    // round trip; the output encode still happens once, in the final stage.
    vec3 s = toSRGB(sat(col));
    uint seed = uint(floor(frameTime * 60000.0 + 0.5));
    float g1 = unit(uhash3(uvec3(uvec2(FRAG_PX), seed))) - 0.5;
    float g2 = unit(uhash3(uvec3(uvec2(floor(FRAG_PX / 2.0)), seed ^ 0x5bd1e995u))) - 0.5;
    float lm = luma(s);
    s += (g1 * 0.6 + g2 * 0.4) * grain * (0.55 + 1.2 * lm * (1.0 - lm));
    col = toLinear(sat(s));
  }
  float v = smoothstep(0.95, 0.25, length(dc * vec2(1.0, 0.8)));
  col *= mix(1.0, v, vignette);
  col *= fade;
  col += flashColor * flash;
  fragColor = vec4(col, texture(src, vUv).a);
}`;

// Geometric + output stage: shake/zoom, invert, the single sRGB encode, row flip for readback.
const OUTPUT_STAGE = /* glsl */ `
uniform sampler2D src; uniform float zoom; uniform vec2 shake; uniform bool invertFrame;
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  uv = (uv - 0.5) / zoom + 0.5 + vec2(-shake.x, shake.y) / LOGICAL;
  vec4 c = texture(src, uv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) c = vec4(0.0);
  vec3 col = sat(c.rgb);
  if (invertFrame) col = vec3(1.0) - col;
  fragColor = vec4(toSRGB(col), c.a);
}`;

/** Clamp a post-override object to the MO-A-58 contract and fill neutral values. */
export function normalizePost(values) {
  const out = {};
  for (const [field, rule] of Object.entries(POST_FIELDS)) {
    const v = values[field];
    if (rule.pair) out[field] = Array.isArray(v) && v.length === 2 ? [+v[0] || 0, +v[1] || 0] : [...rule.neutral];
    else if (rule.boolean) out[field] = v === true;
    else {
      const n = typeof v === "number" && Number.isFinite(v) ? v : rule.neutral;
      out[field] = Math.min(rule.max, Math.max(rule.exclusiveMin ? Math.max(rule.min, 1e-4) : rule.min, n));
    }
  }
  return out;
}

export class Post {
  constructor(glw) {
    this.glw = glw;
    this.prefilter = new Pass(glw, PREFILTER);
    this.down = new Pass(glw, DOWN);
    this.up = new Pass(glw, UP);
    this.linear = new Pass(glw, LINEAR_STAGE);
    this.output = new Pass(glw, OUTPUT_STAGE);
    this.mips = [];
    this.ups = [];
    let w = W >> 1;
    let h = H >> 1;
    for (let i = 0; i < MIPS; i++) {
      this.mips.push(glw.target(Math.max(2, w), Math.max(2, h)));
      this.ups.push(glw.target(Math.max(2, w), Math.max(2, h)));
      w >>= 1;
      h >>= 1;
    }
    this.black = glw.target(2, 2);
    glw.clear(this.black, [0, 0, 0], 0);
    this.mid = glw.target();
  }

  /** src: averaged linear HDR (alpha = glyph mask). out: RGBA8 target, rows flipped for readback. */
  render(src, out, params, { frameTime, flashColor, haloColor = [1, 0.18, 0.04] }) {
    const p = normalizePost(params);
    let bloomTex = this.black.tex;
    let haloTex = this.black.tex;
    if (p.bloom > 0 || p.halation > 0) {
      this.prefilter.draw(this.mips[0], { src, texel: [1 / W, 1 / H], threshold: p.bloomThreshold, knee: p.bloomKnee });
      for (let i = 1; i < MIPS; i++) {
        const s = this.mips[i - 1];
        this.down.draw(this.mips[i], { src: s.tex, texel: [1 / s.width, 1 / s.height] });
      }
      let prev = this.mips[MIPS - 1].tex;
      for (let i = MIPS - 2; i >= 0; i--) {
        const small = i === MIPS - 2 ? this.mips[MIPS - 1] : this.ups[i + 1];
        this.up.draw(this.ups[i], { src: prev, prev: this.mips[i].tex, texel: [1 / small.width, 1 / small.height], radius: 0.5 + p.bloomRadius });
        prev = this.ups[i].tex;
      }
      bloomTex = this.ups[0].tex;
      haloTex = this.ups[Math.min(3, MIPS - 2)].tex;
    }
    this.linear.draw(this.mid, {
      src, bloomTex, haloTex, exposure: p.exposure, bloom: p.bloom / 3, halation: p.halation, ca: p.ca, grain: p.grain,
      vignette: p.vignette, fade: p.fade, flash: p.flash, frameTime, flashColor, haloColor,
    });
    this.output.draw(out, { src: this.mid.tex, zoom: p.zoom, shake: p.shake, invertFrame: p.invert });
    return p;
  }
}
