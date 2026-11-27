import { lstatSync, readFileSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { homedir, userInfo } from 'node:os';

// Sorts a shell step that a start-work run set aside instead of running. agy's PreToolUse cannot abstain (an empty
// answer is a denial and `allow` may lift the user's own approval prompt), so this classifier never sits in front of
// run_command. It sorts what the model parks through the ledger, and it runs again on every replay.
//
//   B        positively local and undoable: cd, touch, mkdir [-p], cp/mv onto a new path, git add of named files,
//            every path resolved inside the workspace and outside .git. Replayed by `lit approve`.
//   X        everything else that may be parked. Replayed only by the exact prompt `lit approve x`.
//   held     the word reader cannot follow it (expansion, glob, prefix verb, nested shell ...). Listed, never run.
//   refused  names a secret, a host settings folder or LitGravity's own state. Never stored.
//   split    a self-check refused only for its shape; the parts can run one by one, nothing is parked.

const CASE_FOLD = process.platform === 'darwin' || process.platform === 'win32';
const fold = (p) => (CASE_FOLD ? p.toLowerCase() : p);

const PREFIX_VERBS = new Set(['time', 'nice', 'nohup', 'timeout', 'stdbuf', 'ionice', 'chroot', 'doas', 'sudo', 'env', 'command', 'builtin', 'exec', 'eval', 'source', '.', 'xargs', 'pushd', 'popd', 'alias', 'unalias', 'set', 'shopt', 'trap', 'enable', '!', 'coproc', 'watch', 'caffeinate']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish']);
const READERS = new Set(['cat', 'head', 'tail', 'wc', 'grep', 'rg', 'ls', 'stat', 'file', 'diff', 'sort', 'uniq', 'cut', 'pwd', 'true', 'echo', 'printf', 'sed']);
const READ_GIT = new Set(['status', 'diff', 'log', 'show', 'blame', 'ls-files']);
const LOCAL_GIT = new Set(['add', 'commit', 'status', 'diff', 'log', 'show', 'blame', 'ls-files', 'rev-parse', 'switch', 'checkout', 'restore', 'branch', 'stash', 'mv', 'grep']);
const OUTWARD_VERBS = new Set(['curl', 'wget', 'ssh', 'scp', 'sftp', 'ftp', 'rsync', 'nc', 'ncat', 'telnet', 'docker', 'podman', 'kubectl', 'helm', 'aws', 'gcloud', 'gsutil', 'az', 'gh', 'heroku', 'vercel', 'netlify', 'firebase', 'flyctl', 'fly', 'terraform', 'rm', 'rmdir', 'unlink', 'shred', 'truncate', 'dd', 'make', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'bunx', 'deno', 'pip', 'pip3', 'cargo', 'go', 'brew', 'apt', 'apt-get', 'open', 'agy', 'kill', 'pkill', 'killall', 'launchctl', 'systemctl', 'crontab', 'chmod', 'chown']);

const SECRET_DIRS = new Set(['.ssh', '.aws', '.gnupg']);
const SECRET_FILE = /^(?:\.env(?:\..+)?|\.envrc|\.npmrc|\.pypirc|\.netrc|\.pgpass|\.git-credentials|\.mcp\.json|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|.+\.pem|.+\.p12|.+\.pfx|.+\.key|credentials(?:\.json)?)$/i;
const SAFE_ENV = /^\.env\.(?:example|sample|template|dist)$/i;
const HOME_FILES = new Set(['.bashrc', '.bash_profile', '.bash_login', '.profile', '.zshrc', '.zshenv', '.zprofile', '.zlogin', '.config/fish/config.fish', '.gitconfig']);
// agy's own settings, plugins and credentials live here; a run never writes or reads them.
const HOST_HOME = ['.gemini', '.config/gcloud'];
// Folders where other command-line tools keep their tokens.
const TOOL_SECRET_HOME = ['.config/gh', '.docker', '.kube'];

function homes(env = process.env) {
  const list = new Set();
  for (const h of [env.HOME, safeUserHome(), homedir()]) if (h) list.add(resolve(h)).add(realOr(h));
  return [...list];
}

function safeUserHome() {
  try { return userInfo().homedir; } catch { return null; }
}

function within(target, root) {
  const t = fold(target);
  const r = fold(root);
  return t === r || t.startsWith(r.endsWith(sep) ? r : r + sep);
}

function realOr(p) {
  try { return realpathSync(p); } catch { return resolve(p); }
}

// Real location of a path that may not exist yet: lstat walks up to the nearest existing entry, then realpath. A
// dangling link counts as present and its realpath fails, so it is reported, never treated as a new path.
export function realTarget(cwd, p) {
  const abs = resolve(cwd, p);
  const rest = [];
  let cur = abs;
  for (;;) {
    try { lstatSync(cur); break; } catch { /* absent: climb */ }
    const up = dirname(cur);
    if (up === cur) break;
    rest.unshift(basename(cur));
    cur = up;
  }
  let real;
  try { real = realpathSync(cur); } catch { return { dangling: true, abs }; }
  return { real: rest.length ? join(real, ...rest) : real, exists: rest.length === 0, abs };
}

// ---- word reader ------------------------------------------------------------------------------------------------

// Splits a command into parts joined by shell operators. Words come back with quotes removed. Anything the reader
// cannot follow is a flag, and a flagged command is never treated as known.
export function lex(command) {
  const parts = [{ words: [], redirects: [], op: null }];
  const flags = new Set();
  let word = null;
  let quote = null;
  const cur = () => parts[parts.length - 1];
  const push = () => { if (word !== null) cur().words.push(word); word = null; };
  const brk = (op) => { push(); parts.push({ words: [], redirects: [], op }); };
  for (let i = 0; i < command.length; i += 1) {
    const c = command[i];
    if (quote === "'") {
      if (c === "'") quote = null; else { word += c; if (c === '\\') flags.add('escape'); }
      continue;
    }
    if (quote === '"') {
      if (c === '"') quote = null;
      else {
        if (c === '$' || c === '`') flags.add('expansion');
        if (c === '\\') flags.add('escape');
        word += c;
      }
      continue;
    }
    if (c === "'" || c === '"') { quote = c; word = word ?? ''; continue; }
    if (/[ \t]/.test(c)) { push(); continue; }
    if (c === '\n' || c === '\r') { brk(';'); flags.add('newline'); continue; }
    if (c === '\\') { flags.add('escape'); word = (word ?? '') + (command[i + 1] ?? ''); i += 1; continue; }
    if (c === '$' && command[i + 1] === '?') { flags.add('expansion'); word = `${word ?? ''}$?`; i += 1; continue; }
    if (c === '$' || c === '`') { flags.add('expansion'); word = (word ?? '') + c; continue; }
    if (c === '(' || c === ')') { flags.add('subshell'); push(); continue; }
    if (c === '&' && command[i + 1] === '&') { brk('&&'); i += 1; continue; }
    if (c === '|' && command[i + 1] === '|') { brk('||'); i += 1; continue; }
    if (c === '|') { brk('|'); continue; }
    if (c === ';') { brk(';'); continue; }
    if (c === '&') { brk('&'); continue; }
    if (c === '>' || c === '<') {
      let fd = '';
      if (word !== null && /^\d+$/.test(word)) { fd = word; word = null; }
      push();
      let op = c;
      while (command[i + 1] === '>' || command[i + 1] === '<') { op += command[i + 1]; i += 1; }
      if (command[i + 1] === '&' && /\d/.test(command[i + 2] ?? '')) {
        cur().redirects.push({ op: `${fd}${op}&${command[i + 2]}`, dup: true });
        i += 2;
        continue;
      }
      cur().redirects.push({ op: `${fd}${op}`, dup: false, target: null });
      continue;
    }
    if (/[*?[\]]/.test(c)) flags.add('glob');
    if (c === '{' && /^\{[^}]*,[^}]*\}/.test(command.slice(i))) flags.add('brace');
    if (c === '~' && word === null) flags.add(/^~[A-Za-z0-9_]/.test(command.slice(i)) ? 'tilde-user' : 'tilde');
    word = (word ?? '') + c;
  }
  if (quote) flags.add('unpaired');
  push();
  return { parts, flags };
}

