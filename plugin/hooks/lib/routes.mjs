// Route table for the prompt router, the session context and the installer's enrollment checks. Every skill that
// ships appears in SKILL_ROUTES exactly once; `test/routes.test.mjs` compares it with test/fixtures/family-skills.json.

export const SKILL_ROUTES = [
  { id: 'lit-loop', when: 'bare `lit`, or a multi-step task that needs criteria, tests and proof' },
  { id: 'litgoal', when: 'set, check or close a finish line that outlives this conversation' },
  { id: 'litwork', when: 'ship one contained change with proof: implement, fix, land' },
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
  { id: 'lit-scientific-visualization', when: 'a publication-ready figure from data' },
  { id: 'lit-diagram-drawer', when: 'an architecture, workflow or timeline diagram' },
  { id: 'lit-typographic-motion', when: 'a short film, kinetic type, lyric video or a seamless README cover loop' },
  { id: 'autoresearch', when: 'a budgeted experiment loop against a metric' },
  { id: 'structural-search', when: 'find or rewrite code by syntax shape' },
  { id: 'browser-drive', when: 'the answer only exists inside a running web page' },
  { id: 'lit-team', when: 'two or more child agents behind one durable team packet' },
  { id: 'autoconference', when: 'a budgeted research conference: parallel researchers, review, synthesis' },
  { id: 'rules', when: 'which rules, AGENTS.md files and skills agy loads, and in what order' },
  { id: 'lsp', when: 'diagnostics, definitions and references through checker CLIs' },
  { id: 'lsp-setup', when: 'set up and verify a language checker for this project' },
];

export const SKILL_IDS = new Set(SKILL_ROUTES.map((r) => r.id));

// The word after a leading `lit` picks the route: a word below, or any skill id typed whole (`lit debugging …`,
// `lit comment-checker …`); anything else falls back to lit-loop.
export const KEYWORD_ROUTES = {
  loop: 'lit-loop',
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
  diagram: 'lit-diagram-drawer',
  '다이어그램': 'lit-diagram-drawer',
  '도식': 'lit-diagram-drawer',
  figure: 'lit-scientific-visualization',
  plot: 'lit-scientific-visualization',
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

const RESTART_WORDS = new Set(['new', 'restart']);
const CONTINUE_WORDS = new Set(['continue', 'resume']);
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
    const bare = !restart && (word === '' || (resume && rest.slice(word.length).trim() === ''));
    const route = KEYWORD_ROUTES[word] ?? (SKILL_IDS.has(word) ? word : undefined);
    const base = { keyword: route ? word : null, bare, resume, restart, direct: false, empty: word === '' || (resume && rest.slice(word.length).trim() === '') };
    if (!route && !bare && !resume && motionIntent(rest)) return { route: 'lit-typographic-motion', ...base, keyword: null };
    const hit = { route: route ?? 'lit-loop', ...base };
    if (hit.route === 'review-work') {
      hit.reviewMode = REVIEW_MODES[firstWord(rest.slice(word.length).replace(SEPARATORS, ''))] ?? null;
    }
    return hit;
  }
  if (lower.startsWith('lit') && SKILL_IDS.has(lower)) return { route: lower, keyword: null, bare: false, resume: false, restart: false, direct: true, empty: false };
  if (SKILL_IDS.has(lower) && slash) return { route: lower, keyword: null, bare: false, resume: false, restart: false, direct: true, empty: false };
  return null;
}
