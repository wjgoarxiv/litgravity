# Ledger

Ledger is a set of accounts made readable. Small, exact type; figures aligned to the right; tables and
KPI rows doing most of the talking; a deep green header as the one dark mass on a page; and a single
teal accent that marks "this period" and the one figure a slide is about. Pages sit on the compact
grid at reading size, so a deck reads like a well-kept report that also survives a meeting-room
screen. The pack file says what it is for: dense, numbers-forward review decks that are read closely.

## When to choose it

Pick Ledger for business reviews, quarterly results, budget requests, status updates and data reviews
where the audience reads before or during the meeting and asks about the figures. The pack carries
fourteen families, and nine of them hold a table, a KPI row or a chart (`kpi-row`, `kpi-over-chart`,
`dashboard-grid`, `ledger-table`, `table-insight`, `chart-insight`, `full-chart`, `big-number`,
`matrix-2x2`), which is the best single signal for choosing it.

Choose another direction for a live pitch with little data (Signal), for an image-led story (Atlas,
Studio), or for a briefing read as prose (Gazette). Ledger has no `statement` treatment and no picture
family; a picture that lands inside one of its families is drawn small with a hairline frame.

## Tokens

| Token | Value |
|---|---|
| ground / surface | #FFFFFF / #F2F4F6 |
| ink / ink-muted / line | #16212C / #4B5866 / #D0D6DC |
| accent / accent-deep / accent-tint | #0E6B5A / #0A4438 / #E2F0EC |
| field / on-field | #0A4438 / #FFFFFF |
| positive / negative | #1E7A3F / #B3261E |
| series | #0E6B5A, #4B5866, #9A6A12, #2F5F8A |
| faces | Pretendard Bold for display, title and numerals, Pretendard Regular for body and labels; `faces: a2z` moves display and numerals to A2Z Bold |
| tracking (title / display) | -1 % / -1 % of the size |
| density / variance | 10 / 5 (up to 4 title treatments) |
| radius / edge | 0 / fill |
| table | header in the field colour with on-field text, a hairline under the header and above a totals row, no banding, bold totals |
| chart | hairline gridlines, direct labels, accent on the highlighted series over muted ones |
| image | hairline frame |
| decoration | accent-rule, hairline-rule, rail-fill, numeral |

## Type ramp

Density 10 selects the compact ramp: source 9 pt, label and table cells 11, body 13, lead 18, title
26, display 36, cover 44. The 24 pt margins and 18 pt minimum table rows serve a page that carries a
dozen lines. Figures stay at title size or below; the hero step is off. Lowering density to 8 moves
to the dense grid with body 14 and re-enables the one-step enlargement of short content.

## Titles by family

The pack's `role-defaults` give content, data and reference slides `top-rule`; data with a takeaway,
definitions and statements `side-rail`; sequences `kicker-numeral`; images `bottom-anchor`. A family
takes the first of those that it allows, and the table below lists what that gives in Ledger. The
engine keeps the default while the body fills to the density cap and moves a slide to the title with
the smallest empty band otherwise; a title that repeats the previous slide's title costs a little,
which keeps `side-rail` data slides apart. Pin one slide with `title: bottom-anchor` after `layout:`.
The `kicker-numeral` title needs a part number, so it can appear on `ledger-table` and
`text-two-column` slides that follow a section slide; an agenda has no part number and never takes it.

| Family | Default title | Then, in pack order |
|---|---|---|
| `kpi-row` | `top-rule` | `side-rail`, `bottom-anchor` |
| `kpi-over-chart` | `top-rule` | none |
| `dashboard-grid` | `top-rule` | `side-rail` |
| `ledger-table` | `top-rule` | `kicker-numeral` |
| `table-insight` | `top-rule` | `side-rail`, `bottom-anchor` |
| `chart-insight` | `side-rail` | `top-rule`, `bottom-anchor` |
| `full-chart` | `top-rule` | `bottom-anchor` |
| `big-number` | `side-rail` | `top-rule`, `bottom-anchor` |
| `comparison` | `top-rule` | `side-rail`, `bottom-anchor` |
| `timeline` | `top-rule` | `bottom-anchor` |
| `matrix-2x2` | `top-rule` | `side-rail` |
| `agenda` | `top-rule` | `side-rail`, `kicker-numeral` |
| `text-two-column` | `top-rule` | `kicker-numeral` |
| `references-appendix` | `top-rule` | none |

## Families and variants

- KPI and trend: `kpi-row` (two to six figures with a basis row), `kpi-over-chart`, `dashboard-grid`.
- Tables: `ledger-table` (full width, takeaways under it), `table-insight` (takeaways beside it).
- One chart or figure: `chart-insight`, `full-chart`, `big-number`.
- Reading across: `comparison` for plan against actual, `timeline` for dated steps with owners,
  `matrix-2x2` for effect against effort.
