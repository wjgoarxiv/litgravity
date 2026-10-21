import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  splitLines, firstLine, pathExtensions, resolveOnPath, quoteForCmd, spawnPlan, npmInvocation, describeSpawn, runSync,
} from '../plugin/lib/host-exec.mjs';
import { pickPython } from '../plugin/lib/python-pick.mjs';
import { paths } from '../lib/paths.mjs';
import { hudCommand, isOurs } from '../lib/statusline.mjs';
import { hostToolOk, HOST_TOOLS } from '../lib/host-tools.mjs';
import { PLUGIN, ROOT } from './helpers.mjs';

// A fake Windows machine: only the listed files exist, whatever the real platform is.
const winFs = (...files) => {
  const have = new Set(files.map((f) => f.toLowerCase()));
  return (p) => have.has(p.toLowerCase());
};
const WIN = (extra = {}) => ({ platform: 'win32', env: { Path: 'C:\\bin;C:\\Program Files\\nodejs', PATHEXT: '.COM;.EXE;.BAT;.CMD' }, ...extra });

test('child output with CRLF line endings splits cleanly (where.exe prints CRLF)', () => {
  assert.deepEqual(splitLines('C:\\a\\ffmpeg.exe\r\nC:\\b\\ffmpeg.exe\r\n'), ['C:\\a\\ffmpeg.exe', 'C:\\b\\ffmpeg.exe', '']);
  assert.equal(firstLine('\r\nC:\\a\\ffmpeg.exe\r\nC:\\b\\ffmpeg.exe\r\n'), 'C:\\a\\ffmpeg.exe');
  assert.equal(firstLine(''), '');
  assert.equal(firstLine(undefined), '');
});

test('PATHEXT decides which extensions a bare name may carry on Windows', () => {
  assert.deepEqual(pathExtensions({ PATHEXT: '.COM;.EXE;.cmd' }, 'win32'), ['.com', '.exe', '.cmd']);
  assert.deepEqual(pathExtensions({}, 'win32'), ['.com', '.exe', '.bat', '.cmd']);
  assert.deepEqual(pathExtensions({ PATHEXT: '.EXE' }, 'linux'), ['']);
});

test('ffmpeg is found as ffmpeg.exe through PATHEXT, and the Path key is read whatever its case', () => {
  const ctx = WIN({ isFile: winFs('C:\\Program Files\\nodejs\\ffmpeg.exe') });
  assert.equal(resolveOnPath('ffmpeg', ctx), 'C:\\Program Files\\nodejs\\ffmpeg.exe');
  assert.equal(resolveOnPath('ffprobe', ctx), null);
  assert.equal(resolveOnPath('ffmpeg.exe', ctx), 'C:\\Program Files\\nodejs\\ffmpeg.exe');
});

test('on Windows a bare name without an extension is not an executable; on POSIX it is', () => {
  assert.equal(resolveOnPath('npm', WIN({ isFile: winFs('C:\\bin\\npm') })), null);
  assert.equal(resolveOnPath('npm', WIN({ isFile: winFs('C:\\bin\\npm', 'C:\\bin\\npm.cmd') })), 'C:\\bin\\npm.cmd');
  const posix = { platform: 'linux', env: { PATH: '/usr/bin:/opt/bin' }, isFile: (p) => p === '/opt/bin/rg' };
  assert.equal(resolveOnPath('rg', posix), '/opt/bin/rg');
});

test('spawning a .cmd or .bat goes through the shell with every argument quoted (CVE-2024-27980: EINVAL otherwise)', () => {
  const plan = spawnPlan('tsc', ['--noEmit', 'C:\\My Project\\a b.ts'], WIN({ isFile: winFs('C:\\bin\\tsc.cmd') }));
  assert.equal(plan.shell, true);
  assert.equal(plan.command, 'C:\\bin\\tsc.cmd');
  assert.deepEqual(plan.args, ['--noEmit', '"C:\\My Project\\a b.ts"']);
  const spaced = spawnPlan('npm', ['ci'], WIN({ isFile: winFs('C:\\Program Files\\nodejs\\npm.cmd') }));
  assert.equal(spaced.command, '"C:\\Program Files\\nodejs\\npm.cmd"');
});

