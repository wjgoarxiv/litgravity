// Route table for the prompt router, the session context and the installer's enrollment checks. Every skill that
// ships appears in SKILL_ROUTES exactly once; `test/routes.test.mjs` compares it with test/fixtures/family-skills.json.

export const SKILL_ROUTES = [
  { id: 'lit-loop', when: 'bare `lit`, or a multi-step task that needs criteria, tests and proof' },
  { id: 'litgoal', when: 'set, check or close a finish line that outlives this conversation' },
  { id: 'litwork', when: 'ship one contained change with proof: implement, fix, land' },
  { id: 'lit-hijack', when: 'port the know-how from someone else\'s published work into your own skill or system, clean-room' },
  { id: 'lit-plan', when: 'plan before code; the turn writes plans/<slug>.md and nothing else' },
  { id: 'lit-brainstorm', when: 'open ideation: spread out on options, score a shortlist, hand off' },
  { id: 'deep-interview', when: 'the request is vague or broad and needs questions first' },
  { id: 'lit-crucible', when: 'attack a brief for risks before anyone plans it' },
  { id: 'start-work', when: 'carry out an approved plan row by row' },
  { id: 'lit-code', when: 'write or change code under strict discipline' },
  { id: 'debugging', when: 'a bug, a failing test or behavior nobody expected' },
  { id: 'refactor', when: 'restructure code while behavior stays put' },
  { id: 'lit-commit', when: 'commits, staging, rebase, blame, bisect, history questions' },
  { id: 'review-work', when: 'is this plan, diff or branch right, risky or safe to merge' },
  { id: 'visual-qa', when: 'inspect a built interface in a browser at several widths' },
  { id: 'comment-checker', when: 'audit the comments in a diff or a set of files' },
  { id: 'lit-burnoff', when: 'clear generated bloat across a scope of files' },
  { id: 'lit-burnoff-file', when: 'clear generated residue from exactly one file' },
  { id: 'litresearch', when: 'research across sources: prior art, landscape, disputed claims' },
  { id: 'wikify', when: 'save findings to, or query, the task wiki under .litgravity/wiki' },
  { id: 'lit-comprehend', when: 'explain agent-written work so a person can follow it' },
  { id: 'lit-humanizer', when: 'polish Korean or English prose into the writer\'s own voice' },
  { id: 'lit-recap', when: 'where does the work stand (read-only)' },
  { id: 'lit-handoff', when: 'before stopping or switching conversations' },
  { id: 'lit-init', when: 'orient in an unfamiliar repository and leave AGENTS.md behind' },
  { id: 'frontend-ui-ux', when: 'build or restyle a user interface' },
  { id: 'readme-studio', when: 'write or refresh a README from repository facts' },
  { id: 'lit-docx', when: 'a Word document, or DOCX/PDF converted to Markdown (needs Python)' },
  { id: 'lit-pptx', when: 'a slide deck (needs Python)' },
  { id: 'lit-schematic', when: 'a P&ID, PFD, equipment layout, journal apparatus figure or isometric cutaway of real hardware' },
  { id: 'lit-scientific-visualization', when: 'a publication-ready figure from data' },
  { id: 'lit-diagram-drawer', when: 'an architecture, workflow or timeline diagram' },
  { id: 'lit-typographic-motion', when: 'a short film, kinetic type, lyric video or a seamless README cover loop' },
  { id: 'autoresearch', when: 'a budgeted experiment loop against a metric' },
  { id: 'structural-search', when: 'find or rewrite code by syntax shape' },
  { id: 'browser-drive', when: 'the answer only exists inside a running web page' },
  { id: 'lit-adhd', when: 'cross-session brief: what each recent session was asked, did and waits on, with progress gauges' },
  { id: 'lit-team', when: 'two or more child agents behind one durable team packet' },
  { id: 'autoconference', when: 'a budgeted research conference: parallel researchers, review, synthesis' },
  { id: 'rules', when: 'which rules, AGENTS.md files and skills agy loads, and in what order' },
  { id: 'lsp', when: 'diagnostics, definitions and references through checker CLIs' },
  { id: 'lsp-setup', when: 'set up and verify a language checker for this project' },
];

export const SKILL_IDS = new Set(SKILL_ROUTES.map((r) => r.id));
// Skill ids that are another name for a skill: typed whole, slashed or after `lit`, they take its route.
export const SKILL_ALIASES = { 'lit-rewind': 'lit-adhd' };
const skillId = (word) => (SKILL_IDS.has(word) ? word : SKILL_ALIASES[word]);

