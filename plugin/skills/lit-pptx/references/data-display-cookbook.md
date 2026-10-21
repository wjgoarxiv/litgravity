# Data display cookbook

Numbers, tables, KPI rows, charts and captioned figures follow one rule: write the data and let the
pack draw it. Colours below are palette roles of the chosen tonality (or the named legacy template),
not fixed hex values. The pack decides the table style (booktabs, ledger, grid, open), its rules and
banding, and the chart style (gridlines or none, direct labels, how the highlight is drawn); each
tonality sheet under `references/tonalities/` lists its own.

## Number display

| Data | Write | Avoid |
|---|---|---|
| Year | `2026`, `2026E`, `2027F` | `2,026` |
| Percentage | `12.3%` | `0.123` |
| Multiple | `3.2x` | `3.2 times` in a numeric column |
| Missing value | `-` or `—` | `0.0` when it means "not available" |
| Unit | in the header: `매출 (억 원)`, `Revenue (USD m)` | the unit repeated in every cell |
| Delta | `▲ +9%`, `▼ −3%` (glyph, sign, value) | colour alone, or a bare `9%` |
| Thousands | `1,205` | `1205` beside `1,240` |

The engine right-aligns a table column when every data cell reads as a number: an optional ▲ or ▼
glyph, an optional sign, digits with `.` and `,`, then at most a short unit (`%`, `%p`, `x`, `배`, `pt`,
`bp`, or one to three letters or Hangul syllables). A dash counts as blank. One cell such as "약 12억 원"
turns the whole column left-aligned, and the gate reports the column (OF-103). Keep text in the first
column and numbers in the others, with the unit in the header. Decimals in a chart's data labels
follow the table: a column written `18.0` shows `18.0`.

## Table patterns

**Operational table (four to six columns).** Units in the header, numbers right-aligned, a totals row
last when the data has one (a first cell that reads 합계, 총계, 소계, 계, Total or Sum is set bold by the
pack and ruled off as the pack's table style says). Follow it with two to four takeaways: `table-insight`
puts them beside the table, `ledger-table` under it. A table of three rows or fewer at the top of a
slide leaves the page empty, so turn it into a `kpi-row` or a `comparison`, or give it its takeaways.

**Comparison matrix (options, vendors, scenarios).** One row per option and one emphasis only: Signal
and Night tint the row whose first cell appears in the slide title (a first cell of at least two
characters), so a title such as "공급사별 단가: 중앙물산" marks the 중앙물산 row. Two options with three or
four points each read better as a `comparison`; two axes with four options read better as a `matrix-2x2`
(a table with a corner cell `영향 \ 난이도`, two column heads, two row heads and an `item · detail` per cell).

**Wide tables.** The engine breaks cell text at spaces, sets cells at label size (11 pt on the compact
step) and widens each column by its longest cell, so six columns read well and nine do not. Split a
wide table across two slides or move a column into the takeaways.

## KPI rows and number panels

A KPI row is a table of short values; the header holds the labels.

```markdown
| 방문자 | 대출 권수 | 신규 회원 | 좌석 점유율 |
|---|---|---|---|
| 18.2만 명 | 41.0만 권 | 6,320명 | 78% |
| 전년 동기 +12% | 전년 동기 +9% | 목표 6,000명 | 목표 75% |
```

- The first row is the figures (at most 12 characters each), the optional second row their basis (at
  most 24 characters each). Two to six columns qualify; a longer cell or a longer table stays a table.
- A two-column table of value and label pairs is also a KPI list, at most four pairs counting the header
  row as the first pair (`| 18.2만 명 | 방문자 |`, then one pair per row).
- Positive and negative colours belong to deltas, always with the ▲ or ▼ glyph and a sign.
- Under a side title the figures run as rows down the body; on the compact step a short card row with
  takeaways becomes figure rows beside them. A figure never exceeds title size.
- `big-number` takes the same table as a data panel: two to four related figures, each with label and
  basis, and two or three lines of evidence beside it. A lone figure with no basis hugs a small panel.

## Charts

A native chart is written as a `::: chart` block holding a pipe table: categories in the first column,
one series per further column, the caption as a `>` line inside the block.

```markdown
::: chart type=column unit="억 원"
| 월 | 2025 | 2026 |
|---|---|---|
| 4월 | 372 | 398 |
| 5월 | 386 | 412 |
| 6월 | 381 | 430 |
> 월별 매출, 전년 동월과 비교 (예시 데이터)
:::
```

| Choice | Rule |
|---|---|
| `type` | `column` (default), `bar` (horizontal, for long labels), `line` (time), `area`, `stacked`, `pie`, `doughnut` (one series, shares of a whole) |
| `unit="..."` | set once: on the value axis, or dropped when every series name already carries it |
| `labels=false` | hides the data labels of a dense chart |
| `title="..."` | a chart title; the slide title usually does that job |
| numeric table, no block | in `chart-insight`, `full-chart`, `kpi-over-chart` and `dashboard-grid` a table of three or more rows whose data columns are all numeric is drawn as a chart (columns up to eight rows, a line beyond) |
| missing cell | leaves a gap in a line instead of dropping to zero |

**Highlight.** The accent goes to one series: the latest period when every series name carries a
period (2026, 3Q, 7월), else the one measured series beside plans, targets, budgets, baselines or prior
periods (계획, 목표, 예산, 전년, baseline, forecast), else the last column. The others recede in muted
colours (or, under Paper's `series-order`, take the pack's second to fourth series colours). A series
that recedes on one chart keeps its colour on the next, so the deck reads as one system. A caption sits
inside the block; a `>` line after the closing `:::` prints as body text with its bracket.

**Fill.** A chart takes the body to the floor; two or three takeaways sit beside it (`chart-insight`) or
the title explains it from below (`bottom-anchor`). On the compact step the chart's values appear in a
small table beside the takeaways. Several charts read together in `dashboard-grid` (up to four).

## Figures and captions

A picture's alt text is its caption: `![도 2. 오후 3시의 창가 | 출처: 예시 이미지](assets/example-b.png)`.
The engine numbers figures and tables in the deck's language (`lang: ko` or `lang: en`, else by the
share of Hangul) and renumbers a typed number, so write the text and let the sequence follow the slides.

