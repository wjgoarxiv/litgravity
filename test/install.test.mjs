import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync, lstatSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sandbox, collect, agyCalls, walk, PLUGIN } from './helpers.mjs';
import { install } from '../lib/install.mjs';
import { uninstall } from '../lib/uninstall.mjs';
import { paths } from '../lib/paths.mjs';
import { bundleHashes, OWNER_FILE, destState } from '../lib/bundle.mjs';

function project() {
  return mkdtempSync(join(tmpdir(), 'litgravity-proj-'));
}
const run = (env, flags, cwd, interactive = false) => {
  const out = collect();
  return install({ env, flags, interactive, cwd, print: out.print }).then((code) => ({ code, text: out.text() }));
};

test('dry run lists every destination and writes nothing, at both scopes', async () => {
  for (const scope of ['project', 'user']) {
    const { env, home } = sandbox();
    const cwd = project();
    const r = await run(env, { dryRun: true, scope }, cwd);
    assert.equal(r.code, 0);
    assert.match(r.text, /Dry run: no files written/);
    assert.match(r.text, scope === 'project' ? /\.agents\/plugins\/litgravity/ : /\.gemini\/config\/plugins\/litgravity/);
    assert.deepEqual(walk(home).filter((p) => !p.startsWith('agy-calls')), []);
    assert.deepEqual(walk(cwd), []);
    assert.ok(!agyCalls(env).some((c) => c.args[0] === 'plugin' && ['install', 'enable', 'import'].includes(c.args[1])), 'no mutating agy call');
  }
});

test('a shell without a terminal writes nothing until --yes', async () => {
  const { env, home } = sandbox();
  const cwd = project();
  const r = await run(env, { scope: 'project' }, cwd, false);
  assert.equal(r.code, 0);
  assert.match(r.text, /Rerun with --yes/);
  assert.deepEqual(walk(cwd), []);
  assert.deepEqual(walk(home).filter((p) => !p.startsWith('agy-calls')), []);
});

test('project scope installs an owned copy under .agents/plugins/litgravity and validates it', async () => {
  const { env, home } = sandbox();
  const cwd = project();
  const r = await run(env, { yes: true, scope: 'project' }, cwd);
  assert.equal(r.code, 0, r.text);
  const dest = join(cwd, '.agents', 'plugins', 'litgravity');
  for (const f of ['plugin.json', 'hooks.json', 'rules/AGENTS.md', 'hooks/pre-invocation.mjs', OWNER_FILE]) assert.ok(existsSync(join(dest, f)), f);
  assert.equal(destState(dest).state, 'owned');
  const owner = JSON.parse(readFileSync(join(dest, OWNER_FILE), 'utf8'));
  assert.equal(owner.product, 'litgravity');
  assert.deepEqual(owner.files, bundleHashes(PLUGIN));
  assert.match(r.text, /Status: Ready/);
  const validates = agyCalls(env).filter((c) => c.args[0] === 'plugin' && c.args[1] === 'validate');
  assert.ok(validates.length >= 2, 'source and installed copy are validated');
  assert.equal(existsSync(join(home, '.gemini')), false, 'project scope touches nothing under the user home');
  assert.ok(existsSync(paths(env).receipt));
});

test('user scope installs under ~/.gemini/config/plugins/litgravity and nothing else under ~/.gemini', async () => {
  const { env, home } = sandbox();
  const cwd = project();
  const r = await run(env, { yes: true, scope: 'user' }, cwd);
  assert.equal(r.code, 0, r.text);
  const dest = join(home, '.gemini', 'config', 'plugins', 'litgravity');
  assert.equal(destState(dest).state, 'owned');
  const under = walk(join(home, '.gemini')).filter((p) => !p.startsWith(join('config', 'plugins', 'litgravity')) && p !== 'config' && p !== join('config', 'plugins'));
  assert.deepEqual(under, [], 'only the plugin folder is written');
  assert.deepEqual(walk(cwd), []);
  assert.ok(!existsSync(join(home, '.gemini', 'antigravity-cli')), 'no status line without the flag');
});

