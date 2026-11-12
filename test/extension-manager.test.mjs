import test, { mock } from 'node:test';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sandbox, collect, walk, workspace, runHook, basePayload, injected, PLUGIN, ROOT } from './helpers.mjs';
import { extensions, RECEIPT, treeHash } from '../lib/extension-manager.mjs';
import { install } from '../lib/install.mjs';
import { doctor } from '../lib/doctor.mjs';
import { MOVED_SKILLS, EXTENSIONS_CLI } from '../plugin/hooks/lib/routes.mjs';

// `litgravity extensions <verb>` does the stubs' four lines in code: look for every same-name skill agy loads, move an
// existing copy whole into ~/.gemini/extension-backups/<stamp>[-project]/<id>, copy into the emptied place, write the
// receipt. Each test runs in a throwaway HOME and workspace, against a fake wjgoarxiv-skills clone.

const IDS = Object.keys(MOVED_SKILLS);

function fakeShelf(marker = 'v1', ids = IDS) {
  const root = mkdtempSync(join(tmpdir(), 'wjgoarxiv-skills-'));
  for (const id of ids) {
    const dir = join(root, 'variants', 'litgravity', id);
    mkdirSync(join(dir, 'references'), { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${id}\ndescription: "${id} ${marker}"\n---\n\n# ${id}\n`);
    writeFileSync(join(dir, 'references', 'guide.md'), `guide ${marker}\n`);
  }
  return root;
}

function setup() {
  const { home, env } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-ws-'));
  return { home, env, cwd, user: join(home, '.gemini', 'config', 'skills'), backups: join(home, '.gemini', 'extension-backups') };
}

async function ext(s, args, flags = {}) {
  const out = collect();
  const code = await extensions({ env: s.env, args, flags, cwd: s.cwd, print: out.print });
  return { code, text: out.text() };
}

const skill = (dir, name, extra = '') => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: "${extra || 'mine'}"\n---\n`);
  return dir;
};
const backupsOf = (s) => (existsSync(s.backups) ? readdirSync(s.backups) : []);

test('install is a dry run until --yes, then copies the skill and writes a receipt; list shows it installed', async () => {
  const s = setup();
  const shelf = fakeShelf();
  const dry = await ext(s, ['install', 'lit-pptx'], { from: shelf });
  assert.equal(dry.code, 0, dry.text);
  assert.match(dry.text, /check +no other same-name skill/);
  assert.match(dry.text, /copy +.*variants\/litgravity\/lit-pptx -> ~\/\.gemini\/config\/skills\/lit-pptx/);
  assert.match(dry.text, /Dry run: nothing written\. Add --yes/);
  assert.ok(!existsSync(s.user), 'a dry run writes nothing');

  const r = await ext(s, ['install', 'lit-pptx'], { from: shelf, yes: true });
  assert.equal(r.code, 0, r.text);
  const dest = join(s.user, 'lit-pptx');
  assert.deepEqual(walk(dest).sort(), [RECEIPT, 'SKILL.md', 'references', 'references/guide.md'].sort());
  const receipt = JSON.parse(readFileSync(join(dest, RECEIPT), 'utf8'));
  assert.deepEqual(Object.keys(receipt).slice(0, 4), ['id', 'source', 'variant', 'installed_at'], 'the A receipt keys come first');
  assert.equal(receipt.id, 'lit-pptx');
  assert.equal(receipt.variant, 'litgravity');
  assert.equal(receipt.source, join(shelf, 'variants', 'litgravity', 'lit-pptx'));
  assert.equal(receipt.hash, treeHash(join(shelf, 'variants', 'litgravity', 'lit-pptx')).hash);
  assert.deepEqual(backupsOf(s), [], 'nothing was there, so nothing moved');
  assert.deepEqual(readdirSync(s.user), ['lit-pptx'], 'no temp folder left beside it');

  const list = await ext(s, ['list'], { json: true });
  const row = JSON.parse(list.text).extensions.find((x) => x.id === 'lit-pptx');
  assert.equal(row.user.state, 'installed');
  assert.equal(row.user.variant, 'litgravity');
  assert.ok(row.user.installed_at && row.user.source);
  assert.equal(JSON.parse(list.text).extensions.find((x) => x.id === 'lit-docx').user.state, 'absent');
});

test('install over an existing folder moves it whole into a dated backup and leaves one live copy', async () => {
  const s = setup();
  const shelf = fakeShelf('new');
  const old = skill(join(s.user, 'lit-pptx'), 'lit-pptx', 'OLD COPY');
  mkdirSync(join(old, 'mine'));
  writeFileSync(join(old, 'mine', 'notes.md'), 'keep me\n');
  const list = await ext(s, ['list']);
  assert.match(list.text, /lit-pptx \[decks\]\n {2}user +user-managed/);
  const r = await ext(s, ['install', 'lit-pptx'], { from: shelf, yes: true });
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /move +~\/\.gemini\/config\/skills\/lit-pptx -> ~\/\.gemini\/extension-backups\/\d{8}-\d{6}\/lit-pptx \(a folder without a receipt, kept whole\)/);
  const [stamp] = backupsOf(s);
  assert.match(stamp, /^\d{8}-\d{6}$/);
  assert.equal(readFileSync(join(s.backups, stamp, 'lit-pptx', 'mine', 'notes.md'), 'utf8'), 'keep me\n', 'the user files are intact');
  const live = join(s.user, 'lit-pptx');
  assert.ok(!existsSync(join(live, 'mine')), 'the new copy is clean');
  assert.match(readFileSync(join(live, 'SKILL.md'), 'utf8'), /lit-pptx new/);
  assert.deepEqual(readdirSync(s.user), ['lit-pptx'], 'one live copy, no .bak sibling');
});

test('a same-name skill in another folder agy loads stops the install and is named; --allow-shadow only warns', async () => {
  const s = setup();
  const shelf = fakeShelf();
  const mine = skill(join(s.home, '.gemini', 'skills', 'my-deck'), 'lit-pptx');
  const ws = skill(join(s.cwd, '_agents', 'skills', 'lit-pptx.bak'), 'lit-pptx');
  const r = await ext(s, ['install', 'lit-pptx', 'lit-docx'], { from: shelf, yes: true });
  assert.equal(r.code, 1, r.text);
  assert.ok(r.text.includes(mine) && r.text.includes(ws), r.text);
  assert.match(r.text, /Stopped before writing anything: lit-pptx needs attention/);
  assert.ok(!existsSync(s.user), 'nothing written, lit-docx included');
  assert.ok(existsSync(join(mine, 'SKILL.md')) && existsSync(join(ws, 'SKILL.md')), 'the other skills are never touched');

  const listed = JSON.parse((await ext(s, ['list'], { json: true })).text).extensions.find((x) => x.id === 'lit-pptx');
  assert.deepEqual(listed.competing.sort(), [mine, ws].sort());
  const chk = await ext(s, ['check']);
  assert.equal(chk.code, 1, chk.text);
  assert.match(chk.text, /ACTION lit-pptx: two same-name skills agy loads/);
  assert.match(chk.text, /fix: b=~\/\.gemini\/extension-backups\/\$\(date \+%Y%m%d-%H%M%S\)-manual; mkdir -p "\$b" && mv "/);

  const shadow = await ext(s, ['install', 'lit-pptx'], { from: shelf, yes: true, allowShadow: true });
  assert.equal(shadow.code, 0, shadow.text);
  assert.match(shadow.text, /WARN +another skill named lit-pptx at /);
  assert.ok(existsSync(join(s.user, 'lit-pptx', RECEIPT)));
  assert.ok(existsSync(join(mine, 'SKILL.md')), 'still untouched');
});

test('update reports current, then reinstalls with a new backup when the source changed', async () => {
  const s = setup();
  const shelf = fakeShelf('v1', ['lit-pptx']);
  await ext(s, ['install', 'lit-pptx'], { from: shelf, yes: true });
  const same = await ext(s, ['update'], { from: shelf, yes: true });
  assert.equal(same.code, 0, same.text);
  assert.match(same.text, /lit-pptx: current/);
  assert.deepEqual(backupsOf(s), []);

  writeFileSync(join(shelf, 'variants', 'litgravity', 'lit-pptx', 'references', 'guide.md'), 'guide v2\n');
  const dry = await ext(s, ['update', 'lit-pptx'], { from: shelf });
  assert.match(dry.text, /lit-pptx \(the source changed\)/);
  assert.match(dry.text, /Dry run: nothing written/);
  assert.equal(readFileSync(join(s.user, 'lit-pptx', 'references', 'guide.md'), 'utf8'), 'guide v1\n');
  const before = JSON.parse(readFileSync(join(s.user, 'lit-pptx', RECEIPT), 'utf8'));
  const r = await ext(s, ['update'], { from: shelf, yes: true });
  assert.equal(r.code, 0, r.text);
  assert.equal(readFileSync(join(s.user, 'lit-pptx', 'references', 'guide.md'), 'utf8'), 'guide v2\n');
  const after = JSON.parse(readFileSync(join(s.user, 'lit-pptx', RECEIPT), 'utf8'));
  assert.notEqual(after.hash, before.hash);
  const [stamp] = backupsOf(s);
  assert.equal(readFileSync(join(s.backups, stamp, 'lit-pptx', 'references', 'guide.md'), 'utf8'), 'guide v1\n');
});

test('update reads a receipt written by the four hand lines (no hash) by hashing the installed copy', async () => {
  const s = setup();
  const shelf = fakeShelf('v1', ['lit-docx']);
  await ext(s, ['install', 'lit-docx'], { from: shelf, yes: true });
  const file = join(s.user, 'lit-docx', RECEIPT);
  const { id, source, variant, installed_at: at } = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, `${JSON.stringify({ id, source, variant, installed_at: at })}\n`);
  assert.match((await ext(s, ['update'], { from: shelf })).text, /lit-docx: current/);
});

test('remove refuses a folder without a receipt and moves an installed copy into the backups', async () => {
  const s = setup();
  const shelf = fakeShelf();
  const mine = skill(join(s.user, 'lit-docx'), 'lit-docx');
  const refused = await ext(s, ['remove', 'lit-docx'], { yes: true });
  assert.equal(refused.code, 1, refused.text);
  assert.ok(refused.text.includes(`lit-docx: refused. ${mine} has no LitGravity receipt`), refused.text);
  assert.ok(existsSync(join(mine, 'SKILL.md')), 'left in place');

  await ext(s, ['install', 'lit-pptx'], { from: shelf, yes: true });
  const dry = await ext(s, ['remove', 'lit-pptx']);
  assert.match(dry.text, /Dry run: nothing moved/);
  assert.ok(existsSync(join(s.user, 'lit-pptx')));
  const r = await ext(s, ['remove', 'lit-pptx'], { yes: true });
  assert.equal(r.code, 0, r.text);
  assert.ok(!existsSync(join(s.user, 'lit-pptx')));
  const [stamp] = backupsOf(s);
  assert.ok(existsSync(join(s.backups, stamp, 'lit-pptx', RECEIPT)), 'moved whole, nothing deleted');
});

test('prune-backups lists sizes, deletes nothing without --yes, and honours --older-than', async () => {
  const s = setup();
  const old = join(s.backups, '20200101-000000', 'lit-pptx');
  const recent = join(s.backups, '29990101-000000-project', 'lit-docx');
  for (const d of [old, recent]) { mkdirSync(d, { recursive: true }); writeFileSync(join(d, 'SKILL.md'), 'x'.repeat(2048)); }
  const dry = await ext(s, ['prune-backups'], { olderThan: '30' });
  assert.equal(dry.code, 0, dry.text);
  assert.match(dry.text, /delete {2}20200101-000000 {2}2 KB {2}lit-pptx/);
  assert.match(dry.text, /keep {4}29990101-000000-project/);
  assert.match(dry.text, /Dry run: would delete 1 folder \(2 KB\)/);
  assert.ok(existsSync(old));
  const r = await ext(s, ['prune-backups'], { olderThan: '30', yes: true });
  assert.equal(r.code, 0, r.text);
  assert.ok(!existsSync(join(s.backups, '20200101-000000')) && existsSync(recent));
  const all = await ext(s, ['prune-backups'], { yes: true });
  assert.equal(all.code, 0, all.text);
  assert.deepEqual(backupsOf(s), []);
});

test('prune-backups refuses a backups folder that is a symbolic link', async () => {
  const s = setup();
  const elsewhere = mkdtempSync(join(tmpdir(), 'litgravity-elsewhere-'));
  mkdirSync(join(elsewhere, '20200101-000000'));
  mkdirSync(join(s.home, '.gemini'), { recursive: true });
  symlinkSync(elsewhere, s.backups);
  const r = await ext(s, ['prune-backups'], { yes: true });
  assert.equal(r.code, 1, r.text);
  assert.ok(existsSync(join(elsewhere, '20200101-000000')));
});

test('without --from and offline, install stops with the --from hint and leaves no half install or cache', async () => {
  const s = setup();
  const env = { ...s.env, LITGRAVITY_EXTENSIONS_REPO: `file://${join(s.home, 'no-such-repo')}` };
  const r = await ext({ ...s, env }, ['install', 'lit-pptx'], { yes: true });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /could not fetch the extension source/);
  assert.match(r.text, /--from <path to your wjgoarxiv-skills clone>/);
  assert.ok(!existsSync(s.user));
  assert.ok(!existsSync(join(s.home, '.cache', 'litgravity', 'extensions-src')));
  assert.deepEqual(existsSync(join(s.home, '.cache', 'litgravity')) ? readdirSync(join(s.home, '.cache', 'litgravity')) : [], [], 'no temp clone left');

  const noGit = await ext({ ...s, env: { ...env, PATH: join(s.home, 'empty-bin') } }, ['install', 'lit-pptx'], { yes: true });
  assert.equal(noGit.code, 1, noGit.text);
  assert.match(noGit.text, /git was not found on PATH/);

  const dry = await ext({ ...s, env }, ['install', 'lit-pptx']);
  assert.equal(dry.code, 0, dry.text);
  assert.match(dry.text, /git clone --depth 1 --filter=blob:none --sparse /);
  assert.match(dry.text, /sparse-checkout set variants\/litgravity/);
});

