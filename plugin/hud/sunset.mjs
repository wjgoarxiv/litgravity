// The sunset inside the card: a half-sunk sun on a glittering sea, with stars around it, in the cells of the last body
// rows that no text uses. Text always wins: art keeps clear of words, the sun takes three, two or one rows and slides right to
// find room, and stays away when there is none. agy redraws the line on events only, so the scene is a still picture
// and the same state always paints the same cells.

const FAINT = [48, 54, 61];
const DARK = [26, 16, 48];
const LOOKS = {
  sunset: { sun: [[255, 210, 74], [255, 143, 60], [255, 45, 138]], sea: [[255, 220, 115], [255, 154, 74], [255, 79, 139], [180, 87, 214], [90, 70, 168]], stars: [[169, 155, 255], [255, 154, 213]] },
  // YOUR TURN keeps its amber: the same scene in the waiting colours.
  amber: { sun: [[255, 201, 90], [255, 175, 60], [224, 138, 30]], sea: [[255, 217, 138], [255, 175, 60], [224, 138, 30], [154, 100, 32], [90, 64, 32]], stars: [[255, 214, 130], [255, 176, 32]] },
};
export const SUN_W = 18;
const CLEAR = 3;

// Eight steps between two colours, so neighbouring cells share a colour and join into one run.
export const mix = (a, b, k) => {
  const n = Math.max(0, Math.min(8, Math.round(k * 8))) / 8;
  return a.map((v, i) => Math.round(v + (b[i] - v) * n));
};
/** A colour at `k` (0 to 1) along a list of stops. */
export const along = (stops, k) => {
  const at = Math.max(0, Math.min(1, k)) * (stops.length - 1);
  const i = Math.min(Math.floor(at), stops.length - 2);
  return mix(stops[i], stops[i + 1], at - i);
};

const lower = (n) => ' ▁▂▃▄▅▆▇█'[n];

// The sun's outline in eighth-blocks. Three rows: gold, a thin dark slit, orange, a thicker slit, pink. Two: a gold dome on
// an orange and a pink band. One: gold at the centre running to pink at the rim.
function sunCells(rows, ink) {
  return Array.from({ length: rows }, (_, r) => Array.from({ length: SUN_W }, (_, x) => {
    const d = (x - (SUN_W - 1) / 2) / (SUN_W / 2);
    const fill = Math.max(0, Math.min(8, Math.round(Math.sqrt(1 - d * d) * rows * 8) - (rows - 1 - r) * 8));
    if (fill === 0) return null;
    if (rows === 1) return { ch: lower(fill), fg: along(ink, Math.abs(d)) };
    if (rows === 2) {
      if (r === 0) return { ch: lower(fill), fg: ink[0] };
      return fill < 8 ? { ch: lower(fill), fg: ink[2] } : { ch: lower(5), fg: ink[2], bg: ink[1] };
    }
    if (fill < 8 || r === 0) return { ch: lower(fill), fg: ink[r] };
    return { ch: lower(r === 1 ? 7 : 6), fg: ink[r], bg: DARK };
  }));
}

// The sea's light `dx` cells from under the sun, brightest on the sun's path: gold, then pink, then violet.
function seaCell(dx, sea) {
  const far = Math.abs(dx);
  const wave = Math.sin(far * 0.62) + 0.8 * Math.sin(dx * 0.31) + 0.6 * Math.sin(dx * 1.37);
  const level = wave * 0.62 + 1.05 - far / 38;
  if (level < 0.22) return null;
  return { ch: level > 1 ? '~' : level > 0.55 ? '-' : '.', fg: mix(FAINT, along(sea, far / 48), Math.min(1, 0.25 + level * 0.6)), b: level > 1.5 };
}

// [row above the sea, columns from the sun's near edge]
const STARS = [[1, -28], [2, -23], [1, -17], [2, -12], [1, -8], [2, -5], [1, 4], [2, 7], [1, 11], [2, 14], [1, 17], [2, 21], [1, 25], [2, 30]];

/** Paints the scene into `rows` (arrays of cells; a free cell is null, `false` the second cell of a wide character) and
 *  answers where the sun stands: { at, rows }, or null when it found no room. */
export function paintScene(rows, { look = 'sunset', hue = null } = {}) {
  const { sun: ink, sea, stars } = LOOKS[look];
  const width = rows[0].length;
  const taken = rows.map((row) => row.map((c) => c !== null));
  const clear = (r, from, to) => { for (let x = from; x <= to; x += 1) if (taken[r]?.[x]) return false; return true; };
  const tint = (cell, x) => (hue ? { ...cell, fg: hue(x, cell.bg ? 0.6 : 0.72) } : cell);
  let sun = null;
  for (const tall of [3, 2, 1]) {
    if (tall > rows.length || sun) continue;
    const first = rows.length - tall;
    for (let at = Math.round(width * 0.6); at + SUN_W <= width - 2 && !sun; at += 1) {
      if (rows.slice(first).every((_, k) => clear(first + k, at - 2, at + SUN_W + 1))) sun = { at, rows: tall };
    }
  }
  const centre = (sun ? sun.at : Math.round(width * 0.62)) + SUN_W / 2 - 0.5;
  const last = rows.length - 1;
  if (sun) {
    for (const [up, dx] of STARS) {
      const r = last - up;
      const x = dx < 0 ? sun.at + dx : sun.at + SUN_W - 1 + dx;
      if (r < 0 || x < 1 || x > width - 2 || !clear(r, x - CLEAR, x + CLEAR)) continue;
      const glow = 0.5 + 0.5 * Math.sin(dx * 2.1 + up);
      rows[r][x] = tint({ ch: glow > 0.85 ? '*' : glow > 0.45 ? '+' : '.', fg: mix(FAINT, dx % 2 ? stars[0] : stars[1], 0.35 + 0.65 * glow) }, x);
    }
  }
  for (let x = 1; x < width - 1; x += 1) {
    const cell = clear(last, x - CLEAR, x + CLEAR) ? seaCell(x - centre, sea) : null;
    if (cell) rows[last][x] = tint(cell, x);
  }
  if (sun) {
    sunCells(sun.rows, ink).forEach((line, r) => line.forEach((cell, i) => {
      if (cell) rows[rows.length - sun.rows + r][sun.at + i] = tint(cell, sun.at + i);
    }));
  }
  return sun;
}
