# Capture playbook

A capture is an observation with an identity attached; a picture alone is incomplete. Each section below names what to record, what voids the capture, and the code to emit when the channel is unreachable. A channel that is absent produces a blocker. A channel that ran and showed a defect produces a failure.

## Bind identity before capturing anything

Record these four items first, because a capture made before they exist cannot be attributed later:

- The design-contract SHA-256 and the source revision the artifact was built from.
- Every `capture_environment` field the manifest schema requires, in full (backend, renderer, platform, browser and runtime versions, font set, locale, reduced-motion and color-scheme state, settling policy, viewport, process owner).
- The accountable owner of any test authentication, written as a role.
- One capability probe result per channel the run will use.

Name the renderer and its process owner concretely, for example `Google Chrome 155.0.8059.85, launched by chrome-driver.mjs, owner: this conversation`. A placeholder in either field means ownership was never established: emit `BLOCKED_RENDERER_OWNERSHIP_UNVERIFIED`.

## Web surfaces

Capture declared routes at declared widths, in each declared state, after the page settles.

- **Capture**: full-page and region artifacts per route, plus loading, empty, error, disabled and recovery states, one per inventory entry. Name files `<state>-<width>.png`.
- **Settling**: wait for fonts (`document.fonts.ready`), for the data the state needs, and for animations to finish or to be frozen by reduced motion. A fixed delay is a last resort and gets noted in `driver.txt`.
- **Void when**: fonts or async data had not settled; an overlay or inspector panel is in frame; the crop leaves out the defect; the capture is reused after a source, fixture or viewport change.
- **Blocked as**: `BLOCKED_RENDERER_UNAVAILABLE` when no approved renderer is callable this session. A review of static markup stays a review of markup and never turns into a capture.

## Terminal and TUI surfaces

Capture the byte stream and the grid it rendered into. Either one alone leaves the question open.

- **Capture**: raw output plus exact columns, rows, locale and color availability; selection, focus, status, error and help states; the narrowest supported width.
- **Check**: run each artifact through `node "$VISUAL_QA_SKILL_ROOT/scripts/cli.mjs" tui-check <capture> --cols <n>` at the recorded width before reading it.
- **Void when**: columns are unrecorded, so overflow cannot be computed; escapes were stripped before the analyzer saw them; the stream passed 1 MiB or 4,096 lines and was truncated.
- **Blocked as**: `BLOCKED_TERMINAL_UNAVAILABLE` when no terminal capture path is callable. Retyping observed output is authorship; it carries no weight as a capture.

## Reference-fidelity work

Capture a pair whose halves are comparable.

- **Capture**: the reference with provenance and hash; the actual at the same dimensions, state, color scheme and font availability.
- **Void when**: dimensions differ, so no overlap metric exists; the reference is a screenshot of the build under test; provenance is unclear; the halves show different states.
- **Blocked as**: `BLOCKED_RENDERER_UNAVAILABLE` when the actual cannot be rendered; `BLOCKED_IMAGE_UNAVAILABLE` when the image analyzer cannot read the files. A dimension mismatch is a FAIL with explicit null metrics, since the comparison ran and produced that answer.

## Motion

Capture endpoints and the interruption. A description of the feel is a second-hand report.

- **Capture**: the state before the trigger, the settled state after it, the mid-flight interrupted state, and the same sequence under reduced motion.
- **Void when**: only the settled state exists; reduced motion was reasoned about and left uncaptured; completion was inferred from the animation ending.
- **Blocked as**: `BLOCKED_RENDERER_UNAVAILABLE` when the renderer cannot hold or step a transition. Endpoints alone are labelled endpoints, and the report says motion coverage is open.

## Responsive width sweeps

Capture one width below and one above every structural boundary the contract declares.

- **Capture**: each declared viewport, both sides of each boundary, the longest realistic content, and a reduced-height landscape frame. Log every cell that ran.
- **Void when**: widths are device names and carry no measured pixels; boundaries came from framework defaults; a swept cell is claimed with no artifact.
- **Blocked as**: `BLOCKED_RENDERER_UNAVAILABLE` when the renderer cannot set a viewport. A resized window with an unrecorded scale factor is an unverifiable width.

## Accessibility channels

Capture operability. Appearance is a separate question. Each criterion is its own result with its own artifact.

- **Capture**: keyboard traversal order, focus visibility at every stop, each programmatic name, error-to-field binding, measured contrast, forced-colors and zoom frames.
- **Void when**: a screenshot stands in for a name, role or announcement; contrast was judged by eye; a criterion has no artifact identifier.
- **Blocked as**: `BLOCKED_RENDERER_UNAVAILABLE` when the accessibility channel is not callable. The criterion is marked blocked and stays out of PASS on the strength of a visual capture.

## CJK and IME text

Capture composition as well as committed text. Width accounting and commit behavior fail separately.

- **Capture**: Korean, mixed-script and combining-mark content at the narrowest width; wide-glyph cell accounting; the pre-edit string mid-composition; the committed result; candidate-window overlap.
- **Void when**: only committed text exists, so composition is untested; a font fallback replaced glyphs with the font set unrecorded; wide characters were counted as one cell.
- **Blocked as**: `BLOCKED_RENDERER_UNAVAILABLE` when no input-method channel is callable. Pasting bypasses composition and stands in for nothing.

## Authentication-limited surfaces

Capture protected routes through an account that is safe to exercise and reversible.

- **Capture**: account class, scope, accountable owner, reset procedure, and a receipt for anything seeded.
- **Void when**: tokens, cookies, session identifiers or private bodies land in evidence; a protected route was swapped for a public mock without the scope accepting it.
- **Blocked as**: `BLOCKED_AUTH_UNAVAILABLE` when approved authentication cannot reach the route, and `BLOCKED_TEST_ACCOUNT_UNSAFE` when the only account is personal, production, privileged or non-resettable. Each condition keeps its own code.

## Closing every run

Release what the run created, then describe it accurately.

- Every server, browser process, profile, capture directory, trace and seeded record carries an id, a state and a receipt.
- `BLOCKED_CLEANUP_INCOMPLETE` applies when a resource leaked and cleanup could not finish.
- `BLOCKED_EVIDENCE_STALE` applies past the freshness bound or on a source-binding change; `BLOCKED_EVIDENCE_FUTURE` applies when an artifact is dated ahead of the clock.
- `BLOCKED_INDEPENDENT_REVIEW_UNAVAILABLE` applies when a tier that requires independence cannot get it.

## Failure patterns to reject

- A capture with no recorded viewport, width, locale or renderer.
- An absent channel written up as a pass in place of its blocker code.
- A blocker chosen for being milder than the one the condition names.
- Cleanup declared complete while a named resource is still held.
