import test from 'node:test';
import assert from 'node:assert/strict';
import { detectRoute, deckIntent, frontendIntent, motionIntent, schematicIntent, SKILL_IDS, KEYWORD_ROUTES } from '../plugin/hooks/lib/routes.mjs';

// The routing checks of the moved skills, kept from their old body tests. The bodies left for wjgoarxiv-skills; the
// words, intents and near-miss rules that reach their stubs stay in LitGravity and must keep working.

test('frontend and ui keyword routes reach frontend-ui-ux', () => {
  assert.equal(KEYWORD_ROUTES.frontend, 'frontend-ui-ux');
  assert.equal(KEYWORD_ROUTES.ui, 'frontend-ui-ux');
  assert.equal(detectRoute('lit frontend build the settings page').route, 'frontend-ui-ux');
  assert.equal(detectRoute('lit ui redesign the header').route, 'frontend-ui-ux');
  assert.ok(SKILL_IDS.has('frontend-ui-ux'));
});

test('English and Korean build-intent routes to frontend-ui-ux under bare lit; backend, BI and explanations stay out', () => {
  for (const prompt of [
    'lit build a landing page for the product', 'lit create a dashboard showing the metrics', 'lit make a settings page with dark mode',
    'lit design the homepage layout', 'lit restyle the dashboard', 'lit 대시보드 페이지 만들어줘', 'lit 인터페이스 디자인해줘',
  ]) assert.equal(detectRoute(prompt).route, 'frontend-ui-ux', prompt);
  for (const prompt of [
    'lit build a backend API for the dashboard', 'lit explain CSS grid to me', 'lit build a Grafana dashboard',
    'lit create a docker image for the app', 'lit fix the database schema migration', 'lit build the API endpoint for login',
  ]) assert.notEqual(detectRoute(prompt).route, 'frontend-ui-ux', prompt);
  assert.ok(frontendIntent('build a landing page'));
  assert.ok(frontendIntent('대시보드 디자인해줘'));
  assert.ok(!frontendIntent('build the backend'));
  assert.ok(!frontendIntent('build a Grafana dashboard'));
});

test('schematic words and natural-language intent reach lit-schematic; near misses stay with their owners', () => {
  for (const word of ['schematic', 'pid', 'pfd', 'cutaway', '계통도', '공정도', '모식도', '장치도']) {
    assert.equal(detectRoute(`lit ${word} of the reactor`).route, 'lit-schematic', word);
  }
  for (const prompt of [
    'lit draw a P&ID of the hydrate reactor loop', 'lit 논문용 실험 장치 모식도 만들어줘', 'lit isometric cutaway of a stirred autoclave',
    'lit draw the PFD for the absorber section', 'lit 공정 계통도 그려줘',
  ]) assert.equal(detectRoute(prompt).route, 'lit-schematic', prompt);
  assert.notEqual(detectRoute('lit 단면도 데이터로 그래프 그려줘')?.route, 'lit-schematic');
  assert.notEqual(detectRoute('lit P&ID 설명 보고서 작성해줘')?.route, 'lit-schematic');
  assert.notEqual(detectRoute('lit P&ID 모니터링 대시보드 만들어줘')?.route, 'lit-schematic');
  assert.equal(detectRoute('lit diagram the service architecture').route, 'lit-diagram-drawer');
  assert.equal(schematicIntent('draw the schematic for the pump'), true);
  assert.equal(schematicIntent('schematic pump'), false, 'weak noun without a draw verb');
  assert.equal(schematicIntent('P&ID 모니터링 대시보드 만들어줘'), false, 'interface noun without a draw verb');
});

test('film requests in Korean and English reach lit-typographic-motion; editing, pages, decks and UI motion do not', () => {
  for (const p of [
    'lit 이 시 구절로 키네틱 타이포 영상 만들어줘', 'lit 회사 창립 기념 오프닝 타이틀 시퀀스 제작해줘', 'lit 새 앨범 가사 영상 하나 뽑아줘',
    'lit make a kinetic type video out of this haiku', 'lit render a lyric video for the chorus', 'lit make a seamless cover loop for this repository',
    'lit motion a README hero banner', 'lit 영상 봄 축제 오프닝', 'lit-typographic-motion 봄 축제 오프닝',
  ]) assert.equal(detectRoute(p)?.route, 'lit-typographic-motion', p);
  for (const p of [
    'lit 이 영상 잘라서 자막 넣어줘', 'lit trim this clip and add captions', 'lit embed a background video in the landing page',
    'lit 발표자료에 이 영상 넣어서 만들어줘', 'lit 유튜브 영상 썸네일 만들어줘', 'lit 버튼 호버 모션 만들어줘', 'lit design motion tokens for the checkout screen',
    'lit 신입 교육용 슬라이드 덱 만들어줘', 'make a lyric video', 'lit',
  ]) assert.notEqual(detectRoute(p)?.route, 'lit-typographic-motion', p);
  assert.equal(motionIntent('a quick explainer video about tide pools, please make it'), true);
  assert.equal(detectRoute('lit plan a lyric video pipeline')?.route, 'lit-plan', 'an explicit keyword still wins');
});

test('a deck asked for by slide count and a named style reaches lit-pptx; a photo count does not', () => {
  for (const prompt of [
    'lit 신규 서비스 투자 피칭 덱 10장, 네오 브루탈리즘 스타일로',
    'lit 사내 플랫폼 아키텍처 리뷰 발표자료 9장, 컴퓨테이셔널 브루탈리즘 스타일로',
    'lit 디자인사 강의 슬라이드 12장 바우하우스 느낌으로',
    'lit a 10-slide engineering review deck in computational brutalism style',
  ]) assert.equal(detectRoute(prompt)?.route, 'lit-pptx', prompt);
  assert.ok(deckIntent('a 10-slide deck in computational brutalism style'));
  assert.ok(!deckIntent('사진 10장 보정 스타일로'));
  assert.ok(!deckIntent('이미지 5장 편집'));
});
