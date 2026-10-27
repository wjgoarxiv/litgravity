// Builds the LitGravity status line from the JSON agy pipes to the status line command and from LitGravity's own state:
// the route record the hooks keep per conversation, and the goal, plan, evidence and team files a lit route writes into
// the workspace. Pure apart from those reads and one cached `git status`; statusline.mjs owns stdin and stdout.
//
//   [🔥LIT v0.1.0] | GF3.8 [medium] │ ctx [█▎░] 42%/1049k │ quota [▌░]28% ↻ 2h5m │  🔥 LIT  · litwork 14:03 │
//     PIN ✓ ━ RED ✓ ━  GREEN  ━ VERIFY · ─ REVIEW · ─ RECORD · · goal 1/3 │ git feat/hud +3 ✓
//
// The look is the family's: the bold `[🔥LIT v…]` mark with L, I and T on the pink, violet, cyan gradient, then every
// segment in ONE product accent (LitGravity's flame orange, 255 99 55 from the v7 armory), `|` after the mark and `│`
// between segments, bracketed block gauges, model [effort] first, then context, then quota. Colour means something
// only in the warning bands (context and quota at 70% and 90%), the pink `🔥 LIT` chip and the current-stage chip.
//
// Only model and context_window were seen live on agy 1.4.3; quota, cost, vcs, agent_state, task_count and
// conversation_title come from agy's changelog and binary, so each one is optional and a field of the wrong type is
// skipped instead of printed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pluginVersion, sessionPath, stateRoot } from '../hooks/lib/common.mjs';
import { activePlan, openGoal, planRows } from '../hooks/lib/continuation.mjs';
import { readStack } from '../hooks/lib/workflow-stack.mjs';
import { readLanes } from '../hooks/lib/lanes.mjs';
import { listLive } from '../hooks/lib/liveness.mjs';
import { DONE_MS, REVIEW_LANES, ROUTE_LOOKS, lookOf } from './looks.mjs';

const IGNITION_MS = 90_000;
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

// The three workflow maps and where each route enters them. The loop map has six stops for the eight loop steps.
export const MAPS = {
  main: ['interview', 'plan', 'work', 'review', 'done'],
  research: ['decompose', 'wave', 'expand', 'verify', 'synthesis'],
  loop: ['PIN', 'RED', 'GREEN', 'VERIFY', 'REVIEW', 'RECORD'],
};
const ENTRY = {
  'deep-interview': ['main', 0], 'lit-brainstorm': ['main', 0], 'lit-crucible': ['main', 1], 'lit-plan': ['main', 1],
  'start-work': ['main', 2], litwork: ['main', 2], litgoal: ['main', 2], autoresearch: ['main', 2], 'review-work': ['main', 3],
  litresearch: ['research', 0], 'lit-loop': ['loop', 0],
};
const GOAL_ROUTES = new Set(['lit-loop', 'litwork', 'litgoal']);

// Colour roles. Truecolor gets the exact value where one is given; otherwise the 256-colour code, as the family line
// does for its body text; 16 colours take the basic code.
export const ROLES = {
  accent: { rgb: [255, 99, 55], c256: 202, c16: 33 },
  dim: { c256: 245, c16: 90 },
  empty: { c256: 238, c16: 90 },
  rail: { rgb: [70, 80, 92], c256: 240, c16: 90 },
  green: { c256: 71, c16: 32 },
  yellow: { c256: 178, c16: 33 },
  red: { c256: 167, c16: 31 },
  ink: { rgb: [11, 15, 20], c256: 233, c16: 30 },
  pink: { rgb: [255, 45, 149], c256: 198, c16: 35 },
  amber: { rgb: [255, 176, 32], c256: 214, c16: 33 },
  // One colour per review-work lane, in REVIEW_LANES order.
  lane1: { rgb: [0, 229, 255], c256: 51, c16: 36 },
  lane2: { rgb: [120, 220, 90], c256: 113, c16: 32 },
  lane3: { rgb: [170, 130, 255], c256: 141, c16: 35 },
  lane4: { rgb: [255, 110, 110], c256: 203, c16: 31 },
  lane5: { rgb: [90, 160, 255], c256: 75, c16: 34 },
};
export const BRAND_STOPS = [[255, 45, 149], [128, 137, 202], [0, 229, 255]];

const GLYPHS = {
  unicode: { fire: '🔥', mid: '·', sep: '│', head: '|', done: '✓', todo: '·', rail: '━', link: '─', now: '●', warn: '⚠', fail: '✗', reset: '↻', next: '▸', lane: '●', idle: '◌', ellipsis: '…', spark: '✦', full: '█', empty: '░', partial: ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] },
  ascii: { fire: '', mid: '.', sep: '|', head: '|', done: '+', todo: '.', rail: '=', link: '-', now: '*', warn: '!', fail: 'x', reset: 'reset', next: '>', lane: '*', idle: '.', ellipsis: '~', spark: '*', full: '#', empty: '-', partial: null },
};

export function colorDepth(env) {
  const forced = String(env.LITGRAVITY_HUD_COLOR ?? '').toLowerCase();
  if (Object.hasOwn(env, 'NO_COLOR') || /^dumb$/i.test(env.TERM ?? '') || ['0', 'off', 'none', 'plain'].includes(forced) || env.FORCE_COLOR === '0') return 'plain';
  if (['truecolor', '24bit', '256', '16'].includes(forced)) return forced === '24bit' ? 'truecolor' : forced;
  if (env.FORCE_COLOR === '3') return 'truecolor';
  if (env.FORCE_COLOR === '2') return '256';
  if (env.FORCE_COLOR === '1') return '16';
  if (/truecolor|24bit/i.test(env.COLORTERM ?? '') || /-direct|truecolor/i.test(env.TERM ?? '')) return 'truecolor';
  if (env.WT_SESSION || /^(iTerm\.app|WezTerm|ghostty|vscode|Hyper)$/i.test(env.TERM_PROGRAM ?? '')) return 'truecolor';
  return /256color/i.test(env.TERM ?? '') ? '256' : '16';
}

