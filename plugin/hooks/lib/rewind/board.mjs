// The lit-adhd KPI board: the default face of the brief. Code decides everything on it (the one step to do now and
// what to type, four buckets, ten-cell bars, milestone rows, the done and remaining lists, the reminders), so the
// model prints it as given and a tired reader knows in ten seconds what to do, what is done, what is left and what
// not to forget. `buildBoard` returns language-neutral fields (kept in the collector JSON); `renderBoard` words them
// in Korean or English. The board never shows a conversation id, a commit hash, a raw status code or an internal
// path, except a command the reader types. The per-session detail stays in brief.mjs, drawn under the board on request.

import { basename } from 'node:path';

import { clipToWidth } from './gauge.mjs';
import { goalOf, holdOf, lastQuestion, placeOf, plain, suggestionOf } from './brief.mjs';

const CELLS = 10;
const DONE_MAX = 5;
const LEFT_MAX = 7;
const REMIND_MAX = 5;
const MILESTONE_ROWS = 4;
const STALE_DAYS = 7;
const known = (n) => Number.isInteger(n) && n >= 0;
const bare = (text) => String(text ?? '').replace(/\s+/gu, ' ').trim();

// Ten cells of █ and ░ with `k/n`; a partial count never rounds to an empty or a full bar. Null without a real total.
export const barText = (done, total) => {
  if (!known(done) || !known(total) || total === 0) return null;
  const k = Math.min(done, total);
  let filled = Math.round((k * CELLS) / total);
  if (k > 0 && k < total) filled = Math.min(CELLS - 1, Math.max(1, filled));
  return `${'█'.repeat(filled)}${'░'.repeat(CELLS - filled)} ${k}/${total}`;
};
const percentOf = (done, total) => {
  const p = Math.round((done * 100) / total);
  if (done > 0 && done < total) return Math.min(99, Math.max(1, p));
  return p;
};

// A plan's name for a reader: its `# ` heading, else the file name without date, extension or dashes.
const humanize = (path) => bare(basename(String(path ?? '')).replace(/\.md$/u, '').replace(/^\d{4}-\d{2}-\d{2}[-_]?/u, '').replace(/[-_]+/gu, ' ')) || 'plan';
const planName = (plan) => clipToWidth(bare(plan.title) || humanize(plan.plan), 50);
const nameFor = (data, path) => {
  const plan = (data.roadmap?.plans ?? []).find((p) => p.plan === path);
  return plan ? planName(plan) : humanize(path);
};

const RANK = { waiting: 0, progress: 1, todo: 2, done: 3 };

// Milestones: plans (checkbox rows), litgoal goals (criteria) and start-work runs whose plan was not read.
const milestonesOf = (data) => {
  const runs = (data.workflows ?? []).filter((f) => f.skill === 'start-work' && f.ref?.plan);
  const list = [];
  for (const plan of data.roadmap?.plans ?? []) {
    const rows = Array.isArray(plan.rows) ? plan.rows : null;
    const done = known(plan.progress?.done) ? plan.progress.done : rows ? rows.filter((r) => r.checked).length : null;
    const total = known(plan.progress?.total) ? plan.progress.total : rows ? rows.length : null;
    const run = runs.find((f) => f.ref.plan === plan.plan);
    const finished = plan.finished || (known(done) && known(total) && total > 0 && done >= total);
    const status = finished ? 'done' : run?.status === 'paused' ? 'waiting' : run || done > 0 ? 'progress' : 'todo';
    const open = rows ? rows.filter((r) => !r.checked).map((r) => r.title) : plan.progress?.remaining ?? (plan.current ? [plan.current] : []);
    const closed = rows ? rows.filter((r) => r.checked).map((r) => r.title) : [];
    list.push({ kind: 'plan', name: plan.local === false ? `${planName(plan)} (${basename(String(plan.worktree))})` : planName(plan), status, done, total, at: Number.isFinite(plan.mtime) ? plan.mtime : null, open, closed, run: run?.id8 ?? null });
  }
  for (const goal of data.roadmap?.litgoal ?? []) {
    const { done = null, total = null, remaining = [] } = goal.progress ?? {};
    const finished = goal.status === 'complete' || (known(done) && known(total) && total > 0 && done >= total);
    list.push({ kind: 'goal', name: clipToWidth(bare(goal.objective), 50), status: finished ? 'done' : done > 0 ? 'progress' : 'todo', done, total, at: null, open: finished ? [] : remaining ?? [], closed: [], run: null });
  }
  const shown = new Set(list.filter((m) => m.kind === 'plan').map((m) => m.run).filter(Boolean));
  for (const run of runs) {
    if (shown.has(run.id8) || (data.roadmap?.plans ?? []).some((p) => p.plan === run.ref.plan)) continue;
    const { done = null, total = null } = run.progress ?? {};
    list.push({ kind: 'run', name: humanize(run.ref.plan), status: run.status === 'paused' ? 'waiting' : 'progress', done, total, at: Date.parse(run.at) || null, open: [], closed: [], run: run.id8 });
  }
  return list.map((m, i) => ({ m, i })).sort((a, b) => RANK[a.m.status] - RANK[b.m.status] || a.i - b.i).map(({ m }) => m);
};

