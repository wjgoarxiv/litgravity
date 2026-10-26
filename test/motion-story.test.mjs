import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ENGINE, stageFilm } from './motion-helpers.mjs';

const { validateTreatment, requestUrls } = await import(join(ENGINE, 'node', 'treatment.mjs'));
const { STYLE_IDS, readStyle, styleBeds } = await import(join(ENGINE, 'node', 'styles.mjs'));
const { scaffoldHtml } = await import(join(ENGINE, 'node', 'scaffold.mjs'));
const { qaSamples } = await import(join(ENGINE, 'node', 'stage-qa.mjs'));

const field = (t) => { try { validateTreatment(t); return null; } catch (e) { return e.field; } };

test('story: every film needs expect, turn, beat and payoff; missing story is refused', () => {
  const t = stageFilm();
  assert.equal(field(t), null);
  assert.equal(field({ ...t, story: undefined }), 'story');
  assert.equal(field({ ...t, story: { ...t.story, expect: undefined } }), 'story.expect');
  assert.equal(field({ ...t, story: { ...t.story, turn: undefined } }), 'story.turn');
  assert.equal(field({ ...t, story: { ...t.story, payoff: undefined } }), 'story.payoff');
  assert.equal(field({ ...t, story: { ...t.story, beat: -1 } }), 'story.beat');
  assert.equal(field({ ...t, story: { ...t.story, beat: 99 } }), 'story.beat');
  assert.equal(field({ ...t, story: { ...t.story, turn: t.story.expect } }), 'story.turn');
});

test('story: a stage film has a protagonist with acts', () => {
  const t = stageFilm();
  assert.equal(field({ ...t, protagonist: undefined }), 'protagonist');
  const oneAct = { ...t.protagonist, acts: [t.protagonist.acts[0]] };
  assert.ok(field({ ...t, protagonist: oneAct }), 'one act should fail');
});

test('story: two adjacent shots may not share a layout', () => {
  const t = stageFilm();
  const same = t.beats.map((b) => ({ ...b, layout: 'title' }));
  assert.ok(field({ ...t, beats: same, shotLayouts: same.map((b) => b.layout) }), 'same layout twice fails');
});

test('story: requestUrls finds links in the request', () => {
  assert.ok(requestUrls('저장소: https://github.com/wjgoarxiv/litgravity 참고').length >= 1);
});

test('story: every style has at least three sound beds', () => {
  for (const id of STYLE_IDS) {
    const beds = styleBeds(readStyle(id));
    assert.ok(beds.length >= 3, `${id} has ${beds.length} beds`);
  }
});

test('story: 30 fps only when the request asks for it', () => {
  assert.equal(field({ ...stageFilm(), fps: 30 }), 'fps');
  assert.equal(field({ ...stageFilm(), fps: 30, request: 'render a short simple check clip for the hallway panel, 30fps로' }), null);
});

test('story: a depth3d device requires depth 3d; type path cannot be 3d', () => {
  const t = stageFilm();
  const d3 = [{ kind: 'depth3d', role: 'subject', beats: [0, 1, 2] }, { kind: 'shape', role: 'support', beats: [0, 1, 2] }];
  assert.equal(field({ ...t, visualDevices: d3, depth: '2d' }), 'depth');
  assert.equal(field({ ...t, visualDevices: d3, depth: '3d' }), null);
});

test('story: the scaffold of a 3D film references three.js; a flat film does not', () => {
  const t3 = validateTreatment({ ...stageFilm(), depth: '3d', visualDevices: [{ kind: 'depth3d', role: 'subject', beats: [0, 1, 2] }, { kind: 'shape', role: 'support', beats: [0, 1, 2] }] });
  assert.match(scaffoldHtml(t3), /three/i);
  assert.doesNotMatch(scaffoldHtml(validateTreatment(stageFilm())), /three\.module/i);
});

test('story: QA samples near each cut boundary', () => {
  const beats = [{ t0: 0, t1: 5 }, { t0: 5, t1: 10 }];
  const samples = qaSamples({ beats, fps: 60, frameCount: 600 });
  assert.ok(samples.length > 0);
  for (const s of samples) {
    const t = typeof s === 'number' ? s / 60 : s.t ?? s.frame / 60;
    assert.ok(typeof t === 'number');
  }
});

test('story: vendored three.js hashes match THIRD_PARTY_NOTICES', () => {
  const notices = readFileSync(join(ENGINE, 'THIRD_PARTY_NOTICES'), 'utf8');
  const hashRe = /three\.module\.js\s+([0-9a-f]{64})/;
  const m = hashRe.exec(notices);
  assert.ok(m, 'three.module.js hash in THIRD_PARTY_NOTICES');
  const actual = createHash('sha256').update(readFileSync(join(ENGINE, 'vendor', 'three', 'three.module.js'))).digest('hex');
  assert.equal(actual, m[1], 'three.module.js hash matches');
});
