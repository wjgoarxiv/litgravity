import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, statSync, symlinkSync, utimesSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sandbox, workspace, runHook, basePayload, turn, injected, userStep, modelStep } from './helpers.mjs';
import { queueExtensionNotice } from '../plugin/hooks/lib/extensions.mjs';

const stop = (ws, env, extra = {}, conv = 'conv-test-0001') => runHook('stop', basePayload(ws, { conversationId: conv, executionNum: 1, terminationReason: 'NO_TOOL_CALL', fullyIdle: true, ...extra }), env);
const start = (ws, env, conv) => runHook('session-start', basePayload(ws, { conversationId: conv }), env);
const ctx = (r) => r.json?.injectSteps?.[0]?.systemMessage?.systemMessage ?? '';

const PLAN = [
  '# Plan', '', 'Status: approved', '', '## Todos',
  '- [x] 1. Collect the invoices',
  '- [x] 2. Normalise the currency columns',
  '- [ ] 3. Reconcile the quarterly ledger totals',
  '- [ ] 4. Publish the summary page', '',
].join('\n');

// A workspace with an approved four-row plan and a start-work turn that has ended at row 3.
function workedPlan(env, prompt = 'lit start plans/plan.md') {
  const ws = workspace();
  mkdirSync(join(ws.dir, 'plans'));
  writeFileSync(join(ws.dir, 'plans', 'plan.md'), PLAN);
  turn(ws, env, prompt, 0);
  return ws;
}
const autoFile = (ws) => join(ws.dir, '.litgravity', 'handoff', 'auto.md');
const shownLines = (ws) => {
  const file = join(ws.dir, '.litgravity', 'shown', 'notices.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
};
const setLatest = (env, latest) => {
  const dir = join(env.XDG_DATA_HOME, 'litgravity');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'update-check.json'), JSON.stringify({ latest }));
};

// --- T3: the handoff is saved when a turn ends, by default, and carried into the next conversation ---

test('Stop saves a handoff for a lit conversation and the next conversation starts with its body', () => {
  const { env } = sandbox();
  const ws = workedPlan(env);
  stop(ws, env);
  assert.ok(existsSync(autoFile(ws)), 'auto.md is written at the end of the turn');
  const saved = readFileSync(autoFile(ws), 'utf8');
  assert.match(saved, /plans\/plan\.md/);
  assert.match(saved, /2\/4 rows done/);
  assert.match(saved, /Next: row 3 — Reconcile the quarterly ledger totals/);
  assert.match(saved, /lit start plans\/plan\.md/);
  const next = ctx(start(ws, env, 'conv-test-0002'));
  assert.match(next, /handoff note from an earlier conversation/);
  assert.match(next, /Reconcile the quarterly ledger totals/, 'the body is in the context, not only a pointer');
  assert.match(next, /untrusted/);
});

test('the save also happens when the turn ended on an error or a limit, and when the turn is held', () => {
  const { env } = sandbox();
  const ws = workedPlan(env);
  assert.deepEqual(stop(ws, env, { terminationReason: 'MAX_TOKENS' }).json, {});
  assert.ok(existsSync(autoFile(ws)), 'a limit stop saves');
  const e2 = sandbox().env;
  const ws2 = workedPlan(e2);
  assert.equal(stop(ws2, e2).json?.decision, 'continue', 'start-work holds the turn');
  assert.ok(existsSync(autoFile(ws2)), 'a held turn saves too');
});

test('LITGRAVITY_AUTO_HANDOFF=0 turns the save off and SessionStart only points at a note', () => {
  const { env } = sandbox();
  const off = { ...env, LITGRAVITY_AUTO_HANDOFF: '0' };
  const ws = workedPlan(off);
  stop(ws, off);
  assert.equal(existsSync(autoFile(ws)), false);
  mkdirSync(join(ws.dir, '.litgravity', 'handoff'), { recursive: true });
  writeFileSync(join(ws.dir, '.litgravity', 'handoff', 'latest.md'), '# handoff\n\nSECRET-BODY-MARKER\n');
  const next = ctx(start(ws, off, 'conv-test-0002'));
  assert.match(next, /\.litgravity\/handoff\/latest\.md/);
  assert.doesNotMatch(next, /SECRET-BODY-MARKER/, 'off means the released pointer-only behavior');
});

