import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { detectRoute, deckIntent } from "../plugin/hooks/lib/routes.mjs";

const root = resolve(import.meta.dirname, "..");
const pptxRoot = join(root, "plugin", "skills", "lit-pptx");
const fixtures = join(root, "test", "fixtures", "lit-office");

const registryProbe = (code, env = {}) => spawnSync(process.execPath, ["-e",
  `const r = require(${JSON.stringify(join(pptxRoot, "scripts", "lib", "template-registry.js"))});${code}`],
  { encoding: "utf8", env: { ...process.env, ...env } });

const compile = (args, cwd) => spawnSync(process.execPath, [join(pptxRoot, "scripts", "compile-deck.js"), ...args],
  { cwd: cwd || root, encoding: "utf8" });

// Layout-family picker: choose the first available family for this tonality.
const pick = (fams, prefs, fallback) => prefs.find(p => fams.includes(p)) || fallback;
const listYaml = (yaml, key) => ((yaml.match(new RegExp(`^${key}: \\[([^\\]]*)\\]`, "m")) || [, ""])[1]).split(",").map(s => s.trim()).filter(Boolean);

function adaptTemplate(template, id) {
  const yaml = readFileSync(join(pptxRoot, "templates", "tonalities", id, "pack.yaml"), "utf8");
  const fams = listYaml(yaml, "layout-families");
  const closings = listYaml(yaml, "closings");
  const map = {
    tonality: id, cover: "cover",
    kpi: pick(fams, ["kpi-row", "kpi-over-chart", "dashboard-grid", "summary-box-list"], "kpi-row"),
    chart: pick(fams, ["chart-insight", "full-chart", "kpi-over-chart"], "chart-insight"),
    table: pick(fams, ["table-insight", "ledger-table"], "table-insight"),
    process: pick(fams, ["step-diagram", "process", "timeline", "method"], "process"),
    quote: pick(fams, ["quote", "statement"], "text-two-column"),
    closing: closings.includes("closing-ask") ? "closing-ask" : closings.includes("closing-decision-box") ? "closing-decision-box" : closings[0],
  };
  map.quoteBody = map.quote === "quote"
    ? "## Customer voice\n\n“We cut empty-mile runs by a third in one quarter, without adding a single truck.”\n\n— 예시 3PL 운영 책임자, 2026년 9월 인터뷰"
    : map.quote === "statement"
      ? "## “We cut empty-mile runs by a third in one quarter, without adding a truck.”\n\n— 예시 3PL 운영 책임자, 2026년 9월 인터뷰"
      : "## 고객사 인터뷰에서 나온 말\n\n:::: columns 1fr 1fr\n::: col\n- **운영 책임자, 예시 3PL**\n  (1) “한 분기 만에 공차 운행이 3분의 1 줄었고, 트럭은 한 대도 늘리지 않았다”\n  (2) 배차 담당자 한 명이 보는 차량이 25대에서 60대로 늘었다\n:::\n::: col\n- **물류 팀장, 예시 대형 화주**\n  (1) “지연을 고객 전화보다 40분 먼저 안다”\n  (2) 시범 2주 만에 전 권역 확대를 결정했다\n:::\n::::\n\n- 두 고객사 모두 공차 운행과 전화 응대가 함께 줄었다고 답했다";
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? `{{${k}}}`);
}

// -- Tonality packs and the slide grid --

const TONALITIES = [
  "atlas", "bauhaus", "chalk", "computational-brutalism", "gazette", "ledger",
  "neo-brutalism", "newsroom", "night", "paper", "riso", "signal", "studio",
];

