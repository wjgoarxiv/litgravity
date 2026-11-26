import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { ICON_FONT } from '../lib/icon-font.mjs';
import { doctor } from '../lib/doctor.mjs';
import { install } from '../lib/install.mjs';
import { paths } from '../lib/paths.mjs';
import { roundEnds } from '../lib/round-ends.mjs';
import { uninstall } from '../lib/uninstall.mjs';
import { PLUGIN, collect, sandbox, walk } from './helpers.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

// A zip of `files` ({name: text}): stored when `store`, else deflated.
function zip(files, store = false) {
  const locals = [];
  const central = [];
  let at = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text);
    const data = store ? raw : deflateRawSync(raw);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(store ? 0 : 8, 8);
    head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(raw.length, 22);
    head.writeUInt16LE(Buffer.byteLength(name), 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(store ? 0 : 8, 10);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(Buffer.byteLength(name), 28);
    entry.writeUInt32LE(at, 42);
    const local = Buffer.concat([head, Buffer.from(name), data]);
    locals.push(local);
    central.push(entry, Buffer.from(name));
    at += local.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(at, 16);
  return Buffer.concat([...locals, dir, end]);
}

const FONT = 'not really a font';
const LICENCE = 'the licence';
const ARCHIVE = zip({ 'README.md': 'x', LICENSE: LICENCE, 'SymbolsNerdFontMono-Regular.ttf': FONT });
const PINS = {
  ...ICON_FONT,
  archiveSha256: sha(ARCHIVE),
  files: [{ ...ICON_FONT.files[0], sha256: sha(FONT) }, { ...ICON_FONT.files[1], sha256: sha(LICENCE) }],
};

// A Linux home with no icon font, an archive on disk and no setting: no test reads this machine's fonts or the network.
function box() {
  const { env, home } = sandbox();
  delete env.LITGRAVITY_HUD_GLYPHS;
  env.LITGRAVITY_ICON_FONT_SOURCE = join(home, 'archive.zip');
  writeFileSync(env.LITGRAVITY_ICON_FONT_SOURCE, ARCHIVE);
  const dir = join(env.XDG_DATA_HOME, 'fonts');
  const calls = [];
  const font = { platform: 'linux', folders: [dir], pins: PINS, fetchImpl: () => assert.fail('the network'), spawn: (...a) => { calls.push(a); return { status: 0 }; } };
  const cwd = mkdtempSync(join(tmpdir(), 'litgravity-proj-'));
  const go = async (flags, more = {}) => {
    const out = collect();
    const code = await install({ env, flags: { yes: true, noAgentFile: true, ...flags }, cwd, print: out.print, font, ...more });
    return { code, text: out.text(), line: out.lines.filter((l) => l.startsWith('ROUND_ENDS:')), last: out.lines.at(-1) };
  };
  return { env, home, dir, font, calls, cwd, go, p: paths(env), ttf: join(dir, PINS.files[0].name) };
}
const cache = (b) => join(b.env.XDG_STATE_HOME, 'litgravity', 'hud', 'glyphs.json');
const draw = (env) => spawnSync(process.execPath, [join(PLUGIN, 'hud', 'statusline.mjs')], {
  env: { COLORTERM: 'truecolor', TERM: 'xterm-256color', LANG: 'en_US.UTF-8', ...env }, input: JSON.stringify({ cwd: env.HOME, terminal_width: 100, model: { display_name: 'Gemini 3.8 Flash (Medium)' } }), encoding: 'utf8',
}).stdout;

