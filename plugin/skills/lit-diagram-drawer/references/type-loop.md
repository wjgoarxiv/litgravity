# Loop

Catalog ID: loop

## Purpose and selection

Pick a loop when the stages form a real recurring cycle and the last step returns to the first. A central hub stands for the shared state the cycle accumulates: policy, memory, evidence, or a common record. Solid clockwise ring arrows show the operating flow, and optional inward dashed spokes show each station writing back to the hub.

## Exclusions

Choose a flowchart when the process can end or branch without returning, a lifecycle state diagram when a subject moves between states, and a process diagram when the sequence runs one way. A terminal step belongs outside the cycle, and a hub earns its place only when it carries shared state, so it never fills the center for its own sake.

## Content schema

Provide 5–8 ordered stations in clockwise order. Each station has a name, an optional sublabel, an optional short write-back label, and at most one focal flag. Provide exactly one hub with a name and one concise explanation. State that the last station truly returns to the first. Each spoke must identify what shared state its station writes. Add an optional title and subtitle.

## Deterministic layout recipe

Use a centered 1040 × 680 viewBox with hub center C=(520,340), ring radius R=240, station boxes of 160 × 64, and a 200 × 104 hub. For N stations, place station k at angle -90° + k·360°/N, so station 0 sits at the top and the rest proceed clockwise. Compute the ring/box intersections and join adjacent stations with same-radius clockwise circle arcs; the final arc closes onto station 0. Derive the inward radial spoke endpoints from the station and hub rectangle boundaries, and leave a 6px gap before the hub. The outer margin covers the station boxes, strokes, and marker tips, plus at least 64px of clear space. Snap boxes to the 4px grid while keeping the layout symmetric, and hold circle intersections to a consistent precision.

## Encoding rules

Stations use paper fill with an ink border. Only the hub may take a solid ink fill with paper text. At most one focal station takes an accent tint and outline. Ring flow is solid, muted, and clockwise; write-back spokes are dashed and visually lighter. Keep spokes radial so they stay distinct from the ring arcs. Optional spoke labels sit beside the path with a paper mask and a 6–10px visible gap. The circular arcs and radial spokes are documented type-specific exceptions to the usual orthogonal connector rule, and the ring uses a single connector grammar throughout.

## Korean behavior

Use short Korean station names and sublabels that preserve the domain meaning and clockwise order. Write the hub subtitle as a plain phrase with every acronym explained. Use Pretendard for all Hangul, and limit mono to short IDs and technical labels. Keep station text horizontal; when it cannot fit, shorten it with user approval or divide the cycle into an overview and a detail view.

## Light, dark, and full variants

Positions and semantics are identical across skins. The hub stays the highest-contrast shared-state element in both, and write-back spokes stay dashed and secondary. The full editorial variant adds a framing title, a purpose sentence, and an optional source note outside the SVG, with a single hub and the same stations. Static is the default; motion needs an explicit request and follows the motion guide's reduced-motion rules.

## Accessibility

Describe the station order, cycle closure, hub meaning, focal station, and write-back direction in SVG text. Provide a linear ordered list as an alternative to the circle. Mark the return edge by arrow direction and the write-backs by dash, so color is never the only cue. Keep labels clear of the hub and the spokes.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for circle bounds, arrow intersections, spoke overlap, clipped labels, contrast, dark-skin polarity, SVG semantics, and visible text. Run scripts/verify-type.mjs --type=loop to check 5–8 stations, one hub, equal angular intervals, closure, marker landing, radial spoke clearance, focal count, and viewBox margin. Inspect the screenshot at the final output size and run humanizer checks on every visible label.

## Anti-patterns

- A cycle with no true return edge.
- Two hubs, or a hub with no named meaning.
- Uneven station angles without a semantic reason.
- Straight spokes with solid styling, or ring paths that cross the hub.
- Orthogonal sections mixed into the circular ring.
- More than eight stations, or long paragraphs inside station cards.
- Multiple focal stations competing for the first read.
- Movement or animation covering for a confusing static layout.

## Related references

[Style guide](style-guide.md) · [Output spec](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md) · [Motion guide](motion.md) · [Terminal frame variant](type-loop-terminal.md) · [Semantic patterns](semantic-patterns.md)
