#!/usr/bin/env node
// lit-humanizer self-test: every rule against its positive and negative fixture, context exemptions, tier
// regressions, the negative-pledge corpus, pos-real recall, Office extraction, the bounded JSON scanner and
// symlink refusal. Needs Node and python3 (stdlib only). Exit 0 on pass; an assertion failure exits non-zero.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseRules, scanText } from './core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rules = parseRules(readFileSync(resolve(root, 'rules.json'), 'utf8'));
const cases = JSON.parse(readFileSync(resolve(root, 'fixtures/rule-cases.json'), 'utf8'));
const positiveCounts = new Map(rules.map((rule) => [rule.id, 0]));
const negativeCounts = new Map(rules.map((rule) => [rule.id, 0]));

for (const rule of rules) {
  const positiveId = `${rule.id}:positive`;
  const negativeId = `${rule.id}:negative`;
  assert(rule.fixture_ids.includes(positiveId), `${rule.id} is missing its positive fixture id`);
  assert(rule.fixture_ids.includes(negativeId), `${rule.id} is missing its negative fixture id`);
  const positive = cases.positive[rule.id];
  const negative = cases.negative[rule.id];
  assert.equal(typeof positive, 'string', `missing positive fixture for ${rule.id}`);
  assert.equal(typeof negative, 'string', `missing negative fixture for ${rule.id}`);
  assert(scanText(positive, [rule], `${rule.id}-positive.txt`).length > 0, `${rule.id} missed its positive fixture`);
  assert.equal(scanText(negative, [rule], `${rule.id}-negative.txt`).length, 0, `${rule.id} hit its negative fixture`);
  positiveCounts.set(rule.id, 1);
  negativeCounts.set(rule.id, 1);
}

const pyCheck = spawnSync('python3', ['-c', 'import json,re,sys; rules=json.load(sys.stdin); flags={"i":re.I,"m":re.M,"s":re.S}; [re.compile(r["pattern"], sum((flags[f] for f in r["flags"]), 0)) for r in rules]'], {
  input: JSON.stringify(rules.map(({ id, pattern, flags }) => ({ id, pattern, flags }))), encoding: 'utf8',
});
assert.equal(pyCheck.status, 0, `Python re compilation failed: ${pyCheck.stderr}`);

const contextRules = [rules.find((rule) => rule.id === 'en-plain-meta-label')];
assert.equal(scanText('Source: report\n', contextRules, 'quoted.md').length, 1);
assert.equal(scanText('> Source: quoted user wording\n', contextRules, 'quoted.md').length, 0);
assert.equal(scanText('```text\nSource: fenced sample\n```\n', contextRules, 'fenced.md').length, 0);
assert.equal(scanText('Source: inline `example`\n', contextRules, 'inline.md').length, 1);
assert.equal(scanText('Figure 3. Results\nSource: city dataset\n', contextRules, 'caption.md').length, 0);
assert.equal(scanText('Figure 3. Results\n```text\ncaption sample\n```\nSource: unrelated note\n', contextRules, 'after-fence.md').length, 1,
  'caption attribution exemption must not cross a fenced-code boundary');

const metaRules = rules.filter((rule) => ['ko-plain-meta-label', 'en-plain-meta-label'].includes(rule.id));
for (const fixture of cases.contextCases.plainSourceAttached) {
  const findings = scanText(fixture.text, metaRules, `caption-${fixture.name}.md`);
  if (fixture.clean) assert.equal(findings.length, 0, `${fixture.name} plain attribution should be exempt`);
  else assert(findings.length > 0, `${fixture.name} should block as prose or caveat-bearing metadata`);
}

const contrastRule = rules.find((rule) => rule.id === 'en-not-x-but-y');
for (const fixture of cases.contextCases.contrastThreshold) {
  const findings = scanText(fixture.text, [contrastRule], `contrast-${fixture.name}.md`);
  if (fixture.warn) assert.equal(findings.length, 1, `${fixture.name} should warn`);
  else assert.equal(findings.length, 0, `${fixture.name} should remain clean`);
}

