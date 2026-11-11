// skills.lock.json is the one pin for what ships. `npm run sync:lock` writes its generated half (per-skill sizes and
// hashes, the pack list); `policy` and `budgets` are hand-owned and pass through every sync unchanged. The pack list
// itself is compared with a real `npm pack` in package.test.mjs, so this file runs no npm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { LOCK_FILE, buildLock, measureSkills, readLock, seedBudget, trackedFiles, trackedOnly, violations } from '../scripts/sync-lock.mjs';

const SYNC = join(ROOT, 'scripts', 'sync-lock.mjs');
const runSync = (...args) => spawnSync(process.execPath, [SYNC, ...args], { encoding: 'utf8' });
const tempDir = (tag) => mkdtempSync(join(tmpdir(), `litgravity-lock-${tag}-`));
const FM = (id) => `---\nname: ${id}\ndescription: "fixture"\n---\n`;
function writeSkill(skills, id, size, refs = 1) {
  mkdirSync(join(skills, id, 'references'), { recursive: true });
  writeFileSync(join(skills, id, 'SKILL.md'), FM(id) + 'x'.repeat(Math.max(0, size - FM(id).length)));
  for (let i = 0; i < refs; i += 1) writeFileSync(join(skills, id, 'references', `r${i}.md`), 'ref');
}

test('skills.lock.json is current (run npm run sync:lock after any skill change)', () => {
  const lock = readLock();
  const fresh = buildLock({ pack: lock.pack, previous: lock });
  const stale = [...new Set([...Object.keys(lock.skills), ...Object.keys(fresh.skills)])]
    .filter((id) => JSON.stringify(lock.skills[id]) !== JSON.stringify(fresh.skills[id]))
    .sort();
  assert.deepEqual(stale, [], 'skills.lock.json is stale: run npm run sync:lock');
  assert.deepEqual(fresh, lock);
});

test('every shipped skill sits inside its budget, under the agy body cap and above the family floor', () => {
  const lock = readLock();
  const measured = measureSkills();
  assert.deepEqual(Object.keys(lock.budgets).sort(), Object.keys(measured).sort(), 'one budget per shipped skill');
  assert.deepEqual(violations(measured, lock.budgets, lock.policy), []);
  assert.equal(lock.policy.familyFloorBytes, 12000);
  assert.equal(lock.policy.bodyCapBytes, 24000);
});

test('budget checks catch a placeholder SKILL.md, a trimmed folder, a bloated one and a body past the agy cap', () => {
  const policy = { familyFloorBytes: 12000, bodyCapBytes: 24000 };
  const budgets = { a: { minSkillBytes: 15000, minBodyBytes: 14800, minFiles: 4, minTotalBytes: 40000, maxFiles: 8, maxTotalBytes: 90000 } };
  const at = (bytes, bodyBytes, files, total) => ({ a: { skillMd: { bytes, bodyBytes }, files, bytes: total } });
  assert.deepEqual(violations(at(16000, 15800, 5, 50000), budgets, policy), []);
  assert.deepEqual(violations(at(300, 200, 5, 50000), budgets, policy), [
    'a: SKILL.md 300 B < floor 15000 B',
    'a: SKILL.md body 200 B < floor 14800 B',
    'a: SKILL.md 300 B < family floor 12000 B',
  ]);
  assert.deepEqual(violations(at(16000, 15800, 2, 30000), budgets, policy), ['a: 2 files < floor 4', 'a: 30000 B in the folder < floor 40000 B']);
  assert.deepEqual(violations(at(16000, 15800, 9, 99000), budgets, policy), ['a: 9 files > ceiling 8', 'a: 99000 B in the folder > ceiling 90000 B']);
  assert.match(violations(at(25000, 24800, 5, 50000), budgets, policy)[0], /a: SKILL\.md body 24800 B > the 24000 B agy loads/);
});

test('a moved skill named in policy.movedStubs skips only the family floor; its own floors and ceilings still hold', () => {
  const policy = { familyFloorBytes: 12000, bodyCapBytes: 24000, movedStubs: { s: 'decks' } };
  const stub = { minSkillBytes: 2800, minBodyBytes: 2600, minFiles: 1, minTotalBytes: 2800, maxFiles: 1, maxTotalBytes: 5000 };
  const at = (id, bytes, files = 1) => ({ [id]: { skillMd: { bytes, bodyBytes: bytes - 200 }, files, bytes } });
  assert.deepEqual(violations(at('s', 3000), { s: stub }, policy), []);
  assert.deepEqual(violations(at('t', 3000), { t: stub }, policy), ['t: SKILL.md 3000 B < family floor 12000 B'], 'any other id keeps the family floor');
  assert.deepEqual(violations(at('s', 300), { s: stub }, policy), ['s: SKILL.md 300 B < floor 2800 B', 's: SKILL.md body 100 B < floor 2600 B', 's: 300 B in the folder < floor 2800 B']);
  assert.deepEqual(violations(at('s', 3000, 2), { s: stub }, policy), ['s: 2 files > ceiling 1'], 'a stub that grows files again is caught');
});

