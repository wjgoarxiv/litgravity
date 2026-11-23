import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sandbox, workspace, turn, injected, PLUGIN } from './helpers.mjs';
import {
  compileLoopCondition, normalizeGoalObjective, detectCheck, falsifyLoop, proposeLoopGoal, offerLoopGoal, answerConsent,
  cancelOwnedGoal, sweepGoal, advisoryCheck, readGoalRecord, writeGoalRecord, conditionHash, STATUS,
  LOOP_OWNER_MAX_AGE_MS, GOAL_MAX_CHARS,
} from '../plugin/hooks/lib/goal.mjs';
import { GOAL_NEVER, LOOP_GOAL_ROUTES, SKILL_IDS } from '../plugin/hooks/lib/routes.mjs';
import { readStack } from '../plugin/hooks/lib/workflow-stack.mjs';

const exit = (status) => () => ({ status, signal: null, error: null });
const SCRIPT = join(PLUGIN, 'skills', 'lit-plan', 'scripts', 'goal-propose.mjs');

// A workspace with an npm test command (never run by the hook) unless `scripts` is null.
function project(scripts = { test: 'node --test' }) {
  const ws = workspace();
  mkdirSync(ws.dir, { recursive: true });
  if (scripts) writeFileSync(join(ws.dir, 'package.json'), JSON.stringify({ name: 'p', scripts }));
  return ws;
}

test('the loop condition is the check exiting 0 plus the objective, with a stable id', () => {
  const built = compileLoopCondition({ objective: 'fix the parser', check: 'npm test' });
  assert.match(built.condition, /^`npm test` exits 0 and this is done: fix the parser \[lit:[0-9a-f]{8}\]$/);
  assert.equal(compileLoopCondition({ objective: 'fix the parser', check: 'npm test' }).condition, built.condition);
  assert.notEqual(compileLoopCondition({ objective: 'fix the lexer', check: 'npm test' }).id, built.id);
  assert.equal(compileLoopCondition({ objective: 'x'.repeat(GOAL_MAX_CHARS), check: 'npm test' }).ok, false);
  assert.equal(STATUS.askLoop(built.condition), `Set goal for this lit-loop: /goal ${built.condition}? (yes / no)`);
});

test('the objective loses slash lines and credentials, collapses to one line and is capped', () => {
  assert.equal(normalizeGoalObjective('fix it\n/goal evil\n  then ship'), 'fix it then ship');
  assert.match(normalizeGoalObjective('use OPENAI_API_KEY=abc123xyz now'), /\[redacted\]/);
  assert.doesNotMatch(normalizeGoalObjective('use OPENAI_API_KEY=abc123xyz now'), /abc123xyz/);
  assert.ok(normalizeGoalObjective('word '.repeat(200)).length <= 180);
  assert.equal(normalizeGoalObjective(undefined), '');
});

test('the project test command comes from package.json, pytest, cargo or go; nothing else counts', () => {
  const at = (files) => { const ws = workspace(); mkdirSync(ws.dir, { recursive: true }); for (const [n, c] of Object.entries(files)) writeFileSync(join(ws.dir, n), c); return ws.dir; };
  assert.equal(detectCheck(at({ 'package.json': '{"scripts":{"test":"node --test"}}' })), 'npm test');
  assert.equal(detectCheck(at({ 'package.json': '{"scripts":{"build":"x"}}' })), null);
  assert.equal(detectCheck(at({ 'package.json': 'not json' })), null);
  assert.equal(detectCheck(at({ 'pytest.ini': '' })), 'pytest');
  assert.equal(detectCheck(at({ 'pyproject.toml': '' })), 'pytest');
  assert.equal(detectCheck(at({ 'Cargo.toml': '' })), 'cargo test');
  assert.equal(detectCheck(at({ 'go.mod': '' })), 'go test ./...');
  assert.equal(detectCheck(at({})), null);
});

test('the loop dry run needs the check to fail now: passing, hanging and unrunnable checks set no goal', () => {
  const base = { cwd: '/tmp', check: 'npm test' };
  assert.equal(falsifyLoop({ ...base, run: exit(1) }).ok, true);
  assert.match(falsifyLoop({ ...base, run: exit(0) }).reason, /already passes/);
  assert.match(falsifyLoop({ ...base, run: () => ({ error: { code: 'ETIMEDOUT' } }) }).reason, /did not finish/);
  assert.match(falsifyLoop({ ...base, run: () => ({ error: { code: 'ENOENT' } }) }).reason, /cannot run/);
  assert.match(falsifyLoop({ ...base, run: exit(127) }).reason, /cannot run/);
});