function sgr(role, depth, bg) {
  const r = ROLES[role];
  if (!r || depth === 'plain') return '';
  if (depth === 'truecolor' && r.rgb) return `${bg ? 48 : 38};2;${r.rgb.join(';')}`;
  if (depth === '16') return String(bg ? r.c16 + 10 - (r.c16 >= 90 ? 60 : 0) : r.c16);
  return `${bg ? 48 : 38};5;${r.c256}`;
}

// The mark: bold, the fire and the brackets in the terminal's own colour, L I T on the gradient, the version in its
// last stop. 256 colours make it bold magenta (201) and 16 colours bold cyan, as the family mark falls back.
function brandText(label, depth) {
  if (depth === 'plain') return label;
  if (depth === '256') return `\u001b[0m\u001b[1m\u001b[38;5;201m${label}\u001b[0m`;
  if (depth === '16') return `\u001b[0m\u001b[1m\u001b[36m${label}\u001b[0m`;
  const at = label.indexOf('LIT');
  const end = BRAND_STOPS[2].join(';');
  const letters = 'LIT'.split('').map((ch, i) => `\u001b[38;2;${BRAND_STOPS[i].join(';')}m${ch}`).join('');
  return `\u001b[0m\u001b[1m${label.slice(0, at)}${letters}\u001b[38;2;${end}m${label.slice(at + 3)}\u001b[0m`;
}

const ANSI = /\u001b\[[0-9;]*m/g;
// C0 and C1 controls (escape, bell, new line) and bidirectional overrides: host strings are data and never steer the line.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

function cellWidth(cp) {
  if (cp === 0x200d || (cp >= 0x300 && cp <= 0x36f) || (cp >= 0xfe00 && cp <= 0xfe0f)) return 0;
  if ((cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff)
    || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff)) return 2;
  return 1;
}

export function visibleWidth(text) {
  let w = 0;
  for (const ch of String(text).replace(ANSI, '')) w += cellWidth(ch.codePointAt(0));
  return w;
}

function clipCells(text, cells, ellipsis) {
  if (visibleWidth(text) <= cells) return text;
  let out = '';
  let w = 0;
  for (const ch of text) {
    const cw = cellWidth(ch.codePointAt(0));
    if (w + cw > cells - visibleWidth(ellipsis)) break;
    out += ch;
    w += cw;
  }
  return out + ellipsis;
}

