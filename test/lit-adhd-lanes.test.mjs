// lit-adhd while other lanes work: no `go` while they run (sessions and herdr agents, counted once), `go` only for
// a run this conversation owns and only on a step it executes, the HANDOFF step that is still open, and a re-check
// when `go` arrives.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, existsSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { sandbox, workspace, turn, injected, mkdirp } from './helpers.mjs';
import { writeNextStep } from '../plugin/hooks/lib/rewind/next-step.mjs';
import { collectRewind } from '../plugin/hooks/lib/rewind/collect.mjs';
import { renderBrief } from '../plugin/hooks/lib/rewind/brief.mjs';
import { sessionPath } from '../plugin/hooks/lib/common.mjs';

const noGit = () => { throw new Error('no git'); };
const SELF = 'conv-test-0001';

const openPlan = (dir) => {
  mkdirp(join(dir, 'plans'));
  writeFileSync(join(dir, 'plans', 'ship.md'), '# Ship\n\n- [x] 1. Draft\n- [ ] 2. Write the release notes\n');
};
const live = (dir, env, id, state, pane) => {
  const path = sessionPath(dir, id, env).replace(/\.json$/, '.live.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ state, at: new Date().toISOString(), ...(pane ? { pane } : {}) }));
};
const stack = (dir, env, id, frames) => {
  const path = sessionPath(dir, id, env).replace(/\.json$/, '.stack.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ sessionId: id, frames }));
};
const herdr = (agents) => (file, args) => {
  if (file === 'herdr' && args.join(' ') === 'agent list') return JSON.stringify({ result: { agents } });
  throw new Error(`unexpected ${file}`);
};

test('S1: another live conversation of this workspace holds the plan start: no go, the box waits, the line says not to type go', () => {
  const { env } = sandbox();
  const ws = workspace();
  openPlan(ws.dir);
  live(ws.dir, env, 'conv-lane-0002', 'alive');
  const data = collectRewind({ cwd: ws.dir, sessionId: SELF, env, record: true, exec: noGit });
  assert.equal(data.lanes.count, 1);
  assert.equal(data.next.kind, 'none');
  assert.equal(data.next.say, undefined);
  const text = renderBrief(data);
  assert.match(text, /│ Wait for 1 lane to finish, then start plans\/ship\.md/);
  assert.match(text, /Do not type `go` until they finish\./);
  assert.ok(!/Type \*\*`go`\*\*/.test(text) && !/type: go/.test(text), text);
  assert.match(renderBrief(data, { lang: 'ko' }), /지금은 `go`는 입력하지 마세요\./);
  const r = injected(turn(ws, env, 'go', 2));
  assert.ok(!/LIT IGNITED/.test(r), 'go starts nothing while a lane works');
});

test('S1: an idle or ended conversation is no lane, and the plan still starts on go', () => {
  const { env } = sandbox();
  const ws = workspace();
  openPlan(ws.dir);
  live(ws.dir, env, 'conv-idle-0002', 'idle');
  live(ws.dir, env, SELF, 'alive');
  const data = collectRewind({ cwd: ws.dir, sessionId: SELF, env, record: false, exec: noGit });
  assert.equal(data.lanes.count, 0, 'idle sessions and this conversation are not lanes');
  assert.equal(data.next.kind, 'start-plan');
});

test('S1: under HERDR_ENV=1 working and blocked herdr agents of this workspace are lanes, one lane seen twice counts once', () => {
  const { env } = sandbox();
  const ws = workspace();
  openPlan(ws.dir);
  live(ws.dir, env, 'conv-lane-0002', 'alive', 'w1:p5');
  const herdrEnv = { ...env, HERDR_ENV: '1', HERDR_WORKSPACE_ID: 'w1', HERDR_PANE_ID: 'w1:p1' };
  const agents = [
    { agent: 'agy', agent_status: 'working', pane_id: 'w1:p1', workspace_id: 'w1', cwd: ws.dir }, // this pane
    { agent: 'claude', agent_status: 'working', pane_id: 'w1:p2', workspace_id: 'w1', cwd: '/elsewhere' },
    { agent: 'codex', agent_status: 'blocked', pane_id: 'w9:p3', workspace_id: 'w9', cwd: '/elsewhere', foreground_cwd: join(ws.dir, 'src') },
    { agent: 'agy', agent_status: 'working', pane_id: 'w1:p5', workspace_id: 'w1', cwd: ws.dir, agent_session: { value: 'conv-lane-0002' } }, // the live session again
    { agent: 'claude', agent_status: 'idle', pane_id: 'w1:p6', workspace_id: 'w1', cwd: ws.dir },
    { agent: 'claude', agent_status: 'done', pane_id: 'w1:p7', workspace_id: 'w1', cwd: ws.dir },
    { agent: 'claude', agent_status: 'working', pane_id: 'w2:p1', workspace_id: 'w2', cwd: '/other/repo' },
  ];
  const data = collectRewind({ cwd: ws.dir, sessionId: SELF, env: herdrEnv, record: false, exec: herdr(agents) });
  assert.equal(data.sources.herdr, 'ok');
  assert.equal(data.lanes.count, 3);
  assert.equal(data.lanes.waiting, 1);
  assert.equal(data.next.kind, 'none');
  const text = renderBrief(data);
  assert.match(text, /│ Answer the lane waiting on you in pane w9:p3/);
  assert.match(text, /Do not type `go` until they finish\./);
});

test('S1: herdr is read only under HERDR_ENV=1, and a failing or garbled herdr reads unknown', () => {
  const { env } = sandbox();
  const ws = workspace();
  openPlan(ws.dir);
  const calls = [];
  const spy = (file, args, options) => { calls.push({ file, timeout: options?.timeout }); throw new Error('no'); };
  const off = collectRewind({ cwd: ws.dir, sessionId: SELF, env, record: false, exec: spy });
  assert.ok(!calls.some((c) => c.file === 'herdr'));
  assert.equal(off.sources.herdr, undefined);
  assert.equal(off.next.kind, 'start-plan');
  const failed = collectRewind({ cwd: ws.dir, sessionId: SELF, env: { ...env, HERDR_ENV: '1' }, record: false, exec: spy });
  const call = calls.find((c) => c.file === 'herdr');
  assert.ok(call && call.timeout > 0 && call.timeout <= 3000, 'bounded timeout');
  assert.equal(failed.sources.herdr, 'unknown');
  const garbled = collectRewind({ cwd: ws.dir, sessionId: SELF, env: { ...env, HERDR_ENV: '1' }, record: false, exec: (f) => (f === 'herdr' ? 'not json' : noGit()) });
  assert.equal(garbled.sources.herdr, 'unknown');
});

test('S2: another conversation\'s active start-work is never offered as go', () => {
  const { env } = sandbox();
  const ws = workspace();
  openPlan(ws.dir);
  stack(ws.dir, env, 'conv-work-0002', [{ skill: 'start-work', role: 'spine', status: 'active', at: new Date().toISOString(), ref: { plan: 'plans/ship.md' } }]);
  const data = collectRewind({ cwd: ws.dir, sessionId: SELF, env, record: false, exec: noGit });
  assert.equal(data.next.kind, 'none');
  assert.ok(!/`go`\*\* to continue/.test(renderBrief(data)));
});

test('S3: the brief says to type go only for a kind go executes, and go executes each kind it offers', () => {
  const none = renderBrief({ generatedAt: new Date().toISOString(), sessions: [], roadmap: { plans: [], litgoal: [] }, next: { kind: 'none', target: null } });
  assert.ok(!/type: go|Type \*\*`go`/.test(none));
  const { env } = sandbox();
  const ws = workspace();
  const root = join(env.XDG_STATE_HOME, 'litgravity');
  stack(ws.dir, env, SELF, [{ skill: 'start-work', role: 'spine', status: 'active', at: new Date().toISOString(), ref: { plan: 'plans/ship.md' } }]);
  writeNextStep(root, SELF, { kind: 'continue-work', target: { plan: 'plans/ship.md' } });
  assert.match(injected(turn(ws, env, 'go', 1)), /LIT CONTINUES · start-work/);
});

test('S5: go re-checks that the run it continues is still active and still this conversation\'s, else starts nothing', () => {
  const { env } = sandbox();
  const ws = workspace();
  const root = join(env.XDG_STATE_HOME, 'litgravity');
  // The run finished (or never was this conversation's) after the brief.
  writeNextStep(root, SELF, { kind: 'continue-work', target: { plan: 'plans/ship.md' } });
  let text = injected(turn(ws, env, 'go', 1));
  assert.ok(!/LIT CONTINUES/.test(text), text);
  assert.match(text, /no longer holds/);
  assert.match(text, /Start nothing/);
  // Only another conversation runs it.
  stack(ws.dir, env, 'conv-work-0002', [{ skill: 'start-work', role: 'spine', status: 'active', at: new Date().toISOString(), ref: { plan: 'plans/ship.md' } }]);
  writeNextStep(root, SELF, { kind: 'continue-work', target: { plan: 'plans/ship.md' } });
  assert.match(injected(turn(ws, env, 'go', 2)), /no longer holds/);
  // A paused frame that was resumed meanwhile.
  writeNextStep(root, SELF, { kind: 'resume-frame', target: { skill: 'lit-loop', stage: 'verify' } });
  assert.match(injected(turn(ws, env, 'go', 3)), /no longer holds/);
  // A plan finished meanwhile does not start.
  mkdirp(join(ws.dir, 'plans'));
  writeFileSync(join(ws.dir, 'plans', 'done.md'), '- [x] 1. Draft\n');
  writeNextStep(root, SELF, { kind: 'start-plan', target: { plan: 'plans/done.md' } });
  text = injected(turn(ws, env, 'go', 4));
  assert.ok(!/LIT IGNITED/.test(text), text);
  assert.match(text, /no longer holds/);
  const state = sessionPath(ws.dir, SELF, env);
  assert.ok(!existsSync(state) || JSON.parse(readFileSync(state, 'utf8')).route !== 'start-work', 'no run started');
});

test('S5: a paused frame that still waits resumes on go', () => {
  const { env } = sandbox();
  const ws = workspace();
  const root = join(env.XDG_STATE_HOME, 'litgravity');
  const at = new Date().toISOString();
  stack(ws.dir, env, SELF, [
    { skill: 'lit-loop', role: 'spine', status: 'paused', stage: 'verify', at },
    { skill: 'lit-brainstorm', role: 'side', status: 'active', at },
  ]);
  writeNextStep(root, SELF, { kind: 'resume-frame', target: { skill: 'lit-loop', stage: 'verify' } });
  assert.match(injected(turn(ws, env, 'go', 1)), /LIT CONTINUES · lit-loop/);
});

test('S4: the HANDOFF step is the first open Next item of the newest HANDOFF file', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-handoff-lanes-'));
  writeFileSync(join(cwd, 'HANDOFF.md'), '# Old\n\n## Next\n\n- Release 0.1.1\n');
  writeFileSync(join(cwd, 'HANDOFF-2026-10.md'), [
    '# Handoff', '', '## Next', '',
    '- ✅ Release 0.1.3', '- [x] 2. Tag it', '- ~~Write the post~~', '- Port the parser DONE', '- ✓ Fix CI', '- Notes SHIPPED',
    '- Review the shipped done list', '- later',
  ].join('\n'));
  const old = new Date(Date.now() - 3 * 86_400_000);
  utimesSync(join(cwd, 'HANDOFF.md'), old, old);
  const env = { HOME: tmpdir(), XDG_STATE_HOME: join(cwd, '.state') };
  const data = collectRewind({ cwd, here: true, env, exec: noGit, record: false });
  assert.equal(data.handoffs[0].file, 'HANDOFF-2026-10.md', 'newest first');
  assert.equal(data.handoffs[0].next, 'Review the shipped done list', 'done words are case-sensitive');
  assert.match(renderBrief(data), /│ From HANDOFF-2026-10\.md: Review the shipped done list/);
});

test('S4: the HANDOFF step outranks an ended conversation; a conversation waiting on the user outranks the HANDOFF step', () => {
  const ended = { id8: 'end00000', worktree: '/ws/app', status: 'ended', title: 'old goal', started: new Date(0).toISOString(), last: new Date(0).toISOString(), done: {} };
  const waiting = { ...ended, id8: 'wait0000', status: 'waiting-on-user', result: 'Shall I tag it?', last: new Date().toISOString() };
  const base = { generatedAt: new Date().toISOString(), roadmap: { plans: [], litgoal: [] }, next: { kind: 'none', target: null }, handoffs: [{ file: 'HANDOFF.md', local: true, next: 'Release 0.1.3' }] };
  assert.match(renderBrief({ ...base, sessions: [ended] }), /│ From HANDOFF\.md: Release 0\.1\.3/);
  assert.match(renderBrief({ ...base, sessions: [waiting, ended] }), /│ Answer wait0000/);
});
