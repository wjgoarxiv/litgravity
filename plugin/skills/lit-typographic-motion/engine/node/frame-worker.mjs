// One frame-analysis worker: decode a captured PNG to RGBA and analyse it off the capture thread
// (the SHA-256 of the decoded RGBA, the flash-audit cells on the frame's own grid, the 99.5th
// percentile luminance). The capture loop steps the next frame while a pool of these decodes.
import { parentPort } from "node:worker_threads";
import { analyzeFrame } from "./analysis.mjs";
import { decodePng } from "./png.mjs";

parentPort.on("message", ({ id, png, width, height }) => {
  try {
    const image = decodePng(Buffer.from(png));
    if (image.width !== width || image.height !== height) {
      parentPort.postMessage({ id, error: `captured ${image.width}x${image.height}, expected ${width}x${height}` });
      return;
    }
    const rgba = image.channels === 4 ? image.pixels : toRgba(image.pixels, image.channels);
    // A stage frame is opaque: analyzeFrame's alpha-as-ink count is meaningless here and is dropped.
    const { cells, luminanceP995, rgbaSha256 } = analyzeFrame(rgba, width, height);
    const buffer = rgba.buffer.slice(rgba.byteOffset, rgba.byteOffset + rgba.byteLength);
    parentPort.postMessage({ id, rgba: buffer, cells, luminanceP995, rgbaSha256 }, [buffer, cells.R.buffer, cells.G.buffer, cells.B.buffer]);
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});

function toRgba(pixels, channels) {
  const n = pixels.length / channels;
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const s = i * channels;
    out[i * 4] = pixels[s];
    out[i * 4 + 1] = pixels[channels >= 3 ? s + 1 : s];
    out[i * 4 + 2] = pixels[channels >= 3 ? s + 2 : s];
    out[i * 4 + 3] = 255;
  }
  return out;
}
