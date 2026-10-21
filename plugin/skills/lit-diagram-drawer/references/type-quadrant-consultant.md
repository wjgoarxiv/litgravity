# Quadrant consultant: scenario matrix

**Catalog ID:** `quadrant-consultant`  
**Parent grammar:** [Quadrant](type-quadrant.md).  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

This 2×2 scenario layout presents four named futures, archetypes, or strategic options shaped by two independent drivers. Each cell is the conclusion, and its text explains the scenario. When the exact point location inside a cell carries information, select the standard `quadrant` instead. This variant carries no point cloud and implies no score.

## Exclusions

The grammar fixes two drivers and four cells. Prioritization, density, measured coordinates, three-by-three grids, and matrices whose points cluster inside cells belong to other types. A risk heatmap or ranking table remains its own tool.

## Content schema

```yaml
title: "Four operating futures"
x_axis: { low: Local, high: Global }
y_axis: { low: Stable, high: Volatile }
scenarios:
  - { id: "01", x: low, y: high, name: "Rapid fragmentation", description: "Regional platforms set the rules.", focal: true }
  - { id: "02", x: high, y: high, name: "Open competition", description: "Shared standards coexist with volatility." }
  - { id: "03", x: low, y: low, name: "Steady federation", description: "Local systems change slowly." }
  - { id: "04", x: high, y: low, name: "Managed scale", description: "A few stable global platforms dominate." }
```

Each cell requires a distinct scenario name and a description of 1–3 lines. Every scenario records its high/low combination explicitly, so interior positions are never computed. Exactly one focal scenario receives the accent treatment. Axis names and cell tags share the same driver terms.

## Deterministic layout recipe

Set a 1000×620 canvas. Arrange four equal 280×180 cells in a 2×2 block around an open 48px central axis gap, with the shared axes centered on the canvas midpoint. Extend both axes 24–36px past the outer cell edges and put arrowheads on both ends. Single-word endpoint labels sit beyond the arrow tips at fixed offsets: top and bottom centered, left right-aligned, right left-aligned. Within each cell, stack a small numbered corner tag, a left-aligned scenario title, and a description limited to three lines. Cell text begins at the same inset in all four quadrants. Close with the standard bottom legend rule and two swatches, one neutral and one accent. When localized text overflows, grow the canvas or abbreviate; all four cells keep one size.

## Encoding rules

Cells encode just the two high/low combinations. One scenario may carry a light accent tint, an accent border, and an accent corner tag, while the other three share a neutral treatment. Dot position, cell area, opacity ramps, and fill color carry no quantity. Each label tag states its x/y combination, which lets readers confirm axis polarity directly.

## Korean behavior

Axis endpoints use concise Korean terms with unambiguous polarity. Cell titles may wrap once, and descriptions run at most three balanced lines under the shared Korean line-height. Scenario numbers sit beside their names, and Latin acronyms stay whole. Localize all four cells together; proper names are the only permitted exception to a single language.

## Light, dark, and full variants

Cells, axis directions, labels, scenario mapping, and focal choice remain identical across skins. The full variant may add an editorial title and a short "decision to watch" note outside the matrix. Retain the shared paper, rule, and typography system so the layout stays clear of whiteboard branding.

## Accessibility

The SVG description names both drivers and the four high/low combinations. Add a text alternative that lists cells in reading order (top-left, top-right, bottom-left, bottom-right), each with its driver combination, title, and description. State the focal scenario in words. Arrow directions and printed endpoint labels must survive grayscale output.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for cell and label overlap, bounds, clipped text, contrast, skin polarity, SVG accessibility, and visible-text checks. Run `node scripts/verify-type.mjs --type=quadrant-consultant` to validate the catalog marker, and check the four cell assignments and the focal scenario by hand. Cell narratives are qualitative, so treat them as outside any point-value check. See [Verifier guide](verifier-guide.md). The gallery wrapper's `data-type` value must equal this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- Empty "Scenario 1–4" placeholders in a finished diagram.
- Unequal cells, dot clouds, or invented numerical placement within cells.
- One-way axes, missing endpoint labels, arrow glyphs in labels, or tags that disagree with the axes.
- Multiple focal cells, bold axis labels, extra colors, or a 3×3 layout.
- Long consulting prose that forces tiny type or departs from the common visual system.