const clean = (value, cells, g) => (typeof value === 'string' ? clipCells(value.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim(), cells, g.ellipsis) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

// The family's clock, m:ss and h:mm:ss past the hour.
function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// A reset countdown in the family's form: `↻ 2h5m`, `↻ 3d6h`, `↻ 45m`.
function resetIn(seconds) {
  const m = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d${h % 24}h`;
  if (h > 0) return `${h}h${m % 60}m`;
  return `${m}m`;
}

// A window of whole hundred-thousands over a million reads as 1m; any other size keeps its k count (1048576 is 1049k).
function windowSize(size) {
  if (size >= 1_000_000 && size % 100_000 === 0) return `${size / 1_000_000}m`;
  return `${Math.max(1, Math.round(size / 1000))}k`;
}

function modelOf(input) {
  const m = input.model;
  const name = typeof m === 'string' ? m : obj(m) ? (m.display_name ?? m.displayName ?? m.name ?? m.id) : null;
  if (typeof name !== 'string' || !name.trim()) return null;
  const raw = name.replace(UNSAFE, ' ');
  const n = /\d+(?:\.\d+)?/.exec(raw)?.[0] ?? '';
  let short;
  // One letter per family and the version, as the family line shortens its models: GF3.8, GP3.1, O4.6, S4.6.
  if (/gemini/i.test(raw)) short = `G${/lite/i.test(raw) ? 'L' : /pro/i.test(raw) ? 'P' : /flash/i.test(raw) ? 'F' : ''}${n}`;
  else if (/opus|sonnet|haiku/i.test(raw)) short = `${/opus/i.test(raw) ? 'O' : /sonnet/i.test(raw) ? 'S' : 'H'}${n}`;
  else if (/gpt-oss/i.test(raw)) short = `gpt-oss${/(\d+b)/i.exec(raw) ? `-${/(\d+b)/i.exec(raw)[1].toLowerCase()}` : ''}`;
  else short = raw.replace(/\([^)]*\)/g, '').trim();
  const effortField = input.effort ?? m?.effort ?? input.reasoning_effort;
  const fromField = typeof effortField === 'string' ? effortField : obj(effortField)?.level;
  const fromName = /\(([^)]+)\)/.exec(raw)?.[1] ?? /-(low|medium|high|xhigh|max)$/i.exec(String(m?.id ?? ''))?.[1];
  const effort = [fromField, fromName].map((e) => String(e ?? '').toLowerCase().trim()).find((e) => EFFORTS.has(e)) ?? null;
  return { short, effort, raw };
}

function contextOf(input) {
  const c = obj(input.context_window) ?? obj(input.contextWindow);
  if (!c) return null;
  let pct = num(c.used_percentage ?? c.usedPercentage);
  if (pct === null && num(c.remaining_percentage) !== null) pct = 100 - num(c.remaining_percentage);
  const size = num(c.context_window_size ?? c.contextWindowSize);
  if (pct === null) return null;
  return { pct: Math.max(0, Math.min(100, pct)), size: size && size > 0 ? size : null };
}

// agy's quota shape was never captured, so rows are read from an array, a `models` list or the object itself, and the
// row for the current model wins over the lowest one.
function quotaOf(input, model) {
  const q = input.quota;
  const rows = Array.isArray(q) ? q : obj(q) ? [q, ...(Array.isArray(q.models) ? q.models : []), ...Object.values(q).filter(obj)] : [];
  const read = rows.map((r) => {
    if (!obj(r)) return null;
    let left = num(r.remaining_percentage);
    if (left === null && num(r.remaining_fraction) !== null) left = num(r.remaining_fraction) * 100;
    if (left === null && num(r.used_percentage) !== null) left = 100 - num(r.used_percentage);
    if (left === null) return null;
    const label = [r.model, r.display_name, r.label, r.tier_display_name, r.name].find((v) => typeof v === 'string') ?? '';
    return { left: Math.max(0, Math.min(100, left)), reset: num(r.reset_in_seconds ?? r.refreshes_in_seconds), label };
  }).filter(Boolean);
  if (!rows.length || !read.length) return null;
  const tier = model ? /lite|flash|pro|opus|sonnet|haiku|gpt-oss/i.exec(model.raw)?.[0]?.toLowerCase() : null;
  return read.find((r) => tier && r.label.toLowerCase().includes(tier)) ?? read.reduce((a, b) => (b.left < a.left ? b : a));
}

function costOf(input) {
  const c = input.cost;
  const v = num(c) ?? (obj(c) ? num(c.total_cost_usd ?? c.total ?? c.usd ?? c.amount) : null);
  return v !== null && v >= 0 ? v : null;
}

function agentStateOf(input) {
  const s = input.agent_state;
  const v = (typeof s === 'string' ? s : typeof obj(s)?.state === 'string' ? s.state : '').toLowerCase();
  if (/waiting/.test(v)) return 'turn';
  if (/error|fail/.test(v)) return 'error';
  if (/run|work|think|generat|busy|stream/.test(v)) return 'live';
  return null;
}

const countOf = (v) => (Array.isArray(v) ? v.length : num(v) !== null && num(v) > 0 ? num(v) : 0);

function gitOf(input, dir, env, now) {
  const v = input.vcs;
  if (obj(v) && typeof v.branch === 'string' && v.branch.trim()) {
    const changes = countOf(v.modified) + countOf(v.staged) + countOf(v.untracked) + countOf(v.changes);
    return { branch: v.branch, changes, dirty: v.dirty === true || changes > 0, ahead: num(v.ahead) ?? 0, behind: num(v.behind) ?? 0 };
  }
  if (v !== undefined || !dir) return null;
  return gitStatusCached(dir, env, now);
}

// agy refreshes the line often and `git status` costs 20 to 40 ms in a mid-sized repository, so a result is reused for
// a few seconds from a small file beside the route state.
const GIT_TTL_MS = 5000;

const gitShape = (git) => (obj(git) && typeof git.branch === 'string'
  ? { branch: git.branch, changes: num(git.changes) ?? 0, dirty: git.dirty === true, ahead: num(git.ahead) ?? 0, behind: num(git.behind) ?? 0 }
  : null);

function gitStatusCached(dir, env, now) {
  const file = join(stateRoot(env), 'hud', `git-${createHash('sha256').update(dir).digest('hex').slice(0, 16)}.json`);
  try {
    const hit = JSON.parse(readFileSync(file, 'utf8'));
    if (Math.abs(now - hit.at) < GIT_TTL_MS) return gitShape(hit.git);
  } catch {
    // no cache yet
  }
  let git = null;
  try {
    const out = execFileSync('git', ['-C', dir, '--no-optional-locks', 'status', '--porcelain=v2', '--branch'], { encoding: 'utf8', timeout: 400, stdio: ['ignore', 'pipe', 'ignore'] });
    const head = /^# branch\.head (.+)$/m.exec(out)?.[1];
    const ab = /^# branch\.ab \+(\d+) -(\d+)$/m.exec(out);
    const changes = out.split('\n').filter((l) => l && !l.startsWith('#')).length;
    if (head && head !== '(detached)') git = { branch: head, changes, dirty: changes > 0, ahead: ab ? Number(ab[1]) : 0, behind: ab ? Number(ab[2]) : 0 };
  } catch {
    git = null;
  }
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.${process.pid}`, JSON.stringify({ at: now, git }));
    renameSync(`${file}.${process.pid}`, file);
  } catch {
    // a read-only state folder only costs the cache
  }
  return git;
}

function workspaceDirs(input) {
  const w = input.workspace;
  const dirs = [obj(w)?.project_dir, obj(w)?.current_dir, typeof w === 'string' ? w : null, ...(Array.isArray(input.workspace_paths) ? input.workspace_paths : []), input.cwd];
  return [...new Set(dirs.filter((d) => typeof d === 'string' && d.trim()))];
}

function routeOf(input, env) {
  const id = input.conversation_id ?? input.conversationId;
  for (const dir of workspaceDirs(input)) {
    const file = sessionPath(dir, id, env);
    if (!file || !existsSync(file)) continue;
    try {
      const state = JSON.parse(readFileSync(file, 'utf8'));
      if (obj(state) && typeof state.route === 'string' && state.route) return { state, dir, id };
    } catch {
      return null;
    }
  }
  return null;
}

function list(dir, limit = 400) {
  try {
    return readdirSync(dir).slice(0, limit);
  } catch {
    return [];
  }
}

// The open criterion's step comes from the evidence files the loop names `<id>-red.log`, `<id>-green.log`,
// `<id>-surface.*` and `<id>-cleanup.*` (`<id>-a<n>-…` from attempt 2), in the folders the goal record points at, else in
// every `.litgravity/evidence/` folder. The map has six stops, so SURFACE marks VERIFY done and CLEAN marks REVIEW done;
// a step counts as done once any later step has its file, and RECORD is current until the criterion passes.
function stageOf(goal, dir) {
  const crit = goal.open;
  const named = Array.isArray(crit?.evidence) ? crit.evidence.filter((p) => typeof p === 'string') : [];
  let folders = [...new Set(goal.paths.map((p) => join(dir, dirname(p))))];
  if (!folders.length) folders = list(join(dir, '.litgravity', 'evidence'), 50).map((d) => join(dir, '.litgravity', 'evidence', d));
  const files = [...named.map((p) => p.split('/').pop()), ...folders.flatMap((f) => list(f))];
  const attempt = num(crit.attempt) > 1 ? `-a${num(crit.attempt)}` : '';
  const id = String(crit.id ?? '').replace(/[^A-Za-z0-9_-]/g, '');
  const has = (kind) => Boolean(id) && files.some((f) => f.startsWith(`${id}${attempt}-${kind}.`));
  const proof = [files.some((f) => /^before\./.test(f)), has('red'), has('green'), has('surface'), has('cleanup')];
  const last = proof.lastIndexOf(true);
  return { current: Math.max(last + 1, 0), id };
}

