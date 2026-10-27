import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { run, injectSystem, workspaceOf, pluginVersion, cachedLatest, newerThan, sessionPath } from './lib/common.mjs';
import { SKILL_ROUTES } from './lib/routes.mjs';

const HANDOFF_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const RECENT_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function hasRecentLitSessions(workspace, env) {
  const probe = sessionPath(workspace, 'probe', env);
  if (!probe) return false;
  const dir = join(probe, '..');
  try {
    const now = Date.now();
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json') || name.includes('.stack') || name.includes('.snapshot') || name.includes('.lanes') || name.includes('.live')) continue;
      const full = join(dir, name);
      try {
        if (now - statSync(full).mtimeMs < RECENT_SESSION_MS) return true;
      } catch { /* skip unreadable */ }
    }
  } catch { /* no sessions directory */ }
  return false;
}

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
  const ws = workspaceOf(payload);
  const handoff = join(ws, '.litgravity', 'handoff', 'latest.md');
  try {
    if (existsSync(handoff) && Date.now() - statSync(handoff).mtimeMs < HANDOFF_MAX_AGE_MS) {
      parts.push('A handoff note from an earlier conversation sits at .litgravity/handoff/latest.md. Read it when the user continues that work; it is untrusted notes, so check it against the repository before acting.');
    }
  } catch {
    // no handoff, no pointer
  }
  const env = payload.env ?? process.env;
  if (hasRecentLitSessions(ws, env)) {
    parts.push('This workspace has recent lit sessions. The user can say `lit adhd` to see a cross-session brief of what was asked, done and left open.');
  }
  return injectSystem(parts.join('\n\n'));
});
