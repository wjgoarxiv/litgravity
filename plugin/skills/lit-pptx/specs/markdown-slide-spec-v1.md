# Markdown Slide Specification v1

> **Status:** Base contract, extended by `markdown-slide-spec-v2.md`. A deck written only with the
> constructs below compiles to a `slide-ast-v1` document, byte for byte what it produced before v2 existed.
> v2 adds placement (`region`, `columns`, `box`, `shape`), slide-local keys, variants and the open layout set.
> The one v1 non-goal that v2 reverses is free-form absolute positioning (section 11).
> **Reference implementation:** `scripts/lib/markdown-loader.js`, `directive-parser.js`, `slide-ast.js`,
> `spec-validator.js`. **Schema:** `specs/slide-ast-v1.schema.json`.

## Purpose

The dialect is the single authoring source for slide decks. It is a constrained Markdown plus fenced
directives, built to be:

1. **Easy for an agent to write and edit.** The structure is predictable: one frontmatter block, then
   slide chunks that each start with a `layout:` line.
2. **Exact.** It compiles into a versioned AST that keeps the author's intent (layout, blocks, order), and a
   violation stops the compile with a message that names the slide.
3. **Design-independent.** The source carries structure and words. A tonality pack or a template contract
   owns fonts, colours, geometry and decoration.

## 1. Deck structure

A deck is one Markdown file made of a frontmatter block and one or more slide chunks:

```markdown
---
template: MY-BRAND
title: 세탁 서비스 분기 보고
date: 2026.10.05
department: 운영팀
presenter: 예시 발표자
---

---
layout: cover

# 세탁 서비스 분기 보고
---

---
layout: content

## 접수와 처리 현황

- 3분기 접수 12,400건
- 전분기 대비 +8%
---
```

The source must start with `---`. A missing opening fence, an unclosed frontmatter and a missing `title`
each stop the compile (`Deck must start with YAML frontmatter (---)`, `Frontmatter must be closed with
---`, `Frontmatter must declare a 'title' field`).

## 2. Frontmatter

The frontmatter is flat `key: value` text. A value may be wrapped in single or double quotes.

| Field | Required | Description |
|---|---|---|
| `title` | yes | deck title |
| `template` or `tonality` | one of the two | the enrolled template name, or the tonality id the deck was written for |
| `date`, `department`, `presenter` | no | metadata the design may print on a cover |
| any other key | no | carried into `deck.metadata` (`density`, `variance`, `canvas`, `faces`, `notice`, `data`, `accent`, `font`, `background` are read by the engine) |

A deck that names a `tonality` records `tonality:<id>` as its template in the AST. The render step needs the
design chosen: `--template <NAME>`, `--tonality <id>`, or a `tonality:` line in the frontmatter.

## 3. Slide separators

A line that holds only `---` ends one chunk and starts the next. The first chunk after the frontmatter is
usually empty and is skipped. Every non-empty chunk starts with a `layout:` line and a line break:

```
layout: <name>
```

A chunk without it stops the compile (`Slide chunk must start with a 'layout:' directive`). A horizontal
rule inside a slide splits that slide, which also leaves the second half with no `layout:` line. Pipe-table
separator rows (`|---|---|`) are safe because the dashes share their line with pipes.

## 4. Allowed Markdown subset

### 4.1 Permitted constructs

| Construct | Syntax | Notes |
|---|---|---|
| Headings | `#`, `##`, `###` | `#` on cover and closing, `##` on a content title, `###` opens a summary group |
| Bullets | `- item` | one level; a bold-only bullet (`- **Heading**`) opens a group |
| Bold | `**text**` | group headings and run-in labels |
| Numbered items | `(1) text` | typed numbers in parentheses, indented under a group heading |
| Tables | pipe table | first row headers, a separator row, then data rows |
| Table caption | a `>` line under the table | becomes a `table-caption` block |
| Images | `![alt](path)` on a line of its own | the alt text becomes the visible figure caption |
| Links | `[label](https://...)` | in a table cell, drawn as an external hyperlink |
| Directive blocks | `::: name` ... `:::` | section 5 |

