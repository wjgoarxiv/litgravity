# Brief

Brief is the briefing for a person who has to decide something today: one to three pages, conclusion
first. The reader takes in the decision request under the title, reads three or four numbered points
that each open with a bold sentence, checks one table and stops. Everything on the page serves that
single pass. The look is plain: near-black headings that part from the text by weight and by a
full-width ink hairline above each section, one deep green rule under the title block, one request
between two green rules, and the folio alone at the foot. Nothing is shaded, numbered for show or
repeated in a header.

## Choose it, or choose another

Choose Brief for 현황 보고, 검토 보고 and 결과 보고 to an executive, a decision request with options, a
one-page incident summary, a pre-meeting note, and any document of about three pages or fewer whose
reader decides rather than studies. It moves up the list when the source runs under about 900 words,
when the request says "한두 장", or when it names a decision maker and a date. It is also the home of a
Korean 개조식 briefing: write those lines by hand under the unnumbered sections when the user asks.

| Source | Better tonality |
|---|---|
| more than three pages, or sections that argue in running paragraphs | Report |
| a notice or letter to many recipients | Memo (To / From / Date / Subject block) |
| an approval request with an amount and a schedule | Proposal (cover, budget table, decision box) |
| a procedure | Manual |

## Tokens

Values at the pack default (density 9, variance 3) from `templates/tonalities/brief.yaml`.

| Token | Value |
|---|---|
| Page | A4; margins 25 / 27 / 25 / 25 mm; text block 160 mm |
| Body | Pretendard 10.5 pt; Korean justified, English ragged right |
| Pitch | Hangul 175 % (Word multiple 1.14), Latin 133 % (0.87); tight spacing when the source is about one page |
| Paragraph space | 6 pt after (5 pt English), no indent |
| Scale | h1 13.5 pt (1.3), h2 12 pt (1.15), h3 10.5 pt bold; title 26.5 pt (2.5) |
| h1 | unnumbered, under a full-width 0.5 pt ink hairline with 6 pt of padding; 22 pt above, 9 pt below |
| Ink | body and headings `1A1A1A`, muted `555555`, rules `8C8C8C` |
| Accent | deep green `2D5A47` on the title rule and the callout rule only |
| Tables | booktabs, 9.5 pt, bold header, right-aligned numbers |
| Running head | folio alone, footer right, 8.5 pt muted, from page 2 |
| Components | callout (one at most), columns |
| Figures | at most 0.40 of the frame height |
| Contents | none |

## Page one

A compact title block: the kind label on the left and the date on the right (`검토 보고`, `2026. 10. 2.`),
the title at 26.5 pt, the subtitle in muted ink, the byline, one green rule and the notice once in small
muted type. Directly beneath it stands the decision request. The engine takes the first
`::: callout kind=key` in the source, from wherever it was written, and sets it first in the body, so
the order in the source is free. A callout of another kind stays where it was written. Brief has no cover
page; a `variant=` on the cover directive is read and ignored.

## Summary

The paragraphs of the first section become numbered points ①, ②, ③ and ④, hung 5.5 mm in from the
margin. The first sentence of each paragraph is set bold as its lead and the rest stays plain. The
engine ends the lead at the first `다.` or at a full stop, exclamation mark or question mark, so a point
that is a single sentence prints entirely bold. Write each point as two or more sentences: the first
carries the claim (the situation, the number that matters, the option recommended, what is asked) and the
rest the supporting fact. A fifth paragraph stays unnumbered, and list items in the summary are skipped.
Three or four points of about the same length trip `rule-05-sentence-variance`, so let one sentence run
short.

## Numbering, headings and running head

Sections are unnumbered. Each h1 opens under the hairline, which is how a reader finds the next part
without numerals; an h1 that follows a ruled box draws no second rule. The h2 and h3 levels part by
weight and space. The footer shows the folio at the right margin from page 2 and nothing else: no short
title, no header, no section name. Tables carry `<표 n>` above, a `(단위: …)` line when the numeric
columns share a unit, then `주:` and `자료:` below, one small table per part at most.

## Components and budget

