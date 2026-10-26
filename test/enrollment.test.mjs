import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sandbox, collect, workspace, runHook, basePayload, turn, injected, PLUGIN } from './helpers.mjs';
import { install } from '../lib/install.mjs';
import { doctor } from '../lib/doctor.mjs';
import { runtime, runtimeModules } from '../lib/runtime.mjs';
import { skillIds, agentNames, bundleHashes } from '../lib/bundle.mjs';
import { SKILL_ROUTES } from '../plugin/hooks/lib/routes.mjs';

// One place that proves a skill is enrolled on every surface a user or the package touches, not only present on disk.
const ids = skillIds();

test('the plugin folder, the route table and the family list agree on 42 skills and 11 agents', () => {
  assert.equal(ids.length, 42);
  assert.deepEqual(SKILL_ROUTES.map((r) => r.id).sort(), ids);
  assert.equal(agentNames().length, 11);
  for (const a of agentNames()) assert.ok(existsSync(join(PLUGIN, 'agents', `${a}.md`)), a);
});

test('SessionStart lists every skill id with its purpose, so a prompt without the keyword can still pick a route', () => {
  const { env } = sandbox();
  const ws = workspace();
  const msg = runHook('session-start', basePayload(ws), env).json.injectSteps[0].systemMessage.systemMessage;
  for (const r of SKILL_ROUTES) assert.ok(msg.includes(`- ${r.id}: ${r.when}`), r.id);
});

test('`lit <id>` activates each skill with the absolute path of a SKILL.md that exists,', () => {
  const { env } = sandbox();
  for (const id of ids) {
    const ws = workspace();
    const text = injected(turn(ws, env, `lit ${id} the task`, 0));
    assert.match(text, /LIT IGNITED|lit keyword/, id);
    const file = join(PLUGIN, 'skills', id, 'SKILL.md');
    assert.ok(text.includes(file), `${id}: activation names ${file}`);
    assert.ok(statSync(file).isFile());
  }
});

test('doctor --json lists every skill, agent and route, the five engines with their pre-warm commands, and the python pick', async () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-proj-'));
  const out = collect();
  assert.equal(await install({ env, flags: { yes: true, scope: 'project' }, cwd, print: out.print }), 0, out.text());
  const rep = collect();
  const code = await doctor({ env: { ...env, LITGRAVITY_SKIP_HOST_TOOLS: '' }, flags: { json: true, offline: true }, cwd, print: rep.print });
  const doc = JSON.parse(rep.text());
  assert.equal(code, 0, JSON.stringify(doc.checks.filter((c) => c.status === 'FAIL')));
  assert.deepEqual(doc.skills, ids);
  assert.equal(doc.agents.length, 11);
  assert.equal(doc.routes.length, 42);
  for (const name of ['diagram', 'motion', 'office', 'readme', 'sciviz']) {
    const row = doc.checks.find((c) => c.name === `engine ${name}`);
    assert.ok(row, `engine ${name}`);
    if (!/^ready/.test(row.detail)) assert.equal(row.fix, `npx @litfamily/litgravity runtime install ${name}`);
  }
  assert.ok(doc.checks.some((c) => c.name === 'python for engines'));
  for (const label of ['frontend corpus', 'design dataset', 'handoff closure', 'wikify script', 'checker inventory']) {
    assert.equal(doc.checks.find((c) => c.name === label)?.status, 'PASS', label);
  }
  assert.match(doc.checks.find((c) => c.name === 'skills').detail, /42 shipped, all present in the installed copy/);
});

test('the installed copy carries every skill, every engine module, the shared libraries and the motion engine, byte for byte', async () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-proj-'));
  const out = collect();
  assert.equal(await install({ env, flags: { yes: true, scope: 'project' }, cwd, print: out.print }), 0, out.text());
  const dest = join(cwd, '.agents', 'plugins', 'litgravity');
  assert.deepEqual(skillIds(dest), ids);
  for (const f of ['lib/python-pick.mjs', 'hooks/lib/motion.mjs', 'skills/lit-typographic-motion/engine/node/done.mjs', 'skills/lit-typographic-motion/recipes/painted-light/expected.json', 'skills/lit-pptx/scripts/office-runtime.mjs']) {
    assert.ok(existsSync(join(dest, f)), f);
  }
  assert.deepEqual(runtimeModules(dest).map((m) => m.name), ['diagram', 'motion', 'office', 'readme', 'sciviz']);
  const want = bundleHashes(PLUGIN);
  const got = bundleHashes(dest);
  for (const [file, hash] of Object.entries(want)) assert.equal(got[file], hash, file);
});

test('`runtime install all --dry-run` names the five engines and the cache folder each would use', async () => {
  const { env, home } = sandbox();
  const out = collect();
  assert.equal(await runtime({ env, flags: { dryRun: true }, args: ['install', 'all'], print: out.print }), 0);
  for (const name of ['diagram', 'motion', 'office', 'readme', 'sciviz']) {
    assert.ok(out.text().includes(`would install runtime ${name} with `) && out.text().includes(join(home, '.local', 'share', 'litgravity', 'runtime', name)), name);
  }
  assert.deepEqual(readdirSync(home).filter((n) => n === '.local'), [], 'a dry run writes nothing');
});
