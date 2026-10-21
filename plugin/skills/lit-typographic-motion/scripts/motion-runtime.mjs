#!/usr/bin/env node
// Runtime for lit-typographic-motion: the pinned engine package (opentype.js), the fetched and
// hash-verified fonts with their licences, and the optional librosa venv for beat analysis. It is
// the only step that writes the motion cache, and it never runs from a render:
//
//   $LITGRAVITY_MOTION_RUNTIME                                     when set (tests, isolated probes)
//   ${XDG_DATA_HOME:-~/.local/share}/litgravity/runtime/motion     otherwise
//
// `npx @litfamily/litgravity runtime install motion` (and `runtime status`) call this file with
// `install --json` / `status --json` and read {name, ready, cache, missing}. The pre-warm needs the
// network and a shell, so it runs from a terminal, or from agy once the user allows the command.
//
//   node motion-runtime.mjs status [--json]           readiness report, never installs
//   node motion-runtime.mjs install [--json] [--audio] pre-warm (engine package, fonts; --audio adds the venv)
//   node motion-runtime.mjs install --word-timing     prints the Tier-3 model plan and stops
//   node motion-runtime.mjs path                      prints the cache root when ready
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const USAGE = `lit-typographic-motion runtime (LitGravity)

usage:
  node motion-runtime.mjs status [--json]
  node motion-runtime.mjs install [--json] [--audio] [--word-timing]
  node motion-runtime.mjs path

install  pre-warms the pinned engine package and the fonts into the LitGravity motion cache, from a
         terminal or an allowed agy command. --audio adds the librosa beat-grid venv (Tier 2); --word-timing
         prints the Tier-3 model size and pins, then stops: its aligner runtime is not shipped.
status   reports what is ready and the command that fixes anything missing.
`;

const report = (status) => ({ name: "motion", ready: status.ready, cache: status.root, missing: status.missing, prewarm: true, audio: status.audio.state, command: status.command });

export async function main(argv, { env = process.env, stdout = process.stdout, stderr = process.stderr } = {}) {
  const [command, ...rest] = argv;
  if (!command || ["--help", "-h", "help"].includes(command)) {
    stdout.write(USAGE);
    return command ? 0 : 2;
  }
  const known = command === "install" ? ["--json", "--audio", "--word-timing"] : ["--json"];
  const unknown = rest.find((arg) => !known.includes(arg));
  if (unknown !== undefined) {
    stderr.write(`unknown option for ${command}: ${unknown}\n${USAGE}`);
    return 2;
  }
  const json = rest.includes("--json");
  const runtime = await import("../engine/node/runtime.mjs");
  if (command === "status" || command === "path") {
    const status = runtime.runtimeStatus({ env });
    if (command === "path") {
      if (!status.ready) {
        stderr.write(`motion runtime not ready; run: ${runtime.INSTALL_COMMAND}\n`);
        return 1;
      }
      stdout.write(`${status.root}\n`);
      return 0;
    }
    stdout.write(json ? `${JSON.stringify(report(status))}\n` : `${runtime.formatStatus(status).join("\n")}\n`);
    return 0;
  }
  if (command === "install") {
    // Tier 3 states its download size and every pin first; with no aligner runtime shipped it stops there.
    if (rest.includes("--word-timing")) {
      stdout.write(`${runtime.wordTimingPlan().lines.join("\n")}\n`);
      return 14;
    }
    if (!json) stdout.write("Installing the pinned engine package and fonts for lit-typographic-motion into the LitGravity runtime cache...\n");
    try {
      await runtime.installRuntime({ env, audio: rest.includes("--audio"), log: (line) => stderr.write(`motion-runtime: ${line}\n`) });
      const status = runtime.runtimeStatus({ env });
      stdout.write(json ? `${JSON.stringify(report(status))}\n` : `${runtime.formatStatus(status).join("\n")}\nMOTION_RUNTIME_INSTALL_PASS\n`);
      return status.ready ? 0 : 1;
    } catch (error) {
      const line = error.message.split("\n")[0].slice(0, 200);
      stderr.write(`MOTION_RUNTIME_INSTALL_FAIL: ${error.message}\n`);
      if (json) stdout.write(`${JSON.stringify({ ...report(runtime.runtimeStatus({ env })), error: line })}\n`);
      else stdout.write(`BLOCKED: motion runtime not pre-warmed (${line}). Run it from a terminal: ${runtime.INSTALL_COMMAND}\n`);
      return 1;
    }
  }
  stderr.write(`unknown command: ${command}\n${USAGE}`);
  return 2;
}

// Real-path compare: a symlinked install path must still run main().
const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) process.exitCode = await main(process.argv.slice(2));