// A redirect target stays in the part's words, so the protected check below sees it like any other path.
const wordsOf = (part) => part.words;
const B_VERBS = new Set(['cd', 'touch', 'mkdir', 'cp', 'mv']);

// ---- protected paths --------------------------------------------------------------------------------------------

// Every place a path may land: as written, its real location even when the last parts do not exist yet, and, through
// a dangling link, where that link points (up to 8 hops). A protected folder reached any of these ways is protected.
// A chain that loops or is longer than 8 hops never ends anywhere checkable, so `endless` makes it protected too.
function landings(absPath) {
  const out = new Set([resolve(absPath), realOr(absPath)]);
  let p = resolve(absPath);
  for (let hop = 0; ; hop += 1) {
    if (hop >= 8) { out.endless = true; break; }
    const t = realTarget('/', p);
    if (!t.dangling) {
      out.add(t.real);
      break;
    }
    const rest = [];
    let cur = p;
    for (;;) {
      try { lstatSync(cur); break; } catch { /* absent: climb */ }
      rest.unshift(basename(cur));
      cur = dirname(cur);
    }
    let link;
    try { link = readlinkSync(cur); } catch { break; }
    p = join(resolve(dirname(cur), link), ...rest);
    out.add(p);
  }
  return out;
}

// Nothing inside .git (or .git itself) may be written: hooks and config run programs, worktrees points git at other
// folders, and HEAD, refs, the index and packed-refs decide what the next commit and push contain.
const gitControl = (p) => p.split(sep).some((c) => fold(c) === '.git');

