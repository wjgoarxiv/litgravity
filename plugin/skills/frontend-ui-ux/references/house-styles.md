# House styles, the kit and the design lock

Read this before writing markup for a new page or screen. It replaces the decisions a run used to
make from scratch every time (typeface, palette, scale, radii, component anatomy, page skeleton)
with a small closed set that a script writes into the project and the interface probe checks on the
render. The point is that two runs of the same brief land in the same register at the same level of
craft; what still varies is the content, the composition inside the skeleton and the accent art. One
place on every page is allowed to be bold: its signature moment (section 6), declared in the lock and
checked like the rest.

## 1. Lock the look first

```bash
FRONTEND_UIUX_SKILL_ROOT="<directory containing the selected installed SKILL.md>"
node "$FRONTEND_UIUX_SKILL_ROOT/scripts/design-lock.mjs" list
node "$FRONTEND_UIUX_SKILL_ROOT/scripts/design-lock.mjs" match "<the request>"
node "$FRONTEND_UIUX_SKILL_ROOT/scripts/design-lock.mjs" init --family <family> [--style <id>] [--brief "<the request>"] [--density calm] --dir <project> --scaffold \
  --moment <kind> --moment-note "<what it shows>" [--moment-place "<where it sits>"]
node "$FRONTEND_UIUX_SKILL_ROOT/scripts/design-lock.mjs" moment --dir <project> --kind <kind> --note "<what it shows>"
```

`init` writes into the project:

| File | What it is |
|---|---|
| `design.lock.json` | The declaration the probe reads: style id, family, density, fonts, type scale, display range and moment ceiling, radii, spacing, light and dark palette, elevation, and the signature moment (scale, kind, note, place) |
| `ui/tokens.css` | Generated custom properties (`--c-*`, `--fs-*`, `--fw-*`, `--sp-*`, `--radius-*`, `--shadow-*`, `--dur-*`) with dark mode and the `@font-face` rules |
| `ui/components.css` | The shared `ui-*` component sheet; it reads only tokens |
| `ui/ui.js` | Charts with a table fallback, sortable tables, keyboard tabs |
| `ui/fonts/` | Pretendard (Latin and Hangul) and JetBrains Mono with their OFL texts, copied from this plugin after a sha256 check; nothing is fetched |
| `index.html` | Only with `--scaffold` and no existing page: the starter for the family |

**Density.** Every lock records `density: rich` unless the request asks for a calm page. Rich is
the default because the user wants pages that feel made, not emptied: a tighter section rhythm
(48, 72 and 96 px), the style's texture (field-notes notebook dots), a second accent family
(`--c-accent-2`, `-ink`, `-wash`, `on-accent-2`), colour bands (`ui-band`, `ui-band--accent-2`,
`ui-band--support`), a two-accent wash (`ui-wash`) and an atmosphere glow (`ui-glow`, a soft
glow token that is `none` on flat and offset locks). `density: calm` is opt-in: `--density calm`,
or a brief that says minimal, calm, quiet, restrained, understated, 미니멀, 차분, 절제, 담백 or 간결
(`match` prints the density it reads). Calm restores the broad 64, 96 and 128 px sections, a flat
canvas, no glow, and holds the probe to one accent hue (CF-205). Contrast, focus, overflow,
reduced motion and every other floor are the same in both.

Choose in this order and stop at the first rule that decides:

1. **Existing product or brand tokens** (brownfield, a design system in the repo, colours or type the
   user named): do not lock a kit style over them. Either write a style file in the same schema as
   `kit/styles/*.json` with the brand's values and lock it with `--from <file>` (a new id), or skip
   the lock and say the DS rules did not run.
2. **The brief names a register.** A style keyword in the request picks it: pass the request as
   `--brief` (or run `match`) and `init` locks the style whose keyword it contains, the longest
   keyword winning, so "neo-brutalism" never lands on `computational-brutalism`. Brutalist,
   brutalism, retro-futurist, CRT, 브루탈리즘 and 레트로퓨처 pick `computational-brutalism`;
   neo-brutalism, neubrutalism and 네오브루탈리즘 pick `neo-brutalism`; `list` prints every
   keyword. A register named in other words matches a style's `use_when` line: lock that style.
3. **Competing directions left open** by the brief: ask, as `references/production-interview.md`
   says, before locking.
