import { agentNames } from './bundle.mjs';
import { SKILL_ROUTES, KEYWORD_ROUTES, MOVED_SKILLS, movedInstallLine } from '../plugin/hooks/lib/routes.mjs';

// The route listing a user can read without starting agy: every skill with the words that reach it, what it is for and,
// for a skill that moved to wjgoarxiv-skills, the plugin that holds it now. It reads the same tables the router and the
// session context read.

export function routeRows() {
  const words = new Map();
  for (const [word, id] of Object.entries(KEYWORD_ROUTES)) words.set(id, [...(words.get(id) ?? []), word]);
  return SKILL_ROUTES.map((r) => ({ id: r.id, words: words.get(r.id) ?? [], when: r.when, moved: MOVED_SKILLS[r.id] ?? null }));
}

export function list({ flags = {}, print = console.log }) {
  const rows = routeRows();
  const agents = agentNames();
  if (flags.json) {
    print(JSON.stringify({ product: 'litgravity', skills: rows, agents }, null, 2));
    return 0;
  }
  print('LitGravity routes: type `lit <word> <task>` in agy, or `/litgravity:<skill-id>`; a bare `lit` runs lit-loop.');
  for (const r of rows) {
    const how = [`lit ${r.id}`, ...r.words.map((w) => `lit ${w}`)].join(' · ');
    print(`${r.id}${r.moved ? ` [moved: wjgoarxiv-skills ${r.moved}]` : ''}`);
    print(`  ${r.when}`);
    print(`  ${how}`);
  }
  if (rows.some((r) => r.moved)) print(`A moved skill installs with: ${movedInstallLine('<id>')}`);
  print(`Agents: ${agents.join(', ')}`);
  return 0;
}
