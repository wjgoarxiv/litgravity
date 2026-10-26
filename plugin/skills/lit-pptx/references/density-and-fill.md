# Density and fill

Two dials set how a deck uses its pages. Density decides how much each page holds and how tightly;
variance decides how many title treatments and layout families one deck mixes. Each tonality has
defaults, and the direction card records the values used. The skill may move a dial by up to 2 on
its own and says so on the card; a larger move waits for the user.

Fill is what density is for. The old engine left the lower half of most slides empty: a short table
at the top, cards as tall as their two lines, a closing that said only "thank you". The engine now
measures how much of each slide's body stays empty under its last block and tries to close the gap,
and the gate fails a deck whose typical slide still leaves more than a fifth of its body unused. The
engine can only grow what the source gives it, though, so most of the work is in how the source is
written.

## Density

| Density | Grid (16:9 side margin) | Ramp | Body size | Item / group / block gap | Padding | Table row (min) | Empty band a slide may leave |
|---|---|---|---|---|---|---|---|
| 1-2 | airy (60 pt) | presented | 24 for four items or fewer, else 18 | 18 / 36 / 48 | 24 | 36 | 28 % |
| 3-4 | standard (48 pt) | presented | 18, may step to 24 | 12 / 24 / 36 | 24 | 32 | 24 % |
| 5-6 | standard (48 pt) | reading | 14, may step to 18 | 6 / 18 / 24 | 18 | 24 | 18 % |
| 7-8 | dense (36 pt) | reading | 14, may step to 18 | 6 / 12 / 24 | 12 | 22 | 14 % |
| 9 | dense (36 pt) | reading | 14 | 6 / 12 / 24 | 12 | 20 | 12 % |
| 10 | compact (24 pt) | compact: body 13, label 11, source 9 | 13 | 6 / 12 / 18 | 12 | 18 | 12 % |

The grid's side margins, the gaps, the padding and the body size move with density. From density 5
a deck reads on the reading ramp (body 14 pt, title 26 pt); density 10 is the compact step, and every
pack now starts there. On it a top title sits close over its rule (the body starts about 30 pt
higher), nothing is stepped up to fill, and the readable floor holds: body text 12 pt or more, table
cells and captions 11 pt, sources 9 pt. Lower the density (by at most 2 without asking, to 8: body
14 pt, 36 pt margins) only for a deck presented to a large room.

## Variance

| Variance | Title treatments per deck | Same family in a row |
|---|---|---|
| 1-3 (only when the user asks for a uniform deck) | 1-2; the gate records "variety lowered by the user" | — |
| 4 | 3 | at most 3 |
| 5-6 | 3-4 | at most 3 |
| 7-8 | 4-5 | at most 2 |
| 9-10 | 5 | at most 2, and at most 2 of one family in the deck |

The upper end is also capped by how many treatments the pack has.

## What the engine does to fill a slide

When a content slide's empty band exceeds the cap for its density, the engine tries the pack's
`fill-order`, one policy at a time, and keeps a step only when it does not overflow:

- **step-up** sets the body one ramp step larger (presented 18 → 24, reading 14 → 18), table data
  from label to body size, and KPI values a step up. One step only; titles never shrink to make room.
- **distribute** opens the item, group and block gaps one step each, keeping the body's top edge
  fixed. Rows of peers keep equal heights; a body is never centred vertically.
- **anchor-visual** lets a chart, figure or image take the rest of the body, and grows table rows up
  to a quarter above the density minimum.
- **change-family** is the author's step: the engine cannot invent a better shape, so the compile
  log says "choose a fuller family" and the source changes.

Every filled slide gets a line in the compile output, which goes into the build log:

```text
fill: slide 5 band 0.41 -> 0.12 (step-up, distribute)
fill: slide 9 band 0.39 -> 0.39 (none: nothing on the slide can grow; choose a fuller family)
```

A column can stand empty beside a full one even when the body's last block reaches the floor: two
short takeaways beside a chart, a source line at the column's foot and nothing between. The engine
reads each text or picture column against the column beside it (its largest empty band, from the
top of the pair down to where the longer column ends) and fills a column that leaves more than 40 %
of the body empty, in this order, by layout only:

- the visual takes columns: a narrower takeaway column wraps onto more lines and a wider chart or
  picture grows (down to three columns of takeaways; a picture keeps taking columns while either
  side leaves a fifth of the body empty);
- the takeaways step up to lead size when they fit and keep twelve glyphs a line;
- the room left is shared between the points, at most a sixth of the body a gap;
- two short points beside a chart that still leave the column empty run under the chart, side by
  side, and the chart with its values takes the body's width;
- a short sidebar note beside a long main column stands across the top at lead size and the main
  points run in two columns under it;
- a title under which a column still stays empty is unfit for the slide when another title fits.

The source strip closing a column counts as a block but never hides the band above it, and the
chart's values table under the takeaways is part of their column. The gate measures the same way
(OF-115).

