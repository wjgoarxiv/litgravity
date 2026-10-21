#!/usr/bin/env node
// Python plotting runtime for lit-scientific-visualization.
//
// The bundled figure helpers (style_presets.py, figure_export.py, color_palettes.py) need
// matplotlib and numpy. They do not ship in the npm tarball. They install on first use from the
// pinned lock file next to this module into a LitGravity-owned virtual environment:
//
//   $LITGRAVITY_SCIVIZ_RUNTIME                                      when set (tests, isolated probes)
//   ${XDG_DATA_HOME:-~/.local/share}/litgravity/runtime/sciviz      otherwise
//
// The environment lives in python-<key>. <key> hashes the lock file, the platform and the Python
// minor version, so a lock change or a new interpreter gets a fresh environment instead of
// mutating an old one. Nothing is installed globally and no agy configuration is touched.
//
//   node sciviz-runtime.mjs status [--json]    readiness report, never installs
//   node sciviz-runtime.mjs install [--json]   create the environment (`ensure` is the same command)
//   node sciviz-runtime.mjs python             ensure the environment, print its interpreter
//   node sciviz-runtime.mjs run [--] <script.py> [args...]
//                                              ensure the environment, then run the script with the
//                                              skill's scripts/ and assets/ on PYTHONPATH, a headless
//                                              matplotlib backend and no bytecode files

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickPython } from "../../../lib/python-pick.mjs";
import { describeSpawn } from "../../../lib/host-exec.mjs";

const HERE = fileURLToPath(new URL("./", import.meta.url));
const SKILL_DIR = path.resolve(HERE, "..");
const LOCK_FILE = path.join(HERE, "sciviz-runtime-requirements.lock");
const READY = ".litgravity-ready";
const MIN_PYTHON = [3, 10];
const STALE_LOCK_MS = 20 * 60 * 1000;
const IMPORT_PROBE = "import matplotlib, numpy; print(matplotlib.__version__, numpy.__version__)";

const run = (command, args, options = {}) => spawnSync(command, args, { encoding: "utf8", ...options });

export function probePython() {
  return pickPython(process.env.LITGRAVITY_SCIVIZ_PYTHON, "LITGRAVITY_SCIVIZ_PYTHON");
}

export function pythonCommand() {
  return probePython().command;
}

export function runtimeRoot() {
  if (process.env.LITGRAVITY_SCIVIZ_RUNTIME) return path.resolve(process.env.LITGRAVITY_SCIVIZ_RUNTIME);
  const dataHome = process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share");
  return path.join(dataHome, "litgravity", "runtime", "sciviz");
}

function lockDigest(extra) {
  return createHash("sha256").update(readFileSync(LOCK_FILE)).update(extra).digest("hex").slice(0, 12);
}

export function pythonRuntimeDir(python = probePython()) {
  const minor = python.version ? python.version.split(".").slice(0, 2).join(".") : "none";
  return path.join(runtimeRoot(), `python-${lockDigest(`${process.platform}-${process.arch}-py${minor}`)}`);
}

const venvPython = (dir) => (process.platform === "win32" ? path.join(dir, "Scripts", "python.exe") : path.join(dir, "bin", "python"));

