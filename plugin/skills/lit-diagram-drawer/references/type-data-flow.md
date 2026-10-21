# Data Flow

**Catalog ID:** data-flow

## Purpose and selection

Pick this type for a typed data pipeline in which the reader must see which role acts at each step and how the payload changes. It fits ingestion, storage, transformation, analysis, and publication flows with ownership lanes. A business swimlane serves approvals or service operations where actors and task handoffs outweigh data types. DP integration serves a topology of platform endpoints with no stage sequence.

## Content schema

Declare 1–4 ordered roles, each with a two-line display name and a unique short key. Declare 1–6 ordered pipeline steps, each with a number and a short label. Create nodes only for real role-step participation; an absent participation stays empty. A node may carry a title, a one-line action, a tool or system, optional input/output payload codes, and a focal flag. Declare edges explicitly by node IDs, with a direction and one of four meanings: ordinary handoff, governance trigger, focal cross-role handoff, or published output. The schema has three focal slots: one step, one receiving node, and one incoming cross-role edge. Populate exactly one of each, and when the brief offers no meaningful focus, select a different type in place of an invented one. Limit custom concern colors to a few clearly named meanings.

## Deterministic layout recipe

The viewBox width is 140px for the role rail plus 112px per step plus 28px right padding. The header is 36px, each lane is 80px, and the legend is 80px, rising to 100px when a concern-color row is required. The viewBox height is therefore 36 + 80 × lane count + legend height. Step center j sits at x=140 + 112j + 56, and lane top k sits at y=36 + 80k. A node is 100 × 64 and is placed at x=center−50, y=lane top+8. Empty cells hold no shape, text, or placeholder. Center the lane's two-line name in its left rail and mark lane boundaries with quiet rules.

A node can hold a compact role tag, a title, a short action, and a tool label. The input payload chip goes bottom-left and the output chip bottom-right; omit a chip only when the node has no input or output. A small horizontal legend explains chip meanings. The focal step gets an accent header, the receiving node gets the focal outline, and the incoming focal edge is the one labeled accent route.

Draw edges before nodes. Same-lane edges run from the right side to the next node's left side. Cross-lane edges use an orthogonal single bend with an 8px corner and a top or bottom port for a vertical arrival. Stagger shared ports by at least 12px. Label only the focal handoff, with its text on a paper mask and a clear gap around the route. The legend sits in a horizontal strip below the lanes.

## Encoding rules

Step position communicates sequence, lane position communicates ownership, node text names the work, and payload chips show input and output shape. Standard data handoffs and governance triggers get distinct neutral line styles. The one focal transfer takes the accent and a short payload label. Input and output codes describe payload format independently of any node tint. Semantic concern colors, when used, are named in the legend, and connector colors follow edge meaning in place of node color. Non-focal edge labels stay blank, which protects the grid from text collisions.

## Korean behavior

Use Korean role and action names when the operating audience reads Korean. Keep system names and payload codes exact, and add Korean explanations for unfamiliar abbreviations. Pretendard sets node copy, and mono sets step numbers, payload codes, protocols, and role IDs. Keep two-line lane labels consistent, and let Hangul node titles wrap at full text size. Give each chip an explicit spoken alternative, for example "입력: 테이블".

## Light, dark, and full variants

Light uses alternating low-contrast lane fills only where they help tracking, plus restrained dividers. Dark reverses the dividers, lane tint, and chip surfaces around the same row and column geometry and flow styling. Full may add a short title, a takeaway, and a horizontal legend. Summary cards that duplicate every node add nothing, so leave them out.

## Accessibility

The description states the role order, the pipeline stages, the focal handoff, and the meaning of payload-chip positions. Keep the SVG title and description, with reading order that follows lanes and then steps. Pair line pattern and label with color. Offer a text sequence or table when every transfer must be read exactly. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for route overlap, clipping, contrast, accessibility, and text checks. Run scripts/verify-type.mjs --type=data-flow for schema bounds, empty-cell behavior, exactly one focal entry in each required slot, edge endpoints, routing, and payload-chip placement. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Empty cells drawn as faded placeholder boxes.
- A label on every edge in place of one label for the central handoff.
- Diagonal arrows, or competing color systems for role, flow, and concern.
- Tools shown without the role that performs the work.
- Payload codes swapped for localized labels that lose their technical identity.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Semantic patterns](semantic-patterns.md) · [Icons](primitive-icons.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
