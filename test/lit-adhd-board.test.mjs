// lit-adhd v2: the KPI board. The collector computes the do-now step, four buckets, bars, milestones, the done and
// remaining lists and the reminders; the board is the default output and the per-session brief is drawn under it
// only on request.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { sandbox, workspace, turn, injected, mkdirp } from './helpers.mjs';
import { detectRoute } from '../plugin/hooks/lib/routes.mjs';
import { collectRewind, renderRewind, runRewindCli } from '../plugin/hooks/lib/rewind/collect.mjs';
import { barText, buildBoard, renderBoard } from '../plugin/hooks/lib/rewind/board.mjs';
import { transcriptPathOf } from '../plugin/hooks/lib/rewind/transcripts.mjs';
import { sessionPath } from '../plugin/hooks/lib/common.mjs';

const WAITING_ID = 'c0ffee12-3456-4789-abcd-0123456789ab';
const HASH = '9f8e7d6c5b4a39281706f5e4d3c2b1a098765432';
const KO_SECTIONS = ['## 🎯 지금 할 일', '## 📊 한눈에 보기', '## 🏁 마일스톤', '## ✅ 최근 끝낸 일', '## ⬜ 남은 일', '## 🔔 잊지 말 것'];
const EN_SECTIONS = ["## 🎯 Do this now", '## 📊 At a glance', '## 🏁 Milestones', '## ✅ Done lately', '## ⬜ Still to do', "## 🔔 Don't forget"];

// A fake git for the fixture: one worktree on feat/board, one commit in the window, three uncommitted changes and
// two unpushed commits.
const fakeGit = (root) => (file, args) => {
  if (file !== 'git') throw new Error(`unexpected ${file}`);
  const line = args.join(' ');
  if (line === 'worktree list --porcelain') return `worktree ${root}\nHEAD ${HASH}\nbranch refs/heads/feat/board\n`;
  if (line === 'rev-parse --abbrev-ref HEAD') return 'feat/board\n';
  if (line.startsWith('log ')) return `${HASH}\t${new Date(Date.now() - 3_600_000).toISOString()}\tfeat: draw the board\n`;
  if (line.startsWith('--no-optional-locks status')) return ' M src/a.mjs\n M src/b.mjs\n?? notes.txt\n';
  if (line.startsWith('rev-list --count')) return '2\n';
  throw new Error(`unexpected git ${line}`);
};

// Two plans (one fully ticked, one half), a conversation waiting on the user, uncommitted changes, one stale plan.
const fixture = () => {
  const { env } = sandbox();
  const ws = workspace();
  mkdirp(join(ws.dir, 'plans'));
  writeFileSync(join(ws.dir, 'plans', '2026-11-01-done.md'), '# Ship the parser\n\n- [x] 1. Write the grammar\n- [x] 2. Add the tests\n- [x] 3. Wire the CLI\n');
  writeFileSync(join(ws.dir, 'plans', '2026-11-08-half.md'), '# Board rollout\n\n- [x] 1. Draft the layout\n- [x] 2. Write the collector\n- [ ] 3. Update the skill\n- [ ] 4. Record a sample\n');
  writeFileSync(join(ws.dir, 'plans', '2026-10-20-stale.md'), '# Old migration\n\n- [ ] 1. Move the tables\n- [ ] 2. Drop the old ones\n');
  const tenDays = new Date(Date.now() - 10 * 86_400_000);
  utimesSync(join(ws.dir, 'plans', '2026-10-20-stale.md'), tenDays, tenDays);
  const transcript = transcriptPathOf(join(env.HOME, '.gemini', 'antigravity-cli'), WAITING_ID);
  mkdirSync(dirname(transcript), { recursive: true });
  const at = new Date(Date.now() - 5 * 60_000).toISOString();
  writeFileSync(transcript, [
    { step_index: 0, type: 'USER_INPUT', created_at: at, content: '<USER_REQUEST>\nlit loop tidy the release notes\n</USER_REQUEST>' },
    { step_index: 1, type: 'PLANNER_RESPONSE', created_at: at, content: 'I drafted them. Should I also add the migration note?' },
  ].map((l) => JSON.stringify(l)).join('\n') + '\n');
  const state = sessionPath(ws.dir, WAITING_ID, env);
  mkdirSync(dirname(state), { recursive: true });
  writeFileSync(state, JSON.stringify({ route: 'lit-loop' }));
  const data = collectRewind({ cwd: ws.dir, sessionId: 'conv-test-0001', env, record: false, exec: fakeGit(ws.dir) });
  return { env, ws, data };
};

