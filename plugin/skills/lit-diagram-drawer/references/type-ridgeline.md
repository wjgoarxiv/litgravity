# Ridgeline

**Catalog ID:** `ridgeline`  
**Parent family:** distribution variant of Line; select `ridgeline` directly when each row is a distribution rather than a value at each time.  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Ridgeline compares several distributions on a shared horizontal scale when shape, spread, or multimodality outweighs a summary percentile. Each ridge is one distribution. A histogram fits one distribution, small multiples fit two, Line fits a time series, and a table of percentiles fits cases where the shapes look alike and a compact exact summary reads better.

## Exclusions

Use 3–12 distributions, 8–40 shared bins, one unit and x-domain, and one shared amplitude. The grammar omits sample size and total volume: each distribution is normalized to its own count before shared scaling, so ridge height shows concentration and shape, and says nothing about traffic. Different units or x-ranges need a separate layout. Smoothing requires an explicit method and the true bin vertices; the default is unsmoothed straight segments.

## Content schema

```yaml
title: "Request latency distributions"
unit: "ms"
x_domain: [0, 500]
bins: [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440, 500]
normalization: probability-density-per-series
amplitude: 1.0                  # one shared peak-to-pixel factor
series:
  - { id: checkout, label: Checkout, counts: [0, 1, 6, 17, 21, 14, 8, 6, 7, 9, 7, 4, 0], focal: true }
  - { id: search, label: Search, counts: [0, 2, 7, 13, 18, 15, 11, 8, 5, 3, 2, 1, 0] }
```

All ridges share the same bin count, x-domain, and known bin values, with zero at both ends so each path returns to its baseline. Record the normalization and the shared amplitude. At most one ridge is focal. When absolute population size matters, add an explicit sample-size label or pick a chart that encodes volume.

## Deterministic layout recipe

Set a 1000×500 viewBox. The shared x-run spans 320–680, and each bin maps linearly across it. For five rows, baselines fall at `y=152+56i`; for other values of `n`, center the fixed 56px-pitch stack vertically. Convert normalized density to height with the same amplitude on every row. Draw each ridge as a closed polygon: start on the baseline, run straight segments through each bin point, return to the baseline, and close. Splines stay out. The series name sits left of its baseline, and its nonzero x-range sits to the right, both aligned to that row. Bin labels go below the stack, with one vertical amplitude caption at the left. Paint baselines first, then neutral ridges from top to bottom, then the focal ridge and labels. Gridlines are omitted.

## Encoding rules

X-position is the shared value domain, and vertical height is normalized density. Both appear in the source note or description, along with a statement that total volume is outside the encoding. Use one accent ridge and a restrained ink-opacity ramp for the rest, with fixed stroke weights and low-opacity fills. Range labels stay bound to the bins they summarize. A common amplitude is essential, so every ridge keeps the shared scale rather than being stretched to equal height. Overlap is deliberate and reaches only the next row; a peak must leave the rows two above it visible.

Bind each ridge path with a unique `data-ridge`, its zero baseline in `data-baseline`, and its ordered comma-separated bins in `data-bins`. Draw one baseline rule per ridge using the same `data-ridge` and `data-role="baseline"`, and bind name and range labels to that ID with `data-role="name"` or `data-role="range"`. Each bin tick carries `data-tick` (index) and `data-bin` (value). The checker reads raw geometry, so paths, labels, and ancestors keep their original coordinates, free of transforms or CSS geometry.

## Korean behavior

Each ridge name stays on its baseline, with the x-range in the same unit. Korean service or cohort labels are concise nouns. Format the shared x-axis units once, and keep bin values and units together. When Korean names wrap, reserve a wider left gutter for all rows; ridge centers and amplitude remain fixed.

## Light, dark, and full variants

Every variant uses identical distributions, shared domain, amplitude, baseline pitch, and accent target. Light and dark change only shared tokens, and ramp wording stays skin-neutral, such as "strongest tone" in place of "darkest". The full variant may add a small editorial frame or summary cards with already-declared statistics, and ridge height never implies volume.

## Accessibility

Describe the measure, unit, domain, normalization, shared amplitude, and what vertical height means. Add a text table with each series name, nonzero range, and any separately declared sample size. Opacity and accent are secondary cues; row identity comes from labels. Outlines stay visible at contrast level, and a nonvisual statement says that overlapping outlines are separate distributions.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for overlaps, off-canvas geometry, clipping, contrast, skin polarity, SVG accessibility, and visible-text checks. Run `node scripts/verify-type.mjs --type=ridgeline` to compare every bin vertex against one shared domain and amplitude, and to validate baselines and pitch, range labels, endpoint closure, series count, and variant parity. See [Verifier guide](verifier-guide.md). The gallery wrapper's `data-type` value must equal this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- A private amplitude or baseline for one ridge, or volume read from ridge height.
- Different domains, units, or bin centers across rows.
- A path that starts or ends above baseline, clips mass, or invents a peak through smoothing.
- Tight pitch that hides the row above, one color per series, or a "darker is faster" key.
- One or two ridges, more than twelve, or omitted ranges in a shape-only comparison.
