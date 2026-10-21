import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { copyFileAtomic, writeFileAtomic, lstatOrNull } from './safe-write.mjs';

// agy reads its status line only from the user-level settings file. LitGravity touches that file on request and
// never by default: it adds the `statusLine` key when none exists, and removes the key again only when it is ours.
// Someone else's status line is replaced only with --replace-status-line: its value is kept in a restore record beside
// the timestamped settings backup, and uninstall puts it back.

export const HUD_SCRIPT = ['hud', 'statusline.mjs'];
const RESTORE = 'statusline-replaced.json';

export function hudCommand(pluginDir) {
  return `node "${join(pluginDir, ...HUD_SCRIPT)}"`;
}

// Settings written on Windows carry backslashes (or forward slashes, when edited by hand), so both are compared as one.
const slashed = (text) => text.replaceAll('\\', '/');

export function isOurs(statusLine) {
  return Boolean(statusLine && typeof statusLine.command === 'string' && slashed(statusLine.command).includes(['litgravity', ...HUD_SCRIPT].join('/')));
}

// Notepad and PowerShell's Set-Content save UTF-8 with a byte order mark, which JSON.parse rejects.
export const stripBom = (text) => text.replace(/^\uFEFF/u, '');

function readSettings(file) {
  if (!existsSync(file)) return { settings: {}, absent: true };
  try {
    const settings = JSON.parse(stripBom(readFileSync(file, 'utf8')));
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('not an object');
    return { settings, absent: false };
  } catch (err) {
    return { error: `${file} is not valid JSON (${err.message}); LitGravity leaves it alone` };
  }
}

function readRestore(p) {
  try {
    const rec = JSON.parse(readFileSync(join(p.backups, RESTORE), 'utf8'));
    return rec && typeof rec === 'object' && rec.settings === p.agySettings && rec.statusLine && typeof rec.statusLine === 'object' ? rec : null;
  } catch {
    return null;
  }
}

/** The status line an uninstall would put back, or null. */
export function replacedStatusLine(p) {
  return readRestore(p)?.statusLine ?? null;
}

const describe = (line) => String(line?.command ?? 'custom').slice(0, 60);

// Decides before any write whether the status line can be added: 'add', 'already' (ours), 'replace' or 'refuse'.
export function planStatusLine(p, { replace = false } = {}) {
  // The write replaces the entry instead of following it, so a linked file or folder is refused here, before the plugin copy.
  for (const [where, ok] of [[p.agySettings, (st) => st.isFile()], [dirname(p.agySettings), (st) => st.isDirectory()]]) {
    const st = lstatOrNull(where);
    if (st && (st.isSymbolicLink() || !ok(st))) {
      return { action: 'refuse', detail: `${where} is a link or not a regular ${where === p.agySettings ? 'file' : 'folder'}; LitGravity will not write through it. Add the statusLine key to the real file yourself: "statusLine": {"type": "command", "command": ${JSON.stringify(hudCommand(p.userPlugin))}, "enabled": true} — or install without --status-line.` };
    }
  }
  const read = readSettings(p.agySettings);
  if (read.error) return { action: 'refuse', detail: read.error };
  const current = read.settings.statusLine;
  if (isOurs(current)) return { action: 'already', detail: 'the LitGravity status line is already set' };
  if (current && replace) return { action: 'replace', previous: current, detail: `replace the status line (${describe(current)}) in ${p.agySettings}; its value is saved and uninstall puts it back` };
  if (current) return { action: 'refuse', detail: `${p.agySettings} already has a status line (${describe(current)}); LitGravity will not replace it. Rerun with --replace-status-line to swap it (the old value is saved and uninstall restores it), or leave the status line as it is.` };
  return { action: 'add', detail: `add a statusLine entry to ${p.agySettings}` };
}

export function applyStatusLine(p, pluginDir, stamp) {
  const read = readSettings(p.agySettings);
  if (read.error) throw new Error(read.error);
  const written = [];
  if (!read.absent) written.push(copyFileAtomic(p.agySettings, join(p.backups, `settings.json.${stamp}.bak`)));
  const current = read.settings.statusLine;
  if (current && !isOurs(current)) {
    const record = { settings: p.agySettings, replacedAt: new Date().toISOString(), backup: written[0], statusLine: current };
    written.push(writeFileAtomic(join(p.backups, RESTORE), `${JSON.stringify(record, null, 2)}\n`));
  }
  writeFileAtomic(p.agySettings, `${JSON.stringify({ ...read.settings, statusLine: { type: 'command', command: hudCommand(pluginDir), enabled: true } }, null, 2)}\n`);
  written.push(p.agySettings);
  return written;
}

// Returns 'restored' when a replaced status line went back, 'removed' when ours was simply taken out, or false.
export function removeStatusLine(p) {
  const read = readSettings(p.agySettings);
  if (read.error || read.absent || !isOurs(read.settings.statusLine)) return false;
  const restore = readRestore(p);
  const rest = { ...read.settings };
  if (restore) rest.statusLine = restore.statusLine;
  else delete rest.statusLine;
  writeFileAtomic(p.agySettings, `${JSON.stringify(rest, null, 2)}\n`);
  if (!restore) return 'removed';
  rmSync(join(p.backups, RESTORE), { force: true });
  return 'restored';
}
