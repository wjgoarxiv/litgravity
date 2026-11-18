// The skill plan of a `lit <task>` prompt. The router still picks one primary route, exactly as before; this module
// adds the companions: the other intent routes the same task matched, in the router's priority order, without
// duplicates and capped, plus lit-crucible when the ask is a large or risky design. agy has no skill-loading tool, so
// the model reads each companion's SKILL.md with read_file when its part of the work starts. `lit +viz +ui <task>`
// names the plan outright.
//
// A moved skill (MOVED_SKILLS) is offered only when its standalone copy is installed for agy, in
// ~/.gemini/config/skills/<id>/ or the workspace's .agents/skills/<id>/; otherwise the plan names it once with the
// install command. A read-only primary (lit-adhd, review-work, litresearch, the brainstorms) never gains a companion
// that writes.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { PLUGIN_ROOT } from './common.mjs';
import { MOVED_SKILLS, SKILL_IDS, SKILL_ROUTES, companionIntents, extensionCommand } from './routes.mjs';

export const PLAN_CAP = 3;

// `lit +<alias>` names: short words a user can type without looking anything up. Any skill id works too.
export const PLAN_ALIASES = Object.freeze({
  viz: 'lit-scientific-visualization',
  plot: 'lit-scientific-visualization',
  figure: 'lit-scientific-visualization',
  ui: 'frontend-ui-ux',
  design: 'frontend-ui-ux',
  qa: 'visual-qa',
  crucible: 'lit-crucible',
  plan: 'lit-plan',
  research: 'litresearch',
  review: 'review-work',
  debug: 'debugging',
  deck: 'lit-pptx',
  slides: 'lit-pptx',
  pptx: 'lit-pptx',
  doc: 'lit-docx',
  docx: 'lit-docx',
  diagram: 'lit-diagram-drawer',
  schematic: 'lit-schematic',
  motion: 'lit-typographic-motion',
  video: 'lit-typographic-motion',
  readme: 'readme-studio',
  ast: 'structural-search',
  refactor: 'refactor',
  brainstorm: 'lit-brainstorm',
  ultra: 'ultra-brainstorm',
  humanize: 'lit-humanizer',
  commit: 'lit-commit',
});

// Routes that only read. A plan led by one of these keeps only companions from this set.
export const READ_ONLY_SKILLS = Object.freeze(new Set(['lit-adhd', 'review-work', 'litresearch', 'lit-brainstorm', 'ultra-brainstorm', 'lit-crucible', 'lit-comprehend']));
const READ_ONLY_PRIMARIES = new Set(['lit-adhd', 'review-work', 'litresearch', 'lit-brainstorm', 'ultra-brainstorm']);

// The skills the catalog may offer, each with its route-table purpose. Moved ones appear only when installed.
const CATALOG_IDS = ['lit-plan', 'lit-crucible', 'lit-brainstorm', 'ultra-brainstorm', 'litresearch', 'review-work', 'debugging', 'refactor',
  'structural-search', 'lit-humanizer', 'lit-commit', 'browser-drive', ...Object.keys(MOVED_SKILLS)];
const WHEN = new Map(SKILL_ROUTES.map((r) => [r.id, r.when.replace(/ \(moved\)$/u, '')]));

// Large or risky design asks: lit-crucible joins as the first companion. A request to explain or describe stays out.
const RISKY_DESIGN = /\b(?:redesign(?:ing)?|re-?architect(?:ure|ing)?|architecture|migrat(?:e|ion|ing)|overhaul(?:ing)?)\b|재설계|설계|아키텍처|마이그레이션|전면\s?개편/iu;
const EXPLAIN = /\b(?:explain|describe|summari[sz]e|what\s+is)\b|설명|요약/iu;
const DELIVERABLES = new Set(['lit-pptx', 'lit-docx', 'frontend-ui-ux', 'lit-scientific-visualization', 'lit-diagram-drawer', 'lit-schematic', 'lit-typographic-motion', 'readme-studio']);

export const wantsCrucible = (task, ids) => {
  if (EXPLAIN.test(task)) return false;
  return RISKY_DESIGN.test(task) || ids.filter((id) => DELIVERABLES.has(id)).length >= 3;
};

