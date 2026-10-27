import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sandbox, workspace, runHook, basePayload } from './helpers.mjs';
import { sessionPath } from '../plugin/hooks/lib/common.mjs';
import { livePath, readLive, listLive, LIVE_THROTTLE_MS, ALIVE_STALE_MS, IDLE_STALE_MS } from '../plugin/hooks/lib/liveness.mjs';
import { collectRewind } from '../plugin/hooks/lib/rewind/collect.mjs';
import { transcriptPathOf } from '../plugin/hooks/lib/rewind/transcripts.mjs';

const tool = (ws, env, extra = {}) => runHook('post-tool-use', basePayload(ws, { toolCall: { name: 'read_file', args: { Path: 'a.txt' } }, ...extra }), env);
const stop = (ws, env, extra = {}) => runHook('stop', basePayload(ws, { executionNum: 1, terminationReason: 'NO_TOOL_CALL', fullyIdle: true, ...extra }), env);
const record = (ws, env, id = 'conv-test-0001') => JSON.parse(readFileSync(livePath(ws.dir, id, env), 'utf8'));

test('a tool call marks the conversation alive and the end of its turn marks it idle, with or without a lit route', () => {
  const { env } = sandbox();
  const ws = workspace();
  tool(ws, env);
  const file = livePath(ws.dir, 'conv-test-0001', env);
  assert.equal(file, sessionPath(ws.dir, 'conv-test-0001', env).replace(/\.json$/, '.live.json'), 'beside the route state');
  assert.equal(record(ws, env).state, 'alive');
  stop(ws, env);
  assert.equal(record(ws, env).state, 'idle', 'a state change is written at once, inside the throttle window');
  tool(ws, env);
  assert.equal(record(ws, env).state, 'alive');
});

test('a held Stop keeps the conversation alive: the loop goes on', () => {
  const { env } = sandbox();
  const ws = workspace();
  writeFileSync(ws.transcript, `${JSON.stringify({ step_index: 0, type: 'USER_INPUT', content: '<USER_REQUEST>\nlit plan x\n</USER_REQUEST>' })}\n`);
  runHook('pre-invocation', basePayload(ws, { invocationNum: 0 }), env);
  tool(ws, env);
  const r = stop(ws, env);
  assert.equal(r.json.decision, 'continue', 'the lit-plan gate holds this turn');
  assert.equal(record(ws, env).state, 'alive');
});

test('the same state is rewritten at most once per throttle window', () => {
  const { env } = sandbox();
  const ws = workspace();
  tool(ws, env);
  const first = record(ws, env).at;
  tool(ws, env);
  assert.equal(record(ws, env).at, first, 'a second alive inside 30 s writes nothing');
  assert.equal(LIVE_THROTTLE_MS, 30_000);
  const file = livePath(ws.dir, 'conv-test-0001', env);
  writeFileSync(file, JSON.stringify({ ...record(ws, env), at: new Date(Date.now() - LIVE_THROTTLE_MS - 1000).toISOString() }));
  tool(ws, env);
  assert.notEqual(record(ws, env).at, first, 'past the window the record is refreshed');
});

test('ended comes only from staleness: an alive or idle record left alone too long reads ended', () => {
  const { env } = sandbox();
  const ws = workspace();
  tool(ws, env);
  const file = livePath(ws.dir, 'conv-test-0001', env);
  const now = Date.parse(record(ws, env).at);
  assert.equal(readLive(file, now).state, 'alive');
  assert.equal(readLive(file, now + ALIVE_STALE_MS + 1).state, 'ended');
  stop(ws, env);
  const idleAt = Date.parse(record(ws, env).at);
  assert.equal(readLive(file, idleAt + ALIVE_STALE_MS + 1).state, 'idle', 'an idle session waits on its user');
  assert.equal(readLive(file, idleAt + IDLE_STALE_MS + 1).state, 'ended');
  assert.equal(readLive(join(dirname(file), 'nope.live.json'), now), null);
  writeFileSync(file, '{broken');
  assert.equal(readLive(file, now), null, 'a damaged record is no record');
});

test('listLive reads every conversation of the workspace folder, newest first', () => {
  const { env } = sandbox();
  const ws = workspace();
  tool(ws, env);
  tool(ws, env, { conversationId: 'conv-test-0002' });
  stop(ws, env, { conversationId: 'conv-test-0002' });
  const list = listLive(dirname(livePath(ws.dir, 'x', env)), Date.now());
  assert.deepEqual(list.map((l) => [l.id, l.state]).sort(), [['conv-test-0001', 'alive'], ['conv-test-0002', 'idle']]);
});

test('the pane id is kept only when the host passes HERDR_PANE_ID to hooks, and only in a safe shape', () => {
  const { env } = sandbox();
  const ws = workspace();
  tool(ws, { ...env, HERDR_PANE_ID: 'w2B-p3' });
  assert.equal(record(ws, env).pane, 'w2B-p3');
  const other = workspace();
  tool(other, { ...env, HERDR_PANE_ID: 'bad\nline' });
  assert.equal(record(other, env).pane, undefined);
  const none = workspace();
  tool(none, env);
  assert.equal(record(none, env).pane, undefined);
});

test('liveness records are no conversations: SessionStart and the lit-adhd collector skip them', () => {
  const { env } = sandbox();
  const ws = workspace();
  const file = livePath(ws.dir, 'conv-live', env);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ state: 'alive', at: new Date().toISOString() }));
  const start = runHook('session-start', basePayload(ws), env);
  assert.doesNotMatch(start.json.injectSteps[0].systemMessage.systemMessage, /recent lit sessions/);

  const geminiDir = join(env.HOME, '.gemini', 'antigravity-cli');
  const ghost = transcriptPathOf(geminiDir, 'conv-live.live');
  mkdirSync(dirname(ghost), { recursive: true });
  writeFileSync(ghost, `${JSON.stringify({ step_index: 0, type: 'USER_INPUT', created_at: new Date().toISOString(), content: '<USER_REQUEST>\nghost\n</USER_REQUEST>' })}\n`);
  const data = collectRewind({ cwd: ws.dir, env, record: false, exec: () => { throw new Error('no git'); } });
  assert.deepEqual(data.sessions, []);
  assert.ok(existsSync(file));
});
