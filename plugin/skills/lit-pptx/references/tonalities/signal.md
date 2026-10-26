# Signal

Signal is the direction for a talk given out loud. Each slide carries one topic with the facts that
support it, set on the reading ramp so the room can follow while the speaker talks and a reader can
still check the figures later. The ground stays white, almost everything is near-black ink, and a
single red-orange accent marks the one figure or word the slide exists for. There are no cards and
very few lines; space, weight and colour do the grouping.

## When to use it

Reach for Signal when someone will stand in front of decision makers and speak for ten to fifteen
minutes: an investment pitch, a product launch, a proposal that has to land in one sitting. The
content signals that point here are short bodies (about 40 Korean glyphs or 80 Latin characters per
content slide or less), a handful of real headline numbers, and a story that moves from a problem
to an ask. It is the first candidate for the pitch deck type, and the third one for an image-led
launch when the pictures are few.

## When it is the wrong choice

Signal fails when the deck will be read alone later, because its open pages hold less detail than a
reader needs without a speaker. It also fails when tables make up a third of the slides or
more: tables at Signal's sizes either run out of room or shrink to a size that contradicts the rest
of the deck. If the brief says the deck is sent ahead or circulated, Ledger or Gazette fits better.

## Tokens

The values below come from the pack file and are what the engine draws.

| Token | Value |
|---|---|
| ground / surface | #FFFFFF / #F4F4F5 |
| ink / ink-muted / line | #15131A / #55525C / #D4D4D8 |
| accent / accent-deep / accent-tint | #C8361A / #6E1A0C / #FBE7E2 |
| field / on-field | #C8361A / #FFFFFF |
| positive / negative | #1E7A3F / #15131A |
| series | #C8361A, #15131A, #6B6870, #2F6F8F |
| faces | Pretendard Bold for display, title and numerals, Pretendard Regular for body and labels; `faces: a2z` swaps to A2Z Black display and numerals, A2Z Bold titles |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 6 |
| radius / edge | 0 / fill |
| table | open style, no header fill, rules at top and bottom, protagonist row in accent-tint, bold totals |
| chart | no gridlines, direct labels, accent on the highlighted bar over muted bars |

Density 10 sets the pitch on the compact grid (24 pt side margins), body 13 pt and no step-up: a
pitch read after the meeting carries its basis and sources on every slide. Lower it to 8 (body 14 pt,
36 pt margins) for a pitch given only from the stage. Losses use ink with a ▼ sign, because red already means
"look here" in this direction.

## Treatments by slide role

Content slides take `top-plain-large`, data and sequence slides `top-rule`, data with a takeaway
`top-plain-large`, image slides `bottom-anchor`, statements `statement`, and references and
definitions `top-rule`. The engine treats that map as a starting point: for each slide it lays out
every treatment the family allows, keeps the role's own when the body fills, and otherwise picks the
one that leaves the least empty band without letting one title cover more than about a third of the
deck. To force a treatment, put `title: bottom-anchor` (or another allowed id) on the line after
`layout:`.

## Families and variants

- `statement` is kept for a pull quote or a display-led deck the user asks for; a claim is not a title.
- `big-number` is a data panel of two to four related figures, each with its label and basis, beside
  the facts that explain them.
- `image-split` pairs a product picture with three short labelled points.
- `asymmetric-feature` gives a picture or number the narrow side and the explanation the wide one.
- `process` shows three to five steps across the page, each with a head and two lines of detail.
- `kpi-row` runs two to four results at title size, each with its label and a basis row under it.
- `chart-insight` and `full-chart` carry growth curves and comparisons with one highlighted series.
- `comparison` reads two columns across shared rows, such as before and after.
- `table-insight` holds the one table a pitch needs, usually unit economics, with its takeaway.
- `quote` sets a customer's sentence as the statement.

Covers are `cover-numeral`, `cover-typographic` and `cover-split-field`; sections are
`section-field` and `section-numeral`; closings are `closing-statement` and `closing-ask`.

Display slides. The typographic cover is the red field from edge to edge, the topic name in up to
three balanced lines at display size, anchored low. A statement (pull quote) sets its text in up to
three balanced lines on white. A big number is a red data panel: one row per figure with value, label
and basis in white, its evidence beside it. A closing's rows carry their amounts at title size, each
with a bar for its share of the ask, and the next step runs in
a red band across the grid just above the footer.

## Do

- Write every title as a topic label (subject, measure, period); the claim is the first body line.
- Give every figure its basis or comparison and a caption with period and source.
- Give a big-number panel two to four figures and two or three lines of evidence.
- Let each bullet carry a number or a name; split a long list into labelled groups.
- End on `closing-ask` with the amount, its uses in a table and the next meeting with an owner.

## Avoid

- Red for a loss; red belongs to the protagonist.
- Display text running past two lines, or one giant figure alone on a slide.
- Cards or boxed groups; this direction groups with space.
- A table slide with no sentence that tells the room what to take from it.

## Two worked slides

A big number on its own reads as decoration, so the panel holds three related figures with their
basis, and the evidence sits beside it and ends level with it.

```markdown
---
layout: big-number

## 수도권 세탁 대행 시장 규모와 앱 주문 비중

| 시장 규모 (연) | 앱 주문 비중 | 수거·배송 하는 세탁소 |
|---|---|---|
| 1조 2천억 원 | 6% | 20% |
| 2025년 기준 | 2023년 3% | 다섯 곳 중 한 곳 |

> 수도권 세탁 대행 시장 추정, 예시 업계 통계 2025 (예시)

- 시장은 아직 대부분 오프라인이다: 앱 주문은 6%, 약 720억 원
- 동네 세탁소 다섯 곳 중 네 곳은 수거·배송을 하지 않는다
- 앱 주문 비중은 2023년 3%에서 2025년 6%로 늘었다
---
```

The closing labels the request in the title, shows where the money goes, states the ask in the
first line and ends with the next step.

```markdown
---
layout: closing-ask

## 18개월 운영 자금 30억 원 사용 계획

| 쓰임 | 금액 | 시점 |
|---|---|---|
| 수거·배송 권역 확대 (6개 구 → 15개 구) | 14억 원 | 2027년 상반기 |
| 제휴 세탁소 품질 관리 체계 | 6억 원 | 2026년 4분기 |
| 앱 개발 인력 | 5억 원 | 상시 |
| 신규 제휴 세탁소 120곳 모집 | 3억 원 | 2027년 1분기 |
| 운영 예비비 | 2억 원 | 필요 시 |
| 합계 | 30억 원 | 18개월 |

> 표 2. 투자금 쓰임 (예시 데이터)

- 요청: 18개월 운영 자금 30억 원 투자 승인
- 기대 성과: 18개월 뒤 월 주문 6만 건, 월 영업이익 흑자 전환
- 다음 단계: 11월 둘째 주 실사 미팅, 담당 예시 재무팀
---
```

## Examples

`01-pitch-signal-ko.md`
