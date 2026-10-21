# Data Lake Overview

**Catalog ID:** datalake

## Purpose and selection

Pick this high-level architecture variant to explain an unclustered data-lake stack, from external sources through ingestion and storage to query and consumers. It suits an end-to-end orientation with the lake at the center of the story and no container-orchestrator boundary. The high-level architecture type fits when a deployment cluster and cross-cutting concern strips are essential. DP integration fits when each integration endpoint and protocol needs an inventory.

## Content schema

Declare ordered phases, normally Sources → Ingest → Data Lake → Query → Consume. List the external inputs, ingestion components, the lake/store, query or transform tools, and downstream consumers. Each component has a stable ID, a phase, a visible name, an optional sublabel, and an optional icon key. Declare directed connections, label the important data transfer, and identify one focal lake/store. Include only the systems needed to explain this path, and record omitted platform services in a caption.

## Deterministic layout recipe

Set the viewBox to 1000 × 488. Five phase zones sit at y=32: Sources x=4 w=160, Ingest x=176 w=160, Data Lake x=380 w=184, Query x=600 w=168, and Consume x=804 w=164. These fixed gutters leave room for orthogonal routes. Phase names go at each zone center near y=44. Component nodes are 56px high, and the common node rows align at y=60, 164, and 268, which leaves an 8px gap inside the 104px pitch. The consumer zone may use all three rows, source and query zones generally use two, and the lake zone holds one focal storage node. When node counts exceed these slots, split the overview in place of compressing it.

Paint zone surfaces first, arrows second, nodes last. Straight segments serve aligned endpoints only; every other route is a rounded right-angle path. Sort routes by source and then destination ID. The central storage node is the single accent target. The lower band below y=312 is reserved for the occasional return or write-back path and the legend. Phase widths stay fixed whatever the vendor emphasis, and the store carries the focal styling.

## Encoding rules

Phase position carries sequence. A boundary separates outside data sources from the platform. Neutral connectors represent movement, and dashed routes mark explicitly asynchronous or scheduled transfers. One accent marks the lake/store. Icons serve recognition, and every component still has a text name. Raw/curated quality states appear only when they are supplied and named.

## Korean behavior

Korean phase names are welcome where useful, with exact product and service names kept. Explain "data lake" once as "데이터 레이크", or use the project's chosen term consistently. Pretendard sets labels and mono sets file formats and protocol identifiers; give Hangul line-height generous enough for two-line node titles. Format counts and units for ko-KR and keep exact storage units in the data and caption.

## Light, dark, and full variants

Light uses a pale source boundary and one quiet phase rail. Dark uses its own set of boundary and connector colors with verified contrast. Full adds one title, a one-sentence reading, and a compact legend or source note. The stack, the lake focal point, the scale, and the system placement are the same in every variant.

## Accessibility

Name the source region, the central lake, and the end consumers in the SVG description. Make reading order follow the phase sequence. Give each icon an adjacent text label, and mark source, storage, and consumer roles with more than icon shape. Provide a short text path for readers who cannot inspect the routes. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for the standard geometry, rendered clipping, contrast, accessibility, skin, and text checks. Run scripts/verify-type.mjs --type=datalake for five-phase order, focal-store uniqueness, endpoint validity, and route semantics. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- A Kubernetes boundary or vertical concern strip the brief never asked for.
- Decorative chevrons with equal emphasis for every phase.
- A generic database symbol standing in for a lake with no named role.
- A source-to-consumer bus where the specific paths are known.
- Bronze/silver/gold semantics with no evidence that they exist in the system.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Semantic patterns](semantic-patterns.md) · [Icons](primitive-icons.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
