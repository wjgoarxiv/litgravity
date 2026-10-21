import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import {
  SKILL, ENGINE, COVER_FIXTURES, HAVE_WEBP, coverTreatment, fakeCoverRun, bumpStillsRound, coverAnswers, defect,
  writeAnswers, motionCli, temp, sha256, NO_RUNTIME,
} from './motion-helpers.mjs';
import { ROOT } from './helpers.mjs';

const { COVER, EXIT } = await import(join(ENGINE, 'core', 'constants.mjs'));
const { validateCoverTreatment } = await import(join(ENGINE, 'node', 'cover-treatment.mjs'));
const { validateTreatment } = await import(join(ENGINE, 'node', 'treatment.mjs'));
const { motionMetrics, resample, formatCoverReport, glyphHeights, coverGate } = await import(join(ENGINE, 'node', 'cover-gate.mjs'));
const { decodeWebp, parseWebp } = await import(join(ENGINE, 'node', 'webp.mjs'));
const { img2webpArgs, loopTimes, maxLevelDiff, SEEK_LEVELS, seekOrder } = await import(join(ENGINE, 'node', 'cover.mjs'));
const { lanczosResize, lumaGrid } = await import(join(ENGINE, 'node', 'cover-image.mjs'));
const { artCheck } = await import(join(ENGINE, 'node', 'cover-assets.mjs'));
const { encodePng } = await import(join(ENGINE, 'node', 'png.mjs'));
const { lookCommand } = await import(join(ENGINE, 'node', 'look.mjs'));
const { evaluateDone } = await import(join(ENGINE, 'node', 'done.mjs'));
const { findImg2webp } = await import(join(ENGINE, 'node', 'encode.mjs'));

test('cover treatment: page and cover size, frame count, and the encoder defaults come from the treatment', () => {
  const t = validateCoverTreatment(coverTreatment());
  assert.deepEqual(t.page, [1200, 600]);
  assert.deepEqual(t.out, [1000, 500]);
  assert.equal(t.frames, 96);
  assert.equal(t.encode.q, COVER.encode.q);
  assert.deepEqual(validateCoverTreatment(coverTreatment({ aspect: '3:2' })).out, [960, 640]);
});

test('cover treatment: film fields, sound, invented mottos and out-of-range loops are refused by name (exit 16)', () => {
  const bad = [
    [{ beats: [] }, 'beats'], [{ copy: { source: 'invented', lines: ['x'] } }, 'copy'], [{ sound: { mode: 'generated' } }, 'sound'],
    [{ loopSec: 5 }, 'loopSec'], [{ loopSec: 13 }, 'loopSec'], [{ fps: 60 }, 'fps'], [{ aspect: '16:9' }, 'aspect'],
    [{ motto: { text: 'Ship it before lunch', source: 'user' } }, 'motto.text'], [{ motto: { text: 'Ship it', source: 'project' } }, 'motto.from'],
    [{ idea: 'A moving cover for the top of the LOOPTEST readme.' }, 'idea'], [{ recipe: 'slides' }, 'recipe'],
    [{ title: { box: [0.5, 0.5, 0.6, 0.2], kind: 'live' } }, 'title.box'], [{ title: { box: [0.1, 0.1, 0.2, 0.2], kind: 'drawn' } }, 'title.kind'],
    [{ layers: { slow: 'Bars slide.', mid: 'A dot circles.' } }, 'layers.beat'],
  ];
  for (const [over, field] of bad) assert.throws(() => validateCoverTreatment(coverTreatment(over)), (e) => e.field === field, JSON.stringify(over));
  assert.equal(validateCoverTreatment(coverTreatment({ motto: { text: 'Keep it lit', source: 'project', from: 'README.md' } })).motto.text, 'Keep it lit');
  assert.throws(() => validateTreatment(coverTreatment()), (e) => e.field === 'mode' && /motion\.mjs cover/.test(e.message), 'a film render points a cover at the cover command');
});

