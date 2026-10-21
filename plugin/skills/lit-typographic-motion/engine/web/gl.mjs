// Raw WebGL2 plumbing: HDR render targets, full-screen shader passes, a compositor and Canvas2D
// layers uploaded as sRGB textures. Re-expressed without three.js from the mechanism of
// mexicat/pdoom-video app/src/engine/gl.ts (MIT, see ../NOTICE).
//
// Every look-library pass draws through `Pass.draw`, the one uniform-setter wrapper: it records
// the uniforms and counts draws per pass for the render log (MO-SH-00a), so no pass can draw
// without leaving a trace the gate can check.
import { GLSL_COMMON } from "./glsl-common.mjs";
import { SCALE, W, H, PW, PH } from "./scale.mjs";

export { SCALE, W, H, PW, PH };

const VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Per-frame render-log recorder shared by every pass. */
export class Tracker {
  constructor() {
    this.frame = new Map();
    this.recordUniforms = true;
  }
  reset() {
    this.frame = new Map();
  }
  entry(pass) {
    let e = this.frame.get(pass);
    if (!e) {
      e = { draws: 0, uniforms: {} };
      this.frame.set(pass, e);
    }
    return e;
  }
  draw(pass, uniforms) {
    const e = this.entry(pass);
    e.draws += 1;
    if (this.recordUniforms) {
      for (const [name, value] of Object.entries(uniforms)) {
        if (value && typeof value === "object" && value.isTexture) continue;
        e.uniforms[name] = Array.isArray(value) ? value.map((v) => +(+v).toFixed(6)) : typeof value === "number" ? +value.toFixed(6) : value;
      }
    }
  }
  lines() {
    return [...this.frame.entries()].map(([pass, e]) => ({ pass, draws: e.draws, uniforms: e.uniforms }));
  }
}

export class GL {
  constructor(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("NO_WEBGL2: canvas.getContext('webgl2') returned null");
    if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("NO_WEBGL2: EXT_color_buffer_float is unavailable, so HDR render targets cannot be drawn");
    this.gl = gl;
    this.canvas = canvas;
    this.vao = gl.createVertexArray();
    this.tracker = new Tracker();
    this.programs = new Map();
  }

  renderer() {
    const gl = this.gl;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown (debug-info extension unavailable)";
  }

