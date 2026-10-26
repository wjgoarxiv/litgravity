# Chalk

Chalk is a good teacher's board after someone has tidied it. Steps are numbered because they really
happen in order, one idea per slide is marked as the thing to learn and worked through with its
numbers, and the definition or the
common mistake sits in its own fenced box at the side. Surfaces have soft corners, the ground is a
cool near-white, and a warm rust accent always points at what is being taught. The rhythm is
deliberate: explain, show, try, check.

## When to use it

Choose Chalk for lectures, tutorials, onboarding sessions and training, where the audience has to be
able to do something afterwards. It is the first candidate for the lecture deck type and a good
second for a research talk given as a tutorial. It climbs the list when the source contains
equations, definitions or a "how it works" sequence of three or more steps, which are exactly the
slides its numbered and sidebar families are built for.

## When it is the wrong choice

Chalk is wrong for decision decks. A board of numbered steps in front of executives reads as padding
and slows the ask; Ledger or Signal fit that room. It is also a poor match for a dense data review,
because its families favour a few explained items over many numbers on one page, and for
image-led portfolios, where Atlas lets pictures carry the slides.

## Tokens

These values are read from the pack file `pack.yaml` of the `chalk` tonality.

| Token | Value |
|---|---|
| ground / surface | `#FAFBFC` / `#EEF2F5` |
| ink / ink-muted | `#1F2933` / `#4E5A66` |
| line | `#CBD3DA` |
| accent / accent-deep / accent-tint | `#9A3412` / `#6B2409` / `#FCEBE0` |
| field / on-field | `#1F3B33` / `#FFFFFF` |
| positive / negative | `#1E7A3F` / `#B3261E` |
| series | `#9A3412`, `#1F3B33`, `#4E5A66`, `#2E6A8E` |
| faces | Pretendard Bold for display, title and numerals, Pretendard Regular for body and labels; `faces: a2z` swaps to A2Z Bold display and titles, A2Z Black numerals |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 6 |
| radius / edge | 6 / fill |
| rail | the side rail is a field-coloured fill |
| table | header row in the accent tint with deep-accent bold text, hairline rules between rows, no banding, numbers right-aligned, totals bold |
| chart | hairline gridlines, direct labels, accent on the item that matters and muted colours on the rest |
| decoration | accent rule, marked term underline, rail fill, numeral |

The marked-term underline is listed in the pack but the engine does not draw it yet, so mark the
term
in the wording for now.

## Treatments by slide role

Sequences take `kicker-numeral`, where the step or part number stands right of the title, in the accent. Text
and data slides take `top-rule` with its short accent bar, chart and image slides with a takeaway
take `side-rail`, definitions take `side-rail`, a comparison sets its criteria as row heads in the body under a
`side-rail` title (the pack's `structure`), and a pull quote takes `statement`. When a slide's own
treatment would leave the body half empty, the engine tries the other treatments its family allows
and keeps the one that fills best, within the number of treatments the variance dial allows. A
`title: top-rule` line under `layout:` pins a slide to a treatment; the lecture example does that
for
a method slide whose definitions need the full width. An agenda carries no numeral (OF-119), so a
chalk deck whose only kicker was its agenda needs a step or sidebar slide under `kicker-numeral` to
keep three treatments (OF-110), and a sidebar note set across the top adds one more top-title slide
in a grid, which can carry top/grid past 40 % of the content slides (OF-111).

## Families and variants

- `step-diagram`: numbered steps across the body, each with its action and detail.
- `process`: the same steps when they read as a flow rather than a procedure.
- `method`: a formula with the meaning of each symbol under it.
- `sidebar-note`: the explanation with a fenced box for the definition or the trap.
- `comparison`: two ideas students confuse, side by side row by row.
- `image-split`: a worked example with its figure.
- `quote`: a line worth remembering, set as a statement.
- `agenda`: what the session covers, numbered.
- `statement`: a pull quote or the lesson's rule, kept for a display-led deck the user asks for.
- `text-column`: an explanation at reading measure.
- `table-insight`: a small table with the pattern spelled out beside it.

Covers are `cover-rail`, `cover-typographic` and `cover-numeral`. Sections are `section-numeral` and
`section-rail`. Closings are `closing-summary-list` (the recap plus the exercise) and `closing-ask`.

Display slides. The typographic cover is the board-green rail with the topic name beside it. A
statement is written on the board: the whole slide in the field green, the quoted line in white. A section
numeral reads as the part of the whole ("03 / 04") when the deck has an agenda. A closing's rows are
keyed by their dates, and the next step sits in a tinted box on the body floor.

## Do

Use numbers only for things that happen in order or for real parts of the session. Put every
definition and every common mistake in a sidebar box, where students can find it again. Give each
worked example the actual arithmetic, step by step, with a sample value at each step. Title each
slide with what it teaches ("신뢰구간 계산 네 단계"), and put the rule in the first line of the body. End with what was learnt and what to practise,
with a due date.

## Avoid

Avoid more than one marked term per slide; two underlines mean neither is the point. Avoid numerals
on points that are not a sequence. Do not bury a definition inside a bullet list. Avoid a sentence
as a title; the slide names the topic and the body states the rule.

## Two worked slides

A step slide spells out each action, its detail and a worked value, so the steps fill the body and
can be followed without the speaker.

```markdown
---
layout: step-diagram

## 95% 신뢰구간 계산 네 단계

- **1. 평균 구하기** 표본 값의 합을 n으로 나눈다 · 예: 키 표본 25명, 평균 168cm
- **2. 표준편차 구하기** 편차 제곱의 평균에 제곱근을 씌운다 · 예: 10cm
- **3. 표준오차 구하기** 표준편차를 √n으로 나눈다 · 예: 10 ÷ 5 = 2cm
- **4. 구간 만들기** 평균 ± 1.96 × 표준오차 · 예: 164.1-171.9cm
---
```

A sidebar slide names each wrong reading and why it fails, and keeps the right reading in the box;
the title labels the topic.

```markdown
---
layout: sidebar-note
title: top-rule

## 신뢰구간 해석의 흔한 오류 두 가지

- **참값이 이 구간 안에 있을 확률이 95%라는 읽기**
  (1) 참값은 정해진 하나의 수라서 확률로 말하지 않는다
  (2) 확률은 구간을 만드는 방법에 붙는 말이다
- **학생의 95%가 이 구간 안에 있다는 읽기**
  (1) 구간은 평균에 대한 것이고 개인 값의 범위가 아니다
  (2) 개인 값의 범위는 표준편차로 따로 말한다

::: main-box
같은 방법으로 구간을 100번 만들면 약 95개가 참값을 담는다고 읽는다
:::

- **확인 질문** 표본을 100명으로 늘리면 구간 폭은 어떻게 바뀌는가 (답: 절반)
---
```

## Examples

`06-lecture-chalk-ko.md` and `12-research-tutorial-chalk-en.md` both use the pack defaults (density
10, variance 6).
