"use strict";

/**
 * gen-gradient-assets.js — render the azure-style gradient circle PNGs
 * (circle-lg/md/sm) in an arbitrary two-stop gradient, into a target dir.
 * Used to recolor cover/divider decorations for a custom --accent.
 */
const fs = require("fs");
const path = require("path");
const { runtimeRequire } = require("./runtime-require");
const sharp = runtimeRequire("sharp");

function gradCircleSvg(size, c1, c2) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">` +
      `<stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#g)"/></svg>`
  );
}

/**
 * @param {[string,string]} gradient [c1, c2]
 * @param {string} outDir directory to write circle-lg/md/sm.png into
 * @returns {Promise<string>} outDir
 */
async function genGradientAssets([c1, c2], outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  await Promise.all([
    sharp(gradCircleSvg(1040, c1, c2)).png().toFile(path.join(outDir, "circle-lg.png")),
    sharp(gradCircleSvg(420, c1, c2)).png().toFile(path.join(outDir, "circle-md.png")),
    sharp(gradCircleSvg(240, c1, c2)).png().toFile(path.join(outDir, "circle-sm.png")),
  ]);
  return outDir;
}

module.exports = { genGradientAssets, gradCircleSvg };