for (const fixture of cases.contextCases.tierRegressions) {
  const rule = rules.find((item) => item.id === fixture.rule);
  assert(rule, `${fixture.name} references missing rule ${fixture.rule}`);
  const findings = scanText(fixture.text, [rule], `tier-${fixture.name}.txt`);
  if (fixture.expect === 'clean') assert.equal(findings.length, 0, `${fixture.name} should remain clean`);
  else assert(findings.some((hit) => hit.severity === fixture.expect),
    `${fixture.name} should produce a ${fixture.expect} hit for ${fixture.rule}`);
}

const sentenceRule = rules.find((rule) => rule.id === 'en-forced-triad');
const wrapped = scanText('The proposal is robust,\nintuitive, and scalable.', [sentenceRule], 'wrapped-sentence.md');
assert.equal(wrapped.length, 1, 'sentence scope must join a soft-wrapped sentence');
assert.equal(wrapped[0].line, 1, 'wrapped sentence finding must retain its source line');
assert.equal(scanText('The proposal is robust.\nThis review is intuitive, and the tool is scalable.', [sentenceRule], 'separate-sentences.md').length, 0,
  'sentence scope must not join separate sentences');

const mixedEnglish = rules.find((rule) => rule.id === 'en-hope-helps');
assert.equal(scanText('I hope this helps — 한국어 설명도 있습니다.', [mixedEnglish], 'mixed-language.md').length, 1,
  'English rules must remain active on mixed-language text');

const attributionRule = rules.find((rule) => rule.id === 'code-ai-attribution');
for (const trailer of [
  'Generated by an AI assistant',
  'Generated with ChatGPT',
  'Co-Authored-By: ChatGPT <noreply@example.com>',
  'Authored-By: AI model'
]) {
  assert.equal(scanText(trailer, [attributionRule], 'commit-message.txt').length, 1,
    'AI attribution trailer should block: ' + trailer);
}
assert.equal(scanText('Generated with our build script', [attributionRule], 'commit-message.txt').length, 0,
  'ordinary build provenance should remain allowed');

const lineScopeRule = { ...contextRules[0], pattern: 'Alpha\\s+beta', regex: /Alpha\s+beta/i };
assert.equal(scanText('Alpha\nbeta', [lineScopeRule], 'line-scope.md').length, 0, 'line scope must stay on one physical line');
const documentScopeRule = { ...lineScopeRule, scope: 'document' };
const documentMatch = scanText('Alpha\nbeta', [documentScopeRule], 'document-scope.md');
assert.equal(documentMatch.length, 1, 'document scope must cross line breaks');
assert.equal(documentMatch[0].line, 1, 'document finding must retain its source line');

const negativeDir = resolve(root, 'fixtures/negative');
// The human-written comparison corpora (about 22 MB) are not shipped with the plugin. When a
// maintainer drops .txt files into fixtures/negative/, each must stay free of block hits.
const negativeFiles = existsSync(negativeDir) ? readdirSync(negativeDir).filter((name) => name.endsWith('.txt')).sort() : [];
const negativeByFile = new Map();
const negativeByRule = new Map(rules.map((rule) => [rule.id, { block: 0, warn: 0 }]));
for (const name of negativeFiles) {
  const file = resolve(negativeDir, name);
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const lineCount = content.endsWith('\n') ? lines.length - 1 : lines.length;
  const hits = scanText(content, rules, `fixtures/negative/${name}`);
  const blocks = hits.filter((hit) => hit.severity === 'block');
  negativeByFile.set(name, { lines: lineCount, block: blocks.length, warn: hits.length - blocks.length });
  assert.equal(blocks.length, 0, `block hit in human corpus ${name}: ${JSON.stringify(blocks[0])}`);
  for (const hit of hits) negativeByRule.get(hit.rule)[hit.severity] += 1;
}

