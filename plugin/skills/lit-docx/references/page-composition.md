# Page composition

A reader meets a document one page at a time. A page that stops a third of the way down, a heading
left at the foot of a page with its paragraph overleaf, or a table whose last two rows sit alone on the
next page tells that reader the document was assembled, not finished. A page with coloured headings, a
tinted box and a key-figure tile on every spread tells the same reader a template wrote it. This file
explains how a page gets its fill, what the converter already does to keep pages whole and quiet, what
`scripts/qa_docx.py --layout` measures, and how to repair each finding in the Markdown source. Every
number below is read from `scripts/docx_layout.py`, `scripts/docx_design.py` and `scripts/slop_lint.py`;
when a rendered result disagrees with this text, the code is right and this file needs the correction.

The repair rule is short. Change the source, reconvert, rerun the gate, and open the page images. Type
size, leading and gate thresholds stay where the pack put them: shrinking text to win a line moves the
problem onto the next page and breaks the density the user chose.

```bash
SKILL_ROOT="<directory of this SKILL.md>"
OFFICE="$SKILL_ROOT/../lit-pptx/scripts"
python3 "$SKILL_ROOT/scripts/convert_md_to_docx.py" doc.md doc.docx
python3 "$SKILL_ROOT/scripts/qa_docx.py" doc.docx --source doc.md --layout --kind report
python3 "$OFFICE/render_pages.py" doc.docx --out-dir pages --pages 4
```

The gate prints JSON. `output.findings` holds the FAIL entries (`check`, `severity`, `page`, `detail`,
`fix`), `output.advisories` the rest, `output.fills` the fill of every page, and `output.fill_median`
the median of the body pages. When soffice is missing the page checks are skipped and `output.render`
says why; the reply then states that no page was measured.

## How a page is measured

The gate renders the file through soffice, reads the PDF with PyMuPDF and works in points. The frame of
a page runs from the top margin to the bottom margin of the main section. The fill of a page is the
distance from the top of the frame to the lowest ink, over the frame height, clamped to 0..1. Ink means
a text line, a drawing that has a stroke or a fill darker than 0.96, or a picture; a rule or a table
border therefore counts as filled space.

Two pages are exempt from `fill.page`: the last page, and page 1 of a document that opens with a cover.
The reader of the gate treats a document as having a cover when its first section ends before any heading
(the Proposal cover page, and the section break that closes the Journal masthead) or when a table is
captioned `cover memo` or `cover manual` (the Memo block and the Manual control block). Page 1 of a Manual
and of a Proposal showed `exempt: cover` in the tested runs.

LibreOffice breaks Korean lines between syllables, while Word with the eastAsia language set to Korean
breaks between words; every pack's styles carry that setting. A page preview rendered through soffice
can therefore show a word split across two lines. That split belongs to the preview. Judge fill and
pagination from the preview (it runs slightly shorter than Word) and check line breaks in Word when they
matter. Pretendard is declared in the file and not embedded, so the machine that renders needs the font;
a substituted face changes line breaks and page fill.

## Density, margins and leading

Each pack carries two dials, density and variance, from 1 to 10. Frontmatter (`density:`,
`variance:`) or the converter flags `--density` and `--variance` override the pack. Density moves the
margins, the line pitch and, at 3 or below, the body size. Variance is stored and printed in the
conversion line and changes nothing on the page. The pack defaults are Report 9, Brief 9, Manual 9,
Proposal 8, Memo 9 and Journal 9. A move of more than two steps from the default changes the look the
user chose, so ask first through `ask_question` and offer the pack default as the recommended answer.

