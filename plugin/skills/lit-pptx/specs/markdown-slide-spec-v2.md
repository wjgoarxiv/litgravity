# Markdown Slide Specification v2

> **Status:** Current. Additive over v1: every v1 deck is a valid v2 deck and still compiles to a
> `slide-ast-v1` document.
> **Builds on:** `markdown-slide-spec-v1.md`, which stays the contract for the subset it describes.
> **Reference implementation:** `scripts/lib/directive-parser.js`, `slide-ast.js`, `markdown-loader.js`,
> `layout-resolver.js`. **Schema:** `specs/slide-ast-v2.schema.json`.

## What changed and why

v1 froze one non-goal that became the binding constraint in practice: free-form absolute positioning in
Markdown. With a closed set of six layouts and a fixed map from block type to region, a deck could look
only like the shapes its template had anticipated. A cover the template lacked, or two tables on one
slide, was inexpressible rather than difficult.

v2 opens placement in tiers so an author reaches for the least freedom that says the thing, and it opens
the layout set so a template or a tonality pack can name its own layouts. Nothing from v1 was removed. A
deck that uses none of sections 2 to 6 compiles to the same `slide-ast-v1` document as before.

## 1. Version selection

The compiler decides the AST version from content (`usesV2` in `slide-ast.js`), never from a flag.

| The deck contains | `astVersion` | `version` |
|---|---|---|
| only v1 constructs on the six v1 layouts | `slide-ast-v1` | `1.0.0` |
| a layout outside the v1 six (`free`, any family name), a slide-local key, or a `region`, `columns`, `box` or `shape` block | `slide-ast-v2` | `2.0.0` |

The validator accepts both. A deck written for a tonality uses family names (`kpi-row`, `chart-insight`),
so it compiles to v2.

## 2. Slide-local keys

Keys may follow the `layout:` line and end at the first blank line:

```
---
layout: cover
variant: split-navy

# 세탁 서비스 분기 보고
---
```

**The key set is closed to `variant` and `title`.** `variant` (section 6) swaps furniture on a legacy
template. `title: <treatment>` pins one slide's title treatment under a tonality (`references/title-treatments.md`).
The run of keys stops at the first line that is not one of them, and that line stays in the body.

Closing the set keeps body text safe. A body line such as `source: internal data` has the exact shape of a
key, so a rule of the form "any word and a colon" would delete it from the slide without a word. A mistyped
`varient:` stays visible in the body, where the author sees it, instead of becoming an ignored key. Korean
labels such as `출처: 내부 자료` were never at risk, since a key starts with an ASCII letter.

The keys travel in the AST as `meta` (a map of strings). A `title:` pin names one of the eight treatments
(`top-rule`, `top-plain-large`, `side-rail`, `band`, `statement`, `overlay`, `kicker-numeral`,
`bottom-anchor`); an unknown name, a name the pack lacks, one the family refuses, and a title that cannot
be drawn on this slide each stop the compile with the allowed set. A legacy template stops on any `title:`
pin, and a cover or section slide takes its variant's title.

## 3. Directive attributes

A directive line may carry positional values and `key=value` pairs:

```
::: box x=6.9 y=2.6 w=5.3 h=1.4 role="body text" z=over
```

`parseAttrs` splits the rest of the line on whitespace. A token with `=` is a pair, anything else is
positional. Quoted values keep their spaces and lose their quotes. An unquoted value that reads as a number
becomes a number, and `true` or `false` become booleans. Consequences worth knowing:

- Write a colour as `#E2F0EC` (a quoted or `#`-prefixed string); a bare `112233` is read as a number.
- A name with a space needs quotes.
- A v1 directive with no arguments parses as before, with an empty attribute map.

## 4. Nesting by fence length

v1 forbade `:::` inside `:::`, and every v1 deck relies on that. v2 keeps the rule and adds a convention
from fenced-div Markdown: a container opens with a longer fence than the blocks inside it, and a block
closes on a run of its own length.

