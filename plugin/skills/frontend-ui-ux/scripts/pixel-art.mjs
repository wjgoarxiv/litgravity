#!/usr/bin/env node
// Pixel art for the field-notes style: turns a character grid into an inline SVG whose cells are
// filled with the locked colour roles, so the motif stays crisp at any size and follows dark mode.
//
//   node pixel-art.mjs <grid.txt> --label "<what it shows>" [--cell 8]
//
// Grid characters: i ink, a accent, b second accent, m support (mist), s sunken, p surface,
// c canvas, l line-strong, 2 ink-2; `.` or space is empty. Every row must have the same width. The SVG
// renders at cell × columns CSS px by default; never let it drop below 6 px per cell.
import { readFileSync, realpathSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const PIXEL_ROLES = Object.freeze({ i: "ink", a: "accent", b: "accent-2", m: "support", s: "sunken", p: "surface", c: "canvas", l: "line-strong", 2: "ink-2" });

export function pixelSvg(grid, { label, cell = 8 } = {}) {
  if (!label || !label.trim()) throw new Error("--label is required: say what the motif shows");
  const rows = grid.replace(/\r/gu, "").split("\n").filter((row) => row.trim().length > 0);
  if (rows.length === 0) throw new Error("the grid is empty");
  const width = Math.max(...rows.map((row) => row.length));
  if (rows.some((row) => row.trimEnd().length > width)) throw new Error("rows differ in width");
  if (!Number.isFinite(cell) || cell < 6) throw new Error("cells under 6 px stop reading as pixel art");
  const rects = [];
  rows.forEach((row, y) => {
    const padded = row.padEnd(width, ".");
    let x = 0;
    while (x < width) {
      const char = padded[x];
      const role = PIXEL_ROLES[char];
      if (char !== "." && char !== " " && !role) throw new Error(`unknown grid character "${char}" at row ${y + 1}`);
      let end = x + 1;
      while (end < width && padded[end] === char) end += 1;
      if (role) rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" style="fill: var(--c-${role})"/>`);
      x = end;
    }
  });
  const escaped = label.replace(/[&<>"]/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<svg class="ui-pixel" viewBox="0 0 ${width} ${rows.length}" width="${width * cell}" height="${rows.length * cell}" role="img" aria-label="${escaped}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
}

const startedDirectly = () => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (startedDirectly()) {
  const args = process.argv.slice(2);
  const option = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
  const file = args.find((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));
  try {
    if (!file) throw new Error("usage: pixel-art.mjs <grid.txt> --label \"<what it shows>\" [--cell 8]");
    process.stdout.write(`${pixelSvg(readFileSync(file, "utf8"), { label: option("label"), cell: Number(option("cell") ?? 8) })}\n`);
  } catch (error) {
    console.error(`pixel-art: ${error.message}`);
    process.exitCode = 1;
  }
}
