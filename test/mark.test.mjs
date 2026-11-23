import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, PLUGIN, collect, sandbox, walk } from './helpers.mjs';
import { MONO_ROWS, PIXEL_ROWS, SHARED_COLOURS, SPEC_DIGEST } from '../lib/synthwave-data.mjs';
import { CHROME, PLAIN_LINE, markDepth, markRows, pickSize, printMark } from '../lib/mark.mjs';
import { install } from '../lib/install.mjs';
import { doctor } from '../lib/doctor.mjs';
import { PILL_STOPS, renderStatus, visibleWidth } from '../plugin/hud/render.mjs';

// The digest the LitFamily synthwave spec publishes for these rows.
const SPEC_JSON_DIGEST = 'f063a0cefb969db40c0fc436742240912d895d43c3013d35782320befc0a2b86';
const SIZES = ['B-L', 'B-M', 'B-S'];
const ESC = /\u001b/;
const BIN = join(ROOT, 'bin', 'litgravity.mjs');
const tty = (columns) => ({ isTTY: true, columns });

test('the generated rows hash to the spec digest', () => {
  const body = [
    SIZES.map((s) => PIXEL_ROWS[s].join('\n')).join('\n--\n'),
    JSON.stringify(SHARED_COLOURS),
    SIZES.map((s) => MONO_ROWS[s].join('\n')).join('\n--\n'),
  ].join('');
  const digest = createHash('sha256').update(body).digest('hex');
  assert.equal(digest, SPEC_DIGEST);
  assert.equal(SPEC_DIGEST, SPEC_JSON_DIGEST);
});

test('the size ladder: B-L from 76, B-M from 44, B-S from 24, one plain line below, unknown width as 80', () => {
  assert.equal(pickSize(20), null);
  assert.equal(pickSize(23), null);
  assert.equal(pickSize(24), 'B-S');
  assert.equal(pickSize(43), 'B-S');
  assert.equal(pickSize(44), 'B-M');
  assert.equal(pickSize(75), 'B-M');
  assert.equal(pickSize(76), 'B-L');
  assert.equal(pickSize(80), 'B-L');
  assert.equal(pickSize(200), 'B-L');
  assert.equal(pickSize(undefined), 'B-L');
  assert.equal(pickSize(Number.NaN), 'B-L');
  assert.deepEqual(markRows({ cols: 20, depth: 'truecolor' }), ['LIT · antigravity']);
  assert.equal(PLAIN_LINE, 'LIT · antigravity');
  assert.equal(markRows({ cols: 80, depth: 'truecolor' }).length, PIXEL_ROWS['B-L'].length / 2 + 1);
  assert.equal(markRows({ cols: 44, depth: '256' }).length, PIXEL_ROWS['B-M'].length / 2 + 1);
  assert.equal(markRows({ cols: 24, depth: 'mono' }).length, MONO_ROWS['B-S'].length + 1);
});

test('no row is wider than the terminal at any width from 20 to 200, in every depth', () => {
  for (let cols = 20; cols <= 200; cols += 1) {
    for (const depth of ['truecolor', '256', 'mono']) {
      for (const row of markRows({ cols, depth })) assert.ok(visibleWidth(row) <= cols, `${cols} ${depth}: ${visibleWidth(row)}`);
    }
  }
});