const gitOk = spawnSync('git', ['--version']).status === 0;
test('without --from, LitGravity keeps a sparse clone of variants/litgravity in its cache, and update fetches it', { skip: !gitOk }, async () => {
  const s = setup();
  const shelf = fakeShelf('v1', ['lit-pptx']);
  writeFileSync(join(shelf, 'README.md'), 'top\n');
  mkdirSync(join(shelf, 'variants', 'other', 'x'), { recursive: true });
  writeFileSync(join(shelf, 'variants', 'other', 'x', 'SKILL.md'), 'other\n');
  const g = (...a) => assert.equal(spawnSync('git', ['-C', shelf, ...a], { env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).status, 0, a.join(' '));
  g('init', '-q', '-b', 'main');
  g('add', '-A');
  g('commit', '-q', '-m', 'v1');
  const env = { ...s.env, LITGRAVITY_EXTENSIONS_REPO: `file://${shelf}` };
  const r = await ext({ ...s, env }, ['install', 'lit-pptx'], { yes: true });
  assert.equal(r.code, 0, r.text);
  const cache = join(s.home, '.cache', 'litgravity', 'extensions-src');
  assert.ok(existsSync(join(cache, 'variants', 'litgravity', 'lit-pptx', 'SKILL.md')));
  assert.ok(!existsSync(join(cache, 'variants', 'other')), 'sparse: only the agy variants');
  assert.ok(JSON.parse(readFileSync(join(s.user, 'lit-pptx', RECEIPT), 'utf8')).source_commit);

  writeFileSync(join(shelf, 'variants', 'litgravity', 'lit-pptx', 'references', 'guide.md'), 'guide v2\n');
  g('commit', '-q', '-am', 'v2');
  const dry = await ext({ ...s, env }, ['update']);
  assert.match(dry.text, /lit-pptx: current/, 'a dry run compares with the last fetch');
  const u = await ext({ ...s, env }, ['update'], { yes: true });
  assert.equal(u.code, 0, u.text);
  assert.equal(readFileSync(join(s.user, 'lit-pptx', 'references', 'guide.md'), 'utf8'), 'guide v2\n');
});

test('--project installs into the workspace and backs up to a -project stamp outside it', async () => {
  const s = setup();
  const shelf = fakeShelf();
  skill(join(s.cwd, '.agents', 'skills', 'visual-qa'), 'visual-qa');
  const r = await ext(s, ['install', 'visual-qa'], { from: shelf, yes: true, project: true });
  assert.equal(r.code, 0, r.text);
  assert.ok(existsSync(join(s.cwd, '.agents', 'skills', 'visual-qa', RECEIPT)));
  const [stamp] = backupsOf(s);
  assert.match(stamp, /^\d{8}-\d{6}-project$/);
  assert.ok(!existsSync(s.user), 'user scope untouched');
});

test('--family and --all pick ids from the family table; an unknown id is refused', async () => {
  const s = setup();
  const shelf = fakeShelf();
  const fam = await ext(s, ['install'], { from: shelf, family: 'figures', yes: true });
  assert.equal(fam.code, 0, fam.text);
  assert.deepEqual(readdirSync(s.user).sort(), ['lit-diagram-drawer', 'lit-schematic', 'lit-scientific-visualization']);
  const bad = await ext(s, ['install', 'lit-plan'], { from: shelf });
  assert.equal(bad.code, 2);
  assert.match(bad.text, /not a LitGravity extension: lit-plan/);
  const all = await ext(s, ['install'], { from: shelf, all: true });
  assert.match(all.text, /Add --yes to install these 9/);
});

test('a destination that is a symbolic link, or a skills root behind one, fails closed', async () => {
  const s = setup();
  const shelf = fakeShelf();
  const target = skill(mkdtempSync(join(tmpdir(), 'litgravity-target-')), 'lit-pptx');
  mkdirSync(s.user, { recursive: true });
  symlinkSync(target, join(s.user, 'lit-pptx'));
  const r = await ext(s, ['install', 'lit-pptx'], { from: shelf, yes: true });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /is a symbolic link; move it aside by hand first/);
  assert.deepEqual(readdirSync(target), ['SKILL.md'], 'the link target is untouched');

  const s2 = setup();
  const real = mkdtempSync(join(tmpdir(), 'litgravity-real-'));
  mkdirSync(join(s2.home, '.gemini', 'config'), { recursive: true });
  symlinkSync(real, s2.user);
  const r2 = await ext(s2, ['install', 'lit-docx'], { from: shelf, yes: true });
  assert.equal(r2.code, 1, r2.text);
  assert.deepEqual(readdirSync(real), []);

  const s3 = setup();
  const away = mkdtempSync(join(tmpdir(), 'litgravity-away-'));
  mkdirSync(join(s3.cwd, '.agents'), { recursive: true });
  symlinkSync(away, join(s3.cwd, '.agents', '.litgravity-staging'));
  const r3 = await ext(s3, ['install', 'lit-docx'], { from: shelf, yes: true, project: true });
  assert.equal(r3.code, 1, r3.text);
  assert.match(r3.text, /\.litgravity-staging is a symbolic link/);
  assert.deepEqual(readdirSync(away), []);
});

