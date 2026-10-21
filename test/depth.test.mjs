import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname, relative, extname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { inflateRawSync } from 'node:zlib';
import { PLUGIN_DIR } from '../lib/bundle.mjs';
import { runtimeModules, callRuntime } from '../lib/runtime.mjs';

const SKILLS = join(PLUGIN_DIR, 'skills');
const skillIds = readdirSync(SKILLS).filter((d) => statSync(join(SKILLS, d)).isDirectory()).sort();
const DEPTH = JSON.parse(readFileSync(new URL('./fixtures/skill-depth.json', import.meta.url), 'utf8'));

function walk(dir, acc = []) {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const TEXT = new Set(['.md', '.mjs', '.js', '.cjs', '.ts', '.py', '.json', '.yaml', '.yml', '.txt', '.html', '.css', '.svg', '.sh', '.toml', '.lock', '']);
const isText = (f) => TEXT.has(extname(f).toLowerCase()) && statSync(f).size < 4 * 1024 * 1024;
const bodyOf = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, '');
// Verbatim third-party legal text may name other tools; everything else in the bundle may not.
const LEGAL = /(^|\/)(LICENSE|NOTICE|ATTRIBUTION|THIRD[-_]PARTY|PROVENANCE|SOURCE-MANIFEST)[^/]*$|\/legal\//i;
// Sibling products, their host tools and the leftover vocabulary of the sibling hosts: none of it belongs in an agy bundle.
const SIBLING = [
  /lit-?claude/i, /lit-?hermes/i, /lit-?codex/i, /lit-?opencode/i, /lit-?grok/i, /lit-?muse/i, /lazy-?codex/i,
  /CLAUDE_PLUGIN_ROOT/, /\.claude-plugin/, /\/litclaude:/, /\bSkill\(/, /\bTodoWrite\b/,
  /\bread_skill\b/, /\bsubagent_spawn\b/, /\brequest_user_input\b/, /\.litmuse\b/, /\.muse-plugin/, /\bwrite_todos\b/,
];
const HOSTS = [/Claude Code/, /\bCodex\b/, /\bOpenCode\b/, /\bGrok\b/, /\bHermes\b/, /\bMuse\b/];

test('every skill keeps its pinned depth, fits the host body cap, and the fixture lists every shipped skill', () => {
  assert.deepEqual(Object.keys(DEPTH.skills).sort(), skillIds, 'depth fixture lists every shipped skill (npm run sync:fixtures re-pins it)');
  for (const id of skillIds) {
    const want = DEPTH.skills[id];
    const md = readFileSync(join(SKILLS, id, 'SKILL.md'), 'utf8');
    const bytes = Buffer.byteLength(md);
    const body = Buffer.byteLength(bodyOf(md));
    const files = walk(join(SKILLS, id));
    const total = files.reduce((n, f) => n + statSync(f).size, 0);
    assert.ok(body <= DEPTH.bodyCapBytes, `${id}: SKILL.md body ${body} B exceeds the ${DEPTH.bodyCapBytes} B agy loads; move detail into references/`);
    assert.ok(bytes >= want.minSkillBytes, `${id}: SKILL.md ${bytes} B < pinned ${want.minSkillBytes} B`);
    assert.ok(files.length >= want.minFiles, `${id}: ${files.length} files < pinned ${want.minFiles}`);
    assert.ok(total >= want.minTotalBytes, `${id}: ${total} B in the folder < pinned ${want.minTotalBytes} B`);
    assert.ok(bytes >= DEPTH.familyFloorBytes, `${id}: SKILL.md ${bytes} B is below the family floor ${DEPTH.familyFloorBytes} B`);
  }
});

test('frontmatter agy accepts: name equals the folder, a quoted one-line description, nothing else breaks YAML', () => {
  for (const id of skillIds) {
    const text = readFileSync(join(SKILLS, id, 'SKILL.md'), 'utf8');
    const m = /^---\nname: ([a-z0-9-]+)\ndescription: "((?:[^"\\\n]|\\.)*)"\n---\n/.exec(text);
    assert.ok(m, `${id}: frontmatter must be exactly name + quoted description`);
    assert.equal(m[1], id, `${id}: name must equal the folder`);
    const description = JSON.parse(`"${m[2]}"`);
    assert.ok(description.length >= 20 && Buffer.byteLength(description) <= 220, `${id}: description is ${Buffer.byteLength(description)} B`);
  }
});

