// The status line as a framed card, for a truecolor dark terminal: the title edge with the mark, the route and the state
// word; the stage map; the task and the last tool; threads and lanes; skill chips; context, limits and git on the bottom
// edge; the sunset in the cells left over. Pure: render.mjs hands it a model made of recorded facts, and a part with no
// fact behind it is left out. Every row is exactly `width` cells, whatever the host's strings hold.
import { CAPS } from './glyphs.mjs';
import { SUN_W, along, mix, paintScene } from './sunset.mjs';

export const CARD_MIN_WIDTH = 60;
export const CARD_MIN_HEIGHT = 20;
const TALL_BODY = 6; // the body rows of a window of 24 rows
const C = {
  text: [230, 237, 243], dim: [125, 133, 144], faint: [72, 79, 88], track: [42, 35, 64], ink: [11, 14, 20],
  green: [86, 211, 120], amber: [255, 176, 32], red: [255, 94, 94], yellow: [224, 175, 60], pink: [255, 45, 149], violet: [180, 140, 255], gold: [255, 210, 74],
};
export const BRAND = [[255, 160, 51], [255, 106, 85], [255, 51, 136]];
export const ACCENT = [255, 99, 55];
export const NEON = [C.pink, C.violet, ACCENT];
export const STAGE = [C.violet, ACCENT];

// --- text -------------------------------------------------------------------------------------------------------------

// Host strings are data: one line, no controls, and none of the joiners, selectors and modifiers whose width terminals disagree on.
export const tame = (value) => String(value ?? '').normalize('NFC').replace(/[\p{Cc}\p{Zl}\p{Zp}\s]+/gu, ' ')
  .replace(/[\p{Cf}\p{Co}\p{Cs}\p{Cn}︀-️⃣\u{1f1e6}-\u{1f1ff}\u{1f3fb}-\u{1f3ff}\u{e0100}-\u{e01ef}]/gu, '').trim();

function widthOf(ch) {
  const cp = ch.codePointAt(0);
  if (cp < 0x300) return 1;
  if (/[\p{Mn}\p{Me}\p{Cf}]/u.test(ch) || (cp >= 0x1160 && cp <= 0x11ff)) return 0;
  if (/\p{Emoji_Presentation}/u.test(ch) || (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) || (cp >= 0xa960 && cp <= 0xa97c)
    || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60)
    || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd)) return 2;
  return 1;
}
export const cellsOf = (text) => [...text].reduce((w, ch) => w + widthOf(ch), 0);
export function clip(text, cells) {
  if (cellsOf(text) <= cells) return text;
  let out = '';
  let w = 0;
  for (const ch of text) {
    if (w + widthOf(ch) > cells - 1) break;
    out += ch;
    w += widthOf(ch);
  }
  return cells > 0 ? `${out.trimEnd()}…` : '';
}

const s = (t, fg = C.text, extra = {}) => ({ t, fg, ...extra });
const bold = (t, fg = C.text) => s(t, fg, { b: true });
const size = (spans) => spans.reduce((w, sp) => w + cellsOf(sp.t), 0);

// --- pills and gauges, round or square, always in the same cells --------------------------------------------------------

function pill(text, stops, round) {
  const chars = [...text];
  const at = (i) => (stops.length > 1 ? along(stops, chars.length > 1 ? i / (chars.length - 1) : 0) : stops[0]);
  const body = chars.map((ch, i) => ({ t: ch, fg: C.ink, bg: at(i), b: true }));
  return round
    ? [s(CAPS[0], at(0), { cap: true }), ...body, s(CAPS[1], at(chars.length - 1), { cap: true })]
    : [{ t: ' ', fg: C.ink, bg: at(0) }, ...body, { t: ' ', fg: C.ink, bg: at(chars.length - 1) }];
}

