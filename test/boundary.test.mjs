import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync, statSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, workspace, runHook, basePayload, turn } from './helpers.mjs';
import { scan, diffSnapshots } from '../plugin/hooks/lib/boundary.mjs';

// agy's PreToolUse hook cannot abstain (an empty answer is a denial), so the lit-plan boundary and the prose guard are
// checked after the fact against a snapshot taken when the turn begins.

const post = (ws, env, extra = {}) => runHook('post-invocation', basePayload(ws, { invocationNum: 1, ...extra }), env);
const stop = (ws, env) => runHook('stop', basePayload(ws, { terminationReason: 'NO_TOOL_CALL' }), env);
const msg = (r) => r.json?.injectSteps?.[0]?.ephemeralMessage ?? '';

function planning() {
  const { env } = sandbox();
  const ws = workspace();
  mkdirSync(join(ws.dir, 'src'));
  writeFileSync(join(ws.dir, 'src', 'app.js'), 'export const a = 1;\n');
  writeFileSync(join(ws.dir, 'README.md'), 'A small tool.\n');
  turn(ws, env, 'lit plan a tiny todo app', 0);
  return { env, ws };
}

test('PostInvocation is quiet when nothing changed, and without a route it never scans', () => {
  const { env, ws } = planning();
  assert.deepEqual(post(ws, env).json, {});
  const idle = sandbox();
  const ws2 = workspace();
  writeFileSync(join(ws2.dir, 'a.md'), 'x');
  assert.deepEqual(post(ws2, idle.env).json, {});
});

test('lit-plan boundary: writing plans/ is fine, changing anything else is reported and the loop is forced to continue', () => {
  const { env, ws } = planning();
  mkdirSync(join(ws.dir, 'plans'));
  writeFileSync(join(ws.dir, 'plans', 'todo.md'), '- [ ] 1. a\n');
  assert.deepEqual(post(ws, env).json, {});

  writeFileSync(join(ws.dir, 'src', 'app.js'), 'export const a = 2;\n');
  writeFileSync(join(ws.dir, 'src', 'new.js'), 'x\n');
  const r = post(ws, env);
  assert.equal(r.json.terminationBehavior, 'force_continue');
  assert.match(msg(r), /changed files outside plans\/ and \.litgravity\/: .*src\/app\.js.*src\/new\.js/);
  assert.match(msg(r), /Undo those changes/);
  assert.match(msg(r), /lit start/);
});

test('lit-plan boundary: a file a shell command wrote or deleted is caught too, whatever tool made it', () => {
  const { env, ws } = planning();
  rmSync(join(ws.dir, 'README.md'));
  const r = post(ws, env);
  assert.match(msg(r), /README\.md/);
});

test('lit-plan boundary: reported at most twice per turn, then the turn may end; undoing the change clears it', () => {
  const { env, ws } = planning();
  writeFileSync(join(ws.dir, 'src', 'app.js'), 'changed\n');
  assert.ok(post(ws, env).json.injectSteps);
  assert.ok(post(ws, env).json.injectSteps);
  assert.deepEqual(post(ws, env).json, {}, 'the third report is held back');

  const fresh = planning();
  const file = join(fresh.ws.dir, 'src', 'app.js');
  const at = Math.round(statSync(file).mtimeMs);
  writeFileSync(file, 'changed!\n');
  assert.ok(post(fresh.ws, fresh.env).json.injectSteps);
  writeFileSync(file, 'export const a = 1;\n');
  utimesSync(file, at / 1000, at / 1000);
  assert.deepEqual(post(fresh.ws, fresh.env).json, {}, 'restored content, size and mtime match the snapshot again');
});

test('Stop holds a turn whose workspace left the plan boundary, then lets the plan gate speak', () => {
  const { env, ws } = planning();
  mkdirSync(join(ws.dir, 'plans'));
  writeFileSync(join(ws.dir, 'plans', 'todo.md'), '- [ ] 1. a\n');
  writeFileSync(join(ws.dir, 'src', 'app.js'), 'changed\n');
  const first = stop(ws, env);
  assert.equal(first.json.decision, 'continue');
  assert.match(first.json.reason, /boundary/);
  assert.equal(stop(ws, env).json.decision, 'continue');
  assert.deepEqual(stop(ws, env).json, {}, 'two holds at most, and the plan exists');
});

