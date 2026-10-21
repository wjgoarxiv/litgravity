# Report

Report is the working document of an organisation: a periodic result, a project report, an analysis that
a manager reads at a desk and returns to. Its Korean default is institute prose, the manner of a
central-bank or think-tank issue note: full paragraphs that argue from evidence, numbered parts a reader
can cite, and tables that carry the numbers. The page is quiet by design. Every heading is set in the
body ink and stands out through weight and the space above it; one navy rule under the title block and
the two rules of the decision box are the only colour. A report looks finished through its structure:
a clear first page, honest tables and parts that can be cited by number.

## Choose it, or choose another

Choose Report for results reports (분기 실적, 사업 결과), project close-outs, analyses with tables and
figures, audit and review reports and research notes for management, at four to thirty pages, read part
by part. Move it up the list when tables make up more than a third of the blocks or the source holds
four tables or more. Korean and English use the same pack; numbering, captions and leading follow the
language.

| Source | Better tonality |
|---|---|
| a one-to-three page paper whose reader decides and stops | Brief (decision first, numbered points) |
| a notice, memo or letter of two pages or fewer | Memo |
| a procedure with warnings and a document-control block | Manual |
| long continuous reading with few tables | Journal (two columns hold the measure) |
| a request for money with a budget and schedule | Proposal |
| itemised lines in 개조식 (□ ○ - with 함/임 endings) | Brief, with the lines written by hand when the user asks |
| a journal submission | a named publisher profile; a tonality does not stand in for one |

## Tokens

Values at the pack default (density 9, variance 5) from `templates/tonalities/report.yaml`, with the
derived sizes computed by `scripts/docx_design.py`.

| Token | Value |
|---|---|
| Page | A4; margins 25 / 27 / 25 / 25 mm; text block 160 mm |
| Body | Pretendard 10.5 pt; Korean justified, English ragged right |
| Pitch | Hangul 175 % (Word multiple 1.14), Latin 133 % (0.87) |
| Paragraph space | 6 pt after (5 pt English), no indent |
| Scale | h1 14.5 pt (1.4), h2 12.5 pt (1.2), h3 10.5 pt bold; title 26.5 pt (2.5) |
| Heading space | h1 22 / 9 pt, h2 15 / 6 pt; no rule under a heading |
| Ink | body and headings `1A1A1A`, muted `555555` (subtitle, captions, notes, running head), rules `8C8C8C` |
| Accent | navy `1F3A5F`, on the title rule and the callout rule only |
| Tables | booktabs, 9.5 pt at 140 % pitch, bold header, right-aligned numbers |
| Key figure | 12.5 pt bold ink over an ink hairline, label 9.5 pt, basis in muted 9 pt |
| Running head | footer: short title left, folio right, 8.5 pt muted; none on page 1 |
| Components | key figures (3 per row, up to 4), callout, columns |
| Figures | at most 0.45 of the frame height |

## Page one

Page 1 opens with a title block above the body and has no cover page. The first line carries the kind
label on the left (the `kicker=` of `::: cover`, for example `분기 보고` or `Issue note`) and the date on
the right (`2026. 7. 3.`, rewritten from the frontmatter date). Under it come the title, the subtitle in
muted ink at the h2 size, the byline (author, organisation), one navy rule and the frontmatter
`notice:` once in small muted type. The summary starts on the same page. A `variant=` on the cover is
accepted and ignored: Report sets this one typographic block. Write the cover directive with an empty
body; text inside it renders as an opening paragraph under the title block.

When the converter's own estimate reaches five pages (1,500 Korean characters or 3,300 Latin characters
per page, plus a row allowance for tables), a contents list of the h1 parts with dotted leaders and
page fields stands under the title block. The estimate runs well below the rendered count: a source
estimated at 4.0 rendered at 7 pages without contents, and one estimated at 5.9 rendered at 11 pages
with it. Expect the list from about nine rendered pages.

## Summary

`# 요약` or `# Summary` as running prose. The first paragraph states the result in two to four
sentences. The single key-figure strip follows that paragraph, then the decision box when the report
asks for a decision; key figures written inside the cover directive move to this spot. The summary is
the section a reader quotes, so every number in it also stands in a table further down with the same
rounding.

## Numbering, headings and running head

Korean parts are numbered `Ⅰ.` (h1), `1.` (h2) and `가.` (h3) in plain ink at the heading size, with one
space after the numeral; English parts use `1`, `1.1`. Write headings without numbers, because the
engine adds them and a typed number doubles the sequence. The Roman series ends at Ⅹ, so keep Korean h1
parts to ten. Back-matter headings (참고 문헌, References, 감사의 글) stay unnumbered.

The footer carries the short title (frontmatter `short_title:`, else the title cut at 40 characters on a
word boundary) on the left and the folio on the right, from page 2. The header stays empty and the
notice prints once on page 1.

Evidence sits in booktabs tables with `<표 n>` captions, a `(단위: …)` line when every unit-bearing header
shares one unit, then `주:` and `자료:` lines under the table. A part usually holds a table, the
sentence that reads it and a short analysis. A follow-up part (`# 향후 과제`, `# Next steps`) can close
the report with a table of owner, action and date.

## Components and budget

