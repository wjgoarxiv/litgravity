// `--round`: the symbols-only Nerd Font, for a machine with no icon font. One pinned official archive is fetched (or read
// from LITGRAVITY_ICON_FONT_SOURCE), checked, and its two files are put into the person's own font folder. What was put
// there is recorded, so uninstall takes back those files alone. A failure is an answer, never an exception: an install
// goes on without the font.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, linkSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { hasIconFont, userFontFolder } from '../plugin/hud/glyphs.mjs';
import { assertSafeWritePath } from './guard.mjs';
import { lstatOrNull, realExistingAncestor, writeFileAtomic } from './safe-write.mjs';

export const ICON_FONT = Object.freeze({
  release: 'v3.5.1',
  url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.5.1/NerdFontsSymbolsOnly.zip',
  archiveSha256: 'fdca3682534f6f65e1ccb2345b0362ccf67d9b8eca7c8025330946e93e2473bc',
  maxBytes: 8 * 1024 * 1024,
  files: [
    { entry: 'SymbolsNerdFontMono-Regular.ttf', name: 'SymbolsNerdFontMono-Regular.ttf', sha256: 'fe471e538392f51910faab985fa8e192a39dd3426125edd15b71b3680df0e749' },
    { entry: 'LICENSE', name: 'SymbolsNerdFontMono-LICENSE.txt', sha256: '84a7a98c82140fb12c37fe42b93805baa16024cb3e5acc599b7ffe612c55d847' },
  ],
});
export const FONT_LEAVES = 'other programs and LitFamily products on this machine may then draw square ends';
const FETCH_MS = 60_000;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isFile = (path) => lstatOrNull(path)?.isFile() === true;
const holds = (path, hash) => isFile(path) && sha256(readFileSync(path)) === hash;

/** What --round would do, read only: `here` (nothing), `windows`, `nowhere` (no user folder) or `add` into `dir`. */
export function planIconFont({ env, platform = process.platform, folders, pins = ICON_FONT }) {
  if (platform === 'win32') return { action: 'windows', detail: 'none on Windows: Windows Terminal and VS Code draw round ends themselves' };
  if (hasIconFont(env, { platform, ...(folders ? { folders } : {}) })) return { action: 'here', detail: 'already here, so nothing is added' };
  const dir = userFontFolder(env, platform);
  if (!dir) return { action: 'nowhere', detail: 'no home folder is set, so nothing is added' };
  return { action: 'add', dir, detail: `add ${pins.files.map((f) => f.name).join(' and ')} to ${dir} (Nerd Fonts ${pins.release}, symbols only, from its official release, checked by SHA-256)` };
}

async function archiveBytes(env, pins, fetchImpl) {
  const big = `the archive is larger than ${pins.maxBytes} bytes`;
  let bytes;
  if (env.LITGRAVITY_ICON_FONT_SOURCE) {
    const st = lstatOrNull(env.LITGRAVITY_ICON_FONT_SOURCE);
    if (!st?.isFile()) throw new Error(`${env.LITGRAVITY_ICON_FONT_SOURCE} is not a regular file`);
    if (st.size > pins.maxBytes) throw new Error(big);
    bytes = readFileSync(env.LITGRAVITY_ICON_FONT_SOURCE);
  } else {
    const res = await fetchImpl(pins.url, { signal: AbortSignal.timeout(FETCH_MS) });
    if (!res.ok) throw new Error(`the download answered HTTP ${res.status}`);
    const parts = [];
    let size = 0;
    for await (const part of res.body) {
      size += part.length;
      if (size > pins.maxBytes) throw new Error(big);
      parts.push(part);
    }
    bytes = Buffer.concat(parts);
  }
  if (sha256(bytes) !== pins.archiveSha256) throw new Error("the archive's SHA-256 is not the pinned one");
  return bytes;
}

// One entry of a plain zip, found through the central directory. Only called on an archive whose hash is the pinned one.
function unzip(zip, name) {
  const end = zip.lastIndexOf('PK\x05\x06', undefined, 'latin1');
  let at = end < 0 ? zip.length : zip.readUInt32LE(end + 16);
  while (at + 46 <= end && zip.readUInt32LE(at) === 0x02014b50) {
    const [nameBytes, extra, comment] = [28, 30, 32].map((o) => zip.readUInt16LE(at + o));
    if (zip.toString('utf8', at + 46, at + 46 + nameBytes) === name) {
      const local = zip.readUInt32LE(at + 42);
      const from = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(from, from + zip.readUInt32LE(at + 20));
      return zip.readUInt16LE(at + 10) === 0 ? data : inflateRawSync(data);
    }
    at += 46 + nameBytes + extra + comment;
  }
  throw new Error(`the archive holds no ${name}`);
}

