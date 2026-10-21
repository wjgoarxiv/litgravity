#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { install } from '../lib/install.mjs';
import { uninstall } from '../lib/uninstall.mjs';
import { doctor } from '../lib/doctor.mjs';
import { models } from '../lib/models.mjs';
import { runtime } from '../lib/runtime.mjs';
import { list } from '../lib/list.mjs';
import { packageVersion, destState } from '../lib/bundle.mjs';
import { paths } from '../lib/paths.mjs';
import { agyVersion } from '../lib/agy.mjs';
import { checkUpdate } from '../lib/update-check.mjs';

const HELP = `LitGravity ${packageVersion()}: LitFamily workflows for Google's Antigravity CLI (agy)

Usage: litgravity <command> [options]

Commands
  install      Copy the plugin into agy's plugin folder (user scope by default) and validate it
  doctor       Check install state, agy version, hooks, skills, agents, engines and host tools
  status       Short version of doctor plus an update check
  models       List the models and efforts your agy offers
  list         Every skill with the words that reach it, its purpose and its engine (--json for tools)
  runtime      status [name] | install <name|all>: the pinned engine runtimes, cached under the LitGravity data dir
  uninstall    Remove the copies this installer wrote (both scopes unless --scope is given)
  help         This text

Options
  --dry-run        Show every destination and command; write nothing
  --yes, -y        Allow writes from a shell without a terminal (agents, CI)
  --scope <s>      user (default): ~/.gemini/config/plugins/litgravity, or project: ./.agents/plugins/litgravity
  --status-line    install: also set the LitGravity status line in agy's user settings (opt-in, user scope only)
  --replace-status-line  install: replace a status line LitGravity did not write (saved first; uninstall puts it back)
  --json           Machine-readable output (doctor, models, runtime)
  --offline        Skip the npm update check
  --discard-modified  uninstall: also remove a copy edited after install
  --version        Print the version`;

function parse(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--yes' || a === '-y') flags.yes = true;
    else if (a === '--json') flags.json = true;
    else if (a === '--offline') flags.offline = true;
    else if (a === '--status-line') flags.statusLine = true;
    else if (a === '--replace-status-line') flags.replaceStatusLine = true;
    else if (a === '--discard-modified') flags.discardModified = true;
    else if (a === '--scope') flags.scope = argv[++i];
    else if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--version' || a === '-v') flags.version = true;
    else rest.push(a);
  }
  return { command: rest[0] ?? 'help', args: rest.slice(1), flags };
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

async function main() {
  const { command, args, flags } = parse(process.argv.slice(2));
  const env = process.env;
  const cwd = process.cwd();
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !env.CI);
  const print = (line) => process.stdout.write(`${line}\n`);
  if (flags.version) {
    print(packageVersion());
    return 0;
  }
  if (flags.help || command === 'help') {
    print(HELP);
    return 0;
  }
  if (flags.scope && !['user', 'project'].includes(flags.scope)) {
    print('--scope takes user or project');
    return 2;
  }
  switch (command) {
    case 'install':
    case 'update':
      return install({ env, flags, interactive, ask, cwd, print });
    case 'uninstall':
      return uninstall({ env, flags, interactive, ask, cwd, print });
    case 'doctor':
      return doctor({ env, flags, cwd, print });
    case 'models':
      return models({ env, flags, print });
    case 'list':
      return list({ flags, print });
    case 'runtime':
      return runtime({ env, flags, args, print });
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
