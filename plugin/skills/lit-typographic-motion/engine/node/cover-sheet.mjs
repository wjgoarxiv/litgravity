// The cover's review artifact: a contact sheet of decoded frames above a frame-difference plot of the
// whole loop (one point per grid step, the still threshold and the median drawn in). The plot shows
// what single stills cannot: holds, encoder pops, the reset at the seam. It is laid out as a small
// local page and captured by the same headless Chrome the cover renderer uses, so its labels are real
// type. `marks` shades time spans on the plot (a logged defect, a re-rendered window).
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COVER } from "../core/constants.mjs";
import { CoverBrowser } from "./cover-capture.mjs";
import { decodePng } from "./png.mjs";

const esc = (s) => String(s).replace(/[&<>"]/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** The sheet page: tiles [{ file, caption }] (4 per row), then the plot of `diffs`. */
export function sheetHtml({ tiles, tileWidth, tileHeight, diffs, medianD, label, status, marks = [], durationSec }) {
  const pad = 8;
  const cols = 4;
  const rows = Math.ceil(tiles.length / cols);
  const width = cols * tileWidth + (cols + 1) * pad;
  const plotH = 170;
  const gridTop = rows * (tileHeight + 22) + (rows + 1) * pad;
  const height = gridTop + 10 + plotH + 40;
  const pw = width - 2 * pad;
  const ymax = Math.max(0.01, ...diffs) * 1.05;
  const X = (i) => pad + (i / Math.max(1, diffs.length - 1)) * pw;
  const Y = (v) => gridTop + 10 + plotH - (v / ymax) * plotH;
  const points = diffs.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const markX = (sec) => pad + (sec / durationSec) * pw;
  const cells = tiles.map((tile, k) => {
    const x = pad + (k % cols) * (tileWidth + pad);
    const y = pad + Math.floor(k / cols) * (tileHeight + 22 + pad);
    return `<div class="cap" style="left:${x}px;top:${y}px">${esc(tile.caption)}</div><img src="${esc(tile.file)}" style="left:${x}px;top:${y + 22}px;width:${tileWidth}px;height:${tileHeight}px">`;
  }).join("\n");
  const markLines = marks.map((m) => `<rect x="${markX(m.t0).toFixed(1)}" y="${gridTop + 10}" width="${Math.max(2, markX(m.t1) - markX(m.t0)).toFixed(1)}" height="${plotH}" fill="#ffb02e" opacity="0.18"/>`).join("");
  const page = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/lit/fonts.css">
<style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#080b10}
img{position:absolute;display:block}.cap{position:absolute;font:13px "JetBrains Mono",monospace;color:#9aa}
.foot{position:absolute;left:${pad}px;top:${gridTop + 10 + plotH + 12}px;font:14px "JetBrains Mono",monospace;color:#ccd;white-space:nowrap}</style>
<body>${cells}
<svg width="${width}" height="${height}" style="position:absolute;left:0;top:0">
<rect x="${pad}" y="${gridTop + 10}" width="${pw}" height="${plotH}" fill="#11161d"/>${markLines}
<line x1="${pad}" x2="${pad + pw}" y1="${Y(COVER.stillEps)}" y2="${Y(COVER.stillEps)}" stroke="#a33" stroke-dasharray="4 4"/>
<line x1="${pad}" x2="${pad + pw}" y1="${Y(medianD)}" y2="${Y(medianD)}" stroke="#5a8" stroke-dasharray="2 3"/>
<polyline points="${points}" fill="none" stroke="#ff7a46" stroke-width="1.5"/></svg>
<div class="foot">${esc(label)} | ${esc(status)}</div>
<script>window.renderFrame = () => {}; Promise.all([...document.images].map((i) => i.decode())).then(() => document.fonts.ready).then(() => { window.ready = true; });</script>`;
  return { page, width, height };
}

/**
 * Render the sheet to `file`. `tiles` carry PNG paths on disk; they are copied next to the page
 * (the stage router serves nothing outside its directory) and the work directory is removed after.
 */
export async function renderSheet({ file, tiles, diffs, medianD, label, status, marks, durationSec, faces, workDir, env, log }) {
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const first = decodePng(readFileSync(tiles[0].file));
  const tileWidth = 400;
  const tileHeight = Math.round((tileWidth * first.height) / first.width);
  const local = tiles.map((t, i) => {
    const name = `t${String(i).padStart(2, "0")}.png`;
    copyFileSync(t.file, path.join(workDir, name));
    return { file: name, caption: t.caption };
  });
  const { page, width, height } = sheetHtml({ tiles: local, tileWidth, tileHeight, diffs, medianD, label, status, marks, durationSec });
  writeFileSync(path.join(workDir, "index.html"), page);
  const browser = await CoverBrowser.open({ stageDir: workDir, faces, width, height, scale: 1, profileDir: path.join(workDir, ".chrome"), env, log });
  try {
    await browser.frame(0);
    writeFileSync(file, await browser.capture());
  } finally {
    await browser.close();
    rmSync(workDir, { recursive: true, force: true });
  }
  return file;
}
