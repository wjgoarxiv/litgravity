# Chalk

Chalk is a good teacher's board after someone has tidied it. Steps are numbered because they really
happen in order, one idea per slide is marked as the thing to learn and worked through with numbers,
and the definition or the common mistake stands in its own fenced box at the side. Corners are soft
(radius 6), the ground is a cool near-white, the board itself is a deep green rail, and a warm rust
accent points at what is being taught. The rhythm is deliberate: explain, show, try, check.

## When to choose it

Choose Chalk for lectures, tutorials, onboarding sessions and training, where the audience has to be
able to do something afterwards. The pack carries eleven families, four of them built for teaching:
`step-diagram` and `process` for sequences, `method` for a formula with its symbols, and
`sidebar-note` for the definition or the trap. It climbs the list when the source holds equations,
definitions or a "how it works" sequence of three or more steps.

The pack file names the mismatch: decision decks. A board of numbered steps in front of executives
reads as padding and slows the ask; Ledger or Signal fit that room. Dense data reviews also fit
badly, because the families favour a few explained items over many numbers on one page.

## Tokens

| Token | Value |
|---|---|
| ground / surface | #FAFBFC / #EEF2F5 |
| ink / ink-muted / line | #1F2933 / #4E5A66 / #CBD3DA |
| accent / accent-deep / accent-tint | #9A3412 / #6B2409 / #FCEBE0 |
| field / on-field | #1F3B33 / #FFFFFF |
| positive / negative | #1E7A3F / #B3261E |
| series | #9A3412, #1F3B33, #4E5A66, #2E6A8E |
| faces | Pretendard Bold for display, title and numerals, Pretendard Regular for body and labels; `faces: a2z` moves display and titles to A2Z Bold and numerals to A2Z Black |
| tracking (title / display) | -1 % / -1 % of the size |
| density / variance | 10 / 6 (up to 4 title treatments, all four of the pack) |
| radius / edge | 6 / fill |
| rail | `field`: the side rail is a filled board in the field colour with the title in white |
| table | header in accent-tint with accent-deep bold text, hairline row rules, no banding, bold totals |
| chart | hairline gridlines, direct labels, accent on the highlighted series |
| image | no frame |
| decoration | accent-rule, mark-underline, rail-fill, numeral |
| fill-order | distribute, step-up, change-family, anchor-visual |

Of the four decoration entries, `accent-rule` (the short bar under a `top-rule` title), `rail-fill`
(the green board) and the numerals are drawn. The marked term is set by writing the word between
double asterisks in the title: `## 표준편차를 **읽는** 두 가지 방법` colours that word in the accent
(`mark-underline` is accepted by the pack validator and draws nothing of its own).

## Titles by family

The role defaults: sequences `kicker-numeral`, content, data and references `top-rule`, data with a
takeaway, images and definitions `side-rail`, statements `statement`. The pack's `structure` entry draws
a `comparison` under `side-rail`, so the criteria stand on the board; that choice survives the deck's
share limit for one title. Each family narrows the role default to what it allows:

| Family | Default title | Then, in pack order |
|---|---|---|
| `step-diagram` | `top-rule` | none |
| `process` | `top-rule` | `side-rail` |
| `method` | `side-rail` | `top-rule` |
| `sidebar-note` | `top-rule` | `kicker-numeral`, `side-rail` |
| `comparison` | `side-rail` | `top-rule` |
| `image-split` | `side-rail` | `top-rule` |
| `quote` | `statement` | `top-rule` |
| `agenda` | `top-rule` | `kicker-numeral`, `side-rail` |
| `statement` | `statement` | none |
| `text-column` | `top-rule` | `kicker-numeral`, `side-rail` |
| `table-insight` | `top-rule` | `side-rail` |

`kicker-numeral` needs a part number from a section slide and stays out of `step-diagram`, `process` and
`agenda`, which have numerals of their own; it appears on `sidebar-note` and `text-column` pages that
follow a section. A `title: top-rule` pin after `layout:` gives a `method` slide the full width its
definitions need. A deck of eight slides or more needs three treatments (OF-110), so plan one
`comparison` or `method` slide for the rail, step slides for the top rule and a quote for the statement.

## Families and variants

