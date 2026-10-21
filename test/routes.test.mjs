import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN } from './helpers.mjs';
import { SKILL_ROUTES, KEYWORD_ROUTES, SKILL_IDS, detectRoute } from '../plugin/hooks/lib/routes.mjs';

const FAMILY = JSON.parse(readFileSync(new URL('./fixtures/family-skills.json', import.meta.url), 'utf8'));

test('the route table is the family skill list, each id once', () => {
  const ids = SKILL_ROUTES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [...FAMILY].sort());
  for (const r of SKILL_ROUTES) assert.ok(r.when.length > 10 && r.when.length < 120, r.id);
});

test('every keyword route lands on a listed skill', () => {
  for (const [word, id] of Object.entries(KEYWORD_ROUTES)) assert.ok(SKILL_IDS.has(id), `${word} -> ${id}`);
});

test('every skill folder that ships is enrolled in the route table', () => {
  const dirs = readdirSync(join(PLUGIN, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const d of dirs) assert.ok(SKILL_IDS.has(d), `${d} has no route`);
});

test('all 39 family skills are shipped', () => {
  const dirs = new Set(readdirSync(join(PLUGIN, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name));
  assert.deepEqual(FAMILY.filter((id) => !dirs.has(id)), []);
});

test('bare lit, continue and restart words', () => {
  assert.deepEqual(
    { ...detectRoute('lit'), keyword: undefined },
    { route: 'lit-loop', keyword: undefined, bare: true, resume: false, restart: false, direct: false, empty: true },
  );
  assert.equal(detectRoute('LIT').bare, true);
  const c = detectRoute('lit continue');
  assert.equal(c.resume, true);
  assert.equal(c.bare, true);
  const cw = detectRoute('lit resume the migration');
  assert.equal(cw.resume, true);
  assert.equal(cw.bare, false);
  const n = detectRoute('lit new plan the export');
  assert.equal(n.restart, true);
  assert.equal(n.route, 'lit-plan');
  assert.equal(n.bare, false);
  assert.equal(detectRoute('lit restart').empty, true);
});

test('D2 brainstorm words all reach lit-brainstorm', () => {
  for (const w of ['brainstorm', 'brainstorming', 'ideation', 'ideate', 'idea', 'ideas']) {
    assert.equal(detectRoute(`lit ${w} names for the tool`).route, 'lit-brainstorm', w);
  }
  assert.equal(detectRoute('lit ideation').route, 'lit-brainstorm');
});

test('D3 review picks plan or work and records a forced mode', () => {
  assert.equal(detectRoute('lit review').route, 'review-work');
  assert.equal(detectRoute('lit review').reviewMode, null);
  assert.equal(detectRoute('lit review plan').reviewMode, 'plan');
  assert.equal(detectRoute('lit review work now').reviewMode, 'work');
  assert.equal(detectRoute('lit review the diff').reviewMode, null);
});

test('litgoal and the other route words', () => {
  assert.equal(detectRoute('lit goal ship the export').route, 'litgoal');
  assert.equal(detectRoute('lit start plans/x.md').route, 'start-work');
  assert.equal(detectRoute('lit handoff').route, 'lit-handoff');
  assert.equal(detectRoute('lit research prior art').route, 'litresearch');
  assert.equal(detectRoute('lit fix the login redirect').route, 'lit-loop');
  assert.equal(detectRoute('lit: plan the thing').route, 'lit-plan');
});

test('activation is case-sensitive and ignores prose, code fences and look-alike words', () => {
  assert.equal(detectRoute('Lit me know'), null);
  assert.equal(detectRoute('literally anything'), null);
  assert.equal(detectRoute('```\nlit plan\n```'), null);
  assert.equal(detectRoute('the lit fuse'), null);
  assert.equal(detectRoute(42), null);
});

test('skill ids typed as the first word, plain or as a slash command, route directly', () => {
  for (const p of ['lit-plan x', '/lit-plan x', '/litgravity:lit-plan x', 'litgoal set it', '/start-work plans/a.md', '/debugging the crash']) {
    assert.equal(detectRoute(p).direct, true, p);
  }
  assert.equal(detectRoute('/lit-plan x').route, 'lit-plan');
  assert.equal(detectRoute('/start-work plans/a.md').route, 'start-work');
  assert.equal(detectRoute('/lit'), null);
  assert.equal(detectRoute('start-work plans/a.md'), null, 'without the slash it is prose');
});

test('film-making tasks route to the motion skill; footage editing does not', () => {
  assert.equal(detectRoute('lit make a lyric video for this song').route, 'lit-typographic-motion');
  assert.equal(detectRoute('lit 영상 만들어줘').route, 'lit-typographic-motion');
  assert.equal(detectRoute('lit trim the video to ten seconds').route, 'lit-loop');
  assert.equal(detectRoute('lit add captions to the clip').route, 'lit-loop');
});

test('every skill is reachable three ways: `lit <id>`, a bare id as the first word, and the slash command', () => {
  for (const id of SKILL_IDS) {
    assert.equal(detectRoute(`lit ${id} the task`).route, id, `lit ${id}`);
    assert.equal(detectRoute(`/litgravity:${id} the task`).route, id, `/litgravity:${id}`);
    assert.equal(detectRoute(`/${id} the task`).direct, true, `/${id}`);
  }
});

test('the route words the skill documents reach their skills: wikify, autoresearch, readme, deck and doc words, diagrams, figures, code, structural search', () => {
  const want = {
    wikify: 'wikify', wiki: 'wikify', autoresearch: 'autoresearch', readme: 'readme-studio',
    deck: 'lit-pptx', slides: 'lit-pptx', pptx: 'lit-pptx', docx: 'lit-docx',
    diagram: 'lit-diagram-drawer', 다이어그램: 'lit-diagram-drawer', figure: 'lit-scientific-visualization', plot: 'lit-scientific-visualization',
    code: 'lit-code', tdd: 'lit-code', structural: 'structural-search', codemod: 'structural-search', typecheck: 'lsp',
    motion: 'lit-typographic-motion', film: 'lit-typographic-motion', 영상: 'lit-typographic-motion',
  };
  for (const [word, id] of Object.entries(want)) assert.equal(detectRoute(`lit ${word} for the project`).route, id, word);
  assert.equal(detectRoute('lit comment out the dead branch').route, 'lit-loop', 'ordinary verbs stay with lit-loop');
});
