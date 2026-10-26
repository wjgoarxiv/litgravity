# Neo-Brutalism

Neo-Brutalism is the loud direction, and it is loud on purpose. Every card is a flat yellow block
with a thick black border and a hard black shadow offset down and to the right, with no blur at all.
Titles are heavy and tight, the topic band is saturated blue, one pink-red accent marks the figure
the slide is for, and the ground is a warm cream. Nothing is soft: no gradients, no rounded corners,
no glow. It reads like a poster or a product sticker, so it suits a room that should feel energy,
and it stays legible because every colour pair still meets the contrast floor.

## When to use it

Reach for Neo-Brutalism for a startup pitch at a demo day, a consumer product launch, a campaign
kick-off, a creator or community event, a hackathon final or an education deck for a young audience.
The content signals that point here are a short body (one claim and two or three facts per slide),
three or four headline numbers, a launch or sign-up ask, and words such as 런칭, 출시, 데모데이,
캠페인, 크리에이터, or the user asking for something bold, punchy or "brutalist". It is the second
candidate for the pitch deck type, after Signal, and the first when the user asks for a bold or
playful look.

## When it is the wrong choice

It fails for a formal report, an academic talk, a board or finance review and any deck read alone
later: the blocks take space a reader needs for detail, and a slide of long paragraphs between thick
borders reads as noise. It is wrong for grief, safety, HR or financial-loss topics, and
for a deck under a corporate brand guide. When the brief says "clean" or "minimal", Signal or Studio
fits; when it says "report", Ledger or Gazette.

## Tokens

The values below come from the pack file and are what the engine draws.

| Token | Value |
|---|---|
| ground / surface | #FFF5E1 / #FFD43B (the yellow card) |
| ink / ink-muted / line | #111111 / #3A3A3A / #111111 |
| accent / accent-deep / accent-tint | #D81B5C / #6B0F2E / #FFC9DA |
| field / on-field | #2F4BFF / #FFFFFF |
| positive / negative | #137A43 / #111111 |
| series | #D81B5C, #2F4BFF, #111111, #137A43 |
| faces | Pretendard Bold for display, title, labels and numerals, Pretendard Regular for body; `faces: a2z` swaps to A2Z Black display, titles and numerals |
| register / ramp / hero | bold / presented (body 18 pt, labels 14, sources 12, titles 32, display 44) / allowed: a statement and a big figure may take the 72 pt hero step |
| type voice | titles tracked −2, display −3 |
| density / variance | 10 / 7 |
| radius / edge | 0 / fill and border, 2.5 pt in ink |
| shadow | 6 pt offset at 45°, ink, fully opaque, no blur |
| table | yellow header, ruled grid, protagonist row in pink tint, bold totals |
| chart | no gridlines, direct labels, series in order (pink, blue, black) |

This is the family's bold register (`register: bold`): it sets presented type and the 72 pt hero step, so
titles, figures and statements run large, but they fill the same slide-grid zones as every other
pack. A title still sits in the one title zone and the body still starts at y 120; the register
changes the size inside a zone, never the zone. The registry refuses presented type in a pack without
`register: bold`, so a report pack cannot drift into this size by accident; every pack takes its own
hero step on the cover and statements. A KPI
row keeps its bordered cards, because the card is this direction's figure. The pink accent was darkened until a pink figure on a yellow card still holds 3:1 at title
size. Losses use ink with a ▼ sign, because pink already means "look here".

The shadow is written into the file as a real outer shadow with a blur of zero, so PowerPoint,
Keynote and LibreOffice all draw the same hard edge. Every block of the blue field (a band, a
section page, a cover plate) carries the black border too.

## QA allowances

The yellow card, the blue band and the pink accent share a content slide inside the default OF-101
limit (four hue families; a fifth fails). The gate reads this pack's `qa:` block:
`offset-shadow: true` lets OF-120 pass the hard shadow; a shadow with any blur still fails, and the
same shadow in any pack without this allowance fails. Contrast floors are unchanged.

## Treatments by slide role

Content slides and data with a takeaway take `top-plain-large`; data, sequence, reference and
definition slides take `band` (the title in white on the blue band); image slides `bottom-anchor`;
statements `statement`. `kicker-numeral` is the third option for a sequence. The engine lays out
every treatment the family allows, keeps the role's own when the body fills, and otherwise takes the
one that leaves the least empty band. Force one with `title: <id>` on the line after `layout:`.

## Families and variants

- `kpi-row` sets two to four results as yellow cards, each with value, label and basis.
- `big-number` is a blue panel of related figures beside the facts that explain them.
- `comparison` reads before and after across shared rows.
- `process` and `step-diagram` show three to five steps with a numeral in the accent.
- `chart-insight` carries one growth chart with its takeaway beside it.
- `table-insight` holds the one table a pitch needs, usually unit economics.
- `image-split` pairs a product shot with three short points.
- `summary-box-list` sets two to four bordered boxes of one claim each.
- `agenda`, `quote` and `statement` keep the type loud and the page open.

Covers are `cover-typographic`, `cover-split-field` and `cover-numeral`; sections are
`section-field` and `section-numeral`; closings are `closing-ask`, `closing-decision-box` and
`closing-statement`.

Display slides. The typographic cover sets the topic in white on a blue plate across the lower
half, bordered in black. A statement drenches the page in blue with the sentence in white. A big
number is a blue field panel. A closing's next step sits in a bordered box with its shadow.

## Do

- Keep one claim per slide and write it in the first body line, in plain words.
- Give every figure its label and its basis in the card.
- Let the yellow cards carry figures and short labels, never paragraphs.
- End on `closing-ask` with the amount, its uses and the next meeting.

## Avoid

- Blurred or soft shadows, rounded corners and gradients; the look is flat and hard.
- Thin hairlines beside the 2.5 pt borders.
- More than three fill colours on one slide.
- Muted grey text on the yellow surface.
- This direction for formal reports or sensitive topics.

## Two worked slides

A launch deck opens its traction slide with four results as cards and two facts under them.

```markdown
---
layout: kpi-row

## 베타 8주 성과, 2026년 10월

| 가입자 | 주간 재방문 | 추천 가입 | 유료 전환 |
|---|---|---|---|
| 1만 2천 명 | 46% | 38% | 7.4% |
| 목표 1만 명 | 업계 평균 25% | 광고비 0원 | 목표 5% |

> 베타 운영 기록, 2026년 8-10월 (예시)

- 광고 없이 가입자 목표를 넘겼다: 셋 중 하나 이상이 친구 추천으로 왔다
- 유료 전환 7.4%는 목표 5%를 넘었고, 연 결제가 그중 60%다
- 출처: 예시 서비스 운영 대시보드, 2026년 10월 (예시)
---
```

The closing states the ask, shows where the money goes and names the next step.

```markdown
---
layout: closing-ask

## 시드 15억 원 사용 계획

| 쓰임 | 금액 | 시점 |
|---|---|---|
| 앱 개발 인력 4명 | 7억 원 | 2027년 상반기 |
| 크리에이터 제휴 200곳 | 4억 원 | 2027년 1분기 |
| 마케팅 실험 | 3억 원 | 상시 |
| 운영 예비비 | 1억 원 | 필요 시 |
| 합계 | 15억 원 | 12개월 |

> 투자금 쓰임 (예시 데이터)

- 요청: 시드 15억 원 투자 승인
- 기대 성과: 12개월 뒤 가입자 10만 명, 월 매출 2억 원
- 다음 단계: 11월 첫째 주 후속 미팅, 담당 예시 대표
---
```

## Examples

`14-launch-pitch-neo-brutalism-ko.md`
