#!/usr/bin/env node
// Dependency-free diagnostics normaliser for the LitGravity `lsp` skill.
//
// agy has no language-server tool, so this FALLBACK runs the project's own checkers
// (tsc, pyright, ruff, mypy, gopls, go vet, cargo check, clangd, shellcheck)
// with spawnSync (a direct spawn; a .cmd shim on Windows goes through a quoted shell), parses each tool's native output, and prints ONE
// JSON array of {file, line, col, severity, code, message, source}.
//
// It never installs anything. A checker that is not on PATH becomes an entry
// with severity "missing" (code "tool-missing"); a checker that ran but could
// not be parsed becomes severity "failed". Neither is ever a clean result.
//
//   node diagnostics.mjs [--all] [--tools] [--summary] [--timeout=<sec>] <file>...
//
//   --all      keep diagnostics for every file the checker reported, not only
//              the files named on the command line
//   --tools    print the checker inventory (name, status, version) and exit 0
//   --timeout  per-checker timeout in seconds (default 120)
//   --summary  print {ran, diagnostics} instead of the bare array; `ran` lists the checker
//              executables that actually started, so a caller can tell a clean run from a skipped one
//
// Exit: 0 no error-level findings; 1 at least one error; 2 usage; 3 only
// "missing"/"failed" entries and nothing else to report (not a pass).

