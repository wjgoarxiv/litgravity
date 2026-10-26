import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderStatus, visibleWidth } from '../plugin/hud/render.mjs';
import { LOOKS, ROUTE_LOOKS, lookOf } from '../plugin/hud/looks.mjs';
import { sandbox, workspace, turn, runHook, basePayload, modelStep, mkdirp } from './helpers.mjs';
import { sessionPath } from '../plugin/hooks/lib/common.mjs';

// The skill looks of the status line, each drawn from the state the real hooks wrote: the look registry, YOUR TURN in
// amber, the five review-work lanes and the one-time DONE mark.

const ID = 'conv-test-0001';
const plain = (line) => line.replace(/\u001b\[[0-9;]*m/g, '');
const AMBER = '38;2;255;176;32';
function line(ws, env, extra = {}, width = 160) {
  return renderStatus({ conversation_id: ID, workspace: ws.dir, ...extra }, { env: { ...env, COLORTERM: 'truecolor' }, now: Date.now(), width });
}
const state = (ws, env) => JSON.parse(readFileSync(sessionPath(ws.dir, ID, env), 'utf8'));
const toolStep = (stepIndex, name, args = {}) => JSON.stringify({ step_index: stepIndex, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'DONE', content: '', tool_calls: [{ name, args }] });
function reply(ws, ...steps) {
  writeFileSync(ws.transcript, `${steps.join('\n')}\n`, { flag: 'a' });
}
const stop = (ws, env) => runHook('stop', basePayload(ws, { terminationReason: 'NO_TOOL_CALL' }), env);

test('look registry: every look has a paint or a label, and the routes map onto known looks', () => {
  for (const [id, look] of Object.entries(LOOKS)) assert.ok(look.paint || look.label || look.segment, id);
  for (const look of Object.values(ROUTE_LOOKS)) assert.ok(LOOKS[look]);
  assert.equal(ROUTE_LOOKS['lit-adhd'], 'rewind');
  assert.equal(ROUTE_LOOKS['review-work'], 'review');
  assert.equal(lookOf({ route: 'lit-adhd' }), 'rewind');
  assert.equal(lookOf({ route: 'lit-adhd', waiting: 'question' }), 'your-turn');
  assert.equal(lookOf({ route: 'start-work', done: true }), 'done');
  assert.equal(lookOf({ route: 'start-work', waiting: 'asked', done: true }), 'your-turn');
  assert.equal(lookOf({ route: 'lit-plan' }), null);
});

test('your turn: a lit turn that ends on ask_question paints the line amber with YOUR TURN, and the next prompt clears it', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit loop add a flag', 1);
  assert.doesNotMatch(plain(line(ws, env)), /YOUR TURN/);
  reply(ws, toolStep(2, 'ask_question', { questions: [{ question: 'Which flag name?' }] }), modelStep(3, 'I asked which flag name to use.'));
  stop(ws, env);
  assert.equal(state(ws, env).waiting.reason, 'question');
  const out = line(ws, env);
  assert.match(plain(out), /YOUR TURN · question/);
  assert.ok(out.includes(AMBER), 'the line takes the amber paint');
  turn(ws, env, '--shout', 4);
  assert.doesNotMatch(plain(line(ws, env)), /YOUR TURN/);
  assert.ok(!line(ws, env).includes(AMBER));
});

test('your turn: a BLOCKED report and a typed approval each wait on the user, a plain report does not', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit loop add a flag', 1);
  reply(ws, modelStep(2, 'BLOCKED: run_command needs permission to run npm test.'));
  stop(ws, env);
  assert.match(plain(line(ws, env)), /YOUR TURN · BLOCKED/);
  turn(ws, env, 'lit start plans/x.md', 3);
  reply(ws, modelStep(4, 'The plan is ready. Type `lit approve` to start row 1.'));
  stop(ws, env);
  assert.match(plain(line(ws, env)), /YOUR TURN · approve/);
  turn(ws, env, 'lit loop next', 5);
  reply(ws, modelStep(6, 'Done: the flag prints in capitals and the test passes.'));
  stop(ws, env);
  assert.doesNotMatch(plain(line(ws, env)), /YOUR TURN/);
});

test('your turn: a turn the Stop hook holds is not waiting on the user', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit plan a tiny todo app', 1);
  reply(ws, modelStep(2, 'Shall I write the plan now?'));
  const r = stop(ws, env);
  assert.equal(r.json?.decision, 'continue');
  assert.doesNotMatch(plain(line(ws, env)), /YOUR TURN/);
});

test('your turn: agy waiting for input, or a goal record that needs a decision, waits on the user too', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit goal ship csv export', 1);
  assert.match(plain(line(ws, env, { agent_state: 'waiting_for_user' })), /YOUR TURN/);
  mkdirp(join(ws.dir, '.litgravity', 'goals'));
  writeFileSync(join(ws.dir, '.litgravity', 'goals', 'csv.json'), JSON.stringify({ status: 'needs_user_decision', conversation_id: ID, criteria: [{ id: 'c1', status: 'open' }] }));
  assert.match(plain(line(ws, env)), /YOUR TURN · decision/);
});

