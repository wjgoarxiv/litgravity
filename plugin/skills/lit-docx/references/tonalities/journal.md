# Journal

Journal is long-form reading set in two columns: an essay, a newsletter, a white paper, a research summary
for colleagues that is not bound for a named journal. It sits close to a publisher profile. A masthead with
authors, affiliations, an abstract and keywords opens page 1; the body runs in two ragged-right columns
with a 6 mm gutter; sections carry decimal numbers so that "section 2.2" in the text points somewhere; and
the header holds the short title and the folio. Latin text is set in Times New Roman for its narrow measure,
while Hangul, headings and every other element stay in Pretendard. The pack has no accent colour: rules,
headings and the one callout style are all near-black ink.

## Choose it, or choose another

Choose Journal for 칼럼, 뉴스레터, 백서 and 연구 요약, for a long explainer, and for an English essay of
three pages or more with few tables. It moves up when the source is mostly running prose, when it cites its
own sections and references, or when the reader goes from start to finish and does not look things up.

| Source | Better choice |
|---|---|
| a journal submission or a named publisher's format | a publisher profile (`--publisher elsevier`, `acs`, `ieee`, `nature` or `korean-generic`); a tonality does not stand in for a journal's rules |
| a document of wide tables | Report (every table of more than three columns spans the page, and a run of those reads as a Report with extra gutters) |
| a briefing or a memo | Brief or Memo (two columns slow a two-page reader) |
| a procedure | Manual (steps wrap badly in narrow columns) |

## Tokens

Values at the pack default (density 9, variance 6) from `templates/tonalities/journal.yaml`.

| Token | Value |
|---|---|
| Page | A4; margins 25 / 27 / 25 / 25 mm; two columns with a 6 mm gutter, about 77 mm each |
| Body | Times New Roman for Latin, Pretendard for Hangul, 10.5 pt, ragged right |
| Pitch | Latin 133 % (Word multiple 1.16 in Times New Roman), Hangul 175 % (1.14 in Pretendard) |
| Paragraph space | 6 pt after (5 pt English), no indent |
| Scale | h1 13.5 pt (1.3), h2 12 pt (1.15), h3 10.5 pt bold, all in Pretendard; title 26.5 pt (2.5) |
| Numbering | decimal `1`, `1.1`, `1.1.1`; back matter (References, 참고 문헌, Acknowledgements, 감사의 글) unnumbered |
| Ink | body and headings `1A1A1A`, muted `555555`, rules `8C8C8C`; no accent, so the title rule and the callout rules are ink |
| Tables | booktabs, 9.5 pt, bold header, right-aligned numbers |
| Running head | header: short title left, folio right, 8.5 pt muted, from page 2; no footer |
| Components | callout only |
| Figures | at most 0.40 of the frame height, sized to the column width |

## Page one: the masthead

An optional label line (the `kicker=` of `::: cover`) with the date at the right (`2026. 9. 30.`, English
`30 September 2026`) opens the page. Under it come the title, the subtitle as a standfirst in muted ink, the
authors and the organisation, numbered affiliations (frontmatter `affiliations:` as a mapping, printed as
`1 Example Institute, Work Practices Group`) and a corresponding address (`corresponding_email:`, printed
with an asterisk), one ink rule, the notice once in small muted type, and the abstract and keywords from the
frontmatter (초록 and 주요어, or Abstract and Keywords; keywords are joined with semicolons). Text written
inside the cover directive appears between the notice and the abstract. The two-column body starts under
the masthead on the same page. A `variant=` on the cover is accepted and ignored.

The running head shows the short title, cut at 40 characters on a word boundary when `short_title:` is
absent. A 41-character English title printed as "What a year of remote work cost in" in the tested run, so
set `short_title:` for any title near that length.

## Summary

The abstract is the summary. There is no summary section and no key-figure strip. The first paragraph of
the body states what the piece argues and for whom. Write the abstract in frontmatter as one or two
sentences with the result in the second, and mark example data with (예시) or (Sample data.).

## Numbering, columns and wide material

Decimal numbers come from the engine, so cross-references such as "see 2.2" resolve to a real heading; write
the heading text alone. References or further reading close the piece as a numbered list, and a list of up
to six items stays together.

A table of four or more columns spans both columns with its caption and its source line, set in a
continuous one-column section; a table of up to three columns stays in its column at the column width. Put
each wide table after a paragraph that introduces it, so the section that spans the page starts at a
paragraph boundary. The column body ends with a continuous break, so the last page sets both columns to an
even depth. Keep the first lines of a part under its heading, and keep lists of five or six items to a break
after the second item.

## Components and budget

