#!/usr/bin/env node
// Renders a lit-schematic SVG through headless Chrome.
//
//   node render.mjs drawing.svg --png drawing.png [--dpi 600]       raster at print size, pHYs written
//   node render.mjs drawing.svg --pdf drawing.pdf                   vector PDF at the SVG's mm size
//   node render.mjs drawing.svg --crop x,y,w,h --png close.png      one region (viewBox mm) at --dpi
//   node render.mjs drawing.svg --sheet sweep.png [--grid 3x2]      close-up contact sheet of the whole drawing
//
// It never installs anything. Without Chrome it exits 2 with RENDERER_REQUIRED and the setup
// line for the user to run. Every launch uses a throwaway profile, a mock keychain and a basic
// password store, so no keychain dialog reaches the desktop, and the profile is removed after.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findPretendard } from "./lib/fonts.mjs";
import { inkGrid, missingInk, pngInfo, withDpi } from "./lib/png.mjs";

export const CHROME_FLAGS = Object.freeze([
  "--headless=new", "--use-mock-keychain", "--password-store=basic", "--no-first-run",
  "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", "--disable-extensions",
]);
const PX_PER_MM = 96 / 25.4;
const MAX_SIDE = 16000;
// Headless Chrome returns a screenshot larger than about 100 million pixels with only its first
// tiles painted and no error (an A2 sheet at 600 dpi is 139 Mpx). Stay well under that.
const MAX_PIXELS = 80e6;

// The device scale and the dpi actually used for a page of cssW x cssH CSS pixels.
export function rasterScale(cssW, cssH, dpi) {
  let scale = dpi / 96;
  if (Math.max(cssW, cssH) * scale > MAX_SIDE) scale = MAX_SIDE / Math.max(cssW, cssH);
  if (cssW * cssH * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (cssW * cssH));
  const used = Math.min(dpi, Math.floor(scale * 96));
  return { scale: used / 96, dpi: used };
}

