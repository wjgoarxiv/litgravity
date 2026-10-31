import { homedir } from 'node:os';
import { join } from 'node:path';

// Every location LitGravity reads or writes, resolved from one environment so tests can sandbox HOME.
export function paths(env = process.env, cwd = process.cwd(), { platform = process.platform } = {}) {
  // Windows has no HOME; the user folder (and agy's .gemini inside it) is %USERPROFILE%.
  const home = env.HOME || (platform === 'win32' && env.USERPROFILE) || homedir();
  const dataHome = env.XDG_DATA_HOME || join(home, '.local', 'share');
  const data = join(dataHome, 'litgravity');
  return {
    home,
    data,
    backups: join(data, 'backups'),
    receipt: join(data, 'receipt.json'),
    updateCache: join(data, 'update-check.json'),
    runtime: join(data, 'runtime'),
    // agy loads a plugin straight from either folder: project scope needs no install step and no trust prompt,
    // user scope is the global customization root.
    userPlugin: join(home, '.gemini', 'config', 'plugins', 'litgravity'),
    projectPlugin: join(cwd, '.agents', 'plugins', 'litgravity'),
    // The owned LitGravity rule file, read from agy's global rules folder. The rules folder is the
    // cleaner route over a block in the shared GEMINI.md; the installer writes only this one file.
    geminiRulesFile: join(home, '.gemini', 'config', 'rules', 'litgravity.md'),
    // Install records for the rule file, and our own on/off setting.
    agentFileRecord: join(data, 'agent-file.json'),
    litgravityConfig: join(data, 'config.json'),
    // The status line is configured only here, at user level.
    agySettings: join(home, '.gemini', 'antigravity-cli', 'settings.json'),
  };
}

export function destination(p, scope) {
  return scope === 'user' ? p.userPlugin : p.projectPlugin;
}
