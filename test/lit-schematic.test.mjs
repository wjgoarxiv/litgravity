import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PLUGIN, sandbox, workspace, turn, injected } from './helpers.mjs';
import { detectRoute, schematicIntent, SKILL_IDS, KEYWORD_ROUTES } from '../plugin/hooks/lib/routes.mjs';
import { parseEquipmentTag, parseInstrumentTag } from '../plugin/skills/lit-schematic/scripts/lib/isa.mjs';
import * as S from '../plugin/skills/lit-schematic/scripts/lib/pid.mjs';
import { routeOrthogonal } from '../plugin/skills/lit-schematic/scripts/lib/route.mjs';
import { createFigure } from '../plugin/skills/lit-schematic/scripts/lib/figure.mjs';
import { createIsoView } from '../plugin/skills/lit-schematic/scripts/lib/iso.mjs';
import { check, deltaE, pathPolylines } from '../plugin/skills/lit-schematic/scripts/lib/qa-core.mjs';
import { pngInfo, withDpi } from '../plugin/skills/lit-schematic/scripts/lib/png.mjs';
import { CHROME_FLAGS } from '../plugin/skills/lit-schematic/scripts/render.mjs';
import { checkExports } from '../plugin/skills/lit-schematic/scripts/qa.mjs';
import { scaffold } from '../plugin/skills/lit-schematic/scripts/scaffold.mjs';
import { STREAM } from '../plugin/skills/lit-schematic/scripts/lib/theme.mjs';

const skillRoot = join(PLUGIN, 'skills', 'lit-schematic');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const skillFiles = walk(skillRoot).map((f) => relative(skillRoot, f).replaceAll('\\', '/'));
const body = readFileSync(join(skillRoot, 'SKILL.md'), 'utf8');
const codes = (svg, options) => check(svg, options).findings.filter((f) => f.level === 'FAIL').map((f) => f.code);

