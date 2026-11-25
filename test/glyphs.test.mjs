import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasIconFont, roundGlyphs } from '../plugin/hud/glyphs.mjs';

// The one answer every surface reads: the setting, then the terminal, then SSH, then an installed icon font.

const never = () => assert.fail('the fonts were read');
const round = (env, iconFont = never) => roundGlyphs(env, { iconFont });

test('a setting wins over everything', () => {
  for (const value of ['nerd', 'round', 'NERD']) assert.equal(round({ LITGRAVITY_HUD_GLYPHS: value, SSH_CONNECTION: 'x' }), true, value);
  assert.equal(round({ LITGRAVITY_HUD_GLYPHS: 'basic', WT_SESSION: 'x', TERM_PROGRAM: 'ghostty' }), false);
  assert.equal(round({ LITGRAVITY_HUD_GLYPHS: 'auto', WT_SESSION: 'x' }), true, 'auto asks on');
});

test('a terminal that draws the caps itself says yes, over SSH too', () => {
  for (const env of [{ WT_SESSION: 'x' }, { TERM_PROGRAM: 'vscode' }, { TERM_PROGRAM: 'WezTerm' }, { TERM_PROGRAM: 'ghostty' }, { TERM: 'xterm-kitty' }, { KITTY_WINDOW_ID: '1' }]) {
    assert.equal(round(env), true);
    assert.equal(round({ ...env, SSH_CONNECTION: 'x' }), true);
  }
});

test('over SSH the fonts here say nothing; elsewhere an installed icon font decides', () => {
  assert.equal(round({ SSH_CONNECTION: 'x' }), false);
  for (const font of [true, false]) assert.equal(round({ TERM_PROGRAM: 'Apple_Terminal' }, () => font), font);
});

test('the font folders are read by name only, to a depth and a number, with no link followed', () => {
  const at = mkdtempSync(join(tmpdir(), 'litgravity-fonts-'));
  const has = (more) => hasIconFont({}, { folders: [at, join(at, 'missing')], ...more });
  assert.equal(has(), false);
  for (const name of ['Menlo.ttc', 'Nerd Font notes.txt', 'Conflict.ttf']) writeFileSync(join(at, name), '');
  assert.equal(has(), false);
  const other = mkdtempSync(join(tmpdir(), 'litgravity-linked-'));
  writeFileSync(join(other, 'HackNerdFont-Regular.ttf'), '');
  symlinkSync(other, join(at, 'link'));
  assert.equal(has(), false, 'a linked folder is not walked');
  mkdirSync(join(at, 'a', 'b', 'c', 'd'), { recursive: true });
  writeFileSync(join(at, 'a', 'b', 'c', 'd', 'HackNerdFont-Regular.ttf'), '');
  assert.equal(has(), false, 'too deep');
  writeFileSync(join(at, 'a', 'b', 'JetBrainsMonoNerdFontMono-Regular.ttf'), '');
  assert.equal(has(), true);
  assert.equal(has({ limit: 2 }), false, 'a bounded read');
  for (const name of ['CaskaydiaCoveNF-Regular.otf', 'Symbols Nerd Font.ttf', 'MesloLGS NF Regular.ttf']) {
    const one = mkdtempSync(join(tmpdir(), 'litgravity-font-'));
    writeFileSync(join(one, name), '');
    assert.equal(hasIconFont({}, { folders: [one] }), true, name);
  }
});

test('the font answer is kept for a day in the state folder', () => {
  const home = mkdtempSync(join(tmpdir(), 'litgravity-glyphs-'));
  const env = { HOME: home, XDG_STATE_HOME: join(home, 'state'), XDG_DATA_HOME: join(home, 'data') };
  const now = Date.now();
  const first = roundGlyphs(env, { now });
  const file = join(home, 'state', 'litgravity', 'hud', 'glyphs.json');
  assert.ok(existsSync(file));
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { at: now, font: first });
  const kept = (font, at) => { writeFileSync(file, JSON.stringify({ at, font })); return roundGlyphs(env, { now }); };
  assert.equal(kept(!first, now - 60_000), !first, 'a fresh answer is used');
  assert.equal(kept(!first, now - 25 * 3_600_000), first, 'an old one is asked again');
  assert.equal(kept(!first, now + 60_000), first, 'one from the future too');
  writeFileSync(file, 'not json');
  utimesSync(file, 0, 0);
  assert.equal(roundGlyphs(env, { now }), first);
});