function gauge(share, cells, color, round) {
  const eighths = Math.round(Math.max(0, Math.min(1, share)) * cells * 8);
  const lit = share > 0 ? Math.max(eighths, 8) : 0; // any progress lights the first cell
  return Array.from({ length: cells }, (_, i) => {
    const part = Math.max(0, Math.min(8, lit - i * 8));
    if (round && i === 0) return s(CAPS[0], lit ? color : C.track, { cap: true });
    if (round && i === cells - 1) return s(CAPS[1], part >= 4 ? color : C.track, { cap: true });
    if (part === 0 || part === 8) return { t: ' ', fg: C.ink, bg: part ? color : C.track };
    return { t: ' ▏▎▍▌▋▊▉'[part], fg: color, bg: C.track };
  });
}

const count = (done, total) => [bold(String(done)), s(`/${total}`, C.dim)];
export const band = (pct, calm) => (pct >= 90 ? C.red : pct >= 70 ? C.yellow : calm);

// --- parts ------------------------------------------------------------------------------------------------------------

// The stage map in words: finished stops warm with a check and a heavy rail behind, the current stop a pill, the rest dim.
// Whole words are the first two forms; `whole` asks for one of those or nothing.
function mapSpans({ labels, current }, room, { round, amber, whole = false }) {
  const warm = amber ? C.amber : ACCENT;
  const stop = (label, i, cut) => {
    const text = cut ? label.replace(/^[A-Za-z]+/, (w) => w.slice(0, 3)) : label;
    if (i === current) return pill(text, amber ? [C.amber] : STAGE, round);
    return i < current ? [s(text, warm), bold(' ✓', warm)] : [s(text, C.dim), s(' ·', C.faint)];
  };
  const rail = (i, long) => {
    const n = long ? 2 : 1;
    if (i <= current) return s(` ${'━'.repeat(n)} `, warm, { b: true });
    return i === current + 1 ? s(` ${'━'.repeat(n)} `, C.dim) : s(` ${'─'.repeat(n)} `, C.faint);
  };
  const track = ({ rails, cut, window }) => {
    const shown = labels.map((_, i) => i).filter((i) => !window || Math.abs(i - current) <= 1);
    const out = window && shown[0] > 0 ? [s('… ', C.dim)] : [];
    shown.forEach((i, k) => { if (k) out.push(rails ? rail(i, rails > 1) : s(' ')); out.push(...stop(labels[i], i, cut)); });
    if (window && shown.at(-1) < labels.length - 1) out.push(s(' …', C.dim));
    return out;
  };
  const fits = (forms) => forms.map(track).find((f) => size(f) <= room);
  const words = fits([{ rails: 2 }, { rails: 1 }]);
  if (words || whole) return words ?? null;
  return fits([{ rails: 1, cut: true }, { rails: 0, cut: true }, { rails: 0, cut: true, window: true }]) ?? stop(labels[Math.min(current, labels.length - 1)], current, true);
}

const TONE = { running: C.green, idle: C.dim, paused: C.dim, reported: C.dim, pending: C.dim, waiting: C.amber, blocked: C.red, failed: C.red, done: ACCENT, passed: C.green };
const MARK = { done: '✓', reported: '✓', passed: '✓', blocked: '✗', failed: '✗', pending: '·', paused: '‖' };