// The places a recursive read of an ancestor would reach into: secret and settings folders in each home, and the run
// state.
function protectedRoots(ctx) {
  const roots = [];
  for (const h of homes(ctx.env)) for (const d of [...SECRET_DIRS, ...HOST_HOME, ...TOOL_SECRET_HOME]) roots.push(join(h, d));
  if (ctx.stateDir) roots.push(resolve(ctx.stateDir), realOr(ctx.stateDir));
  return roots;
}

// grep -r/-R, rg, find, ls -R, diff -r, tree and du walk the folders they are given.
const GREPS = new Set(['grep', 'egrep', 'fgrep']);
function recursiveReader(verb, args) {
  if (verb === 'rg' || verb === 'find' || verb === 'tree' || verb === 'du') return true;
  if (GREPS.has(verb)) return args.some((a, i) => /^-[A-Za-z]*[rR]/.test(a) || a.startsWith('--recursive') || a.startsWith('--dereference-recursive') || /^--directories=recurse/.test(a) || (a === '-d' && args[i + 1] === 'recurse'));
  if (verb === 'ls') return args.some((a) => /^-[A-Za-z]*R/.test(a) || a === '--recursive');
  if (verb === 'diff') return args.some((a) => /^-[A-Za-z]*r/.test(a) || a === '--recursive');
  return false;
}

// Options of grep and rg that take the next word as their value.
const GREP_VALUE_OPTS = new Set(['-A', '-B', '-C', '-m', '-d', '-D', '--max-count', '--context', '--before-context', '--after-context', '--include', '--exclude', '--exclude-dir', '--directories', '--devices']);
const RG_VALUE_OPTS = new Set(['-A', '-B', '-C', '-m', '-g', '-t', '-T', '-j', '-M', '-E', '-d', '--glob', '--iglob', '--type', '--type-not', '--max-count', '--context', '--before-context', '--after-context', '--max-depth', '--max-columns', '--encoding', '--threads']);

// The folders a recursive reader walks: its path operands, or its own folder when it names none. The pattern of grep
// and rg is not a folder unless -e, -f or --files gives the pattern another way.
function recursiveTargets(verb, args) {
  if (verb === 'find') {
    let i = 0;
    while (i < args.length && /^-(?:[HLP]|O\d*|D)$/.test(args[i])) i += args[i] === '-D' ? 2 : 1;
    const out = [];
    for (; i < args.length && !/^[-(!)]/.test(args[i]); i += 1) out.push(args[i]);
    return out;
  }
  const positional = [];
  let patternGiven = verb === 'rg' && args.includes('--files');
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--') { positional.push(...args.slice(i + 1)); break; }
    if (/^-[ef]./.test(a) || /^--(?:regexp|file)=/.test(a)) { patternGiven = true; continue; }
    if (a === '-e' || a === '-f' || a === '--regexp' || a === '--file') { patternGiven = true; i += 1; continue; }
    if (a.startsWith('-')) {
      const values = GREPS.has(verb) ? GREP_VALUE_OPTS : verb === 'rg' ? RG_VALUE_OPTS : null;
      if (values && !a.includes('=') && values.has(a)) i += 1;
      continue;
    }
    positional.push(a);
  }
  return (GREPS.has(verb) || verb === 'rg') && !patternGiven ? positional.slice(1) : positional;
}

const expandHome = (w, ctx) => (w === '~' ? homes(ctx.env)[0] : w.startsWith('~/') ? join(homes(ctx.env)[0], w.slice(2)) : w.replace(/^\$\{?HOME\}?(?=\/)/, homes(ctx.env)[0]));

