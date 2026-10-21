# Slopegraph

**Catalog ID:** `slopegraph`  
**Parent family:** [Line and quantitative chart guidance](type-line.md)

## Purpose and selection

A slopegraph compares several named series across exactly two comparable states: before and after, two releases, or two scenarios. Line angle conveys direction and relative change, and line crossings reveal rank changes. Both endpoints stay labeled so the reader can recover the values.

Choose a line chart for three or more ordered states, a bar or dumbbell for a single-time comparison, and a scatter plot when the two endpoints use different units. The slopegraph is silent about what happened between the endpoints, so a crossing marks no date or event.

## Content schema

Supply a dataset containing:

- Two state captions in chronological or explicitly named order.
- One shared measurement name, unit, and linear numeric domain used by both vertical axes.
- Four to ten series, each with a stable display name and a value in each state.
- A note for excluded or missing series; a missing endpoint stays missing instead of being interpolated.
- The source, period, and domain bounds needed to interpret the comparison.

Each series record is `{name, from, to}`. Bind those values and endpoint labels to the same series identity in machine-readable SVG attributes so the rendered line, text, and metadata can be checked together. Round a value once and reuse that rounded value for the label and the plotted coordinate.

## Deterministic layout recipe

1. Use a wide viewBox with a plotting region about as tall as it is wide. Put two vertical axes at fixed x positions with symmetric label gutters outside them, leaving room for the longest series name and the numeric value on each side.
2. Declare one round domain `[min, max]` and one scale function `y(v) = bottom - (v - min) × plotHeight / (max - min)`. Apply the identical function to both endpoint columns. Record the domain and unit in the source line.
3. Render each series as one straight segment from the left endpoint to the right endpoint, with dots at both ends. The plot has no mid-point, curve, gridline, or extra state axis.
4. Print each series name and complete value at both ends. State captions sit below their axes, and the measurement and unit go in a small axis caption. Gutters are fixed; when endpoint labels collide, reduce the series count or split the comparison and leave the coordinates alone.
5. Order lines by the left endpoint value, and keep that order in the legend and source metadata. Labels stay paired to their actual endpoints even when crossings reorder the right side.

## Visual encoding

Nonfocal series use a restrained ink-opacity ramp, and one accent series marks the central finding, chosen for the story and not automatically as the best or worst result. The focal line gets extra weight and a legend label. Names and values stay in high-contrast text roles on all lines. Names at both ends already identify each series, so a rainbow palette adds nothing. The axes and endpoint numbers carry the scale, and a grid is unnecessary.

Direction shows through the actual slope and the printed values. State-neutral legend wording such as "strongest tone" avoids claiming that the ramp is darker in both skins. Intermediate points carry no rate or trajectory.

## Korean text

Pretendard sets service or category names, and mono sets short state captions, numeric labels, units, and source metadata. Short paired captions such as `이전` and `이후` fit when they match the actual comparison. Keep one unit and a consistent decimal and thousands convention at both ends. A long Hangul series name wraps within its gutter or takes an agreed short label with a mapping in the legend, and its endpoint holds its vertical position. See [Korean typography](korean-typography.md).

## Light, dark, and full variants

The three skins share values, domain, coordinates, and series ordering. Only semantic colors, paper, and framing change. The full editorial form adds a short headline, a single finding caption, and a source line stating the domain and period, with the plot unchanged. Check ink-opacity ramps after compositing in each skin, because their apparent lightness reverses.

## Accessibility

Include a title and description with the two state names, unit, domain, and main direction of change. Endpoint names and values are required redundant encodings, so color never alone identifies a series. Keep value labels on the correct row and maintain sufficient text and line contrast. A focal accent below 3:1 gets reinforcement from line weight, labels, and legend wording. Keep the figure legible when printed in grayscale.

## Verifier gates

Run `scripts/verify-diagram.mjs` for rendered geometry, clipping, contrast, skin, visible-text, and a11y checks. Run `scripts/verify-type.mjs --type=slopegraph` to recompute both endpoint positions from the one declared scale and compare every line, name, value, and state caption with its binding. Review the endpoint gutters in exported 16:9 and 4:3 layouts.

## Anti-patterns

- Different scales, units, origins, or transforms on the two axes.
- Moving an endpoint or its printed value to reduce a collision.
- Three or more states, a single series, a unique line color per series, or a crowded legend.
- Missing values silently interpolated, unbound labels, or values omitted at either end.
- Gridlines repeating the endpoint values, or a curved segment implying an unobserved path.
- Calling a crossing a dated event, or reading an intermediate value off the line.

## Related references

[Line chart](type-line.md) · [Scatter plot](type-scatter.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
