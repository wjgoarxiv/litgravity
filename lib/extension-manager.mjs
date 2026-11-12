import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { paths } from './paths.mjs';
import { assertSafeWritePath } from './guard.mjs';
import { packageVersion, parseFrontmatter } from './bundle.mjs';
import { MOVED_SKILLS } from '../plugin/hooks/lib/routes.mjs';
import { EXTENSION_SHELF, oldRuntimeDir } from '../plugin/hooks/lib/extensions.mjs';

// `litgravity extensions <verb>`: the four install lines of the stubs, done in code. Look for every same-name skill agy
// could load, move an existing copy whole into a dated folder agy never scans, copy into the emptied place, write a
// receipt inside the copy. Every write waits for --yes; without it the verb prints what it would do.
//
// Writes go only to agy's skill folder for the scope (~/.gemini/config/skills or <workspace>/.agents/skills), to
// ~/.gemini/extension-backups, and to LitGravity's own source cache. Other folders are read, never written.

export const RECEIPT = '.litfamily-extension.json';
export const VARIANT = 'litgravity';
const CLI = 'npx @litfamily/litgravity extensions';

export function extensionPaths(env = process.env, cwd = process.cwd()) {
  const p = paths(env, cwd);
  const gemini = join(p.home, '.gemini');
  const cacheHome = env.XDG_CACHE_HOME || join(p.home, '.cache');
  return {
    env,
    home: p.home,
    cwd,
    data: p.data,
    userPlugin: p.userPlugin,
    projectPlugin: p.projectPlugin,
    roots: { user: join(gemini, 'config', 'skills'), project: join(cwd, '.agents', 'skills') },
    // The four folders agy 1.5.6 loads bare skills from, in the order it prefers them.
    scan: [join(cwd, '.agents', 'skills'), join(cwd, '_agents', 'skills'), join(gemini, 'config', 'skills'), join(gemini, 'skills')],
    backups: join(gemini, 'extension-backups'),
    cache: join(cacheHome, 'litgravity', 'extensions-src'),
    repo: env.LITGRAVITY_EXTENSIONS_REPO || `${EXTENSION_SHELF}.git`,
  };
}

const lstat = (p) => { try { return lstatSync(p); } catch { return null; } };
const tilde = (x, home) => (x === home || x.startsWith(`${home}${sep}`) ? `~${x.slice(home.length)}` : x);

function skillName(dir) {
  try {
    return parseFrontmatter(readFileSync(join(dir, 'SKILL.md'), 'utf8')).name ?? null;
  } catch {
    return null;
  }
}

export function readReceipt(dir) {
  try {
    const r = JSON.parse(readFileSync(join(dir, RECEIPT), 'utf8'));
    return r && typeof r === 'object' && r.variant === VARIANT ? r : null;
  } catch {
    return null;
  }
}

/** One hash over every file of a skill folder (paths and bytes), the receipt left out. */
export function treeHash(dir) {
  const h = createHash('sha256');
  let files = 0;
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      const rel = relative(dir, full).split(sep).join('/');
      if (rel === RECEIPT || name === '.git') continue;
      const st = lstatSync(full);
      if (st.isDirectory()) walk(full);
      else {
        h.update(`${rel}\0`);
        h.update(st.isSymbolicLink() ? `link:${readlinkSync(full)}` : readFileSync(full));
        h.update('\0');
        files += 1;
      }
    }
  };
  walk(dir);
  return { hash: `sha256:${h.digest('hex')}`, files };
}

function dirBytes(dir) {
  let total = 0;
  const walk = (d) => {
    let names = [];
    try { names = readdirSync(d); } catch { return; }
    for (const name of names) {
      const st = lstat(join(d, name));
      if (!st) continue;
      if (st.isDirectory()) walk(join(d, name));
      else total += st.size;
    }
  };
  walk(dir);
  return total;
}

export const human = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

/** Where one id stands at one scope: absent, link, not-a-folder, installed (with receipt) or user-managed. */
export function destState(ep, id, scope) {
  const dest = join(ep.roots[scope], id);
  const st = lstat(dest);
  if (!st) return { state: 'absent', dest };
  if (st.isSymbolicLink()) return { state: 'link', dest };
  if (!st.isDirectory()) return { state: 'not-a-folder', dest };
  const receipt = readReceipt(dest);
  return receipt ? { state: 'installed', dest, receipt } : { state: 'user-managed', dest };
}

