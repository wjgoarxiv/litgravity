#!/usr/bin/env node
// verify-lsp.mjs <file> [--timeout=ms] [--server="<command line>"] [--via=auto|server|checker]
//
// Real diagnostics roundtrip for ONE file. agy has no language-server tool and no plugin LSP config, so the
// result is evidence about the toolchain on this machine, read by the model from this script's output.
//
//   via=server   resolve the language server for the extension, spawn it over stdio, run initialize ->
//                initialized -> didOpen, answer the server's own requests with empty results, and wait for
//                textDocument/publishDiagnostics for that document.
//   via=checker  run the one-shot checker CLI through ../../lsp/scripts/diagnostics.mjs --summary and count
//                the rows it produced; the checker must have started.
//   via=auto     (default) the server when it resolves; the checker when the server is absent, crashes or
//                times out. The message names the server failure, so a checker OK never hides it.
//
// Dependency-free; installs nothing; kills every process it starts.
//
// Exit: 0 OK, 1 FAIL (not installed, crashed, timed out), 2 usage, 3 SKIP (nothing known for the extension).
// Output: one JSON line {status, via, file, server, checker, diagnostics, message} on stdout.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LANGUAGES } from './lsp-server-table.mjs';
import { resolveOnPath, spawnPlan } from '../../../lib/host-exec.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIAGNOSTICS = resolve(HERE, '..', '..', 'lsp', 'scripts', 'diagnostics.mjs');

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith('--'));
const timeoutArg = args.find((a) => a.startsWith('--timeout='));
const serverArg = args.find((a) => a.startsWith('--server='));
const viaArg = args.find((a) => a.startsWith('--via='));
const timeoutMs = timeoutArg && Number(timeoutArg.slice(10)) > 0 ? Number(timeoutArg.slice(10)) : 60000;
const via = viaArg ? viaArg.slice(6) : 'auto';

const report = (status, fields) => process.stdout.write(`${JSON.stringify({ status, ...fields })}\n`);

if (!filePath || !['auto', 'server', 'checker'].includes(via)) {
  process.stderr.write('usage: node verify-lsp.mjs <file> [--timeout=ms] [--server="<command line>"] [--via=auto|server|checker]\n');
  process.exit(2);
}
if (!existsSync(filePath) || !statSync(filePath).isFile()) {
  process.stderr.write(`verify-lsp: not a file: ${filePath}\n`);
  process.exit(2);
}

const absolute = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
const ext = extname(absolute).toLowerCase();
const entry = LANGUAGES.find((l) => l.extensions.includes(ext));

// Project-local installs win over PATH, the same order detect-lsp.mjs reports.
function resolveBin(cmd) {
  if (cmd.includes('/')) return cmd;
  const dirs = [];
  let d = process.cwd();
  for (;;) {
    dirs.push(join(d, 'node_modules', '.bin'), join(d, '.venv', 'bin'), join(d, '.venv', 'Scripts'));
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  dirs.push(...(process.env.PATH || process.env.Path || '').split(process.platform === 'win32' ? ';' : ':').filter(Boolean));
  for (const dir of dirs) {
    const p = resolveOnPath(cmd, { env: { PATH: dir, PATHEXT: process.env.PATHEXT } });
    if (p) return p;
  }
  return null;
}

// ---- checker path ----------------------------------------------------------

function viaChecker(reasonPrefix) {
  const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const r = spawnSync(process.execPath, [DIAGNOSTICS, '--summary', `--timeout=${seconds}`, absolute], {
    cwd: process.cwd(), encoding: 'utf8', timeout: timeoutMs + 10000, maxBuffer: 64 * 1024 * 1024,
  });
  let parsed;
  try { parsed = JSON.parse(r.stdout); } catch { parsed = null; }
  if (!parsed || !Array.isArray(parsed.diagnostics)) {
    report('FAIL', { via: 'checker', file: absolute, server: null, checker: null, diagnostics: null, message: `${reasonPrefix}diagnostics.mjs gave no parseable output: ${(r.stderr || '').trim().slice(0, 300)}` });
    process.exit(1);
  }
  const rows = parsed.diagnostics;
  const real = rows.filter((d) => ['error', 'warning', 'info'].includes(d.severity));
  const unsupported = rows.filter((d) => d.severity === 'unsupported');
  const gaps = rows.filter((d) => ['missing', 'failed'].includes(d.severity));
  const checker = parsed.ran.join(', ') || null;
  if (parsed.ran.length === 0 && unsupported.length > 0) {
    report('SKIP', { via: 'checker', file: absolute, server: null, checker: null, diagnostics: null, message: `${reasonPrefix}${unsupported[0].message}` });
    process.exit(3);
  }
  if (parsed.ran.length === 0) {
    const why = gaps.map((g) => g.message).join(' | ').slice(0, 400) || 'no checker started';
    report('FAIL', { via: 'checker', file: absolute, server: null, checker: null, diagnostics: null, message: `${reasonPrefix}no checker ran: ${why}` });
    process.exit(1);
  }
  const syntaxOnly = parsed.ran.every((t) => ['python3', 'bash'].includes(t));
  const note = [
    syntaxOnly ? 'syntax-only parser ran, no type or lint checker' : '',
    gaps.length ? `${gaps.length} gap row(s): ${gaps.map((g) => `${g.source} ${g.severity}`).join(', ')}` : '',
  ].filter(Boolean).join('; ');
  report('OK', { via: 'checker', file: absolute, server: null, checker, diagnostics: real.length, message: `${reasonPrefix}checker roundtrip succeeded${note ? ` (${note})` : ''}` });
  process.exit(0);
}

if (via === 'checker') viaChecker('');

// ---- server path -----------------------------------------------------------

if (!entry && !serverArg) {
  if (via === 'auto') viaChecker(`no language server known for "${ext}"; `);
  report('SKIP', { via: 'server', file: absolute, message: `no language server known for "${ext}"` });
  process.exit(3);
}
const command = serverArg ? serverArg.slice(9).split(/\s+/).filter(Boolean) : entry.command;
const [bin, ...binArgs] = command;
if (!bin) {
  report('SKIP', { via: 'server', file: absolute, message: 'empty server command' });
  process.exit(3);
}
const binPath = resolveBin(bin);
if (!binPath) {
  if (via === 'auto') viaChecker(`language server not installed (${bin}); `);
  report('FAIL', { via: 'server', file: absolute, server: command.join(' '), diagnostics: null, message: `language server not installed (${bin}); nothing was installed` });
  process.exit(1);
}

const text = readFileSync(absolute, 'utf8');
const uri = pathToFileURL(absolute).href;
const rootUri = pathToFileURL(process.cwd()).href;
const languageId = entry ? entry.language : 'plaintext';

// A .cmd shim (typescript-language-server on Windows) needs the shell; spawnPlan quotes it and refuses anything unsafe.
const plan = spawnPlan(binPath, binArgs);
const child = spawn(plan.command, plan.args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: process.cwd(), shell: plan.shell });
let settled = false;
let stderr = '';

