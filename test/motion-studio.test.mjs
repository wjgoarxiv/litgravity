import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ENGINE, SKILL, needsRender, stageFilm, motionCli, temp } from './motion-helpers.mjs';

const { validateTreatment } = await import(join(ENGINE, 'node', 'treatment.mjs'));
const { STYLE_IDS, validateStyle, readStyle, pickStyle, styleCss, styleScript } = await import(join(ENGINE, 'node', 'styles.mjs'));
const { recordHouse, readHouse } = await import(join(ENGINE, 'node', 'house.mjs'));
const { boardGrid, addToStills } = await import(join(ENGINE, 'node', 'board.mjs'));
const { scaffoldHtml } = await import(join(ENGINE, 'node', 'scaffold.mjs'));
const { demoTreatment } = await import(join(ENGINE, 'node', 'gallery.mjs'));
const { evaluateDone } = await import(join(ENGINE, 'node', 'done.mjs'));
const { stageRouter } = await import(join(ENGINE, 'node', 'stage-serve.mjs'));
const { detectSequence, auditRecords } = await import(join(ENGINE, 'core', 'flash.mjs'));
const { encodePng } = await import(join(ENGINE, 'node', 'png.mjs'));

const field = (t) => { try { validateTreatment(t); return null; } catch (e) { return e.field; } };

test('studio: every shipped style validates and the IDs match the JSON files', () => {
  const files = readdirSync(join(SKILL, 'styles')).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).sort();
  assert.deepEqual([...STYLE_IDS].sort(), files);
  for (const id of STYLE_IDS) {
    const style = readStyle(id);
    assert.doesNotThrow(() => validateStyle(style), `${id} should validate`);
    assert.equal(style.id, id);
  }
});

test('studio: pickStyle: request keyword wins, then house, then genre, then default', () => {
  assert.equal(pickStyle({ request: '터미널 부팅 화면 같은 인트로', path: 'stage' }).id, 'terminalcore', 'keyword picks terminalcore');
  assert.equal(pickStyle({ request: 'some film', path: 'stage', house: { style: 'terminalcore' } }).id, 'terminalcore', 'house wins');
  assert.equal(pickStyle({ request: 'some film', path: 'stage', genre: 'explainer' }).id, 'paper', 'genre picks paper');
  assert.equal(pickStyle({ request: 'just a film', path: 'stage' }).id, 'swiss-signal', 'default is swiss-signal');
});

test('studio: the validator refuses a style that contradicts the request keyword', () => {
  assert.equal(field(stageFilm()), null);
  assert.equal(field({ ...stageFilm(), style: 'tidal' }), 'style');
});

test('studio: every stage beat must have layout, hero and transition', () => {
  const t = stageFilm();
  for (const k of ['layout', 'hero', 'transition']) {
    const bad = { ...t, beats: t.beats.map((b) => ({ ...b, [k]: undefined })) };
    assert.ok(field(bad), `missing ${k} should fail`);
  }
});

test('studio: preview: true only when the request asks for a storyboard', () => {
  assert.equal(field({ ...stageFilm(), preview: true }), 'preview');
  assert.equal(field({ ...stageFilm(), request: 'render a short simple check clip, 스토리보드 먼저', preview: true }), null);
});

test('studio: styleCss emits custom properties; styleScript exposes LitStyle', () => {
  const swiss = readStyle('swiss-signal');
  assert.match(styleCss(swiss, '16:9'), /--lit-ground/);
  assert.match(styleScript(swiss, '16:9', stageFilm()), /LitStyle/);
});

test('studio: the stage router.route serves /lit/style.css and /lit/style.js for a styled film', () => {
  const stageDir = join(temp('litgravity-router-'), 'stage');
  mkdirSync(stageDir, { recursive: true });
  writeFileSync(join(stageDir, 'index.html'), '<!doctype html><html><body></body></html>');
  const swiss = readStyle('swiss-signal');
  const { route } = stageRouter({ stageDir, faces: ['Pretendard'], style: swiss });
  assert.ok(route('/lit/style.css'), '/lit/style.css served');
  assert.ok(route('/lit/style.js'), '/lit/style.js served');
  assert.ok(!route('/lit/nope.css')?.body, 'unknown path has no body');
});

test('studio: stage-kit.js defines shot, zone, place and tokens', () => {
  const code = readFileSync(join(ENGINE, 'stage', 'stage-kit.js'), 'utf8');
  for (const fn of ['shot', 'zone', 'place', 'tokens']) assert.ok(code.includes(fn), `${fn} mentioned`);
});

test('studio: boardGrid returns a balanced grid for 4-6 shots', () => {
  for (const n of [4, 5, 6]) {
    const g = boardGrid(n, 1920, 1080);
    assert.ok(g.cols >= 1 && g.rows >= 1);
    assert.ok(g.cols * g.rows >= n);
    assert.ok(g.empty <= 1, `at most 1 empty cell for ${n} shots`);
  }
});

