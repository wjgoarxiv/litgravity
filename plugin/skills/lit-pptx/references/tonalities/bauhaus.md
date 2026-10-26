# Bauhaus

Bauhaus is the direction for a talk about making things: design, architecture, craft, art history,
culture. Its display slides carry an elementary composition, a yellow square, a red circle, a black
bar and a blue triangle set on the grid, beside a heavy title on an off-white ground. The content
slides are quiet on purpose: black type, a short red rule under each title, open tables and one red
accent. The geometry is the voice, so it appears where the deck speaks (the cover and the
statements) and stays out of the pages where the audience reads.

## When to use it

Reach for Bauhaus for a design or architecture lecture, a museum or exhibition opener, a workshop on
brand or product design, a culture programme, a portfolio review for a design school, or a talk on
the history of a style. The content signals that point here are images and few numbers, a sequence
of ideas or periods, quotations from makers, and words such as 디자인, 건축, 전시, 워크숍, 바우하우스,
Bauhaus, modernism or "primary colours". It is the first candidate for a design or culture lecture,
before Studio, and the second for a creative workshop.

## When it is the wrong choice

It fails for a data-heavy business review, finance, a public-sector report and any deck where tables
make up a third of the slides: the display geometry has nothing to say about a ledger. It is wrong
for grief, safety or financial-loss topics, where primary colours read as careless. For a deck that
is mostly pictures, Atlas or Studio frames them better; for a pitch, Signal or Neo-Brutalism.

## Tokens

The values below come from the pack file and are what the engine draws.

| Token | Value |
|---|---|
| ground / surface | #F4F1EA / #E8E3D6 |
| ink / ink-muted / line | #141414 / #4A4740 / #141414 |
| accent / accent-deep / accent-tint | #C8261C / #7A140E / #F2C230 (the yellow of the geometry) |
| field / on-field | #1F3C99 / #FFFFFF |
| positive / negative | #1E6B3A / #141414 |
| series | #C8261C, #1F3C99, #141414, #9E7700 |
| faces | Pretendard Bold for display, title, labels and numerals, Pretendard Regular for body; `faces: a2z` swaps to A2Z Black display, titles and numerals |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 7 |
| radius / edge | 0 / fill |
| decoration | a short accent rule under top titles, kicker numerals, colour fields |
| table | open, no header fill, a rule under the header, bold totals |
| chart | no gridlines, direct labels, the accent on the highlighted series over muted ones |

Density 10 sets the lecture on the compact grid (24 pt side margins), body 13 pt and no step-up, as
every pack in the family. The fourth series colour
is the geometry's yellow darkened to an ochre so a bar still holds 3:1 on the ground; the bright
yellow itself is kept for fills (the square, the notice tag, a highlighted table row), never for text.
A loss uses ink with a ▼ sign.

## QA allowances

Red, blue and yellow sit side by side on a cover, statement or content slide inside the default
OF-101 limit (four hue families; a fifth fails), so this pack needs no `qa:` allowance.

## Treatments by slide role

Content, data and reference slides take `top-rule` (the title over a short red rule); data with a
takeaway and definitions take `side-rail`; sequences `kicker-numeral`; image slides `bottom-anchor`;
statements `statement`. The engine lays out every treatment the family allows, keeps the role's own
when the body fills, and otherwise takes the one that leaves the least empty band. Force one with
`title: <id>` on the line after `layout:`.

## Families and variants

- `asymmetric-feature` and `image-split` pair a work or a building with what to see in it.
- `timeline` places periods, schools or projects in order.
- `process` and `step-diagram` set a making process in three to five steps.
- `comparison` and `text-two-column` read two works, two periods or two methods side by side.
- `big-number`, `kpi-row`, `chart-insight` and `table-insight` carry the few figures such a talk has.
- `quote` sets a maker's sentence; `statement` holds one idea at display size.
- `agenda` opens a workshop with its sessions.

Covers are `cover-typographic`, `cover-split-field` and `cover-numeral`; sections are
`section-field` and `section-numeral`; closings are `closing-ask`, `closing-summary-list` and
`closing-statement`.

Display slides. The typographic cover sets the topic at display size on the left half and the
composition on the right half: the yellow square and red circle above, the black bar and blue
triangle below, each in its own grid cell. A statement sets its sentence on the left and a narrower
composition from column 10 to the edge. A big number is a blue field panel. A closing's next step
stands between two rules; a closing statement takes the statement's composition.

## Do

- Keep the geometry on the cover and the statements; content slides carry type, images and data.
- Use one statement per section at most, so the composition stays an event.
- Caption every work with maker, year and source.
- Let red mark one word or one figure on a content slide.

## Avoid

- Circles, squares or triangles as bullets, icons or frames on content slides.
- Yellow text on the off-white ground.
- A fifth hue family beside the three primaries and the ink.
- This direction for a ledger, a finance review or a sensitive topic.

## Two worked slides

A lecture slide pairs a building with what to see in it, and lets the caption carry the source.

```markdown
---
layout: image-split

## 데사우 교사(校舍)의 세 가지 설계 원칙

![도 1. 데사우 교사 전경 | 출처: 예시 이미지](assets/example-a.png)

- **기능별 동** 공방, 교실, 기숙사를 각각의 동으로 나눠 다리로 잇는다
- **유리 커튼월** 공방 동의 외벽 전체가 유리라 작업이 밖에서 보인다
- **비대칭 배치** 정면이 없어, 걸으며 돌아봐야 전체가 읽힌다
- 출처: 예시 건축사 강의 자료, 2026년 (예시)
---
```

A timeline places the school's three sites in order, with what changed at each.

```markdown
---
layout: timeline

## 학교의 세 시기, 1919-1933년

| 시점 | 장소 | 무엇이 바뀌었나 |
|---|---|---|
| 1919년 | 바이마르 | 공방 중심 교육, 표현주의의 영향이 강하다 |
| 1925년 | 데사우 | 산업 생산과의 협업, 표준화된 제품 디자인 |
| 1932년 | 베를린 | 사립 학교로 축소, 이듬해 문을 닫는다 |

> 표 1. 바우하우스의 세 시기 (예시 자료)

- 출처: 예시 디자인사 강의 노트, 2026년 (예시)
---
```

## Examples

`15-design-lecture-bauhaus-ko.md`
