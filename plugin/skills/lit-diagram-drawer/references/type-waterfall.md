# Waterfall chart

**Catalog ID:** `waterfall`

## Purpose and selection

Pick a waterfall to show how a start total becomes an end total through signed sequential contributions, as in a budget bridge, headcount change, conversion gains/losses, or a P&L walk. The running total reconciles at every step. Pick a dumbbell for two endpoints where only the gap matters, a bar chart for independent category values, Sankey for branching quantity flow, and funnel for ordered drop-off.

## Content schema

Provide 3–8 bars in total: a positive start total, at least one signed nonzero delta, an end total, and optionally one subtotal. Each bar has a stable name, a role (`total`, `delta`, `subtotal`), a value, a unit, and a displayed label. Deltas carry an explicit plus or minus sign. Include a single linear domain, the source, the period, and any “Other” aggregation definition. Totals and deltas share one unit.

For an SVG implementation, bind `data-role`, signed `data-value`, and `data-name` on every bar, and bind the running level on each carry connector with `data-carry`. The verifier recomputes the walk from the declarations and compares it with the displayed geometry.

## Deterministic layout recipe

1. Draw vertical bars from left to right: starting total, signed contributions, optional subtotal, and ending total. Select a common linear y-scale whose domain includes zero and every running total, with zero as the baseline for total bars.
2. Draw start, subtotal, and end totals from the baseline up to their values. Each delta bar spans exactly from the prior running level to the next. A horizontal carry joins adjacent bars at the exact level it transports.
3. Reconcile `start + Σ(delta) = end` before placing any geometry. Carry levels reflect every intermediate sum. Round only at the final pixel coordinate, and keep the bridge faithful to the data. Zero deltas are omitted, with a note explaining the omission if it is material.
4. Give bars equal width and pitch, with enough room for category labels. Value labels for totals and increases sit above the bar top, and decrease labels sit below the lower edge where the incoming carry stays clear. Print every delta with its sign.
5. Use 3–8 bars in total, endpoints included, and at most one subtotal. With too many contributions, combine a justified tail into a named “Other” bridge or split the reconciliation into two views.

## Visual encoding

Totals take the strongest neutral outline/fill, increases a light filled treatment, and decreases a hollow treatment. This separates sign in grayscale as well as in color. One focal bridge may take the accent, keeping its signed label and geometric direction. Carries use a clearly visible rule because they assert conservation. Axes and gridlines are secondary, and values, signs, and bridge endpoints are primary.

## Korean text

Set categories in Pretendard and exact values, units, and source notes in mono. Print explicit `+`/`−` signs for all changes, whatever the Korean wording says. Apply one thousands-separator and decimal policy throughout and state whether values are rounded. Keep category labels short and upright, and use `기초`, `증가`, `감소`, and `기말` where they match the accounting meanings. Follow [Korean typography](korean-typography.md).

## Light, dark, and full variants

Values, scale, carries, bar roles, and the focal bridge are unchanged across variants. Light and dark skins use semantic tokens for paper, ink, and accent, and a decrease stays hollow in both. The full editorial form can add a headline about the main contribution, one sentence on reconciliation, and source/period metadata. Verify carry visibility and value-label contrast in the dark skin.

## Accessibility

Provide a title and description with the starting amount, the signed walk, the ending amount, the unit, and the reconciliation result. Every bar prints its value, and each delta includes its sign. Fill state and geometry both indicate direction, so hue is a supplement. Keep carry levels visible and text clear of them. Offer an equivalent table of start, delta, running balance, and end values for exact access.

## Verifier gates

Run `scripts/verify-diagram.mjs` for overlap, clipping, off-canvas geometry, contrast, skin, visible text, and a11y. Run `scripts/verify-type.mjs --type=waterfall` to recompute the running total, bridge geometry, carry levels, role/value bindings, signed labels, bar count, and domain. Review every value label at final output resolution, because a mathematically valid chart may still carry an illegible decrease label.

## Anti-patterns

- A floating delta without a carry, or a carry at the wrong running level.
- An unreconciled end total, mixed units, or unsigned delta labels.
- Sign encoded by red/green hue alone.
- A truncated or changing axis that exaggerates bridge size.
- Multiple subtotals, zero-height bars, or more than eight columns.
- Rounded geometry or labels that disagree with the declared values.

## Related references

[Bar chart](type-bar.md) · [Sankey](type-sankey.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
