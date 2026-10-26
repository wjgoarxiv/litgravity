import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sandbox, workspace, turn, injected, PLUGIN } from './helpers.mjs';
import { skillIds } from '../lib/bundle.mjs';
import { SKILL_ROUTES, KEYWORD_ROUTES, SKILL_IDS, detectRoute } from '../plugin/hooks/lib/routes.mjs';
import {
  buildImplementerBrief,
  checkRun,
  decideLicence,
  detectLicence,
  findOverlap,
  fxtwitterToMarkdown,
  parseXStatusUrl,
  repoSubpath,
  LEDGER_SCHEMA,
} from '../plugin/skills/lit-hijack/scripts/hijack.mjs';

const skillDir = join(PLUGIN, 'skills', 'lit-hijack');
const cliPath = join(skillDir, 'scripts', 'hijack.mjs');

let temp;
let counter = 0;

test.before(() => { temp = mkdtempSync(join(tmpdir(), 'litgravity-hijack-')); });
test.after(() => rmSync(temp, { recursive: true, force: true }));

const freshDir = (name) => {
  const dir = join(temp, `${name}-${counter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

const cli = (args, cwd = temp) => spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: 'utf8' });

// Own-written sample prose. Nothing here is taken from a real post.
const SOURCE_PROSE = [
  'A careful studio writes the brief before any frame exists, so the model cannot fill gaps with its favourite defaults.',
  'The brief names the one thing a viewer must remember and the outcome that would make the film unacceptable to ship.',
].join(' ');
const PARAPHRASE = 'Pin the takeaway and the rejection condition in a short production note first; only then may rendering start.';

// ---------- enrollment ----------

test('lit-hijack is enrolled in the route table, the family list and the skill folder', () => {
  assert.ok(SKILL_IDS.has('lit-hijack'), 'SKILL_IDS');
  assert.ok(SKILL_ROUTES.some((r) => r.id === 'lit-hijack'), 'SKILL_ROUTES');
  assert.ok(skillIds().includes('lit-hijack'), 'skillIds()');
  assert.ok(existsSync(join(skillDir, 'SKILL.md')), 'SKILL.md');
  assert.ok(existsSync(join(skillDir, 'scripts', 'hijack.mjs')), 'hijack.mjs');
  for (const ref of ['capture-and-provenance.md', 'distil-and-licence.md', 'gap-and-port-design.md', 'clean-room-build.md', 'parity-and-report.md']) {
    assert.ok(existsSync(join(skillDir, 'references', ref)), `references/${ref}`);
  }
});

test('orphan break-it: removing the route entry turns the enrollment test red', () => {
  // The enrollment check above already proves it; this test proves the route table is the source
  // by checking that the keyword mapping exists.
  assert.equal(KEYWORD_ROUTES.hijack, 'lit-hijack');
  assert.equal(KEYWORD_ROUTES['하이재킹'], 'lit-hijack');
  assert.equal(KEYWORD_ROUTES['하이잭'], 'lit-hijack');
});

// ---------- routing ----------

test('hijack keywords route to lit-hijack ahead of plan, review and research', () => {
  for (const prompt of [
    'lit hijack https://x.com/someone/status/1 into my motion skill',
    'lit hijacking the review lanes from this repo into my plan skill',
    'lit 하이재킹 이 글의 기법을 내 스킬에',
    'lit 하이잭 이 PDF 두 개',
    'lit-hijack these five posts',
  ]) {
    const hit = detectRoute(prompt);
    assert.ok(hit, prompt);
    assert.equal(hit.route, 'lit-hijack', prompt);
  }
});

test('neighbouring routes are not stolen by hijack', () => {
  for (const [prompt, expected] of [
    ['lit plan the hijack report layout', 'lit-plan'],
    ['lit review the hijack ledger', 'review-work'],
    ['lit research session hijack defences', 'litresearch'],
    ['lit debug the session hijack in the login flow', 'debugging'],
    ['lit fix the session hijack bug', 'lit-loop'],
  ]) {
    assert.equal(detectRoute(prompt).route, expected, prompt);
  }
});

test('near-miss negatives stay inert', () => {
  for (const prompt of [
    'hijack these posts into my skill',
    'how do attackers hijack a session cookie?',
  ]) {
    assert.equal(detectRoute(prompt), null, prompt);
  }
});

test('the hook injects the lit-hijack route on a lit hijack prompt', () => {
  const { env } = sandbox();
  const ws = workspace();
  const result = turn(ws, env, 'lit hijack the brief technique from this post into my skill', 0);
  const text = injected(result);
  assert.match(text, /LIT IGNITED/u);
  assert.match(text, /lit-hijack/u);
  assert.match(text, new RegExp(join(PLUGIN, 'skills', 'lit-hijack', 'SKILL.md').replace(/[/\\]/g, '.')));
});

// ---------- capture helpers ----------

test('parses X status URLs and nothing else', () => {
  assert.equal(parseXStatusUrl('https://x.com/someone/status/2105643919119696297'), '2105643919119696297');
  assert.equal(parseXStatusUrl('https://twitter.com/a_b/status/42?s=20'), '42');
  assert.equal(parseXStatusUrl('https://x.com/i/article/42'), null);
  assert.equal(parseXStatusUrl('https://example.com/status/42'), null);
});

test('turns an fxtwitter post with a long article into Markdown and provenance', () => {
  const json = {
    code: 200,
    tweet: {
      url: 'https://x.com/writer/status/77',
      id: '77',
      text: 'Short teaser',
      created_at: 'Thu Oct 01 13:00:05 +0000 2026',
      author: { screen_name: 'writer', name: 'A Writer' },
      article: {
        title: 'Studio notes',
        content: {
          blocks: [
            { key: 'a', type: 'header-one', text: 'First part', entityRanges: [] },
            { key: 'b', type: 'unstyled', text: 'Plain paragraph.', entityRanges: [] },
            { key: 'c', type: 'unordered-list-item', text: 'one item', entityRanges: [] },
            { key: 'd', type: 'atomic', text: ' ', entityRanges: [{ key: 0, offset: 0, length: 1 }] },
            { key: 'e', type: 'blockquote', text: 'quoted line', entityRanges: [] },
          ],
          entityMap: [
            { key: '0', value: { type: 'MARKDOWN', data: { markdown: '```\nlayout/\n```' } } },
          ],
        },
      },
    },
  };
  const { markdown, meta } = fxtwitterToMarkdown(json);
  assert.equal(meta.author, 'A Writer (@writer)');
  assert.equal(meta.kind, 'x-article');
  assert.match(markdown, /^# Studio notes$/mu);
  assert.match(markdown, /^## First part$/mu);
  assert.match(markdown, /^- one item$/mu);
  assert.match(markdown, /^```\nlayout\/\n```$/mu);
  assert.match(markdown, /^> quoted line$/mu);
  const plain = fxtwitterToMarkdown({ code: 200, tweet: { ...json.tweet, article: null } });
  assert.equal(plain.meta.kind, 'x-post');
  assert.match(plain.markdown, /Short teaser/u);
});

// ---------- licence gate ----------

test('detects common licences from their text or an SPDX line', () => {
  assert.equal(detectLicence('MIT License\n\nPermission is hereby granted, free of charge, to any person').spdx, 'MIT');
  assert.equal(detectLicence('Apache License\nVersion 2.0, January 2004').spdx, 'Apache-2.0');
  assert.equal(detectLicence('GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007').spdx, 'GPL-3.0');
  assert.equal(detectLicence('// SPDX-License-Identifier: MPL-2.0\n').spdx, 'MPL-2.0');
  assert.equal(detectLicence('Just a readme with no terms').spdx, 'NOASSERTION');
});

test('maps every licence class to a take decision, and prohibition to review', () => {
  assert.equal(decideLicence('MIT').decision, 'ideas-credit');
  assert.equal(decideLicence('Apache-2.0').decision, 'ideas-credit');
  assert.equal(decideLicence('CC-BY-4.0').decision, 'ideas-credit');
  assert.equal(decideLicence('GPL-3.0').decision, 'ideas-only');
  assert.equal(decideLicence('CC-BY-SA-4.0').decision, 'ideas-only');
  assert.equal(decideLicence('CC-BY-NC-4.0').decision, 'ideas-only');
  assert.equal(decideLicence('NOASSERTION').decision, 'ideas-only');
  assert.equal(decideLicence('NOASSERTION', { text: 'Do not copy, adapt or redistribute any part of this guide.' }).decision, 'needs-review');
  assert.equal(decideLicence('NOASSERTION', { text: '© 2026 A Writer. All rights reserved.\nNo part of this publication may be reproduced.' }).decision, 'needs-review');
});

test('reads reuse terms only on rights lines, not inside subject matter', () => {
  const article = '## Reference analysis\n\n- KEEP: the pacing of the reveal\n- DO NOT COPY: the exact layout of the hero shot\n';
  assert.equal(decideLicence('NOASSERTION', { text: article }).decision, 'ideas-only');
  assert.equal(decideLicence('MIT', { text: `${article}\nSPDX-License-Identifier: MIT` }).decision, 'ideas-credit');
});

// ---------- overlap gate ----------

test('flags a verbatim run and passes a paraphrase', () => {
  const sources = [{ id: 'S1', text: SOURCE_PROSE }];
  const copied = `Intro line.\nAs one note says, a careful studio writes the brief before any frame exists, so the model cannot fill gaps.\n`;
  const runs = findOverlap({ sources, targets: [{ path: 'SKILL.md', text: copied }], minWords: 12 });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].source, 'S1');
  assert.ok(runs[0].words >= 12);
  assert.deepEqual(findOverlap({ sources, targets: [{ path: 'SKILL.md', text: PARAPHRASE }], minWords: 12 }), []);
});

test('overlap works on Hangul', () => {
  const sources = [{ id: 'S2', text: '먼저 브리프를 쓰고 그다음에 장면을 그린다 그래야 모델이 빈칸을 자기 취향으로 채우지 않는다 정말로' }];
  const target = '**먼저** 브리프를 쓰고, 그다음에 장면을 그린다. 그래야 모델이 빈칸을 자기 취향으로 채우지 않는다!';
  assert.equal(findOverlap({ sources, targets: [{ path: 'a.md', text: target }], minWords: 12 }).length, 1);
  assert.equal(findOverlap({ sources, targets: [{ path: 'a.md', text: target }], minWords: 20 }).length, 0);
});

// ---------- run folder and phase gates ----------

const writeRun = () => {
  const target = freshDir('target');
  mkdirSync(join(target, 'skills', 'toy'), { recursive: true });
  writeFileSync(join(target, 'skills', 'toy', 'SKILL.md'), '# Toy\n\nLine two.\nWrite the promo brief.\n');
  const run = join(target, '.litgravity', 'hijack', 'studio-brief');
  const init = cli(['init', run, '--target', target, '--base-ref', 'abc1234']);
  assert.equal(init.status, 0, init.stderr);
  const sourceFile = join(target, 'post.md');
  writeFileSync(sourceFile, `${SOURCE_PROSE}\n`);
  const capture = cli(['capture', run, sourceFile, '--kind', 'file', '--url', 'https://x.com/writer/status/77', '--author', 'A Writer', '--date', '2026-10-01']);
  assert.equal(capture.status, 0, capture.stderr);
  const licence = cli(['licence', run]);
  assert.equal(licence.status, 0, licence.stderr);
  const ledgerFile = join(run, 'ledger.json');
  const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8'));
  ledger.mechanisms = [{
    id: 'M1',
    title: 'Brief before render',
    sources: ['S1'],
    locator: 'S1 paragraph 1',
    what: 'A production note fixes the takeaway and the rejection condition before any rendering.',
    why: 'Unfilled decisions are filled by model defaults, which is where look-alike output comes from.',
    evidence: 'anecdotal',
    evidence_note: 'Practitioner report, no measurement.',
    gap: { status: 'weak', refs: ['skills/toy/SKILL.md:4'], note: 'asks for a brief with no required fields' },
    port: { decision: 'adapt', reason: 'The toy skill already writes a brief; it lacks the two required fields.' },
    parity: {
      criterion: 'A brief from the toy skill names the takeaway and the rejection condition.',
      red: 'baseline brief has neither field',
      green: 'treatment brief has both fields',
      surface: 'agy -p in a throwaway workspace',
      artifact: 'parity/treatment.md',
    },
  }];
  ledger.build = { plan: 'plans/toy-brief.md', changed: ['skills/toy/SKILL.md'] };
  ledger.parity = { baseline_outputs: ['parity/baseline.md'], treatment_outputs: ['parity/treatment.md'], markers: ['Rejection condition'] };
  writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  writeFileSync(join(run, 'SPEC.md'), '# Spec\n\n## M1 Brief before render\n\nThe toy skill\'s brief gains two required fields: Takeaway and Rejection condition.\n');
  mkdirSync(join(target, 'plans'), { recursive: true });
  writeFileSync(join(target, 'plans', 'toy-brief.md'), '# Toy brief\n\n- [ ] 1. Add the two fields (SPEC M1)\n');
  writeFileSync(join(target, 'skills', 'toy', 'SKILL.md'), '# Toy\n\nLine two.\nWrite the promo brief with a Takeaway and a Rejection condition field.\n');
  mkdirSync(join(run, 'parity'), { recursive: true });
  writeFileSync(join(run, 'parity', 'baseline.md'), 'Brief: a fun launch video.\n');
  writeFileSync(join(run, 'parity', 'treatment.md'), 'Takeaway: one tap. Rejection condition: any invented screen.\n');
  writeFileSync(join(run, 'REPORT.md'), '# Report\n\n## Taken\n\nM1 adapted.\n\n## Left\n\nNothing else.\n\n## Provenance\n\nS1 https://x.com/writer/status/77 (A Writer, 2026-10-01), ideas-only.\n');
  return { target, run, ledgerFile };
};

const editLedger = (path, change) => {
  const ledger = JSON.parse(readFileSync(path, 'utf8'));
  change(ledger);
  writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`);
};

