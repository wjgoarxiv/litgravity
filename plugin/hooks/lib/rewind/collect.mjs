// The lit-adhd record collector. Reads what is on disk for the workspace (agy transcripts, plans,
// litgoal, handoff headings, git log, workflow stacks) and returns one redacted, capped JSON brief.
// A source that is not there reads `unknown`; nothing is inferred.

import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

import { planRows } from '../continuation.mjs';
import { sessionPath, stateRoot } from '../common.mjs';
import { aggregateProgress, clipToWidth, progressOf } from './gauge.mjs';
import { renderBrief } from './brief.mjs';
import { chooseNextStep, writeNextStep } from './next-step.mjs';
import { makeRedactor } from './redact.mjs';
import { findTranscripts, makeBudget, readTranscriptLines, sessionRecord } from './transcripts.mjs';
import { listLive } from '../liveness.mjs';

const SMALL_FILE_BYTES = 1024 * 1024;
const GIT_TIMEOUT_MS = 5000;
const DEFAULT_SINCE = '7d';
const DEFAULT_MAX = 12;
const NAME_MAX = 90;
const PLAN_LIMIT = 8;

export const parseSince = (text) => {
  const match = /^(\d{1,4})([dhm])$/u.exec(String(text ?? ''));
  if (!match) return null;
  return Number(match[1]) * { d: 86_400_000, h: 3_600_000, m: 60_000 }[match[2]];
};

const readSmallFile = (path, budget) => {
  let fd;
  try {
    if (!lstatSync(path).isFile()) return null;
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const { size } = fstatSync(fd);
    const length = Math.min(size, SMALL_FILE_BYTES, budget.limit - budget.used);
    if (length < size) budget.exhausted = budget.exhausted || length < Math.min(size, SMALL_FILE_BYTES);
    const buffer = Buffer.alloc(Math.max(0, length));
    const read = length > 0 ? readSync(fd, buffer, 0, length, 0) : 0;
    budget.used += read;
    return buffer.subarray(0, read).toString('utf8');
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
};

const readJson = (path, budget) => {
  const text = readSmallFile(path, budget);
  if (text === null) return null;
  try { return JSON.parse(text); } catch { return null; }
};

const entries = (directory) => {
  try { return readdirSync(directory, { withFileTypes: true }); } catch { return null; }
};

const defaultExec = (file, args, options) => execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...options });

const worktreesOf = (cwd, exec) => {
  try {
    const out = exec('git', ['worktree', 'list', '--porcelain'], { cwd, timeout: GIT_TIMEOUT_MS });
    const paths = out.split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9).trim()).filter(Boolean);
    return paths.length ? paths : null;
  } catch {
    return null;
  }
};

// A plan scaffold nobody filled in: a row still holding a `<placeholder>`, or every row the same.
const isTemplate = (rows) => rows.some((r) => /<[^<>]{1,40}>/u.test(r.title)) || (rows.length > 1 && new Set(rows.map((r) => r.title.trim())).size === 1);

// `skipped.count` grows by one per Markdown file under plans/ that is no plan: unreadable, without task rows, an
// unfilled scaffold, or a name with a control character.
const plansIn = (root, budget, redact, local, skipped) => {
  const list = entries(join(root, 'plans'));
  if (!list) return null;
  const markdown = list.filter((e) => e.isFile() && e.name.endsWith('.md'));
  // A name with a control character could carry its own lines into the brief or the `go` note; skip it.
  const named = markdown.filter((e) => !/[\p{Cc}\p{Cf}]/u.test(e.name));
  skipped.count += markdown.length - named.length;
  return named.sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => {
    const text = readSmallFile(join(root, 'plans', e.name), budget);
    const rows = text === null ? [] : planRows(text);
    if (!rows.length || isTemplate(rows)) {
      skipped.count += 1;
      return [];
    }
    const open = rows.filter((r) => !r.done);
    const done = rows.length - open.length;
    let mtime = null;
    try { mtime = statSync(join(root, 'plans', e.name)).mtimeMs; } catch { /* skip */ }
    return [{
      worktree: redact(root), plan: `plans/${e.name}`, local,
      rows: rows.map((r) => ({ checked: r.done, title: clipToWidth(redact(r.title), NAME_MAX) })),
      current: open.length ? clipToWidth(redact(open[0].title), NAME_MAX) : null,
      finished: open.length === 0,
      mtime,
      progress: progressOf(done, rows.length, open.map((r) => clipToWidth(redact(r.title), NAME_MAX))),
    }];
  });
};

