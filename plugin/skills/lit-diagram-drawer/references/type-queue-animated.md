# Fan-in queue and bottleneck

**Catalog ID:** `queue-animated`  
**Semantic pattern:** fan-in queue / bottleneck; visual grammar: data flow.  
**Common references:** [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Semantic patterns](semantic-patterns.md) · [Motion](motion.md) · [Korean typography](korean-typography.md) · [PPTX/DOCX](office-pptx-docx.md) · [Verifier guide](verifier-guide.md)

## Purpose and selection

Pick this pattern when several sources compete for a single limited service point and the outcome is explained by arrival rate, queue depth, capacity, waiting, or backpressure. The figure pairs a static capacity diagram with an optional step reveal. Choose Process when successive service stages dominate and source contention is secondary. Choose Sankey when the central claim is a conserved quantity splitting or merging.

## Exclusions

The budget is five sources, five visible queue slots, one bottleneck, two outcomes, and nine primary nodes. Extra sources collapse into a named cohort. The queue follows FIFO order unless the input says otherwise. Animation reveals events and keeps the item order fixed. Motion serves the scenario's real events; purely decorative traffic is excluded, and capacity is stated in numbers beyond what box size suggests.

## Content schema

```yaml
title: "Ingress under a burst"
producers:
  - { id: web, label: Web client, rate: 4, unit: "requests/s", pattern: steady }
  - { id: webhook, label: Payment hook, rate: 8, unit: "requests/s", pattern: burst }
queue: { label: Ingress buffer, discipline: FIFO, capacity: 5, unit: slots }
slots: [{ id: q1, item: "GET /orders", step: 1 }, { id: q2, item: "POST /auth", step: 1 }, { id: q3, item: "POST /payment", step: 2 }, { id: q4, item: "ERP batch A", step: 2 }, { id: q5, item: "ERP batch B", step: 2 }]
static_occupancy: 5
overflow_rate: { value: 4, unit: "requests/s" }
service: { label: Worker, capacity: 8, unit: "requests/s" }
outcomes: [{ id: admitted, label: Admitted }, { id: shed, label: "429 · backpressure" }]
steps: ["arrivals", "queue full", "backpressure", "service", "equilibrium"]
```

Supply rates with units, the queue's capacity and discipline, a constrained service rate, every outcome, and the static queue state. Derive each step from the scenario, and keep all slot states and occupancy counts consistent. Print status words such as `FULL` or `SHED` beside the numeric count.

## Deterministic layout recipe

Use a wide 1160×640 canvas. Reserve a left column for distinct producer cards, a central column for a bounded queue showing one visible slot per unit of capacity, and a right column for the constrained worker and the downstream destination. An overflow/backpressure sink sits above or below the worker, away from the queue's main route. Each producer enters at its own fixed y coordinate, and each ingress line runs to its assigned slot so the fan-in stays traceable. A single queue-depth badge aligns with the full slot stack. An equilibrium summary goes below the queue and a compact legend along the footer. Step groups may add arrivals, fill slots, activate the overflow route, and show service, with every frame holding the same positions and item order. The default export is the complete final frame.

## Encoding rules

Every flow rate and capacity carries its unit. Admitted traffic, overload traffic, and rejected or deferred output differ by line style and text alongside color. The queue count reads `occupied/capacity` and works as data. Rejected work flows to a visible sink, and admitted work follows its own path. One accent draws attention to the bottleneck or overload path, leaving producers uncolored. The static fallback shows the representative queue state, capacity, service rate, and both outcomes together.

## Korean behavior

API paths, HTTP codes, rate units, and queue policies remain intact. Korean captions use compact verbs and nouns, keeping count and unit together (for example, `5/5칸`, `초당 8건`). Line breaks stay outside identifiers. The accessible summary explains steady and burst arrivals in Korean and preserves item order.

## Light, dark, and full variants

Light and dark keep identical sources, rates, queue occupancy, routes, step sequence, and final frame, with only shared tokens changing. The full variant may add an editorial frame and a short operational takeaway outside the queue drawing. The static, reduced-motion, and print/export views show every essential route and the final queue state, so each conclusion survives without animation.

## Accessibility

The SVG description states the source count, queue discipline and capacity, service limit, and admitted and rejected outcomes. Add a linear reading list of producers, ordered slots, service rate, and outcomes. Step controls work from the keyboard and announce the current event. Status combines text with a shape or border, so color never alone marks full, blocked, or overloaded. The full keyboard, reduced-motion, focus, and no-JS contract lives in [Motion](motion.md).

## Verifier gates

Run `node scripts/verify-diagram.mjs` for node and arrow overlap, clipping, bounds, contrast, skin, accessibility, and visible-text checks. Run `node scripts/verify-type.mjs --type=queue-animated` for the registered fan-in contract: producer and service units, queue occupancy and capacity, outcomes, and route semantics. Run `node scripts/verify-motion.mjs` for ordered deterministic steps, a complete static frame, reduced-motion behavior, and working controls. See [Verifier guide](verifier-guide.md). The gallery wrapper's `data-type` value must equal this exact Catalog ID; a missing or mismatched marker fails the type check.

## Anti-patterns

- An equal-width pipeline that hides fan-in, or arrows merged before their sources can be traced.
- Queue occupancy inferred from box size, a count above capacity, or capacity without units.
- Decorative pile-up, a changing FIFO order, or a blocked path rejoining the admitted route.
- More than five sources or slots, hidden outcomes, or red as the only overload cue.
- An animation whose static frame leaves the reason for waiting unexplained.
