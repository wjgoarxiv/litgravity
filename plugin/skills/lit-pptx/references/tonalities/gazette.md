# Gazette

Gazette sets a Korean briefing paper as slides. A slate header band carries the title on most content
pages, a boxed one-line conclusion opens the argument, and 개조식 evidence runs in two columns at
reading size. Tables have a slate header and a grid on every cell with the first column shaded; a deep
red is kept for the key line alone. Nobody presents this deck: it is read at a desk, page by page,
and the pack file says as much, calling it wrong for a live talk because the density that serves a
reader overwhelms a listener.

## When to choose it

Choose Gazette for a 보고서형 deck: sent ahead of a meeting, circulated for approval, or filed as the
record of a review. The brief says the deck is read rather than presented, the language is Korean, the
pages carry long bodies and a fair share of tables. Of its ten families, `summary-box-list`,
`text-two-column`, `text-column`, `ledger-table` and `agenda` serve text, and `timeline`,
`matrix-2x2` and `comparison` serve decisions; the set follows the Korean briefing form (summary,
background, evidence, schedule, decision).

An English deck that is read rather than presented fits Ledger better, since the header band, the boxed
summary and the itemised endings come from the Korean form. Image-led decks fit Atlas: pictures here
stay small, with a hairline frame.

## Tokens

| Token | Value |
|---|---|
| ground / surface | #FFFFFF / #F1F4F8 |
| ink / ink-muted / line | #1A2230 / #4A5568 / #C8D0DA |
| accent / accent-deep / accent-tint | #A61B1B / #233A4F / #E8EEF4 |
| field / on-field | #233A4F / #FFFFFF |
| positive / negative | #1E7A3F / #1A2230 |
| series | #A61B1B, #233A4F, #4A5568, #7A6A2A |
| faces | Pretendard Bold for display, title and numerals, Pretendard Regular for body and labels; `faces: a2z` moves display and numerals to A2Z Bold |
| tracking (title / display) | -1 % / -1 % of the size |
| density / variance | 10 / 4 (up to 3 title treatments) |
| radius / edge | 0 / fill+border |
| table | slate header with on-field text, a hairline grid on every cell, the first column shaded in the surface colour, bold totals |
| chart | hairline gridlines, direct labels, accent on the highlighted series |
| image | hairline frame |
| decoration | header-band, box-outline, hairline-rule, numeral |
| fill-order | step-up, distribute, change-family, anchor-visual |

Accent-deep equals the slate field, so the accent (the red) is the only warm colour on a page. A loss
keeps the ink colour and its ▼ sign. Density 10 is the compact step: 24 pt margins, body 13 pt, table
rows from 18 pt, up to 22 lines in a text column, titles close over the body. Variance 4 allows exactly
three title treatments, which suits a briefing that repeats its page head; variety comes from the body
families.

## Titles by family

Role defaults: content and statement slides `band`, data and references `top-rule`, data with a
takeaway, images and definitions `side-rail`, sequences `kicker-numeral`. A `band` title sits inside a
full-width slate band 108 pt tall (the pack lists `header-band`), one line of about 23 Korean glyphs at the
presented ramp and two lines of about 61 glyphs at the compact one, with the body starting at y 120. The engine keeps the
default while the body fills; `title: side-rail` after `layout:` pins one slide.

| Family | Default title | Then, in pack order |
|---|---|---|
| `summary-box-list` | `band` | `top-rule`, `kicker-numeral` |
| `text-two-column` | `band` | `top-rule`, `kicker-numeral` |
| `text-column` | `band` | `top-rule`, `kicker-numeral`, `side-rail` |
| `ledger-table` | `top-rule` | `band`, `kicker-numeral` |
| `table-insight` | `top-rule` | `band`, `side-rail` |
| `comparison` | `top-rule` (numbers) / `band` (arguments) | `band`, `side-rail`, `top-rule` |
| `timeline` | `band` | `top-rule` |
| `matrix-2x2` | `top-rule` | `band`, `side-rail` |
| `agenda` | `band` | `top-rule`, `kicker-numeral`, `side-rail` |
| `references-appendix` | `top-rule` | `band` |

The pack lists no `statement` family and no statement title. A `layout: statement` slide logs `note:
slide N: gazette has no statement title, so the sentence is drawn as a band title` and sets the
sentence in the band; a single claim belongs in the summary box instead.

## Families and variants

- `summary-box-list`: a `::: key-message` block of one to three lines in an outlined box, then
  bold-headed groups with numbered points in two columns that the engine balances.
- `text-two-column`, `text-column`: background and findings as itemised text.
- `ledger-table` sets a table with its reading under it; `table-insight` sets the reading beside it.
- `comparison` lays options across shared rows; `matrix-2x2` sorts measures by effect and difficulty.
- `timeline` shows dated steps; give each row a third column holding owner and output.
- `agenda` lists the parts; `references-appendix` is the 붙임 page of sources.
- Covers `cover-band`, `cover-typographic`, `cover-index`; sections `section-band`, `section-rule`;
  closings `closing-decision-box` (건의 사항 with a decision table) and `closing-ask`.

