import { existsSync, readFileSync } from 'node:fs';
import { paths } from './paths.mjs';
import { writeFileAtomic } from './safe-write.mjs';

const DAY = 24 * 60 * 60 * 1000;

// Asks the npm registry for the latest version at most once a day and caches the answer where the SessionStart hook
// can read it. Any failure counts as "unknown".
export async function checkUpdate(env = process.env) {
  if (env.LITGRAVITY_NO_UPDATE_CHECK) return { latest: null };
  const p = paths(env);
  try {
    if (existsSync(p.updateCache)) {
      const cache = JSON.parse(readFileSync(p.updateCache, 'utf8'));
      if (Date.now() - cache.checkedAt < DAY && typeof cache.latest === 'string') return { latest: cache.latest };
    }
  } catch { /* stale or unreadable cache: ask again */ }
  try {
    const res = await fetch('https://registry.npmjs.org/@litfamily%2flitgravity/latest', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { latest: null };
    const latest = (await res.json()).version;
    if (typeof latest !== 'string') return { latest: null };
    writeFileAtomic(p.updateCache, `${JSON.stringify({ latest, checkedAt: Date.now() })}\n`);
    return { latest };
  } catch {
    return { latest: null };
  }
}
