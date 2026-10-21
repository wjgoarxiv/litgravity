#!/usr/bin/env node
// Mechanical checks for a lit-comprehend explainer (LitGravity, agy).
//
//   node verify-explainer.mjs <artifact.html|artifact.md> [--repo <dir>] [--json]
//
// The prose in an explainer can promise accuracy; this script measures the part
// a machine can measure. The defects it hunts are the ones that leave a reader
// confidently wrong: a code excerpt attributed to a file that never held those
// lines, a cited path that does not exist, a page that quietly needs the
// network, code collapsed onto one line by CSS, and a quiz whose answer key can
// be guessed from option position or length.
//
// Exit codes: 0 no FAIL finding (WARN is advisory), 1 at least one FAIL,
// 2 usage error or a refused input (missing argument, symlinked artifact).
// The script reads files only; it writes nothing and never touches the network.

import { readFileSync, existsSync, statSync, lstatSync } from 'node:fs';
import { resolve, relative, basename, extname, isAbsolute, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const jsonOut = argv.includes('--json');
const repoIdx = argv.indexOf('--repo');
if (repoIdx >= 0 && !argv[repoIdx + 1]) usage('--repo needs a directory');
const positional = argv.filter((a, i) => !a.startsWith('--') && !(repoIdx >= 0 && i === repoIdx + 1));
if (positional.length !== 1) usage('exactly one artifact path is required');
const repoRoot = resolve(repoIdx >= 0 ? argv[repoIdx + 1] : '.');
const artifactPath = resolve(positional[0]);

function usage(msg) {
  console.error(`verify-explainer: ${msg}`);
  console.error('usage: node verify-explainer.mjs <artifact.html|artifact.md> [--repo <dir>] [--json]');
  process.exit(2);
}

const findings = [];
const fail = (check, detail) => findings.push({ level: 'FAIL', check, detail });
const warn = (check, detail) => findings.push({ level: 'WARN', check, detail });
const checksRun = new Set();
const ran = (name) => { checksRun.add(name); };

// ------------------------------------------------------------------ load

ran('artifact-exists');
if (!existsSync(artifactPath)) {
  fail('artifact-exists', `no file at ${artifactPath}`);
  report();
}
if (lstatSync(artifactPath).isSymbolicLink()) {
  console.error(`verify-explainer: refusing symlinked artifact ${artifactPath}; pass the real file`);
  process.exit(2);
}
if (!statSync(artifactPath).isFile()) usage(`${artifactPath} is not a regular file`);

const original = readFileSync(artifactPath, 'utf8');
const ext = extname(artifactPath).toLowerCase();
const isHtml = ext === '.html' || ext === '.htm';
const isMd = ext === '.md' || ext === '.markdown';
if (!isHtml && !isMd) usage(`unsupported extension "${ext}"; expected .html or .md`);

// Check the document and leave its commentary alone. An HTML comment, a CSS
// comment or a whole-line JavaScript comment that mentions fetch( or shows sample quiz markup
// documents the rules; flagging it would push authors to delete the notes that
// keep the scaffold usable.
const raw = original
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (m, body) =>
    m.replace(body, () => body.replace(/\/\*[\s\S]*?\*\//g, '')))
  .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (m, body) =>
    m.replace(body, () => body.replace(/^[ \t]*\/\/.*$/gm, '')));

ran('artifact-nonempty');
if (raw.trim().length < 400) fail('artifact-nonempty', `only ${raw.trim().length} bytes of content; an explainer needs real sections`);

ran('placeholders-filled');
const leftovers = [...new Set(raw.match(/__(TITLE|SUBTITLE|TOC|CONTENT|LANG)__/g) || [])];
if (leftovers.length) fail('placeholders-filled', `scaffold placeholder(s) still present: ${leftovers.join(', ')}`);

// ---------------------------------------------------- naming and location

ran('filename-dated');
if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*\.(html?|md|markdown)$/i.test(basename(artifactPath))) {
  fail('filename-dated', `basename "${basename(artifactPath)}" must look like YYYY-MM-DD-<slug>.html so the folder stays time-sorted`);
}

ran('outside-tracked-tree');
const rel = relative(repoRoot, artifactPath);
const insideRepo = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
const relPosix = rel.split(sep).join('/');
if (insideRepo) {
  if (!/^\.litgravity\//.test(relPosix)) {
    fail('outside-tracked-tree', `artifact sits in the repo at ${relPosix}; it would show up in a diff or a commit. Write it under .litgravity/drafts/comprehend/ or a path the user named outside the repo`);
  } else {
    // .litgravity/ is local working state. Confirm git agrees when git is available.
    const probe = spawnSync('git', ['-C', repoRoot, 'check-ignore', '-q', '--', relPosix], { encoding: 'utf8' });
    if (probe.error) {
      warn('outside-tracked-tree', 'git is not available, so the ignore status of .litgravity/ was not checked');
    } else if (probe.status === 1) {
      const tracked = spawnSync('git', ['-C', repoRoot, 'ls-files', '--error-unmatch', '--', relPosix], { encoding: 'utf8' });
      if (tracked.status === 0) {
        fail('outside-tracked-tree', `${relPosix} is tracked by git; an explainer is working state and must stay out of commits`);
      } else {
        warn('outside-tracked-tree', `${relPosix} is not git-ignored; it shows as untracked. Suggest adding .litgravity/ to .gitignore, and never git add it`);
      }
    }
    // status 128 means "not a git repository": nothing to protect.
  }
}

// --------------------------------------------------------- self-contained

ran('self-contained');
const externalPatterns = [
  [/<script[^>]+\bsrc\s*=\s*["']?(?!data:)[^"'>\s]+/i, '<script src> (every script must be inline)'],
  [/<link[^>]+\bhref\s*=\s*["']?[^"'>]*\/\/[^"'>]*["']?[^>]*\brel\s*=\s*["']?(stylesheet|preload|modulepreload)/i, 'external <link>'],
  [/<link[^>]+\brel\s*=\s*["']?(stylesheet|preload|modulepreload)[^>]*\bhref\s*=\s*["']?[^"'>]*\/\//i, 'external <link>'],
  [/<(img|iframe|video|audio|source|embed|object)[^>]+\b(src|data)\s*=\s*["']?(?!data:)[^"'>]*\/\//i, 'remote media or frame'],
  [/@import\s+(url\()?["']?[^"')]*\/\//i, 'remote @import'],
  [/url\(\s*["']?(https?:)?\/\//i, 'remote url() in CSS (fonts or images)'],
  [/\bfetch\s*\(/, 'fetch() call'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bnew\s+(WebSocket|EventSource)\s*\(/, 'socket or event stream'],
  [/\bimportScripts\s*\(/, 'importScripts()'],
  [/\bimport\s*\(\s*["'](https?:)?\/\//, 'dynamic import from the network'],
];
if (isHtml) {
  for (const [re, what] of externalPatterns) {
    if (re.test(raw)) fail('self-contained', `${what} found; the explainer has to open with the network switched off`);
  }
}

// ---------------------------------------------------- canonical sections

const SECTIONS = ['한눈에', '이미 알고 있던 것', '직관', '바뀐 것', '퀴즈', '다음'];
const OPTIONAL = '직접 만져보기';
ran('sections');
const clean = (s) => s.replace(/<[^>]*>/g, '').replace(/\s+/gu, ' ').trim();
const headings = isHtml
  ? [...raw.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)].map((m) => clean(m[2]))
  : [...raw.matchAll(/^#{1,6}[ \t]+(.+?)[ \t#]*$/gm)].map((m) => clean(m[1]).replace(/^\d+\.\s*/, ''));
for (const s of SECTIONS) {
  if (!headings.includes(s)) fail('sections', `heading "${s}" is missing; heading text is fixed so every explainer reads the same way`);
}
const order = SECTIONS.map((s) => headings.indexOf(s)).filter((i) => i >= 0);
if (order.some((v, i) => i > 0 && v < order[i - 1])) {
  warn('sections', 'canonical headings are out of order; keep 한눈에 → 이미 알고 있던 것 → 직관 → 바뀐 것 → 직접 만져보기 → 퀴즈 → 다음');
}
if (!headings.includes(OPTIONAL)) {
  warn('sections', 'no 직접 만져보기 section; expected unless the change is purely structural');
}
if (isHtml) {
  ran('lang-attribute');
  if (!/<html[^>]*\blang\s*=\s*["']?[a-z]{2}/i.test(raw)) {
    warn('lang-attribute', '<html> has no lang attribute; set it to the prose language (ko, en, …) so screen readers and fonts pick the right script');
  }
}

// ----------------------------------------------------- code block hygiene

const decode = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const stripTags = (s) => s.replace(/<[^>]*>/g, '');

const preBlocks = isHtml
  ? [...raw.matchAll(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi)].map((m) => ({ src: attr(m[1], 'data-src'), inner: m[2] }))
  : mdBlocks(raw);

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return m ? m[1].trim() : null;
}

// Markdown mode keeps attribution as a plain line directly above the fence:
//   source: path/to/file.mjs:10-20
function mdBlocks(text) {
  const out = [];
  const re = /(?:^|\n)(?:source:\s*`?([^\s`]+)`?[ \t]*\n)?```[^\n]*\n([\s\S]*?)\n```/g;
  for (const m of text.matchAll(re)) out.push({ src: m[1] ? m[1].trim() : null, inner: m[2] });
  return out;
}

if (isHtml) {
  ran('newlines-preserved');
  const cssHasPreWrap = /white-space\s*:\s*pre(-wrap|-line)?\b/i.test(raw);
  const codeDivs = [...raw.matchAll(/<div[^>]*class\s*=\s*["'][^"']*\bcode\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)];
  for (const d of codeDivs) {
    if (d[1].includes('\n') && !cssHasPreWrap) {
      fail('newlines-preserved', 'a multi-line code container is not <pre> and no white-space:pre-wrap rule exists; the browser will fold it into one line');
    }
  }
  if (preBlocks.length === 0) warn('newlines-preserved', 'no <pre> code blocks found');
}

// ------------------------------------------- quoted code really exists

ran('quotes-real');
let attributed = 0;
for (const blk of preBlocks) {
  if (!blk.src) continue;
  attributed++;
  const srcPath = blk.src.replace(/:\d+(-\d+)?$/, '');
  const abs = isAbsolute(srcPath) ? srcPath : resolve(repoRoot, srcPath);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    fail('quotes-real', `code block cites ${blk.src} but that file does not exist; the explainer describes code that is not there`);
    continue;
  }
  if (lstatSync(abs).isSymbolicLink()) {
    warn('quotes-real', `${srcPath} is a symlink; cite the real file so the reader opens the right one`);
  }
  const fileText = readFileSync(abs, 'utf8');
  // Removed lines are correctly absent from the current file, so drop them.
  const kept = blk.inner.replace(/<span[^>]*class\s*=\s*["'][^"']*\bdel\b[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');
  const lines = decode(stripTags(kept))
    .split('\n')
    .map((l) => l.replace(/^\s*[+-]\s?/, '').trim())
    .filter((l) => l.length >= 8)
    .filter((l) => !/^(\/\/|#|\/\*|\*)?\s*(…|\.\.\.)\s*$/.test(l))
    .filter((l) => !l.includes('…'));
  if (lines.length === 0) continue;
  const missed = lines.filter((l) => !fileText.includes(l));
  const ratio = (lines.length - missed.length) / lines.length;
  if (ratio < 0.6) {
    fail('quotes-real',
      `only ${lines.length - missed.length}/${lines.length} quoted lines appear in ${srcPath}; phantom quote, e.g. ${missed.slice(0, 3).map((m) => JSON.stringify(m.slice(0, 60))).join(', ')}`);
  } else if (missed.length) {
    warn('quotes-real', `${missed.length} quoted line(s) not found verbatim in ${srcPath}; mark edits with // … or a .del span`);
  }
}
// Excerpts with no attribution opt out of the check that catches a fabricated
// quote, and in practice authors skip data-src unless it is required.
if (preBlocks.length > 0 && attributed === 0) {
  fail('quotes-real', `${preBlocks.length} code block(s) carry no ${isHtml ? 'data-src attribute' : 'source: line above the fence'}; attribute each excerpt to the file it came from`);
} else if (preBlocks.length > attributed) {
  warn('quotes-real', `${preBlocks.length - attributed} code block(s) carry no attribution; fine for a toy example, wrong for an excerpt of the repo`);
} else if (preBlocks.length === 0) {
  warn('quotes-real', 'no code excerpts at all; a walkthrough of a code change normally quotes the code it explains');
}

// ---------------------------------------------- referenced repo paths

ran('paths-exist');
const spans = isHtml
  ? [...raw.matchAll(/<code[^>]*>([\s\S]*?)<\/code>/gi)].map((m) => decode(stripTags(m[1])).trim())
  : [...raw.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
const EXT = /\.(mjs|cjs|js|ts|tsx|jsx|md|json|jsonl|py|ya?ml|html|css|sh|toml|txt|go|rs|rb|java|kt|swift)$/i;
const seen = new Set();
for (const tok of spans) {
  const t = tok.replace(/:\d+(-\d+)?$/, '');
  if (!t.includes('/') || !EXT.test(t)) continue;
  if (/^(https?:|file:|~|\/|\.litgravity\/)/.test(t)) continue;
  if (/[\s()<>"'*{}$]/.test(t)) continue;
  if (seen.has(t)) continue;
  seen.add(t);
  if (!existsSync(resolve(repoRoot, t))) {
    warn('paths-exist', `cited path ${t} does not exist under ${repoRoot}; fine when the change deleted it, otherwise the explainer is wrong`);
  }
}

// ------------------------------------------------------------- diagrams

ran('no-ascii-art');
const outsidePre = isHtml
  ? raw.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  : raw.replace(/```[\s\S]*?```/g, '');
if (/[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬]/.test(outsidePre)) {
  fail('no-ascii-art', 'box-drawing characters outside code blocks; draw diagrams with HTML/CSS boxes or inline SVG so they survive wrapping');
}
if (/^\s*\+[-+]{4,}\+\s*$/m.test(outsidePre)) fail('no-ascii-art', 'ASCII box diagram (+----+) outside code blocks');

// ----------------------------------------------------------------- quiz

if (isHtml) {
  ran('quiz');
  const chunks = raw.split(/<div[^>]*class\s*=\s*["'][^"']*\bquiz-q\b/i).slice(1);
  const questions = chunks.map((c) => {
    const answer = c.match(/^[^>]*\bdata-answer\s*=\s*["'](\d+)["']/i);
    const opts = [...c.matchAll(/<button[^>]*class\s*=\s*["'][^"']*\bopt\b[^"']*["'][^>]*\bdata-i\s*=\s*["'](\d+)["'][^>]*>([\s\S]*?)<\/button>/gi)];
    const fbs = [...c.matchAll(/<div[^>]*class\s*=\s*["'][^"']*\bfb\b[^"']*["'][^>]*\bdata-i\s*=\s*["'](\d+)["'][^>]*>([\s\S]*?)<\/div>/gi)];
    return {
      answer: answer ? parseInt(answer[1], 10) : null,
      opts: opts.map((o) => ({ i: parseInt(o[1], 10), text: decode(stripTags(o[2])).trim() })),
      fb: new Map(fbs.map((f) => [parseInt(f[1], 10), decode(stripTags(f[2])).trim()])),
    };
  });

  if (chunks.length === 0) {
    fail('quiz', 'no .quiz-q blocks found; use the scaffold markup so the quiz is interactive and checkable');
  } else if (questions.length < 3) {
    fail('quiz', `only ${questions.length} quiz question(s); a comprehension check needs at least 3 (5 for a normal session)`);
  }
  questions.forEach((q, n) => {
    const label = `Q${n + 1}`;
    if (q.answer === null) { fail('quiz', `${label} has no data-answer attribute`); return; }
    if (q.opts.length < 3) fail('quiz', `${label} has ${q.opts.length} option(s); give at least 3`);
    if (!q.opts.some((o) => o.i === q.answer)) fail('quiz', `${label} data-answer=${q.answer} matches no option`);
    const ids = q.opts.map((o) => o.i);
    if (new Set(ids).size !== ids.length) fail('quiz', `${label} reuses a data-i value; each option needs its own index`);
    for (const o of q.opts) {
      if (!q.fb.has(o.i)) fail('quiz', `${label} option ${o.i} has no feedback block; every option teaches, the correct one included`);
      else if (q.fb.get(o.i).length < 12) warn('quiz', `${label} option ${o.i} feedback is a bare verdict; say why`);
    }
  });

  // Positional tell: readers learn the slot faster than the material.
  const answers = questions.map((q) => q.answer).filter((a) => a !== null);
  if (answers.length >= 3) {
    if (new Set(answers).size === 1) fail('quiz', `every correct answer sits in slot ${answers[0]}; vary it`);
    for (let i = 0; i + 2 < answers.length; i++) {
      if (answers[i] === answers[i + 1] && answers[i + 1] === answers[i + 2]) {
        fail('quiz', `questions ${i + 1}-${i + 3} all put the answer in slot ${answers[i]}; vary it`);
      }
    }
  }
  // Length tell: "the longest option wins" is a learnable shortcut.
  let longest = 0, comparable = 0;
  for (const q of questions) {
    if (q.answer === null || q.opts.length < 2) continue;
    comparable++;
    const max = Math.max(...q.opts.map((o) => o.text.length));
    const ans = q.opts.find((o) => o.i === q.answer);
    if (ans && ans.text.length === max) longest++;
  }
  if (comparable >= 3 && longest / comparable > 0.6) {
    warn('quiz', `the correct option is the longest in ${longest}/${comparable} questions; even out the lengths and move detail into the feedback`);
  }
} else {
  ran('quiz');
  const details = (raw.match(/<details\b/gi) || []).length;
  if (details < 3) fail('quiz', `Markdown mode needs at least 3 quiz questions as <details> blocks; found ${details}`);
}

// --------------------------------------------------------------- report

function report() {
  const fails = findings.filter((f) => f.level === 'FAIL');
  const warns = findings.filter((f) => f.level === 'WARN');
  if (jsonOut) {
    console.log(JSON.stringify({
      artifact: artifactPath, repo: repoRoot,
      checks: [...checksRun].sort(), failures: fails, warnings: warns,
      verdict: fails.length ? 'FAIL' : 'PASS',
    }, null, 2));
  } else {
    console.log(`lit-comprehend verify: ${artifactPath}`);
    console.log(`  checks run: ${[...checksRun].sort().join(', ')}`);
    for (const f of fails) console.log(`  FAIL [${f.check}] ${f.detail}`);
    for (const w of warns) console.log(`  WARN [${w.check}] ${w.detail}`);
    console.log(fails.length
      ? `  VERDICT: FAIL (${fails.length} blocking, ${warns.length} warning)`
      : `  VERDICT: PASS (${checksRun.size} checks, 0 blocking, ${warns.length} warning)`);
  }
  process.exit(fails.length ? 1 : 0);
}

report();
