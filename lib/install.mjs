import { join } from 'node:path';
import { paths, destination } from './paths.mjs';
import { assertWritableTarget, writeFileAtomic, realExistingAncestor } from './safe-write.mjs';
import { agyVersion, validatePlugin } from './agy.mjs';
import { destState, stageTo, packageVersion, PLUGIN_DIR, readManifest } from './bundle.mjs';
import { assertSafeWritePath } from './guard.mjs';
import { AGENT_POINTER } from './agent-guide.mjs';
import { applyRuleFile, planRuleFile, readConfig, writeAgentFileMode, writeGlyphs } from './agent-file.mjs';
import { planStatusLine, applyStatusLine } from './statusline.mjs';
import { firstLine } from '../plugin/lib/host-exec.mjs';
import { extensionNotice, queueExtensionNotice } from '../plugin/hooks/lib/extensions.mjs';
import { checkFindings, extensionPaths } from './extension-manager.mjs';
import { planned, tilde } from './cards.mjs';
import { addIconFont, planIconFont } from './icon-font.mjs';
import { roundEnds } from './round-ends.mjs';
import { forgetIconFont } from '../plugin/hud/glyphs.mjs';

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
// there; the CLI passes them, library callers do not. `tty`: stdout is a terminal. `font` is for tests.
export async function install({ env = process.env, flags = {}, interactive = false, ask, cwd = process.cwd(), print = console.log, banner, cards = null, tty = false, font = {} }) {
  const scope = flags.scope || 'user';
  const p = paths(env, cwd);
  const dest = destination(p, scope);
  const version = packageVersion();
  // With cards, these lines are drawn as rows and panels instead.
  const plain = cards ? () => {} : print;
  const short = tilde(p.home);
  // `reason`: what went wrong, the first line first. `way`: how to get out, one line with commands that must stay whole.
  const fail = (stage, reason, next = [], way = null) => {
    if (cards) {
      const rows = [['Stage', stage], ['Reason', reason.map(short)], ['Next', [...(way ? ['the way out is written under this card'] : []), ...next].map(short)]];
      cards.panel({ title: 'INSTALL STOPPED', bad: true, sections: [{ rows: rows.filter(([, value]) => value.length).map(([label, value]) => ({ mark: label === 'Reason' ? 'bad' : 'plan', label, value })) }] });
      if (way) cards.say(way);
      return 1;
    }
    print(`FAIL ${reason[0]}`);
    for (const line of [...reason.slice(1), ...(way ? [way] : []), ...next]) print(line);
    return 1;
  };
  if (cards) cards.open(`litgravity v${version}`, `Installs into ${short(dest)}, only after you say yes.`);
  else banner?.();
  plain(`LitGravity ${version} installer for the Antigravity CLI`);

  if (Number(process.versions.node.split('.')[0]) < 20) {
    return fail('Node.js', [`Node.js ${process.versions.node} is too old; LitGravity needs Node.js 20 or newer.`]);
  }
  if (flags.replaceStatusLine) flags = { ...flags, statusLine: true };
  if (flags.statusLine && scope !== 'user') {
    return fail('options', ['--status-line needs --scope user: agy reads its status line only from the user-level settings file.']);
  }
  const host = agyVersion(env);
  if (!host) {
    return fail('host', ['agy was not found on PATH. Install the Antigravity CLI first (https://antigravity.google), sign in once, then run this again.']);
  }
  plain(`Host: agy ${host}`);

  try {
    assertSafeWritePath(realExistingAncestor(dest));
    assertSafeWritePath(dest);
  } catch (err) {
    return fail('destination', [err.message], ['No files written.']);
  }
  const st = destState(dest);
  if (['symlinked', 'foreign', 'modified'].includes(st.state)) {
    return fail('destination', [`destination ${st.state}: ${st.detail}`], ['No files written.'], remedy(st.state, st.detail, dest, st.link, p, scope));
  }
  let hud = null;
  if (flags.statusLine) {
    hud = planStatusLine(p, { replace: flags.replaceStatusLine === true });
    if (hud.action === 'refuse') return fail('status line', [`status line: ${hud.detail}`], ['No files written.']);
  }

  if (flags.glyphs) {
    try {
      assertWritableTarget(p.litgravityConfig);
      readConfig(p.litgravityConfig);
    } catch (err) {
      return fail('settings', [err.message], ['No files written.']);
    }
  }
  const fontPlan = flags.round ? planIconFont({ env, ...font }) : null;

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
  if (fontPlan) plan.push(['icon font', fontPlan.detail]);
  if (flags.glyphs) plan.push(['glyphs', `save ${flags.glyphs} for pills and gauges in ${p.litgravityConfig}`]);
  plan.push(['approvals', "none: agy loads a plugin's hooks, skills and agents without a trust step"]);
  const twice = ['owned', 'modified', 'foreign'].includes(otherState.state)
    ? `a copy also exists at ${other}; agy keeps one plugin per name and drops the other silently, so remove one of them` : null;
  if (cards) {
    const rows = planned([['host', `agy ${host}`], ...plan].map(([label, value]) => [label, short(value)]));
    if (twice) rows.push({ mark: 'warn', label: 'Note', value: short(twice) });
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
    return fail('agent file', [`agent file ${agentPlan.state}: ${agentPlan.detail}`], ['No files written.']);
  }
  const asksRule = agentPlan.action === 'create' || agentPlan.action === 'update';
  const questions = asksRule ? 2 : 1;
  if (interactive && !flags.yes && ask && !(await ask(`Install LitGravity ${version} at ${scope} scope? [y/N] `, {
    tag: `LIT 1/${questions}`,
    title: 'Install',
    hint: AGENT_POINTER,
    note: `Copies LitGravity ${version} into agy's plugin folder at ${scope} scope, as planned above; No stops here and writes nothing.`,
    yes: 'yes',
    no: 'no',
  }))) {
    if (cards) cards.say('Nothing installed.');
    else print('Nothing installed.');
    return 0;
  }
  if (interactive && !flags.yes && ask && asksRule) {
    if (!(await ask(`Add the LitGravity global rule for the Antigravity CLI at ${p.geminiRulesFile}? [y/N] `, {
      tag: `LIT 2/${questions}`,
      title: 'Global rule',
      note: 'Adds the LitGravity global rule, the agent file planned above; No leaves it out and is stored, so later installs skip it.',
      yes: 'add',
      no: 'off',
    }))) {
      writeAgentFileMode(p.litgravityConfig, 'off');
      agentPlan = { action: 'off', detail: 'off (declined; stored, so later installs skip it)' };
      if (!cards) print('Agent file off: stored `off`, so later installs skip the rule file.');
    }
  }

  const writesHud = hud && ['add', 'replace'].includes(hud.action);
  const writesRule = ['create', 'update', 'off'].includes(agentPlan.action);
  const work = cards?.work(`Installing LitGravity ${version}`, [
    { name: 'Package', text: 'check the packaged plugin with agy' },
    { name: 'Copy', text: `copy the plugin into ${short(dest)}` },
    { name: 'Validate', text: 'check the installed copy with agy' },
    ...(writesHud ? [{ name: 'Status line', text: "set it in agy's user settings" }] : []),
    ...(writesRule ? [{ name: 'Agent file', text: agentPlan.action === 'off' ? 'keep the rule file off' : 'write the global rule' }] : []),
    ...(fontPlan ? [{ name: 'Icon font', text: fontPlan.action === 'add' ? 'get the symbols font' : 'look for an icon font' }] : []),
    { name: 'Receipt', text: 'record what was written' },
  ]);
  const run = (fn) => (work ? work.run(fn) : fn());

  const source = run(() => validatePlugin(env, PLUGIN_DIR));
  if (!source.ok) {
    return fail('package check', [
      'agy plugin validate rejected the packaged plugin:',
      ...source.errors.map((f) => `  ${f.file ?? 'plugin'}: ${f.message}`),
      ...(source.report ? [] : [`  ${firstLine(source.raw.stderr || source.raw.stdout) || `no report (exit ${source.raw.status})`}`]),
    ], ['Nothing was installed.']);
  }
  if (!cards) for (const w of source.warnings) print(`  WARN ${w.file ?? 'plugin'}: ${w.message}`);

  const written = [];
  const count = run(() => stageTo(dest));
  written.push(dest);
  const installed = run(() => validatePlugin(env, dest));
  if (!installed.ok) {
    return fail('installed copy', [
      'agy plugin validate rejected the installed copy:',
      ...installed.errors.map((f) => `  ${f.file ?? 'plugin'}: ${f.message}`),
    ], [], `The copy at ${dest} was left in place; remove it with: npx @litfamily/litgravity uninstall --yes`);
  }
  const hudFiles = writesHud ? run(() => applyStatusLine(p, dest, stamp())) : [];
  written.push(...hudFiles);
  let rule = null;
  if (writesRule) {
    rule = run(() => {
      const applied = applyRuleFile({ p, version, action: agentPlan.action, env, flags, scope });
      return { ...applied, ok: !applied.status.startsWith('refused') };
    });
    if (!rule.ok) {
      return fail('agent file', [`agent file ${rule.status}: ${rule.detail}`], ['The plugin copy above was left in place; move the rule file aside and run install again.']);
    }
    if (!cards) print(`agent file: ${rule.status} ${rule.path}`);
    if (rule.status === 'created' || rule.status === 'updated') written.push(rule.path);
  }

  if (flags.glyphs) written.push(writeGlyphs(p.litgravityConfig, flags.glyphs));
  const added = fontPlan ? await run(() => addIconFont({ env, p, ...font })) : null;
  if (added) {
    forgetIconFont(env);
    written.push(...added.written);
    if (!cards) print(`icon font: ${added.detail}`);
  }

  run(() => writeFileAtomic(p.receipt, `${JSON.stringify({
    product: 'litgravity', version, scope, installedAt: new Date().toISOString(), host: `agy ${host}`, files: count, written,
  }, null, 2)}\n`));
  written.push(p.receipt);
  // Existing users: a duplicate or an old copy without a receipt earns one line in the notice. Read only; nothing moves.
  const findings = checkFindings(extensionPaths(env, cwd)).filter((f) => f.level === 'action').length;
  const noticeFile = queueExtensionNotice(p.data, version, { findings });
  written.push(noticeFile);

  const installedLine = `LitGravity ${readManifest(PLUGIN_DIR).version} (${count} files) at ${scope} scope.`;
  const ready = 'Ready. Start agy in a project and begin a prompt with `lit`. Check any time with `npx @litfamily/litgravity doctor`.';
  const notice = extensionNotice(p.data, { findings });
  const ends = roundEnds({ env, p, tty, font, fontProblem: added?.problem });
  if (cards) {
    work.fold('Install steps');
    const row = (label, value, mark = 'good') => ({ mark, label, value: [value].flat().map(short) });
    const ruleOn = rule && (rule.status === 'created' || rule.status === 'updated');
    cards.panel({
      title: `LitGravity ${version} is installed`,
      sections: [
        { head: 'Installed', rows: [
          row('Plugin', `${dest} (${count} files)`),
          row('Checked', 'agy plugin validate passed on the packaged plugin and on the installed copy'),
          ...source.warnings.map((w) => row('Validate', `${w.file ?? 'plugin'}: ${w.message}`, 'warn')),
          ...(twice ? [row('Note', twice, 'warn')] : []),
          ...(ruleOn || rule?.status === 'removed' ? [row('Agent file', `${rule.status} ${rule.path}`)] : []),
          ...(hudFiles.length ? [row('Status line', hudFiles)] : []),
          ...(added ? [row('Icon font', added.detail, added.problem ? 'warn' : 'good')] : []),
          row('Receipt', p.receipt),
          row('Notice', `${noticeFile} (shown once, in your next agy session)`),
        ] },
        { head: 'Settings', rows: [
          row('Scope', plan[0][1], 'plan'),
          row('Host', `agy ${host}`, 'plan'),
          ...(ruleOn ? [row('Agent file', 'on (change: npx @litfamily/litgravity config agentFile off)', 'plan')]
            : [row('Agent file', rule?.status === 'off' || agentPlan.action === 'off' ? 'stored `off`, so later installs skip the rule file (change: npx @litfamily/litgravity config agentFile on)' : agentPlan.detail, 'plan')]),
          ...(hudFiles.length || scope !== 'user' ? [] : [row('Status line', hud ? 'already set' : 'not changed (add it: npx @litfamily/litgravity install --status-line)', 'plan')]),
          ...(flags.glyphs ? [row('Glyphs', `${flags.glyphs} (change: npx @litfamily/litgravity update --glyphs auto, round or square)`, 'plan')] : []),
          row('Approvals', plan.at(-1)[1], 'plan'),
        ] },
        { head: 'Next', rows: [
          row('Start', 'run agy in a project and begin a prompt with `lit`', 'plan'),
          row('Check', 'npx @litfamily/litgravity doctor, any time', 'plan'),
        ] },
      ],
    });
    cards.notes('LitFamily extensions', notice);
    cards.say(ends);
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
  print('');
  print(ends);
  return 0;
}