// The word after a leading `lit` picks the route: a word below, or any skill id typed whole (`lit debugging …`,
// `lit comment-checker …`); anything else falls back to lit-loop.
export const KEYWORD_ROUTES = {
  loop: 'lit-loop',
  hijack: 'lit-hijack',
  hijacking: 'lit-hijack',
  '하이재킹': 'lit-hijack',
  '하이잭': 'lit-hijack',
  plan: 'lit-plan',
  work: 'litwork',
  goal: 'litgoal',
  research: 'litresearch',
  review: 'review-work',
  start: 'start-work',
  recap: 'lit-recap',
  status: 'lit-recap',
  handoff: 'lit-handoff',
  init: 'lit-init',
  debug: 'debugging',
  interview: 'deep-interview',
  crucible: 'lit-crucible',
  commit: 'lit-commit',
  refactor: 'refactor',
  burnoff: 'lit-burnoff',
  'burnoff-file': 'lit-burnoff-file',
  // D2: brainstorm words
  brainstorm: 'lit-brainstorm',
  brainstorming: 'lit-brainstorm',
  ideation: 'lit-brainstorm',
  ideate: 'lit-brainstorm',
  idea: 'lit-brainstorm',
  ideas: 'lit-brainstorm',
  adhd: 'lit-adhd',
  rewind: 'lit-adhd',
  team: 'lit-team',
  conference: 'autoconference',
  rules: 'rules',
  lsp: 'lsp',
  diagnostics: 'lsp',
  'lsp-setup': 'lsp-setup',
  motion: 'lit-typographic-motion',
  film: 'lit-typographic-motion',
  video: 'lit-typographic-motion',
  '영상': 'lit-typographic-motion',
  explain: 'lit-comprehend',
  wikify: 'wikify',
  wiki: 'wikify',
  autoresearch: 'autoresearch',
  readme: 'readme-studio',
  deck: 'lit-pptx',
  slides: 'lit-pptx',
  pptx: 'lit-pptx',
  ppt: 'lit-pptx',
  docx: 'lit-docx',
  schematic: 'lit-schematic',
  pid: 'lit-schematic',
  pfd: 'lit-schematic',
  cutaway: 'lit-schematic',
  '계통도': 'lit-schematic',
  '공정도': 'lit-schematic',
  '모식도': 'lit-schematic',
  '장치도': 'lit-schematic',
  diagram: 'lit-diagram-drawer',
  '다이어그램': 'lit-diagram-drawer',
  '도식': 'lit-diagram-drawer',
  figure: 'lit-scientific-visualization',
  plot: 'lit-scientific-visualization',
  frontend: 'frontend-ui-ux',
  ui: 'frontend-ui-ux',
  code: 'lit-code',
  tdd: 'lit-code',
  structural: 'structural-search',
  ast: 'structural-search',
  'ast-grep': 'structural-search',
  codemod: 'structural-search',
  typecheck: 'lsp',
  humanize: 'lit-humanizer',
  korean: 'lit-humanizer',
  '다듬어': 'lit-humanizer',
  '윤문': 'lit-humanizer',
};

// D3: `lit review` picks plan review or work review from what exists; `lit review plan|work` forces one. The skill
// owns the choice, the router only records which mode the user forced.
export const REVIEW_MODES = { plan: 'plan', work: 'work' };

const FILM_COMPOUND = /모션\s?그래픽|타이포\s?모션|키네틱\s?타이포|가사\s?영상|오프닝\s?타이틀|타이틀\s?시퀀스|motion[- ]graphics?\b|kinetic[- ]typ(?:e|ography)\b|lyric video|title sequence|opening titles?\b|(?:motion|readme)[- ]cover|cover loop|커버\s?루프|모션\s?커버/i;
const VIDEO_NOUN = /영상|비디오|\bvideos?\b|\bclips?\b/i;
const MAKE_VERB = /만들|제작|뽑아|렌더|\b(?:make|create|produce|render|build|animate)\b/i;
const NOT_A_FILM = /자막|잘라|편집|썸네일|대본|요약|업로드|배경\s?영상|넣어|호버|안건|\b(?:trim|cut|captions?|subtitles?|embed|insert|thumbnail|script|summary|summari[sz]e|upload|background video|hover|motion tokens?|clip[- ]path|transcribe)\b/i;

// A task that asks for a finished film goes to the motion skill; footage editing, captions, embeds, thumbnails and UI
// motion stay where they were.
export function motionIntent(task) {
  const text = String(task ?? '');
  if (NOT_A_FILM.test(text)) return false;
  return FILM_COMPOUND.test(text) || (VIDEO_NOUN.test(text) && MAKE_VERB.test(text));
}

