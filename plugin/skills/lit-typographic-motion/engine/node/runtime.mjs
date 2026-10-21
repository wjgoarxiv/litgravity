// The motion runtime: pinned engine dependencies, fetched fonts and the opt-in audio venv, all in a
// LitGravity-owned cache (MO-A-42..55). It keeps the cache mechanics of the other LitGravity engines (a
// directory keyed by the lockfile, an mkdir lock, `npm ci --omit=dev --ignore-scripts`) but not their
// first-use install: only `npx @litfamily/litgravity runtime install motion` (or this skill's
// scripts/motion-runtime.mjs) writes here. A render only reads, and an unwarmed cache is BLOCKED 14,
// never an install from inside a render: a render has no business downloading anything.
//
//   $LITGRAVITY_MOTION_RUNTIME                                     when set (tests, isolated probes)
//   ${XDG_DATA_HOME:-~/.local/share}/litgravity/runtime/motion     otherwise
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickPython } from "../../../../lib/python-pick.mjs";
import { describeSpawn, runNpmSync } from "../../../../lib/host-exec.mjs";

export const SKILL_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const ENGINE_ROOT = path.join(SKILL_ROOT, "engine");
export const FONT_ROOT = path.join(SKILL_ROOT, "fonts");
const READY = ".litgravity-ready";
const STALE_LOCK_MS = 20 * 60 * 1000;
export const INSTALL_COMMAND = "npx @litfamily/litgravity runtime install motion";
// The optional audio tier is not part of `litgravity runtime install`; it installs through this skill's own script.
export const AUDIO_INSTALL_COMMAND = `node "${path.join(SKILL_ROOT, "scripts", "motion-runtime.mjs")}" install --audio`;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (file) => sha256(readFileSync(file));

export function runtimeRoot(env = process.env) {
  if (env.LITGRAVITY_MOTION_RUNTIME) return path.resolve(env.LITGRAVITY_MOTION_RUNTIME);
  const dataHome = env.XDG_DATA_HOME || path.join(homedir(), ".local", "share");
  return path.join(dataHome, "litgravity", "runtime", "motion");
}

export function lockHash() {
  const h = createHash("sha256");
  for (const file of ["package.json", "package-lock.json"]) h.update(readFileSync(path.join(ENGINE_ROOT, file)));
  return h.digest("hex");
}

export const nodeDir = (env) => path.join(runtimeRoot(env), `node-${lockHash().slice(0, 12)}-${process.platform}-${process.arch}`);
export const fontsDir = (env) => path.join(runtimeRoot(env), "fonts");
export const opentypeModule = (env) => path.join(nodeDir(env), "node_modules", "opentype.js", "dist", "opentype.mjs");

export function loadFontManifest() {
  return JSON.parse(readFileSync(path.join(FONT_ROOT, "manifest.json"), "utf8"));
}

/** Where a font's bytes live after install (bundled, reused lit-pptx file, or the cache). */
export function fontLocation(key, font, env) {
  if (font.source === "bundled") return path.join(FONT_ROOT, font.path);
  if (font.source === "reuse") {
    const reused = path.resolve(FONT_ROOT, font.path);
    if (existsSync(reused)) return reused;
    return path.join(fontsDir(env), font.fallback.file);
  }
  return path.join(fontsDir(env), font.file);
}

/** Verify one font and its licence files. Returns { key, ok, problem, path }. */
export function checkFont(key, font, env) {
  const file = fontLocation(key, font, env);
  const expected = font.source === "reuse" && !existsSync(path.resolve(FONT_ROOT, font.path)) ? font.fallback.sha256 : font.sha256;
  if (!existsSync(file)) return { key, ok: false, problem: "missing", path: file };
  if (fileSha(file) !== expected) return { key, ok: false, problem: "sha256 mismatch", path: file };
  const licences = font.source === "fetch" ? font.licence.map((l) => ({ file: path.join(fontsDir(env), l.file), sha256: l.sha256 }))
    : font.source === "reuse" && !existsSync(path.resolve(FONT_ROOT, font.path)) ? font.fallback.licence.map((l) => ({ file: path.join(fontsDir(env), l.file), sha256: l.sha256 }))
      : font.licence.map((l) => ({ file: path.resolve(FONT_ROOT, l.path), sha256: l.sha256 }));
  for (const l of licences) {
    if (!existsSync(l.file)) return { key, ok: false, problem: `licence file missing: ${path.basename(l.file)}`, path: file };
    if (fileSha(l.file) !== l.sha256) return { key, ok: false, problem: `licence file sha256 mismatch: ${path.basename(l.file)}`, path: file };
  }
  return { key, ok: true, problem: null, path: file };
}