test('a real executable is spawned directly, with no shell, on Windows and POSIX', () => {
  const exe = spawnPlan('ffmpeg', ['-version'], WIN({ isFile: winFs('C:\\bin\\ffmpeg.exe') }));
  assert.equal(exe.shell, false);
  assert.equal(exe.command, 'C:\\bin\\ffmpeg.exe');
  const posix = spawnPlan('npm', ['ci'], { platform: 'linux', env: { PATH: '/x' }, isFile: () => false });
  assert.deepEqual(posix, { command: 'npm', args: ['ci'], shell: false });
});

test('quoting refuses what cmd.exe would expand or split, and doubles a trailing backslash', () => {
  assert.equal(quoteForCmd('--no-audit'), '--no-audit');
  assert.equal(quoteForCmd('C:\\dir\\'), 'C:\\dir\\');
  assert.equal(quoteForCmd('C:\\a b\\'), '"C:\\a b\\\\"');
  assert.equal(quoteForCmd('a&b'), '"a&b"');
  for (const bad of ['say "hi"', '%PATH%', 'a\nb', 'a\0b']) assert.throws(() => quoteForCmd(bad), /UNSAFE_CMD_ARG/, JSON.stringify(bad));
});

test('npm on Windows runs npm-cli.js through node when npm_execpath names it', () => {
  const inv = npmInvocation(['ci'], { platform: 'win32', execPath: 'C:\\node\\node.exe', env: { npm_execpath: 'C:\\node\\node_modules\\npm\\bin\\npm-cli.js' }, isFile: () => false });
  assert.deepEqual(inv, { command: 'C:\\node\\node.exe', args: ['C:\\node\\node_modules\\npm\\bin\\npm-cli.js', 'ci'], shell: false });
});

test('npm on Windows ignores an npm_execpath that is not npm (yarn, pnpm) and finds npm-cli.js beside node', () => {
  const sibling = 'C:\\node\\node_modules\\npm\\bin\\npm-cli.js';
  const inv = npmInvocation(['ci'], { platform: 'win32', execPath: 'C:\\node\\node.exe', env: { npm_execpath: 'C:\\yarn\\yarn.js' }, isFile: winFs(sibling) });
  assert.deepEqual(inv.args, [sibling, 'ci']);
  assert.equal(inv.shell, false);
});

test('npm on Windows with no npm-cli.js falls back to npm.cmd through the shell, never a bare npm.cmd spawn', () => {
  const inv = npmInvocation(['ci', '--prefix', 'C:\\cache dir'], { platform: 'win32', execPath: 'C:\\node\\node.exe', env: { Path: 'C:\\node', PATHEXT: '.EXE;.CMD' }, isFile: winFs('C:\\node\\npm.cmd') });
  assert.equal(inv.shell, true);
  assert.equal(inv.command, 'C:\\node\\npm.cmd');
  assert.deepEqual(inv.args, ['ci', '--prefix', '"C:\\cache dir"']);
});

test('npm on POSIX stays a plain npm', () => {
  assert.deepEqual(npmInvocation(['ci'], { platform: 'darwin', execPath: '/usr/bin/node', env: {}, isFile: () => false }), { command: 'npm', args: ['ci'], shell: false });
});

test('a spawn failure shows the exit code, the error code and the stderr tail', () => {
  assert.equal(describeSpawn({ status: 1, stderr: 'x\nboom\n' }), 'exit 1: boom');
  assert.match(describeSpawn({ status: null, error: Object.assign(new Error('spawnSync npm.cmd EINVAL'), { code: 'EINVAL' }), stderr: '' }), /EINVAL.*spawnSync npm\.cmd EINVAL/);
  assert.match(describeSpawn({ status: null, signal: 'SIGTERM', stderr: '' }), /signal SIGTERM/);
});

