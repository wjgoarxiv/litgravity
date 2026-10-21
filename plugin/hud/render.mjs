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
};
export const BRAND_STOPS = [[255, 45, 149], [128, 137, 202], [0, 229, 255]];

const GLYPHS = {
  unicode: { fire: '🔥', mid: '·', sep: '│', head: '|', done: '✓', todo: '·', rail: '━', link: '─', now: '●', warn: '⚠', fail: '✗', reset: '↻', next: '▸', lane: '●', idle: '◌', ellipsis: '…', full: '█', empty: '░', partial: ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] },
  ascii: { fire: '', mid: '.', sep: '|', head: '|', done: '+', todo: '.', rail: '=', link: '-', now: '*', warn: '!', fail: 'x', reset: 'reset', next: '>', lane: '*', idle: '.', ellipsis: '~', full: '#', empty: '-', partial: null },
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

  const route = routeOf(input, env);
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
  }

  if (state === 'turn') segs.push({ id: 'attention', prio: 2, forms: [[sp(`${g.warn} your turn`, 'yellow', { b: true })], [sp(g.warn, 'yellow', { b: true })]] });
  if (state === 'error') segs.push({ id: 'attention', prio: 2, forms: [[sp(`${g.fail} error`, 'red', { b: true })], [sp(g.fail, 'red', { b: true })]] });

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

// Display order: the mark, model [effort], context, quota, then the route and its map, then the extras.
const ORDER = ['brand', 'model', 'ctx', 'quota', 'lit', 'attention', 'flow', 'cost', 'tasks', 'git', 'title'];

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

function paint(spans, depth) {
  let out = '';
  for (const s of spans) {
    if (s.brand !== undefined) { out += brandText(s.brand, depth); continue; }
    if (!s.t) continue;
    if (depth === 'plain') { out += s.t; continue; }
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
  const ctx = { g, env, now: opts.now ?? Date.now() };
  return paint(fit(segments(data, ctx), widthOf(data, env, opts.width), g), colorDepth(env));
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
