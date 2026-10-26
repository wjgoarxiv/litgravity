// The "P&ID symbols and abbreviations" sheet a drawing set opens with, built from the library
// itself so it can never drift from what the kit draws: every line class, equipment, valve,
// actuator, relief device, piping item and flow element, the ISA-5.1 instrument shape and
// location matrix, the identification letters, fail positions, line-number format and
// equipment prefixes, on one sheet with the usual frame and title block.

import { EQUIPMENT_CLASS, FUNCTION_MODIFIER, MEASURED, OUTPUT, READOUT, VARIABLE_MODIFIER } from "./isa.mjs";
import { FAIL_POSITIONS, FUNCTIONS, LOCATIONS, describeKind } from "./pid.mjs";
import { LINE_KINDS, createSheet, legendGlyph, legendLine } from "./sheet.mjs";
import { el, esc, textWidthEm } from "./svg.mjs";
import { FONT_LATIN, PID } from "./theme.mjs";

const SYMBOL_GROUPS = Object.freeze([
  ["EQUIPMENT", [
    "vessel.vertical", "vessel.horizontal", "vessel.jacketed", "vessel.reactor", "vessel.column", "vessel.tank", "gas.cylinder",
    "pump.centrifugal", "pump.positive", "pump.metering", "compressor.centrifugal", "compressor.reciprocating",
    "exchanger.general", "exchanger.shelltube", "exchanger.floating", "exchanger.utube", "exchanger.plate", "exchanger.aircooler",
    "package.unit", "drive.motor",
  ]],
  ["VALVES", [
    "valve.gate", "valve.globe", "valve.ball", "valve.butterfly", "valve.plug", "valve.needle", "valve.diaphragm",
    "valve.check", "valve.threeway", "valve.angle",
  ]],
  ["ACTUATORS (SHOWN ON A GLOBE BODY)", [
    "valve.globe.diaphragm", "valve.globe.piston", "valve.globe.motor", "valve.globe.solenoid", "valve.globe.hand",
  ]],
  ["SELF-ACTING AND RELIEF DEVICES", ["valve.regulator", "valve.backpressure", "valve.safety", "relief.rupture"]],
  ["PIPING ITEMS", ["line.reducer", "line.reducer-eccentric", "line.flange", "line.blind", "line.blind-open", "line.filter", "line.sightglass"]],
  ["FLOW ELEMENTS", ["flow.orifice", "flow.venturi", "flow.magnetic", "flow.coriolis", "flow.vortex", "flow.turbine", "flow.ultrasonic", "flow.thermal", "flow.rotameter", "flow.mfc"]],
  ["CONNECTIONS AND LOGIC", ["terminal.offpage", "terminal.utility", "terminal.vent", "terminal.drain", "terminal.sample", "logic.interlock"]],
]);

const LOCATION_HEADS = Object.freeze({ field: ["Field"], main: ["Main", "room"], "main-rear": ["Main,", "behind"], aux: ["Local", "panel"], "aux-rear": ["Local,", "behind"] });
const FUNCTION_HEADS = Object.freeze({ discrete: "Discrete", shared: "Shared (DCS)", computer: "Computer", plc: "PLC / SIS" });

