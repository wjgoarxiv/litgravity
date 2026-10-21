import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync, lstatSync, realpathSync, renameSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STDIN_LIMIT = 4 * 1024 * 1024;

export function readPayload() {
  try {
    const raw = readFileSync(0, 'utf8');
    if (raw.length > STDIN_LIMIT) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

// The reply line an injected step asks for (`LIT IGNITED · <route>` or `LIT CONTINUES · <route>`), so a trace shows
// which re-entry decision the router made without logging the injected text itself.
function markerOf(out) {
  const step = out?.injectSteps?.[0];
  const text = step?.ephemeralMessage ?? step?.systemMessage?.systemMessage ?? '';
  return /LIT (?:IGNITED|CONTINUES) · [a-z-]+/.exec(text)?.[0] ?? null;
}

// LITGRAVITY_HOOK_TRACE=<file> appends one line per hook call (script, conversation, invocation, tool, the keys of its answer
// and the reply marker it asks for); it exists to prove which events a host fires and is off unless the variable is set.
function trace(payload, out) {
  const file = process.env.LITGRAVITY_HOOK_TRACE;
  if (!file) return;
  try {
    appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), hook: basename(process.argv[1] ?? '', '.mjs'), conversationId: payload.conversationId ?? null, invocationNum: payload.invocationNum ?? null, stepIdx: payload.stepIdx ?? null, tool: payload.toolCall?.name ?? null, terminationReason: payload.terminationReason ?? null, answered: Object.keys(out ?? {}), marker: markerOf(out) })}\n`);
  } catch {
    // tracing never disturbs a hook
  }
}

// Every hook prints one JSON object and exits 0 on its own errors: a broken hook must never block the user's session.
// An empty object is the "no opinion" answer for every event except PreToolUse, where agy reads it as a denial, so that
// hook passes its own fallback.
export function run(main, fallback = {}) {
  let payload = {};
  const print = (out) => {
    trace(payload, out);
    process.stdout.write(`${JSON.stringify(out ?? {})}\n`);
  };
  try {
    payload = readPayload();
    const out = main(payload);
    if (out && typeof out.then === 'function') out.then(print, () => print(fallback));
    else print(out);
  } catch {
    print(fallback);
  }
}

export const inject = (text) => ({ injectSteps: [{ ephemeralMessage: text }] });
export const injectSystem = (text) => ({ injectSteps: [{ systemMessage: { systemMessage: text } }] });
export const holdStop = (reason) => ({ decision: 'continue', reason });
export const deny = (reason) => ({ decision: 'deny', reason });

export function workspaceOf(payload) {
  const first = Array.isArray(payload.workspacePaths) ? payload.workspacePaths.find((p) => typeof p === 'string' && p) : null;
  return first ?? process.cwd();
}

export function workspacesOf(payload) {
  const all = Array.isArray(payload.workspacePaths) ? payload.workspacePaths.filter((p) => typeof p === 'string' && p) : [];
  return all.length ? all : [process.cwd()];
}

export function safeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}

function isLink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

// State lives in real directories only: a `.litgravity` (or subdirectory) that is a link, for example one shipped in a
// cloned repository, would send the hook's writes somewhere else, so the write is skipped.
function realStateDir(payload, sub) {
  const top = join(workspaceOf(payload), '.litgravity');
  for (const dir of [top, join(top, sub)]) {
    try {
      if (lstatSync(dir).isSymbolicLink() || !lstatSync(dir).isDirectory()) return null;
    } catch {
      // absent is fine; mkdir creates a real directory
    }
  }
  return join(top, sub);
}

// Route state lives outside the workspace, under $XDG_STATE_HOME/litgravity/sessions/<workspace hash>/, where a
// planning-turn tool call has no business writing. Beside each state file sits an append-only journal of route changes.
export function stateRoot(env = process.env) {
  const stateHome = env.XDG_STATE_HOME || join(env.HOME || homedir(), '.local', 'state');
  return join(stateHome, 'litgravity');
}

export function sessionPath(cwd, conversationId, env = process.env) {
  const id = safeId(conversationId);
  if (!id) return null;
  let real;
  try { real = realpathSync(cwd); } catch { real = resolve(cwd); }
  const ws = createHash('sha256').update(real).digest('hex').slice(0, 16);
  return join(stateRoot(env), 'sessions', ws, `${id}.json`);
}

export function sessionFile(payload) {
  return sessionPath(workspaceOf(payload), payload.conversationId);
}

function lastJournalRoute(file) {
  try {
    const lines = readFileSync(file.replace(/\.json$/, '.journal'), 'utf8').trim().split('\n');
    return JSON.parse(lines[lines.length - 1]).route ?? null;
  } catch {
    return null;
  }
}

// Fails closed: a corrupt state file counts as an active lit-plan route, and a missing one falls back to the journal,
// so removing or breaking the state never lifts a planning limit.
export function readSession(payload) {
  const file = sessionFile(payload);
  if (!file) return null;
  if (!existsSync(file)) {
    const route = lastJournalRoute(file);
    return route ? { route, fromJournal: true } : null;
  }
  try {
    const state = JSON.parse(readFileSync(file, 'utf8'));
    if (!state || typeof state !== 'object') throw new Error('bad state');
    return state;
  } catch {
    return { route: 'lit-plan', corrupt: true };
  }
}

export function writeSession(payload, state) {
  const file = sessionFile(payload);
  if (!file || isLink(file) || isLink(dirname(file))) return;
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, file);
  appendFileSync(file.replace(/\.json$/, '.journal'), `${JSON.stringify({ ts: Date.now(), route: state.route ?? null })}\n`);
}

export function activeRoute(payload) {
  const state = readSession(payload);
  return state && state.route ? state : null;
}

export function appendLedger(payload, entry) {
  const id = safeId(payload.conversationId);
  if (!id) return;
  const dir = realStateDir(payload, 'ledger');
  if (!dir) return;
  const file = join(dir, `${id}.jsonl`);
  if (isLink(file)) return;
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
}

export function toolName(payload) {
  return typeof payload.toolCall?.name === 'string' ? payload.toolCall.name : '';
}

export function toolArgs(payload) {
  const args = payload.toolCall?.args;
  return args && typeof args === 'object' ? args : {};
}

export function pluginVersion() {
  try {
    return JSON.parse(readFileSync(join(PLUGIN_ROOT, 'plugin.json'), 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function cachedLatest() {
  try {
    const dataHome = process.env.XDG_DATA_HOME || join(process.env.HOME || homedir(), '.local', 'share');
    const cache = JSON.parse(readFileSync(join(dataHome, 'litgravity', 'update-check.json'), 'utf8'));
    return typeof cache.latest === 'string' ? cache.latest : null;
  } catch {
    return null;
  }
}

export function newerThan(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}
