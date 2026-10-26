// Worked example: P&ID of a chemical dosing skid on an A3 sheet.
// node build.mjs [out-dir]  ->  pid-dosing-skid.svg (then run scripts/qa.mjs and scripts/render.mjs)

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as S from "../../scripts/lib/pid.mjs";
import { createSheet } from "../../scripts/lib/sheet.mjs";

const out = resolve(process.argv[2] ?? ".");

const sheet = createSheet({
  size: "A3",
  title: "Sodium hypochlorite dosing skid",
  subtitle: "Piping and instrumentation diagram",
  number: "EX-PID-001",
  rev: "A",
  date: "2026-10-25",
  project: "Worked example",
  owner: "lit-schematic",
  drawn: "LS",
  notes: [
    "Line numbers read size - fluid code - sequence - piping class.",
    "Pumps P-101A/B are duty and standby; one runs at a time.",
    "PSV-101 relieves pump discharge back to TK-101 above the liquid level.",
  ],
});

// Equipment: storage tank on the left, duty/standby metering pumps stacked to its right.
const tank = sheet.add(S.tank({ x: 92, y: 150, w: 40, h: 50, tag: "TK-101", name: "Hypochlorite tank" }));
const pumpA = sheet.add(S.pump({ x: 190, y: 125, type: "metering", tag: "P-101A", name: "Dosing pump" }));
const pumpB = sheet.add(S.pump({ x: 190, y: 185, type: "metering", tag: "P-101B", name: "Dosing pump" }));
sheet.equipmentInfo(tank, ["2.5 m3, HDPE", "Atmospheric"]);
sheet.equipmentInfo(pumpA, ["0-40 L/h at 6 barg", "Duty"]);
sheet.equipmentInfo(pumpB, ["0-40 L/h at 6 barg", "Standby"]);

// Fill, vent and drain on the tank.
const fill = sheet.add(S.offPage({ x: 30, y: 72, text: "FROM UNLOADING" }));
const fillLine = sheet.pipe({ from: fill.port("out"), to: tank.port("top-left"), kind: "process-minor", number: '1"-NAOCL-101-P1' });
sheet.inline(fillLine, S.valve, { type: "ball", at: 0.6 });
const vent = sheet.add(S.vent({ x: 92, y: 100 }));
sheet.pipe({ from: tank.port("top"), to: vent.port("in"), kind: "process-minor", arrows: false });
const drain = sheet.add(S.drain({ x: 82, y: 222 }));
const drainLine = sheet.pipe({ from: tank.port("bottom", 0.3), to: drain.port("in"), kind: "process-minor", arrows: false });
sheet.inline(drainLine, S.valve, { type: "gate" });

// Suction: one main from the tank up a vertical manifold to P-101A, a branch down to P-101B.
const suction = sheet.pipe({ from: tank.port("right", 0.9), to: pumpA.port("suction"), via: [[150, 171], [150, 125]], number: '1"-NAOCL-102-P1' });
sheet.inline(suction, S.valve, { type: "ball", at: 0.12 });
sheet.inline(suction, S.filter, { at: 0.9 });
const branchB = sheet.pipe({ from: suction.tap([138, 171]), to: pumpB.port("suction"), kind: "process-minor" });
sheet.inline(branchB, S.filter, { at: 0.7 });

// Discharge: check valve on each pump into a common header that rises to the injection point.
const injection = sheet.add(S.offPage({ x: 300, y: 95, text: "TO INJECTION POINT" }));
const header = sheet.pipe({ from: pumpB.port("discharge"), to: injection.port("in"), via: [[226, 180], [226, 95]], number: '1/2"-NAOCL-103-P2' });
sheet.inline(header, S.valve, { type: "check", at: 0.06 });
const flowEl = sheet.inline(header, S.orifice, { at: [286, 95], tag: "FE-101" });
const dischargeA = sheet.pipe({ from: pumpA.port("discharge"), to: header.tap([226, 120]).flip(), kind: "process-minor" });
sheet.inline(dischargeA, S.valve, { type: "check" });

// Relief: PSV above the header, discharge back into the tank side above the liquid.
const psv = sheet.add(S.safetyValve({ x: 246, y: 76, outlet: "left", tag: "PSV-101", setPressure: "SET 8 barg" }));
sheet.pipe({ from: header.tap([246, 95]).flip(), to: psv.port("inlet"), kind: "process-minor", arrows: false });
sheet.pipe({ from: psv.port("outlet"), to: tank.port("right", 0.1), kind: "process-minor" });

// Instruments: tank level to the DCS, local discharge pressure, flow loop on the pump stroke.
const levelNozzle = tank.port("left", 0.8);
const lt = sheet.add(S.instrument({ x: 44, y: levelNozzle.y, tag: "LT-101" }));
sheet.connect({ from: levelNozzle, to: lt.port("right") });
const lia = sheet.add(S.instrument({ x: 44, y: 140, tag: "LIA-101", location: "dcs" }));
sheet.signal({ from: lt.port("top"), to: lia.port("bottom") });
const pi = sheet.add(S.instrument({ x: 266, y: 116, tag: "PI-102" }));
sheet.connect({ from: header.tap([266, 95]), to: pi.port("top") });
const ftX = flowEl.port("b").x + 4;
const ft = sheet.add(S.instrument({ x: ftX, y: 116, tag: "FT-101" }));
sheet.connect({ from: header.tap([ftX, 95]), to: ft.port("top") });
const fic = sheet.add(S.instrument({ x: ftX, y: 150, tag: "FIC-101", location: "dcs" }));
sheet.signal({ from: ft.port("bottom"), to: fic.port("top") });
sheet.signal({ from: fic.port("bottom"), to: pumpB.port("signal") });

mkdirSync(out, { recursive: true });
const file = join(out, "pid-dosing-skid.svg");
writeFileSync(file, sheet.render({ desc: "A3 P&ID of a hypochlorite dosing skid: tank, duty and standby metering pumps, relief and flow control." }));
for (const warning of sheet.warnings) console.warn(`WARN ${warning}`);
console.log(file);
