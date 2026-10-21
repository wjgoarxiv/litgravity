# Atlas

Atlas is a picture book with good captions. Photographs bleed to the edge or take most of the body,
titles sit on a dark panel over the picture or under it, and the words stay short and calm while
carrying what each picture needs: what, where, when and how much. The palette is quiet on purpose, a
near-black ink and one muted navy, because the photographs bring the colour. Every picture carries a
numbered caption with its source, which keeps the deck honest about what the reader is looking at.

## When to choose it

Use Atlas when the evidence is visual: product reports, portfolios, site and field visits,
renovation or construction progress, exhibitions. Ten families are listed and five of them are built
on pictures (`image-full`, `image-split`, `photo-grid`, `figure-pair`, `asymmetric-feature`), so the
direction pays off when about a third of the slides hold a real image or a screenshot. It suits a
client or a review panel who judges by seeing, with short narrative text between the pictures.

The pack file says what breaks it: few real images. A look built around pictures turns into empty
boxes without them, so a text or number deck belongs in Ledger, Gazette or Signal. Long tables sit
awkwardly here because the table style is light and the families give the room to images.

## Tokens

| Token | Value |
|---|---|
| ground / surface | #FFFFFF / #F3F4F5 |
| ink / ink-muted / line | #1A1D21 / #555B63 / #D6D9DD |
| accent / accent-deep / accent-tint | #2B4C7E / #1B2F4E / #E6ECF4 |
| field / on-field | #1A1D21 / #FFFFFF |
| positive / negative | #1E7A3F / #B3261E |
| series | #2B4C7E, #555B63, #8A6A2E, #3E7A5A |
| faces | Pretendard Regular for display, body, label and numerals, Pretendard Bold for titles; `faces: a2z` moves display and numerals to A2Z Light |
| tracking (title / display) | 0 % / -1 % of the size |
| density / variance | 10 / 7 (up to 5 title treatments, all five of the pack) |
| radius / edge | 0 / fill |
| table | no header fill, a bold ink header, hairline row rules, no banding, bold totals |
| chart | hairline gridlines, direct labels, accent on the highlighted series |
| image | no frame |
| decoration | caption-band, hairline-rule, colour-field |
| fill-order | anchor-visual, change-family, distribute, step-up |

The compact ramp applies (body 13 pt, label 11, title 26, display 36, cover 44). A picture family
spreads the picture over most of the body, so type size rarely decides the page; the caption sets at
label size under its picture and the source stays inside the caption after a bar.

## Titles by family

The role defaults: images `overlay`, data with a takeaway `bottom-anchor`, content, references and
definitions `side-rail`, data and sequences `top-plain-large`, statements `statement`. The `overlay`
frame is a field panel at 88 % opacity over the lower left of a full-bleed picture (columns 1-7,
starting at y 324), with the title at y 348 and the caption at y 432; only `image-full` takes it.
`title: top-plain-large` after `layout:` pins one slide, provided the family allows it.

| Family | Default title | Then, in pack order |
|---|---|---|
| `image-full` | `overlay` | none |
| `image-split` | `bottom-anchor` | `side-rail`, `top-plain-large` |
| `photo-grid` | `bottom-anchor` | `top-plain-large` |
| `figure-pair` | `bottom-anchor` | `side-rail` |
| `asymmetric-feature` | `bottom-anchor` | `top-plain-large` |
| `kpi-row` | `top-plain-large` | `bottom-anchor`, `side-rail` |
| `comparison` | `top-plain-large` (numbers) / `side-rail` (arguments) | `bottom-anchor`, `side-rail`, `top-plain-large` |
| `timeline` | `top-plain-large` | `bottom-anchor` |
| `text-column` | `side-rail` | `top-plain-large` |
| `statement` | `statement` | none |

## Families and variants