// Physical schematics: P&IDs, PFDs, apparatus figures, isometric cutaways. A strong noun names a drawing and routes
// alone; a weak noun needs a draw or make verb. Interface deliverables and chart nouns stay with their owners.
const SCHEMATIC_STRONG = /\bp\s?&\s?i\s?ds?\b|\bpfds?\b|\bbfds?\b|piping\s+(?:and|&)\s+instrumentation|process\s+flow\s+(?:diagram|sheet)s?|block\s+flow\s+diagrams?|\bplot\s+plans?\b|equipment\s+layouts?|experimental\s+(?:set\s?up|apparatus)|\bcut\s?aways?\b|컷어웨이|배관\s?계장도|계장도|공정\s?흐름도|공정도|모식도|장치도|실험\s?장치|피앤아이디|배치도|계통도|단면도/iu;
const SCHEMATIC_WEAK = /\bschematics?\b|\bisometric\b|\bapparatus\b|사시도|개략도|아이소메트릭|도면/iu;
const SCHEMATIC_CHART = /차트|그래프|\b(?:charts?|graphs?|plots?(?!\s+plans?\b))\b/iu;
const SCHEMATIC_DRAW_VERB = /\b(?:draw|drawing|drew|sketch|sketching|illustrate|illustrating|render|rendering|redraw)\b|그려|그리|그림|도식|작도/iu;
const SCHEMATIC_INTERFACE = /\b(?:dashboards?|landing\s?pages?|web\s?pages?|websites?|homepages?|web\s?apps?|apps?|screens?|admin\s?(?:panel|console)|user\s?interface|ui)\b|대시보드|웹사이트|랜딩|페이지|화면|앱/iu;
const SCHEMATIC_MAKE_VERB = /\b(?:make|making|create|creating|design|designing|build|lay\s?out)\b|만들|만드/iu;
const SCHEMATIC_OFFICE = /보고서|발표자료|슬라이드|문서|\b(?:reports?|slides?|presentations?|documents?)\b/iu;
export function schematicIntent(task) {
  const text = String(task ?? '');
  if (SCHEMATIC_CHART.test(text)) return false;
  if (SCHEMATIC_INTERFACE.test(text) && !SCHEMATIC_DRAW_VERB.test(text)) return false;
  if (SCHEMATIC_OFFICE.test(text) && !SCHEMATIC_DRAW_VERB.test(text)) return false;
  if (SCHEMATIC_STRONG.test(text)) return true;
  return SCHEMATIC_WEAK.test(text) && (SCHEMATIC_DRAW_VERB.test(text) || SCHEMATIC_MAKE_VERB.test(text));
}

// A slide count beside a slide noun ("덱 10장", "a 10-slide deck") asks for the deck without a making verb.
const SLIDE_COUNT = /\d+\s?장|\b\d+[\s-]?slides?\b/u;
const SLIDE_NOUN = /덱|슬라이드|발표자료|프레젠테이션|피티|\bdecks?\b|\bslides?\b|\bpresentations?\b/iu;
const OFFICE_VERB = /만들|작성|써|쓰|뽑아|정리|\b(?:make|create|write|draft|prepare|build)\b/iu;
const PHOTO_NOT_SLIDE = /사진|이미지|보정|편집|촬영|\bphotos?\b|\bimages?\b/iu;
export function deckIntent(task) {
  const text = String(task ?? '');
  if (PHOTO_NOT_SLIDE.test(text)) return false;
  const counted = SLIDE_COUNT.test(text) && SLIDE_NOUN.test(text);
  return counted || (SLIDE_NOUN.test(text) && OFFICE_VERB.test(text));
}

