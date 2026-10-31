import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sandbox, collect } from './helpers.mjs';
import {
  AGENT_FILE_ID,
  AGENT_FILE_MAX_BYTES,
  RuleBlockError,
  agentFileBody,
  inspectRuleBlock,
  removeRuleBlock,
  upsertRuleBlock,
  readAgentFileMode,
  writeAgentFileMode,
  ruleFileState,
  applyProjectBlock,
  projectBlockState,
  runAgentFileConfig,
  runAgentFileProject,
} from '../lib/agent-file.mjs';
import { destState, packageVersion } from '../lib/bundle.mjs';
import { install } from '../lib/install.mjs';
import { uninstall } from '../lib/uninstall.mjs';
import { doctor } from '../lib/doctor.mjs';
import { paths } from '../lib/paths.mjs';

const version = packageVersion();
const START = `<!-- litfamily:litgravity:start v=${version} -->`;
const END = '<!-- litfamily:litgravity:end -->';
const block = { id: 'litgravity', version, body: '## LitGravity\n\n- rule one\n' };
const project = () => mkdtempSync(join(tmpdir(), 'litgravity-af-'));
const runInstall = (env, flags, cwd, interactive = false, ask) => {
  const out = collect();
  return install({ env, flags, interactive, ask, cwd, print: out.print }).then((code) => ({ code, text: out.text() }));
};
const runDoctor = (env, cwd, flags = {}) => {
  const out = collect();
  return doctor({ env: { ...env, LITGRAVITY_SKIP_HOST_TOOLS: '1' }, flags, cwd, print: out.print })
    .then((code) => ({ code, text: out.text() }));
};
const rulePath = (env) => paths(env).geminiRulesFile;

test('the project block round-trips user text byte for byte', () => {
  const empty = upsertRuleBlock('', block);
  assert.equal(empty.changed, true);
  assert.equal(empty.text, `${START}\n## LitGravity\n\n- rule one\n${END}\n`);
  const mine = upsertRuleBlock('# Mine\n\nmy rule\n', block);
  assert.ok(mine.text.startsWith('# Mine\n\nmy rule\n\n<!-- litfamily:litgravity:start'));
  assert.deepEqual(inspectRuleBlock(mine.text, 'litgravity'), { state: 'present', version, created: false });

  const first = upsertRuleBlock('mine\n', block).text;
  assert.deepEqual(upsertRuleBlock(first, block), { text: first, changed: false });
  const next = upsertRuleBlock(first, { ...block, body: '## LitGravity\n\n- rule two\n' });
  assert.ok(next.text.endsWith(`${END}\n`) && next.text.startsWith('mine\n\n'));
  assert.match(next.text, /rule two/);
  assert.doesNotMatch(next.text, /rule one/);

  for (const original of ['mine\n', '', 'no newline at the end', 'mixed\r\nendings\n']) {
    const added = upsertRuleBlock(original, block).text;
    assert.equal(removeRuleBlock(added, 'litgravity').text, original, JSON.stringify(original));
  }
});

test('the project block keeps CRLF and leaves another product alone, and malformed pairs are refused', () => {
  const added = upsertRuleBlock('mine\r\nsecond\r\n', block).text;
  assert.ok(!/[^\r]\n/.test(added), 'every new line ends with CRLF');
  assert.equal(removeRuleBlock(added, 'litgravity').text, 'mine\r\nsecond\r\n');
  const other = upsertRuleBlock('mine\n', { id: 'litother', version: '0.0.1', body: 'other rules\n' }).text;
  const both = upsertRuleBlock(other, block).text;
  assert.equal(removeRuleBlock(both, 'litgravity').text, other);
  for (const bad of [`${START}\nbody\n`, `${END}\n${START}\n`, `${START}\n${START}\n${END}\n`]) {
    assert.equal(inspectRuleBlock(bad, 'litgravity').state, 'malformed');
    assert.throws(() => upsertRuleBlock(bad, block), RuleBlockError);
    assert.throws(() => removeRuleBlock(bad, 'litgravity'), RuleBlockError);
  }
});

test('both bodies stay small, name the Antigravity CLI, and carry the off switch', () => {
  for (const kind of ['global', 'project']) {
    const body = agentFileBody(kind);
    assert.ok(Buffer.byteLength(body, 'utf8') <= AGENT_FILE_MAX_BYTES, `${kind} is ${Buffer.byteLength(body, 'utf8')} bytes`);
  }
  assert.match(agentFileBody('global'), /Antigravity CLI/);
  assert.match(agentFileBody('global'), /config agentFile off/);
  assert.match(agentFileBody('project'), /lit-plan/);
  assert.throws(() => agentFileBody('nope'), /unknown agent file kind/);
});

