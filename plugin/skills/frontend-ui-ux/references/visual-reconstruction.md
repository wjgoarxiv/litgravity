# Visual reconstruction from references

A reference image shows one state at one viewport, rendered by a stack you may not know. Rebuild semantic, responsive markup and tune it toward the reference. A screenshot used as the page background, or as a stand-in for real content, is a different artifact and fails the lane.

## Measure the frame

Record the image dimensions and device scale. Measure the main content width, outer margins, columns, type sizes, baseline spacing and large color regions before coding. Sample flat interior pixels from edges-free areas and gradient-free fills. Use the smallest spacing scale that explains the measured gaps, and take each value from a measurement.

`run_command` with Python or Node can sample pixels from the file (a short script next to the evidence in `.litgravity/evidence/<slug>/` is enough). The `visual-qa` skill (`../visual-qa/scripts/cli.mjs`, command `image-diff`) compares two PNGs once you have a capture of your own.

Keep an internal note that separates direct observations from responsive or behavior assumptions and states that other states are absent from the frame. A reference establishes one state. Hover, focus, error, loading and narrower layouts come from the product's interaction contract, or from a question about a material unknown. Observation labels stay out of the interface itself.

## Rebuild meaning and assets

- Use heading elements in outline order, real navigation lists and selectable text.
- Fix contrast failures that the reference shows, and keep visible keyboard focus.
- Recreate permitted geometry, rules, simple icons and gradients.
- Extract only assets the project is allowed to use, and preserve their source resolution.
- Substitute an unavailable permitted asset at the same dimensions, or omit decoration that carries no information. Logos, wordmarks and licensed photographs stay with their owners.

When the reference font is unavailable or unlicensed, choose a metric-compatible fallback. Compare cap height, x-height and advance width, adjust line-box metrics only where needed, then verify that the longest real label still fits.

## Infer responsive behavior

One frame proves one width. Classify regions as fixed rail, fluid column or centered max width. Set breakpoints where measured content stops fitting. Decide what wraps, stacks, collapses or scrolls (`references/adaptive-layout.md` lists the verbs), and inspect the narrowest supported width plus one width around each breakpoint. Keep these assumptions in the Design Contract until the user or another source confirms them.

## Iterate against the capture

Capture the build at the reference dimensions and device scale (the probe's `--out` folder holds screenshots at fixed widths; for an exact frame use the chrome driver from a short script, or the project's Playwright). Compare structure, spacing, type, then color. Fix the largest measured mismatch and recapture. Stop after three passes that do not reduce the overall difference. A fidelity review record can retain per-region measurements, source and output paths, unconfirmed states and asset decisions in `.litgravity/evidence/<slug>/fidelity.md`. The reader reply needs the result and a material limitation once.

Use "pixel perfect" when dimensions and scale match, every visible state is compared, no unexplained measured gap remains, and the typeface and assets are approved. Otherwise describe the measured result and the remaining mismatch plainly.

## Observation table

Keep one row per region:

| Region | Measured in reference | Built | Delta | Cause or decision |
|---|---|---|---|---|
| Header height | 72 px | 72 px | 0 | |
| H1 size and weight | 56 px / 600 | 56 px / 600 | 0 | |
| Card gap | 24 px | 20 px | 4 px | Spacing scale step snapped; accepted |
| Body color | `#3a3f45` | `#3a3f45` | 0 | |
| Hero image | 1200 × 640 | 1200 × 640 | 0 | Asset supplied by the user, sha256 recorded |

Rows with a delta get a cause or a fix. The table feeds the fidelity record and, for acceptance, the `visual-qa` `reference-fidelity` tier.

## Failure patterns

Reject:

- a screenshot used as a background or as content
- spacing and type values chosen because they look close, with no measurement
- hover, focus and error states invented from one idle frame and presented as observed
- a "pixel perfect" claim made from one width
- a logo, wordmark or licensed photograph recreated by hand
