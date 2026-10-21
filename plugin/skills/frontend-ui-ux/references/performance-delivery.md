# Performance delivery

Performance is an inventory item with a number attached. Declare it in the Design Contract `performance` group before layout work starts. A budget with no measurement profile is a wish.

## Measurement environment

Fix one profile and reuse it. Numbers from two profiles do not compare.

- CPU throttled 4 ×; network 1.6 Mbps down, 750 kbps up, 150 ms round trip.
- Cold cache, cleared storage, no extensions, declared locale.
- Median of five runs at `compact` 360 × 800; repeat at `expanded` 1440 × 900.
- Record profile, `source_hash` and route fixture beside every number.

The interface probe measures layout and craft rules. Timing numbers (LCP, INP, CLS) come from the project's own tooling, a browser performance trace, or Lighthouse if the repository already ships it. Record the tool name and version with the number.

## Declared budgets

Write each as a number the contract can carry. Tighten per project; loosening takes a recorded exception.

- LCP 2.5 s, FCP 1.8 s, INP 200 ms, CLS 0.10, each at p75 on the profile above.
- Initial route JavaScript 170 KB compressed; total critical-path transfer 500 KB.
- Initial CSS 60 KB compressed; webfonts 100 KB across at most two files.
- Largest above-the-fold image 200 KB; no load-phase task over 200 ms.
- Local feedback under 100 ms; every remote action acknowledged under 200 ms.

A loosened budget is an `accepted_exceptions` entry with a reason, an owner and an expiry.

## Critical-path diagnosis

Name what blocks first paint and first input before editing. These causes recur, in rough frequency order.

1. A render-blocking stylesheet or synchronous script in the document head.
2. A webfont with no `font-display` and no metric-matched fallback.
3. A fetch issued on mount instead of at route entry, which serializes data behind render.
4. Request chains where each URL comes from the previous response.
5. Media with no intrinsic size, shifting the fold when it arrives.
6. Consent, analytics or chat tags evaluated ahead of product code.

## Asset delivery

Ship the fewest correct bytes and let the cache keep them.

- Encode AVIF with one WebP or JPEG fallback, sized to the rendered box.
- Set `width` and `height` or `aspect-ratio` on every image and embed.
- Self-host fonts, subset per script, at most two weights per family.

## Script delivery and hydration

Hydration cost tracks the node count handed to the client. Compressed bundle size is a weaker predictor.

- Split by route first, then by deferred interaction: dialogs, editors, charts.
- Keep static regions server-rendered and hydrate interactive islands.
- Measure hydration apart from download; a 40 KB tree can cost 300 ms.

## Virtualization and its costs

Virtualize after measuring. Under about 200 rows or 5 ms per update, paginate or apply `content-visibility: auto`. Virtualizing brings these costs, and the budget has to absorb them:

- Find-in-page and screen-reader browse mode see mounted rows only.
- Deep links to offscreen rows stop resolving without a scroll-to API.
- Variable heights need a measurement cache, or the scrollbar jumps.
- Focus dies when the focused row unmounts; restore it by row identity.

## Perceived versus measured

Record both. Each answers a different question.

- Under 200 ms show nothing; up to 1 s an inline indicator; past 1 s determinate progress.
- A skeleton matches the final box, or it trades layout shift for shimmer.

## Audit protocol

Run in order and end in a verdict.

1. Reproduce on the declared profile with a cold cache.
2. Capture one load trace and one interaction trace; save both paths under `.litgravity/evidence/<slug>/perf/`.
3. Rank findings by milliseconds against the budget each breaks.
4. Attribute every finding to exactly one cause from the diagnosis list.
5. Fix the largest attributed cause and change nothing else.
6. Re-measure the same traces on the same profile and diff the numbers.
7. Report `PASS` when every declared budget holds, `FAIL` with the violated number and artifact path, or `BLOCKED` with the missing profile or capture capability. Escalate after three iterations that cross no budget.

## Failure patterns

Reject:

- a budget written as "fast" or "lightweight" with no number
- optimization argued from source reading with no trace attached
- virtualizing a 40-row table because long lists "should" be virtualized
- a perceived-performance win offered as closure on a measured budget
- a performance claim entering the independent review pass with no trace bound to the design contract hash
