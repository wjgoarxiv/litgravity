# Density, variance and fill

Two dials set how a deck uses its pages. **Density** (1-10) decides how much each page holds and how
tightly: the grid, the type ramp, the gaps, the padding and the share of the body a slide may leave
empty. **Variance** (1-10) decides how many title treatments and layout compositions one deck mixes.
Every tonality ships with defaults (density 10 everywhere; variance 4 for gazette, 5 for ledger and
paper, 6 for signal, chalk and night, 7 for atlas, 8 for studio), and the direction card records the
values used (`direction-step.md`). The skill may move a dial by up to 2 on its own and says so on the
card; a larger move waits for the user. Frontmatter carries them as `density:` and `variance:`.

Fill is what density is for. An unaided renderer leaves the lower half of most slides empty: a short
table at the top, cards as tall as their two lines, a closing that says only "감사합니다". The engine
measures how much of each body stays empty under its last block, tries to close the gap, and the gate
(OF-112, OF-109, OF-115) fails a deck whose typical slide still leaves more than a fifth unused. The
engine can only grow what the source gives it. Most of the work is therefore in how the source is
written, and the second half of this file is about that.

## 1. Density

The engine reads these tokens from `DENSITY_BANDS` in `scripts/lib/grid-resolver.js`. Sizes are points on
the 960 x 540 canvas; the 4:3 canvas (720 x 540) shrinks the margins only.

| Density | Grid, side margin | Ramp | Item / group / block gap | Padding | Table row (min) | Engine cap | Gate cap |
|---|---|---|---|---|---|---|---|
| 1-2 | airy, 60 | presented | 18 / 36 / 48 | 24 | 36 | 0.28 | 0.28 |
| 3-4 | standard, 48 | presented | 12 / 24 / 36 | 24 | 32 | 0.24 | 0.24 |
| 5-6 | standard, 48 | reading | 6 / 18 / 24 | 18 | 24 | 0.18 | 0.20 |
| 7-8 | dense, 36 | reading | 6 / 12 / 24 | 12 | 22 | 0.14 | 0.16 |
| 9 | dense, 36 | reading | 6 / 12 / 24 | 12 | 20 | 0.12 | 0.12 |
| 10 | compact, 24 | compact | 6 / 12 / 18 | 12 | 18 | 0.12 | 0.12 |

Type ramps, source / label / body / lead / title / display / cover / hero:

| Ramp | Sizes |
|---|---|
| presented | 12 / 14 / 18 / 24 / 32 / 44 / 56 / 72 |
| reading | 10 / 12 / 14 / 18 / 26 / 36 / 44 / 60 |
| compact | 9 / 11 / 13 / 18 / 26 / 36 / 44 / 60 |

The **engine cap** is the share of the body a slide may leave empty before the fill policies run. The
**gate cap** is the per-slide line OF-112 reports as an advisory. The deck passes when the median band
over all measured slides stays at or under 0.20. Density 10 is the compact step, and every pack starts
there: 24 pt margins, body 13, labels and table cells 11, sources 9, a top title sitting close over its
rule. The step-up policy is off at density 9 and 10, because nothing is inflated to fill on a page
designed to be read closely. Lower density (to 8 without asking: body 14, 36 pt margins) only for a deck
presented in a large room.

## 2. Variance

| Variance | Distinct title treatments in the deck | Floor on a deck of 8 slides or more |
|---|---|---|
| 1-3 (only when the user asks for a uniform deck) | at most 2 | 1; the gate records "variety lowered by the user" |
| 4 | at most 3 | 3 |
| 5-6 | at most 4 | 3 |
| 7 and above | at most 5 | 3 |

The ceiling is also bounded by the pack's own list of treatments (3 to 5). Three further limits hold the
variety up: no title zone (top, side, band, bottom) and no single composition covers more than 40 % of the
content slides, and a deck needs at least ceil(0.6 x content slides) distinct compositions, capped at 5
(OF-111). The compile log names every move the engine makes to meet them:

```text
variety: slide 5 drawn under side-rail so the deck carries 3 title treatments
variety: slide 7 drawn under bottom-anchor so no title zone covers more than 40 % of the content slides
```

