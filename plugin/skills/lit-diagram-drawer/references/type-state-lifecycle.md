# Lifecycle phase map

**Catalog ID:** `state-lifecycle`  
**Parent grammar:** [State machine](type-state.md)

## Purpose and selection

Choose this state-machine specialization when a single subject moves through a short, ordered lifecycle and the story depends on waits, retries, recovery, cancellation, and final outcomes. The progress rail stays apart from interruptions and terminal results. Reach for the ordinary state machine when guard logic is dense, and for [Sequence](type-sequence.md) when actor messages or request timing carry the story.

## Content schema

Gather one subject, four or five primary phase states, zero to two wait/recovery states, and zero to two terminal states. Give each phase a stable id, a short name, and an optional short qualifier. Give each transition a source, a target, an event, and an optional guard or action. When both cancellation and failure can occur, record them as separate outcomes. Mark any optional start or end pseudo-state explicitly.

## Deterministic layout recipe

1. Draw the primary phases as one left-to-right rail in true lifecycle order. Centers share a baseline, and boxes share one width unless the longest label calls for a wider common size.
2. Seat wait and recovery states in a support band above the phase rail. Connect each one to the phase it interrupts and draw a labeled re-entry edge back into the lifecycle. A retry loop carries its retry limit or trigger in the label.
3. Seat terminal outcomes in a band below the rail, with separate boxes for cancelled and failed outcomes when both exist. Join every outcome to the transition source that actually leads there, and route a phase to a terminal state only when the model says so.
4. Set event/guard/action labels beside the edges they describe. Keep loopbacks outside the main rail and give each a distinct port so direction survives at crossings.
5. Show the whole small lifecycle in one static frame with 4–5 primary phases, ≤2 support states, ≤2 terminal states, ≤9 total states, and ≤10 transitions. When a limit is reached, split the overview from the detailed guard logic.

## Visual encoding

Position and band headings mark primary progress, waiting/recovery, and termination. Box style and explicit tags such as `WAIT`, `RECOVERY`, and `TERMINAL` repeat that distinction. Use at most two accent elements and pair every color cue with text or shape. Event labels take the mono role; state names take the sans role.

## Korean text

Name phases and outcomes with short Korean words set in Pretendard, with enough line height for multi-line Hangul. Keep one grammatical form across the rail, for example all nouns or all verbs, and bring in “진행 중” labels or action sentences only where the model requires them. Mono suits event IDs, retry counts, and system terms. Spell out `취소` and `실패` even when they share a subdued tone. See [Korean typography](korean-typography.md).

## Light, dark, and full variants

Every variant keeps the same three bands, state positions, connectors, and labels; light and dark differ only in semantic colors. The full editorial variant may add a title, one sentence on the lifecycle boundary, and a source note. The rail stays a rail, with its steps unchanged. Check that band labels read well on both backgrounds.

## Accessibility

Write a title and description that name the subject, the primary progression, the interruption path, and the terminal outcomes. Band position, text tags, and connector direction separate progress from recovery in grayscale. Label every re-entry edge. After export, node labels stay readable and arrowheads stay distinct. Give a logical reading sequence that follows the primary rail first, then support paths, then terminal paths.

## Verifier gates

Run `scripts/verify-diagram.mjs` for overlap, clipping, contrast, skin, text, and a11y. Run `scripts/verify-type.mjs --type=state-lifecycle` for band membership, counts, and labeled transition rules. Inspect the loopback and the distinct terminal paths in every rendered skin.

## Anti-patterns

- Actor lifelines or request/response arrows posing as lifecycle phases.
- Wait states sitting on the primary progress rail.
- Cancellation and failure merged into one outcome distinguished by color.
- A retry loop lacking a labeled event or a re-entry destination.
- Every implementation-level guard copied into the overview.
- Missing support or terminal states in the static fallback.

## Related references

[State machine](type-state.md) · [Sequence](type-sequence.md) · [Semantic patterns](semantic-patterns.md#9-lifecycle-phase-map) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