const sectionsOf = (text) => text.split('\n').filter((l) => l.startsWith('## '));
const section = (text, heading) => {
  const lines = text.split('\n');
  const at = lines.indexOf(heading);
  const end = lines.findIndex((l, i) => i > at && l.startsWith('## '));
  return lines.slice(at + 1, end === -1 ? undefined : end).filter((l) => l.trim());
};

test('board: bars are ten cells of █ and ░ with k/n, and never round a partial count to empty or full', () => {
  assert.equal(barText(0, 5), '░░░░░░░░░░ 0/5');
  assert.equal(barText(11, 11), '██████████ 11/11');
  assert.equal(barText(3, 10), '███░░░░░░░ 3/10');
  assert.equal(barText(5, 8), '██████░░░░ 5/8');
  assert.equal(barText(1, 100), '█░░░░░░░░░ 1/100');
  assert.equal(barText(99, 100), '█████████░ 99/100');
  assert.equal(barText(2, null), null);
  assert.equal(barText(0, 0), null);
});

test('board: sections come in the fixed order, in Korean and in English', () => {
  const { data } = fixture();
  assert.deepEqual(sectionsOf(renderBoard(data, { lang: 'ko' })), KO_SECTIONS);
  assert.deepEqual(sectionsOf(renderBoard(data, { lang: 'en' })), EN_SECTIONS);
});

test('board: the four buckets count tasks, and the overall bar is done over all of them', () => {
  const { data } = fixture();
  assert.deepEqual(data.board.counts, { done: 5, progress: 1, waiting: 1, todo: 1, total: 8 });
  assert.deepEqual(data.board.overall, { done: 5, total: 8, percent: 63, bar: '██████░░░░ 5/8' });
  const text = renderBoard(data, { lang: 'ko' });
  assert.match(text, /\| ✅ 끝남 \| 🔄 진행 중 \| ⏳ 나를 기다림 \| ⬜ 남음 \|\n\|:--:\|:--:\|:--:\|:--:\|\n\| 5 \| 1 \| 1 \| 1 \|/);
  assert.match(text, /^전체 진행 {2}██████░░░░ {2}5\/8 \(63%\)$/m);
});

test('board: milestone rows carry a plain name, a bucket, a bar and how recent', () => {
  const { data } = fixture();
  const ko = renderBoard(data, { lang: 'ko' });
  assert.match(ko, /^\| Board rollout \| 🔄 진행 중 \| █████░░░░░ 2\/4 \| (?:방금|\d+분 전) \|$/m);
  assert.match(ko, /^\| Ship the parser \| ✅ 끝남 \| ██████████ 3\/3 \| (?:방금|\d+분 전) \|$/m);
  assert.ok(ko.indexOf('Board rollout') < ko.indexOf('Ship the parser'), 'open milestones before finished ones');
  assert.ok(!/Old migration \|/.test(ko), 'a plan outside the window is a reminder, not a milestone');
  const en = renderBoard(data, { lang: 'en' });
  assert.match(en, /^\| Milestone \| Status \| Progress \| Last \|$/m);
  assert.match(en, /^\| Board rollout \| 🔄 In progress \| █████░░░░░ 2\/4 \| (?:just now|\d+m ago) \|$/m);
});

test('board: done lately and still to do are plain sentences, remaining in plan order with the current plan first', () => {
  const { data } = fixture();
  const ko = renderBoard(data, { lang: 'ko' });
  const done = section(ko, '## ✅ 최근 끝낸 일');
  assert.equal(done.length, 5);
  assert.ok(done.every((l) => l.startsWith('- ')));
  assert.ok(done.includes('- Write the collector (Board rollout)'), done.join('\n'));
  assert.deepEqual(section(ko, '## ⬜ 남은 일'), ['1. Update the skill (Board rollout)', '2. Record a sample (Board rollout)']);
});

test('board: done is capped at five and remaining at seven with the count of the rest', () => {
  const rows = (n, ticked) => Array.from({ length: n }, (_, i) => ({ checked: i < ticked, title: `Row ${i + 1}` }));
  const plan = { plan: 'plans/big.md', title: 'Big plan', worktree: '/ws/app', local: true, current: 'Row 11', finished: false, mtime: Date.parse('2026-11-10T11:00:00Z'), rows: rows(20, 10), progress: { done: 10, total: 20 } };
  const data = { generatedAt: '2026-11-10T12:00:00Z', sessions: [], roadmap: { plans: [plan], litgoal: [] }, workflows: [], next: { kind: 'none', target: null } };
  const ko = renderBoard(data, { lang: 'ko' });
  assert.equal(section(ko, '## ✅ 최근 끝낸 일').length, 5);
  const left = section(ko, '## ⬜ 남은 일');
  assert.equal(left.length, 8);
  assert.equal(left[0], '1. Row 11 (Big plan)');
  assert.equal(left.at(-1), '…외 3개');
  assert.equal(section(renderBoard(data, { lang: 'en' }), '## ⬜ Still to do').at(-1), '…and 3 more');
});

