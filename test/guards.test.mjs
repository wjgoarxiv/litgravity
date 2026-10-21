import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, workspace, runHook, basePayload, turn, PLUGIN } from './helpers.mjs';
import { shellReadOnly } from '../plugin/hooks/lib/policy.mjs';
import { addedNegationCluster, addedHedgeCluster } from '../plugin/hooks/lib/prose.mjs';
import { redact } from '../plugin/hooks/lib/redact.mjs';

function planning() {
  const { env } = sandbox();
  const ws = workspace();
  turn(ws, env, 'lit plan a tiny todo app', 0);
  return { env, ws };
}

const pre = (ws, env, name, args) => runHook('pre-tool-use', basePayload(ws, { toolCall: { name, args }, stepIdx: 4 }), env);
const denied = (r) => r.json?.decision === 'deny';
const PASS = { decision: 'allow' };

test('PreToolUse never answers with an empty object (agy reads that as a denial); with no route it passes the call through explicitly', () => {
  const { env } = sandbox();
  const ws = workspace();
  const r = pre(ws, env, 'run_command', { CommandLine: 'rm -rf build' });
  assert.deepEqual(r.json, PASS);
});

test('lit-plan: writes inside plans/ and .litgravity/ pass; everything else is denied with a reason', () => {
  const { env, ws } = planning();
  for (const tool of ['write_to_file', 'replace_file_content', 'multi_replace_file_content']) {
    assert.deepEqual(pre(ws, env, tool, { TargetFile: join(ws.dir, 'plans', 'todo.md'), CodeContent: 'x' }).json, PASS, tool);
    assert.deepEqual(pre(ws, env, tool, { TargetFile: join(ws.dir, '.litgravity', 'notes.md') }).json, PASS, tool);
    const out = pre(ws, env, tool, { TargetFile: join(ws.dir, 'src', 'app.js') });
    assert.ok(denied(out), tool);
    assert.match(out.json.reason, /planning turn/);
  }
  assert.ok(denied(pre(ws, env, 'write_to_file', { TargetFile: join(ws.dir, 'plans', '..', 'src', 'x.js') })), 'dot-dot escape');
  assert.ok(denied(pre(ws, env, 'write_to_file', {})), 'unknown target is held');
});

test('lit-plan: a symlink inside plans/ cannot carry a write out of the workspace', () => {
  const { env, ws } = planning();
  mkdirSync(join(ws.dir, 'plans'));
  mkdirSync(join(ws.dir, 'outside'));
  symlinkSync(join(ws.dir, 'outside'), join(ws.dir, 'plans', 'link'));
  assert.ok(denied(pre(ws, env, 'write_to_file', { TargetFile: join(ws.dir, 'plans', 'link', 'x.md') })));
});

test('lit-plan: shell is limited to plain read-only commands', () => {
  const { env, ws } = planning();
  for (const c of ['ls -la', 'git status --short', 'rg -n todo src', 'cat plans/todo.md', 'head -n 5 README.md']) {
    assert.deepEqual(pre(ws, env, 'run_command', { CommandLine: c }).json, PASS, c);
  }
  for (const c of ['rm -rf x', 'ls; rm x', 'cat a > b', 'git commit -m x', 'git push', 'echo $(id)', 'sed -i s/a/b/ f', 'curl http://x', 'npm test', 'ls | sh']) {
    assert.ok(denied(pre(ws, env, 'run_command', { CommandLine: c })), c);
  }
  assert.ok(denied(pre(ws, env, 'send_command_input', { Input: 'rm x\n' })));
});

test('lit-plan: lit-plan\'s own structural checker may run, any other node script may not', () => {
  const { env, ws } = planning();
  const checker = join(PLUGIN, 'skills', 'lit-plan', 'scripts', 'check-plan.mjs');
  assert.deepEqual(pre(ws, env, 'run_command', { CommandLine: `node "${checker}" --check plans/todo.md` }).json, PASS);
  assert.deepEqual(pre(ws, env, 'run_command', { CommandLine: `node ${checker} --complete plans/todo.md` }).json, PASS);
  assert.deepEqual(pre(ws, env, 'run_command', { CommandLine: `node "${checker}" --skeleton todo` }).json, PASS);
  for (const c of [`node "${checker}" --write plans/todo.md`, `node "${checker}" --check plans/a.md plans/b.md`, `node "${checker}"`, 'node scripts/other.mjs --check x', `node "${join(ws.dir, 'check-plan.mjs')}" --check x`, `node "${checker}" --check plans/a.md; rm x`]) {
    assert.ok(denied(pre(ws, env, 'run_command', { CommandLine: c })), c);
  }
});

