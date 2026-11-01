// Declared keyed overlay clips on the stage path (references/stage.md, Clips): frames inside a declared
// clip folder are held to the clip limits instead of the raster limits; every other raster keeps its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { ENGINE, motionCli, needsRender, stageRun, temp, WARM } from './motion-helpers.mjs';

const serve = await import(join(ENGINE, 'node', 'stage-serve.mjs'));
const { encodePng } = await import(join(ENGINE, 'node', 'png.mjs'));
const { scanStage, scanClips, CLIP_LIMITS } = serve;

const frameName = (i) => `frame_${String(i).padStart(4, '0')}.png`;
/** An RGBA frame whose first pixel is transparent (a keyed frame); `opaque` makes it solid. */
const rgba = (w, h, { opaque = false, shade = 90 } = {}) => {
  const px = Buffer.alloc(w * h * 4, shade);
  for (let i = 3; i < px.length; i += 4) px[i] = 255;
  if (!opaque) px[3] = 0;
  return encodePng(px, w, h, 4);
};

/** A stage folder: index.html, clips/<dir>/frame_NNNN.png per clip, and clips/clips.json. */
function stageWith(clips, { declare = clips, extra = () => {} } = {}) {
  const stage = join(temp('litgravity-clips-'), 'stage');
  mkdirSync(join(stage, 'clips'), { recursive: true });
  writeFileSync(join(stage, 'index.html'), '<!doctype html><title>clips</title>');
  for (const c of clips) {
    mkdirSync(join(stage, 'clips', c.dir), { recursive: true });
    const png = c.png ?? rgba(c.w ?? 8, c.h ?? 6);
    for (let i = 1; i <= (c.files ?? c.count); i++) writeFileSync(join(stage, 'clips', c.dir, frameName(i)), png);
  }
  writeFileSync(join(stage, 'clips', 'clips.json'), JSON.stringify({ clips: declare.map(({ id, dir, count, fps }) => ({ id, dir, count, fps })) }));
  extra(stage);
  return stage;
}
const failure = (fn) => { try { fn(); } catch (error) { return error; } return null; };
const A = { id: 'boom', dir: '01-boom', count: 12, fps: 30 };
const B = { id: 'cat', dir: '10-cat', count: 30, fps: 30 };

test('clips: a declared set is exempt from the flipbook rule and the scan lists it', () => {
  const scan = scanStage(stageWith([A, B]));
  assert.equal(scan.rasters.length, 0, 'clip frames are not page rasters');
  assert.deepEqual(scan.clips.map((c) => [c.id, c.count, c.fps, c.width, c.height]), [['boom', 12, 30, 8, 6], ['cat', 30, 30, 8, 6]]);
  assert.ok(scan.clips.every((c) => c.bytes > 0));
});

test('clips: an undeclared frame sequence is still a flipbook, also beside a declared clip', () => {
  const stage = stageWith([A], {
    extra: (dir) => {
      mkdirSync(join(dir, 'flip'));
      for (let i = 1; i <= 12; i++) writeFileSync(join(dir, 'flip', frameName(i)), rgba(8, 6));
    },
  });
  assert.throws(() => scanStage(stage), /flipbook/);
});

test('clips: a folder missing from clips.json, or no clips.json at all, keeps the raster limits', () => {
  assert.throws(() => scanStage(stageWith([A], { declare: [] })), /flipbook/);
  const stage = stageWith([A]);
  rmSync(join(stage, 'clips', 'clips.json'));
  assert.throws(() => scanStage(stage), /flipbook/);
  assert.deepEqual(scanStage(stageWith([], { declare: [] })).clips, []);
});

test('clips: cover mode takes no clips', () => {
  assert.throws(() => scanStage(stageWith([A]), { clips: false }), /flipbook/);
});

