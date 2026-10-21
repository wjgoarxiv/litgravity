# LitFamily diagram style

This guide defines a quiet editorial skin for diagrams that explain structure before they decorate. It is the shared default. The accent changes only when the user supplies a brand palette.

## Composition

- Begin with the reader's question. Group related elements and settle the reading order before drawing connectors or picking colors.
- Delete repeated, implied, decorative and low-value content. Merge nodes that always move together. A connector is unnecessary when position already shows the relationship.
- Aim for density near 4 on a 10-point scale. A standard overview holds roughly 9 nodes and 12 connectors. When more detail is load-bearing, zone the layout or split it into an overview and detail views.
- Empty space builds the groups. Card grids, generic rounded boxes, shadows, glow, gradient wash, ornamental dots, fake precision and floating legends stay out.
- One or two focal accent targets; every other node uses the neutral ramp. Color never carries state or category on its own.

## Color roles

| Role | Light | Dark | Use |
|---|---|---|---|
| paper | #F7F7F3 | #172327 | Canvas |
| paper-raised | #ECEEE8 | #223136 | Secondary surface |
| ink | #202C2F | #F1F3EE | Main text and strong strokes |
| muted | #536268 | #BAC4C1 | Secondary labels and connectors |
| quiet | #748084 | #8A9998 | Tertiary labels |
| rule | #CCD2CE | #3B4A4D | Dividers and boundaries |
| accent | #B85C42 | #E39373 | One or two focal marks |
| accent-wash | #F4E7E0 | #3B2B28 | Focal fill |

A different accent comes only from a user-provided brand source, and every pair is rechecked after the swap. Variety of hue adds nothing; the ramp above stays in charge.

## Shape, stroke and spacing

- A 4px base grid governs coordinates, gaps and padding. Common steps: 4, 8, 12, 16, 24, 32, 48 and 64.
- Corners stay modest, typically 2 to 6px. Square geometry suits a table, lane, boundary or technical object.
- Strokes run 1 to 1.5px at the reference canvas size. Extra weight or contrast goes to meaningful boundaries.
- Connectors sit behind nodes. Horizontal or vertical routes with clean elbows are preferred. The arrowhead body stays outside its destination box, with the tip on the box edge within 2px. At the 1080px reference width the projected head length is at least 12px and at least five times the connector stroke width; scale the canvas term as `12 × viewBox-width / 1080`. Routes keep clear of boundary edges.
- Each connector label binds to its declared source and destination. At the 1080×640 reference, the SVG text anchor sits within 24px of that route and nearer to it than to any other connector. The text box keeps clear space from every route.
- Each trust boundary or group is named in visible text. The label is at least 13px with 4.5:1 contrast, and outline strokes stay clear of labels. A route never runs alongside an outline within 4px for 12px or more.
- Whenever a distinction matters, line style, shape, position or text accompanies the color.
- Nodes cast no shadows. Depth comes from nesting, order or a labeled boundary.

## Typography roles

| Role | Treatment |
|---|---|
| Diagram title | Pretendard 600–700, at least 28px at 1080×640 |
| Node name | Pretendard 500–650, at least 15px at 1080×640 |
| Connector label | Pretendard 500–600, at least 13px at 1080×640 |
| Supporting text | Pretendard 400–500, usually 13–16px |
| Technical token | A system monospace stack, at least 13px at 1080×640 |
| Korean label | Pretendard with line-height 1.45–1.55 |

The bundled Pretendard variable font serves the sans roles and Hangul. Commands, identifiers, field types and ports get a separate monospace role. A serif role has no demonstrated need in a diagram.

Label-fit problems are solved by shortening copy with its meaning intact, widening the node or splitting the diagram; Korean text stays at 12px or above.

For other canvas presets, scale the title, node, connector and technical-token floors by `min(viewBox.width/1080, viewBox.height/640)`. On a standard slide, the bounding box of meaningful nodes covers at least 68% of the canvas width and 40% of its height. At normal presentation zoom the title scans quickly and the smallest semantic labels read comfortably; content that cannot fit is grouped or split.

Visible text belongs to the subject. The product or generator name, source or notes metadata, variant labels and instructions about the diagram's design (accessibility, static-first, accent rules) stay out of it.

## Theme behavior

- Light and dark are two complete themes. Every label, line, focus cue and boundary keeps its contrast in each.
- Full-editorial wraps a title, brief, legend or takeaway around the same diagram, with no added cards, shadows or second competing accent.
- Semantics and reading order are identical across variants.
- Print and export show the whole final state with no dependence on a dark-mode preference, animation or remote font.

## Unbranded identity

Plain geometric marks stand in where a logo would help. An organization's logo is never invented or approximated. A real brand mark needs a clear user need, a lawful source, source-specific attribution and the trademark note in `NOTICE`.
