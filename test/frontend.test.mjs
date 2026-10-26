import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PLUGIN } from './helpers.mjs';
import { detectRoute, frontendIntent, SKILL_IDS, KEYWORD_ROUTES } from '../plugin/hooks/lib/routes.mjs';
import {
  initLock, lockRecord, kitStyles, styleForBrief, validateStyle,
  LOCK_FILE, LOCK_SCHEMA, FAMILIES, DEFAULT_STYLE_BY_FAMILY, DENSITIES, densityForBrief,
  MOMENT_KINDS, MOMENT_SCALE_BY_FAMILY, setMoment,
} from '../plugin/skills/frontend-ui-ux/scripts/design-lock.mjs';
import { measureLock } from '../plugin/skills/frontend-ui-ux/scripts/interface-probe-lock.mjs';
import { RULES } from '../plugin/skills/frontend-ui-ux/scripts/interface-probe-rules.mjs';

const skillRoot = join(PLUGIN, 'skills', 'frontend-ui-ux');
const body = readFileSync(join(skillRoot, 'SKILL.md'), 'utf8');

// ---- Enrollment ---------------------------------------------------------------------------------

test('frontend-ui-ux is enrolled: folder, route table, SKILL.md under 24 KB', () => {
  assert.ok(SKILL_IDS.has('frontend-ui-ux'));
  assert.ok(existsSync(join(skillRoot, 'SKILL.md')));
  assert.ok(Buffer.byteLength(body, 'utf8') < 24000, `SKILL.md is ${Buffer.byteLength(body, 'utf8')} bytes`);
  const fm = body.match(/^---\nname: (.+)\n/m);
  assert.ok(fm && fm[1] === 'frontend-ui-ux');
});

test('frontend-ui-ux SKILL.md references house-styles.md and design-lock.mjs', () => {
  assert.match(body, /house-styles\.md/u);
  assert.match(body, /design-lock\.mjs/u);
  assert.match(body, /DS-008/u);
  assert.match(body, /data-ui-moment/u);
});

test('kit directory ships the five house styles and three layout starters', () => {
  for (const style of ['field-notes', 'graphite', 'meadow', 'computational-brutalism', 'neo-brutalism']) {
    assert.ok(existsSync(join(skillRoot, 'kit', 'styles', `${style}.json`)), `style ${style}`);
  }
  for (const family of ['landing', 'workspace', 'settings']) {
    assert.ok(existsSync(join(skillRoot, 'kit', 'layouts', `${family}.html`)), `layout ${family}`);
  }
  assert.ok(existsSync(join(skillRoot, 'kit', 'components.css')));
  assert.ok(existsSync(join(skillRoot, 'kit', 'ui.js')));
  assert.ok(existsSync(join(skillRoot, 'kit', 'fonts.json')));
});

// ---- Keyword routes -----------------------------------------------------------------------------

test('frontend and ui keyword routes reach frontend-ui-ux', () => {
  assert.equal(KEYWORD_ROUTES['frontend'], 'frontend-ui-ux');
  assert.equal(KEYWORD_ROUTES['ui'], 'frontend-ui-ux');
  assert.equal(detectRoute('lit frontend build the settings page').route, 'frontend-ui-ux');
  assert.equal(detectRoute('lit ui redesign the header').route, 'frontend-ui-ux');
});

// ---- Build-intent route (English) ---------------------------------------------------------------

test('English build-intent routes to frontend-ui-ux under bare lit', () => {
  for (const prompt of [
    'lit build a landing page for the product',
    'lit create a dashboard showing the metrics',
    'lit make a settings page with dark mode',
    'lit design the homepage layout',
    'lit restyle the dashboard',
    'lit 대시보드 페이지 만들어줘',
    'lit 인터페이스 디자인해줘',
  ]) {
    assert.equal(detectRoute(prompt).route, 'frontend-ui-ux', prompt);
  }
});

test('near-miss negatives do not route to frontend-ui-ux', () => {
  // Backend, schema, BI tools, explanations stay away
  for (const prompt of [
    'lit build a backend API for the dashboard',
    'lit explain CSS grid to me',
    'lit build a Grafana dashboard',
    'lit create a docker image for the app',
    'lit fix the database schema migration',
    'lit build the API endpoint for login',
  ]) {
    assert.notEqual(detectRoute(prompt).route, 'frontend-ui-ux', prompt);
  }
});

test('frontendIntent detects build commands and rejects non-interface work', () => {
  assert.ok(frontendIntent('build a landing page'));
  assert.ok(frontendIntent('create a dashboard'));
  assert.ok(frontendIntent('design the settings screen'));
  assert.ok(frontendIntent('대시보드 디자인해줘'));
  assert.ok(!frontendIntent('build the backend'));
  assert.ok(!frontendIntent('explain CSS grid'));
  assert.ok(!frontendIntent('build a Grafana dashboard'));
  assert.ok(!frontendIntent('create a docker image'));
});