- `image-full`: one picture across the slide with the title and caption on its panel.
- `image-split`: a large image beside three to five short facts.
- `photo-grid`: two or three images in a row with one line under them.
- `figure-pair`: before and after, or two places, with one line of evidence.
- `asymmetric-feature`: one image or number with the larger share of the width.
- `kpi-row`: two to six numbers that prove the pictures, each with a basis row.
- `comparison`, `timeline`, `text-column`: options, dated next steps and the short narrative that
  links picture groups.
- Covers `cover-full-image`, `cover-split-image`, `cover-typographic`; sections `section-image`,
  `section-field`; closings `closing-contact-split`, `closing-ask`.

A cover takes no image block of its own. The engine reads the first image on any content slide of the
deck, so put the picture on a slide and the cover finds it; `cover-full-image` puts a panel as tall as
the title and its meta line on the page foot, so the picture keeps the rest. A section needs its own
image on the section slide for `section-image`.

Display devices: without a picture the typographic cover is a `plate`, a dark field from y 288 to the
foot with the title in at most two lines, like a caption under a photograph that is absent; a pull
quote is `drench`, the whole page in the field with the quotation in white; a big number sits on the
accent tint; a closing's next step runs as a dark `band` above the footer, and `closing-contact-split`
holds each row's date or amount on a field beside the rows.

## Do

- Give every photograph a numbered caption with its source: `![도 2. 오후 3시의 창가 | 출처: 예시 이미지](assets/example-b.png)`.
- Let one image dominate each slide and write the facts next to it in short lines, each with a number,
  a date or a place; the first fact carries the claim.
- Title each slide with a label (place, subject, period).
- Keep narrative slides brief and use them to move between picture groups.
- End with the ask and the dated next step.

## Avoid

- Text laid straight on a photograph; the panel carries the words.
- Images in card frames and rows of more than three images.
- Grey sample boxes in a delivered deck.
- Claims in titles; the caption or the first fact of the picture that proves them carries the claim.

## Failure patterns

| Symptom | Cause | Fix |
|---|---|---|
| `Compilation error: Slide 2: no atlas treatment (overlay, bottom-anchor, side-rail, top-plain-large, statement) fits the image-full family (overlay) on this slide; choose another layout family or tonality` | `image-full` without an image | add the picture or use a text family |
| `note: slide 1: cover-full-image cannot be drawn (the deck has no image)` then `drawn as cover-typographic` | no content slide holds a picture | add one, or name `cover-typographic` |
| `note: slide 1: section-image cannot be drawn (the section slide has no image)`, drawn as `section-field` | the picture sits on another slide | put the image on the section slide |
| a fourth image disappears from a `photo-grid` | the family draws up to three images | split into two slides |
| a picture with no number under it | the alt text is empty, so no caption exists | write the alt text as the caption |

## Two worked slides

One picture across the page with its label title and caption on the panel; the caption states what
the picture shows and when it was taken.

```markdown
---
layout: image-full

## 재개관 후 동부분관 열람실

![도 1. 거리 쪽으로 열린 열람실, 2026년 9월 촬영 | 출처: 예시 이미지](assets/example-a.png)
---
```

Three pictures side by side with one sentence under them that states the common finding. The
engine numbers the captions (도 2, 도 3, 도 4) in the deck's language.

```markdown
---
layout: photo-grid

## 열람실 세 구역 공사 후 모습

![도 2. 창가 좌석 구역 | 출처: 예시 이미지](assets/example-a.png)

![도 3. 어린이 열람 구역 | 출처: 예시 이미지](assets/example-b.png)

![도 4. 토론실 구역 | 출처: 예시 이미지](assets/example-c.png)

- 세 구역 모두 공사 전보다 좌석이 늘었고 동선이 넓어졌다
---
```

Both slides compile under `tonality: atlas` after a generic `layout: cover` (drawn as
`cover-full-image` from the deck's first picture) and pass `qa_deck.py`. The image files are the three
bundled example pictures; the library and its figures are invented.
