import { run, inject, activeRoute, readSession, writeSession, appendLedger } from './lib/common.mjs';
import { boundaryProblem, BOUNDARY_HOLDS } from './lib/boundary.mjs';

// Runs after the tool calls of every model invocation finish. While a lit route is active it compares the workspace with
// the snapshot taken when the turn began (see lib/boundary.mjs). A problem is reported to the model once per
// invocation, at most BOUNDARY_HOLDS times per turn, and the loop is forced to continue so the model can fix it.
run((payload) => {
  const state = activeRoute(payload);
  if (!state || state.corrupt) return {};
  const problem = boundaryProblem(payload, state.route);
  if (!problem) return {};
  const fresh = readSession(payload) ?? state;
  const used = fresh.boundaryTurn === state.turnId ? fresh.boundaryHolds ?? 0 : 0;
  if (used >= BOUNDARY_HOLDS) return {};
  writeSession(payload, { ...fresh, boundaryTurn: state.turnId, boundaryHolds: used + 1 });
  appendLedger(payload, { kind: 'note', text: `${problem.kind} reported to the model (${used + 1}/${BOUNDARY_HOLDS})` });
  return { ...inject(problem.message), terminationBehavior: 'force_continue' };
});