export function protectedReason(absPath, ctx, { writing = false, moving = false } = {}) {
  const places = landings(absPath);
  if (places.endless) return 'a link chain that loops or does not end';
  for (const p of places) {
    if (writing && gitControl(p)) return 'inside .git';
    const parts = p.split(sep);
    if (parts.some((c) => SECRET_DIRS.has(fold(c)))) return 'a secret folder';
    const name = basename(p);
    if (SECRET_FILE.test(name) && !SAFE_ENV.test(name)) return 'a secret file';
    for (const h of homes(ctx.env)) {
      for (const d of HOST_HOME) if (within(p, join(h, d))) return 'the agy settings home';
      for (const d of TOOL_SECRET_HOME) if (within(p, join(h, d))) return 'a tool credential folder';
      for (const f of HOME_FILES) if (fold(p) === fold(join(h, f))) return 'a shell or tool settings file';
    }
    if (ctx.stateDir && within(p, ctx.stateDir)) return "LitGravity's own run state";
    // Removing, moving or writing over a folder that holds the run state takes the run state with it.
    if (writing && !moving && ctx.stateDir && [resolve(ctx.stateDir), realOr(ctx.stateDir)].some((s) => within(s, p))) return "a folder that holds LitGravity's own run state";
  }
  return null;
}

const looksLikePath = (w) => w.includes('/') || w.startsWith('.') || w === '~' || SECRET_FILE.test(w);

// Follows `cd` across `&&` parts and checks every word that may name a path.
function findProtected(lexed, ctx) {
  let cwd = ctx.cwd;
  if (lexed.flags.has('tilde-user')) return '`~user` names another account\'s home';
  for (const part of lexed.parts) {
    const words = wordsOf(part);
    let start = 0;
    while (start < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[start])) start += 1;
    const verb = words[start];
    if (verb === 'cd' && words.length === start + 1) return 'a bare `cd` moves to the home folder';
    // Every argument of a local verb (cd, touch, mkdir, cp, mv) is a path, even a bare name like `gem`.
    const localVerb = B_VERBS.has(verb);
    // A part writes unless it is a plain reader with no redirect; `cd` only moves.
    const plainReader = (READERS.has(verb) || (verb === 'git' && READ_GIT.has(words[start + 1]))) && !readerWrites(verb, words.slice(start + 1));
    const writing = verb !== 'cd' && (part.redirects.some((r) => !r.dup) || !plainReader);
    // A prefix verb (`time`, `chroot`, `pushd` ...) is held whatever its operands are, so `/` or `..` there is not
    // read as a folder being written.
    const moving = PREFIX_VERBS.has(verb);
    const recursive = recursiveReader(verb, words.slice(start + 1));
    for (const [i, raw] of words.entries()) {
      // `name=value` and `REV:path` (git show HEAD:.env, scp host:path) are checked by their path part too.
      // `:.env` and `:0:.env` (the index) count too, by what follows the first and the last colon.
      const colon = /^[^/:=]*:(.+)$/.exec(raw);
      const cands = [raw, ...(raw.includes('=') ? [raw.slice(raw.indexOf('=') + 1)] : []), ...(colon ? [colon[1], raw.slice(raw.lastIndexOf(':') + 1)] : [])];
      for (const w of cands) {
        if (!w || !(looksLikePath(w) || (localVerb && i > start && !w.startsWith('-')))) continue;
        const expanded = expandHome(w, ctx);
        const reason = protectedReason(resolve(cwd, expanded), ctx, { writing, moving });
        if (reason) return `${w} is ${reason}`;
      }
    }
    if (recursive) {
      const targets = recursiveTargets(verb, words.slice(start + 1));
      for (const w of targets.length ? targets : ['.']) {
        const at = resolve(cwd, expandHome(w, ctx));
        const reason = protectedReason(at, ctx);
        if (reason) return `${w} is ${reason}`;
        const hit = protectedRoots(ctx).find((r) => within(r, at) || within(r, realOr(at)));
        if (hit) return `${targets.length ? w : 'its folder'} holds ${hit}, which a recursive read would reach`;
      }
    }
    if (verb === 'cd' && words[start + 1] && !lexed.flags.has('expansion')) {
      cwd = realOr(resolve(cwd, expandHome(words[start + 1], ctx)));
    }
  }
  return null;
}

// ---- held forms -------------------------------------------------------------------------------------------------