// Threads and lanes share their columns: name, stage, gauge with its count, state.
function rosterRows(model, limit, { round }) {
  const { threads, lanes } = model;
  if (!threads.length && !lanes.length) return [];
  const rows = [];
  const nameW = Math.min(20, Math.max(...threads.map((t) => cellsOf(t.name)), ...lanes.map((l) => cellsOf(l.name) + 3)) + 1);
  const stageW = Math.max(0, ...threads.map((t) => cellsOf(t.stage ?? '')));
  const line = (r, lead, indent) => {
    const tone = TONE[r.state] ?? C.dim;
    const live = r.state === 'running';
    const name = clip(r.name, nameW - indent);
    const out = [...lead, live || r.state === 'done' ? bold(name) : s(name, r.state === 'paused' || r.state === 'pending' ? C.dim : C.text), s(' '.repeat(nameW - indent - cellsOf(name) + 1))];
    if (stageW) out.push(s(r.stage ?? '', C.dim), s(' '.repeat(stageW - cellsOf(r.stage ?? '') + 1)));
    const known = Number.isInteger(r.total) && r.total > 0;
    if (known) out.push(...gauge(r.done / r.total, 5, tone, round), s(' '), ...count(r.done, r.total), s(' '));
    else if (rosterGauge) out.push(live ? s('─────', C.faint) : s('     '), s('     '));
    out.push(s(r.state, tone));
    if (r.note) out.push(s(` · ${r.note}`, C.dim));
    return out;
  };
  const rosterGauge = [...threads, ...lanes].some((r) => r.total > 0);
  for (const t of threads) rows.push(line(t, [s(`${MARK[t.state] ?? '●'} `, TONE[t.state] ?? C.dim)], 0));
  if (lanes.length) {
    rows.push([s('┬ ', C.dim), bold(String(lanes.length)), s(` ${model.lanesWord}`, C.dim)]);
    const room = Math.max(1, limit - rows.length);
    // With no room for all, a lane in trouble is never the hidden one.
    const loud = (l) => (['failed', 'blocked', 'waiting'].includes(l.state) ? 0 : l.state === 'running' ? 1 : 2);
    const picked = lanes.length > room ? new Set([...lanes].sort((a, b) => loud(a) - loud(b)).slice(0, room - 1)) : new Set(lanes);
    const shown = lanes.filter((l) => picked.has(l));
    shown.forEach((l, i) => rows.push(line(l, [s(i === shown.length - 1 && shown.length === lanes.length ? '└─ ' : '├─ ', C.dim), s(`${MARK[l.state] ?? '●'} `, l.color ?? TONE[l.state] ?? C.dim)], 3)));
    if (shown.length < lanes.length) rows.push([s('└─ ', C.dim), s(`+${lanes.length - shown.length} more`, C.dim)]);
  }
  return rows.slice(0, limit);
}

const NEXT_MIN = 12; // cells the next step's words keep when they make room for the sun
function taskSpans(task, room, { round, amber }) {
  const out = [s('└ ', C.dim)];
  if (task.alert) out.push(bold(task.alert, task.tone === 'red' ? C.red : task.tone === 'green' ? C.green : C.amber));
  if (task.label) out.push(s(task.alert ? ' · ' : '', C.dim), s(`${task.label}${task.total ? ' ' : ''}`, task.plain ? C.text : C.dim));
  if (task.total) out.push(...count(task.done, task.total), s(' '), ...gauge(task.done / task.total, 8, amber ? C.amber : ACCENT, round));
  if (!task.next) return out;
  out.push(s(' · next ', C.dim), s('▸ ', amber ? C.amber : ACCENT));
  const left = room - size(out);
  return [...out, s(left >= NEXT_MIN ? clip(task.next, left) : task.next)];
}

// --- the frame --------------------------------------------------------------------------------------------------------

function cellsRow(inner, left, right) {
  const row = Array(inner).fill(null);
  const place = (spans, from, to) => {
    let x = from;
    const over = size(spans) > to - from;
    for (const sp of spans) {
      for (const ch of sp.t) {
        const w = widthOf(ch);
        if (w === 0) { const prev = row.slice(0, x).findLast((c) => c); if (prev && x > from) prev.ch += ch; continue; }
        if (x + w > to - (over ? 1 : 0)) { if (x < to) row[x] = { ch: '…', fg: C.dim }; return to; }
        if (ch !== ' ' || sp.bg) row[x] = { ch, fg: sp.fg, bg: sp.bg, b: sp.b, cap: sp.cap };
        if (w === 2) row[x + 1] = false;
        x += w;
      }
    }
    return x;
  };
  const r = size(right);
  const keep = r && size(left) + r + 2 <= inner;
  place(left, 0, keep ? inner - r - 2 : inner);
  if (keep) place(right, inner - r, inner);
  return row;
}

