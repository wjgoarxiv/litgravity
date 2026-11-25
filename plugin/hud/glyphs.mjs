// One answer for every surface (status line, card, installer): do pills and gauges end in the round caps U+E0B6 and
// U+E0B4? LITGRAVITY_HUD_GLYPHS is `nerd` or `round` (yes), `basic` (no) or `auto`: yes where the terminal draws the caps
// itself, never over SSH otherwise (the fonts here are not the ones on screen), else when an icon font is installed, told by
// font file names alone. The status line runs on every repaint, so the font answer is kept for a day in the state folder.
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { stateRoot } from '../hooks/lib/common.mjs';

export const CAPS = ['', ''];
const DAY_MS = 24 * 60 * 60_000;
const MAX_NAMES = 4000;
const MAX_DEPTH = 3;
const FONT_FILE = /\.(?:ttf|otf|ttc)$/i;
const ICON_FONT = /nerd[ _-]?font|[a-z0-9 _-]NF[MP]?[ _.-]/i;

function fontFolders(env, platform) {
  const under = (base, ...parts) => (base ? [join(base, ...parts)] : []);
  if (platform === 'darwin') return [...under(env.HOME, 'Library', 'Fonts'), '/Library/Fonts'];
  if (platform === 'win32') return [...under(env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'), ...under(env.WINDIR, 'Fonts')];
  return [...under(env.XDG_DATA_HOME ?? under(env.HOME, '.local', 'share')[0], 'fonts'), ...under(env.HOME, '.fonts'), '/usr/local/share/fonts', '/usr/share/fonts'];
}

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

function cachedIconFont(env, now) {
  const file = join(stateRoot(env), 'hud', 'glyphs.json');
  try {
    const hit = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof hit.font === 'boolean' && now >= hit.at && now - hit.at < DAY_MS) return hit.font;
  } catch {
    // no answer kept yet
  }
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

export function roundGlyphs(env = process.env, { now = Date.now(), iconFont = () => cachedIconFont(env, now) } = {}) {
  const chosen = String(env.LITGRAVITY_HUD_GLYPHS ?? '').toLowerCase();
  if (chosen === 'nerd' || chosen === 'round') return true;
  if (chosen === 'basic') return false;
  if (env.WT_SESSION || /^(vscode|wezterm|ghostty)$/i.test(env.TERM_PROGRAM ?? '')) return true;
  if (env.TERM === 'xterm-kitty' || env.KITTY_WINDOW_ID) return true;
  if (env.SSH_CONNECTION) return false;
  return iconFont();
}
