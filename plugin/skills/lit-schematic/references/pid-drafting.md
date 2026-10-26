# Drafting a P&ID sheet

A P&ID is an operating document: an operator, a reviewer in a HAZOP and a commissioning engineer each read it for a different question, and each must find the answer without asking the author. Everything here serves that reading.

## Contents
1. Before drawing
2. The sheet
3. Placing equipment
4. Lines: routing, crossings, branches
5. Line numbers and flow arrows
6. Valves and isolation
7. Instruments and control loops
8. Relief and venting
9. Legend, header, notes and title block
10. Faults that reviewers catch

## 1. Before drawing

Write four lists in the build script before any coordinate:

- **Equipment**: tag, name, design pressure and temperature, size or duty. These go to the header band (`sheet.equipmentInfo(sym, ["10 MPa / -20…80 °C", "1.0 L, SS316"])`).
- **Lines**: from, to, nominal size, fluid code, sequence, piping class → the line number `1/4"-CH4-101-HP1`. State the format once in the notes.
- **Instruments**: tag, what it measures, where it reads (field, panel, DCS), what it acts on.
- **Safety devices**: each PSV and rupture disk, its set pressure, the equipment it protects, and where it discharges.

Invent nothing silently. When the brief gives no set point, choose a plausible one, keep it in the build as a named constant, and list it in the reply as an assumption.

## 2. The sheet

`createSheet({ size: "A3", … })` draws an ISO A3 landscape sheet (420 × 297 mm): a frame 20 mm from the left edge (binding) and 10 mm elsewhere, zone numbers along the top and bottom and zone letters along the sides so a reviewer can say "the PSV at C6", the equipment header band across the top, the legend column on the right, the notes block bottom left and the title block bottom right. A1 and A2 work the same way for dense units; A4 suits a small skid.

Text at 1:1 on A3: tags 2.5 mm, equipment tags 3.0 mm bold, line numbers and notes 2.2 mm, title 4 mm. Nothing under 2.0 mm, because sheets are photocopied and reduced; the QA floor for P&ID sheets is 5.6 pt.

Line weights carry the hierarchy on the ISO 128 series, and every pipe class has its own: main process 0.7 mm, minor process 0.5 mm, utility 0.35 mm, instrument supply or process connection 0.18 mm; equipment outlines 0.5 mm, symbols 0.35 mm, signals 0.25 mm with the mark of their medium, tangent lines and details 0.18 mm. Pick the class by what the line carries, not by how it looks: a 2-inch cooling-water header is a utility line however big it is.

## 3. Placing equipment

- **Flow runs left to right.** Feed and utilities enter on the left, products and vents leave on the right or top. The main process route reads as one horizontal story.
- **Gravity is real.** Pumps sit below and near their suction vessel; drains go down; vents and relief discharge go up. A tank's outlet nozzle is at its bottom.
- **Equal elevations for related items.** Put duty and standby pumps one above the other with the same spacing; line up instruments of one loop.
- **Room for lines.** Keep 15–25 mm between symbols that exchange several lines, and leave free horizontal lanes for headers and a lane below the equipment for signal runs to the DCS.
- **Instruments sit next to what they measure,** offset 10–15 mm from the line or nozzle, with a short connection. Controllers and DCS bubbles go between the measurement and the final element, toward the top or the bottom lane, so signal lines do not cross the process.
- **Symbols never overlap.** The canvas warns, and the router cannot pass between symbols closer than twice the clearance (2.2 mm each side on a sheet).

## 4. Lines: routing, crossings, branches

The router follows the drafting rules a checker applies to a hand-drawn sheet:

1. **Leave a port on its normal.** A line leaves a nozzle straight out (up from a top nozzle, sideways from a side nozzle) before it turns, so the reader sees where it starts.
2. **Never through a symbol.** A route enters a symbol only at its own port. When there is no way around, the build throws: move a symbol or give `via` waypoints. Never draw the line by hand through it; `LINE.THROUGH_SYMBOL` fails.
3. **Few bends.** Each bend costs as much as about 9 mm of straight line, so routes prefer one or two clean corners to a staircase.
4. **Cross at right angles, on straights.** A later process line hops over an earlier one (a small semicircle); signal lines cross process lines without a hop. A line never turns on top of another line (`LINE.BEND_ON_LINE`): a corner on another line reads as a junction.
5. **Never run along another line** (`LINE.OVERLAP`): two lines on one track cannot be told apart.
6. **Branches leave a straight run.** `line.tap()` refuses a point within 3 mm of a bend and draws a junction dot. A branch leaves perpendicular to the main line.
7. **Every line ends on something:** a port, another line (a junction), or a terminal (vent, drain, off-page, utility). `LINE.DANGLING` fails anything else.

