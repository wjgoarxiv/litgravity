# Drawing rules for the source file

`SKILL.md` step 6 lists the core. This file holds the complete rule set that `verify-diagram.mjs`, `verify-type.mjs` and `verify-brief.mjs` enforce, so a draft can be built to pass on the first run. Numbers are for the 1080 x 640 reference canvas; other canvases scale the size floors by `min(viewBox.width / 1080, viewBox.height / 640)`.

## Document skeleton

- One self-contained HTML file. Inline CSS, one primary inline SVG, local font URLs. A script element appears only for a requested motion example.
- SVG root: a unique `id` that starts with `diagram-<type>-<variant>` (or a `data-type` and `data-variant` pair), a `viewBox`, `role="img"`, `aria-labelledby` naming the title and description ids, a first-child `<title>` and a `<desc>` that says what the picture shows.
- A visible title in the drawing itself, at the title floor. The accessible `<title>` is a separate element and never counts as the reader-facing title.
- Ids for titles, descriptions, markers, clips and filters begin with the diagram slug and variant, so two diagrams in one page never collide.
- Reading order in the DOM: title, groups, connectors, nodes, labels, legend. Connectors come before the nodes they join, so node boxes sit on top of line ends.
- A complete static state. Motion, when present, is an addition that a reduced-motion viewer never needs.

## Nodes

- `data-node-id` on every node, stable across edits so edges and briefs can refer to it.
- Node gap: 12 px or more between any two declared node boxes (`NODE_GAP`).
- Node text fits its box with its own padding (`LABEL_OVERFLOW`, OF-204). Widen the box or shorten the words; the size floor stays.
- Floors: title 28 px, node label 15 px, connector and boundary label 13 px, technical token 13 px (`FONT_FLOOR`).
- Content fill: meaningful node bounds cover at least 68% of the canvas width and 40% of the height (`CONTENT_FILL`).
- Decision nodes declare `data-node-type="decision"`.

## Routes and edge labels

- Every route declares `data-from`, `data-to` and `data-label`. The label text uses `data-role="edge"` and `data-edge-for="from|to"` with the same endpoint pair.
- The label anchor sits within 24 px of its own route and nearer to it than to any other route (`EDGE_LABEL_TOO_FAR`, `EDGE_LABEL_NEAREST_PATH`, `EDGE_LABEL_UNBOUND`). The label box stays clear of every node (`EDGE_LABEL_NODE_COLLISION`), every route (`EDGE_TEXT_COLLISION`) and every boundary outline (`OUTLINE_TEXT_COLLISION`).
- Bends: at most two, or three when the route crosses a declared boundary (`ROUTE_BENDS`).
- Length: at most 1.4 times the Manhattan distance between the endpoints (`ROUTE_DETOUR`).
- Same-row or same-column neighbors take one straight segment (`ROUTE_ALIGNED_PATH`).
- A route keeps 8 px of padding around every node that is neither its source nor its destination (`ROUTE_THROUGH_NODE`).
- A route avoids running within 4 px of a boundary outline for 12 px or more (`ROUTE_ALONG_BOUNDARY`).
- Two routes share no collinear stretch closer than 12 px (`ROUTE_COLLINEAR_OVERLAP`) and cross nowhere away from a shared endpoint (`ROUTE_CROSSING`). A forward and a return path between the same two nodes also need a visible gap.
- One arrowhead per directed route (`ROUTE_OPPOSED_HEADS`). A two-way relationship needs a brief that says so.

## Arrowheads

- The tip meets the target box edge within 2 px (`ARROWHEAD_TIP_MISSED_TARGET`).
- Head length is at least `max(12 x viewBox.width / 1080, 5 x stroke-width)` (`ARROWHEAD_SIZE_FLOOR`).
- The head body stays outside the destination box (`ARROWHEAD_TARGET_OVERLAP`). An explicit marker with real geometry provides the head (`ARROWHEAD_GEOMETRY_MISSING`).
- Sequence messages bind to lifelines in place of target boxes.

## Decisions

A decision node lists every outcome in `data-outcomes`, pipe-separated, with at least two values. Each value matches the `data-label` of exactly one outgoing route. The brief verifier then checks that each named outcome exists with the right direction (`DECISION_OUTCOMES_MISSING`, `DECISION_OUTCOME_MISSING`, `DECISION_OUTCOME_UNDECLARED`).

## Sequences

- A participant box per actor and a dashed `line[data-lifeline-for]` per participant.
- Lifeline endpoints sit at the participant-box centers and extend below the last message (`SEQUENCE_LIFELINE_ALIGNMENT`, `SEQUENCE_LIFELINE_SHORT`, `SEQUENCE_LIFELINE_MISSING`).
- Each message starts and ends on its two named lifelines (`SEQUENCE_MESSAGE_OFF_LIFELINE`) and the messages run top to bottom in time order (`SEQUENCE_MESSAGE_ORDER`).
- Lifelines are exempt from the generic crossing count, since a message crossing a lifeline is the point.

## Trust boundaries and groups

- The brief lists both memberships, semicolon-separated:

  ```text
  Trust boundary internal nodes: private service; job worker
  Trust boundary external nodes: public edge; user
  ```

- Exactly one boundary rectangle. Every declared node appears once, no undeclared node appears, internal boxes lie wholly inside the rectangle and external boxes wholly outside (`BOUNDARY_COUNT`, `BOUNDARY_MEMBERSHIP_*`, `BOUNDARY_NODE_*`).
- The boundary and each group carry a name in visible text at 13 px or more with 4.5:1 contrast (`BOUNDARY_FONT_FLOOR`, `BOUNDARY_CONTRAST_FLOOR`).
- When a diagram and its list disagree, the list is the authority until the user changes it. Editing the list to make geometry pass is an invalid repair.

## Color, accent and casing (the OF checks)

- OF-201 `CLUSTER_GAP_RATIO`: the gap between node clusters is a required multiple of the gap inside a cluster. A diagram where groups blur into one mass blocks.
- OF-202 `ACCENT_COUNT`: accent families. Three to five, each tied to a role, pass; six or more block. A minimal diagram stays with one or two focal accents.
- OF-203 `LABEL_CASE`: Latin labels in Title Case with small connecting words advise. Prefer sentence case for Latin text.
- OF-204 `LABEL_OVERFLOW`: a measured label wider than its box blocks. Edge labels stay outside this check, so inspect them in the rendered image.

## Text hygiene

- Visible text names the subject. The product, the generator, a template, a variant, a source tag and design-rule notes stay out of it (`PROCESS_TEXT`).
- Script text, event-handler attributes and URLs have no place in visible text (`UNSAFE_VISIBLE_TEXT`).
- Korean briefs list every Latin term they allow. Other English words in Korean labels trip the language check.
- Labels keep the claim the brief makes: units, signs, dates, ranges and uncertainty carry over unchanged.

## Pretendard

The HTML references `assets/fonts/PretendardVariable.woff2` through a local `@font-face`. Export confirms the face is loaded and computed (`PRETENDARD_FONT_NOT_LOADED_FROM_LOCAL_ASSET`, `PRETENDARD_NOT_LOADED_OR_COMPUTED`). Keep `OFL.txt` and `provenance.json` with any copy of the font.

## Starting from a template

Copy `assets/examples/type-<id>-<variant>.html` into the output folder, change the facts, then adjust geometry until `verify-type.mjs` passes. The shipped template files stay unmodified, and the type guide for the chosen id remains the layout authority.
