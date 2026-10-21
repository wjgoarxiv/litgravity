# Azure Professional: the legacy blue and white templates

Two enrolled templates carry one fixed look: `AZURE-PRO` (Pretendard) and `AZURE-A2Z` (the same design
in 에이투지체, one family per weight). The look is a geometric cover, tinted numbered cards, KPI
badges and a navy divider. Use it when the user names one of these templates or an existing deck source
already does; a new deck takes a tonality from the direction step. The templates draw on a 16:9 canvas
of 13.333 x 7.5 in with six layouts (`cover`, `content`, `main`, `summary`, `section`, `closing`) and
are compiled with the template named on the command line, because the `template:` frontmatter key
alone does not select a render:

```bash
node "$SKILL_ROOT/scripts/compile-deck.js" deck.md --template AZURE-PRO --pptx deck.pptx
node "$SKILL_ROOT/scripts/compile-deck.js" --list-layouts AZURE-PRO   # blocks and regions per layout
```

Under a legacy template the gate reports the title-variety checks (OF-110, OF-111) and the median empty
band (OF-112) as MEDIUM advisories, since the user asked for a single look; OF-109 on a hollow slide and
the contrast, overlap and integrity checks stay blocking.

## Colour tokens

| Token | Hex | Role |
|---|---|---|
| `ground` | `#FFFFFF` | slide ground |
| `paper` | `#F6F9FE` | cool off-white fills |
| `ink` | `#0E1B2C` | titles and body |
| `ink_muted` | `#51607A` | captions, secondary text |
| `primary` | `#1D4ED8` | accent: marks, KPI values, the `**emphasised**` cover-title word |
| `primary_deep` | `#0B2E6F` | divider panel, callout text, the emphasised card |
| `azure` | `#3B82F6` | decorative dots and the plus mark |
| `azure_soft` | `#93C5FD` | rings, chart series 2 |
| `tint` | `#EEF4FF` | card fill, table header fill |
| `tint_2` | `#DCE9FF` | deeper tint |
| `line` | `#D5DEEC` | hairlines and KPI card borders |

The gradient circles (`circle-lg.png`, `circle-md.png`, `circle-sm.png` under `assets/azure/`) are
PNG files, 1040, 420 and 240 px square. `--accent <hex>` derives a full
palette from one brand colour (hue kept, white text on `primary` held at 4.5:1 or better, `primary_deep`
at 7:1), recolours the decorations and regenerates the circles; the frontmatter key `accent:` does
the same. `--bg mesh` (or `background: mesh`) lays a blurred gradient wash behind every slide and a deep
variant behind dividers. `--font a2z` or `--font pretendard` swaps the font system of either template.

## Type scale (AZURE-PRO, points)

| Role | Size | Notes |
|---|---|---|
| cover title | 50 | bold, tracking -2.0, line 1.06; `**word**` takes `primary` |
| divider title | 42 | white on the navy panel |
| closing title | 44 | centred |
| slide title | 27 | bold, tracking -1.0 |
| key message | 15 | bold, `primary`, one line under the title |
| section header, card heading | 15 | bold |
| body, numbered item | 13 | line spacing 1.4 |
| table header, table data | 12 | header bold on the tint |
| KPI value | 30 | bold, `primary` in the badges (the font role lists 34) |
| eyebrow | 11 | bold, tracking +1.5 |
| KPI label | 9.5 | tracking +0.4 |
| captions | 9 | `ink_muted`, centred |
| disclaimer | 8 | notes |

AZURE-A2Z sets the same roles in 에이투지체 7 Bold for titles and headings, 9 Black for KPI values, 4
Regular for body and labels and 3 Light for the disclaimer, with no bold flag (a per-weight family takes its weight by name), and its
`content`, `main` and `summary` layouts accept no `::: key-message` block.

## Motifs and layouts

One geometric cluster stands on the cover and the divider only: a gradient hero circle at the lower
right, a ring in `azure_soft`, a small filled dot, a plus mark and a rounded square. Content pages stay
clean, with a short `primary` bar (0.9 x 0.07 in) under the title.

- **cover**: the eyebrow with its square mark (frontmatter `eyebrow:`), the title, the subtitle
  (`subtitle:`) and a pill that holds `date` and `department` joined by a bar. Variants through a
  `variant:` line after `layout:`: `split-navy` (a navy field over the right half) and `minimal` (a
  rule in place of the geometry).
- **content**: title, one-line key message, then either a body or a table; a body of two or more
  `- **Heading**` sections with numbered children and no image becomes a row of tint cards.
- **main**: as content, plus a `::: main-box` takeaway drawn as a rounded tint band with bold
  `primary_deep` text under the cards.
- **summary**: two groups (`### Heading` blocks) in rounded cards, optionally with a picture.
- **section**: a full-bleed `primary_deep` panel with a white title, a ring, a circle and a SECTION
  label; the `rule` variant is a light page with a bar.
- **closing**: a clean page with the title centred and a small ring and dot.

Cards use these tokens: padding 0.30 in, a numbered chip 0.52 in square ("01", "02"), gap 0.28 in,
radius 0.16 in, minimum height 1.6 in; with three or more cards the last one is filled in
`primary_deep` with light text. A KPI table (two to four short values over their labels) draws as badges
with the first badge filled in `primary`; a badge needs at least 1.9 in of width, so a narrow column
turns the same table into a table. Tables take up to six columns.

The outer margin is 0.84 in on the left of every layout and the pill on the cover is fully round.
