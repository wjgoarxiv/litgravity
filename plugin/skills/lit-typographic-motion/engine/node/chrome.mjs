// Headless Chrome over the DevTools pipe transport (fd 3/4, NUL-delimited JSON), so no control
// port ever listens. Re-expresses the driver mechanism of mexicat/pdoom-video app/scripts/render.ts
// (MIT, see ../NOTICE) without a driver package. Launch walks the MO-A-51 flag ladder and a rung
// only counts when a real page gets a WebGL2 context; the page is served from disk through CDP
// Fetch interception, so nothing listens for it either.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { CHROME_ALWAYS, CHROME_RUNGS, EXIT, UNKNOWN_RENDERER } from "../core/constants.mjs";
import { which } from "./host.mjs";

export class BlockedError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const CANDIDATES = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    path.join(homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
  ],
  linux: ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

/** Resolve Chrome: $CHROME_PATH, then the platform's usual locations. Returns null when absent. */
export function findChrome(env = process.env) {
  if (env.CHROME_PATH) return existsSync(env.CHROME_PATH) ? env.CHROME_PATH : null;
  for (const candidate of CANDIDATES[process.platform] ?? []) {
    if (path.isAbsolute(candidate)) {
      if (existsSync(candidate)) return candidate;
    } else {
      const found = which(candidate);
      if (found) return found;
    }
  }
  return null;
}

export function chromeVersion(chrome) {
  const probe = spawnSync(chrome, ["--version"], { encoding: "utf8", timeout: 15000 });
  return probe.status === 0 ? probe.stdout.trim() : `unknown (${(probe.stderr || probe.error?.message || "").trim().split(/\r?\n/u)[0]})`;
}

/**
 * The stage path's flag set (director brief 6d): the software rung (SwiftShader) by default, or the
 * platform's GPU rung for a 3D film (WebGL on the GPU; page raster stays on the CPU either way), the compositor and animation flags that keep a captured frame a function of the page's state,
 * sRGB at scale 1, the window at the format's size, no background networking, and a resolver rule
 * that leaves only the synthetic stage origin resolvable.
 */
export function stageFlags({ width, height, rung = "software" }) {
  const base = rung === "gpu" ? CHROME_RUNGS[process.platform]?.[0]?.filter((f) => f !== "--enable-gpu-rasterization") : CHROME_RUNGS.software;
  if (!base) throw new Error(`no GPU rung on ${process.platform}`);
  return [
    ...base, "--disable-gpu-rasterization", "--disable-partial-raster",
    "--run-all-compositor-stages-before-draw", "--disable-checker-imaging", "--disable-new-content-rendering-timeout",
    "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-image-animation-resync", "--disable-lcd-text",
    "--force-color-profile=srgb", "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1", `--window-size=${width},${height}`,
    "--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-pings", "--metrics-recording-only",
    "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE lit.stage",
    ...CHROME_ALWAYS,
  ];
}

/** The ladder for this platform: GPU rung(s) first, SwiftShader last (MO-A-51). */
export function flagLadder({ softwareOnly = false } = {}) {
  const gpu = CHROME_RUNGS[process.platform] ?? [];
  const rungs = softwareOnly ? [CHROME_RUNGS.software] : [...gpu, CHROME_RUNGS.software];
  return rungs.map((rung) => [...rung, ...CHROME_ALWAYS]);
}

