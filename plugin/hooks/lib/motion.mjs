import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLUGIN_ROOT, sessionFile, toolName, toolArgs, workspaceOf } from './common.mjs';
import { SHELL_TOOLS, targetPaths } from './policy.mjs';

// The lit-typographic-motion done gate. A motion turn ends when the skill's own done-check says the film or cover is
// done, not when a command ran. PostToolUse remembers each `motion.mjs` command (subcommand, --out, --round) and each
// image file `read_file` opened; Stop runs engine/node/done.mjs on the last output folder. agy's PostToolUse payload
// carries the tool call and its error text but not the command's output, so the render's exit code is unknown here:
// a render that never produced its manifest reads as "no full render has finished", and the hold names that.
export const MOTION_ROUTE = 'lit-typographic-motion';
export const MOTION_MAX_HOLDS = 2;
const COMMAND = /\bmotion\.mjs["']?\s+(stage|make|cover-gate|cover|gate|sound|look|stills|sheet|video|perf)\b([^\n;&|]*)/;
const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const MAX_VIEWED = 2000;
const DONE_MODULE = join(PLUGIN_ROOT, 'skills', MOTION_ROUTE, 'engine', 'node', 'done.mjs');

const statePath = (payload) => sessionFile(payload)?.replace(/\.json$/, '.motion.json') ?? null;

function isLink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

export function readMotion(payload) {
  const file = statePath(payload);
  if (!file || !existsSync(file)) return null;
  try {
    const s = JSON.parse(readFileSync(file, 'utf8'));
    return s && Array.isArray(s.runs) && Array.isArray(s.viewed) ? s : null;
  } catch {
    return null;
  }
}

function writeMotion(payload, state) {
  const file = statePath(payload);
  if (!file || isLink(file) || isLink(dirname(file))) return state;
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, file);
  return state;
}

// Each motion prompt starts a fresh hold budget; the runs and the images opened earlier in the conversation stay.
export function armMotionTurn(payload, now = Date.now()) {
  const prev = readMotion(payload);
  return writeMotion(payload, { runs: prev?.runs ?? [], viewed: prev?.viewed ?? [], holds: 0, notified: false, promptAt: now });
}

const unquote = (v) => v?.replace(/^["']|["']$/g, '');

/** One `motion.mjs <mode> ...` command line as { mode, out, round, stillsOnly }, or null. */
export function parseMotionCommand(command, cwd) {
  const m = COMMAND.exec(String(command ?? ''));
  if (!m) return null;
  const tokens = [...m[2].matchAll(/"[^"]*"|'[^']*'|[^\s]+/g)].map((t) => unquote(t[0]));
  const values = {};
  const positional = [];
  let stillsOnly = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t === '--stills-only') stillsOnly = true;
    else if (t.startsWith('--')) {
      if (['--out', '--round', '--answers', '--blocked', '--window'].includes(t)) {
        values[t] = tokens[i + 1];
        i += 1;
      }
    } else if (!t.startsWith('>') && !t.startsWith('2>')) positional.push(t);
  }
  const abs = (p) => (p ? (isAbsolute(p) ? p : resolve(cwd, p)) : null);
  const mode = m[1];
  if (mode === 'gate') return { mode, out: abs(positional[0]), round: null, stillsOnly: false };
  // cover-gate checks a file; it is no render, so it never becomes the folder the gate judges.
  if (mode === 'cover-gate') return { mode, out: null, round: null, stillsOnly: false };
  const round = values['--round'] === undefined ? null : Number(values['--round']);
  // A window render is a diagnostic sheet; the full cover render is the one that counts.
  if (values['--window'] !== undefined) return { mode: 'cover-window', out: null, round, stillsOnly: false };
  return { mode, out: abs(values['--out']), round, stillsOnly };
}

/** PostToolUse while the motion route is active: remember renders and opened images. */
export function recordMotionTool(payload, now = Date.now()) {
  const tool = toolName(payload);
  const args = toolArgs(payload);
  const cwd = typeof args.Cwd === 'string' && isAbsolute(args.Cwd) ? args.Cwd : workspaceOf(payload);
  const state = readMotion(payload) ?? { runs: [], viewed: [], holds: 0, notified: false, promptAt: now };
  if (SHELL_TOOLS.has(tool)) {
    const parsed = parseMotionCommand(args.CommandLine, cwd);
    if (!parsed) return null;
    return writeMotion(payload, { ...state, runs: [...state.runs, { ...parsed, at: now }].slice(-12) });
  }
  if (/^(read_file|view_file)$/.test(tool)) {
    const path = targetPaths(args).find((p) => IMAGE.test(p));
    if (!path) return null;
    const abs = resolve(workspaceOf(payload), path);
    if (state.viewed.includes(abs)) return state;
    return writeMotion(payload, { ...state, viewed: [...state.viewed, abs].slice(-MAX_VIEWED) });
  }
  return null;
}

const notDone = (reasons) => `LitGravity lit-typographic-motion: the work is not done (${reasons.join('; ')}). Stop rendering now and say plainly in the reply that it is not done, why, and the command the user can run to finish it.`;

/** Stop while the motion route is active: { action: 'allow' | 'block', why, reason? }. */
export async function evaluateMotionStop(payload, now = Date.now()) {
  const state = readMotion(payload);
  if (!state) return { action: 'allow', why: 'no-motion-state' };
  if (state.notified) return { action: 'allow', why: 'notified' };
  const last = [...state.runs].reverse().find((r) => r.out) ?? null;
  let verdict;
  if (!last) verdict = { status: 'NOT_DONE', reasons: ['no render command ran under this route'], downgraded: [], openItems: [] };
  else {
    const { evaluateDone } = await import(pathToFileURL(DONE_MODULE).href);
    verdict = evaluateDone({ out: last.out, viewedFiles: new Set(state.viewed) });
  }
  if (verdict.status === 'DONE' || verdict.status === 'DONE_UNVIEWED') {
    const say = [
      ...(verdict.status === 'DONE_UNVIEWED' ? ['nobody looked at the frames (no image could be opened)'] : []),
      ...(verdict.labels ?? []),
      ...verdict.downgraded.map((d) => `downgraded: ${d}`),
      ...verdict.openItems.map((o) => `open item: ${o}`),
    ];
    if (!say.length) return { action: 'allow', why: 'done' };
    writeMotion(payload, { ...state, notified: true });
    return { action: 'block', why: verdict.status, reason: `LitGravity lit-typographic-motion: the render is finished. The reply must say plainly: ${say.join('; ')}.` };
  }
  if (state.holds >= MOTION_MAX_HOLDS) {
    writeMotion(payload, { ...state, notified: true });
    return { action: 'block', why: 'not-done-notice', reason: notDone(verdict.reasons) };
  }
  writeMotion(payload, { ...state, holds: state.holds + 1, lastHoldAt: now });
  const loop = verdict.mode === 'cover'
    ? 'Finish the loop in references/cover.md: render the cover, open the sheet, the poster and the seam pair with read_file, record the look round, and render again when a gate misses TARGET or a look answer asks for it.'
    : 'Finish the loop in references/look.md: render, open every listed still with read_file, record the look round, and render again when the gate or a look answer asks for it.';
  return { action: 'block', why: 'not-done', reason: `LitGravity lit-typographic-motion${verdict.mode === 'cover' ? ' (cover mode)' : ''} is not done: ${verdict.reasons.join('; ')}. ${loop}` };
}
