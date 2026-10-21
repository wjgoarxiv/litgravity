# Authoring guide: Markdown to PPTX

This guide teaches the dialect that `scripts/compile-deck.js` reads. A deck is one Markdown file. The
design (colours, type, title frames, decoration) is owned by a tonality pack or by a named legacy
template, so the source carries only structure and words. The formal contract sits in
`specs/markdown-slide-spec-v1.md` and `specs/markdown-slide-spec-v2.md`; the AST shapes sit in the two
JSON schemas next to them. Every command below uses `SKILL_ROOT`, the directory of this skill's `SKILL.md`.

## 1. Anatomy of a source file

A source file is a frontmatter block followed by slide chunks. The loader (`scripts/lib/markdown-loader.js`)
works in three steps: it reads the frontmatter, splits the rest on lines that hold only `---`, and reads
the `layout:` line at the top of every chunk.

```markdown
---
tonality: ledger
title: 2026년 3분기 시립도서관 이용 현황
date: 2026-10-05
notice: 예시 데이터 — 실제 수치로 바꿔 주세요
---

---
layout: cover-figures

# 2026년 3분기 시립도서관 이용 현황
---

---
layout: kpi-row

## 3분기 이용 지표

| 방문자 | 대출 권수 | 신규 회원 | 좌석 점유율 |
|---|---|---|---|
| 18.2만 명 | 41.0만 권 | 6,320명 | 78% |
| 전년 동기 +12% | 전년 동기 +9% | 목표 6,000명 | 목표 75% |

> 3분기 이용 지표 (예시 데이터)

- **요약:** 방문과 대출이 모두 늘었고 신규 회원은 목표를 넘었다
- 좌석 점유율은 개관 이후 처음 목표를 넘었다
- 출처: 예시 이용 통계 시스템, 2026년 9월 말
---
```

This skeleton compiles under `ledger` and passes the gate. The separator is a `---` line, a blank line, and the next `---` that opens the following chunk: the
closing `---` of one slide and the opening `---` of the next slide's `layout:` chunk. A line made only of
three dashes is always a separator, so a horizontal rule inside a slide would cut it in two. Table
separator rows such as `|---|---|` are safe because the dashes share the line with pipes.

### Frontmatter keys

The frontmatter is flat `key: value` text (no nesting). `title` is required, and so is one of
`tonality` or `template`.

| Key | Meaning |
|---|---|
| `tonality` | one of the eight pack ids; selects the design when no flag is given |
| `template` | a legacy or learned template name; it is recorded, and the render still needs `--template <NAME>` |
| `title` | deck title |
| `date`, `department`, `presenter` | metadata that cover variants may print |
| `density`, `variance` | dials, 1-10; clamped into range. Move one only when the direction card says so (`direction-step.md`) |
| `canvas` | `16:9` (default) or `4:3`, when the pack lists it |
| `faces` | `a2z` swaps the pack to the A2Z faces; any other value keeps Pretendard |
| `notice` | one tag at the bottom left of every slide; use it whenever values are examples |
| `data` | a data file (or a comma-separated list) whose numbers fill `{{ ... }}` placeholders (section 8) |
| `accent`, `font`, `background` | recolour, font swap and `mesh` background on the Azure legacy templates only |

Slide-local keys follow the `layout:` line and end at the first blank line. The set is closed to `title:`
(pins one title treatment, `title-treatments.md`) and `variant:` (legacy templates). A line such as
`source: internal data` stays body text, and so does a mistyped `varient:`, which makes the typo visible
on the slide.

## 2. Choose the design before writing

```sh
node "$SKILL_ROOT/scripts/compile-deck.js" --list-tonalities            # eight tonalities, then the legacy templates
node "$SKILL_ROOT/scripts/compile-deck.js" --list-layouts ledger        # families with the titles each takes, covers, sections, closings
node "$SKILL_ROOT/scripts/compile-deck.js" --list-layouts AZURE-PRO     # a legacy template: layouts, blocks, regions
node "$SKILL_ROOT/scripts/compile-deck.js" --list-templates             # legacy and learned templates with their canvas
```

| Tonality | One line |
|---|---|
| `ledger` | numbers first, dense and tabular: business reviews, status updates |
| `signal` | short slides, one hot accent: pitches and launches |
| `atlas` | pictures carry the deck: products, places, field work |
| `chalk` | teaching: numbered steps, worked examples, marked terms |
| `paper` | ink on white: figures, booktabs tables, citations |
| `gazette` | Korean briefing pages: header band, boxed summary |
| `studio` | editorial grid, asymmetric splits, large numerals |
| `night` | dark ground for data and technical keynotes |

