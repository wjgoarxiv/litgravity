#!/usr/bin/env node
// The lit-schematic QA gate.
//
//   node qa.mjs drawing.svg                       static checks; exit 1 on any FAIL
//   node qa.mjs drawing.svg --json                the same result as JSON
//   node qa.mjs drawing.svg --png d.png --pdf d.pdf [--dpi 600]
//                                                 also checks the exports are whole, the PNG
//                                                 says its resolution and the PDF has the SVG's size
//   node qa.mjs --codes                           list every check code and what it means
//
// Options: --mode pid|pfd|journal|iso|figure (default: the root's data-schematic-mode),
// --min-pt <n> minimum text size at print, --min-stroke-mm <n>.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CODES, check, formatReport } from "./lib/qa-core.mjs";
import { pngInfo } from "./lib/png.mjs";
import { svgSize } from "./render.mjs";

export function checkExports({ svg, png, pdf, dpi = 600 }) {
  const findings = [];
  const add = (code, message) => findings.push({ code, level: "FAIL", message });
  const size = svgSize(svg);
  if (png) {
    try {
      const info = pngInfo(readFileSync(png));
      if (!info.closed) add("PNG.CLOSED", `${png} is truncated or has a bad chunk checksum`);
      if (!info.dpi || info.dpi + 0.5 < dpi) add("PNG.DPI", `${png} declares ${info.dpi ?? "no"} dpi; ${dpi} dpi is required`);
      const expected = Math.round((size.width / 25.4) * (info.dpi ?? dpi));
      if (info.dpi && Math.abs(info.width - expected) > Math.max(3, expected * 0.01)) add("PNG.DPI", `${png} is ${info.width} px wide; ${expected} px is the drawing width at ${info.dpi} dpi`);
    } catch (error) {
      add("PNG.CLOSED", `${png}: ${error.message}`);
    }
  }
  if (pdf) {
    try {
      const bytes = readFileSync(pdf);
      const head = bytes.subarray(0, 5).toString("latin1");
      const tail = bytes.subarray(Math.max(0, bytes.length - 1024)).toString("latin1");
      if (head !== "%PDF-" || !tail.includes("%%EOF")) add("PDF.CLOSED", `${pdf} lacks a PDF header or end-of-file marker`);
      const box = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/u.exec(bytes.toString("latin1"));
      if (!box) add("PDF.SIZE", `${pdf} has no readable MediaBox`);
      else {
        const w = ((Number(box[3]) - Number(box[1])) * 25.4) / 72;
        const h = ((Number(box[4]) - Number(box[2])) * 25.4) / 72;
        if (Math.abs(w - size.width) > 1 || Math.abs(h - size.height) > 1) add("PDF.SIZE", `${pdf} page is ${w.toFixed(1)} x ${h.toFixed(1)} mm; the drawing is ${size.width.toFixed(1)} x ${size.height.toFixed(1)} mm`);
      }
    } catch (error) {
      add("PDF.CLOSED", `${pdf}: ${error.message}`);
    }
  }
  return findings;
}

function main(argv) {
  const args = argv.slice(2);
  const value = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes("--codes")) {
    for (const [code, meaning] of Object.entries(CODES)) console.log(`${code.padEnd(20)} ${meaning}`);
    console.log(`${"PNG.CLOSED".padEnd(20)} The PNG is truncated or a chunk checksum is wrong.`);
    console.log(`${"PNG.DPI".padEnd(20)} The PNG does not declare the required resolution or is the wrong pixel width.`);
    console.log(`${"PDF.CLOSED".padEnd(20)} The PDF lacks its header or end-of-file marker.`);
    console.log(`${"PDF.SIZE".padEnd(20)} The PDF page size differs from the drawing size.`);
    return 0;
  }
  const flagged = new Set(["--mode", "--min-pt", "--min-stroke-mm", "--png", "--pdf", "--dpi"]);
  const input = args.find((a, i) => !a.startsWith("--") && !flagged.has(args[i - 1]));
  if (!input) {
    console.error("Usage: node qa.mjs drawing.svg [--json] [--mode pid|pfd|journal|iso|figure] [--min-pt 6] [--png file --pdf file --dpi 600] | --codes");
    return 2;
  }
  const svg = readFileSync(resolve(input), "utf8");
  const result = check(svg, {
    mode: value("--mode"),
    minTextPt: value("--min-pt") ? Number(value("--min-pt")) : undefined,
    minStrokeMm: value("--min-stroke-mm") ? Number(value("--min-stroke-mm")) : undefined,
  });
  if (value("--png") || value("--pdf")) {
    const extra = checkExports({ svg, png: value("--png") && resolve(value("--png")), pdf: value("--pdf") && resolve(value("--pdf")), dpi: Number(value("--dpi") ?? 600) });
    result.findings.push(...extra);
    result.fails += extra.length;
    if (extra.length) result.verdict = "FAIL";
  }
  if (args.includes("--json")) console.log(JSON.stringify({ file: input, ...result }, null, 2));
  else console.log(formatReport(result, input));
  return result.verdict === "PASS" ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main(process.argv);
}
