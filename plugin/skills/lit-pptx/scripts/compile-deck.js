#!/usr/bin/env node
"use strict";

/**
 * compile-deck.js — Compile a Markdown deck into a versioned slide AST,
 *                    and optionally render to HTML or PPTX.
 *
 * Usage:
 *   node compile-deck.js input.md --ast out.json
 *   node compile-deck.js input.md                         (prints JSON to stdout)
 *   node compile-deck.js input.md --template AZURE-PRO --html out.html
 *   node compile-deck.js input.md --template AZURE-PRO --pptx out.pptx
 *   node compile-deck.js input.md --template AZURE-PRO --ast out.json --html out.html --pptx out.pptx
 *
 * API:
 *   const compileDeck = require('./compile-deck');
 *   const ast = compileDeck(markdownSource);
 */

const fs = require("fs");
const path = require("path");

const { load: loadMarkdown } = require("./lib/markdown-loader");
const { validate: validateContent } = require("./lib/directive-parser");
const { buildBlocks, buildAst } = require("./lib/slide-ast");
const { validate: validateAst } = require("./lib/spec-validator");

// Lazy-loaded modules — may not exist yet (built by another agent)
let templateRegistry = null;
let layoutResolver = null;
let renderHtml = null;
let renderPptx = null;

try {
  templateRegistry = require("./lib/template-registry");
} catch (_) { /* template-registry not yet available */ }

try {
  layoutResolver = require("./lib/layout-resolver");
} catch (_) { /* layout-resolver not yet available */ }

try {
  renderHtml = require("./lib/render-adapter-html");
} catch (_) { /* render-adapter-html not yet available */ }

try {
  renderPptx = require("./lib/render-adapter-pptx");
} catch (_) { /* render-adapter-pptx not yet available */ }

/**
 * Compile a Markdown source string into a slide AST.
 * @param {string} source — Raw Markdown deck content
 * @returns {object} — AST conforming to slide-ast-v1.schema.json
 */
function compileDeck(source) {
  // 1. Parse frontmatter and split into slides
  const { deck, slides } = loadMarkdown(source);

  // 2. Validate content and build AST for each slide
  const parsedSlides = slides.map((slide) => {
    // Validate for forbidden constructs (HTML/CSS, nested directives)
    validateContent(slide.content, slide.index);

    // Build AST blocks
    const blocks = buildBlocks(slide.layout, slide.content);

    return {
      index: slide.index,
      layout: slide.layout,
      ...(slide.meta && Object.keys(slide.meta).length > 0 ? { meta: slide.meta } : {}),
      blocks,
    };
  });

  // 3. Assemble complete AST
  const ast = buildAst(deck, parsedSlides);

  // 4. Validate the assembled AST
  validateAst(ast);

  return ast;
}

// Bundled faces, by the family a template names. A chart drawn outside this
// skill needs the file, not the family: matplotlib resolves a Korean family by
// registering the file and reading its internal name, which is the failure this
// export exists to prevent.
const BUNDLED_FONTS = [
  { match: /Pretendard/i, dir: "fonts/pretendard",
    files: ["Pretendard-Regular.otf", "Pretendard-Bold.otf"] },
  { match: /에이투지체/, dir: "fonts/a2z",
    files: ["A2Z-Regular.otf", "A2Z-Bold.otf"] },
];

/**
 * Describe a template's visual system for a chart drawn elsewhere.
 *
 * A chart belongs to the scientific visualization skill, not to this skill, and the
 * reason charts end up looking foreign in a deck is that the tool drawing them
 * cannot see the deck's colours, typeface or canvas. This hands those over.
 *
 * @param {object} templateObj — loaded template, after any accent or font override
 * @returns {object}
 */
