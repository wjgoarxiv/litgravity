# Manual

Manual is the technical guide: an installation procedure, an operating manual, an onboarding guide, a
reference for people who look things up with their hands busy. Its pages are built for finding and
citing. A document-control block under the title says which document this is, who owns it and from when
it applies; decimal numbers let a step be cited as "3.1"; numbered steps hold one action each; every
warning takes the same quiet form, slate-blue rules above and below and a bold title. The page stays in
near-black ink with no fills, so a sheet photocopied for the workbench loses nothing.

## Choose it, or choose another

Choose Manual for 가이드, 매뉴얼, 절차서 and 운영 지침, for setup and maintenance instructions, for tool or
API usage guides delivered as a document, and for training material read step by step. Move it up when the
source holds numbered procedures, several warnings, reference tables of settings, codes and limits, or a
revision history that a control block can carry.

| Source | Better tonality |
|---|---|
| a report of results | Report (steps and warning boxes make an analysis read like instructions) |
| a decision paper | Brief (the decision first, the procedure absent) |
| text with no steps and no reference tables | Report or Journal (the control block and decimal numbers add weight and no help) |
| a two-page notice of a procedure change | Memo, with the change stated in its first paragraph |

## Tokens

Values at the pack default (density 9, variance 6) from `templates/tonalities/manual.yaml`.

| Token | Value |
|---|---|
| Page | A4; margins 25 / 27 / 25 / 25 mm; text block 160 mm |
| Body | Pretendard 10.5 pt, ragged right in Korean and English (steps and codes read better unjustified) |
| Pitch | Hangul 175 % (Word multiple 1.14), Latin 133 % (0.87) |
| Paragraph space | 6 pt after (5 pt English), no indent |
| Scale | h1 14 pt (1.35), h2 12 pt (1.15), h3 10.5 pt bold; title 26.5 pt (2.5) |
| Numbering | decimal `1`, `1.1`, `1.1.1`, hung 8, 11 and 13 mm and widened for the widest number |
| Ink | body and headings `1A1A1A`, muted `555555`, rules `8C8C8C` |
| Accent | slate blue `2E4A66` on the callout rule and the sidebar rule only |
| Control block | 9.5 pt, bold labels in a column of about 23 mm, between two 0.5 pt ink hairlines |
| Tables | booktabs, 9.5 pt, bold header, right-aligned numbers |
| Running head | header: short title left; footer: folio right; 8.5 pt muted; both from page 2 |
| Components | callout, sidebar, columns |
| Sidebar | third of the width (about 51 mm) floating right, or `width=half` (about 78 mm); 0.75 pt accent hairline on its left, 9.5 pt text |
| Figures | at most 0.45 of the frame height |

## Page one

Manual has no cover page; the body starts on page 1. The page opens with an optional label line (the
`kicker=` of `::: cover`, for example `설치 안내서`), the title, the subtitle in muted ink, and then the
document-control block of two columns between two ink hairlines. The rows read 문서, 작성 부서, 기관, 시행일
in Korean and Document, Owner, Organisation, Issued in English. They come from frontmatter
`short_title:` (else `title:`), `author:`, `organization:` and `date:`, the date in the form
`2026. 9. 14.`; a row whose value is missing is omitted. The notice follows once in small muted type.