  /** A render target in physical px. `format` is "half" (RGBA16F, linear HDR) or "rgba8". */
  target(width = PW, height = PH, format = "half") {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (format === "half") gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, width, height);
    else gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`framebuffer incomplete (${status}) for ${format} ${width}x${height}`);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex: { isTexture: true, handle: tex }, width, height, format };
  }

  bind(target) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.width : PW, target ? target.height : PH);
  }

  clear(target, rgb = [0, 0, 0], alpha = 0) {
    const gl = this.gl;
    this.bind(target);
    gl.disable(gl.BLEND);
    gl.clearColor(rgb[0], rgb[1], rgb[2], alpha);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  program(frag) {
    const cached = this.programs.get(frag);
    if (cached) return cached;
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`shader compile failed: ${gl.getShaderInfoLog(shader)}`);
      return shader;
    };
    const fragSource = `#version 300 es\nprecision highp float;\nprecision highp int;\nin vec2 vUv;\nout vec4 fragColor;\n${GLSL_COMMON}\n${frag}`;
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`);
    const uniforms = new Map();
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      const name = info.name.replace(/\[0\]$/u, "");
      uniforms.set(name, { location: gl.getUniformLocation(program, info.name), type: info.type, size: info.size });
    }
    const entry = { program, uniforms };
    this.programs.set(frag, entry);
    return entry;
  }

  setUniforms(entry, values) {
    const gl = this.gl;
    let unit = 0;
    for (const [name, value] of Object.entries(values)) {
      const u = entry.uniforms.get(name);
      if (!u) continue;
      const v = typeof value === "boolean" ? (value ? 1 : 0) : value;
      switch (u.type) {
        case gl.FLOAT: gl.uniform1f(u.location, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.location, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(u.location, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(u.location, v); break;
        case gl.INT: case gl.BOOL: gl.uniform1i(u.location, v); break;
        case gl.UNSIGNED_INT: gl.uniform1ui(u.location, v >>> 0); break;
        case gl.SAMPLER_2D:
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, v ? v.handle : null);
          gl.uniform1i(u.location, unit);
          unit += 1;
          break;
        default: throw new Error(`unsupported uniform type for ${name}`);
      }
    }
  }

  blend(mode) {
    const gl = this.gl;
    if (mode === "replace") {
      gl.disable(gl.BLEND);
      return;
    }
    gl.enable(gl.BLEND);
    if (mode === "normal") {
      // Premultiplied colour over the target; the target's alpha (glyph coverage) is kept.
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    } else if (mode === "glyph") {
      // Glyph ink: colour over, coverage = max(target, glyph) so alpha carries the glyph mask.
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.MAX);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
    } else if (mode === "add") {
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
    } else throw new Error(`unknown blend mode ${mode}`);
  }

  /** Download a target's RGBA8 pixels through a pixel-pack buffer and a fence (no GPU stall). */
  async readPixelsAsync(target, out) {
    const gl = this.gl;
    const bytes = target.width * target.height * 4;
    const buffer = out ?? new Uint8Array(bytes);
    if (!this.pbo || this.pboBytes !== bytes) {
      if (this.pbo) gl.deleteBuffer(this.pbo);
      this.pbo = gl.createBuffer();
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, bytes, gl.STREAM_READ);
      this.pboBytes = bytes;
    }
    this.bind(target);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    for (;;) {
      const state = gl.clientWaitSync(sync, 0, 0);
      if (state === gl.ALREADY_SIGNALED || state === gl.CONDITION_SATISFIED) break;
      if (state === gl.WAIT_FAILED) throw new Error("clientWaitSync failed during pixel readback");
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    gl.deleteSync(sync);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, buffer);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    return buffer;
  }
}

/**
 * A full-screen fragment pass. `frag` declares its uniforms and writes `fragColor`; `vUv` (0..1,
 * y up) and GLSL_COMMON are provided. `pass` names the look-library pass it belongs to (null for
 * engine plumbing); only named passes are logged.
 */
export class Pass {
  constructor(glw, frag, { pass = null } = {}) {
    this.glw = glw;
    this.frag = frag;
    this.pass = pass;
    this.entry = glw.program(frag);
  }
  draw(target, uniforms = {}, { blend = "replace" } = {}) {
    const { glw } = this;
    const gl = glw.gl;
    glw.bind(target);
    gl.useProgram(this.entry.program);
    glw.setUniforms(this.entry, uniforms);
    glw.blend(blend);
    gl.bindVertexArray(glw.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    if (this.pass) glw.tracker.draw(this.pass, uniforms);
  }
}

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D src; uniform float opacity; uniform vec3 tint;
void main() {
  // Canvas2D layers are uploaded unpremultiplied as SRGB8_ALPHA8, so RGB arrives already linear
  // and is premultiplied here.
  vec4 c = texture(src, vUv);
  float a = c.a * opacity;
  fragColor = vec4(c.rgb * tint * a, a);
}`;

/** Draws a texture over a target: `normal` keeps the target's glyph mask, `glyph` adds to it. */
export class Compositor {
  constructor(glw) {
    this.pass = new Pass(glw, COMPOSITE_FRAG);
  }
  draw(texture, target, { mode = "normal", opacity = 1, tint = [1, 1, 1], logAs = null } = {}) {
    this.pass.pass = logAs;
    this.pass.draw(target, { src: texture, opacity, tint }, { blend: mode });
    this.pass.pass = null;
  }
}

/**
 * A logical 1920x1080 Canvas2D surface uploaded as an sRGB texture. The context is CPU-backed
 * (willReadFrequently) so its rasterization does not depend on GPU raster scheduling, and it is
 * pre-scaled so drawing code works in logical px at every output scale.
 */
export class Layer2D {
  constructor(glw, width = W, height = H) {
    this.glw = glw;
    this.width = width;
    this.height = height;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.round(width * SCALE);
    this.canvas.height = Math.round(height * SCALE);
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true, alpha: true });
    const gl = glw.gl;
    this.handle = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.SRGB8_ALPHA8, this.canvas.width, this.canvas.height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texture = { isTexture: true, handle: this.handle };
    this.clear();
  }
  clear() {
    const c = this.ctx;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.filter = "none";
    c.shadowBlur = 0;
    c.clearRect(0, 0, this.width, this.height);
  }
  upload() {
    const gl = this.glw.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return this.texture;
  }
  /** Re-upload only a logical-px rectangle of the canvas (the rest of the texture is kept). */
  uploadRegion(x, y, w, h) {
    const gl = this.glw.gl;
    const px = Math.max(0, Math.floor(x * SCALE));
    const py = Math.max(0, Math.floor(y * SCALE));
    const pw = Math.min(this.canvas.width - px, Math.ceil((x + w) * SCALE) - px);
    const ph = Math.min(this.canvas.height - py, Math.ceil((y + h) * SCALE) - py);
    const region = this.ctx.getImageData(px, py, pw, ph);
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, px, this.canvas.height - py - ph, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, region);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return this.texture;
  }
}
