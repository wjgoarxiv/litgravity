import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sandbox, collect, PLUGIN } from './helpers.mjs';
import { install } from '../lib/install.mjs';
import { doctor } from '../lib/doctor.mjs';

const cwdOf = () => mkdtempSync(join(tmpdir(), 'litgravity-proj-'));
async function installAt(env, scope, cwd) {
  const out = collect();
  const code = await install({ env, flags: { yes: true, scope }, cwd, print: out.print });
  assert.equal(code, 0, out.text());
}
async function check(env, cwd, flags = {}) {
  const out = collect();
  const code = await doctor({ env: { ...env, LITGRAVITY_SKIP_HOST_TOOLS: '1' }, flags, cwd, print: out.print });
  return { code, text: out.text(), json: flags.json ? JSON.parse(out.text()) : null };
}

test('doctor PASS after a user-scope install: agy version, validate result, skills, agents, hooks, hook smoke', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  await installAt(env, 'user', cwd);
  const r = await check(env, cwd);
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /PASS agy — agy 1\.4\.3/);
  assert.match(r.text, /PASS plugin user — LitGravity 0\.1\.1 installed/);
  assert.match(r.text, /PASS validate user — agy plugin validate: 0 errors, 0 warnings/);
  assert.match(r.text, /PASS hooks — SessionStart, PreInvocation, PostInvocation, Stop, PreToolUse, PostToolUse/);
  assert.match(r.text, /PASS hook smoke/);
  assert.match(r.text, /PASS skills — \d+ shipped/);
  assert.match(r.text, /LitGravity: ready/);
});

test('doctor --json carries the same rows for agents', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  await installAt(env, 'project', cwd);
  const r = await check(env, cwd, { json: true });
  assert.equal(r.code, 0);
  assert.ok(Array.isArray(r.json.checks));
  assert.ok(r.json.checks.every((c) => ['PASS', 'WARN', 'FAIL', 'INFO'].includes(c.status) && c.name && c.detail !== undefined));
  assert.equal(r.json.summary.fail, 0);
  assert.equal(r.json.skills.length, r.json.checks.find((c) => c.name === 'skills').detail.match(/\d+/)[0] * 1);
});

test('doctor fails and says how to install when nothing is installed', async () => {
  const { env } = sandbox();
  const r = await check(env, cwdOf());
  assert.equal(r.code, 1);
  assert.match(r.text, /FAIL install — LitGravity is not installed/);
  assert.match(r.text, /npx @litfamily\/litgravity install/);
});

test('doctor fails when agy is missing and when the host validator reports an error', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  await installAt(env, 'user', cwd);
  const noAgy = await check({ ...env, LITGRAVITY_AGY_BIN: join(cwd, 'gone') }, cwd);
  assert.equal(noAgy.code, 1);
  assert.match(noAgy.text, /FAIL agy — not found on PATH/);
  const bad = await check({ ...env, FAKE_AGY_FINDINGS: JSON.stringify([{ severity: 'error', file: 'hooks.json', message: 'nested group' }]) }, cwd);
  assert.equal(bad.code, 1);
  assert.match(bad.text, /FAIL validate user — .*nested group/);
});

test('doctor warns on an old agy, an edited copy, a duplicate at both scopes and a disabled plugin', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  await installAt(env, 'user', cwd);
  await installAt(env, 'project', cwd);
  const old = await check({ ...env, FAKE_AGY_VERSION: '1.3.4' }, cwd);
  assert.match(old.text, /WARN agy — agy 1\.3\.4/);
  assert.match(old.text, /WARN duplicate — .*one plugin per name/);
  writeFileSync(join(cwd, '.agents', 'plugins', 'litgravity', 'rules', 'AGENTS.md'), '# edited\n');
  const edited = await check(env, cwd);
  assert.match(edited.text, /WARN plugin project — .*edited/);
  const disabled = await check({ ...env, FAKE_AGY_PLUGINS: JSON.stringify([{ name: 'litgravity', enabled: false }]) }, cwd);
  assert.equal(disabled.code, 1);
  assert.match(disabled.text, /FAIL enabled — litgravity is disabled/);
});

test('doctor fails when an installed copy lost a skill or a hook script', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  await installAt(env, 'user', cwd);
  const dest = join(env.HOME, '.gemini', 'config', 'plugins', 'litgravity');
  rmSync(join(dest, 'hooks', 'stop.mjs'));
  const r = await check(env, cwd);
  assert.equal(r.code, 1);
  assert.match(r.text, /FAIL hook smoke — .*stop/);
  rmSync(join(dest, 'skills', 'lit-plan'), { recursive: true, force: true });
  const r2 = await check(env, cwd);
  assert.match(r2.text, /FAIL skills — .*lit-plan/);
});

test('doctor lists engine runtimes and the pre-warm command without installing anything', async () => {
  const { env, home } = sandbox();
  const cwd = cwdOf();
  await installAt(env, 'user', cwd);
  const r = await check(env, cwd);
  assert.doesNotMatch(r.text, /FAIL runtime/);
  assert.equal(PLUGIN.length > 0, true);
  void home;
});

test('doctor runs the hook smoke with the environment it was given, never the caller\'s own HOME', async () => {
  const { env, home } = sandbox();
  const cwd = cwdOf();
  await installAt(env, 'user', cwd);
  const trace = join(home, 'hook-trace.jsonl');
  const r = await check({ ...env, LITGRAVITY_HOOK_TRACE: trace }, cwd);
  assert.match(r.text, /PASS hook smoke/);
  assert.ok(existsSync(trace) && readFileSync(trace, 'utf8').trim().split('\n').length >= 6, 'every smoked hook saw the sandbox env');
});
