# Layout families

A layout family is a slide's job turned into a fixed shape on the 12-column grid. The source names
it on the `layout:` line, and the tonality decides how it is drawn: which title treatments it may
take, the table and chart style, the rules and fields around it. Twenty-eight families exist; each
pack implements the ones that suit its character, and the compile stops or notes a substitution when
a source asks a pack for a family it does not have.

Pick the family from what the slide has to do, never from what the previous slide used. A deck
reads as varied when its slides do different jobs and each job gets its own shape; the gate checks
that from the compiled file (OF-111) and fails a deck whose content slides share one composition.

List what a pack offers before writing:

```bash
node "$SKILL_ROOT/scripts/compile-deck.js" --list-tonalities
node "$SKILL_ROOT/scripts/compile-deck.js" --list-layouts ledger    # families, the titles each allows, variants
```

## Content families

Each row says what the family is for, what the source gives it, and which packs carry it.

| Family | Job | Source it reads | Packs |
|---|---|---|---|
| `text-column` | running text or a short list that keeps its measure | bullets or 개조식 groups; an image moves it to a picture-and-text split | atlas, chalk, paper, gazette |
| `text-two-column` | a long list with two parallel halves | bullets, split at a group boundary near the middle, or `:::: columns` | ledger, gazette, studio |
| `summary-box-list` | a boxed one-line conclusion over two columns of evidence | `::: key-message` (or the first line) for the box, groups under it | gazette |
| `sidebar-note` | a main point with a fenced note: the definition or the common mistake; a note too short for its column stands across the top at lead size with the main points in two columns under it, and under a side title it stands in the rail | body, then a `::: main-box` (or a last list) that becomes the note | chalk |
| `agenda` | the parts of the deck, numbered | `- **Part** what it covers` lines | ledger, chalk, gazette |
| `statement` | a pull quote, or a display-led deck the user asked for | the `##` text is set as the sentence (a label in the default rules; OF-114 fails a declarative title); one body line becomes the support line | signal, chalk, paper, night, atlas, studio |
| `quote` | a quoted sentence with its source | the quote as a text line, the source as a line starting with `—` | signal, chalk, paper |
| `kpi-row` | two to six headline numbers | a one-row table of short values, a second row with each figure's basis, plus bullets for evidence | ledger, signal, atlas, studio, night |
| `kpi-over-chart` | headline numbers above the trend that explains them | a one-row KPI table, then a `::: chart` block | ledger, night |
| `dashboard-grid` | two to four small charts read together | two or more `::: chart` blocks, plus one line of takeaway | ledger, night |
| `table-insight` | a table with its takeaway beside it | a pipe table with a `>` caption, then bullets | ledger, signal, chalk, paper, gazette |
| `ledger-table` | a full-width table that is the evidence | a wider table with a caption, then takeaway bullets under it | ledger, gazette |
| `matrix-2x2` | options placed on two axes | a 3 × 3 table: corner cell `영향 \ 난이도`, two column heads, two row heads; cells `item · detail · detail`; takeaways after the caption | ledger, gazette |
| `comparison` | two sides read across, point by point | `:::: columns` with a `**head**` and `(1)` `(2)` items per side; `비용: …` labels on both sides become a criteria column, in the rail under a side title; a label of more than three words is not read as a label, so the slide keeps its points whole and nothing goes to the rail | all eight |
| `chart-insight` | a chart with two or three takeaways | a `::: chart` block (or a data table), then bullets | ledger, signal, paper, studio, night |
| `full-chart` | one chart that needs the whole width | a `::: chart` block, an optional note under it | ledger, signal, paper, night |
| `big-number` | one real figure that carries the slide | a one-cell table (label in the head, value in the row), then 2-3 evidence bullets | ledger, signal, studio, night |
| `process` | three to five steps in order | `- **1. 단계** what happens` lines | signal, chalk |
| `step-diagram` | steps taught one by one | as `process` | chalk |
| `timeline` | dated events on one axis | a table of `시점 | 할 일 | 담당` rows (or `- **date** event`), then takeaway bullets | ledger, atlas, gazette, studio, night |
| `method` | a figure or formula with its definitions | an image or a text line, then `- **term** meaning` bullets | chalk, paper, night |
| `image-full` | one picture as the slide, title on a panel | an image with a caption (`도 1. … \| 출처: …`) | atlas, studio |
| `image-split` | a picture beside its explanation | an image, then bullets | signal, atlas, chalk, studio |
| `photo-grid` | two or three pictures compared | two or three images on consecutive lines, then one line of text | atlas, studio |
| `figure-pair` | before and after, or two conditions | two images, then one line of text | atlas, paper |
| `figure-academic` | a numbered figure with its reading | an image with a numbered caption and source, then observation, basis, implication bullets | paper |
| `asymmetric-feature` | a feature told by one large element and a narrow text column | an image or a one-cell figure, then bullets | signal, atlas, studio |
| `references-appendix` | sources and definitions, one per row | `- [1] …` lines; links as real Markdown links | ledger, paper, gazette |

