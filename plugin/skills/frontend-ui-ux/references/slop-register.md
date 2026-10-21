# Slop register

This register loads together with `references/craft-floor.md` whenever `frontend-ui-ux` activates. A row earns a `SLOP-*` id when a designer reads it as a reflex default, the tell of a page that a generator produced, as distinct from a plain bug that falls under a number. A genericness tell is MEDIUM at most and leaves "done" open to the user's call. Three functional rows are the only HIGH entries: SLOP-057 (broken image), SLOP-058 (a text, nav or call-to-action link that goes nowhere) and SLOP-059 (a typeless button beside another submit). They block "done" like a craft-floor HIGH until they are fixed or stated once as a limitation.

## How to use it

1. **Run the deterministic rows first.** The interface probe measures every row marked *probe*. The static fallback reads the rows marked *static* from source when no browser can render. Form the holistic view (SLOP-055, SLOP-056) last, grounded in the rows that fired. "Looks generic" with no cited row is a mood and stays out of the findings.
2. **Judgment rows.** A row marked *judgment* is DET-assist: the probe prints the hit under "Judgment calls", and a person decides. Typical decisions: a recorded reason for a common font, a real sequence behind section numbers, an emoji policy the brief asked for, a real source behind a figure. The severity applies once you confirm the call, and you state the call as Inferred.
3. **Copy rows read authored copy.** That means the visible text of the top document, outside code, form values, `<title>` and attributes. Text inside a frame belongs to the frame's owner and is charged to no one on this page.
4. **Fix with the cheapest tool.** Delete, then use the platform, then reuse, then correct a value, then add.
5. **Every surface gets the same register.** A form, a dashboard and a marketing page all run the full list. The page type changes which rows fire.

Coverage column: *probe* (rendered check), *static* (source check without a browser), *both*, or *checklist* (review by eye).

## Layout and composition

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-001 | One text-and-image split stamped section after section | ≥ 3 consecutive sections with the same column shape and image side | MEDIUM | Break the run with a stacked or full-width section | checklist |
| SLOP-002 | Identical icon-heading-text tiles as the default way to show anything | ≥ 4 tiles of equal size (±4 px) and structure in one grid, each an icon or image, a heading and text; `ul`, `ol` and `table` grids are skipped | MEDIUM | Vary tile size or content shape, or present the items as a list | probe |
| SLOP-003 | Cards inside cards, or bento cells with nothing in them | nesting depth ≥ 3, or a cell count that differs from the content count | MEDIUM | Remove the extra shell or reshape the grid | checklist |
| SLOP-004 | A split header whose side column restates the headline | a short side column (< 15 words) with no role of its own | MEDIUM | Stack headline and body | checklist |
| SLOP-005 | One section shape reused for unrelated topics | the same structure ≥ 3 times | MEDIUM | Give later repeats a different layout | checklist |
| SLOP-006 | Every gap the same size on a page that needs grouping | ≥ 5 regions and ≥ 10 samples, one 4 px bucket > 85 %, ≤ 3 buckets | MEDIUM | Space by relationship on a real scale | checklist |
| SLOP-007 | Big empty gaps that separate nothing | a gap much larger than its neighbours with no job | LOW | Remove it or give it a grouping role | checklist |