test('board: reminders are action-shaped, most urgent first, and capped at five', () => {
  const { data } = fixture();
  const ko = section(renderBoard(data, { lang: 'ko' }), '## 🔔 잊지 말 것');
  assert.ok(ko.every((l) => l.startsWith('- ') && l.includes(' → ')), ko.join('\n'));
  assert.match(ko[0], /^- ⏳ .*“Should I also add the migration note\?” → 그 대화를 열고 답하기$/);
  assert.ok(ko.some((l) => /^- 💾 커밋 안 된 변경 3개 \(.+\) → /.test(l)), ko.join('\n'));
  assert.ok(ko.some((l) => /^- 📤 푸시 안 된 커밋 2개 \(.+\) → /.test(l)), ko.join('\n'));
  assert.ok(ko.some((l) => /^- 🕰️ 10일째 멈춘 계획: Old migration → 이어 할지, 접을지 정하기$/.test(l)), ko.join('\n'));
  const many = buildBoard({
    generatedAt: '2026-11-10T12:00:00Z',
    sessions: Array.from({ length: 4 }, (_, i) => ({ id8: `wait000${i}`, status: 'waiting-on-user', worktree: `/ws/app${i}`, result: 'Ship it?', self: false })),
    roadmap: { plans: [], litgoal: [], stale: [{ title: 'Old', days: 9 }] },
    repo: [{ worktree: '/ws/app', uncommitted: 2, unpushed: 1 }], lanes: { count: 6, waiting: 4 }, workflows: [], next: { kind: 'none', target: null },
  });
  assert.equal(many.reminders.length, 5);
  assert.deepEqual(many.reminders.map((r) => r.kind), ['ask', 'ask', 'ask', 'ask', 'uncommitted']);
});

test('board: no session id, commit hash, raw status code or internal path inside the board', () => {
  const { data } = fixture();
  for (const lang of ['ko', 'en']) {
    const text = renderBoard(data, { lang });
    for (const banned of [WAITING_ID.slice(0, 8), HASH.slice(0, 7), 'waiting-on-user', 'idle', 'ended', 'plans/', '.md', 'conv-test']) {
      assert.ok(!text.includes(banned), `${lang} board shows ${banned}:\n${text}`);
    }
  }
});

test('board: do-this-now keeps the next-step choice and says exactly what to type', () => {
  const plan = { plan: 'plans/ship.md', title: 'Ship it', worktree: '/ws/app', local: true, current: 'Write the notes', finished: false, mtime: Date.parse('2026-11-10T11:00:00Z'), rows: [{ checked: true, title: 'Draft' }, { checked: false, title: 'Write the notes' }], progress: { done: 1, total: 2 } };
  const base = { generatedAt: '2026-11-10T12:00:00Z', sessions: [], roadmap: { plans: [plan], litgoal: [] }, workflows: [] };
  const run = renderBoard({ ...base, next: { kind: 'start-plan', target: { plan: 'plans/ship.md' }, say: 'go', command: 'lit start plans/ship.md' } }, { lang: 'ko' });
  assert.deepEqual(section(run, '## 🎯 지금 할 일'), ['**Ship it 시작하기** — 열린 계획이 하나뿐이고 다른 일이 돌고 있지 않아요', '👉 입력: `go`']);
  const en = renderBoard({ ...base, next: { kind: 'start-plan', target: { plan: 'plans/ship.md' }, say: 'go' } }, { lang: 'en' });
  assert.match(en, /👉 Type: `go`/);
  const held = renderBoard({ ...base, lanes: { count: 2, waiting: 0 }, next: { kind: 'none', target: null, held: { lanes: 2, plan: 'plans/ship.md' } } }, { lang: 'ko' });
  assert.match(held, /👉 기다리기: 레인 2개가 끝날 때까지/);
  assert.ok(!/👉 입력: `go`/.test(held));
  const resume = renderBoard({ ...base, next: { kind: 'resume-frame', target: { skill: 'lit-loop', stage: 'verify' }, say: 'lit continue' } }, { lang: 'en' });
  assert.match(resume, /👉 Type: `lit continue`/);
});

