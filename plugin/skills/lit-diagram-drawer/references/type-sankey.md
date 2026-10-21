# Sankey and flow quantity

**Catalog ID:** `sankey`  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Sankey suits a quantity that splits or merges across stages, where ribbon width is the main message: cost allocation, CI time, staffing, or volume movement. Pyramid/Funnel covers a one-way drop-off without branching, and Process covers ordered steps without amount encoding. A table or bar chart serves cases where exact comparison matters more than flow.

## Exclusions

The grammar fixes three left-to-right stage columns, with at most eight nodes and twelve ribbons. Quantities are nonnegative and conserve at each intermediate node and between columns. Every branch carries a stated amount. Direction comes from the ordered columns, so arrowheads are omitted. Tiny flows may merge into a named "Other" when the aggregation preserves the total and carries an explanation.

## Content schema

```yaml
title: "Build minutes by outcome"
unit: "minutes"
scale: { px_per_unit: 0.02 }
stages: [Budget, Test stage, Outcome]
nodes:
  - { id: budget, stage: 0, label: CI total, value: 12000 }
  - { id: tests, stage: 1, label: Tests, value: 7000 }
  - { id: build, stage: 1, label: Build, value: 5000 }
  - { id: passed, stage: 2, label: Passed, value: 10000 }
  - { id: failed, stage: 2, label: Failed, value: 2000 }
flows:
  - { id: budget-tests, from: budget, to: tests, value: 7000, focal_path: false }
  - { id: budget-build, from: budget, to: build, value: 5000, focal_path: false }
  - { id: tests-passed, from: tests, to: passed, value: 6000, focal_path: false }
  - { id: tests-failed, from: tests, to: failed, value: 1000, focal_path: false }
  - { id: build-passed, from: build, to: passed, value: 4000, focal_path: false }
  - { id: build-failed, from: build, to: failed, value: 1000, focal_path: true }
```

Declare exactly three stages, unique nodes within each stage, and an explicit source, target, and value for every flow. One unit and one pixels-per-unit constant apply throughout. For a middle node, incoming and outgoing sums both equal its declared value, and the first and final columns balance to the same overall total. Mark at most one editorial path.

## Deterministic layout recipe

Fix one `k` px-per-unit scale for every node and flow. Convert quantities with `height=k×value`, rounded to the nearest 4px for grid alignment; reconcile rounding at each node so its attached ribbons sum exactly to its rendered height, with any stated-value discrepancy held to one 4px step. Each stage has the same total stack height. Each node is a 12px bar, stacked vertically in stable input order within its column. Give every flow a distinct cumulative top/bottom offset interval inside its source and target node. Draw each ribbon as a single closed cubic path whose control points both sit at the horizontal midpoint between columns, producing a horizontal tangent at both bars. Column-one labels go outside left, column-two labels sit vertically centered in the clear gutter, and column-three labels go outside right. Headers go above and a legend/footer below. Reorder nodes to reduce crossings before touching geometry.

## Encoding rules

Ribbon thickness and node height both encode quantity. Ordinary paths share one muted ribbon treatment, one focal path takes the accent, and flows share hues rather than receiving one each. Offsets stay visible, ribbons attached to the same bar stay apart, and direction needs no arrowheads. Every quantity prints with its unit and reconciles to the geometry. The smallest visible ribbon measures at least 4px; a smaller one is aggregated with a documented total.

## Korean behavior

Amounts, units, and percentages stay bound together in one Korean number format. Stage headings use short Korean nouns, and node names fit a single line where possible. State the unit once in the title or subtitle and repeat it beside values when ambiguity remains. A number stays on the same line as its unit, and label shortening keeps the underlying category intact.

## Light, dark, and full variants

All skins share nodes, values, scale, ribbon offsets, order, and focal path, with only the shared paper and ink tokens switching. A full variant can add concise summary cards, each repeating a declared quantity exactly and keeping the diagram's scale.

## Accessibility

The SVG description gives the unit, stage order, total, and focal path. Add a text table of node totals and flow values with source and target names. Direction reads from stage names and text, and the focal flow is marked by a label in addition to the accent. Text sits beside ribbons, clear of them.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for overlap, clipping, canvas bounds, contrast, skin polarity, accessible SVG, and visible-text checks. Run `node scripts/verify-type.mjs --type=sankey` to verify stage, node, and flow budgets, conservation, one scale, ribbon thickness, attachment offsets and tangents, crossings, and variant parity. See [Verifier guide](verifier-guide.md). The gallery wrapper's `data-type` value must equal this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- A ribbon meeting a bar at a slant, or a control point that collapses at the target.
- Intermediate labels pinned to a ribbon edge, or an opaque mask cutting a hole in a band.
- Flow totals that fail to balance, differing scales by column, or unexplained rounding.
- Ribbons under 4px, repeated attach intervals, or tangled crossings.
- Rainbow flows, arrows on ribbons, or a Sankey standing in for a simple funnel or process.