/** Every SKILL.md named `id` in the folders agy loads, a `<id>.bak` sibling included. */
export function sameNameSkills(ep, id) {
  const hits = [];
  const seen = new Set();
  for (const folder of ep.scan) {
    if (seen.has(folder)) continue;
    seen.add(folder);
    let names = [];
    try { names = readdirSync(folder); } catch { continue; }
    for (const name of names.sort()) {
      const dir = join(folder, name);
      if (skillName(dir) === id) hits.push({ path: dir, folder, receipt: Boolean(readReceipt(dir)) });
    }
  }
  return hits;
}

// A link anywhere between the scope's anchor (HOME or the workspace) and the target sends bytes somewhere else.
function linkOnPath(target, anchor) {
  let cur = target;
  while (cur.startsWith(anchor) && cur !== anchor) {
    const st = lstat(cur);
    if (st?.isSymbolicLink()) return cur;
    cur = dirname(cur);
  }
  return null;
}

function stampNow(date = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${z(date.getMonth() + 1)}${z(date.getDate())}-${z(date.getHours())}${z(date.getMinutes())}${z(date.getSeconds())}`;
}

function backupDir(ep, scope, ids, stamp = stampNow()) {
  const base = `${stamp}${scope === 'project' ? '-project' : ''}`;
  for (let n = 1; ; n += 1) {
    const dir = join(ep.backups, n === 1 ? base : `${base}-${n}`);
    if (!ids.some((id) => existsSync(join(dir, id)))) return dir;
  }
}

function git(env, args) {
  const r = spawnSync('git', args, { encoding: 'utf8', timeout: 180000, env: { ...env, GIT_TERMINAL_PROMPT: '0' } });
  if (r.error?.code === 'ENOENT') return { ok: false, missing: true, text: 'git was not found on PATH' };
  const text = `${r.stderr ?? ''}${r.stdout ?? ''}`.trim().split('\n').filter(Boolean).slice(-2).join(' / ');
  return { ok: r.status === 0, stdout: (r.stdout ?? '').trim(), text: text || (r.error ? r.error.message : `exit ${r.status}`) };
}

const fromHint = (verb) => `Nothing was installed. With a clone you already have: ${CLI} ${verb} … --from <path to your wjgoarxiv-skills clone>`;

/**
 * The folder that holds variants/litgravity/<id>. `--from` is the user's own clone, read only. Otherwise LitGravity
 * keeps a shallow, sparse clone of only variants/litgravity in its cache; a write verb with --yes clones it once and
 * `update` fetches it. A dry run never touches the network.
 */
function resolveSource(ep, flags, { refresh, write, verb }) {
  if (flags.from) {
    const root = resolve(ep.cwd, flags.from);
    if (!existsSync(join(root, 'variants', VARIANT))) return { error: `${root} has no variants/${VARIANT}/ folder; point --from at a wjgoarxiv-skills clone.` };
    return { root, label: `${root} (--from)` };
  }
  const cache = ep.cache;
  const label = (extra = '') => `${cache} (LitGravity's clone of ${ep.repo}${extra})`;
  const have = existsSync(join(cache, '.git'));
  const pending = [
    `git clone --depth 1 --filter=blob:none --sparse ${ep.repo} ${cache}`,
    `git -C ${cache} sparse-checkout set variants/${VARIANT}`,
  ];
  if (!have && !write) return { pending, label: label(', not cloned yet') };
  const bad = linkOnPath(cache, ep.home);
  if (bad) return { error: `${bad} is a symbolic link; LitGravity keeps its source clone only in a real folder.` };
  if (!have) {
    const tmp = `${cache}.tmp-${process.pid}`;
    mkdirSync(dirname(cache), { recursive: true });
    const done = (r) => { rmSync(tmp, { recursive: true, force: true }); return r; };
    let r = git(ep.env, ['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--sparse', '--no-tags', ep.repo, tmp]);
    if (r.ok) r = git(ep.env, ['-C', tmp, 'sparse-checkout', 'set', `variants/${VARIANT}`]);
    if (!r.ok) return done({ error: `could not fetch the extension source (${r.text}). ${r.missing ? 'Install git, or use --from.' : 'Offline? Try again online.'}\n${fromHint(verb)}` });
    renameSync(tmp, cache);
  } else if (refresh && write) {
    let r = git(ep.env, ['-C', cache, 'fetch', '--quiet', '--depth', '1', 'origin', 'HEAD']);
    if (r.ok) r = git(ep.env, ['-C', cache, 'checkout', '--quiet', '--detach', 'FETCH_HEAD']);
    if (!r.ok) return { error: `could not refresh ${cache} (${r.text}). Nothing changed.\n${fromHint(verb)}` };
  }
  const commit = git(ep.env, ['-C', cache, 'rev-parse', '--short', 'HEAD']);
  return { root: cache, commit: commit.ok ? commit.stdout : null, label: label(commit.ok ? `, ${commit.stdout}` : ''), refreshed: refresh && write };
}

function pickIds(args, flags) {
  if (flags.all) return { ids: Object.keys(MOVED_SKILLS) };
  if (flags.family) {
    const ids = Object.keys(MOVED_SKILLS).filter((id) => MOVED_SKILLS[id] === flags.family);
    if (!ids.length) return { error: `no family ${flags.family}; the families are ${[...new Set(Object.values(MOVED_SKILLS))].join(', ')}` };
    return { ids };
  }
  const unknown = args.filter((id) => !MOVED_SKILLS[id]);
  if (unknown.length) return { error: `not a LitGravity extension: ${unknown.join(', ')}. The ids are ${Object.keys(MOVED_SKILLS).join(', ')}.` };
  return { ids: [...new Set(args)] };
}

function writeReceipt(dir, src, root, commit, scope, { hash, files }) {
  const receipt = {
    id: basename(src), source: src, variant: VARIANT, installed_at: new Date().toISOString(),
    scope, hash, files, ...(commit ? { source_commit: commit } : {}), installed_by: `litgravity ${packageVersion()}`,
  };
  writeFileSync(join(dir, RECEIPT), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

// Plans one copy. A link or a non-folder destination, a missing source and another same-name skill agy loads are
// problems that stop the whole run before any write; --allow-shadow turns the last kind into a warning.
function planCopy(ep, id, scope, src, allowShadow) {
  const st = destState(ep, id, scope);
  const anchor = scope === 'user' ? ep.home : ep.cwd;
  const problems = [];
  const warnings = [];
  const bad = linkOnPath(ep.roots[scope], anchor) || linkOnPath(ep.backups, ep.home) || linkOnPath(stagingRoot(ep, scope), anchor);
  if (bad) problems.push(`${bad} is a symbolic link; LitGravity writes only into real folders`);
  try { assertSafeWritePath(st.dest); } catch (err) { problems.push(err.message); }
  if (st.state === 'link' || st.state === 'not-a-folder') {
    problems.push(`${st.dest} is ${st.state === 'link' ? 'a symbolic link' : 'not a folder'}; move it aside by hand first: b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S); mkdir -p "$b" && mv "${st.dest}" "$b/"`);
  }
  if (!existsSync(join(src, 'SKILL.md'))) problems.push(`the source has no ${id}: ${src}/SKILL.md is missing`);
  for (const hit of sameNameSkills(ep, id).filter((h) => h.path !== st.dest)) {
    const line = `another skill named ${id} at ${hit.path}; agy keeps one same-name skill without a word`;
    if (allowShadow) warnings.push(line);
    else problems.push(`${line}. Move it aside or rename it, or rerun with --allow-shadow to install anyway`);
  }
  return { id, scope, src, st, problems, warnings };
}

function printPlan(plan, ep, print) {
  print(`${plan.id}${plan.reason ? ` (${plan.reason})` : ''}`);
  for (const w of plan.warnings) print(`  WARN     ${w}`);
  if (plan.problems.length) {
    for (const x of plan.problems) print(`  STOP     ${x}`);
    return;
  }
  print('  check    no other same-name skill in the folders agy loads' + (plan.warnings.length ? ' (except the ones above, allowed)' : ''));
  if (plan.st.state !== 'absent') {
    const what = plan.st.state === 'installed' ? 'the installed copy' : 'a folder without a receipt, kept whole';
    print(`  move     ${tilde(plan.st.dest, ep.home)} -> ${tilde(plan.backup, ep.home)}/${plan.id} (${what})`);
  }
  print(`  copy     ${plan.src} -> ${tilde(plan.st.dest, ep.home)}`);
  print(`  receipt  ${tilde(join(plan.st.dest, RECEIPT), ep.home)}`);
}

// The staging folder sits outside every folder agy loads, on the same disk as the destination, so a copy cut short by
// Ctrl-C or a crash never shows up as a second same-name skill: under the backups for user scope, beside skills/ for a
// workspace.
const stagingRoot = (ep, scope) => (scope === 'user' ? join(ep.backups, '.staging') : join(ep.cwd, '.agents', '.litgravity-staging'));

// Copy into the staging folder first, so a failed copy changes nothing; then move the old copy aside and put the new
// one in its place. If that last rename fails, the old copy goes back.
function applyCopy(plan, source, ep) {
  const { st, src } = plan;
  const staging = stagingRoot(ep, plan.scope);
  mkdirSync(dirname(st.dest), { recursive: true });
  mkdirSync(staging, { recursive: true });
  const tmp = join(staging, `${plan.id}-${process.pid}`);
  try {
    cpSync(src, tmp, { recursive: true, verbatimSymlinks: true, errorOnExist: true, force: false, filter: (s) => basename(s) !== RECEIPT && basename(s) !== '.git' });
    writeReceipt(tmp, src, source.root, source.commit, plan.scope, treeHash(src));
    let moved = null;
    if (lstat(st.dest)) {
      mkdirSync(plan.backup, { recursive: true });
      moved = join(plan.backup, plan.id);
      renameSync(st.dest, moved);
    }
    try {
      renameSync(tmp, st.dest);
    } catch (err) {
      if (moved) {
        try { renameSync(moved, st.dest); } catch { err.keptAt = moved; }
      }
      throw err;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    try { rmdirSync(staging); } catch { /* not empty, or gone */ }
  }
}

function header(print, verb, scope, ep) {
  print(`LitGravity extensions ${verb} · ${scope} scope (${tilde(ep.roots[scope], ep.home)})`);
}

const doneNote = 'Start a new agy conversation, or type /skills reload, to pick the change up.';

async function runCopies({ ep, flags, scope, plans, source, print, verb }) {
  const stopped = plans.filter((x) => x.problems.length);
  for (const plan of plans) printPlan(plan, ep, print);
  if (stopped.length) {
    print('');
    print(`Stopped before writing anything: ${stopped.map((x) => x.id).join(', ')} need${stopped.length === 1 ? 's' : ''} attention (see STOP above).`);
    return 1;
  }
  if (!flags.yes || flags.dryRun) {
    print('');
    print(`Dry run: nothing written. Add --yes to ${verb} ${plans.length === 1 ? 'it' : `these ${plans.length}`}.`);
    return 0;
  }
  const done = [];
  for (const plan of plans) {
    try {
      applyCopy(plan, source, ep);
    } catch (err) {
      print(`FAIL ${plan.id}: ${err.code === 'EXDEV' ? `${plan.st.dest} and ${ep.backups} are on different disks, so the old copy cannot be moved; move it aside by hand` : err.message}`);
      print(err.keptAt ? `${plan.id} is not installed now; the old copy is in ${err.keptAt}.` : `${plan.id} is unchanged.`);
      if (done.length) print(`Already done: ${done.join(', ')}, each with a receipt.`);
      return 1;
    }
    done.push(plan.id);
  }
  print('');
  print(`Done: ${plans.map((x) => x.id).join(', ')} at ${scope} scope, each with a receipt.${plans.some((x) => x.st.state !== 'absent') ? ` Earlier copies are in ${tilde(plans.find((x) => x.backup && x.st.state !== 'absent').backup, ep.home)}.` : ''}`);
  print(doneNote);
  return 0;
}

async function install({ ep, args, flags, scope, print }) {
  const pick = pickIds(args, flags);
  if (pick.error || !pick.ids.length) {
    print(pick.error ?? `Name one or more ids, --family <name> or --all. The ids are ${Object.keys(MOVED_SKILLS).join(', ')}.`);
    return 2;
  }
  header(print, 'install', scope, ep);
  const source = resolveSource(ep, flags, { refresh: false, write: flags.yes && !flags.dryRun, verb: 'install' });
  if (source.error) { print(`FAIL ${source.error}`); return 1; }
  print(`source   ${source.label}`);
  if (source.pending) {
    print('');
    for (const id of pick.ids) {
      const st = destState(ep, id, scope);
      const others = sameNameSkills(ep, id).filter((h) => h.path !== st.dest);
      print(`${id}: destination ${st.state === 'absent' ? 'free' : `${st.state}, moved aside first`}${others.length ? `; another same-name skill at ${others.map((h) => h.path).join(', ')} stops the install` : ''}`);
    }
    print('');
    print('Dry run: the source is not cloned yet. With --yes LitGravity first runs:');
    for (const line of source.pending) print(`  ${line}`);
    print('then checks, moves aside, copies and writes a receipt as above.');
    return 0;
  }
  print('');
  const backup = backupDir(ep, scope, pick.ids);
  const plans = pick.ids.map((id) => ({ ...planCopy(ep, id, scope, join(source.root, 'variants', VARIANT, id), flags.allowShadow), backup }));
  return runCopies({ ep, flags, scope, plans, source, print, verb: 'install' });
}

async function update({ ep, args, flags, scope, print }) {
  const pick = args.length || flags.family ? pickIds(args, flags) : { ids: Object.keys(MOVED_SKILLS).filter((id) => destState(ep, id, scope).state === 'installed') };
  if (pick.error) { print(pick.error); return 2; }
  header(print, 'update', scope, ep);
  if (!pick.ids.length) {
    print(`No extension with a LitGravity receipt at ${scope} scope. Install one with: ${CLI} install <id>${scope === 'project' ? ' --project' : ''}`);
    return 0;
  }
  const source = resolveSource(ep, flags, { refresh: true, write: flags.yes && !flags.dryRun, verb: 'update' });
  if (source.error) { print(`FAIL ${source.error}`); return 1; }
  print(`source   ${source.label}${source.root && !source.refreshed && !flags.from ? ' (a dry run compares with the cached copy without fetching; --yes fetches first, so the result may differ)' : ''}`);
  if (source.pending) {
    print('');
    print('Dry run: the source is not cloned yet, so nothing was compared. With --yes LitGravity first runs:');
    for (const line of source.pending) print(`  ${line}`);
    print('then compares each extension with the fetched copy.');
    return 0;
  }
  print('');
  const backup = backupDir(ep, scope, pick.ids);
  const plans = [];
  const receiptOnly = [];
  let refused = 0;
  for (const id of pick.ids) {
    const st = destState(ep, id, scope);
    const src = join(source.root, 'variants', VARIANT, id);
    if (st.state === 'absent') { print(`${id}: not installed at ${scope} scope; install it with ${CLI} install ${id}`); if (args.length) refused += 1; continue; }
    if (st.state !== 'installed') {
      print(`${id}: ${st.dest} has no LitGravity receipt, so update leaves it alone. ${CLI} install ${id} --yes moves it aside and installs a copy with a receipt.`);
      refused += 1;
      continue;
    }
    if (!existsSync(join(src, 'SKILL.md'))) { print(`${id}: the source has no ${id} (${src}); nothing changed`); refused += 1; continue; }
    const want = treeHash(src).hash;
    const have = st.receipt.hash ?? treeHash(st.dest).hash;
    if (want === have) {
      if (st.receipt.source !== src) receiptOnly.push({ id, st, src });
      print(`${id}: current${st.receipt.source !== src ? ` (the receipt names ${st.receipt.source}; it will name ${src})` : ''}`);
      continue;
    }
    plans.push({ ...planCopy(ep, id, scope, src, flags.allowShadow), backup, reason: 'the source changed' });
  }
  const write = flags.yes && !flags.dryRun;
  // Receipts change only after every planned copy went through; a STOP or a failed copy leaves them as they were.
  const code = plans.length ? await runCopies({ ep, flags, scope, plans, source, print, verb: 'update' }) : 0;
  if (code) return code;
  if (write) {
    for (const { st, src } of receiptOnly) {
      const file = join(st.dest, RECEIPT);
      const r = JSON.parse(readFileSync(file, 'utf8'));
      writeFileSync(`${file}.tmp-${process.pid}`, `${JSON.stringify({ ...r, source: src, ...(source.commit ? { source_commit: source.commit } : {}) }, null, 2)}\n`);
      renameSync(`${file}.tmp-${process.pid}`, file);
    }
  } else if (receiptOnly.length && !plans.length) print('Dry run: add --yes to rewrite those receipts.');
  return refused ? 1 : 0;
}

async function remove({ ep, args, flags, scope, print }) {
  const pick = pickIds(args, flags);
  if (pick.error || !pick.ids.length) { print(pick.error ?? 'Name the ids to remove.'); return 2; }
  header(print, 'remove', scope, ep);
  const backup = backupDir(ep, scope, pick.ids);
  const moves = [];
  let refused = 0;
  for (const id of pick.ids) {
    const st = destState(ep, id, scope);
    if (st.state === 'absent') { print(`${id}: not installed at ${scope} scope`); continue; }
    if (st.state !== 'installed') {
      print(`${id}: refused. ${st.dest} ${st.state === 'link' ? 'is a symbolic link' : st.state === 'not-a-folder' ? 'is not a folder' : 'has no LitGravity receipt'}, so it is yours to keep or move; LitGravity removes only copies it installed.`);
      refused += 1;
      continue;
    }
    const bad = linkOnPath(ep.backups, ep.home);
    if (bad) { print(`${id}: refused. ${bad} is a symbolic link.`); refused += 1; continue; }
    print(`${id}`);
    print(`  move     ${tilde(st.dest, ep.home)} -> ${tilde(backup, ep.home)}/${id} (nothing is deleted)`);
    moves.push({ id, st });
  }
  if (moves.length && (!flags.yes || flags.dryRun)) {
    print('');
    print('Dry run: nothing moved. Add --yes to move them.');
    return refused ? 1 : 0;
  }
  for (const { id, st } of moves) {
    try {
      mkdirSync(backup, { recursive: true });
      renameSync(st.dest, join(backup, id));
    } catch (err) {
      print(`FAIL ${id}: ${err.message}`);
      return 1;
    }
  }
  if (moves.length) {
    print('');
    print(`Moved to ${tilde(backup, ep.home)}. ${doneNote} Clear old backups with: ${CLI} prune-backups`);
  }
  return refused ? 1 : 0;
}

export function listBackups(ep) {
  let names = [];
  try { names = readdirSync(ep.backups); } catch { return []; }
  return names.sort().map((name) => {
    const dir = join(ep.backups, name);
    const st = lstat(dir);
    const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(name);
    const at = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : st?.mtime;
    let ids = [];
    try { ids = st?.isDirectory() ? readdirSync(dir) : []; } catch { /* unreadable */ }
    return { name, dir, real: Boolean(st?.isDirectory() && !st.isSymbolicLink()), at, ids, bytes: st?.isDirectory() ? dirBytes(dir) : st?.size ?? 0 };
  });
}

async function pruneBackups({ ep, flags, print }) {
  const given = Object.hasOwn(flags, 'olderThan');
  if (given && !/^\d+(\.\d+)?$/.test(flags.olderThan ?? '')) { print('--older-than takes a number of days'); return 2; }
  const days = given ? Number(flags.olderThan) : null;
  print(`LitGravity extensions prune-backups · ${tilde(ep.backups, ep.home)}`);
  const bad = lstat(ep.backups)?.isSymbolicLink() ? ep.backups : linkOnPath(ep.backups, ep.home);
  if (bad) { print(`FAIL ${bad} is a symbolic link; nothing deleted.`); return 1; }
  const all = listBackups(ep);
  if (!all.length) { print('No backups.'); return 0; }
  const cutoff = days === null ? Infinity : Date.now() - days * 86400000;
  let total = 0;
  const chosen = [];
  for (const b of all) {
    const pick = b.real && (days === null || (b.at && b.at.getTime() < cutoff));
    print(`  ${pick ? 'delete' : 'keep  '}  ${b.name}  ${human(b.bytes)}  ${b.ids.join(', ')}${b.real ? '' : ' (not a real folder; left alone)'}`);
    if (pick) { chosen.push(b); total += b.bytes; }
  }
  print(`${all.length} backup folder${all.length === 1 ? '' : 's'}, ${human(all.reduce((s, b) => s + b.bytes, 0))} in all.`);
  if (!chosen.length) { print('Nothing to delete.'); return 0; }
  if (!flags.yes || flags.dryRun) {
    print(`Dry run: would delete ${chosen.length} folder${chosen.length === 1 ? '' : 's'} (${human(total)}). Add --yes to delete ${chosen.length === 1 ? 'it' : 'them'}.`);
    return 0;
  }
  for (const b of chosen) {
    if (dirname(b.dir) !== ep.backups || !lstat(b.dir)?.isDirectory()) continue;
    rmSync(b.dir, { recursive: true, force: true });
  }
  print(`Deleted ${chosen.length} folder${chosen.length === 1 ? '' : 's'} (${human(total)}) inside ${tilde(ep.backups, ep.home)}.`);
  return 0;
}

/** Read-only: what each id looks like at both scopes, with every same-name skill agy could load instead. */
export function extensionRows(ep) {
  return Object.entries(MOVED_SKILLS).map(([id, family]) => {
    const hits = sameNameSkills(ep, id);
    const scopes = {};
    for (const scope of ['user', 'project']) {
      const st = destState(ep, id, scope);
      scopes[scope] = { state: st.state, path: st.dest, ...(st.receipt ? { variant: st.receipt.variant, installed_at: st.receipt.installed_at, source: st.receipt.source } : {}) };
    }
    const live = hits[0]?.path ?? null;
    const competing = hits.filter((h) => h.path !== scopes.user.path && h.path !== scopes.project.path).map((h) => h.path);
    return { id, family, ...scopes, competing, loads: live };
  });
}

/** Read-only findings. `action` ones make check exit 1; each carries the exact line that fixes it. */
export function checkFindings(ep) {
  const out = [];
  const action = (text, fix) => out.push({ level: 'action', text, fix });
  const info = (text, fix) => out.push({ level: 'info', text, ...(fix ? { fix } : {}) });
  const moveLine = (path) => `b=~/.gemini/extension-backups/$(date +%Y%m%d-%H%M%S)-manual; mkdir -p "$b" && mv "${path}" "$b/"`;
  for (const id of Object.keys(MOVED_SKILLS)) {
    for (const scope of ['user', 'project']) {
      const st = destState(ep, id, scope);
      const flag = scope === 'project' ? ' --project' : '';
      if (st.state === 'link' || st.state === 'not-a-folder') action(`${id}: ${st.dest} is ${st.state === 'link' ? 'a symbolic link' : 'not a folder'}`, moveLine(st.dest));
      else if (st.state === 'user-managed') action(`${id}: ${st.dest} has no receipt (an older or hand-made copy)`, `${CLI} install ${id}${flag} --yes`);
      else if (st.state === 'installed' && st.receipt.source && !existsSync(st.receipt.source)) action(`${id}: the receipt's source ${st.receipt.source} no longer exists`, `${CLI} update ${id}${flag} --yes`);
    }
    const hits = sameNameSkills(ep, id);
    if (hits.length > 1) {
      const keep = hits.find((h) => h.receipt) ?? hits[0];
      for (const h of hits.filter((x) => x !== keep)) {
        action(`${id}: two same-name skills agy loads, ${keep.path} and ${h.path}; agy keeps one without a word${hits[0] !== keep ? `, and ${hits[0].path} wins` : ''}`, moveLine(h.path));
      }
    }
  }
  const backups = listBackups(ep);
  if (backups.length) info(`${backups.length} backup folder${backups.length === 1 ? '' : 's'} in ${tilde(ep.backups, ep.home)}, ${human(backups.reduce((s, b) => s + b.bytes, 0))} in all`, `${CLI} prune-backups --older-than 30`);
  for (const plugin of [ep.userPlugin, ep.projectPlugin]) {
    for (const id of Object.keys(MOVED_SKILLS)) {
      const file = join(plugin, 'skills', id, 'SKILL.md');
      let text = null;
      try { text = readFileSync(file, 'utf8'); } catch { continue; }
      if (!text.includes('wjgoarxiv-skills')) {
        action(`${file} is the full skill from LitGravity 0.1.8 or earlier, where the current release has a stub`, `npx @litfamily/litgravity@latest install${plugin === ep.projectPlugin ? ' --scope project' : ''} --yes`);
        break;
      }
    }
  }
  try {
    const flag = JSON.parse(readFileSync(join(ep.data, 'extensions-notice.json'), 'utf8'));
    if (flag.shown === false) info('the extensions note from the last LitGravity install waits for the next agy conversation');
  } catch { /* no notice queued */ }
  const runtime = oldRuntimeDir(ep.data);
  if (existsSync(runtime)) info(`${runtime} holds engines cached by LitGravity 0.1.8 or earlier; nothing reads it now`, `rm -rf "${runtime}"`);
  return out;
}

function listCmd({ ep, flags, print }) {
  const rows = extensionRows(ep);
  if (flags.json) {
    print(JSON.stringify({ product: 'litgravity', extensions: rows, backups: ep.backups, cache: ep.cache }, null, 2));
    return 0;
  }
  const label = (s) => (s.state === 'installed' ? `installed ${s.installed_at ?? ''} from ${s.source ?? '?'}` : s.state === 'absent' ? 'not installed' : s.state);
  print(`LitGravity extensions (${Object.keys(MOVED_SKILLS).length}, from ${EXTENSION_SHELF})`);
  for (const r of rows) {
    print(`${r.id} [${r.family}]`);
    print(`  user     ${label(r.user)}`);
    if (r.project.state !== 'absent') print(`  project  ${label(r.project)}`);
    for (const c of r.competing) print(`  ${c === r.loads ? 'shadowed' : 'competing'} by ${c}`);
    if (!r.competing.length && r.user.state !== 'absent' && r.project.state !== 'absent') print(`  note     both scopes hold a copy; agy loads ${r.loads}`);
  }
  print(`Install with: ${CLI} install <id> [--project] (a dry run; add --yes)`);
  return 0;
}

function checkCmd({ ep, flags, print }) {
  const found = checkFindings(ep);
  const actions = found.filter((f) => f.level === 'action');
  if (flags.json) {
    print(JSON.stringify({ product: 'litgravity', ok: !actions.length, findings: found }, null, 2));
    return actions.length ? 1 : 0;
  }
  print('LitGravity extensions check (read only)');
  for (const f of found) {
    print(`${f.level === 'action' ? 'ACTION' : 'INFO  '} ${f.text}`);
    if (f.fix) print(`       fix: ${f.fix}`);
  }
  print(actions.length ? `${actions.length} thing${actions.length === 1 ? '' : 's'} need${actions.length === 1 ? 's' : ''} action; nothing was changed.` : 'Clean: nothing needs action.');
  return actions.length ? 1 : 0;
}

export const EXTENSION_HELP = `Usage: litgravity extensions <verb> [options]

LitGravity installs the LitFamily extensions (the nine skills that make files) from wjgoarxiv-skills into agy's
skill folders. It checks for other same-name skills first, moves an existing copy whole into
~/.gemini/extension-backups/<date>/, copies the skill in and writes a receipt (${RECEIPT}).
Every verb that writes is a dry run until you add --yes. Nothing is ever deleted except by prune-backups --yes.

Verbs
  list                     Each extension: not installed, installed (receipt), user-managed, or competing (--json)
  check                    Read only: duplicates, copies without a receipt, missing sources, backups; exit 1 if any need action
  install <id...>          Also --family <name> or --all
  update [<id...>]         Fetch the source, reinstall each installed extension whose files changed
  remove <id...>           Move a copy LitGravity installed into the backups; a folder without a receipt is refused
  prune-backups            List backups with sizes; --older-than <days> picks old ones; --yes deletes

Options
  --yes              Do it (otherwise print what would happen)
  --project          ./.agents/skills in this workspace (default: ~/.gemini/config/skills, every workspace)
  --from <path>      Use a wjgoarxiv-skills clone you have (default: LitGravity's own clone in ~/.cache/litgravity)
  --allow-shadow     Install even when another same-name skill exists (it stays; a warning is printed)
  --json             list and check`;

export async function extensions({ env = process.env, args = [], flags = {}, cwd = process.cwd(), print = console.log }) {
  const [verb, ...rest] = args;
  const ep = extensionPaths(env, cwd);
  const scope = flags.scope === 'project' || flags.project ? 'project' : 'user';
  const ctx = { ep, args: rest, flags, scope, print };
  switch (verb) {
    case 'list': return listCmd(ctx);
    case 'check': return checkCmd(ctx);
    case 'install': return install(ctx);
    case 'update': return update(ctx);
    case 'remove': return remove(ctx);
    case 'prune-backups': return pruneBackups(ctx);
    case undefined:
    case 'help': print(EXTENSION_HELP); return 0;
    default: print(`Unknown extensions verb: ${verb}\n\n${EXTENSION_HELP}`); return 2;
  }
}
