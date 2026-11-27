import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sandbox, workspace, turn, injected, ROOT } from './helpers.mjs';
import { RULES, DROPPED, CATALOG_LINE, firedRules, suggestionNote, cleanPrompt } from '../plugin/hooks/lib/suggest.mjs';
import { SKILL_IDS } from '../plugin/hooks/lib/routes.mjs';
import { score, digest, TRIALS, RECALL_MIN, NEAR_MISS_MAX } from '../scripts/routing-eval.mjs';

// Feature B of plans/2026-11-27-autopilot-port: suggestions for prompts typed without `lit`, in PreInvocation.

test('S-B-05 every shipped rule meets the gate on the dev half', () => {
  const result = score('dev');
  for (const rule of RULES) {
    const r = result[rule.id];
    assert.ok(r.recall >= RECALL_MIN, `dev ${rule.id}: recall ${r.recall} missed ${JSON.stringify(r.missed)}`);
    assert.ok(r.nearMissFP <= NEAR_MISS_MAX, `dev ${rule.id}: near-miss FP ${r.nearMissFP} ${JSON.stringify(r.falsePositives)}`);
  }
});

// The held-out half is scored once, outside npm test (`node scripts/routing-eval.mjs --record`), and only its metrics
// are kept, so no test run can be used to tune against it.
test('S-B-05 the recorded held-out score is for the sealed file, every shipped rule passed it, every dropped rule failed it', () => {
  const dir = join(ROOT, 'test', 'fixtures', 'routing-eval');
  const record = JSON.parse(readFileSync(join(dir, 'heldout-score.json'), 'utf8'));
  assert.equal(record.sha256, readFileSync(join(dir, 'heldout.sha256'), 'utf8').trim());
  assert.deepEqual(Object.keys(record.rules).sort(), [...RULES.map((r) => r.id), ...TRIALS.map((t) => t.id)].sort());
  for (const rule of RULES) assert.equal(record.rules[rule.id].pass, true, `${rule.id} ships without passing held-out`);
  assert.deepEqual(TRIALS.map((t) => t.id).sort(), [...DROPPED].sort());
  for (const id of DROPPED) {
    assert.ok(!RULES.some((r) => r.id === id), `${id} ships`);
    assert.equal(record.rules[id].pass, false, `${id} passed held-out and should ship`);
  }
  for (const r of Object.values(record.rules)) assert.deepEqual(Object.keys(r).sort(), ['nearMissFP', 'nearMisses', 'pass', 'positives', 'recall', 'shipped'], 'metrics only, no prompts');
  for (const rule of RULES) assert.ok(SKILL_IDS.has(rule.id), `${rule.id} is an enrolled skill`);
  const self = readFileSync(join(ROOT, 'test', 'suggest.test.mjs'), 'utf8');
  assert.equal((self.match(/score\('heldout'\)/g) ?? []).length, 0, 'npm test never scores the held-out half');
});

test('S-B-05 the held-out half is refused when its digest differs from the seal', () => {
  const dir = join(ROOT, 'test', 'fixtures', 'routing-eval');
  assert.equal(readFileSync(join(dir, 'heldout.sha256'), 'utf8').trim(), digest(join(dir, 'heldout.json')));
  const copy = mkdtempSync(join(tmpdir(), 'litgravity-eval-'));
  copyFileSync(join(dir, 'heldout.sha256'), join(copy, 'heldout.sha256'));
  writeFileSync(join(copy, 'heldout.json'), `${readFileSync(join(dir, 'heldout.json'), 'utf8')} `);
  assert.throws(() => score('heldout', copy), /differs from the sealed .*; the held-out half is not scored/);
});

test('S-B-01 a fired rule offers the skill plus none, and the model decides', () => {
  const note = suggestionNote('plot this csv');
  assert.match(note, /^LitGravity suggestion: these skills may fit this request\.\n- lit-scientific-visualization: /);
  assert.match(note, /- none: answer directly\./);
  assert.match(note, /Decide yes or no for each one; read the SKILL\.md only of those that fit, or none\. Nothing loads by itself/);
});

test('S-B-02 a lit prompt or a slash command gets no suggestion, and its route is unchanged', () => {
  const { env } = sandbox();
  const ws = workspace();
  const lit = injected(turn(ws, env, 'lit plot this csv', 0));
  assert.doesNotMatch(lit, /LitGravity suggestion|LitGravity skills \(/);
  assert.match(lit, /LIT IGNITED · lit-scientific-visualization/);
  assert.equal(suggestionNote('/litgravity:lit-docx plot this csv'), null);
  assert.equal(suggestionNote('please plot this csv with /litgravity:lit-scientific-visualization'), null, 'a slash command later in the prompt');
  assert.equal(suggestionNote('run /goal then plot this csv'), null);
  assert.match(suggestionNote('plot the csv in /srv/data/sensor.csv'), /LitGravity suggestion/, 'a path is not a slash command');
});

test('S-B-03 closed fences and inline code are stripped before the rules run', () => {
  assert.deepEqual(firedRules('what does this do?\n```\nplot the csv data\n```'), []);
  assert.deepEqual(firedRules('rename `plotCsvData` please'), []);
  assert.equal(cleanPrompt('a ```x``` b `y` c'), 'a b c');
});

test('S-B-04 no rule fired: one compact catalog line, within its pinned per-prompt budget', () => {
  assert.equal(suggestionNote('thanks, that works'), CATALOG_LINE);
  assert.ok(Buffer.byteLength(CATALOG_LINE) <= 600 - 60, `catalog line ${Buffer.byteLength(CATALOG_LINE)} B`);
  const ids = /routes directly\): ([^.]+)\./.exec(CATALOG_LINE)[1].split(', ');
  assert.equal(ids.length, 15);
  for (const id of ids) assert.ok(SKILL_IDS.has(id), id);
  const longest = suggestionNote('fix the crash and debug the stack trace, then plot the benchmark results data and make slides and a docx report and a kinetic typography video');
  assert.ok(Buffer.byteLength(longest) < 4096, 'the largest suggestion stays well inside one injected step');
});

test('S-B-06/08 Korean stems match as bare substrings; a noun used as a verb does not fire', () => {
  assert.deepEqual(firedRules('실험데이터플롯해줘'), ['lit-scientific-visualization']);
  assert.deepEqual(firedRules('excel at writing a docx report'), []);
});

test('S-B-07 the plain "plot this csv" prompt gets the hint through the real PreInvocation hook', () => {
  const { env } = sandbox();
  const ws = workspace();
  mkdirSync(join(ws.dir, 'x'));
  const text = injected(turn(ws, env, 'plot this csv', 0));
  assert.match(text, /LitGravity suggestion[\s\S]*lit-scientific-visualization[\s\S]*skills\/lit-scientific-visualization\/SKILL\.md/);
});
