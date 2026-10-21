#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import path from "node:path";
import { argumentsMap, boundedRead, exclusiveWrite } from "./safe-files.mjs";

// fontkit resolves from the LitGravity readme runtime cache first (npx @litfamily/litgravity runtime install readme),
// then from a node_modules next to this file. The helper stays self-contained because it is copied into task workspaces.
const cache = process.env.LITGRAVITY_README_RUNTIME
  ? path.resolve(process.env.LITGRAVITY_README_RUNTIME)
  : path.join(process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share"), "litgravity", "runtime", "readme");
async function loadFontkit() {
  try { return await import(pathToFileURL(createRequire(path.join(cache, "package.json")).resolve("fontkit")).href); }
  catch {
    try { return await import("fontkit"); }
    catch { console.error("BLOCKED: fontkit is not installed. Pre-warm it with: npx @litfamily/litgravity runtime install readme"); process.exit(1); }
  }
}
const { create } = await loadFontkit();
const xml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
try {
  const args = argumentsMap(process.argv.slice(2), ["--font", "--family", "--text", "--output-root", "--output", "--font-size", "--fill", "--tracking"]);
  for (const name of ["--font", "--family", "--text", "--output-root", "--output"]) if (!args.get(name)) throw new Error(`REQUIRED ${name}`);
  const text = args.get("--text");
  if (text.length > 4096 || /[\x00-\x1f\x7f]/u.test(text)) throw new Error("INVALID_TEXT_RUN");
  const size = Number(args.get("--font-size") ?? 84);
  const tracking = Number(args.get("--tracking") ?? 0);
  const fill = args.get("--fill") ?? "#18272b";
  if (!Number.isFinite(size) || size < 1 || size > 1000 || !Number.isFinite(tracking) || Math.abs(tracking) > 100 || !/^#[0-9a-f]{6}$/iu.test(fill)) throw new Error("INVALID_STYLE");
  const bytes = boundedRead(args.get("--font"), 64 * 1024 * 1024);
  const font = create(bytes);
  if (typeof font.familyName !== "string" || !font.familyName.toLowerCase().includes(args.get("--family").toLowerCase())) throw new Error("FONT_IDENTITY_MISMATCH");
  const run = font.layout(text);
  if (!run.glyphs.length || run.glyphs.some(glyph => glyph.id === 0)) throw new Error("FONT_GLYPH_MISSING");
  const scale = size / font.unitsPerEm;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("INVALID_FONT_METRICS");
  let x = 0, y = 0;
  let minX = 0, maxX = 0, minY = -font.ascent * scale, maxY = -font.descent * scale;
  const paths = [];
  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i], pos = run.positions[i];
    if (![pos.xAdvance, pos.yAdvance, pos.xOffset, pos.yOffset].every(Number.isFinite)) throw new Error("INVALID_GLYPH_POSITION");
    const gx = x + pos.xOffset * scale, gy = y - pos.yOffset * scale;
    const outline = glyph.path.toSVG();
    if (outline) {
      const box = glyph.bbox;
      if (![box.minX, box.minY, box.maxX, box.maxY].every(Number.isFinite)) throw new Error("INVALID_OUTLINE_BOUNDS");
      minX = Math.min(minX, gx + box.minX * scale); maxX = Math.max(maxX, gx + box.maxX * scale);
      minY = Math.min(minY, gy - box.maxY * scale); maxY = Math.max(maxY, gy - box.minY * scale);
      paths.push(`<path d="${xml(outline)}" transform="translate(${gx} ${gy}) scale(${scale} ${-scale})"/>`);
    }
    x += pos.xAdvance * scale + (i < run.glyphs.length - 1 ? tracking : 0);
    y -= pos.yAdvance * scale;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  }
  const pad = Math.max(2, size * 0.04), width = maxX - minX + 2 * pad, height = maxY - minY + 2 * pad;
  if (!paths.length || ![minX, minY, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error("EMPTY_OR_INVALID_GEOMETRY");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="${minX-pad} ${minY-pad} ${width} ${height}" fill="${fill}"><title>${xml(text)}</title>${paths.join("")}</svg>\n`;
  const output = exclusiveWrite(args.get("--output-root"), args.get("--output"), svg);
  console.log(JSON.stringify({ output, text, family: font.familyName, style: font.subfamilyName, version: font.version, font_sha256: createHash("sha256").update(bytes).digest("hex"), glyphs: run.glyphs.length, paths: paths.length, width, height, fill, license: "caller-must-verify-and-retain-notice" }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
