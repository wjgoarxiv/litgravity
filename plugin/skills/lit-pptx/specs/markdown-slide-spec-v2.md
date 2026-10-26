# Markdown Slide Specification v2

> **Status:** Current. Additive over v1 — every v1 deck is a valid v2 deck and still
> compiles to a `slide-ast-v1` document.
> **Supersedes:** `markdown-slide-spec-v1.md`, which remains accurate for the subset
> it describes and is still the contract v1 decks are held to.
> **Date:** 2026-08-02

## What changed and why

v1 froze one non-goal that turned out to be the binding constraint in real work:
*free-form absolute positioning in Markdown* (v1 §11). Combined with a closed set of
six layouts and a fixed block-to-region map, a deck could only look like the shapes
its template had anticipated. Building a cover the template did not already offer, or
putting two tables on one slide, was not difficult — it was unexpressible.

v2 opens placement in three tiers, so an author reaches for the least freedom that
says the thing rather than dropping straight to coordinates.

Nothing was removed. The v1 constructs, layouts, directives, separator rules and
failure behaviour are unchanged, and a deck that uses none of §2–§6 below compiles to
a byte-identical `slide-ast-v1` document.

## 1. Version selection

The compiler chooses the AST version from the deck's content, not from a flag.

| Deck uses | `astVersion` |
|---|---|
| v1 constructs only | `slide-ast-v1` |
| any of: `region`, `columns`, `box`, `shape`, a slide-local key, a layout outside the v1 six | `slide-ast-v2` |

Both are accepted by the validator. This is what lets v1 fixtures and their assertions
stand untouched.

## 2. Slide-local keys

Keys may follow the `layout:` line, ending at the first blank line:

```
---
layout: cover
variant: split-navy

# Title
---
```

**The key set is closed.** `variant` (§6) is the only slide-local key, and the run stops
at the first line that is not one of them. A line the engine does not act on stays in
the body.

That is the whole guarantee, and it is deliberately not "anything shaped like a key".
A body line reading `source: internal data` has exactly the shape of a key, and
consuming it would delete it from the slide with no error. The same rule keeps a
mistyped `varient:` visible in the body rather than turning it into an ignored key that
silently does nothing — a typo you can see beats a variant that never applied.

An earlier draft of this section claimed the blank line was the boundary and that prose
was therefore safe. It was not. The Korean example it used, `출처: 내부 자료`, survived
only because `출처` is not ASCII; the English equivalent was swallowed.

## 3. Directive attributes

A directive line may carry positional values and `key=value` pairs:

```
::: box x=6.9 y=2.6 w=5.3 h=1.4 role="body text" z=over
```

Numbers and booleans are coerced; quoted values keep their spaces. A v1 directive with
no arguments parses exactly as before, with an empty attribute map.

## 4. Nesting by fence length

v1 forbade `:::` inside `:::` and every v1 deck depends on that. Rather than relax it,
containers nest by fence length — the pandoc fenced-div convention. A block closes on a
run of its own length, so `::::` may hold `:::` with no ambiguity.

- Same-length nesting: **error** (unchanged from v1)
- A longer fence inside a shorter one: **error**
- Depth beyond two: **error**

## 5. Placement

### 5.1 Tier 1 — `region`

```
::: region name=right_figure
| 항목 | 값 |
|------|-----|
:::
```

The body is parsed as ordinary Markdown; each resulting block is routed to the named
region instead of the one its type would imply. The block list stays flat — `region`
does not appear in the AST, it only sets `regionHint`.

A name the layout does not declare is an error listing the regions it does.

### 5.2 Tier 2 — `columns`

```
:::: columns 2fr 1fr gap=0.3
::: col
- 왼쪽
:::
::: col
![도1. 개요](fig.png)
:::
::::
```

Tracks are ratios and the engine divides the layout's **body region** between them, so
the source carries no coordinates and the same deck still lands correctly on a template
with another canvas. `gap` is in inches, default `0.25`.

