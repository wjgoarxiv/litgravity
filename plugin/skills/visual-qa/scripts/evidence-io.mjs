import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";

import {
  decodeStrictUtf8,
  parseStrictJson,
  StrictJsonError,
} from "./strict-json.mjs";
import { VisualQaError } from "./errors.mjs";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameSnapshot(left, right) {
  return sameFile(left, right) && left.size === right.size
    && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs
    && left.birthtimeMs === right.birthtimeMs;
}

export function safeEvidenceName(path) {
  return typeof path === "string" && path.length > 0 && path !== "." && path !== ".."
    && path === basename(path) && !path.includes("\\");
}

export function assertEvidenceRoot(manifestPath) {
  const root = dirname(resolve(manifestPath));
  try {
    const stat = lstatSync(root);
    if (!stat.isSymbolicLink() && stat.isDirectory()) return root;
  } catch {
    // Missing and unsafe evidence roots share the same fail-closed result.
  }
  throw new VisualQaError("EVIDENCE_ROOT_INVALID", "evidence root must be a regular non-symlink directory");
}

function readBoundRegularFileRecord(absolutePath, maxBytes) {
  if (typeof constants.O_NOFOLLOW !== "number") throw new Error("no-follow file reads are unavailable");
  const fd = openSync(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    const pathStat = lstatSync(absolutePath);
    if (!stat.isFile() || pathStat.isSymbolicLink() || !pathStat.isFile()
      || !sameSnapshot(pathStat, stat)) throw new Error("pathname identity, size, or time changed before read");
    if (stat.size > maxBytes) throw new Error("input exceeds bounds");
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const extra = Buffer.alloc(1);
    const grew = readSync(fd, extra, 0, 1, offset) !== 0;
    const finalDescriptorStat = fstatSync(fd);
    const finalPathStat = lstatSync(absolutePath);
    if (offset !== bytes.length || grew || !sameSnapshot(stat, finalDescriptorStat)
      || finalPathStat.isSymbolicLink() || !sameSnapshot(stat, finalPathStat)) {
      throw new Error("pathname identity, size, or time changed during read");
    }
    return {
      bytes,
      metadata: {
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        ctimeMs: stat.ctimeMs,
        birthtimeMs: stat.birthtimeMs,
      },
    };
  } finally {
    closeSync(fd);
  }
}

export function readBoundRegularFile(absolutePath, maxBytes) {
  return readBoundRegularFileRecord(absolutePath, maxBytes).bytes;
}

export function readStrictJson(path, maxBytes, invalidCode) {
  const absolutePath = resolve(path);
  let bytes;
  let metadata;
  try {
    ({ bytes, metadata } = readBoundRegularFileRecord(absolutePath, maxBytes));
  } catch (error) {
    throw new VisualQaError(invalidCode, `untrusted JSON file ${absolutePath}: ${error.message}`);
  }
  try {
    const value = parseStrictJson(decodeStrictUtf8(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new VisualQaError(invalidCode, "top-level JSON must be an object");
    }
    return { absolutePath, bytes, metadata, value };
  } catch (error) {
    if (error instanceof VisualQaError) throw error;
    if (error instanceof StrictJsonError) throw new VisualQaError(error.code, error.message);
    throw new VisualQaError(invalidCode, `invalid JSON: ${error.message}`);
  }
}

function pathInside(root, candidate) {
  const path = relative(root, candidate);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`)
    && !isAbsolute(path);
}

function regularAncestors(root, absolutePath) {
  const parentPath = relative(root, dirname(absolutePath));
  if (parentPath === "") return true;
  let current = root;
  for (const segment of parentPath.split(sep)) {
    current = join(current, segment);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function hasRegularAncestors(path) {
  const absolutePath = resolve(path);
  const filesystemRoot = parse(absolutePath).root;
  const segments = relative(filesystemRoot, dirname(absolutePath)).split(sep).filter(Boolean);
  if (segments.length < 2) return true;
  // The operating system may expose one compatibility alias directly beneath `/` (macOS
  // `/var` is the common case). Treat that host-owned prefix as the root, then reject every
  // caller-controlled ancestor below it.
  return regularAncestors(join(filesystemRoot, segments[0]), absolutePath);
}

export function readBoundArtifact(manifestPath, artifact, maxBytes = 25 * 1024 * 1024) {
  const root = assertEvidenceRoot(manifestPath);
  if (!safeEvidenceName(artifact.path)) {
    throw new VisualQaError(
      "EVIDENCE_ARTIFACT_PATH_INVALID",
      "artifact paths must be direct-child filenames because Node cannot open nested components relative to a stable directory descriptor",
    );
  }
  const absolutePath = resolve(root, artifact.path);
  if (!pathInside(root, absolutePath)) {
    throw new VisualQaError("EVIDENCE_ARTIFACT_PATH_INVALID", "artifact must stay inside evidence root");
  }
  if (!regularAncestors(root, absolutePath)) {
    return { valid: false, hash: null, bytes: 0, content: null };
  }
  let record;
  try {
    record = readBoundRegularFileRecord(absolutePath, maxBytes);
  } catch (error) {
    return {
      valid: false,
      hash: null,
      bytes: 0,
      content: null,
      failureCode: error?.code === "ENOENT"
        ? "EVIDENCE_ARTIFACT_MISSING"
        : "EVIDENCE_ARTIFACT_UNTRUSTED",
    };
  }
  const { bytes, metadata } = record;
  return {
    valid: sha256(bytes) === artifact.sha256,
    hash: sha256(bytes),
    bytes: bytes.length,
    content: bytes,
    metadata,
    failureCode: null,
  };
}
