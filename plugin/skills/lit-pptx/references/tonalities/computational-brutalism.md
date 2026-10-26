# Computational Brutalism

Computational Brutalism is the direction for a deck about a system, told to the people who build or
run it. It borrows from terminals, plotter paper and engineering drawings: the twelve-column grid is
marked in the top margin with numbered ticks, every content slide carries its index as `[03/08]`,
titles, labels and figures are set in a monospaced face, tables are ruled on every edge, and one
electric-blue signal colour marks the figure that matters. The structure is shown on purpose. What
keeps it readable is that body text stays in Pretendard and every mark sits on the grid it shows.

## When to use it

Reach for Computational Brutalism for an architecture review, an infrastructure or reliability
report, a developer-tool or AI-system launch given to engineers, a benchmark write-up, an incident
retrospective or a hackathon demo. The content signals that point here are metrics with units
(p99 latency, throughput, error budget, GPU hours), version numbers and identifiers, code or
command names in the text, before-and-after measurements, and an audience that reads a table
faster than a sentence. It is the first candidate for an engineering review or a developer launch,
and the second for a data review that an engineering team will read.

## When it is the wrong choice

It fails for a board, an investor committee, finance or a public-sector report, where the grid marks
read as unfinished work rather than as a style. It fails for a long Korean reading deck: the mono
face sets only Latin and figures, so a page of Hangul titles loses most of the look while keeping
its cost in width. It also fails for consumer marketing, for grief, safety or HR topics, and for a
deck under a corporate brand guide. For a quiet data review choose Ledger or Night; for a pitch to
investors, Signal or Neo-Brutalism.

## Tokens

The values below come from the pack file and are what the engine draws.

| Token | Value |
|---|---|
| ground / surface | #EEEDE7 / #E2E1D9 |
| ink / ink-muted / line | #111111 / #4D4C47 / #9A988F |
| accent / accent-deep / accent-tint | #1F43E0 / #14267A / #D9DEF2 |
| field / on-field | #111111 / #8CF5A6 (phosphor green on the terminal field) |
| positive / negative | #1C6B35 / #B3261E |
| series | #1F43E0, #111111, #7A786F |
| faces | JetBrains Mono Bold for display, title and numerals, JetBrains Mono Regular for labels, Pretendard Regular for body; Hangul inside a mono run is set in Pretendard; there is no A2Z map, so `faces: a2z` keeps these faces |
| ramp / hero | compact (body 13 pt, labels 11, sources 9) / hero step (60 pt) on cover and statement titles that fit, off with `hero: false`; figures at most title size |
| density / variance | 10 / 7 |
| radius / edge | 0 / border, 1 pt, in ink |
| decoration | hairline rules, column hairlines, outlined boxes, grid marks, kicker numerals |
| table | ruled grid on every cell edge, header in the label face, bold totals |
| chart | hairline gridlines, direct labels, the accent on the highlighted series over muted ones |

Density 10 sets the deck on the compact grid (24 pt side margins), body 13 pt and no step-up, as
every pack in the family: an engineering review is read again after the meeting, so each slide keeps
its basis and its source. The mono face is wider than Pretendard, so the engine measures
every mono title at its own width before it chooses a treatment; a long Latin title moves to a
treatment with a wider frame rather than shrinking.

The fonts ship with the skill: JetBrains Mono is under the SIL Open Font License 1.1 with no Reserved
Font Name, and the official Regular and Bold files are embedded unmodified with `--embed-fonts`.

## Treatments by slide role

Content, data, sequence and reference slides take `top-rule`; data with a takeaway takes
`bottom-anchor`; image slides `bottom-anchor`; definitions `side-rail`; statements `statement`. The
pack also pins a family's own title: `chart-insight` under `top-rule`, `table-insight` under
`bottom-anchor`, `comparison` as a spec sheet under a `side-rail` title, and `step-diagram`
under a large mono headline (`top-plain-large`). The engine lays out each allowed treatment, keeps
the pinned or role treatment when the body fills, and otherwise takes the one that leaves the least
empty band. Force one with `title: <id>` on the line after `layout:`.

## Families and variants

- `dashboard-grid` and `kpi-row` carry measured results: value, unit, label and basis in each cell.
- `chart-insight` and `full-chart` show a measured series with one highlighted line or bar.
- `table-insight` and `ledger-table` hold benchmark or capacity tables, ruled on every edge.
- `method` sets a pipeline or procedure as numbered stages with their inputs and outputs.
- `step-diagram` is a rollout or migration in three to five steps.
- `matrix-2x2` places options on two measured axes.
- `comparison` reads before and after, or two designs, across shared rows.
- `text-two-column` and `references-appendix` carry specifications and links.
- `quote` and `statement` hold one line an engineer said or one decision.

Covers are `cover-typographic`, `cover-index` and `cover-figures`; sections are `section-numeral`
and `section-rule`; closings are `closing-decision-box`, `closing-ask` and `closing-summary-list`.

Display slides. The typographic cover is the terminal field from edge to edge: black, with the
topic in phosphor green at display size, anchored low, and the date line above it. A statement sets
its sentence in phosphor on the same black field. A big number is an outlined panel on the ground.
A closing's decision sits in an outlined box. The grid marks and the slide index run on content
slides only; a drenched statement goes without them.

## Do

- Give every figure its unit and its basis: `p99 182 ms`, `2026년 9월 기준`.
- Keep identifiers, versions and commands in the text as they are written; the mono face is for them.
- Put one blue figure on a slide; everything else stays ink.
- Rule a table on every edge and right-align its numbers.
- End on a decision box or an ask with the owner and the date.

## Avoid

- Body paragraphs in the mono face (the pack refuses a mono body).
- Fake code, fake terminal prompts or decorative binary strings; show real identifiers or none.
- Grid marks or the slide index in the accent colour.
- A second accent colour; the phosphor green belongs to the black field only.
- This direction for a board pack, a finance report or a sensitive topic.

## Two worked slides

A latency review shows the measured result with its basis, and lets the table carry the detail.

```markdown
---
layout: kpi-row

## API 게이트웨이 v3 전환 결과, 2026년 9월

| p99 지연 | 처리량 | 오류율 | 노드 수 |
|---|---|---|---|
| 182 ms | 41k rps | 0.07% | 24 |
| v2 410 ms | v2 18k rps | v2 0.31% | v2 40 |

> 운영 클러스터 4주 평균, 2026년 9월 (예시)

- 지연은 절반 아래로 줄었고, 노드는 40대에서 24대로 줄었다
- 오류율 0.07%는 SLO 0.1% 안쪽이다
- 출처: 예시 관측 대시보드, 2026년 9월 (예시)
---
```

A migration plan reads as a sequence with the condition each step must meet.

```markdown
---
layout: step-diagram

## Cut-over plan for the v3 gateway

- **1. Shadow** mirror 5% of traffic to v3 and compare responses
  (1) Exit: 0 mismatches over 72 h
- **2. Canary** route 10% of live traffic to v3 in one region
  (1) Exit: p99 under 250 ms, error rate under 0.1%
- **3. Ramp** move to 50%, then 100%, one region a day
  (1) Exit: no rollback for 7 days
- **4. Retire** drain v2 and remove its 40 nodes
  (1) Owner: example platform team
- Source: example rollout runbook, October 2026 (example)
---
```

## Examples

`13-engineering-review-computational-brutalism-ko.md`
