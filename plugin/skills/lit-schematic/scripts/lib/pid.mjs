// P&ID and PFD symbol library after ISO 10628-2 and ANSI/ISA-5.1 conventions, drawn in
// millimetres for a 1:1 sheet. Every symbol is an object with:
//   kind     a stable id ("valve.gate", "pump.centrifugal") the legend and the QA gate read,
//   box      its overall extent, boxes its obstacle parts (for routing and LINE.THROUGH_SYMBOL),
//   port()   named connection points with an outward axis-aligned normal,
//   svg()    the drawing, wrapped in <g data-sym data-box data-ports>.
// Coordinates are absolute sheet millimetres; (x, y) is the symbol centre unless noted.

import { el, esc, n, pathOf } from "./svg.mjs";
import { parseEquipmentTag, parseInstrumentTag } from "./isa.mjs";
import { FONT_LATIN, PID, fontFor } from "./theme.mjs";

const W = PID.weight;
const UP = [0, -1];
const DOWN = [0, 1];
const LEFT = [-1, 0];
const RIGHT = [1, 0];
const SIDE_DIR = { left: LEFT, right: RIGHT, top: UP, bottom: DOWN };

const rot = (angle) => {
  const a = ((angle % 360) + 360) % 360;
  const c = Math.round(Math.cos((a * Math.PI) / 180));
  const s = Math.round(Math.sin((a * Math.PI) / 180));
  return ([x, y]) => [x * c - y * s, x * s + y * c];
};
const ORIENT = { right: 0, down: 90, left: 180, up: 270 };

export const KIND_DESCRIPTIONS = Object.freeze({
  "vessel.vertical": "Vertical vessel",
  "vessel.reactor": "Stirred reactor",
  "vessel.jacketed": "Jacketed vessel",
  "vessel.horizontal": "Horizontal drum",
  "vessel.column": "Column",
  "vessel.tank": "Atmospheric tank",
  "gas.cylinder": "Gas cylinder",
  "pump.centrifugal": "Centrifugal pump",
  "pump.positive": "Positive-displacement pump (rotary)",
  "pump.metering": "Metering pump",
  "compressor.centrifugal": "Centrifugal compressor",
  "compressor.reciprocating": "Reciprocating compressor / gas booster",
  "exchanger.general": "Heat exchanger",
  "exchanger.shelltube": "Shell-and-tube exchanger, fixed tube sheets",
  "exchanger.floating": "Shell-and-tube exchanger, floating head",
  "exchanger.utube": "Shell-and-tube exchanger, U-tubes",
  "exchanger.plate": "Plate exchanger",
  "exchanger.aircooler": "Air-cooled exchanger (fin fan)",
  "package.unit": "Packaged unit",
  "valve.gate": "Gate valve",
  "valve.globe": "Globe valve",
  "valve.ball": "Ball valve",
  "valve.butterfly": "Butterfly valve",
  "valve.check": "Check valve",
  "valve.needle": "Needle valve",
  "valve.plug": "Plug valve",
  "valve.diaphragm": "Diaphragm valve",
  "valve.threeway": "Three-way valve",
  "valve.angle": "Angle valve",
  "valve.regulator": "Pressure-reducing regulator",
  "valve.backpressure": "Back-pressure regulator",
  "valve.safety": "Pressure safety or relief valve",
  "relief.rupture": "Rupture disk",
  "flow.orifice": "Orifice plate / restriction orifice",
  "flow.venturi": "Venturi tube",
  "flow.magnetic": "Magnetic flowmeter (MAG)",
  "flow.coriolis": "Coriolis mass flowmeter (COR)",
  "flow.vortex": "Vortex flowmeter (VOR)",
  "flow.turbine": "Turbine flowmeter (TUR)",
  "flow.ultrasonic": "Ultrasonic flowmeter (US)",
  "flow.thermal": "Thermal mass flowmeter (TMF)",
  "flow.rotameter": "Variable-area flowmeter",
  "flow.mfc": "Mass flow controller",
  "line.filter": "Inline filter",
  "line.reducer": "Concentric reducer",
  "line.reducer-eccentric": "Eccentric reducer",
  "line.flange": "Flange pair",
  "line.sightglass": "Sight glass",
  "line.blind": "Spectacle blind, normally closed",
  "line.blind-open": "Spectacle blind, normally open",
  "logic.interlock": "Interlock or logic",
  "terminal.vent": "Vent to atmosphere",
  "terminal.drain": "Drain",
  "terminal.sample": "Sample point",
  "terminal.offpage": "Off-page connector",
  "terminal.utility": "Utility connection",
  "drive.motor": "Electric motor",
});

// ANSI/ISA-5.1-2009 Table 5.4.2 actuators and Table 5.1.1 function shapes and locations.
export const ACTUATORS = Object.freeze({ diaphragm: "spring-diaphragm actuator", piston: "piston actuator", motor: "electric motor actuator", solenoid: "solenoid actuator", hand: "handwheel" });
export const FUNCTIONS = Object.freeze({ discrete: "Discrete instrument", shared: "Shared display and control (DCS)", computer: "Computer function", plc: "PLC or safety-system logic" });
export const LOCATIONS = Object.freeze({
  field: "field mounted",
  main: "main control room, operator accessible",
  "main-rear": "main control room, not operator accessible",
  aux: "auxiliary or local panel, operator accessible",
  "aux-rear": "auxiliary or local panel, not operator accessible",
});
// Table 5.4.4: fail open, fail closed, fail locked (last position), fail indeterminate.
export const FAIL_POSITIONS = Object.freeze({ FO: "fail open", FC: "fail closed", FL: "fail locked in last position", FI: "fail indeterminate" });

// Shorter wording for the legend column of a single sheet, where space is tight.
const SHORT = Object.freeze({
  actuator: { diaphragm: "diaphragm actuator", piston: "piston actuator", motor: "motor actuator", solenoid: "solenoid", hand: "handwheel" },
  fn: { discrete: "Instrument", shared: "DCS function", computer: "Computer function", plc: "PLC / SIS function" },
  location: { field: "field", main: "control room", "main-rear": "control room, behind panel", aux: "local panel", "aux-rear": "local panel, behind" },
});

// The legend text for any kind this library draws, including composed ones such as
// "valve.globe.diaphragm" and "instrument.shared-main".
export function describeKind(kind, { short = false } = {}) {
  if (KIND_DESCRIPTIONS[kind]) return KIND_DESCRIPTIONS[kind];
  const valve = /^valve\.([a-z]+)\.([a-z]+)$/u.exec(kind ?? "");
  if (valve && KIND_DESCRIPTIONS[`valve.${valve[1]}`] && ACTUATORS[valve[2]]) return `${KIND_DESCRIPTIONS[`valve.${valve[1]}`]}, ${(short ? SHORT.actuator : ACTUATORS)[valve[2]]}`;
  const bubble = /^instrument\.([a-z]+)-([a-z-]+)$/u.exec(kind ?? "");
  if (bubble && FUNCTIONS[bubble[1]] && LOCATIONS[bubble[2]]) return short ? `${SHORT.fn[bubble[1]]}, ${SHORT.location[bubble[2]]}` : `${FUNCTIONS[bubble[1]]}, ${LOCATIONS[bubble[2]]}`;
  return null;
}

let counter = 0;
export const resetIds = () => { counter = 0; };