| Density | Margins top / bottom / left / right (mm) | Text block (mm) | Body size | Pitch Hangul / Latin | Word multiple Hangul / Latin |
|---|---|---|---|---|---|
| 1-2 | 30 / 32 / 30 / 30 | 150 | pack + 0.5 pt | 185 % / 140 % | 1.21 / 0.92 |
| 3 | 28 / 30 / 28 / 28 | 154 | pack + 0.5 pt | 185 % / 140 % | 1.21 / 0.92 |
| 4 | 28 / 30 / 28 / 28 | 154 | pack | 185 % / 140 % | 1.21 / 0.92 |
| 5-6 | 27 / 29 / 27 / 27 | 156 | pack | 180 % / 137 % | 1.18 / 0.90 |
| 7 | 26 / 28 / 26 / 26 | 158 | pack | 180 % / 137 % | 1.18 / 0.90 |
| 8 | 26 / 28 / 26 / 26 | 158 | pack | 175 % / 133 % | 1.14 / 0.87 |
| 9 | 25 / 27 / 25 / 25 | 160 | pack | 175 % / 133 % | 1.14 / 0.87 |
| 10 | 24 / 26 / 25 / 25 | 160 | pack | 175 % / 133 % | 1.14 / 0.87 |

Body text starts at 10.5 pt and stops there as a floor (Proposal and Memo set English at 11 pt). The
bottom margin is at least as large as the top, and the side margins stay at 25 mm or more.

The pitch is the distance between baselines as a share of the type size: Hangul fills the whole em
square and reads well at 175-185 %, Latin at 130-140 %. Word takes a multiple of the face's single
line, and a single line of Pretendard measured 1.55 em in Word and 1.51 em in LibreOffice, so the
converter divides the pitch by 1.53 (Times New Roman: 1.15). A Korean body at 175 % is set at a
multiple near 1.14. A multiple of 1.5 copied from a style guide for another face lands near 230 % and
turns the page into stripes. A memo, and any source the converter estimates at one page or less, uses
tight spacing: pitch 165 % Hangul and 120 % Latin (multiples 1.08 and 0.78), paragraph space 5 pt
(4 pt in English), heading space 12/5, 10/4 and 9/3 pt, and table cell padding of 2 pt.

| Element | Setting |
|---|---|
| Paragraph | 6 pt after (5 pt English), no first-line indent, Korean justified in Report, Brief, Proposal and Memo, ragged right in Manual, Journal and every English text |
| Heading space above / below | h1 22 / 9 pt, h2 15 / 6 pt, h3 11 / 4 pt, h4 9 / 3 pt; heading line pitch 130 % |
| Table text | 92 % of the body, 9.5 pt at 10.5 pt body (10 pt at 11 pt), pitch 140 %, cell padding 3.5 pt top and bottom |
| Table rules | 1 pt above and below, 0.5 pt under the header, 0.5 pt over a total row; no verticals, no fills |
| Caption, units, notes | caption at table size with 4 pt around it; `(단위: …)` right-aligned over the table; `주:` and `자료:` lines in muted ink under it |
| Running head | 82 % of the body (8.5 pt), muted, regular weight |

## What the converter already does

The converter sets keep-with-next, keep-lines and section rules, so the source needs structure and
text, and the layout follows from them. The list below is the repertoire; a finding that survives it
needs a source change.

- A heading keeps with its next paragraph, and a paragraph under a heading shorter than 60 characters keeps with what
  follows it, so a heading always carries a couple of lines of its section. Space above a heading is
  about twice the space below.
- No h1 starts a new page. A part starts where the last one ended.
- A table caption (`표 1.` or `Table 1.`) keeps with its table, and an image caption keeps with its
  image. A Korean caption is set as `<표 1>` and `[그림 1]` with a bold label. When every unit-bearing
  header cell after the first column names the same unit, the unit leaves the headers for one `(단위: …)`
  line. `출처:` becomes `자료:`, after any `주:` line.
- A table the converter estimates at 0.9 of the frame or less keeps its rows together. A longer table
  (a header and six or more body rows) can break between rows, header repeated, only where a quarter of
  the frame is still free, which leaves at least three body rows on each side.
- Text under a table stands 8 pt clear of its bottom rule, a note or source line 3 pt. A sentence right above a
  table without a caption keeps 6 pt under itself.
- A closing paragraph of up to 400 characters keeps the paragraph before it company, which keeps a lone
  paragraph off the last page. A closing section without a table or picture and of about twelve lines
  or fewer keeps whole.
- A list of two to six items stays together: every item but the last keeps with the next, and a lead-in
  of up to 160 characters right before it keeps with the list. In a column body a list of five or six
  keeps its first two items with the lead-in and its last two items together and can break once between
  them.