Draw the main process lines first, then minor lines, then utilities, then instrument connections and signals last, so the thin lines route around the heavy ones (the same order an illustrator uses for ducts before cables).

## 5. Line numbers and flow arrows

A line number labels each line between two pieces of equipment, placed parallel to its longest clear straight, beside it, never on it. The format sits in the notes: size – fluid code – sequence – piping class (`2"-PG-101-A1A`). Fluid codes are short and listed in the legend notes when they are not obvious (`CH4`, `CO2`, `CWS`/`CWR`, `N2`, `IA`, `PW`).

Flow arrows: one on each line's longest clear straight by default, kept clear of junctions and symbols; add arrows (`arrows: [0.2, 0.8]`) where the direction is not obvious, such as at a recycle or after a three-way valve. Never arrow a signal line.

## 6. Valves and isolation

- **Every instrument, pump, control valve and relief device can be isolated.** Put a block valve on each side of a control valve, with a bypass globe or needle valve when the process must run while the control valve is out.
- **Check valves** sit on pump discharges and on any line that must never flow back (gas supply into a reactor).
- **Drains and vents** at low and high points of a liquid loop, each with a valve.
- **Double block and bleed** on high-pressure gas: two block valves with a bleed valve between, where the gas supply meets the reactor.
- **Valve on a straight run**: `inline` snaps a valve to the nearest straight run that can hold it, and throws when none can.

## 7. Instruments and control loops

A loop on the sheet: element or transmitter at the process (`PT-101` connected by a thin solid line to a nozzle or a tap), signal to the controller (`PIC-101` in the DCS, dashed for electric), signal to the final element (`PV-101` diaphragm valve, or a pump's `signal` port, or a chiller's setpoint input). Draw the whole loop on the sheet, or end it at an off-page connector naming the sheet that continues it.

Alarms and trips: put `PAH`, `PAHH`, `TAH` on the controller bubble's loop number; a trip (`PSHH-101` → interlock `I-1` → `XV-101` closes) is drawn as its own loop through an interlock diamond. Safety instrumented functions are labelled as such in the notes.

## 8. Relief and venting

Every vessel that can be over-pressured (by a gas supply, a booster, heat input, fire, or a blocked outlet) has a relief device set at or below its design pressure. Draw the PSV on the vessel or its inlet line with its set pressure beside it (`setPressure: "SET 12 MPa"`), and draw where it discharges: a vent header, a flare off-page connector or a safe vent with `ATM`. A rupture disk upstream of a PSV protects the valve from a corrosive or hydrate-forming gas; draw a pressure gauge between them to show the disk is intact. A relief path that ends in the air is the first defect a HAZOP finds.

## 9. Legend, header, notes and title block

- **Legend**: built from what the sheet draws: every line kind, every symbol kind (composed kinds such as a globe valve with a diaphragm actuator, or a DCS function in the control room, get their own row and sample), and the instrument identification letters used with their meaning. Its column is fixed; when it would overflow, the identification letters move into the right half of the notes block, and if it still overflows the sheet warns: move to a larger sheet.
- **Legend sheet**: a drawing set opens with a "P&ID symbols and abbreviations" sheet. `createLegendSheet({ number, rev, date })` builds it from the library (every symbol, line class, the ISA shape-and-location matrix, the letters, fail positions, the line-number form, the equipment prefixes); give it the set's first drawing number.
- **Equipment header**: tag, name and two or three spec lines above each major item.
- **Notes**: numbered; the line number format, the meaning of duty/standby, set-point references, hold points. Keep them to facts the drawing cannot show.
- **Title block** (ISO 7200 fields): title, drawing number, revision, sheet, project, owner, drawn/checked/approved, date, scale (`NTS` for P&IDs). `TITLEBLOCK.FIELDS` fails an empty title, number, revision, date or scale.

## 10. Faults that reviewers catch

| You see | Fix |
| --- | --- |
| A line passes behind a vessel or through a valve body | Re-route with `via`, or move the symbol; the router refuses the pass-through. |
| A branch leaves at a corner | Tap a straight run at least 3 mm from the bend. |
| A controller with no final element | Draw the output signal to the valve, pump or heater it moves, or remove the `C`. |
| An instrument floating next to a vessel | Connect it to a nozzle (`vessel.port("right", 0.4)`) or a tap. |
| PSV discharge stops in the air | Run it to a vent, header or off-page connector. |
| Two lines labelled with the same number | Number every line between two items once. |
| Tags like `TCI` or `PCIC` | Readout letters come before output letters, no repeats: `TIC`, `PIC`. |
| A dense corner where labels overlap | Spread the equipment; never shrink text under 2.0 mm. |
| The legend shows symbols not on the sheet | The kit builds the legend from the drawing; a hand-written legend drifts. |
