#!/usr/bin/env node
// Starts a drawing from the closest worked example.
//
//   node scaffold.mjs pid <dir>        P&ID on an A3 sheet (examples/pid-dosing-skid)
//   node scaffold.mjs journal <dir>    two-panel journal figure (examples/journal-adsorption-rig)
//   node scaffold.mjs iso <dir>        isometric cutaway (examples/iso-heat-exchanger)
//
// It writes <dir>/build.mjs (and every other module of the example, such as the iso scene.mjs)
// with the kit imports pointing at this installed skill, never overwrites an existing file, and
// never writes inside the plugin.

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const TEMPLATES = Object.freeze({
  pid: "pid-dosing-skid",
  journal: "journal-adsorption-rig",
  iso: "iso-heat-exchanger",
});

export function scaffold(kind, dir) {
  const example = TEMPLATES[kind];
  if (!example) throw new Error(`kind must be one of ${Object.keys(TEMPLATES).join(", ")}`);
  const target = resolve(dir);
  const pluginRoot = realpathSync(resolve(SKILL_ROOT, "..", ".."));
  mkdirSync(target, { recursive: true });
  const real = realpathSync(target);
  if (real === pluginRoot || real.startsWith(pluginRoot + sep)) throw new Error("refusing to write inside the installed plugin; pick a directory in your project");
  const modules = readdirSync(join(SKILL_ROOT, "examples", example)).filter((f) => f.endsWith(".mjs"));
  for (const name of modules) {
    if (existsSync(join(target, name))) throw new Error(`${join(target, name)} already exists; move it or pick another directory`);
  }
  const lib = pathToFileURL(join(SKILL_ROOT, "scripts", "lib")).href;
  for (const name of modules) {
    const source = readFileSync(join(SKILL_ROOT, "examples", example, name), "utf8")
      .replaceAll('"../../scripts/lib/', `"${lib}/`)
      .replaceAll('"../../scripts/', `"${pathToFileURL(join(SKILL_ROOT, "scripts")).href}/`);
    writeFileSync(join(target, name), source);
  }
  return join(target, "build.mjs");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [kind, dir] = process.argv.slice(2);
  if (!kind || !dir) {
    console.error("Usage: node scaffold.mjs pid|journal|iso <dir>");
    process.exitCode = 2;
  } else {
    try {
      const file = scaffold(kind, dir);
      console.log(`SCAFFOLD ${file}`);
      console.log(`next: edit it, then node ${file} ${resolve(dir)} && node ${join(SKILL_ROOT, "scripts", "qa.mjs")} <svg>`);
    } catch (error) {
      console.error(`SCAFFOLD_REFUSED ${error.message}`);
      process.exitCode = 1;
    }
  }
}