4. **No visual direction at all:** the family decides, and `init` without `--style` applies it.
   A `landing` page (read once: landing, docs, report) locks `field-notes`, the authored default
   profile (`references/default-editorial-pixel.json`) made complete: same palette, spacing, type
   ranges and pixel-art rule, plus the fonts, radii, elevation and component anatomy the profile
   left open. A `workspace` or `settings` screen (dashboards, settings, forms, admin and data-dense
   screens) locks `graphite`. `meadow` is never a default; it needs a brief that asks for its
   register. The same holds for `computational-brutalism` and `neo-brutalism`: opt-in only.

| Style | Register | Accent art |
|---|---|---|
| `field-notes` | Default for `landing`. Warm paper with notebook dots, deep ink, a terracotta accent with a deep-teal second accent, mist as the tint, thin rules instead of shadows, large editorial title, small lowercase mono labels | An original pixel motif on read-once pages (section 5) |
| `graphite` | Default for `workspace` and `settings`. Cool greys, white surfaces, a blue accent with a rose second accent, 6–8 px radii, soft two-layer elevation | None |
| `meadow` | Opt-in only. Near-white, deep teal accent, coral second accent, sand tint, 12–18 px radii, soft elevation | None |
| `computational-brutalism` | Opt-in only. Retro-futurist instrument with its structure on show: drafting-film grey on a 32 px plotting grid with a stronger line every 160 px, monospaced text and mono headings and figures at real size, square corners, 3 px section rules carrying `data-coord` labels, 2 px compartments with inverse ink header bars, uppercase mono meta, heavy uppercase display, a hazard-orange signal with a plotter-blue second accent; dark mode is a phosphor CRT with an amber signal. Flat elevation | Instrument parts (section 5) |
| `neo-brutalism` | Opt-in only. Lavender canvas, white surfaces, 3 px ink outlines on surfaces and 2 px on controls, zero-blur ink offset shadows (6 px surfaces, 3 px controls), solid sunflower-yellow panel heads and accent with ink text, an electric-blue second accent, pink support block, chunky 900-weight display and 800-weight headings, buttons that press into their shadow. Offset elevation | Stickers and colour blocks (section 5) |

Each style file also carries `signature` (what must show for the register to read) and `forbid`
(what breaks it); `design-lock.mjs list` prints both. The two brutalist registers differ on
purpose: computational brutalism is flat, square and monospaced, neo-brutalism is outlined, offset
and loud. Never mix their signatures on one page.

Families decide the skeleton, not the look:

| Family | Use for | Starter |
|---|---|---|
| `landing` | Pages read once: landing, product, launch, portfolio, docs home | Site bar, split hero, steps, feature split with a real kit view, quote, three plans, FAQ, footer |
| `workspace` | Screens worked in: dashboards, consoles, admin, tables | App shell (side nav, top bar), headline figures, 8 + 4 panel row, full-width table with filter and search |
| `settings` | Guided forms: settings, account, onboarding, checkout | Section index plus one column capped near 720 px, labelled fields with hints and errors, save bar with status, danger zone with a typed confirmation dialog |

A starter is a skeleton: keep its order unless the brief says otherwise, delete what the brief does
not ask for, add sections by reusing its parts. Replace every `{{slot}}`; the probe fails a page
that still shows one (DS-006). Mixed products use one style and the family of each screen.

## 2. Build only with the kit

- Link `ui/tokens.css` first, then `ui/components.css`, then page rules. Load `ui/ui.js` with
  `defer` when a chart, sortable table or tab set is on the page.
- Page rules may set layout (grid areas, widths, order, `gap`) and may only use `var(--…)` for
  colour, type size, weight, radius, shadow, spacing and duration. A literal colour, font family or
  off-scale size is drift; the probe reports it (DS-002 to DS-005).
- Something the kit lacks is built from tokens in a page rule, in the kit's idiom. It is not a reason
  to import a framework, a second icon set or another font.
- Copy is still the work: product names, numbers and sentences specific to the brief. Mark invented
  figures as examples where a reader could take them as real.

### Class catalogue