test('review lanes: the five lanes appear once the review folder is written, each its own colour as it reports', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit review work', 1);
  assert.doesNotMatch(plain(line(ws, env)), /goal.*qa.*quality.*security.*context/);
  const dir = mkdirp(join(ws.dir, '.litgravity', 'evidence', 'flag', 'review'));
  writeFileSync(join(dir, 'files.txt'), 'M src/cli.mjs\n');
  let out = plain(line(ws, env));
  assert.match(out, /goal · qa · quality · security · context · 0\/5/);
  writeFileSync(join(dir, 'lane-1-goal.md'), 'verdict: PASS\nconfidence: HIGH\n');
  writeFileSync(join(dir, 'lane-4-security.md'), 'verdict: FAIL\nconfidence: MEDIUM\n');
  const painted = line(ws, env);
  out = plain(painted);
  assert.match(out, /goal ✓ qa · quality · security ✗ context · 2\/5/);
  const colours = new Set([...painted.matchAll(/\u001b\[1;38;2;([0-9;]+)m(?:goal|security)/g)].map((m) => m[1]));
  assert.equal(colours.size, 2, 'two reported lanes, two lane colours');
  assert.match(painted, /\u001b\[38;5;238mqa\u001b/u, 'an unreported lane stays dim');
});

test('review lanes: a review folder from before this route started is not this review', () => {
  const { env } = sandbox();
  const ws = workspace();
  const dir = mkdirp(join(ws.dir, '.litgravity', 'evidence', 'old', 'review'));
  writeFileSync(join(dir, 'lane-1-goal.md'), 'verdict: PASS\n');
  const old = new Date(Date.now() - 3600_000);
  utimesSync(dir, old, old);
  turn(ws, env, 'lit review work', 1);
  assert.doesNotMatch(plain(line(ws, env)), /\d\/5/);
});

test('done: a plan whose last row was just ticked shows DONE once, an older finish or one from before the route does not', () => {
  const { env } = sandbox();
  const ws = workspace();
  mkdirp(join(ws.dir, 'plans'));
  const plan = join(ws.dir, 'plans', 'flag.md');
  writeFileSync(plan, 'Status: approved\n- [x] 1. Add the flag\n- [ ] 2. Test it\n');
  turn(ws, env, 'lit start plans/flag.md', 1);
  assert.doesNotMatch(plain(line(ws, env)), /DONE/);
  writeFileSync(plan, 'Status: approved\n- [x] 1. Add the flag\n- [x] 2. Test it\n');
  const out = line(ws, env);
  assert.match(plain(out), /✦ DONE ✦/);
  const later = new Date(Date.now() - 60_000);
  utimesSync(plan, later, later);
  assert.doesNotMatch(plain(line(ws, env)), /DONE/);
});

test('done: a goal record set to done just now shows DONE', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit goal ship csv export', 1);
  mkdirp(join(ws.dir, '.litgravity', 'goals'));
  writeFileSync(join(ws.dir, '.litgravity', 'goals', 'csv.json'), JSON.stringify({ status: 'done', conversation_id: ID, criteria: [{ id: 'c1', status: 'pass' }] }));
  assert.match(plain(line(ws, env)), /✦ DONE ✦/);
});

test('looks: NO_COLOR keeps the labels with no escape, ASCII mode keeps ASCII, and the line keeps its width', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit review work', 1);
  const dir = mkdirp(join(ws.dir, '.litgravity', 'evidence', 'flag', 'review'));
  writeFileSync(join(dir, 'lane-2-qa.md'), 'verdict: BLOCKED\n');
  const bare = renderStatus({ conversation_id: ID, workspace: ws.dir, agent_state: 'waiting' }, { env: { ...env, NO_COLOR: '1' }, now: Date.now(), width: 160 });
  assert.ok(!bare.includes('\u001b['));
  assert.match(bare, /YOUR TURN/);
  assert.match(bare, /qa ⚠/);
  const ascii = renderStatus({ conversation_id: ID, workspace: ws.dir }, { env: { ...env, NO_COLOR: '1', LITGRAVITY_HUD_ASCII: '1' }, now: Date.now(), width: 160 });
  assert.match(ascii, /^[\x20-\x7e]*$/);
  for (const width of [40, 60, 80, 120]) {
    assert.ok(visibleWidth(line(ws, env, { agent_state: 'waiting' }, width)) <= width, `fits ${width}`);
  }
});

// Every way into review-work selects its look, as every way into lit-adhd does (test/lit-adhd.test.mjs).
const PLUGIN_SKILLS = join(new URL('..', import.meta.url).pathname, 'plugin', 'skills');
const reviewFolder = (ws) => {
  const dir = mkdirp(join(ws.dir, '.litgravity', 'evidence', 'flag', 'review'));
  writeFileSync(join(dir, 'lane-3-quality.md'), 'verdict: PASS\n');
};
for (const prompt of ['lit review work', 'lit review-work', '/review-work', '/litgravity:review-work']) {
  test(`review lanes: \`${prompt}\` selects the review look`, () => {
    const { env } = sandbox();
    const ws = workspace();
    turn(ws, env, prompt, 1);
    reviewFolder(ws);
    assert.match(plain(line(ws, env)), /quality ✓ security · context · 1\/5/);
  });
}

test('review lanes: the model loading the installed review-work skill on its own selects the review look', () => {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'is this branch safe to merge?', 1);
  runHook('post-tool-use', basePayload(ws, { toolCall: { name: 'read_file', args: { Path: join(PLUGIN_SKILLS, 'review-work', 'SKILL.md') } } }), env);
  reviewFolder(ws);
  assert.match(plain(line(ws, env)), /review-work/);
  assert.match(plain(line(ws, env)), /1\/5/);
});