function heldReason(lexed) {
  const f = lexed.flags;
  if (f.has('unpaired')) return 'quotes do not pair';
  if (f.has('expansion')) return 'it expands $ or `...` at run time';
  if (f.has('escape')) return 'it has a backslash escape';
  if (f.has('glob')) return 'it has a glob';
  if (f.has('brace')) return 'it has a brace expansion';
  if (f.has('tilde')) return 'it uses ~';
  if (f.has('subshell')) return 'it opens a subshell';
  if (f.has('newline')) return 'it spans several lines';
  for (const part of lexed.parts) {
    const w = part.words;
    if (!w.length) return 'it has an empty step';
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0])) return `an assignment (${w[0]}) runs before the verb`;
    if (PREFIX_VERBS.has(w[0])) return `\`${w[0]}\` runs or changes another verb`;
    if (w[0] === 'cd' && w[1] === '-') return '`cd -` moves to a folder the reader cannot see';
    if ((B_VERBS.has(w[0]) || (w[0] === 'git' && w[1] === 'add')) && part.redirects.some((r) => !r.dup)) return 'a local verb with a redirect writes a file the reader cannot follow';
    if (SHELLS.has(w[0]) && w.slice(1).some((a) => /^-[A-Za-z]*c[A-Za-z]*$/.test(a))) return 'a nested shell runs a string';
    if (w[0] === 'base64' && w.some((a) => a === '-d' || a === '-D' || a === '--decode')) return 'it decodes bytes to run';
    if (w[0] === 'xxd' && w.includes('-r')) return 'it decodes bytes to run';
    if (w[0] === 'openssl' && (w.includes('enc') || w.includes('-d'))) return 'it decodes bytes to run';
  }
  return null;
}

// ---- tier B -----------------------------------------------------------------------------------------------------

function gitPath(real, root) {
  const rel = relative(root, real);
  return rel.split(sep).some((c) => fold(c) === '.git');
}

// One path a B verb touches. `kind` is 'new' (must not exist), 'any' (touch, mkdir) or 'src' (must exist).
function pathCheck(cwd, p, ctx, kind) {
  if (!p || p.startsWith('-')) return { tier: 'X', why: `${p || 'an empty path'} is not a plain path` };
  if (p.split(/[\\/]/).some((c) => c.toLowerCase() === '.git')) return { tier: 'refused', why: `${p} is inside .git` };
  const t = realTarget(cwd, p);
  if (t.dangling) return { tier: 'X', why: `${p} is a dangling link` };
  const root = realOr(ctx.workspace);
  if (!within(t.real, root)) return { tier: 'X', why: `${p} resolves outside the workspace` };
  if (gitPath(t.real, root)) return { tier: 'refused', why: `${p} resolves inside .git` };
  if (ctx.stateDir && within(t.real, ctx.stateDir)) return { tier: 'refused', why: `${p} is LitGravity's own run state` };
  if (kind === 'src' && !t.exists) return { tier: 'X', why: `${p} does not exist` };
  if (kind === 'new') {
    let present = false;
    try { lstatSync(resolve(cwd, p)); present = true; } catch { present = false; }
    if (present) return { tier: 'X', why: `${p} exists and would be overwritten` };
  }
  return { tier: 'B', real: t.real };
}

function isDir(p) {
  try { return lstatSync(p).isDirectory(); } catch { return false; }
}

function copyMoveCheck(cwd, args, ctx) {
  if (args.length < 2) return { tier: 'X', why: 'cp/mv needs a source and a destination' };
  const srcs = args.slice(0, -1);
  const dst = args[args.length - 1];
  for (const s of srcs) {
    const r = pathCheck(cwd, s, ctx, 'src');
    if (r.tier !== 'B') return r;
  }
  const dstAbs = resolve(cwd, dst);
  if (isDir(dstAbs)) {
    const r = pathCheck(cwd, dst, ctx, 'any');
    if (r.tier !== 'B') return r;
    for (const s of srcs) {
      const inner = pathCheck(dstAbs, basename(s), ctx, 'new');
      if (inner.tier !== 'B') return inner;
    }
    return { tier: 'B' };
  }
  if (srcs.length > 1) return { tier: 'X', why: 'several sources need an existing folder' };
  return pathCheck(cwd, dst, ctx, 'new');
}