function symbol({ kind, tag = null, box, boxes = null, ports = {}, body, sidePort = null, label = null, meta = {} }) {
  if (!describeKind(kind)) throw new Error(`pid: unknown symbol kind ${kind}`);
  const id = `S${++counter}`;
  const used = new Map();
  const obstacleBoxes = boxes ?? [box];
  const sym = {
    id, kind, tag, box, boxes: obstacleBoxes, label, meta,
    port(name, t) {
      let p = ports[name];
      if (!p && sidePort && SIDE_DIR[name] && t !== undefined) p = sidePort(name, t);
      if (!p) throw new Error(`pid: ${kind}${tag ? ` ${tag}` : ""} has no port "${name}"${sidePort ? " (side ports take a fraction 0..1: port('left', 0.3))" : ""}; ports: ${Object.keys(ports).join(", ")}`);
      const key = t === undefined ? name : `${name}@${n(t)}`;
      const port = { x: p[0], y: p[1], dir: p[2], owner: id, name: key };
      used.set(key, port);
      return port;
    },
    get usedPorts() { return [...used.values()]; },
    get allPorts() { return Object.entries(ports).map(([name, p]) => ({ name, x: p[0], y: p[1], dir: p[2] })); },
    svg() {
      const declared = [...Object.entries(ports).map(([name, p]) => [name, p]), ...[...used.values()].map((p) => [p.name, [p.x, p.y, p.dir]])];
      const uniq = new Map(declared);
      return el("g", {
        "data-sym": kind,
        "data-sym-id": id,
        "data-tag": tag ?? undefined,
        "data-box": obstacleBoxes.map((b) => b.map(n).join(" ")).join("|"),
        "data-ports": [...uniq].map(([name, p]) => `${name}:${n(p[0])},${n(p[1])},${p[2][0]},${p[2][1]}`).join(";"),
        fill: "none",
        stroke: PID.ink,
        "stroke-width": W.symbol,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }, body);
    },
  };
  return sym;
}

const line = (points, extra = {}) => el("path", { d: pathOf(points), ...extra });
const poly = (points, extra = {}) => el("path", { d: pathOf(points, true), ...extra });
const circle = (cx, cy, r, extra = {}) => el("circle", { cx, cy, r, ...extra });
const label = (x, y, text, size = PID.text.tag, extra = {}) =>
  el("text", { x, y, "font-family": fontFor(text), "font-size": size, "text-anchor": "middle", fill: PID.ink, stroke: "none", "data-label": "symbol", ...extra }, esc(text));

function checkEquipmentTag(tag) {
  if (!tag) return;
  const parsed = parseEquipmentTag(tag);
  if (!parsed.ok) throw new Error(`pid: equipment tag "${tag}": ${parsed.error}`);
}

// ---------------------------------------------------------------- vessels

export function vessel({
  x, y, w = 24, h = 48, tag = null, name = null, top = "ellipse", bottom = "ellipse",
  jacket = false, agitator = null, coil = false, packing = false, trays = 0, trayStyle = "full", demister = false,
  supports = null, liquid = null, kind,
}) {
  checkEquipmentTag(tag);
  const half = w / 2;
  const headDepth = w / 4;
  const topT = y - h / 2 + (top === "flat" ? 0 : headDepth);
  const botT = y + h / 2 - (bottom === "flat" ? 0 : headDepth);
  const parts = [];
  // Shell: left side down, bottom head, right side up, top head.
  let d = `M${n(x - half)} ${n(topT)}L${n(x - half)} ${n(botT)}`;
  if (bottom === "ellipse") d += `A${n(half)} ${n(headDepth)} 0 0 0 ${n(x + half)} ${n(botT)}`;
  else if (bottom === "cone") d += `L${n(x)} ${n(y + h / 2)}L${n(x + half)} ${n(botT)}`;
  else d += `L${n(x + half)} ${n(botT)}`;
  d += `L${n(x + half)} ${n(topT)}`;
  if (top === "ellipse") d += `A${n(half)} ${n(headDepth)} 0 0 0 ${n(x - half)} ${n(topT)}`;
  else if (top === "cone") d += `L${n(x)} ${n(y - h / 2)}L${n(x - half)} ${n(topT)}`;
  else d += `L${n(x - half)} ${n(topT)}`;
  parts.push(el("path", { d: `${d}Z`, "stroke-width": W.equipment, fill: PID.paper }));
  if (top !== "flat") parts.push(line([[x - half, topT], [x + half, topT]], { "stroke-width": W.detail }));
  if (bottom !== "flat") parts.push(line([[x - half, botT], [x + half, botT]], { "stroke-width": W.detail }));
  if (liquid !== null) {
    const ly = topT + (botT - topT) * (1 - liquid);
    parts.push(line([[x - half, ly], [x + half, ly]], { "stroke-width": W.detail, "stroke-dasharray": "1.2 0.8" }));
    parts.push(poly([[x + half - 4, ly - 1.4], [x + half - 2.6, ly - 1.4], [x + half - 3.3, ly - 0.2]], { "stroke-width": W.detail }));
  }
  let boxTop = y - h / 2;
  let boxBottom = y + h / 2;
  let boxLeft = x - half;
  let boxRight = x + half;
  const boxes = [];
  const ports = {
    top: [x, y - h / 2, UP],
    bottom: [x, y + h / 2, DOWN],
  };
  const headY = (dx, upward) => {
    const k = Math.min(1, Math.abs(dx) / half);
    const yt = upward ? topT : botT;
    const shape = upward ? top : bottom;
    if (shape === "flat") return yt;
    if (shape === "cone") return yt + (upward ? -1 : 1) * headDepth * (1 - k);
    return yt + (upward ? -1 : 1) * headDepth * Math.sqrt(1 - k * k);
  };
  ports["top-left"] = [x - half / 2, headY(-half / 2, true), UP];
  ports["top-right"] = [x + half / 2, headY(half / 2, true), UP];
  ports["bottom-left"] = [x - half / 2, headY(-half / 2, false), DOWN];
  ports["bottom-right"] = [x + half / 2, headY(half / 2, false), DOWN];
  let jacketTop = null;
  const j = 2.6;
  if (jacket) {
    jacketTop = topT + (botT - topT) * 0.22;
    let jd = `M${n(x - half - j)} ${n(jacketTop)}L${n(x - half - j)} ${n(botT)}`;
    if (bottom === "ellipse") jd += `A${n(half + j)} ${n(headDepth + j)} 0 0 0 ${n(x + half + j)} ${n(botT)}`;
    else jd += `L${n(x + half + j)} ${n(botT + (bottom === "flat" ? j : 0))}`;
    jd += `L${n(x + half + j)} ${n(jacketTop)}`;
    parts.unshift(el("path", { d: jd, "stroke-width": W.equipment }));
    parts.push(line([[x - half - j, jacketTop], [x - half, jacketTop]], { "stroke-width": W.equipment }));
    parts.push(line([[x + half, jacketTop], [x + half + j, jacketTop]], { "stroke-width": W.equipment }));
    boxLeft -= j;
    boxRight += j;
    boxBottom = Math.max(boxBottom, botT + (bottom === "ellipse" ? headDepth + j : j));
    ports["jacket-in"] = [x + half + j, botT - (botT - jacketTop) * 0.12, RIGHT];
    ports["jacket-out"] = [x - half - j, jacketTop + (botT - jacketTop) * 0.12, LEFT];
  }
  if (coil) {
    const c0 = topT + (botT - topT) * 0.45;
    const c1 = botT - 2;
    const zig = [];
    const count = 7;
    for (let i = 0; i <= count; i++) zig.push([x + (i % 2 ? half - 3 : -half + 3), c0 + ((c1 - c0) * i) / count]);
    parts.push(line(zig, { "stroke-width": W.detail }));
  }
  if (packing) {
    const p0 = topT + (botT - topT) * 0.3;
    const p1 = topT + (botT - topT) * 0.75;
    parts.push(poly([[x - half, p0], [x + half, p0], [x + half, p1], [x - half, p1]], { "stroke-width": W.detail }));
    parts.push(line([[x - half, p0], [x + half, p1]], { "stroke-width": W.detail }));
    parts.push(line([[x + half, p0], [x - half, p1]], { "stroke-width": W.detail }));
  }
  if (demister) {
    const m = topT + 3;
    parts.push(poly([[x - half, m], [x + half, m], [x + half, m + 2.2], [x - half, m + 2.2]], { "stroke-width": W.detail }));
    for (let i = 1; i < 6; i++) parts.push(line([[x - half + (w * i) / 6 - 1, m], [x - half + (w * i) / 6 + 1, m + 2.2]], { "stroke-width": W.detail }));
  }
  // ISO 10628-2 item 2.2 draws trays across the whole shell; item 2.5 staggers baffles.
  for (let i = 0; i < trays; i++) {
    const ty = topT + ((botT - topT) * (i + 1)) / (trays + 1);
    const fromLeft = i % 2 === 0;
    const run = trayStyle === "staggered"
      ? (fromLeft ? [[x - half, ty], [x + half * 0.5, ty]] : [[x - half * 0.5, ty], [x + half, ty]])
      : [[x - half, ty], [x + half, ty]];
    parts.push(line(run, { "stroke-width": W.detail, "stroke-dasharray": "2.2 1" }));
  }
  if (agitator) {
    const motorY = y - h / 2 - 6.5;
    const shaftTop = motorY + 3.2;
    const shaftBottom = topT + (botT - topT) * 0.82;
    parts.push(line([[x, shaftTop], [x, shaftBottom]], { "stroke-width": W.symbol }));
    parts.push(circle(x, motorY, 3.2, { fill: PID.paper }));
    parts.push(label(x, motorY + 0.9, "M", 2.4));
    if (agitator === "anchor") {
      parts.push(line([[x - half + 2.5, shaftBottom - 7], [x - half + 2.5, shaftBottom], [x + half - 2.5, shaftBottom], [x + half - 2.5, shaftBottom - 7]]));
    } else if (agitator === "propeller") {
      parts.push(poly([[x, shaftBottom], [x - 5, shaftBottom - 1.6], [x - 5, shaftBottom + 0.6]]));
      parts.push(poly([[x, shaftBottom], [x + 5, shaftBottom + 1.6], [x + 5, shaftBottom - 0.6]]));
    } else {
      parts.push(line([[x - 5.5, shaftBottom], [x + 5.5, shaftBottom]]));
      parts.push(poly([[x - 5.5, shaftBottom - 1.8], [x - 3.3, shaftBottom - 1.8], [x - 3.3, shaftBottom + 1.8], [x - 5.5, shaftBottom + 1.8]]));
      parts.push(poly([[x + 3.3, shaftBottom - 1.8], [x + 5.5, shaftBottom - 1.8], [x + 5.5, shaftBottom + 1.8], [x + 3.3, shaftBottom + 1.8]]));
    }
    boxes.push([x - 3.4, motorY - 3.4, x + 3.4, y - h / 2]);
    boxTop = motorY - 3.4;
  }
  if (supports === "legs") {
    const legBottom = boxBottom + 4;
    for (const sx of [x - half * 0.75, x + half * 0.75]) {
      const top0 = headY(sx - x, false);
      parts.push(line([[sx, top0], [sx, legBottom]], { "stroke-width": W.equipment }));
      parts.push(line([[sx - 1.6, legBottom], [sx + 1.6, legBottom]], { "stroke-width": W.equipment }));
    }
    boxBottom = legBottom;
  } else if (supports === "skirt") {
    const skBottom = boxBottom + 5;
    parts.push(line([[x - half * 0.8, headY(-half * 0.8, false)], [x - half * 0.8, skBottom]], { "stroke-width": W.equipment }));
    parts.push(line([[x + half * 0.8, headY(half * 0.8, false)], [x + half * 0.8, skBottom]], { "stroke-width": W.equipment }));
    parts.push(line([[x - half * 0.8 - 1.5, skBottom], [x + half * 0.8 + 1.5, skBottom]], { "stroke-width": W.equipment }));
    boxBottom = skBottom;
  }
  const shellBox = [boxLeft, y - h / 2, boxRight, boxBottom];
  boxes.unshift(shellBox);
  const resolvedKind = kind ?? (agitator ? "vessel.reactor" : jacket ? "vessel.jacketed" : trays || packing ? "vessel.column" : top === "cone" && bottom === "flat" ? "vessel.tank" : "vessel.vertical");
  return symbol({
    kind: resolvedKind,
    tag,
    label: name,
    box: [boxLeft, boxTop, boxRight, boxBottom],
    boxes,
    ports,
    sidePort: (side, t) => {
      if (side !== "left" && side !== "right") {
        const dx = (t - 0.5) * w * 0.8;
        return side === "top" ? [x + dx, headY(dx, true), UP] : [x + dx, headY(dx, false), DOWN];
      }
      const yy = topT + (botT - topT) * t;
      const covered = jacket && yy >= jacketTop - 0.01;
      const xx = side === "left" ? x - half - (covered ? j : 0) : x + half + (covered ? j : 0);
      return [xx, yy, side === "left" ? LEFT : RIGHT];
    },
    body: parts,
    meta: { topT, botT, w, h, jacket, agitator },
  });
}

