// Output scale, read once from the page URL (`?scale=2` renders 3840x2160). Scenes keep laying out
// in logical 1920x1080 px at every scale. Adapted from mexicat/pdoom-video app/src/engine/scale.ts
// (MIT, see ../NOTICE).
function readScale() {
  if (typeof location === "undefined") return 1;
  const value = Math.round(Number(new URLSearchParams(location.search).get("scale") ?? "1"));
  return Number.isFinite(value) && value >= 1 ? Math.min(value, 4) : 1;
}

/** Physical px per logical px (integer 1..4). */
export const SCALE = readScale();
export const W = 1920;
export const H = 1080;
export const PW = W * SCALE;
export const PH = H * SCALE;
