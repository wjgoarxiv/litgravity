# Memo

Memo is the short document: an internal memo, a notice, a decision request, a letter of one or two pages.
It has no cover and no components. Page 1 opens with a small label, the subject as the title, and
To / From / Date / Subject rows between two hairlines; the body follows at once. The pack has no accent
colour at all. Everything is near-black ink, with muted grey kept for the label, the notice and the folio.
A memo should look like something a person wrote and sent, and its authority comes from the clarity of its
first two sentences.

## Choose it, or choose another

Choose Memo for 메모, 공지, 안내문 and 협조 요청, for a short decision request, a meeting follow-up, a cover
letter for another document, and any Korean or English text under about 900 words. It moves up when the
request says one or two pages, when the source names recipients, or when the content is one request or one
piece of news.

| Source | Better tonality |
|---|---|
| more than about two pages | Report or Brief (a wall of text needs parts and a title block) |
| an executive briefing with numbered points and a boxed request | Brief |
| several tables or figures that need captions and a summary strip | Report |
| a proposal asking for money | Proposal |

## Tokens

Values at the pack default (density 9, variance 2) from `templates/tonalities/memo.yaml`. The pack sets
`spacing: tight`, which fixes the pitch and the heading space whatever the density.

| Token | Value |
|---|---|
| Page | A4; margins 25 / 27 / 25 / 25 mm; text block 160 mm |
| Body | Pretendard 10.5 pt Korean, 11 pt English; Korean justified, English ragged right |
| Pitch | tight: Hangul 165 % (Word multiple 1.08), Latin 120 % (0.78) |
| Paragraph space | 5 pt after (4 pt English), no indent; the paragraph after a list stands 6 pt clear |
| Heading space | h1 12 / 5 pt, h2 10 / 4 pt, h3 9 / 3 pt (other packs 22 / 9, 15 / 6, 11 / 4) |
| Scale, Korean | h1 12.5 pt (1.2), h2 11.5 pt (1.1), h3 10.5 pt bold; subject title 19 pt |
| Scale, English | h1 13 pt, h2 12 pt, h3 11 pt bold; subject title 20 pt |
| Ink | body and headings `1A1A1A`, muted `555555`, rules `8C8C8C`; no accent |
| Memo block | 9.5 pt Korean, 10 pt English, bold labels in a column of about 23 mm, between two 0.5 pt ink hairlines |
| Tables | booktabs, 9.5 / 10 pt, bold header, cells 2 pt above and below, pitch 125 % |
| Running head | folio from page 2, footer right, muted; nothing in the header |
| Components | none |
| Figures | at most 0.40 of the frame height |

## Page one: the memo block

Memo has the fewest structural features of the six packs, and that is its signature: a memo block in place
of a title block, no components, no numbering, no contents and no running head on page 1. How far another
tonality departs from it depends on what the source carries
(`qa_docx.py a.docx --compare b.docx`, check `tonality.structure`, which needs three differing features).
The Korean memo source below, built in each pack and compared with the memo, differed in three features for
Report (title block, numbering, running head), in two for Brief (title block, summary form) and in one for
Proposal (title block). A memo-grade source cannot offer Brief or Proposal as a second direction.

The block holds a small bold label in muted ink (the `kicker=` of `::: cover`, else 메모 or Memo), the
subject as the title at 1.8 times the body size, and then the rows between two hairlines. Write the rows
inside `::: cover` as `Key: value` pairs separated by ` · ` (space, middle dot, space), one or several
pairs to a line. The recognised keys are `To`, `From`, `Date`, `Subject`, `Cc`, `받는 사람`, `보내는 사람`,
`날짜`, `제목` and `참조`, and a line is read as rows when its first key matches exactly, capital letters
included. When no date row is written, the frontmatter date is inserted after the sender in the form
`2026. 10. 6.` (English: `6 October 2026`). English values start with a capital. Any other line inside the
cover renders as an opening paragraph under the rows, and the frontmatter `notice:` prints once under the
block in small muted type. A `variant=` on the cover is accepted and ignored.

## Summary and structure

A memo has no summary section: the opening paragraph is the summary. State the request or the news and its
date in the first two sentences. Numbering is none. Short memos often need no headings; two to four parts
under plain headings (`# 변경 내용`, `# 요청 사항`, `# 문의`) are the most a memo carries. One booktabs table
at most, `<표 1>` above, `주:` and `자료:` under it.

