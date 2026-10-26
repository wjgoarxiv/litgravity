# Studio

Studio treats a deck like a magazine spread. The twelve-column grid shows through as thin column
lines, titles carry a bar in the left margin or open the page at display size, real figures sit in labelled
panels with their basis, and pages split unevenly so that one side clearly leads. A dark ochre accent marks the single
thing to look at; everything else is black, grey and white.

## When to use it

Studio fits stories that are told more than they are audited: a design or brand narrative, a
strategy told through cases, a public lecture, a portfolio of built work, or a pitch for a product
people judge by seeing it. The content signals that move Studio up are a high share of slides with
pictures (about 30% or more) and short to medium bodies. It is the second candidate for pitches,
image-led decks and public lectures, and it can lead when the pictures are strong but the narrative
matters as much as the images.

## When it is the wrong choice

The editorial splits starve table-heavy data. A business review with several tables, a status
update or a briefing that is read at a desk all need more rows on each page than Studio's uneven
splits give them; Ledger or Gazette serve those. Studio also needs real figures for its numeral
panels: a deck without counts, shares or years loses one of the direction's main devices.

## Tokens

Read from the pack file; these are the values the engine draws.

| Token | Value |
|---|---|
| ground / surface | #FFFFFF / #F2F2F0 |
| ink / ink-muted / line | #141414 / #525252 / #D2D2CE |
| accent / accent-deep / accent-tint | #8A5A00 / #4D3200 / #F5ECD9 |
| field / on-field | #141414 / #FFFFFF |
| positive / negative | #1E7A3F / #B3261E |
| series | #8A5A00, #141414, #525252, #3B5F7F |
| faces | Pretendard Bold for display, title and numerals, Pretendard Regular for body and labels; `faces: a2z` swaps to A2Z Black display and numerals, A2Z Medium titles |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 8 |
| radius / edge | 0 / fill |
| table | open style, no header fill, a 2 pt ink rule under the header, no row rules, bold totals |
| chart | no gridlines, direct labels, accent on the highlighted series over muted ones |

Density 10 puts the deck on the compact grid with body 13 pt. Variance 8 lets one deck mix up to five
title treatments, which is the point of this direction.

## Treatments by slide role

Content, data with a takeaway, references, definitions and sequences take `side-rail`; data
slides take `top-plain-large`; a pull quote takes `statement`; image slides take `side-rail`, with the
picture and its facts split unevenly in the body under the title; the `image-full` family takes `overlay`. For each slide the engine tries every
treatment its family
allows and keeps the role default when the body fills, otherwise the one that leaves the least empty
band, while keeping any single treatment under about a third of the deck. A line such as
`title: top-plain-large` after `layout:` overrides that choice for one slide.

## Families and variants

- `asymmetric-feature` gives a tall picture the narrow side and four lines of argument the wide one.
- `big-number` sets two to four real figures as a panel (value, label, basis) with the facts that
  explain them.
- `image-split` and `image-full` carry the work itself; the full-bleed slide puts its title on a
panel.
- `photo-grid` shows two or three pictures side by side with one shared sentence.
- `text-two-column` holds a brief and a response, or two halves of an argument.
- `chart-insight` and `kpi-row` carry the few numbers the story needs.
- `timeline` shows a programme or a history along one axis.
- `comparison` reads before and after across shared rows.

Covers are `cover-split-image` (which takes the deck's first picture), `cover-rail` and
`cover-numeral`; sections are `section-numeral` and `section-rail`; closings are
`closing-contact-split`
and `closing-summary-list`.

Display slides. The cover opens on the deck's first picture when there is one, otherwise on the
rail. A statement stands between two hairlines on the open page (a light rail beside it stood empty). A
big-number panel stands in ochre on its tint, its figures at title size. The contact-split closing keeps the field: it holds each
row's amount or date in line with its row, and the next step runs under the rows on the white side.

## Do

- Let the picture or the number lead each slide and keep the text to the side that serves it.
- Use a numeral only for a real figure (a count, a share, a year), with its label and basis.
- Title each slide with its topic; the claim opens the body beside the picture.
- Alternate splits: after a side-rail slide, follow with a top title or a full-bleed picture.
- Keep titles short; a title has about 29 Korean glyphs per line at reading size and two lines at
  most, and a longer one moves the slide to another treatment.

## Avoid

- Numerals used as ornaments, such as step numbers on points that are not a sequence.
- Column lines running through text; they belong in gutters.
- Two side-rail slides with the same split back to back.
- Centred body text; Studio aligns everything to the column lines.

## Two worked slides

A tall portrait picture takes the narrow side, so the five facts beside it fill the page; the first
carries the claim.

```markdown
---
layout: asymmetric-feature

## 1인 가구 이사 주기와 가구 폐기 실태

![도 1. 이사 철 배출된 가구 | 출처: 예시 이미지](assets/example-c.png)

- 1인 가구는 2년마다 이사하며 가구를 버린다
- 수도권 1인 가구의 평균 거주 기간은 2.1년이다 (예시 조사)
- 이사 때 버려지는 가구의 절반은 산 지 3년이 안 된 것이다
- 대형 폐기물 수수료와 운반비로 한 번에 평균 9만 원을 쓴다
- 새 집 구조에 맞지 않아 버리는 경우가 가장 많다
---
```

A full-bleed picture carries its label title on a panel; the caption, which states what changed,
stays on the panel with it.

```markdown
---
layout: image-full

## East branch reading room after the renovation

![East branch reading room, now open onto its street (glazed front, 2026) | Source: example image](assets/example-a.png)
---
```

## Examples

`02-pitch-studio-ko.md`, `11-portfolio-studio-en.md`