export const reactor = (options) => vessel({ jacket: true, agitator: "turbine", ...options });
export const column = (options) => vessel({ w: 16, h: 90, trays: 8, ...options, kind: "vessel.column" });
export const tank = (options) => vessel({ w: 30, h: 30, top: "cone", bottom: "flat", ...options, kind: "vessel.tank" });

export function drum({ x, y, w = 48, h = 20, tag = null, name = null, saddles = true }) {
  checkEquipmentTag(tag);
  const headDepth = h / 4;
  const leftT = x - w / 2 + headDepth;
  const rightT = x + w / 2 - headDepth;
  const half = h / 2;
  const d = `M${n(leftT)} ${n(y - half)}L${n(rightT)} ${n(y - half)}A${n(headDepth)} ${n(half)} 0 0 1 ${n(rightT)} ${n(y + half)}L${n(leftT)} ${n(y + half)}A${n(headDepth)} ${n(half)} 0 0 1 ${n(leftT)} ${n(y - half)}Z`;
  const parts = [el("path", { d, "stroke-width": W.equipment, fill: PID.paper })];
  parts.push(line([[leftT, y - half], [leftT, y + half]], { "stroke-width": W.detail }));
  parts.push(line([[rightT, y - half], [rightT, y + half]], { "stroke-width": W.detail }));
  let bottom = y + half;
  if (saddles) {
    for (const sx of [leftT + 4, rightT - 4]) {
      parts.push(poly([[sx - 3, y + half - 0.6], [sx + 3, y + half - 0.6], [sx + 3.6, y + half + 3], [sx - 3.6, y + half + 3]], { "stroke-width": W.equipment }));
    }
    bottom = y + half + 3;
  }
  return symbol({
    kind: "vessel.horizontal",
    tag,
    label: name,
    box: [x - w / 2, y - half, x + w / 2, bottom],
    ports: { left: [x - w / 2, y, LEFT], right: [x + w / 2, y, RIGHT] },
    sidePort: (side, t) => {
      const xx = leftT + (rightT - leftT) * t;
      if (side === "top") return [xx, y - half, UP];
      if (side === "bottom") return [xx, y + half, DOWN];
      return [side === "left" ? x - w / 2 : x + w / 2, y - half + h * t, side === "left" ? LEFT : RIGHT];
    },
    body: parts,
  });
}

export function gasCylinder({ x, y, w = 10, h = 30, tag = null, name = null }) {
  checkEquipmentTag(tag);
  const half = w / 2;
  const top = y - h / 2;
  const shoulder = top + half;
  const parts = [
    el("path", { d: `M${n(x - half)} ${n(y + h / 2)}L${n(x - half)} ${n(shoulder)}A${n(half)} ${n(half)} 0 0 1 ${n(x + half)} ${n(shoulder)}L${n(x + half)} ${n(y + h / 2)}Z`, "stroke-width": W.equipment, fill: PID.paper }),
    poly([[x - 1.2, top - 3], [x + 1.2, top - 3], [x + 1.2, top], [x - 1.2, top]]),
    line([[x - 2.6, top - 3], [x + 2.6, top - 3]]),
  ];
  return symbol({
    kind: "gas.cylinder",
    tag,
    label: name,
    box: [x - half, top - 3, x + half, y + h / 2],
    ports: { outlet: [x, top - 3, UP] },
    body: parts,
  });
}

