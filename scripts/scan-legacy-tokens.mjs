#!/usr/bin/env node
// Fails when shipped files carry identifiers from another tool's vocabulary.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = [/CLAUDE_PLUGIN_ROOT/, /\/litclaude:/, /TodoWrite/, /\bSkill\(/, /\.claude-plugin\//, /read_skill/, /subagent_spawn/, /request_user_input/, /\.muse-plugin/, /\.litmuse\b/];
const SCAN = ['plugin', 'lib', 'bin', 'README.md', 'README_ko-KR.md', 'CHANGELOG.md'];

function files(p) {
  const st = statSync(p);
  if (!st.isDirectory()) return [p];
  return readdirSync(p).flatMap((n) => files(join(p, n)));
}

const offenders = [];
for (const entry of SCAN) {
  if (!existsSync(join(root, entry))) continue;
  for (const f of files(join(root, entry))) {
    const buf = readFileSync(f);
    if (buf.includes(0)) continue; // fonts, images and other binaries carry no vocabulary
    const text = buf.toString('utf8');
    for (const re of TOKENS) if (re.test(text)) offenders.push(`${relative(root, f)}: ${re}`);
  }
}
for (const o of offenders) console.log(o);
console.log(offenders.length ? `scan FAIL (${offenders.length} offenders)` : 'scan OK');
process.exitCode = offenders.length ? 1 : 0;
