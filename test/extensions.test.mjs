import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { sandbox, collect, workspace, runHook, basePayload, injected, PLUGIN } from './helpers.mjs';
import { install } from '../lib/install.mjs';
import { doctor } from '../lib/doctor.mjs';
import { list } from '../lib/list.mjs';
import { paths } from '../lib/paths.mjs';
import { destState } from '../lib/bundle.mjs';
import { MOVED_SKILLS, extensionLines } from '../plugin/hooks/lib/routes.mjs';
import { activation } from '../plugin/hooks/lib/reentry.mjs';

// The nine file-making skills are LitFamily extensions now. A user hears it twice: in the install or update output,
// and once in the first agy conversation after it. Machine-readable output never carries it.
const SHELF = 'https://github.com/wjgoarxiv/wjgoarxiv-skills';
const HEAD = /^LitFamily extensions$/m;
const cwdOf = () => mkdtempSync(join(tmpdir(), 'litgravity-proj-'));
async function run(env, flags, cwd) {
  const out = collect();
  const code = await install({ env, flags, cwd, print: out.print });
  return { code, text: out.text() };
}
async function check(env, cwd, flags = {}) {
  const out = collect();
  const code = await doctor({ env: { ...env, LITGRAVITY_SKIP_HOST_TOOLS: '1' }, flags: { offline: true, ...flags }, cwd, print: out.print });
  return { code, text: out.text() };
}
const startText = (env) => injected(runHook('session-start', basePayload(workspace()), env));

test('install prints the extensions notice after it succeeds: core complete, the shelf and the install line', async () => {
  const { env } = sandbox();
  const r = await run(env, { yes: true, scope: 'user' }, cwdOf());
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, HEAD);
  const notice = r.text.slice(r.text.search(HEAD));
  assert.match(notice, /complete and works on its own/);
  assert.match(notice, /LitFamily extensions/);
  assert.ok(notice.includes(SHELF), 'names the extension shelf');
  assert.ok(notice.includes(`git clone ${SHELF}`), 'gives the clone line');
  for (const line of extensionLines('<id>')) assert.ok(notice.includes(line), 'gives the same install lines the stubs print');
  assert.match(notice, /full LitFamily experience/);
  assert.doesNotMatch(notice, /runtime/, 'a fresh install has nothing left behind to mention');
  const lines = notice.split('\n').filter(Boolean);
  assert.ok(notice.includes('npx @litfamily/litgravity extensions install <id>'), 'names the command route first');
  assert.ok(lines.length >= 5 && lines.length <= 12, `${lines.length} lines`);
});

test('an update over an old release also names the engine cache it left behind, with its exact path', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  const runtime = join(paths(env, cwd).data, 'runtime');
  mkdirSync(join(runtime, 'office'), { recursive: true });
  const r = await run(env, { yes: true, scope: 'user' }, cwd);
  assert.equal(r.code, 0, r.text);
  const notice = r.text.slice(r.text.search(HEAD));
  assert.ok(notice.includes(runtime), notice);
  assert.match(notice, /delete/);
  assert.ok(existsSync(join(runtime, 'office')), 'the installer itself deletes nothing');
});

test('no notice on a dry run, in a shell without --yes, or when the install fails closed', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  assert.doesNotMatch((await run(env, { dryRun: true, scope: 'user' }, cwd)).text, HEAD);
  assert.doesNotMatch((await run(env, { scope: 'user' }, cwd)).text, HEAD);
  assert.equal(startText(env).includes(SHELF), false, 'nothing queued for a session either');
  assert.equal((await run(env, { yes: true, scope: 'user' }, cwd)).code, 0);
  writeFileSync(join(paths(env, cwd).userPlugin, 'rules', 'AGENTS.md'), '# my edit\n');
  const refused = await run(env, { yes: true, scope: 'user' }, cwd);
  assert.equal(refused.code, 1);
  assert.doesNotMatch(refused.text, HEAD);
});

test('the first agy conversation after an install carries the notice once; the next one does not', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  const runtime = join(paths(env, cwd).data, 'runtime');
  mkdirSync(runtime, { recursive: true });
  assert.equal((await run(env, { yes: true, scope: 'user' }, cwd)).code, 0);
  const first = startText(env);
  assert.ok(first.includes(SHELF), first);
  for (const line of extensionLines('<id>')) assert.ok(first.includes(line));
  assert.match(first, /complete and works on its own/);
  assert.ok(first.includes(runtime), 'the leftover path rides along on an update');
  assert.match(first, /first reply/);
  assert.match(first, /once/i);
  const second = startText(env);
  assert.equal(second.includes(SHELF), false, 'shown once');
  assert.match(second, /LitGravity routes/, 'the rest of the session context is unchanged');
  assert.equal((await run(env, { yes: true, scope: 'user' }, cwd)).code, 0);
  assert.ok(startText(env).includes(SHELF), 'the next update queues it again');
});

test('the doctor hook smoke and an empty payload never use up the first-session notice', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  assert.equal((await run(env, { yes: true, scope: 'user' }, cwd)).code, 0);
  runHook('session-start', {}, env);
  const r = await check(env, cwd);
  assert.match(r.text, /PASS hook smoke/);
  assert.ok(startText(env).includes(SHELF), 'still pending for the real first conversation');
});

