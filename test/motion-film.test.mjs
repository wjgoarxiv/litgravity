import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE, motionCli, needsRender, stageFilm, stageRun, temp } from './motion-helpers.mjs';

const { EXIT } = await import(join(ENGINE, 'core', 'constants.mjs'));
const { validateTreatment } = await import(join(ENGINE, 'node', 'treatment.mjs'));
const { downgrades } = await import(join(ENGINE, 'node', 'done.mjs'));
const { mulberry32, keys } = await import(join(ENGINE, 'core', 'util.mjs'));
const { eojeol, readingFloor, scriptRuns } = await import(join(ENGINE, 'core', 'text.mjs'));
const { buildTimeline } = await import(join(ENGINE, 'core', 'timeline.mjs'));
const { pickPreset, PRESETS } = await import(join(ENGINE, 'core', 'presets.mjs'));
const { detectSequence, auditRecords } = await import(join(ENGINE, 'core', 'flash.mjs'));

const CELLS = 320 * 180;
const uniform = (v) => ({ R: new Float32Array(CELLS).fill(v), G: new Float32Array(CELLS).fill(v), B: new Float32Array(CELLS).fill(v) });

test('film treatment: a stage film validates; restating the request, too few beats or an unknown genre is refused by field', () => {
  const t = validateTreatment(stageFilm());
  assert.equal(t.path, 'stage');
  const bad = [
    [{ genre: 'vlog' }, 'genre'],
    [{ beats: stageFilm().beats.slice(0, 1) }, 'beats[0]'],
    [{ idea: 'render a short check clip for the hallway panel' }, 'idea'],
    [{ path: 'video' }, 'path'],
  ];
  for (const [over, field] of bad) assert.throws(() => validateTreatment({ ...stageFilm(), ...over }), (e) => e.field === field, JSON.stringify(over));
});

test('film downgrades: a shorter film, fewer subject beats, sound switched off unasked, or stage to type are all recorded', () => {
  const first = { ...stageFilm({ sound: { mode: 'generated', plan: 'A pulse.' } }), durationSec: 16 };
  const final = { ...stageFilm(), durationSec: 8, path: 'type', visualDevices: [{ kind: 'shape', role: 'subject', beats: [0] }] };
  const items = downgrades(first, final);
  assert.equal(items.length, 4, items.join('; '));
  assert.deepEqual(downgrades(null, final), []);
});

test('engine units: seeded randomness, eojeol line breaks, reading floors, script runs, named easing', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 50; i += 1) assert.equal(a(), b());
  assert.deepEqual(eojeol('  밤이 깊어도   불은 켜져 있다 '), ['밤이', '깊어도', '불은', '켜져', '있다']);
  const { timeline } = buildTimeline({ shots: [{ scene: 'karaoke-line', text: '밤이 깊어도 불은 켜져 있다' }] });
  assert.deepEqual(timeline.filter((u) => u.kind === 'reveal').map((u) => u.text), ['밤이', '깊어도', '불은', '켜져', '있다'], 'reveals are whole eojeol');
  assert.equal(readingFloor('안녕', 'line'), 1.0);
  assert.deepEqual(scriptRuns('LIT팀').map((r) => [r.script, r.text]), [['latin', 'LIT'], ['hangul', '팀']]);
  assert.throws(() => keys(0.5, [[0, 0], [1, 1, 'wobble']]), /unknown ease/);
});

test('type presets: picked by whole words, an explicit style wins, pass order as the bibles define it', () => {
  assert.equal(pickPreset({ text: '터미널 부팅 화면 같은 인트로' }).presetId, 'terminalcore');
  assert.equal(pickPreset({ text: 'a calm opening' }).presetId, 'tidal');
  assert.equal(pickPreset({ text: 'waves of data' }).presetId, 'swiss-signal');
  assert.equal(pickPreset({ style: 'tidal', text: 'terminal' }).presetId, 'tidal');
  assert.throws(() => pickPreset({ style: 'neon' }), /unknown preset/);
  assert.deepEqual(PRESETS.terminalcore.passes, ['terminal-ui', 'crt', 'dither', 'glitch']);
});

test('flash audit: a full-frame pulse four times a second fails, and so do four flashes in the last second', () => {
  const pulse = Array.from({ length: 120 }, (_, f) => uniform(f % 15 < 7 ? 0.9 : 0.02));
  assert.equal(auditRecords(detectSequence(pulse, { loop: false }), 60, { loop: false }).pass, false);
  const tail = Array.from({ length: 180 }, (_, f) => uniform(f >= 120 && (f - 120) % 15 < 7 ? 0.9 : 0.02));
  assert.equal(auditRecords(detectSequence(tail, { loop: false }), 60, { loop: false }).pass, false);
  const calm = Array.from({ length: 120 }, (_, f) => uniform(0.3 + 0.001 * f));
  assert.equal(auditRecords(detectSequence(calm, { loop: false }), 60, { loop: false }).pass, true);
});

