# The direction step

A Word document has its shape fixed before the first heading is written. That shape is a tonality:
a pack file `templates/tonalities/<name>.yaml` that sets the type ramp, what stands on page 1, how
the summary is set, how headings are numbered, which page components are allowed, how many callouts
the document can carry and what the running head holds. Six packs ship: Report, Brief, Manual,
Proposal, Memo, Journal. The converter reads the pack as data and merges it over the `korean-generic`
design tree of `templates/registry.yaml`, so a pack states only what differs. A document built
without this step falls back to the plain profile, and the old failure returns: every report, memo
and proposal comes out as the same neutral page.

Tonalities differ in structure. Every pack sets body text and all headings in one near-black ink
(`1A1A1A`), draws booktabs tables, and names at most one accent colour that lands on at most two
element kinds (`accent_on`). Report, Proposal, Brief and Manual carry an accent; Memo and Journal
carry none. A cover colour, a figure tile or a tinted box is outside the pack vocabulary, so the
direction card has no field for one.

The step takes a few minutes of reading. Close the brief, rank the candidates for the document type,
let the outline reorder them, write a direction card, then state the choice and two alternatives in
the reply. The route picks the tonality itself and records it; the user corrects it afterwards.

## 1. Close the brief

Five facts decide the rest. A fact the request leaves open is inferred from its wording and the
source files, and the inference goes on the card where the user can overrule it.

| Fact | What to pin down | Where it lands |
|---|---|---|
| Document type | One row of the table in section 2, or "other, nearest to ..." | candidate order |
| Reader | Who opens the file and what they do next: a director approving a budget, an operator at the machine, a committee reading before a meeting | summary form, component purpose |
| Delivery | Printed and handed out, read on screen, or sent ahead and read alone | page count, density dial |
| Language | Korean, English or mixed | `body_pt_ko` or `body_pt_en`, caption form, callout labels |
| Length | Pages the reader accepts; one or two pages points to Memo or Brief whatever the topic | candidate order, tight spacing |

The converter detects the language from the share of Hangul in the body: above 5 percent is Korean,
above 1 percent is mixed (built as Korean), below that is English. `--locale ko|en|mixed` overrides
the detection when the body is short or code-heavy.

When a fact stays open after reading the source and it changes the direction (a printed handout
versus a screen read moves Brief and Report apart), call `ask_question` with one question, offer the
inferred choice as the recommended default and continue with that default if the question goes
unanswered. A headless run records the default as a `decision` line in
`.litgravity/ledger/<conversation-id>.jsonl` (`{"ts","kind":"decision","text","path"}`) and proceeds. A
bare `lit` request asks nothing and decides with the same ranking.

## 2. Start from the document type

Each type lists two or three candidates in order. The first is the choice when no signal moves it.
The dials are the pack defaults from the yaml files (density, variance).

| Document type | Candidates in order | Dials of the first (density, variance) |
|---|---|---|
| Report, results, analysis (보고서, 결과 보고, 분석) | Report, Brief, Manual | 9, 5 |
| Itemised briefing for a decision maker, one to three pages (개조식, 현황 보고, 검토 보고) | Brief, Memo, Report | 9, 3 |
| Guide, procedure, operating manual, onboarding (가이드, 매뉴얼, 절차서) | Manual, Report, Brief | 9, 6 |
| Proposal, plan, pitch as a document (제안서, 기획서, 계획서) | Proposal, Report, Brief | 8, 6 |
| Memo, notice, letter, one or two pages (메모, 공지, 안내문) | Memo, Brief, Report | 9, 2 |
| Essay, newsletter, white paper, research summary outside a journal | Journal, Report, Proposal | 9, 6 |
| Journal submission, or a publisher named by the user | that publisher profile, no tonality | profile rules |

A Korean report is institute prose by default. Report writes the way a think-tank issue note does:
full sentences in paragraphs, sections numbered Ⅰ. / 1. / 가., tables carrying the evidence. The
government itemised style (□ ○ - lines ending in ~함 or ~임) is a form Brief approximates through
numbered lead sentences; write literal 개조식 lines when the user asks for them in so many words.

## 3. The structure each tonality sets

This table is the content of the choice. Read the row of the chosen tonality before outlining,
because the outline has to fit it: a Brief summary is written as separate paragraphs that each open
with a lead sentence, a Report keeps its decision request in a callout under the summary, a Memo has
no room for any component.