| Kind | Purpose on the direction card | Budget |
|---|---|---|
| `callout` | the decision request, the one thing the reader must not miss | one box (the pack caps it) |
| `columns` | two options of nearly equal length side by side | one pair, parts within 20 % of each other |

Brief has no key-figure strip. Key figures written in the cover directive are dropped with a note on
stdout, and a strip written in the body prints as a plain list, so state the numbers in the points and in
the table. A second callout keeps its content as text under a bold lead line.

## Dials

Density 9 is the working point. Density 10 closes the margins to 24 / 26 / 25 / 25 mm, which buys a few
lines; cutting a sentence works better. Density 7 gives 26 / 28 / 26 / 26 mm with a 180 % Hangul pitch,
for a brief printed and annotated, and density 6 gives 27 / 29 / 27 / 27 mm. Variance is recorded and has
no visible effect: the one-box limit holds at every setting.

## Korean and English

Korean body text is justified; English is ragged right. The converter writes the frontmatter date as
`2026. 10. 2.` in Korean and `2 October 2026` in English, and Korean bullets print as an en dash. Korean
briefs often use 개조식 lines ending in 함 or 임 in the body; headings, the title and the subtitle keep
noun-phrase labels, because `heading.declarative` reads those and flags a closing 함. The English lead
sentence ends at the first full stop, so avoid a stop inside an abbreviation in the first sentence of a
point.

## Worked source

The fragment converted and passed the gate on one page (fill 0.61), with only the OF-301 advisory.

```markdown
---
title: 민원 처리 지연 현황과 대응안
subtitle: 2026년 3분기 점검 결과
author: 민원지원팀
organization: 예시 구청
date: 2026-10-02
tonality: brief
---

::: cover kicker="검토 보고"
:::

# 요약

3분기 민원 처리 기간이 평균 4.2일로 목표 3일을 넘었다. 접수 창구가 둘로 나뉜 뒤 이관 대기가 길어진 것이 주된 원인이다.

결원은 2명이다. 9월 이후 1인당 처리 건수가 18% 늘어 남은 인력의 부담이 커졌다.

온라인 접수 일원화와 임시 인력 2명 배치를 함께 추진하는 안이 가장 빠르다. 두 조치를 합치면 처리 기간을 3일 안으로 줄일 수 있다고 본다.

::: callout kind=key title="결정 요청"
온라인 접수 일원화와 임시 인력 2명 배치를 10월 운영 회의에서 승인해 주시기 바랍니다.
:::

# 처리 현황

표 1. 분기별 민원 처리 현황 (예시)

| 구분 | 2분기 | 3분기 |
|---|---|---|
| 접수 건수 | 1,020 | 1,180 |
| 평균 처리 기간 (일) | 3.1 | 4.2 |

자료: 민원 관리 시스템 (예시)
```

The callout moves above `# 요약`, and the three summary paragraphs become ① ② ③ with the first sentence
of each in bold. The first draft of this source gave point ② as one sentence and printed it entirely bold;
the second sentence above is the repair.

## Headings

| Label | Sentence the gate rejects |
|---|---|
| 민원 처리 지연 현황 | 민원 처리가 지연되고 있음 |
| 온라인 접수 일원화 방안 | 온라인 접수를 일원화해야 한다 |
| 건의 사항 | 다음과 같이 건의드립니다 |

## Numbers

A number sits inside its sentence with its unit and period. Estimates say (추정) or (예시), and a figure
a reader cannot trace to a source stays out of a briefing. A bulleted list of one item becomes a plain
paragraph.

## Failure patterns

| Pattern | What happens | Fix |
|---|---|---|
| the decision request written last as plain text | it stays last | write it as `::: callout kind=key`; the engine lifts it |
| summary paragraphs that open with a fragment (`배경:`) | the bold lead reads as a label | open with a full sentence that carries the point |
| one-sentence points | the whole point is bold | add a second sentence |
| points of equal length | `rule-05-sentence-variance` | let one sentence run short |
| a second callout | only the first by priority is boxed | keep the request in the box and move the rest into the points |
| glyph markers (squares, check marks, arrows) in headings or list heads | the text reads as a template | use plain words; the numbered points carry the order |
| a table split over two pages in a two-page brief (`table.split`) | the table lands across the page break | shorten the cells or move the table up under a lead sentence |
