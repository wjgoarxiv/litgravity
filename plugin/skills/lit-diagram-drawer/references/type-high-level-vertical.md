# High-Level with vertical concern rail

Catalog ID: high-level-vertical

## Purpose and selection

Choose this entry when the main reading is a left-to-right platform pipeline paired with a compact right-hand rail of cross-cutting concerns. The rail shows orchestration, security, observability, governance, or backup spanning the whole lifecycle. It is a variant of the High-Level stack and shares its component and connector vocabulary.

## Exclusions

Add the rail only when system-wide concerns exist. Without cross-cutting concerns, use [High-Level](type-high-level.md). Concerns that belong to individual services go beside those services, or into an architecture diagram. The rail expresses ordered, system-wide scopes, so arbitrary labels have no place in it.

## Content schema

Reuse the High-Level input schema: ordered horizontal phases, source cards, cluster components, explicit connections, and a unique focal component. Add an ordered rail list of concern IDs and one matching cross-cutting bar per concern. Names such as Orchestration, Security, Observability, Governance, and Backup belong to this rail. Each concern has a declared short name, an optional subtitle, and at most two justified concern-color overrides. An orchestration-stage bar occupies a cluster-wide horizontal strip and has a matching orchestration rail entry.

## Deterministic layout recipe

Fix the SVG at 1000px wide. The 28px rail occupies x=972..1000, x=964..972 stays empty as breathing room, and all pipeline geometry ends at x=964. The 1000 × 600 reference canvas fits three rail items and two concern bars. Horizontal phases sit at y=4..32 and the source / cluster body at y=40..376. Concern bars start at y=388 and advance 44px per row, each 40px tall. The rail spans from y=40 to the bottom edge of the last bar, divided equally among rail entries, with the last segment absorbing any grid remainder. Each segment has a flat leading edge, a point at its end, and a centered notch between neighbors. Rail labels rotate -90 degrees around the segment center, and all other labels stay horizontal. Diagram edges attach to nodes. They reach the rail only when a concern-specific relationship is explicit in the data.

## Encoding rules

The main phase chevrons encode pipeline order. Rail chevrons encode coverage and add no process steps. Each rail entry pairs one-to-one with a named concern bar below the cluster: the bar supplies concrete implementation detail and the rail supplies its scope. Use one modest highlight on a real concern, keep accessible text for each rail item, and draw vertical text only for short English rail tags whose glyphs remain readable. Preserve the semantic link styles from the High-Level guide. A rail color that implies security status needs a legend and a stated meaning.

## Korean behavior

Use concise Hangul labels for concern bars. The rail's narrow vertical tag may carry a short English acronym when it is a registered system term, and the full Korean concern name goes in the paired horizontal bar. Korean phrases stay horizontal. Keep brands and protocol names unchanged, set Korean in Pretendard, and apply the shared spacing and numeral rules.

## Light, dark, and full variants

Light and dark variants share the exact rail division, phase widths, node coordinates, and connections. In dark mode, map all elements through semantic tokens and re-check paper-colored text on rail fills, especially for a custom color. Full editorial adds framing text around the SVG, with the concern and component lists unchanged. At small widths, let the HTML viewport scroll horizontally so labels stay at or above the output-spec minimum.

## Accessibility

Provide an SVG title and description, plus a second horizontal list of rail concerns for assistive technology. The vertical labels supplement that list. Reading order runs pipeline, concern rail, then concern bars. Link each rail segment to its paired bar with a cue beyond color. When a text equivalent exists, keep the rotated labels out of the page reading order so they are announced once.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for clipping, overlap, contrast, dark-skin polarity, title/description, label readability, and viewport overflow. Run scripts/verify-type.mjs --type=high-level-vertical to check rail count, equal segments, rail-to-bar pairing, the reserved clear gap, and pipeline membership identical to the base type. Confirm that no horizontal content enters the x=964..972 gutter. Inspect the screenshot at desktop and narrow viewport widths, then run humanizer checks on all visible text.

## Anti-patterns

- A floating rail with no corresponding horizontal concern bars.
- Concern bars with no rail segment, or two rail segments claiming one bar.
- A rail that doubles as a second set of workflow stages.
- Long Hangul labels in 28px-wide segments.
- Connecting components to rail segments as if they were nodes.
- Shrinking the whole 1000px canvas to phone width in place of a local horizontal scroller.
- Rails added for decorative symmetry.

## Related references

[High-Level](type-high-level.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md) · [Semantic patterns](semantic-patterns.md)