test('a second install replaces its own copy; an edited copy fails closed with the remedy', async () => {
  const { env } = sandbox();
  const cwd = project();
  assert.equal((await run(env, { yes: true, scope: 'project' }, cwd)).code, 0);
  assert.equal((await run(env, { yes: true, scope: 'project' }, cwd)).code, 0);
  const dest = join(cwd, '.agents', 'plugins', 'litgravity');
  writeFileSync(join(dest, 'rules', 'AGENTS.md'), '# my edit\n');
  const r = await run(env, { yes: true, scope: 'project' }, cwd);
  assert.equal(r.code, 1);
  assert.match(r.text, /destination modified/);
  assert.match(r.text, /mv "/);
  assert.match(r.text, /No files written/);
  assert.equal(readFileSync(join(dest, 'rules', 'AGENTS.md'), 'utf8'), '# my edit\n');
});

test('a foreign folder at the destination fails closed and is left alone', async () => {
  const { env } = sandbox();
  const cwd = project();
  const dest = join(cwd, '.agents', 'plugins', 'litgravity');
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, 'plugin.json'), '{"name":"litgravity"}');
  const r = await run(env, { yes: true, scope: 'project' }, cwd);
  assert.equal(r.code, 1);
  assert.match(r.text, /destination foreign/);
  assert.deepEqual(walk(dest), ['plugin.json']);
});

test('a symlinked destination, parent or file fails closed before the first write', async () => {
  for (const make of [
    (cwd, real) => { mkdirSync(join(cwd, '.agents', 'plugins'), { recursive: true }); symlinkSync(real, join(cwd, '.agents', 'plugins', 'litgravity')); },
    (cwd, real) => { mkdirSync(join(cwd, '.agents'), { recursive: true }); symlinkSync(real, join(cwd, '.agents', 'plugins')); },
  ]) {
    const { env } = sandbox();
    const cwd = project();
    const real = mkdtempSync(join(tmpdir(), 'litgravity-real-'));
    make(cwd, real);
    const r = await run(env, { yes: true, scope: 'project' }, cwd);
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /destination symlinked/);
    assert.match(r.text, /rm "/);
    assert.deepEqual(walk(real), [], 'nothing written through the link');
  }
  const { env, home } = sandbox();
  const cwd = project();
  assert.equal((await run(env, { yes: true, scope: 'project' }, cwd)).code, 0);
  const dest = join(cwd, '.agents', 'plugins', 'litgravity');
  symlinkSync(join(dest, 'plugin.json'), join(dest, 'extra.json'));
  const again = await run(env, { yes: true, scope: 'project' }, cwd);
  assert.equal(again.code, 1);
  assert.match(again.text, /symlinked/);
  void home;
});

