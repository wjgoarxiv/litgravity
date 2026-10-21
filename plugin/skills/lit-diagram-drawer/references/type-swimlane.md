# Swimlane

**Catalog ID:** `swimlane`

## Purpose and selection

Pick swimlanes for a cross-functional process whose central question is who owns each step and where work crosses between people, teams, or systems. Horizontal lanes suit a left-to-right process and vertical lanes suit a top-to-bottom one. Pick Sequence when messages and timing between technical actors are the subject, and a flowchart for decision logic that has no ownership axis.

## Content schema

Prepare up to five named lanes, each with a stable owner id and an optional role. List the ordered process steps with a short action, the owning lane, and an optional duration or condition. Record directed handoffs from each step to the next, covering branch outcomes and the lane boundary crossed. Declare the process start and end, and flag any step that is an external dependency.

## Deterministic layout recipe

1. Order lanes by the real workflow, following the actual flow of work. Give all lanes equal widths or heights and label them in a fixed margin or header band.
2. Place process steps in chronological order along one shared axis. Each step belongs to exactly one lane and sits fully inside it. Similar actions get similarly sized cards, and a lane with one step keeps its empty space.
3. Draw lane dividers as quiet hairlines. Ordinary progression runs mostly straight, and handoffs take short orthogonal turns with clear arrowheads. Every handoff has a visible exit and entry point on its lane boundary.
4. When step order is flexible, reorder steps to cut back-and-forth connector crossings. Genuine returns and branches stay explicit and are drawn as returns or branches.
5. Hold the figure to five lanes, nine steps, and twelve arrows under the global diagram budget. When crossings obscure ownership, split parallel teams or subprocesses into a second view.

## Visual encoding

Lane headings carry ownership, node placement carries responsibility, and arrows carry sequence and handoff. Apply a single accent to the handoff with the greatest cost, risk, or latency, and name that reason in a callout or legend. Lane position and heading already encode the owner, so lanes can share one neutral tone. Decision outcomes use text and visibly distinct branches.

## Korean text

Set lane names and action labels in Pretendard. Keep action wording short and consistent, for example verb-first steps in Korean. Reserve mono for system identifiers, time codes, and ticket references. Step labels stay inside their lane, and compound names break at natural syllable boundaries. Follow [Korean typography](korean-typography.md) for line breaks and mixed script.

## Light, dark, and full variants

Lane order, task positions, and handoff routing stay fixed across light, dark, and full variants. Only semantic tokens change between light and dark; verify the lane dividers still separate areas without dominating the process. A full editorial version can add a concise process title, one summary of the costly handoff, and a source or scope note. Decorative framing adds no extra lanes.

## Accessibility

Include a title and description naming the process, the lane owners, the direction of progression, and any consequential handoff. Show lane headers in visible text and keep every step wholly within its owner's lane. Handoff arrows cross boundaries clearly and carry arrowheads, with color as a supplement. Provide an ordered textual summary for screen readers and check that connector direction survives grayscale export.

## Verifier gates

Run `scripts/verify-diagram.mjs` for bounds, clipping, overlap, contrast, skin, text, and a11y checks. Run `scripts/verify-type.mjs --type=swimlane` for lane count, step ownership, and handoff geometry. Inspect lane crossings in both wide and portrait exports, and verify that any sideways scrolling stays inside the diagram container.

## Anti-patterns

- An unlabeled lane, or an action card straddling two owners.
- Many colored lanes with no matching semantic distinction.
- Repeated back-and-forth crossings caused by a poor step order.
- Message-level protocol details that belong in Sequence.
- Handoffs shown by proximity or color without a directed connector.
- A legend that highlights the accent without naming its meaning.

## Related references

[Sequence](type-sequence.md) · [Flowchart](type-flowchart.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
