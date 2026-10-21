"use strict";

/**
 * slide-ast.js — Build slide AST from parsed content segments.
 *
 * Converts extracted text segments and directive blocks into the
 * structured AST defined by specs/slide-ast-v1.schema.json.
 */

const { extractBlocks, parseTable, parseImage } = require("./directive-parser");

// The primitives addDecorations() can actually draw. confidential_mark and
// disclaimer are deliberately absent: they are brand furniture owned by a
// template, not general shapes an author composes with.
const SHAPE_KINDS = new Set([
  "rect", "roundRect", "pill", "ellipse", "ring", "line", "text", "image",
]);

// Style attributes forwarded to the decoration renderer, which owns their
// meaning. Anything outside this set is rejected so a typo fails loudly rather
// than being silently dropped at render time.
const SHAPE_STYLE_KEYS = new Set([
  "fill", "line", "lw", "radius", "rotate", "text", "color", "size",
  "align", "valign", "char_spacing", "bold", "asset", "dir", "src", "note",
]);

const DEFAULT_COLUMN_GAP = 0.25;

/** Layout names v1 shipped with; anything else marks a deck as v2. */
const V1_LAYOUTS = new Set(["cover", "content", "main", "summary", "closing", "section"]);
const V2_BLOCK_TYPES = new Set(["columns", "box", "shape", "col", "region"]);

/**
 * Build AST blocks for a slide.
 * @param {string} layout — Slide layout type
 * @param {string} content — Raw slide content (layout directive already removed)
 * @returns {Array} — Array of AST block objects
 */
