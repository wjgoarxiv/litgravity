# The direction step

A deck gets its look before its first slide is written. The look is a **tonality**: a pack of palette
roles, type ramp, title treatments, layout families and density that the engine reads as data. Eight
tonalities ship with the skill (`ledger`, `signal`, `atlas`, `chalk`, `paper`, `gazette`, `studio`,
`night`) and four legacy templates remain for users who name one. Without this step the compiler has
nothing to draw with, and every topic would drift back to one house style, which is the failure the pack
design exists to end.

The step is short. Read the brief and the source, close four facts, rank the candidate tonalities for the
deck type, reorder them by what the outline holds, write a direction card, say the choice with two
alternatives in the reply, and keep the card in the build log. The step interrupts the user only when
the brief leaves the look open on purpose (render a compare strip) or a dial has to move further than
the skill may move it alone.

## 1. Close the brief

Name four facts before ranking anything. When the brief is silent, infer each from the request and the
sources and write the inference on the card, where the user can overrule it.

| Fact | Question it answers | Where it lands |
|---|---|---|
| Deck type | one row of the table in section 2, or "other, nearest to ..." | candidate order |
| Reader | who opens it, where, for how long: a board at a desk, a hall watching a stage, a class reviewing the file later | density and tonality |
| Delivery | presented live, sent ahead and read alone, or both | read-alone decks lean to `gazette` or `ledger` |
| Language | Korean, English or mixed | glyph budgets of titles, the reading ramp |

When one open fact changes the direction (a stage room versus a file sent ahead moves `night` and
`gazette` apart), call `ask_question` with that single question, offer the inferred choice as the
recommended default, and continue with the default if no answer arrives. A headless run cannot be
answered; it appends a `decision` line to `.litgravity/ledger/<conversation-id>.jsonl` (the fields are
`ts`, `kind`, `text` and `path`) and proceeds. A bare `lit` request asks nothing and decides with the
same ranking. For a brief too thin to rank at all, run `deep-interview` first and return here with its
answers.

## 2. Start from the deck type

Each deck type holds an ordered list of candidates. The pair after each name is the pack's own
density and variance. The first candidate is the choice when no signal moves it.

| Deck type | Candidates in order (density, variance) |
|---|---|
| Pitch (투자·제안 피치) | `signal` (10, 6); `studio` (10, 8); `atlas` (10, 7) when the product is something to look at |
| Business review (경영 실적 보고) | `ledger` (10, 5); `gazette` (10, 4) when circulated in Korean and read alone; `night` (10, 6) for a stage review |
| Research talk (연구 발표) | `paper` (10, 5); `night` (10, 6) for a keynote room; `chalk` (10, 6) for a tutorial |
| Lecture or teaching (강의) | `chalk` (10, 6); `paper` (10, 5); `studio` (10, 8) for a public lecture |
| Data-heavy review (데이터 리뷰) | `night` (10, 6); `ledger` (10, 5); `paper` (10, 5) for a written analysis |
| Image-led (product, site, portfolio) | `atlas` (10, 7); `studio` (10, 8); `signal` (10, 6) for a launch |
| Korean text briefing (보고서형 덱) | `gazette` (10, 4); `ledger` (10, 5) |
| Status update (주간·월간 보고) | `ledger` (10, 5); `gazette` (10, 4); `night` (10, 6) |

## 3. Measure the source and reorder

Draft the outline first (one message per slide, and the visual each message needs), then count on that
outline. Apply the signals in the order listed; ties keep the deck-type order, so the same source always
gives the same choice.

