# Behavior-first semantic patterns

Reach for a semantic pattern when behavior, state, enforcement or risk carries the message. The pattern fixes what the reader must see, and a visual type still controls geometry. A pattern adds no new catalog type.

| Pattern | Use when | Common visual route |
|---|---|---|
| Fan-in queue / bottleneck | Many arrivals compete for finite capacity, a queue or a choke point | Data flow; Process when stage ownership dominates |
| Staged framework | Each stage repeats named slots such as input, question, governance or output | Process; Swimlane when rows mean owners |
| Unstructured input to durable artifact | Loose conversation or files are normalized into a governed result | Data flow; Process for ordered gates |
| Paired policy traces | Two rulesets must show pass, fail, skipped, not reached and first divergence | Flowchart; Sequence when actor and time are central |
| Secure paved road | Permitted and rejected ingress paths cross a trust boundary | Architecture |
| Governance/control catalog | Controls are grouped by where they are enforced | Layer stack; DP security matrix for role-to-permission mapping |
| Compensating security layers | Controls cover earlier gaps and residual risk moves outward | Layer stack; Nested for containment |
| Traceable block decomposition | A hierarchy needs stable ids, I/O, constraints and an implementation link per block | Tree |
| Lifecycle phase map | One subject passes through phases, waits, retries, cancellation and terminal outcomes | State machine; Sequence when messages dominate |

## Selection rules

1. Write the reader's question in one sentence.
2. Choose a pattern when it captures a real behavior contract; otherwise choose the visual type directly.
3. Select the nearest type whose geometry makes the relationship legible.
4. Carry the pattern's semantic labels and limits into the type layout.
5. One grammar per view. When the pattern cannot fit clearly, split the view.

Queue labels separate offered work, accepted work, capacity, waiting, rejected or delayed work and the drain path. A trust boundary is a named boundary, and each crossing states its policy. A paired trace aligns equivalent checkpoints and marks the first difference.

Motion is a presentation choice and never a semantic requirement. Use it when an ordered change becomes easier to follow, and keep the final state visible without it.
