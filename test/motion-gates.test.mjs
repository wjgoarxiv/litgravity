import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ENGINE, temp } from './motion-helpers.mjs';

const { demoTreatment } = await import(join(ENGINE, 'node', 'gallery.mjs'));
const { validateTreatment, normalizeText } = await import(join(ENGINE, 'node', 'treatment.mjs'));
const { judgeStyle, judgeText } = await import(join(ENGINE, 'node', 'stage-qa.mjs'));
const { evaluateStageGate } = await import(join(ENGINE, 'node', 'stage-gate.mjs'));
const { buildScore, writeScore, SCORE_GENRES } = await import(join(ENGINE, 'node', 'score.mjs'));
const { SOUND } = await import(join(ENGINE, 'node', 'sound.mjs'));

const W = 1920;
const H = 1080;
const rule = (rules, id) => (rules.rules ?? rules).find((x) => x.id === id);

// A rich stage film over the gallery demo: a three-layer world, six labels and a per-film score.
const richFilm = (over = {}) => validateTreatment({
  ...demoTreatment('swiss-signal'),
  request: '한 시계로 모든 프레임을 맞추는 쇼케이스 영상 만들어줘',
  register: 'rich',
  world: {
    layers: ['Back: a dim grid of the frame.', 'Middle: labelled panels with counters.', 'Front: the clock face and its copy.'],
    labels: ['frame 0001', 'clock locked', 'one house', 'beat 2 of 4', 'teal signal', 'amber moment'],
    camera: [{ beat: 0, move: 'A slow push-in.' }, { beat: 2, move: 'A truck to the right.' }],
  },
  sound: { mode: 'score', plan: 'A layered groove that lifts at the stage shot.', events: [{ t: 3.2, on: 'The split opens.', kind: 'tap' }, { t: 9.2, on: 'The stage lands.', kind: 'chime' }] },
  ...over,
});


test('TEXT-OVERLAP, TEXT-ON-STYLE and TEXT-ZONE pass copy on the house style in its zone and fail each breach', () => {
  const t = richFilm();
  const copyNorm = t.copy.lines.map(normalizeText);
  const mask = Buffer.alloc(W * H, 255);
  // Beat 1 is a split shot: its copy sits on the left in Archivo, bone ink, at the display size.
  const run = (over) => ({ id: 1, kind: 'dom', text: t.copy.lines[1], decor: false, rects: [[200, 300, 700, 380]], opacity: 1, fontSizePx: 76, capHeightPx: 76, gradient: false, color: 'rgb(233, 235, 228)', family: 'Archivo', ...over });
  const judge = (runs) => judgeStyle({ treatment: t, width: W, height: H, samples: [{ frame: 200, beat: 1, mid: true, runs, mask }], settled: () => true, copyNorm });
  const ok = judge([run({})]);
  for (const id of ['TEXT-OVERLAP', 'TEXT-ON-STYLE', 'TEXT-ZONE']) assert.equal(rule(ok, id).status, 'PASS', id);
  assert.equal(rule(judge([run({}), run({ id: 2, text: t.copy.lines[2], rects: [[300, 320, 800, 400]] })]), 'TEXT-OVERLAP').status, 'FAIL');
  assert.equal(rule(judge([run({ color: 'rgb(255, 0, 170)' })]), 'TEXT-ON-STYLE').status, 'FAIL', 'a colour outside the style');
  assert.equal(rule(judge([run({ family: 'Helvetica' })]), 'TEXT-ON-STYLE').status, 'FAIL', 'a face outside the style');
  assert.equal(rule(judge([run({ fontSizePx: 60 })]), 'TEXT-ON-STYLE').status, 'FAIL', 'a size off the scale');
  assert.equal(rule(judge([run({ rects: [[1100, 300, 1600, 380]] })]), 'TEXT-ZONE').status, 'FAIL', 'split copy on the right half');
});

const gateRule = (t, frames, id) => evaluateStageGate({ masterFlash: [], fps: 10, probe: null, width: W, height: H, treatment: t, exports: {}, frames, determinism: null }).rules.find((x) => x.id === id);