test('proposeLoopGoal records a loop consent with no plan, and records nothing when it refuses', () => {
  const ws = project();
  const ok = proposeLoopGoal({ workspace: ws.dir, check: 'npm test', objective: 'fix the parser', run: exit(1) });
  assert.equal(ok.ok, true);
  assert.equal(ok.line, STATUS.askLoop(ok.condition));
  const rec = readGoalRecord(ws.dir, 'consent');
  assert.equal(rec.kind, 'loop');
  assert.equal(rec.plan, null);
  assert.equal(rec.condition, ok.condition);
  assert.equal(rec.hash, conditionHash(ok.condition));
  const refuse = (opts, re) => {
    const w = project();
    const r = proposeLoopGoal({ workspace: w.dir, run: exit(1), ...opts });
    assert.equal(r.ok, false);
    assert.match(r.line, re);
    assert.equal(readGoalRecord(w.dir, 'consent'), null, 'nothing recorded');
  };
  refuse({ check: 'npm test', objective: 'x', run: exit(0) }, /^Goal skipped: `npm test` already passes/);
  refuse({ check: 'npm test', objective: 'x', run: () => ({ error: { code: 'ENOENT' } }) }, /cannot run here/);
  refuse({ check: 'rm -rf build', objective: 'x' }, /not an allowlisted test command/);
  refuse({ check: 'npm test works', objective: 'x' }, /judgment/);
  refuse({ check: 'npm test', objective: '   ' }, /name what the loop should finish/);
  refuse({ check: 'npm test', objective: 'x', route: 'litgoal' }, /sets no goal of its own/);
  refuse({ check: 'npm test', objective: 'x', route: 'review-work' }, /sets no goal of its own/);
  const owned = project();
  writeGoalRecord(owned.dir, 'owner', { condition: 'c', hash: conditionHash('c'), plan: null, armedAt: new Date().toISOString() });
  assert.match(proposeLoopGoal({ workspace: owned.dir, check: 'npm test', objective: 'x', run: exit(1) }).line, /a goal is already active/);
});

test('the hook offer skips the dry run, and sees a pending or owned goal', () => {
  const ws = project();
  const never = () => { throw new Error('the hook must not run the check'); };
  assert.equal(proposeLoopGoal({ workspace: ws.dir, check: 'npm test', objective: 'fix', falsifyNow: false, run: never }).ok, true);
  const a = project();
  assert.match(offerLoopGoal(a.dir, { route: 'lit-loop', objective: 'fix the parser' }).line, /^Set goal for this lit-loop: \/goal `npm test` exits 0 and this is done: fix the parser \[lit:[0-9a-f]{8}\]\? \(yes \/ no\)$/);
  assert.equal(offerLoopGoal(a.dir, { route: 'lit-loop', objective: 'fix more' }), null, 'a pending question is not asked twice');
  const b = project(null);
  assert.equal(offerLoopGoal(b.dir, { route: 'lit-loop', objective: 'fix' }), null, 'no test command, no offer');
  const c = project();
  assert.equal(offerLoopGoal(c.dir, { route: 'lit-loop', objective: '' }), null);
  assert.equal(offerLoopGoal(c.dir, { route: 'litgoal', objective: 'fix' }), null);
  assert.equal(offerLoopGoal(c.dir, { route: 'lit-plan', objective: 'fix' }), null);
  writeGoalRecord(c.dir, 'owner', { condition: 'c', hash: conditionHash('c'), plan: null, armedAt: new Date().toISOString() });
  assert.equal(offerLoopGoal(c.dir, { route: 'lit-loop', objective: 'fix' }), null, 'an owned goal is never replaced');
});

test('PreInvocation: the first lit-loop activation records the question and tells the model to show it, advisory', () => {
  const { env } = sandbox();
  const ws = project();
  const text = injected(turn(ws, env, 'lit fix the parser bug', 0));
  assert.match(text, /LIT IGNITED · lit-loop/);
  const rec = readGoalRecord(ws.dir, 'consent');
  assert.equal(rec.kind, 'loop');
  assert.equal(rec.route, 'lit-loop');
  assert.equal(rec.plan, null);
  assert.match(rec.condition, /^`npm test` exits 0 and this is done: fix the parser bug \[lit:[0-9a-f]{8}\]$/);
  assert.ok(text.includes(`end your first reply with this exact line`), text);
  assert.ok(text.includes(`Set goal for this lit-loop: /goal ${rec.condition}? (yes / no)`));
  assert.match(text, /advisory/);
  assert.match(text, /Never type or send \/goal yourself/);
  assert.match(text, /do not ask the question again/);
  assert.doesNotMatch(text, /goal-propose/, 'the offered path needs no script');
  assert.equal(readGoalRecord(ws.dir, 'owner'), null, 'nothing is armed before the yes');
});