One kind only: `callout`, for a definition, a data fact or a method note that sits outside the line of
argument, at about one per four pages, in a single style: a 0.75 pt ink rule above, a 0.5 pt rule below, a
bold title and no fill. A `::: sidebar`, `::: keyfigures` or `::: columns` written in the source keeps its
content as ordinary text with its title as a bold run-in line. The gate counts the masthead's section break
as a `cover` kind and the column section as `columns`, so a Journal of four pages or more meets
`component.variety` without a callout; a callout is still worth planning where the text has a definition
that interrupts the argument.

## Dials

Density 7 gives margins of 26 / 28 / 26 / 26 mm and a pitch of 137 % Latin and 180 % Hangul, for a white
paper meant to be printed; the columns narrow by 2 mm, so check that three-column tables still fit. Density
6 gives 27 / 29 / 27 / 27 mm. Density 10 closes the top margin to 24 mm for a newsletter with a fixed page
count. Variance is recorded and adds no component kinds.

## Korean and English

English text is the pack's natural home: Times New Roman at 10.5 pt, a pitch of 133 %, captions that read
`Table 1.` with a bold label, notes that read `Note:` and `Source:`, and the unit kept in the header. A Korean
Journal sets digits and Latin letters in Times New Roman and Hangul in Pretendard through the east-Asian font
pairing. Korean tables take `<표 1>` captions, a `(단위: …)` line when the numeric headers share a unit, and
`자료:` lines; a four-column table whose headers carry different units keeps the unit in each header.

## Worked source

The Korean fragment converted to one page (fill 0.64) and passed the gate. An English white paper built
the same way ran to two pages: its second page first held 0.11 of the frame and failed `page.spill`, and
after three more parts (reply delay, limits, next steps) it held 0.42 and passed.

```markdown
---
title: 재택근무 1년의 협업 비용
subtitle: 4개 본부 설문으로 본 회의 시간 변화
authors: [김연구, 이분석]
organization: 예시연구소
date: 2026-09-30
abstract: 재택근무 도입 1년 뒤 본부별 회의 시간과 응답 지연을 비교했다. 회의 시간은 모든 본부에서 늘었고 개발 본부의 증가 폭이 가장 컸다. (예시)
keywords: [재택근무, 협업, 회의 시간]
tonality: journal
---

# 조사 방법

2026년 7-8월에 4개 본부 612명에게 설문을 보냈고 523명이 응답했다(예시). 응답자 구성은 1.1절에서 다룬다.

::: callout kind=note title="응답률 주의"
개발 본부의 응답률이 다른 본부보다 낮아 본부 간 비교에는 오차가 크다.
:::

## 응답자 구성

응답자의 62%는 입사 3년 이상이었다. 본부별 응답 수는 개발 142명, 영업 151명, 지원 118명, 기획 112명이다.

# 회의 시간의 변화

표 1. 본부별 주간 회의 시간 (예시)

| 본부 | 2025년 9월 (시간) | 2026년 9월 (시간) | 변화 (시간) |
|---|---|---|---|
| 개발 | 3.9 | 5.1 | +1.2 |
| 영업 | 4.4 | 4.8 | +0.4 |

자료: 사내 설문 (예시)
```

The four-column table spans the page with its caption, set as `<표 1>` above. All three numeric headers
name 시간, so the unit moves to one right-aligned `(단위: 시간)` line and leaves the headers. The frontmatter
date prints as `2026. 9. 30.` and the text range `7-8월` becomes `7–8월`.

## Headings

| Label | Sentence the gate rejects |
|---|---|
| 재택근무 1년의 협업 비용 | 재택근무는 협업 비용을 키웠다 |
| Meeting time after remote work | Remote work doubled our meetings |
| 조사 방법과 한계 | 조사에는 몇 가지 한계가 있음 |

The standfirst under the title is a subtitle and follows the same rule; the argument starts in the first
paragraph.

## Numbers

Journal leans on prose, so figures belong in sentences or in tables with their period and source. There is
no key-figure strip and no large number across both columns. Example data says (예시) or (sample).

## Failure patterns

| Pattern | What happens | Fix |
|---|---|---|
| a sidebar, key-figure strip or quotation box planned on the direction card | none is drawn | plan the callout alone |
| five-column tables in a row, each spanning the page | the columns lose their rhythm | move them to a closing part, or reduce them to three columns |
| bullet lists of single words in a column | half of each column stays empty | write a sentence |
| section numbers typed into headings | the decimal numbering doubles | write the label alone |
| a document a little over one page (`page.spill`, 0.11 of page 2 in the tested English run) | a short second page | add the parts the argument needs (limits, next steps) or cut to one page |
| a title near 40 characters with no `short_title:` | the running head ends mid-phrase | set `short_title:` |
| Journal used as a stand-in for a publisher's manuscript format | the profile rules are not applied | build with `--publisher` |
