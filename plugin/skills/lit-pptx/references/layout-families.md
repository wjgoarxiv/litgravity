# Layout families

A layout family is a slide's job turned into a fixed shape on the 12-column grid. The source names it
on the `layout:` line; the tonality decides how that shape is drawn: which title treatments it takes,
the table and chart style, the rules and fields around it. The engine holds 28 content families, 9
cover variants, 6 section variants and 5 closing variants. Each pack lists the subset that suits its
character, and a source that asks a pack for something outside the list gets a `note:` line in the
compile log and a drawing with the family's own geometry under the pack's role title.

Choose the family from the job of the slide. A deck reads as varied when its slides do different jobs
and each job takes its own shape; the gate measures this on the compiled file (OF-111) and fails a
deck whose content slides share one composition.

Excerpts in this file are shown between rules, as they sit in a deck source: each slide starts with
`layout:`, the optional `title:` key follows, then the `##` title and the content. Ask the engine what
a pack offers before writing:

```bash
node "$SKILL_ROOT/scripts/compile-deck.js" --list-tonalities
node "$SKILL_ROOT/scripts/compile-deck.js" --list-layouts ledger   # families with their titles, then covers, sections, closings
```

## Content families

"Titles" lists the treatments the family accepts in any pack; a pack narrows the list to its own
treatments. "Role" picks the pack's default title (`role-defaults`).

| Family | Role | Job | Source it reads | Packs | Titles |
|---|---|---|---|---|---|
| `text-column` | content | running text or a short list at reading measure | bullets or bold-headed groups; an image turns it into a picture-and-text split | atlas, chalk, paper, gazette | top-rule, band, kicker-numeral, side-rail, top-plain-large |
| `text-two-column` | content | a long list with two parallel halves | bullets, cut near the middle at a group boundary, or `:::: columns` | ledger, gazette, studio | top-rule, band, kicker-numeral, top-plain-large |
| `summary-box-list` | content | a boxed conclusion over two columns of evidence | `::: key-message`, else the first paragraph, then groups | gazette | band, top-rule, kicker-numeral |
| `sidebar-note` | content | a main point with a fenced note: the definition or the common mistake | body, then a `::: main-box` (else the last text block) that becomes the note | chalk | top-rule, kicker-numeral, band, side-rail |
| `agenda` | content | the parts of the deck, numbered 01, 02 ... | `- **Part** what it covers` lines | ledger, chalk, gazette | top-rule, kicker-numeral, band, top-plain-large, side-rail |
| `statement` | statement | one sentence at display size | the `##` text is the sentence; one body line becomes the support line | signal, atlas, chalk, paper, studio, night | statement |
| `quote` | statement | a quoted sentence with its source | the quote as a text line, the source as a line that opens with `—` | signal, chalk, paper | statement, top-rule |
| `kpi-row` | data | two to six headline numbers | a one-row table of short values, an optional second row with each figure's basis | ledger, signal, atlas, studio, night | top-rule, band, top-plain-large, side-rail, bottom-anchor |
| `kpi-over-chart` | data | headline numbers above the trend that explains them | a KPI table, then a `::: chart` block | ledger, night | top-rule, band, top-plain-large |
| `dashboard-grid` | data | two to four small charts read together | two or more `::: chart` blocks plus one takeaway line | ledger, night | top-rule, band, side-rail |
| `table-insight` | data | a table with its takeaways beside it | a pipe table with a `>` caption, then bullets | ledger, signal, chalk, paper, gazette | top-rule, band, side-rail, bottom-anchor |
| `ledger-table` | data | a full-width table that is the evidence | a wide table with its caption, then takeaway bullets under it | ledger, gazette | top-rule, band, kicker-numeral |
| `matrix-2x2` | data | options placed on two axes | a 3-column, 2-row table (see below) | ledger, gazette | top-rule, band, side-rail |
| `comparison` | data or content | two sides read across, point by point | `:::: columns` with one head and numbered points per side | all eight | top-rule, band, top-plain-large, side-rail, bottom-anchor |
| `chart-insight` | data-takeaway | a chart with two or three takeaways | a `::: chart` block (or a numeric table of three or more rows), then bullets | ledger, signal, paper, studio, night | top-rule, band, side-rail, bottom-anchor, top-plain-large |
| `full-chart` | data-takeaway | one chart that needs the whole width | a `::: chart` block and an optional note | ledger, signal, paper, night | bottom-anchor, top-plain-large, top-rule |
| `big-number` | data-takeaway | a panel of related figures with evidence beside it | a KPI table (labels in the head, values in row one, basis in row two), then bullets | ledger, signal, studio, night | top-rule, side-rail, bottom-anchor, top-plain-large |
| `process` | sequence | three to five steps in order | `- **1. Step** what happens` lines | signal, chalk | top-rule, band, top-plain-large, side-rail |
| `step-diagram` | sequence | steps taught one by one | as `process` | chalk | top-rule, top-plain-large, band |
| `timeline` | sequence | up to six dated events on one axis | a table of date, event, status rows, or `- **date** event` lines | ledger, atlas, gazette, studio, night | top-rule, band, top-plain-large, bottom-anchor |
| `method` | definition | a figure or formula with its definitions | an image or text lines, then `- **term** meaning` bullets | chalk, paper, night | top-rule, side-rail, band |
| `image-full` | image | one picture as the page | an image with a caption | atlas, studio | overlay |
| `image-split` | image | a picture beside its explanation | an image, then bullets | signal, atlas, chalk, studio | top-plain-large, side-rail, bottom-anchor, top-rule |
| `photo-grid` | image | two or three pictures compared | two or three image lines, then one line of text | atlas, studio | top-plain-large, bottom-anchor, top-rule |
| `figure-pair` | image | before and after, or two conditions | two images, then one line of text | atlas, paper | top-rule, bottom-anchor, side-rail |
| `figure-academic` | image | a numbered figure with its reading | an image with numbered caption and source, then bullets | paper | top-rule, bottom-anchor, side-rail |
| `asymmetric-feature` | image | one visual and a column of argument | an image or a one-row table, then bullets | signal, atlas, studio | top-plain-large, bottom-anchor, top-rule |
| `references-appendix` | reference | sources, one per row | `- [1] ...` lines; links as Markdown links | ledger, gazette, paper | top-rule, band |

