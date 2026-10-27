import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PLUGIN, sandbox, workspace, turn, injected, runHook, basePayload } from './helpers.mjs';
import { sessionPath } from '../plugin/hooks/lib/common.mjs';

const HOOKS = JSON.parse(readFileSync(join(PLUGIN, 'hooks.json'), 'utf8'));
const FLAT = ['SessionStart', 'PreInvocation', 'PostInvocation', 'Stop'];
const GROUPED = ['PreToolUse', 'PostToolUse'];

// Proven on agy 1.4.3 (task 2): a nested {matcher, hooks} group under a flat event makes the loader skip the whole file
// while /hooks still lists it, so the shape is asserted here and again by `agy plugin validate`.
test('hooks.json is at the plugin root in the strict shape: { name: { Event: [...] } }', () => {
  assert.ok(!existsSync(join(PLUGIN, 'hooks', 'hooks.json')), 'hooks/hooks.json is never read by agy');
  assert.equal(typeof HOOKS, 'object');
  assert.ok(!('hooks' in HOOKS), 'no top-level "hooks" key: agy reads the plugin name first');
  for (const [name, spec] of Object.entries(HOOKS)) {
    assert.match(name, /^[a-z][a-z0-9-]*$/);
    for (const [event, list] of Object.entries(spec)) {
      if (event === 'enabled') continue;
      assert.ok([...FLAT, ...GROUPED].includes(event), `${name}: unknown event ${event} (UserPromptSubmit does not exist on agy)`);
      assert.ok(Array.isArray(list) && list.length > 0, `${name}.${event}`);
      for (const item of list) {
        if (FLAT.includes(event)) {
          assert.ok(!('hooks' in item) && !('matcher' in item), `${name}.${event}: flat events take handlers directly`);
          assertHandler(item, `${name}.${event}`);
        } else {
          assert.equal(typeof item.matcher, 'string', `${name}.${event}: grouped events need a matcher`);
          assert.ok(Array.isArray(item.hooks) && item.hooks.length > 0, `${name}.${event}: grouped events need hooks[]`);
          item.hooks.forEach((h) => assertHandler(h, `${name}.${event}`));
        }
      }
    }
  }
});

function assertHandler(h, where) {
  assert.equal(h.type, 'command', where);
  assert.match(h.command, /^node \.\/hooks\/[a-z-]+\.mjs$/, `${where}: runs from the plugin root, where agy sets the cwd`);
  assert.ok(existsSync(join(PLUGIN, h.command.replace(/^node \.\//, ''))), `${where}: script exists`);
  assert.ok(Number.isInteger(h.timeout) && h.timeout > 0 && h.timeout <= 30, `${where}: timeout`);
}

test('every LitGravity hook event the router depends on is wired', () => {
  const events = Object.keys(HOOKS.litgravity);
  for (const e of ['SessionStart', 'PreInvocation', 'PostInvocation', 'Stop', 'PreToolUse', 'PostToolUse']) assert.ok(events.includes(e), e);
});

// agy treats an empty PreToolUse answer as a denial and offers no way to abstain, so a global PreToolUse hook has to
// approve everything it matches. The matcher stays on tools that never ask the user (child agents); file writes and
// commands are checked after the fact by PostInvocation and Stop. Widening the matcher to `.*` turns on the full
// pre-tool policy in hooks/pre-tool-use.mjs, but only after someone has shown that `allow` leaves the user's own
// approval prompts in place (see AGENTS.md).
test('PreToolUse is matcher-limited to tools that never prompt the user', () => {
  const group = HOOKS.litgravity.PreToolUse[0];
  assert.equal(group.matcher, 'invoke_subagent|define_subagent');
  for (const risky of ['run_command', 'write_file', 'write_to_file', 'replace_file_content', 'read_file']) {
    assert.ok(!new RegExp(`^(?:${group.matcher})$`).test(risky), `${risky} must not reach a hook that can only approve`);
  }
});

// A linked git worktree nested inside its parent checkout is a workspace of its own: route state is keyed by the
// worktree's real path and the ledger lands in its own .litgravity, so the parent's active route and started plan
// never leak into it, even under the same conversation id.
test('a linked worktree workspace reads only its own state, never the parent checkout it sits in', () => {
  const { env } = sandbox();
  const parent = workspace();
  mkdirSync(join(parent.dir, 'plans'));
  writeFileSync(join(parent.dir, 'plans', 'todo.md'), '- [x] 1. scaffold\n- [ ] 2. add tags\n');
  assert.match(injected(turn(parent, env, 'lit start plans/todo.md', 0)), /`start-work` route/);
  assert.match(injected(turn(parent, env, 'lit', 10)), /LIT CONTINUES · start-work/);

  const ledger = join(parent.dir, '.litgravity', 'ledger', 'conv-test-0001.jsonl');
  const snapshot = () => (existsSync(ledger) ? readFileSync(ledger, 'utf8') : '');
  const before = snapshot();

  const dir = join(parent.dir, '.worktrees', 'feature');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.git'), `gitdir: ${join(parent.dir, '.git', 'worktrees', 'feature')}\n`);
  const child = { dir, transcript: join(dir, 'transcript_full.jsonl') };
  const text = injected(turn(child, env, 'lit', 0));
  assert.doesNotMatch(text, /LIT CONTINUES/);
  assert.doesNotMatch(text, /resuming `start-work`/);
  assert.match(text, /ask the user in one line what to run/);

  assert.notEqual(sessionPath(child.dir, 'conv-test-0001', env), sessionPath(parent.dir, 'conv-test-0001', env));
  const parentState = JSON.parse(readFileSync(sessionPath(parent.dir, 'conv-test-0001', env), 'utf8'));
  assert.equal(parentState.route, 'start-work', 'the child turn left the parent state alone');
  runHook('post-tool-use', basePayload(child, { toolCall: { name: 'read_file', args: { Path: 'x' } } }), env);
  assert.equal(snapshot(), before, 'the child turn wrote nothing into the parent ledger');
});

const agy = spawnSync('agy', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const hasAgy = agy.status === 0 && !process.env.LITGRAVITY_AGY_BIN;

test('agy plugin validate --json --strict: zero errors and zero warnings, hooks listed',
  { skip: hasAgy ? false : 'agy is not on PATH (or LITGRAVITY_AGY_BIN is set): install the Antigravity CLI to run the host validator' },
  () => {
    const r = spawnSync('agy', ['plugin', 'validate', PLUGIN, '--json', '--strict'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const report = JSON.parse(r.stdout);
    assert.deepEqual(report.findings, []);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(report.name, 'litgravity');
    assert.ok(report.components.hooks >= 1, 'hooks loaded');
    assert.ok(report.components.rules >= 1, 'rules loaded');
  });