The title treatment never buys the body room: every treatment draws in the slide grid's one title
zone over the same body (y 120-486), so a short body is filled by its own layout, never by moving the
title. The engine never pads cards with filler. Decoration (the pack's list plus the deck's `decoration:` kinds) adds texture and structure to a full slide; it never stands in for missing content.

## Writing source that fills

These are the rules the examples follow. Each one gives the engine something real to place in the
lower part of the body.

- **Every content slide carries its supporting facts.** Beside the main point, give what a careful
  reader asks for: the basis (where the figure comes from), a comparison (previous period, plan,
  peer), the period, the source, and the implication or next step. Tables run five to eight rows and
  four to six columns where the source has them, charts five to eight categories, comparisons three
  or four labelled criteria a side. Example values are labelled as examples.
- **Close every data slide with its source.** A last line `출처: …` (`Source: …`) names where the
  figures come from and when; a `주: …` (`Note: …`) line may follow with a definition or a data fact.
  The engine sets them as a strip at the foot of the body, at source size, so they cost the takeaways
  no room.
- **Figures come in rows of four to six.** A `kpi-row` table holds up to six figures, its second row
  each figure's basis or comparison ("계획 대비 +3.9%", "전년 동기 81억 원"). On the compact step a short
  card row runs as figure rows with the takeaways beside them.
- **Label comparison points by criterion.** Start each point with the same label on both sides
  ("비용: …", "일정: …"); the engine draws the labels as a criteria column and the two sides as rows.
- **Pair a chart with its numbers.** On the compact step the values of a chart (up to eight rows and
  four columns) stand as a small table under its takeaways when they fit; write the chart's table
  with the exact figures, units in the headers.
- **The title names the topic; the claim opens the body.** "분기별 매출 추이", not "매출은 다섯 분기 연속
  늘었다"; the sentence becomes the first takeaway. A claim with its reasons is a `summary-box-list`
  (the claim boxed over the reasons), a `kpi-row`, or a table with the claim as its first takeaway;
  a stand-alone `statement` slide is for a pull quote or a deck the user asks to be display-led.
- **Numbers are never the whole slide.** A `big-number` is a data panel of two to four related
  figures: a KPI table with labels, values and a second row giving each figure's basis or comparison
  ("전년 대비 +12%", "목표 50%"), a caption with period and source, then two or three lines of
  evidence. Figures are set at title size at most.
- **Every table gets a takeaway.** Two or three bullets after the table: the row that matters, the
  comparison, the decision it supports. `table-insight` sets them beside the table, `ledger-table`
  under it. A short table (three rows or fewer) is usually a `kpi-row` or a `comparison` instead.
- **Every chart gets a caption and two or three takeaways.** The caption says what is plotted and
  marks example data; the bullets say what to notice.
- **A closing carries the ask and the next step.** The title names the request ("운영 자금 30억 원 요청
  내역"); the body
  lists what is to be approved (a small table of item, amount, date, owner works well) and the next
  step with its owner and date. "감사합니다" or "Questions?" alone is never a closing.
- **A comparison has the same number of points on both sides,** each a full clause, so the rows
  read across and reach the floor together.
- **A process or timeline names what happens at each step,** not only the step's name; a timeline
  fed by a table takes its takeaway bullets under the axis. Give a timeline two or three takeaways:
  one alone can leave the band under the axis empty, which OF-109 fails.
- **References and appendices list every source with its date,** one per row; when there are only
  two or three, add the definitions the deck relies on.
- **Merge before you pad.** When a slide still has little to say, merge it with its neighbour or
  give it a family that suits short content. Never add filler bullets that restate the title.

## How the gate measures it

`qa_deck.py` measures the empty band from the compiled file: the share of the body (from the title's
bottom, or the top margin when the title sits low, down to 486 pt) below the lowest content block.
Decoration, the footer and the example notice are not content. Cover, section, statement, quote
and statement-closing slides are exempt.

- **OF-112** reports each slide over its density cap as an advisory with a fix hint, and fails the
  deck when the median band over all measured slides is above 0.20. On a legacy template the median
  is an advisory too, because the legacy renderer has no fill policies.
- **OF-109** (older and stricter per slide) still fails any single slide or card that leaves more
  than 35 % of its area as one empty band.
- **OF-115** fails a slide with an empty region: among them a text or picture column whose largest
  empty band beside a longer column passes 40 % of the body (a source strip at its foot and the
  chart's values table under the takeaways included). Beside the figure rows of a kpi-row or
  big-number slide the takeaway column is measured to the body floor, since the rows stop where
  their spacing ends; the engine sets the takeaways across under the rows, or lets them share the
  room beside the rows when the across form would leave a band between the two.
- **OF-111** fails a deck whose content slides share one composition (title zone × body partition ×
  dominant content) on more than 40 % of them, or show too few distinct compositions.

A slide that cannot be filled honestly (a one-line agenda, a short appendix) may stay over its cap;
the deck median still has to hold. Shrinking text, inflating cards or adding decorative shapes to
pass the gate is a defect, and the critique counts it as one.