test('PreInvocation: a repeated call for the same turn repeats the question and spends nothing', () => {
  const { env } = sandbox();
  const ws = project();
  const first = injected(turn(ws, env, 'lit fix the parser bug', 0));
  const again = injected(turn(ws, env, 'lit fix the parser bug', 0));
  const line = /Set goal for this lit-loop: .*\(yes \/ no\)/.exec(first)[0];
  assert.ok(again.includes(line), 'the repeat carries the same question');
  assert.ok(readGoalRecord(ws.dir, 'consent'), 'the asking turn does not drop its own question');
});

test('PreInvocation: litwork and lit-hijack ask too; litgoal, lit-plan, a bare lit and a continue do not', () => {
  const { env } = sandbox();
  for (const [prompt, route] of [['lit work fix the parser', 'litwork'], ['lit hijack port the ranker', 'lit-hijack']]) {
    const ws = project();
    const text = injected(turn(ws, env, prompt, 0));
    assert.match(text, /Set goal for this lit-loop: \/goal /, route);
    assert.equal(readGoalRecord(ws.dir, 'consent').route, route);
  }
  for (const prompt of ['lit goal ship the parser fix', 'lit plan the parser fix', 'lit', 'lit review the diff', 'lit brainstorm names']) {
    const ws = project();
    const text = injected(turn(ws, env, prompt, 0));
    assert.doesNotMatch(text, /Set goal for this lit-loop|goal-propose/, prompt);
    assert.equal(readGoalRecord(ws.dir, 'consent'), null, prompt);
  }
  const ws = project();
  injected(turn(ws, env, 'lit fix the parser bug', 0));
  const next = injected(turn(ws, env, 'lit also fix the lexer', 2));
  assert.match(next, /already active/);
  assert.doesNotMatch(next, /Set goal for this lit-loop|goal-propose/, 'a continue asks nothing');
});

test('PreInvocation: a request that ends with lit, lit-loop or litwork asks the goal question with the words before it', () => {
  const { env } = sandbox();
  for (const [prompt, route, objective] of [
    ['fix the parser bug lit', 'lit-loop', 'fix the parser bug'],
    ['로그인 버튼 고쳐줘. 부탁해 lit', 'lit-loop', '로그인 버튼 고쳐줘. 부탁해'],
    ['로그인 버튼 고쳐줘 lit-loop', 'lit-loop', '로그인 버튼 고쳐줘'],
    ['fix the parser litwork', 'litwork', 'fix the parser'],
  ]) {
    const ws = project();
    const text = injected(turn(ws, env, prompt, 0));
    assert.ok(text.includes(`runs the \`${route}\` route`), prompt);
    assert.match(text, /Set goal for this lit-loop: \/goal /, prompt);
    const rec = readGoalRecord(ws.dir, 'consent');
    assert.equal(rec.route, route, prompt);
    assert.equal(rec.objective, objective, prompt);
  }
  for (const prompt of ['lit', 'lit continue', 'what does lit-loop do?']) {
    const ws = project();
    assert.doesNotMatch(injected(turn(ws, env, prompt, 0)), /Set goal for this lit-loop/, prompt);
    assert.equal(readGoalRecord(ws.dir, 'consent'), null, prompt);
  }
});

test('PreInvocation: a run skill typed first (lit-loop, litwork, lit-hijack) carries its task and asks the goal question', () => {
  const { env } = sandbox();
  for (const [prompt, route, objective] of [
    ['lit-loop fix the parser bug', 'lit-loop', 'fix the parser bug'],
    ['/lit-loop 로그인 버튼 고쳐줘', 'lit-loop', '로그인 버튼 고쳐줘'],
    ['litwork fix the parser', 'litwork', 'fix the parser'],
    ['lit-hijack port the ranker', 'lit-hijack', 'port the ranker'],
  ]) {
    const ws = project();
    const text = injected(turn(ws, env, prompt, 0));
    assert.ok(text.includes(`runs the \`${route}\` route`), prompt);
    assert.match(text, /Set goal for this lit-loop: \/goal /, prompt);
    const rec = readGoalRecord(ws.dir, 'consent');
    assert.equal(rec.route, route, prompt);
    assert.equal(rec.objective, objective, prompt);
  }
  for (const prompt of ['lit-loop', 'lit-plan fix the parser', 'litgoal ship it']) {
    const ws = project();
    assert.doesNotMatch(injected(turn(ws, env, prompt, 0)), /Set goal for this lit-loop/, prompt);
    assert.equal(readGoalRecord(ws.dir, 'consent'), null, prompt);
  }
});

