// The lit-adhd brief, drawn by code from the collector's data so the model only copies it and a
// tired reader finds every part in the same place each time. Markdown, because agy's chat pane
// renders headings, bold, quotes, tables and code blocks: a headline, a card per live session grouped
// by folder and branch, a table of ended sessions, the roadmap timeline and one boxed next step.
// Every string in `data` is already redacted and clipped; this file adds layout and words, never a
// number the data does not hold, and never a question-mark gauge.

import { basename } from 'node:path';

import { clipToWidth, displayWidth } from './gauge.mjs';

const WORDS = {
  en: {
    sessions: (n) => `${n} ${n === 1 ? 'session' : 'sessions'}`,
    waiting: (n) => `${n} ${n === 1 ? 'waits' : 'wait'} on you`,
    active: (n) => `${n} active`,
    window: (since, trees) => `last ${since} · ${trees} ${trees === 1 ? 'folder' : 'folders'} read`,
    badge: { 'waiting-on-user': '🟠 **WAITING ON YOU**', active: '🟢 **ACTIVE**', idle: '💤 idle', done: '✅ **DONE**', ended: '⚪ ended', unknown: '⚫ unknown' },
    doneSoFar: 'Done so far',
    doingNow: 'Doing now',
    plansFinished: (n) => `${n} ${n === 1 ? 'plan' : 'plans'} finished`,
    sessionsDone: (n) => `${n} ${n === 1 ? 'session' : 'sessions'} done`,
    nothingDone: 'nothing finished in this window',
    nothingRunning: 'nothing running',
    plansSkipped: (n) => `${n} plan ${n === 1 ? 'file' : 'files'} skipped (no task rows or an unfilled scaffold).`,
    reason: { 'asked the user': 'it asked you something', 'paused workflow': 'a paused route' },
    ago: (text) => `${text} ago`,
    justNow: 'just now',
    self: 'this conversation',
    worked: (d) => `${d} of work`,
    lastAsk: (text) => `last ask: “${text}”`,
    done: 'Done',
    nextLabel: 'Next',
    noneDone: 'no file writes or commits on record',
    toolsUsed: (list) => `no writes yet; used ${list}`,
    files: 'wrote',
    commits: (n) => `${n} ${n === 1 ? 'commit' : 'commits'}`,
    answer: (q) => (q ? `answer: “${q}”` : 'answer its question'),
    resume: (skill, stage) => `resume ${skill} at ${stage} (\`lit continue\`)`,
    doing: (what) => `now: ${what}`,
    working: 'working',
    nothing: 'nothing open',
    endedTitle: (n) => `Ended · ${n}`,
    endedHead: ['id', 'where', 'goal', 'ago', 'done'],
    moreEnded: (n) => `…and ${n} more ended`,
    roadmap: 'Roadmap',
    now: 'now',
    later: 'later',
    plansOmitted: (n) => `…${n} more open ${n === 1 ? 'plan' : 'plans'}`,
    noRoadmap: 'no open plan, goal or commit in this window',
    recommended: 'RECOMMENDED NEXT STEP',
    type: 'type',
    step: {
      'resume-frame': ({ skill, stage }) => `Resume ${skill} at ${stage}`,
      'continue-work': ({ plan }) => `Keep going on ${plan}`,
      'start-plan': ({ plan }) => `Start ${plan} with start-work`,
    },
    suggest: {
      answer: ({ id8, where, question }) => `Answer ${id8} in ${where}${question ? `: “${question}”` : ''}`,
      resume: ({ id8, skill, stage, where }) => `Resume ${skill} at ${stage} in ${id8} (${where})`,
      plan: ({ plan, item }) => `Next in ${plan}: ${item}`,
      check: ({ id8, goal, where, doing }) => `Check on ${id8} in ${where} (${goal})${doing ? `, now ${doing}` : ''}`,
      pickUp: ({ id8, goal, where }) => `Pick up ${id8} in ${where}: ${goal}`,
      handoff: ({ file, next }) => `From ${file}: ${next}`,
      start: () => 'No conversation or plan in this window: say what to start',
    },
    hold: {
      wait: ({ lanes, plan }) => `Wait for ${lanes} ${lanes === 1 ? 'lane' : 'lanes'} to finish, then start ${plan}`,
      waitLanes: ({ lanes }) => `Wait for ${lanes} ${lanes === 1 ? 'lane' : 'lanes'} to finish`,
      answerPane: ({ pane }) => `Answer the lane waiting on you in pane ${pane}`,
    },
    holdGo: 'Do not type `go` until they finish.',
    goLine: (say) => `Type **\`${say}\`** to continue.`,
    noGo: 'Nothing runs on its own here: open that conversation, or say what to do.',
    unknownSources: (list) => `Not read: ${list}.`,
    older: 'Older conversations were not read (read budget used up).',
    noSessions: 'No agy conversation of this workspace in this window.',
    units: { d: 'd', h: 'h', m: 'm' },
  },
  ko: {
    sessions: (n) => `세션 ${n}개`,
    waiting: (n) => `나를 기다리는 것 ${n}`,
    active: (n) => `진행 중 ${n}`,
    window: (since, trees) => `최근 ${since} · 폴더 ${trees}곳 읽음`,
    badge: { 'waiting-on-user': '🟠 **나를 기다림**', active: '🟢 **진행 중**', idle: '💤 쉬는 중', done: '✅ **완료**', ended: '⚪ 끝남', unknown: '⚫ 알 수 없음' },
    doneSoFar: '지금까지 한 일',
    doingNow: '지금 하는 일',
    plansFinished: (n) => `끝난 계획 ${n}개`,
    sessionsDone: (n) => `끝난 세션 ${n}개`,
    nothingDone: '이 기간에 끝난 일 없음',
    nothingRunning: '진행 중인 일 없음',
    plansSkipped: (n) => `계획 파일 ${n}개는 건너뜀(작업 행이 없거나 채우지 않은 틀).`,
    reason: { 'asked the user': '질문하고 기다림', 'paused workflow': '멈춘 라우트' },
    ago: (text) => `${text} 전`,
    justNow: '방금',
    self: '이 대화',
    worked: (d) => `${d} 작업`,
    lastAsk: (text) => `마지막 요청: “${text}”`,
    done: '한 일',
    nextLabel: '다음',
    noneDone: '기록된 파일 쓰기·커밋 없음',
    toolsUsed: (list) => `아직 쓰기 없음, 쓴 도구 ${list}`,
    files: '씀',
    commits: (n) => `커밋 ${n}개`,
    answer: (q) => (q ? `답하기: “${q}”` : '질문에 답하기'),
    resume: (skill, stage) => `${skill}(${stage}) 이어가기 (\`lit continue\`)`,
    doing: (what) => `지금: ${what}`,
    working: '작업 중',
    nothing: '열린 일 없음',
    endedTitle: (n) => `끝난 세션 · ${n}`,
    endedHead: ['id', '위치', '목표', '경과', '한 일'],
    moreEnded: (n) => `…끝난 세션 ${n}개 더`,
    roadmap: '로드맵',
    now: '지금',
    later: '나중',
    plansOmitted: (n) => `…열린 계획 ${n}개 더`,
    noRoadmap: '이 기간에 열린 계획·목표·커밋 없음',
    recommended: '추천 다음 단계',
    type: '입력',
    step: {
      'resume-frame': ({ skill, stage }) => `${skill}(${stage}) 이어가기`,
      'continue-work': ({ plan }) => `${plan} 계속 진행`,
      'start-plan': ({ plan }) => `${plan}을 start-work로 시작`,
    },
    suggest: {
      answer: ({ id8, where, question }) => `${where}의 ${id8}에 답하기${question ? `: “${question}”` : ''}`,
      resume: ({ id8, skill, stage, where }) => `${where}의 ${id8}에서 ${skill}(${stage}) 이어가기`,
      plan: ({ plan, item }) => `${plan} 다음 항목: ${item}`,
      check: ({ id8, goal, where, doing }) => `${where}의 ${id8} 확인 (${goal})${doing ? `, 지금 ${doing}` : ''}`,
      pickUp: ({ id8, goal, where }) => `${where}의 ${id8} 이어받기: ${goal}`,
      handoff: ({ file, next }) => `${file}에서: ${next}`,
      start: () => '이 기간에 대화·계획이 없습니다. 시작할 일을 말해 주세요',
    },
    hold: {
      wait: ({ lanes, plan }) => `작업 중인 레인 ${lanes}개가 끝나면 ${plan} 시작`,
      waitLanes: ({ lanes }) => `작업 중인 레인 ${lanes}개가 끝날 때까지 기다리기`,
      answerPane: ({ pane }) => `${pane} 창에서 나를 기다리는 레인에 답하기`,
    },
    holdGo: '지금은 `go`는 입력하지 마세요.',
    goLine: (say) => `**\`${say}\`** 라고 입력하면 이어갑니다.`,
    noGo: '저절로 실행되는 단계는 아닙니다. 그 대화를 열거나 할 일을 말해 주세요.',
    unknownSources: (list) => `읽지 못함: ${list}.`,
    older: '오래된 대화는 읽지 않았습니다(읽기 예산 소진).',
    noSessions: '이 기간에 이 작업 공간의 agy 대화가 없습니다.',
    units: { d: '일', h: '시간', m: '분' },
  },
};

