// The heat exchanger as a scene: one function of the camera, the explode amount and the flow
// phase, so the static figure, the interactive page and the motion loop share one geometry.
//
// Parts list (written before any geometry): base pad, two saddles with base plates; front
// channel with ellipsoidal bonnet, channel and shell flanges with bolt circles, shell with a
// window cutaway, rear bonnet and flange; inside: twelve tubes split at every baffle, four
// baffles, two tubesheets; nozzles: shell-side and tube-side inlets with flanges and bolts.
//
// Assemblies (groups) and how they come apart for maintenance: the front head (channel, its
// flange and the tube-side nozzle) comes off first, then the tube bundle is pulled out of the
// front, the rear head comes off the back; shell and supports stay.

import { createFigure } from "../../scripts/lib/figure.mjs";
import { createIsoView, ellipsoidalHead, frameAlong } from "../../scripts/lib/iso.mjs";

export const MOVES = Object.freeze({ front: [-230, 0, 0], bundle: [-150, 0, 0], rear: [110, 0, 0] });
export const ORDER = Object.freeze(["front", "bundle", "rear"]);
export const LAYERS = Object.freeze([
  { group: "shell", label: "Shell" },
  { group: "bundle", label: "Tube bundle" },
  { group: "front", label: "Front head" },
  { group: "rear", label: "Rear head" },
]);
export const VIEWS = Object.freeze([
  { id: "front-left", label: "Front left", azimuth: 62, elevation: 28 },
  { id: "front-high", label: "From above", azimuth: 50, elevation: 48 },
  { id: "rear-right", label: "Rear right", azimuth: 118, elevation: 26 },
]);

const Z = 120;
const R = 60;
const SHELL = [8, 330];
const BAFFLES = [80, 140, 200, 260];
const TUBE_ROWS = [[-30, 18], [-10, 18], [10, 18], [30, 18], [-20, 0], [0, 0], [20, 0], [-30, -18], [-10, -18], [10, -18], [30, -18], [0, 36]];

