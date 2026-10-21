import { lstatSync, realpathSync, writeFileSync, renameSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { assertSafeWritePath } from './guard.mjs';

export function lstatOrNull(p) {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
}

// The nearest existing ancestor, resolved through links, so the guard judges where bytes really land.
export function realExistingAncestor(p) {
  let cur = p;
  while (!lstatOrNull(cur) && dirname(cur) !== cur) cur = dirname(cur);
  return realpathSync(cur);
}

function assertWritableTarget(target) {
  const parent = dirname(target);
  const pst = lstatOrNull(parent);
  if (pst && (pst.isSymbolicLink() || !pst.isDirectory())) throw new Error(`refused: ${parent} is not a real directory`);
  const st = lstatOrNull(target);
  if (st && !st.isFile()) throw new Error(`refused: ${target} is a link or not a regular file`);
  assertSafeWritePath(target);
  assertSafeWritePath(realExistingAncestor(parent));
}

// Writes through a temp file in the same directory and a rename, which replaces the entry instead of following it.
export function writeFileAtomic(target, content) {
  assertWritableTarget(target);
  mkdirSync(dirname(target), { recursive: true });
  const tmp = join(dirname(target), `.${basename(target)}.tmp-${process.pid}`);
  try {
    writeFileSync(tmp, content, { flag: 'wx' });
    renameSync(tmp, target);
  } finally {
    rmSync(tmp, { force: true });
  }
  return target;
}

export function copyFileAtomic(source, target) {
  assertWritableTarget(target);
  mkdirSync(dirname(target), { recursive: true });
  const tmp = join(dirname(target), `.${basename(target)}.tmp-${process.pid}`);
  try {
    copyFileSync(source, tmp);
    renameSync(tmp, target);
  } finally {
    rmSync(tmp, { force: true });
  }
  return target;
}