The engine moves data slides only (roles `data` and `data-takeaway`); agendas, sequences and definitions
keep their titles. A bottom title is for a slide whose upper part is a chart, a picture, a row of
figures or a timeline axis. A table stays under a top or band title.

## 3. What the engine does to fill a slide

When a content slide's empty band exceeds the engine cap for its density, the engine walks the pack's
`fill-order` and applies one policy at a time. A step is kept only when it fits without overflow and moves
the lowest block down. The order differs per pack:

| Pack | `fill-order` |
|---|---|
| ledger | step-up, distribute, anchor-visual, change-family |
| gazette | step-up, distribute, change-family, anchor-visual |
| signal | step-up, change-family, anchor-visual, distribute |
| atlas | anchor-visual, change-family, distribute, step-up |
| chalk | distribute, step-up, change-family, anchor-visual |
| paper | anchor-visual, distribute, step-up, change-family |
| studio | change-family, step-up, anchor-visual, distribute |
| night | anchor-visual, step-up, distribute, change-family |

- **step-up** sets the body one ramp step larger (presented 18 to 24, reading 14 to 18), table data from
  label to body size, and KPI values a step. The title keeps its size, whatever room the body needs.
- **distribute** opens the item, group and block gaps one step each along the scale 6, 12, 18, 24, 36, 48,
  72 pt (item gap to 24 at most, group and block gaps to 48), keeping the body's top edge fixed. Rows of
  peers keep equal heights, and the body stays top-aligned.
- **anchor-visual** lets a chart, figure or image take the rest of the body and raises the table row
  minimum by a quarter.
- **change-family** belongs to the author. The engine cannot invent a better shape, so the log says
  `choose a fuller family` and the source changes.

Every slide that needed filling writes a line to the compile output (copy these into the build log):

```text
fill: slide 2 band 0.22 -> 0.13 (step-up, distribute)
fill: slide 4 band 0.94 -> 0.94 (none: nothing on the slide can grow; choose a fuller family)
```

A slide with a standing table opens its rows too: the region shares the room left among the rows, at most
one minimum row height each.

### Columns that stop short

A column can stand empty beside a full one even when the body's last block reaches the floor: two short
takeaways beside a chart, then a source line and nothing between. The engine reads each text or picture
column against its neighbour. A column that leaves more than 35 % of the body empty is filled by layout:

1. the takeaways step up to lead size when they fit and keep 12 glyphs a line;
2. the room left is shared between the points, at most a sixth of the body per gap;
3. a chart's values (at most 8 rows and 4 columns) stand as a small table under the takeaways when they fit;
4. a title under which a column still stays over 40 % empty counts as unfit for the slide when another
   title fits.

The source strip that closes a column counts as a block and never hides the band above it. The gate reads
the same geometry (OF-115, threshold 40 %). The engine picks the title treatment by fill as well: among the
treatments the role and family allow, a slide whose body stays short under the role default moves to a side
rail or a bottom title where a chart or table takes the full height. The role default keeps its place
unless a rival leaves at least 0.10 less of the body empty (0.15 when neither reaches the density band). It
adds no decoration and no padding.

## 4. Writing source that fills

Each rule gives the engine something real to place in the lower part of the body.

- **Every content slide carries its supporting facts.** Beside the main point, give the basis (where the
  figure comes from), a comparison (previous period, plan, peer), the period, the source and the
  implication or next step. Tables run five to eight rows and four to six columns where the source has
  them, charts five to eight categories, comparisons three or four labelled criteria a side. Label
  example values as examples.
- **Close every data slide with its source.** A last line `출처: ...` (`Source: ...`) names where the
  figures come from and when; a `주: ...` (`Note: ...`) line may follow. The engine sets them as a strip at
  the foot of the body at source size, so they cost the takeaways no room.
- **Figures come in rows of three to six.** A `kpi-row` table holds up to six figures, and its second row
  gives each figure's basis or comparison ("계획 대비 +3.9%", "전년 동기 81억 원").
- **Label comparison points by criterion.** Start each point with the same short label on both sides
  ("비용: ...", "일정: ..."); the engine draws the labels once as a criteria column and the two sides as
  rows that reach the floor together.
- **Pair a chart with its numbers.** Write the chart table with the exact figures and units in the
  headers; on the compact step the values stand under the takeaways.
