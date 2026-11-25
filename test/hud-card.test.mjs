import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PLUGIN } from './helpers.mjs';
import { STATES, scene } from './hud-states.mjs';
import { PILL_INK, STAGE_STOPS, SUNSET_STOPS, visibleWidth } from '../plugin/hud/render.mjs';
import { CARD_MIN_HEIGHT } from '../plugin/hud/card.mjs';

// The status line as a card: the same frame in every state, every row exactly as wide as the window, round everywhere or
// square everywhere, the sunset in free cells only, and the one row everywhere the card does not belong.

const NAMES = Object.keys(STATES);
const strip = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');
const rowsOf = (out) => out.split('\n');
const ART = /[▁▂▃▄▅▆▇█~]/;
const noTmux = process.platform === 'win32' || spawnSync('tmux', ['-V']).status !== 0;

test('every state is one card: a rounded frame, the mark, the state word, context on the bottom edge, the version', () => {
  const words = { ready: 'READY', idle: 'READY', signin: 'READY', ignited: 'GREEN', working: 'GREEN', lanes: 'GREEN', turn: 'YOUR TURN', done: 'DONE', plan: 'WORK', side: 'INTERVIEW', review: 'REVIEW', team: 'ACTIVE', rewind: 'REWIND', warning: 'GREEN', error: 'ERROR' };
  for (const name of NAMES) {
    for (const width of [60, 80, 100, 160]) {
      const rows = rowsOf(strip(scene(name).draw(width)));
      assert.match(rows[0], new RegExp(`^╭─ .🔥 LIT. · .* ${words[name]} [●✦«] ─╮$`), `${name} ${width}: ${rows[0]}`);
      assert.match(rows.at(-1), /^╰─ .*ctx \d+%.* ─╯$/, `${name} ${width}`);
      assert.match(rows.at(-1), / v\d+\.\d+\.\d+ ─╯$/);
      for (const row of rows.slice(1, -1)) assert.match(row, /^│ .* │$/, `${name} ${width}`);
    }
  }
});

test('the card says what was recorded, and nothing when nothing was', () => {
  const said = (name, width = 120) => strip(scene(name, { glyphs: 'basic' }).draw(width));
  assert.match(said('working'), /PIN ✓ ━━ RED ✓ ━━ {2}GREEN {2}━━ VERIFY · ── REVIEW · ── RECORD ·.*› run_command · 0:04/);
  assert.match(said('working'), /criterion 1\/2 .*next ▸ c2 --shout prints the greeting in capitals/);
  assert.match(said('working'), /skills {2}lit-loop {3}review-work /);
  assert.match(said('ignited'), /lit-loop IGNITED 0:20/);
  assert.match(said('lanes'), /┬ 3 lanes in parallel[^]*├─ ● lit-executor {2,}─────.*running[^]*└─ ● lit-verifier .*running · 2 steps/);
  assert.match(said('turn'), /⚠ YOUR TURN · question/);
  assert.match(said('done'), /PIN ✓ .*RECORD ✓[^]*✦ DONE ✦/);
  assert.match(said('plan'), /plan 1\/3 .*next ▸ 2\. Add the shout flag/);
  assert.match(said('side'), /● lit-brainstorm +interview.*running[^]*‖ lit-loop +.*paused/);
  assert.match(said('review'), /review 2\/5[^]*✓ goal +passed[^]*✗ security +failed/);
  assert.match(said('team'), /reported 1\/4[^]*✗ D +blocked/);
  assert.match(said('error'), /✗ error · agy reported an error/);
  assert.match(said('ready'), /no lit route in this conversation yet/);
  for (const name of ['ready', 'signin', 'idle']) assert.doesNotMatch(said(name), /skills|next|›|undefined|NaN|null/);
});

test('the frame stays in its column in every state, at every width, with hostile strings', () => {
  for (const name of NAMES) {
    for (const hostile of [false, true]) {
      for (const glyphs of ['round', 'basic']) {
        const s = scene(name, { hostile, glyphs });
        for (let width = 60; width <= 200; width += 1) {
          for (const row of rowsOf(s.draw(width))) {
            assert.match(strip(row), /^[╭│╰].*[╮│╯]$/, `${name} ${width}`);
            assert.doesNotMatch(strip(row), /[\u0000-\u001f\u007f-\u009f​-‏‪-‮️]/, name);
          }
        }
      }
    }
  }
});