const litgoalOf = (root, budget, redact) => {
  const goals = readJson(join(root, '.litgravity', 'goals', 'active.json'), budget);
  if (!goals || !Array.isArray(goals.criteria)) return null;
  const passed = goals.criteria.filter((c) => c?.status === 'pass');
  const remaining = goals.criteria.filter((c) => c?.status !== 'pass').map((c) => clipToWidth(redact(String(c?.text ?? c?.id ?? 'unknown')), NAME_MAX));
  return {
    worktree: redact(root), status: typeof goals.status === 'string' ? goals.status : 'unknown',
    objective: clipToWidth(redact(String(goals.objective ?? 'unknown').split('\n')[0]), 120),
    progress: progressOf(passed.length, goals.criteria.length, remaining),
  };
};

// The first item under a handoff's `## Next` heading, without its list marker, or null.
const nextOfHandoff = (text) => {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => /^#{2,3}\s+Next\b/iu.test(l));
  if (at === -1) return null;
  for (const line of lines.slice(at + 1)) {
    if (/^#{1,6} /u.test(line)) return null;
    const item = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/u, '').replace(/^\s*-\s*\[[ xX]\]\s*/u, '').trim();
    if (item) return item;
  }
  return null;
};

const handoffsOf = (root, budget, redact, local) => (entries(root) ?? [])
  .filter((e) => e.isFile() && /^HANDOFF.*\.md$/u.test(e.name))
  .map((e) => {
    const text = readSmallFile(join(root, e.name), budget) ?? '';
    const headings = text.split('\n').slice(0, 40).filter((l) => /^#{1,3} /u.test(l)).map((l) => clipToWidth(redact(l), 100));
    const next = nextOfHandoff(text);
    return { worktree: redact(root), file: e.name, headings, local, next: next ? clipToWidth(redact(next), 100) : null };
  });

const branchOf = (root, exec) => {
  try {
    return exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, timeout: GIT_TIMEOUT_MS }).trim() || null;
  } catch {
    return null;
  }
};

const commitsOf = (root, sinceMs, now, exec, redact) => {
  try {
    const since = new Date(now - sinceMs).toISOString();
    const branch = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, timeout: GIT_TIMEOUT_MS }).trim();
    const out = exec('git', ['log', `--since=${since}`, '--max-count=20', '--format=%H%x09%cI%x09%s'], { cwd: root, timeout: GIT_TIMEOUT_MS });
    return out.split('\n').filter(Boolean).map((line) => {
      const [hash, at, ...subject] = line.split('\t');
      return { worktree: redact(root), branch: redact(branch), hash: hash.slice(0, 7), at, atMs: Date.parse(at), subject: clipToWidth(redact(subject.join('\t')), 100) };
    });
  } catch {
    return null;
  }
};

const stacksOf = (stateDir, budget, redact) => {
  if (!stateDir) return null;
  const list = entries(stateDir);
  if (!list) return null;
  return list.filter((e) => e.isFile() && e.name.endsWith('.stack.json')).flatMap((e) => {
    const stack = readJson(join(stateDir, e.name), budget);
    if (!stack || !Array.isArray(stack.frames)) return [];
    return stack.frames.slice(0, 3).map((frame) => ({
      sessionId: typeof stack.sessionId === 'string' ? stack.sessionId : null,
      id8: typeof stack.sessionId === 'string' ? stack.sessionId.slice(0, 8) : 'unknown',
      skill: typeof frame.skill === 'string' ? redact(frame.skill) : 'unknown',
      stage: typeof frame.stage === 'string' ? redact(frame.stage) : 'unknown',
      role: frame.role === 'spine' ? 'spine' : 'side',
      status: frame.status === 'paused' ? 'paused' : 'active',
      at: typeof frame.at === 'string' ? frame.at : 'unknown',
      progress: progressOf(frame.n, frame.total, undefined),
      ...(frame.ref?.plan ? { ref: { plan: redact(frame.ref.plan) } } : {}),
    }));
  });
};

const known = (list) => (list === null ? 'unknown' : 'ok');
const statusRank = { 'waiting-on-user': 0, active: 1, idle: 2, done: 3, ended: 4, unknown: 5 };