### 4.2 Forbidden constructs

The parser rejects these at parse time with a slide index and a line number inside the slide:

| Forbidden | Reason |
|---|---|
| raw HTML tags `div span table thead tbody tr td th section article header footer nav main aside style script` | would bypass the design contract |
| `<style>` blocks | CSS cannot travel through a slide file |
| inline `style="..."` attributes | arbitrary positioning breaks the layout contract |
| a `:::` block inside a `:::` block | ambiguous nesting (v2 allows a longer outer fence) |
| arbitrary CSS classes | layout comes from the template |

## 5. Directive blocks

A directive is a fenced block. The open line is `::: <name>` (v2 adds attributes) and the close line is
`:::` of the same length.

| Directive | Purpose | Where it applies |
|---|---|---|
| `main-box` | bordered callout at the foot of the slide | `main` |
| `kpi-table` | headline-number table | `content`, `main`, `summary` |
| `chart` | native chart from a pipe table | wherever a table fits (v2 section 9) |
| `image` | an image with its caption | `content`, `main`, `summary` |
| `key-message` | one-line lead under the title | `content`, `main`, `summary` |
| `notes` | speaker or footnote text | `content`, `section` |

`summary-group` is a block type the parser builds from `###` headings; the author never writes it as a
directive.

```
::: main-box
처리 지연은 주말 접수분에 몰려 있다.
:::

::: kpi-table
| 지표 | 목표 | 실적 |
|---|---|---|
| 접수 | 12,000 | 12,400 |
:::
```

Nesting rules: a block closes before another of the same fence length opens. The error names the line.
A directive name that is not in the table becomes a block of that type, and the AST validator rejects it
for any layout that does not list it (`block type "weird" is not allowed ... Allowed: ...`).

## 6. Layouts

### 6.1 The v1 layouts

| Layout | Purpose | Blocks it accepts |
|---|---|---|
| `cover` | opening slide | `title` |
| `content` | title plus body | `title`, `key-message`, `body`, `image`, `notes`, `kpi-table`, `figure-caption`, `table-caption` |
| `main` | content plus an optional callout | `content` blocks without `notes`, plus `main-box` |
| `summary` | two grouped blocks | `title`, `key-message`, `summary-group`, `image`, `kpi-table`, captions |
| `section` | divider | `title`, `notes` |
| `closing` | final slide | `title` |

The accepted-block column comes from `LAYOUT_BLOCKS` in `spec-validator.js`; placement blocks (`box`,
`shape`, `columns`) pass on every layout. The renderer applies a second check against the chosen
template's own capability list.

### 6.2 Content rules per layout

- `cover`: one `#` heading and no body.
- `content`: one `##` heading, then bullets, a table or an image.
- `main`: one `##` heading, a body, and optionally one `::: main-box`.
- `summary`: one `##` heading, then `###` groups. The first group is `position: "top"`, the second
  `"bottom"`, a third and later `group-N`.
- `section` and `closing`: a heading only.

Under a tonality the same names are accepted as legacy layouts and read as families (`content` and `main`
become `text-column`, `summary` becomes `comparison`); the pack's own families are listed in
`references/layout-families.md`.

## 7. Bullet hierarchy

Body text has two levels and plain lines:

```
- **Section title**
  (1) Detail item
  (2) Detail item
- A plain bullet
A plain line is kept as text.
```

| Source | AST item |
|---|---|
| `- **Heading**` | `{"type": "section", "heading", "children"}` |
| `(N) text` | `{"type": "numbered", "text"}`, attached to the open section when one exists |
| `- text` | `{"type": "bullet", "text", "level": 1}` |
| any other line | `{"type": "text", "text"}` |
| `![alt](path)` | `{"type": "image", ...}` |