| Tonality | Page 1 | Summary form | Heading numbers | Components allowed | Running head |
|---|---|---|---|---|---|
| Report | `masthead` title block: kind label left and date right on one line, title, subtitle, byline, one accent rule, the notice; contents list from about 5 pages | prose; the key-figure strip goes under its first paragraph | Ⅰ. / 1. / 가. in Korean, 1 / 1.1 in English | keyfigures, callout, columns; callouts about one per 4 pages | footer: short title left, folio right |
| Brief | the same masthead block as Report, with the first `key` callout moved right under it | numbered points ① ② ③ ④, each a bold lead sentence then plain text | none; every h1 sits under a full-width hairline | callout (one at most), columns | footer: folio alone, right |
| Proposal | a cover page in its own section: kind label, title left-aligned about a fifth of the way down, one short accent rule, subtitle, lead; byline, date and notice in the cover footer | prose; one key-figure strip | none | keyfigures, callout (one at most), columns | footer: folio centred, counting from the first body page |
| Manual | title over a document-control table (문서 / 작성 부서 / 기관 / 시행일), the notice; contents list from about 5 pages | prose | 1 / 1.1 / 1.1.1 with a hanging indent, numbered steps | callout, sidebar, columns | header: short title; footer: folio right |
| Memo | no cover: label, the subject as title, To / From / Date / Subject rows between two hairlines, the notice; tight spacing | prose | none | none (a callout prints as a bold lead line) | footer: folio, from page 2 |
| Journal | masthead with authors, affiliations, abstract and keywords, then two columns | prose | 1 / 1.1 so "Section 2.4" resolves | callout (ink rule) | header: short title left, folio right |

Facts that decide edge cases:

- Numbering needs `#` headings for sections. A `##` with no `#` above it stays unnumbered, and
  Brief builds its numbered points from the paragraphs under the first `#` heading.
- A document without a cover page shows no header or footer on page 1, so the Report footer and the
  Memo folio start on page 2.
- The contents list appears when the pack sets `contents: true` (Report, Manual) and the converter
  estimates five pages or more. The estimate counts running characters plus about one line per table
  row against 1500 characters a Korean page or 3300 an English page.
- The running head holds the short title and the folio. The `section` item (a STYLEREF field) exists
  in the engine, and no shipped pack uses it, because it shows the first section starting on the
  page and not the one the page opens in.
- A source estimated at one page or less is set with tight spacing in any tonality, and the converter
  prints a note when it does.

Two tonalities built from one source differ in at least three of these features. The direction
strip in section 8 shows that difference, and `qa_docx.py a.docx --compare b.docx` proves it through
the `tonality.structure` check, which compares title block, summary form, numbering, component set,
running head and contents list.

## 4. Let the outline reorder the candidates

Draft the outline first: headings, which sections carry a table, a warning, a list of steps, key
figures. Count on the outline. A signal moves a candidate inside its row; it brings in no tonality
from outside the row. Apply the signals in this order and keep the table order on a tie, so one
source always gives one choice.

| Signal | When it fires | Effect |
|---|---|---|
| The user names a tonality, or picked one earlier in the conversation | always | use it and still write the card |
| Tables make up 30 percent or more of the body blocks, or there are four or more tables | counted on the outline | Report or Manual to the front |
| Three or more images | counted | Proposal or Journal to the front |
| Under about 900 words, or the brief says one or two pages | counted or stated | Memo or Brief to the front |
| English long-form prose with at most one table per three pages | counted | Journal to the front |
| Numbered procedures, or three or more warnings | counted | Manual to the front |
| The document asks the reader for a decision (승인 요청, 결정 사항) | stated in the source | Brief or Proposal up one place; plan a `key` callout for the request |
| A pack lacks a component the outline needs: only Manual has a sidebar; Brief and Memo have no key figures; Memo has no components; Journal has callouts only | any section | move that pack down, or write the content as ordinary text and say so on the card |

A worked case. The request is a six-page Korean review of a laundry-service delivery pilot with five
tables and an approval request at the end (an invented example). The type row gives Report, Brief,
Manual. Five tables fire the table signal, which keeps Report first. The approval request would lift
Brief one place, and it is already second. Report stays; Brief and Manual are the alternatives, and
the card says Brief fits better when the director reads only page one.

