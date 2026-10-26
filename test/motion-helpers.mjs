// Shared pieces for the lit-typographic-motion tests: a cover treatment, a finished cover run made without Chrome,
// a cover answers file, and the warm-runtime probe that decides whether the real-render tests run.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

export const SKILL = join(ROOT, 'plugin', 'skills', 'lit-typographic-motion');
export const ENGINE = join(SKILL, 'engine');
export const MOTION_CLI = join(SKILL, 'scripts', 'motion.mjs');
export const COVER_FIXTURES = join(ROOT, 'test', 'fixtures', 'motion', 'cover');

const { encodePng } = await import(join(ENGINE, 'node', 'png.mjs'));
const runtime = await import(join(ENGINE, 'node', 'runtime.mjs'));
const { findChrome } = await import(join(ENGINE, 'node', 'chrome.mjs'));
const { findImg2webp } = await import(join(ENGINE, 'node', 'encode.mjs'));
const { findDwebp } = await import(join(ENGINE, 'node', 'webp.mjs'));

export const sha256 = (b) => createHash('sha256').update(b).digest('hex');
export const temp = (prefix) => mkdtempSync(join(tmpdir(), prefix));

/** A cover treatment for a test page that draws LOOPTEST; `over` replaces fields. */
export const coverTreatment = (over = {}) => ({
  mode: 'cover',
  request: 'A moving cover for the top of the LOOPTEST readme.',
  idea: 'Bars slide one period per loop while a dot circles twice beside a word that never moves.',
  hero: 'The dot circles its ring and swells at each lap.',
  beat: 'The dot swells once per lap.',
  recipe: 'own',
  recipeReason: 'A test pattern that has the three speed layers and nothing else.',
  brandWord: 'LOOPTEST',
  aspect: '2:1',
  loopSec: 6,
  fps: 16,
  layers: { slow: 'Bars slide one period per loop.', mid: 'A dot circles its ring twice per loop.', beat: 'The dot swells once per lap.' },
  system: { rule: 'One bar rule.', copies: 'Fourteen bars.', offset: 'The x position of each bar.' },
  title: { box: [0.06, 0.37, 0.56, 0.27], kind: 'live' },
  ambition: 'Every frame moves and the seam vanishes in the decoded file.',
  ...over,
});

/** A finished cover render without Chrome: treatment, stills (frame, poster, seam, sheet), report, manifest. */
export function fakeCoverRun(out, { verdict = 'PASS+TARGET', treatment = coverTreatment() } = {}) {
  mkdirSync(join(out, 'stills'), { recursive: true });
  writeFileSync(join(out, 'treatment.json'), `${JSON.stringify(treatment, null, 2)}\n`);
  const files = [];
  for (const [name, kind] of [['frame-00.png', 'frame'], ['poster.png', 'poster'], ['seam.png', 'seam'], ['sheet.png', 'sheet']]) {
    const bytes = encodePng(Buffer.alloc(8 * 4 * 3, files.length * 11), 8, 4, 3);
    writeFileSync(join(out, 'stills', name), bytes);
    files.push({ file: `stills/${name}`, sha256: sha256(bytes), kind });
  }
  const index = { schema: 'litgravity.motion-stills/v1', path: 'cover', mode: 'cover', round: 1, stillsOnly: false, width: 1000, height: 500, durationSec: 6.048, files };
  writeFileSync(join(out, 'stills', 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  writeFileSync(join(out, 'gate-report.txt'), `COVER gate --strict: ${verdict}\n`);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ mode: 'cover', treatmentSha256: sha256(readFileSync(join(out, 'treatment.json'))) }));
  return out;
}

/** Stamp the fake run's stills as round `round`, as a new render would. */
export function bumpStillsRound(out, round) {
  const index = JSON.parse(readFileSync(join(out, 'stills', 'index.json'), 'utf8'));
  writeFileSync(join(out, 'stills', 'index.json'), JSON.stringify({ ...index, round }));
}

export const coverAnswers = (over = {}) => ({
  viewed: ['stills/sheet.png', 'stills/poster.png', 'stills/seam.png'],
  change: 'Cut the light edge from 60 px to 24 px so the encoder keeps the travelling edge.',
  answers: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((q) => ({
    q,
    verdict: q === 8 ? 'none' : [6, 7].includes(q) ? 'no' : 'yes',
    frame: q === 2 ? 'stills/seam.png' : 'stills/sheet.png',
    observed: `Question ${q}: the orange dot stands at a new angle in each tile of sheet row ${q}.`,
  })),
  ...over,
});

export const defect = (over = {}) => ({
  t: 1.2,
  region: [340, 10, 330, 50],
  frame: 'stills/sheet.png',
  observed: 'The glint turns the Y of the painted title into a solid red block in the second tile.',
  cause: 'A colour-dodge blend saturates the coloured letters.',
  fix: 'Run the glint in overlay blend.',
  ...over,
});

export function writeAnswers(out, doc) {
  const file = join(out, 'answers.json');
  writeFileSync(file, JSON.stringify(doc));
  return file;
}

// The real-render tests run only with a pre-warmed motion runtime (LITGRAVITY_MOTION_RUNTIME, else the default
// LitGravity cache), Chrome and libwebp; they read the cache and never install into it.
function warmRuntime() {
  const data = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
  const candidates = [process.env.LITGRAVITY_MOTION_RUNTIME, join(data, 'litgravity', 'runtime', 'motion')].filter(Boolean);
  for (const dir of candidates) if (runtime.runtimeStatus({ env: { ...process.env, LITGRAVITY_MOTION_RUNTIME: dir } }).ready) return dir;
  return null;
}
export const WARM = warmRuntime();
export const HAVE_WEBP = Boolean(findImg2webp() && findDwebp());

