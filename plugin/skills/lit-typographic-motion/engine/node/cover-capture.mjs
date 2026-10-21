// Cover capture: one headless Chrome on the stage path's software rung, laid out at the cover's CSS
// size and captured at twice that (device scale 2), the page served from disk on the synthetic stage
// origin, the cover init script injected before any page script. The renderer SEEKS: it calls
// window.renderFrame(t, { mask }) for any t in [0, 1) in any order, captures, and a worker pool
// downsamples each capture to the cover size. The master, the determinism pass and the seek-order
// check each open their own CoverBrowser.
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";
import { EXIT } from "../core/constants.mjs";
import { BlockedError, ChromeSession, findChrome, stageFlags } from "./chrome.mjs";
import { COVER_INIT_FILE, STAGE_ORIGIN, stageRouter } from "./stage-serve.mjs";

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms).unref()),
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The stage flag set at the cover's device scale. */
export const coverFlags = ({ width, height, scale }) => stageFlags({ width, height }).map((f) => (f === "--force-device-scale-factor=1" ? `--force-device-scale-factor=${scale}` : f));

export class CoverBrowser {
  static async open({ stageDir, faces, width, height, scale, profileDir, env = process.env, log = () => {}, page = "index.html" }) {
    const chrome = findChrome(env);
    if (!chrome) throw new BlockedError(EXIT.BLOCKED_NO_CHROME, "BLOCKED_NO_CHROME: Chrome/Chromium not found (set CHROME_PATH or install Google Chrome)");
    const session = await ChromeSession.launch({ chrome, flags: coverFlags({ width, height, scale }), profileDir, routes: () => null });
    const browser = new CoverBrowser(session, { stageDir, faces, width, height, scale, log });
    try {
      await browser.#attach();
      await browser.#load(page);
    } catch (error) {
      await browser.close();
      throw error;
    }
    return browser;
  }

  constructor(session, { stageDir, faces, width, height, scale, log }) {
    this.session = session;
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.log = log;
    this.router = stageRouter({ stageDir, faces });
    this.errors = [];
  }

  send(method, params = {}) {
    return this.session.pipe.send(method, params, this.sessionId);
  }