## Decoration

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-008 | The reflex violet accent | a gradient stop, or heading text (h1 to h3 or ≥ 20 px), with hue 260° to 310° and an RGB channel spread ≥ 50, unless that hue is the brand's own action colour in ≥ 2 regions | MEDIUM | A neutral surface plus one hue from the real brand | both |
| SLOP-009 | Gradient-filled headline text | `background-clip: text` with a gradient | MEDIUM | Solid colour; emphasis through weight or size | both |
| SLOP-010 | The same coloured glow repeated | CF-404's glow test (≤ 2 px offset, ≥ 16 px blur, saturation > 0.4) on ≥ 2 unrelated controls or headings outside a focus state; a single glow is CF-404 | MEDIUM | A neutral offset shadow or none | probe |
| SLOP-011 | A faint floating blob with no focal job | an absolutely placed radial gradient under 0.3 opacity that paints only itself (no text, media, control or link inside) | MEDIUM | Remove it or tie it to a real focal point | probe (judgment) |
| SLOP-012 | Dot or line grid texture beside other decoration | ≥ 2 gradient layers or a radial dot on a fixed px cell ≤ 48 px, with no canvas, table, grid, `role=img` or SVG over 48 px in its section or landmark, beside a SLOP-008 or SLOP-011 signal | MEDIUM | Remove it unless it stands in for real data | probe |
| SLOP-013 | Grain or noise dense enough to hide the layout | the layout reads better with the layer hidden | LOW | Lighten it or remove it | checklist |
| SLOP-014 | Glass blur as a default surface | no stated reason and no solid fallback for reduced transparency | LOW | A solid surface unless the brief earns the blur | checklist |
| SLOP-015 | Coloured side stripes faking emphasis on cards | on rounded elements: a single-side accent (one side ≥ 2 px saturated, the other three 0 or ≤ 1 px neutral; an all-round outline is a border and passes), an absolutely placed 3 to 12 px `::before` or `::after` bar pinned to one edge (tab and nav indicators are skipped), ≥ 2 per scope; an inset 3 to 12 px chromatic shadow counts as 1; status regions and callouts are excepted | MEDIUM | Carry emphasis with the fill or an icon | probe |

## Typography

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-016 | A reflex default face: Inter, Roboto, Open Sans, Lato, Montserrat, Arial, Helvetica, Fraunces, Mona Sans, Plus Jakarta Sans, Space Grotesk, Recoleta, Instrument Sans, Instrument Serif (the rule table is the authority; the Geist family is exempt) | the first family in the stack that actually loaded matches the list (a fallback further down is ignored; the browser default of form controls is skipped) | MEDIUM | Choose a face for the product, or record why the common one stays | both (judgment) |
| SLOP-017 | A display serif with no reason | a shortlisted serif on headings and no recorded rationale | MEDIUM | A sans display face, or record the reason | checklist |
| SLOP-018 | A giant headline over a tiny afterthought subhead | size ratio ≥ 3.5 and subhead < 14 px | MEDIUM | Raise the subhead or shorten the pairing | checklist |
| SLOP-019 | Too many type moods | > 3 base families (icon fonts excepted) | MEDIUM | Cut to three or fewer | probe |
| SLOP-020 | Long all-caps text | uppercase leaf text > 40 characters in a cased script | LOW | Uppercase for short labels only | probe |

## Colour

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-021 | Neutral mid-gray text on a coloured surface | text lightness 40 % to 70 % and saturation < 10 % on a surface with saturation ≥ 25 % (CF-201 holds the contrast floor) | MEDIUM | Tint the text from the surface hue | probe |
| SLOP-022 | Several accent hues competing | more than one saturated cluster among filled surfaces, measured as CF-205 | MEDIUM | One accent; the rest neutral | via CF-205 |
| SLOP-023 | Pure #000 or #fff as the base | an exact black or white body background or ink (a deliberate all-black dark theme is excepted) | LOW | Move a few percent toward the brand neutral | probe |

## Motion

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-024 | Bouncy easing on routine feedback | measured as CF-505 | MEDIUM | Ease-out with no overshoot | via CF-505 |
| SLOP-025 | Entrances growing out of nothing | measured as CF-503 (start ≥ 0.95) | MEDIUM | Start near 0.95 with opacity 0 | via CF-503 |
| SLOP-026 | Animating layout properties | measured as CF-508 | MEDIUM | Transform and opacity | via CF-508 |
| SLOP-027 | An endless pulse or blink bound to nothing | infinite opacity or shadow animation with no `data-*`, `aria-busy` or loading class | LOW | Remove it, or bind it to real live status | probe |
| SLOP-028 | Full transitions on every hover and re-render | > 150 ms on repeated interactions (CF-506) | LOW | Instant or ≤ 150 ms for routine changes | checklist |