test('PreInvocation: with a goal pending or owned the question is not asked again', () => {
  const { env } = sandbox();
  const pending = project();
  injected(turn(pending, env, 'lit fix the parser bug', 0));
  const switched = injected(turn(pending, env, 'lit work fix the lexer', 2));
  assert.match(switched, /LIT IGNITED · litwork/);
  const second = readGoalRecord(pending.dir, 'consent');
  assert.equal(second.route, 'litwork', 'the other prompt dropped the first question and asked its own');
  assert.match(second.condition, /fix the lexer/);
  const owned = project();
  writeGoalRecord(owned.dir, 'owner', { condition: 'c', hash: conditionHash('c'), plan: null, armedAt: new Date().toISOString() });
  const text = injected(turn(owned, env, 'lit fix the parser bug', 0));
  assert.doesNotMatch(text, /Set goal for this lit-loop/);
  assert.equal(readGoalRecord(owned.dir, 'consent'), null);
});

test('PreInvocation: no test command points the model at goal-propose --loop after a RED check', () => {
  const { env } = sandbox();
  const ws = project(null);
  const text = injected(turn(ws, env, 'lit fix the parser bug', 0));
  assert.match(text, /LIT IGNITED · lit-loop/);
  assert.ok(text.includes(`node ${SCRIPT} --loop --check "<check>" <objective>`), text);
  assert.match(text, /after the RED test/);
  assert.match(text, /Goal skipped: <reason>\./);
  assert.match(text, /Never type or send \/goal yourself/);
  assert.equal(readGoalRecord(ws.dir, 'consent'), null, 'the fallback records nothing by itself');
  for (const prompt of ['lit goal ship it', 'lit plan it']) {
    assert.doesNotMatch(injected(turn(project(null), env, prompt, 0)), /--loop --check/, prompt);
  }
});

test('PreInvocation: an exact yes arms the goal, starts no start-work and leaves the run going', () => {
  const { env } = sandbox();
  for (const word of ['yes', ' YES ', 'Yes']) {
    const ws = project();
    injected(turn(ws, env, 'lit fix the parser bug', 0));
    const asked = readGoalRecord(ws.dir, 'consent');
    const text = injected(turn(ws, env, word, 2));
    assert.match(text, /LitGravity goal: tell the user this line once, verbatim/);
    assert.ok(text.includes(STATUS.set(asked.condition)), 'the paste line for agy');
    assert.doesNotMatch(text, /LIT IGNITED/);
    assert.match(text, /start no start-work run/);
    const owner = readGoalRecord(ws.dir, 'owner');
    assert.equal(owner.kind, 'loop');
    assert.equal(owner.condition, asked.condition);
    assert.equal(owner.plan, null);
    assert.equal(readGoalRecord(ws.dir, 'consent'), null, 'the question is used up');
    assert.ok(!readStack(ws.dir, 'conv-test-0001', env).frames.some((f) => f.skill === 'start-work'), 'no start-work frame');
  }
});

