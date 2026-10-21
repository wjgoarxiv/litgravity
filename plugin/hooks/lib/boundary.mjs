import { readdirSync, lstatSync, readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { sessionFile, workspaceOf } from './common.mjs';
import { PROSE_FILE, addedNegationCluster, addedHedgeCluster, NEGATION_MESSAGE, HEDGE_MESSAGE, DICTATED_NOTE } from './prose.mjs';

// A PreToolUse hook cannot abstain on agy: every answer needs a decision, and an empty one is read as a denial. A
// guard that sits in front of every file write and command would therefore have to approve them all, which may lift the
// user's own permission prompts. So the boundary of a lit route is checked after the fact instead: the hooks keep a
// snapshot of the workspace from the start of the turn and compare it with the workspace after each model invocation
// and at Stop. The check is blind to tool names, which differ between agy builds, and it also sees what a shell
// command wrote.

const SKIP_DIRS = new Set(['.git', 'node_modules', '.litgravity', '.agents', 'dist', 'build', 'target', '.venv', 'venv', '__pycache__', '.next', '.cache', 'coverage', '.turbo']);
const LIMITS = { entries: 20000, ms: 1500, proseFiles: 200, proseBytes: 32 * 1024 };

export function scan(root, limits = LIMITS) {
  const started = Date.now();
  const files = {};
  const prose = {};
  let partial = false;
  const walk = (dir, rel) => {
    let names;
    try { names = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const d of names) {
      if (partial) return;
      if (Object.keys(files).length >= limits.entries || Date.now() - started > limits.ms) { partial = true; return; }
      const relPath = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) {
        if (!SKIP_DIRS.has(d.name)) walk(join(dir, d.name), relPath);
      } else if (d.isFile()) {
        let st;
        try { st = lstatSync(join(dir, d.name)); } catch { continue; }
        files[relPath] = `${st.size}:${Math.round(st.mtimeMs)}`;
        if (PROSE_FILE.test(d.name) && st.size <= limits.proseBytes && Object.keys(prose).length < limits.proseFiles) {
          try { prose[relPath] = readFileSync(join(dir, d.name), 'utf8'); } catch { /* unreadable prose counts as absent */ }
        }
      }
    }
  };
  walk(root, '');
  return { partial, files, prose };
}

const snapshotFile = (payload) => {
  const f = sessionFile(payload);
  return f ? f.replace(/\.json$/, '.snapshot.json') : null;
};

export function saveSnapshot(payload) {
  const file = snapshotFile(payload);
  if (!file) return;
  try {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(scan(workspaceOf(payload))));
    renameSync(tmp, file);
  } catch { /* without a snapshot the boundary check stays quiet */ }
}

function loadSnapshot(payload) {
  const file = snapshotFile(payload);
  if (!file || !existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

const inside = (rel, dirs) => dirs.some((d) => rel === d || rel.startsWith(`${d}/`));

// A walk that hit the limits stops at a different file each time, so a file only one partial walk saw says nothing:
// after a partial `before` an unseen file is not new, and after a partial `now` a missing file is not removed.
export function diffSnapshots(before, now) {
  const changed = Object.keys(now.files).filter((r) => (r in before.files ? before.files[r] !== now.files[r] : !before.partial));
  const removed = before.partial || now.partial ? [] : Object.keys(before.files).filter((r) => !(r in now.files));
  return { changed, removed };
}

// {kind, message} for the first boundary problem of this turn, or null. `lit-plan` may change only plans/; every lit route
// except the humanizer keeps stacked negations and hedges out of the prose it writes.
export function boundaryProblem(payload, route) {
  if (!route || route === 'lit-humanizer') return null;
  const before = loadSnapshot(payload);
  if (!before) return null;
  const now = scan(workspaceOf(payload));
  const { changed, removed } = diffSnapshots(before, now);
  if (route === 'lit-plan') {
    const outside = [...changed, ...removed].filter((r) => !inside(r, ['plans']));
    if (outside.length) {
      const list = outside.slice(0, 8).join(', ');
      return {
        kind: 'plan-boundary',
        message: `LitGravity lit-plan boundary: this planning turn changed files outside plans/ and .litgravity/: ${list}${outside.length > 8 ? `, and ${outside.length - 8} more` : ''}. Undo those changes now (restore tracked files with git checkout -- <path>, delete files you created), then continue with the plan file only. Implementation waits for \`lit start\`.`,
      };
    }
  }
  for (const rel of changed.filter((r) => PROSE_FILE.test(r) && !inside(r, ['.litgravity']))) {
    const text = now.prose[rel];
    if (typeof text !== 'string') continue;
    const old = before.prose?.[rel] ?? '';
    const negation = addedNegationCluster(text, old);
    if (negation) return { kind: 'negation', message: `LitGravity write guard: ${rel} now has a paragraph with stacked negations ("${negation.snippet}..."). ${NEGATION_MESSAGE} Rewrite that paragraph now. ${DICTATED_NOTE}` };
    const hedge = inside(rel, ['plans', 'evidence']) ? null : addedHedgeCluster(text, old);
    if (hedge) return { kind: 'hedge', message: `LitGravity write guard: ${rel} now has stacked hedges ("${hedge.snippet}..."). ${HEDGE_MESSAGE} Rewrite that paragraph now. ${DICTATED_NOTE}` };
  }
  return null;
}

export const BOUNDARY_HOLDS = 2;
