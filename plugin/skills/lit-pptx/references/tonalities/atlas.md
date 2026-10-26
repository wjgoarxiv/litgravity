# Atlas

Atlas is a picture book with good captions. Photographs bleed to the edge or take most of the body,
titles sit on a dark panel over a full-bleed picture or in the slide grid's title zone above it, and the words stay calm but carry the
facts each picture needs: what, where, when and how much. The
palette is quiet on purpose, a near-black ink and one muted navy, because the photographs bring the
colour. Every picture carries a numbered caption and its source, which keeps the deck honest about
what the reader is looking at.

## When to use it

Use Atlas when the evidence is visual: product reports, portfolios, site and field visits,
renovation or construction progress, exhibitions. It is the first candidate for the image-led deck
type and moves up whenever a third or more of the slides hold an image or a screenshot. It works for
a client or a review panel who judges by seeing, and it suits short narrative text between pictures.

## When it is the wrong choice

Atlas fails without real images. A pack built around pictures turns into grey boxes when the
source has none, so for a text or number deck pick Ledger, Gazette or Signal. It keeps a
statement for the one claim a picture deck needs, but a deck that lives on one-line claims belongs
in Signal or Studio. Long tables also sit awkwardly here, because its table style is light and its
families give
the room to images.

## Tokens

These values are read from the pack file `pack.yaml` of the `atlas` tonality.

| Token | Value |
|---|---|
| ground / surface | `#FFFFFF` / `#F3F4F5` |
| ink / ink-muted | `#1A1D21` / `#555B63` |
| line | `#D6D9DD` |
| accent / accent-deep / accent-tint | `#2B4C7E` / `#1B2F4E` / `#E6ECF4` |
| field / on-field | `#1A1D21` / `#FFFFFF` |
| positive / negative | `#1E7A3F` / `#B3261E` |
| series | `#2B4C7E`, `#555B63`, `#8A6A2E`, `#3E7A5A` |
| faces | title Pretendard Bold, body, label, display and numerals Pretendard Regular; `faces: a2z` swaps display and numerals to A2Z Light |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 7 |
| radius / edge | 0 / fill |
| table | light grid: no header fill, bold ink header, hairline rows, no banding, numbers right-aligned, totals bold |
| chart | hairline gridlines, direct labels, accent on the item that matters |
| image | no frame |
| decoration | caption band, hairline rule, colour field |

## Treatments by slide role

Image slides take `overlay`, where the title sits on a dark panel over a full-bleed photograph.
Charts and figures with a takeaway take `bottom-anchor`, the title closed by a heavy rule over a
visual that takes the body's full height. Text, reference and definition slides take `side-rail`, data and
sequences take `top-plain-large`, and a pull quote takes `statement` on the dark field over the
whole page (a plate under half the page left its top half open). The
engine starts from the role's treatment and, when
the body would stay half empty, tries the others the family allows and keeps the one that fills,
within the variance cap. A `title: <treatment>` line under `layout:` pins one slide, provided the
family allows it; `image-full` only ever takes `overlay`.

## Families and variants

- `image-full`: one photograph across the whole slide with the title on its panel.
- `image-split`: a large image beside three or four short facts about it.
- `photo-grid`: up to three images in a row, with one line under them.
- `figure-pair`: before and after, or two places, side by side with one line of evidence.
- `asymmetric-feature`: one image or number given most of the width, with short evidence.
- `kpi-row`: two to four numbers that prove the pictures, each with a basis row and a sourced caption.
- `comparison`: two options or two problems, row by row.
- `timeline`: dated next steps on one axis.
- `text-column`: the short narrative that opens or links the picture sections.

Covers are `cover-full-image` (it takes the first image in the deck; the title's panel is only as
tall as the title and its meta line and stands on the foot of the page, so the picture keeps the rest), `cover-split-image` and
`cover-typographic`. Sections are `section-image` and `section-field`. Closings are
`closing-contact-split` and `closing-ask`. A cover takes no image block of its own; put the picture
on a content slide and the cover finds it.

Display slides. Without a picture, the typographic cover puts the title on a dark plate over the
lower part of the page, like a caption under a photograph that is not there. A pull quote fills the
page with the dark field, the quotation in the middle. A closing's rows carry their dates or amounts at title size, and the next step runs in a dark
band above the footer.

## Do

Give every photograph a numbered caption with its source. Let one image dominate each slide, and
write the facts about it next to it in short lines, with a number, a date or a place in each. Title
each slide with a label (place, subject, period) and let the first fact carry the claim. Keep the
narrative slides brief and use them to move from one group of pictures to the next. End with the ask
and the dated next step.

## Avoid

Avoid text placed straight on a photograph without the panel, images in card frames, and more than
three images in one row. Never deliver a deck with grey sample boxes in place of the real pictures.
Keep the `statement` family for a pull quote; claims belong in the first fact or the caption of the
picture that proves them, never in the title.

## Two worked slides

An image-split slide puts the picture first and five short facts beside it, the claim in the first,
so the reader gets the evidence without a paragraph.

```markdown
---
layout: image-split

## 재개관 첫 주 창가 좌석 이용 현황

![도 2. 오후 3시의 창가 좌석 | 출처: 예시 이미지](assets/example-b.png)

- **요약** 창가 좌석은 개관부터 마감까지 하루 종일 차 있다
- **좌석 수** 창가 좌석을 24석에서 56석으로 늘렸다
- **점유율** 재개관 첫 주 오후 점유율이 92%였다
- **조명** 창가에 차양을 달아 오후 눈부심 민원이 없었다
- **동선** 서가를 벽 쪽으로 옮겨 통로 폭이 1.2m에서 1.8m가 됐다
---
```

A figure pair shows the change, and the lines under both pictures state it with its basis.

```markdown
---
layout: figure-pair

## 공사 전후 어린이실 좌석 배치

![도 3. 공사 전 어린이실 | 출처: 예시 이미지](assets/example-b.png)

![도 4. 공사 후 어린이실 | 출처: 예시 이미지](assets/example-b.png)

- 공사 전후의 어린이실은 같은 방으로 보이지 않는다
- 낮은 서가와 계단식 좌석으로 동시 착석이 18명에서 40명으로 늘었다
- 주말 어린이실 이용은 하루 평균 95명에서 160명이 됐다 (예시)
---
```

## Examples

`08-image-led-atlas-ko.md` uses the pack defaults (density 10, variance 7).