- A heading, its lead sentence (up to 200 characters) and a table of up to eight body rows form one
  chain; a caption or units line between them joins it.
- Callouts and key-figure boxes keep their paragraphs together and their rows whole. A sidebar row cannot split.
  A sidebar floats beside the text only when the paragraphs before the next heading are taller than the
  box; otherwise it stands at full width in the flow.
- Table columns are widened so that no column is narrower than its longest word, and a wrapping text
  column takes spare room from columns that hold their longest cell with space to spare. Numeric columns
  are right-aligned in tabular figures, and a negative figure takes the minus sign (−).
- Bullets are an en dash in Korean text and a round bullet in English, a bulleted list of one item
  becomes a paragraph, each numbered list restarts at 1, and Hangul text is upright; emphasis is weight.
- Figures are scaled to the container width and to at most the pack's share of the frame height: 0.40
  (Brief, Memo, Journal), 0.45 (Report, Manual), 0.60 (Proposal). A paragraph holding a picture is single spaced.
- A section that opens under a hairline right after a ruled box draws no second rule. In a column body a
  `자료:` or `주:` line under a page-wide table spans with the table, and the column body ends with a
  continuous section break so the last page sets its columns to an even depth.
- The Korean ISO date rule: a date such as 2026-06-30 in a Korean body is written `2026. 6. 30.`, and the
  frontmatter `date:` is rewritten the same way.

## The checks

Severity depends on the run. A tonality run (frontmatter `tonality:` or `--tonality`) fails on every
row of the tables below. The plain and publisher paths fail on the rows marked plain FAIL (and
`cover.block` runs for tonality documents only) and report the others as ADVISORY. The columns below give the id, what it measures, the threshold in the code, the severity and
the repair in the Markdown source.

### Page checks (need `--layout`)

| id | Measures | Threshold | Severity | Source-side fix |
|---|---|---|---|---|
| `fill.page` | ink depth of a body page | under 0.35 of the frame; last page and cover page exempt | FAIL | the next block jumped to the next page: move that block up, put a paragraph of text before it, split a long table at a natural group, or merge a thin section into its neighbour |
| `memo.fit` | a memo that spills onto page 2 | two pages and page 2 filled under 0.25 | FAIL | cut the lines that spill, or fold a closing part into the opening paragraph; a memo holds one page by tight spacing |
| `page.spill` | the last page of a document | a two-page document with page 2 under 0.40, or any longer document whose last page is under 0.125 | FAIL on a tonality run, ADVISORY otherwise | give page 2 a whole section with its table, or tighten to one page; keep the closing paragraph with the block before it |
| `list.split` | a list of 2-6 items | items on more than one page or column; a column body allows one break with two items or more on each side | FAIL on a tonality run, ADVISORY otherwise | shorten the list to fit, move its lead-in and list together, or cut the list to a sentence |
| `heading.apart` | heading and lead sentence against the table they open | lead of 200 characters or fewer, table of eight body rows or fewer, heading and table on different pages | FAIL on a tonality run, ADVISORY otherwise | keep the lead to one or two lines, or move the sentence under the table |
| `heading.stranded` | the last text line of a page | equals a heading | FAIL | put one or two sentences of claim between the heading and the block that follows it |
| `heading.column` | a heading at a column foot | column body; heading in one column, its first text in the next | FAIL on a tonality run, ADVISORY otherwise | add a sentence under the heading, or lead the part with text |
| `columns.balance` | column depth in a column body | a column under 0.75 of the frame beside one reaching 0.90; on the last page the shorter column under half the longer when the longer exceeds 0.125 | FAIL on a tonality run, ADVISORY otherwise | let a list of five or six items break after two; keep short blocks whole; close the column body so the last page balances |
| `heading.wrap` | title, subtitle and headings in the PDF | a line break inside a word (a break at a space, after a dash or slash, or after a number marker is fine) | FAIL | shorten the label until it sits on one line (about 30 Hangul syllables at the h1 size) |
| `title.lines` | the title on the first two pages | more than three lines after the converter has stepped the size down to 14 pt | FAIL | shorten the title and move the rest into the subtitle |
| `folio.total` | a footer reading `n/m` | m differs from the page count and from the count without the cover | FAIL | print the page number alone, or a total that counts the pages the reader holds |
| `sidebar.overlap` | a floating sidebar and the next heading | the heading's line range overlaps the box beside it | FAIL | lengthen the text beside the sidebar, or give the sidebar full width |
| `table.split` | component boxes, captions and data tables | a key-figure, callout or sidebar box across pages; a caption at a page foot with its table on the next page; a table of 0.9 of the frame or less across pages unless the long-table allowance holds | FAIL | lead the table with one sentence, start it at a page top, cut columns to six or fewer, or split it in two captioned tables |
| `figure.split` | a picture and its caption | different pages | FAIL | give the section a lead sentence so both move together, or reduce the figure's height in the source image |
| `component.variety` | component kinds in a document of four pages or more | fewer than two kinds among cover, callout, sidebar, key figures, columns | FAIL on a tonality run, ADVISORY otherwise | plan the components the tonality allows (see the variety section) |
| `cover.block` | filled shapes on a cover page | over 25 % of the page area, tonality run | FAIL | build a typographic cover: left-aligned title, white space, one rule, no colour block |

