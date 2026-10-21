#!/usr/bin/env node
// Integrity check for the lit-handoff reference closure (Node stdlib only, read-only).
//   node verify-closure.mjs [--json]
// Exit 0: every bundled file matches its recorded SHA-256. Exit 1: a file differs, is missing or is a symlink.
// Exit 2: unknown argument. The recorded hashes are listed in reference/PROVENANCE.md.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

// origin: byte-for-byte snapshot of the MIT-licensed handoff contract; agy: re-expressed for agy in this skill.
const EXPECTED = {
  'reference/canonical-handoff.md': { origin: 'snapshot', sha256: 'e5bbd253dfa5b5baa9739dfaebc458003daab43cb27c4a407423da1e7a31dec6' },
  'templates/HANDOFF.md': { origin: 'snapshot', sha256: '2a795a06e7bb81a57e6675ae70ed26db0dbfdb792c01f0a60f96f02cbef49fbd' },
  'examples/HANDOFF-example-generic-auth-refactor.md': { origin: 'snapshot', sha256: '43c767e573ac8c8900832d2b7a92ee1e83fd2d3d794fe2c82ecef87e5737f2a3' },
  'evals/evals.json': { origin: 'agy', sha256: '86a504e5c964c02c7a89eabffdf85c56b2579435cd3ff360c8f78e5178a31645' },
};

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== '--json');
if (unknown.length) {
  console.error(`usage: node verify-closure.mjs [--json]  (unknown: ${unknown.join(' ')})`);
  process.exit(2);
}

function check(file, { origin, sha256 }) {
  const full = path.join(SKILL_DIR, file);
  try {
    const st = lstatSync(full);
    if (st.isSymbolicLink()) return { file, origin, ok: false, actual: null, error: 'symlink refused' };
    if (!st.isFile()) return { file, origin, ok: false, actual: null, error: 'not a regular file' };
    const actual = createHash('sha256').update(readFileSync(full)).digest('hex');
    return { file, origin, ok: actual === sha256, actual };
  } catch (error) {
    return { file, origin, ok: false, actual: null, error: error.code ?? error.message };
  }
}

const results = Object.entries(EXPECTED).map(([file, want]) => check(file, want));
const ok = results.every((r) => r.ok);

if (args.includes('--json')) {
  console.log(JSON.stringify({ name: 'lit-handoff-closure', ok, files: results }, null, 2));
} else {
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.file} (${r.origin})${r.error ? ` - ${r.error}` : ''}`);
  console.log(ok ? 'PASS: handoff closure matches its recorded hashes' : 'FAIL: handoff closure differs from its recorded hashes');
}
process.exitCode = ok ? 0 : 1;