- `step-diagram`: numbered steps, each with its action and a worked value; `process` for a flow.
- `method`: a formula at title size in accent-deep, with the meaning of each symbol below it.
- `sidebar-note`: the explanation with a fenced `::: main-box` for the definition or the trap.
- `comparison`: two ideas students confuse; criteria labels (`대상:`, `기호:`) move to the board rail.
- `image-split`, `quote`, `agenda`, `statement`, `text-column`, `table-insight` as listed above.
- Covers `cover-rail`, `cover-typographic`, `cover-numeral`; sections `section-numeral`,
  `section-rail`; closings `closing-summary-list` (recap and exercise) and `closing-ask`.

Display devices: the cover is a `rail`, the board-green rail with the topic beside it; a statement is
`drench`, written on the board with the whole slide in the field green; a section numeral reads as a
part of the whole ("03 / 04") when the deck has an agenda, and becomes the index page; a big number sits
on the accent tint; a closing's rows are keyed by their dates and the next step sits in a tinted box.

## Do

- Number only what happens in order or what is a real part of the session.
- Put every definition and every common mistake in a sidebar box, where students find it again.
- Give each worked example the actual arithmetic with a sample value at each step.
- Title each slide with what it teaches ("신뢰구간 계산 네 단계") and put the rule in the first body line.
- End with what was learnt and what to practise, with a due date.

## Avoid

- More than one marked term per slide.
- Numerals on points that are not a sequence.
- Definitions buried in bullet lists instead of the sidebar.
- A sentence as a title.

## Failure patterns

| Symptom | Cause | Fix |
|---|---|---|
| `fill: slide 2 band 0.51 -> 0.42 (distribute)`; QA reports OF-109 (45 % empty) | a `sidebar-note` with two short groups and a one-line note | give each group three points and the note two lines, or choose `step-diagram` |
| a comparison drawn under `top-rule`, 41 % of the page empty | the points carry no `label:` prefix, so the board rail has nothing to hold | prefix every point on both sides with a short label of at most three words |
| step slides stay under `top-rule` after a section slide | `step-diagram` and `process` do not allow `kicker-numeral` | accept it; the step numerals are the markers |
| median empty band 0.21 over 2 slides (limit 0.20) | a comparison with four short rows | add a fifth row with a full phrase on each side |
| OF-114 on "평균은 중요하다" | the title states a rule | title it "평균의 의미" and open the body with the rule |

## Two worked slides

Four steps, each with an action and a sample value, so the slide can be followed without the speaker.
A step that begins with `1.` takes that number; `·` separates the action from its example.

```markdown
---
layout: step-diagram

## 표준편차 계산 네 단계

- **1. 평균 구하기** 모든 값을 더해 개수로 나눈다 · 예: 점수 60, 70, 70, 80, 90의 평균은 74점
- **2. 편차 구하기** 각 값에서 평균을 뺀다 · 예: −14, −4, −4, 6, 16
- **3. 분산 구하기** 편차를 제곱해 더하고 개수로 나눈다 · 예: (196 + 16 + 16 + 36 + 256) ÷ 5 = 104
- **4. 제곱근 취하기** 분산의 제곱근이 표준편차다 · 예: √104 ≈ 10.2점
---
```

A comparison whose five labelled rows stand on the board rail; both sides keep the same labels, so
the rail names each row once.

```markdown
---
layout: comparison

## 모분산과 표본분산 비교

:::: columns 1fr 1fr
::: col
- **모분산**
  (1) 대상: 모집단 전체의 값을 알 때 쓴다
  (2) 나누는 수: 자료의 개수 n
  (3) 기호: σ²
  (4) 예: 한 학년 전체 240명의 키
  (5) 읽는 법: 집단의 실제 흩어짐이다
:::
::: col
- **표본분산**
  (1) 대상: 표본으로 모집단을 추정할 때 쓴다
  (2) 나누는 수: 자료의 개수보다 하나 작은 n − 1
  (3) 기호: s²
  (4) 예: 그 학년에서 뽑은 30명의 키
  (5) 읽는 법: 모집단 값의 추정치다
:::
::::
---
```

Both slides compile under `tonality: chalk` after a generic cover (drawn as `cover-rail`) and pass
`qa_deck.py`. The class, the scores and the figures are invented.