// ---------------------------------------------------------------- machines

export function pump({ x, y, r = 5, type = "centrifugal", facing = "right", tag = null, name = null }) {
  checkEquipmentTag(tag);
  const m = facing === "left" ? -1 : 1;
  const parts = [circle(x, y, r, { "stroke-width": W.equipment, fill: PID.paper })];
  parts.push(poly([[x - r * 0.62, y + r * 0.78], [x - r * 0.95, y + r + 1.8], [x + r * 0.95, y + r + 1.8], [x + r * 0.62, y + r * 0.78]], { "stroke-width": W.equipment }));
  const discharge = [x + m * (r + 2.4), y - r];
  parts.push(line([[x, y - r], discharge], { "stroke-width": W.equipment }));
  if (type === "positive") {
    parts.push(circle(x - r * 0.32, y, r * 0.32), circle(x + r * 0.32, y, r * 0.32));
  } else if (type === "metering") {
    parts.push(line([[x - r * 0.9, y + r * 0.9], [x + r * 0.9, y - r * 0.9]]));
    parts.push(poly([[x + r * 0.9, y - r * 0.9], [x + r * 0.35, y - r * 0.7], [x + r * 0.7, y - r * 0.35]], { fill: PID.ink }));
  } else {
    parts.push(line([[x - r * 0.5, y], [x + r * 0.5, y]], { "stroke-width": W.detail }));
  }
  return symbol({
    kind: type === "positive" ? "pump.positive" : type === "metering" ? "pump.metering" : "pump.centrifugal",
    tag,
    label: name,
    box: [Math.min(x - r, discharge[0]), y - r, Math.max(x + r, discharge[0]), y + r + 1.8],
    ports: {
      suction: [x - m * r, y, m > 0 ? LEFT : RIGHT],
      discharge: [discharge[0], discharge[1], m > 0 ? RIGHT : LEFT],
      signal: [x + m * r * 0.6, y + r + 1.8, DOWN],
    },
    body: parts,
  });
}

export function compressor({ x, y, r = 7, type = "centrifugal", facing = "right", tag = null, name = null }) {
  checkEquipmentTag(tag);
  const m = facing === "left" ? -1 : 1;
  const parts = [circle(x, y, r, { "stroke-width": W.equipment, fill: PID.paper })];
  if (type === "reciprocating") {
    parts.push(poly([[x - r * 0.55, y - r * 0.4], [x + r * 0.55, y - r * 0.4], [x + r * 0.55, y + r * 0.4], [x - r * 0.55, y + r * 0.4]]));
    parts.push(line([[x - r * 0.1, y - r * 0.4], [x - r * 0.1, y + r * 0.4]]));
    parts.push(line([[x - r * 0.1, y], [x - r * 0.85, y]]));
  } else {
    parts.push(poly([[x - m * r * 0.72, y - r * 0.62], [x + m * r * 0.72, y - r * 0.28], [x + m * r * 0.72, y + r * 0.28], [x - m * r * 0.72, y + r * 0.62]]));
  }
  return symbol({
    kind: type === "reciprocating" ? "compressor.reciprocating" : "compressor.centrifugal",
    tag,
    label: name,
    box: [x - r, y - r, x + r, y + r],
    ports: {
      inlet: [x - m * r, y, m > 0 ? LEFT : RIGHT],
      outlet: [x + m * r, y, m > 0 ? RIGHT : LEFT],
      drive: [x, y + r, DOWN],
    },
    body: parts,
  });
}

export function motor({ x, y, r = 3.6, tag = null }) {
  return symbol({
    kind: "drive.motor",
    tag,
    box: [x - r, y - r, x + r, y + r],
    ports: { shaft: [x, y - r, UP], left: [x - r, y, LEFT], right: [x + r, y, RIGHT], bottom: [x, y + r, DOWN] },
    body: [circle(x, y, r, { fill: PID.paper }), label(x, y + 0.9, "M", 2.5)],
  });
}

// ---------------------------------------------------------------- heat transfer

export function exchanger({ x, y, r = 7, tag = null, name = null }) {
  checkEquipmentTag(tag);
  const zig = [[x - r, y], [x - r * 0.45, y], [x - r * 0.2, y - r * 0.45], [x + r * 0.2, y + r * 0.45], [x + r * 0.45, y], [x + r, y]];
  return symbol({
    kind: "exchanger.general",
    tag,
    label: name,
    box: [x - r, y - r, x + r, y + r],
    ports: { "tube-in": [x - r, y, LEFT], "tube-out": [x + r, y, RIGHT], "shell-in": [x, y - r, UP], "shell-out": [x, y + r, DOWN] },
    body: [circle(x, y, r, { "stroke-width": W.equipment, fill: PID.paper }), line(zig)],
  });
}

// Shell-and-tube exchangers after ISO 10628-2 items 3.3 (fixed tube sheets, one tube pass),
// 3.4 (floating head, two passes from the front channel) and 3.5 (U-tubes).
export function shellTube({ x, y, w = 36, h = 12, type = "fixed", tag = null, name = null }) {
  checkEquipmentTag(tag);
  const half = h / 2;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const rect = (a, b, c, d, extra = {}) => poly([[a, b], [c, b], [c, d], [a, d]], extra);
  const parts = [];
  let ports;
  let kind;
  if (type === "utube") {
    const channel = x0 + 6;
    const d = `M${n(channel)} ${n(y - half)}L${n(x1 - half)} ${n(y - half)}A${n(half)} ${n(half)} 0 0 1 ${n(x1 - half)} ${n(y + half)}L${n(channel)} ${n(y + half)}Z`;
    parts.push(
      el("path", { d, "stroke-width": W.equipment, fill: PID.paper }),
      rect(x0, y - half, channel, y + half, { "stroke-width": W.equipment, fill: PID.paper }),
      line([[x0, y], [channel, y]], { "stroke-width": W.detail }),
      el("path", { d: `M${n(channel)} ${n(y - 2.4)}L${n(x1 - half - 1)} ${n(y - 2.4)}A2.4 2.4 0 0 1 ${n(x1 - half - 1)} ${n(y + 2.4)}L${n(channel)} ${n(y + 2.4)}`, "stroke-width": W.detail }),
    );
    kind = "exchanger.utube";
    ports = { "tube-in": [x0 + 3, y + half, DOWN], "tube-out": [x0 + 3, y - half, UP], "shell-in": [x1 - half - 4, y - half, UP], "shell-out": [channel + 4, y + half, DOWN] };
  } else {
    const sheet = 1.4;
    const front = x0 + 4;
    parts.push(rect(x0, y - half, x1, y + half, { "stroke-width": W.equipment, fill: PID.paper }));
    parts.push(rect(front, y - half, front + sheet, y + half, { "stroke-width": W.detail, fill: PID.paper }));
    if (type === "floating") {
      const head = x1 - 8;
      parts.push(rect(head, y - half + 1.6, head + 2.6, y + half - 1.6, { "stroke-width": W.detail, fill: PID.paper }));
      parts.push(line([[x0, y], [front, y]], { "stroke-width": W.detail }));
      for (const dy of [-half * 0.45, 0, half * 0.45]) parts.push(line([[front + sheet, y + dy], [head, y + dy]], { "stroke-width": W.detail }));
      kind = "exchanger.floating";
      ports = { "tube-in": [x0 + 2, y + half, DOWN], "tube-out": [x0 + 2, y - half, UP], "shell-in": [x1 - 12, y - half, UP], "shell-out": [front + 6, y + half, DOWN] };
    } else {
      const rear = x1 - 4 - sheet;
      parts.push(rect(rear, y - half, rear + sheet, y + half, { "stroke-width": W.detail, fill: PID.paper }));
      for (const dy of [-half * 0.45, 0, half * 0.45]) parts.push(line([[front + sheet, y + dy], [rear, y + dy]], { "stroke-width": W.detail }));
      kind = "exchanger.shelltube";
      ports = { "tube-in": [x0 + 2, y + half, DOWN], "tube-out": [x1 - 2, y - half, UP], "shell-in": [rear - 4, y - half, UP], "shell-out": [front + sheet + 4, y + half, DOWN] };
    }
  }
  return symbol({ kind, tag, label: name, box: [x0, y - half, x1, y + half], ports, body: parts });
}