export const collectRewind = ({
  cwd = process.cwd(),
  here = false,
  since = DEFAULT_SINCE,
  max = DEFAULT_MAX,
  sessionId = null,
  env = process.env,
  now = Date.now(),
  exec = defaultExec,
  record = true,
} = {}) => {
  const home = env.HOME || homedir();
  const redact = makeRedactor({ env, home });
  const budget = makeBudget();
  const sinceMs = parseSince(since) ?? parseSince(DEFAULT_SINCE);
  const limit = Number.isInteger(max) && max > 0 ? Math.min(max, 50) : DEFAULT_MAX;
  const start = resolve(cwd);
  const listed = here ? null : worktreesOf(start, exec);
  const roots = [...new Set([start, ...(here ? [] : listed ?? [])])];

  // Which conversations belong to this workspace: the route-state folder of each root (worktree) lists them by id.
  const stateDirs = roots.map((r) => ({ root: r, dir: dirname(sessionPath(r, 'x', env)) }));
  const owner = new Map();
  for (const { root: r, dir } of stateDirs) {
    for (const e of entries(dir) ?? []) {
      const m = /^([A-Za-z0-9._:-]{1,160})\.json$/.exec(e.name);
      if (e.isFile() && m && !/\.(?:snapshot|stack|motion|live)$/.test(m[1]) && !owner.has(m[1])) owner.set(m[1], r);
    }
  }
  // Plans, goals, handoffs and stacks are small and come first, so long transcripts cannot use up the read budget
  // before them.
  const collectEach = (read) => {
    const results = roots.map(read);
    return results.every((v) => v === null) ? null : results.flatMap((v) => v ?? []);
  };
  const skipped = { count: 0 };
  const plans = collectEach((r) => plansIn(r, budget, redact, resolve(r) === start, skipped));
  const litgoal = collectEach((r) => {
    const goal = litgoalOf(r, budget, redact);
    return goal ? [{ ...goal, local: resolve(r) === start }] : null;
  });
  const handoffs = roots.flatMap((r) => handoffsOf(r, budget, redact, resolve(r) === start));
  const stackLists = stateDirs.map(({ dir }) => stacksOf(dir, budget, redact));
  const workflows = stackLists.every((v) => v === null) ? null : stackLists.flatMap((v) => v ?? []);
  const liveness = new Map(stateDirs.flatMap(({ dir }) => listLive(dir, now).map((r) => [r.id, r.state])));
  // A conversation whose start-work frame names a plan with every row ticked is done.
  const finishedPlans = new Set((plans ?? []).filter((p) => p.finished).map((p) => `${p.worktree}\u0000${p.plan}`));
  const finishedIn = (id, root) => (workflows ?? []).some((f) => f.sessionId === id && f.ref?.plan && finishedPlans.has(`${redact(root)}\u0000${f.ref.plan}`));

  const geminiDir = join(home, '.gemini', 'antigravity-cli');
  const transcripts = owner.size ? findTranscripts(geminiDir, [...owner.keys()]) : { status: 'unknown', files: [] };
  const sessions = [];
  for (const { id, path } of transcripts.files) {
    if (sessions.length >= limit || budget.exhausted) break;
    const lines = readTranscriptLines(path, budget);
    const session = lines ? sessionRecord(lines, { redact, now, cwd: owner.get(id), live: liveness.get(id) ?? null, finished: finishedIn(id, owner.get(id)) }) : null;
    if (!session || (session.lastMs !== null && now - session.lastMs > sinceMs)) continue;
    session.sessionId = id;
    session.id8 = id.slice(0, 8);
    session.root = owner.get(id);
    if (here && resolve(session.cwd).normalize('NFC') !== start.normalize('NFC')) continue;
    sessions.push(session);
  }

  const commits = collectEach((r) => commitsOf(r, sinceMs, now, exec, redact));
  const branches = new Map(roots.map((r) => [r, branchOf(r, exec)]));

  for (const session of sessions) {
    const frames = (workflows ?? []).filter((f) => f.sessionId === session.sessionId);
    const top = frames.at(-1);
    if (frames.some((f) => f.status === 'paused') && session.status !== 'waiting-on-user') {
      session.status = 'waiting-on-user';
      session.waitingReason = 'paused workflow';
    }
    session.progress = top?.progress ?? progressOf(null, null);
    const branch = branches.get(session.root);
    if (branch) session.branch = redact(branch);
    session.done.commits = (commits ?? [])
      .filter((c) => session.lastMs !== null && Date.parse(session.started) <= c.atMs && c.atMs <= session.lastMs + 5 * 60_000)
      .slice(0, 5)
      .map(({ hash, subject }) => ({ hash, subject }));
  }
  sessions.sort((a, b) => statusRank[a.status] - statusRank[b.status] || (b.lastMs ?? 0) - (a.lastMs ?? 0));

  // Plans changed inside the window, this folder's first, newest first; a plan nobody touched lately is history,
  // and so is a finished plan of another folder. This folder's finished plans count as done.
  const recent = (p) => p.mtime !== null && now - p.mtime <= sinceMs && (p.local || !p.finished);
  const orderedPlans = (plans ?? []).filter(recent).sort((a, b) => Number(b.local) - Number(a.local) || (b.mtime ?? 0) - (a.mtime ?? 0));
  const shownPlans = orderedPlans.slice(0, PLAN_LIMIT);
  const localGoals = (litgoal ?? []).filter((g) => g.local);
  const roadmapItems = [...orderedPlans.filter((p) => p.local).map((p) => p.progress), ...localGoals.map((g) => g.progress)];
  const data = {
    version: 1,
    generatedAt: new Date(now).toISOString(),
    scope: { here, since: sinceMs === parseSince(since) ? since : DEFAULT_SINCE, max: limit, worktrees: roots.map(redact) },
    sources: {
      transcripts: transcripts.status,
      litgoal: known(litgoal),
      plans: known(plans),
      handoffs: handoffs.length ? 'ok' : 'unknown',
      git: known(commits),
      workflowStack: known(workflows),
    },
    budget: { bytesRead: budget.used, limit: budget.limit, exhausted: budget.exhausted },
    summary: {
      sessions: sessions.length,
      waitingOnUser: sessions.filter((s) => s.status === 'waiting-on-user').length,
      active: sessions.filter((s) => s.status === 'active').length,
    },
    sessions: sessions.map(({ cwd: _cwd, lastMs: _lastMs, root: _root, sessionId: id, ...rest }) => ({ ...rest, self: Boolean(sessionId) && id === sessionId })),
    roadmap: {
      plans: shownPlans,
      plansOmitted: orderedPlans.length - shownPlans.length,
      plansSkipped: skipped.count,
      // Another folder's finished objective is history.
      litgoal: (litgoal ?? []).filter((g) => g.local || g.status !== 'complete'),
      progress: roadmapItems.length ? aggregateProgress(roadmapItems) : progressOf(null, null),
    },
    workflows: (workflows ?? []).map((f) => ({ ...f, self: Boolean(sessionId) && f.sessionId === sessionId })),
    // A start-work run is a start-work frame on a workflow stack; agy keeps no other record of one.
    startWork: (workflows ?? []).filter((f) => f.skill === 'start-work').map((f) => ({ sessionId: f.sessionId, status: f.status, plan: f.ref?.plan ?? null })),
    handoffs,
    commits: (commits ?? []).slice(0, 20).map(({ atMs: _atMs, ...c }) => c),
  };
  const next = chooseNextStep(data, sessionId);
  data.next = next;
  data.nextRecorded = false;
  if (record && sessionId) {
    try {
      // The same root PreInvocation hands takeNextStep, so `go` finds what this brief offered.
      writeNextStep(stateRoot(env), sessionId, next, new Date(now));
      data.nextRecorded = true;
    } catch {
      data.nextRecorded = false;
    }
  }
  for (const f of data.workflows) delete f.sessionId;
  for (const w of data.startWork) delete w.sessionId;
  return data;
};

