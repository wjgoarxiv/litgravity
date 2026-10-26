import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SKILL, ENGINE, WARM, coverRun, coverTreatment, motionCli, needsRender, temp } from './motion-helpers.mjs';

// Real renders: headless Chrome, img2webp/dwebp and a pre-warmed motion runtime. Each test skips with the reason when
// one is missing, so `npm test` stays green on a machine that never pre-warmed; the evidence runs set
// LITGRAVITY_MOTION_RUNTIME to a warm cache.
const { EXIT, COVER } = await import(join(ENGINE, 'core', 'constants.mjs'));
const { parseWebp } = await import(join(ENGINE, 'node', 'webp.mjs'));
const { validateCoverTreatment } = await import(join(ENGINE, 'node', 'cover-treatment.mjs'));
const { coverGate } = await import(join(ENGINE, 'node', 'cover-gate.mjs'));
const { encodeCover, loopTimes } = await import(join(ENGINE, 'node', 'cover.mjs'));
const { CoverBrowser, CoverPool, capturePass } = await import(join(ENGINE, 'node', 'cover-capture.mjs'));
const { stageFonts } = await import(join(ENGINE, 'node', 'stage-serve.mjs'));
const { decodePng, encodePng } = await import(join(ENGINE, 'node', 'png.mjs'));

test('cover render: a loop with three speed layers reaches every TARGET gate on the decoded file', (t) => {
  if (needsRender(t)) return;
  const out = coverRun('good');
  const r = motionCli(['cover', '--out', out, '--round', '1']);
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /^COVER gate --strict: PASS\+TARGET$/m);
  for (const f of ['cover.webp', 'poster.png', 'manifest.json', 'gate-report.txt', 'stills/sheet.png', 'stills/seam.png', 'stills/poster.png', 'stills/index.json']) assert.ok(existsSync(join(out, f)), f);
  const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  assert.equal(manifest.mode, 'cover');
  assert.equal(manifest.gate.gates.G0.identical, 96);
  assert.ok(manifest.gate.gates.G5.min >= 4.5);
  assert.equal(manifest.gate.gates.FLASH.pass, true);
  assert.equal(parseWebp(readFileSync(join(out, 'cover.webp'))).loop, 0);
  const report = readFileSync(join(out, 'gate-report.txt'), 'utf8');
  assert.match(report, /^ {2}SEEK pass sampled=16 identical=16/m, 'C012: the seek-order check passes');
  assert.match(report, /^ {2}G6 pass capPx=/m);
  assert.equal(motionCli(['cover-gate', join(out, 'cover.webp'), '--strict']).status, 0);
});

test('cover render: Math.random is exit 18 naming the call; no renderFrame is exit 17; a film treatment is exit 16', (t) => {
  if (needsRender(t)) return;
  const random = motionCli(['cover', '--out', coverRun('random'), '--round', '1']);
  assert.equal(random.status, EXIT.STAGE_NONDETERMINISTIC, random.stdout + random.stderr);
  assert.match(random.stderr, /STAGE_NONDETERMINISTIC: the cover page called Math\.random/);
  const none = motionCli(['cover', '--out', coverRun('no-render'), '--round', '1']);
  assert.equal(none.status, EXIT.STAGE_CONTRACT_ERROR, none.stdout + none.stderr);
  assert.match(none.stderr, /defines no window\.renderFrame/);
  const film = coverRun('good');
  writeFileSync(join(film, 'treatment.json'), JSON.stringify({ ...coverTreatment(), mode: undefined }));
  const f = motionCli(['cover', '--out', film]);
  assert.equal(f.status, EXIT.BLOCKED_TREATMENT_INVALID, f.stdout + f.stderr);
});

test('cover render: a page that throws while loading fails fast with its own message, not after the 60 s wait', (t) => {
  if (needsRender(t)) return;
  const started = Date.now();
  const r = motionCli(['cover', '--out', coverRun('throws'), '--round', '1']);
  const seconds = (Date.now() - started) / 1000;
  assert.equal(r.status, EXIT.STAGE_CONTRACT_ERROR, r.stdout + r.stderr);
  assert.match(r.stderr, /STAGE_CONTRACT_ERROR: the cover page stopped before it set window\.ready; first page error: .*ART\.lights has no entry for the hero bay 4/);
  assert.doesNotMatch(r.stderr, /within 60 s/);
  assert.ok(seconds < 30, `the failure took ${seconds.toFixed(1)} s`);
});