test('a conversation with no route, goal or ledger saves nothing', () => {
  const { env } = sandbox();
  const ws = workspace();
  mkdirSync(join(ws.dir, 'plans'));
  writeFileSync(join(ws.dir, 'plans', 'plan.md'), PLAN);
  writeFileSync(ws.transcript, `${userStep(0, 'how do I rename a file?')}\n${modelStep(1, 'Use mv.')}\n`);
  stop(ws, env);
  assert.equal(existsSync(autoFile(ws)), false);
});

test('an unchanged state is not rewritten, a changed one is', () => {
  const { env } = sandbox();
  const ws = workedPlan(env);
  stop(ws, env);
  const past = new Date(Date.now() - 3600_000);
  utimesSync(autoFile(ws), past, past);
  stop(ws, env);
  assert.equal(Math.round(statSync(autoFile(ws)).mtimeMs / 1000), Math.round(past.getTime() / 1000), 'same content, same file');
  writeFileSync(join(ws.dir, 'plans', 'plan.md'), PLAN.replace('- [ ] 3.', '- [x] 3.'));
  stop(ws, env);
  assert.match(readFileSync(autoFile(ws), 'utf8'), /Next: row 4 — Publish the summary page/);
});

test('the saved note never carries a credential from the prompt or the reply', () => {
  const { env } = sandbox();
  const ws = workedPlan(env, 'lit start plans/plan.md with OPENAI_API_KEY=sk-live-abcdefghijklmnopqrstuvwx');
  writeFileSync(ws.transcript, `${readFileSync(ws.transcript, 'utf8')}${modelStep(1, 'token ghp_abcdefghijklmnopqrstuvwxyz0123 leaked')}\n`);
  stop(ws, env);
  const saved = readFileSync(autoFile(ws), 'utf8');
  assert.doesNotMatch(saved, /sk-live|ghp_/);
  assert.match(saved, /\[redacted\]/);
});

test('a .litgravity that is a link is never written through', () => {
  const { env } = sandbox();
  const ws = workspace();
  mkdirSync(join(ws.dir, 'plans'));
  writeFileSync(join(ws.dir, 'plans', 'plan.md'), PLAN);
  const target = mkdtempSync(join(tmpdir(), 'litgravity-link-'));
  symlinkSync(target, join(ws.dir, '.litgravity'));
  turn(ws, env, 'lit start plans/plan.md', 0);
  stop(ws, env);
  assert.equal(existsSync(join(target, 'handoff', 'auto.md')), false);
  assert.equal(existsSync(join(target, 'shown')), false);
});

test('a .litgravity or handoff folder that is a link is never read into the next conversation', () => {
  const { env } = sandbox();
  for (const linked of ['.litgravity', 'handoff']) {
    const ws = workspace();
    const target = mkdtempSync(join(tmpdir(), 'litgravity-readlink-'));
    mkdirSync(join(target, 'handoff'), { recursive: true });
    writeFileSync(join(target, 'handoff', 'latest.md'), '# handoff\n\nLINKED-BODY-MARKER\n');
    if (linked === '.litgravity') symlinkSync(target, join(ws.dir, '.litgravity'));
    else {
      mkdirSync(join(ws.dir, '.litgravity'));
      symlinkSync(join(target, 'handoff'), join(ws.dir, '.litgravity', 'handoff'));
    }
    assert.doesNotMatch(ctx(start(ws, env, 'conv-test-0002')), /LINKED-BODY-MARKER/, `${linked} link`);
  }
});

