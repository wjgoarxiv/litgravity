#!/usr/bin/env node
// Cover recipe QA for lit-typographic-motion. It needs Chrome, img2webp/dwebp and a pre-warmed motion runtime, so it is
// not part of `npm test`. Each shipped recipe is re-rendered through the real cover command (every gate runs on the
// decoded file) and has to stay inside its expected.json row: median d and moving share within 15 %, seamLocal inside
// the cover TARGET, at most 2 MiB, exit 0.
//
// `--negatives` adds the four slide-like negatives and every regression a recipe declares. Each of those names the gates
// it must fail in `mustFail`, as `<gate>.<tier>` ids (`G2.floor`: the FLOOR verdict of G2 is false; `G1.target`: the
// TARGET verdict of G1 is false). A case is caught only when
//   1. the cover command finished and gated the decoded file: exit 0 or 13, and a manifest with per-gate verdicts,
//   2. every declared gate failed at its declared tier, and
//   3. no FLOOR gate among G1 to G4 failed without being declared.
// Everything else fails the QA with the reason, so a crash can never read as a caught defect.
//
// `--feather N` runs only the declared `feather-N` regression of the painted recipe. The painted recipe relights the
// five-panel family painting its bay ranges were measured on; that copy is pinned at test/fixtures/motion/painted-light-base.png
// and used unless `--base <png>` (1536x1024) names another. The README's seven-panel picture does not fit those ranges.
//
//   node scripts/qa-cover-recipes.mjs [--out <dir>] [--only painted-light,weight-tide|none] [--negatives] [--feather N] [--base <png>]
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_BASE = join(root, 'test', 'fixtures', 'motion', 'painted-light-base.png');
const skill = join(root, 'plugin', 'skills', 'lit-typographic-motion');
const motion = join(skill, 'scripts', 'motion.mjs');
const { COVER, EXIT } = await import(join(skill, 'engine', 'core', 'constants.mjs'));

const GATE_ID = /^G[0-6]\.(floor|target)$/u;
const FLOOR_GATES = ['G1', 'G2', 'G3', 'G4'];
const NEGATIVES = ['title-slam', 'card-scenes', 'still-glow', 'reset-sweep'];
const RECIPES = ['painted-light', 'weight-tide', 'orbit-loop'];

/**
 * Judges one negative or regression. `mustFail` is the declaration, `run` is { status, manifest } of the cover command.
 * @returns {{ok: boolean, why: string}}
 */
export function judgeCase(mustFail, run) {
  if (!Array.isArray(mustFail) || mustFail.length === 0 || !mustFail.every((id) => GATE_ID.test(id))) {
    return { ok: false, why: 'declares no gate it must fail' };
  }
  const gates = run?.manifest?.gate?.gates;
  if (![EXIT.OK, EXIT.GATE_FAIL_QA].includes(run?.status) || !gates) {
    return { ok: false, why: `the render did not complete and gate the decoded file (exit ${run?.status ?? 'none'})` };
  }
  const problems = [];
  for (const id of mustFail) {
    const [gate, tier] = id.split('.');
    const verdict = gates[gate];
    if (!verdict) { problems.push(`${gate} was not measured`); continue; }
    const failed = tier === 'floor' ? verdict.pass === false : verdict.target === false || verdict.pass === false;
    if (!failed) problems.push(`${id} did not fail`);
  }
  for (const gate of FLOOR_GATES) {
    if (gates[gate]?.pass === false && !mustFail.includes(`${gate}.floor`)) problems.push(`also fails ${gate}.floor, which it does not declare`);
  }
  return { ok: problems.length === 0, why: problems.join('; ') };
}

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const within = (value, want, share) => Math.abs(value - want) <= share * want;
const fmt = (x) => (typeof x === 'number' ? +x.toPrecision(4) : x);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