test('check: clean exits 0; a copy without a receipt or with a vanished source exits 1 with its fix', async () => {
  const s = setup();
  const clean = await ext(s, ['check']);
  assert.equal(clean.code, 0, clean.text);
  assert.match(clean.text, /Clean: nothing needs action/);
  const shelf = fakeShelf();
  await ext(s, ['install', 'lit-pptx'], { from: shelf, yes: true });
  const file = join(s.user, 'lit-pptx', RECEIPT);
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), source: join(s.home, 'gone') }));
  skill(join(s.user, 'lit-docx'), 'lit-docx');
  const r = await ext(s, ['check'], { json: true });
  assert.equal(r.code, 1);
  const found = JSON.parse(r.text).findings;
  assert.ok(found.some((f) => f.text.includes('lit-docx') && f.fix === `${EXTENSIONS_CLI} install lit-docx --yes`), r.text);
  assert.ok(found.some((f) => f.text.includes('no longer exists') && f.fix === `${EXTENSIONS_CLI} update lit-pptx --yes`), r.text);
  const u = await ext(s, ['update', 'lit-pptx'], { from: shelf, yes: true });
  assert.match(u.text, /current \(the receipt names/);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).source, join(shelf, 'variants', 'litgravity', 'lit-pptx'), 'receipt source rewritten');
});