// Conversations that wait on the reader: another one that asked or paused, or this one with a paused route.
const waitingOf = (data) => {
  const paused = new Map((data.workflows ?? []).filter((f) => f.status === 'paused').map((f) => [f.id8, f]));
  return (data.sessions ?? []).filter((s) => s.status === 'waiting-on-user' && (!s.self || paused.has(s.id8))).map((s) => ({ session: s, paused: paused.get(s.id8) ?? null }));
};

// What to do now: the next-step record's choice when it runs on a typed word, the hold while lanes work, else the
// suggestion from the records, in the same order the detail brief uses.
const nowOf = (data) => {
  const next = data.next ?? { kind: 'none' };
  if (next.kind && next.kind !== 'none') {
    const target = next.target ?? {};
    return { kind: 'run', step: next.kind, say: next.say ?? null, args: { name: target.plan ? nameFor(data, target.plan) : null, skill: target.skill ?? null, stage: target.stage ?? null } };
  }
  const choice = next.held ? holdOf(data, next.held) : suggestionOf(data);
  const args = { ...choice.args };
  if (choice.kind === 'wait') args.name = nameFor(data, args.plan);
  if (choice.kind === 'plan') {
    args.name = planName(choice.plan);
    args.local = choice.plan.local !== false;
    args.folder = basename(String(choice.plan.worktree ?? ''));
    args.path = choice.plan.plan;
    args.running = (data.startWork ?? []).some((w) => ['active', 'paused'].includes(w.status));
  }
  delete args.id8;
  return { kind: next.held ? 'hold' : 'suggest', step: choice.kind, say: null, args };
};

