import { realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { run, activeRoute, appendLedger, readSession, writeSession, toolName, toolArgs, workspaceOf, PLUGIN_ROOT } from './lib/common.mjs';
import { targetPaths } from './lib/policy.mjs';
import { clip } from './lib/redact.mjs';
import { MOTION_ROUTE, recordMotionTool } from './lib/motion.mjs';
import { recordLane } from './lib/lanes.mjs';
import { markLive } from './lib/liveness.mjs';
import { READ_ONLY_DISCIPLINES, applyStackEvent, readStack, writeStack } from './lib/workflow-stack.mjs';
import { ROUTE_LOOKS } from '../hud/looks.mjs';

const GOAL_FILE = /\.litgravity\/goals\/([A-Za-z0-9._-]+\.json)/;

// The model can load a skill that has a status-line look on its own, without a route word: it reads this plugin's
// SKILL.md of that skill, or runs the lit-adhd collector. That starts the route as its route word would, so the line
// takes the same look whichever way the skill was entered. Only this installed copy counts (a repo checkout of a skill
// is source code), and a work route already running keeps its route.
const ROOTS = [...new Set([PLUGIN_ROOT, (() => { try { return realpathSync(PLUGIN_ROOT); } catch { return PLUGIN_ROOT; } })()])];
const LOOK_SKILLS = new Map(Object.keys(ROUTE_LOOKS).flatMap((id) => ROOTS.map((r) => [join(r, 'skills', id, 'SKILL.md'), id])));
const ADHD_COLLECTOR = ROOTS.map((r) => join(r, 'skills', 'lit-adhd', 'scripts', 'rewind.mjs'));

function loadedSkill(payload, args) {
  const workspace = workspaceOf(payload) ?? process.cwd();
  const hit = targetPaths(args).map((p) => LOOK_SKILLS.get(resolve(workspace, p))).find(Boolean);
  if (hit) return hit;
  return typeof args.CommandLine === 'string' && ADHD_COLLECTOR.some((c) => args.CommandLine.includes(c)) ? 'lit-adhd' : null;
}

function startLoadedSkill(payload, args) {
  const state = readSession(payload);
  if (state?.corrupt || (state?.route && !READ_ONLY_DISCIPLINES.includes(state.route))) return;
  const route = loadedSkill(payload, args);
  if (!route || state?.route === route) return;
  writeSession(payload, { ...(state ?? {}), route, activatedAt: Date.now(), stopHeldFor: null, lastKind: 'ignite' });
  const workspace = workspaceOf(payload);
  const { stack } = applyStackEvent(readStack(workspace, payload.conversationId), { type: 'start', skill: route });
  writeStack(workspace, payload.conversationId, stack);
  appendLedger(payload, { kind: 'route', route, how: 'skill-load' });
}

// While a route is active every tool call leaves one ledger line, and a call that touches a goal record binds that
// record to this conversation, which is what lets the Stop hook hold the turn on its open criteria.
run((payload) => {
  try { markLive(workspaceOf(payload), payload.conversationId, 'alive'); } catch { /* liveness never blocks */ }
  if (toolName(payload)) startLoadedSkill(payload, toolArgs(payload));
  const state = activeRoute(payload);
  if (!state || state.corrupt) return {};
  const tool = toolName(payload);
  if (!tool) return {};
  const args = toolArgs(payload);
  const paths = targetPaths(args);
  const entry = { kind: 'tool', tool };
  if (paths.length) entry.path = paths[0];
  if (typeof args.CommandLine === 'string') entry.command = clip(args.CommandLine);
  if (payload.error) entry.error = clip(payload.error, 160);
  appendLedger(payload, entry);

  const goal = paths.map((p) => GOAL_FILE.exec(p)).find(Boolean);
  if (goal) {
    const goalPath = `.litgravity/goals/${goal[1]}`;
    if (state.goalPath !== goalPath) writeSession(payload, { ...state, goalPath });
  }
  if (state.route === MOTION_ROUTE) recordMotionTool(payload);
  if (/invoke_subagent|define_subagent/i.test(tool)) {
    try { recordLane(workspaceOf(payload), payload.conversationId, payload); } catch { /* lane tracking never blocks */ }
  }
  return {};
});