function goalOf(route) {
  const payload = { conversationId: route.id, workspacePaths: [route.dir] };
  const goal = openGoal(payload, route.state, route.dir);
  if (!goal) return null;
  let paths = [];
  try {
    const rec = JSON.parse(readFileSync(join(route.dir, goal.path), 'utf8'));
    paths = rec.criteria.flatMap((c) => (Array.isArray(c?.evidence) ? c.evidence.filter((p) => typeof p === 'string' && !p.startsWith('ledger:')) : []));
  } catch {
    // the record was readable a moment ago; without the paths the stage falls back to the evidence folders
  }
  return { ...goal, paths, stage: stageOf({ ...goal, paths }, route.dir) };
}

function planOf(route) {
  const file = activePlan({ conversationId: route.id, workspacePaths: [route.dir] }, route.dir);
  if (!file) return null;
  try {
    const rows = planRows(readFileSync(join(route.dir, file), 'utf8'));
    if (!rows.length) return null;
    return { done: rows.filter((r) => r.done).length, total: rows.length, next: rows.find((r) => !r.done)?.id ?? null };
  } catch {
    return null;
  }
}

function teamOf(route) {
  const base = join(route.dir, '.litgravity', 'team');
  let best = null;
  for (const name of list(base, 40)) {
    const file = join(base, name, 'team.json');
    try {
      const team = JSON.parse(readFileSync(file, 'utf8'));
      if (team.status === 'archived' || !Array.isArray(team.members)) continue;
      const mtime = statSync(file).mtimeMs;
      if (!best || mtime > best.mtime) best = { mtime, members: team.members.filter(obj).map((m) => String(m.status ?? 'pending')) };
    } catch {
      // a packet being rewritten or a stray folder: skip it
    }
  }
  return best && best.members.length ? best.members : null;
}

// The goal record this conversation is bound to (the hooks saw it touch the record, or the record names it), newest
// first, with its write time.
function goalRecordOf(route) {
  const base = join(route.dir, '.litgravity', 'goals');
  const bound = typeof route.state.goalPath === 'string' ? route.state.goalPath.split('/').pop() : null;
  let best = null;
  for (const name of list(base, 40).filter((f) => f.endsWith('.json'))) {
    try {
      const rec = JSON.parse(readFileSync(join(base, name), 'utf8'));
      if (!obj(rec) || (name !== bound && rec.conversation_id !== route.id)) continue;
      const mtime = statSync(join(base, name)).mtimeMs;
      if (!best || mtime > best.mtime) best = { rec, mtime };
    } catch {
      // a record being rewritten: skip it
    }
  }
  return best;
}

// Why the session waits on the user, from what is on record: agy's own agent state, the reason the Stop hook saved
// when the turn ended, or a goal record that stopped on a decision or a blocker. null when nothing says so.
const GOAL_WAITS = { needs_user_decision: 'decision', blocked: 'BLOCKED', review_blocked: 'BLOCKED' };
function waitingOf(input, route) {
  const saved = route ? obj(route.state.waiting)?.reason : null;
  if (typeof saved === 'string' && saved) return saved;
  const goal = route ? GOAL_WAITS[goalRecordOf(route)?.rec.status] : null;
  if (goal) return goal;
  return agentStateOf(input) === 'turn' ? 'turn' : null;
}

// True for DONE_MS after a plan or goal of this route was finished: a plan under plans/ whose rows are all ticked, or
// the bound goal record set to done, written after the route started. An older finish never shows.
function doneOf(route, now) {
  const since = num(route.state.activatedAt) ?? now;
  const fresh = (t) => t >= since && now - t <= DONE_MS && t <= now + 1000;
  const goal = goalRecordOf(route);
  if (goal?.rec.status === 'done' && fresh(goal.mtime)) return true;
  const plans = join(route.dir, 'plans');
  for (const name of list(plans, 100).filter((f) => f.endsWith('.md'))) {
    try {
      const mtime = statSync(join(plans, name)).mtimeMs;
      if (!fresh(mtime)) continue;
      const rows = planRows(readFileSync(join(plans, name), 'utf8'));
      if (rows.length && rows.every((r) => r.done)) return true;
    } catch {
      // unreadable plan: no finish to show
    }
  }
  return false;
}

// The review-work lanes of the review folder written since the route started (`.litgravity/evidence/<slug>/review/`),
// each with the verdict its `lane-N-<name>.md` reports, or null while it has not reported. null before any folder.
function reviewLanesOf(route) {
  const since = num(route.state.activatedAt) ?? 0;
  const base = join(route.dir, '.litgravity', 'evidence');
  let best = null;
  for (const slug of list(base, 50)) {
    const dir = join(base, slug, 'review');
    try {
      const mtime = statSync(dir).mtimeMs;
      if (mtime >= since - 1000 && (!best || mtime > best.mtime)) best = { dir, mtime };
    } catch {
      // no review folder under this slug
    }
  }
  if (!best) return null;
  const files = list(best.dir, 200);
  return REVIEW_LANES.map((name, i) => {
    const file = files.find((f) => f === `lane-${i + 1}-${name}.md`);
    if (!file) return { name, verdict: null };
    try {
      const head = readFileSync(join(best.dir, file), 'utf8').slice(0, 2048);
      return { name, verdict: /^verdict:\s*(PASS|FAIL|BLOCKED)\b/im.exec(head)?.[1]?.toUpperCase() ?? null };
    } catch {
      return { name, verdict: null };
    }
  });
}

