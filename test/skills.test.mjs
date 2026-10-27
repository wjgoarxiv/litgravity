import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PLUGIN } from './helpers.mjs';
import { checkPlan, uncoveredPaths } from '../plugin/skills/lit-plan/scripts/check-plan.mjs';
import { checkGoal } from '../plugin/skills/litgoal/scripts/check-goal.mjs';

const PLAN_CHECK = join(PLUGIN, 'skills', 'lit-plan', 'scripts', 'check-plan.mjs');
const GOAL_CHECK = join(PLUGIN, 'skills', 'litgoal', 'scripts', 'check-goal.mjs');
const node = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });

function skeleton(slug = 'demo-plan') {
  const r = node([PLAN_CHECK, '--skeleton', slug], PLUGIN);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
const fill = (text) => text.replace(/<fill[^>]*>/g, 'x').replace('Status: x', 'Status: approved');

test('lit-plan: the shipped plan template is structurally valid once its placeholders are filled, and not before', () => {
  const raw = checkPlan(skeleton());
  assert.equal(raw.ok, false);
  assert.ok(raw.problems.some((p) => /placeholders/.test(p)));
  const filled = checkPlan(fill(skeleton()));
  assert.deepEqual(filled.problems, []);
  assert.equal(filled.rows, 1);
  assert.equal(filled.finals, 4);
});

test('lit-plan: the checker finds indented rows, bad numbering, missing labels, order and open rows', () => {
  const ok = fill(skeleton());
  assert.ok(checkPlan(ok.replace('- [ ] 1. x', '  - [ ] 1. x')).problems.some((p) => /indented task row/.test(p)));
  assert.ok(checkPlan(ok.replace('- [ ] 1. x', '- [ ] 2. x')).problems.some((p) => /not consecutive/.test(p)));
  assert.ok(checkPlan(ok.replace('  - Acceptance: x\n', '')).problems.some((p) => /missing "Acceptance:"/.test(p)));
  assert.ok(checkPlan(ok.replace('## Scope', '## Scopes')).problems.some((p) => /missing section: ## Scope/.test(p)));
  assert.ok(checkPlan(ok.replace('Status: approved', 'Status: maybe')).problems.some((p) => /unknown Status/.test(p)));
  assert.ok(checkPlan(ok, { complete: true }).problems.some((p) => /row still open/.test(p)));
  const ticked = ok.replace(/^- \[ \] /gm, '- [x] ');
  assert.deepEqual(checkPlan(ticked, { complete: true }).problems, []);
  const fenced = `${ok}\n\`\`\`\n  - [ ] 9. example row inside a fence\n\`\`\`\n`;
  assert.deepEqual(checkPlan(fenced).problems, [], 'rows inside code fences are examples, not structure');
});

test('lit-plan: a todo that names an absolute path outside the project needs a covering `Scope roots:` line', () => {
  const ok = fill(skeleton());
  const outside = ok.replace('  - Files: `x`', '  - Files: `/srv/data/input.csv`, `/work/proj/src/a.js`, `plans/x.md`');
  assert.deepEqual(uncoveredPaths(outside, '/work/proj'), ['/srv/data/input.csv']);
  assert.ok(checkPlan(outside, { root: '/work/proj' }).problems.some((p) => /\/srv\/data\/input\.csv, outside the project.*Scope roots:/.test(p)));
  assert.deepEqual(checkPlan(outside).problems, [], 'without a project root the check stays off');

  const covered = outside.replace('## Scope\n', '## Scope\n\nScope roots: /srv/data (read)\n');
  assert.deepEqual(uncoveredPaths(covered, '/work/proj'), []);
  assert.deepEqual(checkPlan(covered, { root: '/work/proj' }).problems, []);
  assert.deepEqual(uncoveredPaths(outside.replace('## Scope\n', '## Scope\n\nScope roots: /srv/database (read)\n'), '/work/proj'), ['/srv/data/input.csv'], 'a sibling prefix does not cover');

  const fenced = ok.replace('## Final verification wave', '```\n- Files: `/etc/hosts`\n```\n\n## Final verification wave');
  assert.deepEqual(uncoveredPaths(fenced, '/work/proj'), [], 'a fenced example is not a todo path');
  const prose = ok.replace('## Scope\n', '## Scope\n\nNever touch /etc/hosts or https://example.com/a/b, and run /litgravity:lit-plan.\n');
  assert.deepEqual(uncoveredPaths(prose, '/work/proj'), [], 'only todo rows are read; URLs and slash routes are no paths');
});

test('lit-plan: CLI --check finds an uncovered outside path against the plan folder\'s project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-plan-'));
  mkdirSync(join(dir, 'plans'));
  writeFileSync(join(dir, 'plans', 'a.md'), fill(skeleton('a')).replace('  - Files: `x`', '  - Files: `/srv/data/input.csv`'));
  const r = node([PLAN_CHECK, '--check', 'plans/a.md'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\/srv\/data\/input\.csv/);
});

test('lit-plan: CLI exit codes, symlink refusal and slug validation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-plan-'));
  mkdirSync(join(dir, 'plans'));
  writeFileSync(join(dir, 'plans', 'a.md'), fill(skeleton('a')));
  const pass = node([PLAN_CHECK, '--check', 'plans/a.md'], dir);
  assert.equal(pass.status, 0);
  assert.match(pass.stdout, /^PLAN_STRUCTURE_PASS plans\/a\.md rows=1 final=4 status="approved"/);
  assert.equal(node([PLAN_CHECK, '--complete', 'plans/a.md'], dir).status, 1);
  symlinkSync(join(dir, 'plans', 'a.md'), join(dir, 'plans', 'link.md'));
  assert.match(node([PLAN_CHECK, '--check', 'plans/link.md'], dir).stderr, /PLAN_UNSAFE/);
  assert.equal(node([PLAN_CHECK, '--check', 'plans/none.md'], dir).status, 1);
  assert.equal(node([PLAN_CHECK], dir).status, 2);
  assert.equal(node([PLAN_CHECK, '--skeleton', 'Bad Slug'], dir).status, 1);
  assert.equal(node([PLAN_CHECK, '--skeleton', 'x'.repeat(41)], dir).status, 1);
});

