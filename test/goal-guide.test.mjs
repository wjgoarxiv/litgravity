import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sandbox, workspace, turn, injected, PLUGIN } from './helpers.mjs';
import { STATUS, proposeGoal, proposeLoopGoal } from '../plugin/hooks/lib/goal.mjs';
import { GOAL_ANSWERS, answerChoices, answerGuide } from '../plugin/hooks/lib/goal-guide.mjs';

const SCRIPT = join(PLUGIN, 'skills', 'lit-plan', 'scripts', 'goal-propose.mjs');
const exit = (status) => () => ({ status, signal: null, error: null });
const rowWords = (guide) => [...guide.matchAll(/^> \| \*\*`([a-z]+)`\*\* \|/gmu)].map((m) => m[1]);

function project({ plan, pkg } = {}) {
  const ws = workspace();
  mkdirSync(join(ws.dir, 'plans'), { recursive: true });
  if (plan) writeFileSync(join(ws.dir, 'plans', 'p.md'), plan);
  if (pkg) writeFileSync(join(ws.dir, 'package.json'), JSON.stringify({ name: 'p', scripts: { test: 'node --test' } }));
  return ws;
}

test('Given the three questions, the guide rows and the question choices come from one option list', () => {
  assert.deepEqual(Object.keys(GOAL_ANSWERS).sort(), ['loop', 'plan', 'start']);
  assert.equal(answerChoices('plan'), '(yes / edit / no)');
  assert.equal(answerChoices('start'), '(yes / no)');
  assert.equal(answerChoices('loop'), '(yes / no)');
  for (const kind of Object.keys(GOAL_ANSWERS)) {
    assert.deepEqual(rowWords(answerGuide(kind, 'c')), GOAL_ANSWERS[kind].rows.map(([word]) => word), kind);
  }
  // The question lines stay byte-for-byte.
  assert.equal(STATUS.ask('C'), 'Approve plan, start work and set goal: /goal C? (yes / edit / no)');
  assert.equal(STATUS.askStart('R'), 'No goal for this plan: R.\nApprove plan and start work? (yes / no)');
  assert.equal(STATUS.askLoop('C'), 'Set goal for this lit-loop: /goal C? (yes / no)');
});

test('Given a plan goal, the guide is a Markdown quote: heading, the goal, the three-row table, then the closing line', () => {
  const cond = 'Every row in plans/p.md is ticked and `npm test` exits 0 [lit:0123abcd]';
  assert.equal(answerGuide('plan', cond), [
    '> **▶ Answer: approve plan · start work · set goal**',
    '>',
    `> Goal: \`\` /goal ${cond} \`\``,
    '>',
    '> | Type | What happens |',
    '> |---|---|',
    '> | **`yes`** | Starts the work now and arms this goal; the reply gives the /goal line to paste |',
    "> | **`edit`** | Change the goal's check first |",
    '> | **`no`** | Nothing starts |',
    '>',
    '> Type the word alone.',
  ].join('\n'));
  assert.equal(answerGuide('plan', 'npm test passes').split('\n')[2], '> Goal: `/goal npm test passes`', 'no backtick, one-tick span');
  const start = answerGuide('start');
  assert.doesNotMatch(start, /Goal:/, 'a start-only question names no goal');
  assert.match(start, /^> \*\*▶ Answer: approve plan · start work\*\*$/mu);
  assert.match(start, /\| \*\*`yes`\*\* \| Starts the work now, with no goal \|/u);
  const loop = answerGuide('loop', 'c');
  assert.match(loop, /^> \*\*▶ Answer: set goal for this lit-loop\*\*$/mu);
  assert.match(loop, /\| \*\*`no`\*\* \| Keeps working without a goal \|/u);
});

test('Given each propose path, the result carries the guide for its own question and a skip carries none', () => {
  const ok = proposeGoal({ workspace: project({ plan: '# P\n\n- [ ] 1. x\n\n## Done when\n- check: `npm test`\n' }).dir, plan: 'plans/p.md', run: exit(1) });
  assert.equal(ok.guide, answerGuide('plan', ok.condition));
  const start = proposeGoal({ workspace: project({ plan: '# P\n\n- [ ] 1. x\n' }).dir, plan: 'plans/p.md', run: exit(1) });
  assert.equal(start.guide, answerGuide('start'));
  assert.equal(proposeGoal({ workspace: workspace().dir, plan: 'plans/p.md' }).guide, undefined);
  const loop = proposeLoopGoal({ workspace: project().dir, check: 'npm test', objective: 'fix it', falsifyNow: false });
  assert.equal(loop.guide, answerGuide('loop', loop.condition));
});

test('Given a plan, goal-propose prints the unchanged question line, a blank line, then the guide', () => {
  const ws = project({ plan: '# P\n\n- [ ] 1. x\n\n## Done when\n- check: `npm test`\n', pkg: true });
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const cli = spawnSync(process.execPath, [SCRIPT, 'plans/p.md'], { cwd: ws.dir, encoding: 'utf8', env });
  assert.equal(cli.status, 0);
  const [line, blank, ...guide] = cli.stdout.trimEnd().split('\n');
  assert.match(line, /^Approve plan, start work and set goal: \/goal .*\? \(yes \/ edit \/ no\)$/u);
  assert.equal(blank, '');
  assert.equal(guide.join('\n'), answerGuide('plan', line.slice(line.indexOf('/goal ') + 6, -'? (yes / edit / no)'.length)));
});

test('Given a lit-loop with a test command, the activation note carries the line and tells the model to render the guide under it', () => {
  const { env } = sandbox();
  const ws = project({ pkg: true });
  const text = injected(turn(ws, env, 'lit fix the parser bug', 0));
  const line = text.split('\n').find((l) => l.startsWith('Set goal for this lit-loop: /goal '));
  assert.ok(line, text);
  const condition = line.slice('Set goal for this lit-loop: /goal '.length, -'? (yes / no)'.length);
  assert.ok(text.includes(`${line}\n${answerGuide('loop', condition)}`), 'the guide follows the line');
  assert.match(text, /user's language/u);
  assert.match(text, /answer words stay/u);
});

test('Given the plan and loop skills, each tells the model to put the answer guide right under the question', () => {
  for (const file of ['skills/lit-plan/SKILL.md', 'skills/lit-plan/references/goal-condition.md', 'skills/lit-loop/SKILL.md', 'skills/lit-loop/references/ledger-and-records.md']) {
    const text = readFileSync(join(PLUGIN, file), 'utf8');
    assert.match(text, /answer guide/u, file);
  }
  const ref = readFileSync(join(PLUGIN, 'skills/lit-plan/references/goal-condition.md'), 'utf8');
  assert.match(ref, /user's language/u);
  assert.match(ref, /Type the word alone\./u);
});