test('refuses to write under another tool\'s home', async () => {
  const { env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-'));
  const foreign = join(cwd, '.claude');
  mkdirSync(foreign);
  const r = await run(env, { yes: true, scope: 'project' }, foreign);
  assert.equal(r.code, 1);
  assert.match(r.text, /never writes under \.claude/);
});

test('install fails clearly when agy is not found and when the host validator reports an error', async () => {
  const { env } = sandbox();
  const cwd = project();
  const missing = await run({ ...env, LITGRAVITY_AGY_BIN: join(cwd, 'no-such-agy') }, { yes: true, scope: 'project' }, cwd);
  assert.equal(missing.code, 1);
  assert.match(missing.text, /agy was not found on PATH/);
  const bad = await run({ ...env, FAKE_AGY_FINDINGS: JSON.stringify([{ severity: 'error', file: 'hooks.json', message: 'broken' }]) }, { yes: true, scope: 'project' }, cwd);
  assert.equal(bad.code, 1);
  assert.match(bad.text, /agy plugin validate rejected/);
  assert.match(bad.text, /broken/);
  assert.deepEqual(walk(cwd), [], 'nothing installed after a rejected validation');
});

test('--status-line is opt-in, user scope only, backs up settings, and refuses a foreign status line', async () => {
  const { env, home } = sandbox();
  const cwd = project();
  const settings = join(home, '.gemini', 'antigravity-cli', 'settings.json');
  const projectScope = await run(env, { yes: true, scope: 'project', statusLine: true }, cwd);
  assert.equal(projectScope.code, 1);
  assert.match(projectScope.text, /--status-line needs --scope user/);

  mkdirSync(join(home, '.gemini', 'antigravity-cli'), { recursive: true });
  writeFileSync(settings, JSON.stringify({ model: 'x', statusLine: { type: 'command', command: 'some-other-hud' } }));
  const foreign = await run(env, { yes: true, scope: 'user', statusLine: true }, cwd);
  assert.equal(foreign.code, 1);
  assert.match(foreign.text, /already has a status line/);
  assert.equal(JSON.parse(readFileSync(settings, 'utf8')).statusLine.command, 'some-other-hud');
  assert.ok(!existsSync(join(home, '.gemini', 'config', 'plugins', 'litgravity')), 'checked before any write');

  writeFileSync(settings, JSON.stringify({ model: 'x' }));
  const ok = await run(env, { yes: true, scope: 'user', statusLine: true }, cwd);
  assert.equal(ok.code, 0, ok.text);
  const after = JSON.parse(readFileSync(settings, 'utf8'));
  assert.equal(after.model, 'x');
  assert.match(after.statusLine.command, /hud\/statusline\.mjs/);
  assert.equal(after.statusLine.type, 'command');
  assert.ok(walk(paths(env).backups).some((f) => f.startsWith('settings.json.')), 'settings backed up');

  const out = collect();
  await uninstall({ env, flags: { yes: true, scope: 'user' }, cwd, print: out.print });
  assert.equal('statusLine' in JSON.parse(readFileSync(settings, 'utf8')), false, 'our status line removed');
  assert.equal(JSON.parse(readFileSync(settings, 'utf8')).model, 'x');
});

test('--replace-status-line swaps a foreign status line, keeps a timestamped backup, and uninstall puts the old one back', async () => {
  const { env, home } = sandbox();
  const cwd = project();
  const settings = join(home, '.gemini', 'antigravity-cli', 'settings.json');
  const previous = { type: 'command', command: '/home/me/.gemini/antigravity-cli/old-hud.sh', enabled: true, padding: 1 };
  mkdirSync(join(home, '.gemini', 'antigravity-cli'), { recursive: true });
  writeFileSync(settings, JSON.stringify({ model: 'x', statusLine: previous }));

  const refused = await run(env, { yes: true, scope: 'user', statusLine: true }, cwd);
  assert.equal(refused.code, 1);
  assert.match(refused.text, /--replace-status-line/, 'the refusal names the way through');

  const dry = await run(env, { dryRun: true, scope: 'user', statusLine: true, replaceStatusLine: true }, cwd);
  assert.equal(dry.code, 0, dry.text);
  assert.match(dry.text, /replace the status line .*old-hud\.sh/);
  assert.deepEqual(JSON.parse(readFileSync(settings, 'utf8')).statusLine, previous, 'dry run changes nothing');

  const ok = await run(env, { yes: true, scope: 'user', statusLine: true, replaceStatusLine: true }, cwd);
  assert.equal(ok.code, 0, ok.text);
  const after = JSON.parse(readFileSync(settings, 'utf8'));
  assert.match(after.statusLine.command, /hud\/statusline\.mjs/);
  assert.equal(after.model, 'x');
  const backups = walk(paths(env).backups);
  const bak = backups.find((f) => /^settings\.json\..+\.bak$/.test(f));
  assert.ok(bak, `timestamped backup: ${backups}`);
  assert.deepEqual(JSON.parse(readFileSync(join(paths(env).backups, bak), 'utf8')).statusLine, previous);
  assert.deepEqual(JSON.parse(readFileSync(join(paths(env).backups, 'statusline-replaced.json'), 'utf8')).statusLine, previous);

  const again = await run(env, { yes: true, scope: 'user', statusLine: true, replaceStatusLine: true }, cwd);
  assert.equal(again.code, 0, again.text);
  assert.deepEqual(JSON.parse(readFileSync(join(paths(env).backups, 'statusline-replaced.json'), 'utf8')).statusLine, previous, 'a reinstall keeps the original');

  const out = collect();
  await uninstall({ env, flags: { yes: true, scope: 'user' }, cwd, print: out.print });
  assert.match(out.text(), /Restored the previous status line/);
  const restored = JSON.parse(readFileSync(settings, 'utf8'));
  assert.deepEqual(restored.statusLine, previous);
  assert.equal(restored.model, 'x');
  assert.ok(!existsSync(join(paths(env).backups, 'statusline-replaced.json')), 'the restore record is used up');
});

test('uninstall leaves a status line the user changed after a replace alone', async () => {
  const { env, home } = sandbox();
  const cwd = project();
  const settings = join(home, '.gemini', 'antigravity-cli', 'settings.json');
  mkdirSync(join(home, '.gemini', 'antigravity-cli'), { recursive: true });
  writeFileSync(settings, JSON.stringify({ statusLine: { type: 'command', command: 'old-hud' } }));
  assert.equal((await run(env, { yes: true, scope: 'user', statusLine: true, replaceStatusLine: true }, cwd)).code, 0);
  writeFileSync(settings, JSON.stringify({ statusLine: { type: 'command', command: 'newer-hud' } }));
  const out = collect();
  await uninstall({ env, flags: { yes: true, scope: 'user' }, cwd, print: out.print });
  assert.equal(JSON.parse(readFileSync(settings, 'utf8')).statusLine.command, 'newer-hud');
});

test('uninstall removes only what the installer wrote and keeps edited copies unless told otherwise', async () => {
  const { env, home } = sandbox();
  const cwd = project();
  await run(env, { yes: true, scope: 'project' }, cwd);
  await run(env, { yes: true, scope: 'user' }, cwd);
  const mine = join(cwd, '.agents', 'plugins', 'litgravity');
  const sibling = join(cwd, '.agents', 'plugins', 'other-plugin');
  mkdirSync(sibling);
  writeFileSync(join(sibling, 'plugin.json'), '{"name":"other-plugin"}');

  const dry = collect();
  assert.equal(await uninstall({ env, flags: { dryRun: true }, cwd, print: dry.print }), 0);
  assert.match(dry.text(), /Dry run: nothing removed/);
  assert.ok(existsSync(mine));

  writeFileSync(join(mine, 'rules', 'AGENTS.md'), '# edited\n');
  const keep = collect();
  assert.equal(await uninstall({ env, flags: { yes: true }, cwd, print: keep.print }), 0);
  assert.ok(existsSync(mine), 'edited copy kept');
  assert.match(keep.text(), /keep .*modified/);
  assert.ok(!existsSync(join(home, '.gemini', 'config', 'plugins', 'litgravity')), 'untouched user copy removed');
  assert.ok(existsSync(sibling), 'a neighbour is never touched');

  const discard = collect();
  assert.equal(await uninstall({ env, flags: { yes: true, discardModified: true }, cwd, print: discard.print }), 0);
  assert.ok(!existsSync(mine));
  assert.ok(existsSync(sibling));
  assert.ok(lstatSync(join(cwd, '.agents', 'plugins')).isDirectory());
});

test('uninstall without --yes in a shell without a terminal removes nothing', async () => {
  const { env } = sandbox();
  const cwd = project();
  await run(env, { yes: true, scope: 'project' }, cwd);
  const out = collect();
  assert.equal(await uninstall({ env, flags: {}, cwd, interactive: false, print: out.print }), 0);
  assert.match(out.text(), /Rerun with --yes/);
  assert.ok(existsSync(join(cwd, '.agents', 'plugins', 'litgravity')));
});

test('a status line settings file that is a link fails closed before the plugin is written, with the fix', async () => {
  const { env, home } = sandbox();
  const cwd = project();
  const real = join(mkdtempSync(join(tmpdir(), 'litgravity-dotfiles-')), 'settings.json');
  writeFileSync(real, '{}\n');
  mkdirSync(join(home, '.gemini', 'antigravity-cli'), { recursive: true });
  symlinkSync(real, join(home, '.gemini', 'antigravity-cli', 'settings.json'));
  const r = await run(env, { yes: true, scope: 'user', statusLine: true }, cwd);
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /FAIL status line: .*link/);
  assert.match(r.text, /No files written/);
  assert.ok(!existsSync(join(home, '.gemini', 'config', 'plugins', 'litgravity')), 'plugin not written');
  assert.equal(readFileSync(real, 'utf8'), '{}\n');
});