The long-table allowance (tonality runs only): a table of a header and six or more body rows can
break between rows once when it started in the upper three quarters of the frame and leaves at least
three body rows on each side, header repeated. The publisher path has no allowance.

### Structural checks (run without `--layout` too)

| id | Measures | Threshold | Severity | Source-side fix |
|---|---|---|---|---|
| `heading.declarative` | title, subtitle and every heading | a sentence: a Korean last word ending in 다, 니다, 요, 죠, 었음, 있음, 없음 or a verb stem plus 함 or 됨 (a noun such as 보관함 or 우편함 also matches); an English line with a closing stop, an auxiliary (is, are, will, can ...) or a finite verb after its first word | FAIL (ADVISORY for `--kind manuscript`) | name the topic as a noun phrase and move the claim into the first sentence under it; 분실물 보관함 becomes 분실물 보관함 운영 현황 |
| `heading.order` | heading levels | the first heading deeper than h2, or a step down of more than one level | FAIL | open with `#` or `##` and add the missing level |
| `notice.dash` | the frontmatter `notice:` | a spaced dash or en dash between label and line | FAIL on a tonality run, ADVISORY otherwise | write the label with a colon: `예시 데이터: …`, `Sample memo: …` |

`component.count` is a report field listing counts per kind (cover, callout, sidebar, pullquote,
keyfigures, columns); it raises no finding.

### Restraint checks (read the Word file)

These fail a tonality run and advise on the other paths, except `date.iso`, which holds everywhere.
The converter produces none of these conditions from a clean source, so a failure points to a
hand-edited file, an altered pack or an old source habit.

| id | Measures | Threshold | Source-side fix |
|---|---|---|---|
| `color.accent-kinds` | colours outside the ink | more than one hue (30-degree buckets; greys and tints with every channel from 236 up count as ink), or the accent on more than two element kinds | remove coloured spans and colour attributes; the pack places its one accent |
| `heading.ink` | heading colour | any heading run or style with a hue | remove the colour; levels part by weight and space |
| `heading.ratio` | h1 size over body size | above 1.5 | remove size overrides; the pack ramp (1.2-1.4) sets the steps |
| `table.fill` | table and component shading | a shaded data-table cell, or a callout, sidebar or key-figure tint darker than lightness 95 % | remove cell shading and zebra rows; booktabs has three rules and a bold ink header |
| `component.budget` | component kinds | more than three kinds, more than one key-figure strip, any pull quote, or key figures on a cover | drop the pull quote, merge the second strip, move cover figures into the summary, cut the weakest kind |
| `date.iso` | Korean text | an ISO date such as 2026-10-01 anywhere in the text (frontmatter `title:` and `subtitle:` are not rewritten) | write `2026. 10. 1.` or `2026년 10월 1일` |
| `furniture.chip` | page headers | a coloured or shaded notice in a header | state the sample-data line once in frontmatter `notice:`; it prints under the title block |
| `tonality.structure` | `--compare other.docx` | two tonalities of one source differing in fewer than three of: title block, summary form, numbering, component set, running head, contents | offer the alternative only when the source can carry the difference; measured: a report source in Report and in Brief differs in four features, a memo source in Memo against Report in three, against Brief in two, against Proposal in one |

