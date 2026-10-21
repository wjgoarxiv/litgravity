# Traceable block decomposition

**Catalog ID:** `tree-block-decomposition`  
**Parent grammar:** [Tree / hierarchy](type-tree.md)

## Purpose and selection

Apply this semantic pattern when a system must be decomposed into individually addressable blocks that readers can cite and trace to implementation. Every block is a noun-like structural element. The hierarchy shows parentage, and metadata carries the fuller block record. Pick a process type for actions, a dependency graph for cross-block relationships, and Architecture for a small set of runtime zones.

This is a SysML-informed documentation pattern. It makes no claim of SysML, IDEF0, XMI, or tool-certified conformance.

## Content schema

Every node needs a stable hierarchical id (for example, `PAY-001-02`), a noun-phrase name, and an implementation path. Every nonroot node also has a parent id. The complete record holds inputs, outputs, constraints, assumptions, and the implementation reference. A short input/output pair may serve as the node sublabel when both fit comfortably. Longer values live in a sidecar block registry beside the editable source, since the visual tree shows only part of the full record.

The SVG node's metadata binds `data-block-id`, `data-block-parent`, and `data-block-name`, plus concise `data-block-input`, `data-block-output`, `data-block-constraint`, `data-block-assumption`, and `data-block-impl` fields when supplied. The visible id badge matches its metadata exactly. When the user asks for structured traceability data, export an opt-in `<diagram-basename>.registry.json` sidecar with a `source` basename and a `blocks` array in source-document order. Project only values already present in the `data-block-*` attributes, omitting absent fields and the root's parent key. Records come solely from those attributes, and the registry is produced only on request. Exported diagrams exclude credentials, private source excerpts, and sensitive implementation details.

## Deterministic layout recipe

1. Follow the Tree layout: root above its children, with a short vertical stem, an orthogonal sibling bus, and drops into child boxes. Sibling order is stable and every nonroot block has one parent.
2. Place the id badge as a compact tag inside the node box and the block name in the normal name slot. A short I/O qualifier may occupy the existing sublabel line and stays out of connector labels.
3. Snap tree geometry to the layout grid. Keep the root-plus-three-tier maximum and the five-per-level ceiling, with the stricter global maximum of nine nodes. For a larger hierarchy, split at subsystem boundaries and preserve stable ids between diagrams.
4. Draw connectors before boxes. I/O arrows between siblings or cousins would turn the layout into a dependency graph, so the tree carries parent links alone. Keep constraints and assumptions out of the visible tree, so the compact map stays compact.
5. Verify that the registry contains every block and that each visible badge, node, metadata record, and implementation reference resolves to the same stable id.

## Visual encoding

The tree owns the connector grammar and layout. This pattern adds only the id badge and optional brief ports, with the line styles, status colors, and edge labels of the Tree unchanged. Set IDs in mono and structural names in Pretendard. The accent budget stays at two elements at most, and a traceability tree normally needs no focal color.

## Korean text

Name blocks with concise Korean noun phrases that identify structures. Keep stable Latin ids, paths, file names, and technical tokens exactly as written, in mono. Write registry descriptions consistently in Korean or in English, one language per badge. Keep I/O phrases short and break lines at phrase boundaries. Follow [Korean typography](korean-typography.md).

## Light, dark, and full variants

Node positions, ids, hierarchy, and registry bindings are identical across light, dark, and full variants. Light and dark change semantic tokens only. The full editorial form can add scope and provenance around the tree, and the stable id stays on the badge. Check id badge contrast at the final export size.

## Accessibility

Provide a title and description explaining the root block, the hierarchy direction, and how to locate the registry. Each block has a visible id and name, and the id is carried by text. Describe the hierarchy in parent-first order. The exported SVG preserves its accessible title/description and metadata, and a table or registry stays available for the full record.

## Verifier gates

Run `scripts/verify-diagram.mjs` for geometry, overlap, clipping, contrast, skin, visible text, and a11y. Run `scripts/verify-type.mjs --type=tree-block-decomposition` to compare node ids, parent ids, visible badges, metadata fields, hierarchy budgets, and orthogonal edges. When a registry was explicitly requested, compare its ordered projection with the source attributes and check for duplicate ids, unresolved parents, and cycles. Inspect a sample registry lookup against the saved SVG/PDF/PNG package.

## Anti-patterns

- Verb-phrase nodes describing work instead of structural components.
- Separate ICOM sides, input/output arrows, or connector-adjacent identifiers.
- An id badge that disagrees with node metadata or is absent from the registry.
- Long constraints and assumptions rendered as tiny in-node paragraphs.
- A tree implying cross-block data flow or multi-parent dependencies.
- A standards-compliance claim based on borrowed block terminology.

## Related references

[Tree](type-tree.md) · [Semantic patterns](semantic-patterns.md#8-traceable-block-decomposition) · [Output spec](output-spec.md) · [Export](export.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Style guide](style-guide.md)