test('sync:lock keeps hand-owned policy and budgets, and seeds or drops a budget only when told to', () => {
  const dir = tempDir('build');
  try {
    writeSkill(dir, 'kept', 14000);
    writeSkill(dir, 'fresh', 20123, 2);
    const previous = {
      policy: { familyFloorBytes: 12000, bodyCapBytes: 24000, runtimes: ['office'] },
      budgets: {
        kept: { minSkillBytes: 13000, minBodyBytes: 12900, minFiles: 2, minTotalBytes: 13000, maxFiles: 9, maxTotalBytes: 99000 },
        gone: { minSkillBytes: 1, minBodyBytes: 1, minFiles: 1, minTotalBytes: 1, maxFiles: 2, maxTotalBytes: 2 },
      },
    };
    const plain = buildLock({ skillsDir: dir, pack: [], previous });
    assert.deepEqual(plain.budgets.gone, previous.budgets.gone, 'a removed skill keeps its budget without --drop');
    assert.equal(plain.budgets.fresh, undefined, 'a new skill gets no budget without --accept-new');
    assert.deepEqual(violations(plain.skills, plain.budgets, plain.policy), [
      'fresh: new skill without a budget (npm run sync:lock -- --accept-new fresh)',
      'gone: budget for a missing skill (npm run sync:lock -- --drop gone)',
    ]);

    const lock = buildLock({ skillsDir: dir, pack: ['b', 'a'], previous, acceptNew: ['fresh'], drop: ['gone'] });
    assert.deepEqual(lock.policy, previous.policy);
    assert.deepEqual(lock.budgets.kept, previous.budgets.kept, 'an existing budget is never rewritten');
    assert.equal(lock.budgets.gone, undefined);
    assert.deepEqual(lock.budgets.fresh, seedBudget(lock.skills.fresh));
    assert.deepEqual(lock.budgets.fresh, { minSkillBytes: 20100, minBodyBytes: 20000, minFiles: 3, minTotalBytes: 20100, maxFiles: 5, maxTotalBytes: 31000 });
    assert.deepEqual(violations(lock.skills, lock.budgets, lock.policy), []);
    assert.deepEqual(lock.pack, ['a', 'b']);
    assert.equal(lock.skills.kept.files, 2);
    assert.equal(lock.skills.kept.skillMd.bytes, 14000);
    assert.match(lock.skills.kept.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(buildLock({ skillsDir: dir, pack: ['a', 'b'], previous: lock }), lock, 'a second sync changes nothing');

    assert.throws(() => buildLock({ skillsDir: dir, pack: [], previous: lock, acceptNew: ['kept'] }), /--accept-new kept: not a new skill/);
    assert.throws(() => buildLock({ skillsDir: dir, pack: [], previous: lock, drop: ['kept'] }), /--drop kept: not a missing skill/);
    writeFileSync(join(dir, 'kept', 'references', 'r0.md'), 'ref, edited');
    assert.notEqual(buildLock({ skillsDir: dir, pack: [], previous: lock }).skills.kept.sha256, lock.skills.kept.sha256, 'a reference edit changes the skill hash');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a floor cannot be lowered by removing a skill, syncing, and adding it back smaller', () => {
  const dir = tempDir('readd');
  const skills = join(dir, 'skills');
  const lockFile = join(dir, 'skills.lock.json');
  const sync = (...extra) => runSync('--skills', skills, '--lock', lockFile, '--no-pack', ...extra);
  try {
    writeSkill(skills, 'lit-plan', 23000);
    const budget = { minSkillBytes: 22900, minBodyBytes: 22800, minFiles: 2, minTotalBytes: 22900, maxFiles: 3, maxTotalBytes: 35000 };
    writeFileSync(lockFile, JSON.stringify({ policy: { familyFloorBytes: 12000, bodyCapBytes: 24000 }, budgets: { 'lit-plan': budget }, skills: {}, pack: [] }));
    let r = sync();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const synced = readFileSync(lockFile, 'utf8');

    rmSync(join(skills, 'lit-plan'), { recursive: true });
    r = sync();
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /lit-plan: budget for a missing skill \(npm run sync:lock -- --drop lit-plan\)/);
    assert.equal(readFileSync(lockFile, 'utf8'), synced, 'an orphan budget is never dropped silently');

    writeSkill(skills, 'lit-plan', 13100);
    r = sync();
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /lit-plan: SKILL\.md 13100 B < floor 22900 B/);
    assert.equal(readFileSync(lockFile, 'utf8'), synced, 'the smaller skill still meets the old floor');

    rmSync(join(skills, 'lit-plan'), { recursive: true });
    r = sync('--drop', 'lit-plan');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /dropped budget: lit-plan/);
    const dropped = readFileSync(lockFile, 'utf8');
    assert.equal(JSON.parse(dropped).budgets['lit-plan'], undefined);

    writeSkill(skills, 'lit-plan', 13100);
    r = sync();
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /lit-plan: new skill without a budget \(npm run sync:lock -- --accept-new lit-plan\)/);
    assert.equal(readFileSync(lockFile, 'utf8'), dropped, 'a new skill is never seeded silently');

    r = sync('--accept-new', 'lit-plan');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /seeded budget: lit-plan \(SKILL\.md >= 13100 B/);
    assert.equal(JSON.parse(readFileSync(lockFile, 'utf8')).budgets['lit-plan'].minSkillBytes, 13100);

    r = sync('--drop', 'lit-plan');
    assert.equal(r.status, 1, 'a flag that names the wrong kind of skill is refused');
    assert.match(r.stderr, /--drop lit-plan: not a missing skill/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A throwaway git repo, so the probe never puts a stray file in this tree while package.test.mjs runs npm pack.
test('only git-tracked files are measured and pinned: a stray untracked file changes neither half of the lock', () => {
  const dir = tempDir('git');
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  try {
    assert.equal(git('init', '-q').status, 0);
    const skills = join(dir, 'plugin', 'skills');
    writeSkill(skills, 'lit-plan', 13000);
    assert.equal(git('add', '.').status, 0);
    const before = measureSkills(skills);
    const tracked = trackedFiles(dir);
    writeFileSync(join(skills, 'lit-plan', '.DS_Store'), 'finder metadata');
    writeFileSync(join(skills, 'lit-plan', 'references', 'scratch-notes.md'), 'a local file git does not track');
    assert.deepEqual(measureSkills(skills), before, 'skills half unchanged');
    const packed = [...tracked, 'plugin/skills/lit-plan/references/scratch-notes.md'];
    assert.deepEqual(trackedOnly(packed, trackedFiles(dir)), { pinned: [...tracked].sort(), untracked: ['plugin/skills/lit-plan/references/scratch-notes.md'] }, 'pack half unchanged');
    assert.deepEqual(trackedOnly(['b', 'a'], null), { pinned: ['a', 'b'], untracked: [] }, 'outside git the pack list is taken as it is');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sync:lock writes nothing while a skill breaks its budget; the script is wired and the old fixtures are gone', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['sync:lock'], 'node scripts/sync-lock.mjs');
  assert.equal(pkg.scripts['sync:fixtures'], undefined, 'sync:fixtures is replaced by sync:lock');
  assert.ok(existsSync(LOCK_FILE));
  for (const gone of ['test/fixtures/skill-depth.json', 'test/fixtures/pack-files.json', 'scripts/sync-fixtures.mjs']) {
    assert.ok(!existsSync(join(ROOT, gone)), `${gone} is replaced by skills.lock.json`);
  }
  const dir = tempDir('cli');
  try {
    writeSkill(dir, 'tiny', 200, 0);
    const lockFile = join(dir, 'lock.json');
    const before = JSON.stringify({ policy: { familyFloorBytes: 12000 }, budgets: { tiny: { minSkillBytes: 13000, minBodyBytes: 12900, minFiles: 1, minTotalBytes: 13000, maxFiles: 2, maxTotalBytes: 20000 } }, skills: {}, pack: [] });
    writeFileSync(lockFile, before);
    const r = runSync('--skills', dir, '--lock', lockFile, '--no-pack');
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /tiny: SKILL\.md 200 B < floor 13000 B/);
    assert.equal(readFileSync(lockFile, 'utf8'), before, 'nothing written');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