function buildBlocks(layout, content) {
  const segments = extractBlocks(content);
  const blocks = [];

  let titleAdded = false;

  for (const seg of segments) {
    if (seg.type === "directive") {
      blocks.push(...buildDirectiveBlocks(seg, layout));
      continue;
    }

    // Text segment — parse headings, bullets, tables, images
    const text = seg.value.trim();
    if (!text) continue;

    const lines = text.split("\n");

    // Check for heading (first non-empty line starting with #)
    if (!titleAdded) {
      const headingIdx = lines.findIndex((l) => /^#{1,3}\s/.test(l));
      if (headingIdx >= 0) {
        const hMatch = lines[headingIdx].match(/^(#{1,3})\s+(.+)$/);
        if (hMatch) {
          blocks.push({
            type: "title",
            content: hMatch[2].trim(),
            level: hMatch[1].length,
          });
          titleAdded = true;
          // Remove heading line, continue with rest
          lines.splice(headingIdx, 1);
        }
      }
    }

    const remaining = lines.join("\n").trim();
    if (!remaining) continue;

    // For summary layout, parse differently (group by ### headings)
    if (layout === "summary") {
      // Pre-extract image, table, and caption content
      const sLines = remaining.split("\n");
      const groupParts = [];
      const imgLines = [];
      const tableLines = [];
      let captionLine = null;
      let inTable = false;

      for (const line of sLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("![")) {
          imgLines.push(line);
          continue;
        }
        if (trimmed.startsWith("|")) {
          tableLines.push(line);
          inTable = true;
          continue;
        }
        if (inTable && trimmed.startsWith("> ") && !trimmed.startsWith("> |")) {
          captionLine = trimmed.replace(/^>\s*/, "");
          inTable = false;
          continue;
        }
        if (inTable && trimmed === "") {
          continue;
        }
        inTable = false;
        groupParts.push(line);
      }

      const groups = parseSummaryGroups(groupParts.join("\n"));
      blocks.push(...groups);

      // Add image block
      if (imgLines.length > 0) {
        const img = parseImage(imgLines.join("\n"));
        if (img) {
          blocks.push({ type: "image", src: img.src, caption: img.alt || "" });
          blocks.push({ type: "figure-caption", caption: img.alt || "" });
        }
      }

      // Add table block
      if (tableLines.length > 0) {
        const table = parseTable(tableLines.join("\n"));
        if (table && table.headers.length > 0) {
          blocks.push({
            type: "kpi-table",
            headers: table.headers,
            rows: table.rows,
            ...(captionLine ? { caption: captionLine } : {}),
          });
          if (captionLine) {
            blocks.push({ type: "table-caption", caption: captionLine });
          }
        }
      }

      continue;
    }

    // Check for standalone images: a run of image lines keeps every image, each with its caption.
    const imageLines = remaining.split("\n").filter((l) => l.trim());
    if (imageLines.length && imageLines.every((l) => l.trim().startsWith("![")) && imageLines.some((l) => parseImage(l))) {
      for (const line of imageLines) {
        const img = parseImage(line);
        if (!img) continue;
        blocks.push({ type: "image", src: img.src, caption: img.alt || "" });
        if (img.alt) {
          blocks.push({ type: "figure-caption", caption: img.alt });
        }
      }
      continue;
    }

    const { text: withoutImages, images } = extractStandaloneImages(remaining);

    // Check for table (with optional blockquote caption after)
    const table = parseTable(withoutImages);
    if (table && table.headers.length > 0) {
      // Check for blockquote caption line after table (> caption text)
      const lines = withoutImages.split("\n");
      const captionLine = lines.find((l) => l.trim().startsWith("> ") && !l.trim().startsWith("> |"));
      const tableCaption = captionLine ? captionLine.trim().replace(/^>\s*/, "") : null;

      blocks.push({
        type: "kpi-table",
        headers: table.headers,
        rows: table.rows,
        ...(tableCaption ? { caption: tableCaption } : {}),
      });
      if (tableCaption) {
        blocks.push({ type: "table-caption", caption: tableCaption });
      }
      // Check if there's also body content (non-table, non-blockquote lines)
      const nonTableLines = withoutImages
        .split("\n")
        .filter((l) => !l.trim().startsWith("|") && !l.trim().startsWith(">") && l.trim());
      if (nonTableLines.length > 0) {
        blocks.push(buildBodyBlock(nonTableLines.join("\n")));
      }
      blocks.push(...images);
      continue;
    }

    // Parse as body content
    const body = buildBodyBlock(withoutImages || remaining);
    if (body.items.length > 0) {
      blocks.push(body);
    }
    blocks.push(...images);
  }

  return blocks;
}

function extractStandaloneImages(text) {
  const keep = [];
  const images = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const img = parseImage(trimmed);
    if (img && trimmed === `![${img.alt}](${img.src})`) {
      images.push({ type: "image", src: img.src, caption: img.alt || "" });
      if (img.alt) images.push({ type: "figure-caption", caption: img.alt });
    } else {
      keep.push(line);
    }
  }
  return { text: keep.join("\n").trim(), images };
}

/**
 * Build a body block from text containing bullets and sections.
 */
function buildBodyBlock(text) {
  const items = [];
  const lines = text.split("\n");
  let currentSection = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Section header: - **bold text**
    const sectionMatch = line.match(/^-\s+\*\*(.+?)\*\*\s*$/);
    if (sectionMatch) {
      if (currentSection) {
        items.push(currentSection);
      }
      currentSection = {
        type: "section",
        heading: sectionMatch[1],
        children: [],
      };
      continue;
    }

    // Numbered item: (N) text (possibly indented)
    const numMatch = line.match(/^\((\d+)\)\s+(.+)$/);
    if (numMatch) {
      const numberedItem = { type: "numbered", text: numMatch[2] };
      if (currentSection) {
        currentSection.children.push(numberedItem);
      } else {
        items.push(numberedItem);
      }
      continue;
    }

    // Regular bullet: - text
    const bulletMatch = line.match(/^-\s+(.+)$/);
    if (bulletMatch) {
      if (currentSection) {
        items.push(currentSection);
        currentSection = null;
      }
      items.push({ type: "bullet", text: bulletMatch[1], level: 1 });
      continue;
    }

    // Standalone image
    const img = parseImage(line);
    if (img) {
      items.push({ type: "image", ...img });
      continue;
    }

    // Plain text (treat as text item)
    if (currentSection) {
      items.push(currentSection);
      currentSection = null;
    }
    items.push({ type: "text", text: line });
  }

  // Flush remaining section
  if (currentSection) {
    items.push(currentSection);
  }

  return { type: "body", items };
}

/**
 * Parse summary groups from text with ### headings.
 * First ### group → position: "top", second → position: "bottom".
 */