test('SessionStart carries the newest of the model-written note and the automatic one, and caps its size', () => {
  const { env } = sandbox();
  const ws = workedPlan(env);
  stop(ws, env);
  const dir = join(ws.dir, '.litgravity', 'handoff');
  const old = new Date(Date.now() - 3600_000);
  utimesSync(autoFile(ws), old, old);
  writeFileSync(join(dir, 'latest.md'), `# handoff\n\nWRITTEN-BY-MODEL\n${'x'.repeat(20000)}\nTAIL-MARKER\n`);
  const next = ctx(start(ws, env, 'conv-test-0002'));
  assert.match(next, /WRITTEN-BY-MODEL/);
  assert.doesNotMatch(next, /TAIL-MARKER/, 'long notes are cut');
  assert.match(next, /latest\.md/);
  assert.ok(next.length < 12000);
});

test('a handoff older than three days is not carried', () => {
  const { env } = sandbox();
  const ws = workedPlan(env);
  stop(ws, env);
  const old = new Date(Date.now() - 4 * 24 * 3600_000);
  utimesSync(autoFile(ws), old, old);
  assert.doesNotMatch(ctx(start(ws, env, 'conv-test-0002')), /handoff note/);
});

// --- T4: a notice is shown once per project; each run end is recorded ---

test('the update notice is shown once per project and again for a newer release', () => {
  const { env } = sandbox();
  setLatest(env, '99.0.0');
  const ws = workspace();
  assert.match(ctx(start(ws, env, 'conv-test-0001')), /Update: LitGravity 99\.0\.0/);
  assert.doesNotMatch(ctx(start(ws, env, 'conv-test-0002')), /Update: LitGravity/);
  assert.doesNotMatch(ctx(start(ws, env, 'conv-test-0003')), /Update: LitGravity/);
  const other = workspace();
  assert.match(ctx(start(other, env, 'conv-test-0004')), /Update: LitGravity 99\.0\.0/, 'another project has not been told');
  setLatest(env, '99.1.0');
  assert.match(ctx(start(ws, env, 'conv-test-0005')), /Update: LitGravity 99\.1\.0/, 'a new release is a new notice');
  const kinds = shownLines(ws).map((l) => l.kind);
  assert.deepEqual(kinds, ['update', 'update']);
  assert.match(shownLines(ws)[0].hash, /^[0-9a-f]{16}$/);
  assert.ok(Number.isFinite(Date.parse(shownLines(ws)[0].ts)));
});

test('the lit adhd nudge is shown once per project', () => {
  const { env } = sandbox();
  const ws = workedPlan(env);
  assert.match(ctx(start(ws, env, 'conv-test-0002')), /recent lit sessions/);
  assert.doesNotMatch(ctx(start(ws, env, 'conv-test-0003')), /recent lit sessions/);
});

test('the extensions notice queued again by a later install is not repeated in the same project', () => {
  const { env } = sandbox();
  const data = join(env.XDG_DATA_HOME, 'litgravity');
  const ws = workspace();
  queueExtensionNotice(data, '0.1.10');
  assert.match(ctx(start(ws, env, 'conv-test-0001')), /installed or updated just before/);
  queueExtensionNotice(data, '0.1.11');
  assert.doesNotMatch(ctx(start(ws, env, 'conv-test-0002')), /installed or updated just before/);
  const flag = JSON.parse(readFileSync(join(data, 'extensions-notice.json'), 'utf8'));
  assert.equal(flag.shown, true, 'the queued flag is still used up');
});

