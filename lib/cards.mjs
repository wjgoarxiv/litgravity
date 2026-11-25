// The install and uninstall screens for a person at a terminal: a card per question, a row per finished step, a panel
// for the plan and the result, a card for the work. Round or square (plugin/hud/glyphs.mjs) is decided once per run. openCards() answers null wherever the plain lines must stay as they are (a pipe, CI,
// --yes, --dry-run, TERM=dumb, LITGRAVITY_AGENT_FILE, a window under 40x12); callers then print those.
import { emitKeypressEvents } from 'node:readline';
import { NEON, PILL_INK, colorDepth, lightGround } from '../plugin/hud/render.mjs';
import { CAPS, roundGlyphs } from '../plugin/hud/glyphs.mjs';
import { displayWidth } from '../plugin/hooks/lib/rewind/gauge.mjs';
import { markDepth, markRows } from './mark.mjs';

const SMALLEST = { columns: 40, rows: 12 };
const WIDEST = 100;
const SETTLE_MS = 30; // keys typed before a card shows are dropped
const ECHO_MS = 400; // an Enter this soon after a y or n belongs to that answer, not to the next card
const VALUE_AT = 24; // the column every value starts at, in folded rows, panels and work steps
const TEXT_AT = 3;

const [PINK, VIOLET, ACCENT] = NEON;
const TONES = {
  pink: [PINK, 198, 95], violet: [VIOLET, 141, 94], accent: [ACCENT, 202, 93], orange: [[255, 143, 60], 214, 93], ink: [PILL_INK, 16, 30],
  good: [[80, 230, 140], 78, 92], warn: [[255, 176, 46], 214, 93], bad: [[255, 85, 119], 204, 91],
};
const RAMPS = { border: ['pink', 'violet', 'accent'], pill: ['orange', 'pink'], button: ['pink', 'violet'], bad: ['bad', 'bad'] };
const DRAWN = { line: '╭╮╰╯─│', heavy: '╔╗╚╝═║', good: '✓', bad: '✗', warn: '!', plan: '·', busy: '⠿', here: '❯', arrows: '← →' };
const TYPED = { line: '++++-|', heavy: '####=#', good: 'ok', bad: 'x', warn: '!', plan: '-', busy: '*', here: '>', arrows: 'Left Right' };
const SPELLED = { '·': '-', '—': '-', '→': '->', '…': '...' };

