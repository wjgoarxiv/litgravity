import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyStackEvent, emptyStack, readStack, writeStack, READ_ONLY_DISCIPLINES, MAX_FRAMES,
} from '../plugin/hooks/lib/workflow-stack.mjs';

const now = () => new Date('2026-10-26T00:00:00Z');

test('push a spine frame', () => {
  const { stack, transitions } = applyStackEvent(emptyStack('s1'), { type: 'start', skill: 'lit-loop' }, now());
  assert.equal(stack.frames.length, 1);
  assert.equal(stack.frames[0].skill, 'lit-loop');
  assert.equal(stack.frames[0].role, 'spine');
  assert.equal(stack.frames[0].status, 'active');
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].type, 'started');
});

test('interleave: pause the spine and push a side frame', () => {
  let { stack } = applyStackEvent(emptyStack('s1'), { type: 'start', skill: 'lit-loop' }, now());
  const result = applyStackEvent(stack, { type: 'start', skill: 'lit-brainstorm' }, now());
  stack = result.stack;
  assert.equal(stack.frames.length, 2);
  assert.equal(stack.frames[0].skill, 'lit-loop');
  assert.equal(stack.frames[0].status, 'paused');
  assert.equal(stack.frames[1].skill, 'lit-brainstorm');
  assert.equal(stack.frames[1].status, 'active');
  assert.equal(stack.frames[1].role, 'side');
  const paused = result.transitions.find((t) => t.type === 'paused');
  assert.ok(paused);
  assert.equal(paused.skill, 'lit-loop');
});

test('continue: close the side and resume the spine with stage and count preserved', () => {
  let { stack } = applyStackEvent(emptyStack('s1'), { type: 'start', skill: 'lit-loop' }, now());
  ({ stack } = applyStackEvent(stack, { type: 'move', stage: 'VERIFY', n: 3, total: 7 }, now()));
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'lit-brainstorm' }, now()));
  assert.equal(stack.frames[0].stage, 'VERIFY');
  assert.equal(stack.frames[0].n, 3);
  assert.equal(stack.frames[0].total, 7);
  const result = applyStackEvent(stack, { type: 'continue' }, now());
  stack = result.stack;
  assert.equal(stack.frames.length, 1);
  assert.equal(stack.frames[0].skill, 'lit-loop');
  assert.equal(stack.frames[0].status, 'active');
  assert.equal(stack.frames[0].stage, 'VERIFY');
  assert.equal(stack.frames[0].n, 3);
  assert.equal(stack.frames[0].total, 7);
  assert.ok(result.transitions.some((t) => t.type === 'resumed' && t.skill === 'lit-loop'));
  assert.ok(result.transitions.some((t) => t.type === 'side.done' && t.skill === 'lit-brainstorm'));
});

test('read-only disciplines do not touch the stack', () => {
  for (const skill of READ_ONLY_DISCIPLINES) {
    const { stack } = applyStackEvent(emptyStack('s1'), { type: 'start', skill }, now());
    assert.equal(stack.frames.length, 0, skill);
  }
});

test('restart clears the stack', () => {
  let { stack } = applyStackEvent(emptyStack('s1'), { type: 'start', skill: 'lit-loop' }, now());
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'lit-plan', restart: true }, now()));
  assert.equal(stack.frames.length, 1);
  assert.equal(stack.frames[0].skill, 'lit-plan');
});

test('successor in the main chain replaces the frame', () => {
  let { stack } = applyStackEvent(emptyStack('s1'), { type: 'start', skill: 'lit-plan' }, now());
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'start-work' }, now()));
  assert.equal(stack.frames.length, 1);
  assert.equal(stack.frames[0].skill, 'start-work');
  assert.equal(stack.frames[0].role, 'spine');
});

test('move updates the active frame', () => {
  let { stack } = applyStackEvent(emptyStack('s1'), { type: 'start', skill: 'lit-loop' }, now());
  ({ stack } = applyStackEvent(stack, { type: 'move', stage: 'RED', n: 1, total: 5 }, now()));
  assert.equal(stack.frames[0].stage, 'RED');
  assert.equal(stack.frames[0].n, 1);
  assert.equal(stack.frames[0].total, 5);
});

test('plan ref is carried through the main chain', () => {
  const ref = { plan: 'plans/export.md' };
  let { stack } = applyStackEvent(emptyStack('s1'), { type: 'start', skill: 'lit-plan', ref }, now());
  ({ stack } = applyStackEvent(stack, { type: 'move', done: true }, now()));
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'start-work' }, now()));
  assert.deepEqual(stack.frames[0].ref, ref);
});

test('store: write and read a stack file', () => {
  const home = mkdtempSync(join(tmpdir(), 'litgravity-stack-'));
  const env = { HOME: home, XDG_STATE_HOME: join(home, '.local', 'state') };
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-ws-'));
  let { stack } = applyStackEvent(emptyStack('conv-001'), { type: 'start', skill: 'lit-loop' }, now());
  writeStack(cwd, 'conv-001', stack, env);
  const back = readStack(cwd, 'conv-001', env);
  assert.equal(back.frames.length, 1);
  assert.equal(back.frames[0].skill, 'lit-loop');
});

test('MAX_FRAMES drops the oldest side when exceeded', () => {
  let { stack } = applyStackEvent(emptyStack('s1'), { type: 'start', skill: 'lit-loop' }, now());
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'lit-brainstorm' }, now()));
  assert.equal(stack.frames.length, 2);
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'litresearch' }, now()));
  assert.equal(stack.frames.length, MAX_FRAMES);
  ({ stack } = applyStackEvent(stack, { type: 'start', skill: 'lit-code' }, now()));
  assert.equal(stack.frames.length, MAX_FRAMES);
});