const bare = (text) => String(text ?? '').replace(/\s+/gu, ' ').trim();
// Inline text from the records: no HTML, no code ticks, no table or emphasis syntax.
const plain = (text) => bare(text).replace(/[<>`]/gu, (ch) => ({ '<': '‹', '>': '›', '`': "'" }[ch])).replace(/[*_|[\]\\]/gu, (ch) => `\\${ch}`);
const code = (text) => `\`${bare(text).replace(/`/gu, "'")}\``;
const placeOf = (session) => (session.worktree && session.worktree !== 'unknown' ? basename(String(session.worktree)) : 'unknown');
const goalOf = (session) => (session.title && session.title !== 'unknown' ? session.title : session.asked?.[0] ?? 'unknown');

// The largest unit only, so a table cell never wraps: `14h`, `3d`, `20m`.
const age = (iso, now, w) => {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return w.justNow;
  if (minutes < 60) return `${minutes}${w.units.m}`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)}${w.units.h}`;
  return `${Math.floor(minutes / 1440)}${w.units.d}`;
};
const span = (session, w) => {
  const ms = Date.parse(session.last) - Date.parse(session.started);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}${w.units.h} ${minutes % 60}${w.units.m}` : `${minutes}${w.units.m}`;
};
const stamp = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/u.test(iso) ? `${iso.slice(5, 10)} ${iso.slice(11, 16)}` : '·');

