import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, PLUGIN } from './helpers.mjs';

const pinned = () => JSON.parse(readFileSync(join(ROOT, 'test', 'fixtures', 'pack-files.json'), 'utf8'));

// npm pack output is the same list `npm run sync:fixtures` writes, so a new file must be re-pinned on purpose.
test('npm pack payload matches the pinned allow-list', () => {
  const r = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const files = JSON.parse(r.stdout)[0].files.map((f) => f.path).sort();
  assert.deepEqual(files, pinned());
  for (const f of files) {
    assert.doesNotMatch(f, /^(test|scripts|\.lit[a-z]*|evidence|plans)\//, f);
    assert.notEqual(f, 'AGENTS.md');
    assert.doesNotMatch(f, /\.(pyc|tgz)$|__pycache__|node_modules/, f);
  }
  for (const f of ['plugin/plugin.json', 'plugin/hooks.json', 'plugin/rules/AGENTS.md', 'bin/litgravity.mjs', 'LICENSE']) assert.ok(files.includes(f), f);
});

test('package.json: scoped name, bin target, node floor, test and gate scripts, lockstep versions', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@litfamily/litgravity');
  assert.equal(pkg.bin.litgravity, 'bin/litgravity.mjs');
  assert.ok(existsSync(join(ROOT, pkg.bin.litgravity)));
  assert.equal(pkg.engines.node, '>=20');
  assert.equal(pkg.scripts.test, 'node --test test/*.test.mjs');
  for (const s of ['check:version', 'scan:legacy-tokens', 'validate', 'sync:fixtures']) assert.ok(pkg.scripts[s], s);
  assert.equal(JSON.parse(readFileSync(join(PLUGIN, 'plugin.json'), 'utf8')).version, pkg.version);
  assert.deepEqual(pkg.files.slice().sort(), ['CHANGELOG.md', 'LICENSE', 'README.md', 'README_ko-KR.md', 'bin', 'lib', 'plugin']);
});

test('READMEs: both languages, the seven-member cover and family picture, install line, no "X, not Y" pairs', () => {
  for (const f of ['README.md', 'README_ko-KR.md']) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    assert.doesNotMatch(text, /TODO\(cover\)/, `${f}: cover slot still open`);
    for (const asset of ['cover-motion.webp', 'cover-motion-still.webp', 'cover.webp', 'litfamily-machines.png']) {
      assert.ok(text.includes(`./docs/assets/${asset}`), `${f}: ${asset}`);
      assert.ok(existsSync(join(ROOT, 'docs', 'assets', asset)), `docs/assets/${asset}`);
    }
    assert.match(text, /prefers-reduced-motion: reduce\)" srcset="\.\/docs\/assets\/cover-motion-still\.webp"/, `${f}: still under reduced motion`);
    assert.match(text, /\bseven\b|일곱/, `${f}: seven-member family`);
    assert.doesNotMatch(text, /\b(five|다섯) (LitFamily|armored|products|robots|machines)|(다섯 제품|로봇 다섯|기계 다섯)/i, `${f}: five-member family wording`);
    assert.match(text, /npx @litfamily\/litgravity install/, `${f}: install line`);
    assert.doesNotMatch(text, /\b\w+, not \w+/, `${f}: X, not Y pair`);
  }
  for (const f of ['AGENTS.md', 'CHANGELOG.md', 'RELEASE_CHECKLIST.md', 'LICENSE']) assert.ok(statSync(join(ROOT, f)).size > 100, f);
});

// The repository is renamed to litgravity before the first publish; GitHub redirects the old name.
test('first publish: package metadata, README badges and links point at wjgoarxiv/litgravity', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.repository, { type: 'git', url: 'git+https://github.com/wjgoarxiv/litgravity.git' });
  assert.deepEqual(pkg.bugs, { url: 'https://github.com/wjgoarxiv/litgravity/issues' });
  assert.equal(pkg.homepage, 'https://github.com/wjgoarxiv/litgravity#readme');
  for (const f of ['README.md', 'README_ko-KR.md']) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    for (const link of ['https://www.npmjs.com/package/@litfamily/litgravity', 'https://img.shields.io/github/stars/wjgoarxiv/litgravity', 'https://github.com/wjgoarxiv/litfamily']) {
      assert.ok(text.includes(link), `${f}: ${link}`);
    }
    assert.doesNotMatch(text, /antigravity-swarm/, `${f}: old repository name`);
  }
  const license = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
  assert.match(license, /^Copyright \(c\) 2026 Antigravity$/m, 'the original MIT line stays');
  assert.match(license, /^Copyright \(c\) 2026 LitGravity contributors$/m);
});

test('.gitignore keeps local state out of the repo', () => {
  const lines = readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n');
  for (const entry of ['.lit*/', '.litgravity/', '/HANDOFF.md', '.handoff/', 'evidence/', 'node_modules/', 'plans/']) assert.ok(lines.includes(entry), entry);
});

// A packed file that git ignores would be missing from a fresh clone.
test('no file in the pack is ignored by git', () => {
  const r = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], { cwd: ROOT, input: pinned().join('\n'), encoding: 'utf8' });
  assert.equal(r.stdout.trim(), '', `ignored by git: ${r.stdout.trim()}`);
});

test('version lockstep and token scanner scripts pass on this tree', () => {
  for (const script of ['check-version.mjs', 'scan-legacy-tokens.mjs']) {
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts', script)], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, `${script}: ${r.stdout}${r.stderr}`);
  }
});