const REFUSED = [
  ['more frames than a clip may have', { ...A, count: 361 }, /clip "boom".*361 frames/],
  ['a frame missing from the run', { ...A, files: 11 }, /frame_0012\.png/],
  ['a stray frame beyond the declared count', { ...A, files: 13 }, /frame_0013\.png/],
  ['opaque RGB frames', { ...A, png: encodePng(Buffer.alloc(8 * 6 * 3, 90), 8, 6, 3) }, /RGBA/],
  ['RGBA frames with no transparent pixel', { ...A, png: rgba(8, 6, { opaque: true }) }, /transparen/],
  ['a frame past the overlay size cap', { ...A, w: 721, h: 20 }, /clip "boom".*721/],
  ['frames of mixed sizes', { ...A, mixed: true }, /one size per clip/],
  ['a frame rate above 30', { ...A, fps: 60 }, /fps/],
  ['a folder name that climbs out', { ...A, dir: '..' }, /dir/],
  ['an id that is not a plain token', { ...A, id: 'a b' }, /id/],
];
for (const [name, clip, message] of REFUSED) {
  test(`clips: refuses ${name} with exit 17`, () => {
    const climbs = clip.dir === '..';
    const stage = stageWith([climbs ? { ...clip, dir: 'x' } : clip], {
      extra: (dir) => {
        if (climbs) writeFileSync(join(dir, 'clips', 'clips.json'), JSON.stringify({ clips: [{ id: clip.id, dir: '..', count: clip.count, fps: clip.fps }] }));
        if (clip.mixed) writeFileSync(join(dir, 'clips', clip.dir, frameName(5)), rgba(9, 6));
      },
    });
    const error = failure(() => scanStage(stage));
    assert.ok(error, 'the scan must refuse it');
    assert.equal(error.code, 17, error.message);
    assert.match(error.message, message);
  });
}

test('clips: a duplicate id, a malformed clips.json and a thirteenth clip are exit 17', () => {
  const dup = failure(() => scanStage(stageWith([A, { ...B, id: 'boom' }])));
  assert.ok(dup && dup.code === 17 && /duplicate.*boom/.test(dup.message), dup?.message);
  const bad = stageWith([A]);
  writeFileSync(join(bad, 'clips', 'clips.json'), '{ not json');
  const json = failure(() => scanStage(bad));
  assert.ok(json && json.code === 17 && /clips\.json/.test(json.message), json?.message);
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `c${i}`, dir: `d${i}`, count: 2, fps: 30 }));
  const cap = failure(() => scanStage(stageWith(many)));
  assert.ok(cap && cap.code === 17 && /at most 12 clips/.test(cap.message), cap?.message);
});

test('clips: per-clip and total bytes and frames are held to caps the engine exports', () => {
  assert.deepEqual(Object.keys(CLIP_LIMITS).sort(), ['bytesPerClip', 'bytesTotal', 'clips', 'fps', 'framesPerClip', 'framesTotal', 'side']);
  assert.deepEqual({ ...CLIP_LIMITS }, { clips: 12, framesPerClip: 360, framesTotal: 1500, bytesPerClip: 40 * 1024 * 1024, bytesTotal: 128 * 1024 * 1024, side: 720, fps: 30 });
  const stage = stageWith([A, B]);
  const code = (limits) => failure(() => scanClips(stage, { limits: { ...CLIP_LIMITS, ...limits } }))?.code ?? 0;
  assert.equal(code({}), 0);
  assert.equal(code({ bytesPerClip: 100 }), 17, 'per-clip bytes');
  assert.equal(code({ bytesTotal: 100 }), 17, 'total bytes');
  assert.equal(code({ framesTotal: 41 }), 17, 'total frames');
});

test('clips: /lit/clips.js serves the declaration and the frames stay ordinary stage files', () => {
  const router = serve.stageRouter({ stageDir: stageWith([A]), faces: [] });
  const answer = router.route(`${serve.STAGE_ORIGIN}/lit/clips.js`);
  assert.equal(answer.kind, 'body');
  const sandbox = { window: {} };
  vm.runInNewContext(answer.body, sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.LitClips)), { boom: { src: 'clips/01-boom', count: 12, fps: 30, width: 8, height: 6 } });
  assert.equal(router.route(`${serve.STAGE_ORIGIN}/clips/01-boom/frame_0001.png`).kind, 'file');
  const bare = serve.stageRouter({ stageDir: temp('litgravity-noclips-'), faces: [] });
  assert.equal(bare.route(`${serve.STAGE_ORIGIN}/lit/clips.js`).kind, 'missing');
});

