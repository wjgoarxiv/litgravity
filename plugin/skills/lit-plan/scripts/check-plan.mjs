#!/usr/bin/env node
// check-plan.mjs: structural checker for plans/<slug>.md, as read by start-work, the Stop hook and the resume logic.
//
//   node check-plan.mjs --check <plan.md>      handoff check: structure complete, rows may be unchecked
//   node check-plan.mjs --complete <plan.md>   post-execution audit: structure complete and every row ticked
//   node check-plan.mjs --skeleton <slug>      print templates/plan.md for <slug> on stdout (writes nothing)
//
// Node built-ins only. Reads one file, refuses symlinks and files over 256 KiB, and writes only to stdout and stderr,
// which is why a planning turn may run it. Exit 0 = pass, 1 = findings, 2 = usage.

import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const WORK_ROW = /^- \[[ xX]\] (\d+)\. .+$/u;
const FINAL_ROW = /^- \[[ xX]\] F(\d+)\. .+$/u;
const INDENTED_ROW = /^[ \t]+- \[[ xX]\] (?:\d+|F\d+)\. /u;
const MAX_BYTES = 256 * 1024;

export const SECTIONS = [
  '## TL;DR (for humans)', '## Scope', '## Bootstrap', '## Verification strategy', '## Execution strategy',
  '## Todos', '## Final verification wave', '## Commit strategy', '## Success criteria', '## DoneClaim',
];
export const ROW_LABELS = ['What to do', 'Files', 'References', 'Tests', 'Acceptance', 'QA scenario', 'Depends on', 'Commit'];
export const STATUSES = ['approved', 'awaiting approval', 'assumptions unconfirmed'];

// Lines outside code fences, with their original index, so a quoted example never counts as structure.
export function visibleLines(text) {
  const out = [];
  let fence = null;
  text.split(/\r?\n/u).forEach((line, index) => {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    if (!fence && m) {
      fence = { char: m[1][0], size: m[1].length };
    } else if (fence && m && m[1][0] === fence.char && m[1].length >= fence.size && m[2].trim() === '') {
      fence = null;
    } else if (!fence) {
      out.push({ line, index });
    }
  });
  return out;
}

function rowBlock(lines, at, rows) {
  const end = rows[at + 1]?.index ?? Number.MAX_SAFE_INTEGER;
  const block = [];
  for (const v of lines) {
    if (v.index <= rows[at].index || v.index >= end) continue;
    if (/^#{1,6} /u.test(v.line)) break;
    block.push(v.line);
  }
  return block.join('\n');
}

export function checkPlan(text, { complete = false } = {}) {
  const problems = [];
  const lines = visibleLines(text);

  const status = lines.map(({ line }) => /^Status:\s*(.+?)\s*$/u.exec(line)).find(Boolean);
  if (!status) problems.push('missing header line: Status: approved | awaiting approval | assumptions unconfirmed');
  else if (!STATUSES.includes(status[1].toLowerCase())) problems.push(`unknown Status value: ${status[1]}`);

  let last = -1;
  for (const header of SECTIONS) {
    const hit = lines.find(({ line }) => line.trimEnd() === header);
    if (!hit) problems.push(`missing section: ${header}`);
    else if (hit.index < last) problems.push(`section out of order: ${header}`);
    else last = hit.index;
  }

  const work = lines.filter(({ line }) => WORK_ROW.test(line));
  const finals = lines.filter(({ line }) => FINAL_ROW.test(line));
  if (!work.length) problems.push('no implementation rows: expected at least one column-zero `- [ ] N. <title>`');
  if (!finals.length) problems.push('no final-verifier rows: expected column-zero `- [ ] F<number>. <title>`');
  for (const { line } of lines) {
    if (INDENTED_ROW.test(line)) problems.push(`indented task row is invisible to start-work: ${line.trim()}`);
  }

  const numbers = work.map(({ line }) => Number(WORK_ROW.exec(line)[1]));
  const repeated = new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i));
  if (repeated.size) problems.push(`duplicate task numbers: ${[...repeated].join(', ')}`);
  numbers.forEach((n, i) => {
    if (n !== i + 1 && !repeated.has(n)) problems.push(`task numbers are not consecutive from 1: found ${n} at position ${i + 1}`);
  });
  finals.map(({ line }) => Number(FINAL_ROW.exec(line)[1])).forEach((n, i) => {
    if (n !== i + 1) problems.push(`final-verifier numbers are not consecutive from F1: found F${n} at position ${i + 1}`);
  });
  if (work.length && finals.length && finals[0].index < work[work.length - 1].index) {
    problems.push('final-verifier rows must come after the last implementation row');
  }

  const rows = lines.filter(({ line }) => WORK_ROW.test(line) || FINAL_ROW.test(line));
  rows.forEach(({ line }, at) => {
    if (!WORK_ROW.test(line)) return;
    const body = rowBlock(lines, at, rows);
    for (const label of ROW_LABELS) {
      if (!new RegExp(`(^|[^A-Za-z])${label}\\s*:`, 'iu').test(body)) problems.push(`${line.trim()} - missing "${label}:"`);
    }
  });

  if (/<fill\b/u.test(text)) problems.push('unfilled <fill ...> placeholders remain: the plan is not decision-complete');
  if (complete) {
    for (const { line } of rows) if (/^- \[ \] /u.test(line)) problems.push(`row still open: ${line.trim()}`);
  }
  return { ok: problems.length === 0, problems, rows: work.length, finals: finals.length, status: status ? status[1] : null };
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  return 1;
}

function checkFile(planPath, options) {
  const path = resolve(process.cwd(), planPath);
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return fail(`FAIL PLAN_NOT_FOUND: ${path}`);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) return fail(`FAIL PLAN_UNSAFE: ${path} must be a regular file`);
  if (stat.size > MAX_BYTES) return fail(`FAIL PLAN_TOO_LARGE: ${path}`);
  const result = checkPlan(readFileSync(path, 'utf8'), options);
  if (!result.ok) {
    for (const problem of result.problems) process.stderr.write(`FAIL ${problem}\n`);
    return 1;
  }
  process.stdout.write(`${options.complete ? 'PLAN_COMPLETE_PASS' : 'PLAN_STRUCTURE_PASS'} ${planPath} rows=${result.rows} final=${result.finals} status="${result.status}"\n`);
  return 0;
}

function skeleton(slug) {
  if (typeof slug !== 'string' || slug.length === 0 || slug.length > 40 || !SLUG_PATTERN.test(slug)) {
    return fail('refused: slug must be lowercase kebab-case, at most 40 characters');
  }
  const template = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'plan.md');
  if (!existsSync(template)) return fail(`FAIL TEMPLATE_NOT_FOUND: ${template}`);
  process.stdout.write(readFileSync(template, 'utf8').replaceAll('{{slug}}', slug));
  return 0;
}

export function run(argv = process.argv.slice(2)) {
  const [mode, value, ...rest] = argv;
  if (rest.length || !value) return usage();
  if (mode === '--check') return checkFile(value, { complete: false });
  if (mode === '--complete') return checkFile(value, { complete: true });
  if (mode === '--skeleton') return skeleton(value);
  return usage();
}

function usage() {
  process.stderr.write('usage: check-plan.mjs --check <plan.md> | --complete <plan.md> | --skeleton <slug>\n');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = run();
  } catch (error) {
    process.exitCode = fail(error instanceof Error ? error.message : String(error));
  }
}