function lanesSegment(lanes, g) {
  const sp = (t, role, extra = {}) => ({ t, role, ...extra });
  const glyph = { PASS: g.done, FAIL: g.fail, BLOCKED: g.warn };
  const reported = lanes.filter((l) => l.verdict).length;
  const count = sp(` ${reported}/${lanes.length}`, 'accent', { b: true });
  const named = lanes.flatMap((l, i) => [
    ...(i ? [sp(' ', 'dim')] : []),
    l.verdict ? sp(l.name, `lane${i + 1}`, { b: true }) : sp(l.name, 'empty'),
    sp(` ${l.verdict ? glyph[l.verdict] : g.todo}`, l.verdict ? `lane${i + 1}` : 'empty'),
  ]);
  const blocks = lanes.map((l, i) => (l.verdict ? sp(g.full, `lane${i + 1}`) : sp(g.empty, 'empty')));
  return { id: 'lanes', prio: 4, forms: [[...named, count], [...blocks, count], [count]] };
}

// A segment is a list of forms, richest first; a form is a list of spans { t, fg, bg, b }. `keep` marks the brand,
// which shrinks but never goes.

// A segment is a list of forms, richest first; a form is a list of spans { t, role, bg, b } (or { brand } for the
// mark). `keep` marks the mark, which shrinks but never goes.
function segments(input, ctx) {
  const { g, now, env } = ctx;
  const segs = [];
  const sp = (t, role = 'accent', extra = {}) => ({ t, role, ...extra });
  const version = pluginVersion();
  segs.push({ id: 'brand', prio: 0, keep: true, forms: [[{ brand: `[${g.fire}LIT v${version}]` }], [{ brand: `[${g.fire}LIT]` }]] });

  const model = modelOf(input);
  if (model) {
    const short = clean(model.short, 18, g);
    segs.push({ id: 'model', prio: 5, forms: [[sp(short), ...(model.effort ? [sp(` [${model.effort}]`)] : [])], [sp(short)]] });
  }

  const c = contextOf(input);
  if (c) {
    const pct = Math.round(c.pct);
    const band = bandOf(pct, 'accent');
    const size = c.size ? `/${windowSize(c.size)}` : '';
    segs.push({ id: 'ctx', prio: 3, forms: [
      [sp('ctx '), sp('['), ...blockBar(pct, 3, band, g), sp(']'), sp(` ${pct}%${size}`, band)],
      [sp('ctx '), sp(`${pct}%${size}`, band)],
      [sp('ctx '), sp(`${pct}%`, band)],
    ] });
  }

  const quota = quotaOf(input, model);
  if (quota) {
    const used = Math.round(100 - quota.left);
    const band = bandOf(used, 'green');
    const reset = quota.reset && quota.reset > 0 ? [sp(` ${g.reset} ${resetIn(quota.reset)}`)] : [];
    segs.push({ id: 'quota', prio: 6, forms: [
      [sp('quota '), sp('['), ...blockBar(used, 2, band, g), sp(']'), sp(`${used}%`, band), ...reset],
      [sp('quota '), sp('['), ...blockBar(used, 2, band, g), sp(']'), sp(`${used}%`, band)],
      [sp('quota '), sp(`${used}%`, band)],
    ] });
  }

  const { route, waiting, done } = ctx;
  const state = agentStateOf(input);
  if (route) {
    const name = clean(route.state.route, 24, g);
    const at = num(route.state.activatedAt);
    const timer = at !== null && now >= at ? [sp(` ${clock(now - at)}`, 'dim')] : [];
    const live = state === 'live' ? [sp(` ${g.now}`, 'accent', { b: true })] : [];
    const chip = g.fire ? sp(` ${g.fire} LIT `, 'ink', { bg: 'pink', b: true }) : sp('[LIT]', 'pink', { b: true });
    const forms = [];
    if (route.state.lastKind === 'ignite' && at !== null && now - at < IGNITION_MS) {
      forms.push([chip, sp(` IGNITED ${g.mid} ${name}${g.fire ? ` ${g.fire}` : ''}`, 'accent', { b: true })]);
    }
    forms.push([chip, sp(` ${g.mid} `, 'dim'), sp(name, 'accent', { b: true }), ...timer, ...live], [chip, sp(` ${g.mid} `, 'dim'), sp(name, 'accent', { b: true })], [sp(name, 'accent', { b: true })]);
    segs.push({ id: 'lit', prio: 1, forms });
    const flow = flowSegment(route, ctx);
    if (flow) segs.push(flow);
    const threads = threadSegment(route, ctx);
    if (threads) segs.push(threads);
    const lanes = ROUTE_LOOKS[route.state.route] === 'review' ? reviewLanesOf(route) : null;
    if (lanes) segs.push(lanesSegment(lanes, g));
  }

  if (waiting) {
    const why = waiting === 'turn' || waiting === 'asked' ? '' : ` ${g.mid} ${clean(waiting, 12, g)}`;
    segs.push({ id: 'attention', prio: 2, forms: [[sp(`${g.warn} YOUR TURN${why}`, 'amber', { b: true })], [sp(`${g.warn} YOUR TURN`, 'amber', { b: true })], [sp(g.warn, 'amber', { b: true })]] });
  } else if (done) {
    segs.push({ id: 'attention', prio: 2, forms: [[sp(`${g.spark} DONE ${g.spark}`, 'green', { b: true })], [sp('DONE', 'green', { b: true })]] });
  }
  if (state === 'error') segs.push({ id: 'attention', prio: 2, forms: [[sp(`${g.fail} error`, 'red', { b: true })], [sp(g.fail, 'red', { b: true })]] });

  const others = othersSegment(input, ctx);
  if (others) segs.push(others);

  const cost = costOf(input);
  if (cost !== null) segs.push({ id: 'cost', prio: 9, forms: [[sp(`$${cost < 10 ? cost.toFixed(2) : cost.toFixed(1)}`)]] });

  const tasks = num(input.task_count);
  if (tasks !== null && tasks > 0) segs.push({ id: 'tasks', prio: 8, forms: [[sp(`bg ${Math.round(tasks)}`)]] });

  const git = gitOf(input, workspaceDirs(input).at(-1) ?? null, env, now);
  if (git) {
    const sync = `${git.ahead > 0 ? `↑${git.ahead}` : ''}${git.behind > 0 ? `↓${git.behind}` : ''}`;
    const mark = g === GLYPHS.ascii ? sync.replace(/↑/g, '+').replace(/↓/g, '-') : sync;
    const text = `git ${clean(git.branch, 28, g)}${git.changes > 0 ? ` +${git.changes}` : ''} ${mark || g.done}`;
    segs.push({ id: 'git', prio: 7, forms: [[sp(text)], [sp(`git ${clean(git.branch, 14, g)}`)]] });
  }

  const title = clean(input.conversation_title, 28, g);
  if (title) segs.push({ id: 'title', prio: 10, forms: [[sp(title)]] });
  return segs;
}

