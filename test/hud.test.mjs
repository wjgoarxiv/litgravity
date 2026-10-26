import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PLUGIN } from './helpers.mjs';
import { sessionPath } from '../plugin/hooks/lib/common.mjs';
import { renderStatus, visibleWidth } from '../plugin/hud/render.mjs';

const SCRIPT = join(PLUGIN, 'hud', 'statusline.mjs');
const CID = 'conv-hud-1';
const NOW = Date.parse('2026-10-21T09:00:00Z');
const ESC = /\u001b/;
const strip = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');

// The shape agy 1.4.3 documents for status line scripts. Only model and context_window were seen live (the predecessor
// line rendered `G-f (Medium) 3.8 │ ctx 0%/1049k`); every other field is optional and the HUD must survive without it.
function payload(ws, extra = {}) {
  return {
    cwd: ws,
    conversation_id: CID,
    model: { id: 'gemini-3.8-flash-medium', display_name: 'Gemini 3.8 Flash (Medium)' },
    context_window: { used_percentage: 42, context_window_size: 1048576 },
    ...extra,
  };
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'litgravity-hud-'));
  const ws = join(root, 'ws');
  mkdirSync(ws);
  const env = { HOME: root, XDG_STATE_HOME: join(root, 'state'), PATH: process.env.PATH, COLORTERM: 'truecolor' };
  return { root, ws, env };
}

function setRoute(f, state) {
  const file = sessionPath(f.ws, CID, f.env);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(state));
}

