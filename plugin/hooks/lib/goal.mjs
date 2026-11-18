// The plan's finish line as one checkable condition. lit-plan writes a `## Done when` block with one `check:` command;
// this module compiles it into `Every row in plans/<f>.md is ticked and \`<cmd>\` exits 0 [lit:<id>]`, lints it,
// proves it is false today (the falsifier dry run) and keeps the three small records under `.litgravity/goal/`:
//
//   consent.json  goal-propose asked the user, with the condition, its hash and the plan       (asked)
//   owner.json    the user typed exactly `yes` to that question; LitGravity owns this goal     (armed)
//   status.json   the last fixed status line (set, skipped, met-and-cleared, cancelled, swept)
//
// agy 1.5.10 has its own `/goal` command in the interactive TUI, but a hook can only inject steps or decide a tool
// call; it cannot type a slash command. So the yes answer arms LitGravity's own check, and the reply hands the user the
// one line to paste for agy's goal. The check runs at every turn end through the Stop hook as an advisory: when the
// rows are ticked and the command exits 0, the owned record is cleared. A goal the user set by hand in agy is never
// touched, because nothing here can reach it.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { planRows } from './continuation.mjs';
import { GOAL_NEVER } from './routes.mjs';

export const GOAL_MAX_CHARS = 500;
export const CONSENT_TTL_MS = 30 * 60 * 1000;
export const FALSIFY_TIMEOUT_MS = 120_000;
// The Stop hook has 10 s in hooks.json; the advisory check gets most of it and reports a slow check as unfinished.
export const STOP_CHECK_TIMEOUT_MS = 7_000;
export const OWNER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const GOAL_DIR = join('.litgravity', 'goal');

const JUDGMENT_WORDS = [
  /\bworks?\b/iu, /\bworking\b/iu, /\blooks? (?:good|fine|right|nice|great)\b/iu, /\bseems?\b/iu, /\bproperly\b/iu,
  /\bcorrectly\b/iu, /\bnicely\b/iu, /\bshould (?:work|pass)\b/iu, /\bas expected\b/iu, /\bgood enough\b/iu,
  /잘\s*(?:동작|작동|돌아|돼|된다|되면)/u, /괜찮/u, /깔끔/u, /제대로/u, /문제\s*없/u, /완벽/u,
];
// A success that is only an outward action proves nothing about the work and cannot be undone.
const OUTWARD_ONLY = /^\s*(?:git\s+push|npm\s+publish|pnpm\s+publish|yarn\s+publish|gh\s+(?:release|pr\s+merge)|git\s+tag)\b/iu;
// The commands a falsifier may run: test runners and a script inside the project, nothing with a shell.
const CHECK_ALLOWLIST = [
  /^npm (?:test|run [\w:.-]+)(?: --[\w-]+)*$/u,
  /^node --test(?: [\w./*-]+)*$/u,
  /^node [\w./-]+\.m?js(?: [\w./=-]+)*$/u,
  /^(?:pnpm|yarn) (?:test|run [\w:.-]+)$/u,
  /^(?:pytest|python3? -m pytest)(?: [\w./:-]+)*$/u,
  /^cargo test(?: [\w-]+)*$/u,
  /^go test(?: [\w./-]+)*$/u,
  /^make (?:test|check|verify)$/u,
  /^(?:bash|sh) scripts\/[\w./-]+\.sh$/u,
];

export const conditionHash = (condition) => createHash('sha256').update(String(condition)).digest('hex').slice(0, 16);
export const goalId = (plan, check) => createHash('sha256').update(`${plan}\u0000${check}`).digest('hex').slice(0, 8);

/** The `## Done when` block: one `check: \`<command>\`` line. */
export const parseDoneWhen = (planText) => {
  const lines = String(planText ?? '').split(/\r?\n/u);
  const start = lines.findIndex((line) => /^##\s+Done when\s*$/iu.test(line));
  if (start === -1) return { ok: false, reason: 'the plan has no `## Done when` block' };
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/u.test(line)) break;
    const match = /^\s*(?:[-*]\s+)?check:\s*`([^`\n]+)`\s*$/u.exec(line);
    if (match) return { ok: true, check: match[1].trim() };
  }
  return { ok: false, reason: 'the `## Done when` block names no `check:` command' };
};

/** The condition text, or why it cannot be built. */
export const compileCondition = ({ plan, check }) => {
  const id = goalId(plan, check);
  const condition = `Every row in ${plan} is ticked and \`${check}\` exits 0 [lit:${id}]`;
  if (condition.length > GOAL_MAX_CHARS) return { ok: false, reason: `the condition is over ${GOAL_MAX_CHARS} characters; point the check at one script` };
  return { ok: true, condition, id };
};

/** Rejects judgment words, outward-only success, unlisted commands and conditions over the cap. */
export const lintCondition = (condition, check) => {
  const reasons = [];
  const text = String(check);
  if (String(condition).length > GOAL_MAX_CHARS) reasons.push(`over ${GOAL_MAX_CHARS} characters`);
  const words = JUDGMENT_WORDS.filter((re) => re.test(text)).map((re) => text.match(re)[0]);
  if (words.length) reasons.push(`judgment words cannot be checked (${words.join(', ')})`);
  if (OUTWARD_ONLY.test(text)) reasons.push('a push, publish or release is not a check of the work');
  else if (!CHECK_ALLOWLIST.some((re) => re.test(text))) reasons.push(`\`${text}\` is not an allowlisted test command`);
  return { ok: reasons.length === 0, reasons };
};

const runCheck = (cwd, check, timeoutMs, run) => {
  const [cmd, ...args] = check.split(/\s+/u);
  return { cmd, args, result: run(cmd, args, { cwd, encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'ignore', 'ignore'], shell: false }) };
};