| Order | Signal | Fires when | Effect |
|---|---|---|---|
| 1 | a tonality is named | the brief or an earlier turn says it | use it and still write the card |
| 2 | a legacy template is named | `AZURE-PRO`, `AZURE-A2Z`, `BOILERPLATE-PRETENDARD`, `BOILERPLATE-A2Z` or a learned one | use it as named; offer two tonalities as alternatives |
| 3 | read rather than presented | stated in the brief, or "보고서" | `gazette` (Korean) or `ledger` to the front |
| 4 | table share | tables on 30 % or more of the slides | `ledger` or `gazette` up one place |
| 5 | chart share | charts on 30 % or more | `ledger`, `night` or `paper` up one place |
| 6 | picture share | images on 30 % or more | `atlas` or `studio` up one place, `gazette` down |
| 7 | heavy text | 150 Korean glyphs or 300 Latin characters per content slide | `gazette` or `ledger` up, `signal` down |
| 8 | light text | 40 Korean glyphs or 80 Latin characters or fewer | `signal` or `studio` up; density stays 10 because the source strip and basis rows fill short slides |
| 9 | citations | numbered references, DOIs or a references slide | `paper` up one place |
| 10 | teaching structure | equations, definitions, or a how-it-works sequence of three steps or more | `chalk` or `paper` up |
| 11 | dark room | keynote, stage, demo day | `night` up one place |
| 12 | capability gap | a slide's job has no family in the pack | drop that pack |

### The capability gap

Row 12 weighs more than it looks. A pack that cannot draw one of the outline's slides is the wrong pack
however well the rest fits; the compiler would log `note: slide N: <family> is not a <pack> layout family`
and draw that slide with its own geometry, which reads as a seam. Check the outline against what each
pack carries (read from the `layout-families` list in each `pack.yaml`):

| Pack | Table | Chart | Figure row | Picture | Sequence | Definition | Reference list | Statement or quote | Agenda |
|---|---|---|---|---|---|---|---|---|---|
| `ledger` | yes | yes | yes | - | timeline | - | yes | - | yes |
| `signal` | yes | yes | yes | yes | process | - | - | yes | - |
| `atlas` | - | - | yes | yes | timeline | - | - | yes | - |
| `chalk` | yes | - | - | yes | process, steps | yes | - | yes | yes |
| `paper` | yes | yes | - | figure | - | yes | yes | yes | - |
| `gazette` | yes | - | - | - | timeline | - | yes | - | yes |
| `studio` | - | yes | yes | yes | timeline | - | - | yes | - |
| `night` | - | yes | yes | - | timeline | yes | - | yes | - |

Worked case: a ten-slide Korean quarterly review built from a spreadsheet. The type gives `ledger`,
`gazette`, `night`. Four of nine content slides hold a chart (44 %) and three a table (33 %), so rows 4
and 5 both fire and both favour `ledger`. Bodies average 90 glyphs, so rows 7 and 8 stay quiet, and
nothing says the file goes round beforehand. Row 12 then checks the outline against the matrix: it holds
charts and a ledger table, `gazette` has no chart family and `night` has no table family. `ledger`
carries both and is the choice. The other two stay on the card as alternatives with the change each
needs: `gazette` if the series become tables and the file circulates before the meeting, `night` if the
table moves into a comparison and the review runs on a stage screen.

## 4. Write the direction card

The card records the choice. Keep it in the build log, and summarise it in two or three sentences in the
reply: the chosen tonality, why, the two alternatives, and what would change the choice.

```text
Direction card
  Deck type        business review (경영 실적 보고)
  Reader           division heads reading on screen in the monthly meeting, about 15 minutes
  Delivery         presented, with the file circulated afterwards
  Language         Korean
  Tonality         ledger   alternatives: gazette, night
  Reason           numbers-first review: 44 % chart slides, 33 % table slides; read on screen
  Signals fired    chart share, table share
  Dials            density 10, variance 5 (pack defaults)
  Treatments       content top-rule, data top-rule, data-takeaway side-rail, sequence kicker-numeral
  Families planned cover-figures, agenda, kpi-over-chart, chart-insight, ledger-table, comparison,
                   section-rule, dashboard-grid, timeline, closing-decision-box, references-appendix
  Wrong if         the file is sent ahead and read alone; gazette's band pages and boxed summary fit that better
```

Fill every field. A build that cannot name the tonality and the reason stops and asks through
`ask_question` (or, headless, records its best default as a `decision` line); the engine ships no silent
default look. The "Wrong if" line is the one a reviewer checks first: if it turns out true, the
direction was mis-chosen and the deck is rebuilt under the alternative.

