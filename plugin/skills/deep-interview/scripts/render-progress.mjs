#!/usr/bin/env node
// Progress renderer for the deep-interview skill. Dependency-free Node ESM.
//
// Prints one of three blocks to stdout: the kickoff banner, the per-round ambiguity meter, or the clarity
// breakdown with the readiness gates. Colour is off unless asked for, because a Markdown reply shows escape codes
// as literal text; `--color always` is for a terminal pane, `--color auto` colours only a TTY with NO_COLOR unset.
//
//   node render-progress.mjs banner --profile Standard --context greenfield --idea "add dark mode" --threshold 20 --max-rounds 12 --ambiguity 100
//   node render-progress.mjs meter --round 3 --max-rounds 12 --stage "1: Intent-first" --focus Scope --ambiguity 52 --threshold 20
//   node render-progress.mjs breakdown --threshold 20 --prev 60 --ambiguity 52 --next Scope \
//        --scores "Intent=0.80,Outcome=0.60,Scope=0.40,Constraints=0.70,Success=0.30" --gates "nongoals=1,boundaries=0,pressure=1"
//
// Exit codes: 0 printed, 2 usage error.

const RED = 203, AMBER = 214, GREEN = 78, GRAY = 244, CYAN = 80, WHITE = 252;
const GATE_LABELS = { nongoals: 'Non-goals explicit', boundaries: 'Decision Boundaries', pressure: 'Pressure pass done' };

let useColor = false;

function usage(message) {
  process.stderr.write(`render-progress: ${message}\n`);
  process.exit(2);
}

function paint(code, text, bold = false) {
  if (!useColor) return String(text);
  return `${bold ? '\u001b[1m' : ''}\u001b[38;5;${code}m${text}\u001b[0m`;
}

// Red far from the target, amber on the way, green at or under it.
function ambiguityColor(value, threshold) {
  if (value <= threshold) return GREEN;
  if (value <= 2 * threshold) return AMBER;
  return RED;
}

// A draining gauge: filled cells are the ambiguity that remains, the tick marks the target.
function meterBar(value, threshold, width = 22) {
  const filled = Math.round((width * value) / 100);
  const tick = Math.round((width * threshold) / 100);
  const color = ambiguityColor(value, threshold);
  let out = '';
  for (let i = 0; i < width; i += 1) {
    if (i < filled) out += paint(color, '█');
    else if (i === tick) out += paint(value <= threshold ? GREEN : CYAN, '┊');
    else out += paint(GRAY, '░');
  }
  return out;
}

function dimensionBar(score, width = 10) {
  const filled = Math.round(width * score);
  const color = score >= 0.7 ? GREEN : score >= 0.4 ? AMBER : RED;
  return paint(color, '▓'.repeat(filled)) + paint(GRAY, '░'.repeat(width - filled));
}

function parsePairs(raw, kind) {
  const pairs = {};
  for (const item of String(raw).split(',')) {
    if (!item.trim()) continue;
    if (!item.includes('=')) usage(`bad ${kind} entry '${item}', expected name=value`);
    const at = item.indexOf('=');
    pairs[item.slice(0, at).trim()] = item.slice(at + 1).trim();
  }
  return pairs;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) usage(`--${key} needs a value`);
    out[key] = next;
    i += 1;
  }
  return out;
}

const num = (args, key, fallback) => {
  const raw = args[key] ?? fallback;
  if (raw === undefined) usage(`--${key} is required`);
  const n = Number(raw);
  if (!Number.isFinite(n)) usage(`--${key} must be a number`);
  return n;
};
const str = (args, key, fallback) => {
  const raw = args[key] ?? fallback;
  if (raw === undefined) usage(`--${key} is required`);
  return String(raw);
};

