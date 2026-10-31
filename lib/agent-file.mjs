// The LitFamily ground rule for the Antigravity CLI: one owned file in agy's
// global rules folder (`~/.gemini/config/rules/litgravity.md`), which agy's own
// changelog says the agent reads, plus a marker block for a project's AGENTS.md.
// A shared GEMINI.md block is not offered: on this machine it is a symlink, and
// a symlinked file is always refused. Only the bytes between a block's markers
// are ever written; the rest of the user's file stays byte for byte.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { packageVersion } from './bundle.mjs';
import { assertSafeWritePath } from './guard.mjs';
import { paths } from './paths.mjs';
import { writeFileAtomic } from './safe-write.mjs';

export const AGENT_FILE_ID = 'litgravity';
export const AGENT_FILE_MODES = Object.freeze(['on', 'off']);
// The global rule file loads on every turn of every session, so it stays small.
export const AGENT_FILE_MAX_BYTES = 1200;

const GLOBAL_BODY = `---
trigger: model_decision
description: "LitGravity ground rules for the Antigravity CLI: lit activation, plans, handoffs and release safety."
---

# LitGravity ground rules

These rules apply in an Antigravity CLI session that uses LitGravity's lit workflows
(lit-plan, start-work, lit-loop, review-work, lit-adhd, litresearch).

- 'lit' at the start of a prompt is LitGravity's activation word.
- Plans live in 'plans/', the session handoff in 'HANDOFF.md', run state in '.litgravity/'. Read them before resuming work in a repo.
- Never push, publish, tag or bump a version without the user's explicit yes for that action.
- Call work done only after its tests pass and the changed surface was checked for real.
- In a new repo, 'lit init' maps the repo and leaves short 'AGENTS.md' files with these conventions.
- Turn this rule off with 'npx @litfamily/litgravity config agentFile off'.
`;

const PROJECT_BODY = `## LitGravity project conventions

This repo is worked with LitGravity's lit workflows (lit-plan, start-work, lit-loop, review-work).

- Plans live in 'plans/', the session handoff in 'HANDOFF.md', run state in '.litgravity/' (keep it out of commits). Read the handoff and the active plan before resuming.
- Never push, publish, tag or bump a version without the user's explicit yes for that action.
- Pair every behaviour change with a test that failed first, and check the changed surface for real before calling it done.
`;

/** The shipped text: `global` for the rules-folder file, `project` for a repo's AGENTS.md. */
export function agentFileBody(kind = 'global') {
  if (kind === 'global') return GLOBAL_BODY;
  if (kind === 'project') return PROJECT_BODY;
  throw new Error(`unknown agent file kind: ${kind}`);
}

export const ruleFileMarker = (fileVersion) => `<!-- litfamily:litgravity:rule v=${fileVersion} -->`;

/** The full owned-file text: our marker line, then the global body. */
export const ruleFileText = (fileVersion) => `${ruleFileMarker(fileVersion)}\n${agentFileBody('global')}`;

export class RuleBlockError extends Error {}

const startPrefix = (id) => `<!-- litfamily:${id}:start`;
const endMarker = (id) => `<!-- litfamily:${id}:end -->`;
const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');
const START_LINE = /^<!-- litfamily:[^:\s]+:start v=(\S+)((?: [a-z]+=[0-9a-f]*)*) -->/u;

const occurrences = (text, needle) => {
  const found = [];
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) found.push(at);
  return found;
};

// The block's span `[start, end)`, end just past the end marker, and its recorded attributes; or null.
const locate = (text, id) => {
  const starts = occurrences(text, startPrefix(id));
  const ends = occurrences(text, endMarker(id));
  if (starts.length === 0 && ends.length === 0) return null;
  if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) {
    throw new RuleBlockError(`malformed LitFamily ${id} block: expected one start and one end marker`);
  }
  const head = START_LINE.exec(text.slice(starts[0]));
  if (!head) throw new RuleBlockError(`malformed LitFamily ${id} block: unreadable start marker`);
  const attrs = Object.fromEntries(head[2].trim().split(' ').filter(Boolean).map((pair) => pair.split('=')));
  return {
    start: starts[0],
    end: ends[0] + endMarker(id).length,
    version: head[1],
    pre: attrs.pre ? Buffer.from(attrs.pre, 'hex').toString('utf8') : '',
    created: attrs.new === '1',
  };
};