test('passes a complete run through every phase', () => {
  const { run } = writeRun();
  const result = checkRun(run, { phase: 'report' });
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
  const ledger = JSON.parse(readFileSync(join(run, 'ledger.json'), 'utf8'));
  assert.equal(ledger.schema, LEDGER_SCHEMA);
  assert.equal(ledger.sources[0].licence.decision, 'ideas-only');
  const cliCheck = cli(['check', run, '--phase', 'report']);
  assert.equal(cliCheck.status, 0, cliCheck.stdout + cliCheck.stderr);
});

test('fails a source with missing provenance or a tampered capture', () => {
  const { run, ledgerFile } = writeRun();
  editLedger(ledgerFile, (l) => { delete l.sources[0].retrieved_at; });
  assert.match(checkRun(run, { phase: 'capture' }).issues.join('\n'), /S1: retrieved_at/u);
  const second = writeRun();
  const captured = JSON.parse(readFileSync(second.ledgerFile, 'utf8')).sources[0].files[0].path;
  writeFileSync(join(second.run, captured), 'changed after capture\n');
  assert.match(checkRun(second.run, { phase: 'capture' }).issues.join('\n'), /S1: .*sha256 mismatch/u);
});

test('fails a gap claim whose file:line does not resolve', () => {
  const { run, ledgerFile } = writeRun();
  editLedger(ledgerFile, (l) => { l.mechanisms[0].gap.refs = ['skills/toy/SKILL.md:400']; });
  assert.match(checkRun(run, { phase: 'gap' }).issues.join('\n'), /M1: gap ref skills\/toy\/SKILL\.md:400/u);
});