test('runSync returns the child result for a real executable (POSIX path, run for real)', () => {
  const r = runSync(process.execPath, ['-e', 'process.stdout.write("ok"); process.exit(3)'], { encoding: 'utf8' });
  assert.equal(r.status, 3);
  assert.equal(r.stdout, 'ok');
});

test('python for engines: Windows tries python and then the py launcher when python3 is the Store stub', () => {
  const probe = (command) => (command === 'py' ? { command, found: true, version: '3.12.1', parts: [3, 12, 1] } : { command, found: false, detail: 'Python was not found' });
  const p = pickPython(undefined, 'LITGRAVITY_OFFICE_PYTHON', { platform: 'win32', probe });
  assert.deepEqual({ ok: p.ok, command: p.command }, { ok: true, command: 'py' });
  const none = pickPython(undefined, 'LITGRAVITY_OFFICE_PYTHON', { platform: 'win32', probe: (command) => ({ command, found: false, detail: 'nope' }) });
  assert.equal(none.ok, false);
  assert.match(none.detail, /python\.org|winget/);
});

test('settings live under %USERPROFILE%\\.gemini on Windows, where HOME is not set', () => {
  const p = paths({ USERPROFILE: 'C:\\Users\\woojin' }, 'C:\\work', { platform: 'win32' });
  assert.equal(p.home, 'C:\\Users\\woojin');
  assert.match(p.agySettings.replaceAll('\\', '/'), /Users\/woojin\/\.gemini\/antigravity-cli\/settings\.json$/);
  assert.match(p.userPlugin.replaceAll('\\', '/'), /\.gemini\/config\/plugins\/litgravity$/);
});

test('the status-line command is recognised as ours whichever slash style the settings file carries', () => {
  const p = paths({ HOME: '/h' }, '/w');
  const cmd = hudCommand(p.userPlugin);
  assert.equal(isOurs({ command: cmd }), true);
  assert.equal(isOurs({ command: 'node "C:\\Users\\a\\.gemini\\config\\plugins\\litgravity\\hud\\statusline.mjs"' }), true);
  assert.equal(isOurs({ command: 'node "C:/Users/a/.gemini/config/plugins/litgravity/hud/statusline.mjs"' }), true);
  assert.equal(isOurs({ command: 'node other.mjs' }), false);
});

test('doctor host tools are found without sh on Windows: ffmpeg.exe through PATHEXT, soffice in Program Files', () => {
  const ffmpeg = HOST_TOOLS.find((t) => t.label === 'ffmpeg');
  const soffice = HOST_TOOLS.find((t) => t.label.startsWith('LibreOffice'));
  const poppler = HOST_TOOLS.find((t) => t.label.startsWith('Poppler'));
  const win = (...files) => ({ platform: 'win32', env: { Path: 'C:\\bin', PATHEXT: '.EXE;.CMD', ProgramFiles: 'C:\\Program Files' }, isFile: winFs(...files) });
  assert.equal(hostToolOk(ffmpeg, win('C:\\bin\\ffmpeg.exe')), true);
  assert.equal(hostToolOk(ffmpeg, win()), false);
  assert.equal(hostToolOk(soffice, win('C:\\Program Files\\LibreOffice\\program\\soffice.exe')), true);
  assert.equal(hostToolOk(poppler, win('C:\\bin\\pdftoppm.exe')), false);
  assert.equal(hostToolOk(poppler, win('C:\\bin\\pdftoppm.exe', 'C:\\bin\\pdftotext.exe')), true);
});

// ---- Python: the office bootstrap and the PDF font preflight ----

const PY = (code, env = {}) => spawnSync('python3', ['-I', '-B', '-c', code], { encoding: 'utf8', env: { PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: '1', ...env } });
const SCRIPTS = join(PLUGIN, 'skills', 'lit-pptx', 'scripts');
const DOCX_SCRIPTS = join(PLUGIN, 'skills', 'lit-docx', 'scripts');