test('lit-plan: only read-only LitGravity agents may be started; side-effect tools wait', () => {
  const { env, ws } = planning();
  assert.deepEqual(pre(ws, env, 'invoke_subagent', { TypeName: 'lit-planner', Prompt: 'x', Role: 'r' }).json, PASS);
  assert.deepEqual(pre(ws, env, 'invoke_subagent', { TypeName: 'litgravity:librarian-researcher', Prompt: 'x', Role: 'r' }).json, PASS);
  assert.ok(denied(pre(ws, env, 'invoke_subagent', { TypeName: 'lit-executor', Prompt: 'x', Role: 'r' })));
  assert.ok(denied(pre(ws, env, 'invoke_subagent', { Prompt: 'x', Role: 'r' })), 'untyped child is general-purpose');
  assert.ok(denied(pre(ws, env, 'invoke_subagent', { Subagents: [{ TypeName: 'lit-planner' }, { TypeName: 'lit-executor' }] })));
  for (const tool of ['define_subagent', 'browser_subagent', 'generate_image', 'schedule']) assert.ok(denied(pre(ws, env, tool, {})), tool);
  for (const tool of ['view_file', 'list_dir', 'grep_search', 'find_by_name', 'ask_question', 'notify_user']) assert.deepEqual(pre(ws, env, tool, { AbsolutePath: join(ws.dir, 'a') }).json, PASS, tool);
});

test('route state under the state home is never a write target, even with no route active', () => {
  const { env } = sandbox();
  const ws = workspace();
  const target = join(env.XDG_STATE_HOME, 'litgravity', 'sessions', 'abc', 'conv.json');
  const out = pre(ws, env, 'write_to_file', { TargetFile: target, CodeContent: '{}' });
  assert.ok(denied(out));
  assert.match(out.json.reason, /route state/);
});

test('write guard: a Markdown write that adds stacked negations is denied, an unchanged paragraph is not', () => {
  const { env, ws } = planning();
  turn(ws, env, 'thanks', 10);
  turn(ws, env, 'lit fix the docs', 20);
  const stacked = 'We never log tokens. We do not store passwords. We cannot read your files. It will not phone home.';
  const out = pre(ws, env, 'write_to_file', { TargetFile: join(ws.dir, 'docs', 'privacy.md'), CodeContent: stacked });
  assert.ok(denied(out));
  assert.match(out.json.reason, /stacked negations/);
  assert.match(out.json.reason, /lit-humanizer/);
  assert.deepEqual(pre(ws, env, 'write_to_file', { TargetFile: join(ws.dir, 'docs', 'privacy.md'), CodeContent: 'The tool logs nothing sensitive.' }).json, PASS);
  assert.deepEqual(pre(ws, env, 'write_to_file', { TargetFile: join(ws.dir, 'src', 'a.js'), CodeContent: stacked }).json, PASS, 'code is not prose');

  const replace = pre(ws, env, 'replace_file_content', { TargetFile: join(ws.dir, 'README.md'), TargetContent: 'We never log tokens. We do not store passwords.', ReplacementContent: 'We never log tokens. We do not store passwords. We cannot read your files.' });
  assert.deepEqual(replace.json, PASS, 'sentences already in the file are the writer\'s');
  const multi = pre(ws, env, 'multi_replace_file_content', { TargetFile: join(ws.dir, 'README.md'), ReplacementChunks: [{ TargetContent: 'a', ReplacementContent: stacked }] });
  assert.ok(denied(multi));
});

test('write detection is name-agnostic: write_file with Path and Content is a write, read_file is not', () => {
  const { env, ws } = planning();
  const bad = pre(ws, env, 'write_file', { Path: join(ws.dir, 'src', 'x.js'), Content: 'x', Overwrite: true });
  assert.ok(denied(bad));
  assert.deepEqual(pre(ws, env, 'write_file', { Path: join(ws.dir, 'plans', 'x.md'), Content: 'x', Overwrite: true }).json, PASS);
  assert.deepEqual(pre(ws, env, 'read_file', { Path: join(ws.dir, 'src', 'x.js') }).json, PASS);
  assert.ok(denied(pre(ws, env, 'some_future_tool', { TargetFile: join(ws.dir, 'src', 'x.js'), ReplacementContent: 'y' })), 'unknown tool name, but path plus content');
});

