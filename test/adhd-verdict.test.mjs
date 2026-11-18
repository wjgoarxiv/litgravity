import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sandbox, workspace, turn, injected, PLUGIN } from './helpers.mjs';
import { decideVerdict, renderVerdict, nextCursor, VERDICT_RULES_VERSION } from '../plugin/hooks/lib/rewind/verdict.mjs';
import { runRewindCli, cursorPath } from '../plugin/hooks/lib/rewind/collect.mjs';
import { detectRoute, SKILL_IDS } from '../plugin/hooks/lib/routes.mjs';

const SNAPS = JSON.parse(readFileSync(new URL('./fixtures/adhd-verdict/snapshots.json', import.meta.url), 'utf8'));
const label = (v) => v.rule ?? v.code;

test('the hand-labelled snapshots replay: at least 8 in 10 verdicts match their label (all of them today)', () => {
  assert.ok(SNAPS.length >= 10 && SNAPS.length <= 20);
  const misses = SNAPS.filter((s) => label(decideVerdict(s.data)) !== s.label).map((s) => `${s.name}: got ${label(decideVerdict(s.data))}, want ${s.label}`);
  assert.ok((SNAPS.length - misses.length) / SNAPS.length >= 0.8, misses.join('\n'));
  assert.deepEqual(misses, []);
  assert.equal(VERDICT_RULES_VERSION, 'adhd-verdict.v1');
});