export const buildBoard = (data) => {
  const now = Date.parse(data.generatedAt) || Date.now();
  const milestones = milestonesOf(data);
  const waiting = waitingOf(data);
  const counts = { done: 0, progress: 0, waiting: 0, todo: 0, total: 0 };
  for (const m of milestones) {
    counts.done += known(m.done) ? m.done : 0;
    m.open.forEach((_, i) => { counts[i === 0 && m.status !== 'todo' && m.status !== 'done' ? m.status : 'todo'] += 1; });
  }
  // A conversation waiting on the reader is one task, unless its paused run is already a waiting milestone.
  const waitingRuns = new Set(milestones.filter((m) => m.status === 'waiting' && m.run).map((m) => m.run));
  counts.waiting += waiting.filter((w) => !waitingRuns.has(w.session.id8)).length;
  counts.total = counts.done + counts.progress + counts.waiting + counts.todo;
  const overall = counts.total ? { done: counts.done, total: counts.total, percent: percentOf(counts.done, counts.total), bar: barText(counts.done, counts.total) } : null;

  // Done lately: finished runs first, then ticked rows, the newest plan first and its later rows first.
  const doneSessions = (data.sessions ?? []).filter((s) => s.status === 'done');
  const doneLately = [];
  for (const s of doneSessions) {
    const run = (data.workflows ?? []).find((f) => f.id8 === s.id8 && f.skill === 'start-work' && f.ref?.plan);
    doneLately.push({ kind: 'run', title: run ? nameFor(data, run.ref.plan) : clipToWidth(bare(goalOf(s)), 60) });
  }
  const byRecent = milestones.filter((m) => m.closed.length).sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  for (const m of byRecent) for (const title of [...m.closed].reverse()) doneLately.push({ kind: 'row', title: clipToWidth(bare(title), 60), of: m.name });

  const remaining = milestones.filter((m) => m.status !== 'done').flatMap((m) => m.open.map((title) => ({ title: clipToWidth(bare(title), 60), of: m.name })));
  const step = nowOf(data);

  const reminders = [];
  for (const { session, paused } of waiting) {
    const where = session.self ? null : bare(placeOf(session));
    reminders.push(paused ? { kind: 'paused', where, skill: paused.skill } : { kind: 'ask', where, question: lastQuestion(session.result, bare) });
  }
  for (const r of data.repo ?? []) {
    if (r.uncommitted > 0) reminders.push({ kind: 'uncommitted', n: r.uncommitted, tree: basename(String(r.worktree)) });
    if (r.unpushed > 0) reminders.push({ kind: 'unpushed', n: r.unpushed, tree: basename(String(r.worktree)) });
  }
  const working = (data.lanes?.count ?? 0) - (data.lanes?.waiting ?? 0);
  if (working > 0) reminders.push({ kind: 'lanes', n: working });
  for (const p of data.roadmap?.stale ?? []) if (p.days >= STALE_DAYS) reminders.push({ kind: 'stale', days: p.days, title: clipToWidth(bare(p.title), 50) });
  const handoff = (data.handoffs ?? []).find((h) => h.local && h.next);
  if (handoff && step.step !== 'handoff') reminders.push({ kind: 'handoff', file: bare(handoff.file), next: clipToWidth(bare(handoff.next), 60) });

  return {
    now: step,
    counts,
    overall,
    milestones: milestones.slice(0, milestones.length > MILESTONE_ROWS ? MILESTONE_ROWS - 1 : MILESTONE_ROWS).map(({ kind, name, status, done, total, at }) => ({ kind, name, status, done, total, bar: barText(done, total), ageMs: at === null ? null : Math.max(0, now - at) })),
    milestonesMore: milestones.length > MILESTONE_ROWS ? milestones.length - (MILESTONE_ROWS - 1) : 0,
    doneLately: doneLately.slice(0, DONE_MAX),
    remaining: remaining.slice(0, LEFT_MAX),
    remainingMore: Math.max(0, remaining.length - LEFT_MAX),
    reminders: reminders.slice(0, REMIND_MAX),
  };
};

