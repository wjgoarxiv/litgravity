"use strict";

/**
 * layout-resolver.js — Resolve AST slides against a template's layout mapping.
 *
 * Takes a compiled AST (from compile-deck.js) and a loaded template object
 * (from template-registry.js) and produces a render-ready resolved spec with
 * positioned regions and decoration elements for each slide.
 *
 * API:
 *   const { resolve } = require('./layout-resolver');
 *   const resolved = resolve(ast, templateObj);
 */

// ---------------------------------------------------------------------------
// Minimal YAML parser (no external dependencies)
// Handles: key: value, nested maps via indentation, lists with "- ", comments
// ---------------------------------------------------------------------------

/**
 * Parse a YAML string into a JS object.
 * Supports: maps, scalar values, quoted strings, dash lists, comments.
 * @param {string} text — Raw YAML content
 * @returns {object}
 */
function parseYaml(text) {
  const lines = text.split("\n");
  return parseBlock(lines, 0).value;
}

/**
 * Parse a block of YAML lines starting at a given indent level.
 * Returns { value, end } where end is the next unparsed line index.
 */
function parseBlock(lines, start) {
  if (start >= lines.length) return { value: null, end: lines.length };

  const firstLine = stripComment(lines[start]);
  const firstIndent = leadingSpaces(lines[start]);

  // Empty/blank first line — skip ahead
  if (!firstLine.trim()) {
    return parseBlock(lines, start + 1);
  }

  // Determine if this is a list block or map block
  if (firstLine.trimStart().startsWith("- ")) {
    return parseList(lines, start, firstIndent);
  }

  return parseMap(lines, start, firstIndent);
}

/**
 * Parse a YAML map block at a given indent level.
 */
function parseMap(lines, start, baseIndent) {
  const obj = {};
  let i = start;

  while (i < lines.length) {
    const raw = lines[i];
    const line = stripComment(raw);
    const indent = leadingSpaces(raw);

    // Blank line — skip
    if (!line.trim()) { i++; continue; }

    // Dedent — end of this map
    if (indent < baseIndent) break;

    // List item at our indent — not part of this map
    if (line.trimStart().startsWith("- ") && indent === baseIndent) break;

    // Expect key: value
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) { i++; continue; }

    const key = line.substring(0, colonIdx).trim();
    const afterColon = line.substring(colonIdx + 1).trim();

    if (afterColon === "") {
      // Value is on subsequent lines (nested block)
      const next = parseBlock(lines, i + 1);
      if (next.value !== null) {
        // Check if next block starts with a dash list
        const nextLine = stripComment(lines[i + 1] || "");
        if (nextLine.trimStart().startsWith("- ") && leadingSpaces(lines[i + 1]) > indent) {
          obj[key] = next.value;
        } else {
          obj[key] = next.value;
        }
      } else {
        obj[key] = null;
      }
      i = next.end;
    } else {
      obj[key] = parseScalar(afterColon);
      i++;
    }
  }

  return { value: obj, end: i };
}

/**
 * Parse a YAML list block at a given indent level.
 */
function parseList(lines, start, baseIndent) {
  const arr = [];
  let i = start;

  while (i < lines.length) {
    const raw = lines[i];
    const line = stripComment(raw);
    const indent = leadingSpaces(raw);

    if (!line.trim()) { i++; continue; }
    if (indent < baseIndent) break;

    const trimmed = line.trimStart();
    if (trimmed.startsWith("- ") && indent === baseIndent) {
      const itemText = trimmed.substring(2).trim();
      if (itemText.includes(":")) {
        // Inline map item: "- key: value"
        const inlineObj = {};
        const colonIdx = itemText.indexOf(":");
        const k = itemText.substring(0, colonIdx).trim();
        const v = itemText.substring(colonIdx + 1).trim();
        inlineObj[k] = parseScalar(v);

        // Check for continuation lines that belong to this item
        const nextI = i + 1;
        if (nextI < lines.length) {
          const nextRaw = lines[nextI];
          const nextIndent = leadingSpaces(nextRaw);
          if (nextIndent > indent && !stripComment(nextRaw).trimStart().startsWith("- ")) {
            const nested = parseMap(lines, nextI, nextIndent);
            Object.assign(inlineObj, nested.value);
            i = nested.end;
            arr.push(inlineObj);
            continue;
          }
        }
        arr.push(inlineObj);
      } else {
        arr.push(parseScalar(itemText));
      }
      i++;
    } else {
      break;
    }
  }

  return { value: arr, end: i };
}

/**
 * Parse a scalar YAML value (string, number, boolean, null) or inline array.
 * Handles: [a, b, c] inline array syntax.
 */
function parseScalar(val) {
  // Inline array: [item1, item2, ...]
  if (val.startsWith("[") && val.endsWith("]")) {
    const inner = val.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => parseScalar(s.trim()));
  }
  if (val === "null" || val === "~") return null;
  if (val === "true") return true;
  if (val === "false") return false;
  // Quoted string
  if ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  // Number
  if (/^-?\d+(\.\d+)?$/.test(val)) return parseFloat(val);
  return val;
}

/** Remove trailing # comment from a line, respecting quoted strings. */
function stripComment(line) {
  let inQuote = false;
  let quoteChar = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === "#") {
        return line.substring(0, i);
      }
    }
  }
  return line;
}

/** Count leading spaces of a line. */
function leadingSpaces(line) {
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === " ") count++;
    else break;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Block-to-region mapping
// ---------------------------------------------------------------------------

/**
 * Map a block type to the corresponding region name in the layout mapping.
 * @param {string} blockType
 * @param {object} block — The block object (used for summary-group position)
 * @returns {string|null} — Region name or null if not mappable
 */
