// Every state the status line shows, written into a throwaway workspace the way the hooks and a lit route write it.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { sessionPath } from '../plugin/hooks/lib/common.mjs';
import { writeLanes } from '../plugin/hooks/lib/lanes.mjs';
import { applyStackEvent, emptyStack, writeStack } from '../plugin/hooks/lib/workflow-stack.mjs';
import { renderStatus } from '../plugin/hud/render.mjs';

const ID = 'conv-states';
// Host strings a terminal and a width table disagree on, and ones that try to steer the line.
export const HOSTILE = '\u001b[2J\r\n한글제목 👩‍👩‍👧‍👦 🇰🇷 ❤️ 👍🏽 ﷽ é́ ‮abc\u0007 ｆｕｌｌ ① ︎  x';

export const STATES = {
  ready: () => {},
  idle: (s) => { s.payload.agent_state = 'idle'; s.payload.conversation_title = s.text('greet CLI polish'); },
  signin: (s) => { s.payload = { cwd: s.ws, conversation_id: ID, agent_state: 'authenticating', model: null, context_window: { used_percentage: 0 } }; },
  ignited: (s) => s.loop(20_000),
  working: (s) => s.loop(),
  lanes: (s) => { s.loop(); s.lanes('lit-executor', 'qa-runner', 'lit-verifier'); },
  turn: (s) => { s.loop(); s.route('lit-loop', 125_000, { goalPath: '.litgravity/goals/g1.json', waiting: { reason: s.text('question') } }); },
  done: (s) => { s.loop(); s.goal('done'); },
  plan: (s) => { s.route('start-work', 725_000); s.file('plans/p.md', `# Plan\nStatus: approved\n\n- [x] 1. one\n- [ ] 2. ${s.text('Add the shout flag')}\n- [ ] 3. three\n`); s.tool('start-work', 'write_file'); },
  side: (s) => { s.loop(); s.stack('lit-loop', 'lit-brainstorm'); s.route('lit-brainstorm', 30_000); },
  review: (s) => { s.route('review-work', 61_000); const d = '.litgravity/evidence/shout/review'; s.file(`${d}/files.txt`, 'x'); s.file(`${d}/lane-1-goal.md`, 'verdict: PASS\n'); s.file(`${d}/lane-4-security.md`, 'verdict: FAIL\n'); },
  team: (s) => { s.route('lit-team', 61_000); s.file('.litgravity/team/t/team.json', JSON.stringify({ status: 'active', members: [{ id: s.text('A'), status: 'reported' }, { id: 'B', status: 'active' }, { id: 'C', status: 'pending' }, { id: 'D', status: 'blocked' }] })); },
  rewind: (s) => s.route('lit-adhd', 61_000),
  warning: (s) => { s.loop(); s.payload.context_window.used_percentage = 93; s.payload.quota[0].remaining_fraction = 0.22; },
  error: (s) => { s.loop(); s.payload.agent_state = 'error'; },
};

/** The state `name`, ready to draw: `draw(width, {rows, env, now})`. `hostile` puts HOSTILE into every host string. */
export function scene(name, { hostile = false, glyphs = 'round' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'litgravity-state-'));
  const ws = join(root, 'ws');
  mkdirSync(ws);
  const now = Date.now();
  const env = { HOME: root, XDG_STATE_HOME: join(root, 'state'), PATH: process.env.PATH, COLORTERM: 'truecolor', LITGRAVITY_HUD_GLYPHS: glyphs };
  const s = {
    ws, env, now,
    text: (t) => (hostile ? `${t} ${HOSTILE}` : t),
    payload: {
      cwd: ws, conversation_id: ID, agent_state: 'running', model: { display_name: 'Gemini 3.8 Flash (Medium)' }, context_window: { used_percentage: 42, context_window_size: 1048576 },
      quota: [{ model: 'Gemini 3.8 Flash', remaining_fraction: 0.72, reset_in_seconds: 7500 }], vcs: { branch: hostile ? HOSTILE : 'main', modified: 2 },
      ...(hostile ? { conversation_title: HOSTILE, cost: 1.5, task_count: 2 } : {}),
    },
    file(rel, body) { mkdirSync(dirname(join(ws, rel)), { recursive: true }); writeFileSync(join(ws, rel), body); },
    route(route, age, more = {}) { const f = sessionPath(ws, ID, env); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify({ route, activatedAt: now - age, lastKind: 'continue', ...more })); },
    goal(status = 'active') { s.file('.litgravity/goals/g1.json', JSON.stringify({ status, conversation_id: ID, criteria: [{ id: 'c1', status: 'pass' }, { id: 'c2', status: status === 'done' ? 'pass' : 'open', text: s.text('--shout prints the greeting in capitals') }] })); },
    tool(route, tool) { s.file(`.litgravity/ledger/${ID}.jsonl`, [{ ts: new Date(now - 90_000).toISOString(), kind: 'route', route, plan: [route, 'review-work'] }, { ts: new Date(now - 4000).toISOString(), kind: 'tool', tool: s.text(tool) }].map((x) => `${JSON.stringify(x)}\n`).join('')); },
    stack(...skills) { let st = emptyStack(ID); for (const skill of skills) st = applyStackEvent(st, { type: 'start', skill }, new Date(now)).stack; writeStack(ws, ID, st, env); },
    lanes(...names) { writeLanes(ws, ID, names.map((n, i) => ({ name: s.text(n), status: 'active', steps: i, at: new Date(now).toISOString() })), env); },
    loop(age = 125_000) {
      s.route('lit-loop', age, { goalPath: '.litgravity/goals/g1.json', ...(age < 90_000 ? { lastKind: 'ignite' } : {}) });
      s.goal();
      for (const n of ['before', 'c2-red']) s.file(`.litgravity/evidence/shout/${n}.log`, 'x');
      s.tool('lit-loop', 'run_command');
      s.stack('lit-loop');
    },
  };
  if (name === 'ready' || name === 'turn') delete s.payload.agent_state;
  STATES[name](s);
  return { ...s, draw: (width, { rows = 40, env: over = {}, now: at = now } = {}) => renderStatus(s.payload, { env: { ...env, ...over }, now: at, width, rows }) };
}