// The last question a conversation asked, from its last model words.
const lastQuestion = (result, escape = plain) => {
  const found = [...String(result ?? '').matchAll(/[^.!?。？\n]{4,}[?？]/gu)].at(-1)?.[0];
  return found ? escape(clipToWidth(bare(found), 90)) : null;
};

// What the last tool call was about: `run_command`, `write_file “app.mjs”`. Never a command line.
const actionOf = (session, escape = plain) => {
  const action = session.lastAction;
  if (!action?.tool) return null;
  const tool = escape === plain ? code(action.tool) : escape(action.tool);
  return action.target ? `${tool} “${escape(clipToWidth(bare(action.target), 50))}”` : tool;
};

const framesOf = (session, data) => (data.workflows ?? []).filter((f) => f.id8 === session.id8);

const progressLine = (session, w) => {
  const progress = session.progress;
  if (progress?.gauge) {
    const rest = (progress.remaining ?? []).slice(0, 2).map(plain).join(', ');
    return `📊 ${code(progress.gauge)}${rest ? ` → ${rest}` : ''}`;
  }
  const facts = [span(session, w) ? w.worked(span(session, w)) : null, session.asked?.at(-1) && session.asked.at(-1) !== 'unknown' ? w.lastAsk(plain(clipToWidth(session.asked.at(-1), 70))) : null].filter(Boolean);
  return facts.length ? `⏳ ${facts.join(' · ')}` : null;
};

