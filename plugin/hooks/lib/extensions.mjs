import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { MOVED_SKILLS, EXTENSION_BACKUPS, EXTENSIONS_CLI, extensionLines } from './routes.mjs';

// The file-making skills are LitFamily extensions on the wjgoarxiv-skills shelf. The installer prints this notice
// after a successful install or update and leaves a flag; the next real SessionStart hands it to the model once and
// clears the flag. Both read the same lines, so the two places never drift apart.
export const EXTENSION_SHELF = 'https://github.com/wjgoarxiv/wjgoarxiv-skills';

export function litgravityData(env = process.env) {
  return join(env.XDG_DATA_HOME || join(env.HOME || homedir(), '.local', 'share'), 'litgravity');
}

// Releases up to 0.1.8 cached their engines here. Nothing reads it now; the extensions keep their own cache.
export const oldRuntimeDir = (data) => join(data, 'runtime');
const flagFile = (data) => join(data, 'extensions-notice.json');

/** `findings`: how many things `extensions check` asked to act on when the notice was queued (0 or absent: none). */
export function extensionNotice(data, { findings = 0 } = {}) {
  const lines = [
    'LitGravity is the LitFamily core for agy. It is complete and works on its own.',
    `The ${Object.keys(MOVED_SKILLS).length} skills that make files (decks, documents, figures, design, video covers) are LitFamily extensions now, kept on the extension shelf at ${EXTENSION_SHELF}.`,
    `Install the ones you use alongside LitGravity to get the full LitFamily experience. The short route is one command in a terminal: \`${EXTENSIONS_CLI} install <id>\` shows what it would do and adds the skill with --yes (--project for one workspace); \`${EXTENSIONS_CLI} list\`, \`update\`, \`remove\` and \`check\` manage them after that.`,
    'By hand it is the same steps: clone the shelf once, then paste these four lines per skill, with its id. They list any same-name skill agy could load, move an existing copy into a dated folder under ' + EXTENSION_BACKUPS + ', copy the skill in and write a receipt. Run them again to update.',
    `  git clone ${EXTENSION_SHELF}`,
    ...extensionLines('<id>').map((line) => `  ${line}`),
    '`npx @litfamily/litgravity list` names the ids. A new conversation, or /skills reload, picks a copy up.',
  ];
  if (findings > 0) {
    lines.push(`\`${EXTENSIONS_CLI} check\` found ${findings} thing${findings === 1 ? '' : 's'} to look at among the extension copies already on this machine (a duplicate, or a copy without a receipt). Nothing was changed; run it to see each one with its fix.`);
  }
  const runtime = oldRuntimeDir(data);
  if (existsSync(runtime)) {
    lines.push(`Earlier releases left their engines in ${runtime}. Nothing reads that folder now and the extensions keep their own, so you can delete it: rm -rf "${runtime}"`);
  }
  return lines;
}

export function queueExtensionNotice(data, version, { findings = 0 } = {}) {
  mkdirSync(data, { recursive: true });
  const tmp = `${flagFile(data)}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify({ version, queuedAt: new Date().toISOString(), shown: false, findings })}\n`);
  renameSync(tmp, flagFile(data));
  return flagFile(data);
}

/** The queued notice's options once per queued notice (the first caller marks it shown), otherwise false. */
export function takeExtensionNotice(data) {
  try {
    const flag = JSON.parse(readFileSync(flagFile(data), 'utf8'));
    if (!flag || flag.shown !== false) return false;
    writeFileSync(flagFile(data), `${JSON.stringify({ ...flag, shown: true, shownAt: new Date().toISOString() })}\n`);
    return { findings: Number(flag.findings) || 0 };
  } catch {
    return false;
  }
}
