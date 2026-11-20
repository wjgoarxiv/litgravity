import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { run, inject, readSession, writeSession, appendLedger, workspaceOf, safeId, stateRoot } from './lib/common.mjs';
import { detectRoute, LOOP_GOAL_ROUTES } from './lib/routes.mjs';
import { decide, resumablePlan, activation, continueNote, resumeNote } from './lib/reentry.mjs';
import { lastUserRequest } from './lib/transcript.mjs';
import { PAUSE_WORD, planRows } from './lib/continuation.mjs';
import { saveSnapshot } from './lib/boundary.mjs';
import { applyStackEvent, readStack, writeStack } from './lib/workflow-stack.mjs';
import { isGoPrompt, takeNextStep } from './lib/rewind/next-step.mjs';
import { buildSkillPlan, skillPlanContext, skillPlanIds } from './lib/skill-plan.mjs';
import { answerConsent, cancelOwnedGoal, offerLoopGoal, readGoalRecord, STATUS } from './lib/goal.mjs';

// agy has no UserPromptSubmit event. PreInvocation fires before every model call; invocationNum 0 is the first call of a
// user turn, and its transcript already holds the prompt. The router reads that prompt, applies the D1 re-entry rule
// and injects one ephemeral step, so a `lit` prompt is steered before the model has answered anything.

function textFor(decision, hit, payload, plan = null, extra = {}) {
  switch (decision.kind) {
    case 'continue': return continueNote(decision.route);
    case 'resume': return resumeNote(decision.plan);
    default: {
      const text = activation(hit, payload.conversationId, decision.kind, extra);
      return plan ? `${text}\n${skillPlanContext(plan, { workspace: workspaceOf(payload) })}` : text;
    }
  }
}

// `lit start plans/<x>.md` names its plan; the frame keeps it so a finished plan reads finished (lit-adhd).
const namedPlan = (decision, hit, workspace) => {
  if (decision.route !== 'start-work') return null;
  const plan = String(hit?.task ?? '').split(/\s+/u).find((w) => /^plans\/[^/\\]+\.md$/u.test(w));
  return plan && existsSync(join(workspace, plan)) ? plan : null;
};

// A run route's first activation asks the goal question (see lib/goal.mjs): the offer when the project has a test
// command and no goal is owned or pending, otherwise the note that points the model at goal-propose --loop. A repeated
// call for the same turn finds its own question on disk and repeats it.
function loopGoalExtra(decision, hit, workspace, turnId, repeat, payload) {
  if (!['ignite', 'switch'].includes(decision.kind) || decision.route !== hit.route || !LOOP_GOAL_ROUTES.has(hit.route)) return {};
  if (repeat) {
    const asked = readGoalRecord(workspace, 'consent');
    return { loopGoal: asked?.kind === 'loop' && asked.turnId === turnId && typeof asked.condition === 'string' ? { line: STATUS.askLoop(asked.condition) } : null };
  }
  return { loopGoal: offerLoopGoal(workspace, { route: hit.route, objective: hit.task, conversationId: safeId(payload.conversationId), turnId }) };
}

function stackEvent(decision, hit, workspace) {
  if (decision.kind === 'continue' && decision.route) return { type: 'continue' };
  if (decision.kind === 'ignite' || decision.kind === 'switch' || decision.kind === 'confirm') {
    const plan = namedPlan(decision, hit, workspace);
    return { type: 'start', skill: decision.route, restart: hit?.restart === true, ...(plan ? { ref: { plan } } : {}) };
  }
  return null;
}

function goActivation(step, conversationId) {
  switch (step.kind) {
    case 'resume-frame':
      return `LitGravity: \`go\` continues the paused ${step.target?.skill ?? 'route'} at ${step.target?.stage ?? 'its current stage'}.\nBegin your reply with \`🔥 LIT CONTINUES · ${step.target?.skill ?? 'route'}\` once. Keep the criteria, plan and ledger you hold; reload no skill and start no new run.`;
    case 'continue-work':
      return `LitGravity: \`go\` continues the active start-work run${step.target?.plan ? ` on ${step.target.plan}` : ''}.\nBegin your reply with \`🔥 LIT CONTINUES · start-work\` once. Carry on from the first unticked row.`;
    case 'start-plan': {
      const text = activation({ route: 'start-work', keyword: 'start', bare: false, resume: false, restart: false, direct: false, empty: false }, conversationId, 'ignite');
      return step.target?.plan ? `${text}\nThe user typed \`go\`: the plan to execute is ${step.target.plan}.` : text;
    }
    default:
      return null;
  }
}

