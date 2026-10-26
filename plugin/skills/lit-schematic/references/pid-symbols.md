# P&ID symbols and identification

The kit draws a vocabulary close to ISO 10628-2 (graphical symbols for process diagrams) for equipment and fittings, and ANSI/ISA-5.1 for instruments, their identification letters and signal lines. Conventions vary between owners and countries, so **the legend on the sheet governs**: the sheet's legend is built from the symbols and line kinds actually drawn, and the QA gate fails a sheet whose legend misses one. When a project has its own symbol standard, follow it and keep the legend true.

## Contents
1. Identification letters (ISA-5.1)
2. Instrument bubbles: what the function is and where it lives
3. Pipe classes and signal lines
4. Equipment symbols and tags
5. Valves, actuators and fail positions
6. Piping items, flow elements and terminals
7. Common tags for a high-pressure gas-hydrate loop
8. Standards basis, symbol by symbol

## 1. Identification letters (ISA-5.1)

A tag is **letters + loop number**: `PIC-101` is loop 101, pressure (P), indicating (I), controller (C). The first letter is the measured or initiating variable; an optional modifier follows it; then the functions, readout or passive ones before output ones; `H`, `L`, `M` modify the alarm or switch letter before them.

| Letter | First (measured variable) | Modifier after the first letter | Succeeding: readout / passive | Succeeding: output | Function modifier |
| --- | --- | --- | --- | --- | --- |
| A | Analysis (composition, pH, O₂) | | Alarm | | |
| B | Burner, combustion | | User's choice | | |
| C | User's choice (often conductivity) | | | Control | |
| D | User's choice (often density) | Differential | | | |
| E | Voltage | | Primary element (sensor) | | |
| F | Flow | Ratio | | | |
| G | User's choice (gauging) | | Glass, gauge, viewing | | |
| H | Hand | | | | High |
| I | Current | | Indicate | | |
| J | Power | Scan | | | |
| K | Time, schedule | Time rate of change | | Control station | |
| L | Level | | Light | | Low |
| M | User's choice (moisture) | Momentary | | | Middle |
| O | User's choice | | Orifice, restriction | | |
| P | Pressure, vacuum | | Point (test connection) | | |
| Q | Quantity | Integrate, totalise | | | |
| R | Radiation | | Record | | |
| S | Speed, frequency | Safety | | Switch | |
| T | Temperature | | | Transmit | |
| U | Multivariable | | | Multifunction | |
| V | Vibration | | | Valve, damper | |
| W | Weight, force | | Well, probe | | |
| X | Unclassified | x-axis | Unclassified | | |
| Y | Event, state | y-axis | | Relay, compute, convert | |
| Z | Position, dimension | z-axis | | Driver, actuator | |

Readable examples: `PT` pressure transmitter · `PI` local pressure gauge reading · `PIC` pressure indicating controller · `PCV` self-actuated pressure regulator · `PV` pressure control valve (final element of a PIC loop) · `PSV` pressure safety valve · `PSE` rupture disk · `PAH`/`PAHH` high and high-high pressure alarm · `PSHH` high-high pressure switch (trip) · `PDT` differential pressure transmitter · `TE` temperature element (thermocouple, RTD) · `TW` thermowell · `TT`, `TIC`, `TV` · `FT`, `FE` (orifice), `FIC`, `FV`, `FQI` totaliser · `LT`, `LG` level gauge, `LIC`, `LSL` · `AT` analyser transmitter (GC, MS, O₂) · `SC` speed controller · `HS` hand switch · `XV` on-off valve · `ZSO`/`ZSC` position switch open/closed.

`parseInstrumentTag` enforces: the first letter exists; a variable modifier only directly after it; function letters from the table, readout `I`/`R` before outputs, no repeats; `H`/`L`/`M` only after `A`, `S` or another `H`/`L`/`M`. `TAG.GRAMMAR` fails a symbol tag that breaks these, `TAG.DUPLICATE` fails two items with one tag.

**Loop numbering.** One loop number per measured point and everything that acts on it: `PT-101 → PIC-101 → PV-101`, and its alarms `PAH-101`. Number loops by unit (100s for the reactor section, 200s for the chiller) so a reader finds them.

## 2. Instrument bubbles: what the function is and where it lives

ISA-5.1 Table 5.1.1 separates two things a bubble says. Its **shape** names the kind of device or function; the **lines across it** name where it lives.