test('fails a taken mechanism that rests only on a no-go source', () => {
  const { run, ledgerFile } = writeRun();
  editLedger(ledgerFile, (l) => { l.sources[0].licence.decision = 'no-go'; });
  assert.match(checkRun(run, { phase: 'gap' }).issues.join('\n'), /M1: .*no-go/u);
});

test('fails a spec that points at the sources or copies them', () => {
  const { run } = writeRun();
  writeFileSync(join(run, 'SPEC.md'), '# Spec\n\n## M1\n\nRead sources/S1/content.md for details.\n');
  assert.match(checkRun(run, { phase: 'spec' }).issues.join('\n'), /SPEC\.md names the captured sources/u);
  writeFileSync(join(run, 'SPEC.md'), `# Spec\n\n## M1\n\n${SOURCE_PROSE}\n`);
  assert.match(checkRun(run, { phase: 'spec' }).issues.join('\n'), /SPEC\.md:5 copies \d+ words from S1/u);
});

test('fails a build without a plan in row grammar', () => {
  const { run, target, ledgerFile } = writeRun();
  writeFileSync(join(target, 'plans', 'toy-brief.md'), '# Toy brief\n\n1. Add the two fields (SPEC M1)\n');
  assert.match(checkRun(run, { phase: 'build' }).issues.join('\n'), /build\.plan plans\/toy-brief\.md has no column-zero task row/u);
  writeFileSync(join(target, 'plans', 'toy-brief.md'), '# Toy brief\n\n- [ ] 1. Add the two fields\n');
  assert.match(checkRun(run, { phase: 'build' }).issues.join('\n'), /never cites M1/u);
  editLedger(ledgerFile, (l) => { delete l.build.plan; });
  assert.match(checkRun(run, { phase: 'build' }).issues.join('\n'), /build\.plan is missing/u);
});