test('loop kit: every helper closes the loop and the kit reads no clock', () => {
  const kit = readFileSync(join(ENGINE, 'stage', 'loop-kit.js'), 'utf8');
  const box = {};
  vm.runInNewContext(kit, box);
  const L = box.LitLoop;
  const noise = L.makeNoise(5);
  for (const off of [0, 1.7, 9.3]) assert.ok(Math.abs(L.loopNoise(noise, 0, off) - L.loopNoise(noise, 1, off)) < 1e-9);
  assert.ok(Math.abs(L.swell(0) - L.swell(1)) < 1e-12);
  assert.equal(L.cdist(0.98, 0.02).toFixed(6), '0.040000');
  assert.equal(L.window(0.05, 0.9, 0.2).toFixed(6), '0.750000', 'an event that straddles t = 0 wraps');
  assert.equal(L.window(0.5, 0.9, 0.2), -1);
  const a = L.rng(42);
  const b = L.rng(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.equal(L.cubicPulse(0.3, 0.1, 0.3), 1);
  assert.doesNotMatch(kit.replace(/^\s*\/\/.*$/gm, ''), /Math\.random\(|Date\.now\(|performance\.now\(|requestAnimationFrame\(/);
});

test('cover init script: every clock and entropy source throws during capture and the call is recorded', () => {
  const init = readFileSync(join(ENGINE, 'stage', 'cover-init.js'), 'utf8');
  class Performance { now() { return 1; } }
  const ctx = { Math: Object.create(Math), Date, Performance, performance: new Performance(), crypto: { getRandomValues: () => 1 }, document: { documentElement: null, addEventListener() {} } };
  ctx.window = ctx;
  vm.runInNewContext(init, ctx);
  assert.throws(() => ctx.Math.random(), /Math\.random is forbidden/);
  assert.throws(() => ctx.window.Date.now(), /Date\.now is forbidden/);
  assert.throws(() => new ctx.window.Date(), /Date is forbidden/);
  assert.equal(new ctx.window.Date(0).getTime(), 0, 'a fixed date is fine');
  assert.throws(() => ctx.performance.now(), /performance\.now is forbidden/);
  assert.throws(() => ctx.window.requestAnimationFrame(() => {}), /requestAnimationFrame is forbidden/);
  assert.throws(() => ctx.crypto.getRandomValues(), /getRandomValues is forbidden/);
  assert.deepEqual(Array.from(ctx.__litCoverMisuse()), ['Math.random', 'Date.now', 'Date', 'performance.now', 'requestAnimationFrame', 'crypto.getRandomValues']);
});

test('gate metrics: a still loop is all still, a steady drift is all moving, a reset is a seam spike', () => {
  const flat = (v) => Float32Array.from({ length: 16 }, (_, i) => v + (i % 2));
  const still = motionMetrics({ lumas: Array.from({ length: 96 }, () => flat(10)), delays: Array(96).fill(63) });
  assert.equal(still.movingFrac, 0);
  assert.ok(Math.abs(still.longestStillSec - 96 * 0.063) < 1e-9);
  const drift = Array.from({ length: 96 }, (_, i) => Float32Array.from({ length: 16 }, (_, k) => 100 + 60 * Math.sin(2 * Math.PI * (i / 96 + k / 16))));
  const moving = motionMetrics({ lumas: drift, delays: Array(96).fill(63) });
  assert.equal(moving.movingFrac, 1);
  assert.ok(moving.seamLocal > 0.5 && moving.seamLocal < 1.5, String(moving.seamLocal));
  const sweep = motionMetrics({ lumas: Array.from({ length: 96 }, (_, i) => flat(i)), delays: Array(96).fill(63) });
  assert.ok(sweep.seamLocal > 50, String(sweep.seamLocal));
});

test('gate metrics: merged frames are resampled on the time grid, so a long frame reads as a hold', () => {
  assert.deepEqual(resample(['a', 'b', 'c'], [100, 300, 100], 50), ['a', 'a', 'b', 'b', 'b', 'b', 'b', 'b', 'c', 'c']);
  const flat = (v) => Float32Array.from({ length: 16 }, (_, i) => v + (i % 2));
  const m = motionMetrics({ lumas: [flat(0), flat(80), flat(160)], delays: [1000, 3000, 1000] });
  assert.ok(m.longestStillSec >= 2.9, String(m.longestStillSec));
});

test('gate report: every gate is named with the strict verdict; FLOOR and TARGET stay the calibrated numbers', () => {
  const text = formatCoverReport({ pass: true, target: false, width: 1000, height: 500, format: 'webp', sourceFrames: 128, sourceDurationSec: 8.064, bytes: 2_400_000, loop: 0, stepMs: 63, gates: { G1: { pass: true, target: false, bytes: 2_400_000 }, G2: { pass: true, target: true, medianD: 0.002 } } }, { strict: true });
  assert.match(text, /^COVER gate --strict: PASS\(floor\)$/m);
  assert.match(text, /G1 pass\(floor\) bytes=2400000/);
  assert.equal(COVER.targetBytes, 2 * 1024 * 1024);
  assert.equal(COVER.target.seamLocal, 2);
  assert.equal(COVER.target.seamLo, 0.25);
  assert.equal(COVER.minGlyphPx, 24);
  assert.equal(SEEK_LEVELS, 1);
});

test('encoder arguments: frame 0 and the last edge frames get the edge quality, 63 ms per frame at 16 fps, no keyframe knobs', () => {
  const args = img2webpArgs({ files: ['a', 'b', 'c', 'd'], fps: 16, encode: { q: 80, edgeQ: 97, edgeFrames: 1, method: 4 }, out: 'o.webp' });
  assert.deepEqual(args.slice(0, 7), ['-loop', '0', '-lossy', '-q', '80', '-m', '4']);
  const perFrame = [];
  for (let i = 7; i < args.length - 2; i += 5) perFrame.push(args.slice(i, i + 5).join(' '));
  assert.deepEqual(perFrame, ['-d 63 -q 97 a', '-d 63 -q 80 b', '-d 63 -q 80 c', '-d 63 -q 97 d']);
  assert.doesNotMatch(args.join(' '), /-kmin|-kmax|mp4/);
  assert.deepEqual(loopTimes(4), [[0, 0], [1, 0.25], [2, 0.5], [3, 0.75]]);
  const src = Buffer.alloc(40 * 20 * 4, 255);
  assert.ok(lanczosResize(src, 40, 20, 20, 10).every((v) => v === 255), 'the 2x capture downsamples cleanly');
  const g = lumaGrid(Buffer.alloc(1000 * 500 * 4), 1000, 500);
  assert.deepEqual([g.w, g.h], [333, 166]);
});

test('decoded file: img2webp + dwebp give back every frame, its duration and loop 0, composited like a browser', (t) => {
  if (!HAVE_WEBP) return t.skip('libwebp tools (img2webp, dwebp) not found');
  const dir = temp('litgravity-webp-');
  const W = 64;
  const H = 32;
  const files = [];
  for (let i = 0; i < 6; i += 1) {
    const rgb = Buffer.alloc(W * H * 3, 20);
    for (let y = 8; y < 24; y += 1) for (let x = i * 8; x < i * 8 + 12; x += 1) rgb.fill(230, (y * W + x) * 3, (y * W + x) * 3 + 3);
    const f = join(dir, `f${i}.png`);
    writeFileSync(f, encodePng(rgb, W, H, 3));
    files.push(f);
  }
  const out = join(dir, 'c.webp');
  const r = spawnSync(findImg2webp(), img2webpArgs({ files, fps: 16, encode: { q: 90, edgeQ: 97, edgeFrames: 2, method: 4 }, out }), { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const parsed = parseWebp(readFileSync(out));
  assert.equal(parsed.loop, 0);
  const edges = [];
  const info = decodeWebp(out, { onFrame: (_, rgba) => {
    const row = 16 * W * 4;
    let left = -1;
    for (let x = 0; x < W; x += 1) if (rgba[row + x * 4] > 128) { left = x; break; }
    edges.push(left);
  } });
  assert.equal(info.frames, 6);
  assert.deepEqual(info.durations, Array(6).fill(63));
  assert.deepEqual(edges, [0, 8, 16, 24, 32, 40]);
});

test('strict gate: a decoded cover between 2 and 3 MiB passes the floor and fails --strict on G1 (exit 13)', (t) => {
  if (!HAVE_WEBP) return t.skip('libwebp tools (img2webp, dwebp) not found');
  const dir = temp('litgravity-heavy-');
  const W = 320;
  const H = 160;
  const files = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed >>> 24; };
  for (let i = 0; i < 96; i += 1) {
    const rgb = Buffer.alloc(W * H * 3);
    for (let p = 0; p < rgb.length; p += 3) rgb[p] = rgb[p + 1] = rgb[p + 2] = rnd();
    const f = join(dir, `f${String(i).padStart(3, '0')}.png`);
    writeFileSync(f, encodePng(rgb, W, H, 3, { level: 1 }));
    files.push(f);
  }
  let picked = null;
  for (const q of [30, 40, 50, 60, 70]) {
    const out = join(dir, `q${q}.webp`);
    spawnSync(findImg2webp(), img2webpArgs({ files, fps: 16, encode: { q, edgeQ: q, edgeFrames: 0, method: 0 }, out }));
    const bytes = readFileSync(out).length;
    if (bytes > COVER.targetBytes && bytes <= COVER.maxBytes) { picked = out; break; }
  }
  if (!picked) return t.skip('this libwebp could not land a noise cover between 2 and 3 MiB');
  const r = coverGate(picked);
  assert.equal(r.gates.G1.pass, true);
  assert.equal(r.gates.G1.target, false);
  assert.equal(r.pass, true, 'every other gate passes the floor');
  const strict = motionCli(['cover-gate', picked, '--strict']);
  assert.equal(strict.status, EXIT.GATE_FAIL_QA, strict.stdout);
  assert.match(strict.stdout, /G1 pass\(floor\)/);
  assert.equal(motionCli(['cover-gate', picked]).status, 0, 'without --strict the floor decides');
});

test('cover look: the eight cover questions, no stills-only round 1, and damage or a slide read asks for another round', () => {
  const out = fakeCoverRun(temp('litgravity-look-'));
  const r = lookCommand({ out, round: 1, answersFile: writeAnswers(out, coverAnswers()) });
  assert.equal(r.code, 0);
  assert.equal(r.record.mode, 'cover');
  assert.deepEqual(r.record.revise, []);
  const nine = coverAnswers();
  nine.answers.push({ q: 9, verdict: 'yes', frame: 'stills/sheet.png', observed: 'A ninth answer about the sheet that a cover never asks for.' });
  assert.throws(() => lookCommand({ out, round: 1, answersFile: writeAnswers(out, nine) }), /unknown question 9/);
  const doc = coverAnswers();
  doc.answers[1].verdict = 'no';
  doc.answers[6].verdict = 'yes';
  doc.answers[7].verdict = 'named';
  assert.deepEqual(lookCommand({ out, round: 1, answersFile: writeAnswers(out, doc) }).record.revise, [2, 7, 8]);
});

test('cover done: TARGET on the last render, two rounds, and a last round that viewed sheet, poster and seam with read_file', () => {
  const out = fakeCoverRun(temp('litgravity-done-'));
  assert.equal(evaluateDone({ out }).status, 'NOT_DONE');
  const file = writeAnswers(out, coverAnswers());
  lookCommand({ out, round: 1, answersFile: file });
  assert.match(evaluateDone({ out }).reasons.join(' '), /only one look round/);
  bumpStillsRound(out, 2);
  lookCommand({ out, round: 2, answersFile: file });
  const opened = new Set(['sheet', 'poster', 'seam'].map((n) => join(out, 'stills', `${n}.png`)));
  assert.equal(evaluateDone({ out, viewedFiles: opened }).status, 'DONE');
  assert.match(evaluateDone({ out, viewedFiles: new Set() }).reasons.join(' '), /never opened with read_file/);
  writeFileSync(join(out, 'gate-report.txt'), 'COVER gate --strict: PASS(floor)\n');
  assert.match(evaluateDone({ out, viewedFiles: opened }).reasons.join(' '), /did not reach every TARGET gate/);
});

test('C001 defects: up to three, each with a loop time, a region on the cover and a frame from the current stills', () => {
  const out = fakeCoverRun(temp('litgravity-defects-'));
  const ok = lookCommand({ out, round: 1, answersFile: writeAnswers(out, coverAnswers({ defects: [defect()] })) });
  assert.deepEqual(ok.record.defects[0].region, [340, 10, 330, 50]);
  assert.equal(ok.record.defects[0].t, 1.2);
  const bad = [
    [{ t: undefined }, /defect 1: t must be the loop time in seconds/],
    [{ t: 9 }, /defect 1: t must be the loop time in seconds \(0 to 6\.048\)/],
    [{ frame: 'stills/beat-01.png' }, /defect 1: frame "stills\/beat-01\.png" is not in the latest stills set/],
    [{ region: [900, 400, 300, 200] }, /defect 1: region must be \[x, y, w, h\] inside the 1000x500 cover/],
    [{ observed: 'red' }, /defect 1: observed must be at least one sentence/],
    [{ fix: '' }, /defect 1: cause and fix/],
  ];
  for (const [over, message] of bad) {
    const run = fakeCoverRun(temp('litgravity-defects-bad-'));
    assert.throws(() => lookCommand({ out: run, round: 1, answersFile: writeAnswers(run, coverAnswers({ defects: [defect(over)] })) }), message, JSON.stringify(over));
  }
  const four = fakeCoverRun(temp('litgravity-defects-four-'));
  assert.throws(() => lookCommand({ out: four, round: 1, answersFile: writeAnswers(four, coverAnswers({ defects: [defect(), defect({ t: 2 }), defect({ t: 3 }), defect({ t: 4 })] })) }), /at most 3 defects per round/);
  const film = fakeCoverRun(temp('litgravity-defects-film-'));
  const index = JSON.parse(readFileSync(join(film, 'stills', 'index.json'), 'utf8'));
  writeFileSync(join(film, 'stills', 'index.json'), JSON.stringify({ ...index, mode: undefined, path: 'stage', stillsOnly: true }));
  assert.throws(() => lookCommand({ out: film, round: 1, answersFile: writeAnswers(film, { ...coverAnswers({ defects: [defect()] }), weakestBeat: 0 }) }), /defects are a cover-mode record/);
});

// C007: the asset list is checked before any browser or runtime, so these run without Chrome.
test('C007 assets: a listed asset that is missing is BLOCKED_ASSET_MISSING (exit 22) and no frame is written', () => {
  const art = () => {
    const rgb = Buffer.alloc(96 * 64 * 3);
    for (let y = 0; y < 64; y += 1) for (let x = 0; x < 96; x += 1) rgb.fill(((x * 7) ^ (y * 13)) & 255, (y * 96 + x) * 3, (y * 96 + x) * 3 + 3);
    return encodePng(rgb, 96, 64, 3);
  };
  const painted = coverTreatment({ recipe: 'painted-light', recipeReason: 'The painting carries the picture; the page relights it.', title: { box: [0.35, 0.03, 0.31, 0.09], kind: 'painted' } });
  const listed = (hash) => ({ assets: [{ path: 'cover/assets/base.png', role: 'base-art', source: 'user', sha256: hash, box: [0.125, 0, 0.75, 1] }] });
  const run = ({ assets, writeArt = true, extra = null }) => {
    const out = join(temp('litgravity-assets-'), 'out');
    mkdirSync(join(out, 'cover', 'assets'), { recursive: true });
    cpSync(join(COVER_FIXTURES, 'good', 'index.html'), join(out, 'cover', 'index.html'));
    const png = art();
    if (writeArt) writeFileSync(join(out, 'cover', 'assets', 'base.png'), png);
    if (extra) writeFileSync(join(out, 'cover', 'assets', extra), png);
    writeFileSync(join(out, 'treatment.json'), JSON.stringify(painted));
    if (assets) writeFileSync(join(out, 'assets.json'), JSON.stringify(assets(sha256(png))));
    return out;
  };
  const missing = run({ assets: listed, writeArt: false });
  const r = motionCli(['cover', '--out', missing, '--round', '1']);
  assert.equal(r.status, EXIT.BLOCKED_ASSET_MISSING, r.stdout + r.stderr);
  assert.match(r.stderr, /BLOCKED_ASSET_MISSING: cover\/assets\/base\.png is listed in assets\.json and missing; supply it, never draw a stand-in/);
  assert.match(r.stdout, /^exit 22 BLOCKED_ASSET_MISSING$/m);
  assert.equal(existsSync(join(missing, '.run', 'cover', 'frames')), false);
  assert.equal(existsSync(join(missing, 'cover.webp')), false);
  const unlistedBase = motionCli(['cover', '--out', run({ assets: null }), '--round', '1']);
  assert.equal(unlistedBase.status, EXIT.BLOCKED_ASSET_MISSING, unlistedBase.stderr);
  assert.match(unlistedBase.stderr, /the painted-light recipe needs its base art listed in assets\.json/);
  const extra = motionCli(['cover', '--out', run({ assets: listed, extra: 'logo.png' }), '--round', '1']);
  assert.equal(extra.status, EXIT.STAGE_CONTRACT_ERROR, extra.stderr);
  assert.match(extra.stderr, /cover\/assets\/logo\.png is a raster the page can load but assets\.json does not list/);
  const changed = motionCli(['cover', '--out', run({ assets: () => listed('0'.repeat(64)) }), '--round', '1']);
  assert.equal(changed.status, EXIT.STAGE_CONTRACT_ERROR, changed.stderr);
  assert.match(changed.stderr, /cover\/assets\/base\.png does not match its sha256 in assets\.json/);
});

test('C008 assets: frame 0 must show the base art (SSIM of its check box against the source scaled into it)', () => {
  const AW = 96;
  const AH = 64;
  const W = 200;
  const H = 100;
  const box = [50, 10, AW, AH];
  const frame = Buffer.alloc(W * H * 4, 255);
  const src = Buffer.alloc(AW * AH * 4);
  for (let y = 0; y < AH; y += 1) for (let x = 0; x < AW; x += 1) {
    const v = ((x * 7) ^ (y * 13)) & 255;
    src.fill(v, (y * AW + x) * 4, (y * AW + x) * 4 + 3);
    src[(y * AW + x) * 4 + 3] = 255;
    frame.fill(v, ((box[1] + y) * W + box[0] + x) * 4, ((box[1] + y) * W + box[0] + x) * 4 + 3);
  }
  const rel = [box[0] / W, box[1] / H, box[2] / W, box[3] / H];
  const ok = artCheck({ frame0: frame, width: W, height: H, art: { rgba: src, width: AW, height: AH }, box: rel });
  assert.ok(ok.pass && ok.ssim > 0.99, JSON.stringify(ok));
  const flat = artCheck({ frame0: Buffer.alloc(W * H * 4, 40), width: W, height: H, art: { rgba: src, width: AW, height: AH }, box: rel });
  assert.equal(flat.pass, false);
  assert.ok(flat.ssim < COVER.artSsim, String(flat.ssim));
});

test('C009 assets: a generated base art becomes a label the reply has to carry', () => {
  const out = fakeCoverRun(temp('litgravity-generated-'));
  writeFileSync(join(out, 'assets.json'), JSON.stringify({ assets: [{ path: 'cover/assets/base.png', role: 'base-art', source: 'generated', sha256: 'a'.repeat(64), box: [0.125, 0, 0.75, 1] }] }));
  const file = writeAnswers(out, coverAnswers());
  lookCommand({ out, round: 1, answersFile: file });
  bumpStillsRound(out, 2);
  lookCommand({ out, round: 2, answersFile: file });
  assert.deepEqual(evaluateDone({ out }).labels, ['the base art cover/assets/base.png is generated, not supplied: label it as generated in the reply']);
});

/** Mask frames at cover size: `glyphPx`-tall white letters in the title box, on black. */
function masks(dir, glyphPx, count = 4) {
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < count; i += 1) {
    const rgb = Buffer.alloc(1000 * 500 * 3);
    for (let g = 0; g < 6; g += 1) {
      const x0 = 120 + g * (glyphPx + 8);
      for (let y = 100; y < 100 + glyphPx; y += 1) for (let x = x0; x < x0 + Math.max(3, Math.round(glyphPx * 0.6)); x += 1) rgb.fill(255, (y * 1000 + x) * 3, (y * 1000 + x) * 3 + 3);
    }
    writeFileSync(join(dir, `m${String(i).padStart(4, '0')}.png`), encodePng(rgb, 1000, 500, 3));
  }
  return dir;
}

test('C010 G6: letters 13 px tall on a 1000 px cover are about 10.8 px at the 830 px README width and fail; 60 px pass', () => {
  const box = [0.1, 0.15, 0.8, 0.3];
  const small = glyphHeights({ masksDir: masks(join(temp('litgravity-g6-'), 'm'), 13), box, displayWidth: 830 });
  assert.ok(Math.abs(small.capPx - 13 * 0.83) < 0.6, JSON.stringify(small));
  assert.equal(small.pass, false);
  const big = glyphHeights({ masksDir: masks(join(temp('litgravity-g6-'), 'm'), 60), box, displayWidth: 830 });
  assert.equal(big.pass, true);
  const exempt = glyphHeights({ masksDir: masks(join(temp('litgravity-g6-'), 'm'), 13), box, displayWidth: 830, exempt: 'painted into the base art cover/assets/base.png' });
  assert.equal(exempt.pass, null, 'a painted title is measured and exempt');
  const gate = readFileSync(join(ENGINE, 'node', 'cover-gate.mjs'), 'utf8');
  assert.match(gate, /g\.G5 = /);
  assert.match(gate, /g\.G6 = /, 'G6 sits beside G5, never instead of it');
});

test('C012/C013 seek order: one rasterizer level is tolerated, two are not, and the 16-frame shuffle is seeded', () => {
  const dir = temp('litgravity-seek-');
  const frame = (v) => {
    const f = join(dir, `f${v}.png`);
    writeFileSync(f, encodePng(Buffer.alloc(16 * 8 * 3, v), 16, 8, 3));
    return f;
  };
  assert.equal(maxLevelDiff(frame(100), frame(101)), 1);
  assert.equal(maxLevelDiff(frame(100), frame(102)), 2);
  const order = seekOrder(96, 20261020);
  assert.equal(new Set(order).size, 16);
  assert.deepEqual(order, seekOrder(96, 20261020));
  assert.notDeepEqual(order, [...order].sort((a, b) => a - b));
});

test('C014 recipes: each ships its page and a gate row inside TARGET and 2 MiB; no encoded cover ships', () => {
  for (const name of ['painted-light', 'weight-tide', 'orbit-loop']) {
    const doc = JSON.parse(readFileSync(join(SKILL, 'recipes', name, 'expected.json'), 'utf8'));
    assert.equal(doc.schema, 'litgravity.motion-cover-recipe/v1', name);
    for (const k of ['medianD', 'movingFrac', 'longestStillSec', 'spike', 'seamLocal', 'bytes']) assert.equal(typeof doc.row[k], 'number', `${name}.${k}`);
    assert.ok(doc.row.bytes <= COVER.targetBytes, name);
    assert.ok(doc.row.seamLocal >= COVER.target.seamLo && doc.row.seamLocal <= COVER.target.seamLocal, name);
    assert.doesNotThrow(() => validateCoverTreatment(doc.treatment), name);
    assert.ok(existsSync(join(SKILL, 'recipes', name, 'index.html')), name);
  }
  assert.equal(readdirSync(join(SKILL, 'recipes'), { recursive: true }).some((f) => /\.(webp|gif|mp4)$/.test(String(f))), false);
});

test('C016 negatives: four slide-like pages ship, each declaring the gates it must keep failing (mustFail)', () => {
  const want = { 'title-slam': ['G2.floor', 'G3.floor'], 'card-scenes': ['G2.floor'], 'still-glow': ['G2.floor', 'G3.floor'], 'reset-sweep': ['G4.floor'] };
  for (const [name, mustFail] of Object.entries(want)) {
    const doc = JSON.parse(readFileSync(join(SKILL, 'recipes', 'negatives', name, 'expected.json'), 'utf8'));
    assert.equal(doc.schema, 'litgravity.motion-cover-negative/v1', name);
    assert.deepEqual(doc.mustFail, mustFail, name);
    assert.ok(doc.mustFail.every((id) => /^G[0-6]\.(floor|target)$/u.test(id)), name);
    assert.ok(existsSync(join(SKILL, 'recipes', 'negatives', name, 'index.html')), name);
  }
  const reg = JSON.parse(readFileSync(join(SKILL, 'recipes', 'painted-light', 'expected.json'), 'utf8')).regressions['feather-150'];
  assert.deepEqual(reg.mustFail, ['G1.target']);
  assert.deepEqual(reg.patch, { find: 'feather: 24,', replace: 'feather: 150,' });
  assert.match(reg.defect, /look review/u);
  assert.ok(readFileSync(join(SKILL, 'recipes', 'painted-light', 'index.html'), 'utf8').includes(reg.patch.find), 'the patch still finds its text');
});

// The cover recipe QA proves a negative only by the gates it declares. A crash, an undeclared regression or a
// failure on another gate is a QA failure with the reason, never a caught defect.
const QA = join(ROOT, 'scripts', 'qa-cover-recipes.mjs');
const qa = (args) => {
  const base = join(temp('litgravity-qa-base-'), 'base.png');
  writeFileSync(base, encodePng(Buffer.alloc(1536 * 1024 * 3), 1536, 1024, 3));
  return spawnSync(process.execPath, [QA, '--out', temp('litgravity-cover-qa-'), '--base', base, ...args], {
    encoding: 'utf8', timeout: 120000, env: { ...process.env, LITGRAVITY_MOTION_RUNTIME: NO_RUNTIME },
  });
};

test('cover recipe QA: a crashed render never counts as a caught regression or negative', () => {
  const r = qa(['--feather', '150']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAIL +regression painted-light feather-150 +not proven: the render did not complete and gate the decoded file \(exit 14\)/mu);
  const n = qa(['--negatives', '--only', 'weight-tide']);
  assert.equal(n.status, 1, n.stdout + n.stderr);
  for (const name of ['title-slam', 'card-scenes', 'still-glow', 'reset-sweep']) assert.match(n.stdout, new RegExp(`^FAIL +negative ${name} +not proven: the render did not complete`, 'mu'));
  assert.match(n.stdout, /^FAIL +regression painted-light feather-150 +not proven: the render did not complete/mu);
});

test('cover recipe QA: a regression nobody declared is a QA failure, not a caught defect', () => {
  const r = qa(['--feather', '200']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAIL +regression painted-light feather-200 +not proven: painted-light\/expected\.json declares no regression feather-200/mu);
});

test('cover recipe QA: without --base the painted regression relights the pinned base, and an unfinished render fails rather than passes', () => {
  const r = spawnSync(process.execPath, [QA, '--out', temp('litgravity-cover-qa-'), '--feather', '150'], { encoding: 'utf8', timeout: 120000, env: { ...process.env, LITGRAVITY_MOTION_RUNTIME: NO_RUNTIME } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAIL +regression painted-light feather-150 +not proven: the render did not complete/mu);
});

test('cover recipe QA verdict: a gated render and every declared gate failing; an undeclared FLOOR failure is not enough', async () => {
  const { judgeCase } = await import(QA);
  const gates = (over) => ({ G1: { pass: true, target: true }, G2: { pass: true, target: true }, G3: { pass: true, target: true }, G4: { pass: true, target: true }, ...over });
  const run = (status, g) => ({ status, manifest: g ? { gate: { gates: g } } : null });
  assert.equal(judgeCase(['G1.target'], run(14, null)).ok, false);
  assert.match(judgeCase(['G1.target'], run(14, null)).why, /did not complete/u);
  assert.equal(judgeCase(['G1.target'], run(1, gates({ G1: { pass: true, target: false } }))).ok, false, 'a crash exit with a stale manifest');
  assert.match(judgeCase(['G1.target'], run(13, gates({ G4: { pass: true, target: false } }))).why, /G1\.target did not fail/u);
  assert.equal(judgeCase(['G1.target'], run(13, gates({ G1: { pass: true, target: false }, G4: { pass: true, target: false } }))).ok, true);
  assert.match(judgeCase(['G1.target'], run(13, gates({ G1: { pass: true, target: false }, G3: { pass: false, target: false } }))).why, /G3\.floor, which it does not declare/u);
  assert.equal(judgeCase(['G2.floor', 'G3.floor'], run(13, gates({ G2: { pass: false, target: false } }))).ok, false);
  assert.equal(judgeCase(['G2.floor', 'G3.floor'], run(13, gates({ G2: { pass: false, target: false }, G3: { pass: false, target: false } }))).ok, true);
  assert.match(judgeCase(['G5.floor'], run(13, gates({}))).why, /G5 was not measured/u);
  assert.match(judgeCase([], run(13, gates({}))).why, /declares no gate/u);
  assert.match(judgeCase(undefined, run(13, gates({}))).why, /declares no gate/u);
});

// painted-light/index.html carries five bay x ranges measured on the five-panel family painting; the README now shows the
// seven-panel one at the same 1536x1024 size, so the QA keeps its own pinned copy of the painting it was calibrated on.
test('cover QA: the painted recipe defaults to its own pinned five-panel base, never the README picture', async () => {
  const { DEFAULT_BASE } = await import(join(ROOT, 'scripts', 'qa-cover-recipes.mjs'));
  assert.equal(DEFAULT_BASE, join(ROOT, 'test', 'fixtures', 'motion', 'painted-light-base.png'));
  const png = readFileSync(DEFAULT_BASE);
  assert.equal(png.length, 2399201);
  assert.equal(createHash('sha256').update(png).digest('hex'), '955ccd875bd0da509ba850b76a83ac7aa76f2ecc5c019bcb2d04043e8d46179e');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1536, 1024]);
  const bays = readFileSync(join(ROOT, 'plugin', 'skills', 'lit-typographic-motion', 'recipes', 'painted-light', 'index.html'), 'utf8').match(/bays: (\[\[.*?\]\]),/)[1];
  assert.equal(JSON.parse(bays).length, 5);
});
