# Title treatments

A title treatment fixes where a slide's title stands, how large it is set, which colour it takes and
what is drawn with it: a rule, a band, a rail, a numeral or a panel. The engine knows eight. Each has
one frame, so every slide under a treatment carries its title at the same coordinates. A deck earns
its variety by giving different slide jobs different frames; a reader learns three to five positions
as fast as one, provided each position always announces the same kind of page.

## The title is a label

Write the title as a noun phrase that names the subject, the measure and, where it matters, the
period: "분기별 방문·대출 추이", "Loans per visit by branch, 2026". The claim goes into the first
takeaway of the body. A numeral beside a title is a real part number, step or figure, set at title
size at most. The gate (OF-114) reads the last word of a Korean title and the verbs of an English
one, and flags a sentence:

| Looks like a sentence (flagged) | Reads as a label (passes) |
|---|---|
| 서가 이용이 지난해보다 늘었다 | 서가 이용 추이, 2025-2026 |
| 신규 회원 가입이 증가함 | 월별 신규 회원 가입 |
| Revenue grew 18% in Q3. | Revenue by division, Q3 2026 |
| Conversion rises with feed rate | Conversion at 60 min by feed rate |

A question ("왜 대출이 줄었나?") and a quotation set as a statement pass. A trailing parenthesis such
as "(예시 데이터)" is set aside before the reading.

## How a slide gets its treatment

Resolution happens in two passes, and both write to the compile log.

1. **Resolve (per slide).** The family names a role (`content`, `data`, `data-takeaway`, `sequence`,
   `image`, `statement`, `reference`, `definition`). The pack's `structure` entry for that family wins
   when it exists (Paper draws a comparison under `top-rule`, Chalk under `side-rail`); otherwise the
   pack's `role-defaults` entry stands. The remaining treatments of the pack follow as fall-backs, each
   filtered by what the family allows and by what the slide can show: `kicker-numeral` needs a part
   number, `overlay` needs a full-bleed image, `statement` carries one sentence and at most one
   support line, and `bottom-anchor` closes a page whose upper part is a visual.
2. **Render (whole deck).** For every candidate the engine lays the body out and measures the empty
   band under it. The role default stays when its band is within the density cap, the previous slide
   used another treatment, and no treatment already covers more than about a third of the content
   slides (at least three slides). Otherwise the candidate with the lowest cost wins; the cost grows
   with the empty band, with repeating the previous title and with a treatment the deck already
   leans on. The role default also survives a close contest: it keeps its place unless a rival
   leaves at least 0.10 less of the body empty (0.15 when neither reaches the density band), and a
   family drawn with its `structure` title keeps it past the third-of-the-deck share.

After the choices, `spreadTreatments` adjusts the deck as a whole and logs every move it makes:

- A deck of eight or more slides gets at least three distinct treatments (one at variance 3 or
  below): `variety: slide 5 drawn under side-rail so the deck carries 3 title treatments`.
- No title zone (top, side, band, bottom) covers more than 40 % of the content slides, and no single
  composition covers more than 40 % of them: `variety: slide 7 drawn under bottom-anchor so the deck
  carries 5 layouts`. These two moves take data slides (roles `data` and `data-takeaway`) only, so
  agendas, sequences and definitions keep their titles.

The variance dial caps how many distinct treatments one deck mixes: variance 1-3 allows 2, 4 allows 3,
5-6 allow 4, 7 and above allow 5, and never more than the pack lists. Gazette (variance 4) therefore
tops out at three, Signal, Chalk, Ledger and Night at four, Atlas and Studio at five.

## Pinning a title

Write `title: <treatment>` on the line after `layout:`. The key sits in a closed set (`title` and
`variant`), so a body line such as "source: internal data" stays body text.

```markdown
---
layout: chart-insight
title: bottom-anchor

## 시간대별 처리량, 2026년 9월

::: chart type=column unit="건"
| 시간대 | 처리량 |
|---|---|
| 09시 | 120 |
| 12시 | 180 |
| 15시 | 90 |
:::

- 처리량은 오후 3시에 가장 낮다
---
```

A pin that names an unknown treatment, one the pack lacks, one the family refuses, or one that cannot
be drawn on this slide stops the compile with a message that lists the allowed set. In Ledger,
`title: side-rail` on a `full-chart` slide ends with `Compilation error: Slide 2: the full-chart
family does not take "side-rail"; it allows bottom-anchor, top-plain-large, top-rule`. Run
`node "$SKILL_ROOT/scripts/compile-deck.js" --list-layouts <id>` to read, for every family of a pack,
the titles it takes there. Covers and sections take the title of their variant and reject a `title:` key.

## The eight frames

Geometry below is for the 16:9 canvas in points (960 x 540); the grid keeps 12 columns and the
canvas width is shared out as margin, column and gutter by the density dial. The body floor is y 486
and the footer zone starts at y 498.

