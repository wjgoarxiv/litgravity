import { run, activeRoute, appendLedger, writeSession, toolName, toolArgs } from './lib/common.mjs';
import { targetPaths } from './lib/policy.mjs';
import { clip } from './lib/redact.mjs';
import { MOTION_ROUTE, recordMotionTool } from './lib/motion.mjs';

const GOAL_FILE = /\.litgravity\/goals\/([A-Za-z0-9._-]+\.json)/;

// While a route is active every tool call leaves one ledger line, and a call that touches a goal record binds that
// record to this conversation, which is what lets the Stop hook hold the turn on its open criteria.
run((payload) => {
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
  return {};
});