const realLines = readFileSync(resolve(root, 'fixtures/pos-real.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
assert.equal(realLines.length, 26, 'all 26 real positive lines must remain represented');
const recallByRule = new Map(rules.map((rule) => [rule.id, 0]));
let recalled = 0;
let blockRecalled = 0;
let warnRecalled = 0;
for (const line of realLines) {
  const hits = scanText(line, rules, 'fixtures/pos-real.txt');
  if (hits.length > 0) recalled += 1;
  if (hits.some((hit) => hit.severity === 'block')) blockRecalled += 1;
  if (hits.some((hit) => hit.severity === 'warn')) warnRecalled += 1;
  for (const hit of hits) recallByRule.set(hit.rule, recallByRule.get(hit.rule) + 1);
}
assert(recalled >= 19, `canonical recall fell below 19/26: ${recalled}/26`);

const extractor = resolve(root, 'scripts/extract_office_text.py');
const detector = resolve(root, 'scripts/detect.mjs');
for (const [name, expected] of [['minimal.docx', 'I hope this helps.'], ['minimal.pptx', 'Source: report table 4.']]) {
  const file = resolve(root, 'fixtures/office', name);
  const extracted = spawnSync('python3', [extractor, file], { encoding: 'utf8' });
  assert.equal(extracted.status, 0, `${name} extraction failed: ${extracted.stderr}`);
  assert(extracted.stdout.includes(expected), `${name} did not yield expected text`);
  const detected = spawnSync(process.execPath, [detector, '--json', file], { encoding: 'utf8' });
  assert.equal(detected.status, 1, `${name} should report findings through Office extraction`);
  assert(JSON.parse(detected.stdout).summary.block > 0, `${name} should carry a block finding through Office extraction`);
}

// Negative-pledge corpus: pledges a model wrote must block under the named rule; near-misses (legal notices,
// real absences, procedure steps) must stay clear of the three pledge rules; document cases decide per text.
const pledgeCases = JSON.parse(readFileSync(resolve(root, 'fixtures/pledge-cases.json'), 'utf8'));
const pledgeRules = pledgeCases.new_rule_ids;
const severityRank = { none: 0, warn: 1, block: 2 };
for (const pledge of pledgeCases.pledges) {
  const hits = scanText(pledge.text, rules, 'pledge.md');
  if (pledge.severity === 'none') {
    assert.deepEqual(hits, [], `pledge ${pledge.n} should stay silent`);
    continue;
  }
  assert.equal(Math.max(...hits.map((hit) => severityRank[hit.severity])), severityRank[pledge.severity], `pledge ${pledge.n} top severity`);
  assert(hits.some((hit) => hit.rule === pledge.rule && hit.severity === pledge.severity), `pledge ${pledge.n} ${pledge.rule}`);
}
for (const pledge of pledgeCases.pledges_observed) {
  assert(scanText(pledge.text, rules, 'observed.md').some((hit) => hit.rule === pledge.rule && hit.severity === 'block'),
    `${pledge.rule} should block: ${pledge.text}`);
}
for (const near of [...pledgeCases.near_misses, ...pledgeCases.near_misses_review]) {
  assert.deepEqual(scanText(near.text, rules, 'near-miss.md').filter((hit) => pledgeRules.includes(hit.rule)), [], near.text);
}
for (const doc of pledgeCases.document_cases) {
  const blocked = scanText(doc.text, rules, 'document.md').some((hit) => hit.rule === doc.rule && hit.severity === 'block');
  assert.equal(blocked, doc.expect === 'block', JSON.stringify(doc.text));
}

// The bounded scanner keeps only findings that touch the changed ranges and rejects malformed input with exit 2.
const scanner = resolve(root, 'scripts/scan-input.mjs');
const scanRequest = { artifacts: [{ path: 'docs/update.md', text: 'I hope this helps.\n\nPlain status line.\n\nI hope this helps.\n', changed: [[3, 3]] }] };
const scoped = spawnSync(process.execPath, [scanner], { input: JSON.stringify(scanRequest), encoding: 'utf8' });
assert.equal(scoped.status, 0, `scan-input failed: ${scoped.stderr}`);
assert.equal(JSON.parse(scoped.stdout).total, 0, 'findings on unchanged lines must be filtered out');
scanRequest.artifacts[0].changed = [[5, 5]];
const touched = spawnSync(process.execPath, [scanner], { input: JSON.stringify(scanRequest), encoding: 'utf8' });
assert(JSON.parse(touched.stdout).findings.some((hit) => hit.rule === 'en-hope-helps' && hit.line === 5), 'a finding on a changed line must survive');
assert.equal(spawnSync(process.execPath, [scanner], { input: '{"artifacts":"x"}', encoding: 'utf8' }).status, 2, 'malformed scan input must exit 2');

// Symbolic links are refused by the detector, the metrics script and the Office extractor.
const scratch = mkdtempSync(join(tmpdir(), 'lit-humanizer-selftest-'));
try {
  const target = join(scratch, 'target.md');
  writeFileSync(target, 'Plain sentence.\n');
  symlinkSync(target, join(scratch, 'link.md'));
  symlinkSync(resolve(root, 'fixtures/office/minimal.docx'), join(scratch, 'link.docx'));
  assert.equal(spawnSync(process.execPath, [detector, join(scratch, 'link.md')], { encoding: 'utf8' }).status, 2, 'detector must refuse a symlink');
  assert.equal(spawnSync(process.execPath, [resolve(root, 'scripts/ko-metrics.mjs'), join(scratch, 'link.md')], { encoding: 'utf8' }).status, 2, 'ko-metrics must refuse a symlink');
  assert.equal(spawnSync('python3', [extractor, join(scratch, 'link.docx')], { encoding: 'utf8' }).status, 2, 'extractor must refuse a symlink');
  assert.equal(spawnSync(process.execPath, [detector, target], { encoding: 'utf8' }).status, 0, 'a clean regular file exits 0');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const byTierAndLang = new Map();
for (const rule of rules) {
  const key = `${rule.severity}/${rule.lang}`;
  byTierAndLang.set(key, (byTierAndLang.get(key) ?? 0) + 1);
}
const totalNegative = [...negativeByFile.values()].reduce((sum, value) => sum + value.lines, 0);
const totalWarn = [...negativeByFile.values()].reduce((sum, value) => sum + value.warn, 0);
process.stdout.write(`Rules: ${rules.length}; by severity/language: ${[...byTierAndLang].map(([key, count]) => `${key}=${count}`).join(', ')}\n`);
process.stdout.write(`Rule fixtures: ${positiveCounts.size} positive and ${negativeCounts.size} clean negative cases passed.\n`);
process.stdout.write(`Tier regression cases: ${cases.contextCases.tierRegressions.length} passed.\n`);
process.stdout.write(`pos-real recall: block ${blockRecalled}/26, warn ${warnRecalled}/26, combined ${recalled}/26; per-rule: ${[...recallByRule].filter(([, count]) => count).map(([id, count]) => `${id}=${count}`).join(', ')}\n`);
process.stdout.write(negativeFiles.length
  ? `Human corpus: ${negativeFiles.length} files, ${totalNegative} lines, 0 block hits, ${totalWarn} warning hits.\n`
  : 'Human corpus: not shipped (drop .txt files into fixtures/negative/ to enable the false-positive check).\n');
process.stdout.write(`Negative warning hits by rule: ${[...negativeByRule].filter(([, count]) => count.warn).map(([id, count]) => `${id}=${count.warn}`).join(', ')}\n`);
for (const [name, counts] of negativeByFile) process.stdout.write(`  ${name}: ${counts.lines} lines, ${counts.block} block, ${counts.warn} warn\n`);
process.stdout.write('Office extraction and detector delegation: DOCX and PPTX passed.\n');
process.stdout.write(`Negative-pledge corpus: ${pledgeCases.pledges.length} pledges, ${pledgeCases.pledges_observed.length} observed, ${pledgeCases.near_misses.length + pledgeCases.near_misses_review.length} near-misses, ${pledgeCases.document_cases.length} document cases passed.\n`);
process.stdout.write('Bounded scanner ranges and symlink refusal passed.\n');
