// `motion.mjs scaffold --out <dir>`: the starting stage page, written from the treatment, so every
// film has the same architecture: the COPY block, one <section> per shot with its type placed in the
// shot's type zone and an empty subject group in its subject zone, entrances and hand-offs on the
// house style's tokens, and one DRAW function per shot where the drawing goes. The page passes the
// style rules as written; the drawing is the model's. A 3D film (`depth: "3d"`) also gets the
// three.js world: an import map onto the vendored build, a full-frame canvas behind the shots, one
// persistent protagonist group lit and shadowed in the style's palette, and one WORLD function per
// shot. It never overwrites an existing page.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EXIT } from "../core/constants.mjs";
import { BlockedError } from "./chrome.mjs";
import { findBlender } from "./blender.mjs";
import { FORMATS, asksPathTraced, loadTreatment } from "./treatment.mjs";

const HANGUL = /[ㄱ-ㆎ가-힣]/u;

/**
 * Which copy lines each shot shows: the treatment's `lines` when given; otherwise spread in order over
 * the shots that have a type zone, the first line on the first and the last line on the last.
 */
export function linesPerShot(treatment) {
  const beats = treatment.beats;
  if (beats.some((b) => Array.isArray(b.lines))) return beats.map((b) => (Array.isArray(b.lines) ? b.lines : []));
  const lines = treatment.copy.lines.map((_, i) => i);
  const textShots = beats.map((b, i) => (b.layout === "full" ? null : i)).filter((i) => i !== null);
  const out = beats.map(() => []);
  if (!textShots.length) return out;
  lines.forEach((line, k) => {
    const at = lines.length > 1 ? Math.round((k * (textShots.length - 1)) / (lines.length - 1)) : 0;
    out[textShots[at]].push(line);
  });
  return out;
}

