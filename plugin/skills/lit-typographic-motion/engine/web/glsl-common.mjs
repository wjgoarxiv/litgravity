// Shared GLSL ES 3.0 header prepended to every full-screen pass. Adapted in structure from
// mexicat/pdoom-video app/src/engine/glsl/common.ts (MIT, see ../NOTICE): output-scale-aware
// fragment coordinates, colour transfer helpers and pure noise. The noise here is this engine's
// own integer-hash value noise, seeded through `uint` uniforms (MO-SH-01), so every pass that needs
// randomness is a pure function of (pixel, seed, t).
import { SCALE } from "./scale.mjs";

export const GLSL_COMMON = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718
const float PX_SCALE = ${SCALE.toFixed(1)};
#define FRAG_PX (gl_FragCoord.xy / PX_SCALE)
const vec2 LOGICAL = vec2(1920.0, 1080.0);

float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat(vec3 x) { return clamp(x, 0.0, 1.0); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

// 32-bit integer hash (xorshift-multiply). Deterministic on every WebGL2 implementation because it
// only uses uint multiply, xor and shifts.
uint uhash(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
uint uhash2(uvec2 v) { return uhash(v.x ^ uhash(v.y + 0x9e3779b9u)); }
uint uhash3(uvec3 v) { return uhash(v.x ^ uhash(v.y ^ uhash(v.z + 0x85ebca6bu))); }
float unit(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }
float hashCell(ivec2 c, uint seed) { return unit(uhash3(uvec3(uint(c.x), uint(c.y), seed))); }
float hashCell3(ivec3 c, uint seed) { return unit(uhash(uhash3(uvec3(c)) ^ seed)); }

vec2 quintic(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
vec3 quintic(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

// Value noise in [-1, 1].
float vnoise(vec2 p, uint seed) {
  ivec2 i = ivec2(floor(p)); vec2 f = quintic(fract(p));
  float a = hashCell(i, seed), b = hashCell(i + ivec2(1, 0), seed);
  float c = hashCell(i + ivec2(0, 1), seed), d = hashCell(i + ivec2(1, 1), seed);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
}
float vnoise(vec3 p, uint seed) {
  ivec3 i = ivec3(floor(p)); vec3 f = quintic(fract(p));
  float n000 = hashCell3(i, seed), n100 = hashCell3(i + ivec3(1, 0, 0), seed);
  float n010 = hashCell3(i + ivec3(0, 1, 0), seed), n110 = hashCell3(i + ivec3(1, 1, 0), seed);
  float n001 = hashCell3(i + ivec3(0, 0, 1), seed), n101 = hashCell3(i + ivec3(1, 0, 1), seed);
  float n011 = hashCell3(i + ivec3(0, 1, 1), seed), n111 = hashCell3(i + ivec3(1, 1, 1), seed);
  float x00 = mix(n000, n100, f.x), x10 = mix(n010, n110, f.x), x01 = mix(n001, n101, f.x), x11 = mix(n011, n111, f.x);
  return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z) * 2.0 - 1.0;
}
float fbm(vec3 p, int octaves, uint seed) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * vnoise(p, seed + uint(i) * 101u);
    p = p * 2.02 + vec3(17.1, 9.3, 4.7);
    amp *= 0.5;
  }
  return sum;
}
// Divergence-free flow direction from the gradient of a scalar noise field.
vec2 curl(vec2 p, float z, uint seed) {
  const float e = 0.02;
  float n1 = vnoise(vec3(p + vec2(0.0, e), z), seed), n2 = vnoise(vec3(p - vec2(0.0, e), z), seed);
  float n3 = vnoise(vec3(p + vec2(e, 0.0), z), seed), n4 = vnoise(vec3(p - vec2(e, 0.0), z), seed);
  return vec2(n1 - n2, n4 - n3) / (2.0 * e);
}

// Ordered-dither thresholds in [0, 1).
float bayer2(ivec2 p) { int x = p.x & 1, y = p.y & 1; return float((x ^ y) * 2 + y) / 4.0; }
float bayer4(ivec2 p) { return (bayer2(p / 2) + bayer2(p) * 4.0) / 4.0; }
float bayer8(ivec2 p) { return (bayer4(p / 2) + bayer2(p) * 16.0) / 4.0; }
`;