From about nine rendered pages (the converter's own estimate of five pages) a short contents list of the
h1 parts with page fields stands under the control block. The gate counts the control block as a `cover`
kind and exempts page 1 from `fill.page`.

## Summary and structure

The summary form is prose. `# 개요` (or `# Overview`) states the scope, the audience and what the reader
needs before starting: permissions, tools, time. Sections follow in the order of the work: preparation,
procedure, reference tables, troubleshooting, contact. Procedures are ordered lists with one action per
item and the expected result in the next sentence; each numbered list restarts at 1. Reference tables
(settings, error codes, limits) are booktabs tables with units and a `자료:` line; a table of a header and
six or more body rows can break between rows with its header repeated.

## Numbering, headings and running head

Headings are numbered by the engine in plain ink at the heading size, one level per `#`, up to three
levels; back-matter headings stay unnumbered. Write the label alone (`준비물`), because a typed `1.1`
doubles the number. The header carries the short title at the left from page 2 and the footer carries
the folio at the right. The header holds the short title only; the engine can print a section name
through a `section` item, and no pack uses it.

## Components and budget

| Kind | Purpose on the direction card | Budget |
|---|---|---|
| `callout` | one warning placed immediately before the step it protects | about one box per four pages; key, warning and note share one style |
| `sidebar` | definitions or a method note beside the text it explains | no cap on the count; the budget counts kinds, three at most |
| `columns` | two symptom-and-action groups of nearly equal length | parts within 20 % of each other's length |

Manual has no key-figure strip. A callout without `title=` takes the label 주의, 핵심 or 참고 (Warning,
Key point, Note). Put the sidebar immediately before the paragraphs it floats beside: it floats only when
the paragraphs before the next heading are taller than the box, and otherwise stands at full width in the
flow so the next heading never starts beside it (`sidebar.overlap`). A `float=none` attribute sets it
full width on purpose.

## Dials

Density 7 gives margins of 26 / 28 / 26 / 26 mm and a Hangul pitch of 180 %, which helps a guide used at a
bench where a looser line lets the eye find its place again; density 6 gives 27 / 29 / 27 / 27 mm. Density
10 closes the margins to 24 / 26 / 25 / 25 mm for a long reference held to a page count. The type size
stays put. Variance is recorded and adds no component kinds or table styles.

## Korean and English

Steps are imperatives or plain statements: `차단기를 내린다.` in Korean, `Switch off the breaker.` in
English; the headings above them stay noun phrases, and `heading.declarative` reads headings, the title and
the subtitle and leaves list items alone. Korean units take a space (`0 V`, `2 m`) and the converter sets a
non-breaking space after a number before the SI units it knows (mm, cm, m, g, kg, min, h, s, %). A digit,
hyphen, digit pair such as 10-20 becomes an en-dash range, so write a part number that has that shape inside
a code span. English captions read `Table 1.` and the unit stays in the header.

## Worked source

The fragment converted and passed the gate on one page (fill 0.81); the sidebar floats beside the two
paragraphs that follow it.

```markdown
---
title: 무인 접수 단말기 설치 안내서
subtitle: 매장 운영 담당자용
short_title: 접수 단말기 설치
author: 매장운영팀
organization: 예시 세탁 서비스
date: 2026-09-14
tonality: manual
---

::: cover kicker="설치 안내서"
:::

# 개요

::: sidebar title="용어"
**단말기**: 고객이 세탁물을 접수하는 터치스크린 장치

**게이트웨이**: 단말기 신호를 모아 서버로 보내는 장치
:::

이 안내서는 매장에 무인 접수 단말기를 처음 설치하는 운영 담당자를 위한 것이다. 작업에는 관리자 계정과 약 40분이 필요하다. 설치가 끝나면 단말기는 접수 내역을 본사 서버로 보내고, 고객은 앱으로 진행 상태를 확인한다.

설치 위치는 전원 콘센트에서 2 m 안이어야 하고 직사광선이 화면에 닿지 않아야 한다. 매장 바닥이 젖기 쉬운 곳이면 단말기를 벽에서 10 cm 띄워 설치하고, 케이블은 바닥에 닿지 않게 고정한다. 위치가 정해지면 아래 순서로 작업한다.

# 설치 순서

::: callout kind=warning title="전원 차단 후 작업"
배터리를 교체하기 전에 차단기를 내리고 잔류 전압이 0 V인지 확인한다.
:::

1. 차단기를 내린다. 상태 표시등이 꺼진다.
2. 전면 덮개의 나사 4개를 푼다.
3. 배터리를 교체하고 덮개를 닫는다.

표 1. 오류 코드와 조치 (예시)

| 코드 | 증상 | 조치 |
|---|---|---|
| E01 | 서버 연결 실패 | 네트워크 케이블 확인 |
| E07 | 펌웨어 불일치 | 최신 펌웨어로 갱신 |

자료: 제조사 기술 문서 (예시)
```

The headings print as `1 개요` and `2 설치 순서`, the caption as `<표 1> 오류 코드와 조치 (예시)`, and the
control block lists 문서 접수 단말기 설치, 작성 부서 매장운영팀, 기관 예시 세탁 서비스 and 시행일
`2026. 9. 14.`.

## Headings

| Label | Sentence the gate rejects |
|---|---|
| 게이트웨이 설치 순서 | 게이트웨이를 설치한다 |
| 펌웨어 갱신 전 확인 사항 | 갱신 전에 반드시 확인하세요 |
| Error codes and actions | Fix errors before restarting |

## Numbers

Limits, voltages and times sit in tables with their units and a source line. A duration or a count in
the overview goes into its sentence (`약 40분`). Example values carry (예시) or (sample).

## Failure patterns

| Pattern | What happens | Fix |
|---|---|---|
| warnings gathered in a list at the end | the reader meets the hazard after the step | one callout directly before each step it protects |
| headings typed with numbers (`1.1 준비물`) | the decimal numbering doubles | write the label alone |
| steps written as paragraphs | a reader at a bench loses the order | one action per numbered item |
| a sidebar taller than the text beside it, or holding steps | it drops to full width, or the steps hide in a margin | shorten the sidebar, or move the steps into the procedure |
| reference tables with prose cells | cells wrap into tall rows and a table jumps pages | keep cells to a value and a unit; put the explanation in the sentence under the table |
| a source a little over one page | page 2 under 0.40 (`page.spill`) | add the part the reader needs (a check procedure, a contact part) or cut to one page |
