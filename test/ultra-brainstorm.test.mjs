import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sandbox, workspace, turn, injected, PLUGIN } from './helpers.mjs';
import { detectRoute, SKILL_ROUTES } from '../plugin/hooks/lib/routes.mjs';
import { costLine, estimate, MAX_AGENTS, TIERS } from '../plugin/skills/ultra-brainstorm/scripts/estimate.mjs';

const SKILL = join(PLUGIN, 'skills', 'ultra-brainstorm');

test('all three route forms reach ultra-brainstorm, and the route table enrolls it', () => {
  for (const prompt of ['ultra-brainstorm names for the CLI', 'lit ultra-brainstorm names for the CLI', '/litgravity:ultra-brainstorm names for the CLI', '/ultra-brainstorm names']) {
    assert.equal(detectRoute(prompt)?.route, 'ultra-brainstorm', prompt);
  }
  assert.equal(detectRoute('Ultra-brainstorm is a word I like'), null, 'mixed case stays prose');
  assert.ok(SKILL_ROUTES.some((r) => r.id === 'ultra-brainstorm'));
});

test('the activation names the skill file; the hook launches nothing and the skill asks before any fan-out', () => {
  const { env } = sandbox();
  const ws = workspace();
  const text = injected(turn(ws, env, 'ultra-brainstorm a name for the status line', 0));
  assert.match(text, /LIT IGNITED · ultra-brainstorm/);
  assert.ok(text.includes(join(SKILL, 'SKILL.md')));
  const skill = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
  assert.match(skill, /exactly one question with `ask_question`/);
  assert.match(skill, /100 \(recommended minimum\)/);
  assert.match(skill, /Silence is no/);
  assert.match(skill, /BLOCKED: ultra-brainstorm needs run_workflow or invoke_subagent/);
  assert.match(skill, /`lit brainstorm <topic>` as the closest safe alternative/);
});

test('the estimator prints the cost line on agy tiers, refuses nonsense and holds the 900 cap', () => {
  assert.deepEqual(TIERS, { idea: 'flash_lite', reduce: 'flash', judge: 'pro' });
  assert.equal(estimate(100).reducers, 4);
  assert.match(costLine(100), /^100 idea agents \(flash_lite\) \+ 4 reducers \(flash\) \+ 1 judge \(pro\) ≈ [\d.]+M-[\d.]+M tokens of agy quota$/);
  assert.throws(() => estimate(0));
  assert.throws(() => estimate(MAX_AGENTS + 1), /split/);
  const cli = spawnSync(process.execPath, [join(SKILL, 'scripts', 'estimate.mjs'), '300'], { encoding: 'utf8' });
  assert.equal(cli.status, 0);
  assert.match(cli.stdout, /^300 idea agents/);
  assert.equal(spawnSync(process.execPath, [join(SKILL, 'scripts', 'estimate.mjs'), 'lots'], { encoding: 'utf8' }).status, 64);
});

