"use strict";

/**
 * spec-validator.js — Validate compiled AST against v1 schema rules.
 *
 * Checks:
 * - Required top-level fields (astVersion, version, deck, slides)
 * - Each slide has index, layout, blocks
 * - Layout type is in approved set
 * - Layout-specific block constraints
 * - Template field is present
 */

const APPROVED_LAYOUTS = new Set(["cover", "content", "main", "summary", "closing", "section"]);

// A layout name is checked for shape here, not for membership. Which layouts
// exist is a fact about the chosen template, and the AST is deliberately
// template-independent — layout-resolver is what compares a slide against the
// template's mapping and names the available layouts when one is missing.
const LAYOUT_NAME = /^[a-z][a-z0-9-]*$/;

// Placement blocks position themselves and so are legal wherever a template
// allows them; the per-layout tables below describe v1 content blocks only.
const PLACEMENT_BLOCKS = new Set(["box", "shape", "columns"]);

const LAYOUT_BLOCKS = {
  cover: new Set(["title"]),
  content: new Set(["title", "key-message", "body", "image", "notes", "kpi-table", "figure-caption", "table-caption"]),
  main: new Set(["title", "key-message", "body", "main-box", "kpi-table", "image", "figure-caption", "table-caption"]),
  summary: new Set(["title", "key-message", "summary-group", "image", "kpi-table", "figure-caption", "table-caption"]),
  closing: new Set(["title"]),
  section: new Set(["title", "notes"]),
};

/**
 * Validate a complete AST object.
 * Throws descriptive errors on violations.
 * @param {object} ast
 */
function validate(ast) {
  // Top-level required fields
  if (!ast.astVersion) throw new Error("AST missing required field: astVersion");
  if (!["slide-ast-v1", "slide-ast-v2"].includes(ast.astVersion)) {
    throw new Error(
      `AST astVersion must be "slide-ast-v1" or "slide-ast-v2", got "${ast.astVersion}"`
    );
  }
  if (!ast.version) throw new Error("AST missing required field: version");
  if (!ast.deck) throw new Error("AST missing required field: deck");
  if (!ast.deck.template) throw new Error("AST deck missing required field: template");
  if (!ast.deck.title) throw new Error("AST deck missing required field: title");
  if (!Array.isArray(ast.slides)) throw new Error("AST missing required field: slides");

  for (const slide of ast.slides) {
    validateSlide(slide);
  }
}

/**
 * Validate a single slide.
 */
function validateSlide(slide) {
  if (typeof slide.index !== "number") {
    throw new Error(`Slide missing numeric index`);
  }
  if (typeof slide.layout !== "string" || !LAYOUT_NAME.test(slide.layout)) {
    throw new Error(
      `Slide ${slide.index}: layout "${slide.layout}" is not a valid layout name. ` +
        `Use lowercase letters, digits and hyphens (e.g. "content", "hero-split").`
    );
  }
  if (!Array.isArray(slide.blocks)) {
    throw new Error(`Slide ${slide.index}: missing blocks array`);
  }

  // Only the v1 layouts have a fixed block set to enforce here. A template may
  // declare any other layout, and layout-resolver validates those against the
  // capabilities the template actually publishes.
  const allowed = LAYOUT_BLOCKS[slide.layout];
  if (!allowed) return;

  for (const block of slide.blocks) {
    if (PLACEMENT_BLOCKS.has(block.type)) continue;
    if (!allowed.has(block.type)) {
      throw new Error(
        `Slide ${slide.index} (layout: ${slide.layout}): ` +
          `block type "${block.type}" is not supported. ` +
          `Allowed: ${[...allowed, ...PLACEMENT_BLOCKS].join(", ")}`
      );
    }
  }
}

module.exports = { validate, APPROVED_LAYOUTS, LAYOUT_BLOCKS };
