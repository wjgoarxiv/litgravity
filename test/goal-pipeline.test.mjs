import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sandbox, workspace, turn, injected, runHook, basePayload, writeTranscript, userStep, modelStep, PLUGIN } from './helpers.mjs';
import {
  parseDoneWhen, compileCondition, lintCondition, falsify, consentAnswer, proposeGoal, answerConsent, advisoryCheck,
  cancelOwnedGoal, sweepGoal, readGoalRecord, writeGoalRecord, conditionHash, GOAL_MAX_CHARS, STATUS,
} from '../plugin/hooks/lib/goal.mjs';
import { GOAL_NEVER, SKILL_IDS } from '../plugin/hooks/lib/routes.mjs';
import { READ_ONLY_DISCIPLINES, readStack } from '../plugin/hooks/lib/workflow-stack.mjs';

const PLAN = (rows, check = 'node --test test/a.test.mjs') => `# Plan\n\ngoal: native\n\n## Todos\n${rows}\n\n## Done when\n- check: \`${check}\`\n`;
const exit = (status) => () => ({ status, signal: null, error: null });

function project(planText) {
  const ws = workspace();
  mkdirSync(join(ws.dir, 'plans'), { recursive: true });
  writeFileSync(join(ws.dir, 'plans', 'p.md'), planText);
  return ws;
}

test('the compiler builds the fixed condition from the Done when block, and names what is missing', () => {
  assert.deepEqual(parseDoneWhen(PLAN('- [ ] 1. x')), { ok: true, check: 'node --test test/a.test.mjs' });
  assert.equal(parseDoneWhen('# Plan\n').ok, false);
  assert.match(parseDoneWhen('## Done when\nsoon\n').reason, /names no `check:`/);
  const built = compileCondition({ plan: 'plans/p.md', check: 'npm test' });
  assert.match(built.condition, /^Every row in plans\/p\.md is ticked and `npm test` exits 0 \[lit:[0-9a-f]{8}\], or the latest reply starts with WAITING-ON-USER:, or after 30 turns$/);
  assert.equal(compileCondition({ plan: 'plans/p.md', check: 'npm test' }).condition, built.condition, 'deterministic');
  assert.equal(compileCondition({ plan: 'plans/p.md', check: `node ${'x'.repeat(GOAL_MAX_CHARS)}.mjs` }).ok, false);
});

test('lint rejects judgment words, publish-only success and unlisted commands', () => {
  assert.equal(lintCondition('c', 'npm test').ok, true);
  assert.equal(lintCondition('c', 'bash scripts/check-done.sh').ok, true);
  assert.match(lintCondition('c', 'npm test works').reasons.join(), /judgment/);
  assert.match(lintCondition('c', '잘 동작하면 끝').reasons.join(), /judgment/);
  assert.match(lintCondition('c', 'npm publish').reasons.join(), /publish/);
  assert.match(lintCondition('c', 'git push origin main').reasons.join(), /push/);
  assert.match(lintCondition('c', 'rm -rf build').reasons.join(), /allowlisted/);
  assert.match(lintCondition('x'.repeat(GOAL_MAX_CHARS + 1), 'npm test').reasons.join(), /over 500/);
});

test('the falsifier needs the condition false today: already-true, hanging and unrunnable checks set no goal', () => {
  const base = { cwd: '/tmp', plan: 'plans/p.md', check: 'npm test' };
  assert.equal(falsify({ ...base, planText: PLAN('- [ ] 1. x'), run: exit(0) }).ok, true, 'open rows make it false');
  assert.equal(falsify({ ...base, planText: PLAN('- [x] 1. x'), run: exit(1) }).ok, true, 'a failing check makes it false');
  assert.match(falsify({ ...base, planText: PLAN('- [x] 1. x'), run: exit(0) }).reason, /already true/);
  assert.match(falsify({ ...base, planText: PLAN('- [ ] 1. x'), run: () => ({ error: { code: 'ETIMEDOUT' } }) }).reason, /did not finish/);
  assert.match(falsify({ ...base, planText: PLAN('- [ ] 1. x'), run: () => ({ error: { code: 'ENOENT' } }) }).reason, /cannot run/);
  const planned = PLAN('- [ ] 1. write scripts/done.sh', 'bash scripts/done.sh');
  assert.equal(falsify({ ...base, check: 'bash scripts/done.sh', planText: planned, run: exit(127) }).ok, true, 'a script the plan creates is false now');
});