// ISO 10628-2 item 3.6: the plate pack as a rectangle with both diagonals and a centre line.
export function plateExchanger({ x, y, w = 18, h = 10, tag = null, name = null }) {
  checkEquipmentTag(tag);
  const [x0, y0, x1, y1] = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
  const parts = [
    poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { "stroke-width": W.equipment, fill: PID.paper }),
    line([[x0, y0], [x1, y1]], { "stroke-width": W.detail }),
    line([[x0, y1], [x1, y0]], { "stroke-width": W.detail }),
    line([[x, y0], [x, y1]], { "stroke-width": W.detail }),
  ];
  return symbol({
    kind: "exchanger.plate",
    tag,
    label: name,
    box: [x - w / 2, y - h / 2, x + w / 2, y + h / 2],
    ports: {
      "hot-in": [x - w / 2, y - h / 2 + 3, LEFT], "hot-out": [x + w / 2, y + h / 2 - 3, RIGHT],
      "cold-in": [x + w / 2, y - h / 2 + 3, RIGHT], "cold-out": [x - w / 2, y + h / 2 - 3, LEFT],
    },
    body: parts,
  });
}

// An air-cooled exchanger: the tube bundle as a box with the tube run inside, the fan under it
// as a blade sweep on a hub, driven by a motor.
export function airCooler({ x, y, w = 30, h = 7, tag = null, name = null }) {
  checkEquipmentTag(tag);
  const [x0, y0, x1, y1] = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
  const zig = [];
  for (let i = 0; i <= 10; i++) zig.push([x0 + 2 + ((w - 4) * i) / 10, i % 2 ? y - h * 0.22 : y + h * 0.22]);
  const fanY = y1 + 3;
  const motorY = fanY + 4.6;
  const parts = [
    poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { "stroke-width": W.equipment, fill: PID.paper }),
    line(zig, { "stroke-width": W.detail }),
    line([[x, y1], [x, motorY - 2.4]], { "stroke-width": W.symbol }),
    el("path", { d: `M${n(x - w * 0.3)} ${n(fanY)}Q${n(x - w * 0.15)} ${n(fanY - 1.4)} ${n(x)} ${n(fanY)}Q${n(x + w * 0.15)} ${n(fanY + 1.4)} ${n(x + w * 0.3)} ${n(fanY)}`, "stroke-width": W.symbol }),
    circle(x, fanY, 0.8, { fill: PID.ink }),
    circle(x, motorY, 2.4, { fill: PID.paper }),
    label(x, motorY + 0.8, "M", 2.2),
  ];
  return symbol({
    kind: "exchanger.aircooler",
    tag,
    label: name,
    box: [x0, y0, x1, motorY + 2.4],
    boxes: [[x0, y0, x1, fanY + 1.6], [x - 2.6, fanY + 1.6, x + 2.6, motorY + 2.4]],
    ports: { in: [x0, y, LEFT], out: [x1, y, RIGHT] },
    body: parts,
  });
}

// A packaged unit (chiller, circulator, gas booster skid, analyzer, DAQ): a box with a
// centred caption and ports at fractions of its sides.
export function unit({ x, y, w = 26, h = 16, tag = null, name = null, caption = null, ports = {}, glyph = null }) {
  checkEquipmentTag(tag);
  const x0 = x - w / 2;
  const y0 = y - h / 2;
  const parts = [poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], { "stroke-width": W.equipment, fill: PID.paper })];
  if (glyph === "coil") {
    const z = [];
    for (let i = 0; i <= 8; i++) z.push([x0 + 3 + ((w - 6) * i) / 8, y0 + h - 3.2 - (i % 2 ? 2 : 0)]);
    parts.push(line(z, { "stroke-width": W.detail }));
  } else if (glyph === "wave") {
    const z = [];
    for (let i = 0; i <= 16; i++) z.push([x0 + 3 + ((w - 6) * i) / 16, y0 + h - 3.2 + Math.sin((i / 16) * Math.PI * 4) * 0.8]);
    parts.push(line(z, { "stroke-width": W.detail }));
  }
  if (caption) parts.push(label(x, glyph ? y - 0.2 : y + 0.9, caption, PID.text.label));
  const resolved = {};
  const at = (side, t) => {
    if (side === "left") return [x0, y0 + h * t, LEFT];
    if (side === "right") return [x0 + w, y0 + h * t, RIGHT];
    if (side === "top") return [x0 + w * t, y0, UP];
    return [x0 + w * t, y0 + h, DOWN];
  };
  for (const [name0, [side, t]] of Object.entries(ports)) resolved[name0] = at(side, t);
  return symbol({ kind: "package.unit", tag, label: name, box: [x0, y0, x0 + w, y0 + h], ports: resolved, sidePort: at, body: parts });
}

// ---------------------------------------------------------------- inline items

// Inline symbols are drawn along +x in a local frame and turned to the line direction. A line
// running left mirrors the symbol instead of turning it over, so an actuator still stands above
// the line; letters are set upright at their turned position.
function inline({ kind, x, y, orient = "right", half = 3.5, height = 2.4, body, extraPorts = {}, extraBoxes = [], tag = null }) {
  const mirrored = orient === "left";
  const turn = mirrored ? ([px, py]) => [-px, py] : rot(ORIENT[orient] ?? 0);
  const place = ([px, py]) => { const [rx, ry] = turn([px, py]); return [x + rx, y + ry]; };
  const dirOf = (d) => turn(d).map((v) => Math.round(v));
  const corners = [[-half, -height], [half, -height], [half, height], [-half, height]].map(place);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const ports = { a: [...place([-half, 0]), dirOf(LEFT)], b: [...place([half, 0]), dirOf(RIGHT)] };
  for (const [name, [lx, ly, d]] of Object.entries(extraPorts)) ports[name] = [...place([lx, ly]), dirOf(d)];
  const boxes = [box];
  for (const local of extraBoxes) {
    const pts = [[local[0], local[1]], [local[2], local[1]], [local[2], local[3]], [local[0], local[3]]].map(place);
    boxes.push([Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]);
  }
  const all = boxes.reduce((acc, b) => [Math.min(acc[0], b[0]), Math.min(acc[1], b[1]), Math.max(acc[2], b[2]), Math.max(acc[3], b[3])]);
  const parts = [body].flat();
  const isText = (part) => typeof part === "string" && part.startsWith("<text");
  const texts = parts.filter(isText).map((t) => {
    const attr = (name) => Number(t.match(new RegExp(` ${name}="([^"]*)"`, "u"))?.[1] ?? 0);
    const [tx, ty] = place([attr("x"), attr("y")]);
    const along = turn([1, 0]);
    const anchor = t.match(/ text-anchor="([^"]*)"/u)?.[1] ?? "middle";
    const flip = { start: "end", end: "start", middle: "middle" };
    const upright = along[0] < 0 ? flip[anchor] : along[0] !== 0 ? anchor : tx < x - 0.5 ? "end" : tx > x + 0.5 ? "start" : "middle";
    return t.replace(/ x="[^"]*"/u, ` x="${n(tx)}"`).replace(/ y="[^"]*"/u, ` y="${n(ty)}"`).replace(/ text-anchor="[^"]*"/u, ` text-anchor="${upright}"`);
  });
  const transform = mirrored ? `translate(${n(x)} ${n(y)}) scale(-1 1)` : `translate(${n(x)} ${n(y)}) rotate(${ORIENT[orient] ?? 0})`;
  return symbol({
    kind,
    tag,
    box: all,
    boxes,
    ports,
    body: [el("g", { transform }, parts.filter((p) => !isText(p))), ...texts].join(""),
  });
}

