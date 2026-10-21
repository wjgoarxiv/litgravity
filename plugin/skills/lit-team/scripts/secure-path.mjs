// secure-path.mjs: file and directory identity helpers shared by owner-lock.mjs and team.mjs.
// An identity is the (device, inode, change/birth time) tuple of a stat result. Comparing two identities detects
// a path that was swapped for another file between a check and its use. Node builtins only.

export const pathIdentity = (stat) => ({
  dev: stat?.dev,
  ino: stat?.ino,
  ctimeMs: stat?.ctimeMs,
  birthtimeMs: stat?.birthtimeMs,
});

export const samePathIdentity = (left, right) => Boolean(left && right)
  && ["dev", "ino", "ctimeMs", "birthtimeMs"].every((field) => Number.isFinite(left[field])
    && Number.isFinite(right[field]) && left[field] === right[field]);

export const directoryIdentity = (stat) => ({
  dev: stat?.dev,
  ino: stat?.ino,
  birthtimeMs: stat?.birthtimeMs,
});

export const sameDirectoryIdentity = (left, right) => Boolean(left && right)
  && ["dev", "ino", "birthtimeMs"].every((field) => Number.isFinite(left[field])
    && Number.isFinite(right[field]) && left[field] === right[field]);
