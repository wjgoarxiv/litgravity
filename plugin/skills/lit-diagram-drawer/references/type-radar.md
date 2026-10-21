# Radar and spider chart

**Catalog ID:** `radar`  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Radar compares 3–5 entities across 3–5 quantitative criteria on one shared, normalized scale, and it works best when several dimensions form a recognizable profile. Two entities, many criteria, or exact values that readers must compare call for a table or grouped bar chart. One series across cyclic categories calls for Polar.

## Exclusions

Every axis is meaningful, measurable, and comparable after explicit normalization. Mixed units need a declared transformation. The caps are five axes and five series, a zero baseline, and polygon area carries no extra meaning. Two-series charts usually have clearer alternatives. A measured scientific dataset belongs in the scientific-visualization workflow when that is the requested task.

## Content schema

```yaml
title: "Storage options"
scale: { min: 0, max: 10 }
axes: [Latency, Durability, Cost, Operations, Portability]   # 3–5
series:
  - { id: local, label: Local, values: [8, 6, 7, 5, 8] }
  - { id: managed, label: Managed, values: [7, 9, 6, 8, 7], focal: true }
  - { id: community, label: Community, values: [6, 7, 7, 6, 6] }
```

Each series carries exactly one finite value per axis, inside the shared range. Normalize source measures before drawing and record the method and meaning of the common scale. Axis order stays fixed across every series and skin. At most one series is focal.

## Deterministic layout recipe

Set a 1000×560 viewBox, center `(500,240)`, and outer radius `R=160`. For axis `i` of `N`, use `angle=−π/2+2πi/N` and outer vertex `(cx+R cos(angle), cy+R sin(angle))`. Draw five closed polygon rings at fractions 0.2, 0.4, 0.6, 0.8, 1.0, with spokes running from the center to each outer vertex. A value `v` on scale maximum `S` lands at `center+(v/S)×(outer_vertex−center)`. Serialized coordinates may be rounded, consistently, while the values themselves stay exact. Place one-word axis labels 16px beyond their outer vertex, and put numeric scale ticks along the top axis only. Paint non-focal polygons in stable input order from smallest area to largest, followed by the focal polygon and its vertices, then the legend. The legend keeps the same series order.

## Encoding rules

The normalized value along each spoke carries the comparison, and polygon fill acts as a light translucent aid. Use an editorial series palette with a single accent for the focal series, and avoid assigning an arbitrary hue to each item. Vertex markers appear on the focal series only. The legend labels series by name, and axis criteria are labeled directly. The baseline sits at zero. State the normalization so that a "7" reads the same on every spoke.

## Korean behavior

Shorten axis names to one Korean word where possible. Scores and denominators stay explicit, e.g. `7/10`, along with a statement of whether high means more or better. The Korean version keeps the identical axis order. A two-line axis label fits only outside the plot with no overlap on its neighbor; otherwise add an explanatory key.

## Light, dark, and full variants

Light and dark preserve data, geometry, series order, normalization, and focus, changing only shared tokens and contrast-safe palette variants. The full variant may add a short summary for the focal option and brief comparison cards, using only values already in the chart.

## Accessibility

The SVG title and description name the entities, criteria, scale, normalization, and focal series. Supply a table-like text alternative with one row per entity and one value per criterion. Patterns and labels separate the series in grayscale, so polygon hue is never the only identity cue. Grid and spokes stay subtle yet perceptible.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for bounds, overlap and clipping, contrast, skin polarity, SVG accessibility, and visible-text checks. Run `node scripts/verify-type.mjs --type=radar` to validate the catalog marker. The registry holds no specialized radar proof, so compare the declared values, axis order, and coordinates across variants by hand. See [Verifier guide](verifier-guide.md). The gallery wrapper's `data-type` value must equal this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- More than five series or axes, a two-series radar, or a mixed scale lacking normalization.
- A truncated inner ring, non-quantitative axes, or polygon area presented as a metric.
- Dots on every series, a rainbow, multiple focal series, or unlabeled polygons.
- Axis labels in mono type, text over the grid, or differing axis order between skins.