export function findChrome(env = process.env) {
  const candidates = [
    env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
  return candidates.find((file) => existsSync(file)) ?? null;
}

export function svgSize(svg) {
  const root = svg.match(/<svg\b[^>]*>/u)?.[0];
  if (!root) throw new Error("SVG_MISSING no <svg> root");
  const get = (name) => root.match(new RegExp(`\\s${name}="([^"]+)"`, "u"))?.[1];
  const view = get("viewBox")?.trim().split(/[\s,]+/u).map(Number);
  const toMm = (value) => {
    const m = /^([\d.]+)\s*(mm|cm|in|pt|px)?$/u.exec(value ?? "");
    if (!m) return null;
    const v = Number(m[1]);
    return { mm: v, cm: v * 10, in: v * 25.4, pt: (v * 25.4) / 72, px: v / PX_PER_MM, undefined: v / PX_PER_MM }[m[2]];
  };
  const width = toMm(get("width"));
  const height = toMm(get("height"));
  if (!view || view.length !== 4 || !width || !height) throw new Error("SVG_SIZE the root needs a viewBox and a physical width and height (for example width=\"178mm\")");
  return { width, height, view };
}

function fontFace() {
  const font = findPretendard();
  if (!font) return "";
  return `@font-face{font-family:Pretendard;src:url("${pathToFileURL(font.file).href}");font-weight:100 900}`;
}

const stripProlog = (svg) => svg.replace(/^\s*<\?xml[^>]*>\s*/u, "");

function page({ svg, widthMm, heightMm, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace()}@page{size:${widthMm}mm ${heightMm}mm;margin:0}html,body{margin:0;padding:0;background:#ffffff}svg{display:block}</style></head><body>${body ?? stripProlog(svg)}</body></html>`;
}

function runChrome(chrome, args, html, work) {
  const file = join(work, "page.html");
  writeFileSync(file, html);
  const profile = mkdtempSync(join(work, "profile-"));
  try {
    const result = spawnSync(chrome, [...CHROME_FLAGS, `--user-data-dir=${profile}`, ...args, pathToFileURL(file).href], { encoding: "utf8", timeout: 180_000 });
    if (result.error) throw new Error(`RENDER_FAILED ${result.error.message}`);
    if (result.status !== 0) throw new Error(`RENDER_FAILED chrome exited ${result.status}: ${(result.stderr || "").split("\n").slice(-3).join(" ")}`);
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

// `verify: false` skips the reference render, for film frames far below the size that can fail.
export function renderPng({ chrome, svg, out, dpi = 600, crop = null, verify = true }) {
  const size = svgSize(svg);
  let source = svg;
  let widthMm = size.width;
  let heightMm = size.height;
  if (crop) {
    const [x, y, w, h] = crop;
    const sx = size.width / size.view[2];
    widthMm = w * sx;
    heightMm = h * sx;
    source = svg.replace(/<svg\b[^>]*>/u, (root) => root
      .replace(/\sviewBox="[^"]*"/u, ` viewBox="${x} ${y} ${w} ${h}"`)
      .replace(/\swidth="[^"]*"/u, ` width="${widthMm}mm"`)
      .replace(/\sheight="[^"]*"/u, ` height="${heightMm}mm"`));
  }
  const cssW = Math.ceil(widthMm * PX_PER_MM);
  const cssH = Math.ceil(heightMm * PX_PER_MM);
  const work = mkdtempSync(join(tmpdir(), "lit-schematic-render-"));
  try {
    const raw = join(work, "raw.png");
    const html = page({ svg: source, widthMm, heightMm });
    // A small reference render shows where ink belongs; a cell inked there and blank in the full
    // render means the browser stopped painting part of the page. That limit depends on the
    // drawing as well as the size, so step the dpi down until the whole page arrives.
    const ref = join(work, "ref.png");
    if (verify) runChrome(chrome, ["--force-device-scale-factor=0.5", `--window-size=${cssW},${cssH}`, `--screenshot=${ref}`], html, work);
    const reference = verify ? inkGrid(readFileSync(ref)) : null;
    let { dpi: used } = rasterScale(cssW, cssH, dpi);
    for (let attempt = 0; ; attempt++) {
      runChrome(chrome, [`--force-device-scale-factor=${used / 96}`, `--window-size=${cssW},${cssH}`, `--screenshot=${raw}`], html, work);
      const blank = verify ? missingInk(reference, inkGrid(readFileSync(raw))) : [];
      if (!blank.length) break;
      if (attempt === 3) throw new Error(`RENDER_INCOMPLETE ${blank.length} of 36 regions came out blank at ${used} dpi though they hold ink; render --crop regions instead`);
      used = Math.floor(used * 0.85);
    }
    const png = withDpi(readFileSync(raw), used);
    writeFileSync(out, png);
    return { out, ...pngInfo(png), requestedDpi: dpi };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export function renderPdf({ chrome, svg, out }) {
  const size = svgSize(svg);
  const work = mkdtempSync(join(tmpdir(), "lit-schematic-render-"));
  try {
    runChrome(chrome, ["--no-pdf-header-footer", `--print-to-pdf=${resolve(out)}`], page({ svg, widthMm: size.width, heightMm: size.height }), work);
    return { out, widthMm: size.width, heightMm: size.height };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// One image of every region of the drawing enlarged, labelled with its viewBox box, so the
// close-up sweep is a single file to read.
export function renderSheet({ chrome, svg, out, grid = [3, 2], cellPx = 640 }) {
  const size = svgSize(svg);
  const [vx, vy, vw, vh] = size.view;
  const [cols, rows] = grid;
  const cw = vw / cols;
  const ch = vh / rows;
  const cellH = Math.round((cellPx * ch) / cw);
  const inner = stripProlog(svg);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const box = [vx + c * cw, vy + r * ch, cw, ch].map((v) => Math.round(v * 10) / 10);
      const copy = inner.replace(/<svg\b[^>]*>/u, (root) => root
        .replace(/\sviewBox="[^"]*"/u, ` viewBox="${box.join(" ")}"`)
        .replace(/\swidth="[^"]*"/u, ` width="${cellPx}px"`)
        .replace(/\sheight="[^"]*"/u, ` height="${cellH}px"`))
        .replaceAll(/\sid="([^"]+)"/gu, ` id="$1-${r}-${c}"`);
      cells.push(`<figure style="margin:0;border:1px solid #999"><figcaption style="font:12px Arial;padding:2px 4px;background:#f2f2f2">crop ${box.join(",")}</figcaption>${copy}</figure>`);
    }
  }
  const body = `<div style="display:grid;grid-template-columns:repeat(${cols},${cellPx + 2}px);gap:8px;padding:8px">${cells.join("")}</div>`;
  const cssW = cols * (cellPx + 10) + 16;
  const cssH = rows * (cellH + 30) + 16;
  const work = mkdtempSync(join(tmpdir(), "lit-schematic-render-"));
  try {
    const raw = join(work, "raw.png");
    runChrome(chrome, ["--force-device-scale-factor=1.5", `--window-size=${cssW},${cssH}`, `--screenshot=${raw}`], page({ svg, widthMm: cssW / PX_PER_MM, heightMm: cssH / PX_PER_MM, body }), work);
    writeFileSync(out, readFileSync(raw));
    return { out, cells: cols * rows };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function main(argv) {
  const args = argv.slice(2);
  const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const input = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && args[i - 1] !== "--help"));
  if (!input || args.includes("--help")) {
    console.error("Usage: node render.mjs drawing.svg [--png out.png] [--dpi 600] [--pdf out.pdf] [--crop x,y,w,h] [--sheet sweep.png --grid 3x2]");
    return 2;
  }
  const chrome = findChrome();
  if (!chrome) {
    console.error("RENDERER_REQUIRED no Chrome or Chromium found. This script never installs software. Install Google Chrome, or set CHROME_PATH to a Chrome/Chromium binary, then retry.");
    return 2;
  }
  const svg = readFileSync(resolve(input), "utf8");
  const dpi = Number(value("--dpi") ?? 600);
  const crop = value("--crop")?.split(",").map(Number);
  let did = false;
  if (value("--png")) {
    const r = renderPng({ chrome, svg, out: resolve(value("--png")), dpi, crop });
    console.log(`RENDER_PNG ${r.out} ${r.width}x${r.height} px ${r.dpi} dpi${r.dpi < dpi ? ` (reduced from ${dpi}: the image would exceed what one browser frame paints; render crops for more)` : ""}`);
    did = true;
  }
  if (value("--pdf")) {
    const r = renderPdf({ chrome, svg, out: resolve(value("--pdf")) });
    console.log(`RENDER_PDF ${r.out} ${Math.round(r.widthMm * 10) / 10} x ${Math.round(r.heightMm * 10) / 10} mm`);
    did = true;
  }
  if (value("--sheet")) {
    const grid = (value("--grid") ?? "3x2").split("x").map(Number);
    const r = renderSheet({ chrome, svg, out: resolve(value("--sheet")), grid });
    console.log(`RENDER_SHEET ${r.out} ${r.cells} close-ups of ${basename(input)}`);
    did = true;
  }
  if (!did) {
    console.error("Nothing to do: pass --png, --pdf or --sheet.");
    return 2;
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.exitCode = main(process.argv);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