// The brief may be up to 30 minutes old: `go` acts only when its step still holds for this conversation. The stack
// file is this conversation's own, so a run found there is one it owns.
function stillHolds(step, workspace, conversationId) {
  const frames = readStack(workspace, conversationId).frames;
  switch (step.kind) {
    case 'resume-frame':
      return frames.some((f) => f.role === 'spine' && f.status === 'paused' && (!step.target?.skill || f.skill === step.target.skill));
    case 'continue-work':
      return frames.some((f) => f.skill === 'start-work' && f.status === 'active' && (!step.target?.plan || f.ref?.plan === step.target.plan));
    case 'start-plan': {
      const plan = step.target?.plan;
      if (typeof plan !== 'string' || !/^plans\/[^/\\]+\.md$/u.test(plan)) return false;
      if (frames.some((f) => f.skill === 'start-work')) return false;
      try {
        return planRows(readFileSync(join(workspace, plan), 'utf8')).some((r) => !r.done);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

// The `yes` to lit-plan's approval question starts the plan here, by the same writes `go` and `lit start` make: route
// start-work, a fresh boundary snapshot, a start-work frame on this conversation's stack. A missing plan, a plan with
// no open row, or a start-work run this conversation already holds refuses the start, and then no goal is armed.
function startPlanRun(payload, workspace, turnId, plan) {
  if (typeof plan !== 'string' || !/^plans\/[^/\\]+\.md$/u.test(plan)) return { ok: false, reason: 'the plan path is not plans/<name>.md' };
  let rows;
  try { rows = planRows(readFileSync(join(workspace, plan), 'utf8')); } catch { return { ok: false, reason: `${plan} was not found` }; }
  if (!rows.some((r) => !r.done)) return { ok: false, reason: `${plan} has no open row` };
  const stack = readStack(workspace, payload.conversationId);
  if (stack.frames.some((f) => f.skill === 'start-work' && f.status === 'active')) return { ok: false, reason: 'a start-work run is already active in this conversation' };
  writeSession(payload, { route: 'start-work', turnId, activatedAt: Date.now(), stopHeldFor: null, pauseRequested: false, lastKind: 'ignite' });
  saveSnapshot(payload);
  const { stack: next } = applyStackEvent(stack, { type: 'start', skill: 'start-work', ref: { plan } });
  writeStack(workspace, payload.conversationId, next);
  appendLedger(payload, { kind: 'route', route: 'start-work', how: 'consent', plan });
  return { ok: true };
}

function staleGoText(step) {
  const what = step.kind === 'start-plan' ? `start ${step.target?.plan ?? 'the plan'}`
    : step.kind === 'continue-work' ? 'continue this conversation\'s start-work run'
      : `resume the paused ${step.target?.skill ?? 'route'}`;
  return `LitGravity: the user typed \`go\`, but the step the brief offered (${what}) no longer holds: the run finished, moved on or is not this conversation's. Start nothing. Say so in one line and suggest \`lit adhd\` for a fresh brief.`;
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
    if (step && step.kind !== 'none' && !stillHolds(step, workspace, payload.conversationId)) {
      appendLedger(payload, { kind: 'route', route: null, how: 'go-stale', step: step.kind });
      return inject(staleGoText(step));
    }
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
          const { stack: next } = applyStackEvent(stack, { type: 'start', skill: 'start-work', ...(step.target?.plan ? { ref: { plan: step.target.plan } } : {}) });
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

  // The approval question lit-plan asked: an exact `yes` to a live consent record starts the plan and arms its goal;
  // `edit` asks again; `no` does nothing. Any other prompt is not an answer and falls through.
  const answered = answerConsent(workspace, request.text, safeId(payload.conversationId), Date.now(), {
    startWork: (plan) => startPlanRun(payload, workspace, turnId, plan),
    turnId,
  });
  if (answered) {
    appendLedger(payload, { kind: 'decision', decision: 'goal', answer: request.text.trim().toLowerCase(), started: answered.start, ...(answered.loop ? { loop: true } : {}) });
    const note = `LitGravity goal: tell the user this line once, verbatim, and nothing else about the goal:\n${answered.line}`;
    // A run's goal answer starts no plan: the lit-loop work this conversation holds goes on.
    if (answered.loop) return inject(`${note}\nThen go on with the work you hold; start no start-work run and begin no new route.`);
    if (!answered.start) return inject(`${note}\nStart nothing.`);
    const start = activation({ route: 'start-work', keyword: 'start', bare: false, resume: false, restart: false, direct: false, empty: false }, payload.conversationId, 'ignite');
    return inject(`${start}\nThe user approved ${answered.start} with \`yes\`: this is the typed approval for start-work, and the plan to execute is ${answered.start}.\n${note}`);
  }
  // `lit cancel` clears a goal LitGravity owns; a goal set by hand in agy is out of reach and stays.
  if (/^lit\s+cancel\s*$/u.test(request.text.trim())) {
    const cleared = cancelOwnedGoal(workspace);
    if (cleared) {
      appendLedger(payload, { kind: 'decision', decision: 'goal-cancel' });
      return inject(`LitGravity goal: tell the user this line once, verbatim, then stop the work:\n${cleared}`);
    }
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
    const againPlan = ['ignite', 'switch', 'confirm'].includes(again.kind) && previous.route === hit.route ? buildSkillPlan(hit, { workspace }) : null;
    const againHit = { ...hit, route: previous.route };
    return inject(textFor(again, againHit, payload, againPlan, loopGoalExtra(again, againHit, workspace, turnId, true, payload)));
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
  const event = stackEvent(decision, hit, workspace);
  if (event) {
    const stack = readStack(workspace, payload.conversationId);
    const { stack: next } = applyStackEvent(stack, event);
    writeStack(workspace, payload.conversationId, next);
  }

  // The skill plan rides only on a fresh activation of the routed skill; a continue or a resume keeps its own text.
  const skillPlan = ['ignite', 'switch', 'confirm'].includes(decision.kind) && decision.route === hit.route ? buildSkillPlan(hit, { workspace }) : null;
  const goalExtra = loopGoalExtra(decision, hit, workspace, turnId, false, payload);
  appendLedger(payload, {
    kind: 'route', route: decision.route, how: decision.kind, keyword: hit.keyword ?? null,
    ...(decision.plan ? { path: decision.plan.file } : {}),
    ...(skillPlan ? { plan: skillPlanIds(skillPlan) } : {}),
    ...(goalExtra.loopGoal ? { goalAsked: goalExtra.loopGoal.condition } : {}),
  });
  return inject(textFor(decision, hit, payload, skillPlan, goalExtra));
});