/**
 * The dry run: the condition must be false now, or the goal is met at its first check. Runs the allowlisted command
 * once, time-boxed, without a shell. A check script the plan itself creates is missing until the work runs: false
 * now, not broken.
 */
export const falsify = ({ cwd, plan, planText, check, timeoutMs = FALSIFY_TIMEOUT_MS, run = spawnSync }) => {
  const open = planRows(String(planText)).filter((row) => !row.done).length;
  const { cmd, args, result } = runCheck(cwd, check, timeoutMs, run);
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') return { ok: false, reason: `\`${check}\` did not finish within ${Math.round(timeoutMs / 1000)} s` };
  const plannedScript = ['bash', 'sh', 'node'].includes(cmd) && args.length >= 1 && String(planText).includes(args[0]) && !existsSync(join(cwd, args[0]));
  if ((result.error || result.status === 127) && !plannedScript) return { ok: false, reason: `\`${check}\` cannot run here` };
  if (result.status === 0 && open === 0) return { ok: false, reason: `the goal is already true (${plan} is all ticked and \`${check}\` exits 0)` };
  return { ok: true, open, exit: plannedScript ? null : result.status };
};

/** `yes`, `edit` and `no` (exactly, any case) are answers; anything else is no answer at all. */
export const consentAnswer = (prompt) => {
  const text = String(prompt ?? '').trim().toLowerCase();
  return ['yes', 'edit', 'no'].includes(text) ? text : null;
};

/** The consent record is fresh and is the one the user is answering. */
const consentSubject = (consent) => (typeof consent?.condition === 'string' ? consent.condition
  : typeof consent?.plan === 'string' && consent.condition === null ? `start ${consent.plan}` : null);
export const consentIsLive = (consent, now = Date.now()) => Boolean(consent && consentSubject(consent) !== null
  && consent.hash === conditionHash(consentSubject(consent)) && Number.isFinite(Date.parse(consent.askedAt))
  && now - Date.parse(consent.askedAt) <= CONSENT_TTL_MS);

