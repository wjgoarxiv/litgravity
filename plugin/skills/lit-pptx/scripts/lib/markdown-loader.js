"use strict";

/**
 * markdown-loader.js — Parse frontmatter and split deck into raw slide chunks.
 *
 * Input:  raw Markdown source string
 * Output: { deck: { template, title, metadata }, slides: [{ index, layout, content }] }
 */

/**
 * Simple YAML key-value parser (no nested structures needed for v1 frontmatter).
 * Handles: key: value, key: "quoted value"
 */
function parseSimpleYaml(raw) {
  const result = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (match) {
      result[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

// Slide-local keys the engine acts on. This set is deliberately closed: a key
// the engine ignores has no effect a reader can see, so admitting one buys
// nothing and costs the body line it was indistinguishable from.
// `title` names the slide's title treatment when it should differ from the pack's role default.
const SLIDE_KEYS = new Set(["variant", "title"]);

/**
 * Split the text after a `layout:` line into slide-local keys and body content.
 *
 * Only a key in SLIDE_KEYS is consumed, and the run stops at the first line that
 * is not one. Matching on shape instead — any lowercase word before a colon —
 * looks equivalent and is not: a body line reading "source: internal data" is
 * the same shape as a key, and treating it as one deletes it from the slide
 * with no error. A mistyped "varient:" stays in the body for the same reason,
 * where it is visible, rather than becoming an ignored key that silently does
 * nothing.
 *
 * @param {string} rest — chunk text following the layout directive line
 * @returns {{meta: object, content: string}}
 */
function splitSlideMeta(rest) {
  const meta = {};
  const lines = rest.split("\n");
  let i = 0;

  for (; i < lines.length; i++) {
    if (!lines[i].trim()) {
      i++;
      break;
    }
    const match = lines[i].match(/^([a-z][\w-]*):[ \t]*(.+)$/);
    if (!match || !SLIDE_KEYS.has(match[1])) break;
    meta[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }

  return { meta, content: lines.slice(i).join("\n").trim() };
}

/**
 * Load and split a Markdown deck source.
 * @param {string} source — Raw Markdown content
 * @returns {{ deck: object, slides: Array<{index: number, layout: string, content: string}> }}
 */
function load(source) {
  if (!source.startsWith("---")) {
    throw new Error("Deck must start with YAML frontmatter (---)");
  }

  const fmClose = source.indexOf("\n---", 3);
  if (fmClose < 0) {
    throw new Error("Frontmatter must be closed with ---");
  }

  const fmRaw = source.slice(3, fmClose).trim();
  const body = source.slice(fmClose + 4); // skip \n---

  const fm = parseSimpleYaml(fmRaw);

  if (!fm.template && !fm.tonality) {
    throw new Error("Frontmatter must declare a 'template' or a 'tonality' field");
  }
  if (!fm.title) {
    throw new Error("Frontmatter must declare a 'title' field");
  }

  const deck = {
    // A tonality-only deck records its pack as the design it was written for.
    template: fm.template || `tonality:${fm.tonality}`,
    title: fm.title,
    metadata: {},
  };

  // Collect non-core fields as metadata
  for (const [k, v] of Object.entries(fm)) {
    if (k !== "template" && k !== "title") {
      deck.metadata[k] = v;
    }
  }

  // Split body into slide chunks by --- (use [ \t]* not \s* to avoid consuming blank lines)
  const chunks = body.split(/\n---[ \t]*\n/);
  const slides = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim();
    if (!chunk) continue;

    // Extract layout directive from first line
    const layoutMatch = chunk.match(/^layout:\s*([\w-]+)[ \t]*\n/);
    if (!layoutMatch) {
      throw new Error(
        `Slide chunk must start with a 'layout:' directive (chunk ${i}: "${chunk.slice(0, 40)}...")`
      );
    }

    const layout = layoutMatch[1];
    const { meta, content } = splitSlideMeta(chunk.slice(layoutMatch[0].length));

    slides.push({
      index: slides.length,
      layout,
      meta,
      content,
    });
  }

  if (slides.length === 0) {
    throw new Error("Deck must contain at least one slide");
  }

  return { deck, slides };
}

module.exports = { load };
