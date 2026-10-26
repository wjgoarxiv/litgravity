# Data Display Cookbook

Standardizes numbers, tables, and KPI tiles. Colors below refer to the palette roles of the chosen tonality (or the named legacy template), not fixed brand hex. The pack also fixes the table style (booktabs, ledger, light grid, header fill or open), its rules and banding, and the chart style (gridlines, direct labels or legend, how the highlight is drawn); write the data and let the pack draw it. Each tonality sheet in `tonalities/` names its table and chart style.

## Number display
| Data type | Preferred | Avoid |
|-----------|-----------|-------|
| Year | `2026`, `2026E`, `2027F` | `2,026` |
| Percentage | `12.3%` | `0.123` |
| Multiple | `3.2x` | `3.2 times` |
| Zero / N/A | `-` | `0.0` when it means N/A |
| Currency header | `매출 (억원)` / `Revenue (USD m)` | repeating the unit in each row |

## Table patterns

### 1. Compact operational table (4–6 columns of operational data)
- Units in the header, numbers right-aligned, a total row last when the data has one (the engine sets it apart by the pack's rules). Follow it with two or three takeaway lines (`table-insight` beside, `ledger-table` under).

### 2. Comparison matrix (alternatives / vendors / scenarios)
- One row per option, one emphasis only: the pack tints the row whose first cell the slide title names. Right-align all quantitative columns. Two options with three to four points each read better as a `comparison`; two axes with four options read better as a `matrix-2x2`.

### 3. KPI strip (2–4 headline numbers before a narrative/chart)
- A one-row table of short values with the labels in the header; the first value takes the accent. Positive/negative colours only for deltas, always with a ▲/▼ glyph and a sign. Add one to three evidence bullets; under a side title the values become rows down the body.

## Source-note pattern
Place source text under the table/chart, smaller than body text:
- `Source: ERP export, 2026-04-14, Procurement`
- `출처: 내부 운항 데이터, 2026.04 기준`
- `Source: Clarkson Research, 2026-04, LNG orderbook`

## Rules of thumb
- Units in headers, never per cell. Numeric columns right-aligned (the real fix on export).
- ≤ 6 columns; split a wide table rather than shrinking text below the template's minimum body size.
- One emphasis per table; no styled spans inside cells; no rainbow semantics. One series is one hue; several series take the pack's series colours in order.
- Keep one primary visual emphasis. Do not highlight a row, a column, and several cells at the same time.
- Avoid chart-type mixing unless a clear analytical reason requires it; state that reason in the interpretation.
- Keep labels readable at presentation scale and move or abbreviate collision-prone labels. Axis labels, data labels, annotations, and legends must not overlap.
- A dense table uses the same bounds: units in headers, right-aligned numbers, ≤6 columns, no text below the template floor, and no collision with an adjacent image.

## Evidence display patterns

- **figure plus interpretation:** one figure, numbered caption, source locator, the data basis beside the number it bounds, and a concise interpretation placed as one visual group.
- **table plus decision takeaway:** one bounded table, caption/source, and one decision sentence. Do not duplicate the table in prose.
- **source capture:** crop to the relevant region while retaining enough interface/document context to verify the locator.
- **two-record appendix evidence:** at most two records per slide. Each record includes summary, source/locator, and DOI/canonical link when available.

## Filling the slide with the data, not around it

- A table of three rows or fewer at the top of a slide leaves the page empty; make it a `kpi-row`, a `comparison`, or give it its takeaway.
- A chart takes the body to the floor (`anchor-visual`), with its caption bound under it; two or three takeaways sit beside it (`chart-insight`) or the title over a heavy rule marks a page led by its chart (`bottom-anchor`).
- One real figure that carries the slide is a `big-number` with two or three lines of evidence; a decorative number is a defect.
- See `density-and-fill.md` for the fill policies and the gate checks that measure the empty band.
