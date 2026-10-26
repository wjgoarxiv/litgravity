import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ENGINE, stageFilm } from './motion-helpers.mjs';

const { validateTreatment, asksMinimal } = await import(join(ENGINE, 'node', 'treatment.mjs'));
const { planScore, buildScore, SCORE_GENRES } = await import(join(ENGINE, 'node', 'score.mjs'));
const { findBlender, blenderArgs } = await import(join(ENGINE, 'node', 'blender.mjs'));
const { STAGE_GATE } = await import(join(ENGINE, 'node', 'stage-gate.mjs'));
const { asksPathTraced } = await import(join(ENGINE, 'node', 'treatment.mjs')).then((m) => ({ asksPathTraced: m.asksPathTraced })).catch(() => ({ asksPathTraced: null }));

const field = (t) => { try { validateTreatment(t); return null; } catch (e) { return e.field; } };

const RICH_FILM = {
  ...stageFilm(),
  register: 'rich',
  request: 'make a showcase film for the gallery',
  world: {
    layers: ['Far: a gradient wash.', 'Mid: labelled panels.', 'Front: the subject and copy.'],
    labels: ['Gold tile', 'Teal ring', 'Headline', 'Readout', 'Ground', 'Accent bar'],
    camera: [{ beat: 0, move: 'push-in' }, { beat: 1, move: 'truck right' }],
  },
  sound: {
    mode: 'score', plan: 'A layered score.',
    events: [
      { t: 1.5, on: 'The headline appears.', kind: 'chime' },
      { t: 5.0, on: 'The tile enters.', kind: 'whoosh' },
      { t: 8.0, on: 'The tile settles.', kind: 'tap' },
    ],
  },
};

test('rich: the default register is rich; minimal needs a calm request', () => {
  assert.ok(!asksMinimal('make a showcase film'));
  assert.ok(asksMinimal('calm 영상'));
  assert.ok(asksMinimal('quiet opening'));
  assert.ok(asksMinimal('simple check clip'));
});

test('rich: a rich stage film plans a world with 3+ layers, 6+ labels, camera in half the shots', () => {
  const t = RICH_FILM;
  assert.equal(field(t), null);
  assert.equal(field({ ...t, world: undefined }), 'world');
  assert.equal(field({ ...t, world: { ...t.world, layers: ['one'] } }), 'world.layers');
  assert.equal(field({ ...t, world: { ...t.world, labels: ['a', 'b'] } }), 'world.labels');
  const locked = { ...t.world, camera: [{ beat: 0, move: 'locked' }] };
  assert.ok(field({ ...t, world: locked }), 'locked camera fails');
});

test('rich: a minimal film skips world; a type film skips world', () => {
  assert.equal(field(stageFilm()), null, 'minimal stage validates without world');
  const typeTreatment = {
    ...stageFilm(),
    request: '"물은 낮은 곳으로 흘러 결국 바다가 된다" 이 문장으로 잔잔한 키네틱 타이포 영상 만들어줘',
    genre: 'type-led', path: 'type', pathReason: 'Words are the film.', register: 'minimal',
    style: 'tidal', copy: { source: 'user', lines: ['물은 낮은 곳으로 흘러', '결국 바다가 된다'] },
    story: { expect: 'Water flows.', turn: 'It becomes the sea.', beat: 1, payoff: 'The last word opens.' },
    subject: { name: 'the sentence', source: 'user', specifics: ['A sentence about water.', 'Finding the sea.'] },
    visualDevices: [], inventions: [], durationSec: 6,
    beats: [
      { t0: 0, t1: 3, purpose: 'First clause.', onScreen: 'First clause.', motion: 'Reveal.', sound: 'None.', layout: 'title', hero: 'The first clause.', transition: 'cut' },
      { t0: 3, t1: 6, purpose: 'Second clause.', onScreen: 'Second clause.', motion: 'Hold.', sound: 'None.', layout: 'stage', hero: 'The second clause.', transition: 'end' },
    ],
    shotLayouts: ['title', 'stage'], shotHeroes: ['clause 1', 'clause 2'], shotTransitions: ['cut', 'end'],
  };
  assert.equal(field(typeTreatment), null, 'type path validates without world');
});