test('C013 seek order: a page that keeps state between frames fails, naming the frame time (exit 18)', (t) => {
  if (needsRender(t)) return;
  const r = motionCli(['cover', '--out', coverRun('trails'), '--round', '1']);
  assert.equal(r.status, EXIT.STAGE_NONDETERMINISTIC, r.stdout + r.stderr);
  assert.match(r.stderr, /STAGE_NONDETERMINISTIC: frame \d+ \(t = \d\.\d{3} s\) differs when sought out of order/);
});

test('C002 window: a window render sheets only frames inside [t0 - 0.5, t1 + 0.5] and never counts as done', (t) => {
  if (needsRender(t)) return;
  const out = coverRun('good');
  const r = motionCli(['cover', '--out', out, '--round', '1', '--window', '2.0,2.5']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const dir = join(out, 'windows', 'round-1', '2.000-2.500');
  const doc = JSON.parse(readFileSync(join(dir, 'window.json'), 'utf8'));
  assert.ok(doc.frames.length >= 8);
  for (const f of doc.frames) assert.ok(f.t >= 1.5 - 1e-9 && f.t <= 3.0 + 1e-9, String(f.t));
  assert.ok(existsSync(join(dir, 'sheet.png')));
  assert.equal(existsSync(join(out, 'stills')), false);
  assert.equal(existsSync(join(out, 'gate-report.txt')), false);
  assert.match(r.stdout, /a window render never counts as done/);
});

/** Capture the master pass only, encode and gate the decoded file (negatives and recipe rows). */
async function quickGate(stageDir, treatment) {
  const tr = validateCoverTreatment(treatment);
  const work = temp('litgravity-quick-');
  const dir = join(work, 'frames');
  mkdirSync(dir, { recursive: true });
  const env = { ...process.env, LITGRAVITY_MOTION_RUNTIME: WARM };
  const pool = new CoverPool();
  const browser = await CoverBrowser.open({ stageDir, faces: stageFonts(env), width: tr.page[0], height: tr.page[1], scale: COVER.captureScale, profileDir: join(work, 'chrome'), env });
  try {
    await capturePass({ browser, pool, times: loopTimes(tr.frames), dir, prefix: 'f', width: tr.out[0], height: tr.out[1] });
  } finally {
    await browser.close();
    await pool.close();
  }
  const files = readdirSync(dir).sort().map((f) => join(dir, f));
  const { file } = encodeCover({ files, fps: tr.fps, encode: tr.encode, out: work, env });
  return coverGate(file, { env });
}

for (const name of ['title-slam', 'card-scenes', 'still-glow', 'reset-sweep']) {
  test(`C016 negative ${name}: fails exactly on its declared FLOOR gates`, async (t) => {
    if (needsRender(t)) return;
    const dir = join(SKILL, 'recipes', 'negatives', name);
    const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));
    const r = await quickGate(dir, coverTreatment(expected.treatment));
    const failed = Object.entries(r.gates).filter(([, v]) => v.pass === false).map(([k]) => k).sort();
    assert.deepEqual(failed, expected.mustFail.map((id) => id.replace(/\.floor$/u, '')), JSON.stringify(Object.fromEntries(Object.entries(r.gates).map(([k, v]) => [k, v.pass]))));
  });
}

for (const name of ['weight-tide', 'orbit-loop']) {
  test(`C017 recipe ${name}: still reaches TARGET on the decoded file`, async (t) => {
    if (needsRender(t)) return;
    const expected = JSON.parse(readFileSync(join(SKILL, 'recipes', name, 'expected.json'), 'utf8'));
    const r = await quickGate(join(SKILL, 'recipes', name), expected.treatment);
    assert.equal(r.target, true, JSON.stringify({ medianD: r.medianD, seamLocal: r.seamLocal, bytes: r.bytes }));
  });
}

// Any bay can be the cover hero. A seven-bay painting is a flat grey plate, so every lit pixel reads 128 and a dimmed one less.
const SEVEN = [[13, 217], [231, 435], [449, 653], [667, 872], [886, 1090], [1104, 1308], [1322, 1526]];
const ANCHORS = {
  0: [{ cx: 68, cy: 385, rx: 20, ry: 7, k: 0 }, { cx: 97, cy: 373, rx: 16, ry: 7, k: 1 }, { cx: 61, cy: 689, rx: 32, ry: 32, k: 2 }],
  3: [{ cx: 720, cy: 350, rx: 16, ry: 16, k: 0 }, { cx: 712, cy: 436, rx: 8, ry: 14, k: 1 }, { cx: 694, cy: 680, rx: 16, ry: 28, k: 2 }],
};
const PAINT_SCALE = 0.5859375;