const doneLine = (session, w) => {
  const files = (session.done?.files ?? []).slice(0, 3).map((file) => code(basename(String(file))));
  const commits = (session.done?.commits ?? []).slice(0, 2).map(({ hash, subject }) => `${code(hash)} ${plain(clipToWidth(subject, 60))}`);
  const parts = [files.length ? `${w.files} ${files.join(', ')}` : null, commits.length ? `${w.commits(session.done.commits.length)}: ${commits.join('; ')}` : null].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  // The transcript is read head and tail only, so tools are named, never counted.
  const tools = Object.entries(session.done?.tools ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => code(name));
  return tools.length ? w.toolsUsed(tools.join(', ')) : w.noneDone;
};

const nextOf = (session, data, w) => {
  if (session.status === 'waiting-on-user') {
    const paused = framesOf(session, data).find((f) => f.status === 'paused');
    // This session's own card never offers its resume command while lanes work: the hold answers
    // a lane that waits on the user, else waits for them.
    if (paused && session.self && data.next?.held) return holdStep(data, data.next.held, w);
    if (paused) return w.resume(plain(paused.skill), plain(paused.stage));
    return w.answer(lastQuestion(session.result));
  }
  if (session.status === 'active') {
    // A route that recorded no stage says what its last tool call was instead of `unknown`.
    const top = framesOf(session, data).at(-1);
    const stage = top && top.stage !== 'unknown' ? `${plain(top.skill)} · ${plain(top.stage)}` : null;
    const doing = actionOf(session);
    return stage ?? (doing ? w.doing(doing) : w.working);
  }
  return w.nothing;
};

const sessionCard = (session, data, now, w) => {
  const head = [w.badge[session.status] ?? w.badge.unknown];
  if (session.waitingReason && w.reason[session.waitingReason]) head.push(w.reason[session.waitingReason]);
  head.push(code(session.id8));
  const skill = framesOf(session, data).at(-1)?.skill;
  if (skill) head.push(code(skill));
  const when = age(session.last, now, w);
  if (when) head.push(when === w.justNow ? when : w.ago(when));
  if (session.self) head.push(`**${w.self}**`);
  const lines = [head.join(' · '), `**${plain(clipToWidth(goalOf(session), 80))}**`];
  const progress = progressLine(session, w);
  if (progress) lines.push(progress);
  lines.push(`✅ ${w.done}: ${doneLine(session, w)}`, `▶ ${w.nextLabel}: ${nextOf(session, data, w)}`);
  return lines.map((line) => `> ${line}`).join('  \n');
};

// Ended conversations are history: one table row each, newest first, at most eight.
const ENDED_ROWS = 8;
const endedTable = (sessions, now, w) => {
  const cell = (text) => plain(text) || '·';
  const rows = sessions.slice(0, ENDED_ROWS).map((session) => {
    const commits = session.done?.commits?.length ?? 0;
    const files = session.done?.files?.length ?? 0;
    const done = commits ? w.commits(commits) : files ? `${w.files} ${files}` : '·';
    return `| ${code(session.id8)} | ${cell(clipToWidth(placeOf(session), 20))} | ${cell(clipToWidth(goalOf(session), 40))} | ${cell(age(session.last, now, w) ?? '·')} | ${cell(done)} |`;
  });
  const more = sessions.length > ENDED_ROWS ? ['', `*${w.moreEnded(sessions.length - ENDED_ROWS)}*`] : [];
  return [`| ${w.endedHead.join(' | ')} |`, `|${w.endedHead.map(() => '---').join('|')}|`, ...rows, ...more];
};

