# Anti-slop checklist

A deck reads as machine-made when it carries the same reflexes a hundred other decks carry: a stripe
down the card edge, a row of identical tiles, a hero number with no source, a title that is a verdict.
This checklist turns those reflexes into checks. Part A says what the gate measures and with which
threshold, part B lists the laws judged by eye on the rendered pages, part C gives the copy rules.
Run the gate first, then read every rendered page, because a passing gate means no known defect and
says nothing about how the deck reads.

```sh
python3 "$SKILL_ROOT/scripts/qa_deck.py" out.pptx                      # exit 0 is required
python3 "$SKILL_ROOT/scripts/qa_deck.py" out.pptx --sibling other.pptx # OF-116, two tonalities of one source
python3 "$SKILL_ROOT/scripts/layout_inventory.py" out.pptx --issues-only
python3 "$SKILL_ROOT/scripts/render_pages.py" out.pptx --out-dir renders --pages 8
```

The report is JSON. `failure_reasons` lists what fails the gate; `craft_floor.advisories` lists the
MEDIUM findings, which are reported and do not fail; `anti_slop.review_warnings` lists soft terms.

## A. What the gate measures

### A1. Stages and what fails each

| Stage | Source | Fails when |
|---|---|---|
| package integrity | `ooxml_integrity.py` | the package does not open, a relationship is dangling, an attribute holds NaN |
| text hygiene | `validate_pptx.py` | a hard forbidden term, an unfilled default placeholder, a Calibri or Aptos run, a slide with no title; slop score above 10 |
| layout | `layout_inventory.py` | text spills out of its frame, runs past the canvas, or a box leaves the slide |
| contrast | `qa_deck.py` | an explicit-colour run is under 4.5:1 on its real fill, or under 3:1 when it is large (18 pt, or bold from 14 pt) |
| overlap | `qa_deck.py` | a picture or table is drawn over other content, or two text frames collide by more than 0.06 in on both axes |
| objective quality | `qa_deck.py` | a side stripe, a run under 6 pt, a covered figure or table, a figure without caption and source, an appendix link without a hyperlink |
| deck craft | `deck_craft.py` | `sparse_slide`, `table_only_deck`, `off_slide_shape`, `stray_box`, `placeholder_text`, `long_foreign_note` |
| craft floor | `craft_extras.py` | any HIGH finding among OF-101 to OF-119 |

### A2. Deck craft

| Id | Threshold | Fix |
|---|---|---|
| `sparse_slide` | content fills under 45 % of the area below the title | a chart, a figure row or a fuller table with its takeaway; or merge with a neighbour |
| `table_only_deck` | three or more content slides, at least two tables, tables on 60 % or more, no chart | draw a numeric series as `::: chart` |
| `off_slide_shape` | a shape runs 0.03 in past the canvas and is not a full-canvas ground | pull it inside |
| `stray_box` | an outlined rectangle of 1 sq in or more, no fill, nothing inside | delete it or put the message in a tinted callout |
| `placeholder_text` | `[제품명]`, `XXX`, `TBD`, `TODO`, `○○`, `{{...}}`, `____` | fill with a real value labelled as an example |
| `long_foreign_note` | on a Korean deck, a source line of 60 Latin letters or more | write sources short and in Korean (agency, document, year) |

A bracket that holds a digit (`[1]`, `[S3]`) is a citation marker, and a Markdown link is read for its
label only.

### A3. The craft floor, OF-101 to OF-119

HIGH findings fail the gate; MEDIUM findings are advisories.