Legacy layout names still work under a tonality: `content` and `main` become `text-column`,
`summary` becomes `comparison`, and `cover`, `section` and `closing` ask for one of the pack's own
variants (the compile notes which one it drew).

## Covers, sections and closings

These are variants. The source names one (`layout: cover-figures`); the engine draws it when the
pack lists it and the deck holds what it needs, or takes the pack's first variant that can be
drawn and notes why. A generic `cover`, `section` or `closing` asks for the pack's first choice.

| Variant | What it shows | Needs | Packs |
|---|---|---|---|
| `cover-typographic` | the title large, carried by the pack's cover device (see Display slides) | nothing | ledger, signal, atlas, chalk, paper, gazette, night |
| `cover-figures` | the title over the deck's headline numbers | a KPI row somewhere in the deck | ledger, night |
| `cover-index` | the title beside the list of parts | an agenda or two or more sections | ledger, paper, gazette |
| `cover-numeral` | a real year or figure at title size above the title | a year in the title or date | signal, chalk, studio, night |
| `cover-split-field` | half the page in the accent field | nothing | signal |
| `cover-split-image` | the title beside the deck's first picture | an image somewhere in the deck | atlas, paper, studio |
| `cover-full-image` | the first picture full-bleed with the title on a panel | an image | atlas |
| `cover-band` | the title under a strong head band | nothing | gazette |
| `cover-rail` | the title in a tinted left rail | nothing | chalk, studio |
| `section-field` | the part title on a colour field | nothing | signal, atlas, paper, night |
| `section-numeral` | the part number at title size beside its title, with the part count when the agenda gives it; with the agenda, the `section-rule` index page (numeral, title, the agenda with this part marked) | nothing | ledger, signal, chalk, studio, night |
| `section-rule` | with an agenda, an index page: the part numeral at title size over the part title, the agenda down the right columns with this part marked; without one, the title at the cover step over a hairline and the section's first slide titles | nothing | ledger, paper, gazette |
| `section-rail` | the part title in the rail | nothing | chalk, studio |
| `section-band` | the band holds the part index; under it the part title as a statement over the titles of the slides the part opens | nothing | gazette |
| `section-image` | the part title on the section's own picture | an image on that slide | atlas |
| `closing-ask` | the ask as the title, its table as action rows keyed by amount or date, the next step on the floor | a table or bullets | ledger, signal, atlas, chalk, paper, gazette |
| `closing-decision-box` | the decision in a box, the items to approve under it | a line or bullets, an optional table | ledger, gazette, night |
| `closing-statement` | one closing sentence | no table or image | signal, night |
| `closing-summary-list` | the takeaways numbered down the page | bullets (or a visual with a short list) | chalk, paper, studio |
| `closing-contact-split` | action rows beside a field that holds each row's amount or date (with its share bar), inset from its edges; the next step or contact runs as a band of the field's colour on the body floor across the left columns, meeting the field so the two read as one L; without a table, the ask beside a field with the contact | a table or bullets, plus a short text | atlas, studio |

