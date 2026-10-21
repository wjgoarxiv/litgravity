#!/usr/bin/env node
// Appends one well-formed line to the conversation ledger, so shell quoting cannot corrupt the JSON.
// Dependency-free Node ESM. Touches nothing else.
//
//   node ledger-append.mjs --conversation <id> --kind note|evidence|decision --text "<text>" [--path <path>]
//
// The line is {"ts","kind","text","path"?} appended to .litgravity/ledger/<id>.jsonl under the current directory.
// Refuses a symlinked .litgravity or ledger folder. Exit 0 prints the file written, exit 2 is a usage error.

import { appendFileSync, lstatSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const KINDS = new Set(['note', 'evidence', 'decision']);
const flags = new Map();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  if (!argv[i].startsWith('--') || argv[i + 1] === undefined) {
    process.stderr.write(`bad argument near ${argv[i]}\n`);
    process.exit(2);
  }
  flags.set(argv[i].slice(2), argv[i + 1]);
}

const conversation = flags.get('conversation') ?? flags.get('session');
const kind = flags.get('kind');
const text = flags.get('text');
if (!conversation || !/^[A-Za-z0-9._-]{1,128}$/u.test(conversation) || conversation.startsWith('.')) {
  process.stderr.write('--conversation must be a plain id (letters, digits, dot, dash, underscore)\n');
  process.exit(2);
}
if (!KINDS.has(kind)) {
  process.stderr.write('--kind must be note, evidence or decision\n');
  process.exit(2);
}
if (!text || text.length > 4000) {
  process.stderr.write('--text is required and at most 4000 characters\n');
  process.exit(2);
}

const entry = { ts: new Date().toISOString(), kind, text };
if (flags.has('path')) entry.path = flags.get('path');

const state = join(process.cwd(), '.litgravity');
const dir = join(state, 'ledger');
for (const folder of [state, dir]) {
  try {
    if (lstatSync(folder).isSymbolicLink()) {
      process.stderr.write(`refusing a symlinked folder: ${folder}\n`);
      process.exit(2);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
mkdirSync(dir, { recursive: true });
const file = join(dir, `${conversation}.jsonl`);
appendFileSync(file, `${JSON.stringify(entry)}\n`);
process.stdout.write(`${file}\n`);
