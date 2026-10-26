# Title treatments

A title treatment decides how a slide's title looks: how large it is, what colour it takes and what
comes with it (a rule, a band, a rail, a numeral, a panel). The engine knows eight. None of them
moves the title. Every content title sits in the slide grid's one title zone (`scripts/lib/slide-grid.js`:
columns 1-10, y 36, 72 pt tall) and its body starts at y 120, whichever treatment and whichever
tonality draws it; a statement sits in the display title zone. The deck gets its variety from three
to five treatments for different slide jobs, and a reader never has to look for the title.

Two rules hold for all eight. The title is a topic label, never a sentence: a noun phrase that names
the subject, the measure and, where it matters, the period ("분기별 방문·대출 추이", "Loans per visit by
branch, 2026"), with the claim in the body as the first takeaway. It never gets an eyebrow or kicker
word above it. A numeral beside a title is a real part number, step or figure at title size at most,
never decoration. The gate fails a declarative title or cover subtitle (OF-114): a Korean title that
ends in -다, -니다, -요 or a nominalised claim (-음, -함, -됨), an English title with a finite verb or
a final period.

## How a slide gets its treatment

The pack maps each slide role to a default treatment (`role-defaults` in the pack, listed in every
tonality sheet). Roles come from the family: text families are `content`, tables and KPI rows are
`data`, charts and big numbers are `data-takeaway`, processes and timelines are `sequence`, picture
families are `image`, statements and quotes are `statement`, methods are `definition`, references
are `reference`. A pack may also name a family's own title under `structure` (Paper draws a comparison
under `top-rule`, Chalk on its board rail under `side-rail`): that title comes before the role default
and is kept even when the deck already leans on it, so two tonalities of one source differ in
structure, not only in colour. When the role default is a bottom title the slide may not take (a
table), the pack's next treatment in order stands in for it.

The engine then lays the slide out under every treatment the family and the pack both allow. It
keeps the role default when the body fills to the density band; otherwise it takes the treatment
that leaves the smallest empty band, with a cost for repeating the previous slide's treatment and a
cap so that no fill-chosen treatment covers more than about a third of the deck. The variance dial
caps how many distinct treatments one deck mixes. The compile log names every slide whose
treatment moved away from the role default.

To pin one slide, put a `title:` key on the line after `layout:`. It must name a treatment the pack
and the family both allow, or the compile stops with the allowed list:

```markdown
---
layout: chart-insight
title: bottom-anchor

## 피크 시간대 처리량은 오후 3시에 가장 낮다
…
---
```

Covers, sections and closings take their own variant's title and refuse a `title:` key.

## The eight

Geometry is in points on the 16:9 canvas (12 columns, 24 pt margins, 78 pt pitch); the 4:3 canvas keeps
the same y values. The density dial changes type and spacing inside the zones, never the zones. Glyph
budgets are for Korean at the presented ramp, with the reading ramp in brackets; Latin text takes about
twice as many characters.

| Treatment | Title | Comes with | Body | Fits | Budget |
|---|---|---|---|---|---|
| `top-rule` | the title zone, title size | a short accent rule or a full hairline 4 pt under the title's last line | y 120-486 | content and data pages that are read | two lines of about 23 glyphs (29) |
| `top-plain-large` | the title zone, display size | nothing | y 120-486 | comparison, image-split, pages that open on one claim | one line of about 17 glyphs (two of 21) |
| `side-rail` | the title zone, title size | a bar in the left margin: the page's full height in the rail colour when the pack fills its rail, else as tall as the title zone in the accent | y 120-486 | a chart or picture with its takeaways, a comparison with labelled criteria | as `top-rule` |
| `band` | the title zone, title size, in the on-field colour | the field colour from the page's top edge to the title zone's foot (y 108) | y 120-486 | Korean briefing pages, data pages, a newspaper masthead | as `top-rule` |
| `statement` | the display title zone (columns 1-9, y 132-348), display or hero size, centred | an optional support line in the support zone (y 372) | none: the text is the content | a pull quote, or a display-led deck the user asked for | three lines of about 15 glyphs |
| `overlay` | a dark panel at the lower left over a full-bleed picture | the panel at 88 % opacity, a caption on it | none: the picture is the content | full-picture slides | two lines of about 15 glyphs |
| `kicker-numeral` | the title zone, title size | the numeral at cover size in the aside zone right of the title (columns 11-12), in the accent colour; the part number, never an agenda's row count | y 120-486 | steps, numbered recommendations | as `top-rule` |
| `bottom-anchor` | the title zone, title size | a 3 pt ink rule across the columns at the zone's foot (y 110) | y 120-486 | chart-led, figure-led and big-picture slides | as `top-rule` |

Over budget, the engine moves the slide to another allowed treatment and says so in a `note:` line;
a `title:` key that asks for an over-budget treatment stops the compile, because a pinned choice
that cannot hold the title is an authoring error. Shorten the title or pick another treatment.

## Choosing well

- **Data with a takeaway** reads best under `bottom-anchor` or `side-rail`: the heavy rule or the
  margin bar marks a page led by its chart, and the chart gets the body's full height under the title.
- **A claim** is not a title. It opens the body under a label: a boxed summary over its reasons, a
  data panel of the figures behind it, or the first takeaway beside a table or chart. `statement`
  stays for pull quotes and decks the user asks to be display-led; a lone sentence on a page holds
  too little.
- **A sequence** wants `kicker-numeral` when the number is real: the step, the part, the
  recommendation. A numeral on a list that has no order is a defect.
- **Korean briefing pages** use `band`: the strong repeated head tells a desk reader where each page
  starts, and the body under it can be dense.
- **Pictures** use `overlay` only on a full-bleed image, and `bottom-anchor` when a large picture
  sits above its title.

Never move a title by hand with a free box: the zone is the slide grid's, and a nudged title breaks
the one place every theme keeps.

## How the gate reads it

`qa_deck.py` classifies every title from the compiled file by geometry and companions, in this order:
overlay, band, statement, bottom-anchor, side-rail, kicker-numeral, top-plain-large, top-rule. The
engine also writes the intended treatment into the title shape's name, and the gate compares the
two; the written name alone is never taken as evidence.

- **OF-110** fails on a deck of eight or more slides when fewer than three treatments are used
  (cover and section titles not counted) or more than the variance dial allows. On a deck of any
  length it fails when a title fits none of the eight, or when a title is drawn as a different
  treatment than its name says.
- **OF-113** fails a title frame more than 1 pt off the deck's shared frame, whatever its treatment:
  every content title is measured against one frame and every statement against the display frame. A
  title over a full-bleed picture keeps its own panel.
- **OF-116**, run with `--sibling <other.pptx>` on the same source compiled under another tonality,
  fails when the two decks place a slide's title frame or its body's top-left corner differently: a tonality changes the
  look and never the place.
- **OF-115** fails a column that stops short beside a longer one, a title panel taller than its text
  and a plate under an empty page.

On a legacy template the variety checks report as advisories, because the user asked for that
template's single title position.