Legacy layout names keep working under a tonality: `content` and `main` become `text-column`,
`summary` becomes `comparison`, `free` becomes `text-column`, and `cover`, `section` and `closing`
ask for the pack's first variant that the deck can draw. `cover-split` is read as `cover-split-field`.
A name the engine does not know stops the compile with the full list of families.

## Per-family syntax

**Table-led families.** A pipe table with a `>` line under it becomes a captioned table; the engine
numbers the caption in the deck's language ("표 1.", "Table 1.") and renumbers a typed number instead of
doubling it. Takeaway bullets follow. A line that opens with `출처:`, `자료:`, `주:`, `Source:` or
`Note:` leaves the takeaways and sets as a source strip at the foot of the body.

**`kpi-row` and `big-number`.** Two to six headers; one row of values; a second row of bases. A cell
of the first row holds at most 12 characters and a basis at most 24, otherwise the table stays a
table.

```markdown
---
layout: kpi-row

## 3분기 이용 지표

| 방문자 | 대출 권수 | 신규 회원 | 좌석 점유율 |
|---|---|---|---|
| 18.2만 명 | 41.0만 권 | 6,320명 | 78% |
| 전년 동기 +12% | 전년 동기 +9% | 목표 6,000명 | 목표 75% |

> 3분기 이용 지표 (예시 데이터)

- 방문자와 대출이 모두 늘었고 신규 회원은 목표를 넘었다
- 좌석 점유율은 개관 이후 처음 목표를 넘었다
- 출처: 예시 이용 통계 시스템, 2026년 9월 말
---
```

**`comparison`.** Two `::: col` blocks inside `:::: columns 1fr 1fr`. Each side opens with a bold head
(`- **계획**`) and carries numbered points. When every point on both sides opens with a short label
and a colon (`비용: ...`, at most three words), the labels leave the sides and stand once as a
criteria column; under a side title they sit in the rail level with their rows. Without `columns`,
the bullets split into two halves by entry. Halves heavy with digits (4 % of the text or more) take
the pack's `data` title, others the `content` title.

