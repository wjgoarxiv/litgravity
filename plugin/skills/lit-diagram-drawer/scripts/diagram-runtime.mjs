#!/usr/bin/env node
// Diagram runtime for lit-diagram-drawer.
//
// Only PNG export needs a renderer: scripts/export.mjs drives agent-browser (pinned in
// ./diagram-runtime-lock/package.json) against Chrome for Testing 154. Source checks, importers and
// the verifiers need nothing beyond Node. The renderer installs on first export into a LitGravity-owned
// cache:
//
//   $LITGRAVITY_DIAGRAM_RUNTIME                                     when set (tests, isolated probes)
//   ${XDG_DATA_HOME:-~/.local/share}/litgravity/runtime/diagram     otherwise
//
// The environment lives in node-<key>; <key> hashes the lock file and the platform, so a pin change
// gets a fresh directory. Nothing is installed globally and no agy configuration is touched.
// agent-browser keeps its state, sockets and downloaded browsers under $HOME/.agent-browser and has no
// setting for that directory, so every agent-browser child runs with HOME=<runtime root>/home. A Chrome
// or Chromium already on the machine (LITGRAVITY_DIAGRAM_CHROME, CHROME_PATH, AGENT_BROWSER_EXECUTABLE_PATH,
// the macOS app bundle, or a chrome/chromium name on PATH) is handed over through
// AGENT_BROWSER_EXECUTABLE_PATH and nothing is downloaded; only when none exists does
// `agent-browser install` fetch Chrome for Testing 154 into <runtime root>/home/.agent-browser/browsers.
// Nothing lands in the real home directory; only the
// short-lived control sockets use /tmp/lgd-<uid> because socket paths are length-limited.
//
//   node diagram-runtime.mjs status [--json]    readiness report, never installs
//   node diagram-runtime.mjs install [--json]   (`ensure` is the same command)
//   node diagram-runtime.mjs bin                ensure the renderer, print its path

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supportsAgentBrowserVersion } from "./runtime-probes.mjs";
import { describeSpawn, resolveOnPath, runNpmSync, runSync } from "../../../lib/host-exec.mjs";

const LOCK_DIR = fileURLToPath(new URL("./diagram-runtime-lock/", import.meta.url));
const LOCK_FILES = ["package.json"];
const READY = ".litgravity-ready";
const CHROME_MAJOR = "154.";
const STALE_LOCK_MS = 20 * 60 * 1000;

const run = (command, args, options = {}) => runSync(command, args, { encoding: "utf8", ...options });

// npm exports its own settings as npm_config_* to every script it runs; a caller started under
// `npm install -g` would hand `global=true` to this child. Drop the settings that change where or
// what gets installed; registry, proxy and cache settings pass through.
const NPM_INSTALL_SHAPE_SETTINGS = new Set([
  "global", "location", "prefix", "dry_run", "package_lock_only", "include", "production",
  "workspace", "workspaces", "include_workspace_root", "install_strategy", "global_style", "legacy_bundling",
]);
const npmChildEnv = (env) => Object.fromEntries(Object.entries(env).filter(([key]) => {
  const setting = /^npm_config_(.+)$/iu.exec(key)?.[1].toLowerCase().replaceAll("-", "_");
  return !NPM_INSTALL_SHAPE_SETTINGS.has(setting);
}));

export const pinnedVersion = () => JSON.parse(readFileSync(path.join(LOCK_DIR, "package.json"), "utf8")).dependencies["agent-browser"];

function lockDigest() {
  const hash = createHash("sha256");
  for (const file of LOCK_FILES) hash.update(readFileSync(path.join(LOCK_DIR, file)));
  hash.update(`${process.platform}-${process.arch}`);
  return hash.digest("hex").slice(0, 12);
}

export function runtimeRoot() {
  if (process.env.LITGRAVITY_DIAGRAM_RUNTIME) return path.resolve(process.env.LITGRAVITY_DIAGRAM_RUNTIME);
  const dataHome = process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share");
  return path.join(dataHome, "litgravity", "runtime", "diagram");
}

export const runtimeDir = () => path.join(runtimeRoot(), `node-${lockDigest()}`);
export const cachedBin = () => path.join(runtimeDir(), "node_modules", ".bin", process.platform === "win32" ? "agent-browser.cmd" : "agent-browser");

