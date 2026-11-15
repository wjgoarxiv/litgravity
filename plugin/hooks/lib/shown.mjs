import { appendFileSync, lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { realStateDir, safeId, workspaceOf } from './common.mjs';
import { WORK_ROUTES, activePlan, openGoal, planRows } from './continuation.mjs';

// An append-only record in `.litgravity/shown/notices.jsonl` of what the hooks already told the user in this project:
// one line per notice (`kind`, `hash` of its normalised text, `ts`) and one per run end (`outcome`). A missing, corrupt
// or unwritable record changes nothing: the notice is shown as before. Only text the hooks print themselves is
// recorded; the model's own prose is never intercepted.
const RUN_END_FILE_CAP = 1_000_000;

const hashOf = (text) => createHash('sha256').update(String(text).replace(/\s+/g, ' ').trim().toLowerCase()).digest('hex').slice(0, 16);

function recordFile(payload) {
  if (!safeId(payload.conversationId)) return null;
  const dir = realStateDir(payload, 'shown');
  return dir ? join(dir, 'notices.jsonl') : null;
}

function append(file, entry, { cap = Infinity } = {}) {
  try {
    mkdirSync(join(file, '..'), { recursive: true });
    try {
      const st = lstatSync(file);
      if (st.isSymbolicLink() || st.size > cap) return;
    } catch { /* absent: created by the append */ }
    appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
  } catch { /* the record never blocks a hook */ }
}

function seen(file, hash) {
  try {
    return readFileSync(file, 'utf8').split('\n').some((line) => {
      try { return JSON.parse(line).hash === hash; } catch { return false; }
    });
  } catch {
    return false;
  }
}

/** True when `text` should be shown now: it was not recorded before. A fresh notice is recorded as shown. */
export function noticeOnce(payload, kind, text) {
  const file = recordFile(payload);
  if (!file) return true;
  const hash = hashOf(text);
  if (seen(file, hash)) return false;
  append(file, { kind, hash });
  return true;
}

/** How a work run's turn ended: `waiting` on the user, `nothing` (open work left, nobody asked), or `sent` (nothing left open). */
export function recordRunEnd(payload, state, waiting) {
  try {
    const file = recordFile(payload);
    if (!file || !WORK_ROUTES.has(state.route)) return;
    const cwd = workspaceOf(payload);
    let open = Boolean(openGoal(payload, state, cwd));
    if (!open) {
      const plan = activePlan(payload, cwd);
      open = plan ? planRows(readFileSync(join(cwd, plan), 'utf8')).some((r) => !r.done) : false;
    }
    append(file, { kind: 'run-end', outcome: waiting ? 'waiting' : open ? 'nothing' : 'sent', route: state.route, conversation: payload.conversationId }, { cap: RUN_END_FILE_CAP });
  } catch { /* the record never blocks a hook */ }
}
