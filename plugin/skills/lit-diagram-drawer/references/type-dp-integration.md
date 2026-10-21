# Data Platform Integration

**Catalog ID:** dp-integration

## Purpose and selection

Pick this type to inventory the systems that connect into a data platform, the platform components they touch, the consumers it serves, and the protocols on those links. It is a topology that carries no timeline. Data flow fits when ownership across sequential stages is central, and the security matrix fits when permissions are central.

## Content schema

Declare external sources, an ordered platform interior, consumers, and optional cross-cutting services such as identity or observability. Each endpoint has a stable name, a kind/icon key, an optional subtitle, and explicit connections. Connections name both ends and carry a protocol or purpose. Platform rows may be a full-width service bar or a row of peer components. Cap ordinary source and consumer groups at six each, and keep the common case near 14–20 named nodes when the integration surface itself is the message. Merge truly identical systems with a count, and split domains that would form a hairball.

## Deterministic layout recipe

Set the viewBox to 1200px wide. Reserve 160px side columns at x=40 and x=1000 for sources and consumers. Source and consumer nodes sit at y=92 plus 88px per row, each 64px high. The platform zone is centered between them at x=260 with width 696, its height matches the side columns, and it has explicit padding. Allocate platform bars and peer rows top-to-bottom from a cursor, and keep the primary component row vertically aligned with the second side-column row. Cross-cutting bars sit below the zone, each 56px high with 8px separation. Canvas height comes from the last footer, plus a reserved legend band.

Paint the platform boundary first, then connectors, then nodes and footer bars. Edges between side columns and platform use right-to-left ports, and bar-to-component triggers leave the bar bottom and enter from the component top. Cross-cutting services connect to the platform boundary. Route with orthogonal 8px elbows, stagger repeated fan-out ports, and label meaningful protocol edges on clear masks. Keep intersections out; add a small bridge when rerouting is impossible.

## Encoding rules

Sources stay visibly outside the platform boundary, and consumers stay on the opposite side. Internal paths are neutral, protocol/federation paths use a distinct dashed style, and orchestration triggers are dashed and unlabeled when the legend explains their meaning. A focal component or focal handoff may use the accent. Identity and observability remain cross-cutting services instead of ordinary platform nodes. Give vendors a shared neutral treatment.

## Korean behavior

Korean serves section names and captions, while service names, protocols, and ports stay exact. Pretendard sets visible names and mono sets protocol labels, identifiers, and codes. Explain technical abbreviations once, and keep API names on one line. When localizing source and consumer labels, retain the English platform product names.

## Light, dark, and full variants

Light uses a dashed source/platform boundary, a quiet platform surface, and restrained neutral edges. Dark rebuilds these boundaries and the protocol palette for contrast. Full adds a title, a takeaway, the scope, and a compact legend beneath the drawing. Every endpoint, path, and count carries over between variants.

## Accessibility

Describe the platform boundary and the main source-to-platform-to-consumer paths. Provide a route table for protocol and endpoint details. Place text beside every icon, identify line styles in a legend, and preserve reading order from sources through the platform to consumers. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for zones, edge overlaps, clipping, contrast, accessibility, and text. Run scripts/verify-type.mjs --type=dp-integration for side-column budgets, endpoint integrity, zone geometry, footer behavior, and connector style rules. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Several known endpoints collapsed into one "sources" or "consumers" node.
- One bus arrow standing in for labeled connections.
- Every tool colored as though vendor identity were the hierarchy.
- Identity placed inside the boundary when it governs all platform components.
- A phase chevron banner in a topology that has no phase question.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Semantic patterns](semantic-patterns.md) · [Icons](primitive-icons.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