const START = { startWork: () => ({ ok: true }) };
const say = (r) => r?.line ?? r;

test('goal-propose writes the consent record and prints the one question; a goal it cannot set leaves a start-only question', () => {
  const ws = project(PLAN('- [ ] 1. x'));
  const ok = proposeGoal({ workspace: ws.dir, plan: 'plans/p.md', run: exit(1) });
  assert.equal(ok.ok, true);
  assert.equal(ok.line, STATUS.ask(ok.condition));
  assert.match(ok.line, /^Approve plan, start work and set goal: \/goal Every row in plans\/p\.md .*\? \(yes \/ edit \/ no\)$/);
  assert.equal(readGoalRecord(ws.dir, 'consent').hash, conditionHash(ok.condition));
  const bad = project(PLAN('- [ ] 1. x', 'it works'));
  const skipped = proposeGoal({ workspace: bad.dir, plan: 'plans/p.md', run: exit(1) });
  assert.equal(skipped.line, STATUS.askStart(skipped.reason));
  assert.match(skipped.line, /^No goal for this plan: .*judgment.*\.\nApprove plan and start work\? \(yes \/ no\)$/s);
  const rec = readGoalRecord(bad.dir, 'consent');
  assert.equal(rec.condition, null);
  assert.equal(rec.hash, conditionHash('start plans/p.md'));
  const cli = spawnSync(process.execPath, [join(PLUGIN, 'skills', 'lit-plan', 'scripts', 'goal-propose.mjs'), 'plans/p.md'], { cwd: bad.dir, encoding: 'utf8' });
  assert.equal(cli.status, 0);
  assert.match(cli.stdout, /^No goal for this plan: /);
  const gone = workspace();
  assert.match(proposeGoal({ workspace: gone.dir, plan: 'plans/p.md' }).line, /^Goal skipped: plans\/p\.md cannot be read/);
  assert.equal(existsSync(join(gone.dir, '.litgravity', 'goal', 'consent.json')), false, 'no plan, no question');
});

test('consent: only an exact yes to a live question arms; edit asks again; no and other text set nothing', () => {
  assert.equal(consentAnswer(' YES '), 'yes');
  assert.equal(consentAnswer('yes please'), null);
  const ws = project(PLAN('- [ ] 1. x'));
  const asked = proposeGoal({ workspace: ws.dir, plan: 'plans/p.md', run: exit(1) });
  let started = 0;
  const counting = { startWork: () => { started += 1; return { ok: true }; } };
  assert.equal(answerConsent(ws.dir, 'sure', 'c1', Date.now(), counting), null, 'other text is no answer');
  assert.match(say(answerConsent(ws.dir, 'edit', 'c1', Date.now(), counting)), /^Nothing started and no goal set\. Edit the/);
  assert.equal(readGoalRecord(ws.dir, 'owner'), null);
  assert.equal(started, 0, 'edit starts nothing');
  assert.deepEqual(answerConsent(ws.dir, 'yes', 'c1', Date.now(), counting), { line: STATUS.set(asked.condition), start: 'plans/p.md' });
  assert.equal(started, 1, 'yes starts the plan once');
  assert.equal(readGoalRecord(ws.dir, 'owner').condition, asked.condition);
  assert.equal(readGoalRecord(ws.dir, 'consent'), null, 'the question is used up');
  assert.equal(answerConsent(ws.dir, 'yes', 'c1', Date.now(), counting), null, 'a second yes has no question to answer');
  assert.equal(started, 1);
  const stale = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: stale.dir, plan: 'plans/p.md', run: exit(1), now: Date.now() - 31 * 60_000 });
  assert.equal(answerConsent(stale.dir, 'yes', 'c1', Date.now(), counting), null, 'an expired question arms nothing');
  const tampered = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: tampered.dir, plan: 'plans/p.md', run: exit(1) });
  writeGoalRecord(tampered.dir, 'consent', { ...readGoalRecord(tampered.dir, 'consent'), condition: 'Every row is ticked' });
  assert.equal(answerConsent(tampered.dir, 'yes', 'c1', Date.now(), counting), null, 'the hash binds the answer to the asked condition');
  assert.equal(started, 1, 'a stale or tampered question starts nothing');
  const none = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: none.dir, plan: 'plans/p.md', run: exit(1) });
  assert.equal(say(answerConsent(none.dir, 'no', 'c1', Date.now(), counting)), 'Nothing started and no goal set: you answered no.');
  assert.equal(started, 1, 'no starts nothing');
  const refused = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: refused.dir, plan: 'plans/p.md', run: exit(1) });
  assert.deepEqual(answerConsent(refused.dir, 'yes', 'c1', Date.now(), { startWork: () => ({ ok: false, reason: 'a start-work run is already active in this conversation' }) }),
    { line: 'Plan not started and no goal set: a start-work run is already active in this conversation.', start: null });
  assert.equal(readGoalRecord(refused.dir, 'owner'), null, 'a refused start arms no goal');
  const startOnly = project(PLAN('- [ ] 1. x', 'it works'));
  proposeGoal({ workspace: startOnly.dir, plan: 'plans/p.md', run: exit(1) });
  assert.deepEqual(answerConsent(startOnly.dir, 'yes', 'c1', Date.now(), counting), { line: 'Plan approved: start-work runs plans/p.md now. No goal is set.', start: 'plans/p.md' });
  assert.equal(readGoalRecord(startOnly.dir, 'owner'), null);
});