// When nothing can run on `go`, the box still recommends one step from what was read: a conversation
// that waits on the user, a paused route, an open plan item (a live conversation's folder first), the
// newest other active conversation, the newest HANDOFF's open Next item, the newest ended one. It is
// shown, never recorded for `go`.
const suggestion = (data, w) => {
  const sessions = data.sessions ?? [];
  const where = (session) => bare(placeOf(session));
  const goal = (session) => clipToWidth(bare(goalOf(session)), 50);
  const waiting = sessions.find((s) => s.status === 'waiting-on-user' && !s.self);
  if (waiting) return w.suggest.answer({ id8: waiting.id8, where: where(waiting), question: lastQuestion(waiting.result, bare) });
  const paused = (data.workflows ?? []).find((f) => f.status === 'paused');
  if (paused) {
    const owner = sessions.find((s) => s.id8 === paused.id8);
    return w.suggest.resume({ id8: paused.id8, skill: paused.skill, stage: paused.stage, where: owner ? where(owner) : 'unknown' });
  }
  const live = new Set(sessions.filter((s) => s.status !== 'ended').map((s) => s.worktree));
  const open = (data.roadmap?.plans ?? []).filter((p) => p.current);
  const plan = open.find((p) => live.has(p.worktree)) ?? open.find((p) => p.local) ?? open[0];
  if (plan) return w.suggest.plan({ plan: plan.local ? plan.plan : `${basename(String(plan.worktree))}/${plan.plan}`, item: clipToWidth(bare(plan.current), 60) });
  const active = sessions.find((s) => s.status === 'active' && !s.self);
  if (active) return w.suggest.check({ id8: active.id8, goal: goal(active), where: where(active), doing: actionOf(active, bare) });
  // The newest handoff's first open Next item: below every live signal, above an ended conversation.
  const handoff = (data.handoffs ?? []).find((h) => h.local && h.next);
  if (handoff) return w.suggest.handoff({ file: bare(handoff.file), next: bare(handoff.next) });
  const ended = sessions.find((s) => s.status === 'ended' && !s.self);
  if (ended) return w.suggest.pickUp({ id8: ended.id8, goal: goal(ended), where: where(ended) });
  return w.suggest.start();
};

// A step held while other lanes work: answer the one waiting on the user, else wait for them.
// A held plan names the plan to start after; a held resume or continue only waits.
const holdStep = (data, held, w) => {
  const waiting = (data.sessions ?? []).find((s) => s.status === 'waiting-on-user' && !s.self);
  if (waiting) return suggestion(data, w);
  if (data.lanes?.waitingPane) return w.hold.answerPane({ pane: data.lanes.waitingPane });
  if (held.plan) return w.hold.wait({ lanes: held.lanes, plan: bare(held.plan) });
  return w.hold.waitLanes({ lanes: held.lanes });
};

const ROADMAP_COMMITS = 5;
const roadmapLines = (data, w) => {
  const lines = [];
  for (const commit of (data.commits ?? []).slice(0, ROADMAP_COMMITS).reverse()) {
    lines.push(`- ✓ ${stamp(commit.at)} · ${code(commit.branch)} ${plain(clipToWidth(commit.subject, 70))}`);
  }
  for (const plan of data.roadmap?.plans ?? []) {
    if (!plan.current) continue;
    const where = plan.local ? '' : `${code(basename(String(plan.worktree)))} `;
    const gauge = plan.progress?.gauge ? ` ${code(plan.progress.gauge)}` : '';
    lines.push(`- ▶ ${w.now} · ${where}${code(plan.plan)}${gauge} → ${plain(plan.current)}`);
    for (const item of (plan.progress?.remaining ?? []).slice(1, 3)) lines.push(`  - ○ ${w.later} · ${plain(item)}`);
  }
  if (data.roadmap?.plansOmitted) lines.push(`- *${w.plansOmitted(data.roadmap.plansOmitted)}*`);
  for (const goal of data.roadmap?.litgoal ?? []) {
    const gauge = goal.progress?.gauge ? ` ${code(goal.progress.gauge)}` : '';
    lines.push(`- ${goal.status === 'complete' ? '✓' : '▶'} litgoal${gauge} ${plain(clipToWidth(goal.objective, 70))}`);
  }
  return lines.length ? lines : [`- ${w.noRoadmap}`];
};

// Wraps the step at word breaks to the box, three lines at most, the last one clipped.
const wrap = (text, width, max = 3) => {
  const out = [''];
  for (const word of bare(text).split(' ')) {
    const joined = out.at(-1) ? `${out.at(-1)} ${word}` : word;
    if (displayWidth(joined) <= width || !out.at(-1)) out[out.length - 1] = joined;
    else out.push(word);
  }
  const kept = out.slice(0, max);
  if (out.length > max) kept[max - 1] = `${kept[max - 1]} ${out.slice(max).join(' ')}`;
  return kept.map((line) => clipToWidth(line, width));
};

