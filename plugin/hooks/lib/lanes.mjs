// Lane state: tracks child agents spawned via invoke_subagent, read by the status line.
// State is a small JSON file next to the stack file. Lanes start on PostToolUse of invoke_subagent
// and end on PostToolUse when the subagent's tool call completes (error field present or a later
// invoke_subagent with the same TypeName). The file is capped and stale lanes (>1h) are dropped.

import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { sessionPath } from './common.mjs';

const MAX_LANES = 10;
const MAX_FILE_BYTES = 16 * 1024;
const STALE_MS = 60 * 60 * 1000;

export const laneFilePath = (cwd, conversationId, env = process.env) => {
  const base = sessionPath(cwd, conversationId, env);
  if (!base) return null;
  return base.replace(/\.json$/, '.lanes.json');
};

export const readLanes = (cwd, conversationId, env = process.env, now = Date.now()) => {
  let fd;
  try {
    const path = laneFilePath(cwd, conversationId, env);
    if (!path || !lstatSync(path).isFile()) return [];
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const { size } = fstatSync(fd);
    if (size > MAX_FILE_BYTES) return [];
    const buffer = Buffer.alloc(size);
    readSync(fd, buffer, 0, size, 0);
    const parsed = JSON.parse(buffer.toString('utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((l) => l && now - Date.parse(l.at) <= STALE_MS).slice(0, MAX_LANES);
  } catch {
    return [];
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
};

export const writeLanes = (cwd, conversationId, lanes, env = process.env) => {
  const path = laneFilePath(cwd, conversationId, env);
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  const staging = `${path}.${process.pid}.tmp`;
  writeFileSync(staging, `${JSON.stringify(lanes.slice(0, MAX_LANES))}\n`, { flag: 'w' });
  renameSync(staging, path);
};

// Called from PostToolUse when invoke_subagent is seen. Records or updates the lane.
export const recordLane = (cwd, conversationId, payload, env = process.env) => {
  const name = payload.toolCall?.args?.TypeName ?? payload.toolCall?.args?.type_name ?? 'agent';
  const now = Date.now();
  const lanes = readLanes(cwd, conversationId, env, now);
  const existing = lanes.findIndex((l) => l.name === name && l.status === 'active');
  if (payload.error) {
    if (existing !== -1) { lanes[existing].status = 'done'; lanes[existing].at = new Date(now).toISOString(); }
  } else if (existing === -1) {
    lanes.push({ name: String(name).slice(0, 60), status: 'active', steps: 0, at: new Date(now).toISOString() });
  } else {
    lanes[existing].steps = (lanes[existing].steps ?? 0) + 1;
    lanes[existing].at = new Date(now).toISOString();
  }
  writeLanes(cwd, conversationId, lanes, env);
  return lanes;
};
