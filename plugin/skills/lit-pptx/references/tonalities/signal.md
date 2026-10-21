# Signal

Signal is the direction for a talk given out loud, where every slide says one thing and says it
loudly. The ground is white, nearly all type is near-black ink, and one hot red-orange accent is kept
for the protagonist: the figure, the word or the row the slide exists for. There are no cards and
few lines; weight, size and space do the grouping. The pack file states the trade: large type and few
words, wrong when the audience must read the detail later or when most of the content is tables.

## When to choose it

Reach for Signal when someone stands in front of decision makers for ten to fifteen minutes: an
investment pitch, a product launch, a proposal that has to land in one sitting. The pack lists eleven
families and none of them is a plain text page: the engine has no `text-column`, `agenda` or
`references-appendix` here, so a deck whose content is mostly paragraphs and lists belongs in another
direction. The brief signals that fit are a story that runs from a problem to an ask, a handful of
real headline numbers, and a room that follows a speaker.

Choose Ledger or Gazette when the deck is circulated ahead of the meeting and read alone, and when
tables fill a third of the slides or more.

## Tokens

| Token | Value |
|---|---|
| ground / surface | #FFFFFF / #F4F4F5 |
| ink / ink-muted / line | #15131A / #55525C / #D4D4D8 |
| accent / accent-deep / accent-tint | #C8361A / #6E1A0C / #FBE7E2 |
| field / on-field | #C8361A / #FFFFFF |
| positive / negative | #1E7A3F / #15131A |
| series | #C8361A, #15131A, #6B6870, #2F6F8F |
| faces | Pretendard Bold for display, title and numerals, Pretendard Regular for body and labels; `faces: a2z` moves display and numerals to A2Z Black and titles to A2Z Bold |
| tracking (title / display) | -1 % / -2 % of the size |
| density / variance | 10 / 6 (up to 4 title treatments, which is all four of the pack) |
| radius / edge | 0 / fill |
| table | no header fill, rules at the top and bottom, the row whose first cell the title names in accent-tint, bold totals |
| chart | no gridlines and no value axis, direct labels, accent on the highlighted series over muted ones |
| image | no frame |
| decoration | colour-field, hairline-rule, numeral |

Negative equals ink on purpose: the accent is red, so a loss keeps the ink colour and carries its ▼
sign ("▼ −4%"). The default ramp is the compact one (body 13 pt, label 11, title 26, display 36), with
no hero step; a figure never exceeds title size.

## Titles by family

The role defaults are: content and statement slides `top-plain-large` and `statement`, data and
sequence `top-rule`, data with a takeaway `top-plain-large`, images `bottom-anchor`, references and
definitions `top-rule`. A `top-rule` title sits on a full hairline because the pack lists no
`accent-rule`. The engine keeps the default while the body fills and otherwise takes the title with
the smallest empty band; `title: top-plain-large` after `layout:` pins one slide.

Default titles come from the role map, narrowed to what each family allows:

| Family | Default title | Then, in pack order |
|---|---|---|
| `statement` | `statement` | none |
| `big-number` | `top-plain-large` | `bottom-anchor`, `top-rule` |
| `image-split` | `bottom-anchor` | `top-plain-large`, `top-rule` |
| `asymmetric-feature` | `bottom-anchor` | `top-plain-large`, `top-rule` |
| `process` | `top-rule` | `top-plain-large` |
| `kpi-row` | `top-rule` | `top-plain-large`, `bottom-anchor` |
| `chart-insight` | `top-plain-large` | `bottom-anchor`, `top-rule` |
| `full-chart` | `top-plain-large` | `bottom-anchor`, `top-rule` |
| `comparison` | `top-rule` (numbers) / `top-plain-large` (arguments) | `top-plain-large`, `bottom-anchor`, `top-rule` |
| `table-insight` | `top-rule` | `bottom-anchor` |
| `quote` | `statement` | `top-rule` |

A `top-plain-large` title holds two lines of about 20 Korean glyphs; over that the engine moves the
slide and logs `note: slide N: the title is longer than the top-plain-large budget; shorten it`.

## Families and variants

- `big-number` is a data panel in the field colour: two to four related figures, each with label and
  basis in white, the evidence beside it.
