# Quadrant

**Catalog ID:** `quadrant`  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md) · [Consultant scenario variant](type-quadrant-consultant.md)

## Purpose and selection

Quadrant places a small set of named items against two independent, meaningful axes, as in prioritization, portfolio review, or product positioning. Position inside the cells is the information. When the brief asks for four named futures with a short narrative per cell and no within-cell position, choose the separate `quadrant-consultant` catalog entry. A table suits comparisons of precise ranks or scores.

## Exclusions

Quadrant covers two dimensions. Time series, large point clouds, and categories without interpretable axes need another type. An item sitting exactly on an axis has ambiguous membership, so request a placement rule or leave it out of the chart. The standard grammar caps at twelve points.

## Content schema

```yaml
title: "Work to do first"
x_axis: { label: Impact, low: Limited, high: Broad, min: 0, max: 10 }
y_axis: { label: Ease, low: Difficult, high: Easy, min: 0, max: 10 }
items:
  - { id: auth, label: Access review, x: 8, y: 8, focal: true }
  - { id: cache, label: Cache cleanup, x: 5, y: 6 }
```

Every item has a stable ID, a short label, and x/y values on the declared axes. Normalize both coordinates to the plot range, and keep raw values for visible labels when exactness matters. At most one item is focal. Axis endpoint terms explain direction, and quadrant captions are optional and short.

## Deterministic layout recipe

Set a 1000×560 viewBox with a plot rectangle at x=160..840, y=104..424, and place the cross at the midpoint `(500,264)`. Map values linearly with `px=160+680×(x−xmin)/(xmax−xmin)` and `py=424−320×(y−ymin)/(ymax−ymin)`. Draw the two hairline axes through the center, with arrow tips and one-word axis labels sitting outside the plot margins. Put each point at its mapped coordinate, keep the marks small, and set labels 8–10px away. Try label positions in a fixed order (above-right, above-left, below-right, below-left) and take the first candidate that clears the point, the axes, and earlier labels. If none fits, reduce the item count or split the chart, since point positions are fixed. Labels stay clear of the axis lines.

## Encoding rules

Position is the data. Ordinary items are small neutral circles, and the single focal point takes the accent. The four cells share one fill. Name both axes with their direction and their units or scales. Optional quadrant captions sit in the corners and remain subordinate to item labels. Illustrative scores are described as such in plain words, because approximate placement makes no measurement claim.

## Korean behavior

Axis names and endpoint labels are short, on one line where possible. Use Korean directional terms whose low/high meaning is clear, since arrows and color cannot carry polarity alone. Korean item names may wrap to two lines. Item labels stay inside the plot, and mixed Hangul/Latin identifiers and numeric units remain unbroken.

## Light, dark, and full variants

All three variants share axis ranges, point positions, label placements, and the focal item. Light and dark differ in tokens only. The full variant may add a compact interpretation card or a few editorial callouts outside the plotting area; a card summarizes the pattern without restating every point, and the 2×2 plot stays primary.

## Accessibility

Provide a title and description that name both axes and the key focal item. Add a reading-order list of item labels and values. A screen reader announces each item's two axis values, and the focal state appears in text. Axes and point outlines meet non-text contrast, and labels read well apart from the mark color.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for collisions, label bounds, clipping, contrast, skin parity, SVG accessibility, and visible-text checks. Run `node scripts/verify-type.mjs --type=quadrant` to validate the catalog marker, and compare point positions with the declared axis bounds and labels by hand. See [Verifier guide](verifier-guide.md). The gallery wrapper's `data-type` value must equal this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- Four differently colored cell fills, unlabeled axes, or labels over the axis cross.
- Points on either axis without an explicit placement policy.
- More than twelve items, or a point moved to make its label fit.
- Axis glyphs, vague labels such as "good/bad," or unsupported score precision.
- This point plot applied to four scenarios that belong in the consultant variant.
