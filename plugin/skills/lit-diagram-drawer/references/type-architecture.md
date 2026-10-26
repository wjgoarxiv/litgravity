# Architecture

**Catalog ID:** architecture

## Purpose and selection

Pick an architecture diagram when the reader needs the main parts of a logical system and how those parts relate. It fits service boundaries, request or data paths, and the handful of external systems that make the design understandable. Scope the drawing to the one question the reader has to answer.

Pick deployment when the claim is placement on hosts, environments, replicas, or network zones. Pick dependency when shared prerequisites or cycles matter. Pick data flow when ownership roles and payload changes dominate. Pick the high-level or data-lake type for a broad stage-by-stage platform overview.

## Content schema

List the groups or trust zones in order, each with an ID and a short visible name. For each node record a stable ID, its group, a name, an optional role or technical sublabel, and an optional focal flag. For each directed edge record the source ID, the destination ID, the relationship meaning, an optional protocol or payload label, and an optional dashed state. All edge endpoints must resolve to declared nodes. Name the direction the reader should follow. An overview carries about 14--24 nodes, every real edge between them, and up to 5 true boundary groups; past that, enlarge the canvas preset or split at a group boundary with cross-reference ids.

## Deterministic layout recipe

Set the viewBox to 1000 × 560 with 32px outer margins. Run the main path left-to-right, switching to top-down only when the supplied content is inherently vertical. Keep the group order the user gave and give each group one column. Inside a column, order nodes by declared sequence and spread their centers evenly between y=156 and y=420. A top-down view swaps the roles of rows and columns. After the formula has placed an element, change its declared rank or order to move it; nudging by eye is off the table.

Paint boundary regions first, connectors second, and node shapes with their text last. Route each off-axis connector as a rounded orthogonal elbow with an 8px bend; a relationship on a shared axis may stay a straight segment. When a crossing cannot be avoided, add one small bridge on the less important path. Give parallel edges the same explicit route slot and space attach points at least 12px apart. Set short labels on an opaque paper mask with a visible gap to the stroke.

## Encoding rules

Give each group or node role its own accent family from the style guide (3--5 families), tint the group bands with the matching wash, and mark the primary path with the first family and numbered step badges. Use a dashed boundary only for a real trust or ownership boundary. Use a dashed edge for a named optional, asynchronous, or return relationship, and explain it in a compact legend. Keep ordinary edges neutral. Protocols and ports take the mono role; names and explanations take Pretendard sans.

## Korean behavior

When Korean is the primary language, set the document language to Korean and use Pretendard for Hangul. Keep Korean words whole at line breaks, and let long mixed-script identifiers break at safe boundaries. Reproduce protocol names, API paths, and product names exactly, and explain an uncommon English abbreviation once in Korean. Format quantities with locale-appropriate grouping. When a node name is long, wrap it or shorten it with the user's approval and keep the type size.

## Light, dark, and full variants

Light is the default paper-and-ink treatment. Dark is its own checked token set: a paper-equivalent text surface, visible boundaries, and text and stroke contrast recalculated from scratch. Full adds a title, a one-sentence takeaway, and a short legend or note outside the drawing. All three variants share one graph, one scale, and the same node positions.

## Accessibility

Give the SVG an accessible name and a concise description of the system scope and principal path. When exact edge detail matters, add a short text alternative or an adjacent table. Pair each edge style with a legend label so the meaning survives without color. Keep reading order aligned with the visual route. Follow [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for geometry, overlaps, clipping, off-canvas content, contrast, theme polarity, accessibility, and visible-text checks. Run scripts/verify-type.mjs --type=architecture for graph budgets, endpoint integrity, boundary limits, and routing semantics. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Equal-weight cards for every service.
- Coloring connectors or boundaries for variety rather than by a role the legend names.
- Deployment detail inside a logical overview that has no placement question.
- Decorative arrows between components with no supplied relationship.
- Node names or edge labels that collide with a connector.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Icons](primitive-icons.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [PPTX and DOCX](office-pptx-docx.md)
