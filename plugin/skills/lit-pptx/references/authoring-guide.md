# Authoring Guide (Markdown → PPTX)

How to author a deck in the constrained Markdown dialect that `scripts/compile-deck.js` compiles. The tonality pack (or a named legacy template) owns fonts, palette, dimensions and decoration. The full contract is `specs/markdown-slide-spec-v1.md`; this guide is the working reference.

## 1. Pick a direction

A deck compiles under a tonality (a design direction read from a pack) or under a legacy template
the user named. Choose it with the direction step (`direction-step.md`) before writing slides, and
put it in the frontmatter so the source carries its own look:

```bash
node "$SKILL_ROOT/scripts/compile-deck.js" --list-tonalities              # thirteen tonalities and the legacy templates
node "$SKILL_ROOT/scripts/compile-deck.js" --list-layouts <tonality>      # families, the titles each allows, variants
node "$SKILL_ROOT/scripts/compile-deck.js" --list-templates               # legacy and learned templates
```

| Tonality | One line |
|---|---|
| `ledger` | numbers first, dense, tabular; business reviews and status updates |
| `signal` | short, bold slides with one hot accent; pitches and launches |
| `atlas` | pictures carry the deck, titles on panels or under images |
| `chalk` | teaching: numbered steps, worked examples, marked terms |
| `paper` | ink on white, figures and booktabs tables, citations |
| `gazette` | Korean briefing pages: header band, boxed summary, 개조식 evidence |
| `studio` | editorial grid, asymmetric splits, margin-bar titles, large real numerals |
| `night` | dark ground for data and technical keynotes |

