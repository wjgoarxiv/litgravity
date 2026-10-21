import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, workspace, runHook, basePayload, turn } from './helpers.mjs';

const stop = (ws, env, extra = {}) => runHook('stop', basePayload(ws, { executionNum: 1, terminationReason: 'NO_TOOL_CALL', fullyIdle: true, ...extra }), env);
const held = (r) => r.json?.decision === 'continue';

test('Stop does nothing without an active route', () => {
  const { env } = sandbox();
  const ws = workspace();
  assert.deepEqual(stop(ws, env).json, {});
});

test('lit-plan gate: holds once until plans/<slug>.md exists, then lets the turn end', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit plan x', 0);
  const first = stop(ws, env);
  assert.ok(held(first));
  assert.match(first.json.reason, /plans\/<slug>\.md/);
  assert.deepEqual(stop(ws, env).json, {}, 'the gate holds a turn at most once');

  const second = sandbox();
  const ws2 = workspace();
  turn(ws2, second.env, 'lit plan y', 0);
  mkdirSync(join(ws2.dir, 'plans'));
  writeFileSync(join(ws2.dir, 'plans', 'y.md'), '- [ ] 1. a\n');
  assert.deepEqual(stop(ws2, second.env).json, {}, 'plan written after activation');
});

test('Stop holds only a normal end of turn: errors, cancels and limits end it', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit plan x', 0);
  for (const reason of ['ERROR', 'USER_CANCELED', 'MAX_INVOCATIONS', 'MAX_FORCED_INVOCATIONS', 'MAX_TOKEN_BUDGET_EXCEEDED']) {
    assert.deepEqual(stop(ws, env, { terminationReason: reason }).json, {}, reason);
  }
});

test('start-work: open rows of an approved plan hold the turn, bounded to three holds without progress', () => {
  const { env } = sandbox();
  const ws = workspace();
  mkdirSync(join(ws.dir, 'plans'));
  const plan = join(ws.dir, 'plans', 'todo.md');
  writeFileSync(plan, '> Status: approved\n\n- [x] 1. scaffold\n- [ ] 2. add tags\n- [ ] 3. docs\n');
  turn(ws, env, 'lit start plans/todo.md', 0);
  for (let i = 0; i < 3; i += 1) {
    const r = stop(ws, env);
    assert.ok(held(r), `hold ${i + 1}`);
    assert.match(r.json.reason, /plans\/todo\.md has 2 open rows \(next: row 2\)/);
  }
  assert.deepEqual(stop(ws, env).json, {}, 'released after three holds with no progress');
  const ledger = readFileSync(join(ws.dir, '.litgravity', 'ledger', 'conv-test-0001.jsonl'), 'utf8');
  assert.match(ledger, /start-work hold released after 3 holds/);

  writeFileSync(plan, '> Status: approved\n\n- [x] 1. scaffold\n- [x] 2. add tags\n- [ ] 3. docs\n');
  const progress = stop(ws, env);
  assert.ok(held(progress), 'progress re-arms the hold');
  assert.match(progress.json.reason, /1 open row \(next: row 3\)/);
});

test('start-work: an unapproved plan, a pause word and a BLOCKED ledger note all release the hold', () => {
  const { env } = sandbox();
  const ws = workspace();
  mkdirSync(join(ws.dir, 'plans'));
  const plan = join(ws.dir, 'plans', 'todo.md');
  writeFileSync(plan, '> Status: draft\n\n- [ ] 1. scaffold\n');
  turn(ws, env, 'lit start plans/todo.md', 0);
  assert.deepEqual(stop(ws, env).json, {}, 'draft plan');
  writeFileSync(plan, '> Status: approved\n\n- [ ] 1. scaffold\n');
  assert.ok(held(stop(ws, env)));
  const note = JSON.stringify({ ts: 'x', kind: 'note', text: 'BLOCKED at row 1: missing credential' });
  writeFileSync(join(ws.dir, '.litgravity', 'ledger', 'conv-test-0001.jsonl'), `${note}\n`, { flag: 'a' });
  assert.deepEqual(stop(ws, env).json, {}, 'BLOCKED note');

  const paused = sandbox();
  const ws2 = workspace();
  mkdirSync(join(ws2.dir, 'plans'));
  writeFileSync(join(ws2.dir, 'plans', 'todo.md'), '> Status: approved\n\n- [ ] 1. scaffold\n');
  turn(ws2, paused.env, 'lit start plans/todo.md', 0);
  turn(ws2, paused.env, 'lit continue, but pause for now', 10);
  assert.deepEqual(stop(ws2, paused.env).json, {}, 'pause word');
});

test('litgoal: an open criterion of a goal record this conversation touched holds the turn', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit goal ship the export', 0);
  mkdirSync(join(ws.dir, '.litgravity', 'goals'), { recursive: true });
  const rec = { slug: 'export', objective: 'ship', status: 'active', updated: '2026-10-20', criteria: [{ id: 'c1', text: 'csv export exits 0', status: 'pass' }, { id: 'c2', text: 'header row matches', status: 'open' }] };
  const file = join(ws.dir, '.litgravity', 'goals', 'export.json');
  writeFileSync(file, JSON.stringify(rec));
  assert.deepEqual(stop(ws, env).json, {}, 'a record nobody touched is not this conversation\'s');

  runHook('post-tool-use', basePayload(ws, { toolCall: { name: 'write_to_file', args: { TargetFile: file } } }), env);
  const r = stop(ws, env);
  assert.ok(held(r));
  assert.match(r.json.reason, /export\.json is 1\/2 passed; next open criterion c2: header row matches/);

  rec.criteria[1].status = 'pass';
  writeFileSync(file, JSON.stringify(rec));
  assert.deepEqual(stop(ws, env).json, {}, 'all criteria pass');
});

test('litgoal: a record that names the conversation is enough, and LITGRAVITY_GOAL_HOLD=0 turns the hold off', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit goal ship', 0);
  mkdirSync(join(ws.dir, '.litgravity', 'goals'), { recursive: true });
  writeFileSync(join(ws.dir, '.litgravity', 'goals', 'a.json'), JSON.stringify({ status: 'active', conversation_id: 'conv-test-0001', criteria: [{ id: 'c1', text: 't', status: 'fail' }] }));
  assert.ok(held(stop(ws, env)));
  const off = runHook('stop', basePayload(ws, { terminationReason: 'NO_TOOL_CALL' }), { ...env, LITGRAVITY_GOAL_HOLD: '0' });
  assert.deepEqual(off.json, {});
});
