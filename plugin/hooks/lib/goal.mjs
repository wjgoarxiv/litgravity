// The plan's finish line as one checkable condition. lit-plan writes a `## Done when` block with one `check:` command;
// a plan that also carries `goal: native` gets it compiled into `Every row in plans/<f>.md is ticked and \`<cmd>\`
// exits 0 [lit:<id>], or the latest reply starts with WAITING-ON-USER:, or after 30 turns` (a plan without that line is
// asked only to start; the start-work driver closes it on the same check), lints it,
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
//
// A run with no plan (lit-loop, litwork, lit-hijack) gets one question of its own, kind "loop": its first activation
// records a consent whose condition is `<check>` exits 0 and the objective is done, and the same yes arms it, with no
// start-work run. See offerLoopGoal and proposeLoopGoal.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { answerChoices, answerGuide } from './goal-guide.mjs';
import { join } from 'node:path';
import { planRows } from './continuation.mjs';
import { charterHash, goalNative } from './autopilot.mjs';
import { redact } from './redact.mjs';
import { GOAL_NEVER, LOOP_GOAL_ROUTES } from './routes.mjs';

export const GOAL_MAX_CHARS = 500;
export const CONSENT_TTL_MS = 30 * 60 * 1000;
export const FALSIFY_TIMEOUT_MS = 120_000;
// The Stop hook has 30 s in hooks.json and shares them with the start-work Done-when check (20 s, autopilot.mjs); the
// advisory check keeps its 7 s and reports a slow check as unfinished.
export const STOP_CHECK_TIMEOUT_MS = 7_000;
export const OWNER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// A loop goal has no plan whose disappearance could retire it, and nothing at turn end can judge its objective, so the
// record ages out sooner than a plan's.
export const LOOP_OWNER_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const LOOP_OBJECTIVE_MAX_CHARS = 180;
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

// A plan goal always ends itself, so it cannot loop on a decision only the user can make.
export const GOAL_TURNS = 30;
export const GOAL_SELF_END = `, or the latest reply starts with WAITING-ON-USER:, or after ${GOAL_TURNS} turns`;

/** The condition text, or why it cannot be built. */
export const compileCondition = ({ plan, check }) => {
  const id = goalId(plan, check);
  const condition = `Every row in ${plan} is ticked and \`${check}\` exits 0 [lit:${id}]${GOAL_SELF_END}`;
  if (condition.length > GOAL_MAX_CHARS) return { ok: false, reason: `the condition is over ${GOAL_MAX_CHARS} characters; point the check at one script` };
  return { ok: true, condition, id };
};

/** A run's condition: its check exits 0 and its objective is done. No plan, so no rows. */
export const compileLoopCondition = ({ objective, check }) => {
  const id = goalId(`loop\u0000${objective}`, check);
  const condition = `\`${check}\` exits 0 and this is done: ${objective} [lit:${id}]`;
  if (condition.length > GOAL_MAX_CHARS) return { ok: false, reason: `the condition is over ${GOAL_MAX_CHARS} characters; shorten the objective` };
  return { ok: true, condition, id };
};

/** The objective text a prompt carries after `lit`: no slash-command lines, credentials redacted, one line, capped. */
export const normalizeGoalObjective = (value) => {
  if (typeof value !== 'string') return '';
  const lines = value.split(/\r?\n/u).filter((line) => !line.trimStart().startsWith('/'));
  return redact(lines.join(' ')).replace(/\s+/gu, ' ').trim().slice(0, LOOP_OBJECTIVE_MAX_CHARS).trim();
};

