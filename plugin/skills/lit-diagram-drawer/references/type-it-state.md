# IT current state

Catalog ID: it-state

## Purpose and selection

This type shows the present-day legacy landscape ahead of a modernization or consolidation. Zones group organizational phases, departments, or technical domains; components name real systems; labeled handoffs expose file shuffling, manual work, and brittle integrations. The intended reading is the current operating picture, pain points included, and the proposed target architecture belongs elsewhere.

## Exclusions

High-Level or DP integration covers the proposed platform; architecture covers runtime components and service links; a table covers an inventory without meaningful relationships. A future-state target joins the picture only when a before/after pair is explicitly requested. A connector from a footer concern to one component is usually a category error, because the footer describes a cross-cutting service.

## Content schema

Provide a title, subtitle, and optional eyebrow; choose one orientation; define 2–4 ordered zones with a short name; and list 1–5 components per zone, each with a unique ID, a name, an optional technical sublabel, an optional catalog icon, and a kind of standard, focal, or external. Define connectors by component IDs with a short label, semantic style, optional icon, and optional dashed flag. Add at most three unconnected cross-cutting footer bars. The legend lists the styles actually used, plus focal and external when present. The pain-point rationale and source period go in a note.

## Deterministic layout recipe

Default to horizontal flow on a 4px grid. Set x padding to 16px, zone gap to 20px, zone top to 52px, and zone height to 360px. Derive each zone width from a 200px base plus 24px per component, snap widths, and distribute the remaining space evenly; each zone width comes from this formula and stays unadjusted by hand. Inside a zone, inset components 20px, use 56px height (68px if focal, 72px when two-line subtext is needed), and separate rows by 32px. Zone labels sit on a small paper-colored break in the upper border. Footer bars start 24px below the zones, are 56px high with 8px gaps, and share the canvas width inside the side margins. Add 40px for the legend and 24px of lower breathing room. For vertical orientation, keep x padding=16px and stack the zones from y=52 with a 20px gap. Each zone spans the available 968px width, and its height is 112px plus 24px per component. Place the zone label 20px from the top-left, then lay its component cards in a single left-to-right row, each 56px high (68px focal, or 72px when subtext wraps), separated by 16px; divide the usable width evenly and give the final card any rounding remainder. Cross-zone links leave the source bottom and enter the destination top. Footer bars follow the last zone using the same 24px offset and row formula as horizontal orientation. Compute viewBox height from the final zone, the footer rows, the 40px legend, and the 24px lower margin. Keep a single orientation throughout, with zones unrotated.

## Encoding rules

Standard components have a plain paper fill and an ink outline. Focal components get an accent tint and accent outline, two at most. External components use a muted dashed outline. Link style distinguishes ordinary data handoff, external/network link, and focal/pain-point route, and a dashed stroke adds optional or manual transfer meaning. Place a short label and an optional monochrome icon near the source end, visibly offset from the connector. Route with rounded orthogonal elbows; connectors touch destination edges and pass around nodes. Cross-cutting footers have no outgoing connectors. Cap custom color overrides at three, and keep them off focal nodes.

## Korean behavior

Retain official product and institution spellings, and add concise Korean explanations for acronyms when known. Keep the zone name short enough to fit horizontally. Use two-line Hangul sublabels in place of tiny type. Pretendard is the default sans face, and mono is reserved for file formats, protocol names, system IDs, and connector tags. Follow the shared rules for slash spacing, dates, units, and Korean/Latin boundaries.

## Light, dark, and full variants

Light and dark versions use the same zone/component inventory, coordinates, edge semantics, and legend order. Apply semantic token inversion and recheck the dashed external boundary, the focal tint, and the connector-label mask. The full version may frame the SVG with a title, a one-sentence scope, a source/date note, and a short “current friction” summary outside the diagram. Target-state systems stay out of the current-state map.

## Accessibility

Add a title and description that identify the time period, zone sequence, focal pain points, and external systems. Every icon has a text label. Name directional handoffs in labels or in a nearby linear text outline. A visible focal style plus a textual name for the concern identifies a bottleneck, with accent color as a supplement. Apply contrast and reading-order requirements from [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for orthogonal routing, overlap, off-canvas edges, clipping, contrast, skin polarity, SVG semantics, and visible text. Run scripts/verify-type.mjs --type=it-state to check zone count, component limits, valid endpoint IDs, focal and external styles, footer bar count, and legend coverage. When vertical mode is used, inspect both orientation layouts in a rendered screenshot, and run the humanizer check over all labels and notes.

## Anti-patterns

- Future platform services mixed into a “current” map without a separate panel.
- More than four zones, five components per zone, or sixteen total components.
- Diagonal edges, or arrowheads that stop short of destination borders.
- A focal treatment on every failure point.
- Connected footer bars that imply ownership or flow they do not express.
- Tiny acronym-only labels that stakeholders cannot map to a system.
- Arbitrary source colors or decorative shadows.
- Phases reordered to make the drawing prettier at the expense of truth.

## Related references

[Style guide](style-guide.md) · [Output spec](output-spec.md) · [Semantic patterns](semantic-patterns.md) · [Icons](primitive-icons.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md) · [High-Level](type-high-level.md)