const render = ({ id, version: blockVersion, body }, eol, { pre, created }) => [
  `${startPrefix(id)} v=${blockVersion}${pre ? ` pre=${Buffer.from(pre, 'utf8').toString('hex')}` : ''}${created ? ' new=1' : ''} -->`,
  ...String(body).replace(/\r?\n$/u, '').split(/\r?\n/u),
  endMarker(id),
].join(eol);

/** `{state: "absent" | "present" | "malformed", version, created}` for block `id` in `text`. */
export function inspectRuleBlock(text, id) {
  let span;
  try {
    span = locate(text, id);
  } catch {
    return { state: 'malformed', version: null, created: false };
  }
  return span ? { state: 'present', version: span.version, created: span.created } : { state: 'absent', version: null, created: false };
}

/** Adds or replaces block `id`; `created` marks a file made for the block. Returns `{text, changed}`. */
export function upsertRuleBlock(text, block, { created = false } = {}) {
  const eol = eolOf(text);
  const span = locate(text, block.id);
  if (span) {
    const rendered = render(block, eol, span);
    const next = `${text.slice(0, span.start)}${rendered}${text.slice(span.end)}`;
    return { text: next, changed: next !== text };
  }
  const pre = text === '' ? '' : `${text.endsWith('\n') ? '' : eol}${eol}`;
  return { text: `${text}${pre}${render(block, eol, { pre, created })}${eol}`, changed: true };
}

/** Removes block `id`, the line ending after it and what was added before it. */
export function removeRuleBlock(text, id) {
  const span = locate(text, id);
  if (!span) return { text, changed: false, created: false };
  let before = text.slice(0, span.start);
  let after = text.slice(span.end);
  const eol = after.startsWith('\r\n') ? '\r\n' : after.startsWith('\n') ? '\n' : '';
  after = after.slice(eol.length);
  if (span.pre && before.endsWith(span.pre)) before = before.slice(0, -span.pre.length);
  return { text: `${before}${after}`, changed: true, created: span.created };
}

// "missing", "file", "symlink" or "other", without following a link.
function entryKind(path) {
  try {
    const stats = lstatSync(path);
    return stats.isSymbolicLink() ? 'symlink' : stats.isFile() ? 'file' : 'other';
  } catch (error) {
    if (error.code === 'ENOENT') return 'missing';
    throw error;
  }
}

