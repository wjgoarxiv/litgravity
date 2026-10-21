# Heatmap

Catalog ID: heatmap

## Purpose and selection

Pick a heatmap when readers scan a complete row-by-column matrix and care most about which intersections run relatively stronger or weaker. Typical inputs are service × release, team × week, or class × predicted label. Every cell is data. Name an editorial focal cell only when the title makes a claim about that exact intersection.

## Exclusions

A table fits fewer than three rows or columns, a line chart fits order and change over time, and a bar chart fits exact value comparison across categories. A diverging palette belongs to signed values around a meaningful zero or midpoint. When labels push cells below a legible size, split the matrix or summarize it, and keep every category accounted for.

## Content schema

Provide a title that states the comparison; complete ordered row and column labels; one numeric value for every intersection; the unit and period; any filter or missing-data rule; one declared scale mapping; optional displayed cell values; and zero or one focal row-column pair with the reason it matters. Mark missing values as missing, since encoding them as zero changes the story. The data binding on each cell carries its row ID, column ID, and value, while a separate paper underlay carries no data binding.

## Deterministic layout recipe

Use a 1000 × 500 viewBox. Row labels occupy x=40..160, column labels occupy y=40..64, the right edge is x=960, and the plot floor is y=420, with the lower band left for the source, legend, and scale key. Begin with 4–7 rows and 3–8 columns. Compute cell width and height uniformly from the available plot rectangle after 4px gutters, holding width at 80px or more and height at 36px or more. If the grid cannot meet both floors, reduce the category count through an explicitly named Other group or split into related panels. Right-align row labels in the left gutter, center column labels above cells, and align all grid coordinates to the 4px baseline. Cells, underlays, labels, and their parent group carry no SVG transforms.

## Encoding rules

Use one monotone ink-opacity ramp for non-focal cells. Declare the domain and transformation in the key, and let opacity rise or hold as the value rises. Fit the ramp without the focal value so an outlier leaves the other cells distinguishable. Keep the low end of the ramp visible and stop short of the point where cell text loses contrast. The chosen focal cell gets one accent tint and border. Print exact values inside cells when they fit, and otherwise supply a complete table next to the graphic. When exact values matter, the key states units and bounds, so tone reads as a rough scale instead of a precise lookup.

## Korean behavior

Keep Korean row and column names in Hangul. Set category text in Pretendard and reserve the mono role for short technical codes or numeric values. Allow two-line wrapping in the label gutters, and widen the gutter before shrinking type. Follow the common Korean guidance for number grouping, percent signs, units, and mixed Hangul-Latin spacing. Hangul labels stay upright, even in a cramped grid.

## Light, dark, and full variants

Light and dark skins share identical cell geometry, order, values, and scale. Only semantic color tokens invert, and contrast is rechecked for the darkest non-focal fill and the focal tint in each skin. The full editorial version may add a short framing sentence, a source note, and a compact conclusion outside the plot, while cells and encoding stay as they are. Legend and source line keep the same order across skins.

## Accessibility

Give the SVG a concise title and a description that names the dimensions, measure, period, and focal claim. Magnitude rides on the ordered contrast ramp and a text key, with hue as a supplement. Provide a data table for screen readers and for export contexts where cell values matter. Each cell value and axis label meets the text-size and contrast requirements in the accessibility guide.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for bounds, overlap, rendered clipping, contrast, skin polarity, accessibility, and visible-text checks. Run scripts/verify-type.mjs --type=heatmap; it confirms the complete Cartesian grid, unique row and column bindings, monotone non-focal opacity, focal count, and printed-value agreement. Review a screenshot at presentation size and confirm every label is fully visible. Then run the humanizer check on visible text.

## Anti-patterns

- One unrelated hue per row or column, which sets category identity against the quantity ramp.
- A rainbow or two-ended ramp for unsigned counts and rates.
- More than one accent cell, or auto-accenting the numeric maximum without checking the story.
- A continuous gradient key that suggests more precision than the colors provide.
- A missing row or column that quietly changes the displayed population.
- A transformed cell whose checked coordinates differ from rendered coordinates.
- Tiny labels, sideways labels, or numbers that collide with the grid.

## Related references

[Style guide](style-guide.md) · [Output spec](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md) · [Line chart](type-line.md)