A second case. A two-page English notice about a library's reading-room hours (an invented example).
The type row gives Memo first. Fewer than 900 words fires the length signal, which confirms Memo. No
table, no decision: Memo, with Brief and Report as alternatives.

## 5. Write the direction card

The card records the decision. It goes in the build log and a summary of it goes in the reply. Fill
every field; a build that cannot name the tonality and the reason stops until it can.

| Field | Content |
|---|---|
| Document type | the row from section 2 and the expected page count |
| Reader | who, doing what with the file, printed or on screen |
| Tonality | the choice, plus two alternatives in order |
| Reason | the signals that fired, with the counts (5 tables in 14 blocks) |
| Dials | density and variance, with any move from the pack default |
| Page 1 | the title block the pack draws and the frontmatter keys feeding it |
| Headings | numbering scheme and the noun-phrase rule |
| Components | one line per planned component: kind, where, and its purpose |
| Left out | components considered and dropped, with the pack reason |
| Cover variant and heading treatment | the `::: cover` variant and kicker, or "frontmatter only"; the heading numbering the pack applies |
| Fonts | Pretendard unless the user or a template says otherwise |
| Wrong if | the observation that would show the direction was mis-chosen |

The cover variant is a label. `typographic`, `band`, `split` and `masthead` all convert, and every
tonality draws its own title block whichever value is written, so one source converts under any
pack. Write `variant=typographic` and a `kicker` (현안 분석, 검토 보고, 공지, Issue note).

Each planned component carries a one-line purpose: the out-of-sequence content it holds, which a
reader needs and which has no place in the running text at that point. A decision request the
director finds without reading, a warning the operator sees before the step, the three numbers the
summary rests on. A component without a purpose is left out of the card and the source; "breaks up
the page" and "adds interest" are decoration and fail the test.

```text
Direction card
  Document type     report (결과 보고), 6 pages expected
  Reader            logistics director and two area managers, printed for the monthly review
  Tonality          Report   alternatives: Brief, Manual
  Reason            5 tables in 14 body blocks (36 %); one approval request at the end
  Signals fired     table share, decision request
  Dials             density 9, variance 5 (pack defaults)
  Page 1            masthead block (kind label + date, title, subtitle, byline, one rule, notice once)
  Cover             ::: cover variant=typographic kicker="결과 보고"; title and byline from frontmatter
  Headings          Ⅰ. / 1. / 가. from # and ## levels, ink, weight and space only; noun phrases
  Components        keyfigures (summary)   the three results the summary rests on, each with a basis line
                    callout key            the 2.1억 원 approval request, findable without reading
  Left out          sidebar of terms (Report has none; definitions go in the method paragraph)
  Fonts             Pretendard (pack default)
  Wrong if          the director reads only page 1; Brief's conclusion-first points would serve better
```

The "wrong if" line is checked first in review. When it proves true the document is rebuilt under
the alternative it names and the card is updated.

## 6. The budget, the notice and the dials

**Component budget.** The converter enforces these limits whatever the pack allows, and the gate
check `component.budget` fails a document past them. The card stays inside them from the start.

- Three component kinds at most per document (callout, sidebar, keyfigures, columns), admitted in
  order of first appearance. A fourth kind prints as ordinary text.
- One key-figure strip, in the summary, with three or four comparable metrics each carrying a label
  and a basis line. Figures written inside a `::: cover` move to the summary in a pack that has key
  figures, and a pack without them (Brief, Manual, Memo, Journal) prints a note and keeps the numbers
  in the summary text, so that text must state them.
- Callouts: `max(1, round(pages / 4))` boxes, capped by the pack (`callout_max: 1` in Brief and
  Proposal). The boxes go to `key` callouts first, then `warning`, then `note`, in source order inside
  a kind; the rest print as text under a bold lead line.
- Pull quotes are off in every tonality. A pull quote that repeats a body sentence is dropped with a
  note, and a pull quote with new text stays as an ordinary paragraph.
- A sidebar belongs to Manual, beside enough text to float or full width.
- `::: columns` earns its place when the parts are within 20 percent of each other in length; unequal
  parts are read in sequence as ordinary text.

**The notice.** The frontmatter `notice:` (the sample-data or confidentiality line) prints once, in
small muted ink under the title block, or in the footer of a Proposal cover page. Write it as a label
with a colon (`예시 데이터: 수치는 가정입니다`); a spaced dash fails `notice.dash`. The body and the page
header leave it out. The plain profile and the publisher profiles differ: they repeat the notice as a
tag in every header, so a sample document cannot pass for a sourced one on any printed page.