### Content, prose and design audit (qa_docx.py, no `--layout` needed)

| Finding | Reads | Fix |
|---|---|---|
| unfilled blanks | `[제품명]`-style brackets without a digit, `XXX`, `TBD`, `TODO`, `○○`, `{{…}}`, runs of underscores | write the realistic value and label it as an example |
| missing headings | a source heading absent from the document text | restore the heading in the source |
| frontmatter leak | `---`, `title:` and friends printed as body text | convert with `convert_md_to_docx.py`, which reads frontmatter |
| `rule-05-sentence-variance` | a section of four or more sentences and 80 words whose sentence lengths vary by under 6 words | write one short sentence among the longer ones |
| `rule-22-ko-eomi-repeat` | three or more of 하였다, 되었다, 할 수 있다, 라고 볼 수 있다, 로 판단된다, 임을 확인하였다 in a section | vary the endings and state the fact in the present tense |
| `rule-02-em-dash-cluster` | two em dashes, or a spaced hyphen between words, in prose | replace with a comma, a colon or a new sentence |
| `rule-60-numeric-column-alignment` (OF-302) | a numeric column whose cells are not right-aligned (blocking when explicit, advisory when inherited) | keep numbers one value per cell with a short unit; the converter then right-aligns the column |
| `rule-61-text-measure` (OF-301) | characters per line against a ceiling of 90 Latin or 38 Korean | an advisory that leaves the gate result alone; the 160 mm block at 10.5 pt gives about 43 Korean characters, so the note appears on every Korean A4 document and calls for a look at the pages |
| `rule-30-cjk-font-fallback` | a Hangul run without the Pretendard eastAsia pairing | rebuild through the converter; direct Word edits can drop the pairing |
| `rule-45`, `rule-46`, `rule-55` | highlight, tracked changes or comments, an ASCII `...` | remove them from the source and use `…` |

## Repairing a short page

A page under 0.35, or a run of pages far below the 0.80 median the pack aims at, has one of four
causes. Find which one on the page image and repair that cause.

1. **A large block jumped.** A table, figure or keep-together chain did not fit under the text. Move
   the block to where it starts a page or fits, split a long table at a natural group (region, quarter)
   into two captioned tables, or shorten its cells by moving explanation into the sentence after it.
2. **A part ended early.** The page holds the end of one part and the next part opens with a long
   block. Open the next part with its text and let the block follow.
3. **The content is thin.** A section says two sentences where the reader needs the basis. Add what the
   sources hold: the table behind a claim, the definition a method relies on, a `자료:` line. Filler
   sentences and decorative boxes leave the page shorter in substance.
4. **The density sits below the material.** Raise density one step. This is the last resort.

The median fill is a target for judgement and the gate reports it without failing. Non-final pages
in the tested multi-page documents ran from 0.84 to 1.00.

## Repairing stranded headings, splits and spills

- **Stranded heading.** The converter keeps a heading with its next paragraph, so the finding follows
  a block (table, figure, box) that moved over. Put one or two sentences of text between the heading
  and the block; the claim the heading only names belongs there.
- **Split table.** Lead with one sentence, start the table where a page begins, hold it to six columns,
  put units in the header or the `(단위: …)` line, and split a table longer than a page into two
  captioned tables at a natural group. Each part is measured on its own.
- **Split figure.** A figure too tall for the space left moves to the next page and leaves the caption
  behind, or the reverse. Reduce the picture's height in the source image or place the figure after a
  paragraph that starts a page.
- **Short second page.** A source slightly over one page needs either more content on page 2 or less
  content overall. The cheaper path is a whole extra section with its table; cutting a closing part
  returns the document to one page.
- **Memo spill.** Delete the lines that spill. Density 10 closes the margins by 2 mm in total, less
  than one line, so a cut sentence clears a spill that the dial leaves in place.
