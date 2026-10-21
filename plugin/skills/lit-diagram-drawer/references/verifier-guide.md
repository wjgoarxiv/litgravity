# Diagram verification guide

Verification is a set of checks on a rendered artifact and its source. A clean source lint leaves browser rendering unproven, and a screenshot alone cannot prove the font, the text or the semantic relationships.

## Shared checks

Run:

~~~sh
node scripts/verify-diagram.mjs path/to/diagram.html
node scripts/verify-type.mjs --type=<catalog-id> path/to/diagram.html
node scripts/verify-brief.mjs
~~~

The shared verifier reports overlap candidates, label bounds, off-canvas geometry, connector crossings, contrast, theme polarity, SVG naming, unsafe references and humanizer findings on visible text.

`verify-all.mjs` adds a wider net. It rejects process or generator text, a missing visible title, role-specific size and content-fill failures, edge labels that overlap any node box, text boxes that touch connector paths or boundary and group outlines, routes that enter a non-endpoint node within 8px of padding or run alongside a boundary within 4px for 12px, arrowheads hidden by destination boxes, and node gaps under 12px.

Route rules in force:

- Every marked route's arrow tip meets its target box edge within 2px. Sequence messages bind to lifelines instead.
- The projected head length is at least `max(12 × viewBox-width / 1080, 5 × stroke-width)`.
- A route is flagged when its path length passes 1.4 times the Manhattan distance between its endpoints, when it uses more than two bends (three while crossing a boundary), when aligned row or column neighbors lack a straight segment, when distinct edges share a collinear segment with under 12px of clearance, when distinct routed edges cross geometrically (including edges with the same unordered node pair), and when one polyline has arrowheads at both ends.
- Sequence lifelines are excluded from the generic crossing count, because message crossings of lifelines are intentional.

Label and node rules in force:

- A labeled connector carries `data-edge-for="source|destination"` on its text, with matching endpoint and label attributes on its route. The text anchor sits within 24px of that route and nearer to it than to any other route.
- Boundary and group labels use the 13px connector floor and the 4.5:1 text contrast floor. The 1080×640 floors are 28px title, 15px node and 13px connector or boundary text; other canvases scale proportionally.
- A decision node marked `data-node-type="decision"` declares at least two pipe-separated `data-outcomes`, and every value matches an outgoing `data-label`. The brief verifier then confirms that each named outcome exists with the right direction.
- The type verifier checks the numeric or structural rules registered for the selected catalog entry. For sequence diagrams it also requires one dashed `line[data-lifeline-for]` per participant, lifeline endpoints at participant-box centers, every message joined to both named lifelines, and messages ordered top to bottom.
- `verify-brief.mjs` requires each brief's node names and relationship labels as exact SVG text, checks each labeled edge's direction and endpoints, checks trust-boundary membership declarations (complete semicolon-separated internal and external node lists against node-box geometry) and rejects unlisted English words in Korean labels.

## Failure meanings

- **Overlap:** two unrelated node boxes occupy the same region. Containment, intentional Venn overlap and declared pattern-specific intersections pass.
- **Clipped or overflowing label:** measured text extends beyond its assigned node or the safe canvas. Widen, wrap or edit the label.
- **Off-canvas item:** a node, arrowhead, label or essential mark crosses the SVG viewBox or the selected safe inset.
- **Connector crossing:** unrelated paths intersect with no clear bridge, routing gap or explicit crossing convention.
- **Contrast failure:** text or an essential non-text mark falls under the applicable ratio in the selected theme.
- **Polarity failure:** the theme claims light or dark yet keeps colors too close to the opposite skin.
- **Accessibility failure:** the SVG name or description is absent, ids collide, reading order is incoherent, or labels are unavailable as text.
- **Humanizer block:** visible copy contains clear drafting residue. Warnings get a contextual review and are not automatic failures.
- **Process text:** visible SVG text names the generator or product, shows a template, variant, source or notes tag, or describes design rules in place of the diagram subject.
- **Missing visible title:** the SVG has an accessible `<title>` and no reader-facing title text. Show the diagram subject above the composition.
- **Connector-label collision:** a text bounding box intersects a declared connector path. Move the label clear of the full route.
- **Edge-label association:** the label anchor is more than 24px from its named route, lacks exactly one matching route, or is no closer to that route than to another connector. Move it beside its own path and update `data-edge-for` if the relationship changes.
- **Outline-label collision:** a trust-boundary or group outline crosses a text box. Move the text off the outline and keep the named boundary visible.
- **Boundary-label readability:** a boundary or group name is under 13px at the reference canvas or under 4.5:1 contrast. Raise its size or contrast.
- **Route along boundary:** a connector runs within 4px of a boundary edge for 12px or more. Route across the boundary or away from its outline.
- **Hidden or detached arrowhead:** marker geometry overlaps the destination node, or its tip is more than 2px from the target box edge. End the route with the tip touching the edge and the head body outside the node.
- **Language mismatch:** a Korean brief's visible label holds an English word that the brief does not list as a name or term. Translate the label or list the term in the brief.
- **Route through node:** a declared edge enters or runs within 8px of a node other than its named source or destination. Reroute so the destination is unambiguous.
- **Node gap:** two declared node boxes sit less than 12px apart. Widen the separation so labels and arrows do not merge.
- **Route detour or excess bends:** the polyline is longer than 1.4× its endpoint Manhattan distance or has more than two bends (three while crossing a boundary). Move nodes or pick a shorter path before adding turns.
- **Aligned-neighbor detour:** same-row or same-column neighbor nodes have a bent route. Connect them with one straight segment.
- **Shared route segment:** distinct edges overlap collinearly or pass within 12px over a shared span. Reroute one edge so each direction is distinct.
- **Route crossing:** two distinct directed paths intersect away from a shared endpoint. This covers opposite directions between the same two nodes; separate the return and forward paths with a visible gap.
- **Trust-boundary membership:** every boundary-bearing brief lists every node exactly once as internal or external. Internal node boxes lie fully inside the marked trust-boundary rectangle, and external node boxes lie fully outside it.
- **Opposed arrowheads:** one directed polyline has both a start marker and an end marker. One arrowhead per directed edge, unless the brief defines a two-way relationship.
- **Sequence lifeline:** a participant lacks a dashed lifeline, the line misses its box center or the final message, a message misses its named lifeline, or message order is not top to bottom. Bind each message endpoint to its actor lifeline and keep the order.
- **Content fill:** the declared node bounds use under 68% of canvas width or under 40% of canvas height. Recompose the subject to use the slide area.

## Type checks

The shared type verifier carries contracts for the quantitative chart families and the semantic patterns. They cover conservation, scales, labels and named structure wherever explicit SVG data attributes make the property checkable. A missing data contract is reported as unavailable and never as a pass.

## Imported content

Run the matching bundled Node standard-library extractor before drawing. Its JSON is a bounded intermediate representation holding content only. Styles, coordinates, scripts, links and embedded payloads stay behind. Render a new diagram from that content and keep a short fidelity note.

## Fixtures and receipts

Each rule has a passing and a deliberately failing fixture. The shipped naive foils in `examples/*/constructed-naive-foil.html` are the failing side that `verify-all.mjs` exercises. The package ships no separate fixture runner, so judge a new rule against those foils and the approved after-examples. Record the failing rule and the expected exit code, and leave every check at its strength.

The T7 scorer is a comparison aid and no quality oracle. Keep its individual metrics visible, and reject a bare PNG when source metadata is missing.