// ---- LitStage.clip: the frame is a pure function of film time ----
const kitSource = readFileSync(join(ENGINE, 'stage', 'stage-kit.js'), 'utf8');
/** The kit over a bare window with a tiny DOM: elements remember their children and style. */
function kit(clips) {
  const el = (tag) => ({
    tag, style: {}, children: [], attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    append(c) { this.children.push(c); c.parent = this; },
    replaceWith(n) { this.parent.children[this.parent.children.indexOf(this)] = n; n.parent = this.parent; },
  });
  const window = { LitClips: clips };
  vm.runInNewContext(kitSource, { window, document: { createElement: el }, Intl, Math, Number, String, Array, Object, Error, JSON, parseFloat, parseInt });
  return { LitStage: window.LitStage, parent: el('div') };
}
const DATA = { boom: { src: 'clips/01-boom', count: 12, fps: 30, width: 520, height: 511 } };
const BOX = { x: 10, y: 20, w: 300, h: 300 };
const shownFrame = (parent) => parent.children[0].children[0]?.src;

test('LitStage.clip: film time picks a 1-based frame, floor((t - start) * fps) + 1', () => {
  const { LitStage, parent } = kit(DATA);
  const show = LitStage.clip({ parent, id: 'boom', box: BOX });
  assert.equal(show(1.0, { start: 1.0 }), parent.children[0]);
  assert.match(shownFrame(parent), /clips\/01-boom\/frame_0001\.png$/);
  show(1.0 + 4 / 30, { start: 1.0 });
  assert.match(shownFrame(parent), /frame_0005\.png$/);
  show(1.0 + 11 / 30, { start: 1.0 });
  assert.match(shownFrame(parent), /frame_0012\.png$/);
});

test('LitStage.clip: hidden before the cue and past the last frame unless it holds or loops', () => {
  const { LitStage, parent } = kit(DATA);
  const show = LitStage.clip({ parent, id: 'boom', box: BOX });
  assert.equal(show(0.5, { start: 1.0 }), null);
  assert.equal(parent.children[0].style.display, 'none');
  assert.equal(show(1.0 + 12 / 30, { start: 1.0 }), null);
  show(1.0 + 13 / 30, { start: 1.0, hold: true });
  assert.match(shownFrame(parent), /frame_0012\.png$/);
  show(1.0 + 13 / 30, { start: 1.0, loop: true });
  assert.match(shownFrame(parent), /frame_0002\.png$/);
});

test('LitStage.clip: a frame range plays alone and the same t gives the same frame in any order', () => {
  const { LitStage, parent } = kit(DATA);
  const show = LitStage.clip({ parent, id: 'boom', box: BOX });
  const opts = { start: 0, from: 4, to: 6 };
  show(2 / 30, opts);
  assert.match(shownFrame(parent), /frame_0006\.png$/);
  assert.equal(show(3 / 30, opts), null);
  show(0, opts);
  assert.match(shownFrame(parent), /frame_0004\.png$/);
  show(2 / 30, opts);
  assert.match(shownFrame(parent), /frame_0006\.png$/);
});

test('LitStage.clip: one wrapper at the box, and an unknown clip or a missing clips.js is refused', () => {
  const { LitStage, parent } = kit(DATA);
  const show = LitStage.clip({ parent, id: 'boom', box: BOX });
  show(0, { start: 0 });
  show(0.1, { start: 0 });
  assert.equal(parent.children.length, 1, 'one wrapper, never one per frame');
  const s = parent.children[0].style;
  assert.deepEqual([s.left, s.top, s.width, s.height], ['10px', '20px', '300px', '300px']);
  assert.throws(() => LitStage.clip({ parent, id: 'nope', box: BOX }), /nope/);
  assert.throws(() => kit(undefined).LitStage.clip({ parent, id: 'boom', box: BOX }), /clips\.js/);
});