function finish(code, status, message, diagnostics) {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  try { child.kill('SIGKILL'); } catch { /* already gone */ }
  if (code !== 0 && via === 'auto') viaChecker(`language server failed (${message.replace(/\s+/g, ' ').slice(0, 200)}); `);
  report(status, { via: 'server', file: absolute, server: command.join(' '), checker: null, diagnostics: diagnostics ?? null, message });
  process.exit(code);
}

const timer = setTimeout(() => finish(1, 'FAIL', `timed out after ${timeoutMs}ms waiting for diagnostics`), timeoutMs);
child.on('error', (e) => finish(1, 'FAIL', e.code === 'ENOENT' ? `language server not installed (${bin}); nothing was installed` : e.message));
child.on('exit', (c) => finish(1, 'FAIL', `server exited (code ${c ?? '?'}) ${stderr.trim().slice(0, 400)}`));
child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
child.stdin.on('error', () => { /* the exit handler reports it */ });

const send = (m) => {
  const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...m }), 'utf8');
  child.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'), body]));
};

let buffer = Buffer.alloc(0);
child.stdout.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const end = buffer.indexOf('\r\n\r\n');
    if (end === -1) return;
    const m = /content-length:\s*(\d+)/i.exec(buffer.subarray(0, end).toString('ascii'));
    if (!m) { buffer = buffer.subarray(end + 4); continue; }
    const start = end + 4;
    const len = Number(m[1]);
    if (buffer.length < start + len) return;
    const body = buffer.subarray(start, start + len).toString('utf8');
    buffer = buffer.subarray(start + len);
    let msg; try { msg = JSON.parse(body); } catch { continue; }
    onMessage(msg);
  }
});

function onMessage(msg) {
  if (msg.method && msg.id !== undefined) {
    const result = msg.method === 'workspace/configuration' ? (msg.params?.items || []).map(() => null) : null;
    send({ id: msg.id, result });
    return;
  }
  if (msg.id === 1 && msg.result !== undefined) {
    send({ method: 'initialized', params: {} });
    send({ method: 'textDocument/didOpen', params: { textDocument: { uri, languageId, version: 1, text } } });
    return;
  }
  if (msg.method === 'textDocument/publishDiagnostics' && msg.params?.uri === uri) {
    const n = Array.isArray(msg.params.diagnostics) ? msg.params.diagnostics.length : 0;
    finish(0, 'OK', `roundtrip succeeded via ${entry ? entry.serverId : bin}`, n);
  }
}

send({
  id: 1, method: 'initialize',
  params: {
    processId: process.pid, rootUri, workspaceFolders: [{ uri: rootUri, name: 'root' }],
    capabilities: { textDocument: { publishDiagnostics: {} }, workspace: { configuration: true, workspaceFolders: true } },
  },
});
