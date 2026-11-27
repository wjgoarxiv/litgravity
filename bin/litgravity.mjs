#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { install } from '../lib/install.mjs';
import { runAgentFileConfig, runAgentFileProject } from '../lib/agent-file.mjs';
import { uninstall } from '../lib/uninstall.mjs';
import { doctor } from '../lib/doctor.mjs';
import { models } from '../lib/models.mjs';
import { list } from '../lib/list.mjs';
import { inbox } from '../lib/inbox.mjs';
import { extensions, EXTENSION_HELP } from '../lib/extension-manager.mjs';
import { packageVersion, destState } from '../lib/bundle.mjs';
import { paths } from '../lib/paths.mjs';
import { agyVersion } from '../lib/agy.mjs';
import { checkUpdate } from '../lib/update-check.mjs';
import { printMark } from '../lib/mark.mjs';
import { openCards } from '../lib/cards.mjs';
import { parse } from '../lib/args.mjs';
import { AGENT_POINTER, COMMAND, agentGuide } from '../lib/agent-guide.mjs';

const HELP = `LitGravity ${packageVersion()}: LitFamily workflows for Google's Antigravity CLI (agy)

Usage: litgravity <command> [options]

Are you an agent? Run ${COMMAND} install --agent and follow what it prints.

Commands
  install      Copy the plugin into agy's plugin folder (user scope by default) and validate it
  update       The same as install: replaces the copy in place and keeps your settings
  doctor       Check install state, agy version, hooks, skills, agents and host tools
  status       Short version of doctor plus an update check
  models       List the models and efforts your agy offers
  list         Every skill with the words that reach it and its purpose, and where a moved skill went (--json for tools)
  inbox        Show, from the hooks' own state, what each start-work run here has parked and what an approval would run
  extensions   extensions list|check|install|update|remove|prune-backups: manage the LitFamily extensions in agy's
               skill folders (check first, move an old copy aside, copy, write a receipt); a dry run until --yes.
               litgravity extensions help explains each verb
  config       config agentFile on|off: keep or remove the LitGravity rule in agy's global rules folder
  agent-file   agent-file project [--dir <path>]: write the LitGravity block into a repo's AGENTS.md
  uninstall    Remove the copies this installer wrote (both scopes unless --scope is given)
  help         This text

Options
  --dry-run        Show every destination and command; write nothing
  --no-agent-file  install: skip the global rule file for this run (stored setting untouched)
  --yes, -y        Allow writes from a shell without a terminal (agents, CI)
  --scope <s>      user (default): ~/.gemini/config/plugins/litgravity, or project: ./.agents/plugins/litgravity
  --status-line    install: also set the LitGravity status line in agy's user settings (opt-in, user scope only)
  --replace-status-line  install: replace a status line LitGravity did not write (saved first; uninstall puts it back)
  --round          install, update: add one icon font for round ends when no icon font is here (nothing on Windows)
  --glyphs <g>     install, update: save auto (default), round or square ends for pills and gauges
  --agent          Print the install guide for coding agents and do nothing else
  --json           Machine-readable output (doctor, models, list, extensions list|check)
  --project        extensions: ./.agents/skills in this workspace instead of ~/.gemini/config/skills
  --from <path>    extensions install|update: use this wjgoarxiv-skills clone instead of LitGravity's own
  --family <name>, --all, --allow-shadow, --older-than <days>   see: litgravity extensions help
  --offline        Skip the npm update check
  --discard-modified  uninstall: also remove a copy edited after install
  --version        Print the version`;

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--agent')) {
    process.stdout.write(`${agentGuide()}\n`);
    return 0;
  }
  const { command, args, flags, error } = parse(argv);
  const env = process.env;
  const cwd = process.cwd();
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !env.CI);
  const print = (line) => process.stdout.write(`${line}\n`);
  const banner = () => {
    printMark(print, env);
    if (!interactive && !flags.json) print(AGENT_POINTER);
  };
  const tty = Boolean(process.stdout.isTTY);
  if (error) {
    print(`${error}\nRun ${COMMAND} help for every option.`);
    return 2;
  }
  if (flags.version) {
    print(packageVersion());
    return 0;
  }
  if (flags.help || command === 'help') {
    if (command !== 'extensions') printMark(print, env);
    print(command === 'extensions' ? EXTENSION_HELP : HELP);
    return 0;
  }
  switch (command) {
    case 'install':
    case 'update': {
      const cards = openCards({ env, flags });
      return install({ env, flags, interactive, ask: cards?.ask ?? ask, cwd, print, banner, cards, tty });
    }
    case 'uninstall': {
      const cards = openCards({ env, flags });
      return uninstall({ env, flags, interactive, ask: cards?.ask ?? ask, cwd, print, cards });
    }
    case 'doctor':
      return doctor({ env, flags, cwd, print, banner, tty });
    case 'models':
      return models({ env, flags, print });
    case 'list':
      return list({ flags, print });
    case 'inbox':
      return inbox({ env, cwd, flags, print });
    case 'extensions':
      return extensions({ env, args, flags, cwd, print });
    case 'config':
      return runAgentFileConfig({ env, args, cwd, print });
    case 'agent-file':
      return runAgentFileProject({ env, args, cwd, flags, print });
    case 'status': {
      const p = paths(env, cwd);
      const user = destState(p.userPlugin);
      const project = destState(p.projectPlugin);
      const label = (st) => (st.state === 'absent' ? 'not installed' : `${st.state}${st.version ? ` ${st.version}` : ''}`);
      print(`LitGravity ${packageVersion()} · host ${agyVersion(env) ? `agy ${agyVersion(env)}` : 'agy not found'}`);
      print(`user scope ${label(user)} · project scope ${label(project)}`);
      if (!flags.offline) {
        const u = await checkUpdate(env);
        if (u.latest && u.latest !== packageVersion()) print(`update: ${u.latest} available (npx @litfamily/litgravity@latest install)`);
      }
      print('Run `npx @litfamily/litgravity doctor` for every check.');
      return 0;
    }
    default:
      print(`Unknown command: ${command}\n\n${HELP}`);
      return 2;
  }
}

main().then((code) => { process.exitCode = code ?? 0; }, (err) => {
  process.stderr.write(`litgravity: ${err.message}\n`);
  process.exitCode = 1;
});