## Structural micro-labels

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-029 | A tracked uppercase eyebrow over most headings | the visible element right before an h1 to h3 with ≤ 4 words, uppercase, letter-spacing ≥ 0.05 em and ≤ 0.75 × the heading's size; more of them than ceil(visible h2 count / 3) | MEDIUM | Drop the eyebrows | probe |
| SLOP-030 | 01 / 02 / 03 numbering with no real order | ≥ 2 distinct zero-padded labels before headings | MEDIUM | Remove them, or name the real steps | probe (judgment) |
| SLOP-031 | A fake version or beta stamp in marketing copy | a `vN.N`, beta or build-hash token outside real release notes | MEDIUM | Remove it unless the brief is about a release | checklist |
| SLOP-032 | Decorative status dots | a small coloured dot before labels with no bound state | LOW | Remove it or bind it to real status | checklist |
| SLOP-033 | Chained middle-dot strips | ≥ 3 `·` on one line, or a city, offset and weather strip | LOW | Lines or columns | probe |
| SLOP-034 | A strip of mood words along the hero's foot | uppercase non-link tokens in the bottom 15 % of the hero (compliance badges excepted) | MEDIUM | Remove it | checklist |
| SLOP-035 | A "scroll" cue in the first viewport | scroll text or a bouncing chevron | LOW | Remove it | checklist |

## Copy

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-036 | Stock marketing phrases | ≥ 1 whole-phrase match against the fixed phrase list in the rule table ("seamless experience", "harness the power", "best-in-class", "차세대 플랫폼" and the rest of that list), outside quotes; a bare common word such as "seamless" counts for nothing alone | MEDIUM | A specific, product-true claim | both |
| SLOP-037 | A placeholder brand name | a stock fictional company name (Acme, Globex, Initech, Contoso, NovaCore, Flowbit, Quantumly, Nexus) in visible copy | MEDIUM | Name the product from the brief | probe (judgment: it can be the real name) |
| SLOP-038 | A filler person name | "John Doe", "Jane Smith", "홍길동" and similar | MEDIUM | A specific, local name | probe |
| SLOP-039 | The negate-then-assert cadence | ≥ 3 sentence pairs of two shapes: a "Not a" or "Not an" clause followed by a capitalised sentence, or a sentence followed by one that opens with "No" or "Just" (Latin copy; no Hangul shape is defined) | LOW | Vary the rhythm; keep the device to one use | probe |
| SLOP-040 | Em dashes in shipped copy | any U+2014, or a U+2013 with spaces on both sides that is not a number, time or date range; a doubled dash in Han-majority text and a quote with a cross-origin `cite` are LOW | MEDIUM | Period, comma or parentheses | both |
| SLOP-041 | Suspiciously round or precise numbers with no source | a stat-shaped number (percent, multiplier, 48k, 10,000+, a unit rate) outside money, dates, times, versions, tables and forms, with no source, footnote, example or mock marker in its block | MEDIUM | Cite it, label it as an example, or cut it | probe (judgment) |
| SLOP-042 | Several labels for one action | > 1 wording for the same intent | LOW | One label per intent | checklist |

## Fake assets and data

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-043 | A product screenshot built from divs | a ≥ 240 × 160 px box with no media and no focusable control inside, showing a row of ≥ 3 window-chrome dots in its top 48 px, or tilted by a transform | MEDIUM | A real screenshot or a real component | probe (judgment: a real component preview looks the same) |
| SLOP-044 | A fake build or sync footer | a version or "synced 4s ago" string outside real docs | MEDIUM | Remove it | checklist |
| SLOP-045 | Matching stat blocks with nothing behind them | ≥ 4 same-height siblings whose figure is ≥ 1.5 × its label (≥ 3 beside a call to action) | MEDIUM | Remove them, or back each number with a source | probe (judgment: needs the brief) |
| SLOP-046 | A gauge or sparkline with a hard-coded value | a progress, meter, dash-array ring or single-series sparkline ≤ 64 px tall with no visible value, axis or accessible name | MEDIUM | Remove it unless it shows real data | probe (judgment) |
| SLOP-047 | A looping logo wall too small to read | an infinite sideways loop of ≤ 6 distinct logos with a median height < 20 px at 1440 px | MEDIUM | A static row with larger logos | probe |
| SLOP-048 | Carousel dots that do nothing | ≥ 2 dot controls beside ≥ 2 slides, declared autoplay, and no focusable named dot, `aria-controls`, `aria-selected`, `aria-disabled` or `aria-current` (without a declared autoplay attribute the timed read does not run: not verified) | LOW | Remove them or wire them up | probe |
| SLOP-049 | Egg or silhouette avatars | a generic avatar asset | LOW | A believable photo or a deliberate style | checklist |
| SLOP-050 | Category captions under trust logos | a category word under each logo | LOW | Logo only | checklist |