A closing is a content slide whose title is the ask. "감사합니다" alone is never a closing; write
what the audience should decide or do, and who does what next by when.

## Display slides

Covers, statements, sections, big numbers and closings carry little text, so each pack names the
device that makes the slide hold its page (`display:` in the pack). The device encodes something
in the deck or frames what is there; it never adds words or numbers the source does not hold.

| Key | Device | What it draws | Packs |
|---|---|---|---|
| `cover` | `drench` | the field over the whole page, the title at the cover step in up to three balanced lines, anchored low | signal, computational-brutalism, riso |
| `cover` | `plate` | a field plate over a little under half the page, the title on it in at most two lines; the date line above | atlas, neo-brutalism |
| `cover` | `rail`, `band` | the pack's `cover-rail` or `cover-band` | chalk, gazette, newsroom |
| `cover` | `figures` | `cover-figures` when the deck has a KPI row, else the plain cover | ledger |
| `cover` | `numeral` | `cover-numeral` with the year from the title or date | night |
| `cover` | `rules` | a journal title page: a heavy rule, the title, a hairline, the presenter, then place and date | paper |
| `cover` | `geometry` | the title on the left half and an elementary composition on the right half, each shape in its own grid cell: a square in the accent tint, a circle in the accent, a bar in ink, a triangle in the field | bauhaus |
| `statement` | `open` | the sentence alone, at the display step | signal, night |
| `statement` | `drench` | the whole slide in the field, the sentence in the field's text colour | chalk, atlas, computational-brutalism, neo-brutalism, riso |
| `statement` | `plate` | the sentence set low on a field plate that covers less than half the page; a sentence too tall for it keeps the open page | no pack (Atlas takes `drench`) |
| `statement` | `rules` | a hairline above the sentence and one under its support line | paper, studio, newsroom |
| `statement` | `geometry` | the sentence on the left and a narrower composition from column 10 to the edge; a quote and a closing statement take it too | bauhaus |
| `statement` | `offset` | the sentence in columns 5-12 beside a rail that stops a column short of it | no pack (the empty rail read as decoration; Studio takes `rules`) |
| `number` | `field`, `tint`, `outline` | the panel behind a big number: the field, the accent tint, or the surface in an ink outline | signal, neo-brutalism, bauhaus, riso / ledger, studio, atlas, chalk, night, newsroom / gazette, paper, computational-brutalism |
| `closing` | `band`, `box`, `rules` | the next step on the body floor: a field band across the grid, a tinted (or outlined) box, or a rule above it | signal, studio, atlas, night, riso / ledger, gazette, chalk, computational-brutalism, neo-brutalism / paper, bauhaus, newsroom |
| `index` | `true` | section slides show the deck's parts, this part marked: one per line on a `section-rule` index page, in one line inside the `section-band` band | ledger, gazette, paper, newsroom |

What the engine reads from the deck, never from the device:

- Every title that wraps (content, closing, statement, cover, section) is broken into lines of
  near-equal width; the last line keeps two words whenever a split allows it (with a line more
  when the frame holds it), and a number stays with the word after it ("30억 원을", "4 분기").
- Body text and table cells that wrap are broken at spaces by the engine, filling each line in
  turn, so a number keeps its unit and a word stays whole: a renderer's own line breaking may split
  "51점" or "(10월" after the digits, and a short parenthetical ("(▲ +3.9%)", up to 16 characters)
  stays whole on its line. A one-word last line takes a word from the line above when
  it fits; text that would need more lines than its frame holds is left to the renderer.
