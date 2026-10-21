// Cross-platform process helpers shared by the installer, the doctor and every skill script that starts another program.
//
// Why it exists. Since the fix for CVE-2024-27980 (Node 18.20.2, 20.12.2, 21.7.3 and every Node 22+), `spawn` refuses a
// `.cmd` or `.bat` file unless `shell: true` is set, and fails with EINVAL. npm, npx and most npm-installed tools
// (tsc, eslint, agent-browser) are `.cmd` shims on Windows. A bare `where` or `which` probe also fails there: `where`
// prints CRLF lines and never tries PATHEXT. These helpers take the platform and the environment as arguments, so a test
// can stand in for Windows on any machine, and they change nothing on POSIX.
//
// Rules: a real executable is spawned directly with no shell. A `.cmd` or `.bat` goes through the shell only with each
// argument quoted for cmd.exe, and an argument cmd.exe would expand or split (a double quote, a percent sign, a line
// break) is refused with UNSAFE_CMD_ARG instead of being escaped. Nothing here builds a shell string from untrusted input.

import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { win32, posix } from 'node:path';

const defaultIsFile = (file) => {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
};

const pathApi = (platform) => (platform === 'win32' ? win32 : posix);

/** Lines of a child's output; CRLF and LF both split cleanly. */
export const splitLines = (text) => String(text ?? '').split(/\r?\n/u);

/** The first non-empty trimmed line of a child's output, or ''. */
export const firstLine = (text) => splitLines(text).map((line) => line.trim()).find(Boolean) ?? '';

/** The extensions a bare command name may carry. POSIX has none (the empty extension only). */
export function pathExtensions(env = process.env, platform = process.platform) {
  if (platform !== 'win32') return [''];
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'pathext');
  const raw = (key && env[key]) || '.COM;.EXE;.BAT;.CMD';
  return raw.split(';').map((ext) => ext.trim().toLowerCase()).filter(Boolean);
}

function searchDirs(env, platform) {
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path');
  return String(key ? env[key] : '').split(platform === 'win32' ? ';' : ':').map((dir) => dir.replace(/^"(.*)"$/u, '$1')).filter(Boolean);
}

/**
 * The file a bare command name would run, or null. On Windows the name is tried with every PATHEXT extension (a name that
 * already ends in one is tried as given); a bare `npm` file with no extension is not an executable there.
 */
export function resolveOnPath(name, { env = process.env, platform = process.platform, isFile = defaultIsFile } = {}) {
  const api = pathApi(platform);
  const exts = pathExtensions(env, platform);
  const given = api.extname(name).toLowerCase();
  const names = platform === 'win32'
    ? (exts.includes(given) ? [name] : exts.map((ext) => `${name}${ext}`))
    : [name];
  const hasDir = /[\\/]/u.test(name);
  const dirs = hasDir ? [''] : searchDirs(env, platform);
  for (const dir of dirs) {
    for (const candidate of names) {
      const file = dir ? api.join(dir, candidate) : candidate;
      if (isFile(file)) return file;
    }
  }
  return null;
}

/**
 * One argument for cmd.exe. Plain words pass as they are; anything with a space or a cmd metacharacter is wrapped in double
 * quotes, with trailing backslashes doubled so the child's argument parser does not read them as an escaped quote. A
 * double quote, a percent sign and a line break cannot be quoted safely and are refused.
 */
export function quoteForCmd(arg) {
  const text = String(arg);
  if (/["%\r\n\0]/u.test(text)) throw new Error(`UNSAFE_CMD_ARG: refusing to pass ${JSON.stringify(text.slice(0, 80))} through cmd.exe (a quote, percent sign or line break)`);
  if (/^[A-Za-z0-9_@+=:,./\\-]+$/u.test(text)) return text;
  return `"${text.replace(/(\\+)$/u, '$1$1')}"`;
}

/**
 * How to start `command args` on this platform: { command, args, shell }. A resolved `.cmd` or `.bat` on Windows becomes a
 * shell spawn with a quoted command and quoted arguments; everything else is a direct spawn.
 */
export function spawnPlan(command, args = [], { env = process.env, platform = process.platform, isFile = defaultIsFile } = {}) {
  if (platform !== 'win32') return { command, args: [...args], shell: false };
  const resolved = resolveOnPath(command, { env, platform, isFile }) ?? command;
  if (!/\.(cmd|bat)$/iu.test(resolved)) return { command: resolved === command ? command : resolved, args: [...args], shell: false };
  return { command: quoteForCmd(resolved), args: args.map(quoteForCmd), shell: true };
}

/**
 * How to run npm. On Windows npm-cli.js runs through node itself (npm_execpath when npm set it, else the copy that sits
 * beside node.exe), which needs no shell; only when neither exists does it fall back to npm.cmd through the shell.
 */
export function npmInvocation(args, { env = process.env, platform = process.platform, execPath = process.execPath, isFile = defaultIsFile } = {}) {
  if (platform !== 'win32') return { command: 'npm', args: [...args], shell: false };
  const api = pathApi(platform);
  const viaNode = (script) => ({ command: execPath, args: [script, ...args], shell: false });
  const named = env.npm_execpath;
  if (named && /^npm-cli\.[cm]?js$/iu.test(api.basename(named))) return viaNode(named);
  const beside = api.join(api.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (isFile(beside)) return viaNode(beside);
  return spawnPlan('npm', args, { env, platform, isFile });
}

/** spawnSync of a plan. */
function runPlan(plan, options) {
  return spawnSync(plan.command, plan.args, plan.shell ? { ...options, shell: true } : options);
}

/** spawnSync that survives `.cmd` shims on Windows. Options are spawnSync options. */
export function runSync(command, args = [], options = {}, ctx = {}) {
  const env = ctx.env ?? options.env ?? process.env;
  return runPlan(spawnPlan(command, args, { ...ctx, env }), options);
}

/** `npm <args>` through spawnSync, with npm_execpath read from the child's own environment. */
export function runNpmSync(args, options = {}, ctx = {}) {
  const env = ctx.env ?? options.env ?? process.env;
  return runPlan(npmInvocation(args, { ...ctx, env }), options);
}

/** The reason a child failed, with the parts that matter: exit code or signal, spawn error code and the last stderr line(s). */
export function describeSpawn(result, { tail = 600 } = {}) {
  const parts = [];
  if (result.error) parts.push(`${result.error.code ? `${result.error.code}: ` : ''}${result.error.message}`);
  if (result.signal) parts.push(`signal ${result.signal}`);
  else if (result.status !== null && result.status !== undefined && !result.error) parts.push(`exit ${result.status}`);
  const text = `${result.stderr || ''}`.trim() || `${result.stdout || ''}`.trim();
  const detail = text.slice(-tail).trim();
  const head = parts.join('; ') || 'no exit status';
  return detail ? `${head}: ${splitLines(detail).filter(Boolean).pop()}` : head;
}