| Kind | Purpose on the direction card | Budget |
|---|---|---|
| `keyfigures` | the scale of the result, before the argument | one strip of three or four comparable figures, in the summary |
| `callout` | the decision request, then a warning, then a note | about one per four pages, at least one |
| `columns` | two options or two effects of nearly equal length | parts within 20 % of each other's length |

Three kinds is the ceiling for the whole document. A component without a purpose line is left out.

## Dials

Density moves margins and pitch together. Density 10 closes the margins to 24 / 26 / 25 / 25 mm, which
helps a report a few lines over its limit. Density 7 gives 26 / 28 / 26 / 26 mm and a Hangul pitch of
180 %; density 6 gives 27 / 29 / 27 / 27 mm. Body type stays at 10.5 pt down to density 4 and rises by
half a point at density 3 and below. Variance is recorded in the conversion line and changes nothing on
the page.

## Korean and English

Korean body text is justified with Hangul line breaks between words in Word; the soffice preview breaks
between syllables. Captions take the form `<표 1> 제목` with a bold label, `출처:` is rewritten `자료:`
and ISO dates become `2026. 7. 3.`. English text is ragged right, captions read `Table 1.` with a bold
label, the unit stays in the header, dates read `3 July 2026`, and bullets are round. Korean institute
prose states facts in the plain `-다` form; vary the endings, because three or more of 하였다, 되었다 and
할 수 있다 in one section trip `rule-22-ko-eomi-repeat`.

## Worked source

The fragment converted and passed `qa_docx.py --layout --kind report` on a tonality run, on one page, with
only the OF-301 measure advisory.

```markdown
---
title: 2026년 2분기 도서관 운영 결과
subtitle: 열람 서비스와 야간 개관 시범 운영 분석
author: 운영기획팀
organization: 예시 구립도서관
date: 2026-07-03
short_title: 2분기 운영 결과
notice: "예시 데이터: 수치는 설명을 위한 가정입니다"
tonality: report
---

::: cover kicker="분기 보고"
:::

# 요약

2026년 2분기 대출 건수는 전년 동기보다 12% 늘었고, 증가분의 대부분은 동부 분관에서 나왔다. 운영비는 예산의 97% 안에서 집행되어 추가 재원 없이 야간 개관을 시범 운영할 수 있다.

::: keyfigures cols=3
- **+12%** 대출 건수 (예시)
  - 2026년 4-6월, 전년 동기 대비, 도서관 관리 시스템
- **3.1억 원** 분기 운영비 (예시)
  - 2026년 4-6월 합계, 내부 결산
- **96.4%** 당일 반납 처리율 (예시)
  - 2026년 6월, 도서관 관리 시스템
:::

::: callout kind=key title="요청 사항"
야간 개관을 3분기에도 이어 갈지 7월 운영위원회에서 결정해 주시기 바랍니다.
:::

# 이용 실적

대출 건수는 지점 전체에서 늘었지만 증가 폭은 지점마다 달랐다. 중앙관은 5% 늘어난 데 그쳤고 동부 분관은 21% 늘었다.

표 1. 지점별 분기 대출 건수 (예시)

| 지점 | 1분기 (천 건) | 2분기 (천 건) |
|---|---|---|
| 중앙관 | 412 | 433 |
| 동부 분관 | 188 | 228 |
| 합계 | 600 | 661 |

자료: 도서관 관리 시스템 (예시)
```

Converted, the caption becomes `<표 1> 지점별 분기 대출 건수 (예시)` with a bold label, both numeric
headers share `천 건`, so the unit moves to a right-aligned `(단위: 천 건)` line, and the 합계 row is set
bold under a thin rule. The h1 parts print as `Ⅰ. 요약` and `Ⅱ. 이용 실적`.

## Headings

| Label | Sentence the gate rejects |
|---|---|
| 2분기 처리량과 비용 | 2분기 처리량이 12% 늘었다 |
| 창고별 지연 원인 | 지연은 대부분 북부 창고에서 발생함 |
| Cost per order by site | Costs fell at every site |

The title and the subtitle follow the same rule (`heading.declarative`). The claim goes in the first
sentence under the heading.

## Numbers

A key figure sits at the h2 size and stays there. Each carries a label and a basis line (period, scope,
source) and is rounded honestly; example data says (예시) or (sample) in the label. A figure with no basis
belongs in a sentence, and a data set of more than four figures belongs in a table.

## Failure patterns

| Pattern | What happens | Fix |
|---|---|---|
| a three-line summary, then a part that opens with a block that cannot split (a table of six or fewer rows with prose cells, a tall figure) | page 1 ends early (`fill.page`) | let the summary hold its first paragraph, the strip and the request, put a sentence before the block, and shorten the cells |
| a second `::: keyfigures` lower in the report | only the first strip is drawn; the second prints as a list | merge the figures into one strip or move them into a table |
| a callout on every paragraph | about one per four pages becomes a box; the others keep a bold lead line | write one decision box and plain paragraphs |
| headings typed with numbers (`Ⅰ. 개요`) | the numbering doubles | write the label alone |
| a heading as a claim (`지연이 줄었음`) | `heading.declarative` | name the topic and state the claim underneath |
| body type reduced to meet a page limit | the density the user chose is lost | raise density one step or cut text |