/** The scaffold page for a stage treatment. */
export function scaffoldHtml(treatment) {
  const [width, height] = FORMATS[treatment.format];
  const perShot = linesPerShot(treatment);
  const lang = treatment.copy.lines.some((l) => HANGUL.test(l)) ? "ko" : "en";
  const sections = treatment.beats.map((b, i) => {
    const lines = perShot[i];
    const roleOf = (k) => (k > 0 ? "lit-body lit-muted" : b.layout === "title" ? "lit-display lit-ink" : "lit-headline lit-ink");
    const type = b.layout === "full" || !lines.length ? "" : `\n    <div class="type" data-zone="type">${lines.map((line, k) => `\n      <p class="${roleOf(k)}" data-copy="${line}"></p>`).join("")}\n    </div>`;
    return `  <!-- shot ${i + 1}: ${String(b.purpose).replace(/--/gu, "-")} -->\n  <section class="shot" data-shot="${i}">\n    <svg class="subject" data-zone="subject"></svg>${type}\n  </section>`;
  }).join("\n");
  const draws = treatment.beats.map((b, i) => `    // shot ${i + 1} (${b.layout}): ${String(b.hero).replace(/\*\//gu, "* /")}\n    (s, svg, t) => {},`).join("\n");
  const solid = treatment.depth === "3d";
  const worlds = treatment.beats.map((b, i) => `    // shot ${i + 1} (${b.layout})\n    (s, hero, cam, t) => {},`).join("\n");
  const head3d = solid ? `
<script type="importmap">{ "imports": { "three": "/lit/three/three.module.js", "three/addons/": "/lit/three/addons/" } }</script>` : "";
  const canvas3d = solid ? `<canvas id="world" width="${width}" height="${height}"></canvas>\n` : "";
  const style3d = solid ? `
  #world { position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px; }` : "";
  const world3d = solid ? `
  // The world: one scene for the whole film, drawn on the GPU rung (software when it is missing). The
  // protagonist lives in HERO from the first frame to the last; each shot's WORLD function poses it,
  // the camera and anything else as a function of the shot's progress. The camera is aimed so the
  // world origin sits at the centre of the shot's subject zone. More parts of the vendored build:
  // three/addons/geometries/RoundedBoxGeometry.js.
  const PAL = LitStyle.palette;
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("world"), antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(${width}, ${height}, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(32, ${width} / ${height}, 0.1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0004; // without these a turning object's shadow acne flickers as flashes
  key.shadow.normalBias = 0.03;
  scene.add(key, new THREE.HemisphereLight(PAL.surface ?? PAL.ground, PAL.ground, 0.6));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const HERO = new THREE.Group();
  scene.add(HERO);

  // Aim the camera so the origin lands on the centre of the shot's subject zone.
  function aim(layout) {
    const z = LitStage.zone(layout, "subject");
    cam.setViewOffset(${width}, ${height}, ${width} / 2 - (z.x + z.w / 2), ${height} / 2 - (z.y + z.h / 2), ${width}, ${height});
    return z.h / ${height};
  }

  const WORLD = [
${worlds}
  ];

  function drawWorld(s, t) {
    cam.position.set(0, 1.6, 7);
    cam.lookAt(0, 0.6, 0);
    aim(s.beat.layout);
    WORLD[s.index](s, HERO, cam, t);
    renderer.render(scene, cam);
  }
` : "";
  const scriptOpen = solid ? `<script type="module">
  import * as THREE from "three";
  import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
` : "<script>\n";
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="/lit/fonts.css">
<link rel="stylesheet" href="/lit/style.css">
<script src="/lit/style.js"></script>
<script src="/lit/stage-kit.js"></script>${head3d}
<style>
  html, body { width: ${width}px; height: ${height}px; }
  .shot { position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px; visibility: hidden; }
  .subject { position: absolute; overflow: visible; }
  .type { display: flex; flex-direction: column; justify-content: center; gap: 0.4em; }${style3d}
</style>
</head>
<body>
${canvas3d}${sections}
${scriptOpen}  // The film's words: every copy line of treatment.json, verbatim. Edit them here.
  const COPY = ${JSON.stringify(treatment.copy.lines, null, 2).replace(/\n/gu, "\n  ")};

  const { define, shot, place, tokens, text, clamp, clipRect, clipCircle } = LitStage;
  const T = tokens();
  const BEATS = LitTimeline.beats;
  const SHOTS = [...document.querySelectorAll(".shot")];
  SHOTS.forEach((el, i) => {
    place(el.querySelector('[data-zone="subject"]'), BEATS[i].layout, "subject");
    const type = el.querySelector('[data-zone="type"]');
    if (type) place(type, BEATS[i].layout, "type");
  });
  for (const el of document.querySelectorAll("[data-copy]")) {
    el.textContent = COPY[Number(el.dataset.copy)];
    text(el);
  }

  // One function per shot: draw the subject into its svg (the subject zone) as a function of the
  // shot's progress. s is LitStage.shot(t): s.p (0..1), s.local (seconds), s.enter(delay, dur).
  const DRAW = [
${draws}
  ];

  // How a shot hands off to the next, over the style's exit duration before the cut.
  const HANDOFF = T.dur.exit;
  const handoff = { wipe: (el, p) => clipRect(el, p, { from: "left" }), iris: (el, p) => clipCircle(el, p, { x: 50, y: 50 }), dissolve: (el, p) => { el.style.opacity = String(p); } };

  function paint(i, s, t) {
    const el = SHOTS[i];
    el.style.visibility = "visible";
    const type = el.querySelector('[data-zone="type"]');
    if (type) {
      const e = s.enter(0.1);
      type.style.opacity = String(e);
      type.style.transform = \`translateY(\${(1 - e) * 24}px)\`;
    }
    DRAW[i](s, el.querySelector('[data-zone="subject"]'), t);
  }
${world3d}
  define({ width: ${width}, height: ${height}, fps: ${treatment.fps ?? 60}, duration: ${treatment.durationSec}, render(t) {
    for (const el of SHOTS) Object.assign(el.style, { visibility: "hidden", opacity: "", clipPath: "", transform: "", zIndex: "" });
    const s = shot(t);
    paint(s.index, s, t);${solid ? "\n    drawWorld(s, t);" : ""}
    const next = SHOTS[s.index + 1];
    const into = clamp((t - (s.beat.t1 - HANDOFF)) / HANDOFF);
    if (next && into > 0) {
      const p = T.ease.move(into);
      const kind = s.beat.transition;
      if (handoff[kind]) {
        next.style.zIndex = "1";
        paint(s.index + 1, shot(BEATS[s.index + 1].t0), t);
        handoff[kind](next, p);
      } else if (kind === "push") {
        SHOTS[s.index].style.transform = \`translateX(\${-p * ${width}}px)\`;
        paint(s.index + 1, shot(BEATS[s.index + 1].t0), t);
        next.style.transform = \`translateX(\${(1 - p) * ${width}}px)\`;
      }
    }
  } });
</script>
</body>
</html>
`;
}

/** Write `<out>/stage/index.html` from the treatment; refuses to replace a page. */
// The scaffold's word on the 3D renderer: a Blender film draws its world in stage/scene.py; a film that
// asks for high-quality 3D on a machine with Blender is pointed at that rung before any drawing starts.
function rungNote(treatment, out, env) {
  if (treatment.depth !== "3d") return "";
  if (treatment.render3d === "blender") return ` This is a Blender film: write the world in ${path.join(out, "stage", "scene.py")}, look at the preview stills (blender --out ${out}), render the plate (--final), and show it under the type with LitStage.plate() in place of the three.js world (references/depth.md, The Blender rung).`;
  const found = asksPathTraced(treatment.request) ? findBlender({ env }) : null;
  return found ? `\nBLENDER: ${found.path} is installed and the request asks for high-quality 3D. Take the Blender rung: set render3d "blender" in the treatment, write stage/scene.py, and keep this page for the type, labels and panels over the plate (references/depth.md, The Blender rung).` : "";
}

export function scaffoldCommand({ out, env = process.env }) {
  const treatment = loadTreatment(out, { pathName: "stage" });
  const file = path.join(out, "stage", "index.html");
  if (existsSync(file)) throw new BlockedError(EXIT.USAGE, `${file} exists; scaffold never overwrites a page (move it away to start again)`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, scaffoldHtml(treatment));
  return { code: EXIT.OK, message: `SCAFFOLD: ${file} (style ${treatment.style}, ${treatment.beats.length} shots). Draw each shot's subject in its DRAW function, then render the board: stage --out ${out} --round 1 --stills-only${rungNote(treatment, out, env)}` };
}