function blockToRegion(blockType, block, layout) {
  switch (blockType) {
    case "title": return "title";
    case "body": return "body";
    case "kpi-table":
      // content/summary layout defines "table" region; main layout defines "kpi_table" region
      return (layout === "main") ? "kpi_table" : "table";
    case "image": return "image";
    case "main-box": return "main_box";
    case "key-message": return "key_message";
    case "table": return "table";
    case "figure-caption": return "figure_caption";
    case "table-caption": return "table_caption";
    case "summary-group":
      return block.position === "top" ? "group_top" : "group_bottom";
    default:
      return null;
  }
}

/**
 * Would this table block render as KPI badges rather than as a table?
 *
 * The renderer decides that from the block's shape, and the answer changes how
 * much vertical room the block needs, so the rule lives here where the geometry
 * is worked out and the renderer reads it from here.
 */
function looksLikeKpi(content, o = {}) {
  if (content && content.chart) return false;
  const headers = (content && content.headers) || [];
  const rows = (content && content.rows) || [];
  const cols = headers.length;
  // Under a tonality a row may hold up to six figures (spec-v2 Amendments 6); legacy cards stop at four.
  if (cols < 2 || cols > (o.basis ? 6 : 4)) return false;
  if (cols === 2) {
    const pairs = [headers, ...rows];
    return pairs.length <= 4 && pairs.every((p) => String(p[0]).length <= 12);
  }
  // Under a tonality a second row may give each figure's basis or comparison (spec-v2 Amendments 5).
  if (o.basis && rows.length === 2) return rows[0].every((c) => String(c).length <= 12) && rows[1].every((c) => String(c).length <= 24);
  return rows.length === 1 && rows[0].every((c) => String(c).length <= 12);
}

// A KPI badge stacks a small label over a large value, so it stands roughly as tall as the
// template's kpi.blockHeight token (1.75in on the legacy templates) no matter how few rows fed it.
const grid = require("./grid-resolver");

// ---------------------------------------------------------------------------
// Capability validation
// ---------------------------------------------------------------------------

/**
 * Capability rules: which block types each layout supports.
 * Mirrors the structure in capabilities.yaml but kept as code
 * so validation works even with minimal template data.
 */
const CAPABILITY_RULES = {
  cover: new Set(["title", "notes"]),
  section: new Set(["title", "notes", "image", "figure-caption"]),
  content: new Set(["title", "key-message", "body", "image", "notes", "kpi-table", "figure-caption", "table-caption"]),
  main: new Set(["title", "key-message", "body", "main-box", "kpi-table", "image", "notes", "figure-caption", "table-caption"]),
  summary: new Set(["title", "key-message", "summary-group", "image", "kpi-table", "figure-caption", "table-caption"]),
  closing: new Set(["title", "notes"]),
};

// Blocks that carry their own position and so never claim a region.
const PLACEMENT_BLOCK_TYPES = new Set(["box", "shape", "columns"]);

// Notes are slide-level metadata; placement blocks position themselves. Neither
// depends on what regions a layout happens to declare.
const ALWAYS_ALLOWED = new Set(["notes", ...PLACEMENT_BLOCK_TYPES]);

// The inverse of blockToRegion. A template may declare a layout without also
// listing its supported blocks, and the regions it declares already say which
// blocks it can hold — deriving the answer keeps the layout set open without
// hardcoding another table that would drift from this one.
const REGION_TO_BLOCKS = {
  title: ["title"],
  body: ["body"],
  table: ["kpi-table", "table"],
  kpi_table: ["kpi-table"],
  image: ["image"],
  main_box: ["main-box"],
  key_message: ["key-message"],
  figure_caption: ["figure-caption"],
  table_caption: ["table-caption"],
  group_top: ["summary-group"],
  group_bottom: ["summary-group"],
};

// "free" needs no template declaration: it means "this slide uses no template
// region", so every template supports it by construction. A template may still
// declare its own free layout, and that declaration wins.
const FREE_LAYOUT = { layout_source: "none", decorations: null, regions: {} };

// A region holds one block. Images are the documented exception — they collapse
// into a grid. Captions are subordinate labels rather than content, and last-wins
// is how every existing deck already renders them.
const MERGEABLE_REGIONS = new Set(["image"]);
const SUBORDINATE_REGIONS = new Set(["figure_caption", "table_caption"]);

/**
 * Validate blocks against capability rules from the template's capabilities.
 * @param {number} slideIndex
 * @param {string} layout
 * @param {Array} blocks
 * @param {object} [templateCapabilities] — Parsed capabilities.yaml (optional)
 * @param {object} [layoutConfig] — The layout's mapping entry, used to derive
 *   capabilities when the template publishes none for this layout
 */
function validateCapabilities(slideIndex, layout, blocks, templateCapabilities, layoutConfig) {
  // Use template capabilities if provided, otherwise fall back to built-in
  // rules, otherwise derive from the regions this layout declares.
  let allowed;
  if (templateCapabilities && templateCapabilities.supported_blocks &&
      templateCapabilities.supported_blocks[layout]) {
    allowed = new Set(templateCapabilities.supported_blocks[layout]);
  } else if (CAPABILITY_RULES[layout]) {
    allowed = CAPABILITY_RULES[layout];
  } else if (layoutConfig && layoutConfig.regions) {
    allowed = new Set(
      Object.keys(layoutConfig.regions).flatMap((r) => REGION_TO_BLOCKS[r] || [])
    );
  }

  if (!allowed) {
    throw new Error(
      `Slide ${slideIndex}: unknown layout "${layout}" with no capability rules`
    );
  }

  for (const block of blocks) {
    if (ALWAYS_ALLOWED.has(block.type)) continue;

    if (!allowed.has(block.type)) {
      throw new Error(
        `Slide ${slideIndex} (layout: ${layout}): ` +
        `block type "${block.type}" is not allowed. ` +
        `Allowed: ${[...allowed, ...ALWAYS_ALLOWED].join(", ") || "(placement blocks only)"}`
      );
    }
  }
}

