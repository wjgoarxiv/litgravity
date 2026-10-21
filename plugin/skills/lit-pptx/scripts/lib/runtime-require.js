"use strict";

/**
 * runtime-require.js — load the engine's npm dependencies from the LitGravity
 * office runtime instead of a node_modules folder next to the skill.
 *
 * The skill ships without node_modules. The first require installs the pinned
 * lockfile into the LitGravity-owned cache (scripts/office-runtime.mjs
 * prints a one-line notice), and every later require resolves from there.
 */

const path = require("path");
const { execFileSync } = require("child_process");

const RUNTIME = path.resolve(__dirname, "../office-runtime.mjs");
let nodeModules = null;

function runtimeRequire(name) {
  if (!nodeModules) {
    nodeModules = execFileSync(process.execPath, [RUNTIME, "node-modules"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }).trim();
  }
  return require(require.resolve(name, { paths: [nodeModules] }));
}

module.exports = { runtimeRequire };
