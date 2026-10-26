# Markdown Slide Specification v1

> **Status:** Superseded by `markdown-slide-spec-v2.md`, and still valid. This document
> defines the v1 contract; a deck written entirely to it compiles to a `slide-ast-v1`
> document exactly as before. v2 is additive — read it for placement (`region`,
> `columns`, `box`, `shape`), variants, and the open layout set. The one non-goal v2
> reverses is §11's ban on free-form absolute positioning.
> **Date:** 2026-04-19

The executive/research profile below is a backward-compatible authoring profile. It composes existing v1 blocks and does not add coordinates, CSS, directives, or AST types.

## Purpose

Define a constrained Markdown + directive dialect that serves as the single authoring source for PPTX slide decks. The dialect must be:

1. **LLM-friendly** — predictable structure, easy for agents to generate and edit.
2. **Precision-first** — compiles into a versioned intermediate AST that preserves layout intent.
3. **Template-aware** — resolves against enrolled template contracts, not hardcoded behavior.

## 1. Deck Structure

A deck source file is a single Markdown file with:

1. **YAML frontmatter** (required) — deck-level metadata enclosed in `---`.
2. **Slide sections** — separated by `---` horizontal rules. Each section contains a layout directive and slide content.

```
---
template: MY-BRAND
title: Deck Title
date: 2026.04.19
department: Department
presenter: Name
---

---
layout: cover

# Cover Title
---

---
layout: content

## Section Title

- Bullet 1
- Bullet 2
---
```

## 2. YAML Frontmatter

Required fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `template` | string | yes | Enrolled template name (e.g. `MY-BRAND`) |
| `title` | string | yes | Deck title |
| `date` | string | no | Presentation date |
| `department` | string | no | Department name |
| `presenter` | string | no | Presenter name |

## 3. Slide Separators

Slides are delimited by `---` on its own line (standard Markdown horizontal rule). The content between two `---` markers is a single slide section.

Each slide section starts with a `layout` directive on the first non-empty line, followed by the slide content.

## 4. Allowed Markdown Subset

### 4.1 Permitted constructs

| Construct | Syntax | Notes |
|-----------|--------|-------|
| Headings | `#`, `##`, `###` | Level 1 for cover/closing titles, Level 2 for slide titles, Level 3 for sub-headings |
| Bullet lists | `- item` | Level 1 bullets |
| Bold text | `**text**` | Within list items for section headers |
| Numbered items | `(1) text` | Manual numbering with parenthesized Arabic numerals |
| Tables | `\| ... \|` | Standard Markdown pipe tables |
| Images | `![alt](path)` | With relative or absolute paths |
| Table links | `[label](https://...)` | Rendered as a clickable external PPTX hyperlink in table cells |
| Fenced blocks | `::: type ... :::` | Directive blocks (see §5) |

### 4.2 Forbidden constructs

The following are **rejected at parse time** with explicit errors:

| Forbidden | Reason |
|-----------|--------|
| Raw HTML (`<div>`, `<span>`, etc.) | Bypasses template layout contracts |
| `<style>` blocks | CSS escapes break PPTX fidelity |
| Inline `style=` attributes | Arbitrary positioning breaks layout |
| Nested fenced blocks (`:::` inside `:::`) | Ambiguous directive nesting |
| Arbitrary CSS classes | Layout must come from template contracts |

## 5. Directive Blocks

Directives use fenced blocks with `:::` delimiters. Each directive type has a specific contract.

### 5.1 v1 Directive Set

| Directive | Purpose | Allowed in layouts |
|-----------|---------|--------------------|
| `main-box` | Bordered text box at bottom of slide | `main` |
| `summary-group` | Grouped summary content (top/bottom) | `summary` |
| `kpi-table` | Key Performance Indicator table | `main`, `content` |
| `image` | Positioned image with caption | `content`, `main` |
| `notes` | Speaker/footnotes | `content`, `main` |

### 5.2 Directive Syntax

```
::: main-box
Text content for the bordered box.
:::
```

```
::: kpi-table
| Metric | Target | Actual |
|--------|--------|--------|
| Revenue | 5000억 | 5450억 |
:::
```

```
::: notes
Source: Internal data, Q1 2026.
:::
```

### 5.3 Nesting Rules

