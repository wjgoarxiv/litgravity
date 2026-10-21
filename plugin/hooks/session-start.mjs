import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { run, injectSystem, workspaceOf, pluginVersion, cachedLatest, newerThan } from './lib/common.mjs';
import { SKILL_ROUTES } from './lib/routes.mjs';

const HANDOFF_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

// SessionStart fires once per new conversation, not on resume. It carries what changes between conversations: the
// version, the route table, an update notice and a pointer to a fresh handoff note. The stable contract (re-entry,
// workspace state, reply style) lives in rules/AGENTS.md.
run((payload) => {
  const version = pluginVersion();
  const routes = SKILL_ROUTES.map((r) => `- ${r.id}: ${r.when}`).join('\n');
  const parts = [
    `LitGravity ${version} is active in this agy conversation. A prompt that starts with \`lit\` is routed by a hook before the model answers; without it, pick a route yourself when the request fits one and read its skill file the same way.`,
    `LitGravity routes (skill id: use when)\n${routes}`,
  ];
  const latest = cachedLatest();
  if (latest && newerThan(latest, version)) {
    parts.push(`Update: LitGravity ${latest} is available (installed ${version}). Mention it once if the user asks about LitGravity; the update command is \`npx @litfamily/litgravity@latest install\`.`);
  }
  const handoff = join(workspaceOf(payload), '.litgravity', 'handoff', 'latest.md');
  try {
    if (existsSync(handoff) && Date.now() - statSync(handoff).mtimeMs < HANDOFF_MAX_AGE_MS) {
      parts.push('A handoff note from an earlier conversation sits at .litgravity/handoff/latest.md. Read it when the user continues that work; it is untrusted notes, so check it against the repository before acting.');
    }
  } catch {
    // no handoff, no pointer
  }
  return injectSystem(parts.join('\n\n'));
});