| Situation | Result |
|---|---|
| a `::::` block holding `:::` blocks | accepted |
| a block inside one of the same fence length | error naming the line |
| a longer fence inside a shorter one | error |
| depth beyond two | error (`Directive nesting depth exceeds 2`) |
| a `::: shape` line anywhere | accepted; it is void and takes no close |

Only `columns` is a container. A `::: col` block is a leaf of depth two, so a column holds Markdown (bullets,
a pipe table, an image line) and no directive. A chart, a box or a callout therefore goes on the slide
outside the columns.

## 5. Placement

### 5.1 Tier 1: `region` (legacy templates)

```
::: region name=table
| 항목 | 값 |
|------|-----|
:::
```

The body parses as ordinary Markdown, and every resulting block is routed to the named region instead of the
one its type implies. The block list stays flat: `region` leaves no node in the AST and only sets
`regionHint` on each block. A name the layout lacks stops the compile with the regions it has. `name` is
required. A tonality fixes its regions by family, so `region` has no effect there.

### 5.2 Tier 2: `columns`

```
:::: columns 2fr 1fr gap=0.3
::: col
- 왼쪽
:::
::: col
![도 1. 개요](fig.png)
:::
::::
```

Tracks are positive ratios (`2fr`, `1fr`, or bare numbers). The engine divides the layout's body region
between them, so the source carries no coordinates and the same deck lands correctly on a canvas of another
size. `gap` is in inches and defaults to `0.25`.

- The track count must equal the `::: col` count; a mismatch is an error, never padding. Zero columns is an
  error.
- A layout without a body region cannot host columns (the error lists its regions).
- On a legacy template the columns replace the body region for that slide. A bullet written outside the
  columns on the same slide has nowhere to go and is dropped, so put every body line inside a column.
- Under a tonality `columns` supplies the two sides of a `comparison` (one head and numbered points per
  side).

### 5.3 Tier 3: `box` and `shape`

```
::: box x=0.7 y=6.45 w=11.9 h=0.5 role=body_text z=over
**결론:** 접수가 늘었다
:::

::: shape rect x=0.5 y=6.4 w=12.3 h=0.6 fill=#EEF4FF z=under
```

`box` requires numeric `x y w h` in inches on the template canvas (13.333 x 7.5 for 16:9). `role` names a
font role of the template's `capabilities.yaml` (default `body_text`; an unknown role stops the compile
with the available names). `align` and `valign` are passed through. The content parses as Markdown and flows
down the box: each block but the last takes the height its content needs and the last takes the rest. A
bold run-in label inside a box needs its own colon, since the engine adds none there (OF-118).

`shape` is a void directive: one line, no close. Its first positional value is the kind: `rect`, `roundRect`,
`pill`, `ellipse`, `ring`, `line`, `text`, `image`. Style attributes are `fill line lw radius rotate text
color size align valign char_spacing bold asset dir src note`; any other key stops the compile. `line` needs
`x y w` only and takes its thickness from the stroke width. Every other kind needs `h`.

`z` is `under` or `over`. A shape defaults to `under` and a box to `over`.

### 5.4 What placement does not do

A template region is never reflowed to avoid a placed box. The nudge rules that narrow a body beside an
image do not see placements, and coordinates reach the renderer as written. Covering a region is a defect the
QA gate reports (occlusion, semantic overlap), not an adjustment the engine makes. The choice is deliberate:
an engine that quietly moved content from under a box would make the author's intent unknowable.

## 6. Layouts and variants

