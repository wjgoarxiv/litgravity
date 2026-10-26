# Verification

Look at the drawing the way its harshest reader will, before anyone else does. Rendering is cheap; a reviewer finding a line through a vessel costs a revision.

## Contents
1. The loop
2. The QA gate: every code and its fix
3. Render and look
4. The close-up sweep
5. Review checklist
6. Exports

## 1. The loop

1. Build → `node "$SKILL_ROOT/scripts/qa.mjs" drawing.svg`.
2. Fix every FAIL **in the build script**, rebuild, re-run QA until `QA PASS`.
3. Render (`render.mjs --png --dpi 600`) and open the PNG. Read it in the order of section 3. QA reads the SVG, never the PNG, so the renderer checks the PNG itself: it compares the ink in 36 regions against a small reference render of the same page, and a region that holds ink there but came out blank means the browser stopped painting (it happens above roughly 60 to 80 million pixels, an A2 sheet at 600 dpi). The renderer then steps the dpi down until the page arrives whole and prints `reduced from 600`; if it cannot, it stops with `RENDER_INCOMPLETE`. A reduced dpi on a large sheet is fine for reading; the PDF stays vector, and `--crop` gives any region at full resolution.
4. For anything denser than a dozen symbols or parts, render the close-up sweep (`--sheet sweep.png --grid 3x2`, or `4x3` for an A1 sheet) and read every cell.
5. Fix what the eye found, rebuild, re-run QA, re-render. Stop when QA passes and the last render shows nothing to fix.

QA is necessary, never sufficient: it reads geometry and markers, not appearance. It cannot see a leader dot on a face hidden behind another part, a nozzle standing on a cut-away shell, a misleading symbol choice, or a crowded corner that is technically clear. The look is the gate that catches those.

## 2. The QA gate: every code and its fix

`qa.mjs` parses the SVG itself (no browser), applies every transform and reads the markers the kit writes (`data-sym`, `data-box`, `data-ports`, `data-line`, `data-part`, `data-hull`, `data-leader`, `data-panel`, `data-legend-item`, `data-within`). Unmarked geometry still counts for strokes and text, so a hand-edited SVG cannot slip past by dropping markers. `--json` gives the same result as JSON; `--codes` lists the codes.

| Code | Meaning | Fix in the build |
| --- | --- | --- |
| `XML.WELLFORMED` | The SVG does not parse. | Rebuild; never hand-edit the output. |
| `XML.EXTERNAL` | It loads an outside file or URL. | Inline it or drop it. |
| `SVG.ACTIVE` | Script or event handlers. | Remove them; a schematic is static. |
| `SVG.SIZE` | No physical width/height or viewBox. | Use `createSheet` / `createFigure`, which write mm sizes. |
| `TEXT.MIN_SIZE` | Text under the floor at print size (5.6 pt on sheets, 6 pt on figures). | Spread the layout or shorten the text; never shrink it. |
| `TEXT.OVERLAP` | Two labels overlap. | Move a symbol; the placer then finds room. |
| `TEXT.ON_SYMBOL` | A label sits on a symbol it does not belong to. | Move the label's owner or the symbol. |
| `TEXT.ON_ART` | A label sits on the isometric art. | Use `callout`, which places labels beside the art. |
| `TEXT.ON_LINE` | A line runs through a label. | Re-route (`via`) or move the label's owner. |
| `TEXT.CLIPPED` | A label runs past the drawing edge. | Widen the panel or shorten the label. |
| `TEXT.OUT_OF_CELL` | Text overflows its title-block cell, legend or notes block. | Shorten it, or move to a larger sheet. |
| `LINE.THROUGH_SYMBOL` | A line passes through a symbol. | Let the router route it, add `via`, or move the symbol. |
| `LINE.DANGLING` | A line end touches no port, line or terminal. | End it on a port, a `tap`, or a vent/drain/off-page terminal. |
| `LINE.BEND_ON_LINE` | A line turns on another line. | Move the waypoint; corners on lines read as junctions. |
| `LINE.OVERLAP` | Two lines share a track. | Give one a different lane. |
| `LINE.CROSSING` (warn) | Process lines cross without a hop. | Hand-drawn lines: route through the canvas so later lines hop. |
| `LINE.ARROW_IN_SYMBOL` | A flow arrow is drawn inside a valve, instrument or other body, where it reads as part of the symbol. | Let the canvas place arrows, or give `arrows` fractions that fall on open pipe; the canvas already slides an asked-for arrow off a body and warns when it cannot. |
| `LEADER.LOOSE` | A leader does not run from its label to a dot on its named part. | Use `callout({ part })` and anchor on that part. |
| `LEADER.CROSSING` | Two leaders cross. | Reorder anchors or move one callout to the other side. |
| `LEADER.SPACING` | A leader runs within 1.2 mm (print size) of another leader or of another leader's dot, so two read as one. | Move one dot to a clearer spot on its part (another face, further along the body), or send that label to the other side. The placer already reorders labels and opens rows to separate them; what it cannot clear it lists in `fig.warnings()`. |
| `STROKE.MIN` | A stroke under 0.25 pt. | Thicken it; hairlines vanish in print. |
| `SYMBOL.NO_BOX` | A symbol group without its box. | Draw symbols with the kit factories. |
| `TAG.GRAMMAR` | A tag breaks ISA-5.1 or the equipment pattern. | See `pid-symbols.md` section 1. |
| `LINE.NUMBER` | A P&ID line number is not size-fluid-sequence-class[-insulation]. | Write it as `2"-P-1001-A1A`; see `pid-symbols.md` section 6. |
| `TAG.DUPLICATE` | Two items share a tag. | Number loops and trains uniquely. |
| `LEGEND.COVERAGE` | A sheet draws a kind the legend lacks; a figure draws a stream role its key lacks. | Let the sheet build its legend; add the role to `fig.key`. |
| `TITLEBLOCK.FIELDS` | Title, number, revision, date or scale empty. | Fill them in `createSheet`. |
| `PALETTE.CVD` | Two stream colours are too close for some reader. | Use the `STREAM` roles; never invent colours for categories. |
| `PANEL.LABELS` | Panel labels missing, out of order, unequal or misplaced. | Use `fig.panel("a", …)` in reading order. |
| `FONT.FAMILIES` (warn) | More than two families. | Arial for Latin, Pretendard for Hangul. |

