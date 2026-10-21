#!/usr/bin/env node
// Read-only progress probe for start-work. Prints ticked/total, the next open implementation row whose
// dependencies are ticked, the rows that may run in parallel and the open final-verifier rows. Writes nothing.
// Dependency-free Node ESM.
//
//   node next-row.mjs <plans/slug.md> [--json]
//
// Rows are column-zero `- [ ] N. title` / `- [x] N. title` (implementation) and `- [ ] F1. title` (final verifier)
// outside code fences, the shape lit-plan's checker and the Stop hook read. A row's `Depends on` line may sit in
// its indented block. Exit 0 with a result, 1 when the plan cannot be read, 2 on a usage error.

import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROW = /^- \[([ xX])\] (\d+)\. (.+)$/u;
const FINAL = /^- \[([ xX])\] F(\d+)\. (.+)$/u;
const MAX_BYTES = 256 * 1024;

function usage() {
  process.stderr.write('usage: next-row.mjs <plan.md> [--json]\n');
  process.exit(2);
}

const args = process.argv.slice(2);
const json = args.includes('--json');
const files = args.filter((a) => a !== '--json');
if (files.length !== 1) usage();

let text;
try {
  const path = resolve(process.cwd(), files[0]);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) throw new Error('plan must be a regular file under 256 KiB');
  text = readFileSync(path, 'utf8');
} catch (error) {
  process.stderr.write(`FAIL PLAN_READ: ${error.message}\n`);
  process.exit(1);
}

const visible = [];
let fence = null;
for (const line of text.split(/\r?\n/u)) {
  const m = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
  if (!fence && m) {
    fence = { marker: m[1][0], length: m[1].length };
    continue;
  }
  if (fence && m && m[1][0] === fence.marker && m[1].length >= fence.length && m[2].trim() === '') {
    fence = null;
    continue;
  }
  if (!fence) visible.push(line);
}

const rows = [];
const finals = [];
visible.forEach((line, at) => {
  const r = ROW.exec(line);
  const f = FINAL.exec(line);
  if (!r && !f) return;
  const body = [];
  for (let i = at + 1; i < visible.length; i += 1) {
    const next = visible[i];
    if (ROW.test(next) || FINAL.test(next) || /^#{1,6} /u.test(next)) break;
    body.push(next);
  }
  if (r) {
    const dep = /Depends on\s*:\s*(.+)/iu.exec(body.join('\n'));
    const depends = dep ? [...dep[1].matchAll(/\d+/gu)].map((x) => Number(x[0])) : [];
    rows.push({ number: Number(r[2]), title: r[3].trim(), done: r[1] !== ' ', depends });
  } else {
    finals.push({ number: Number(f[2]), title: f[3].trim(), done: f[1] !== ' ' });
  }
});

const ticked = new Set(rows.filter((r) => r.done).map((r) => r.number));
const open = rows.filter((r) => !r.done);
const ready = open.filter((r) => r.depends.every((d) => ticked.has(d)));
const result = {
  plan: files[0],
  rows: rows.length,
  ticked: ticked.size,
  open: open.map((r) => r.number),
  next: ready[0] ?? null,
  parallelReady: ready.map((r) => r.number),
  blockedByDependency: open.filter((r) => !ready.includes(r)).map((r) => ({ number: r.number, waitingFor: r.depends.filter((d) => !ticked.has(d)) })),
  finals: finals.map((f) => ({ number: f.number, done: f.done })),
  finalsOpen: finals.filter((f) => !f.done).map((f) => `F${f.number}`),
};

if (json) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
} else {
  const next = result.next
    ? `next open row ${result.next.number}: ${result.next.title}`
    : (result.open.length ? 'no open row has all dependencies ticked' : 'no open implementation row');
  const fin = result.finals.length ? `; final rows open: ${result.finalsOpen.join(', ') || 'none'}` : '';
  process.stdout.write(`${result.ticked}/${result.rows} rows ticked; ${next}${fin}\n`);
}
