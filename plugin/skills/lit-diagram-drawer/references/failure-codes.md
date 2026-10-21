# Failure codes and repairs

The scripts print a code per finding. Find the code here, apply the repair, and rerun the script that reported it. A repair that weakens a threshold is invalid; redraw instead. `verifier-guide.md` explains what each check measures.

## Accessible name and structure

| Code | Cause | Repair |
|---|---|---|
| `A11Y_TITLE_DESC_ROLE_LINK`, `TITLE_ROLE_MISSING` | The graphic lacks an accessible name, description, role or link between them | Add a real `<title>` and a concise `<desc>`, set `role="img"`, and point `aria-labelledby` at both ids |
| `VIEWBOX_INVALID`, `VIEWBOX_REQUIRED`, `SVG_MISSING`, `SVG_OR_VIEWBOX` | No usable SVG or viewBox | Put one inline SVG with a positive viewBox in the file |
| `TEXT_MISSING`, `NO_TEXT` | The drawing holds no live text | Write labels as `<text>`; outlined or raster labels do not count |
| `CONTENT_NODES_MISSING` | No declared nodes were found | Add `data-node-id` to node groups |
| `TYPE_ID_MISMATCH`, `VARIANT_MISSING`, `TYPE_UNKNOWN`, `UNKNOWN_TYPE`, `TYPE_GUIDE_MISSING` | The file, `data-type`, `data-variant` or catalogue id disagree, or the id is not in the catalogue | Use an id from `type-catalog.json` and make file name, `data-type` and `data-variant` agree |

## Geometry and legibility

| Code | Cause | Repair |
|---|---|---|
| `OFF_CANVAS` | A node, label, arrowhead or mark leaves the viewBox or safe inset | Change the canvas or recompose; hiding it with another export mode leaves the loss in place |
| `TEXT_OVERLAP`, `OBJECT_OVERLAP`, `SHAPE_OVERLAP` | Unrelated boxes or text occupy the same region | Move, widen or split; containment and declared Venn overlap pass |
| `CONTRAST` | Text or an essential mark is under its ratio in the selected theme | Raise contrast against the real fill (4.5:1 text, 3:1 large text and marks) |
| `FONT_FLOOR` | A role is under its size floor | Shorten copy, widen the node or split the diagram |
| `LABEL_OVERFLOW` (OF-204) | A measured label is wider than its box | Widen the box or rewrite the label |
| `CLUSTER_GAP_RATIO` (OF-201) | Groups sit too close compared with the space inside them | Separate clusters or merge them |
| `ACCENT_COUNT` (OF-202) | Too many accent families | Fall back to one or two accents on the neutral ramp |
| `LABEL_CASE` (OF-203, advisory) | Latin label in Title Case | Use sentence case |
| `CONTENT_FILL` | Node bounds use under 68% of the width or 40% of the height | Recompose to use the canvas |
| `NODE_GAP` | Two node boxes are under 12 px apart | Separate them |
| `PROCESS_TEXT`, `UNSAFE_VISIBLE_TEXT`, `UNSAFE_TEXT` | Visible text names the generator, a template or variant, design rules, a script or a URL | Replace it with subject text |
| `HUMANIZER_BLOCK`, `HUMANIZER_ERROR` | Drafting residue in visible copy, or the `lit-humanizer` detector is missing | Rephrase while keeping valid citations and factual labels; report a missing detector as a blocker |

## Routes, labels, arrowheads

| Code | Cause | Repair |
|---|---|---|
| `EDGE_LABEL_UNBOUND`, `EDGE_LABEL_TOO_FAR`, `EDGE_LABEL_NEAREST_PATH` | The label has no matching route, sits over 24 px away, or is nearer another route | Move it beside its own path and keep `data-edge-for` consistent |
| `EDGE_LABEL_NODE_COLLISION`, `EDGE_TEXT_COLLISION`, `OUTLINE_TEXT_COLLISION` | A label box meets a node, a route or an outline | Move the label clear of the full route and outline |
| `ROUTE_DETOUR`, `ROUTE_BENDS`, `ROUTE_ALIGNED_PATH` | Longer than 1.4 times Manhattan, too many bends, or a bent route between aligned neighbors | Move nodes or choose a shorter path; use one straight segment between aligned neighbors |
| `ROUTE_THROUGH_NODE`, `ROUTE_ALONG_BOUNDARY`, `ROUTE_COLLINEAR_OVERLAP`, `ROUTE_CROSSING`, `ROUTE_OPPOSED_HEADS` | A route enters an unrelated node, hugs an outline, overlaps another route, crosses one, or carries two heads | Redraw the path; separate forward and return paths with a visible gap |
| `ARROWHEAD_GEOMETRY_MISSING`, `ARROWHEAD_SIZE_FLOOR`, `ARROWHEAD_TIP_MISSED_TARGET`, `ARROWHEAD_TARGET_OVERLAP` | The head is missing, too small, detached from the target edge or hidden inside the target | Use an explicit marker of adequate size whose tip touches the edge and whose body stays outside |
| `DECISION_OUTCOMES_MISSING`, `DECISION_OUTCOME_MISSING`, `DECISION_OUTCOME_UNDECLARED` | The declared outcome set and the labeled routes disagree | Resolve from the brief and make both sides list the same outcomes |
| `BOUNDARY_COUNT`, `BOUNDARY_MEMBERSHIP_*`, `BOUNDARY_NODE_*`, `BOUNDARY_*_LIST_EMPTY`, `BOUNDARY_GEOMETRY_INVALID` | The brief's lists and the boundary rectangle disagree | Fix the drawing or ask the user; the lists stay as the brief declares them |
| `BOUNDARY_FONT_FLOOR`, `BOUNDARY_CONTRAST_FLOOR` | A boundary label is small or faint | Raise its size (13 px or more) or contrast (4.5:1) |
| `SEQUENCE_LIFELINE_MISSING`, `SEQUENCE_LIFELINE_ALIGNMENT`, `SEQUENCE_LIFELINE_SHORT`, `SEQUENCE_MESSAGE_OFF_LIFELINE`, `SEQUENCE_MESSAGE_ORDER` | Lifelines or messages break the sequence contract | Bind each message to its two lifelines, center lifelines on participants, extend them past the last message, order messages top to bottom |

