# Studio

Studio treats a deck like a magazine spread. The twelve-column grid shows through as thin column lines
in the gutters, titles often stand in a side rail or open the page at display size, real figures sit in
labelled panels with their basis, and pages split unevenly so that one side clearly leads. A dark ochre
accent marks the single thing to look at; everything else is black, warm grey and white. The pack
file states the trade: editorial white space that suits a story and starves a table.

## When to choose it

Studio fits stories told more than audited: a design or brand narrative, a strategy told through cases,
a public lecture, a portfolio of built work, a pitch that people judge by seeing the product. Eleven
families are listed and six carry pictures or big figures (`asymmetric-feature`, `big-number`,
`image-split`, `image-full`, `photo-grid`, `kpi-row`). Variance 8 allows five title treatments in one
deck, which is the point of the direction: the page head changes with the job of the page.

The splits starve table-heavy data. A business review with several tables, a status update, or a
briefing read at a desk needs more rows per page than Studio gives (Ledger or Gazette serve those). The
pack also needs real figures for its panels: a deck without counts, shares or years loses one of its
main devices.

## Tokens

| Token | Value |
|---|---|
| ground / surface | #FFFFFF / #F2F2F0 |
| ink / ink-muted / line | #141414 / #525252 / #D2D2CE |
| accent / accent-deep / accent-tint | #8A5A00 / #4D3200 / #F5ECD9 |
| field / on-field | #141414 / #FFFFFF |
| positive / negative | #1E7A3F / #B3261E |
| series | #8A5A00, #141414, #525252, #3B5F7F |
| faces | Pretendard Bold for display, title and numerals, Pretendard Regular for body and labels; `faces: a2z` moves display and numerals to A2Z Black and titles to A2Z Medium |
| tracking (title / display) | -1 % / -2 % of the size |
| density / variance | 10 / 8 (up to 5 title treatments, all five of the pack) |
| radius / edge | 0 / fill |
| table | no header fill, a 2 pt ink rule under the header, no row rules, bold totals |
| chart | no gridlines and no value axis, direct labels, accent on the highlighted series |
| image | no frame |
| decoration | column-hairlines, numeral, rail-fill, colour-field, caption-band |
| fill-order | change-family, step-up, anchor-visual, distribute |

Of the decoration entries, `column-hairlines` (a 0.5 pt line in the gutter before the right-hand region
of a split) and `rail-fill` (the side rail filled with the surface colour) change the drawing; the
others describe devices that the treatments and display keys already draw. Numbers stay at title size
(26 pt) or below on every pack; the editorial feel comes from the panel, the rail and the splits.

## Titles by family

Role defaults: content, data with a takeaway, sequences, images, references and definitions
`side-rail`; data `top-plain-large`; statements `statement`. The `overlay` frame belongs to
`image-full` alone. The engine tries every title a family allows, keeps the default while the body
fills, and caps any one title at about a third of the deck, so a deck of splits alternates its heads.

| Family | Default title | Then, in pack order |
|---|---|---|
| `asymmetric-feature` | `top-plain-large` | `bottom-anchor` |
| `big-number` | `side-rail` | `top-plain-large`, `bottom-anchor` |
| `image-split` | `side-rail` | `top-plain-large`, `bottom-anchor` |
| `image-full` | `overlay` | none |
| `photo-grid` | `top-plain-large` | `bottom-anchor` |
| `text-two-column` | `top-plain-large` | none |
| `chart-insight` | `side-rail` | `top-plain-large`, `bottom-anchor` |
| `kpi-row` | `top-plain-large` | `side-rail`, `bottom-anchor` |
| `timeline` | `top-plain-large` | `bottom-anchor` |
| `comparison` | `top-plain-large` (numbers) / `side-rail` (arguments) | `side-rail`, `bottom-anchor`, `top-plain-large` |
| `statement` | `statement` | none |

A `side-rail` title is four lines of about ten Korean glyphs; a longer title moves the slide to
another head and the log says so. `title: top-plain-large` after `layout:` pins one slide.

## Families and variants

- `asymmetric-feature`: a picture with the narrow share of the page and five short lines of argument.
- `big-number`: two to four real figures as a panel (value, label, basis) with the facts that explain
  them beside it; one figure alone sits on a panel as tall as it is.
