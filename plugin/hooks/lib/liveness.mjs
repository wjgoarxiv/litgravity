// Liveness: one small record per conversation beside its route state, `<id>.live.json`, read by the status line's
// other-session chip and the lit-adhd collector. PostToolUse writes `alive` and an unheld Stop writes `idle`, for every
// conversation, lit route or not. agy fires no session-end event, so `ended` is never written: a record left alone past
// its staleness limit reads as ended. The same state is rewritten at most once per throttle window; a change of state is
// written at once.

import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sessionPath } from './common.mjs';

export const LIVE_THROTTLE_MS = 30_000;
// An alive record that goes quiet this long belongs to a session that stopped without a Stop event.
export const ALIVE_STALE_MS = 10 * 60_000;
// An idle session waits on its user; after this long it is taken as closed.
export const IDLE_STALE_MS = 2 * 60 * 60_000;
const MAX_FILE_BYTES = 4096;
const PANE = /^[A-Za-z0-9._:-]{1,64}$/;
const LIVE_FILE = /^([A-Za-z0-9_-]{1,128})\.live\.json$/;

export const livePath = (cwd, conversationId, env = process.env) => {
  const base = sessionPath(cwd, conversationId, env);
  return base ? base.replace(/\.json$/, '.live.json') : null;
};

const readRaw = (path) => {
  let fd;
  try {
    if (!lstatSync(path).isFile()) return null;
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const { size } = fstatSync(fd);
    if (size > MAX_FILE_BYTES) return null;
    const buffer = Buffer.alloc(size);
    readSync(fd, buffer, 0, size, 0);
    const record = JSON.parse(buffer.toString('utf8'));
    return record && ['alive', 'idle'].includes(record.state) && Number.isFinite(Date.parse(record.at)) ? record : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
};

// The record with its effective state: `alive`, `idle`, or `ended` once stale. Null when absent or damaged.
export const readLive = (path, now = Date.now()) => {
  const record = readRaw(path);
  if (!record) return null;
  const age = now - Date.parse(record.at);
  const stale = age > (record.state === 'alive' ? ALIVE_STALE_MS : IDLE_STALE_MS);
  return { ...record, state: stale ? 'ended' : record.state };
};

// Every conversation's record in one route-state folder (one workspace), newest first.
export const listLive = (dir, now = Date.now()) => {
  let names;
  try { names = readdirSync(dir); } catch { return []; }
  return names
    .map((name) => LIVE_FILE.exec(name))
    .filter(Boolean)
    .map((m) => ({ id: m[1], ...readLive(join(dir, m[0]), now) }))
    .filter((r) => r.state)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
};

export const markLive = (cwd, conversationId, state, { env = process.env, now = Date.now() } = {}) => {
  const path = livePath(cwd, conversationId, env);
  if (!path) return false;
  const previous = readRaw(path);
  if (previous?.state === state && now - Date.parse(previous.at) < LIVE_THROTTLE_MS) return false;
  const record = { state, at: new Date(now).toISOString() };
  if (typeof env.HERDR_PANE_ID === 'string' && PANE.test(env.HERDR_PANE_ID)) record.pane = env.HERDR_PANE_ID;
  try {
    if (lstatSync(path).isSymbolicLink()) return false;
  } catch {
    // absent is fine
  }
  mkdirSync(dirname(path), { recursive: true });
  const staging = `${path}.${process.pid}.tmp`;
  writeFileSync(staging, `${JSON.stringify(record)}\n`);
  renameSync(staging, path);
  return true;
};
