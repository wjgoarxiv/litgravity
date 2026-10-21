// Page bootstrap: load the render plan and fonts the driver serves, build the engine, and expose
// the small API the driver calls over CDP. Frames leave the page through the WebSocket egress
// when the driver opened one, or wait in memory for the driver to pull them over CDP (the
// sanctioned fallback when a sandbox forbids listening). Either way the bytes are the same
// readback buffer.
import { parse } from "/vendor/opentype.mjs";
import { Engine } from "./engine.mjs";

const api = { ready: false, error: null };
window.__litMotion = api;

class Egress {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.inflight = 0;
    this.waiters = [];
    this.pending = [];
    this.mode = "pull";
  }
  async open() {
    if (!this.url) return;
    await new Promise((resolve) => {
      const ws = new WebSocket(this.url);
      ws.binaryType = "arraybuffer";
      ws.onopen = () => { this.ws = ws; this.mode = "websocket"; resolve(); };
      ws.onerror = () => resolve();
      ws.onmessage = () => {
        this.inflight -= 1;
        const next = this.waiters.shift();
        if (next) next();
      };
    });
  }
  async emit(meta, bytes) {
    if (this.ws) {
      while (this.inflight >= 4) await new Promise((r) => this.waiters.push(r));
      this.inflight += 1;
      this.ws.send(JSON.stringify(meta));
      this.ws.send(bytes);
      return;
    }
    this.pending.push({ meta, bytes: bytes.slice() });
  }
  async drain() {
    while (this.ws && this.inflight > 0) await new Promise((r) => this.waiters.push(r));
  }
}

function toBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

try {
  const plan = await (await fetch("/run/plan.json")).json();
  const engine = new Engine(document.getElementById("gl"), plan, { opentype: { parse } });
  const fonts = await Promise.all(plan.fonts.map(async (meta) => ({ key: meta.key, meta, bytes: await (await fetch(`/fonts/${meta.key}`)).arrayBuffer() })));
  await engine.init(fonts);
  const egress = new Egress(plan.egress?.ws ?? null);
  await egress.open();
  const ring = Array.from({ length: 6 }, () => null);
  let slot = 0;
  const renderAndEmit = async (n, opts, tag) => {
    const meta = engine.renderFrame(n, opts);
    const buf = ring[slot] ?? (ring[slot] = new Uint8Array(engine.final.width * engine.final.height * 4));
    slot = (slot + 1) % ring.length;
    await engine.readFinal(buf);
    await egress.emit({ ...meta, tag, width: engine.final.width, height: engine.final.height }, buf);
    return meta;
  };
  Object.assign(api, {
    engine,
    info: () => ({
      renderer: engine.renderer, software: engine.software, frameCount: engine.frameCount, width: engine.final.width,
      height: engine.final.height, egress: egress.mode, passRanges: engine.passRanges(), shotEvents: engine.shotEvents(),
    }),
    /** Render frames [from, to) at `fps` and emit each. */
    async stream({ from, to, fps, samples, shutter, stillOverrides = null, tag }) {
      for (let n = from; n < to; n++) await renderAndEmit(n, { samples, shutter, stillOverrides, fps }, tag);
      await egress.drain();
      return to - from;
    },
    /** Render one frame and emit it. */
    async frame({ n, fps, samples, shutter, stillOverrides = null, tag }) {
      await renderAndEmit(n, { samples, shutter, stillOverrides, fps }, tag);
      await egress.drain();
      return true;
    },
    /** Pull-mode egress: the oldest pending frame as { meta, b64 }, or null. */
    pull() {
      const next = egress.pending.shift();
      return next ? { meta: next.meta, b64: toBase64(next.bytes) } : null;
    },
    /**
     * MO-D-02: ms from render call to readback complete, per frame, at samples 1. The film renders
     * frame after frame, so a sampled frame is timed as the next frame of a sequence: when the
     * previous sampled frame is not n - 1, frame n - 1 is rendered first, untimed. Otherwise every
     * sampled frame of a stateful shot would be timed with its preroll replay.
     */
    async perf({ frames, fps }) {
      const out = [];
      const buf = new Uint8Array(engine.final.width * engine.final.height * 4);
      let prev = null;
      for (const n of frames) {
        if (n > 0 && prev !== n - 1) {
          engine.renderFrame(n - 1, { samples: 1, shutter: 0.5, fps });
          await engine.readFinal(buf);
        }
        prev = n;
        const a = performance.now();
        engine.renderFrame(n, { samples: 1, shutter: 0.5, fps });
        await engine.readFinal(buf);
        out.push(performance.now() - a);
      }
      return out;
    },
    ready: true,
  });
} catch (error) {
  api.error = String(error?.stack ?? error);
}
