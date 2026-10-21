"use strict";

/**
 * gen-bg.js — generate blurred gradient-mesh backgrounds (glassmorphism) in the
 * active palette hue, via sharp. Two variants:
 *   mesh-light.png — near-white base + soft light-hue blobs (dark ink stays readable)
 *   mesh-dark.png  — deep-hue base + richer blobs (white text stays readable)
 * Full-bleed 16:9 at ~150dpi (2000×1125). The whole canvas is heavily blurred so
 * no hard edges remain — an ambient wash, not a busy pattern.
 */
const fs = require("fs");
const path = require("path");
const { runtimeRequire } = require("./runtime-require");
const sharp = runtimeRequire("sharp");

const W = 2000;
const H = 1125;

function blob(cx, cy, r, color, opacity, id) {
  return (
    `<radialGradient id="b${id}" cx="50%" cy="50%" r="50%">` +
    `<stop offset="0%" stop-color="${color}" stop-opacity="${opacity}"/>` +
    `<stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>`
  );
}

function meshSvg(base, blobs) {
  const defs = blobs.map((b, i) => blob(b.cx, b.cy, b.r, b.color, b.op, i)).join("");
  const circles = blobs
    .map((b, i) => `<circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="url(#b${i})"/>`)
    .join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<defs>${defs}</defs><rect width="${W}" height="${H}" fill="${base}"/>${circles}</svg>`
  );
}

function pick(p, key, fallback) {
  return (p && p[key]) || fallback;
}

/**
 * @param {object} palette azure-style palette (primary, primary_deep, azure, azure_soft, tint, tint_2, paper)
 * @param {string} outDir
 * @returns {Promise<{light:string,dark:string}>}
 */
async function genMeshBg(palette, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const primary = pick(palette, "primary", "#1D4ED8");
  const deep = pick(palette, "primary_deep", "#0B2E6F");
  const azure = pick(palette, "azure", "#3B82F6");
  const soft = pick(palette, "azure_soft", "#93C5FD");
  const tint2 = pick(palette, "tint_2", "#DCE9FF");
  const paper = pick(palette, "paper", "#F6F9FE");

  // LIGHT: airy wash on near-white. Low opacities keep luminance very high so
  // dark ink clears WCAG (qa assumes white bg; real bg is only marginally darker).
  const light = meshSvg("#FFFFFF", [
    // broad central wash so the glass effect reads across the WHOLE slide (not just
    // corners) — tint2 is a very pale blue, so luminance stays high and dark ink is safe.
    { cx: 1000, cy: 560, r: 1500, color: tint2, op: 0.55 },
    { cx: 120, cy: 160, r: 820, color: soft, op: 0.5 },
    { cx: 1880, cy: 240, r: 760, color: tint2, op: 0.9 },
    { cx: 1640, cy: 1040, r: 860, color: soft, op: 0.42 },
    { cx: 360, cy: 1080, r: 680, color: tint2, op: 0.85 },
    { cx: 1480, cy: 520, r: 460, color: azure, op: 0.14 },
  ]);

  // DARK: deep-hue base for white text (section dividers). Stays dark enough.
  const dark = meshSvg(deep, [
    { cx: 1640, cy: 280, r: 760, color: primary, op: 0.55 },
    { cx: 240, cy: 980, r: 720, color: azure, op: 0.32 },
    { cx: 1820, cy: 1080, r: 560, color: soft, op: 0.14 },
    { cx: 80, cy: 80, r: 520, color: "#000000", op: 0.28 },
  ]);

  const lightPath = path.join(outDir, "mesh-light.png");
  const darkPath = path.join(outDir, "mesh-dark.png");
  await Promise.all([
    sharp(light).blur(60).png().toFile(lightPath),
    sharp(dark).blur(60).png().toFile(darkPath),
  ]);
  return { light: lightPath, dark: darkPath };
}

module.exports = { genMeshBg };
