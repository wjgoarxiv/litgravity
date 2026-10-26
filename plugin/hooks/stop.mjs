import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { run, holdStop, activeRoute, readSession, writeSession, workspaceOf } from './lib/common.mjs';
import { continuationHold } from './lib/continuation.mjs';
import { boundaryProblem, BOUNDARY_HOLDS } from './lib/boundary.mjs';
import { lastUserRequest } from './lib/transcript.mjs';
import { MOTION_ROUTE, evaluateMotionStop } from './lib/motion.mjs';
import { makeBudget, readTranscriptLines, waitingReason } from './lib/rewind/transcripts.mjs';

function planWrittenSince(cwd, since) {
  const dir = join(cwd, 'plans');
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.endsWith('.md') && statSync(join(dir, f)).mtimeMs >= since);
}

const WAIT_READ_BYTES = 512 * 1024;

// A turn that ends unheld records why it waits on the user (a question, a typed approval, a BLOCKED report), or that
// it does not, for the status line's YOUR TURN look. The next prompt clears it in PreInvocation.
function settle(payload, out) {
  if (out?.decision === 'continue') return out;
  const state = readSession(payload);
  if (!state || state.corrupt || !state.route) return out;
  const lines = readTranscriptLines(payload.transcriptPath, makeBudget(WAIT_READ_BYTES), { head: 0, tail: WAIT_READ_BYTES });
  const reason = waitingReason(lines);
  if (reason || state.waiting) writeSession(payload, { ...state, waiting: reason ? { reason, at: Date.now() } : null });
  return out;
}

// The Stop event offers one lever: decision "continue" re-enters the loop with a reason. It is used sparingly. The
// lit-plan gate holds a turn at most once, so a model that cannot write the plan still ends; start-work and litgoal
// holds are bounded by continuation.mjs; the motion gate holds at most twice, then asks the reply to say the render is
// not done. Only a normal end of turn is held: errors, cancellations and limits end.
run((payload) => {
  const out = decide(payload);
  return out && typeof out.then === 'function' ? out.then((r) => settle(payload, r)) : settle(payload, out);
});

function decide(payload) {
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
}