function record(extra = {}) {
  return { slug: 'csv-export', objective: 'Users can export CSV', criteria: [{ id: 'c1', text: 'cmd exits 0', status: 'open', attempt: 1, evidence: [] }], status: 'active', blockers: [], verdict: null, ...extra };
}

test('litgoal: a fresh record is valid with nothing backed; the shipped template parses', () => {
  const r = checkGoal(record(), '/nonexistent');
  assert.equal(r.ok, true);
  assert.equal(r.canClose, false);
  const tpl = JSON.parse(readFileSync(join(PLUGIN, 'skills', 'litgoal', 'templates', 'goal.json'), 'utf8'));
  assert.equal(tpl.criteria[0].status, 'open');
  assert.equal(tpl.verdict, null);
});

test('litgoal: a pass needs current-attempt green, surface and cleanup evidence on disk', () => {
  const root = mkdtempSync(join(tmpdir(), 'litgravity-goal-'));
  const ev = join(root, '.litgravity', 'evidence', 'csv-export');
  mkdirSync(ev, { recursive: true });
  const rec = record({ criteria: [{ id: 'c1', text: 't', status: 'pass', attempt: 1, evidence: ['.litgravity/evidence/csv-export/c1-green.log'] }] });
  writeFileSync(join(ev, 'c1-green.log'), 'ok');
  let r = checkGoal(rec, root);
  assert.equal(r.ok, false);
  assert.deepEqual(r.demotions[0].gaps, ['no current-attempt surface evidence', 'no cleanup receipt']);
  writeFileSync(join(ev, 'c1-surface.log'), '$ run\nexit 0\ncleanup: removed out.csv\n');
  rec.criteria[0].evidence.push('.litgravity/evidence/csv-export/c1-surface.log');
  r = checkGoal(rec, root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.canClose, true);
  rec.criteria[0].evidence.push('.litgravity/evidence/csv-export/c1-missing.log');
  assert.match(checkGoal(rec, root).demotions[0].gaps[0], /missing files/);
});

