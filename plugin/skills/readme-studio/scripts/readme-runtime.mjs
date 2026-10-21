#!/usr/bin/env node
// Runtime for readme-studio: the pinned fontkit that shape-text-to-svg.mjs needs.
// It installs on first use from ./readme-runtime-lock/ into a LitGravity-owned cache:
//
//   $LITGRAVITY_README_RUNTIME                                     when set (tests, isolated probes)
//   ${XDG_DATA_HOME:-~/.local/share}/litgravity/runtime/readme     otherwise
//
// Nothing is installed globally and no agy configuration is touched. The Remotion and
// HyperFrames cover templates install per task with `npm ci` in their own project directory.
//
//   node readme-runtime.mjs status [--json]    readiness report, never installs
//   node readme-runtime.mjs install [--json]   npm ci from the lock into the cache
//   node readme-runtime.mjs path               print the cache node_modules path when ready

import { describeSpawn, runNpmSync } from "../../../lib/host-exec.mjs";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCK_DIR = fileURLToPath(new URL("./readme-runtime-lock/", import.meta.url));
const LOCK_FILES = ["package.json", "package-lock.json"];
const REQUIRED = ["fontkit"];

export function cacheDir(env = process.env) {
  if (env.LITGRAVITY_README_RUNTIME) return path.resolve(env.LITGRAVITY_README_RUNTIME);
  const data = env.XDG_DATA_HOME || path.join(homedir(), ".local", "share");
  return path.join(data, "litgravity", "runtime", "readme");
}

export function missing(cache = cacheDir()) {
  return REQUIRED.filter((name) => !existsSync(path.join(cache, "node_modules", name, "package.json")));
}

export function status(cache = cacheDir()) {
  const absent = missing(cache);
  return { name: "readme", ready: absent.length === 0, cache, missing: absent };
}

export function install(cache = cacheDir()) {
  mkdirSync(cache, { recursive: true });
  for (const file of LOCK_FILES) copyFileSync(path.join(LOCK_DIR, file), path.join(cache, file));
  // npm exports its own settings to child scripts; drop the ones that change where or what `npm ci` installs.
  const shape = new Set(["global", "location", "prefix", "dry_run", "package_lock_only", "include", "production", "workspace", "workspaces"]);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => {
    const setting = /^npm_config_(.+)$/iu.exec(key)?.[1].toLowerCase().replaceAll("-", "_");
    return !shape.has(setting);
  }));
  const result = runNpmSync(["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", cache], { encoding: "utf8", env });
  if (result.error || result.status !== 0) {
    return { ...status(cache), error: `npm ci failed (${describeSpawn(result)})` };
  }
  return status(cache);
}

const main = () => {
  const [command = "status", ...flags] = process.argv.slice(2);
  const json = flags.includes("--json");
  if (command === "path") {
    const s = status();
    if (!s.ready) { process.stderr.write(`readme runtime not ready; run: npx @litfamily/litgravity runtime install readme\n`); return 1; }
    process.stdout.write(`${path.join(s.cache, "node_modules")}\n`);
    return 0;
  }
  if (command !== "status" && command !== "install") {
    process.stderr.write("Usage: readme-runtime.mjs status|install|path [--json]\n");
    return 2;
  }
  if (command === "install" && !json) process.stdout.write("Installing the pinned fontkit for readme-studio into the LitGravity runtime cache...\n");
  const report = command === "install" ? install() : status();
  if (json) process.stdout.write(`${JSON.stringify(report)}\n`);
  else if (report.error) process.stdout.write(`BLOCKED: ${report.error}\nPre-warm from a terminal: npx @litfamily/litgravity runtime install readme\n`);
  else process.stdout.write(`readme runtime ${report.ready ? "ready" : "not ready"} at ${report.cache}${report.missing.length ? ` (missing: ${report.missing.join(", ")})` : ""}\n`);
  return command === "install" && !report.ready ? 1 : 0;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
