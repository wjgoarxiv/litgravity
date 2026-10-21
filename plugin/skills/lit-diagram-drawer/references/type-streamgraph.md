# Streamgraph

**Catalog ID:** `streamgraph`  
**Parent family:** [Line and quantitative chart guidance](type-line.md)

## Purpose and selection

Pick a streamgraph to show how a nonnegative total and its composition evolve over many evenly spaced periods. The outer envelope carries total volume and the layers carry each component's share. Pick a bar chart or table when exact per-period values matter, a line chart for a few trend points, and a 100% stacked area when proportions alone are the point.

## Content schema

Supply 3–24 ordered periods and 2–6 named layers. Each layer holds one nonnegative numeric value per period, one stable display name, and a declared unit. Zero periods stay in the dataset. Provide a shared scale, the total for each period, and the source/date context. Label illustrative data as illustrative. Layer names carry no digits, which keeps the legend's numeric total unambiguous.

## Deterministic layout recipe

1. Fix the plot rectangle and space the periods evenly from left to right. The symmetric baseline sits at the vertical center. At each period, sum all layer values and multiply by the single shared linear scale. The stack top is `baseline − totalHeight/2` and the bottom is `baseline + totalHeight/2`.
2. Choose one fixed stack order for the whole chart. The largest aggregate layers sit nearest the center line and keep that position at every period, so each band's identity stays steady.
3. For each period, accumulate layer thicknesses upward from the lower boundary, using the same scale for every layer and period. A true zero becomes a zero-thickness pinch, kept exactly as data.
4. Draw boundaries as smooth curves whose control points keep the true period vertices. With the canonical smoothing recipe, control points sit at one-sixth of the chord, and the vertices stay where the data puts them. A thin paper-colored separator divides neighboring fills.
5. Leave out y-axis ticks and gridlines. Label periods below the plot, and give each layer's name and total in the legend. Mark at most one landmark period with a short leader and a mono label. Put the shared scale or bucket size in a source line.

## Visual encoding

Apply one restrained ink-opacity ramp to nonfocal layers and one accent layer chosen for the point of the story. The largest aggregate layer gets the strongest neutral tone; the accent follows the story and may land on any layer. Envelope height encodes total volume and layer thickness encodes amount. Keep the single shared scale throughout, with every layer measured on it. Word the legend in skin-neutral terms such as “strongest tone.”

## Korean text

Set layer names and period captions in Pretendard, and totals, dates, units, and source metadata in mono. Use the same unit for all layers and spell it once in the axis/source line. Short names without digits work best. If a Korean service identifier inherently includes a numeral, give the legend a separate short label with no further number and keep the true identifier in metadata. Follow [Korean typography](korean-typography.md) for number formatting and Hangul line height.

## Light, dark, and full variants

Dataset, layer order, stack geometry, scale, and landmark match in every variant. Light and dark skins resolve the same ink opacities against their own paper token; after rendering, check separator visibility and layer distinction. A full editorial layout may add a finding headline, a short caption, and a source note around the same plot. Place all text outside the layer shapes.

## Accessibility

Write a description stating the periods, the unit, the shared symmetric baseline, the total trend, and the focal layer. Name every layer in the legend and report its aggregate total. Adjacent fill tones can sit close together, so labels and legend order identify each layer, with hue as a supporting cue. Keep text off the fills and confirm separators are visible in both skins and in grayscale.

## Verifier gates

Run `scripts/verify-diagram.mjs` for rendered overlaps, clipping, contrast, skin polarity, visible text, and a11y. Run `scripts/verify-type.mjs --type=streamgraph` to recompute each stack boundary, fixed order, shared scale, symmetric envelope, period/layer caps, zero handling, and legend bindings from the declared data. Inspect the smallest layer and the zero pinch at presentation size.

## Anti-patterns

- A shifting baseline, a bottom-anchored stack, or an independently normalized layer.
- Uneven period spacing for equally spaced periods, or a changing stack order.
- Dropped zero periods, smoothed-away real vertices, or exact values read off the envelope.
- Too many layers for the palette, or text placed on colored areas.
- A legend whose opacity description reverses its lightness direction between skins.
- Several landmark callouts competing with the overall silhouette.

## Related references

[Line chart](type-line.md) · [Bar chart](type-bar.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