test('the on/off mode defaults on, honours the environment, and never overwrites a broken config', () => {
  const { env } = sandbox();
  const config = paths(env).litgravityConfig;
  assert.equal(readAgentFileMode({ env, configFile: config }), 'on');
  writeAgentFileMode(config, 'off');
  assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')), { agentFile: 'off' });
  assert.equal(readAgentFileMode({ env, configFile: config }), 'off');
  assert.equal(readAgentFileMode({ env: { ...env, LITGRAVITY_AGENT_FILE: 'on' }, configFile: config }), 'on');
  assert.equal(readAgentFileMode({ env: { ...env, LITGRAVITY_AGENT_FILE: 'bogus' }, configFile: config }), 'off');
  assert.throws(() => writeAgentFileMode(config, 'maybe'), /agentFile takes one of/);
  writeFileSync(config, '{ not json');
  assert.throws(() => writeAgentFileMode(config, 'on'), /config\.json/);
  assert.equal(readFileSync(config, 'utf8'), '{ not json', 'an unreadable config is never overwritten');
});

test('rule file states: absent, present, stale, malformed, symlink', () => {
  const { env, home } = sandbox();
  const target = rulePath(env);
  assert.equal(ruleFileState({ path: target, version }), 'absent');
  mkdirSync(join(home, '.gemini', 'config', 'rules'), { recursive: true });
  writeFileSync(target, `<!-- litfamily:litgravity:rule v=${version} -->\n${agentFileBody('global')}`);
  assert.equal(ruleFileState({ path: target, version }), `present v=${version}`);
  assert.equal(ruleFileState({ path: target, version: '9.9.9' }), `stale v=${version}`);
  writeFileSync(target, 'user text without our marker\n');
  assert.equal(ruleFileState({ path: target, version }), 'malformed');
  const link = join(home, 'linked-rule.md');
  symlinkSync(target, link);
  assert.equal(ruleFileState({ path: link, version }), 'symlink');
  void AGENT_FILE_ID;
  void AGENT_FILE_MAX_BYTES;
});

test('user install --yes writes the owned rule file; doctor sees it; uninstall removes it', async () => {
  const { env } = sandbox();
  const cwd = project();
  const r = await runInstall(env, { yes: true, scope: 'user' }, cwd);
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /agent file.*created/);
  const file = rulePath(env);
  assert.ok(existsSync(file), 'rule file written');
  assert.match(readFileSync(file, 'utf8'), new RegExp(`litfamily:litgravity:rule v=${version.replaceAll('.', '\\.')}`));
  assert.match(readFileSync(file, 'utf8'), /Antigravity CLI/);
  const again = await runInstall(env, { yes: true, scope: 'user' }, cwd);
  assert.equal(again.code, 0, again.text);
  assert.match(again.text, /agent file.*unchanged/);
  assert.equal(readFileSync(file, 'utf8').split('litfamily:litgravity:rule').length, 2, 'one marker after two installs');

  const d = await runDoctor(env, cwd);
  assert.equal(d.code, 0, d.text);
  assert.match(d.text, new RegExp(`agent file — present v=${version.replaceAll('.', '\\.')}`));

  const out = collect();
  assert.equal(await uninstall({ env, flags: { yes: true }, cwd, print: out.print }), 0);
  assert.match(out.text(), /agent file.*removed/);
  assert.ok(!existsSync(file), 'a file we alone created is removed');
});

test('a foreign rule file fails the install closed and survives the uninstall', async () => {
  const { env, home } = sandbox();
  const cwd = project();
  mkdirSync(join(home, '.gemini', 'config', 'rules'), { recursive: true });
  writeFileSync(rulePath(env), 'my own global rule\n');
  const r = await runInstall(env, { yes: true, scope: 'user' }, cwd);
  assert.equal(r.code, 1, r.text);
  assert.match(r.text, /agent file.*foreign|agent file.*refused/);
  assert.match(r.text, /No files written/);
  assert.equal(readFileSync(rulePath(env), 'utf8'), 'my own global rule\n');
  assert.ok(!existsSync(join(home, '.gemini', 'config', 'plugins', 'litgravity')), 'plugin not written either');

  const out = collect();
  assert.equal(await uninstall({ env, flags: { yes: true }, cwd, print: out.print }), 0);
  assert.equal(readFileSync(rulePath(env), 'utf8'), 'my own global rule\n');
});

