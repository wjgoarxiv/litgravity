import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { appendLedger, safeId, workspaceOf, writeSession } from './common.mjs';

const MAX_HOLDS = 3;
const PLAN_ROW = /^- \[( |x|X)\] (\d+|F\d+)\. ?(.*)$/;
const RELEASE_NOTE = /^(BLOCKED at row \d+|PAUSED at row \d+|CANCELLED):/;
export const PAUSE_WORD = /(^|\s)(stop|pause|cancel|halt|wait)(\s|[.!,?]|$)|멈춰|중단|그만|잠깐|일시\s*정지|취소/i;
export const WORK_ROUTES = new Set(['start-work', 'lit-loop', 'litgoal']);

// Rows outside code fences, column zero only, so a quoted example never counts as work.
export function planRows(text) {
  const rows = [];
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = PLAN_ROW.exec(line);
    if (m) rows.push({ done: m[1] !== ' ', id: m[2], title: m[3].trim() });
  }
  return rows;
}

function readText(file) {
  try {
    if (!statSync(file).isFile()) return null;
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function ledgerLines(payload) {
  const id = safeId(payload.conversationId);
  if (!id) return [];
  const text = readText(join(workspaceOf(payload), '.litgravity', 'ledger', `${id}.jsonl`));
  if (!text) return [];
  return text.trim().split('\n').slice(-200).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// The plan the conversation last touched (ledger path), else the newest plan that still has an open row.
export function activePlan(payload, cwd) {
  const planRef = /plans\/[A-Za-z0-9._-]+\.md/;
  for (const line of ledgerLines(payload).reverse()) {
    const hit = planRef.exec(`${line.path ?? ''} ${line.text ?? ''}`);
    if (hit && existsSync(join(cwd, hit[0]))) return hit[0];
  }
  const dir = join(cwd, 'plans');
  if (!existsSync(dir)) return null;
  let best = null;
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const text = readText(join(dir, name));
    if (!text || !planRows(text).some((r) => !r.done)) continue;
    const mtime = statSync(join(dir, name)).mtimeMs;
    if (!best || mtime > best.mtime) best = { file: `plans/${name}`, mtime };
  }
  return best ? best.file : null;
}

// The last explicit note decides: a release opener ends the hold, any later note or evidence line re-arms it.
function releasedByLedger(payload) {
  for (const line of ledgerLines(payload).reverse()) {
    if (line.kind === 'note') return RELEASE_NOTE.test(String(line.text ?? '').trim());
    if (line.kind === 'evidence' || line.kind === 'decision') return false;
  }
  return false;
}

function paused(state, prompt) {
  if (state.pauseRequested === true) return true;
  return typeof prompt === 'string' && PAUSE_WORD.test(prompt);
}

// Counts holds that made no progress. A changed fingerprint resets the count; after MAX_HOLDS the turn ends once with
// a ledger note instead of looping.
function bounded(payload, state, prefix, fingerprint, label) {
  const same = state[`${prefix}Fingerprint`] === fingerprint;
  const holds = same ? state[`${prefix}Holds`] ?? 0 : 0;
  if (holds >= MAX_HOLDS) {
    if (!state[`${prefix}Released`]) {
      writeSession(payload, { ...state, [`${prefix}Released`]: true });
      appendLedger(payload, { kind: 'note', text: `${label} hold released after ${MAX_HOLDS} holds with no progress; ending the turn.` });
    }
    return null;
  }
  return { ...state, [`${prefix}Fingerprint`]: fingerprint, [`${prefix}Holds`]: holds + 1, [`${prefix}Released`]: false };
}

function startWorkHold(payload, state, prompt) {
  if (state.route !== 'start-work' || paused(state, prompt) || releasedByLedger(payload)) return null;
  const cwd = workspaceOf(payload);
  const file = activePlan(payload, cwd);
  if (!file) return null;
  const text = readText(join(cwd, file));
  if (!text) return null;
  const status = /^[>\s*_-]*Status\**:\**\s*(.+)$/im.exec(text);
  if (!status || !/^approved\b/i.test(status[1].replace(/^[*_\s]+/, ''))) return null;
  const rows = planRows(text);
  const open = rows.filter((r) => !r.done);
  if (!open.length) return null;
  const next = bounded(payload, state, 'cont', `${file}:${rows.length - open.length}/${rows.length}`, 'start-work');
  if (!next) return null;
  writeSession(payload, next);
  const word = open.length === 1 ? 'row' : 'rows';
  return `LitGravity start-work: ${file} has ${open.length} open ${word} (next: row ${open[0].id}). Continue with row ${open[0].id}, or write a ledger note starting BLOCKED at row ${open[0].id}: / PAUSED at row ${open[0].id}: / CANCELLED: and end the turn.`;
}

function goalDir(cwd) {
  const top = join(cwd, '.litgravity');
  const dir = join(top, 'goals');
  try {
    if (lstatSync(top).isSymbolicLink() || lstatSync(dir).isSymbolicLink() || !lstatSync(dir).isDirectory()) return null;
    return dir;
  } catch {
    return null;
  }
}

// A goal record counts for this conversation when the hooks saw the conversation touch it (state.goalPath) or the
// record names the conversation itself.
export function openGoal(payload, state, cwd) {
  const dir = goalDir(cwd);
  const cid = safeId(payload.conversationId);
  if (!dir || !cid) return null;
  const bound = typeof state.goalPath === 'string' ? state.goalPath.split('/').pop() : null;
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    let rec;
    try { rec = JSON.parse(readText(join(dir, name))); } catch { continue; }
    if (!rec || rec.status !== 'active' || rec.hold === false || !Array.isArray(rec.criteria)) continue;
    if (name !== bound && rec.conversation_id !== cid) continue;
    const open = rec.criteria.find((c) => c && (c.status === 'open' || c.status === 'fail'));
    if (!open) continue;
    const pass = rec.criteria.filter((c) => c && c.status === 'pass').length;
    return { path: `.litgravity/goals/${name}`, open, pass, total: rec.criteria.length, updated: String(rec.updated ?? '') };
  }
  return null;
}

function goalHold(payload, state, prompt, turn) {
  if (!WORK_ROUTES.has(state.route) || process.env.LITGRAVITY_GOAL_HOLD === '0' || paused(state, prompt) || releasedByLedger(payload)) return null;
  if (state.goalHeldFor === turn) return null;
  const goal = openGoal(payload, state, workspaceOf(payload));
  if (!goal) return null;
  const next = bounded(payload, state, 'goal', `${goal.path}:${goal.updated}:${goal.pass}`, 'litgoal');
  if (!next) return null;
  writeSession(payload, { ...next, goalHeldFor: turn });
  return `LitGravity litgoal: ${goal.path} is ${goal.pass}/${goal.total} passed; next open criterion ${goal.open.id}: ${String(goal.open.text ?? '').slice(0, 200)}. Work it, or close the record honestly as blocked with the obstacle, then end the turn.`;
}

// Returns the reason text of the hold, or null when the turn may end.
export function continuationHold(payload, state, prompt, turn) {
  try {
    return startWorkHold(payload, state, prompt) ?? goalHold(payload, state, prompt, turn);
  } catch {
    return null;
  }
}