export function nodeStatus(env) {
  const dir = nodeDir(env);
  let marker = null;
  try {
    marker = JSON.parse(readFileSync(path.join(dir, READY), "utf8"));
  } catch {
    marker = null;
  }
  const expected = lockHash();
  const ready = Boolean(marker) && marker.lockHash === expected && existsSync(opentypeModule(env));
  const pinned = JSON.parse(readFileSync(path.join(ENGINE_ROOT, "package.json"), "utf8")).dependencies;
  return { ready, dir, pinned, problem: ready ? null : marker && marker.lockHash !== expected ? "lockfile hash differs from the installed one" : "not installed" };
}

// ---- audio (Tier 2) ----
const AUDIO_LOCK = path.join(ENGINE_ROOT, "audio", "requirements.lock");
const venvPython = (dir) => (process.platform === "win32" ? path.join(dir, "Scripts", "python.exe") : path.join(dir, "bin", "python"));

const pickedPython = (env) => pickPython(env.LITGRAVITY_MOTION_PYTHON, "LITGRAVITY_MOTION_PYTHON");

export function pythonCommand(env = process.env) {
  return pickedPython(env).command;
}

function probePython(env) {
  const picked = pickedPython(env);
  return picked.ok ? picked.version.split(".").slice(0, 2).join(".") : null;
}

export function audioDir(env, version = probePython(env)) {
  const key = createHash("sha256").update(readFileSync(AUDIO_LOCK)).update(`${process.platform}-${process.arch}-py${version ?? "none"}`).digest("hex").slice(0, 12);
  return path.join(runtimeRoot(env), `audio-${key}`);
}

/** 'absent' (never created), 'ready', or 'mismatch' (a venv whose pins no longer match). */
export function audioStatus(env) {
  const root = runtimeRoot(env);
  const expected = fileSha(AUDIO_LOCK);
  const dir = audioDir(env);
  let marker = null;
  try {
    marker = JSON.parse(readFileSync(path.join(dir, READY), "utf8"));
  } catch {
    marker = null;
  }
  if (marker && marker.lockSha256 === expected && existsSync(venvPython(dir))) return { state: "ready", dir, python: venvPython(dir) };
  if (marker || (existsSync(root) && existsSync(dir))) return { state: "mismatch", dir, python: venvPython(dir) };
  return { state: "absent", dir, python: null };
}

export const AUDIO_WARNING = `audio analysis not prewarmed: run ${AUDIO_INSTALL_COMMAND}`;

// ---- word timing (Tier 3) ----
export function loadWordTiming() {
  return JSON.parse(readFileSync(path.join(ENGINE_ROOT, "models", "word-timing.json"), "utf8"));
}

export function wordTimingStatus() {
  const doc = loadWordTiming();
  return { state: doc.alignerRuntime.status === "ready" ? "ready" : "absent", reason: "the Tier-3 aligner runtime is not part of this release", totalBytes: doc.totalBytes };
}

export function licenceVerdict(license, doc = loadWordTiming()) {
  const l = String(license ?? "").toLowerCase();
  if (doc.deniedLicensePatterns.some((p) => l.includes(p))) return "denied";
  return doc.allowedLicenses.includes(l) ? "allowed" : "unknown";
}

// ---- status ----

/** Required font keys for a preset (all presets when omitted). */
export function requiredFonts(presetVoices) {
  const keys = new Set();
  for (const voices of presetVoices) for (const v of Object.values(voices)) {
    for (const k of [v.latin, v.hangul, ...(v.weightSteps ?? [])]) if (k) keys.add(k);
    if (v.latin?.startsWith("archivo-")) for (const w of v.latinWidths ?? [100]) keys.add(`archivo-${w}-${v.latin.split("-")[2]}`);
  }
  return [...keys];
}

export function runtimeStatus({ env = process.env, fontKeys } = {}) {
  const manifest = loadFontManifest();
  const keys = fontKeys ?? Object.keys(manifest.fonts);
  const fonts = keys.map((key) => checkFont(key, manifest.fonts[key], env));
  const node = nodeStatus(env);
  const missing = [
    ...(node.ready ? [] : [`engine deps (${Object.entries(node.pinned).map(([k, v]) => `${k} ${v}`).join(", ")}): ${node.problem}`]),
    ...fonts.filter((f) => !f.ok).map((f) => `font ${f.key}: ${f.problem}`),
  ];
  return { root: runtimeRoot(env), node, fonts, audio: audioStatus(env), wordTiming: wordTimingStatus(), ready: missing.length === 0, missing, command: INSTALL_COMMAND };
}