const bowtie = (half = 3.5, hh = 2.2) => poly([[-half, -hh], [half, hh], [half, -hh], [-half, hh]]);

const ACTUATOR_ALIASES = Object.freeze({ manual: "hand", handwheel: "hand" });

function checkFail(fail) {
  if (fail && !FAIL_POSITIONS[fail]) throw new Error(`pid: fail position "${fail}" must be FO, FC, FL or FI (ISA-5.1 Table 5.4.4)`);
}

// How far each actuator reaches from the valve body: its signal connects at that end.
const ACTUATOR_REACH = Object.freeze({ diaphragm: 7.6, piston: 8, motor: 9, solenoid: 8.8, hand: 4.2 });

// Actuators stand perpendicular to the line, on the local -y side (ISA-5.1 Table 5.4.2).
// On a vertical line the fail letters go beside the body, opposite the actuator, reading upright.
function actuatorParts(type, fail, orient = "right") {
  const parts = [line([[0, 0], [0, -4.2]])];
  const boxes = [[-3.4, -9.2, 3.4, 0]];
  if (type === "diaphragm") parts.push(el("path", { d: "M-3.4 -4.2A3.4 3.4 0 0 1 3.4 -4.2Z", fill: "#ffffff" }));
  else if (type === "solenoid") parts.push(poly([[-2.4, -4.2], [2.4, -4.2], [2.4, -8.8], [-2.4, -8.8]], { fill: "#ffffff" }), label(0, -5.6, "S", 2.4));
  else if (type === "motor") parts.push(circle(0, -6.6, 2.4, { fill: "#ffffff" }), label(0, -5.7, "M", 2.4));
  else if (type === "piston") parts.push(poly([[-2.6, -4.2], [2.6, -4.2], [2.6, -8], [-2.6, -8]], { fill: "#ffffff" }), line([[-2.6, -6.1], [2.6, -6.1]]));
  else parts.push(line([[-2.6, -4.2], [2.6, -4.2]]));
  const vertical = orient === "up" || orient === "down";
  const baseline = orient === "up" ? -0.8 : 0.8;
  if (fail) parts.push(vertical ? label(baseline, 3, fail, 2.2, { "data-label": "fail" }) : label(4.6, -1.2, fail, 2.2, { "text-anchor": "start", "data-label": "fail" }));
  if (fail) boxes.push(vertical ? [-2.2, 2.4, 2.2, 9] : [3.4, -3.6, 9.2, 0.6]);
  return { parts, boxes };
}

export function valve({ x, y, type = "gate", orient = "right", actuator = null, fail = null, tag = null }) {
  const parts = [];
  const act = actuator ? ACTUATOR_ALIASES[actuator] ?? actuator : null;
  if (act && !ACTUATORS[act]) throw new Error(`pid: actuator must be one of ${Object.keys(ACTUATORS).join(", ")}`);
  checkFail(fail);
  let kind = act ? `valve.${type}.${act}` : `valve.${type}`;
  let extraPorts = {};
  let extraBoxes = [];
  if (type === "butterfly") {
    parts.push(line([[-3, -2.4], [-3, 2.4]]), line([[3, -2.4], [3, 2.4]]), line([[-3, 0], [3, 0]]), line([[-1.8, 1.8], [1.8, -1.8]]), circle(0, 0, 0.7, { fill: PID.ink }));
  } else if (type === "check") {
    parts.push(bowtie(), poly([[-3.5, -2.2], [0, 0], [-3.5, 2.2]], { fill: PID.ink }));
  } else {
    parts.push(bowtie());
    if (type === "globe") parts.push(circle(0, 0, 0.9, { fill: PID.ink }));
    if (type === "ball") parts.push(circle(0, 0, 1.3, { fill: "#ffffff" }));
    if (type === "plug") parts.push(poly([[-0.9, -1.1], [0.9, -1.1], [0.9, 1.1], [-0.9, 1.1]], { fill: "#ffffff" }));
    if (type === "needle") parts.push(poly([[-1, -3.6], [1, -3.6], [0, -0.6]], { fill: PID.ink }), line([[0, -3.6], [0, -5.2]]));
    if (type === "diaphragm") parts.push(el("path", { d: "M-2.4 -2.2A2.4 1.6 0 0 1 2.4 -2.2" }));
    if (type === "threeway") {
      parts.push(poly([[0, 0], [-2.2, 3.5], [2.2, 3.5]]));
      extraPorts = { c: [0, 3.5, DOWN] };
      extraBoxes = [[-2.4, 0, 2.4, 3.6]];
    }
  }
  if (type === "needle") extraBoxes.push([-1.2, -5.4, 1.2, 0]);
  if (type === "diaphragm") extraBoxes.push([-2.6, -3.9, 2.6, 0]);
  if (act) {
    const a = actuatorParts(act, fail, orient);
    parts.push(...a.parts);
    extraBoxes.push(...a.boxes);
    extraPorts = { ...extraPorts, actuator: [0, -ACTUATOR_REACH[act], UP] };
  }
  if (!describeKind(kind)) throw new Error(`pid: unknown valve type ${type}`);
  return inline({ kind, x, y, orient, body: parts, extraPorts, extraBoxes, tag });
}

// An angle valve sits where the line turns: one body toward the inlet, one toward the outlet,
// the actuator (if any) on the side away from the inlet.
export function angleValve({ x, y, inlet = "down", outlet = "right", actuator = null, fail = null, tag = null }) {
  const dirs = { right: RIGHT, left: LEFT, up: UP, down: DOWN };
  const din = dirs[inlet];
  const dout = dirs[outlet];
  if (!din || !dout || din[0] * dout[0] + din[1] * dout[1] !== 0) throw new Error("angleValve: inlet and outlet must be two perpendicular sides (left, right, up, down)");
  const act = actuator ? ACTUATOR_ALIASES[actuator] ?? actuator : null;
  if (act && !ACTUATORS[act]) throw new Error(`pid: actuator must be one of ${Object.keys(ACTUATORS).join(", ")}`);
  checkFail(fail);
  const triangle = (d) => [[x, y], [x + d[0] * 3.5 - d[1] * 2.2, y + d[1] * 3.5 + d[0] * 2.2], [x + d[0] * 3.5 + d[1] * 2.2, y + d[1] * 3.5 - d[0] * 2.2]];
  const tris = [triangle(din), triangle(dout)];
  const parts = tris.map((t) => poly(t));
  const corners = tris.flat();
  const boxes = [[Math.min(...corners.map((p) => p[0])), Math.min(...corners.map((p) => p[1])), Math.max(...corners.map((p) => p[0])), Math.max(...corners.map((p) => p[1]))]];
  if (act) {
    const away = [-din[0], -din[1]];
    const angle = Math.round((Math.atan2(away[1], away[0]) * 180) / Math.PI) + 90;
    const a = actuatorParts(act, fail);
    parts.push(el("g", { transform: `translate(${n(x)} ${n(y)}) rotate(${angle})` }, a.parts));
    const r = rot(angle);
    for (const b of a.boxes) {
      const pts = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(r).map(([px, py]) => [x + px, y + py]);
      boxes.push([Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]);
    }
  }
  const all = boxes.reduce((acc, b) => [Math.min(acc[0], b[0]), Math.min(acc[1], b[1]), Math.max(acc[2], b[2]), Math.max(acc[3], b[3])]);
  return symbol({
    kind: act ? `valve.angle.${act}` : "valve.angle",
    tag,
    box: all,
    boxes,
    ports: {
      inlet: [x + din[0] * 3.5, y + din[1] * 3.5, din],
      outlet: [x + dout[0] * 3.5, y + dout[1] * 3.5, dout],
      ...(act ? { actuator: [x - din[0] * ACTUATOR_REACH[act], y - din[1] * ACTUATOR_REACH[act], [-din[0], -din[1]]] } : {}),
    },
    body: parts,
  });
}

