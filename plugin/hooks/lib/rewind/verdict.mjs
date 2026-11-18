// The lit-adhd verdict card: about six lines that answer "what do I do now?" from the collected records alone. A
// versioned rule table picks ONE verdict, top rule first; the model only prints the card.
//
//   1 what changed since the user's last look   `18:02 이후: 2개 끝남, 1개가 너를 기다림`
//   2 the one action and where                  `지금 할 일: <where> 에서 <action> #<fp>`
//   3 the exact text to type                    `입력: \`lit continue\``
//   4 why, and the cost of not doing it         `이유: … · 안 하면: …`
//   5 the decision queue, at most two           `다음 대기: …`
//   6 coverage                                  `읽음 6/7 세션 — 못 읽음: …`
//
// Inputs are evidence-gated. A plan of this folder with every row ticked and a commit are proven done; a conversation
// that only says it finished is a claim and never counts. Each action carries a fingerprint of the records it rests on
// and the precondition it needs; when the fingerprint the user last saw no longer holds, the card says it was
// withdrawn. A push, publish or release is never an action, only `네 확인 필요: <question>`. `지금 할 일 없음` appears
// only when every source was read. Pure: the cursor file is read and written by the collector CLI.
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { clipToWidth } from './gauge.mjs';

export const VERDICT_RULES_VERSION = 'adhd-verdict.v1';
const TEXT_MAX = 64;