const width = (text) => displayWidth(text.replace(/\x1b\[[0-9;]*m/g, ''));
const fill = (text, to) => text + ' '.repeat(Math.max(0, to - width(text)));

/** Breaks text at spaces to `to` columns and keeps its indent; a longer word runs on to the next row, never cut off. */
export function flow(text, to) {
  const indent = text.match(/^ */)[0];
  const rows = [];
  let row = '';
  for (let word of text.trim().split(/ +/)) {
    if (row && width(`${indent}${row} ${word}`) <= to) {
      row += ` ${word}`;
      continue;
    }
    if (row) rows.push(row);
    while (width(indent + word) > to) {
      let head = '';
      for (const ch of word) {
        if (width(indent + head + ch) > to) break;
        head += ch;
      }
      rows.push(head);
      word = word.slice(head.length);
    }
    row = word;
  }
  return [...rows, row].map((r) => indent + r);
}

function brush(depth) {
  const sgr = (codes, text) => (depth === 'plain' || text === '' ? text : `\x1b[${codes.join(';')}m${text}\x1b[0m`);
  const colour = ([rgb, c256, c16], ground) => {
    if (depth === 'truecolor') return `${ground ? 48 : 38};2;${rgb.join(';')}`;
    return depth === '256' ? `${ground ? 48 : 38};5;${c256}` : String(c16 + (ground ? 10 : 0));
  };
  // One ramp over `of` columns, starting at column `from`, so a border broken by its title stays one ramp.
  const ramp = (name, text, { from = 0, of = [...text].length, ground = false } = {}) => {
    const tones = RAMPS[name].map((tone) => TONES[tone]);
    const at = (i) => {
      const t = Math.min(1, (from + i) / Math.max(1, of - 1)) * (tones.length - 1);
      const k = Math.min(tones.length - 2, Math.floor(t));
      const near = tones[Math.round(t)];
      const mixed = tones[k][0].map((v, c) => Math.round(v + (tones[k + 1][0][c] - v) * (t - k)));
      return colour([mixed, near[1], near[2]], ground);
    };
    let out = '';
    let run = '';
    let code = null;
    const close = () => { if (run) out += sgr(ground ? ['1', colour(TONES.ink), code] : [code], run); };
    [...text].forEach((ch, i) => {
      const next = at(i);
      if (next !== code) {
        close();
        run = '';
        code = next;
      }
      run += ch;
    });
    close();
    return out;
  };
  return { ramp, bold: (t) => sgr(['1'], t), dim: (t) => sgr(['2'], t), tone: (name, t) => sgr(['1', colour(TONES[name])], t) };
}

const capital = (label) => label[0].toUpperCase() + label.slice(1);
/** Panel rows for what is about to happen, from `[label, value]` pairs. */
export const planned = (pairs) => pairs.map(([label, value]) => ({ mark: 'plan', label: capital(label), value }));

/** The user's folder as `~` in text people read; a command keeps its whole path. */
export const tilde = (home) => (text) => (home.length < 2 ? String(text) : String(text).split(home).map((part, i, all) => (i === 0 ? part : (/^[/\\]|^$|^[^\w.-]/.test(part) ? '~' : home) + part)).join(''));

export function openCards({ env = process.env, flags = {}, stdin = process.stdin, stdout = process.stdout, ...rest } = {}) {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== 'function') return null;
  if (env.CI || /^dumb$/i.test(env.TERM ?? '') || env.LITGRAVITY_AGENT_FILE || flags.yes || flags.dryRun) return null;
  if ((stdout.columns || 80) < SMALLEST.columns || (stdout.rows || 24) < SMALLEST.rows) return null;
  return makeCards({ env, stdin, stdout, ...rest });
}