Legacy templates (`AZURE-PRO`, `AZURE-A2Z`, `BOILERPLATE-PRETENDARD`, `BOILERPLATE-A2Z`, or one
learned from the user's deck) keep their single look and are used only when the user names one.
Each tonality sheet in `tonalities/` lists its tokens, title treatments, families and two worked
slides; `examples/` holds complete decks.

Font note: every tonality sets the deck in **Pretendard** Regular and Bold by default; hierarchy
comes from size, weight, colour and placement. The **에이투지체** (A2Z) faces are used only when the
user or the source asks for them: `faces: a2z` in the frontmatter (or `--faces a2z`) applies the
pack's `faces-a2z` map. A2Z ships one family *per weight* (`에이투지체 7 Bold`), so weight is chosen
by family name, never a bold flag. The pack encodes this; you write content.

## 2. Deck skeleton
```markdown
---
tonality: ledger
title: Deck Title
date: 2026-06-29
notice: 예시 데이터 — 실제 수치로 바꿔 주세요
---

---
layout: cover-figures

# Deck Title
---

---
layout: chart-insight

## The title names the topic as a label

::: chart type=column unit="억 원"
| 분기 | 매출 | 계획 |
|---|---|---|
| 1Q | 1,120 | 1,100 |
| 2Q | 1,184 | 1,140 |
> 분기별 매출과 계획, 2026년 (예시 데이터)
:::

- The claim the chart supports, as the first takeaway
- What it compares with, and over which period
- What it implies or what happens next
---

---
layout: closing-ask

## The decision you ask for

| 안건 | 금액 | 결정 시점 |
|---|---|---|
| … | … | … |

- 다음 단계: who does what, by when
---
```
**Separator rule (critical):** a `---` line, then a blank line, then `---` + the next `layout:`. This is how slides are split — see the spec.

Frontmatter keys for the direction: `tonality:`, and `density:` / `variance:` only when the card
moves a dial. Slide keys after `layout:`: `title: <treatment>` pins one slide's title treatment
(`title-treatments.md`); `variant:` belongs to legacy templates.

## 3. Layout families

Under a tonality, `layout:` names a family (the slide's job) or a cover, section or closing variant.
`layout-families.md` lists all of them with the source each one reads; `--list-layouts <tonality>`
shows which the chosen pack carries. Write the source so the slide fills (`density-and-fill.md`):
a takeaway under every table, evidence under a big number, the next step under an ask.

Under a legacy template the five original layouts remain: `cover`, `content`, `main` (content plus a
`::: main-box` callout), `summary` (two grouped blocks) and `closing`; `section` exists on the Azure
templates. Check `--list-layouts <TEMPLATE>` for the blocks each accepts.

### Executive/research compositions

These are semantic compositions of existing v1 blocks, so they remain renderer compatible:

1. **figure plus interpretation**

   ```markdown
   ![Figure 1. Pressure trend | Source: test report, p. 12](assets/pressure.png)

   - **Observation** Pressure remained inside the validated band.
     (1) Basis: only one operating condition was sampled.
     (2) Implication: repeat the test before scale-up.
   ```

2. **table plus decision takeaway** — keep units in headers, quantitative cells compact, ≤6 columns, and add a blockquote caption/source immediately after the table.
3. **source capture** — use a legible screenshot with locator/date in the alt text and state in the body what it shows and why it matters.
4. **two-record appendix evidence** — show at most two records per slide; include a one-line summary, source locator, and clickable DOI/canonical link when available. In a table cell, write `[원문](https://example.org/record)`; the PPTX renderer emits an external OOXML hyperlink relationship.

Do not write authoring trace or unresolved placeholders. Treat overclaim, jargon, imperative tone, unsupported schedules, hierarchy, and visual density as review-only items to resolve during rendered page review.

## 4. Compile
```bash
node "$SKILL_ROOT/scripts/compile-deck.js" deck.md --pptx out.pptx --embed-fonts                    # tonality: from the frontmatter
node "$SKILL_ROOT/scripts/compile-deck.js" deck.md --template <TEMPLATE> --pptx out.pptx --embed-fonts  # a named legacy template
```
`--embed-fonts` makes the deck self-contained (renders on machines without the font). `--ast out.json` dumps the intermediate AST.

## 5. Verify (always)
```bash
python3 "$SKILL_ROOT/scripts/qa_deck.py" out.pptx        # overflow, contrast, anti-slop, craft floor and the deck output checks; non-zero = FAIL
python3 "$SKILL_ROOT/scripts/render_pages.py" out.pptx --out-dir renders --pages 5   # then open renders/page-*.png
```
A clean gate is defect-absence, not quality — read the rendered pages. See `references/anti-slop-checklist.md`.

## 6. Anti-patterns (fix before shipping)
- Generic titles ("개요"/"Overview") → make them specific.
- Padding bullets that restate the heading → cut or add real information.
- Manually adding logos/lines/colors/fonts → the pack or template applies decoration; don't.
- Positioning a title with a free box → every treatment has one frame; pin a different treatment with `title:` instead.
- A table, a big number or an ask with nothing under it → add the takeaway, the evidence or the next step (`density-and-fill.md`).
- Overloaded slides (> ~8 bullets, > ~8 table rows, > 4 items per summary group) → split.
- A data slide without its basis, comparison, period or source → add them; end with `출처:` (`Source:`).
- Placeholder/AI-slop wording → gated by `scripts/forbidden-terms.json`.
- Evidence image with only a filename-like alt → write a numbered caption plus `Source:`/`출처:` so the visible caption stays bound to the figure.
- Appendix DOI/canonical/raw URL field without a hyperlink → add an actual PowerPoint hyperlink. QA detects the field directly and verifies its external OOXML relationship; no special “link available” phrase is required.

## 7. Bring your own brand
```bash
python3 "$SKILL_ROOT/scripts/learn_template.py" corporate.pptx --name MY-BRAND   # extracts fonts/palette/geometry, closed-set verified
node "$SKILL_ROOT/scripts/compile-deck.js" deck.md --template MY-BRAND --pptx out.pptx --embed-fonts
```
The learned template only references fonts/colors/assets present in your source (off-brand-by-construction).

## Run-in labels

A point may open with a bold label: `- **요약:** 앱에서 맡기면 …`, `- **Basis:** 1.0 L/min feed`. Write
the colon; the engine adds one when the label ends without a separator (`**요약** 앱에서 …` is set as
"**요약:** 앱에서 …"), because a bold word running into its sentence reads as part of it. A bold line
with nothing after it is a group heading and takes no colon. The gate fails a run-in label without a
separator (OF-118). An agenda numbers its own rows, so its title stands without a numeral beside it
(OF-119).

## Placement (spec v2)

Reach for the least freedom that says the thing. Each tier gives up a guardrail, and
the one below it is harder to get right.

| Want | Write | Gives up |
|---|---|---|
| the template's geometry, a different slot | `::: region name=<region>` | nothing |
| two things beside each other | `:::: columns 2fr 1fr gap=0.3` with `::: col` inside | portability stays; you choose the split |
| something the template never anticipated | `::: box x= y= w= h=` and `::: shape <kind> …` | every guardrail — nothing reflows around it |
| a slide with no template furniture at all | `layout: free` | the template's whole contribution |
| a different look, same layout | `variant: split-navy` | nothing |

Containers nest by fence length: the outer fence is longer (`::::` holds `:::`).
`::: shape` is one line with no closing fence. Shapes sit behind content, boxes on top.

Full contract: `specs/markdown-slide-spec-v2.md`.

**A slide built with a box, a shape or `layout: free` has to be looked at** — render it,
gate it, then read the rendered page. The gate reports defects; it does not report that a
slide reads badly.

## Charts, KPI cards and sample data

Business numbers are drawn here, natively, so they stay editable in PowerPoint
(right-click → Edit Data):

```markdown
::: chart type=column unit="억 원"
| 분기 | 매출 | 영업이익 |
|---|---|---|
| 1Q | 1,120 | 101 |
| 2Q | 1,184 | 110 |
> 분기별 매출과 영업이익 (예시 데이터)
:::
```

`type` is one of `column` (default), `bar`, `line`, `area`, `stacked`, `pie`,
`doughnut`. The first column holds the categories, every further column is a series;
pie and doughnut use the first series. The chart takes the table's place on any
layout that accepts a table and fills the slide down to its caption, which the
engine numbers "도 N.".

One series carries the accent, and it is the same kind of series on every chart of the deck: the
latest period when every series names one ("2026" over "2025", "Q3" over "Q2"), else the measured
series beside a plan, target, budget or prior period ("실적" over "계획"), else the last column. Put
the proposed or current series last when the names say neither. Data labels keep the decimals the
table writes, so a chart beside a table that says 18.0 says 18.0 too.

A figure exported as a picture (a plot or a diagram drawn on white) stands as a white card on a dark
tonality. Give it a dark variant beside it, named like the file with `.dark` before the extension
(`assets/flow.png` and `assets/flow.dark.png`): a dark tonality draws the variant, a light one the
original. Better still, give a plot its numbers as a `::: chart` block, which every tonality draws in
its own colours. The gate fails a mostly-white picture on a dark ground (OF-117).

Headline numbers become KPI cards on the Azure templates (two to four short values), and the
`kpi-row` family under a tonality: one data row of up to six short values, a second row with each
figure's basis or comparison, a caption with period and source, the takeaways, and the source line.
Under a side title, or when the cards would stop high on the page, the values run down the body as
rows (value, label, basis) with the takeaways beside them.

```markdown
| 매출 | 영업이익 | 영업이익률 | 영업현금흐름 | 수주 잔고 |
|---|---|---|---|---|
| 1,184억 원 | 110억 원 | 9.3% | 96억 원 | 2,310억 원 |
| 계획 대비 +3.9% | 계획 대비 +10.0% | 계획 대비 +0.5%p | 전년 동기 81억 원 | 전분기 대비 +4% |

> 2026년 3분기(7-9월), 내부 결산 자료 (예시)

- 매출과 영업이익이 모두 계획을 넘었다
- 영업현금흐름은 영업이익의 87% 수준이다
- 수주 잔고는 매출 약 2분기분이다
- 출처: 예시 기업 내부 결산 자료(2026년 3분기), 2026년 연간 사업 계획
```

A slide is dense when every block on it says something the reader needs: the figure, what it is
compared with, the period, where it comes from, and what follows. Write that, and the compact step
(density 10, every pack's default) sets it at 13 pt in 24 pt margins with the source strip at the
foot. Never repeat a line to fill a slide; merge thin slides instead.

`notice:` in the frontmatter prints one tag at the bottom left of every slide —
use it whenever values are examples: `notice: 예시 데이터 — 실제 수치로 바꿔 주세요`.

Measured scientific data (instrument output, fitted curves, uncertainty) is still
drawn by the scientific visualization skill: hand it the deck's visual system
with `compile-deck.js deck.md --export-viz-context ctx.json` (the tonality comes from the frontmatter) and place the
result as a captioned figure. Register the font *file* from `ctx.json` rather than the
family name — a Korean family resolved by name alone renders as boxes.