const lanesEn = (n) => `${n} ${n === 1 ? 'lane' : 'lanes'}`;
const WORDS = {
  ko: {
    heads: ['## 🎯 지금 할 일', '## 📊 한눈에 보기', '## 🏁 마일스톤', '## ✅ 최근 끝낸 일', '## ⬜ 남은 일', '## 🔔 잊지 말 것'],
    buckets: { done: '✅ 끝남', progress: '🔄 진행 중', waiting: '⏳ 나를 기다림', todo: '⬜ 남음' },
    overall: '전체 진행',
    nothingCounted: '아직 셀 일이 없어요',
    msHead: ['마일스톤', '상태', '진행', '최근'],
    more: (n) => `…외 ${n}개`,
    empty: { milestones: '진행 중인 마일스톤이 없어요', done: '최근 끝낸 일이 없어요', left: '남은 일이 없어요', remind: '챙길 것이 없어요' },
    of: (title, of) => `${title} (${of})`,
    runDone: (title) => `${title} 실행을 끝냈어요`,
    ago: (ms) => {
      const m = Math.floor(ms / 60_000);
      if (m < 1) return '방금';
      if (m < 60) return `${m}분 전`;
      if (m < 48 * 60) return `${Math.floor(m / 60)}시간 전`;
      return `${Math.floor(m / 1440)}일 전`;
    },
    type: (text) => `👉 입력: \`${text}\``,
    now: {
      'start-plan': (a) => [`${a.name} 시작하기`, '열린 계획이 하나뿐이고 다른 일이 돌고 있지 않아요'],
      'continue-work': (a) => [`${a.name} 계속하기`, '이 대화의 start-work가 아직 진행 중이에요'],
      'resume-frame': (a) => [`${a.skill} 이어가기${a.stage && a.stage !== 'unknown' ? ` (${a.stage})` : ''}`, '이 대화에서 잠시 멈춘 작업이에요'],
      answer: (a) => [`${a.where} 대화의 질문에 답하기`, a.question ? `“${a.question}”` : '그 대화가 답을 기다려요', '👉 그 대화를 열고 답하기'],
      resume: (a) => (a.self
        ? [`${a.skill} 이어가기`, '이 대화에서 멈춘 작업이에요', '👉 입력: `lit continue`']
        : [`${a.where}에서 ${a.skill} 이어가기`, '멈춘 채 기다리고 있어요', '👉 그 대화에서 입력: `lit continue`']),
      plan: (a) => [a.item, `${a.name}의 다음 항목이에요`, a.running ? '👉 그 계획을 맡은 대화에서 이어 가기' : a.local ? `👉 입력: \`lit start ${a.path}\`` : `👉 ${a.folder} 폴더에서 입력: \`lit start ${a.path}\``],
      check: (a) => [`${a.where}에서 돌아가는 작업이 끝나길 기다리기`, a.goal, '👉 기다리기: 그 대화가 끝날 때까지'],
      handoff: (a) => [a.next, `${a.file}에 적힌 다음 할 일이에요`, '👉 이 일을 다음 요청으로 말하기'],
      pickUp: (a) => [`${a.where}의 지난 작업 이어받기`, a.goal, '👉 그 일을 다시 요청하기'],
      start: () => ['새로 시작할 일 정하기', '이 기간에 대화도 계획도 없어요', '👉 할 일을 말해 주세요'],
      answerPane: (a) => [`${a.pane} 창의 레인에 답하기`, '그 레인이 답을 기다려요', '👉 그 창을 열고 답하기'],
      wait: (a) => [`레인 ${a.lanes}개가 끝나면 ${a.name} 시작하기`, '지금 시작하면 다른 레인과 겹쳐요', `👉 기다리기: 레인 ${a.lanes}개가 끝날 때까지`],
      waitLanes: (a) => ['다른 레인이 끝날 때까지 기다리기', `작업 중인 레인 ${a.lanes}개`, `👉 기다리기: 레인 ${a.lanes}개가 끝날 때까지`],
    },
    remind: {
      ask: (r) => (r.where
        ? `⏳ ${r.where} 대화가 ${r.question ? `묻고 있어요: “${r.question}”` : '답을 기다려요'} → 그 대화를 열고 답하기`
        : `⏳ 이 대화가 ${r.question ? `묻고 있어요: “${r.question}”` : '답을 기다려요'} → 답하기`),
      paused: (r) => (r.where ? `⏳ ${r.where}에서 ${r.skill}이(가) 멈춰 있어요 → 그 대화에서 \`lit continue\` 입력` : `⏳ 이 대화의 ${r.skill}이(가) 멈춰 있어요 → \`lit continue\` 입력`),
      uncommitted: (r) => `💾 커밋 안 된 변경 ${r.n}개 (${r.tree}) → 확인하고 커밋하거나 되돌리기`,
      unpushed: (r) => `📤 푸시 안 된 커밋 ${r.n}개 (${r.tree}) → 확인하고 푸시할지 정하기`,
      lanes: (r) => `🏃 아직 일하는 레인 ${r.n}개 → 끝날 때까지 \`go\` 치지 않기`,
      stale: (r) => `🕰️ ${r.days}일째 멈춘 계획: ${r.title} → 이어 할지, 접을지 정하기`,
      handoff: (r) => `📝 ${r.file}의 다음 할 일: ${r.next} → 이어 하려면 이 일을 요청하기`,
    },
  },
  en: {
    heads: ['## 🎯 Do this now', '## 📊 At a glance', '## 🏁 Milestones', '## ✅ Done lately', '## ⬜ Still to do', "## 🔔 Don't forget"],
    buckets: { done: '✅ Done', progress: '🔄 In progress', waiting: '⏳ Waiting on you', todo: '⬜ Left' },
    overall: 'Overall',
    nothingCounted: 'nothing to count yet',
    msHead: ['Milestone', 'Status', 'Progress', 'Last'],
    more: (n) => `…and ${n} more`,
    empty: { milestones: 'No milestones yet', done: 'Nothing finished lately', left: 'Nothing left', remind: 'Nothing to remember' },
    of: (title, of) => `${title} (${of})`,
    runDone: (title) => `Finished the ${title} run`,
    ago: (ms) => {
      const m = Math.floor(ms / 60_000);
      if (m < 1) return 'just now';
      if (m < 60) return `${m}m ago`;
      if (m < 48 * 60) return `${Math.floor(m / 60)}h ago`;
      return `${Math.floor(m / 1440)}d ago`;
    },
    type: (text) => `👉 Type: \`${text}\``,
    now: {
      'start-plan': (a) => [`Start ${a.name}`, 'it is the only open plan and nothing else is running'],
      'continue-work': (a) => [`Keep going on ${a.name}`, "this conversation's start-work run is still open"],
      'resume-frame': (a) => [`Resume ${a.skill}${a.stage && a.stage !== 'unknown' ? ` at ${a.stage}` : ''}`, 'this conversation paused it'],
      answer: (a) => [`Answer the question in ${a.where}`, a.question ? `“${a.question}”` : 'that conversation is waiting for your reply', '👉 Open that conversation and reply'],
      resume: (a) => (a.self
        ? [`Resume ${a.skill}`, 'this conversation paused it', '👉 Type: `lit continue`']
        : [`Resume ${a.skill} in ${a.where}`, 'it is paused and waiting', '👉 In that conversation, type: `lit continue`']),
      plan: (a) => [a.item, `next step of ${a.name}`, a.running ? '👉 Carry on in the conversation running that plan' : a.local ? `👉 Type: \`lit start ${a.path}\`` : `👉 In ${a.folder}, type: \`lit start ${a.path}\``],
      check: (a) => [`Let the work in ${a.where} finish`, a.goal, '👉 Wait: until that conversation finishes'],
      handoff: (a) => [a.next, `next item in ${a.file}`, '👉 Ask for it as your next prompt'],
      pickUp: (a) => [`Pick up the earlier work in ${a.where}`, a.goal, '👉 Ask for it again to continue'],
      start: () => ['Choose what to start', 'no conversation or plan in this window', '👉 Say what to work on'],
      answerPane: (a) => [`Answer the lane in pane ${a.pane}`, 'it is waiting for you', '👉 Open that pane and reply'],
      wait: (a) => [`Start ${a.name} after ${lanesEn(a.lanes)} finish`, 'starting now would overlap them', `👉 Wait: until ${lanesEn(a.lanes)} finish`],
      waitLanes: (a) => ['Wait for the other lanes', `${lanesEn(a.lanes)} still working`, `👉 Wait: until ${lanesEn(a.lanes)} finish`],
    },
    remind: {
      ask: (r) => (r.where
        ? `⏳ The ${r.where} conversation ${r.question ? `asked: “${r.question}”` : 'waits for your reply'} → open it and answer`
        : `⏳ This conversation ${r.question ? `asked: “${r.question}”` : 'waits for your reply'} → answer it`),
      paused: (r) => (r.where ? `⏳ ${r.skill} is paused in ${r.where} → type \`lit continue\` there` : `⏳ ${r.skill} is paused here → type \`lit continue\``),
      uncommitted: (r) => `💾 ${r.n} uncommitted ${r.n === 1 ? 'change' : 'changes'} (${r.tree}) → review, then commit or revert`,
      unpushed: (r) => `📤 ${r.n} unpushed ${r.n === 1 ? 'commit' : 'commits'} (${r.tree}) → review and decide whether to push`,
      lanes: (r) => `🏃 ${lanesEn(r.n)} still working → do not type \`go\` until they finish`,
      stale: (r) => `🕰️ Plan untouched for ${r.days} days: ${r.title} → decide: resume it or drop it`,
      handoff: (r) => `📝 Next in ${r.file}: ${r.next} → ask for it to pick it up`,
    },
  },
};