export function makeCards({ env, stdin, stdout, host = process, clock = Date.now, settleMs = SETTLE_MS }) {
  const depth = colorDepth(env);
  const { ramp, bold, dim, tone } = brush(depth);
  const locale = env.LC_ALL || env.LC_CTYPE || env.LANG || 'UTF-8';
  const ascii = !/utf-?8/i.test(locale);
  // Decided once: round pills and buttons, or square ones in the same cells.
  const round = depth === 'truecolor' && !ascii && !lightGround(env) && roundGlyphs(env);
  const sign = ascii ? TYPED : DRAWN;
  const gutter = width(sign.good) + 1;
  const says = (text) => (ascii ? String(text).replace(/[·—→…]/g, (ch) => SPELLED[ch]) : String(text));
  const columns = () => stdout.columns || 80;
  const screenRows = () => stdout.rows || 24;
  const outer = () => Math.min(WIDEST, columns() - 2);
  const room = () => outer() - 4;
  const badge = (mark) => tone({ good: 'good', bad: 'bad', warn: 'warn', plan: 'violet', busy: 'accent' }[mark], sign[mark]);

  // One blank row between blocks, never two; finished steps stand on consecutive rows.
  let last = 'block';
  const lead = (kind) => (kind === 'fold' && last === 'fold' ? [] : ['']);
  const put = (kind, lines) => {
    stdout.write(`${[...lead(kind), ...lines].join('\n')}\n`);
    last = kind;
  };

  // A filled pill: its two end cells are the caps in the round form and plain filled cells in the square one.
  const chip = (name, text) => {
    const of = [...text].length + 2;
    if (depth === 'plain') return `[${text}]`;
    if (!round) return ramp(name, ` ${text} `, { ground: true });
    return ramp(name, CAPS[0], { of }) + ramp(name, text, { from: 1, of, ground: true }) + ramp(name, CAPS[1], { from: of - 1, of });
  };

  const boxed = ({ tag, title, rows, bad = false }) => {
    const [tl, tr, bl, br, h, v] = sign.line;
    const w = outer();
    const edge = (text, from) => ramp(bad ? 'bad' : 'border', text, { from, of: w });
    const pill = chip('pill', tag);
    const name = says(title);
    const beside = width(pill) + width(name) + 9 <= w;
    const head = beside ? ` ${pill} ${dim(says('·'))} ${bold(name)} ` : ` ${pill} `;
    const used = 2 + width(head);
    const body = beside ? rows : [...flow(name, w - 4).map(bold), ...rows];
    return [
      ` ${edge(tl + h, 0)}${head}${edge(h.repeat(w - used - 1) + tr, used)}`,
      ...body.map((r) => ` ${edge(v, 0)} ${fill(r, w - 4)} ${edge(v, w - 1)}`),
      ` ${edge(bl + h.repeat(w - 2) + br, 0)}`,
    ];
  };

  // ` ✓ label   value`: the value at its column, pushed right by a longer label; one space when the row would not fit.
  const foldRows = (mark, label, value) => {
    const name = says(label);
    const text = says(value);
    const start = ` ${fill(badge(mark), gutter)}`;
    const wide = `${start}${fill(name, VALUE_AT - 2 - gutter)} `;
    const at = width(wide) + width(text) < columns() ? wide : `${start}${name} `;
    return flow(text, Math.max(12, columns() - 1 - width(at))).map((r, i) => (i === 0 ? at : ' '.repeat(width(at))) + bold(r));
  };

  /** One finished step, warning or failure. */
  const step = (mark, label, value) => put('fold', foldRows(mark, label, value));

  /** Plain rows under the cards: a decline, or a command that must stay in one piece. */
  const say = (...lines) => put('block', lines.map((line) => ` ${says(line)}`));

  /** The mark over the cards, as large as the window holds beside the first card, then the product line and the intro. */
  const open = (product, intro) => {
    const w = outer();
    const tallest = screenRows() >= 48 ? w : screenRows() >= 34 ? 75 : 43;
    const art = markRows({ cols: Math.min(w, tallest), depth: markDepth(env, stdout) });
    const span = Math.max(...art.map(width));
    const indent = ' '.repeat(1 + Math.max(0, Math.floor((w - span) / 2)));
    const under = ' '.repeat(Math.max(0, Math.floor((span - width(product)) / 2)));
    put('block', [...art.map((r) => indent + r), indent + under + product]);
    put('block', flow(says(intro), w).map((r) => ` ${dim(r)}`));
  };

  /** A heading and its text. A line two spaces in is a command: it keeps its one line, so it can be copied. */
  const notes = (heading, lines) => put('block', [` ${bold(says(heading))}`, ...lines.flatMap((line) => (
    line.startsWith('  ') ? [`  ${line}`] : flow(`   ${says(line)}`, outer())
  ))]);

  /** Sections of `{head, rows: [{mark, label, value}]}` in one frame. Values wrap and are shown whole. */
  const panel = ({ title, sections, bad = false }) => {
    const beside = room() >= 56;
    const rows = sections.flatMap((s) => ['', ...(s.head ? [tone(bad ? 'bad' : 'pink', s.head)] : []), ...s.rows.flatMap(({ mark = 'good', label = '', value }) => {
      const loud = mark === 'bad' || mark === 'warn' ? bold : (r) => r;
      const start = fill(badge(mark), gutter);
      const at = label && beside ? Math.max(VALUE_AT - TEXT_AT, gutter + width(label) + 1) : gutter;
      const text = [value].flat().flatMap((v) => flow(says(v), room() - at)).map(loud);
      if (label && !beside) return [start + bold(label), ...text.map((r) => ' '.repeat(gutter) + r)];
      return text.map((r, i) => (i === 0 ? fill(start + bold(label), at) : ' '.repeat(at)) + r);
    })]);
    put('block', boxed({ tag: 'LIT', title, rows, bad }));
  };

  /** A card of steps that run now: `[{name, text}]`. `run(fn)` draws the next step as busy, then done or failed by what fn
   *  answers (false or a throw is a failure, which leaves the card on screen); `fold(label)` replaces the card with one row. */
  const work = (title, steps) => {
    const done = [];
    let drawn = 0;
    const draw = (busy) => {
      const names = Math.max(...steps.map((s) => width(s.name)));
      const texts = Math.max(...steps.map((s) => width(says(s.text))));
      const wide = VALUE_AT - TEXT_AT - gutter;
      const pad = Math.max(names + 2, wide) + gutter + texts <= room() ? Math.max(names + 2, wide) : names + 2;
      const rows = steps.map((s, i) => {
        const mark = done[i] ?? (busy && i === done.length ? 'busy' : 'plan');
        const text = gutter + pad + width(says(s.text)) <= room() ? dim(says(s.text)) : '';
        const name = mark === 'busy' || mark === 'bad' ? bold(s.name) : mark === 'plan' ? dim(s.name) : s.name;
        return fill(mark === 'plan' ? dim(sign.plan) : badge(mark), gutter) + fill(name, pad) + text;
      });
      const card = [...lead('block'), ...boxed({ tag: 'LIT', title, rows: ['', ...rows] })];
      stdout.write(`${drawn ? `\x1b[${drawn}A\r` : ''}${card.map((r) => `${r}\x1b[K\n`).join('')}`);
      drawn = card.length;
    };
    return {
      run(fn) {
        draw(true);
        let ok = false;
        try {
          const result = fn();
          ok = result?.ok !== false;
          return result;
        } finally {
          done.push(ok ? 'good' : 'bad');
          draw(false);
          if (!ok) last = 'block';
        }
      },
      fold(label) {
        stdout.write(`\x1b[${drawn}A\r\x1b[J`);
        step('good', label, `${done.length} of ${steps.length} checked`);
      },
    };
  };

  const buttons = (yes, big) => {
    const wide = room() >= 44;
    const size = wide ? 15 : 13;
    const pair = [true, false].map((value) => {
      const on = value === yes;
      const label = fill(`${on ? sign.here : ' '} ${value ? 'Yes' : wide ? 'No (default)' : 'No default'}`, size);
      const face = on && depth !== 'plain' && !(ascii && big) ? chip('button', label) : ` ${on ? bold(label) : label} `;
      if (!big) return [on && depth === 'plain' ? `[${label}]` : on ? face : dim(` ${label} `)];
      const heavy = on && (depth === 'plain' || ascii);
      const [tl, tr, bl, br, h, v] = heavy ? sign.heavy : sign.line;
      const of = size + 6;
      const line = (text, from) => (on ? ramp('button', text, { from, of }) : dim(text));
      return [line(tl + h.repeat(of - 2) + tr, 0), `${line(v, 0)} ${face} ${line(v, of - 1)}`, line(bl + h.repeat(of - 2) + br, 0)];
    });
    return pair[0].map((r, i) => `${r}  ${pair[1][i]}`);
  };

  const hintRows = (hints) => {
    const rows = [];
    for (const hint of hints) {
      if (rows.length && width(`${rows.at(-1)}   ${hint}`) <= room()) rows[rows.length - 1] += `   ${hint}`;
      else rows.push(hint);
    }
    return rows.map(dim);
  };

  // The roomiest layout the window holds. The sentence, both buttons and the keys are in every one.
  const layout = ({ tag, title, note }, yes) => {
    const text = flow(says(note), room());
    const enter = `Enter = ${yes ? 'Yes' : 'No'}`;
    const all = hintRows(['y / n answer', `${sign.arrows} switch`, enter, 'Ctrl+C stop']);
    const few = hintRows(['y / n', enter, 'Ctrl+C stop']);
    const big = buttons(yes, true);
    const fits = width(big[0]) <= room() ? big : buttons(yes, false);
    const small = buttons(yes, false);
    const roomy = ['', ...text, '', ...fits, '', ...all];
    const options = [roomy, roomy, [...text, ...fits, ...all], [...text, ...small, ...all], [...text, ...small, ...few]]
      .map((rows, i) => [...(i === 0 ? lead('block') : []), ...boxed({ tag, title: `${title} [y/N]`, rows })]);
    return options.find((o) => o.length < screenRows()) ?? options.at(-1).slice(1 - screenRows());
  };

  let lastLetter = -Infinity;

  /** Asks one y/N question. `card` is {tag, title, note, yes, no}; Ctrl+C and Ctrl+D throw what the plain prompt throws. */
  const ask = (_question, card) => new Promise((resolve, reject) => {
    let yes = false;
    let drawn = [];
    let ready = false;
    let open = true;
    const up = (n) => (n > 0 ? `\x1b[${n}A\r` : '\r');
    const draw = (over = drawn.length) => {
      drawn = layout(card, yes);
      stdout.write(`${up(over)}${drawn.map((r) => `${r}\x1b[K\r\n`).join('')}\x1b[J`);
    };
    const raw = (on) => {
      stdin.setRawMode(on);
      stdout.write(on ? '\x1b[?25l' : '\x1b[?25h');
    };
    const wired = [];
    const listen = (source, event, fn) => {
      source.on(event, fn);
      wired.push([source, event, fn]);
    };
    const restore = () => {
      if (!open) return;
      open = false;
      clearTimeout(settling);
      raw(false);
      stdin.pause();
      for (const [source, event, fn] of wired) source.removeListener(event, fn);
    };
    const finish = (mark, value, settle) => {
      if (!open) return;
      stdout.write(`${up(drawn.length)}\x1b[J`);
      step(mark, card.title, value);
      restore();
      settle();
    };
    const stop = (words) => finish('bad', 'stopped', () => reject(new Error(words)));
    const take = (answer) => finish('good', answer ? card.yes : card.no, () => resolve(answer));
    const suspend = () => {
      raw(false);
      host.once('SIGCONT', () => {
        if (!open) return;
        raw(true);
        draw(0);
      });
      host.kill(0, 'SIGTSTP');
    };

    emitKeypressEvents(stdin);
    listen(stdin, 'keypress', (ch, key = {}) => {
      if (key.ctrl && key.name === 'c') return stop('Aborted with Ctrl+C');
      if (!ready || key.meta) return undefined;
      if (key.ctrl) {
        if (key.name === 'd') return stop('Aborted with Ctrl+D');
        if (key.name === 'z' && host.platform !== 'win32') suspend();
        return undefined;
      }
      if (key.name === 'return' || key.name === 'enter') return clock() - lastLetter < ECHO_MS ? undefined : take(yes);
      if (ch === 'y' || ch === 'Y' || ch === 'n' || ch === 'N') {
        lastLetter = clock();
        return take(ch === 'y' || ch === 'Y');
      }
      if (key.name === 'left' || key.name === 'right' || key.name === 'tab') {
        yes = !yes;
        draw();
      }
      return undefined;
    });
    listen(stdin, 'end', () => stop('Aborted: the terminal closed'));
    // The rows on screen may have wrapped in the new width; the redraw steps over what they take up now.
    listen(stdout, 'resize', () => {
      if (ready) draw(Math.min(screenRows() - 1, drawn.reduce((n, r) => n + Math.max(1, Math.ceil(width(r) / columns())), 0)));
    });
    listen(host, 'exit', restore);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
      listen(host, signal, () => {
        restore();
        host.kill(host.pid, signal);
      });
    }
    raw(true);
    stdin.resume();
    const settling = setTimeout(() => {
      ready = true;
      draw();
    }, settleMs);
  });

  return { ask, step, say, open, notes, panel, work };
}