// The brief as Markdown (brief.mjs). `width` sizes the next-step box.
export const renderRewind = (data, { lang = 'en', width = 72 } = {}) => renderBrief(data, { lang, width: Math.max(40, Math.min(width, 100)) });

export const runRewindCli = (args, cwd = process.cwd(), { env = process.env, stdout = process.stdout, stderr = process.stderr } = {}) => {
  const options = { cwd, env, here: false, since: DEFAULT_SINCE, max: DEFAULT_MAX, sessionId: null };
  let json = false;
  let lang = 'en';
  let width = Math.min(Number(stdout.columns) || 72, 72);
  const usage = 'Usage: rewind.mjs [--brief|--json] [--lang en|ko] [--here] [--since 7d] [--max 12] [--session <id>] [--width N]';
  if (args.some((a) => a === '--help' || a === '-h')) {
    stdout.write(`${usage}\n`);
    return 0;
  }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') json = true;
    else if (arg === '--brief') json = false;
    else if (arg === '--lang' && ['en', 'ko'].includes(args[i + 1])) lang = args[++i];
    else if (arg === '--here') options.here = true;
    else if (arg === '--since' && parseSince(args[i + 1])) options.since = args[++i];
    else if (arg === '--max' && /^\d{1,2}$/u.test(args[i + 1] ?? '')) options.max = Number(args[++i]);
    else if (arg === '--session' && /^[A-Za-z0-9._:-]{1,160}$/u.test(args[i + 1] ?? '')) options.sessionId = args[++i];
    else if (arg === '--width' && /^\d{2,3}$/u.test(args[i + 1] ?? '')) width = Number(args[++i]);
    else {
      stderr.write(`rewind: unknown argument ${JSON.stringify(basename(String(arg)))}. ${usage}\n`);
      return 64;
    }
  }
  const data = collectRewind(options);
  stdout.write(json ? `${JSON.stringify(data, null, 2)}\n` : renderRewind(data, { lang, width }));
  return 0;
};