function banner(args) {
  const idea0 = str(args, 'idea', '');
  const idea = idea0.length <= 52 ? idea0 : `${idea0.slice(0, 49)}...`;
  const threshold = num(args, 'threshold');
  const ambiguity = num(args, 'ambiguity', 100);
  const edge = paint(CYAN, '│');
  return [
    ` ${paint(CYAN, '╭─')} ${paint(WHITE, '🎯 Deep Interview', true)} ${paint(CYAN, '─'.repeat(30))}`,
    ` ${edge}  ${paint(GRAY, 'Profile ')}  ${paint(WHITE, str(args, 'profile'))} · ${str(args, 'context', 'greenfield')}`,
    ` ${edge}  ${paint(GRAY, 'Goal    ')}  turn "${idea}" into an execution-ready spec`,
    ` ${edge}  ${paint(GRAY, 'Target  ')}  ambiguity ${paint(GREEN, `≤ ${threshold}%`)}   ·   Budget  up to ${num(args, 'max-rounds')} rounds`,
    ` ${edge}  ${paint(GRAY, 'Start   ')}  ambiguity ${paint(ambiguityColor(ambiguity, threshold), `${ambiguity}%`)}   ·   one question / round, intent before detail`,
    ` ${paint(CYAN, `╰${'─'.repeat(50)}`)}`,
  ].join('\n');
}

function meter(args) {
  const ambiguity = num(args, 'ambiguity');
  const threshold = num(args, 'threshold');
  const head = `${paint(GRAY, 'Round')} ${paint(WHITE, `${num(args, 'round')}/${num(args, 'max-rounds')}`, true)}`
    + `  ${paint(GRAY, '·')}  ${paint(GRAY, 'Stage')} ${str(args, 'stage', '')}`
    + `  ${paint(GRAY, '·')}  ${paint(GRAY, 'Focus:')} ${paint(CYAN, str(args, 'focus', ''))}`;
  const line = `${paint(GRAY, 'Ambiguity')} ${paint(ambiguityColor(ambiguity, threshold), `${String(ambiguity).padStart(3)}%`, true)} `
    + `[${meterBar(ambiguity, threshold)}] ${paint(GRAY, `target ≤ ${threshold}%`)}`;
  return `${head}\n${line}`;
}

function breakdown(args) {
  const scores = Object.fromEntries(Object.entries(parsePairs(str(args, 'scores'), 'score')).map(([k, v]) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1) usage(`score '${k}' must be a number from 0 to 1`);
    return [k, n];
  }));
  const gates = Object.fromEntries(Object.entries(parsePairs(str(args, 'gates', 'nongoals=0,boundaries=0,pressure=0'), 'gate'))
    .map(([k, v]) => [k, ['1', 'true', 'yes'].includes(v)]));
  const threshold = num(args, 'threshold');
  const ambiguity = num(args, 'ambiguity');
  const prev = num(args, 'prev', 100);
  const lines = [paint(WHITE, 'Clarity', true)];
  const names = Object.keys(scores);
  const weakest = names.length ? names.reduce((a, b) => (scores[b] < scores[a] ? b : a)) : null;
  for (const name of names) {
    const mark = name === weakest ? paint(CYAN, '  ← weakest') : '';
    lines.push(`  ${name.padEnd(12)}${dimensionBar(scores[name])}  ${paint(WHITE, scores[name].toFixed(2))}${mark}`);
  }
  lines.push('', paint(WHITE, 'Readiness gates', true));
  const cells = [];
  const open = [];
  for (const [key, label] of Object.entries(GATE_LABELS)) {
    const met = gates[key] === true;
    cells.push(met ? paint(GREEN, `✅ ${label}`) : paint(GRAY, `⬜ ${label}`));
    if (!met) open.push(label);
  }
  lines.push(`  ${cells.join('      ')}`);
  if (open.length) lines.push(paint(AMBER, `        → blocked by: ${open.join(', ')}`));
  else if (ambiguity <= threshold) lines.push(paint(GREEN, '        → all gates met - ready to crystallize'));
  const arrow = ambiguity < prev ? paint(GREEN, '↓') : paint(GRAY, '·');
  lines.push('', `${paint(GRAY, 'Ambiguity')} ${prev}% ${arrow} ${paint(ambiguityColor(ambiguity, threshold), `${ambiguity}%`, true)}`
    + `   ${paint(GRAY, '·')}   ${paint(GRAY, 'Next:')} ${paint(CYAN, str(args, 'next', ''))}`);
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const mode = args.color ?? 'never';
if (!['auto', 'always', 'never'].includes(mode)) usage('--color takes auto, always or never');
useColor = mode === 'always' || (mode === 'auto' && process.stdout.isTTY === true);
if (process.env.NO_COLOR) useColor = false;
const commands = { banner, meter, breakdown };
if (!commands[cmd]) usage('first argument is banner, meter or breakdown');
process.stdout.write(`${commands[cmd](args)}\n`);
