import { sep } from 'node:path';

const FOREIGN_DIRS = new Set(['.claude', '.codex']);

// LitGravity writes only to its own plugin folder, its data directory and (on request) the agy settings file;
// another tool's home is never a destination.
export function assertSafeWritePath(target) {
  const parts = String(target).split(/[\\/]/).filter(Boolean);
  const hit = parts.find((p) => FOREIGN_DIRS.has(p));
  if (hit) throw new Error(`refused: LitGravity never writes under ${hit}${sep} (${target})`);
  return target;
}
