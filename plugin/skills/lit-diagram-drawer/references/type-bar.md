# Bar and Column Chart

**Catalog ID:** bar

## Purpose and selection

Pick bars to compare a small set of discrete categories on one quantitative scale. Columns suit short labels, and horizontal bars suit longer Korean or Latin category names. A grouped bar covers two comparable series, and a stacked bar answers how components add up to a total. The dumbbell form belongs to exactly two values per category when the gap between them is the point.

This guide covers explanatory diagrams and product-level comparisons. Send measured scientific data analysis to the dedicated scientific-visualization skill. A continuous trend calls for a line chart, two continuous variables call for a scatter plot, and exact lookup calls for a table.

## Content schema

Provide the unit, then for each bar a category label, a value, and an optional series. Declare a meaningful zero baseline and an axis maximum. Use 4–8 categories; group or split once the count passes eight. The grouped form allows at most two series. The stacked form needs components that sum to a stated total. A dumbbell row carries exactly two values, one shared domain, names for both endpoints, and a stated row-order rule. Declare the focal category on its own, apart from the raw values.

## Deterministic layout recipe

Set the viewBox to 1000 × 500. Plot bounds run x=80..960 and y=40..420, with 60px below for category labels and a source or legend line. Draw 4–6 evenly spaced horizontal grid rules and a heavier zero baseline. Every bar height comes from one linear scale that starts at zero. For N categories, cut the plot width into N equal pitches, center a bar in each pitch, and make its width at least half the pitch so clear gaps remain.

Vertical bars suit concise labels. Once labels would wrap beyond two lines or overrun the available width, switch to horizontal bars with a label rail of at least 200px. Put value labels outside the mark with enough clearance to survive 3× export. A dumbbell uses horizontal rows and one common axis: place both dots from their actual values, and set value labels outside the pair by left/right geometry regardless of which series a dot belongs to.

## Encoding rules

Length carries the numeric value, and all categories share one scale and unit. Keep the value axis at its true start. At most one category takes the accent. Grouped charts keep consistent series identity with a compact legend. Stacked charts name each segment and show the stack total. Dumbbell charts pair one solid endpoint with one hollow endpoint, label both, and use a connector that stands apart from the axis. State the data period and source when supplied.

## Korean behavior

Pretendard sets Korean labels, and mono sets ticks and compact numeric values. Short noun phrases beat rotated text. Apply Korean number grouping and give the unit once, in the axis title or the subtitle, instead of on every bar. Keep zero and sign meaning intact for negative values. When a Korean category wraps, raise the row height or move to horizontal bars and keep the line height.

## Light, dark, and full variants

Light uses a quiet paper background, a faint grid, and a strong zero rule. Dark redraws the grid and baseline on a light-on-dark ramp and rechecks mark contrast, with fresh ink transparencies of its own. Full adds a title, a takeaway, a source, and a concise legend whenever multiple series exist. Every version keeps identical values, axis domain, and mark geometry.

## Accessibility

State the axis unit and baseline in the description. Place a nearby data table where precise values or category-by-category lookup matter. Tell series apart by label and shape or pattern along with color. Pair every small accent-colored value with another cue. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for global layout and accessibility checks. Run scripts/verify-type.mjs --type=bar for category count, shared scale, zero baseline, series limits, and numeric label consistency. The dumbbell variant also checks its shared domain and endpoint contrast under this type gate. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- A value axis that starts above zero to exaggerate a difference.
- A second focal accent, or 3D depth and shadows.
- Rotated long labels where horizontal bars would fit.
- Stacked comparisons without a named total.
- Dumbbell endpoints resized independently or moved into open space.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
