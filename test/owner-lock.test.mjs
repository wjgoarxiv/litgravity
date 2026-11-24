import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acquireOwnerLock, OwnerLockError, readOwnerLock, releaseOwnerLock } from '../plugin/skills/lit-team/scripts/owner-lock.mjs';

// A lock left by a holder that died must never block the team packet forever.
const lockAt = () => join(mkdtempSync(join(tmpdir(), 'litgravity-lock-')), '.lock');
const age = (path, ms) => { const t = (Date.now() - ms) / 1000; utimesSync(path, t, t); };
const owner = (lockDir, fields) => writeFileSync(join(lockDir, 'owner.json'), `${JSON.stringify({ nonce: 'old-holder', ...fields })}\n`);

test('an ownerless lock older than the stale window is reclaimed', () => {
  const lockDir = lockAt();
  mkdirSync(lockDir);
  age(lockDir, 60_000);
  const got = acquireOwnerLock(lockDir, { timeoutMs: 300, staleMs: 30_000 });
  assert.equal(readOwnerLock(lockDir)?.nonce, got.nonce);
  assert.ok(releaseOwnerLock(lockDir, got));
});

test('a fresh ownerless lock keeps waiting, and the timeout names the lock and the missing owner', () => {
  const lockDir = lockAt();
  mkdirSync(lockDir);
  assert.throws(() => acquireOwnerLock(lockDir, { timeoutMs: 100, staleMs: 30_000 }), (error) => {
    assert.ok(error instanceof OwnerLockError);
    assert.match(error.message, /state lock timed out/);
    assert.match(error.message, /no owner record/);
    assert.ok(error.message.includes(lockDir), error.message);
    return true;
  });
  assert.ok(existsSync(lockDir), 'the fresh lock stays');
});

test('a takeover claim a dead contender left half-written is cleared and the takeover goes on', () => {
  const lockDir = lockAt();
  mkdirSync(lockDir);
  owner(lockDir, { pid: 2 ** 30, acquired_at_ms: Date.now() - 60_000 });
  const claim = join(lockDir, '.takeover-old-holder.dead-claimant.json');
  writeFileSync(claim, '{"owner_nonce":"old-hol');
  age(claim, 60_000);
  const got = acquireOwnerLock(lockDir, { timeoutMs: 300, staleMs: 30_000 });
  assert.equal(readOwnerLock(lockDir)?.nonce, got.nonce);
});

test('an owner older than the hard ceiling is stale even when its pid now names a live process', () => {
  const lockDir = lockAt();
  mkdirSync(lockDir);
  owner(lockDir, { pid: process.ppid, acquired_at_ms: Date.now() - 11 * 60_000 });
  const got = acquireOwnerLock(lockDir, { timeoutMs: 300, staleMs: 30_000 });
  assert.equal(readOwnerLock(lockDir)?.nonce, got.nonce);
});

test('a live holder inside the ceiling still holds, and the timeout names its pid and age', () => {
  const lockDir = lockAt();
  mkdirSync(lockDir);
  owner(lockDir, { pid: process.ppid, acquired_at_ms: Date.now() - 60_000 });
  assert.throws(() => acquireOwnerLock(lockDir, { timeoutMs: 100, staleMs: 30_000 }),
    new RegExp(`held by pid ${process.ppid} for \\d+ s`));
  assert.equal(readOwnerLock(lockDir)?.nonce, 'old-holder');
});

test('an ownerless lock a second old is left to its creator even with a stale window of 0', () => {
  const lockDir = lockAt();
  mkdirSync(lockDir);
  age(lockDir, 1_000);
  assert.throws(() => acquireOwnerLock(lockDir, { timeoutMs: 100, staleMs: 0 }), /no owner record/);
  assert.ok(existsSync(lockDir), 'the young lock stays');
});

test('an unreadable takeover claim a second old is left to its writer even with a stale window of 0', () => {
  const lockDir = lockAt();
  mkdirSync(lockDir);
  owner(lockDir, { pid: 2 ** 30, acquired_at_ms: Date.now() - 60_000 });
  const claim = join(lockDir, '.takeover-old-holder.live-claimant.json');
  writeFileSync(claim, '');
  age(claim, 1_000);
  assert.throws(() => acquireOwnerLock(lockDir, { timeoutMs: 100, staleMs: 0 }), /state lock timed out/);
  assert.ok(existsSync(claim), 'the claim being written stays');
});

test('a crowd of processes with a stale window of 0 all get the lock in turn', async () => {
  const lockDir = lockAt();
  const script = fileURLToPath(new URL('../plugin/skills/lit-team/scripts/owner-lock.mjs', import.meta.url));
  const body = `const { acquireOwnerLock, releaseOwnerLock } = await import(${JSON.stringify(script)});
for (let i = 0; i < 25; i += 1) { const o = acquireOwnerLock(process.argv[1], { timeoutMs: 10000, staleMs: 0 }); if (!releaseOwnerLock(process.argv[1], o)) process.exit(3); }`;
  const runs = Array.from({ length: 8 }, () => new Promise((resolve) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', body, lockDir], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, err }));
  }));
  for (const { code, err } of await Promise.all(runs)) assert.equal(code, 0, err);
});