const LABELS = {
  ko: {
    since: (hhmm) => `${hhmm} 이후`,
    firstLook: '처음 봄 — 기준 없음',
    delta: (done, waiting) => `${done}개 끝남, ${waiting}개가 너를 기다림`,
    nothingChanged: '바뀐 것 없음',
    withdrawn: (fp) => `지난 할 일 #${fp} 철회 — 상태가 바뀜`,
    doNow: '지금 할 일',
    at: (where, action) => (where ? `${where} 에서 ${action}` : action),
    type: '입력',
    noType: (where) => `없음 — ${where ?? '그 창'}에서 직접`,
    waitType: '없음 — 끝날 때까지 기다리기',
    why: '이유',
    ifNot: '안 하면',
    queue: '다음 대기',
    confirm: '네 확인 필요',
    read: (read, found) => `읽음 ${read}/${found} 세션`,
    missing: '못 읽음',
    nothing: (count) => `지금 할 일 없음 — 확인한 기록 ${count}개`,
    unknown: '판단 보류 — 못 읽은 기록이 있음',
    reasons: { budget: '읽기 예산 초과', limit: '최대 개수 초과', unreadable: '읽을 수 없음', transcripts: 'agy 대화 기록 없음', git: 'git 상태' },
    actions: {
      answer: (q) => (q ? `질문에 답하기: ${q}` : '질문에 답하기'),
      resume: (skill) => `멈춘 ${skill} 이어가기`,
      continue: (plan) => `${plan} 이어서 진행`,
      startPlan: (plan) => `${plan} 실행 시작`,
      planItem: (item) => `다음 항목: ${item}`,
      dirty: (count) => `바뀐 파일 ${count}개 확인`,
      wait: (lanes) => `기다리기 — 다른 대화 ${lanes}개 작업 중`,
    },
    why_: {
      answer: '그 대화가 네 답을 기다림',
      resume: '이 대화의 작업이 멈춰 있음',
      continue: '이 대화의 start-work가 진행 중',
      startPlan: '열린 계획이 하나뿐이고 아무것도 안 돌고 있음',
      planItem: '계획에 체크 안 된 항목이 남음',
      dirty: '커밋 안 된 변경이 있음',
      wait: '다른 대화가 같은 곳에서 일하는 중',
    },
    ifNot_: {
      answer: '그 대화가 계속 기다림',
      resume: '멈춘 그대로 남음',
      continue: '남은 항목이 그대로 남음',
      startPlan: '계획이 그대로 남음',
      planItem: '계획이 그대로 남음',
      dirty: '변경이 커밋 안 된 채 남음',
      wait: '없음',
    },
    push: (where, count) => `${where}의 커밋 ${count}개를 push 할까?`,
    stale: (name, days) => `${name} 계획이 ${days}일째 그대로 — 계속할지 닫을지`,
    waitingAt: (where) => `${where} 대화가 답을 기다림`,
    more: (n) => `(+${n})`,
  },
  en: {
    since: (hhmm) => `Since ${hhmm}`,
    firstLook: 'First look — no baseline',
    delta: (done, waiting) => `${done} finished, ${waiting} waiting on you`,
    nothingChanged: 'nothing changed',
    withdrawn: (fp) => `last action #${fp} withdrawn — the state moved`,
    doNow: 'Do now',
    at: (where, action) => (where ? `in ${where}: ${action}` : action),
    type: 'Type',
    noType: (where) => `nothing — answer in ${where ?? 'that window'}`,
    waitType: 'nothing — wait for them to finish',
    why: 'Why',
    ifNot: 'If not',
    queue: 'Next waiting',
    confirm: 'Your call',
    read: (read, found) => `Read ${read}/${found} sessions`,
    missing: 'not read',
    nothing: (count) => `Nothing to do now — ${count} records checked`,
    unknown: 'No verdict — some records were not read',
    reasons: { budget: 'read budget spent', limit: 'over the session cap', unreadable: 'unreadable', transcripts: 'no agy conversation records', git: 'git state' },
    actions: {
      answer: (q) => (q ? `answer: ${q}` : 'answer its question'),
      resume: (skill) => `resume the paused ${skill}`,
      continue: (plan) => `continue ${plan}`,
      startPlan: (plan) => `start ${plan}`,
      planItem: (item) => `next item: ${item}`,
      dirty: (count) => `review ${count} changed file(s)`,
      wait: (lanes) => `wait — ${lanes} other conversation(s) at work`,
    },
    why_: {
      answer: 'that conversation waits for your answer',
      resume: "this conversation's work is paused",
      continue: "this conversation's start-work is running",
      startPlan: 'one open plan and nothing running',
      planItem: 'the plan has unticked rows',
      dirty: 'uncommitted changes',
      wait: 'another conversation works here',
    },
    ifNot_: {
      answer: 'that conversation keeps waiting',
      resume: 'it stays paused',
      continue: 'the open rows stay open',
      startPlan: 'the plan stays as it is',
      planItem: 'the plan stays as it is',
      dirty: 'the changes stay uncommitted',
      wait: 'nothing',
    },
    push: (where, count) => `push ${count} commit(s) in ${where}?`,
    stale: (name, days) => `${name} untouched for ${days} days — keep or close?`,
    waitingAt: (where) => `the conversation in ${where} waits for an answer`,
    more: (n) => `(+${n})`,
  },
};

