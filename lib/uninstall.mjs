import { rmSync, existsSync, readFileSync } from 'node:fs';
import { paths, destination } from './paths.mjs';
import { destState } from './bundle.mjs';
import { assertSafeWritePath } from './guard.mjs';
import { removeStatusLine, isOurs, replacedStatusLine, stripBom } from './statusline.mjs';

function ourStatusLine(p) {
  try {
    return existsSync(p.agySettings) && isOurs(JSON.parse(stripBom(readFileSync(p.agySettings, 'utf8'))).statusLine);
  } catch {
    return false;
  }
}

// Removes the copies LitGravity wrote, at both scopes unless one is named. An edited copy stays unless
// --discard-modified says otherwise; a folder LitGravity did not write is never touched.
export async function uninstall({ env = process.env, flags = {}, interactive = false, ask, cwd = process.cwd(), print = console.log }) {
  const p = paths(env, cwd);
  const scopes = flags.scope ? [flags.scope] : ['project', 'user'];
  print('LitGravity uninstall');
  const plan = scopes.map((scope) => {
    const dest = destination(p, scope);
    const st = destState(dest);
    const discard = st.state === 'modified' && flags.discardModified;
    const remove = st.state === 'owned' || discard;
    return { scope, dest, st, discard, remove };
  });
  for (const x of plan) {
    const line = x.remove
      ? `remove ${x.dest}${x.discard ? ` (discarding edits: ${x.st.detail})` : ''}`
      : x.st.state === 'absent' ? 'absent' : `keep ${x.dest} (${x.st.state}: ${x.st.detail})`;
    print(`  ${x.scope.padEnd(13)} ${line}`);
    if (x.st.state === 'modified' && !x.discard) print('  hint          add --discard-modified to remove the edited copy too');
  }
  const hud = scopes.includes('user') && ourStatusLine(p);
  const previous = hud ? replacedStatusLine(p) : null;
  if (hud) print(`  status line   ${previous ? `put back the status line LitGravity replaced (${String(previous.command ?? 'custom').slice(0, 60)})` : 'remove the LitGravity entry'} in ${p.agySettings}`);
  print(`  kept          ${p.backups} and ${p.receipt}`);
  if (flags.dryRun) {
    print('Dry run: nothing removed.');
    return 0;
  }
  if (!interactive && !flags.yes) {
    print('Nothing removed: this shell has no terminal. Rerun with --yes.');
    return 0;
  }
  if (interactive && !flags.yes && ask && (plan.some((y) => y.remove) || hud) && !(await ask('Remove these LitGravity files? [y/N] '))) {
    print('Nothing removed.');
    return 0;
  }
  for (const x of plan.filter((y) => y.remove)) {
    rmSync(assertSafeWritePath(x.dest), { recursive: true, force: true });
    print(`Removed ${x.dest}.`);
  }
  const removed = hud ? removeStatusLine(p) : false;
  if (removed === 'restored') print('Restored the previous status line.');
  else if (removed) print('Removed the LitGravity status line.');
  print('Project files LitGravity conversations wrote (plans/, .litgravity/) stay in each project.');
  return 0;
}