function pinnedPackages() {
  return readFileSync(LOCK_FILE, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

// One installer per environment at a time. mkdir is atomic, so the directory itself is the lock;
// a lock older than STALE_LOCK_MS belongs to an installer that died and is taken over.
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
      if (Date.now() > deadline) throw new Error(`SCIVIZ_RUNTIME_LOCKED: ${lock} is held by another installer`);
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

export function pythonStatus() {
  const python = probePython();
  const dir = pythonRuntimeDir(python);
  const ready = python.ok && existsSync(path.join(dir, READY)) && existsSync(venvPython(dir));
  return { ready, dir, interpreter: venvPython(dir), host: python, pinned: pinnedPackages() };
}

export function ensurePython() {
  const status = pythonStatus();
  if (status.ready) return status;
  if (!status.host.ok) {
    throw new Error(`SCIVIZ_RUNTIME_PYTHON_UNAVAILABLE: ${status.host.command}: ${status.host.detail}`);
  }
  return withLock(status.dir, () => {
    if (existsSync(path.join(status.dir, READY))) return pythonStatus();
    rmSync(status.dir, { recursive: true, force: true });
    notice(`LitGravity sciviz runtime: creating a Python ${status.host.version} environment with ${status.pinned.length} pinned lines (matplotlib, numpy and dependencies) in ${status.dir} - first use only.`);
    const venv = run(status.host.command, ["-m", "venv", status.dir], { stdio: ["ignore", "pipe", "pipe"] });
    if (venv.error || venv.status !== 0) {
      throw new Error(`SCIVIZ_RUNTIME_VENV_FAILED: python -m venv failed (${describeSpawn(venv)})`);
    }
    const pip = run(venvPython(status.dir), [
      "-m", "pip", "install", "--only-binary=:all:", "--no-input", "--disable-pip-version-check", "--quiet",
      "-r", LOCK_FILE,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    if (pip.error || pip.status !== 0) {
      throw new Error(`SCIVIZ_RUNTIME_PYTHON_INSTALL_FAILED: pip install failed (${describeSpawn(pip)})`);
    }
    const probe = run(venvPython(status.dir), ["-c", IMPORT_PROBE], { stdio: ["ignore", "pipe", "pipe"] });
    if (probe.error || probe.status !== 0) {
      throw new Error(`SCIVIZ_RUNTIME_IMPORT_FAILED: import probe failed (${describeSpawn(probe)})`);
    }
    writeFileSync(path.join(status.dir, READY), `${JSON.stringify({ python: status.host.version, versions: probe.stdout.trim(), at: new Date().toISOString() })}\n`);
    return pythonStatus();
  });
}

export function sciVizRuntimeStatus() {
  const python = pythonStatus();
  const missing = [];
  if (!python.host.ok) missing.push(`python ${MIN_PYTHON.join(".")}+ (${python.host.detail})`);
  else if (!python.ready) missing.push("python packages (matplotlib, numpy and the rest of the lock)");
  return {
    name: "sciviz",
    ready: python.ready,
    cache: runtimeRoot(),
    missing,
    lock: LOCK_FILE,
    python: { ready: python.ready, dir: python.dir, interpreter: python.interpreter, host: python.host, packages: python.pinned.length },
    firstUse: python.ready ? "ready" : "installs on first lit-scientific-visualization run",
    preWarm: "npx @litfamily/litgravity runtime install sciviz",
  };
}

// Child environment for a figure script: bundled helpers importable, headless backend, a
// runtime-local matplotlib config/cache dir, and no .pyc files written into the plugin cache.
export function figureEnv(status = pythonStatus()) {
  const existing = process.env.PYTHONPATH ? [process.env.PYTHONPATH] : [];
  return {
    ...process.env,
    PYTHONPATH: [path.join(SKILL_DIR, "scripts"), path.join(SKILL_DIR, "assets"), ...existing].join(path.delimiter),
    MPLBACKEND: process.env.MPLBACKEND || "Agg",
    MPLCONFIGDIR: process.env.MPLCONFIGDIR || path.join(status.dir, "mplconfig"),
    PYTHONDONTWRITEBYTECODE: "1",
  };
}

function main(argv) {
  const [command = "status", ...rest] = argv;
  const json = rest.includes("--json");
  try {
    if (command === "status") {
      const status = sciVizRuntimeStatus();
      if (json) console.log(JSON.stringify(status, null, 2));
      else {
        console.log(`sciviz runtime root: ${status.cache}`);
        console.log(`python deps: ${status.python.ready ? "ready" : status.python.host.ok ? "not installed (first use installs)" : `unavailable: ${status.python.host.detail}`}`);
        console.log(`lock: ${status.lock}`);
      }
      return 0;
    }
    if (command === "ensure" || command === "install") {
      // An unknown flag (a dry-run guess, a typo) stops before anything is installed.
      const unknown = rest.find((arg) => arg !== "--json");
      if (unknown !== undefined) {
        console.error(`unknown ${command} option: ${unknown}`);
        return 2;
      }
      ensurePython();
      if (json) console.log(JSON.stringify(sciVizRuntimeStatus(), null, 2));
      else console.log("sciviz runtime ready");
      return 0;
    }
    if (command === "python") {
      console.log(ensurePython().interpreter);
      return 0;
    }
    if (command === "run") {
      const args = rest[0] === "--" ? rest.slice(1) : rest;
      if (args.length === 0) {
        console.error("usage: sciviz-runtime.mjs run [--] <script.py> [args...]");
        return 2;
      }
      const status = ensurePython();
      const result = spawnSync(status.interpreter, args, { stdio: "inherit", env: figureEnv(status) });
      if (result.error) throw result.error;
      return result.status ?? 1;
    }
    console.error(`unknown command: ${command}`);
    return 2;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

// Compare real paths: a temp or home directory reached through a symlink (/var -> /private/var)
// would otherwise make the script think it was imported and print nothing.
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