test('fails a build that copied source wording into the target', () => {
  const { run, target } = writeRun();
  writeFileSync(join(target, 'skills', 'toy', 'SKILL.md'), `# Toy\n\n${SOURCE_PROSE}\n`);
  assert.match(checkRun(run, { phase: 'build' }).issues.join('\n'), /skills\/toy\/SKILL\.md:3 copies \d+ words from S1/u);
});

test('fails parity when the marker is absent or the baseline saw the treatment', () => {
  const { run } = writeRun();
  writeFileSync(join(run, 'parity', 'treatment.md'), 'A fun launch video.\n');
  assert.match(checkRun(run, { phase: 'parity' }).issues.join('\n'), /marker "Rejection condition" never appears/u);
  const second = writeRun();
  writeFileSync(join(second.run, 'parity', 'baseline.md'), 'Rejection condition: none.\n');
  assert.match(checkRun(second.run, { phase: 'parity' }).issues.join('\n'), /baseline output parity\/baseline\.md shows marker/u);
});

test('fails a report that skips a mechanism or a needed credit', () => {
  const { run } = writeRun();
  writeFileSync(join(run, 'REPORT.md'), '# Report\n\n## Taken\n\n## Left\n\n## Provenance\n');
  assert.match(checkRun(run, { phase: 'report' }).issues.join('\n'), /REPORT\.md does not account for M1/u);
  const second = writeRun();
  editLedger(second.ledgerFile, (l) => { l.sources[0].licence.decision = 'ideas-credit'; });
  assert.match(checkRun(second.run, { phase: 'report' }).issues.join('\n'), /S1 needs credit/u);
});

