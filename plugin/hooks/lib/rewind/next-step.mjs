// The one next step a lit-adhd brief offers, chosen by fixed priority over the collected records,
// and the small record `go` later reads back within 30 minutes:
//   1. this session's paused spine frame    -> resume-frame   (`lit continue`)
//   2. this session's active start-work     -> continue-work
//   3. a single open plan with no work      -> start-plan     (`lit start plans/<plan>.md`)
//      ...unless other lanes work here      -> none, held     (no `go` until they finish)
//   4. otherwise                            -> none
// Another conversation's run is never offered. PreInvocation re-checks the recorded step when `go` arrives.
// A start-work approval is typed as `lit approve` when the run asks for it; agy keeps no record of a
// pending one for a brief to offer.

import { closeSync, constants, fstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { safeId } from '../common.mjs';

export const chooseNextStep = (data, sessionId) => {
  const ownStack = data.workflows.find((f) => f.sessionId === sessionId && f.role === 'spine' && f.status === 'paused');
  if (sessionId && ownStack) {
    return { kind: 'resume-frame', target: { skill: ownStack.skill, stage: ownStack.stage, progress: ownStack.progress.gauge ?? `${ownStack.progress.done ?? 0} done` }, say: 'lit continue' };
  }
  const own = data.startWork.find((w) => w.status === 'active' && sessionId && w.sessionId === sessionId);
  if (own) return { kind: 'continue-work', target: { plan: own.plan }, say: 'go' };
  const running = data.startWork.some((w) => ['active', 'paused'].includes(w.status));
  const open = data.roadmap.plans.filter((p) => p.local && p.progress.total !== null && p.progress.done < p.progress.total);
  if (!running && open.length === 1) {
    const lanes = data.lanes?.count ?? 0;
    if (lanes > 0) return { kind: 'none', target: null, held: { lanes, plan: open[0].plan } };
    return { kind: 'start-plan', target: { plan: open[0].plan }, say: 'go', command: `lit start ${open[0].plan}` };
  }
  return { kind: 'none', target: null };
};

export const nextStepPath = (root, conversationId) => {
  const id = safeId(conversationId);
  if (!id) return null;
  return join(root, 'adhd', `next-${id}.json`);
};

export const writeNextStep = (root, conversationId, step, now = new Date()) => {
  const path = nextStepPath(root, conversationId);
  if (!path) return null;
  mkdirSync(dirname(path), { recursive: true });
  const staging = `${path}.${process.pid}.tmp`;
  writeFileSync(staging, `${JSON.stringify({ kind: step.kind, target: step.target, at: now.toISOString() })}\n`);
  renameSync(staging, path);
  return path;
};

const GO_PROMPT = /^\s*(?:(?:lit\s+)?go|ㄱㄱ|고|진행)[\s.!?]*$/iu;
export const isGoPrompt = (prompt) => typeof prompt === 'string' && prompt.length <= 64 && GO_PROMPT.test(prompt);

export const NEXT_STEP_MAX_AGE_MS = 30 * 60_000;
const KINDS = new Set(['resume-frame', 'continue-work', 'start-plan', 'none']);

export const takeNextStep = (root, conversationId, now = Date.now()) => {
  const path = nextStepPath(root, conversationId);
  if (!path) return null;
  let text;
  try {
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.size > 16_384) return null;
      text = readFileSync(fd, 'utf8');
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  } finally {
    try { unlinkSync(path); } catch { /* nothing to consume */ }
  }
  try {
    const record = JSON.parse(text);
    const age = now - Date.parse(record.at);
    if (!KINDS.has(record.kind) || !(age >= -60_000 && age <= NEXT_STEP_MAX_AGE_MS)) return null;
    return { kind: record.kind, target: record.target && typeof record.target === 'object' ? record.target : null };
  } catch {
    return null;
  }
};