// One `&&` part as tier B, or why not. Returns the cwd after a `cd`.
function partTier(part, cwd, ctx) {
  const [verb, ...args] = part.words;
  if (part.redirects.length) return { tier: 'X', why: 'it redirects output' };
  if (verb === 'cd') {
    if (args.length !== 1) return { tier: 'X', why: '`cd` takes one folder' };
    const r = pathCheck(cwd, args[0], ctx, 'src');
    if (r.tier !== 'B') return { ...r, cwd: realOr(resolve(cwd, args[0])) };
    if (!isDir(r.real)) return { tier: 'X', why: `${args[0]} is not a folder` };
    return { tier: 'B', cwd: r.real };
  }
  if (verb === 'touch') {
    if (!args.length) return { tier: 'X', why: 'touch names no file' };
    for (const a of args) { const r = pathCheck(cwd, a, ctx, 'any'); if (r.tier !== 'B') return r; }
    return { tier: 'B' };
  }
  if (verb === 'mkdir') {
    const paths = args.filter((a) => a !== '-p');
    if (!paths.length) return { tier: 'X', why: 'mkdir names no folder' };
    for (const a of paths) { const r = pathCheck(cwd, a, ctx, 'any'); if (r.tier !== 'B') return r; }
    return { tier: 'B' };
  }
  if (verb === 'cp') {
    const paths = args.filter((a) => !['-r', '-R', '-p'].includes(a));
    return copyMoveCheck(cwd, paths, ctx);
  }
  if (verb === 'mv') return copyMoveCheck(cwd, args, ctx);
  if (verb === 'git' && args[0] === 'add') {
    const files = args.slice(1).filter((a) => a !== '--');
    if (!files.length) return { tier: 'X', why: 'git add names no file' };
    for (const a of files) {
      if (a === '.' || a.startsWith('-') || a.startsWith(':')) return { tier: 'X', why: `git add ${a} is not a named file` };
      const r = pathCheck(cwd, a, ctx, 'src');
      if (r.tier !== 'B') return r;
    }
    return { tier: 'B' };
  }
  return { tier: 'X', why: `\`${verb}\` is not on the local allowlist` };
}

// ---- reader forms that write or run -----------------------------------------------------------------------------

// sed is a reader only with -n/-E/-r/-e and scripts made of p, d, q and s commands whose flags are g, i, I, p or a
// number; w, W, e, r, R and -i write a file or run a program.
const SED_ADDR = String.raw`(?:\$|\d+)?(?:,(?:\$|\d+))?\s*`;
const SED_SIMPLE = new RegExp(`^${SED_ADDR}[pdq]$`);
const SED_SUBST = new RegExp(String.raw`^${SED_ADDR}s(.)(?:(?!\1).)*\1(?:(?!\1).)*\1[giIp0-9]*$`);
function sedReads(args) {
  const scripts = [];
  let operandIsScript = true;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '-n' || a === '-E' || a === '-r' || a === '--quiet' || a === '--silent') continue;
    if (a === '-e') { scripts.push(args[i + 1] ?? ''); i += 1; operandIsScript = false; continue; }
    if (a.startsWith('-')) return false;
    if (operandIsScript) { scripts.push(a); operandIsScript = false; }
  }
  return scripts.length > 0 && scripts.every((s) => s.split(/[;\n]/).map((c) => c.trim()).filter(Boolean).every((c) => SED_SIMPLE.test(c) || SED_SUBST.test(c)));
}

// Why a reader or a read-only git verb would write a file or run a program here, or null when it only reads.
// GNU tools take any unambiguous prefix of a long option (`--out` for `--output`), so a typed long option counts as
// one of `names` when it is a prefix of it.
const longOpt = (a, names) => {
  if (!a.startsWith('--') || a.length < 3) return false;
  const name = a.slice(2).split('=')[0];
  return names.some((n) => n.startsWith(name));
};

export function readerWrites(verb, args) {
  if (args.some((a) => a.startsWith('--output') || longOpt(a, ['output']))) return `${verb} --output writes a file`;
  if (verb === 'sort' && args.some((a) => longOpt(a, ['compress-program']))) return 'sort --compress-program runs a program';
  if (verb === 'file' && args.some((a) => longOpt(a, ['compile']))) return 'file --compile writes a compiled magic file';
  if (verb === 'awk' || verb === 'gawk' || verb === 'nawk') return 'awk can write files and run programs';
  if (verb === 'file' && args.some((a) => /^-[A-Za-z]*C/.test(a) || a === '--compile')) return 'file -C writes a compiled magic file';
  if (verb === 'tree' && args.some((a) => /^-[A-Za-z]*o/.test(a))) return 'tree -o writes a file';
  if (verb === 'git' && args[0] === 'grep' && args.some((a) => /^-[A-Za-z]*O/.test(a) || a.startsWith('--open-files-in-pager'))) return 'git grep -O runs a program';
  if (verb === 'sed') return sedReads(args) ? null : 'sed with w, W, e, r or -i writes a file or runs a program';
  if (verb === 'sort' && args.some((a) => /^-[A-Za-z]*o/.test(a))) return 'sort -o writes a file';
  if (verb === 'sort' && args.some((a) => a.startsWith('--compress-program'))) return 'sort --compress-program runs a program';
  if ((verb === 'grep' || verb === 'rg') && args.some((a) => /^-[A-Za-z]*f/.test(a) || a.startsWith('--file'))) return `${verb} -f reads its patterns from another file`;
  if (verb === 'uniq' && args.filter((a) => !a.startsWith('-')).length > 1) return 'uniq writes its second operand';
  if (verb === 'rg' && args.some((a) => a.startsWith('--pre'))) return 'rg --pre runs a program on every file';
  if (verb === 'rg' && args.some((a) => a.startsWith('--hostname-bin'))) return 'rg --hostname-bin runs a program';
  if ((verb === 'less' || verb === 'more') && args.some((a) => a.startsWith('+'))) return `${verb} +command can run a shell command`;
  if (verb === 'jq' && args.some((a) => /\benv\b|\$ENV|input_filename/.test(a))) return 'jq env, $ENV or input_filename prints the environment or file names';
  if (verb === 'find' && args.some((a) => /^-(fprint0?|fprintf|fls|ok|okdir|exec|execdir|delete)$/.test(a))) return 'find writes, deletes or runs a program';
  if (verb === 'git' && args[0] === 'branch' && args.slice(1).some((a) => /^-[A-Za-z]*[dDfmMcCu]/.test(a) || /^--(delete|force|move|copy|set-upstream|unset-upstream|edit-description)/.test(a))) return 'git branch changes a branch';
  return null;
}