- Contents: `agenda`, `text-two-column`, `references-appendix`.
- Covers `cover-figures` (the first KPI row under the title), `cover-typographic`, `cover-index`;
  sections `section-rule`, `section-numeral`; closings `closing-decision-box`, `closing-ask`.

Display devices: the cover is `figures` (the deck's headline numbers under the title, at most title
size, each with its label; a deck without a KPI row gets the plain cover), a big number is a data
panel on the accent tint, and a closing's next step sits in a tinted box on the body floor. With
`index: true` and an agenda, a section slide becomes an index page: the part numeral over the part
title on the left, the agenda down the right columns with hairlines and this part in the accent.

## Do

- Put the unit in the header and keep a repeated figure identical on every slide; a `data:` file in the
  frontmatter keeps the sources in one place.
- Give every KPI a basis row (전년 대비, 계획 대비, 목표) and every table a caption with period and unit.
- Write two to four takeaways under or beside each table; the first carries the claim.
- Close on a decision box that names each item, its amount, its date and its owner.
- Use `matrix-2x2` when every cell holds a full phrase.

## Avoid

- KPI cards for counts that are not results, such as meetings held.
- More than one accent on a chart.
- Tables stretched by empty rows or padded cells.
- `side-rail` titles on two data slides in a row (the engine discourages it; a pin overrides).
- A claim in the title; the title names subject, measure and period.

## Failure patterns

| Symptom | Cause | Fix |
|---|---|---|
| `note: ledger has no statement title, so the sentence is drawn as a top-rule title`, a nearly empty slide | `layout: statement` in a pack without that family | turn the sentence into a `big-number` panel or a top-rule slide with its evidence |
| `fill: slide 2 band 0.72 -> 0.72 (none: ...)`, QA reports `sparse_slide` and OF-109 | a `ledger-table` with two rows and no takeaways | add the takeaways, or draw the figures as `kpi-row` |
| a literal `> ...` line under a chart | the caption was written after the closing `:::` | put the `>` caption inside the `::: chart` block |
| OF-114 on a title such as "이번 분기 핵심은 현금 흐름이다" | the title is a sentence | name the topic ("분기별 현금 흐름") and move the claim to the first takeaway |
| `note: slide 1: cover-figures cannot be drawn` | no KPI table with two or more values anywhere in the deck | add a KPI row or accept the typographic cover |

## Two worked slides

A full table carries its reading under it, so the page ends near the floor. The title names the table;
the first takeaway states the claim. The compile logs `fill: slide 2 band 0.17 -> 0.10 (distribute)`.

```markdown
---
layout: ledger-table

## 권역별 2분기 매출·영업이익 실적

| 권역 | 매출 계획 | 매출 실적 | 영업이익 | 전분기 대비 |
|---|---|---|---|---|
| 서울 | 410 | 436 | 52 | ▲ +9% |
| 경기 | 365 | 371 | 38 | ▲ +4% |
| 충청 | 190 | 181 | 14 | ▼ −3% |
| 영남 | 240 | 252 | 21 | ▲ +6% |
| 합계 | 1,205 | 1,240 | 125 | ▲ +5% |

> 표 1. 권역별 2분기 실적, 억 원 (예시 데이터)

- 서울·경기·영남은 매출 계획을 넘겼고 충청만 4.7% 못 미쳤다
- 합계 매출은 계획보다 35억 원 많은 1,240억 원이다
- 영업이익률은 10.1%로 전분기보다 0.4%p 높아졌다
- 충청은 신규 매장 6곳의 개점 지연이 원인이다
- 3분기 계획은 매출 1,290억 원, 영업이익 131억 원이다
---
```

Headline figures over the trend that explains them: a KPI row with its basis row, then a native chart
whose caption sits inside the block.

```markdown
---
layout: kpi-over-chart

## 2분기 가맹 매장 지표와 월별 매출

| 전체 매장 | 신규 개점 | 폐점 | 재방문율 |
|---|---|---|---|
| 842곳 | 17곳 | 5곳 | 63% |
| 전분기 +12곳 | 계획 20곳 | 전분기 −2곳 | 목표 60% |

::: chart type=column unit="억 원"
| 월 | 2025 | 2026 |
|---|---|---|
| 4월 | 372 | 398 |
| 5월 | 386 | 412 |
| 6월 | 381 | 430 |
> 월별 매출, 전년 동월과 비교 (예시 데이터)
:::

- 6월 매출이 전년 동월보다 12.9% 늘어 분기 증가분의 절반을 만들었다
- 신규 개점은 계획보다 3곳 적었고 폐점은 전분기보다 2곳 줄었다
- 재방문율은 목표를 3%p 넘었다
---
```

Both slides compile and pass the gate in a deck under `tonality: ledger` (checked with
`compile-deck.js` and `qa_deck.py`).
