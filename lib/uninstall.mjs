import { rmSync, existsSync, readFileSync } from 'node:fs';
import { paths, destination } from './paths.mjs';
import { destState } from './bundle.mjs';
import { assertSafeWritePath } from './guard.mjs';
import { removeRuleFile, willRemoveRuleFile } from './agent-file.mjs';
import { planned, tilde } from './cards.mjs';
import { FONT_LEAVES, ownedIconFont, removeIconFont } from './icon-font.mjs';
import { forgetIconFont } from '../plugin/hud/glyphs.mjs';
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
export async function uninstall({ env = process.env, flags = {}, interactive = false, ask, cwd = process.cwd(), print = console.log, cards = null }) {
  const p = paths(env, cwd);
  const short = tilde(p.home);
  const scopes = flags.scope ? [flags.scope] : ['project', 'user'];
  const plan = scopes.map((scope) => {
    const dest = destination(p, scope);
    const st = destState(dest);
    const discard = st.state === 'modified' && flags.discardModified;
    const remove = st.state === 'owned' || discard;
    return { scope, dest, st, discard, remove };
  });
  const listed = [];
  for (const x of plan) {
    const line = x.remove
      ? `remove ${x.dest}${x.discard ? ` (discarding edits: ${x.st.detail})` : ''}`
      : x.st.state === 'absent' ? 'absent' : `keep ${x.dest} (${x.st.state}: ${x.st.detail})`;
    listed.push([x.scope, line]);
    if (x.st.state === 'modified' && !x.discard) listed.push(['hint', 'add --discard-modified to remove the edited copy too']);
  }
  const hud = scopes.includes('user') && ourStatusLine(p);
  const previous = hud ? replacedStatusLine(p) : null;
  if (scopes.includes('user')) listed.push(['agent file', `remove the LitGravity rule file ${p.geminiRulesFile} when it is still the one we wrote`]);
  if (hud) listed.push(['status line', `${previous ? `put back the status line LitGravity replaced (${String(previous.command ?? 'custom').slice(0, 60)})` : 'remove the LitGravity entry'} in ${p.agySettings}`]);
  const owned = ownedIconFont({ env, p });
  const font = scopes.includes('user') ? owned : [];
  if (owned.length && !font.length) listed.push(['icon font', `kept ${owned.map((f) => f.path).join(' and ')}: every project shares it, so only uninstall --scope user removes it`]);
  if (font.length) listed.push(['icon font', `remove ${font.map((f) => f.path).join(' and ')}, each while it is still the file we added; ${FONT_LEAVES}`]);
  listed.push(['kept', `${p.backups} and ${p.receipt}`]);
  if (cards) cards.panel({ title: 'LitGravity uninstall', sections: [{ rows: planned(listed.map(([label, value]) => [label, short(value)])) }] });
  else {
    print('LitGravity uninstall');
    for (const [label, value] of listed) print(`  ${label.padEnd(13)} ${value}`);
  }
  if (flags.dryRun) {
    print('Dry run: nothing removed.');
    return 0;
  }
  if (!interactive && !flags.yes) {
    print('Nothing removed: this shell has no terminal. Rerun with --yes.');
    return 0;
  }
  const agentRemove = scopes.includes('user') && willRemoveRuleFile(p);
  if (interactive && !flags.yes && ask && (plan.some((y) => y.remove) || hud || agentRemove || font.length > 0) && !(await ask('Remove these LitGravity files? [y/N] ', {
    tag: 'LIT 1/1',
    title: 'Uninstall',
    note: 'Removes the LitGravity files planned above; No stops here and removes nothing.',
    yes: 'yes',
    no: 'no',
  }))) {
    if (cards) cards.say('Nothing removed.');
    else print('Nothing removed.');
    return 0;
  }
  for (const x of plan.filter((y) => y.remove)) {
    rmSync(assertSafeWritePath(x.dest), { recursive: true, force: true });
    if (cards) cards.step('good', x.scope === 'user' ? 'User copy' : 'Project copy', `removed ${short(x.dest)}`);
    else print(`Removed ${x.dest}.`);
  }
  if (scopes.includes('user')) {
    const rule = removeRuleFile({ p, discardModified: flags.discardModified === true });
    const did = rule.status === 'removed' ? `removed ${rule.path}${rule.discarded ? ' (discarding edits)' : ''}`
      : rule.status === 'kept' ? `kept ${rule.path} (${rule.detail})` : null;
    if (did && cards) cards.step(rule.status === 'kept' ? 'warn' : 'good', 'Agent file', short(did));
    else if (did) print(`agent file: ${did}.`);
  }
  if (font.length) {
    const { removed: gone, kept } = removeIconFont({ env, p });
    forgetIconFont(env);
    const did = [...(gone.length ? [`removed ${gone.join(' and ')}; ${FONT_LEAVES}`] : []), ...(kept.length ? [`kept ${kept.join(' and ')}`] : [])];
    for (const text of did) {
      if (cards) cards.step(text.startsWith('kept') ? 'warn' : 'good', 'Icon font', short(text));
      else print(`icon font: ${text}.`);
    }
  }
  const removed = hud ? removeStatusLine(p) : false;
  const line = removed === 'restored' ? 'Restored the previous status line.' : removed ? 'Removed the LitGravity status line.' : null;
  const stays = 'Project files LitGravity conversations wrote (plans/, .litgravity/) stay in each project.';
  if (cards) {
    if (line) cards.step('good', 'Status line', line);
    cards.panel({ title: 'LitGravity uninstall is done', sections: [{ rows: [{ mark: 'plan', label: 'Kept', value: stays }] }] });
    return 0;
  }
  if (line) print(line);
  print(stays);
  return 0;
}
