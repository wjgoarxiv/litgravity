// dither (MO-SH-08): ordered-dither quantization locked to screen space. Bayer modes take no seed;
// mode 3 offsets an interleaved-gradient-noise tile by the shot seed. The seed is set once per shot
// and never changes inside it, so the pattern cannot become a per-frame luminance flicker.
import { Pass } from "../gl.mjs";

const FRAG = /* glsl */ `
uniform sampler2D src; uniform int u_ditherMode; uniform int u_paletteSize; uniform int u_pixelScale;
uniform float u_ditherStrength; uniform uint u_seed;
float threshold(ivec2 cell) {
  if (u_ditherMode == 0) return bayer2(cell);
  if (u_ditherMode == 1) return bayer4(cell);
  if (u_ditherMode == 2) return bayer8(cell);
  // Interleaved gradient noise with a per-shot tile offset: a cheap stand-in for a blue-noise tile.
  vec2 p = vec2(cell) + vec2(float(u_seed & 255u), float((u_seed >> 8u) & 255u));
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
void main() {
  vec4 c = texture(src, vUv);
  vec3 s = toSRGB(sat(c.rgb));
  ivec2 cell = ivec2(floor(FRAG_PX / float(max(u_pixelScale, 1))));
  float levels = u_paletteSize > 1 ? float(u_paletteSize - 1) : 31.0;
  vec3 q = floor(s * levels + threshold(cell)) / levels;
  s = mix(s, sat(q), u_ditherStrength);
  fragColor = vec4(toLinear(s) + max(c.rgb - 1.0, 0.0), c.a);
}`;

export class Dither {
  constructor(glw, { params }) {
    this.id = "dither";
    this.category = "filter";
    this.params = { ...params };
    this.pass = new Pass(glw, FRAG, { pass: this.id });
  }
  shotState(seed) {
    return { seed };
  }
  apply(src, dst, f, state, { stillOverrides } = {}) {
    const p = this.params;
    // The blue-noise stand-in is a random source; the poster and reduced-motion still turn it off.
    const noiseOff = stillOverrides?.noise === 0 && p.mode === 3;
    this.pass.draw(dst, {
      src, u_ditherMode: p.mode, u_paletteSize: p.paletteSize, u_pixelScale: p.pixelScale,
      u_ditherStrength: noiseOff ? 0 : p.strength, u_seed: state.seed,
    });
  }
  manifestParams() {
    return { mode: this.params.mode, paletteSize: this.params.paletteSize, pixelScale: this.params.pixelScale, strength: this.params.strength };
  }
}
