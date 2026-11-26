// One answer for every surface (status line, card, installer): do pills and gauges end in the round caps U+E0B6 and
// U+E0B4? LITGRAVITY_HUD_GLYPHS decides, then the choice `install --glyphs` saved, then `auto`. Both take `round` (yes),
// `square` (no) and `auto`; the setting also takes `nerd` and `basic`. `auto` is yes where the terminal draws the caps
// itself, never over SSH otherwise (the fonts here are not the ones on screen), else when an icon font is installed, told by
// font file names alone. The status line runs on every repaint, so the font answer is kept for a day in the state folder.
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { stateRoot } from '../hooks/lib/common.mjs';
import { litgravityData } from '../hooks/lib/extensions.mjs';

export const CAPS = ['', ''];
const DAY_MS = 24 * 60 * 60_000;
const MAX_NAMES = 4000;
const MAX_DEPTH = 3;
const FONT_FILE = /\.(?:ttf|otf|ttc)$/i;
const WORDS = { round: 'round', nerd: 'round', square: 'square', basic: 'square', auto: 'auto' };
const ICON_FONT = /nerd[ _-]?font|[a-z0-9 _-]NF[MP]?[ _.-]/i;

/** XDG_DATA_HOME where it is absolute; by the XDG rule a relative one counts as not set. */
const xdgData = (env) => (isAbsolute(env.XDG_DATA_HOME ?? '') ? env.XDG_DATA_HOME : undefined);

function fontFolders(env, platform) {
  const under = (base, ...parts) => (base ? [join(base, ...parts)] : []);
  if (platform === 'darwin') return [...under(env.HOME, 'Library', 'Fonts'), '/Library/Fonts'];
  if (platform === 'win32') return [...under(env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'), ...under(env.WINDIR, 'Fonts')];
  return [...under(xdgData(env) || under(env.HOME, '.local', 'share')[0], 'fonts'), ...under(env.HOME, '.fonts'), '/usr/local/share/fonts', '/usr/share/fonts'];
}

/** The person's own font folder, or undefined where fonts are not simply files in one (Windows) or no home is set. */
export const userFontFolder = (env, platform = process.platform) => (platform !== 'win32' && (env.HOME || (platform !== 'darwin' && xdgData(env))) ? fontFolders(env, platform)[0] : undefined);

/** Whether a font file named like an icon font is installed: a bounded walk that follows no link; false on any doubt. */
export function hasIconFont(env, { platform = process.platform, folders = fontFolders(env, platform), limit = MAX_NAMES } = {}) {
  let left = limit;
  let level = folders;
  for (let depth = 0; depth <= MAX_DEPTH && level.length; depth += 1) {
    const next = [];
    for (const folder of level) {
      let entries = [];
      try { entries = readdirSync(folder, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        if (left-- <= 0) return false;
        if (e.isDirectory()) next.push(join(folder, e.name));
        else if (e.isFile() && FONT_FILE.test(e.name) && ICON_FONT.test(e.name)) return true;
      }
    }
    level = next;
  }
  return false;
}

const answerFile = (env) => join(stateRoot(env), 'hud', 'glyphs.json');

/** The font answer the status line keeps, or null when there is none from the last day. */
export function keptIconFont(env, now = Date.now()) {
  try {
    const hit = JSON.parse(readFileSync(answerFile(env), 'utf8'));
    return typeof hit.font === 'boolean' && now >= hit.at && now - hit.at < DAY_MS ? hit.font : null;
  } catch {
    return null;
  }
}

/** Makes the next repaint look at the fonts again. */
export function forgetIconFont(env) {
  try {
    rmSync(answerFile(env), { force: true });
  } catch {
    // it runs out within a day
  }
}

function cachedIconFont(env, now) {
  const kept = keptIconFont(env, now);
  if (kept !== null) return kept;
  const file = answerFile(env);
  const font = hasIconFont(env);
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.${process.pid}`, JSON.stringify({ at: now, font }));
    renameSync(`${file}.${process.pid}`, file);
  } catch {
    // a read-only state folder only costs the cache
  }
  return font;
}

/** LITGRAVITY_HUD_GLYPHS as round, square or auto; null when it is unset or no word this knows. */
export const askedGlyphs = (env) => WORDS[String(env.LITGRAVITY_HUD_GLYPHS ?? '').toLowerCase()] ?? null;

/** The saved choice: round, square or auto. */
export function savedGlyphs(env) {
  try {
    const { glyphs } = JSON.parse(readFileSync(join(litgravityData(env), 'config.json'), 'utf8'));
    return ['round', 'square'].includes(glyphs) ? glyphs : 'auto';
  } catch {
    return 'auto';
  }
}

/** Terminals that draw the caps themselves, whatever the font. */
export const drawsCaps = (env) => Boolean(env.WT_SESSION || /^(vscode|wezterm|ghostty)$/i.test(env.TERM_PROGRAM ?? '') || env.TERM === 'xterm-kitty' || env.KITTY_WINDOW_ID);

export function roundGlyphs(env = process.env, { now = Date.now(), iconFont = () => cachedIconFont(env, now) } = {}) {
  const chosen = askedGlyphs(env) ?? savedGlyphs(env);
  if (chosen !== 'auto') return chosen === 'round';
  if (drawsCaps(env)) return true;
  if (env.SSH_CONNECTION) return false;
  return iconFont();
}
