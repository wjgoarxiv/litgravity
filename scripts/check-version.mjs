#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const manifest = JSON.parse(readFileSync(join(root, 'plugin', 'plugin.json'), 'utf8')).version;
const changelog = /^## (\d+\.\d+\.\d+)/m.exec(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'))?.[1];
const rows = { 'package.json': pkg, 'plugin/plugin.json': manifest, 'CHANGELOG.md (top)': changelog };
for (const [k, v] of Object.entries(rows)) console.log(`${k.padEnd(36)} ${v}`);
const ok = manifest === pkg && changelog === pkg;
console.log(ok ? 'version lockstep: OK' : 'version lockstep: MISMATCH');
process.exitCode = ok ? 0 : 1;