const placeOf = (worktree) => (worktree && worktree !== 'unknown' ? basename(String(worktree)) : null);
const short = (text) => clipToWidth(String(text ?? '').replace(/[`*_]/gu, '').replace(/\s+/gu, ' ').trim(), TEXT_MAX);
const planLabel = (path) => short(basename(String(path ?? 'plan')).replace(/\.md$/u, '').replace(/^\d{4}-\d{2}-\d{2}-/u, ''));
const lastQuestion = (result) => {
  const text = String(result ?? '');
  const question = text.split(/(?<=[.!?？。])\s+|\n+/u).filter((part) => /[?？]\s*$/u.test(part)).at(-1);
  return question ? short(question) : null;
};
export const fingerprint = (parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 6);

/** Proven finished items: this folder's plans with every row ticked, and commits. A claim alone never counts. */
export const provenDone = (data) => [
  ...(data.roadmap?.plans ?? []).filter((p) => p.local && p.progress?.total > 0 && p.progress.done === p.progress.total).map((p) => ({ id: `plan:${p.plan}` })),
  ...(data.commits ?? []).filter((c) => typeof c.hash === 'string').map((c) => ({ id: `commit:${c.hash}` })),
];

const waitingSessions = (data) => (data.sessions ?? []).filter((s) => !s.self && s.status === 'waiting-on-user' && s.waitingReason !== 'paused workflow');

/** Who could not be read. A source the collector could not open counts too. */
export const coverageOf = (data) => {
  const notRead = data.coverage?.notRead ?? {};
  const missing = [];
  for (const reason of ['budget', 'limit', 'unreadable']) if (notRead[reason] > 0) missing.push({ reason, count: notRead[reason] });
  if (data.sources?.transcripts !== 'ok') missing.push({ reason: 'transcripts', count: null });
  if (data.sources?.git !== 'ok' && !(data.repo ?? []).length) missing.push({ reason: 'git', count: null });
  const read = (data.sessions ?? []).length;
  const skipped = missing.reduce((sum, item) => sum + (item.count ?? 0), 0);
  return { read, found: read + skipped, missing, full: missing.length === 0 };
};

/**
 * The rule table, top first. Each rule returns null or `{ code, kind, where, type, fp, pre, … }`. A change of order or
 * meaning bumps VERDICT_RULES_VERSION and the labelled snapshots in test/fixtures/adhd-verdict/.
 */
export const RULES = Object.freeze([
  ['answer-session', (data) => {
    const s = waitingSessions(data)[0];
    return s ? { code: 'NEEDS_YOU', kind: 'answer', where: placeOf(s.worktree) ?? s.id8, question: lastQuestion(s.result), type: null, fp: fingerprint(['answer', s.id8, s.last]), pre: "that conversation's last turn asked the user" } : null;
  }],
  ['resume-own-frame', (data) => (data.next?.kind === 'resume-frame' ? { code: 'ONE_ACTION', kind: 'resume', where: null, skill: data.next.target?.skill ?? 'work', type: 'lit continue', fp: fingerprint(['resume', data.next.target]), pre: "this conversation's frame is paused" } : null)],
  ['continue-own-work', (data) => (data.next?.kind === 'continue-work' ? { code: 'ONE_ACTION', kind: 'continue', where: null, plan: planLabel(data.next.target?.plan), type: 'go', fp: fingerprint(['continue', data.next.target]), pre: "this conversation's start-work is active" } : null)],
  ['other-lanes-at-work', (data) => (data.next?.held?.lanes ? { code: 'WAIT', kind: 'wait', where: null, lanes: data.next.held.lanes, type: null, fp: fingerprint(['wait', data.next.held.lanes]), pre: 'another conversation is active here' } : null)],
  ['start-single-plan', (data) => (data.next?.kind === 'start-plan' ? { code: 'ONE_ACTION', kind: 'startPlan', where: null, plan: planLabel(data.next.target?.plan), type: 'go', fp: fingerprint(['start', data.next.target]), pre: 'one open plan, nothing running' } : null)],
  ['uncommitted-work', (data) => {
    const tree = (data.repo ?? []).find((r) => r.uncommitted > 0);
    return tree ? { code: 'ONE_ACTION', kind: 'dirty', where: placeOf(tree.worktree), count: tree.uncommitted, type: 'git status', fp: fingerprint(['dirty', tree.worktree, tree.uncommitted]), pre: 'the worktree has uncommitted changes' } : null;
  }],
  ['next-plan-row', (data) => {
    const plans = data.roadmap?.plans ?? [];
    const plan = plans.find((p) => p.local && p.current) ?? plans.find((p) => p.current);
    return plan ? { code: 'ONE_ACTION', kind: 'planItem', where: plan.local ? null : placeOf(plan.worktree), item: short(plan.current), type: plan.local ? `lit start ${plan.plan}` : null, fp: fingerprint(['row', plan.plan, plan.current]), pre: 'that row is still unticked' } : null;
  }],
]);

/** The decision queue: what else waits on the user, an irreversible step only as a question. */
const queueOf = (data, chosen, labels) => {
  const items = [];
  for (const s of waitingSessions(data)) {
    if (chosen?.kind === 'answer' && chosen.fp === fingerprint(['answer', s.id8, s.last])) continue;
    items.push(labels.waitingAt(placeOf(s.worktree) ?? s.id8));
  }
  for (const tree of data.repo ?? []) if (tree.unpushed > 0) items.push(`${labels.confirm}: ${labels.push(placeOf(tree.worktree) ?? 'repo', tree.unpushed)}`);
  for (const plan of [...(data.roadmap?.stale ?? [])].sort((a, b) => b.days - a.days)) items.push(labels.stale(planLabel(plan.plan), plan.days));
  return items;
};

/** The structured verdict: delta, the one action (or nothing / unknown), queue and coverage. */
export const decideVerdict = (data, { cursor = null } = {}) => {
  const done = provenDone(data);
  const since = cursor && Number.isFinite(Date.parse(cursor.at)) ? Date.parse(cursor.at) : null;
  const seen = new Set(Array.isArray(cursor?.seen) ? cursor.seen : []);
  const newlyDone = since === null ? null : done.filter((item) => !seen.has(item.id)).length;
  const waiting = waitingSessions(data).length;
  let chosen = null;
  let rule = null;
  for (const [name, check] of RULES) {
    chosen = check(data);
    if (chosen) {
      rule = name;
      break;
    }
  }
  const coverage = coverageOf(data);
  const code = chosen?.code ?? (coverage.full ? 'ALL_CLEAR' : 'UNKNOWN');
  const checked = done.length + (data.sessions ?? []).length + (data.roadmap?.plans ?? []).length + (data.repo ?? []).length;
  return { version: VERDICT_RULES_VERSION, code, rule, action: chosen, since, newlyDone, waiting, coverage, checked, done: done.map(({ id }) => id) };
};

const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** The card as text. `lang` is ko (default) or en. */
export const renderVerdict = (data, { lang = 'ko', cursor = null } = {}) => {
  const labels = LABELS[lang] ?? LABELS.ko;
  const verdict = decideVerdict(data, { cursor });
  const lines = [];
  if (verdict.since === null) lines.push(labels.firstLook);
  else {
    const withdrawn = typeof cursor?.fp === 'string' && /^[0-9a-f]{6}$/u.test(cursor.fp) && cursor.fp !== (verdict.action?.fp ?? null) ? ` · ${labels.withdrawn(cursor.fp)}` : '';
    lines.push(`${labels.since(hhmm(verdict.since))}: ${verdict.newlyDone === 0 && verdict.waiting === 0 ? labels.nothingChanged : labels.delta(verdict.newlyDone, verdict.waiting)}${withdrawn}`);
  }
  const action = verdict.action;
  if (action) {
    const text = labels.actions[action.kind](action.plan ?? action.question ?? action.skill ?? action.item ?? action.count ?? action.lanes);
    lines.push(`${labels.doNow}: ${labels.at(action.where, text)} #${action.fp}`);
    lines.push(`${labels.type}: ${action.type ? `\`${action.type}\`` : action.kind === 'wait' ? labels.waitType : labels.noType(action.where)}`);
    lines.push(`${labels.why}: ${labels.why_[action.kind]} · ${labels.ifNot}: ${labels.ifNot_[action.kind]}`);
  } else {
    lines.push(verdict.code === 'ALL_CLEAR' ? labels.nothing(verdict.checked) : labels.unknown);
  }
  const queue = queueOf(data, action, labels);
  if (queue.length) lines.push(`${labels.queue}: ${queue.slice(0, 2).join(' · ')}${queue.length > 2 ? ` ${labels.more(queue.length - 2)}` : ''}`);
  const { read, found, missing } = verdict.coverage;
  lines.push(`${labels.read(read, found)}${missing.length ? ` — ${labels.missing}: ${missing.map((m) => `${labels.reasons[m.reason]}${m.count ? ` ${m.count}` : ''}`).join(', ')}` : ''}`);
  return { text: `${lines.join('\n')}\n`, verdict };
};

/** The next cursor: when the user looked, which proven items they have now seen, and the action shown. */
export const nextCursor = (verdict, now) => ({ version: 1, at: new Date(now).toISOString(), seen: verdict.done.slice(0, 500), fp: verdict.action?.fp ?? null });