- **Title over three lines.** The converter steps the title size down toward 14 pt; a title still over
  three lines at that size needs a shorter wording, with the extra words in the subtitle.
- **Heading wrap.** Korean headings that exceed about 30 syllables at the h1 size wrap in the
  preview, and the preview wraps between syllables. Shorten to a single line.
- **Column bodies (Journal).** Keep the first lines of a part under its heading, hold lists to four
  items or break them after two, and let tables of four or more columns span the page.

## Heading labels and order

Number the outline before writing: `#` parts, `##` sections, `###` items, three levels at most, and
open at `#` or `##`. Leave a paragraph between an h1 and its first h2. Every heading, the title and the
subtitle is a noun phrase (`1년 운영 결과`, `Cost per order by site`); the claim goes in the first
sentence under the heading. A question is allowed when the section answers it. Write headings without
numbers or glyph markers; the pack adds `Ⅰ.`, `1.` and `가.` or `1` and `1.1`. The Roman sequence runs
to Ⅹ, so a Korean Report keeps to ten parts at level one.

| Declarative heading | Label |
|---|---|
| 지연은 대부분 북부 창고에서 발생함 | 창고별 지연 원인 |
| 1년 동안 목표를 달성했다 | 1년 운영 결과 |
| 이상 없음 | 점검 결과 |
| Costs fell at every site | Cost per order by site |
| The plan is on track. | Plan status |

## Component variety and budget

A document of four pages or more needs two kinds among cover, callout, sidebar, key figures and columns,
and no document can use more than three kinds among callout, sidebar, key figures, columns and pull
quote. Each pack's allowed set is fixed (Report: key figures, callout, columns; Brief: callout,
columns; Manual: callout, sidebar, columns; Proposal: key figures, callout, columns; Memo: none;
Journal: callout). The page structure also counts: a Proposal cover, a Manual control block, a Memo
block and a Journal masthead each register as a `cover` kind, so a Manual or a Journal of four pages
reaches two kinds with one callout. A Report has no cover kind and plans a strip or a callout.

The converter enforces the budget when it builds. A component the pack does not allow keeps its content
as ordinary text, with its `title=` as a bold run-in line standing 12 pt below the previous block. The
callouts drawn as boxes number about one per four pages and at least one, and a pack can cap that
(Brief and Proposal draw one); the decision request goes first, then a warning, then a note. A second
key-figure strip prints as a list. A pull quote is left out when it repeats the body and prints as a
plain paragraph otherwise. Columns are drawn only when the parts differ in length by 20 % or less.

Directive syntax and attributes are in `references/components.md`, and the direction step in `references/direction-step.md`
records each component's purpose. Write each planned component with a one-line purpose: the out-of-sequence content it carries (the
decision, the headline numbers with their basis, the definitions). A component with no purpose is worse
than none. A memo and a two-page brief carry no component.

## Numbers on the page

A key figure is set at the h2 size with a label and a basis line, once, in the summary. Table numbers sit
right-aligned with units in the header or the units line and a source line under the table. The
figures in the summary, the strip and the tables agree and are rounded honestly. No figure is enlarged
to fill a page.

## A repair in numbers

A Manual source with a control block, a sidebar, a warning, a numbered list and two tables (supplies,
error codes) ended after the error-code table. Converted, it ran to two pages and page 2 held 0.37 of
its frame.

```text
page.spill  page 2 of 2 is filled to 0.37 of its frame (at least 0.40)
```

The fix adds content the reader needs, not filler: a `# 동작 확인` part (a short test procedure, four
numbered steps and a paragraph on what to do with an error code) and a `# 문의` part (what to send to
support). The second conversion passed with page 2 at 0.73 and no finding other than the OF-301
advisory.

## The repair loop

1. Convert, then run the gate with `--layout`. Note every FAIL by id and page.
2. Open the page image named by each finding with `render_pages.py` or `visual_audit.py`.
3. Pick the matching repair above, edit the Markdown, convert again.
4. Rerun the gate. Stop at a pass, and read the pages once more for what a gate cannot see: an empty
   gap, a heading far from its table, a figure with no sentence pointing at it.
5. Report the result, any residual advisory (the measure note is routine) and the pages inspected.
