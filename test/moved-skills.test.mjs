import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sandbox, workspace, runHook, basePayload, turn, injected, walk, collect, ROOT, PLUGIN } from './helpers.mjs';
import { SKILL_ROUTES, KEYWORD_ROUTES, MOVED_SKILLS, extensionLines } from '../plugin/hooks/lib/routes.mjs';
import { activation } from '../plugin/hooks/lib/reentry.mjs';
import { list, routeRows } from '../lib/list.mjs';
import { doctor } from '../lib/doctor.mjs';
import { install } from '../lib/install.mjs';
import { readLock } from '../scripts/sync-lock.mjs';

// Five families left LitGravity for the separate wjgoarxiv-skills repository. Each id stays as a same-name pointer
// stub: the routes, the slash form and the listings still reach it, and it says where the skill went and gives the
// one line that copies its agy folder (variants/litgravity/<id>) into agy's user skills. The engines, the motion done gate and the runtime command left with the bodies.
const FAMILIES = {
  decks: ['lit-pptx'],
  documents: ['lit-docx'],
  figures: ['lit-diagram-drawer', 'lit-schematic', 'lit-scientific-visualization'],
  design: ['frontend-ui-ux', 'visual-qa'],
  'video-covers': ['lit-typographic-motion', 'readme-studio'],
};
const MOVED = Object.entries(FAMILIES).flatMap(([family, ids]) => ids.map((id) => [id, family]));
const PLACE = '<path to your wjgoarxiv-skills clone>';
const stubText = (id) => readFileSync(join(PLUGIN, 'skills', id, 'SKILL.md'), 'utf8');

test('the route table names the five moved families and nothing else', () => {
  assert.deepEqual(Object.entries(MOVED_SKILLS).sort(), MOVED.slice().sort());
  for (const [id] of MOVED) assert.ok(SKILL_ROUTES.some((r) => r.id === id), `${id} keeps its route`);
});

for (const [id, family] of MOVED) {
  test(`${id}: a same-name stub that says where it went and how agy installs it`, () => {
    assert.deepEqual(walk(join(PLUGIN, 'skills', id)), ['SKILL.md'], 'the stub is SKILL.md alone');
    const md = stubText(id);
    assert.match(md, new RegExp(`^---\\nname: ${id}\\ndescription: "[^"\\n]*wjgoarxiv-skills[^"\\n]*"\\n---\\n`));
    assert.ok(md.includes(`\`variants/litgravity/${id}/\``), 'names the folder in wjgoarxiv-skills');
    assert.ok(md.includes(`cp -R "${PLACE}/variants/litgravity/${id}" ~/.gemini/config/skills/${id}\n`), 'the user-scope copy line with the placeholder');
    assert.ok(md.includes(`cp -R "${PLACE}/variants/litgravity/${id}" .agents/skills/${id}\n`), 'the workspace-scope copy line');
    assert.doesNotMatch(md, /agy plugin install|plugins\/(decks|documents|figures|design|video-covers)/, 'no plugin-per-family install left');
    assert.ok(md.includes(`as \`/${id}\``), 'names the bare slash form after install');
    assert.ok(md.includes(`\`litgravity:${id}\``), 'says the stub and the copy keep different names');
    assert.ok(md.includes(`~/.gemini/config/skills/${id}/SKILL.md`) && md.includes(`.agents/skills/${id}/SKILL.md`), 'tells the model where the installed copy is');
    assert.doesNotMatch(md, /another agent host|map its tools/, 'the agy copy needs no tool mapping');
    assert.ok(md.includes('https://github.com/wjgoarxiv/wjgoarxiv-skills'), 'names the public repository');
    assert.match(md, /read_file/);
    assert.match(md, /headless/i);
    assert.doesNotMatch(md, /\/Users\/|\/home\/[a-z]|[A-Z]:\\\\Users/, 'no private path');
    assert.ok(Buffer.byteLength(md) < 7000, `${Buffer.byteLength(md)} B`);
  });
}