test('a corrupt or unreadable record falls back to showing the notice as before', () => {
  const { env } = sandbox();
  setLatest(env, '99.0.0');
  const ws = workspace();
  const dir = join(ws.dir, '.litgravity', 'shown');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'notices.jsonl'), '{not json\n\u0000\u0001garbage\n');
  assert.match(ctx(start(ws, env, 'conv-test-0001')), /Update: LitGravity 99\.0\.0/);
  assert.doesNotMatch(ctx(start(ws, env, 'conv-test-0002')), /Update: LitGravity/, 'garbage lines are skipped; the first notice was recorded after them');
  const ws2 = workspace();
  mkdirSync(join(ws2.dir, '.litgravity', 'shown', 'notices.jsonl'), { recursive: true });
  const r = start(ws2, env, 'conv-test-0003');
  assert.equal(r.status, 0);
  assert.match(ctx(r), /Update: LitGravity 99\.0\.0/, 'a directory in the way never blocks the notice');
});

test('a smoke payload without a conversation id shows the notice and records nothing', () => {
  const { env } = sandbox();
  setLatest(env, '99.0.0');
  const ws = workspace();
  const r = runHook('session-start', { workspacePaths: [ws.dir] }, env);
  assert.match(ctx(r), /Update: LitGravity 99\.0\.0/);
  assert.equal(existsSync(join(ws.dir, '.litgravity')), false);
});

test('a run end is recorded as waiting, nothing or sent', () => {
  const { env } = sandbox();
  // waiting: the turn ended on a question
  const a = workedPlan(env);
  writeFileSync(a.transcript, `${readFileSync(a.transcript, 'utf8')}${JSON.stringify({ step_index: 1, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'DONE', content: 'May I read /srv/data?', tool_calls: [{ name: 'ask_question' }] })}\n`);
  // release the start-work hold with a ledger note so the turn may end
  mkdirSync(join(a.dir, '.litgravity', 'ledger'), { recursive: true });
  writeFileSync(join(a.dir, '.litgravity', 'ledger', 'conv-test-0001.jsonl'), `${JSON.stringify({ kind: 'note', text: 'PAUSED at row 3: waiting for a path' })}\n`);
  stop(a, env);
  assert.deepEqual(shownLines(a).filter((l) => l.kind === 'run-end').map((l) => [l.outcome, l.route]), [['waiting', 'start-work']]);

  // nothing: work is left open and nothing asks the user
  const b = workedPlan(env);
  mkdirSync(join(b.dir, '.litgravity', 'ledger'), { recursive: true });
  writeFileSync(join(b.dir, '.litgravity', 'ledger', 'conv-test-0001.jsonl'), `${JSON.stringify({ kind: 'note', text: 'PAUSED at row 3: stopping here' })}\n`);
  writeFileSync(b.transcript, `${readFileSync(b.transcript, 'utf8')}${modelStep(1, 'Stopped at row 3.')}\n`);
  stop(b, env);
  assert.deepEqual(shownLines(b).filter((l) => l.kind === 'run-end').map((l) => l.outcome), ['nothing']);

  // sent: every row is ticked
  const c = workedPlan(env);
  writeFileSync(join(c.dir, 'plans', 'plan.md'), PLAN.replaceAll('- [ ]', '- [x]'));
  writeFileSync(c.transcript, `${readFileSync(c.transcript, 'utf8')}${modelStep(1, 'All four rows are done.')}\n`);
  assert.equal(stop(c, env).json.decision, 'continue', 'the first turn end hands the model the completion line to repeat');
  assert.deepEqual(shownLines(c).filter((l) => l.kind === 'run-end'), []);
  stop(c, env);
  assert.deepEqual(shownLines(c).filter((l) => l.kind === 'run-end').map((l) => l.outcome), ['sent']);
});

test('a held turn is not a run end, and a plan-only route records no run end', () => {
  const { env } = sandbox();
  const a = workedPlan(env);
  assert.equal(stop(a, env).json?.decision, 'continue');
  assert.deepEqual(shownLines(a), []);
  const b = workspace();
  turn(b, env, 'lit plan x', 0);
  mkdirSync(join(b.dir, 'plans'));
  writeFileSync(join(b.dir, 'plans', 'x.md'), '- [ ] 1. a\n');
  stop(b, env);
  assert.deepEqual(shownLines(b).filter((l) => l.kind === 'run-end'), []);
});
