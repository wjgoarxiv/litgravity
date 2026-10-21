import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, workspace, runHook, basePayload, turn, injected, PLUGIN } from './helpers.mjs';
import { detectRoute, motionIntent } from '../plugin/hooks/lib/routes.mjs';
import { parseMotionCommand } from '../plugin/hooks/lib/motion.mjs';
import { ENGINE, MOTION_CLI, fakeCoverRun, bumpStillsRound, coverAnswers, writeAnswers } from './motion-helpers.mjs';

const { lookCommand } = await import(join(ENGINE, 'node', 'look.mjs'));
const CONV = 'conv-test-0001';

// A motion conversation: the activation through PreInvocation, then the tool events the model would make, then Stop.
function session(prompt = 'lit motion a README cover loop for LOOPTEST') {
  const { env } = sandbox();
  const ws = workspace();
  const ignite = turn(ws, env, prompt, 0);
  const call = (name, args) => runHook('post-tool-use', basePayload(ws, { toolCall: { name, args }, stepIdx: 3 }), env);
  return {
    env,
    ws,
    ignite,
    shell: (command) => call('run_command', { CommandLine: command, Cwd: ws.dir }),
    read: (path) => call('read_file', { Path: path }),
    stop: () => runHook('stop', basePayload(ws, { terminationReason: 'NO_TOOL_CALL' }), env),
  };
}

const held = (r) => r.json?.decision === 'continue';

const POSITIVE = [
  'lit 이 시 구절로 키네틱 타이포 영상 만들어줘', 'lit 회사 창립 기념 오프닝 타이틀 시퀀스 제작해줘', 'lit 새 앨범 가사 영상 하나 뽑아줘',
  'lit 우리 동아리 소개 인트로 영상 만들어 줘', 'lit 이 문장으로 모션그래픽 짧게 제작해줘', 'lit make a kinetic type video out of this haiku',
  'lit produce a title sequence for the gallery opening', 'lit render a lyric video for the chorus', 'lit create an intro video for the weekly science club',
  'lit 연구 성과 발표를 영상으로 만들어줘', 'lit make a video version of our quarterly presentation', 'lit make a seamless cover loop for this repository',
  'lit motion a README hero banner', 'lit film a 15 second explainer about seed libraries', 'lit 영상 봄 축제 오프닝', 'lit-typographic-motion 봄 축제 오프닝',
];
const EXCLUDED = [
  'lit 이 영상 잘라서 자막 넣어줘', 'lit trim this clip and add captions', 'lit embed a background video in the landing page',
  'lit 발표자료에 이 영상 넣어서 만들어줘', 'lit insert the product video into the report document', 'lit 유튜브 영상 썸네일 만들어줘',
  'lit write a script for our tutorial video', 'lit 이 영상 대본 좀 작성해줘', 'lit 버튼 호버 모션 만들어줘', 'lit design motion tokens for the checkout screen',
  'lit 주주총회 안건 모션 초안 만들어줘', 'lit build a video upload page', 'lit make a clip path for the hero section', 'lit 신입 교육용 슬라이드 덱 만들어줘',
  'lit 보고서 제작해줘', 'lit render the dashboard component', 'lit 이 영상 편집본 제작해줘', 'make a lyric video', 'lit',
];

test('motion routing: film requests in Korean and English reach the skill; editing, pages, decks and UI motion do not', () => {
  for (const p of POSITIVE) assert.equal(detectRoute(p)?.route, 'lit-typographic-motion', p);
  for (const p of EXCLUDED) assert.notEqual(detectRoute(p)?.route, 'lit-typographic-motion', p);
  assert.equal(motionIntent('a quick explainer video about tide pools, please make it'), true);
  assert.equal(detectRoute('lit plan a lyric video pipeline')?.route, 'lit-plan', 'an explicit keyword still wins');
});

test('motion command parser: renders name their folder; cover-gate and window renders never do', () => {
  assert.deepEqual(parseMotionCommand(`node "${MOTION_CLI}" cover --out motion-x --round 2`, '/w'), { mode: 'cover', out: '/w/motion-x', round: 2, stillsOnly: false });
  assert.deepEqual(parseMotionCommand(`node "${MOTION_CLI}" stage --out /abs/m --round 1 --stills-only`, '/w'), { mode: 'stage', out: '/abs/m', round: 1, stillsOnly: true });
  assert.equal(parseMotionCommand(`node "${MOTION_CLI}" cover-gate motion-x/cover.webp --strict`, '/w').out, null);
  assert.equal(parseMotionCommand(`node "${MOTION_CLI}" cover --out m --round 1 --window 2,2.5`, '/w').out, null);
  assert.equal(parseMotionCommand('ls motion-x', '/w'), null);
});

test('motion turn: activation names the skill file; with no render the Stop hook holds twice, then asks for a not-done reply', () => {
  const s = session();
  assert.equal(s.ignite.status, 0);
  assert.ok(injected(s.ignite).includes(join(PLUGIN, 'skills', 'lit-typographic-motion', 'SKILL.md')));
  const first = s.stop();
  assert.ok(held(first));
  assert.match(first.json.reason, /is not done: no render command ran under this route/);
  assert.ok(held(s.stop()));
  const notice = s.stop();
  assert.ok(held(notice));
  assert.match(notice.json.reason, /say plainly in the reply that it is not done/);
  assert.deepEqual(s.stop().json, {}, 'after the notice the turn may end');
});