- `image-split` and `asymmetric-feature` give a picture or a one-row figure one side and three to
  five short facts the other.
- `process` shows three to five steps (rows down the body when they are four or fewer).
- `kpi-row` runs two to six results with a basis row; `chart-insight` and `full-chart` carry growth
  curves with one highlighted series; `comparison` reads two columns across shared rows;
  `table-insight` holds the one table a pitch needs; `quote` sets a customer's sentence.
- Covers `cover-numeral`, `cover-typographic`, `cover-split-field`; sections `section-field`,
  `section-numeral`; closings `closing-statement`, `closing-ask`.

Display devices: the typographic cover is `drench`, the field from edge to edge with the title in up
to three balanced lines, anchored low; a statement is `open`, the sentence alone on white at display
size; a big number sits on a `field` panel; a closing's next step runs as a `band` of the field across
the grid above the footer. `closing-ask` rows carry their amounts at title size, each with a bar for
its share of the ask.

## Do

- Write every title as a topic label; the claim is the first line of the body.
- Give every figure its basis or comparison, and every chart or table a caption with period and source.
- Give a `big-number` panel two to four related figures and two or three lines of evidence.
- Keep a list to four items and let each carry a number or a name.
- End on `closing-ask` with the amount, its uses as a table of at most four rows and the next step.

## Avoid

- Red for a loss; red belongs to the protagonist.
- Display text beyond two lines, or one giant figure alone on a slide.
- Cards and boxed groups.
- A table slide without a sentence that tells the room what to take from it.

## Failure patterns

| Symptom | Cause | Fix |
|---|---|---|
| `note: slide 1: text-column is not a signal layout family (...); drawn with its own geometry`; QA reports an 87 % empty band on a two-bullet page | a paragraph page in a deck built for the stage | use `process`, `comparison` or `big-number`, or choose Gazette |
| `closing-ask` renders as a plain table with two columns of bullets | five or more action rows plus a three-line next step do not fit above the floor | cut to four rows, merge the smallest items, or shorten the next step |
| `note: ... the title is longer than the top-rule budget; shorten it` | a 100-glyph title | name the subject and period only |
| OF-114 on "시장은 이미 열렸다" | a statement written as a declarative sentence | set it as a quotation (leading “) or a noun phrase |
| the accent colours the rival series of a chart | the engine highlights the latest period, else the series measured beside a plan, target or baseline, else the last column | put the protagonist in the last column, or name the others with a period or a reference word (계획, 전년, baseline) |

## Two worked slides

Four steps with an accent numeral each; a step that opens with `1.` takes that number, and the rows
spread down the body.

```markdown
---
layout: process

## 앱 주문부터 배송까지 네 단계

- **1. 접수** 앱에서 품목과 수거 시간대를 고르면 5분 안에 기사가 배정된다
- **2. 수거** 기사가 문 앞에서 사진을 남기고 제휴 세탁소로 옮긴다
- **3. 세탁** 제휴 세탁소가 48시간 안에 세탁하고 검수 사진을 앱에 올린다
- **4. 배송** 지정한 저녁 시간대에 배송하고 문 앞 사진으로 완료를 알린다
---
```

The ask lists four uses of the money, each keyed by its amount with a share bar, and states the
request on the field band. Four rows and three lines of next step fit; a fifth row would send the
slide back to the table.

```markdown
---
layout: closing-ask

## 18개월 운영 자금 24억 원 사용 계획

| 쓰임 | 금액 | 시점 |
|---|---|---|
| 수거·배송 권역 확대 (6개 구에서 12개 구) | 10억 원 | 2027년 상반기 |
| 제휴 세탁소 품질 점검 체계 | 6억 원 | 2026년 4분기 |
| 앱 개발 인력 | 5억 원 | 상시 |
| 제휴 세탁소 90곳 모집과 운영 예비비 | 3억 원 | 2027년 1분기 |

- 요청: 18개월 운영 자금 24억 원 투자 승인
- 기대 성과: 18개월 뒤 월 주문 4만 건, 월 영업이익 흑자 전환
- 다음 단계: 12월 첫째 주 실사 미팅, 담당 예시 재무팀
---
```

Both slides compile under `tonality: signal` with a cover and pass `qa_deck.py`; the example company
and the figures are invented.
