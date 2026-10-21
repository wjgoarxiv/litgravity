# State machine

**Catalog ID:** `state`

## Purpose and selection

Pick a state machine when a subject has a finite set of modes and the legal transitions hinge on events, guards, or actions. Typical subjects are an order status, a connection state, a form wizard, and a job queue. Pick [Sequence](type-sequence.md) for messages exchanged between actors. Pick [Lifecycle phase map](type-state-lifecycle.md) when one subject's progress, waits, retries, cancellation, and terminal outcomes each deserve a band of their own.

## Content schema

Prepare:

- A list of distinct state records, each with a stable id, a short state name, an optional qualifier, and a role (`initial`, ordinary, terminal, error).
- A list of transition records, each with source state, target state, triggering event, optional guard, optional action, and a flag for entry or completion transitions.
- The subject and boundary of the state model, naming any excluded subsystem or external actor.
- One focal state when the diagram needs emphasis.

Write labels in the compact form `event [guard] / action` and drop empty parts. Each transition names its trigger. Add start/end pseudo-states where they clarify entry or completion.

## Deterministic layout recipe

1. Order states along the dominant progression and pick one reading direction: left-to-right for progression, or top-to-bottom for a narrow page. The initial point comes first and terminal points sit at the far end of the flow.
2. Place states on a simple 4 px grid, giving similar label lengths the same box size. Reserve small clear corridors for loopbacks before any connector is drawn.
3. Route transitions as curves around boxes so they avoid crossings. Short self-loops sit above their state. Loopbacks attach at distinct points, which keeps their arrowheads from merging into one ambiguous mark.
4. Set event/guard/action text beside the transition it names, on an opaque paper-backed label wherever a line passes behind it. Keep guards and actions in their own slots of the label sequence.
5. Draw connectors first, then state boxes and labels. When pseudo-states appear, use a filled start dot and a ringed terminal marker. Stay within the global 9-node and 12-transition limits and move over-budget logic into separate diagrams.

## Visual encoding

Draw quiet state boxes, at most one accent state, and one line style for all ordinary transitions. The start marker is a filled dot and the terminal marker is a ring with a center. Aim the accent at the state the reader should notice, often an error state or a successful completion. Label transitions with text. When outcomes need to be told apart further, add different line patterns.

## Korean text

Set concise Korean state names in Pretendard and keep event identifiers or code symbols in mono. Lead with the event, put guard conditions in brackets, and place actions after a slash. Wrap long Korean state text inside the node at phrase-level breaks. Write “성공/실패” as visible text in every case. Follow [Korean typography](korean-typography.md) for Hangul line height and mixed text.

## Light, dark, and full variants

State positions, transition direction, labels, and the focal state stay identical across light, dark, and full skins. Light and dark switch semantic token values only. The full editorial version may add one title, a concise interpretation, and a source or scope note, while the pseudo-states remain those of the model. Verify terminal rings and loopbacks at the final presentation size.

## Accessibility

Provide a title and description that name the subject, the initial condition, the principal transitions, and the terminal outcomes. Each transition has a readable event label, and legality is conveyed by text. Keep arrowheads apart from box borders, preserve connector contrast, and make start and terminal symbols differ in both shape and label. A screen-reader description follows the flow order, with states listed in the order the flow reaches them.

## Verifier gates

Run `scripts/verify-diagram.mjs` for bounds, arrow/box overlap, clipped labels, contrast, skin polarity, and a11y. Run `scripts/verify-type.mjs --type=state` for state/transition structure, limits, and required labels. Inspect branch density and labels in rendered light, dark, and full variants, since structural checks leave the question of whether a transition is understandable to a human reviewer.

## Anti-patterns

- Unlabeled transitions or arrows with unclear direction.
- More than twice as many transitions as states without splitting the model.
- A separate “timeout” edge from every state when one shared rule can be stated once.
- Lifelines and actor-to-actor messages, which belong in Sequence.
- A wait/retry lifecycle squeezed onto the rail of the main phases.
- A focal state marked by hue alone, or connectors hidden behind boxes and labels.

## Related references

[Lifecycle phase map](type-state-lifecycle.md) · [Sequence](type-sequence.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
