# Page components

The converter reads six fenced directives in the Markdown source and turns each into real Word
structure: a title block or cover page, a ruled one-cell table, a row of figures, a column section.
A pre-pass splits the directives out before Markdown is rendered, so no fence reaches the page. An
unknown name, an unknown attribute, an unclosed fence or a stray closing fence stops the build with an
`Error:` line. This file is the contract for each directive: syntax, what it draws, which tonalities
use it, and how it goes wrong.

Components carry content that plain paragraphs carry badly: a decision that must be found without
reading, a warning placed before the step it protects, a definition beside the text, three
comparable numbers that set the scale of a summary, two options of equal weight read side by side.
Every component on the direction card has a one-line purpose ("callout key: the approval request for
the August meeting"), and the budget below keeps them scarce.

## Grammar

```text
::: <name> [<positional>] [<key>=<value> ...]
<Markdown: paragraphs, lists, tables, nested directives where allowed>
:::
```

- The opening line starts in column 0: three or more colons, a space, the name. The block closes at
  the next line made only of the same number of colons.
- A nested directive takes a shorter fence than its container. Key figures inside a cover are written
  with `:::::` outside and `::::` inside (any longer outer fence works). Equal fences close early, and
  the inner closing line then leaves a stray closing fence, which is an error.
- Values are bare tokens (`kind=warning`, `cols=3`, `gap=8`; letters, digits, `_ . % -`) or double
  quoted strings (`title="비용 가정"`, with `\"` as the only escape). Keys are lower case, each key at
  most once, and only the keys of the table below.
- Fences inside fenced code blocks are text, so a document can show a directive as an example.
- `<!-- column-break -->` on its own line is valid inside `::: columns` only.
- Names: `cover`, `callout`, `sidebar`, `pullquote`, `keyfigures`, `columns`.
- Line numbers in error messages count from the first line after the frontmatter's closing `---`.

| Directive | Positional | Keys |
|---|---|---|
| `cover` | none | `variant`, `kicker`, `image` |
| `callout` | none | `kind` (`note`, `key`, `warning`; required when drawn), `title` |
| `sidebar` | none | `title`, `width` (`third` or `half`), `float` (`right`, `left`, `none`) |
| `pullquote` | none | `cite` |
| `keyfigures` | none | `cols` (1 to 4) |
| `columns` | `1`, `2` or `3` | `gap` (mm), `rule` (`true`) |

## The component budget

Three rules hold in every tonality run, and the gate check `component.budget` fails a document that
breaks them:

- Three component kinds at most per document (callout, sidebar, keyfigures, columns), beyond
  headings, paragraphs, lists, tables and figures. Kinds are admitted in order of first appearance;
  a fourth kind prints as text.
- One key-figure strip, in the summary only.
- No pull quote.

On top of that, each pack names the kinds it uses (`components.allowed`), and callouts are rationed by
length. A directive the pack lacks, or one past the budget, keeps its content as ordinary text and its
`title` as a bold lead line. The converter is quiet about this: the status line and its `Note:` lines
cover a key-figure strip moved off a cover, a pull quote left out, a table style drawn as booktabs and
a source set with tight spacing. The record of what a pack drew is the `output.components` object in
the `qa_docx.py` JSON (`callout`, `sidebar`, `pullquote`, `keyfigures`, `columns`, `cover`), so read
it after every build and compare it with the card. A component the card planned and the count lacks
was kept as text.

The gate check `component.variety` fails a tonality document of four or more pages that shows fewer
than two component kinds. Memo uses none and Journal one, so a long Memo or Journal that trips the
check is usually in the wrong tonality; move to Report or Brief before adding a component without a
purpose.

## Who uses what

| Tonality | Kinds it draws (`components.allowed`) | Callouts | Key figures |
|---|---|---|---|
| Report | keyfigures, callout, columns | `max(1, round(pages / 4))` | one strip, in the summary |
| Brief | callout, columns | one at most, moved under the title block | printed as text |
| Proposal | keyfigures, callout, columns | one at most | one strip, in the summary |
| Manual | callout, sidebar, columns | `max(1, round(pages / 4))`, one style | printed as text |
| Memo | none | none (a bold lead line) | printed as text |
| Journal | callout | `max(1, round(pages / 4))`, ink rule | printed as text |
| plain (no tonality) | every kind except pullquote | every callout | as written |

The page estimate counts running characters plus about one line per table row, against 1500
characters a Korean page or 3300 an English page. A one-page source therefore gets one callout box,
a six-page source gets two.

## `::: cover`

```markdown
:::::  cover variant=typographic kicker="사업 제안서"
한두 문장의 리드 문단.
:::::
```

- `variant` is `typographic`, `band`, `split` or `masthead`; `kicker` is the small label of the
  title block (현안 분석, 검토 보고, 공지, Issue note). `image=` parses and draws nothing.
- The directive stands first in the document, before any other block. Title, subtitle, author,
  organization, date and notice come from the frontmatter; a cover with no `title:` is an error. A
  source with frontmatter `title:` and no `::: cover` still gets its title block, without a kicker.
- The variant is a label. Every value converts, and each tonality draws its own typographic title
  block, so one source converts under any pack: Report and Brief a masthead (kicker left and date
  right on one line, title, subtitle, byline, one rule); Manual the title over a document-control
  table; Memo a label, the subject and To / From / Date / Subject rows; Journal a masthead with
  affiliations, abstract and keywords; Proposal a cover page with the title left-aligned in the upper
  part, one short rule and the byline, date and notice in the footer of that page. No colour block,
  no full-bleed field and no figures appear on any of them; `cover.block` fails a cover whose filled
  shapes cover more than a quarter of the page.
- The block holds an optional lead paragraph and an optional nested `keyfigures` strip. In a Memo the
  lead holds the rows, written `Key: value · Key: value` with the keys To, From, Date, Subject, Cc
  (받는 사람, 보내는 사람, 날짜, 제목, 참조 in Korean). The Memo adds a Date row from the frontmatter after
  the From row when none is written. In other tonalities such rows print as one bold-labelled line.
- Key figures never stay on a cover. In Report and Proposal the strip moves to just after the first
  paragraph of the first section. In Brief, Manual, Memo and Journal the converter prints a note
  (`<name> sets no key figures; the cover's figures stay in the summary text`) and drops the strip, so
  the summary paragraph must state those numbers.
- The frontmatter `notice:` prints once in small muted ink under the title block (Proposal: in the
  cover footer). It stays out of page headers, and a Korean document's date prints as `2026. 7. 3.`
  from `2026-07-03`.

## `::: callout kind=<note|key|warning> [title="..."]`

A one-cell table across its container, ruled like a booktabs table: a 0.75 pt rule above and a 0.5 pt
rule below in the pack's accent (Journal: ink), no side stripe, no fill, a bold title line at body
size, then the content. The default titles are 참고 / 핵심 / 주의 in Korean and Note / Key point /
Warning in English. The cell does not split across pages and keeps together with its lines.

```markdown
::: callout kind=key title="승인 요청"
8월 회의에서 하반기 확대 예산 2.1억 원의 승인을 요청합니다.
:::
```

When the source holds more callouts than the budget, the boxes go to `key` first, then `warning`, then
`note`, in source order inside a kind. The others print as text under a bold lead line. In Brief the
first `key` callout is moved to the top of the body, right under the title block, which is how its
conclusion comes first.

Choose the kind by what the reader must do. `key` is the decision or the request. `warning` is a risk
tied to an action, placed before the step it protects. `note` is a definition or an assumption that
sits outside the line of argument. The content is paragraphs, a short list or one small table. A
callout frames out-of-sequence content only; a box inside a box is invalid. The title follows the
noun-phrase rule of headings ("승인 요청", "Warning before step 4"); `heading.declarative` checks it.

## `::: sidebar [title="..."] [width=third|half] [float=right|left|none]`

Manual draws sidebars; every other tonality keeps the content as text with the title as a bold lead
line. A one-cell table with a hairline down its left side in the accent, no fill, text at the table
size (9.5 pt). It floats right at about a third of the width beside the paragraphs it explains
(`width=half` and `float=left|none` change that); in a column body it stays in the flow. When the
paragraphs between the box and the next heading are shorter than the box, the converter sets it full
width under them, so the next heading starts below it (gate check `sidebar.overlap`). Use it
for terms, a method note or a short precedent, and keep it shorter than the text beside it.

```markdown
::: sidebar title="용어"
당일 배송률은 접수 당일 배송이 끝난 건의 비율입니다.
:::
```

## `::: pullquote [cite="..."]`

Pull quotes are off in every tonality. The directive still parses. A pull quote that repeats a
sentence already in the body is dropped with a note (`line N: the pull quote repeats the body and is
left out`). One that says something else stays in the document as an ordinary paragraph, because the
body would otherwise lose that content. The gate fails any pull quote style that reaches the page.
Write the sentence into the body where it belongs and delete the directive.

## `::: keyfigures [cols=1|2|3|4]`

```markdown
::: keyfigures cols=3
- **+12%** 수거 처리량 (예시)
  - 2026년 2분기, 전년 동기 대비
- **96.4%** 당일 배송률 (예시)
  - 2026년 6월, 배차 기록
- **3.1억 원** 2분기 운영비 (예시)
  - 2026년 4-6월 합계, 내부 결산
:::
```

One list of one to eight items. Each item is `**<figure>** <label>`, and the figure contains a digit;
an indented item under it is a basis line (period, scope, source). A line that is not a list item, or
a figure without a digit, stops the build. The strip is a borderless row, each cell under an ink
hairline: the figure bold in ink at the h2 size, the label at the table size, the basis in muted ink
at the note size. Columns come from `cols=`, then the pack's `per_row` (3 in Report and Proposal),
with a maximum of 4; items beyond the columns wrap to further rows, and a row of figures stays on one page.

Report and Proposal draw one strip per document, in the summary. Write it after the summary's first
paragraph; a strip written inside the cover is moved there. A second strip, or any strip in a pack
without key figures, prints as a plain list with the basis in brackets: `- **+12%** 수거 처리량 (예시,
2026년 2분기, 전년 동기 대비)`. Three or four real, comparable metrics make a strip. A non-metric
("고객 만족 향상") or a figure without a basis belongs in the text. Example values say (예시) or
(sample) in the label, and every number is rounded honestly.

## `::: columns <1|2|3> [gap=<mm>] [rule=true]`

The content becomes its own section with that many columns, opened and closed by continuous section
breaks. `<!-- column-break -->` ends a part early, which is how two options are set side by side:
each part goes into its own cell of one borderless row, tops aligned. `gap` defaults to the pack's
column gap (6 mm); `rule=true` draws a hairline between the parts. The directive stands at the top
level, and a `columns` inside a callout or sidebar is an error.

```markdown
::: columns 2
**방안 가.** 기존 차량 세 대를 유지하고 배차 시간을 조정합니다.
<!-- column-break -->
**방안 나.** 소형 차량 한 대를 추가하고 구역을 다시 나눕니다.
:::
```

Parts are set side by side when their lengths (spaces and Markdown marks removed) are within 20
percent of each other; otherwise the block prints in sequence as ordinary text, because one long
column beside three lines leaves a hole on the page. Report, Brief, Proposal and Manual draw columns.
Journal, which is already two columns, and Memo print them as text. A table wider than three columns
inside a column body spans the page width together with its caption and its source lines.

## Table captions, styles and notes

Every tonality draws booktabs tables: a 1 pt rule above and below, 0.5 pt under the header, no
vertical rules, no fills, no banding. The header is bold ink, numeric columns are right-aligned in
tabular figures (clock times count as numbers), negative values take the true minus sign, and no
column is narrower than its longest word. Table text is 9.5 pt at a 140 percent pitch. A last row
whose first cell is 합계, 총계, 소계, 계, Total or Sum is set bold under a 0.5 pt rule.

A caption is the paragraph right before a table that starts with `표 <n>.` or `Table <n>.`. A
trailing `{style=booktabs|banded|light-grid|header-fill}` is accepted and removed, and every
tonality draws booktabs; the converter prints a note for any other value.

```markdown
표 1. 구역별 처리량

| 구역 | 1분기 (건) | 2분기 (건) |
|---|---:|---:|
| 가 | 1,200 | 1,350 |
| 합계 | 2,180 | 2,450 |

주: 2분기는 잠정치입니다.

자료: 배차 기록
```

Korean documents print this as `<표 1> 구역별 처리량` with the label bold above the table. When every
header cell after the first carries the same bracketed unit, the unit leaves the headers and appears
once as a right-aligned `(단위: 건)` line above the table. Under the table, notes (`주:` lines) come
first and the origin line follows as `자료:`; a line written `출처:` is rewritten `자료:`. An image whose
alt text reads `그림 1. 배차 흐름` prints below the picture as `[그림 1] 배차 흐름`.

English documents print `Table 1.` above the table and `Figure 1.` below the figure with the label
bold, and keep `Note:` and `Source:` lines under the table.

A paragraph that opens with `출처:`, `자료:`, `주:`, `Source:`, `Sources:`, `Note:` or `Notes:` takes
the `Source Note` style (note size, muted ink); put one under every table and figure that holds data.
A table that fits keeps its rows on one page (`table.split`). A long table (a header and six or more
body rows) may break between rows with the header repeated and at least three body rows on each
side. The text under a table stands 8 pt clear, a `주:` or `자료:` line 3 pt.

## Errors the converter raises

| Message starts with | Cause | Fix |
|---|---|---|
| `unknown directive ::: x` | a name outside the six | use a listed name or write plain Markdown |
| `::: callout has no attribute colour` | a key outside the table above | remove the key; colour is chosen by the pack |
| `::: callout needs kind=` | missing or unknown `kind` on a drawn callout | `note`, `key` or `warning` |
| `::: x is never closed` | the closing line is missing, or shorter than the opening fence | add a line of the same colon count |
| `a closing fence with no directive open` | equal fences on nested blocks | lengthen the outer fence |
| `::: cover stands first` | a cover after other content | move it to the top or delete it |
| `a cover takes its title from frontmatter` | `::: cover` with no `title:` | add the title to the frontmatter |
| `<!-- column-break --> stands only inside ::: columns` | a break outside a columns block | delete it or wrap the parts |
| `::: columns stands at the top level only` | columns inside a callout or sidebar | lift the block out |
| `::: columns takes 1, 2 or 3` | another count | choose 1, 2 or 3 |
| `a key figure is ...` | an item without `**figure**` and a digit | rewrite the item or use plain text |
| `::: keyfigures takes 1 to 8 items` | an empty strip or more than eight items | trim to the comparable metrics |
| `{style=x}: table styles are ...` | an unknown table style | use a listed value or drop the attribute |

## Misuse

- A component used to fill a page or decorate a paragraph; page fill comes from content and from the
  density dial.
- A fourth component kind, a second key-figure strip or a pull quote; each prints as text or is left
  out, so read `output.components` and the pages.
- A component on the direction card without a purpose line.
- Key figures without basis lines, or with adjectives where numbers belong ("대폭 개선").
- A sidebar outside Manual, or a sidebar holding steps the reader follows in order.
- A `columns` block holding one long part and one line; balance the parts or write them in sequence.
- Nested directives with equal fences.
- Component titles written as sentences; they follow the noun-phrase rule of headings, the title and
  the subtitle (`heading.declarative`).