test('an edited rule file is kept, and only --discard-modified removes it', async () => {
  const { env } = sandbox();
  const cwd = project();
  assert.equal((await runInstall(env, { yes: true, scope: 'user' }, cwd)).code, 0);
  const file = rulePath(env);
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n- my extra line\n`);
  const refused = await runInstall(env, { yes: true, scope: 'user' }, cwd);
  assert.equal(refused.code, 1, refused.text);
  assert.match(refused.text, /edited after install|modified/);
  const out = collect();
  assert.equal(await uninstall({ env, flags: { yes: true }, cwd, print: out.print }), 0);
  assert.ok(existsSync(file), 'edited rule file kept');
  assert.match(out.text(), /agent file.*kept/);
  const discard = collect();
  assert.equal(await uninstall({ env, flags: { yes: true, discardModified: true }, cwd, print: discard.print }), 0);
  assert.ok(!existsSync(file), 'discarded on request');
});

test('no terminal and no --yes writes nothing; --no-agent-file and project scope skip the rule file', async () => {
  const { env } = sandbox();
  const quiet = await runInstall(env, { scope: 'user' }, project());
  assert.equal(quiet.code, 0, quiet.text);
  assert.ok(!existsSync(rulePath(env)), 'no rule file without --yes');

  const skipped = await runInstall(env, { yes: true, scope: 'user', noAgentFile: true }, project());
  assert.equal(skipped.code, 0, skipped.text);
  assert.match(skipped.text, /agent file.*skipped/);
  assert.ok(!existsSync(rulePath(env)));

  const cwd = project();
  const proj = await runInstall(env, { yes: true, scope: 'project' }, cwd);
  assert.equal(proj.code, 0, proj.text);
  assert.ok(!existsSync(rulePath(env)), 'project scope never touches the user home rule');
});

test('interactive install asks once; No stores off and installs the plugin alone', async () => {
  const { env, home } = sandbox();
  const cwd = project();
  const seen = [];
  const answers = [true, false];
  const no = await runInstall(env, { scope: 'user' }, cwd, true, async (q) => { seen.push(q); return answers.shift() ?? false; });
  assert.equal(no.code, 0, no.text);
  assert.ok(seen.some((q) => /global rule/.test(q)), `asked about the rule file: ${seen}`);
  assert.ok(!existsSync(rulePath(env)));
  const { configFile } = { configFile: paths(env).litgravityConfig };
  assert.equal(readAgentFileMode({ env, configFile }), 'off', 'No stores off');
  assert.ok(destState(join(home, '.gemini', 'config', 'plugins', 'litgravity')).state === 'owned', 'the plugin itself still installs');
});

test('config agentFile off removes the file at once and keeps it off; on writes it back', async () => {
  const { env } = sandbox();
  const cwd = project();
  const cfg = (args) => {
    const out = collect();
    return runAgentFileConfig({ env, args, cwd, print: out.print }).then((code) => ({ code, text: out.text() }));
  };
  assert.equal((await runInstall(env, { yes: true, scope: 'user' }, cwd)).code, 0);
  assert.ok(existsSync(rulePath(env)));
  assert.equal((await cfg(['agentFile', 'off'])).code, 0);
  assert.ok(!existsSync(rulePath(env)), 'off removes the file at once');
  assert.equal((await runInstall(env, { yes: true, scope: 'user' }, cwd)).code, 0);
  assert.ok(!existsSync(rulePath(env)), 'install keeps it off');
  const d = await runDoctor(env, cwd);
  assert.match(d.text, /agent file — off/);
  assert.equal((await cfg(['agentFile', 'on'])).code, 0);
  assert.match(readFileSync(rulePath(env), 'utf8'), /Antigravity CLI/);
  assert.equal((await cfg(['agentFile', 'maybe'])).code, 64);
  assert.equal((await cfg(['agentFile'])).code, 64);
  assert.equal((await cfg(['nope', 'on'])).code, 64);
});

test('agent-file project writes the block into AGENTS.md and refuses a missing dir', async () => {
  const { env } = sandbox();
  const run = (args, cwd) => {
    const out = collect();
    return runAgentFileProject({ env, args, cwd, flags: {}, print: out.print }).then((code) => ({ code, text: out.text() }));
  };
  const repo = mkdtempSync(join(tmpdir(), 'litgravity-repo-'));
  writeFileSync(join(repo, 'AGENTS.md'), '# Repo\n\nbuild with make\n');
  const r = await run(['project', '--dir', repo], repo);
  assert.equal(r.code, 0, r.text);
  const agents = readFileSync(join(repo, 'AGENTS.md'), 'utf8');
  assert.ok(agents.startsWith('# Repo\n\nbuild with make\n\n<!-- litfamily:litgravity:start'));
  assert.equal((await run(['project', '--dir', repo], repo)).code, 0, 'second run is unchanged');

  const st = projectBlockState({ path: join(repo, 'AGENTS.md'), id: 'litgravity', version });
  assert.equal(st, `present v=${version}`);

  const missing = join(repo, 'no-such-dir');
  const typo = await run(['project', '--dir', missing], repo);
  assert.equal(typo.code, 64);
  assert.ok(!existsSync(missing), 'a mistyped --dir is never created');

  const linkRepo = mkdtempSync(join(tmpdir(), 'litgravity-link-'));
  writeFileSync(join(linkRepo, 'real.md'), 'real\n');
  symlinkSync(join(linkRepo, 'real.md'), join(linkRepo, 'AGENTS.md'));
  const linked = await run(['project', '--dir', linkRepo], linkRepo);
  assert.equal(linked.code, 1, linked.text);
  assert.match(linked.text, /refused-symlink/);
  void applyProjectBlock;
});
