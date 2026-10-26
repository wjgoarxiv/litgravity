import { run, inject, readSession, writeSession, appendLedger, workspaceOf, safeId, stateRoot } from './lib/common.mjs';
import { detectRoute } from './lib/routes.mjs';
import { decide, resumablePlan, activation, continueNote, resumeNote } from './lib/reentry.mjs';
import { lastUserRequest } from './lib/transcript.mjs';
import { PAUSE_WORD } from './lib/continuation.mjs';
import { saveSnapshot } from './lib/boundary.mjs';
import { MOTION_ROUTE, armMotionTurn } from './lib/motion.mjs';
import { applyStackEvent, readStack, writeStack } from './lib/workflow-stack.mjs';
import { isGoPrompt, takeNextStep } from './lib/rewind/next-step.mjs';

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

function stackEvent(decision, hit) {
  if (decision.kind === 'continue' && decision.route) return { type: 'continue' };
  if (decision.kind === 'ignite' || decision.kind === 'switch' || decision.kind === 'confirm') {
    return { type: 'start', skill: decision.route, restart: hit?.restart === true };
  }
  return null;
}

function goActivation(step, conversationId) {
  switch (step.kind) {
    case 'resume-frame':
      return `LitGravity: \`go\` continues the paused ${step.target?.skill ?? 'route'} at ${step.target?.stage ?? 'its current stage'}.\nBegin your reply with \`🔥 LIT CONTINUES · ${step.target?.skill ?? 'route'}\` once. Keep the criteria, plan and ledger you hold; reload no skill and start no new run.`;
    case 'continue-work':
      return `LitGravity: \`go\` continues the active start-work run${step.target?.plan ? ` on ${step.target.plan}` : ''}.\nBegin your reply with \`🔥 LIT CONTINUES · start-work\` once. Carry on from the first unticked row.`;
    case 'start-plan':
      return activation({ route: 'start-work', keyword: 'start', bare: false, resume: false, restart: false, direct: false, empty: false }, conversationId, 'ignite');
    default:
      return null;
  }
}

function approveText(word) {
  if (word === 'approve') return 'LitGravity: the user typed `lit approve`. This is the typed approval for start-work. Proceed with the work.';
  return 'LitGravity: the user typed `lit deny`. This is a denial. Stop the work and explain what was denied.';
}

run((payload) => {
  if (payload.invocationNum !== 0 || !safeId(payload.conversationId)) return {};
  const request = lastUserRequest(payload.transcriptPath);
  if (!request) return {};
  const turnId = request.stepIndex;
  const pauseRequested = PAUSE_WORD.test(request.text);
  const workspace = workspaceOf(payload);
  const root = stateRoot();

  // The user typed, so the turn no longer waits on them: the status line drops YOUR TURN.
  const waited = readSession(payload);
  if (waited?.waiting && !waited.corrupt && !waited.fromJournal) writeSession(payload, { ...waited, waiting: null });

  // `go` / `ㄱㄱ` / `진행`: consume the next-step record the collector wrote within 30 minutes.
  if (isGoPrompt(request.text)) {
    const step = takeNextStep(root, safeId(payload.conversationId));
    if (step) {
      const text = goActivation(step, payload.conversationId);
      if (text) {
        if (step.kind === 'resume-frame') {
          const stack = readStack(workspace, payload.conversationId);
          const { stack: next } = applyStackEvent(stack, { type: 'continue' });
          writeStack(workspace, payload.conversationId, next);
        }
        if (step.kind === 'start-plan') {
          writeSession(payload, { route: 'start-work', turnId, activatedAt: Date.now(), stopHeldFor: null, pauseRequested: false, lastKind: 'ignite' });
          saveSnapshot(payload);
          const stack = readStack(workspace, payload.conversationId);
          const { stack: next } = applyStackEvent(stack, { type: 'start', skill: 'start-work' });
          writeStack(workspace, payload.conversationId, next);
          appendLedger(payload, { kind: 'route', route: 'start-work', how: 'go', plan: step.target?.plan ?? null });
        } else {
          appendLedger(payload, { kind: 'route', route: step.target?.skill ?? 'go', how: 'go' });
        }
        return inject(text);
      }
    }
    return {};
  }

  const hit = detectRoute(request.text);
  const previous = readSession(payload);

  // `lit approve` / `lit deny`: record the decision and inject the note.
  if (hit?.approve) {
    appendLedger(payload, { kind: 'decision', decision: hit.approve, route: previous?.route ?? null });
    return inject(approveText(hit.approve));
  }

  // `lit continue`: when the stack has a paused spine, close the side and resume it.
  if (hit && hit.resume && hit.bare) {
    const stack = readStack(workspace, payload.conversationId);
    const spine = stack.frames.find((f) => f.role === 'spine' && f.status === 'paused');
    if (spine) {
      const { stack: next } = applyStackEvent(stack, { type: 'continue' });
      writeStack(workspace, payload.conversationId, next);
      writeSession(payload, { route: spine.skill, turnId, activatedAt: previous?.activatedAt ?? Date.now(), stopHeldFor: null, pauseRequested, lastKind: 'continue' });
      appendLedger(payload, { kind: 'route', route: spine.skill, how: 'continue' });
      return inject(continueNote(spine.skill));
    }
  }

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

  // Update the workflow stack on every route change.
  const event = stackEvent(decision, hit);
  if (event) {
    const stack = readStack(workspace, payload.conversationId);
    const { stack: next } = applyStackEvent(stack, event);
    writeStack(workspace, payload.conversationId, next);
  }

  if (decision.route === MOTION_ROUTE) armMotionTurn(payload, now);
  appendLedger(payload, {
    kind: 'route', route: decision.route, how: decision.kind, keyword: hit.keyword ?? null,
    ...(decision.plan ? { path: decision.plan.file } : {}),
  });
  return inject(textFor(decision, hit, payload));
});
