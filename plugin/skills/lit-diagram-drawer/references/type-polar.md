# Polar chart

**Catalog ID:** `polar`  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Pick Polar for one nonnegative quantitative series across 4–8 categories whose cyclic order is meaningful: hours in a day, months in a seasonal cycle, or ordered phases that wrap. Radius encodes magnitude and angle encodes category position. Radar suits several entities measured on the same criteria, Bar suits categories without a circular order, and Line suits longer ordered time sequences.

## Exclusions

The first version is static and supports one series, 4–8 equally spaced categories, a linear scale starting at zero, and at most one focal category. Personality/competency wheels, arbitrary point placement, multiple series, negative values, unequal sector widths, log scales, filled wedges, and donut baselines belong to other chart types. A missing value is unknown and differs from zero, so resolve it before drawing.

## Content schema

```yaml
title: "Requests by time window"
unit: "% of daily peak"
scale: { min: 0, max: 100 }
start_angle: -90
clockwise: true
categories:
  - { id: night, label: "00–03", value: 32 }
  - { id: early, label: "03–06", value: 18 }
  - { id: morning, label: "06–09", value: 24 }
  - { id: midday, label: "09–12", value: 58 }
  - { id: peak, label: "12–15", value: 100, focal: true }
  - { id: afternoon, label: "15–18", value: 82 }
  - { id: evening, label: "18–21", value: 76 }
  - { id: late, label: "21–24", value: 45 }
```

Provide 4–8 uniquely named categories in meaningful order, finite values within the shared range, an explicit unit, and an optional one-category focus. Keep the input order, since sorting by value would break the cycle. `min` must be exactly zero and `max` finite and positive.

## Deterministic layout recipe

Use a 1000×520 viewBox, center `(500,230)`, and outer radius `R=160`. Draw five circular guide rings at 20%, 40%, 60%, 80%, and 100% of `R`. For category `i` among `N`, calculate `theta = start_angle + s×2πi/N`, with `s=+1` clockwise and `−1` counter-clockwise, after converting the start angle to radians. Compute `r=R×value/max`, then the endpoint `(500+r cos(theta), 230+r sin(theta))`. Draw the faint category spoke out to the outer ring and a value ray from the center to the endpoint. Put category text at radius `R+28` and value text at `R+44`; keep labels horizontal, choosing the start/end/middle anchor by the side of the circle. Place scale labels on the top spoke only. A value of zero prints its zero and draws no ray or endpoint marker. Drawing order: paper, rings, spokes and ring labels, non-focal rays, focal ray, markers, category/value labels, legend.

## Encoding rules

Ray length alone encodes value. Markers have a constant radius, and rings and spokes are structural guides. Use muted rays for ordinary categories and at most one accent ray. Sector fills and value-dependent line widths stay out of the chart. Keep the category order and the common zero baseline visible. Store each category's declared value and computed angle/radius as machine-readable metadata for `verify-type`.

The polar verifier contract is carried in SVG attributes: put `data-polar-chart` and the shared `data-polar-cx`, `data-polar-cy`, `data-polar-radius`, `data-polar-min`, `data-polar-max`, `data-polar-start-angle`, `data-polar-clockwise`, `data-polar-radius-encoding="linear"`, and `data-polar-inner-radius="0"` on the root SVG. Wrap each category in a `<g>` with `data-polar-category`, `data-polar-index`, and `data-polar-value`; add `data-polar-focal="true"` only to the single focal category. Give every ray, spoke, and rule line exactly its corresponding `data-polar-ray`, `data-polar-spoke`, or `data-polar-rule` role; mark all five rings with `data-polar-ring`, endpoints with `data-polar-marker`, and value labels with `data-polar-value-label`. The optional canvas rectangle is identified by `data-polar-background`. Keep raw coordinates readable to the checker by avoiding transforms or CSS geometry that could move a verified mark.

## Korean behavior

Category order and angles stay identical across language variants. Prefer short labels, and place longer Hangul labels on one or two horizontal lines outside the ring. Put units in the subtitle or a single legend statement and keep them out of every value label. Use Korean numeral formatting consistently, and keep time ranges and units together on one line.

## Light, dark, and full variants

Light/dark keep identical values, coordinates, order, and focus, and only the shared tokens change. The full variant may add an editorial frame and short interpretation cards while the chart geometry stays fixed. Output is static, with no hover, drag, or animation.

## Accessibility

The SVG description names the measure, the shared scale, the category order, and the maximum category. Include an ordered text alternative with category/value pairs and the unit. Keep all labels horizontal and print numeric labels so the chart reads without color, and ensure spoke/ray contrast against each skin. Decorative rings are hidden from the accessible name.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for bounds, clipping, contrast, skin polarity, accessibility, overlaps, and visible-text checks. Run `node scripts/verify-type.mjs --type=polar` to recompute the five rings, spokes, angles, ray lengths, zero values, unique labels, and light/dark geometry parity from the declared input. See [Verifier guide](verifier-guide.md). Confirm that the gallery wrapper's `data-type` value matches this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- A truncated nonzero inner baseline, donut hub, filled wedge, or area encoding.
- Categories sorted by magnitude, or unequal angles with no declared reason.
- Missing data plotted as zero, a minimum visible ray added, or multiple series.
- Rotated/tangent labels, category-specific colors, or more than one accent target.
- Polar coordinates chosen where circular order adds no information.
