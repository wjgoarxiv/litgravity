# Gantt Chart

**Catalog ID:** gantt

## Purpose and selection

Choose Gantt when tasks have explicit start and finish points and the reader wants to compare overlap, parallel work, and milestones. A timeline fits a small event sequence without task duration, and a roadmap fits work ordered only by phase where no calendar scale is trustworthy.

## Content schema

Supply a date range, a time unit, and 3–12 tasks. Every task has a stable ID, a name, a start, an end, and optionally a phase or track. All dates sit inside the stated range, and each end falls on or after its start. Declare one focal deliverable or critical task. A milestone is a point event and takes a marker of its own instead of a zero-width bar. Give the “today” date only when it is relevant and current.

## Deterministic layout recipe

Use a 1000 × 500 canvas. Reserve x=200..960 for the time scale and a 180px task-label rail. Each task gets a 40px row, with a 24px-high bar centered vertically in it. Compute bar x and width from the same linear time range, and round edges only after the date-to-pixel mapping is done. Put 4–8 equal-interval time ticks above the rows. Group tasks by phase with a subtle background rule and a text label. An optional dashed “today” marker sits at its derived x-position.

Leave dependencies out of the basic Gantt. When one is essential, add a few explicit orthogonal annotations routed behind every task bar. Row order follows the content schema. When tasks and labels need more room, grow the canvas height and keep the row height.

## Encoding rules

Horizontal length shows duration on one shared calendar scale, and row position identifies the task. A single accent bar marks the focal deliverable, and other tasks take light neutral fills. Milestones and today markers use shape or line style, each with a legend entry. Start and end dates belong on the axis or in the data, outside the bar.

## Korean behavior

Set Korean task and phase names in Pretendard. Apply the project's locale and calendar convention consistently, and state the timezone when dates tie to system events. Format month and week labels compactly, with exact dates in mono. Relieve crowded Korean task names by widening the label rail or wrapping to two lines, which leaves bar length untouched.

## Light, dark, and full variants

Light uses subtle phase bands, neutral bars, and one accent bar. Dark recalculates band and bar fills so boundaries stay visible. Full adds a title, the date range, and a short milestone or source note. Axis range, task dates, and bar widths match across every variant.

## Accessibility

Provide a table with each task's start date, end date, and phase. Describe overlaps and the key milestone in the accessible summary. State phase grouping and milestone identity in text, since fill alone cannot carry them. See [Accessibility](accessibility.md).

## Verifier gates

Run scripts/verify-diagram.mjs for bar bounds, clipping, contrast, and accessibility. Run scripts/verify-type.mjs --type=gantt for date validity, the shared time mapping, task count, the focal-bar limit, and milestone shape. See [Verifier guide](verifier-guide.md).

## Anti-patterns

- Showing more than twelve detailed tasks instead of splitting into several plans.
- Drawing bars for tasks with unknown start and finish dates.
- Giving every bar the same emphasis.
- Placing dates inside bars where they collide with names.
- Scattering dependency arrows until the schedule turns into a network diagram.

## Shared references

[Style guide](style-guide.md) · [Output specification](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Verifier guide](verifier-guide.md) · [PPTX and DOCX](office-pptx-docx.md)