**Dials.** Density (1 to 10) sets the page margins, the body size and the line pitch; variance
(1 to 10) records how many component kinds and table styles the author mixes inside the budget.

| Density | Margins top / bottom / sides (mm) |
|---|---|
| 1 to 2 | 30 / 32 / 30 |
| 3 to 4 | 28 / 30 / 28 |
| 5 to 6 | 27 / 29 / 27 |
| 7 to 8 | 26 / 28 / 26 |
| 9 | 25 / 27 / 25 |
| 10 | 24 / 26 / 25 |

The line pitch (the body leading as a multiple of the type size) is 185 percent in Korean and 140
percent in English at density 4 or lower, 180 and 137 percent at 5 to 7, and 175 and 133 percent
at 8 to 10. A density of 3 or lower adds 0.5 pt to the pack body size. A Memo, and any source under
about one page, uses tight spacing: 165 percent in Korean and 120 percent in English.

Sides stay at 25 mm or wider and the body stays at 10.5 pt or larger. The converter validates both
dials as integers from 1 to 10 and prints them in its status line; only density moves the page, and
the component budget is fixed. The route may move either dial by up to 2 from the pack default
without asking and says so on the card. A larger move needs the user's word. Dials go in the
frontmatter (`density:`, `variance:`) or on the command line (`--density`, `--variance`); the command
line wins.

## 7. Four rules every card carries

These come from the user and bind every tonality. The card names them so the build cannot drift.

1. **Headings, title and subtitle are noun-phrase labels.** "1년 운영 결과", "Commissioning
   checklist". The claim goes in the first sentence under the heading. The gate check
   `heading.declarative` fails a title, subtitle, heading or component title that reads as a sentence
   (a Korean predicate ending, an English auxiliary or finite verb such as "fell" or "grew"); reword the
   label and leave the gate alone.
2. **Honest numbers.** Every figure traces to a source, is rounded honestly and agrees across the
   summary, the key figures and the tables. A key figure is set one step above the body (the h2
   size) with a label and a basis line, the period and the source, written as an indented list item.
   Invented figures carry (예시) or (sample).
3. **Pretendard by default.** Every pack declares Pretendard for Latin and Hangul in the document
   defaults, styles and theme. Journal keeps Times New Roman for Latin body text only. Another face
   comes only from the user or from a template.
4. **Dense pages.** Body pages carry information to the foot: the gate `fill.page` fails a body page
   filled under 0.35 of its frame, and the QA JSON reports `fill_median` for the body pages, where a median around 0.80 is the working target. Density comes from the
   measure, the leading and sections that carry their tables, with type held at 10.5 pt or larger,
   margins at 25 mm on the sides and boxes holding short text. An airy page is built when the user
   asks for one.

## 8. The direction strip