// Minimal kit-shaped SVG for foils.
const doc = (inner, { mode = 'figure', extra = '' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="60mm" viewBox="0 0 100 60" data-schematic-mode="${mode}"${extra}>${inner}</svg>`;
const box = (x0, y0, x1, y1, ports = '', kind = 'valve.gate', tag = '') =>
  `<g data-sym="${kind}"${tag ? ` data-tag="${tag}"` : ''} data-box="${x0} ${y0} ${x1} ${y1}" data-ports="${ports}" stroke="#000" stroke-width="0.35" fill="none"><path d="M${x0} ${y0}H${x1}V${y1}H${x0}Z"/></g>`;
const line = (d, id = 'L1', kind = 'process-major') => `<path data-line="${kind}" data-line-id="${id}" d="${d}" stroke="#000" stroke-width="0.35" fill="none"/>`;
const label = (x, y, text, size = 2.5) => `<text x="${x}" y="${y}" font-size="${size}" font-family="Arial">${text}</text>`;

test('lit-schematic is enrolled: folder, route table, family list, SKILL.md under 24 KB', () => {
  assert.ok(SKILL_IDS.has('lit-schematic'));
  assert.ok(existsSync(join(skillRoot, 'SKILL.md')));
  assert.ok(Buffer.byteLength(body, 'utf8') < 24000, `SKILL.md is ${Buffer.byteLength(body, 'utf8')} bytes`);
  const fm = body.match(/^---\nname: (.+)\n/m);
  assert.ok(fm && fm[1] === 'lit-schematic');
});

test('lit-schematic points to its neighbours and they point back', () => {
  assert.match(body, /`lit-diagram-drawer`/u);
  assert.match(body, /`lit-scientific-visualization`/u);
  for (const neighbour of ['lit-diagram-drawer', 'lit-scientific-visualization']) {
    assert.match(readFileSync(join(PLUGIN, 'skills', neighbour, 'SKILL.md'), 'utf8'), /lit-schematic/u, neighbour);
  }
});

test('schematic keyword routes reach lit-schematic', () => {
  for (const word of ['schematic', 'pid', 'pfd', 'cutaway', '계통도', '공정도', '모식도', '장치도']) {
    assert.equal(detectRoute(`lit ${word} of the reactor`).route, 'lit-schematic', word);
  }
});

test('natural-language schematic intent under bare lit reaches lit-schematic', () => {
  for (const prompt of [
    'lit draw a P&ID of the hydrate reactor loop',
    'lit 논문용 실험 장치 모식도 만들어줘',
    'lit isometric cutaway of a stirred autoclave',
    'lit draw the PFD for the absorber section',
    'lit 공정 계통도 그려줘',
  ]) {
    assert.equal(detectRoute(prompt).route, 'lit-schematic', prompt);
  }
});

test('near-miss negatives stay with their owners, not lit-schematic', () => {
  assert.notEqual(detectRoute('lit 단면도 데이터로 그래프 그려줘')?.route, 'lit-schematic');
  assert.notEqual(detectRoute('lit P&ID 설명 보고서 작성해줘')?.route, 'lit-schematic');
  assert.notEqual(detectRoute('lit P&ID 모니터링 대시보드 만들어줘')?.route, 'lit-schematic');
  assert.equal(detectRoute('lit diagram the service architecture').route, 'lit-diagram-drawer');
  assert.equal(detectRoute('lit fix the database schema migration').route, 'lit-loop');
});

test('the hook activation for lit-schematic names the installed SKILL.md', () => {
  const { env } = sandbox();
  const ws = workspace();
  const text = injected(turn(ws, env, 'lit schematic of the reactor loop', 0));
  assert.match(text, /LIT IGNITED/u);
  const file = join(PLUGIN, 'skills', 'lit-schematic', 'SKILL.md');
  assert.ok(text.includes(file), `activation names ${file}`);
});

test('orphan break-it: removing the schematic route entry makes enrollment fail', () => {
  const family = JSON.parse(readFileSync(new URL('./fixtures/family-skills.json', import.meta.url), 'utf8'));
  assert.ok(family.includes('lit-schematic'), 'lit-schematic in family list');
  assert.ok(SKILL_IDS.has('lit-schematic'), 'lit-schematic in SKILL_IDS');
  assert.ok(KEYWORD_ROUTES['schematic'] === 'lit-schematic', 'keyword route exists');
});

test('ISA-5.1 tag grammar reads valid tags and refuses broken ones', () => {
  for (const tag of ['PIC-101', 'PT-101', 'PSV-101', 'PSE-101', 'PAHH-101', 'TIC-201', 'FQI-3', 'LSL-5', 'TT-101A', 'XV-2']) {
    assert.ok(parseInstrumentTag(tag).ok, tag);
  }
  assert.equal(parseInstrumentTag('PSV-101').meaning, 'pressure safety valve');
  assert.equal(parseInstrumentTag('PIC-101').meaning, 'pressure indicating controlling');
  for (const tag of ['PCI-101', 'TTT-1', 'PH-1', 'pic101', 'PIC']) assert.ok(!parseInstrumentTag(tag).ok, tag);
  assert.ok(parseEquipmentTag('R-101').ok && parseEquipmentTag('P-101A').ok);
  assert.ok(!parseEquipmentTag('Reactor 1').ok);
});

test('symbol factories produce a box and ports with outward normals', () => {
  const factories = {
    vessel: () => S.vessel({ x: 50, y: 50, jacket: true, agitator: 'turbine', supports: 'legs' }),
    drum: () => S.drum({ x: 50, y: 50 }),
    pump: () => S.pump({ x: 50, y: 50, type: 'metering' }),
    exchanger: () => S.exchanger({ x: 50, y: 50 }),
    controlValve: () => S.valve({ x: 50, y: 50, type: 'globe', actuator: 'diaphragm', fail: 'FC', orient: 'up' }),
    instrument: () => S.instrument({ x: 50, y: 50, tag: 'PIC-101', location: 'dcs' }),
  };
  for (const [name, make] of Object.entries(factories)) {
    const sym = make();
    const [x0, y0, x1, y1] = sym.box;
    assert.ok(x1 > x0 && y1 > y0, `${name} box`);
    for (const p of sym.allPorts) {
      const inside = p.x >= x0 - 0.01 && p.x <= x1 + 0.01 && p.y >= y0 - 0.01 && p.y <= y1 + 0.01;
      assert.ok(inside, `${name}.${p.name} lies inside its box`);
    }
  }
});

test('the orthogonal router avoids obstacles and refuses an impossible path', () => {
  const obstacle = [60, 30, 80, 70];
  const points = routeOrthogonal({ from: { x: 20, y: 50, dir: [1, 0] }, to: { x: 120, y: 50, dir: [-1, 0] }, obstacles: [obstacle], lines: [[[40, 10], [40, 90]]], bounds: [0, 0, 200, 120] });
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    assert.ok(a[0] === b[0] || a[1] === b[1], 'orthogonal');
  }
  assert.throws(() => routeOrthogonal({ from: { x: 20, y: 50, dir: [1, 0] }, to: { x: 70, y: 50, dir: [-1, 0] }, obstacles: [[50, 0, 52, 120]], bounds: [0, 0, 100, 120] }), /no clear route/u);
});

test('the QA gate passes the worked examples and fails each defect class', () => {
  const out = mkdtempSync(join(tmpdir(), 'lit-schematic-examples-'));
  try {
    for (const example of readdirSync(join(skillRoot, 'examples'))) {
      const run = spawnSync(process.execPath, [join(skillRoot, 'examples', example, 'build.mjs'), out], { encoding: 'utf8' });
      assert.equal(run.status, 0, run.stderr);
      const svg = readFileSync(join(out, `${example}.svg`), 'utf8');
      assert.equal(check(svg).verdict, 'PASS', `${example}`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
  // One RED foil per QA code.
  const valve = box(40, 25, 50, 35, 'a:40,30,-1,0;b:50,30,1,0');
  assert.deepEqual(codes(doc('<svg')), ['XML.WELLFORMED']);
  assert.ok(codes(doc(`${label(10, 10, 'Feed gas')}${label(12, 10.5, 'Feed gas')}`)).includes('TEXT.OVERLAP'));
  assert.ok(codes(doc(label(10, 10, 'tiny', 1.2))).includes('TEXT.MIN_SIZE'));
  assert.ok(codes(doc(`${valve}${line('M10 30H90')}`)).includes('LINE.THROUGH_SYMBOL'));
  assert.ok(codes(doc(`${valve}${line('M20 30H40')}`)).includes('LINE.DANGLING'));
  assert.ok(codes(doc(`${line('M10 10H50V40', 'L1')}${line('M50 5V30', 'L2')}`)).includes('LINE.BEND_ON_LINE'));
  assert.ok(codes(doc(`${line('M10 10H60', 'L1')}${line('M30 10H80', 'L2')}`)).includes('LINE.OVERLAP'));
  assert.ok(codes(doc(`${line('M10 20H50', 'L1')}${label(25, 21, 'line no')}`)).includes('TEXT.ON_LINE'));
  assert.ok(codes(doc(box(10, 10, 20, 20, '', 'instrument.field', 'PCI-101'))).includes('TAG.GRAMMAR'));
});

test('the stream colour palette is CVD safe', () => {
  const roles = Object.values(STREAM).map((r) => r.color);
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      if (roles[i] === roles[j]) continue;
      for (const vision of ['normal', 'deuteranopia', 'protanopia', 'tritanopia']) {
        assert.ok(deltaE(roles[i], roles[j], vision) >= 9, `${roles[i]} vs ${roles[j]} under ${vision}`);
      }
    }
  }
});

test('isometric view uses full material colour by default and grey only on request', () => {
  const fills = (svg) => [...svg.matchAll(/fill="(#[0-9a-f]{6})"/giu)].map((m) => m[1].toLowerCase());
  const chroma = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b); };
  const hueFamilies = (list) => {
    const hues = list.filter((hex) => chroma(hex) >= 40).map((hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    });
    return new Set(hues.map((h) => Math.round(h / 30) % 12)).size;
  };
  const draw = (options) => {
    const v = createIsoView({ azimuth: 40, elevation: 26, ...options });
    v.box({ name: 'pad', plan: { x: -40, y: -40, w: 80, d: 80, r: 3 }, z: -6, h: 6, tone: 'lo', layer: -1 });
    v.box({ name: 'leg', plan: { x: -30, y: -30, w: 6, d: 6 }, z: 0, h: 20, tone: 'mid' });
    const shell = v.lathe({ name: 'shell', axis: 'z', origin: [0, 0, 20], profile: [[0, 0], [0, 30], [100, 30], [100, 0]], tone: 'hi', cut: { from: 15, to: 85, span: 90 }, wall: 3 });
    v.lathe({ name: 'shaft', axis: 'z', origin: [0, 0, 20], profile: [[10, 0], [10, 2], [110, 2], [110, 0]], tone: 'accent', into: shell });
    v.lathe({ name: 'jacket nozzle', axis: 'x', origin: [30, 0, 60], profile: [[0, 0], [0, 4], [14, 4], [14, 0]], tone: 'copper' });
    const fig = createFigure({ width: 'single', height: 70, title: 'Palette test' });
    fig.panel(null, [0, 0, 85, 70]).iso(v);
    return fig.render();
  };
  const material = draw({});
  assert.ok(hueFamilies(fills(material)) >= 3, 'the default view carries several material hue families');
  assert.equal(check(material).verdict, 'PASS');
  const grey = fills(draw({ palette: 'grey' })).filter((hex) => chroma(hex) >= 40);
  assert.ok(hueFamilies(grey) <= 2, 'the grey palette keeps only the accent coloured');
  assert.throws(() => createIsoView({ palette: 'neon' }), /palette/u);
});

test('PNG resolution helpers write and read correctly', () => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    const crcBuf = Buffer.alloc(4);
    let c = 0xffffffff;
    for (const b of Buffer.concat([Buffer.from(type, 'latin1'), data])) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcBuf.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
    return Buffer.concat([head, data, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2362, 0);
  ihdr.writeUInt32BE(10, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const png = withDpi(Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', Buffer.from([0])), chunk('IEND', Buffer.alloc(0))]), 600);
  const info = pngInfo(png);
  assert.equal(info.dpi, 600);
  assert.equal(info.closed, true);
});

test('scaffold writes a build wired to the installed kit and refuses the plugin directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lit-schematic-scaffold-'));
  try {
    const file = scaffold('pid', dir);
    assert.match(readFileSync(file, 'utf8'), /from "file:\/\/[^"]+\/lit-schematic\/scripts\/lib\/pid\.mjs"/u);
    const run = spawnSync(process.execPath, [file, dir], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.throws(() => scaffold('pid', dir), /already exists/u);
    assert.throws(() => scaffold('pid', join(skillRoot, 'scratch')), /inside the installed plugin/u);
    assert.ok(!existsSync(join(skillRoot, 'scratch', 'build.mjs')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(join(skillRoot, 'scratch'), { recursive: true, force: true });
  }
});

test('doctor reports and never installs', () => {
  const run = spawnSync(process.execPath, [join(skillRoot, 'scripts', 'doctor.mjs'), '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.ok(['PASS', 'DEGRADED', 'BLOCKED'].includes(report.status));
  assert.doesNotMatch(readFileSync(join(skillRoot, 'scripts', 'doctor.mjs'), 'utf8'), /npm install|brew install|apt-get/u);
});

test('SKILL.md never names a sibling product or another host', () => {
  for (const file of skillFiles) {
    const text = readFileSync(join(skillRoot, file), 'utf8');
    assert.doesNotMatch(text, /\blit(?:claude|hermes|codex|opencode|grok|muse)\b/iu, file);
  }
});

test('schematicIntent catches strong nouns alone and weak nouns with a draw verb', () => {
  assert.equal(schematicIntent('draw a P&ID of the hydrate reactor loop'), true);
  assert.equal(schematicIntent('isometric cutaway of the autoclave'), true);
  assert.equal(schematicIntent('실험 장치 모식도 만들어줘'), true);
  assert.equal(schematicIntent('PFD for the absorber section'), true);
  assert.equal(schematicIntent('draw the schematic for the pump'), true);
  assert.equal(schematicIntent('schematic pump'), false, 'weak noun without a draw verb');
  assert.equal(schematicIntent('단면도 데이터로 그래프 그려줘'), false, 'chart noun blocks');
  assert.equal(schematicIntent('P&ID 모니터링 대시보드 만들어줘'), false, 'interface noun without draw verb blocks');
  assert.equal(schematicIntent('P&ID 설명 보고서 작성해줘'), false, 'office deliverable without draw verb blocks');
});

test('pathPolylines samples arcs and curves from path data', () => {
  const [poly] = pathPolylines('M0 0A5 5 0 0 1 10 0');
  assert.ok(poly.points.length > 4);
  assert.ok(Math.min(...poly.points.map((p) => p[1])) < -4.9, 'a sweep-1 arc bulges up');
});

test('Chrome flags include the throwaway keychain for headless rendering', () => {
  assert.ok(CHROME_FLAGS.includes('--use-mock-keychain'));
  assert.ok(CHROME_FLAGS.includes('--password-store=basic'));
  assert.ok(CHROME_FLAGS.includes('--headless=new'));
});

test('export checks compare PNG resolution and PDF page size against the drawing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lit-schematic-exports-'));
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="60mm" viewBox="0 0 100 60" data-schematic-mode="figure"></svg>`;
    writeFileSync(join(dir, 'ok.png'), withDpi((() => {
      const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const chunk = (type, data) => {
        const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'latin1');
        const crcBuf = Buffer.alloc(4); let c = 0xffffffff;
        for (const b of Buffer.concat([Buffer.from(type, 'latin1'), data])) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
        crcBuf.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
        return Buffer.concat([head, data, crcBuf]);
      };
      const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2362, 0); ihdr.writeUInt32BE(10, 4); ihdr[8] = 8; ihdr[9] = 2;
      return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', Buffer.from([0])), chunk('IEND', Buffer.alloc(0))]);
    })(), 600));
    writeFileSync(join(dir, 'ok.pdf'), '%PDF-1.4\n1 0 obj << /Type /Page /MediaBox [0 0 283.46 170.08] >> endobj\n%%EOF\n');
    assert.deepEqual(checkExports({ svg, png: join(dir, 'ok.png'), pdf: join(dir, 'ok.pdf') }), []);
    writeFileSync(join(dir, 'low.png'), withDpi(readFileSync(join(dir, 'ok.png')), 150));
    const bad = checkExports({ svg, png: join(dir, 'low.png') }).map((f) => f.code);
    assert.ok(bad.includes('PNG.DPI'), 'low DPI is caught');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