async function main(argv) {
  const opt = (k) => {
    const i = argv.indexOf(`--${k}`);
    if (i < 0) return null;
    return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
  };
  const outRoot = resolve(opt('out') ?? mkdtempSync(join(tmpdir(), 'litgravity-cover-qa-')));
  const only = opt('only') ? (opt('only') === 'none' ? [] : String(opt('only')).split(',')) : RECIPES;
  const feather = opt('feather') ? Number(opt('feather')) : null;
  const base = opt('base') ? resolve(String(opt('base'))) : existsSync(DEFAULT_BASE) ? DEFAULT_BASE : null;
  const rows = [];
  let failed = 0;

  const render = (name, dir, treatment, { assets = null, patch = null } = {}) => {
    const out = join(outRoot, name);
    mkdirSync(join(out, 'cover'), { recursive: true });
    const page = readFileSync(join(dir, 'index.html'), 'utf8');
    writeFileSync(join(out, 'cover', 'index.html'), patch ? patch(page) : page);
    if (assets) {
      mkdirSync(join(out, 'cover', 'assets'), { recursive: true });
      cpSync(base, join(out, 'cover', 'assets', 'base.png'));
      writeFileSync(join(out, 'assets.json'), JSON.stringify({ assets: assets.map((a) => ({ ...a, sha256: sha256(readFileSync(join(out, a.path))) })) }, null, 2));
    }
    writeFileSync(join(out, 'treatment.json'), JSON.stringify(treatment, null, 2));
    const r = spawnSync(process.execPath, [motion, 'cover', '--out', out, '--round', '1', '--foreground'], { encoding: 'utf8', env: process.env, timeout: 1200000 });
    const manifest = existsSync(join(out, 'manifest.json')) ? readJson(join(out, 'manifest.json')) : null;
    return { out, status: r.status, stdout: r.stdout, stderr: r.stderr, manifest };
  };

  const record = (label, verdict, detail) => {
    if (verdict !== 'PASS') failed += 1;
    rows.push([label, verdict, detail]);
  };
  const caught = (label, mustFail, r) => {
    const j = judgeCase(mustFail, r);
    const gates = r.manifest?.gate?.gates ?? {};
    const failing = Object.entries(gates).flatMap(([k, v]) => [v.pass === false ? `${k}.floor` : null, v.target === false ? `${k}.target` : null]).filter(Boolean);
    if (j.ok) record(label, 'PASS', `fails ${mustFail.join(', ')} as declared; failing ${failing.join(', ') || 'none'}; ${r.manifest?.bytes ?? '?'} B; exit ${r.status}`);
    else record(label, 'FAIL', `not proven: ${j.why}`);
  };

  const regression = (recipe, n) => {
    const label = `regression ${recipe} feather-${n}`;
    const expected = readJson(join(skill, 'recipes', recipe, 'expected.json'));
    const decl = expected.regressions?.[`feather-${n}`];
    if (!decl) return record(label, 'FAIL', `not proven: ${recipe}/expected.json declares no regression feather-${n}`);
    if (!base) return record(label, 'FAIL', 'not proven: it needs its painting: pass --base <png>');
    const dir = join(skill, 'recipes', recipe);
    if (!readFileSync(join(dir, 'index.html'), 'utf8').includes(decl.patch.find)) return record(label, 'FAIL', `not proven: the patch text "${decl.patch.find}" is no longer in the page`);
    const r = render(`${recipe}-feather-${n}`, dir, expected.treatment, { assets: expected.assets ?? null, patch: (html) => html.replace(decl.patch.find, decl.patch.replace) });
    caught(label, decl.mustFail, r);
  };

  if (feather) {
    regression('painted-light', feather);
  } else {
    for (const name of only) {
      const dir = join(skill, 'recipes', name);
      const expected = readJson(join(dir, 'expected.json'));
      if (expected.assets && !base) {
        rows.push([name, 'SKIPPED', 'needs its painting: pass --base <png>']);
        continue;
      }
      const r = render(name, dir, expected.treatment, { assets: expected.assets ?? null });
      if (!r.manifest) {
        record(name, 'FAIL', `NO RENDER: exit ${r.status}: ${(r.stderr || r.stdout).trim().split('\n').pop()}`);
        continue;
      }
      const g = r.manifest.gate;
      const e = expected.row;
      const checks = [
        ['medianD', within(g.medianD, e.medianD, 0.15)],
        ['moving', within(g.movingFrac, e.movingFrac, 0.15)],
        ['seamLocal', g.seamLocal >= COVER.target.seamLo && g.seamLocal <= COVER.target.seamLocal],
        ['bytes', r.manifest.bytes <= COVER.targetBytes],
        ['gate', r.status === 0],
      ];
      const bad = checks.filter(([, ok]) => !ok).map(([k]) => k);
      record(name, bad.length ? `FAIL ${bad.join(',')}` : 'PASS', `median d ${fmt(g.medianD)} (row ${e.medianD}) | moving ${fmt(g.movingFrac)} | still ${fmt(g.longestStillSec)} s | spike ${fmt(g.spike)} | seamLocal ${fmt(g.seamLocal)} | ${r.manifest.bytes} B | exit ${r.status}`);
    }
  }

  if (argv.includes('--negatives')) {
    for (const name of NEGATIVES) {
      const dir = join(skill, 'recipes', 'negatives', name);
      const expected = readJson(join(dir, 'expected.json'));
      const treatment = {
        mode: 'cover', request: 'A shipped negative rendered by the recipe QA.', idea: 'A slide-like page the decoded-file gate has to keep failing.',
        recipe: 'own', recipeReason: 'A regression negative, never a recipe.', brandWord: 'LITGRAVITY', aspect: '2:1',
        layers: { slow: 'None by design.', mid: 'None by design.', beat: 'Card or text changes.' },
        system: { rule: 'Text states on a timeline.', copies: 'One per card.', offset: 'None.' },
        title: { box: [0.05, 0.3, 0.9, 0.3], kind: 'live' }, ambition: 'It must keep failing its declared gates.',
        ...expected.treatment,
      };
      caught(`negative ${name}`, expected.mustFail, render(`negative-${name}`, dir, treatment));
    }
    for (const recipe of RECIPES) {
      const expected = readJson(join(skill, 'recipes', recipe, 'expected.json'));
      for (const key of Object.keys(expected.regressions ?? {})) regression(recipe, Number(key.replace(/^feather-/u, '')));
    }
  }

  for (const [name, verdict, detail] of rows) process.stdout.write(`${verdict.padEnd(22)} ${name.padEnd(28)} ${detail}\n`);
  process.stdout.write(`cover recipe QA: ${failed ? `${failed} FAIL` : 'all PASS'}; renders in ${outRoot}\n`);
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(process.argv.slice(2));