- Directive blocks **MUST NOT** be nested inside other directive blocks.
- Each `:::` open must have a matching `:::` close before another `:::` open.
- Violation produces a parse error with the offending line number.

## 6. Layout Types

### 6.1 v1 Approved Layouts

| Layout | Purpose | Required blocks |
|--------|---------|-----------------|
| `cover` | Opening slide | title (level 1) |
| `content` | Standard title + body | title (level 2), body |
| `main` | Content with optional bordered box | title (level 2), body, optional `main-box` |
| `summary` | Two-group hierarchical summary | title (level 2), summary-groups via `###` headings |
| `closing` | Thank-you slide | title (level 1) |

### 6.2 Layout-specific content rules

- `cover`: Exactly one `#` heading. No body lists.
- `content`: One `##` heading. Body with bullet lists or tables.
- `main`: One `##` heading. Body with bullet lists. Optional `::: main-box`.
- `summary`: One `##` heading. Content organized under `###` sub-headings. The first `###` group maps to the top position, the second maps to the bottom position.
- `closing`: Exactly one `#` heading. No body content.

## 7. Bullet Hierarchy

The template uses a two-level hierarchy:

**Level 1 — Section headers:**
```
- **Section Title**
```
Rendered as bold bullet with `•` character.

**Level 2 — Numbered sub-items:**
```
  (1) Detail item 1
  (2) Detail item 2
```
Rendered as indented numbered items with `(1)`, `(2)` format.

Indentation for level 2 items is 2 spaces.

## 8. Failure Behavior

### 8.1 Parse errors

When the parser encounters a forbidden construct:

1. **Stop parsing immediately** — do not silently skip or degrade.
2. **Report the file path**, slide index, and approximate **line number**.
3. **Name the specific violation** (e.g., "arbitrary HTML `<div>` not allowed", "nested directives at line 42").

### 8.2 Validation errors

When the compiled AST violates the schema:

1. **Reject the entire deck** — do not produce partial output.
2. **Report which slide and which block** failed validation.
3. **Name the schema constraint** that was violated.

## 9. AST Output Contract

The compiler emits a JSON object conforming to `slide-ast-v1.schema.json`.

Required top-level fields:

| Field | Type | Description |
|-------|------|-------------|
| `astVersion` | string | Must be `"slide-ast-v1"` |
| `version` | string | Schema version (semver) |
| `deck` | object | Template name, title, metadata |
| `slides` | array | Ordered array of slide objects |

Each slide object must have:

| Field | Type | Description |
|-------|------|-------------|
| `index` | number | 0-based slide position |
| `layout` | string | One of the approved layout types |
| `blocks` | array | Content blocks in order |

Each block must have:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Block type: `title`, `body`, `main-box`, `summary-group`, `kpi-table`, `image`, `notes` |
| `content` or `items` | varies | Block payload |

## 10. Relationship to Enrolled Templates

The AST is **template-independent**. It describes intent (layout, content structure), not pixel positions. Template-specific rendering (fonts, colors, positions, decorations) is resolved by the template registry and layout resolver at render time.

This means:
- The same AST can theoretically render through different enrolled templates.
- Template enrollment contracts declare which layouts and blocks they support.
- A deck targeting an unsupported layout/block for a given template produces a clear error, not a fallback.

### 10.1 Evidence-oriented compositions

Enrolled templates may advertise these semantic compositions of existing blocks:

- **figure plus interpretation:** `image` + `figure-caption` + body interpretation;
- **table plus decision takeaway:** table/`kpi-table` + `table-caption` + body takeaway;
- **source capture:** `image` + `figure-caption` containing locator/source + body relevance and data basis;
- **two-record appendix evidence:** title/body or `summary-group`, with no more than two records and DOI/canonical links when available.

For a Markdown image used as evidence, alt text is the visible figure caption and should contain a figure number plus `Source:`/`출처:`. A blockquote immediately after a table is its visible table caption/source. Appendix DOI/canonical/raw URL fields use `[label](https://...)` in table cells so the PPTX contains an external hyperlink relationship. These requirements reuse existing parser and renderer behavior.

## 11. Explicit Non-Goals for v1

- Full Marp compatibility.
- Arbitrary CSS as part of authoring input.
- Free-form absolute positioning in Markdown.
- Silent fallback or degradation for unsupported constructs.
- Raw HTML passthrough.
- JavaScript or interactive content.