test('PreInvocation: `yes` starts start-work on the plan through the hook and arms the goal; `no` starts nothing', () => {
  const { env } = sandbox();
  const ws = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: ws.dir, plan: 'plans/p.md', run: exit(1) });
  const text = injected(turn(ws, env, 'yes', 0));
  assert.match(text, /LIT IGNITED · start-work/);
  assert.match(text, /The user approved plans\/p\.md with `yes`: this is the typed approval for start-work/);
  assert.match(text, /Goal armed by LitGravity: Every row in plans\/p\.md .* Paste: \/goal Every row in plans\/p\.md/);
  const frames = readStack(ws.dir, 'conv-test-0001', env).frames;
  assert.ok(frames.some((f) => f.skill === 'start-work' && f.status === 'active'), 'the start-work frame is on the stack');
  assert.ok(readGoalRecord(ws.dir, 'owner'));
  const again = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: again.dir, plan: 'plans/p.md', run: exit(1) });
  injected(turn(again, env, 'lit start plans/p.md', 0));
  const refusedText = injected(turn(again, env, 'yes', 2));
  assert.match(refusedText, /Plan not started and no goal set: a start-work run is already active in this conversation\./);
  assert.match(refusedText, /Start nothing\./);
  assert.equal(readGoalRecord(again.dir, 'owner'), null);
  const other = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: other.dir, plan: 'plans/p.md', run: exit(1) });
  const noText = injected(turn(other, env, 'no', 0));
  assert.match(noText, /Nothing started and no goal set: you answered no\./);
  assert.doesNotMatch(noText, /LIT IGNITED · start-work/);
  assert.match(injected(turn(workspace(), env, 'yes', 0)), /^LitGravity skills \(read one only if it fits/, 'a yes with no question is an ordinary prompt: only the catalog line');
});

