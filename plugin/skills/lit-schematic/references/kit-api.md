# Kit API

Every kit drawing is authored in **millimetres at final print size**: the SVG root carries `width="…mm"`, `height="…mm"` and a viewBox in the same numbers, so a stroke of `0.35` is 0.35 mm on paper and a font size of `2.47` is 7 pt. Import modules from `$SKILL_ROOT/scripts/lib/` (the scaffold writes absolute `file://` imports for you).

## Contents
1. Sheets and canvases (`sheet.mjs`)
2. Symbols (`pid.mjs`)
3. Routing (`route.mjs`)
4. Journal figures (`figure.mjs`)
5. Isometric views (`iso.mjs`)
6. Tags (`isa.mjs`), theme (`theme.mjs`), helpers
7. QA and render from code
8. Legend sheet (`legend-sheet.mjs`)
9. Interactive page (`interactive.mjs`) and motion loop (`scripts/motion.mjs`)

## 1. Sheets and canvases (`sheet.mjs`)

### `createSheet(options)` → sheet
An ISO sheet with a zone frame, an equipment header band, a legend column, a notes block and a title block. Options: `mode` (`"pid"` | `"pfd"`), `size` (`"A4"`, `"A3"` default, `"A2"`, `"A1"`, or `[w, h]` mm), `title` (required), `subtitle`, `number`, `rev`, `date`, `scale` (`"NTS"` default), `sheet` (`"1 OF 1"`), `project`, `owner`, `drawn`, `checked`, `approved`, `notes` (array of strings, numbered), `lang`, `legendTitle`, `legendColumn` (default `true`), `headerBand` (default `true`). When the legend column would overflow, the instrument identification letters move to the right half of the notes block; if it still overflows, `sheet.warnings` says so.

The drawing area on A3 is about `[24, 39, 342, 246]`; read `sheet.drawing` for the exact box. Place every symbol inside it. A sheet has every canvas method below plus:

