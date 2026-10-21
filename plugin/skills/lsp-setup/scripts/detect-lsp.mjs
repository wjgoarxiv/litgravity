#!/usr/bin/env node
// detect-lsp.mjs [projectDir] [--json]
//
// Read-only scan for the LitGravity `lsp-setup` skill. agy has no plugin LSP config, so this reports what is
// installed rather than what is configured: for every language found in the project it lists the language
// server and each checker CLI as present (with the resolved path and version) or missing, the project config
// files that exist, whether ../../lsp/scripts/diagnostics.mjs can normalise that language, and the install
// command the USER could run on this OS. It starts no language server, installs nothing and writes nothing.
//
// Exit: 0 report printed, 2 usage (not a directory).

import { resolveOnPath, runSync, splitLines } from '../../../lib/host-exec.mjs';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { LANGUAGES, PLATFORM } from './lsp-server-table.mjs';

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'target', '.venv', 'venv', 'vendor',
  '.cache', '__pycache__', '.turbo', 'coverage', '.litgravity', '.terraform', '.gradle', '.dart_tool', '_build', 'deps']);
const MAX_FILES = 50000;
const BASENAME_EXT = { Dockerfile: '.dockerfile', Containerfile: '.dockerfile' };

const args = process.argv.slice(2);
const wantsJson = args.includes('--json');
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd());
if (!existsSync(root) || !statSync(root).isDirectory()) {
  process.stderr.write(`detect-lsp: not a directory: ${root}\n`);
  process.exit(2);
}

function collect(dir) {
  const found = new Map();
  const names = new Set();
  const stack = [dir];
  let seen = 0;
  let truncated = false;
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = readdirSync(cur); } catch { continue; }
    for (const e of entries) {
      if (seen >= MAX_FILES) { truncated = true; return { found, names, truncated }; }
      const full = join(cur, e);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) { if (!SKIP.has(e)) stack.push(full); continue; }
      if (!st.isFile()) continue;
      seen += 1;
      names.add(e);
      const ext = (BASENAME_EXT[e] || extname(e)).toLowerCase();
      if (ext) found.set(ext, (found.get(ext) || 0) + 1);
    }
  }
  return { found, names, truncated };
}

// Project-local installs first (node_modules/.bin, .venv/bin, vendor/bin), then PATH.
function resolveBin(cmd) {
  const dirs = [join(root, 'node_modules', '.bin'), join(root, '.venv', 'bin'), join(root, '.venv', 'Scripts'), join(root, 'venv', 'bin'), join(root, 'venv', 'Scripts'), join(root, 'vendor', 'bin'),
    ...(process.env.PATH || process.env.Path || '').split(process.platform === 'win32' ? ';' : ':').filter(Boolean)];
  for (const d of dirs) {
    const p = resolveOnPath(cmd, { env: { PATH: d, PATHEXT: process.env.PATHEXT } });
    if (p) return p;
  }
  return null;
}

// Version flags that differ from --version; null skips the probe (flutter can self-update on first run).
const VERSION_ARGS = { go: ['version'], zig: ['version'], luac: ['-v'], flutter: null, gradle: null };

function versionOf(path) {
  const name = path.split(/[\\/]/).pop();
  const flags = name in VERSION_ARGS ? VERSION_ARGS[name] : ['--version'];
  if (!flags) return '';
  const r = runSync(path, flags, { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.error) return '';
  const line = splitLines(`${r.stdout || ''}\n${r.stderr || ''}`).find((l) => l.trim());
  return line ? line.trim().slice(0, 100) : '';
}

function hasProjectFile(names, pattern) {
  if (!pattern.includes('*')) return names.has(pattern);
  const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return [...names].some((n) => re.test(n));
}

const { found, names, truncated } = collect(root);
const results = [];
for (const s of LANGUAGES) {
  const count = s.extensions.reduce((n, ext) => n + (found.get(ext) || 0), 0);
  if (!count) continue;
  const serverPath = resolveBin(s.command[0]);
  const checkers = s.checkers.map((tool) => {
    const path = resolveBin(tool);
    return { tool, installed: !!path, path, version: path ? versionOf(path) : '' };
  });
  results.push({
    language: s.language,
    files: count,
    server: { id: s.serverId, command: s.command.join(' '), installed: !!serverPath, path: serverPath, version: serverPath ? versionOf(serverPath) : '' },
    checkers,
    diagnosticsWired: s.wired,
    buildCheck: s.buildCheck,
    projectFiles: s.projectFiles.filter((p) => hasProjectFile(names, p)),
    projectFilesWanted: s.projectFiles,
    reference: `references/${s.language === 'razor' ? 'csharp' : s.language}/README.md`,
    installHint: s.install[PLATFORM],
  });
}

if (wantsJson) {
  process.stdout.write(`${JSON.stringify({ root, platform: PLATFORM, truncated, results }, null, 2)}\n`);
  process.exit(0);
}

const lines = [`LSP setup scan: ${root} (${PLATFORM})`, ''];
if (!results.length) lines.push('No languages with a known server were detected here.');
for (const r of results) {
  const srv = r.server.installed ? `server OK (${r.server.path})` : `server MISSING (${r.server.command.split(' ')[0]})`;
  lines.push(`${r.language.padEnd(11)} ${String(r.files).padStart(5)} files  ${srv}`);
  const chk = r.checkers.map((c) => `${c.tool} ${c.installed ? 'OK' : 'missing'}`).join(', ');
  lines.push(`            checkers: ${chk}${r.diagnosticsWired ? '  [normalised by lsp/scripts/diagnostics.mjs]' : '  [no normaliser: cite the project build command]'}`);
  lines.push(`            project files: ${r.projectFiles.length ? r.projectFiles.join(', ') : `none of ${r.projectFilesWanted.join(', ') || 'n/a'}`}`);
  lines.push(`            evidence command: ${r.buildCheck}`);
  if (!r.server.installed) lines.push(`            you could run: ${r.installHint}`);
  lines.push(`            notes: ${r.reference}`);
}
if (truncated) lines.push('', `Scan stopped at ${MAX_FILES} files; point it at a sub-directory for the rest.`);
lines.push('', 'Nothing was installed, started or written. Read the reference above, then verify with verify-lsp.mjs.');
process.stdout.write(`${lines.join('\n')}\n`);