/**
 * Divide a layout's body region into columns.
 *
 * Tracks are ratios, so the source carries no coordinates and the same deck
 * still lands correctly on a template with a different canvas.
 *
 * @returns {Array<object>} one content-band placement per column
 */
function resolveColumns(slideIndex, layout, regionDefs, block) {
  const bodyDef = regionDefs && regionDefs.body;
  if (!bodyDef) {
    throw new Error(
      `Slide ${slideIndex} (layout: ${layout}): ":::: columns" divides the layout's ` +
      `body region, but "${layout}" declares none. ` +
      `Regions here: ${Object.keys(regionDefs || {}).join(", ") || "(none)"}`
    );
  }

  const weights = block.tracks.map((track) => {
    const value = parseFloat(String(track));
    if (!isFinite(value) || value <= 0) {
      throw new Error(
        `Slide ${slideIndex}: column track "${track}" is not a positive ratio ` +
        `(write them as "2fr 1fr").`
      );
    }
    return value;
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  const gap = typeof block.gap === "number" ? block.gap : 0.25;
  const inner = bodyDef.w - gap * (weights.length - 1);
  if (inner <= 0) {
    throw new Error(
      `Slide ${slideIndex}: a gap of ${gap}in leaves no width for ${weights.length} columns ` +
      `inside a body region ${bodyDef.w}in wide.`
    );
  }

  let x = bodyDef.x;
  return block.columns.map((column, i) => {
    const w = inner * (weights[i] / total);
    const placement = {
      kind: "box",
      z: "content",
      x,
      y: bodyDef.y,
      w,
      ...(bodyDef.h !== undefined ? { h: bodyDef.h } : {}),
      blocks: column.blocks || [],
    };
    x += w + gap;
    return placement;
  });
}

// ---------------------------------------------------------------------------
// Main resolve function
// ---------------------------------------------------------------------------

/**
 * Resolve a compiled AST against a template to produce render-ready specs.
 *
 * @param {object} ast — AST from compile-deck.js (conforms to slide-ast-v1)
 * @param {object} templateObj — Template object from template-registry.js
 *   Expected shape:
 *   {
 *     name: "AZURE-PRO",
 *     mapping: "<yaml string of layout-mapping.yaml>",
 *     capabilities: "<yaml string of capabilities.yaml>",
 *     template: "<yaml string of template.yaml>"
 *   }
 * @returns {object} — Resolved deck spec with positioned regions
 */
/**
 * Caption prefixes in the deck's language: "도"/"표" for a Korean deck, "Figure"/
 * "Table" otherwise. Frontmatter `lang: ko|en` decides; without it, a deck whose
 * text is at least a tenth Hangul (one syllable weighs about two Latin letters)
 * is Korean. English decks used to get Korean prefixes.
 */
function captionPrefixes(ast) {
  const meta = (ast.deck && ast.deck.metadata) || {};
  const lang = String(meta.lang || meta.language || "").toLowerCase();
  let korean;
  if (lang) korean = lang.startsWith("ko");
  else {
    const strings = [];
    const walk = (node, key) => {
      if (typeof node === "string") { if (!["type", "layout", "src", "variant", "kind", "align"].includes(key)) strings.push(node); }
      else if (Array.isArray(node)) node.forEach((n) => walk(n, key));
      else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, k);
    };
    walk(ast.slides || [], "");
    const text = strings.join(" ");
    const hangul = (text.match(/[\uac00-\ud7a3]/gu) || []).length;
    const latin = (text.match(/[A-Za-z]/gu) || []).length;
    korean = hangul * 2 >= 0.1 * (hangul * 2 + latin) && hangul > 0;
  }
  return korean ? ["도", "표"] : ["Figure", "Table"];
}

function resolve(ast, templateObj) {
  if (!ast || !ast.slides) {
    throw new Error("resolve(): invalid AST — expected an object with a slides array");
  }
  if (!templateObj) {
    throw new Error("resolve(): templateObj is required");
  }
  if (templateObj.pack && !templateObj.pack.legacy) return resolvePack(ast, templateObj);

  // Parse YAML strings from template object
  const mapping = typeof templateObj.mapping === "string"
    ? parseYaml(templateObj.mapping)
    : templateObj.mapping;
  const capabilities = typeof templateObj.capabilities === "string"
    ? parseYaml(templateObj.capabilities)
    : templateObj.capabilities;

  if (!mapping || !mapping.layouts) {
    throw new Error(
      `resolve(): template "${templateObj.name || "unknown"}" has no layout mapping`
    );
  }

  const resolvedSlides = [];
  let figureCount = 0;
  let tableCount = 0;

  const deckMeta = ast.deck || {};
  const [FIGURE, TABLE] = captionPrefixes(ast);

  const tokens = (templateObj.pack && templateObj.pack.tokens) || {};
  const kpiBlockHeight = (tokens.kpi && tokens.kpi.blockHeight) || 1.75;
  for (const slide of ast.slides) {
    if (slide.meta && slide.meta.title) {
      throw new Error(
        `Slide ${slide.index + 1}: "title: ${slide.meta.title}" picks a title treatment, which needs a tonality; ` +
        `${templateObj.name || "this template"} is a legacy template with one title look`
      );
    }
    const resolved = resolveSlide(slide, mapping, capabilities, deckMeta, kpiBlockHeight);
    // Auto-number captions across the deck
    for (const [name, region] of Object.entries(resolved.regions || {})) {
      if (region.content && region.content.type === "figure-caption") {
        figureCount++;
        region.content.number = figureCount;
        region.content.prefix = FIGURE;
      }
      if (region.content && region.content.type === "table-caption" && region.content.figure) {
        // A chart's caption is a figure caption, numbered with the figures.
        figureCount++;
        region.content.number = figureCount;
        region.content.prefix = FIGURE;
      } else if (region.content && region.content.type === "table-caption") {
        tableCount++;
        region.content.number = tableCount;
        region.content.prefix = TABLE;
      }
    }
    resolvedSlides.push(resolved);
  }

  return {
    deck: { ...ast.deck },
    slides: resolvedSlides,
  };
}

/**
 * Resolve a single slide against the layout mapping.
 *
 * @param {object} slide — A slide from the AST
 * @param {object} mapping — Parsed layout-mapping.yaml
 * @param {object} [capabilities] — Parsed capabilities.yaml
 * @returns {object} — Resolved slide spec
 */
function resolveSlide(slide, mapping, capabilities, deckMeta, kpiBlockHeight) {
  const { index, blocks } = slide;

  // 1. Look up layout configuration. A layout family the template does not declare (kpi-row,
  //    chart-insight, …) is drawn on the template layout that hosts its kind of slide.
  const family = familyOf(slide.layout, mapping, index);
  const layout = (mapping.layouts[slide.layout] || slide.layout === "free") ? slide.layout : family.host;
  const layoutConfig = mapping.layouts[layout] ||
    (layout === "free" ? FREE_LAYOUT : null);
  if (!layoutConfig) {
    throw new Error(
      `Slide ${index}: layout "${layout}" not found in template mapping. ` +
      `Available: ${Object.keys(mapping.layouts).join(", ")}, free`
    );
  }

  // 2. Validate blocks against capabilities
  validateCapabilities(index, layout, blocks, capabilities, layoutConfig);

  // 3. Pick the variant, if the slide asked for one. A variant swaps the
  //    decoration set and may move the regions the new furniture displaces —
  //    a split cover needs a narrower title than a full-bleed one.
  let decorKey = layoutConfig.decorations;
  let regionDefs = layoutConfig.regions || {};
  const variantName = slide.meta && slide.meta.variant;
  if (variantName) {
    const variants = layoutConfig.variants || {};
    const variant = variants[variantName];
    if (!variant) {
      throw new Error(
        `Slide ${index}: layout "${layout}" has no variant "${variantName}". ` +
        `Available: ${Object.keys(variants).join(", ") || "(none — this layout declares no variants)"}`
      );
    }
    if (variant.decorations) decorKey = variant.decorations;
    if (variant.regions) regionDefs = { ...regionDefs, ...variant.regions };
  }

  let decorations = [];
  if (decorKey && mapping.decorations && mapping.decorations[decorKey]) {
    decorations = mapping.decorations[decorKey].elements || [];
  }

  // 4. Map blocks to regions, and collect the blocks that place themselves
  const regions = {};
  const placements = [];
  let hasColumns = false;

  for (const block of blocks) {
    if (block.type === "shape") {
      const { type, ...rest } = block;
      placements.push({ kind: "shape", ...rest });
      continue;
    }
    if (block.type === "box") {
      // A role that does not exist would otherwise fall back to a default and
      // render in the wrong type, which is worse than not rendering: the deck
      // looks finished and is quietly off-system.
      const roles = (capabilities && capabilities.font_roles) || null;
      if (block.role && roles && !roles[block.role]) {
        throw new Error(
          `Slide ${index}: "::: box role=${block.role}" names a font role this ` +
          `template does not define. Available: ${Object.keys(roles).join(", ")}`
        );
      }
      const { type, ...rest } = block;
      placements.push({ kind: "box", ...rest });
      continue;
    }
    if (block.type === "columns") {
      placements.push(...resolveColumns(index, layout, regionDefs, block));
      hasColumns = true;
      continue;
    }

    // An explicit "::: region name=" beats the block type's default region.
    const regionName = block.regionHint || blockToRegion(block.type, block, layout);
    if (!regionName) continue;

    const regionDef = regionDefs[regionName];
    if (!regionDef) {
      throw new Error(
        `Slide ${index} (layout: ${layout}): ` +
        `block "${block.type}" maps to region "${regionName}" ` +
        `which is not defined in the layout mapping. ` +
        `Available regions: ${Object.keys(regionDefs).join(", ") || "(none)"}`
      );
    }

    // Build the resolved region: position metadata + block content
    const resolved = {
      x: regionDef.x,
      y: regionDef.y,
      w: regionDef.w,
      ...(regionDef.h !== undefined ? { h: regionDef.h } : {}),
      content: extractContent(block),
    };

    // Copy region metadata (font roles, autofit, alignment, border, etc.)
    for (const key of Object.keys(regionDef)) {
      if (key === "x" || key === "y" || key === "w" || key === "h") continue;
      resolved[key] = regionDef[key];
    }

    if (regions[regionName]) {
      if (MERGEABLE_REGIONS.has(regionName)) {
        const existing = regions[regionName].content;
        const images = existing && existing.type === "image-grid"
          ? existing.images
          : [existing];
        images.push(resolved.content);
        regions[regionName].content = { type: "image-grid", images };
      } else if (SUBORDINATE_REGIONS.has(regionName)) {
        regions[regionName] = resolved;
      } else {
        throw new Error(
          `Slide ${index} (layout: ${layout}): two blocks both claim region ` +
          `"${regionName}", so one would be lost. A region holds one block — ` +
          `send one of them elsewhere with "::: region name=<region>", or place ` +
          `them side by side with ":::: columns". ` +
          `Regions here: ${Object.keys(regionDefs).join(", ")}`
        );
      }
    } else {
      regions[regionName] = resolved;
    }
  }

  // Columns take over the body area, so the body region must not also render.
  if (hasColumns) delete regions.body;

  // When body + image coexist, narrow body to leave room for the image
  if (regions.body && regions.image) {
    const imageX = regions.image.x || 0;
    if (imageX > 0 && imageX < (regions.body.x || 0) + (regions.body.w || 10)) {
      regions.body.w = Math.max(1, imageX - (regions.body.x || 0) - 0.2);
    }
  }

  // When a table + image coexist on one slide, narrow the table so it never
  // overlaps the image (the image keeps its right-hand column with a gutter).
  // Content layouts map the table to "table"; main layouts to "kpi_table".
  const tableImageRegion = regions.kpi_table || regions.table;
  if (tableImageRegion && regions.image) {
    const imageX = regions.image.x || 0;
    if (imageX > 0 && imageX < (tableImageRegion.x || 0) + (tableImageRegion.w || 10)) {
      tableImageRegion.w = Math.max(1, imageX - (tableImageRegion.x || 0) - 0.2);
    }
  }

  // When table + body coexist, offset body below the table.  Content layouts
  // map KPI tables to "table" while main layouts map them to "kpi_table".
  const tableRegion = regions.kpi_table || regions.table;
  if (tableRegion && regions.body) {
    const tblY = tableRegion.y || 1.044;
    const tblRows = (tableRegion.content && tableRegion.content.rows) || [];
    const tblHeaders = (tableRegion.content && tableRegion.content.headers) || [];
    const rowCount = tblRows.length + (tblHeaders.length > 0 ? 1 : 0);
    const rowH = 0.35;
    // The row model only describes a table drawn as a table. The same block
    // renders as KPI badges when its shape suggests it, and those stand far
    // taller than their row count, so a body placed by the row estimate alone
    // lands on top of them.
    const tableContent = tableRegion.content || {};
    const needed = looksLikeKpi(tableContent)
      ? kpiBlockHeight
      : rowCount * rowH;
    const tableBottom = tblY + Math.max(needed, tableRegion.h || 0) + 0.3;
    if ((regions.body.y || 1.044) < tableBottom) {
      regions.body.y = tableBottom;
    }
  }

  // Cover slide: auto-populate date_line from deck metadata
  if (layout === "cover" && deckMeta) {
    const meta = deckMeta.metadata || {};
    if (regionDefs.date_line && !regions.date_line) {
      const parts = [];
      if (meta.date) parts.push(meta.date);
      if (meta.department) parts.push(meta.department);
      if (parts.length > 0) {
        const rd = regionDefs.date_line;
        regions.date_line = {
          x: rd.x, y: rd.y, w: rd.w,
          ...(rd.h !== undefined ? { h: rd.h } : {}),
          content: parts.join("  |  "),
        };
        for (const key of Object.keys(rd)) {
          if (key === "x" || key === "y" || key === "w" || key === "h") continue;
          regions.date_line[key] = rd[key];
        }
      }
    }
    // Auto-populate any cover region named after a frontmatter key (e.g. subtitle,
    // eyebrow) so designed cover templates can surface deck metadata.
    for (const [rname, rdef] of Object.entries(regionDefs)) {
      if (regions[rname] || rname === "date_line" || rname === "title") continue;
      if (meta[rname] == null) continue;
      regions[rname] = { x: rdef.x, y: rdef.y, w: rdef.w, ...(rdef.h !== undefined ? { h: rdef.h } : {}), content: String(meta[rname]) };
      for (const key of Object.keys(rdef)) {
        if (["x", "y", "w", "h"].includes(key)) continue;
        regions[rname][key] = rdef[key];
      }
    }
  }

  return {
    index,
    layout,
    family: family.id,
    layoutSource: layoutConfig.layout_source,
    decorations,
    regions,
    placements,
    blocks,
    ...(slide.meta ? { meta: slide.meta } : {}),
  };
}

/**
 * Extract the primary text content from a block for the resolved region.
 * @param {object} block
 * @returns {string}
 */
function extractContent(block) {
  if (block.type === "title") return block.content || "";
  if (block.type === "main-box") return block.content || "";
  if (block.type === "key-message") return block.content || "";
  if (block.type === "notes") return block.content || "";
  if (block.type === "body") return { type: "body", items: block.items || [] };
  if (block.type === "kpi-table") return { type: "kpi-table", headers: block.headers || [], rows: block.rows || [], caption: block.caption || "", ...(block.chart ? { chart: block.chart } : {}) };
  if (block.type === "image") return { type: "image", src: block.src || "", caption: block.caption || "" };
  if (block.type === "figure-caption") return { type: "figure-caption", caption: block.caption || "" };
  if (block.type === "table-caption") return { type: "table-caption", caption: block.caption || "", ...(block.figure ? { figure: true } : {}) };
  if (block.type === "summary-group") return { type: "summary-group", heading: block.heading, items: block.items || [] };
  return "";
}

// ---------------------------------------------------------------------------
// Layout families
// ---------------------------------------------------------------------------

/**
 * The family a slide is stamped with, and the template layout that hosts it when the template
 * does not declare the name itself. A name that is neither keeps the template's own error.
 */
function familyOf(layout, mapping, index) {
  if (grid.LEGACY_LAYOUTS[layout]) return { id: grid.LEGACY_LAYOUTS[layout], host: layout };
  if (mapping.layouts[layout]) return { id: layout, host: layout };
  try {
    const f = grid.resolveFamily(layout, index + 1);
    return { id: f.family || layout, host: f.kind === "cover" || f.kind === "section" ? f.kind : "content" };
  } catch (_) {
    return { id: layout, host: layout };
  }
}

// ---------------------------------------------------------------------------
// Tonality packs: regions on the 12-column grid
// ---------------------------------------------------------------------------

const PACK_BLOCKS = {
  cover: new Set(["title", "notes"]),
  section: new Set(["title", "notes", "image", "figure-caption"]),
  content: new Set(["title", "key-message", "body", "main-box", "kpi-table", "image", "notes", "figure-caption", "table-caption", "summary-group"]),
};

const plain = (text) => String(text || "").replace(/\*\*/g, "").trim();

/** What a slide holds, as the treatment rules need it. */
function slideFacts(blocks) {
  const all = blocks.flatMap((b) => (b.type === "columns" ? b.columns.flatMap((c) => c.blocks || []) : [b]));
  const has = (type) => all.some((b) => b.type === type);
  const textBlocks = all.filter((b) => ["body", "summary-group", "main-box", "key-message"].includes(b.type)).length +
    (blocks.some((b) => b.type === "columns") ? 1 : 0);
  const bodyItems = all.filter((b) => b.type === "body").reduce((n, b) => n + (b.items || []).length, 0);
  return {
    image: has("image"),
    visual: has("image") || has("kpi-table"),
    textBlocks: textBlocks + (bodyItems > 1 ? 1 : 0),
  };
}

/** Comparison halves of numbers are data; halves of arguments are content. */
function comparisonRole(blocks) {
  const text = JSON.stringify(blocks);
  const digits = (text.match(/\d/g) || []).length;
  return digits / Math.max(1, plain(text).length) >= 0.04 ? "data" : "content";
}

/** The ordered content of a pack slide, captions bound to the visual before them. */
// Families whose geometry is a chart: a table of numbers there is drawn as one.
const CHART_FAMILIES = new Set(["chart-insight", "full-chart", "kpi-over-chart", "dashboard-grid"]);
const NUMBER_CELL = /^[+\-−±▲▼△▽]?\s*[\d.,]+\s*(?:%p?|배|x|pt|bp|[가-힣]{1,3}|[A-Za-z]{1,3})?$/u;

/** A table whose data columns are all numbers, over three or more rows, can be drawn as a chart. */
function chartable(c) {
  const rows = c.rows || [];
  const headers = c.headers || [];
  return headers.length >= 2 && rows.length >= 3 &&
    headers.slice(1).every((_, ci) => rows.every((r) => r[ci + 1] != null && NUMBER_CELL.test(plain(r[ci + 1]))));
}

function packItems(blocks, numbering, charts = false) {
  const items = [];
  for (const block of blocks) {
    if (["title", "notes", "key-message", "box", "shape"].includes(block.type)) continue;
    if (block.type === "columns") {
      items.push({ type: "columns", tracks: block.tracks, columns: block.columns.map((c) => packItems(c.blocks || [], numbering, charts)) });
      continue;
    }
    const content = extractContent(block);
    if (charts && block.type === "kpi-table" && !content.chart && chartable(content)) {
      content.chart = { type: (content.rows || []).length > 8 ? "line" : "column" };
    }
    if (block.type === "figure-caption" || block.type === "table-caption") {
      // A table drawn as a chart is captioned as a figure.
      const charted = [...items].reverse().find((i) => i.type === "kpi-table");
      const figure = block.type === "figure-caption" || block.figure || Boolean(charted && charted.content.chart);
      content.number = figure ? ++numbering.figure : ++numbering.table;
      content.prefix = figure ? numbering.FIGURE : numbering.TABLE;
      const target = [...items].reverse().find((i) => ["kpi-table", "image"].includes(i.type));
      if (target && !target.caption) target.caption = content;
      else items.push({ type: "caption", content });
      continue;
    }
    items.push({ type: block.type, content });
  }
  return items;
}

/**
 * What covers and sections can draw from the deck itself: the first image, the part names (from
 * the agenda heads, else the section titles), the first row of headline numbers and a real year.
 */
function deckFacts(ast) {
  const facts = { image: null, index: [], figures: [], numeral: null };
  const sections = [];
  for (const slide of ast.slides) {
    for (const b of slide.blocks) {
      if (!facts.image && b.type === "image" && b.src) facts.image = { src: b.src, caption: b.caption };
      if (!facts.figures.length && b.type === "kpi-table" && !b.chart && looksLikeKpi(b, { basis: true })) {
        const headers = b.headers || [];
        const row = (b.rows || [])[0] || [];
        facts.figures = headers.slice(0, 4).map((h, i) => ({ label: plain(h), value: plain(row[i]) })).filter((f) => f.value);
      }
    }
    if (slide.layout === "agenda" && !facts.index.length) {
      const body = slide.blocks.find((b) => b.type === "body");
      const items = ((body && body.items) || []).filter((i) => plain(i.heading || i.text)).slice(0, 6);
      facts.index = items.map((i) => plain(i.heading || String(i.text || "").replace(/^\*\*(.+?)\*\*.*$/u, "$1")));
      // What each part is about, so a section titled with an entry's description finds its place too.
      facts.indexAbout = items.map((i) => plain(String(i.text || "").replace(/^\*\*(.+?)\*\*/u, "")));
    }
    if (/^section/u.test(slide.layout)) {
      const t = slide.blocks.find((b) => b.type === "title");
      if (t) sections.push(plain(t.content));
    }
  }
  if (!facts.index.length && sections.length >= 2) facts.index = sections.slice(0, 6);
  facts.indexAbout = facts.indexAbout || [];
  const meta = (ast.deck && ast.deck.metadata) || {};
  const year = `${ast.deck && ast.deck.title ? ast.deck.title : ""} ${meta.date || ""}`.match(/\b(19|20)\d{2}\b/u);
  facts.numeral = year ? year[0] : null;
  return facts;
}

/** Titles of the content slides a section opens, up to the next section or closing (at most three). */
function sectionContents(ast, from) {
  const out = [];
  for (const s of ast.slides.slice(from + 1)) {
    if (/^(section|closing)/u.test(s.layout || "")) break;
    const t = s.blocks.find((b) => b.type === "title");
    if (t && plain(t.content)) out.push(plain(t.content));
  }
  return out.slice(0, 3);
}

/**
 * A preview line: a bold run-in label stays bold and is followed by a colon ("**결과:** 공부 시간이 …"),
 * unless the label ends in its own separator; any other line is plain text.
 */
function runIn(text) {
  const m = /^\*\*(.+?)\*\*\s*(.*)$/u.exec(String(text || "").trim());
  if (!m || !plain(m[2])) return plain(text);
  const label = plain(m[1]);
  return `**${/[:：.)\]–—-]$/u.test(label) ? label : `${label}:`}** ${plain(m[2])}`;
}

/** The first body lines (bullets or text, up to five) of the slides a section opens, by title. */
function sectionDigest(ast, from) {
  const out = [];
  for (const s of ast.slides.slice(from + 1)) {
    if (/^(section|closing)/u.test(s.layout || "")) break;
    const t = s.blocks.find((b) => b.type === "title");
    if (!t || !plain(t.content)) continue;
    const lines = s.blocks.filter((b) => b.type === "body").flatMap((b) => b.items || [])
      .filter((i) => ["bullet", "text", "numbered"].includes(i.type) && plain(i.text)).slice(0, 5).map((i) => runIn(i.text));
    out.push({ title: plain(t.content), lines });
  }
  return out.slice(0, 3);
}

/** Position of a section title in the deck's part index (by entry or by its description), or -1. */
function indexOf(facts, title) {
  const t = String(title || "").trim();
  if (!t || facts.index.length < 2) return -1;
  const at = facts.index.findIndex((name) => name === t);
  return at >= 0 ? at : facts.indexAbout.findIndex((about) => about === t);
}

/** Can this cover, section or closing variant be drawn with what the deck and slide hold? true or the reason. */
function variantApplies(variant, facts, slide) {
  const ownImage = slide.blocks.find((b) => b.type === "image");
  if (["cover-split-image", "cover-full-image"].includes(variant) && !facts.image) return "the deck has no image";
  if (variant === "section-image" && !ownImage) return "the section slide has no image";
  if (variant === "cover-numeral" && !facts.numeral) return "the deck names no year or real figure";
  if (variant === "cover-index" && facts.index.length < 2) return "the deck has no agenda or sections to list";
  if (variant === "cover-figures" && facts.figures.length < 2) return "the deck has no row of headline numbers";
  if (variant === "closing-statement" && slide.blocks.some((b) => ["kpi-table", "image"].includes(b.type))) return "a statement closing has no table or image";
  return true;
}

/**
 * The variant of a cover, section or closing: the one the source names when the pack lists it and
 * it can be drawn, else the pack's first that can. A generic name (cover, section, closing) asks
 * for the pack's own first choice.
 */
function chooseVariant(kind, named, pack, facts, slide, notes) {
  const list = pack[kind === "cover" ? "covers" : kind === "section" ? "sections" : "closings"] || [];
  const n = slide.index + 1;
  if (named && list.includes(named)) {
    const why = variantApplies(named, facts, slide);
    if (why === true) return named;
    notes.push(`slide ${n}: ${named} cannot be drawn (${why})`);
  } else if (named && !["cover", "section", "closing"].includes(named)) {
    notes.push(`slide ${n}: ${named} is not a ${pack.id} ${kind} variant (${list.join(", ")})`);
  }
  const pick = list.find((v) => v !== named && variantApplies(v, facts, slide) === true);
  if (!pick) throw new Error(`Slide ${n}: no ${pack.id} ${kind} variant (${list.join(", ")}) can be drawn here`);
  if (named) notes.push(`slide ${n}: drawn as ${pick}`);
  return pick;
}

/**
 * Resolve every slide of a deck against a tonality pack: its family, the title treatments it may
 * take (the pack's role default first, then the others the family allows; the renderer picks among
 * them by fill and the variance dial), the treatment geometry inputs and its content in reading
 * order. Notes go to the build log.
 */
function resolvePack(ast, templateObj) {
  const pack = templateObj.pack;
  const sizes = pack.tok.sizes;
  const decoration = new Set(pack.decoration || []);
  const notes = [];
  const [FIGURE, TABLE] = captionPrefixes(ast);
  const numbering = { figure: 0, table: 0, FIGURE, TABLE };
  const facts = deckFacts(ast);
  const families = pack["layout-families"] || [];
  const wide = { title: grid.faceWidth(pack.faces.title), display: grid.faceWidth(pack.faces.display) };
  let part = 0;

  const slides = ast.slides.map((slide) => {
    const n = slide.index + 1;
    const meta = slide.meta || {};
    const fam = grid.resolveFamily(slide.layout, n);
    const kind = fam.kind === "free" ? "content" : fam.kind;
    const allowed = PACK_BLOCKS[kind];
    for (const block of slide.blocks) {
      if (["box", "shape", "columns"].includes(block.type) || allowed.has(block.type)) continue;
      throw new Error(`Slide ${n} (layout: ${slide.layout}): block type "${block.type}" is not allowed on a ${kind} slide. ` +
        `Allowed: ${[...allowed].join(", ")}`);
    }
    const titleBlock = slide.blocks.find((b) => b.type === "title");
    const title = titleBlock ? titleBlock.content : "";
    const lead = slide.blocks.find((b) => b.type === "key-message");
    const placements = slide.blocks
      .filter((b) => b.type === "box" || b.type === "shape")
      .map(({ type, ...rest }) => ({ kind: type === "shape" ? "shape" : "box", ...rest }));
    const base = { index: slide.index, layout: slide.layout, kind, title, lead: lead ? lead.content : null, placements, blocks: slide.blocks, meta, regions: {} };

    if (kind === "cover" || kind === "section") {
      if (meta.title) throw new Error(`Slide ${n}: a ${kind} slide takes its variant's title, not "title: ${meta.title}"`);
      const variant = chooseVariant(kind, fam.family || fam.legacyLayout, pack, facts, slide, notes);
      let parts = null;
      if (kind === "section") {
        // A section numbers itself by its place in the deck's agenda when its title is an agenda
        // entry (or that entry's description); otherwise it counts the sections so far.
        const at = indexOf(facts, plain(title));
        part = at >= 0 ? at + 1 : part + 1;
        parts = at >= 0 ? facts.index.length : null;
      }
      const ownImage = slide.blocks.find((b) => b.type === "image");
      const cover = { ...facts, image: kind === "section" && ownImage ? { src: ownImage.src, caption: ownImage.caption } : facts.image };
      const contents = kind === "section" ? sectionContents(ast, slide.index) : [];
      const digest = kind === "section" ? sectionDigest(ast, slide.index) : [];
      return { ...base, family: variant, variant, part, parts, cover, contents, digest, regions: { title: { content: title } } };
    }

    let family = fam.family === "free" ? "text-column" : fam.family;
    let role = family === "comparison" ? comparisonRole(slide.blocks) : fam.role;
    if (grid.VARIANTS.closing.includes(family) || fam.legacyLayout === "closing") {
      family = chooseVariant("closing", fam.legacyLayout === "closing" ? "closing" : family, pack, facts, slide, notes);
      role = family === "closing-statement" ? "statement" : "content";
    } else if (!families.includes(family)) {
      notes.push(`slide ${n}: ${family} is not a ${pack.id} layout family (${families.join(", ")}); drawn with its own geometry`);
    }
    let titleOnly = null;
    if (family === "statement" && !pack.treatments.includes("statement")) {
      // A pack without a statement title sets the sentence as a top title, the largest it has.
      titleOnly = ["top-plain-large", "band", "top-rule"].find((t) => pack.treatments.includes(t));
      if (!titleOnly) throw new Error(`Slide ${n}: ${pack.id} has no statement or top title to set a statement slide with; choose another tonality`);
      notes.push(`slide ${n}: ${pack.id} has no statement title, so the sentence is drawn as a ${titleOnly} title`);
      family = "text-column";
      role = "content";
    }
    const items = packItems(slide.blocks, numbering, CHART_FAMILIES.has(family));
    const paras = slide.blocks.filter((b) => b.type === "body").flatMap((b) => b.items || []);
    // A closing is not part of a section, so it never carries the part number.
    const closing = grid.VARIANTS.closing.includes(family);
    // An agenda numbers its own rows: a count beside its title reads as a stray section number (spec-v2 Amendments 8).
    const numeral = family === "agenda" ? null : part > 0 && !closing ? part : null;
    const statementCols = (pack.display || {}).statement === "offset" ? [5, 12] : null;
    const ctx = { grid: pack.grid, sizes, title: plain(title), hero: pack.hero, decoration, numeral, rail: pack.rail, wide, statementCols, tight: Boolean((pack.tok || {}).tight) };
    const facts1 = slideFacts(slide.blocks);
    // A quote under a statement title says the quote; the source line becomes the support line.
    let statementText = null;
    let supportText = null;
    if (family === "quote") {
      const texts = paras.filter((i) => i.type === "text").map((i) => plain(i.text));
      const by = texts.find((t) => /^[—–-]\s*/u.test(t));
      statementText = texts.filter((t) => t !== by).join(" ") || null;
      supportText = by || null;
    }
    const applicable = (t) => {
      const c = t === "statement" && statementText ? { ...ctx, title: statementText } : ctx;
      const f = t === "statement" && family === "quote" ? { ...facts1, textBlocks: 1 } : facts1;
      return grid.treatmentApplies(t, f, c);
    };
    let allow = grid.familyAllows(family);
    let treatment;
    if (titleOnly) {
      treatment = titleOnly;
    } else if (!families.includes(family) && !meta.title && !pack.treatments.some((t) => allow.includes(t) && applicable(t) === true)) {
      // A family from outside the pack that takes none of its titles gets the pack's title for its role.
      allow = [pack["role-defaults"][role] || pack.treatments[0], ...grid.familyAllows("text-column")];
      treatment = pack.treatments.find((t) => allow.includes(t) && applicable(t) === true) || allow[0];
      notes.push(`slide ${n}: the ${family} family takes none of the ${pack.id} titles; drawn under ${treatment}`);
    } else {
      treatment = grid.pickTreatment({
        pack, family, role, override: meta.title, slideNumber: n, used: new Set(), max: Infinity,
        applicable, onNote: (note) => notes.push(note),
      });
    }
    const candidates = meta.title || titleOnly ? [treatment] : [treatment, ...pack.treatments.filter((t) =>
      t !== treatment && allow.includes(t) && !["statement", "overlay"].includes(t) && applicable(t) === true)];
    return {
      ...base,
      family,
      role,
      treatment,
      candidates,
      ctx,
      statementText,
      supportText,
      items,
      regions: { title: { content: title } },
    };
  });

  return { deck: { ...ast.deck }, slides, notes };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { resolve, extractContent, looksLikeKpi };