/** Text that only quotes something (a fence, inline code, a quoted span) routes nothing. */
export const inertStripped = (text) => String(text ?? '')
  .replace(/```[\s\S]*?(?:```|$)/gu, ' ')
  .replace(/`[^`\n]*`/gu, ' ')
  .replace(/"[^"\n]*"|“[^”\n]*”|'[^'\n]{3,}'|「[^」\n]*」/gu, ' ');

/** Where agy would load an installed standalone copy of a moved skill from, or null. */
export const installedCopy = (id, { env = process.env, workspace = null } = {}) => {
  const home = env.HOME || homedir();
  const candidates = [
    ...(workspace ? [join(workspace, '.agents', 'skills', id, 'SKILL.md')] : []),
    join(home, '.gemini', 'config', 'skills', id, 'SKILL.md'),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
};

/** `+viz +ui` → skill ids in the user's order, plus the names nothing knows. */
export const resolveForced = (names) => {
  const skills = [];
  const unknown = [];
  for (const name of names ?? []) {
    const id = PLAN_ALIASES[name] ?? (SKILL_IDS.has(name) ? name : null);
    if (!id) unknown.push(name);
    else if (!skills.includes(id)) skills.push(id);
  }
  return { skills, unknown };
};

/**
 * The ordered plan for a routed hit, or null when the plan is the primary alone (an ordinary prompt's activation
 * stays exactly as it was). `hit.task` is the task text, `hit.forced` the `+name` words.
 */
export const buildSkillPlan = (hit, { env = process.env, workspace = null } = {}) => {
  const primary = hit?.route;
  if (typeof primary !== 'string' || !primary) return null;
  const forced = Array.isArray(hit.forced) ? resolveForced(hit.forced) : null;
  const task = inertStripped(hit.task ?? '');
  const readOnly = READ_ONLY_PRIMARIES.has(primary);
  const dropped = [];
  let picked;
  if (forced) {
    picked = forced.skills.filter((id) => id !== primary);
  } else {
    picked = companionIntents(task).filter((id) => id !== primary);
    if (!readOnly && primary !== 'lit-crucible' && wantsCrucible(`${hit.keyword ?? ''} ${task}`, [primary, ...picked])) picked.unshift('lit-crucible');
  }
  picked = [...new Set(picked)].filter((id) => {
    if (readOnly && !READ_ONLY_SKILLS.has(id)) {
      dropped.push({ id, why: `${primary} is read-only` });
      return false;
    }
    return true;
  });
  for (const id of picked.slice(PLAN_CAP - 1)) dropped.push({ id, why: 'over the cap of 3' });
  picked = picked.slice(0, PLAN_CAP - 1);
  if (picked.length === 0 && !forced) return null;
  const entries = [primary, ...picked].map((id) => {
    const moved = Boolean(MOVED_SKILLS[id]);
    const copy = moved ? installedCopy(id, { env, workspace }) : null;
    return { id, moved, family: MOVED_SKILLS[id] ?? null, path: moved ? copy : join(PLUGIN_ROOT, 'skills', id, 'SKILL.md'), installed: moved ? Boolean(copy) : true };
  });
  return { entries, dropped, forced: Boolean(forced), unknown: forced?.unknown ?? [], readOnly };
};

const label = (entry, index) => {
  const lead = index === 0 ? ' (primary)' : '';
  if (!entry.moved) return `${entry.id}${lead}`;
  if (entry.installed) return `${entry.id}${lead} (${entry.family} extension)`;
  return `${entry.id}${lead} (not installed: ${extensionCommand(entry.id)})`;
};

/** `Skill plan: 1 lit-loop (primary) → 2 lit-scientific-visualization (figures extension) → 3 …` */
export const skillPlanLine = (plan) => `Skill plan: ${plan.entries.map((entry, index) => `${index + 1} ${label(entry, index)}`).join(' → ')}`;

const catalogLines = (plan, env, workspace) => {
  const inPlan = new Set(plan.entries.map(({ id }) => id));
  return CATALOG_IDS
    .filter((id) => !inPlan.has(id))
    .filter((id) => !plan.readOnly || READ_ONLY_SKILLS.has(id))
    .filter((id) => !MOVED_SKILLS[id] || installedCopy(id, { env, workspace }))
    .map((id) => `${id} — ${WHEN.get(id)}`);
};

/** The model-facing block: fixed text around the plan. Nothing from the prompt is echoed. */
export const skillPlanContext = (plan, { env = process.env, workspace = null } = {}) => {
  const lines = [skillPlanLine(plan)];
  if (plan.forced) {
    lines.push('The user named this plan with `lit +…`: keep it exactly, add nothing and drop nothing.');
    if (plan.unknown.length) lines.push(`Ignored unknown plan names: ${plan.unknown.map((name) => `+${name}`).join(' ')}.`);
  } else {
    lines.push('The companions after the primary are candidates the router matched, not orders: confirm or drop each one for this request, and add at most one skill from the catalog below when the work clearly needs it.');
  }
  for (const { id, why } of plan.dropped) lines.push(`Left out: ${id} (${why}).`);
  lines.push('State the final plan on the line right after the ignition line, in the same `Skill plan: 1 … → 2 …` form. The primary is the skill named above; read each companion\'s SKILL.md with read_file only when its part of the work starts, never all up front. A skill marked not installed is not read: give its install command once and carry on without it.');
  const paths = plan.entries.slice(1).filter((entry) => entry.installed).map((entry) => `${entry.id}: ${entry.path}`);
  if (paths.length) lines.push(`Companion files: ${paths.join('; ')}.`);
  const catalog = plan.forced ? [] : catalogLines(plan, env, workspace);
  if (catalog.length) lines.push(`Catalog (installed here): ${catalog.join('; ')}.`);
  return lines.join('\n');
};

/** The plan's skill ids, for the ledger line. */
export const skillPlanIds = (plan) => (plan ? plan.entries.map(({ id }) => id) : []);