// ---- outward ----------------------------------------------------------------------------------------------------

// A parked step that may reach outside the machine or the project, or cannot be undone. It keeps a finished run open.
export function isOutward(command, ctx) {
  const lexed = lex(String(command ?? ''));
  if (heldReason(lexed)) return true;
  let cwd = ctx.cwd;
  for (const part of lexed.parts) {
    const [verb, ...args] = part.words;
    if (!verb) return true;
    if (OUTWARD_VERBS.has(verb)) return true;
    if (readerWrites(verb, args)) return true;
    if (verb === 'git') {
      const sub = args.find((a) => !a.startsWith('-'));
      if (!sub || args[0]?.startsWith('-')) return true;
      // `git remote`, `-v` and `get-url` read .git/config only; `remote show` asks the remote, and the rest change it.
      if (sub === 'remote') {
        const rest = args.slice(1);
        const listing = rest.every((a) => a === '-v' || a === '--verbose');
        const getUrl = rest[0] === 'get-url' && rest.slice(1).every((a) => a === '--push' || a === '--all' || !a.startsWith('-')) && rest.length >= 2;
        if (!listing && !getUrl) return true;
        continue;
      }
      if (!LOCAL_GIT.has(sub)) return true;
      if (sub === 'stash' && args.includes('drop')) return true;
      if (sub === 'branch' && args.some((a) => /^-[dDmM]$/.test(a))) return true;
    }
    for (const a of args.flatMap((w) => (w.includes('=') ? [w, w.slice(w.indexOf('=') + 1)] : [w]))) {
      if (!looksLikePath(a) || /^-[^=]*=/.test(a)) continue;
      const t = realTarget(cwd, a);
      if (t.dangling || !within(t.real, realOr(ctx.workspace))) return true;
    }
    if (verb === 'cd' && args[0]) cwd = realOr(resolve(cwd, args[0]));
  }
  return false;
}

// ---- self-check split hint --------------------------------------------------------------------------------------

const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