export function needsRender(t) {
  if (!WARM) { t.skip('motion runtime not pre-warmed (npx @litfamily/litgravity runtime install motion)'); return true; }
  if (!findChrome()) { t.skip('Chrome not found'); return true; }
  if (!HAVE_WEBP) { t.skip('libwebp tools (img2webp, dwebp) not found'); return true; }
  return false;
}

export const NO_RUNTIME = join(tmpdir(), 'litgravity-motion-no-runtime');

export const motionCli = (args, env = {}) => spawnSync(process.execPath, [MOTION_CLI, ...args], {
  encoding: 'utf8',
  timeout: 600000,
  env: { ...process.env, LITGRAVITY_MOTION_RUNTIME: WARM ?? NO_RUNTIME, LITGRAVITY_MOTION_FOREGROUND: '1', ...env },
});

/** A cover output folder with a fixture page copied into cover/ and a cover treatment. */
export function coverRun(fixture, over = {}) {
  const out = join(temp(`litgravity-cover-${fixture}-`), 'out');
  mkdirSync(out, { recursive: true });
  cpSync(join(COVER_FIXTURES, fixture), join(out, 'cover'), { recursive: true });
  writeFileSync(join(out, 'treatment.json'), `${JSON.stringify(coverTreatment(over), null, 2)}\n`);
  return out;
}

const clone = (v) => JSON.parse(JSON.stringify(v));

// A short stage film for renderer tests: genre other (three beats), a muted wall panel so sound may be none, and the
// copy line the fixture pages print.
const STAGE_FILM = {
  request: 'render a short simple check clip for the hallway panel',
  genre: 'other',
  path: 'stage',
  pathReason: 'The clip has to show a shape moving and changing, which type alone cannot draw.',
  style: 'swiss-signal',
  register: 'minimal',
  idea: 'A single tile drifts across a dark wall, rounds into a lantern and settles under its line.',
  audience: 'People walking past a hallway panel.',
  channel: 'A muted loop on a hallway panel.',
  format: '16:9',
  formatReason: 'The hallway panel is a landscape screen.',
  durationSec: 10,
  beats: [
    { t0: 0, t1: 3.333, layout: 'title', hero: 'A tile drifts across the dark ground.', transition: 'cut', purpose: 'Open on the moving tile.', onScreen: 'One tile drifting over a dark ground.', motion: 'Constant drift with a slow turn.', sound: 'None.' },
    { t0: 3.333, t1: 6.667, layout: 'split', hero: 'The tile rounds into a disc.', transition: 'wipe', purpose: 'Change the tile.', onScreen: 'The tile rounds into a disc.', motion: 'A timed corner change.', sound: 'None.' },
    { t0: 6.667, t1: 10, layout: 'stage', hero: 'The copy line settles under the disc.', transition: 'end', purpose: 'Hold the line.', onScreen: 'The copy line under the disc.', motion: 'Hold.', sound: 'None.' },
  ],
  story: { expect: 'A tile drifts.', turn: 'The tile rounds into a lantern.', beat: 1, payoff: 'The line settles under the disc.' },
  protagonist: { name: 'the lantern tile', kind: 'object', look: 'A square tile in the signal colour that rounds into a disc.', acts: [{ beat: 0, action: 'Drifts across the ground.' }, { beat: 1, action: 'Rounds into a disc.' }, { beat: 2, action: 'Holds under the line.' }] },
  subject: { name: 'Hallway Lantern Night', source: 'invented', specifics: ['A lantern walk held in a school hallway.', 'Each lantern is a paper tile that folds into a disc.'] },
  visualDevices: [{ kind: 'shape', role: 'subject', beats: [0, 1, 2] }, { kind: 'icon', role: 'support', beats: [2] }],
  typePlan: { faces: ['Pretendard'], hierarchy: 'One headline over one caption line.', maxWordsOnScreen: 6 },
  palette: [{ color: '#0C0E13', role: 'ground' }, { color: '#E9EBE4', role: 'type' }, { color: '#0F7A82', role: 'signal accent' }],
  sound: { mode: 'none', plan: 'Silent: the panel plays muted.' },
  copy: { source: 'invented', lines: ['Lanterns drift home'] },
  inventions: ['Hallway Lantern Night (the name)', 'the copy line'],
  ambition: 'A drift that never stops, a shape change the eye can follow, and a line that lands and holds.',
};

export function stageFilm({ fps = 60, copy, sound } = {}) {
  const t = clone(STAGE_FILM);
  t.fps = fps;
  if (copy) t.copy.lines = copy;
  if (sound) t.sound = sound;
  return t;
}

export const STAGE_FIXTURES = join(ROOT, 'test', 'fixtures', 'motion', 'stage');

/** A film output folder with a fixture page as its stage and a short stage treatment. */
export function stageRun(fixture, opts = {}) {
  const out = join(temp(`litgravity-stage-${fixture}-`), 'out');
  mkdirSync(out, { recursive: true });
  cpSync(join(STAGE_FIXTURES, fixture), join(out, 'stage'), { recursive: true });
  writeFileSync(join(out, 'treatment.json'), `${JSON.stringify(stageFilm(opts), null, 2)}\n`);
  return out;
}
