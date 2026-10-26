#!/usr/bin/env node
// Reports what lit-schematic can do on this machine. Drawing and QA need only Node; PNG and
// PDF export need Chrome or Chromium; Korean labels render in Pretendard when it is found; a
// cutaway's motion loop needs ffmpeg (MP4, GIF) and img2webp (WebP), and is the only part that does.
// It never installs anything and always exits 0 unless --strict is given and export is blocked.
//
//   node doctor.mjs [--out <dir>] [--json] [--strict]

import { accessSync, constants, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findPretendard } from "./lib/fonts.mjs";
import { findTool } from "./motion.mjs";
import { findChrome } from "./render.mjs";

export function diagnose({ out = process.cwd(), env = process.env } = {}) {
  const major = Number(process.versions.node.split(".")[0]);
  const chrome = findChrome(env);
  const font = findPretendard();
  let writable = false;
  try {
    accessSync(existsSync(out) ? out : resolve(out, ".."), constants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }
  const checks = [
    { id: "node", ok: major >= 20, detail: `Node ${process.versions.node}`, needed: "drawing, QA" },
    { id: "renderer", ok: Boolean(chrome), detail: chrome ?? "no Chrome or Chromium found (set CHROME_PATH)", needed: "PNG, PDF, close-up sheets" },
    { id: "font.korean", ok: Boolean(font), detail: font ? `${font.file} (${font.source})` : "Pretendard not found; Hangul falls back to the system font", needed: "Korean labels" },
    { id: "output", ok: writable, detail: resolve(out), needed: "writing files" },
    { id: "motion.ffmpeg", ok: Boolean(findTool("ffmpeg", env)), detail: findTool("ffmpeg", env) ?? "ffmpeg not found", needed: "motion loop (MP4, GIF)" },
    { id: "motion.webp", ok: Boolean(findTool("img2webp", env)), detail: findTool("img2webp", env) ?? "img2webp not found", needed: "motion loop (WebP)" },
  ];
  const status = !checks[0].ok || !writable ? "BLOCKED" : chrome ? "PASS" : "DEGRADED";
  return {
    status,
    checks,
    setup: [
      ...(chrome ? [] : ["Install Google Chrome (or Chromium), or point CHROME_PATH at an existing binary. lit-schematic never installs it for you."]),
      ...(findTool("ffmpeg", env) && findTool("img2webp", env) ? [] : ["Only for motion loops: install ffmpeg and the WebP tools (img2webp) with your package manager. lit-schematic never installs them."]),
    ],
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--out");
  const result = diagnose({ out: i >= 0 ? args[i + 1] : process.cwd() });
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    for (const c of result.checks) console.log(`${c.ok ? "ok  " : "MISS"} ${c.id.padEnd(12)} ${c.detail}  [${c.needed}]`);
    for (const line of result.setup) console.log(`setup: ${line}`);
    console.log(`DOCTOR ${result.status}`);
  }
  process.exitCode = args.includes("--strict") && result.status !== "PASS" ? 1 : 0;
}
