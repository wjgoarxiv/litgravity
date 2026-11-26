import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { AGENT_POINTER } from '../lib/agent-guide.mjs';
import { flow, makeCards, openCards } from '../lib/cards.mjs';
import { install } from '../lib/install.mjs';
import { uninstall } from '../lib/uninstall.mjs';
import { displayWidth } from '../plugin/hooks/lib/rewind/gauge.mjs';
import { ROOT, agyCalls, sandbox } from './helpers.mjs';

const COLOUR = { TERM: 'xterm-256color', COLORTERM: 'truecolor', LANG: 'en_US.UTF-8', LITGRAVITY_HUD_GLYPHS: 'basic' };
const ROUND = { ...COLOUR, LITGRAVITY_HUD_GLYPHS: 'round' };
const QUESTION = { tag: 'LIT 1/2', title: 'Install', note: 'Copies the plugin; No writes nothing.', yes: 'copy it', no: 'not installed' };
const [UP, LEFT, RIGHT, TAB, ENTER, ESC, CTRL_C, CTRL_D, CTRL_Z] = ['\x1b[A', '\x1b[D', '\x1b[C', '\t', '\r', '\x1b', '\x03', '\x04', '\x1a'];
const bare = (text) => text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replaceAll('\r', '');

// A keyboard, a screen and a process, all fake.
function desk({ columns = 90, rows = 40, env = COLOUR, clock } = {}) {
  const stdin = new PassThrough();
  stdin.isTTY = true;
  const raws = [];
  stdin.setRawMode = (on) => raws.push(on);
  const stdout = new EventEmitter();
  const out = [];
  Object.assign(stdout, { isTTY: true, columns, rows, write: (chunk) => out.push(chunk) });
  const host = new EventEmitter();
  const kills = [];
  Object.assign(host, { pid: 9, platform: 'linux', kill: (...args) => kills.push(args) });
  const cards = makeCards({ env, stdin, stdout, host, settleMs: 1, ...(clock ? { clock } : {}) });
  return { stdin, stdout, host, raws, kills, cards, out, text: () => bare(out.join('')), card: () => bare(out.filter((c) => c.includes('Ctrl+C')).at(-1) ?? '').split('\n').filter(Boolean) };
}

// Types `keys` into one question; `still` when nothing has answered it.
async function type(d, keys, question = QUESTION) {
  const answer = d.cards.ask('', question).then((value) => ({ value }), (err) => ({ stopped: err.message }));
  await pause(15);
  for (const key of keys) {
    if (typeof key === 'function') key(d);
    else d.stdin.write(key);
    await pause(4);
  }
  return { ...(await Promise.race([answer, pause(700, { still: true })])), answer };
}

test('a question card answers y or n at once, moves on arrows and Tab, and Enter takes the highlight, No first', async () => {
  for (const [keys, want] of [[['y'], true], [['Y'], true], [['n'], false], [[ENTER], false], [[LEFT, ENTER], true], [[RIGHT, ENTER], true], [[TAB, TAB, ENTER], false], [['z', ' ', UP, ENTER], false]]) {
    const d = desk();
    assert.equal((await type(d, keys)).value, want, JSON.stringify(keys));
    assert.deepEqual(d.raws, [true, false]);
    assert.ok(d.stdin.isPaused());
    assert.ok(d.out.join('').lastIndexOf('\x1b[?25h') > d.out.join('').lastIndexOf('\x1b[?25l'), 'the cursor is back');
    assert.match(d.text().trimEnd().split('\n').at(-1), want ? /^ ✓ Install +copy it$/ : /^ ✓ Install +not installed$/);
    assert.equal(d.stdin.listenerCount('keypress') + d.stdout.listenerCount('resize') + d.host.listenerCount('exit') + d.host.listenerCount('SIGINT'), 0);
  }
});

test('the card carries its step, title, sentence, marked default and keys', async () => {
  const d = desk();
  await type(d, [LEFT, 'n']);
  const card = d.card().join('\n');
  for (const part of ['LIT 1/2', 'Install [y/N]', QUESTION.note, '❯ Yes', 'No (default)', 'y / n answer', '← → switch', 'Enter = Yes', 'Ctrl+C stop']) assert.ok(card.includes(part), part);
});

