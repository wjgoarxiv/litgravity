# Newsroom

Newsroom is the direction for a data story told to people who do not read tables: a public
briefing, an explainer, a newsletter's deck, a talk that walks a general audience through a few
numbers. It looks like a newspaper's graphics desk: a black masthead band behind the title of a
data page and the cover, a heavy black rule under the other titles, grey charts with one orange series, labels on the lines, and a source and period under every figure.
The title names the topic and its period; the finding leads the body, in the first line under the
chart.

## When to use it

Reach for Newsroom when the deck is a handful of charts with one point each, written for readers
outside the field: a city or school data briefing to residents, a survey result for members, a
newsletter's "what the numbers say", a research explainer for the press, a public talk on prices,
housing, climate or health figures. The content signals that point here are one or two charts per
idea, a finding per chart, sources and periods on every figure and
words such as 브리핑, 설명, 주민, 시민, 독자, 뉴스레터, 데이터로 본, explainer, briefing or "what the
data says". It is the first candidate for a data story for the public, ahead of Gazette and
Ledger.

## When it is the wrong choice

It fails for an internal, dense review where people read tables line by line (Ledger), for a pitch
(Signal or Neo-Brutalism), for a lecture that builds an argument step by step (Chalk) and for a
written report that happens to be a deck (Paper or Gazette). It is wrong when there are no figures:
the grey-and-orange charts are the voice.

## Tokens

The values below come from the pack file and are what the engine draws.

| Token | Value |
|---|---|
| ground / surface | #FBFAF7 / #EEEDEA |
| ink / ink-muted / line | #111111 / #55534D / #CCCAC5 |
| accent / accent-deep / accent-tint | #C2410C / #7C2A08 / #FBE3D3 |
| field / on-field | #111111 / #FFFFFF |
| positive / negative | #1F6B3A / #111111 |
| series | #C2410C, #77746C, #2F5D8A, #111111 |
| faces | Pretendard Bold for display, title, labels and numerals, Pretendard Regular for body; `faces: a2z` swaps to A2Z Bold display, titles and numerals |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 6 |
| radius / edge | 0 / fill |
| decoration | hairline rules, column hairlines, kicker numerals; the masthead band is the `band` title |
| table | open, no header fill, a rule under the header, bold totals |
| chart | horizontal gridlines, direct labels, the accent on the story's series over greys |

The orange holds 5.2:1 on the paper, so it can set a kicker word or a figure. The second series is a
warm grey, the third a quiet blue for the one line a story compares against. Rules and surfaces are
neutral greys: a warm-tinted rule reads as a second hue family beside the orange. A loss uses ink
with a ▼ sign.

## QA allowances

None beyond the default craft floor. The source line under every figure is the house rule here,
and the gate's source checks already ask for it.

## Treatments by slide role

Data slides take `band` (the title in white on the black masthead band across the top);
data-with-takeaway and image slides take `bottom-anchor` (the title over a heavy black rule); content, reference and definition slides take `top-rule`; sequences
`kicker-numeral`; statements `statement`. Every treatment draws in the slide grid's one title zone,
so a band, a bottom-anchor and a top-rule title sit at the same place and only their surface or
rule differs.
Force one with `title: <id>` on the line after `layout:`.

## Families and variants

- `full-chart` gives one chart the whole body; `chart-insight` sets it beside two or three lines.
- `kpi-over-chart` puts the headline figures over the chart they come from.
- `big-number` and `kpi-row` carry a single figure or three.
- `figure-pair` sets two charts side by side for a before and after.
- `table-insight`, `comparison` and `timeline` hold the few tables and dates a story needs.
- `image-split`, `text-two-column` and `sidebar-note` explain a method or a term.
- `references-appendix` lists the sources at the end; `quote` and `statement` hold a resident's
  sentence or the story's one finding.

Covers are `cover-typographic`, `cover-figures` and `cover-index`; sections are `section-rule` and
`section-numeral`; closings are `closing-summary-list`, `closing-statement` and `closing-ask`.

Display slides. The typographic cover sets the deck title in white on the black masthead band,
with the meta line on the band and the deck's parts on the paper under it. A statement stands between two rules. A big number sits on the orange tint. A closing's next
step stands under a rule. A deck index runs along the top of the display slides.

## Do

- Name the topic and its period in the title; put the finding (what changed, by how much, since
  when) in the first line of the body, where the gate expects a claim.
- Colour one series orange and leave the rest grey.
- Put the source and the period under every chart and table.
- Label lines and bars directly; a legend is for a chart that cannot take labels.

## Avoid

- More than one highlighted series on a chart.
- A chart without its source and period.
- 3D, gradients or pictograms standing in for numbers.
- This direction for a pitch, a lecture or an internal dense review.

## Two worked slides

A full chart names its topic in the title, keeps one orange line and states the finding under it.

```markdown
---
layout: full-chart

## 매매가 대비 전셋값 비율, 2023-2026년

::: chart type=line unit="%"
| 연도 | 우리 구 (%) | 시 평균 (%) |
|---|---|---|
| 2023년 | 55.2 | 56.0 |
| 2024년 | 57.1 | 56.8 |
| 2025년 | 59.4 | 57.9 |
| 2026년 | 61.3 | 58.6 |
> 매매가 대비 전셋값 비율, 해마다 6월 (예시 자료)
:::

- 우리 구의 전셋값이 처음으로 매매가의 60%를 넘었다
- 출처: 예시 구청 주택 통계, 2026년 (예시)
---
```

A KPI row carries three figures over what each means.

```markdown
---
layout: kpi-row

## 주민 설문 결과, 2026년 9월

| 응답자 | 이사 계획 | 첫째 이유 |
|---|---|---|
| 1,204명 | 31% | 주거비 |
| 9월 1-20일, 온라인·방문 | 2년 안에 이사할 생각 | 이사 계획자의 47% |

- 출처: 예시 구 주거 실태 설문, 2026년 (예시)
---
```

## Examples

`17-public-data-briefing-newsroom-ko.md`