export function formatStatus(status) {
  const lines = [`motion runtime root: ${status.root}`];
  lines.push(`engine deps: ${status.node.ready ? `ready (${Object.entries(status.node.pinned).map(([k, v]) => `${k} ${v}`).join(", ")})` : `missing (${status.node.problem})`}`);
  const bad = status.fonts.filter((f) => !f.ok);
  lines.push(`fonts: ${bad.length === 0 ? `ready (${status.fonts.length} verified by sha256)` : `missing or mismatched: ${bad.map((f) => `${f.key} (${f.problem})`).join(", ")}`}`);
  lines.push(`audio tier (optional): ${status.audio.state === "ready" ? "ready" : status.audio.state === "mismatch" ? `venv pins no longer match; Tier 1 is used; run ${AUDIO_INSTALL_COMMAND}` : `not installed; Tier 1 is used; run ${AUDIO_INSTALL_COMMAND} to enable`}`);
  lines.push(`word timing (optional, --word-timing): ${status.wordTiming.state === "ready" ? "ready" : status.wordTiming.reason}`);
  lines.push(status.ready ? "pre-warm: ready" : `pre-warm: NOT READY — run ${INSTALL_COMMAND}`);
  return lines;
}

// ---- install ----

function withLock(root, fn) {
  mkdirSync(root, { recursive: true });
  const lock = path.join(root, ".install.lock");
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
      if (Date.now() > deadline) throw new Error(`MOTION_RUNTIME_LOCKED: ${lock} is held by another installer`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  return Promise.resolve().then(fn).finally(() => rmSync(lock, { recursive: true, force: true }));
}

/** Fetch bytes from an http(s) or file URL. A mirror (tests, air-gapped hosts) serves files by sha256. */
async function fetchBytes(url, { sha256: expected, env }) {
  const mirror = env.LITGRAVITY_MOTION_MIRROR;
  const source = mirror && expected ? `${mirror.replace(/\/$/u, "")}/${expected}` : url;
  let bytes;
  if (source.startsWith("file://")) bytes = readFileSync(fileURLToPath(source));
  else {
    const response = await fetch(source, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${source}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (expected && sha256(bytes) !== expected) throw new Error(`sha256 mismatch for ${url} (expected ${expected}, got ${sha256(bytes)})`);
  return bytes;
}

function writeAtomic(file, bytes) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.part-${process.pid}`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, file);
}

export async function installFonts({ env = process.env, log = () => {} } = {}) {
  const manifest = loadFontManifest();
  const done = [];
  for (const [key, font] of Object.entries(manifest.fonts)) {
    const needsFetch = font.source === "fetch" || (font.source === "reuse" && !existsSync(path.resolve(FONT_ROOT, font.path)));
    if (!needsFetch) continue;
    const spec = font.source === "fetch" ? font : font.fallback;
    const status = checkFont(key, font, env);
    if (status.ok) {
      done.push(key);
      continue;
    }
    log(`fetching ${key} (${spec.bytes ?? "?"} bytes) from ${spec.url}`);
    writeAtomic(path.join(fontsDir(env), spec.file), await fetchBytes(spec.url, { sha256: spec.sha256, env }));
    for (const l of spec.licence) writeAtomic(path.join(fontsDir(env), l.file), await fetchBytes(l.url, { sha256: l.sha256, env }));
    const after = checkFont(key, font, env);
    if (!after.ok) throw new Error(`font ${key} failed verification after fetch: ${after.problem}`);
    done.push(key);
  }
  return done;
}

// npm exports its own settings to lifecycle scripts as npm_config_*, so an install started by the
// postinstall of `npm install -g` would hand `global=true` to this child, and npm refuses `npm ci`
// in global mode (ECIGLOBAL). Drop the inherited settings that change where or what `npm ci`
// installs; registry, proxy and cache settings pass through.
const NPM_INSTALL_SHAPE_SETTINGS = new Set([
  "global", "location", "prefix", "dry_run", "package_lock_only", "include", "production",
  "workspace", "workspaces", "include_workspace_root", "install_strategy", "global_style", "legacy_bundling",
]);
const npmChildEnv = (env) => Object.fromEntries(Object.entries(env).filter(([key]) => {
  const setting = /^npm_config_(.+)$/iu.exec(key)?.[1].toLowerCase().replaceAll("-", "_");
  return !NPM_INSTALL_SHAPE_SETTINGS.has(setting);
}));

function npm(args, { env, ...options }) {
  return runNpmSync(args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options, env: npmChildEnv(env) });
}

export async function installNode({ env = process.env, log = () => {} } = {}) {
  const status = nodeStatus(env);
  if (status.ready) return status;
  const dir = status.dir;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const file of ["package.json", "package-lock.json"]) copyFileSync(path.join(ENGINE_ROOT, file), path.join(dir, file));
  log(`installing pinned engine packages (${Object.entries(status.pinned).map(([k, v]) => `${k} ${v}`).join(", ")}) into ${dir}`);
  const args = ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"];
  let cache = null;
  if (env.LITGRAVITY_MOTION_MIRROR) {
    cache = path.join(tmpdir(), `lit-motion-npm-${process.pid}-${Date.now()}`);
    const lock = JSON.parse(readFileSync(path.join(ENGINE_ROOT, "package-lock.json"), "utf8"));
    for (const [name, pkg] of Object.entries(lock.packages)) {
      if (!name) continue;
      const integrity = Buffer.from(pkg.integrity.replace(/^sha512-/u, ""), "base64").toString("hex");
      const mirror = env.LITGRAVITY_MOTION_MIRROR.replace(/\/$/u, "");
      const source = `${mirror}/${path.basename(new URL(pkg.resolved).pathname)}`;
      const bytes = source.startsWith("file://") ? readFileSync(fileURLToPath(source)) : Buffer.from(await (await fetch(source)).arrayBuffer());
      if (createHash("sha512").update(bytes).digest("hex") !== integrity) throw new Error(`integrity mismatch for ${name}`);
      const tarball = path.join(cache, path.basename(new URL(pkg.resolved).pathname));
      writeAtomic(tarball, bytes);
      const add = npm(["cache", "add", tarball, "--cache", cache], { env });
      if (add.error || add.status !== 0) throw new Error(`npm cache add failed (${describeSpawn(add, { tail: 400 })})`);
    }
    args.push("--offline", "--cache", cache);
  }
  const result = npm(args, { cwd: dir, env });
  if (cache) rmSync(cache, { recursive: true, force: true });
  if (result.error || result.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`npm ci failed (${describeSpawn(result)})`);
  }
  writeFileSync(path.join(dir, READY), `${JSON.stringify({ lockHash: lockHash(), pinned: status.pinned })}\n`);
  return nodeStatus(env);
}

export async function installAudio({ env = process.env, log = () => {} } = {}) {
  const version = probePython(env);
  if (!version) throw new Error(pickedPython(env).detail);
  const dir = audioDir(env, version);
  const current = audioStatus(env);
  if (current.state === "ready") return current;
  rmSync(dir, { recursive: true, force: true });
  log(`creating the audio venv (Python ${version}, librosa and its hash-pinned wheels) in ${dir}`);
  const venv = spawnSync(pythonCommand(env), ["-m", "venv", dir], { encoding: "utf8" });
  if (venv.error || venv.status !== 0) throw new Error(`python -m venv failed (${describeSpawn(venv, { tail: 400 })})`);
  const pip = spawnSync(venvPython(dir), ["-m", "pip", "install", "--require-hashes", "--only-binary=:all:", "--no-input", "--disable-pip-version-check", "--quiet", "-r", AUDIO_LOCK], { encoding: "utf8", env: { ...env } });
  if (pip.error || pip.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`pip install --require-hashes failed (${describeSpawn(pip)})`);
  }
  writeFileSync(path.join(dir, READY), `${JSON.stringify({ lockSha256: fileSha(AUDIO_LOCK), python: version })}\n`);
  return audioStatus(env);
}

/**
 * The word-timing plan: download size, every pin and its licence verdict. Printed before anything
 * else; with no aligner runtime in this release, nothing is downloaded after it.
 */
export function wordTimingPlan() {
  const doc = loadWordTiming();
  const lines = [`word timing: ${(doc.totalBytes / 1e9).toFixed(2)} GB to download (${doc.models.length} models):`];
  const verdicts = [];
  for (const m of doc.models) {
    const verdict = licenceVerdict(m.license, doc);
    verdicts.push(verdict);
    lines.push(`  ${m.id} @ ${m.revision} — licence ${m.license} (${verdict}) — ${(m.bytes / 1e6).toFixed(0)} MB — ${m.role}`);
  }
  const blocked = verdicts.some((v) => v !== "allowed");
  lines.push(blocked ? "word timing: a model licence is not on the allowed list; failing closed" : "word timing: every pinned licence is permissive");
  lines.push("word timing: the aligner runtime is not part of this release; nothing was downloaded (Tier 3 stays opt-in and unavailable)");
  return { lines, blocked: true, licenceBlocked: blocked };
}

/** Pre-warm: engine deps, then fonts, then the optional audio tier. */
export async function installRuntime({ env = process.env, audio = false, log = () => {} } = {}) {
  const root = runtimeRoot(env);
  return withLock(root, async () => {
    const node = await installNode({ env, log });
    const fonts = await installFonts({ env, log });
    const result = { root, node, fonts, audio: null };
    if (audio) result.audio = await installAudio({ env, log });
    return result;
  });
}