export function regulator({ x, y, orient = "right", backPressure = false, tag = null }) {
  const sense = backPressure ? -3.5 : 3.5;
  const parts = [
    bowtie(),
    line([[0, 0], [0, -4.2]]),
    el("path", { d: "M-3.4 -4.2A3.4 3.4 0 0 1 3.4 -4.2Z", fill: "#ffffff" }),
    line([[backPressure ? -3.4 : 3.4, -5.2], [sense + (backPressure ? -2.2 : 2.2), -5.2], [sense + (backPressure ? -2.2 : 2.2), 0]], { "stroke-width": W.signal, "stroke-dasharray": "0.8 0.6" }),
  ];
  const sx = sense + (backPressure ? -2.2 : 2.2);
  return inline({ kind: backPressure ? "valve.backpressure" : "valve.regulator", x, y, orient, body: parts, extraBoxes: [[Math.min(-3.4, sx), -7.8, Math.max(3.4, sx), 0]], tag });
}

// A pressure safety valve: inlet from below, outlet to the side, spring on top.
export function safetyValve({ x, y, outlet = "right", tag = null, setPressure = null }) {
  const m = outlet === "left" ? -1 : 1;
  const parts = [
    poly([[x, y], [x - 2.4, y + 4], [x + 2.4, y + 4]]),
    poly([[x, y], [x + m * 4, y - 2.4], [x + m * 4, y + 2.4]]),
    line([[x, y], [x, y - 3]]),
    line([[x, y - 3], [x - 1.6, y - 3.8], [x + 1.6, y - 4.8], [x - 1.6, y - 5.8], [x + 1.6, y - 6.8], [x, y - 7.4]], { "stroke-width": W.detail }),
  ];
  const boxes = [[Math.min(x - 2.4, x + m * 4), y - 7.6, Math.max(x + 2.4, x + m * 4), y + 4]];
  if (setPressure) {
    parts.push(label(x - m * 3, y - 4.6, setPressure, 2.2, { "text-anchor": m > 0 ? "end" : "start", "data-label": "set" }));
  }
  return symbol({
    kind: "valve.safety",
    tag,
    box: boxes[0],
    boxes,
    ports: { inlet: [x, y + 4, DOWN], outlet: [x + m * 4, y, m > 0 ? RIGHT : LEFT] },
    body: parts,
  });
}

export function ruptureDisk({ x, y, orient = "up", tag = null }) {
  const parts = [line([[-1.6, -3], [-1.6, 3]]), line([[1.6, -3], [1.6, 3]]), el("path", { d: "M-1.6 -2.6Q1.2 0 -1.6 2.6" })];
  return inline({ kind: "relief.rupture", x, y, orient, half: 1.6, height: 3, body: parts, tag });
}

export function orifice({ x, y, orient = "right", tag = null }) {
  return inline({ kind: "flow.orifice", x, y, orient, half: 1, height: 3, body: [line([[-1, -3], [-1, 3]]), line([[1, -3], [1, 3]])], tag });
}

export function rotameter({ x, y, orient = "up", tag = null }) {
  const parts = [poly([[-3.5, -1.2], [3.5, -2.2], [3.5, 2.2], [-3.5, 1.2]]), circle(-0.6, 0, 0.8, { fill: PID.ink })];
  return inline({ kind: "flow.rotameter", x, y, orient, half: 3.5, height: 2.2, body: parts, tag });
}

export function mfc({ x, y, orient = "right", tag = null }) {
  const parts = [poly([[-6, -3.5], [6, -3.5], [6, 3.5], [-6, 3.5]], { fill: "#ffffff" }), label(0, 0.9, "MFC", 2.4)];
  return inline({ kind: "flow.mfc", x, y, orient, half: 6, height: 3.5, body: parts, extraPorts: { signal: [0, -3.5, UP] }, tag });
}

export function filter({ x, y, orient = "right", tag = null }) {
  const parts = [poly([[-3.4, 0], [0, -3.4], [3.4, 0], [0, 3.4]], { fill: "#ffffff" }), line([[0, -3.4], [0, 3.4]], { "stroke-dasharray": "0.8 0.6" })];
  return inline({ kind: "line.filter", x, y, orient, half: 3.4, height: 3.4, body: parts, tag });
}

// Concentric reducers taper on both sides; an eccentric one keeps one side flat (bottom flat
// by default, as on pump suctions, so no vapour pocket forms).
export function reducer({ x, y, orient = "right", eccentric = false, flat = "bottom" }) {
  const shape = !eccentric
    ? [[-2.4, -2.4], [2.4, -1.4], [2.4, 1.4], [-2.4, 2.4]]
    : flat === "top" ? [[-2.4, -2.4], [2.4, -2.4], [2.4, 0.4], [-2.4, 2.4]] : [[-2.4, -2.4], [2.4, -0.4], [2.4, 2.4], [-2.4, 2.4]];
  return inline({ kind: eccentric ? "line.reducer-eccentric" : "line.reducer", x, y, orient, half: 2.4, height: 2.4, body: [poly(shape)] });
}

export function flange({ x, y, orient = "right" }) {
  return inline({ kind: "line.flange", x, y, orient, half: 0.7, height: 2.8, body: [line([[-0.7, -2.8], [-0.7, 2.8]], { "stroke-width": W.symbol }), line([[0.7, -2.8], [0.7, 2.8]], { "stroke-width": W.symbol })] });
}

export function sightGlass({ x, y, orient = "right" }) {
  return inline({ kind: "line.sightglass", x, y, orient, half: 2.8, height: 2.8, body: [circle(0, 0, 2.8, { fill: "#ffffff" }), circle(0, 0, 1.2)] });
}

// A spectacle (figure-8) blind: the half in the line is solid when the line is blinded
// (normally closed) and a ring when it is open; the other half hangs off the line.
export function blind({ x, y, orient = "right", state = "closed" }) {
  const closed = state !== "open";
  const body = [
    line([[0, -1.8], [0, -3.2]], { "stroke-width": W.symbol }),
    circle(0, 0, 1.8, { fill: closed ? PID.ink : PID.paper }),
    circle(0, -5, 1.8, { fill: closed ? PID.paper : PID.ink }),
  ];
  return inline({ kind: closed ? "line.blind" : "line.blind-open", x, y, orient, half: 1.8, height: 1.8, body, extraBoxes: [[-1.9, -6.9, 1.9, 0]] });
}