- Write each figure as one visual group: the picture, a numbered caption, the source locator after a
  bar, the data basis beside the number it bounds, and a concise interpretation next to it.
- The gate (`evidence_binding`) treats a picture whose alt text opens with Figure, 그림, 도표, 근거 or
  Evidence as an evidence figure and expects a visible caption number and a `Source:` or `출처:` line
  nearby; the form above satisfies it.
- A figure exported on white and placed on a dark tonality fails OF-117; place `name.dark.png` beside
  `name.png` and the engine uses it.
- A table with its decision takeaway is one bounded table, its caption and source, and one decision
  sentence; restating the table in prose adds length without evidence.
- Appendix evidence reads best at about two records a slide, each with a summary, a locator and, when
  one exists, a DOI written as a Markdown link; the gate verifies real hyperlinks on slides that say
  "Appendix" or "부록".

## Source notes

A body line that opens with `출처:`, `자료:`, `주:`, `Source:` or `Note:` leaves the takeaways and sets as
a strip at the foot of the body, in source size under a hairline (where the pack draws hairlines):

```markdown
- 출처: 내부 운항 데이터, 2026년 4월 기준
- Source: ERP export, 2026-04-14, Procurement
```

## One home for the numbers

A deck that quotes a figure on several slides keeps it in a data file. The frontmatter key
`data: numbers.json` (or a CSV) holds values, tables, derived columns and checks; `{{ revenue }}`,
`{{ growth(revenue, plan) | .1f }}` and `{{ table:regions | columns=매출,영업이익 no-total }}` fill the
Markdown before compiling. A failed check or an unknown name stops the compile.

```bash
python3 "$SKILL_ROOT/scripts/office_data.py" check deck.md     # values, derived columns, check results
python3 "$SKILL_ROOT/scripts/office_data.py" resolve deck.md   # the Markdown with every placeholder filled
```

## Failure patterns

| Symptom | Cause | Fix |
|---|---|---|
| a numeric column left-aligned, OF-103 | a cell with extra words ("약 12억 원") | one number and a short unit, units in the header |
| a `> ...` line under the chart | the caption follows the closing `:::` | move it inside the block |
| the accent on the wrong series | no period or reference word in the names | name the others with a period or reference word, or order the protagonist last |
| a three-row table with a lone sentence, sparse slide | too little content for a table family | use `kpi-row`, `comparison` or add takeaways |
| `evidence_binding` fails | alt text opens with "Figure 3" and carries no `Source:` | `![Figure 3. title | Source: locator](path)` |
| QA `anti_slop: forbidden_terms` | a word such as "placeholder", "tbd" or "todo" in a cell | write the real value or remove the row |