function versionOf(bin) {
  const probe = run(bin, ["--version"], { stdio: ["ignore", "pipe", "pipe"], timeout: 20000 });
  if (probe.error || probe.status !== 0) return { ok: false, detail: describeSpawn(probe) };
  return { ok: supportsAgentBrowserVersion(probe.stdout), detail: probe.stdout.trim() };
}

const MAC_CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
];
const PATH_CHROME = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"];
const WIN_CHROME = ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"].map((name) => process.env[name] && path.join(process.env[name], "Google", "Chrome", "Application", "chrome.exe")).filter(Boolean);

// First usable system Chrome or Chromium with its version line. A candidate that does not run is skipped.
export function systemChrome() {
  const explicit = [process.env.LITGRAVITY_DIAGRAM_CHROME, process.env.CHROME_PATH, process.env.AGENT_BROWSER_EXECUTABLE_PATH];
  const onPath = PATH_CHROME.map((name) => resolveOnPath(name));
  for (const candidate of [...explicit, ...MAC_CHROME, ...WIN_CHROME, ...onPath]) {
    if (!candidate || !existsSync(candidate)) continue;
    // chrome.exe is a GUI program on Windows: `--version` prints nothing there and may open a window, so the file is trusted.
    if (process.platform === "win32") return { path: candidate, version: "installed (version not probed on Windows)" };
    const probe = run(candidate, ["--version"], { stdio: ["ignore", "pipe", "pipe"], timeout: 20000 });
    if (!probe.error && probe.status === 0 && /chrom/iu.test(probe.stdout)) return { path: candidate, version: probe.stdout.trim() };
  }
  return null;
}

export const agentHome = () => path.join(runtimeRoot(), "home");

