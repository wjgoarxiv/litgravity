# Ledger

Ledger is built for numbers that a reader checks. Pages are dense and quiet, set at reading sizes
on the dense grid, with tables that carry a dark green header, hairline rules and right-aligned
figures. A teal-green accent marks the one value each slide is about, and section openers use a rule
or a real part numeral instead of colour fields. The deck reads like a well-kept report that also
works on a screen in a meeting room.

## When to use it

Choose Ledger for business reviews, quarterly results, budget requests, status updates and data
reviews where the audience reads before or during the meeting and asks about the figures. The
signals that move it up are a high share of slides with tables or charts (about 30% each), long
bodies (150 Korean glyphs or 300 Latin characters per content slide and more), and a brief that says
the deck is circulated. It is the first candidate for business reviews and status updates, the
second for data-heavy reviews and Korean briefings.

## When it is the wrong choice

Ledger is wrong for a live pitch or a launch, where its density overwhelms a listener and its calm
palette undersells the moment; Signal fits there. It is also wrong for an image-led deck, because
its
pictures are framed small with a hairline and never bleed. Ledger has no statement treatment, so a
deck built on single sentences belongs elsewhere.

## Tokens

Read from the pack file; these are the values the engine draws.

| Token | Value |
|---|---|
| ground / surface | #FFFFFF / #F2F4F6 |
| ink / ink-muted / line | #16212C / #4B5866 / #D0D6DC |
| accent / accent-deep / accent-tint | #0E6B5A / #0A4438 / #E2F0EC |
| field / on-field | #0A4438 / #FFFFFF |
| positive / negative | #1E7A3F / #B3261E |
| series | #0E6B5A, #4B5866, #9A6A12, #2F5F8A |
| faces | Pretendard Bold for display, title and numerals, Pretendard Regular for body and labels; `faces: a2z` swaps display and numerals to A2Z Bold |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 5 |
| radius / edge | 0 / fill |
| table | ledger style, header in the field colour with on-field text, rules under the header and above totals, bold totals |
| chart | hairline gridlines, direct labels, accent on the highlighted series over muted ones |

Density 10 puts the deck on the compact grid (24 pt side margins) and the compact ramp: body 13 pt,
table cells and captions 11 pt, sources 9 pt, rows from 18 pt, up to 22 lines in a text column, no
step-up. A deck shown to a room may lower it to 8 (dense grid, body 14 pt); both ledger examples keep
the default. No figure is set above the title size (26 pt).

## Treatments by slide role

Content, data and reference slides take `top-rule`; data with a takeaway, statements and definitions
take `side-rail`; sequences take `kicker-numeral` (it shows the part number when the deck has
sections); image slides take `bottom-anchor`. The engine starts from that map, lays out each
treatment the family allows, and keeps the role default when the body fills; otherwise it picks the
one with the smallest empty band while keeping any one treatment under about a third of the deck.
`title: bottom-anchor` after `layout:` overrides one slide.

## Families and variants

- `kpi-row`, `kpi-over-chart` and `dashboard-grid` carry results and their trend on one page.
- `ledger-table` sets a full table with its takeaway lines under it; `table-insight` puts them
beside.
- `chart-insight`, `full-chart` and `big-number` carry one trend or one figure with its reading.
- `comparison` sets plan against actual, or two options, across shared rows.
- `timeline` shows dated steps with owners, `matrix-2x2` sorts options by effect and effort.
- `agenda`, `text-two-column` and `references-appendix` hold the contents, the itemised text and the
  sources.

Covers are `cover-figures` (which lifts the first KPI row), `cover-typographic` and `cover-index`
(which needs an agenda or sections to list); sections are `section-rule` and `section-numeral`;
closings are `closing-decision-box` and `closing-ask`.

Display slides. The typographic cover sets the title over the deck's headline figures when the deck
has a KPI row, each figure at most title size with its label. A big number is a data panel on the
accent tint: two to four figures, one row each with value, label and basis, its evidence beside it. A section shows the deck's parts in one line under its rule, numbered as the agenda numbers
them, this part in the accent. A closing's table becomes action rows keyed by amount or date, and
the next step closes the page in a tinted box on the body floor.

## Do

- Put units in headers and keep every figure that appears twice identical, ideally from a data file.
- Give every KPI its basis row (전년 대비, 계획 대비, 목표) and a caption with period and source.
- Give each table two or three takeaway lines; a ledger table without them ends at mid-page.
- Close with a decision box that names each item, its amount, the date it is needed and the owner.
- Use a matrix only when each cell has a full phrase; one-word quadrants leave the page empty.

## Avoid

- KPI values for counts that are not results, such as the number of meetings held.
- More than one accent on a chart.
- Tables padded with empty rows or wide cells to fill the page.
- Two data slides in a row under a side rail.
- The `statement` family; turn a single claim into a big-number panel or a top-rule slide with its
evidence.
- Claims in titles; a title names the subject, measure and period, and the claim leads the body.

## Two worked slides

A ledger table carries its reading under it, so the page ends near the floor; the title names the
table, and the first takeaway carries the claim.

```markdown
---
layout: ledger-table

## 사업부별 3분기 매출·영업이익 실적

| 사업부 | 매출 계획 | 매출 실적 | 영업이익 | 전년 대비 |
|---|---|---|---|---|
| 소재 | 490 | 512 | 61 | ▲ +31% |
| 부품 | 425 | 438 | 37 | ▲ +12% |
| 서비스 | 225 | 234 | 12 | ▼ −4% |
| 합계 | 1,140 | 1,184 | 110 | ▲ +18% |

> 표 1. 사업부별 3분기 실적, 억 원 (예시 데이터)

- 세 사업부 모두 매출 계획을 달성했다 (합계 계획 대비 +3.9%)
- 서비스 사업부만 이익이 줄었고, 원인은 인건비 상승 8억 원이다
- 합계 영업이익률은 9.3%로 전년 동기보다 0.5%p 높아졌다
- 4분기 계획은 매출 1,210억 원, 영업이익 112억 원이다
---
```

A status update sets the risk as a data panel: three related figures, each with its basis, and the
reading beside it.

```markdown
---
layout: big-number

## 결제 연동 재시험 일정과 영향

| 재시험 잔여 영업일 | 사전 공개 지연 위험 | 연동 시험 진척 |
|---|---|---|
| 5일 | 1주 | 62% |
| 마감 10월 17일 기준 | 재시험 미완료 시 | 계획 85% 대비 |

> 결제 연동 일정 점검, 2026년 10월 10일 기준, 내부 일정표 (예시)

- 결제 연동 지연이 이번 분기 가장 큰 위험이다
- 외부 결제사가 시험 환경을 바꿔 연동 시험을 처음부터 다시 한다
- 결제사와 매일 오전 점검 회의로 진행을 확인한다
---
```

## Examples

`03-business-review-ledger-ko.md`, `10-status-update-ledger-ko.md`
