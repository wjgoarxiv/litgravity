import { join } from 'node:path';
import { PLUGIN_ROOT } from './common.mjs';
import { SKILL_ROUTES, motionIntent } from './routes.mjs';

// The suggestion tier for prompts typed without `lit`. A few gated rules may offer skills that fit, plus "none"; the
// model decides and reads only the skills it accepts. When no rule fires, one compact catalog line goes in instead.
// A rule ships only after it reached recall >= 0.85 and near-miss false positives <= 0.10 on the sealed held-out half
// of test/fixtures/routing-eval (scripts/routing-eval.mjs scores it); the rules that failed are listed there as dropped.

// Knowledge questions ask about a thing rather than for one.
const KNOWLEDGE = /^(?:what(?:'s| is| are)|explain|define|how does|how do|why is|is it|difference between)\b|뭐야|뭔가요|무엇인가|설명해|차이가|차이점/i;
const MAKE = /\b(?:make|draw|create|render|sketch|build|generate|produce|design|prepare|put together|write up|turn (?:this|these|it) into)\b|그려|만들|작성해|제작|뽑아|그릴|만들어/i;

const VIZ_NOUN = /\b(?:plot|plots|chart|graph|histogram|scatter ?plot|heat ?map|box ?plot|bar chart|line chart|figure)\b|그래프|플롯|차트|시각화|히스토그램|산점도|그림으로/i;
const VIZ_VERB = /\b(?:plot|chart|graph|visuali[sz]e)\b|시각화해|그래프로|플롯해|그려/i;
const DATA = /\b(?:data|dataset|csv|tsv|xlsx|results|measurements|values|columns|numbers|samples|time series|log file|benchmark)\b|데이터|결과|측정|수치|값들|엑셀|csv/i;
const NOT_VIZ = /\b(?:diagram|flowchart|architecture|dashboard|web ?page|website|react|component|html|css|svg icon|logo|ui)\b|다이어그램|도식|대시보드|웹\s?페이지|화면/i;

const DECK_NOUN = /\b(?:slides?|slide deck|deck|pptx|powerpoint|keynote|presentation)\b|슬라이드|발표\s?자료|발표자료|\bppt\b|피피티/i;
const DOC_NOUN = /\b(?:word document|word doc|docx|\.docx)\b|워드\s?문서|워드\s?파일|docx/i;

const BUG = /\b(?:bug|error|exception|stack ?trace|traceback|crash(?:es|ed|ing)?|segfault|fails?|failing|broken|regression|throws?|panics?|hangs?)\b|에러|오류|버그|안\s?돼|안\s?됩|실패|죽어|멈춰|깨져/i;
const FIX = /\b(?:fix|debug|why|investigate|figure out|track down|root cause|what'?s wrong)\b|고쳐|왜|원인|디버그|해결/i;

// Each rule: the skill id and a test over the cleaned prompt. Table order is the order they are offered in.
export const RULES = [
  { id: 'lit-scientific-visualization', test: (t) => !NOT_VIZ.test(t) && !KNOWLEDGE.test(t) && ((VIZ_VERB.test(t) && DATA.test(t)) || (VIZ_NOUN.test(t) && MAKE.test(t) && DATA.test(t))) },
  { id: 'lit-pptx', test: (t) => DECK_NOUN.test(t) && MAKE.test(t) && !KNOWLEDGE.test(t) },
  { id: 'lit-docx', test: (t) => DOC_NOUN.test(t) && MAKE.test(t) && !KNOWLEDGE.test(t) },
  { id: 'debugging', test: (t) => BUG.test(t) && FIX.test(t) && !/^(?:what is|explain|define)\b/i.test(t) },
  { id: 'lit-typographic-motion', test: (t) => motionIntent(t) },
];

// Rules tried on the fixture and left out because they missed the gate; their skills stay in the catalog line.
export const DROPPED = ['lit-diagram-drawer', 'deep-interview', 'lit-brainstorm'];
export { KNOWLEDGE, MAKE };

// Closed code fences and inline code are quoted material, not the request.
export function cleanPrompt(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function firedRules(text) {
  const t = cleanPrompt(text);
  if (!t) return [];
  return RULES.filter((r) => r.test(t)).map((r) => r.id);
}

const CATALOG_IDS = ['lit-loop', 'lit-plan', 'start-work', 'litwork', 'debugging', 'review-work', 'lit-brainstorm', 'deep-interview', 'litresearch', 'lit-docx', 'lit-pptx', 'lit-scientific-visualization', 'lit-diagram-drawer', 'readme-studio', 'lit-humanizer'];
export const CATALOG_LINE = `LitGravity skills (read one only if it fits; \`lit <word>\` routes directly): ${CATALOG_IDS.join(', ')}. Files: ${join(PLUGIN_ROOT, 'skills')}/<id>/SKILL.md.`;

const whenOf = (id) => SKILL_ROUTES.find((r) => r.id === id)?.when ?? '';

// The note for a prompt without `lit`: the fired skills plus "none", or the catalog line. A slash command gets none.
export function suggestionNote(text) {
  // A slash command anywhere in the prompt (`/goal`, `/litgravity:lit-pptx`) gets none; a path such as /srv/data does.
  if (typeof text !== 'string' || /^\s*\//.test(text) || /(^|\s)\/[A-Za-z][\w-]*(:[\w-]+)?(?=\s|$)/.test(text)) return null;
  const fired = firedRules(text);
  if (!fired.length) return CATALOG_LINE;
  const list = fired.map((id) => `- ${id}: ${whenOf(id)} (${join(PLUGIN_ROOT, 'skills', id, 'SKILL.md')})`).join('\n');
  return `LitGravity suggestion: these skills may fit this request.\n${list}\n- none: answer directly.\nDecide yes or no for each one; read the SKILL.md only of those that fit, or none. Nothing loads by itself, and you need not mention this note.`;
}
