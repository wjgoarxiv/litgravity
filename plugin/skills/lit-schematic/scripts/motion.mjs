#!/usr/bin/env node
// Turns a drawing that moves into a short loop: MP4 for slides and players, an animated WebP
// and a GIF for READMEs and chat.
//
//   node motion.mjs <scene.mjs> --out <dir> [--name loop] [--seconds 4] [--fps 24] [--width 1280]
//                   [--small 720] [--formats mp4,webp,gif]
//
// <scene.mjs> exports frame(t) -> SVG string for t in [0, 1); frame(0) must equal the frame
// after the last one, so the loop closes without a jump. Every frame is drawn by the kit and
// rasterised by headless Chrome, so the film is deterministic: the same scene gives the same
// frames. Encoding uses ffmpeg (MP4, GIF) and img2webp (WebP). Nothing is installed: a missing
// tool stops the run with ENCODER_REQUIRED and the line for the user to run.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findChrome, renderPng, svgSize } from "./render.mjs";

export function findTool(name, env = process.env) {
  const dirs = (env.PATH ?? "").split(process.platform === "win32" ? ";" : ":").filter(Boolean);
  for (const dir of [...dirs, "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"]) {
    const file = join(dir, process.platform === "win32" ? `${name}.exe` : name);
    if (existsSync(file)) return file;
  }
  return null;
}

const INSTALL = {
  ffmpeg: "macOS: brew install ffmpeg · Debian/Ubuntu: sudo apt install ffmpeg · Windows: winget install ffmpeg",
  img2webp: "macOS: brew install webp · Debian/Ubuntu: sudo apt install webp · Windows: winget install Google.Libwebp",
};

function run(bin, args) {
  const result = spawnSync(bin, args, { encoding: "utf8", timeout: 600_000 });
  if (result.error) throw new Error(`ENCODE_FAILED ${bin}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`ENCODE_FAILED ${bin} exited ${result.status}: ${(result.stderr || "").split("\n").filter(Boolean).slice(-2).join(" ")}`);
}

export function renderMotion({ frame, out, name = "loop", seconds = 4, fps = 24, width = 1280, small = 720, formats = ["mp4", "webp", "gif"], onFrame = null, which = findTool, chromePath = findChrome() }) {
  const chrome = chromePath;
  if (!chrome) throw new Error("RENDERER_REQUIRED no Chrome or Chromium found. Install Google Chrome or set CHROME_PATH, then retry.");
  const need = new Set(formats.flatMap((f) => (f === "webp" ? ["ffmpeg", "img2webp"] : ["ffmpeg"])));
  const tools = {};
  for (const tool of need) {
    tools[tool] = which(tool);
    if (!tools[tool]) throw new Error(`ENCODER_REQUIRED ${tool} not found. This script never installs software. ${INSTALL[tool]}`);
  }
  mkdirSync(out, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "lit-schematic-motion-"));
  try {
    const count = Math.round(seconds * fps);
    const frames = join(work, "frames");
    mkdirSync(frames);
    let size = null;
    for (let i = 0; i < count; i++) {
      const svg = frame(i / count);
      size ??= svgSize(svg);
      const dpi = (width / size.width) * 25.4;
      renderPng({ chrome, svg, out: join(frames, `f${String(i).padStart(4, "0")}.png`), dpi, verify: false });
      onFrame?.(i + 1, count);
    }
    const even = "scale=trunc(iw/2)*2:trunc(ih/2)*2";
    const results = {};
    const input = ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(frames, "f%04d.png")];
    if (formats.includes("mp4")) {
      const file = join(out, `${name}.mp4`);
      run(tools.ffmpeg, [...input, "-vf", `${even},format=yuv420p`, "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", file]);
      results.mp4 = file;
    }
    if (formats.includes("gif")) {
      const file = join(out, `${name}.gif`);
      run(tools.ffmpeg, [...input, "-vf", `scale=${small}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, "-loop", "0", file]);
      results.gif = file;
    }
    if (formats.includes("webp")) {
      const smallDir = join(work, "small");
      mkdirSync(smallDir);
      run(tools.ffmpeg, [...input, "-vf", `scale=${small}:-1:flags=lanczos`, join(smallDir, "s%04d.png")]);
      const file = join(out, `${name}.webp`);
      const delay = String(Math.round(1000 / fps));
      const list = readdirSync(smallDir).filter((f) => f.endsWith(".png")).sort();
      run(tools.img2webp, ["-loop", "0", "-lossy", "-q", "78", "-m", "4", ...list.flatMap((f) => ["-d", delay, join(smallDir, f)]), "-o", file]);
      results.webp = file;
    }
    return { frames: count, fps, seconds, width, files: Object.fromEntries(Object.entries(results).map(([k, f]) => [k, { file: f, bytes: statSync(f).size }])) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function main(argv) {
  const args = argv.slice(2);
  const value = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
  const scene = args[0];
  if (!scene || scene.startsWith("--") || !value("--out")) {
    console.error("Usage: node motion.mjs <scene.mjs exporting frame(t)> --out <dir> [--name loop] [--seconds 4] [--fps 24] [--width 1280] [--small 720] [--formats mp4,webp,gif]");
    return 2;
  }
  const mod = await import(pathToFileURL(resolve(scene)).href);
  if (typeof mod.frame !== "function") {
    console.error(`MOTION_SCENE ${scene} must export frame(t) returning an SVG string`);
    return 2;
  }
  try {
    const result = renderMotion({
      frame: mod.frame,
      out: resolve(value("--out")),
      name: value("--name", "loop"),
      seconds: Number(value("--seconds", 4)),
      fps: Number(value("--fps", 24)),
      width: Number(value("--width", 1280)),
      small: Number(value("--small", 720)),
      formats: value("--formats", "mp4,webp,gif").split(","),
      onFrame: (i, n) => { if (i === n || i % 24 === 0) console.error(`frame ${i}/${n}`); },
    });
    for (const [kind, { file, bytes }] of Object.entries(result.files)) console.log(`MOTION_${kind.toUpperCase()} ${file} ${(bytes / 1024).toFixed(0)} KB`);
    console.log(`MOTION_DONE ${result.frames} frames at ${result.fps} fps (${result.seconds} s)`);
    return 0;
  } catch (error) {
    console.error(error.message);
    return /REQUIRED/u.test(error.message) ? 2 : 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv).then((code) => { process.exitCode = code; });
}
