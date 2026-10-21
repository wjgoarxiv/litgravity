# Pyramid and funnel

**Catalog ID:** `pyramid`  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

A pyramid shows a ranked hierarchy in which a broad base carries ever narrower, rarer, or more valuable levels. A funnel shows a measured audience or quantity falling through successive stages, where the narrowing itself conveys attrition. Reach for Bar when exact comparison across categories outranks the taper, and for Tree when the relationship branches.

## Exclusions

Keep one convention per figure: an upward pyramid or a downward funnel. A qualitative priority stack carries no numeric widths, because widths would imply data. A real funnel with differing observed proportions uses widths that reflect them. Hierarchical data of arbitrary kind stays a hierarchy and is never relabeled as a quantity.

## Content schema

```yaml
orientation: funnel            # pyramid | funnel
title: "Request conversion"
unit: "requests"
layers:                        # 4–6, in visible top-to-bottom order
  - { id: visit, label: Visit, detail: "10,000", value: 10000 }
  - { id: signup, label: Sign-up, detail: "4,200 · 42%", value: 4200 }
  - { id: activate, label: Activation, detail: "1,700 · 17%", value: 1700, focal: true }
  - { id: retain, label: Retained, detail: "980 · 9.8%", value: 980 }
```

Every layer has a stable ID and a concise label, with an optional one-line detail and an optional value. A data funnel needs a nonnegative value on every stage, a shared unit and denominator, and a visible count or percentage. A conceptual pyramid can leave values out. Mark at most one focal layer.

## Deterministic layout recipe

Set a 1000×560 viewBox and a centered stack starting at y=80, with equal layer height `h=64` and an 8px gap between layers. For a qualitative pyramid of `n` layers, interpolate width linearly from 700px at the base to 260px at the apex and center each trapezoid on x=500. For a funnel, scale each trapezoid's width in proportion to its declared value on one linear scale (`width_i = max_width × value_i / max_value`). A small minimum width is allowed when it is labeled as a visual floor and leaves the ranking intact; the default is no floor. A pyramid reads bottom-up from broad base to narrow apex, while a funnel lists the largest stage first at the top. Center the label and value horizontally in each trapezoid, and set optional drop-off notes in a consistent side column. When labels exceed the safe area, extend the viewBox and leave the stack at full size.

## Encoding rules

Width encodes magnitude only in a measured funnel, where it is proportional to the value. In a conceptual hierarchy the taper is a convention, so the subtitle or alternative text says so whenever ambiguity is possible. Apply one neutral treatment to all layers with at most one accent layer: the apex of a pyramid, the conversion bottleneck of a funnel, or a single user-selected focal stage. Layer height stays equal. An optional axis arrow may read "rarer" or "drop-off" and always accompanies the labels.

## Korean behavior

Name stages with short Korean nouns and write numbers in the concise notation of the shared Korean number and unit format. `%`, count units, and the value stay together. Labels inside wide layers may wrap to two lines, and narrow apex layers take a shorter label. Keep Korean line-height consistent and place explanatory prose outside the trapezoid.

## Light, dark, and full variants

Light and dark keep identical widths, order, labels, and accent target. Only shared tokens change; check each outlined trapezoid against its paper background. The full variant may add a restrained title and one or two summary notes beside the stack, with all layer geometry and data unchanged.

## Accessibility

The SVG gets an accessible title and description stating the orientation and whether widths are quantitative. Add a text list in stage order giving each label, value, unit, and denominator. Labels and numeric text carry every comparison, so color is never the sole carrier. Keep visible stroke boundaries between neighboring layers and let text sit fully inside its polygon edges.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for overlap, edge bounds, label clipping, contrast, skin polarity, accessibility, and visible-text checks. Run `node scripts/verify-type.mjs --type=pyramid` to validate the catalog marker, and reconcile declared values with rendered widths by hand for quantitative funnels. See [Verifier guide](verifier-guide.md). The gallery wrapper's `data-type` value must equal this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- Seven or more layers, unequal decorative layer heights, or layers too small to label.
- Quantitative funnel widths that are equal, reversed, or unrelated to declared values.
- A data value that appears only in a source note, or a percentage lacking its denominator.
- Multiple accent layers, gradients that imply a second scale, shadows, or rainbow colors per layer.
- A pyramid over unrelated categories, or a funnel over a hierarchy without attrition.
