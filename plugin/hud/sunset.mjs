// The sunset under the status line: a half-sunk sun on a glittering sea, in one row of its own, with stars and the top of
// the sun in the cells of the text row that no text uses. Pure: it gets the width and how much of the text row is
// taken, and returns two painted strings. Text always wins: art starts three cells after the last word, and the sun
// drops to its one-row form when the text reaches it. agy redraws the line on events only, so the scene is a still picture
// and the same state always paints the same bytes.

const RESET = '\u001b[0m';
const FAINT = [48, 54, 61];
const SEA = [[255, 220, 115], [255, 154, 74], [255, 79, 139], [180, 87, 214], [90, 70, 168]];
const SUN = [[255, 210, 74], [255, 143, 60], [255, 45, 138]];
// YOUR TURN keeps its amber: the same scene in the waiting colours.
const AMBER_SEA = [[255, 217, 138], [255, 175, 60], [224, 138, 30], [154, 100, 32], [90, 64, 32]];
const AMBER_SUN = [[255, 201, 90], [255, 175, 60], [224, 138, 30]];

// The narrowest terminal that gets the scene, and the cells art keeps clear of words.
export const SCENE_MIN_WIDTH = 60;
export const CLEAR = 3;
const TALL = 16;
const FLAT = 12;

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

// The sun's outline in eighth-blocks: over two rows a gold dome on an orange and a pink band, in one row gold at the
// centre running to pink at the rim.
function sunCells(rows, ink) {
  const w = rows === 2 ? TALL : FLAT;
  return Array.from({ length: rows }, (_, r) => Array.from({ length: w }, (_, x) => {
    const d = (x - (w - 1) / 2) / (w / 2);
    const fill = Math.max(0, Math.min(8, Math.round(Math.sqrt(1 - d * d) * rows * 8) - (rows - 1 - r) * 8));
    if (fill === 0) return null;
    if (rows === 1) return { ch: lower(fill), fg: along(ink, Math.abs(d)) };
    if (r === 0) return { ch: lower(fill), fg: ink[0] };
    return fill < 8 ? { ch: lower(fill), fg: ink[2] } : { ch: lower(5), fg: ink[2], bg: ink[1] };
  }));
}

// The sea's light `dx` cells from under the sun, brightest on the sun's path: gold, then pink, then violet.
function seaCell(dx, sea) {
  const far = Math.abs(dx);
  const wave = Math.sin(far * 0.62) + 0.8 * Math.sin(dx * 0.31) + 0.6 * Math.sin(dx * 1.37);
  const level = wave * 0.62 + 1.05 - far / 42;
  if (level < 0.22) return null;
  return { ch: level > 1 ? '~' : level > 0.55 ? '-' : '.', fg: mix(FAINT, along(sea, far / 48), Math.min(1, 0.25 + level * 0.6)), b: level > 1.5 };
}

const STARS = [-29, -22, -17, -12, -6, 4, 9, 13, 18, 24, 29];

function paintRun(cells) {
  const key = (c) => (c ? `${c.b ? '1;' : ''}38;2;${c.fg.join(';')}${c.bg ? `;48;2;${c.bg.join(';')}` : ''}` : '');
  const last = cells.findLastIndex(Boolean);
  let out = '';
  for (let i = 0; i <= last;) {
    const codes = key(cells[i]);
    let text = '';
    for (; i <= last && key(cells[i]) === codes; i += 1) text += cells[i]?.ch ?? ' ';
    out += codes ? `\u001b[${codes}m${text}${RESET}` : text;
  }
  return out;
}

/** The scene for a text row that uses `used` of `width` cells: `tail` continues that row, `row` is the horizon below it.
 *  `amber` takes the YOUR TURN colours; `hue(x)` gives a colour per column (the rewind rainbow) instead of the sunset. */
export function horizon({ width, used, amber = false, hue = null }) {
  if (width < SCENE_MIN_WIDTH) return null;
  const size = width - 2;
  const free = (x) => x >= used + CLEAR && x < size;
  const ink = amber ? AMBER_SUN : SUN;
  const centre = Math.round(width * 0.66) + TALL / 2;
  const rows = free(centre - TALL / 2) ? 2 : 1;
  const top = Array(size).fill(null);
  const row = Array(size).fill(null);
  for (let x = 1; x < size; x += 1) row[x] = seaCell(x - centre + 0.5, amber ? AMBER_SEA : SEA);
  for (const dx of STARS) {
    const x = centre + dx + (dx < 0 ? -TALL / 2 : TALL / 2);
    if (!free(x)) continue;
    const glow = 0.5 + 0.5 * Math.sin(dx * 2.1);
    top[x] = { ch: glow > 0.85 ? '*' : glow > 0.45 ? '+' : '.', fg: mix(FAINT, dx % 2 ? [169, 155, 255] : [255, 154, 213], 0.35 + 0.65 * glow) };
  }
  sunCells(rows, ink).forEach((line, r) => line.forEach((cell, i) => {
    if (!cell) return;
    (rows === 2 && r === 0 ? top : row)[centre - line.length / 2 + i] = cell;
  }));
  if (hue) for (const line of [top, row]) line.forEach((cell, x) => { if (cell) line[x] = { ...cell, fg: hue(x, cell.bg ? 0.6 : 0.72), ...(cell.bg ? { bg: hue(x, 0.8) } : {}) }; });
  return { tail: paintRun(top.slice(used)), row: paintRun(row) };
}