const REF = /(?:^|[\s`'"(\[])((?:\.\.\/\.\.\/lib|references|scripts|templates|assets|specs|schemas|examples|fonts|data|modes|engine|bench|rules|vendor)\/[A-Za-z0-9_./-]*[A-Za-z0-9_])/g;

test('reference closure: every relative resource path a skill document names exists', () => {
  const missing = [];
  for (const id of skillIds) {
    const root = join(SKILLS, id);
    for (const f of walk(root).filter((p) => p.endsWith('.md') && !LEGAL.test(p))) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(REF)) {
        const ref = m[1].replace(/[.]+$/, '');
        const next = text[m.index + m[0].length] ?? '';
        // Only file paths are checked: wildcard stems, placeholders and prose lists are not.
        if (/[*<{$]/.test(next) || !/\.[A-Za-z0-9]{1,5}$/.test(ref)) continue;
        if (DEPTH.illustrativeRefs.includes(ref) || DEPTH.closureExempt.some((p) => relative(PLUGIN_DIR, f).startsWith(p))) continue;
        const candidates = [join(root, ref), join(dirname(f), ref), join(root, '..', '..', ref.replace(/^\.\.\/\.\.\//, ''))];
        if (!candidates.some((c) => existsSync(c))) missing.push(`${relative(PLUGIN_DIR, f)} → ${ref}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('no sibling product or host vocabulary anywhere in the bundle (legal files excepted)', () => {
  const hits = [];
  for (const f of walk(PLUGIN_DIR).filter(isText)) {
    const rel = relative(PLUGIN_DIR, f);
    if (LEGAL.test(rel)) continue;
    const text = readFileSync(f, 'utf8');
    for (const re of SIBLING) if (re.test(text)) hits.push(`${rel}: ${re}`);
    if (DEPTH.hostNameExempt.some((p) => rel.startsWith(p))) continue;
    for (const re of HOSTS) if (re.test(text)) hits.push(`${rel}: ${re}`);
  }
  assert.deepEqual(hits, []);
});

test('runtime modules answer status --json inside a sandbox and cache under the LitGravity data dir', () => {
  const home = mkdtempSync(join(tmpdir(), 'litgravity-rt-'));
  const env = { PATH: process.env.PATH, HOME: home, XDG_DATA_HOME: join(home, 'data') };
  const mods = runtimeModules();
  assert.deepEqual(mods.map((m) => m.name), DEPTH.runtimes, 'shipped runtime modules (npm run sync:fixtures re-pins them)');
  for (const m of mods) {
    const r = callRuntime(m, 'status', env);
    assert.equal(r.error, undefined, `${m.name}: ${r.error}`);
    assert.equal(typeof r.ready, 'boolean', `${m.name}: ready flag`);
    assert.ok(Array.isArray(r.missing), `${m.name}: missing list`);
    assert.ok(String(r.cache).startsWith(join(home, 'data', 'litgravity', 'runtime')), `${m.name}: cache ${r.cache}`);
    assert.ok(['lib', 'scripts'].includes(basename(dirname(m.file))));
  }
});

test('the legal and attribution files name no sibling product either: they credit upstream sources only', () => {
  const hits = [];
  for (const f of walk(PLUGIN_DIR).filter(isText)) {
    const rel = relative(PLUGIN_DIR, f);
    if (!LEGAL.test(rel)) continue;
    const text = readFileSync(f, 'utf8');
    for (const re of SIBLING) if (re.test(text)) hits.push(`${rel}: ${re}`);
  }
  assert.deepEqual(hits, []);
});

test('all 39 family skills ship and each carries a pin, with no byproduct files left in the bundle', () => {
  const family = JSON.parse(readFileSync(new URL('./fixtures/family-skills.json', import.meta.url), 'utf8')).sort();
  assert.equal(family.length, 39);
  assert.deepEqual(skillIds, family);
  assert.deepEqual(Object.keys(DEPTH.skills).sort(), family);
  const stray = walk(PLUGIN_DIR).filter((f) => /(^|\/)(__pycache__|node_modules|\.DS_Store|evidence|plans|\.litgravity)(\/|$)|\.pyc$/.test(relative(PLUGIN_DIR, f)));
  assert.deepEqual(stray, []);
});

test('every exemption names one file, has a written reason and points at a file that exists', () => {
  const reasons = DEPTH.exemptionReasons ?? {};
  const reasonFor = (p) => Object.keys(reasons).some((k) => p === k || (k.endsWith('/') && p.startsWith(k)));
  for (const p of [...DEPTH.closureExempt, ...DEPTH.hostNameExempt]) {
    assert.match(p, /\.[A-Za-z0-9]{1,5}$/, `${p}: an exemption names a file, never a folder`);
    assert.ok(existsSync(join(PLUGIN_DIR, p)), `${p}: no such file`);
    assert.ok(reasonFor(p), `${p}: no reason recorded`);
  }
  for (const p of DEPTH.illustrativeRefs) assert.ok(reasonFor(p), `${p}: no reason recorded`);
});

// M8 D2: lit-brainstorm hands off to deep-interview through one packet shape; both skills must agree on its headings.
test('the brainstorm hand-off template matches the headings deep-interview accepts', () => {
  const heads = (text) => text.split('\n').filter((l) => /^##? /.test(l)).map((l) => l.trim());
  const packet = heads(readFileSync(join(SKILLS, 'lit-brainstorm', 'templates', 'handoff-packet.md'), 'utf8'));
  const interview = readFileSync(join(SKILLS, 'deep-interview', 'SKILL.md'), 'utf8');
  const block = /### Hand-in from lit-brainstorm[\s\S]*?```markdown\n([\s\S]*?)```/.exec(interview)?.[1] ?? '';
  assert.ok(packet.length >= 5, 'packet has its sections');
  assert.deepEqual(packet, heads(block));
  assert.match(readFileSync(join(SKILLS, 'lit-brainstorm', 'SKILL.md'), 'utf8'), /\.litgravity\/brainstorm\/<slug>-handoff\.md/);
});

// Office files are zip containers whose XML is deflated, so a plain byte scan cannot see inside them.
function zipEntries(buf) {
  const out = [];
  let at = 0;
  while (at + 30 <= buf.length && buf.readUInt32LE(at) === 0x04034b50) {
    const flags = buf.readUInt16LE(at + 6);
    const method = buf.readUInt16LE(at + 8);
    let size = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26);
    const extraLen = buf.readUInt16LE(at + 28);
    const start = at + 30 + nameLen + extraLen;
    if (flags & 8 || size === 0) break;
    const raw = buf.subarray(start, start + size);
    out.push({ name: buf.toString('utf8', at + 30, at + 30 + nameLen), data: method === 8 ? inflateRawSync(raw) : raw });
    at = start + size;
  }
  return out;
}

const PRODUCTS = SIBLING.slice(0, 7);
const ZIPPED = /\.(docx|pptx|xlsx)$/i;

test('no byte of any bundle file names a sibling product: text of any size, binaries, and the XML inside office containers', () => {
  const hits = [];
  let scanned = 0;
  for (const f of walk(PLUGIN_DIR)) {
    const rel = relative(PLUGIN_DIR, f);
    const buf = readFileSync(f);
    scanned += 1;
    const views = [{ label: rel, text: buf.toString('latin1') }];
    if (ZIPPED.test(rel)) {
      const entries = zipEntries(buf);
      const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
      assert.equal(entries.length, buf.readUInt16LE(eocd + 10), `${rel}: every entry of the container was read`);
      for (const e of entries) views.push({ label: `${rel}!${e.name}`, text: e.data.toString('utf8') });
    }
    for (const v of views) for (const re of PRODUCTS) if (re.test(v.text)) hits.push(`${v.label}: ${re}`);
  }
  assert.ok(scanned > 1000, `scanned ${scanned} files`);
  assert.deepEqual(hits, []);
});
