# Frontmatter schema

A Markdown source opens with one YAML block between two `---` lines. The converter parses it with
`yaml.safe_load`; a block that fails to parse prints `Warning: could not parse YAML frontmatter` and the
whole file is then read as body text, so the title block vanishes and the YAML prints on the page
(the gate reports it as `frontmatter_leak`). Quote any value that contains a colon, a leading
asterisk or a hash sign.

## Two sources

```yaml
---
# tonality document (report, brief, manual, proposal, memo)
title: 세탁 서비스 배송 시험 운영 결과
subtitle: 2026년 2분기 시범 구역 분석
author: 운영기획팀
organization: 예시 세탁 서비스
date: 2026-07-03
notice: "예시 데이터: 수치는 가정입니다"
short_title: 배송 시험 운영 결과
tonality: Report
density: 9
variance: 5
data: numbers.json
---
```

```yaml
---
# manuscript for a publisher profile
title: "Catalytic CO2 reduction on Cu/ZnO: a mechanistic study"
authors:
  - { name: "Jane Doe", affiliation: 1, corresponding: true }
  - { name: "Min Park", affiliation: [1, 2] }
affiliations:
  1: "Department of Chemical Engineering, Example University"
  2: "Institute of Materials, Example Institute"
abstract: "We report ..."
keywords: [CO2 reduction, Cu/ZnO, DFT, operando XPS]
corresponding_email: "jane.doe@example.org"
---
```

All names, institutions and addresses in these blocks are invented.

## Field matrix

| Key | Type | Tonality or plain build | Publisher build (`--publisher`) | Notes |
|---|---|---|---|---|
| `title` | string | title block; a `::: cover` fails without it | title paragraph; nothing is injected when absent | also checked by `heading.declarative` |
| `subtitle` | string | title block, muted ink | one centred line under the title | noun-phrase label |
| `author` | string | byline; Manual: the owner row; Memo: not printed | one line (joined with ` · `) under the title when `authors` is absent | a person or a department |
| `authors` | list of strings or of `{name, affiliation, corresponding}` | byline (names only) | names with superscript affiliation numbers and a `*` for the corresponding author | `affiliation` takes one number or a list |
| `organization` | string | byline after the author, skipped when the author already names it; Manual: organisation row | meta line when `authors` is absent | |
| `date` | date or string | title block; ISO values print as `2026. 7. 3.` in Korean and `3 July 2026` in English | Korean documents only are rewritten to `2026. 7. 3.` | unquoted ISO dates parse as dates; both work |
| `notice` | string | printed once under the title block; Proposal: in the cover footer | a tag in every page header, or a tinted band under the title block when the first page has its own header | a label with a colon, no spaced dash |
| `short_title` | string | running head text; Manual: the 문서 row | not read | falls back to the title, cut at 40 characters on a word |
| `affiliations` | mapping number to text | masthead block (Report, Brief, Journal) | italic lines under the authors | keys sort as text |
| `abstract` | string | masthead block (Report, Brief, Journal) | labelled paragraph, 초록 in `korean-generic` | one paragraph |
| `keywords` | list or string | masthead block (Report, Brief, Journal) | labelled line, joined with `; ` | `Index Terms` in `ieee`, 주요어 in `korean-generic` |
| `corresponding_email` | string | masthead block (Report, Brief, Journal) | line under the affiliations | |
| `tonality` | string | one of the six pack names, any case | refused: the pair stops the build | `--tonality` on the command line wins |
| `density`, `variance` | integer 1 to 10 | dials; the command line wins | not read | density moves margins and leading |
| `data` | path or comma-separated paths | resolves `{{ name }}` and `{{ table:name }}` placeholders from JSON or CSV files next to the source | the same | a failed `checks` entry stops the build |

Keys outside this table are ignored by the converter, so a note-to-self key is harmless but also
invisible. `funding` and `journal_target` appear in older templates; no script in this skill reads them,
so put a funding statement in the body or the acknowledgements section.

## Which command reads what

| Command | Keys it reads |
|---|---|
| `convert_md_to_docx.py` without `--publisher` | `title`, `subtitle`, `author`, `authors`, `organization`, `date`, `notice`, `short_title`, `affiliations`, `abstract`, `keywords`, `corresponding_email`, `tonality`, `density`, `variance`, `data` |
| `convert_md_to_docx.py --publisher <name>` | `title`, `subtitle`, `author`, `authors`, `organization`, `date`, `notice`, `affiliations`, `abstract`, `keywords`, `corresponding_email`, `data`; `tonality` is an error |
| `convert_md_to_pdf.py` | `title`, `authors`, `affiliations`, `abstract`, `keywords`, `corresponding_email` |
| `qa_docx.py` | `title`, `subtitle` (noun-phrase check), `notice` (`notice.dash`), `tonality` (selects the strict checks) |
| `slop_lint.py --kind manuscript` | the keys named in the publisher's `frontmatter_required` (`title`, `authors`, `affiliations`, `abstract`, `keywords`), to fill the submission checklist |

## Publisher manuscripts

The checklist `submission_checklist_<publisher>.md` that `slop_lint.py` writes lists each required key
with `[x]` when the frontmatter holds a value and `[ ]` when it is empty or missing. Fill all five
before submission. The `authors` list needs mappings (`name`, `affiliation`, `corresponding`) for the
numbered affiliation and the asterisk to print; a plain list of names prints the names only.

## Pitfalls

- A frontmatter block that does not start on line 1 is body text.
- A title with a colon needs quotes: `title: "Phase 2: results"`.
- A `notice` joined by a spaced dash fails `notice.dash` in a tonality document; use a colon.
- `date: 2026-07-03` in an English tonality document prints `3 July 2026`; a string such as
  `Q2 2026` prints as written.
- A tonality named in the frontmatter and a publisher on the command line stop the build; remove one.