test('stage path: stills-only writes beat stills, one strip per cut, the sheet and its index, and no film', (t) => {
  if (needsRender(t)) return;
  const out = stageRun('clock', { fps: 30 });
  const r = motionCli(['stage', '--out', out, '--round', '1', '--stills-only']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const index = JSON.parse(readFileSync(join(out, 'stills', 'index.json'), 'utf8'));
  assert.equal(index.stillsOnly, true);
  assert.deepEqual(index.files.map((f) => f.kind).sort(), ['beat', 'beat', 'beat', 'sheet', 'strip', 'strip']);
  for (const f of index.files) assert.ok(existsSync(join(out, f.file)), f.file);
  assert.equal(existsSync(join(out, 'film.mp4')), false);
});

test('stage path: a full render is deterministic against a fresh replay and writes the 1920x1080 film', (t) => {
  if (needsRender(t)) return;
  const out = stageRun('clock', { fps: 30 });
  const r = motionCli(['stage', '--out', out, '--round', '2']);
  assert.ok([0, 13].includes(r.status), r.stdout + r.stderr);
  assert.equal(JSON.parse(readFileSync(join(out, '.run', 'determinism.json'), 'utf8')).status, 'PASS');
  const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  assert.deepEqual([manifest.width, manifest.height, manifest.frameCount], [1920, 1080, 120]);
  assert.ok(existsSync(join(out, 'film.mp4')) || existsSync(join(out, 'withheld')), 'a film, or the withheld diagnostics after a flash FAIL');
  assert.match(readFileSync(join(out, 'gate-report.txt'), 'utf8'), /^QA gate: (PASS|FAIL)$/m);
});

test('stage path: a page that paints crypto.getRandomValues is exit 18 naming the frame and region', (t) => {
  if (needsRender(t)) return;
  const r = motionCli(['stage', '--out', stageRun('red-crypto', { fps: 30 }), '--round', '2']);
  assert.equal(r.status, EXIT.STAGE_NONDETERMINISTIC, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /STAGE_NONDETERMINISTIC: frame \d+ differs .*region \d+,\d+ \d+x\d+/);
});

test('type path: make --stills-only renders a brief through the WebGL2 type engine', (t) => {
  if (needsRender(t)) return;
  const out = join(temp('litgravity-type-'), 'out');
  mkdirSync(out, { recursive: true });
  const treatment = {
    ...stageFilm(),
    request: '"물은 낮은 곳으로 흘러 결국 바다가 된다" 이 문장으로 키네틱 타이포 영상 만들어줘',
    genre: 'type-led', path: 'type', pathReason: 'The user gave one sentence and asked for kinetic type; the words are the film.',
    idea: 'One breath that slows as it runs downhill and opens out at the last word.',
    durationSec: 6,
    beats: [
      { t0: 0, t1: 3, purpose: 'Set the first clause.', onScreen: 'The first clause, large and left-aligned.', motion: 'Words land one eojeol at a time.', sound: 'None.' },
      { t0: 3, t1: 6, purpose: 'Land the last clause.', onScreen: 'The last clause alone, centred.', motion: 'Settle and hold.', sound: 'None.' },
    ],
    subject: { name: 'the supplied sentence', source: 'user', specifics: ['A sentence about water finding the sea.'] },
    visualDevices: [],
    copy: { source: 'user', lines: ['물은 낮은 곳으로 흘러', '결국 바다가 된다'] },
    inventions: [],
  };
  writeFileSync(join(out, 'treatment.json'), JSON.stringify(treatment, null, 2));
  const brief = join(out, 'brief.json');
  writeFileSync(brief, JSON.stringify({ lines: ['물은 낮은 곳으로 흘러', '결국 바다가 된다'] }));
  const r = motionCli(['make', brief, '--out', out, '--round', '1', '--stills-only']);
  assert.ok([0, 11].includes(r.status), r.stdout + r.stderr);
  if (r.status === 11) return t.skip('no WebGL2 rung on this machine (exit 11)');
  const index = JSON.parse(readFileSync(join(out, 'stills', 'index.json'), 'utf8'));
  assert.ok(index.files.some((f) => f.kind === 'sheet'));
});
