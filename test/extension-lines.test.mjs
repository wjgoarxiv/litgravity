import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sandbox, collect, walk, PLUGIN } from './helpers.mjs';
import { MOVED_SKILLS, extensionSteps, extensionLines, EXTENSION_BACKUPS, AGY_SKILL_FOLDERS } from '../plugin/hooks/lib/routes.mjs';
import { extensionNotice } from '../plugin/hooks/lib/extensions.mjs';
import { activation } from '../plugin/hooks/lib/reentry.mjs';
import { install } from '../lib/install.mjs';
import { list } from '../lib/list.mjs';
import { planRuleFile } from '../lib/agent-file.mjs';
import { packageVersion } from '../lib/bundle.mjs';
import { paths } from '../lib/paths.mjs';

// The extension install lines: look first, move an existing copy whole into a dated folder agy never scans, copy into
// the emptied place, write a receipt inside the copy. agy 1.5.6 loads bare skills from a workspace `.agents/skills` and
// `_agents/skills`, then `~/.gemini/config/skills`, then `~/.gemini/skills`; a same-name skill in any of them, a
// `<id>.bak` sibling included, competes, and agy keeps one of them without a word. Nothing outside those folders loads.
const PLACE = '<path to your wjgoarxiv-skills clone>';
const SCOPES = { user: '~/.gemini/config/skills', project: '.agents/skills' };
const shells = ['bash', 'zsh'].filter((sh) => spawnSync(sh, ['-c', 'true']).status === 0);