test('Esc and type-ahead answer nothing, and the Enter after a letter answer never reaches the next card', async () => {
  const early = desk();
  early.stdin.write('y\r');
  const first = await type(early, [ESC]);
  assert.ok(first.still);
  await pause(600);
  early.stdin.write('n');
  assert.equal((await first.answer).value, false);

  let now = 0;
  const d = desk({ clock: () => now });
  await type(d, ['y']);
  now = 300;
  const second = await type(d, [LEFT, ENTER]);
  assert.ok(second.still, 'the stray Enter');
  now = 900;
  d.stdin.write(ENTER);
  assert.equal((await second.answer).value, true);
});

test('Ctrl+C, Ctrl+D and a closed terminal stop as the plain prompt does; a signal is passed on; Ctrl+Z comes back', async () => {
  for (const [key, words] of [[CTRL_C, 'Aborted with Ctrl+C'], [CTRL_D, 'Aborted with Ctrl+D'], [(d) => d.stdin.end(), 'Aborted: the terminal closed']]) {
    const d = desk();
    assert.equal((await type(d, [key])).stopped, words);
    assert.deepEqual(d.raws, [true, false]);
    assert.match(d.text(), /✗ Install +stopped/);
  }
  const killed = desk();
  await type(killed, [(d) => d.host.emit('SIGTERM')]);
  assert.deepEqual(killed.kills, [[9, 'SIGTERM']]);
  assert.deepEqual(killed.raws, [true, false]);

  const paused = desk();
  assert.equal((await type(paused, [CTRL_Z, (d) => d.host.emit('SIGCONT'), 'y'])).value, true);
  assert.deepEqual(paused.kills, [[0, 'SIGTSTP']]);
  assert.deepEqual(paused.raws, [true, false, true, false]);
});

test('cards and panels fit from 40 to 120 columns and down to 12 rows, and drop no word', async () => {
  const note = 'Adds the LitGravity global rule, the agent file planned above; No leaves it out and is stored, so later installs skip it.';
  for (const columns of [40, 60, 80, 120]) {
    for (const rows of [12, 24, 40]) {
      const d = desk({ columns, rows });
      await type(d, ['y'], { ...QUESTION, note });
      const card = d.card();
      assert.ok(card.length < rows, `${columns}x${rows} draws ${card.length} rows`);
      for (const row of card) assert.ok(displayWidth(row) < columns, row);
      const words = card.join(' ').replace(/[│╭╮╰╯─]/g, ' ').replace(/ +/g, ' ');
      for (const part of [note, 'Yes', 'No', 'Ctrl+C stop']) assert.ok(words.includes(part), `${columns}x${rows}: ${part}`);
    }
    const d = desk({ columns });
    const path = `/home/someone/${'deep/'.repeat(30)}receipt.json`;
    d.cards.panel({ title: 'A panel with a rather long title on it', sections: [{ head: 'WRITTEN', rows: [{ label: 'receipt', value: path }, { mark: 'warn', value: '긴 한국어 문장도 줄을 바꿔 넣습니다 '.repeat(5) }] }] });
    for (const row of d.text().split('\n')) assert.ok(displayWidth(row) < columns, row);
    assert.ok(d.text().replace(/[^!-~]/g, '').includes(path));
  }
  const d = desk({ columns: 110 });
  await type(d, [() => { d.stdout.columns = 44; d.stdout.emit('resize'); }, 'n']);
  for (const row of d.card()) assert.ok(displayWidth(row) < 44, row);
});