The folio appears from page 2, at the right of the foot. The converter sets a memo on one page whenever the
content allows; `memo.fit` fails a memo that spills onto a second page filled under a quarter, and a
longer second page counts as a two-page memo, which the pack allows. A memo is exempt from `page.spill`.

## Components

None. A `::: callout` keeps its content as ordinary text, and its `title=` becomes a bold run-in line with
a heading's space (12 pt) above it; that bold line is the memo's natural way to mark the request. A
`::: keyfigures` strip becomes a plain list with the basis in brackets. The purpose line for each planned
component is "none", and the direction card for a memo lists no components.

## Dials

Tight spacing overrides the density's pitch, so density changes only the margins here: density 7 gives
26 / 28 / 26 / 26 mm for a letter that is printed and signed, density 6 gives 27 / 29 / 27 / 27 mm, and
density 10 gives 24 / 26 / 25 / 25 mm, which saves 2 mm in total. When a memo spills a few lines, cut a
sentence before touching the dial. Variance is recorded and changes nothing: the pack gains no cover and no
component at any setting.

## Korean and English

Korean memos address the reader politely: `알려 주시기 바랍니다`, `-합니다`. State the deadline with the
weekday in parentheses (`10월 17일(금)`) and write dates in the form `2026. 10. 6.`; the converter rewrites
ISO dates in the body and in the frontmatter `date:`, and an ISO date left in the subject line trips
`date.iso`. English memos use short imperative requests, the subject as a noun phrase, and a date like
`Friday 17 October`. Write the subject row the same way as the title: `heading.declarative` reads the title,
the subtitle and the headings, and the rows are left to the writer.

## Worked source

Both fragments converted and passed the gate on one page.

```markdown
---
title: 열람실 좌석 예약 방식 변경 안내
date: 2026-10-06
notice: "예시 문서: 날짜와 내용은 설명을 위한 가정입니다"
tonality: memo
---

::: cover kicker="공지"
받는 사람: 각 분관장 · 보내는 사람: 운영기획팀
참조: 관장
:::

11월 1일부터 열람실 좌석은 도서관 앱으로만 예약할 수 있습니다. 분관별 고정 좌석 수는 10월 17일(금)까지 알려 주시기 바랍니다.

# 변경 내용

종이 예약 명부는 10월 31일에 폐지합니다. 앱 예약은 3일 앞까지 가능하며, 한 사람이 하루에 잡을 수 있는 좌석은 한 곳으로 제한합니다.

# 요청 사항

각 분관은 고정 좌석 수와 담당자 이름을 운영기획팀 공용 메일로 보내 주십시오. 회신이 없는 분관은 현재 좌석 수를 그대로 등록합니다.
```

The rows print as 받는 사람, 보내는 사람, 날짜 (`2026. 10. 6.`, inserted after the sender) and 참조.

```markdown
---
title: Room booking change
date: 2026-10-06
notice: "Sample memo: dates and details are placeholders"
tonality: memo
---

::: cover kicker="Notice"
To: all branch managers · From: Operations planning
Cc: director
:::

From 1 November, reading-room seats can be booked only in the library app. Please send each branch's fixed seat count by Friday 17 October.
```

The English rows print as To `All branch managers`, From, Date `6 October 2026` and Cc `Director`.

## Headings

| Label | Sentence the gate rejects |
|---|---|
| 회의실 예약 방식 변경 안내 | 회의실 예약 방식이 바뀝니다 |
| 요청 사항과 기한 | 17일까지 회신해 주세요 |
| Room booking change | We are changing room booking |

## Numbers

A memo rarely needs a key figure. A deadline, an amount or a count goes into its sentence with its unit and
date; example values carry (예시) or (sample).

## Failure patterns

| Pattern | What happens | Fix |
|---|---|---|
| lowercase keys (`to:`, `cc:`) | no match: the line prints as a plain paragraph and the gate stays green | write `To:`, `From:`, `Cc:` with the capital, or the Korean keys |
| recipients as running text ("To all team leads from ...") | no rows are built | use `Key: value` pairs separated by ` · ` |
| a cover page or a cover `variant=` | the memo block is set regardless | drop the variant; the memo has one block |
| a callout or a key-figure strip planned on the direction card | neither is drawn as a component | write the request as a bold lead line |
| a heading over every second paragraph | a memo under a page turns into an outline | keep two to four parts or none |
| a second page of three lines | `memo.fit` | tighten the prose until it returns to one page |
| a spaced dash in `notice:` | `notice.dash` | write the label with a colon |