| Id | Rule | Threshold | Fix |
|---|---|---|---|
| OF-101 | one accent hue family per slide | solid fills clustered in 20-degree hue families; content slide: 2 is MEDIUM, 3 is HIGH; display slide: 3 and 4 | move the extra fills to neutrals |
| OF-102 | body measure | wrapped lines over 90 characters (38 when half the letters are Hangul) are HIGH; under 10 characters across 3 lines or more is MEDIUM | narrow the box or split the text; widen a column |
| OF-103 | numeric table columns right-aligned | 70 % numeric cells over 2 rows or more; an explicit left or centre is HIGH, an inherited alignment MEDIUM | align the cells to the right |
| OF-104 | concentric radius | inner radius equals outer radius minus the frame's padding, within 0.02 in | set the inner radius from the outer one |
| OF-105 | gap between cards at least twice the gap inside a card | MEDIUM until its calibration promotes it | space the cards apart or tighten the contents |
| OF-106 | no gradient-filled text | any gradient run fill | solid colour; emphasise with weight or size |
| OF-107 | no glow | any glow effect | solid fill or a thin neutral shadow |
| OF-108 | no emoji bullet | an emoji `buChar` | the template's bullet |
| OF-109 | no tall empty band | a slide or a card with one empty band over 35 % is HIGH, 25 % to 35 % MEDIUM; cards in one row count the smallest trailing band | fill the band, shrink the region, merge slides |
| OF-110 | title variety, each treatment drawn as named | a deck of 8 slides or more needs 3 treatments and no more than the variance allows (variance 1-3: 2, 4: 3, 5-6: 4, 7 and up: 5); a title that matches none of the eight is HIGH | map slide jobs to treatments (`title-treatments.md`) |
| OF-111 | composition variety | on content slides no title zone x partition x dominant content above 40 %, and at least ceil(0.6 x content slides) distinct ones, capped at 5 | change the family on repeated slides |
| OF-112 | the body is used | per slide against the density cap (0.28, 0.24, 0.20, 0.16, 0.12 for density 1-2, 3-4, 5-6, 7-8, 9-10) as MEDIUM; the deck median over 0.20 is HIGH | `density-and-fill.md` |
| OF-113 | one frame per treatment | titles under one treatment differ by 1 pt or less (a bottom title by its bottom edge) | fix the source and leave the title where the treatment puts it |
| OF-114 | titles are labels | Korean last word with a sentence ending, English final period or finite verb | name the topic; the claim opens the body |
| OF-115 | no region left empty | a bottom title ends 12 pt or more above the floor; a side rail or a takeaway column over 40 % empty; a title panel or a plate with an empty page | close the column with takeaways, source or values |
| OF-116 | with `--sibling`, another tonality draws another skeleton | at least 2 of the content slides differ in title zone or partition (1 when the deck has fewer than 4) | give the alternative its own structure |
| OF-117 | no light figure on a dark ground | a picture over 50 % near-white on a ground of luminance 0.25 or less | a `.dark` copy beside the file, or a native chart |
| OF-118 | a bold run-in label keeps its separator | `**요약** text` with no colon, dash or closing mark | write `**요약:**`; the engine adds the colon in body bullets |
| OF-119 | an agenda title carries no numeral | `agenda` drawn under `kicker-numeral` | let the rows carry the numbers |

On a legacy template OF-110, OF-111 and the OF-112 median report at MEDIUM and OF-114 reports at MEDIUM:
naming that template asked for its single look. OF-109 still stops a hollow slide.

### A4. Objective evidence checks