function write(f, rel, body) {
  const file = join(f.ws, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
}

const render = (f, extra, opts = {}) => renderStatus(payload(f.ws, extra), { env: f.env, now: NOW, width: 200, ...opts });

function runScript(input, env, extra = {}) {
  return spawnSync(process.execPath, [SCRIPT], { input, env: { ...env, ...extra }, encoding: 'utf8', timeout: 5000 });
}

// The family status-line tokens this line must keep: the mark, one accent, the separators, bracketed gauges, the bands
// and the six-stop loop map. The exact escape sequences are pinned so a restyle cannot drift by accident.
const ACCENT = '38;2;255;99;55';
const BRAND_TRUE = '\u001b[0m\u001b[1m[🔥\u001b[38;2;255;45;149mL\u001b[38;2;128;137;202mI\u001b[38;2;0;229;255mT\u001b[38;2;0;229;255m v';
const spansOf = (line) => [...line.matchAll(/\u001b\[([0-9;]*)m([^\u001b]+)/g)].map((m) => ({ codes: m[1], text: m[2] }));

test('the mark is the family mark: bold [🔥LIT v…] on the pink, violet, cyan gradient, with its 256 and 16 colour forms', () => {
  const f = fixture();
  assert.ok(render(f).startsWith(BRAND_TRUE), JSON.stringify(render(f).slice(0, 120)));
  assert.match(render(f, {}, { env: { ...f.env, COLORTERM: '', TERM: 'xterm-256color' } }), /^\u001b\[0m\u001b\[1m\u001b\[38;5;201m\[🔥LIT v\d+\.\d+\.\d+\]\u001b\[0m/);
  assert.match(render(f, {}, { env: { ...f.env, LITGRAVITY_HUD_COLOR: '16' } }), /^\u001b\[0m\u001b\[1m\u001b\[36m\[🔥LIT v[\d.]+\]\u001b\[0m/);
  assert.match(strip(render(f)), /^\[🔥LIT v\d+\.\d+\.\d+\] \| /);
});

test('one accent: every word after the mark is LitGravity orange, separators included', () => {
  const f = fixture();
  const out = render(f, { vcs: { branch: 'feat/hud', modified: 3 }, cost: 0.5, conversation_title: 'HUD' });
  const body = spansOf(out.slice(out.indexOf('\u001b[0m', BRAND_TRUE.length) + 4));
  const words = body.filter((s) => /[A-Za-z0-9|│%$]/.test(s.text));
  assert.ok(words.length > 8);
  for (const s of words) assert.equal(s.codes, ACCENT, `${JSON.stringify(s.text)} is ${s.codes}`);
  const cells = body.filter((s) => /^[░]+$/.test(s.text));
  for (const s of cells) assert.equal(s.codes, '38;5;238', 'empty gauge cells');
});

test('order, separators and bracketed gauges follow the family line: model [effort] │ ctx [..] n%/size │ quota [..]n%', () => {
  const f = fixture();
  const text = strip(render(f, { quota: [{ model: 'Gemini 3.8 Flash', remaining_fraction: 0.72, reset_in_seconds: 7500 }], vcs: { branch: 'feat/hud', modified: 3 } }));
  assert.match(text, /^\[🔥LIT v[\d.]+\] \| GF3\.8 \[medium\] │ ctx \[█▎░\] 42%\/1049k │ quota \[▌░\]28% ↻ 2h5m │ git feat\/hud \+3 ✓$/);
  assert.match(strip(render(f, { context_window: { used_percentage: 7, context_window_size: 1000000 } })), /ctx \[▎░░\] 7%\/1m/);
});

test('colour carries only the bands: context and quota turn yellow at 70% and red at 90%', () => {
  const f = fixture();
  const ctxFill = (pct) => spansOf(render(f, { context_window: { used_percentage: pct, context_window_size: 200000 } })).find((s) => /[█▏▎▍▌▋▊▉]/.test(s.text)).codes;
  assert.equal(ctxFill(42), ACCENT);
  assert.equal(ctxFill(75), '38;5;178');
  assert.equal(ctxFill(93), '38;5;167');
  const quotaPct = (used) => spansOf(render(f, { quota: { used_percentage: used } })).find((s) => /^\d+%$/.test(s.text)).codes;
  assert.equal(quotaPct(30), '38;5;71');
  assert.equal(quotaPct(80), '38;5;178');
  assert.equal(quotaPct(95), '38;5;167');
});

test('an active route shows the pink 🔥 LIT chip, the route in the accent and its clock', () => {
  const f = fixture();
  setRoute(f, { route: 'lit-loop', activatedAt: NOW - (12 * 60 + 5) * 1000, lastKind: 'ignite' });
  const out = render(f);
  assert.ok(out.includes('\u001b[1;38;2;11;15;20;48;2;255;45;149m 🔥 LIT \u001b[0m'), 'pink chip with dark ink');
  assert.match(strip(out), / 🔥 LIT  · lit-loop 12:05 │ /);
});

test('the first 90 seconds read as the family ignition mark, then the chip settles', () => {
  const f = fixture();
  setRoute(f, { route: 'lit-loop', activatedAt: NOW - 20_000, lastKind: 'ignite' });
  assert.match(strip(render(f)), / 🔥 LIT  IGNITED · lit-loop 🔥/);
  setRoute(f, { route: 'lit-loop', activatedAt: NOW - 120_000, lastKind: 'ignite' });
  assert.doesNotMatch(strip(render(f)), /IGNITED/);
});

test('the loop map has the family six stops and follows the open criterion\'s evidence files', () => {
  const f = fixture();
  setRoute(f, { route: 'litwork', activatedAt: NOW - 65 * 60_000, goalPath: '.litgravity/goals/g1.json' });
  write(f, '.litgravity/goals/g1.json', {
    status: 'active',
    conversation_id: CID,
    criteria: [
      { id: 'c1', status: 'pass', evidence: ['.litgravity/evidence/hud/c1-surface.log'] },
      { id: 'c2', status: 'open', attempt: 1, evidence: [] },
      { id: 'c3', status: 'open' },
    ],
  });
  write(f, '.litgravity/evidence/hud/c1-surface.log', 'ok');
  write(f, '.litgravity/evidence/hud/before.log', 'pin');
  write(f, '.litgravity/evidence/hud/c2-red.log', 'red');
  const out = render(f, {}, { width: 240 });
  const text = strip(out);
  assert.match(text, /litwork 1:05:00 │ PIN ✓ ━ RED ✓ ━  GREEN  ━ VERIFY · ─ REVIEW · ─ RECORD ·  goal 1\/3/);
  assert.doesNotMatch(text, /SURFACE|CLEAN/);
  assert.ok(out.includes('\u001b[1;38;2;11;15;20;48;2;255;99;55m GREEN \u001b[0m'), 'current stop is an accent chip');
  assert.ok(out.includes('\u001b[38;5;245mPIN ✓\u001b[0m'), 'done stops are dim');
  assert.ok(out.includes('\u001b[38;5;245mVERIFY ·\u001b[0m'), 'stops ahead are dim');
  write(f, '.litgravity/evidence/hud/c2-surface.log', 'surface');
  assert.match(strip(render(f, {}, { width: 240 })), /VERIFY ✓ ━  REVIEW  ━ RECORD ·/);
  write(f, '.litgravity/evidence/hud/c2-cleanup.log', 'clean');
  assert.match(strip(render(f, {}, { width: 240 })), /REVIEW ✓ ━  RECORD /);
});

test('start-work sits on the main map at work with its plan count and next row', () => {
  const f = fixture();
  setRoute(f, { route: 'start-work', activatedAt: NOW - 5_000_000 });
  write(f, 'plans/hud.md', '# Plan\nStatus: approved\n\n- [x] 1. one\n- [x] 2. two\n- [ ] 3. three\n- [ ] 4. four\n');
  assert.match(strip(render(f, {}, { width: 240 })), /interview ✓ ━ plan ✓ ━  work 2\/4  ━ review · ─ done ·  next ▸ 3/);
});

test('lit-plan sits on the main map at plan', () => {
  const f = fixture();
  setRoute(f, { route: 'lit-plan', activatedAt: NOW - 120_000 });
  assert.match(strip(render(f, {}, { width: 240 })), /lit-plan 2:00 │ interview ✓ ━  plan  ━ work · ─ review · ─ done ·/);
});

test('lit-team shows one lane mark per member and the live and reported counts', () => {
  const f = fixture();
  setRoute(f, { route: 'lit-team', activatedAt: NOW - 120_000 });
  write(f, '.litgravity/team/t1/team.json', {
    status: 'active',
    members: [{ id: 'A', status: 'reported' }, { id: 'B', status: 'active' }, { id: 'C', status: 'pending' }, { id: 'D', status: 'blocked' }],
  });
  assert.match(strip(render(f, { task_count: 2 }, { width: 240 })), /✓●◌✗ 1 lane · 1\/4 reported .*│ bg 2/);
});

test('host extras: waiting state as YOUR TURN in amber, quota reset, cost, git from vcs, title', () => {
  const f = fixture();
  const out = render(f, {
    agent_state: 'waiting_for_input',
    quota: [{ model: 'Gemini 3.8 Flash', remaining_fraction: 0.72, reset_in_seconds: 7500 }],
    cost: 0.4271,
    vcs: { branch: 'feat/hud', dirty: true, modified: 3, ahead: 1 },
    conversation_title: 'HUD polish',
  }, { width: 240 });
  const text = strip(out);
  assert.ok(out.includes('\u001b[1;38;2;255;176;32m⚠ YOUR TURN\u001b[0m'), 'the waiting label in amber');
  assert.ok(out.includes('\u001b[38;2;255;176;32mgit feat/hud'), 'the whole row takes the amber paint');
  assert.match(text, /quota \[▌░\]28% ↻ 2h5m/);
  assert.match(text, /\$0\.43/);
  assert.match(text, /git feat\/hud \+3 ↑1/);
  assert.match(text, /HUD polish/);
});

test('without vcs from the host the branch comes from git, cached for a few seconds', () => {
  const f = fixture();
  const git = (...args) => spawnSync('git', ['-C', f.ws, ...args], { encoding: 'utf8' });
  git('init', '-q', '-b', 'hud-branch');
  writeFileSync(join(f.ws, 'a.txt'), 'a');
  assert.match(strip(render(f)), /git hud-branch \+1 ✓/);
  git('checkout', '-q', '-b', 'other');
  assert.match(strip(render(f)), /git hud-branch/, 'cached');
  assert.match(strip(renderStatus(payload(f.ws), { env: f.env, now: NOW + 6000, width: 200 })), /git other/, 'refreshed after the cache expires');
});

test('unknown or missing fields never print placeholders', () => {
  const f = fixture();
  const text = strip(renderStatus({}, { env: f.env, now: NOW, width: 200 }));
  assert.match(text, /^\[🔥LIT v[\d.]+\]$/);
  const odd = strip(renderStatus({ model: 7, context_window: { used_percentage: 'x' }, quota: 'none', vcs: [], cost: 'free', agent_state: { nested: 1 } }, { env: f.env, now: NOW, width: 200 }));
  assert.doesNotMatch(odd, /undefined|NaN|null|ctx|quota|\$/);
});

test('every width fits its budget, keeps the mark, and keeps ctx down to 40 columns', () => {
  const f = fixture();
  setRoute(f, { route: 'litwork', activatedAt: NOW - 600_000 });
  write(f, '.litgravity/goals/g1.json', { status: 'active', conversation_id: CID, criteria: [{ id: 'c1', status: 'open' }] });
  const extra = { agent_state: 'running', quota: { remaining_fraction: 0.5 }, cost: 1.2, vcs: { branch: 'main' }, conversation_title: '긴 대화 제목이 여기에 들어갑니다', task_count: 1 };
  for (const width of [30, 40, 60, 80, 100, 120, 160, 240]) {
    for (const mode of [{}, { NO_COLOR: '1' }, { LITGRAVITY_HUD_ASCII: '1' }, { LITGRAVITY_HUD_COLOR: '16' }]) {
      const out = renderStatus(payload(f.ws, extra), { env: { ...f.env, ...mode }, now: NOW, width });
      assert.ok(visibleWidth(out) <= width, `${width} ${JSON.stringify(mode)}: ${visibleWidth(out)} > ${width}: ${strip(out)}`);
      assert.match(strip(out), /LIT/);
      if (width >= 40) assert.match(strip(out), /ctx/, `${width}: ${strip(out)}`);
      assert.ok(!out.includes('\n'));
    }
  }
  assert.match(strip(renderStatus(payload(f.ws, extra), { env: f.env, now: NOW, width: 240 })), / PIN  ━ RED · ─ GREEN · ─ VERIFY · ─ REVIEW · ─ RECORD ·/);
});

test('colour off and ASCII fallbacks', () => {
  const f = fixture();
  setRoute(f, { route: 'litwork', activatedAt: NOW - 600_000 });
  const plain = render(f, {}, { env: { ...f.env, NO_COLOR: '1' } });
  assert.doesNotMatch(plain, ESC);
  const ascii = render(f, { vcs: { branch: 'main' }, quota: { used_percentage: 20 } }, { env: { ...f.env, LITGRAVITY_HUD_ASCII: '1' } });
  assert.match(ascii, /^[\x20-\x7e\u001b]*$/, ascii);
  assert.match(strip(ascii), /^\[LIT v[\d.]+\] \| GF3\.8 \[medium\] \| ctx \[#--\] 42%\/1049k \| quota \[--\]20% \| \[LIT\] \. litwork 10:00/);
  const c256 = render(f, {}, { env: { ...f.env, COLORTERM: '', TERM: 'xterm-256color' } });
  assert.match(c256, /\u001b\[38;5;202m/, '256-colour accent');
  assert.doesNotMatch(c256, /38;2;/);
  const c16 = render(f, {}, { env: { ...f.env, LITGRAVITY_HUD_COLOR: '16' } });
  assert.doesNotMatch(c16, /38;[25];/);
  const dumb = render(f, {}, { env: { ...f.env, TERM: 'dumb' } });
  assert.doesNotMatch(dumb, ESC);
});

test('host strings cannot inject escapes or new lines', () => {
  const f = fixture();
  const out = render(f, { vcs: { branch: 'x\u001b[2Jy' }, conversation_title: 'a\nb\u0007c' });
  assert.ok(!out.includes('\u001b[2J'));
  assert.ok(!out.includes('\n'));
  assert.ok(!out.includes('\u0007'));
});

test('the script prints one line and exits 0 on any stdin, including garbage', () => {
  const f = fixture();
  for (const input of ['', 'not json', '[]', 'null', '42', '{"model":', JSON.stringify(payload(f.ws)), 'x'.repeat(300000)]) {
    const r = runScript(input, f.env);
    assert.equal(r.status, 0, `${input.slice(0, 20)}: ${r.stderr}`);
    assert.equal(r.stdout.split('\n').filter(Boolean).length, 1, r.stdout);
    assert.match(strip(r.stdout), /LIT/);
    assert.equal(r.stderr, '');
  }
});

test('the script stays fast: render under 10 ms in process, a whole run well under the host budget', () => {
  const f = fixture();
  setRoute(f, { route: 'litwork', activatedAt: NOW - 600_000 });
  const input = payload(f.ws, { vcs: { branch: 'main' } });
  const t0 = performance.now();
  for (let i = 0; i < 20; i += 1) renderStatus(input, { env: f.env, now: NOW, width: 160 });
  assert.ok((performance.now() - t0) / 20 < 10, 'in-process render');
  const runs = [];
  for (let i = 0; i < 5; i += 1) {
    const s = performance.now();
    runScript(JSON.stringify(input), f.env);
    runs.push(performance.now() - s);
  }
  runs.sort((a, b) => a - b);
  assert.ok(runs[2] < 400, `median ${runs[2].toFixed(0)} ms`);
});
