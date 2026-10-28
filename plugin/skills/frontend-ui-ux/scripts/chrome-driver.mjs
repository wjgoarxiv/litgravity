// Headless Chrome driver for the interface probe. Dependency-free: it spawns the Chrome or
// Chromium that is already installed and speaks the DevTools protocol over the WebSocket global
// of Node 22. Nothing is installed or downloaded. A missing browser or an old Node is a named
// blocker (`BLOCKED_BROWSER_DRIVER_UNAVAILABLE`), never a pass.
//
//   CHROME_PATH=<binary>             overrides discovery
//   LITGRAVITY_CHROME_NO_SANDBOX=1      adds --no-sandbox (only for a container or sandbox that needs it)
//
//   node chrome-driver.mjs status [--json]    report the discovered browser and exit
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { firstLine, resolveOnPath, runSync } from "../../../lib/host-exec.mjs";

const CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "chrome",
  "microsoft-edge",
];

// Windows keeps browsers under Program Files; the per-user Chrome install sits under LOCALAPPDATA.
const WINDOWS_CANDIDATES = [
  ["ProgramFiles", "Google/Chrome/Application/chrome.exe"],
  ["ProgramFiles(x86)", "Google/Chrome/Application/chrome.exe"],
  ["LOCALAPPDATA", "Google/Chrome/Application/chrome.exe"],
  ["ProgramFiles", "Microsoft/Edge/Application/msedge.exe"],
  ["ProgramFiles(x86)", "Microsoft/Edge/Application/msedge.exe"],
].map(([variable, rest]) => (process.env[variable] ? join(process.env[variable], ...rest.split("/")) : null)).filter(Boolean);

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function versionOf(command) {
  // chrome.exe is a GUI program on Windows: `--version` prints nothing there and may open a window, so the file is
  // accepted as found and its version is not probed.
  const exe = process.platform === "win32" ? (existsSync(command) ? command : resolveOnPath(command)) : null;
  if (exe && /\.exe$/iu.test(exe)) return "installed (version not probed on Windows)";
  const run = runSync(command, ["--version"], { encoding: "utf8", timeout: 8000 });
  if (run.error || run.status !== 0) return null;
  return firstLine(run.stdout) || null;
}

// Result shape: { status: "available" | "unavailable", command, version, blocker, detail }.
export function probeChrome(env = process.env) {
  if (typeof WebSocket !== "function") {
    return { status: "unavailable", command: null, version: null, blocker: "BLOCKED_BROWSER_DRIVER_UNAVAILABLE", detail: `Node ${process.versions.node} has no WebSocket global; use Node 22 or newer` };
  }
  const list = env.CHROME_PATH ? [env.CHROME_PATH] : [...CANDIDATES, ...WINDOWS_CANDIDATES];
  for (const command of list) {
    if (/^(\/|[A-Za-z]:[\\/])/u.test(command) && !existsSync(command)) continue;
    if (!/[\\/]/u.test(command) && !resolveOnPath(command)) continue;
    const version = versionOf(command);
    if (version) return { status: "available", command, version, blocker: null, detail: null };
  }
  return { status: "unavailable", command: null, version: null, blocker: "BLOCKED_BROWSER_DRIVER_UNAVAILABLE", detail: env.CHROME_PATH ? `CHROME_PATH did not run: ${env.CHROME_PATH}` : "no Chrome or Chromium found; set CHROME_PATH" };
}