## Icons and illustration

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-051 | An illustration stacked from primitives | an inline SVG ≥ 200 × 200 px with ≥ 8 rect, circle, ellipse or polygon shapes, ≥ 3 fills, ≤ 2 text elements and no pattern | MEDIUM | Simplify it or use a real asset | probe (judgment: an honest diagram clears it) |
| SLOP-052 | A many-vertex mask faking a photo edge | `clip-path: polygon()` with ≥ 10 vertices, at least half its coordinates off the 25 % grid, or `path()` with ≥ 3 curves | LOW | A real crop or a simple shape | probe |
| SLOP-053 | Emoji in place of an icon set | emoji as the whole content of a small control (≤ 32 px), or leading a nav item, badge, list item or heading | LOW | The project's icon set | probe (judgment) |
| SLOP-054 | Hover zoom on the image itself | a `:hover` transform on `img` | LOW | Transform the container | checklist |

## Whole-page reads (last)

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-055 | Several small tells stacked on one component | ≥ 2 deterministic rows on the same component | MEDIUM (otherwise LOW) | Change that component's visual language | checklist |
| SLOP-056 | "Could be any competitor's product" | read only after every row above ran | LOW | Act on the rows that contribute | checklist |

## Functional tells

| Id | Tell | Signal and threshold | Severity | Fix | Coverage |
|---|---|---|---|---|---|
| SLOP-057 | Broken image | empty, `#` or `undefined` `src` or `srcset` with no lazy-loader attribute, or a fetch that finished and failed; an image not yet fetched at capture is not verified | HIGH | Fix the source or remove the element | both |
| SLOP-058 | Link to nowhere | `href="#"` or `javascript:` (tier derived: a script handler is invisible to the scan) | HIGH for text, nav or call-to-action links; MEDIUM for logo or icon-only links | A real destination, or a real button | both |
| SLOP-059 | A typeless button beside another submit | `<button>` without `type` whose form owner (`button.form`, so `form="id"` counts) has ≥ 2 submit-capable buttons; a lone typeless button is the form's intended submit | HIGH | `type="button"` unless it really submits | probe |
| SLOP-060 | Lorem or placeholder copy | lorem ipsum, `[placeholder]`, TODO or TBD in visible text | LOW | Real copy | both |
| SLOP-061 | Text in an endless marquee | `<marquee>` or a looping sideways keyframe with no pause | LOW | A static row or a pause control | both |
| SLOP-062 | A modal opened by reflex | the content did not need to block the page | LOW | An inline panel, toast or disclosure | checklist |
| SLOP-063 | Monospace as a "technical" costume | monospace on prose with no code or aligned data | LOW | The normal text face | checklist |

## Working with the register

- **Stacking.** Two deterministic rows on one component (a violet gradient headline over a glow, say) merge into one SLOP-055 finding that names the component and lists both rows. Fix the component's visual language once.
- **Recording a decision.** When the brief or the direction card justifies a judgment hit (a serif display face for a magazine, section numbers for an actual six-step procedure), write the reason in the Design Contract's `direction` or `accepted_exceptions` entry and tag the row Inferred in the review table. The next probe run lists the same hit under Judgment calls, so the record keeps the decision visible.
- **Copy rows and Korean.** Phrase and cadence rows read Latin copy and the listed Korean phrases. Add a Korean pass by eye: stock claims such as "혁신적인", "차세대", "원스톱" without a stated fact behind them belong to SLOP-036 and SLOP-041.
- **Reading order for a long table.** Functional tells first (SLOP-057 to SLOP-059), then layout and decoration rows that fired together, then copy, then the whole-page reads.
- **Scope.** Slides, documents and diagrams share the layout, decoration, typography, colour, copy and fake-data rows. Motion, scroll, hover and carousel rows stay with interactive pages. The office and diagram skills enforce their own subset in their QA scripts.