test('prose guard after the fact: stacked negations and hedges added to Markdown this turn are reported; the humanizer route is exempt', () => {
  const { env } = sandbox();
  const ws = workspace();
  mkdirSync(join(ws.dir, 'docs'));
  writeFileSync(join(ws.dir, 'docs', 'a.md'), 'We never log tokens.\n');
  turn(ws, env, 'lit fix the docs', 0);
  writeFileSync(join(ws.dir, 'docs', 'a.md'), 'We never log tokens. We do not store passwords. We cannot read your files. It will not phone home.\n');
  const r = post(ws, env);
  assert.match(msg(r), /docs\/a\.md now has a paragraph with stacked negations/);
  assert.match(msg(r), /lit-humanizer/);

  const hedge = sandbox();
  const ws2 = workspace();
  writeFileSync(join(ws2.dir, 'b.md'), 'Fine.\n');
  turn(ws2, hedge.env, 'lit fix the docs', 0);
  writeFileSync(join(ws2.dir, 'b.md'), 'This could possibly help. It might perhaps work, and it likely helps somewhat in some cases.\n');
  assert.match(msg(post(ws2, hedge.env)), /stacked hedges/);

  const human = sandbox();
  const ws3 = workspace();
  writeFileSync(join(ws3.dir, 'b.md'), 'Fine.\n');
  turn(ws3, human.env, 'lit humanize this paragraph', 0);
  writeFileSync(join(ws3.dir, 'b.md'), 'We never a. We do not b. We cannot c.\n');
  assert.deepEqual(post(ws3, human.env).json, {});
});

test('the snapshot lives outside the workspace and skips dependency folders and hook state', () => {
  const { env, ws } = planning();
  mkdirSync(join(ws.dir, 'node_modules', 'x'), { recursive: true });
  writeFileSync(join(ws.dir, 'node_modules', 'x', 'i.js'), 'x');
  const files = Object.keys(scan(ws.dir).files);
  assert.ok(files.includes('src/app.js'));
  assert.ok(!files.some((f) => f.startsWith('node_modules/') || f.startsWith('.litgravity/')));
  assert.ok(!existsSync(join(ws.dir, '.litgravity', 'sessions')));
  const root = join(env.XDG_STATE_HOME, 'litgravity', 'sessions');
  const dir = join(root, readdirSync(root)[0]);
  assert.ok(readdirSync(dir).some((f) => f.endsWith('.snapshot.json')));
});

test('a workspace past the scan limits is marked partial and does not invent removals', () => {
  const ws = workspace();
  for (let i = 0; i < 12; i += 1) writeFileSync(join(ws.dir, `f${i}.txt`), 'x');
  const snap = scan(ws.dir, { entries: 5, ms: 1500, proseFiles: 10, proseBytes: 100 });
  assert.equal(snap.partial, true);
  assert.ok(Object.keys(snap.files).length <= 5);
});

test('a partial snapshot never reports files the other walk simply did not reach', () => {
  const before = { partial: true, files: { 'a.txt': '1:1', 'b.txt': '1:1' }, prose: {} };
  const later = { partial: true, files: { 'a.txt': '1:1', 'b.txt': '2:2', 'c.txt': '1:1', 'd.txt': '1:1' }, prose: {} };
  assert.deepEqual(diffSnapshots(before, later), { changed: ['b.txt'], removed: [] });
  const full = { partial: false, files: { 'a.txt': '1:1', 'gone.txt': '1:1' }, prose: {} };
  const cut = { partial: true, files: { 'a.txt': '1:1' }, prose: {} };
  assert.deepEqual(diffSnapshots(full, cut), { changed: [], removed: [] });
  const after = { partial: false, files: { 'a.txt': '1:2', 'new.txt': '1:1' }, prose: {} };
  assert.deepEqual(diffSnapshots(full, after), { changed: ['a.txt', 'new.txt'], removed: ['gone.txt'] });
});
