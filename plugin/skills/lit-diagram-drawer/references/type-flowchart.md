# Flowchart

**Catalog ID:** flowchart

## Purpose and selection

Reach for a flowchart when the subject is decision logic, an algorithm, user-facing routing, or a bounded support or onboarding path. A sequence diagram suits actor messages and time order, and a state machine suits one entity that persists through named states and transitions.

## Content schema

Supply one start node, ordered action nodes, decision nodes that each carry a question, and one or more terminal nodes. Every edge names its source and destination, and edges leaving a decision also carry a branch label. A decision has at most three exits; choices of higher arity become nested questions. Declare either one happy path or one consequential decision as the focal emphasis. A typical diagram holds about nine nodes and twelve edges.

## Deterministic layout recipe

Use a canvas 1000px wide with a top-to-bottom primary route. Start comes first, followed by actions and decisions in topological rows. Each node receives a stable row and branch column from the input order. Align centers to a 4px grid and keep at least 64px of vertical gap between node bounds. The shape grammar is fixed: oval for start and end, square-corner rectangle for an action, diamond for a decision, and a small neutral dot for a merge. Route orthogonally with 8px elbows, and set branch labels near the first segment on paper masks. Draw edges before nodes.

Branches that rejoin merge before the route continues. When reordering cannot remove a crossing, bridge one lower-priority edge. A dense decision tree becomes an overview plus detail diagrams, and node text keeps its size.

## Encoding rules

Shape carries node type, and text labels each outgoing decision branch. Spend one accent on the happy path or on the most consequential decision, whichever the accent budget allows. All other paths stay neutral. Start, action, decision, and end are told apart by shape alone.

## Korean behavior

Phrase decision questions as short Korean questions and label every branch with a complete answer such as “예” or “아니요”. Set prose in Pretendard and keep English product names or commands intact in a technical sublabel. Keep diamond text brief and move explanation into a nearby note so type size holds. The accessible description follows branch order.

## Light, dark, and full variants

Light uses paper surfaces, ink outlines, and one path accent. Dark rebuilds node fills and outlines so shape boundaries stay clear. Full adds a title and purpose, plus a short legend when line styles need explaining. Branch topology and node positions match across themes.

## Accessibility

Include a textual step list that covers the decision branches, since a static image offers no branching navigation. The SVG description names the start and the terminal outcomes. Branch labels are visible and are tied programmatically to their edges or nearby nodes. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for node collision, branch-label clipping, contrast, accessibility, and visible text. Run scripts/verify-type.mjs --type=flowchart for node-shape grammar, branch labels, decision exits, reachability, and edge budgets. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Fill colors that signal action versus decision.
- Unlabeled yes/no or other decision branches.
- A diamond with four or more exits.
- Crossing branches that a deterministic column reordering would untangle.
- A diagram so dense that a text checklist reads more easily.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Semantic patterns](semantic-patterns.md) · [Annotation primitives](primitive-annotation.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