// The fixed status lines. Nothing else about a goal is ever said in another wording.
export const STATUS = Object.freeze({
  ask: (condition) => `Approve plan, start work and set goal: /goal ${condition}? (yes / edit / no)`,
  askStart: (reason) => `No goal for this plan: ${reason}.\nApprove plan and start work? (yes / no)`,
  started: (plan) => `Plan approved: start-work runs ${plan} now. No goal is set.`,
  startRefused: (reason) => `Plan not started and no goal set: ${reason}.`,
  set: (condition) => `Goal armed by LitGravity: ${condition}. agy's own goal is not confirmed (a hook cannot type it). Paste: /goal ${condition}`,
  skipped: (reason) => `Goal skipped: ${reason}.`,
  edit: (condition) => `Nothing started and no goal set. Edit the \`## Done when\` check, then answer again: /goal ${condition}? (yes / edit / no)`,
  editStart: () => 'Nothing started. Edit the plan, then answer again: Approve plan and start work? (yes / no)',
  declined: () => 'Nothing started and no goal set: you answered no.',
  otherActive: (condition) => `A goal is already active (${condition}); LitGravity left it as it is.`,
  met: (condition) => `Goal met and cleared: ${condition}. If you pasted it into agy and it still shows, type /goal clear.`,
  cancelled: (condition) => `Goal cleared by lit cancel: ${condition}. If you pasted it into agy, type /goal clear.`,
  swept: (condition) => `Goal record dropped (stale or its plan is gone): ${condition}.`,
});

const goalDir = (workspace) => join(workspace, GOAL_DIR);

export const readGoalRecord = (workspace, name) => {
  const file = join(goalDir(workspace), `${name}.json`);
  try {
    if (lstatSync(file).isSymbolicLink()) return null;
    const value = JSON.parse(readFileSync(file, 'utf8'));
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
};

export const writeGoalRecord = (workspace, name, value) => {
  const dir = goalDir(workspace);
  try {
    if (lstatSync(join(workspace, '.litgravity')).isSymbolicLink()) return false;
  } catch { /* created below */ }
  mkdirSync(dir, { recursive: true });
  if (lstatSync(dir).isSymbolicLink()) return false;
  const file = join(dir, `${name}.json`);
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, file);
  return true;
};

export const dropGoalRecord = (workspace, name) => {
  try { unlinkSync(join(goalDir(workspace), `${name}.json`)); } catch { /* already gone */ }
};

const setStatus = (workspace, kind, line, now) => writeGoalRecord(workspace, 'status', { kind, line, at: new Date(now).toISOString() });

/**
 * The prompt hook's half: a typed `yes` / `edit` / `no` while a live consent record waits. An exact `yes` bound to the
 * asked hash approves the plan, starts its start-work run through `startWork(plan)` (the hook's own start path, the same
 * one `lit start <plan>` takes) and, when the record carries a goal, arms it. A refused start arms nothing. Returns
 * `{ line, start }` (`start` is the plan the hook started, or null) or null when the prompt answers no live question.
 */
export const answerConsent = (workspace, prompt, conversationId, now = Date.now(), { startWork = () => ({ ok: false, reason: 'no start path' }) } = {}) => {
  const answer = consentAnswer(prompt);
  if (!answer) return null;
  const consent = readGoalRecord(workspace, 'consent');
  if (!consentIsLive(consent, now) || consent.route !== 'lit-plan' || GOAL_NEVER.has(consent.route)) return null;
  const withGoal = typeof consent.condition === 'string';
  if (answer === 'edit') return { line: withGoal ? STATUS.edit(consent.condition) : STATUS.editStart(), start: null };
  dropGoalRecord(workspace, 'consent');
  if (answer === 'no') {
    setStatus(workspace, 'declined', STATUS.declined(), now);
    return { line: STATUS.declined(), start: null };
  }
  const started = startWork(consent.plan);
  if (!started?.ok) {
    const line = STATUS.startRefused(started?.reason ?? 'the start path refused');
    setStatus(workspace, 'start-refused', line, now);
    return { line, start: null };
  }
  if (!withGoal) {
    setStatus(workspace, 'started', STATUS.started(consent.plan), now);
    return { line: STATUS.started(consent.plan), start: consent.plan };
  }
  const owner = readGoalRecord(workspace, 'owner');
  if (owner && owner.hash !== consent.hash) {
    setStatus(workspace, 'other-active', STATUS.otherActive(owner.condition), now);
    return { line: STATUS.otherActive(owner.condition), start: consent.plan };
  }
  writeGoalRecord(workspace, 'owner', { condition: consent.condition, hash: consent.hash, plan: consent.plan, check: consent.check, conversationId, armedAt: new Date(now).toISOString(), native: 'paste' });
  setStatus(workspace, 'set', STATUS.set(consent.condition), now);
  return { line: STATUS.set(consent.condition), start: consent.plan };
};