- `image-split`, `image-full`: the work itself; the full-bleed slide puts its title on the panel.
- `photo-grid`: two or three pictures side by side with one shared sentence.
- `text-two-column`: a brief and a response, or two halves of an argument.
- `chart-insight`, `kpi-row`, `timeline`, `comparison`: the few numbers the story needs, a programme
  along one axis, before and after across shared rows.
- Covers `cover-split-image`, `cover-rail`, `cover-numeral`; sections `section-numeral`,
  `section-rail`; closings `closing-contact-split`, `closing-summary-list`.

The pack lists no `cover-typographic`. The generic `layout: cover` opens on the deck's first picture
when there is one (`cover-split-image`) and on the rail otherwise; `cover-numeral` needs a four-digit
year in the deck title or the `date` key.

Display devices: a statement stands between two hairlines on the open page (the offset rail stood
empty beside a sentence, so the pack uses `rules`); a big number is an ochre figure panel on the tint;
a closing's `closing-contact-split` keeps the field, which holds each row's amount or date in line with
its row, and the next step runs as a dark band on the page floor.

## Do

- Let the picture or the number lead each slide and keep the text to the side that serves it.
- Use a numeral only for a real figure (a count, a share, a year), with its label and basis.
- Title each slide with its topic; the claim opens the body beside the picture.
- Alternate the splits: after a `side-rail` slide, follow with a top title or a full-bleed picture.
- Keep titles short, about ten Korean glyphs a line in a rail.

## Avoid

- Numerals as ornaments, such as step numbers on points that are not a sequence.
- Column lines running through text; they belong in the gutters.
- Two `side-rail` slides with the same split back to back.
- Centred body text; every line aligns to the column lines.

## Failure patterns

| Symptom | Cause | Fix |
|---|---|---|
| `note: slide 2: table-insight is not a studio layout family (...); drawn with its own geometry` | a table page in an editorial deck | use `kpi-row`, `big-number` or `comparison`, or choose Ledger |
| `note: slide 1: cover-numeral cannot be drawn (the deck names no year or real figure)`, drawn as `cover-rail` | no year in the title or date | add `date: 2026년 5월` or name another cover |
| a big number with one figure draws a small panel | one figure with no basis row hugs its panel | give two to four figures with bases |
| the side rail leaves most of its column empty (OF-115) | a `title: side-rail` pin on a slide whose takeaways are one line | take `top-plain-large` or write four takeaways |

## Two worked slides

A portrait picture takes the narrow side and the five lines beside it fill the page; the first line
carries the claim. The title sits across the top and a column line separates the two sides.

```markdown
---
layout: asymmetric-feature

## 공방 작업대와 하루의 순서

![도 1. 오전 아홉 시의 작업대 | 출처: 예시 이미지](assets/example-c.png)

- 하루는 흙을 치대는 일로 시작한다
- 작업대 하나에서 물레, 유약, 포장까지 모두 한다
- 한 사람이 하루에 빚는 그릇은 평균 18점이다 (예시)
- 유약을 바른 그릇은 일주일 말려 가마에 넣는다
- 가마는 매주 목요일 한 번 불을 땐다
---
```

A big number as a panel of three related figures with their bases; the evidence stands in the rail
under the title, and the panel takes the tint.

```markdown
---
layout: big-number

## 공방 수업과 주문 현황

| 정규 수강생 | 재수강 비율 | 단체 주문 |
|---|---|---|
| 64명 | 71% | 12건 |
| 2026년 4월 기준 | 지난 학기 수강생 중 | 올해 1~4월 |

> 공방 운영 현황, 예시 내부 기록 2026년 4월

- 수강생 열에 일곱은 다음 학기에도 등록한다
- 단체 주문은 카페와 식당에서 가장 많이 들어온다
- 수업 시간표를 주 5일에서 주 6일로 늘릴 계획이다
---
```

Both slides compile under `tonality: studio` after a generic cover (drawn as `cover-split-image` from the
first picture) and pass `qa_deck.py`, with an `OF-105` and an `OF-109` advisory on the second. The
workshop and its figures are invented; the picture is the bundled example image.