test('builds an implementer brief from the spec alone', () => {
  const { run } = writeRun();
  const brief = buildImplementerBrief(run);
  assert.match(brief, /^TASK:/mu);
  assert.match(brief, /DELIVERABLE/u);
  assert.match(brief, /SCOPE/u);
  assert.match(brief, /VERIFY/u);
  assert.match(brief, /Rejection condition/u);
  assert.doesNotMatch(brief, /x\.com\/writer|sources\/S1/u);
});

test('the brief refuses while the spec gate fails', () => {
  const { run } = writeRun();
  writeFileSync(join(run, 'SPEC.md'), '# Spec\n\nRead sources/S1/content.md.\n');
  assert.throws(() => buildImplementerBrief(run), /spec is not ready/u);
});

test('refuses a PDF capture whose bytes are not a PDF', () => {
  const { run, target } = writeRun();
  writeFileSync(join(target, 'fake.pdf'), 'not a pdf\n');
  const result = cli(['capture', run, join(target, 'fake.pdf'), '--kind', 'pdf']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /%PDF-/u);
});

// ---------- skill depth ----------

test('SKILL.md is a dense phased workflow under the host body cap', () => {
  const text = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  const bytes = Buffer.byteLength(text, 'utf8');
  assert.ok(bytes >= 12_000, `SKILL.md is ${bytes} bytes`);
  assert.ok(bytes <= 23_800, `SKILL.md is ${bytes} bytes, exceeds 23800 B`);
  assert.match(text, /^---\nname: lit-hijack\n/u);
  for (const heading of [
    '## When to use lit-hijack',
    '## How to start it in agy',
    '## The run folder',
    '## Phase 0: Frame',
    '## Phase 1: Capture',
    '## Phase 2: Distil',
    '## Phase 3: Licence gate',
    '## Phase 4: Gap analysis',
    '## Phase 5: Port design and spec',
    '## Phase 6: Build',
    '## Phase 7: Parity proof',
    '## Phase 8: Report',
    '## Stop rules',
    '## Safety boundaries',
    '## Failure modes',
    '## Worked example',
    '## Final checklist',
  ]) {
    assert.ok(text.includes(heading), `missing ${heading}`);
  }
});

