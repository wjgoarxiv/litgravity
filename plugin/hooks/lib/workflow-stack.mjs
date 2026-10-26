// The session's workflow stack, kept in the route-state folder next to the conversation state file.
// Where each running discipline stands, so asking for something in the middle of a loop or a plan
// run pauses that work instead of erasing it. The bottom frame is the spine (the main line of work);
// a discipline started on top is a side frame. `lit continue` closes the side and resumes the paused
// spine. Read-only disciplines never touch the stack.
//
// `applyStackEvent` is pure; the store writes one small file per session, whole, and the status line
// reads it back through its own guarded read. Frames keep skills, stages and counts only; never a
// prompt, a command or a path other than a project-relative plan name.

import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { sessionPath, safeId } from './common.mjs';

export const MAX_FRAMES = 3;
export const MAX_HISTORY = 20;
export const MAX_STACK_BYTES = 64 * 1024;
export const STACK_DROP_MS = 24 * 60 * 60 * 1000;
export const READ_ONLY_DISCIPLINES = Object.freeze(['lit-recap', 'lit-comprehend', 'lit-handoff', 'lit-adhd', 'lit-rewind']);

// The main-chain stage families and entry points; a newcomer of a higher rank succeeds the frame below.
const CHAIN_RANK = Object.freeze({
  'deep-interview': 0, 'lit-brainstorm': 0, 'lit-crucible': 1, 'lit-plan': 1,
  'start-work': 2, litwork: 2, litgoal: 2, autoresearch: 2, 'lit-loop': 2, 'review-work': 3,
});

const DISCIPLINE_FAMILY = {
  'deep-interview': 'main', 'lit-brainstorm': 'main', 'lit-crucible': 'main', 'lit-plan': 'main',
  'start-work': 'main', litwork: 'main', litgoal: 'main', autoresearch: 'main', 'review-work': 'main',
  litresearch: 'research', 'lit-loop': 'loop',
};

const PLAN_REF = /^plans\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.md$/u;

export const emptyStack = (sessionId) => ({
  version: 1, sessionId: typeof sessionId === 'string' && sessionId ? sessionId : null, frames: [], history: [],
});

const countOf = (v) => (Number.isInteger(v) && v >= 0 && v <= 9999 ? v : undefined);
const planRef = (ref) => (ref && typeof ref.plan === 'string' && PLAN_REF.test(ref.plan) && !ref.plan.includes('..') ? { plan: ref.plan } : undefined);
const isSuccessor = (skill, frame) => CHAIN_RANK[skill] !== undefined && CHAIN_RANK[frame.skill] !== undefined && CHAIN_RANK[skill] > CHAIN_RANK[frame.skill];
const isFinished = (frame) => frame.done === true;

const newFrame = (skill, ref, role, at) => {
  const frame = { skill, family: DISCIPLINE_FAMILY[skill] ?? null, stage: null, role, status: 'active', at };
  const plan = planRef(ref);
  if (plan) frame.ref = plan;
  return frame;
};

const counts = (frame) => ({ stage: frame.stage, n: frame.n, total: frame.total });

/**
 * Applies one event to the stack and returns the next stack with the transitions it made.
 * Events: `start {skill, ref?, restart?}`, `continue`, `move {stage, n?, total?, done?, ref?}`.
 */
