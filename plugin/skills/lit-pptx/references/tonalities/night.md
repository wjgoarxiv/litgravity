# Night

Night is a screen in a dark room. The ground is a deep blue-black, type is off-white, and the one
warm accent is amber, with a soft blue as the second series. Numbers sit in labelled rows at title
size at most, each with its basis, charts take most of the page, and a header band marks the slides that hold data. The
look keeps contrast high without glare, so a chart stays readable from the back of a hall. A plot or
diagram brought in as a picture on white would stand as a white card here: give it a `.dark` variant
beside the file, or its numbers as a `::: chart` block (authoring guide, "Charts").

## When to use it

Use Night for data and technical keynotes, product demos, architecture talks and quarterly reviews
shown on a big screen. It is the first candidate for a data-heavy review and moves up whenever the
brief says the deck is presented on a stage, at a demo day or in a darkened room. It also earns a
place when a third or more of the slides hold charts, because its families give charts the most
room of any pack.

## When it is the wrong choice

Night is wrong for decks that will be printed or read at a desk: a dark page wastes toner and tires
the eye on paper, so Ledger or Gazette serve those readers. It never mixes with light slides inside
one deck. It also lacks a table-led family, so a deck that is mostly lookup tables belongs in
Ledger.

## Tokens

These values are read from the pack file `pack.yaml` of the `night` tonality.

| Token | Value |
|---|---|
| ground / surface | `#0F1419` / `#1A222B` |
| ink / ink-muted | `#E8EDF2` / `#A3AEBA` |
| line | `#5A6672` |
| accent / accent-deep / accent-tint | `#E3A857` / `#F2C98A` / `#2A2418` |
| field / on-field | `#1E2A36` / `#F5F7FA` |
| positive / negative | `#6CC08B` / `#F08A7E` |
| series | `#E3A857`, `#7FB8E0`, `#A3AEBA`, `#C58FD0` |
| faces | display, title Pretendard Bold; body, label and numeral Pretendard Regular; `faces: a2z` swaps numerals to A2Z Light |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 6 |
| radius / edge | 6 / fill |
| table | header row on the surface colour with bold ink, hairline rows, no banding, numbers right-aligned, totals bold, the row the title names in the accent tint |
| chart | hairline gridlines, direct labels, accent on the item that matters and muted colours on the rest |
| decoration | header band, hairline rule, numeral, rail fill |

## Treatments by slide role

Text slides and image slides take `top-plain-large`, a title with no rule. Data slides take
`band`, the header band across the top. Charts with a takeaway take `side-rail`, sequences take
`kicker-numeral`, definitions take `side-rail`, and a pull quote takes `statement`. When the role's
treatment would leave an empty lower band, the engine tries the other treatments the family allows
and keeps the one that fills, while staying inside the variance cap. Write `title: side-rail` (or
another allowed treatment) under the `layout:` line to fix a slide's treatment; the business review
example does this for a big number and a timeline so the deck mixes enough compositions.

## Families and variants

- `full-chart`: one chart across the body with a short note under it.
- `chart-insight`: a chart with two or three takeaways.
- `kpi-row`: two to four headline values at title size, each with what it measures and its basis.
- `kpi-over-chart`: a value row above the trend it summarises.
- `dashboard-grid`: two to four small charts read together.
- `big-number`: a panel of two to four related figures (value, label, basis) with its evidence.
- `method`: how a metric is defined, formula first.
- `comparison`: two options or two periods, row by row.
- `timeline`: dated events on one axis.
- `statement`: a pull quote, or a display-led slide the user asks for.

Covers are `cover-numeral`, `cover-typographic` and `cover-figures`. Sections are `section-numeral`
and `section-field`. Closings are `closing-statement` and `closing-decision-box`.

Display slides. The typographic cover sets the year from the deck's date at title size beside the
topic name. A statement sets its quoted line in up to three balanced lines. A big-number panel
stands in amber on the dark amber tint, one row per figure with its label and basis. A closing's rows are keyed by date or amount, and the next step runs in the
field band above the footer.

## Do

Give each chart one highlighted series in amber and let the rest sit in muted tones. Keep titles
short labels (subject, measure, period): the open title and the band have tight glyph budgets, and the compile log warns when a title
runs over. Put the source on the last slide, inside the decision box. Use big numbers only for real
figures from the source, each with its basis and a sourced caption.

## Avoid

Avoid neon or saturated glows, a pure black ground, and any light slide mixed in. Avoid thin light
type below 18 pt; it breaks up on a projector. Do not lean on red and green alone for change; pair
the
colour with a sign and an arrow.

## Two worked slides

A value row above its trend states each number once with its basis, and the chart shows where it
came from and anchors the floor of the slide.

```markdown
---
layout: kpi-over-chart

## Cost per million requests, Q3 2025-Q3 2026

| Cost per million | Target | Change on Q2 |
|---|---|---|
| $1.82 | $2.00 | ▼ −9% |
| Q3 2026 | 9% under target | fourth fall in a row |

::: chart type=line unit="$"
| Quarter | Cost per million requests ($) |
|---|---|
| Q3 2025 | 2.61 |
| Q4 2025 | 2.34 |
| Q1 2026 | 2.12 |
| Q2 2026 | 2.00 |
| Q3 2026 | 1.82 |
> Cost per million requests by quarter (example data)
:::
---
```

A big-number panel holds three related figures with their basis and three lines of evidence, so
the figures are explained on the same page.

```markdown
---
layout: big-number
title: side-rail

## Incident recovery time, Q3 2026

| Median time to recover | Auto rollbacks | Slowest recovery |
|---|---|---|
| 8 min | 2 of 3 | 21 min |
| Q2: 27 min | before paging | database failover |

> Incident log, July-September 2026 (example)

- Recovery time is now under ten minutes
- The median fell from 27 minutes in Q2 after automatic rollback went live in July
- Two of the three incidents were rolled back before a person was paged
- The slowest recovery, 21 minutes, was a database failover in week 9
---
```

## Examples

`04-business-review-night-en.md` and `07-data-review-night-en.md` both use the pack defaults
(density 10, variance 6).
