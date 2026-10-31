import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { paths, destination } from './paths.mjs';
import { agy, agyVersion, validatePlugin, versionAtLeast } from './agy.mjs';
import { PLUGIN_DIR, destState, packageVersion, skillIds, agentNames } from './bundle.mjs';
import { runtimeModules, callRuntime } from './runtime.mjs';
import { pickPython } from '../plugin/lib/python-pick.mjs';
import { describeSpawn, firstLine } from '../plugin/lib/host-exec.mjs';
import { HOST_TOOLS, hostToolOk } from './host-tools.mjs';
import { isOurs, replacedStatusLine, stripBom } from './statusline.mjs';
import { readAgentFileMode, ruleFileState } from './agent-file.mjs';
import { checkUpdate } from './update-check.mjs';
import { SKILL_ROUTES } from '../plugin/hooks/lib/routes.mjs';

// Hooks, rules and the first agy release that fires SessionStart. Probed on 1.4.3.
const MIN_AGY = '1.4.3';

// Scripts that ship inside skills and answer a cheap question about the machine or their own bundle. A bundle check
// that fails is a broken install (FAIL); a machine check that fails is only a missing tool (WARN).
const SKILL_SMOKES = [
  { label: 'frontend corpus', skill: 'frontend-ui-ux', args: ['scripts/verify-corpus.mjs'], broken: true },
  { label: 'design dataset', skill: 'frontend-ui-ux', args: ['scripts/import-design-intelligence.mjs', '--check'], broken: true },
  { label: 'handoff closure', skill: 'lit-handoff', args: ['scripts/verify-closure.mjs'], broken: true },
  { label: 'wikify script', skill: 'wikify', args: ['scripts/wikify-knowledge.mjs', '--help'], broken: true },
  { label: 'checker inventory', skill: 'lsp', args: ['scripts/diagnostics.mjs', '--tools'], broken: true },
  { label: 'Chrome driver', skill: 'frontend-ui-ux', args: ['scripts/chrome-driver.mjs', 'status', '--json'], broken: false, fix: 'install Google Chrome or Chromium, or set CHROME_PATH' },
  { label: 'browser tiers', skill: 'browser-drive', args: ['scripts/capability-probe.mjs'], broken: false, fix: 'install agent-browser, Playwright with a browser, or Chrome' },
  { label: 'motion readiness', skill: 'lit-typographic-motion', args: ['scripts/motion-doctor.mjs'], broken: false, fix: 'npx @litfamily/litgravity runtime install motion, and install ffmpeg and libwebp' },
];

const HOOK_SCRIPTS = ['session-start', 'pre-invocation', 'post-invocation', 'stop', 'pre-tool-use', 'post-tool-use'];

function hookEvents(dir) {
  try {
    const hooks = JSON.parse(readFileSync(join(dir, 'hooks.json'), 'utf8'));
    return [...new Set(Object.values(hooks).flatMap((spec) => Object.keys(spec).filter((k) => k !== 'enabled')))];
  } catch {
    return null;
  }
}

// Every hook answers one JSON object on stdin garbage; a missing or crashing script is how a half-copied install shows up.
function smoke(dir, env) {
  const bad = [];
  for (const name of HOOK_SCRIPTS) {
    const file = join(dir, 'hooks', `${name}.mjs`);
    if (!existsSync(file)) { bad.push(`${name} (missing)`); continue; }
    const r = spawnSync(process.execPath, [file], { cwd: dir, env, input: '{}', encoding: 'utf8', timeout: 10000 });
    let ok = r.status === 0;
    try { ok = ok && typeof JSON.parse(r.stdout) === 'object'; } catch { ok = false; }
    if (!ok) bad.push(`${name} (${describeSpawn(r)})`);
  }
  return bad;
}

function pluginListEntry(env) {
  const r = agy(env, ['plugin', 'list', '--json'], { timeoutMs: 30000 });
  const list = Array.isArray(r.json) ? r.json : r.json?.plugins;
  if (!Array.isArray(list)) return null;
  return list.find((x) => x && (x.name === 'litgravity' || x.id === 'litgravity')) ?? null;
}

