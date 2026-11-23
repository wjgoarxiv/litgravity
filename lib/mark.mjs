// The LIT synthwave mark at the top of `help`, `install` and `doctor`. Human-facing CLI output only: no hook, rule,
// activation note or status line ever prints it, because those reach the model or agy's one-line status bar.
//
// When stdout is not a terminal (a pipe, an agent's tool call, a CI log) printMark writes the one plain line
// `LIT · antigravity` and nothing else; the caller's own version line follows it. On a terminal, width picks the size
// (B-L from 76 columns, B-M from 44, B-S from 24, else the plain line). With colour the pixel rows are drawn two pixels
// per cell with half blocks; without colour (NO_COLOR, TERM=dumb, a 16-colour terminal) the glyph rows are printed as
// they are, so the scene keeps its sun, horizon and floor with no escape byte.
import { MONO_ROWS, PIXEL_ROWS, SHARED_COLOURS } from './synthwave-data.mjs';
import { colorDepth } from '../plugin/hud/render.mjs';

export const HOST = 'antigravity';
export const PLAIN_LINE = `LIT · ${HOST}`;
// LitGravity chrome: pale sky at the top of each letter down to deep blue at its base.
export const CHROME = Object.freeze(['#e8f0ff', '#93c5fd', '#2563eb', '#ffffff', '#bfdbfe', '#1e3a8a']);
const TAGLINE = Object.freeze(['#8be9fd', '#ff2d95', '#ffd23f']);
const EDGE = '#ffffff';
export const SIZES = Object.freeze([['B-L', 76], ['B-M', 44], ['B-S', 24]]);

const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

function sample(stops, t) {
  const n = stops.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  const f = t * n - i;
  const a = rgb(stops[i]);
  const b = rgb(stops[i + 1]);
  return a.map((v, k) => Math.round(v + (b[k] - v) * f));
}

function colourOf(sym) {
  if (sym === ' ') return null;
  if (sym >= 'a' && sym <= 'l') return sample(CHROME, (sym.charCodeAt(0) - 97) / 11);
  if (sym === 'm') return rgb(EDGE);
  return SHARED_COLOURS[sym] ? rgb(SHARED_COLOURS[sym]) : null;
}

const cube = ([r, g, b]) => 16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5);
const code = (c, bg, depth) => (depth === 'truecolor' ? `${bg ? 48 : 38};2;${c.join(';')}` : `${bg ? 48 : 38};5;${cube(c)}`);

function cell(ch, fg, bg, depth) {
  const codes = [fg && code(fg, false, depth), bg && code(bg, true, depth)].filter(Boolean);
  return codes.length ? `\u001b[${codes.join(';')}m${ch}\u001b[0m` : ch;
}

const same = (a, b) => (a === null || b === null ? a === b : a.join() === b.join());

/** The size that fits `cols` cells, or null below 24. An unknown width counts as 80. */
export function pickSize(cols) {
  const width = Number.isFinite(cols) && cols > 0 ? Math.floor(cols) : 80;
  return SIZES.find(([, min]) => width >= min)?.[0] ?? null;
}

function artRows(size, depth) {
  const px = PIXEL_ROWS[size];
  const rows = [];
  for (let y = 0; y < px.length; y += 2) {
    let line = '';
    for (let x = 0; x < px[y].length; x += 1) {
      const top = colourOf(px[y][x]);
      const low = colourOf(px[y + 1][x]);
      if (same(top, low)) line += top ? cell(' ', null, top, depth) : ' ';
      else if (top === null) line += cell('▄', low, null, depth);
      else line += cell('▀', top, low, depth);
    }
    rows.push(line);
  }
  return rows;
}

function tagline(width, depth) {
  const pad = ' '.repeat(Math.max(0, Math.floor((width - PLAIN_LINE.length) / 2)));
  if (depth === 'mono') return pad + PLAIN_LINE;
  const glyphs = [...PLAIN_LINE];
  return pad + glyphs.map((ch, i) => (ch === ' ' ? ch : cell(ch, sample(TAGLINE, i / (glyphs.length - 1)), null, depth))).join('');
}

/** Rows of the mark. depth: 'truecolor' | '256' draw colour; anything else prints the glyph rows. */
export function markRows({ cols, depth = 'mono' } = {}) {
  const size = pickSize(cols);
  if (size === null) return [PLAIN_LINE];
  const d = depth === 'truecolor' || depth === '256' ? depth : 'mono';
  const art = d === 'mono' ? [...MONO_ROWS[size]] : artRows(size, d);
  return [...art, tagline(PIXEL_ROWS[size][0].length, d)];
}

/** The depth the CLI draws at: colour only on a terminal that offers 256 colours or more. */
export function markDepth(env = process.env, stream = process.stdout) {
  if (!stream?.isTTY) return 'mono';
  const depth = colorDepth(env);
  return depth === 'truecolor' || depth === '256' ? depth : 'mono';
}

function columnsOf(env, stream) {
  const fromStream = Number(stream?.columns);
  if (Number.isFinite(fromStream) && fromStream > 0) return fromStream;
  const fromEnv = Number(env.COLUMNS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : undefined;
}

/** On a terminal prints the mark and one empty line; anywhere else only the plain line. */
export function printMark(print, env = process.env, stream = process.stdout) {
  if (!stream?.isTTY) {
    print(PLAIN_LINE);
    return;
  }
  for (const row of markRows({ cols: columnsOf(env, stream), depth: markDepth(env, stream) })) print(row);
  print('');
}
