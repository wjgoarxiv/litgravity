// Worked example: a two-panel journal figure (double column, 178 mm) of a breakthrough
// adsorption apparatus. (a) the flow schematic with stream colours and a key; (b) an
// isometric window cutaway of the packed column.
// node build.mjs [out-dir]  ->  journal-adsorption-rig.svg

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createFigure } from "../../scripts/lib/figure.mjs";
import { createIsoView } from "../../scripts/lib/iso.mjs";
import * as S from "../../scripts/lib/pid.mjs";

const out = resolve(process.argv[2] ?? ".");
const fig = createFigure({
  width: "double",
  height: 84,
  title: "Breakthrough adsorption apparatus",
  desc: "(a) Flow schematic: feed gases through mass flow controllers to a packed column in an oven, back-pressure regulator and mass spectrometer. (b) Cutaway of the packed column.",
});

// ---------------------------------------------------------------- (a) flow schematic
const a = fig.panel("a", [0, 0, 106, 84]);
const c = a.canvas({ box: [0, 7, 106, 74] });
const co2 = c.add(S.gasCylinder({ x: 7, y: 50, w: 7, h: 22, name: "CO2/N2" }));
const he = c.add(S.gasCylinder({ x: 18, y: 50, w: 7, h: 22, name: "He" }));
const mfc1 = c.add(S.mfc({ x: 33, y: 15 }));
const mfc2 = c.add(S.mfc({ x: 33, y: 29 }));
const column = c.add(S.vessel({ x: 60, y: 40, w: 9, h: 34, packing: true, name: "Column" }));
const ms = c.add(S.unit({ x: 96, y: 30, w: 14, h: 10, caption: "MS", ports: { in: ["left", 0.5], vent: ["top", 0.65] } }));
const vent = c.add(S.vent({ x: 98.1, y: 17, text: "Vent" }));
c.zone([43, 17, 76, 64], "Oven");

c.stream({ from: co2.port("outlet"), to: mfc1.port("a"), role: "gas" });
c.stream({ from: he.port("outlet"), to: mfc2.port("a"), role: "gas" });
const feed = c.stream({ from: mfc1.port("b"), to: column.port("top"), role: "gas" });
c.stream({ from: mfc2.port("b"), to: feed.tap([40, 15]), role: "gas" });
const effluent = c.stream({ from: column.port("bottom"), to: ms.port("in"), role: "sample", via: [[60, 68], [80, 68], [80, 30]] });
c.inline(effluent, (o) => S.regulator({ ...o, backPressure: true }), { at: [80, 42] });
c.stream({ from: ms.port("vent"), to: vent.port("in"), role: "vent" });
const pressureTap = effluent.tap([80, 54]);
const pt = c.add(S.instrument({ x: 90, y: 54, tag: "PT-1" }));
c.connect({ from: pressureTap.dir[0] < 0 ? pressureTap.flip() : pressureTap, to: pt.port("left") });

fig.key(["gas", "sample", "vent"], [4, 81], { columns: 3, colWidth: 30 });

// ---------------------------------------------------------------- (b) column cutaway
const b = fig.panel("b", [110, 0, 68, 84]);
const v = createIsoView({ azimuth: 40, elevation: 24 });
const L = 160;
const R = 14;
v.halo({ plan: { x: -36, y: -36, w: 72, d: 72, r: 6 }, z: -30 });
v.box({ name: "stand base", plan: { x: -36, y: -36, w: 72, d: 72, r: 4 }, z: -30, h: 6, tone: "cast", layer: -1 });
v.lathe({ name: "stand post", origin: [-26, -26, -24], axis: "z", profile: [[0, 0], [0, 3], [L + 26, 3], [L + 26, 0]], tone: "stainless" });
v.box({ name: "clamp", plan: { x: -28, y: -14, w: 8, d: 6, r: 1 }, z: L * 0.55, h: 10, tone: "cast" });
const tube = v.lathe({ name: "column", origin: [0, 0, 0], axis: "z", profile: [[0, 0], [0, R], [L, R], [L, 0]], tone: "glass", cut: { from: 22, to: L - 22, span: 84 }, wall: 2.2 });
const bed = v.lathe({ name: "adsorbent bed", origin: [0, 0, 0], axis: "z", profile: [[36, 0], [36, R - 2.4], [L - 36, R - 2.4], [L - 36, 0]], tone: "warm", into: tube });
const woolLow = v.lathe({ name: "glass wool plug", origin: [0, 0, 0], axis: "z", profile: [[24, 0], [24, R - 2.4], [36, R - 2.4], [36, 0]], tone: "cool", into: tube });
v.lathe({ name: "glass wool plug top", origin: [0, 0, 0], axis: "z", profile: [[L - 36, 0], [L - 36, R - 2.4], [L - 24, R - 2.4], [L - 24, 0]], tone: "cool", into: tube });
// Pellet texture on the bed's lit face: rows that stop short of the limbs and the plugs.
const pellets = [];
for (let i = 0; i < 260; i++) {
  const h = Math.sin(i * 12.9898) * 43758.5453;
  const g = Math.sin(i * 78.233) * 12345.6789;
  const s = 40 + (h - Math.floor(h)) * (L - 80);
  const t = tube.facingAngle + ((g - Math.floor(g)) - 0.5) * 1.5;
  pellets.push(bed.point(s, R - 2.4, t));
}
v.dots({ name: "pellets", points: pellets, r: 0.26, color: "#b08a6a", into: tube });
for (const [z, name] of [[0, "bottom fitting"], [L, "top fitting"]]) {
  v.lathe({ name, origin: [0, 0, z], axis: z ? "z" : "-z", profile: [[0, 0], [0, R + 3], [8, R + 3], [8, 0]], tone: "brass" });
}
const inlet = v.pipe({ name: "gas inlet", points: [[0, 0, -8], [0, 0, -18], [34, 0, -18]], r: 2.2, tone: "stainless" });
const outlet = v.pipe({ name: "effluent line", points: [[0, 0, L + 8], [0, 0, L + 18], [34, 0, L + 18]], r: 2.2, tone: "stainless" });
const wells = [0.3, 0.5, 0.7].map((f, i) => v.pipe({ name: `thermocouple ${i + 1}`, points: [[R + 0.2, 0, L * f], [R + 24, 0, L * f]], r: 1, tone: "stainless", caps: [false, true] }));

v.callout({ part: tube, at: tube.anchor(0.92, -35), text: "Column, 26 mm ID" });
v.callout({ part: bed, text: "Adsorbent bed" });
v.callout({ part: woolLow, text: "Glass wool" });
v.callout({ part: wells[1], at: wells[1].anchor(0.8), text: "Thermocouples" });
v.callout({ part: inlet, at: inlet.anchor(0.85), text: "Feed in" });
v.callout({ part: outlet, at: outlet.anchor(0.85), text: "To MS" });
b.iso(v);

mkdirSync(out, { recursive: true });
const file = join(out, "journal-adsorption-rig.svg");
writeFileSync(file, fig.render());
for (const warning of fig.warnings()) console.warn(`WARN ${warning}`);
console.log(file);