// Open on the right: agy's chat font draws Hangul narrower than two cells, so a right edge would wander.
const box = (title, body) => {
  const inner = Math.max(displayWidth(title) + 4, ...body.map(displayWidth)) + 2;
  return ['```', `╭─ ${title} ${'─'.repeat(Math.max(1, inner - displayWidth(title) - 3))}`, ...body.map((line) => `│ ${line}`), `╰${'─'.repeat(inner)}`, '```'].join('\n');
};

// Three lines under the headline, for a reader who reads nothing else: what is finished, what runs now, the step.
const opener = (data, step, w) => {
  const sessions = data.sessions ?? [];
  const finished = (data.roadmap?.plans ?? []).filter((p) => p.finished).length;
  const doneSessions = sessions.filter((s) => s.status === 'done').length;
  const commits = (data.commits ?? []).length;
  const done = [finished ? w.plansFinished(finished) : null, doneSessions ? w.sessionsDone(doneSessions) : null, commits ? w.commits(commits) : null].filter(Boolean);
  const running = sessions.filter((s) => s.status === 'active').slice(0, 2).map((s) => `${code(s.id8)} ${plain(clipToWidth(goalOf(s), 50))}`);
  return [
    `**${w.doneSoFar}:** ${done.length ? done.join(' · ') : w.nothingDone}`,
    `**${w.doingNow}:** ${running.length ? running.join(' · ') : w.nothingRunning}`,
    `**${w.nextLabel}:** ${plain(step)}`,
  ];
};

export const renderBrief = (data, { lang = 'en', width = 72, now = Date.parse(data.generatedAt) || Date.now() } = {}) => {
  const w = WORDS[lang] ?? WORDS.en;
  const sessions = data.sessions ?? [];
  const summary = data.summary ?? { sessions: sessions.length, waitingOnUser: 0, active: 0 };
  const runs = data.next?.kind && data.next.kind !== 'none';
  const held = !runs && data.next?.held ? data.next.held : null;
  const step = runs
    ? w.step[data.next.kind](Object.fromEntries(Object.entries(data.next.target ?? {}).map(([k, v]) => [k, bare(v)])))
    : bare(held ? holdStep(data, held, w) : suggestion(data, w));
  const out = [`## 🧭 ${[w.sessions(summary.sessions), w.waiting(summary.waitingOnUser), w.active(summary.active)].join(' · ')}`];
  out.push(...opener(data, step, w));
  out.push(`*${w.window(data.scope?.since ?? '7d', (data.scope?.worktrees ?? []).length || 1)}*`);
  if (!sessions.length) out.push('', w.noSessions);

  const live = sessions.filter((s) => s.status !== 'ended');
  const ended = sessions.filter((s) => s.status === 'ended');
  const groups = new Map();
  for (const session of live) {
    const key = `${session.worktree}\u0000${session.branch ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(session);
  }
  for (const list of groups.values()) {
    const first = list[0];
    out.push('', `### 🌿 ${code(first.branch ?? 'no branch')} · ${plain(placeOf(first))}`);
    for (const session of list) out.push('', sessionCard(session, data, now, w));
  }
  if (ended.length) out.push('', `### ⚪ ${w.endedTitle(ended.length)}`, '', ...endedTable(ended, now, w));
  const roadGauge = data.roadmap?.progress?.gauge ? ` ${code(data.roadmap.progress.gauge)}` : '';
  out.push('', `### 🗺️ ${w.roadmap}${roadGauge}`, '', ...roadmapLines(data, w));

  const body = wrap(step, width - 4);
  if (runs && data.next.command) body.push(clipToWidth(data.next.command, width - 4));
  if (runs && data.next.say) body.push(`${w.type}: ${data.next.say}`);
  out.push('', box(w.recommended, body));
  out.push('', held ? w.holdGo : runs && data.next.say ? w.goLine(data.next.say) : w.noGo);

  const unread = Object.entries(data.sources ?? {}).filter(([, v]) => v === 'unknown').map(([k]) => k);
  const tail = [unread.length ? w.unknownSources(unread.join(', ')) : null, data.roadmap?.plansSkipped ? w.plansSkipped(data.roadmap.plansSkipped) : null, data.budget?.exhausted ? w.older : null].filter(Boolean);
  if (tail.length) out.push('', `*${tail.join(' ')}*`);
  return `${out.join('\n')}\n`;
};
