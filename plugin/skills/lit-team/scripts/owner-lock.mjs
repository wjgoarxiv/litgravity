import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import {
  directoryIdentity,
  pathIdentity,
  sameDirectoryIdentity,
  samePathIdentity,
} from "./secure-path.mjs";

const MAX_OWNER_BYTES = 4096;
// No team update holds the lock longer than a moment, so an owner or a takeover claim older than this crashed even
// when its recorded pid now names another live process (pids are reused, often on WSL).
const OWNER_LOCK_MAX_HOLD_MS = 10 * 60 * 1000;
// A folder or claim with no readable record may be one another process created a moment ago and is still writing,
// so it is judged only once it is this old, whatever stale window the caller passed.
const OWNERLESS_GRACE_MS = 5_000;
const sleepSync = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const monotonicNowMs = () => Number(process.hrtime.bigint()) / 1_000_000;

export class OwnerLockError extends Error {
  constructor(message, status = 75) {
    super(message);
    this.name = "OwnerLockError";
    this.status = status;
  }
}

const ownerPathFor = (lockDir) => join(lockDir, "owner.json");
const safeReceiptToken = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/u.test(value);
const sameDirectory = sameDirectoryIdentity;

const assertLockDirectory = (lockDir, expected) => {
  const details = lstatSync(lockDir, { throwIfNoEntry: false });
  if (!details) return undefined;
  if (details.isSymbolicLink() || !details.isDirectory()) {
    throw new OwnerLockError("owner lock path must be a regular directory", 65);
  }
  const identity = directoryIdentity(details);
  if (expected && !sameDirectory(identity, expected)) {
    throw new OwnerLockError("owner lock directory changed", 65);
  }
  return identity;
};

// Destructive cleanup is commit-by-rename: once the checked path is moved to a private
// quarantine, a pathname replacement cannot make us remove the replacement. Re-checking the
// moved entry catches Linux inode reuse (ctime/birthtime differ even when dev+ino are forged).
const removeVerifiedPath = (path, expectedIdentity, expectedDirectory, quarantinePath, verify) => {
  if (expectedDirectory) assertLockDirectory(dirname(path), expectedDirectory);
  const current = lstatSync(path, { throwIfNoEntry: false });
  const matches = (stat) => {
    if (!stat) return false;
    if (expectedIdentity?.ctimeMs === undefined) {
      return stat.isDirectory() && !stat.isSymbolicLink()
        && sameDirectoryIdentity(directoryIdentity(stat), expectedIdentity);
    }
    return stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1
      && samePathIdentity(pathIdentity(stat), expectedIdentity);
  };
  if (!current || !matches(current)) return false;
  const quarantine = quarantinePath ?? `${path}.remove.${randomUUID()}`;
  try {
    renameSync(path, quarantine);
    const moved = lstatSync(quarantine, { throwIfNoEntry: false });
    const movedMatches = expectedIdentity?.ctimeMs === undefined
      ? matches(moved)
      : sameDirectoryIdentity(directoryIdentity(moved), {
        dev: expectedIdentity.dev,
        ino: expectedIdentity.ino,
        birthtimeMs: expectedIdentity.birthtimeMs,
      });
    if (!moved || !movedMatches) throw new Error("identity changed");
    if (verify && !verify(quarantine)) throw new Error("entry content changed");
    rmSync(quarantine, { recursive: true, force: true });
    return true;
  } catch {
    try {
      if (!lstatSync(path, { throwIfNoEntry: false })) renameSync(quarantine, path);
    } catch { /* Leave uncertain quarantine state for the caller to inspect. */ }
    return false;
  }
};

const processIsAlive = (pid) => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
};

export const readOwnerLock = (lockDir) => {
  const ownerPath = ownerPathFor(lockDir);
  let fd;
  try {
    if (!assertLockDirectory(lockDir)) return null;
    const pathStats = lstatSync(ownerPath);
    if (pathStats.isSymbolicLink() || !pathStats.isFile() || pathStats.size > MAX_OWNER_BYTES) return null;
    fd = openSync(ownerPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const openedStats = fstatSync(fd);
    if (
      !openedStats.isFile()
      || !samePathIdentity(pathIdentity(openedStats), pathIdentity(pathStats))
      || openedStats.size !== pathStats.size
    ) return null;
    const owner = JSON.parse(readFileSync(fd, "utf8"));
    if (
      !safeReceiptToken(owner?.nonce)
      || !Number.isSafeInteger(owner.pid)
      || owner.pid <= 0
      || !Number.isFinite(owner.acquired_at_ms)
      || owner.acquired_at_ms < 0
    ) return null;
    return owner;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* An uncertain owner must fail closed. */ }
    }
  }
};

