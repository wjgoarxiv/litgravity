// One cover frame off the capture thread: decode the 2x screenshot, Lanczos-downsample it to the
// cover size, write it as an RGB PNG (the encoder's input and the G0 / seek-order hash source) and
// return the SHA-256 of that PNG.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { parentPort } from "node:worker_threads";
import { lanczosResize } from "./cover-image.mjs";
import { decodePng, encodePng, rgbaToRgb } from "./png.mjs";

parentPort.on("message", ({ id, png, width, height, file }) => {
  try {
    const src = decodePng(Buffer.from(png));
    const rgba = src.channels === 4 ? src.pixels : Buffer.from(rgbaFromRgb(src.pixels, src.width, src.height));
    const small = lanczosResize(rgba, src.width, src.height, width, height);
    const bytes = encodePng(rgbaToRgb(small, width, height), width, height, 3, { level: 1 });
    if (file) writeFileSync(file, bytes);
    parentPort.postMessage({ id, sha256: createHash("sha256").update(bytes).digest("hex"), captured: `${src.width}x${src.height}` });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});

function rgbaFromRgb(rgb, width, height) {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = rgb[i * 3];
    out[i * 4 + 1] = rgb[i * 3 + 1];
    out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = 255;
  }
  return out;
}