- **The title names the topic; the claim opens the body.** "분기별 매출 추이" as the title and "매출은
  다섯 분기 연속 늘었다" as the first takeaway. A claim with its reasons suits `summary-box-list`, a
  `kpi-row`, or a table whose first takeaway states it. A stand-alone `statement` is for a pull quote or a
  deck the user asked to be display-led.
- **A number carries its evidence.** A `big-number` slide is a panel of two to four related figures: labels
  in the head, values in row one, basis in row two, a caption with period and source, then two or three
  lines of evidence.
- **Every table gets a takeaway.** Two or three bullets name the row that matters, the comparison and the
  decision it supports. A table of three rows or fewer is often a `kpi-row` or a `comparison`.
- **Every chart gets a caption and two or three takeaways.** The caption says what is plotted and marks
  example data; the bullets say what to notice.
- **A closing carries the ask and the next step.** Title it with the request ("운영 자금 30억 원 요청
  내역"); list what is to be approved (item, amount, date, owner works as a small table) and the next step
  with owner and date.
- **A comparison has the same number of points on both sides,** each a full clause.
- **A process or timeline says what happens at each step.** A timeline fed by a table takes two or three
  takeaways under the axis; one alone can leave the band under the axis empty and fail OF-109.
- **References and appendices list every source with its date,** one per row; add the definitions the
  deck relies on when only two or three sources exist.
- **Merge before padding.** A slide with little to say joins its neighbour or takes a family that suits
  short content.

### A worked contrast

The thin version of a data slide fits one table and nothing else. Compiled alone under ledger it leaves
77 % of the body empty and fails `sparse_slide`, OF-109 and the OF-112 median:

```markdown
---
layout: table-insight

## 대출 현황

| 구분 | 건수 |
|---|---|
| 일반 | 24,000 |
| 어린이 | 17,000 |
---
```

The fuller version of the same slide carries a caption, takeaways and a source, so every region has a
job. It passes the gate with no HIGH finding:

```markdown
---
layout: table-insight

## 이용자 구분별 대출 현황, 2026년 3분기

| 구분 | 3분기 건수 | 전년 동기 | 증감 |
|---|---|---|---|
| 일반 | 24,000 | 21,800 | ▲ +10% |
| 어린이 | 17,000 | 14,900 | ▲ +14% |
| 청소년 | 4,200 | 4,100 | ▲ +2% |
| 합계 | 45,200 | 40,800 | ▲ +11% |

> 표 1. 이용자 구분별 대출 권수, 천 권 (예시 데이터)

- 어린이 대출이 가장 빠르게 늘었다 (+14%)
- 청소년 대출은 전년과 거의 같아 방학 프로그램이 필요하다
- 합계 증가분의 절반 이상이 어린이 대출에서 나왔다
- 출처: 예시 도서관 통합 관리 시스템, 2026년 3분기
---
```

## 5. How the gate measures it

`qa_deck.py` measures the empty band from the compiled file: the share of the body (from the title's
bottom, or the top margin when the title sits low, down to the body floor at 486 pt) that lies below the
lowest content block. Decoration, the footer and the example notice are not content. Cover, section,
statement, quote and statement-closing slides are exempt.

| Check | What it fails |
|---|---|
| OF-112 | a slide over its gate cap is an advisory with a fix hint; the median over all measured slides above 0.20 fails the deck (an advisory on a legacy template) |
| OF-109 | any slide or card with one empty band over 35 % of its area (25 % to 35 % advisory); a row of equal cards counts its smallest trailing band |
| OF-115 | a bottom title ending 12 pt or more above the floor; a side rail or a takeaway column over 40 % empty; a title panel or plate that leaves its page empty |
| OF-111 | content slides sharing one composition on more than 40 %, or showing too few distinct ones |
| `sparse_slide` | content covering under 45 % of the area below the title |

Beside the figure rows of a `kpi-row` or `big-number` slide the takeaway column is measured to the body
floor, since the rows stop where their spacing ends; the engine sets the takeaways across under the rows
or lets them share the room beside the rows.

A slide that cannot be filled honestly (a one-line agenda, a short appendix) may stay over its cap while the
deck median holds. Shrinking text, inflating cards or adding decorative shapes to pass the gate is a
defect, and a critique counts it as one.
