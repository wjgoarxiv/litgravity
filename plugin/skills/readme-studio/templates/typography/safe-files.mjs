import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";

export function checkedPath(input) {
  const absolute = resolve(input);
  let current = parse(absolute).root;
  for (const segment of absolute.slice(current.length).split(sep).filter(Boolean)) {
    current = join(current, segment);
    if (lstatSync(current).isSymbolicLink()) throw new Error("SYMLINK_REFUSED");
  }
  return absolute;
}

export function inside(root, input) {
  if (typeof input !== "string" || !input || isAbsolute(input) || /[\\\x00-\x1f]/u.test(input) || input.split("/").some(part => part === ".." || part === "." || !part)) throw new Error("UNSAFE_RELATIVE_PATH");
  const base = checkedPath(root);
  if (!lstatSync(base).isDirectory()) throw new Error("ROOT_NOT_DIRECTORY");
  const target = resolve(base, input);
  const rel = relative(base, target);
  if (!rel || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("PATH_ESCAPE");
  return target;
}

export function boundedRead(input, limit) {
  const file = checkedPath(input);
  const before = lstatSync(file);
  if (!before.isFile() || before.size < 1 || before.size > limit) throw new Error("BOUNDED_REGULAR_FILE_REQUIRED");
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const start = fstatSync(fd);
    if (!start.isFile() || start.ino !== before.ino || start.dev !== before.dev) throw new Error("FILE_IDENTITY_CHANGED");
    const data = readFileSync(fd);
    const after = fstatSync(fd);
    if (data.length > limit || after.size !== start.size || after.mtimeMs !== start.mtimeMs || after.ctimeMs !== start.ctimeMs) throw new Error("FILE_CHANGED");
    return data;
  } finally { closeSync(fd); }
}

export function exclusiveWrite(root, output, data) {
  const target = inside(root, output);
  const parent = checkedPath(dirname(target));
  if (!lstatSync(parent).isDirectory() || realpathSync(parent) !== parent) throw new Error("UNSAFE_PARENT");
  // The caller owns the output tree; exclusive creation also refuses existing symlink leaves.
  const fd = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o644);
  try { writeFileSync(fd, data); } finally { closeSync(fd); }
  return target;
}

export function argumentsMap(argv, allowed) {
  if (argv.length % 2) throw new Error("EXPECTED_FLAG_VALUE_PAIRS");
  const result = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.includes(argv[i]) || result.has(argv[i])) throw new Error("UNKNOWN_OR_DUPLICATE_FLAG");
    result.set(argv[i], argv[i + 1]);
  }
  return result;
}