test('the office bootstrap hands back the child exit code on Windows (a script that exits 3 returns 3)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-win-'));
  const child = join(dir, 'child.py');
  writeFileSync(child, 'import sys\nsys.exit(3)\n');
  const r = PY(`
import sys
sys.path.insert(0, ${JSON.stringify(SCRIPTS)})
import office_runtime_bootstrap as b
code = b.reexec(sys.executable, ${JSON.stringify(child)}, [], {}, platform="win32")
print("RETURNED", code)
`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /RETURNED 3/);
});

test('the office bootstrap keeps execve on POSIX: the replaced process exits with the child code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'litgravity-win-'));
  const child = join(dir, 'child.py');
  writeFileSync(child, 'import sys\nsys.exit(3)\n');
  const r = PY(`
import sys
sys.path.insert(0, ${JSON.stringify(SCRIPTS)})
import office_runtime_bootstrap as b
b.reexec(sys.executable, ${JSON.stringify(child)}, [], {})
print("NOT REACHED")
`);
  assert.equal(r.status, 3, r.stderr);
  assert.doesNotMatch(r.stdout, /NOT REACHED/);
});

test('the PDF font preflight names the missing font and the fix, and stays quiet when it cannot list fonts', () => {
  const run = (families, fonts) => PY(`
import sys
sys.path.insert(0, ${JSON.stringify(DOCX_SCRIPTS)})
import pdf_fonts as f
try:
    f.require_fonts(${JSON.stringify(families)}, ${fonts})
    print("OK")
except SystemExit as e:
    print(e)
`);
  const missing = run(['Pretendard', 'Times New Roman'], '["Times New Roman", "Arial"]');
  assert.match(missing.stdout, /BLOCKED/);
  assert.match(missing.stdout, /Pretendard/);
  assert.match(missing.stdout, /github\.com\/orioncactus\/pretendard/);
  assert.doesNotMatch(missing.stdout, /Times New Roman is/);
  assert.match(run(['Pretendard'], '["Pretendard Variable", "Arial"]').stdout, /OK/);
  assert.match(run(['Pretendard'], 'None').stdout, /OK/);
});

test('Windows font names from the registry list match a family ("Pretendard Bold (TrueType)")', () => {
  const r = PY(`
import sys
sys.path.insert(0, ${JSON.stringify(DOCX_SCRIPTS)})
import pdf_fonts as f
print(f.parse_registry_fonts("    Pretendard Bold (TrueType)    REG_SZ    PretendardBold.otf\\r\\n    Times New Roman (TrueType)    REG_SZ    times.ttf\\r\\n"))
`);
  assert.match(r.stdout, /Pretendard Bold/);
  assert.match(r.stdout, /Times New Roman/);
});

test('every LaTeX template loads longtable so a pandoc table compiles', () => {
  for (const name of ['elsevier', 'acs', 'ieee', 'nature', 'korean-generic']) {
    const tex = readFileSync(join(PLUGIN, 'skills', 'lit-docx', 'templates', 'latex', name, 'template.tex'), 'utf8');
    assert.match(tex, /\\usepackage\{longtable\}/, name);
  }
});

test('no skill script spawns npm, npx or a .cmd by bare name, and none parses child output with split("\\n") on a where/which probe', () => {
  const offenders = [];
  const roots = [join(PLUGIN, 'skills'), join(PLUGIN, 'lib'), join(ROOT, 'lib'), join(ROOT, 'scripts')];
  const out = spawnSync('grep', ['-rnE', '--include=*.mjs', '--include=*.js', '(spawn|spawnSync|execFile|execFileSync)\\(\\s*[\'"`](npm|npx|npm\\.cmd|npx\\.cmd|pnpm|yarn)[\'"`]|"where" : "which"', ...roots], { encoding: 'utf8' });
  for (const line of out.stdout.split('\n').filter(Boolean)) offenders.push(line);
  assert.deepEqual(offenders, []);
});
