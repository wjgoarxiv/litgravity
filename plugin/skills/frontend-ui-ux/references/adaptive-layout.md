# Adaptive layout

A layout adapts through a finite list of named transformations, each triggered by a measured failure in real content. Register every width you cover as an `inventory.viewports` entry in the Design Contract, and record each transformation in `responsive_transformations` with the route, the viewport id and the behavior.

## Signals the layout answers to

Width is one axis among several. List every signal the surface reacts to before drawing a boundary.

- Container inline size beats window width; a container query keeps a component correct wherever it is placed.
- Viewport height, including a 375 px tall landscape phone and a desktop window split in half.
- User font size and page zoom at 200 % and 400 %. The probe's `1440-zoom200` row reproduces the 200 % reflow as a 720 px viewport at double scale.
- Pointer precision, and whether hover exists at all on the device.
- Translated string length: budget 1.35 × for European locales and a wider glyph advance for CJK. The contract's `localization.text_expansion_percent` carries the number.
- Soft-keyboard occlusion, notch and home-indicator insets (RS-009 checks `env(safe-area-inset-*)` on edge-fixed controls when `viewport-fit=cover` is on).
- Record count at zero, one, typical and the enforced maximum.

## Deriving boundaries from content pressure

Find the width where content stops working and put the boundary there. A device name measures nothing, and a framework default is a guess (RS-005).

1. Load the longest realistic content at 320 px, then widen in 8 px steps.
2. Note the first defect: truncation, a two-word orphan, a target under 44 px, page scroll.
3. Snap that width up to the nearest value already on the spacing or grid scale.
4. Name the boundary after the transformation it triggers: `rail-collapse`, `grid-to-list`.
5. Stop at five structural boundaries per route; a sixth means the layout is unresolved.

Capture one width below and one above each boundary during the sweep. The interface probe covers 320, 390, 768 and 1440 px, so add the boundary widths with your own captures.

## Transformation verbs

State a verb, its subject and the resulting arrangement. "Goes responsive" gives a reviewer nothing to check.

- reflow: identical elements, a different track count or axis
- stack: a row becomes a column in a declared order
- collapse: peer regions merge behind a single selector
- reveal: an overlay region becomes permanently visible
- defer: content moves behind a disclosure inside the same view
- relocate: a control moves to a bottom bar, sheet or overflow menu
- freeze: a header row or leading column pins while the rest scrolls

Example entry: `route:orders @ viewport:390: stack (filters above the table, table becomes a card list, row actions relocate to an overflow menu)`.

## Priority when space runs out

Rank content once per route and apply that ranking at every width. Carry it on `inventory.regions` so review can compare it with the contract hash.

- P0: the answer the user came for, plus the primary action. It stays visible at every width.
- P1: navigation and status. May relocate and stays reachable.
- P2: metadata, counts, secondary detail. May defer behind a disclosure.
- P3: decoration. Goes first, with no replacement.
- If P0 does not fit at 320 px under 200 % zoom, split the task into steps and keep the type size.

## Type and spacing across widths

Scale by role. Multiplying every value by one factor destroys the rhythm.

- Body copy holds at 16 px at every width and on every platform (RS-008 sets the same floor for text-entry controls on touch).
- Headings may use `clamp()`; write out the minimum, preferred and maximum.
- Line length is 45 to 75 characters for Latin and 30 to 45 for CJK (CF-101 flags prose blocks past 90 Latin or 60 CJK characters).
- Line height is at least 1.5 for Latin body and 1.7 for CJK body (CF-103 flags below 1.4 and 1.5).
- Move gutters and section padding one scale step per boundary.

## Targets by pointer class

Size for the coarsest pointer that reaches the surface. Fine-pointer density is opt-in per region.

- Coarse pointer: 44 × 44 px activation area, 8 px of clear space between neighbours (CF-701, CF-702).
- Fine pointer: 24 × 24 px minimum, clear space may drop to 4 px.
- Destructive controls keep the coarse minimum under every input mode (CF-703).
- Anything driven by hover, drag or swipe also gets a visible discrete control (CF-704).

## Test matrix

Check one width below and above each boundary, then sweep the other axes. Log every cell you ran in the verification receipt.

| Axis | Cells |
|---|---|
| Width | 320, 360, 768, 1024, 1280, 1920 |
| Zoom | 100 %, 200 %, 400 % at 1280 |
| Height | 640 portrait, 375 landscape |
| Input mode | touch, pointer, keyboard |
| Content | empty, single, typical, maximum, longest translated label |
| Preference | dark, forced colors, reduced motion |

## Worked example

A dashboard has a left rail (240 px), a table of nine columns and a toolbar. Pressure test: at 1100 px the ninth column clips; at 900 px the rail leaves 660 px for the table; at 700 px the toolbar buttons wrap into three rows.

- Boundary 1, 1100 px (snapped to 1120): `rail-collapse`. The rail becomes an icon strip (relocate: labels move to tooltips and a focus-visible name).
- Boundary 2, 720: `table-to-cards`. Columns 4 to 9 defer behind a "details" disclosure per card (defer), the primary action stays on the card (P0).
- Boundary 3, 480: `toolbar-overflow`. Secondary buttons relocate to an overflow menu.

Three boundaries, each with a verb, a priority rule and a width on the 8 px scale. The contract lists `viewport:1120`, `viewport:720` and `viewport:480` next to the probe's four rows.

## Failure patterns

Reject:

- boundary values inherited from a framework default with no measurement behind them
- content that disappears below a boundary with no named place it stays reachable
- page-level horizontal scrolling at 320 px, or a scroll region with no visible edge (RS-006, RS-010)
- `100vh` on a surface that browser chrome or the soft keyboard overlays
- a density increase that pushes targets under 44 px or suppresses the focus ring
