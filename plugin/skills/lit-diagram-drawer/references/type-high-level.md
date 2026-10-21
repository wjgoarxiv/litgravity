# High-Level stack

Catalog ID: high-level

## Purpose and selection

This parametric layout draws an end-to-end platform stack, so the reader sees the stages from external sources through ingestion, storage, transformation, and consumption, with deployment scope and cross-cutting operation in view. It suits a compact platform overview and leaves detailed network topology to other types. Exactly one focal component carries the title's main point.

## Exclusions

IT current-state covers a legacy before-picture; deployment covers runtime placement by zone, host, artifact, replica, and port; architecture covers a general service topology with detailed links; data-flow covers ownership and transformations at each pipeline step. This pattern applies when the platform deploys to a cluster-like boundary and the stages form an ordered stack.

## Content schema

Supply ordered horizontal phase chevrons with positive integer weights; up to four external sources with role and destination IDs; cluster components with a globally unique ID, name, stage, kind, optional icon, short role tag, and optional subtitle; explicit directed connections with a relationship kind; exactly one focal component; and an ordered list of vertical concerns. Component kinds are node, orchestration bar, or cross-cutting bar. Each vertical concern pairs with one cross-cutting bar, and an orchestration bar pairs with the orchestration chevron. Unsupported or unknown IDs fail validation, and the drawing never guesses a node for them.

## Deterministic layout recipe

Use a 1000px-wide SVG. When vertical concerns exist, reserve a 28px strip at x=972 and an 8px breathing gap, so the main body ends at x=964. The phase banner sits at y=4 with 28px height. Partition the body width by the declared phase weights, snap boundaries to 4px, and give any rounding remainder to the last phase. The external source zone starts at x=4, y=40, sized from the first stage width, and the cluster begins after it at y=40. The default cluster is 336px high. Each phase center holds one standard node column, with nodes 152 × 80px and 16px row gaps. Multiple nodes stack top-down, below the orchestration bar when one is present. External sources stack in the left zone, four at most. Cross-cutting bars take 40px rows at y=388 + 44k. Total height comes from the last row plus the legend and bottom margin. Vertical chevrons divide y=40 to the last concern row evenly. Every coordinate derives from this schema, so equal input yields equal SVG.

## Encoding rules

Phase chevrons name progress through the stack and carry no quantity. Draw a dashed external-source boundary, a quiet cluster outline, solid internal primary links, dashed optional or trigger links, and a distinct dashed query/read-back link. Route connectors orthogonally with rounded elbows and separated attachment points. A link touching the focal component may take the accent token, and every other link stays muted. Use an icon only where it resolves a recognizable role. Keep phase names short and node subtitles technical. Up to two custom concern colors may identify a real security or governance role, and links keep their own colors.

## Korean behavior

Keep product and organization names as written. Write phase names in plain Korean, and place English abbreviations after the Korean expansion on first use. Narrow chevrons call for short terms or the matching glossary, with body labels kept horizontal. Pretendard carries all Korean UI text, and the mono role is reserved for IDs, protocol names, and ports. Follow the Korean typography reference for two-line subtitles and number spacing.

## Light, dark, and full variants

The light skin uses paper and ink surfaces, a restrained accent, and quiet boundaries. The dark skin flips the semantic roles and keeps geometry, flow, and emphasis identical; accent and custom-color contrast get checked again. Full editorial adds a page eyebrow, title, one-line deck, and optional source/footer outside the SVG, with platform nodes and stage allocation unchanged. The vertical-rail variant is a separate catalog entry; follow [high-level-vertical](type-high-level-vertical.md) when the rail is the defining structure.

## Accessibility

Use an SVG title and description, with the description naming the source zone, cluster, major stages, cross-cutting concerns, and the focal component. Keep phase text horizontal. Explain every connection through direction and a concise label, or through an unambiguous stage order, and distinguish primary, query, and trigger links by more than color. Pair icon-only marks with adjacent text and provide a linearized text summary for the exported figure.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for connector overlap, off-canvas paths, clipping, contrast, light/dark polarity, SVG accessibility, and visible text. Run scripts/verify-type.mjs --type=high-level to validate phase membership, source and node budgets, focal uniqueness, bar/rail pairing, and orthogonal edge endpoints. Inspect a rendered screenshot at the selected output size, then run humanizer checks on titles, tags, subtitles, and edge labels.

## Anti-patterns

- Nodes placed outside the phase whose label they occupy.
- More than four source cards, an overcrowded phase, or a component list with no focal rationale.
- A vertical strip without a matching concern bar, or a cross-cutting bar without its paired concern.
- Diagonal connectors, shared attachment points, or arrows hidden behind later nodes.
- Custom colors on every chevron, component, or connector.
- Dot texture behind the diagram by default, or shadows on nodes.
- The cluster boundary presented as proof of network isolation when no one specified that.

## Related references

[Style guide](style-guide.md) · [Output spec](output-spec.md) · [Semantic patterns](semantic-patterns.md) · [Icons](primitive-icons.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md) · [Vertical rail variant](type-high-level-vertical.md)
