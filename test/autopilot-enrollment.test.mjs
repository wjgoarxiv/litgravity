import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { PLUGIN, ROOT, sandbox, collect } from './helpers.mjs';
import { install } from '../lib/install.mjs';
import { checkBudgetMs, checkCapMs, replayCapMs } from '../plugin/hooks/lib/autopilot.mjs';
import { STOP_CHECK_TIMEOUT_MS } from '../plugin/hooks/lib/goal.mjs';
import { RULES, CATALOG_LINE } from '../plugin/hooks/lib/suggest.mjs';
import { SKILL_ROUTES } from '../plugin/hooks/lib/routes.mjs';

// The autopilot and the suggestion tier are wired into the pieces a user's agy actually loads: the hook scripts that
// hooks.json runs, the start-work skill and its reference, the ledger script, the package list and the installed copy.

const read = (p) => readFileSync(join(PLUGIN, p), 'utf8');

test('the hook scripts that hooks.json runs import the autopilot and the suggestion tier', () => {
  const hooks = JSON.parse(read('hooks.json')).litgravity;
  assert.equal(hooks.Stop[0].command, 'node ./hooks/stop.mjs');
  assert.equal(hooks.PreInvocation[0].command, 'node ./hooks/pre-invocation.mjs');
  assert.match(read('hooks/stop.mjs'), /from '\.\/lib\/continuation\.mjs'/);
  assert.match(read('hooks/lib/continuation.mjs'), /from '\.\/autopilot\.mjs'/);
  assert.match(read('hooks/lib/autopilot.mjs'), /from '\.\/steps\.mjs'/);
  assert.match(read('hooks/pre-invocation.mjs'), /from '\.\/lib\/autopilot\.mjs'/);
  assert.match(read('hooks/pre-invocation.mjs'), /from '\.\/lib\/suggest\.mjs'/);
  assert.ok(hooks.Stop[0].timeout * 1000 >= checkCapMs() + STOP_CHECK_TIMEOUT_MS + 2_000, 'Stop fits the advisory goal check, the Done-when check and the boundary scan');
  assert.ok(hooks.PreInvocation[0].timeout * 1000 > replayCapMs(), 'PreInvocation fits the replay budget');
  const t0 = 1_000_000;
  assert.equal(checkBudgetMs(t0, t0), checkCapMs(), 'a fresh Stop gives the check its full cap');
  assert.equal(checkBudgetMs(t0 + 8_500, t0), 18_500, 'after the 7 s goal check and the 1.5 s scan, 3 s stay for the run-state write');
  assert.equal(checkBudgetMs(t0 + 29_000, t0), 0, 'nothing is left near the host timeout');
  assert.equal(hooks.Stop[0].timeout * 1000, 30_000, 'checkBudgetMs assumes the 30 s Stop timeout');
});

test('every skill a suggestion or the catalog line names is an enrolled route', () => {
  const ids = [...RULES.map((r) => r.id), .../routes directly\): ([^.]+)\./.exec(CATALOG_LINE)[1].split(', ')];
  for (const id of ids) {
    assert.ok(SKILL_ROUTES.some((r) => r.id === id), `${id} is in SKILL_ROUTES`);
    assert.ok(readFileSync(join(PLUGIN, 'skills', id, 'SKILL.md'), 'utf8').length > 0, `${id} ships a SKILL.md`);
  }
});

test('the start-work skill names the reference, the park line and every approval word', () => {
  const skill = read('skills/start-work/SKILL.md');
  assert.match(skill, /references\/autopilot\.md/);
  assert.match(skill, /--kind park --command/);
  const ref = read('skills/start-work/references/autopilot.md');
  for (const word of ['`lit approve`', '`lit approve x`', '`lit deny`', '`lit skip-row`', '`lit pause`', '`lit resume`', 'Run charter: commit on', 'goal: native', 'WAITING-ON-USER:']) {
    assert.ok(ref.includes(word), word);
  }
  assert.equal((ref.match(/^- BLOCKED: /gm) ?? []).length, 5, 'every host gap is written as BLOCKED with its agy fact');
  assert.match(ref, /^- BLOCKED: a snapshot seal the model cannot reach\./m, 'C-4: the seal residual is written down');
  assert.match(ref, /^- Runner indirection: /m, 'C-2: the runner residual is written down once');
  for (const text of [skill, ref]) assert.doesNotMatch(text, /lit cancel/);
});

test('ledger-append writes a park line the Stop hook can read', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-park-'));
  const r = spawnSync(process.execPath, [join(PLUGIN, 'skills', 'start-work', 'scripts', 'ledger-append.mjs'), '--conversation', 'c1', '--kind', 'park', '--command', 'git push origin x', '--cwd', '.'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const line = JSON.parse(readFileSync(join(dir, '.litgravity', 'ledger', 'c1.jsonl'), 'utf8').trim());
  assert.equal(line.kind, 'park');
  assert.equal(line.command, 'git push origin x');
  assert.ok(line.cwd.endsWith(basename(dir)), 'the folder is stored absolute');
  const bad = spawnSync(process.execPath, [join(PLUGIN, 'skills', 'start-work', 'scripts', 'ledger-append.mjs'), '--conversation', 'c1', '--kind', 'park'], { cwd: dir, encoding: 'utf8' });
  assert.equal(bad.status, 2);
});

test('the package list and the installed plugin carry the new hook libraries and the reference', async () => {
  const { pack } = JSON.parse(readFileSync(join(ROOT, 'skills.lock.json'), 'utf8'));
  for (const f of ['plugin/hooks/lib/autopilot.mjs', 'plugin/hooks/lib/steps.mjs', 'plugin/hooks/lib/suggest.mjs', 'plugin/hooks/lib/lanes.mjs', 'plugin/skills/start-work/references/autopilot.md']) {
    assert.ok(pack.includes(f), f);
  }
  assert.ok(!pack.some((f) => f.startsWith('scripts/') || f.startsWith('test/')), 'the scorer and its fixture stay out of the package');
  const { env } = sandbox();
  const out = collect();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-proj-'));
  assert.equal(await install({ env, flags: { yes: true, scope: 'project' }, cwd, print: out.print }), 0, out.text());
  const installed = join(cwd, '.agents', 'plugins', 'litgravity');
  for (const f of ['hooks/lib/autopilot.mjs', 'hooks/lib/steps.mjs', 'hooks/lib/suggest.mjs', 'skills/start-work/references/autopilot.md']) {
    assert.ok(readFileSync(join(installed, f), 'utf8').length > 0, f);
  }
});