// Primary flow elements (ISA-5.1 Table 5.2.3). Elements without a drawn form of their own
// carry the measurement notation of Table 5.2.2 in a small box on the line.
const FLOW_NOTATION = Object.freeze({ magnetic: "MAG", coriolis: "COR", vortex: "VOR", turbine: "TUR", ultrasonic: "US", thermal: "TMF" });
export function flowElement({ x, y, type = "orifice", orient = "right", tag = null }) {
  if (type === "orifice") return orifice({ x, y, orient, tag });
  if (type === "venturi") {
    const body = [line([[-4, -2.4], [-1.2, -1.1], [1.2, -1.1], [4, -2.4]]), line([[-4, 2.4], [-1.2, 1.1], [1.2, 1.1], [4, 2.4]])];
    return inline({ kind: "flow.venturi", x, y, orient, half: 4, height: 2.4, body, tag });
  }
  const note = FLOW_NOTATION[type];
  if (!note) throw new Error(`flowElement: type must be orifice, venturi or one of ${Object.keys(FLOW_NOTATION).join(", ")}`);
  const body = [poly([[-4.4, -2.4], [4.4, -2.4], [4.4, 2.4], [-4.4, 2.4]], { fill: PID.paper }), label(0, 0.85, note, 2.4)];
  return inline({ kind: `flow.${type}`, x, y, orient, half: 4.4, height: 2.4, body, tag });
}

// ---------------------------------------------------------------- instruments

// Round-1 location names: a location alone used to pick the whole bubble.
const LEGACY_LOCATION = Object.freeze({
  panel: ["discrete", "main"], "panel-rear": ["discrete", "main-rear"], "local-panel": ["discrete", "aux"],
  dcs: ["shared", "main"], plc: ["plc", "main"],
});

// ISA-5.1 Table 5.1.1: the shape says what kind of device or function it is, the lines across
// it say where it lives (none in the field, one in the main control room, two on an auxiliary
// or local panel; dashed when the operator cannot normally reach it).
export function instrument({ x, y, tag, fn = null, location = "field", r = 5 }) {
  const parsed = parseInstrumentTag(tag);
  if (!parsed.ok) throw new Error(`pid: instrument tag "${tag}": ${parsed.error}`);
  const [legacyFn, legacyLocation] = LEGACY_LOCATION[location] ?? [null, location];
  const func = fn ?? legacyFn ?? "discrete";
  const where = LEGACY_LOCATION[location] ? legacyLocation : location;
  if (!FUNCTIONS[func]) throw new Error(`pid: instrument fn must be one of ${Object.keys(FUNCTIONS).join(", ")}`);
  if (!LOCATIONS[where]) throw new Error(`pid: instrument location must be one of ${Object.keys(LOCATIONS).join(", ")}`);
  const kind = `instrument.${func}-${where}`;
  const parts = [];
  const square = () => poly([[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]], { fill: "#ffffff" });
  if (func === "shared") parts.push(square(), circle(x, y, r, { fill: "#ffffff" }));
  else if (func === "plc") parts.push(square(), poly([[x, y - r], [x + r, y], [x, y + r], [x - r, y]]));
  else if (func === "computer") parts.push(poly([[x - r, y], [x - r / 2, y - r * 0.866], [x + r / 2, y - r * 0.866], [x + r, y], [x + r / 2, y + r * 0.866], [x - r / 2, y + r * 0.866]], { fill: "#ffffff" }));
  else parts.push(circle(x, y, r, { fill: "#ffffff" }));
  const rear = where.endsWith("-rear") ? { "stroke-dasharray": "0.9 0.6" } : {};
  if (where.startsWith("main")) parts.push(line([[x - r, y], [x + r, y]], rear));
  if (where.startsWith("aux")) parts.push(line([[x - r, y - 0.35], [x + r, y - 0.35]], rear), line([[x - r, y + 0.35], [x + r, y + 0.35]], rear));
  const letters = parsed.letters;
  const size = Math.min(letters.length >= 4 ? 2.1 : PID.text.tag, r * 0.5);
  parts.push(el("text", { x, y: y - r * 0.16, "font-family": FONT_LATIN, "font-size": size, "text-anchor": "middle", fill: PID.ink, stroke: "none", "data-label": "tag-letters" }, esc(letters)));
  parts.push(el("text", { x, y: y + r * 0.58, "font-family": FONT_LATIN, "font-size": Math.min(PID.text.small + 0.2, r * 0.44), "text-anchor": "middle", fill: PID.ink, stroke: "none", "data-label": "tag-loop" }, esc(parsed.loop)));
  return symbol({
    kind,
    tag: `${letters}-${parsed.loop}`,
    box: [x - r, y - r, x + r, y + r],
    ports: { top: [x, y - r, UP], bottom: [x, y + r, DOWN], left: [x - r, y, LEFT], right: [x + r, y, RIGHT] },
    body: parts,
    meta: { meaning: parsed.meaning },
  });
}

export function interlock({ x, y, text = "I", r = 4.6 }) {
  return symbol({
    kind: "logic.interlock",
    tag: null,
    box: [x - r, y - r, x + r, y + r],
    ports: { top: [x, y - r, UP], bottom: [x, y + r, DOWN], left: [x - r, y, LEFT], right: [x + r, y, RIGHT] },
    body: [poly([[x, y - r], [x + r, y], [x, y + r], [x - r, y]], { fill: "#ffffff" }), label(x, y + 0.9, text, 2.2)],
  });
}

// ---------------------------------------------------------------- terminals

export function vent({ x, y, text = "ATM" }) {
  const parts = [line([[x, y], [x, y - 4]]), el("path", { d: `M${n(x)} ${n(y - 4)}A2 2 0 0 1 ${n(x + 4)} ${n(y - 4)}L${n(x + 4)} ${n(y - 2.6)}` }), label(x + 4, y + 0.6, text, 2.2)];
  return symbol({ kind: "terminal.vent", box: [x - 0.5, y - 6.2, x + 6.4, y + 0.8], ports: { in: [x, y, DOWN] }, body: parts });
}

export function drain({ x, y, text = "DR" }) {
  const parts = [poly([[x - 2, y], [x + 2, y], [x, y + 2.8]]), label(x, y + 5.6, text, 2.2)];
  return symbol({ kind: "terminal.drain", box: [x - 2.8, y, x + 2.8, y + 5.8], ports: { in: [x, y, UP] }, body: parts });
}

export function samplePoint({ x, y, text = "SP", facing = "down" }) {
  const s = facing === "up" ? -1 : 1;
  const parts = [line([[x, y], [x, y + s * 3]]), poly([[x - 1.4, y + s * 3], [x + 1.4, y + s * 3], [x, y + s * 4.8]], { fill: PID.ink }), label(x + 2.4, y + s * 4.6 + (s > 0 ? 0.6 : 0), text, 2.2, { "text-anchor": "start" })];
  const y0 = Math.min(y, y + s * 5.4);
  return symbol({ kind: "terminal.sample", box: [x - 1.6, y0, x + 2.4 + text.length * 1.6, Math.max(y, y + s * 5.4)], ports: { in: [x, y, s > 0 ? UP : DOWN] }, body: parts });
}

// Off-page and utility connectors: a pentagon pointing along the flow, the text inside.
function connector({ kind, x, y, text, width, pointing }) {
  const h = 5;
  const tip = 2.6;
  const m = pointing === "left" ? -1 : 1;
  const x0 = x;
  const x1 = x + m * (width + tip);
  const pts = [[x0, y - h / 2], [x + m * width, y - h / 2], [x1, y], [x + m * width, y + h / 2], [x0, y + h / 2]];
  const textX = x + (m * width) / 2;
  return symbol({
    kind,
    box: [Math.min(x0, x1), y - h / 2, Math.max(x0, x1), y + h / 2],
    ports: { in: [x0, y, m > 0 ? LEFT : RIGHT], out: [x1, y, m > 0 ? RIGHT : LEFT] },
    body: [poly(pts, { fill: "#ffffff" }), label(textX, y + 0.8, text, 2.2)],
  });
}

export const offPage = ({ x, y, text, pointing = "right" }) =>
  connector({ kind: "terminal.offpage", x, y, text, width: Math.max(14, text.length * 1.45 + 3), pointing });
export const utility = ({ x, y, text, pointing = "right" }) =>
  connector({ kind: "terminal.utility", x, y, text, width: Math.max(8, text.length * 1.45 + 2.4), pointing });