test('help, list, doctor, the stubs and the extensions notice all name the verbs', async () => {
  const help = spawnSync(process.execPath, [join(ROOT, 'bin', 'litgravity.mjs'), 'help'], { encoding: 'utf8' }).stdout;
  assert.match(help, /extensions +extensions list\|check\|install\|update\|remove\|prune-backups/);
  const sub = spawnSync(process.execPath, [join(ROOT, 'bin', 'litgravity.mjs'), 'extensions', '--help'], { encoding: 'utf8' }).stdout;
  for (const verb of ['list', 'check', 'install', 'update', 'remove', 'prune-backups']) assert.match(sub, new RegExp(`^  ${verb}\\b`, 'm'), verb);
  for (const id of IDS) {
    const md = readFileSync(join(PLUGIN, 'skills', id, 'SKILL.md'), 'utf8');
    assert.ok(md.includes(`\`npx @litfamily/litgravity extensions install ${id}\``), `${id} stub names the command`);
    assert.ok(md.includes('find .agents/skills'), `${id} stub keeps the hand lines`);
  }
});

test('existing users: an install that finds an old copy without a receipt adds one check line to the notice, once', async () => {
  const { env, home } = sandbox();
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-proj-'));
  skill(join(home, '.gemini', 'config', 'skills', 'lit-pptx'), 'lit-pptx');
  const out = collect();
  assert.equal(await install({ env, flags: { yes: true, scope: 'user' }, cwd, print: out.print }), 0, out.text());
  assert.match(out.text(), /`npx @litfamily\/litgravity extensions check` found 1 thing to look at/);
  assert.ok(existsSync(join(home, '.gemini', 'config', 'skills', 'lit-pptx', 'SKILL.md')), 'nothing changed on its own');
  assert.ok(!existsSync(join(home, '.gemini', 'extension-backups')));
  const first = injected(runHook('session-start', basePayload(workspace()), env));
  assert.match(first, /extensions check` found 1 thing/);
  const second = injected(runHook('session-start', basePayload(workspace()), env));
  assert.doesNotMatch(second, /extensions check/);

  const doc = collect();
  await doctor({ env: { ...env, LITGRAVITY_SKIP_HOST_TOOLS: '1' }, flags: { offline: true }, cwd, print: doc.print });
  assert.match(doc.text(), /WARN extensions — 1 thing to look at: lit-pptx: .* has no receipt/);
  assert.match(doc.text(), /fix: npx @litfamily\/litgravity extensions check/);

  const clean = sandbox();
  const out2 = collect();
  await install({ env: clean.env, flags: { yes: true, scope: 'user' }, cwd, print: out2.print });
  assert.doesNotMatch(out2.text(), /extensions check` found/, 'a clean machine gets no extra line');
});

