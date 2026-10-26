// agy conversation transcripts for the lit-adhd collector. agy stores one JSONL file per conversation
// under `~/.gemini/antigravity-cli/brain/<id>/`. Each step has `step_index`, `source`, `type`,
// `status`, `content` and `created_at`. Files are read as head + tail only, under a shared budget,
// through descriptors opened without following links.

import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export const HEAD_BYTES = 64 * 1024;
export const TAIL_BYTES = 256 * 1024;
export const TOTAL_BUDGET_BYTES = 8 * 1024 * 1024;
const ACTIVE_MS = 15 * 60 * 1000;

export const makeBudget = (limit = TOTAL_BUDGET_BYTES) => ({ limit, used: 0, exhausted: false });

const readSlice = (fd, position, length, budget) => {
  const allowed = Math.min(length, budget.limit - budget.used);
  if (allowed <= 0) { budget.exhausted = true; return ''; }
  const buffer = Buffer.alloc(allowed);
  const read = readSync(fd, buffer, 0, allowed, position);
  budget.used += read;
  if (allowed < length) budget.exhausted = true;
  return buffer.subarray(0, read).toString('utf8');
};

export const readTranscriptLines = (path, budget, { head = HEAD_BYTES, tail = TAIL_BYTES } = {}) => {
  let fd;
  try {
    if (!lstatSync(path).isFile()) return null;
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const { size } = fstatSync(fd);
    const chunks = size <= head + tail
      ? [readSlice(fd, 0, size, budget)]
      : [readSlice(fd, 0, head, budget), readSlice(fd, size - tail, tail, budget)];
    const lines = [];
    for (const chunk of chunks) {
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed && typeof parsed === 'object') lines.push(parsed);
        } catch {
          // Partial or malformed line at a slice edge is skipped.
        }
      }
    }
    return lines;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
};

// agy 1.4.4 writes each conversation's steps to
// `~/.gemini/antigravity-cli/brain/<conversationId>/.system_generated/logs/transcript.jsonl` (the file the hook
// payload names as `transcriptPath`); `conversations/<id>.db` holds the host's own database and is never read.
// The transcript carries no workspace, so the collector passes the conversation ids it knows belong to the
// workspace (the route-state files under `$XDG_STATE_HOME/litgravity/sessions/<workspace hash>/`) and only those
// transcripts are opened. Without ids every conversation folder is listed.
export const transcriptPathOf = (geminiDir, id) => join(geminiDir, 'brain', id, '.system_generated', 'logs', 'transcript.jsonl');

