#!/usr/bin/env node
// The MO-A-44 doctor probes for lit-typographic-motion, printed on every doctor run: Chrome,
// ffmpeg with the preview rung, the WebGL2 renderer string from a real headless probe, the
// software-GL / unknown-renderer warning, the pre-warm state naming what is missing and the command
// that fixes it, the cover encoder (img2webp and dwebp, or the gifski fallback) that cover mode
// needs, and the house styles every film is built from. Read-only: it never installs, and the probe's Chrome profile is a unique temporary
// directory removed on exit.
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { which } from "../engine/node/host.mjs";

export const USAGE = "usage: motion-doctor.mjs [--json]\nlit-typographic-motion doctor (LitGravity): seven readiness probes, read-only\n";

const versionOf = (tool, env) => {
  const probe = spawnSync(tool, ["-version"], { encoding: "utf8", env });
  return probe.status === 0 ? (/\d+\.\d+(?:\.\d+)?/u.exec(probe.stdout || probe.stderr)?.[0] ?? "unknown") : "unknown";
};

/** Cover mode's encoder: img2webp and dwebp (encode, then decode for the gate), else gifski. */
export function coverProbe(env = process.env) {
  const img2webp = which("img2webp", env);
  const dwebp = which("dwebp", env);
  if (img2webp && dwebp) return { ok: true, line: `img2webp ${versionOf(img2webp, env)} and dwebp ${versionOf(dwebp, env)}: README cover loops encode as animated WebP and gate the decoded file` };
  const gifski = which("gifski", env);
  if (gifski) return { ok: true, line: `gifski at ${gifski}: covers fall back to GIF (img2webp${img2webp ? "" : " missing"}, dwebp${dwebp ? "" : " missing"})` };
  return { ok: false, line: "BLOCKED_NO_COVER_ENCODER: install libwebp (img2webp, dwebp) or gifski; cover renders stop with exit 21" };
}

/** The house styles (styles/*.json): each one valid, with the default named. */
export async function stylesProbe() {
  const { STYLE_IDS, DEFAULT_STYLE, readStyle } = await import("../engine/node/styles.mjs");
  try {
    for (const id of STYLE_IDS) readStyle(id);
    return { ok: true, line: `${STYLE_IDS.length} house styles valid (${STYLE_IDS.map((id) => (id === DEFAULT_STYLE ? `${id} default` : id)).join(", ")}); see them with motion.mjs styles --out <dir>` };
  } catch (error) {
    return { ok: false, line: `a house style is invalid: ${error.message}` };
  }
}

export async function probes({ env = process.env } = {}) {
  const { findChrome, chromeVersion, launchWithLadder } = await import("../engine/node/chrome.mjs");
  const { findFfmpeg, ffmpegVersion, previewRungs } = await import("../engine/node/encode.mjs");
  const { runtimeStatus, formatStatus, INSTALL_COMMAND } = await import("../engine/node/runtime.mjs");
  const { isSoftware } = await import("../engine/core/gate-rules.mjs");
  const { UNKNOWN_RENDERER } = await import("../engine/core/constants.mjs");
  const out = {};
  const chrome = findChrome(env);
  out.chrome = chrome ? { ok: true, line: `${chrome} — ${chromeVersion(chrome)}` } : { ok: false, line: "not found on PATH / not installed (set CHROME_PATH)" };
  const ffmpeg = findFfmpeg(env);
  const rungs = previewRungs(ffmpeg, env);
  out.ffmpeg = ffmpeg ? { ok: true, line: `${ffmpeg} — ${ffmpegVersion(ffmpeg)}; preview encoder rung: ${rungs[0] ?? "none"} (available: ${rungs.join(", ") || "none"})` } : { ok: false, line: `not found on PATH (video export blocked; stills and sheet still work)${rungs.length ? `; preview rung: ${rungs[0]}` : ""}` };
  if (!chrome) out.webgl2 = { ok: false, line: "no WebGL2 context obtainable (Chrome not found)" };
  else {
    const dir = mkdtempSync(path.join(tmpdir(), "lit-motion-doctor-"));
    try {
      const { session, flags, renderer } = await launchWithLadder({ chrome, profileRoot: dir, routes: () => null });
      await session.close();
      out.webgl2 = { ok: true, line: `${renderer} (flags: ${flags.join(" ")})`, renderer };
    } catch (error) {
      out.webgl2 = { ok: false, line: `no WebGL2 context obtainable (${error.message.split("\n")[0]})` };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const renderer = out.webgl2.renderer;
  out.software = !renderer ? { ok: false, line: "renderer unknown: no WebGL2 probe result" }
    : renderer === UNKNOWN_RENDERER ? { ok: true, line: "renderer type unknown — debug-info extension unavailable" }
      : isSoftware(renderer) ? { ok: true, line: `software GL detected (${renderer}); renders will be slower, --samples lowered automatically` }
        : { ok: true, line: "none (real GPU)" };
  const status = runtimeStatus({ env });
  out.prewarm = { ok: status.ready, line: status.ready ? `ready — ${formatStatus(status).slice(1, 3).join("; ")}` : `NOT READY — missing: ${status.missing.join("; ")}; run ${INSTALL_COMMAND}`, detail: formatStatus(status) };
  out.cover = coverProbe(env);
  out.styles = await stylesProbe();
  return out;
}

export function formatProbes(p) {
  return [
    `MOTION_CHROME: ${p.chrome.line}`,
    `MOTION_FFMPEG: ${p.ffmpeg.line}`,
    `MOTION_WEBGL2: ${p.webgl2.line}`,
    `MOTION_SOFTWARE_GL: ${p.software.line}`,
    `MOTION_PREWARM: ${p.prewarm.line}`,
    `MOTION_COVER: ${p.cover.line}`,
    `MOTION_STYLES: ${p.styles.line}`,
  ];
}

export async function main(argv, { env = process.env, stdout = process.stdout } = {}) {
  if (argv.includes("--help") || argv.includes("-h")) {
    stdout.write(USAGE);
    return 0;
  }
  const p = await probes({ env });
  if (argv.includes("--json")) stdout.write(`${JSON.stringify(p, null, 2)}\n`);
  else stdout.write(`${formatProbes(p).join("\n")}\n`);
  return 0;
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) process.exitCode = await main(process.argv.slice(2));
