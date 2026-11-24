// The install and uninstall screens for a person at a terminal: a card per question, a row per finished step, a panel
// for the plan and the result. openCards() answers null wherever the plain lines must stay as they are (a pipe, CI,
// --yes, --dry-run, TERM=dumb, LITGRAVITY_AGENT_FILE, a window under 40x12); callers then print those.
import { emitKeypressEvents } from 'node:readline';
import { NEON, PILL_INK, SUNSET_STOPS, colorDepth } from '../plugin/hud/render.mjs';
import { displayWidth } from '../plugin/hooks/lib/rewind/gauge.mjs';

const SMALLEST = { columns: 40, rows: 12 };
const WIDEST = 100;
const SETTLE_MS = 30; // keys typed before a card shows are dropped
const ECHO_MS = 400; // an Enter this soon after a y or n belongs to that answer, not to the next card

const [PINK, VIOLET, ACCENT] = NEON;
const TONES = {
  pink: [PINK, 198, 95], violet: [VIOLET, 141, 94], accent: [ACCENT, 202, 93], orange: [SUNSET_STOPS[0], 214, 93], ink: [PILL_INK, 16, 30],
  good: [[80, 230, 140], 78, 92], warn: [[255, 175, 60], 214, 93], bad: [[255, 85, 119], 204, 91],
};
const RAMPS = { border: ['pink', 'violet', 'accent'], pill: ['orange', 'pink'], button: ['pink', 'violet'], bad: ['bad', 'bad'] };
const DRAWN = { line: '╭╮╰╯─│', heavy: '╔╗╚╝═║', good: '✓', bad: '✗', warn: '!', plan: '·', here: '❯', arrows: '← →' };
const TYPED = { line: '++++-|', heavy: '####=#', good: 'ok', bad: 'x', warn: '!', plan: '-', here: '>', arrows: 'Left Right' };
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

/** Panel rows for what is about to happen, from `[label, value]` pairs. */
export const planned = (pairs) => pairs.map(([label, value]) => ({ mark: 'plan', label, value }));

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
  const sign = ascii ? TYPED : DRAWN;
  const says = (text) => (ascii ? String(text).replace(/[·—→…]/g, (ch) => SPELLED[ch]) : String(text));
  const columns = () => stdout.columns || 80;
  const screenRows = () => stdout.rows || 24;
  const outer = () => Math.min(WIDEST, columns() - 2);
  const room = () => outer() - 4;
  const put = (lines) => stdout.write(`${lines.join('\n')}\n`);
  const badge = (mark) => tone({ good: 'good', bad: 'bad', warn: 'warn', plan: 'violet' }[mark], sign[mark]);

  const boxed = ({ tag, title, rows, bad = false }) => {
    const [tl, tr, bl, br, h, v] = sign.line;
    const w = outer();
    const edge = (text, from) => ramp(bad ? 'bad' : 'border', text, { from, of: w });
    const pill = depth === 'plain' ? `[${tag}]` : ramp('pill', ` ${tag} `, { ground: true });
    const name = says(title);
    const beside = width(pill) + width(name) + 8 <= w;
    const head = beside ? `${pill} ${bold(name)} ` : pill;
    const used = 2 + width(head);
    const body = beside ? rows : [...flow(name, w - 4).map(bold), ...rows];
    return [
      ` ${edge(tl + h, 0)}${head}${edge(h.repeat(w - used - 1) + tr, used)}`,
      ...body.map((r) => ` ${edge(v, 0)} ${fill(r, w - 4)} ${edge(v, w - 1)}`),
      ` ${edge(bl + h.repeat(w - 2) + br, 0)}`,
    ];
  };

  const stepRows = (mark, label, value) => {
    const lead = ` ${fill(badge(mark), width(sign.good))} ${fill(says(label), 13)} `;
    return flow(says(value), Math.max(12, columns() - 1 - width(lead)))
      .map((r, i) => (i === 0 ? lead : ' '.repeat(width(lead))) + (mark === 'good' ? r : bold(r)));
  };

  /** One finished step, warning or failure. */
  const step = (mark, label, value) => put(stepRows(mark, label, value));

  /** A heading and its text. A line two spaces in is a command: it keeps its one line, so it can be copied. */
  const notes = (heading, lines) => put(['', ` ${bold(says(heading))}`, ...lines.flatMap((line) => (
    line.startsWith('  ') ? [`  ${line}`] : flow(`   ${says(line)}`, outer())
  ))]);

  /** Sections of `{head, rows: [{mark, label, value}]}` in one frame. Values wrap and are shown whole. */
  const panel = ({ title, sections, bad = false }) => {
    const gutter = width(sign.good) + 1;
    const widest = Math.max(0, ...sections.flatMap((s) => s.rows.map((r) => width(r.label ?? ''))));
    const labelled = widest > 0 && room() >= 56 ? widest + 2 : 0;
    const rows = sections.flatMap((s) => ['', ...(s.head ? [tone(bad ? 'bad' : 'pink', s.head)] : []), ...s.rows.flatMap(({ mark = 'good', label = '', value }) => {
      const lead = fill(badge(mark), gutter);
      const text = flow(says(value), room() - gutter - labelled);
      if (label && !labelled) return [lead + bold(label), ...text.map((r) => ' '.repeat(gutter) + r)];
      return text.map((r, i) => (i === 0 ? lead + fill(bold(label), labelled) : ' '.repeat(gutter + labelled)) + r);
    })]);
    put(['', ...boxed({ tag: 'LIT', title, rows, bad }), '']);
  };

  const buttons = (yes, big) => {
    const ending = room() >= 44 ? ' (default)' : ' default';
    const size = 4 + ending.length;
    const pair = [true, false].map((value) => {
      const on = value === yes;
      const label = fill(`${on ? sign.here : ' '} ${value ? 'Yes' : `No${ending}`}`, size);
      if (!big) return [!on ? ` ${label} ` : depth === 'plain' ? `[${label}]` : ramp('button', ` ${label} `, { ground: true })];
      if (on && depth !== 'plain' && !ascii) {
        const lip = (ch) => ramp('button', ch.repeat(size + 4));
        return [lip('▄'), ramp('button', `  ${label}  `, { ground: true }), lip('▀')];
      }
      const [tl, tr, bl, br, h, v] = on ? sign.heavy : sign.line;
      const line = on ? (t) => tone('pink', t) : dim;
      return [line(tl + h.repeat(size + 2) + tr), `${line(v)} ${on ? bold(label) : label} ${line(v)}`, line(bl + h.repeat(size + 2) + br)];
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
    const options = [['', ...text, '', ...fits, '', ...all], [...text, '', ...fits, ...all], [...text, ...buttons(yes, false), ...all], [...text, ...buttons(yes, false), ...few]]
      .map((rows, i) => [...(i === 0 ? [''] : []), ...boxed({ tag, title: `${title} [y/N]`, rows })]);
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
      stdout.write(`${up(drawn.length)}\x1b[J${stepRows(mark, card.title, value).join('\n')}\n`);
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

  return { ask, step, notes, panel };
}
