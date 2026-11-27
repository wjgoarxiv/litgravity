#!/usr/bin/env node
// Scores the suggestion rules of plugin/hooks/lib/suggest.mjs on test/fixtures/routing-eval.
//
//   node scripts/routing-eval.mjs [--split dev|heldout] [--json]
//   node scripts/routing-eval.mjs --seal      # pin heldout.json's sha256 (only when the held-out half is written)
//   node scripts/routing-eval.mjs --record    # score the held-out half once; writes metrics only to heldout-score.json
//
// Per skill: recall over the prompts that expect it, and near-miss false positives over the prompts marked
// near_miss_of it. A rule ships only at recall >= 0.85 and near-miss FP <= 0.10 on dev and then on held-out. The
// held-out half is scored only while its sha256 matches heldout.sha256, so it cannot be tuned against quietly.
// TRIALS are the rules tried and dropped; they are scored here so the evidence shows why.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, KNOWLEDGE, MAKE, cleanPrompt } from '../plugin/hooks/lib/suggest.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'routing-eval');
export const RECALL_MIN = 0.85;
export const NEAR_MISS_MAX = 0.10;

const VAGUE = /\b(?:help|improve|nicer|better|set (?:something|it|this) up|build me|do the thing|something)\b|도와|개선|좋게/i;
const CONCRETE = /[./`]|\b(?:function|test|file|flag|variable|readme|api|cli|class|bug|error)\b/i;
const IDEA_NOUN = /\b(?:options|ideas|alternatives|approaches|names for|brainstorm)\b|아이디어|선택지|방안|브레인스토밍/i;
const IDEA_ASK = /\b(?:what are|give me|suggest|list|brainstorm|come up|think of)\b|있을까|줘/i;

const DIAGRAM_NOUN = /\b(?:diagram|flow ?chart|sequence diagram|architecture (?:map|chart|picture|overview)|system map|timeline graphic|mind ?map|er diagram|state machine diagram)\b|다이어그램|도식|개념도|개요도|흐름도|구성도|순서도|아키텍처\s?그림/i;

// Held-out 2026-11-27: diagram near-miss FP 0.2, deep-interview recall 0.714, brainstorm near-miss FP 0.2
// (heldout-score.json). None of the three ships.
export const TRIALS = [
  { id: 'lit-diagram-drawer', test: (t) => DIAGRAM_NOUN.test(t) && MAKE.test(t) && !KNOWLEDGE.test(t) },
  { id: 'deep-interview', test: (t) => t.split(/\s+/).length <= 8 && VAGUE.test(t) && !CONCRETE.test(t) },
  { id: 'lit-brainstorm', test: (t) => IDEA_NOUN.test(t) && IDEA_ASK.test(t) && !/^(?:what is|explain)\b/i.test(t) },
];

export const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

export function load(split, dir = DIR) {
  const file = join(dir, `${split}.json`);
  if (split === 'heldout') {
    const want = readFileSync(join(dir, 'heldout.sha256'), 'utf8').trim();
    const got = digest(file);
    if (want !== got) throw new Error(`heldout.json sha256 ${got} differs from the sealed ${want}; the held-out half is not scored`);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function score(split, dir = DIR) {
  const items = load(split, dir);
  const out = {};
  for (const rule of [...RULES.map((r) => ({ ...r, shipped: true })), ...TRIALS.map((r) => ({ ...r, shipped: false }))]) {
    const pos = items.filter((i) => (i.expect ?? []).includes(rule.id));
    const near = items.filter((i) => (i.near_miss_of ?? []).includes(rule.id));
    const fires = (i) => rule.test(cleanPrompt(i.prompt));
    const hit = pos.filter(fires);
    const fp = near.filter(fires);
    const recall = pos.length ? hit.length / pos.length : 0;
    const nearMiss = near.length ? fp.length / near.length : 0;
    out[rule.id] = {
      shipped: rule.shipped, positives: pos.length, nearMisses: near.length,
      recall: Number(recall.toFixed(3)), nearMissFP: Number(nearMiss.toFixed(3)),
      pass: recall >= RECALL_MIN && nearMiss <= NEAR_MISS_MAX,
      missed: pos.filter((i) => !fires(i)).map((i) => i.prompt), falsePositives: fp.map((i) => i.prompt),
    };
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (args.includes('--seal')) {
    const d = digest(join(DIR, 'heldout.json'));
    writeFileSync(join(DIR, 'heldout.sha256'), `${d}\n`);
    process.stdout.write(`sealed heldout.json ${d}\n`);
    process.exit(0);
  }
  if (args.includes('--record')) {
    // The one scoring of the held-out half: metrics only, no prompts, written beside the seal for npm test to check.
    const result = score('heldout');
    const rules = Object.fromEntries(Object.entries(result).map(([id, r]) => [id, { shipped: r.shipped, positives: r.positives, nearMisses: r.nearMisses, recall: r.recall, nearMissFP: r.nearMissFP, pass: r.pass }]));
    const record = { sha256: digest(join(DIR, 'heldout.json')), rules };
    writeFileSync(join(DIR, 'heldout-score.json'), `${JSON.stringify(record, null, 2)}\n`);
    for (const [id, r] of Object.entries(rules)) process.stdout.write(`${r.pass ? 'PASS' : 'FAIL'} ${r.shipped ? 'shipped' : 'trial  '} ${id}: recall ${r.recall} (${r.positives}), near-miss FP ${r.nearMissFP} (${r.nearMisses})\n`);
    process.exit(0);
  }
  const split = args.includes('--split') ? args[args.indexOf('--split') + 1] : 'dev';
  const result = score(split);
  if (args.includes('--json')) process.stdout.write(`${JSON.stringify({ split, result }, null, 2)}\n`);
  else {
    for (const [id, r] of Object.entries(result)) {
      process.stdout.write(`${r.pass ? 'PASS' : 'FAIL'} ${r.shipped ? 'shipped' : 'trial  '} ${id}: recall ${r.recall} (${r.positives}), near-miss FP ${r.nearMissFP} (${r.nearMisses})\n`);
      for (const m of r.missed) process.stdout.write(`    missed: ${m}\n`);
      for (const f of r.falsePositives) process.stdout.write(`    false positive: ${f}\n`);
    }
  }
}