test('litgoal: attempts, ledger receipts, done-without-proof and review blockers', () => {
  const root = mkdtempSync(join(tmpdir(), 'litgravity-goal-'));
  mkdirSync(join(root, 'e'), { recursive: true });
  for (const f of ['c1-green.log', 'c1-surface.log', 'c1-a2-green.log', 'c1-a2-surface.log']) writeFileSync(join(root, 'e', f), 'x');
  const retry = record({ criteria: [{ id: 'c1', text: 't', status: 'pass', attempt: 2, evidence: ['e/c1-green.log', 'e/c1-surface.log', 'ledger:conv#4'] }] });
  assert.ok(checkGoal(retry, root).demotions[0].gaps.includes('no current-attempt green evidence'), 'old-attempt files do not count');
  retry.criteria[0].evidence = ['e/c1-a2-green.log', 'e/c1-a2-surface.log', 'ledger:conv#4'];
  assert.equal(checkGoal(retry, root).ok, true);

  const done = record({ status: 'done', verdict: { result: 'met' } });
  assert.ok(checkGoal(done, root).problems.some((p) => /not every criterion is a backed pass/.test(p)));
  assert.ok(checkGoal(record({ status: 'active', blockers: [{ id: 'b1', source: 'review', detail: 'x', resolved: false }] }), root).problems.some((p) => /review blocker/.test(p)));
  assert.ok(checkGoal(record({ verdict: { result: 'not met' } }), root).problems.some((p) => /needs a reason/.test(p)));
  assert.ok(checkGoal(record({ slug: 'Bad Slug' }), root).problems.some((p) => /slug/.test(p)));
  assert.ok(checkGoal(record({ criteria: [{ id: 'c1', text: 't', status: 'open' }, { id: 'c1', text: 'u', status: 'open' }] }), root).problems.some((p) => /duplicate/.test(p)));
});

test('litgoal: CLI prints PASS/FAIL, --json, and exit 2 for an unreadable record', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-goal-'));
  writeFileSync(join(dir, 'g.json'), JSON.stringify(record()));
  const r = node([GOAL_CHECK, 'g.json'], dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^PASS csv-export 0\/1 backed, canClose=false/);
  assert.equal(JSON.parse(node([GOAL_CHECK, 'g.json', '--json'], dir).stdout).ok, true);
  writeFileSync(join(dir, 'bad.json'), '{nope');
  assert.equal(node([GOAL_CHECK, 'bad.json'], dir).status, 2);
  assert.equal(node([GOAL_CHECK], dir).status, 2);
  writeFileSync(join(dir, 'done.json'), JSON.stringify(record({ status: 'done', verdict: { result: 'met' } })));
  assert.equal(node([GOAL_CHECK, 'done.json'], dir).status, 1);
});

test('the three pattern skills agree with the hooks on shared names: state dir, ledger, record fields, route words', () => {
  const read = (id) => readFileSync(join(PLUGIN, 'skills', id, 'SKILL.md'), 'utf8');
  for (const id of ['lit-loop', 'lit-plan', 'litgoal']) {
    const text = read(id);
    assert.match(text, /\.litgravity\/ledger\/<conversation-id>\.jsonl/, `${id}: ledger path`);
    assert.doesNotMatch(text, /\.litmuse|session_id|session-id/, `${id}: sibling state names`);
  }
  assert.match(read('litgoal'), /\.litgravity\/goals\/<slug>\.json/);
  assert.match(read('litgoal'), /conversation_id/);
  assert.match(read('lit-plan'), /`🔥 LIT CONTINUES · lit-plan`/);
  assert.match(read('lit-plan'), /`lit start/);
});

test('lit-humanizer: the shipped self-test passes, and its pledge corpus holds every canonical observed pledge', () => {
  const dir = join(PLUGIN, 'skills', 'lit-humanizer');
  const cases = JSON.parse(readFileSync(join(dir, 'fixtures', 'pledge-cases.json'), 'utf8'));
  const observed = new Set(cases.pledges_observed.map((p) => p.text));
  // The rule branches no model-written pledge reached; each one was pinned after a mutation run let it survive.
  for (const text of [
    '두 공정의 수치는 서로 비교할 수 없음.',
    'This table is not meant to be a ranking.',
    'This chart is not a leaderboard.',
    'This summary is not an endorsement.',
    'This report is not intended as a vendor comparison.',
    'These numbers should not be read as a benchmark.',
    'This deck makes no claims about market share.',
  ]) assert.ok(observed.has(text), `pledges_observed lacks: ${text}`);
  const r = node([join(dir, 'scripts', 'test-fixtures.mjs')], dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`Negative-pledge corpus: ${cases.pledges.length} pledges, ${cases.pledges_observed.length} observed, .* passed`));
});