/** The project's own test command, for the question the prompt hook asks; null when there is none. */
export const detectCheck = (workspace) => {
  try {
    if (typeof JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8'))?.scripts?.test === 'string') return 'npm test';
  } catch { /* no readable package.json */ }
  for (const [file, check] of [['pytest.ini', 'pytest'], ['pyproject.toml', 'pytest'], ['Cargo.toml', 'cargo test'], ['go.mod', 'go test ./...']]) {
    if (existsSync(join(workspace, file))) return check;
  }
  return null;
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

/** A run has no unticked rows to keep its goal false, so its check must fail right now. */
export const falsifyLoop = ({ cwd, check, timeoutMs = FALSIFY_TIMEOUT_MS, run = spawnSync }) => {
  const { result } = runCheck(cwd, check, timeoutMs, run);
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') return { ok: false, reason: `\`${check}\` did not finish within ${Math.round(timeoutMs / 1000)} s` };
  if (result.error || result.status === 127) return { ok: false, reason: `\`${check}\` cannot run here` };
  if (result.status === 0) return { ok: false, reason: `\`${check}\` already passes, so the goal would be met at once; write the failing test first` };
  return { ok: true, exit: result.status };
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
  askLoop: (condition) => `Set goal for this lit-loop: /goal ${condition}? ${answerChoices('loop')}`,
  ask: (condition) => `Approve plan, start work and set goal: /goal ${condition}? ${answerChoices('plan')}`,
  askStart: (reason) => `No goal for this plan: ${reason}.\nApprove plan and start work? ${answerChoices('start')}`,
  started: (plan) => `Plan approved: start-work runs ${plan} now. No goal is set.`,
  startRefused: (reason) => `Plan not started and no goal set: ${reason}.`,
  set: (condition) => `Goal armed by LitGravity: ${condition}. agy's own goal is not confirmed (a hook cannot type it). Paste: /goal ${condition}`,
  skipped: (reason) => `Goal skipped: ${reason}.`,
  edit: (condition) => `Nothing started and no goal set. Edit the \`## Done when\` check, then answer again: /goal ${condition}? ${answerChoices('plan')}`,
  editStart: () => `Nothing started. Edit the plan, then answer again: Approve plan and start work? ${answerChoices('start')}`,
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
export const answerConsent = (workspace, prompt, conversationId, now = Date.now(), { startWork = () => ({ ok: false, reason: 'no start path' }), turnId = null } = {}) => {
  const answer = consentAnswer(prompt);
  const consent = readGoalRecord(workspace, 'consent');
  if (consent?.kind === 'loop') return answerLoopConsent(workspace, consent, answer, conversationId, now, turnId);
  if (!answer) return null;
  if (!consentIsLive(consent, now) || consent.route !== 'lit-plan' || GOAL_NEVER.has(consent.route)) return null;
  const withGoal = typeof consent.condition === 'string';
  if (answer === 'edit') return { line: withGoal ? STATUS.edit(consent.condition) : STATUS.editStart(), start: null };
  dropGoalRecord(workspace, 'consent');
  if (answer === 'no') {
    setStatus(workspace, 'declined', STATUS.declined(), now);
    return { line: STATUS.declined(), start: null };
  }
  const started = startWork(consent.plan, { charterHash: typeof consent.charterHash === 'string' ? consent.charterHash : null });
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

// A run's question is answered by the very next prompt or not at all: yes arms the goal (no start-work, the run goes
// on), no sets nothing, and edit or any other text drops the question unanswered. The prompt that asked it (same
// turn) leaves it alone, so a repeated call for that turn cannot spend it.
const answerLoopConsent = (workspace, consent, answer, conversationId, now, turnId) => {
  if (Number.isInteger(turnId) && consent.turnId === turnId) return null;
  dropGoalRecord(workspace, 'consent');
  if (!consentIsLive(consent, now) || consent.plan !== null || !LOOP_GOAL_ROUTES.has(consent.route) || GOAL_NEVER.has(consent.route)) return null;
  if (answer === 'no') {
    const line = STATUS.skipped('you answered no');
    setStatus(workspace, 'declined', line, now);
    return { line, start: null, loop: true };
  }
  if (answer !== 'yes') return null;
  const owner = readGoalRecord(workspace, 'owner');
  if (owner && owner.hash !== consent.hash) {
    setStatus(workspace, 'other-active', STATUS.otherActive(owner.condition), now);
    return { line: STATUS.otherActive(owner.condition), start: null, loop: true };
  }
  writeGoalRecord(workspace, 'owner', { kind: 'loop', condition: consent.condition, hash: consent.hash, plan: null, check: consent.check, objective: consent.objective, conversationId, armedAt: new Date(now).toISOString(), native: 'paste' });
  setStatus(workspace, 'set', STATUS.set(consent.condition), now);
  return { line: STATUS.set(consent.condition), start: null, loop: true };
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
  // A loop goal names no plan; only its age retires it.
  const loop = owner.kind === 'loop';
  const planGone = !loop && (typeof owner.plan !== 'string' || !existsSync(join(workspace, owner.plan)));
  if (!(planGone || !Number.isFinite(age) || age > (loop ? LOOP_OWNER_MAX_AGE_MS : OWNER_MAX_AGE_MS))) return null;
  dropGoalRecord(workspace, 'owner');
  setStatus(workspace, 'swept', STATUS.swept(owner.condition), now);
  return STATUS.swept(owner.condition);
};

/** goal-propose: compile, lint and falsify a plan's condition; on success write the consent record. */
export const proposeGoal = ({ workspace, plan, run = spawnSync, now = Date.now(), timeoutMs = FALSIFY_TIMEOUT_MS }) => {
  if (typeof plan !== 'string' || !/^plans\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.md$/u.test(plan) || plan.includes('..')) return { ok: false, line: STATUS.skipped('the plan path must be plans/<name>.md') };
  let planText;
  try { planText = readFileSync(join(workspace, plan), 'utf8'); } catch { return { ok: false, line: STATUS.skipped(`${plan} cannot be read`) }; }
  // The plan's charter and scope lines as they stood when the question was asked; the start compares them again.
  const charter = charterHash(planText);
  // A plan that cannot carry a goal can still be approved and started: the question drops the goal half and names why.
  const startOnly = (reason) => {
    writeGoalRecord(workspace, 'consent', { condition: null, hash: conditionHash(`start ${plan}`), plan, reason, route: 'lit-plan', askedAt: new Date(now).toISOString(), charterHash: charter });
    return { ok: false, startOnly: true, reason, line: STATUS.askStart(reason), guide: answerGuide('start') };
  };
  // agy's own goal is opt-in: without `goal: native` the start-work driver alone carries the run to its check.
  if (!goalNative(planText)) return startOnly('the plan has no `goal: native` line, so the run closes on its own `## Done when` check');
  const done = parseDoneWhen(planText);
  if (!done.ok) return startOnly(done.reason);
  const built = compileCondition({ plan, check: done.check });
  if (!built.ok) return startOnly(built.reason);
  const lint = lintCondition(built.condition, done.check);
  if (!lint.ok) return startOnly(lint.reasons.join('; '));
  const dry = falsify({ cwd: workspace, plan, planText, check: done.check, timeoutMs, run });
  if (!dry.ok) return startOnly(dry.reason);
  writeGoalRecord(workspace, 'consent', { condition: built.condition, hash: conditionHash(built.condition), plan, check: done.check, id: built.id, route: 'lit-plan', askedAt: new Date(now).toISOString(), falsifier: { open: dry.open, exit: dry.exit }, charterHash: charter });
  return { ok: true, condition: built.condition, line: STATUS.ask(built.condition), guide: answerGuide('plan', built.condition) };
};

// A loop goal has no plan whose last tick would finish it, so a new run replaces it when it is plainly another run:
// another objective, or another conversation (both ids known). The same loop asked again keeps its goal, and a plan's
// goal is never replaced here.
const staleLoopOwner = (owner, { objective, conversationId }) => owner.kind === 'loop'
  && (owner.objective !== objective || (typeof conversationId === 'string' && typeof owner.conversationId === 'string' && owner.conversationId !== conversationId));

/**
 * goal-propose --loop: compile, lint and (unless falsifyNow is false) dry-run a run's condition; on success write the
 * consent record. The prompt hook cannot wait on a test run, so it passes falsifyNow false: the objective clause still
 * keeps such a goal false until the work is done. A goal already owned, an empty objective, an unlisted or unrunnable
 * check or a check that already passes record nothing and return the fixed `Goal skipped: <reason>.` line.
 */
export const proposeLoopGoal = ({ workspace, check, objective, route = 'lit-loop', conversationId = null, turnId = null, run = spawnSync, now = Date.now(), timeoutMs = FALSIFY_TIMEOUT_MS, falsifyNow = true }) => {
  const skip = (reason) => ({ ok: false, line: STATUS.skipped(reason) });
  const goal = normalizeGoalObjective(String(objective ?? ''));
  const command = String(check ?? '').trim();
  if (!LOOP_GOAL_ROUTES.has(route) || GOAL_NEVER.has(route)) return skip(`${route} sets no goal of its own`);
  if (!goal) return skip('name what the loop should finish');
  const owner = readGoalRecord(workspace, 'owner');
  if (owner && !staleLoopOwner(owner, { objective: goal, conversationId })) return skip('a goal is already active');
  const built = compileLoopCondition({ objective: goal, check: command });
  if (!built.ok) return skip(built.reason);
  const lint = lintCondition(built.condition, command);
  if (!lint.ok) return skip(lint.reasons.join('; '));
  const dry = falsifyNow ? falsifyLoop({ cwd: workspace, check: command, timeoutMs, run }) : { ok: true };
  if (!dry.ok) return skip(dry.reason);
  if (owner) dropGoalRecord(workspace, 'owner');
  writeGoalRecord(workspace, 'consent', { kind: 'loop', route, condition: built.condition, hash: conditionHash(built.condition), plan: null, check: command, objective: goal, id: built.id, turnId, askedAt: new Date(now).toISOString() });
  return { ok: true, condition: built.condition, line: STATUS.askLoop(built.condition), guide: answerGuide('loop', built.condition) };
};

/**
 * A run's first activation: when the prompt carries an objective, the project has a test command and no goal is owned or
 * pending, record the question and return it. Returns { line, condition } or null (nothing recorded).
 */
export const offerLoopGoal = (workspace, { route, objective, conversationId = null, turnId = null, now = Date.now() }) => {
  try {
    if (!LOOP_GOAL_ROUTES.has(route) || !normalizeGoalObjective(objective ?? '')) return null;
    const owner = readGoalRecord(workspace, 'owner');
    if ((owner && !staleLoopOwner(owner, { objective: normalizeGoalObjective(objective), conversationId })) || readGoalRecord(workspace, 'consent')) return null;
    const check = detectCheck(workspace);
    if (!check) return null;
    const offer = proposeLoopGoal({ workspace, check, objective, route, conversationId, turnId, now, falsifyNow: false });
    return offer.ok ? { line: offer.line, condition: offer.condition } : null;
  } catch {
    return null;
  }
};
