# Wardley map

**Catalog ID:** `wardley`

## Purpose and selection

Pick a Wardley map to reason about a value chain against component evolution: what the user sees, what is a dependency, and what is drifting toward commoditization. It is a strategy map. Pick Architecture for deployed components and their connections, or a dependency graph when graph topology is the primary story.

## Content schema

Each component needs a stable id, a short name, a value-chain position, an evolution band, and its dependency links. Record which components are moving, their rightward destination or time horizon, and the evidence behind each placement. Use up to nine components, twelve links, and two movement arrows. Every component takes part in the value chain through at least one incoming or outgoing dependency.

## Deterministic layout recipe

1. Fix a two-axis plot. The horizontal axis has four qualitative bands in order: Genesis, Custom-built, Product, Commodity. The vertical axis runs from most visible to the user at the top down to invisible at the bottom. The axes carry qualitative captions only.
2. Place each component inside its evolution band and value-chain level. For repeatability, use an agreed sub-band position (early/middle/late) and a stable vertical order derived from the chain. Record the placement rationale in the source or companion notes.
3. Draw dependency links as thin straight lines without arrowheads; this is the deliberate exception to the shared orthogonal-connector default because the coordinates are map data. Position represents evolution and visibility. Label a dependency when the source data needs a qualifier. Each link keeps its straight form, so it never borrows the look of another semantic type.
4. For a moving component, draw one short right-pointing dashed accent arrow toward the next evolution band. Keep it clear of nearby dependency lines and component labels, and add an on-arrow note when a meaningful time horizon or driver exists.
5. Add a compact legend for component, dependency, and movement. Keep axis captions horizontal, and stack short “visible to user”/“invisible” labels beside the y-axis.

## Visual encoding

Band position encodes qualitative evolution, vertical position encodes value-chain visibility, links encode dependency, and a dashed right-pointing arrow encodes movement toward commodity. Use plain component circles and one accent movement cue. Evolution is a qualitative stage and movement always points right. Keep the visual language consistent in every band.

## Korean text

Set component names in Pretendard, and band names, source notes, and concise timing tags in mono. Use the exact evolution terms agreed by the project, and when localizing them, keep the English band mapping in the legend or metadata. Place visible/invisible captions horizontally in Korean. Keep component names short and leave room for Hangul at full symbol size. Follow [Korean typography](korean-typography.md).

## Light, dark, and full variants

Component positions, dependency topology, and rightward movement hold in every variant. Light/dark skins change only semantic colors; make sure dependency lines remain visible at their intended low emphasis. A full editorial version can add a title, one takeaway about build/buy/movement, and a source note around the same map, with points in place and no claim of quantitative precision.

## Accessibility

Provide a title and description explaining both axes, every component's placement, and any movement arrow. Name the four bands in visible text. Movement carries direction plus a text or legend meaning, with the accent as a supplement. Dependency links stay distinguishable from movement arrows by line style and arrowhead. Keep axis text horizontal and maintain contrast for small components and lines.

## Verifier gates

Run `scripts/verify-diagram.mjs` for off-canvas marks, overlap, clipping, contrast, skin, visible text, and a11y. Run `scripts/verify-type.mjs --type=wardley` for band bounds, component/link caps, linked-component participation, and movement direction/count. Inspect dependency crossings and movement labels in both skins.

## Anti-patterns

- Evolution treated as a continuous numeric maturity score.
- A numbered visibility axis, or one implied to be measured.
- A component with no dependency connection, or a leftward movement arrow.
- Runtime request/response flow drawn as map dependencies.
- Too many movement arrows, or a label that merely restates “toward commodity.”
- Vertical-writing axis captions, or movement labels placed over a dependency crossing.

## Related references

[Architecture](type-architecture.md) · [Dependency graph](type-dependency.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
