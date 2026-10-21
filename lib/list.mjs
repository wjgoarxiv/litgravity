import { relative, sep } from 'node:path';
import { PLUGIN_DIR, agentNames } from './bundle.mjs';
import { runtimeModules } from './runtime.mjs';
import { SKILL_ROUTES, KEYWORD_ROUTES } from '../plugin/hooks/lib/routes.mjs';

// The route listing a user can read without starting agy: every skill with the words that reach it, what it is for and
// the engine it installs on first use. It reads the same tables the router and the session context read.
// Skills that call an engine another skill ships: lit-docx runs on the office engine that lives in lit-pptx, and
// autoconference draws its figures with the sciviz engine.
export const SHARED_ENGINES = { 'lit-docx': 'office', autoconference: 'sciviz' };

export function routeRows() {
  const words = new Map();
  for (const [word, id] of Object.entries(KEYWORD_ROUTES)) words.set(id, [...(words.get(id) ?? []), word]);
  const engines = new Map();
  for (const m of runtimeModules()) {
    const parts = relative(PLUGIN_DIR, m.file).split(sep);
    if (parts[0] === 'skills') engines.set(parts[1], m.name);
  }
  return SKILL_ROUTES.map((r) => ({ id: r.id, words: words.get(r.id) ?? [], when: r.when, engine: engines.get(r.id) ?? SHARED_ENGINES[r.id] ?? null }));
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
    print(`${r.id}${r.engine ? ` [engine: ${r.engine}]` : ''}`);
    print(`  ${r.when}`);
    print(`  ${how}`);
  }
  print(`Agents: ${agents.join(', ')}`);
  return 0;
}