function emit(cells) {
  let out = '';
  let run = '';
  let key = '';
  const flush = () => { if (run) out += key ? `\u001b[${key}m${run}\u001b[0m` : run; run = ''; };
  for (const c of cells) {
    if (c === false) continue;
    if (c === null && !key.includes('48;')) { run += ' '; continue; } // a blank joins the run it stands in
    const k = c ? `${c.b ? '1;' : ''}38;2;${c.fg.join(';')}${c.bg ? `;48;2;${c.bg.join(';')}` : ''}` : '';
    if (k !== key) { flush(); key = k; }
    run += c?.ch ?? ' ';
  }
  flush();
  return out;
}

/** The card's rows, each `width` cells. `bodyRows` caps the rows between the edges. */
export function drawCard(model, { width, bodyRows, round, hue = null }) {
  const inner = width - 4;
  const amber = model.look === 'your-turn';
  const opts = { round, amber };
  const accent = amber ? C.amber : ACCENT;
  const tone = { accent, amber: C.amber, red: C.red, green: C.green, dim: C.dim, pink: C.pink }[model.word.tone];

  // Body: the map, the task, the roster, the skills; three rows at least, so the sun has its place and an idle card
  // and a working one stand equally tall until lanes run.
  const lanesDots = model.lanes.filter((l) => l.state === 'running');
  const toolSpans = (name) => [s('› ', accent), bold(name), s(` · ${model.tool.age}`, C.dim)];
  const tool = model.tool ? toolSpans(model.tool.name) : [];
  const right = [
    lanesDots.length ? [...lanesDots.slice(0, 5).map(() => s('●', C.green)), bold(` ${lanesDots.length}`), s(lanesDots.length === 1 ? ' lane' : ' lanes', C.dim)] : [],
    tool,
  ].filter((r) => r.length);
  const head = [];
  if (model.map) head.push((room) => mapSpans(model.map, room, opts));
  if (model.task) head.push((room) => taskSpans(model.task, sunRow ? Math.min(room, inner - SUN_W - 4) : room, opts));
  for (const note of model.notes) head.push(() => [s(note, C.dim)]);
  const skills = model.skills.length ? [s('skills ', C.dim), ...model.skills.flatMap((name, i) => [s(i ? ' ' : ''), ...pill(name, amber ? [C.amber] : STAGE, round)])] : null;
  // In a short window the lanes come before the skills, and before a single thread that only repeats the title.
  const free = Math.max(0, bodyRows - head.length);
  const lanesNeed = model.lanes.length ? model.lanes.length + 1 : 0;
  const threads = model.lanes.length && model.threads.length === 1 && 1 + lanesNeed > free ? [] : model.threads;
  const withSkills = skills && threads.length + lanesNeed + 1 <= free;
  const roster = rosterRows({ ...model, threads }, free, opts);
  const lefts = [...head, ...roster.map((r) => () => r), ...(withSkills ? [() => skills] : [])].slice(0, bodyRows);
  // A card with a map keeps one free row more where the window has it, so the tool beside the map leaves the sun its dome.
  const sunRow = model.map && !roster.length && bodyRows >= TALL_BODY;
  while (lefts.length < Math.min(sunRow ? 4 : 3, bodyRows)) lefts.push(() => []);
  // Whole stage words come before the tool: its name is shortened first, then left out.
  const whole = (r) => mapSpans(model.map, inner - (r.length ? size(r) + 3 : 0), { ...opts, whole: true });
  if (model.map && right.length && !whole(right[0])) {
    const shorter = right[0] === tool ? [10, 8, 6].filter((n) => n < cellsOf(model.tool.name)).map((n) => toolSpans(clip(model.tool.name, n))) : [];
    right[0] = [...shorter, []].find(whole) ?? right[0];
  }
  const grid = lefts.map((left, i) => cellsRow(inner, left(inner - (right[i]?.length ? size(right[i]) + 3 : 0)), right[i] ?? []));
  const sceneRows = grid.slice(-3);
  const sun = paintScene(sceneRows, { look: amber ? 'amber' : 'sunset', hue });

  const stops = amber ? [C.amber, [255, 214, 130], C.amber] : model.word.tone === 'red' ? [C.red, C.pink, C.red] : NEON;
  const border = (x) => (hue ? hue(x, 0.65) : along(stops, Math.floor(x / 3) * 3 / width));
  const edge = (open, close, left, rightSide, glow) => {
    const cells = Array.from({ length: width }, (_, x) => {
      const near = glow ? Math.max(0, 1 - Math.abs(x - glow) / 24) : 0;
      return { ch: '─', fg: near ? mix(border(x), near > 0.6 ? C.gold : [255, 143, 60], near) : border(x) };
    });
    cells[0].ch = open;
    cells[width - 1].ch = close;
    const put = (spans, from, to) => {
      const row = cellsRow(to - from, spans, []);
      row.forEach((c, i) => { cells[from + i] = c; });
    };
    const rw = size(rightSide);
    const lw = Math.min(size(left), width - 6 - (rw ? rw + 4 : 0));
    if (lw > 0) put([s(' '), ...left, s(' ')], 2, 2 + lw + 2);
    if (rw && lw + rw + 10 <= width) put([s(' '), ...rightSide, s(' ')], width - 4 - rw, width - 2);
    return cells;
  };

  const title = [...pill('🔥 LIT', amber ? [C.amber] : BRAND, round), s(' · ', C.dim), bold(model.crumb, model.route ? accent : C.text)];
  for (const c of model.crumbTail) title.push(s(` ${c.t}`, c.tone === 'pink' ? C.pink : C.dim, { b: c.tone === 'pink' }));
  const word = [bold(model.word.text, tone), s(' '), s(model.word.mark, tone)];
  const top = edge('╭', '╮', title, word, null);

  // The bottom edge drops its parts from the end until they fit; context stays to the last.
  const parts = model.edge.map((p) => [s(`${p.label}${p.label ? ' ' : ''}`, C.dim), ...(p.pct === undefined ? [s(p.text, p.tone === 'dim' ? C.dim : C.text)] : [bold(p.text, band(p.pct, accent)), ...(p.gauge ? [s(' '), ...gauge(p.pct / 100, p.gauge, band(p.pct, accent), round)] : [])]), ...(p.after ? [s(` ${p.after}`, C.dim)] : [])]);
  const keep = parts.map((_, i) => i);
  const joined = () => keep.flatMap((i, k) => [...(k ? [s(' · ', C.dim)] : []), ...parts[i]]);
  const tail = [s(model.version, C.dim)];
  const roomFor = (t) => width - 6 - (t.length ? size(t) + 4 : 0);
  const rank = model.edge.map((p) => p.prio);
  while (keep.length > 1 && size(joined()) > roomFor(tail)) keep.splice(keep.indexOf(keep.reduce((a, b) => (rank[b] > rank[a] ? b : a))), 1);
  const bottom = edge('╰', '╯', joined(), tail, sun ? sun.at + 2 + 9 : null);

  const wall = (x) => ({ ch: '│', fg: border(x) });
  const paintHue = (row) => (hue ? row.map((c, x) => (c && c.fg !== C.ink && !c.cap && c.ch !== '│' && !'╭╮╰╯─'.includes(c.ch) && !c.bg ? { ...c, fg: hue(x, 0.66) } : c)) : row);
  return [top, ...grid.map((row) => [wall(0), null, ...row, null, wall(width - 1)]), bottom].map((row) => emit(paintHue(row)));
}