function vizContext(templateObj) {
  const tpl = (templateObj && templateObj.template) || {};
  const palette = tpl.palette || {};
  const dims = tpl.dimensions || {};
  const family = (tpl.fonts && tpl.fonts.body) || "";

  const bundle = BUNDLED_FONTS.find((f) => f.match.test(family));
  const files = bundle
    ? bundle.files
        .map((name) => path.join(__dirname, "..", bundle.dir, name))
        .filter((p) => fs.existsSync(p))
    : [];

  // Series order runs strongest to quietest so a two-line chart reads without a
  // legend and a four-line one still separates.
  const series = [palette.primary, palette.azure_soft, palette.primary_deep, palette.ink_muted]
    .filter(Boolean);

  return {
    template: templateObj.name,
    palette: { ...palette, series },
    fonts: { family, files, bundled: files.length > 0 },
    canvas: { width: dims.width, height: dims.height, unit: dims.unit || "in" },
    dpi: 200,
  };
}

/**
 * Resolve an AST against a template and render to the requested formats.
 * @param {object} ast - Compiled AST
 * @param {string} templateName - Template name (e.g. AZURE-PRO)
 * @param {object} outputs - { html: path|null, pptx: path|null }
 */
async function resolveAndRender(ast, templateName, outputs, options = {}) {
  if (!templateRegistry) {
    throw new Error("template-registry module not available. Cannot resolve template.");
  }
  if (!layoutResolver) {
    throw new Error("layout-resolver module not available. Cannot resolve layouts.");
  }

  // A tonality (flag or frontmatter) is a design direction read from a pack; without one the named
  // template loads as a legacy pack and keeps its own look.
  const meta = (ast.deck && ast.deck.metadata) || {};
  const tonality = options.tonality || meta.tonality || null;
  const templateObj = tonality
    ? templateRegistry.loadTonality(tonality, { density: meta.density, variance: meta.variance, canvas: meta.canvas, faces: options.faces || meta.faces, hero: meta.hero, decoration: meta.decoration })
    : templateRegistry.loadTemplate(templateName);
  if (tonality) {
    const d = templateObj.pack.dials;
    console.log(`Tonality ${templateObj.pack.id} · density ${d.density} · variance ${d.variance} · ${d.canvas} ${templateObj.pack.grid.name} grid` +
      (templateName && templateName !== tonality ? ` (template ${templateName} not used)` : ""));
  }
  const can = (capability) => templateRegistry.hasCapability(templateObj, capability);

  // Font override (templates with the font-swap capability): swap the whole font system
  // regardless of which template was chosen. Applied before accent (independent of colour).
  if (options.font && can("font-swap")) {
    const { applyFont, KEYS } = require("./lib/font-map");
    if (KEYS.includes(options.font)) {
      applyFont(templateObj, options.font);
      console.log(`Font → ${options.font}`);
    }
  }

  const resolved = layoutResolver.resolve(ast, templateObj);
  if (options.sourceDir) resolved.sourceDir = options.sourceDir;

  // Custom accent recolor (templates with the recolor capability): derive a WCAG-safe
  // palette from the accent hex, override template tokens + hardcoded decoration
  // colors, and regenerate the gradient circle PNGs in the new hue.
  if (options.accent && can("recolor")) {
    const { derivePalette, defaultToDerivedMap } = require("./lib/derive-palette");
    const { genGradientAssets } = require("./lib/gen-gradient-assets");
    const os = require("os");
    const derived = derivePalette(options.accent);
    templateObj.template.palette = { ...(templateObj.template.palette || {}), ...derived };
    templateObj.template.global_typography = {
      ...(templateObj.template.global_typography || {}),
      bullet_color: derived.bullet_color,
      section_accent: derived.section_accent,
    };
    const map = defaultToDerivedMap(derived);
    const remap = (obj, keys) => {
      for (const k of keys) {
        if (obj[k]) {
          const key = "#" + String(obj[k]).replace("#", "").toUpperCase();
          if (map.has(key)) obj[k] = map.get(key);
        }
      }
    };
    // font_role colors are hardcoded in capabilities.yaml (eyebrow/kpi use the
    // default primary etc.) — remap them too, else they leak the old hue.
    const roles = templateObj.capabilities && templateObj.capabilities.font_roles;
    if (roles) for (const r of Object.values(roles)) remap(r, ["color", "fill"]);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "azure-accent-"));
    await genGradientAssets(derived.gradient, tmpDir);
    const seen = new Set();
    for (const slide of resolved.slides || []) {
      for (const d of slide.decorations || []) {
        if (seen.has(d)) continue; // decoration objects are shared across slides
        seen.add(d);
        remap(d, ["fill", "line", "color"]);
        if (d.dir === "azure" && d.asset) d.assetPath = path.join(tmpDir, d.asset);
      }
    }
    console.log(`Accent ${options.accent} → primary ${derived.primary} (white-contrast ${derived._ratios.whiteOnPrimary}:1)`);
  }

  // Blurred gradient-mesh background (mesh-background capability): ambient wash on cover/closing/
  // content (light) and a deep textured wash on section dividers (dark). Uses the
  // ACTIVE palette (so it respects --accent). The dark mesh sits ABOVE the base
  // section fill rect, so qa_deck still resolves the (dark) fill behind white text.
  if (options.bg === "mesh" && can("mesh-background")) {
    const { genMeshBg } = require("./lib/gen-bg");
    const os = require("os");
    const dims = templateObj.template.dimensions || {};
    const pageW = dims.width || 13.333;
    const pageH = dims.height || 7.5;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "azure-bg-"));
    const { light, dark } = await genMeshBg(templateObj.template.palette || {}, tmpDir);
    for (const slide of resolved.slides || []) {
      const decs = slide.decorations || (slide.decorations = []);
      const fullBleed = { type: "image", x: 0, y: 0, w: pageW, h: pageH };
      if (slide.layout === "section") {
        const rectIdx = decs.findIndex((d) => d.type === "rect" && (d.w || 0) >= pageW - 0.2);
        decs.splice(rectIdx >= 0 ? rectIdx + 1 : 0, 0, { ...fullBleed, assetPath: dark });
      } else {
        decs.unshift({ ...fullBleed, assetPath: light });
      }
    }
    console.log(`Background: mesh (${(resolved.slides || []).length} slides)`);
  }

  const tasks = [];

  if (outputs.html) {
    if (!renderHtml) {
      throw new Error("render-adapter-html module not available.");
    }
    const html = renderHtml.render(resolved, templateObj);
    tasks.push(
      fs.promises.writeFile(outputs.html, html, "utf-8").then(() => {
        console.log(`HTML written to ${outputs.html}`);
      })
    );
  }

  if (outputs.pptx) {
    if (!renderPptx) {
      throw new Error("render-adapter-pptx module not available.");
    }
    tasks.push(
      renderPptx.render(resolved, templateObj, outputs.pptx).then(() => {
        console.log(`PPTX written to ${outputs.pptx}`);
      })
    );
  }

  if (outputs.vizContext) {
    const ctx = vizContext(templateObj);
    fs.writeFileSync(outputs.vizContext, JSON.stringify(ctx, null, 2), "utf-8");
    console.log(`Visualization context written to ${outputs.vizContext}`);
  }

  await Promise.all(tasks);
  return resolved;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);

  // Introspection flags — let an agent discover template capabilities before authoring.
  if (args[0] === "--list-templates") {
    const reg = require("./lib/template-registry");
    for (const name of reg.listTemplates()) {
      let label = "";
      try {
        const t = reg.loadTemplate(name);
        const d = (t.template && t.template.dimensions) || {};
        label = ` — ${(t.template && t.template.label) || ""} [${d.width}x${d.height}${d.unit ? d.unit[0] : ""}]`;
      } catch (_) {}
      console.log(`${name}${label}`);
    }
    process.exit(0);
  }
  if (args[0] === "--list-tonalities") {
    const reg = require("./lib/template-registry");
    for (const id of reg.listTonalities()) {
      const p = reg.loadPack(id);
      console.log(`${id} — ${p.intent} [density ${p.density}, variance ${p.variance}; ${p.treatments.join(", ")}]`);
    }
    for (const name of reg.listTemplates()) console.log(`${name} (legacy template)`);
    process.exit(0);
  }
  if (args[0] === "--list-layouts" && args[1]) {
    const reg = require("./lib/template-registry");
    if (reg.listTonalities().includes(String(args[1]).toLowerCase())) {
      // A tonality lists its families with the titles each can take there, and its variants.
      const G = require("./lib/grid-resolver");
      const p = reg.loadPack(args[1]);
      console.log(`${p.id} — ${p.intent}`);
      console.log(`treatments: ${p.treatments.join(", ")}`);
      console.log("layout families:");
      for (const f of p["layout-families"]) {
        console.log(`  ${f} [${G.familyAllows(f).filter((t) => p.treatments.includes(t)).join(", ")}]`);
      }
      console.log(`covers: ${p.covers.join(", ")}`);
      console.log(`sections: ${p.sections.join(", ")}`);
      console.log(`closings: ${p.closings.join(", ")}`);
      process.exit(0);
    }
    if (!reg.listTemplates().includes(args[1])) {
      console.error(`Unknown tonality or template "${args[1]}". Tonalities: ${reg.listTonalities().join(", ")}; legacy templates: ${reg.listTemplates().join(", ")}`);
      process.exit(1);
    }
    const t = reg.loadTemplate(args[1]);
    const layouts = (t.mapping && t.mapping.layouts) || {};
    const caps = (t.capabilities && t.capabilities.supported_blocks) || {};
    for (const [layout, def] of Object.entries(layouts)) {
      const regions = Object.keys((def && def.regions) || {});
      console.log(`${layout}:`);
      console.log(`  blocks:  ${(caps[layout] || []).join(", ")}`);
      console.log(`  regions: ${regions.join(", ")}`);
    }
    process.exit(0);
  }

  if (args.length === 0) {
    console.error("Usage:");
    console.error("  node compile-deck.js --list-templates");
    console.error("  node compile-deck.js --list-tonalities");
    console.error("  node compile-deck.js --list-layouts <template or tonality>");
    console.error("  node compile-deck.js <input.md> [--ast out.json]");
    console.error("  node compile-deck.js <input.md> --template <name> --html out.html");
    console.error("  node compile-deck.js <input.md> --template <name> --pptx out.pptx");
    console.error("  node compile-deck.js <input.md> --tonality <id> --pptx out.pptx   (or tonality: in the frontmatter)");
    console.error("  node compile-deck.js <input.md> --tonality <id> --faces a2z --pptx out.pptx   (A2Z faces on request; Pretendard by default)");
    console.error("  node compile-deck.js <input.md> --template <name> --ast out.json --html out.html --pptx out.pptx");
    console.error("  node compile-deck.js <input.md> --template <name> --export-viz-context ctx.json");
    process.exit(1);
  }

  const inputPath = args[0];
  let astPath = null;
  let templateName = null;
  let htmlPath = null;
  let pptxPath = null;
  let embedFonts = false;
  let facesFlag = null;
  let accent = null;
  let font = null;
  let bg = null;
  let vizContextPath = null;
  let tonalityFlag = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--embed-fonts") { embedFonts = true; continue; }
    if (args[i] === "--accent" && args[i + 1]) { accent = args[i + 1]; i++; continue; }
    if (args[i] === "--font" && args[i + 1]) { font = args[i + 1]; i++; continue; }
    if (args[i] === "--bg" && args[i + 1]) { bg = args[i + 1]; i++; continue; }
    if (args[i] === "--export-viz-context" && args[i + 1]) { vizContextPath = args[i + 1]; i++; continue; }
    if (args[i] === "--tonality" && args[i + 1]) { tonalityFlag = args[i + 1]; i++; continue; }
    if (args[i] === "--faces" && args[i + 1]) { facesFlag = args[i + 1]; i++; continue; }
    if (args[i] === "--ast" && args[i + 1]) {
      astPath = args[i + 1];
      i++;
    } else if (args[i] === "--template" && args[i + 1]) {
      templateName = args[i + 1];
      i++;
    } else if (args[i] === "--html" && args[i + 1]) {
      htmlPath = args[i + 1];
      i++;
    } else if (args[i] === "--pptx" && args[i + 1]) {
      pptxPath = args[i + 1];
      i++;
    }
  }

  let source = fs.readFileSync(inputPath, "utf-8");

  // A render needs a design: --template, --tonality, or a tonality: line in the frontmatter.
  const frontTonality = (source.match(/^---[ \t]*\n([\s\S]*?)\n---/) || ["", ""])[1].match(/^tonality:[ \t]*(\S+)/m);
  if ((htmlPath || pptxPath || vizContextPath) && !templateName && !tonalityFlag && !frontTonality) {
    console.error("Error: --template or --tonality (or tonality: in the frontmatter) is required when using --html, --pptx or --export-viz-context");
    process.exit(1);
  }
  const sourceDir = path.dirname(path.resolve(inputPath));

  // A `data:` frontmatter key means the numbers live in a CSV/JSON file: the shared
  // resolver computes derived values, runs the declared checks and fills {{ … }}.
  const frontmatter = source.match(/^---[ \t]*\n([\s\S]*?)\n---/);
  if (frontmatter && /^data:[ \t]*\S/m.test(frontmatter[1])) {
    const { spawnSync } = require("child_process");
    const resolved = spawnSync("python3", ["-B", path.resolve(__dirname, "office_data.py"), "resolve", path.resolve(inputPath)], {
      encoding: "utf8",
    });
    if (resolved.status !== 0) {
      console.error(`Data error: ${(resolved.stderr || resolved.error || "").toString().trim().replace(/^office_data: /, "")}`);
      process.exit(1);
    }
    source = resolved.stdout;
  }

  (async () => {
    try {
      const ast = compileDeck(source);

      // Accent: CLI flag wins, else frontmatter `accent:`.
      const effectiveAccent = accent
        || (ast.deck && ast.deck.accent)
        || (ast.deck && ast.deck.metadata && ast.deck.metadata.accent)
        || null;
      const effectiveFont = font
        || (ast.deck && ast.deck.font)
        || (ast.deck && ast.deck.metadata && ast.deck.metadata.font)
        || null;
      const effectiveBg = bg
        || (ast.deck && ast.deck.background)
        || (ast.deck && ast.deck.metadata && ast.deck.metadata.background)
        || null;

      // Write AST if requested
      if (astPath) {
        const json = JSON.stringify(ast, null, 2);
        fs.writeFileSync(astPath, json, "utf-8");
        console.log(`AST written to ${astPath}`);
      }

      // Resolve and render if template + output formats specified
      if (htmlPath || pptxPath || vizContextPath) {
        await resolveAndRender(ast, templateName, {
          html: htmlPath,
          pptx: pptxPath,
          vizContext: vizContextPath,
        }, { sourceDir, accent: effectiveAccent, font: effectiveFont, bg: effectiveBg, tonality: tonalityFlag, faces: facesFlag });

        // Optional: embed bundled fonts into the PPTX for a self-contained deck.
        if (embedFonts && pptxPath) {
          const { execFileSync } = require("child_process");
          execFileSync("python3", [path.join(__dirname, "embed_fonts.py"), pptxPath], {
            stdio: "inherit",
          });
        }
      } else if (!astPath) {
        // No outputs specified — print AST to stdout
        console.log(JSON.stringify(ast, null, 2));
      }
    } catch (err) {
      console.error(`Compilation error: ${err.message}`);
      process.exit(1);
    }
  })();
}

module.exports = compileDeck;
module.exports.vizContext = vizContext;