test('write guard: stacked hedges in a deliverable are denied; plans are exempt; the humanizer route is exempt', () => {
  const { env, ws } = planning();
  turn(ws, env, 'lit fix the docs', 10);
  const hedged = 'This could possibly help. It might perhaps work, and it likely helps somewhat in some cases.';
  assert.ok(denied(pre(ws, env, 'write_to_file', { TargetFile: join(ws.dir, 'docs', 'a.md'), CodeContent: hedged })));
  assert.deepEqual(pre(ws, env, 'write_to_file', { TargetFile: join(ws.dir, 'plans', 'a.md'), CodeContent: hedged }).json, PASS);
  turn(ws, env, 'lit humanize this paragraph', 20);
  assert.deepEqual(pre(ws, env, 'write_to_file', { TargetFile: join(ws.dir, 'docs', 'a.md'), CodeContent: hedged }).json, PASS);
});

test('prose helpers count what a write adds, not what the file already said', () => {
  assert.equal(addedNegationCluster('We never a. We do not b. We cannot c.', 'We never a. We do not b. We cannot c.'), null);
  assert.ok(addedNegationCluster('우리는 저장하지 않습니다. 우리는 읽지 않습니다.'));
  assert.equal(addedHedgeCluster('The build is green.'), null);
});

test('shellReadOnly refuses compound, redirected and unknown commands', () => {
  assert.equal(shellReadOnly('ls'), true);
  assert.equal(shellReadOnly('git log --oneline -n 5'), true);
  assert.equal(shellReadOnly('git log --output=x'), false);
  assert.equal(shellReadOnly('rg -n a b && rm c'), false);
  assert.equal(shellReadOnly(''), false);
  assert.equal(shellReadOnly(undefined), false);
});

test('PostToolUse writes one ledger line per call while a route is active and none otherwise', () => {
  const { env, ws } = planning();
  const post = (name, args, extra = {}) => runHook('post-tool-use', basePayload(ws, { toolCall: { name, args }, stepIdx: 5, ...extra }), env);
  assert.deepEqual(post('write_to_file', { TargetFile: join(ws.dir, 'plans', 'todo.md') }).json, {});
  post('run_command', { CommandLine: 'ls -la OPENAI_API_KEY=sk-abcdefghijklmnop1234' }, { error: 'exit status 1' });
  const ledger = join(ws.dir, '.litgravity', 'ledger', 'conv-test-0001.jsonl');
  const lines = readFileSync(ledger, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const tools = lines.filter((l) => l.kind === 'tool');
  assert.equal(tools.length, 2);
  assert.match(tools[0].path, /plans\/todo\.md$/);
  assert.equal(tools[1].error, 'exit status 1');
  assert.doesNotMatch(readFileSync(ledger, 'utf8'), /sk-abcdefghijklmnop1234/);
  assert.ok(lines.some((l) => l.kind === 'route' && l.route === 'lit-plan' && l.how === 'ignite'));

  const quiet = sandbox();
  const ws2 = workspace();
  runHook('post-tool-use', basePayload(ws2, { toolCall: { name: 'view_file', args: {} } }), quiet.env);
  assert.ok(!existsSync(join(ws2.dir, '.litgravity')));
});

test('redact strips key shapes', () => {
  assert.equal(redact('token ghp_abcdefghijklmnopqrstuvwxyz0123 end'), 'token [redacted] end');
  assert.equal(redact('NPM_TOKEN=abc123'), '[redacted]');
});

test('a .litgravity directory that is a symlink gets no ledger writes', () => {
  const { env } = sandbox();
  const ws = workspace();
  const target = join(ws.dir, 'elsewhere');
  mkdirSync(target);
  symlinkSync(target, join(ws.dir, '.litgravity'));
  turn(ws, env, 'lit plan x', 0);
  runHook('post-tool-use', basePayload(ws, { toolCall: { name: 'view_file', args: {} } }), env);
  assert.ok(!existsSync(join(target, 'ledger')));
});

test('lit-plan: a writer child agent with a very long prompt is still refused', () => {
  const { env, ws } = planning();
  assert.ok(denied(pre(ws, env, 'invoke_subagent', { TypeName: 'lit-executor', Prompt: 'x'.repeat(600 * 1024), Role: 'r' })));
});