test('DEAD-AIR fails a near-empty run mid-film and allows a short build at the open and a fade at the close', () => {
  const t = richFilm();
  const frames = (shares) => shares.map((busy, i) => ({ frame: i, luminanceP995: 0.8, luminanceP005: 0.1, busy }));
  assert.equal(gateRule(t, frames([...Array(20).fill(0.2), ...Array(8).fill(0.01), ...Array(20).fill(0.2)]), 'DEAD-AIR').status, 'FAIL', '0.8 s of a near-empty frame mid-film');
  assert.equal(gateRule(t, frames([...Array(20).fill(0.2), ...Array(4).fill(0.01), ...Array(20).fill(0.2)]), 'DEAD-AIR').status, 'PASS', '0.4 s passes');
  assert.equal(gateRule(t, frames([...Array(8).fill(0), ...Array(30).fill(0.2), ...Array(10).fill(0.01)]), 'DEAD-AIR').status, 'PASS', 'a 0.8 s build and a 1 s fade');
  assert.equal(gateRule(t, frames([...Array(12).fill(0), ...Array(30).fill(0.2)]), 'DEAD-AIR').status, 'FAIL', 'a 1.2 s empty open');
  assert.equal(gateRule(t, [{ frame: 0, luminanceP995: 0.8, luminanceP005: 0.1 }], 'DEAD-AIR').status, 'N/A', 'no busy data, no verdict');
});

test('RICH-FILL fails a rich film whose shots leave regions empty, lets the end card breathe and skips minimal films', () => {
  const t = richFilm();
  const w = 192;
  const h = 108;
  const runs = [{ id: 'c0', text: t.copy.lines[0], rects: [[20, 90, 120, 98]], opacity: 1, kind: 'dom', fontSizePx: 12, capHeightPx: 9, color: 'rgb(233, 235, 228)', family: 'Archivo' }];
  const input = (treatment, regionsFor) => {
    const mask = new Uint8Array(w * h).fill(1);
    const rgbaA = new Uint8Array(w * h * 4).fill(255);
    const samples = treatment.beats.map((b, i) => ({ frame: i * 10, beat: i, mid: true, runs, mask, rgbaA, rgbaB: rgbaA, stray: 0, fonts: [], ...(regionsFor ? { regions: regionsFor(i) } : {}) }));
    return { treatment, width: w, height: h, timeline: Array.from({ length: 200 }, (_, k) => ({ frame: k, t: k / 10, runs })), samples };
  };
  const fill = (treatment, regionsFor) => rule(judgeText(input(treatment, regionsFor)), 'RICH-FILL');
  const full = Array(12).fill(0.6);
  const sparse = [0.4, 0.5, 0, 0, 0.6, 0.7, 0.1, 0.05, 0.8, 0.7, 0.1, 0];
  assert.equal(fill(t, () => full).status, 'PASS');
  assert.equal(fill(t, (i) => (i === t.beats.length - 1 ? sparse : full)).status, 'PASS', 'the end card may breathe');
  const failed = fill(t, (i) => (i % 2 ? full : sparse));
  assert.equal(failed.status, 'FAIL');
  assert.match(failed.detail, /empty/u);
  assert.equal(fill({ ...t, register: 'minimal' }, () => sparse).status, 'N/A');
  assert.equal(fill(t, null).status, 'N/A', 'no region data, no verdict');
});

test('every score genre stays finite and on its loudness target', () => {
  const t = richFilm();
  for (const genre of SCORE_GENRES) {
    const g = validateTreatment({ ...t, sound: { ...t.sound, genre } });
    const s = buildScore({ treatment: g, frameCount: g.durationSec * 30, fps: 30, cutTimes: g.beats.slice(1).map((b) => b.t0) });
    for (const [name, stem] of Object.entries(s.stems)) assert.ok(stem.left.every(Number.isFinite) && stem.right.every(Number.isFinite), `${genre}: ${name} is finite`);
    assert.ok(Math.abs(s.lufs - SOUND.targetLufs) <= 0.5, `${genre}: ${s.lufs} LUFS`);
  }
});

const HAVE_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0;

test('the score keeps its peak under -0.5 dBFS after an AAC encode', (t) => {
  if (!HAVE_FFMPEG) return t.skip('ffmpeg is not installed');
  const film = richFilm();
  const out = temp('lg-score-aac-');
  writeScore({ treatment: film, frameCount: film.durationSec * 30, fps: 30, cutTimes: film.beats.slice(1).map((b) => b.t0), dir: out });
  const wav = join(out, 'sound', 'score.wav');
  assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '256k', `${wav}.m4a`]).status, 0);
  const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', `${wav}.m4a`, '-f', 's16le', '-acodec', 'pcm_s16le', '-'], { maxBuffer: 1 << 28 }).stdout;
  let peak = 0;
  for (let i = 0; i + 1 < pcm.length; i += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i)));
  const db = 20 * Math.log10(peak / 32768);
  assert.ok(db <= -0.8, `decoded peak ${db.toFixed(2)} dBFS`);
});