test('motion turn: an unfinished cover points at references/cover.md; a finished one ends only after read_file opened its frames', () => {
  const s = session();
  const out = fakeCoverRun(join(s.ws.dir, 'motion-looptest'));
  s.shell(`node "${MOTION_CLI}" cover --out motion-looptest --round 1`);
  const heldFirst = s.stop();
  assert.ok(held(heldFirst));
  assert.match(heldFirst.json.reason, /\(cover mode\) is not done: .*references\/cover\.md/);
  const file = writeAnswers(out, coverAnswers());
  lookCommand({ out, round: 1, answersFile: file });
  bumpStillsRound(out, 2);
  lookCommand({ out, round: 2, answersFile: file });
  s.shell(`node "${MOTION_CLI}" cover --out motion-looptest --round 2`);
  const unopened = s.stop();
  assert.ok(held(unopened));
  assert.match(unopened.json.reason, /never opened with read_file/);
  for (const n of ['sheet', 'poster', 'seam']) s.read(join('motion-looptest', 'stills', `${n}.png`));
  s.read('README.md');
  const dir = join(s.env.XDG_STATE_HOME, 'litgravity', 'sessions');
  const [ws] = readdirSync(dir);
  const state = JSON.parse(readFileSync(join(dir, ws, `${CONV}.motion.json`), 'utf8'));
  assert.equal(state.viewed.length, 3, 'only images count as viewed');
  assert.deepEqual(s.stop().json, {});
});

test('motion turn: the older view_file spelling counts as opening an image', () => {
  const s = session();
  const out = fakeCoverRun(join(s.ws.dir, 'motion-looptest'));
  const file = writeAnswers(out, coverAnswers());
  lookCommand({ out, round: 1, answersFile: file });
  bumpStillsRound(out, 2);
  lookCommand({ out, round: 2, answersFile: file });
  s.shell(`node "${MOTION_CLI}" cover --out motion-looptest --round 2`);
  for (const n of ['sheet', 'poster', 'seam']) {
    runHook('post-tool-use', basePayload(s.ws, { toolCall: { name: 'view_file', args: { AbsolutePath: join(out, 'stills', `${n}.png`) } } }), s.env);
  }
  assert.deepEqual(s.stop().json, {});
});

test('motion turn: a render that wrote no manifest (a blocked or crashed run) is held, then reported as not done', () => {
  const s = session();
  s.shell(`node "${MOTION_CLI}" cover --out motion-x --round 1`);
  const first = s.stop();
  assert.ok(held(first));
  assert.match(first.json.reason, /treatment\.json is missing/);
  assert.ok(held(s.stop()));
  assert.match(s.stop().json.reason, /say plainly in the reply/);
  assert.deepEqual(s.stop().json, {});
});

test('motion turn: a finished cover with a generated base art holds once so the reply carries the label', () => {
  const s = session();
  const out = fakeCoverRun(join(s.ws.dir, 'motion-gen'));
  writeFileSync(join(out, 'assets.json'), JSON.stringify({ assets: [{ path: 'cover/assets/base.png', role: 'base-art', source: 'generated', sha256: 'a'.repeat(64), box: [0.125, 0, 0.75, 1] }] }));
  const file = writeAnswers(out, coverAnswers());
  lookCommand({ out, round: 1, answersFile: file });
  bumpStillsRound(out, 2);
  lookCommand({ out, round: 2, answersFile: file });
  s.shell(`node "${MOTION_CLI}" cover --out ${out} --round 2`);
  for (const n of ['sheet', 'poster', 'seam']) s.read(join(out, 'stills', `${n}.png`));
  const r = s.stop();
  assert.ok(held(r));
  assert.match(r.json.reason, /is generated, not supplied: label it as generated in the reply/);
  assert.deepEqual(s.stop().json, {});
});

test('motion turn: another route leaves the motion gate off and no motion state is written', () => {
  const s = session('lit plan a cover loop pipeline');
  const r = s.stop();
  assert.doesNotMatch(r.json?.reason ?? '', /lit-typographic-motion/);
  const dir = join(s.env.XDG_STATE_HOME, 'litgravity', 'sessions');
  const [ws] = readdirSync(dir);
  assert.ok(!readdirSync(join(dir, ws)).some((f) => f.endsWith('.motion.json')));
});

test('a new motion prompt re-arms the hold budget but keeps the renders and the images already opened', () => {
  const s = session();
  s.shell(`node "${MOTION_CLI}" cover --out motion-x --round 1`);
  s.stop();
  s.stop();
  turn(s.ws, s.env, 'lit motion another cover for LOOPTEST', 10);
  const dir = join(s.env.XDG_STATE_HOME, 'litgravity', 'sessions');
  const [ws] = readdirSync(dir);
  const state = JSON.parse(readFileSync(join(dir, ws, `${CONV}.motion.json`), 'utf8'));
  assert.equal(state.holds, 0);
  assert.equal(state.runs.length, 1);
});