test('PreInvocation: no, edit, other text and an old question arm nothing', () => {
  const { env } = sandbox();
  const asked = (prompt) => { const ws = project(); injected(turn(ws, env, 'lit fix the parser bug', 0)); return { ws, text: injected(turn(ws, env, prompt, 2)) }; };
  const no = asked('no');
  assert.match(no.text, /Goal skipped: you answered no\./);
  assert.equal(readGoalRecord(no.ws.dir, 'owner'), null);
  assert.equal(readGoalRecord(no.ws.dir, 'consent'), null);
  for (const prompt of ['edit', 'yes please', 'run the tests']) {
    const r = asked(prompt);
    assert.equal(readGoalRecord(r.ws.dir, 'owner'), null, prompt);
    assert.equal(readGoalRecord(r.ws.dir, 'consent'), null, `${prompt} drops the question`);
    assert.doesNotMatch(r.text, /Goal armed|LitGravity goal:/, prompt);
  }
  const old = project();
  proposeLoopGoal({ workspace: old.dir, check: 'npm test', objective: 'x', falsifyNow: false, now: Date.now() - 31 * 60_000 });
  assert.equal(answerConsent(old.dir, 'yes', 'c1', Date.now(), { turnId: 4 }), null, 'an expired question arms nothing');
  assert.equal(readGoalRecord(old.dir, 'owner'), null);
  const tampered = project();
  proposeLoopGoal({ workspace: tampered.dir, check: 'npm test', objective: 'x', falsifyNow: false });
  writeGoalRecord(tampered.dir, 'consent', { ...readGoalRecord(tampered.dir, 'consent'), condition: '`npm test` exits 0' });
  assert.equal(answerConsent(tampered.dir, 'yes', 'c1', Date.now(), { turnId: 4 }), null, 'the hash binds the answer to the asked condition');
  assert.equal(readGoalRecord(tampered.dir, 'owner'), null);
  const other = project();
  proposeLoopGoal({ workspace: other.dir, check: 'npm test', objective: 'x', falsifyNow: false });
  writeGoalRecord(other.dir, 'owner', { condition: 'other', hash: conditionHash('other'), plan: null, armedAt: new Date().toISOString() });
  assert.match(answerConsent(other.dir, 'yes', 'c1', Date.now(), { turnId: 4 }).line, /^A goal is already active/);
});

test('a loop goal ends by lit cancel or age, never by a plan, and the turn-end check leaves it alone', () => {
  const ws = project();
  proposeLoopGoal({ workspace: ws.dir, check: 'npm test', objective: 'x', falsifyNow: false });
  answerConsent(ws.dir, 'yes', 'c1', Date.now(), { turnId: 4 });
  assert.equal(sweepGoal(ws.dir), null, 'no plan to go missing');
  assert.equal(advisoryCheck(ws.dir, { run: exit(0) }), null, 'the objective half is not machine-checkable');
  assert.match(sweepGoal(ws.dir, Date.now() + LOOP_OWNER_MAX_AGE_MS + 60_000), /^Goal record dropped/);
  assert.equal(readGoalRecord(ws.dir, 'owner'), null);
  proposeLoopGoal({ workspace: ws.dir, check: 'npm test', objective: 'x', falsifyNow: false });
  answerConsent(ws.dir, 'yes', 'c1', Date.now(), { turnId: 4 });
  assert.match(cancelOwnedGoal(ws.dir), /^Goal cleared by lit cancel: `npm test` exits 0/);
});

test('goal-propose --loop prints the question for a failing check and refuses a passing one', () => {
  const ws = project(null);
  mkdirSync(join(ws.dir, 'test'), { recursive: true });
  writeFileSync(join(ws.dir, 'test', 'red.test.mjs'), "import test from 'node:test'; import assert from 'node:assert'; test('red', () => assert.equal(1, 2));\n");
  writeFileSync(join(ws.dir, 'test', 'green.test.mjs'), "import test from 'node:test'; test('green', () => {});\n");
  // The check is a nested `node --test`; under this runner NODE_TEST_CONTEXT would make it report to the parent.
  const { NODE_TEST_CONTEXT, ...cleanEnv } = process.env;
  const go = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: ws.dir, encoding: 'utf8', env: cleanEnv });
  const green = go('--loop', '--check', 'node --test test/green.test.mjs', 'fix', 'the', 'parser');
  assert.equal(green.status, 0);
  assert.match(green.stdout, /^Goal skipped: `node --test test\/green\.test\.mjs` already passes/);
  assert.equal(existsSync(join(ws.dir, '.litgravity', 'goal', 'consent.json')), false, 'a refusal records nothing');
  const unlisted = go('--loop', '--check', 'rm -rf build', 'fix');
  assert.match(unlisted.stdout, /^Goal skipped: .*not an allowlisted test command/);
  const red = go('--loop', '--check', 'node --test test/red.test.mjs', 'fix', 'the', 'parser');
  assert.equal(red.status, 0);
  assert.match(red.stdout, /^Set goal for this lit-loop: \/goal `node --test test\/red\.test\.mjs` exits 0 and this is done: fix the parser \[lit:[0-9a-f]{8}\]\? \(yes \/ no\)\n\n> \*\*▶ Answer: set goal for this lit-loop\*\*\n/u);
  const rec = readGoalRecord(ws.dir, 'consent');
  assert.equal(rec.kind, 'loop');
  assert.equal(rec.plan, null);
  assert.equal(go('--loop', '--check', 'npm test').status, 64, 'an objective is required');
  assert.equal(go('--loop', 'npm test', 'fix').status, 64);
  assert.equal(JSON.parse(go('--loop', '--check', 'node --test test/red.test.mjs', 'fix', '--json').stdout).ok, true);
});

