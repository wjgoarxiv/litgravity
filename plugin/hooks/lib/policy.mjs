import { realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';

// What a lit-plan (planning) turn may do. agy publishes no closed tool list, so the guard names the tools that change
// things and lets the rest pass: the allowlist of the sibling hosts becomes a denylist here and is recorded as a
// FALLBACK in the feature map. Tool names are the lowercased step types agy uses as hook matchers.

// agy's hook payload names a tool by its step type, and the names differ between builds and surfaces (a headless run
// of 1.4.3 calls `write_file` and `read_file`, older conversations used `write_to_file` and `view_file`). A call counts
// as a file write when its name says so, or when its arguments carry both a path and new content.
const WRITE_NAME = /(^|_)(write|edit|replace|create|delete|move|rename|patch|code_action|file_change|propose_code)(_|$)/;
const PATH_KEY = /^(path|file|filepath|file_path|targetfile|target_file|absolutepath|target_path)$/i;
const NEW_TEXT_KEY = /^(content|codecontent|code_content|replacementcontent|replacement_content|new_string|new_text|newstring|text|body)$/i;
const OLD_TEXT_KEY = /^(targetcontent|target_content|old_string|old_text|oldstring)$/i;

const stringsOf = (args, pattern) => Object.entries(args).filter(([k, v]) => pattern.test(k) && typeof v === 'string').map(([, v]) => v);

export function targetPaths(args) {
  return stringsOf(args, PATH_KEY).filter(Boolean);
}

export function isWriteCall(tool, args) {
  if (WRITE_NAME.test(tool)) return true;
  return targetPaths(args).length > 0 && (stringsOf(args, NEW_TEXT_KEY).length > 0 || Array.isArray(args.ReplacementChunks));
}

// What a write adds and what it replaces, whichever argument names the host used. Chunked edits yield one entry each.
export function writeEdits(args) {
  if (Array.isArray(args.ReplacementChunks)) {
    return args.ReplacementChunks.map((c) => ({ added: String(c?.ReplacementContent ?? ''), existing: String(c?.TargetContent ?? '') }));
  }
  return [{ added: stringsOf(args, NEW_TEXT_KEY).join('\n'), existing: stringsOf(args, OLD_TEXT_KEY).join('\n') }];
}

export const SHELL_TOOLS = new Set(['run_command', 'send_command_input']);
// Tools that start work outside the planning turn's reach.
export const BLOCKED_IN_PLAN = new Set([
  'define_subagent', 'browser_subagent', 'generate_image', 'schedule', 'restart_dev_server', 'deploy_firebase',
]);
// Child agents a planning turn may start: LitGravity agents that cannot write.
export const READ_ONLY_AGENTS = new Set([
  'lit-planner', 'librarian-researcher', 'lit-verifier', 'quality-reviewer',
  'korean-style-analyzer', 'korean-prose-editor', 'meaning-preservation-auditor', 'native-flow-reviewer', 'polish-orchestrator',
]);

export function childAgent(args) {
  const raw = typeof args.TypeName === 'string' ? args.TypeName : '';
  return raw.replace(/^litgravity[:/]/, '');
}

// Any of these characters makes a command compound, redirected, substituted or escaped: refused outright.
const SHELL_META = /[;&|<>`$\\\n\r(){}]/;

// Per-program flag allowlists. `flags` take no value; `valueFlags` take the next word; `prefixFlags` carry their value
// after `=`; `numeric` allows `-<digits>`.
const PROGRAMS = {
  ls: { flags: /^-[laRh1FdtrSA]+$/ },
  cat: { flags: /^-n$/ },
  head: { flags: /^$/, valueFlags: ['-n', '-c'], numeric: true },
  tail: { flags: /^$/, valueFlags: ['-n', '-c'], numeric: true },
  wc: { flags: /^-[lwcm]+$/ },
  pwd: { flags: /^$/ },
  rg: {
    flags: /^(-[nilcwFSsv]+|--(files|hidden|no-heading|line-number|count|ignore-case|fixed-strings|word-regexp|files-with-matches|smart-case|case-sensitive|invert-match))$/,
    valueFlags: ['-g', '--glob', '-t', '--type', '-A', '-B', '-C', '-m', '--max-count'],
  },
};
const GIT = {
  subcommands: new Set(['log', 'status', 'diff', 'show']),
  flags: /^(--(oneline|stat|shortstat|numstat|summary|name-only|name-status|short|porcelain|cached|staged|patch|graph|decorate|all|no-color|abbrev-commit|branch)|-[sp])$/,
  valueFlags: ['-n', '--max-count'],
  prefixFlags: /^--(format|pretty|since|until|author|grep|max-count|stat)=[^\s]*$/,
  numeric: true,
};

// Splits on spaces with plain single or double quotes; anything unusual returns null (refused).
function words(command) {
  const out = [];
  let cur = '';
  let quote = null;
  let started = false;
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (ch === ' ' || ch === '\t') {
      if (started) out.push(cur);
      cur = '';
      started = false;
    } else {
      cur += ch;
      started = true;
    }
  }
  if (quote) return null;
  if (started) out.push(cur);
  return out;
}

function argsAllowed(args, spec) {
  let positional = false;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (positional || !a.startsWith('-') || a === '-') continue;
    if (a === '--') { positional = true; continue; }
    if (spec.flags.test(a)) continue;
    if (spec.numeric && /^-\d+$/.test(a)) continue;
    if (spec.prefixFlags && spec.prefixFlags.test(a)) continue;
    if (spec.valueFlags && spec.valueFlags.includes(a)) {
      const v = args[i + 1];
      if (v === undefined || v.startsWith('-')) return false;
      i += 1;
      continue;
    }
    return false;
  }
  return true;
}

// The one program a planning turn may run besides the read-only list: lit-plan's own structural checker. It reads one
// file and writes only to stdout, and the path must resolve to the copy that ships in this plugin.
function realPath(p) {
  try { return realpathSync(p); } catch { return resolve(p); }
}

function planChecker(args, pluginRoot) {
  if (!pluginRoot || args.length !== 3) return false;
  const [script, flag, target] = args;
  if (realPath(script) !== realPath(join(pluginRoot, 'skills', 'lit-plan', 'scripts', 'check-plan.mjs'))) return false;
  if (!['--check', '--complete', '--skeleton'].includes(flag)) return false;
  return Boolean(target) && !target.startsWith('-');
}

export function shellReadOnly(command, { pluginRoot } = {}) {
  if (typeof command !== 'string' || !command.trim() || SHELL_META.test(command)) return false;
  const argv = words(command.trim());
  if (!argv || !argv.length) return false;
  const [program, ...args] = argv;
  if (program === 'node') return planChecker(args, pluginRoot);
  if (program === 'git') {
    const [sub, ...rest] = args;
    return GIT.subcommands.has(sub) && argsAllowed(rest, GIT);
  }
  const spec = PROGRAMS[program];
  return Boolean(spec) && argsAllowed(args, spec);
}