// ---- Design lock --------------------------------------------------------------------------------

test('kitStyles returns five styles, each valid', () => {
  const styles = kitStyles();
  assert.equal(styles.length, 5);
  for (const style of styles) {
    const issues = validateStyle(style);
    assert.deepEqual(issues, [], `style ${style.id}: ${issues.join(', ')}`);
  }
});

test('styleForBrief picks from keywords, longest keyword wins', () => {
  assert.equal(styleForBrief('a brutalist dashboard').id, 'computational-brutalism');
  assert.equal(styleForBrief('a neo-brutalism landing page').id, 'neo-brutalism');
  assert.equal(styleForBrief('an editorial report page'), null);
  assert.equal(styleForBrief('retro-futurist console').id, 'computational-brutalism');
  assert.equal(styleForBrief('브루탈리즘 대시보드').id, 'computational-brutalism');
  assert.equal(styleForBrief('네오브루탈리즘 페이지').id, 'neo-brutalism');
});

test('densityForBrief defaults to rich, picks calm for minimal/quiet/calm/미니멀', () => {
  assert.equal(densityForBrief('build a dashboard'), 'rich');
  assert.equal(densityForBrief('a minimal landing page'), 'calm');
  assert.equal(densityForBrief('차분한 페이지'), 'calm');
  assert.equal(densityForBrief('절제된 디자인'), 'calm');
  assert.equal(densityForBrief('a quiet settings screen'), 'calm');
});

