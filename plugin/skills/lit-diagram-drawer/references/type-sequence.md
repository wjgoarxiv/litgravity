# Sequence

**Catalog ID:** `sequence`  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Motion](motion.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Sequence covers requests, responses, events, and interactions among actors where message order and timing carry the meaning: API calls, auth refresh, or incident reconstruction. State Machine fits one subject changing state, Process fits steps across owners, and Flowchart fits decision logic without actor-to-actor messages.

## Exclusions

The grammar supports up to five lifelines and twelve messages. By default one combined fragment is allowed; a second is allowed when each is a single-region `opt` or `loop`. An `alt` has at most two regions, and nesting depth is one. Creation/destruction, duration bars, and parallel/critical/break/ref operators are out of scope. An over-budget exchange splits into an overview and a detail figure.

## Content schema

```yaml
title: "Token refresh"
actors: [{ id: app, label: Client }, { id: api, label: API }, { id: auth, label: Auth service }]
messages:
  - { from: app, to: api, kind: call, label: "GET /resource", step: 1 }
  - { from: api, to: auth, kind: call, label: "Validate token", step: 2 }
  - { from: auth, to: app, kind: return, label: "New token", step: 3, focal: true }
fragments:
  - { kind: alt, guards: ["token valid", "token expired"], start_step: 2, end_step: 3 }
```

Actor order is explicit and stable. Each message declares its source, target, kind (`call`, `return`, `async`), concise label, sequence number, and optional focal state. Fragments declare participants, region guards, and the covered message range. Every return pairs with a synchronous call, and async messages travel one way.

## Deterministic layout recipe

Seat actor boxes in one horizontal row, evenly centered across a 1000px-wide canvas with equal lifeline gaps and symmetric outer margins. Dashed lifelines run from the actor row down to the bottom safe margin. Time flows top to bottom: message `k` sits a fixed 32px below the previous message, with room for its label and any activation change. Sync calls are horizontal solid arrows, returns are horizontal dashed arrows, and async sends are dashed arrows with open heads. Narrow activation bars run along the receiving lifeline from call receipt through return. A self-call is a short right-facing U-loop. A branch frame spans only the participating lifelines and the message interval, and its tab and guard sit above the first message in each region. Keep at least 24px between messages and set labels above or below their own line, clear of other lifelines.

## Lifeline binding

Mark each participant box with a unique `data-node-id`. Draw one dashed SVG `<line>` per participant with `data-lifeline-for` set to that same ID; its `x1` and `x2` equal the box center, `y1` is the box bottom, and `y2` reaches at least the last message row. Every message route carries `data-from` and `data-to`, and its first and final points land on the matching lifeline x coordinates. Keep message routes in visual top-to-bottom order within the SVG. The sequence verifier checks the lifeline map, box alignment, final-message coverage, endpoint binding, and order. Lifeline/message intersections are intentional and excluded from generic arrow-crossing totals.

## Encoding rules

Call: solid line, filled head. Return: dashed line, filled head. Async: dashed line, open head. The one primary success message may take the accent, and the two branches never share it. The operators `alt`, `opt`, and `loop` are printed in mono inside a light frame with a clear guard. Every activation bar closes. All arrows point down in time; return arrows still travel horizontally between actors and appear later in the vertical sequence.

## Korean behavior

Actor labels and endpoints stay stable. Messages use short Korean verb phrases, and API paths, token names, and protocol codes remain as written. Labels wrap only within their lifeline gap; a collision calls for a shorter message or more vertical space. Operator names and guards use the same mono role in both languages, and Korean alternatives keep the step order unchanged.

## Light, dark, and full variants

All variants share actors, messages, activation spans, fragments, order, and focus. Light and dark change only shared tokens. The full variant may add a short context note, with every message coming from the diagram itself. Sequence is static by default; add motion when a staged reveal materially explains the exchange, and follow [Motion](motion.md) in that case.

## Accessibility

The SVG description names the actors and summarizes the message path and branch outcome. Supply an ordered message list with source, destination, kind, and label, including each guard and region outcome. Async and return differ by arrow-head shape and line pattern as well as text. Group related messages in DOM order and keep labels off lifelines.

## Verifier gates

Run `node scripts/verify-diagram.mjs` for geometry, overlaps, message-label bounds, contrast, skin polarity, SVG accessibility, and visible-text checks. Run `node scripts/verify-type.mjs --type=sequence path/to/diagram.html` (or the specialized catalog ID such as `sequence-oauth`) to validate lifelines, participant binding, and message order. Review markers, activations, and fragment budgets against this guide. For animated figures, also run `node scripts/verify-motion.mjs`. See [Verifier guide](verifier-guide.md). The gallery wrapper's `data-type` value must equal this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- Upward-time arrows, open heads on returns, filled heads on async sends, or activation bars that never close.
- Branch arrows lacking an `alt`/`opt`/`loop` frame and guard.
- Labels crossing a neighboring lifeline, or actors arranged as swimlanes.
- Nested `alt` blocks, more than five lifelines, or unbounded fragments.
- Coral on both branch results, or a motion-only state that vanishes in the static frame.