test('only run routes may ask: the loop routes are skills, none of them is read-only, and litgoal is not one', () => {
  for (const id of LOOP_GOAL_ROUTES) {
    assert.ok(SKILL_IDS.has(id), id);
    assert.ok(!GOAL_NEVER.has(id), id);
  }
  assert.ok(!LOOP_GOAL_ROUTES.has('litgoal'));
  assert.ok(!LOOP_GOAL_ROUTES.has('lit-plan'));
});

// A loop goal has no plan to finish, so a new run replaces it when it is plainly another run: another objective, or
// another conversation. A plan's goal, and the same loop asked again, keep blocking.
function armLoop(ws, objective, conversationId) {
  proposeLoopGoal({ workspace: ws.dir, check: 'npm test', objective, falsifyNow: false });
  assert.ok(answerConsent(ws.dir, 'yes', conversationId, Date.now(), { turnId: 4 }).loop);
  return readGoalRecord(ws.dir, 'owner');
}

test('a finished loop goal does not block the next question: another objective or another conversation replaces it', () => {
  const ws = project();
  const first = armLoop(ws, 'fix the parser', 'conv-old');
  assert.equal(offerLoopGoal(ws.dir, { route: 'lit-loop', objective: 'fix the parser', conversationId: 'conv-old' }), null, 'the same loop in the same conversation is not asked twice');
  assert.equal(readGoalRecord(ws.dir, 'owner').hash, first.hash, 'and its record stays');
  const other = offerLoopGoal(ws.dir, { route: 'lit-loop', objective: 'fix the lexer', conversationId: 'conv-old' });
  assert.match(other.line, /fix the lexer/, 'another objective asks again');
  assert.equal(readGoalRecord(ws.dir, 'owner'), null, 'the stale owner is dropped');
  assert.match(readGoalRecord(ws.dir, 'consent').condition, /fix the lexer/);
  const next = project();
  armLoop(next, 'fix the parser', 'conv-old');
  assert.ok(offerLoopGoal(next.dir, { route: 'lit-loop', objective: 'fix the parser', conversationId: 'conv-new' }), 'a new conversation asks again');
  assert.equal(readGoalRecord(next.dir, 'owner'), null);
});

test('a plan goal and an unknown owner still block a loop question; the script with no conversation goes by objective', () => {
  const ws = project();
  writeGoalRecord(ws.dir, 'owner', { condition: 'c', hash: conditionHash('c'), plan: 'plans/p.md', check: 'npm test', armedAt: new Date().toISOString() });
  assert.equal(offerLoopGoal(ws.dir, { route: 'lit-loop', objective: 'fix', conversationId: 'conv-new' }), null);
  assert.match(proposeLoopGoal({ workspace: ws.dir, check: 'npm test', objective: 'fix', run: exit(1) }).line, /a goal is already active/);
  const loop = project();
  armLoop(loop, 'fix the parser', 'conv-old');
  assert.match(proposeLoopGoal({ workspace: loop.dir, check: 'npm test', objective: 'fix the parser', run: exit(1) }).line, /a goal is already active/, 'same objective, no conversation named');
  const fresh = proposeLoopGoal({ workspace: loop.dir, check: 'npm test', objective: 'fix the lexer', run: exit(1) });
  assert.equal(fresh.ok, true, 'another objective replaces it');
  assert.equal(readGoalRecord(loop.dir, 'owner'), null);
});

test('PreInvocation: after a yes, a later conversation with another objective is asked again', () => {
  const { env } = sandbox();
  const ws = project();
  injected(turn(ws, env, 'lit fix the parser bug', 0));
  injected(turn(ws, env, 'yes', 2));
  assert.equal(readGoalRecord(ws.dir, 'owner').kind, 'loop');
  const text = injected(turn(ws, env, 'lit new fix the lexer bug', 4));
  assert.match(text, /Set goal for this lit-loop: \/goal .*fix the lexer bug/);
  assert.equal(readGoalRecord(ws.dir, 'owner'), null);
  assert.match(readGoalRecord(ws.dir, 'consent').condition, /fix the lexer bug/);
});
