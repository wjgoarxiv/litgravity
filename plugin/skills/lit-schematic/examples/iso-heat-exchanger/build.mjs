// Worked example: isometric window cutaway of a shell-and-tube heat exchanger, in the three
// outputs a cutaway can take. The geometry lives in scene.mjs.
//
//   node build.mjs [out-dir]           -> iso-heat-exchanger.svg (static, the default)
//   node build.mjs [out-dir] --html    -> also iso-heat-exchanger.html (interactive page)
//   node ../../scripts/motion.mjs scene.mjs --out <dir> --name iso-heat-exchanger   (motion loop)

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderInteractive } from "../../scripts/lib/interactive.mjs";
import { LAYERS, MOVES, ORDER, VIEWS, scene } from "./scene.mjs";

const args = process.argv.slice(2);
const out = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
mkdirSync(out, { recursive: true });

const still = scene();
const file = join(out, "iso-heat-exchanger.svg");
writeFileSync(file, still.svg);
for (const warning of still.warnings) console.warn(`WARN ${warning}`);
console.log(file);

if (args.includes("--html")) {
  // Every preset view is drawn with room for the exploded parts, and each view gets the screen
  // offsets of the same world moves.
  const views = VIEWS.map(({ id, label, azimuth, elevation }) => {
    const drawn = scene({ azimuth, elevation, reach: true, width: 180, height: 104 });
    for (const warning of drawn.warnings) console.warn(`WARN ${label}: ${warning}`);
    return { id, label, svg: drawn.svg, explode: Object.fromEntries(Object.entries(MOVES).map(([g, m]) => [g, drawn.view.screenVector(m)])) };
  });
  const page = join(out, "iso-heat-exchanger.html");
  writeFileSync(page, renderInteractive({
    title: "Shell-and-tube heat exchanger",
    description: "Window cutaway of a fixed-tubesheet exchanger. Take it apart the way maintenance does: front head off, bundle out of the front, rear head off.",
    views, layers: LAYERS, order: ORDER,
  }));
  console.log(page);
}
