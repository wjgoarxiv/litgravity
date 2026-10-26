# Paper

Paper treats the screen like a printed journal page. The ground is white, the type is near-black,
and structure comes from thin rules rather than filled boxes. Figures do most of the talking, each
with a numbered caption and a source, and tables are set in the three-rule style readers know from
papers. One deep crimson is the only colour with a job: it marks the method or result the talk
proposes, and nothing else. The effect is calm and checkable, which is what a room of peers wants
when they are deciding whether to believe a result.

## When to use it

Pick Paper for research talks, thesis defences, lab meetings and technical reviews where the
audience reads the evidence closely. It is the first candidate for the research-talk deck type, and
it moves up the list when the source carries numbered citations, DOIs or a references section, or
when a third or more of the slides hold a chart. It also suits a written analysis that happens to be
delivered as slides, because its hairline tables and numbered figures survive printing.

## When it is the wrong choice

Paper reads as cold to a sales, launch or investor audience; there Signal or Studio carry the
energy the room expects. It is also a poor fit for a deck of mostly photographs, since the pack has
no full-bleed image family and keeps pictures inside the grid. If the talk is given on a large
stage in a dark room, Night keeps charts legible at distance where Paper's thin rules disappear.

## Tokens

These values are read from the pack file `pack.yaml` of the `paper` tonality.

| Token | Value |
|---|---|
| ground / surface | `#FFFFFF` / `#F5F5F6` |
| ink / ink-muted | `#111418` / `#50565E` |
| line | `#C9CDD2` |
| accent / accent-deep / accent-tint | `#8C1C2B` / `#5E121C` / `#F6E6E8` |
| field / on-field | `#111418` / `#FFFFFF` |
| positive / negative | `#1E6B3A` / `#50565E` |
| series | `#8C1C2B`, `#111418`, `#50565E`, `#2E5E8A` |
| faces | display and title Pretendard Bold; body, label and numeral Pretendard Regular (`faces: a2z` keeps the same map) |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 5 |
| radius / edge | 0 / border |
| table | booktabs: heavy rule over the header, light rule under it, heavy rule at the end; no fill, no banding; numbers right-aligned; totals bold |
| chart | hairline gridlines, direct labels, series in order (the proposed method takes the accent, baselines take ink and muted ink) |
| decoration | hairline rule, box outline |

Negative values share the muted ink on purpose: a drop is shown with a sign and a glyph, never with
a
warning colour that would compete with the accent.

## Treatments by slide role

Text slides, data tables, sequences and reference pages take `top-rule`, where the rule under the
title is a full hairline. Charts and figures that carry the slide take `bottom-anchor`, the title
closed by a heavy rule over a picture that takes the body's full height. Definitions and method slides
take `side-rail`, a comparison is drawn as a ruled table under a `top-rule` title (the pack's
`structure`, kept even when the deck already leans on that title), and a quoted line takes `statement`. The engine keeps the role's treatment when
the body fills to the density band; when it would leave a tall empty band, it lays the slide out
under the other treatments the family allows and keeps the one that fills best, while capping how
many treatments one deck mixes. A slide can ask for a specific treatment with a `title:` line under
its `layout:` line, for example `title: top-rule`, as long as the family allows it.

## Families and variants

- `figure-academic`: one figure with its numbered caption and a short observation, basis and
implication.
- `figure-pair`: two figures side by side, for before and after or two conditions.
- `method`: a formula or process figure beside the definitions of its symbols.
- `chart-insight`: a native chart with two or three takeaways beside it.
- `full-chart`: a chart across the body when the plot itself is the argument.
- `table-insight`: a booktabs table with its caption and the takeaway it supports.
- `comparison`: contributions against limits, or two methods row by row.
- `quote`: a participant's or reviewer's words as a statement.
- `statement`: an epigraph or quoted line; the research question and the finding go in a labelled
  content slide with their evidence.
- `text-column`: running argument at reading measure.
- `references-appendix`: the reference list, one entry per row.

Covers are `cover-index` (lists the deck's sections, so it needs at least two), `cover-typographic`
and `cover-split-image`. Sections are `section-rule` and `section-field`. Closings are
`closing-summary-list` and `closing-ask`.

Display slides. The typographic cover is a journal title page: a heavy rule, the title, a hairline,
then the presenter and, under it, the place and date. A statement sits between two hairlines, like
an epigraph. A section shows the deck's parts in one line under its rule, this part in the accent. A
closing's next step sits under a rule at the foot of the page, its rows keyed by date.

## Do

Number every figure and table caption and give each a source. Title each slide with what it shows
("Conversion at 60 min by feed rate"), and put the finding in the first observation. Keep the crimson for the proposed
method in every chart, so the audience learns its meaning on the first plot. Put the data fact that
bounds a result on the same slide, beside the number it affects. End with the reference list, so the last page carries the
deck's sources.

## Avoid

Avoid the short accent bar under a title; in this direction the rule is a hairline. Avoid coloured
card fills, which turn a paper into a dashboard. Do not let the accent mark anything that is not the
proposed method, and never show a figure without its numbered caption.

## Two worked slides

A table slide labels the table in the title and states the takeaway first beside it, so the body
fills and the reader does not have to compute the gain.

```markdown
---
layout: table-insight

## Conversion at 60 min by feed rate and feed mode

| Feed rate (L/min) | Single feed (%) | Staged feed (%) | Gain (points) |
|---|---|---|---|
| 0.5 | 52 | 77 | 25 |
| 0.75 | 51 | 76 | 25 |
| 1.0 | 50 | 75 | 25 |
| 1.5 | 47 | 71 | 24 |
| 2.0 | 41 | 64 | 23 |

> Table 1. Conversion at 60 minutes by feed rate, three replicates each (example data)

- The gain holds at all five feed rates tested (+23 to +25 points)
- The relative gain is 48-56% at every rate
- The gap narrows by two points at the highest rate
- Heat removal, not the feed schedule, limits the fastest runs
---
```

A method slide pairs the process figure with every symbol the talk will use, so later charts need
no legend.

```markdown
---
layout: method

## Three-stage feed layout and symbols

![Figure 2. Process layout used in all runs | Source: example image](assets/example-b.png)

- **Layout** feed split into three stages along the reactor
- **X** conversion, the fraction of feed that reacted
- **k** first-order rate constant, 1/min
- **τ** residence time per stage, min
- **n** number of feed stages, three in every run
- **q** feed split between stages, 50/30/20 by volume
---
```

## Examples

`05-research-talk-paper-en.md` uses the pack defaults (density 10, variance 5).
