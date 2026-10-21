# Proposal

Proposal is the plan or proposal as a document (제안서, 기획서, 사업 계획서): something a reader is asked
to approve, fund or join. It is the one pack with a cover page of its own, and the cover is
typographic: a kind label, a large title set left in the upper part of the page, one short wine-coloured
rule, the subtitle and a lead paragraph, with the byline, date and notice at the foot. The pages that
follow are as plain as a report's: near-black headings without numbers, booktabs tables, one decision box
and one key-figure strip. A proposal persuades through a clear request, an honest budget and a schedule
the reader can check, and the page carries no brochure devices.

## Choose it, or choose another

Choose Proposal for 사업 제안서, 기획서 and 계획서, for a grant or budget request, for a partnership
proposal written as a document, and for a project plan with costs and a schedule. It moves up when the
source asks the reader to approve an amount, when it holds a budget and a timeline, or when the document
travels ahead of a meeting where the decision will be taken.

| Source | Better tonality |
|---|---|
| a results report with a decision at the end | Report (evidence first) |
| a one-to-three page decision request | Brief or Memo (a cover wastes a page on a short text) |
| a technical procedure | Manual |
| a document for a regulator or an audit that expects numbered parts and no cover | Report |

## Tokens

Values at the pack default (density 8, variance 6) from `templates/tonalities/proposal.yaml`.

| Token | Value |
|---|---|
| Page | A4; margins 26 / 28 / 26 / 26 mm; text block 158 mm |
| Body | Pretendard 10.5 pt Korean, 11 pt English; Korean justified, English ragged right |
| Pitch | Hangul 175 % (Word multiple 1.14), Latin 133 % (0.87) |
| Paragraph space | 6 pt after (5 pt English), no indent |
| Scale, Korean | h1 14.5 pt (1.4), h2 12.5 pt (1.2), h3 10.5 pt bold; cover title 28.5 pt (2.7) |
| Scale, English | h1 15.5 pt, h2 13 pt, h3 11 pt bold; cover title 29.5 pt |
| Ink | body and headings `1A1A1A`, muted `555555`, rules `8C8C8C` |
| Accent | wine `6E2639` on the cover title rule and the callout rule only |
| Tables | booktabs, 9.5 pt Korean and 10 pt English, bold header, right-aligned numbers |
| Key figure | h2 size bold ink over an ink hairline, three per row |
| Running head | folio centred at the foot, 8.5 pt (English 9 pt) muted; none on the cover; no header |
| Components | key figures, callout (one at most), columns |
| Figures | at most 0.60 of the frame height |

## Page one: the cover

The cover is its own section. A label line (the `kicker=` of `::: cover`, for example `사업 제안서`) sits
about a fifth of the way down the page, then the title left-aligned, broken between words in at most
three lines within about five sixths of the text width, stepping the size down toward 14 pt when a title
needs it. One short rule of 36 mm in the accent follows, then the subtitle in muted ink and the lead
paragraphs written inside `::: cover`, left-aligned. The byline, the date (`2026. 10. 5.`) and the
frontmatter `notice:` stand at the foot of the cover in the cover section's own footer. The cover holds no
colour block, no picture and no key figures; `variant=` is accepted and ignored. The body starts on the
next page with the folio at 1, so the first body page is page 1 of the reading.

Write the lead as one or two sentences: what the plan is and the goal. Key figures written inside the cover
directive move to the summary, after its first paragraph.

## Summary

`# 제안 요약` or `# Summary` as prose: the request in one sentence, then why now. The key-figure strip
(cost, time, result) goes after the first paragraph, written there or moved there from the cover, and the
decision box goes after the strip. A proposal
without a stated request and date has no use for the box; write the request in the first sentence of the
summary and the date in the box.

## Numbering, headings and running head

Sections are unnumbered, and levels part by weight and the space above. Typical parts, in order: 추진 배경,
소요 예산, 추진 일정, 기대 효과. The budget and schedule parts are booktabs tables: a total row is set bold
under a thin rule when its first cell reads 합계, 총계, 소계, 계, Total or Sum, and a unit shared by every
amount column moves to a right-aligned `(단위: 백만 원)` line above the table. No h1 forces a page break,
so a part starts where the previous one ended. The folio stands alone at the centre of the foot.

## Components and budget

| Kind | Purpose on the direction card | Budget |
|---|---|---|
| `keyfigures` | three comparable numbers the reader will be asked to approve | one strip, in the summary, three per row |
| `callout` | the decision asked and its date | one box (the pack caps it) |
| `columns` | two blocks of nearly equal length, such as quantitative and qualitative effects | parts within 20 % of each other's length |

Every component needs its purpose line, and the three-kind ceiling holds for the whole document.