| Shape | Function | Kit `fn` |
| --- | --- | --- |
| Circle | Discrete instrument: a transmitter, gauge, switch or single-loop controller | `"discrete"` (default) |
| Circle in a square | Shared display and control: a function of the DCS or operator screen | `"shared"` |
| Hexagon | Computer function: an optimiser, a calculation outside the DCS | `"computer"` |
| Diamond in a square | PLC logic, or a safety instrumented system function | `"plc"` |

| Lines across the shape | Location | Kit `location` |
| --- | --- | --- |
| none | In the field, at the equipment | `"field"` (default) |
| one solid | Main control room, operator accessible (on the console or panel front) | `"main"` |
| one dashed | Main control room, not normally accessible (behind the panel, in a cabinet) | `"main-rear"` |
| two solid | Auxiliary or local panel near the unit, operator accessible | `"aux"` |
| two dashed | Auxiliary or local panel, not normally accessible | `"aux-rear"` |

So a DCS controller on the operator console is `instrument({ tag: "PIC-101", fn: "shared", location: "main" })`: a circle in a square with one solid line. A local pressure gauge is a plain circle. The kind is `instrument.<fn>-<location>` and the legend names both halves. The round-1 names still work: `location: "dcs"` means shared/main, `"plc"` plc/main, `"panel"` discrete/main, `"panel-rear"` discrete/main-rear, `"local-panel"` discrete/aux.

The letters sit in the upper half and the loop number in the lower half, clear of the location lines. Keep bubbles 10 mm across on an A3 sheet (`r = 5`); a 4-letter tag drops to 2.1 mm text automatically. An interlock or logic block is a diamond with its number (`interlock()`).

## 3. Pipe classes and signal lines

Pipe classes differ by **weight**, on the ISO 128 series, so they never look alike on the sheet or in the legend: main process 0.7 mm, minor process 0.5 mm, utility 0.35 mm, instrument supply or process connection 0.18 mm. Instrument signals are 0.25 mm and carry the mark of ISA-5.1 Table 5.3.2 for their medium.

| Line | Drawing | Kit |
| --- | --- | --- |
| Main process line | heavy solid, 0.7 mm | `pipe({ kind: "process-major" })` |
| Minor process line, small bore | solid, 0.5 mm | `"process-minor"` |
| Utility (cooling water, nitrogen, instrument air, steam) | solid, 0.35 mm | `"utility"` |
| Instrument supply or process connection, impulse line (Table 5.3.1) | thin solid, 0.18 mm | `connect()` |
| Electric or electronic signal (4–20 mA, discrete) | dashed | `signal({ type: "electric" })` |
| Pneumatic signal | double slashes every 6 mm | `"pneumatic"` |
| Hydraulic signal | L marks | `"hydraulic"` |
| Filled-system capillary tube | crosses | `"capillary"` |
| Guided electromagnetic or sonic signal (fibre, guided wave) | sine wave | `"guided"` |
| Unguided electromagnetic signal (radio, wireless transmitter) | broken sine wave | `"unguided"` |
| Data link within a control system (DCS bus, fieldbus segment) | small open circles | `"data"` (`"software"` still works) |
| Mechanical link (a lever, a shaft between two functions) | small filled dots | `"mechanical"` |