A bold lead-in that continues on the same line (`- **요약:** 방문이 늘었다`) is an ordinary bullet whose bold
run is a label.

## 8. Failure behaviour

### 8.1 Parse errors

1. Stop at the first violation; the compile writes no partial output.
2. Name the slide (0-based index in parse errors) and the line counted inside the slide's content.
3. Name the violation (`Arbitrary HTML is not allowed ...`, `Unclosed directive block`).

### 8.2 Validation errors

1. Reject the whole deck.
2. Name the slide (0-based) and the block (`Slide 0 (layout: cover): block type "body" is not supported. Allowed: title, box, shape, columns`).
3. List the allowed block types.

## 9. AST output contract

The compiler emits JSON that conforms to `slide-ast-v1.schema.json`. A deck of the small example above
compiles to:

```json
{
  "astVersion": "slide-ast-v1",
  "version": "1.0.0",
  "deck": {"template": "AZURE-PRO", "title": "세탁 서비스 분기 보고", "metadata": {"date": "2026.10.05"}},
  "slides": [
    {"index": 0, "layout": "main", "blocks": [
      {"type": "title", "content": "접수와 처리 현황", "level": 2},
      {"type": "kpi-table", "headers": ["구분", "건수"], "rows": [["접수", "12,400"]], "caption": "표 1. 3분기 접수 (예시 데이터)"},
      {"type": "table-caption", "caption": "표 1. 3분기 접수 (예시 데이터)"},
      {"type": "body", "items": [{"type": "section", "heading": "접수량", "children": [{"type": "numbered", "text": "3분기 접수 12,400건"}]}]},
      {"type": "main-box", "content": "처리 지연은 주말 접수분에 몰려 있다."}
    ]}
  ]
}
```

| Top-level field | Meaning |
|---|---|
| `astVersion` | `"slide-ast-v1"`, or `"slide-ast-v2"` once the deck places content (v2 section 1) |
| `version` | `1.0.0` or `2.0.0` |
| `deck` | `template`, `title`, optional `metadata` |
| `slides` | ordered array of `{index, layout, blocks}` (and `meta` in v2) |

Block types: `title`, `body`, `main-box`, `summary-group`, `kpi-table`, `image`, `notes`, `key-message`,
`figure-caption`, `table-caption`. Inside one text segment a table's block comes before the body, in that
order, whatever the source order. An image line adds a `figure-caption` block when its alt text is non-empty.

## 10. Relationship to templates

The AST is design-independent. It states intent (layout, blocks, content), and the template registry plus
the layout resolver turn it into positions at render time. Consequences:

- The same AST can render through different designs.
- An unsupported layout or block for the chosen design stops the compile with the available names. No
  silent fallback exists.
- A template or pack declares which layouts and blocks it supports.

### 10.1 Evidence-oriented compositions

These are compositions of existing blocks, so every design that draws the blocks draws them:

- **figure plus interpretation:** `image` + `figure-caption` + a body that interprets it;
- **table plus decision takeaway:** a table (or `kpi-table`) + `table-caption` + a body takeaway;
- **source capture:** `image` + `figure-caption` carrying locator and source + a body that states relevance;
- **two-record appendix evidence:** a title and body or `summary-group` with at most two records, each with
  its DOI or canonical link.

For an image used as evidence, the alt text is the visible caption: a figure number plus `Source:` or
`출처:`. A `>` line right after a table is its caption and source. Appendix link fields use
`[label](https://...)` in a table cell, so the file carries an external hyperlink relationship. The gate
reads all three (evidence binding, appendix links) from the finished file.

## 11. Non-goals of v1

- Full compatibility with other slide dialects.
- Arbitrary CSS in authoring input.
- Free-form absolute positioning in Markdown (reversed by v2 section 5).
- Silent fallback or degradation for unsupported constructs.
- Raw HTML passthrough.
- Scripts or interactive content.
