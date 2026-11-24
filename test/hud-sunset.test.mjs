import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PLUGIN, textRow } from './helpers.mjs';
import { sessionPath } from '../plugin/hooks/lib/common.mjs';
import { PILL_INK, STAGE_STOPS, SUNSET_STOPS, renderStatus, visibleWidth } from '../plugin/hud/render.mjs';

// The sunset of the truecolor status line: a horizon row under the text row, art only in cells no text uses, the same two
// rows in every state, and today's single row everywhere the sunset does not belong.

const CID = 'conv-sunset';
const NOW = Date.parse('2026-10-21T09:00:00Z');
const strip = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');
const rowsOf = (out) => out.split('\n');

function fixture(route = null) {
  const root = mkdtempSync(join(tmpdir(), 'litgravity-sunset-'));
  const ws = join(root, 'ws');
  mkdirSync(ws);
  const env = { HOME: root, XDG_STATE_HOME: join(root, 'state'), PATH: process.env.PATH, COLORTERM: 'truecolor' };
  if (route) {
    const file = sessionPath(ws, CID, env);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ route, activatedAt: NOW - 600_000, lastKind: 'ignite' }));
  }
  return { ws, env };
}
const payload = (f, extra = {}) => ({
  cwd: f.ws, conversation_id: CID, model: { display_name: 'Gemini 3.8 Flash (Medium)' }, context_window: { used_percentage: 42, context_window_size: 1048576 }, vcs: { branch: 'main' }, ...extra,
});
const draw = (f, width, { extra = {}, env = {}, now = NOW } = {}) => renderStatus(payload(f, extra), { env: { ...f.env, ...env }, now, width });
const STATES = [
  [null, {}],
  [null, { agent_state: 'authenticating', model: null, context_window: { used_percentage: 0 } }],
  ['litwork', { agent_state: 'running', quota: { remaining_fraction: 0.2 }, conversation_title: '긴 대화 제목이 여기에 들어갑니다' }],
  ['lit-plan', { agent_state: 'error' }],
  ['start-work', { agent_state: 'waiting_for_input' }],
  ['lit-adhd', {}],
  ['review-work', { cost: 1.5 }],
];
// The text of the one-row line, with the mark's brackets as the pill's padding.
const todays = (f, width, extra) => draw(f, width, { extra, env: { NO_COLOR: '1' } }).replace(/^\[([^\]]*)\]/, ' $1 ');

test('the sunset never covers a word: at every width and state the text row reads as it did and art keeps three cells clear', () => {
  for (const [route, extra] of STATES) {
    const f = fixture(route);
    for (let width = 10; width <= 200; width += 1) {
      const out = draw(f, width, { extra });
      const text = strip(textRow(out));
      assert.equal(text, todays(f, width, extra), `${route} ${width}`);
      const [first, second] = rowsOf(out);
      for (const row of rowsOf(out)) assert.ok(visibleWidth(row) <= width, `${route} ${width}: ${visibleWidth(row)}`);
      const tail = strip(first).slice(text.length);
      assert.match(tail, /^( {3,}[ .+*▁▂▃▄▅▆▇█]*)?$/, `${route} ${width}`);
      if (second !== undefined) assert.match(strip(second), /^[ .~\-▁▂▃▄▅▆▇█]+$/, `${route} ${width}`);
    }
  }
});

test('the height follows the terminal alone: two rows from 60 columns in every state, one below it or when the width is unknown', () => {
  for (const [route, extra] of STATES) {
    const f = fixture(route);
    for (const width of [10, 40, 59, 60, 61, 80, 120, 200]) assert.equal(rowsOf(draw(f, width, { extra })).length, width >= 60 ? 2 : 1, `${route} ${width}`);
    assert.equal(rowsOf(renderStatus(payload(f, extra), { env: f.env, now: NOW })).length, 1, 'no width, no horizon');
  }
  const f = fixture();
  const run = (extra) => spawnSync(process.execPath, [join(PLUGIN, 'hud', 'statusline.mjs')], { input: JSON.stringify(payload(f, extra)), env: f.env, encoding: 'utf8' }).stdout;
  assert.equal(run({ terminal_width: 100 }).trimEnd().split('\n').length, 2, "agy's terminal_width turns the horizon on");
  assert.equal(run({}).trimEnd().split('\n').length, 1);
});

test('the sun stands on two rows where the text leaves room and on the horizon alone where it does not', () => {
  const f = fixture();
  const roomy = rowsOf(strip(draw(f, 120)));
  assert.match(roomy[0], /▁▄▅▆▇████▇▆▅▄▁/);
  assert.match(roomy[1], /▆▅{14}▆/);
  const busy = fixture('litwork');
  const tight = rowsOf(strip(draw(busy, 100, { extra: { agent_state: 'running' } })));
  assert.doesNotMatch(tight[0], /[▁▂▃▄▅▆▇]{2}/);
  assert.match(tight[1], /▃▅▆▇████▇▆▅▃/);
});

