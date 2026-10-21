import { firstLine, runSync } from '../plugin/lib/host-exec.mjs';

// Calls the Antigravity CLI with stdin closed, the equivalent of `< /dev/null`, so no command can wait on a prompt.
export function agy(env, args, { timeoutMs = 60000 } = {}) {
  const bin = env.LITGRAVITY_AGY_BIN || 'agy';
  const r = runSync(bin, args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs });
  let json = null;
  if (args.includes('--json') && r.stdout) {
    try {
      json = JSON.parse(r.stdout);
    } catch {
      json = null;
    }
  }
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    json,
    missing: r.error?.code === 'ENOENT',
    command: ['agy', ...args].join(' '),
  };
}

export function agyVersion(env) {
  const r = agy(env, ['--version'], { timeoutMs: 20000 });
  return r.ok ? firstLine(r.stdout) : null;
}

// `agy plugin validate <dir> --json` is an offline check with the same rules the CLI loads a plugin with.
// Errors make the plugin unloadable; warnings are reported but do not stop an install.
export function validatePlugin(env, dir) {
  const r = agy(env, ['plugin', 'validate', dir, '--json']);
  const findings = Array.isArray(r.json?.findings) ? r.json.findings : [];
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity !== 'error');
  return { ok: r.json !== null && errors.length === 0, report: r.json, errors, warnings, raw: r };
}

export function agyEfforts(env) {
  const r = agy(env, ['--help'], { timeoutMs: 20000 });
  const m = /Reasoning effort[^\n]*\(([a-z|]+)\)/.exec(r.stdout + r.stderr);
  return m ? m[1].split('|') : [];
}

export function versionAtLeast(have, want) {
  const a = String(have).split('.').map((n) => parseInt(n, 10) || 0);
  const b = String(want).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}
