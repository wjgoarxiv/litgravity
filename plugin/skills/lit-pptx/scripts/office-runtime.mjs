#!/usr/bin/env node
// Office runtime for lit-pptx and lit-docx.
//
// The deck engine needs pptxgenjs (and sharp for recoloured or mesh backgrounds); the
// Python helpers need python-pptx, python-docx, markdown, beautifulsoup4, pymupdf, pyyaml
// and defusedxml. None of them ship in the npm tarball. They install on first use from the
// pinned lockfiles in ./office-runtime-lock/ into a LitGravity-owned cache:
//
//   $LITGRAVITY_OFFICE_RUNTIME                                      when set (tests, isolated probes)
//   ${XDG_DATA_HOME:-~/.local/share}/litgravity/runtime/office      otherwise
//
// Each environment lives in node-<key> or python-<key>. <key> hashes the lockfiles, the
// platform and the Python minor version, so a lockfile change or a new interpreter gets a
// fresh environment instead of mutating an old one.
// Nothing is installed globally and no agy configuration is touched. pandoc, XeLaTeX
// and LibreOffice (soffice) are optional host tools that are only reported, never installed.
//
//   node office-runtime.mjs status [--json]      readiness report, never installs
//   node office-runtime.mjs install [--node] [--python] [--json]   (`ensure` is the same command)
//   node office-runtime.mjs node-modules         ensure Node deps, print node_modules path
//   node office-runtime.mjs python               ensure Python deps, print the interpreter

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickPython } from "../../../lib/python-pick.mjs";
import { describeSpawn, firstLine, runNpmSync, runSync } from "../../../lib/host-exec.mjs";

const LOCK_DIR = fileURLToPath(new URL("./office-runtime-lock/", import.meta.url));
const NODE_LOCK_FILES = ["package.json", "package-lock.json"];
const PYTHON_LOCK_FILE = "requirements.lock";
const READY = ".litgravity-ready";
const MIN_PYTHON = [3, 10];
const STALE_LOCK_MS = 20 * 60 * 1000;

const HOST_TOOLS = [
  { id: "soffice", args: ["--version"], feature: "rendered pages; the QA gates fall back to structural checks" },
  { id: "pandoc", args: ["--version"], feature: "DOCX-to-Markdown and the publisher PDF path" },
  { id: "xelatex", args: ["--version"], feature: "publisher PDF output" },
];

const run = (command, args, options = {}) => runSync(command, args, { encoding: "utf8", ...options });

// npm exports its own settings as npm_config_* to every script it runs, so a caller started under
// `npm install -g` would hand `global=true` to this child, and npm refuses `npm ci` in global mode
// (ECIGLOBAL). Drop the inherited settings that change where or what `npm ci` installs; registry,
// proxy and cache settings pass through.
const NPM_INSTALL_SHAPE_SETTINGS = new Set([
  "global", "location", "prefix", "dry_run", "package_lock_only", "include", "production",
  "workspace", "workspaces", "include_workspace_root", "install_strategy", "global_style", "legacy_bundling",
]);
const npmChildEnv = (env) => Object.fromEntries(Object.entries(env).filter(([key]) => {
  const setting = /^npm_config_(.+)$/iu.exec(key)?.[1].toLowerCase().replaceAll("-", "_");
  return !NPM_INSTALL_SHAPE_SETTINGS.has(setting);
}));

export function probePython() {
  return pickPython(process.env.LITGRAVITY_OFFICE_PYTHON, "LITGRAVITY_OFFICE_PYTHON");
}

export function pythonCommand() {
  return probePython().command;
}

function lockDigest(files, extra) {
  const hash = createHash("sha256");
  for (const file of files) hash.update(readFileSync(path.join(LOCK_DIR, file)));
  hash.update(extra);
  return hash.digest("hex").slice(0, 12);
}

