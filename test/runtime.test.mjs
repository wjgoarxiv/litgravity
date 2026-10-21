import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sandbox, collect } from './helpers.mjs';
import { runtimeModules, callRuntime, runtime } from '../lib/runtime.mjs';
import { paths } from '../lib/paths.mjs';

// A stand-in engine that follows the contract: `status|install --json` prints {name, ready, cache, missing}.
function fakePlugin() {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-rt-'));
  mkdirSync(join(dir, 'lib'));
  mkdirSync(join(dir, 'skills', 'lit-demo', 'scripts'), { recursive: true });
  const engine = (name) => `
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const cache = join(process.env.XDG_DATA_HOME, 'litgravity', 'runtime', '${name}');
const action = process.argv[2];
if (action === 'install') { mkdirSync(cache, { recursive: true }); writeFileSync(join(cache, 'ready'), '1'); }
const ready = existsSync(join(cache, 'ready'));
console.log(JSON.stringify({ name: '${name}', ready, cache, missing: ready ? [] : ['ready'] }));
`;
  writeFileSync(join(dir, 'lib', 'office-runtime.mjs'), engine('office'));
  writeFileSync(join(dir, 'skills', 'lit-demo', 'scripts', 'demo-runtime.mjs'), engine('demo'));
  return dir;
}

test('runtime modules are found by file name in lib/ and in a skill\'s scripts/', () => {
  const dir = fakePlugin();
  assert.deepEqual(runtimeModules(dir).map((m) => m.name), ['demo', 'office']);
});

test('status reports not-ready, install fills only $XDG_DATA_HOME/litgravity/runtime/<name>, status then reports ready', () => {
  const dir = fakePlugin();
  const { env, home } = sandbox();
  const [demo] = runtimeModules(dir);
  const before = callRuntime(demo, 'status', env);
  assert.equal(before.ready, false);
  assert.ok(before.cache.startsWith(join(paths(env).runtime)));
  const after = callRuntime(demo, 'install', env);
  assert.equal(after.ready, true);
  assert.ok(after.cache.startsWith(join(home, '.local', 'share', 'litgravity', 'runtime', 'demo')));
  assert.equal(callRuntime(demo, 'status', env).ready, true);
});

test('litgravity runtime: usage errors, dry run, json status, install all', async () => {
  const dir = fakePlugin();
  const { env, home } = sandbox();
  const go = async (args, flags = {}) => {
    const out = collect();
    const code = await runtime({ env, flags, args, print: out.print, pluginDir: dir });
    return { code, text: out.text() };
  };
  assert.equal((await go(['install'])).code, 2);
  assert.equal((await go(['status', 'nope'])).code, 2);
  assert.equal((await go(['wat'])).code, 2);
  const dry = await go(['install', 'all'], { dryRun: true });
  assert.equal(dry.code, 0);
  assert.match(dry.text, /would install runtime demo/);
  assert.match(await go(['status']).then((r) => r.text), /demo: not ready \(missing: ready\)/);
  const all = await go(['install', 'all']);
  assert.equal(all.code, 0, all.text);
  const json = JSON.parse((await go(['status'], { json: true })).text);
  assert.deepEqual(json.runtimes.map((r) => [r.name, r.ready]), [['demo', true], ['office', true]]);
  void home;
});

test('a runtime that crashes or prints junk is reported as an error, not a pass', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-rt-'));
  mkdirSync(join(dir, 'lib'));
  writeFileSync(join(dir, 'lib', 'bad-runtime.mjs'), 'console.log("not json"); process.exit(3);');
  const { env } = sandbox();
  const r = callRuntime(runtimeModules(dir)[0], 'status', env);
  assert.equal(r.ready, false);
  assert.ok(r.error);
});