// ---- a declared clip through the real renderer ----
/** A run whose clip "swatch" has frame k as a solid (20k, 0, 0) with one transparent corner pixel. */
function swatchRun() {
  const out = stageRun('clip-overlay');
  const dir = join(out, 'stage', 'clips', 'swatch');
  mkdirSync(dir, { recursive: true });
  for (let k = 1; k <= 8; k++) {
    const px = Buffer.alloc(8 * 6 * 4);
    for (let i = 0; i < px.length; i += 4) px.set([20 * k, 0, 0, 255], i);
    px[3] = 0;
    writeFileSync(join(dir, frameName(k)), encodePng(px, 8, 6, 4));
  }
  writeFileSync(join(out, 'stage', 'clips', 'clips.json'), JSON.stringify({ clips: [{ id: 'swatch', dir: 'swatch', count: 8, fps: 30 }] }));
  return out;
}

test('clips render: the frame film time picks, hidden before the cue, held, and identical in a fresh browser', async (t) => {
  if (needsRender(t)) return;
  const { captureStageFrames } = await import(join(ENGINE, 'node', 'stage.mjs'));
  const env = { ...process.env, LITGRAVITY_MOTION_RUNTIME: WARM };
  const frames = [54, 60, 70, 85, 100];
  const first = await captureStageFrames({ out: swatchRun(), frames, env });
  const second = await captureStageFrames({ out: swatchRun(), frames, env });
  const centre = (px) => [...px.subarray((450 * 1920 + 800) * 4, (450 * 1920 + 800) * 4 + 3)];
  const near = (got, want) => got.every((v, i) => Math.abs(v - want[i]) <= 3);
  assert.ok(near(centre(first.get(54)), [0, 0, 0]), `0.9 s is before the cue: ${centre(first.get(54))}`);
  assert.ok(near(centre(first.get(60)), [20, 0, 0]), `1.0 s is clip frame 1: ${centre(first.get(60))}`);
  assert.ok(near(centre(first.get(70)), [120, 0, 0]), `1 + 5/30 s is clip frame 6: ${centre(first.get(70))}`);
  assert.ok(near(centre(first.get(85)), [160, 0, 0]), `1.417 s is held on frame 8: ${centre(first.get(85))}`);
  assert.ok(near(centre(first.get(100)), [0, 0, 0]), `1.667 s is past the hold: ${centre(first.get(100))}`);
  for (const f of frames) assert.ok(Buffer.from(first.get(f)).equals(Buffer.from(second.get(f))), `frame ${f} matches in a fresh browser`);
});

test('clips render: a full-frame white/black clip still fails the flash audit and withholds the film', (t) => {
  if (needsRender(t)) return;
  const out = stageRun('clip-strobe');
  const dir = join(out, 'stage', 'clips', 'strobe');
  mkdirSync(dir, { recursive: true });
  for (let k = 1; k <= 6; k++) {
    const px = Buffer.alloc(8 * 6 * 4, k % 2 ? 255 : 0);
    px[3] = 0;
    for (let i = 7; i < px.length; i += 4) px[i] = 255;
    writeFileSync(join(dir, frameName(k)), encodePng(px, 8, 6, 4));
  }
  writeFileSync(join(out, 'stage', 'clips', 'clips.json'), JSON.stringify({ clips: [{ id: 'strobe', dir: 'strobe', count: 6, fps: 30 }] }));
  const r = motionCli(['stage', '--out', out, '--round', '2']);
  assert.equal(r.status, 13, r.stdout + r.stderr);
  const report = readFileSync(join(out, 'gate-report.txt'), 'utf8');
  assert.match(report, /clips: strobe 6 frames at 30 fps/);
  assert.match(report, /MO-C-03/);
  assert.equal(existsSync(join(out, 'film.mp4')), false, 'a flash FAIL withholds the film');
});