// Review fixes. `renameSync` is swapped on the CommonJS fs object and synced into the ESM bindings, so a test can make
// one rename fail without a seam in the module.
async function withFailingRename(fails, fn) {
  const calls = [];
  const real = fs.renameSync;
  mock.method(fs, 'renameSync', (from, to) => {
    calls.push({ from: String(from), to: String(to) });
    if (fails(String(from), String(to))) throw Object.assign(new Error('simulated rename failure'), { code: 'EIO' });
    return real(from, to);
  });
  syncBuiltinESMExports();
  try {
    return { result: await fn(), calls };
  } finally {
    mock.restoreAll();
    syncBuiltinESMExports();
  }
}

test('the staging copy sits outside every folder agy loads: under the backups (user) or beside skills/ (project)', async () => {
  const s = setup();
  const shelf = fakeShelf();
  const scanned = [join(s.cwd, '.agents', 'skills'), join(s.cwd, '_agents', 'skills'), s.user, join(s.home, '.gemini', 'skills')];
  const inside = (p) => scanned.some((f) => p === f || p.startsWith(`${f}/`));
  for (const [flags, root] of [[{}, join(s.backups, '.staging')], [{ project: true }, join(s.cwd, '.agents', '.litgravity-staging')]]) {
    const dest = join(flags.project ? join(s.cwd, '.agents', 'skills') : s.user, 'lit-pptx');
    const { result, calls } = await withFailingRename((_from, to) => to === dest, () => ext(s, ['install', 'lit-pptx'], { from: shelf, yes: true, ...flags }));
    assert.equal(result.code, 1, result.text);
    const staged = calls.find((c) => c.to === dest).from;
    assert.ok(!inside(staged), `staged inside a scanned folder: ${staged}`);
    assert.ok(staged.startsWith(`${root}/`), `staged at ${staged}, expected under ${root}`);
    assert.ok(!existsSync(staged) && !existsSync(root), 'the staging folder is cleaned up');
  }
  const r = await ext(s, ['install', 'lit-pptx'], { from: shelf, yes: true });
  assert.equal(r.code, 0, r.text);
  assert.deepEqual(backupsOf(s), [], 'a clean install leaves no staging folder behind');
});