## Dials

Density 6 gives margins of 27 / 29 / 27 / 27 mm and a Hangul pitch of 180 % for a printed proposal handed
over in a meeting; density 10 closes them to 24 / 26 / 25 / 25 mm for a call that fixes a page limit.
Body type stays at 10.5 pt (Korean). Variance is recorded and adds no kinds, table styles or cover looks.
The converter sets a source it estimates at one page or less with tight spacing (pitch 165 % Hangul), and
it estimates 1,500 Korean characters to a page, so a proposal body of about a page and a half can come out
tight; the conversion line says so.

## Korean and English

English proposals set the body at 11 pt, tables at 10 pt, and the cover title at 29.5 pt; dates read
`5 October 2026`; amounts keep their unit in the header and captions read `Table 1.`. Korean amounts
carry `원`, `백만 원` or `억 원` and the period they cover. Write a Korean date inside a callout or table in
the form `2026. 11. 30.`; an ISO date in the title or subtitle is left as typed and trips `date.iso`.

## Worked source

The fragment converted to two pages (the cover, then the body at fill 0.48) and passed the gate with only
the OF-301 advisory.

```markdown
---
title: 제과점 야간 예약 주문 도입 계획
subtitle: 직영 매장 12곳 시범 사업
author: 마케팅팀
organization: 예시 제과 체인
date: 2026-10-05
notice: "예시 데이터: 수치는 설명을 위한 가정입니다"
tonality: proposal
---

::: cover kicker="사업 제안서"
직영 매장 12곳에 야간 예약 주문을 도입하는 계획이다. 당일 폐기량과 품절 시간을 함께 줄이는 것이 목표다.
:::

# 제안 요약

직영 매장 12곳에 야간 예약 주문을 도입하는 사업비 4.2억 원의 승인을 요청한다. 예약 수요를 전날 밤에 확정하면 아침 생산량을 맞출 수 있어 폐기와 품절이 함께 줄어든다.

::: keyfigures cols=3
- **4.2억 원** 총사업비 (예시)
  - 2027년 1-12월, 시스템과 교육 포함
- **11개월** 투자 회수 기간 (예시)
  - 연간 절감액 4.6억 원 기준, 내부 추정
- **38%** 폐기량 감소 (예시)
  - 시범 매장 3곳, 2026년 3-5월 측정
:::

::: callout kind=key title="결정 요청"
2027년 예산 편성 전인 2026. 11. 30.까지 사업 추진 여부를 결정해 주시기 바랍니다.
:::

# 소요 예산

표 1. 항목별 소요 예산 (예시)

| 항목 | 상반기 (백만 원) | 하반기 (백만 원) |
|---|---|---|
| 시스템 구축 | 180 | 60 |
| 매장 교육 | 70 | 50 |
| 합계 | 250 | 110 |

자료: 공급사 견적, 내부 추정 (예시)
```

On the page the unit leaves the two headers for `(단위: 백만 원)`, and the 합계 row is bold under a thin
rule. The cover shows the label, the two-line title, the wine rule, the subtitle and the lead, with
`마케팅팀, 예시 제과 체인`, `2026. 10. 5.` and the notice at the foot.

## Headings

| Label | Sentence the gate rejects |
|---|---|
| 재고 자동 추적 도입 계획 | 재고 자동 추적을 도입하면 비용이 줄어든다 |
| 소요 예산과 회수 기간 | 11개월이면 투자금을 회수할 수 있다 |
| Expected benefits | This plan pays for itself in a year |

The title and the subtitle are labels as well. The persuasive sentence goes in the cover's lead and in
the first sentence of the summary.

## Numbers

Key figures sit at the h2 size in the summary and have no place on the cover. Each carries a label and a
basis line (period, scope, source). Estimates say (추정), (예시) or (estimate) in the label, and a payback
or a saving states the assumption behind it. A figure with no basis goes into a sentence.

## Failure patterns

| Pattern | What happens | Fix |
|---|---|---|
| six figures on the cover | none stays on the cover; the first strip is drawn in the summary | put the headline three in the strip and the rest in the budget table |
| a second callout for a risk | one box is drawn, the decision request first | write the risk as a short part with its own heading |
| a cover and a thin body (under 0.40 of one page) | `page.spill` on a two-page document | give page 2 a whole part (budget and schedule) or fold the plan into a Brief |
| a full-page picture opening every part | the median fill falls and the argument is lost | one picture per part at most, placed after a paragraph |
| a budget table split over two pages (`table.split`) | the rows land across the break | lead the table with a sentence so it starts a page, or shorten it |
| expecting each part to start a new page | no h1 forces a break | order the parts by the reader's questions and let them flow |
