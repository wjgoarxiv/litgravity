// GPU-instanced anti-aliased capsule segments in logical 2D pixel space (origin top-left, y down),
// one draw call per batch. Adapted from mexicat/pdoom-video app/src/engine/lines.ts (MIT, see
// ../NOTICE), reduced to the 2D case the look library needs (hairline rules, meters, strokes).
import { SCALE, W, H } from "./gl.mjs";

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 seg;
layout(location = 2) in vec4 color;
layout(location = 3) in float width;
uniform vec2 res; uniform float pxScale;
out vec2 vLocal; out float vLen; out float vHalf; out vec4 vColor;
void main() {
  vec2 a = seg.xy * pxScale, b = seg.zw * pxScale;
  float w = width * pxScale;
  float hw = max(w * 0.5, 0.35) + 1.0;
  vec2 d = b - a; float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float along = mix(-hw, len + hw, corner.x);
  vec2 p = a + dir * along + nrm * corner.y * hw;
  vec2 physical = res * pxScale;
  gl_Position = vec4(p.x / physical.x * 2.0 - 1.0, 1.0 - p.y / physical.y * 2.0, 0.0, 1.0);
  vLocal = vec2(along, corner.y * hw);
  vLen = len; vHalf = max(w * 0.5, 0.35);
  vColor = color * vec4(1.0, 1.0, 1.0, min(1.0, w / 0.7));
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vLocal; in float vLen; in float vHalf; in vec4 vColor;
out vec4 fragColor;
void main() {
  float x = clamp(vLocal.x, 0.0, vLen);
  float d = length(vec2(vLocal.x - x, vLocal.y)) - vHalf;
  float a = clamp(0.5 - d, 0.0, 1.0) * vColor.a;
  if (a <= 0.0) discard;
  fragColor = vec4(vColor.rgb * a, a);
}`;

export class LineBatch {
  constructor(glw, capacity = 256) {
    this.glw = glw;
    const gl = glw.gl;
    this.capacity = capacity;
    this.data = new Float32Array(capacity * 9);
    this.count = 0;
    const compile = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`line shader: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    this.program = gl.createProgram();
    gl.attachShader(this.program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(`line program: ${gl.getProgramInfoLog(this.program)}`);
    this.uRes = gl.getUniformLocation(this.program, "res");
    this.uScale = gl.getUniformLocation(this.program, "pxScale");
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.instances = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const stride = 9 * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 32);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
  }
  clear() {
    this.count = 0;
  }
  /** Segment from (x0, y0) to (x1, y1) in logical px; colour is linear RGB plus alpha. */
  segment(x0, y0, x1, y1, width, rgb, alpha = 1) {
    if (this.count >= this.capacity) throw new Error(`LineBatch capacity ${this.capacity} exceeded`);
    this.data.set([x0, y0, x1, y1, rgb[0], rgb[1], rgb[2], alpha, width], this.count * 9);
    this.count += 1;
  }
  /** Draw every queued segment over `target` in one instanced call. Returns the draw count (0|1). */
  draw(target, { pass = null } = {}) {
    if (this.count === 0) return 0;
    const { glw } = this;
    const gl = glw.gl;
    glw.bind(target);
    gl.useProgram(this.program);
    gl.uniform2f(this.uRes, W, H);
    gl.uniform1f(this.uScale, SCALE);
    glw.blend("normal");
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * 9);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);
    if (pass) glw.tracker.draw(pass, { segments: this.count });
    return 1;
  }
}