The tonality sheets in `references/tonalities/` list tokens, title treatments, families and two worked
slides; `references/examples/` holds twelve complete decks that pass the gate. Every pack sets the deck
in Pretendard Regular and Bold; hierarchy comes from size, weight, colour and placement. A2Z faces apply
when the user or the source asks (`faces: a2z` or `--faces a2z`), and A2Z weight is chosen by family name
(`에이투지체 7 Bold`), which the pack encodes for you.

Legacy templates (`AZURE-PRO`, `AZURE-A2Z`, `BOILERPLATE-PRETENDARD`, `BOILERPLATE-A2Z`, or one learned
from a user's deck) keep their own single look. A legacy deck compiles with `--template <NAME>` on the
command line, and the frontmatter still needs a `template:` or `tonality:` line. A tonality chosen
through `--tonality <id>` overrides the template name.

## 3. Slide grammar

Under a tonality, `layout:` names a family (the slide's job) or a cover, section or closing variant;
`references/layout-families.md` lists them with the source each one reads. Under a legacy template the
original layouts apply: `cover`, `content`, `main` (content plus a `::: main-box` callout), `summary`
(groups under `###` headings), `section`, `closing`, and the open-ended `free`.

| Construct | Syntax | Notes |
|---|---|---|
| Title | `#` on cover and closing, `##` on a content slide | the first heading line becomes the slide title; `###` opens a summary group |
| Bullet | `- text` | one level |
| Group | `- **Heading**` then indented `(1) detail` lines | numbers are typed in parentheses |
| Run-in label | `- **요약:** text` | write the colon; the engine adds one for body bullets, a box needs yours (OF-118) |
| Table | pipe table, header row, separator row | a `>` line right under it is its caption |
| Table link | `[원문](https://example.org/record)` in a cell | becomes an external hyperlink relationship |
| Image | `![caption](path)` on a line of its own | alt text is the visible figure caption |
| Chart | `::: chart type=column unit="억 원"` | section 6 |
| Callout | `::: main-box` | legacy `main` layout |
| Lead | `::: key-message` | a one-line lead under the title where the layout has the region |
| Notes | `::: notes` | footnote or speaker text on legacy layouts |

Raw HTML (`<div>`, `<span>`, `<table>`, `<style>`), inline `style="..."` attributes and `<script>` stop the
compile with a slide and line number. Layout comes from the template contract, so the source has no CSS
to carry.

Source lines that open with `출처:`, `자료:`, `주:`, `Source:` or `Note:` leave the takeaway list and
set as a strip at the foot of the body. Put them last.

## 4. Titles and captions

A title names the subject, the measure and the period. The claim opens the body. OF-114 reads the last
word of a Korean title and the verbs of an English one and fails a sentence:

| Fails | Passes |
|---|---|
| 서가 이용이 지난해보다 늘었다 | 서가 이용 추이, 2025-2026 |
| Revenue grew 18% in Q3. | Revenue by division, Q3 2026 |

A question and a quotation set as a statement pass. A trailing parenthesis such as `(예시 데이터)` is set
aside before the reading. The cover subtitle follows the same rule.

Captions bind a figure or a table to what it shows:

- A table caption is a `>` line directly under the table. The engine numbers it in the deck's language
  ("표 1.", "Table 1.") and keeps a number you typed instead of doubling it.
- A figure caption is the image's alt text: `![도 1. 월별 방문자 | 출처: 예시 이용 통계, p. 12](assets/example-a.png)`.
  The gate (evidence binding) wants a figure number and a `Source:` or `출처:` in the visible caption of
  every picture whose description declares it as a figure or as evidence.
- A figure exported on white and placed on a dark tonality fails OF-117. Save a dark copy beside the
  original with `.dark` before the extension (`flow.png` and `flow.dark.png`, side by side in one folder), or
  draw the numbers as a native chart.
- Image paths resolve against the deck's own folder first, then the working directory.

## 5. Writing bullets that fill the page

Give each content slide the facts a careful reader asks for: the figure, its comparison, its period,
its source and the implication. `density-and-fill.md` explains how the engine places them. Merge two
thin slides into one before adding filler, and put example values under a `notice:` tag.

## 6. Charts and KPI rows

```markdown
::: chart type=column unit="억 원"
| 분기 | 매출 | 영업이익 |
|---|---|---|
| 1Q | 1,120 | 101 |
| 2Q | 1,184 | 110 |
> 분기별 매출과 영업이익 (예시 데이터)
:::
```

`type` is `column` (default), `bar`, `line`, `area`, `stacked`, `pie` or `doughnut`; `unit`, `title` and
`labels=false` are optional. The first column holds the categories and each further column is a series
(pie and doughnut read the first series). The block compiles to a `kpi-table` block with a `chart` field,
so any layout that takes a table takes a chart, and a renderer without chart support shows the numbers
as a table. The chart is native, so PowerPoint's Edit Data opens its values.

One series carries the accent: the latest period, else the measured series beside a plan or target, else
the last column. Put the proposed or current series last when the headers say neither. A headline-number
row is a one-row table of up to six short values, with an optional second row of bases; the first row
holds at most 12 characters per cell and the basis row at most 24. Measured scientific data belongs to
`lit-scientific-visualization`: export the deck's visual system with
`compile-deck.js deck.md --export-viz-context ctx.json` and place the result as a captioned figure.

## 7. Placement tiers (spec v2)

Reach for the smallest freedom that says the thing. Every tier gives up a guardrail.

| Want | Write | Gives up |
|---|---|---|
| a different slot in the template's geometry | `::: region name=<region>` | nothing; legacy templates only |
| two or three things side by side | `:::: columns 2fr 1fr gap=0.3` holding `::: col` blocks | you choose the split |
| something the template never planned | `::: box x= y= w= h=` and `::: shape <kind> ...` | all reflow around it |
| a slide with no template furniture | `layout: free` | the template's whole contribution |
| the same layout with other furniture | `variant: split-navy` | nothing; legacy templates only |

Containers nest by fence length: the outer fence is longer (`::::` holds `:::`). The depth stops at two.
Same-length nesting stops the compile and names the line.

**Columns.** Tracks are ratios and the engine divides the body region between them (`gap` in inches,
default `0.25`). The track count must equal the number of `::: col` blocks. A column holds Markdown
(bullets, a pipe table, an image line) and no directive, so a chart or a box sits outside the columns. On
a legacy template the columns replace the body region, and a bullet written outside them on the same slide
is dropped without a message: put every body line inside a column.

```markdown
---
layout: content

## 접수량과 처리 시간

:::: columns 2fr 1fr gap=0.3
::: col
- **접수량**
  (1) 3분기 접수 12,400건
  (2) 전분기 대비 +8%
:::
::: col
![도 1. 처리 현황](assets/example-a.png)
:::
::::
---
```

The fragment is one slide taken out of a deck; compiled alone, a slide this short leaves its page
sparse, and in a full deck it sits among fuller slides.

**Regions.** `::: region name=table` sends its content to a named region of a legacy layout. A name the
layout lacks stops the compile with the list of regions. A region holds one block; two blocks claiming
one region stop the compile and name both exits (`region` or `columns`). Send a captioned picture
through `columns`: inside `region name=image` the alt text also emits a caption block with the same hint,
and the compile stops with `Image source is empty`. Under a tonality the family fixes the regions and a `region` block has no effect.

**Boxes and shapes.** `::: box x=0.7 y=1.8 w=3.6 h=1.6` takes inches on the template canvas (13.333 x
7.5 for 16:9) and needs all four numbers. `role=` names a font role of a legacy template; `z=under` or
`z=over` (box default `over`). `::: shape rect x=0.5 y=1.6 w=4 h=2 fill=#E2F0EC z=under` is one line with
no closing fence. Kinds: `rect`, `roundRect`, `pill`, `ellipse`, `ring`, `line`, `text`, `image`. Style
keys: `fill line lw radius rotate text color size align valign char_spacing bold asset dir src note`; an
unknown key stops the compile. A `line` needs `x y w` only and takes its thickness from `lw`.

```markdown
---
layout: free

::: shape rect x=0.5 y=1.6 w=4 h=2 fill=#E2F0EC z=under
::: box x=0.7 y=1.8 w=3.6 h=1.6
**결론:** 세 가지로 요약한다
:::
---
```

Placements reach the renderer at the coordinates written. Nothing reflows around them, and a box that
covers a region is a defect the gate reports. Under a tonality `layout: free` draws as `text-column`
with the placements added, so the family's own band checks still apply: a slide of one small box fails
the sparse-slide check and OF-109, and OF-112 reports its empty band. Render a placed slide and read it.

**Variants.** `variant: split-navy` on `layout: cover` swaps the decoration set and the regions it
displaces, as one unit. AZURE-PRO declares `split-navy` and `minimal` for `cover`, and `rule` for
`section`. An unknown variant stops the compile with the declared list. Under a tonality the family
name already chooses the variant (`cover-figures`, `section-rule`, `closing-ask`).

## 8. Data files and placeholders

When the same number appears on several slides, keep it in one file. `data: numbers.json` (one path, or
a comma-separated list, relative to the source) activates `scripts/office_data.py`: it computes derived
values, runs the declared checks and writes the formatted numbers into the Markdown before compiling.

```json
{
  "values": {"revenue": 640, "op_income": 48, "op_margin": "=op_income / revenue * 100"},
  "tables": {
    "quarterly": {"csv": "quarterly.csv", "derive": {"이익률": "=영업이익 / 매출 * 100"}, "format": {"이익률": ".1f"}}
  },
  "checks": ["quarterly.매출['26년 3Q'] == revenue", "quarterly.영업이익['26년 3Q'] == op_income"]
}
```

A CSV file alone becomes a table named after its stem (first row headers, first column row keys).
Expressions start with `=` in `values` and `derive`; `checks` are plain expressions. Allowed: numbers,
`+ - * / ** %`, comparisons, `and`/`or`/`not`, value names, `table.column` (total row excluded),
`table.column['row key']`, `table['column name']`, and the functions `sum avg min max abs round len
growth(new, old) share(part, whole) approx(a, b, tol)`. `==` compares with a floating-point tolerance.

| Placeholder | Result |
|---|---|
| `{{ revenue }}` | `640`; integers get thousands separators |
| `{{ op_margin \| .1f }}` | `7.5`; any Python format spec after the pipe |
| `{{ growth(revenue, 548) \| +.1f }}%` | `+16.8%` |
| `{{ table:quarterly }}` | the whole table as a pipe table, derived columns and total row included |
| `{{ table:quarterly \| columns=매출,영업이익 no-total }}` | chart-ready form inside a `::: chart` block |

A failed check stops the compile before any slide is drawn (`Data error: data check failed: ... (left 48,
right 49)`), which is the point: the deck cannot ship a total that disagrees with its parts. Inspect
without compiling:

```sh
python3 -B "$SKILL_ROOT/scripts/office_data.py" check deck.md      # JSON report; exit 1 on a failed check or unknown name
python3 -B "$SKILL_ROOT/scripts/office_data.py" resolve deck.md    # the Markdown with every placeholder filled
```

## 9. Compile, gate, look

```sh
node "$SKILL_ROOT/scripts/compile-deck.js" deck.md --pptx out.pptx --embed-fonts                       # tonality from the frontmatter
node "$SKILL_ROOT/scripts/compile-deck.js" deck.md --tonality night --pptx out-night.pptx              # another tonality, same source
node "$SKILL_ROOT/scripts/compile-deck.js" deck.md --template AZURE-PRO --pptx out.pptx --embed-fonts  # a legacy template
node "$SKILL_ROOT/scripts/compile-deck.js" deck.md --ast out.json                                      # the intermediate AST
python3 "$SKILL_ROOT/scripts/qa_deck.py" out.pptx                     # exit 0 required; add --sibling out-night.pptx for OF-116
python3 "$SKILL_ROOT/scripts/render_pages.py" out.pptx --out-dir renders --pages 5
```

`--embed-fonts` embeds the bundled Pretendard (or A2Z) files so the deck renders on a machine without
them. The compile log prints the tonality line, then `note:` lines (a family the pack lacks, a title
that moved), `variety:` lines and `fill:` lines; keep them in the build log. `render_pages.py` converts
through LibreOffice into `renders/page-01.png` and so on, and reports `SKIP` with the reason when
`soffice` is missing, in which case say that the visual pass did not happen. A clean gate means no known
defect. It cannot tell that a slide reads badly, so open the pages. A learned brand template comes from
`python3 "$SKILL_ROOT/scripts/learn_template.py" corporate.pptx --name MY-BRAND`, written to
`.lit-pptx/templates` and referenced only fonts, colours and assets present in the source deck.

## 10. Failures seen most often

| Symptom | Cause | Fix |
|---|---|---|
| `Slide chunk must start with a 'layout:' directive` | a stray `---` inside a slide, or a chunk holding only the layout line | remove the rule; give the slide a title line |
| `Frontmatter must declare a 'template' or a 'tonality' field` | the key sits after the first slide, or is missing | put it in the opening block |
| `--template or --tonality ... is required` | a legacy deck compiled without the flag | add `--template <NAME>` |
| `layout "x" is neither a layout family nor a legacy layout` | typo or wrong pack | read the printed family list |
| `the full-chart family does not take "side-rail"` | a `title:` pin the family refuses | pick from the printed allowed set |
| `":::: columns" declares 2 track(s) ... but holds 1` | track count differs from `col` blocks | match them |
| a body line vanished on a legacy slide with `columns` | the line sat outside the columns | move it into a `::: col` |
| `block type "title" is not allowed` on `layout: free` | a legacy `free` slide takes notes and placements only | set the title as a `::: box` |
| OF-118 on a box | bold label without a colon inside a box | type `**결론:**` |
| `sparse_slide` and OF-109 on a free slide | one small box on an otherwise empty page | choose a fuller family |
| the same table size on every slide | one family repeated | vary the job: chart, matrix, comparison, timeline |
| a title written as a verdict | claim in the title | move the claim into the first bullet (OF-114) |