// Every string from the records goes through `plain`, so a title cannot open a table cell, emphasis or a code span.
// A plan path is typed inside a code span, so it keeps its characters except a backtick.
const escapeArgs = (args) => Object.fromEntries(Object.entries(args ?? {}).map(([k, v]) => [k, typeof v !== 'string' ? v : k === 'path' ? v.replace(/`/gu, "'") : plain(v)]));
const nowLines = (now, w) => {
  const args = escapeArgs(now.args);
  const [action, why, typed] = w.now[now.step](args);
  const say = typed ?? (now.say ? w.type(now.say) : null);
  return [`**${action}** — ${why}`, ...(say ? [say] : [])];
};

const remindLine = (r, w) => `- ${w.remind[r.kind](escapeArgs(r))}`;

export const renderBoard = (data, { lang = 'en' } = {}) => {
  const w = WORDS[lang] ?? WORDS.en;
  const board = data.board ?? buildBoard(data);
  const [hNow, hGlance, hMiles, hDone, hLeft, hRemind] = w.heads;
  const c = board.counts;
  const out = [hNow, ...nowLines(board.now, w), ''];
  out.push(hGlance, `| ${['done', 'progress', 'waiting', 'todo'].map((k) => w.buckets[k]).join(' | ')} |`, '|:--:|:--:|:--:|:--:|', `| ${c.done} | ${c.progress} | ${c.waiting} | ${c.todo} |`, '');
  out.push(board.overall ? `${w.overall}  ${board.overall.bar.replace(' ', '  ')} (${board.overall.percent}%)` : `${w.overall}  ${w.nothingCounted}`, '');
  out.push(hMiles);
  if (board.milestones.length) {
    out.push(`| ${w.msHead.join(' | ')} |`, '|---|---|---|---|');
    for (const m of board.milestones) out.push(`| ${plain(m.name)} | ${w.buckets[m.status]} | ${m.bar ?? '·'} | ${m.ageMs === null ? '·' : w.ago(m.ageMs)} |`);
    if (board.milestonesMore) out.push(`| ${w.more(board.milestonesMore)} | | | |`);
  } else out.push(w.empty.milestones);
  out.push('', hDone);
  if (board.doneLately.length) for (const d of board.doneLately) out.push(`- ${d.kind === 'run' ? w.runDone(plain(d.title)) : w.of(plain(d.title), plain(d.of))}`);
  else out.push(w.empty.done);
  out.push('', hLeft);
  if (board.remaining.length) {
    board.remaining.forEach((r, i) => out.push(`${i + 1}. ${w.of(plain(r.title), plain(r.of))}`));
    if (board.remainingMore) out.push(w.more(board.remainingMore));
  } else out.push(w.empty.left);
  out.push('', hRemind);
  if (board.reminders.length) for (const r of board.reminders) out.push(remindLine(r, w));
  else out.push(w.empty.remind);
  return `${out.join('\n')}\n`;
};