| Method | Does |
| --- | --- |
| `sheet.equipmentInfo(sym, lines)` | Adds the symbol's tag, name and spec lines to the header band above it (columns de-overlap themselves). |
| `sheet.render({ desc })` | The finished SVG string (`data-schematic-mode` is the sheet's mode). |
| `sheet.warnings` | Placement problems the build could not solve (a label with no clear place, a symbol outside the canvas, a legend that overflows). Print them; QA will fail on the same defects. |

### `createCanvas({ box, style, grid, clearance, stub, labelSize })` → canvas
A routed drawing area in a sheet or a journal panel. `style` is `"pid"` (black ink, ISA line weights) or `"journal"` (stream colours, names instead of tags, 7 pt labels, a 1 mm routing grid).

| Method | Does |
| --- | --- |
| `add(sym)` | Places a symbol; warns when it overlaps another or leaves the canvas. Returns the symbol. |
| `pipe({ from, to, via, points, kind, number, arrows })` | A process line. `kind`: `process-major` (default, 0.7 mm), `process-minor` (0.5), `utility` (0.35); every class has its own weight. `from`/`to` are ports or taps. With no `points` it is routed; `via` adds waypoints; `points` gives every corner yourself (checked orthogonal, first and last legs on the port normals). `number` places the line number on the longest clear straight. `arrows`: `"auto"`, `false`, or fractions `[0.3, 0.8]`. |
| `signal({ from, to, type })` | An instrument signal (ISA-5.1 Table 5.3.2): `type` `electric` (dashed, default), `pneumatic` (double slashes), `hydraulic` (L marks), `capillary` (crosses), `guided` (sine wave), `unguided` (broken sine wave), `data` (open circles; `software` is the same), `mechanical` (filled dots). Run a controller output to `valve.port("actuator")`. |
| `connect({ from, to })` | Instrument supply or process connection (0.18 mm thin solid impulse line). |
| `stream({ from, to, role, via })` | Journal stream line in the colour of `role` (`gas`, `liquid`, `coolant`, `heating`, `vent`, `signal`, `sample`, `vacuum`). |
| `inline(line, factory, options)` | Puts a valve, element or filter on the line at `options.at` (fraction, or a point near the line) and gaps the line under it. It snaps to the nearest straight run long enough; it throws when none is. Returns the symbol. |
| `line.tap(at)` | A branch point on a line (fraction, arc length, or a point within 1 mm of the line, and at least 3 mm from a bend). The port normal points to the line's left; `.flip()` gives the other side. A junction dot is drawn. |
| `line.at(fraction)` | `{ point, direction }` along the routed line. |
| `zone(box, name)` | A dashed enclosure (oven, cold box, skid boundary) with its name inside the top-left corner; lines may cross it, labels avoid it. |
| `streamNumber(line, n, { at })` | PFD stream number diamond on a straight run. |
| `streamTable({ box: [x0, y0, x1], streams, rows: [{ label, values }] })` | A stream table; returns its bottom y. |
| `text(x, y, text, { size, anchor, bold, color, kind })` | A fixed label that routes and later labels avoid. |
| `render()` | The canvas group. |

## 2. Symbols (`pid.mjs`)

Every factory takes `x, y` (the centre unless noted) in sheet mm and returns a symbol with `kind`, `tag`, `box`, `boxes`, `port(name[, t])`. Equipment tags must parse as `R-101`, `P-101A`, `TK-101`, …; instrument tags as ISA-5.1 (`PIC-101`). A bad tag throws.

| Factory | Kind(s) | Ports |
| --- | --- | --- |
| `vessel({ w, h, top, bottom, jacket, agitator, coil, packing, trays, demister, supports, liquid, tag, name })` | `vessel.vertical`, `.reactor`, `.jacketed`, `.column` | `top`, `bottom`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, `jacket-in`, `jacket-out`, and `port("left" \| "right", t)` along the straight shell (t 0 top tangent → 1 bottom tangent), `port("top" \| "bottom", t)` across a head |
| `reactor(o)`, `column(o)`, `tank(o)` | jacketed stirred reactor; column with trays; cone-roof tank | as `vessel` |
| `drum({ w, h, saddles })` | `vessel.horizontal` | `left`, `right`, `port("top" \| "bottom", t)` |
| `gasCylinder({ w, h })` | `gas.cylinder` | `outlet` (up) |
| `pump({ r, type, facing })` | `pump.centrifugal`, `.positive`, `.metering` | `suction`, `discharge`, `signal` (stroke or speed input, bottom) |
| `compressor({ r, type, facing })` | `compressor.centrifugal`, `.reciprocating` (also a gas booster) | `inlet`, `outlet`, `drive` |
| `motor({ r })` | `drive.motor` | `shaft`, `left`, `right`, `bottom` |
| `exchanger({ r })` | `exchanger.general` | `tube-in`, `tube-out`, `shell-in`, `shell-out` |
| `shellTube({ w, h, type })` | `exchanger.shelltube` (`type: "fixed"`, default), `exchanger.floating`, `exchanger.utube` | `tube-in`, `tube-out`, `shell-in`, `shell-out` |
| `plateExchanger({ w, h })` | `exchanger.plate` (ISO 10628-2 item 3.6) | `hot-in`, `hot-out`, `cold-in`, `cold-out` |
| `airCooler({ w, h })` | `exchanger.aircooler` | `in`, `out` |
| `unit({ w, h, caption, glyph, ports })` | `package.unit` (chiller, circulator, analyser, DAQ, booster skid) | as declared: `ports: { supply: ["right", 0.3] }`; also `port(side, t)` |
| `valve({ type, orient, actuator, fail, tag })` | `valve.gate`, `.globe`, `.ball`, `.butterfly`, `.check`, `.needle`, `.plug`, `.diaphragm`, `.threeway`; with `actuator` (`diaphragm`, `piston`, `motor`, `solenoid`, `hand`) the kind is `valve.<type>.<actuator>`; `fail` is `FO`, `FC`, `FL` or `FI` | `a`, `b` (and `c` on a three-way), `actuator` when actuated |
| `angleValve({ inlet, outlet, actuator, fail, tag })` | `valve.angle`, `valve.angle.<actuator>` | `inlet`, `outlet` on two perpendicular sides, `actuator` |
| `regulator({ backPressure })` | `valve.regulator`, `valve.backpressure` | `a`, `b` |
| `safetyValve({ outlet, setPressure, tag })` | `valve.safety` | `inlet` (from below), `outlet` (side) |
| `ruptureDisk`, `orifice`, `rotameter`, `mfc`, `filter`, `reducer({ eccentric, flat })`, `flange`, `sightGlass`, `blind({ state })` | `relief.rupture`, `flow.orifice`, `flow.rotameter`, `flow.mfc` (+ `signal`), `line.filter`, `line.reducer`, `line.reducer-eccentric`, `line.flange`, `line.sightglass`, `line.blind`, `line.blind-open` | `a`, `b` |
| `flowElement({ type })` | `flow.orifice`, `flow.venturi`, `flow.magnetic`, `.coriolis`, `.vortex`, `.turbine`, `.ultrasonic`, `.thermal` | `a`, `b` |
| `instrument({ tag, fn, location, r })` | `instrument.<fn>-<location>`: `fn` `discrete` (default), `shared`, `computer`, `plc`; `location` `field` (default), `main`, `main-rear`, `aux`, `aux-rear` (round-1 names `dcs`, `plc`, `panel`, `panel-rear`, `local-panel` still work) | `top`, `bottom`, `left`, `right` |
| `interlock({ text })` | `logic.interlock` | `top`, `bottom`, `left`, `right` |
| `vent({ text })`, `drain({ text })`, `samplePoint({ text, facing })` | `terminal.vent`, `terminal.drain`, `terminal.sample` | `in` |
| `offPage({ text, pointing })`, `utility({ text, pointing })` | `terminal.offpage`, `terminal.utility` | `in`, `out` |

Inline factories take `orient` (`right`, `left`, `up`, `down`); `sheet.inline` sets it from the line. A symbol on a line running left is mirrored, not turned over, so an actuator still stands above the line; letters on an inline symbol (fail positions) always read upright, and on a vertical line they sit beside the body opposite the actuator. A later process line that crosses an earlier one hops it; the gate accepts the hop. `describeKind(kind, { short })` gives the legend text for every kind, including composed ones; `KIND_DESCRIPTIONS`, `ACTUATORS`, `FUNCTIONS`, `LOCATIONS` and `FAIL_POSITIONS` hold the parts.

## 3. Routing (`route.mjs`)

`routeOrthogonal({ from, to, obstacles, lines, bounds, grid, clearance, stub, bendCost, crossCost, nearCost, exempt })` returns corner points. It leaves each port along its normal far enough to clear every symbol's clearance zone, never enters an inflated symbol box, never runs along or turns on an existing line, crosses existing lines only at right angles (with a cost), and minimises length plus bends. Two ports that face each other on one axis join straight. It throws when no route exists. `orthogonal(points, { from, to })` validates a hand-given polyline.

## 4. Journal figures (`figure.mjs`)

`createFigure({ width, height, title, desc, lang, mode, labelStyle, textPt })`: `width` is `"single"` (85 mm), `"onehalf"` (120), `"double"` (178) or a number; `height` ≤ 230 mm; `labelStyle` `"paren"` → (a), `"bold"` → a, `"upper"` → A.

| Method | Does |
| --- | --- |
| `fig.panel(label, [x, y, w, h])` | A panel with its label at the top left (`label` `null` for a single-panel figure without a label). |
| `panel.canvas({ box })` | A journal-style canvas inside the panel (default box: below the label). |
| `panel.iso(view, { box, labelColumn, calloutSize })` | Fits an isometric view and its callouts into the panel. |
| `panel.text(x, y, text, options)`, `panel.raw(svg)` | Extra content. |
| `fig.key(roles, [x, y], { columns, colWidth })` | Stream-colour key; QA requires every role drawn to be in it. |
| `fig.render()` | The SVG (`data-min-text-pt="6"`). |

## 5. Isometric views (`iso.mjs`)

`createIsoView({ azimuth = 45, elevation = 30, light })`. World units are the object's own millimetres, x and y on the floor, z up. Nothing is projected until `fit`.

| Function | Does |
| --- | --- |
| `lathe({ name, origin, axis, profile, tone, steps, seams, cut, wall, layer, bias, into })` | A turned part: `profile` is `[[s, r], …]` along `axis` (`"x"`, `"y"`, `"z"`, `"-z"` or a vector) from `origin`; add a third element `1` to mark a smooth knot (no crease ring). One lathe is one convex body: build steps, flanges and nozzles as separate lathes. `seams: [s…]` draws weld rings. `cut: { from, to, span, turn }` opens a window from `s = from` to `to`, `span` degrees wide, centred on the side facing the viewer (`turn` rotates it); `wall` is the cut wall thickness. Returns a handle with `point(s, r, angle)`, `surface(s, sideDeg)`, `anchor(f, sideDeg)`, `facingAngle`, `frame`. |
| `box({ name, plan: { x, y, w, d, r }, z, h, tone, layer })`, `prism({ ring, z, h, … })` | Flat parts: pads, skids, saddles, brackets, plates. `anchor()` is the top centre. |
| `pipe({ name, points, r, tone, bend, caps, flow })` | A filleted route drawn as depth-sorted chunks with shine and shade bands; `anchor(f)` a point along it. `flow: { color, dash: [on, off], offset, width }` adds a dashed stripe whose dashes march with `offset` (screen mm), continuous across chunks. |
| `sphere({ name, center, r })`, `dots({ points, r, color })`, `polyline({ points, color, width, dash, flow })`, `boltCircle({ frame, s, radius, count })` | Balls, textures, hairlines, bolt heads. `polyline` `flow: { dash, offset, start }` in world mm marches dashes along collinear pieces of one run. |
| `extent(points)` | World points the fit keeps in frame although nothing is drawn there: where exploded or moving parts go, so every frame and every page state shares one scale. |
| `halo({ plan, z })` | Soft ground shadow (layer −2). |
| `callout({ part, at, text, side, number })` | A label in a column beside the art with a leader to a dot on `part` (its `anchor()`, or `at`). Sides are chosen to leave the art largest; leaders are reordered so none cross. |
| `fit(box, { pad, labelColumn, size })`, `render()`, `renderCallouts({ box, size })` | Used by `panel.iso`. Callout leaders are ordered so none cross and none run within 1.4 mm of another; what cannot be cleared lands in `view.warnings` (and in `fig.warnings()`). |
| `screenVector([dx, dy, dz])` | The screen offset in mm of a world move at the fitted scale: the explode vector an interactive page needs. |

Every factory also takes `group`: the assembly the part belongs to (`"shell"`, `"internals"`, `"drive"`). It is written as `data-group` around the part; interactive pages toggle and explode by it.

`createIsoView({ azimuth, elevation, light, palette })`: `palette` is `"material"` (default, full colour) or `"grey"` (opt-in quiet look); any other name throws. Material tones: `steel`, `stainless`, `frame`, `copper`, `brass`, `cast`, `concrete`, `insulation`, `rubber`, `glass` (the same in both palettes). Role tones, painted by the palette: `lo`, `mid`, `hi`, `accent` (the one part to watch), `cavity`, `section`, `liquid`, `warm`, `cool`. Layers: `-2` halo, `-1` ground, `0` everything else; `into: handle` draws a part inside a cut lathe, between its inner wall and its outer shell. Helpers: `ellipsoidalHead(R)`, `vesselProfile(R, straight, { top, bottom })`, `frameAlong(origin, axis)`, `fillet(points, radius)`.

## 6. Tags, theme, helpers

- `parseInstrumentTag(tag)` → `{ ok, letters, loop, first, modifier, functions, meaning }` or `{ ok: false, error }`; `parseEquipmentTag(tag)`; `parseLineNumber(text)` → `{ ok, size, fluid, sequence, spec, insulation }`.
- `theme.mjs`: `PID` (weights and text sizes), `JOURNAL` (widths, 7 pt text, 6 pt floor, 0.75 pt lines), `OKABE_ITO`, `STREAM` roles, `ISO` tokens, `fontFor(text)` (Arial for Latin, Pretendard for Hangul).
- `svg.mjs`: `svgDocument`, `el`, `pathOf`, `textBox`, `ptToMm`, `mmToPt`.

## 7. QA and render from code

`check(svgText, { mode, minTextPt, minStrokeMm })` from `qa-core.mjs` returns `{ verdict, fails, warnings, findings, stats }`. `renderPng`, `renderPdf`, `renderSheet`, `findChrome` from `scripts/render.mjs`; `checkExports` from `scripts/qa.mjs`.

## 8. Legend sheet (`legend-sheet.mjs`)

`createLegendSheet({ size = "A2", title, number, rev, date, scale, project, owner, drawn, checked, approved, sheet })` returns the SVG of the "P&ID symbols and abbreviations" sheet: every line class, the equipment, valves, actuators, self-acting and relief devices, piping items, flow elements, connections, the ISA-5.1 shape-and-location matrix, the identification letters by position, fail positions, the line-number form and the equipment prefixes, laid out in columns that never split a short section, with the usual frame, notes and title block. It is built from the library, so it lists exactly what the kit draws.

## 9. Interactive page (`interactive.mjs`) and motion loop (`scripts/motion.mjs`)

`renderInteractive({ title, description, lang, views: [{ id, label, svg, explode }], layers: [{ group, label }], order, duration, stagger, hint, text })` returns one self-contained HTML page: a button per preset view, an exploded-view toggle, a checkbox per layer group, callout labels that are focusable buttons, a part outline lit on hover or focus, keys `E` and `1`…`n`, `Esc` to clear, reduced motion honoured, an `aria-live` line for state changes, and `#view=…&explode=1&hide=a,b&select=C3` to open in a given state. `explode` maps each group to its screen vector in that view (`view.screenVector(worldMove)`); `order` is the order groups leave in (they come back in reverse). Build each view from the same scene function with `reach: true` style extents so the exploded parts stay on the page.

`renderMotion({ frame, out, name, seconds, fps, width, small, formats })` (or `node scripts/motion.mjs scene.mjs --out <dir>`) draws `frame(t)` for t in [0, 1), rasterises each frame in headless Chrome and writes `name.mp4` (H.264, yuv420p, even size), `name.webp` and `name.gif` (`small` px wide). It needs ffmpeg (and img2webp for WebP) and stops with `ENCODER_REQUIRED` and the install line when one is missing; it never installs anything. `examples/iso-heat-exchanger/scene.mjs` shows the pattern: one `scene({ azimuth, elevation, explode, flow, callouts, reach })` for the figure, the page and the film.
