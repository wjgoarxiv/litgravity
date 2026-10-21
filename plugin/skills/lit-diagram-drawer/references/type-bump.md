# Bump Chart

**Catalog ID:** bump

## Purpose and selection

Pick a bump chart to show how the relative rank of several series shifts across ordered snapshots. It conveys rank as its only message. A slopegraph suits exactly two snapshots whose values still matter, and a line chart suits a claim about magnitude or rate over time. A single snapshot reads best as a ranked list. Route analysis of measured scientific data to the dedicated scientific-visualization skill.

## Content schema

Supply 4–8 named series, 3–6 ordered snapshot labels, and one integer rank for every series at every snapshot. Each snapshot contains each rank from 1 through N exactly once. Record the measure used for ranking and its tie-break rule, and apply that same measure definition in all snapshots. Mark at most one editorially focal series.

## Deterministic layout recipe

Build on a fixed plot grid aligned to 4px. Each snapshot becomes an evenly spaced vertical axis. In the canonical 1000 × 500 frame, rank rows sit at a constant 56px vertical pitch, with rank 1 at y=88 and rank r at y=88 + 56 × (r−1). Join adjacent snapshots with straight segments and put a small dot at every vertex. Keep the lines unsmoothed. Snapshot captions go under their axis.

Series names and rank labels live in gutters beyond the first and last axes. Align each endpoint label to the row of its series and the column of the endpoint it names. Order series by first-snapshot rank and keep that order stable. Paint paths first, then dots and labels. If rank rows or gutters will not fit, cut the series count or widen the canvas and leave every rank point in place.

## Encoding rules

Vertical position encodes ordinal rank only. Rank rows are equidistant, and horizontal position encodes snapshot order. Stroke tone may carry a restrained ordering cue; the legend describes that tone neutrally and stays accurate in both themes. Accent one focal series and add weight or point size as a redundant cue. Bind each path to its rank sequence and each endpoint label to its series, side, and rank.

## Korean behavior

Use Korean snapshot captions and rank labels where suitable, such as 1위, while storing rank values as integers. State the ranking measure and tie-break in a Korean source note. Pretendard sets series names, and mono sets snapshot codes and rank data. Give gutters enough width for Korean labels, and wrap names at word boundaries so they stay out of the plot.

## Light, dark, and full variants

Light uses a neutral stroke ramp, a restrained grid-free field, and one focal accent. Dark recalculates the neutral ramp and axis contrast around the same ranking geometry. Full adds a title, a ranking-method note, and a takeaway outside the plot. The full frame carries the same series ordering and data as the others.

## Accessibility

Describe the ranking measure and the major rank changes in text. Series identity comes through endpoint labels and a data table, with color as a supplement. Associate first and last endpoint labels programmatically with the correct series and snapshot. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for layout, clipping, contrast, and accessibility. Run scripts/verify-type.mjs --type=bump for complete rank permutations, exact rank-row positions, straight adjacent-snapshot segments, snapshot captions, and endpoint label bindings. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Magnitude drawn on a rank axis, or rank labeled as a value.
- Snapshots built from different ranking definitions.
- Smoothing between observations, or a filled-in missing interval.
- Two series sharing a rank when the declared tie-break requires unique order.
- A vertex moved off its rank row to solve a label collision.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