// Below 70% the gauge keeps its own colour; 70% turns it yellow and 90% red, as the family gauges do.
const bandOf = (pct, calm) => (pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : calm);

function blockBar(pct, cells, role, g) {
  const p = Math.max(0, Math.min(100, pct));
  if (!g.partial) {
    const filled = Math.round((p / 100) * cells);
    return [{ t: g.full.repeat(filled), role }, { t: g.empty.repeat(cells - filled), role: 'empty' }];
  }
  const exact = (p * cells) / 100;
  const full = Math.floor(exact);
  const part = full < cells && exact > full ? Math.max(1, Math.min(7, Math.round((exact - full) * 8))) : 0;
  return [{ t: g.full.repeat(full) + g.partial[part], role }, { t: g.empty.repeat(cells - full - (part ? 1 : 0)), role: 'empty' }];
}

// The route's place on its map, drawn as the family card draws it: done stops dim with a check, the current stop a
// filled chip in the accent, the stops ahead dim with a dot; accent `━` rails into done and current stops, a grey `━`
// leaving the current stop, grey `─` further ahead.
function mapForms(labels, current, detail, g) {
  const ascii = g === GLYPHS.ascii;
  const short = (l) => l.replace(/^[A-Za-z]+/, (w) => w.slice(0, 3));
  const stop = (label, i, cut) => {
    const text = cut ? short(label) : label;
    if (i === current) return ascii ? { t: `[${text}]`, role: 'accent', b: true } : { t: ` ${text} `, role: 'ink', bg: 'accent', b: true };
    return { t: `${text} ${i < current ? g.done : g.todo}`, role: 'dim' };
  };
  const track = ({ rail, cut = false, window = false }) => {
    const shown = labels.map((_, i) => i).filter((i) => !window || Math.abs(i - Math.min(current, labels.length - 1)) <= 1);
    const out = [];
    if (window && shown[0] > 0) out.push({ t: `${g.ellipsis} `, role: 'dim' });
    shown.forEach((i, k) => {
      if (k) out.push(rail ? { t: ` ${i <= current + 1 ? g.rail : g.link} `, role: i <= current ? 'accent' : 'rail' } : { t: ' ' });
      out.push(stop(labels[i], i, cut));
    });
    if (window && shown.at(-1) < labels.length - 1) out.push({ t: ` ${g.ellipsis}`, role: 'dim' });
    return out;
  };
  const variants = [{ rail: true }, { rail: false }, { rail: false, cut: true }, { rail: false, cut: true, window: true }];
  return [...variants.map((v, i) => (i < 2 ? [...track(v), ...detail] : track(v))), [stop(labels[Math.min(current, labels.length - 1)], current, false)]];
}

function flowSegment(route, ctx) {
  const { g } = ctx;
  const r = route.state.route;
  const sp = (t, role = 'accent', extra = {}) => ({ t, role, ...extra });
  if (r === 'lit-team') {
    const members = teamOf(route);
    if (!members) return null;
    const tone = { reported: 'dim', active: 'green', pending: 'dim', blocked: 'red' };
    const glyph = { reported: g.done, active: g.lane, pending: g.idle, blocked: g.fail };
    const dots = members.slice(0, 8).map((s) => sp(glyph[s] ?? g.idle, tone[s] ?? 'dim'));
    const live = members.filter((s) => s === 'active').length;
    const settled = members.filter((s) => s === 'reported').length;
    return { id: 'flow', prio: 4, forms: [[...dots, sp(` ${live} ${live === 1 ? 'lane' : 'lanes'} ${g.mid} ${settled}/${members.length} reported`, 'dim')], [...dots, sp(` ${live} ${live === 1 ? 'lane' : 'lanes'}`, 'dim')]] };
  }
  const goal = GOAL_ROUTES.has(r) ? goalOf(route) : null;
  if (goal) {
    const detail = [sp('  goal ', 'dim'), sp(`${goal.pass}/${goal.total}`, 'accent', { b: true })];
    return { id: 'flow', prio: 4, forms: mapForms(MAPS.loop, goal.stage.current, detail, g) };
  }
  const entry = ENTRY[r];
  if (!entry) return null;
  const [family, at] = entry;
  const labels = [...MAPS[family]];
  let detail = [];
  if (r === 'start-work') {
    const plan = planOf(route);
    if (plan) {
      labels[at] = `${labels[at]} ${plan.done}/${plan.total}`;
      if (plan.next) detail = [sp(`  next ${g.next} ${plan.next}`, 'dim')];
    }
  }
  return { id: 'flow', prio: 4, forms: mapForms(labels, at, detail, g) };
}