test('NO_COLOR, 256 and 16 colours, ASCII and a light ground keep the one row, with no sunset colour in it', () => {
  for (const [route, extra] of STATES) {
    const f = fixture(route);
    for (const env of [{ NO_COLOR: '1' }, { COLORTERM: '', TERM: 'xterm-256color' }, { LITGRAVITY_HUD_COLOR: '16' }, { LITGRAVITY_HUD_ASCII: '1' }, { COLORFGBG: '0;15' }, { COLORFGBG: '0;default;7' }, { TERM: 'dumb' }]) {
      const out = draw(f, 140, { extra, env: { ...env, WT_SESSION: '1', ...(env.LITGRAVITY_HUD_COLOR || env.LITGRAVITY_HUD_ASCII || env.COLORFGBG || env.NO_COLOR ? {} : { LITGRAVITY_HUD_COLOR: '256' }) } });
      assert.ok(!out.includes('\n'), JSON.stringify(env));
      assert.doesNotMatch(out, /48;2;255;160;51|180;140;255|[]/, JSON.stringify(env));
    }
  }
  assert.equal(rowsOf(draw(fixture(), 140, { env: { COLORFGBG: '15;0' } })).length, 2, 'a dark ground keeps the sunset');
});

test('the scene stands still: the same state paints the same bytes at any time', () => {
  for (const extra of [{}, { agent_state: 'running' }, { agent_state: 'idle' }]) {
    const f = fixture();
    const first = draw(f, 120, { extra });
    for (const ms of [250, 1000, 9000, 60_000]) assert.equal(draw(f, 120, { extra, now: NOW + ms }), first);
  }
});

test('YOUR TURN keeps its amber and the rewind its rainbow: neither takes the neon run, the violet chip or the pink sun', () => {
  const turn = draw(fixture('start-work'), 120, { extra: { agent_state: 'waiting_for_input' } });
  assert.doesNotMatch(turn, /180;140;255|38;2;255;45;138|255;79;139/);
  assert.match(rowsOf(turn)[1], /38;2;255;198;86m██/);
  const rewind = fixture('lit-adhd');
  const bare = textRow(draw(rewind, 120, { env: { TERM_PROGRAM: 'vscode' } }));
  assert.match(strip(bare), /ctx \[█▎░\]/, 'the rewind keeps its brackets');
  assert.doesNotMatch(bare, /38;2;255;45;149/);
  assert.equal(draw(rewind, 120, { now: NOW + 1 }), draw(rewind, 120), 'a still frame inside one bucket');
  assert.notEqual(rowsOf(draw(rewind, 120, { now: NOW + 10_000 }))[1], rowsOf(draw(rewind, 120))[1], 'the sea turns with the rainbow');
});

test('round gauge caps only where the terminal draws them, in the cells the brackets had', () => {
  for (const pct of [0, 7, 42, 75, 93, 100]) {
    const f = fixture();
    const extra = { context_window: { used_percentage: pct, context_window_size: 1048576 }, quota: { used_percentage: pct } };
    const bracketed = textRow(draw(f, 160, { extra }));
    assert.doesNotMatch(bracketed, /[]/);
    for (const env of [{ WT_SESSION: 'x' }, { TERM_PROGRAM: 'vscode' }]) {
      const round = textRow(draw(f, 160, { extra, env }));
      assert.equal((round.match(//g) ?? []).length, 2);
      assert.equal((round.match(//g) ?? []).length, 2);
      assert.equal(visibleWidth(round), visibleWidth(bracketed));
      assert.match(strip(round), new RegExp(`ctx .{3} ${pct}%/1049k`));
    }
    for (const TERM_PROGRAM of ['iTerm.app', 'Apple_Terminal', 'tmux']) assert.doesNotMatch(draw(f, 160, { extra, env: { TERM_PROGRAM } }), /[]/);
  }
});

test('dark ink keeps 4.5:1 on every step of the brand and stage pills', () => {
  const lum = (c) => c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (const stops of [SUNSET_STOPS, STAGE_STOPS]) {
    stops.slice(1).forEach((to, s) => {
      for (let k = 0; k <= 8; k += 1) {
        const ground = stops[s].map((v, i) => v + (to[i] - v) * (k / 8));
        assert.ok((lum(ground) + 0.05) / (lum(PILL_INK) + 0.05) >= 4.5, `${ground}`);
      }
    });
  }
});

test('the scene costs little: under 5 KB of text at 200 columns', () => {
  for (const [route, extra] of STATES) assert.ok(Buffer.byteLength(draw(fixture(route), 200, { extra })) < 5000, `${route}`);
});
