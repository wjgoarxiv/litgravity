# Kanban board

Catalog ID: kanban

## Purpose and selection

Pick a Kanban board when the reader needs a snapshot of work in progress grouped by state: queued, active, blocked, review, and complete. The message is how work is distributed across states and where WIP pressure sits at a single moment. Arrows are absent by design, because the board shows position and carries no path.

## Exclusions

Choose a swimlane or process diagram when the route and handoffs carry the meaning, an org chart for ownership, and a timeline when dates dominate. Keep a status board free of arrows so it stays a snapshot. When more than a dozen work items would each need a name, split the board or show a count summary.

## Content schema

Supply a snapshot date, a title, 2–5 ordered columns, and up to 12 work cards. Each column carries a state label, its current count, and a limit when the state is in-process; entry and terminal columns may show a count alone. Each card carries a short title, a stable work ID, an owner, a state, an optional one-line detail, and a blocked reason when the card is blocked. Define four card states: default, blocked, waiting/external, and done.

## Deterministic layout recipe

Make all columns the same width with a constant 32px gutter; the canonical column width is 240px. Give each column a quiet 2% ink wash and leave it without an enclosing border. Reserve a fixed header band holding the state name at the left, a rectangular WIP chip at the right, and a full-width hairline underneath. Inset cards 16px from the column sides, make each card 56px high, and separate cards with 12px vertical gaps. Stack cards top-down in a stable order (priority first, then ID), and reserve a fixed band below the columns for the legend and timestamp. A board with fewer columns keeps the same column width and sits centered, so one or two columns never stretch toward a generic dashboard look.

## Encoding rules

Print plain counts for the entry queue and the terminal column, and print n/limit for every constrained in-process column. When a count exceeds its limit, accent the chip's border and text. Default cards use paper fill with an ink outline. Blocked cards take a thin accent edge and a dashed accent border. Waiting/external cards take a faint fill and a dashed border. Done cards take a quiet neutral fill. Tags are small rectangles with a 2px radius. The accent budget is the over-limit chip plus at most one blocked card.

## Korean behavior

Keep state names short and familiar: concise Korean column names, with optional English in parentheses when the team uses English states. Cards keep Korean task names and owner names as written, with IDs in mono. Wrap task titles to at most two lines, and keep every owner's Korean name in its original form. Apply the Korean rules for dates, counts, and mixed-script separators.

## Light, dark, and full variants

Light and dark variants share column widths, card order, WIP values, and the snapshot date. In dark mode, invert fills and outlines semantically and keep the dashed distinctions. The full editorial variant adds the board's scope, a one-line status summary, and the snapshot date outside the board. Summary cards that repeat the exact counts add nothing, since the board itself is the data.

## Accessibility

Give the board a title and a description stating the snapshot date, the columns, the counts, the limits, and any over-limit state. Show a visible title and ID on every card, and convey state through the column plus a non-color treatment. Provide a linear text list for assistive technology in the same order as the columns and cards. Keep the WIP chip rectangular so it reads as a count and stays distinct from a pill badge.

## Verifier gates

Run scripts/verify-diagram.mjs, the shared diagram verifier for clipping, overlap, contrast, skin polarity, SVG accessibility, and visible-text checks. Run scripts/verify-type.mjs --type=kanban to confirm that each card belongs to one column, counts match the card inventory, limits are stated for constrained states, the total card and column budgets hold, and no connectors exist. Inspect the final screenshot at the target size and run humanizer checks on all card text.

## Anti-patterns

- Arrows between columns or cards.
- In-process columns lacking a WIP limit.
- More than four visible cards in one column, or more than 12 in total.
- Accent on every blocked card or every column.
- Pill-shaped WIP chips.
- A Done column that grows forever with no archive point.
- One card per employee.
- A blocked style that carries no blocked reason.

## Related references

[Style guide](style-guide.md) · [Output spec](output-spec.md) · [Korean typography](korean-typography.md) · [Accessibility](accessibility.md) · [Office delivery](office-pptx-docx.md) · [Export](export.md) · [Verifier guide](verifier-guide.md)
