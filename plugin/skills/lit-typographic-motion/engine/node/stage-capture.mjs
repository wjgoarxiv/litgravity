// One stage browser: headless Chrome on the software rung with the stage flag set, the page served
// by Fetch interception on http://lit.stage, the virtual-clock init script injected before any page
// script, and a step/capture pair the renderer calls frame by frame. The master, the determinism
// replay and the text-QA replay each open their own StageBrowser; none of them ever seeks.
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { EXIT } from "../core/constants.mjs";
import { BlockedError, ChromeSession, findChrome, stageFlags } from "./chrome.mjs";
import { INIT_FILE, STAGE_ORIGIN, stageRouter } from "./stage-serve.mjs";

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms).unref()),
]);

export class StageBrowser {
  static async open({ stageDir, faces, rasters = [], width, height, seed, profileDir, env = process.env, log = () => {} }) {
    const chrome = findChrome(env);
    if (!chrome) throw new BlockedError(EXIT.BLOCKED_NO_CHROME, "BLOCKED_NO_CHROME: Chrome/Chromium not found (set CHROME_PATH or install Google Chrome)");
    const flags = stageFlags({ width, height });
    const session = await ChromeSession.launch({ chrome, flags, profileDir, routes: () => null });
    const browser = new StageBrowser(session, { stageDir, faces, width, height, flags, log });
    try {
      await browser.#attach(seed);
      await browser.#load(rasters);
    } catch (error) {
      await browser.close();
      throw error;
    }
    return browser;
  }

  constructor(session, { stageDir, faces, width, height, flags, log }) {
    this.session = session;
    this.width = width;
    this.height = height;
    this.flags = flags;
    this.faces = faces;
    this.log = log;
    this.router = stageRouter({ stageDir, faces });
    this.served = [];
  }

  send(method, params = {}) {
    return this.session.pipe.send(method, params, this.sessionId);
  }

  async evaluate(expression, { timeoutMs = 120000 } = {}) {
    const result = await withTimeout(this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }), timeoutMs, `stage page evaluation timed out: ${expression.slice(0, 60)}`);
    if (result.exceptionDetails) throw new Error(`stage page error: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    return result.result.value;
  }

  async #attach(seed) {
    const pipe = this.session.pipe;
    const { targetId } = await pipe.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await pipe.send("Target.attachToTarget", { targetId, flatten: true });
    this.sessionId = sessionId;
    pipe.on("Fetch.requestPaused", (p, sid) => {
      if (sid === sessionId) this.#serve(p);
    });
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Emulation.setDeviceMetricsOverride", { width: this.width, height: this.height, deviceScaleFactor: 1, mobile: false });
    await this.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
    const init = readFileSync(INIT_FILE, "utf8").replaceAll("__LIT_SEED__", String(seed >>> 0));
    await this.send("Page.addScriptToEvaluateOnNewDocument", { source: init });
  }

  async #serve(params) {
    const url = params.request.url;
    const answer = this.router.route(url);
    try {
      if (answer.kind === "blocked") {
        await this.send("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" });
        return;
      }
      if (answer.kind === "missing") {
        await this.send("Fetch.fulfillRequest", { requestId: params.requestId, responseCode: 404, body: "" });
        return;
      }
      const body = answer.kind === "file" ? readFileSync(answer.file) : Buffer.from(answer.body);
      this.served.push(new URL(url).pathname);
      await this.send("Fetch.fulfillRequest", {
        requestId: params.requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: answer.type }, { name: "Cache-Control", value: "no-store" }],
        body: body.toString("base64"),
      });
    } catch (error) {
      this.log(`stage serve ${url}: ${error.message}`);
    }
  }

  async #load(rasters) {
    await this.send("Page.navigate", { url: `${STAGE_ORIGIN}/index.html` });
    const deadline = Date.now() + 60000;
    for (;;) {
      const ready = await this.evaluate("document.readyState").catch(() => "loading");
      if (ready === "complete") break;
      if (Date.now() > deadline) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, "STAGE_CONTRACT_ERROR: the stage page did not finish loading within 60 s");
      await new Promise((r) => setTimeout(r, 50));
    }
    // A variable face declares a weight range ("100 800"); a font shorthand takes one weight.
    const faces = this.faces.map((f) => ({ descriptor: `${String(f.weight).split(" ")[0]} 32px "${f.family}"`, sample: f.family === "Pretendard" || f.family === "Galmuri9" ? "Aa가" : "Aa" }));
    const images = rasters.map((r) => `/${r.rel.split(path.sep).map(encodeURIComponent).join("/")}`);
    this.prepared = await this.evaluate(`window.__litPrepare(${JSON.stringify({ faces, images })})`);
    this.state = await this.evaluate("window.__litStageState()");
  }

  /** Step to frame f (steps 1-7 of the per-frame algorithm run in the page). */
  step(f, fps, { paint = true } = {}) {
    return this.evaluate(`window.__litStep(${f}, ${fps}, { paint: ${paint} })`);
  }

  /** Step 8: capture the viewport; the decoded size is checked by the caller. */
  async capture() {
    const shot = await this.send("Page.captureScreenshot", {
      format: "png", optimizeForSpeed: true, captureBeyondViewport: false, fromSurface: true,
      clip: { x: 0, y: 0, width: this.width, height: this.height, scale: 1 },
    });
    return Buffer.from(shot.data, "base64");
  }

  pageState() {
    return this.evaluate("window.__litStageState()");
  }

  async close() {
    await this.session.close();
  }
}

/** A small pool of frame-analysis workers; results come back in submission order. */
export class FramePool {
  constructor(size = Math.max(2, Math.min(6, cpus().length - 2))) {
    this.workers = Array.from({ length: size }, () => new Worker(new URL("./frame-worker.mjs", import.meta.url)));
    this.next = 0;
    this.id = 0;
    this.waiting = new Map();
    for (const w of this.workers) {
      w.on("message", (msg) => {
        const done = this.waiting.get(msg.id);
        this.waiting.delete(msg.id);
        if (msg.error) done.reject(new Error(msg.error));
        else done.resolve({ ...msg, rgba: Buffer.from(msg.rgba) });
      });
      w.on("error", (error) => {
        for (const p of this.waiting.values()) p.reject(error);
        this.waiting.clear();
      });
    }
  }

  analyze(png, width, height) {
    const id = ++this.id;
    const worker = this.workers[this.next++ % this.workers.length];
    const copy = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength);
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      worker.postMessage({ id, png: copy, width, height }, [copy]);
    });
  }

  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}

/** Analyse one capture; a decoded size that is not the format's is exit 17. */
export async function analyzeChecked(pool, png, width, height) {
  try {
    return await pool.analyze(png, width, height);
  } catch (error) {
    if (/^captured \d+x\d+/u.test(error.message)) throw new BlockedError(EXIT.STAGE_CONTRACT_ERROR, `STAGE_CONTRACT_ERROR: ${error.message}`);
    throw error;
  }
}