- A section numbers itself by its place in the agenda when its title is an agenda entry or that
  entry's description ("03 / 04"); otherwise, in a deck of several sections, it counts them. A
  deck with one section and no agenda has no part count, so no numeral is drawn: the section
  title is set at the cover step as a statement, with the titles of the slides it opens under it.
  When those slides carry body lines, each title stands over at most two of its lines in a column
  that starts at the margin and stays within 70 % of the page and about 70 characters (8 columns
  for a Korean deck, 6 for an English one); a line that opens with a bold label keeps it bold with
  its colon ("**결과:** 공부 시간이 …").
- A closing's table becomes action rows. The key is the column of amounts in one unit (each row
  then draws a bar for its share of the ask), else the column headed as a date or deadline, else
  the last column. Rows that do not fit step their text and then their key down the ramp; only
  rows that still do not fit above the next step keep the table.
- `cover-band` runs the deck's parts (else its headline figures) across the page under the band.
- A big number is a data panel: two to four figures from a KPI table (labels, values, a second row
  with each figure's basis), one row per figure at title size at most, the evidence beside the panel.
  One figure alone sits on a panel as tall as it is. No figure takes the display, cover or hero step.
- A big number's panel takes seven of twelve columns (five of eight beside a rail), never more
  than half the page; the evidence stands beside it as plain notes, centred on the panel.
- A dark plate, rail or panel that is not the whole page covers less than half of it, so the page
  keeps its own ground colour and the device reads as something placed on it.
- `closing-decision-box` with a table keeps its decision box on top and runs the items to decide
  as the same action rows under it, down to the floor.

## How a deck keeps its variety

The compile picks each slide's title by how well the body fills, then checks the deck as the
composition check reads it (title zone × column partition over the content slides, closings
left out). When fewer distinct layouts appear than the check asks for, a data slide whose layout
another slide already has moves to a title that gives a new one, provided it neither overflows nor
leaves more than the density band empty; the log says `variety: slide N drawn under <title> so the
deck carries K layouts`. List markers are small dots drawn beside the line, so a list reads as one
column of text and not as a column of markers next to it.

Short content spreads rather than stopping at the top: a process of up to four steps runs as rows
down the body, two to five points that each open with a bold head become rows with the head beside
the point, groups of sub-points under bold heads run in two columns on the reading ramp, a
two-row comparison sets its points a step or two larger, and a table's takeaways stand midway in
the room under the table. The compact step (density 10) never enlarges type to fill: there a short
card row becomes figure rows beside the takeaways, a process row reads across (numeral, name, what
happens), a method slide sets the formula across the top over its terms in two columns, a chart
shows its values as a small table under the takeaways, and every data slide closes with the source
strip, set at the foot of the takeaway column when that column ends above the visual beside it (else
across the body's foot). Takeaways that still leave more than 40 % of their column, or of a side
title's rail, empty beside a longer visual are set one step up (lead): the one place the compact
step scales type, and only within the ramp. A process row does the same when what happens would
stop short of the body's last quarter, so the rows reach across. Terms too long for the column beside
a method figure first try half and half, which keeps the figure large enough to read. A closing
summary list ends with its source as the strip, not as a numbered row.

## Families under a title

A family keeps its body in the same place under every treatment:

- No treatment moves the title or the body: every one draws in the slide grid's title zone, and
  the body runs from y 120 to the floor whichever treatment sits over it. What changes is the
  look over the title (a margin bar, a field band, a heavy rule, a numeral), so a deck's variety
  comes from the families and the treatments' surfaces, not from content moving around the page.
- `bottom-anchor` belongs to a page led by its visual; a table never takes it while another
  title fits.
- A `quote` under `statement` sets the quotation itself as the slide's sentence, with the source as
  the support line; the heading of the source slide is not shown.

## When the compile log names a change

`note:` lines explain every substitution: a family the pack lacks, a variant that cannot be drawn,
a treatment moved for fill or for its glyph budget. Read them after every compile. A note is never
an error to suppress; it means the source asked for something this direction does not do, and the
fix is a different family for that slide, a shorter title, or a different tonality chosen through
`direction-step.md`.