test('the lines for both scopes: a read-only preflight over every folder agy loads, a move into the backup root, a copy, a receipt', () => {
  assert.deepEqual(AGY_SKILL_FOLDERS, ['.agents/skills', '_agents/skills', '~/.gemini/config/skills', '~/.gemini/skills']);
  assert.equal(EXTENSION_BACKUPS, '~/.gemini/extension-backups');
  for (const scope of ['user', 'project']) {
    const s = extensionSteps('lit-pptx', scope);
    const dest = `${SCOPES[scope]}/lit-pptx`;
    assert.deepEqual(Object.keys(s), ['preflight', 'moveAside', 'copy', 'receipt']);
    assert.deepEqual(extensionLines('lit-pptx', scope), Object.values(s));
    for (const dir of AGY_SKILL_FOLDERS) assert.ok(s.preflight.includes(dir), `${scope}: preflight looks in ${dir}`);
    assert.doesNotMatch(s.preflight, /\b(mv|cp|rm|mkdir)\b| > /, 'preflight writes nothing');
    assert.ok(s.moveAside.includes(`mv ${dest} "$b/"`), s.moveAside);
    assert.ok(s.moveAside.includes(`b=${EXTENSION_BACKUPS}/$(date +%Y%m%d-%H%M%S)`), s.moveAside);
    assert.ok(s.copy.endsWith(`cp -R "${PLACE}/variants/litgravity/lit-pptx" ${dest}`), 'copies to the exact name, so it never nests');
    assert.ok(s.copy.includes(`[ ! -e ${dest} ]`), 'never copies over a folder that is still there');
    assert.ok(s.receipt.endsWith(`> ${dest}/.litfamily-extension.json`), s.receipt);
    for (const line of Object.values(s)) {
      assert.doesNotMatch(line, /rm -r|rm -f|\n/, line);
      assert.doesNotMatch(line, /^#|\s#\s/, 'no comments: zsh without interactive_comments runs them');
    }
  }
  for (const dir of AGY_SKILL_FOLDERS) assert.ok(EXTENSION_BACKUPS !== dir && !EXTENSION_BACKUPS.startsWith(`${dir}/`), dir);
});

// Runs the lines in a real shell with a sandbox HOME and workspace, as a user pastes them.
function paste(sh, lines, home, cwd, clone) {
  const out = [];
  for (const line of lines) {
    const r = spawnSync(sh, ['-c', line.split(PLACE).join(clone)], { cwd, env: { HOME: home, PATH: process.env.PATH }, encoding: 'utf8' });
    out.push(r.stdout + r.stderr);
  }
  return out;
}

function fakeClone(marker) {
  const clone = mkdtempSync(join(tmpdir(), 'wjgoarxiv-skills-'));
  const skill = join(clone, 'variants', 'litgravity', 'lit-pptx');
  mkdirSync(join(skill, 'references'), { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), `---\nname: lit-pptx\ndescription: "${marker}"\n---\nbody\n`);
  writeFileSync(join(skill, 'references', 'guide.md'), 'guide\n');
  return clone;
}

for (const sh of shells) {
  for (const scope of ['user', 'project']) {
    test(`${sh}, ${scope} scope: fresh install, install over a user folder, update, then a LitGravity install leaves the copy alone`, async () => {
      const { env, home } = sandbox();
      const cwd = mkdtempSync(join(tmpdir(), 'litgravity-proj-'));
      const root = scope === 'user' ? join(home, '.gemini', 'config', 'skills') : join(cwd, '.agents', 'skills');
      const dest = join(root, 'lit-pptx');
      const backups = join(home, '.gemini', 'extension-backups');
      const lines = extensionLines('lit-pptx', scope);
      const clone = fakeClone('v1');

      // 1. Fresh install into an empty home.
      const fresh = paste(sh, lines, home, cwd, clone);
      assert.equal(fresh[0], '', 'preflight prints nothing when no copy exists');
      assert.deepEqual(walk(dest).sort(), ['.litfamily-extension.json', 'SKILL.md', 'references', 'references/guide.md']);
      const r1 = JSON.parse(readFileSync(join(dest, '.litfamily-extension.json'), 'utf8'));
      assert.deepEqual(Object.keys(r1), ['id', 'source', 'variant', 'installed_at']);
      assert.equal(r1.id, 'lit-pptx');
      assert.equal(r1.variant, 'litgravity');
      assert.equal(r1.source, join(clone, 'variants', 'litgravity', 'lit-pptx'));
      assert.equal(existsSync(backups), false, 'nothing to move on a fresh install');

      // 2. Over an existing same-name folder holding a user file.
      mkdirSync(join(dest, 'mine'), { recursive: true });
      writeFileSync(join(dest, 'mine', 'notes.md'), 'my notes\n');
      const v2 = fakeClone('v2');
      const over = paste(sh, lines, home, cwd, v2);
      assert.ok(over[0].trim().endsWith('skills/lit-pptx/SKILL.md'), `preflight names the copy: ${over[0]}`);
      assert.match(over[1], /^moved to /);
      const [stamp] = readdirSync(backups);
      const saved = join(backups, stamp, 'lit-pptx');
      assert.equal(readFileSync(join(saved, 'mine', 'notes.md'), 'utf8'), 'my notes\n', 'the user file moved whole');
      assert.ok(existsSync(join(saved, '.litfamily-extension.json')), 'the old receipt went with it');
      assert.deepEqual(walk(dest).sort(), ['.litfamily-extension.json', 'SKILL.md', 'references', 'references/guide.md'], 'clean copy, no nesting or merge');
      assert.match(readFileSync(join(dest, 'SKILL.md'), 'utf8'), /"v2"/);
      assert.deepEqual(readdirSync(root), ['lit-pptx'], 'one live copy in the skills folder');

      // 3. Update: the same lines again (a second later, so the backup folder has its own stamp).
      const before = readFileSync(join(dest, '.litfamily-extension.json'), 'utf8');
      spawnSync('sleep', ['1.1']);
      paste(sh, lines, home, cwd, fakeClone('v3'));
      assert.equal(readdirSync(backups).length, 2, 'a second dated backup');
      assert.match(readFileSync(join(dest, 'SKILL.md'), 'utf8'), /"v3"/);
      assert.notEqual(readFileSync(join(dest, '.litfamily-extension.json'), 'utf8'), before, 'receipt rewritten');
      assert.deepEqual(readdirSync(root), ['lit-pptx']);

      // 4. A LitGravity install or update afterwards writes only its plugin folder.
      const receipt = readFileSync(join(dest, '.litfamily-extension.json'), 'utf8');
      for (let i = 0; i < 2; i += 1) {
        const out = collect();
        assert.equal(await install({ env, flags: { yes: true, scope }, cwd, print: out.print }), 0, out.text());
      }
      assert.equal(readFileSync(join(dest, '.litfamily-extension.json'), 'utf8'), receipt);
      assert.match(readFileSync(join(dest, 'SKILL.md'), 'utf8'), /"v3"/);
      assert.deepEqual(readdirSync(root), ['lit-pptx']);
    });
  }

  test(`${sh}: the preflight names a same-name skill in another folder agy loads, an old .bak sibling included`, () => {
    const home = mkdtempSync(join(tmpdir(), 'litgravity-home-'));
    const cwd = mkdtempSync(join(tmpdir(), 'litgravity-proj-'));
    const seeded = [
      join(home, '.gemini', 'skills', 'lit-pptx'),
      join(cwd, '_agents', 'skills', 'lit-pptx'),
      join(home, '.gemini', 'config', 'skills', 'lit-pptx.bak-2026-11-12'),
    ];
    for (const dir of seeded) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'SKILL.md'), '---\nname: lit-pptx\ndescription: "old"\n---\n');
    }
    const mkOther = join(home, '.gemini', 'config', 'skills', 'other');
    mkdirSync(mkOther, { recursive: true });
    writeFileSync(join(mkOther, 'SKILL.md'), '---\nname: other\n---\n');
    const [out] = paste(sh, [extensionSteps('lit-pptx', 'user').preflight], home, cwd, '/nowhere');
    const shown = out.trim().split('\n').sort();
    assert.equal(shown.length, 3, out);
    assert.ok(shown.every((l) => l.endsWith('/SKILL.md')), out);
    assert.ok(!out.includes('/other/'), 'only same-name skills');
  });
}

