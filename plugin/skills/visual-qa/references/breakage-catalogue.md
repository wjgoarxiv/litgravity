# Breakage catalogue

Each entry names a kind of visible breakage, the state and width where it usually shows, how to confirm it from a capture, and the sentence shape for the finding. A finding always names the screenshot file, the state, the width and what is visibly wrong. The severity words are P1 (blocks the user's task), P2 (degrades the task), P3 (polish); a reviewer receipt maps P0 and P1 to blocking.

## How to read a capture

1. Open the full-page screenshot with `read_file` and look at the whole composition first: hierarchy, the primary action, empty regions, unexpected scrollbars.
2. Re-open at region level for anything that looks off. Crop with the browser's own screenshot clip when the page is long, since a downscaled full-page image hides 1 px defects.
3. Compare with the same state at the next width. A defect that appears at one width and vanishes at the neighbor marks a breakpoint problem.
4. Cross-check with a measurement when one exists: `scrollWidth` against `innerWidth`, a bounding box, a computed style. A screenshot gives the symptom and the measurement gives the cause.

## Layout

| Breakage | Where it shows | Confirm | Finding shape |
|---|---|---|---|
| Horizontal page scroll | 320 and 390 px, 200 % zoom | `document.documentElement.scrollWidth > innerWidth`; the screenshot shows a bar or cut-off edge | `FAIL home-390.png: page scrolls sideways at 390 px (scrollWidth 462 > 390)` |
| Clipped text | Buttons, tabs, table cells, cards after translation | Glyphs cut at a box edge with no ellipsis | `FAIL pricing-390.png: plan title clipped at the card edge in the Pro tile` |
| Overlap | Sticky headers over content, floating buttons over footers, tooltips over inputs | One element's box covers another's text | `FAIL settings-empty-390.png: Save button overlaps footer text` |
| Content wider than container | Code blocks, tables, long URLs, unbroken tokens | Container edge crossed; no wrapping or inner scroll | `FAIL docs-390.png: URL runs 80 px past the card` |
| Collapsed grid | 768 px, between a two-column and a one-column layout | One column of cards with a large empty right half | `FAIL dashboard-768.png: cards stack in one narrow column beside empty space` |
| Wrong stacking order | Mobile reflow | The primary action sits below the secondary ones, or the summary sits after the details | `FAIL checkout-390.png: Pay button sits below the promo banner` |
| Layout shift | Data load, font swap, image load | Two captures a second apart differ in position of the same element | `FAIL feed-390.png: headline jumps 40 px when the avatar loads` |

## Interaction surfaces

| Breakage | Where it shows | Confirm | Finding shape |
|---|---|---|---|
| Tap target too small | 390 px, icon buttons, close buttons, checkbox rows | Bounding box under about 44 px, or under 24 px as a hard floor | `FAIL toolbar-390.png: close icon is 18 px square` |
| Crowded controls | Toolbars, pagination, chips | Gap under 8 px between targets | `FAIL list-390.png: Edit and Delete sit 2 px apart` |
| Missing focus ring | Keyboard traversal | A focus capture shows no visible change on the focused control | `FAIL form-1440-focus.png: no focus indicator on Submit` |
| Hover-only control | Row actions, menus | Control absent in a no-hover capture and in a keyboard-focus capture | `FAIL table-1440.png: row actions appear on hover only` |
| Dialog trap | Modals at 390 px | Dialog taller than the viewport with no scroll, or no reachable close control | `FAIL confirm-390.png: dialog extends below the viewport and the button is unreachable` |
| Edge-fixed control ignoring the safe area | Bottom bars on devices with insets | Control touches the bottom edge where `env(safe-area-inset-bottom)` should apply | `FAIL tabbar-390.png: tab bar touches the bottom edge, no inset padding` |

## Visual quality

| Breakage | Where it shows | Confirm | Finding shape |
|---|---|---|---|
| Low contrast | Body text, placeholder text, text over images, disabled-looking active controls | Measured ratio under 4.5:1 for body, 3:1 for large text and component edges | `FAIL hero-390.png: subtitle 2.9:1 over the photograph` |
| Unreadable dark mode | 390 px dark | Dark text on a dark surface, or a bright panel that kept its light token | `FAIL account-390-dark.png: card text is #444 on #222` |
| Stretched or blurry image | Avatars, logos, hero art | Aspect ratio differs from the source; soft edges at 2x | `FAIL team-1440.png: portraits are squashed to 4:3` |
| Missing image | Any | Broken-image glyph or empty frame | `FAIL gallery-768.png: third tile shows a broken-image icon` |
| Placeholder content | Anywhere | Lorem ipsum, `undefined`, `null`, `NaN`, `[object Object]` visible | `FAIL profile-empty-390.png: heading reads "undefined"` |
| Icon without a name | Icon-only buttons | Accessibility tree shows no name; capture shows only a glyph | `FAIL header-390.png: menu icon has no accessible name` |
| Mixed icon styles | Toolbars | Two stroke weights or two grids in one row | `FAIL toolbar-1440.png: filled and outlined icons share one row` |

## State completeness

| Breakage | Where it shows | Confirm | Finding shape |
|---|---|---|---|
| Raw error | Error state | Stack trace, HTTP status text or JSON on screen | `FAIL report-error-390.png: raw stack trace in the error panel` |
| Blank empty state | Empty state | A heading and nothing else, or a blank panel | `FAIL inbox-empty-1440.png: empty list renders no guidance or action` |
| Skeleton that never resolves | Loading | Second capture after settling still shows the skeleton | `FAIL orders-390.png: skeleton still visible 10 s after data arrived` |
| Validation without association | Forms | Error message appears away from its field, no `aria-describedby` | `FAIL signup-invalid-390.png: email error appears under the wrong field` |
| Motion ignoring reduced motion | Reduced-motion capture | The animated element moves anyway | `FAIL landing-390-reduced.png: hero still slides in with reduce on` |
| Destructive action without a confirm | Delete, remove, reset | Single click executes | `FAIL projects-1440.png: Delete runs without confirmation or undo` |

## Signals outside the pixels

- Console errors or warnings during a normal flow, and failed network requests, go to `console.txt`. A page that looks right while the console shows errors is a FAIL with a note about the severity.
- HTTP 200 with an error body, or an SPA route that shows its 404 component under a 200, is a defect even though the transport succeeded.
- A timing defect (spinner for 8 s) needs a timestamped capture pair, and the finding states both times.

## Wording rules

- One finding per defect. Two defects in one screenshot become two lines.
- Quote what is visible. Write `the label reads "Sav"` with the visible string.
- Keep severity out of the opening clause; the line starts with the result word (`FAIL`, `BLOCKED`) and the file name.
- Keep product defects, evidence defects (a capture that voids itself) and capability blockers in separate groups of the reply.
- Describe a defect once. The fix belongs to `frontend-ui-ux` or `litwork`; add a fix only when the user asked for fix suggestions.