## Type-specific contracts

| Code | Cause | Repair |
|---|---|---|
| `BEESWARM_MARKS`, `BUBBLE_MARKS`, `HEATMAP_GRID`, `TREEMAP_TILES`, `WATERFALL_STEPS` and their `*_TOO_FEW` variants | The mark count is below the type's minimum or the structure is incomplete | Add the missing marks or choose another type |
| `SANKEY_WIDTH`, `SANKEY_RIBBON_WIDTH_MISSING`, `QUANTITATIVE_LABELS`, `QUANTITATIVE_LABELS_MISSING`, `POLAR_OR_RADAR_SHAPE`, `POLAR_SHAPE_MISSING`, `RADAR_SHAPE_MISSING` | Widths, value labels or shapes do not encode the data | Derive widths and shapes from one scale and label values with units |
| `PAVED_ROAD_SEMANTIC`, `POLICY_SEMANTIC`, `QUEUE_SEMANTIC` and their `*_MISSING` variants | A semantic pattern lacks its named parts | Add the parts listed in `semantic-patterns.md` and the type guide |
| `BLOCK_ID`, `BLOCK_NAME_MISSING`, `BLOCK_FIELD_MISSING`, `BLOCK_BADGE_MISSING`, `BLOCK_REGISTRY_INVALID`, `REGISTRY_*` | A `tree-block-decomposition` block or its registry sidecar is incomplete | Give every block a unique id, name and required fields; keep one root and no cycles |
| `SVG_ANIMATION_NOT_STATIC`, `NON_STATIC_MOTION`, `UNBOUNDED_MOTION`, `REDUCED_MOTION_RULE_MISSING`, `MOTION_CONTROLLER_REDUCED_MOTION_MISSING` | Motion lacks a static state, a bound or a reduced-motion rule | Follow `motion.md` |

## Export and runtime

| Code | Cause | Repair |
|---|---|---|
| `INPUT_MISSING`, `EXPORT_SOURCE_REJECTED` | The source is missing or is the gallery page | Pass a real diagram source |
| `FONT_MISSING`, `FONT_PROOF_INVALID`, `PRETENDARD_FONT_NOT_LOADED_FROM_LOCAL_ASSET`, `PRETENDARD_NOT_LOADED_OR_COMPUTED` | The bundled font is absent or never loaded | Reference the local font in `@font-face`; a fallback render counts as unverified |
| `SVG_DIMENSIONS_MISMATCH`, `SVG_OUTSIDE_VIEWPORT`, `PNG_WRITE_FAILED`, `EXPORT_FAILED` | Capture measured the wrong size or wrote nothing | Fix the viewBox or layout and export again |
| `OFFICE_SVG_ROOT_MISSING`, `OFFICE_UNSAFE_ACTIVE_OR_EXTERNAL_CONTENT`, `OFFICE_UNSUPPORTED_CSS_URL_OR_VARIABLE` | Active, external or unsupported content in an Office-safe export | Remove scripts, handlers, external references, CSS variables and non-fragment `url()` |
| `RENDERER_REQUIRED`, `CHROME_REQUIRED` | The renderer or browser is not ready | Report `BLOCKED:` with `npx @litfamily/litgravity runtime install diagram`; claim no PNG |
| `DIAGRAM_RUNTIME_INSTALL_FAILED`, `DIAGRAM_RUNTIME_CHROME_FAILED`, `DIAGRAM_RUNTIME_LOCKED` | First-use install failed, or another installer holds the lock | Quote the error line, report `BLOCKED:` once and wait for the user to pre-warm |
| `FOIL_NOT_FLAGGED`, `FOIL_COUNT`, `TEMPLATE_COUNT` | The corpus gate found a missing foil or template | Restore the shipped files and rerun `verify-all.mjs` |