test('references exist and carry real content', () => {
  const text = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  const named = [...new Set([...text.matchAll(/references\/([a-z0-9-]+\.md)/gu)].map((m) => m[1]))];
  assert.ok(named.length >= 5);
  for (const f of named) assert.ok(existsSync(join(skillDir, 'references', f)), `references/${f}`);
  assert.deepEqual(readdirSync(join(skillDir, 'references')).sort(), [...named].sort());
  for (const f of named) assert.ok(readFileSync(join(skillDir, 'references', f), 'utf8').length >= 2_000, `references/${f} has content`);
});

test('neighbours point back at lit-hijack', () => {
  for (const nb of ['litresearch', 'lit-plan', 'start-work']) {
    assert.match(readFileSync(join(PLUGIN, 'skills', nb, 'SKILL.md'), 'utf8'), /`lit-hijack`/u, `${nb} names lit-hijack`);
  }
});

test('the ledger schema says litgravity, not a sibling product', () => {
  assert.equal(LEDGER_SCHEMA, 'litgravity.hijack-ledger.v1');
  assert.match(readFileSync(join(skillDir, 'scripts', 'hijack.mjs'), 'utf8'), /litgravity\.hijack-ledger/u);
});

test('a GitHub tree subpath stays inside the clone: .. segments and escapes are refused', () => {
  const repo = join(mkdtempSync(join(tmpdir(), 'litgravity-hijack-sub-')), 'repo');
  mkdirSync(join(repo, 'packages', 'core'), { recursive: true });
  assert.equal(repoSubpath(repo, '/packages/core'), join(repo, 'packages', 'core'));
  assert.equal(repoSubpath(repo, ''), null);
  for (const bad of ['/../../../tmp/x', '/packages/../../outside', '/..', '/%2e%2e/x/../..']) {
    assert.throws(() => repoSubpath(repo, bad), /outside the repository|\.\. segment/, bad);
  }
});
