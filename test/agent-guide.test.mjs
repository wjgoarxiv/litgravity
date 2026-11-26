import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AGENT_POINTER, COMMAND, QUESTIONS, agentGuide } from '../lib/agent-guide.mjs';
import { FLAGS, parse } from '../lib/args.mjs';
import { ICON_FONT } from '../lib/icon-font.mjs';
import { install } from '../lib/install.mjs';
import { ROOT, collect, sandbox, walk } from './helpers.mjs';

const BIN = join(ROOT, 'bin', 'litgravity.mjs');
const PILL = ' LIT ';
const cli = (env, ...args) => spawnSync(process.execPath, [BIN, ...args], { env, cwd: env.HOME, encoding: 'utf8' });
const flagsIn = (text) => [...new Set(text.match(/(?<![\w-])--[a-z][a-z-]*/g))].sort();
const commandsIn = (text) => [...new Set(text.match(/npx --yes @litfamily\/litgravity@latest [a-z][^\n]*/g))];

test('install --agent and --agent print one guide, the same bytes everywhere, and write, start and need nothing', () => {
  const home = mkdtempSync(join(tmpdir(), 'litgravity-agent-'));
  const base = { HOME: home, PATH: home }; // no agy, no npm
  const want = `${agentGuide()}\n`;
  for (const extra of [{}, { NO_COLOR: '1' }, { CI: '1' }, { TERM: 'dumb' }, { COLORTERM: 'truecolor', FORCE_COLOR: '3' }]) {
    for (const args of [['install', '--agent'], ['--agent'], ['install', '--agent', '--yes', '--round'], ['--agent', '--json', '--no-such-flag'], ['update', '--yes', '--agent']]) {
      const r = cli({ ...base, ...extra }, ...args);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stdout, want, args.join(' '));
      assert.equal(r.stderr, '');
    }
  }
  assert.doesNotMatch(want, /\u001b/);
  assert.deepEqual(walk(home), []);
});

test('the guide keeps the contract order and says what only the user can do', () => {
  const text = agentGuide();
  const order = [
    'LitGravity install guide for coding agents',
    'If you are a coding agent and your user asked you to install LitGravity, follow these steps. They are written for your user to read too.',
    `${COMMAND} install --dry-run`, 'Show your user what it would change.', 'Keep every default', "Wait for your user's yes. Use only this package; add no other source, and do not approve hooks, trust or sign-in for your user.",
    `${COMMAND} install --yes --round`, `${COMMAND} update --yes --round`, `${COMMAND} doctor`, 'LitGravity: ready', 'ROUND_ENDS:', 'If a step fails, show your user the lines and stop.',
    `Show your user this and ask if both ends are round: ${PILL}`, '--glyphs round', '--glyphs square', '--glyphs auto', 'Only your user can', 'start it again', 'sign in',
  ];
  let at = -1;
  for (const part of order) {
    const next = text.indexOf(part, at + 1);
    assert.ok(next > at, `missing or out of order: ${part}`);
    at = next;
  }
  for (const part of [ICON_FONT.files[0].name, '~/Library/Fonts', '.local/share/fonts', '$XDG_DATA_HOME/fonts', '--status-line', '--replace-status-line']) assert.ok(text.includes(part), part);
  assert.doesNotMatch(text, /github\.com|\bstar\b|do not ask|skip-permissions|finds (it|the font) by itself/i);
});