| Area | Classes |
|---|---|
| Type | `ui-display` (the one display title), `ui-h1` `ui-h2` `ui-h3` `ui-h4`, `ui-lead`, `ui-body`, `ui-muted`, `ui-small`, `ui-meta`, `ui-label` (mono, lowercase, short), `ui-num` (tabular), `ui-code` |
| Layout | `ui-container` (`--narrow`, `--wide`), `ui-section` (`--sunken`), `ui-band` (`--accent-2`, `--support`: a full-bleed colour band whose text takes the band's ink), `ui-section-head`, `ui-stack` (`--tight`, `--loose`), `ui-cluster`, `ui-split` (`--even`, `--top`), `ui-grid` with `--cols` |
| Actions | `ui-btn` with `--primary`, `--ink`, `--quiet`, `--danger`, `--sm`; one primary per view |
| Forms | `ui-field` with `__label`, `__hint`, `__error`; `ui-input`, `ui-select`, `ui-textarea`; `ui-input-group` with `__addon`; `ui-check`; `ui-switch` (a checkbox with `role="switch"`); `ui-segmented` (buttons with `aria-pressed`); `ui-form-actions` |
| Surfaces | `ui-panel` (`--flush`, `--accent-2`) with `__head` and `__title`; `ui-wash` (the two-accent wash); `ui-glow` (the lock's glow, for one surface such as the moment; on `ui-hero__art` it lands on the moment itself); `ui-rule`; `ui-callout` (`--info`, `--positive`, `--warning`, `--negative`) |
| Status | `ui-status` (`--positive`, `--warning`, `--negative`, `--info`) always with words; `ui-tag` with the same variants, `--accent` and `--accent-2` |
| Figures | `ui-stat-row` of `ui-stat` with `__label`, `__value` (a `div`), `__note`; `ui-meter` with an inner `span` width |
| Tables | `ui-table-wrap` around every `ui-table` (`--compact`, `--stack` for phones with `data-label` on each cell); numeric cells `is-num`; sortable headers `<th><button class="ui-sort">` inside `table[data-ui-sortable]` |
| Lists | `ui-list`, `ui-steps` (an `ol` of real steps), `ui-checklist` |
| Disclosure | `details.ui-disclosure`, `ui-tabs` with `role="tablist"` and `data-ui-tabs`, `dialog.ui-dialog` with `__body` and `__actions`, `ui-toast-region` and `ui-toast` |
| Site | `ui-skip`, `ui-sitebar` with `__inner`, `ui-brand`, `ui-sitenav`, `details.ui-menu` with `__panel`, `ui-hero` (`--stage`: the art takes the larger column and the height) with `__copy` and `__art`, `ui-quote`, `ui-plans` of `ui-plan` (`--featured`) with `__price`, `ui-cta-band`, `ui-footer`, `ui-pixel` |
| App | `ui-app` with `__nav` and `__main`, `ui-navgroup` with `__label`, `ui-navlist` with `aria-current`, `ui-topbar`, `ui-page` with `__head` and `__title`, `ui-workgrid` with `ui-span-12/8/7/6/5/4/3`, `ui-scroll`, `ui-toolbar`, `ui-search`, `ui-empty` |
| Settings | `ui-settings` with `__nav` and `__body`, `ui-setting-section` (`--danger`) with `__head`, `ui-savebar` |
| Moment | `ui-setpiece` (display type at the lock's moment size), `ui-bignum` (one figure at moment size, heading font, tabular); both only inside `[data-ui-moment]` (section 6) |
| Signature | `ui-coord` (bracketed mono coordinate or measurement label), `ui-prompt` (a `>` prefix; `--cursor` adds a static block cursor), `data-coord="…"` on a `ui-section` or `ui-hero` (a label on the section rule where the lock shows section marks), `ui-ruler` (tick bar), `ui-frame` (a ruled box with registration crosses), `ui-scan` (static scanlines), `ui-readout` (mono value well), `ui-panel--accent` and `ui-panel--support` (colour blocks), `ui-sticker` (tilted tag) |
| Charts | `UI.bars(el, { labels, series: [{ name, values, role: "chart-1" }], marker: { index, label }, caption, indexLabel, unit, stacked })` and `UI.lines(…)`; roles are `chart-1` to `chart-5`; each chart gets a legend when it has two series and a "Show as table" fallback |

## 3. What the probe checks against the lock

The interface probe finds `design.lock.json` beside the page it serves (or takes `--lock <path>`)
and runs these rules at every matrix row. Without a lock they are listed under Not verified.

| Id | Rule | Severity |
|---|---|---|
| DS-001 | `ui/tokens.css` is not applied: `--ui-lock` on `:root` is missing or names another style | HIGH |
| DS-002 | Visible text set in a family the lock does not name | HIGH |
| DS-003 | Text, background, border or SVG colour more than 8 per channel from every palette role (light and dark); four or more distinct colours is HIGH, fewer is MEDIUM | HIGH / MEDIUM |
| DS-004 | Font size neither on the scale (±0.5 px) nor inside the display range | MEDIUM |
| DS-005 | Corner radius not in the lock and not fully round | LOW |
| DS-006 | A `{{slot}}` from a starter left in text, a title or a labelling attribute (the static fallback reads `.html` files only, since framework templates use braces) | HIGH |
| DS-007 | A shadow outside the lock's elevation grammar: a `flat` lock (computational-brutalism) takes only rings, no blur and no offset past a hairline; an `offset` lock (neo-brutalism) takes zero-blur offsets but no blur. Inset shadows never count; `soft` locks leave offsets to CF-403 | MEDIUM |
| DS-008 | The signature moment: the lock declares none (a lock written before signature moments counts; add one with `design-lock.mjs moment`); no visible `[data-ui-moment]`; the marked kind differs from the lock; it is smaller than 40 000 px² (bold) or 4 800 px² (small); a read-once page's moment starts below the first screen at 1024 px and wider (more than 120 px short of the fold) or past 1.5 screens on narrower viewports; it lacks what its kind needs (section 6); or it is a generic gradient-and-centred-text hero. Two marked moments, and a work-surface moment over half the screen at 1024 px and wider, are MEDIUM. Fold and size-share checks run on the base rows | HIGH |

A lock with `offset` elevation is also the recorded neo-brutalist register CF-403 asks for, so the
probe clears CF-403 on a neo-brutalism page; on any other lock a hard offset shadow is still CF-403.

Media, `img`, `video`, `canvas`, `iframe` and anything inside `[data-lock-exempt]` are skipped. Use
the exemption only for third-party embeds and real brand marks, and say so in the reply.

Thresholds live in `scripts/interface-probe-rules.mjs` like every other rule. Never widen a
tolerance or add an exemption to make a page pass; change the page.

## 4. Look, then fix

After the rule table, a rendered probe run prints the paths of the 1440, 390 and 320 screenshots
and six fixed questions (LOOK-1 to LOOK-6: one focal point, shared edges, grouping by space, kit not
costume, composed mobile, specific content). Open the screenshots, answer each question in one line,
fix the two worst answers, and run the probe again. Stop after two look rounds; keep the better
version if a round made it worse. The questions are concrete on purpose: a reviewer, human or
model, agrees with itself on "do the sections share a left edge" far more often than on "is it
beautiful".

## 5. Accent art by style

The landing starter's art slot takes the locked style's art; work surfaces keep at most a small mark.

| Style | Accent art |
|---|---|
| `field-notes` | The pixel motif below |
| `graphite`, `meadow` | A real product view set on a `ui-wash` or between `ui-band` sections, with the second accent on the featured panel |
| `computational-brutalism` | Instrument parts on real content: a `ui-frame` around the product view or a key figure, `ui-coord` labels that name real positions, sizes or revisions, one `ui-ruler`, `data-coord` on each section (sheet, grid reference or revision, not 01/02/03), a `ui-prompt--cursor` line, and `ui-readout ui-scan` wells on the readouts that carry real values. No made-up telemetry: every number labels something on the page |
| `neo-brutalism` | `ui-sticker` labels with real facts (price, launch date, a count), never over body text, and colour blocks in all three fills (`ui-panel--accent`, `ui-panel--accent-2`, `ui-panel--support`) |

### Pixel motif (field-notes)

On read-once pages the field-notes hero carries an original pixel motif of the product's subject.
Draw it as a character grid and convert it, rather than hand-placing rectangles:

```bash
node "$FRONTEND_UIUX_SKILL_ROOT/scripts/pixel-art.mjs" motif.txt --label "<what it shows>" --cell 12
```

Characters map to palette roles (`i` ink, `a` accent, `b` second accent, `m` support, `s` sunken, `p` surface,
`c` canvas, `l` line-strong, `2` ink-2, `.` empty), so the motif follows dark mode and stays inside
the lock. Keep it recognisable: a scene of the product's subject, 20 to 64 cells wide, hard edges, as
many roles as the subject needs, the accent on the one detail that matters. Cells render at 6 px or more. On a
work surface the motif is at most a small mark beside the product name.

## 6. Signature moment

The lock makes runs agree on the look. The signature moment is the one place a page is allowed to be
bold, so a locked page still has something that makes a person stop. Choose it from the content before
writing markup, record it in the lock, mark it in the page, and let the probe check it (DS-008).

1. Record it: `init … --moment <kind> --moment-note "<what it shows>" [--moment-place "<where>"]`, or
   later `design-lock.mjs moment --dir <project> --kind <kind> --note "<what it shows>"`. Until a kind
   is recorded the probe fails every render.
2. Mark the one element that carries it: `data-ui-moment="<kind>"`.
3. Build it from this page's content, inside the lock: palette roles, the kit's type, radii and
   elevation. The moment may use `--fs-moment` (`ui-setpiece`, `ui-bignum`) up to the lock's moment
   ceiling; DS-004 accepts that size only inside `[data-ui-moment]`.

| Family | Scale | Kinds | Where |
|---|---|---|---|
| `landing` (landing, product, launch, portfolio, docs home, report) | bold | `hero-composition`, `type-set-piece`, `data-moment`, `diagram`, `motion-detail`, `interactive-object` | Starts in the first screen at 1024 px and wider, within 1.5 screens on phones |
| `workspace`, `settings` | small | `chart`, `empty-state`, `header-detail` | Anywhere; under half the screen at desktop widths. The data stays the focus |

| Kind | What it is | DS-008 needs inside it |
|---|---|---|
| `hero-composition` | The hero arranged around the product's one concrete object: the invoice, the truck, the score, drawn or built from kit parts at a size that dominates the first screen (`ui-hero--stage`) | An image, drawing, figure, frame or product view |
| `type-set-piece` | The pitch set as type: a short line at moment size with the accent on the one word that matters, aligned to the grid, never centred over a gradient | Text at display size or above |
| `data-moment` | One real number or small dataset made big: a `ui-bignum` with its unit and source, a chart that answers the page's question | A chart, table, figure or readout |
| `diagram` | The product's process or structure drawn once, clearly: inputs, the step the product does, the result | An image, drawing or figure |
| `motion-detail` | One movement that explains something (a figure counting up to its real value, a step sequence), short, in the style's durations, stopped under reduced motion (RS-003) | An animation or transition (not checked on the reduced-motion row) |
| `interactive-object` | Something to try on the page: a fee calculator, a toggle between before and after, a slider on a real variable | A control a reader can operate |
| `chart` | The work surface's main chart, with one annotated marker that names the event a person acts on | A chart, table or readout |
| `empty-state` | The empty state drawn with care: a small mark from the style, one sentence, the next action | Nothing beyond presence |
| `header-detail` | The page header's one detail: the product mark, a live status, the plan or period, set with care | Nothing beyond presence |

Choose the kind from the content in this order: the one object or number the reader cares about
(`data-moment`, `hero-composition`); a process they must grasp (`diagram`); words that carry the
pitch (`type-set-piece`); something worth trying (`interactive-object`); `motion-detail` only when
movement is the point. State the choice and the note in the reply.

Moments by style:

| Style | A moment that belongs to it |
|---|---|
| `field-notes` | A pixel scene of the product's subject filling the art column (`ui-hero--stage`, cells of 10 to 16 px, the accent on the one detail that matters), or a `ui-setpiece` line in the editorial display with a small pixel mark |
| `graphite`, `meadow` | On a landing page, the real product view at full size with one live state shown (`ui-panel` parts, `UI.bars`); on a work surface, the main chart with its annotated marker |
| `computational-brutalism` | An instrument plate on the plot grid: a `ui-frame` holding a `ui-bignum` readout in mono at moment size, a `ui-ruler` and `ui-coord` labels that measure real values, one `ui-scan`; or a heavy uppercase `ui-setpiece` that spans the grid columns |
| `neo-brutalism` | A stacked block composition: the product object in a `ui-panel--accent` with its offset shadow, more blocks in `ui-panel--accent-2` and `ui-panel--support`, `ui-sticker` labels with real facts, chunky `ui-setpiece` type |

Never, in a moment or anywhere: a centred headline over a gradient (DS-008 reports it as a generic
hero), scattered floating blobs, glass, a stock 3D object, a fake dashboard with invented numbers, or
a second moment competing with the first. Everything outside the moment stays inside the kit and, in
the default rich register, may be layered: bands, a wash, the style's texture, the second accent and
an atmosphere glow.
