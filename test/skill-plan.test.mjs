import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, workspace, turn, injected } from './helpers.mjs';
import { detectRoute } from '../plugin/hooks/lib/routes.mjs';
import { buildSkillPlan, skillPlanLine, skillPlanContext, PLAN_CAP } from '../plugin/hooks/lib/skill-plan.mjs';

const plan = (prompt, opts = {}) => buildSkillPlan(detectRoute(prompt), { env: opts.env ?? sandbox().env, workspace: opts.workspace ?? null });
const ids = (p) => p?.entries.map((e) => e.id) ?? null;

test('a task that asks for two deliverables keeps the router primary and adds the other match as a companion', () => {
  const p = plan('lit build a landing page and plot the latency chart from data.csv');
  assert.deepEqual(ids(p), ['frontend-ui-ux', 'lit-scientific-visualization']);
  assert.match(skillPlanLine(p), /^Skill plan: 1 frontend-ui-ux \(primary\b/);
});

test('three matches fill the cap of three; a fourth is left out with a reason', () => {
  const p = plan('lit draw a P&ID, make a 10-slide deck, build a dashboard and draw an architecture diagram');
  assert.equal(p.entries.length, PLAN_CAP);
  assert.equal(ids(p)[0], 'lit-schematic');
  assert.ok(p.dropped.some((d) => /cap/.test(d.why)));
});

test('a plain prompt stays one route and its activation carries no plan', () => {
  assert.equal(plan('lit fix the flaky login test'), null);
  assert.equal(plan('lit plan a tiny todo app'), null);
  const { env } = sandbox();
  const ws = workspace();
  assert.doesNotMatch(injected(turn(ws, env, 'lit fix the flaky login test', 0)), /Skill plan:/);
});

test('fenced, inline-code and quoted text routes nothing', () => {
  assert.equal(plan('lit fix the parser for "build a dashboard and plot a chart" strings'), null);
  assert.equal(plan('lit fix the regex in `make a slide deck`'), null);
});

test('a moved companion that is not installed names its install command once; an installed copy is offered by path', () => {
  const { env, home } = sandbox();
  const missing = plan('lit build a landing page and plot the latency chart', { env });
  assert.match(skillPlanLine(missing), /lit-scientific-visualization \(not installed: npx @litfamily\/litgravity extensions install lit-scientific-visualization --yes\)/);
  assert.match(skillPlanLine(missing), /frontend-ui-ux \(primary\) \(not installed/);
  mkdirSync(join(home, '.gemini', 'config', 'skills', 'lit-scientific-visualization'), { recursive: true });
  writeFileSync(join(home, '.gemini', 'config', 'skills', 'lit-scientific-visualization', 'SKILL.md'), '---\nname: lit-scientific-visualization\n---\n');
  const found = plan('lit build a landing page and plot the latency chart', { env });
  assert.match(skillPlanLine(found), /lit-scientific-visualization \(figures extension\)/);
  assert.match(skillPlanContext(found, { env }), /Companion files: lit-scientific-visualization: .*\.gemini\/config\/skills\/lit-scientific-visualization\/SKILL\.md/);
  assert.match(skillPlanContext(found, { env }), /Catalog \(installed here\): .*lit-plan — /);
  assert.doesNotMatch(skillPlanContext(missing, { env }), /Catalog[^\n]*lit-docx/, 'an uninstalled extension is never in the catalog');
});

test('a large or risky design ask adds lit-crucible first, never instead of the primary; an explain ask does not', () => {
  assert.deepEqual(ids(plan('lit redesign the sync architecture of the CLI')), ['lit-loop', 'lit-crucible']);
  assert.deepEqual(ids(plan('lit 인증 모듈을 재설계해줘')), ['lit-loop', 'lit-crucible']);
  assert.equal(plan('lit explain the architecture of this repo'), null);
});

test('`lit +viz +ui <task>` forces exactly that plan and reports unknown names', () => {
  const hit = detectRoute('lit +viz +ui +nope make the report');
  assert.deepEqual(hit.forced, ['viz', 'ui', 'nope']);
  assert.equal(hit.route, 'lit-loop');
  const p = buildSkillPlan(hit, { env: sandbox().env });
  assert.deepEqual(ids(p), ['lit-loop', 'lit-scientific-visualization', 'frontend-ui-ux']);
  const text = skillPlanContext(p, { env: sandbox().env });
  assert.match(text, /keep it exactly/);
  assert.match(text, /Ignored unknown plan names: \+nope/);
  assert.doesNotMatch(text, /Catalog/);
  assert.equal(detectRoute('lit +crucible plan the migration').route, 'lit-plan');
});

test('a read-only primary never gains a companion that writes', () => {
  const p = buildSkillPlan(detectRoute('lit +ui +crucible review the dashboard branch'), { env: sandbox().env });
  assert.equal(p.entries[0].id, 'review-work');
  assert.deepEqual(ids(p), ['review-work', 'lit-crucible']);
  assert.ok(p.dropped.some((d) => d.id === 'frontend-ui-ux' && /read-only/.test(d.why)));
  assert.equal(plan('lit research how others build a dashboard and plot charts'), null);
});

test('Korean and English prompts both reach the plan through PreInvocation, and the ledger keeps the ids', () => {
  const { env } = sandbox();
  const ws = workspace();
  const text = injected(turn(ws, env, 'lit 대시보드 화면을 만들고 지연시간 그래프를 그려줘', 0));
  assert.match(text, /LIT IGNITED · frontend-ui-ux/);
  assert.match(text, /Skill plan: 1 frontend-ui-ux \(primary\)[^\n]* → 2 lit-scientific-visualization/);
  assert.match(text, /State the final plan on the line right after the ignition line/);
});