// A hard link claims the name: it fails when anything, a dangling link included, has it already.
function claim(path, bytes) {
  const tmp = join(dirname(path), `.litgravity-font-${process.pid}`);
  const fd = openSync(tmp, 'wx', 0o644);
  try {
    try {
      writeFileSync(fd, bytes);
    } finally {
      closeSync(fd);
    }
    linkSync(tmp, path);
  } catch (err) {
    throw err.code === 'EEXIST' ? new Error(`something else is already there: ${path}`) : err;
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** The files LitGravity put there, as `[{path, sha256}]`. The record is only believed about our own file names in the
 *  person's font folder. */
export function ownedIconFont({ env, p }) {
  try {
    const { files } = JSON.parse(readFileSync(p.iconFontManifest, 'utf8'));
    const dirs = ['darwin', 'linux'].map((platform) => userFontFolder(env, platform)).filter(Boolean);
    const ours = dirs.flatMap((dir) => ICON_FONT.files.map((f) => join(dir, f.name)));
    return files.filter((f) => ours.includes(f?.path) && typeof f.sha256 === 'string');
  } catch {
    return [];
  }
}

const record = (p, pins, files) => writeFileAtomic(p.iconFontManifest, `${JSON.stringify({ product: 'litgravity', release: pins.release, files }, null, 2)}\n`);

/** Does what planIconFont said, whole or not at all. `problem` says why no font was added; `written` lists the new files. */
export async function addIconFont({ env, p, platform = process.platform, folders, pins = ICON_FONT, fetchImpl = globalThis.fetch, spawn = spawnSync }) {
  const plan = planIconFont({ env, platform, folders, pins });
  if (plan.action !== 'add') return { ...plan, written: [] };
  const written = [];
  try {
    const zip = await archiveBytes(env, pins, fetchImpl);
    const files = pins.files.map((f) => ({ path: join(plan.dir, f.name), sha256: f.sha256, bytes: unzip(zip, f.entry) }));
    for (const f of files) if (sha256(f.bytes) !== f.sha256) throw new Error(`the SHA-256 of ${f.path.split(/[\\/]/).at(-1)} is not the pinned one`);
    for (const at of [dirname(plan.dir), plan.dir]) {
      const st = lstatOrNull(at);
      if (st?.isSymbolicLink()) throw new Error(`${at} is a link`);
      if (st && !st.isDirectory()) throw new Error(`${at} is not a folder`);
    }
    assertSafeWritePath(realExistingAncestor(plan.dir));
    assertSafeWritePath(plan.dir);
    mkdirSync(plan.dir, { recursive: true });
    const earlier = ownedIconFont({ env, p }).filter((f) => holds(f.path, f.sha256));
    for (const f of files) {
      if (holds(f.path, f.sha256)) continue;
      claim(f.path, f.bytes);
      written.push(f.path);
    }
    record(p, pins, [...earlier, ...files.filter((f) => written.includes(f.path)).map(({ path, sha256: hash }) => ({ path, sha256: hash }))]);
  } catch (err) {
    const stuck = written.filter((path) => {
      try {
        rmSync(path);
        return false;
      } catch {
        return true;
      }
    });
    const problem = stuck.length ? `${err.message}; ${stuck.join(' and ')} could not be taken back` : err.message;
    return { action: 'failed', problem, detail: `not added: ${problem}`, written: stuck };
  }
  if (platform !== 'darwin') spawn('fc-cache', ['-f', plan.dir], { stdio: 'ignore', timeout: FETCH_MS });
  return { action: 'added', dir: plan.dir, detail: `added ${written.join(' and ')}`, written };
}

/** Removes the recorded files that still hold the recorded bytes. Never throws: uninstall has more to do after it. A file
 *  that could not be removed keeps the record, so the next uninstall tries again. */
export function removeIconFont({ env, p }) {
  const removed = [];
  const kept = [];
  let failed = false;
  for (const f of ownedIconFont({ env, p })) {
    try {
      if (!lstatOrNull(f.path)) continue;
      if (lstatOrNull(dirname(f.path)).isSymbolicLink()) throw new Error(`${dirname(f.path)} is a link`);
      if (holds(f.path, f.sha256)) {
        rmSync(assertSafeWritePath(f.path));
        removed.push(f.path);
      } else kept.push(`${f.path} (changed since it was added)`);
    } catch (err) {
      failed = true;
      kept.push(`${f.path} (${err.message})`);
    }
  }
  try {
    if (!failed) rmSync(p.iconFontManifest, { force: true });
  } catch {
    // a record of files that are gone names nothing to remove
  }
  return { removed, kept };
}