**Dials.** Density (1-10) sets margins, gaps, body size and how much empty band a slide may leave.
Variance (1-10) sets how many title treatments and compositions one deck mixes. Each pack has defaults.
Move either dial by up to 2 without asking and say so on the card; a larger move needs the user's word.
Variance below 4 is for a user who asked for a uniform deck, and the gate then records the lowered
variety. `density-and-fill.md` lists what each step changes.

**Treatments and families.** Copy the role map from the tonality sheet in `references/tonalities/` and
name one family per slide from the pack's list. The engine may draw a slide under another allowed
treatment when that slide fills better, and the compile log names each such choice.

## 5. Say it and record it

In the reply, say which direction was chosen and why, and name the two alternatives. For example:
"Ledger로 만들었습니다. 표와 차트가 슬라이드의 절반을 넘고 회의에서 화면으로 읽는 자료라서입니다.
미리 돌려 읽는 자료라면 Gazette, 큰 화면 발표라면 Night도 맞습니다."

Write the build log beside the deck source. It holds the card, then the compile output's `note:`,
`variety:` and `fill:` lines, then the gate result. It is working evidence: it stays out of the slides and
goes to the user only when they want the audit trail. When the deck belongs to a tracked goal, copy the
log into `.litgravity/evidence/<slug>/`.

```text
<deck>.md            the source, with tonality: in its frontmatter
<deck>.build.md      the direction card, compile notes, fill lines, gate result
<deck>.pptx          the compiled deck
```

## 6. The compare strip

When the user asks to compare looks, or the brief leaves the look open ("어떤 느낌이 좋을지 모르겠다",
"show me a few options"), build the same first three slides under the chosen tonality and the two
alternatives, render them, and show the three rows before writing the rest. Content and order are
identical in every row; only the tonality changes. Pick three slides that exercise different jobs (a
cover, a figure row or table, a comparison) and prefer families all three packs carry; a family a pack
lacks logs a `note:` and draws with its own geometry, which belongs on the strip as evidence of a poor
fit.

```sh
# strip.md holds the deck's frontmatter and its first three slides
for t in ledger gazette night; do
  sed "s/^tonality: .*/tonality: $t/" strip.md > "strip-$t.md"
  node    "$SKILL_ROOT/scripts/compile-deck.js" "strip-$t.md" --pptx "strip-$t.pptx"
  python3 "$SKILL_ROOT/scripts/render_pages.py" "strip-$t.pptx" --out-dir "strip-$t" --pages 3
done
```

