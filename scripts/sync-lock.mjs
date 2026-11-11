#!/usr/bin/env node
// Writes skills.lock.json, the one pin for what the package ships. It replaces the two hand-re-pinned fixtures
// (skill-depth.json and pack-files.json) that `sync:fixtures` used to rewrite from the current sizes, which let a
// shrunken skill re-pin its own lower floor.
//
// The lock has two halves:
//   policy, budgets  hand-owned. A sync copies them through unchanged. Raise a floor by hand when a skill grows on
//                    purpose; never lower one to get a test green.
//   skills, pack     generated. Per skill: SKILL.md bytes, body bytes and hash, file count, total bytes and one hash
//                    over every file's path, size and hash. pack: the sorted `npm pack --dry-run --json` file list.
//
// A skill on disk without a budget, or a budget whose skill is gone, is a violation until it is named:
// `--accept-new <id>` seeds a budget from today's size, `--drop <id>` removes an orphan one. While any violation
// stands the lock is not written and the exit code is 1. Only files git tracks are measured, so a stray local file
// never makes the lock stale; a new skill must be `git add`ed before it is accepted.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { describeSpawn, runNpmSync, runSync } from '../plugin/lib/host-exec.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCK_FILE = join(root, 'skills.lock.json');
export const SKILLS_DIR = join(root, 'plugin', 'skills');
const NOTE = 'npm run sync:lock writes skills and pack. policy and budgets are hand-owned and every sync keeps them as written.';
// Ceilings of a newly accepted skill: half again its size today.
const HEADROOM = 1.5;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
export const bodyOf = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, '');
const down = (n) => Math.floor(n / 100) * 100;
const up = (n) => Math.ceil((n * HEADROOM) / 1000) * 1000;

// Path order of a sorted directory walk: segment by segment, so `a/x` sorts before `a-b/x`.
function bySegments(a, b) {
  const x = a.split('/');
  const y = b.split('/');
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return x.length - y.length;
}

