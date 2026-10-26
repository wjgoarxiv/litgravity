# Gazette

Gazette sets a Korean briefing paper as slides. A slate header band carries the title on most
content
pages, a boxed one-line conclusion opens the argument, and 개조식 evidence runs in two columns at
reading size. Tables have a filled header and a light grid, the first column is shaded, and a deep
red is kept for the key line alone. The deck is meant to be read at a desk, page by page, with
nobody
presenting it.

## When to use it

Choose Gazette when the deck is a 보고서형 document: sent ahead of a meeting, circulated for
approval, or filed as the record of a review. The signals that move it up are a brief that says the
deck is read rather than presented, Korean as the language, long bodies (150 Korean glyphs per
content slide and more) and a fair share of tables. It is the first candidate for the Korean text
briefing and the second for business reviews and status updates that circulate in Korean.

## When it is the wrong choice

Gazette is wrong for a live talk. The density that serves a reader overwhelms a listener, and the
band titles make every page look equally important. It is also wrong for image-led decks: pictures
stay small and framed. English decks that are read rather than presented are better served by
Ledger, because Gazette's conventions (header band, boxed summary, itemised endings) come from the
Korean briefing form.

## Tokens

Read from the pack file; these are the values the engine draws.

| Token | Value |
|---|---|
| ground / surface | #FFFFFF / #F1F4F8 |
| ink / ink-muted / line | #1A2230 / #4A5568 / #C8D0DA |
| accent / accent-deep / accent-tint | #A61B1B / #233A4F / #E8EEF4 |
| field / on-field | #233A4F / #FFFFFF |
| positive / negative | #1E7A3F / #1A2230 |
| series | #A61B1B, #233A4F, #4A5568, #7A6A2A |
| faces | Pretendard Bold for display, title and numerals, Pretendard Regular for body and labels; `faces: a2z` swaps display and numerals to A2Z Bold |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 4 |
| radius / edge | 0 / fill and border |
| table | header-fill style, field header with on-field text, a grid on every cell, the first column shaded, bold totals |
| chart | hairline gridlines, direct labels, accent on the highlighted series |

Density 10 is the compact step every pack now starts from: 24 pt side margins, body 13 pt with no
step-up, table rows from 18 pt and up to 22 lines per text column, titles close over the body. Variance 4 allows exactly three title treatments in a deck. That is deliberate: a briefing repeats
its page head, and variety comes from the body families instead.

## Treatments by slide role

Content and statement slides take `band`; data and reference slides take `top-rule`; data with a
takeaway, image and definition slides take `side-rail`; sequences take `kicker-numeral`. The engine
starts from that map and keeps the role default when the body fills; otherwise it lays out the other
treatments the family allows and keeps the one with the least empty band, within the three the
variance dial permits. To give one slide a side rail, write `title: side-rail` on the line after
`layout:`; example `09-briefing-gazette-ko.md` does this for its comparison of options.

## Families and variants

- `summary-box-list` opens with the boxed conclusion (a `::: key-message` block) and the 개조식
  evidence under it in two columns.
- `text-two-column` and `text-column` carry background and findings as itemised text.
- `ledger-table` sets a table with its reading under it; `table-insight` sets the reading beside it.
- `comparison` lays options side by side across shared rows.
- `timeline` shows dated steps with owner and output.
- `matrix-2x2` sorts measures by effect and difficulty.
- `agenda` lists the parts; `references-appendix` is the 붙임 page of sources and definitions.

Covers are `cover-band`, `cover-typographic` and `cover-index`; sections are `section-band` and
`section-rule`; closings are `closing-decision-box` (건의 사항 with a decision table) and
`closing-ask`.

Display slides. The typographic cover opens under the slate band. A big number is a data panel on the
surface inside an ink outline, the box language of a briefing paper: two to four figures, each with
its label and basis, never one figure alone. The section band carries the deck's
part index, this part marked, with the part title on the ground below. A closing's rows are keyed by
their deadlines, and the next step sits in an outlined box on the body floor.

## Do

- Put the conclusion first, in the summary box, in one or two lines; the title stays a label
  ("핵심 요약: 재택근무 운영안 건의"), never the conclusion itself.
- Give each figure its basis (전년 대비, 시범 전후, 목표) and the table a caption with period and source.
- Keep 개조식 levels honest: level one states the claim, level two the evidence, at most five items
  per level, with consistent endings.
- Give the timeline a third column with owner and output, so each event fills three or four lines.
- End with a decision table: what to decide, who decides, by when.

## Avoid

- English section kickers or labels on a Korean page.
- Red for anything other than the key line.
- A summary box longer than three lines.
- More than three text families in a row; break them with a table, a timeline or a comparison.
- The `statement` family; a single claim becomes the summary box.

## Two worked slides

The summary page labels the topic in its band, states the recommendation in the box and lays the
evidence under it.

```markdown
---
layout: summary-box-list

## 핵심 요약: 재택근무 주 2일 정례화 건의

::: key-message
재택근무를 주 2일로 정례화하되, 팀마다 협업일 하루를 지정해 대면 회의를 그날에 모은다
:::

- **시범 운영 결과**
  (1) 월평균 이용률 78%, 본부 간 편차 최대 21%p
  (2) 업무 만족도 3.4점에서 4.1점으로 상승 (5점 척도)
  (3) 시범 기간 2026년 4-9월, 6개 본부 1,240명 (예시)
- **남은 불편**
  (1) 불편 사항의 64%가 회의 일정 조율과 대면 협업 부족
  (2) 주간 회의 시간 1인당 4.1시간에서 5.3시간으로 증가
  (3) 협업일 지정 팀은 회의 시간 증가가 0.4시간에 그침
- **시행 조건**
  (1) 협업일은 팀장이 분기마다 지정, 전사 공통 요일 없음
  (2) 회의실 예약 체계 개편 후 2027년 1월 전면 시행
---
```

The closing labels the request, turns it into a decision table, and states the ask and the follow-up
above it.

```markdown
---
layout: closing-decision-box

## 건의 사항: 결정 요청 사항과 기한

- 아래 세 가지를 기한 안에 결정해 주시기 바랍니다
- 결정 후 인사기획팀이 11월 첫째 주까지 세부 시행 계획을 보고한다

| 결정 사항 | 담당 | 기한 |
|---|---|---|
| 안 2(주 2일 정례화 + 협업일 지정) 채택 여부 | 경영위원회 | 10월 넷째 주 |
| 회의실 예약 체계 개편 예산 4천만 원 | 재무팀 | 10월 말 |
| 노사협의회 심의 상정 시기 | 인사기획팀 | 11월 첫째 주 |
---
```

## Examples

`09-briefing-gazette-ko.md`
