import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, workspace, turn, injected, PLUGIN } from './helpers.mjs';

const SKILL = readFileSync(join(PLUGIN, 'skills', 'lit-team', 'SKILL.md'), 'utf8');

test('lit-team opens with the purpose line: this session is the orchestrator', () => {
  assert.match(SKILL, /\nType `lit team <goal>`; this session becomes the orchestrator and runs the team for you\./);
  assert.match(SKILL, /^description: "Type lit team <goal>; this session becomes the orchestrator/m);
});

test('the orchestrator picks the distribution itself, from the four agy surfaces, and says which in one line', () => {
  const table = SKILL.slice(SKILL.indexOf('## How the orchestrator picks the distribution'), SKILL.indexOf('### Composition lenses'));
  assert.match(table, /2 to 6 independent slices that touch separate files \| `invoke_subagent`/);
  assert.match(table, /many similar items[^\n]*\| `run_workflow`/);
  assert.match(table, /herdr panes, only when `HERDR_ENV=1` and `herdr` is on PATH/);
  assert.match(table, /otherwise fall back to subagents/);
  assert.match(table, /slices that edit the same files \| isolation: `run_workflow` agents with `workspace="branch"`[^\n]*git worktree add/);
  assert.match(table, /say which in one line/);
});

test('no setup questions beyond one about an unclear goal; members never commit; each has its own scratch folder', () => {
  assert.match(SKILL, /Ask one question only when the goal itself is unclear/);
  assert.match(SKILL, /composition, isolation and agent choice are yours to decide/);
  assert.doesNotMatch(SKILL, /ask the user to approve composition/i);
  assert.match(SKILL, /never commit or push, and each works in its own scratch folder/);
  assert.match(SKILL, /artifacts\/<member>\/`; no two members share one/);
  assert.match(SKILL, /wake a stalled member/i);
  assert.match(SKILL, /one reader-mode report: what is done, material risk[^\n]*what needs the user/);
  assert.match(SKILL, /The parent filters every child return again/);
});

test('`lit team <goal>` activates the rewritten skill and keeps the packet CLI', () => {
  const { env } = sandbox();
  const ws = workspace();
  const text = injected(turn(ws, env, 'lit team split the docs rewrite into three slices', 0));
  assert.match(text, /LIT IGNITED · lit-team/);
  assert.ok(text.includes(join(PLUGIN, 'skills', 'lit-team', 'SKILL.md')));
  assert.match(SKILL, /scripts\/team\.mjs" init/);
});