- Track count must equal `::: col` count — a mismatch is an error, never silent padding.
- A layout with no body region cannot host columns.
- Columns replace the body region for that slide; the body region does not also render.

### 5.3 Tier 3 — `box` and `shape`

```
::: box x=6.9 y=2.6 w=5.3 h=1.4 role=body_text z=over
**결론** — 세 축으로 재편
:::

::: shape rect x=0 y=6.4 w=13.333 h=1.1 fill=#EEF4FF z=under
```

`box` requires `x y w h` in inches. `role` names a `font_role` from the template's
`capabilities.yaml`, defaulting to `body_text`. Content is parsed as Markdown and flows
down the box: every block but the last takes the height its content needs, the last
takes what is left.

`shape` is a **void directive** — one line, no closing fence. Its first positional value
is the primitive: `rect · roundRect · pill · ellipse · ring · line · text · image`. Style
attributes are `fill line lw radius rotate text color size align valign char_spacing
bold asset dir src`, checked at compile time so a typo fails loudly. `line` is the one
kind that needs no height; it takes its thickness from the stroke.

`z` is `under` or `over`. Shapes default to `under`, boxes to `over`.

### 5.4 What placement does not do

**A template region is never reflowed to avoid a placed box.** The auto-nudge rules that
narrow a body beside an image do not see placements at all, and coordinates arrive at the
renderer exactly as written. Covering a region is therefore a defect the QA gate reports,
not a nudge the engine applies. This is deliberate: an engine that quietly moved content
out from under an author's box would make the author's intent unknowable.

## 6. Layouts and variants

The layout set is no longer closed. `spec-validator` checks that a layout name is an
identifier (`^[a-z][a-z0-9-]*$`); whether it exists is a fact about the chosen template,
and `layout-resolver` compares it against the template mapping and names the alternatives
when it does not match.

`free` needs no declaration — it means "this slide uses no template region", so every
template supports it and the slide is built entirely from placements.

A **variant** swaps a layout's decoration set and may override the regions the new
furniture displaces:

```
---
layout: cover
variant: split-navy
---
```

Both parts travel together, because a split cover needs a narrower title than a
full-bleed one. An unknown variant is an error listing the ones the layout declares.

## 7. Capability derivation

When a template declares a layout but publishes no `supported_blocks` entry for it, the
allowed blocks are derived from the regions that layout declares. Placement blocks and
`notes` are allowed everywhere, since they do not depend on a region existing.

## 8. Region occupancy

A region holds one block. Two blocks claiming the same region is an error naming both
ways out — `::: region name=` or `:::: columns`. In v1 the second block silently
overwrote the first, which is why a slide could not carry two tables.

Two exceptions are documented behaviour decks already rely on: images collapse into a
grid, and captions are subordinate labels where the last one wins.

## 9. Charts

`::: chart type=<column|bar|line|area|stacked|pie|doughnut> [unit="…"] [title="…"] [labels=false]`
wraps a pipe table (first column: categories; every further column: one series) and an
optional `> caption` line. It compiles to a `kpi-table` block carrying a `chart` field, so it
is legal wherever a table is, and a renderer without chart support shows the numbers as a
table. The PPTX renderer draws a native chart that fills the region down to its caption; the
caption is numbered with the figures ("도 N.").

Plots of measured scientific data stay outside this dialect: they are produced by
the scientific visualization skill and placed as an image. `compile-deck.js --export-viz-context <path>` writes the template's
palette, body font family, **bundled font file paths**, canvas and DPI so the chart is
drawn in the deck's own visual system rather than a library default.

## 10. Non-goals retained from v1

- Full Marp compatibility
- Arbitrary CSS as authoring input
- Raw HTML passthrough
- JavaScript or interactive content
- Silent fallback or degradation for unsupported constructs

The single v1 non-goal v2 reverses is free-form absolute positioning, and §5.4 states
what was kept in exchange.
