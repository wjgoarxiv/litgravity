# Bubble Chart

**Catalog ID:** bubble

## Purpose and selection

Pick bubbles when each item has three meaningful numeric values and the combined reading matters: x-position, y-position, and magnitude by area. A size that only decorates calls for the ordinary scatter type. A categorical third value belongs in facets or labels. Magnitudes spanning orders of magnitude make small marks vanish, so choose another form there. Route analysis of measured scientific data to the dedicated scientific-visualization skill.

## Content schema

Each item has a stable name, finite x and y values, and a strictly positive size value. Supply explicit units and bounds for both axes, tick values, and one area-scale constant. Include 5–15 items. Declare at most one focal item and no more than three visible point labels. Count any omitted items in the source note.

## Deterministic layout recipe

Set the viewBox to 1000 × 500, with plot bounds x=80..960 and y=40..420. Draw equal-interval ticks on each linear axis and bind each tick to its value. Compute center coordinates from the shared x and y scales, each independently. Radius equals one constant times the square root of the size value, so circle area tracks magnitude. Round once and reuse the rounded values in both the visible label and the geometry binding.

Paint circles from largest to smallest so smaller values stay visible. Insert a same-radius paper underlay right before each mark to keep gridlines from showing through a translucent fill. Place point labels outside the bubble where possible, joined to the mark by a short leader. Put verified geometry directly on each mark's coordinates: transforms or CSS geometry on marks and bound labels can make the rendered position disagree with the checked value. Keep every center where the data puts it; disclose unavoidable occlusion or change the chart.

## Encoding rules

Position encodes x and y, and area encodes the third measure. A neutral fill ramp balances ink mass and carries no data. One accent marks the editorially focal item. Keep stroke contrast strong enough to define each circle edge. Bind each rendered mark to its name, x, y, and size, and bind each text label and tick to the mark or value it describes. State scale bounds and whether the axes include zero.

## Korean behavior

Pretendard sets names and Korean explanations, and mono sets numeric ticks and IDs. Put units in axis titles and format labels with Korean locale conventions. Bindings keep the exact underlying values even when display labels round. Prefer a wrapped or concise horizontal axis caption to a rotated Korean axis title. Tell the reader in Korean that area represents magnitude, with diameter playing no role in the reading.

## Light, dark, and full variants

Light uses paper underlays, quiet gridlines, and stroked neutral bubbles. Dark has a dark paper underlay and recalculated neutral and accent strokes, with its own alpha values. Full adds a title, a key interpretation, and source text around the same plot. Scales, point order, and geometry are the same in every variant.

## Accessibility

The accessible description names the two positional measures, the area measure, the bounds, and the focal item. Provide a data table for exact values. Label the focal point directly, alongside any hue or area cue. Keep all axis and point labels legible at presentation size. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for shared contrast, clipping, overlap, and accessibility checks. Run scripts/verify-type.mjs --type=bubble for shared scales, area-proportional radii, positive sizes, draw order, and mark/label/tick bindings. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Radius directly proportional to the third value.
- Centers moved for a cleaner layout, or CSS transforms moving a bound mark after verification.
- A unique hue per item.
- Values hidden behind larger bubbles, or an extreme quietly omitted.
- A logarithmic or truncated axis without a plain statement.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