test('every route word and `lit <id>` still activates the stub, and the activation carries the install line', () => {
  const { env } = sandbox();
  const prompts = [];
  for (const [id] of MOVED) {
    prompts.push([id, `lit ${id} the task`]);
    for (const [word, target] of Object.entries(KEYWORD_ROUTES)) if (target === id) prompts.push([id, `lit ${word} the task`]);
  }
  prompts.push(['lit-typographic-motion', 'lit make a lyric video for this song']);
  prompts.push(['lit-schematic', 'lit draw a P&ID of the dosing skid']);
  prompts.push(['frontend-ui-ux', 'lit build a landing page for the product']);
  for (const [id, prompt] of prompts) {
    const ws = workspace();
    const text = injected(turn(ws, env, prompt, 0));
    assert.ok(text.includes(join(PLUGIN, 'skills', id, 'SKILL.md')), `${prompt}: reads the stub`);
    for (const line of extensionLines(id)) assert.ok(text.includes(line), `${prompt}: install line ${line}`);
    assert.ok(text.includes(`variants/litgravity/${id}/`), `${prompt}: names the folder`);
    assert.ok(Buffer.byteLength(text) <= 4096, `${prompt}: ${Buffer.byteLength(text)} B`);
  }
});

test('a moved route carries no leftover procedure: no theme question, no engine, no body paths', () => {
  for (const [id] of MOVED) {
    const text = activation({ route: id }, 'conv-1');
    for (const leftover of ['Theme first', 'ask_question', '-runtime.mjs', 'motion.mjs', 'references/', 'scripts/', 'Python']) {
      assert.ok(!text.includes(leftover), `${id}: ${leftover}`);
    }
  }
});

test('the motion done gate left with the engine: a film turn ends without a render', () => {
  assert.equal(existsSync(join(PLUGIN, 'hooks', 'lib', 'motion.mjs')), false);
  for (const hook of ['pre-invocation', 'post-tool-use', 'stop']) {
    assert.doesNotMatch(readFileSync(join(PLUGIN, 'hooks', `${hook}.mjs`), 'utf8'), /motion/i, hook);
  }
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit motion a title film for the launch', 0);
  const r = runHook('stop', basePayload(ws, { executionNum: 1, terminationReason: 'NO_TOOL_CALL', fullyIdle: true }), env);
  assert.notEqual(r.json?.decision, 'continue', 'the stub reply ends the turn');
  const state = join(env.XDG_STATE_HOME, 'litgravity', 'sessions');
  const files = existsSync(state) ? readdirSync(state, { recursive: true }).map(String) : [];
  assert.deepEqual(files.filter((f) => f.endsWith('.motion.json')), [], 'no motion record is written');
});

test('the engines, the runtime command and the python pick left with the bodies', () => {
  for (const f of ['lib/runtime.mjs', 'plugin/lib/python-pick.mjs', 'scripts/qa-cover-recipes.mjs']) assert.equal(existsSync(join(ROOT, f)), false, f);
  const engines = walk(PLUGIN).filter((f) => f.endsWith('-runtime.mjs'));
  assert.deepEqual(engines, []);
  const help = spawnSync(process.execPath, [join(ROOT, 'bin', 'litgravity.mjs'), '--help'], { encoding: 'utf8' });
  assert.doesNotMatch(help.stdout, /runtime/);
  const run = spawnSync(process.execPath, [join(ROOT, 'bin', 'litgravity.mjs'), 'runtime', 'status'], { encoding: 'utf8', env: sandbox().env });
  assert.notEqual(run.status, 0, 'runtime is no longer a command');
  assert.deepEqual(readLock().policy.runtimes, []);
});

test('autoconference draws its figures without the moved plotting engine', () => {
  const dir = join(PLUGIN, 'skills', 'autoconference');
  for (const f of walk(dir).filter((p) => /\.(md|py)$/.test(p))) {
    assert.doesNotMatch(readFileSync(join(dir, f), 'utf8'), /sciviz|lit-scientific-visualization\/scripts/, f);
  }
  assert.match(readFileSync(join(dir, 'references', 'visualization-guide.md'), 'utf8'), /style_presets\.py/);
});