export function runtimeRoot() {
  if (process.env.LITGRAVITY_OFFICE_RUNTIME) return path.resolve(process.env.LITGRAVITY_OFFICE_RUNTIME);
  const dataHome = process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share");
  return path.join(dataHome, "litgravity", "runtime", "office");
}

export function nodeRuntimeDir() {
  return path.join(runtimeRoot(), `node-${lockDigest(NODE_LOCK_FILES, `${process.platform}-${process.arch}`)}`);
}

export function pythonRuntimeDir(python = probePython()) {
  const minor = python.version ? python.version.split(".").slice(0, 2).join(".") : "none";
  return path.join(runtimeRoot(), `python-${lockDigest([PYTHON_LOCK_FILE], `${process.platform}-${process.arch}-py${minor}`)}`);
}

const venvPython = (dir) => (process.platform === "win32" ? path.join(dir, "Scripts", "python.exe") : path.join(dir, "bin", "python"));

const pinnedNodeVersions = () => JSON.parse(readFileSync(path.join(LOCK_DIR, "package.json"), "utf8")).dependencies;

function pinnedPythonPackages() {
  return readFileSync(path.join(LOCK_DIR, PYTHON_LOCK_FILE), "utf8")
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
      if (Date.now() > deadline) throw new Error(`OFFICE_RUNTIME_LOCKED: ${lock} is held by another installer`);
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

export function nodeStatus() {
  const dir = nodeRuntimeDir();
  const ready = existsSync(path.join(dir, READY));
  return { ready, dir, nodeModules: path.join(dir, "node_modules"), pinned: pinnedNodeVersions() };
}

export function ensureNode() {
  const status = nodeStatus();
  if (status.ready) return status;
  return withLock(status.dir, () => {
    if (existsSync(path.join(status.dir, READY))) return nodeStatus();
    rmSync(status.dir, { recursive: true, force: true });
    mkdirSync(status.dir, { recursive: true });
    for (const file of NODE_LOCK_FILES) copyFileSync(path.join(LOCK_DIR, file), path.join(status.dir, file));
    const pins = Object.entries(status.pinned).map(([name, version]) => `${name} ${version}`).join(", ");
    notice(`LitGravity office runtime: installing pinned Node packages (${pins}) into ${status.dir} — first use only.`);
    const result = runNpmSync(["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"], {
      encoding: "utf8",
      cwd: status.dir,
      stdio: ["ignore", "pipe", "pipe"],
      env: npmChildEnv(process.env),
    });
    if (result.error || result.status !== 0) {
      throw new Error(`OFFICE_RUNTIME_NODE_INSTALL_FAILED: npm ci failed (${describeSpawn(result)})`);
    }
    writeFileSync(path.join(status.dir, READY), `${JSON.stringify({ pinned: status.pinned, at: new Date().toISOString() })}\n`);
    return nodeStatus();
  });
}

export function pythonStatus() {
  const python = probePython();
  const dir = pythonRuntimeDir(python);
  const ready = python.ok && existsSync(path.join(dir, READY)) && existsSync(venvPython(dir));
  return { ready, dir, interpreter: venvPython(dir), host: python, pinned: pinnedPythonPackages() };
}

export function ensurePython() {
  const status = pythonStatus();
  if (status.ready) return status;
  if (!status.host.ok) {
    throw new Error(`OFFICE_RUNTIME_PYTHON_UNAVAILABLE: ${status.host.command}: ${status.host.detail}`);
  }
  return withLock(status.dir, () => {
    if (existsSync(path.join(status.dir, READY))) return pythonStatus();
    rmSync(status.dir, { recursive: true, force: true });
    notice(`LitGravity office runtime: creating a Python ${status.host.version} environment with ${status.pinned.length} pinned packages in ${status.dir} — first use only.`);
    const venv = run(status.host.command, ["-m", "venv", status.dir], { stdio: ["ignore", "pipe", "pipe"] });
    if (venv.error || venv.status !== 0) {
      throw new Error(`OFFICE_RUNTIME_VENV_FAILED: python -m venv failed (${describeSpawn(venv)})`);
    }
    const pip = run(venvPython(status.dir), [
      "-m", "pip", "install", "--only-binary=:all:", "--no-input", "--disable-pip-version-check", "--quiet",
      "-r", path.join(LOCK_DIR, PYTHON_LOCK_FILE),
    ], { stdio: ["ignore", "pipe", "pipe"] });
    if (pip.error || pip.status !== 0) {
      throw new Error(`OFFICE_RUNTIME_PYTHON_INSTALL_FAILED: pip install failed (${describeSpawn(pip)})`);
    }
    writeFileSync(path.join(status.dir, READY), `${JSON.stringify({ python: status.host.version, at: new Date().toISOString() })}\n`);
    return pythonStatus();
  });
}

export function hostToolStatus() {
  return HOST_TOOLS.map(({ id, args, feature }) => {
    const probe = run(id, args, { stdio: ["ignore", "pipe", "pipe"], timeout: 20000 });
    const ok = !probe.error && probe.status === 0;
    const first = ok ? firstLine(`${probe.stdout || probe.stderr}`) : "not found on PATH";
    return { id, available: ok, detail: first, feature };
  });
}

export function officeRuntimeStatus() {
  const node = nodeStatus();
  const python = pythonStatus();
  const missing = [];
  if (!node.ready) missing.push("node packages (pptxgenjs, sharp)");
  if (!python.host.ok) missing.push(`python 3.10+ (${python.host.detail})`);
  else if (!python.ready) missing.push("python packages (python-pptx, python-docx and the rest of the lock)");
  return {
    name: "office",
    ready: node.ready && python.ready,
    cache: runtimeRoot(),
    missing,
    root: runtimeRoot(),
    node: { ready: node.ready, dir: node.dir, pinned: node.pinned },
    python: { ready: python.ready, dir: python.dir, host: python.host, packages: python.pinned.length },
    hostTools: hostToolStatus(),
    firstUse: node.ready && python.ready ? "ready" : "installs on first lit-pptx or lit-docx run",
  };
}

function main(argv) {
  const [command = "status", ...rest] = argv;
  const json = rest.includes("--json");
  try {
    if (command === "status") {
      const status = officeRuntimeStatus();
      if (json) console.log(JSON.stringify(status, null, 2));
      else {
        console.log(`office runtime root: ${status.root}`);
        console.log(`node deps:   ${status.node.ready ? "ready" : "not installed (first use installs)"}`);
        console.log(`python deps: ${status.python.ready ? "ready" : status.python.host.ok ? "not installed (first use installs)" : `unavailable: ${status.python.host.detail}`}`);
        for (const tool of status.hostTools) console.log(`${tool.id.padEnd(8)} ${tool.available ? tool.detail : `missing; unavailable: ${tool.feature}`}`);
      }
      return 0;
    }
    if (command === "ensure" || command === "install") {
      // An unknown flag (a dry-run guess, a typo) stops before anything is installed.
      const unknown = rest.find((arg) => !["--node", "--python", "--json"].includes(arg));
      if (unknown !== undefined) {
        console.error(`unknown ${command} option: ${unknown}`);
        return 2;
      }
      const wantNode = rest.includes("--node") || !rest.includes("--python");
      const wantPython = rest.includes("--python") || !rest.includes("--node");
      const result = {};
      if (wantNode) result.node = ensureNode();
      if (wantPython) result.python = ensurePython();
      if (json) console.log(JSON.stringify({ ...officeRuntimeStatus(), ...result }, null, 2));
      else console.log("office runtime ready");
      return 0;
    }
    if (command === "node-modules") {
      console.log(ensureNode().nodeModules);
      return 0;
    }
    if (command === "python") {
      console.log(ensurePython().interpreter);
      return 0;
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