test('a copy that fails half way leaves no temporary plugin folder beside the destination', async () => {
  const { stageTo } = await import('../lib/bundle.mjs');
  const src = mkdtempSync(join(tmpdir(), 'litgravity-src-'));
  writeFileSync(join(src, 'plugin.json'), '{"name":"litgravity","version":"0.0.0"}');
  writeFileSync(join(src, 'locked.txt'), 'x');
  chmodSync(join(src, 'locked.txt'), 0o000);
  const parent = mkdtempSync(join(tmpdir(), 'litgravity-plugins-'));
  assert.throws(() => stageTo(join(parent, 'litgravity'), src));
  chmodSync(join(src, 'locked.txt'), 0o644);
  assert.deepEqual(walk(parent), [], 'no litgravity.tmp-* left for agy to load as a second plugin');
});

test('uninstall in a terminal asks first and removes nothing on no', async () => {
  const { env } = sandbox();
  const cwd = project();
  await run(env, { yes: true, scope: 'project' }, cwd);
  const out = collect();
  const asked = [];
  assert.equal(await uninstall({ env, flags: {}, cwd, interactive: true, ask: async (q) => { asked.push(q); return false; }, print: out.print }), 0);
  assert.equal(asked.length, 1);
  assert.ok(existsSync(join(cwd, '.agents', 'plugins', 'litgravity')));
});