**`matrix-2x2`.** Header cell `영향 \ 난이도` names the vertical axis first and the horizontal axis
second; the other two header cells name the columns; the first cell of each body row names the row.
Each quadrant holds `item · detail · detail`: the item becomes the cell head and each detail a line.

```markdown
---
layout: matrix-2x2

## 개선 과제 우선순위

| 효과 \ 난이도 | 쉬움 | 어려움 |
|---|---|---|
| 큼 | 좌석 예약 안내 · 즉시 · 운영팀 | 서가 재배치 · 3개월 · 예산 필요 |
| 작음 | 안내문 교체 · 이번 주 | 시스템 교체 · 보류 |

> 효과와 난이도로 본 과제 (예시)

- 효과가 크고 쉬운 과제부터 이번 달에 시작한다
- 서가 재배치는 설계에 3개월이 걸려 다음 분기 예산에 넣는다
- 효과가 작고 어려운 시스템 교체는 보류하고 연말에 다시 본다
- 담당과 시점은 각 칸의 둘째, 셋째 줄에 적은 대로 확정한다
---
```

The takeaways stand in the four columns beside the matrix, so three or four lines keep that column as
long as the quadrants (a single line leaves it 86 % empty and fails OF-115). Any other table shape
falls back to `table-insight`.

**`process`, `step-diagram`, `agenda`, `timeline`.** Steps are bold-headed bullets; a leading `1.` in the
head becomes the numeral, otherwise the position does. Points without a bold head that follow two or
more steps become takeaways under the steps. A timeline reads a table whose first column is the date,
the second the event and the rest the status, or bullets whose bold head is the date and whose
children are the status. More than six events keep the first six.

**`quote` and `statement`.** The quote line and a `—` source line:

```markdown
---
layout: quote

## 이용자 한마디

“창가 자리가 생긴 뒤로 매일 저녁 이곳에서 공부한다”

— 예시 이용자, 고등학생
---
```

The sentence sits in the title slot, so a `statement` title should be a quotation (a leading “ is
read as a quote) or a noun phrase; a plain declarative sentence is flagged by OF-114.

**`image-*` and `figure-*`.** The alt text of `![...](path)` is the caption and may carry a source
after a bar: `![도 1. 창가 좌석 | 출처: 예시 이미지](assets/example-b.png)`. Consecutive image lines
fill a `photo-grid` (up to three) or a `figure-pair` (two). `image-full` needs a picture and takes
only `overlay`; a source without one stops the compile with "choose another layout family".

**`method`.** Plain text lines are the formula or the statement of the method (set at title size in
the accent-deep colour); bold-headed bullets are the terms, split into two or three columns when a
figure does not stand beside them.

**`sidebar-note`.** Main points as bullets and the note as a `::: main-box ... :::` block. A note
short for its column moves across the top at lead size with the points in two columns below; under a
side title it stands in the rail.

**`summary-box-list`.** A `::: key-message` block of one to three lines becomes the box; bold-headed
groups under it split into two columns at the boundary that evens them out.

**`references-appendix`.** One entry per row, at reading size; a list longer than the body steps to
label size and then to two columns. Markdown links keep their address.

## Covers, sections and closings

The source names a variant (`layout: cover-figures`). The engine draws it when the pack lists it and
the deck holds what it needs, else it takes the pack's first variant that can be drawn and logs
`note: slide 1: cover-figures cannot be drawn (the deck has no row of headline numbers)` and
`note: slide 1: drawn as cover-typographic`. A title on a cover or section comes from the `##` line;
the frontmatter keys `subtitle`, `date`, `department` and `presenter` fill the meta lines.