## 3. Render and look

Open the PNG at a size where the whole drawing fits, then read it in this order:

1. **Lines.** Every line runs from a port to a port, a junction or a terminal; nothing passes through a body; crossings are hops at right angles on straights; no line hugs another.
2. **Labels.** Nothing on a line, a symbol or the art; every label next to its owner; tags readable.
3. **Topology.** Trace each stream from source to destination; trace each control loop from element to final element; trace each relief path to its discharge.
4. **Isometric order.** Nothing behind shows through anything in front; the ground is under everything; tubes, baffles and pipes interleave correctly.
5. **Cutaways.** Nozzles and brackets stand on closed shell; internals stay inside the wall; the cut faces read as wall thickness.
6. **Leaders.** Each dot is on the face of the part its label names and on a face the viewer can see.
7. **Detail.** At this size the drawing reads as one machine or one process; no region is bare where the real thing has parts.

## 4. The close-up sweep

`render.mjs drawing.svg --sheet sweep.png --grid 3x2` renders every region of the drawing enlarged in one image, each cell captioned with its viewBox box. Read every cell for: line ends a hair short of a port, hops that clip a junction, arrowheads on dots, text touching strokes, bolt circles that stop in mid-face, seams that miss the outline, tone steps on a curved body. To inspect one region at print resolution: `render.mjs drawing.svg --crop x,y,w,h --png close.png --dpi 1200`.

## 5. Review checklist

**Content**
- [ ] Every number on the drawing comes from the brief, or is listed in the reply as an assumption.
- [ ] Every vessel that can be over-pressured has a relief device with a discharge destination.
- [ ] Every controller has a measurement and a final element; every instrument has a process connection.
- [ ] Isolation valves on both sides of control valves and instruments where the process requires them.

**Drawing**
- [ ] `QA PASS` on the final SVG.
- [ ] Flow reads left to right; gravity is respected.
- [ ] The legend and title block are complete (sheets); the key covers every stream role (figures).
- [ ] Line weights follow the hierarchy; text sizes meet the floor at print size.

**Isometric**
- [ ] It reads as the real equipment; 40+ parts; each part in its real material colour (grey only on request), at most one accent; halo under the base.
- [ ] Painter's order correct everywhere; interleaving parts split.
- [ ] Leaders end on visible faces of their parts; none cross.

**Exports**
- [ ] PNG at 600 dpi or more, pHYs written; PDF page equals the drawing size; both opened.

## 6. Exports

`qa.mjs drawing.svg --png drawing.png --pdf drawing.pdf [--dpi 600]` adds `PNG.CLOSED` (truncated file or bad checksum), `PNG.DPI` (declared resolution under the requirement, or pixel width that does not match the drawing width at that resolution), `PDF.CLOSED` (no header or end marker) and `PDF.SIZE` (page size differs from the drawing by more than 1 mm). A sheet larger than about 16 000 px at the requested resolution is rendered at the highest resolution Chrome can capture and the render line says so; render crops for a larger print.