test('a failed final rename puts the old copy back, and a multi-id run names the ids already done', async () => {
  const s = setup();
  const shelf = fakeShelf('new');
  skill(join(s.user, 'lit-docx'), 'lit-docx', 'OLD COPY');
  const dest = join(s.user, 'lit-docx');
  // Only the staged copy's rename fails; putting the old copy back from its dated backup still works.
  const { result } = await withFailingRename((from, to) => to === dest && !/extension-backups\/\d{8}-/.test(from), () => ext(s, ['install', 'lit-pptx', 'lit-docx'], { from: shelf, yes: true }));
  assert.equal(result.code, 1, result.text);
  assert.match(readFileSync(join(dest, 'SKILL.md'), 'utf8'), /OLD COPY/, 'the old copy is back in place');
  assert.match(result.text, /lit-docx is unchanged/);
  assert.match(result.text, /Already done: lit-pptx/);
  assert.ok(existsSync(join(s.user, 'lit-pptx', RECEIPT)));
});

test('update --yes writes no receipt when a planned copy stops, and rewrites a moved source atomically otherwise', async () => {
  const s = setup();
  const a = fakeShelf('v1', ['lit-pptx', 'lit-docx']);
  await ext(s, ['install', 'lit-pptx', 'lit-docx'], { from: a, yes: true });
  const b = fakeShelf('v1', ['lit-pptx', 'lit-docx']);
  writeFileSync(join(b, 'variants', 'litgravity', 'lit-pptx', 'references', 'guide.md'), 'guide v2\n');
  const mine = skill(join(s.home, '.gemini', 'skills', 'my-pptx'), 'lit-pptx');
  const docxReceipt = join(s.user, 'lit-docx', RECEIPT);
  const before = readFileSync(docxReceipt, 'utf8');
  const stopped = await ext(s, ['update'], { from: b, yes: true });
  assert.equal(stopped.code, 1, stopped.text);
  assert.match(stopped.text, /Stopped before writing anything/);
  assert.equal(readFileSync(docxReceipt, 'utf8'), before, 'the receipt-only rewrite waited for the plan');

  fs.rmSync(mine, { recursive: true });
  const ok = await ext(s, ['update'], { from: b, yes: true });
  assert.equal(ok.code, 0, ok.text);
  assert.equal(JSON.parse(readFileSync(docxReceipt, 'utf8')).source, join(b, 'variants', 'litgravity', 'lit-docx'));
  assert.deepEqual(readdirSync(join(s.user, 'lit-docx')).sort(), [RECEIPT, 'SKILL.md', 'references'].sort(), 'no temp receipt left');
});