import { resolveOnPath, runSync, splitLines } from '../../../lib/host-exec.mjs';
import { existsSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const LANG_BY_EXT = {
  '.ts': 'ts', '.tsx': 'ts', '.mts': 'ts', '.cts': 'ts',
  '.js': 'ts', '.jsx': 'ts', '.mjs': 'ts', '.cjs': 'ts',
  '.py': 'py', '.pyi': 'py',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c', '.h': 'c', '.cc': 'c', '.cpp': 'c', '.cxx': 'c', '.hpp': 'c', '.hh': 'c', '.hxx': 'c',
  '.sh': 'sh', '.bash': 'sh', '.zsh': 'sh', '.ksh': 'sh',
};

const args = process.argv.slice(2);
const keepAll = args.includes('--all');
const wantTools = args.includes('--tools');
const timeoutArg = args.find((a) => a.startsWith('--timeout='));
const wantSummary = args.includes('--summary');
const ranTools = new Set();
const timeoutMs = (timeoutArg ? Number(timeoutArg.split('=')[1]) : 120) * 1000;
const fileArgs = args.filter((a) => !a.startsWith('--'));

const pathDirs = () => (process.env.PATH || process.env.Path || '').split(process.platform === 'win32' ? ';' : ':').filter(Boolean);

function onPath(bin, from = process.cwd()) {
  const dirs = [];
  let d = resolve(from);
  for (;;) {
    dirs.push(join(d, 'node_modules', '.bin'), join(d, '.venv', 'bin'), join(d, '.venv', 'Scripts'), join(d, 'venv', 'bin'), join(d, 'venv', 'Scripts'));
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  dirs.push(...pathDirs());
  // PATHEXT decides which extension counts on Windows, so tsc.cmd and ruff.exe are found by their bare names.
  for (const dir of dirs) {
    const p = resolveOnPath(bin, { env: { PATH: dir, PATHEXT: process.env.PATHEXT } });
    if (p) return p;
  }
  return null;
}

function run(cmd, argv, cwd) {
  const r = runSync(cmd, argv, { cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  if (!r.error) ranTools.add(cmd.split(/[\\/]/).pop());
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error, signal: r.signal };
}

function version(bin) {
  const r = runSync(bin, ['--version'], { encoding: 'utf8', timeout: 10000 });
  const line = splitLines((r.stdout || '') + (r.stderr || '')).find((l) => l.trim());
  return line ? line.trim().slice(0, 120) : '';
}

const CHECKERS = [
  ['ts', 'tsc'], ['py', 'pyright'], ['py', 'basedpyright'], ['py', 'ruff'], ['py', 'mypy'],
  ['go', 'gopls'], ['go', 'go'], ['rust', 'cargo'], ['c', 'clangd'], ['sh', 'shellcheck'],
];

if (wantTools) {
  const rows = CHECKERS.map(([language, tool]) => {
    const p = onPath(tool);
    return { language, tool, status: p ? 'present' : 'missing', path: p, version: p ? version(p) : '' };
  });
  rows.push({ language: 'py', tool: 'python3', status: onPath('python3') ? 'present' : 'missing', path: onPath('python3'), version: '' });
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
  process.exit(0);
}

if (fileArgs.length === 0) {
  process.stderr.write('usage: node diagnostics.mjs [--all] [--tools] [--summary] [--timeout=<sec>] <file>...\n');
  process.exit(2);
}

const out = [];
const cwd = process.cwd();
const rel = (p) => relative(cwd, p) || p;
const add = (file, line, col, severity, code, message, source) =>
  out.push({ file: file ? rel(file) : '', line: line || 0, col: col || 0, severity, code: code == null ? '' : String(code), message: String(message).trim(), source });
const note = (file, severity, code, message, source) => add(file, 0, 0, severity, code, message, source);

function findUp(start, names) {
  let d = resolve(start);
  for (;;) {
    for (const n of names) if (existsSync(join(d, n))) return d;
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
}

function missing(file, tool, hint) {
  note(file, 'missing', 'tool-missing', `${tool} is not installed or not on PATH${hint ? `; ${hint}` : ''}. Nothing was installed.`, tool);
}

function failed(file, tool, r, extra = '') {
  const why = r.error ? r.error.message : r.signal ? `killed by ${r.signal} (timeout ${timeoutMs / 1000}s)` : `exit ${r.status}`;
  note(file, 'failed', 'tool-failed', `${tool} ${why}${extra ? `: ${extra}` : ''}`.slice(0, 400), tool);
}

const sev = (s) => {
  const v = String(s).toLowerCase();
  if (v.startsWith('err')) return 'error';
  if (v.startsWith('warn')) return 'warning';
  if (v === 'information' || v === 'info' || v === 'note' || v === 'help' || v === 'style') return 'info';
  return v || 'info';
};

// ---- per-language runners -------------------------------------------------

function runTs(files) {
  const byRoot = new Map();
  for (const f of files) {
    const root = findUp(dirname(f), ['tsconfig.json']);
    const key = root || '';
    byRoot.set(key, [...(byRoot.get(key) || []), f]);
  }
  for (const [root, group] of byRoot) {
    const tsc = onPath('tsc', root || dirname(group[0]));
    if (!tsc) { missing(group[0], 'tsc', 'run `npm install --save-dev typescript` in the project or install TypeScript yourself'); continue; }
    const argv = root
      ? ['--noEmit', '--pretty', 'false', '-p', join(root, 'tsconfig.json')]
      : ['--noEmit', '--pretty', 'false', '--skipLibCheck', '--allowJs', '--checkJs', ...group];
    const r = run(tsc, argv, root || dirname(group[0]));
    const base = root || dirname(group[0]);
    let n = 0;
    for (const line of r.stdout.split('\n')) {
      const m = /^(.+?)\((\d+),(\d+)\): (error|warning|message) (TS\d+): (.*)$/.exec(line);
      if (m) { add(resolve(base, m[1]), +m[2], +m[3], sev(m[4]), m[5], m[6], 'tsc'); n++; }
      else if (/^error TS\d+:/.test(line)) { note(group[0], 'error', line.match(/TS\d+/)[0], line, 'tsc'); n++; }
    }
    if (n === 0 && r.status !== 0) failed(group[0], 'tsc', r, r.stdout.split('\n')[0]);
  }
}

function runPy(files) {
  const dir = dirname(files[0]);
  let ran = false;
  const pyr = onPath('pyright', dir) || onPath('basedpyright', dir);
  if (pyr) {
    ran = true;
    const r = run(pyr, ['--outputjson', ...files], findUp(dir, ['pyrightconfig.json', 'pyproject.toml']) || dir);
    try {
      const j = JSON.parse(r.stdout);
      for (const d of j.generalDiagnostics || []) {
        add(d.file, (d.range?.start?.line ?? 0) + 1, (d.range?.start?.character ?? 0) + 1, sev(d.severity), d.rule || '', d.message, pyr.split('/').pop());
      }
    } catch { failed(files[0], 'pyright', r, r.stderr.split('\n')[0]); }
  } else missing(files[0], 'pyright', 'for example `uv tool install pyright` or `pip install --user pyright`');
  const ruff = onPath('ruff', dir);
  if (ruff) {
    ran = true;
    const r = run(ruff, ['check', '--output-format', 'json', '--no-cache', ...files], dir);
    try {
      for (const d of JSON.parse(r.stdout || '[]')) {
        add(d.filename, d.location?.row, d.location?.column, d.code && /^(E9|F82|F63|F7)/.test(d.code) ? 'error' : 'warning', d.code || '', d.message, 'ruff');
      }
    } catch { failed(files[0], 'ruff', r, r.stderr.split('\n')[0]); }
  } else missing(files[0], 'ruff');
  const mypy = !pyr && onPath('mypy', dir);
  if (mypy) {
    ran = true;
    const r = run(mypy, ['--show-column-numbers', '--show-error-codes', '--no-error-summary', '--no-color-output', ...files], dir);
    for (const line of r.stdout.split('\n')) {
      const m = /^(.+?):(\d+):(?:(\d+):)? (error|warning|note): (.*?)(?:\s+\[([\w-]+)\])?$/.exec(line);
      if (m) add(resolve(dir, m[1]), +m[2], +(m[3] || 0), sev(m[4]), m[6] || '', m[5], 'mypy');
    }
  } else if (!pyr) missing(files[0], 'mypy');
  // Stdlib syntax check: always available when python3 is, labelled as syntax-only.
  const py = onPath('python3', dir);
  if (py) {
    const code = [
      'import sys, json',
      'out = []',
      'for p in sys.argv[1:]:',
      '    try:',
      '        compile(open(p, encoding="utf-8").read(), p, "exec")',
      '    except SyntaxError as e:',
      '        out.append({"file": p, "line": e.lineno or 0, "col": e.offset or 0, "msg": e.msg})',
      'print(json.dumps(out))',
    ].join('\n');
    const r = run(py, ['-I', '-c', code, ...files], dir);
    try {
      for (const d of JSON.parse(r.stdout || '[]')) add(d.file, d.line, d.col, 'error', 'SyntaxError', d.msg, 'python-compile (syntax only)');
    } catch { failed(files[0], 'python3', r, r.stderr.split('\n')[0]); }
  } else if (!ran) missing(files[0], 'python3');
}

function runGo(files) {
  const byRoot = new Map();
  for (const f of files) {
    const root = findUp(dirname(f), ['go.mod', 'go.work']) || dirname(f);
    byRoot.set(root, [...(byRoot.get(root) || []), f]);
  }
  for (const [root, group] of byRoot) {
    const gopls = onPath('gopls', root);
    if (gopls) {
      const r = run(gopls, ['check', ...group], root);
      for (const line of (r.stdout + r.stderr).split('\n')) {
        const m = /^(.+?\.go):(\d+):(\d+)(?:-\d+)?: (.*)$/.exec(line);
        if (m) add(resolve(root, m[1]), +m[2], +m[3], 'error', '', m[4], 'gopls check');
      }
      continue;
    }
    const go = onPath('go', root);
    if (!go) { missing(group[0], 'gopls/go', 'install the Go toolchain yourself'); continue; }
    const r = run(go, ['vet', './...'], root);
    let n = 0;
    for (const line of (r.stdout + r.stderr).split('\n')) {
      const m = /^(?:vet: )?(.+?\.go):(\d+):(?:(\d+):)? (.*)$/.exec(line);
      if (m) { add(resolve(root, m[1]), +m[2], +(m[3] || 0), 'error', '', m[4], 'go vet'); n++; }
    }
    if (n === 0 && r.status !== 0) failed(group[0], 'go vet', r, (r.stderr || r.stdout).split('\n')[0]);
    note(group[0], 'info', 'fallback', 'gopls not installed; go vet is package-level and does not give references or definitions.', 'go vet');
  }
}

function runRust(files) {
  const byRoot = new Map();
  for (const f of files) {
    const root = findUp(dirname(f), ['Cargo.toml']);
    if (!root) { note(f, 'failed', 'no-manifest', 'no Cargo.toml above this file', 'cargo check'); continue; }
    byRoot.set(root, [...(byRoot.get(root) || []), f]);
  }
  for (const [root, group] of byRoot) {
    const cargo = onPath('cargo', root);
    if (!cargo) { missing(group[0], 'cargo', 'install rustup yourself'); continue; }
    const r = run(cargo, ['check', '--message-format=json', '--all-targets', '--quiet'], root);
    let seen = false;
    for (const line of r.stdout.split('\n')) {
      if (!line.startsWith('{')) continue;
      let j; try { j = JSON.parse(line); } catch { continue; }
      if (j.reason !== 'compiler-message' || !j.message) continue;
      seen = true;
      const span = (j.message.spans || []).find((s) => s.is_primary) || (j.message.spans || [])[0];
      if (!span) continue;
      add(resolve(root, span.file_name), span.line_start, span.column_start, sev(j.message.level), j.message.code?.code || '', j.message.message, 'cargo check');
    }
    if (!seen && r.status !== 0) failed(group[0], 'cargo check', r, r.stderr.split('\n')[0]);
  }
}

function runC(files) {
  for (const f of files) {
    const clangd = onPath('clangd', dirname(f));
    if (clangd) {
      const r = run(clangd, [`--check=${f}`], dirname(f));
      for (const line of (r.stdout + r.stderr).split('\n')) {
        const m = /^([EW])\[[\d:.]+\] (?:\[([\w.-]+)\] )?Line (\d+): (.*)$/.exec(line);
        if (m) add(f, +m[3], 0, m[1] === 'E' ? 'error' : 'warning', m[2] || '', m[4], 'clangd --check');
      }
      continue;
    }
    const cc = onPath('clang') || onPath('cc');
    if (!cc) { missing(f, 'clangd', 'install LLVM/clang yourself'); continue; }
    const cpp = /\.(cc|cpp|cxx|hpp|hh|hxx)$/.test(f);
    const r = run(cc, ['-fsyntax-only', '-fno-color-diagnostics', ...(cpp ? ['-x', 'c++'] : []), f], dirname(f));
    for (const line of r.stderr.split('\n')) {
      const m = /^(.+?):(\d+):(\d+): (error|warning|note): (.*)$/.exec(line);
      if (m) add(resolve(dirname(f), m[1]), +m[2], +m[3], sev(m[4]), '', m[5], 'cc -fsyntax-only');
    }
  }
}

function runSh(files) {
  const sc = onPath('shellcheck', dirname(files[0]));
  if (sc) {
    const r = run(sc, ['-f', 'json', ...files], dirname(files[0]));
    try {
      for (const d of JSON.parse(r.stdout || '[]')) add(d.file, d.line, d.column, sev(d.level), `SC${d.code}`, d.message, 'shellcheck');
    } catch { failed(files[0], 'shellcheck', r, r.stderr.split('\n')[0]); }
    return;
  }
  missing(files[0], 'shellcheck');
  const bash = onPath('bash');
  if (!bash) return;
  for (const f of files) {
    const r = run(bash, ['-n', f], dirname(f));
    for (const line of r.stderr.split('\n')) {
      const m = /^(.+?): line (\d+): (.*)$/.exec(line);
      if (m) add(f, +m[2], 0, 'error', 'syntax', m[3], 'bash -n (syntax only)');
    }
  }
}

const RUNNERS = { ts: runTs, py: runPy, go: runGo, rust: runRust, c: runC, sh: runSh };

// ---- main -----------------------------------------------------------------

const groups = new Map();
const wanted = new Set();
for (const arg of fileArgs) {
  const abs = resolve(arg);
  if (!existsSync(abs) || !statSync(abs).isFile()) { note(abs, 'failed', 'no-such-file', 'not a file', 'diagnostics.mjs'); continue; }
  const lang = LANG_BY_EXT[extname(abs).toLowerCase()];
  if (!lang) { note(abs, 'unsupported', 'no-checker', `no checker wired for ${extname(abs) || 'this file'}; use the project's own build or lint command`, 'diagnostics.mjs'); continue; }
  wanted.add(abs);
  groups.set(lang, [...(groups.get(lang) || []), abs]);
}
for (const [lang, files] of groups) RUNNERS[lang](files);

const seenKeys = new Set();
const finalOut = out.filter((d) => {
  const key = JSON.stringify(d);
  if (seenKeys.has(key)) return false;
  seenKeys.add(key);
  if (keepAll || !d.file || d.line === 0 && d.col === 0) return true;
  return wanted.has(resolve(cwd, d.file));
});
process.stdout.write(JSON.stringify(wantSummary ? { ran: [...ranTools], diagnostics: finalOut } : finalOut, null, 2) + '\n');

const hasError = finalOut.some((d) => d.severity === 'error');
const real = finalOut.some((d) => ['error', 'warning', 'info'].includes(d.severity));
const gaps = finalOut.some((d) => ['missing', 'failed', 'unsupported'].includes(d.severity));
process.exit(hasError ? 1 : gaps && !real ? 3 : 0);