test('the pins are the official v3.5.1 symbols archive', () => {
  assert.equal(ICON_FONT.url, 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.5.1/NerdFontsSymbolsOnly.zip');
  assert.equal(ICON_FONT.archiveSha256, 'fdca3682534f6f65e1ccb2345b0362ccf67d9b8eca7c8025330946e93e2473bc');
  assert.deepEqual(ICON_FONT.files.map((f) => [f.entry, f.name, f.sha256]), [
    ['SymbolsNerdFontMono-Regular.ttf', 'SymbolsNerdFontMono-Regular.ttf', 'fe471e538392f51910faab985fa8e192a39dd3426125edd15b71b3680df0e749'],
    ['LICENSE', 'SymbolsNerdFontMono-LICENSE.txt', '84a7a98c82140fb12c37fe42b93805baa16024cb3e5acc599b7ffe612c55d847'],
  ]);
  assert.equal(ICON_FONT.maxBytes, 8 * 1024 * 1024);
});

test('--round adds the font where none is, records it, drops the cached answer, and a second run changes nothing', async () => {
  const b = box();
  mkdirSync(join(cache(b), '..'), { recursive: true });
  writeFileSync(cache(b), JSON.stringify({ at: Date.now(), font: false }));
  const dry = await b.go({ round: true, dryRun: true, statusLine: true });
  assert.match(dry.text, new RegExp(`icon font +add SymbolsNerdFontMono-Regular\\.ttf.* to ${b.dir}`));
  assert.ok(!existsSync(b.dir) && existsSync(cache(b)), 'a dry run writes nothing');

  const first = await b.go({ round: true, statusLine: true });
  assert.equal(first.code, 0, first.text);
  assert.deepEqual(walk(b.dir).sort(), ['SymbolsNerdFontMono-LICENSE.txt', 'SymbolsNerdFontMono-Regular.ttf']);
  assert.equal(readFileSync(b.ttf, 'utf8'), FONT);
  assert.ok(first.text.includes(`\n  ${b.ttf}\n`), 'listed under Written');
  assert.ok(!existsSync(cache(b)), 'the cached answer is gone');
  assert.deepEqual(b.calls.map((c) => c.slice(0, 2)), [['fc-cache', ['-f', b.dir]]]);
  assert.equal(first.line.length, 1);
  assert.equal(first.last, first.line[0], 'the last line');
  assert.match(first.last, /^ROUND_ENDS: check \(.*; .*--agent.*\)$/, 'an installed font alone is no proof');

  const again = await b.go({ round: true });
  assert.match(again.text, /icon font +already here/);
  assert.equal(b.calls.length, 1);
  assert.match(again.last, /^ROUND_ENDS: check/);
  assert.equal(JSON.parse(readFileSync(b.p.iconFontManifest, 'utf8')).files.length, 2, 'still ours');
  assert.equal((await b.go({})).last, again.last, 'a plain install');
});

test('an icon font that is already here is enough, and it is never ours to remove', async () => {
  const b = box();
  mkdirSync(b.dir, { recursive: true });
  writeFileSync(join(b.dir, 'JetBrainsMonoNerdFont-Regular.ttf'), 'mine');
  const r = await b.go({ round: true, statusLine: true });
  assert.deepEqual(walk(b.dir), ['JetBrainsMonoNerdFont-Regular.ttf']);
  assert.match(r.last, /^ROUND_ENDS: check/);
  assert.ok(!existsSync(b.p.iconFontManifest));
  const out = collect();
  await uninstall({ env: b.env, flags: { yes: true }, cwd: b.cwd, print: out.print });
  assert.deepEqual(walk(b.dir), ['JetBrainsMonoNerdFont-Regular.ttf']);
  assert.doesNotMatch(out.text(), /icon font/);
});

test('nothing is overwritten or followed, an identical file is not ours, and every failure leaves a finished install that says why', async () => {
  const failing = async (prepare, why) => {
    const b = box();
    prepare(b);
    const r = await b.go({ round: true, statusLine: true });
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /Status: Ready/);
    assert.match(r.last, new RegExp(`^ROUND_ENDS: square \\(font not installed \\(.*${why}.*\\); .+\\)$`), r.last);
    return b;
  };
  await failing((b) => writeFileSync(b.env.LITGRAVITY_ICON_FONT_SOURCE, 'bad'), 'SHA-256');
  await failing((b) => { b.env.LITGRAVITY_ICON_FONT_SOURCE = join(b.home, 'none.zip'); }, 'none\\.zip');
  await failing((b) => { b.font.pins = { ...PINS, maxBytes: 10 }; }, 'larger than');
  await failing((b) => { b.font.pins = { ...PINS, files: [{ ...PINS.files[0], sha256: '0' }, PINS.files[1]] }; }, 'SHA-256');
  await failing((b) => { delete b.env.LITGRAVITY_ICON_FONT_SOURCE; b.font.fetchImpl = async () => { throw new Error('offline'); }; }, 'offline');
  await failing((b) => { delete b.env.LITGRAVITY_ICON_FONT_SOURCE; b.font.fetchImpl = async () => ({ ok: false, status: 503 }); }, '503');
  await failing((b) => { delete b.env.LITGRAVITY_ICON_FONT_SOURCE; b.font.pins = { ...PINS, maxBytes: 4 }; b.font.fetchImpl = async () => new Response(ARCHIVE); }, 'larger than');
  await failing((b) => { mkdirSync(b.env.XDG_DATA_HOME, { recursive: true }); writeFileSync(b.dir, 'a file'); }, 'not a folder');
  const linked = await failing((b) => {
    b.real = mkdtempSync(join(tmpdir(), 'litgravity-realfonts-'));
    mkdirSync(b.env.XDG_DATA_HOME, { recursive: true });
    symlinkSync(b.real, b.dir);
  }, 'link');
  assert.deepEqual(walk(linked.real), []);
  const over = await failing((b) => {
    mkdirSync(b.dir, { recursive: true });
    symlinkSync(join(b.home, 'nowhere'), b.ttf);
  }, 'already there');
  assert.ok(!existsSync(join(over.home, 'nowhere')));

  const b = box();
  mkdirSync(b.dir, { recursive: true });
  writeFileSync(join(b.dir, PINS.files[1].name), LICENCE);
  await b.go({ round: true });
  assert.deepEqual(JSON.parse(readFileSync(b.p.iconFontManifest, 'utf8')).files.map((f) => f.path), [b.ttf]);

  const ok = box();
  delete ok.env.LITGRAVITY_ICON_FONT_SOURCE;
  const asked = [];
  ok.font.fetchImpl = async (url, opts) => { asked.push([url, opts.signal instanceof AbortSignal]); return new Response(ARCHIVE); };
  await ok.go({ round: true });
  assert.deepEqual(asked, [[ICON_FONT.url, true]]);
  assert.ok(existsSync(ok.ttf));
});