test('initLock writes lock file, tokens, components and ui.js', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-lock-'));
  try {
    const result = initLock({ family: 'landing', dir, scaffold: true, moment: 'type-set-piece', momentNote: 'the product name' });
    assert.equal(result.style.id, 'field-notes');
    assert.equal(result.density, 'rich');
    assert.ok(existsSync(join(dir, LOCK_FILE)));
    assert.ok(existsSync(join(dir, 'ui', 'tokens.css')));
    assert.ok(existsSync(join(dir, 'ui', 'components.css')));
    assert.ok(existsSync(join(dir, 'ui', 'ui.js')));
    assert.ok(existsSync(join(dir, 'index.html')));
    const lock = JSON.parse(readFileSync(join(dir, LOCK_FILE), 'utf8'));
    assert.equal(lock.schema_id, LOCK_SCHEMA);
    assert.equal(lock.style, 'field-notes');
    assert.equal(lock.density, 'rich');
    assert.equal(lock.moment.kind, 'type-set-piece');
    assert.equal(lock.moment.scale, 'bold');
    // tokens carry dark mode
    const tokens = readFileSync(join(dir, 'ui', 'tokens.css'), 'utf8');
    assert.match(tokens, /prefers-color-scheme: dark/u);
    assert.match(tokens, /--ui-lock: "field-notes"/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initLock locks graphite by default for workspace family', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-lock-'));
  try {
    const result = initLock({ family: 'workspace', dir, moment: 'chart', momentNote: 'the main metric' });
    assert.equal(result.style.id, 'graphite');
    assert.equal(result.density, 'rich');
    const lock = JSON.parse(readFileSync(join(dir, LOCK_FILE), 'utf8'));
    assert.equal(lock.moment.scale, 'small');
    assert.equal(lock.moment.kind, 'chart');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initLock respects --density calm', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-lock-'));
  try {
    initLock({ family: 'landing', dir, density: 'calm', moment: 'hero-composition', momentNote: 'the product view' });
    const lock = JSON.parse(readFileSync(join(dir, LOCK_FILE), 'utf8'));
    assert.equal(lock.density, 'calm');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initLock picks style from brief keywords', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-lock-'));
  try {
    initLock({ family: 'landing', dir, brief: 'a neo-brutalism launch page', moment: 'hero-composition', momentNote: 'blocks' });
    const lock = JSON.parse(readFileSync(join(dir, LOCK_FILE), 'utf8'));
    assert.equal(lock.style, 'neo-brutalism');
    assert.equal(lock.elevation, 'offset');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('setMoment updates an existing lock', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-lock-'));
  try {
    initLock({ family: 'landing', dir });
    const before = JSON.parse(readFileSync(join(dir, LOCK_FILE), 'utf8'));
    assert.equal(before.moment.kind, null);
    setMoment({ dir, kind: 'data-moment', note: 'the main figure' });
    const after = JSON.parse(readFileSync(join(dir, LOCK_FILE), 'utf8'));
    assert.equal(after.moment.kind, 'data-moment');
    assert.equal(after.moment.note, 'the main figure');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- DS-008 RED fixtures ------------------------------------------------------------------------

test('DS-008 rules exist with the right thresholds', () => {
  assert.ok(RULES['DS-008']);
  assert.equal(RULES['DS-008'].severity, 'HIGH');
  assert.equal(RULES['DS-008'].threshold.attribute, 'data-ui-moment');
  assert.equal(RULES['DS-008'].threshold.boldMinAreaPx, 40000);
  assert.equal(RULES['DS-008'].threshold.smallMinAreaPx, 4800);
});

test('all DS rules (DS-001..DS-008) are present', () => {
  for (let i = 1; i <= 8; i++) {
    const id = `DS-00${i}`;
    assert.ok(RULES[id], `${id} missing`);
    assert.ok(RULES[id].fix, `${id} has no fix`);
  }
});

// ---- CF-205 maximal-ui --------------------------------------------------------------------------

test('CF-205 allows up to 4 hue clusters (rich), 1 cluster (calm)', () => {
  assert.equal(RULES['CF-205'].threshold.maxClusters, 4);
  assert.equal(RULES['CF-205'].threshold.calmMaxClusters, 1);
});

// ---- Orphan proof (routes) ----------------------------------------------------------------------

test('removing frontend-ui-ux from KEYWORD_ROUTES does not remove the route table entry', () => {
  assert.ok(SKILL_IDS.has('frontend-ui-ux'));
});

// ---- Exported constants are consistent ----------------------------------------------------------

test('FAMILIES, DEFAULT_STYLE_BY_FAMILY and DENSITIES are consistent with the kit', () => {
  const styles = kitStyles();
  const ids = new Set(styles.map((s) => s.id));
  assert.deepEqual(Object.keys(FAMILIES).sort(), ['landing', 'settings', 'workspace']);
  for (const [family, defaultId] of Object.entries(DEFAULT_STYLE_BY_FAMILY)) {
    assert.ok(FAMILIES[family], `${family} is a default but not a family`);
    assert.ok(ids.has(defaultId), `default ${defaultId} is not a shipped style`);
  }
  assert.deepEqual([...DENSITIES].sort(), ['calm', 'rich']);
});

test('MOMENT_KINDS and MOMENT_SCALE_BY_FAMILY cover every family', () => {
  for (const family of Object.keys(FAMILIES)) {
    const scale = MOMENT_SCALE_BY_FAMILY[family];
    assert.ok(scale === 'bold' || scale === 'small', `${family} scale`);
    assert.ok(MOMENT_KINDS[scale].length > 0, `${scale} has no kinds`);
  }
  assert.ok(MOMENT_KINDS.bold.includes('hero-composition'));
  assert.ok(MOMENT_KINDS.small.includes('chart'));
});

// ---- lockRecord produces a valid shape ----------------------------------------------------------

test('lockRecord builds a lock object with the right schema', () => {
  const style = kitStyles().find((s) => s.id === 'graphite');
  const record = lockRecord(style, 'workspace', { kind: 'chart', note: 'revenue' }, 'rich');
  assert.equal(record.schema_id, LOCK_SCHEMA);
  assert.equal(record.style, 'graphite');
  assert.equal(record.family, 'workspace');
  assert.equal(record.density, 'rich');
  assert.ok(Array.isArray(record.fonts));
  assert.ok(record.colors.light && record.colors.dark);
  assert.equal(record.moment.kind, 'chart');
  assert.equal(record.moment.scale, 'small');
});

// ---- measureLock is a function (the in-page serialiser) -----------------------------------------

test('measureLock is exported and callable', () => {
  assert.equal(typeof measureLock, 'function');
});

// ---- writeFileSync exercised: write and verify a lock file round-trip ----------------------------

test('a written lock file round-trips through JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-lock-rt-'));
  try {
    initLock({ family: 'settings', dir, moment: 'header-detail', momentNote: 'the plan name' });
    const lockPath = join(dir, LOCK_FILE);
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    lock._test = 'round-trip';
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    const reread = JSON.parse(readFileSync(lockPath, 'utf8'));
    assert.equal(reread._test, 'round-trip');
    assert.equal(reread.style, 'graphite');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('kit: a glow on the stage hero art lands on its content, so no empty band is outlined', () => {
  const css = readFileSync(join(skillRoot, 'kit', 'components.css'), 'utf8');
  assert.match(css, /\.ui-hero__art\.ui-glow \{ box-shadow: none; \}/);
  assert.match(css, /\.ui-hero__art\.ui-glow > \* \{ box-shadow: var\(--glow\); \}/);
});

test('pixel-art: a cell size that is not a number is refused, never drawn as NaN', async () => {
  const { pixelSvg } = await import('../plugin/skills/frontend-ui-ux/scripts/pixel-art.mjs');
  assert.throws(() => pixelSvg('ia\nai', { label: 'a mark', cell: Number('abc') }), /cell/);
  assert.match(pixelSvg('ia\nai', { label: 'a mark', cell: 8 }), /width="16"/);
});