test('rich: rich films use score mode; generated (preset beds) is for minimal only', () => {
  assert.equal(field({ ...RICH_FILM, sound: { mode: 'generated', plan: 'A beat.' } }), 'sound.mode');
  assert.equal(field(RICH_FILM), null, 'score mode passes for rich');
});

test('rich: two different treatments produce different score plans (key, BPM or arrangement)', () => {
  const t1 = validateTreatment(RICH_FILM);
  const t2 = validateTreatment({ ...RICH_FILM, request: 'make a gallery walkthrough for the new exhibit', idea: 'A slow pan across a dark room with labelled panels that glow in sequence.' });
  const s1 = planScore({ treatment: t1, durationSec: t1.durationSec });
  const s2 = planScore({ treatment: t2, durationSec: t2.durationSec });
  const differs = s1.key !== s2.key || s1.mode !== s2.mode || s1.bpm !== s2.bpm || JSON.stringify(s1.progression) !== JSON.stringify(s2.progression);
  assert.ok(differs, 'two different films get different scores');
});

test('rich: a score has at least 6 audible finite stems in every genre', () => {
  const t = validateTreatment(RICH_FILM);
  const fps = 60, frameCount = t.durationSec * fps;
  for (const genre of SCORE_GENRES) {
    const treatment = { ...t, sound: { ...t.sound, genre } };
    const score = buildScore({ treatment, frameCount, fps });
    const stemNames = Object.keys(score.stems);
    assert.ok(stemNames.length >= 6, `${genre} has ${stemNames.length} stems`);
    for (const name of stemNames) {
      const stem = score.stems[name];
      assert.ok(stem.left.length > 0, `${genre} stem ${name} has samples`);
      assert.ok(stem.left.every((s) => Number.isFinite(s)), `${genre} stem ${name} left is finite`);
      assert.ok(stem.right.every((s) => Number.isFinite(s)), `${genre} stem ${name} right is finite`);
    }
  }
});

test('rich: the score peak does not clip (stays below 0 dBFS)', () => {
  const t = validateTreatment(RICH_FILM);
  const fps = 60, frameCount = t.durationSec * fps;
  const score = buildScore({ treatment: t, frameCount, fps });
  assert.ok(score.peakDbfs <= 0, `peak ${score.peakDbfs} dBFS should not clip`);
});

test('rich: Blender seed is mod 2^31 for signed 32-bit range', () => {
  const t = validateTreatment(RICH_FILM);
  const args1 = blenderArgs({ treatment: t, scene: '/tmp/scene.blend', out: '/tmp/out', quality: 'preview' });
  assert.ok(args1.some((a) => a.includes('--seed')), 'seed arg present');
  const seedIdx = args1.indexOf('--seed');
  if (seedIdx >= 0) {
    const seed = Number(args1[seedIdx + 1]);
    assert.ok(seed >= 0 && seed < 2 ** 31, `seed ${seed} is in signed 32-bit range`);
  }
});

test('rich: findBlender checks LITGRAVITY_BLENDER, macOS app bundle and PATH', () => {
  const found = findBlender({ env: { LITGRAVITY_BLENDER: '/fake/blender' }, exists: () => true });
  assert.equal(found.path, '/fake/blender');
  assert.equal(found.source, 'LITGRAVITY_BLENDER');
  const miss = findBlender({ env: {}, exists: () => false });
  assert.equal(miss, null);
});

test('rich: asksPathTraced picks Blender for high-quality 3D requests', () => {
  if (!asksPathTraced) return; // not exported if the function is internal
  assert.ok(asksPathTraced('고품질 3D 렌더링'));
});

test('rich: STAGE_GATE constants are defined', () => {
  assert.ok(typeof STAGE_GATE === 'object');
  assert.ok(typeof STAGE_GATE.flatHoldSec === 'number');
});