test('the backup root is outside every folder agy loads, and the moved copy is the only one left there', () => {
  // The scan order and the folders are host facts probed on agy 1.5.6 (see the CHANGELOG entry); this pins the lines to them.
  for (const scope of ['user', 'project']) {
    const s = extensionSteps('lit-pptx', scope);
    for (const dir of AGY_SKILL_FOLDERS) assert.ok(!s.moveAside.includes(`b=${dir}`), dir);
    assert.doesNotMatch(s.moveAside, /\.bak|\.saved-|skills\/lit-pptx\./, 'never a sibling inside a skills folder');
  }
});

for (const id of Object.keys(MOVED_SKILLS)) {
  test(`${id}: the stub gives the four lines for both scopes, the update and remove paths, and no delete`, () => {
    const md = readFileSync(join(PLUGIN, 'skills', id, 'SKILL.md'), 'utf8');
    for (const scope of ['user', 'project']) for (const line of extensionLines(id, scope)) assert.ok(md.includes(`${line}\n`), `${id} ${scope}: ${line}`);
    assert.ok(md.includes(EXTENSION_BACKUPS), 'names the backup folder');
    assert.match(md, /update it, run the same lines again/i);
    assert.match(md, /remove it, run the second line alone/i);
    assert.doesNotMatch(md, /rm -r|delete the copied folder/);
    assert.ok(md.includes('.litfamily-extension.json'));
    assert.ok(Buffer.byteLength(md) < 7000, `${Buffer.byteLength(md)} B`);
  });
}

test('the extensions notice, the router note and list carry the same lines', () => {
  const notice = extensionNotice(mkdtempSync(join(tmpdir(), 'litgravity-data-'))).join('\n');
  for (const line of extensionLines('<id>')) assert.ok(notice.includes(`  ${line}`), line);
  const note = activation({ route: 'lit-docx' }, 'conv-1');
  for (const line of extensionLines('lit-docx')) assert.ok(note.includes(line), line);
  assert.ok(Buffer.byteLength(note) <= 4096, `${Buffer.byteLength(note)} B`);
  const out = collect();
  list({ flags: {}, print: out.print });
  for (const line of extensionLines('<id>')) assert.ok(out.text().includes(`  ${line}`), line);
  assert.doesNotMatch(notice + note + out.text(), /cp -R "[^"]+" ~\/\.gemini\/config\/skills\/(\s|$)/, 'the old trailing-slash copy is gone');
});

test('the rule-file move-aside advice saves outside agy\'s rules folder', () => {
  const { env } = sandbox();
  const p = paths(env, mkdtempSync(join(tmpdir(), 'litgravity-proj-')));
  mkdirSync(join(p.home, '.gemini', 'config', 'rules'), { recursive: true });
  writeFileSync(p.geminiRulesFile, '# my own rule\n');
  const plan = planRuleFile({ p, version: packageVersion(), env });
  assert.equal(plan.action, 'refuse');
  assert.doesNotMatch(plan.detail, /\.saved-/);
  const m = /mkdir -p "([^"]+)" && mv "([^"]+)" "([^"]+)"/.exec(plan.detail);
  assert.ok(m, plan.detail);
  assert.equal(m[2], p.geminiRulesFile);
  assert.ok(m[3].startsWith(join(p.data, 'saved') + '/'), m[3]);
  assert.ok(!m[3].startsWith(join(p.home, '.gemini')), 'outside every folder agy reads');
});