// A real terminal decides how wide a row is: after each row an X is put on the card's last column. It replaces the frame's edge
// exactly when the row is as wide as the window; a longer row leaves the edge after it, a shorter one just before.
test('a real terminal finds the right edge in the last column of every row', { skip: noTmux && 'tmux is not installed', timeout: 90_000 }, () => {
  const rows = [];
  for (const name of NAMES) {
    for (const hostile of [false, true]) {
      const s = scene(name, { hostile });
      for (const width of [60, 67, 80, 95, 100, 120, 160, 200]) {
        for (const height of [24, 60]) rowsOf(s.draw(width, { rows: height })).forEach((row, i) => rows.push({ row, width, at: `${name} ${hostile ? 'hostile ' : ''}${width}x${height} row ${i}` }));
      }
    }
  }
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-edge-'));
  writeFileSync(join(dir, 'rows'), rows.map(({ row, width }) => `${row}\u001b[${width}GX\r\n`).join(''));
  const tmux = (...args) => spawnSync('tmux', ['-L', `litgravity-edge-${process.pid}`, ...args], { encoding: 'utf8', maxBuffer: 64e6, env: { PATH: process.env.PATH, HOME: dir, LANG: 'en_US.UTF-8', TERM: 'xterm-256color' } }).stdout ?? '';
  try {
    tmux('-u', '-f', '/dev/null', 'start-server', ';', 'set', '-g', 'history-limit', '100000', ';', 'new-session', '-d', '-x', '220', '-y', '50', `cat '${join(dir, 'rows')}'; printf 'THE END'; sleep 60`);
    let seen = [];
    for (let i = 0; i < 100 && seen.at(-1) !== 'THE END'; i += 1) {
      spawnSync('sleep', ['0.1']);
      seen = tmux('capture-pane', '-p', '-S', '-').trimEnd().split('\n');
    }
    assert.equal(seen.length, rows.length + 1);
    rows.forEach(({ at }, i) => assert.match(seen[i], /^[╭│╰].*[ ─]X$/, `${at}: ${seen[i]}`));
  } finally {
    tmux('kill-server');
  }
});

test('heights 12 to 60: one row in a short window, then a card that leaves agy its own rows', () => {
  for (const name of NAMES) {
    const s = scene(name);
    let last = 0;
    for (let rows = 12; rows <= 60; rows += 1) {
      const n = rowsOf(s.draw(100, { rows })).length;
      if (rows < CARD_MIN_HEIGHT) assert.equal(n, 1, `${name} ${rows}`);
      else {
        assert.ok(n >= 5 && n <= Math.min(11, rows / 2), `${name} ${rows}: ${n}`);
        assert.ok(n >= last, `${name} ${rows}: a taller window never shows less`);
        last = n;
      }
    }
  }
  const s = scene('working');
  assert.equal(rowsOf(s.draw(59)).length, 1, 'narrow');
});

test('the height does not follow the words: working, waiting, done and start-work stand equally tall, so nothing jumps', () => {
  for (const rows of [20, 24, 40]) {
    const tall = ['ignited', 'working', 'turn', 'done', 'plan', 'warning', 'error'].map((name) => rowsOf(scene(name).draw(100, { rows })).length);
    assert.equal(new Set(tall).size, 1, `${rows}: ${tall}`);
  }
});

test('the sun keeps its whole three-row dome on the working, waiting, done and start-work cards of a 24-row window', () => {
  const dome = (name, width) => rowsOf(strip(scene(name).draw(width, { rows: 24 }))).filter((r) => /▁▃▅▆▇████▇▆▅▃▁|▅▇{14}▅|▆{18}/.test(r)).length;
  for (const name of ['ready', 'ignited', 'working', 'turn', 'done', 'plan']) assert.equal(dome(name, 100), 3, name);
  for (const name of ['ready', 'working', 'done', 'plan']) assert.equal(dome(name, 80), 3, name);
  const at = (name, rows) => rowsOf(strip(scene(name).draw(140, { rows }))).findIndex((r) => r.includes('skills'));
  assert.equal(at('working', 20), at('working', 24), 'the free row is under the text');
});

test('whole stage words come before the tool: its name is shortened first', () => {
  for (const width of [80, 100]) {
    const row = rowsOf(strip(scene('working', { glyphs: 'basic' }).draw(width)))[1];
    for (const word of ['PIN', 'RED', 'GREEN', 'VERIFY', 'REVIEW', 'RECORD']) assert.ok(row.includes(word), `${width}: ${row}`);
    assert.match(row, width === 80 ? /› run_com… · 0:04/ : /› run_command · 0:04/);
  }
});

test('a short window hides skills before lanes, and never a lane in trouble', () => {
  const lanes = strip(scene('lanes').draw(100, { rows: 24 }));
  for (const name of ['lit-executor', 'qa-runner', 'lit-verifier']) assert.ok(lanes.includes(name), lanes);
  assert.match(strip(scene('review').draw(100, { rows: 24 })), /✗ security +failed[^]*\+\d more/);
});