test('turn end: the advisory check clears only a met goal LitGravity owns and holds the turn once to say so', () => {
  const ws = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: ws.dir, plan: 'plans/p.md', run: exit(1) });
  answerConsent(ws.dir, 'yes', 'c1', Date.now(), START);
  assert.equal(advisoryCheck(ws.dir, { run: exit(0) }).state, 'open', 'open rows keep it');
  writeFileSync(join(ws.dir, 'plans', 'p.md'), PLAN('- [x] 1. x'));
  assert.equal(advisoryCheck(ws.dir, { run: exit(1) }).state, 'failing');
  assert.equal(advisoryCheck(ws.dir, { run: () => ({ error: { code: 'ETIMEDOUT' } }) }).state, 'slow', 'a slow check is never met');
  assert.ok(readGoalRecord(ws.dir, 'owner'));
  // Through the real Stop hook: the check is the project's own node test, which passes.
  mkdirSync(join(ws.dir, 'test'), { recursive: true });
  writeFileSync(join(ws.dir, 'test', 'a.test.mjs'), "import test from 'node:test'; test('ok', () => {});\n");
  const { env } = sandbox();
  writeTranscript(ws, [userStep(0, 'carry on'), modelStep(1, 'done')]);
  const out = runHook('stop', basePayload(ws, { terminationReason: 'NO_TOOL_CALL' }), env);
  assert.equal(out.json.decision, 'continue');
  assert.match(out.json.reason, /Goal met and cleared: Every row in plans\/p\.md/);
  assert.equal(readGoalRecord(ws.dir, 'owner'), null);
  const again = runHook('stop', basePayload(ws, { terminationReason: 'NO_TOOL_CALL' }), env);
  assert.notEqual(again.json?.decision, 'continue', 'held once only');
});

test('lit cancel clears only an owned goal; a crashed record is swept at SessionStart; a second yes leaves the first', () => {
  const ws = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: ws.dir, plan: 'plans/p.md', run: exit(1) });
  answerConsent(ws.dir, 'yes', 'c1', Date.now(), START);
  const { env } = sandbox();
  assert.match(injected(turn(ws, env, 'lit cancel', 0)), /Goal cleared by lit cancel:/);
  assert.equal(readGoalRecord(ws.dir, 'owner'), null);
  assert.equal(cancelOwnedGoal(ws.dir), null, 'nothing owned, nothing cleared');
  writeGoalRecord(ws.dir, 'owner', { condition: 'c', hash: conditionHash('c'), plan: 'plans/gone.md', check: 'npm test', armedAt: new Date().toISOString() });
  assert.match(sweepGoal(ws.dir), /^Goal record dropped/);
  const two = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: two.dir, plan: 'plans/p.md', run: exit(1) });
  answerConsent(two.dir, 'yes', 'c1', Date.now(), START);
  writeFileSync(join(two.dir, 'plans', 'p.md'), PLAN('- [ ] 1. x', 'npm test'));
  proposeGoal({ workspace: two.dir, plan: 'plans/p.md', run: exit(1) });
  assert.match(say(answerConsent(two.dir, 'yes', 'c1', Date.now(), START)), /^A goal is already active/);
});

test('read-only skills never arm a goal: GOAL_NEVER covers them, and only lit-plan ships or names goal-propose', () => {
  for (const id of [...READ_ONLY_DISCIPLINES.filter((d) => SKILL_IDS.has(d)), 'review-work', 'litresearch', 'lit-brainstorm', 'ultra-brainstorm']) assert.ok(GOAL_NEVER.has(id), id);
  for (const id of GOAL_NEVER) {
    assert.ok(SKILL_IDS.has(id), id);
    const dir = join(PLUGIN, 'skills', id);
    const text = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.md')).map((f) => readFileSync(join(dir, String(f)), 'utf8')).join('\n');
    assert.doesNotMatch(text, /goal-propose/, id);
  }
  assert.ok(existsSync(join(PLUGIN, 'skills', 'lit-plan', 'scripts', 'goal-propose.mjs')));
  const ws = project(PLAN('- [ ] 1. x'));
  proposeGoal({ workspace: ws.dir, plan: 'plans/p.md', run: exit(1) });
  writeGoalRecord(ws.dir, 'consent', { ...readGoalRecord(ws.dir, 'consent'), route: 'lit-adhd' });
  let started = false;
  assert.equal(answerConsent(ws.dir, 'yes', 'c1', Date.now(), { startWork: () => { started = true; return { ok: true }; } }), null);
  assert.equal(started, false, 'a read-only skill never starts work');
});

test('no "if available" goal-tool sentence is left in the bundle', () => {
  const hits = readdirSync(PLUGIN, { recursive: true }).map(String).filter((f) => f.endsWith('.md'))
    .filter((f) => /(?:get|create|update)_goal|goal tool[^.\n]*if (?:available|offered)/iu.test(readFileSync(join(PLUGIN, f), 'utf8')));
  assert.deepEqual(hits, []);
});
