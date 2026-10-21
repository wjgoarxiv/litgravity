#!/usr/bin/env node
// One-shot symbol query against the project's own TypeScript server (tsserver).
// Dependency-free; it only runs a `typescript` package that is already installed
// (project node_modules first, then the global npm root). It never installs.
//
//   node tsserver-query.mjs <definition|references|quickinfo|rename> <file> <line> <col> [--timeout=<sec>]
//
// line and col are 1-based. Prints one JSON object: {command, ok, body} or
// {command, ok:false, missing:"typescript"|..., message}. Exit 0 when the server
// answered, 3 when typescript is missing, 1 on a server error, 2 on usage.

import { spawn } from 'node:child_process';
import { firstLine, runNpmSync } from '../../../lib/host-exec.mjs';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const timeoutArg = process.argv.find((a) => a.startsWith('--timeout='));
const timeoutMs = (timeoutArg ? Number(timeoutArg.split('=')[1]) : 60) * 1000;
const [command, fileArg, lineArg, colArg] = argv;
const COMMANDS = new Set(['definition', 'references', 'quickinfo', 'rename']);

if (!COMMANDS.has(command) || !fileArg || !lineArg || !colArg) {
  process.stderr.write('usage: node tsserver-query.mjs <definition|references|quickinfo|rename> <file> <line> <col>\n');
  process.exit(2);
}

const file = resolve(fileArg);
if (!existsSync(file)) {
  process.stdout.write(JSON.stringify({ command, ok: false, message: `no such file: ${file}` }) + '\n');
  process.exit(2);
}

function findTsserver(from) {
  let d = dirname(from);
  for (;;) {
    const p = join(d, 'node_modules', 'typescript', 'lib', 'tsserver.js');
    if (existsSync(p)) return p;
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  const root = runNpmSync(['root', '-g'], { encoding: 'utf8', timeout: 15000 });
  const g = firstLine(root.stdout);
  const gp = g && join(g, 'typescript', 'lib', 'tsserver.js');
  return gp && existsSync(gp) ? gp : null;
}

const tsserver = findTsserver(file);
if (!tsserver) {
  process.stdout.write(JSON.stringify({ command, ok: false, missing: 'typescript', message: 'typescript is not installed in this project or globally; nothing was installed' }) + '\n');
  process.exit(3);
}

const child = spawn(process.execPath, [tsserver, '--disableAutomaticTypingAcquisition'], { stdio: ['pipe', 'pipe', 'ignore'] });
const timer = setTimeout(() => finish({ command, ok: false, message: `tsserver timed out after ${timeoutMs / 1000}s` }, 1), timeoutMs);
let buf = '';
let done = false;

function finish(result, code) {
  if (done) return;
  done = true;
  clearTimeout(timer);
  child.kill();
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(code);
}

const send = (seq, cmd, args) => child.stdin.write(JSON.stringify({ seq, type: 'request', command: cmd, arguments: args }) + '\n');

child.stdout.on('data', (chunk) => {
  buf += chunk.toString('utf8');
  for (const line of buf.split('\n')) {
    if (!line.startsWith('{')) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    if (msg.type === 'response' && msg.request_seq === 2) {
      finish({ command, ok: !!msg.success, body: msg.body ?? null, message: msg.message }, msg.success ? 0 : 1);
    }
  }
});

send(1, 'open', { file });
send(2, command, { file, line: Number(lineArg), offset: Number(colArg) });