test('prune-backups --older-than with no value exits 2 and deletes nothing', () => {
  const s = setup();
  const kept = join(s.backups, '20200101-000000', 'lit-pptx');
  mkdirSync(kept, { recursive: true });
  for (const argv of [['--yes', '--older-than'], ['--older-than', '--yes']]) {
    const r = spawnSync(process.execPath, [join(ROOT, 'bin', 'litgravity.mjs'), 'extensions', 'prune-backups', ...argv], { env: s.env, cwd: s.cwd, encoding: 'utf8' });
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stdout, /--older-than takes a number of days/);
    assert.ok(existsSync(kept));
  }
});

test('treeHash hashes a link by its target, so the same skill hashes the same wherever it lives', () => {
  const make = (target) => {
    const dir = mkdtempSync(join(tmpdir(), 'litgravity-hash-'));
    writeFileSync(join(dir, 'SKILL.md'), 'x\n');
    symlinkSync(target, join(dir, 'link'));
    return dir;
  };
  assert.equal(treeHash(make('SKILL.md')).hash, treeHash(make('SKILL.md')).hash);
  assert.notEqual(treeHash(make('SKILL.md')).hash, treeHash(make('other.md')).hash);
});

test('update of an id that is not installed exits 1', async () => {
  const s = setup();
  const r = await ext(s, ['update', 'lit-pptx'], { from: fakeShelf() });
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /lit-pptx: not installed/);
});