const readTakeoverClaim = (lockDir, name, ownerNonce) => {
  const claimPath = join(lockDir, name);
  let fd;
  try {
    const pathStats = lstatSync(claimPath);
    if (pathStats.isSymbolicLink() || !pathStats.isFile() || pathStats.size > MAX_OWNER_BYTES) return null;
    fd = openSync(claimPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const openedStats = fstatSync(fd);
    if (
      !openedStats.isFile()
      || !samePathIdentity(pathIdentity(openedStats), pathIdentity(pathStats))
      || openedStats.size !== pathStats.size
    ) return null;
    const text = readFileSync(fd, "utf8");
    let claim;
    try {
      claim = JSON.parse(text);
    } catch {
      claim = null;
    }
    if (
      claim?.owner_nonce === ownerNonce
      && safeReceiptToken(claim?.claimant_nonce)
      && Number.isSafeInteger(claim.pid)
      && claim.pid > 0
      && Number.isFinite(claim.acquired_at_ms)
      && claim.acquired_at_ms >= 0
    ) return { claim, identity: pathIdentity(pathStats), text };

    const legacyPidText = text.trim();
    const legacyPid = Number(legacyPidText);
    if (
      name !== `.takeover-${ownerNonce}`
      || !/^[1-9][0-9]*$/u.test(legacyPidText)
      || !Number.isSafeInteger(legacyPid)
      || legacyPid <= 0
      || !Number.isFinite(pathStats.mtimeMs)
      || pathStats.mtimeMs < 0
    ) return null;
    return {
      claim: {
        owner_nonce: ownerNonce,
        claimant_nonce: `legacy-${legacyPid}`,
        pid: legacyPid,
        acquired_at_ms: pathStats.mtimeMs,
      },
      identity: pathIdentity(pathStats),
      text,
    };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* An uncertain takeover claim must fail closed. */ }
    }
  }
};

const takeoverWinner = (lockDir, incumbent, ownClaim, staleAfter, expectedLockDirectory) => {
  assertLockDirectory(lockDir, expectedLockDirectory);
  const legacyName = `.takeover-${incumbent.nonce}`;
  const claimPrefix = `${legacyName}.`;
  let names;
  try {
    names = readdirSync(lockDir).filter((name) => name === legacyName || name.startsWith(claimPrefix));
  } catch {
    return null;
  }

  const active = [];
  for (const name of names) {
    assertLockDirectory(lockDir, expectedLockDirectory);
    const claimRecord = readTakeoverClaim(lockDir, name, incumbent.nonce);
    if (claimRecord === null) {
      // A claim its writer died while writing can never be read; once old it is cleared, or it blocks every takeover.
      const claimPath = join(lockDir, name);
      const claimStats = lstatSync(claimPath, { throwIfNoEntry: false });
      if (!claimStats?.isFile() || claimStats.isSymbolicLink() || Date.now() - claimStats.mtimeMs < Math.max(staleAfter, OWNERLESS_GRACE_MS)) return null;
      rmSync(claimPath, { force: true });
      continue;
    }
    const { claim, identity, text } = claimRecord;
    const alive = processIsAlive(claim.pid);
    const claimAge = Date.now() - claim.acquired_at_ms;
    const oldEnough = claimAge >= staleAfter;
    if ((!alive && oldEnough) || claimAge >= OWNER_LOCK_MAX_HOLD_MS) {
      try {
        assertLockDirectory(lockDir, expectedLockDirectory);
        const claimPath = join(lockDir, name);
        if (!removeVerifiedPath(
          claimPath,
          identity,
          expectedLockDirectory,
          undefined,
          (quarantine) => readFileSync(quarantine, "utf8") === text,
        )) return null;
      } catch (error) {
        if (error?.code !== "ENOENT") return null;
      }
      continue;
    }
    if (!alive) return null;
    if (name === legacyName) return null;
    active.push(claim);
  }

  active.sort((left, right) =>
    left.acquired_at_ms - right.acquired_at_ms || left.claimant_nonce.localeCompare(right.claimant_nonce));
  return active[0]?.claimant_nonce === ownClaim.claimant_nonce ? ownClaim : null;
};