  async evaluate(expression, { timeoutMs = 120000 } = {}) {
    const result = await withTimeout(this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }), timeoutMs, `cover page evaluation timed out: ${expression.slice(0, 60)}`);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description?.split("\n")[0] ?? result.exceptionDetails.text);
    return result.result.value;
  }

  async #attach() {
    const pipe = this.session.pipe;
    const { targetId } = await pipe.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await pipe.send("Target.attachToTarget", { targetId, flatten: true });
    this.sessionId = sessionId;
    pipe.on("Fetch.requestPaused", (p, sid) => {
      if (sid === sessionId) this.#serve(p);
    });
    pipe.on("Runtime.exceptionThrown", (p, sid) => {
      if (sid === sessionId) this.errors.push(p.exceptionDetails?.exception?.description?.split("\n")[0] ?? p.exceptionDetails?.text ?? "error");
    });
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Emulation.setDeviceMetricsOverride", { width: this.width, height: this.height, deviceScaleFactor: this.scale, mobile: false });
    await this.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
    await this.send("Page.addScriptToEvaluateOnNewDocument", { source: readFileSync(COVER_INIT_FILE, "utf8") });
  }

  async #serve(params) {
    const answer = this.router.route(params.request.url);
    try {
      if (answer.kind === "blocked") await this.send("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" });
      else if (answer.kind === "missing") await this.send("Fetch.fulfillRequest", { requestId: params.requestId, responseCode: 404, body: "" });
      else {
        const body = answer.kind === "file" ? readFileSync(answer.file) : Buffer.from(answer.body);
        await this.send("Fetch.fulfillRequest", {
          requestId: params.requestId, responseCode: 200,
          responseHeaders: [{ name: "Content-Type", value: answer.type }, { name: "Cache-Control", value: "no-store" }],
          body: body.toString("base64"),
        });
      }
    } catch (error) {
      this.log(`cover serve ${params.request.url}: ${error.message}`);
    }
  }

  /** Throw the named exit for anything the page did that a cover page may not do. */
  async check(context) {
    if (this.router.refused.length) {
      const first = this.router.refused[0];
      throw new BlockedError(EXIT.STAGE_NETWORK_REQUEST, `STAGE_NETWORK_REQUEST: the cover page requested ${first.url.slice(0, 160)} (${first.reason}); everything is local`);
    }
    const misuse = await this.evaluate("window.__litCoverMisuse ? window.__litCoverMisuse() : []").catch(() => []);
    if (misuse.length) throw new BlockedError(EXIT.STAGE_NONDETERMINISTIC, `STAGE_NONDETERMINISTIC: the cover page called ${misuse.join(", ")}${context ? ` ${context}` : ""}; a cover frame is a function of t only (LitLoop.rng(seed) for layout)`);
  }

  async #load(page) {
    await this.send("Page.navigate", { url: `${STAGE_ORIGIN}/${page}` });
    const deadline = Date.now() + 60000;
    for (;;) {
      const state = await this.evaluate("[document.readyState, window.ready === true, typeof window.renderFrame]").catch(() => ["loading", false, "undefined"]);
      if (state[0] === "complete" && state[1]) {
        await this.check("while loading");
        if (state[2] !== "function") throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, "STAGE_CONTRACT_ERROR: the cover page set window.ready but defines no window.renderFrame(t)");
        return;
      }
      // A page that threw before it set window.ready will not recover: say so now, not after the 60 s wait.
      if (this.errors.length) {
        await this.check("while loading");
        throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: the cover page failed while loading; first page error: ${this.errors[0]}`);
      }
      if (Date.now() > deadline) {
        await this.check("while loading");
        const why = this.errors[0] ? `; first page error: ${this.errors[0]}` : state[0] === "complete" ? "; it never set window.ready = true" : "";
        throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: the cover page was not ready within 60 s${why}`);
      }
      await sleep(50);
    }
  }

  /** Draw loop time t (and the mask variant) and wait for the frame to settle. */
  async frame(t, { mask = false } = {}) {
    try {
      await this.evaluate(`(async () => { await window.renderFrame(${t}, ${JSON.stringify({ mask })}); if (document.fonts) await document.fonts.ready; return true; })()`);
    } catch (error) {
      await this.check(`at t = ${t.toFixed(4)}`);
      throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: renderFrame(${t.toFixed(4)}${mask ? ", { mask: true }" : ""}) threw: ${error.message}`);
    }
    await this.check(`at t = ${t.toFixed(4)}`);
  }

  /** The viewport at device scale: a PNG of (width x scale) by (height x scale). */
  async capture() {
    const shot = await this.send("Page.captureScreenshot", {
      format: "png", optimizeForSpeed: true, captureBeyondViewport: false, fromSurface: true,
      clip: { x: 0, y: 0, width: this.width, height: this.height, scale: 1 },
    });
    return Buffer.from(shot.data, "base64");
  }

  async close() {
    await this.session.close();
  }
}

/** Workers that downsample and write captured frames; results come back per job. */
export class CoverPool {
  constructor(size = Math.max(2, Math.min(6, cpus().length - 2))) {
    this.workers = Array.from({ length: size }, () => new Worker(new URL("./cover-worker.mjs", import.meta.url)));
    this.next = 0;
    this.id = 0;
    this.waiting = new Map();
    for (const w of this.workers) {
      w.on("message", (msg) => {
        const done = this.waiting.get(msg.id);
        this.waiting.delete(msg.id);
        if (msg.error) done.reject(new Error(msg.error));
        else done.resolve(msg);
      });
      w.on("error", (error) => {
        for (const p of this.waiting.values()) p.reject(error);
        this.waiting.clear();
      });
    }
  }

  process(png, width, height, file = null) {
    const id = ++this.id;
    const worker = this.workers[this.next++ % this.workers.length];
    const copy = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength);
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      worker.postMessage({ id, png: copy, width, height, file }, [copy]);
    });
  }

  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}

/**
 * Capture loop times `times` (an array of [index, t]) in the given order into `dir` as
 * `<prefix><index>.png` at the cover size. Returns Map index -> sha256 of the written PNG.
 */
export async function capturePass({ browser, pool, times, dir, prefix = "f", mask = false, width, height }) {
  const out = new Map();
  const pending = [];
  const expected = `${browser.width * browser.scale}x${browser.height * browser.scale}`;
  for (const [index, t] of times) {
    await browser.frame(t, { mask });
    const png = await browser.capture();
    const file = dir ? `${dir}/${prefix}${String(index).padStart(4, "0")}.png` : null;
    pending.push(pool.process(png, width, height, file).then((r) => {
      if (r.captured !== expected) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: captured ${r.captured}, expected ${expected} (the page must not resize its viewport)`);
      out.set(index, r.sha256);
    }));
  }
  await Promise.all(pending);
  return out;
}
