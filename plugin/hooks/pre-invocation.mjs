import { run, inject, readSession, writeSession, appendLedger, workspaceOf, safeId } from './lib/common.mjs';
import { detectRoute } from './lib/routes.mjs';
import { decide, resumablePlan, activation, continueNote, resumeNote } from './lib/reentry.mjs';
import { lastUserRequest } from './lib/transcript.mjs';
import { PAUSE_WORD } from './lib/continuation.mjs';
import { saveSnapshot } from './lib/boundary.mjs';
import { MOTION_ROUTE, armMotionTurn } from './lib/motion.mjs';

// agy has no UserPromptSubmit event. PreInvocation fires before every model call; invocationNum 0 is the first call of a
// user turn, and its transcript already holds the prompt. The router reads that prompt, applies the D1 re-entry rule
// and injects one ephemeral step, so a `lit` prompt is steered before the model has answered anything.

function textFor(decision, hit, payload) {
  switch (decision.kind) {
    case 'continue': return continueNote(decision.route);
    case 'resume': return resumeNote(decision.plan);
    default: return activation(hit, payload.conversationId, decision.kind);
  }
}

run((payload) => {
  if (payload.invocationNum !== 0 || !safeId(payload.conversationId)) return {};
  const request = lastUserRequest(payload.transcriptPath);
  if (!request) return {};
  const turnId = request.stepIndex;
  const pauseRequested = PAUSE_WORD.test(request.text);
  const hit = detectRoute(request.text);
  const previous = readSession(payload);
  const workspace = workspaceOf(payload);

  if (!hit) {
    if (previous && previous.route) {
      writeSession(payload, { ...previous, route: null, turnId, pauseRequested, lastKind: null });
      appendLedger(payload, { kind: 'route', route: null, how: 'clear' });
    }
    return {};
  }

  // A repeated call for the same user turn repeats the same answer and changes nothing.
  if (previous && turnId !== null && previous.turnId === turnId && previous.lastKind && previous.route) {
    const again = previous.lastKind === 'resume'
      ? { kind: 'resume', route: 'start-work', plan: resumablePlan(workspace) }
      : { kind: previous.lastKind, route: previous.route };
    return inject(textFor(again, { ...hit, route: previous.route }, payload));
  }

  const plan = !hit.restart && (hit.bare || hit.resume) ? resumablePlan(workspace) : null;
  const decision = decide(hit, previous, plan);
  const now = Date.now();
  if (decision.kind === 'continue') {
    writeSession(payload, { ...previous, turnId, pauseRequested, lastKind: 'continue' });
  } else {
    writeSession(payload, { route: decision.route, turnId, activatedAt: now, stopHeldFor: null, pauseRequested, lastKind: decision.kind });
  }
  saveSnapshot(payload);
  if (decision.route === MOTION_ROUTE) armMotionTurn(payload, now);
  appendLedger(payload, {
    kind: 'route', route: decision.route, how: decision.kind, keyword: hit.keyword ?? null,
    ...(decision.plan ? { path: decision.plan.file } : {}),
  });
  return inject(textFor(decision, hit, payload));
});
