# Timeline

**Catalog ID:** `timeline`

## Purpose and selection

Pick a timeline for events whose position on a real or declared time scale is the main point, such as release history, incidents, milestones, or a roadmap of dated events. Pick Gantt for task durations and dependencies, and Swimlane when ownership and handoffs outweigh elapsed time.

## Content schema

Every event has a stable id, a label, an exact date/time or an honest date interval, an optional owner/category, and a source. State the time zone and granularity when relevant, and mark the editorially focal event. When a date is approximate, keep the uncertainty as a range or an explicit qualifier and leave the exact day open.

## Deterministic layout recipe

1. Declare the time domain `[t0, t1]`, the scale, and the tick interval. Map each exact event time with `x(t) = plotLeft + (t − t0) × plotWidth / (t1 − t0)`, so unequal elapsed intervals receive unequal spacing.
2. Draw one quiet horizontal baseline with ticks at meaningful calendar boundaries. Date labels sit below the baseline in chronological order.
3. Put each event mark at its mapped x coordinate. Alternate event labels above and below the line, each tied to its mark by a short hairline. For dense events, add a visible axis break, widen the plot, or split the time range so that every date stays visibly placed.
4. Draw a major milestone with a slightly larger mark and the single accent treatment. A true interval becomes a span with both endpoints or a labeled band, and an event dot is reserved for instants.
5. Keep the timeline to a readable number of events. When the time unit changes, use separate, clearly labeled panels so each baseline has a single scale.

## Visual encoding

Position alone encodes time. Size and accent mark editorial importance and leave duration to spans and bands. Spell out event category, milestone status, or uncertainty in text. Draw axis breaks wherever a discontinuity changes the spacing. Decorative icons are acceptable when they add a stable category cue with a text equivalent.

## Korean text

Set event labels in Pretendard and dates, time codes, and source markers in mono. Hold one date format across the figure and state the timezone where an hour could be ambiguous. Korean date labels such as `2026년 9월` keep their Korean form, since a slash form would hide the locale. Show uncertainty in visible Korean text (`약`, `전후`, `범위`) or as an interval. Follow [Korean typography](korean-typography.md) for numerals and mixed text.

## Light, dark, and full variants

Every variant keeps exact event positions, tick intervals, and interval widths. Light and dark change semantic tokens only. The full editorial layout may add a title, a short time-range summary, and a source line, all on the original temporal scale. Check the baseline and the focal mark in grayscale and in both skins.

## Accessibility

Provide a title and description with the date range, scale, event order, and any uncertainty or axis break. Label ticks with units. Alternating label placement reduces collisions, and each label keeps its leader to its event. Name milestone status in text alongside the accent mark. Markers and rules need contrast against the paper.

## Verifier gates

Run `scripts/verify-diagram.mjs` for bounds, overlap, clipped labels, contrast, skin, visible text, and a11y. Run `scripts/verify-type.mjs --type=timeline` for monotonic event placement, time-to-x consistency, declared intervals, and axis breaks. Inspect the densest part of the timeline at the actual presentation width.

## Anti-patterns

- Equal spacing for events with unequal elapsed time.
- A missing time unit, timezone, range qualifier, or visible axis break.
- A dot standing for an event with a meaningful duration.
- Labels colliding over the baseline or detached from their events.
- Icon shape or color alone identifying the milestone category.
- Events reordered to make the layout look balanced.

## Related references

[Gantt](type-gantt.md) · [Swimlane](type-swimlane.md) · [Style guide](style-guide.md) · [Output spec](output-spec.md) · [Accessibility](accessibility.md) · [Korean typography](korean-typography.md) · [Verifier guide](verifier-guide.md) · [Office export](office-pptx-docx.md) · [Export](export.md)