test('at least 30 lenses, and the workflow script uses the cheapest tier for ideas, catches each failure and writes only args.out', () => {
  const lenses = readFileSync(join(SKILL, 'references', 'lenses.md'), 'utf8').split('\n').filter((l) => /^\d+\. /.test(l));
  assert.ok(lenses.length >= 30, `${lenses.length} lenses`);
  const doc = readFileSync(join(SKILL, 'references', 'workflow-script.md'), 'utf8');
  const script = /```python\n([\s\S]*?)```/.exec(doc)[1];
  assert.match(script, /model="flash_lite"/);
  assert.match(script, /model="flash"\)/);
  assert.match(script, /model="pro"\)/);
  assert.match(script, /except Exception as error:\n\s+return \{"agent": i/);
  assert.match(script, /TASK: idea agent/);
  assert.match(script, /Call no tool except finish/);
  assert.equal((script.match(/open\(/g) ?? []).length, 1, 'one file write');
  assert.match(script, /with open\(out, "w"/);
});

test('the workflow script is valid Python with top-level await', { skip: spawnSync('python3', ['-c', '1']).status !== 0 && 'no python3 here' }, () => {
  const doc = readFileSync(join(SKILL, 'references', 'workflow-script.md'), 'utf8');
  const script = /```python\n([\s\S]*?)```/.exec(doc)[1];
  const check = spawnSync('python3', ['-I', '-c', 'import ast,sys; compile(sys.stdin.read(), "workflow.py", "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)'], { input: script, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
});

test('R2: the launch answer is read by code: a plain no ends the run at once, silence and chatter launch nothing', async () => {
  const { launchAnswer } = await import('../plugin/skills/ultra-brainstorm/scripts/estimate.mjs');
  for (const no of ['no', 'No.', 'nope', 'cancel', 'stop', '아니', '아니요', '아뇨', '취소', '그만']) assert.deepEqual(launchAnswer(no), { action: 'stop' }, no);
  assert.deepEqual(launchAnswer('100'), { action: 'launch', agents: 100 });
  assert.deepEqual(launchAnswer('300 (recommended)'), { action: 'launch', agents: 300 });
  assert.deepEqual(launchAnswer(' 250 '), { action: 'launch', agents: 250 });
  // The ask_question dialog hands back the option label the user picked, as seen live on agy 1.5.10.
  assert.deepEqual(launchAnswer('(Recommended) 100 (recommended minimum)'), { action: 'launch', agents: 100 });
  assert.deepEqual(launchAnswer('100 (recommended minimum)'), { action: 'launch', agents: 100 });
  assert.deepEqual(launchAnswer('2. 300'), { action: 'launch', agents: 300 });
  assert.equal(launchAnswer('100 or 300?').action, 'ask-again', 'two numbers are no answer');
  assert.deepEqual(launchAnswer('1200'), { action: 'split', agents: 1200 });
  for (const vague of ['', '   ', 'ok', 'sure', 'how much is it?', 'no idea, 100 or 300?']) assert.equal(launchAnswer(vague).action, 'ask-again', vague);
  const cli = spawnSync(process.execPath, [join(SKILL, 'scripts', 'estimate.mjs'), '--answer'], { input: 'no\n', encoding: 'utf8' });
  assert.equal(cli.status, 0);
  assert.equal(cli.stdout, 'stop\n');
  const text = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
  assert.match(text, /A plain `no` ends the run at once/);
  assert.match(text, /estimate\.mjs --answer/);
});

test('R5: the cost range is calibrated on a real 100-agent agy run and pinned by formula', async () => {
  const m = await import('../plugin/skills/ultra-brainstorm/scripts/estimate.mjs');
  const r = m.MEASURED_RUN;
  assert.deepEqual(r, { agents: 100, ideaMedian: 27_939, ideas: 2_852_779, reducers: 343_712, judge: 98_363, orchestrator: 149_844 });
  assert.deepEqual(m.PER_AGENT, { idea: [25_000, 40_000], reduce: [60_000, 100_000], judge: [80_000, 120_000], orchestrator: [150_000, 250_000] });
  const e = m.estimate(100);
  assert.deepEqual(e.tokens, { low: 100 * 25_000 + 4 * 60_000 + 80_000 + 150_000, high: 100 * 40_000 + 4 * 100_000 + 120_000 + 250_000 });
  const measured = r.ideas + r.reducers + r.judge + r.orchestrator;
  assert.equal(measured, 3_444_698);
  assert.ok(e.tokens.low <= measured && measured <= e.tokens.high, 'the range brackets the measured run');
  assert.ok(m.PER_AGENT.idea[0] <= r.ideaMedian && r.ideaMedian <= m.PER_AGENT.idea[1]);
  assert.equal(m.costLine(100), '100 idea agents (flash_lite) + 4 reducers (flash) + 1 judge (pro) ≈ 3.0M-4.8M tokens of agy quota');
  assert.equal(m.costLine(300), '300 idea agents (flash_lite) + 10 reducers (flash) + 1 judge (pro) ≈ 8.3M-13.4M tokens of agy quota');
  const skill = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
  assert.ok(skill.includes(m.costLine(100)), 'the SKILL quotes the real line');
});

test('security: --answer reads the reply from stdin through a quoted heredoc, so $(...) and backticks stay data', async () => {
  const { mkdtempSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'ub-answer-'));
  const script = join(SKILL, 'scripts', 'estimate.mjs');
  const viaStdin = spawnSync(process.execPath, [script, '--answer'], { cwd: dir, input: '100 $(touch x) `touch y`\n', encoding: 'utf8' });
  assert.equal(viaStdin.status, 0);
  assert.equal(viaStdin.stdout, 'ask-again\n', 'the text is parsed as data, not run');
  assert.equal(spawnSync(process.execPath, [script, '--answer'], { input: 'no\n', encoding: 'utf8' }).stdout, 'stop\n');
  assert.equal(spawnSync(process.execPath, [script, '--answer'], { input: '(Recommended) 100 (recommended minimum)\n', encoding: 'utf8' }).stdout, 'launch 100\n');
  // The exact form the skill tells the model to run, through a real shell.
  const shell = spawnSync('/bin/sh', ['-c', `node "${script}" --answer <<'LIT_REPLY_END_9Q7'\n$(touch x) \`touch y\`\nLIT_REPLY_END_9Q7\n`], { cwd: dir, encoding: 'utf8' });
  assert.equal(shell.stdout, 'ask-again\n');
  assert.equal(existsSync(join(dir, 'x')), false, 'nothing ran');
  assert.equal(existsSync(join(dir, 'y')), false, 'nothing ran');
  const skill = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
  assert.match(skill, /estimate\.mjs --answer <<'LIT_REPLY_END_9Q7'/);
  assert.doesNotMatch(skill, /<<'EOF'/);
  assert.match(skill, /If any line of the reply is exactly `LIT_REPLY_END_9Q7`, do not run the command: treat the reply as `ask-again`\./);
  // The argument form is gone: the reply can only arrive on stdin.
  for (const extra of [['no'], ['100'], ['--answer']]) {
    const bad = spawnSync(process.execPath, [script, '--answer', ...extra], { input: 'no\n', encoding: 'utf8' });
    assert.equal(bad.status, 64, extra.join(' '));
    assert.equal(bad.stdout, '');
    assert.match(bad.stderr, /--answer takes no argument/);
  }
  const unknown = spawnSync(process.execPath, [script, '--reply', 'no'], { encoding: 'utf8' });
  assert.equal(unknown.status, 64, 'an unknown argument is an error');
  assert.doesNotMatch(skill, /--answer "/, 'the reply never goes on the command line');
});