| Variant | What it shows | Needs | Packs |
|---|---|---|---|
| `cover-typographic` | the title large, carried by the pack's cover device (next section) | nothing | atlas, chalk, gazette, ledger, night, paper, signal |
| `cover-figures` | the title over the deck's first KPI row (up to four figures) | a non-chart KPI table with two or more values | ledger, night |
| `cover-index` | the title beside the numbered list of parts | an agenda, or two or more sections | ledger, paper, gazette |
| `cover-numeral` | a year at title size above the title | a four-digit year in the deck title or `date` | signal, chalk, studio, night |
| `cover-split-field` | the title beside a field over the right five columns | nothing | signal |
| `cover-split-image` | the title beside the deck's first picture | an image anywhere in the deck | atlas, paper, studio |
| `cover-full-image` | the first picture full-bleed with the title on a panel | an image | atlas |
| `cover-band` | the title in a 216 pt field band, the parts or figures across the page below | nothing | gazette |
| `cover-rail` | the title beside a field rail over columns 1-4 | nothing | chalk, studio |
| `section-field` | the part title on a full field | nothing | signal, atlas, paper, night |
| `section-numeral` | part numeral and title; with an agenda, the index page | nothing | ledger, signal, chalk, studio, night |
| `section-rule` | with an agenda, an index page; without one, the title at the cover step over a hairline | nothing | ledger, paper, gazette |
| `section-rail` | the part title beside the rail, the numeral or the contents in the rail | nothing | chalk, studio |
| `section-band` | a field band holding the part index, the part title as a statement below | nothing | gazette |
| `section-image` | the part title on the section's own picture | an image on that slide | atlas |
| `closing-ask` | the ask as the title, its table as action rows, the next step on the floor | a table or bullets | ledger, signal, atlas, chalk, paper, gazette |
| `closing-decision-box` | the decision in a box, the items to approve as action rows under it | a line or bullets, an optional table | ledger, gazette, night |
| `closing-statement` | one closing sentence | text only | signal, night |
| `closing-summary-list` | the takeaways numbered down the page | bullets, or a visual with a short list | chalk, paper, studio |
| `closing-contact-split` | action rows beside a field that holds each row's key | a table or bullets | atlas, studio |

A closing is a content slide whose title is the ask: "건의 사항: 결정 요청 사항과 기한" or "18개월 운영
자금 30억 원 사용 계획". "감사합니다" alone leaves the audience without a decision. Closings other than
`closing-statement` take the top treatments (`top-rule`, `band`, `top-plain-large`).

### Section numbering

A section numbers itself by its place in the agenda when its title equals an agenda entry or that
entry's description ("03 / 04"). In a deck with two or more sections and no agenda it counts the
sections. A deck with one section and no agenda has no part count: the title is set at the cover step
as a statement and the titles of the slides it opens stand under it. When those slides carry body
lines, each title stands over at most two of them, in a column from the margin that spans at most 70 %
of the page and about 70 characters (8 columns in a Korean deck, 6 in an English one on the compact
grid); a bold run-in label keeps its weight and gains its colon.

### Closing rows

A closing's table becomes action rows (at most five, a totals row dropped). The key is the column of
amounts in one unit ("14억 원", or a bare number under a header such as `금액 (억 원)`), else the column
whose header reads as a date or deadline (`기한`, `시점`, `일정`, `마감`, `date`, `due`), else the last
column. The first cell is the action in bold at lead size; the other cells form its detail line. Amount
keys also draw a bar for each row's share of the total, and `closing-contact-split` closes its field with
"합계 30억 원" (or, for dates, "안건 4건 · 10월 – 11월"). Rows that cannot fit above the next step keep the
plain table.

## Display slides

Covers, statements, sections, big numbers and closings carry little text, so each pack names the
device that lets the slide hold its page (`display:` in the pack). A device frames what the deck
holds; it adds no words or numbers.

