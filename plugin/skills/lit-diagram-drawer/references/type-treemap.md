# Treemap

**Catalog ID:** `treemap`

## Purpose and selection

Pick a treemap when the relative size of parts within a whole is the central message, as with storage use, budget, market share, population, or time allocation. Area carries the quantitative comparison. Pick a bar chart when exact rank and values outweigh part-to-whole composition, Nested for nonquantitative containment, and Tree when parent-child tracing is the goal.

The two-dimensional [Marimekko variant](type-marimekko.md) has its own catalog route and fits the case where both category share and within-category composition matter. See [Bar chart](type-bar.md) for adjacent comparison choices.

## Content schema

Provide one total, 4–8 nonnegative cells, a stable cell id/name, an optional parent id for a two-level hierarchy, a value, and its percentage of the declared whole. Include source, unit, period, rounding policy, and an explicit “Other” definition whenever small categories are aggregated. Each cell binds its computed share in `data-share`, including cells with no visible text. A focal cell may be selected for annotation, and the largest cell is just one candidate for that role.

## Deterministic layout recipe

1. Fix a plot rectangle and calculate each exact share from the unrounded source values. Confirm the shares reconcile to the whole before arranging cells.
2. For a two-level hierarchy, partition the parent rectangles first, then lay out each parent's children inside its rectangle. Sort siblings by descending share, then by stable id for ties. Use a squarified tiling: append the next item to the current row only while it improves that row's worst aspect ratio, and lay each row along the shorter side of the remaining rectangle. Apply this tie-break consistently so identical data yields identical geometry. A static diagram holds two levels at most.
3. Snap cell edges to the 4 px layout grid and leave equal 4 px gutters. Recalculate the resulting areas after snapping, and hold the relative area error within the verifier's published tolerance, checking the smallest cell most closely. Every cell keeps its true size, whatever its label needs.
4. Label tiers follow actual text measurement: large cells hold name, value, and share; medium cells hold name and value; small cells hold a compact abbreviation when it fits; slivers carry no text. A cell at least 12×12 px may contain a centered information mark when it stays inside the boundary, and smaller slivers are identified by their legend entry and stable position.
5. Give every cell a legend entry. When a category cannot be drawn faithfully or stays invisible at the target size, merge it into a named “Other” so that every category is accounted for. Add a source line stating the area encoding, dataset, and date.

## Visual encoding

Area is the data encoding. Use a restrained ink-opacity ramp for neutral cells and at most one accent cell, with an accent stroke as the focal cue. Keep to flat fills, free of rainbow palettes, gradients, 3-D, and shadows. State the measure in the source line (for example `AREA = POPULATION`). Name the ramp by contrast strength, since apparent lightness changes with the skin and “darker/lighter” would mislead. Keep cell labels on the paper-safe label layer and apply a mask wherever patterned backgrounds could show through.

## Korean text

Set cell names in Pretendard and exact values, shares, and source notes in mono. Use the same unit and decimal precision for every cell and a single Korean thousands and decimal convention. Preserve official category names, and map any necessary abbreviation in the legend. Keep Korean text upright. Follow [Korean typography](korean-typography.md).

## Light, dark, and full variants

Every variant shares the exact same shares, geometry, label tiers, and focal cell. Light and dark skins change semantic tokens and leave opacity values and area alone. Recheck text contrast against each composited cell fill, and move small text off midtone fills. A full editorial layout may add a title, one interpretation sentence, a source line, and a short legend outside the plot, with cell sizes unchanged.

## Accessibility

Provide a title and description stating what area encodes, the whole, the leading components, and how “Other” is composed. Name every cell in an adjacent legend/table, including unlabeled slivers. Color reinforces the area, and the accent says nothing about ranking. Keep the information mark, if used, inside its cell, and make names and values meet text contrast. Supply the exact source data as a text alternative for audit or reuse.

## Verifier gates

Run `scripts/verify-diagram.mjs` for bounds, overlap, clipped text, contrast, skin polarity, visible text, and a11y. Run `scripts/verify-type.mjs --type=treemap` to compare `data-share` against drawn area and to validate whole reconciliation, layout budgets, relative error, marker containment, and text bindings. Inspect the smallest cell and the ramp in both rendered skins.

## Anti-patterns

- Stripe tiling, uneven gutters, or layout changes that differ between runs on the same input.
- Missing or fabricated cells, or a total contradicted by displayed rounded values.
- Area read as an exact share after snapping without a relative-error check.
- Rotated or tiny text used to rescue an undersized cell.
- Rainbow colors, dark/light legend language, shadows, or an accent that implies the largest cell.
- A sliver lacking a legend entry or metadata share.

## Related references

[Bar chart](type-bar.md) · [Nested](type-nested.md) · [Tree](type-tree.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
