import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, workspace, runHook, basePayload, turn, injected, PLUGIN, ROOT } from './helpers.mjs';

const FULL = /LIT IGNITED/;
const CONT = /LIT CONTINUES/;

function fresh() {
  const { env } = sandbox();
  const ws = workspace();
  return { env, ws };
}

test('first `lit plan …` of a conversation: full activation with the skill path, the keyword and the planning reminder', () => {
  const { env, ws } = fresh();
  const r = turn(ws, env, 'lit plan a tiny todo app', 0);
  assert.equal(r.status, 0);
  const text = injected(r);
  assert.match(text, FULL);
  assert.match(text, /`lit-plan` route/);
  assert.ok(text.includes(join(PLUGIN, 'skills', 'lit-plan', 'SKILL.md')), 'absolute skill path');
  assert.match(text, /read_file/);
  assert.match(text, /write only under plans\/ or \.litgravity\//);
  assert.match(text, /conv-test-0001/);
  assert.equal(r.json.injectSteps.length, 1);
  assert.equal(typeof r.json.injectSteps[0].ephemeralMessage, 'string');
});

test('only invocation 0 is routed: later model calls of the same turn add nothing', () => {
  const { env, ws } = fresh();
  turn(ws, env, 'lit plan x', 0);
  const r = runHook('pre-invocation', basePayload(ws, { invocationNum: 1 }), env);
  assert.deepEqual(r.json, {});
});

test('a prompt without the keyword changes nothing and a missing transcript is no error', () => {
  const { env, ws } = fresh();
  assert.deepEqual(turn(ws, env, 'What does this function do?', 0).json, {});
  const gone = runHook('pre-invocation', { ...basePayload(ws, { invocationNum: 0 }), transcriptPath: join(ws.dir, 'nope.jsonl') }, env);
  assert.deepEqual(gone.json, {});
  assert.equal(gone.status, 0);
});

test('route state lives outside the workspace, keyed by conversation', () => {
  const { env, ws } = fresh();
  turn(ws, env, 'lit plan x', 0);
  const root = join(env.XDG_STATE_HOME, 'litgravity', 'sessions');
  const dirs = readdirSync(root);
  assert.equal(dirs.length, 1);
  const files = readdirSync(join(root, dirs[0]));
  assert.ok(files.includes('conv-test-0001.json'));
  assert.ok(!existsSync(join(ws.dir, '.litgravity', 'sessions')));
  assert.equal(JSON.parse(readFileSync(join(root, dirs[0], 'conv-test-0001.json'), 'utf8')).route, 'lit-plan');
});

test('D1 continue: the same discipline again, a bare lit and `lit continue` get the short note without a skill re-read', () => {
  const { env, ws } = fresh();
  turn(ws, env, 'lit plan x', 0);
  for (const [i, prompt] of ['lit plan and add tags', 'lit', 'lit continue', 'LIT'].entries()) {
    const text = injected(turn(ws, env, prompt, 10 + i * 10));
    assert.match(text, CONT, prompt);
    assert.match(text, /`lit-plan`/, prompt);
    assert.doesNotMatch(text, FULL, prompt);
    assert.doesNotMatch(text, /read_file|view_file|SKILL\.md/, prompt);
    assert.ok(Buffer.byteLength(text) <= 600, `${prompt}: ${Buffer.byteLength(text)} B`);
  }
});

test('five consecutive lit prompts keep one mode and add at most 600 B after the first', () => {
  const { env, ws } = fresh();
  const sizes = [];
  for (let i = 0; i < 5; i += 1) sizes.push(Buffer.byteLength(injected(turn(ws, env, i === 0 ? 'lit fix the login redirect' : 'lit keep going', i * 10))));
  assert.ok(sizes[0] > 600, 'first activation is the full text');
  for (const s of sizes.slice(1)) assert.ok(s <= 600, `${s} B`);
});

test('D1 switch: an explicit other discipline gets a full activation for the new route', () => {
  const { env, ws } = fresh();
  turn(ws, env, 'lit plan x', 0);
  const text = injected(turn(ws, env, 'lit review plan', 10));
  assert.match(text, FULL);
  assert.match(text, /`review-work` route/);
  assert.match(text, /switched/);
  assert.match(text, /forced the plan review/);
  const again = injected(turn(ws, env, 'lit review', 20));
  assert.match(again, CONT);
});

test('D1 restart: `lit new …` and `lit restart …` start over even when the same route is active', () => {
  const { env, ws } = fresh();
  turn(ws, env, 'lit plan x', 0);
  for (const [i, prompt] of ['lit new plan y', 'lit restart plan z'].entries()) {
    const text = injected(turn(ws, env, prompt, 10 + i * 10));
    assert.match(text, FULL, prompt);
    assert.match(text, /`lit-plan` route/, prompt);
  }
  assert.match(injected(turn(ws, env, 'lit new fix the bug', 40)), /`lit-loop` route/);
});

test('D1 confirm: a bare lit with nothing active and nothing to resume asks one question; a task does not', () => {
  const { env, ws } = fresh();
  const bare = injected(turn(ws, env, 'lit', 0));
  assert.match(bare, FULL);
  assert.match(bare, /ask the user in one line what to run/);
  const task = fresh();
  assert.doesNotMatch(injected(turn(task.ws, task.env, 'lit fix the login redirect', 0)), /ask the user in one line/);
  const empty = fresh();
  assert.match(injected(turn(empty.ws, empty.env, 'lit new', 0)), /ask the user in one line what to run/);
});

test('D1 start-work is always a full activation, and a bare lit resumes a started plan from a new conversation', () => {
  const { env, ws } = fresh();
  mkdirSync(join(ws.dir, 'plans'));
  writeFileSync(join(ws.dir, 'plans', 'todo.md'), '> Status: approved\n\n- [x] 1. scaffold\n- [ ] 2. add tags\n');
  assert.match(injected(turn(ws, env, 'lit start plans/todo.md', 0)), /`start-work` route/);
  const second = injected(turn(ws, env, 'lit start plans/todo.md', 10));
  assert.match(second, FULL, 'start-work never gets the short note');
  assert.match(injected(turn(ws, env, 'lit', 20)), CONT);

  // a different conversation in the same workspace: nothing active there, but a plan was started
  const other = runHook('pre-invocation', basePayload(ws, { conversationId: 'conv-test-0002', invocationNum: 0 }), env);
  const text = injected(other);
  assert.match(text, /resuming `start-work` on plans\/todo\.md, next open row 2/);
  assert.match(text, CONT);
  assert.ok(Buffer.byteLength(text) <= 700, `${Buffer.byteLength(text)} B`);
});

test('a plan nobody started with start-work is not resumed by a bare lit', () => {
  const { env, ws } = fresh();
  mkdirSync(join(ws.dir, 'plans'));
  writeFileSync(join(ws.dir, 'plans', 'todo.md'), '- [ ] 1. scaffold\n');
  const text = injected(turn(ws, env, 'lit', 0));
  assert.match(text, FULL);
  assert.match(text, /ask the user in one line/);
});

test('a prompt without the keyword ends the route, so the next lit starts a full activation', () => {
  const { env, ws } = fresh();
  turn(ws, env, 'lit plan x', 0);
  assert.deepEqual(turn(ws, env, 'thanks', 10).json, {});
  assert.match(injected(turn(ws, env, 'lit plan again', 20)), FULL);
});

test('the same user turn seen twice repeats the same answer and does not downgrade the full activation', () => {
  const { env, ws } = fresh();
  const first = injected(turn(ws, env, 'lit plan x', 0));
  const again = runHook('pre-invocation', basePayload(ws, { invocationNum: 0 }), env);
  assert.equal(injected(again), first);
});

test('unreadable route state falls back to the full activation', () => {
  const { env, ws } = fresh();
  turn(ws, env, 'lit plan x', 0);
  const root = join(env.XDG_STATE_HOME, 'litgravity', 'sessions');
  const dir = join(root, readdirSync(root)[0]);
  writeFileSync(join(dir, 'conv-test-0001.json'), '{not json');
  assert.match(injected(turn(ws, env, 'lit plan x', 10)), FULL);
});

test('the router reads a transcript file in the shape agy writes (static fixtures)', () => {
  const { env } = fresh();
  const ws = workspace();
  const a = runHook('pre-invocation', {
    conversationId: 'conv-fixture-1', invocationNum: 0, workspacePaths: [ws.dir],
    transcriptPath: join(ROOT, 'test', 'fixtures', 'transcripts', 'lit-plan-first-turn.jsonl'),
  }, env);
  assert.match(injected(a), /`lit-plan` route/);
  const b = runHook('pre-invocation', {
    conversationId: 'conv-fixture-2', invocationNum: 0, workspacePaths: [ws.dir],
    transcriptPath: join(ROOT, 'test', 'fixtures', 'transcripts', 'two-turns-second-is-plain.jsonl'),
  }, env);
  assert.deepEqual(b.json, {}, 'the newest USER_INPUT decides, not the first');
});

test('every hook script answers with one JSON object and exit 0 on garbage input', () => {
  const { env } = fresh();
  for (const name of ['session-start', 'pre-invocation', 'stop', 'pre-tool-use', 'post-tool-use']) {
    const r = runHook(name, { toolCall: 'oops', workspacePaths: 7, conversationId: ['x'] }, env);
    assert.equal(r.status, 0, name);
    assert.equal(typeof r.json, 'object', name);
  }
});

test('SessionStart injects a persistent system message with the version and every route, under the size budget', () => {
  const { env, ws } = fresh();
  const r = runHook('session-start', basePayload(ws), env);
  const msg = r.json.injectSteps[0].systemMessage.systemMessage;
  assert.match(msg, /LitGravity 0\.1\.0 is active/);
  assert.match(msg, /- lit-plan: /);
  assert.match(msg, /- lit-brainstorm: /);
  assert.ok(Buffer.byteLength(msg) < 12 * 1024);
});

test('SessionStart points at a fresh handoff note and nothing else', () => {
  const { env, ws } = fresh();
  assert.doesNotMatch(runHook('session-start', basePayload(ws), env).json.injectSteps[0].systemMessage.systemMessage, /handoff note/);
  mkdirSync(join(ws.dir, '.litgravity', 'handoff'), { recursive: true });
  writeFileSync(join(ws.dir, '.litgravity', 'handoff', 'latest.md'), '# handoff\n');
  assert.match(runHook('session-start', basePayload(ws), env).json.injectSteps[0].systemMessage.systemMessage, /\.litgravity\/handoff\/latest\.md/);
});

test('LITGRAVITY_HOOK_TRACE writes one line per hook call and stays silent without the variable', () => {
  const { env, ws } = fresh();
  const file = join(ws.dir, 'trace.jsonl');
  turn(ws, { ...env, LITGRAVITY_HOOK_TRACE: file }, 'lit plan x', 0);
  runHook('post-invocation', basePayload(ws, { invocationNum: 0 }), { ...env, LITGRAVITY_HOOK_TRACE: file });
  const lines = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.hook), ['pre-invocation', 'post-invocation']);
  assert.equal(lines[0].conversationId, 'conv-test-0001');
  assert.deepEqual(lines[0].answered, ['injectSteps']);
  assert.equal(lines[0].marker, 'LIT IGNITED · lit-plan');
  turn(ws, { ...env, LITGRAVITY_HOOK_TRACE: file }, 'lit', 5);
  assert.equal(readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).pop().marker, 'LIT CONTINUES · lit-plan');
  const quiet = fresh();
  turn(quiet.ws, quiet.env, 'lit plan x', 0);
  assert.ok(!existsSync(join(quiet.ws.dir, 'trace.jsonl')));
});

test('every full activation tells the model to read first and what a headless refusal costs; a continue note stays short', () => {
  const { env, ws } = fresh();
  const full = injected(turn(ws, env, 'lit brainstorm names for a todo app', 0));
  assert.match(full, /Read first: use read_file/);
  assert.match(full, /headless `agy -p` run cannot prompt for permission/);
  const note = injected(turn(ws, env, 'lit brainstorm more names', 10));
  assert.match(note, /LIT CONTINUES/);
  assert.doesNotMatch(note, /Read first/);
});