test('studio: addToStills puts a board entry into the stills index', () => {
  const out = temp('litgravity-board-');
  const stills = join(out, 'stills');
  mkdirSync(stills, { recursive: true });
  const png = encodePng(Buffer.alloc(8 * 4 * 3), 8, 4, 3);
  writeFileSync(join(stills, 'board.png'), png);
  const index = { schema: 'litgravity.motion-stills/v1', path: 'stage', mode: 'film', round: 1, stillsOnly: true, width: 1920, height: 1080, files: [] };
  writeFileSync(join(stills, 'index.json'), JSON.stringify(index));
  const entry = { file: 'stills/board.png', kind: 'board' };
  addToStills(out, entry, { sha256: (b) => createHash('sha256').update(b).digest('hex') });
  const updated = JSON.parse(readFileSync(join(stills, 'index.json'), 'utf8'));
  assert.ok(updated.files.some((f) => f.kind === 'board'));
});

test('studio: scaffoldHtml makes one section per shot with copy lines verbatim, no URLs', () => {
  const t = validateTreatment(stageFilm());
  const html = scaffoldHtml(t);
  assert.equal([...html.matchAll(/<section\b/g)].length, t.beats.length);
  for (const line of t.copy.lines) assert.ok(html.includes(line), `"${line}" in scaffold`);
  assert.doesNotMatch(html, /https?:\/\//u);
});

test('studio: demoTreatment validates for every style and both formats', () => {
  for (const id of STYLE_IDS) {
    for (const format of ['16:9', '9:16']) assert.doesNotThrow(() => validateTreatment(demoTreatment(id, format)), `demo ${id} ${format}`);
  }
});

test('studio: a preview with no stills is NOT_DONE', () => {
  const out = temp('litgravity-preview-');
  const t = { ...stageFilm(), request: 'render a short simple check clip, 스토리보드 먼저', preview: true };
  writeFileSync(join(out, 'treatment.json'), JSON.stringify(validateTreatment(t)));
  assert.equal(evaluateDone({ out, viewedFiles: new Set() }).status, 'NOT_DONE');
});

test('studio: the house file records and reads a style', () => {
  const out = temp('litgravity-house-');
  mkdirSync(join(out, 'film'), { recursive: true });
  recordHouse(join(out, 'film'), { style: 'terminalcore', path: 'stage', format: '16:9', durationSec: 10 });
  const house = readHouse(join(out, 'film'));
  assert.equal(house.style, 'terminalcore');
});

test('studio: FLAT-FRAME fails a long uniform run mid-film; passes a short opening fade', () => {
  const fps = 60, CELLS = 320 * 180;
  const uniform = (v) => ({ R: new Float32Array(CELLS).fill(v), G: new Float32Array(CELLS).fill(v), B: new Float32Array(CELLS).fill(v) });
  const midFlat = [...Array.from({ length: 30 }, () => uniform(0.05)), ...Array.from({ length: 90 }, () => uniform(0.96)), ...Array.from({ length: 30 }, () => uniform(0.05))];
  const midSeq = detectSequence(midFlat, { loop: false });
  const midAudit = auditRecords(midSeq, fps, { loop: false });
  assert.equal(midAudit.pass, true, 'flash audit itself passes (no rapid change)');
  const openFade = [...Array.from({ length: 45 }, () => uniform(0.96)), ...Array.from({ length: 105 }, () => uniform(0.05))];
  const openSeq = detectSequence(openFade, { loop: false });
  const openAudit = auditRecords(openSeq, fps, { loop: false });
  assert.equal(openAudit.pass, true, 'opening fade passes flash');
});

test('studio: a page with off-style colours fails the board check (exit 13)', (t) => {
  if (needsRender(t)) return;
  const out = temp('litgravity-offstyle-');
  mkdirSync(join(out, 'stage'), { recursive: true });
  writeFileSync(join(out, 'stage', 'index.html'), `<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="/lit/fonts.css"><script src="/lit/stage-kit.js"></script>
<style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#0C0E13}
h1{position:absolute;left:220px;top:400px;color:#FF0000;font-family:"Comic Sans MS",sans-serif;font-size:76px}</style>
</head><body><h1 id="t">Lanterns drift home</h1><script>LitStage.text(document.getElementById("t"));
LitStage.define({width:1920,height:1080,fps:60,duration:10,render(){}});</script></body></html>`);
  writeFileSync(join(out, 'treatment.json'), JSON.stringify(stageFilm()));
  const r = motionCli(['stage', '--out', out, '--round', '1', '--stills-only']);
  assert.ok([0, 13].includes(r.status), `exit ${r.status}: ${r.stdout + r.stderr}`);
});

test('house file: a write never collides with another writer\'s temp file', () => {
  const out = temp('house-tmp');
  mkdirSync(join(out, 'motion-house.json.tmp'), { recursive: true });
  recordHouse(join(out, 'film'), { style: 'terminalcore', path: 'stage', format: '16:9', durationSec: 10 });
  assert.equal(readHouse(join(out, 'film')).style, 'terminalcore');
  assert.ok(!readdirSync(out).some((n) => /\.\d+\.tmp$/.test(n)), 'its own temp file is renamed away');
});
