# Dependency Graph

**Catalog ID:** dependency

## Purpose and selection

Pick a dependency graph when a component has multiple dependents or a real dependency cycle rules out a tree. A tree fits when every item has one parent and the graph is acyclic. Architecture fits when the goal is system communication in place of prerequisite structure.

## Content schema

Provide about 12--20 package, module, or service nodes and up to 30 directed dependency edges. Each node has a stable ID, a name, a type (internal, external, or leaf), and an optional version/registry label. Fan-in count appears as a derived value. Declare at most one cycle for focal treatment. For a DAG, state the ranking rule; for a cyclic input, mark the single back-edge explicitly.

## Deterministic layout recipe

Assign nodes to horizontal rank rows by dependency depth, with a fixed 120px vertical pitch. Node boxes are 160 × 56, ordered within each row by stable name or supplied order. Forward edges run downward or horizontally within a rank. The one permitted cycle travels around the outside of the node field as a dashed return edge that avoids every unrelated node. The cycle path and its label take the accent, and the nodes it touches stay neutral. Put a derived fan-in badge inside the node whose dependency concentration is the story.

Paint edges before node surfaces. Route off-axis edges with rounded 8px elbows, keep 12px spacing where edges fan out, and bridge a crossing on the less important path only. When more than four rank layers are required, collapse a leaf cluster into a named aggregate with its count, or split the view.

## Encoding rules

Direction means "depends on"; define the arrow direction in the caption and apply it consistently. Internal nodes take a low-ink neutral style, external dependencies take a distinct outline, and leaves take a restrained treatment. Fan-in is a numeric badge that adds no hue. The accent goes to the chosen cycle and its label alone. Version and registry sit in a technical sublabel.

## Korean behavior

Korean carries relationship explanation and captions, while package IDs, versions, and registry names stay exact. Pretendard sets names and mono sets version/registry badges. State the arrow direction in Korean, since "A → B" can be read as either use or prerequisite direction. Keep package identifiers on a single line.

## Light, dark, and full variants

Light uses neutral node fills and clear rank spacing. Dark uses separately tuned edges and external-node boundaries over the same ranks. Full adds a title and a short note about the one marked cycle or the highest fan-in node. All nodes and edges are identical across variants.

## Accessibility

Describe the direction convention, rank ordering, highlighted cycle, and highest fan-in dependency in text. Include a list or table of edges for exact dependency audit. Mark external and internal status with a cue beyond color. Keep badge text available to assistive technology. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for path collision, clipping, contrast, accessibility, and text checks. Run scripts/verify-type.mjs --type=dependency for endpoint resolution, rank order, fan-in counts, cycle limit, edge limits, and cycle routing. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- A simple tree drawn as a graph.
- Ordinary forward dependencies that point upward.
- One node per file in place of packages or modules.
- A highlighted cycle routed through unrelated nodes.
- A missing fan-in badge when dependency concentration is the reason for this type.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Semantic patterns](semantic-patterns.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