When the user asks to compare looks, or the brief leaves the look open ("어떤 느낌이 좋을지
모르겠다", "show me a few options"), convert one source under the chosen tonality and the two
alternatives, render the first three pages of each and show three labelled rows before writing the
rest. The text is identical in every row; only `tonality:` changes. The user's pick replaces the
reason on the card ("chosen by the user from the strip"). Offer the strip through `ask_question` with
the first candidate as the recommended default; a headless run builds the default and records the
choice as a `decision` line.

```sh
SKILL_ROOT="<directory of this SKILL.md>"
for t in Report Brief Manual; do
  sed "s/^tonality: .*/tonality: $t/" strip.md > "strip-$t.md"
  python3 "$SKILL_ROOT/scripts/convert_md_to_docx.py" "strip-$t.md" "strip-$t.docx"
  python3 "$SKILL_ROOT/scripts/visual_audit.py" "strip-$t.docx" --out-dir "strip-$t" --pages 3
done
python3 "$SKILL_ROOT/scripts/qa_docx.py" strip-Report.docx --source strip-Report.md --compare strip-Brief.docx
```

The rows differ in what stands on page 1, how the summary reads, how headings are numbered and what
runs at the foot. A `--compare` run that fails `tonality.structure` means two rows look alike apart
from a rule colour, and the strip is not worth showing. A component the pack lacks prints as text in
that row, and the row shows how the pack handles it. The converter is silent about directives it
keeps as text; `output.components` in the `qa_docx.py` JSON counts what the pack drew (callout,
sidebar, keyfigures, columns), and that count is the check for a component that went missing.

## 9. Publisher and template paths skip the tonalities

A named publisher is a request for a journal profile. When the user names Elsevier, ACS, IEEE, Nature
or `korean-generic`, or the document is a manuscript for submission, convert with `--publisher <name>`
and no tonality. The converter refuses the pair in three forms: `--publisher` with `--tonality`,
`--publisher` with `--template`, and a source whose frontmatter carries `tonality:` converted with
`--publisher`. The comparison of the profiles is in `references/journal_style_spec.md`, and the
frontmatter they read is in `references/frontmatter_schema.md`.

`--template <file.docx>` is the user's Word file used as the base document. The build restyles the
core styles and the page of the profile it applies, and everything else in the file stays, including
any sample text in its body: the bundled publisher sample files open with a placeholder title block,
and a conversion over one of them prints that block first. Use a template with an empty body, and
tell the user that the heading and table look come from the tonality or plain profile when the house
template is a styling request.

In both paths the card is still written, with "Tonality: none (publisher elsevier)" or "none
(template)". The reply mentions that a tonality (name the closest one) is available when the file is
not bound for the journal or the house template.

## 10. Say it and record it

The reply names the tonality, the reason and two alternatives in plain words, one sentence each, next
to the delivered files. For example: "Report 방향으로 만들었습니다. 표가 본문의 3분의 1이 넘고 마지막에
승인 요청이 있어서입니다. 첫 장만 읽힐 문서라면 Brief, 절차 안내가 중심이면 Manual도 맞습니다." The
reader gets the choice and the way to change it; the audit trail stays in the build log.

Write the build log beside the source. It holds the card, the converter's status line and notes (a
key-figure strip that moved from the cover, a pull quote left out, a source set with tight spacing),
the `qa_docx.py` result and the pages looked at. It is working evidence and stays out of the
document.

```text
<name>.md          the source, with tonality: (and any dials) in its frontmatter
<name>.build.md    the direction card, converter notes, qa_docx result, pages looked at
<name>.docx        the converted document
```

## 11. Failure patterns

| Pattern | Fix |
|---|---|
| Choosing by topic alone ("a factory, so Manual") without counting the outline | count tables, images, warnings and words, then apply section 4 |
| No tonality and no publisher on a document that is not a manuscript | the plain profile is a fallback; rerun the step and pick a pack |
| A reply with one direction and no alternatives | add the two alternatives in order |
| A reason that restates the document type | name the signals that fired and their counts |
| A style question under a bare `lit` request | decide with the ranking and mention the alternatives |
| A dial moved by 3 or more without the user's word | return to the pack default or ask once with a default |
| Headings written as conclusions, a key figure without a basis line | rewrite as noun phrases; add the period and the source |
| A component on the card with no purpose, a pull quote, a sidebar outside Manual, key figures on the cover or a second strip | drop it or give it a purpose; read `output.components` after the build |
| Choosing a tonality for its colour, or asking for a coloured cover, band or figure tiles | pick on structure; the packs draw none of those |
| A Korean report written as literal 개조식 lines because the language is Korean | Report is institute prose; Brief serves itemised readers; literal 개조식 comes on request |
| The notice repeated in the body or a header | print it once through frontmatter `notice:` |
| `--publisher` with a tonality, or a tonality forced onto a journal manuscript | choose one path; the converter stops on the pair |
| A tonality swapped after the build without updating the card and the reply | rebuild, update the card, restate the choice |
| `##` sections with no `#` above and an expectation of numbers | open sections with `#` so the numbering and Brief's points attach |

## The example library

`references/examples/` holds nine worked sources that convert and pass the gate, written with invented organisations and labelled as example data: `01-report-ko.md` and `07-report-en.md` (Report), `02-brief-ko.md` (Brief), `03-manual-ko.md` (Manual), `04-proposal-ko.md` and `08-proposal-en.md` (Proposal), `05-memo-en.md` and `09-memo-ko.md` (Memo), `06-journal-en.md` (Journal). Open the one whose tonality and language match the card before writing the source: its frontmatter, component placement and table captions show the shape the converter and the gate expect. Copy one into the working folder to see the conversion first (`python3 "$SKILL_ROOT/scripts/convert_md_to_docx.py" 01-report-ko.md out.docx`).