function splitHint(command, lexed, ctx) {
  const shaped = lexed.parts.some((p) => p.op === ';' || p.op === '||') || lexed.parts.some((p) => p.redirects.some((r) => r.dup));
  if (!shaped) return null;
  if (/[`]/.test(command) || /\$(?!\?)/.test(command)) return null;
  if (lexed.flags.has('unpaired') || lexed.flags.has('glob') || lexed.flags.has('subshell')) return null;
  const pieces = [];
  for (const part of lexed.parts) {
    if (part.op === '|' || part.op === '&') return null;
    if (part.redirects.some((r) => !r.dup)) return null;
    const [verb, sub] = part.words;
    if (!verb) return null;
    const text = part.words.join(' ');
    const isCheck = ctx.doneCheck && norm(text) === norm(ctx.doneCheck);
    const isReader = (READERS.has(verb) || (verb === 'git' && READ_GIT.has(sub))) && !readerWrites(verb, part.words.slice(1));
    if (!isCheck && !isReader) return null;
    if (verb === 'echo' || verb === 'true' || verb === 'printf') continue;
    pieces.push(text);
  }
  if (!pieces.length) return null;
  return `run ${pieces.map((p) => `\`${p}\``).join(', then ')} as separate calls; run_command reports each exit code itself, so drop the \`;\`, \`||\`, \`echo $?\` and \`2>&1\` parts`;
}

// ---- run charter ------------------------------------------------------------------------------------------------

function gitDirOf(start) {
  let dir = start;
  for (;;) {
    const dot = join(dir, '.git');
    try {
      const st = lstatSync(dot);
      if (st.isDirectory()) return { root: dir, gitdir: dot };
      if (st.isFile()) {
        const m = /^gitdir:\s*(.+)\s*$/m.exec(readFileSync(dot, 'utf8'));
        if (m) return { root: dir, gitdir: resolve(dir, m[1].trim()) };
      }
    } catch { /* keep climbing */ }
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

export function currentBranch(cwd) {
  const g = gitDirOf(realOr(cwd));
  if (!g) return null;
  try {
    const head = readFileSync(join(g.gitdir, 'HEAD'), 'utf8').trim();
    const m = /^ref: refs\/heads\/(.+)$/.exec(head);
    return m ? { branch: m[1], root: realOr(g.root) } : { branch: null, root: realOr(g.root) };
  } catch {
    return null;
  }
}

const COMMIT_FLAGS = new Set(['-a', '-q', '--quiet', '--all']);

// True only for `git add <named files>` and `git commit -m/-F/-a/-q` parts, on the charter's branch in its repo.
export function charterAllows(command, ctx, charter) {
  if (!charter || !charter.branch || !charter.repo) return false;
  const lexed = lex(String(command ?? ''));
  if (heldReason(lexed)) return false;
  if (lexed.parts.some((p, i) => i > 0 && p.op !== '&&')) return false;
  let commits = 0;
  for (const part of lexed.parts) {
    const [verb, sub, ...rest] = part.words;
    if (verb !== 'git' || part.redirects.length) return false;
    if (sub === 'add') {
      if (partTier(part, ctx.cwd, ctx).tier !== 'B') return false;
      continue;
    }
    if (sub !== 'commit') return false;
    for (let i = 0; i < rest.length; i += 1) {
      const a = rest[i];
      if (a === '-m' || a === '-F' || a === '-am') { if (rest[i + 1] === undefined) return false; i += 1; continue; }
      if (COMMIT_FLAGS.has(a)) continue;
      return false;
    }
    commits += 1;
  }
  if (!commits) return false;
  const head = currentBranch(ctx.cwd);
  if (!head || head.branch !== charter.branch) return false;
  const repo = realOr(isAbsolute(charter.repo) ? charter.repo : resolve(ctx.workspace, charter.repo));
  return fold(head.root) === fold(repo);
}

// ---- classify ---------------------------------------------------------------------------------------------------

// A command longer than this is refused before it is read, so it is never stored or shown.
const MAX_COMMAND_BYTES = 4096;

export function classify(command, ctx) {
  const text = typeof command === 'string' ? command : '';
  if (Buffer.byteLength(text, 'utf8') > MAX_COMMAND_BYTES) return { tier: 'refused', reason: `it is longer than ${MAX_COMMAND_BYTES} bytes` };
  if (!text.trim()) return { tier: 'held', reason: 'it is empty' };
  const lexed = lex(text);
  const prot = findProtected(lexed, ctx);
  if (prot) return { tier: 'refused', reason: prot };
  const hint = splitHint(text, lexed, ctx);
  if (hint) return { tier: 'split', reason: hint };
  const held = heldReason(lexed);
  if (held) return { tier: 'held', reason: held };
  if (lexed.parts.some((p, i) => i > 0 && p.op !== '&&')) return { tier: 'X', reason: 'it chains with an operator other than &&' };
  let cwd = ctx.cwd;
  for (const part of lexed.parts) {
    const r = partTier(part, cwd, ctx);
    if (r.tier === 'refused') return { tier: 'refused', reason: r.why };
    if (r.tier !== 'B') {
      // Keep reading: a later part may still name something refused.
      for (const later of lexed.parts.slice(lexed.parts.indexOf(part) + 1)) {
        const l = partTier(later, r.cwd ?? cwd, ctx);
        if (l.tier === 'refused') return { tier: 'refused', reason: l.why };
      }
      return { tier: 'X', reason: r.why };
    }
    if (r.cwd) cwd = r.cwd;
  }
  return { tier: 'B', reason: 'local and undoable' };
}

export function stepContext(workspace, cwd, extra = {}) {
  let realCwd = cwd;
  try { if (statSync(cwd).isDirectory()) realCwd = realpathSync(cwd); } catch { realCwd = resolve(cwd); }
  return { workspace, cwd: realCwd, env: process.env, ...extra };
}