test('autoresearch draws its convergence figure through the installed copy, a local matplotlib or BLOCKED', () => {
  const dir = join(PLUGIN, 'skills', 'autoresearch');
  for (const f of walk(dir).filter((p) => /\.(md|py|sh)$/.test(p))) {
    const text = readFileSync(join(dir, f), 'utf8');
    assert.doesNotMatch(text, /\.\.\/lit-scientific-visualization|litgravity\/runtime/, f);
  }
  const guide = readFileSync(join(dir, 'references', 'visualization-guide.md'), 'utf8');
  assert.ok(guide.includes('~/.gemini/config/skills/lit-scientific-visualization/SKILL.md'), 'user-scope copy');
  assert.ok(guide.includes('.agents/skills/lit-scientific-visualization/SKILL.md'), 'workspace-scope copy');
  for (const line of extensionLines('lit-scientific-visualization')) assert.ok(guide.includes(line), `the stub install line: ${line}`);
  assert.match(guide, /BLOCKED/);
  assert.match(guide, /style_presets\.py/);
});

test('no core skill points at a removed engine or the old LitGravity runtime cache', () => {
  const moved = new Set(Object.keys(MOVED_SKILLS));
  const core = readdirSync(join(PLUGIN, 'skills')).filter((id) => !moved.has(id));
  const gone = new RegExp(`sciviz|litgravity/runtime|litgravity runtime|\\.\\./(${[...moved].join('|')})/(scripts|engine|references|assets)/`);
  for (const id of core) {
    const dir = join(PLUGIN, 'skills', id);
    for (const f of walk(dir).filter((p) => /\.(md|py|sh|mjs|json)$/.test(p))) {
      assert.doesNotMatch(readFileSync(join(dir, f), 'utf8'), gone, `${id}/${f}`);
    }
  }
});

test('list shows each moved skill with its new home, and no engines', () => {
  const out = collect();
  assert.equal(list({ flags: {}, print: out.print }), 0);
  for (const [id, family] of MOVED) assert.match(out.text(), new RegExp(`^${id} \\[moved: wjgoarxiv-skills ${family}\\]$`, 'm'), id);
  assert.doesNotMatch(out.text(), /\[engine:/);
  for (const r of routeRows()) assert.equal(r.moved ?? null, MOVED_SKILLS[r.id] ?? null, r.id);
});

test('doctor names the moved skills and checks no engine, design corpus or motion readiness', async () => {
  const { env } = sandbox();
  const cwd = workspace().dir;
  assert.equal(await install({ env, flags: { yes: true, scope: 'project' }, cwd, print: collect().print }), 0);
  const rep = collect();
  await doctor({ env: { ...env, LITGRAVITY_SKIP_HOST_TOOLS: '' }, flags: { json: true, offline: true }, cwd, print: rep.print });
  const doc = JSON.parse(rep.text());
  const names = doc.checks.map((c) => c.name);
  for (const gone of ['frontend corpus', 'design dataset', 'Chrome driver', 'motion readiness', 'python for engines', 'ffmpeg', 'pandoc', 'LibreOffice (soffice)']) {
    assert.ok(!names.includes(gone), gone);
  }
  assert.ok(!names.some((n) => n.startsWith('engine ')), 'no engine rows');
  const moved = doc.checks.find((c) => c.name === 'moved skills');
  assert.equal(moved?.status, 'INFO');
  for (const [id] of MOVED) assert.ok(moved.detail.includes(id), id);
  assert.ok(moved.fix.startsWith('npx @litfamily/litgravity extensions install <id>'), 'the command comes first');
  assert.ok(moved.fix.endsWith(extensionLines('<id>').join('\n')), 'then the four lines by hand');
});

test('the lock holds stub-sized budgets for the moved ids and exempts only them from the family floor', () => {
  const lock = readLock();
  assert.deepEqual(Object.keys(lock.policy.movedStubs).sort(), MOVED.map(([id]) => id).sort());
  for (const [id, family] of MOVED) {
    assert.equal(lock.policy.movedStubs[id], family, id);
    const b = lock.budgets[id];
    assert.equal(b.minFiles, 1, id);
    assert.equal(b.maxFiles, 1, id);
    assert.ok(b.maxTotalBytes <= 9000, `${id}: ${b.maxTotalBytes}`);
    assert.ok(b.minSkillBytes >= 2000, `${id}: a floor still guards the stub`);
  }
});