// Count chain for the top frame: recorded n/total -> plan checkboxes -> goal criteria -> steps N -> null.
// A count appears only when both numbers are real. When only the done count is known, show "N steps".
// Returns null when there is nothing to show.
function topCount(route, top) {
  if (Number.isInteger(top?.n) && Number.isInteger(top?.total)) return `${top.n}/${top.total}`;
  // Plan-ref hand-off: the plan ref from a finished predecessor carries to the successor.
  const ref = top?.ref?.plan;
  if (ref) {
    try {
      const rows = planRows(readFileSync(join(route.dir, ref), 'utf8'));
      if (rows.length) return `${rows.filter((r) => r.done).length}/${rows.length}`;
    } catch { /* plan unreadable */ }
  }
  const goal = GOAL_ROUTES.has(route.state.route) ? openGoal({ conversationId: route.id, workspacePaths: [route.dir] }, route.state, route.dir) : null;
  if (goal) return `${goal.pass}/${goal.total}`;
  if (Number.isInteger(top?.n) && top.n > 0) return `${top.n} steps`;
  return null;
}

function threadSegment(route, ctx) {
  const { env, now } = ctx;
  const sp = (t, role = 'accent', extra = {}) => ({ t, role, ...extra });
  const dir = workspaceDirs({ workspace: route.dir, cwd: route.dir })[0];
  if (!dir) return null;
  const stack = readStack(dir, route.id, env);
  const lanes = readLanes(dir, route.id, env, now);
  const activeLanes = lanes.filter((l) => l.status === 'active');
  const paused = stack ? stack.frames.filter((f) => f.status === 'paused') : [];
  if ((!stack || stack.frames.length < 2) && !activeLanes.length) return null;
  const top = stack?.frames.at(-1);
  const count = topCount(route, top);
  const parts = [];
  if (count) parts.push(sp(count, 'accent'));
  if (activeLanes.length > 0) {
    parts.push(sp(`${count ? ' ' : ''}+${activeLanes.length} ${activeLanes.length === 1 ? 'lane' : 'lanes'}`, 'dim'));
  } else if (paused.length > 0) {
    parts.push(sp(`${count ? ' ' : ''}+${paused.length} paused`, 'dim'));
  }
  if (!parts.length) return null;
  const short = activeLanes.length > 0
    ? [sp(`+${activeLanes.length} ${activeLanes.length === 1 ? 'lane' : 'lanes'}`, 'dim')]
    : paused.length > 0 ? [sp(`+${paused.length} paused`, 'dim')] : [];
  return { id: 'threads', prio: 5, forms: [parts, short.length ? short : parts] };
}

// A start-work in another conversation whose plan is all ticked: shown as done for this long after its last hook event.
const FINISHED_MS = 60_000;

function finishedWork(dir, id, env) {
  try {
    const state = JSON.parse(readFileSync(sessionPath(dir, id, env), 'utf8'));
    if (state?.route !== 'start-work') return false;
    const plan = activePlan({ conversationId: id, workspacePaths: [dir] }, dir);
    const rows = plan ? planRows(readFileSync(join(dir, plan), 'utf8')) : [];
    return rows.length > 0 && rows.every((r) => r.done);
  } catch {
    return false;
  }
}

// The other conversations of this workspace, from their liveness records: `+N running · M idle`, and `K done` for a
// start-work that finished in the last minute. One row has room for counts only; a lone other session still shows.
function othersSegment(input, ctx) {
  const { g, env, now } = ctx;
  const self = input.conversation_id ?? input.conversationId;
  const dir = workspaceDirs(input)[0];
  const probe = dir ? sessionPath(dir, 'probe', env) : null;
  if (!probe) return null;
  const counts = { running: 0, idle: 0, done: 0 };
  for (const rec of listLive(dirname(probe), now)) {
    if (rec.id === self || rec.state === 'ended') continue;
    if (finishedWork(dir, rec.id, env)) {
      if (now - Date.parse(rec.at) <= FINISHED_MS) counts.done += 1;
    } else {
      counts[rec.state === 'alive' ? 'running' : 'idle'] += 1;
    }
  }
  const parts = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
  if (!parts.length) return null;
  const total = counts.running + counts.idle + counts.done;
  const sp = (t) => ({ t, role: 'dim' });
  return { id: 'others', prio: 6, forms: [[sp(`+${parts.join(` ${g.mid} `)}`)], [sp(`+${total} other${total === 1 ? '' : 's'}`)], [sp(`+${total}`)]] };
}

// Display order: the mark, model [effort], context, quota, then the route and its map, then the extras.
const ORDER = ['brand', 'model', 'ctx', 'quota', 'lit', 'attention', 'flow', 'lanes', 'threads', 'others', 'cost', 'tasks', 'git', 'title'];

function layout(segs, pick, g) {
  const shown = ORDER.flatMap((id) => segs.filter((s) => s.id === id && pick.get(s) !== null));
  const spans = [];
  shown.forEach((s, i) => {
    if (i === 1) spans.push({ t: ` ${g.head} `, role: 'accent' });
    else if (i > 1) spans.push({ t: ` ${g.sep} `, role: 'accent' });
    spans.push(...s.forms[pick.get(s)]);
  });
  return spans;
}

const spanText = (s) => s.brand ?? s.t;
const spanWidth = (spans) => spans.reduce((w, s) => w + visibleWidth(spanText(s)), 0);

// Three passes, most important first. The core segments (mark, route, attention, context, map, model) that fit at
// their shortest form are kept; each then grows to the richest form the width allows, the mark's version after the
// others; the extras (quota, git, tasks, cost, title) fill what is left. A narrow terminal loses the title long before
// the route or the context gauge.
const CORE_PRIO = 5;