export async function doctor({ env = process.env, flags = {}, cwd = process.cwd(), print = console.log }) {
  const p = paths(env, cwd);
  const version = packageVersion();
  const checks = [];
  const add = (status, name, detail, fix) => checks.push({ status, name, detail, ...(fix ? { fix } : {}) });

  add(Number(process.versions.node.split('.')[0]) >= 20 ? 'PASS' : 'FAIL', 'node', `Node.js ${process.versions.node}${Number(process.versions.node.split('.')[0]) >= 20 ? '' : ' is too old; LitGravity needs 20 or newer'}`);

  const host = agyVersion(env);
  if (!host) add('FAIL', 'agy', 'not found on PATH', 'Install the Antigravity CLI (https://antigravity.google) and sign in once');
  else if (!versionAtLeast(host, MIN_AGY)) add('WARN', 'agy', `agy ${host} is older than ${MIN_AGY}, the build LitGravity was probed on (SessionStart hooks arrived there)`, 'agy update');
  else add('PASS', 'agy', `agy ${host}`);

  const found = [];
  for (const scope of ['user', 'project']) {
    const dest = destination(p, scope);
    const st = destState(dest);
    if (st.state === 'absent') {
      add('INFO', `plugin ${scope}`, `not installed at ${scope} scope (${dest})`);
      continue;
    }
    found.push({ scope, dest, st });
    if (st.state === 'owned') {
      add(st.version === version ? 'PASS' : 'WARN', `plugin ${scope}`, st.version === version ? `LitGravity ${st.version} installed (${dest})` : `LitGravity ${st.version} installed; this package is ${version}`, st.version === version ? undefined : 'npx @litfamily/litgravity@latest install');
    } else if (st.state === 'modified') {
      add('WARN', `plugin ${scope}`, `LitGravity copy was edited after install (${st.detail})`);
    } else {
      add('FAIL', `plugin ${scope}`, `${st.state}: ${st.detail}`);
    }
  }
  if (found.length === 0) add('FAIL', 'install', 'LitGravity is not installed', 'npx @litfamily/litgravity install');
  if (found.length === 2) add('WARN', 'duplicate', 'a copy exists at both scopes; agy keeps one plugin per name and drops the other silently', 'npx @litfamily/litgravity uninstall --scope project --yes');

  const shipped = skillIds();
  const routeIds = new Set(SKILL_ROUTES.map((r) => r.id));
  const orphans = shipped.filter((id) => !routeIds.has(id));
  const pending = [...routeIds].filter((id) => !shipped.includes(id));

  for (const { scope, dest, st } of found) {
    if (!['owned', 'modified'].includes(st.state)) continue;
    if (host) {
      const v = validatePlugin(env, dest);
      if (!v.report) add('FAIL', `validate ${scope}`, `agy plugin validate printed no report: ${firstLine(v.raw.stderr || v.raw.stdout) || `exit ${v.raw.status}`}`);
      else if (v.errors.length) add('FAIL', `validate ${scope}`, `agy plugin validate: ${v.errors.map((e) => `${e.file ?? 'plugin'}: ${e.message}`).join('; ')}`);
      else add(v.warnings.length ? 'WARN' : 'PASS', `validate ${scope}`, `agy plugin validate: 0 errors, ${v.warnings.length} warnings${v.warnings.length ? ` (${v.warnings.map((w) => w.message).join('; ')})` : ''}`);
    }
    const events = hookEvents(dest);
    add(events && events.length ? 'PASS' : 'FAIL', 'hooks', events ? events.join(', ') : `${dest}/hooks.json is missing or unreadable`);
    const bad = smoke(dest, env);
    add(bad.length ? 'FAIL' : 'PASS', 'hook smoke', bad.length ? `no clean JSON answer from: ${bad.join(', ')}` : `${HOOK_SCRIPTS.length} hook scripts answered`);
    const have = skillIds(dest);
    const missing = shipped.filter((id) => !have.includes(id));
    add(missing.length ? 'FAIL' : 'PASS', 'skills', missing.length ? `${shipped.length} shipped, missing from the installed copy: ${missing.join(', ')}` : `${shipped.length} shipped, all present in the installed copy`);
    const agents = agentNames(dest);
    const wantAgents = agentNames();
    const lostAgents = wantAgents.filter((a) => !agents.includes(a));
    add(lostAgents.length ? 'FAIL' : 'PASS', 'agents', lostAgents.length ? `missing: ${lostAgents.join(', ')}` : `${agents.length} agents${agents.length ? `: ${agents.join(', ')}` : ''}`);
    add(existsSync(join(dest, 'rules', 'AGENTS.md')) ? 'PASS' : 'FAIL', 'rules', existsSync(join(dest, 'rules', 'AGENTS.md')) ? 'rules/AGENTS.md present' : 'rules/AGENTS.md is missing');
    break;
  }
  const agentMode = readAgentFileMode({ env, configFile: p.litgravityConfig });
  if (agentMode === 'off') {
    add('INFO', 'agent file', 'off (turn it back on with `npx @litfamily/litgravity config agentFile on`)');
  } else {
    const agentState = ruleFileState({ path: p.geminiRulesFile, version });
    if (agentState.startsWith('present')) add('PASS', 'agent file', `${agentState} (${p.geminiRulesFile})`);
    else if (agentState.startsWith('stale')) add('WARN', 'agent file', `${agentState}; this package is ${version}`, 'npx @litfamily/litgravity install --yes');
    else if (agentState === 'absent') {
      add(found.length ? 'WARN' : 'INFO', 'agent file', `not set (a user-scope install adds ${p.geminiRulesFile})`, found.length ? 'npx @litfamily/litgravity install --yes' : undefined);
    } else add('WARN', 'agent file', `${agentState}: ${p.geminiRulesFile} holds text LitGravity did not write`, 'move it aside, then run: npx @litfamily/litgravity install --yes');
  }
  add(orphans.length ? 'FAIL' : 'PASS', 'routes', orphans.length ? `skills with no route: ${orphans.join(', ')}` : `every shipped skill has a route (${routeIds.size} routes)`);
  if (pending.length) add('INFO', 'pending skills', `${pending.length} routed skills are not shipped yet: ${pending.join(', ')}`);

  if (host && found.length) {
    const entry = pluginListEntry(env);
    if (entry && entry.enabled === false) add('FAIL', 'enabled', 'litgravity is disabled in agy', 'agy plugin enable litgravity');
  }

  for (const m of runtimeModules()) {
    const r = callRuntime(m, 'status', env);
    const fix = `npx @litfamily/litgravity runtime install ${m.name}`;
    if (r.error) add('INFO', `engine ${m.name}`, `status check failed: ${r.error}`, fix);
    else if (r.ready) add('INFO', `engine ${m.name}`, `ready${r.cache ? ` (${r.cache})` : ''}`);
    else add('INFO', `engine ${m.name}`, `installs on first use${r.missing?.length ? ` (missing: ${r.missing.join(', ')})` : ''}`, fix);
  }
  if (!env.LITGRAVITY_SKIP_HOST_TOOLS) {
    for (const t of HOST_TOOLS) {
      const ok = hostToolOk(t, { env });
      add(ok ? 'PASS' : 'INFO', t.label, ok ? 'found' : `not found (used by ${t.skills})`, ok ? undefined : t.fix);
    }
  }
  if (!env.LITGRAVITY_SKIP_HOST_TOOLS) {
    const py = pickPython(env.LITGRAVITY_OFFICE_PYTHON, 'LITGRAVITY_OFFICE_PYTHON');
    add(py.ok ? 'PASS' : 'WARN', 'python for engines', py.ok ? `${py.command} ${py.detail}` : py.detail, py.ok ? undefined : 'brew install python@3.14, or set LITGRAVITY_OFFICE_PYTHON to a 3.10-3.14 interpreter');
    for (const s of SKILL_SMOKES) {
      const script = join(PLUGIN_DIR, 'skills', s.skill, s.args[0]);
      if (!existsSync(script)) { add('FAIL', s.label, `${s.skill}/${s.args[0]} is missing from the package`); continue; }
      const r = spawnSync(process.execPath, [script, ...s.args.slice(1)], { cwd: dirname(script), env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, encoding: 'utf8' });
      const ok = r.status === 0;
      add(ok ? 'PASS' : s.broken ? 'FAIL' : 'WARN', s.label, ok ? `${s.skill} answered` : `${s.skill}/${s.args.join(' ')} failed (${describeSpawn(r, { tail: 160 })})`, ok ? undefined : s.fix);
    }
  }
  if (Number(process.versions.node.split('.')[0]) < 22) add('WARN', 'node 22', `Node.js ${process.versions.node}: the Chrome driver in frontend-ui-ux and visual-qa needs the WebSocket global of Node 22`, 'install Node.js 22 or newer');
  try {
    const settings = JSON.parse(stripBom(readFileSync(p.agySettings, 'utf8')));
    const replaced = replacedStatusLine(p);
    add('INFO', 'status line', isOurs(settings.statusLine)
      ? `the LitGravity status line is set${replaced ? ` (it replaced ${String(replaced.command ?? 'a custom one').slice(0, 60)}; uninstall puts that back)` : ''}`
      : 'not set (opt in with `install --scope user --status-line`)');
  } catch {
    add('INFO', 'status line', 'not set (opt in with `install --scope user --status-line`)');
  }
  if (!flags.offline) {
    const u = await checkUpdate(env);
    if (u.latest && u.latest !== version) add('INFO', 'update', `${u.latest} is available (installed ${version})`, 'npx @litfamily/litgravity@latest install');
  }

  const count = (s) => checks.filter((c) => c.status === s).length;
  const summary = { pass: count('PASS'), warn: count('WARN'), fail: count('FAIL'), info: count('INFO') };
  if (flags.json) {
    print(JSON.stringify({ product: 'litgravity', version, host: host ? `agy ${host}` : null, checks, summary, skills: shipped, agents: agentNames(), routes: SKILL_ROUTES.map((r) => r.id) }, null, 2));
    return summary.fail ? 1 : 0;
  }
  print(`LitGravity ${version} doctor`);
  for (const c of checks) {
    print(`${c.status} ${c.name} — ${c.detail}`);
    if (c.fix && c.status !== 'PASS') print(`     fix: ${c.fix}`);
  }
  print('');
  print(summary.fail ? `LitGravity: ${summary.fail} problem${summary.fail === 1 ? '' : 's'} found, ${summary.warn} warning${summary.warn === 1 ? '' : 's'}.` : `LitGravity: ready${summary.warn ? `, ${summary.warn} warning${summary.warn === 1 ? '' : 's'}` : ''}.`);
  return summary.fail ? 1 : 0;
}