test('uninstall removes only the unchanged files it added and says who may miss them', async () => {
  const b = box();
  await b.go({ round: true });
  writeFileSync(join(b.dir, PINS.files[1].name), 'edited');
  const project = collect();
  await uninstall({ env: b.env, flags: { yes: true, scope: 'project' }, cwd: b.cwd, print: project.print });
  assert.ok(existsSync(b.ttf), 'project scope leaves the font');
  const dry = collect();
  await uninstall({ env: b.env, flags: { dryRun: true }, cwd: b.cwd, print: dry.print });
  assert.match(dry.text(), /icon font +remove .*SymbolsNerdFontMono-Regular\.ttf.*other .*square/);
  assert.ok(existsSync(b.ttf));
  const out = collect();
  await uninstall({ env: b.env, flags: { yes: true }, cwd: b.cwd, print: out.print });
  assert.deepEqual(walk(b.dir), [PINS.files[1].name]);
  assert.match(out.text(), /icon font: removed .*square/);
  assert.match(out.text(), /kept .*LICENSE\.txt/);
  assert.ok(!existsSync(b.p.iconFontManifest));
});

test('the font is added whole or left out whole: a foreign licence file or an unwritable record takes it back', async () => {
  const foreign = box();
  const licence = join(foreign.dir, PINS.files[1].name);
  mkdirSync(foreign.dir, { recursive: true });
  writeFileSync(licence, 'someone else wrote this');
  const r = await foreign.go({ round: true, statusLine: true });
  assert.equal(r.code, 0, r.text);
  assert.match(r.last, /font not installed \(something else is already there/);
  assert.deepEqual(walk(foreign.dir), [PINS.files[1].name]);
  assert.equal(readFileSync(licence, 'utf8'), 'someone else wrote this');
  assert.ok(!existsSync(foreign.p.iconFontManifest));
  assert.ok(!r.text.includes(`\n  ${foreign.ttf}\n`), 'not listed under Written');

  const norecord = box();
  mkdirSync(norecord.p.iconFontManifest, { recursive: true });
  const s = await norecord.go({ round: true, statusLine: true });
  assert.equal(s.code, 0, s.text);
  assert.match(s.last, /font not installed \(/);
  assert.deepEqual(walk(norecord.dir), []);

  const half = box();
  await half.go({ round: true });
  rmSync(half.ttf);
  writeFileSync(half.env.LITGRAVITY_ICON_FONT_SOURCE, ARCHIVE);
  const before = readFileSync(half.p.iconFontManifest, 'utf8');
  symlinkSync(join(half.home, 'nowhere'), half.ttf);
  await half.go({ round: true });
  assert.equal(readFileSync(half.p.iconFontManifest, 'utf8'), before, 'an earlier record is kept');
  assert.ok(existsSync(join(half.dir, PINS.files[1].name)), 'an earlier file is kept');
});

test("a temp file of someone else's in the font folder stays", async () => {
  const b = box();
  mkdirSync(b.dir, { recursive: true });
  const theirs = join(b.dir, `.litgravity-font-${process.pid}`);
  writeFileSync(theirs, 'theirs');
  const r = await b.go({ round: true, statusLine: true });
  assert.match(r.last, /font not installed \(/);
  assert.equal(readFileSync(theirs, 'utf8'), 'theirs');
});

test('uninstall takes a recorded path only by its own name in the font folder, and no font trouble stops the status line', async () => {
  const b = box();
  await b.go({ round: true, statusLine: true });
  const mine = [join(b.home, 'notes.txt'), join(b.dir, 'Mine.ttf'), join(b.home, PINS.files[0].name)];
  for (const path of mine) writeFileSync(path, 'mine');
  const manifest = JSON.parse(readFileSync(b.p.iconFontManifest, 'utf8'));
  manifest.files.push(...mine.map((path) => ({ path, sha256: sha('mine') })));
  writeFileSync(b.p.iconFontManifest, JSON.stringify(manifest));
  const out = collect();
  assert.equal(await uninstall({ env: b.env, flags: { yes: true }, cwd: b.cwd, print: out.print }), 0);
  for (const path of mine) assert.ok(existsSync(path), path);
  assert.ok(!existsSync(b.ttf));
  for (const path of mine) assert.ok(!out.text().includes(path), path);

  for (const spoil of [(c) => chmodSync(c.dir, 0o555), (c) => { rmSync(c.ttf); symlinkSync(c.home, c.ttf); }]) {
    const c = box();
    await c.go({ round: true, statusLine: true });
    spoil(c);
    const text = collect();
    assert.equal(await uninstall({ env: c.env, flags: { yes: true }, cwd: c.cwd, print: text.print }), 0);
    chmodSync(c.dir, 0o755);
    assert.match(text.text(), /icon font: kept .*SymbolsNerdFontMono-Regular\.ttf/);
    assert.match(text.text(), /Removed the LitGravity status line/);
  }

  const linked = box();
  await linked.go({ round: true });
  const real = join(linked.home, 'real-fonts');
  renameSync(linked.dir, real);
  symlinkSync(real, linked.dir);
  await uninstall({ env: linked.env, flags: { yes: true }, cwd: linked.cwd, print: () => {} });
  assert.equal(walk(real).length, 2, 'nothing is removed through a link');
});

test('a removal that fails keeps its record for the next try', { skip: process.getuid?.() === 0 }, async () => {
  const b = box();
  await b.go({ round: true });
  chmodSync(b.dir, 0o555);
  await uninstall({ env: b.env, flags: { yes: true }, cwd: b.cwd, print: () => {} });
  chmodSync(b.dir, 0o755);
  await uninstall({ env: b.env, flags: { yes: true }, cwd: b.cwd, print: () => {} });
  assert.deepEqual(walk(b.dir), []);
  assert.ok(!existsSync(b.p.iconFontManifest));
});

test('a project uninstall says that the icon font stays', async () => {
  const b = box();
  await b.go({ round: true });
  const out = collect();
  await uninstall({ env: b.env, flags: { yes: true, scope: 'project' }, cwd: b.cwd, print: out.print });
  assert.match(out.text(), /icon font +kept .*SymbolsNerdFontMono-Regular\.ttf.*--scope user/);
  assert.ok(existsSync(b.ttf));
});

test('--glyphs with a linked settings file stops before anything is written', async () => {
  for (const target of ['real.json', 'nowhere.json']) {
    const b = box();
    mkdirSync(join(b.p.litgravityConfig, '..'), { recursive: true });
    writeFileSync(join(b.home, 'real.json'), '{}');
    symlinkSync(join(b.home, target), b.p.litgravityConfig);
    const r = await b.go({ glyphs: 'round', statusLine: true });
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /No files written/);
    assert.ok(!existsSync(b.p.userPlugin));
    assert.equal(readFileSync(join(b.home, 'real.json'), 'utf8'), '{}');
  }
});

test('Windows gets no font', async () => {
  const b = box();
  b.font.platform = 'win32';
  const r = await b.go({ round: true, statusLine: true });
  assert.equal(r.code, 0);
  assert.ok(!existsSync(b.dir));
  assert.match(r.text, /icon font +none on Windows/);
  assert.match(r.last, /^ROUND_ENDS: square \(Windows console; .*Windows Terminal/);
});

test('--glyphs is kept in the settings file, read by the status line, kept by a plain install, and never eats a broken file', async () => {
  const b = box();
  const r = await b.go({ statusLine: true, glyphs: 'round' });
  assert.equal(r.last, 'ROUND_ENDS: shown');
  assert.equal(JSON.parse(readFileSync(b.p.litgravityConfig, 'utf8')).glyphs, 'round');
  assert.match(draw(b.env), //);
  assert.match(draw({ ...b.env, SSH_CONNECTION: 'x' }), //, 'a saved round holds over SSH');
  for (const word of ['square', 'basic', 'auto']) assert.doesNotMatch(draw({ ...b.env, LITGRAVITY_HUD_GLYPHS: word, SSH_CONNECTION: 'x' }), //, word);
  for (const word of ['round', 'nerd', 'nonsense']) assert.match(draw({ ...b.env, LITGRAVITY_HUD_GLYPHS: word }), //, word);
  assert.equal((await b.go({})).last, 'ROUND_ENDS: shown', 'a plain install keeps it');
  assert.equal((await b.go({ round: true })).last, 'ROUND_ENDS: shown');
  const square = await b.go({ glyphs: 'square' });
  assert.match(square.last, /^ROUND_ENDS: square \(choice is square; .*--glyphs auto\)$/);
  assert.doesNotMatch(draw({ ...b.env, TERM_PROGRAM: 'ghostty' }), //);
  assert.match((await b.go({ glyphs: 'auto' })).last, /^ROUND_ENDS: check/, 'the font from --round is here');
  assert.equal((await b.go({ glyphs: 'auto' })).code, 0);

  writeFileSync(b.p.litgravityConfig, '{ broken');
  const refused = await b.go({ glyphs: 'round' });
  assert.equal(refused.code, 1);
  assert.match(refused.text, /No files written/);
  assert.equal(readFileSync(b.p.litgravityConfig, 'utf8'), '{ broken');
  assert.equal((await b.go({})).code, 0, 'a plain install is not stopped by it');
});

test('ROUND_ENDS names the one state and one fix', () => {
  const b = box();
  const say = (extra = {}, more = {}) => roundEnds({ env: { ...b.env, ...extra }, p: b.p, font: b.font, ...more });
  assert.match(say(), /^ROUND_ENDS: square \(no surface enabled; .*--status-line.*\)$/);
  mkdirSync(join(b.home, '.gemini', 'antigravity-cli'), { recursive: true });
  const settings = (statusLine) => writeFileSync(b.p.agySettings, JSON.stringify({ statusLine }));
  settings({ type: 'command', command: 'someone-else' });
  assert.match(say(), /no surface enabled/);
  settings({ type: 'command', command: `node "${join(b.p.userPlugin, 'hud', 'statusline.mjs')}"`, enabled: false });
  assert.match(say(), /no surface enabled/);
  settings({ type: 'command', command: `node "${join(b.p.userPlugin, 'hud', 'statusline.mjs')}"`, enabled: true });
  assert.match(say(), /^ROUND_ENDS: square \(no icon font; .*--round\)$/);
  assert.match(say({ SSH_CONNECTION: 'x' }), /^ROUND_ENDS: square \(SSH; .*--glyphs round.*\)$/);
  for (const own of [{ WT_SESSION: 'x' }, { TERM_PROGRAM: 'vscode' }, { TERM_PROGRAM: 'WezTerm' }, { TERM_PROGRAM: 'ghostty' }, { TERM: 'xterm-kitty' }, { KITTY_WINDOW_ID: '1' }]) {
    assert.equal(say(own), 'ROUND_ENDS: ready in a dark full-colour terminal');
    assert.equal(say({ ...own, COLORTERM: 'truecolor' }, { tty: true }), 'ROUND_ENDS: ready');
    assert.equal(say({ ...own, NO_COLOR: '1', COLORFGBG: '0;15' }), 'ROUND_ENDS: ready in a dark full-colour terminal', "an agent's shell says nothing about the window");
  }
  mkdirSync(b.dir, { recursive: true });
  writeFileSync(join(b.dir, 'HackNerdFont-Regular.ttf'), '');
  assert.match(say(), /^ROUND_ENDS: check \(.+; .+\)$/);
  assert.match(say({ TERM_PROGRAM: 'Apple_Terminal', COLORTERM: 'truecolor' }, { tty: true }), /^ROUND_ENDS: check/);
  assert.doesNotMatch(say(), /finds/);
  assert.match(say({ NO_COLOR: '1' }, { tty: true }), /^ROUND_ENDS: square \(NO_COLOR/);
  assert.match(say({ TERM: 'dumb' }, { tty: true }), /^ROUND_ENDS: square \(TERM=dumb/);
  assert.match(say({ TERM: 'xterm-256color' }, { tty: true }), /^ROUND_ENDS: square \(fewer colours/);
  assert.match(say({ COLORTERM: 'truecolor', COLORFGBG: '0;15' }, { tty: true }), /^ROUND_ENDS: square \(light background/);
  assert.match(say({ LITGRAVITY_HUD_GLYPHS: 'square' }), /^ROUND_ENDS: square \(choice is square; unset LITGRAVITY_HUD_GLYPHS\)$/);
  assert.match(say({ LITGRAVITY_HUD_GLYPHS: 'round' }), /^ROUND_ENDS: check \(LITGRAVITY_HUD_GLYPHS/, 'only a saved round was confirmed');
});

test('doctor ends with the ROUND_ENDS line above its verdict, and carries it in --json', async () => {
  const b = box();
  await b.go({ statusLine: true, glyphs: 'round' });
  const env = { ...b.env, LITGRAVITY_SKIP_HOST_TOOLS: '1' };
  const out = collect();
  await doctor({ env, cwd: b.cwd, print: out.print, font: b.font });
  assert.equal(out.lines.at(-2), 'ROUND_ENDS: shown');
  assert.match(out.lines.at(-1), /^LitGravity: ready/);
  const json = collect();
  await doctor({ env, flags: { json: true }, cwd: b.cwd, print: json.print, font: b.font });
  assert.equal(JSON.parse(json.text()).roundEnds, 'shown');
});
