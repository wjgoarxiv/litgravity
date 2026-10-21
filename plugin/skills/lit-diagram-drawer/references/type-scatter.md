# Scatter plot

**Catalog ID:** `scatter`  
**Companion catalog entries:** [Bubble](type-bubble.md) · [Beeswarm](type-beeswarm.md).  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Scatter fits when the relationship between two continuous variables is the point: correlation, clusters, outliers, or high and low performers. Select Bubble when a third, positive magnitude matters, since its area follows a separate encoding contract. Select Beeswarm when a single distribution and every observation matter. A chart that plots scientific measurements as a scientific result belongs to the scientific-visualization workflow.

## Exclusions

The standard scatter holds 5–30 points. Fewer points read better as prose or a table, while more points become a density problem, so bin them or switch to Beeswarm when every observation is meaningful. The grammar leaves out a third size scale, unreported jitter, a forced fit line, and labels on every point. Both axes keep an explicit meaning and range.

## Content schema

```yaml
title: "Service latency and error rate"
x_axis: { label: p95 latency, min: 0, max: 500, unit: ms }
y_axis: { label: Error rate, min: 0, max: 5, unit: "%" }
points:
  - { id: checkout, label: Checkout, x: 260, y: 2.8, focal: true }
  - { id: search, label: Search, x: 180, y: 0.9 }
trend: none                    # optional; only when supported by the data
quadrant_guides: false         # optional median guides
```

Each point has a stable ID and finite x/y values inside the declared bounds. Label the focal point plus at most two further outliers. An optional trend line states its model or an honest descriptive purpose. Optional median guides label all four regions and serve as visual aids, adding no variable.

## Deterministic layout recipe

Set a 1000×500 viewBox with plot bounds x=80..960 and y=40..420. Map each coordinate linearly to those bounds, with x rising left to right and y rising bottom to top. Draw 4–6 equally spaced ticks on each axis, and align grid rules to the ticks. Standard points have a fixed radius of 5px, and the single focal point has 6px. Place at most three point labels on paper-backed backgrounds, trying offsets in a fixed order (above-right, above-left, below-right, below-left) and taking the first that clears earlier labels and the axes. Point centers stay fixed. Add the optional muted dashed trend rule after confirming that the data supports its direction. The bottom footer holds a compact legend or source footnote.

## Encoding rules

Point position encodes x and y. Point size and fill opacity are fixed, and only one point carries the accent. A fit line appears when it clarifies a real pattern and carries no causal claim. Include zero on an axis when absolute position needs it; when a useful range omits zero, print the visible bounds prominently. Keep units and scales visible, note omitted observations, and bind each label and tick to its data point or value. Bubble size and beeswarm packing rules live in their companion guides.

## Korean behavior

Use concise Korean axis titles with units and a consistent number format. Values stay attached to `%`, milliseconds, and other units. Pretendard carries prose, and the shared mono face carries ticks and identifiers. Korean point labels are short phrases that wrap only at word boundaries, and a longer name moves to a side key off the cloud. Latin service IDs stay exact.

## Light, dark, and full variants

All skins keep point coordinates, scales, ticks, focal point, and label bindings. Light and dark switch shared tokens; confirm grid and mark outlines against each paper surface. Full adds a small editorial title and one interpretation note around the unchanged plot, with no new scale or data series.

## Accessibility

Provide a title and description naming both variables, units, bounds, the focal point, and any trend fit. Supply a text table with one row per item and its x/y values. Mark focus in text as well as by accent, and give circles visible strokes at presentation size. Spell out quadrant labels, if used, since position alone is insufficient. See [Accessibility](accessibility.md).

## Verifier gates

Run `node scripts/verify-diagram.mjs` for bounds, overlaps, label clipping, contrast, skin polarity, accessible SVG, and visible-text checks. Run `node scripts/verify-type.mjs --type=scatter` to validate the catalog marker. The registry holds no specialized scatter proof, so compare point coordinates and tick labels with the declared axis bounds by hand. See [Verifier guide](verifier-guide.md). The gallery wrapper's `data-type` value must equal this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- More than 30 points of unlabeled density, one label per mark, or silently omitted extremes.
- A trend line forced onto scattered data or read as causal evidence.
- Bubble size used without the separate Bubble contract, or a third variable hidden in color.
- A point moved to avoid collision, or inconsistent bounds across points.
- Truncated axes without a printed range, or axes with unclear units.