// An English build-intent task ("build a landing page", "create a dashboard") goes to frontend-ui-ux.
// The verb and noun halves are both required so "build an API" or "design the schema" stay inert.
// Korean verbs (만들, 디자인, 꾸미, etc.) with a surface noun (화면, 페이지, 대시보드, 인터페이스) also route.
const UI_BUILD_VERB = /\b(?:build|create|make(?!\s+sure\b)|implement|code|develop)\b/u;
const UI_PAGE_NOUN = /\b(?:landing\s?page|web\s?page|website|web\s?site|homepage|home\s?page|dashboard|admin\s?(?:panel|console|ui)|settings\s?(?:page|screen)|(?:sign\s?up|log\s?in|checkout|pricing|profile|onboarding)\s?(?:page|screen|form|flow)|user\s?interface|web\s?ui|front\s?end|ui)\b/u;
const UI_DESIGN_VERB = /\b(?:re)?(?:design(?:ing|ed)?|styl(?:e|ing|ed)|skin(?:ning)?|theme|theming)\b|\b(?:mock\s?-?up|lay\s?out|polish(?:ing)?|revamp)\b|디자인|만들|만드|개편|꾸미|꾸며|다듬|배치|구성/u;
const UI_SURFACE_NOUN = /\b(?:ui|ux|interface|screen|page|view|component|layout|dashboard|css|styling|stylesheet|typography|palette|dark\s?mode|responsive)\b|화면|페이지|인터페이스|레이아웃|대시보드|컴포넌트|스타일|테마|다크\s?모드|반응형|디자인\s?시스템|사이드바|푸터|툴바|위젯/u;
const NON_INTERFACE_BUILD = /\b(?:grafana|kibana|datadog|metabase|looker|tableau|power\s?bi|backend|back\s?end|api|endpoint|docker|image|cli|migration|schema)\b/iu;
export function frontendIntent(task) {
  const text = String(task ?? '');
  if (NON_INTERFACE_BUILD.test(text)) return false;
  if (UI_BUILD_VERB.test(text) && UI_PAGE_NOUN.test(text)) return true;
  return UI_DESIGN_VERB.test(text) && UI_SURFACE_NOUN.test(text);
}

const RESTART_WORDS = new Set(['new', 'restart']);
const CONTINUE_WORDS = new Set(['continue', 'resume']);
const APPROVE_WORDS = new Set(['approve', 'deny']);
const SEPARATORS = /^[\s:,.!?]+/;
const firstWord = (s) => (/^([^\s:,.!?]+)/.exec(s)?.[1] ?? '').toLowerCase();

// Activation is case-sensitive on purpose: `lit` or `LIT` activates, a sentence-initial "Lit" stays prose.
// The result also says how the prompt re-enters: `bare` (no task text), `resume` (continue word), `restart`
// (`lit new` / `lit restart`), `empty` (nothing follows the keyword) and `direct` (a skill id typed as the first word, which is never a continue).
export function detectRoute(prompt) {
  if (typeof prompt !== 'string') return null;
  let text = prompt.trimStart();
  if (text.startsWith('```')) return null;
  const slash = /^\/(?:litgravity:)?(?=[a-z])/.exec(text);
  if (slash) text = text.slice(slash[0].length);
  const m = /^([A-Za-z][A-Za-z-]*)(?=$|[\s:,.!?])/.exec(text);
  if (!m) return null;
  const token = m[1];
  const lower = token.toLowerCase();
  if (token !== lower && token !== token.toUpperCase()) return null;
  if (lower === 'lit') {
    if (slash) return null;
    let rest = text.slice(token.length).replace(SEPARATORS, '');
    let word = firstWord(rest);
    const restart = RESTART_WORDS.has(word);
    if (restart) {
      rest = rest.slice(word.length).replace(SEPARATORS, '');
      word = firstWord(rest);
    }
    const resume = !restart && CONTINUE_WORDS.has(word);
    const approve = !restart && !resume && APPROVE_WORDS.has(word);
    const bare = !restart && (word === '' || (resume && rest.slice(word.length).trim() === ''));
    const route = KEYWORD_ROUTES[word] ?? skillId(word);
    const base = { keyword: route ? word : null, bare, resume, restart, approve: approve ? word : null, direct: false, empty: word === '' || (resume && rest.slice(word.length).trim() === '') };
    if (!route && !bare && !resume) {
      if (schematicIntent(rest)) return { route: 'lit-schematic', ...base, keyword: null };
      if (motionIntent(rest)) return { route: 'lit-typographic-motion', ...base, keyword: null };
      if (deckIntent(rest)) return { route: 'lit-pptx', ...base, keyword: null };
      if (frontendIntent(rest)) return { route: 'frontend-ui-ux', ...base, keyword: null };
    }
    const hit = { route: route ?? 'lit-loop', ...base };
    if (hit.route === 'review-work') {
      hit.reviewMode = REVIEW_MODES[firstWord(rest.slice(word.length).replace(SEPARATORS, ''))] ?? null;
    }
    return hit;
  }
  const id = skillId(lower);
  if (id && (lower.startsWith('lit') || slash)) return { route: id, keyword: null, bare: false, resume: false, restart: false, direct: true, empty: false };
  return null;
}