// A tab: one DevTools page connection with the few calls the probe needs.
class Tab {
  constructor(socket, targetId, port) {
    this.socket = socket;
    this.targetId = targetId;
    this.port = port;
    this.nextId = 1;
    this.pending = new Map();
    this.waiters = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve: done, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message}`));
        else done(message.result);
      } else if (message.method && this.waiters.has(message.method)) {
        for (const done of this.waiters.get(message.method).splice(0)) done(message.params);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveSend, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, 30_000);
      this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolveSend(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMs) {
    return new Promise((resolveOnce) => {
      const timer = setTimeout(() => resolveOnce(null), timeoutMs);
      const list = this.waiters.get(method) ?? [];
      list.push((params) => { clearTimeout(timer); resolveOnce(params); });
      this.waiters.set(method, list);
    });
  }

  async setup({ width, height, scale = 1, media = "light", reducedMotion = false }) {
    await this.send("Page.enable");
    await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
    await this.send("Emulation.setEmulatedMedia", { features: [
      { name: "prefers-color-scheme", value: media },
      { name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" },
    ] });
  }

  async open(url, settleMs) {
    const loaded = this.once("Page.loadEventFired", 20_000);
    await this.send("Page.navigate", { url });
    if (!(await loaded)) throw new Error("page load timed out");
    await sleep(settleMs);
  }

  // Serialises `fn` with Function.prototype.toString, runs it in the page with one JSON argument.
  async evaluate(fn, argument) {
    const expression = `(() => { const run = ${fn.toString()}; return JSON.stringify(run(${JSON.stringify(argument)})); })()`;
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description?.split("\n")[0] ?? "evaluation failed");
    return JSON.parse(result.result.value);
  }

  async screenshot(path) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(path, Buffer.from(data, "base64"));
  }

  // A real pointer move, so :hover applies to the element at its centre.
  async hover(selector) {
    const point = await this.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      el.scrollIntoView({ block: "center", inline: "center" });
      const box = el.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }, selector);
    if (!point) throw new Error("hover target not found");
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
    await sleep(60);
  }

  async close() {
    try { this.socket.close(); } catch { /* already closed */ }
    try { await fetch(`http://127.0.0.1:${this.port}/json/close/${this.targetId}`); } catch { /* browser gone */ }
  }
}

export class ChromeSession {
  constructor(command) {
    this.command = command;
    this.child = null;
    this.port = null;
    this.profile = null;
  }

  async start() {
    this.profile = mkdtempSync(join(tmpdir(), "litgravity-chrome-"));
    const args = [
      "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${this.profile}`,
      "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars",
      "--disable-extensions", "--disable-background-networking", "--mute-audio", "--use-mock-keychain",
      "--password-store=basic", "about:blank",
    ];
    if (process.env.LITGRAVITY_CHROME_NO_SANDBOX === "1") args.unshift("--no-sandbox");
    this.child = spawn(this.command, args, { stdio: ["ignore", "ignore", "pipe"] });
    this.exited = new Promise((resolveExit) => this.child.on("exit", resolveExit));
    this.port = await new Promise((resolvePort, reject) => {
      let buffer = "";
      const timer = setTimeout(() => reject(new Error("browser did not expose its DevTools port")), 15_000);
      this.child.stderr.on("data", (chunk) => {
        buffer += chunk;
        const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//u.exec(buffer);
        if (match) { clearTimeout(timer); resolvePort(Number(match[1])); }
      });
      this.child.on("error", (error) => { clearTimeout(timer); reject(error); });
      this.child.on("exit", (code) => { clearTimeout(timer); reject(new Error(`browser exited ${code}`)); });
    });
  }

  async newTab() {
    const response = await fetch(`http://127.0.0.1:${this.port}/json/new?about:blank`, { method: "PUT" });
    const target = await response.json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveOpen, reject) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", () => reject(new Error("DevTools connection failed")), { once: true });
    });
    return new Tab(socket, target.id, this.port);
  }

  // Returns true when the browser process is gone and its profile directory is removed.
  async stop() {
    if (!this.child) return true;
    this.child.kill("SIGTERM");
    const gone = await Promise.race([this.exited.then(() => true), sleep(5000).then(() => false)]);
    if (!gone) {
      this.child.kill("SIGKILL");
      if (!(await Promise.race([this.exited.then(() => true), sleep(3000).then(() => false)]))) return false;
    }
    try { rmSync(this.profile, { recursive: true, force: true }); } catch { /* best effort */ }
    return true;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2] === "status") {
  const result = probeChrome();
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(result, null, 2)}\n` : `${result.status}${result.version ? `: ${result.version} (${result.command})` : `: ${result.detail}`}\n`);
  process.exitCode = result.status === "available" ? 0 : 2;
}
