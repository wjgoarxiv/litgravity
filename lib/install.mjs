import { join } from 'node:path';
import { paths, destination } from './paths.mjs';
import { writeFileAtomic, realExistingAncestor } from './safe-write.mjs';
import { agyVersion, validatePlugin } from './agy.mjs';
import { destState, stageTo, packageVersion, PLUGIN_DIR, readManifest } from './bundle.mjs';
import { assertSafeWritePath } from './guard.mjs';
import { applyRuleFile, planRuleFile, writeAgentFileMode } from './agent-file.mjs';
import { planStatusLine, applyStatusLine } from './statusline.mjs';
import { firstLine } from '../plugin/lib/host-exec.mjs';
import { extensionNotice, queueExtensionNotice } from '../plugin/hooks/lib/extensions.mjs';
import { checkFindings, extensionPaths } from './extension-manager.mjs';
import { planned } from './cards.mjs';

// Where a copy the user wants to keep goes. agy loads every folder in its plugins folder, so a copy saved beside the
// plugin would come back as a second live LitGravity; LitGravity's own data folder is outside every place agy scans.
function savedCopyMove(p, dest, scope) {
  const dir = join(p.data, 'saved');
  const to = join(dir, `${scope}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`);
  return `mkdir -p "${dir}" && mv "${dest}" "${to}"`;
}