export const findTranscripts = (geminiDir, ids = null) => {
  let names = ids;
  if (!names) {
    try {
      names = readdirSync(join(geminiDir, 'brain'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return { status: 'unknown', files: [] };
    }
  }
  const files = [];
  for (const id of names) {
    const path = transcriptPathOf(geminiDir, id);
    try {
      const st = lstatSync(path);
      if (st.isFile()) files.push({ id, path, mtimeMs: st.mtimeMs });
    } catch {
      // This conversation has no transcript yet.
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { status: files.length ? 'ok' : 'unknown', files };
};

// Tool arguments in the transcript are JSON-encoded strings (`"Path":"\"/a/b\""`); decode them once.
const argValue = (value) => {
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
};

const clip = (text, max) => {
  const flat = String(text).replace(/\s+/gu, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

function extractRequest(content) {
  if (typeof content !== 'string') return null;
  const m = /<USER_REQUEST>\r?\n?([\s\S]*?)\r?\n?<\/USER_REQUEST>/.exec(content);
  return (m ? m[1] : content).trim();
}

const WRITE_TOOLS = new Set(['write_file', 'write_to_file', 'replace_file_content', 'multi_replace_file_content']);
// What a tool call was about, in a few words: a file's base name or a subagent's type. Never a command
// line, a search query or file contents.
const actionTarget = (args) => {
  const path = argValue(args?.Path ?? args?.TargetFile ?? args?.AbsolutePath);
  if (typeof path === 'string' && path) return path.split(/[\\/]/u).at(-1);
  const type = argValue(args?.TypeName);
  return typeof type === 'string' && type ? type : null;
};
const WAITING_TEXT = /[?？]\s*$|`?lit approve`?|`?lit deny`?|승인해\s*주|확인해\s*주|괜찮을까요|할까요/iu;
const APPROVAL_TEXT = /`?lit approve`?|`?lit deny`?|승인해\s*주/iu;
const BLOCKED_TEXT = /^\s*BLOCKED\b/mu;

// Why the newest turn ends waiting on the user, read from the steps after the last prompt: `question` when it called
// ask_question, `BLOCKED` for a blocked report, `approve` when it asks for a typed approval, `asked` for any other
// closing question, else null. The status line shows it; the brief marks the same turns waiting-on-user.
export const waitingReason = (lines) => {
  if (!Array.isArray(lines)) return null;
  const from = lines.findLastIndex((l) => l?.type === 'USER_INPUT');
  let text = null;
  let asked = false;
  for (const line of lines.slice(from + 1)) {
    if (line?.type !== 'PLANNER_RESPONSE') continue;
    if (Array.isArray(line.tool_calls) && line.tool_calls.length) asked = line.tool_calls.some((c) => /ask_question/i.test(String(c?.name ?? '')));
    if (typeof line.content === 'string' && line.content.trim()) text = line.content;
  }
  if (asked) return 'question';
  if (!text) return null;
  const tail = text.slice(-400);
  if (BLOCKED_TEXT.test(text)) return 'BLOCKED';
  if (APPROVAL_TEXT.test(tail)) return 'approve';
  return WAITING_TEXT.test(tail) ? 'asked' : null;
};

// One session's record from its agy transcript lines.
export const sessionRecord = (lines, { redact = (t) => t, now = Date.now(), cwd: workspace = null } = {}) => {
  if (!lines || !lines.length) return null;
  let cwd = workspace;
  let started = null;
  let last = null;
  let lastEntry = null;
  const prompts = [];
  const tools = {};
  const files = [];
  let result = null;
  let lastAction = null;
  for (const line of lines) {
    if (typeof line.cwd === 'string') cwd ??= line.cwd;
    const at = Date.parse(line.created_at);
    if (Number.isFinite(at)) {
      started = started === null ? at : Math.min(started, at);
      last = last === null ? at : Math.max(last, at);
    }
    if (line.type === 'USER_INPUT' && typeof line.content === 'string') {
      const text = extractRequest(line.content);
      if (text) {
        prompts.push(text);
        lastEntry = { role: 'user', text };
      }
    }
    if (line.type === 'PLANNER_RESPONSE' && typeof line.content === 'string' && line.content.trim()) {
      result = line.content;
      lastEntry = { role: 'assistant', text: line.content };
    }
    if (line.type === 'PLANNER_RESPONSE' && Array.isArray(line.tool_calls)) {
      for (const call of line.tool_calls) {
        if (typeof call?.name !== 'string') continue;
        tools[call.name] = (tools[call.name] ?? 0) + 1;
        const path = argValue(call.args?.Path ?? call.args?.TargetFile);
        if (WRITE_TOOLS.has(call.name) && typeof path === 'string') files.push(path);
        const target = actionTarget(call.args);
        lastAction = { tool: call.name, ...(target ? { target } : {}) };
        lastEntry = { role: 'tool' };
      }
    }
  }
  const relativeFile = (path) => {
    if (!cwd) return path;
    const inside = relative(cwd, path);
    return inside && !inside.startsWith('..') ? inside : path;
  };
  const changed = [...new Set(files.reverse())].slice(0, 5).map((p) => redact(relativeFile(p)));
  const asked = [...new Set([prompts[0], prompts.at(-1)].filter(Boolean))].slice(0, 2).map((t) => clip(redact(t), 160));
  const waiting = lastEntry?.role === 'assistant' && WAITING_TEXT.test(lastEntry.text.slice(-400));
  const status = last === null ? 'unknown' : waiting ? 'waiting-on-user' : now - last < ACTIVE_MS ? 'active' : 'ended';
  // agy does not carry a sessionId in the transcript; use the conversation folder name if available.
  const sessionId = lines.find((l) => typeof l.conversation_id === 'string')?.conversation_id ?? null;
  return {
    sessionId,
    id8: sessionId ? sessionId.slice(0, 8) : 'unknown',
    worktree: cwd ? redact(cwd) : 'unknown',
    cwd,
    started: started === null ? 'unknown' : new Date(started).toISOString(),
    last: last === null ? 'unknown' : new Date(last).toISOString(),
    lastMs: last,
    title: clip(redact(prompts[0] ?? 'unknown'), 80),
    asked: asked.length ? asked : ['unknown'],
    done: { tools, files: changed, commits: [] },
    lastAction: lastAction ? { tool: clip(redact(lastAction.tool), 40), ...(lastAction.target ? { target: clip(redact(lastAction.target), 60) } : {}) } : null,
    result: result ? clip(redact(result), 240) : 'unknown',
    status,
    ...(waiting ? { waitingReason: 'asked the user' } : {}),
  };
};
