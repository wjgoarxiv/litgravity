import { createHash } from 'node:crypto';
import {
  readFileSync, readdirSync, lstatSync, existsSync, mkdirSync, copyFileSync, writeFileSync, renameSync, rmSync,
} from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeWritePath } from './guard.mjs';

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PLUGIN_DIR = join(PACKAGE_ROOT, 'plugin');
export const OWNER_FILE = '.litgravity-owner.json';

export function readManifest(dir = PLUGIN_DIR) {
  return JSON.parse(readFileSync(join(dir, 'plugin.json'), 'utf8'));
}

export function packageVersion() {
  return JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
}

// Minimal frontmatter reader: `key: value` lines, with JSON-style double-quoted values unquoted.
export function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch { /* keep raw */ }
    }
    out[key] = value;
  }
  return out;
}

export function agentNames(dir = PLUGIN_DIR) {
  const agents = join(dir, 'agents');
  return existsSync(agents) ? readdirSync(agents).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort() : [];
}

// Built from the skill folders, independently of anything agy reads, so a folder without SKILL.md shows up as missing.
export function skillIds(dir = PLUGIN_DIR) {
  const root = join(dir, 'skills');
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((d) => existsSync(join(root, d, 'SKILL.md'))).sort();
}

function listFiles(dir, base = dir, acc = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) acc.push({ rel: relative(base, p), symlink: true });
    else if (st.isDirectory()) listFiles(p, base, acc);
    else acc.push({ rel: relative(base, p), symlink: false });
  }
  return acc;
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

export function bundleHashes(dir = PLUGIN_DIR) {
  const files = {};
  for (const f of listFiles(dir)) {
    if (f.rel === OWNER_FILE || f.symlink) continue;
    files[f.rel] = sha256(join(dir, f.rel));
  }
  return files;
}

function isLink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

// Classifies an install destination: absent, owned (ours and untouched), symlinked, foreign or modified. A link on the
// destination, its parent or its grandparent counts: a write through any of them lands somewhere else.
export function destState(dest) {
  for (const candidate of [dest, dirname(dest), dirname(dirname(dest))]) {
    if (isLink(candidate)) return { state: 'symlinked', detail: `${candidate} is a symbolic link`, link: candidate };
  }
  if (!existsSync(dest)) return { state: 'absent' };
  if (!lstatSync(dest).isDirectory()) return { state: 'foreign', detail: `${dest} is not a directory` };
  const files = listFiles(dest);
  if (files.length === 0) return { state: 'absent' };
  const link = files.find((f) => f.symlink);
  if (link) return { state: 'symlinked', detail: `${join(dest, link.rel)} is a symbolic link`, link: join(dest, link.rel) };
  const ownerPath = join(dest, OWNER_FILE);
  if (!existsSync(ownerPath)) return { state: 'foreign', detail: `${dest} holds files LitGravity did not write` };
  let owner;
  try {
    owner = JSON.parse(readFileSync(ownerPath, 'utf8'));
  } catch {
    return { state: 'foreign', detail: `${ownerPath} is unreadable` };
  }
  if (owner.product !== 'litgravity' || typeof owner.files !== 'object') return { state: 'foreign', detail: `${ownerPath} belongs to another product` };
  const now = bundleHashes(dest);
  const changed = [...new Set([...Object.keys(owner.files), ...Object.keys(now)])].filter((rel) => owner.files[rel] !== now[rel]);
  if (changed.length) return { state: 'modified', detail: `changed since install: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ', ...' : ''}`, version: owner.version };
  return { state: 'owned', version: owner.version };
}

// Copies the packaged plugin to the destination through a temporary sibling and a rename.
export function stageTo(dest, source = PLUGIN_DIR) {
  assertSafeWritePath(dest);
  for (const dir of [dest, dirname(dest)]) {
    if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw new Error(`refused: ${dir} is a symbolic link`);
  }
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp-${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  let files;
  try {
    for (const f of listFiles(source)) {
      if (f.symlink) continue;
      const to = join(tmp, f.rel);
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(join(source, f.rel), to);
    }
    files = bundleHashes(tmp);
    writeFileSync(join(tmp, OWNER_FILE), `${JSON.stringify({ product: 'litgravity', version: readManifest(source).version, files }, null, 2)}\n`);
  } catch (err) {
    // A half-copied folder beside the destination would load in agy as a second plugin with the same name.
    rmSync(tmp, { recursive: true, force: true });
    throw err;
  }
  if (existsSync(dest)) {
    const old = `${dest}.old-${process.pid}`;
    renameSync(dest, old);
    renameSync(tmp, dest);
    rmSync(old, { recursive: true, force: true });
  } else {
    renameSync(tmp, dest);
  }
  return Object.keys(files).length;
}