test('round everywhere or square everywhere, in the same cells', () => {
  for (const name of NAMES) {
    for (const [width, rows] of [[80, 40], [140, 40], [140, 12], [50, 40]]) {
      const round = strip(scene(name, { glyphs: 'round' }).draw(width, { rows }));
      const square = strip(scene(name, { glyphs: 'basic' }).draw(width, { rows }));
      assert.ok(round.includes('') && round.includes(''), name);
      assert.equal(round.split('').length, round.split('').length, `${name}: both caps`);
      assert.doesNotMatch(round, /\[[^\]]*[█▏▎▍▌▋▊▉░ ]\]|[░▒▓▯]/, `${name} ${width}x${rows}: ${round}`);
      assert.doesNotMatch(square, /[]/, name);
      if (rows === 40 && width >= 60) {
        // Only the caps' own cells differ.
        const a = [...round].map((ch) => (/[]/.test(ch) ? ' ' : ch)).join('');
        const same = [...a].filter((ch, i) => ch !== [...square][i] && !/[▏▎▍▌▋▊▉ ]/.test([...square][i]));
        assert.deepEqual(same, [], `${name} ${width}`);
      }
      // No square end: every filled ground starts after a left cap and ends before a right one.
      for (const row of rowsOf(scene(name, { glyphs: 'round' }).draw(width, { rows }))) {
        const cells = [...row.matchAll(/\u001b\[([0-9;]*)m([^\u001b]*)/g)].flatMap((m) => [...m[2]].map((ch) => ({ ch, ground: /(?:^|;)48;/.test(m[1].replace(/38;2;\d+;\d+;\d+/, '')), sun: ART.test(ch) })));
        cells.forEach((c, i) => {
          if (!c.ground || c.sun) return;
          assert.ok(cells[i - 1]?.ground || cells[i - 1]?.ch === '', `${name} ${width}x${rows}: ${row}`);
          assert.ok(cells[i + 1]?.ground || cells[i + 1]?.ch === '', `${name} ${width}x${rows}: ${row}`);
        });
      }
    }
  }
});

test('NO_COLOR, 256 and 16 colours, ASCII and a light ground keep the one row, with no card and no cap', () => {
  for (const name of NAMES) {
    const s = scene(name);
    for (const env of [{ NO_COLOR: '1' }, { COLORTERM: '', TERM: 'xterm-256color' }, { LITGRAVITY_HUD_COLOR: '16' }, { LITGRAVITY_HUD_ASCII: '1' }, { COLORFGBG: '0;15' }, { COLORFGBG: '0;default;7' }, { TERM: 'dumb' }]) {
      const out = s.draw(140, { env });
      assert.ok(!out.includes('\n'), `${name} ${JSON.stringify(env)}`);
      assert.doesNotMatch(out, /48;2;255;160;51|180;140;255|[╭╰]/, `${name} ${JSON.stringify(env)}`);
    }
  }
  assert.ok(rowsOf(scene('ready').draw(140, { env: { COLORFGBG: '15;0' } })).length > 1, 'a dark ground keeps the card');
});

test('a still scene: the same state paints the same bytes at any time; only the rewind turns, one step per ten seconds', () => {
  for (const name of ['ready', 'idle', 'signin']) {
    const s = scene(name);
    for (const ms of [250, 9000, 60_000]) assert.equal(s.draw(120, { now: s.now + ms }), s.draw(120), name);
  }
  const s = scene('rewind');
  const start = Math.ceil(s.now / 10_000) * 10_000;
  assert.equal(s.draw(120, { now: start + 1 }).split('\n')[1], s.draw(120, { now: start }).split('\n')[1]);
  assert.notEqual(s.draw(120, { now: start + 10_000 }).split('\n')[1], s.draw(120, { now: start }).split('\n')[1]);
});

test('colour keeps its meaning: amber while it is your turn, red on an error, bands at 70% and 90%', () => {
  const turn = scene('turn').draw(120);
  assert.doesNotMatch(turn, /180;140;255|38;2;255;45;1(?:38|49)/, 'no neon and no pink sun');
  assert.match(turn, /1;38;2;255;176;32m⚠ YOUR TURN/);
  assert.match(scene('error').draw(120), /38;2;255;94;94mERROR/);
  const hot = scene('warning').draw(120);
  assert.match(hot, /38;2;255;94;94m93%/);
  assert.match(hot, /38;2;224;175;60m78%/);
  assert.match(scene('working').draw(120), /38;2;255;99;55m42%/);
});

test('dark ink keeps 4.5:1 on every step of the brand, stage and amber pills', () => {
  const lum = (c) => c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (const stops of [SUNSET_STOPS, STAGE_STOPS, [[255, 176, 32], [255, 176, 32]]]) {
    stops.slice(1).forEach((to, s) => {
      for (let k = 0; k <= 8; k += 1) {
        const ground = stops[s].map((v, i) => v + (to[i] - v) * (k / 8));
        assert.ok((lum(ground) + 0.05) / (lum(PILL_INK) + 0.05) >= 4.5, `${ground}`);
      }
    });
  }
});

test("the script draws the card from agy's terminal_width, prints nothing but the line and stays small", () => {
  const s = scene('working');
  const run = (more) => spawnSync(process.execPath, [join(PLUGIN, 'hud', 'statusline.mjs')], { input: JSON.stringify({ ...s.payload, ...more }), env: s.env, encoding: 'utf8', detached: true }); // no controlling terminal to measure
  const card = run({ terminal_width: 100 });
  assert.equal(card.stderr, '');
  assert.ok(visibleWidth(rowsOf(card.stdout)[0]) === 100);
  for (const name of NAMES) assert.ok(Buffer.byteLength(scene(name).draw(200)) < 14_000, `${name}: ${Buffer.byteLength(scene(name).draw(200))}`);
});
