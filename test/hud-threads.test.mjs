import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderStatus, visibleWidth } from '../plugin/hud/render.mjs';
import { applyStackEvent, emptyStack, writeStack } from '../plugin/hooks/lib/workflow-stack.mjs';
import { writeLanes } from '../plugin/hooks/lib/lanes.mjs';
import { sandbox } from './helpers.mjs';

const now = () => new Date('2026-10-26T12:00:00Z');

function setupRoute(env, cwd, convId, route) {
  const stateHome = env.XDG_STATE_HOME || join(env.HOME, '.local', 'state');
  let real;
  try { real = realpathSync(cwd); } catch { real = resolve(cwd); }
  const ws = createHash('sha256').update(real).digest('hex').slice(0, 16);
  const dir = join(stateHome, 'litgravity', 'sessions', ws);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${convId}.json`), JSON.stringify({ route, activatedAt: now().getTime(), lastKind: 'ignite' }));
  return dir;
}

function render(env, cwd, convId, width = 120) {
  return renderStatus({ conversation_id: convId, workspace: cwd }, { env, now: now().getTime(), width });
}

function plain(line) {
  return line.replace(/\u001b\[[0-9;]*m/g, '');
}

test('1 thread: single frame keeps the old layout unchanged (no thread segment)', () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-hud1-'));
  const convId = 'conv-hud-001';
  setupRoute(env, cwd, convId, 'lit-loop');
  const { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-loop' }, now());
  writeStack(cwd, convId, stack, env);
  const line = render(env, cwd, convId);
  assert.ok(!line.includes('+1 paused'), 'single frame must not show paused');
  assert.ok(!line.includes('+1 lane'), 'single frame must not show lanes');
});

test('paused parent: shows +1 paused, no ? glyph for the top frame without a recorded count', () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-hud2-'));
  const convId = 'conv-hud-002';
  setupRoute(env, cwd, convId, 'lit-brainstorm');
  let { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-loop' }, now());
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'lit-brainstorm' }, now()));
  writeStack(cwd, convId, stack, env);
  const line = plain(render(env, cwd, convId));
  assert.ok(line.includes('+1 paused'), 'should show +1 paused for the paused spine');
  assert.ok(!line.includes('k/?'), 'must not show k/?');
  assert.ok(!line.includes('?/?'), 'must not show ?/?');
});

test('3 lanes: shows +3 lanes when three active subagent lanes exist', () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-hud3-'));
  const convId = 'conv-hud-003';
  setupRoute(env, cwd, convId, 'lit-loop');
  const { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-loop' }, now());
  writeStack(cwd, convId, stack, env);
  const lanes = [
    { name: 'agent-1', status: 'active', steps: 2, at: now().toISOString() },
    { name: 'agent-2', status: 'active', steps: 1, at: now().toISOString() },
    { name: 'agent-3', status: 'active', steps: 0, at: now().toISOString() },
  ];
  writeLanes(cwd, convId, lanes, env);
  const line = plain(render(env, cwd, convId));
  assert.ok(line.includes('+3 lanes'), 'should show +3 lanes');
});

test('overflow +N: lanes preferred over paused count when both exist', () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-hud4-'));
  const convId = 'conv-hud-004';
  setupRoute(env, cwd, convId, 'lit-brainstorm');
  let { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-loop' }, now());
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'lit-brainstorm' }, now()));
  writeStack(cwd, convId, stack, env);
  const lanes = [
    { name: 'agent-1', status: 'active', steps: 0, at: now().toISOString() },
    { name: 'agent-2', status: 'active', steps: 0, at: now().toISOString() },
  ];
  writeLanes(cwd, convId, lanes, env);
  const line = plain(render(env, cwd, convId));
  assert.ok(line.includes('+2 lanes'), 'lanes should take precedence');
  assert.ok(!line.includes('paused'), 'paused should not show when lanes are active');
});

test('stale sessions dropped: lanes older than 1 hour are not counted', () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-hud5-'));
  const convId = 'conv-hud-005';
  setupRoute(env, cwd, convId, 'lit-loop');
  const { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-loop' }, now());
  writeStack(cwd, convId, stack, env);
  const staleAt = new Date(now().getTime() - 2 * 60 * 60 * 1000).toISOString();
  const lanes = [
    { name: 'stale-agent', status: 'active', steps: 5, at: staleAt },
  ];
  writeLanes(cwd, convId, lanes, env);
  const line = plain(render(env, cwd, convId));
  assert.ok(!line.includes('lane'), 'stale lanes must be dropped');
});

test('repaint stable: same input produces the same bytes', () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-hud6-'));
  const convId = 'conv-hud-006';
  setupRoute(env, cwd, convId, 'lit-brainstorm');
  let { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-loop' }, now());
  ({ stack } = applyStackEvent(stack, { type: 'move', stage: 'RED', n: 2, total: 5 }, now()));
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'lit-brainstorm' }, now()));
  writeStack(cwd, convId, stack, env);
  const a = render(env, cwd, convId, 100);
  const b = render(env, cwd, convId, 100);
  assert.equal(a, b, 'repaint must be stable (same input -> same bytes)');
});

test('rendered line fits within the requested width at all widths', () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-hud7-'));
  const convId = 'conv-hud-007';
  setupRoute(env, cwd, convId, 'lit-loop');
  let { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-loop' }, now());
  ({ stack } = applyStackEvent(stack, { type: 'move', stage: 'RED', n: 2, total: 5 }, now()));
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'lit-brainstorm' }, now()));
  writeStack(cwd, convId, stack, env);
  for (const width of [60, 80, 120]) {
    const line = render(env, cwd, convId, width);
    assert.ok(visibleWidth(plain(line)) <= width, `visible width ${visibleWidth(plain(line))} exceeds ${width}`);
  }
});

test('count chain falls through to null when no plan, goal or recorded count — no ? glyph', () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-hud8-'));
  const convId = 'conv-hud-008';
  setupRoute(env, cwd, convId, 'lit-brainstorm');
  let { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-loop' }, now());
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'lit-brainstorm' }, now()));
  writeStack(cwd, convId, stack, env);
  const line = plain(render(env, cwd, convId));
  assert.ok(!line.includes('k/?'), 'must not show k/?');
  assert.ok(!line.includes('?/?'), 'must not show ?/?');
  assert.ok(!line.includes('?'), `must not contain any ? glyph, got: ${line}`);
});

test('rainbow paint: lit-adhd route produces ANSI colour codes with truecolor', () => {
  const { env } = sandbox();
  env.COLORTERM = 'truecolor';
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-rainbow-'));
  const convId = 'conv-rainbow-001';
  setupRoute(env, cwd, convId, 'lit-adhd');
  const { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-adhd' }, now());
  writeStack(cwd, convId, stack, env);
  const line = render(env, cwd, convId);
  assert.ok(line.includes('\u001b['), 'rainbow mode should produce ANSI escape codes');
  assert.ok(line.includes('38;2;'), 'truecolor rainbow should use RGB codes');
});

test('rainbow paint: NO_COLOR suppresses all escapes even on lit-adhd route', () => {
  const { env } = sandbox();
  env.NO_COLOR = '1';
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-nocolor-'));
  const convId = 'conv-nocolor-001';
  setupRoute(env, cwd, convId, 'lit-adhd');
  const { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-adhd' }, now());
  writeStack(cwd, convId, stack, env);
  const line = render(env, cwd, convId);
  assert.ok(!line.includes('\u001b['), 'NO_COLOR must suppress all ANSI escapes');
});

test('count chain reads plan checkboxes when the top frame has a plan ref', () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-hud9-'));
  mkdirSync(join(cwd, 'plans'), { recursive: true });
  writeFileSync(join(cwd, 'plans', 'test.md'), '- [x] 1. Done\n- [x] 2. Also done\n- [ ] 3. Open\n');
  const convId = 'conv-hud-009';
  setupRoute(env, cwd, convId, 'start-work');
  let { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'start-work', ref: { plan: 'plans/test.md' } }, now());
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'lit-brainstorm' }, now()));
  writeStack(cwd, convId, stack, env);
  const line = plain(render(env, cwd, convId));
  assert.ok(line.includes('2/3'), 'should show 2/3 from plan checkboxes');
});

test('rainbow paint: every cell takes its own hue, pills included, and the plain width holds', () => {
  const { env } = sandbox();
  env.COLORTERM = 'truecolor';
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-rainbow-cells-'));
  const convId = 'conv-rainbow-cells';
  setupRoute(env, cwd, convId, 'lit-adhd');
  const { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-adhd' }, now());
  writeStack(cwd, convId, stack, env);
  const line = render(env, cwd, convId);
  const fgs = new Set([...line.matchAll(/38;2;(\d+;\d+;\d+)/g)].map((m) => m[1]).filter((c) => c !== '20;20;24'));
  assert.ok(fgs.size >= 12, `cells should spread round the wheel, saw ${fgs.size} colours`);
  // A pill turns too: its ground is a rainbow step under the dark ink.
  assert.match(line, /38;2;20;20;24;48;2;\d+;\d+;\d+m/);
});

test('rainbow paint: at 60 to 160 columns and across 40 buckets the line measures what the plain line does', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-rainbow-width-'));
  const convId = 'conv-rainbow-width';
  const { env } = sandbox();
  setupRoute(env, cwd, convId, 'lit-adhd');
  const { stack } = applyStackEvent(emptyStack(convId), { type: 'start', skill: 'lit-adhd' }, now());
  writeStack(cwd, convId, stack, env);
  const input = { conversation_id: convId, workspace: cwd, model: { display_name: 'Gemini 3.8 Flash (Medium)' } };
  const t0 = now().getTime();
  for (const width of [60, 80, 100, 120, 160]) {
    for (let frame = 0; frame < 40; frame += 1) {
      const flat = renderStatus(input, { env: { ...env, NO_COLOR: '1' }, width, now: t0 + frame * 10_000 });
      const line = renderStatus(input, { env: { ...env, COLORTERM: 'truecolor' }, width, now: t0 + frame * 10_000 });
      assert.equal(line.replace(/\u001b\[[0-9;]*m/g, ''), flat, `text changed at ${width} cols, frame ${frame}`);
      assert.ok(visibleWidth(flat) <= width, `wider than ${width}`);
    }
  }
});