| Check | Rule |
|---|---|
| text size floor | every explicit run is 6 pt or larger; the ramps keep body at 13-14 pt, labels and table cells at 11-12, sources at 9-10 (compact and reading steps) |
| side stripe | a narrow filled bar (0.15 in wide or less, 70 % of the card's height or more) on a card's vertical edge fails; a full-width structural rule does not |
| figure and table occlusion | no content shape drawn above a declared figure or any table by 0.08 sq in or more and 3 % of its area or more |
| evidence binding | a picture whose description reads `Figure`, `Evidence`, `Source capture`, `그림`, `도표`, `근거` needs a nearby caption with a number and a `Source:` or `출처:` |
| appendix links | on a slide that says Appendix or 부록, every DOI, canonical-link or raw URL field carries a real external hyperlink; write `[원문](https://...)` in the cell |
| default fonts | Calibri and Aptos runs raise the slop score by 15; the packs set Pretendard or A2Z |
| distinct fills | more than 8 distinct solid fills raise the slop score by 10 |

## B. Laws judged by eye

These hold in every tonality. Where a law depends on the direction (radius, display size, decoration),
the tonality pack sets the value and the law says where to look. The pack loader itself refuses a
pack whose text pairs fall under 4.5:1, whose series colours fall under 3:1 on the ground, whose
radius is not 0 or 6, or that mixes more than two font families.

### Surfaces and marks
- [ ] Mark an item with a hairline above it, a flat tint or a real numeral. A coloured stripe down one
  card edge is the reflex this checklist exists to remove (A4).
- [ ] One surface carries one edge: an outline or a soft shadow. An outlined box with nothing inside is
  clutter (`stray_box`).
- [ ] Corners follow the pack (`radius` 0 or 6) on every surface; a fully rounded shape is a small tag.
- [ ] A row of identical cards is a filler pattern. Vary the span, let one element lead, or set the
  points as a list or a comparison.
- [ ] Ordinals (`01 02 03`) and small labels above titles appear where the order is real.
- [ ] A large number is the slide's evidence, with label, unit, basis and source.
- [ ] Group with space and hairlines. A card inside a card, or a card around everything, adds a layer
  with no information.
- [ ] Grounds are flat. Gradients, blobs, glows, mesh and noise come from nowhere on a tonality deck.

### Colour
- [ ] Body text and captions reach 4.5:1 on the fill they sit on; large text and structural lines
  reach 3:1.
- [ ] Grey text sits on the ground or surface; on a coloured fill use that fill's `on-field` or
  `accent-deep` role.
- [ ] Deltas carry a sign and an arrow (`▲ +12%`, `▼ −8%`) beside their colour.
- [ ] The accent covers about a tenth of a content slide and means one thing across the deck. Every
  colour is a pack role.

### Type
- [ ] Pretendard Regular and Bold by default; A2Z when the user or source asks (`faces: a2z`), with at
  most three faces from two families.
- [ ] One ramp per deck (presented, reading or compact), at most four sizes on a slide, and no two sizes
  within a few points of each other.
- [ ] A figure is set at title size at most (no hero step) with its label, unit, basis and source.
- [ ] Titles are topic labels (OF-114). Headings run at line height 1.1 to 1.15 and body at 1.3 to 1.4.
- [ ] A title wraps on a 어절 boundary; the last line holds more than one word.

### Layout and hierarchy
- [ ] At a squint the slide shows one primary element and its groups, about twice the next level.
- [ ] Groups hold at most four items. Gaps come from one scale (6, 12, 18, 24, 36, 48, 72 pt), tighter
  inside a group than between groups, with one alignment edge per region.
- [ ] Every line, box and field carries information or structure.
- [ ] The title treatment matches the slide's job, and each treatment keeps one frame.
- [ ] The body reaches toward the floor on content slides.

## C. Copy

- [ ] Every slide has a specific title; a slide that offers only "개요" or "Overview" gets a subject.
- [ ] Headers name what they hold; "Value", "Metric" and "Score" alone are unspecific.
- [ ] External numbers and charts carry a source line (`출처:` or `Source:`) as the last block.
- [ ] A table header row is visually distinct, units sit in headers, totals are bold without extra
  decoration.
- [ ] A KPI row has one primary metric; the delta colour is the same across the deck.

**Hard terms** (fail through `scripts/forbidden-terms.json`): `click to add title|subtitle|text`,
`content goes here`, `your logo`, `placeholder`, `lorem ipsum`, `tbd`, `fixme`, `todo`, and the process
traces `본 슬라이드는`, `슬라이드 7은`, `최종본에서 걸러냈다`, `[자사 확인 필요]`, `[출처 확인 필요]`, `[작성 중]`.

**Soft terms** (reported as review warnings, rewritten where the sentence earns it): `revolutionary`,
`cutting-edge`, `seamless`, `innovative`, `world-class`, `best-in-class`, `transformative`,
`next-generation`, `game-changing`, `state-of-the-art`, `AI-powered`, `unlock`, `empower`, `synergy`,
`holistic`, `paradigm shift`, `frictionless`, and the Korean review items `없다는 것이 발견`,
`판이 굳었다`, `전제로 깐다`, `닫아야 할 게이트`, `역전 금지`, `논문이 없다`, plus unexplained
`RAM`, `FTO`, `CNKI`, `코퍼스`, `전이원`. Rewrite an absolute such as "논문이 없다" as the scope that
was checked ("검토한 데이터베이스 범위에서는 확인되지 않았다"), expand a specialist term on first use,
and give a date or a day count only from an approved source.