function fit(segs, width, g) {
  const pick = new Map(segs.map((s) => [s, null]));
  const fits = () => spanWidth(layout(segs, pick, g)) <= width;
  const byImportance = [...segs].sort((a, b) => a.prio - b.prio);
  const core = byImportance.filter((s) => s.prio <= CORE_PRIO);
  for (const s of core) {
    pick.set(s, s.forms.length - 1);
    if (!fits() && !s.keep) pick.set(s, null);
  }
  const grow = (s, from, richest = 0) => {
    for (let f = richest; f < from; f += 1) {
      const was = pick.get(s);
      pick.set(s, f);
      if (fits()) return;
      pick.set(s, was);
    }
  };
  const mark = core.filter((x) => x.keep);
  for (const s of core.filter((x) => !x.keep)) if (pick.get(s) !== null) grow(s, pick.get(s));
  for (const s of mark) grow(s, pick.get(s));
  for (const s of byImportance.filter((x) => x.prio > CORE_PRIO)) grow(s, s.forms.length);
  const spans = layout(segs, pick, g);
  if (spanWidth(spans) <= width) return spans;
  const out = [];
  let left = width;
  for (const s of spans) {
    const text = spanText(s);
    const w = visibleWidth(text);
    if (w <= left) { out.push(s); left -= w; continue; }
    out.push({ ...s, brand: undefined, t: clipCells(text, Math.max(left, 1), g.ellipsis) });
    break;
  }
  return out;
}

// The lit-adhd rainbow: every cell of the line takes its own step round the colour wheel, pills
// included (their ground turns, lightened so the dark ink keeps 4.5:1), and the whole wheel moves one
// step per 10-second bucket, so a repaint inside a bucket is identical and nothing flashes. Only the
// colour of fixed glyphs changes; widths and text are those of the plain line. NO_COLOR is the plain
// depth and gets no escape at all.
const RAINBOW_STEP = 15;
const RAINBOW_BUCKET_MS = 10_000;
const RAINBOW_INK = [20, 20, 24];
const BASIC_HUES = [31, 33, 32, 36, 34, 35];

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0; let g = 0; let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const cube = ([r, g, b]) => 16 + 36 * Math.round(r / 255 * 5) + 6 * Math.round(g / 255 * 5) + Math.round(b / 255 * 5);

function rainbowCode(rgb, depth, ground, hue) {
  if (depth === 'truecolor') return `${ground ? 48 : 38};2;${rgb.join(';')}`;
  if (depth === '256') return `${ground ? 48 : 38};5;${cube(rgb)}`;
  return String(BASIC_HUES[Math.floor(hue / 60) % BASIC_HUES.length] + (ground ? 10 : 0));
}

function rainbowSpan(s, depth, state) {
  let out = '';
  for (const ch of s.t) {
    const cell = state.cell++;
    if (ch === ' ' && !s.bg) { out += ch; continue; }
    const hue = (cell * RAINBOW_STEP + state.bucket * RAINBOW_STEP * 2) % 360;
    const codes = [s.b ? '1' : ''];
    if (s.bg) {
      codes.push(rainbowCode(RAINBOW_INK, depth, false, 0), rainbowCode(hslToRgb(hue, 0.8, 0.72), depth, true, hue));
    } else {
      codes.push(rainbowCode(hslToRgb(hue, 0.8, 0.65), depth, false, hue));
    }
    out += `\u001b[${codes.filter(Boolean).join(';')}m${ch}`;
  }
  return out ? `${out}\u001b[0m` : out;
}

// The YOUR TURN paint: every coloured span and every pill ground turns amber, so the row reads as one waiting state;
// dim text, rails, red and the dark pill ink keep their colours. It is static.
const AMBER_KEEPS = new Set(['dim', 'empty', 'rail', 'red', 'ink']);
const amberSpan = (s) => ({ ...s, role: s.role && !AMBER_KEEPS.has(s.role) ? 'amber' : s.role, bg: s.bg ? 'amber' : s.bg });

function paint(spans, depth, rainbow = null, amber = false) {
  let out = '';
  const state = rainbow ? { cell: 0, bucket: Math.floor((rainbow.now ?? Date.now()) / RAINBOW_BUCKET_MS) } : null;
  for (const span of spans) {
    if (span.brand !== undefined) { out += brandText(span.brand, depth); if (state) state.cell += visibleWidth(span.brand); continue; }
    if (!span.t) continue;
    if (depth === 'plain') { out += span.t; continue; }
    if (state) { out += rainbowSpan(span, depth, state); continue; }
    const s = amber ? amberSpan(span) : span;
    const codes = [s.b ? '1' : '', s.role ? sgr(s.role, depth, false) : '', s.bg ? sgr(s.bg, depth, true) : ''].filter(Boolean);
    out += codes.length ? `\u001b[${codes.join(';')}m${s.t}\u001b[0m` : s.t;
  }
  return out;
}

function widthOf(input, env, override) {
  const w = num(override) ?? num(input.width) ?? num(input.terminal_width) ?? num(obj(input.terminal)?.columns) ?? num(env.COLUMNS);
  return w && w >= 10 ? Math.floor(w) : 120;
}

const asciiOnly = (env) => env.LITGRAVITY_HUD_ASCII === '1' || /^dumb$/i.test(env.TERM ?? '');

/** One status line, without the trailing newline. `opts.now` and `opts.width` exist for tests. */
export function renderStatus(input, opts = {}) {
  const env = opts.env ?? process.env;
  const data = obj(input) ?? {};
  const g = asciiOnly(env) ? GLYPHS.ascii : GLYPHS.unicode;
  const now = opts.now ?? Date.now();
  const depth = colorDepth(env);
  const route = routeOf(data, env);
  const waiting = waitingOf(data, route);
  const done = route ? doneOf(route, now) : false;
  const look = lookOf({ route: route?.state.route ?? null, waiting, done });
  const ctx = { g, env, now, route, waiting, done };
  const rainbow = look === 'rewind' && depth !== 'plain' ? { now } : null;
  return paint(fit(segments(data, ctx), widthOf(data, env, opts.width), g), depth, rainbow, look === 'your-turn');
}

/** The line printed when anything above throws: the mark alone, never an error. */
export function fallbackLine(env = process.env) {
  let version = '';
  try {
    version = ` v${pluginVersion()}`;
  } catch {
    // keep the bare mark
  }
  return `[${asciiOnly(env) ? '' : '🔥'}LIT${version}]`;
}