function remedy(state, detail, dest, link, p, scope) {
  if (state === 'symlinked') return `Remove the link itself (the files it points to stay): rm "${link ?? detail.split(' is a symbolic link')[0]}" — then run install again.`;
  if (state === 'foreign') return `LitGravity only replaces a copy it wrote. Move that path out of agy's plugins folder: ${savedCopyMove(p, dest, scope)} — then run install again.`;
  return `The installed copy was edited after install. Keep your edits by moving it out of agy's plugins folder: ${savedCopyMove(p, dest, scope)} — or discard them with: npx @litfamily/litgravity uninstall --discard-modified. Then run install again.`;
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

// `banner` prints the LIT mark (lib/mark.mjs) for a person at a terminal, and `cards` (lib/cards.mjs) draws the screens
// there; the CLI passes them, library callers do not.
export async function install({ env = process.env, flags = {}, interactive = false, ask, cwd = process.cwd(), print = console.log, banner, cards = null }) {
  const scope = flags.scope || 'user';
  const p = paths(env, cwd);
  const dest = destination(p, scope);
  const version = packageVersion();
  // With cards, these lines are drawn as rows and panels instead.
  const plain = cards ? () => {} : print;
  const fail = (what, ...more) => {
    if (cards) cards.panel({ title: `LitGravity ${version} install stopped`, bad: true, sections: [{ rows: [{ mark: 'bad', value: what }] }] });
    else print(`FAIL ${what}`);
    for (const line of more) print(line);
    return 1;
  };
  banner?.();
  plain(`LitGravity ${version} installer for the Antigravity CLI`);

  if (Number(process.versions.node.split('.')[0]) < 20) {
    return fail(`Node.js ${process.versions.node} is too old; LitGravity needs Node.js 20 or newer.`);
  }
  if (flags.replaceStatusLine) flags = { ...flags, statusLine: true };
  if (flags.statusLine && scope !== 'user') {
    return fail('--status-line needs --scope user: agy reads its status line only from the user-level settings file.');
  }
  const host = agyVersion(env);
  if (!host) {
    return fail('agy was not found on PATH. Install the Antigravity CLI first (https://antigravity.google), sign in once, then run this again.');
  }
  plain(`Host: agy ${host}`);

  try {
    assertSafeWritePath(realExistingAncestor(dest));
    assertSafeWritePath(dest);
  } catch (err) {
    return fail(err.message, 'No files written.');
  }
  const st = destState(dest);
  if (['symlinked', 'foreign', 'modified'].includes(st.state)) {
    return fail(`destination ${st.state}: ${st.detail}`, remedy(st.state, st.detail, dest, st.link, p, scope), 'No files written.');
  }
  let hud = null;
  if (flags.statusLine) {
    hud = planStatusLine(p, { replace: flags.replaceStatusLine === true });
    if (hud.action === 'refuse') return fail(`status line: ${hud.detail}`, 'No files written.');
  }

  let agentPlan = planRuleFile({ p, version, env, flags, scope });
  const other = destination(p, scope === 'user' ? 'project' : 'user');
  const otherState = destState(other);
  const plan = [
    ['scope', `${scope}${scope === 'project' ? ` (${cwd})` : ' (every project on this machine)'}`],
    ['plugin', `${dest}${st.state === 'owned' ? ` (replaces LitGravity ${st.version})` : ''}`],
    ['agent file', agentPlan.detail],
    ['receipt', p.receipt],
    ['validate', 'agy plugin validate on the packaged plugin, then on the installed copy'],
  ];
  if (hud) plan.push(['status line', hud.action === 'already' ? 'already set' : `${hud.detail} (backup in ${p.backups})`]);
  plan.push(['approvals', "none: agy loads a plugin's hooks, skills and agents without a trust step"]);
  const twice = ['owned', 'modified', 'foreign'].includes(otherState.state)
    ? `a copy also exists at ${other}; agy keeps one plugin per name and drops the other silently, so remove one of them` : null;
  if (cards) {
    const rows = planned([['host', `agy ${host}`], ...plan]);
    if (twice) rows.push({ mark: 'warn', label: 'note', value: twice });
    cards.panel({ title: `LitGravity ${version} install plan`, sections: [{ rows }] });
  } else {
    print('');
    print('Plan');
    for (const [label, value] of twice ? [...plan, ['note', twice]] : plan) print(`  ${label.padEnd(11)} ${value}`);
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
  if (agentPlan.action === 'refuse') {
    return fail(`agent file ${agentPlan.state}: ${agentPlan.detail}`, 'No files written.');
  }
  const asksRule = agentPlan.action === 'create' || agentPlan.action === 'update';
  const questions = asksRule ? 2 : 1;
  if (interactive && !flags.yes && ask && !(await ask(`Install LitGravity ${version} at ${scope} scope? [y/N] `, {
    tag: `LIT 1/${questions}`,
    title: 'Install',
    note: `Copies LitGravity ${version} into agy's plugin folder at ${scope} scope, as planned above; No stops here and writes nothing.`,
    yes: `LitGravity ${version} at ${scope} scope`,
    no: 'not installed',
  }))) {
    print(`${cards ? ' ' : ''}Nothing installed.`);
    return 0;
  }
  if (interactive && !flags.yes && ask && asksRule) {
    if (!(await ask(`Add the LitGravity global rule for the Antigravity CLI at ${p.geminiRulesFile}? [y/N] `, {
      tag: `LIT 2/${questions}`,
      title: 'Global rule',
      note: 'Adds the LitGravity global rule, the agent file planned above; No leaves it out and is stored, so later installs skip it.',
      yes: 'add the rule file',
      no: 'left out',
    }))) {
      writeAgentFileMode(p.litgravityConfig, 'off');
      agentPlan = { action: 'off', detail: 'off (declined; stored, so later installs skip it)' };
      if (cards) cards.step('good', 'Agent file', 'stored `off`, so later installs skip the rule file');
      else print('Agent file off: stored `off`, so later installs skip the rule file.');
    }
  }

  const source = validatePlugin(env, PLUGIN_DIR);
  if (!source.ok) {
    return fail(
      'agy plugin validate rejected the packaged plugin:',
      ...source.errors.map((f) => `  ${f.file ?? 'plugin'}: ${f.message}`),
      ...(source.report ? [] : [`  ${firstLine(source.raw.stderr || source.raw.stdout) || `no report (exit ${source.raw.status})`}`]),
      'Nothing was installed.',
    );
  }
  for (const w of source.warnings) {
    if (cards) cards.step('warn', 'Validate', `${w.file ?? 'plugin'}: ${w.message}`);
    else print(`  WARN ${w.file ?? 'plugin'}: ${w.message}`);
  }

  const written = [];
  const count = stageTo(dest);
  written.push(dest);
  const installed = validatePlugin(env, dest);
  if (!installed.ok) {
    return fail(
      'agy plugin validate rejected the installed copy:',
      ...installed.errors.map((f) => `  ${f.file ?? 'plugin'}: ${f.message}`),
      `The copy at ${dest} was left in place; remove it with: npx @litfamily/litgravity uninstall --yes`,
    );
  }
  cards?.step('good', 'Plugin', `${count} files copied, and agy plugin validate passed`);
  if (hud && ['add', 'replace'].includes(hud.action)) written.push(...applyStatusLine(p, dest, stamp()));
  if (agentPlan.action === 'create' || agentPlan.action === 'update' || agentPlan.action === 'off') {
    const applied = applyRuleFile({ p, version, action: agentPlan.action, env, flags, scope });
    if (applied.status.startsWith('refused')) {
      return fail(`agent file ${applied.status}: ${applied.detail}`, 'The plugin copy above was left in place; move the rule file aside and run install again.');
    }
    if (cards) cards.step('good', 'Agent file', `${applied.status} ${applied.path}`);
    else print(`agent file: ${applied.status} ${applied.path}`);
    if (applied.status === 'created' || applied.status === 'updated') written.push(applied.path);
  }

  writeFileAtomic(p.receipt, `${JSON.stringify({
    product: 'litgravity', version, scope, installedAt: new Date().toISOString(), host: `agy ${host}`, files: count, written,
  }, null, 2)}\n`);
  written.push(p.receipt);
  // Existing users: a duplicate or an old copy without a receipt earns one line in the notice. Read only; nothing moves.
  const findings = checkFindings(extensionPaths(env, cwd)).filter((f) => f.level === 'action').length;
  written.push(queueExtensionNotice(p.data, version, { findings }));

  const installedLine = `LitGravity ${readManifest(PLUGIN_DIR).version} (${count} files) at ${scope} scope.`;
  const ready = 'Ready. Start agy in a project and begin a prompt with `lit`. Check any time with `npx @litfamily/litgravity doctor`.';
  const notice = extensionNotice(p.data, { findings });
  if (cards) {
    cards.notes('LitFamily extensions', notice);
    cards.panel({
      title: `LitGravity ${version} is ready`,
      sections: [
        { head: 'INSTALLED', rows: [{ value: installedLine }] },
        { head: 'WRITTEN', rows: written.map((value) => ({ value })) },
        { head: 'STATUS', rows: [{ value: ready }] },
      ],
    });
    return 0;
  }
  print('');
  print(`Installed: ${installedLine}`);
  print('');
  print('Written:');
  for (const w of written) print(`  ${w}`);
  print('');
  print(`Status: ${ready}`);
  print('');
  print('LitFamily extensions');
  for (const line of notice) print(`  ${line}`);
  return 0;
}