export function createLegendSheet({
  size = "A2", title = "P&ID symbols and abbreviations", number = "LEG-001", rev = "0", date = "", scale = "NTS",
  project = "", owner = "", drawn = "", checked = "", approved = "", sheet = "1 OF 1",
} = {}) {
  const notes = [
    "Instrument shapes, location lines, signal lines, actuators and identification letters after ANSI/ISA-5.1-2009 (Tables 4.1, 5.1.1, 5.2.2, 5.3.1, 5.3.2, 5.4.1 to 5.4.4).",
    "Equipment, valve and piping symbols after ISO 10628-2:2012 (Table 2 subject groups) and common US practice (PIP PIC001).",
    "A symbol drawn on a P&ID of this set without a row on this sheet is defined in the legend column of that P&ID.",
  ];
  const s = createSheet({ mode: "pid", size, title, number, rev, date, scale, project, owner, drawn, checked, approved, sheet, notes, legendColumn: false, headerBand: false });
  const [x0, y0, x1, y1] = s.drawing;
  const small = PID.text.small;
  const head = PID.text.label;
  const gutter = 8;
  const columns = 5;
  const colW = (x1 - x0 - gutter * (columns - 1)) / columns;
  const text = (x, ty, content, sz = small, extra = {}) => el("text", { x, y: ty, "font-family": FONT_LATIN, "font-size": sz, fill: PID.ink, "data-label": "legend", ...extra }, esc(content));
  const wrap = (content, width) => {
    const words = content.split(/\s+/u);
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && textWidthEm(next) * small > width) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };

  // First collect sections of rows (each row knows its height and draws at a given x and top),
  // then lay them out in columns: a section that fits in one column is never split; a longer
  // one continues in the next column under a "(cont.)" heading.
  const sections = [];
  const section = (title) => { const sec = { title, rows: [] }; sections.push(sec); return sec; };
  const sampleRow = (sec, key, draw, label, sampleHeight = 4) => {
    const lines = wrap(label, colW - 22);
    const h = Math.max(7.4, sampleHeight + 2.6, lines.length * 2.6 + 2.2);
    sec.rows.push({ h, draw: (x, top) => {
      const cy = top + h / 2;
      return el("g", { "data-legend-item": key }, draw(x, cy), lines.map((t, i) => text(x + 20, cy + 0.8 + (i - (lines.length - 1) / 2) * 2.6, t)));
    } });
  };
  const pairRow = (sec, key, code, meaning, indent = 7) => {
    sec.rows.push({ h: 3.3, draw: (x, top) => el("g", { "data-legend-item": key }, text(x, top + 2.6, code, small, { "font-weight": "bold" }), text(x + indent, top + 2.6, meaning)) });
  };

  const lineSection = section("LINES");
  for (const kind of Object.keys(LINE_KINDS).filter((k) => k !== "stream")) {
    sampleRow(lineSection, `line:${kind}`, (x, cy) => legendLine(kind, x + 1, x + 16, cy), LINE_KINDS[kind].label, 3);
  }
  for (const [name, kinds] of SYMBOL_GROUPS) {
    const sec = section(name);
    for (const kind of kinds) {
      const probe = legendGlyph(kind, 0, 0, { maxW: 16, maxH: 11 });
      sampleRow(sec, kind, (x, cy) => legendGlyph(kind, x + 8.5, cy, { maxW: 16, maxH: 11 }).svg, describeKind(kind), probe.h);
    }
  }

  // ISA-5.1 Table 5.1.1 as a matrix: function down the side, location across the top.
  const matrix = section("INSTRUMENT SHAPE AND LOCATION");
  const cell = Math.min(16, (colW - 24) / 5);
  const labelW = colW - cell * 5;
  matrix.rows.push({ h: small * 2 + 3 + Object.keys(FUNCTIONS).length * 10, draw: (gx, top) => {
    const out = [];
    Object.values(LOCATION_HEADS).forEach((heads, j) => {
      heads.forEach((t, i) => out.push(text(gx + labelW + cell * j + cell / 2, top + small + i * (small + 0.6), t, small, { "text-anchor": "middle" })));
    });
    Object.keys(FUNCTIONS).forEach((fn, i) => {
      const cy = top + small * 2 + 3 + i * 10 + 5;
      out.push(text(gx, cy + 0.8, FUNCTION_HEADS[fn]));
      Object.keys(LOCATIONS).forEach((loc, j) => {
        const kind = `instrument.${fn}-${loc}`;
        out.push(el("g", { "data-legend-item": kind }, legendGlyph(kind, gx + labelW + cell * j + cell / 2, cy).svg));
      });
    });
    return out.join("");
  } });

  // ISA-5.1 Table 4.1, one list per letter position.
  for (const [key, title, entries] of [
    ["letters", "FIRST LETTER: MEASURED OR INITIATING VARIABLE", MEASURED],
    ["modifier", "VARIABLE MODIFIERS (SECOND LETTER)", VARIABLE_MODIFIER],
    ["readout", "READOUT OR PASSIVE FUNCTION", READOUT],
    ["output", "OUTPUT FUNCTION", OUTPUT],
    ["function-modifier", "FUNCTION MODIFIERS", FUNCTION_MODIFIER],
  ]) {
    const sec = section(title);
    for (const [letter, meaning] of Object.entries(entries)) pairRow(sec, `${key}:${letter}`, letter, meaning);
  }
  const fail = section("FAIL POSITION OF ACTUATED VALVES");
  for (const [code, meaning] of Object.entries(FAIL_POSITIONS)) pairRow(fail, `fail:${code}`, code, meaning, 9);
  const lineNumber = section("LINE NUMBER");
  pairRow(lineNumber, "line-number:example", '2"-P-1001-A1A-IH', "");
  pairRow(lineNumber, "line-number:parts", "", "size - fluid code - sequence - piping class", 0);
  pairRow(lineNumber, "line-number:optional", "", "- insulation or tracing code (optional)", 0);
  const prefixes = section("EQUIPMENT TAG PREFIXES");
  for (const [code, meaning] of Object.entries(EQUIPMENT_CLASS)) pairRow(prefixes, `equipment:${code}`, code, meaning, 9);

  const out = [];
  const headH = head + 3.4;
  const colHeight = y1 - y0 - 4;
  let col = 0;
  let y = y0 + 4;
  const left = () => x0 + col * (colW + gutter);
  const nextColumn = () => {
    col++;
    y = y0 + 4;
    if (col >= columns) throw new Error(`createLegendSheet: the symbols do not fit on ${size}; use a larger sheet`);
  };
  const heading = (title) => { out.push(text(left(), y + head, title, head, { "font-weight": "bold", "data-label": "legend-title" })); y += headH; };
  for (const sec of sections) {
    const total = headH + sec.rows.reduce((sum, r) => sum + r.h, 0);
    const gap = y > y0 + 4 ? 4 : 0;
    if (y + gap + total > y1 - 1 && total <= colHeight) nextColumn();
    else if (y + gap + headH + sec.rows[0].h > y1 - 1) nextColumn();
    else y += gap;
    heading(sec.title);
    for (const r of sec.rows) {
      if (y + r.h > y1 - 1) { nextColumn(); heading(`${sec.title} (cont.)`); }
      out.push(r.draw(left(), y));
      y += r.h;
    }
  }

  s.raw(el("g", { "data-legend-sheet": "1" }, out));
  return s.render({ desc: "Legend sheet: every symbol, line class, instrument shape and abbreviation the drawings of this set use." });
}
