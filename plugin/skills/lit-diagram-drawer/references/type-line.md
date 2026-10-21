# Line chart

Catalog ID: line

## Purpose and selection

Pick the line entry when ordered time or index points form a continuous trend and the story is about direction, pace, or turning points. It handles one series or a small number of comparable series. This canonical type serves editorial product and operational diagrams; measured scientific data and statistical analysis go to the dedicated scientific-visualization workflow.

## Exclusions

Choose a bar chart for discrete category comparison, a slopegraph for exactly two states with direct endpoint comparison, a bump chart for rank movement across snapshots, and a ridgeline for distributions where a period holds more than one observation. Leave gaps in the data as gaps. Keep the base chart to five series and twelve points at most.

## Content schema

Provide ordered x values with labels; one unit-consistent y value per series and x; a declared source, period, and missing-data policy; a shared numeric domain with sensible tick labels; one optional focal series with an editorial rationale; and a legend or direct labels. Each value is numeric metadata, and the visible text must agree with it. For product-level summaries, say whether the values are actual, sampled, or illustrative.

## Deterministic layout recipe

Use a 1000 × 500 viewBox. Plot bounds are x=80..960 and y=40..420, with axis captions and the legend below. Compute 4–12 evenly spaced x positions across the plot width, and draw 4–6 horizontal grid lines from the declared y domain. Map y to position with one linear scale shared by all series. Draw each series as a polyline of straight segments; the focal stroke is 1.8px wide and the other lines are 1.2px. When several lines are present, show point dots on the focal series only. A single short series may show dots at every observation. Reserve the lower key band for one sample per series and one source line. Keep design constants on a 4px grid and leave data-derived point coordinates unsnapped.

## Encoding rules

The common plot may use a restrained series palette, since color helps the eye follow a line through many points. Use the palette in order without skipping, and reserve the accent for one focal series. Pair hue with direct names and a stroke-weight distinction, and optionally dash patterns. Straight segments keep the chart honest about unobserved values. Include zero when absolute magnitude comparison requires it; otherwise state the chosen domain and the reason. A gap remains a gap. The title makes the takeaway explicit while the axes retain units and scale.

## Korean behavior

Use Korean period labels for a Korean audience, with the same interval and ordering as the source. Format dates, values, percentages, and units consistently with the shared Korean guide. Use Pretendard for axis and series names, and mono for tick values and short technical units. Keep Hangul labels horizontal. Widen margins or abbreviate at phrase boundaries, and hold text at or above the output preset size.

## Light, dark, and full variants

Light and dark skins share the same domain, positions, line order, gaps, labels, and data. Recheck line contrast and confirm the series palette stays distinct on both papers. The full editorial variant may add a title, one takeaway sentence, a source/date line, and one explanatory annotation outside the plot, all without changing the plotted data or adding decorative motion. See the companion slopegraph, ridgeline, streamgraph, and bump guides for their own grammars.

## Accessibility

Provide an SVG title and description with the measure, period, units, domain, series count, and missing-data policy. Use direct series labels or a readable key so that color is never the sole series identifier. Include the data as a text table when precise values matter. Keep grid lines subordinate yet visible, and keep all data marks distinguishable in grayscale.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for bounds, line/text overlap, clipping, contrast, skin polarity, SVG semantics, and visible text. Run scripts/verify-type.mjs --type=line to compare bound values, x ordering, the shared domain, gaps, point count, and printed labels. Inspect the rendered chart for crossings, label collisions, and false continuity. Run humanizer checks on the title, axis captions, annotation, and key.

## Anti-patterns

- Spline smoothing through sparse observations.
- A line connecting across a missing interval.
- Inconsistent or undisclosed scales across series.
- More than five series with no split into panels.
- A hidden baseline, or a cropped y-axis with no explanation.
- Dots on every point of every dense line.
- A scientific-data plot here, when its uncertainty and analysis belong to the scientific-visualization workflow.
- Shifted plotted coordinates that make room for one label.

## Related references

[Style guide](style-guide.md) · [Output spec](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md) · [Slopegraph](type-slopegraph.md) · [Ridgeline](type-ridgeline.md) · [Streamgraph](type-streamgraph.md) · [Bump chart](type-bump.md)