function walk(dir, acc = []) {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

// Paths relative to dir that git tracks (in the index), skipping files deleted on disk; null outside a git work tree.
export function trackedFiles(dir) {
  const r = runSync('git', ['ls-files', '-z', '--', '.'], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split('\0').filter((f) => f && existsSync(join(dir, f)));
}

// Outside a git work tree (a throwaway test fixture) every file on disk counts.
const skillFiles = (skillsDir) => trackedFiles(skillsDir) ?? walk(skillsDir).map((f) => relative(skillsDir, f).split(sep).join('/'));

export function measureSkills(skillsDir = SKILLS_DIR, files = skillFiles(skillsDir)) {
  const groups = new Map();
  for (const f of [...files].sort(bySegments)) {
    const [id, ...rest] = f.split('/');
    if (!rest.length) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(rest.join('/'));
  }
  const skills = {};
  for (const id of [...groups.keys()].sort()) {
    const rels = groups.get(id);
    if (!rels.includes('SKILL.md')) continue;
    const md = readFileSync(join(skillsDir, id, 'SKILL.md'));
    let bytes = 0;
    const rows = rels.map((rel) => {
      const buf = readFileSync(join(skillsDir, id, rel));
      bytes += buf.length;
      return `${rel}\t${buf.length}\t${sha256(buf)}\n`;
    });
    skills[id] = {
      skillMd: { bytes: md.length, bodyBytes: Buffer.byteLength(bodyOf(md.toString('utf8'))), sha256: sha256(md) },
      files: rels.length,
      bytes,
      sha256: sha256(rows.join('')),
    };
  }
  return skills;
}

export function packList(cwd = root) {
  const r = runNpmSync(['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd, encoding: 'utf8' });
  if (r.error || r.status !== 0) throw new Error(`npm pack failed (${describeSpawn(r)})`);
  return JSON.parse(r.stdout)[0].files.map((f) => f.path).sort();
}

// npm packs untracked files too, so the pin keeps only tracked ones. A stray file that would ship is reported here and
// then fails the pack test in package.test.mjs until it is removed or added to git.
export function trackedOnly(pack, tracked) {
  const known = tracked ? new Set(tracked) : null;
  const sorted = [...pack].sort();
  return { pinned: sorted.filter((f) => !known || known.has(f)), untracked: sorted.filter((f) => known && !known.has(f)) };
}

// The floors carry the same four fields and the same round-down-to-100 rule the depth fixture used.
export function seedBudget(m) {
  return {
    minSkillBytes: down(m.skillMd.bytes),
    minBodyBytes: down(m.skillMd.bodyBytes),
    minFiles: m.files,
    minTotalBytes: down(m.bytes),
    maxFiles: Math.ceil(m.files * HEADROOM),
    maxTotalBytes: up(m.bytes),
  };
}

export function violations(skills, budgets, policy = {}) {
  const out = [];
  for (const id of [...new Set([...Object.keys(skills), ...Object.keys(budgets)])].sort()) {
    const m = skills[id];
    const b = budgets[id];
    if (!b) { out.push(`${id}: new skill without a budget (npm run sync:lock -- --accept-new ${id})`); continue; }
    if (!m) { out.push(`${id}: budget for a missing skill (npm run sync:lock -- --drop ${id})`); continue; }
    const { bytes: md, bodyBytes: body } = m.skillMd;
    if (md < b.minSkillBytes) out.push(`${id}: SKILL.md ${md} B < floor ${b.minSkillBytes} B`);
    if (body < b.minBodyBytes) out.push(`${id}: SKILL.md body ${body} B < floor ${b.minBodyBytes} B`);
    // A skill that moved to wjgoarxiv-skills ships as a short pointer stub; only the family floor is waived for it.
    const movedStub = Object.hasOwn(policy.movedStubs ?? {}, id);
    if (policy.familyFloorBytes && !movedStub && md < policy.familyFloorBytes) out.push(`${id}: SKILL.md ${md} B < family floor ${policy.familyFloorBytes} B`);
    if (policy.bodyCapBytes && body > policy.bodyCapBytes) out.push(`${id}: SKILL.md body ${body} B > the ${policy.bodyCapBytes} B agy loads; move detail into references/`);
    if (m.files < b.minFiles) out.push(`${id}: ${m.files} files < floor ${b.minFiles}`);
    if (m.files > b.maxFiles) out.push(`${id}: ${m.files} files > ceiling ${b.maxFiles}`);
    if (m.bytes < b.minTotalBytes) out.push(`${id}: ${m.bytes} B in the folder < floor ${b.minTotalBytes} B`);
    if (m.bytes > b.maxTotalBytes) out.push(`${id}: ${m.bytes} B in the folder > ceiling ${b.maxTotalBytes} B`);
  }
  return out;
}

const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

// Budgets pass through as written. Only an id named in acceptNew gains one and only an id named in drop loses one.
export function buildLock({ skillsDir = SKILLS_DIR, pack, previous = {}, acceptNew = [], drop = [] }) {
  const skills = measureSkills(skillsDir);
  const kept = previous.budgets ?? {};
  for (const id of acceptNew) if (!skills[id] || kept[id]) throw new Error(`--accept-new ${id}: not a new skill`);
  for (const id of drop) if (skills[id] || !kept[id]) throw new Error(`--drop ${id}: not a missing skill`);
  const budgets = {};
  for (const [id, b] of Object.entries(kept)) if (!drop.includes(id)) budgets[id] = b;
  for (const id of acceptNew) budgets[id] = seedBudget(skills[id]);
  return { note: NOTE, policy: previous.policy ?? {}, budgets: sortKeys(budgets), skills, pack: [...(pack ?? previous.pack ?? [])].sort() };
}

export const readLock = (file = LOCK_FILE) => JSON.parse(readFileSync(file, 'utf8'));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      'accept-new': { type: 'string', multiple: true, default: [] },
      drop: { type: 'string', multiple: true, default: [] },
      // For tests: point at a fixture skills folder and lock, and keep the lock's pack list instead of running npm.
      skills: { type: 'string', default: SKILLS_DIR },
      lock: { type: 'string', default: LOCK_FILE },
      'no-pack': { type: 'boolean', default: false },
    },
  });
  const previous = existsSync(values.lock) ? readLock(values.lock) : {};
  const acceptNew = values['accept-new'];
  const drop = values.drop;
  let lock;
  try {
    let pack;
    if (!values['no-pack']) {
      const { pinned, untracked } = trackedOnly(packList(), trackedFiles(root));
      for (const f of untracked) console.log(`not pinned (untracked, but npm would pack it): ${f}`);
      pack = pinned;
    }
    lock = buildLock({ skillsDir: values.skills, pack, previous, acceptNew, drop });
  } catch (err) {
    console.error(`skills.lock.json not written: ${err.message}`);
    process.exit(1);
  }
  const broken = violations(lock.skills, lock.budgets, lock.policy);
  if (broken.length) {
    console.log(`skills.lock.json not written: ${broken.length} budget violation(s)`);
    for (const line of broken) console.log(`  ${line}`);
    process.exitCode = 1;
  } else {
    const text = `${JSON.stringify(lock, null, 2)}\n`;
    const same = existsSync(values.lock) && readFileSync(values.lock, 'utf8') === text;
    if (!same) writeFileSync(values.lock, text);
    for (const id of acceptNew) {
      const b = lock.budgets[id];
      console.log(`seeded budget: ${id} (SKILL.md >= ${b.minSkillBytes} B, ${b.minFiles}-${b.maxFiles} files, ${b.minTotalBytes}-${b.maxTotalBytes} B in the folder)`);
    }
    for (const id of drop) console.log(`dropped budget: ${id}`);
    console.log(`skills.lock.json: ${same ? 'already current' : 'updated'} · ${Object.keys(lock.skills).length} skills, ${lock.pack.length} packed files`);
  }
}
