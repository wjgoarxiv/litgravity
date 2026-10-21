# Composition

Settle composition in plain structure before a token is applied. Reading order, grid, rhythm and density come first, and styling expresses them afterwards.

## Order the surface as text first

Write the surface as a flat ordered list and read it top to bottom. If it fails as text, no styling rescues it.

- Rank blocks by decision importance, whatever order the data arrives in.
- Keep DOM order identical to visual order. Reordering in CSS splits what keyboard and screen-reader users follow from what sighted users see.
- Allow one primary action per surface and at most three secondary actions.

## Commit to one column system per band

Choose one column count per band and write the legal exceptions before drawing.

- 4 columns below 600 px, 8 columns from 600 to 1023 px, 12 columns at 1024 px and above.
- Content-driven panes replace columns in consoles; declare each pane's minimum and maximum width.
- Legal breaks: full-bleed media, one focal element per viewport, a table scrolling inside its own container.
- One visible break per viewport. A second break reads as a mistake and loses the decision.

## Derive every gap from one scale

Space comes from a scale. An eyeballed pixel value is a defect that spreads, and CF-301 measures it (padding, gap and margin within ±1 px of a 4 px multiple).

- Base step 4 px; permitted values 4, 8, 12, 16, 24, 32, 48, 64.
- Space between groups is at least twice the space inside a group (CF-302).
- Headings carry roughly twice as much space above as below (CF-304 flags a clear inversion).
- Apply `gap` on the container, so rhythm survives reordering (CF-306).

## Set density from return frequency

Density follows how often the user comes back. The screenshot's appearance plays no part.

- Hourly use: rows 28 to 32 px, keyboard-first, no decorative padding.
- Daily use: rows 36 to 40 px with visible grouping.
- Weekly or first-run use: rows 48 px and up, with inline explanation.
- Coarse-pointer targets stay at least 44 × 44 px at every density.
- Reserve 2 px of outline space so a focus ring is clipped nowhere.

The contract's `taste.density` dial records the choice and its reason.

## Declare the page family

Each family imposes fixed layout consequences. Name it before laying anything out.

1. Landing surface: one column, primary action inside the first viewport, hero capped near 60 % of viewport height.
2. Collection view: sticky header, filter region, fixed row height, declared column priority, virtualize beyond 200 rows.
3. Object detail: identity and status header, actions pinned, metadata rail collapsing below 1024 px.
4. Operations console: several panes, each owning its scroll container, none reflowing the page.
5. Guided form: one decision per step, column capped near 640 px, errors beside their field.
6. Reading view: measure 60 to 75 characters, no rail competing with the text column.

## Choose shell or document per route

Shell and document layouts fail differently. Decide once per route and record it.

- App shell: persistent navigation, viewport-height frame, scrolling owned by inner regions.
- Document: page-level scroll, no height locking, navigation scrolls away.
- A document nested in a shell region needs that region's own overflow rule stated.
- Below 600 px of viewport height, collapse the shell into document flow.

## Spend space before adding chrome

Empty space is the cheapest grouping device. Exhaust it before drawing a border.

- Escalate in order: space, divider, bordered surface, elevation. Stop at the first that works.
- When a surface feels crowded, remove chrome before removing space.
- Give the empty state the same space budget as the populated one, so the layout holds still.

## Worked example

A settings page lists 14 toggles grouped into four topics. Flat reading order: page title, search, four topic groups, save action. Column band: one column at 390 px, two (topic nav, content) from 1024 px. Density: weekly use, rows at 48 px with a one-line explanation. Page family: guided form (column capped near 640 px). Shell or document: document, because the page is reached rarely and benefits from a normal scroll. The group gap is 32 px with 12 px between toggles, a ratio of 2.7, comfortably over the 2 × floor of CF-302.

## Composition review checklist

Run this before any styling review and record it with the surface inventory.

1. Flat reading order written down and matching DOM order.
2. Column band chosen and every legal break named.
3. Density tier chosen with its return-frequency reason.
4. Page family and shell-or-document decision recorded per route.
5. Widths checked just below and just above each structural change.

## Failure patterns

Reject:

- centering everything and calling the result hierarchy
- spacing values invented per component
- a grid broken in three places on one screen
- dense rows on a quarterly task, or comfortable rows on an hourly one
- nested cards standing in for a structure nobody decided