// Unix socket paths top out near 100 bytes, which a deep cache path plus a session name exceeds, so the
// sockets live in a short per-user directory (AGENT_BROWSER_SOCKET_DIR). Sockets only; no state or browsers.
export function socketDir() {
  if (process.platform === "win32") return undefined;
  const dir = path.join("/tmp", `lgd-${process.getuid?.() ?? "u"}`);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

// Environment for every agent-browser child: a private HOME, and the system browser when one exists.
export function rendererEnv(extra = {}) {
  mkdirSync(agentHome(), { recursive: true });
  const env = { ...process.env, HOME: agentHome(), USERPROFILE: agentHome(), ...extra };
  const sockets = socketDir();
  if (sockets) env.AGENT_BROWSER_SOCKET_DIR = sockets;
  const system = systemChrome();
  if (system) env.AGENT_BROWSER_EXECUTABLE_PATH = system.path;
  return env;
}

export function chromeStatus(bin) {
  const system = systemChrome();
  if (system) return { ok: true, source: "system", detail: `${system.version} at ${system.path}` };
  const doctor = run(bin, ["doctor", "--json"], { stdio: ["ignore", "pipe", "pipe"], timeout: 60000, env: rendererEnv() });
  let parsed = null;
  try { parsed = JSON.parse(doctor.stdout); } catch { /* reported below */ }
  const message = parsed?.checks?.find((check) => check.id === "chrome.installed")?.message || "";
  return { ok: Boolean(parsed?.success) && message.includes(CHROME_MAJOR), source: "cache", detail: message || "Chrome for Testing not found" };
}

// The pinned cache copy wins; a PATH copy at or above the minimum version is accepted so a machine
// that already has a working renderer is not asked to install a second one.
export function resolveBin() {
  const cached = cachedBin();
  if (existsSync(path.join(runtimeDir(), READY)) && existsSync(cached)) return { bin: cached, source: "cache", version: versionOf(cached).detail };
  const onPath = versionOf("agent-browser");
  if (onPath.ok) return { bin: "agent-browser", source: "path", version: onPath.detail };
  return null;
}

// One installer at a time. mkdir is atomic, so the directory itself is the lock; a lock older than
// STALE_LOCK_MS belongs to an installer that died and is taken over.
function withLock(dir, fn) {
  mkdirSync(path.dirname(dir), { recursive: true });
  const lock = `${dir}.lock`;
  const deadline = Date.now() + STALE_LOCK_MS;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let age = 0;
      try { age = Date.now() - statSync(lock).mtimeMs; } catch { continue; }
      if (age > STALE_LOCK_MS) { rmSync(lock, { recursive: true, force: true }); continue; }
      if (Date.now() > deadline) throw new Error(`DIAGRAM_RUNTIME_LOCKED: ${lock} is held by another installer`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

const notice = (line) => process.stderr.write(`${line}\n`);

export function ensureRenderer() {
  const found = resolveBin();
  if (found) return found;
  const dir = runtimeDir();
  return withLock(dir, () => {
    if (existsSync(path.join(dir, READY))) return resolveBin();
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const file of LOCK_FILES) copyFileSync(path.join(LOCK_DIR, file), path.join(dir, file));
    notice(`LitGravity diagram runtime: installing agent-browser ${pinnedVersion()} into ${dir} — first export only.`);
    const result = runNpmSync(["install", "--omit=dev", "--no-package-lock", "--no-audit", "--no-fund", "--loglevel=error"], {
      encoding: "utf8",
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      env: npmChildEnv(process.env),
    });
    if (result.error || result.status !== 0) {
      throw new Error(`DIAGRAM_RUNTIME_INSTALL_FAILED: npm install failed (${describeSpawn(result)})`);
    }
    const installed = versionOf(cachedBin());
    if (!installed.ok) throw new Error(`DIAGRAM_RUNTIME_INSTALL_FAILED: installed renderer is unusable: ${installed.detail}`);
    writeFileSync(path.join(dir, READY), `${JSON.stringify({ pinned: pinnedVersion(), at: new Date().toISOString() })}\n`);
    return resolveBin();
  });
}

export function ensureChrome(bin) {
  const chrome = chromeStatus(bin);
  if (chrome.ok) return chrome;
  notice(`LitGravity diagram runtime: no system Chrome found; fetching Chrome for Testing 154 into ${agentHome()} with agent-browser install — first export only.`);
  const result = run(bin, ["install"], { stdio: ["ignore", "pipe", "pipe"], timeout: STALE_LOCK_MS, env: rendererEnv() });
  if (result.error || result.status !== 0) {
    throw new Error(`DIAGRAM_RUNTIME_CHROME_FAILED: agent-browser install failed (${describeSpawn(result)})`);
  }
  return chromeStatus(bin);
}

export function diagramRuntimeStatus() {
  const found = resolveBin();
  const chrome = found ? chromeStatus(found.bin) : { ok: false, detail: "renderer not installed" };
  const missing = [];
  if (!found) missing.push(`agent-browser ${pinnedVersion()} (installs on first PNG export)`);
  if (!chrome.ok) missing.push("Chrome for Testing 154 (agent-browser install)");
  return {
    name: "diagram",
    ready: missing.length === 0,
    cache: runtimeRoot(),
    missing,
    root: runtimeRoot(),
    dir: runtimeDir(),
    pinned: pinnedVersion(),
    renderer: found ? { ready: true, source: found.source, bin: found.bin, version: found.version } : { ready: false },
    chrome,
    firstUse: found && chrome.ok ? "ready" : "installs on first lit-diagram-drawer PNG export",
  };
}

function main(argv) {
  const [command = "status", ...rest] = argv;
  const json = rest.includes("--json");
  try {
    if (command === "status") {
      const status = diagramRuntimeStatus();
      if (json) console.log(JSON.stringify(status, null, 2));
      else {
        console.log(`diagram runtime root: ${status.root}`);
        console.log(`renderer: ${status.renderer.ready ? `${status.renderer.version} (${status.renderer.source})` : `not installed (pinned ${status.pinned}; first export installs)`}`);
        console.log(`chrome:   ${status.chrome.ok ? status.chrome.detail : `missing (${status.chrome.detail})`}`);
      }
      return 0;
    }
    if (command === "ensure" || command === "install") {
      const unknown = rest.find((arg) => arg !== "--json");
      if (unknown !== undefined) {
        console.error(`unknown ${command} option: ${unknown}`);
        return 2;
      }
      const found = ensureRenderer();
      const chrome = ensureChrome(found.bin);
      if (!chrome.ok) throw new Error(`DIAGRAM_RUNTIME_CHROME_FAILED: ${chrome.detail}`);
      if (json) console.log(JSON.stringify(diagramRuntimeStatus(), null, 2));
      else console.log("diagram runtime ready");
      return 0;
    }
    if (command === "bin") {
      console.log(ensureRenderer().bin);
      return 0;
    }
    console.error(`unknown command: ${command}`);
    return 2;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2));
}
