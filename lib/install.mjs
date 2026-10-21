import { paths, destination } from './paths.mjs';
import { writeFileAtomic, realExistingAncestor } from './safe-write.mjs';
import { agyVersion, validatePlugin } from './agy.mjs';
import { destState, stageTo, packageVersion, PLUGIN_DIR, readManifest } from './bundle.mjs';
import { assertSafeWritePath } from './guard.mjs';
import { planStatusLine, applyStatusLine } from './statusline.mjs';
import { firstLine } from '../plugin/lib/host-exec.mjs';

function remedy(state, detail, dest, link) {
  const saved = `${dest}.saved-${new Date().toISOString().slice(0, 10)}`;
  if (state === 'symlinked') return `Remove the link itself (the files it points to stay): rm "${link ?? detail.split(' is a symbolic link')[0]}" — then run install again.`;
  if (state === 'foreign') return `LitGravity only replaces a copy it wrote. Move that path aside: mv "${dest}" "${saved}" — then run install again.`;
  return `The installed copy was edited after install. Keep your edits with: mv "${dest}" "${saved}" — or discard them with: npx @litfamily/litgravity uninstall --discard-modified. Then run install again.`;
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export async function install({ env = process.env, flags = {}, interactive = false, ask, cwd = process.cwd(), print = console.log }) {
  const scope = flags.scope || 'user';
  const p = paths(env, cwd);
  const dest = destination(p, scope);
  const version = packageVersion();
  print(`LitGravity ${version} installer for the Antigravity CLI`);

  if (Number(process.versions.node.split('.')[0]) < 20) {
    print(`FAIL Node.js ${process.versions.node} is too old; LitGravity needs Node.js 20 or newer.`);
    return 1;
  }
  if (flags.replaceStatusLine) flags = { ...flags, statusLine: true };
  if (flags.statusLine && scope !== 'user') {
    print('FAIL --status-line needs --scope user: agy reads its status line only from the user-level settings file.');
    return 1;
  }
  const host = agyVersion(env);
  if (!host) {
    print('FAIL agy was not found on PATH. Install the Antigravity CLI first (https://antigravity.google), sign in once, then run this again.');
    return 1;
  }
  print(`Host: agy ${host}`);

  try {
    assertSafeWritePath(realExistingAncestor(dest));
    assertSafeWritePath(dest);
  } catch (err) {
    print(`FAIL ${err.message}`);
    print('No files written.');
    return 1;
  }
  const st = destState(dest);
  if (['symlinked', 'foreign', 'modified'].includes(st.state)) {
    print(`FAIL destination ${st.state}: ${st.detail}`);
    print(remedy(st.state, st.detail, dest, st.link));
    print('No files written.');
    return 1;
  }
  let hud = null;
  if (flags.statusLine) {
    hud = planStatusLine(p, { replace: flags.replaceStatusLine === true });
    if (hud.action === 'refuse') {
      print(`FAIL status line: ${hud.detail}`);
      print('No files written.');
      return 1;
    }
  }

  const other = destination(p, scope === 'user' ? 'project' : 'user');
  const otherState = destState(other);
  print('');
  print('Plan');
  print(`  scope       ${scope}${scope === 'project' ? ` (${cwd})` : ' (every project on this machine)'}`);
  print(`  plugin      ${dest}${st.state === 'owned' ? ` (replaces LitGravity ${st.version})` : ''}`);
  print(`  receipt     ${p.receipt}`);
  print(`  validate    agy plugin validate on the packaged plugin, then on the installed copy`);
  if (hud) print(`  status line ${hud.action === 'already' ? 'already set' : `${hud.detail} (backup in ${p.backups})`}`);
  print('  approvals   none: agy loads a plugin\'s hooks, skills and agents without a trust step');
  if (['owned', 'modified', 'foreign'].includes(otherState.state)) {
    print(`  note        a copy also exists at ${other}; agy keeps one plugin per name and drops the other silently, so remove one of them`);
  }

  if (flags.dryRun) {
    print('');
    print('Dry run: no files written and no agy command that changes state was run.');
    return 0;
  }
  if (!interactive && !flags.yes) {
    print('');
    print('No files written: this shell has no terminal. Rerun with --yes to install.');
    return 0;
  }
  if (interactive && !flags.yes && ask && !(await ask(`Install LitGravity ${version} at ${scope} scope? [y/N] `))) {
    print('Nothing installed.');
    return 0;
  }

  const source = validatePlugin(env, PLUGIN_DIR);
  if (!source.ok) {
    print('FAIL agy plugin validate rejected the packaged plugin:');
    for (const f of source.errors) print(`  ${f.file ?? 'plugin'}: ${f.message}`);
    if (!source.report) print(`  ${firstLine(source.raw.stderr || source.raw.stdout) || `no report (exit ${source.raw.status})`}`);
    print('Nothing was installed.');
    return 1;
  }
  for (const w of source.warnings) print(`  WARN ${w.file ?? 'plugin'}: ${w.message}`);

  const written = [];
  const count = stageTo(dest);
  written.push(dest);
  const installed = validatePlugin(env, dest);
  if (!installed.ok) {
    print('FAIL agy plugin validate rejected the installed copy:');
    for (const f of installed.errors) print(`  ${f.file ?? 'plugin'}: ${f.message}`);
    print(`The copy at ${dest} was left in place; remove it with: npx @litfamily/litgravity uninstall --yes`);
    return 1;
  }
  if (hud && ['add', 'replace'].includes(hud.action)) written.push(...applyStatusLine(p, dest, stamp()));

  writeFileAtomic(p.receipt, `${JSON.stringify({
    product: 'litgravity', version, scope, installedAt: new Date().toISOString(), host: `agy ${host}`, files: count, written,
  }, null, 2)}\n`);
  written.push(p.receipt);

  print('');
  print(`Installed: LitGravity ${readManifest(PLUGIN_DIR).version} (${count} files) at ${scope} scope.`);
  print('');
  print('Written:');
  for (const w of written) print(`  ${w}`);
  print('');
  print('Status: Ready. Start agy in a project and begin a prompt with `lit`. Check any time with `npx @litfamily/litgravity doctor`.');
  return 0;
}