test('drift: the guide, the parser, the questions install asks and both reference prompts name the same things', async () => {
  const guide = agentGuide();
  const known = Object.keys(FLAGS);
  for (const flag of flagsIn(guide)) assert.ok(known.includes(flag), `${flag} in the guide is no flag`);
  for (const q of QUESTIONS) {
    assert.ok(guide.includes(q.line), q.title);
    for (const flag of q.flags) {
      assert.ok(known.includes(flag), flag);
      assert.ok(q.line.includes(flag), flag);
    }
  }
  const { env } = sandbox();
  const asked = [];
  await install({ env, interactive: true, ask: async (_q, card) => { asked.push(card.title); return true; }, cwd: env.HOME, print: () => {} });
  const titles = QUESTIONS.map((q) => q.title);
  for (const title of asked) assert.ok(titles.includes(title), `install asks "${title}", the guide does not`);

  const commands = commandsIn(guide);
  assert.ok(commands.length >= 7, commands.join('\n'));
  for (const c of commands) assert.equal(parse(c.replace(`${COMMAND} `, '').replace('auto|round|square', 'auto').split(' ')).error, undefined, c);
  for (const [file, heading, words] of [
    ['docs/reference.md', '## Let a coding agent install it', ['Show me what it would change', 'Wait for my yes', 'show me the lines and stop', 'start it again', 'sign in']],
    ['docs/reference_ko-KR.md', '## 코딩 에이전트에게 설치 맡기기', ['무엇이 바뀌는지 보여 줘', '승인을 기다려', '그 줄을 보여 주고 멈춰', '다시 시작', '로그인']],
  ]) {
    const prompt = /```text\n([\s\S]*?)\n```/.exec(readFileSync(join(ROOT, file), 'utf8').split(heading)[1])[1];
    for (const c of commands) assert.ok(prompt.includes(c), `${file}: ${c}`);
    for (const flag of flagsIn(guide)) assert.ok(prompt.includes(flag), `${file}: ${flag}`);
    for (const flag of flagsIn(prompt)) assert.ok(flagsIn(guide).includes(flag) || flag === '--version', `${file}: ${flag} is not in the guide`);
    for (const part of [...words, PILL, 'ROUND_ENDS:', 'LitGravity: ready', ICON_FONT.files[0].name, '~/Library/Fonts', '~/.local/share/fonts', '$XDG_DATA_HOME/fonts']) assert.ok(prompt.includes(part), `${file}: ${part}`);
    const at = ['install --dry-run', words[1], 'install --yes --round', 'update --yes --round', ' doctor', PILL, words[3]].map((part) => prompt.indexOf(part));
    assert.deepEqual(at, [...at].sort((a, b) => a - b), `${file}: ${at}`);
    assert.ok(at.every((i) => i >= 0), `${file}: ${at}`);
  }
});

test('--help has one agent line; a shell without a person gets one pointer right under the first banner line, never in JSON', () => {
  const { env } = sandbox();
  const help = cli(env, '--help').stdout;
  assert.equal(help.split('\n').filter((l) => l.startsWith('Are you an agent?') && l.includes(`${COMMAND} install --agent`)).length, 1);
  assert.equal(AGENT_POINTER, `Agent? See ${COMMAND} install --agent.`);
  for (const args of [['install'], ['install', '--dry-run'], ['update'], ['doctor', '--offline'], ['install', '--yes', '--no-agent-file', '--scope', 'project']]) {
    const out = cli({ ...env, LITGRAVITY_SKIP_HOST_TOOLS: '1' }, ...args).stdout;
    assert.ok(out.startsWith(`LIT · antigravity\n${AGENT_POINTER}\nLitGravity `), `${args}: ${out.slice(0, 200)}`);
    assert.equal(out.split(AGENT_POINTER).length, 2);
  }
  for (const args of [['doctor', '--json', '--offline'], ['list', '--json'], ['uninstall', '--dry-run'], ['--version']]) {
    assert.ok(!cli({ ...env, LITGRAVITY_SKIP_HOST_TOOLS: '1' }, ...args).stdout.includes('Agent?'), args.join(' '));
  }
});

test('unknown flags, a missing value and a wrong value end with 2 and change nothing; every real flag parses', () => {
  const { env, home } = sandbox();
  for (const args of [
    ['install', '--yes', '--bogus'], ['--bogus'], ['install', '--yes', '--scope=project'], ['uninstall', '--yes', '--forse'], ['install', '--yes', '-x'],
    ['install', '--yes', '--glyphs'], ['install', '--yes', '--glyphs', 'oval'], ['install', '--yes', '--scope'], ['install', '--scope', '--yes'], ['install', '--yes', '--dir', 'x'],
  ]) {
    const r = cli(env, ...args);
    assert.equal(r.status, 2, `${args}: ${r.stdout}`);
    assert.match(r.stdout, /^(Unknown option: |--(glyphs|scope) takes )/);
  }
  assert.deepEqual(walk(home), []);
  for (const [flag, spec] of Object.entries(FLAGS)) {
    const { flags, error } = parse(['install', flag, ...(spec.value ? [spec.one?.[0] ?? 'x'] : [])]);
    assert.equal(error, undefined, flag);
    assert.ok(Object.hasOwn(flags, spec.key), flag);
  }
  assert.deepEqual(parse(['agent-file', 'project', '--dir', '/x']), { command: 'agent-file', args: ['project', '--dir', '/x'], flags: {} });
  assert.deepEqual(parse([]), { command: 'help', args: [], flags: {} });
});

test('the plain dry run and the plain no still say what they said, and print no ROUND_ENDS', async () => {
  const { env } = sandbox();
  for (const flags of [{ dryRun: true, round: true }, { round: true }]) {
    const out = collect();
    assert.equal(await install({ env, flags, cwd: env.HOME, print: out.print }), 0);
    assert.doesNotMatch(out.text(), /ROUND_ENDS/);
  }
});
