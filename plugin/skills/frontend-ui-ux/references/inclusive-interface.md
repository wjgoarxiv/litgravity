# Inclusive interface

Access is a property of the markup and the flow, and it enters the build at the first commit. Every rule here belongs in the contract's `accessibility` or `localization` group with a proof channel attached.

## Structure before styling

Build the outline first and read it as a plain document. A correct outline removes most ARIA.

- One `h1` per view, then ranks in order with no level skipped.
- Landmarks present and unique: banner, navigation, one `main`, complementary, contentinfo.
- Native `button`, `a`, `input`, `dialog` and `table` before any composite widget.
- An element that needs `role`, `tabindex` and three key handlers is the wrong element.

## Visual access

Measure contrast against the pixels actually painted behind the text, in every theme and state (CF-201 derives it from the paint stack).

- 4.5:1 for body text, 3:1 at 24 px or 18.5 px bold, 3:1 for icons and control boundaries.
- Focus indicator 2 px or thicker, at 3:1 against the control and its surroundings (CF-202).
- State carries a label, glyph, shape or position beside any hue (CF-207).
- 200 % zoom reflows without loss; 400 % needs no two-axis scrolling.

## Cognitive access

Cut what the user must remember, infer or type twice.

- One primary action per view, everything else visibly subordinate.
- Say what happened, what it means now, and what to do next, in that order.
- Keep entered input when an error returns the user to a form.

## Names, errors and announcements

Write names and messages that survive being heard alone, with no screen.

- The accessible name contains the visible label; when they conflict the visible label wins. CF-603 flags focusable controls without a name.
- An error names the field, the problem and the correction (CF-803).
- Bind errors with `aria-describedby` and focus the first invalid control.
- Announce async results through a live region; a visual change alone is silent.

## Localization

Assume translation and mirroring from the first commit.

- Interpolate whole sentences and avoid assembling copy from fragments.
- Use logical properties (`margin-inline`, `inset-inline`) so `dir="rtl"` mirrors.
- Locale-aware dates, numbers, currency, pluralization and collation.
- `lang` on the root element and at every inline language change.

## CJK and IME checklist

Latin-only testing hides these defects. Exercise Korean, Japanese and Chinese copy.

- Korean prose: `word-break: keep-all` with `overflow-wrap: anywhere` for long tokens.
- Declare a per-script font stack and check for tofu, synthetic bold and shifted baselines.
- Read `event.isComposing`; hold validation, filtering and submit until `compositionend`.
- Accept full-width digits and Latin in inputs, and normalize with NFKC before comparison.
- Hangul body text needs line height of 1.5 or more (CF-103) and a measure under 60 characters (CF-101).

The `visual-qa` skill carries `../visual-qa/references/korean-and-mixed-script-checks.md` for the capture side of these checks.

## Adaptive preferences

Each preference is a stated requirement. Verify all four.

- `prefers-reduced-motion: reduce` removes travel and parallax and keeps state (RS-003).
- `forced-colors: active` yields to system keywords, and no hardcoded background survives.
- `prefers-contrast: more` strengthens text and boundaries beyond the accent.
- Size in `rem` so OS text scaling applies; keep the root off a `px` pin.

## Proof channels

Each channel finds defects the others miss. Run all four and name them in `evidence_policy` with the route and state each covered.

1. `keyboard`: full traversal, no trap, visible focus, every action reachable.
2. `screen-reader`: name, role, value, state and announcement order on one real reader.
3. `accessibility-tree`: the repository's automated audit per route and critical state.
4. `localization`: a second locale at 200 % zoom, under forced colors and reduced motion.

On a headless agy run only `tests` and parts of `accessibility-tree` are reachable. Record the others as `omissions` with an owner so the gap has a name, and tell the reader once.

## Severity ladder

Triage by what the user can no longer do, then order the queue.

- S1: a keyboard or screen-reader user cannot finish. Report `FAIL`; the release waits.
- S2: the task finishes with wrong or missing information. Fix before merge.
- S3: the task finishes at unreasonable cost. Record it in `accepted_exceptions` with an owner.
- S4: cosmetic or preference-level. Record it in `omissions` with a reason and an owner.

## Failure patterns

Reject:

- an overlay widget or audit score offered in place of evidence
- `outline: none` with no replacement indicator reaching 3:1
- `aria-hidden` on anything focusable, or a role restating the native element
- a positive `tabindex`, or focus order diverging from reading order
- validation fired mid-composition, or CJK copy verified only with Latin strings