export const applyStackEvent = (stack, event, now = new Date()) => {
  const at = now.toISOString();
  const transitions = [];
  const note = (type, frame) => transitions.push({ type, skill: frame.skill, ...counts(frame) });
  let frames = (Array.isArray(stack?.frames) ? stack.frames : [])
    .filter((frame) => now.getTime() - Date.parse(frame.at) <= STACK_DROP_MS)
    .map((frame) => ({ ...frame }));
  const pause = (frame) => {
    if (frame.status === 'paused') return;
    frame.status = 'paused';
    frame.pausedAt = at;
    note('paused', frame);
  };
  const activate = (frame) => {
    const wasPaused = frame.status === 'paused';
    frame.status = 'active';
    frame.at = at;
    delete frame.pausedAt;
    if (wasPaused) note('resumed', frame);
  };
  const closeAbove = (index, type) => {
    for (const frame of frames.slice(index + 1).reverse()) note(type, frame);
    frames = frames.slice(0, index + 1);
  };
  const push = (frame) => {
    frames.push(frame);
    note('started', frame);
    while (frames.length > MAX_FRAMES) {
      const side = frames.findIndex((c, i) => i < frames.length - 1 && c.role === 'side');
      const [dropped] = frames.splice(side === -1 ? 0 : side, 1);
      note('dropped', dropped);
    }
  };

  const start = (skill, ref, restart) => {
    if (READ_ONLY_DISCIPLINES.includes(skill)) return;
    const hasFamily = Boolean(DISCIPLINE_FAMILY[skill]);
    if (restart) {
      closeAbove(-1, 'finished');
      push(newFrame(skill, ref, hasFamily ? 'spine' : 'side', at));
      return;
    }
    const existing = frames.findLastIndex((f) => f.skill === skill);
    if (existing !== -1) {
      const wanted = planRef(ref);
      const kept = frames[existing].ref?.plan;
      if (!isFinished(frames[existing]) && (!wanted || !kept || wanted.plan === kept)) {
        closeAbove(existing, 'side.done');
        activate(frames[existing]);
        if (wanted) frames[existing].ref = wanted;
        return;
      }
      const role = frames[existing].role;
      closeAbove(existing - 1, 'finished');
      if (frames.length) pause(frames.at(-1));
      push(newFrame(skill, ref, role, at));
      return;
    }
    let inherited = null;
    let handed = null;
    while (frames.length && isFinished(frames.at(-1))) {
      const done = frames.pop();
      note('finished', done);
      inherited = done.role;
      handed = handed ?? done.ref;
    }
    const carried = (from) => ref ?? (CHAIN_RANK[skill] >= CHAIN_RANK['start-work'] ? from : undefined);
    const top = frames.at(-1);
    if (!top) {
      push(newFrame(skill, carried(handed), hasFamily ? inherited ?? 'spine' : 'side', at));
    } else if (!frames.some((f) => f.role === 'spine')) {
      closeAbove(-1, 'finished');
      push(newFrame(skill, ref, hasFamily ? 'spine' : 'side', at));
    } else if (hasFamily && isSuccessor(skill, top)) {
      frames.pop();
      note(top.role === 'spine' ? 'finished' : 'side.done', top);
      push(newFrame(skill, carried(top.ref ?? handed), top.role, at));
    } else {
      pause(top);
      push(newFrame(skill, ref, 'side', at));
    }
  };

  switch (event?.type) {
    case 'start':
      start(event.skill, event.ref, event.restart === true);
      break;
    case 'continue': {
      const top = frames.at(-1);
      const spine = frames.findLastIndex((f) => f.role === 'spine');
      if (top?.role === 'side' && spine !== -1) {
        closeAbove(spine, 'side.done');
        activate(frames[spine]);
      }
      break;
    }
    case 'move': {
      const target = frames.at(-1);
      if (target && target.status === 'active') {
        if (typeof event.stage === 'string') target.stage = event.stage;
        for (const key of ['n', 'total']) {
          const v = countOf(event[key]);
          if (v !== undefined) target[key] = v;
        }
        if (typeof event.done === 'boolean') target.done = event.done;
        const plan = planRef(event.ref);
        if (plan) target.ref = plan;
        target.at = at;
      }
      break;
    }
    default:
      break;
  }

  if (frames.length && frames.at(-1).status !== 'active') activate(frames.at(-1));
  const history = [...(Array.isArray(stack?.history) ? stack.history : []), ...transitions.map(({ type, skill }) => ({ event: type, skill, at }))].slice(-MAX_HISTORY);
  return { stack: { version: 1, sessionId: stack?.sessionId ?? null, frames, history }, transitions };
};

// Stack files sit beside the session state in the route-state folder.
export const stackFilePath = (cwd, conversationId, env = process.env) => {
  const base = sessionPath(cwd, conversationId, env);
  if (!base) return null;
  return base.replace(/\.json$/, '.stack.json');
};

export const readStack = (cwd, conversationId, env = process.env) => {
  const empty = emptyStack(safeId(conversationId));
  let fd;
  try {
    const path = stackFilePath(cwd, conversationId, env);
    if (!path || !lstatSync(path).isFile()) return empty;
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const { size } = fstatSync(fd);
    if (size > MAX_STACK_BYTES) return empty;
    const buffer = Buffer.alloc(size);
    readSync(fd, buffer, 0, size, 0);
    const parsed = JSON.parse(buffer.toString('utf8'));
    if (!parsed || !Array.isArray(parsed.frames) || parsed.frames.length > MAX_FRAMES) return empty;
    return { ...empty, frames: parsed.frames, history: Array.isArray(parsed.history) ? parsed.history.slice(-MAX_HISTORY) : [] };
  } catch {
    return empty;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
};

export const writeStack = (cwd, conversationId, stack, env = process.env) => {
  const path = stackFilePath(cwd, conversationId, env);
  if (!path) return stack;
  mkdirSync(dirname(path), { recursive: true });
  const staging = `${path}.${process.pid}.tmp`;
  writeFileSync(staging, `${JSON.stringify(stack)}\n`, { flag: 'w' });
  renameSync(staging, path);
  return stack;
};
