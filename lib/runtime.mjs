import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PLUGIN_DIR } from './bundle.mjs';
import { paths } from './paths.mjs';
import { splitLines } from '../plugin/lib/host-exec.mjs';

// Engine runtimes (office, diagram, ...) each ship one `<name>-runtime.mjs` module in the plugin, in `lib/` or in a
// skill's `scripts/`. The module installs only into $XDG_DATA_HOME/litgravity/runtime/<name> and answers
// `status --json` / `install --json` with {name, ready, cache, missing}. A skill calls its own engine's `status` first
// and tells the user the one pre-warm command when the answer is not ready.
export function runtimeModules(dir = PLUGIN_DIR) {
  const found = [];
  const scan = (folder) => {
    if (!existsSync(folder)) return;
    for (const f of readdirSync(folder)) if (f.endsWith('-runtime.mjs')) found.push({ name: f.slice(0, -'-runtime.mjs'.length), file: join(folder, f) });
  };
  scan(join(dir, 'lib'));
  const skills = join(dir, 'skills');
  if (existsSync(skills)) for (const id of readdirSync(skills).sort()) scan(join(skills, id, 'scripts'));
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

export function runtimeEnv(env) {
  const p = paths(env);
  return { ...env, XDG_DATA_HOME: env.XDG_DATA_HOME || join(p.home, '.local', 'share') };
}

// The engine's own last stderr line (its BLOCKED text), then the exit code and spawn error, so a failure shows its cause.
function statusError(r) {
  const line = splitLines(r.stderr ?? '').map((l) => l.trim()).filter(Boolean).pop();
  const why = [r.error && `${r.error.code ?? r.error.message}`, r.status ? `exit ${r.status}` : r.signal && `signal ${r.signal}`].filter(Boolean).join(', ');
  return [line, why && `(${why})`].filter(Boolean).join(' ') || 'no status output';
}

export function callRuntime(mod, action, env, { timeoutMs = 30000 } = {}) {
  const r = spawnSync(process.execPath, [mod.file, action, '--json'], { env: runtimeEnv(env), encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] });
  const out = String(r.stdout ?? '').trim();
  let json = null;
  for (const candidate of [out, out.slice(out.indexOf('{')), splitLines(out).filter(Boolean).pop() ?? '']) {
    try {
      json = JSON.parse(candidate);
      break;
    } catch { /* try the next shape; reported below when none parses */ }
  }
  if (r.status !== 0 || !json || typeof json.ready !== 'boolean') {
    return { name: mod.name, ready: false, error: statusError(r) };
  }
  return { ...json, name: json.name ?? mod.name };
}

export async function runtime({ env = process.env, flags = {}, args = [], print = console.log, pluginDir = PLUGIN_DIR }) {
  const [action = 'status', want] = args;
  const mods = runtimeModules(pluginDir);
  if (!['status', 'install'].includes(action)) {
    print('Usage: litgravity runtime status [name] | litgravity runtime install <name|all>');
    return 2;
  }
  if (action === 'install' && !want) {
    print(`Name a runtime to install (${mods.map((m) => m.name).join(', ') || 'none shipped'}) or all.`);
    return 2;
  }
  const picked = want && want !== 'all' ? mods.filter((m) => m.name === want) : mods;
  if (want && want !== 'all' && picked.length === 0) {
    print(`Unknown runtime: ${want} (shipped: ${mods.map((m) => m.name).join(', ') || 'none'})`);
    return 2;
  }
  if (action === 'install' && flags.dryRun) {
    for (const m of picked) print(`would install runtime ${m.name} with ${relative(pluginDir, m.file)} into ${join(paths(env).runtime, m.name)}`);
    return 0;
  }
  const results = picked.map((m) => callRuntime(m, action, env, { timeoutMs: action === 'install' ? 900000 : 30000 }));
  if (flags.json) print(JSON.stringify({ runtimes: results }, null, 2));
  else {
    for (const r of results) {
      const state = r.error ? `BLOCKED: ${r.error}` : r.ready ? 'ready' : `not ready${r.missing?.length ? ` (missing: ${r.missing.join(', ')})` : ''}`;
      print(`${r.name}: ${state}${r.cache ? ` · ${r.cache}` : ''}`);
    }
  }
  return results.every((r) => !r.error && (action === 'status' || r.ready)) ? 0 : 1;
}
