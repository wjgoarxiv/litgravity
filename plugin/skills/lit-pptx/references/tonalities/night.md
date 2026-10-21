# Night

Night is a stage screen in a dark room. The ground is a deep blue-black (#0F1419), the type is
off-white, one amber accent marks the series or figure that matters and a soft blue serves as the
second series. Numerals are light, charts take the width of the page, and surfaces are slightly lifted
slate with soft corners (radius 6). The pack file draws the boundary: data and technical keynotes on
a dark ground, wrong for decks printed or read on paper, and never mixed with light slides inside one
deck.

## When to choose it

Pick Night for a talk shown on a large screen in a dim room: an engineering review, a data keynote, a
platform or infrastructure update, a launch of a technical product. Ten families are listed and
five of them hold charts or figures (`full-chart`, `chart-insight`, `kpi-row`, `kpi-over-chart`,
`dashboard-grid`), which is why a deck of metrics is the natural fit. `method` carries an architecture
figure with its definitions.

Decks that are printed, sent as PDF to be read on paper, or shown in a bright room belong in Paper or
Ledger: the dark ground wastes ink and the thin strokes of a light numeral lose contrast in daylight.

## Tokens

| Token | Value |
|---|---|
| ground / surface | #0F1419 / #1A222B |
| ink / ink-muted / line | #E8EDF2 / #A3AEBA / #5A6672 |
| accent / accent-deep / accent-tint | #E3A857 / #F2C98A / #2A2418 |
| field / on-field | #1E2A36 / #F5F7FA |
| positive / negative | #6CC08B / #F08A7E |
| series | #E3A857, #7FB8E0, #A3AEBA, #C58FD0 |
| faces | Pretendard Bold for display and titles, Pretendard Regular for body, labels and numerals; `faces: a2z` moves numerals to A2Z Light |
| tracking (title / display) | -1 % / -2 % of the size |
| density / variance | 10 / 6 (up to 4 title treatments) |
| radius / edge | 6 / fill |
| table | header in the surface colour, hairline row rules, the row whose first cell the title names in accent-tint, bold totals |
| chart | hairline gridlines, direct labels, accent on the highlighted series over muted ones |
| image | no frame |
| decoration | header-band, hairline-rule, numeral, rail-fill |
| fill-order | anchor-visual, step-up, distribute, change-family |

The pack validator enforces contrast on ten role pairs (text pairs at 4.5:1, accent on ground at 3:1),
and the light-on-dark pairs here meet the same floors. On a dark page, accent-deep is the lighter amber (#F2C98A), used for text on
the accent tint. Positive and negative are lighter than on white packs for the same reason. The ramp
is the compact one (body 13 pt, label 11, title 26, display 36); light thin type below 18 pt loses
contrast across a room, so keep numerals and labels on the regular and bold weights.

## Titles by family

Role defaults: content, images and sequences take `top-plain-large` and `kicker-numeral`; data and
references take `band`; data with a takeaway and definitions take `side-rail`; statements take
`statement`. A `band` title sits inside a full-width band in the field colour (#1E2A36), which on this
ground reads as a lit header strip. `bottom-anchor` is absent, so a pin such as `title: bottom-anchor`
stops the compile with `Slide 1: title "bottom-anchor" is not one of the night treatments
(top-plain-large, statement, side-rail, kicker-numeral, band)`.

| Family | Default title | Then, in pack order |
|---|---|---|
| `full-chart` | `top-plain-large` | none |
| `chart-insight` | `side-rail` | `top-plain-large`, `band` |
| `kpi-row` | `band` | `top-plain-large`, `side-rail` |
| `kpi-over-chart` | `band` | `top-plain-large` |
| `dashboard-grid` | `band` | `side-rail` |
| `big-number` | `side-rail` | `top-plain-large` |
| `method` | `side-rail` | `band` |
| `comparison` | `band` (numbers) / `top-plain-large` (arguments) | `top-plain-large`, `side-rail`, `band` |
| `timeline` | `top-plain-large` | `band` |
| `statement` | `statement` | none |

## Families and variants

- `full-chart`: one chart across the whole body with its caption; the plot is the argument.
- `chart-insight`: a chart with two or three takeaways; at the compact step its values stand in a
  small table.
- `kpi-row`, `kpi-over-chart`: results with a basis row, alone or above the trend that explains them.
- `dashboard-grid`: two to four charts read together (two columns, or three for three charts), with
  one line of takeaway under them.
- `big-number`, `method`, `comparison`, `timeline`, `statement` as in the other packs.
- Covers `cover-numeral`, `cover-typographic`, `cover-figures`; sections `section-numeral`,
  `section-field`; closings `closing-statement`, `closing-decision-box`.

Display devices: the cover is a `numeral` (a year from the title or `date` at title size in amber over
the title; a deck without a year takes the plain cover), a statement is `open` (the sentence alone on
the dark ground), a big number sits on the amber-tinted panel, and a closing's next step runs as a
`band` in the field colour above the footer. A native chart is drawn in the pack's colours on the
dark ground, so axis text and gridlines stay legible.

## Do

- Keep every slide in the one dark tonality of the deck.
- Draw charts natively with `::: chart`; the engine sets series colours, labels and axes for the dark
  ground.
- Give a figure that comes from another tool a dark variant: `flow.png` is accompanied by
  `flow.dark.png` in the same folder and the engine picks it up.
- Give each chart a caption with period and source, and name the highlighted series with a period or
  a reference word.

## Avoid

- Neon or saturated glows.
- A pure black ground; the ground is #0F1419.
- Light slides mixed in.
- Thin light type below 18 pt.

## Failure patterns

| Symptom | Cause | Fix |
|---|---|---|
| QA OF-117 "a light figure (92 % near-white) on a dark ground" | a PNG exported on a white background was placed in a `method` slide | add `<name>.dark.png` beside the picture, or redraw it as a `::: chart` |
| `Compilation error: ... title "bottom-anchor" is not one of the night treatments (...)` | a pin copied from a light pack | pin one of the five treatments, or drop the pin |
| a literal `> ...` line under a chart | the caption sits after the closing `:::` | put the `>` caption inside the block |
| the accent lands on the wrong series | no period or reference word in the series names | name earlier series with a period or a reference word, or put the highlighted series last |
| `dashboard-grid` falls back to one chart | the slide holds a single `::: chart` block | use `chart-insight`, or add a second chart |

## Two worked slides

One chart across the body; the amber line is the latest quarter because the series names carry their
quarters, and the caption sits inside the chart block.

```markdown
---
layout: full-chart

## Median API latency by week

::: chart type=line unit="ms"
| Week | Q2 median (ms) | Q3 median (ms) |
|---|---|---|
| W1 | 182 | 171 |
| W2 | 185 | 166 |
| W3 | 181 | 158 |
| W4 | 188 | 151 |
| W5 | 184 | 149 |
| W6 | 190 | 144 |
> Median API latency, weekly, Q2 against Q3 (example data)
:::
---
```

Two charts read together under a band title, with the fix stated in two lines below them.

```markdown
---
layout: dashboard-grid

## Error rate and cache hit rate by region

::: chart type=column unit="%"
| Region | Error rate (%) |
|---|---|
| North | 0.42 |
| East | 0.38 |
| South | 0.61 |
| West | 0.35 |
> Error rate by region, Q3 (example data)
:::

::: chart type=column unit="%"
| Region | Cache hit rate (%) |
|---|---|
| North | 91 |
| East | 93 |
| South | 84 |
| West | 94 |
> Cache hit rate by region, Q3 (example data)
:::

- South carries the highest error rate and the lowest cache hit rate
- Raising South's cache hit rate to the fleet average is the first fix
---
```

Both slides compile under `tonality: night` with `lang: en` and a generic cover (drawn as
`cover-numeral` from the year in the title) and pass `qa_deck.py`. The platform team and the numbers
are invented.
