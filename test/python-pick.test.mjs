import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pickPython } from '../plugin/lib/python-pick.mjs';
import { PLUGIN } from './helpers.mjs';

// A PATH folder of stand-in interpreters: each prints the version it pretends to be.
function fakePath(versions) {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-py-'));
  for (const [name, version] of Object.entries(versions)) {
    const file = join(dir, name);
    writeFileSync(file, `#!/bin/sh\necho ${version}\n`);
    chmodSync(file, 0o755);
  }
  return dir;
}

function withPath(dir, fn) {
  const before = process.env.PATH;
  process.env.PATH = dir;
  try {
    return fn();
  } finally {
    process.env.PATH = before;
  }
}

test('python3 inside the wheel range is used as is', () => {
  const p = withPath(fakePath({ python3: '3.12.4' }), () => pickPython(undefined, 'LITGRAVITY_OFFICE_PYTHON'));
  assert.deepEqual({ ok: p.ok, command: p.command, version: p.version }, { ok: true, command: 'python3', version: '3.12.4' });
});

test('python3 3.15 has no wheels: the picker walks to python3.14, then 3.13, and names what it skipped', () => {
  const a = withPath(fakePath({ python3: '3.15.0', 'python3.14': '3.14.7', 'python3.13': '3.13.9' }), () => pickPython(undefined, 'LITGRAVITY_OFFICE_PYTHON'));
  assert.equal(a.ok, true);
  assert.equal(a.command, 'python3.14');
  assert.match(a.detail, /python3 is 3\.15\.0/);
  const b = withPath(fakePath({ python3: '3.15.0', 'python3.13': '3.13.9' }), () => pickPython(undefined, 'LITGRAVITY_OFFICE_PYTHON'));
  assert.equal(b.command, 'python3.13');
});

test('python3 3.15 with nothing older on PATH is BLOCKED with the exact fix', () => {
  const p = withPath(fakePath({ python3: '3.15.0' }), () => pickPython(undefined, 'LITGRAVITY_SCIVIZ_PYTHON'));
  assert.equal(p.ok, false);
  assert.match(p.detail, /python3 is 3\.15\.0, newer than 3\.14/);
  assert.match(p.detail, /brew install python@3\.14/);
  assert.match(p.detail, /LITGRAVITY_SCIVIZ_PYTHON/);
});

test('an interpreter that is too old or missing is reported with the fix', () => {
  const old = withPath(fakePath({ python3: '3.8.18' }), () => pickPython(undefined, 'LITGRAVITY_OFFICE_PYTHON'));
  assert.equal(old.ok, false);
  assert.match(old.detail, /older than 3\.10/);
  const none = withPath(fakePath({}), () => pickPython(undefined, 'LITGRAVITY_OFFICE_PYTHON'));
  assert.equal(none.ok, false);
  assert.match(none.detail, /LITGRAVITY_OFFICE_PYTHON/);
});

test('the variable of an engine wins, even for a newer interpreter', () => {
  const dir = fakePath({ python3: '3.12.0', mypy: '3.15.1' });
  const p = withPath(dir, () => pickPython('mypy', 'LITGRAVITY_OFFICE_PYTHON'));
  assert.deepEqual({ ok: p.ok, command: p.command }, { ok: true, command: 'mypy' });
});

test('the engines that build a Python environment read the picker: status says BLOCKED with the fix when only 3.15 exists', () => {
  const dir = fakePath({ python3: '3.15.0' });
  const home = mkdtempSync(join(tmpdir(), 'litgravity-py-home-'));
  const env = { PATH: dir, HOME: home, XDG_DATA_HOME: join(home, 'data') };
  for (const [skill, file, fix] of [
    ['lit-pptx', 'office-runtime.mjs', 'LITGRAVITY_OFFICE_PYTHON'],
    ['lit-scientific-visualization', 'sciviz-runtime.mjs', 'LITGRAVITY_SCIVIZ_PYTHON'],
  ]) {
    const r = spawnSync(process.execPath, [join(PLUGIN, 'skills', skill, 'scripts', file), 'status', '--json'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const s = JSON.parse(r.stdout);
    assert.equal(s.ready, false);
    assert.ok(s.missing.some((m) => /newer than 3\.14/.test(m) && m.includes(fix)), `${skill}: ${s.missing.join(' | ')}`);
  }
});

test('`litgravity runtime install sciviz` says BLOCKED with the exact fix when only python3 3.15 exists, and exits 1', () => {
  const dir = fakePath({ python3: '3.15.0' });
  const home = mkdtempSync(join(tmpdir(), 'litgravity-py-home-'));
  const env = { PATH: dir, HOME: home, XDG_DATA_HOME: join(home, 'data') };
  const r = spawnSync(process.execPath, [join(PLUGIN, '..', 'bin', 'litgravity.mjs'), 'runtime', 'install', 'sciviz'], { env, encoding: 'utf8' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^sciviz: BLOCKED: SCIVIZ_RUNTIME_PYTHON_UNAVAILABLE: .*brew install python@3\.14.*LITGRAVITY_SCIVIZ_PYTHON/m);
});

test('an engine variable that names a missing or too old interpreter says how to fix it', () => {
  const dir = fakePath({ python3: '3.12.0', oldpy: '3.8.1' });
  const gone = withPath(dir, () => pickPython('no-such-python', 'LITGRAVITY_OFFICE_PYTHON'));
  assert.equal(gone.ok, false);
  assert.match(gone.detail, /LITGRAVITY_OFFICE_PYTHON/);
  assert.match(gone.detail, /unset/);
  const old = withPath(dir, () => pickPython('oldpy', 'LITGRAVITY_OFFICE_PYTHON'));
  assert.equal(old.ok, false);
  assert.match(old.detail, /LITGRAVITY_OFFICE_PYTHON/);
});

test('the motion audio venv is built from the picked interpreter, so a python3 3.15 falls through to python3.14', async () => {
  const runtime = await import('../plugin/skills/lit-typographic-motion/engine/node/runtime.mjs');
  const home = mkdtempSync(join(tmpdir(), 'litgravity-py-home-'));
  const env = { LITGRAVITY_MOTION_RUNTIME: join(home, 'motion') };
  const picked = withPath(fakePath({ python3: '3.15.0', 'python3.14': '3.14.7' }), () => ({ command: runtime.pythonCommand(env), dir: runtime.audioDir(env) }));
  assert.equal(picked.command, 'python3.14');
  assert.equal(picked.dir, withPath(fakePath({ python3: '3.14.2' }), () => runtime.audioDir(env)), 'the venv key follows the picked 3.14, not the 3.15 python3');
  await assert.rejects(withPath(fakePath({ python3: '3.15.0' }), () => runtime.installAudio({ env })), /newer than 3\.14.*LITGRAVITY_MOTION_PYTHON/);
});