test('board: every section has one plain line when empty, and the whole board stays short', () => {
  const empty = renderBoard({ generatedAt: '2026-11-10T12:00:00Z', sessions: [], roadmap: { plans: [], litgoal: [] }, workflows: [], next: { kind: 'none', target: null } }, { lang: 'ko' });
  assert.deepEqual(section(empty, '## 🏁 마일스톤'), ['진행 중인 마일스톤이 없어요']);
  assert.deepEqual(section(empty, '## ✅ 최근 끝낸 일'), ['최근 끝낸 일이 없어요']);
  assert.deepEqual(section(empty, '## ⬜ 남은 일'), ['남은 일이 없어요']);
  assert.deepEqual(section(empty, '## 🔔 잊지 말 것'), ['챙길 것이 없어요']);
  assert.match(empty, /^전체 진행 {2}아직 셀 일이 없어요$/m);
  const en = renderBoard({ generatedAt: '2026-11-10T12:00:00Z', sessions: [], roadmap: { plans: [], litgoal: [] }, workflows: [], next: { kind: 'none', target: null } }, { lang: 'en' });
  assert.deepEqual(section(en, '## ⬜ Still to do'), ['Nothing left']);
  // Every list at its cap: still about forty lines.
  const rows = Array.from({ length: 20 }, (_, i) => ({ checked: i < 10, title: `Row ${i + 1}` }));
  const plans = Array.from({ length: 6 }, (_, i) => ({ plan: `plans/p${i}.md`, title: `Plan ${i}`, worktree: '/ws/app', local: true, current: 'Row 11', finished: false, mtime: Date.parse('2026-11-10T11:00:00Z'), rows, progress: { done: 10, total: 20 } }));
  const full = renderBoard({
    generatedAt: '2026-11-10T12:00:00Z',
    sessions: Array.from({ length: 6 }, (_, i) => ({ id8: `wait000${i}`, status: 'waiting-on-user', worktree: `/ws/app${i}`, result: 'Ship it?', self: false })),
    roadmap: { plans, litgoal: [] }, workflows: [], next: { kind: 'none', target: null },
  }, { lang: 'ko' });
  assert.ok(full.trimEnd().split('\n').length <= 42, `${full.split('\n').length} lines`);
  assert.match(full, /^\| …외 \d+개 \| \| \| \|$/m, 'milestones past the cap fold into one row');
});

test('board: the per-session detail list appears only on request, under the board', () => {
  const { data } = fixture();
  const plain = renderRewind(data, { lang: 'ko' });
  assert.ok(plain.startsWith('## 🎯 지금 할 일\n'));
  assert.ok(!plain.includes('## 🧭'), 'no detail by default');
  const detail = renderRewind(data, { lang: 'ko', detail: true });
  assert.ok(detail.startsWith('## 🎯 지금 할 일\n'));
  assert.ok(detail.indexOf('## 🧭') > detail.indexOf('## 🔔 잊지 말 것'), 'detail sits under the board');
  let out = '';
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-board-cli-ws-'));
  const io = { env: { HOME: tmpdir(), XDG_STATE_HOME: join(cwd, '.state') }, stdout: { write: (t) => { out += t; }, columns: 100 }, stderr: { write: () => {} } };
  assert.equal(runRewindCli(['--brief', '--lang', 'en', '--here', '--detail'], cwd, io), 0);
  assert.ok(out.startsWith('## 🎯 Do this now\n') && out.includes('## 🧭'), out);
});

test('board: the JSON carries the structured board and the ready text', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-board-json-'));
  let out = '';
  const io = { env: { HOME: tmpdir(), XDG_STATE_HOME: join(cwd, '.state') }, stdout: { write: (t) => { out += t; } }, stderr: { write: () => {} } };
  assert.equal(runRewindCli(['--json', '--lang', 'ko', '--here'], cwd, io), 0);
  const data = JSON.parse(out);
  assert.ok(data.board && data.board.counts && Array.isArray(data.board.reminders));
  assert.ok(data.boardText.startsWith('## 🎯 지금 할 일\n'));
});

test('lit adhd detail and 자세히 route to lit-adhd and hand the collector --detail', () => {
  assert.equal(detectRoute('lit adhd 자세히').detail, true);
  assert.equal(detectRoute('lit adhd detail').detail, true);
  assert.equal(detectRoute('/lit-adhd details').detail, true);
  assert.ok(!detectRoute('lit adhd').detail);
  const { env } = sandbox();
  const ws = workspace();
  assert.match(injected(turn(ws, env, 'lit adhd 자세히', 0)), /rewind\.mjs --brief --lang <ko\|en> --session conv-test-0001 --detail/);
  const { env: env2 } = sandbox();
  const ws2 = workspace();
  const plain = injected(turn(ws2, env2, 'lit rewind', 0));
  assert.match(plain, /rewind\.mjs --brief --lang <ko\|en> --session conv-test-0001/);
  assert.ok(!/--detail/.test(plain));
});