A signal runs from the transmitter to the controller to the final element. Every loop on the sheet ends at something that acts (a control valve, a pump's speed or stroke input, a heater, a trip), or it is an indication-only loop and has no controller letter. An actuated valve has an `actuator` port at the top of its actuator: run the controller's signal to `valve.port("actuator")`, never to the valve body.

## 4. Equipment symbols and tags

Equipment tags are a class prefix and a number, with an optional train letter: `R-101` reactor, `V-101` vessel, `TK-101` tank, `D-101` drum, `C-101` column, `E-101` exchanger, `P-101A/B` duty and standby pumps, `K-101` compressor, `BR-101` gas booster, `CH-101` chiller, `F-101` filter, `GC-101` gas cylinder, `M-101` mixer or agitator. The kit draws:

- **Vessels** (`vessel`): shell with 2:1 ellipsoidal heads (or flat or conical), tangent lines, optional jacket (`jacket-in` at the bottom, `jacket-out` at the top, so coolant flows upward), agitator with motor (turbine, anchor or propeller), internal coil, packing (a box with its diagonals, ISO 10628-2 item 2.4), trays, demister, legs or skirt, liquid level mark. Trays run across the whole shell as on a tray column (item 2.2); `trayStyle: "staggered"` draws segmental baffles that stop short of the far wall (item 2.5).
- **Machines** (`pump`, `compressor`): a centrifugal pump is a circle with a tangential discharge on a base; a rotary positive-displacement pump shows two rotors; a metering pump adds the diagonal adjustment arrow. A centrifugal compressor is a circle with converging sides; a reciprocating compressor or gas booster is a circle with a cylinder and rod.
- **Heat transfer**: a general exchanger or condenser (circle crossed by a zigzag, item 3.1); shell-and-tube with fixed tube sheets (`shellTube()`, item 3.3: shell, a tube sheet at each end, straight tubes), floating head (`type: "floating"`, item 3.4) or U-tubes (`type: "utube"`, item 3.5); plate exchanger (`plateExchanger()`, item 3.6: the pack with both diagonals and a centre line); air-cooled exchanger (`airCooler()`: bundle with its tube run, fan and motor below).
- **Packaged units**: anything with its own skid (chiller, circulator, analyser, DAQ, booster package) is a box with its caption and declared ports (`unit({ glyph: "coil" | "wave" })`).

## 5. Valves, actuators and fail positions

Valves are inline symbols on a straight run; the line is gapped under them. Bodies (ISA-5.1 Table 5.4.1, ISO 10628-2 groups 21 and 22): gate (plain bowtie), globe (bowtie with a filled dot), ball (bowtie with an open circle), plug (bowtie with a small square), butterfly (two end bars, the disc on the diagonal, a hub dot), needle (bowtie with a solid point above, for fine metering), diaphragm (bowtie under a bonnet arc), check (bowtie with the solid half pointing along the allowed flow), three-way (a third body on the branch, port `c`). An angle valve (`angleValve({ inlet, outlet })`) sits where the line turns: one body toward each port.

Actuators (Table 5.4.2) stand perpendicular to the line and name themselves in the kind, `valve.<body>.<actuator>`: `diaphragm` (spring-opposed pneumatic, the usual control valve), `piston` (cylinder), `motor` (electric, `M`), `solenoid` (on-off, `S`), `hand` (handwheel; `manual` is the same). Fail positions (Table 5.4.4) go beside the actuator as letters: `FO` fail open, `FC` fail closed, `FL` fail locked in its last position, `FI` fail indeterminate; anything else throws. Self-acting devices (Table 5.4.3): a pressure-reducing regulator (`regulator`) senses downstream through its impulse line, a back-pressure regulator (`backPressure: true`) senses upstream; a pressure safety or relief valve (`safetyValve`) has its inlet from below, outlet to the side and spring on top; a rupture disk (`ruptureDisk`) is two bars with the domed disk between them.

## 6. Piping items, flow elements and terminals

Piping items: concentric reducer (`reducer`) or eccentric reducer (`reducer({ eccentric: true, flat: "bottom" | "top" })`, flat side down on pump suctions), flange pair (`flange`), spectacle blind (`blind`, figure-8: the half in the line is solid when the line is blinded, `state: "open"` turns it to a ring), inline filter or strainer (`filter`), sight glass. Flow elements (ISA-5.1 Table 5.2.3) through `flowElement({ type })`: `orifice` (plate between flanges), `venturi` (converging-diverging throat), and notation boxes for meters without a drawn form of their own, labelled with the Table 5.2.2 notation: `magnetic` MAG, `coriolis` COR, `vortex` VOR, `turbine` TUR, `ultrasonic` US, `thermal` TMF. A variable-area meter (`rotameter`) and a mass flow controller (`mfc`, with a `signal` port) complete the set.

Terminals end a line on purpose: vent to atmosphere (`vent`, labelled `ATM` or the vent header), drain, sample point, off-page connector with the destination and drawing number, utility connection (`N2`, `IA`, `CWS`, `CWR`). A line that ends anywhere else is dangling (`LINE.DANGLING`).

**Line numbers** read `size-fluid-sequence-class[-insulation]`: `2"-P-1001-A1A`, `1/4"-CH4-101-HP1`, `DN50-CW-205-B1-IH`. On a P&ID the QA gate fails a line number that breaks this form (`LINE.NUMBER`); `parseLineNumber` reads one apart.

## 7. Common tags for a high-pressure gas-hydrate loop

A hydrate formation rig is a compact high-pressure gas loop; its P&ID usually carries these items, which the kit covers as listed:

| Item | Tag | Kit |
| --- | --- | --- |
| Gas cylinders (CH₄, CO₂, mixtures) with cylinder regulator | `GC-101`, `PCV-101` | `gasCylinder`, `regulator` |
| Gas booster raising cylinder gas to test pressure | `BR-101` | `compressor({ type: "reciprocating" })` or `unit` |
| Buffer or supply vessel | `V-101` | `vessel` |
| Jacketed stirred high-pressure reactor (sapphire windows optional) | `R-101` | `reactor` |
| Chiller or circulator on the jacket | `CH-101` | `unit({ glyph: "coil" })` |
| Reactor pressure and temperature | `PT-101`, `PI-101`, `TE-101`/`TT-101`, `TW-101` | `instrument` |
| Pressure control (supply regulator or BPR on vent) | `PIC-101`, `PV-101` | `valve({ actuator: "diaphragm" })` |
| Temperature control on the chiller | `TIC-201` → chiller setpoint | `signal` to the chiller unit |
| Relief: PSV set below the reactor's design pressure, rupture disk in series or parallel | `PSV-101`, `PSE-101` | `safetyValve`, `ruptureDisk` |
| Gas flow into the reactor | `FT-101`, `FQI-101` (consumed gas) | `instrument`, `mfc` |
| Sampling to GC | `SP-101`, `AT-101` | `samplePoint`, `instrument` |
| Vent to a safe location | `ATM` or `TO VENT HEADER` | `vent`, `offPage` |


## 8. Standards basis, symbol by symbol

Where each drawn form comes from, so a reviewer can check it against the project's own licensed copies. ISO 10628-2:2012 numbers its symbols by subject group (Table 1) and item (Table 2: group.item with an ISO 14617 registration number); ANSI/ISA-5.1-2009 groups instrument symbols in tables 4.1 and 5.1.1 to 5.4.4. Where the kit follows common US practice (PIP PIC001) rather than a numbered entry, the row says so.

| Kit kind | Basis |
| --- | --- |
| `vessel.*`, `vessel.horizontal`, `vessel.tank`, `gas.cylinder` | ISO 10628-2 group 1 (vessels and tanks): items 1.5 dished ends, 1.3 cone roof tank, 1.13 drum, 1.14 gas cylinder, 1.27 jacketed vessel |
| `vessel.column` | ISO 10628-2 group 2: 2.2 tray column (full-width trays, default), 2.4 fixed bed (packing), 2.5 staggered baffles |
| `exchanger.general`, `.shelltube`, `.floating`, `.utube`, `.plate` | ISO 10628-2 group 3: 3.1, 3.3, 3.4, 3.5, 3.6 |
| `exchanger.aircooler` | ISO 10628-2 group 3 (air cooler); drawn as bundle, fan and motor after common practice |
| `pump.*` | ISO 10628-2 group 15 (liquid pumps); centrifugal form with tangential discharge after PIP practice |
| `compressor.*` | ISO 10628-2 group 16 (compressors) |
| `valve.<body>` | ISA-5.1 Table 5.4.1; ISO 10628-2 group 21 (valves), group 22 (check valves) |
| `valve.<body>.<actuator>`, fail letters | ISA-5.1 Table 5.4.2 (actuators), Table 5.4.4 (failure and de-energised positions) |
| `valve.regulator`, `.backpressure`, `.safety`, `relief.rupture` | ISA-5.1 Table 5.4.3 (self-actuated final control elements); ISO 10628-2 group 23 (safety function) |
| `line.reducer*`, `line.flange`, `line.blind*`, `line.filter`, `line.sightglass` | ISO 10628-2 groups 24 (fittings) and 25 (piping); spectacle blind form after PIP practice |
| `flow.orifice`, `flow.venturi`, `flow.<meter>` | ISA-5.1 Table 5.2.3 (primary elements) and Table 5.2.2 (measurement notations MAG, COR, VOR, TUR, US, TMF) |
| `instrument.<fn>-<location>` | ISA-5.1 Table 5.1.1 (device and function symbols by location) |
| `logic.interlock` | ISA-5.1 binary logic (Table 5.7) as a diamond with its number |
| Pipe classes and widths | ISO 128 line-width series; ISO 10628-1 (main lines heavier than others) |
| Signal lines | ISA-5.1 Table 5.3.1 (instrument to process) and Table 5.3.2 (instrument to instrument) |
| Identification letters, tags | ISA-5.1 Table 4.1 |

The standalone legend sheet (`createLegendSheet`, `scripts/lib/legend-sheet.mjs`) prints every row of this vocabulary from the library itself, so the sheet a drawing set opens with never drifts from what the kit draws.