test('the card is about six lines in Korean by default and in English with en', () => {
  const data = SNAPS.find((s) => s.label === 'answer-session').data;
  const ko = renderVerdict(data).text.trimEnd().split('\n');
  assert.ok(ko.length >= 4 && ko.length <= 6, ko.join('\n'));
  assert.equal(ko[0], '처음 봄 — 기준 없음');
  assert.match(ko[1], /^지금 할 일: app 에서 질문에 답하기: Should I\? #[0-9a-f]{6}$/);
  assert.equal(ko[2], '입력: 없음 — app에서 직접');
  assert.match(ko[3], /^이유: .+ · 안 하면: .+$/);
  assert.match(ko.at(-1), /^읽음 1\/1 세션$/);
  const en = renderVerdict(data, { lang: 'en' }).text;
  assert.match(en, /^First look — no baseline\nDo now: in app: answer: /);
});

test('a claimed finish never counts as done; ticked plans and commits do', () => {
  const claim = SNAPS.find((s) => s.name.includes('only a claim')).data;
  assert.equal(decideVerdict(claim, { cursor: { at: '2026-11-18T08:00:00Z', seen: [] } }).newlyDone, 0);
  const proven = { ...claim, roadmap: { plans: [{ plan: 'plans/a.md', local: true, progress: { done: 3, total: 3 }, current: null }], stale: [] }, commits: [{ hash: 'abc1234' }] };
  const v = decideVerdict(proven, { cursor: { at: '2026-11-18T08:00:00Z', seen: ['commit:abc1234'] } });
  assert.equal(v.newlyDone, 1, 'the ticked plan is new; the seen commit is not');
});

test('an irreversible step is only a question in the queue, and nothing-to-do needs full coverage', () => {
  const push = SNAPS.find((s) => s.name.includes('unpushed')).data;
  const card = renderVerdict(push).text;
  assert.match(card, /다음 대기: 네 확인 필요: app의 커밋 2개를 push 할까\?/);
  assert.doesNotMatch(card, /입력: `git push/);
  assert.match(card, /지금 할 일 없음 — 확인한 기록 \d+개/);
  const partial = renderVerdict(SNAPS.find((s) => s.name.includes('budget ran out')).data).text;
  assert.match(partial, /판단 보류 — 못 읽은 기록이 있음/);
  assert.match(partial, /못 읽음: 읽기 예산 초과 4/);
  assert.doesNotMatch(partial, /지금 할 일 없음/);
});

test('the delta counts from the cursor, and an action whose records moved is withdrawn out loud', () => {
  const start = SNAPS.find((s) => s.label === 'start-single-plan').data;
  const first = renderVerdict(start);
  const cursor = nextCursor(first.verdict, Date.parse('2026-11-18T18:02:00+09:00'));
  const same = renderVerdict(start, { cursor }).text.split('\n')[0];
  assert.match(same, /^\d{2}:\d{2} 이후: 바뀐 것 없음$/);
  const moved = SNAPS.find((s) => s.label === 'uncommitted-work').data;
  const line = renderVerdict(moved, { cursor }).text.split('\n')[0];
  assert.match(line, new RegExp(`지난 할 일 #${cursor.fp} 철회 — 상태가 바뀜`));
});

test('the CLI draws the card by default and moves the per-user cursor; detail and recap leave it alone', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-verdict-'));
  const env = { HOME: tmpdir(), XDG_STATE_HOME: join(cwd, '.state') };
  let out = '';
  const io = { env, stdout: { write: (t) => { out += t; } }, stderr: { write: () => {} } };
  assert.equal(runRewindCli(['--brief', '--here'], cwd, io), 0);
  assert.match(out, /^처음 봄/);
  const cursor = JSON.parse(readFileSync(cursorPath(cwd, env), 'utf8'));
  assert.equal(cursor.version, 1);
  out = '';
  runRewindCli(['--brief', '--here', '--en'], cwd, io);
  assert.match(out, /^Since \d{2}:\d{2}: nothing changed/);
  out = '';
  runRewindCli(['--brief', '--here', '--recap'], cwd, io);
  assert.match(out, /^## 🧾 리캡\n기록 없음/);
  out = '';
  runRewindCli(['--brief', '--here', '--recap', '--moved'], cwd, io);
  assert.equal(out.split('\n')[0], 'lit-recap moved into lit-adhd: this is its recap view.', 'the moved note is the first line of the recap view');
  assert.match(out, /^[^\n]+\n## 🧾 리캡\n/);
});

test('lit-recap is gone as a skill; its names open the recap view of lit-adhd with the moved note', () => {
  assert.equal(SKILL_IDS.has('lit-recap'), false);
  for (const prompt of ['lit recap', 'litrecap', '/litgravity:lit-recap', 'lit status']) {
    const hit = detectRoute(prompt);
    assert.equal(hit.route, 'lit-adhd', prompt);
    assert.equal(hit.recap, true, prompt);
    assert.equal(hit.recapMoved, true, prompt);
  }
  const own = detectRoute('lit adhd recap 3f9c2a1b');
  assert.equal(own.recap, true);
  assert.equal(own.recapOf, '3f9c2a1b');
  assert.equal(own.recapMoved, undefined);
  assert.equal(detectRoute('lit adhd').recap, undefined);
  const { env } = sandbox();
  const ws = workspace();
  const text = injected(turn(ws, env, 'lit recap', 0));
  assert.match(text, /LIT IGNITED · lit-adhd/);
  assert.match(text, /rewind\.mjs --brief --lang ko --session conv-test-0001 --recap --moved$/m);
  assert.match(text, /lit-recap moved into lit-adhd: this is its recap view/);
  const skill = readFileSync(join(PLUGIN, 'skills', 'lit-adhd', 'SKILL.md'), 'utf8');
  assert.match(skill, /lit-recap moved into lit-adhd: this is its recap view\./);
});

test('R5: the hook picks the card language: Korean unless the prompt asks for English, passed as one exact flag', () => {
  const { env } = sandbox();
  const cases = [
    ['lit adhd', 'ko'], ['lit adhd what should I do now?', 'ko'], ['lit adhd detail', 'ko'], ['lit recap', 'ko'],
    ['/litgravity:lit-adhd', 'ko'], ['lit adhd 지금 뭐 해', 'ko'],
    ['lit adhd 영어 공부', 'ko'], ['lit adhd english homework', 'ko'], ['lit adhd fix the en dash', 'ko'], ['lit adhd english', 'en'],
    ['lit adhd --en', 'en'], ['lit adhd in English', 'en'], ['lit adhd 영어로', 'en'], ['lit adhd en', 'en'], ['lit adhd detail in english', 'en'],
  ];
  for (const [prompt, lang] of cases) {
    const text = injected(turn(workspace(), env, prompt, 0));
    const line = text.split('\n').find((l) => l.startsWith('Run the collector'));
    assert.ok(line, prompt);
    assert.match(line, new RegExp(` --lang ${lang} `), prompt);
    assert.doesNotMatch(line, /<ko\|en>/, prompt);
  }
  const skill = readFileSync(join(PLUGIN, 'skills', 'lit-adhd', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(skill, /any other `--lang en`/);
});
