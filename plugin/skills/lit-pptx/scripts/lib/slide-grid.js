"use strict";

/**
 * slide-grid.js — where things sit on a slide, the same for every tonality.
 *
 * One column grid per canvas and one set of zones per slide kind. A tonality changes how a zone
 * looks (face, weight, size, colour, rules, fills, ornaments), never where it is: every title,
 * header, body and footer of a deck lands on the coordinates below whichever pack draws it, so two
 * tonalities of one source differ in look and never in placement. The density dial sets type and
 * spacing inside the zones; it no longer moves the margins. Values are points on the 960 x 540
 * (16:9) or 720 x 540 (4:3) canvas; `emu()` gives the same box in EMU (12,700 per point).
 *
 * Content slides
 *   header  the band over the title: grid marks, the slide index, a kicker label
 *   title   the title frame of every treatment (top-rule, band, top-plain-large, kicker-numeral,
 *           side-rail, bottom-anchor); a treatment styles it and never moves it
 *   aside   right of the title: the kicker numeral
 *   body    everything the slide says, from the first block to the floor
 *   footer  the sample-data tag and the source line's foot
 * Display slides (statement, quote, section, closing statement)
 *   header  the part number or kicker over the sentence
 *   title   the sentence, centred in its frame
 *   support the line under it (the quote's speaker, what the part opens with)
 *   side    the columns right of the sentence, bled to the page edge (a composition, a rail)
 * Covers
 *   header  the meta line (date, team, presenter)
 *   title   the deck title, standing on the frame's foot
 *   subtitle the line under the title
 *   strip   the headline figures or the parts, across the page above the footer
 *   side    the columns right of the title, bled to the page edge (a field, a picture, a numeral)
 */

const CANVAS = { "16:9": { W: 960, H: 540 }, "4:3": { W: 720, H: 540 } };

// Side margin, column width and gutter: 12 columns and 11 gutters that sum exactly to the width.
const COLUMNS = { "16:9": { margin: 24, col: 54, gutter: 24 }, "4:3": { margin: 24, col: 45, gutter: 12 } };

const FOOTER = { cols: [1, 12], y: 498, h: 18 };

const ZONES = {
  content: {
    header: { cols: [1, 12], y: 12, h: 18 },
    title: { cols: [1, 10], y: 36, h: 72 },
    aside: { cols: [11, 12], y: 36, h: 72 },
    body: { cols: [1, 12], y: 120, h: 366 },
    footer: FOOTER,
  },
  display: {
    header: { cols: [1, 9], y: 84, h: 36 },
    title: { cols: [1, 9], y: 132, h: 216 },
    support: { cols: [1, 8], y: 372, h: 114 },
    side: { cols: [10, 12], y: 0, h: 540, bleed: true },
    footer: FOOTER,
  },
  cover: {
    header: { cols: [1, 8], y: 36, h: 24 },
    title: { cols: [1, 9], y: 144, h: 168 },
    subtitle: { cols: [1, 8], y: 324, h: 72 },
    strip: { cols: [1, 12], y: 414, h: 66 },
    side: { cols: [10, 12], y: 0, h: 540, bleed: true },
    footer: FOOTER,
  },
};

function columns(canvas) {
  const c = COLUMNS[canvas];
  if (!c) throw new Error(`unknown canvas "${canvas}"; canvases: ${Object.keys(COLUMNS).join(", ")}`);
  return c;
}

/** Columns a…b (1-based, inclusive) as x and width in points. */
function span(canvas, a, b) {
  const c = columns(canvas);
  const pitch = c.col + c.gutter;
  return { x: c.margin + pitch * (a - 1), w: pitch * (b - a + 1) - c.gutter };
}

/**
 * One zone as a box in points. A bled zone starts half a gutter left of its first column and runs
 * to the page's right edge, so what fills it meets the edge and keeps the gutter from the text.
 */
function zone(canvas, kind, name) {
  const spec = (ZONES[kind] || {})[name];
  if (!spec) throw new Error(`no ${name} zone on a ${kind} slide`);
  const s = span(canvas, spec.cols[0], spec.cols[1]);
  if (spec.bleed) {
    const x = s.x - columns(canvas).gutter / 2;
    return { x, y: spec.y, w: CANVAS[canvas].W - x, h: spec.h, a: spec.cols[0], b: spec.cols[1] };
  }
  return { x: s.x, y: spec.y, w: s.w, h: spec.h, a: spec.cols[0], b: spec.cols[1] };
}

/** Every zone of every slide kind on a canvas, in points. */
function zones(canvas) {
  return Object.fromEntries(Object.entries(ZONES).map(([kind, set]) => [kind, Object.fromEntries(Object.keys(set).map((name) => [name, zone(canvas, kind, name)]))]));
}

/** A box in points as EMU, the unit a .pptx file stores. */
function emu(box) {
  const e = (v) => Math.round(v * 12700);
  return { x: e(box.x), y: e(box.y), w: e(box.w), h: e(box.h) };
}

module.exports = { CANVAS, COLUMNS, ZONES, span, zone, zones, emu };