Run the renders one at a time. Each loop pass writes `strip-<t>/page-01.png` to `page-03.png`. Show the
nine pages as three labelled rows and let the pages carry the difference; the message adds only the
card's reason. When `soffice` is missing, `render_pages.py` prints `SKIP` with the reason and the strip
cannot be shown, so say so. When the user picks, update the card (the reason becomes "chosen by the user
from the strip") and build the deck.

## 7. Legacy templates

`AZURE-PRO`, `AZURE-A2Z`, `BOILERPLATE-PRETENDARD` and `BOILERPLATE-A2Z` keep their names and their single
look. They apply when the user names one, when a learned template exists for the user's brand, or when an
existing source already says `template:`. The compile needs `--template <NAME>`. The card names the
template, the reply still offers two tonalities as alternatives, and the gate reports the variety checks
(OF-110, OF-111 and the OF-112 median) and OF-114 as advisories, because a named template is a request for
that one look. A `title:` pin needs a tonality.

## 8. Outline sequences by deck type

These sequences come from the twelve decks in `references/examples/`, each compiled and gated. Take the one
nearest the job as the first draft of the outline, then replace slides whose message differs. Each slide
carries one message and the family that draws it.

| Deck type and pack | Sequence of families |
|---|---|
| Pitch, `signal` | cover-typographic, asymmetric-feature (the problem), big-number (its size), image-split (the product), process (how it works), kpi-row (traction), chart-insight, comparison (alternatives), table-insight (use of funds), closing-ask |
| Pitch for a visual product, `studio` | cover-split-image, asymmetric-feature, big-number, image-split, section-numeral, kpi-row, chart-insight, timeline, closing-summary-list |
| Business review, `ledger` | cover-figures, agenda, kpi-over-chart, chart-insight, ledger-table, comparison, section-rule, matrix-2x2, timeline, closing-decision-box, references-appendix |
| Business review on a stage, `night` | cover-figures, kpi-row, kpi-over-chart, chart-insight, section-numeral, big-number, timeline, comparison, dashboard-grid, closing-decision-box |
| Research talk, `paper` | cover-index, statement (the question), section-field, figure-academic, method, chart-insight, table-insight, section-field, quote, comparison, closing-summary-list, references-appendix |
| Lecture, `chalk` | cover-rail, agenda, section-numeral, text-column, method, process, table-insight, image-split, comparison, comparison, closing-summary-list |
| Data-heavy review, `night` | cover-numeral, kpi-row, full-chart, chart-insight, dashboard-grid, method, section-field, comparison, big-number, closing-decision-box |
| Image-led report, `atlas` | cover-full-image, text-column, image-full, image-split, figure-pair, photo-grid, section-field, kpi-row, comparison, timeline, closing-ask |
| Korean text briefing, `gazette` | cover-band, agenda, summary-box-list, text-two-column, ledger-table, comparison, section-band, timeline, ledger-table, closing-decision-box, references-appendix |
| Status update, `ledger` | cover-figures, kpi-row, timeline, ledger-table, chart-insight, comparison, big-number, full-chart, closing-decision-box |
| Portfolio, `studio` | cover-rail, text-two-column, image-full, photo-grid, section-rail, kpi-row, comparison, image-split, timeline, closing-contact-split |
| Research tutorial, `chalk` | cover-numeral, agenda, comparison, section-numeral, process, method, table-insight, image-split, sidebar-note, closing-summary-list |

A sequence earns its variety from slides that do different jobs. Two `comparison` slides in a row, or
three tables in a deck without a chart, are the repeats OF-111 and `table_only_deck` catch later.

## 9. Failure patterns

- Choosing by topic alone ("a startup, so signal") without counting the outline.
- Naming one tonality in the reply with no alternatives, or none at all.
- A card whose reason restates the deck type where it should cite the signals that fired.
- Moving a dial by three or more without asking.
- A pack that forces a slide into a family it lacks; the `note:` line says so, and the fix is a different
  family for that slide or a different pack.
- Building every slide, disliking the look, and swapping the tonality at the end without updating the
  card and the reply.
- Rendering the strip from slides that favour one pack, so the comparison decides nothing.

## The example library

Each file in `references/examples/` compiles under its tonality and passes the gate. Read the one closest
to the job before writing a new deck.

| File | Deck type | Tonality | Alternatives |
|---|---|---|---|
| `01-pitch-signal-ko.md` | pitch | `signal` | `studio`, `atlas` |
| `02-pitch-studio-ko.md` | pitch for a visual product | `studio` | `signal`, `atlas` |
| `03-business-review-ledger-ko.md` | business review | `ledger` | `gazette`, `night` |
| `04-business-review-night-en.md` | business review on a stage screen | `night` | `ledger`, `gazette` |
| `05-research-talk-paper-en.md` | research talk | `paper` | `night`, `chalk` |
| `06-lecture-chalk-ko.md` | lecture | `chalk` | `paper`, `studio` |
| `07-data-review-night-en.md` | data-heavy review | `night` | `ledger`, `paper` |
| `08-image-led-atlas-ko.md` | image-led report | `atlas` | `studio`, `signal` |
| `09-briefing-gazette-ko.md` | Korean text briefing | `gazette` | `ledger` |
| `10-status-update-ledger-ko.md` | status update | `ledger` | `gazette`, `night` |
| `11-portfolio-studio-en.md` | image-led portfolio | `studio` | `atlas`, `signal` |
| `12-research-tutorial-chalk-en.md` | research tutorial | `chalk` | `paper`, `night` |

The examples that place pictures name `assets/example-a.png`, `assets/example-b.png` and
`assets/example-c.png`; those files ship with the skill, and a real deck replaces them with its own
images.