Display devices: the cover is a `band`, a 216 pt slate field with the title in at most two lines and
the deck's parts (else its headline figures) across the page under it; a section band carries the
deck's part index with this part marked, and the part title stands below as a statement over the titles
of the slides it opens; a big number is a panel on the surface inside an ink outline (`outline`), two to
four figures with their bases; a closing's rows are keyed by their deadlines and the next step sits in an
outlined box on the body floor.

## Do

- Put the conclusion first, in the summary box, in one or two lines; the title stays a label
  ("핵심 요약: 재택근무 운영안 건의").
- Give each figure its basis (전년 대비, 시범 전후, 목표) and each table a caption with period and source.
- Keep 개조식 levels honest: level one states the claim, level two the evidence, at most five items per
  level, with consistent endings.
- Give the timeline a third column with owner and output.
- End with a decision table: what to decide, who decides, by when.

## Avoid

- English section kickers or labels on a Korean page.
- Red for anything other than the key line.
- A summary box longer than three lines.
- More than three text families in a row; break them with a table, a timeline or a comparison.

## Failure patterns

| Symptom | Cause | Fix |
|---|---|---|
| OF-114 on "핵심 요약: 재택근무를 주 2일로 정례화함" | the band title carries the conclusion in a nominalised ending (-함) | keep the label ("핵심 요약: 재택근무 운영안") and move the conclusion into the box |
| OF-110 "4 title treatments, variance 4 allows 3" | pins (`title: kicker-numeral`) added a fourth title to a deck of eight or more slides | drop the pin; let the three treatments carry the deck |
| OF-115 "100 % of the side rail under the title is empty" | `title: side-rail` on a `text-column` slide whose takeaways cannot move into the rail | use a visual family under a side rail, or remove the pin |
| QA `sparse_slide` and OF-109 on a three-row `timeline` | three short events and one takeaway fill 30 % of the body | add the third column (owner, output) and two more takeaways, or merge slides |
| `fill: slide 2 band 0.69 -> 0.69 (none: ...)` | a `summary-box-list` with two short groups | add the third group (예산) and a point under every group |

## Two worked slides

The summary page labels the topic in its band, states the recommendation in the box and lays the
evidence under it in two columns.

```markdown
---
layout: summary-box-list

## 핵심 요약: 대여소 확충안 보고

::: key-message
대여소를 지하철역 반경 300m 안에 120곳 늘리고, 이용이 몰리는 대여소부터 순서대로 설치한다
:::

- **현황**
  (1) 대여소 480곳, 하루 평균 대여 2만 1천 건 (2026년 9월 기준)
  (2) 대여소의 12%에서 저녁 7시 전에 자전거가 동난다
  (3) 이용자 민원의 41%가 대여소 부족과 반납 자리 부족이다
- **확충 방향**
  (1) 지하철역 반경 300m 안 미설치 구역 120곳에 신규 설치
  (2) 이용이 몰리는 대여소 30곳은 거치대를 10칸에서 16칸으로 확대
  (3) 설치 순서는 이용 밀집도와 민원 건수로 정한다
- **소요 예산**
  (1) 신규 설치 120곳 36억 원, 거치대 확대 30곳 4억 원
  (2) 시비 60%, 국비 40%로 편성한다
---
```

A schedule whose third column names owner and output, so each event fills three or four lines, with
the follow-up actions under the axis.

```markdown
---
layout: timeline

## 대여소 확충 추진 일정

| 시점 | 할 일 | 담당과 산출물 |
|---|---|---|
| 2026년 11월 | 설치 대상지 120곳 확정, 지하철역별 현장 조사 | 교통정책과, 대상지 목록 |
| 2027년 1월 | 1차 설치 40곳, 거치대 확대 30곳 착수 | 도로시설과, 준공 확인서 |
| 2027년 4월 | 2차 설치 40곳, 이용 현황 중간 점검 | 도로시설과, 점검 보고서 |
| 2027년 7월 | 3차 설치 40곳, 사업 결과 보고 | 교통정책과, 결과 보고서 |

- 1차 설치 결과로 2차 설치 대상지의 순서를 다시 확인한다
- 설치 후 3개월 이용 건수가 기준 미만인 곳은 이전을 검토한다
- 예산은 1차분 14억 원을 12월 추경에 요청한다
---
```

Both slides compile under `tonality: gazette` after a generic cover (drawn as `cover-band`) and pass
`qa_deck.py`, which still lists the empty band of the summary page (21 %) as an advisory. The city
department, the programme and the figures are invented.
