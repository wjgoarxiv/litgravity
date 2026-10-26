# BFD, PFD and equipment layout

ISO 10628-1 names three process diagrams that refine each other: the **block flow diagram** (units as boxes and the main streams), the **process flow diagram** (equipment, main streams with numbers, operating conditions, a stream table, the control loops that define the process), and the **P&ID** (every line, valve, instrument and safety device). Pick the lightest one that answers the reader's question.

## Contents
1. Which diagram
2. Block flow diagram
3. Process flow diagram
4. Stream table
5. Equipment layout and plot plan
6. Faults

## 1. Which diagram

| Reader's question | Diagram | Mode |
| --- | --- | --- |
| What are the units and how does material move between them? | BFD | `pfd` with `unit()` boxes |
| What equipment, at what conditions, with what mass balance? | PFD | `pfd` |
| How is it built, controlled, isolated and protected? | P&ID | `pid` |
| How is it arranged in space, and what does it look like? | Layout or isometric | `pfd` sheet in plan, or `iso` |
| What did the experiment use? (paper) | Apparatus figure | `journal` |

A BFD drawn with real equipment symbols, or a PFD drawn with every isolation valve, answers the wrong question and costs the reader time.

## 2. Block flow diagram

Units are labelled boxes (`unit({ caption: "Hydrate formation" })`) of one size per level of importance, arranged left to right in process order; streams are `pipe` lines with arrows and short names (`"Feed gas, 5 MPa"` as a line number); recycles return along the bottom lane; utilities stay off the diagram unless they are the point. Use `createSheet({ mode: "pfd" })` and `streamNumber(line, n)` when a mass balance accompanies it.

## 3. Process flow diagram

- **Equipment**: every major item with its tag and name in the header band, drawn with the same symbols as the P&ID; spares (`P-101B`) and minor items stay off.
- **Streams**: main process lines, heavy; each carries a **stream number** in a diamond (`sheet.streamNumber(line, 3)`), numbered in flow order. The stream number is the key into the stream table.
- **Conditions**: pressure and temperature flags at key points as short texts beside the line (`sheet.text(x, y, "5.0 MPa, 2 °C")`), or only in the table.
- **Control**: the loops that define the process (reactor pressure, jacket temperature, level), with their controllers and final elements; no isolation valves, drains or vents.
- **Utilities**: heating and cooling media as short utility lines into exchangers, labelled with the medium.

## 4. Stream table

`streamTable({ box: [x0, y0, x1], streams: [1, 2, 3], rows: [{ label: "Pressure (MPa)", values: [0.1, 5.0, 5.0] }, …] })` draws one column per stream and one row per property inside the box and returns its bottom. Usual rows: phase, temperature, pressure, total mass flow, molar flow, composition of the key components. Put it below the drawing or across the bottom of the sheet; values come from the user's balance or simulation (HYSYS, Aspen, a spreadsheet), never from estimation without saying so. Units go in the row label, never in the cells.

## 5. Equipment layout and plot plan

A plan view is a PFD-style canvas drawn to scale: `createSheet({ scale: "1:50" })` and coordinates in sheet millimetres = real millimetres ÷ 50. Equipment outlines are their real footprints (`unit` boxes for skids and packages, plain circles added with `canvas.raw()` for vessels seen from above), with aisles at least 1 m real, maintenance envelopes dashed (`zone`), and north arrow and grid lines when the site needs them. For a three-dimensional impression of the same arrangement use an isometric view (`references/isometric-craft.md`): boxes for skids, lathes for vessels, pipes along racks.

## 6. Faults

| You see | Fix |
| --- | --- |
| A PFD full of block valves and drains | Remove them; they belong to the P&ID. |
| Stream numbers that skip or jump around | Number in flow order; recycles take the next free number. |
| A stream table without units | Units in the row labels. |
| Values that do not close the balance | Take them from the user's balance or say they are illustrative. |
| A BFD with equipment symbols | Use labelled boxes; the BFD is about units, not hardware. |