test('truecolor, 256, 16 and no colour; a locale without UTF-8 is drawn in ASCII', async () => {
  const drawn = async (env) => {
    const d = desk({ env });
    await type(d, [LEFT, 'n']);
    return d.out.join('');
  };
  assert.match(await drawn(COLOUR), /38;2;255;45;149m/);
  assert.match(await drawn(COLOUR), /38;2;255;99;55m/, 'the accent ends the border');
  const c256 = await drawn({ ...COLOUR, COLORTERM: '' });
  assert.match(c256, /38;5;198m/);
  assert.doesNotMatch(c256, /[34]8;2;/);
  const c16 = await drawn({ ...COLOUR, COLORTERM: '', TERM: 'xterm' });
  assert.match(c16, /\x1b\[95m/);
  assert.doesNotMatch(c16, /[34]8;[25];/);
  const none = await drawn({ ...COLOUR, NO_COLOR: '1' });
  assert.doesNotMatch(none, /\x1b\[[0-9;]*m/);
  assert.match(none, /\[LIT 1\/2\][^]*║ {2}❯ Yes/);
  assert.doesNotMatch(await drawn({ ...COLOUR, NO_COLOR: '1', LC_ALL: 'C' }), /[^\x00-\x7f]/);
});

// Both forms of everything the screens draw, as rows with their colours.
async function everything(env, columns, rows) {
  const d = desk({ env, columns, rows });
  d.cards.open('litgravity v1.2.3', 'Installs into ~/.gemini/config/plugins/litgravity. Nothing is written before you say yes.');
  d.cards.panel({ title: 'LitGravity 1.2.3 install plan', sections: [{ rows: [{ mark: 'plan', label: 'Plugin', value: '~/.gemini/config/plugins/litgravity' }] }] });
  await type(d, [LEFT, 'y']);
  await type(d, ['n'], { ...QUESTION, title: 'Global rule', tag: 'LIT 2/2' });
  const work = d.cards.work('Installing LitGravity 1.2.3', [{ name: 'Copy', text: 'copy the plugin into ~/.gemini/config/plugins/litgravity' }, { name: 'Receipt', text: 'record what was written' }]);
  work.run(() => 3);
  work.run(() => ({ ok: true }));
  work.fold('Install steps');
  d.cards.panel({ title: 'LitGravity 1.2.3 is installed', sections: [{ head: 'Installed', rows: [{ label: 'Plugin', value: 'here' }, { mark: 'warn', label: 'Note', value: 'mind this' }] }, { head: 'Next', rows: [{ mark: 'plan', label: 'Start', value: 'run agy' }] }] });
  d.cards.panel({ title: 'INSTALL STOPPED', bad: true, sections: [{ rows: [{ mark: 'bad', label: 'Reason', value: 'it broke' }] }] });
  d.cards.say('Nothing installed.');
  d.cards.notes('LitFamily extensions', ['Some prose.', '  git clone x']);
  return d.out.join('');
}
// What is left on screen once each redraw has gone over the rows it replaced.
function onScreen(out) {
  const lines = [''];
  let y = 0;
  for (const m of out.matchAll(/\x1b\[(\d+)A|\x1b\[([0-9;?]*)([A-Za-z])|(\r)|(\n)|([^\x1b\r\n]+)/g)) {
    if (m[1]) y -= Number(m[1]);
    else if (m[3] === 'J') lines.length = y;
    else if (m[4]) lines[y] = '';
    else if (m[5]) { y += 1; lines[y] = ''; }
    else if (m[6]) lines[y] = (lines[y] ?? '') + m[6];
    lines[y] ??= '';
  }
  return lines;
}

test('the screen: one blank row between blocks and never two, values in column 24, a mark over the cards', async () => {
  for (const [columns, rows] of [[100, 60], [80, 40], [120, 24]]) {
    const lines = onScreen(await everything(ROUND, columns, rows)).map((l) => l.trimEnd());
    while (lines.at(-1) === '') lines.pop();
    const text = lines.join('\n');
    assert.doesNotMatch(text, /\n\n\n/, text);
    const bodies = lines.slice(lines.findIndex((l) => l.includes('Installs into')));
    assert.equal(lines[0], '');
    bodies.forEach((l, i) => {
      if (l.startsWith(' ╭')) assert.equal(bodies[i - 1], '', `a card without its blank row: ${l}`);
      if (l.startsWith(' ╰')) assert.ok(bodies[i + 1] === undefined || bodies[i + 1] === '', l);
    });
    for (const label of ['Install ', 'Global rule', 'Install steps', 'Plugin', 'Note', 'Start', 'Reason']) {
      const row = bodies.find((l) => new RegExp(`^ (│ )?[✓✗!·] ${label}`).test(l));
      assert.match([...row].slice(24).join(''), /^\S/, `${label}: ${row}`);
      assert.equal([...row][23], ' ', row);
    }
    assert.match(text, /\n ✓ Install +copy it\n ✓ Global rule +not installed\n ✓ Install steps +2 of 2 checked\n\n ╭/);
  }
});

test('round: every fill has both caps and nothing is bracketed; square, plain and ASCII: no cap, the same text in the same columns', async () => {
  const unroll = (out) => bare(out.replace(/\x1b\[38;2;[0-9;]+m[\ue0b6\ue0b4]\x1b\[0m/g, ' '));
  for (const columns of [40, 60, 80, 100, 120]) {
    for (const rows of [12, 16, 24, 60]) {
      const round = await everything(ROUND, columns, rows);
      const square = await everything(COLOUR, columns, rows);
      assert.equal(unroll(round), bare(square), `${columns}x${rows}`);
      assert.doesNotMatch(bare(round), /\[(?!y\/N)|[░▒▓▯▌▐▄▀](?=.*│)/);
      for (const line of round.split(/\r?\n/)) {
        if (!/[│╭╰]/.test(line)) continue; // the mark's own pixels
        const cells = [...line.matchAll(/\x1b\[([0-9;?]*)m([^\x1b]*)/g)].flatMap((m) => [...m[2]].map((ch) => ({ ch, ground: /(?:^|;)48;/.test(m[1].replace(/38;2;\d+;\d+;\d+/, '')) })));
        cells.forEach((c, i) => {
          if (!c.ground) return;
          assert.ok(cells[i - 1]?.ground || cells[i - 1]?.ch === '\ue0b6', line);
          assert.ok(cells[i + 1]?.ground || cells[i + 1]?.ch === '\ue0b4', line);
        });
      }
      for (const env of [COLOUR, { ...ROUND, COLORTERM: '' }, { ...ROUND, COLORTERM: '', TERM: 'xterm' }, { ...ROUND, COLORFGBG: '0;15' }, { ...ROUND, NO_COLOR: '1' }, { ...ROUND, LC_ALL: 'C' }]) {
        const out = await everything(env, columns, rows);
        assert.doesNotMatch(out, /[\ue0b6\ue0b4]/);
        for (const row of bare(out).split('\n')) if (/[│+|] *$/.test(row) && !row.includes('git')) assert.ok(displayWidth(row.trimEnd()) <= Math.min(101, columns - 1), row);
      }
    }
  }
});

test('a step that fails stays on screen, marked; the steps fit at every width and drop only their texts', () => {
  for (const columns of [40, 60, 100]) {
    const d = desk({ columns });
    const work = d.cards.work('Installing', [{ name: 'Package', text: 'check the packaged plugin with agy' }, { name: 'Copy', text: 'copy the plugin into a folder with a long name' }, { name: 'Receipt', text: 'record what was written' }]);
    work.run(() => ({ ok: true }));
    assert.throws(() => work.run(() => { throw new Error('disk full'); }), /disk full/);
    const lines = onScreen(d.out.join(''));
    assert.match(lines.join('\n'), /│ ✓ Package[^]*│ ✗ Copy[^]*│ · Receipt/);
    for (const l of lines) assert.ok(displayWidth(l) < columns, l);
  }
});

test('openCards says no wherever the plain lines must stay', () => {
  const d = desk();
  const opened = (over) => openCards({ env: COLOUR, stdin: d.stdin, stdout: d.stdout, ...over });
  assert.ok(opened());
  assert.ok(opened({ env: { ...COLOUR, NO_COLOR: '1' } }));
  for (const over of [
    { flags: { yes: true } }, { flags: { dryRun: true } }, { env: { ...COLOUR, CI: 'true' } }, { env: { ...COLOUR, TERM: 'dumb' } }, { env: { ...COLOUR, LITGRAVITY_AGENT_FILE: 'off' } },
    { stdin: new PassThrough() }, { stdout: new PassThrough() }, { stdin: { isTTY: true } }, { stdout: { isTTY: true, columns: 39, rows: 40 } }, { stdout: { isTTY: true, columns: 90, rows: 11 } },
  ]) assert.equal(opened(over), null, JSON.stringify(Object.keys(over)));
});

test('flow keeps the indent, counts wide characters and loses nothing', () => {
  assert.deepEqual(flow('  one two three', 9), ['  one two', '  three']);
  assert.deepEqual(flow('한글 네글자', 6), ['한글', '네글자']);
  assert.equal(flow('/one/very/long/path', 4).join(''), '/one/very/long/path');
});

// The installer's questions, answered from a list.
function answering(...answers) {
  const d = desk();
  const asked = [];
  return { d, asked, cards: { ...d.cards, ask: async (plain, card) => { asked.push({ plain, ...card }); return answers.shift(); } } };
}
const run = (box, a, more = {}) => install({ env: box.env, interactive: true, ask: a.cards.ask, cwd: box.home, print: () => {}, cards: a.cards, ...more });

test('an install asks the released questions in order, and each answer does what it did', async () => {
  const yes = sandbox();
  const a = answering(true, true);
  assert.equal(await run(yes, a), 0);
  assert.deepEqual(a.asked.map((q) => [q.tag, q.title]), [['LIT 1/2', 'Install'], ['LIT 2/2', 'Global rule']]);
  assert.match(a.asked[0].plain, /^Install LitGravity [\d.]+ at user scope\? \[y\/N\] $/);
  assert.ok(existsSync(join(yes.home, '.gemini/config/rules/litgravity.md')));
  const screen = a.d.text();
  for (const part of [/Installs into ~\/\.gemini\/config\/plugins\/litgravity, only after/, /install plan/, /Approvals +none: agy loads/, /✓ Install steps +5 of 5 checked/, /✓ Agent file +created ~\//, /is installed/, /Installed[^]*Settings[^]*Next/, /run agy in a project/, /^ {4}git clone https/m]) assert.match(screen, part);

  const again = answering(true);
  await run(yes, again);
  assert.deepEqual(again.asked.map((q) => q.tag), ['LIT 1/1']);

  const none = sandbox();
  const no = answering(false);
  assert.equal(await run(none, no), 0);
  assert.equal(no.asked.length, 1);
  assert.match(no.d.text(), /^ Nothing installed\.$/m);
  assert.equal(existsSync(join(none.home, '.gemini/config/plugins/litgravity')), false);

  const off = sandbox();
  const left = answering(true, false);
  await run(off, left);
  assert.equal(existsSync(join(off.home, '.gemini/config/rules/litgravity.md')), false);
  assert.match(left.d.text(), /stored `off`, so later installs skip the rule file/);
  const later = answering(true);
  await run(off, later);
  assert.equal(later.asked.length, 1);
});

test('the first card carries the agent pointer in an empty row: no card grows and no step changes', async () => {
  for (const columns of [40, 64, 65, 80, 120]) {
    for (const rows of [12, 16, 24, 40]) {
      const bareCard = desk({ columns, rows });
      await type(bareCard, ['n']);
      const hinted = desk({ columns, rows });
      await type(hinted, ['n'], { ...QUESTION, hint: AGENT_POINTER });
      const [a, b] = [bareCard.card(), hinted.card()];
      assert.equal(b.length, a.length, `${columns}x${rows}`);
      const changed = b.filter((row, i) => row !== a[i]);
      assert.deepEqual(changed.map((row) => row.replace(/[│ ]+$/, '').replace(/^[│ ]+/, '')), columns >= 80 && rows >= 24 ? [AGENT_POINTER] : changed.length ? [AGENT_POINTER] : []);
      for (const row of b) assert.ok(displayWidth(row) < columns, row);
    }
  }
  const box = sandbox();
  const a = answering(true, true);
  await run(box, a);
  assert.deepEqual(a.asked.map((q) => [q.tag, q.hint]), [['LIT 1/2', AGENT_POINTER], ['LIT 2/2', undefined]]);
});

test('with cards, --round shows its plan, its step and its row, and ROUND_ENDS is the last line', async () => {
  const box = sandbox();
  delete box.env.LITGRAVITY_HUD_GLYPHS;
  const dir = join(box.home, 'fonts');
  box.env.LITGRAVITY_ICON_FONT_SOURCE = join(box.home, 'none.zip');
  const a = answering(true, true);
  assert.equal(await run(box, a, { flags: { round: true, statusLine: true, glyphs: 'round' }, font: { platform: 'linux', folders: [dir], fetchImpl: () => assert.fail('the network') } }), 0);
  const screen = a.d.text();
  for (const part of [/Icon font +add SymbolsNerdFontMono-Regular\.ttf/, /Glyphs +save round/, /✓ Install steps +7 of 7 checked/, /! Icon font +not added: .*none\.zip/, /Glyphs +round \(change/]) assert.match(screen, part);
  assert.equal(screen.trimEnd().split('\n').at(-1), ' ROUND_ENDS: shown');
  assert.deepEqual(a.asked.map((q) => q.tag), ['LIT 1/2', 'LIT 2/2']);
});

test('warnings and failures stay in full view, and a remedy prints below the card as plain text', async () => {
  const box = sandbox();
  const missing = answering();
  assert.equal(await run({ ...box, env: { ...box.env, LITGRAVITY_AGY_BIN: join(box.home, 'none'), PATH: box.home } }, missing), 1);
  assert.match(missing.d.text(), /INSTALL STOPPED[^]*· Stage +host[^]*✗ Reason +agy was not found on PATH/);

  mkdirSync(join(box.home, '.gemini/config/plugins/litgravity'), { recursive: true });
  writeFileSync(join(box.home, '.gemini/config/plugins/litgravity/mine.txt'), 'mine');
  const foreign = answering();
  assert.equal(await run(box, foreign), 1);
  assert.match(foreign.d.text(), /✗ Reason +destination foreign[^]*No files written\./);
  assert.match(foreign.d.text(), /^ [^│\n]*mkdir -p ".*" && mv ".*".*$/m, 'the command stays in one piece');
  assert.equal(foreign.asked.length, 0);

  const loud = sandbox();
  const warned = answering(true, true);
  await run({ ...loud, env: { ...loud.env, FAKE_AGY_FINDINGS: JSON.stringify([{ severity: 'warning', file: 'a.md', message: 'too long' }]) } }, warned);
  assert.match(warned.d.text(), /! Validate +a\.md: too long/);
  assert.ok(agyCalls(loud.env).length > 0);
});

test('uninstall asks once and removes nothing on No', async () => {
  const box = sandbox();
  await run(box, answering(true, true));
  const plugin = join(box.home, '.gemini/config/plugins/litgravity');
  const go = (a, print = () => {}) => uninstall({ env: box.env, interactive: true, ask: a.cards.ask, cwd: box.home, print, cards: a.cards });
  const no = answering(false);
  assert.equal(await go(no), 0);
  assert.deepEqual(no.asked.map((q) => [q.tag, q.plain]), [['LIT 1/1', 'Remove these LitGravity files? [y/N] ']]);
  assert.ok(existsSync(plugin));
  const yes = answering(true);
  await go(yes, () => assert.fail('a plain line'));
  assert.equal(existsSync(plugin), false);
  assert.match(yes.d.text(), /✓ User copy +removed[^]*✓ Agent file +removed[^]*stay in/);
  const empty = answering();
  await go(empty);
  assert.equal(empty.asked.length, 0);
});

const noTmux = process.platform === 'win32' || spawnSync('tmux', ['-V']).status !== 0;

test('the real installer reads keys in a real terminal and ends', { skip: noTmux && 'tmux is not installed', timeout: 90_000 }, async () => {
  const { env, home } = sandbox();
  const tmux = (...args) => spawnSync('tmux', ['-L', `litgravity-cards-${process.pid}`, ...args], { encoding: 'utf8' }).stdout ?? '';
  const quoted = (text) => `'${String(text).replaceAll("'", "'\\''")}'`;
  const code = join(home, 'code');
  const script = join(home, 'go.sh');
  const vars = Object.entries({ ...env, TERM: 'xterm-256color', LANG: 'en_US.UTF-8' }).map(([k, v]) => `${k}=${quoted(v)}`).join(' ');
  writeFileSync(script, `cd ${quoted(home)}\nenv -i ${vars} ${quoted(process.execPath)} ${quoted(join(ROOT, 'bin/litgravity.mjs'))} install\necho $? > ${quoted(code)}\nsleep 60\n`);
  const see = async (ok, what) => {
    for (let i = 0; i < 200; i += 1) {
      if (ok(tmux('capture-pane', '-p'))) return;
      await pause(150);
    }
    assert.fail(`${what}\n${tmux('capture-pane', '-p')}`);
  };
  try {
    tmux('-f', '/dev/null', 'new-session', '-d', '-x', '90', '-y', '30', `sh ${quoted(script)}`);
    await see((s) => /LIT 1\/2[^]*Enter = No/.test(s), 'the first card');
    tmux('send-keys', 'Left');
    await see((s) => /Enter = Yes/.test(s), 'the highlight');
    tmux('send-keys', 'Enter');
    await see((s) => /LIT 2\/2/.test(s), 'the second card');
    tmux('send-keys', 'n');
    await see(() => existsSync(code) && readFileSync(code, 'utf8') !== '', 'the end');
    assert.equal(readFileSync(code, 'utf8').trim(), '0');
    assert.ok(existsSync(join(home, '.gemini/config/plugins/litgravity/plugin.json')));
    assert.equal(existsSync(join(home, '.gemini/config/rules/litgravity.md')), false);
  } finally {
    tmux('kill-server');
  }
});