// explode: 0 assembled .. 1 apart, per group or one number for all. flow: dash phase in mm
// along the tubes, or null for no flow. reach: keep the exploded positions in frame.
export function scene({ azimuth = 62, elevation = 28, explode = 0, flow = null, callouts = true, reach = false, width = 160, height = 92 } = {}) {
  const share = (g) => (typeof explode === "number" ? explode : explode[g] ?? 0);
  const shift = (g, p) => { const m = MOVES[g] ?? [0, 0, 0]; return [p[0] + m[0] * share(g), p[1] + m[1] * share(g), p[2] + m[2] * share(g)]; };
  const v = createIsoView({ azimuth, elevation });

  v.halo({ plan: { x: -130, y: -95, w: 520, d: 190, r: 6 }, z: -12 });
  v.box({ name: "base pad", plan: { x: -130, y: -95, w: 520, d: 190, r: 6 }, z: -12, h: 12, tone: "lo", layer: -1, group: "support" });
  const saddles = [70, 270].map((sx) => {
    v.box({ name: `saddle base ${sx}`, plan: { x: sx - 12, y: -52, w: 24, d: 104, r: 2 }, z: 0, h: 5, tone: "frame", group: "support" });
    return v.box({ name: `saddle ${sx}`, plan: { x: sx - 4, y: -46, w: 8, d: 92 }, z: 5, h: Z - R - 2, tone: "frame", group: "support" });
  });
  if (reach) {
    const far = (g, x) => [[x + MOVES[g][0], -R - 12, Z - R - 12], [x + MOVES[g][0], R + 12, Z + R + 40]];
    v.extent([...far("front", -110), ...far("rear", 390)]);
  }

  const axis = "x";
  const disc = (name, s0, s1, r, { tone = "mid", into = null, group }) =>
    v.lathe({ name, origin: shift(group, [0, 0, Z]), axis, profile: [[s0, 0], [s0, r], [s1, r], [s1, 0]], tone, into, group });

  // Front head: channel with bonnet, channel flange and bolts, tube-side nozzle.
  const bonnet = ellipsoidalHead(62).map(([s, r, sm]) => [-70 - s, r, sm]).reverse();
  v.lathe({ name: "channel", origin: shift("front", [0, 0, Z]), axis, profile: [...bonnet, [-70, 62], [-8, 62], [-8, 0]], tone: "mid", seams: [-70], group: "front" });
  const channelFlange = disc("channel flange", -8, 0, 72, { group: "front" });
  v.boltCircle({ name: "channel flange bolts", frame: frameAlong(shift("front", [0, 0, Z]), axis), s: -4, radius: 67, count: 16, group: "front" });

  // Shell with its flanges; the cutaway window shows the bundle inside.
  disc("shell flange", 0, 8, 72, { group: "shell" });
  v.boltCircle({ name: "shell flange bolts", frame: frameAlong([0, 0, Z], axis), s: 4, radius: 67, count: 16, group: "shell" });
  const shell = v.lathe({
    name: "shell", origin: [0, 0, Z], axis, profile: [[SHELL[0], 0], [SHELL[0], R], [SHELL[1], R], [SHELL[1], 0]],
    tone: "hi", cut: { from: 40, to: 290, span: 96 }, wall: 4, seams: [120, 220], group: "shell",
  });

  // Rear head.
  disc("rear flange", 330, 338, 72, { group: "rear" });
  v.lathe({ name: "rear bonnet", origin: shift("rear", [0, 0, Z]), axis, profile: [[338, 0], [338, 62], ...ellipsoidalHead(62).map(([s, r, sm]) => [338 + s, r, sm]).slice(1)], tone: "mid", group: "rear" });
  v.boltCircle({ name: "rear flange bolts", frame: frameAlong(shift("rear", [0, 0, Z]), axis), s: 334, radius: 67, count: 16, group: "rear" });

  // Tube bundle, drawn inside the shell's cutaway: tubesheets, baffles, tubes split at each baffle.
  disc("front tubesheet", 8, 16, R - 4, { tone: "brass", into: shell, group: "bundle" });
  disc("rear tubesheet", 322, 330, R - 4, { tone: "brass", into: shell, group: "bundle" });
  const baffles = BAFFLES.map((s, i) => v.lathe({
    name: `baffle ${i + 1}`, origin: shift("bundle", [0, 0, Z]), axis,
    profile: [[s, 0], [s, R - 5], [s + 3, R - 5], [s + 3, 0]], tone: "stainless", into: shell, group: "bundle",
  }));
  const stops = [16, ...BAFFLES.flatMap((s) => [s, s + 3]), 322];
  const tubes = [];
  TUBE_ROWS.forEach(([y, z], t) => {
    for (let k = 0; k < stops.length; k += 2) {
      const origin = shift("bundle", [0, y, Z + z]);
      tubes.push(v.lathe({ name: `tube ${t + 1}.${k / 2 + 1}`, origin, axis, profile: [[stops[k], 0], [stops[k], 3.5], [stops[k + 1], 3.5], [stops[k + 1], 0]], tone: "copper", steps: 32, into: shell, group: "bundle" }));
      if (flow !== null) {
        // Tube-side fluid: dashes on the tube's crown line, marching from the channel end.
        const a = [origin[0] + stops[k], origin[1], origin[2] + 3.6];
        const b = [origin[0] + stops[k + 1], origin[1], origin[2] + 3.6];
        v.polyline({ name: `tube flow ${t + 1}.${k / 2 + 1}`, points: [a, b], color: "#0b5e8e", width: 0.5, bias: 1.2, into: shell, group: "bundle", flow: { dash: [9, 9], start: stops[k], offset: flow } });
      }
    }
  });

  // Nozzles with flanges: shell side on the shell, tube side on the channel.
  const nozzle = (name, s, group) => {
    const at = shift(group, [s, 0, Z]);
    const body = v.lathe({ name, origin: at, axis: "z", profile: [[R - 6, 0], [R - 6, 13], [R + 26, 13], [R + 26, 0]], tone: "mid", group });
    v.lathe({ name: `${name} flange`, origin: at, axis: "z", profile: [[R + 26, 0], [R + 26, 21], [R + 32, 21], [R + 32, 0]], tone: "mid", group });
    v.boltCircle({ name: `${name} bolts`, frame: frameAlong([at[0], at[1], at[2] + R + 32], "z"), s: 0, radius: 17, count: 8, group });
    return body;
  };
  const shellInlet = nozzle("shell inlet", 312, "shell");
  const tubeInlet = nozzle("tube inlet", -40, "front");

  if (callouts) {
    v.callout({ part: shell, at: shell.anchor(0.93, -25), text: "Shell" });
    v.callout({ part: baffles[2], at: baffles[2].anchor(0.5, -72), text: "Segmental baffle" });
    v.callout({ part: tubeInlet, text: "Tube-side inlet" });
    v.callout({ part: shellInlet, text: "Shell-side inlet" });
    v.callout({ part: channelFlange, at: channelFlange.anchor(0.5, -40), text: "Channel flange" });
    v.callout({ part: saddles[1], at: saddles[1].anchor(), text: "Saddle support" });
    v.callout({ part: tubes[stops.length / 2 * 1 + 2], text: "Tube bundle" });
  }

  const fig = createFigure({ width, height, mode: "iso", title: "Shell-and-tube heat exchanger, window cutaway", desc: "Isometric cutaway of a shell-and-tube heat exchanger showing tubes, baffles, tubesheets, nozzles and saddles." });
  fig.panel(null, [0, 0, width, height]).iso(v, { labelColumn: callouts ? 26 : null });
  const svg = fig.render();
  return { svg, view: v, warnings: fig.warnings() };
}

// One loop for the motion export: the bundle and heads come together, tube-side fluid runs,
// then they come apart again, so the last frame leads straight back into the first.
const smooth = (t) => t * t * (3 - 2 * t);
export function frame(t) {
  const together = t < 0.3 ? 1 - smooth(t / 0.3) : t < 0.7 ? 0 : smooth((t - 0.7) / 0.3);
  const explode = Object.fromEntries(ORDER.map((g, i) => [g, Math.min(1, Math.max(0, together * 1.25 - i * 0.12))]));
  return scene({ explode, flow: t * 4 * 18, callouts: false, reach: true }).svg;
}
