#!/usr/bin/env node
// Re-pins the two generated fixtures after skills or package files change:
//   test/fixtures/skill-depth.json   per-skill floors (SKILL.md body bytes, file count, total bytes)
//   test/fixtures/pack-files.json    the `npm pack --dry-run --json --ignore-scripts` file list
// The depth floors are the current sizes rounded down to the nearest 100 bytes, so a skill can be edited freely but
// can never shrink below what was reviewed. Run `npm run sync:fixtures`, then read the diff before committing it.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeSpawn, runNpmSync } from '../plugin/lib/host-exec.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = join(root, 'plugin', 'skills');
const depthFile = join(root, 'test', 'fixtures', 'skill-depth.json');
const packFile = join(root, 'test', 'fixtures', 'pack-files.json');

function walk(dir, acc = []) {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const body = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, '');
const floor = (n) => Math.floor(n / 100) * 100;

const depth = JSON.parse(readFileSync(depthFile, 'utf8'));
const skills = {};
const ids = existsSync(skillsDir) ? readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory()).sort() : [];
for (const id of ids) {
  const files = walk(join(skillsDir, id));
  const md = readFileSync(join(skillsDir, id, 'SKILL.md'), 'utf8');
  skills[id] = {
    minSkillBytes: floor(Buffer.byteLength(md)),
    minBodyBytes: floor(Buffer.byteLength(body(md))),
    minFiles: files.length,
    minTotalBytes: floor(files.reduce((n, f) => n + statSync(f).size, 0)),
  };
}
depth.skills = skills;
depth.runtimes = [...new Set(ids.flatMap((id) => {
  const scripts = join(skillsDir, id, 'scripts');
  return existsSync(scripts) ? readdirSync(scripts).filter((f) => f.endsWith('-runtime.mjs')).map((f) => f.slice(0, -'-runtime.mjs'.length)) : [];
}).concat(existsSync(join(root, 'plugin', 'lib')) ? readdirSync(join(root, 'plugin', 'lib')).filter((f) => f.endsWith('-runtime.mjs')).map((f) => f.slice(0, -'-runtime.mjs'.length)) : []))].sort();
writeFileSync(depthFile, `${JSON.stringify(depth, null, 2)}\n`);

const pack = runNpmSync(['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
if (pack.error || pack.status !== 0) {
  console.error(`npm pack failed (${describeSpawn(pack)})`);
  process.exit(1);
}
const list = JSON.parse(pack.stdout)[0].files.map((f) => f.path).sort();
writeFileSync(packFile, `${JSON.stringify(list, null, 2)}\n`);
console.log(`skill-depth.json: ${ids.length} skills, ${depth.runtimes.length} runtimes · pack-files.json: ${list.length} files`);