test('colour draws half blocks with the LitGravity chrome; truecolor uses 38/48;2 and 256 colours the xterm cube', () => {
  const rows = markRows({ cols: 80, depth: 'truecolor' }).join('\n');
  assert.match(rows, /[▀▄]/);
  assert.match(rows, /48;2;255;255;255/, 'the white chrome edge');
  assert.match(rows, /;2;193;220;254m/, 'chrome level 1 sits 1/11 of the way from #e8f0ff to #93c5fd');
  assert.match(rows, /;2;30;58;138m/, 'chrome level 11 is the last stop #1e3a8a');
  assert.doesNotMatch(rows, /;5;\d/);
  const c256 = markRows({ cols: 80, depth: '256' }).join('\n');
  assert.doesNotMatch(c256, /;2;\d/);
  assert.match(c256, /48;5;231m/, 'white is cube 231');
  const tag = markRows({ cols: 80, depth: 'truecolor' }).at(-1);
  assert.equal(tag.replace(/\u001b\[[0-9;]*m/g, '').trim(), 'LIT · antigravity');
  assert.match(tag, /38;2;139;233;253mL/, 'the tagline starts on the first tagline stop');
});

test('colour off prints the glyph rows exactly, then the plain centred tagline, with no escape byte', () => {
  for (const [cols, size] of [[80, 'B-L'], [50, 'B-M'], [30, 'B-S']]) {
    const rows = markRows({ cols, depth: 'mono' });
    assert.deepEqual(rows.slice(0, -1), MONO_ROWS[size]);
    const width = PIXEL_ROWS[size][0].length;
    assert.equal(rows.at(-1), `${' '.repeat(Math.floor((width - PLAIN_LINE.length) / 2))}${PLAIN_LINE}`);
    assert.doesNotMatch(rows.join('\n'), ESC);
  }
  assert.doesNotMatch(markRows({ cols: 10, depth: 'mono' }).join(''), ESC);
  assert.match(MONO_ROWS['B-L'].join('\n'), /░/);
  assert.match(MONO_ROWS['B-L'].join('\n'), /━/);
});

test('the CLI draws colour only on a 256-colour or truecolor terminal', () => {
  assert.equal(markDepth({ COLORTERM: 'truecolor' }, tty(80)), 'truecolor');
  assert.equal(markDepth({ TERM: 'xterm-256color' }, tty(80)), '256');
  assert.equal(markDepth({ TERM: 'xterm' }, tty(80)), 'mono', '16 colours print the glyph rows');
  assert.equal(markDepth({ COLORTERM: 'truecolor', NO_COLOR: '1' }, tty(80)), 'mono');
  assert.equal(markDepth({ COLORTERM: 'truecolor', TERM: 'dumb' }, tty(80)), 'mono');
  assert.equal(markDepth({ COLORTERM: 'truecolor' }, { isTTY: false }), 'mono', 'a pipe');
  const out = collect();
  printMark(out.print, { COLORTERM: 'truecolor' }, tty(44));
  assert.match(out.text(), ESC);
  assert.equal(out.lines.at(-1), '');
  for (const row of out.lines) assert.ok(visibleWidth(row) <= 44);
  const mono = collect();
  printMark(mono.print, { COLORTERM: 'truecolor', NO_COLOR: '1' }, tty(30));
  assert.deepEqual(mono.lines.slice(0, MONO_ROWS['B-S'].length), MONO_ROWS['B-S'], 'a terminal under NO_COLOR keeps the mono scene');
  assert.doesNotMatch(mono.text(), ESC);
});

test('pipe rule: off a terminal the mark is the plain line alone, never art, colour or mono rows', () => {
  for (const env of [{ COLORTERM: 'truecolor', COLUMNS: '120' }, { NO_COLOR: '1', COLUMNS: '80' }, { TERM: 'xterm-256color' }]) {
    for (const stream of [{ isTTY: false, columns: 80 }, {}, undefined]) {
      const piped = collect();
      printMark(piped.print, env, stream ?? { isTTY: false });
      assert.deepEqual(piped.lines, [PLAIN_LINE]);
      assert.doesNotMatch(piped.text(), /[█▀▄░]|\u001b/);
    }
  }
});

test('the status-line pill stops are the chrome stops 1 and 4 (plugin/ cannot import lib/, so this pins the copy)', () => {
  const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  assert.deepEqual(PILL_STOPS, [rgb(CHROME[1]), rgb(CHROME[4])]);
});

test('help, install and doctor carry the mark; --json, --version and library callers do not', async () => {
  const { env } = sandbox();
  const help = spawnSync(process.execPath, [BIN, 'help'], { env: { ...env, COLUMNS: '80', COLORTERM: 'truecolor' }, encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.ok(help.stdout.startsWith('LIT · antigravity\nLitGravity '), help.stdout.slice(0, 200));
  assert.doesNotMatch(help.stdout, /[█▀▄░]|\u001b/, 'a piped help prints no art');
  const doc = spawnSync(process.execPath, [BIN, 'doctor'], { env: { ...env, COLUMNS: '80', COLORTERM: 'truecolor', LITGRAVITY_SKIP_HOST_TOOLS: '1' }, encoding: 'utf8' });
  assert.ok(doc.stdout.startsWith('LIT · antigravity\nLitGravity '), doc.stdout.slice(0, 200));
  assert.doesNotMatch(doc.stdout.split('\n').slice(0, 2).join('\n'), /[█▀▄░]|\u001b/, 'doctor run by an agent prints no art');
  const version = spawnSync(process.execPath, [BIN, '--version'], { env, encoding: 'utf8' });
  assert.match(version.stdout, /^\d+\.\d+\.\d+\n$/);
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-mark-'));
  let calls = 0;
  const banner = () => { calls += 1; };
  const dry = collect();
  await install({ env, flags: { dryRun: true }, cwd, print: dry.print, banner });
  assert.equal(calls, 1);
  assert.match(dry.lines[0], /^LitGravity [\d.]+ installer/, 'without a banner the first line is unchanged');
  const json = collect();
  await doctor({ env: { ...env, LITGRAVITY_SKIP_HOST_TOOLS: '1' }, flags: { json: true }, cwd, print: json.print, banner });
  assert.equal(calls, 1, 'doctor --json prints no mark');
  JSON.parse(json.text());
  await doctor({ env: { ...env, LITGRAVITY_SKIP_HOST_TOOLS: '1' }, flags: {}, cwd, print: collect().print, banner });
  assert.equal(calls, 2);
});

test('the mark never reaches model-visible or status-line surfaces: nothing under plugin/ reads it', () => {
  for (const rel of walk(PLUGIN).filter((f) => f.endsWith('.mjs'))) {
    const text = readFileSync(join(PLUGIN, rel), 'utf8');
    assert.doesNotMatch(text, /synthwave-data|lib\/mark\.mjs/, rel);
  }
});

test('the E badge: a chrome pill on truecolor only, same width as the bracketed mark, inside every width budget', () => {
  const { home } = sandbox();
  const base = { HOME: home, XDG_STATE_HOME: join(home, 'state'), PATH: process.env.PATH };
  const input = { cwd: home, model: { display_name: 'Gemini 3.8 Flash (Medium)' }, context_window: { used_percentage: 42, context_window_size: 1048576 } };
  const pill = /^\u001b\[0m\u001b\[1;38;2;11;14;20m\u001b\[48;2;147;197;253m \u001b\[48;2;\d+;\d+;\d+m🔥/;
  const tc = renderStatus(input, { env: { ...base, COLORTERM: 'truecolor' }, width: 120 });
  assert.match(tc, pill);
  assert.match(tc, /48;2;191;219;254m \u001b\[0m/, 'the pill ends on chrome stop 4');
  for (const mode of [{ COLORTERM: '', TERM: 'xterm-256color' }, { LITGRAVITY_HUD_COLOR: '16' }, { NO_COLOR: '1' }]) {
    const out = renderStatus(input, { env: { ...base, ...mode }, width: 120 });
    assert.doesNotMatch(out, /48;2;147;197;253/);
    assert.match(out.replace(/\u001b\[[0-9;]*m/g, ''), /^\[🔥LIT v[\d.]+\]/);
  }
  const plainWidth = visibleWidth(renderStatus(input, { env: { ...base, NO_COLOR: '1' }, width: 120 }));
  assert.equal(visibleWidth(tc), plainWidth);
  for (let width = 10; width <= 200; width += 1) {
    const out = renderStatus(input, { env: { ...base, COLORTERM: 'truecolor' }, width });
    assert.ok(visibleWidth(out) <= width, `${width}: ${visibleWidth(out)}`);
  }
  const narrow = renderStatus(input, { env: { ...base, COLORTERM: 'truecolor' }, columns: 16 });
  assert.ok(visibleWidth(narrow) <= 16, 'the tty width from statusline.mjs is a budget too');
  assert.match(narrow.replace(/\u001b\[[0-9;]*m/g, ''), /^ 🔥LIT /, 'the pill is kept first');
});