function heroStage(hero, lights) {
  const dir = temp('litgravity-hero-');
  const html = readFileSync(join(SKILL, 'recipes', 'painted-light', 'index.html'), 'utf8');
  const art = { src: 'assets/base.png', width: 1536, height: 1024, bays: SEVEN, top: 148, bottom: 945, hero, title: { box: [455, 32, 635, 88], gain: 1, maskLevel: 60 }, lights, flare: { cx: 902, cy: 987, rx: 60, ry: 22 } };
  const page = html.replace(/^const ART = \{[\s\S]*?^\};$/mu, `const ART = ${JSON.stringify(art)};`);
  assert.notEqual(page, html, 'the recipe keeps one `const ART = { ... };` block');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), page);
  writeFileSync(join(dir, 'assets', 'base.png'), encodePng(Buffer.alloc(1536 * 1024 * 3, 128), 1536, 1024, 3));
  return dir;
}

function openHero(stageDir) {
  const env = { ...process.env, LITGRAVITY_MOTION_RUNTIME: WARM };
  return CoverBrowser.open({ stageDir, faces: stageFonts(env), width: 1200, height: 600, scale: COVER.captureScale, profileDir: join(temp('litgravity-hero-chrome-'), 'p'), env });
}

/** Mean luminance of one bay (inset 40 painting px) in a device-scale capture of the 1200x600 page. */
function bayLuma(png, [x0, x1]) {
  const { width, channels, pixels } = decodePng(png);
  const s = width / 1200;
  const X0 = Math.round((150 + (x0 + 40) * PAINT_SCALE) * s), X1 = Math.round((150 + (x1 - 40) * PAINT_SCALE) * s);
  const Y0 = Math.round((148 + 40) * PAINT_SCALE * s), Y1 = Math.round((945 - 40) * PAINT_SCALE * s);
  let sum = 0;
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const o = (y * width + x) * channels;
    sum += 0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2];
  }
  return sum / ((X1 - X0) * (Y1 - Y0));
}

test('hero: a middle hero (bay 3 of 7) stays as bright as the source at frame 0 while a sleeping bay is dimmed', async (t) => {
  if (needsRender(t)) return;
  const browser = await openHero(heroStage(3, ANCHORS));
  try {
    await browser.frame(0);
    const png = await browser.capture();
    const hero = bayLuma(png, SEVEN[3]), sleeper = bayLuma(png, SEVEN[5]);
    assert.ok(hero >= 0.95 * 128, `hero bay luminance ${hero.toFixed(1)} against source 128`);
    assert.ok(sleeper < 0.6 * 128, `sleeping bay luminance ${sleeper.toFixed(1)} should sit under the dim pool`);
  } finally {
    await browser.close();
  }
});

test("hero: the beat lights glow on the hero's own anchors, never on another machine", async (t) => {
  if (needsRender(t)) return;
  for (const hero of [0, 3]) {
    const browser = await openHero(heroStage(hero, ANCHORS));
    try {
      const halos = await browser.evaluate('[...document.querySelectorAll("#halos ellipse")].map((e) => [+e.getAttribute("cx"), +e.getAttribute("cy")])');
      assert.deepEqual(halos, ANCHORS[hero].map((l) => [l.cx, l.cy]), `hero ${hero}`);
      for (const [cx] of halos) assert.ok(cx >= SEVEN[hero][0] && cx <= SEVEN[hero][1], `hero ${hero}: halo at x ${cx} lies outside its bay`);
    } finally {
      await browser.close();
    }
  }
});

test('hero: a hero declared with no lights (an empty list) runs without beat lights', async (t) => {
  if (needsRender(t)) return;
  const browser = await openHero(heroStage(5, { ...ANCHORS, 5: [] }));
  try {
    assert.equal(await browser.evaluate('document.querySelectorAll("#halos ellipse").length'), 0);
    await browser.frame(0.25);
  } finally {
    await browser.close();
  }
});

test("hero: a hero with no light entry stops the page with a message naming the bay instead of borrowing another machine's lights", async (t) => {
  if (needsRender(t)) return;
  await assert.rejects(openHero(heroStage(5, ANCHORS)), /STAGE_CONTRACT_ERROR: .*first page error: Error: ART\.lights has no entry for the hero bay 5/u);
});