// The file's text, or null when it is not UTF-8 (a UTF-16 file from Notepad, Latin-1): rewriting
// those would corrupt the user's bytes outside our marker.
function readUtf8(path) {
  const bytes = readFileSync(path);
  if (bytes.includes(0) || (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return null;
  }
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const hasRuleMarker = (text) => /^<!-- litfamily:litgravity:rule v=\S+ -->$/.test(text.split('\n', 1)[0].replace(/\r$/, ''));

/**
 * `present v=<x>` (current), `stale v=<x>` (an older install's file), `absent`, `malformed`,
 * or `symlink` / `not-file` / `not-utf8` for a file LitGravity will not write.
 */
export function ruleFileState({ path, version: fileVersion }) {
  const kind = entryKind(path);
  if (kind === 'missing') return 'absent';
  if (kind === 'symlink') return 'symlink';
  if (kind === 'other') return 'not-file';
  const text = readUtf8(path);
  if (text === null) return 'not-utf8';
  if (!hasRuleMarker(text)) return 'malformed';
  const held = /^<!-- litfamily:litgravity:rule v=(\S+) -->$/.exec(text.split('\n', 1)[0].replace(/\r$/, ''))[1];
  return `${held === fileVersion ? 'present' : 'stale'} v=${held}`;
}

/** The stored on/off setting, beside any other keys in our data-dir config. `LITGRAVITY_AGENT_FILE` wins. */
export function readAgentFileMode({ env = process.env, configFile } = {}) {
  const override = String(env.LITGRAVITY_AGENT_FILE ?? '').trim().toLowerCase();
  if (AGENT_FILE_MODES.includes(override)) return override;
  try {
    const parsed = JSON.parse(readFileSync(configFile, 'utf8'));
    const stored = parsed && typeof parsed === 'object' ? parsed.agentFile : undefined;
    return AGENT_FILE_MODES.includes(stored) ? stored : 'on';
  } catch {
    return 'on';
  }
}

export function writeAgentFileMode(configFile, mode) {
  if (!AGENT_FILE_MODES.includes(mode)) throw new Error(`agentFile takes one of: ${AGENT_FILE_MODES.join(', ')}`);
  let current = {};
  try {
    current = JSON.parse(readFileSync(configFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`${configFile} is not valid JSON (${error.message}); refusing to overwrite config.json`);
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    throw new Error(`${configFile} is not a JSON object; refusing to overwrite config.json`);
  }
  writeFileAtomic(configFile, `${JSON.stringify({ ...current, agentFile: mode })}\n`);
  return mode;
}

// The record of the rule file we wrote: path, content hash and version. Uninstall removes the file
// only while it still matches this record, so a hand-edited file is kept.
function readRecord(p) {
  try {
    const rec = JSON.parse(readFileSync(p.agentFileRecord, 'utf8'));
    if (rec && rec.path === p.geminiRulesFile && typeof rec.sha256 === 'string') return rec;
    return null;
  } catch {
    return null;
  }
}

function writeRecord(p, content, fileVersion) {
  writeFileAtomic(p.agentFileRecord, `${JSON.stringify({ path: p.geminiRulesFile, sha256: sha256(content), version: fileVersion, updatedAt: new Date().toISOString() })}\n`);
}

function clearRecord(p) {
  rmSync(p.agentFileRecord, { force: true });
}

const moveAsideHint = (target) => {
  const saved = `${target}.saved-${new Date().toISOString().slice(0, 10)}`;
  return `move it aside: mv "${target}" "${saved}" — then run install again`;
};

/**
 * Decides before any write what the install should do about the global rule file:
 * `create` / `update` / `unchanged` / `off` (stored off: our file goes) / `skip`
 * (project scope or a per-run skip: left alone) / `refuse` (foreign, edited or
 * unreadable: fail closed with the way through in `detail`).
 */
export function planRuleFile({ p, version: fileVersion, env = process.env, flags = {}, scope = 'user' }) {
  if (scope !== 'user') return { action: 'skip', detail: 'skipped: project scope installs only the plugin; the global rule belongs to a user-scope install' };
  if (flags.noAgentFile) return { action: 'skip', detail: 'skipped (--no-agent-file)' };
  if (readAgentFileMode({ env, configFile: p.litgravityConfig }) === 'off') {
    return { action: 'off', detail: `off (turn it back on with \`npx @litfamily/litgravity config agentFile on\`)` };
  }
  const target = p.geminiRulesFile;
  const kind = entryKind(target);
  if (kind === 'symlink') return { action: 'refuse', state: 'symlinked', detail: `${target} is a symbolic link; LitGravity never writes through it. Remove the link itself and run install again` };
  if (kind === 'other') return { action: 'refuse', state: 'not-file', detail: `${target} is not a regular file; ${moveAsideHint(target)}` };
  if (kind === 'missing') return { action: 'create', detail: `create ${target}` };
  const text = readUtf8(target);
  if (text === null) return { action: 'refuse', state: 'not-utf8', detail: `${target} is not UTF-8; ${moveAsideHint(target)}` };
  if (text === ruleFileText(fileVersion)) return { action: 'unchanged', detail: `unchanged ${target}` };
  const record = readRecord(p);
  if (record && record.sha256 === sha256(text)) return { action: 'update', detail: `update ${target} (stale v=${record.version ?? '?'})` };
  if (hasRuleMarker(text)) return { action: 'refuse', state: 'modified', detail: `${target} changed since install; ${moveAsideHint(target)}` };
  return { action: 'refuse', state: 'foreign', detail: `${target} holds text LitGravity did not write; ${moveAsideHint(target)}` };
}

/** Runs a `create` / `update` / `off` plan from `planRuleFile`. Returns `{status, path, ...}`. */
export function applyRuleFile({ p, version: fileVersion, action, env = process.env, flags = {}, scope = 'user' }) {
  const target = p.geminiRulesFile;
  if (target !== p.geminiRulesFile) throw new Error(`refused: agent file target is not the rules folder file (${target})`);
  if (action === 'skip' || action === 'unchanged') return { status: action === 'skip' ? 'skipped' : 'unchanged', path: target };
  if (action === 'off') {
    const removed = removeRuleFile({ p });
    return { status: removed.status === 'removed' ? 'removed' : 'absent', path: target };
  }
  if (action !== 'create' && action !== 'update') throw new Error(`unknown agent file action: ${action}`);
  // Re-check under the write: a foreign file that landed after the plan still fails closed.
  const fresh = planRuleFile({ p, version: fileVersion, env, flags, scope });
  if (fresh.action !== action) return { status: `refused-${fresh.state ?? 'changed'}`, path: target, detail: fresh.detail };
  assertSafeWritePath(target);
  const text = ruleFileText(fileVersion);
  writeFileAtomic(target, text);
  writeRecord(p, text, fileVersion);
  return { status: action === 'create' ? 'created' : 'updated', path: target };
}

/** True when an uninstall would remove the rule file (it still matches our install record). */
export function willRemoveRuleFile(p) {
  if (entryKind(p.geminiRulesFile) === 'missing') return false;
  try {
    const text = readUtf8(p.geminiRulesFile);
    const record = readRecord(p);
    return text !== null && record !== null && record.sha256 === sha256(text);
  } catch {
    return false;
  }
}

/**
 * Removes the rule file when it still matches our install record. An edited or foreign file
 * stays, unless `discardModified` says otherwise for a file carrying our marker.
 */
export function removeRuleFile({ p, discardModified = false }) {
  const target = p.geminiRulesFile;
  if (entryKind(target) === 'missing') {
    clearRecord(p);
    return { status: 'absent', path: target };
  }
  let text = null;
  try {
    text = readUtf8(target);
  } catch {
    return { status: 'kept', path: target, detail: `${target} cannot be read; left alone` };
  }
  const record = readRecord(p);
  if (text !== null && record && record.sha256 === sha256(text)) {
    rmSync(assertSafeWritePath(target), { force: true });
    clearRecord(p);
    return { status: 'removed', path: target };
  }
  if (text !== null && hasRuleMarker(text) && discardModified) {
    rmSync(assertSafeWritePath(target), { force: true });
    clearRecord(p);
    return { status: 'removed', path: target, discarded: true };
  }
  if (text !== null && hasRuleMarker(text)) {
    return { status: 'kept', path: target, detail: `${target} changed since install; add --discard-modified to remove it anyway` };
  }
  return { status: 'kept', path: target, detail: `${target} holds text LitGravity did not write; left alone` };
}

/**
 * `present v=<x>` (current), `stale v=<x>`, `absent`, `malformed`, or `symlink` /
 * `not-file` / `not-utf8` for a project file LitGravity will not write.
 */
export function projectBlockState({ path, id = AGENT_FILE_ID, version: fileVersion }) {
  const kind = entryKind(path);
  if (kind === 'missing') return 'absent';
  if (kind === 'symlink') return 'symlink';
  if (kind === 'other') return 'not-file';
  const text = readUtf8(path);
  if (text === null) return 'not-utf8';
  const found = inspectRuleBlock(text, id);
  if (found.state !== 'present') return found.state;
  return `${found.version === fileVersion ? 'present' : 'stale'} v=${found.version}`;
}

/**
 * Installs or removes the project block in `path`. Returns `{status, path, preview?}` with status
 * created | updated | unchanged | removed | absent | dry-run | refused-symlink | refused-not-file |
 * refused-not-utf8 | refused-malformed | refused-no-dir | refused-io. No backup copy is left
 * beside the tracked file, and a missing folder is never created.
 */
export function applyProjectBlock({ path, id = AGENT_FILE_ID, version: fileVersion, body, action = 'install', dryRun = false }) {
  try {
    const kind = entryKind(path);
    if (kind === 'symlink') return { status: 'refused-symlink', path };
    if (kind === 'other') return { status: 'refused-not-file', path };
    if (kind === 'missing') {
      let parentOk = false;
      try {
        parentOk = lstatSync(dirname(path)).isDirectory();
      } catch {
        parentOk = false;
      }
      if (!parentOk) return { status: 'refused-no-dir', path };
    }
    const text = kind === 'file' ? readUtf8(path) : '';
    if (text === null) return { status: 'refused-not-utf8', path };
    let next;
    try {
      next = action === 'uninstall'
        ? removeRuleBlock(text, id)
        : upsertRuleBlock(text, { id, version: fileVersion, body }, { created: kind === 'missing' });
    } catch (error) {
      if (error instanceof RuleBlockError) return { status: 'refused-malformed', path };
      throw error;
    }
    if (!next.changed) return { status: action === 'uninstall' ? 'absent' : 'unchanged', path };
    if (dryRun) return { status: 'dry-run', path, preview: next.text };
    assertSafeWritePath(path);
    writeFileAtomic(path, next.text);
    return { status: kind === 'file' ? (action === 'uninstall' ? 'removed' : 'updated') : (action === 'uninstall' ? 'removed' : 'created'), path };
  } catch (error) {
    return { status: 'refused-io', path, error: error?.code ?? error?.message };
  }
}

export const agentFileLine = (result) => `AGENT_FILE: ${result.status} ${result.path}`;

/** `litgravity config agentFile on|off`: stores the mode; off removes our file, on writes it back. */
export async function runAgentFileConfig({ env = process.env, args = [], cwd = process.cwd(), print = console.log }) {
  const [key, value] = args;
  if (key !== 'agentFile' || (value !== 'on' && value !== 'off')) {
    print('Usage: litgravity config agentFile on|off');
    return 64;
  }
  const p = paths(env, cwd);
  if (value === 'off') {
    const removed = removeRuleFile({ p });
    writeAgentFileMode(p.litgravityConfig, 'off');
    print(`AGENT_FILE: ${removed.status} ${removed.path}${removed.detail ? ` (${removed.detail})` : ''}`);
    return 0;
  }
  writeAgentFileMode(p.litgravityConfig, 'on');
  const plan = planRuleFile({ p, version: packageVersion(), env, flags: {}, scope: 'user' });
  if (plan.action === 'refuse') {
    print(`FAIL agent file ${plan.state}: ${plan.detail}`);
    return 1;
  }
  const applied = applyRuleFile({ p, version: packageVersion(), action: plan.action, env, flags: {}, scope: 'user' });
  print(agentFileLine(applied));
  return applied.status.startsWith('refused') ? 1 : 0;
}

/**
 * `litgravity agent-file project [--dir <path>]`: the project block into the repo's AGENTS.md.
 * An existing file is kept byte for byte outside the markers; a missing folder is never created.
 */
export async function runAgentFileProject({ env = process.env, args = [], cwd = process.cwd(), flags = {}, print = console.log }) {
  const [sub, ...rest] = args;
  if (sub === '--help' || sub === '-h') {
    print('Usage: litgravity agent-file project [--dir <path>]');
    return 0;
  }
  if (sub !== 'project') {
    print('Usage: litgravity agent-file project [--dir <path>]');
    return 64;
  }
  let dir = cwd;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--dir' && rest[i + 1]) {
      dir = resolve(cwd, rest[i + 1]);
      i += 1;
      continue;
    }
    print(`Unknown agent-file option: ${rest[i]}`);
    return 64;
  }
  let isDirectory = false;
  try {
    isDirectory = lstatSync(dir).isDirectory();
  } catch {
    // Missing: reported below, never created.
  }
  if (!isDirectory) {
    print(`agent-file: ${dir} is not an existing folder`);
    return 64;
  }
  const fileVersion = packageVersion();
  const result = applyProjectBlock({
    path: join(dir, 'AGENTS.md'),
    id: AGENT_FILE_ID,
    version: fileVersion,
    body: agentFileBody('project'),
    action: 'install',
    dryRun: flags.dryRun === true,
  });
  print(agentFileLine(result));
  return result.status.startsWith('refused') ? 1 : 0;
}
