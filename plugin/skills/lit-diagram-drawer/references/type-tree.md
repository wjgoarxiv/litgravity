# Tree / hierarchy

**Catalog ID:** `tree`

## Purpose and selection

Pick a tree for a strict parent-to-children hierarchy such as a taxonomy, file structure, decision breakdown, or bounded system decomposition. Each nonroot node has one parent and the hierarchy holds no cycles. Pick a dependency graph when nodes can have several parents, cross-links, or cycles, and Nested for containment where branch relationships need no tracing.

For stable block identifiers and per-block inputs, outputs, constraints, and implementation traceability, load [Traceable block decomposition](type-tree-block-decomposition.md) and [Semantic patterns](semantic-patterns.md#8-traceable-block-decomposition).

## Content schema

Each node carries a stable id, a parent id (empty only for the root), a short name, an optional one-line qualifier, and an optional focal flag. The parent relation implies each edge, so edges carry no labels of their own. Record the intended reading direction, depth, and children per level before placing nodes.

## Deterministic layout recipe

1. Put the root at the top and its children on the next row, with equal row pitch at every depth. A left-to-right orientation suits a very wide or heavily labeled tree; whichever orientation is chosen applies to the whole figure.
2. Center each parent above the span of its descendants. Order siblings by the domain's actual sequence, and fall back to a stable declared order so reruns are reproducible.
3. Route orthogonal connectors as a short parent stem, a horizontal sibling bus, and a short drop to each child. Connectors sit behind nodes and attach at the center of node edges.
4. Use two node widths at most, based on measured label lengths. Align boxes to the layout grid. Leaves may take a lighter border or fill when that cue is redundant with other signals.
5. Carry up to about 24 nodes, five levels including the root, and eight children at a level. Beyond that, split at a meaningful subsystem boundary and provide cross-reference ids between figures.

## Visual encoding

Connector topology carries the hierarchy; box position and text carry identity. Give each top-level subtree one accent family from the style guide (3--5 families) so a branch reads as one unit, and mark a critical leaf with a labelled badge. Do not color by depth alone. Use the same visual weight for siblings and the same depth spacing throughout. Place connectors before cards so their paths terminate cleanly at the box edge.

## Korean text

Set node names and qualifiers in Pretendard as compact noun phrases that preserve parent-child meaning. IDs, file paths, and version strings go in mono. Wrap labels at natural phrase boundaries and size nodes from the longest Korean label in that row. Keep every intermediate hierarchy term, even when space is tight. Follow [Korean typography](korean-typography.md).

## Light, dark, and full variants

Node coordinates, sibling order, and connectors stay identical across the three skins. Switch semantic stroke and fill tokens between light and dark. In the full editorial variant, add a short title, scope note, or takeaway outside the hierarchy, leaving the tree free of extra card grids or implied nodes. Confirm orthogonal connectors remain distinguishable on dark paper.

## Accessibility

Use a title and description stating the root, the hierarchy direction, and the scope. The logical reading order visits each parent before its children and follows the declared sibling order. Branch structure survives without color. Connector-to-box joins are visible, labels meet contrast requirements, and no overflow hides behind a crop.

## Verifier gates

Run `scripts/verify-diagram.mjs` for node bounds, overlap, clipping, contrast, skin, visible-text, and a11y checks. Run `scripts/verify-type.mjs --type=tree` for one root, valid parent links, acyclicity, depth/branch/node budgets, and orthogonal connector joins. Inspect the densest level in the rendered full-width export.

## Anti-patterns

- A node with two parents, a cycle, or an unlabeled skipped level.
- Diagonal connectors, or connectors that stop short of a child.
- More than five levels, inconsistent box widths, or one exceptionally broad row.
- Root and leaf highlighted with competing accents.
- Cross-tree dependencies drawn as parent-child links.
- A large tree cropped until its root or branch context disappears.

## Related references

[Traceable block decomposition](type-tree-block-decomposition.md) · [Dependency graph](type-dependency.md) · [Semantic patterns](semantic-patterns.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