The layout set is open. `spec-validator.js` checks only that a layout name matches `^[a-z][a-z0-9-]*$`.
Whether the layout exists is a fact about the chosen design: `layout-resolver.js` compares the name with the
template mapping (or with the tonality's families) and lists the alternatives on a miss.

- **Legacy templates** declare layouts in `layout-mapping.yaml` (AZURE-PRO: `cover`, `content`, `main`,
  `summary`, `section`, `closing`).
- **Tonalities** accept 28 content families, 9 cover variants, 6 section variants and 5 closing variants.
  A pack lists the subset it carries; a family outside the list draws with its own geometry and logs a
  `note:`.
- **`free`** needs no declaration: the slide uses no template region, so every template supports it. On a
  legacy template it accepts `notes` and placements only, and a `##` title stops the compile (set the title
  as a box). Under a tonality `free` is read as `text-column`.

A **variant** swaps a layout's decoration set and may override the regions the new furniture displaces:

```
layout: cover
variant: split-navy
```

Both travel together, because a split cover needs a narrower title than a full-bleed one. AZURE-PRO declares
`split-navy` and `minimal` for `cover` and `rule` for `section`. An unknown variant stops the compile and
lists the declared ones. A tonality ignores `variant:`; its cover, section and closing variants are
selected by the family name (`cover-figures`, `section-rule`, `closing-ask`).

## 7. Capability derivation

The allowed blocks of a layout come from the first source that has one: the template's
`supported_blocks[layout]`, then the built-in table for the six v1 names, then the blocks implied by the
regions the layout declares (`table` implies `kpi-table`, `main_box` implies `main-box`, and so on).
Placement blocks and `notes` are legal on every layout, since they need no region.

## 8. Region occupancy

A region holds one block. Two blocks claiming one region stop the compile and name both exits (`::: region
name=` or `:::: columns`). In v1 the second block silently replaced the first, which is why a slide could not
carry two tables. Two documented exceptions: images in the `image` region collapse into a grid, and caption
regions are subordinate labels where the last caption wins. An image line with alt text inside a
`region name=image` block emits its figure-caption with the same hint; the caption joins the image grid
as an entry with no source and the compile stops with `Image source is empty`. A captioned picture goes
through `columns`, or through a region with an empty alt text.

## 9. Charts

`::: chart type=<column|bar|line|area|stacked|pie|doughnut> [unit="..."] [title="..."] [labels=false]`
wraps a pipe table (first column the categories, every further column one series) and an optional `> caption`
line. It compiles to a `kpi-table` block with a `chart` field and, with a caption, a `table-caption` block
marked `figure: true`:

```json
{"type": "kpi-table", "headers": ["분기", "매출"], "rows": [["1Q", "1,120"]],
 "chart": {"type": "column", "unit": "억 원"}, "caption": "분기별 매출 (예시 데이터)"}
```

The block is legal wherever a table is, and a renderer without chart support still shows the numbers as a
table. The PPTX renderer draws a native chart that fills its region down to the caption, numbered with the
other figures. `type` defaults to `column`; a table with fewer than two headers or no data rows, and an
unknown type, each stop the compile.

Measured scientific data stays outside the dialect. `lit-scientific-visualization` draws it, and
`compile-deck.js --export-viz-context <path>` writes the template's palette, body font family, bundled font
file paths, canvas and DPI so the figure matches the deck.

## 10. Headline-number rows

A table of short values becomes a card row. The limits are part of the contract:

| Design | Columns | Rows | Cell length |
|---|---|---|---|
| legacy template | 2 to 4 | 1 (two-column tables up to 4 pairs) | 12 characters |
| tonality | 2 to 6 | 1, or 2 when the second row gives each figure's basis or comparison | 12 characters in row one, 24 in row two |

A table outside these limits stays a table.

## 11. Failure behaviour

| Condition | Message begins |
|---|---|
| unknown variant | `layout "cover" has no variant "foo". Available: ...` |
| unknown region | `block "body" maps to region "nowhere" which is not defined ...` |
| two blocks in one region | `two blocks both claim region "table" ...` |
| column count mismatch | `":::: columns" declares 2 track(s) ... but holds 1` |
| box without a number | `"::: box" is missing a numeric "h"` |
| unknown shape kind or attribute | `"::: shape" has unknown kind "star"` / `got unknown attribute "glow"` |
| directive inside a column | `Nested directives must use a shorter fence than their container` |
| `title:` on a legacy template | `picks a title treatment, which needs a tonality` |

## 12. Non-goals retained

- Full compatibility with other slide dialects.
- Arbitrary CSS as authoring input.
- Raw HTML passthrough.
- Scripts or interactive content.
- Silent fallback or degradation for unsupported constructs.

Free-form absolute positioning was a v1 non-goal. v2 reverses it for `box` and `shape` and states in
section 5.4 what the author gives up in exchange.