test('machine-readable output never carries the notice', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  mkdirSync(join(paths(env, cwd).data, 'runtime'), { recursive: true });
  assert.equal((await run(env, { yes: true, scope: 'user' }, cwd)).code, 0);
  const d = await check(env, cwd, { json: true });
  JSON.parse(d.text);
  assert.doesNotMatch(d.text, /complete and works on its own|full LitFamily experience/);
  const l = collect();
  list({ flags: { json: true }, print: l.print });
  JSON.parse(l.text());
  assert.doesNotMatch(l.text(), /complete and works on its own|full LitFamily experience/);
});

// Must fix: the keep-your-edits remedy used to say `mv <dest> <dest>.saved-DATE`, a sibling inside agy's plugins
// folder, which agy loads as a second live plugin. The save location now sits in LitGravity's data folder.
function printedMove(text) {
  const m = /mkdir -p "([^"]+)" && mv "([^"]+)" "([^"]+)"/.exec(text);
  assert.ok(m, text);
  return { dir: m[1], from: m[2], to: m[3] };
}

for (const scope of ['user', 'project']) {
  test(`${scope} scope: the keep-your-edits remedy saves outside the plugins folder, and following it keeps the edit`, async () => {
    const { env } = sandbox();
    const cwd = cwdOf();
    const p = paths(env, cwd);
    const dest = scope === 'user' ? p.userPlugin : p.projectPlugin;
    assert.equal((await run(env, { yes: true, scope }, cwd)).code, 0);
    const edit = join(dest, 'skills', 'lit-pptx', 'my-notes.md');
    writeFileSync(edit, 'my notes\n');
    const refused = await run(env, { yes: true, scope }, cwd);
    assert.equal(refused.code, 1);
    assert.doesNotMatch(refused.text, /\.saved-/);
    const move = printedMove(refused.text);
    assert.equal(move.from, dest);
    assert.ok(move.to.startsWith(join(p.data, 'saved') + '/'), move.to);
    assert.ok(!move.to.startsWith(dirname(dest)), 'never beside the plugin');
    mkdirSync(move.dir, { recursive: true });
    renameSync(move.from, move.to);
    const again = await run(env, { yes: true, scope }, cwd);
    assert.equal(again.code, 0, again.text);
    assert.deepEqual(readdirSync(dirname(dest)), ['litgravity'], 'agy sees one LitGravity plugin');
    assert.equal(destState(dest).state, 'owned');
    assert.equal(readFileSync(join(move.to, 'skills', 'lit-pptx', 'my-notes.md'), 'utf8'), 'my notes\n', 'the edit survives in the saved copy');
  });
}

test('the foreign-folder remedy also saves outside the plugins folder', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  const p = paths(env, cwd);
  mkdirSync(p.userPlugin, { recursive: true });
  writeFileSync(join(p.userPlugin, 'plugin.json'), '{"name":"litgravity"}');
  const r = await run(env, { yes: true, scope: 'user' }, cwd);
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.text, /\.saved-/);
  assert.ok(printedMove(r.text).to.startsWith(join(p.data, 'saved') + '/'));
});

test('doctor warns about a saved copy left inside the plugins folder, which agy loads as a second plugin', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  const p = paths(env, cwd);
  assert.equal((await run(env, { yes: true, scope: 'user' }, cwd)).code, 0);
  const stale = join(dirname(p.userPlugin), 'litgravity.saved-2026-11-12');
  mkdirSync(stale);
  writeFileSync(join(stale, 'plugin.json'), '{"name":"litgravity"}');
  const r = await check(env, cwd);
  assert.match(r.text, /WARN extra plugin — /);
  assert.ok(r.text.includes(stale), r.text);
  assert.ok(r.text.includes(join(p.data, 'saved')), 'the fix moves it under the data folder');
});

test('doctor names the engine cache old releases left behind, and says nothing when there is none', async () => {
  const { env } = sandbox();
  const cwd = cwdOf();
  assert.equal((await run(env, { yes: true, scope: 'user' }, cwd)).code, 0);
  assert.doesNotMatch((await check(env, cwd)).text, /old engines/);
  const runtime = join(paths(env, cwd).data, 'runtime');
  mkdirSync(join(runtime, 'office'), { recursive: true });
  const r = await check(env, cwd);
  assert.match(r.text, /INFO old engines — /);
  assert.ok(r.text.includes(runtime), r.text);
  assert.ok(r.text.includes(`fix: rm -rf "${runtime}"`), r.text);
  assert.match(r.text, /LitGravity: ready/, 'a leftover cache is no problem');
});

test('each stub and the router call the moved skill a LitFamily extension', () => {
  for (const id of Object.keys(MOVED_SKILLS)) {
    const md = readFileSync(join(PLUGIN, 'skills', id, 'SKILL.md'), 'utf8');
    assert.match(md, /^description: "[^"\n]*A LitFamily extension in wjgoarxiv-skills[^"\n]*"$/m, id);
    assert.ok(md.includes(`# ${id}: a LitFamily extension in wjgoarxiv-skills\n`), id);
    assert.ok(md.includes('that it is a LitFamily extension now'), `${id}: the reply to the user says so`);
    assert.ok(activation({ route: id }, 'conv-1').includes(`\`${id}\` is a LitFamily extension now`), `${id}: router note`);
  }
});