| Treatment | Title frame | Drawn with it | Body zone | Typical job |
|---|---|---|---|---|
| `top-rule` | columns 1-12, y 36, title size | a hairline 6 pt under the frame, or a one-column accent bar 4 pt tall when the pack lists `accent-rule` | from y 120 to the floor (18 pt under the rule on the compact step) | read pages: text, tables, references |
| `top-plain-large` | columns 1-10, y 36, display size | nothing | 24 pt under the title (18 on the compact step) | pages that open on one idea, large comparisons |
| `side-rail` | columns 1-4, y 36, title size | a filled rail (`rail-fill`) or a hairline at the column-4 edge | columns 5-12, from y 36; the rail under the title holds labels, takeaways and the source strip | a chart or picture with its reading |
| `band` | columns 1-11, y 36, title in the on-field colour | a full-width band 108 pt tall in the field colour | from y 132 (120 compact) | briefing pages, dark decks |
| `statement` | columns 1-10 (5-12 under an offset device), centred on y 303 | optional support line 24 pt under it | none | pull quotes, display-led decks |
| `overlay` | columns 1-7, y 348, title size | a field panel at 88 % opacity starting at y 324, a caption line at y 432 | the picture is the page | full-bleed images |
| `kicker-numeral` | columns 3-12, y 48, title size | the part number in the accent colour, columns 1-2 at the cover step | from y 132 (120 compact) | steps and numbered parts |
| `bottom-anchor` | columns 1-9, last line ends on y 486 | optional hairline 12 pt above the title | y 36 down to 24 pt above the title | chart-, figure- and number-led pages |

## Glyph budgets

The budget is how much title the frame holds before the engine moves the slide or stops a pin. The
figures come from the same measure the engine uses (a Hangul syllable counts about 0.94 em, a Latin
letter about 0.52 em, a bold face adds 4 %), for a title typed without a forced break.

| Treatment | Density 2 (presented ramp) | Density 6 (reading ramp) | Density 10 (compact ramp) |
|---|---|---|---|
| `top-rule` | 25 ko / 45 la, 1 line | 64 / 115, 2 lines | 67 / 122, 2 lines |
| `top-plain-large` | 30 / 55, 2 lines | 38 / 69, 2 lines | 40 / 73, 2 lines |
| `side-rail` | 31 / 57, 4 lines | 40 / 72, 4 lines | 42 / 77, 4 lines |
| `band` | 23 / 41, 1 line | 58 / 106, 2 lines | 61 / 111, 2 lines |
| `statement` | 45 / 82, 3 lines | 57 / 104, 3 lines | 60 / 109, 3 lines |
| `overlay` | 28 / 52, 2 lines | 36 / 66, 2 lines | 38 / 70, 2 lines |
| `kicker-numeral` | 20 / 37, 1 line | 26 / 48, 1 line | 28 / 50, 1 line |
| `bottom-anchor` | 37 / 68, 2 lines | 47 / 86, 2 lines | 50 / 90, 2 lines |

The reading and compact ramps set the title at 26 pt, which lets `top-rule` and `band` take two lines
(2 x 26 x 1.15 stays inside the 60 pt frame). Every pack starts at density 10, so the right-hand
column is what a default deck sees. A short title leaves room; a title over budget triggers
`note: slide N: the title is longer than the <treatment> budget; shorten it` and the slide takes
the first treatment its family allows.

## Choosing well

- A chart, a picture or a figure with a takeaway reads best under `side-rail` or `bottom-anchor`:
  the title explains the visual from beside or below, and the visual takes the full height.
- A table is a read page. It takes `top-rule` or `band`; a bottom title is refused while another
  title fits the table.
- A sequence takes `kicker-numeral` when the number is a real part, step or recommendation. An
  agenda carries no numeral beside its title (OF-119) because its rows are numbered already.
- A claim opens the body under a label: a boxed summary, a data panel, or the first takeaway.
  `statement` serves pull quotes and decks the user asked to be display-led.
- A Korean briefing uses `band`, so a desk reader finds the same head on every page.
- A picture page uses `overlay` for a full-bleed image and `bottom-anchor` when a large picture sits
  above its title.

Keep every title inside its frame. A title nudged by a free `::: box` is a ninth, broken treatment,
and OF-110 reports it as unclassified.

## How the gate reads it

`qa_deck.py` classifies each title from the compiled file by geometry and companions, testing in this
order: overlay, band, statement, bottom-anchor, side-rail, kicker-numeral, top-plain-large, top-rule.
The engine also writes the intended treatment into the title shape's name (`title@<treatment>`) and
the gate compares the two.

- **OF-110** fails a deck of eight or more slides that uses fewer than three treatments (cover and
  section titles excluded) or more than the variance dial allows; on a deck of any length it fails a
  title that matches none of the eight, or one drawn as a treatment other than its name.
- **OF-113** fails two slides under one treatment whose title frames differ by more than 1 pt (a
  statement compares x and width only; a bottom title compares x, width and its bottom edge).
- **OF-115** fails a bottom title that ends more than 12 pt above the floor and a side rail more than
  40 % empty under its title; text inside the rail belongs to the rail.
- **OF-114** is the label rule above; **OF-119** fails a count numeral beside an agenda title.

On a legacy template the variety checks report at MEDIUM, because naming that template asked for its
single look.