| Key | Device | What it draws | Packs |
|---|---|---|---|
| `cover` | `drench` | the field over the page, the title at the cover step in up to three balanced lines, anchored low | signal |
| `cover` | `plate` | a field plate from y 288 to the foot, the title on it in at most two lines, the meta line above | atlas |
| `cover` | `rail`, `band`, `figures`, `numeral` | the pack's `cover-rail`, `cover-band`, `cover-figures` or `cover-numeral` when the deck has what it needs, else the plain cover | chalk, gazette, ledger, night |
| `cover` | `rules` | a journal title page: a heavy rule, the title, a hairline, the presenter, place and date | paper |
| `statement` | `open` | the sentence alone at the display step | signal, night |
| `statement` | `drench` | the whole page in the field, the sentence in the field's text colour | chalk, atlas |
| `statement` | `rules` | a hairline above the sentence and one under its support line | paper, studio |
| `number` | `field`, `tint`, `outline` | the panel behind a big number: the field, the accent tint, or the surface in an ink outline | signal / ledger, studio, atlas, chalk, night / gazette, paper |
| `closing` | `band`, `box`, `rules` | the next step on the body floor: a field band, a tinted (or outlined) box, or a hairline above the line | signal, studio, atlas, night / ledger, gazette, chalk / paper |
| `index` | `true` | section slides show the deck's parts with this part marked | ledger, gazette, paper |

The engine also supports the devices `plain`, a `plate` statement and an `offset` statement; no
shipped pack uses them. Things the engine settles from the deck, whatever the device:

- Every title that wraps is broken into lines of near-equal width; the last line keeps two words when
  a split allows it, and a number stays with the word after it ("30억 원을", "4 분기").
- Body text and table cells that wrap are broken at spaces, filling each line in turn, so a figure keeps
  its unit; a short parenthetical such as "(▲ +3.9%)" (up to 16 characters) stays on one line.
- A big number is a data panel: seven of twelve columns (five of eight beside a rail), one row per
  figure at title size at most with its label and basis, the evidence beside it as plain notes. A single
  figure sits on a panel as tall as it is. No figure reaches the display, cover or hero step.
- A dark plate, rail or panel that is not the whole page covers less than half of it, so the page
  keeps its ground colour and the device reads as something placed on it.
- `cover-band` runs the deck's parts (else its headline figures) under the band, up to four across.

## Fill behaviour

The compile lays each slide out, measures the empty band under the last block, and compares it with
the density cap (0.12 at density 9 and 10, 0.14 at 7-8, 0.18 at 5-6, 0.24 at 3-4, 0.28 at 1-2). A slide
over the cap tries the pack's `fill-order` in turn: `step-up` (one ramp step larger, available up to
density 8), `distribute` (the next spacing step), `anchor-visual` (the visual takes the room) and
`change-family` (a different title, chosen by the treatment pass). The log line reads
`fill: slide 6 band 0.59 -> 0.59 (none: nothing on the slide can grow; choose a fuller family)` when
nothing helped; the fix is content that reaches the floor or a family that fits it.

Short content spreads without invented text: a process of up to four steps runs as rows down the
body; two to five points that each open with a bold head become rows with the head beside the point;
sub-point groups under bold heads run in two columns; a table's takeaways stand midway in the room
under the table, and the table's rows open by up to one minimum row each. The compact step (density
10, the default) keeps type at body size, turns a short card row into figure rows beside the
takeaways, reads a process row across, sets a method formula over its terms in two columns, puts a
chart's values in a small table under the takeaways, and closes every data slide with the source
strip. Takeaways that leave more than 40 % of their column empty beside a longer visual step up to
lead size, the one place the compact step enlarges type.

## Families under different titles

- Under `side-rail`, the rail under the title carries the slide's supporting content: a comparison's
  criteria, the takeaways of a chart, picture, figure rows or number panel, and the source strip at
  its foot; the visual takes columns 5-12. A rail more than 40 % empty makes the title unfit unless
  `title: side-rail` pins it, and then OF-115 fails the slide.
- Under `bottom-anchor`, the visual takes the top and the title explains it from below with its last
  line on the floor; a big number stands on its panel there. A table receives a bottom title only when
  no other title fits.
- Under `band`, the body starts below the band and runs to the floor at reading size.
- A `quote` under `statement` sets the quotation as the slide's sentence and the source as its support
  line.

## When the compile log names a change

`note:` lines explain each substitution: a family the pack lacks, a variant that cannot be drawn, a
title moved for fill or for its glyph budget, a pack without a statement title (`ledger has no statement
title, so the sentence is drawn as a top-rule title`). `variety:` lines name moves made for the deck's
composition. Read both after every compile. A note means the source asked for something this direction
does not do; the fix is a different family for that slide, a shorter title, or another tonality.