describe("lit-pptx tonality packs, slide grid and pack keys", () => {

  it("lists all thirteen tonalities, each loadable with no error", () => {
    const probe = registryProbe(`
      const all = r.listTonalities();
      console.log(JSON.stringify(all));
      for (const id of all) r.loadPack(id);
    `);
    assert.equal(probe.status, 0, probe.stderr);
    assert.deepEqual(JSON.parse(probe.stdout), TONALITIES);
  });

  it("no two tonalities share both their title treatments and their layout families", () => {
    const probe = registryProbe(`
      const packs = r.listTonalities().map(id => r.loadPack(id));
      const key = p => [...p.treatments].sort() + "|" + [...p["layout-families"]].sort();
      const collisions = [];
      for (let i = 0; i < packs.length; i++)
        for (let j = i + 1; j < packs.length; j++)
          if (key(packs[i]) === key(packs[j])) collisions.push(packs[i].id + " vs " + packs[j].id);
      console.log(JSON.stringify(collisions));
    `);
    assert.equal(probe.status, 0, probe.stderr);
    assert.deepEqual(JSON.parse(probe.stdout), []);
  });

  it("the slide grid places every content title on [24,36,756,72] and every display title on [24,132,678,216]", () => {
    const probe = registryProbe(`
      const SG = require(${JSON.stringify(join(pptxRoot, "scripts", "lib", "slide-grid.js"))});
      const ct = SG.zone("16:9", "content", "title");
      const dt = SG.zone("16:9", "display", "title");
      console.log(JSON.stringify({ ct: [ct.x, ct.y, ct.w, ct.h], dt: [dt.x, dt.y, dt.w, dt.h] }));
    `);
    assert.equal(probe.status, 0, probe.stderr);
    const z = JSON.parse(probe.stdout);
    assert.deepEqual(z.ct, [24, 36, 756, 72]);
    assert.deepEqual(z.dt, [24, 132, 678, 216]);
  });

  it("every treatment in every tonality resolves against the shared slide grid with no crash", () => {
    const probe = registryProbe(`
      const G = require(${JSON.stringify(join(pptxRoot, "scripts", "lib", "grid-resolver.js"))});
      const SG = require(${JSON.stringify(join(pptxRoot, "scripts", "lib", "slide-grid.js"))});
      const T = SG.zone("16:9", "content", "title");
      const B = SG.zone("16:9", "content", "body");
      const errs = [];
      for (const id of r.listTonalities()) {
        const t = r.loadTonality(id);
        const pack = t.pack;
        for (const treatment of pack.treatments) {
          try {
            const ctx = { grid: pack.grid, sizes: pack.tok.sizes, title: "Sample Title Text",
              hero: pack.hero, decoration: new Set(pack.decoration || []), numeral: "01",
              rail: pack.rail, wide: { title: s => G.faceWidth(pack.faces.title, s), display: s => G.faceWidth(pack.faces.display, s) },
              tight: Boolean(pack.tok.tight) };
            const frame = G.treatmentGeometry(treatment, ctx);
            if (frame.title.x !== T.x || frame.title.y !== T.y) {
              if (treatment !== "statement" && treatment !== "overlay")
                errs.push(id + "/" + treatment + ": title at " + frame.title.x + "," + frame.title.y + " vs " + T.x + "," + T.y);
            }
            if (frame.body && (frame.body.y !== B.y || frame.body.y + (frame.body.bottom - frame.body.y) !== B.y + B.h)) {
              if (treatment !== "statement" && treatment !== "overlay")
                errs.push(id + "/" + treatment + ": body at " + frame.body.y + " vs " + B.y);
            }
          } catch (e) {
            errs.push(id + "/" + treatment + ": " + e.message);
          }
        }
      }
      console.log(JSON.stringify(errs));
    `);
    assert.equal(probe.status, 0, probe.stderr);
    const errs = JSON.parse(probe.stdout);
    assert.deepEqual(errs, [], "0 title/body position differences across all 13 tonalities");
  });

  it("edge-weight, shadow, qa allowances and register validate correctly", () => {
    const dir = mkdtempSync(join(tmpdir(), "lit-pptx-pack-"));
    try {
      const neo = readFileSync(join(pptxRoot, "templates", "tonalities", "neo-brutalism", "pack.yaml"), "utf8");
      const mono = readFileSync(join(pptxRoot, "templates", "tonalities", "computational-brutalism", "pack.yaml"), "utf8");
      const plant = (id, source, from, edit) => {
        mkdirSync(join(dir, id), { recursive: true });
        writeFileSync(join(dir, id, "pack.yaml"), edit(source.replace(`id: ${from}`, `id: ${id}`)));
      };
      plant("heavy-edge", neo, "neo-brutalism", s => s.replace(/^edge-weight: .*$/mu, "edge-weight: 6"));
      plant("far-shadow", neo, "neo-brutalism", s => s.replace(/^ {2}offset: 6$/mu, "  offset: 14"));
      plant("pink-shadow", neo, "neo-brutalism", s => s.replace(/^ {2}colour: ink$/mu, "  colour: hotpink"));
      plant("flat-shadow", neo, "neo-brutalism", s => s.replace(/^edge: .*$/mu, "edge: fill"));
      plant("loose-qa", neo, "neo-brutalism", s => s.replace(/^ {2}offset-shadow: true$/mu, "  offset-shadow: true\n  contrast: 2"));
      plant("wide-qa", neo, "neo-brutalism", s => s.replace(/^ {2}offset-shadow: true$/mu, "  offset-shadow: true\n  accent-families: 9"));
      plant("narrow-qa", neo, "neo-brutalism", s => s.replace(/^ {2}offset-shadow: true$/mu, "  offset-shadow: true\n  accent-families: 3"));
      plant("no-shadow", neo, "neo-brutalism", s => s.replace(/^shadow:\n {2}offset: 6\n {2}colour: ink\n/mu, ""));
      plant("banded-marks", mono, "computational-brutalism", s => s.replace(/^treatments: \[top-rule, /mu, "treatments: [band, top-rule, "));
      plant("mono-body", mono, "computational-brutalism", s => s.replace(/^ {2}body: Pretendard Regular$/mu, "  body: JetBrains Mono Regular"));
      plant("loud-report", neo, "neo-brutalism", s => s.replace(/^register: bold\n/mu, ""));
      plant("odd-register", neo, "neo-brutalism", s => s.replace(/^register: bold$/mu, "register: shouty"));
      const load = id => registryProbe(
        `try { r.loadPack(${JSON.stringify(id)}); console.log("loaded"); } catch (e) { console.log(e.message); }`,
        { LIT_PPTX_TONALITY_DIRS: dir }).stdout;
      assert.match(load("heavy-edge"), /edge-weight must be 0\.5-4 pt/u);
      assert.match(load("far-shadow"), /shadow\.offset must be 3-10 pt/u);
      assert.match(load("pink-shadow"), /shadow\.colour must name a palette role/u);
      assert.match(load("flat-shadow"), /a shadow needs a bordered edge/u);
      assert.match(load("loose-qa"), /unknown qa allowance "contrast"/u);
      assert.match(load("wide-qa"), /qa\.accent-families is out of range/u);
      assert.match(load("narrow-qa"), /qa\.accent-families is out of range/u);
      assert.match(load("no-shadow"), /qa\.offset-shadow needs a shadow/u);
      assert.match(load("banded-marks"), /grid-marks needs the top margin on the ground/u);
      assert.match(load("mono-body"), /faces\.body must be a face that sets Hangul/u);
      assert.match(load("loud-report"), /presented type needs register: bold/u);
      assert.match(load("odd-register"), /register must be report or bold/u);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("takes extra decoration kinds and the calm hero opt-out from front matter", () => {
    const probe = registryProbe(`
      const base = r.loadTonality("paper").pack;
      const more = r.loadTonality("paper", { decoration: "numeral, column-hairlines" }).pack;
      const calm = r.loadTonality("paper", { hero: "false" }).pack;
      const tryLoad = (id, decoration) => { try { r.loadTonality(id, { decoration }); return "loaded"; } catch (e) { return e.message; } };
      console.log(JSON.stringify({ base: base.decoration, more: more.decoration, hero: [base.hero, calm.hero], unknown: tryLoad("paper", "sparkles"), marks: tryLoad("ledger", "grid-marks") }));
    `);
    assert.equal(probe.status, 0, probe.stderr);
    const out = JSON.parse(probe.stdout);
    assert.ok(!out.base.includes("numeral"), "paper has no numeral decoration by itself");
    assert.deepEqual(out.more, [...new Set([...out.base, "numeral", "column-hairlines"])]);
    assert.deepEqual(out.hero, [true, false], "hero: false is the calm opt-out");
    assert.match(out.unknown, /decoration "sparkles" is not a known kind/u);
    assert.match(out.marks, /grid-marks needs the top margin on the ground/u);
  });

  it("JetBrains Mono font hashes match provenance.json", () => {
    const provenance = JSON.parse(readFileSync(join(pptxRoot, "fonts", "provenance.json"), "utf8"));
    const jbm = provenance["jetbrains-mono"];
    assert.ok(jbm, "jetbrains-mono entry exists in provenance.json");
    assert.equal(jbm.release, "v2.304");
    for (const entry of jbm.files) {
      const data = readFileSync(join(pptxRoot, "fonts", entry.file));
      assert.equal(data.length, entry.bytes, `${entry.file} size`);
      const hash = createHash("sha256").update(data).digest("hex");
      assert.equal(hash, entry.sha256, `${entry.file} sha256`);
    }
    assert.match(readFileSync(join(pptxRoot, "fonts", "jetbrains-mono", "OFL.txt"), "utf8"), /SIL Open Font License/u);
    assert.doesNotMatch(readFileSync(join(pptxRoot, "fonts", "jetbrains-mono", "OFL.txt"), "utf8"), /with Reserved Font Name/u);
    assert.match(jbm.license, /unmodified/u);
  });

  it("no tonality pack is an orphan: each has a sheet, an example, and a place in direction-step", () => {
    const refs = join(pptxRoot, "references");
    const sheets = readFileSync(join(refs, "direction-step.md"), "utf8");
    const skill = readFileSync(join(pptxRoot, "SKILL.md"), "utf8");
    for (const id of TONALITIES) {
      const sheet = join(refs, "tonalities", `${id}.md`);
      assert.ok(readFileSync(sheet, "utf8").length > 100, `${id}: sheet exists and is not empty`);
      assert.ok(sheets.includes(id), `${id}: listed in direction-step.md`);
    }
    assert.match(skill, /thirteen/iu, "SKILL.md says thirteen tonalities");
    assert.match(skill, /seventeen/iu, "SKILL.md says seventeen examples");
  });
});

// -- Per-tonality compilation from the adapted sample template --

describe("sample deck compilation per tonality", () => {

  it("compiles an adapted sample in every tonality without error", () => {
    const template = readFileSync(join(fixtures, "sample-deck-template.md"), "utf8");
    const dir = mkdtempSync(join(tmpdir(), "lit-pptx-samples-"));
    try {
      for (const id of TONALITIES) {
        const md = adaptTemplate(template, id);
        const deckPath = join(dir, `${id}.md`);
        writeFileSync(deckPath, md);
        const r = compile([deckPath, "--pptx", join(dir, `${id}.pptx`)]);
        assert.equal(r.status, 0, `${id}: compile failed\n${r.stderr}`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// -- Deck routes --

describe("deck route detection", () => {

  it("routes a deck asked for by slide count and a named style, with no making verb", () => {
    for (const prompt of [
      "lit 신규 서비스 투자 피칭 덱 10장, 네오 브루탈리즘 스타일로",
      "lit 사내 플랫폼 아키텍처 리뷰 발표자료 9장, 컴퓨테이셔널 브루탈리즘 스타일로",
      "lit 디자인사 강의 슬라이드 12장 바우하우스 느낌으로",
      "lit a 10-slide engineering review deck in computational brutalism style",
    ]) {
      const r = detectRoute(prompt);
      assert.ok(r, `${prompt}: detected`);
      assert.equal(r.route, "lit-pptx", `${prompt}: routed to lit-pptx`);
    }
  });

  it("a photo count is not a deck: no slide noun, no route", () => {
    assert.ok(!deckIntent("사진 10장 보정 스타일로"));
  });

  it("deckIntent detects slide-count phrasing without a verb", () => {
    assert.ok(deckIntent("신규 서비스 투자 피칭 덱 10장, 네오 브루탈리즘 스타일로"));
    assert.ok(deckIntent("a 10-slide deck in computational brutalism style"));
    assert.ok(!deckIntent("사진 10장 보정"));
    assert.ok(!deckIntent("이미지 5장 편집"));
  });
});

describe("render_pages font profile", () => {
  it("copies embedded OpenType and TrueType parts into the soffice profile and skips the rest", () => {
    const dir = mkdtempSync(join(tmpdir(), "lg-profile-"));
    try {
      const code = [
        "import sys, zipfile, pathlib",
        `sys.path.insert(0, ${JSON.stringify(join(pptxRoot, "scripts"))})`,
        "import render_pages as r",
        "d = pathlib.Path(sys.argv[1])",
        "with zipfile.ZipFile(d / 'deck.pptx', 'w') as z:",
        "    z.writestr('ppt/fonts/font1.fntdata', b'OTTO' + b'x' * 8)",
        "    z.writestr('ppt/fonts/font2.fntdata', b'\\x00\\x01\\x00\\x00' + b'x' * 8)",
        "    z.writestr('ppt/fonts/font3.fntdata', b'EOT!' + b'x' * 8)",
        "out = r.profile_fonts(d / 'deck.pptx', d / 'profile')",
        "print(sorted(p.name for p in out))",
        "(d / 'bad.pptx').write_bytes(b'not a zip')",
        "print(r.profile_fonts(d / 'bad.pptx', d / 'profile'))",
      ].join("\n");
      const run = spawnSync("python3", ["-I", "-B", "-c", code, dir], { encoding: "utf8" });
      assert.equal(run.status, 0, run.stderr);
      assert.deepEqual(run.stdout.trim().split("\n"), ["['font1.otf', 'font2.ttf']", "[]"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