/** `lit cancel`: clears only the goal LitGravity owns. */
export const cancelOwnedGoal = (workspace, now = Date.now()) => {
  const owner = readGoalRecord(workspace, 'owner');
  if (!owner || owner.hash !== conditionHash(owner.condition)) return null;
  dropGoalRecord(workspace, 'owner');
  setStatus(workspace, 'cancelled', STATUS.cancelled(owner.condition), now);
  return STATUS.cancelled(owner.condition);
};

/**
 * The Stop hook's half: the advisory check at turn end. `met` clears the owned record; anything else leaves it. A check
 * slower than the hook allows is reported as unfinished, never as met.
 */
export const advisoryCheck = (workspace, { run = spawnSync, now = Date.now(), timeoutMs = STOP_CHECK_TIMEOUT_MS } = {}) => {
  const owner = readGoalRecord(workspace, 'owner');
  if (!owner || owner.hash !== conditionHash(owner.condition) || typeof owner.plan !== 'string' || typeof owner.check !== 'string') return null;
  let text;
  try { text = readFileSync(join(workspace, owner.plan), 'utf8'); } catch { return { state: 'plan-missing', owner }; }
  const open = planRows(text).filter((row) => !row.done).length;
  if (open > 0) return { state: 'open', open, owner };
  if (!lintCondition(owner.condition, owner.check).ok) return { state: 'unlisted', owner };
  const { result } = runCheck(workspace, owner.check, timeoutMs, run);
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') return { state: 'slow', owner };
  if (result.status !== 0) return { state: 'failing', exit: result.status, owner };
  dropGoalRecord(workspace, 'owner');
  setStatus(workspace, 'met', STATUS.met(owner.condition), now);
  return { state: 'met', owner, line: STATUS.met(owner.condition) };
};

/** SessionStart: a record left by a crash (stale, or its plan is gone) is dropped and named once. */
export const sweepGoal = (workspace, now = Date.now()) => {
  const owner = readGoalRecord(workspace, 'owner');
  if (!owner) return null;
  const age = now - Date.parse(owner.armedAt);
  const planGone = typeof owner.plan !== 'string' || !existsSync(join(workspace, owner.plan));
  if (!(planGone || !Number.isFinite(age) || age > OWNER_MAX_AGE_MS)) return null;
  dropGoalRecord(workspace, 'owner');
  setStatus(workspace, 'swept', STATUS.swept(owner.condition), now);
  return STATUS.swept(owner.condition);
};

/** goal-propose: compile, lint and falsify a plan's condition; on success write the consent record. */
export const proposeGoal = ({ workspace, plan, run = spawnSync, now = Date.now(), timeoutMs = FALSIFY_TIMEOUT_MS }) => {
  if (typeof plan !== 'string' || !/^plans\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.md$/u.test(plan) || plan.includes('..')) return { ok: false, line: STATUS.skipped('the plan path must be plans/<name>.md') };
  let planText;
  try { planText = readFileSync(join(workspace, plan), 'utf8'); } catch { return { ok: false, line: STATUS.skipped(`${plan} cannot be read`) }; }
  // A plan that cannot carry a goal can still be approved and started: the question drops the goal half and names why.
  const startOnly = (reason) => {
    writeGoalRecord(workspace, 'consent', { condition: null, hash: conditionHash(`start ${plan}`), plan, reason, route: 'lit-plan', askedAt: new Date(now).toISOString() });
    return { ok: false, startOnly: true, reason, line: STATUS.askStart(reason) };
  };
  const done = parseDoneWhen(planText);
  if (!done.ok) return startOnly(done.reason);
  const built = compileCondition({ plan, check: done.check });
  if (!built.ok) return startOnly(built.reason);
  const lint = lintCondition(built.condition, done.check);
  if (!lint.ok) return startOnly(lint.reasons.join('; '));
  const dry = falsify({ cwd: workspace, plan, planText, check: done.check, timeoutMs, run });
  if (!dry.ok) return startOnly(dry.reason);
  writeGoalRecord(workspace, 'consent', { condition: built.condition, hash: conditionHash(built.condition), plan, check: done.check, id: built.id, route: 'lit-plan', askedAt: new Date(now).toISOString(), falsifier: { open: dry.open, exit: dry.exit } });
  return { ok: true, condition: built.condition, line: STATUS.ask(built.condition) };
};
