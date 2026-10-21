# Visual language

Visual language is a closed set of named roles with fixed values. What a component cannot name in that set is drift.

## Name type by role

Decide the roles the product needs, bind values to each, and choose a family last.

- Cap at 7 roles: display, page title, section title, body, body-strong, meta, label. Add mono for code.
- Every role fixes size, weight, line height, tracking and wrapping behavior.
- Line height is 1.5 for body, 1.2 to 1.3 for headings, 1.6 for CJK body copy (CF-102, CF-103).
- Use tabular numerals wherever a number updates in place (CF-106).
- Two families plus one mono. A third family requires a named exception (CF-108, SLOP-019).

## Bind color to semantic roles

Components consume roles. A numbered palette scale is a foundation value and never a component decision.

- Roles: canvas, surface, surface-raised, text, text-muted, border, border-strong, accent, accent-text, positive, warning, negative, focus, selection, overlay.
- Ship each role as a foreground and background pair, so contrast belongs to the pair.
- Ship a state ladder for interactive roles: default, hover, active, disabled.
- Raw scales fail review: `gray-500` carries no meaning, cannot invert per theme, cannot be audited and multiplies one-offs.
- One saturated accent hue per view (CF-205).

## State contrast as numbers

Contrast is measured per theme against the painted background. The eye is no instrument for it.

- Body and small text: 4.5:1 minimum.
- Text at 24 px, or 18.5 px at bold and above: 3:1 minimum.
- Meaningful icons, chart marks and control boundaries: 3:1 minimum.
- Focus indicator: 2 px minimum thickness at 3:1 against both adjacent colors.
- Measure placeholder, muted metadata and disabled labels explicitly; those fail first (CF-807).

## Keep one icon system

One geometry, one weight, one metaphor vocabulary. An icon sharpens a label and sits beside it.

- A single grid at 24 px, one stroke weight, one corner and terminal treatment (CF-601).
- Name every meaningful icon, hide decorative ones from assistive technology, and add text to any destructive action that an icon alone would carry.
- Metaphor risk: obsolete objects, hand gestures, animals and local symbols shift meaning by locale. Verify each shipped locale.

## Treat imagery as tokens

Imagery inherits system values. Undecided imagery becomes layout instability at load.

- Aspect-ratio tokens, a declared focal point and a reserved box before the asset lands.
- Text stays out of raster images, where it cannot translate, zoom or be announced.
- Text over imagery needs a scrim that restores the measured contrast minimum (CF-204, CF-406).

## Run surface, depth and elevation as one ladder

Surface color, border and shadow move together. Three systems produce three mismatched hierarchies.

- At most three levels above canvas: raised, overlay, modal.
- Each level defines its surface color, border and shadow in one entry.
- Nest two surfaces at most; a third means the structure is wrong (SLOP-003).
- Radius is a system value with two or three options, and per-component radii stay out (CF-401 checks concentric nesting).

## Pick the data display from the question

Choose the form from the question, then check that the encoding carries it.

- Comparing a few categories: bar, ordered by value unless the axis is time.
- Change over time: line, one unit per axis, a second axis only with a stated reason.
- Part of a whole: stacked bar; a circular form at two or three parts.
- One value against a target: a large numeral with the target and a signed delta.
- Add a non-hue channel (position, label or pattern) to every color encoding.

Charts and dashboards that carry real numbers also fall under the `dataviz` guidance when the host offers it; the choices above are the floor.

## Catch drift before review

Drift is mechanically detectable. Run these before the independent review pass.

1. Search components for raw hex, `rgb(` and hardcoded px spacing: `rg -n '#[0-9a-fA-F]{3,8}\b|rgb\(' src`. Expect zero hits outside the token layer.
2. Count type roles, elevation levels and radius values against the direction card.
3. Re-measure contrast in the light theme, the dark theme and forced colors.
4. Record every accepted deviation in `accepted_exceptions` with an owner and expiry.
5. Run the probe: CF-108, CF-205, CF-301 and CF-401 report the same drift from the rendered side.

## Failure patterns

Reject:

- a component importing a palette scale directly
- status carried by hue alone
- contrast reported as "looks fine" with no ratio
- two icon families on one surface
- a pie chart with seven slices, or a chart where a table answers the question
