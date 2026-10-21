import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { run, holdStop, activeRoute, writeSession, workspaceOf } from './lib/common.mjs';
import { continuationHold } from './lib/continuation.mjs';
import { boundaryProblem, BOUNDARY_HOLDS } from './lib/boundary.mjs';
import { lastUserRequest } from './lib/transcript.mjs';
import { MOTION_ROUTE, evaluateMotionStop } from './lib/motion.mjs';

function planWrittenSince(cwd, since) {
  const dir = join(cwd, 'plans');
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.endsWith('.md') && statSync(join(dir, f)).mtimeMs >= since);
}

// The Stop event offers one lever: decision "continue" re-enters the loop with a reason. It is used sparingly. The
// lit-plan gate holds a turn at most once, so a model that cannot write the plan still ends; start-work and litgoal
// holds are bounded by continuation.mjs; the motion gate holds at most twice, then asks the reply to say the render is
// not done. Only a normal end of turn is held: errors, cancellations and limits end.
run((payload) => {
  if (payload.terminationReason && payload.terminationReason !== 'NO_TOOL_CALL') return {};
  const state = activeRoute(payload);
  if (!state) return {};
  const request = lastUserRequest(payload.transcriptPath);
  const turn = request?.stepIndex ?? state.turnId ?? 'turn';
  const problem = state.corrupt ? null : boundaryProblem(payload, state.route);
  if (problem) {
    const used = state.boundaryTurn === state.turnId ? state.boundaryHolds ?? 0 : 0;
    if (used < BOUNDARY_HOLDS) {
      writeSession(payload, { ...state, boundaryTurn: state.turnId, boundaryHolds: used + 1 });
      return holdStop(problem.message);
    }
  }
  if (state.route === MOTION_ROUTE) {
    return evaluateMotionStop(payload).then((r) => (r.action === 'block' ? holdStop(r.reason) : {}));
  }
  if (state.route !== 'lit-plan') {
    const reason = continuationHold(payload, state, request?.text, turn);
    return reason ? holdStop(reason) : {};
  }
  if (state.stopHeldFor === turn) return {};
  if (planWrittenSince(workspaceOf(payload), state.activatedAt ?? 0)) return {};
  writeSession(payload, { ...state, stopHeldFor: turn });
  return holdStop('LitGravity lit-plan gate: this planning turn has no plan file yet. Write the plan to plans/<slug>.md (task rows as "- [ ] N. <title>"), then end the turn and point the user to `lit start`.');
});