function parseSummaryGroups(text) {
  const groups = [];
  const parts = text.split(/^(###\s+.+)$/m);

  let currentHeading = null;
  let currentContent = [];

  for (const part of parts) {
    const headingMatch = part.match(/^###\s+(.+)$/m);
    if (headingMatch) {
      // Flush previous group
      if (currentHeading !== null) {
        groups.push({
          heading: currentHeading,
          content: currentContent.join("\n").trim(),
        });
      }
      currentHeading = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(part);
    }
  }

  // Flush last group
  if (currentHeading !== null) {
    groups.push({
      heading: currentHeading,
      content: currentContent.join("\n").trim(),
    });
  }

  // Map groups to summary-group blocks
  const positions = ["top", "bottom"];
  return groups.map((g, i) => {
    const body = buildBodyBlock(g.content);
    return {
      type: "summary-group",
      position: positions[i] || `group-${i}`,
      heading: g.heading,
      items: body.items,
    };
  });
}

/**
 * Build the AST block(s) a directive segment stands for.
 *
 * Most directives are one block. `region` is the exception: it does not survive
 * into the AST at all. It exists to answer "which region does this belong to",
 * so its content is parsed normally and each resulting block simply carries a
 * regionHint. Keeping the slide's block list flat means the resolver walks one
 * loop rather than a tree, and a hinted block behaves like any other everywhere
 * else in the pipeline.
 *
 * @param {object} seg — directive segment from extractBlocks
 * @param {string} layout
 * @returns {Array<object>}
 */
function buildDirectiveBlocks(seg, layout) {
  const { directive, value, attrs = {}, positional = [], children = [] } = seg;

  switch (directive) {
    case "region": {
      if (!attrs.name) {
        throw new Error(
          `"::: region" requires a name attribute — write "::: region name=<region>". ` +
          `Run "compile-deck.js --list-layouts <TEMPLATE>" to see a layout's regions.`
        );
      }
      return buildBlocks(layout, value).map((b) => ({ ...b, regionHint: String(attrs.name) }));
    }

    case "columns": {
      const cols = children.filter((c) => c.type === "directive" && c.directive === "col");
      const tracks = positional.map(String);
      if (tracks.length !== cols.length) {
        throw new Error(
          `":::: columns" declares ${tracks.length} track(s) (${tracks.join(" ") || "none"}) ` +
          `but holds ${cols.length} "::: col" block(s) — they must match.`
        );
      }
      if (cols.length === 0) {
        throw new Error(`":::: columns" holds no "::: col" blocks.`);
      }
      return [{
        type: "columns",
        tracks,
        gap: attrs.gap != null ? Number(attrs.gap) : DEFAULT_COLUMN_GAP,
        columns: cols.map((c) => ({ blocks: buildBlocks(layout, c.value) })),
      }];
    }

    case "box": {
      for (const key of ["x", "y", "w", "h"]) {
        if (typeof attrs[key] !== "number") {
          throw new Error(
            `"::: box" is missing a numeric "${key}". A box needs x, y, w and h in inches.`
          );
        }
      }
      return [{
        type: "box",
        x: attrs.x, y: attrs.y, w: attrs.w, h: attrs.h,
        ...(attrs.role ? { role: String(attrs.role) } : {}),
        ...(attrs.align ? { align: String(attrs.align) } : {}),
        ...(attrs.valign ? { valign: String(attrs.valign) } : {}),
        z: attrs.z === "under" ? "under" : "over",
        blocks: buildBlocks(layout, value),
      }];
    }

    case "shape": {
      const kind = positional[0];
      if (!SHAPE_KINDS.has(kind)) {
        throw new Error(
          `"::: shape" has unknown kind "${kind == null ? "" : kind}" — use one of ` +
          `${[...SHAPE_KINDS].join(", ")}.`
        );
      }
      // A line is drawn as a hairline rect, so its thickness comes from the
      // stroke width rather than from a height the author has to supply.
      const required = kind === "line" ? ["x", "y", "w"] : ["x", "y", "w", "h"];
      for (const key of required) {
        if (typeof attrs[key] !== "number") {
          throw new Error(
            `"::: shape ${kind}" is missing a numeric "${key}" (inches).`
          );
        }
      }
      const block = {
        type: "shape",
        shape: kind,
        x: attrs.x, y: attrs.y, w: attrs.w,
        h: typeof attrs.h === "number" ? attrs.h : 0,
        z: attrs.z === "over" ? "over" : "under",
      };
      for (const [key, val] of Object.entries(attrs)) {
        if (["x", "y", "w", "h", "z"].includes(key)) continue;
        if (!SHAPE_STYLE_KEYS.has(key)) {
          throw new Error(
            `"::: shape ${kind}" got unknown attribute "${key}". Supported: ` +
            `${[...SHAPE_STYLE_KEYS].join(", ")}.`
          );
        }
        block[key] = val;
      }
      return [block];
    }

    case "chart":
      return buildChartBlocks(value, attrs, positional);

    default:
      return [buildDirectiveBlock(directive, value)];
  }
}

const CHART_TYPES = new Set(["bar", "column", "line", "area", "pie", "doughnut", "stacked"]);

/**
 * A native, editable chart. The body is a pipe table: the first column holds the
 * categories, every further column is one series. It travels as a kpi-table block
 * with a `chart` field, so any layout that accepts a table accepts a chart, and a
 * renderer that cannot draw charts still shows the numbers as a table.
 *
 *   ::: chart type=column unit="억 원"
 *   | 분기 | 매출 | 영업이익 |
 *   |---|---|---|
 *   | 1Q | 1,120 | 101 |
 *   > 분기별 매출과 영업이익 (예시 데이터)
 *   :::
 */
function buildChartBlocks(value, attrs, positional) {
  const table = parseTable(value);
  if (!table || table.headers.length < 2 || table.rows.length === 0) {
    throw new Error('"::: chart" needs a pipe table: categories in the first column, one column per series');
  }
  const type = String(attrs.type || positional[0] || "column").toLowerCase();
  if (!CHART_TYPES.has(type)) {
    throw new Error(`"::: chart" type must be one of ${[...CHART_TYPES].join(", ")}; got "${type}"`);
  }
  const captionLine = value.split("\n").map((l) => l.trim()).find((l) => l.startsWith("> "));
  const caption = captionLine ? captionLine.replace(/^>\s*/, "") : null;
  const chart = { type };
  if (attrs.unit != null) chart.unit = String(attrs.unit);
  if (attrs.title != null) chart.title = String(attrs.title);
  if (attrs.labels != null) chart.labels = attrs.labels !== false && attrs.labels !== "false";
  const blocks = [{
    type: "kpi-table",
    headers: table.headers,
    rows: table.rows,
    chart,
    ...(caption ? { caption } : {}),
  }];
  if (caption) blocks.push({ type: "table-caption", caption, figure: true });
  return blocks;
}

/**
 * Build a directive block from name and content.
 */
function buildDirectiveBlock(directive, value) {
  switch (directive) {
    case "main-box":
      return { type: "main-box", content: value };

    case "notes":
      return { type: "notes", content: value };

    case "kpi-table": {
      const table = parseTable(value);
      if (table) {
        return {
          type: "kpi-table",
          headers: table.headers,
          rows: table.rows,
        };
      }
      return { type: "kpi-table", rows: [] };
    }

    case "image": {
      const img = parseImage(value);
      if (img) {
        return { type: "image", src: img.src, caption: img.alt || "" };
      }
      return { type: "image", src: value.trim(), caption: "" };
    }

    default:
      return { type: directive, content: value };
  }
}

/**
 * Does this deck use anything v1 could not express?
 *
 * The version is decided by content rather than pinned, so a deck written
 * entirely in v1 constructs still compiles to a slide-ast-v1 document — byte for
 * byte what it produced before v2 existed. Only a deck that actually places
 * something declares itself v2.
 */
function usesV2(parsedSlides) {
  const blockIsV2 = (block) =>
    V2_BLOCK_TYPES.has(block.type) ||
    block.regionHint != null ||
    (block.blocks || []).some(blockIsV2) ||
    (block.columns || []).some((c) => (c.blocks || []).some(blockIsV2));

  return parsedSlides.some((slide) =>
    !V1_LAYOUTS.has(slide.layout) ||
    (slide.meta && Object.keys(slide.meta).length > 0) ||
    (slide.blocks || []).some(blockIsV2)
  );
}

/**
 * Build a complete AST from deck metadata and parsed slides.
 */
function buildAst(deckMeta, parsedSlides) {
  const v2 = usesV2(parsedSlides);
  return {
    astVersion: v2 ? "slide-ast-v2" : "slide-ast-v1",
    version: v2 ? "2.0.0" : "1.0.0",
    deck: {
      template: deckMeta.template,
      title: deckMeta.title,
      ...(Object.keys(deckMeta.metadata).length > 0
        ? { metadata: deckMeta.metadata }
        : {}),
    },
    slides: parsedSlides,
  };
}

module.exports = { buildBlocks, buildBodyBlock, buildAst, SHAPE_KINDS, V1_LAYOUTS };
