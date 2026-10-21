# Marimekko chart

Catalog ID: marimekko

## Purpose and selection

Pick a Marimekko chart for a two-way part-to-whole view: column width is each category's share of the total, segment height is each series' share inside that category, and segment area is therefore the joint share. It answers which categories are large and how their internal composition differs.

## Exclusions

Choose a treemap for a single part-to-whole hierarchy, a 100% stacked bar when category widths should be equal, a grouped bar to compare series totals across categories, and a table when precise ranking comes first. Keep one unit per column. Beyond eight categories or five series, cells usually become too narrow to label.

## Content schema

Supply a total and unit; 3–8 ordered categories; 2–5 ordered series; and an amount for every present category-series pair. State the source, period, rounding policy, missing-series policy, and one optional focal cell. Categories and series carry stable IDs, and series are ordered by descending overall total with source order as the tie-breaker. Bind every data segment to a category ID, a series ID, and an amount, and bind every label, caption, and key to the same identifiers. Omit missing pairs entirely, leaving no zero-height rectangles.

## Deterministic layout recipe

Use a 1000 × 500 SVG with plot bounds x=40..956 and y=40..420. Start with constant 4px gutters between columns. Compute each column width as its category total divided by the grand total, applied to the plot width left after all gutters, then snap boundaries to whole pixels while preserving the total plot width. Every column spans the full 380px plot height. Within a column, order series consistently by descending overall total and set segment heights from the within-column share. Segments tile top to bottom with no vertical gaps, and shared boundaries use a hairline. Plot constants and column edges sit on a 4px grid, while data-driven segment boundaries use whole pixels and stay unsnapped. Below the plot, place each category name and whole-share under its column, and reserve a lower strip for series keys and a source line. For screens narrower than 760px, keep the chart width and add a local horizontal scroller.

## Encoding rules

Column width, within-column height, and segment area each state a related fact, so every dimension derives from the declared amounts. Give each series one ink-opacity level in a rank-ordered neutral ramp, with at most one focal accent segment. Print the amount and the within-column share inside segments that are large enough; the focal label may clarify its share of that category so it avoids implying a whole-total share. A narrow cell takes an information mark only when the mark fits fully, and the key explains that cell. Column widths and segment sizes follow the data alone, whatever room the text needs. The chart shows a whole: merge a small tail only into a named Other category or series, and disclose the merge.

## Korean behavior

Use Hangul for category and series names when the chart is for Korean readers, and keep data units and official product names. Apply Korean number grouping and percentages consistently, and separate within-category percentages from whole-total shares in captions and labels. Pretendard carries the names, and the mono role carries amounts, units, and concise IDs. Preserve the stable category order and wrap captions at phrase boundaries. Spell labels out in full and keep them horizontal.

## Light, dark, and full variants

Light and dark layouts share every column width, segment height, amount, category order, series order, and focal choice. Use identical ramp opacity values while the semantic paper/ink tokens invert, and check text contrast on each series fill. The full editorial variant may add a framing headline, one takeaway, and a source/date note outside the plot, leaving the geometry untouched. Set a 760px minimum canvas inside a local scroller so data marks keep their size on a phone viewport.

## Accessibility

Add an SVG title and description identifying the total, unit, period, category and series counts, both encodings, and any focal cell. Supply a companion data table with whole and within-category shares. Let the keys name each series and repeat the same visual token, so fill tone is never the only identifier. Explain information-mark cells in text, and make sure every narrow column can still be identified by its caption and table row.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for clipping, overlap, label fit, mobile overflow, contrast, skin polarity, SVG accessibility, and visible text. Run scripts/verify-type.mjs --type=marimekko to recompute column-width, segment-height, and joint-area shares from the amounts; check tiling, constant gutters, stable series order, complete bindings, focal count, marker containment, and total reconciliation. Inspect a narrow viewport screenshot and a full-size export, and run humanizer checks on all visible text.

## Anti-patterns

- Equal-width columns when category totals differ.
- Unequal column heights, or gaps between segments.
- Reordering a series inside a single column.
- An absent category-series pair drawn as a zero-height segment.
- A category or series dropped without a named aggregation.
- Marks expanded to fit labels, or rotated type in slivers.
- An area comparison claimed after width or height was adjusted by hand.
- A ramp direction named by lightness, which light and dark skins invert.

## Related references

[Treemap](type-treemap.md) · [Heatmap](type-heatmap.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md)
