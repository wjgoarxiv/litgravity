# Venn diagram

**Catalog ID:** `venn`

## Purpose and selection

Pick a Venn diagram to explain meaningful overlap between two or three named sets, such as shared traits, eligibility groups, or a conceptual intersection. Pick a matrix for four or more sets, or a table when exact membership outweighs the overlapping shape. Circle area carries a quantitative claim only when the source membership counts and the geometry were deliberately computed and verified.

## Content schema

Define two or three sets with stable ids, names, optional short descriptions, and their membership records. For every region (each set-only area and every intersection), provide the intended label or mark it explicitly as empty. State whether the circles are conceptual or quantitatively sized. When an intersection is the focal point, the brief names it up front, before rendering.

## Deterministic layout recipe

1. Use two circles for one pairwise comparison or three circles for a three-way overlap. Assign centers and radii on the 4 px grid. Comparable conceptual sets share one radius, and radii vary only where source data supports the intended relative set sizes.
2. Arrange the circles symmetrically around the intended common area, leaving clear outer label positions. Verify that every required intersection exists and is large enough to hold its label. Circles keep their true shape, so text is fitted to the geometry.
3. Put each set name outside its circle with enough clearance from the stroke. Region labels go in the open area they describe. When an overlap is too small, run a short leader to a label in clear space and keep the connection unambiguous.
4. Use low-opacity fills so overlaps stay visible. Highlight one intersection with a restrained accent fill or outline, selecting a single region as focal. Add a simple legend when the membership encoding needs explanation.

## Visual encoding

Circle boundaries identify sets, and geometric overlap identifies shared membership. Use soft, related fills and clear hairline borders. Label every set, including a third one, with text so its identity never rests on a new color. When circle and intersection areas do not encode member counts faithfully, state that the diagram is conceptual and provide exact counts in an adjacent table or text.

## Korean text

Set set names and intersection labels in Pretendard. Keep labels concise and name the shared property explicitly. Hangul labels stay inside their region or move to a clean label position through phrase-level wrapping or a leader. Mono is reserved for exact counts or source identifiers. Follow [Korean typography](korean-typography.md).

## Light, dark, and full variants

Centers, radii, overlaps, and label placement match across light, dark, and full variants. Change only semantic surface/fill tokens and verify that compounded overlaps remain distinguishable. In the full version, a concise title and short explanation sit outside the set geometry, and the only circles drawn are the declared sets.

## Accessibility

Include a title and description naming every set and explaining each relevant overlap. Give each circle a visible set name. Text or line style reinforces any highlighted intersection, and membership is defined by labels. When the shape is quantitative, provide the exact set membership or counts in a text alternative.

## Verifier gates

Run `scripts/verify-diagram.mjs` for circle bounds, label clipping, overlaps, contrast, skin, visible text, and a11y. Run `scripts/verify-type.mjs --type=venn` for two/three-set limits, circle geometry, required membership regions, and label placement. Inspect overlap regions in both skins and at the target Office size.

## Anti-patterns

- Four or more circles crowded onto one page.
- Missing set names or unexplained empty/intersection regions.
- Circles that fail to overlap when intersection is the point.
- Label text touching a circle stroke or floating without a region association.
- Quantitative area claims made by a conceptual sketch.
- Accent color on several overlaps, leaving no single focal region.

## Related references

[Nested](type-nested.md) · [Treemap](type-treemap.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