export const acquireOwnerLock = (lockDir, { timeoutMs = 500, staleMs = 30_000 } = {}) => {
  assertLockDirectory(lockDir);
  mkdirSync(dirname(lockDir), { recursive: true, mode: 0o700 });
  const timeout = Number.isFinite(timeoutMs) ? Math.max(0, timeoutMs) : 500;
  const staleAfter = Number.isFinite(staleMs) ? Math.max(0, staleMs) : 30_000;
  const startedAt = monotonicNowMs();
  let takeoverClaim = null;

  while (true) {
    const owner = { nonce: randomUUID(), pid: process.pid, acquired_at_ms: Date.now() };
    let lockDirectory;
    try {
      mkdirSync(lockDir, { mode: 0o700 });
      lockDirectory = assertLockDirectory(lockDir);
      try {
        assertLockDirectory(lockDir, lockDirectory);
        writeFileSync(ownerPathFor(lockDir), `${JSON.stringify(owner)}\n`, { mode: 0o600, flag: "wx" });
        assertLockDirectory(lockDir, lockDirectory);
      } catch {
        try {
          assertLockDirectory(lockDir, lockDirectory);
          if (!removeVerifiedPath(lockDir, lockDirectory)) throw new Error("lock directory changed");
        } catch { /* Leave uncertain state fail-closed. */ }
        throw new OwnerLockError("lock ownership receipt failed", 65);
      }
      return owner;
    } catch (error) {
      if (error instanceof OwnerLockError) throw error;
      if (error?.code !== "EEXIST") throw new OwnerLockError("state lock failed", 65);

      lockDirectory = assertLockDirectory(lockDir);
      const incumbent = readOwnerLock(lockDir);
      if (!incumbent && lockDirectory) {
        // A holder that died between creating the folder and writing its owner record left a lock nobody can judge;
        // once it is older than the stale window (and the grace) it is moved aside and the acquisition retried.
        const folder = lstatSync(lockDir, { throwIfNoEntry: false });
        if (folder && Date.now() - folder.mtimeMs >= Math.max(staleAfter, OWNERLESS_GRACE_MS)) {
          const aside = `${lockDir}.stale.ownerless.${randomUUID()}`;
          try {
            if (removeVerifiedPath(lockDir, lockDirectory, undefined, aside, (quarantine) => !readOwnerLock(quarantine))) continue;
          } catch { /* A lock that changed under us is judged again on the next pass. */ }
        }
      }
      const age = incumbent ? Date.now() - incumbent.acquired_at_ms : 0;
      const stale = incumbent
        && (age >= OWNER_LOCK_MAX_HOLD_MS || (age >= staleAfter && !processIsAlive(incumbent.pid)));
      if (stale) {
        if (takeoverClaim?.owner_nonce !== incumbent.nonce) {
          takeoverClaim = {
            owner_nonce: incumbent.nonce,
            claimant_nonce: randomUUID(),
            pid: process.pid,
            acquired_at_ms: Date.now(),
          };
        }
        const claimPath = join(lockDir, `.takeover-${incumbent.nonce}.${takeoverClaim.claimant_nonce}.json`);
        const displaced = `${lockDir}.stale.${incumbent.nonce}.${randomUUID()}`;
        try {
          assertLockDirectory(lockDir, lockDirectory);
          try {
            writeFileSync(claimPath, `${JSON.stringify(takeoverClaim)}\n`, { mode: 0o600, flag: "wx" });
          } catch (claimError) {
            if (claimError?.code !== "EEXIST") throw claimError;
          }
          assertLockDirectory(lockDir, lockDirectory);
          if (takeoverWinner(lockDir, incumbent, takeoverClaim, staleAfter, lockDirectory) !== null) {
            assertLockDirectory(lockDir, lockDirectory);
            const current = readOwnerLock(lockDir);
            if (current?.nonce === incumbent.nonce && current.pid === incumbent.pid) {
              assertLockDirectory(lockDir, lockDirectory);
              if (!removeVerifiedPath(lockDir, lockDirectory, undefined, displaced,
                (quarantine) => {
                  const replacementOwner = readOwnerLock(quarantine);
                  return replacementOwner?.nonce === incumbent.nonce && replacementOwner.pid === incumbent.pid;
                })) {
                throw new Error("stale lock directory changed");
              }
              continue;
            }
          }
        } catch (takeoverError) {
          if (!["ENOENT", "EEXIST", "ENOTEMPTY"].includes(takeoverError?.code)) {
            throw new OwnerLockError("stale lock takeover failed", 65);
          }
        }
      }

      if (monotonicNowMs() - startedAt >= timeout) {
        const holder = incumbent ? `held by pid ${incumbent.pid} for ${Math.round(age / 1000)} s` : "with no owner record";
        throw new OwnerLockError(`state lock timed out (${holder}; lock ${lockDir})`);
      }
      sleepSync(Math.min(20, Math.max(1, timeout)));
    }
  }
};

export const releaseOwnerLock = (lockDir, owner) => {
  const incumbent = readOwnerLock(lockDir);
  if (!incumbent || incumbent.nonce !== owner?.nonce || incumbent.pid !== owner?.pid) return false;
  const released = `${lockDir}.released.${owner.nonce}.${randomUUID()}`;
  try {
    renameSync(lockDir, released);
    rmSync(released, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
};