// Messages arrive as raw bytes: each chunk is scanned once for the NUL terminator and kept as a
// Buffer until its message is complete, so a large screenshot never rescans what came before and a
// multi-byte character split across two chunks is decoded whole.
export class Pipe {
  constructor(child) {
    this.child = child;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.parts = [];
    this.closed = false;
    child.stdio[4].on("data", (chunk) => this.receive(chunk));
    child.stdio[4].on("error", () => {});
    child.stdio[3].on("error", () => {});
    child.on("exit", () => {
      this.closed = true;
      for (const { reject } of this.pending.values()) reject(new Error("Chrome exited"));
      this.pending.clear();
    });
  }
  receive(chunk) {
    let start = 0;
    for (;;) {
      const end = chunk.indexOf(0, start);
      if (end < 0) {
        if (start < chunk.length) this.parts.push(chunk.subarray(start));
        return;
      }
      this.parts.push(chunk.subarray(start, end));
      start = end + 1;
      const message = JSON.parse(Buffer.concat(this.parts).toString("utf8"));
      this.parts = [];
      if (message.id !== undefined && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ""}`));
        else resolve(message.result);
      } else if (message.method) {
        for (const fn of this.listeners.get(message.method) ?? []) fn(message.params, message.sessionId);
      }
    }
  }
  send(method, params = {}, sessionId) {
    if (this.closed) return Promise.reject(new Error("Chrome pipe closed"));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
}

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms).unref()),
]);

const CONTENT_TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".ttf": "font/ttf", ".otf": "font/otf", ".svg": "image/svg+xml" };

// A loopback origin: the page may then open its WebSocket to 127.0.0.1 without tripping Chrome's
// private-network rules. Every request to it is fulfilled by Fetch interception, so nothing is
// ever sent to a real localhost server.
export const APP_ORIGIN = "http://localhost";

/**
 * One headless Chrome with one page. `routes(pathname)` returns a file path or { body, type } for a
 * request under APP_ORIGIN, or null for 404.
 */
/**
 * The full argument list for one headless launch. `--use-mock-keychain` and `--password-store=basic`
 * keep Chrome away from the OS keychain: with a fresh profile (or an isolated HOME) it would
 * otherwise look for its safe-storage item and macOS would put a keychain dialog on screen.
 */
export function launchArgs(profileDir, flags) {
  return [
    "--headless", `--user-data-dir=${profileDir}`, "--remote-debugging-pipe", "--no-first-run", "--no-default-browser-check",
    "--use-mock-keychain", "--password-store=basic",
    "--disable-extensions", "--hide-scrollbars", "--mute-audio", ...flags, "about:blank",
  ];
}

export class ChromeSession {
  static async launch({ chrome, flags, profileDir, routes, timeoutMs = 30000 }) {
    mkdirSync(profileDir, { recursive: true });
    const args = launchArgs(profileDir, flags);
    let child;
    try {
      child = spawn(chrome, args, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
    } catch (error) {
      throw new BlockedError(EXIT.BLOCKED_NO_CHROME, `BLOCKED_NO_CHROME: Chrome failed to launch: ${error.message}`);
    }
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    const spawnError = new Promise((_, reject) => child.on("error", (error) => reject(error)));
    const session = new ChromeSession(child, profileDir, routes, flags);
    try {
      await withTimeout(Promise.race([session.pipe.send("Browser.getVersion"), spawnError]), timeoutMs, "Chrome did not answer on the DevTools pipe");
    } catch (error) {
      session.kill();
      const first = stderr.split("\n").map((l) => l.trim()).find(Boolean) ?? error.message;
      throw new BlockedError(EXIT.BLOCKED_NO_CHROME, `BLOCKED_NO_CHROME: Chrome failed to launch headless: ${first}`);
    }
    session.stderr = () => stderr;
    return session;
  }

  constructor(child, profileDir, routes, flags) {
    this.child = child;
    this.profileDir = profileDir;
    this.routes = routes;
    this.flags = flags;
    this.pipe = new Pipe(child);
    this.logs = [];
  }

  async openPage() {
    const { targetId } = await this.pipe.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await this.pipe.send("Target.attachToTarget", { targetId, flatten: true });
    this.sessionId = sessionId;
    this.pipe.on("Runtime.exceptionThrown", (p) => this.logs.push(`[exception] ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`));
    this.pipe.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error" || p.type === "warning") this.logs.push(`[${p.type}] ${p.args.map((a) => a.value ?? a.description).join(" ")}`);
    });
    this.pipe.on("Fetch.requestPaused", (p, sid) => this.serve(p, sid));
    // Chrome gates a page's connections to 127.0.0.1 behind a loopback-network permission; grant
    // it for the app origin only (older builds do not know the name, which is fine).
    await this.pipe.send("Browser.grantPermissions", { permissions: ["loopbackNetwork"], origin: APP_ORIGIN }).catch(() => {});
    await this.send("Runtime.enable");
    await this.send("Fetch.enable", { patterns: [{ urlPattern: `${APP_ORIGIN}/*`, requestStage: "Request" }] });
    await this.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  }

  async serve(params, sid) {
    const url = new URL(params.request.url);
    let resolved = null;
    try {
      resolved = this.routes(decodeURIComponent(url.pathname));
    } catch {
      resolved = null;
    }
    try {
      if (!resolved) {
        await this.pipe.send("Fetch.fulfillRequest", { requestId: params.requestId, responseCode: 404, body: "" }, sid);
        return;
      }
      const body = typeof resolved === "string" ? readFileSync(resolved) : Buffer.from(resolved.body);
      const type = typeof resolved === "string" ? CONTENT_TYPES[path.extname(resolved)] ?? "application/octet-stream" : resolved.type;
      await this.pipe.send("Fetch.fulfillRequest", {
        requestId: params.requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: type }, { name: "Cache-Control", value: "no-store" }],
        body: body.toString("base64"),
      }, sid);
    } catch (error) {
      this.logs.push(`[serve] ${url.pathname}: ${error.message}`);
    }
  }

  send(method, params = {}) {
    return this.pipe.send(method, params, this.sessionId);
  }

  /** Evaluate an expression in the page; resolves promises and returns the JSON value. */
  async evaluate(expression, { timeoutMs = 600000 } = {}) {
    const result = await withTimeout(this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }), timeoutMs, `page evaluation timed out: ${expression.slice(0, 80)}`);
    if (result.exceptionDetails) throw new Error(`page error: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    return result.result.value;
  }

  /** WebGL2 in a blank page: { webgl2, renderer } (MO-A-51 rung check). */
  async probeWebgl2() {
    return this.evaluate(`(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return { webgl2: false, renderer: null };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { webgl2: true, renderer: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ${JSON.stringify(UNKNOWN_RENDERER)} };
    })()`);
  }

  async navigate(url) {
    await this.send("Page.enable");
    await this.send("Page.navigate", { url });
  }

  kill() {
    try {
      this.child.kill("SIGKILL");
    } catch {
      // already gone
    }
  }

  async close() {
    try {
      await withTimeout(this.pipe.send("Browser.close"), 5000, "close timed out");
    } catch {
      this.kill();
    }
    const exited = (ms) => new Promise((resolve) => {
      if (this.child.exitCode !== null || this.child.signalCode) resolve();
      else this.child.once("exit", resolve);
      setTimeout(resolve, ms).unref();
    });
    await exited(5000);
    // A browser that acknowledged Browser.close but is still alive would keep this process open.
    if (this.child.exitCode === null && !this.child.signalCode) {
      this.kill();
      await exited(2000);
    }
    rmSync(this.profileDir, { recursive: true, force: true });
  }
}

/**
 * Walk the ladder: launch, check WebGL2 in a real page, keep the first rung that has it. Throws
 * BlockedError 10 when Chrome itself cannot run, 11 when Chrome runs on every rung but no WebGL2.
 */
export async function launchWithLadder({ chrome, profileRoot, routes, softwareOnly = false, log = () => {} }) {
  if (!chrome) throw new BlockedError(EXIT.BLOCKED_NO_CHROME, "BLOCKED_NO_CHROME: Chrome/Chromium not found (set CHROME_PATH or install Google Chrome)");
  const failures = [];
  let index = 0;
  for (const flags of flagLadder({ softwareOnly })) {
    const profileDir = path.join(profileRoot, `c${process.pid % 100000}-${index++}`);
    let session;
    try {
      session = await ChromeSession.launch({ chrome, flags, profileDir, routes });
    } catch (error) {
      rmSync(profileDir, { recursive: true, force: true });
      if (error instanceof BlockedError) throw error;
      throw new BlockedError(EXIT.BLOCKED_NO_CHROME, `BLOCKED_NO_CHROME: ${error.message}`);
    }
    try {
      await session.openPage();
      const probe = await session.probeWebgl2();
      if (probe.webgl2) {
        log(`chrome rung ok: ${flags.join(" ")} -> ${probe.renderer}`);
        return { session, flags, renderer: probe.renderer };
      }
      failures.push(`${flags[0]}: getContext('webgl2') returned null`);
    } catch (error) {
      failures.push(`${flags[0]}: ${error.message}`);
    }
    await session.close();
  }
  throw new BlockedError(EXIT.BLOCKED_NO_WEBGL2, `BLOCKED_NO_WEBGL2: Chrome ran but no rung produced a WebGL2 context (${failures.join("; ")})`);
}
