"use strict";

/**
 * directive-parser.js — Extract ::: fenced blocks and detect forbidden constructs.
 *
 * Responsibilities:
 * - Find ::: fenced blocks (main-box, kpi-table, chart, notes, image, key-message)
 * - Reject nested ::: blocks
 * - Reject arbitrary HTML/CSS (div, span, style, inline style attributes)
 * - Extract tables from | pipe | syntax
 * - Extract images from ![alt](path) syntax
 */

const APPROVED_DIRECTIVES = new Set(["main-box", "kpi-table", "chart", "notes", "image", "key-message"]);

// A void directive is a single line: it draws something and has no body, so it
// takes no closing fence. Shapes are the only such directive.
const VOID_DIRECTIVES = new Set(["shape"]);

// Containers nest by fence length, the pandoc fenced-div convention: a block is
// closed by a run of the same length, so a ::: block inside a :::: block is
// unambiguous. v1 forbade nesting outright and every v1 deck used ::: only,
// which is why those decks keep parsing exactly as before.
const FENCE_OPEN = /^\s*(:{3,})\s*([a-z][\w-]*)\s*(.*)$/;
const FENCE_CLOSE = /^\s*(:{3,})\s*$/;
const MAX_FENCE_DEPTH = 2;

/**
 * Split a directive's argument string into positional values and key=value pairs.
 * Numbers and booleans are coerced; quoted values keep their spaces.
 * @param {string} rest — everything after the directive name
 * @returns {{attrs: object, positional: Array}}
 */
function parseAttrs(rest) {
  const attrs = {};
  const positional = [];
  const token = /([^\s=]+)=("[^"]*"|'[^']*'|\S+)|(\S+)/g;
  let m;
  while ((m = token.exec(rest)) !== null) {
    if (m[3] !== undefined) {
      positional.push(m[3]);
      continue;
    }
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
      value = parseFloat(value);
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    }
    attrs[m[1]] = value;
  }
  return { attrs, positional };
}

/**
 * Validate slide content for forbidden constructs.
 * Throws on violation with descriptive message.
 * @param {string} content — Slide content (after layout directive removed)
 * @param {number} slideIndex — For error messages
 */
function validate(content, slideIndex) {
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Arbitrary HTML tags
    if (/<(?:div|span|table|thead|tbody|tr|td|th|section|article|header|footer|nav|main|aside|style|script)\b/i.test(line)) {
      throw new Error(
        `Slide ${slideIndex}, line ${lineNum}: Arbitrary HTML is not allowed in Markdown slide spec v1. ` +
        `Found: ${line.trim().slice(0, 60)}`
      );
    }

    // Inline style attributes
    if (/style\s*=\s*["']/.test(line)) {
      throw new Error(
        `Slide ${slideIndex}, line ${lineNum}: Inline style attributes are not allowed. ` +
        `Found: ${line.trim().slice(0, 60)}`
      );
    }

    // <style> blocks
    if (/<style\b/i.test(line)) {
      throw new Error(
        `Slide ${slideIndex}, line ${lineNum}: <style> blocks are not allowed. ` +
        `CSS must come from template contracts, not author input.`
      );
    }
  }

  // Nesting: a container must use a longer fence than everything inside it.
  const open = [];
  for (let i = 0; i < lines.length; i++) {
    const openMatch = lines[i].match(FENCE_OPEN);
    if (openMatch) {
      if (VOID_DIRECTIVES.has(openMatch[2])) continue;
      const len = openMatch[1].length;
      const outer = open.length > 0 ? open[open.length - 1] : null;
      if (outer !== null && len >= outer) {
        throw new Error(
          `Slide ${slideIndex}, line ${i + 1}: Nested directives must use a shorter ` +
          `fence than their container — "${":".repeat(outer)}" cannot contain ` +
          `"${":".repeat(len)}". Close the current block first, or open the ` +
          `container with more colons (e.g. "::::").`
        );
      }
      if (open.length >= MAX_FENCE_DEPTH) {
        throw new Error(
          `Slide ${slideIndex}, line ${i + 1}: Directive nesting depth exceeds ` +
          `${MAX_FENCE_DEPTH}. A container may hold blocks, but those blocks may ` +
          `not be containers themselves.`
        );
      }
      open.push(len);
      continue;
    }
    const closeMatch = lines[i].match(FENCE_CLOSE);
    if (closeMatch && open.length > 0 && open[open.length - 1] === closeMatch[1].length) {
      open.pop();
    }
  }

  if (open.length > 0) {
    throw new Error(
      `Slide ${slideIndex}: Unclosed directive block. Each ":::" open must have a ` +
      `matching close of the same length.`
    );
  }
}

/**
 * Extract fenced blocks from content, returning interleaved segments.
 *
 * A container (fence longer than three colons) also carries `children`, the
 * blocks parsed from its body, so a caller can walk a column layout without
 * re-parsing. Plain ::: blocks keep the v1 shape: raw `value`, no children.
 *
 * @param {string} content
 * @returns {Array<{type: 'text'|'directive', value: string, directive?: string,
 *                  attrs?: object, positional?: Array, children?: Array}>}
 */
function extractBlocks(content) {
  const segments = [];
  const lines = content.split("\n");
  let buffer = [];

  const flushText = () => {
    if (buffer.length > 0) {
      const value = buffer.join("\n");
      if (value.trim()) segments.push({ type: "text", value });
      buffer = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const openMatch = lines[i].match(FENCE_OPEN);
    if (!openMatch) {
      buffer.push(lines[i]);
      i++;
      continue;
    }

    const [, fence, name, rest] = openMatch;
    const { attrs, positional } = parseAttrs(rest || "");
    flushText();

    if (VOID_DIRECTIVES.has(name)) {
      segments.push({ type: "directive", directive: name, attrs, positional, value: "" });
      i++;
      continue;
    }

    // validate() has already guaranteed no fence of this length opens inside,
    // so the first close of the same length is this block's close.
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const closeMatch = lines[j].match(FENCE_CLOSE);
      if (closeMatch && closeMatch[1].length === fence.length) {
        end = j;
        break;
      }
    }

    const body = lines.slice(i + 1, end < 0 ? lines.length : end).join("\n");
    const segment = { type: "directive", directive: name, attrs, positional, value: body.trim() };
    if (fence.length > 3) segment.children = extractBlocks(body);
    segments.push(segment);

    i = end < 0 ? lines.length : end + 1;
  }

  flushText();
  return segments;
}

/**
 * Parse a pipe table from text content.
 * @param {string} text
 * @returns {{ headers: string[], rows: string[][] } | null}
 */
function parseTable(text) {
  const lines = text.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return null;

  const parseRow = (line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  // Detect separator line (|---|---|)
  const sepIdx = lines.findIndex((l) => /^\|[\s\-:]+\|/.test(l));
  if (sepIdx < 0) return null;

  const headers = parseRow(lines[0]);
  const dataLines = lines.slice(sepIdx + 1);
  const rows = dataLines.map(parseRow).filter((r) => r.length > 0);

  return { headers, rows };
}

/**
 * Parse an image from ![alt](path) syntax.
 * @param {string} text
 * @returns {{ alt: string, src: string } | null}
 */
function parseImage(text) {
  const match = text.match(/!\[([^\]]*)\]\(([^)]+)\)/);
  if (!match) return null;
  return { alt: match[1], src: match[2] };
}

module.exports = {
  validate, extractBlocks, parseTable, parseImage, parseAttrs,
  VOID_DIRECTIVES, APPROVED_DIRECTIVES,
};
